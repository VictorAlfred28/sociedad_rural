-- =========================================================================
-- ADD SOCIAL MEDIA COLUMNS TO OFERTAS
-- SOCIEDAD RURAL NORTE CORRIENTES
-- =========================================================================

ALTER TABLE public.ofertas 
ADD COLUMN IF NOT EXISTS instagram_url TEXT,
ADD COLUMN IF NOT EXISTS facebook_url TEXT;

-- Comentarios explicativos
COMMENT ON COLUMN public.ofertas.instagram_url IS 'Link opcional al post o perfil de Instagram del comercio.';
COMMENT ON COLUMN public.ofertas.facebook_url IS 'Link opcional al post o perfil de Facebook del comercio.';
