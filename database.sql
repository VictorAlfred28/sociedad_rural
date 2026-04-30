-- =========================================================================
-- FULL DATABASE SCHEMA v4 - SOCIEDAD RURAL NORTE CORRIENTES
-- Sincronizado con backend (escaneo de código fuente): 2026-04-24
-- Incluye tablas faltantes identificadas en main.py: camaras, notificaciones_admin
-- =========================================================================

-- ── 1. EXTENSIONS ─────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── 2. CUSTOM TYPES / ENUMS ───────────────────────────────────────────────
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
        CREATE TYPE public.user_role AS ENUM ('ADMIN', 'SOCIO', 'COMERCIO', 'CAMARA');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_status') THEN
        CREATE TYPE public.user_status AS ENUM ('PENDIENTE', 'APROBADO', 'RECHAZADO', 'SUSPENDIDO', 'RESTRINGIDO');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'approval_status') THEN
        CREATE TYPE public.approval_status AS ENUM ('PENDIENTE', 'APROBADO', 'RECHAZADO', 'SUSPENDIDO');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'family_relationship') THEN
        CREATE TYPE public.family_relationship AS ENUM ('CONYUGE', 'HIJO', 'OTRO');
    END IF;
END$$;

-- ── 3. CORE TABLES ────────────────────────────────────────────────────────

-- profiles: Tabla maestra de usuarios del sistema
CREATE TABLE IF NOT EXISTS public.profiles (
    id                              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    nombre_apellido                 TEXT NOT NULL,
    dni                             TEXT UNIQUE,
    username                        VARCHAR UNIQUE,
    email                           TEXT UNIQUE NOT NULL,
    telefono                        TEXT,
    rol                             public.user_role     DEFAULT 'SOCIO'::public.user_role,
    estado                          public.user_status   DEFAULT 'PENDIENTE'::public.user_status,
    password_changed                BOOLEAN              DEFAULT false,
    municipio                       TEXT,
    provincia                       TEXT,
    barrio                          TEXT,
    direccion                       TEXT,
    rubro                           TEXT,
    es_profesional                  BOOLEAN              DEFAULT false,
    camara_denominacion             TEXT,
    camara_provincia                TEXT,
    cuit                            TEXT UNIQUE,
    estado_aprobacion               public.approval_status DEFAULT 'PENDIENTE'::public.approval_status,
    foto_url                        TEXT,
    titular_id                      UUID REFERENCES public.profiles(id),
    tipo_vinculo                    VARCHAR,
    motivo                          TEXT,
    sonido_notificaciones_habilitado BOOLEAN             DEFAULT TRUE,
    numero_socio                    TEXT,                -- Número correlativo de 4 dígitos (ej: 0001). Solo para SOCIO APROBADO.
    created_at                      TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()),
    updated_at                      TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now())
);

COMMENT ON TABLE  public.profiles IS 'Tabla maestra de todos los usuarios: socios, admins, comercios y cámaras';
COMMENT ON COLUMN public.profiles.titular_id IS 'Si es familiar o empleado, referencia al perfil titular/empleador';
COMMENT ON COLUMN public.profiles.sonido_notificaciones_habilitado IS 'Preferencia de sonido para notificaciones push';

-- ── 4. ROLES SYSTEM (RBAC) ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.roles (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nombre      VARCHAR UNIQUE NOT NULL,
    descripcion TEXT,
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now())
);

COMMENT ON TABLE public.roles IS 'Roles de sistema: SUPERADMIN, ADMINISTRADOR, SOCIO';

-- user_roles: Tabla puente usuarios ↔ roles (PK compuesta)
CREATE TABLE IF NOT EXISTS public.user_roles (
    user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    role_id     UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()),
    PRIMARY KEY (user_id, role_id)
);

COMMENT ON TABLE public.user_roles IS 'Asignación de roles a usuarios. Un usuario puede tener múltiples roles.';

-- ── 5. AUDITORÍA (PARTITIONED BY YEAR) ───────────────────────────────────

