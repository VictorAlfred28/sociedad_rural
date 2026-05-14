-- Migration for Promociones Detail features
-- Adds required columns to support detailed views, extra images, and formatting.

ALTER TABLE promociones
ADD COLUMN IF NOT EXISTS subtitulo TEXT,
ADD COLUMN IF NOT EXISTS descripcion_corta TEXT,
ADD COLUMN IF NOT EXISTS precio_lista NUMERIC,
ADD COLUMN IF NOT EXISTS precio_final NUMERIC,
ADD COLUMN IF NOT EXISTS porcentaje_descuento NUMERIC,
ADD COLUMN IF NOT EXISTS monto_descuento NUMERIC,
ADD COLUMN IF NOT EXISTS whatsapp TEXT,
ADD COLUMN IF NOT EXISTS direccion TEXT,
ADD COLUMN IF NOT EXISTS localidad TEXT,
ADD COLUMN IF NOT EXISTS ubicacion TEXT,
ADD COLUMN IF NOT EXISTS categoria TEXT,
ADD COLUMN IF NOT EXISTS destacada BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS imagenes_secundarias JSONB;
