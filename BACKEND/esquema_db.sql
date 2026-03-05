-- =========================================================================
-- SCRIPT DE CREACION DE BASE DE DATOS: SOCIEDAD RURAL NORTE CORRIENTES
-- Este script crea las tablas y relaciones necesarias para el sistema.
-- Diseñado para PostgreSQL / Supabase, integrado con auth.users.
-- =========================================================================

-- NOTA: En Supabase, la tabla auth.users ya existe por defecto en el esquema auth. 
-- Nuestras tablas públicas referencian a 'auth.users(id)'.

-- 1. TABLA PRINCIPAL DE PERFILES (profiles)
-- Centraliza a todos los usuarios (Socios, Comercios, Cámaras, Admins, Dependientes)
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    nombre_apellido VARCHAR(255) NOT NULL,
    dni VARCHAR(50) UNIQUE NOT NULL,       -- Se usa dni_cuit, validado como único
    email VARCHAR(255) NOT NULL,
    telefono VARCHAR(50),
    rol VARCHAR(50) NOT NULL DEFAULT 'SOCIO', -- 'SOCIO', 'COMERCIO', 'CAMARA', 'ADMIN'
    estado VARCHAR(50) NOT NULL DEFAULT 'PENDIENTE', -- 'PENDIENTE', 'APROBADO', 'RECHAZADO', 'SUSPENDIDO'
    municipio VARCHAR(100),
    rubro VARCHAR(150),
    es_profesional BOOLEAN DEFAULT FALSE,
    password_changed BOOLEAN DEFAULT FALSE, -- Determina si el usuario cambió su pass inicial
    foto_url TEXT,
    titular_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL, -- Para dependientes
    tipo_vinculo VARCHAR(100), -- Ej: 'Esposa', 'Hijo', 'Empleado'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. TABLA DE EXTRA METADATA PARA COMERCIOS (comercios)
