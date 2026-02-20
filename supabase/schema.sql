-- 1. CONFIGURACIÓN INICIAL Y EXTENSIONES
create extension if not exists pgcrypto;
-- Audit Fix: Add pg_cron to schedule maintenance tasks (requires supported instance)
create extension if not exists pg_cron;

-- 2. DEFINICIÓN DE TIPOS (ENUMS) Y PARCHES DE MIGRACIÓN

-- A) Roles de Usuario
do $$ begin
    create type public.user_role as enum ('comun', 'profesional', 'comercial', 'superadmin');
exception
    when duplicate_object then null;
end $$;

-- FIX: Inyectar 'admin_camara' si el enum ya existía.
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'admin_camara';

-- B) Estatus de Usuario
do $$ begin
    create type public.user_status as enum ('activo', 'pendiente', 'inactivo');
exception
    when duplicate_object then null;
end $$;

-- C) Planes Comerciales (Nuevo en Fase 2)
do $$ begin
    create type public.commerce_plan as enum ('gratuito', 'premium');
exception
    when duplicate_object then null;
end $$;

-- 3. TABLA DE CÁMARAS (NODOS REGIONALES)
create table if not exists public.camaras (
  id uuid default gen_random_uuid() primary key,
  nombre text not null, 
  zona text, 
  limite_gratuitos integer default 10,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 4. TABLA DE MUNICIPIOS
create table if not exists public.municipios (
  id uuid default gen_random_uuid() primary key,
  nombre text not null,
  coordenadas jsonb,
  imagen_portada text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 5. TABLA DE PERFILES (Usuarios extendidos con Camara ID)
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  dni text unique not null,
  nombre text,
  apellido text,
  email text unique not null,
  telefono text,
  domicilio text,
  ciudad text,
  provincia text default 'Corrientes',
  rol public.user_role default 'comun',
  estado public.user_status default 'pendiente',
  camara_id uuid references public.camaras(id),
  comercio_id uuid,
  fecha_alta timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 6. TABLA DE COMERCIOS (Con Plan y Cámara)
create table if not exists public.comercios (
  id uuid default gen_random_uuid() primary key,
  nombre text not null,
  camara_id uuid references public.camaras(id) not null,
  municipio_id uuid references public.municipios(id),
  direccion text,
  telefono text,
  email text,
  lat double precision,
  lng double precision,
  descuento_base integer default 0,
  rubro text,
  tipo_plan public.commerce_plan default 'gratuito',
  estado public.user_status default 'activo',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 7. TABLA DE CUOTAS
create table if not exists public.cuotas (
  id uuid default gen_random_uuid() primary key,
  profile_id uuid references public.profiles(id) not null,
  monto decimal(10, 2) not null,
  mes int not null,
  anio int not null,
  fecha_vencimiento date,
  pagado boolean default false,
  mp_preference_id text,
  fecha_pago timestamp with time zone,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 8. TABLA DE AUDITORÍA
create table if not exists public.audit_logs (
  id uuid default gen_random_uuid() primary key,
  usuario_id uuid references public.profiles(id),
  camara_id uuid references public.camaras(id),
  accion text not null,
  detalle text,
  ip text,
  timestamp timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 9. SEGURIDAD: ROW LEVEL SECURITY (RLS)
alter table public.profiles enable row level security;
alter table public.camaras enable row level security;
alter table public.comercios enable row level security;
alter table public.audit_logs enable row level security;

-- POLÍTICAS SIMPLIFICADAS
drop policy if exists "Lectura pública comercios" on public.comercios;
drop policy if exists "Lectura pública camaras" on public.camaras;
drop policy if exists "Gestión total para admins" on public.profiles;

create policy "Lectura pública comercios" on public.comercios for select using (true);
create policy "Lectura pública camaras" on public.camaras for select using (true);

create policy "Gestión total para admins" on public.profiles for all using (
  (auth.jwt() ->> 'role' = 'service_role') OR 
  (auth.uid() IN (SELECT id FROM public.profiles WHERE rol::text IN ('superadmin', 'admin_camara')))
);

-- 10. TRIGGER CRÍTICO: REGLA DE LOS 10 COMERCIOS GRATUITOS
create or replace function public.fn_check_free_commerce_limit()
returns trigger as $$
declare
  v_count integer;
  v_limit integer;
begin
  if NEW.tipo_plan = 'gratuito' and NEW.estado = 'activo' then
    select limite_gratuitos into v_limit from public.camaras where id = NEW.camara_id;
    if v_limit is null then v_limit := 10; end if;

    select count(*) into v_count 
    from public.comercios 
    where camara_id = NEW.camara_id 
      and tipo_plan = 'gratuito' 
      and estado = 'activo'
      and id != NEW.id; 

    if v_count >= v_limit then
      raise exception 'LÍMITE EXCEDIDO: La cámara ya posee % comercios gratuitos (Máximo %)', v_count, v_limit;
    end if;
  end if;
  return NEW;
end;
$$ language plpgsql;

drop trigger if exists trg_check_commerce_limit on public.comercios;
create trigger trg_check_commerce_limit
  before insert or update on public.comercios
  for each row execute procedure public.fn_check_free_commerce_limit();

-- 11. TRIGGER PARA NUEVOS USUARIOS
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, dni, rol, estado, camara_id)
  values (
    new.id, 
    new.email, 
    coalesce(new.raw_user_meta_data->>'dni', 'SIN_DNI_' || new.id), 
    'comun', 
    'pendiente',
    (new.raw_user_meta_data->>'camara_id')::uuid
  )
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

-- SEED: Trigger para activar la función anterior
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- SEED DATA
INSERT INTO public.camaras (id, nombre, zona) 
VALUES ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Sociedad Rural Central', 'Norte')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.camaras (id, nombre, zona) 
VALUES ('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22', 'Cámara Goya', 'Sur')
ON CONFLICT (id) DO NOTHING;

-- 12. OPTIMIZACIÓN Y RENDIMIENTO (ÍNDICES)
-- Estos índices aceleran drásticamente las consultas frecuentes.

-- PROFILES
CREATE INDEX IF NOT EXISTS idx_profiles_camara_id ON public.profiles(camara_id);
CREATE INDEX IF NOT EXISTS idx_profiles_rol ON public.profiles(rol);
CREATE INDEX IF NOT EXISTS idx_profiles_estado ON public.profiles(estado);
CREATE INDEX IF NOT EXISTS idx_profiles_dni ON public.profiles(dni);

-- COMERCIOS
CREATE INDEX IF NOT EXISTS idx_comercios_camara_id ON public.comercios(camara_id);
CREATE INDEX IF NOT EXISTS idx_comercios_municipio_id ON public.comercios(municipio_id);
CREATE INDEX IF NOT EXISTS idx_comercios_tipo_plan_estado ON public.comercios(tipo_plan, estado); -- Composite Index para el trigger de límite

-- CUOTAS
CREATE INDEX IF NOT EXISTS idx_cuotas_profile_id ON public.cuotas(profile_id);
CREATE INDEX IF NOT EXISTS idx_cuotas_pagado ON public.cuotas(pagado);

-- AUDIT LOGS (Crítico para dashboards)
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON public.audit_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_usuario_id ON public.audit_logs(usuario_id);

-- 13. MANTENIMIENTO: RETENCIÓN DE DATOS (CTO Request)
-- Función para limpiar logs antiguos (mayor a 1 año) para evitar degradación de performance
CREATE OR REPLACE FUNCTION public.clean_old_audit_logs()
RETURNS void AS $$
BEGIN
  DELETE FROM public.audit_logs
  WHERE timestamp < NOW() - INTERVAL '1 year';
END;
$$ LANGUAGE plpgsql;

-- Audit Fix: Schedule the job (Weekly)
-- Nota: Esto puede fallar si 'pg_cron' no está habilitado en el proveedor cloud, pero es la implementación correcta.
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
        PERFORM cron.schedule('weekly-audit-cleanup', '0 0 * * 0', 'SELECT public.clean_old_audit_logs()');
    END IF;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'pg_cron not available or permission denied';
END $$;