CREATE TABLE IF NOT EXISTS public.auditoria_logs (
    id              UUID        DEFAULT gen_random_uuid(),
    usuario_id      UUID,
    email_usuario   VARCHAR,
    rol_usuario     VARCHAR,
    accion          VARCHAR NOT NULL,
    tabla_afectada  VARCHAR NOT NULL,
    registro_id     VARCHAR,
    datos_anteriores JSONB,
    datos_nuevos    JSONB,
    modulo          VARCHAR,
    ip_address      TEXT,
    user_agent      TEXT,
    fecha           TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id, fecha)
) PARTITION BY RANGE (fecha);

-- Particiones por año
CREATE TABLE IF NOT EXISTS public.auditoria_logs_2024 PARTITION OF public.auditoria_logs FOR VALUES FROM ('2024-01-01') TO ('2025-01-01');
CREATE TABLE IF NOT EXISTS public.auditoria_logs_2025 PARTITION OF public.auditoria_logs FOR VALUES FROM ('2025-01-01') TO ('2026-01-01');
CREATE TABLE IF NOT EXISTS public.auditoria_logs_2026 PARTITION OF public.auditoria_logs FOR VALUES FROM ('2026-01-01') TO ('2027-01-01');
CREATE TABLE IF NOT EXISTS public.auditoria_logs_2027 PARTITION OF public.auditoria_logs FOR VALUES FROM ('2027-01-01') TO ('2028-01-01');
CREATE TABLE IF NOT EXISTS public.auditoria_logs_2028 PARTITION OF public.auditoria_logs FOR VALUES FROM ('2028-01-01') TO ('2029-01-01');

COMMENT ON TABLE public.auditoria_logs IS 'Log inmutable de todas las acciones administrativas. Particionado por año para performance.';

-- ── 6. COMERCIOS Y CÁMARAS ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.comercios (
    id              UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
    nombre_comercio TEXT NOT NULL,
    cuit            TEXT UNIQUE NOT NULL,
    rubro           TEXT,
    descripcion     TEXT,
    direccion       TEXT,
    municipio       TEXT,
    telefono        TEXT,
    email           TEXT,
    responsable_dni TEXT,
    logo_url        TEXT,
    instagram_url   TEXT,
    facebook_url    TEXT,
    estado          TEXT DEFAULT 'ACTIVO',
    camara_id       UUID REFERENCES public.profiles(id),
    user_id         UUID REFERENCES auth.users(id),
    organizacion_id UUID,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now())
);

COMMENT ON TABLE public.comercios IS 'Comercios adheridos al sistema de beneficios de la Sociedad Rural';

-- Solicitudes de adhesión (pre-aprobación)
CREATE TABLE IF NOT EXISTS public.comercio_solicitudes (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID UNIQUE REFERENCES auth.users(id),
    nombre          TEXT NOT NULL,
    rubro           TEXT NOT NULL,
    direccion       TEXT NOT NULL,
    telefono        TEXT,
    email           TEXT,
    descripcion     TEXT,
    logo_url        TEXT,
    instagram_url   TEXT,
    facebook_url    TEXT,
    estado          TEXT DEFAULT 'PENDIENTE',
    organizacion_id UUID,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at      TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Promociones / Ofertas publicadas por comercios
CREATE TABLE IF NOT EXISTS public.promociones (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    comercio_id             UUID NOT NULL REFERENCES public.comercios(id) ON DELETE CASCADE,
    titulo                  TEXT NOT NULL,
    descripcion             TEXT,
    tipo                    TEXT CHECK (tipo IN ('promocion', 'descuento', 'beneficio')),
    descuento_porcentaje    NUMERIC,
    valor_descuento         NUMERIC DEFAULT 0,
    tipo_descuento          TEXT DEFAULT 'porcentaje' CHECK (tipo_descuento IN ('porcentaje', 'fijo')),
    imagen_url              TEXT,
    instagram_url           TEXT,
    facebook_url            TEXT,
    fecha_inicio            DATE,
    fecha_fin               DATE,
    activo                  BOOLEAN DEFAULT true,
    es_exclusiva_profesionales BOOLEAN DEFAULT false,
    organizacion_id         UUID,
    created_at              TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()),
    updated_at              TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Cámaras Empresariales (Escaneado desde main.py línea 617)
CREATE TABLE IF NOT EXISTS public.camaras (
    id                  UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    denominacion        TEXT NOT NULL,
    cuit                TEXT,
    municipio           TEXT,
    provincia           TEXT,
    responsable_nombre  TEXT,
    email               TEXT,
    telefono            TEXT,
    created_at          TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now())
);

