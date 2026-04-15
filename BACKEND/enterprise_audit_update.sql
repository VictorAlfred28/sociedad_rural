-- SCRIPT DE MIGRACIÓN: AUDITORÍA ENTERPRISE

-- 1. Habilitar RLS en tablas expuestas
ALTER TABLE IF EXISTS qr_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS notificaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS auditoria_logs_2024 ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS auditoria_logs_2025 ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS auditoria_logs_2026 ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS auditoria_logs_2027 ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS auditoria_logs_2028 ENABLE ROW LEVEL SECURITY;

-- 2. Políticas RLS de Seguridad qr_tokens
DROP POLICY IF EXISTS "Public access to own QR tokens" ON qr_tokens;
CREATE POLICY "Public access to own QR tokens" ON qr_tokens
FOR ALL USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 3. Funciones de Auditoría Base
CREATE OR REPLACE FUNCTION is_admin_or_superadmin()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND rol = 'ADMIN'
  ) OR EXISTS (
    SELECT 1 FROM user_roles ur JOIN roles r ON r.id = ur.role_id 
    WHERE ur.user_id = auth.uid() AND r.nombre IN ('ADMINISTRADOR', 'SUPERADMIN')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Notificaciones Modernizadas (si faltan)
ALTER TABLE IF EXISTS notificaciones RENAME COLUMN socio_id TO usuario_id;
ALTER TABLE IF EXISTS notificaciones ADD COLUMN IF NOT EXISTS titulo VARCHAR;
ALTER TABLE IF EXISTS notificaciones ADD COLUMN IF NOT EXISTS leido BOOLEAN DEFAULT false;
ALTER TABLE IF EXISTS notificaciones ADD COLUMN IF NOT EXISTS link_url TEXT;
ALTER TABLE IF EXISTS notificaciones ADD COLUMN IF NOT EXISTS metadata JSONB;
ALTER TABLE IF EXISTS notificaciones ADD COLUMN IF NOT EXISTS is_admin_destined BOOLEAN DEFAULT false;

-- 4B. Políticas de Notificaciones Unificadas
DROP POLICY IF EXISTS "Users can view their notifications" ON notificaciones;
CREATE POLICY "Users can view their notifications" ON notificaciones
FOR SELECT USING (auth.uid() = usuario_id OR (is_admin_destined = true AND (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.rol = 'ADMIN')
)));

-- 5. Índices de Rendimiento
CREATE INDEX IF NOT EXISTS idx_pagos_socio_estado ON pagos_cuotas(socio_id, estado_pago);
CREATE INDEX IF NOT EXISTS idx_auditoria_usuario ON auditoria_logs(usuario_id);
CREATE INDEX IF NOT EXISTS idx_notificaciones_usuario ON notificaciones(usuario_id, leido);

-- FIN DE MIGRACIÓN
