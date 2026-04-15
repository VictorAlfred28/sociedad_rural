-- =========================================================================
-- SETUP ROW LEVEL SECURITY (RLS) POLICIES
-- SOCIEDAD RURAL NORTE CORRIENTES
-- =========================================================================

-- 1. ENABLE RLS ON ALL TABLES
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auditoria_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comercios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.camaras ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ofertas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eventos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eventos_sociales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pagos_cuotas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suscripciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.familiares ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profesionales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.empleados_comercios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notificaciones_admin ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notificaciones_usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_tokens ENABLE ROW LEVEL SECURITY;

-- 2. HELPER FUNCTIONS
-- Function to check if the current user is an admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND rol = 'ADMIN'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. POLICIES FOR profiles
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
-- Users can see their own profile
CREATE POLICY "Users can view own profile" ON public.profiles
FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
-- Admins can see all profiles
CREATE POLICY "Admins can view all profiles" ON public.profiles
FOR ALL USING (public.is_admin());

-- 4. POLICIES FOR pagos_cuotas
DROP POLICY IF EXISTS "Users can view own payments" ON public.pagos_cuotas;
-- Users can see their own payments
CREATE POLICY "Users can view own payments" ON public.pagos_cuotas
FOR SELECT USING (auth.uid() = socio_id);

DROP POLICY IF EXISTS "Admins can manage all payments" ON public.pagos_cuotas;
-- Admins can manage all payments
CREATE POLICY "Admins can manage all payments" ON public.pagos_cuotas
FOR ALL USING (public.is_admin());

-- 5. POLICIES FOR roles AND user_roles
DROP POLICY IF EXISTS "Auth users can view roles" ON public.roles;
-- Authenticated users can read roles
CREATE POLICY "Auth users can view roles" ON public.roles
FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Auth users can view user_roles" ON public.user_roles;
-- Authenticated users can read user_roles
CREATE POLICY "Auth users can view user_roles" ON public.user_roles
FOR SELECT TO authenticated USING (true);

-- Superadmin/Admin management (simplified to Admin for now)
DROP POLICY IF EXISTS "Admins can manage roles" ON public.roles;
CREATE POLICY "Admins can manage roles" ON public.roles
FOR ALL USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can manage user_roles" ON public.user_roles;
CREATE POLICY "Admins can manage user_roles" ON public.user_roles
FOR ALL USING (public.is_admin());

-- 6. POLICIES FOR public content (ofertas, eventos)
-- Public read access
DROP POLICY IF EXISTS "Public read ofertas" ON public.ofertas;
CREATE POLICY "Public read ofertas" ON public.ofertas FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "Public read eventos" ON public.eventos;
CREATE POLICY "Public read eventos" ON public.eventos FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "Public read eventos_sociales" ON public.eventos_sociales;
CREATE POLICY "Public read eventos_sociales" ON public.eventos_sociales FOR SELECT TO public USING (true);

-- Admin write access
DROP POLICY IF EXISTS "Admins manage ofertas" ON public.ofertas;
CREATE POLICY "Admins manage ofertas" ON public.ofertas FOR ALL USING (public.is_admin());

DROP POLICY IF EXISTS "Admins manage eventos" ON public.eventos;
CREATE POLICY "Admins manage eventos" ON public.eventos FOR ALL USING (public.is_admin());

DROP POLICY IF EXISTS "Admins manage eventos_sociales" ON public.eventos_sociales;
CREATE POLICY "Admins manage eventos_sociales" ON public.eventos_sociales FOR ALL USING (public.is_admin());

-- Comercio manage own ofertas
DROP POLICY IF EXISTS "Comercio gestiona sus ofertas" ON public.ofertas;
CREATE POLICY "Comercio gestiona sus ofertas" ON public.ofertas 
FOR ALL USING (
    (auth.uid() = comercio_id) OR public.is_admin()
)
WITH CHECK (
    (auth.uid() = comercio_id) OR public.is_admin()
);

-- 7. POLICIES FOR internal tables (logs, notifications)
DROP POLICY IF EXISTS "Admins view auditoria_logs" ON public.auditoria_logs;
CREATE POLICY "Admins view auditoria_logs" ON public.auditoria_logs FOR ALL USING (public.is_admin());

DROP POLICY IF EXISTS "Admins view activity_log" ON public.activity_log;
CREATE POLICY "Admins view activity_log" ON public.activity_log FOR ALL USING (public.is_admin());

-- User specific notifications
DROP POLICY IF EXISTS "Users view own notifications" ON public.notificaciones_usuarios;
CREATE POLICY "Users view own notifications" ON public.notificaciones_usuarios FOR SELECT USING (auth.uid() = usuario_id);

DROP POLICY IF EXISTS "Users update own notifications" ON public.notificaciones_usuarios;
CREATE POLICY "Users update own notifications" ON public.notificaciones_usuarios FOR UPDATE USING (auth.uid() = usuario_id);

-- Admins manage all notifications
DROP POLICY IF EXISTS "Admins manage all notification tables" ON public.notificaciones_admin;
CREATE POLICY "Admins manage all notification tables" ON public.notificaciones_admin FOR ALL USING (public.is_admin());

DROP POLICY IF EXISTS "Admins manage user notifications" ON public.notificaciones_usuarios;
CREATE POLICY "Admins manage user notifications" ON public.notificaciones_usuarios FOR ALL USING (public.is_admin());

-- 8. POLICIES FOR other socio-related tables
DROP POLICY IF EXISTS "Users manage own familiares" ON public.familiares;
CREATE POLICY "Users manage own familiares" ON public.familiares FOR ALL USING (auth.uid() = titular_id OR public.is_admin());

DROP POLICY IF EXISTS "Users manage own push_tokens" ON public.push_tokens;
CREATE POLICY "Users manage own push_tokens" ON public.push_tokens FOR ALL USING (auth.uid() = usuario_id OR public.is_admin());

-- [NOTE] This is a starting template. Policies should be refined based on specific field-level security requirements.
