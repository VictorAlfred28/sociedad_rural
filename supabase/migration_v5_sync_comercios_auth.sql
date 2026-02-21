-- MIGRACIÓN V5: SINCRONIZACIÓN COMERCIOS <-> AUTH
-- Ejecutar en Supabase SQL Editor

-- 1. Agregar columna user_id si no existe
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'comercios' AND column_name = 'user_id') THEN
        ALTER TABLE public.comercios ADD COLUMN user_id uuid REFERENCES auth.users(id);
    END IF;
END $$;

-- 2. Asegurar que tipo_plan exista (por si no se corrió v2)
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'comercios' AND column_name = 'tipo_plan') THEN
        ALTER TABLE public.comercios ADD COLUMN tipo_plan public.commerce_plan DEFAULT 'gratuito';
    END IF;
END $$;

-- 3. Índice único para user_id (Un comercio por usuario)
CREATE UNIQUE INDEX IF NOT EXISTS idx_comercios_user_id_unique ON public.comercios(user_id);

-- 4. Actualizar RLS para permitir al sistema (service_role) y a los admins gestionar la tabla
DROP POLICY IF EXISTS "Gestión total comercios para admins" ON public.comercios;
CREATE POLICY "Gestión total comercios para admins" ON public.comercios FOR ALL USING (
  (auth.jwt() ->> 'role' = 'service_role') OR 
  (auth.uid() IN (SELECT id FROM public.profiles WHERE rol::text IN ('superadmin', 'admin_camara')))
);

-- 5. Comprobación de integridad: Vincular comercios actuales si el user_id está vacío pero el profile lo tiene
-- UPDATE public.comercios c
-- SET user_id = p.id
-- FROM public.profiles p
-- WHERE p.comercio_id = c.id AND c.user_id IS NULL;