CREATE TABLE public.comercios (
    id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
    nombre_comercio VARCHAR(255) NOT NULL,
    cuit VARCHAR(50) NOT NULL,
    rubro VARCHAR(150),
    direccion TEXT,
    -- Podríamos agregar campos como lat/lng, horarios, etc. en el futuro
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. TABLA DE EXTRA METADATA PARA CÁMARAS (camaras)
CREATE TABLE public.camaras (
    id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
    denominacion VARCHAR(255) NOT NULL,
    cuit VARCHAR(50) NOT NULL,
    municipio VARCHAR(100),
    provincia VARCHAR(100),
    responsable_nombre VARCHAR(255),
    email VARCHAR(255),
    telefono VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. TABLA DE OFERTAS (promociones publicadas por comercios)
CREATE TABLE public.ofertas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    comercio_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    titulo VARCHAR(255) NOT NULL,
    descripcion TEXT,
    tipo VARCHAR(50) NOT NULL, -- 'promocion', 'descuento', 'beneficio'
    descuento_porcentaje INTEGER,
    imagen_url TEXT,
    fecha_fin TIMESTAMP WITH TIME ZONE,
    activo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. TABLA DE EVENTOS INSTITUCIONALES (eventos)
CREATE TABLE public.eventos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    titulo VARCHAR(255) NOT NULL,
    descripcion TEXT,
    lugar VARCHAR(255) NOT NULL,
    fecha DATE NOT NULL,
    hora TIME NOT NULL,
    tipo VARCHAR(100) NOT NULL, -- Ej: 'Remate', 'Reunión', 'Capacitación'
    imagen_url TEXT,
    municipio VARCHAR(100), -- Municipio asociado al evento (para filtrado)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 6. TABLA DE EVENTOS DE REDES SOCIALES / MAKE (eventos_sociales)
CREATE TABLE public.eventos_sociales (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    external_id VARCHAR(255) UNIQUE NOT NULL, -- ID del post de IG/Facebook
    titulo VARCHAR(255) NOT NULL,
    descripcion_limpia TEXT,
    lugar VARCHAR(255),
    fecha_evento DATE,
    hora_evento TIME,
    imagen_url TEXT,
    municipio VARCHAR(100), -- Municipio extraído por Make desde el post de IG (para filtrado)
    metadata JSONB, -- Guarda raw data original: { "original_caption": "...", "timestamp": "...", etc }
    status VARCHAR(50) DEFAULT 'borrador', -- 'borrador', 'aprobado', 'rechazado'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 7. TABLA DE NOTIFICACIONES ADMIN (notificaciones_admin)
-- Usada actualmente para solicitudes de "olvido mi contraseña"
CREATE TABLE public.notificaciones_admin (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    tipo VARCHAR(100) NOT NULL, -- Ej: 'OLVIDO_PASSWORD'
    descripcion TEXT NOT NULL,
    estado VARCHAR(50) DEFAULT 'PENDIENTE', -- 'PENDIENTE', 'RESUELTO', 'IGNORADO'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 8. TABLA DE LOGS DE AUDITORÍA (auditoria_logs)
CREATE TABLE public.auditoria_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id UUID, -- No se usa FOREIGN KEY fuerte para mantener historial tras borrado
    email_usuario VARCHAR(255),
    rol_usuario VARCHAR(50),
    accion VARCHAR(50) NOT NULL, -- 'CREATE', 'UPDATE', 'DELETE', 'APPROVE', 'REJECT'
    tabla_afectada VARCHAR(100) NOT NULL,
    registro_id VARCHAR(255),
    datos_anteriores JSONB,
    datos_nuevos JSONB,
    modulo VARCHAR(100),
    ip_address VARCHAR(50),
    user_agent TEXT,
    fecha TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- =========================================================================
-- TRIGGER DE ACTUALIZACIÓN DE FECHAS (updated_at)
-- =========================================================================
CREATE OR REPLACE FUNCTION update_modified_column() 
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW; 
END;
$$ language 'plpgsql';

CREATE TRIGGER tr_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE PROCEDURE update_modified_column();
CREATE TRIGGER tr_ofertas_updated_at BEFORE UPDATE ON public.ofertas FOR EACH ROW EXECUTE PROCEDURE update_modified_column();
CREATE TRIGGER tr_eventos_sociales_updated_at BEFORE UPDATE ON public.eventos_sociales FOR EACH ROW EXECUTE PROCEDURE update_modified_column();
CREATE TRIGGER tr_notificaciones_admin_updated_at BEFORE UPDATE ON public.notificaciones_admin FOR EACH ROW EXECUTE PROCEDURE update_modified_column();

-- 9. TABLA DE TOKENS FCM PARA NOTIFICACIONES PUSH (push_tokens)
-- Almacena el token FCM de cada dispositivo/usuario para envío de notificaciones push web.
CREATE TABLE public.push_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    token TEXT NOT NULL UNIQUE,
    plataforma VARCHAR(50) DEFAULT 'web', -- 'web', 'android', 'ios'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- =========================================================================
-- COMANDOS ALTER TABLE PARA SUPABASE (ejecutar si la BD ya existe)
-- Correr en el SQL Editor de Supabase para sincronizar cambios incrementales
-- =========================================================================
-- ALTER TABLE public.eventos ADD COLUMN IF NOT EXISTS municipio VARCHAR(100);
-- ALTER TABLE public.eventos_sociales ADD COLUMN IF NOT EXISTS municipio VARCHAR(100);
-- CREATE TABLE IF NOT EXISTS public.push_tokens (
--     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
--     usuario_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
--     token TEXT NOT NULL UNIQUE,
--     plataforma VARCHAR(50) DEFAULT 'web',
--     created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
-- );

-- =========================================================================
-- RLS (Row Level Security) - Nota de diseño
-- =========================================================================
-- Actualmente la API del backend asume el uso de "Service Role" (acceso total bypass-RLS)
-- Si los clientes (web/mobile) accederán directamente a Supabase sin pasar por el backend Python,
-- será necesario habilitar RLS y escribir las reglas correspondientes para cada tabla.
-- Ejemplo: 
-- ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Usuarios pueden ver perfiles aprobados" ON public.profiles FOR SELECT USING (estado = 'APROBADO' OR auth.uid() = id);