COMMENT ON TABLE public.camaras IS 'Entidades de Cámaras Empresariales vinculadas en backend';

-- ── 7. SOCIOS: FAMILIA, PROFESIONALES Y DEPENDIENTES ─────────────────────

CREATE TABLE IF NOT EXISTS public.familiares (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    titular_id      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    nombre_apellido TEXT NOT NULL,
    dni             TEXT UNIQUE NOT NULL,
    parentesco      public.family_relationship NOT NULL,
    fecha_nacimiento DATE,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at      TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.profesionales (
    id         UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
    matricula  TEXT NOT NULL,
    titulo     TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.empleados_comercios (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    perfil_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    comercio_id  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    activo       BOOLEAN DEFAULT true,
    fecha_ingreso DATE DEFAULT CURRENT_DATE,
    created_at   TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- ── 8. MUNICIPIOS Y EVENTOS ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.municipios (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nombre TEXT NOT NULL,
    provincia TEXT NOT NULL,
    descripcion TEXT,
    imagen_principal TEXT,
    activo BOOLEAN DEFAULT true,
    fecha_creacion TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS public.eventos (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    titulo      TEXT NOT NULL,
    descripcion TEXT, -- Mapeado a descripcion_corta o descripcion_larga dependiendo del uso
    lugar       TEXT NOT NULL,
    fecha       TIMESTAMP WITHOUT TIME ZONE,
    hora        TEXT, -- Mantenido por compatibilidad
    tipo        TEXT,
    imagen_url  TEXT, -- Mapeado a imagen_principal
    municipio_id UUID REFERENCES public.municipios(id) ON DELETE SET NULL,
    link_instagram TEXT,
    link_facebook TEXT,
    link_whatsapp TEXT,
    link_externo TEXT,
    slug TEXT UNIQUE,
    estado TEXT DEFAULT 'borrador',
    destacado BOOLEAN DEFAULT false,
    publico BOOLEAN DEFAULT true,
    galeria_imagenes JSONB DEFAULT '[]'::jsonb,
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now())
);

-- Eventos importados desde redes sociales vía Make.com webhook
CREATE TABLE IF NOT EXISTS public.eventos_sociales (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    external_id      TEXT UNIQUE NOT NULL,
    titulo           TEXT NOT NULL,
    descripcion_limpia TEXT,
    lugar            TEXT DEFAULT 'A definir',
    fecha_evento     DATE,
    hora_evento      TIME,
    imagen_url       TEXT,
    metadata         JSONB,
    status           TEXT DEFAULT 'borrador' CHECK (status IN ('borrador', 'aprobado', 'rechazado')),
    created_at       TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()),
    updated_at       TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now())
);

-- ── 9. CONTABILIDAD Y PAGOS ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.pagos_cuotas (
    id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    socio_id                 UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    monto                    NUMERIC NOT NULL,
    fecha_vencimiento        DATE NOT NULL,
    estado_pago              TEXT DEFAULT 'PENDIENTE' CHECK (estado_pago IN ('PENDIENTE', 'PENDIENTE_VALIDACION', 'PAGADO', 'RECHAZADO')),
    comprobante_url          TEXT,
    fecha_envio_comprobante  TIMESTAMP WITH TIME ZONE,
    fecha_validacion         TIMESTAMP WITH TIME ZONE,
    admin_validador_id       UUID REFERENCES public.profiles(id),
    created_at               TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE (socio_id, fecha_vencimiento)
);

CREATE TABLE IF NOT EXISTS public.suscripciones (
    id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    socio_id         UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    estado_pago      TEXT DEFAULT 'PENDIENTE',
    vencimiento      DATE,
    mes              INTEGER,
    anio             INTEGER,
    comprobante_url  TEXT,
    mercado_pago_id  TEXT,
    created_at       TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now())
);

