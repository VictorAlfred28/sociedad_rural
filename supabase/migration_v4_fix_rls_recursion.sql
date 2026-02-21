-- Migración para corregir recursividad infinita en políticas de RLS (profiles)
-- Fecha: 2026-02-21 17:15 (Final Fix)

-- 1. Eliminar políticas conflictivas
DROP POLICY IF EXISTS "Admins ven todos los perfiles" ON public.profiles;
DROP POLICY IF EXISTS "Backend Service Role" ON public.profiles;
DROP POLICY IF EXISTS "Service Role Bypass" ON public.profiles;

-- 2. Función segura de validación de administrador
-- Desacopla la validación de la tabla profiles para evitar recursión circular
CREATE OR REPLACE FUNCTION public.check_is_admin()
RETURNS boolean AS $$
BEGIN
  -- Acceso directo para service_role (Backend)
  IF (auth.jwt() ->> 'role' = 'service_role') THEN
    RETURN TRUE;
  END IF;

  -- Verificación contra metadatos de usuario (evita consultar profiles)
  RETURN EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = auth.uid()
    AND (
      raw_user_meta_data->>'rol' IN ('admin', 'superadmin', 'SUPERADMIN', 'admin_camara', 'admin_municipio')
      OR
      raw_app_meta_data->>'role' IN ('admin', 'superadmin', 'SUPERADMIN', 'admin_camara', 'admin_municipio')
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

-- 3. Aplicar nuevas políticas seguras
CREATE POLICY "Admins ven todos los perfiles" ON public.profiles
FOR ALL TO authenticated USING (public.check_is_admin());

CREATE POLICY "Service Role Bypass" ON public.profiles
FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 4. Optimizar otras tablas
DROP POLICY IF EXISTS "Admins editan comercios" ON public.comercios;
CREATE POLICY "Admins editan comercios" ON public.comercios
FOR ALL TO authenticated USING (public.check_is_admin());

DROP POLICY IF EXISTS "Escritura admin eventos" ON public.eventos;
CREATE POLICY "Escritura admin eventos" ON public.eventos
FOR ALL TO authenticated USING (public.check_is_admin());
