-- =========================================================================
-- DATABASE SCHEMA v5 - SOCIEDAD RURAL NORTE CORRIENTES
-- Generado: 2026-05-01 | Incluye todas las migraciones hasta esta fecha
-- INSTRUCCIÓN: Ejecutar en Supabase SQL Editor (requiere service role)
-- =========================================================================

-- ── PARTE 1: EJECUTAR PRIMERO database.sql (schema base v4) ──────────────
-- El archivo database.sql ya contiene el schema base.
-- Este script aplica SOLO las migraciones incrementales sobre ese base.
-- =========================================================================

-- ── MIGRACIÓN 1: Columnas faltantes en profiles ───────────────────────────
-- (Usadas en main.py pero ausentes en database.sql v4)

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS must_change_password      BOOLEAN  DEFAULT false,
  ADD COLUMN IF NOT EXISTS es_estudiante             BOOLEAN  DEFAULT false,
  ADD COLUMN IF NOT EXISTS constancia_estudiante_url TEXT;

COMMENT ON COLUMN public.profiles.must_change_password      IS 'True si el admin restableció la contraseña y el usuario debe cambiarla en el próximo login.';
COMMENT ON COLUMN public.profiles.es_estudiante             IS 'True si el socio es estudiante (acceso a tarifa reducida).';
COMMENT ON COLUMN public.profiles.constancia_estudiante_url IS 'URL del PDF/imagen de constancia de alumno regular subido a Storage.';

-- ── MIGRACIÓN 2: Columna barrio en comercios ──────────────────────────────

ALTER TABLE public.comercios
  ADD COLUMN IF NOT EXISTS barrio TEXT;

COMMENT ON COLUMN public.comercios.barrio IS 'Barrio o localidad del comercio dentro del municipio.';

-- ── MIGRACIÓN 3: FASE 1 — eventos_sociales con fuente y municipio_id ──────

ALTER TABLE public.eventos_sociales
  ADD COLUMN IF NOT EXISTS fuente       TEXT DEFAULT 'sociedad_rural',
  ADD COLUMN IF NOT EXISTS municipio_id UUID REFERENCES public.municipios(id) ON DELETE SET NULL;

-- Marcar registros existentes como fuente 'sociedad_rural'
UPDATE public.eventos_sociales
  SET fuente = 'sociedad_rural'
  WHERE fuente IS NULL;

COMMENT ON COLUMN public.eventos_sociales.fuente       IS 'Origen del evento: sociedad_rural | municipio';
COMMENT ON COLUMN public.eventos_sociales.municipio_id IS 'UUID del municipio origen cuando fuente = municipio';

CREATE INDEX IF NOT EXISTS idx_eventos_sociales_fuente       ON public.eventos_sociales (fuente);
CREATE INDEX IF NOT EXISTS idx_eventos_sociales_municipio_id ON public.eventos_sociales (municipio_id);

-- ── MIGRACIÓN 4: FASE 1 — municipios con Instagram ───────────────────────

ALTER TABLE public.municipios
  ADD COLUMN IF NOT EXISTS instagram_handle  TEXT,
  ADD COLUMN IF NOT EXISTS instagram_user_id TEXT;

COMMENT ON COLUMN public.municipios.instagram_handle  IS 'Handle de Instagram del municipio (ej: @municipio_itatí). Para futura integración de eventos sociales.';
COMMENT ON COLUMN public.municipios.instagram_user_id IS 'ID numérico de usuario de Instagram (para API Graph).';

-- ── MIGRACIÓN 5: Sistema de verificación de email ────────────────────────

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email_verificado           BOOLEAN                  DEFAULT false,
  ADD COLUMN IF NOT EXISTS email_verificacion_token   TEXT,
  ADD COLUMN IF NOT EXISTS email_verificacion_expira  TIMESTAMP WITH TIME ZONE;

COMMENT ON COLUMN public.profiles.email_verificado          IS 'True si el usuario hizo clic en el enlace de verificación de correo.';
COMMENT ON COLUMN public.profiles.email_verificacion_token  IS 'Token URL-safe para verificar el correo. Se invalida al usarse.';
COMMENT ON COLUMN public.profiles.email_verificacion_expira IS 'Expiración del token (48hs desde registro o último reenvío).';

CREATE INDEX IF NOT EXISTS idx_profiles_email_token
  ON public.profiles (email_verificacion_token)
  WHERE email_verificacion_token IS NOT NULL;

-- ── MIGRACIÓN 6: Marcar usuarios existentes como verificados ─────────────
-- IMPORTANTE: Ejecutar para no bloquear cuentas ya aprobadas en producción

UPDATE public.profiles
  SET email_verificado = true
  WHERE estado IN ('APROBADO', 'RESTRINGIDO', 'SUSPENDIDO')
    AND email_verificado = false;

-- ── MIGRACIÓN 7: Municipios adicionales (seed actualizado) ───────────────

