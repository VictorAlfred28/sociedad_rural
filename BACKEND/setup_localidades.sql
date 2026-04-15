-- =========================================================================
-- SETUP LOCALIDADES TABLE
-- SOCIEDAD RURAL NORTE CORRIENTES
-- =========================================================================

-- 1. Create the table
CREATE TABLE IF NOT EXISTS public.localidades (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre TEXT NOT NULL UNIQUE,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Enable RLS
ALTER TABLE public.localidades ENABLE ROW LEVEL SECURITY;

-- 3. Reset existing data (Optional: only if you want to ensure a clean state)
-- UPDATE public.localidades SET active = false;

-- 4. Insert/Update valid localities
INSERT INTO public.localidades (nombre, active)
VALUES 
    ('Capital', true),
    ('Itatí', true),
    ('Ramada Paso', true),
    ('San Cosme', true),
    ('Santa Ana', true),
    ('Riachuelo', true),
    ('El Sombrero', true),
    ('Paso de la Patria', true)
ON CONFLICT (nombre) DO UPDATE SET active = true;

-- 5. Policies
-- Public read access
DROP POLICY IF EXISTS "Public read localidades" ON public.localidades;
CREATE POLICY "Public read localidades" ON public.localidades FOR SELECT TO public USING (true);

-- Admin manage access
DROP POLICY IF EXISTS "Admins manage localidades" ON public.localidades;
CREATE POLICY "Admins manage localidades" ON public.localidades FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND rol = 'ADMIN'
  )
);

-- 6. Verification
COMMENT ON TABLE public.localidades IS 'Tabla para restringir y gestionar las localidades válidas en el sistema.';
