-- =========================================================================
-- FULL DATABASE SCHEMA v2 (CON SISTEMA DE ROLES)
-- SOCIEDAD RURAL NORTE CORRIENTES
-- =========================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. ENUMS / CUSTOM TYPES
CREATE TYPE public.user_role AS ENUM ('ADMIN', 'SOCIO', 'COMERCIO', 'CAMARA');
CREATE TYPE public.user_status AS ENUM ('PENDIENTE', 'APROBADO', 'RECHAZADO', 'SUSPENDIDO', 'RESTRINGIDO');
CREATE TYPE public.approval_status AS ENUM ('PENDIENTE', 'APROBADO', 'RECHAZADO', 'SUSPENDIDO');
CREATE TYPE public.family_relationship AS ENUM ('CONYUGE', 'HIJO', 'OTRO');

-- 3. CORE TABLES

-- profiles
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    nombre_apellido TEXT NOT NULL,
    dni TEXT UNIQUE,
    username TEXT UNIQUE, -- Agregado soporte de username para administradores
    email TEXT UNIQUE NOT NULL,
    telefono TEXT,
    rol public.user_role DEFAULT 'SOCIO'::public.user_role,
    estado public.user_status DEFAULT 'PENDIENTE'::public.user_status,
    password_changed BOOLEAN DEFAULT false,
    municipio TEXT,
    direccion TEXT,
    rubro TEXT,
    es_profesional BOOLEAN DEFAULT false,
    camara_denominacion TEXT,
    camara_provincia TEXT,
    cuit TEXT UNIQUE,
    estado_aprobacion public.approval_status DEFAULT 'PENDIENTE'::public.approval_status,
    foto_url TEXT,
    titular_id UUID REFERENCES public.profiles(id),
    tipo_vinculo VARCHAR,
    motivo TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- SISTEMA DE ROLES (SUPERADMIN, ADMINISTRADOR, SOCIO)
CREATE TABLE public.roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre VARCHAR UNIQUE NOT NULL,
    descripcion TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    role_id UUID REFERENCES public.roles(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    UNIQUE(user_id, role_id)
);

