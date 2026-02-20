-- MIGRACIÓN V3: TABLAS PARA PROMOCIONES Y EVENTOS

-- 1. TABLA DE PROMOCIONES
CREATE TABLE IF NOT EXISTS public.promociones (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  comercio_id uuid REFERENCES public.comercios(id) ON DELETE CASCADE NOT NULL,
  titulo text NOT NULL,
  descripcion text,
  imagen_url text,
  fecha_desde timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  fecha_hasta timestamp with time zone,
  estado public.user_status DEFAULT 'activo',
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. TABLA DE EVENTOS
CREATE TABLE IF NOT EXISTS public.eventos (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  titulo text NOT NULL,
  descripcion text,
  imagen_url text,
  fecha timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  lugar text,
  estado public.user_status DEFAULT 'activo',
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. ÍNDICES PARA RENDIMIENTO
CREATE INDEX IF NOT EXISTS idx_promociones_comercio_id ON public.promociones(comercio_id);
CREATE INDEX IF NOT EXISTS idx_promociones_estado ON public.promociones(estado);
CREATE INDEX IF NOT EXISTS idx_eventos_fecha ON public.eventos(fecha DESC);
CREATE INDEX IF NOT EXISTS idx_eventos_estado ON public.eventos(estado);

-- 4. HABILITAR RLS
ALTER TABLE public.promociones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eventos ENABLE ROW LEVEL SECURITY;

-- 5. POLÍTICAS DE LECTURA PÚBLICA
CREATE POLICY "Lectura pública promociones" ON public.promociones FOR SELECT USING (true);
CREATE POLICY "Lectura pública eventos" ON public.eventos FOR SELECT USING (true);

-- 6. POLÍTICAS DE GESTIÓN (REUTILIZANDO LÓGICA DE ADMINS)
CREATE POLICY "Gestión total promociones para admins" ON public.promociones FOR ALL USING (
  (auth.jwt() ->> 'role' = 'service_role') OR 
  (auth.uid() IN (SELECT id FROM public.profiles WHERE rol::text IN ('superadmin', 'admin_camara')))
);

CREATE POLICY "Gestión total eventos para admins" ON public.eventos FOR ALL USING (
  (auth.jwt() ->> 'role' = 'service_role') OR 
  (auth.uid() IN (SELECT id FROM public.profiles WHERE rol::text IN ('superadmin', 'admin_camara')))
);
