-- MIGRACIÓN V8: CORRECCIÓN DE ACCESO Y TRIGGER DE PERFILES
-- Objetivo: Permitir que el estado sea definido desde el backend y sincronizar perfiles existentes.

-- 1. Actualizar la función handle_new_user para que sea más flexible
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
    v_dni text;
    v_camara_id uuid;
    v_estado text;
BEGIN
    -- Limpiar DNI: Si viene nulo o vacío, usar ID
    v_dni := COALESCE(new.raw_user_meta_data->>'dni', 'TEMP-' || substring(new.id::text from 1 for 8));
    
    -- Manejar estado: Si viene en metadata (creación admin), usarlo. Si no, 'pendiente'.
    v_estado := COALESCE(new.raw_user_meta_data->>'estado', 'pendiente');
    
    -- Manejar UUID de cámara de forma segura
    BEGIN
        v_camara_id := (new.raw_user_meta_data->>'camara_id')::uuid;
    EXCEPTION WHEN others THEN
        v_camara_id := 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'; -- ID por defecto
    END;

    INSERT INTO public.profiles (id, email, dni, nombre, apellido, rol, estado, camara_id, is_active)
    VALUES (
        new.id, 
        new.email, 
        v_dni,
        COALESCE(new.raw_user_meta_data->>'nombre', 'Nuevo'),
        COALESCE(new.raw_user_meta_data->>'apellido', 'Usuario'),
        'comun', 
        v_estado,
        v_camara_id,
        (v_estado = 'activo') -- Sincronizar is_active con estado
    )
    ON CONFLICT (id) DO UPDATE SET
        dni = EXCLUDED.dni,
        nombre = EXCLUDED.nombre,
        apellido = EXCLUDED.apellido,
        estado = CASE 
            WHEN profiles.estado = 'pendiente' THEN EXCLUDED.estado 
            ELSE profiles.estado 
        END,
        is_active = CASE 
            WHEN profiles.estado = 'pendiente' THEN EXCLUDED.is_active 
            ELSE profiles.is_active 
        END;
        
    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Corregir socios existentes que deberían estar activos (opcional, preventivo)
UPDATE public.profiles 
SET is_active = true 
WHERE estado = 'activo' AND is_active = false;