-- ── 10. NOTIFICACIONES ────────────────────────────────────────────────────

-- Notificaciones in-app para usuarios
CREATE TABLE IF NOT EXISTS public.notificaciones (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id       UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    titulo           VARCHAR,
    mensaje          TEXT,
    tipo             VARCHAR,
    leido            BOOLEAN DEFAULT false,
    link_url         TEXT,
    metadata         JSONB,
    is_admin_destined BOOLEAN DEFAULT false,
    estado_envio     VARCHAR DEFAULT 'PENDIENTE',
    fecha            TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Notificaciones destinadas a Administradores (Escaneado desde main.py - Solicitudes Soporte/Recuperación de Password)
CREATE TABLE IF NOT EXISTS public.notificaciones_admin (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id       UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    tipo             VARCHAR,
    descripcion      TEXT,
    estado           VARCHAR DEFAULT 'PENDIENTE',
    metadata         JSONB,
    resolved_at      TIMESTAMP WITH TIME ZONE,
    created_at       TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now())
);

COMMENT ON TABLE public.notificaciones_admin IS 'Notificaciones y solicitudes de soporte dirigidas a los administradores';

-- Tokens FCM para notificaciones push
CREATE TABLE IF NOT EXISTS public.push_tokens (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id  UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    token       TEXT UNIQUE NOT NULL,
    plataforma  TEXT DEFAULT 'web',
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now())
);

-- ── 11. CHAT / IA ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.chat_history (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    role       TEXT CHECK (role IN ('system', 'user', 'assistant')),
    content    TEXT NOT NULL,
    metadata   JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now())
);

-- ── 12. QR DINÁMICO ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.qr_tokens (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    token      TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    used       BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now())
);