-- auditoria (Reemplaza a auditoria_logs para simplificar frontend/backend roles)
CREATE TABLE public.auditoria (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id UUID,
    email_usuario VARCHAR,
    rol_usuario VARCHAR,
    accion VARCHAR NOT NULL,
    tabla_afectada VARCHAR NOT NULL,
    registro_id VARCHAR,
    datos_anteriores JSONB,
    datos_nuevos JSONB,
    modulo VARCHAR,
    ip_address TEXT,
    user_agent TEXT,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- comercios
CREATE TABLE public.comercios (
    id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
    nombre_comercio TEXT NOT NULL,
    cuit TEXT UNIQUE NOT NULL,
    rubro TEXT,
    direccion TEXT,
    municipio TEXT,
    responsable_dni TEXT,
    camara_id UUID REFERENCES public.profiles(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- camaras
CREATE TABLE public.camaras (
    id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
    denominacion VARCHAR NOT NULL,
    cuit VARCHAR NOT NULL,
    municipio VARCHAR,
    provincia VARCHAR,
    responsable_nombre VARCHAR,
    email VARCHAR,
    telefono VARCHAR,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- ofertas
CREATE TABLE public.ofertas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    comercio_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    titulo TEXT NOT NULL,
    descripcion TEXT,
    tipo TEXT CHECK (tipo IN ('promocion', 'descuento', 'beneficio')),
    descuento_porcentaje INTEGER CHECK (descuento_porcentaje >= 0 AND descuento_porcentaje <= 100),
    imagen_url TEXT,
    fecha_inicio DATE DEFAULT CURRENT_DATE,
    fecha_fin DATE,
    activo BOOLEAN DEFAULT true,
    es_exclusiva_profesionales BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- eventos
CREATE TABLE public.eventos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    titulo TEXT NOT NULL,
    descripcion TEXT,
    lugar TEXT NOT NULL,
    fecha DATE NOT NULL,
    hora TIME NOT NULL,
    tipo TEXT NOT NULL,
    imagen_url TEXT,
    municipio VARCHAR,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- eventos_sociales (Make integration)
CREATE TABLE public.eventos_sociales (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    external_id TEXT UNIQUE NOT NULL,
    titulo TEXT NOT NULL,
    descripcion_limpia TEXT,
    lugar TEXT DEFAULT 'A definir'::text,
    fecha_evento DATE,
    hora_evento TIME,
    imagen_url TEXT,
    metadata JSONB,
    status TEXT DEFAULT 'borrador'::text,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- pagos_cuotas
CREATE TABLE public.pagos_cuotas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    socio_id UUID REFERENCES public.profiles(id),
    monto NUMERIC NOT NULL,
    fecha_vencimiento DATE NOT NULL,
    estado_pago TEXT DEFAULT 'PENDIENTE'::text CHECK (estado_pago IN ('PENDIENTE', 'PENDIENTE_VALIDACION', 'PAGADO', 'RECHAZADO')),
    comprobante_url TEXT,
    fecha_envio_comprobante TIMESTAMP WITH TIME ZONE,
    fecha_validacion TIMESTAMP WITH TIME ZONE,
    admin_validador_id UUID REFERENCES public.profiles(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- suscripciones (Legacy or special handling)
CREATE TABLE public.suscripciones (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    socio_id UUID REFERENCES public.profiles(id),
    estado_pago TEXT DEFAULT 'PENDIENTE'::text,
    vencimiento DATE,
    mes INTEGER,
    anio INTEGER,
    comprobante_url TEXT,
    mercado_pago_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- familiares
CREATE TABLE public.familiares (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    titular_id UUID REFERENCES public.profiles(id),
    nombre_apellido TEXT NOT NULL,
    dni TEXT UNIQUE NOT NULL,
    parentesco public.family_relationship,
    fecha_nacimiento DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- profesionales
CREATE TABLE public.profesionales (
    id UUID PRIMARY KEY REFERENCES public.profiles(id),
    matricula TEXT NOT NULL,
    titulo TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- empleados_comercios
CREATE TABLE public.empleados_comercios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    perfil_id UUID REFERENCES public.profiles(id),
    comercio_id UUID REFERENCES public.profiles(id),
    activo BOOLEAN DEFAULT true,
    fecha_ingreso DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- notificaciones_admin (Para tickets de soporte y avisos)
CREATE TABLE public.notificaciones_admin (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id UUID REFERENCES public.profiles(id),
    tipo TEXT NOT NULL,
    descripcion TEXT NOT NULL,
    estado TEXT DEFAULT 'PENDIENTE',
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    resolved_at TIMESTAMP WITH TIME ZONE
);

-- notificaciones_usuarios
CREATE TABLE public.notificaciones_usuarios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id UUID REFERENCES public.profiles(id),
    titulo VARCHAR NOT NULL,
    mensaje TEXT NOT NULL,
    leido BOOLEAN DEFAULT false,
    link_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- activity_log
CREATE TABLE public.activity_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    socio_id UUID REFERENCES public.profiles(id),
    tipo_evento VARCHAR NOT NULL,
    descripcion TEXT,
    usuario_id UUID REFERENCES public.profiles(id),
    fecha TIMESTAMP WITH TIME ZONE DEFAULT now()
);


-- 4. TRIGGERS
CREATE OR REPLACE FUNCTION public.update_modified_column()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    NEW.updated_at = now();
    RETURN NEW; 
END;
$function$;

CREATE TRIGGER tr_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE PROCEDURE update_modified_column();
CREATE TRIGGER tr_ofertas_updated_at BEFORE UPDATE ON public.ofertas FOR EACH ROW EXECUTE PROCEDURE update_modified_column();
CREATE TRIGGER tr_eventos_sociales_updated_at BEFORE UPDATE ON public.eventos_sociales FOR EACH ROW EXECUTE PROCEDURE update_modified_column();
CREATE TRIGGER tr_familiares_updated_at BEFORE UPDATE ON public.familiares FOR EACH ROW EXECUTE PROCEDURE update_modified_column();


-- 5. INITIAL SEED (ROLES)
INSERT INTO public.roles (nombre, descripcion) VALUES
('SUPERADMIN', 'Administrador Global con permisos para gestionar otros administradores, configuraciones sensibles y sistema total.'),
('ADMINISTRADOR', 'Administrador Operativo, puede aprobar usuarios, validar pagos y usar el dashboard.'),
('SOCIO', 'Socio estándar del sistema con acceso a promociones y carnet virtual.')
ON CONFLICT (nombre) DO NOTHING;

-- 6. ASIGNACIÓN DEL SUPERADMINISTRADOR PRINCIPAL (victoralfredo2498@gmail.com / DNI: 31435789)
-- IMPORTANTE: El usuario ya debe existir en "auth.users" y "public.profiles" (Registrado por la app o dashboard propio de Supabase).
-- Este bloque detecta su cuenta por el EMAIL y le asigna el rango de SUPERADMIN.
DO $$
DECLARE
  _superadmin_role_id UUID;
  _user_id UUID;
BEGIN
  -- 1. Obtener el ID del rol SUPERADMIN
  SELECT id INTO _superadmin_role_id FROM public.roles WHERE nombre = 'SUPERADMIN';
  
  -- 2. Buscar al usuario victoralfredo2498@gmail.com en la tabla profiles
  SELECT id INTO _user_id FROM public.profiles WHERE email = 'victoralfredo2498@gmail.com' LIMIT 1;
  
  -- 3. Si se encuentra, asignarle el rol en user_roles
  IF _user_id IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role_id) 
    VALUES (_user_id, _superadmin_role_id) 
    ON CONFLICT (user_id, role_id) DO NOTHING;
    
    -- También le aseguramos el rol de SOCIO obligatoriamente como fallback
    INSERT INTO public.user_roles (user_id, role_id) 
    VALUES (_user_id, (SELECT id FROM public.roles WHERE nombre = 'SOCIO')) 
    ON CONFLICT (user_id, role_id) DO NOTHING;
    
    -- Actualizamos su perfil a APROBADO por defecto
    UPDATE public.profiles SET estado = 'APROBADO', rol = 'ADMIN' WHERE id = _user_id;
  END IF;
END $$;
