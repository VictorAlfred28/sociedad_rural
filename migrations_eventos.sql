-- =========================================================================
-- MIGRATION: SPEC AVANZADO - SISTEMA DE EVENTOS POR MUNICIPIO
-- Fecha: Abril 2026
-- =========================================================================

-- ────────────────────────────────────────────────────────────────────────────
-- 1. CREAR ENUM PARA ESTADO DE EVENTOS
-- ────────────────────────────────────────────────────────────────────────────

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'evento_estado') THEN
        CREATE TYPE public.evento_estado AS ENUM ('borrador', 'publicado', 'cancelado', 'finalizado');
    END IF;
END$$;

-- ────────────────────────────────────────────────────────────────────────────
-- 2. CREAR TABLA: MUNICIPIOS
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.municipios (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nombre              TEXT NOT NULL UNIQUE,
    provincia           TEXT NOT NULL,
    descripcion         TEXT,
    imagen_principal    TEXT,
    activo              BOOLEAN DEFAULT true,
    latitud             FLOAT,
    longitud            FLOAT,
    fecha_creacion      TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()),
    fecha_actualizacion TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now())
);

COMMENT ON TABLE public.municipios IS 'Municipios del territorio: Corrientes Capital, Santo Tomé, etc. Cada evento está asociado a un municipio.';
COMMENT ON COLUMN public.municipios.latitud IS 'Coordenadas geográficas (opcional para futuro SIG)';
COMMENT ON COLUMN public.municipios.longitud IS 'Coordenadas geográficas (opcional para futuro SIG)';

CREATE INDEX IF NOT EXISTS idx_municipios_provincia ON public.municipios (provincia);
CREATE INDEX IF NOT EXISTS idx_municipios_activo ON public.municipios (activo);

-- ────────────────────────────────────────────────────────────────────────────
-- 3. ACTUALIZAR TABLA: EVENTOS (NUEVA ESTRUCTURA COMPLETA)
-- ────────────────────────────────────────────────────────────────────────────

-- Paso 1: Renombrar tabla antigua como backup
ALTER TABLE IF EXISTS public.eventos RENAME TO eventos_backup_old;

-- Paso 2: Crear tabla eventos con la nueva estructura
CREATE TABLE IF NOT EXISTS public.eventos (
    -- IDENTIDAD Y RELACIÓN
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    municipio_id            UUID NOT NULL REFERENCES public.municipios(id) ON DELETE RESTRICT,
    
    -- INFORMACIÓN GENERAL
    titulo                  TEXT NOT NULL,
    subtitulo              TEXT,
    slug                    TEXT NOT NULL UNIQUE,
    tipo                    TEXT NOT NULL CHECK (tipo IN ('Remate', 'Festival', 'Exposición', 'Charla', 'Otro')),
    organizador             TEXT,
    contacto                TEXT,
    
    -- UBICACIÓN DETALLADA
    lugar                   TEXT NOT NULL,
    direccion               TEXT,
    coordenadas_lat         FLOAT,
    coordenadas_lng         FLOAT,
    
    -- FECHAS
    fecha_inicio            TIMESTAMP,
    fecha_fin               TIMESTAMP,
    es_evento_de_un_dia     BOOLEAN DEFAULT true,
    
    -- ESTADO Y VISIBILIDAD
    estado                  public.evento_estado DEFAULT 'borrador'::public.evento_estado,
    destacado               BOOLEAN DEFAULT false,
    publico                 BOOLEAN DEFAULT true,
    
    -- MULTIMEDIA
    imagen_principal        TEXT,
    galeria_imagenes        JSONB DEFAULT '[]'::jsonb,
    video_url               TEXT,
    
    -- REDES SOCIALES (CLAVE DEL REQUERIMIENTO)
    link_instagram          TEXT,
    link_facebook           TEXT,
    link_whatsapp           TEXT,
    link_externo            TEXT,
    
    -- CONTENIDO
    descripcion_corta       TEXT,
    descripcion_larga       TEXT,
    
    -- DATOS ADICIONALES
    precio                  TEXT,
    capacidad               INTEGER,
    requiere_inscripcion    BOOLEAN DEFAULT false,
    
    -- AUDITORÍA
    creado_por              UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    fecha_creacion          TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()),
    fecha_actualizacion     TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now())
);

COMMENT ON TABLE public.eventos IS 'Eventos organizados por municipio con metadata completa, URLs de redes sociales y preparación para automatización Make.com';
COMMENT ON COLUMN public.eventos.slug IS 'URL-friendly identifier. Debe ser único para cada evento.';
COMMENT ON COLUMN public.eventos.es_evento_de_un_dia IS 'Si es true, ignorar fecha_fin y usar solo fecha_inicio';
COMMENT ON COLUMN public.eventos.estado IS 'borrador (no visible), publicado (visible), cancelado (etiqueta roja), finalizado (evento pasado)';
COMMENT ON COLUMN public.eventos.galeria_imagenes IS 'Array JSON con URLs: [{"url": "...", "caption": "..."}, ...]';
COMMENT ON COLUMN public.eventos.link_instagram IS 'URL completa: https://instagram.com/...';
COMMENT ON COLUMN public.eventos.link_facebook IS 'URL completa: https://facebook.com/...';
COMMENT ON COLUMN public.eventos.link_whatsapp IS 'Link para WhatsApp: https://wa.me/541234567890';

