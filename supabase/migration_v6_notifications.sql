-- MIGRACIÓN V6: SISTEMA DE NOTIFICACIONES PROACTIVAS
-- Ejecutar en Supabase SQL Editor

-- 1. Tabla de Notificaciones
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id), -- Null significa "atención general para admins"
  title text NOT NULL,
  message text NOT NULL,
  type text, -- 'nuevo_socio', 'nueva_promo', 'sistema'
  link text, -- Ej: '/#/admin/socios' o '/#/admin/comercios'
  read boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Habilitar RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- 3. Políticas de Seguridad (Solo admins pueden ver notificaciones generales)
CREATE POLICY "Admins pueden ver notificaciones" ON public.notifications
FOR SELECT USING (
  (auth.jwt() ->> 'role' = 'service_role') OR 
  (auth.uid() IN (SELECT id FROM public.profiles WHERE rol::text IN ('superadmin', 'admin_camara')))
);

CREATE POLICY "Admins pueden marcar como leídas" ON public.notifications
FOR UPDATE USING (
  (auth.uid() IN (SELECT id FROM public.profiles WHERE rol::text IN ('superadmin', 'admin_camara')))
);

-- 4. Triggers para Automación

-- A) Notificación por Nuevo Socio
CREATE OR REPLACE FUNCTION public.fn_notify_new_socio()
RETURNS trigger AS $$
BEGIN
  IF NEW.rol = 'comun' THEN
    INSERT INTO public.notifications (title, message, type, link)
    VALUES (
      'Nuevo Socio Registrado',
      'El socio ' || NEW.nombre || ' ' || NEW.apellido || ' se ha registrado y espera aprobación.',
      'nuevo_socio',
      '/#/admin/socios'
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_notify_new_socio ON public.profiles;
CREATE TRIGGER trg_notify_new_socio
AFTER INSERT ON public.profiles
FOR EACH ROW EXECUTE PROCEDURE public.fn_notify_new_socio();

-- B) Notificación por Nueva Promoción
CREATE OR REPLACE FUNCTION public.fn_notify_new_promo()
RETURNS trigger AS $$
DECLARE
  v_comercio_nombre text;
BEGIN
  SELECT nombre INTO v_comercio_nombre FROM public.comercios WHERE id = NEW.comercio_id;
  
  INSERT INTO public.notifications (title, message, type, link)
  VALUES (
    'Nueva Oferta Publicada',
    'El comercio ' || COALESCE(v_comercio_nombre, 'desconocido') || ' ha publicado: ' || NEW.titulo,
    'nueva_promo',
    '/#/admin/comercios' -- O un link directo si existe panel de auditoría de promos
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_notify_new_promo ON public.promociones;
CREATE TRIGGER trg_notify_new_promo
AFTER INSERT ON public.promociones
FOR EACH ROW EXECUTE PROCEDURE public.fn_notify_new_promo();
