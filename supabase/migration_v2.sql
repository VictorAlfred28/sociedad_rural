-- MIGRACIÓN COMPLETA: SINCRONIZACIÓN DE TABLA COMERCIOS
-- Ejecutar en Supabase SQL Editor

-- 1. Crear tipos enum si no existen
do $$ begin
    create type public.commerce_plan as enum ('gratuito', 'premium');
exception
    when duplicate_object then null;
end $$;

do $$ begin
    create type public.user_status as enum ('activo', 'pendiente', 'inactivo');
exception
    when duplicate_object then null;
end $$;

-- 2. Agregar columnas faltantes a la tabla comercios
alter table public.comercios 
add column if not exists tipo_plan public.commerce_plan default 'gratuito',
add column if not exists estado public.user_status default 'activo';

-- 3. Crear índices de performance
create index if not exists idx_comercios_tipo_plan_estado 
on public.comercios(tipo_plan, estado);

-- 4. Asegurar integridad de datos existentes
update public.comercios set tipo_plan = 'gratuito' where tipo_plan is null;
update public.comercios set estado = 'activo' where estado is null;