-- ────────────────────────────────────────────────────────────────────────────
-- 4. MIGRARE DATOS DESDE TABLA ANTIGUA (OPCIONAL)
-- ────────────────────────────────────────────────────────────────────────────

-- NOTA: Esto requiere que exista al menos un municipio.
-- Si no hay, ejecutar los INSERTs en la sección 6 primero.

-- Crear municipios por defecto si no existen
INSERT INTO public.municipios (nombre, provincia, descripcion) VALUES
    ('Corrientes Capital', 'Corrientes', 'Capital de la provincia'),
    ('Santo Tomé', 'Corrientes', 'Localidad de Santo Tomé'),
    ('Ituzaingó', 'Corrientes', 'Localidad de Ituzaingó'),
    ('San Carlos', 'Corrientes', 'Localidad de San Carlos'),
    ('Garruchos', 'Corrientes', 'Localidad de Garruchos'),
    ('Virasoro', 'Corrientes', 'Localidad de Virasoro'),
    ('Colonia Carlos Pellegrini', 'Corrientes', 'Localidad de Colonia Carlos Pellegrini'),
    ('Yapeyú', 'Corrientes', 'Localidad de Yapeyú')
ON CONFLICT (nombre) DO NOTHING;

-- Migrar eventos antiguos (si existen)
INSERT INTO public.eventos (
    municipio_id, titulo, slug, tipo, lugar, fecha_inicio, estado, 
    imagen_principal, descripcion_corta, fecha_creacion, creado_por
)
SELECT 
    (SELECT id FROM public.municipios LIMIT 1) as municipio_id,
    e.titulo,
    LOWER(REPLACE(e.titulo, ' ', '-')) || '-' || TO_CHAR(e.fecha, 'YYYYMMDD') as slug,
    e.tipo,
    e.lugar,
    e.fecha::timestamp,
    'publicado'::public.evento_estado,
    e.imagen_url,
    e.descripcion,
    e.created_at,
    NULL as creado_por
FROM public.eventos_backup_old e
WHERE e.id NOT IN (SELECT id FROM public.eventos WHERE id IS NOT NULL)
ON CONFLICT (slug) DO NOTHING;

-- ────────────────────────────────────────────────────────────────────────────
-- 5. CREAR ÍNDICES DE PERFORMANCE
-- ────────────────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_eventos_municipio_id ON public.eventos (municipio_id);
CREATE INDEX IF NOT EXISTS idx_eventos_estado ON public.eventos (estado);
CREATE INDEX IF NOT EXISTS idx_eventos_fecha_inicio ON public.eventos (fecha_inicio DESC);
CREATE INDEX IF NOT EXISTS idx_eventos_destacado ON public.eventos (destacado) WHERE destacado = true;
CREATE INDEX IF NOT EXISTS idx_eventos_publico ON public.eventos (publico) WHERE publico = true;
CREATE INDEX IF NOT EXISTS idx_eventos_slug ON public.eventos (slug);
CREATE INDEX IF NOT EXISTS idx_eventos_creado_por ON public.eventos (creado_por);
CREATE INDEX IF NOT EXISTS idx_eventos_municipio_estado ON public.eventos (municipio_id, estado);

-- ────────────────────────────────────────────────────────────────────────────
-- 6. TRIGGER PARA ACTUALIZACIÓN AUTOMÁTICA
-- ────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.fn_update_eventos_timestamp()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.fecha_actualizacion = timezone('utc', now());
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_eventos_updated_at ON public.eventos;
CREATE TRIGGER trg_eventos_updated_at BEFORE UPDATE ON public.eventos 
FOR EACH ROW EXECUTE FUNCTION public.fn_update_eventos_timestamp();

CREATE OR REPLACE FUNCTION public.fn_update_municipios_timestamp()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.fecha_actualizacion = timezone('utc', now());
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_municipios_updated_at ON public.municipios;
CREATE TRIGGER trg_municipios_updated_at BEFORE UPDATE ON public.municipios 
FOR EACH ROW EXECUTE FUNCTION public.fn_update_municipios_timestamp();

-- ────────────────────────────────────────────────────────────────────────────
-- 7. VALIDACIÓN DE URLs (Constraint check para redes sociales)
-- ────────────────────────────────────────────────────────────────────────────

-- Nota: Las validaciones de formato se harán en el backend (Pydantic).
-- La base de datos solo asegura que sean campos TEXT válidos.

-- ────────────────────────────────────────────────────────────────────────────
-- 8. ROW LEVEL SECURITY
-- ────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.municipios ENABLE ROW LEVEL SECURITY;

-- Permitir lectura pública de municipios activos
DROP POLICY IF EXISTS "municipios_public_read" ON public.municipios;
CREATE POLICY "municipios_public_read" ON public.municipios 
    FOR SELECT USING (activo = true);

-- Permitir lectura de eventos publicados a todos
DROP POLICY IF EXISTS "eventos_public_read" ON public.eventos;
CREATE POLICY "eventos_public_read" ON public.eventos 
    FOR SELECT USING (estado = 'publicado'::public.evento_estado AND publico = true);

-- ────────────────────────────────────────────────────────────────────────────
-- 9. LIMPIEZA (OPCIONAL)
-- ────────────────────────────────────────────────────────────────────────────

-- Descomentar si se necesita borrar la tabla de backup después de verificar la migración:
-- DROP TABLE IF EXISTS public.eventos_backup_old;

-- ────────────────────────────────────────────────────────────────────────────
-- FIN DE MIGRACIÓN
-- ────────────────────────────────────────────────────────────────────────────