INSERT INTO public.municipios (nombre, provincia) VALUES
  ('Sauce',              'Corrientes'),
  ('San Luis del Palmar','Corrientes'),
  ('Empedrado',          'Corrientes'),
  ('Bella Vista',        'Corrientes'),
  ('Saladas',            'Corrientes'),
  ('Mburucuyá',          'Corrientes'),
  ('San Roque',          'Corrientes'),
  ('Concepción',         'Corrientes'),
  ('La Cruz',            'Corrientes'),
  ('Yapeyú',             'Corrientes'),
  ('Santo Tomé',         'Corrientes'),
  ('Alvear',             'Corrientes'),
  ('Mercedes',           'Corrientes'),
  ('Curuzú Cuatiá',      'Corrientes'),
  ('Monte Caseros',      'Corrientes'),
  ('Paso de los Libres', 'Corrientes'),
  ('Esquina',            'Corrientes'),
  ('Goya',               'Corrientes')
ON CONFLICT DO NOTHING;

-- ── ÍNDICES ADICIONALES ───────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_profiles_email_verificado
  ON public.profiles (email_verificado)
  WHERE email_verificado = false;

CREATE INDEX IF NOT EXISTS idx_municipios_activo
  ON public.municipios (activo, nombre);

CREATE INDEX IF NOT EXISTS idx_eventos_slug
  ON public.eventos (slug)
  WHERE slug IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_eventos_estado
  ON public.eventos (estado, fecha DESC);

CREATE INDEX IF NOT EXISTS idx_eventos_sociales_status
  ON public.eventos_sociales (status, created_at DESC);

-- ── RLS: POLÍTICAS ADICIONALES ────────────────────────────────────────────
-- El backend usa service role (bypasa RLS).
-- Las políticas protegen acceso anon/JWT desde el cliente.

-- profiles: cada usuario lee su propio perfil
DROP POLICY IF EXISTS "profiles_self_read"   ON public.profiles;
DROP POLICY IF EXISTS "profiles_self_update" ON public.profiles;

CREATE POLICY "profiles_self_read"   ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "profiles_self_update" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- comercios: lectura pública para comercios activos
DROP POLICY IF EXISTS "comercios_public_read" ON public.comercios;
CREATE POLICY "comercios_public_read" ON public.comercios FOR SELECT USING (true);

-- promociones: lectura pública para activas
DROP POLICY IF EXISTS "promociones_public_read" ON public.promociones;
CREATE POLICY "promociones_public_read" ON public.promociones FOR SELECT USING (activo = true);

-- eventos: lectura pública para publicados
DROP POLICY IF EXISTS "eventos_public_read" ON public.eventos;
CREATE POLICY "eventos_public_read" ON public.eventos FOR SELECT USING (publico = true AND estado = 'publicado');

-- eventos_sociales: solo service role (admin)
-- (sin política de lectura pública — acceso solo via backend)

-- notificaciones: cada usuario ve las suyas
DROP POLICY IF EXISTS "notificaciones_self_read" ON public.notificaciones;
CREATE POLICY "notificaciones_self_read" ON public.notificaciones FOR SELECT USING (auth.uid() = usuario_id);

-- chat_history: cada usuario ve el suyo
DROP POLICY IF EXISTS "chat_self_read"   ON public.chat_history;
DROP POLICY IF EXISTS "chat_self_insert" ON public.chat_history;
CREATE POLICY "chat_self_read"   ON public.chat_history FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "chat_self_insert" ON public.chat_history FOR INSERT WITH CHECK (auth.uid() = user_id);

-- qr_tokens: cada usuario gestiona los suyos
DROP POLICY IF EXISTS "qr_self_manage" ON public.qr_tokens;
CREATE POLICY "qr_self_manage" ON public.qr_tokens FOR ALL USING (auth.uid() = user_id);

-- push_tokens: cada usuario gestiona los suyos
DROP POLICY IF EXISTS "push_tokens_self" ON public.push_tokens;
CREATE POLICY "push_tokens_self" ON public.push_tokens FOR ALL USING (auth.uid() = usuario_id);

-- municipios: lectura pública (ya existe, la recreamos por si acaso)
DROP POLICY IF EXISTS "municipios_public_read" ON public.municipios;
CREATE POLICY "municipios_public_read" ON public.municipios FOR SELECT USING (activo = true);

-- roles y user_roles: lectura autenticada
DROP POLICY IF EXISTS "roles_authenticated_read"      ON public.roles;
DROP POLICY IF EXISTS "user_roles_authenticated_read" ON public.user_roles;
CREATE POLICY "roles_authenticated_read"      ON public.roles      FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "user_roles_authenticated_read" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);

-- ── VALIDACIÓN POST-MIGRACIÓN ─────────────────────────────────────────────

-- Verificar columnas nuevas en profiles:
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'profiles'
  AND column_name IN (
    'must_change_password','es_estudiante','constancia_estudiante_url',
    'email_verificado','email_verificacion_token','email_verificacion_expira'
  )
ORDER BY column_name;
-- ESPERADO: 6 filas

-- Verificar columnas en eventos_sociales:
SELECT column_name FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'eventos_sociales'
  AND column_name IN ('fuente','municipio_id');
-- ESPERADO: 2 filas

-- Verificar columnas en municipios:
SELECT column_name FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'municipios'
  AND column_name IN ('instagram_handle','instagram_user_id');
-- ESPERADO: 2 filas

-- Contar municipios totales:
SELECT COUNT(*) FROM public.municipios;
-- ESPERADO: >= 9

-- Contar usuarios ya marcados como verificados:
SELECT COUNT(*) FROM public.profiles WHERE email_verificado = true;
-- ESPERADO: igual al COUNT de APROBADOS antes de la migración

-- ── FIN DE MIGRACIONES v5 ────────────────────────────────────────────────