-- ── 13. LOCALIDADES ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.localidades (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre     TEXT UNIQUE NOT NULL,
    active     BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- ── 14. ACTIVIDAD ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.activity_log (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    socio_id    UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    tipo_evento VARCHAR NOT NULL,
    descripcion TEXT,
    usuario_id  UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    fecha       TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- ── 15. TRIGGERS ──────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.update_modified_column()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_profiles_updated_at      ON public.profiles;
DROP TRIGGER IF EXISTS tr_promociones_updated_at   ON public.promociones;
DROP TRIGGER IF EXISTS tr_eventos_sociales_updated ON public.eventos_sociales;
DROP TRIGGER IF EXISTS tr_familiares_updated_at    ON public.familiares;
DROP TRIGGER IF EXISTS tr_solicitudes_updated_at   ON public.comercio_solicitudes;

CREATE TRIGGER tr_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE PROCEDURE update_modified_column();
CREATE TRIGGER tr_promociones_updated_at BEFORE UPDATE ON public.promociones FOR EACH ROW EXECUTE PROCEDURE update_modified_column();
CREATE TRIGGER tr_eventos_sociales_updated BEFORE UPDATE ON public.eventos_sociales FOR EACH ROW EXECUTE PROCEDURE update_modified_column();
CREATE TRIGGER tr_familiares_updated_at BEFORE UPDATE ON public.familiares FOR EACH ROW EXECUTE PROCEDURE update_modified_column();
CREATE TRIGGER tr_solicitudes_updated_at BEFORE UPDATE ON public.comercio_solicitudes FOR EACH ROW EXECUTE PROCEDURE update_modified_column();

-- ── 16. ÍNDICES DE PERFORMANCE ────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_profiles_estado       ON public.profiles (estado);
CREATE INDEX IF NOT EXISTS idx_profiles_rol          ON public.profiles (rol);
CREATE INDEX IF NOT EXISTS idx_profiles_dni          ON public.profiles (dni);
CREATE INDEX IF NOT EXISTS idx_profiles_titular_id   ON public.profiles (titular_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_numero_socio_unique ON public.profiles (numero_socio) WHERE numero_socio IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pagos_socio_estado    ON public.pagos_cuotas (socio_id, estado_pago);
CREATE INDEX IF NOT EXISTS idx_pagos_vencimiento     ON public.pagos_cuotas (fecha_vencimiento);
CREATE INDEX IF NOT EXISTS idx_notif_usuario_leido   ON public.notificaciones (usuario_id, leido);
CREATE INDEX IF NOT EXISTS idx_activity_socio_fecha  ON public.activity_log (socio_id, fecha DESC);
CREATE INDEX IF NOT EXISTS idx_qr_tokens_user        ON public.qr_tokens (user_id, used, expires_at);
CREATE INDEX IF NOT EXISTS idx_chat_user_created     ON public.chat_history (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_auditoria_usuario     ON public.auditoria_logs_2026 (usuario_id, fecha DESC);
CREATE INDEX IF NOT EXISTS idx_auditoria_accion      ON public.auditoria_logs_2026 (accion, fecha DESC);

-- ── TRIGGER: Auto-asignación de numero_socio al aprobar un SOCIO ─────────────
CREATE OR REPLACE FUNCTION public.fn_asignar_numero_socio()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  siguiente_numero INTEGER;
BEGIN
  IF NEW.estado = 'APROBADO' AND NEW.rol = 'SOCIO' AND NEW.numero_socio IS NULL
     AND (OLD.estado IS DISTINCT FROM 'APROBADO' OR OLD.numero_socio IS NULL)
  THEN
    PERFORM pg_advisory_xact_lock(987654321);
    SELECT COALESCE(MAX(CAST(numero_socio AS INTEGER)), 0) + 1
      INTO siguiente_numero
      FROM public.profiles
     WHERE numero_socio IS NOT NULL AND numero_socio ~ '^\d+$';
    NEW.numero_socio := LPAD(siguiente_numero::TEXT, 4, '0');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_asignar_numero_socio ON public.profiles;
CREATE TRIGGER trg_asignar_numero_socio BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.fn_asignar_numero_socio();

-- ── 17. ROW LEVEL SECURITY (RLS) ──────────────────────────────────────────

ALTER TABLE public.profiles            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auditoria_logs      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comercios           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promociones         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.camaras             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.familiares          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profesionales       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.empleados_comercios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eventos             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eventos_sociales    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pagos_cuotas        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suscripciones       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notificaciones      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notificaciones_admin ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_tokens         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_history        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qr_tokens           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.localidades         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_log        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comercio_solicitudes ENABLE ROW LEVEL SECURITY;

-- Políticas públicas
DROP POLICY IF EXISTS "localidades_public_read" ON public.localidades;
CREATE POLICY "localidades_public_read" ON public.localidades FOR SELECT USING (active = true);

-- ── 18. SEED: ROLES INICIALES ────────────────────────────────────────────

INSERT INTO public.roles (nombre, descripcion) VALUES
    ('SUPERADMIN',    'Administrador Global: gestiona admins, configuraciones y sistema completo.'),
    ('ADMINISTRADOR', 'Administrador Operativo: aprueba usuarios, valida pagos y usa el dashboard.'),
    ('SOCIO',         'Socio estándar con acceso a promociones, carnet virtual y eventos.')
ON CONFLICT (nombre) DO NOTHING;

-- ── 19. DATOS INICIALES: LOCALIDADES ─────────────────────────────────────

INSERT INTO public.localidades (nombre) VALUES
    ('Gobernador Virasoro'),
    ('Santo Tomé'),
    ('Ituzaingó'),
    ('San Carlos'),
    ('Garruchos'),
    ('Virasoro'),
    ('Colonia Carlos Pellegrini'),
    ('Yapeyú')
ON CONFLICT (nombre) DO NOTHING;

-- ── FIN DEL SCHEMA ────────────────────────────────────────────────────────
