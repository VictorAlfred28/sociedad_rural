-- MIGRACIÓN V7: REFINAMIENTO DE NOTIFICACIONES
-- Objetivo: Solo notificar nuevos socios comunes. Eliminar notificaciones de promos.

-- 1. Eliminar el trigger y función de promociones
DROP TRIGGER IF EXISTS trg_notify_new_promo ON public.promocion;
DROP FUNCTION IF EXISTS public.fn_notify_new_promo();

-- 2. Modificar la función de nuevos socios para filtrar por SuperAdmin
CREATE OR REPLACE FUNCTION public.fn_notify_new_socio()
RETURNS trigger AS $$
BEGIN
    -- Solo notificar si el rol es 'comun'
    IF NEW.rol = 'comun' THEN
        INSERT INTO public.notifications (usuario_id, titulo, mensaje, tipo)
        VALUES (
            '5d181242-d20d-46ea-a211-2ba788c1267f', -- SuperAdmin UUID
            'Nuevo Socio Registrado',
            'El usuario ' || NEW.nombre || ' ' || NEW.apellido || ' se ha registrado como socio.',
            'nuevo_socio'
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
