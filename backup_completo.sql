--
-- PostgreSQL database dump
--

\restrict AwqCO52m9WNlycFifRFuSkcarbW8smhUgboMayVauGv2ITnRl9jYyvTfCkyfRDj

-- Dumped from database version 17.6
-- Dumped by pg_dump version 18.3

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: pg_database_owner
--

CREATE SCHEMA public;


ALTER SCHEMA public OWNER TO pg_database_owner;

--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: pg_database_owner
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: approval_status; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.approval_status AS ENUM (
    'PENDIENTE',
    'APROBADO',
    'RECHAZADO',
    'SUSPENDIDO'
);


ALTER TYPE public.approval_status OWNER TO postgres;

--
-- Name: evento_estado; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.evento_estado AS ENUM (
    'borrador',
    'publicado',
    'cancelado',
    'finalizado'
);


ALTER TYPE public.evento_estado OWNER TO postgres;

--
-- Name: family_relationship; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.family_relationship AS ENUM (
    'CONYUGE',
    'HIJO',
    'OTRO'
);


ALTER TYPE public.family_relationship OWNER TO postgres;

--
-- Name: user_role; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.user_role AS ENUM (
    'ADMIN',
    'SOCIO',
    'COMERCIO',
    'CAMARA'
);


ALTER TYPE public.user_role OWNER TO postgres;

--
-- Name: user_status; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.user_status AS ENUM (
    'PENDIENTE',
    'APROBADO',
    'RECHAZADO',
    'SUSPENDIDO',
    'RESTRINGIDO'
);


ALTER TYPE public.user_status OWNER TO postgres;

--
-- Name: fn_asignar_numero_socio(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.fn_asignar_numero_socio() RETURNS trigger
    LANGUAGE plpgsql
    AS $_$
DECLARE
  siguiente_numero INTEGER;
BEGIN
  -- Solo actuar si:
  -- 1. El estado cambió A 'APROBADO'
  -- 2. El rol es 'SOCIO'
  -- 3. Aún no tiene numero_socio asignado
  IF NEW.estado = 'APROBADO'
     AND NEW.rol = 'SOCIO'
     AND NEW.numero_socio IS NULL
     AND (OLD.estado IS DISTINCT FROM 'APROBADO' OR OLD.numero_socio IS NULL)
  THEN
    -- Advisory lock para serializar asignaciones concurrentes
    PERFORM pg_advisory_xact_lock(987654321);

    SELECT COALESCE(MAX(CAST(numero_socio AS INTEGER)), 0) + 1
      INTO siguiente_numero
      FROM public.profiles
     WHERE numero_socio IS NOT NULL
       AND numero_socio ~ '^\d+$';

    NEW.numero_socio := LPAD(siguiente_numero::TEXT, 4, '0');
  END IF;

  RETURN NEW;
END;
$_$;


ALTER FUNCTION public.fn_asignar_numero_socio() OWNER TO postgres;

--
-- Name: fn_update_eventos_timestamp(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.fn_update_eventos_timestamp() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.fecha_actualizacion = timezone('utc', now());
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.fn_update_eventos_timestamp() OWNER TO postgres;

--
-- Name: fn_update_municipios_timestamp(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.fn_update_municipios_timestamp() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.fecha_actualizacion = timezone('utc', now());
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.fn_update_municipios_timestamp() OWNER TO postgres;

--
-- Name: get_auth_orga_id(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_auth_orga_id() RETURNS uuid
    LANGUAGE plpgsql STABLE
    AS $$
BEGIN
  RETURN (current_setting('request.jwt.claims', true)::jsonb ->> 'organizacion_id')::UUID;
END;
$$;


ALTER FUNCTION public.get_auth_orga_id() OWNER TO postgres;

--
-- Name: get_auth_rol(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_auth_rol() RETURNS text
    LANGUAGE plpgsql STABLE
    AS $$
BEGIN
  RETURN current_setting('request.jwt.claims', true)::jsonb ->> 'rol';
END;
$$;


ALTER FUNCTION public.get_auth_rol() OWNER TO postgres;

--
-- Name: is_admin(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.is_admin() RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND rol = 'ADMIN'
  );
END;
$$;


ALTER FUNCTION public.is_admin() OWNER TO postgres;

--
-- Name: is_admin_or_superadmin(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.is_admin_or_superadmin() RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND rol = 'ADMIN'
  ) OR EXISTS (
    SELECT 1 FROM user_roles ur JOIN roles r ON r.id = ur.role_id 
    WHERE ur.user_id = auth.uid() AND r.nombre IN ('ADMINISTRADOR', 'SUPERADMIN')
  );
END;
$$;


ALTER FUNCTION public.is_admin_or_superadmin() OWNER TO postgres;

--
-- Name: prevent_auditoria_modify(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.prevent_auditoria_modify() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    RAISE EXCEPTION 'Seguridad Forense: NO SE PUEDE BORRAR NI ALTERAR EL LOG DE AUDITORIA UNA VEZ ESCRITO';
END;
$$;


ALTER FUNCTION public.prevent_auditoria_modify() OWNER TO postgres;

--
-- Name: update_membership_info(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_membership_info() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    UPDATE public.profiles
    SET family_members_count = (SELECT count(*) FROM public.familiares WHERE titular_id = NEW.titular_id) + 1,
        membership_type = CASE WHEN (SELECT count(*) FROM public.familiares WHERE titular_id = NEW.titular_id) > 0 THEN 'FAMILIAR' ELSE 'INDIVIDUAL' END
    WHERE id = NEW.titular_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.profiles
    SET family_members_count = (SELECT count(*) FROM public.familiares WHERE titular_id = OLD.titular_id) + 1,
        membership_type = CASE WHEN (SELECT count(*) FROM public.familiares WHERE titular_id = OLD.titular_id) > 0 THEN 'FAMILIAR' ELSE 'INDIVIDUAL' END
    WHERE id = OLD.titular_id;
  END IF;
  RETURN NULL;
END;
$$;


ALTER FUNCTION public.update_membership_info() OWNER TO postgres;

--
-- Name: update_modified_column(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_modified_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW; 
END;
$$;


ALTER FUNCTION public.update_modified_column() OWNER TO postgres;

--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
   NEW.updated_at = NOW();
   RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_updated_at_column() OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: activity_log; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.activity_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    socio_id uuid,
    tipo_evento character varying(100) NOT NULL,
    descripcion text,
    usuario_id uuid,
    fecha timestamp with time zone DEFAULT now()
);


ALTER TABLE public.activity_log OWNER TO postgres;

--
-- Name: auditoria_logs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.auditoria_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    usuario_id uuid,
    email_usuario character varying(255),
    rol_usuario character varying(50),
    accion character varying(50) NOT NULL,
    tabla_afectada character varying(100) NOT NULL,
    registro_id character varying(255),
    datos_anteriores jsonb,
    datos_nuevos jsonb,
    modulo character varying(100),
    ip_address text,
    user_agent text,
    fecha timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
)
PARTITION BY RANGE (fecha);


ALTER TABLE public.auditoria_logs OWNER TO postgres;

--
-- Name: auditoria_logs_2024; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.auditoria_logs_2024 (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    usuario_id uuid,
    email_usuario character varying(255),
    rol_usuario character varying(50),
    accion character varying(50) NOT NULL,
    tabla_afectada character varying(100) NOT NULL,
    registro_id character varying(255),
    datos_anteriores jsonb,
    datos_nuevos jsonb,
    modulo character varying(100),
    ip_address text,
    user_agent text,
    fecha timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.auditoria_logs_2024 OWNER TO postgres;

--
-- Name: auditoria_logs_2025; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.auditoria_logs_2025 (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    usuario_id uuid,
    email_usuario character varying(255),
    rol_usuario character varying(50),
    accion character varying(50) NOT NULL,
    tabla_afectada character varying(100) NOT NULL,
    registro_id character varying(255),
    datos_anteriores jsonb,
    datos_nuevos jsonb,
    modulo character varying(100),
    ip_address text,
    user_agent text,
    fecha timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.auditoria_logs_2025 OWNER TO postgres;

--
-- Name: auditoria_logs_2026; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.auditoria_logs_2026 (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    usuario_id uuid,
    email_usuario character varying(255),
    rol_usuario character varying(50),
    accion character varying(50) NOT NULL,
    tabla_afectada character varying(100) NOT NULL,
    registro_id character varying(255),
    datos_anteriores jsonb,
    datos_nuevos jsonb,
    modulo character varying(100),
    ip_address text,
    user_agent text,
    fecha timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.auditoria_logs_2026 OWNER TO postgres;

--
-- Name: auditoria_logs_2027; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.auditoria_logs_2027 (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    usuario_id uuid,
    email_usuario character varying(255),
    rol_usuario character varying(50),
    accion character varying(50) NOT NULL,
    tabla_afectada character varying(100) NOT NULL,
    registro_id character varying(255),
    datos_anteriores jsonb,
    datos_nuevos jsonb,
    modulo character varying(100),
    ip_address text,
    user_agent text,
    fecha timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.auditoria_logs_2027 OWNER TO postgres;

--
-- Name: auditoria_logs_2028; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.auditoria_logs_2028 (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    usuario_id uuid,
    email_usuario character varying(255),
    rol_usuario character varying(50),
    accion character varying(50) NOT NULL,
    tabla_afectada character varying(100) NOT NULL,
    registro_id character varying(255),
    datos_anteriores jsonb,
    datos_nuevos jsonb,
    modulo character varying(100),
    ip_address text,
    user_agent text,
    fecha timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.auditoria_logs_2028 OWNER TO postgres;

--
-- Name: chat_history; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.chat_history (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    role text,
    content text NOT NULL,
    metadata jsonb,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
    CONSTRAINT chat_history_role_check CHECK ((role = ANY (ARRAY['system'::text, 'user'::text, 'assistant'::text])))
);


ALTER TABLE public.chat_history OWNER TO postgres;

--
-- Name: comercio_solicitudes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.comercio_solicitudes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    nombre text NOT NULL,
    rubro text NOT NULL,
    direccion text NOT NULL,
    telefono text,
    email text,
    descripcion text,
    logo_url text,
    instagram_url text,
    facebook_url text,
    estado text DEFAULT 'PENDIENTE'::text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    organizacion_id uuid
);


ALTER TABLE public.comercio_solicitudes OWNER TO postgres;

--
-- Name: comercios; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.comercios (
    id uuid NOT NULL,
    nombre_comercio text NOT NULL,
    cuit text NOT NULL,
    rubro text,
    direccion text,
    municipio text,
    responsable_dni text,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    user_id uuid,
    estado text DEFAULT 'ACTIVO'::text,
    logo_url text,
    instagram_url text,
    facebook_url text,
    telefono text,
    email text,
    descripcion text,
    organizacion_id uuid,
    barrio text
);


ALTER TABLE public.comercios OWNER TO postgres;

--
-- Name: COLUMN comercios.barrio; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.comercios.barrio IS 'Barrio o localidad del comercio dentro del municipio.';


--
-- Name: configuracion_cuotas; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.configuracion_cuotas (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    rol text NOT NULL,
    monto numeric DEFAULT 0 NOT NULL,
    ultima_actualizacion timestamp with time zone DEFAULT now()
);


ALTER TABLE public.configuracion_cuotas OWNER TO postgres;

--
-- Name: empleados_comercios; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.empleados_comercios (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    perfil_id uuid NOT NULL,
    comercio_id uuid NOT NULL,
    activo boolean DEFAULT true,
    fecha_ingreso date DEFAULT CURRENT_DATE,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.empleados_comercios OWNER TO postgres;

--
-- Name: eventos_sociales; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.eventos_sociales (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    external_id text NOT NULL,
    titulo text NOT NULL,
    descripcion_limpia text,
    lugar text DEFAULT 'A definir'::text,
    fecha_evento date,
    hora_evento time without time zone,
    imagen_url text,
    metadata jsonb,
    status text DEFAULT 'borrador'::text,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    fuente text DEFAULT 'sociedad_rural'::text NOT NULL,
    municipio_id uuid,
    descripcion text,
    fecha date,
    hora time without time zone,
    municipio text,
    tipo text,
    link_instagram text,
    link_facebook text,
    link_whatsapp text,
    link_externo text,
    estado text DEFAULT 'borrador'::text,
    destacado boolean DEFAULT false,
    publico boolean DEFAULT true,
    slug text,
    tipo_origen text
);


ALTER TABLE public.eventos_sociales OWNER TO postgres;

--
-- Name: familiares; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.familiares (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    titular_id uuid NOT NULL,
    nombre_apellido text NOT NULL,
    dni text NOT NULL,
    parentesco public.family_relationship NOT NULL,
    fecha_nacimiento date,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.familiares OWNER TO postgres;

--
-- Name: localidades; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.localidades (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nombre text NOT NULL,
    active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.localidades OWNER TO postgres;

--
-- Name: TABLE localidades; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.localidades IS 'Tabla para restringir y gestionar las localidades válidas en el sistema.';


--
-- Name: municipios; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.municipios (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    nombre text NOT NULL,
    provincia text NOT NULL,
    descripcion text,
    imagen_principal text,
    activo boolean DEFAULT true,
    latitud double precision,
    longitud double precision,
    fecha_creacion timestamp with time zone DEFAULT timezone('utc'::text, now()),
    fecha_actualizacion timestamp with time zone DEFAULT timezone('utc'::text, now()),
    instagram_handle text,
    instagram_user_id text
);


ALTER TABLE public.municipios OWNER TO postgres;

--
-- Name: TABLE municipios; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.municipios IS 'Municipios del territorio: Corrientes Capital, Santo Tomé, etc. Cada evento está asociado a un municipio.';


--
-- Name: COLUMN municipios.latitud; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.municipios.latitud IS 'Coordenadas geográficas (opcional para futuro SIG)';


--
-- Name: COLUMN municipios.longitud; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.municipios.longitud IS 'Coordenadas geográficas (opcional para futuro SIG)';


--
-- Name: notificaciones; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.notificaciones (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    usuario_id uuid,
    tipo character varying(50),
    mensaje text,
    estado_envio character varying(50) DEFAULT 'PENDIENTE'::character varying,
    fecha timestamp with time zone DEFAULT now(),
    titulo character varying,
    leido boolean DEFAULT false,
    link_url text,
    metadata jsonb,
    is_admin_destined boolean DEFAULT false,
    estado character varying(50) DEFAULT 'PENDIENTE'::character varying,
    resolved_at timestamp with time zone,
    evento_id uuid
);


ALTER TABLE public.notificaciones OWNER TO postgres;

--
-- Name: pagos_cuotas; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.pagos_cuotas (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    socio_id uuid,
    monto numeric NOT NULL,
    fecha_vencimiento date NOT NULL,
    estado_pago text DEFAULT 'PENDIENTE'::text,
    created_at timestamp with time zone DEFAULT now(),
    comprobante_url text,
    fecha_envio_comprobante timestamp with time zone,
    fecha_validacion timestamp with time zone,
    admin_validador_id uuid,
    CONSTRAINT pagos_cuotas_estado_pago_check CHECK ((estado_pago = ANY (ARRAY['PENDIENTE'::text, 'PENDIENTE_VALIDACION'::text, 'PAGADO'::text, 'RECHAZADO'::text])))
);


ALTER TABLE public.pagos_cuotas OWNER TO postgres;

--
-- Name: profesionales; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.profesionales (
    id uuid NOT NULL,
    matricula text NOT NULL,
    titulo text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.profesionales OWNER TO postgres;

--
-- Name: profiles; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.profiles (
    id uuid NOT NULL,
    nombre_apellido text NOT NULL,
    dni text,
    email text NOT NULL,
    telefono text,
    rol public.user_role DEFAULT 'SOCIO'::public.user_role NOT NULL,
    estado public.user_status DEFAULT 'PENDIENTE'::public.user_status NOT NULL,
    password_changed boolean DEFAULT false,
    municipio text,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    es_profesional boolean DEFAULT false,
    rubro text,
    camara_denominacion text,
    camara_provincia text,
    cuit text,
    estado_aprobacion public.approval_status DEFAULT 'PENDIENTE'::public.approval_status,
    foto_url text,
    titular_id uuid,
    tipo_vinculo character varying(50),
    direccion text,
    motivo text,
    username character varying(255),
    provincia text,
    sonido_notificaciones_habilitado boolean DEFAULT true NOT NULL,
    barrio text,
    numero_socio text,
    es_estudiante boolean DEFAULT false,
    constancia_estudiante_url text,
    membership_type text DEFAULT 'INDIVIDUAL'::text,
    family_members_count integer DEFAULT 1,
    must_change_password boolean DEFAULT false,
    user_type text DEFAULT 'SOCIO'::text,
    email_verificado boolean DEFAULT false,
    email_verificacion_token text,
    email_verificacion_expira timestamp with time zone,
    tipo_socio text
);


ALTER TABLE public.profiles OWNER TO postgres;

--
-- Name: COLUMN profiles.sonido_notificaciones_habilitado; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.profiles.sonido_notificaciones_habilitado IS 'Preferencia de sonido para notificaciones push del usuario';


--
-- Name: COLUMN profiles.barrio; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.profiles.barrio IS 'Barrio o localidad secundaria del socio';


--
-- Name: COLUMN profiles.email_verificado; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.profiles.email_verificado IS 'True si el usuario hizo clic en el enlace de verificación de correo.';


--
-- Name: COLUMN profiles.email_verificacion_token; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.profiles.email_verificacion_token IS 'Token único URL-safe para verificar el correo. Se invalida al usarse o al reenviar.';


--
-- Name: COLUMN profiles.email_verificacion_expira; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.profiles.email_verificacion_expira IS 'Expiración del token de verificación (48 hs desde el registro o el último reenvío).';


--
-- Name: promociones; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.promociones (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    comercio_id uuid NOT NULL,
    titulo text NOT NULL,
    descripcion text,
    descuento_porcentaje numeric,
    fecha_inicio date,
    fecha_fin date,
    activo boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    tipo text,
    imagen_url text,
    updated_at timestamp with time zone DEFAULT now(),
    es_exclusiva_profesionales boolean DEFAULT false,
    instagram_url text,
    facebook_url text,
    organizacion_id uuid,
    valor_descuento numeric(10,2) DEFAULT 0,
    tipo_descuento text DEFAULT 'porcentaje'::text,
    CONSTRAINT promociones_tipo_check CHECK ((tipo = ANY (ARRAY['promocion'::text, 'descuento'::text, 'beneficio'::text]))),
    CONSTRAINT promociones_tipo_descuento_check CHECK ((tipo_descuento = ANY (ARRAY['porcentaje'::text, 'fijo'::text])))
);


ALTER TABLE public.promociones OWNER TO postgres;

--
-- Name: push_tokens; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.push_tokens (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    usuario_id uuid,
    token text NOT NULL,
    plataforma text DEFAULT 'web'::text,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now())
);


ALTER TABLE public.push_tokens OWNER TO postgres;

--
-- Name: qr_tokens; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.qr_tokens (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    token text NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    used boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now())
);


ALTER TABLE public.qr_tokens OWNER TO postgres;

--
-- Name: roles; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.roles (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    nombre character varying(50) NOT NULL,
    descripcion text,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now())
);


ALTER TABLE public.roles OWNER TO postgres;

--
-- Name: suscripciones; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.suscripciones (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    socio_id uuid NOT NULL,
    estado_pago text DEFAULT 'PENDIENTE'::text NOT NULL,
    vencimiento date,
    mercado_pago_id text,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    mes integer,
    anio integer,
    comprobante_url text
);


ALTER TABLE public.suscripciones OWNER TO postgres;

--
-- Name: user_roles; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_roles (
    user_id uuid NOT NULL,
    role_id uuid NOT NULL,
    assigned_at timestamp with time zone DEFAULT timezone('utc'::text, now())
);


ALTER TABLE public.user_roles OWNER TO postgres;

--
-- Name: auditoria_logs_2024; Type: TABLE ATTACH; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.auditoria_logs ATTACH PARTITION public.auditoria_logs_2024 FOR VALUES FROM ('2024-01-01 00:00:00+00') TO ('2025-01-01 00:00:00+00');


--
-- Name: auditoria_logs_2025; Type: TABLE ATTACH; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.auditoria_logs ATTACH PARTITION public.auditoria_logs_2025 FOR VALUES FROM ('2025-01-01 00:00:00+00') TO ('2026-01-01 00:00:00+00');


--
-- Name: auditoria_logs_2026; Type: TABLE ATTACH; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.auditoria_logs ATTACH PARTITION public.auditoria_logs_2026 FOR VALUES FROM ('2026-01-01 00:00:00+00') TO ('2027-01-01 00:00:00+00');


--
-- Name: auditoria_logs_2027; Type: TABLE ATTACH; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.auditoria_logs ATTACH PARTITION public.auditoria_logs_2027 FOR VALUES FROM ('2027-01-01 00:00:00+00') TO ('2028-01-01 00:00:00+00');


--
-- Name: auditoria_logs_2028; Type: TABLE ATTACH; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.auditoria_logs ATTACH PARTITION public.auditoria_logs_2028 FOR VALUES FROM ('2028-01-01 00:00:00+00') TO ('2029-01-01 00:00:00+00');


--
-- Data for Name: activity_log; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.activity_log (id, socio_id, tipo_evento, descripcion, usuario_id, fecha) FROM stdin;
f54c3360-fb21-43a9-b5e9-1bb13ef69a11	5d7855f3-f641-4af6-9537-f41b82ac162d	MORA_DETECTADA	Detección automática de mora para cuota 5/2026	\N	2026-05-03 03:47:29.96606+00
498ed5b9-2153-4325-99b5-b59a291601c1	b4c9f795-d07f-4c08-b8cb-7b20dc08cbd5	MORA_DETECTADA	Detección automática de mora para cuota 5/2026	\N	2026-05-03 03:47:29.96606+00
ff14cf01-6637-4a9b-859c-7eba25e3e491	b32ae806-027b-48f9-991a-e18fac9d8eba	MORA_DETECTADA	Detección automática de mora para cuota 5/2026	\N	2026-05-03 03:47:29.96606+00
5deeb634-ec12-4ab8-9f94-7bd306c933fd	597219dc-9be9-4ab2-a432-16547e174b1a	MORA_DETECTADA	Detección automática de mora para cuota 5/2026	\N	2026-05-03 03:47:29.96606+00
122192ea-a277-470b-92e9-42e431984b78	ea625819-210b-4b34-8fb2-64d1009f8021	MORA_DETECTADA	Detección automática de mora para cuota 5/2026	\N	2026-05-03 03:47:29.96606+00
77fb7141-f08e-408c-9bff-4d05bbb305a3	23c2224d-0aae-4fae-81ba-ed79cb3bbbe2	MORA_DETECTADA	Detección automática de mora para cuota 5/2026	\N	2026-05-03 03:47:29.96606+00
c9069656-a4af-4973-9269-2ebd99165eed	9102582e-308e-4d44-bd21-fa988d6c4891	MORA_DETECTADA	Detección automática de mora para cuota 5/2026	\N	2026-05-03 03:47:29.96606+00
2b055a12-915f-4f4f-9488-b884b7b23ee1	87666333-f287-41b6-b0d2-32fcf58e1daa	MORA_DETECTADA	Detección automática de mora para cuota 5/2026	\N	2026-05-03 03:47:29.96606+00
6aa6da10-8757-4c17-99a2-3eca4f5cadb7	e82810c3-4550-4994-8bcd-e7e9e18deea9	MORA_DETECTADA	Detección automática de mora para cuota 5/2026	\N	2026-05-03 03:47:29.96606+00
59265155-649f-4c17-8dd8-fd47b7f7804c	3afd196c-9675-46d3-8650-76e71563c617	MORA_DETECTADA	Detección automática de mora para cuota 5/2026	\N	2026-05-03 03:47:29.96606+00
98a92cbc-7aa9-4000-a005-9164604c997a	7b7e0daf-741d-4ca7-8ac4-ca7d78ebf8a8	MORA_DETECTADA	Detección automática de mora para cuota 5/2026	\N	2026-05-03 03:47:29.96606+00
5889a94f-9927-44a5-8d99-d703ba4415c7	93d7a43f-21d7-49a5-8794-0e1187dfcc7c	MORA_DETECTADA	Detección automática de mora para cuota 5/2026	\N	2026-05-03 03:47:29.96606+00
46a5a42f-3c70-49b0-8f31-e2d87ed1d661	030556ed-8fbb-4783-9f87-f324a3cd5686	MORA_DETECTADA	Detección automática de mora para cuota 5/2026	\N	2026-05-03 03:47:29.96606+00
a4f43c4c-e2eb-420e-b468-5bba89863735	ab2edc19-8df3-419e-82c9-a97493ee29e7	MORA_DETECTADA	Detección automática de mora para cuota 5/2026	\N	2026-05-03 03:47:29.96606+00
d74d54ac-13d7-400d-b67b-f3b9ab5b5e24	8add1c0e-5ad5-466b-8170-7959eb423e92	MORA_DETECTADA	Detección automática de mora para cuota 5/2026	\N	2026-05-03 03:47:29.96606+00
458f6558-3725-4834-8b42-ae0f5470c7ca	461a31ea-5286-42ab-8c1c-2d976da73d40	MORA_DETECTADA	Detección automática de mora para cuota 5/2026	\N	2026-05-03 03:47:29.96606+00
62b0aa07-6b32-4ffa-9ff1-c71aedc0dd74	b9e03dcc-3e7b-4fd7-91c3-54f4fd3f5b34	MORA_DETECTADA	Detección automática de mora para cuota 5/2026	\N	2026-05-03 03:47:29.96606+00
d2dc9849-dba2-4e5a-8321-edb8c51d88e6	cb377de7-c49c-46b6-b735-3e42849ed1f0	MORA_DETECTADA	Detección automática de mora para cuota 5/2026	\N	2026-05-03 03:47:29.96606+00
9fb64701-237d-4c85-a794-73b3f9afad44	467290c0-3061-4bab-930b-791236a824f1	MORA_DETECTADA	Detección automática de mora para cuota 5/2026	\N	2026-05-03 03:47:29.96606+00
05b21aab-8ee6-4e2d-80bd-1fd43eb40d9c	1c757b75-8f83-4677-9747-043c4f03a67f	MORA_DETECTADA	Detección automática de mora para cuota 5/2026	\N	2026-05-03 03:47:29.96606+00
98f39a8c-2194-4220-a26f-0322bd008144	2a1039a2-be04-42e1-a654-6e67de053dd9	MORA_DETECTADA	Detección automática de mora para cuota 5/2026	\N	2026-05-03 03:47:29.96606+00
df953ce3-4ddd-4207-b52d-bd6f34b7ae1d	e01afdff-da8f-469a-a054-9eb71ccf3766	MORA_DETECTADA	Detección automática de mora para cuota 5/2026	\N	2026-05-03 03:47:29.96606+00
76c04dc4-0a4c-4828-97ff-4275bb574892	87199fe9-bc96-400c-9d98-008190649581	MORA_DETECTADA	Detección automática de mora para cuota 5/2026	\N	2026-05-03 03:47:29.96606+00
\.


--
-- Data for Name: auditoria_logs_2024; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.auditoria_logs_2024 (id, usuario_id, email_usuario, rol_usuario, accion, tabla_afectada, registro_id, datos_anteriores, datos_nuevos, modulo, ip_address, user_agent, fecha) FROM stdin;
\.


--
-- Data for Name: auditoria_logs_2025; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.auditoria_logs_2025 (id, usuario_id, email_usuario, rol_usuario, accion, tabla_afectada, registro_id, datos_anteriores, datos_nuevos, modulo, ip_address, user_agent, fecha) FROM stdin;
\.


--
-- Data for Name: auditoria_logs_2026; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.auditoria_logs_2026 (id, usuario_id, email_usuario, rol_usuario, accion, tabla_afectada, registro_id, datos_anteriores, datos_nuevos, modulo, ip_address, user_agent, fecha) FROM stdin;
e176dc17-b09a-4686-88b5-3980d64a59a8	467290c0-3061-4bab-930b-791236a824f1	victoralfredo2498@gmail.com	SUPERADMIN | SOCIO	LOGIN_ADMIN	auth.users	467290c0-3061-4bab-930b-791236a824f1	\N	{"roles": ["SUPERADMIN", "SOCIO"], "metodo": "email"}	Autenticación Administrativa	10.11.0.10	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36	2026-04-15 22:05:39.165013+00
609c21d7-1554-479f-9aa3-e3f318865a9e	467290c0-3061-4bab-930b-791236a824f1	victoralfredo2498@gmail.com	SUPERADMIN | SOCIO	LOGIN_ADMIN	auth.users	467290c0-3061-4bab-930b-791236a824f1	\N	{"roles": ["SUPERADMIN", "SOCIO"], "metodo": "email"}	Autenticación Administrativa	10.11.0.10	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36	2026-04-15 22:13:37.618127+00
27362fcc-2de2-4e4f-a389-7642f973edc6	467290c0-3061-4bab-930b-791236a824f1	victoralfredo2498@gmail.com	SUPERADMIN | SOCIO	LOGIN_ADMIN	auth.users	467290c0-3061-4bab-930b-791236a824f1	\N	{"roles": ["SUPERADMIN", "SOCIO"], "metodo": "email"}	Autenticación Administrativa	10.11.0.10	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36	2026-04-15 22:21:05.855104+00
9a38c2c2-f28f-4dcf-9584-45882fa662c8	467290c0-3061-4bab-930b-791236a824f1	victoralfredo2498@gmail.com	SUPERADMIN | SOCIO	LOGIN_ADMIN	auth.users	467290c0-3061-4bab-930b-791236a824f1	\N	{"roles": ["SUPERADMIN", "SOCIO"], "metodo": "email"}	Autenticación Administrativa	10.11.0.10	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36	2026-04-15 22:41:43.703299+00
d0e225fe-bd80-4086-90b6-7175c6f07b3b	467290c0-3061-4bab-930b-791236a824f1	victoralfredo2498@gmail.com	ADMIN	CREATE	profiles	ea1dc95f-f956-46aa-807e-433529761a17	\N	{"id": "ea1dc95f-f956-46aa-807e-433529761a17", "dni": "30685849751", "rol": "COMERCIO", "email": "supermercadodia@gmail.com", "rubro": "comercio_general", "estado": "PENDIENTE", "telefono": "3794111111", "municipio": "Capital", "titular_id": null, "nombre_apellido": "Supermercado Dia", "password_changed": false}	Gestión Comercios	10.11.0.10	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36	2026-04-15 22:57:35.798783+00
11c85a62-f5d1-4018-88da-9fb1d5564801	467290c0-3061-4bab-930b-791236a824f1	victoralfredo2498@gmail.com	ADMIN	UPDATE	profiles	ea1dc95f-f956-46aa-807e-433529761a17	{"estado": "PENDIENTE"}	{"estado": "APROBADO"}	Gestión Usuarios	10.11.0.10	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36	2026-04-15 22:58:52.831435+00
ddf7647c-a3fd-4272-8826-630c5beea91d	ea1dc95f-f956-46aa-807e-433529761a17	supermercadodia@gmail.com	\N	UPDATE	profiles	ea1dc95f-f956-46aa-807e-433529761a17	\N	{"password_changed": true}	Seguridad	10.11.0.10	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36	2026-04-15 23:03:18.497439+00
f090c4b4-394e-487d-93fb-965096083eb3	322dc1be-c7d3-4540-b512-110fbfc832e8	ferreteriaelgallego@gmail.com	COMERCIO	CREATE	profiles	322dc1be-c7d3-4540-b512-110fbfc832e8	\N	{"id": "322dc1be-c7d3-4540-b512-110fbfc832e8", "dni": "201111112", "rol": "COMERCIO", "email": "ferreteriaelgallego@gmail.com", "rubro": "construccion", "estado": "PENDIENTE", "telefono": "3794222222", "municipio": "Capital", "nombre_apellido": "Ferretería Gallego", "password_changed": false}	Registro Cuentas	10.11.0.10	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36	2026-04-15 23:09:05.771537+00
8bd4c1f7-dff4-4cdd-bcc9-a9be8451ade2	467290c0-3061-4bab-930b-791236a824f1	victoralfredo2498@gmail.com	SUPERADMIN | SOCIO	LOGIN_ADMIN	auth.users	467290c0-3061-4bab-930b-791236a824f1	\N	{"roles": ["SUPERADMIN", "SOCIO"], "metodo": "email"}	Autenticación Administrativa	10.11.0.10	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36	2026-04-15 23:11:49.725252+00
74d00d2f-63b8-42cf-9f1e-8e88f85865d3	467290c0-3061-4bab-930b-791236a824f1	victoralfredo2498@gmail.com	ADMIN	UPDATE	profiles	322dc1be-c7d3-4540-b512-110fbfc832e8	{"estado": "PENDIENTE"}	{"estado": "APROBADO"}	Gestión Usuarios	10.11.0.10	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36	2026-04-15 23:12:08.265382+00
bcd9343c-65a5-494e-a946-54f8ec5406e8	322dc1be-c7d3-4540-b512-110fbfc832e8	ferreteriaelgallego@gmail.com	\N	UPDATE	profiles	322dc1be-c7d3-4540-b512-110fbfc832e8	\N	{"password_changed": true}	Seguridad	10.11.0.10	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36	2026-04-15 23:13:12.36306+00
c27a0562-9a07-414b-ba65-bcb18ec28203	bb4a93fe-c694-4257-80f2-0011853db785	juanperez@gmail.com	SOCIO	CREATE	profiles	bb4a93fe-c694-4257-80f2-0011853db785	\N	{"id": "bb4a93fe-c694-4257-80f2-0011853db785", "dni": "30121212", "rol": "SOCIO", "email": "juanperez@gmail.com", "rubro": null, "estado": "PENDIENTE", "telefono": "3795123456", "direccion": "Junín 740", "municipio": "Capital", "provincia": null, "es_profesional": true, "nombre_apellido": "Juan Perez", "password_changed": false}	Registro Cuentas	10.11.0.10	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36	2026-04-15 23:22:26.609675+00
5a95b54f-6a3a-4506-805f-f84a02df4b14	467290c0-3061-4bab-930b-791236a824f1	victoralfredo2498@gmail.com	SUPERADMIN | SOCIO	LOGIN_ADMIN	auth.users	467290c0-3061-4bab-930b-791236a824f1	\N	{"roles": ["SUPERADMIN", "SOCIO"], "metodo": "email"}	Autenticación Administrativa	10.11.0.10	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36	2026-04-15 23:23:15.064614+00
119490d7-09af-4f27-901a-72674f39c632	467290c0-3061-4bab-930b-791236a824f1	victoralfredo2498@gmail.com	ADMIN	UPDATE	profiles	bb4a93fe-c694-4257-80f2-0011853db785	{"estado": "PENDIENTE"}	{"estado": "APROBADO"}	Gestión Usuarios	10.11.0.10	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36	2026-04-15 23:23:35.802723+00
cf44595c-eeea-46e1-904a-5f5045dcbf40	bb4a93fe-c694-4257-80f2-0011853db785	juanperez@gmail.com	\N	UPDATE	profiles	bb4a93fe-c694-4257-80f2-0011853db785	\N	{"password_changed": true}	Seguridad	10.11.0.10	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36	2026-04-15 23:24:14.443328+00
906e5993-d94a-4033-a5a8-120eb953fc0f	bb2723dd-af22-4c36-af55-0bd80b53261e	carlosalfredo@gmail.com	SOCIO	CREATE	profiles	bb2723dd-af22-4c36-af55-0bd80b53261e	\N	{"id": "bb2723dd-af22-4c36-af55-0bd80b53261e", "dni": "30123456", "rol": "SOCIO", "email": "carlosalfredo@gmail.com", "rubro": null, "estado": "PENDIENTE", "telefono": "379645612378", "direccion": " Juana Manso 1501", "municipio": "Itatí", "provincia": null, "es_profesional": false, "nombre_apellido": "Carlos Alfredo", "password_changed": false}	Registro Cuentas	10.11.0.10	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36	2026-04-15 23:38:33.942522+00
437ee194-d649-4ad4-962e-1c84f8183e34	467290c0-3061-4bab-930b-791236a824f1	victoralfredo2498@gmail.com	SUPERADMIN | SOCIO	LOGIN_ADMIN	auth.users	467290c0-3061-4bab-930b-791236a824f1	\N	{"roles": ["SUPERADMIN", "SOCIO"], "metodo": "email"}	Autenticación Administrativa	10.11.0.10	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36	2026-04-15 23:38:58.858074+00
ef5577e1-d0de-4e68-abb8-35a2331daa46	467290c0-3061-4bab-930b-791236a824f1	victoralfredo2498@gmail.com	ADMIN	CREATE	profiles	030556ed-8fbb-4783-9f87-f324a3cd5686	\N	{"id": "030556ed-8fbb-4783-9f87-f324a3cd5686", "dni": "20383169349", "rol": "COMERCIO", "email": "bunker@gmail.com", "rubro": "otro", "estado": "PENDIENTE", "telefono": "3794556677", "municipio": "Capital", "titular_id": null, "nombre_apellido": "ESPACIO BUNKER ", "password_changed": false}	Gestión Comercios	10.11.0.10	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36	2026-04-21 04:06:16.592465+00
21aecf3b-63d7-409c-a2d3-245aea4f165e	467290c0-3061-4bab-930b-791236a824f1	victoralfredo2498@gmail.com	ADMIN	DELETE	auth.users / profiles	bb2723dd-af22-4c36-af55-0bd80b53261e	{"id": "bb2723dd-af22-4c36-af55-0bd80b53261e", "dni": "30123456", "rol": "SOCIO", "cuit": null, "email": "carlosalfredo@gmail.com", "rubro": null, "estado": "PENDIENTE", "motivo": null, "foto_url": null, "telefono": "379645612378", "username": null, "direccion": " Juana Manso 1501", "municipio": "Itatí", "provincia": null, "created_at": "2026-04-15T23:38:33.604556+00:00", "titular_id": null, "updated_at": "2026-04-15T23:38:33.604556+00:00", "tipo_vinculo": null, "es_profesional": false, "nombre_apellido": "Carlos Alfredo", "camara_provincia": null, "password_changed": false, "estado_aprobacion": "PENDIENTE", "camara_denominacion": null}	\N	Gestión Usuarios	10.11.0.10	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36	2026-04-15 23:50:35.95257+00
06d96ad9-e068-4d53-9b0a-e47b4d9b8838	da6eab2c-b700-4823-9aee-c105151598e9	juanperez@hotmail.com	SOCIO	CREATE	profiles	da6eab2c-b700-4823-9aee-c105151598e9	\N	{"id": "da6eab2c-b700-4823-9aee-c105151598e9", "dni": "31222332", "rol": "SOCIO", "email": "juanperez@hotmail.com", "rubro": null, "estado": "PENDIENTE", "telefono": "3794330170", "direccion": null, "municipio": "Itatí", "provincia": "Corrientes", "es_profesional": true, "nombre_apellido": "Juan Perez", "password_changed": false}	Registro Cuentas	10.11.0.10	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36	2026-04-15 23:52:26.351762+00
4b5ebee0-962b-46ad-9b70-50c6925e9458	467290c0-3061-4bab-930b-791236a824f1	victoralfredo2498@gmail.com	SUPERADMIN | SOCIO	LOGIN_ADMIN	auth.users	467290c0-3061-4bab-930b-791236a824f1	\N	{"roles": ["SUPERADMIN", "SOCIO"], "metodo": "email"}	Autenticación Administrativa	10.11.0.10	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36	2026-04-15 23:52:49.46169+00
40c90d5f-80c3-4c9e-abe4-56b60602919f	467290c0-3061-4bab-930b-791236a824f1	victoralfredo2498@gmail.com	ADMIN	UPDATE	profiles	bb4a93fe-c694-4257-80f2-0011853db785	{"estado": "APROBADO"}	{"estado": "SUSPENDIDO"}	Gestión Usuarios	10.11.0.10	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36	2026-04-15 23:53:13.089903+00
dbb655b4-d6be-4fd3-92c4-4d35118a564a	467290c0-3061-4bab-930b-791236a824f1	victoralfredo2498@gmail.com	ADMIN	UPDATE	profiles	da6eab2c-b700-4823-9aee-c105151598e9	{"estado": "PENDIENTE"}	{"estado": "APROBADO"}	Gestión Usuarios	10.11.0.10	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36	2026-04-15 23:53:16.905927+00
1163b5ee-f81d-46d3-be2a-4300a7c93fb8	da6eab2c-b700-4823-9aee-c105151598e9	juanperez@hotmail.com	\N	UPDATE	profiles	da6eab2c-b700-4823-9aee-c105151598e9	\N	{"password_changed": true}	Seguridad	10.11.0.10	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36	2026-04-15 23:54:05.350894+00
1b3d84ce-8b97-4a5a-81c1-576c6b15141f	467290c0-3061-4bab-930b-791236a824f1	victoralfredo2498@gmail.com	SUPERADMIN | SOCIO	LOGIN_ADMIN	auth.users	467290c0-3061-4bab-930b-791236a824f1	\N	{"roles": ["SUPERADMIN", "SOCIO"], "metodo": "email"}	Autenticación Administrativa	10.11.0.10	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36	2026-04-21 03:32:36.825368+00
ceed06af-8fd9-47ad-be99-2384cbd71983	467290c0-3061-4bab-930b-791236a824f1	victoralfredo2498@gmail.com	ADMIN	CREATE	profiles	9102582e-308e-4d44-bd21-fa988d6c4891	\N	{"id": "9102582e-308e-4d44-bd21-fa988d6c4891", "dni": "30718848799", "rol": "COMERCIO", "email": "ferremaq@mail.com", "rubro": "construccion", "estado": "PENDIENTE", "telefono": "3794112233", "municipio": "Capital", "titular_id": null, "nombre_apellido": "FERREMAQ", "password_changed": false}	Gestión Comercios	10.11.0.10	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36	2026-04-21 03:53:23.672189+00
7f254318-6e3c-4959-a37b-8b44c2ff329e	467290c0-3061-4bab-930b-791236a824f1	victoralfredo2498@gmail.com	ADMIN	UPDATE	profiles	9102582e-308e-4d44-bd21-fa988d6c4891	{"estado": "PENDIENTE"}	{"estado": "APROBADO"}	Gestión Usuarios	10.11.0.10	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36	2026-04-21 03:53:42.485995+00
b5b6e87c-ada3-442d-be2d-35a0ab575131	87666333-f287-41b6-b0d2-32fcf58e1daa	confortable@gmail.com	COMERCIO	CREATE	profiles	87666333-f287-41b6-b0d2-32fcf58e1daa	\N	{"id": "87666333-f287-41b6-b0d2-32fcf58e1daa", "dni": "20109807711", "rol": "COMERCIO", "email": "confortable@gmail.com", "rubro": "otro", "estado": "PENDIENTE", "telefono": "3794111222", "municipio": "Capital", "nombre_apellido": "CONFORTABLE", "password_changed": false}	Registro Cuentas	10.11.0.10	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36	2026-04-21 03:57:51.109419+00
6f060770-f60e-4513-a4c7-34740046c5a7	467290c0-3061-4bab-930b-791236a824f1	victoralfredo2498@gmail.com	SUPERADMIN | SOCIO	LOGIN_ADMIN	auth.users	467290c0-3061-4bab-930b-791236a824f1	\N	{"roles": ["SUPERADMIN", "SOCIO"], "metodo": "email"}	Autenticación Administrativa	10.11.0.10	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36	2026-04-21 03:58:23.675791+00
792e7a37-9ba2-49f1-8f06-ffc5d2d4b1ba	467290c0-3061-4bab-930b-791236a824f1	victoralfredo2498@gmail.com	ADMIN	UPDATE	profiles	87666333-f287-41b6-b0d2-32fcf58e1daa	{"estado": "PENDIENTE"}	{"estado": "APROBADO"}	Gestión Usuarios	10.11.0.10	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36	2026-04-21 03:58:39.824643+00
96b6348a-0822-40dc-838c-2f28e8e95863	467290c0-3061-4bab-930b-791236a824f1	victoralfredo2498@gmail.com	ADMIN	CREATE	profiles	e82810c3-4550-4994-8bcd-e7e9e18deea9	\N	{"id": "e82810c3-4550-4994-8bcd-e7e9e18deea9", "dni": "30710417217", "rol": "COMERCIO", "email": "pacheco@gmail.com", "rubro": "otro", "estado": "PENDIENTE", "telefono": "3794334455", "municipio": "Capital", "titular_id": null, "nombre_apellido": "EST. DE SERV. PACHECO", "password_changed": false}	Gestión Comercios	10.11.0.10	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36	2026-04-21 04:01:09.029903+00
6d7e9e9c-71da-40b8-a3f0-7965773dfc4a	467290c0-3061-4bab-930b-791236a824f1	victoralfredo2498@gmail.com	ADMIN	UPDATE	profiles	e82810c3-4550-4994-8bcd-e7e9e18deea9	{"estado": "PENDIENTE"}	{"estado": "APROBADO"}	Gestión Usuarios	10.11.0.10	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36	2026-04-21 04:01:20.642711+00
0a42f97f-2afb-40e8-ab10-b592f1bcefd9	467290c0-3061-4bab-930b-791236a824f1	victoralfredo2498@gmail.com	ADMIN	CREATE	profiles	3afd196c-9675-46d3-8650-76e71563c617	\N	{"id": "3afd196c-9675-46d3-8650-76e71563c617", "dni": "20266234764", "rol": "COMERCIO", "email": "aromito@gmail.com", "rubro": "otro", "estado": "PENDIENTE", "telefono": "3794556677", "municipio": "Capital", "titular_id": null, "nombre_apellido": "EL AROMITO", "password_changed": false}	Gestión Comercios	10.11.0.10	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36	2026-04-21 04:03:18.086197+00
123a4039-2edf-4d5f-9ba8-3bed978a4a49	467290c0-3061-4bab-930b-791236a824f1	victoralfredo2498@gmail.com	ADMIN	UPDATE	profiles	3afd196c-9675-46d3-8650-76e71563c617	{"estado": "PENDIENTE"}	{"estado": "APROBADO"}	Gestión Usuarios	10.11.0.10	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36	2026-04-21 04:03:26.666816+00
cdcb2731-5250-4725-b6a2-e1f6e244746e	1c757b75-8f83-4677-9747-043c4f03a67f	martinalbertosoto85@gmail.com	ADMINISTRADOR | SOCIO	LOGIN_ADMIN	auth.users	1c757b75-8f83-4677-9747-043c4f03a67f	\N	{"roles": ["ADMINISTRADOR", "SOCIO"], "metodo": "email"}	Autenticación Administrativa	10.11.0.10	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Mobile Safari/537.36	2026-04-22 22:49:10.396297+00
ac6db03f-1f01-4be7-8f91-2fdffe518b59	467290c0-3061-4bab-930b-791236a824f1	victoralfredo2498@gmail.com	ADMIN	CREATE	profiles	93d7a43f-21d7-49a5-8794-0e1187dfcc7c	\N	{"id": "93d7a43f-21d7-49a5-8794-0e1187dfcc7c", "dni": "30719119138", "rol": "COMERCIO", "email": "yachipacitos@gmail.com", "rubro": "alimentacion", "estado": "PENDIENTE", "telefono": "3795778899", "municipio": "Capital", "titular_id": null, "nombre_apellido": "YA CHIPASITOS ", "password_changed": false}	Gestión Comercios	10.11.0.10	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36	2026-04-21 04:07:45.26044+00
10cd4908-7d7c-4532-b631-22889efb7a10	467290c0-3061-4bab-930b-791236a824f1	victoralfredo2498@gmail.com	ADMIN	CREATE	profiles	7b7e0daf-741d-4ca7-8ac4-ca7d78ebf8a8	\N	{"id": "7b7e0daf-741d-4ca7-8ac4-ca7d78ebf8a8", "dni": "30714035114", "rol": "COMERCIO", "email": "upalala@gmail.com", "rubro": "otro", "estado": "PENDIENTE", "telefono": "3794445566", "municipio": "Capital", "titular_id": null, "nombre_apellido": "JARDIN UPA LALA", "password_changed": false}	Gestión Comercios	10.11.0.10	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36	2026-04-21 04:10:09.137882+00
793b99b7-707b-4ba2-bbce-854421ef1203	467290c0-3061-4bab-930b-791236a824f1	victoralfredo2498@gmail.com	ADMIN	UPDATE	profiles	7b7e0daf-741d-4ca7-8ac4-ca7d78ebf8a8	{"estado": "PENDIENTE"}	{"estado": "APROBADO"}	Gestión Usuarios	10.11.0.10	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36	2026-04-21 04:10:18.065289+00
1f32a30e-aa8c-404b-b456-db9f59e1aa12	467290c0-3061-4bab-930b-791236a824f1	victoralfredo2498@gmail.com	ADMIN	UPDATE	profiles	93d7a43f-21d7-49a5-8794-0e1187dfcc7c	{"estado": "PENDIENTE"}	{"estado": "APROBADO"}	Gestión Usuarios	10.11.0.10	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36	2026-04-21 04:10:24.051198+00
67659127-8314-4846-8b7c-796826f003ca	467290c0-3061-4bab-930b-791236a824f1	victoralfredo2498@gmail.com	ADMIN	UPDATE	profiles	030556ed-8fbb-4783-9f87-f324a3cd5686	{"estado": "PENDIENTE"}	{"estado": "APROBADO"}	Gestión Usuarios	10.11.0.10	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36	2026-04-21 04:10:26.609937+00
7619fac8-3ae4-41ea-9cc5-a1a49f819ff1	467290c0-3061-4bab-930b-791236a824f1	victoralfredo2498@gmail.com	ADMIN	CREATE	profiles	b4c9f795-d07f-4c08-b8cb-7b20dc08cbd5	\N	{"id": "b4c9f795-d07f-4c08-b8cb-7b20dc08cbd5", "dni": "20085614089", "rol": "COMERCIO", "email": "elbagual@gmail.com", "rubro": "otro", "estado": "PENDIENTE", "telefono": "3794228045", "municipio": "Capital", "titular_id": null, "nombre_apellido": "EL BAGUAL ", "password_changed": false}	Gestión Comercios	10.11.0.10	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36	2026-04-21 04:13:03.668639+00
2181a163-2976-48f9-af19-5f1925377b0e	467290c0-3061-4bab-930b-791236a824f1	victoralfredo2498@gmail.com	ADMIN	UPDATE	profiles	b4c9f795-d07f-4c08-b8cb-7b20dc08cbd5	{"estado": "PENDIENTE"}	{"estado": "APROBADO"}	Gestión Usuarios	10.11.0.10	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36	2026-04-21 04:13:12.763755+00
99b5de9c-dd6c-4bed-a5b4-3c09826f4ea0	467290c0-3061-4bab-930b-791236a824f1	victoralfredo2498@gmail.com	ADMIN	CREATE	profiles	597219dc-9be9-4ab2-a432-16547e174b1a	\N	{"id": "597219dc-9be9-4ab2-a432-16547e174b1a", "dni": "20219980850", "rol": "COMERCIO", "email": "hermes@gmail.com", "rubro": "otro", "estado": "PENDIENTE", "telefono": "3794862601", "municipio": "Capital", "titular_id": null, "nombre_apellido": "HERMES GROUP", "password_changed": false}	Gestión Comercios	10.11.0.10	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36	2026-04-21 04:17:26.635428+00
1faa6030-b213-4532-abad-a14c88163c89	467290c0-3061-4bab-930b-791236a824f1	victoralfredo2498@gmail.com	ADMIN	UPDATE	profiles	597219dc-9be9-4ab2-a432-16547e174b1a	{"estado": "PENDIENTE"}	{"estado": "APROBADO"}	Gestión Usuarios	10.11.0.10	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36	2026-04-21 04:17:34.837949+00
d2b56891-90b4-4008-b24f-860280c5c435	467290c0-3061-4bab-930b-791236a824f1	victoralfredo2498@gmail.com	ADMIN	CREATE	profiles	23c2224d-0aae-4fae-81ba-ed79cb3bbbe2	\N	{"id": "23c2224d-0aae-4fae-81ba-ed79cb3bbbe2", "dni": "20283030416", "rol": "COMERCIO", "email": "acerocorrientes@gmail.com", "rubro": "otro", "estado": "PENDIENTE", "telefono": "3795108390", "municipio": "Capital", "titular_id": null, "nombre_apellido": "ACERO CORRIENTES ", "password_changed": false}	Gestión Comercios	10.11.0.10	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36	2026-04-21 04:19:27.816744+00
0f64f2c8-541b-4a06-92d6-29db7b275b51	467290c0-3061-4bab-930b-791236a824f1	victoralfredo2498@gmail.com	ADMIN	UPDATE	profiles	23c2224d-0aae-4fae-81ba-ed79cb3bbbe2	{"estado": "PENDIENTE"}	{"estado": "APROBADO"}	Gestión Usuarios	10.11.0.10	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36	2026-04-21 04:19:35.818324+00
4714cf5d-6911-41f9-853c-e566b947c64a	467290c0-3061-4bab-930b-791236a824f1	victoralfredo2498@gmail.com	SUPERADMIN | SOCIO	LOGIN_ADMIN	auth.users	467290c0-3061-4bab-930b-791236a824f1	\N	{"roles": ["SUPERADMIN", "SOCIO"], "metodo": "email"}	Autenticación Administrativa	10.11.0.10	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36	2026-04-22 12:11:30.000033+00
979004c0-9d3d-4cad-972e-4ced98728f41	467290c0-3061-4bab-930b-791236a824f1	victoralfredo2498@gmail.com	ADMIN	UPDATE	profiles	23c2224d-0aae-4fae-81ba-ed79cb3bbbe2	{"estado": "APROBADO"}	{"estado": "SUSPENDIDO"}	Gestión Usuarios	10.11.0.10	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36	2026-04-22 12:16:49.24529+00
e0d3342e-40a5-434e-be96-bdadaf1eba98	467290c0-3061-4bab-930b-791236a824f1	victoralfredo2498@gmail.com	ADMIN	UPDATE	profiles	23c2224d-0aae-4fae-81ba-ed79cb3bbbe2	{"estado": "SUSPENDIDO"}	{"estado": "APROBADO"}	Gestión Usuarios	10.11.0.10	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36	2026-04-22 12:16:52.137476+00
625bb639-cb48-48f2-b83c-fef0ebad9933	467290c0-3061-4bab-930b-791236a824f1	victoralfredo2498@gmail.com	ADMIN	CREATE	eventos	2ee1a99a-abab-43a7-a94a-6da572f107ad	\N	{"hora": "21:30", "tipo": "Otro", "fecha": "2026-05-09", "lugar": "Teatro Vera", "titulo": "Los Tipitos", "imagen_url": "https://teatrovera.com/images/2026-05-09_los-tipitos.jpeg", "descripcion": "Teatro Oficial Juan de Vera"}	Gestión Eventos	10.11.0.10	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36	2026-04-22 12:32:09.329748+00
09187484-a52c-4f47-9e01-317b92aed150	467290c0-3061-4bab-930b-791236a824f1	victoralfredo2498@gmail.com	ADMIN	UPDATE	eventos	2ee1a99a-abab-43a7-a94a-6da572f107ad	{"id": "2ee1a99a-abab-43a7-a94a-6da572f107ad", "hora": "21:30:00", "tipo": "Otro", "fecha": "2026-05-09", "lugar": "Teatro Vera", "titulo": "Los Tipitos", "municipio": null, "created_at": "2026-04-22T12:32:09.00978+00:00", "imagen_url": "https://teatrovera.com/images/2026-05-09_los-tipitos.jpeg", "descripcion": "Teatro Oficial Juan de Vera"}	{"hora": "21:30:00", "tipo": "Otro", "fecha": "2026-05-09", "lugar": "Teatro Vera", "titulo": "Los Tipitos", "imagen_url": "https://teatrovera.com/images/2026-05-09_los-tipitos.jpeg", "descripcion": "Teatro Oficial Juan de Vera, Vení a disfrutar de un espectáculo inolvidable A TODO ROCK!"}	Gestión Eventos	10.11.0.10	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36	2026-04-22 12:35:33.758919+00
14507b3e-c2cb-4717-a7ad-fa670616c174	1c757b75-8f83-4677-9747-043c4f03a67f	martinalbertosoto85@gmail.com	\N	UPDATE	profiles	1c757b75-8f83-4677-9747-043c4f03a67f	\N	{"password_changed": true}	Seguridad	10.11.0.10	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Mobile Safari/537.36	2026-04-22 22:50:03.147449+00
e7bf3bdb-8567-477d-91a5-50435795b84b	467290c0-3061-4bab-930b-791236a824f1	victoralfredo2498@gmail.com	ADMIN	CREATE	eventos	07911c81-cf04-4682-9eea-89fbcc3bc241	\N	{"hora": "20:00", "tipo": "Remate", "fecha": "2026-04-25", "lugar": "Predio feria de gatos", "titulo": "Gran remate de gatos", "imagen_url": "https://teatrovera.com/images/2026-05-09_los-tipitos.jpeg", "descripcion": "Altos gatos!"}	Gestión Eventos	10.11.0.10	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36	2026-04-22 12:40:12.338293+00
6ddce832-01bb-4824-953e-5c031d770e91	467290c0-3061-4bab-930b-791236a824f1	victoralfredo2498@gmail.com	ADMIN	DELETE	eventos	07911c81-cf04-4682-9eea-89fbcc3bc241	{"id": "07911c81-cf04-4682-9eea-89fbcc3bc241", "hora": "20:00:00", "tipo": "Remate", "fecha": "2026-04-25", "lugar": "Predio feria de gatos", "titulo": "Gran remate de gatos", "municipio": null, "created_at": "2026-04-22T12:40:11.740371+00:00", "imagen_url": "https://teatrovera.com/images/2026-05-09_los-tipitos.jpeg", "descripcion": "Altos gatos!"}	\N	Gestión Eventos	10.11.0.10	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36	2026-04-22 12:40:21.265401+00
74d5ce43-1d14-47b2-a8cd-0fe7c2cea7d3	467290c0-3061-4bab-930b-791236a824f1	victoralfredo2498@gmail.com	SUPERADMIN	CREATE_ADMIN	auth.users	cf8520c2-c9b3-40e5-8a7f-f05aabed49e5	\N	{"id": "cf8520c2-c9b3-40e5-8a7f-f05aabed49e5", "dni": "31435523", "rol": "ADMIN", "email": "caar@gmail.com", "estado": "APROBADO", "username": "martin_soto", "nombre_apellido": "Martín Alberto Soto", "password_changed": true}	Gestión de Administradores	10.11.0.10	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36	2026-04-22 13:15:40.87761+00
8876935b-64ff-4c8c-9c4e-b125869e9f5a	467290c0-3061-4bab-930b-791236a824f1	victoralfredo2498@gmail.com	SUPERADMIN	UPDATE	auth.users (Password)	cf8520c2-c9b3-40e5-8a7f-f05aabed49e5	\N	{"password_reset": true}	Gestión Usuarios	10.11.0.10	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36	2026-04-22 13:16:54.964954+00
1045e018-1294-4e82-b595-0d3c5804eeca	467290c0-3061-4bab-930b-791236a824f1	victoralfredo2498@gmail.com	ADMIN	UPDATE	profiles	cf8520c2-c9b3-40e5-8a7f-f05aabed49e5	{"estado": "APROBADO"}	{"estado": "SUSPENDIDO"}	Gestión Usuarios	10.11.0.10	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36	2026-04-22 13:17:13.091983+00
4cc48376-4c8b-464f-abba-800bc8abe20b	467290c0-3061-4bab-930b-791236a824f1	victoralfredo2498@gmail.com	SUPERADMIN	DELETE_ADMIN	auth.users	cf8520c2-c9b3-40e5-8a7f-f05aabed49e5	{"id": "cf8520c2-c9b3-40e5-8a7f-f05aabed49e5", "dni": "31435523", "rol": "ADMIN", "cuit": null, "email": "caar@gmail.com", "rubro": null, "estado": "SUSPENDIDO", "motivo": null, "foto_url": null, "telefono": null, "username": "martin_soto", "direccion": null, "municipio": null, "provincia": null, "created_at": "2026-04-22T13:15:40.124643+00:00", "titular_id": null, "updated_at": "2026-04-22T13:17:12.82471+00:00", "tipo_vinculo": null, "es_profesional": false, "nombre_apellido": "Martín Alberto Soto", "camara_provincia": null, "password_changed": false, "estado_aprobacion": "PENDIENTE", "camara_denominacion": null}	\N	Gestión de Administradores	10.11.0.10	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36	2026-04-22 13:17:23.483992+00
f2d640c6-9add-4331-8e7e-a193141301a8	467290c0-3061-4bab-930b-791236a824f1	victoralfredo2498@gmail.com	SUPERADMIN	CREATE_ADMIN	auth.users	818bcbaa-a61d-4828-87f5-6349d6238241	\N	{"id": "818bcbaa-a61d-4828-87f5-6349d6238241", "dni": "31435523", "rol": "ADMIN", "email": "caarcorrientes@gmail.com", "estado": "APROBADO", "username": "martin_soto", "nombre_apellido": "Martín Alberto Soto", "password_changed": true}	Gestión de Administradores	10.11.0.10	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36	2026-04-22 13:18:57.104521+00
f50a94b6-b595-4166-86e8-347fd4bf6c82	467290c0-3061-4bab-930b-791236a824f1	victoralfredo2498@gmail.com	SUPERADMIN | SOCIO	LOGIN_ADMIN	auth.users	467290c0-3061-4bab-930b-791236a824f1	\N	{"roles": ["SUPERADMIN", "SOCIO"], "metodo": "email"}	Autenticación Administrativa	10.11.0.10	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36	2026-04-22 13:36:54.406861+00
054b32f5-bbb2-4ded-b58d-b9482adbef41	467290c0-3061-4bab-930b-791236a824f1	victoralfredo2498@gmail.com	SUPERADMIN	DELETE_ADMIN	auth.users	818bcbaa-a61d-4828-87f5-6349d6238241	{"id": "818bcbaa-a61d-4828-87f5-6349d6238241", "dni": "31435523", "rol": "ADMIN", "cuit": null, "email": "caarcorrientes@gmail.com", "rubro": null, "estado": "APROBADO", "motivo": null, "foto_url": null, "telefono": null, "username": "martin_soto", "direccion": null, "municipio": null, "provincia": null, "created_at": "2026-04-22T13:18:56.366536+00:00", "titular_id": null, "updated_at": "2026-04-22T13:18:56.366536+00:00", "tipo_vinculo": null, "es_profesional": false, "nombre_apellido": "Martín Alberto Soto", "camara_provincia": null, "password_changed": true, "estado_aprobacion": "PENDIENTE", "camara_denominacion": null}	\N	Gestión de Administradores	10.11.0.10	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36	2026-04-22 13:37:30.151234+00
2009c243-a491-429f-81ce-fc5bed008838	467290c0-3061-4bab-930b-791236a824f1	victoralfredo2498@gmail.com	SUPERADMIN	CREATE_ADMIN	auth.users	1c757b75-8f83-4677-9747-043c4f03a67f	\N	{"id": "1c757b75-8f83-4677-9747-043c4f03a67f", "dni": "31435523", "rol": "ADMIN", "email": "martinalbertosoto85@gmail.com", "estado": "APROBADO", "username": "martin_alberto", "nombre_apellido": "Martín Alberto Soto", "password_changed": true}	Gestión de Administradores	10.11.0.10	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36	2026-04-22 13:39:44.964052+00
9d712894-e8b0-412c-ab7b-69601f6fcb43	0b237844-2bbc-4060-b733-9ff1bc735683	fabian@gmail.com	SOCIO	CREATE	profiles	0b237844-2bbc-4060-b733-9ff1bc735683	\N	{"id": "0b237844-2bbc-4060-b733-9ff1bc735683", "dni": "32854766", "rol": "SOCIO", "email": "fabian@gmail.com", "rubro": null, "estado": "PENDIENTE", "telefono": "3644359401", "direccion": null, "municipio": "Capital", "provincia": "Corrientes", "es_profesional": false, "nombre_apellido": "Fabian Emmanuel Gómez", "password_changed": false}	Registro Cuentas	10.11.0.10	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36	2026-04-22 20:25:10.342697+00
3d2084ad-f814-4042-bac7-fb8b29cbb1c7	467290c0-3061-4bab-930b-791236a824f1	victoralfredo2498@gmail.com	SUPERADMIN | SOCIO	LOGIN_ADMIN	auth.users	467290c0-3061-4bab-930b-791236a824f1	\N	{"roles": ["SUPERADMIN", "SOCIO"], "metodo": "email"}	Autenticación Administrativa	10.11.0.10	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36	2026-04-22 20:25:38.540376+00
9d81bc63-4f8f-4d07-9249-44d6d98d951e	467290c0-3061-4bab-930b-791236a824f1	victoralfredo2498@gmail.com	ADMIN	UPDATE	profiles	0b237844-2bbc-4060-b733-9ff1bc735683	{"estado": "PENDIENTE"}	{"estado": "APROBADO"}	Gestión Usuarios	10.11.0.10	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36	2026-04-22 20:25:47.782523+00
3869a7a5-7d98-4e13-ad02-cc7b505fd183	0b237844-2bbc-4060-b733-9ff1bc735683	fabian@gmail.com	\N	UPDATE	profiles	0b237844-2bbc-4060-b733-9ff1bc735683	\N	{"password_changed": true}	Seguridad	10.11.0.10	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36	2026-04-22 20:26:56.742307+00
828d635d-5059-4813-ae1f-31d72d89b343	467290c0-3061-4bab-930b-791236a824f1	victoralfredo2498@gmail.com	SUPERADMIN | SOCIO	LOGIN_ADMIN	auth.users	467290c0-3061-4bab-930b-791236a824f1	\N	{"roles": ["SUPERADMIN", "SOCIO"], "metodo": "email"}	Autenticación Administrativa	10.11.0.10	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36	2026-04-22 21:07:10.600419+00
ae8ddf31-a8b4-41b6-a7fa-122737ecc1d8	1c757b75-8f83-4677-9747-043c4f03a67f	martinalbertosoto85@gmail.com	ADMINISTRADOR | SOCIO	LOGIN_ADMIN	auth.users	1c757b75-8f83-4677-9747-043c4f03a67f	\N	{"roles": ["ADMINISTRADOR", "SOCIO"], "metodo": "email"}	Autenticación Administrativa	10.11.0.10	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Mobile Safari/537.36	2026-04-22 22:50:38.866594+00
68c8186d-2074-475a-9377-3bcbc2229365	1c757b75-8f83-4677-9747-043c4f03a67f	martinalbertosoto85@gmail.com	ADMINISTRADOR | SOCIO	LOGIN_ADMIN	auth.users	1c757b75-8f83-4677-9747-043c4f03a67f	\N	{"roles": ["ADMINISTRADOR", "SOCIO"], "metodo": "email"}	Autenticación Administrativa	10.11.0.10	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Mobile Safari/537.36	2026-04-22 22:51:23.296214+00
6dc4c04a-dec0-4f58-9e93-1f0423925d68	1c757b75-8f83-4677-9747-043c4f03a67f	martinalbertosoto85@gmail.com	ADMINISTRADOR | SOCIO	LOGIN_ADMIN	auth.users	1c757b75-8f83-4677-9747-043c4f03a67f	\N	{"roles": ["ADMINISTRADOR", "SOCIO"], "metodo": "email"}	Autenticación Administrativa	10.11.0.10	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Mobile Safari/537.36	2026-04-22 22:52:21.271047+00
47b66c05-e157-4300-a4ab-7e29ae41364a	467290c0-3061-4bab-930b-791236a824f1	victoralfredo2498@gmail.com	SUPERADMIN | SOCIO	LOGIN_ADMIN	auth.users	467290c0-3061-4bab-930b-791236a824f1	\N	{"roles": ["SUPERADMIN", "SOCIO"], "metodo": "email"}	Autenticación Administrativa	10.11.0.10	Mozilla/5.0 (Linux; Android 16; SM-A065M Build/BP2A.250605.031.A3; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/146.0.7680.178 Mobile Safari/537.36	2026-04-22 23:21:46.166425+00
0872f130-55ca-4bda-9ab0-7a09cbd8173d	467290c0-3061-4bab-930b-791236a824f1	victoralfredo2498@gmail.com	SUPERADMIN | SOCIO	LOGIN_ADMIN	auth.users	467290c0-3061-4bab-930b-791236a824f1	\N	{"roles": ["SUPERADMIN", "SOCIO"], "metodo": "email"}	Autenticación Administrativa	10.11.0.10	Mozilla/5.0 (Linux; Android 16; SM-A065M Build/BP2A.250605.031.A3; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/146.0.7680.178 Mobile Safari/537.36	2026-04-23 00:01:19.055586+00
ab60f698-515b-477b-835b-85bbe87b2c15	1d7debff-367c-457d-a194-0fe974e93e0f	oscar@gmail.com	SOCIO	CREATE	profiles	1d7debff-367c-457d-a194-0fe974e93e0f	\N	{"id": "1d7debff-367c-457d-a194-0fe974e93e0f", "dni": "20456789", "rol": "SOCIO", "email": "oscar@gmail.com", "rubro": null, "estado": "PENDIENTE", "telefono": "3777667788", "direccion": null, "municipio": "Capital", "provincia": "Corrientes", "es_profesional": true, "nombre_apellido": "Oscar Peralta", "password_changed": false}	Registro Cuentas	10.11.0.10	Mozilla/5.0 (Linux; Android 16; SM-A065M Build/BP2A.250605.031.A3; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/146.0.7680.178 Mobile Safari/537.36	2026-04-23 09:34:22.281296+00
4f794f00-eb6a-481c-8f40-d79357bcf72f	467290c0-3061-4bab-930b-791236a824f1	victoralfredo2498@gmail.com	SUPERADMIN | SOCIO	LOGIN_ADMIN	auth.users	467290c0-3061-4bab-930b-791236a824f1	\N	{"roles": ["SUPERADMIN", "SOCIO"], "metodo": "email"}	Autenticación Administrativa	10.11.0.10	Mozilla/5.0 (Linux; Android 16; SM-A065M Build/BP2A.250605.031.A3; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/146.0.7680.178 Mobile Safari/537.36	2026-04-23 09:35:30.514675+00
30e35690-7ed8-40b3-b77b-9d1166fe58d2	467290c0-3061-4bab-930b-791236a824f1	victoralfredo2498@gmail.com	ADMIN	UPDATE	profiles	1d7debff-367c-457d-a194-0fe974e93e0f	{"estado": "PENDIENTE"}	{"estado": "APROBADO"}	Gestión Usuarios	10.11.0.10	Mozilla/5.0 (Linux; Android 16; SM-A065M Build/BP2A.250605.031.A3; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/146.0.7680.178 Mobile Safari/537.36	2026-04-23 09:35:53.931411+00
4fd3c996-1ed5-485f-90b2-628a95f03b2b	1d7debff-367c-457d-a194-0fe974e93e0f	oscar@gmail.com	\N	UPDATE	profiles	1d7debff-367c-457d-a194-0fe974e93e0f	\N	{"password_changed": true}	Seguridad	10.11.0.10	Mozilla/5.0 (Linux; Android 16; SM-A065M Build/BP2A.250605.031.A3; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/146.0.7680.178 Mobile Safari/537.36	2026-04-23 09:37:27.786207+00
7fa37c11-5e06-4a2a-97d9-2ee60334f037	\N	\N	\N	DROP_ORPHAN_TABLE	usuarios	\N	{"id": "467290c0-3061-4bab-930b-791236a824f1", "rol": "superadmin", "email": "victoralfredo2498@gmail.com", "activo": true, "nombre": "Super Administrador", "telefono": null, "creado_en": "2026-04-17T04:57:01.238715+00:00", "viajes_gratis": 0, "organizacion_id": "00000000-0000-0000-0000-000000000000", "puntos_actuales": 0}	\N	Auditoría - Limpieza tablas huérfanas Remiseria-Nea	\N	\N	2026-04-23 22:25:07.443215+00
c996fd41-bff1-4378-bd8d-029f655cf4db	\N	\N	\N	DROP_ORPHAN_TABLE	usuarios	\N	{"id": "ea1dc95f-f956-46aa-807e-433529761a17", "rol": "superadmin", "email": "supermercadodia@gmail.com", "activo": true, "nombre": "SuperAdmin Maestro", "telefono": null, "creado_en": "2026-04-17T17:11:49.612053+00:00", "viajes_gratis": 0, "organizacion_id": "00000000-0000-0000-0000-000000000000", "puntos_actuales": 0}	\N	Auditoría - Limpieza tablas huérfanas Remiseria-Nea	\N	\N	2026-04-23 22:25:07.443215+00
3306bf6d-6254-4a47-bac0-4548e187b762	cbabe169-276e-45a4-966b-f26d835c6042	riq@gmail.com	SOCIO	CREATE	profiles	cbabe169-276e-45a4-966b-f26d835c6042	\N	{"id": "cbabe169-276e-45a4-966b-f26d835c6042", "dni": "25143698", "rol": "SOCIO", "email": "riq@gmail.com", "rubro": null, "barrio": null, "estado": "PENDIENTE", "telefono": "+543794330172", "direccion": null, "municipio": "Capital", "provincia": "Corrientes", "es_profesional": false, "nombre_apellido": "Ruben Riquelme", "password_changed": false}	Registro Cuentas	10.11.0.10	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Mobile Safari/537.36	2026-04-23 22:50:28.127779+00
0cb22735-5a93-42b7-852b-615add825a90	a10fd2d5-73ce-474f-b7df-6782fabd6fa4	julian@gmail.com	SOCIO	CREATE	profiles	a10fd2d5-73ce-474f-b7df-6782fabd6fa4	\N	{"id": "a10fd2d5-73ce-474f-b7df-6782fabd6fa4", "dni": "732735", "rol": "SOCIO", "email": "julian@gmail.com", "rubro": null, "barrio": "Corrientes", "estado": "PENDIENTE", "telefono": "42156378", "direccion": null, "municipio": "Itatí", "provincia": "Corrientes", "es_profesional": false, "nombre_apellido": "Julian Weich", "password_changed": false}	Registro Cuentas	10.11.0.10	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36	2026-04-24 01:51:19.812037+00
bfaecec3-de66-4a0c-8318-f4c476521630	467290c0-3061-4bab-930b-791236a824f1	victoralfredo2498@gmail.com	SUPERADMIN | SOCIO	LOGIN_ADMIN	auth.users	467290c0-3061-4bab-930b-791236a824f1	\N	{"roles": ["SUPERADMIN", "SOCIO"], "metodo": "email"}	Autenticación Administrativa	10.11.0.10	Mozilla/5.0 (Linux; Android 16; SM-A065M Build/BP2A.250605.031.A3; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/147.0.7727.55 Mobile Safari/537.36	2026-04-24 01:58:46.23744+00
ba74cacf-26e3-49c9-9e89-6272420c37cb	467290c0-3061-4bab-930b-791236a824f1	victoralfredo2498@gmail.com	SUPERADMIN | SOCIO	LOGIN_ADMIN	auth.users	467290c0-3061-4bab-930b-791236a824f1	\N	{"roles": ["SUPERADMIN", "SOCIO"], "metodo": "email"}	Autenticación Administrativa	10.11.0.10	Mozilla/5.0 (Linux; Android 16; SM-A065M Build/BP2A.250605.031.A3; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/147.0.7727.55 Mobile Safari/537.36	2026-04-24 02:36:07.524612+00
34070de3-c9cb-4aef-be2e-059537eb4724	467290c0-3061-4bab-930b-791236a824f1	victoralfredo2498@gmail.com	SUPERADMIN | SOCIO	LOGIN_ADMIN	auth.users	467290c0-3061-4bab-930b-791236a824f1	\N	{"roles": ["SUPERADMIN", "SOCIO"], "metodo": "email"}	Autenticación Administrativa	10.11.0.10	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36	2026-04-24 04:26:24.475444+00
d91815f6-9e62-4edd-a5b7-a213e6bf9732	467290c0-3061-4bab-930b-791236a824f1	victoralfredo2498@gmail.com	SUPERADMIN | SOCIO	LOGIN_ADMIN	auth.users	467290c0-3061-4bab-930b-791236a824f1	\N	{"roles": ["SUPERADMIN", "SOCIO"], "metodo": "email"}	Autenticación Administrativa	10.11.0.10	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36	2026-04-25 19:40:13.379662+00
8f9eabe2-1370-4121-b199-ad8cd6fd7b98	467290c0-3061-4bab-930b-791236a824f1	victoralfredo2498@gmail.com	ADMIN	DELETE	auth.users / profiles	a10fd2d5-73ce-474f-b7df-6782fabd6fa4	{"id": "a10fd2d5-73ce-474f-b7df-6782fabd6fa4", "dni": "732735", "rol": "SOCIO", "cuit": null, "email": "julian@gmail.com", "rubro": null, "barrio": "Corrientes", "estado": "PENDIENTE", "motivo": null, "foto_url": null, "telefono": "42156378", "username": null, "direccion": null, "municipio": "Itatí", "provincia": "Corrientes", "created_at": "2026-04-24T01:51:19.041621+00:00", "titular_id": null, "updated_at": "2026-04-24T01:51:19.041621+00:00", "numero_socio": null, "tipo_vinculo": null, "es_profesional": false, "nombre_apellido": "Julian Weich", "camara_provincia": null, "password_changed": false, "estado_aprobacion": "PENDIENTE", "camara_denominacion": null, "sonido_notificaciones_habilitado": true}	\N	Gestión Usuarios	10.11.0.10	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36	2026-04-24 04:26:39.388024+00
bf1fa42e-bd7a-408c-b8d5-0c4a9956c743	467290c0-3061-4bab-930b-791236a824f1	victoralfredo2498@gmail.com	ADMIN	UPDATE	profiles	0b237844-2bbc-4060-b733-9ff1bc735683	{"id": "0b237844-2bbc-4060-b733-9ff1bc735683", "dni": "32854766", "rol": "SOCIO", "cuit": null, "email": "fabian@gmail.com", "rubro": null, "barrio": null, "estado": "APROBADO", "motivo": null, "foto_url": null, "telefono": "3644359401", "username": null, "direccion": null, "municipio": "Capital", "provincia": "Corrientes", "created_at": "2026-04-22T20:25:09.968717+00:00", "titular_id": null, "updated_at": "2026-04-24T02:20:16.781928+00:00", "numero_socio": "0001", "tipo_vinculo": null, "es_profesional": false, "nombre_apellido": "Fabian Emmanuel Gómez", "camara_provincia": null, "password_changed": true, "estado_aprobacion": "PENDIENTE", "camara_denominacion": null, "sonido_notificaciones_habilitado": true}	{"email": "fabian@gmail.com.ar", "telefono": "3644359401", "municipio": "Capital", "nombre_apellido": "Fabian Emmanuel Gómez"}	Gestión Usuarios	10.11.0.10	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36	2026-04-24 04:27:04.976239+00
f92bbbee-01fc-474f-9ff7-af67d7c88d97	467290c0-3061-4bab-930b-791236a824f1	victoralfredo2498@gmail.com	SUPERADMIN | SOCIO	LOGIN_ADMIN	auth.users	467290c0-3061-4bab-930b-791236a824f1	\N	{"roles": ["SUPERADMIN", "SOCIO"], "metodo": "email"}	Autenticación Administrativa	10.11.0.10	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36	2026-04-24 04:27:38.738782+00
8b647940-f4c5-463a-9f8b-332091322cdf	467290c0-3061-4bab-930b-791236a824f1	victoralfredo2498@gmail.com	ADMIN	DELETE	auth.users / profiles	cbabe169-276e-45a4-966b-f26d835c6042	{"id": "cbabe169-276e-45a4-966b-f26d835c6042", "dni": "25143698", "rol": "SOCIO", "cuit": null, "email": "riq@gmail.com", "rubro": null, "barrio": null, "estado": "PENDIENTE", "motivo": null, "foto_url": null, "telefono": "+543794330172", "username": null, "direccion": null, "municipio": "Capital", "provincia": "Corrientes", "created_at": "2026-04-23T22:50:27.406162+00:00", "titular_id": null, "updated_at": "2026-04-24T04:27:51.668646+00:00", "numero_socio": null, "tipo_vinculo": null, "es_profesional": false, "nombre_apellido": "Ruben Riquelme", "camara_provincia": null, "password_changed": false, "estado_aprobacion": "PENDIENTE", "camara_denominacion": null, "sonido_notificaciones_habilitado": true}	\N	Gestión Usuarios	10.11.0.10	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36	2026-04-24 04:28:01.046112+00
5f770c73-9fad-4520-b7f8-43dfc6148c91	467290c0-3061-4bab-930b-791236a824f1	victoralfredo2498@gmail.com	ADMIN	DELETE	auth.users / profiles	1d7debff-367c-457d-a194-0fe974e93e0f	{"id": "1d7debff-367c-457d-a194-0fe974e93e0f", "dni": "20456789", "rol": "SOCIO", "cuit": null, "email": "oscar@gmail.com", "rubro": null, "barrio": null, "estado": "APROBADO", "motivo": null, "foto_url": null, "telefono": "3777667788", "username": null, "direccion": null, "municipio": "Capital", "provincia": "Corrientes", "created_at": "2026-04-23T09:34:21.930699+00:00", "titular_id": null, "updated_at": "2026-04-24T02:20:16.781928+00:00", "numero_socio": "0002", "tipo_vinculo": null, "es_profesional": true, "nombre_apellido": "Oscar Peralta", "camara_provincia": null, "password_changed": true, "estado_aprobacion": "PENDIENTE", "camara_denominacion": null, "sonido_notificaciones_habilitado": true}	\N	Gestión Usuarios	10.11.0.10	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36	2026-04-24 04:26:47.885494+00
e6a09dc2-65c7-4976-9ae6-8dc989d39bdb	467290c0-3061-4bab-930b-791236a824f1	victoralfredo2498@gmail.com	SUPERADMIN	UPDATE	auth.users (Password)	cbabe169-276e-45a4-966b-f26d835c6042	\N	{"password_reset": true}	Gestión Usuarios	10.11.0.10	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36	2026-04-24 04:27:51.887294+00
1fa66640-713e-435e-8abf-e8cff3bc1ac8	467290c0-3061-4bab-930b-791236a824f1	victoralfredo2498@gmail.com	ADMIN	DELETE	auth.users / profiles	0b237844-2bbc-4060-b733-9ff1bc735683	{"id": "0b237844-2bbc-4060-b733-9ff1bc735683", "dni": "32854766", "rol": "SOCIO", "cuit": null, "email": "fabian@gmail.com.ar", "rubro": null, "barrio": null, "estado": "APROBADO", "motivo": null, "foto_url": null, "telefono": "3644359401", "username": null, "direccion": null, "municipio": "Capital", "provincia": "Corrientes", "created_at": "2026-04-22T20:25:09.968717+00:00", "titular_id": null, "updated_at": "2026-04-24T04:27:04.699056+00:00", "numero_socio": "0001", "tipo_vinculo": null, "es_profesional": false, "nombre_apellido": "Fabian Emmanuel Gómez", "camara_provincia": null, "password_changed": true, "estado_aprobacion": "PENDIENTE", "camara_denominacion": null, "sonido_notificaciones_habilitado": true}	\N	Gestión Usuarios	10.11.0.10	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36	2026-04-24 04:28:09.830825+00
738c9b95-4b4a-4033-a90b-d4431b477bd7	2a1039a2-be04-42e1-a654-6e67de053dd9	flormac@gmail.com	SOCIO	CREATE	profiles	2a1039a2-be04-42e1-a654-6e67de053dd9	\N	{"id": "2a1039a2-be04-42e1-a654-6e67de053dd9", "dni": "31759747", "rol": "SOCIO", "email": "flormac@gmail.com", "rubro": null, "barrio": "Centro", "estado": "PENDIENTE", "telefono": "3794330172", "direccion": null, "municipio": "Capital", "provincia": "Corrientes", "es_profesional": true, "nombre_apellido": "Florencia Maciel", "password_changed": false}	Registro Cuentas	10.11.0.10	Mozilla/5.0 (Linux; Android 16; SM-A065M Build/BP2A.250605.031.A3; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/147.0.7727.55 Mobile Safari/537.36	2026-04-24 04:34:57.178763+00
71dd8b04-7845-4d2c-abcf-4ab33e239e86	467290c0-3061-4bab-930b-791236a824f1	victoralfredo2498@gmail.com	ADMIN	UPDATE	profiles	2a1039a2-be04-42e1-a654-6e67de053dd9	{"estado": "PENDIENTE"}	{"estado": "APROBADO"}	Gestión Usuarios	10.11.0.10	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36	2026-04-24 04:35:56.8666+00
d47016e9-955c-4472-ba26-0435cc083bbf	2a1039a2-be04-42e1-a654-6e67de053dd9	flormac@gmail.com	\N	UPDATE	profiles	2a1039a2-be04-42e1-a654-6e67de053dd9	\N	{"password_changed": true}	Seguridad	10.11.0.10	Mozilla/5.0 (Linux; Android 16; SM-A065M Build/BP2A.250605.031.A3; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/147.0.7727.55 Mobile Safari/537.36	2026-04-24 04:37:09.168029+00
3386f0be-f835-475d-bf61-595f76510584	467290c0-3061-4bab-930b-791236a824f1	victoralfredo2498@gmail.com	ADMIN	CREATE	eventos	4cb24d00-f164-47c1-a96f-38a7399ac052	\N	{"hora": "08:30", "tipo": "Remate", "fecha": "2026-04-24", "lugar": "Predio San Cosme", "titulo": "Gran Remate Ganadero ", "imagen_url": "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRsZiWXKDovtElvllA5xH3sr6YkW0T7mfNzGA&s", "descripcion": "No se suspende por lluvia eh..."}	Gestión Eventos	10.11.0.10	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36	2026-04-24 04:44:00.757097+00
a5b6f7f3-138f-4679-b1a7-849f5b8aa00a	467290c0-3061-4bab-930b-791236a824f1	victoralfredo2498@gmail.com	ADMIN	UPDATE	eventos	2ee1a99a-abab-43a7-a94a-6da572f107ad	{"id": "2ee1a99a-abab-43a7-a94a-6da572f107ad", "hora": "21:30:00", "tipo": "Otro", "fecha": "2026-05-09", "lugar": "Teatro Vera", "titulo": "Los Tipitos", "municipio": null, "created_at": "2026-04-22T12:32:09.00978+00:00", "imagen_url": "https://teatrovera.com/images/2026-05-09_los-tipitos.jpeg", "descripcion": "Teatro Oficial Juan de Vera, Vení a disfrutar de un espectáculo inolvidable A TODO ROCK!"}	{"hora": "21:30:00", "tipo": "Otro", "fecha": "2026-05-09", "lugar": "Capital Corrientes", "titulo": "Los Tipitos", "imagen_url": "https://teatrovera.com/images/2026-05-09_los-tipitos.jpeg", "descripcion": "Teatro Oficial Juan de Vera, Vení a disfrutar de un espectáculo inolvidable A TODO ROCK!"}	Gestión Eventos	10.11.0.10	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36	2026-04-24 04:52:26.14293+00
d2c7711c-f0da-4bcf-92b3-3dc13875a68e	2a1039a2-be04-42e1-a654-6e67de053dd9	flormac@gmail.com	\N	UPDATE	profiles	2a1039a2-be04-42e1-a654-6e67de053dd9	{"id": "2a1039a2-be04-42e1-a654-6e67de053dd9", "dni": "31759747", "rol": "SOCIO", "cuit": null, "email": "flormac@gmail.com", "rubro": null, "barrio": "Centro", "estado": "APROBADO", "motivo": null, "foto_url": null, "telefono": "3794330172", "username": null, "direccion": null, "municipio": "Capital", "provincia": "Corrientes", "created_at": "2026-04-24T04:34:56.925925+00:00", "titular_id": null, "updated_at": "2026-04-24T04:40:23.078591+00:00", "numero_socio": "0001", "tipo_vinculo": null, "es_profesional": true, "nombre_apellido": "Florencia Maciel", "camara_provincia": null, "password_changed": true, "estado_aprobacion": "PENDIENTE", "camara_denominacion": null, "sonido_notificaciones_habilitado": true}	{"email": "flormac@gmail.com", "barrio": "Centro", "telefono": "3794330172", "direccion": "", "municipio": "Capital"}	Perfil	10.11.0.10	Mozilla/5.0 (Linux; Android 16; SM-A065M Build/BP2A.250605.031.A3; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/147.0.7727.55 Mobile Safari/537.36	2026-04-24 05:31:20.666903+00
a59f3a3d-d25d-4a05-b02d-fbc8d6a5738c	467290c0-3061-4bab-930b-791236a824f1	victoralfredo2498@gmail.com	SUPERADMIN | SOCIO	LOGIN_ADMIN	auth.users	467290c0-3061-4bab-930b-791236a824f1	\N	{"roles": ["SUPERADMIN", "SOCIO"], "metodo": "email"}	Autenticación Administrativa	10.11.0.10	Mozilla/5.0 (Linux; Android 16; SM-A065M Build/BP2A.250605.031.A3; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/147.0.7727.55 Mobile Safari/537.36	2026-04-24 09:57:58.833094+00
a62d26aa-c7fa-4fc0-a683-023ee4a27e56	1c757b75-8f83-4677-9747-043c4f03a67f	martinalbertosoto85@gmail.com	ADMINISTRADOR | SOCIO	LOGIN_ADMIN	auth.users	1c757b75-8f83-4677-9747-043c4f03a67f	\N	{"roles": ["ADMINISTRADOR", "SOCIO"], "metodo": "email"}	Autenticación Administrativa	10.11.0.10	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Mobile Safari/537.36	2026-04-24 22:23:42.792858+00
dc18d859-b8bd-4dc7-bbd0-ba815d2ee5ad	b32ae806-027b-48f9-991a-e18fac9d8eba	luis@gmail.com	SOCIO	CREATE	profiles	b32ae806-027b-48f9-991a-e18fac9d8eba	\N	{"id": "b32ae806-027b-48f9-991a-e18fac9d8eba", "dni": "40456789", "rol": "SOCIO", "email": "luis@gmail.com", "rubro": null, "barrio": "Centro", "estado": "PENDIENTE", "telefono": "3794111112", "direccion": null, "municipio": "Capital", "provincia": "Corrientes", "es_estudiante": true, "es_profesional": false, "nombre_apellido": "Luis Landrisina", "password_changed": false, "constancia_estudiante_url": null}	Registro Cuentas	10.11.0.10	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36	2026-04-25 19:39:16.189097+00
5f8ba044-b5aa-4867-9047-0056e10d7993	467290c0-3061-4bab-930b-791236a824f1	victoralfredo2498@gmail.com	ADMIN	UPDATE	profiles	b32ae806-027b-48f9-991a-e18fac9d8eba	{"estado": "PENDIENTE"}	{"estado": "APROBADO"}	Gestión Usuarios	10.11.0.10	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36	2026-04-25 19:40:29.185662+00
8e913443-0d4a-4016-88da-8c63f2f80c33	b32ae806-027b-48f9-991a-e18fac9d8eba	luis@gmail.com	\N	UPDATE	profiles	b32ae806-027b-48f9-991a-e18fac9d8eba	\N	{"password_changed": true}	Seguridad	10.11.0.10	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36	2026-04-25 19:50:07.185963+00
62c6e4c9-1825-4f3a-bde0-0aba38b81474	467290c0-3061-4bab-930b-791236a824f1	victoralfredo2498@gmail.com	SUPERADMIN | SOCIO	LOGIN_ADMIN	auth.users	467290c0-3061-4bab-930b-791236a824f1	\N	{"roles": ["SUPERADMIN", "SOCIO"], "metodo": "email"}	Autenticación Administrativa	10.11.0.10	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36	2026-04-25 20:31:23.542156+00
2eb7c28d-3f39-447a-8e1a-76066d22f5df	2a1039a2-be04-42e1-a654-6e67de053dd9	flormac@gmail.com	SOCIO	CREATE	profiles	687f404f-1c73-42eb-8604-156ba6634334	\N	{"id": "687f404f-1c73-42eb-8604-156ba6634334", "dni": "1212121212", "rol": "SOCIO", "email": "gino@gmail.com", "rubro": null, "estado": "APROBADO", "telefono": "", "municipio": "Capital", "titular_id": "2a1039a2-be04-42e1-a654-6e67de053dd9", "tipo_vinculo": "Hijo/a", "nombre_apellido": "Gino Perri", "password_changed": false}	Gestión Dependientes	10.11.0.10	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36	2026-04-25 20:37:12.647551+00
1db08845-73d6-4bf9-9ced-49e4c9c318b2	467290c0-3061-4bab-930b-791236a824f1	victoralfredo2498@gmail.com	SUPERADMIN | SOCIO	LOGIN_ADMIN	auth.users	467290c0-3061-4bab-930b-791236a824f1	\N	{"roles": ["SUPERADMIN", "SOCIO"], "metodo": "email"}	Autenticación Administrativa	10.11.0.10	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36	2026-04-25 20:38:07.020884+00
ab0d1b7f-3143-4179-91e6-ecc6eae692d9	467290c0-3061-4bab-930b-791236a824f1	victoralfredo2498@gmail.com	SUPERADMIN	UPDATE	auth.users (Password)	687f404f-1c73-42eb-8604-156ba6634334	\N	{"password_reset": true}	Gestión Usuarios	10.11.0.10	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36	2026-04-25 20:38:26.134992+00
b899a285-bf84-4096-8865-12a49cec19ca	467290c0-3061-4bab-930b-791236a824f1	victoralfredo2498@gmail.com	SUPERADMIN | SOCIO	LOGIN_ADMIN	auth.users	467290c0-3061-4bab-930b-791236a824f1	\N	{"roles": ["SUPERADMIN", "SOCIO"], "metodo": "email"}	Autenticación Administrativa	10.11.0.10	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36	2026-04-25 21:00:27.390065+00
df8a41ab-7cfb-40be-ad0d-93df72911cdd	467290c0-3061-4bab-930b-791236a824f1	victoralfredo2498@gmail.com	SUPERADMIN | SOCIO	LOGIN_ADMIN	auth.users	467290c0-3061-4bab-930b-791236a824f1	\N	{"roles": ["SUPERADMIN", "SOCIO"], "metodo": "email"}	Autenticación Administrativa	10.11.0.10	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36	2026-04-25 21:15:24.725979+00
57a0d6bf-0a6b-4d38-8d63-927371b5d8ef	2a1039a2-be04-42e1-a654-6e67de053dd9	flormac@gmail.com	SOCIO	CREATE	profiles	1df921a5-c44c-4945-94c4-3d5b2ecb801e	\N	{"id": "1df921a5-c44c-4945-94c4-3d5b2ecb801e", "dni": "13131313", "rol": "SOCIO", "email": "dependiente.13131313@sociedadrural.local", "rubro": null, "estado": "APROBADO", "telefono": "", "municipio": "Capital", "titular_id": "2a1039a2-be04-42e1-a654-6e67de053dd9", "tipo_vinculo": "Hijo/a", "nombre_apellido": "Fransi Gati", "password_changed": false}	Gestión Dependientes	10.11.0.10	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36	2026-04-25 21:20:28.586562+00
097c85ea-1d1e-4d92-a26d-a8e9554882cb	2a1039a2-be04-42e1-a654-6e67de053dd9	flormac@gmail.com	SOCIO	CREATE	profiles	7c3cbaba-677e-4cf3-ad01-9f166d947a24	\N	{"id": "7c3cbaba-677e-4cf3-ad01-9f166d947a24", "dni": "1010101010", "rol": "SOCIO", "email": "dependiente.1010101010@sociedadrural.local", "rubro": null, "estado": "APROBADO", "telefono": "", "municipio": "Capital", "titular_id": "2a1039a2-be04-42e1-a654-6e67de053dd9", "tipo_vinculo": "Cónyuge", "nombre_apellido": "Lemantiene lajermu", "password_changed": false}	Gestión Dependientes	10.11.0.10	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36	2026-04-25 21:21:19.26959+00
0b996e73-d919-4dab-bda3-52a0d68fd12c	467290c0-3061-4bab-930b-791236a824f1	victoralfredo2498@gmail.com	SUPERADMIN | SOCIO	LOGIN_ADMIN	auth.users	467290c0-3061-4bab-930b-791236a824f1	\N	{"roles": ["SUPERADMIN", "SOCIO"], "metodo": "email"}	Autenticación Administrativa	10.11.0.10	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36	2026-04-25 21:22:41.668025+00
4993fb27-53d8-47e6-b2fe-29b1856d9797	2a1039a2-be04-42e1-a654-6e67de053dd9	flormac@gmail.com	\N	DELETE	profiles	7c3cbaba-677e-4cf3-ad01-9f166d947a24	{"id": "7c3cbaba-677e-4cf3-ad01-9f166d947a24", "dni": "1010101010", "rol": "SOCIO", "cuit": null, "email": "dependiente.1010101010@sociedadrural.local", "rubro": null, "barrio": null, "estado": "APROBADO", "motivo": null, "foto_url": null, "telefono": "", "username": null, "direccion": null, "municipio": "Capital", "provincia": null, "created_at": "2026-04-25T21:21:19.022991+00:00", "titular_id": "2a1039a2-be04-42e1-a654-6e67de053dd9", "updated_at": "2026-04-25T21:21:19.022991+00:00", "numero_socio": null, "tipo_vinculo": "Cónyuge", "es_estudiante": false, "es_profesional": false, "membership_type": "INDIVIDUAL", "nombre_apellido": "Lemantiene lajermu", "camara_provincia": null, "password_changed": false, "estado_aprobacion": "PENDIENTE", "camara_denominacion": null, "family_members_count": 1, "constancia_estudiante_url": null, "sonido_notificaciones_habilitado": true}	\N	Gestión Dependientes	10.11.0.10	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36	2026-04-25 21:54:11.871638+00
182635cd-4f03-4a23-bc30-0603cf51dcc5	2a1039a2-be04-42e1-a654-6e67de053dd9	flormac@gmail.com	\N	DELETE	profiles	1df921a5-c44c-4945-94c4-3d5b2ecb801e	{"id": "1df921a5-c44c-4945-94c4-3d5b2ecb801e", "dni": "13131313", "rol": "SOCIO", "cuit": null, "email": "dependiente.13131313@sociedadrural.local", "rubro": null, "barrio": null, "estado": "APROBADO", "motivo": null, "foto_url": null, "telefono": "", "username": null, "direccion": null, "municipio": "Capital", "provincia": null, "created_at": "2026-04-25T21:20:28.315989+00:00", "titular_id": "2a1039a2-be04-42e1-a654-6e67de053dd9", "updated_at": "2026-04-25T21:20:28.315989+00:00", "numero_socio": null, "tipo_vinculo": "Hijo/a", "es_estudiante": false, "es_profesional": false, "membership_type": "INDIVIDUAL", "nombre_apellido": "Fransi Gati", "camara_provincia": null, "password_changed": false, "estado_aprobacion": "PENDIENTE", "camara_denominacion": null, "family_members_count": 1, "constancia_estudiante_url": null, "sonido_notificaciones_habilitado": true}	\N	Gestión Dependientes	10.11.0.10	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36	2026-04-25 21:54:17.967685+00
b042171c-f107-485b-ab89-226ecb36d011	2a1039a2-be04-42e1-a654-6e67de053dd9	flormac@gmail.com	SOCIO	CREATE	profiles	e01afdff-da8f-469a-a054-9eb71ccf3766	\N	{"id": "e01afdff-da8f-469a-a054-9eb71ccf3766", "dni": "12457836", "rol": "SOCIO", "email": "benja@gmail.com", "rubro": null, "estado": "PENDIENTE", "telefono": "", "municipio": "Capital", "user_type": "FAMILIAR", "titular_id": "2a1039a2-be04-42e1-a654-6e67de053dd9", "tipo_vinculo": "Cónyuge", "nombre_apellido": "Benjamin Emiliano Torrilla", "password_changed": false, "must_change_password": true}	Gestión Dependientes	10.11.0.10	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36	2026-04-25 23:26:25.849914+00
5a6f873a-3c6b-4c9c-94ec-446856fae5f2	2a1039a2-be04-42e1-a654-6e67de053dd9	flormac@gmail.com	\N	DELETE	profiles	687f404f-1c73-42eb-8604-156ba6634334	{"id": "687f404f-1c73-42eb-8604-156ba6634334", "dni": "1212121212", "rol": "SOCIO", "cuit": null, "email": "gino@gmail.com", "rubro": null, "barrio": null, "estado": "APROBADO", "motivo": null, "foto_url": null, "telefono": "", "username": null, "direccion": null, "municipio": "Capital", "provincia": null, "created_at": "2026-04-25T20:37:12.384032+00:00", "titular_id": "2a1039a2-be04-42e1-a654-6e67de053dd9", "updated_at": "2026-04-25T21:08:09.998265+00:00", "numero_socio": "0003", "tipo_vinculo": "Hijo/a", "es_estudiante": false, "es_profesional": false, "membership_type": "INDIVIDUAL", "nombre_apellido": "Gino Perri", "camara_provincia": null, "password_changed": false, "estado_aprobacion": "PENDIENTE", "camara_denominacion": null, "family_members_count": 1, "constancia_estudiante_url": null, "sonido_notificaciones_habilitado": true}	\N	Gestión Dependientes	10.11.0.10	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36	2026-04-25 21:54:21.6545+00
cc7d6157-0043-4d98-9070-6c52c8d2636e	467290c0-3061-4bab-930b-791236a824f1	victoralfredo2498@gmail.com	SUPERADMIN | SOCIO	LOGIN_ADMIN	auth.users	467290c0-3061-4bab-930b-791236a824f1	\N	{"roles": ["SUPERADMIN", "SOCIO"], "metodo": "email"}	Autenticación Administrativa	10.11.0.10	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36	2026-04-25 21:54:44.551915+00
c20d88f8-80ab-4860-b912-19ea74dfea10	5d7855f3-f641-4af6-9537-f41b82ac162d	victoralfredo27@gmail.com	SOCIO	CREATE	profiles	5d7855f3-f641-4af6-9537-f41b82ac162d	\N	{"id": "5d7855f3-f641-4af6-9537-f41b82ac162d", "dni": "32435789", "rol": "SOCIO", "email": "victoralfredo27@gmail.com", "rubro": null, "barrio": "Centro", "estado": "PENDIENTE", "telefono": "3795330172", "direccion": null, "municipio": "Capital", "provincia": "Corrientes", "es_estudiante": false, "es_profesional": false, "nombre_apellido": "Victor Torrilla", "password_changed": false, "constancia_estudiante_url": null}	Registro Cuentas	10.11.0.10	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36	2026-04-25 21:58:56.265049+00
27e2fa55-aaad-42ac-9770-592b4525bc7f	467290c0-3061-4bab-930b-791236a824f1	victoralfredo2498@gmail.com	SUPERADMIN | SOCIO	LOGIN_ADMIN	auth.users	467290c0-3061-4bab-930b-791236a824f1	\N	{"roles": ["SUPERADMIN", "SOCIO"], "metodo": "email"}	Autenticación Administrativa	10.11.0.10	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36	2026-04-25 21:59:18.121164+00
010a764b-fe2e-4367-8ca2-e1180ec0cb21	467290c0-3061-4bab-930b-791236a824f1	victoralfredo2498@gmail.com	ADMIN	UPDATE	profiles	5d7855f3-f641-4af6-9537-f41b82ac162d	{"estado": "PENDIENTE"}	{"estado": "APROBADO"}	Gestión Usuarios	10.11.0.10	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36	2026-04-25 21:59:43.304664+00
7350f078-53cf-461a-9f9d-2f95b0f6db45	5d7855f3-f641-4af6-9537-f41b82ac162d	victoralfredo27@gmail.com	\N	UPDATE	profiles	5d7855f3-f641-4af6-9537-f41b82ac162d	\N	{"password_changed": true}	Seguridad	10.11.0.10	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36	2026-04-25 22:00:39.684439+00
f7ca04a9-9127-474b-aea3-4d68001ec396	5d7855f3-f641-4af6-9537-f41b82ac162d	victoralfredo27@gmail.com	SOCIO	CREATE	profiles	c4ee2eef-627a-46f9-8e62-025d1be1e673	\N	{"id": "c4ee2eef-627a-46f9-8e62-025d1be1e673", "dni": "14725836", "rol": "SOCIO", "email": "dependiente.14725836@sociedadrural.local", "rubro": null, "estado": "APROBADO", "telefono": "", "municipio": "Capital", "titular_id": "5d7855f3-f641-4af6-9537-f41b82ac162d", "tipo_vinculo": "Hijo/a", "nombre_apellido": "Gino Torrilla", "password_changed": false}	Gestión Dependientes	10.11.0.10	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36	2026-04-25 22:01:41.784781+00
a03a7bcd-c775-4468-9528-90bcba6829ac	5d7855f3-f641-4af6-9537-f41b82ac162d	victoralfredo27@gmail.com	SOCIO	CREATE	profiles	ea625819-210b-4b34-8fb2-64d1009f8021	\N	{"id": "ea625819-210b-4b34-8fb2-64d1009f8021", "dni": "12345678", "rol": "SOCIO", "email": "dependiente.12345678@sociedadrural.local", "rubro": null, "estado": "APROBADO", "telefono": "", "municipio": "Capital", "titular_id": "5d7855f3-f641-4af6-9537-f41b82ac162d", "tipo_vinculo": "Hijo/a", "nombre_apellido": "fransis Torrilla", "password_changed": false}	Gestión Dependientes	10.11.0.10	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36	2026-04-25 22:02:04.637832+00
5b3a1b61-ca7e-4845-8797-610b2848c8c2	5d7855f3-f641-4af6-9537-f41b82ac162d	victoralfredo27@gmail.com	SOCIO	CREATE	profiles	ab2edc19-8df3-419e-82c9-a97493ee29e7	\N	{"id": "ab2edc19-8df3-419e-82c9-a97493ee29e7", "dni": "315759747", "rol": "SOCIO", "email": "dependiente.315759747@sociedadrural.local", "rubro": null, "estado": "APROBADO", "telefono": "", "municipio": "Capital", "titular_id": "5d7855f3-f641-4af6-9537-f41b82ac162d", "tipo_vinculo": "Cónyuge", "nombre_apellido": "Flori Maciel", "password_changed": false}	Gestión Dependientes	10.11.0.10	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36	2026-04-25 22:02:31.021144+00
905ad30e-7f9c-48fb-847d-78270e4b5ea7	467290c0-3061-4bab-930b-791236a824f1	victoralfredo2498@gmail.com	SUPERADMIN | SOCIO	LOGIN_ADMIN	auth.users	467290c0-3061-4bab-930b-791236a824f1	\N	{"roles": ["SUPERADMIN", "SOCIO"], "metodo": "email"}	Autenticación Administrativa	10.11.0.10	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36	2026-04-25 22:03:12.873535+00
e9c2b856-7b78-4ecf-96b4-473c0de79bf2	5d7855f3-f641-4af6-9537-f41b82ac162d	victoralfredo27@gmail.com	SOCIO	CREATE	profiles	8add1c0e-5ad5-466b-8170-7959eb423e92	\N	{"id": "8add1c0e-5ad5-466b-8170-7959eb423e92", "dni": "36925814", "rol": "SOCIO", "email": "dependiente.36925814@sociedadrural.local", "rubro": null, "estado": "APROBADO", "telefono": "", "municipio": "Capital", "titular_id": "5d7855f3-f641-4af6-9537-f41b82ac162d", "tipo_vinculo": "Hijo/a", "nombre_apellido": "Teo Torrilla", "password_changed": false}	Gestión Dependientes	10.11.0.10	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36	2026-04-25 22:05:00.444705+00
b4dfd5ff-d42b-41bd-9968-15d5850c65b6	5d7855f3-f641-4af6-9537-f41b82ac162d	victoralfredo27@gmail.com	\N	DELETE	profiles	c4ee2eef-627a-46f9-8e62-025d1be1e673	{"id": "c4ee2eef-627a-46f9-8e62-025d1be1e673", "dni": "14725836", "rol": "SOCIO", "cuit": null, "email": "dependiente.14725836@sociedadrural.local", "rubro": null, "barrio": null, "estado": "APROBADO", "motivo": null, "foto_url": null, "telefono": "", "username": null, "direccion": null, "municipio": "Capital", "provincia": null, "created_at": "2026-04-25T22:01:41.452762+00:00", "titular_id": "5d7855f3-f641-4af6-9537-f41b82ac162d", "updated_at": "2026-04-25T22:01:41.452762+00:00", "numero_socio": null, "tipo_vinculo": "Hijo/a", "es_estudiante": false, "es_profesional": false, "membership_type": "INDIVIDUAL", "nombre_apellido": "Gino Torrilla", "camara_provincia": null, "password_changed": false, "estado_aprobacion": "PENDIENTE", "camara_denominacion": null, "family_members_count": 1, "constancia_estudiante_url": null, "sonido_notificaciones_habilitado": true}	\N	Gestión Dependientes	10.11.0.10	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36	2026-04-25 22:11:54.178251+00
7e1220a5-ec89-4a1a-b8d5-ee06e7de7065	467290c0-3061-4bab-930b-791236a824f1	victoralfredo2498@gmail.com	SUPERADMIN | SOCIO	LOGIN_ADMIN	auth.users	467290c0-3061-4bab-930b-791236a824f1	\N	{"roles": ["SUPERADMIN", "SOCIO"], "metodo": "email"}	Autenticación Administrativa	10.11.0.10	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36	2026-04-25 22:16:29.022214+00
17777410-2f7f-4cfc-be78-5187ae077391	467290c0-3061-4bab-930b-791236a824f1	victoralfredo2498@gmail.com	SUPERADMIN | SOCIO	LOGIN_ADMIN	auth.users	467290c0-3061-4bab-930b-791236a824f1	\N	{"roles": ["SUPERADMIN", "SOCIO"], "metodo": "email"}	Autenticación Administrativa	10.11.0.10	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36	2026-04-25 23:27:17.980906+00
321ec03e-e7f2-493d-b98e-0aa16fe76d95	467290c0-3061-4bab-930b-791236a824f1	victoralfredo2498@gmail.com	ADMIN	UPDATE	profiles	e01afdff-da8f-469a-a054-9eb71ccf3766	{"estado": "PENDIENTE"}	{"estado": "APROBADO"}	Gestión Usuarios	10.11.0.10	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36	2026-04-25 23:27:29.818051+00
35bfbe34-ebb5-4e28-a494-c57e2cb41983	e01afdff-da8f-469a-a054-9eb71ccf3766	benja@gmail.com	\N	UPDATE	profiles	e01afdff-da8f-469a-a054-9eb71ccf3766	\N	{"password_changed": true}	Seguridad	10.11.0.10	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36	2026-04-26 00:42:05.149888+00
3c498185-2459-4449-8a35-7d4ea606a16f	1c757b75-8f83-4677-9747-043c4f03a67f	martinalbertosoto85@gmail.com	ADMINISTRADOR | SOCIO	LOGIN_ADMIN	auth.users	1c757b75-8f83-4677-9747-043c4f03a67f	\N	{"roles": ["ADMINISTRADOR", "SOCIO"], "metodo": "email"}	Autenticación Administrativa	10.11.0.10	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Mobile Safari/537.36	2026-04-26 02:24:02.822874+00
b502b0dc-5e34-49a7-834a-a0b980e53034	901294d5-5d7b-41f6-a2d3-e6cbd17819cd	luciano.eche@gmail.com	SOCIO	CREATE	profiles	901294d5-5d7b-41f6-a2d3-e6cbd17819cd	\N	{"id": "901294d5-5d7b-41f6-a2d3-e6cbd17819cd", "dni": "31647727", "rol": "SOCIO", "email": "luciano.eche@gmail.com", "rubro": null, "barrio": "Norte", "estado": "PENDIENTE", "telefono": "3794802141", "direccion": null, "municipio": "Itatí", "provincia": "Corrientes", "es_estudiante": false, "es_profesional": false, "nombre_apellido": "Luciano", "password_changed": true, "constancia_estudiante_url": null}	Registro Cuentas	10.11.0.10	Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.3 Mobile/15E148 Safari/604.1	2026-04-26 02:36:32.530049+00
c1fbe5e9-04fa-47c3-8d1a-adb41f9af411	1c757b75-8f83-4677-9747-043c4f03a67f	martinalbertosoto85@gmail.com	ADMIN	UPDATE	profiles	901294d5-5d7b-41f6-a2d3-e6cbd17819cd	{"estado": "PENDIENTE"}	{"estado": "APROBADO"}	Gestión Usuarios	10.11.0.10	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Mobile Safari/537.36	2026-04-26 02:37:43.478069+00
2bac1f43-c2cd-4c95-bc36-a3e06ab7a589	1c757b75-8f83-4677-9747-043c4f03a67f	martinalbertosoto85@gmail.com	ADMINISTRADOR | SOCIO	LOGIN_ADMIN	auth.users	1c757b75-8f83-4677-9747-043c4f03a67f	\N	{"roles": ["ADMINISTRADOR", "SOCIO"], "metodo": "email"}	Autenticación Administrativa	10.11.0.10	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Mobile Safari/537.36	2026-04-26 02:38:25.562603+00
f7f1038e-9cca-4dbd-aa2b-87659f26ddb8	1c757b75-8f83-4677-9747-043c4f03a67f	martinalbertosoto85@gmail.com	ADMINISTRADOR | SOCIO	LOGIN_ADMIN	auth.users	1c757b75-8f83-4677-9747-043c4f03a67f	\N	{"roles": ["ADMINISTRADOR", "SOCIO"], "metodo": "email"}	Autenticación Administrativa	10.11.0.10	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Mobile Safari/537.36	2026-04-26 02:39:31.475206+00
33fb2cfa-b2c4-46f2-97ff-61f7f143b736	1c757b75-8f83-4677-9747-043c4f03a67f	martinalbertosoto85@gmail.com	ADMINISTRADOR | SOCIO	LOGIN_ADMIN	auth.users	1c757b75-8f83-4677-9747-043c4f03a67f	\N	{"roles": ["ADMINISTRADOR", "SOCIO"], "metodo": "email"}	Autenticación Administrativa	10.11.0.10	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Mobile Safari/537.36	2026-04-26 04:05:20.712484+00
28f028de-5c49-4fb1-823b-b5540bef2e48	1c757b75-8f83-4677-9747-043c4f03a67f	martinalbertosoto85@gmail.com	ADMIN	CREATE	profiles	461a31ea-5286-42ab-8c1c-2d976da73d40	\N	{"id": "461a31ea-5286-42ab-8c1c-2d976da73d40", "dni": "20314355238", "rol": "COMERCIO", "email": "trasladosubi@gmail.com", "rubro": "transporte", "estado": "PENDIENTE", "telefono": "3794088523", "municipio": "Capital", "titular_id": null, "nombre_apellido": "Ubi Traslados ", "password_changed": false}	Gestión Comercios	10.11.0.10	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Mobile Safari/537.36	2026-04-26 04:07:52.134167+00
53deef8d-0734-4a11-a078-7cadd1f0e416	1c757b75-8f83-4677-9747-043c4f03a67f	martinalbertosoto85@gmail.com	ADMIN	UPDATE	profiles	461a31ea-5286-42ab-8c1c-2d976da73d40	{"estado": "PENDIENTE"}	{"estado": "APROBADO"}	Gestión Usuarios	10.11.0.10	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Mobile Safari/537.36	2026-04-26 04:08:10.451997+00
1dd1357e-a2dc-4484-b155-816552b5cd84	1c757b75-8f83-4677-9747-043c4f03a67f	martinalbertosoto85@gmail.com	ADMIN	UPDATE	profiles	461a31ea-5286-42ab-8c1c-2d976da73d40	{"estado": "APROBADO"}	{"estado": "APROBADO"}	Gestión Usuarios	10.11.0.10	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Mobile Safari/537.36	2026-04-26 04:08:11.365893+00
1915c295-d7a3-4d5b-9ece-26152dc2f3cd	461a31ea-5286-42ab-8c1c-2d976da73d40	trasladosubi@gmail.com	\N	UPDATE	profiles	461a31ea-5286-42ab-8c1c-2d976da73d40	\N	{"password_changed": true}	Seguridad	10.11.0.10	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Mobile Safari/537.36	2026-04-26 04:09:01.200661+00
70907e8b-3fda-4379-a518-a5f7d7dd27db	1c757b75-8f83-4677-9747-043c4f03a67f	martinalbertosoto85@gmail.com	ADMINISTRADOR | SOCIO	LOGIN_ADMIN	auth.users	1c757b75-8f83-4677-9747-043c4f03a67f	\N	{"roles": ["ADMINISTRADOR", "SOCIO"], "metodo": "email"}	Autenticación Administrativa	10.11.0.10	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Mobile Safari/537.36	2026-04-26 04:15:09.426281+00
0b1dcab9-5dee-4a64-9939-3cf37f1388c0	467290c0-3061-4bab-930b-791236a824f1	victoralfredo2498@gmail.com	SUPERADMIN | SOCIO	LOGIN_ADMIN	auth.users	467290c0-3061-4bab-930b-791236a824f1	\N	{"roles": ["SUPERADMIN", "SOCIO"], "metodo": "email"}	Autenticación Administrativa	10.11.0.10	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36	2026-04-27 10:27:31.533295+00
cc1a2300-2d31-4223-a6cb-fee0a2a5ee74	467290c0-3061-4bab-930b-791236a824f1	victoralfredo2498@gmail.com	ADMIN	CREATE	profiles	79429419-0980-4d04-82d5-be4a1831ec3a	\N	{"id": "79429419-0980-4d04-82d5-be4a1831ec3a", "dni": "20314357894", "rol": "COMERCIO", "email": "alberto@gmail.com", "rubro": "servicios_profesionales", "estado": "PENDIENTE", "telefono": "3744541236", "municipio": "Capital", "titular_id": null, "nombre_apellido": "Dr. Alberto Del Orto", "password_changed": false}	Gestión Comercios	10.11.0.10	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36	2026-04-27 10:30:24.968874+00
dbdad725-fa08-4cfa-8e81-7e7b21bc08e1	467290c0-3061-4bab-930b-791236a824f1	victoralfredo2498@gmail.com	ADMIN	UPDATE	profiles	79429419-0980-4d04-82d5-be4a1831ec3a	{"estado": "PENDIENTE"}	{"estado": "APROBADO"}	Gestión Usuarios	10.11.0.10	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36	2026-04-27 10:30:37.605301+00
47451800-ad79-4bec-8f1d-fe8461f2b4cd	467290c0-3061-4bab-930b-791236a824f1	victoralfredo2498@gmail.com	SUPERADMIN | SOCIO	LOGIN_ADMIN	auth.users	467290c0-3061-4bab-930b-791236a824f1	\N	{"roles": ["SUPERADMIN", "SOCIO"], "metodo": "email"}	Autenticación Administrativa	10.11.0.10	Mozilla/5.0 (Linux; Android 16; SM-A065M Build/BP2A.250605.031.A3; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/147.0.7727.55 Mobile Safari/537.36	2026-04-27 17:48:02.685599+00
34ab16b8-ce9c-419f-b343-f84258dfeaa2	467290c0-3061-4bab-930b-791236a824f1	victoralfredo2498@gmail.com	SUPERADMIN | SOCIO	LOGIN_ADMIN	auth.users	467290c0-3061-4bab-930b-791236a824f1	\N	{"roles": ["SUPERADMIN", "SOCIO"], "metodo": "email"}	Autenticación Administrativa	10.11.0.10	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Mobile Safari/537.36	2026-04-27 20:19:15.837421+00
c07d40b1-b273-43dc-b2e5-592e6e4a77c6	467290c0-3061-4bab-930b-791236a824f1	victoralfredo2498@gmail.com	SUPERADMIN | SOCIO	LOGIN_ADMIN	auth.users	467290c0-3061-4bab-930b-791236a824f1	\N	{"roles": ["SUPERADMIN", "SOCIO"], "metodo": "email"}	Autenticación Administrativa	10.11.0.10	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36	2026-04-27 20:29:01.936777+00
15420d17-635b-4262-b757-89aab3030f71	467290c0-3061-4bab-930b-791236a824f1	victoralfredo2498@gmail.com	ADMIN	CREATE	profiles	b9e03dcc-3e7b-4fd7-91c3-54f4fd3f5b34	\N	{"id": "b9e03dcc-3e7b-4fd7-91c3-54f4fd3f5b34", "dni": "31445566", "rol": "SOCIO", "email": "federico@gmail.com", "rubro": "Abogado", "estado": "PENDIENTE", "telefono": "3795998877", "direccion": "Poncho Verde 741", "municipio": "Capital", "provincia": "Corrientes", "es_profesional": true, "nombre_apellido": "Federico Molina", "password_changed": false}	Gestión Profesionales	10.11.0.10	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36	2026-04-27 20:31:17.922953+00
c2f8d9f7-ff69-439f-8193-dc34c2e1ae0a	467290c0-3061-4bab-930b-791236a824f1	victoralfredo2498@gmail.com	ADMIN	UPDATE	profiles	b9e03dcc-3e7b-4fd7-91c3-54f4fd3f5b34	{"estado": "PENDIENTE"}	{"estado": "APROBADO"}	Gestión Usuarios	10.11.0.10	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36	2026-04-27 20:31:30.083809+00
1e969636-14d6-4fae-8297-4013a5a448b3	b9e03dcc-3e7b-4fd7-91c3-54f4fd3f5b34	federico@gmail.com	\N	UPDATE	profiles	b9e03dcc-3e7b-4fd7-91c3-54f4fd3f5b34	\N	{"password_changed": true}	Seguridad	10.11.0.10	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36	2026-04-27 20:33:25.429369+00
e0dcb84b-eb71-41fe-bc01-f384e1e65c17	467290c0-3061-4bab-930b-791236a824f1	victoralfredo2498@gmail.com	SUPERADMIN | SOCIO	LOGIN_ADMIN	auth.users	467290c0-3061-4bab-930b-791236a824f1	\N	{"roles": ["SUPERADMIN", "SOCIO"], "metodo": "email"}	Autenticación Administrativa	10.11.0.10	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36	2026-04-27 22:12:41.092929+00
6b9621b5-0d68-4c17-afe0-a322091b59c7	467290c0-3061-4bab-930b-791236a824f1	victoralfredo2498@gmail.com	SUPERADMIN | SOCIO	LOGIN_ADMIN	auth.users	467290c0-3061-4bab-930b-791236a824f1	\N	{"roles": ["SUPERADMIN", "SOCIO"], "metodo": "email"}	Autenticación Administrativa	10.11.0.10	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36	2026-04-27 22:39:37.402234+00
aa6a50c9-0eff-4a7a-ad33-9bb4d89a6189	467290c0-3061-4bab-930b-791236a824f1	victoralfredo2498@gmail.com	SUPERADMIN	CREATE_ADMIN	auth.users	9b62abe0-8e43-4ccd-ab12-6b1bac20913f	\N	{"id": "9b62abe0-8e43-4ccd-ab12-6b1bac20913f", "dni": "11222333", "rol": "ADMIN", "email": "luciano.echev@gmail.com", "estado": "APROBADO", "username": "Luciano2026", "nombre_apellido": "Luciano Echeverría", "password_changed": true}	Gestión de Administradores	10.11.0.10	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36	2026-04-27 22:41:48.695209+00
2a7cf94b-633c-4b53-875e-f87b4e1d108c	467290c0-3061-4bab-930b-791236a824f1	victoralfredo2498@gmail.com	SUPERADMIN	DELETE_ADMIN	auth.users	9b62abe0-8e43-4ccd-ab12-6b1bac20913f	{"id": "9b62abe0-8e43-4ccd-ab12-6b1bac20913f", "dni": "11222333", "rol": "ADMIN", "cuit": null, "email": "luciano.echev@gmail.com", "rubro": null, "barrio": null, "estado": "APROBADO", "motivo": null, "foto_url": null, "telefono": null, "username": "Luciano2026", "direccion": null, "municipio": null, "provincia": null, "user_type": "SOCIO", "created_at": "2026-04-27T22:41:47.799033+00:00", "titular_id": null, "updated_at": "2026-04-27T22:41:47.799033+00:00", "numero_socio": null, "tipo_vinculo": null, "es_estudiante": false, "es_profesional": false, "membership_type": "INDIVIDUAL", "nombre_apellido": "Luciano Echeverría", "camara_provincia": null, "password_changed": true, "estado_aprobacion": "PENDIENTE", "camara_denominacion": null, "family_members_count": 1, "must_change_password": false, "constancia_estudiante_url": null, "sonido_notificaciones_habilitado": true}	\N	Gestión de Administradores	10.11.0.10	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36	2026-04-27 22:43:51.339266+00
372e2f58-201d-4def-8fd1-2c3dc248d360	467290c0-3061-4bab-930b-791236a824f1	victoralfredo2498@gmail.com	SUPERADMIN	CREATE_ADMIN	auth.users	cb377de7-c49c-46b6-b735-3e42849ed1f0	\N	{"id": "cb377de7-c49c-46b6-b735-3e42849ed1f0", "dni": "31111222", "rol": "ADMIN", "email": "luciano.eche@gmail.com", "estado": "APROBADO", "username": "Luciano2026", "nombre_apellido": "Luciano Echeverría", "password_changed": true}	Gestión de Administradores	10.11.0.10	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36	2026-04-27 22:45:18.774015+00
9666fd7f-20bb-4d1f-88e5-ad6110646127	cb377de7-c49c-46b6-b735-3e42849ed1f0	luciano.eche@gmail.com	ADMINISTRADOR | SOCIO	LOGIN_ADMIN	auth.users	cb377de7-c49c-46b6-b735-3e42849ed1f0	\N	{"roles": ["ADMINISTRADOR", "SOCIO"], "metodo": "email"}	Autenticación Administrativa	10.11.0.10	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36	2026-04-27 22:45:44.942108+00
70b317da-df59-4331-a440-1c4858fc714a	467290c0-3061-4bab-930b-791236a824f1	victoralfredo2498@gmail.com	SUPERADMIN | SOCIO	LOGIN_ADMIN	auth.users	467290c0-3061-4bab-930b-791236a824f1	\N	{"roles": ["SUPERADMIN", "SOCIO"], "metodo": "email"}	Autenticación Administrativa	10.11.0.10	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36	2026-04-27 22:54:48.074798+00
e2e47b94-ed29-4348-b751-8eb0c8960b55	467290c0-3061-4bab-930b-791236a824f1	victoralfredo2498@gmail.com	SUPERADMIN | SOCIO	LOGIN_ADMIN	auth.users	467290c0-3061-4bab-930b-791236a824f1	\N	{"roles": ["SUPERADMIN", "SOCIO"], "metodo": "email"}	Autenticación Administrativa	10.11.0.10	Mozilla/5.0 (Linux; Android 16; SM-A065M Build/BP2A.250605.031.A3; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/147.0.7727.55 Mobile Safari/537.36	2026-04-28 00:12:53.164923+00
f5d11c66-57ab-4f5e-a5b9-5337683618c9	467290c0-3061-4bab-930b-791236a824f1	victoralfredo2498@gmail.com	SUPERADMIN | SOCIO	LOGIN_ADMIN	auth.users	467290c0-3061-4bab-930b-791236a824f1	\N	{"roles": ["SUPERADMIN", "SOCIO"], "metodo": "email"}	Autenticación Administrativa	10.11.0.10	Mozilla/5.0 (Linux; Android 16; SM-A065M Build/BP2A.250605.031.A3; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/147.0.7727.55 Mobile Safari/537.36	2026-04-28 09:37:12.722185+00
a6a2bf01-5d48-453c-8ed9-ae63dc919e11	cb377de7-c49c-46b6-b735-3e42849ed1f0	Luciano.eche@gmail.com	ADMINISTRADOR | SOCIO	LOGIN_ADMIN	auth.users	cb377de7-c49c-46b6-b735-3e42849ed1f0	\N	{"roles": ["ADMINISTRADOR", "SOCIO"], "metodo": "email"}	Autenticación Administrativa	10.11.0.10	Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.3 Mobile/15E148 Safari/604.1	2026-04-28 11:14:14.086982+00
d0a962e2-9245-4b29-890a-0178355c863d	467290c0-3061-4bab-930b-791236a824f1	victoralfredo2498@gmail.com	SUPERADMIN | SOCIO	LOGIN_ADMIN	auth.users	467290c0-3061-4bab-930b-791236a824f1	\N	{"roles": ["SUPERADMIN", "SOCIO"], "metodo": "email"}	Autenticación Administrativa	10.11.0.10	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36	2026-04-28 11:23:00.482803+00
4f85c8c8-00da-4e08-80fb-85a5823c1d6a	467290c0-3061-4bab-930b-791236a824f1	victoralfredo2498@gmail.com	SUPERADMIN | SOCIO	LOGIN_ADMIN	auth.users	467290c0-3061-4bab-930b-791236a824f1	\N	{"roles": ["SUPERADMIN", "SOCIO"], "metodo": "email"}	Autenticación Administrativa	10.11.0.10	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36	2026-04-28 11:32:00.60276+00
699b8c7b-5f3b-4407-b0c9-bed59313cf5c	1c757b75-8f83-4677-9747-043c4f03a67f	martinalbertosoto85@gmail.com	ADMINISTRADOR | SOCIO	LOGIN_ADMIN	auth.users	1c757b75-8f83-4677-9747-043c4f03a67f	\N	{"roles": ["ADMINISTRADOR", "SOCIO"], "metodo": "email"}	Autenticación Administrativa	10.11.0.10	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Mobile Safari/537.36	2026-04-28 11:45:21.523936+00
1dae73cb-1fb2-45a7-bdb5-915d5f0605cd	1c757b75-8f83-4677-9747-043c4f03a67f	martinalbertosoto85@gmail.com	\N	UPDATE	profiles	1c757b75-8f83-4677-9747-043c4f03a67f	{"id": "1c757b75-8f83-4677-9747-043c4f03a67f", "dni": "31435523", "rol": "ADMIN", "cuit": null, "email": "martinalbertosoto85@gmail.com", "rubro": null, "barrio": null, "estado": "APROBADO", "motivo": null, "foto_url": null, "telefono": null, "username": "martin_alberto", "direccion": null, "municipio": null, "provincia": null, "user_type": "SOCIO", "created_at": "2026-04-22T13:39:44.252529+00:00", "titular_id": null, "updated_at": "2026-04-25T21:08:09.998265+00:00", "numero_socio": null, "tipo_vinculo": null, "es_estudiante": false, "es_profesional": false, "membership_type": "INDIVIDUAL", "nombre_apellido": "Martín Alberto Soto", "camara_provincia": null, "password_changed": true, "estado_aprobacion": "PENDIENTE", "camara_denominacion": null, "family_members_count": 1, "must_change_password": false, "constancia_estudiante_url": null, "sonido_notificaciones_habilitado": true}	{"email": "martinalbertosoto85@gmail.com", "barrio": "Piragine niveyro ", "telefono": "3794551810", "direccion": "Las Camelias 6600, Corrientes capital ", "municipio": "Capital"}	Perfil	10.11.0.10	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Mobile Safari/537.36	2026-04-28 11:49:29.125489+00
7ca16f68-7770-4c5f-80c9-347ed6706a00	467290c0-3061-4bab-930b-791236a824f1	victoralfredo2498@gmail.com	SUPERADMIN | SOCIO	LOGIN_ADMIN	auth.users	467290c0-3061-4bab-930b-791236a824f1	\N	{"roles": ["SUPERADMIN", "SOCIO"], "metodo": "email"}	Autenticación Administrativa	10.11.0.10	Mozilla/5.0 (Linux; Android 16; SM-A065M Build/BP2A.250605.031.A3; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/147.0.7727.55 Mobile Safari/537.36	2026-04-28 20:18:23.593084+00
386c4b97-ea2e-43f8-a561-a28976b58571	467290c0-3061-4bab-930b-791236a824f1	victoralfredo2498@gmail.com	SUPERADMIN | SOCIO	LOGIN_ADMIN	auth.users	467290c0-3061-4bab-930b-791236a824f1	\N	{"roles": ["SUPERADMIN", "SOCIO"], "metodo": "email"}	Autenticación Administrativa	10.11.0.10	Mozilla/5.0 (Linux; Android 16; SM-A065M Build/BP2A.250605.031.A3; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/147.0.7727.55 Mobile Safari/537.36	2026-04-28 20:53:02.228417+00
4f56d1e5-026d-4ac1-be05-46f12c2cc1de	467290c0-3061-4bab-930b-791236a824f1	victoralfredo2498@gmail.com	SUPERADMIN | SOCIO	LOGIN_ADMIN	auth.users	467290c0-3061-4bab-930b-791236a824f1	\N	{"roles": ["SUPERADMIN", "SOCIO"], "metodo": "email"}	Autenticación Administrativa	10.11.0.10	Mozilla/5.0 (Linux; Android 16; SM-A065M Build/BP2A.250605.031.A3; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/147.0.7727.55 Mobile Safari/537.36	2026-04-28 21:15:12.832054+00
b1fde54a-5fd4-4ab5-ab84-d7be88e0d4e5	1c757b75-8f83-4677-9747-043c4f03a67f	martinalbertosoto85@gmail.com	ADMINISTRADOR | SOCIO	LOGIN_ADMIN	auth.users	1c757b75-8f83-4677-9747-043c4f03a67f	\N	{"roles": ["ADMINISTRADOR", "SOCIO"], "metodo": "email"}	Autenticación Administrativa	10.11.0.10	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Mobile Safari/537.36	2026-04-29 00:13:51.607179+00
91cde23a-dedd-48de-9989-847c05d89563	1c757b75-8f83-4677-9747-043c4f03a67f	martinalbertosoto85@gmail.com	ADMINISTRADOR | SOCIO	LOGIN_ADMIN	auth.users	1c757b75-8f83-4677-9747-043c4f03a67f	\N	{"roles": ["ADMINISTRADOR", "SOCIO"], "metodo": "email"}	Autenticación Administrativa	10.11.0.10	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Mobile Safari/537.36	2026-04-29 13:40:43.870236+00
e19a1f45-c2c4-4b6d-8d29-5e737938e5b1	1c757b75-8f83-4677-9747-043c4f03a67f	martinalbertosoto85@gmail.com	ADMINISTRADOR | SOCIO	LOGIN_ADMIN	auth.users	1c757b75-8f83-4677-9747-043c4f03a67f	\N	{"roles": ["ADMINISTRADOR", "SOCIO"], "metodo": "email"}	Autenticación Administrativa	10.11.0.10	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Mobile Safari/537.36	2026-04-29 15:36:03.934845+00
66c3505f-fa5b-4a1f-804a-bcacb47ff58c	cb377de7-c49c-46b6-b735-3e42849ed1f0	Luciano.eche@gmail.com	ADMINISTRADOR | SOCIO	LOGIN_ADMIN	auth.users	cb377de7-c49c-46b6-b735-3e42849ed1f0	\N	{"roles": ["ADMINISTRADOR", "SOCIO"], "metodo": "email"}	Autenticación Administrativa	10.11.0.10	Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.3 Mobile/15E148 Safari/604.1	2026-04-30 01:40:03.282127+00
cc066f2e-0916-4f80-a569-3dbb79dbb9e3	467290c0-3061-4bab-930b-791236a824f1	victoralfredo2498@gmail.com	SUPERADMIN | SOCIO	LOGIN_ADMIN	auth.users	467290c0-3061-4bab-930b-791236a824f1	\N	{"roles": ["SUPERADMIN", "SOCIO"], "metodo": "email"}	Autenticación Administrativa	10.11.0.10	Mozilla/5.0 (Linux; Android 16; SM-A065M Build/BP2A.250605.031.A3; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/147.0.7727.55 Mobile Safari/537.36	2026-04-30 05:01:40.141099+00
906a58f6-4a77-4b9c-b289-8685a6d98a4a	467290c0-3061-4bab-930b-791236a824f1	victoralfredo2498@gmail.com	SUPERADMIN | SOCIO	LOGIN_ADMIN	auth.users	467290c0-3061-4bab-930b-791236a824f1	\N	{"roles": ["SUPERADMIN", "SOCIO"], "metodo": "email"}	Autenticación Administrativa	10.11.0.10	Mozilla/5.0 (Linux; Android 16; SM-A065M Build/BP2A.250605.031.A3; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/147.0.7727.55 Mobile Safari/537.36	2026-04-30 10:39:54.308455+00
299a95fe-1c05-4f2a-9500-2e404f10e307	467290c0-3061-4bab-930b-791236a824f1	victoralfredo2498@gmail.com	SUPERADMIN | SOCIO	LOGIN_ADMIN	auth.users	467290c0-3061-4bab-930b-791236a824f1	\N	{"roles": ["SUPERADMIN", "SOCIO"], "metodo": "email"}	Autenticación Administrativa	10.11.0.10	Mozilla/5.0 (Linux; Android 16; SM-A065M Build/BP2A.250605.031.A3; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/147.0.7727.111 Mobile Safari/537.36	2026-04-30 12:44:51.828616+00
9c5bf0d7-7c46-4916-89f5-6791b1469379	467290c0-3061-4bab-930b-791236a824f1	victoralfredo2498@gmail.com	SUPERADMIN | SOCIO	LOGIN_ADMIN	auth.users	467290c0-3061-4bab-930b-791236a824f1	\N	{"roles": ["SUPERADMIN", "SOCIO"], "metodo": "email"}	Autenticación Administrativa	10.11.0.10	Mozilla/5.0 (Linux; Android 16; SM-A065M Build/BP2A.250605.031.A3; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/147.0.7727.111 Mobile Safari/537.36	2026-04-30 13:45:11.468982+00
896b7cb9-95c8-4ef2-b2a9-d5b7e5572dc6	467290c0-3061-4bab-930b-791236a824f1	victoralfredo2498@gmail.com	SUPERADMIN | SOCIO	LOGIN_ADMIN	auth.users	467290c0-3061-4bab-930b-791236a824f1	\N	{"roles": ["SUPERADMIN", "SOCIO"], "metodo": "email"}	Autenticación Administrativa	10.11.0.10	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36	2026-04-30 13:48:33.815137+00
6d6ef120-f760-4dfe-ad05-6a2779633134	467290c0-3061-4bab-930b-791236a824f1	victoralfredo2498@gmail.com	SUPERADMIN | SOCIO	LOGIN_ADMIN	auth.users	467290c0-3061-4bab-930b-791236a824f1	\N	{"roles": ["SUPERADMIN", "SOCIO"], "metodo": "email"}	Autenticación Administrativa	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36	2026-04-30 15:34:42.813744+00
939671f7-0e8b-4339-9fa8-1e949784e200	467290c0-3061-4bab-930b-791236a824f1	victoralfredo2498@gmail.com	SUPERADMIN | SOCIO	LOGIN_ADMIN	auth.users	467290c0-3061-4bab-930b-791236a824f1	\N	{"roles": ["SUPERADMIN", "SOCIO"], "metodo": "email"}	Autenticación Administrativa	10.11.0.10	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36	2026-04-30 15:58:18.020329+00
816289c5-0ff5-4ac0-b4ad-e05d9b91db5a	467290c0-3061-4bab-930b-791236a824f1	victoralfredo2498@gmail.com	SUPERADMIN | SOCIO	LOGIN_ADMIN	auth.users	467290c0-3061-4bab-930b-791236a824f1	\N	{"roles": ["SUPERADMIN", "SOCIO"], "metodo": "email"}	Autenticación Administrativa	10.11.0.10	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36	2026-04-30 16:27:41.965192+00
df1aefde-c4f9-482f-a16d-5353245d61b3	cb377de7-c49c-46b6-b735-3e42849ed1f0	Luciano.eche@gmail.com	ADMINISTRADOR | SOCIO	LOGIN_ADMIN	auth.users	cb377de7-c49c-46b6-b735-3e42849ed1f0	\N	{"roles": ["ADMINISTRADOR", "SOCIO"], "metodo": "email"}	Autenticación Administrativa	10.11.0.10	Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.3 Mobile/15E148 Safari/604.1	2026-04-30 19:05:05.312573+00
0f97f333-c504-40cc-b502-f2def2083a8c	467290c0-3061-4bab-930b-791236a824f1	victoralfredo2498@gmail.com	SUPERADMIN | SOCIO	LOGIN_ADMIN	auth.users	467290c0-3061-4bab-930b-791236a824f1	\N	{"roles": ["SUPERADMIN", "SOCIO"], "metodo": "email"}	Autenticación Administrativa	10.11.0.10	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36	2026-04-30 22:14:56.762454+00
0b560a79-691c-4dd3-a4fa-f74d935681e4	467290c0-3061-4bab-930b-791236a824f1	victoralfredo2498@gmail.com	ADMIN	UPDATE_STATUS	eventos_sociales	dcf61f51-ba08-4fca-8d2e-2c751471fb85	{"id": "dcf61f51-ba08-4fca-8d2e-2c751471fb85", "lugar": "A definir", "status": "borrador", "titulo": "Seguimos sumando beneficios para nuestros socios", "metadata": {"timestamp": "2026-04-30T15:32:56.000Z", "original_caption": "Seguimos sumando beneficios para nuestros socios\\n\\nDesde la SRNC firmamos un nuevo convenio con @melypilcheria2024 acercando a nuestros socios la posibilidad de acceder a prendas de todo tipo, con beneficios exclusivos 🙌\\n\\nCreemos en una sociedad rural que acompaña al productor en todos los aspectos de su vida, generando oportunidades también fuera del campo.", "original_media_url": "https://scontent-iad3-2.cdninstagram.com/o1/v/t2/f2/m86/AQMEbg5svgkMD7oSQvzva9xqLSSExHdHkTw-J5Drham-NCl_kMfsPUpuQTTXnBwJuqjEzx9Pv8W4JaBa4N57terlfDgJBExQ1qBqA3o.mp4?_nc_cat=105&_nc_sid=5e9851&_nc_ht=scontent-iad3-2.cdninstagram.com&_nc_ohc=DPmV0Hdmuy4Q7kNvwF42AmF&efg=eyJ2ZW5jb2RlX3RhZyI6Inhwdl9wcm9ncmVzc2l2ZS5JTlNUQUdSQU0uQ0xJUFMuQzMuNzIwLmRhc2hfYmFzZWxpbmVfMV92MSIsInhwdl9hc3NldF9pZCI6MTAwOTgyOTUxMTM5Nzk0NywiYXNzZXRfYWdlX2RheXMiOjAsInZpX3VzZWNhc2VfaWQiOjEwMDk5LCJkdXJhdGlvbl9zIjozMiwidXJsZ2VuX3NvdXJjZSI6Ind3dyJ9&ccb=17-1&vs=67ace8502072b840&_nc_vs=HBksFQIYUmlnX3hwdl9yZWVsc19wZXJtYW5lbnRfc3JfcHJvZC80QzQxQTkyRjAyODVDNDIyMzFENUJBNjMxNDFBQ0Y4Rl92aWRlb19kYXNoaW5pdC5tcDQVAALIARIAFQIYUWlnX3hwdl9wbGFjZW1lbnRfcGVybWFuZW50X3YyLzk3NDgzOEM0RTA5MzJENDhCNTYyOTA4QkNCOUM4NUE3X2F1ZGlvX2Rhc2hpbml0Lm1wNBUCAsgBEgAoABgAGwKIB3VzZV9vaWwBMRJwcm9ncmVzc2l2ZV9yZWNpcGUBMRUAACb2iPyU6JvLAxUCKAJDMywXQEBZmZmZmZoYEmRhc2hfYmFzZWxpbmVfMV92MREAdf4HZeadAQA&_nc_gid=0Mg9fc3jqBzQVBRSQGnAHw&edm=AM6HXa8EAAAA&_nc_zt=28&oh=00_Af78AjtJ9oISHxlzxp-qtTuL5j9oLxM2Ou1GSEhc_fRvgA&oe=69F5C2E6"}, "created_at": "2026-04-30T22:00:37.046912+00:00", "imagen_url": "https://jeeurezcswuchpzwgfno.supabase.co/storage/v1/object/public/imagenes-eventos/18458285032128664_48db85ee.jpg", "updated_at": "2026-04-30T22:00:37.046912+00:00", "external_id": "18458285032128664", "hora_evento": null, "fecha_evento": null, "descripcion_limpia": "Seguimos sumando beneficios para nuestros socios\\nDesde la SRNC firmamos un nuevo convenio con @melypilcheria2024 acercando a nuestros socios la posibilidad de acceder a prendas de todo tipo, con beneficios exclusivos 🙌\\nCreemos en una sociedad rural que acompaña al productor en todos los aspectos de su vida, generando oportunidades también fuera del campo."}	{"status": "aprobado"}	Gestión Eventos Sociales	10.11.0.10	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36	2026-04-30 22:15:57.861632+00
69d2eb2a-94ff-40e9-90ae-1cf6558e523a	467290c0-3061-4bab-930b-791236a824f1	victoralfredo2498@gmail.com	SUPERADMIN | SOCIO	LOGIN_ADMIN	auth.users	467290c0-3061-4bab-930b-791236a824f1	\N	{"roles": ["SUPERADMIN", "SOCIO"], "metodo": "email"}	Autenticación Administrativa	10.11.0.10	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36	2026-04-30 22:25:47.616555+00
bc94b024-8f19-4249-aa84-c2c9ad751c1b	467290c0-3061-4bab-930b-791236a824f1	victoralfredo2498@gmail.com	SUPERADMIN | SOCIO	LOGIN_ADMIN	auth.users	467290c0-3061-4bab-930b-791236a824f1	\N	{"roles": ["SUPERADMIN", "SOCIO"], "metodo": "email"}	Autenticación Administrativa	10.11.0.10	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36	2026-04-30 23:04:27.623997+00
4f8ed91b-c4a5-4fd5-b4b0-9af4b3716693	467290c0-3061-4bab-930b-791236a824f1	victoralfredo2498@gmail.com	SUPERADMIN | SOCIO	LOGIN_ADMIN	auth.users	467290c0-3061-4bab-930b-791236a824f1	\N	{"roles": ["SUPERADMIN", "SOCIO"], "metodo": "email"}	Autenticación Administrativa	10.11.0.10	Mozilla/5.0 (Linux; Android 16; SM-A065M Build/BP2A.250605.031.A3; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/147.0.7727.111 Mobile Safari/537.36	2026-05-01 01:59:54.217532+00
07363648-95be-45e5-bce8-10a15b5899a2	467290c0-3061-4bab-930b-791236a824f1	victoralfredo2498@gmail.com	SUPERADMIN | SOCIO	LOGIN_ADMIN	auth.users	467290c0-3061-4bab-930b-791236a824f1	\N	{"roles": ["SUPERADMIN", "SOCIO"], "metodo": "email"}	Autenticación Administrativa	10.11.0.10	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36	2026-05-01 20:18:57.441788+00
740f6644-e0bd-4aaf-8296-7a2feed458cf	467290c0-3061-4bab-930b-791236a824f1	victoralfredo2498@gmail.com	SUPERADMIN | SOCIO	LOGIN_ADMIN	auth.users	467290c0-3061-4bab-930b-791236a824f1	\N	{"roles": ["SUPERADMIN", "SOCIO"], "metodo": "email"}	Autenticación Administrativa	10.11.0.10	Mozilla/5.0 (Linux; Android 16; SM-A065M Build/BP2A.250605.031.A3; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/147.0.7727.111 Mobile Safari/537.36	2026-05-02 19:25:51.28668+00
c2d5cdab-44ee-499c-8ea7-6bc4cc5988de	467290c0-3061-4bab-930b-791236a824f1	victoralfredo2498@gmail.com	ADMIN	DELETE	eventos	e83e7288-62ee-4502-b87f-b18b1726dad3	{"id": "e83e7288-62ee-4502-b87f-b18b1726dad3", "slug": "gran-remate-ganadero--20260424", "tipo": "Remate", "fecha": "2026-04-24T00:00:00", "lugar": "Predio San Cosme", "estado": "publicado", "precio": null, "titulo": "Gran Remate Ganadero ", "publico": true, "contacto": null, "capacidad": null, "destacado": false, "direccion": null, "subtitulo": null, "video_url": null, "creado_por": null, "organizador": null, "link_externo": null, "municipio_id": "b734c5d8-552d-4321-aadf-68cf20f0c14d", "link_facebook": null, "link_whatsapp": null, "fecha_creacion": "2026-04-24T04:44:00.433446+00:00", "link_instagram": null, "coordenadas_lat": null, "coordenadas_lng": null, "galeria_imagenes": [], "imagen_principal": "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRsZiWXKDovtElvllA5xH3sr6YkW0T7mfNzGA&s", "descripcion_corta": "No se suspende por lluvia eh...", "descripcion_larga": null, "es_evento_de_un_dia": true, "fecha_actualizacion": "2026-05-01T20:04:55.034724+00:00", "requiere_inscripcion": false}	\N	Gestión Eventos	10.11.0.10	Mozilla/5.0 (Linux; Android 16; SM-A065M Build/BP2A.250605.031.A3; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/147.0.7727.111 Mobile Safari/537.36	2026-05-02 19:28:05.841851+00
ac444ae1-3ffe-49e8-8462-87c51a5c5b78	467290c0-3061-4bab-930b-791236a824f1	victoralfredo2498@gmail.com	SUPERADMIN | SOCIO	LOGIN_ADMIN	auth.users	467290c0-3061-4bab-930b-791236a824f1	\N	{"roles": ["SUPERADMIN", "SOCIO"], "metodo": "email"}	Autenticación Administrativa	10.11.0.10	Mozilla/5.0 (Linux; Android 16; SM-A065M Build/BP2A.250605.031.A3; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/147.0.7727.111 Mobile Safari/537.36	2026-05-02 19:29:36.501377+00
4e677f7c-b636-45a8-96f6-287faf0eb2f2	467290c0-3061-4bab-930b-791236a824f1	victoralfredo2498@gmail.com	ADMIN	UPDATE_STATUS	eventos_sociales	dcf61f51-ba08-4fca-8d2e-2c751471fb85	{"id": "dcf61f51-ba08-4fca-8d2e-2c751471fb85", "lugar": "A definir", "fuente": "sociedad_rural", "status": "aprobado", "titulo": "Seguimos sumando beneficios para nuestros socios", "metadata": {"timestamp": "2026-04-30T15:32:56.000Z", "original_caption": "Seguimos sumando beneficios para nuestros socios\\n\\nDesde la SRNC firmamos un nuevo convenio con @melypilcheria2024 acercando a nuestros socios la posibilidad de acceder a prendas de todo tipo, con beneficios exclusivos 🙌\\n\\nCreemos en una sociedad rural que acompaña al productor en todos los aspectos de su vida, generando oportunidades también fuera del campo.", "original_media_url": "https://scontent-iad3-2.cdninstagram.com/o1/v/t2/f2/m86/AQMEbg5svgkMD7oSQvzva9xqLSSExHdHkTw-J5Drham-NCl_kMfsPUpuQTTXnBwJuqjEzx9Pv8W4JaBa4N57terlfDgJBExQ1qBqA3o.mp4?_nc_cat=105&_nc_sid=5e9851&_nc_ht=scontent-iad3-2.cdninstagram.com&_nc_ohc=DPmV0Hdmuy4Q7kNvwF42AmF&efg=eyJ2ZW5jb2RlX3RhZyI6Inhwdl9wcm9ncmVzc2l2ZS5JTlNUQUdSQU0uQ0xJUFMuQzMuNzIwLmRhc2hfYmFzZWxpbmVfMV92MSIsInhwdl9hc3NldF9pZCI6MTAwOTgyOTUxMTM5Nzk0NywiYXNzZXRfYWdlX2RheXMiOjAsInZpX3VzZWNhc2VfaWQiOjEwMDk5LCJkdXJhdGlvbl9zIjozMiwidXJsZ2VuX3NvdXJjZSI6Ind3dyJ9&ccb=17-1&vs=67ace8502072b840&_nc_vs=HBksFQIYUmlnX3hwdl9yZWVsc19wZXJtYW5lbnRfc3JfcHJvZC80QzQxQTkyRjAyODVDNDIyMzFENUJBNjMxNDFBQ0Y4Rl92aWRlb19kYXNoaW5pdC5tcDQVAALIARIAFQIYUWlnX3hwdl9wbGFjZW1lbnRfcGVybWFuZW50X3YyLzk3NDgzOEM0RTA5MzJENDhCNTYyOTA4QkNCOUM4NUE3X2F1ZGlvX2Rhc2hpbml0Lm1wNBUCAsgBEgAoABgAGwKIB3VzZV9vaWwBMRJwcm9ncmVzc2l2ZV9yZWNpcGUBMRUAACb2iPyU6JvLAxUCKAJDMywXQEBZmZmZmZoYEmRhc2hfYmFzZWxpbmVfMV92MREAdf4HZeadAQA&_nc_gid=0Mg9fc3jqBzQVBRSQGnAHw&edm=AM6HXa8EAAAA&_nc_zt=28&oh=00_Af78AjtJ9oISHxlzxp-qtTuL5j9oLxM2Ou1GSEhc_fRvgA&oe=69F5C2E6"}, "created_at": "2026-04-30T22:00:37.046912+00:00", "imagen_url": "https://jeeurezcswuchpzwgfno.supabase.co/storage/v1/object/public/imagenes-eventos/18458285032128664_48db85ee.jpg", "updated_at": "2026-04-30T22:15:57.599146+00:00", "external_id": "18458285032128664", "hora_evento": null, "fecha_evento": null, "municipio_id": null, "descripcion_limpia": "Seguimos sumando beneficios para nuestros socios\\nDesde la SRNC firmamos un nuevo convenio con @melypilcheria2024 acercando a nuestros socios la posibilidad de acceder a prendas de todo tipo, con beneficios exclusivos 🙌\\nCreemos en una sociedad rural que acompaña al productor en todos los aspectos de su vida, generando oportunidades también fuera del campo."}	{"status": "rechazado"}	Gestión Eventos Sociales	10.11.0.10	Mozilla/5.0 (Linux; Android 16; SM-A065M Build/BP2A.250605.031.A3; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/147.0.7727.111 Mobile Safari/537.36	2026-05-02 19:30:29.502513+00
338aefdb-4d7c-4cb1-941e-41896d072d8f	467290c0-3061-4bab-930b-791236a824f1	victoralfredo2498@gmail.com	ADMIN	UPDATE_STATUS	eventos_sociales	dcf61f51-ba08-4fca-8d2e-2c751471fb85	{"id": "dcf61f51-ba08-4fca-8d2e-2c751471fb85", "lugar": "A definir", "fuente": "sociedad_rural", "status": "rechazado", "titulo": "Seguimos sumando beneficios para nuestros socios", "metadata": {"timestamp": "2026-04-30T15:32:56.000Z", "original_caption": "Seguimos sumando beneficios para nuestros socios\\n\\nDesde la SRNC firmamos un nuevo convenio con @melypilcheria2024 acercando a nuestros socios la posibilidad de acceder a prendas de todo tipo, con beneficios exclusivos 🙌\\n\\nCreemos en una sociedad rural que acompaña al productor en todos los aspectos de su vida, generando oportunidades también fuera del campo.", "original_media_url": "https://scontent-iad3-2.cdninstagram.com/o1/v/t2/f2/m86/AQMEbg5svgkMD7oSQvzva9xqLSSExHdHkTw-J5Drham-NCl_kMfsPUpuQTTXnBwJuqjEzx9Pv8W4JaBa4N57terlfDgJBExQ1qBqA3o.mp4?_nc_cat=105&_nc_sid=5e9851&_nc_ht=scontent-iad3-2.cdninstagram.com&_nc_ohc=DPmV0Hdmuy4Q7kNvwF42AmF&efg=eyJ2ZW5jb2RlX3RhZyI6Inhwdl9wcm9ncmVzc2l2ZS5JTlNUQUdSQU0uQ0xJUFMuQzMuNzIwLmRhc2hfYmFzZWxpbmVfMV92MSIsInhwdl9hc3NldF9pZCI6MTAwOTgyOTUxMTM5Nzk0NywiYXNzZXRfYWdlX2RheXMiOjAsInZpX3VzZWNhc2VfaWQiOjEwMDk5LCJkdXJhdGlvbl9zIjozMiwidXJsZ2VuX3NvdXJjZSI6Ind3dyJ9&ccb=17-1&vs=67ace8502072b840&_nc_vs=HBksFQIYUmlnX3hwdl9yZWVsc19wZXJtYW5lbnRfc3JfcHJvZC80QzQxQTkyRjAyODVDNDIyMzFENUJBNjMxNDFBQ0Y4Rl92aWRlb19kYXNoaW5pdC5tcDQVAALIARIAFQIYUWlnX3hwdl9wbGFjZW1lbnRfcGVybWFuZW50X3YyLzk3NDgzOEM0RTA5MzJENDhCNTYyOTA4QkNCOUM4NUE3X2F1ZGlvX2Rhc2hpbml0Lm1wNBUCAsgBEgAoABgAGwKIB3VzZV9vaWwBMRJwcm9ncmVzc2l2ZV9yZWNpcGUBMRUAACb2iPyU6JvLAxUCKAJDMywXQEBZmZmZmZoYEmRhc2hfYmFzZWxpbmVfMV92MREAdf4HZeadAQA&_nc_gid=0Mg9fc3jqBzQVBRSQGnAHw&edm=AM6HXa8EAAAA&_nc_zt=28&oh=00_Af78AjtJ9oISHxlzxp-qtTuL5j9oLxM2Ou1GSEhc_fRvgA&oe=69F5C2E6"}, "created_at": "2026-04-30T22:00:37.046912+00:00", "imagen_url": "https://jeeurezcswuchpzwgfno.supabase.co/storage/v1/object/public/imagenes-eventos/18458285032128664_48db85ee.jpg", "updated_at": "2026-05-02T19:30:29.262733+00:00", "external_id": "18458285032128664", "hora_evento": null, "fecha_evento": null, "municipio_id": null, "descripcion_limpia": "Seguimos sumando beneficios para nuestros socios\\nDesde la SRNC firmamos un nuevo convenio con @melypilcheria2024 acercando a nuestros socios la posibilidad de acceder a prendas de todo tipo, con beneficios exclusivos 🙌\\nCreemos en una sociedad rural que acompaña al productor en todos los aspectos de su vida, generando oportunidades también fuera del campo."}	{"status": "aprobado"}	Gestión Eventos Sociales	10.11.0.10	Mozilla/5.0 (Linux; Android 16; SM-A065M Build/BP2A.250605.031.A3; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/147.0.7727.111 Mobile Safari/537.36	2026-05-02 19:30:33.716084+00
3f6aac84-6556-47e0-a2b3-0136162dfa6c	467290c0-3061-4bab-930b-791236a824f1	victoralfredo2498@gmail.com	SUPERADMIN | SOCIO	LOGIN_ADMIN	auth.users	467290c0-3061-4bab-930b-791236a824f1	\N	{"roles": ["SUPERADMIN", "SOCIO"], "metodo": "email"}	Autenticación Administrativa	10.11.0.10	Mozilla/5.0 (Linux; Android 16; SM-A065M Build/BP2A.250605.031.A3; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/147.0.7727.111 Mobile Safari/537.36	2026-05-03 00:42:54.291478+00
d3427137-709a-43f7-bfa9-7dd099f30279	467290c0-3061-4bab-930b-791236a824f1	victoralfredo2498@gmail.com	SUPERADMIN | SOCIO	LOGIN_ADMIN	auth.users	467290c0-3061-4bab-930b-791236a824f1	\N	{"roles": ["SUPERADMIN", "SOCIO"], "metodo": "email"}	Autenticación Administrativa	10.11.0.10	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36	2026-05-03 01:58:18.377328+00
423d8363-d104-4bea-874f-995f8ee333fe	467290c0-3061-4bab-930b-791236a824f1	victoralfredo2498@gmail.com	ADMIN	UPDATE_STATUS	eventos_sociales	7b6f2813-49ea-476d-a80b-68e3448e8276	{"id": "7b6f2813-49ea-476d-a80b-68e3448e8276", "hora": "10:00:00", "slug": "17872082304664287", "tipo": null, "fecha": "2026-05-03", "lugar": "Corrientes", "estado": "aprobado", "fuente": "sociedad_rural", "status": "aprobado", "titulo": "Hoy dimos un paso más en la construcción de un vínculo real entre los estudiantes y el sector productivo 💪", "publico": true, "metadata": {"permalink": null, "timestamp": "2026-05-01T02:23:51.000Z", "media_type": "IMAGE", "original_caption": "Hoy dimos un paso más en la construcción de un vínculo real entre los estudiantes y el sector productivo 💪\\n\\nLa SRNC firmó un convenio con el Centro de Estudiantes de la Facultad de Ciencias Veterinarias, mediante el cual, a partir de ahora, el centro contará con un representante de la SRNC, que será elegido en cada elección estudiantil.\\n\\nEste acuerdo tiene un objetivo claro: trabajar en conjunto en proyectos, pasantías, capacitaciones y todas aquellas acciones que aporten al crecimiento de los estudiantes y al desarrollo del productor.\\n\\nSeguimos generando oportunidades, acercando el campo a la universidad y construyendo futuro.", "original_media_url": "https://scontent-iad3-1.cdninstagram.com/o1/v/t2/f2/m86/AQMJLICgC1eFv6dxaG2u56wAcJyedfp_5HkhGUXJLNydoHXqbneZ9WNVwu68cN3Q3PFDOkSqn103OE66Y74rCuIYpUxnizA7tPXlv-w.mp4?_nc_cat=108&_nc_sid=5e9851&_nc_ht=scontent-iad3-1.cdninstagram.com&_nc_ohc=ih9ncUhWOjMQ7kNvwGo7wOk&efg=eyJ2ZW5jb2RlX3RhZyI6Inhwdl9wcm9ncmVzc2l2ZS5JTlNUQUdSQU0uQ0xJUFMuQzMuNzIwLmRhc2hfYmFzZWxpbmVfMV92MSIsInhwdl9hc3NldF9pZCI6MTAxMTM0OTQwMTI2NTc3MSwiYXNzZXRfYWdlX2RheXMiOjEsInZpX3VzZWNhc2VfaWQiOjEwMDk5LCJkdXJhdGlvbl9zIjo0MSwidXJsZ2VuX3NvdXJjZSI6Ind3dyJ9&ccb=17-1&vs=ffed25ea95edfced&_nc_vs=HBksFQIYUmlnX3hwdl9yZWVsc19wZXJtYW5lbnRfc3JfcHJvZC8zNzRGNjA2MkE5RkNGRkM2RjM0QkRFOUM3RjJCN0Q5OF92aWRlb19kYXNoaW5pdC5tcDQVAALIARIAFQIYUWlnX3hwdl9wbGFjZW1lbnRfcGVybWFuZW50X3YyLzg1NEExMDFFQkNCQ0VFRDVFMTQwMzA1Rjg5NURBMTg0X2F1ZGlvX2Rhc2hpbml0Lm1wNBUCAsgBEgAoABgAGwKIB3VzZV9vaWwBMRJwcm9ncmVzc2l2ZV9yZWNpcGUBMRUAACbWmfOcpPTLAxUCKAJDMywXQETiDEm6XjUYEmRhc2hfYmFzZWxpbmVfMV92MREAdf4HZeadAQA&_nc_gid=NHLropGqZ2cylTMf-4zhPA&edm=AM6HXa8EAAAA&_nc_zt=28&oh=00_Af4N2HKsbFI4SVL-guHNrLmQDDRmFvJLUDzos6mN7hmBMw&oe=69F779E5"}, "destacado": false, "municipio": null, "created_at": "2026-05-02T06:02:59.34809+00:00", "imagen_url": "https://jeeurezcswuchpzwgfno.supabase.co/storage/v1/object/public/imagenes-eventos/17872082304664287_a88e8470.jpg", "updated_at": "2026-05-03T02:41:13.665146+00:00", "descripcion": "Hoy dimos un paso más en la construcción de un vínculo real entre los estudiantes y el sector productivo 💪\\nLa SRNC firmó un convenio con el Centro de Estudiantes de la Facultad de Ciencias Veterinarias, mediante el cual, a partir de ahora, el centro contará con un representante de la SRNC, que será elegido en cada elección estudiantil.\\nEste acuerdo tiene un objetivo claro: trabajar en conjunto en proyectos, pasantías, capacitaciones y todas aquellas acciones que aporten al crecimiento de los estudiantes y al desarrollo del productor.\\nSeguimos generando oportunidades, acercando el campo a la universidad y construyendo futuro.", "external_id": "17872082304664287", "hora_evento": "10:00:00", "fecha_evento": "2026-05-03", "link_externo": null, "municipio_id": null, "link_facebook": null, "link_whatsapp": null, "link_instagram": null, "descripcion_limpia": "Hoy dimos un paso más en la construcción de un vínculo real entre los estudiantes y el sector productivo 💪\\nLa SRNC firmó un convenio con el Centro de Estudiantes de la Facultad de Ciencias Veterinarias, mediante el cual, a partir de ahora, el centro contará con un representante de la SRNC, que será elegido en cada elección estudiantil.\\nEste acuerdo tiene un objetivo claro: trabajar en conjunto en proyectos, pasantías, capacitaciones y todas aquellas acciones que aporten al crecimiento de los estudiantes y al desarrollo del productor.\\nSeguimos generando oportunidades, acercando el campo a la universidad y construyendo futuro."}	{"status": "publicado"}	Gestión Eventos Sociales	10.11.0.10	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36	2026-05-03 02:53:42.618411+00
0c4ed174-ecd9-4cdf-a607-de9a2c7c3e20	467290c0-3061-4bab-930b-791236a824f1	victoralfredo2498@gmail.com	ADMIN	UPDATE	profiles	579417ad-55d6-42e6-a2ee-eaf674a58060	{"estado": "APROBADO"}	{"estado": "SUSPENDIDO"}	Gestión Usuarios	10.11.0.10	Mozilla/5.0 (Linux; Android 16; SM-A065M Build/BP2A.250605.031.A3; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/147.0.7727.111 Mobile Safari/537.36	2026-05-03 05:51:19.094793+00
b10db30c-b2a1-457d-abd9-70a4db7f45ea	467290c0-3061-4bab-930b-791236a824f1	victoralfredo2498@gmail.com	ADMIN	DELETE	auth.users / profiles	79429419-0980-4d04-82d5-be4a1831ec3a	{"id": "79429419-0980-4d04-82d5-be4a1831ec3a", "dni": "20314357894", "rol": "COMERCIO", "cuit": null, "email": "alberto@gmail.com", "rubro": "servicios_profesionales", "barrio": null, "estado": "APROBADO", "motivo": null, "foto_url": null, "telefono": "3744541236", "username": null, "direccion": null, "municipio": "Capital", "provincia": null, "user_type": "SOCIO", "created_at": "2026-04-27T10:30:24.446782+00:00", "titular_id": null, "updated_at": "2026-05-01T22:48:51.461401+00:00", "numero_socio": null, "tipo_vinculo": null, "es_estudiante": false, "es_profesional": false, "membership_type": "INDIVIDUAL", "nombre_apellido": "Dr. Alberto Del Orto", "camara_provincia": null, "email_verificado": true, "password_changed": false, "estado_aprobacion": "PENDIENTE", "camara_denominacion": null, "family_members_count": 1, "must_change_password": false, "email_verificacion_token": null, "constancia_estudiante_url": null, "email_verificacion_expira": null, "sonido_notificaciones_habilitado": true}	\N	Gestión Usuarios	10.11.0.10	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36	2026-05-03 02:01:26.962377+00
acf8e816-5d82-40ee-b317-7e76c63e1532	467290c0-3061-4bab-930b-791236a824f1	victoralfredo2498@gmail.com	ADMIN	CREATE	profiles	5ad40e85-a62e-47ab-a48c-9fed97cd9bff	\N	{"id": "5ad40e85-a62e-47ab-a48c-9fed97cd9bff", "dni": "202223333", "rol": "COMERCIO", "email": "farmar@gmail.com", "rubro": "comercio_general", "estado": "PENDIENTE", "telefono": "3795777777", "municipio": "Capital", "titular_id": null, "nombre_apellido": "Farmacia Farmar", "password_changed": false}	Gestión Comercios	10.11.0.10	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36	2026-05-03 02:03:22.396061+00
3a9e5874-971c-4b91-9d54-b9f37529492b	467290c0-3061-4bab-930b-791236a824f1	victoralfredo2498@gmail.com	ADMIN	UPDATE	profiles	5ad40e85-a62e-47ab-a48c-9fed97cd9bff	{"estado": "PENDIENTE"}	{"estado": "APROBADO"}	Gestión Usuarios	10.11.0.10	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36	2026-05-03 02:04:05.71685+00
fd92db6b-48a4-4199-88c7-f233016de743	467290c0-3061-4bab-930b-791236a824f1	victoralfredo2498@gmail.com	ADMIN	UPDATE	profiles	5ad40e85-a62e-47ab-a48c-9fed97cd9bff	{"id": "5ad40e85-a62e-47ab-a48c-9fed97cd9bff", "dni": "202223333", "rol": "COMERCIO", "cuit": null, "email": "farmar@gmail.com", "rubro": "comercio_general", "barrio": null, "estado": "APROBADO", "motivo": null, "foto_url": null, "telefono": "3795777777", "username": null, "direccion": null, "municipio": "Capital", "provincia": null, "user_type": "SOCIO", "created_at": "2026-05-03T02:03:21.84108+00:00", "titular_id": null, "updated_at": "2026-05-03T02:04:05.457979+00:00", "numero_socio": null, "tipo_vinculo": null, "es_estudiante": false, "es_profesional": false, "membership_type": "INDIVIDUAL", "nombre_apellido": "Farmacia Farmar", "camara_provincia": null, "email_verificado": false, "password_changed": false, "estado_aprobacion": "PENDIENTE", "camara_denominacion": null, "family_members_count": 1, "must_change_password": false, "email_verificacion_token": null, "constancia_estudiante_url": null, "email_verificacion_expira": null, "sonido_notificaciones_habilitado": true}	{"email": "farmar@gmail.com.ar", "telefono": "3795777777", "municipio": "Capital", "nombre_apellido": "Farmacia Farmar"}	Gestión Usuarios	10.11.0.10	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36	2026-05-03 02:04:45.250948+00
b7fc189c-7d8e-49fa-894a-f18c58dc194c	467290c0-3061-4bab-930b-791236a824f1	victoralfredo2498@gmail.com	ADMIN	UPDATE	profiles	5ad40e85-a62e-47ab-a48c-9fed97cd9bff	{"id": "5ad40e85-a62e-47ab-a48c-9fed97cd9bff", "dni": "202223333", "rol": "COMERCIO", "cuit": null, "email": "farmar@gmail.com.ar", "rubro": "comercio_general", "barrio": null, "estado": "APROBADO", "motivo": null, "foto_url": null, "telefono": "3795777777", "username": null, "direccion": null, "municipio": "Capital", "provincia": null, "user_type": "SOCIO", "created_at": "2026-05-03T02:03:21.84108+00:00", "titular_id": null, "updated_at": "2026-05-03T02:04:45.003658+00:00", "numero_socio": null, "tipo_vinculo": null, "es_estudiante": false, "es_profesional": false, "membership_type": "INDIVIDUAL", "nombre_apellido": "Farmacia Farmar", "camara_provincia": null, "email_verificado": false, "password_changed": false, "estado_aprobacion": "PENDIENTE", "camara_denominacion": null, "family_members_count": 1, "must_change_password": false, "email_verificacion_token": null, "constancia_estudiante_url": null, "email_verificacion_expira": null, "sonido_notificaciones_habilitado": true}	{"email": "farmar@gmail.com.ar", "telefono": "3795777778", "municipio": "Capital", "nombre_apellido": "Farmacia Farmar"}	Gestión Usuarios	10.11.0.10	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36	2026-05-03 02:04:54.591807+00
2df646a8-0927-4301-9d8b-6823b8fbc244	467290c0-3061-4bab-930b-791236a824f1	victoralfredo2498@gmail.com	ADMIN	UPDATE	profiles	5ad40e85-a62e-47ab-a48c-9fed97cd9bff	{"id": "5ad40e85-a62e-47ab-a48c-9fed97cd9bff", "dni": "202223333", "rol": "COMERCIO", "cuit": null, "email": "farmar@gmail.com.ar", "rubro": "comercio_general", "barrio": null, "estado": "APROBADO", "motivo": null, "foto_url": null, "telefono": "3795777778", "username": null, "direccion": null, "municipio": "Capital", "provincia": null, "user_type": "SOCIO", "created_at": "2026-05-03T02:03:21.84108+00:00", "titular_id": null, "updated_at": "2026-05-03T02:04:54.366556+00:00", "numero_socio": null, "tipo_vinculo": null, "es_estudiante": false, "es_profesional": false, "membership_type": "INDIVIDUAL", "nombre_apellido": "Farmacia Farmar", "camara_provincia": null, "email_verificado": false, "password_changed": false, "estado_aprobacion": "PENDIENTE", "camara_denominacion": null, "family_members_count": 1, "must_change_password": false, "email_verificacion_token": null, "constancia_estudiante_url": null, "email_verificacion_expira": null, "sonido_notificaciones_habilitado": true}	{"email": "farmar@gmail.com.ar", "telefono": "3795777778", "municipio": "Santa Ana", "nombre_apellido": "Farmacia Farmar"}	Gestión Usuarios	10.11.0.10	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36	2026-05-03 02:05:06.732794+00
2a7137e1-cda8-4ff7-98e7-a4e17cdd8cef	467290c0-3061-4bab-930b-791236a824f1	victoralfredo2498@gmail.com	ADMIN	UPDATE	profiles	5ad40e85-a62e-47ab-a48c-9fed97cd9bff	{"id": "5ad40e85-a62e-47ab-a48c-9fed97cd9bff", "dni": "202223333", "rol": "COMERCIO", "cuit": null, "email": "farmar@gmail.com.ar", "rubro": "comercio_general", "barrio": null, "estado": "APROBADO", "motivo": null, "foto_url": null, "telefono": "3795777778", "username": null, "direccion": null, "municipio": "Santa Ana", "provincia": null, "user_type": "SOCIO", "created_at": "2026-05-03T02:03:21.84108+00:00", "titular_id": null, "updated_at": "2026-05-03T02:05:06.504077+00:00", "numero_socio": null, "tipo_vinculo": null, "es_estudiante": false, "es_profesional": false, "membership_type": "INDIVIDUAL", "nombre_apellido": "Farmacia Farmar", "camara_provincia": null, "email_verificado": false, "password_changed": false, "estado_aprobacion": "PENDIENTE", "camara_denominacion": null, "family_members_count": 1, "must_change_password": false, "email_verificacion_token": null, "constancia_estudiante_url": null, "email_verificacion_expira": null, "sonido_notificaciones_habilitado": true}	{"email": "farmar@gmail.com.ar", "telefono": "3795777778", "municipio": "Santa Ana", "nombre_apellido": "Farmacia Farmar"}	Gestión Usuarios	10.11.0.10	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36	2026-05-03 02:05:21.137813+00
324782aa-89eb-4461-a2b3-e4377c3f71ac	467290c0-3061-4bab-930b-791236a824f1	victoralfredo2498@gmail.com	ADMIN	DELETE	auth.users / profiles	5ad40e85-a62e-47ab-a48c-9fed97cd9bff	{"id": "5ad40e85-a62e-47ab-a48c-9fed97cd9bff", "dni": "202223333", "rol": "COMERCIO", "cuit": null, "email": "farmar@gmail.com.ar", "rubro": "comercio_general", "barrio": null, "estado": "APROBADO", "motivo": null, "foto_url": null, "telefono": "3795777778", "username": null, "direccion": null, "municipio": "Santa Ana", "provincia": null, "user_type": "SOCIO", "created_at": "2026-05-03T02:03:21.84108+00:00", "titular_id": null, "updated_at": "2026-05-03T02:05:20.911001+00:00", "numero_socio": null, "tipo_vinculo": null, "es_estudiante": false, "es_profesional": false, "membership_type": "INDIVIDUAL", "nombre_apellido": "Farmacia Farmar", "camara_provincia": null, "email_verificado": false, "password_changed": false, "estado_aprobacion": "PENDIENTE", "camara_denominacion": null, "family_members_count": 1, "must_change_password": false, "email_verificacion_token": null, "constancia_estudiante_url": null, "email_verificacion_expira": null, "sonido_notificaciones_habilitado": true}	\N	Gestión Usuarios	10.11.0.10	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36	2026-05-03 02:06:07.283235+00
df3d8c36-c162-46e4-aede-57d371a93697	467290c0-3061-4bab-930b-791236a824f1	victoralfredo2498@gmail.com	SUPERADMIN	UPDATE	auth.users (Password)	e01afdff-da8f-469a-a054-9eb71ccf3766	\N	{"password_reset": true}	Gestión Usuarios	10.11.0.10	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36	2026-05-03 02:07:13.759893+00
08594437-db87-4b12-925e-65eda602157e	467290c0-3061-4bab-930b-791236a824f1	victoralfredo2498@gmail.com	ADMIN	CREATE	profiles	87199fe9-bc96-400c-9d98-008190649581	\N	{"id": "87199fe9-bc96-400c-9d98-008190649581", "dni": "15123456", "rol": "SOCIO", "email": "veterinario@gmail.com", "rubro": "Veterinario", "estado": "PENDIENTE", "telefono": "3777123456", "direccion": "Avenida Artiga 100", "municipio": "Capital", "provincia": "Corrientes", "es_profesional": true, "nombre_apellido": "Carlos Ruíz", "password_changed": false}	Gestión Profesionales	10.11.0.10	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36	2026-05-03 02:15:28.418662+00
c69845f9-4db8-4459-926b-73781d0fdd95	467290c0-3061-4bab-930b-791236a824f1	victoralfredo2498@gmail.com	ADMIN	UPDATE	profiles	87199fe9-bc96-400c-9d98-008190649581	{"estado": "PENDIENTE"}	{"estado": "APROBADO"}	Gestión Usuarios	10.11.0.10	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36	2026-05-03 02:15:40.967331+00
7d55857a-a944-47df-8813-9ef10b64f7d0	467290c0-3061-4bab-930b-791236a824f1	victoralfredo2498@gmail.com	ADMIN	DELETE	eventos	a7b1c5a0-1251-4607-9688-425c27e2a8ca	{"id": "a7b1c5a0-1251-4607-9688-425c27e2a8ca", "slug": "los-tipitos-20260509", "tipo": "Otro", "fecha": "2026-05-09T00:00:00", "lugar": "Capital Corrientes", "estado": "publicado", "precio": null, "titulo": "Los Tipitos", "publico": true, "contacto": null, "capacidad": null, "destacado": false, "direccion": null, "subtitulo": null, "video_url": null, "creado_por": null, "organizador": null, "link_externo": null, "municipio_id": "b734c5d8-552d-4321-aadf-68cf20f0c14d", "link_facebook": null, "link_whatsapp": null, "fecha_creacion": "2026-04-22T12:32:09.00978+00:00", "link_instagram": null, "coordenadas_lat": null, "coordenadas_lng": null, "galeria_imagenes": [], "imagen_principal": "https://teatrovera.com/images/2026-05-09_los-tipitos.jpeg", "descripcion_corta": "Teatro Oficial Juan de Vera, Vení a disfrutar de un espectáculo inolvidable A TODO ROCK!", "descripcion_larga": null, "es_evento_de_un_dia": true, "fecha_actualizacion": "2026-05-01T20:04:55.034724+00:00", "requiere_inscripcion": false}	\N	Gestión Eventos	10.11.0.10	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36	2026-05-03 02:17:48.223366+00
a9f0a38b-7368-4f3e-804b-5392cca20735	467290c0-3061-4bab-930b-791236a824f1	victoralfredo2498@gmail.com	ADMIN	UPDATE_STATUS	eventos_sociales	dcf61f51-ba08-4fca-8d2e-2c751471fb85	{"id": "dcf61f51-ba08-4fca-8d2e-2c751471fb85", "lugar": "A definir", "fuente": "sociedad_rural", "status": "aprobado", "titulo": "Seguimos sumando beneficios para nuestros socios", "metadata": {"timestamp": "2026-04-30T15:32:56.000Z", "original_caption": "Seguimos sumando beneficios para nuestros socios\\n\\nDesde la SRNC firmamos un nuevo convenio con @melypilcheria2024 acercando a nuestros socios la posibilidad de acceder a prendas de todo tipo, con beneficios exclusivos 🙌\\n\\nCreemos en una sociedad rural que acompaña al productor en todos los aspectos de su vida, generando oportunidades también fuera del campo.", "original_media_url": "https://scontent-iad3-2.cdninstagram.com/o1/v/t2/f2/m86/AQMEbg5svgkMD7oSQvzva9xqLSSExHdHkTw-J5Drham-NCl_kMfsPUpuQTTXnBwJuqjEzx9Pv8W4JaBa4N57terlfDgJBExQ1qBqA3o.mp4?_nc_cat=105&_nc_sid=5e9851&_nc_ht=scontent-iad3-2.cdninstagram.com&_nc_ohc=DPmV0Hdmuy4Q7kNvwF42AmF&efg=eyJ2ZW5jb2RlX3RhZyI6Inhwdl9wcm9ncmVzc2l2ZS5JTlNUQUdSQU0uQ0xJUFMuQzMuNzIwLmRhc2hfYmFzZWxpbmVfMV92MSIsInhwdl9hc3NldF9pZCI6MTAwOTgyOTUxMTM5Nzk0NywiYXNzZXRfYWdlX2RheXMiOjAsInZpX3VzZWNhc2VfaWQiOjEwMDk5LCJkdXJhdGlvbl9zIjozMiwidXJsZ2VuX3NvdXJjZSI6Ind3dyJ9&ccb=17-1&vs=67ace8502072b840&_nc_vs=HBksFQIYUmlnX3hwdl9yZWVsc19wZXJtYW5lbnRfc3JfcHJvZC80QzQxQTkyRjAyODVDNDIyMzFENUJBNjMxNDFBQ0Y4Rl92aWRlb19kYXNoaW5pdC5tcDQVAALIARIAFQIYUWlnX3hwdl9wbGFjZW1lbnRfcGVybWFuZW50X3YyLzk3NDgzOEM0RTA5MzJENDhCNTYyOTA4QkNCOUM4NUE3X2F1ZGlvX2Rhc2hpbml0Lm1wNBUCAsgBEgAoABgAGwKIB3VzZV9vaWwBMRJwcm9ncmVzc2l2ZV9yZWNpcGUBMRUAACb2iPyU6JvLAxUCKAJDMywXQEBZmZmZmZoYEmRhc2hfYmFzZWxpbmVfMV92MREAdf4HZeadAQA&_nc_gid=0Mg9fc3jqBzQVBRSQGnAHw&edm=AM6HXa8EAAAA&_nc_zt=28&oh=00_Af78AjtJ9oISHxlzxp-qtTuL5j9oLxM2Ou1GSEhc_fRvgA&oe=69F5C2E6"}, "created_at": "2026-04-30T22:00:37.046912+00:00", "imagen_url": "https://jeeurezcswuchpzwgfno.supabase.co/storage/v1/object/public/imagenes-eventos/18458285032128664_48db85ee.jpg", "updated_at": "2026-05-02T19:30:33.495556+00:00", "external_id": "18458285032128664", "hora_evento": null, "fecha_evento": null, "municipio_id": null, "descripcion_limpia": "Seguimos sumando beneficios para nuestros socios\\nDesde la SRNC firmamos un nuevo convenio con @melypilcheria2024 acercando a nuestros socios la posibilidad de acceder a prendas de todo tipo, con beneficios exclusivos 🙌\\nCreemos en una sociedad rural que acompaña al productor en todos los aspectos de su vida, generando oportunidades también fuera del campo."}	{"status": "rechazado"}	Gestión Eventos Sociales	10.11.0.10	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36	2026-05-03 02:19:59.784873+00
dc0eb297-ee43-4f7f-99ae-daccb646f1ef	467290c0-3061-4bab-930b-791236a824f1	victoralfredo2498@gmail.com	ADMIN	UPDATE_STATUS	eventos_sociales	dcf61f51-ba08-4fca-8d2e-2c751471fb85	{"id": "dcf61f51-ba08-4fca-8d2e-2c751471fb85", "lugar": "A definir", "fuente": "sociedad_rural", "status": "rechazado", "titulo": "Seguimos sumando beneficios para nuestros socios", "metadata": {"timestamp": "2026-04-30T15:32:56.000Z", "original_caption": "Seguimos sumando beneficios para nuestros socios\\n\\nDesde la SRNC firmamos un nuevo convenio con @melypilcheria2024 acercando a nuestros socios la posibilidad de acceder a prendas de todo tipo, con beneficios exclusivos 🙌\\n\\nCreemos en una sociedad rural que acompaña al productor en todos los aspectos de su vida, generando oportunidades también fuera del campo.", "original_media_url": "https://scontent-iad3-2.cdninstagram.com/o1/v/t2/f2/m86/AQMEbg5svgkMD7oSQvzva9xqLSSExHdHkTw-J5Drham-NCl_kMfsPUpuQTTXnBwJuqjEzx9Pv8W4JaBa4N57terlfDgJBExQ1qBqA3o.mp4?_nc_cat=105&_nc_sid=5e9851&_nc_ht=scontent-iad3-2.cdninstagram.com&_nc_ohc=DPmV0Hdmuy4Q7kNvwF42AmF&efg=eyJ2ZW5jb2RlX3RhZyI6Inhwdl9wcm9ncmVzc2l2ZS5JTlNUQUdSQU0uQ0xJUFMuQzMuNzIwLmRhc2hfYmFzZWxpbmVfMV92MSIsInhwdl9hc3NldF9pZCI6MTAwOTgyOTUxMTM5Nzk0NywiYXNzZXRfYWdlX2RheXMiOjAsInZpX3VzZWNhc2VfaWQiOjEwMDk5LCJkdXJhdGlvbl9zIjozMiwidXJsZ2VuX3NvdXJjZSI6Ind3dyJ9&ccb=17-1&vs=67ace8502072b840&_nc_vs=HBksFQIYUmlnX3hwdl9yZWVsc19wZXJtYW5lbnRfc3JfcHJvZC80QzQxQTkyRjAyODVDNDIyMzFENUJBNjMxNDFBQ0Y4Rl92aWRlb19kYXNoaW5pdC5tcDQVAALIARIAFQIYUWlnX3hwdl9wbGFjZW1lbnRfcGVybWFuZW50X3YyLzk3NDgzOEM0RTA5MzJENDhCNTYyOTA4QkNCOUM4NUE3X2F1ZGlvX2Rhc2hpbml0Lm1wNBUCAsgBEgAoABgAGwKIB3VzZV9vaWwBMRJwcm9ncmVzc2l2ZV9yZWNpcGUBMRUAACb2iPyU6JvLAxUCKAJDMywXQEBZmZmZmZoYEmRhc2hfYmFzZWxpbmVfMV92MREAdf4HZeadAQA&_nc_gid=0Mg9fc3jqBzQVBRSQGnAHw&edm=AM6HXa8EAAAA&_nc_zt=28&oh=00_Af78AjtJ9oISHxlzxp-qtTuL5j9oLxM2Ou1GSEhc_fRvgA&oe=69F5C2E6"}, "created_at": "2026-04-30T22:00:37.046912+00:00", "imagen_url": "https://jeeurezcswuchpzwgfno.supabase.co/storage/v1/object/public/imagenes-eventos/18458285032128664_48db85ee.jpg", "updated_at": "2026-05-03T02:19:59.556152+00:00", "external_id": "18458285032128664", "hora_evento": null, "fecha_evento": null, "municipio_id": null, "descripcion_limpia": "Seguimos sumando beneficios para nuestros socios\\nDesde la SRNC firmamos un nuevo convenio con @melypilcheria2024 acercando a nuestros socios la posibilidad de acceder a prendas de todo tipo, con beneficios exclusivos 🙌\\nCreemos en una sociedad rural que acompaña al productor en todos los aspectos de su vida, generando oportunidades también fuera del campo."}	{"status": "aprobado"}	Gestión Eventos Sociales	10.11.0.10	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36	2026-05-03 02:20:05.264776+00
35445bb8-a9ba-4104-8308-395b3536ef8d	467290c0-3061-4bab-930b-791236a824f1	victoralfredo2498@gmail.com	ADMIN	UPDATE_STATUS	eventos_sociales	7b6f2813-49ea-476d-a80b-68e3448e8276	{"id": "7b6f2813-49ea-476d-a80b-68e3448e8276", "lugar": "A definir", "fuente": "sociedad_rural", "status": "aprobado", "titulo": "Hoy dimos un paso más en la construcción de un vínculo real entre los estudiantes y el sector productivo 💪", "metadata": {"permalink": null, "timestamp": "2026-05-01T02:23:51.000Z", "media_type": "IMAGE", "original_caption": "Hoy dimos un paso más en la construcción de un vínculo real entre los estudiantes y el sector productivo 💪\\n\\nLa SRNC firmó un convenio con el Centro de Estudiantes de la Facultad de Ciencias Veterinarias, mediante el cual, a partir de ahora, el centro contará con un representante de la SRNC, que será elegido en cada elección estudiantil.\\n\\nEste acuerdo tiene un objetivo claro: trabajar en conjunto en proyectos, pasantías, capacitaciones y todas aquellas acciones que aporten al crecimiento de los estudiantes y al desarrollo del productor.\\n\\nSeguimos generando oportunidades, acercando el campo a la universidad y construyendo futuro.", "original_media_url": "https://scontent-iad3-1.cdninstagram.com/o1/v/t2/f2/m86/AQMJLICgC1eFv6dxaG2u56wAcJyedfp_5HkhGUXJLNydoHXqbneZ9WNVwu68cN3Q3PFDOkSqn103OE66Y74rCuIYpUxnizA7tPXlv-w.mp4?_nc_cat=108&_nc_sid=5e9851&_nc_ht=scontent-iad3-1.cdninstagram.com&_nc_ohc=ih9ncUhWOjMQ7kNvwGo7wOk&efg=eyJ2ZW5jb2RlX3RhZyI6Inhwdl9wcm9ncmVzc2l2ZS5JTlNUQUdSQU0uQ0xJUFMuQzMuNzIwLmRhc2hfYmFzZWxpbmVfMV92MSIsInhwdl9hc3NldF9pZCI6MTAxMTM0OTQwMTI2NTc3MSwiYXNzZXRfYWdlX2RheXMiOjEsInZpX3VzZWNhc2VfaWQiOjEwMDk5LCJkdXJhdGlvbl9zIjo0MSwidXJsZ2VuX3NvdXJjZSI6Ind3dyJ9&ccb=17-1&vs=ffed25ea95edfced&_nc_vs=HBksFQIYUmlnX3hwdl9yZWVsc19wZXJtYW5lbnRfc3JfcHJvZC8zNzRGNjA2MkE5RkNGRkM2RjM0QkRFOUM3RjJCN0Q5OF92aWRlb19kYXNoaW5pdC5tcDQVAALIARIAFQIYUWlnX3hwdl9wbGFjZW1lbnRfcGVybWFuZW50X3YyLzg1NEExMDFFQkNCQ0VFRDVFMTQwMzA1Rjg5NURBMTg0X2F1ZGlvX2Rhc2hpbml0Lm1wNBUCAsgBEgAoABgAGwKIB3VzZV9vaWwBMRJwcm9ncmVzc2l2ZV9yZWNpcGUBMRUAACbWmfOcpPTLAxUCKAJDMywXQETiDEm6XjUYEmRhc2hfYmFzZWxpbmVfMV92MREAdf4HZeadAQA&_nc_gid=NHLropGqZ2cylTMf-4zhPA&edm=AM6HXa8EAAAA&_nc_zt=28&oh=00_Af4N2HKsbFI4SVL-guHNrLmQDDRmFvJLUDzos6mN7hmBMw&oe=69F779E5"}, "created_at": "2026-05-02T06:02:59.34809+00:00", "imagen_url": "https://jeeurezcswuchpzwgfno.supabase.co/storage/v1/object/public/imagenes-eventos/17872082304664287_a88e8470.jpg", "updated_at": "2026-05-02T06:02:59.34809+00:00", "external_id": "17872082304664287", "hora_evento": null, "fecha_evento": null, "municipio_id": null, "descripcion_limpia": "Hoy dimos un paso más en la construcción de un vínculo real entre los estudiantes y el sector productivo 💪\\nLa SRNC firmó un convenio con el Centro de Estudiantes de la Facultad de Ciencias Veterinarias, mediante el cual, a partir de ahora, el centro contará con un representante de la SRNC, que será elegido en cada elección estudiantil.\\nEste acuerdo tiene un objetivo claro: trabajar en conjunto en proyectos, pasantías, capacitaciones y todas aquellas acciones que aporten al crecimiento de los estudiantes y al desarrollo del productor.\\nSeguimos generando oportunidades, acercando el campo a la universidad y construyendo futuro."}	{"status": "rechazado"}	Gestión Eventos Sociales	10.11.0.10	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36	2026-05-03 02:21:05.196717+00
c34af483-8943-4760-a4c1-6d6f7e33b230	467290c0-3061-4bab-930b-791236a824f1	victoralfredo2498@gmail.com	ADMIN	UPDATE_STATUS	eventos_sociales	7b6f2813-49ea-476d-a80b-68e3448e8276	{"id": "7b6f2813-49ea-476d-a80b-68e3448e8276", "lugar": "A definir", "fuente": "sociedad_rural", "status": "rechazado", "titulo": "Hoy dimos un paso más en la construcción de un vínculo real entre los estudiantes y el sector productivo 💪", "metadata": {"permalink": null, "timestamp": "2026-05-01T02:23:51.000Z", "media_type": "IMAGE", "original_caption": "Hoy dimos un paso más en la construcción de un vínculo real entre los estudiantes y el sector productivo 💪\\n\\nLa SRNC firmó un convenio con el Centro de Estudiantes de la Facultad de Ciencias Veterinarias, mediante el cual, a partir de ahora, el centro contará con un representante de la SRNC, que será elegido en cada elección estudiantil.\\n\\nEste acuerdo tiene un objetivo claro: trabajar en conjunto en proyectos, pasantías, capacitaciones y todas aquellas acciones que aporten al crecimiento de los estudiantes y al desarrollo del productor.\\n\\nSeguimos generando oportunidades, acercando el campo a la universidad y construyendo futuro.", "original_media_url": "https://scontent-iad3-1.cdninstagram.com/o1/v/t2/f2/m86/AQMJLICgC1eFv6dxaG2u56wAcJyedfp_5HkhGUXJLNydoHXqbneZ9WNVwu68cN3Q3PFDOkSqn103OE66Y74rCuIYpUxnizA7tPXlv-w.mp4?_nc_cat=108&_nc_sid=5e9851&_nc_ht=scontent-iad3-1.cdninstagram.com&_nc_ohc=ih9ncUhWOjMQ7kNvwGo7wOk&efg=eyJ2ZW5jb2RlX3RhZyI6Inhwdl9wcm9ncmVzc2l2ZS5JTlNUQUdSQU0uQ0xJUFMuQzMuNzIwLmRhc2hfYmFzZWxpbmVfMV92MSIsInhwdl9hc3NldF9pZCI6MTAxMTM0OTQwMTI2NTc3MSwiYXNzZXRfYWdlX2RheXMiOjEsInZpX3VzZWNhc2VfaWQiOjEwMDk5LCJkdXJhdGlvbl9zIjo0MSwidXJsZ2VuX3NvdXJjZSI6Ind3dyJ9&ccb=17-1&vs=ffed25ea95edfced&_nc_vs=HBksFQIYUmlnX3hwdl9yZWVsc19wZXJtYW5lbnRfc3JfcHJvZC8zNzRGNjA2MkE5RkNGRkM2RjM0QkRFOUM3RjJCN0Q5OF92aWRlb19kYXNoaW5pdC5tcDQVAALIARIAFQIYUWlnX3hwdl9wbGFjZW1lbnRfcGVybWFuZW50X3YyLzg1NEExMDFFQkNCQ0VFRDVFMTQwMzA1Rjg5NURBMTg0X2F1ZGlvX2Rhc2hpbml0Lm1wNBUCAsgBEgAoABgAGwKIB3VzZV9vaWwBMRJwcm9ncmVzc2l2ZV9yZWNpcGUBMRUAACbWmfOcpPTLAxUCKAJDMywXQETiDEm6XjUYEmRhc2hfYmFzZWxpbmVfMV92MREAdf4HZeadAQA&_nc_gid=NHLropGqZ2cylTMf-4zhPA&edm=AM6HXa8EAAAA&_nc_zt=28&oh=00_Af4N2HKsbFI4SVL-guHNrLmQDDRmFvJLUDzos6mN7hmBMw&oe=69F779E5"}, "created_at": "2026-05-02T06:02:59.34809+00:00", "imagen_url": "https://jeeurezcswuchpzwgfno.supabase.co/storage/v1/object/public/imagenes-eventos/17872082304664287_a88e8470.jpg", "updated_at": "2026-05-03T02:21:04.963993+00:00", "external_id": "17872082304664287", "hora_evento": null, "fecha_evento": null, "municipio_id": null, "descripcion_limpia": "Hoy dimos un paso más en la construcción de un vínculo real entre los estudiantes y el sector productivo 💪\\nLa SRNC firmó un convenio con el Centro de Estudiantes de la Facultad de Ciencias Veterinarias, mediante el cual, a partir de ahora, el centro contará con un representante de la SRNC, que será elegido en cada elección estudiantil.\\nEste acuerdo tiene un objetivo claro: trabajar en conjunto en proyectos, pasantías, capacitaciones y todas aquellas acciones que aporten al crecimiento de los estudiantes y al desarrollo del productor.\\nSeguimos generando oportunidades, acercando el campo a la universidad y construyendo futuro."}	{"status": "aprobado"}	Gestión Eventos Sociales	10.11.0.10	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36	2026-05-03 02:21:09.649782+00
df430648-c636-461b-a96b-69da3fa034a7	467290c0-3061-4bab-930b-791236a824f1	victoralfredo2498@gmail.com	ADMIN	DELETE	eventos_sociales	dcf61f51-ba08-4fca-8d2e-2c751471fb85	{"id": "dcf61f51-ba08-4fca-8d2e-2c751471fb85", "lugar": "A definir", "fuente": "sociedad_rural", "status": "aprobado", "titulo": "Seguimos sumando beneficios para nuestros socios", "metadata": {"timestamp": "2026-04-30T15:32:56.000Z", "original_caption": "Seguimos sumando beneficios para nuestros socios\\n\\nDesde la SRNC firmamos un nuevo convenio con @melypilcheria2024 acercando a nuestros socios la posibilidad de acceder a prendas de todo tipo, con beneficios exclusivos 🙌\\n\\nCreemos en una sociedad rural que acompaña al productor en todos los aspectos de su vida, generando oportunidades también fuera del campo.", "original_media_url": "https://scontent-iad3-2.cdninstagram.com/o1/v/t2/f2/m86/AQMEbg5svgkMD7oSQvzva9xqLSSExHdHkTw-J5Drham-NCl_kMfsPUpuQTTXnBwJuqjEzx9Pv8W4JaBa4N57terlfDgJBExQ1qBqA3o.mp4?_nc_cat=105&_nc_sid=5e9851&_nc_ht=scontent-iad3-2.cdninstagram.com&_nc_ohc=DPmV0Hdmuy4Q7kNvwF42AmF&efg=eyJ2ZW5jb2RlX3RhZyI6Inhwdl9wcm9ncmVzc2l2ZS5JTlNUQUdSQU0uQ0xJUFMuQzMuNzIwLmRhc2hfYmFzZWxpbmVfMV92MSIsInhwdl9hc3NldF9pZCI6MTAwOTgyOTUxMTM5Nzk0NywiYXNzZXRfYWdlX2RheXMiOjAsInZpX3VzZWNhc2VfaWQiOjEwMDk5LCJkdXJhdGlvbl9zIjozMiwidXJsZ2VuX3NvdXJjZSI6Ind3dyJ9&ccb=17-1&vs=67ace8502072b840&_nc_vs=HBksFQIYUmlnX3hwdl9yZWVsc19wZXJtYW5lbnRfc3JfcHJvZC80QzQxQTkyRjAyODVDNDIyMzFENUJBNjMxNDFBQ0Y4Rl92aWRlb19kYXNoaW5pdC5tcDQVAALIARIAFQIYUWlnX3hwdl9wbGFjZW1lbnRfcGVybWFuZW50X3YyLzk3NDgzOEM0RTA5MzJENDhCNTYyOTA4QkNCOUM4NUE3X2F1ZGlvX2Rhc2hpbml0Lm1wNBUCAsgBEgAoABgAGwKIB3VzZV9vaWwBMRJwcm9ncmVzc2l2ZV9yZWNpcGUBMRUAACb2iPyU6JvLAxUCKAJDMywXQEBZmZmZmZoYEmRhc2hfYmFzZWxpbmVfMV92MREAdf4HZeadAQA&_nc_gid=0Mg9fc3jqBzQVBRSQGnAHw&edm=AM6HXa8EAAAA&_nc_zt=28&oh=00_Af78AjtJ9oISHxlzxp-qtTuL5j9oLxM2Ou1GSEhc_fRvgA&oe=69F5C2E6"}, "created_at": "2026-04-30T22:00:37.046912+00:00", "imagen_url": "https://jeeurezcswuchpzwgfno.supabase.co/storage/v1/object/public/imagenes-eventos/18458285032128664_48db85ee.jpg", "updated_at": "2026-05-03T02:20:05.025904+00:00", "external_id": "18458285032128664", "hora_evento": null, "fecha_evento": null, "municipio_id": null, "descripcion_limpia": "Seguimos sumando beneficios para nuestros socios\\nDesde la SRNC firmamos un nuevo convenio con @melypilcheria2024 acercando a nuestros socios la posibilidad de acceder a prendas de todo tipo, con beneficios exclusivos 🙌\\nCreemos en una sociedad rural que acompaña al productor en todos los aspectos de su vida, generando oportunidades también fuera del campo."}	\N	Gestión Eventos Sociales	10.11.0.10	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36	2026-05-03 02:21:21.788849+00
df4824a9-7c69-49a9-a0c7-bbbbd03de3fa	467290c0-3061-4bab-930b-791236a824f1	victoralfredo2498@gmail.com	ADMIN	UPDATE_STATUS	eventos_sociales	7b6f2813-49ea-476d-a80b-68e3448e8276	{"id": "7b6f2813-49ea-476d-a80b-68e3448e8276", "lugar": "A definir", "fuente": "sociedad_rural", "status": "aprobado", "titulo": "Hoy dimos un paso más en la construcción de un vínculo real entre los estudiantes y el sector productivo 💪", "metadata": {"permalink": null, "timestamp": "2026-05-01T02:23:51.000Z", "media_type": "IMAGE", "original_caption": "Hoy dimos un paso más en la construcción de un vínculo real entre los estudiantes y el sector productivo 💪\\n\\nLa SRNC firmó un convenio con el Centro de Estudiantes de la Facultad de Ciencias Veterinarias, mediante el cual, a partir de ahora, el centro contará con un representante de la SRNC, que será elegido en cada elección estudiantil.\\n\\nEste acuerdo tiene un objetivo claro: trabajar en conjunto en proyectos, pasantías, capacitaciones y todas aquellas acciones que aporten al crecimiento de los estudiantes y al desarrollo del productor.\\n\\nSeguimos generando oportunidades, acercando el campo a la universidad y construyendo futuro.", "original_media_url": "https://scontent-iad3-1.cdninstagram.com/o1/v/t2/f2/m86/AQMJLICgC1eFv6dxaG2u56wAcJyedfp_5HkhGUXJLNydoHXqbneZ9WNVwu68cN3Q3PFDOkSqn103OE66Y74rCuIYpUxnizA7tPXlv-w.mp4?_nc_cat=108&_nc_sid=5e9851&_nc_ht=scontent-iad3-1.cdninstagram.com&_nc_ohc=ih9ncUhWOjMQ7kNvwGo7wOk&efg=eyJ2ZW5jb2RlX3RhZyI6Inhwdl9wcm9ncmVzc2l2ZS5JTlNUQUdSQU0uQ0xJUFMuQzMuNzIwLmRhc2hfYmFzZWxpbmVfMV92MSIsInhwdl9hc3NldF9pZCI6MTAxMTM0OTQwMTI2NTc3MSwiYXNzZXRfYWdlX2RheXMiOjEsInZpX3VzZWNhc2VfaWQiOjEwMDk5LCJkdXJhdGlvbl9zIjo0MSwidXJsZ2VuX3NvdXJjZSI6Ind3dyJ9&ccb=17-1&vs=ffed25ea95edfced&_nc_vs=HBksFQIYUmlnX3hwdl9yZWVsc19wZXJtYW5lbnRfc3JfcHJvZC8zNzRGNjA2MkE5RkNGRkM2RjM0QkRFOUM3RjJCN0Q5OF92aWRlb19kYXNoaW5pdC5tcDQVAALIARIAFQIYUWlnX3hwdl9wbGFjZW1lbnRfcGVybWFuZW50X3YyLzg1NEExMDFFQkNCQ0VFRDVFMTQwMzA1Rjg5NURBMTg0X2F1ZGlvX2Rhc2hpbml0Lm1wNBUCAsgBEgAoABgAGwKIB3VzZV9vaWwBMRJwcm9ncmVzc2l2ZV9yZWNpcGUBMRUAACbWmfOcpPTLAxUCKAJDMywXQETiDEm6XjUYEmRhc2hfYmFzZWxpbmVfMV92MREAdf4HZeadAQA&_nc_gid=NHLropGqZ2cylTMf-4zhPA&edm=AM6HXa8EAAAA&_nc_zt=28&oh=00_Af4N2HKsbFI4SVL-guHNrLmQDDRmFvJLUDzos6mN7hmBMw&oe=69F779E5"}, "created_at": "2026-05-02T06:02:59.34809+00:00", "imagen_url": "https://jeeurezcswuchpzwgfno.supabase.co/storage/v1/object/public/imagenes-eventos/17872082304664287_a88e8470.jpg", "updated_at": "2026-05-03T02:21:09.415071+00:00", "external_id": "17872082304664287", "hora_evento": null, "fecha_evento": null, "municipio_id": null, "descripcion_limpia": "Hoy dimos un paso más en la construcción de un vínculo real entre los estudiantes y el sector productivo 💪\\nLa SRNC firmó un convenio con el Centro de Estudiantes de la Facultad de Ciencias Veterinarias, mediante el cual, a partir de ahora, el centro contará con un representante de la SRNC, que será elegido en cada elección estudiantil.\\nEste acuerdo tiene un objetivo claro: trabajar en conjunto en proyectos, pasantías, capacitaciones y todas aquellas acciones que aporten al crecimiento de los estudiantes y al desarrollo del productor.\\nSeguimos generando oportunidades, acercando el campo a la universidad y construyendo futuro."}	{"status": "rechazado"}	Gestión Eventos Sociales	10.11.0.10	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36	2026-05-03 02:22:13.808643+00
1d58f870-f4dd-416e-b610-90e1ffc63285	467290c0-3061-4bab-930b-791236a824f1	victoralfredo2498@gmail.com	ADMIN	UPDATE_STATUS	eventos_sociales	7b6f2813-49ea-476d-a80b-68e3448e8276	{"id": "7b6f2813-49ea-476d-a80b-68e3448e8276", "lugar": "A definir", "fuente": "sociedad_rural", "status": "rechazado", "titulo": "Hoy dimos un paso más en la construcción de un vínculo real entre los estudiantes y el sector productivo 💪", "metadata": {"permalink": null, "timestamp": "2026-05-01T02:23:51.000Z", "media_type": "IMAGE", "original_caption": "Hoy dimos un paso más en la construcción de un vínculo real entre los estudiantes y el sector productivo 💪\\n\\nLa SRNC firmó un convenio con el Centro de Estudiantes de la Facultad de Ciencias Veterinarias, mediante el cual, a partir de ahora, el centro contará con un representante de la SRNC, que será elegido en cada elección estudiantil.\\n\\nEste acuerdo tiene un objetivo claro: trabajar en conjunto en proyectos, pasantías, capacitaciones y todas aquellas acciones que aporten al crecimiento de los estudiantes y al desarrollo del productor.\\n\\nSeguimos generando oportunidades, acercando el campo a la universidad y construyendo futuro.", "original_media_url": "https://scontent-iad3-1.cdninstagram.com/o1/v/t2/f2/m86/AQMJLICgC1eFv6dxaG2u56wAcJyedfp_5HkhGUXJLNydoHXqbneZ9WNVwu68cN3Q3PFDOkSqn103OE66Y74rCuIYpUxnizA7tPXlv-w.mp4?_nc_cat=108&_nc_sid=5e9851&_nc_ht=scontent-iad3-1.cdninstagram.com&_nc_ohc=ih9ncUhWOjMQ7kNvwGo7wOk&efg=eyJ2ZW5jb2RlX3RhZyI6Inhwdl9wcm9ncmVzc2l2ZS5JTlNUQUdSQU0uQ0xJUFMuQzMuNzIwLmRhc2hfYmFzZWxpbmVfMV92MSIsInhwdl9hc3NldF9pZCI6MTAxMTM0OTQwMTI2NTc3MSwiYXNzZXRfYWdlX2RheXMiOjEsInZpX3VzZWNhc2VfaWQiOjEwMDk5LCJkdXJhdGlvbl9zIjo0MSwidXJsZ2VuX3NvdXJjZSI6Ind3dyJ9&ccb=17-1&vs=ffed25ea95edfced&_nc_vs=HBksFQIYUmlnX3hwdl9yZWVsc19wZXJtYW5lbnRfc3JfcHJvZC8zNzRGNjA2MkE5RkNGRkM2RjM0QkRFOUM3RjJCN0Q5OF92aWRlb19kYXNoaW5pdC5tcDQVAALIARIAFQIYUWlnX3hwdl9wbGFjZW1lbnRfcGVybWFuZW50X3YyLzg1NEExMDFFQkNCQ0VFRDVFMTQwMzA1Rjg5NURBMTg0X2F1ZGlvX2Rhc2hpbml0Lm1wNBUCAsgBEgAoABgAGwKIB3VzZV9vaWwBMRJwcm9ncmVzc2l2ZV9yZWNpcGUBMRUAACbWmfOcpPTLAxUCKAJDMywXQETiDEm6XjUYEmRhc2hfYmFzZWxpbmVfMV92MREAdf4HZeadAQA&_nc_gid=NHLropGqZ2cylTMf-4zhPA&edm=AM6HXa8EAAAA&_nc_zt=28&oh=00_Af4N2HKsbFI4SVL-guHNrLmQDDRmFvJLUDzos6mN7hmBMw&oe=69F779E5"}, "created_at": "2026-05-02T06:02:59.34809+00:00", "imagen_url": "https://jeeurezcswuchpzwgfno.supabase.co/storage/v1/object/public/imagenes-eventos/17872082304664287_a88e8470.jpg", "updated_at": "2026-05-03T02:22:13.522868+00:00", "external_id": "17872082304664287", "hora_evento": null, "fecha_evento": null, "municipio_id": null, "descripcion_limpia": "Hoy dimos un paso más en la construcción de un vínculo real entre los estudiantes y el sector productivo 💪\\nLa SRNC firmó un convenio con el Centro de Estudiantes de la Facultad de Ciencias Veterinarias, mediante el cual, a partir de ahora, el centro contará con un representante de la SRNC, que será elegido en cada elección estudiantil.\\nEste acuerdo tiene un objetivo claro: trabajar en conjunto en proyectos, pasantías, capacitaciones y todas aquellas acciones que aporten al crecimiento de los estudiantes y al desarrollo del productor.\\nSeguimos generando oportunidades, acercando el campo a la universidad y construyendo futuro."}	{"status": "aprobado"}	Gestión Eventos Sociales	10.11.0.10	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36	2026-05-03 02:22:17.520648+00
22902432-420d-4901-92f0-5eeab2de1e45	467290c0-3061-4bab-930b-791236a824f1	victoralfredo2498@gmail.com	ADMIN	UPDATE	eventos_sociales	7b6f2813-49ea-476d-a80b-68e3448e8276	{"id": "7b6f2813-49ea-476d-a80b-68e3448e8276", "lugar": "A definir", "fuente": "sociedad_rural", "status": "aprobado", "titulo": "Hoy dimos un paso más en la construcción de un vínculo real entre los estudiantes y el sector productivo 💪", "metadata": {"permalink": null, "timestamp": "2026-05-01T02:23:51.000Z", "media_type": "IMAGE", "original_caption": "Hoy dimos un paso más en la construcción de un vínculo real entre los estudiantes y el sector productivo 💪\\n\\nLa SRNC firmó un convenio con el Centro de Estudiantes de la Facultad de Ciencias Veterinarias, mediante el cual, a partir de ahora, el centro contará con un representante de la SRNC, que será elegido en cada elección estudiantil.\\n\\nEste acuerdo tiene un objetivo claro: trabajar en conjunto en proyectos, pasantías, capacitaciones y todas aquellas acciones que aporten al crecimiento de los estudiantes y al desarrollo del productor.\\n\\nSeguimos generando oportunidades, acercando el campo a la universidad y construyendo futuro.", "original_media_url": "https://scontent-iad3-1.cdninstagram.com/o1/v/t2/f2/m86/AQMJLICgC1eFv6dxaG2u56wAcJyedfp_5HkhGUXJLNydoHXqbneZ9WNVwu68cN3Q3PFDOkSqn103OE66Y74rCuIYpUxnizA7tPXlv-w.mp4?_nc_cat=108&_nc_sid=5e9851&_nc_ht=scontent-iad3-1.cdninstagram.com&_nc_ohc=ih9ncUhWOjMQ7kNvwGo7wOk&efg=eyJ2ZW5jb2RlX3RhZyI6Inhwdl9wcm9ncmVzc2l2ZS5JTlNUQUdSQU0uQ0xJUFMuQzMuNzIwLmRhc2hfYmFzZWxpbmVfMV92MSIsInhwdl9hc3NldF9pZCI6MTAxMTM0OTQwMTI2NTc3MSwiYXNzZXRfYWdlX2RheXMiOjEsInZpX3VzZWNhc2VfaWQiOjEwMDk5LCJkdXJhdGlvbl9zIjo0MSwidXJsZ2VuX3NvdXJjZSI6Ind3dyJ9&ccb=17-1&vs=ffed25ea95edfced&_nc_vs=HBksFQIYUmlnX3hwdl9yZWVsc19wZXJtYW5lbnRfc3JfcHJvZC8zNzRGNjA2MkE5RkNGRkM2RjM0QkRFOUM3RjJCN0Q5OF92aWRlb19kYXNoaW5pdC5tcDQVAALIARIAFQIYUWlnX3hwdl9wbGFjZW1lbnRfcGVybWFuZW50X3YyLzg1NEExMDFFQkNCQ0VFRDVFMTQwMzA1Rjg5NURBMTg0X2F1ZGlvX2Rhc2hpbml0Lm1wNBUCAsgBEgAoABgAGwKIB3VzZV9vaWwBMRJwcm9ncmVzc2l2ZV9yZWNpcGUBMRUAACbWmfOcpPTLAxUCKAJDMywXQETiDEm6XjUYEmRhc2hfYmFzZWxpbmVfMV92MREAdf4HZeadAQA&_nc_gid=NHLropGqZ2cylTMf-4zhPA&edm=AM6HXa8EAAAA&_nc_zt=28&oh=00_Af4N2HKsbFI4SVL-guHNrLmQDDRmFvJLUDzos6mN7hmBMw&oe=69F779E5"}, "created_at": "2026-05-02T06:02:59.34809+00:00", "imagen_url": "https://jeeurezcswuchpzwgfno.supabase.co/storage/v1/object/public/imagenes-eventos/17872082304664287_a88e8470.jpg", "updated_at": "2026-05-03T02:22:17.280286+00:00", "external_id": "17872082304664287", "hora_evento": null, "fecha_evento": null, "municipio_id": null, "descripcion_limpia": "Hoy dimos un paso más en la construcción de un vínculo real entre los estudiantes y el sector productivo 💪\\nLa SRNC firmó un convenio con el Centro de Estudiantes de la Facultad de Ciencias Veterinarias, mediante el cual, a partir de ahora, el centro contará con un representante de la SRNC, que será elegido en cada elección estudiantil.\\nEste acuerdo tiene un objetivo claro: trabajar en conjunto en proyectos, pasantías, capacitaciones y todas aquellas acciones que aporten al crecimiento de los estudiantes y al desarrollo del productor.\\nSeguimos generando oportunidades, acercando el campo a la universidad y construyendo futuro."}	{"lugar": "Corrientes", "titulo": "Hoy dimos un paso más en la construcción de un vínculo real entre los estudiantes y el sector productivo 💪", "imagen_url": "https://jeeurezcswuchpzwgfno.supabase.co/storage/v1/object/public/imagenes-eventos/17872082304664287_a88e8470.jpg", "hora_evento": "10:00", "fecha_evento": "2026-05-03", "descripcion_limpia": "Hoy dimos un paso más en la construcción de un vínculo real entre los estudiantes y el sector productivo 💪\\nLa SRNC firmó un convenio con el Centro de Estudiantes de la Facultad de Ciencias Veterinarias, mediante el cual, a partir de ahora, el centro contará con un representante de la SRNC, que será elegido en cada elección estudiantil.\\nEste acuerdo tiene un objetivo claro: trabajar en conjunto en proyectos, pasantías, capacitaciones y todas aquellas acciones que aporten al crecimiento de los estudiantes y al desarrollo del productor.\\nSeguimos generando oportunidades, acercando el campo a la universidad y construyendo futuro."}	Gestión Eventos Sociales	10.11.0.10	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36	2026-05-03 02:24:54.602446+00
3e25ee0d-79d9-4498-b101-9fedb666b214	467290c0-3061-4bab-930b-791236a824f1	victoralfredo2498@gmail.com	ADMIN	CREATE	eventos_sociales	ab2440cd-24fe-48ab-921f-14ac64034626	\N	{"hora": "09:00", "slug": "gran-remate-ganadero-5cf832", "tipo": "Remate", "fecha": "2026-05-05", "lugar": "Predio Virgen de Itatí", "estado": "publicado", "fuente": "admin", "titulo": "Gran Remate Ganadero", "publico": true, "destacado": false, "imagen_url": "https://www.infocampo.com.ar/wp-content/uploads/2018/06/remate.jpg", "descripcion": "vengan pue loco, no se caguen", "external_id": "manual_f0522043-1aa6-41fa-a46c-4433c590a05c", "tipo_origen": "manual", "link_externo": "https://www.instagram.com/reel/DRK5GtKAZ05/", "municipio_id": "c27848ec-da9e-4c08-8c69-63e4136d3132", "link_facebook": "https://www.facebook.com/reel/DRK5GtKAZ05/", "link_whatsapp": "378964521", "link_instagram": "https://www.instagram.com/reel/DRK5GtKAZ05/"}	Gestión Eventos	10.11.0.10	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36	2026-05-03 03:44:01.991305+00
8a3c4f7c-0274-4b9e-bbae-77bddd8e6f8f	467290c0-3061-4bab-930b-791236a824f1	victoralfredo2498@gmail.com	ADMIN	DELETE	eventos_sociales	ab2440cd-24fe-48ab-921f-14ac64034626	{"id": "ab2440cd-24fe-48ab-921f-14ac64034626", "hora": "09:00:00", "slug": "gran-remate-ganadero-5cf832", "tipo": "Remate", "fecha": "2026-05-05", "lugar": "Predio Virgen de Itatí", "estado": "publicado", "fuente": "admin", "status": "borrador", "titulo": "Gran Remate Ganadero", "publico": true, "metadata": null, "destacado": false, "municipio": null, "created_at": "2026-05-03T03:44:01.547982+00:00", "imagen_url": "https://www.infocampo.com.ar/wp-content/uploads/2018/06/remate.jpg", "updated_at": "2026-05-03T03:44:01.547982+00:00", "descripcion": "vengan pue loco, no se caguen", "external_id": "manual_f0522043-1aa6-41fa-a46c-4433c590a05c", "hora_evento": null, "tipo_origen": "manual", "fecha_evento": null, "link_externo": "https://www.instagram.com/reel/DRK5GtKAZ05/", "municipio_id": "c27848ec-da9e-4c08-8c69-63e4136d3132", "link_facebook": "https://www.facebook.com/reel/DRK5GtKAZ05/", "link_whatsapp": "378964521", "link_instagram": "https://www.instagram.com/reel/DRK5GtKAZ05/", "descripcion_limpia": null}	\N	Gestión Eventos	10.11.0.10	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36	2026-05-03 03:44:16.642864+00
9502bf83-f879-4e0c-a6c1-7882fa7b10b0	467290c0-3061-4bab-930b-791236a824f1	victoralfredo2498@gmail.com	ADMIN	CREATE	eventos_sociales	9ae8750b-2a5e-4e6a-a64f-31abd2b2e9e5	\N	{"hora": "09:00", "slug": "gran-remate-ganadero-5146cc", "tipo": "Remate", "fecha": "2026-05-05", "lugar": "Predio Feria Virgen de Itatí", "estado": "publicado", "fuente": "admin", "titulo": "Gran Remate Ganadero", "publico": true, "destacado": false, "imagen_url": "", "descripcion": "Vengan pe", "external_id": "manual_afb2cf67-2b4a-439f-8a4b-15540fdcc1bb", "tipo_origen": "manual", "link_externo": "https://facebook.com/", "municipio_id": "c27848ec-da9e-4c08-8c69-63e4136d3132", "link_facebook": "https://www.facebook.com/CamaraCSGoficial/posts/-8-gran-remate-c%C3%A1mara-de-caba%C3%B1as-santafesinas-de-ganado-%EF%B8%8F-200-reproductores%EF%B8%8F-27-/1103950051752118/", "link_whatsapp": "123452369", "link_instagram": "https://www.instagram.com/p/DQw84uEAQbL/"}	Gestión Eventos	10.11.0.10	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36	2026-05-03 03:54:26.459503+00
151a2acd-7bdd-4f89-937a-6cb7c98d55d0	467290c0-3061-4bab-930b-791236a824f1	victoralfredo2498@gmail.com	ADMIN	UPDATE	eventos_sociales	9ae8750b-2a5e-4e6a-a64f-31abd2b2e9e5	{"id": "9ae8750b-2a5e-4e6a-a64f-31abd2b2e9e5", "hora": "09:00:00", "slug": "gran-remate-ganadero-5146cc", "tipo": "Remate", "fecha": "2026-05-05", "lugar": "Predio Feria Virgen de Itatí", "estado": "publicado", "fuente": "admin", "status": "borrador", "titulo": "Gran Remate Ganadero", "publico": true, "metadata": null, "destacado": false, "municipio": null, "created_at": "2026-05-03T03:54:26.189278+00:00", "imagen_url": "", "updated_at": "2026-05-03T03:54:26.189278+00:00", "descripcion": "Vengan pe", "external_id": "manual_afb2cf67-2b4a-439f-8a4b-15540fdcc1bb", "hora_evento": null, "tipo_origen": "manual", "fecha_evento": null, "link_externo": "https://facebook.com/", "municipio_id": "c27848ec-da9e-4c08-8c69-63e4136d3132", "link_facebook": "https://www.facebook.com/CamaraCSGoficial/posts/-8-gran-remate-c%C3%A1mara-de-caba%C3%B1as-santafesinas-de-ganado-%EF%B8%8F-200-reproductores%EF%B8%8F-27-/1103950051752118/", "link_whatsapp": "123452369", "link_instagram": "https://www.instagram.com/p/DQw84uEAQbL/", "descripcion_limpia": null}	{"hora": "09:00:00", "slug": "gran-remate-ganadero-79f40c", "tipo": "Remate", "fecha": "2026-05-05", "lugar": "Predio Feria Virgen de Itatí", "estado": "publicado", "titulo": "Gran Remate Ganadero", "publico": true, "destacado": false, "imagen_url": "", "descripcion": "Vengan pe", "link_externo": "https://facebook.com/", "municipio_id": "c27848ec-da9e-4c08-8c69-63e4136d3132", "link_facebook": "https://www.facebook.com/CamaraCSGoficial/posts/-8-gran-remate-c%C3%A1mara-de-caba%C3%B1as-santafesinas-de-ganado-%EF%B8%8F-200-reproductores%EF%B8%8F-27-/1103950051752118/", "link_whatsapp": "123452369", "link_instagram": "https://www.instagram.com/p/DQw84uEAQbL/"}	Gestión Eventos	10.11.0.10	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36	2026-05-03 03:54:41.090345+00
a219112e-1417-488b-8685-ef8b1185ab7f	467290c0-3061-4bab-930b-791236a824f1	victoralfredo2498@gmail.com	ADMIN	UPDATE	eventos_sociales	9ae8750b-2a5e-4e6a-a64f-31abd2b2e9e5	{"id": "9ae8750b-2a5e-4e6a-a64f-31abd2b2e9e5", "hora": "09:00:00", "slug": "gran-remate-ganadero-79f40c", "tipo": "Remate", "fecha": "2026-05-05", "lugar": "Predio Feria Virgen de Itatí", "estado": "publicado", "fuente": "admin", "status": "borrador", "titulo": "Gran Remate Ganadero", "publico": true, "metadata": null, "destacado": false, "municipio": null, "created_at": "2026-05-03T03:54:26.189278+00:00", "imagen_url": "", "updated_at": "2026-05-03T03:54:40.840599+00:00", "descripcion": "Vengan pe", "external_id": "manual_afb2cf67-2b4a-439f-8a4b-15540fdcc1bb", "hora_evento": null, "tipo_origen": "manual", "fecha_evento": null, "link_externo": "https://facebook.com/", "municipio_id": "c27848ec-da9e-4c08-8c69-63e4136d3132", "link_facebook": "https://www.facebook.com/CamaraCSGoficial/posts/-8-gran-remate-c%C3%A1mara-de-caba%C3%B1as-santafesinas-de-ganado-%EF%B8%8F-200-reproductores%EF%B8%8F-27-/1103950051752118/", "link_whatsapp": "123452369", "link_instagram": "https://www.instagram.com/p/DQw84uEAQbL/", "descripcion_limpia": null}	{"hora": "09:00:00", "slug": "gran-remate-ganadero-13d326", "tipo": "Remate", "fecha": "2026-05-05", "lugar": "Predio Feria Virgen de Itatí", "estado": "publicado", "titulo": "Gran Remate Ganadero", "publico": true, "destacado": false, "imagen_url": "", "descripcion": "Vengan pe", "link_externo": "https://facebook.com/", "municipio_id": "c27848ec-da9e-4c08-8c69-63e4136d3132", "link_facebook": "https://www.facebook.com/CamaraCSGoficial/posts/-8-gran-remate-c%C3%A1mara-de-caba%C3%B1as-santafesinas-de-ganado-%EF%B8%8F-200-reproductores%EF%B8%8F-27-/1103950051752118/", "link_whatsapp": "1234523690", "link_instagram": "https://www.instagram.com/p/DQw84uEAQbL/"}	Gestión Eventos	10.11.0.10	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36	2026-05-03 03:55:01.952407+00
dedbf51e-c2f9-47f8-a41e-19a91de07d93	467290c0-3061-4bab-930b-791236a824f1	victoralfredo2498@gmail.com	SUPERADMIN | SOCIO	LOGIN_ADMIN	auth.users	467290c0-3061-4bab-930b-791236a824f1	\N	{"roles": ["SUPERADMIN", "SOCIO"], "metodo": "email"}	Autenticación Administrativa	10.11.0.10	Mozilla/5.0 (Linux; Android 16; SM-A065M Build/BP2A.250605.031.A3; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/147.0.7727.111 Mobile Safari/537.36	2026-05-03 05:50:57.993228+00
a8951673-318d-4dee-bcb5-2e5635b07546	467290c0-3061-4bab-930b-791236a824f1	victoralfredo2498@gmail.com	ADMIN	UPDATE	eventos_sociales	9ae8750b-2a5e-4e6a-a64f-31abd2b2e9e5	{"id": "9ae8750b-2a5e-4e6a-a64f-31abd2b2e9e5", "hora": "09:00:00", "slug": "gran-remate-ganadero-13d326", "tipo": "Remate", "fecha": "2026-05-05", "lugar": "Predio Feria Virgen de Itatí", "estado": "publicado", "fuente": "admin", "status": "borrador", "titulo": "Gran Remate Ganadero", "publico": true, "metadata": null, "destacado": false, "municipio": null, "created_at": "2026-05-03T03:54:26.189278+00:00", "imagen_url": "", "updated_at": "2026-05-03T03:55:01.73281+00:00", "descripcion": "Vengan pe", "external_id": "manual_afb2cf67-2b4a-439f-8a4b-15540fdcc1bb", "hora_evento": null, "tipo_origen": "manual", "fecha_evento": null, "link_externo": "https://facebook.com/", "municipio_id": "c27848ec-da9e-4c08-8c69-63e4136d3132", "link_facebook": "https://www.facebook.com/CamaraCSGoficial/posts/-8-gran-remate-c%C3%A1mara-de-caba%C3%B1as-santafesinas-de-ganado-%EF%B8%8F-200-reproductores%EF%B8%8F-27-/1103950051752118/", "link_whatsapp": "1234523690", "link_instagram": "https://www.instagram.com/p/DQw84uEAQbL/", "descripcion_limpia": null}	{"hora": "09:00:00", "slug": "gran-remate-ganadero-781c66", "tipo": "Remate", "fecha": "2026-05-05", "lugar": "Predio Feria Virgen de Itatí", "estado": "publicado", "titulo": "Gran Remate Ganadero", "publico": true, "destacado": false, "imagen_url": "", "descripcion": "Vengan pe", "link_externo": "https://facebook.com/", "municipio_id": "c27848ec-da9e-4c08-8c69-63e4136d3132", "link_facebook": "https://www.facebook.com/CamaraCSGoficial/posts/-8-gran-remate-c%C3%A1mara-de-caba%C3%B1as-santafesinas-de-ganado-%EF%B8%8F-200-reproductores%EF%B8%8F-27-/1103950051752118/", "link_whatsapp": "1234523690", "link_instagram": "https://www.instagram.com/p/DQw84uEAQbL/"}	Gestión Eventos	10.11.0.10	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36	2026-05-03 03:55:25.929234+00
0b62d125-387f-45d1-814d-b1f173ad3464	76f21a92-edf0-44b2-b0d8-93e2f86be330	julio@gmail.com	SOCIO	CREATE	profiles	76f21a92-edf0-44b2-b0d8-93e2f86be330	\N	{"id": "76f21a92-edf0-44b2-b0d8-93e2f86be330", "dni": "15456789", "rol": "SOCIO", "email": "julio@gmail.com", "rubro": null, "barrio": "Centro", "estado": "PENDIENTE", "telefono": "3793112233", "direccion": null, "municipio": "Ituzaingó", "provincia": "Corrientes", "es_estudiante": true, "es_profesional": false, "nombre_apellido": "Julio López", "email_verificado": false, "password_changed": false, "email_verificacion_token": "E8sZ02fei9rpjJ0LcZs2sG18Ix-p_rqQb29ApDL1jpA", "constancia_estudiante_url": null, "email_verificacion_expira": "2026-05-05T02:08:45.296673"}	Registro Cuentas	10.11.0.10	Mozilla/5.0 (Linux; Android 16; SM-A065M Build/BP2A.250605.031.A3; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/147.0.7727.111 Mobile Safari/537.36	2026-05-03 05:08:45.893617+00
6652ba1c-c301-4a21-b951-209e4bfb9e70	467290c0-3061-4bab-930b-791236a824f1	victoralfredo2498@gmail.com	SUPERADMIN | SOCIO	LOGIN_ADMIN	auth.users	467290c0-3061-4bab-930b-791236a824f1	\N	{"roles": ["SUPERADMIN", "SOCIO"], "metodo": "email"}	Autenticación Administrativa	10.11.0.10	Mozilla/5.0 (Linux; Android 16; SM-A065M Build/BP2A.250605.031.A3; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/147.0.7727.111 Mobile Safari/537.36	2026-05-03 05:11:15.013699+00
2c38267f-2096-4868-bc18-2c743b06eb26	467290c0-3061-4bab-930b-791236a824f1	victoralfredo2498@gmail.com	ADMIN	UPDATE	profiles	76f21a92-edf0-44b2-b0d8-93e2f86be330	{"estado": "PENDIENTE"}	{"estado": "APROBADO"}	Gestión Usuarios	10.11.0.10	Mozilla/5.0 (Linux; Android 16; SM-A065M Build/BP2A.250605.031.A3; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/147.0.7727.111 Mobile Safari/537.36	2026-05-03 05:12:36.096034+00
c4e705c8-25f9-4d9b-a2f1-9d1593368baa	467290c0-3061-4bab-930b-791236a824f1	victoralfredo2498@gmail.com	SUPERADMIN | SOCIO	LOGIN_ADMIN	auth.users	467290c0-3061-4bab-930b-791236a824f1	\N	{"roles": ["SUPERADMIN", "SOCIO"], "metodo": "email"}	Autenticación Administrativa	10.11.0.10	Mozilla/5.0 (Linux; Android 16; SM-A065M Build/BP2A.250605.031.A3; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/147.0.7727.111 Mobile Safari/537.36	2026-05-03 05:15:40.420732+00
d47a9540-ed78-4302-ba95-fd74277cac2b	467290c0-3061-4bab-930b-791236a824f1	victoralfredo2498@gmail.com	ADMIN	DELETE	auth.users / profiles	76f21a92-edf0-44b2-b0d8-93e2f86be330	{"id": "76f21a92-edf0-44b2-b0d8-93e2f86be330", "dni": "15456789", "rol": "SOCIO", "cuit": null, "email": "julio@gmail.com", "rubro": null, "barrio": "Centro", "estado": "APROBADO", "motivo": null, "foto_url": null, "telefono": "3793112233", "username": null, "direccion": null, "municipio": "Ituzaingó", "provincia": "Corrientes", "user_type": "SOCIO", "created_at": "2026-05-03T05:08:45.569074+00:00", "tipo_socio": null, "titular_id": null, "updated_at": "2026-05-03T05:12:35.855893+00:00", "numero_socio": "0011", "tipo_vinculo": null, "es_estudiante": true, "es_profesional": false, "membership_type": "INDIVIDUAL", "nombre_apellido": "Julio López", "camara_provincia": null, "email_verificado": false, "password_changed": false, "estado_aprobacion": "PENDIENTE", "camara_denominacion": null, "family_members_count": 1, "must_change_password": false, "email_verificacion_token": "E8sZ02fei9rpjJ0LcZs2sG18Ix-p_rqQb29ApDL1jpA", "constancia_estudiante_url": null, "email_verificacion_expira": "2026-05-05T02:08:45.296673+00:00", "sonido_notificaciones_habilitado": true}	\N	Gestión Usuarios	10.11.0.10	Mozilla/5.0 (Linux; Android 16; SM-A065M Build/BP2A.250605.031.A3; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/147.0.7727.111 Mobile Safari/537.36	2026-05-03 05:16:38.969713+00
6d3ff461-5599-42ea-8c97-56b211a75ce0	579417ad-55d6-42e6-a2ee-eaf674a58060	flormaciel85@gmail.com	SOCIO	CREATE	profiles	579417ad-55d6-42e6-a2ee-eaf674a58060	\N	{"id": "579417ad-55d6-42e6-a2ee-eaf674a58060", "dni": "31759748", "rol": "SOCIO", "email": "flormaciel85@gmail.com", "rubro": null, "barrio": "Centro", "estado": "PENDIENTE", "telefono": "3794668633", "direccion": null, "municipio": "Capital", "provincia": "Corrientes", "es_estudiante": false, "es_profesional": true, "nombre_apellido": "Luisa Florencia Maciel", "email_verificado": false, "password_changed": false, "email_verificacion_token": "CIUzsJsIRrdveGSm8re-6SY4qp957cj5-vy5OAg-0L8", "constancia_estudiante_url": null, "email_verificacion_expira": "2026-05-05T02:28:37.893488"}	Registro Cuentas	10.11.0.10	Mozilla/5.0 (Linux; Android 16; SM-A065M Build/BP2A.250605.031.A3; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/147.0.7727.111 Mobile Safari/537.36	2026-05-03 05:28:38.443857+00
e93c8831-d7e8-4455-83c1-4881c83ca552	467290c0-3061-4bab-930b-791236a824f1	victoralfredo2498@gmail.com	SUPERADMIN | SOCIO	LOGIN_ADMIN	auth.users	467290c0-3061-4bab-930b-791236a824f1	\N	{"roles": ["SUPERADMIN", "SOCIO"], "metodo": "email"}	Autenticación Administrativa	10.11.0.10	Mozilla/5.0 (Linux; Android 16; SM-A065M Build/BP2A.250605.031.A3; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/147.0.7727.111 Mobile Safari/537.36	2026-05-03 05:31:45.332011+00
4e915784-f3c0-47bf-a7d6-a62a2f279c78	467290c0-3061-4bab-930b-791236a824f1	victoralfredo2498@gmail.com	ADMIN	UPDATE	profiles	579417ad-55d6-42e6-a2ee-eaf674a58060	{"estado": "PENDIENTE"}	{"estado": "APROBADO"}	Gestión Usuarios	10.11.0.10	Mozilla/5.0 (Linux; Android 16; SM-A065M Build/BP2A.250605.031.A3; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/147.0.7727.111 Mobile Safari/537.36	2026-05-03 05:32:16.401197+00
da53cd75-ebc9-43a6-8cb7-027842fe0aca	579417ad-55d6-42e6-a2ee-eaf674a58060	flormaciel85@gmail.com	\N	UPDATE	profiles	579417ad-55d6-42e6-a2ee-eaf674a58060	\N	{"password_changed": true}	Seguridad	10.11.0.10	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Mobile Safari/537.36	2026-05-03 05:33:28.06357+00
c9d9169b-5d3a-4183-bf2b-b993820e42fc	467290c0-3061-4bab-930b-791236a824f1	victoralfredo2498@gmail.com	ADMIN	UPDATE	profiles	579417ad-55d6-42e6-a2ee-eaf674a58060	{"estado": "SUSPENDIDO"}	{"estado": "APROBADO"}	Gestión Usuarios	10.11.0.10	Mozilla/5.0 (Linux; Android 16; SM-A065M Build/BP2A.250605.031.A3; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/147.0.7727.111 Mobile Safari/537.36	2026-05-03 05:51:23.00463+00
d095f834-ae68-4573-8920-3c228325b5f3	467290c0-3061-4bab-930b-791236a824f1	victoralfredo2498@gmail.com	ADMIN	UPDATE	profiles	579417ad-55d6-42e6-a2ee-eaf674a58060	{"estado": "APROBADO"}	{"estado": "SUSPENDIDO"}	Gestión Usuarios	10.11.0.10	Mozilla/5.0 (Linux; Android 16; SM-A065M Build/BP2A.250605.031.A3; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/147.0.7727.111 Mobile Safari/537.36	2026-05-03 05:51:48.010515+00
5195cb5c-a546-41d7-abdc-3463bf2b86ea	94ef4209-61f0-43b4-bf5f-c4d91ec270be	alfredsistemas85@gmail.com	COMERCIO	CREATE	profiles	94ef4209-61f0-43b4-bf5f-c4d91ec270be	\N	{"id": "94ef4209-61f0-43b4-bf5f-c4d91ec270be", "dni": "24123456783", "rol": "COMERCIO", "email": "alfredsistemas85@gmail.com", "rubro": "agropecuario", "barrio": "Centro", "estado": "PENDIENTE", "telefono": "3794111133", "municipio": "Capital", "nombre_apellido": "Supermercado Dia", "password_changed": false}	Registro Cuentas	10.11.0.10	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36	2026-05-03 18:36:48.861122+00
499ba354-8ee4-4587-98ca-ced34c889e7e	467290c0-3061-4bab-930b-791236a824f1	victoralfredo2498@gmail.com	SUPERADMIN | SOCIO	LOGIN_ADMIN	auth.users	467290c0-3061-4bab-930b-791236a824f1	\N	{"roles": ["SUPERADMIN", "SOCIO"], "metodo": "email"}	Autenticación Administrativa	10.11.0.10	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36	2026-05-03 18:37:20.191406+00
918ed998-0705-4405-bba6-20213e56a699	467290c0-3061-4bab-930b-791236a824f1	victoralfredo2498@gmail.com	SUPERADMIN | SOCIO	LOGIN_ADMIN	auth.users	467290c0-3061-4bab-930b-791236a824f1	\N	{"roles": ["SUPERADMIN", "SOCIO"], "metodo": "email"}	Autenticación Administrativa	10.11.0.10	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36	2026-05-03 18:48:56.923929+00
77cf9fa5-dd09-4e79-83df-3e57f7a430ac	467290c0-3061-4bab-930b-791236a824f1	victoralfredo2498@gmail.com	ADMIN	UPDATE	profiles	94ef4209-61f0-43b4-bf5f-c4d91ec270be	{"estado": "PENDIENTE"}	{"estado": "APROBADO"}	Gestión Usuarios	10.11.0.10	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36	2026-05-03 18:50:02.718965+00
ee61ca73-89e7-4bdf-a004-0d695ccccea8	467290c0-3061-4bab-930b-791236a824f1	victoralfredo2498@gmail.com	ADMIN	DELETE	auth.users / profiles	94ef4209-61f0-43b4-bf5f-c4d91ec270be	{"id": "94ef4209-61f0-43b4-bf5f-c4d91ec270be", "dni": "24123456783", "rol": "COMERCIO", "cuit": null, "email": "alfredsistemas85@gmail.com", "rubro": "agropecuario", "barrio": "Centro", "estado": "APROBADO", "motivo": null, "foto_url": null, "telefono": "3794111133", "username": null, "direccion": null, "municipio": "Capital", "provincia": null, "user_type": "SOCIO", "created_at": "2026-05-03T18:36:48.295155+00:00", "tipo_socio": null, "titular_id": null, "updated_at": "2026-05-03T18:50:02.473862+00:00", "numero_socio": null, "tipo_vinculo": null, "es_estudiante": false, "es_profesional": false, "membership_type": "INDIVIDUAL", "nombre_apellido": "Supermercado Dia", "camara_provincia": null, "email_verificado": false, "password_changed": false, "estado_aprobacion": "PENDIENTE", "camara_denominacion": null, "family_members_count": 1, "must_change_password": false, "email_verificacion_token": null, "constancia_estudiante_url": null, "email_verificacion_expira": null, "sonido_notificaciones_habilitado": true}	\N	Gestión Usuarios	10.11.0.10	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36	2026-05-03 18:50:10.154959+00
1b3ace61-f81f-4b15-8133-c7a8214aa4c3	467290c0-3061-4bab-930b-791236a824f1	victoralfredo2498@gmail.com	SUPERADMIN | SOCIO	LOGIN_ADMIN	auth.users	467290c0-3061-4bab-930b-791236a824f1	\N	{"roles": ["SUPERADMIN", "SOCIO"], "metodo": "email"}	Autenticación Administrativa	10.11.0.10	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36	2026-05-03 19:15:59.917641+00
d57a99a8-0a52-4342-b614-b63e91a3d3dd	467290c0-3061-4bab-930b-791236a824f1	victoralfredo2498@gmail.com	SUPERADMIN | SOCIO	LOGIN_ADMIN	auth.users	467290c0-3061-4bab-930b-791236a824f1	\N	{"roles": ["SUPERADMIN", "SOCIO"], "metodo": "email"}	Autenticación Administrativa	10.11.0.10	Mozilla/5.0 (Linux; Android 16; SM-A065M Build/BP2A.250605.031.A3; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/147.0.7727.111 Mobile Safari/537.36	2026-05-03 19:33:28.911538+00
381412c0-5639-40c3-a9f7-3bb1012ce564	cbb3a9cb-cfdd-4b5e-b9b1-5162e1845b57	libro@gmail.com	COMERCIO	CREATE	profiles	cbb3a9cb-cfdd-4b5e-b9b1-5162e1845b57	\N	{"id": "cbb3a9cb-cfdd-4b5e-b9b1-5162e1845b57", "dni": "20141234569", "rol": "COMERCIO", "email": "libro@gmail.com", "rubro": "otro", "barrio": "Centro", "estado": "PENDIENTE", "telefono": "3241253698", "municipio": "Riachuelo", "nombre_apellido": "Librería El libro ", "password_changed": false}	Registro Cuentas	10.11.0.10	Mozilla/5.0 (Linux; Android 16; SM-A065M Build/BP2A.250605.031.A3; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/147.0.7727.111 Mobile Safari/537.36	2026-05-03 20:58:25.419638+00
c19290d4-c98a-4e77-8f51-9ddd8163d80c	467290c0-3061-4bab-930b-791236a824f1	victoralfredo2498@gmail.com	SUPERADMIN | SOCIO	LOGIN_ADMIN	auth.users	467290c0-3061-4bab-930b-791236a824f1	\N	{"roles": ["SUPERADMIN", "SOCIO"], "metodo": "email"}	Autenticación Administrativa	10.11.0.10	Mozilla/5.0 (Linux; Android 16; SM-A065M Build/BP2A.250605.031.A3; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/147.0.7727.111 Mobile Safari/537.36	2026-05-03 20:59:56.839381+00
34fb0544-49e7-42cb-8c4d-3bda396b8ea8	467290c0-3061-4bab-930b-791236a824f1	victoralfredo2498@gmail.com	ADMIN	UPDATE	profiles	cbb3a9cb-cfdd-4b5e-b9b1-5162e1845b57	{"estado": "PENDIENTE"}	{"estado": "APROBADO"}	Gestión Usuarios	10.11.0.10	Mozilla/5.0 (Linux; Android 16; SM-A065M Build/BP2A.250605.031.A3; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/147.0.7727.111 Mobile Safari/537.36	2026-05-03 21:00:50.375158+00
87f533c0-1a6b-4ff5-8ae9-ed8a5b3e7d6d	467290c0-3061-4bab-930b-791236a824f1	victoralfredo2498@gmail.com	SUPERADMIN | SOCIO	LOGIN_ADMIN	auth.users	467290c0-3061-4bab-930b-791236a824f1	\N	{"roles": ["SUPERADMIN", "SOCIO"], "metodo": "email"}	Autenticación Administrativa	10.11.0.10	Mozilla/5.0 (Linux; Android 16; SM-A065M Build/BP2A.250605.031.A3; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/147.0.7727.111 Mobile Safari/537.36	2026-05-03 23:10:00.347994+00
4bfd77fe-fd1d-4707-b9ee-a150bde0b3d7	467290c0-3061-4bab-930b-791236a824f1	victoralfredo2498@gmail.com	SUPERADMIN | SOCIO	LOGIN_ADMIN	auth.users	467290c0-3061-4bab-930b-791236a824f1	\N	{"roles": ["SUPERADMIN", "SOCIO"], "metodo": "email"}	Autenticación Administrativa	10.11.0.10	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36	2026-05-04 02:44:08.721494+00
59b444e8-c398-47a6-b8b5-d39a75e1c99a	467290c0-3061-4bab-930b-791236a824f1	victoralfredo2498@gmail.com	SUPERADMIN | SOCIO	LOGIN_ADMIN	auth.users	467290c0-3061-4bab-930b-791236a824f1	\N	{"roles": ["SUPERADMIN", "SOCIO"], "metodo": "email"}	Autenticación Administrativa	10.11.0.10	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36	2026-05-04 04:06:37.527715+00
8c599740-9531-42b0-97d4-04784fb8bbf8	467290c0-3061-4bab-930b-791236a824f1	victoralfredo2498@gmail.com	SUPERADMIN | SOCIO	LOGIN_ADMIN	auth.users	467290c0-3061-4bab-930b-791236a824f1	\N	{"roles": ["SUPERADMIN", "SOCIO"], "metodo": "email"}	Autenticación Administrativa	10.11.0.10	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36	2026-05-04 04:35:52.872433+00
e79970e4-fa8d-47ab-9dd5-99e94c7b5c6c	467290c0-3061-4bab-930b-791236a824f1	victoralfredo2498@gmail.com	ADMIN	UPDATE	profiles	23c2224d-0aae-4fae-81ba-ed79cb3bbbe2	{"estado": "RESTRINGIDO"}	{"estado": "APROBADO"}	Gestión Usuarios	10.11.0.10	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36	2026-05-04 04:37:56.335188+00
58a0eba1-3c89-456e-b4eb-2bfbd165b58f	467290c0-3061-4bab-930b-791236a824f1	victoralfredo2498@gmail.com	SUPERADMIN	UPDATE	auth.users (Password)	23c2224d-0aae-4fae-81ba-ed79cb3bbbe2	\N	{"password_reset": true}	Gestión Usuarios	10.11.0.10	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36	2026-05-04 04:38:06.180298+00
932da0a4-80cd-490b-b42c-3f72878aee26	23c2224d-0aae-4fae-81ba-ed79cb3bbbe2	acerocorrientes@gmail.com	\N	UPDATE	profiles	23c2224d-0aae-4fae-81ba-ed79cb3bbbe2	\N	{"password_changed": true}	Seguridad	10.11.0.10	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36	2026-05-04 04:38:44.313305+00
\.


--
-- Data for Name: auditoria_logs_2027; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.auditoria_logs_2027 (id, usuario_id, email_usuario, rol_usuario, accion, tabla_afectada, registro_id, datos_anteriores, datos_nuevos, modulo, ip_address, user_agent, fecha) FROM stdin;
\.


--
-- Data for Name: auditoria_logs_2028; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.auditoria_logs_2028 (id, usuario_id, email_usuario, rol_usuario, accion, tabla_afectada, registro_id, datos_anteriores, datos_nuevos, modulo, ip_address, user_agent, fecha) FROM stdin;
\.


--
-- Data for Name: chat_history; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.chat_history (id, user_id, role, content, metadata, created_at) FROM stdin;
5c0b73b1-bb51-46a7-a462-491bd474923f	2a1039a2-be04-42e1-a654-6e67de053dd9	user	Qué es una vaca	{"mode": "Básico", "has_image": false}	2026-04-24 04:39:32.474979+00
7dc37eed-6487-403e-8631-e71a72853814	2a1039a2-be04-42e1-a654-6e67de053dd9	assistant	¡Hola! La vaca es un animal de granja muy importante en la producción agrícola y ganadera. Aquí te dejo algunos aspectos clave sobre las vacas:\n\n### Definición\n- **Especie**: La vaca es una hembra del ganado bovino, perteneciente a la especie *Bos taurus*.\n- **Domesticación**: Ha sido domesticada por el ser humano desde hace miles de años, principalmente por su leche, carne y cuero.\n\n### Características\n- **Fisiología**: Las vacas son rumiantes, lo que significa que tienen un sistema digestivo especializado que les permite fermentar el alimento en su estómago antes de digerirlo.\n- **Alimentación**: Su dieta se basa principalmente en pasto, heno y forrajes, aunque también pueden recibir concentrados y suplementos.\n\n### Usos\n- **Producción de leche**: Son una fuente crucial de leche y productos lácteos como queso, yogur y mantequilla.\n- **Carne**: La carne de vaca es una fuente importante de proteínas en muchas dietas alrededor del mundo.\n- **Trabajo agrícola**: Históricamente, han sido utilizadas como animales de tiro en labores agrícolas.\n\n### Reproducción\n- **Ciclo reproductivo**: Las vacas tienen un ciclo reproductivo de aproximadamente 21 días y pueden parir una vez al año, dando a luz a un ternero.\n\n### Importancia económica\n- Las vacas son fundamentales en la economía rural, contribuyendo significativamente al sustento de muchas familias y comunidades.\n\nSi deseas más información específica o tienes alguna otra pregunta sobre el manejo o cuidado de las vacas, no dudes en decírmelo. ¿En qué modo prefieres que te responda? (Básico, Técnico, Estudiante, Productor, Urbano o Emprendedor)	\N	2026-04-24 04:39:32.738374+00
d3606f54-6bc2-439b-99c3-71f516608fa3	2a1039a2-be04-42e1-a654-6e67de053dd9	user	hola	{"mode": "Básico", "has_image": false}	2026-04-25 18:06:44.213323+00
d620b94d-c046-4e81-a17c-79fb7ec5e49a	2a1039a2-be04-42e1-a654-6e67de053dd9	assistant	¡Hola! Es un placer saludarte. ¿En qué puedo ayudarte hoy? Si tienes alguna consulta sobre agronomía, veterinaria o emprendimientos rurales, aquí estoy para asistirte.	\N	2026-04-25 18:06:44.509969+00
8666c436-87c4-4c6a-98e0-74d90ee24804	2a1039a2-be04-42e1-a654-6e67de053dd9	user	autor y bibliografia, nombrame dos sobre temas agropecuaria	{"mode": "Básico", "has_image": false}	2026-04-27 22:48:37.724051+00
bdf20e41-77ee-43b8-850b-29e47f3a7b9c	2a1039a2-be04-42e1-a654-6e67de053dd9	assistant	Claro, aquí tienes dos recomendaciones bibliográficas sobre temas agropecuarios:\n\n1. **Libro**: *"Principios de Agronomía"* – **Joaquín F. Aguirre**\n   - Este libro aborda los fundamentos de la agronomía, incluyendo prácticas de cultivo, manejo de suelos y técnicas de producción agrícola.\n\n2. **Manual técnico del INTA**: *"Manejo de Cultivos de Granos*" \n   - Este manual proporciona información detallada sobre el manejo de cultivos de granos, técnicas de siembra, fertilización y control de plagas.\n\nSi necesitas más información o un enfoque específico sobre algún tema, no dudes en decírmelo. ¡Estoy aquí para ayudarte!	\N	2026-04-27 22:48:37.993298+00
aeb47b85-7702-47bb-81df-244ca498560b	2a1039a2-be04-42e1-a654-6e67de053dd9	user	hola	{"mode": "Básico", "has_image": false, "image_url": null}	2026-04-30 22:24:43.034447+00
34a39958-b82f-4226-839c-aaef124b39b2	2a1039a2-be04-42e1-a654-6e67de053dd9	assistant	¡Hola de nuevo! ¿En qué puedo ayudarte hoy? Si tienes alguna pregunta relacionada con la ganadería, sanidad animal, agronomía o producción agropecuaria, aquí estoy para asistirte.	\N	2026-04-30 22:24:43.266585+00
af744192-64c8-4758-a962-8accd13d4002	2a1039a2-be04-42e1-a654-6e67de053dd9	user	vaca que es	{"mode": "Básico", "has_image": false, "image_url": null}	2026-04-30 22:25:08.543333+00
cc07282e-7b49-4fa7-b4a6-91ee92bcf3d8	2a1039a2-be04-42e1-a654-6e67de053dd9	assistant	La vaca es un animal de granja que pertenece a la especie *Bos taurus*, es una hembra del ganado bovino. A continuación, te detallo algunos aspectos relevantes:\n\n### Características Generales\n- **Rumiantes**: Las vacas son rumiantes, lo que significa que tienen un sistema digestivo especializado que les permite fermentar y digerir eficientemente los alimentos fibrosos, principalmente pasto y forrajes.\n- **Fisiología**: Poseen un estómago dividido en cuatro compartimentos (rumen, retículo, omaso y abomaso) que les ayuda a procesar su dieta.\n\n### Usos en la Agricultura\n- **Producción de Leche**: Son una fuente crucial de leche, utilizada para la elaboración de productos lácteos como queso, yogur y mantequilla.\n- **Carne**: La carne de vaca es una fuente importante de proteínas en diversas dietas a nivel mundial.\n- **Trabajo Agrícola**: Históricamente, han sido utilizadas como animales de tiro y en labores agrícolas.\n\n### Reproducción\n- Las vacas tienen un ciclo reproductivo de aproximadamente 21 días y suelen parir una vez al año, dando a luz a un ternero.\n\n### Importancia Económica\n- Las vacas son fundamentales en la economía rural, contribuyendo al sustento de muchas familias y comunidades.\n\nSi tienes alguna pregunta específica o necesitas información adicional sobre el manejo o la sanidad de las vacas, no dudes en decírmelo. ¡Estoy aquí para ayudarte!	\N	2026-04-30 22:25:08.78029+00
fca204a8-4894-4721-b32f-dfd03931c320	e01afdff-da8f-469a-a054-9eb71ccf3766	user	Mi caballo está muy caído	{"mode": "Básico", "has_image": false, "image_url": null}	2026-05-01 17:37:44.974668+00
51f98de9-1678-4b08-8501-32ac8ce2ffc4	e01afdff-da8f-469a-a054-9eb71ccf3766	assistant	Soy un asistente especializado en el ámbito agropecuario. Para poder ayudarte, necesitaría más información sobre el estado del caballo. ¿Podrías subir una imagen del animal? Esto me permitirá activar el "Modo Diagnóstico Guiado" y hacerte preguntas que nos ayuden a entender mejor la situación.	\N	2026-05-01 17:37:45.223028+00
7dae2657-0b7c-4b89-bad2-bd247e0a7776	2a1039a2-be04-42e1-a654-6e67de053dd9	user	vaca bomita mucho	{"mode": "Básico", "has_image": false, "image_url": null}	2026-05-01 20:17:50.959485+00
665d621a-170d-43fa-aae1-65ccd157b160	2a1039a2-be04-42e1-a654-6e67de053dd9	assistant	Entiendo que observas que la vaca está vomitando. Vamos a entrar en el "Modo Diagnóstico Guiado" para entender mejor la situación. \n\n### Pregunta 1\n¿La vaca presenta signos de malestar, como inquietud o comportamiento anormal?	\N	2026-05-01 20:17:51.204754+00
cc6a0c99-282b-4d1d-83e1-be9ab02cc355	2a1039a2-be04-42e1-a654-6e67de053dd9	user		{"mode": "Básico", "has_image": true, "image_url": "https://jeeurezcswuchpzwgfno.supabase.co/storage/v1/object/public/chat-images/temp_2a1039a2-be04-42e1-a654-6e67de053dd9_01696ca16db54382a3b2dfd4d19cf65b.jpg"}	2026-05-03 05:04:12.112046+00
dc4a86cf-3f1a-44d4-bb0c-cae66bb1a99c	2a1039a2-be04-42e1-a654-6e67de053dd9	assistant	No puedo identificar personas ni animales en las imágenes. Si tienes alguna pregunta sobre ganadería o temas relacionados, estoy aquí para ayudarte.	\N	2026-05-03 05:04:12.349975+00
\.


--
-- Data for Name: comercio_solicitudes; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.comercio_solicitudes (id, user_id, nombre, rubro, direccion, telefono, email, descripcion, logo_url, instagram_url, facebook_url, estado, created_at, updated_at, organizacion_id) FROM stdin;
\.


--
-- Data for Name: comercios; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.comercios (id, nombre_comercio, cuit, rubro, direccion, municipio, responsable_dni, created_at, user_id, estado, logo_url, instagram_url, facebook_url, telefono, email, descripcion, organizacion_id, barrio) FROM stdin;
9102582e-308e-4d44-bd21-fa988d6c4891	FERREMAQ	30718848799	construccion	VELEZ SARFIEL 1553	\N	\N	2026-04-21 03:53:23.446838+00	\N	ACTIVO	\N	\N	\N	\N	\N	\N	\N	\N
87666333-f287-41b6-b0d2-32fcf58e1daa	CONFORTABLE	20109807711	otro	J.V. PAMPIN 511	Capital	\N	2026-04-21 03:57:50.858101+00	\N	ACTIVO	\N	\N	\N	\N	\N	\N	\N	\N
e82810c3-4550-4994-8bcd-e7e9e18deea9	EST. DE SERV. PACHECO	30710417217	otro	AV MAIPU Y RUTA 12	\N	\N	2026-04-21 04:01:08.805012+00	\N	ACTIVO	\N	\N	\N	\N	\N	\N	\N	\N
3afd196c-9675-46d3-8650-76e71563c617	EL AROMITO	20266234764	otro	ESPAÑA 1037	\N	\N	2026-04-21 04:03:17.798648+00	\N	ACTIVO	\N	\N	\N	\N	\N	\N	\N	\N
030556ed-8fbb-4783-9f87-f324a3cd5686	ESPACIO BUNKER 	20383169349	otro	SALTA 1430	\N	\N	2026-04-21 04:06:16.303289+00	\N	ACTIVO	\N	\N	\N	\N	\N	\N	\N	\N
93d7a43f-21d7-49a5-8794-0e1187dfcc7c	YA CHIPASITOS 	30719119138	alimentacion	SAN LORENZO 780	\N	\N	2026-04-21 04:07:45.02434+00	\N	ACTIVO	\N	\N	\N	\N	\N	\N	\N	\N
7b7e0daf-741d-4ca7-8ac4-ca7d78ebf8a8	JARDIN UPA LALA	30714035114	otro	MISIONES 1209	\N	\N	2026-04-21 04:10:08.901764+00	\N	ACTIVO	\N	\N	\N	\N	\N	\N	\N	\N
b4c9f795-d07f-4c08-b8cb-7b20dc08cbd5	EL BAGUAL 	20085614089	otro	AV INDEPENDENCIA 3655	\N	\N	2026-04-21 04:13:03.405229+00	\N	ACTIVO	\N	\N	\N	\N	\N	\N	\N	\N
597219dc-9be9-4ab2-a432-16547e174b1a	HERMES GROUP	20219980850	otro	PERU 1209	\N	\N	2026-04-21 04:17:26.407508+00	\N	ACTIVO	\N	\N	\N	\N	\N	\N	\N	\N
23c2224d-0aae-4fae-81ba-ed79cb3bbbe2	ACERO CORRIENTES 	20283030416	otro	COCOMAROLA 715	\N	\N	2026-04-21 04:19:27.571705+00	\N	ACTIVO	\N	\N	\N	\N	\N	\N	\N	\N
461a31ea-5286-42ab-8c1c-2d976da73d40	Ubi Traslados 	20314355238	transporte	Las margaritas 246	\N	\N	2026-04-26 04:07:51.898884+00	\N	ACTIVO	\N	\N	\N	\N	\N	\N	\N	\N
cbb3a9cb-cfdd-4b5e-b9b1-5162e1845b57	Librería El libro 	20141234569	otro	San Martín 123	Riachuelo	\N	2026-05-03 20:58:25.172215+00	\N	ACTIVO	\N	\N	\N	\N	\N	\N	\N	Centro
\.


--
-- Data for Name: configuracion_cuotas; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.configuracion_cuotas (id, rol, monto, ultima_actualizacion) FROM stdin;
27ec7337-1302-4f4f-91c3-38716b9c690f	CAMARA	0.0	2026-04-25 20:46:23.425571+00
54f2920e-9680-4b72-87a7-b5b18dc01c50	SOCIO	10000.0	2026-05-03 03:45:23.619446+00
568a4d84-4686-41cb-b2c2-7a77239dbd59	COMERCIO	0.0	2026-05-03 03:45:24.099791+00
1bf3c03e-8899-48e8-a120-81d521e0887e	ESTUDIANTE	5000.0	2026-05-03 03:45:24.592921+00
eade190d-9a5d-44c9-85e0-2687c4fd4d24	GRUPO FAMILIAR	20000.0	2026-05-03 03:45:25.07939+00
0d1f665a-2ae9-4c1f-be5d-9c4fbfa79f06	PROFESIONAL	8000.0	2026-05-03 03:45:25.541904+00
\.


--
-- Data for Name: empleados_comercios; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.empleados_comercios (id, perfil_id, comercio_id, activo, fecha_ingreso, created_at) FROM stdin;
\.


--
-- Data for Name: eventos_sociales; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.eventos_sociales (id, external_id, titulo, descripcion_limpia, lugar, fecha_evento, hora_evento, imagen_url, metadata, status, created_at, updated_at, fuente, municipio_id, descripcion, fecha, hora, municipio, tipo, link_instagram, link_facebook, link_whatsapp, link_externo, estado, destacado, publico, slug, tipo_origen) FROM stdin;
7b6f2813-49ea-476d-a80b-68e3448e8276	17872082304664287	Hoy dimos un paso más en la construcción de un vínculo real entre los estudiantes y el sector productivo 💪	Hoy dimos un paso más en la construcción de un vínculo real entre los estudiantes y el sector productivo 💪\nLa SRNC firmó un convenio con el Centro de Estudiantes de la Facultad de Ciencias Veterinarias, mediante el cual, a partir de ahora, el centro contará con un representante de la SRNC, que será elegido en cada elección estudiantil.\nEste acuerdo tiene un objetivo claro: trabajar en conjunto en proyectos, pasantías, capacitaciones y todas aquellas acciones que aporten al crecimiento de los estudiantes y al desarrollo del productor.\nSeguimos generando oportunidades, acercando el campo a la universidad y construyendo futuro.	Corrientes	2026-05-03	10:00:00	https://jeeurezcswuchpzwgfno.supabase.co/storage/v1/object/public/imagenes-eventos/17872082304664287_a88e8470.jpg	{"permalink": null, "timestamp": "2026-05-01T02:23:51.000Z", "media_type": "IMAGE", "original_caption": "Hoy dimos un paso más en la construcción de un vínculo real entre los estudiantes y el sector productivo 💪\\n\\nLa SRNC firmó un convenio con el Centro de Estudiantes de la Facultad de Ciencias Veterinarias, mediante el cual, a partir de ahora, el centro contará con un representante de la SRNC, que será elegido en cada elección estudiantil.\\n\\nEste acuerdo tiene un objetivo claro: trabajar en conjunto en proyectos, pasantías, capacitaciones y todas aquellas acciones que aporten al crecimiento de los estudiantes y al desarrollo del productor.\\n\\nSeguimos generando oportunidades, acercando el campo a la universidad y construyendo futuro.", "original_media_url": "https://scontent-iad3-1.cdninstagram.com/o1/v/t2/f2/m86/AQMJLICgC1eFv6dxaG2u56wAcJyedfp_5HkhGUXJLNydoHXqbneZ9WNVwu68cN3Q3PFDOkSqn103OE66Y74rCuIYpUxnizA7tPXlv-w.mp4?_nc_cat=108&_nc_sid=5e9851&_nc_ht=scontent-iad3-1.cdninstagram.com&_nc_ohc=ih9ncUhWOjMQ7kNvwGo7wOk&efg=eyJ2ZW5jb2RlX3RhZyI6Inhwdl9wcm9ncmVzc2l2ZS5JTlNUQUdSQU0uQ0xJUFMuQzMuNzIwLmRhc2hfYmFzZWxpbmVfMV92MSIsInhwdl9hc3NldF9pZCI6MTAxMTM0OTQwMTI2NTc3MSwiYXNzZXRfYWdlX2RheXMiOjEsInZpX3VzZWNhc2VfaWQiOjEwMDk5LCJkdXJhdGlvbl9zIjo0MSwidXJsZ2VuX3NvdXJjZSI6Ind3dyJ9&ccb=17-1&vs=ffed25ea95edfced&_nc_vs=HBksFQIYUmlnX3hwdl9yZWVsc19wZXJtYW5lbnRfc3JfcHJvZC8zNzRGNjA2MkE5RkNGRkM2RjM0QkRFOUM3RjJCN0Q5OF92aWRlb19kYXNoaW5pdC5tcDQVAALIARIAFQIYUWlnX3hwdl9wbGFjZW1lbnRfcGVybWFuZW50X3YyLzg1NEExMDFFQkNCQ0VFRDVFMTQwMzA1Rjg5NURBMTg0X2F1ZGlvX2Rhc2hpbml0Lm1wNBUCAsgBEgAoABgAGwKIB3VzZV9vaWwBMRJwcm9ncmVzc2l2ZV9yZWNpcGUBMRUAACbWmfOcpPTLAxUCKAJDMywXQETiDEm6XjUYEmRhc2hfYmFzZWxpbmVfMV92MREAdf4HZeadAQA&_nc_gid=NHLropGqZ2cylTMf-4zhPA&edm=AM6HXa8EAAAA&_nc_zt=28&oh=00_Af4N2HKsbFI4SVL-guHNrLmQDDRmFvJLUDzos6mN7hmBMw&oe=69F779E5"}	aprobado	2026-05-02 06:02:59.34809+00	2026-05-03 03:31:45.509807+00	sociedad_rural	\N	Hoy dimos un paso más en la construcción de un vínculo real entre los estudiantes y el sector productivo 💪\nLa SRNC firmó un convenio con el Centro de Estudiantes de la Facultad de Ciencias Veterinarias, mediante el cual, a partir de ahora, el centro contará con un representante de la SRNC, que será elegido en cada elección estudiantil.\nEste acuerdo tiene un objetivo claro: trabajar en conjunto en proyectos, pasantías, capacitaciones y todas aquellas acciones que aporten al crecimiento de los estudiantes y al desarrollo del productor.\nSeguimos generando oportunidades, acercando el campo a la universidad y construyendo futuro.	2026-05-03	10:00:00	\N	\N	\N	\N	\N	\N	publicado	f	t	17872082304664287	instagram
9ae8750b-2a5e-4e6a-a64f-31abd2b2e9e5	manual_afb2cf67-2b4a-439f-8a4b-15540fdcc1bb	Gran Remate Ganadero	\N	Predio Feria Virgen de Itatí	\N	\N		\N	borrador	2026-05-03 03:54:26.189278+00	2026-05-03 03:55:25.717853+00	admin	c27848ec-da9e-4c08-8c69-63e4136d3132	Vengan pe	2026-05-05	09:00:00	\N	Remate	https://www.instagram.com/p/DQw84uEAQbL/	https://www.facebook.com/CamaraCSGoficial/posts/-8-gran-remate-c%C3%A1mara-de-caba%C3%B1as-santafesinas-de-ganado-%EF%B8%8F-200-reproductores%EF%B8%8F-27-/1103950051752118/	1234523690	https://facebook.com/	publicado	f	t	gran-remate-ganadero-781c66	manual
\.


--
-- Data for Name: familiares; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.familiares (id, titular_id, nombre_apellido, dni, parentesco, fecha_nacimiento, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: localidades; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.localidades (id, nombre, active, created_at) FROM stdin;
93789291-51f9-4e6b-ae6e-ad7ff61f4f21	Capital	t	2026-04-15 21:50:05.027775+00
99334e02-1dd6-47ce-b4da-0d2c9600f33f	Itatí	t	2026-04-15 21:50:05.027775+00
037feccd-e746-41b3-bb77-98dc34980e75	Ramada Paso	t	2026-04-15 21:50:05.027775+00
80b70df2-2621-4064-835a-8f4a3c2042d4	San Cosme	t	2026-04-15 21:50:05.027775+00
946ac16b-980f-4b36-8d30-eb140523bb47	Santa Ana	t	2026-04-15 21:50:05.027775+00
390f27b9-a0aa-47e1-9e22-b880424319eb	Riachuelo	t	2026-04-15 21:50:05.027775+00
cc506548-85bb-490c-a0f4-3a0ab8a05ae9	El Sombrero	t	2026-04-15 21:50:05.027775+00
e83815ce-a166-4ed9-b012-5ca044e83c77	Paso de la Patria	t	2026-04-15 21:50:05.027775+00
\.


--
-- Data for Name: municipios; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.municipios (id, nombre, provincia, descripcion, imagen_principal, activo, latitud, longitud, fecha_creacion, fecha_actualizacion, instagram_handle, instagram_user_id) FROM stdin;
6d934c59-5d29-427b-a24e-20ecfa24c595	Ituzaingó	Corrientes	Localidad de Ituzaingó	\N	t	\N	\N	2026-04-30 14:13:26.323813+00	2026-04-30 14:13:26.323813+00	\N	\N
b734c5d8-552d-4321-aadf-68cf20f0c14d	Capital	Corrientes	\N	\N	t	\N	\N	2026-05-01 20:04:55.034724+00	2026-05-01 20:04:55.034724+00	\N	\N
3ace9137-63c6-4ce1-ad93-e52dc2784eab	San Cosme	Corrientes	\N	\N	t	\N	\N	2026-05-01 20:04:55.034724+00	2026-05-01 20:04:55.034724+00	\N	\N
17612a5e-fe21-4d4b-ae3f-69a0820dbe3b	Santa Ana	Corrientes	\N	\N	t	\N	\N	2026-05-01 20:04:55.034724+00	2026-05-01 20:04:55.034724+00	\N	\N
c27848ec-da9e-4c08-8c69-63e4136d3132	Itatí	Corrientes	\N	\N	t	\N	\N	2026-05-01 20:04:55.034724+00	2026-05-01 20:04:55.034724+00	\N	\N
85ba1edb-e6a7-4a1c-8e07-61eec63d890d	Ramada Paso	Corrientes	\N	\N	t	\N	\N	2026-05-01 20:04:55.034724+00	2026-05-01 20:04:55.034724+00	\N	\N
d9fde9cd-3c26-4570-8fad-c34bda66c7f3	Riachuelo	Corrientes	\N	\N	t	\N	\N	2026-05-01 20:04:55.034724+00	2026-05-01 20:04:55.034724+00	\N	\N
a7075767-d1b0-4137-ba76-68f769eb1033	El Sombrero	Corrientes	\N	\N	t	\N	\N	2026-05-01 20:04:55.034724+00	2026-05-01 20:04:55.034724+00	\N	\N
10dcd85e-4cf2-4cb1-a3a7-0d45dcbd59e2	Paso de la Patria	Corrientes	\N	\N	t	\N	\N	2026-05-01 20:04:55.034724+00	2026-05-01 20:04:55.034724+00	\N	\N
\.


--
-- Data for Name: notificaciones; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.notificaciones (id, usuario_id, tipo, mensaje, estado_envio, fecha, titulo, leido, link_url, metadata, is_admin_destined, estado, resolved_at, evento_id) FROM stdin;
c730be04-ff8c-4ce1-81fa-ede646a7f93f	467290c0-3061-4bab-930b-791236a824f1	\N	Se ha registrado un nuevo socio: Juan Perez. Requiere revisión para aprobación.	PENDIENTE	2026-04-15 23:52:26.713791+00	Nuevo Registro: Socio	t	/admin	\N	f	PENDIENTE	\N	\N
b5e5eb8d-c1f3-437b-8a81-7782229d307a	467290c0-3061-4bab-930b-791236a824f1	\N	Se ha registrado un nuevo comercio: CONFORTABLE. Requiere revisión para aprobación.	PENDIENTE	2026-04-21 03:57:51.499729+00	Nuevo Registro: Comercio	t	/admin	\N	f	PENDIENTE	\N	\N
c5e80a0a-500a-4b04-b25b-38f092b7be18	467290c0-3061-4bab-930b-791236a824f1	\N	Se ha registrado un nuevo socio: Fabian Emmanuel Gómez. Requiere revisión para aprobación.	PENDIENTE	2026-04-22 20:25:10.786567+00	Nuevo Registro: Socio	t	/admin	\N	f	PENDIENTE	\N	\N
86cf35d6-bce6-4ff6-b360-8399c3e9d8b5	1c757b75-8f83-4677-9747-043c4f03a67f	\N	Se ha registrado un nuevo socio: Fabian Emmanuel Gómez. Requiere revisión para aprobación.	PENDIENTE	2026-04-22 20:25:11.336285+00	Nuevo Registro: Socio	t	/admin	\N	f	PENDIENTE	\N	\N
62305489-6310-4031-9131-1a16b9638390	467290c0-3061-4bab-930b-791236a824f1	\N	Se ha registrado un nuevo socio: Oscar Peralta. Requiere revisión para aprobación.	PENDIENTE	2026-04-23 09:34:22.708832+00	Nuevo Registro: Socio	t	/admin	\N	f	PENDIENTE	\N	\N
9a1f8171-f41d-4851-b3fd-594621b54b01	467290c0-3061-4bab-930b-791236a824f1	\N	Se ha registrado un nuevo socio: Ruben Riquelme. Requiere revisión para aprobación.	PENDIENTE	2026-04-23 22:50:28.521244+00	Nuevo Registro: Socio	t	/admin	\N	f	PENDIENTE	\N	\N
655a92fb-6c9c-49cf-b874-504427b99e78	467290c0-3061-4bab-930b-791236a824f1	\N	Se ha registrado un nuevo socio: Julian Weich. Requiere revisión para aprobación.	PENDIENTE	2026-04-24 01:51:20.217264+00	Nuevo Registro: Socio	t	/admin	\N	f	PENDIENTE	\N	\N
d7d3e3ec-b49c-497f-9c01-d92d24ebb86f	467290c0-3061-4bab-930b-791236a824f1	\N	Se ha registrado un nuevo socio: Florencia Maciel. Requiere revisión para aprobación.	PENDIENTE	2026-04-24 04:34:58.25685+00	Nuevo Registro: Socio	t	/admin	\N	f	PENDIENTE	\N	\N
be1acdcb-60bb-416d-9f98-41242e275074	467290c0-3061-4bab-930b-791236a824f1	\N	Se ha registrado un nuevo socio: Luis Landrisina. Requiere revisión para aprobación.	PENDIENTE	2026-04-25 19:39:17.148097+00	Nuevo Registro: Socio	t	/admin	\N	f	PENDIENTE	\N	\N
77d51689-0fa1-4e9f-9cfd-a3ba16453ad5	467290c0-3061-4bab-930b-791236a824f1	\N	Se ha registrado un nuevo socio: Victor Torrilla. Requiere revisión para aprobación.	PENDIENTE	2026-04-25 21:58:57.263873+00	Nuevo Registro: Socio	t	/admin	\N	f	PENDIENTE	\N	\N
7a5c72b7-e3de-4a55-8f5e-d5338ee376bf	467290c0-3061-4bab-930b-791236a824f1	\N	Se ha registrado un nuevo socio: Luciano. Requiere revisión para aprobación.	PENDIENTE	2026-04-26 02:36:33.641943+00	Nuevo Registro: Socio	t	/admin	\N	f	PENDIENTE	\N	\N
8e74fe13-8262-4bff-92e6-d5124ec3a20c	1c757b75-8f83-4677-9747-043c4f03a67f	\N	Se ha registrado un nuevo socio: Oscar Peralta. Requiere revisión para aprobación.	PENDIENTE	2026-04-23 09:34:23.219119+00	Nuevo Registro: Socio	t	/admin	\N	f	PENDIENTE	\N	\N
f128f5df-d5bc-4b8a-81df-da4791df0d4f	1c757b75-8f83-4677-9747-043c4f03a67f	\N	Se ha registrado un nuevo socio: Ruben Riquelme. Requiere revisión para aprobación.	PENDIENTE	2026-04-23 22:50:29.252295+00	Nuevo Registro: Socio	t	/admin	\N	f	PENDIENTE	\N	\N
bcf65777-8983-4fa4-af84-c51946aa92dc	1c757b75-8f83-4677-9747-043c4f03a67f	\N	Se ha registrado un nuevo socio: Julian Weich. Requiere revisión para aprobación.	PENDIENTE	2026-04-24 01:51:20.967327+00	Nuevo Registro: Socio	t	/admin	\N	f	PENDIENTE	\N	\N
54663abf-2edb-4202-bc3e-3cf582f6028e	1c757b75-8f83-4677-9747-043c4f03a67f	\N	Se ha registrado un nuevo socio: Florencia Maciel. Requiere revisión para aprobación.	PENDIENTE	2026-04-24 04:34:57.553522+00	Nuevo Registro: Socio	t	/admin	\N	f	PENDIENTE	\N	\N
965ad064-9f8f-44ca-baf3-99a132893e26	1c757b75-8f83-4677-9747-043c4f03a67f	\N	Se ha registrado un nuevo socio: Luis Landrisina. Requiere revisión para aprobación.	PENDIENTE	2026-04-25 19:39:16.526417+00	Nuevo Registro: Socio	t	/admin	\N	f	PENDIENTE	\N	\N
db6094f2-326b-46f2-9744-e2daf551f48c	1c757b75-8f83-4677-9747-043c4f03a67f	\N	Se ha registrado un nuevo socio: Victor Torrilla. Requiere revisión para aprobación.	PENDIENTE	2026-04-25 21:58:56.603716+00	Nuevo Registro: Socio	t	/admin	\N	f	PENDIENTE	\N	\N
0b525506-40da-4a2d-8938-b0e6b0a231d0	1c757b75-8f83-4677-9747-043c4f03a67f	\N	Se ha registrado un nuevo socio: Luciano. Requiere revisión para aprobación.	PENDIENTE	2026-04-26 02:36:32.913708+00	Nuevo Registro: Socio	t	/admin	\N	f	PENDIENTE	\N	\N
e869e646-f802-410c-b617-8145500bce6a	467290c0-3061-4bab-930b-791236a824f1	admin	Se ha registrado un nuevo socio: Julio López. Requiere revisión para aprobación.	PENDIENTE	2026-05-03 05:08:47.845496+00	Nuevo Registro: Socio	t	/admin	\N	f	RESUELTO	2026-05-03 02:16:21.199993+00	\N
f052f002-3600-49c2-a0bb-3d0a189b6112	cb377de7-c49c-46b6-b735-3e42849ed1f0	admin	Se ha registrado un nuevo socio: Julio López. Requiere revisión para aprobación.	PENDIENTE	2026-05-03 05:08:46.311311+00	Nuevo Registro: Socio	f	/admin	\N	f	RESUELTO	2026-05-03 02:16:24.093186+00	\N
b5313c56-7cc8-45a3-94e1-416e6c894015	1c757b75-8f83-4677-9747-043c4f03a67f	admin	Se ha registrado un nuevo socio: Julio López. Requiere revisión para aprobación.	PENDIENTE	2026-05-03 05:08:47.076829+00	Nuevo Registro: Socio	f	/admin	\N	f	RESUELTO	2026-05-03 02:16:24.943293+00	\N
ad9e4b28-ae99-44d1-9607-5e7b8338c7dd	467290c0-3061-4bab-930b-791236a824f1	admin	Se ha registrado un nuevo comercio: Librería El libro . Requiere revisión para aprobación.	PENDIENTE	2026-05-03 20:58:27.20361+00	Nuevo Registro: Comercio	t	/admin	\N	f	RESUELTO	2026-05-03 18:00:29.615027+00	\N
cbe56611-b222-4615-8e18-68a8f3b390fe	1c757b75-8f83-4677-9747-043c4f03a67f	admin	Se ha registrado un nuevo comercio: Librería El libro . Requiere revisión para aprobación.	PENDIENTE	2026-05-03 20:58:26.521887+00	Nuevo Registro: Comercio	f	/admin	\N	f	RESUELTO	2026-05-03 18:00:31.464631+00	\N
ff04bae7-46b9-488f-b0a7-a548ff627db2	cb377de7-c49c-46b6-b735-3e42849ed1f0	admin	Se ha registrado un nuevo comercio: Librería El libro . Requiere revisión para aprobación.	PENDIENTE	2026-05-03 20:58:25.809034+00	Nuevo Registro: Comercio	f	/admin	\N	f	RESUELTO	2026-05-03 18:00:32.330031+00	\N
a64d93b3-05a6-465d-ac17-497f6c1d64bd	1c757b75-8f83-4677-9747-043c4f03a67f	admin	Se ha registrado un nuevo comercio: Supermercado Dia. Requiere revisión para aprobación.	PENDIENTE	2026-05-03 18:36:49.966541+00	Nuevo Registro: Comercio	f	/admin	\N	f	RESUELTO	2026-05-03 18:00:35.645382+00	\N
fe35c99b-b3a0-4630-a9b0-095131839365	467290c0-3061-4bab-930b-791236a824f1	admin	Se ha registrado un nuevo comercio: Supermercado Dia. Requiere revisión para aprobación.	PENDIENTE	2026-05-03 18:36:50.66773+00	Nuevo Registro: Comercio	t	/admin	\N	f	RESUELTO	2026-05-03 18:00:37.87041+00	\N
c13fdca0-fd74-46a0-b81e-9d57b205bb2b	cb377de7-c49c-46b6-b735-3e42849ed1f0	admin	Se ha registrado un nuevo comercio: Supermercado Dia. Requiere revisión para aprobación.	PENDIENTE	2026-05-03 18:36:49.261306+00	Nuevo Registro: Comercio	f	/admin	\N	f	RESUELTO	2026-05-03 18:00:39.933886+00	\N
56087072-fc8a-4db3-a5b5-6d8940e3a684	467290c0-3061-4bab-930b-791236a824f1	admin	Se ha registrado un nuevo socio: Luisa Florencia Maciel. Requiere revisión para aprobación.	PENDIENTE	2026-05-03 05:28:40.957446+00	Nuevo Registro: Socio	t	/admin	\N	f	RESUELTO	2026-05-03 18:00:41.905941+00	\N
17668263-1e48-48db-ba29-caf7e49034b1	cb377de7-c49c-46b6-b735-3e42849ed1f0	admin	Se ha registrado un nuevo socio: Luisa Florencia Maciel. Requiere revisión para aprobación.	PENDIENTE	2026-05-03 05:28:38.866839+00	Nuevo Registro: Socio	f	/admin	\N	f	RESUELTO	2026-05-03 18:00:44.403207+00	\N
88c68ace-880d-44c8-a66d-f823f1d352c2	1c757b75-8f83-4677-9747-043c4f03a67f	admin	Se ha registrado un nuevo socio: Luisa Florencia Maciel. Requiere revisión para aprobación.	PENDIENTE	2026-05-03 05:28:39.645495+00	Nuevo Registro: Socio	f	/admin	\N	f	RESUELTO	2026-05-03 18:00:46.928054+00	\N
\.


--
-- Data for Name: pagos_cuotas; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.pagos_cuotas (id, socio_id, monto, fecha_vencimiento, estado_pago, created_at, comprobante_url, fecha_envio_comprobante, fecha_validacion, admin_validador_id) FROM stdin;
233ce3c8-9975-490f-a3e7-c3085afa5559	5d7855f3-f641-4af6-9537-f41b82ac162d	5000	2026-05-10	PENDIENTE	2026-05-03 03:47:29.719499+00	\N	\N	\N	\N
186a76f7-c950-4c4f-9864-86dc760c13a8	b4c9f795-d07f-4c08-b8cb-7b20dc08cbd5	5000	2026-05-10	PENDIENTE	2026-05-03 03:47:29.719499+00	\N	\N	\N	\N
21eeb83d-580f-40eb-8222-20a8e3b4cb42	b32ae806-027b-48f9-991a-e18fac9d8eba	5000	2026-05-10	PENDIENTE	2026-05-03 03:47:29.719499+00	\N	\N	\N	\N
948d19c1-8f30-42cb-8201-611e86a999f8	597219dc-9be9-4ab2-a432-16547e174b1a	5000	2026-05-10	PENDIENTE	2026-05-03 03:47:29.719499+00	\N	\N	\N	\N
a7eb433e-e4b4-4c58-ae4c-612c96f4dea4	ea625819-210b-4b34-8fb2-64d1009f8021	5000	2026-05-10	PENDIENTE	2026-05-03 03:47:29.719499+00	\N	\N	\N	\N
cf37b90f-ad07-404d-aad4-5c1fe48b8a03	23c2224d-0aae-4fae-81ba-ed79cb3bbbe2	5000	2026-05-10	PENDIENTE	2026-05-03 03:47:29.719499+00	\N	\N	\N	\N
38b71b27-bd31-4e8f-b956-9cd85cffea0b	9102582e-308e-4d44-bd21-fa988d6c4891	5000	2026-05-10	PENDIENTE	2026-05-03 03:47:29.719499+00	\N	\N	\N	\N
60bf9199-e0bb-49f1-8c2f-a805c8ba1f0a	87666333-f287-41b6-b0d2-32fcf58e1daa	5000	2026-05-10	PENDIENTE	2026-05-03 03:47:29.719499+00	\N	\N	\N	\N
bbdba2e3-e9b4-4af9-bb7f-2370a8d9ff50	e82810c3-4550-4994-8bcd-e7e9e18deea9	5000	2026-05-10	PENDIENTE	2026-05-03 03:47:29.719499+00	\N	\N	\N	\N
248e3ab6-bcd6-42a9-b4e9-f7a290d4d3d0	3afd196c-9675-46d3-8650-76e71563c617	5000	2026-05-10	PENDIENTE	2026-05-03 03:47:29.719499+00	\N	\N	\N	\N
c0ca181d-c806-4e71-98c3-baf98c03e478	7b7e0daf-741d-4ca7-8ac4-ca7d78ebf8a8	5000	2026-05-10	PENDIENTE	2026-05-03 03:47:29.719499+00	\N	\N	\N	\N
62e5afcc-2610-4cfc-acd8-6ac4ed5209d7	93d7a43f-21d7-49a5-8794-0e1187dfcc7c	5000	2026-05-10	PENDIENTE	2026-05-03 03:47:29.719499+00	\N	\N	\N	\N
8aab3890-c07d-4f93-9a65-897d9801ce35	030556ed-8fbb-4783-9f87-f324a3cd5686	5000	2026-05-10	PENDIENTE	2026-05-03 03:47:29.719499+00	\N	\N	\N	\N
d5f8d9e4-4eb1-42aa-b6ed-8fbd3d9ef6d8	ab2edc19-8df3-419e-82c9-a97493ee29e7	5000	2026-05-10	PENDIENTE	2026-05-03 03:47:29.719499+00	\N	\N	\N	\N
dc89e522-693e-459a-8283-59e8cead7cb8	8add1c0e-5ad5-466b-8170-7959eb423e92	5000	2026-05-10	PENDIENTE	2026-05-03 03:47:29.719499+00	\N	\N	\N	\N
3aa3a198-a5d4-4476-93ae-b7eaaf867e9b	461a31ea-5286-42ab-8c1c-2d976da73d40	5000	2026-05-10	PENDIENTE	2026-05-03 03:47:29.719499+00	\N	\N	\N	\N
9ab81050-3844-431e-93f2-5dfcffe84ce1	b9e03dcc-3e7b-4fd7-91c3-54f4fd3f5b34	5000	2026-05-10	PENDIENTE	2026-05-03 03:47:29.719499+00	\N	\N	\N	\N
705bf91a-3af0-4869-b0e5-80bd7c1329a1	cb377de7-c49c-46b6-b735-3e42849ed1f0	5000	2026-05-10	PENDIENTE	2026-05-03 03:47:29.719499+00	\N	\N	\N	\N
66d91794-8f2b-44b5-bbaa-e9da40fdeb60	467290c0-3061-4bab-930b-791236a824f1	5000	2026-05-10	PENDIENTE	2026-05-03 03:47:29.719499+00	\N	\N	\N	\N
4142825d-baf6-40ed-9ee6-46b6731e04bb	1c757b75-8f83-4677-9747-043c4f03a67f	5000	2026-05-10	PENDIENTE	2026-05-03 03:47:29.719499+00	\N	\N	\N	\N
775009ee-b32a-432d-a9f1-fc8babeb18d2	2a1039a2-be04-42e1-a654-6e67de053dd9	5000	2026-05-10	PENDIENTE	2026-05-03 03:47:29.719499+00	\N	\N	\N	\N
384fd152-894c-47bf-858d-fc0cb8ee23b4	e01afdff-da8f-469a-a054-9eb71ccf3766	5000	2026-05-10	PENDIENTE	2026-05-03 03:47:29.719499+00	\N	\N	\N	\N
c560d0fa-f6fd-480c-a8d3-c7e9a7a5328b	87199fe9-bc96-400c-9d98-008190649581	5000	2026-05-10	PENDIENTE	2026-05-03 03:47:29.719499+00	\N	\N	\N	\N
\.


--
-- Data for Name: profesionales; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.profesionales (id, matricula, titulo, created_at, updated_at) FROM stdin;
b9e03dcc-3e7b-4fd7-91c3-54f4fd3f5b34	MP-12345	Abogado	2026-04-27 20:31:17.591492+00	2026-04-27 20:31:17.591492+00
87199fe9-bc96-400c-9d98-008190649581	MP-12346	Veterinario	2026-05-03 02:15:28.16954+00	2026-05-03 02:15:28.16954+00
\.


--
-- Data for Name: profiles; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.profiles (id, nombre_apellido, dni, email, telefono, rol, estado, password_changed, municipio, created_at, updated_at, es_profesional, rubro, camara_denominacion, camara_provincia, cuit, estado_aprobacion, foto_url, titular_id, tipo_vinculo, direccion, motivo, username, provincia, sonido_notificaciones_habilitado, barrio, numero_socio, es_estudiante, constancia_estudiante_url, membership_type, family_members_count, must_change_password, user_type, email_verificado, email_verificacion_token, email_verificacion_expira, tipo_socio) FROM stdin;
5d7855f3-f641-4af6-9537-f41b82ac162d	Victor Torrilla	32435789	victoralfredo27@gmail.com	3795330172	SOCIO	RESTRINGIDO	t	Capital	2026-04-25 21:58:56.021757+00	2026-05-03 03:47:29.408582+00	f	\N	\N	\N	\N	PENDIENTE	\N	\N	\N	\N	Mora automática cuota 5/2026	\N	Corrientes	t	Centro	0003	f	\N	INDIVIDUAL	1	f	SOCIO	t	\N	\N	\N
b4c9f795-d07f-4c08-b8cb-7b20dc08cbd5	EL BAGUAL 	20085614089	elbagual@gmail.com	3794228045	COMERCIO	RESTRINGIDO	f	Capital	2026-04-21 04:13:03.108242+00	2026-05-03 03:47:29.408582+00	f	otro	\N	\N	\N	PENDIENTE	\N	\N	\N	\N	Mora automática cuota 5/2026	\N	\N	t	\N	\N	f	\N	INDIVIDUAL	1	f	SOCIO	t	\N	\N	\N
b32ae806-027b-48f9-991a-e18fac9d8eba	Luis Landrisina	40456789	luis@gmail.com	3794111112	SOCIO	RESTRINGIDO	t	Capital	2026-04-25 19:39:15.51847+00	2026-05-03 03:47:29.408582+00	f	\N	\N	\N	\N	PENDIENTE	\N	\N	\N	\N	Mora automática cuota 5/2026	\N	Corrientes	t	Centro	0002	t	\N	INDIVIDUAL	1	f	SOCIO	t	\N	\N	\N
597219dc-9be9-4ab2-a432-16547e174b1a	HERMES GROUP	20219980850	hermes@gmail.com	3794862601	COMERCIO	RESTRINGIDO	f	Capital	2026-04-21 04:17:26.176166+00	2026-05-03 03:47:29.408582+00	f	otro	\N	\N	\N	PENDIENTE	\N	\N	\N	\N	Mora automática cuota 5/2026	\N	\N	t	\N	\N	f	\N	INDIVIDUAL	1	f	SOCIO	t	\N	\N	\N
ea625819-210b-4b34-8fb2-64d1009f8021	fransis Torrilla	12345678	dependiente.12345678@sociedadrural.local		SOCIO	RESTRINGIDO	f	Capital	2026-04-25 22:02:04.382025+00	2026-05-03 03:47:29.408582+00	f	\N	\N	\N	\N	PENDIENTE	\N	5d7855f3-f641-4af6-9537-f41b82ac162d	Hijo/a	\N	Mora automática cuota 5/2026	\N	\N	t	\N	0007	f	\N	INDIVIDUAL	1	f	SOCIO	t	\N	\N	\N
23c2224d-0aae-4fae-81ba-ed79cb3bbbe2	ACERO CORRIENTES 	20283030416	acerocorrientes@gmail.com	3795108390	COMERCIO	APROBADO	t	Capital	2026-04-21 04:19:27.347849+00	2026-05-04 04:38:44.076175+00	f	otro	\N	\N	\N	PENDIENTE	\N	\N	\N	\N	Mora automática cuota 5/2026	\N	\N	t	\N	\N	f	\N	INDIVIDUAL	1	f	SOCIO	t	\N	\N	\N
9102582e-308e-4d44-bd21-fa988d6c4891	FERREMAQ	30718848799	ferremaq@mail.com	3794112233	COMERCIO	RESTRINGIDO	f	Capital	2026-04-21 03:53:23.177998+00	2026-05-03 03:47:29.408582+00	f	construccion	\N	\N	\N	PENDIENTE	\N	\N	\N	\N	Mora automática cuota 5/2026	\N	\N	t	\N	\N	f	\N	INDIVIDUAL	1	f	SOCIO	t	\N	\N	\N
cbb3a9cb-cfdd-4b5e-b9b1-5162e1845b57	Librería El libro 	20141234569	libro@gmail.com	3241253698	COMERCIO	APROBADO	f	Riachuelo	2026-05-03 20:58:24.841203+00	2026-05-03 21:00:50.132412+00	f	otro	\N	\N	\N	PENDIENTE	\N	\N	\N	\N	\N	\N	\N	t	Centro	\N	f	\N	INDIVIDUAL	1	f	SOCIO	f	\N	\N	\N
87666333-f287-41b6-b0d2-32fcf58e1daa	CONFORTABLE	20109807711	confortable@gmail.com	3794111222	COMERCIO	RESTRINGIDO	f	Capital	2026-04-21 03:57:50.555933+00	2026-05-03 03:47:29.408582+00	f	otro	\N	\N	\N	PENDIENTE	\N	\N	\N	\N	Mora automática cuota 5/2026	\N	\N	t	\N	\N	f	\N	INDIVIDUAL	1	f	SOCIO	t	\N	\N	\N
e82810c3-4550-4994-8bcd-e7e9e18deea9	EST. DE SERV. PACHECO	30710417217	pacheco@gmail.com	3794334455	COMERCIO	RESTRINGIDO	f	Capital	2026-04-21 04:01:08.558879+00	2026-05-03 03:47:29.408582+00	f	otro	\N	\N	\N	PENDIENTE	\N	\N	\N	\N	Mora automática cuota 5/2026	\N	\N	t	\N	\N	f	\N	INDIVIDUAL	1	f	SOCIO	t	\N	\N	\N
3afd196c-9675-46d3-8650-76e71563c617	EL AROMITO	20266234764	aromito@gmail.com	3794556677	COMERCIO	RESTRINGIDO	f	Capital	2026-04-21 04:03:17.522411+00	2026-05-03 03:47:29.408582+00	f	otro	\N	\N	\N	PENDIENTE	\N	\N	\N	\N	Mora automática cuota 5/2026	\N	\N	t	\N	\N	f	\N	INDIVIDUAL	1	f	SOCIO	t	\N	\N	\N
7b7e0daf-741d-4ca7-8ac4-ca7d78ebf8a8	JARDIN UPA LALA	30714035114	upalala@gmail.com	3794445566	COMERCIO	RESTRINGIDO	f	Capital	2026-04-21 04:10:08.666614+00	2026-05-03 03:47:29.408582+00	f	otro	\N	\N	\N	PENDIENTE	\N	\N	\N	\N	Mora automática cuota 5/2026	\N	\N	t	\N	\N	f	\N	INDIVIDUAL	1	f	SOCIO	t	\N	\N	\N
93d7a43f-21d7-49a5-8794-0e1187dfcc7c	YA CHIPASITOS 	30719119138	yachipacitos@gmail.com	3795778899	COMERCIO	RESTRINGIDO	f	Capital	2026-04-21 04:07:44.787244+00	2026-05-03 03:47:29.408582+00	f	alimentacion	\N	\N	\N	PENDIENTE	\N	\N	\N	\N	Mora automática cuota 5/2026	\N	\N	t	\N	\N	f	\N	INDIVIDUAL	1	f	SOCIO	t	\N	\N	\N
030556ed-8fbb-4783-9f87-f324a3cd5686	ESPACIO BUNKER 	20383169349	bunker@gmail.com	3794556677	COMERCIO	RESTRINGIDO	f	Capital	2026-04-21 04:06:16.010896+00	2026-05-03 03:47:29.408582+00	f	otro	\N	\N	\N	PENDIENTE	\N	\N	\N	\N	Mora automática cuota 5/2026	\N	\N	t	\N	\N	f	\N	INDIVIDUAL	1	f	SOCIO	t	\N	\N	\N
ab2edc19-8df3-419e-82c9-a97493ee29e7	Flori Maciel	315759747	dependiente.315759747@sociedadrural.local		SOCIO	RESTRINGIDO	f	Capital	2026-04-25 22:02:30.793772+00	2026-05-03 03:47:29.408582+00	f	\N	\N	\N	\N	PENDIENTE	\N	5d7855f3-f641-4af6-9537-f41b82ac162d	Cónyuge	\N	Mora automática cuota 5/2026	\N	\N	t	\N	0008	f	\N	INDIVIDUAL	1	f	SOCIO	t	\N	\N	\N
8add1c0e-5ad5-466b-8170-7959eb423e92	Teo Torrilla	36925814	dependiente.36925814@sociedadrural.local		SOCIO	RESTRINGIDO	f	Capital	2026-04-25 22:05:00.173676+00	2026-05-03 03:47:29.408582+00	f	\N	\N	\N	\N	PENDIENTE	\N	5d7855f3-f641-4af6-9537-f41b82ac162d	Hijo/a	\N	Mora automática cuota 5/2026	\N	\N	t	\N	0009	f	\N	INDIVIDUAL	1	f	SOCIO	t	\N	\N	\N
461a31ea-5286-42ab-8c1c-2d976da73d40	Ubi Traslados 	20314355238	trasladosubi@gmail.com	3794088523	COMERCIO	RESTRINGIDO	t	Capital	2026-04-26 04:07:51.636912+00	2026-05-03 03:47:29.408582+00	f	transporte	\N	\N	\N	PENDIENTE	\N	\N	\N	\N	Mora automática cuota 5/2026	\N	\N	t	\N	\N	f	\N	INDIVIDUAL	1	f	SOCIO	t	\N	\N	\N
b9e03dcc-3e7b-4fd7-91c3-54f4fd3f5b34	Federico Molina	31445566	federico@gmail.com	3795998877	SOCIO	RESTRINGIDO	t	Capital	2026-04-27 20:31:17.217297+00	2026-05-03 03:47:29.408582+00	t	Abogado	\N	\N	\N	PENDIENTE	\N	\N	\N	Poncho Verde 741	Mora automática cuota 5/2026	\N	Corrientes	t	\N	0006	f	\N	INDIVIDUAL	1	f	SOCIO	t	\N	\N	\N
cb377de7-c49c-46b6-b735-3e42849ed1f0	Luciano Echeverría	31111222	luciano.eche@gmail.com	\N	ADMIN	RESTRINGIDO	t	\N	2026-04-27 22:45:18.076491+00	2026-05-03 03:47:29.408582+00	f	\N	\N	\N	\N	PENDIENTE	\N	\N	\N	\N	Mora automática cuota 5/2026	Luciano2026	\N	t	\N	\N	f	\N	INDIVIDUAL	1	f	SOCIO	t	\N	\N	\N
1c757b75-8f83-4677-9747-043c4f03a67f	Martín Alberto Soto	31435523	martinalbertosoto85@gmail.com	3794551810	ADMIN	RESTRINGIDO	t	Capital	2026-04-22 13:39:44.252529+00	2026-05-03 03:47:29.408582+00	f	\N	\N	\N	\N	PENDIENTE	\N	\N	\N	Las Camelias 6600, Corrientes capital 	Mora automática cuota 5/2026	martin_alberto	\N	t	Piragine niveyro 	\N	f	\N	INDIVIDUAL	1	f	SOCIO	t	\N	\N	\N
e01afdff-da8f-469a-a054-9eb71ccf3766	Benjamin Emiliano Torrilla	12457836	benja@gmail.com		SOCIO	RESTRINGIDO	f	Capital	2026-04-25 23:26:25.316403+00	2026-05-03 03:47:29.408582+00	f	\N	\N	\N	\N	PENDIENTE	\N	2a1039a2-be04-42e1-a654-6e67de053dd9	Cónyuge	\N	Mora automática cuota 5/2026	\N	\N	t	\N	0004	f	\N	INDIVIDUAL	1	f	FAMILIAR	t	\N	\N	\N
87199fe9-bc96-400c-9d98-008190649581	Carlos Ruíz	15123456	veterinario@gmail.com	3777123456	SOCIO	RESTRINGIDO	f	Capital	2026-05-03 02:15:27.906084+00	2026-05-03 03:47:29.408582+00	t	Veterinario	\N	\N	\N	PENDIENTE	\N	\N	\N	Avenida Artiga 100	Mora automática cuota 5/2026	\N	Corrientes	t	\N	0010	f	\N	INDIVIDUAL	1	f	SOCIO	f	\N	\N	\N
2a1039a2-be04-42e1-a654-6e67de053dd9	Florencia Maciel	31759747	flormac@gmail.com	3794330172	SOCIO	RESTRINGIDO	t	Capital	2026-04-24 04:34:56.925925+00	2026-05-03 21:09:29.683273+00	t	\N	\N	\N	\N	PENDIENTE	https://jeeurezcswuchpzwgfno.supabase.co/storage/v1/object/public/business-logos/2a1039a2-be04-42e1-a654-6e67de053dd9/profile.jpg	\N	\N		Mora automática cuota 5/2026	\N	Corrientes	t	Centro	0001	f	\N	INDIVIDUAL	1	f	SOCIO	t	\N	\N	\N
467290c0-3061-4bab-930b-791236a824f1	Victor Alfredo	31435789	victoralfredo2498@gmail.com	000000000	ADMIN	RESTRINGIDO	t	No especificado	2026-03-08 03:46:02.276331+00	2026-05-03 04:03:20.746904+00	f	\N	\N	\N	\N	PENDIENTE	https://jeeurezcswuchpzwgfno.supabase.co/storage/v1/object/public/business-logos/467290c0-3061-4bab-930b-791236a824f1/profile.jpg	\N	\N	\N	Mora automática cuota 5/2026	Superadmin	\N	t	\N	\N	f	\N	INDIVIDUAL	1	f	SOCIO	t	\N	\N	\N
579417ad-55d6-42e6-a2ee-eaf674a58060	Luisa Florencia Maciel	31759748	flormaciel85@gmail.com	3794668633	SOCIO	SUSPENDIDO	t	Capital	2026-05-03 05:28:38.103761+00	2026-05-03 05:51:47.553887+00	t	\N	\N	\N	\N	PENDIENTE	\N	\N	\N	\N	\N	\N	Corrientes	t	Centro	0011	f	\N	INDIVIDUAL	1	f	SOCIO	t	\N	\N	\N
\.


--
-- Data for Name: promociones; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.promociones (id, comercio_id, titulo, descripcion, descuento_porcentaje, fecha_inicio, fecha_fin, activo, created_at, tipo, imagen_url, updated_at, es_exclusiva_profesionales, instagram_url, facebook_url, organizacion_id, valor_descuento, tipo_descuento) FROM stdin;
\.


--
-- Data for Name: push_tokens; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.push_tokens (id, usuario_id, token, plataforma, created_at) FROM stdin;
78d979d4-289f-47ee-83cd-45f08a22dc79	2a1039a2-be04-42e1-a654-6e67de053dd9	dMH5Q2peQSyrfyFKD6MGkC:APA91bFOq1PX9wGgA3xapHJxSfKgL6nUunEWZoZXh2A6QJTcrDOpqwVijX8yYEhkSfagrWgP1xCqs_mvV-koidkjVoTaJYdTNk3MbSlxdnxFdPs-7sHebY0	android	2026-05-02 19:36:17.484302+00
efc13c0f-2ef0-4486-9637-c09565c5f700	467290c0-3061-4bab-930b-791236a824f1	dMH5Q2peQSyrfyFKD6MGkC:APA91bGZ9VoHomMJJOCj6DVZirU7r2PrMRwHYVrPMGgG7ZWvDnIxQn9FPvVTBeRsR2HXPn6ITq3HQm2OyS0qz5TdQ_EVKUEDxSviHVXc7WIdLGGWQZxUruQ	android	2026-05-03 05:51:00.228526+00
471e99b5-9e61-4215-83f9-70443720efc3	467290c0-3061-4bab-930b-791236a824f1	dMH5Q2peQSyrfyFKD6MGkC:APA91bEfhUWPv4DmkNZcY8AIRn0RzkuMmpBvzgb9lyPnTp1YlUNRvYtZh8dpZ9mnrj698x5gcZvqCtl21al7fy54uF-gir2uC1JaavFibmjlF_YtoHSamso	android	2026-05-03 19:33:31.57096+00
cb0da85f-d43b-40d1-96b1-577fa7c7aaf6	2a1039a2-be04-42e1-a654-6e67de053dd9	dMH5Q2peQSyrfyFKD6MGkC:APA91bFfIgz9NZKGNxM1SeUbyxn9iAzBPLe5F40o4f6B2ZdAfs3cqjznrvMBuI2xQzNd3yvzZI0Evrfssy1vdSfBahcp-xZVEFZOQCGvUzTynxMhvA0yflo	android	2026-05-03 21:05:30.4292+00
88999111-0523-4408-8ae2-832d76b9e5f1	2a1039a2-be04-42e1-a654-6e67de053dd9	dMH5Q2peQSyrfyFKD6MGkC:APA91bERIM3MWREIahPtmiwUCgtbEZXaxoFcmJ8pw7XorJlSuJMFS9hC9Y0vIFP-Bjgm2HGzfydF1FsbSfleFe3iCo2oI4IiCV4INZkPtyT2N4Q0jokmzJw	android	2026-05-03 23:11:44.539187+00
6f4eb635-f7cc-4062-9244-01dfabec2401	2a1039a2-be04-42e1-a654-6e67de053dd9	dMH5Q2peQSyrfyFKD6MGkC:APA91bG5WrUAPZSqyeWjvOclXXseSeHLZlcAWcdTNWbDTN_uSyP0lvzJYvUr_j7ck82aM4sKYNOFSKMUZeRNwETXelwQCDBh5Cd81k6ZFZq34WCWEKYJk34	android	2026-05-04 04:24:05.265656+00
\.


--
-- Data for Name: qr_tokens; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.qr_tokens (id, user_id, token, expires_at, used, created_at) FROM stdin;
5da23eae-4417-4e99-8fd4-343b2fc2f82f	467290c0-3061-4bab-930b-791236a824f1	7fe65e53-2c13-4632-bd95-ac8170114389	2026-04-24 02:01:24.51778+00	t	2026-04-24 02:00:24.665399+00
bb10abfb-e16e-4983-bb35-b8778c8c9487	467290c0-3061-4bab-930b-791236a824f1	46e30753-bad4-4176-a018-68f36bbd72e7	2026-04-24 04:32:33.111252+00	f	2026-04-24 04:31:33.235807+00
7e74e37e-713b-4bdf-be24-06bf40a3d42d	467290c0-3061-4bab-930b-791236a824f1	5d2f0a4e-d3de-41f7-bd43-83ddd40c1d11	2026-04-24 04:32:49.180237+00	f	2026-04-24 04:31:49.299721+00
7d7bd9f5-7778-416c-9af3-fb4af412f2bc	467290c0-3061-4bab-930b-791236a824f1	4e4f20c1-fe34-46c5-afa1-27126ec60e6f	2026-04-24 04:32:53.925615+00	f	2026-04-24 04:31:54.049031+00
38cc71ce-5992-40dc-a83d-8bc116388a46	2a1039a2-be04-42e1-a654-6e67de053dd9	ee043f4d-ae5e-452e-b55d-73a8d0b2c171	2026-04-24 04:39:12.91715+00	f	2026-04-24 04:38:13.039793+00
a7b6bc1e-1bcb-4e1a-8488-f038a3a9279c	2a1039a2-be04-42e1-a654-6e67de053dd9	b14a2eea-6cdc-4fac-bccc-f6c99856966e	2026-04-24 04:39:20.706581+00	f	2026-04-24 04:38:20.807387+00
c92450fe-b594-4d22-bfa5-8fe99082fc7e	2a1039a2-be04-42e1-a654-6e67de053dd9	8d476f1a-8b07-4229-b734-17cd62cc084c	2026-04-24 04:39:25.461331+00	f	2026-04-24 04:38:25.565218+00
ed387e88-4658-430c-8de0-32a88339bfe3	2a1039a2-be04-42e1-a654-6e67de053dd9	f9f9990f-33b5-4f3d-a6a2-db50e9185730	2026-04-24 05:30:16.217822+00	f	2026-04-24 05:29:16.38363+00
b2b7100a-6d15-4b6b-8238-472305bf0fb7	2a1039a2-be04-42e1-a654-6e67de053dd9	6bd33006-dd82-4550-a220-181fbba58e50	2026-04-24 21:38:45.525072+00	f	2026-04-24 21:37:45.702839+00
c90bbfc3-0639-485f-9750-d232f6b9e6a4	2a1039a2-be04-42e1-a654-6e67de053dd9	64b7f9fd-7127-456a-a9bb-d4e4f414c256	2026-04-24 21:54:32.450659+00	f	2026-04-24 21:53:32.654017+00
376c724b-72bc-41c6-969b-4bc8f1afb20b	1c757b75-8f83-4677-9747-043c4f03a67f	37e95bcc-3fdd-4d26-beef-d2ab28fc88a6	2026-04-24 22:25:46.825888+00	t	2026-04-24 22:24:46.935437+00
77da4fbb-97ac-4616-ba67-b76dc6902d56	b32ae806-027b-48f9-991a-e18fac9d8eba	9ac154c6-04c5-4683-961d-330f1512f79b	2026-04-25 19:52:11.253579+00	f	2026-04-25 19:51:11.559797+00
9a1b20eb-56e7-4ab1-8004-25c2bd06ccfc	b32ae806-027b-48f9-991a-e18fac9d8eba	4d670c5b-3a7d-46ca-9079-181ca34dec6a	2026-04-25 19:52:19.830724+00	f	2026-04-25 19:51:19.959229+00
cb081418-815f-42d7-b86f-a4b3e50faa4d	b32ae806-027b-48f9-991a-e18fac9d8eba	f1fcad40-3be5-448b-ad16-b7e086a35a13	2026-04-25 20:05:58.904786+00	f	2026-04-25 20:04:59.79199+00
e1776d27-3a07-4e02-829a-176d0a26776d	b32ae806-027b-48f9-991a-e18fac9d8eba	47059268-cc46-4594-9cf4-c4dfe4397f68	2026-04-25 20:06:10.871167+00	f	2026-04-25 20:05:11.11137+00
a0889cfb-ef0a-41ca-8aba-545a4821ba77	b32ae806-027b-48f9-991a-e18fac9d8eba	d91285ea-c735-4ce0-8494-0c91d82ce402	2026-04-25 20:30:57.123626+00	f	2026-04-25 20:29:57.674216+00
430e6d15-6429-40bc-98c0-dcced4046e9b	2a1039a2-be04-42e1-a654-6e67de053dd9	e3b74dd0-e5e5-4db5-9a4a-ccd834ea70f5	2026-04-26 00:44:54.383999+00	f	2026-04-26 00:43:54.520111+00
17620e0c-9ea6-4b56-9269-cea72da09603	2a1039a2-be04-42e1-a654-6e67de053dd9	224ca5fe-492c-48ff-adfa-3afc0c64f56a	2026-04-26 00:45:01.571662+00	f	2026-04-26 00:44:02.11652+00
8fea8df9-8e7b-4e52-893e-63b72ee19c7b	e01afdff-da8f-469a-a054-9eb71ccf3766	93fd5cfc-408c-472f-96e2-ea85aaf7bc44	2026-04-26 00:46:35.052976+00	t	2026-04-26 00:45:35.203847+00
a5c0d0d3-1a24-4490-90da-49d0f7f9d398	cb377de7-c49c-46b6-b735-3e42849ed1f0	46ae905e-0d06-4227-86cf-2eb17593f566	2026-04-27 22:48:10.311042+00	f	2026-04-27 22:47:10.446711+00
ead8358c-525c-439a-8cc3-84798bbb9640	b32ae806-027b-48f9-991a-e18fac9d8eba	e682f707-bb2e-4006-91dc-3556133ddcd8	2026-04-28 00:18:44.52301+00	f	2026-04-28 00:17:44.666873+00
83394ee2-734c-4fc0-be37-e542d6bbd02d	467290c0-3061-4bab-930b-791236a824f1	dadab13d-c26d-4936-9b32-c0941b5042f4	2026-04-28 09:41:39.382492+00	f	2026-04-28 09:40:39.523653+00
15ad89d9-3757-4706-b464-c61899cc4121	1c757b75-8f83-4677-9747-043c4f03a67f	9847a068-09a4-4fb5-8f2c-5407299e4a2d	2026-04-28 11:46:49.201381+00	f	2026-04-28 11:45:49.333517+00
5993e7c5-9f68-4f28-ade8-bc8eaf731ca9	1c757b75-8f83-4677-9747-043c4f03a67f	f32d6632-cdbb-4117-b4b0-97f3ca4f7351	2026-04-28 11:47:01.857236+00	f	2026-04-28 11:46:01.993539+00
ef1ef583-542e-4d2e-af0e-68543f76d940	2a1039a2-be04-42e1-a654-6e67de053dd9	95a2e243-3809-4f3f-95d2-4cf8cf63d096	2026-04-28 20:21:44.283193+00	f	2026-04-28 20:20:44.423166+00
eaa0c88c-3449-4a4d-baa3-38fdc97f1efc	2a1039a2-be04-42e1-a654-6e67de053dd9	68322d0e-ef7f-4a99-b597-67e30a36f7dc	2026-04-28 20:57:48.547208+00	f	2026-04-28 20:56:48.67563+00
52f0eca4-831c-4c0f-a849-71a2d3cf6352	467290c0-3061-4bab-930b-791236a824f1	4e28d7f0-943d-4b39-acff-1aa9ec01ae17	2026-04-28 21:16:58.027883+00	f	2026-04-28 21:15:58.141499+00
9e6d398a-0867-48b6-82d2-1c78bc0e8056	2a1039a2-be04-42e1-a654-6e67de053dd9	acf72050-99b1-41d0-afdf-1e0887ef7b6d	2026-04-29 01:38:03.413322+00	f	2026-04-29 01:37:03.562603+00
578d796e-bc03-410b-8ee9-c3722e07ca29	2a1039a2-be04-42e1-a654-6e67de053dd9	36a0b4f9-9b31-44e7-9424-b65e92eee060	2026-04-29 01:38:09.600616+00	f	2026-04-29 01:37:09.720159+00
0437a961-fe35-4704-afab-42a0ceacda32	2a1039a2-be04-42e1-a654-6e67de053dd9	cb3ffcc4-baa3-4a01-9253-b794026daaa1	2026-04-29 04:27:17.013911+00	f	2026-04-29 04:26:17.169492+00
b445a451-5952-42ce-82b8-f9c1bb5ccdc5	2a1039a2-be04-42e1-a654-6e67de053dd9	d3353cea-2f11-4a6b-9089-479f9c3de61c	2026-04-29 05:11:24.884606+00	f	2026-04-29 05:10:25.009278+00
987883c7-a797-43c4-a275-4046f083d067	1c757b75-8f83-4677-9747-043c4f03a67f	4d485293-1a68-4735-ac5c-40e431582915	2026-04-29 13:45:32.563749+00	f	2026-04-29 13:44:32.765678+00
0eaa4d1f-8e63-4407-918f-155a4043433d	1c757b75-8f83-4677-9747-043c4f03a67f	c05821e2-1a42-485e-bb7a-3bca937bd87f	2026-04-29 13:45:59.814638+00	f	2026-04-29 13:44:59.961299+00
d2c6f8e7-a069-4589-8a20-97bbed8877ca	2a1039a2-be04-42e1-a654-6e67de053dd9	142084e6-b350-4c75-92e2-cbd60507926f	2026-04-29 16:52:31.989985+00	f	2026-04-29 16:51:32.111104+00
8c8db4d9-c38f-4f69-bff7-0fefced29f2a	2a1039a2-be04-42e1-a654-6e67de053dd9	91824e99-91d6-432b-820e-e62c539670d4	2026-04-29 16:52:38.676486+00	f	2026-04-29 16:51:38.800372+00
02952942-bdea-4be7-bd45-aa13feb2cb71	2a1039a2-be04-42e1-a654-6e67de053dd9	e5104757-690c-4730-8ad0-e81449b5bc96	2026-04-29 19:33:20.323158+00	f	2026-04-29 19:32:21.135917+00
21ee485b-f5b4-411e-ab1e-1baa0726152e	2a1039a2-be04-42e1-a654-6e67de053dd9	c82e12f5-9807-434c-824d-93ae96c44273	2026-04-29 19:34:24.737746+00	f	2026-04-29 19:33:24.892901+00
b3de231e-e6b9-454b-b8be-dba3f48b6690	2a1039a2-be04-42e1-a654-6e67de053dd9	5bafdcb5-b5fb-494e-bbd3-348ef24dcf2d	2026-04-29 21:35:05.263854+00	f	2026-04-29 21:34:05.883569+00
d851aa5f-cdba-4bfe-936f-80a2995ba7c3	2a1039a2-be04-42e1-a654-6e67de053dd9	ee1cff6f-223b-4379-bcf7-47e3e782a495	2026-04-29 21:55:04.695165+00	f	2026-04-29 21:54:05.326583+00
cdfaaed5-ddf7-4b8c-ba3c-317da6fa8a6a	2a1039a2-be04-42e1-a654-6e67de053dd9	95795abe-9e05-4d57-8d97-d5838c57d6c0	2026-04-29 22:13:48.38268+00	f	2026-04-29 22:12:48.699646+00
a5c39da3-18e4-49b1-a508-db8b331785fd	2a1039a2-be04-42e1-a654-6e67de053dd9	68b31354-9250-4fdd-a4f3-9d3d789be2c2	2026-04-29 23:02:28.197372+00	f	2026-04-29 23:01:29.056879+00
085e18dc-6cae-48ee-b15f-7b5e7b60150f	2a1039a2-be04-42e1-a654-6e67de053dd9	47e80182-9e6e-4b4c-9014-5aa3246812c7	2026-04-29 23:02:39.021818+00	f	2026-04-29 23:01:39.165529+00
3f5aa6b5-e1cd-49da-816f-932aeb933c1d	2a1039a2-be04-42e1-a654-6e67de053dd9	19ef834d-d348-4f71-97b9-c62f8f8e4ff1	2026-04-29 23:23:19.101936+00	f	2026-04-29 23:22:19.22337+00
5c2cf2bb-793a-4778-8a5a-2708c11b310d	2a1039a2-be04-42e1-a654-6e67de053dd9	c94fa5f6-5a48-4d16-9a02-8c8ef1a1d5fa	2026-04-29 23:24:15.529101+00	f	2026-04-29 23:23:15.690752+00
73abdbc8-4cf4-4f87-a9b7-19650e855ef1	2a1039a2-be04-42e1-a654-6e67de053dd9	e182ae3f-3768-4247-827f-8d272ac496ae	2026-04-30 00:24:24.853211+00	f	2026-04-30 00:23:25.01157+00
2749a8d7-f684-4ec8-b317-258937608bdf	2a1039a2-be04-42e1-a654-6e67de053dd9	f6a8cf60-379e-4057-9239-3a8a86ff3573	2026-04-30 00:31:00.705496+00	f	2026-04-30 00:30:00.8687+00
54f540aa-0c98-4dd3-95e6-8870d32ae037	2a1039a2-be04-42e1-a654-6e67de053dd9	80c69343-f5e8-4145-b9ea-73e0a7b6a607	2026-04-30 00:31:11.724236+00	f	2026-04-30 00:30:11.865767+00
cd240d2b-5395-45e2-940e-8488af64f0c1	1c757b75-8f83-4677-9747-043c4f03a67f	1ae09404-15d1-4f36-b3b9-d2d22665a764	2026-04-30 01:11:45.65849+00	f	2026-04-30 01:10:45.810614+00
15bf41de-d4f7-421f-a838-9411efbea8a5	467290c0-3061-4bab-930b-791236a824f1	b7cd561b-be36-48d9-a33a-6d4897e4d169	2026-04-30 10:42:25.865719+00	f	2026-04-30 10:41:26.089761+00
e32ae211-8a62-41af-9993-e804702c973e	467290c0-3061-4bab-930b-791236a824f1	c2038c0a-b2af-475e-8f5a-d6cc8f161ebf	2026-04-30 10:42:28.323363+00	f	2026-04-30 10:41:28.464746+00
a8e48fcc-b250-440b-9b7a-042f61085ec4	1c757b75-8f83-4677-9747-043c4f03a67f	58930354-b47e-4748-9b51-05ef3239a372	2026-04-30 13:43:17.434743+00	f	2026-04-30 13:42:17.991099+00
8e914c98-1eb4-4413-8d6f-6bc0c1e8a677	1c757b75-8f83-4677-9747-043c4f03a67f	4b21de1e-ad4e-4754-a314-cf0de956cbc0	2026-04-30 20:23:44.804445+00	f	2026-04-30 20:22:45.363312+00
05b4b64c-6ae8-4ec9-a2f4-295ccd584b6f	1c757b75-8f83-4677-9747-043c4f03a67f	7ee3065e-db83-4d61-8aa8-071ce9c24233	2026-04-30 23:58:27.191137+00	f	2026-04-30 23:57:27.324491+00
83bd2ae3-d029-49b6-b00e-cc849b40ad77	467290c0-3061-4bab-930b-791236a824f1	b1805f93-9105-4341-879e-aef173d5f5d6	2026-05-01 02:02:10.506584+00	f	2026-05-01 02:01:10.634488+00
64db5243-92c3-4fff-af0a-9ff0f4262382	2a1039a2-be04-42e1-a654-6e67de053dd9	1e609cb7-caa7-4bf9-86e7-23e528f123da	2026-05-01 04:14:33.185592+00	f	2026-05-01 04:13:33.352577+00
92ebeeca-4a1e-4ab0-8b10-6791420b77b9	2a1039a2-be04-42e1-a654-6e67de053dd9	d8260f1c-0bec-4687-9d99-94b7d088bc4d	2026-05-01 17:26:30.582298+00	f	2026-05-01 17:25:30.711034+00
c2b22208-fa1c-4b51-b511-f531bb442976	2a1039a2-be04-42e1-a654-6e67de053dd9	0b46cef3-23b6-4b14-8a42-3645854d405b	2026-05-01 17:26:42.855017+00	f	2026-05-01 17:25:42.97056+00
74eee07d-d2c2-4191-8aef-46677df561e9	2a1039a2-be04-42e1-a654-6e67de053dd9	8cee90be-4db2-423e-bf83-bf8ac9348626	2026-05-01 20:17:32.169781+00	f	2026-05-01 20:16:32.288936+00
b155c7e1-cef5-4c73-965f-21a8870f2b23	2a1039a2-be04-42e1-a654-6e67de053dd9	7ce3fd46-9a8a-4848-8f31-bab2989c8e8d	2026-05-01 20:17:39.553184+00	f	2026-05-01 20:16:39.688168+00
2b08f571-e65c-4ada-a766-e739bfa5e7c3	467290c0-3061-4bab-930b-791236a824f1	7c1bb7cb-1b77-4893-b7db-dcb13dae2f64	2026-05-01 23:36:50.53439+00	f	2026-05-01 23:35:50.644523+00
226a8e44-c355-40e8-9efa-50f810eb0786	467290c0-3061-4bab-930b-791236a824f1	aed15283-7228-4292-98cb-6097b3dec783	2026-05-01 23:36:58.295334+00	f	2026-05-01 23:35:58.404698+00
04bebf1a-218a-40cc-ade8-5eeadeff5d33	2a1039a2-be04-42e1-a654-6e67de053dd9	197a48f2-1e34-44da-9276-7b21a0147261	2026-05-01 23:52:24.82485+00	f	2026-05-01 23:51:24.952817+00
bd17e4f9-f04b-48d2-8541-1ba181a9e3f9	2a1039a2-be04-42e1-a654-6e67de053dd9	8af2bfff-f5bd-404f-a8d4-b467b8cc8500	2026-05-01 23:52:31.659524+00	f	2026-05-01 23:51:31.789572+00
f119e817-070d-47e6-8bbc-46bed46f09c5	2a1039a2-be04-42e1-a654-6e67de053dd9	8ee83995-d9b0-4174-8336-beed010a2807	2026-05-02 06:25:04.477734+00	f	2026-05-02 06:24:04.605281+00
589b6492-f14d-4531-9a0b-8b30e67871c9	2a1039a2-be04-42e1-a654-6e67de053dd9	c0798ee3-968c-44a7-b697-24e30b0b699a	2026-05-02 06:25:13.169898+00	f	2026-05-02 06:24:13.283198+00
1ee89c83-f29c-442b-a7fe-a536e965bb93	2a1039a2-be04-42e1-a654-6e67de053dd9	d4689b14-224a-44c1-be30-95b2f1b4a422	2026-05-02 19:24:23.403018+00	f	2026-05-02 19:23:23.534129+00
ca6d3091-f297-4c9c-b878-516cb35744d9	2a1039a2-be04-42e1-a654-6e67de053dd9	bd10cd5d-a78e-4aea-8ab0-fbb83817e965	2026-05-02 19:24:32.22158+00	f	2026-05-02 19:23:32.378029+00
26cc5423-72e7-4bdb-a368-070673fb3f5f	2a1039a2-be04-42e1-a654-6e67de053dd9	a3dee09a-df08-4420-89cc-55241deb2227	2026-05-02 19:38:39.534371+00	f	2026-05-02 19:37:39.665437+00
cb290ab3-f3e2-4705-8e25-640090450cb4	2a1039a2-be04-42e1-a654-6e67de053dd9	a5155cb2-e90a-4ecd-a2e1-6fb3044414c6	2026-05-02 19:38:50.415866+00	f	2026-05-02 19:37:50.547319+00
fdd0202a-094d-4245-9257-45f45b24e389	2a1039a2-be04-42e1-a654-6e67de053dd9	cc950ea2-c305-48b0-b374-7a2beb803a5a	2026-05-03 00:42:40.257081+00	f	2026-05-03 00:41:40.403409+00
7bee5282-de23-430e-88c5-945a4c908c2b	2a1039a2-be04-42e1-a654-6e67de053dd9	10e47a59-12f6-4526-b141-103aa0e59349	2026-05-03 00:42:48.512182+00	f	2026-05-03 00:41:48.651429+00
6a774621-8d47-486e-b689-e5b7949a7494	467290c0-3061-4bab-930b-791236a824f1	b4492dda-d8a3-4dab-adbc-ed3c58e940c8	2026-05-03 04:03:27.010249+00	f	2026-05-03 04:02:27.140417+00
82aacd59-8f2f-4a09-9027-ab217d0341b7	467290c0-3061-4bab-930b-791236a824f1	4fd237b2-5b52-4bf8-be7e-d2c36eba109a	2026-05-03 04:03:36.926347+00	f	2026-05-03 04:02:37.064385+00
91385cb9-d76c-4aff-baef-4bf9014637ba	2a1039a2-be04-42e1-a654-6e67de053dd9	8abb30cd-3211-41cc-b0ea-df8445b3046d	2026-05-03 05:00:41.571771+00	f	2026-05-03 04:59:41.708573+00
8f641c98-cfc5-4603-836b-070391300b25	2a1039a2-be04-42e1-a654-6e67de053dd9	907c0213-d09e-429f-b64f-10e7741fbe57	2026-05-03 05:01:53.728721+00	f	2026-05-03 05:00:53.88346+00
e50a2c60-2a47-4080-8739-e90fdbbd47c4	2a1039a2-be04-42e1-a654-6e67de053dd9	b3109aeb-0e9d-4b64-b3b9-45481183c955	2026-05-03 05:02:07.43199+00	f	2026-05-03 05:01:07.585544+00
3be871e1-e2c4-41bf-981d-f18ab9193b03	579417ad-55d6-42e6-a2ee-eaf674a58060	c9e796fc-c9bf-48a4-b3b9-b783e239efde	2026-05-03 05:41:45.663266+00	f	2026-05-03 05:40:45.813079+00
2dc5552f-3bcd-4221-90c1-a29f9c683007	579417ad-55d6-42e6-a2ee-eaf674a58060	c7feac2a-1d16-46d2-9513-3ec5a941189f	2026-05-03 05:42:01.397206+00	f	2026-05-03 05:41:01.910137+00
4c8d7269-7a6b-4252-8380-7f2c531bbc79	2a1039a2-be04-42e1-a654-6e67de053dd9	2f8ce55e-056f-4479-a8fe-eddb3ed2743e	2026-05-03 18:54:10.571452+00	f	2026-05-03 18:53:11.135608+00
bee3ec8c-e66c-45c3-b924-76614f073748	2a1039a2-be04-42e1-a654-6e67de053dd9	e93990ca-4312-458b-9b58-35cac4bd03cd	2026-05-03 21:09:41.906241+00	f	2026-05-03 21:08:42.032085+00
39f0e0ed-819f-444c-bad9-58e3ea37cf72	2a1039a2-be04-42e1-a654-6e67de053dd9	2d5a6e23-596f-4e98-9e6a-d66419ddc464	2026-05-03 21:09:58.823607+00	f	2026-05-03 21:08:58.957303+00
97be15bb-754e-46c9-9c10-c1c5fe061090	2a1039a2-be04-42e1-a654-6e67de053dd9	729596ee-d254-46a5-80c1-4c4c7a2f8efd	2026-05-03 23:14:50.395114+00	f	2026-05-03 23:13:50.664892+00
7ddf6f94-098e-42a3-af17-c883c022085f	2a1039a2-be04-42e1-a654-6e67de053dd9	789f0166-9b97-4500-9f65-5bb95ec36ee9	2026-05-03 23:15:01.746991+00	f	2026-05-03 23:14:01.921163+00
19258a04-d06d-4442-9591-5a3a90d42536	2a1039a2-be04-42e1-a654-6e67de053dd9	9238d17b-69b3-41b8-a443-c0a8533c261c	2026-05-04 04:16:16.652692+00	f	2026-05-04 04:15:16.783241+00
fa39af8e-75d9-4e24-a5dc-fa078a2e7966	2a1039a2-be04-42e1-a654-6e67de053dd9	2f5f4d10-2f02-41ab-909a-c2b45f5cddf0	2026-05-04 04:16:25.30255+00	f	2026-05-04 04:15:25.446777+00
0d3f4c86-6dac-4412-bbd5-0f213f185faf	2a1039a2-be04-42e1-a654-6e67de053dd9	d57f3ac5-570e-4b53-bdbc-7071c4a195de	2026-05-04 04:26:26.901582+00	f	2026-05-04 04:25:27.03183+00
c2e8ec45-eff0-498c-819d-6e6c49c4c3f5	2a1039a2-be04-42e1-a654-6e67de053dd9	7f630ce9-3514-46b5-b6cc-dbf9bbd82ade	2026-05-04 04:26:35.609096+00	f	2026-05-04 04:25:35.72972+00
\.


--
-- Data for Name: roles; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.roles (id, nombre, descripcion, created_at) FROM stdin;
12906f03-e5ef-4ae5-ab96-72ccefe975e1	SUPERADMIN	Control total del sistema	2026-03-09 22:21:31.920343+00
d7ec7db7-98dd-4da3-ac8f-886daf0d637d	ADMINISTRADOR	Control operativo del sistema	2026-03-09 22:21:31.920343+00
6c7decbf-cfb5-4d24-a46a-879c8206255c	SOCIO	Usuario normal del sistema	2026-03-09 22:21:31.920343+00
\.


--
-- Data for Name: suscripciones; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.suscripciones (id, socio_id, estado_pago, vencimiento, mercado_pago_id, created_at, mes, anio, comprobante_url) FROM stdin;
\.


--
-- Data for Name: user_roles; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.user_roles (user_id, role_id, assigned_at) FROM stdin;
467290c0-3061-4bab-930b-791236a824f1	12906f03-e5ef-4ae5-ab96-72ccefe975e1	2026-03-09 23:05:07.202945+00
467290c0-3061-4bab-930b-791236a824f1	6c7decbf-cfb5-4d24-a46a-879c8206255c	2026-03-09 23:05:07.202945+00
1c757b75-8f83-4677-9747-043c4f03a67f	d7ec7db7-98dd-4da3-ac8f-886daf0d637d	2026-04-22 13:39:44.480691+00
1c757b75-8f83-4677-9747-043c4f03a67f	6c7decbf-cfb5-4d24-a46a-879c8206255c	2026-04-22 13:39:44.720421+00
cb377de7-c49c-46b6-b735-3e42849ed1f0	d7ec7db7-98dd-4da3-ac8f-886daf0d637d	2026-04-27 22:45:18.292792+00
cb377de7-c49c-46b6-b735-3e42849ed1f0	6c7decbf-cfb5-4d24-a46a-879c8206255c	2026-04-27 22:45:18.547982+00
\.


--
-- Name: activity_log activity_log_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.activity_log
    ADD CONSTRAINT activity_log_pkey PRIMARY KEY (id);


--
-- Name: auditoria_logs auditoria_logs_pkey1; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.auditoria_logs
    ADD CONSTRAINT auditoria_logs_pkey1 PRIMARY KEY (id, fecha);


--
-- Name: auditoria_logs_2024 auditoria_logs_2024_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.auditoria_logs_2024
    ADD CONSTRAINT auditoria_logs_2024_pkey PRIMARY KEY (id, fecha);


--
-- Name: auditoria_logs_2025 auditoria_logs_2025_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.auditoria_logs_2025
    ADD CONSTRAINT auditoria_logs_2025_pkey PRIMARY KEY (id, fecha);


--
-- Name: auditoria_logs_2026 auditoria_logs_2026_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.auditoria_logs_2026
    ADD CONSTRAINT auditoria_logs_2026_pkey PRIMARY KEY (id, fecha);


--
-- Name: auditoria_logs_2027 auditoria_logs_2027_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.auditoria_logs_2027
    ADD CONSTRAINT auditoria_logs_2027_pkey PRIMARY KEY (id, fecha);


--
-- Name: auditoria_logs_2028 auditoria_logs_2028_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.auditoria_logs_2028
    ADD CONSTRAINT auditoria_logs_2028_pkey PRIMARY KEY (id, fecha);


--
-- Name: chat_history chat_history_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.chat_history
    ADD CONSTRAINT chat_history_pkey PRIMARY KEY (id);


--
-- Name: comercio_solicitudes comercio_solicitudes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.comercio_solicitudes
    ADD CONSTRAINT comercio_solicitudes_pkey PRIMARY KEY (id);


--
-- Name: comercio_solicitudes comercio_solicitudes_user_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.comercio_solicitudes
    ADD CONSTRAINT comercio_solicitudes_user_id_key UNIQUE (user_id);


--
-- Name: comercios comercios_cuit_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.comercios
    ADD CONSTRAINT comercios_cuit_key UNIQUE (cuit);


--
-- Name: comercios comercios_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.comercios
    ADD CONSTRAINT comercios_pkey PRIMARY KEY (id);


--
-- Name: configuracion_cuotas configuracion_cuotas_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.configuracion_cuotas
    ADD CONSTRAINT configuracion_cuotas_pkey PRIMARY KEY (id);


--
-- Name: configuracion_cuotas configuracion_cuotas_rol_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.configuracion_cuotas
    ADD CONSTRAINT configuracion_cuotas_rol_key UNIQUE (rol);


--
-- Name: empleados_comercios empleados_comercios_perfil_id_comercio_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.empleados_comercios
    ADD CONSTRAINT empleados_comercios_perfil_id_comercio_id_key UNIQUE (perfil_id, comercio_id);


--
-- Name: empleados_comercios empleados_comercios_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.empleados_comercios
    ADD CONSTRAINT empleados_comercios_pkey PRIMARY KEY (id);


--
-- Name: eventos_sociales eventos_sociales_external_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.eventos_sociales
    ADD CONSTRAINT eventos_sociales_external_id_key UNIQUE (external_id);


--
-- Name: eventos_sociales eventos_sociales_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.eventos_sociales
    ADD CONSTRAINT eventos_sociales_pkey PRIMARY KEY (id);


--
-- Name: eventos_sociales eventos_sociales_slug_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.eventos_sociales
    ADD CONSTRAINT eventos_sociales_slug_key UNIQUE (slug);


--
-- Name: familiares familiares_dni_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.familiares
    ADD CONSTRAINT familiares_dni_key UNIQUE (dni);


--
-- Name: familiares familiares_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.familiares
    ADD CONSTRAINT familiares_pkey PRIMARY KEY (id);


--
-- Name: localidades localidades_nombre_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.localidades
    ADD CONSTRAINT localidades_nombre_key UNIQUE (nombre);


--
-- Name: localidades localidades_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.localidades
    ADD CONSTRAINT localidades_pkey PRIMARY KEY (id);


--
-- Name: municipios municipios_nombre_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.municipios
    ADD CONSTRAINT municipios_nombre_key UNIQUE (nombre);


--
-- Name: municipios municipios_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.municipios
    ADD CONSTRAINT municipios_pkey PRIMARY KEY (id);


--
-- Name: notificaciones notificaciones_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notificaciones
    ADD CONSTRAINT notificaciones_pkey PRIMARY KEY (id);


--
-- Name: pagos_cuotas pagos_cuotas_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pagos_cuotas
    ADD CONSTRAINT pagos_cuotas_pkey PRIMARY KEY (id);


--
-- Name: profesionales profesionales_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.profesionales
    ADD CONSTRAINT profesionales_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_cuit_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_cuit_key UNIQUE (cuit);


--
-- Name: profiles profiles_dni_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_dni_key UNIQUE (dni);


--
-- Name: profiles profiles_email_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_email_key UNIQUE (email);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_username_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_username_key UNIQUE (username);


--
-- Name: promociones promociones_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.promociones
    ADD CONSTRAINT promociones_pkey PRIMARY KEY (id);


--
-- Name: push_tokens push_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.push_tokens
    ADD CONSTRAINT push_tokens_pkey PRIMARY KEY (id);


--
-- Name: push_tokens push_tokens_token_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.push_tokens
    ADD CONSTRAINT push_tokens_token_key UNIQUE (token);


--
-- Name: qr_tokens qr_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.qr_tokens
    ADD CONSTRAINT qr_tokens_pkey PRIMARY KEY (id);


--
-- Name: qr_tokens qr_tokens_token_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.qr_tokens
    ADD CONSTRAINT qr_tokens_token_key UNIQUE (token);


--
-- Name: roles roles_nombre_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_nombre_key UNIQUE (nombre);


--
-- Name: roles roles_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_pkey PRIMARY KEY (id);


--
-- Name: suscripciones suscripciones_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.suscripciones
    ADD CONSTRAINT suscripciones_pkey PRIMARY KEY (id);


--
-- Name: pagos_cuotas unique_socio_vencimiento; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pagos_cuotas
    ADD CONSTRAINT unique_socio_vencimiento UNIQUE (socio_id, fecha_vencimiento);


--
-- Name: user_roles user_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_pkey PRIMARY KEY (user_id, role_id);


--
-- Name: idx_auditoria_logs_accion; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_auditoria_logs_accion ON ONLY public.auditoria_logs USING btree (accion);


--
-- Name: auditoria_logs_2024_accion_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX auditoria_logs_2024_accion_idx ON public.auditoria_logs_2024 USING btree (accion);


--
-- Name: idx_auditoria_logs_fecha; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_auditoria_logs_fecha ON ONLY public.auditoria_logs USING btree (fecha DESC);


--
-- Name: auditoria_logs_2024_fecha_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX auditoria_logs_2024_fecha_idx ON public.auditoria_logs_2024 USING btree (fecha DESC);


--
-- Name: idx_auditoria_logs_modulo; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_auditoria_logs_modulo ON ONLY public.auditoria_logs USING btree (modulo);


--
-- Name: auditoria_logs_2024_modulo_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX auditoria_logs_2024_modulo_idx ON public.auditoria_logs_2024 USING btree (modulo);


--
-- Name: idx_auditoria_logs_tabla; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_auditoria_logs_tabla ON ONLY public.auditoria_logs USING btree (tabla_afectada);


--
-- Name: auditoria_logs_2024_tabla_afectada_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX auditoria_logs_2024_tabla_afectada_idx ON public.auditoria_logs_2024 USING btree (tabla_afectada);


--
-- Name: idx_auditoria_logs_usuario; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_auditoria_logs_usuario ON ONLY public.auditoria_logs USING btree (usuario_id);


--
-- Name: auditoria_logs_2024_usuario_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX auditoria_logs_2024_usuario_id_idx ON public.auditoria_logs_2024 USING btree (usuario_id);


--
-- Name: idx_auditoria_usuario; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_auditoria_usuario ON ONLY public.auditoria_logs USING btree (usuario_id, modulo);


--
-- Name: auditoria_logs_2024_usuario_id_modulo_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX auditoria_logs_2024_usuario_id_modulo_idx ON public.auditoria_logs_2024 USING btree (usuario_id, modulo);


--
-- Name: auditoria_logs_2025_accion_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX auditoria_logs_2025_accion_idx ON public.auditoria_logs_2025 USING btree (accion);


--
-- Name: auditoria_logs_2025_fecha_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX auditoria_logs_2025_fecha_idx ON public.auditoria_logs_2025 USING btree (fecha DESC);


--
-- Name: auditoria_logs_2025_modulo_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX auditoria_logs_2025_modulo_idx ON public.auditoria_logs_2025 USING btree (modulo);


--
-- Name: auditoria_logs_2025_tabla_afectada_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX auditoria_logs_2025_tabla_afectada_idx ON public.auditoria_logs_2025 USING btree (tabla_afectada);


--
-- Name: auditoria_logs_2025_usuario_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX auditoria_logs_2025_usuario_id_idx ON public.auditoria_logs_2025 USING btree (usuario_id);


--
-- Name: auditoria_logs_2025_usuario_id_modulo_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX auditoria_logs_2025_usuario_id_modulo_idx ON public.auditoria_logs_2025 USING btree (usuario_id, modulo);


--
-- Name: auditoria_logs_2026_accion_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX auditoria_logs_2026_accion_idx ON public.auditoria_logs_2026 USING btree (accion);


--
-- Name: auditoria_logs_2026_fecha_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX auditoria_logs_2026_fecha_idx ON public.auditoria_logs_2026 USING btree (fecha DESC);


--
-- Name: auditoria_logs_2026_modulo_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX auditoria_logs_2026_modulo_idx ON public.auditoria_logs_2026 USING btree (modulo);


--
-- Name: auditoria_logs_2026_tabla_afectada_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX auditoria_logs_2026_tabla_afectada_idx ON public.auditoria_logs_2026 USING btree (tabla_afectada);


--
-- Name: auditoria_logs_2026_usuario_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX auditoria_logs_2026_usuario_id_idx ON public.auditoria_logs_2026 USING btree (usuario_id);


--
-- Name: auditoria_logs_2026_usuario_id_modulo_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX auditoria_logs_2026_usuario_id_modulo_idx ON public.auditoria_logs_2026 USING btree (usuario_id, modulo);


--
-- Name: auditoria_logs_2027_accion_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX auditoria_logs_2027_accion_idx ON public.auditoria_logs_2027 USING btree (accion);


--
-- Name: auditoria_logs_2027_fecha_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX auditoria_logs_2027_fecha_idx ON public.auditoria_logs_2027 USING btree (fecha DESC);


--
-- Name: auditoria_logs_2027_modulo_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX auditoria_logs_2027_modulo_idx ON public.auditoria_logs_2027 USING btree (modulo);


--
-- Name: auditoria_logs_2027_tabla_afectada_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX auditoria_logs_2027_tabla_afectada_idx ON public.auditoria_logs_2027 USING btree (tabla_afectada);


--
-- Name: auditoria_logs_2027_usuario_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX auditoria_logs_2027_usuario_id_idx ON public.auditoria_logs_2027 USING btree (usuario_id);


--
-- Name: auditoria_logs_2027_usuario_id_modulo_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX auditoria_logs_2027_usuario_id_modulo_idx ON public.auditoria_logs_2027 USING btree (usuario_id, modulo);


--
-- Name: auditoria_logs_2028_accion_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX auditoria_logs_2028_accion_idx ON public.auditoria_logs_2028 USING btree (accion);


--
-- Name: auditoria_logs_2028_fecha_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX auditoria_logs_2028_fecha_idx ON public.auditoria_logs_2028 USING btree (fecha DESC);


--
-- Name: auditoria_logs_2028_modulo_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX auditoria_logs_2028_modulo_idx ON public.auditoria_logs_2028 USING btree (modulo);


--
-- Name: auditoria_logs_2028_tabla_afectada_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX auditoria_logs_2028_tabla_afectada_idx ON public.auditoria_logs_2028 USING btree (tabla_afectada);


--
-- Name: auditoria_logs_2028_usuario_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX auditoria_logs_2028_usuario_id_idx ON public.auditoria_logs_2028 USING btree (usuario_id);


--
-- Name: auditoria_logs_2028_usuario_id_modulo_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX auditoria_logs_2028_usuario_id_modulo_idx ON public.auditoria_logs_2028 USING btree (usuario_id, modulo);


--
-- Name: idx_activity_log_socio_fecha; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_activity_log_socio_fecha ON public.activity_log USING btree (socio_id, fecha DESC);


--
-- Name: idx_activity_log_socio_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_activity_log_socio_id ON public.activity_log USING btree (socio_id);


--
-- Name: idx_chat_history_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_chat_history_created_at ON public.chat_history USING btree (created_at);


--
-- Name: idx_chat_history_user_created; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_chat_history_user_created ON public.chat_history USING btree (user_id, created_at DESC);


--
-- Name: idx_chat_history_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_chat_history_user_id ON public.chat_history USING btree (user_id);


--
-- Name: idx_municipios_activo; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_municipios_activo ON public.municipios USING btree (activo);


--
-- Name: idx_municipios_provincia; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_municipios_provincia ON public.municipios USING btree (provincia);


--
-- Name: idx_notificaciones_socio_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_notificaciones_socio_id ON public.notificaciones USING btree (usuario_id);


--
-- Name: idx_notificaciones_usuario; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_notificaciones_usuario ON public.notificaciones USING btree (usuario_id, leido);


--
-- Name: idx_notificaciones_usuario_leido; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_notificaciones_usuario_leido ON public.notificaciones USING btree (usuario_id, leido);


--
-- Name: idx_pagos_cuotas_estado_pago; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_pagos_cuotas_estado_pago ON public.pagos_cuotas USING btree (estado_pago);


--
-- Name: idx_pagos_cuotas_fecha_vencimiento; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_pagos_cuotas_fecha_vencimiento ON public.pagos_cuotas USING btree (fecha_vencimiento);


--
-- Name: idx_pagos_cuotas_socio_estado; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_pagos_cuotas_socio_estado ON public.pagos_cuotas USING btree (socio_id, estado_pago);


--
-- Name: idx_pagos_socio_estado; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_pagos_socio_estado ON public.pagos_cuotas USING btree (socio_id, estado_pago);


--
-- Name: idx_profiles_dni; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_profiles_dni ON public.profiles USING btree (dni);


--
-- Name: idx_profiles_email_token; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_profiles_email_token ON public.profiles USING btree (email_verificacion_token) WHERE (email_verificacion_token IS NOT NULL);


--
-- Name: idx_profiles_estado; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_profiles_estado ON public.profiles USING btree (estado);


--
-- Name: idx_profiles_numero_socio_unique; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX idx_profiles_numero_socio_unique ON public.profiles USING btree (numero_socio) WHERE (numero_socio IS NOT NULL);


--
-- Name: idx_profiles_rol; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_profiles_rol ON public.profiles USING btree (rol);


--
-- Name: idx_profiles_rol_estado; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_profiles_rol_estado ON public.profiles USING btree (rol, estado);


--
-- Name: idx_profiles_titular; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_profiles_titular ON public.profiles USING btree (titular_id);


--
-- Name: idx_profiles_titular_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_profiles_titular_id ON public.profiles USING btree (titular_id);


--
-- Name: idx_qr_tokens_user_used; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_qr_tokens_user_used ON public.qr_tokens USING btree (user_id, used, expires_at);


--
-- Name: idx_unique_notif_evento; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX idx_unique_notif_evento ON public.notificaciones USING btree (usuario_id, evento_id) WHERE (evento_id IS NOT NULL);


--
-- Name: auditoria_logs_2024_accion_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--

ALTER INDEX public.idx_auditoria_logs_accion ATTACH PARTITION public.auditoria_logs_2024_accion_idx;


--
-- Name: auditoria_logs_2024_fecha_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--

ALTER INDEX public.idx_auditoria_logs_fecha ATTACH PARTITION public.auditoria_logs_2024_fecha_idx;


--
-- Name: auditoria_logs_2024_modulo_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--

ALTER INDEX public.idx_auditoria_logs_modulo ATTACH PARTITION public.auditoria_logs_2024_modulo_idx;


--
-- Name: auditoria_logs_2024_pkey; Type: INDEX ATTACH; Schema: public; Owner: postgres
--

ALTER INDEX public.auditoria_logs_pkey1 ATTACH PARTITION public.auditoria_logs_2024_pkey;


--
-- Name: auditoria_logs_2024_tabla_afectada_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--

ALTER INDEX public.idx_auditoria_logs_tabla ATTACH PARTITION public.auditoria_logs_2024_tabla_afectada_idx;


--
-- Name: auditoria_logs_2024_usuario_id_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--

ALTER INDEX public.idx_auditoria_logs_usuario ATTACH PARTITION public.auditoria_logs_2024_usuario_id_idx;


--
-- Name: auditoria_logs_2024_usuario_id_modulo_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--

ALTER INDEX public.idx_auditoria_usuario ATTACH PARTITION public.auditoria_logs_2024_usuario_id_modulo_idx;


--
-- Name: auditoria_logs_2025_accion_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--

ALTER INDEX public.idx_auditoria_logs_accion ATTACH PARTITION public.auditoria_logs_2025_accion_idx;


--
-- Name: auditoria_logs_2025_fecha_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--

ALTER INDEX public.idx_auditoria_logs_fecha ATTACH PARTITION public.auditoria_logs_2025_fecha_idx;


--
-- Name: auditoria_logs_2025_modulo_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--

ALTER INDEX public.idx_auditoria_logs_modulo ATTACH PARTITION public.auditoria_logs_2025_modulo_idx;


--
-- Name: auditoria_logs_2025_pkey; Type: INDEX ATTACH; Schema: public; Owner: postgres
--

ALTER INDEX public.auditoria_logs_pkey1 ATTACH PARTITION public.auditoria_logs_2025_pkey;


--
-- Name: auditoria_logs_2025_tabla_afectada_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--

ALTER INDEX public.idx_auditoria_logs_tabla ATTACH PARTITION public.auditoria_logs_2025_tabla_afectada_idx;


--
-- Name: auditoria_logs_2025_usuario_id_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--

ALTER INDEX public.idx_auditoria_logs_usuario ATTACH PARTITION public.auditoria_logs_2025_usuario_id_idx;


--
-- Name: auditoria_logs_2025_usuario_id_modulo_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--

ALTER INDEX public.idx_auditoria_usuario ATTACH PARTITION public.auditoria_logs_2025_usuario_id_modulo_idx;


--
-- Name: auditoria_logs_2026_accion_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--

ALTER INDEX public.idx_auditoria_logs_accion ATTACH PARTITION public.auditoria_logs_2026_accion_idx;


--
-- Name: auditoria_logs_2026_fecha_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--

ALTER INDEX public.idx_auditoria_logs_fecha ATTACH PARTITION public.auditoria_logs_2026_fecha_idx;


--
-- Name: auditoria_logs_2026_modulo_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--

ALTER INDEX public.idx_auditoria_logs_modulo ATTACH PARTITION public.auditoria_logs_2026_modulo_idx;


--
-- Name: auditoria_logs_2026_pkey; Type: INDEX ATTACH; Schema: public; Owner: postgres
--

ALTER INDEX public.auditoria_logs_pkey1 ATTACH PARTITION public.auditoria_logs_2026_pkey;


--
-- Name: auditoria_logs_2026_tabla_afectada_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--

ALTER INDEX public.idx_auditoria_logs_tabla ATTACH PARTITION public.auditoria_logs_2026_tabla_afectada_idx;


--
-- Name: auditoria_logs_2026_usuario_id_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--

ALTER INDEX public.idx_auditoria_logs_usuario ATTACH PARTITION public.auditoria_logs_2026_usuario_id_idx;


--
-- Name: auditoria_logs_2026_usuario_id_modulo_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--

ALTER INDEX public.idx_auditoria_usuario ATTACH PARTITION public.auditoria_logs_2026_usuario_id_modulo_idx;


--
-- Name: auditoria_logs_2027_accion_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--

ALTER INDEX public.idx_auditoria_logs_accion ATTACH PARTITION public.auditoria_logs_2027_accion_idx;


--
-- Name: auditoria_logs_2027_fecha_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--

ALTER INDEX public.idx_auditoria_logs_fecha ATTACH PARTITION public.auditoria_logs_2027_fecha_idx;


--
-- Name: auditoria_logs_2027_modulo_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--

ALTER INDEX public.idx_auditoria_logs_modulo ATTACH PARTITION public.auditoria_logs_2027_modulo_idx;


--
-- Name: auditoria_logs_2027_pkey; Type: INDEX ATTACH; Schema: public; Owner: postgres
--

ALTER INDEX public.auditoria_logs_pkey1 ATTACH PARTITION public.auditoria_logs_2027_pkey;


--
-- Name: auditoria_logs_2027_tabla_afectada_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--

ALTER INDEX public.idx_auditoria_logs_tabla ATTACH PARTITION public.auditoria_logs_2027_tabla_afectada_idx;


--
-- Name: auditoria_logs_2027_usuario_id_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--

ALTER INDEX public.idx_auditoria_logs_usuario ATTACH PARTITION public.auditoria_logs_2027_usuario_id_idx;


--
-- Name: auditoria_logs_2027_usuario_id_modulo_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--

ALTER INDEX public.idx_auditoria_usuario ATTACH PARTITION public.auditoria_logs_2027_usuario_id_modulo_idx;


--
-- Name: auditoria_logs_2028_accion_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--

ALTER INDEX public.idx_auditoria_logs_accion ATTACH PARTITION public.auditoria_logs_2028_accion_idx;


--
-- Name: auditoria_logs_2028_fecha_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--

ALTER INDEX public.idx_auditoria_logs_fecha ATTACH PARTITION public.auditoria_logs_2028_fecha_idx;


--
-- Name: auditoria_logs_2028_modulo_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--

ALTER INDEX public.idx_auditoria_logs_modulo ATTACH PARTITION public.auditoria_logs_2028_modulo_idx;


--
-- Name: auditoria_logs_2028_pkey; Type: INDEX ATTACH; Schema: public; Owner: postgres
--

ALTER INDEX public.auditoria_logs_pkey1 ATTACH PARTITION public.auditoria_logs_2028_pkey;


--
-- Name: auditoria_logs_2028_tabla_afectada_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--

ALTER INDEX public.idx_auditoria_logs_tabla ATTACH PARTITION public.auditoria_logs_2028_tabla_afectada_idx;


--
-- Name: auditoria_logs_2028_usuario_id_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--

ALTER INDEX public.idx_auditoria_logs_usuario ATTACH PARTITION public.auditoria_logs_2028_usuario_id_idx;


--
-- Name: auditoria_logs_2028_usuario_id_modulo_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--

ALTER INDEX public.idx_auditoria_usuario ATTACH PARTITION public.auditoria_logs_2028_usuario_id_modulo_idx;


--
-- Name: eventos_sociales tr_eventos_sociales_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER tr_eventos_sociales_updated_at BEFORE UPDATE ON public.eventos_sociales FOR EACH ROW EXECUTE FUNCTION public.update_modified_column();


--
-- Name: familiares tr_familiares_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER tr_familiares_updated_at BEFORE UPDATE ON public.familiares FOR EACH ROW EXECUTE FUNCTION public.update_modified_column();


--
-- Name: profiles tr_profiles_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER tr_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_modified_column();


--
-- Name: profiles trg_asignar_numero_socio; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_asignar_numero_socio BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.fn_asignar_numero_socio();


--
-- Name: municipios trg_municipios_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_municipios_updated_at BEFORE UPDATE ON public.municipios FOR EACH ROW EXECUTE FUNCTION public.fn_update_municipios_timestamp();


--
-- Name: auditoria_logs trg_prevent_auditoria_delete; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_prevent_auditoria_delete BEFORE DELETE ON public.auditoria_logs FOR EACH ROW EXECUTE FUNCTION public.prevent_auditoria_modify();


--
-- Name: auditoria_logs trg_prevent_auditoria_update; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_prevent_auditoria_update BEFORE UPDATE ON public.auditoria_logs FOR EACH ROW EXECUTE FUNCTION public.prevent_auditoria_modify();


--
-- Name: familiares update_membership_trigger; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_membership_trigger AFTER INSERT OR DELETE OR UPDATE ON public.familiares FOR EACH ROW EXECUTE FUNCTION public.update_membership_info();


--
-- Name: profiles update_profiles_modtime; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_profiles_modtime BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: activity_log activity_log_socio_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.activity_log
    ADD CONSTRAINT activity_log_socio_id_fkey FOREIGN KEY (socio_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: activity_log activity_log_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.activity_log
    ADD CONSTRAINT activity_log_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.profiles(id);


--
-- Name: chat_history chat_history_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.chat_history
    ADD CONSTRAINT chat_history_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: comercio_solicitudes comercio_solicitudes_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.comercio_solicitudes
    ADD CONSTRAINT comercio_solicitudes_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: comercios comercios_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.comercios
    ADD CONSTRAINT comercios_id_fkey FOREIGN KEY (id) REFERENCES public.profiles(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: comercios comercios_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.comercios
    ADD CONSTRAINT comercios_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);


--
-- Name: empleados_comercios empleados_comercios_comercio_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.empleados_comercios
    ADD CONSTRAINT empleados_comercios_comercio_id_fkey FOREIGN KEY (comercio_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: empleados_comercios empleados_comercios_perfil_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.empleados_comercios
    ADD CONSTRAINT empleados_comercios_perfil_id_fkey FOREIGN KEY (perfil_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: eventos_sociales eventos_sociales_municipio_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.eventos_sociales
    ADD CONSTRAINT eventos_sociales_municipio_id_fkey FOREIGN KEY (municipio_id) REFERENCES public.municipios(id) ON DELETE SET NULL;


--
-- Name: familiares familiares_titular_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.familiares
    ADD CONSTRAINT familiares_titular_id_fkey FOREIGN KEY (titular_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: notificaciones notificaciones_socio_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notificaciones
    ADD CONSTRAINT notificaciones_socio_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: pagos_cuotas pagos_cuotas_admin_validador_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pagos_cuotas
    ADD CONSTRAINT pagos_cuotas_admin_validador_id_fkey FOREIGN KEY (admin_validador_id) REFERENCES public.profiles(id);


--
-- Name: pagos_cuotas pagos_cuotas_socio_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pagos_cuotas
    ADD CONSTRAINT pagos_cuotas_socio_id_fkey FOREIGN KEY (socio_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: profesionales profesionales_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.profesionales
    ADD CONSTRAINT profesionales_id_fkey FOREIGN KEY (id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: profiles profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: profiles profiles_titular_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_titular_id_fkey FOREIGN KEY (titular_id) REFERENCES public.profiles(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: promociones promociones_comercio_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.promociones
    ADD CONSTRAINT promociones_comercio_id_fkey FOREIGN KEY (comercio_id) REFERENCES public.comercios(id) ON DELETE CASCADE;


--
-- Name: push_tokens push_tokens_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.push_tokens
    ADD CONSTRAINT push_tokens_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: qr_tokens qr_tokens_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.qr_tokens
    ADD CONSTRAINT qr_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: suscripciones suscripciones_socio_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.suscripciones
    ADD CONSTRAINT suscripciones_socio_id_fkey FOREIGN KEY (socio_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: user_roles user_roles_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.roles(id) ON DELETE CASCADE;


--
-- Name: user_roles user_roles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: configuracion_cuotas Admin update configuracion_cuotas; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admin update configuracion_cuotas" ON public.configuracion_cuotas USING (true) WITH CHECK (true);


--
-- Name: pagos_cuotas Admins can manage all payments; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can manage all payments" ON public.pagos_cuotas USING (public.is_admin());


--
-- Name: roles Admins can manage roles; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can manage roles" ON public.roles USING (public.is_admin());


--
-- Name: user_roles Admins can manage user_roles; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can manage user_roles" ON public.user_roles USING (public.is_admin());


--
-- Name: profiles Admins can view all profiles; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can view all profiles" ON public.profiles USING (public.is_admin());


--
-- Name: eventos_sociales Admins manage eventos_sociales; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins manage eventos_sociales" ON public.eventos_sociales USING (public.is_admin());


--
-- Name: localidades Admins manage localidades; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins manage localidades" ON public.localidades USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.rol = 'ADMIN'::public.user_role)))));


--
-- Name: activity_log Admins view activity_log; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins view activity_log" ON public.activity_log USING (public.is_admin());


--
-- Name: auditoria_logs Admins view auditoria_logs; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins view auditoria_logs" ON public.auditoria_logs USING (public.is_admin());


--
-- Name: comercios Aislamiento de Camaras; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Aislamiento de Camaras" ON public.comercios FOR SELECT USING (((auth.uid() = id) OR (auth.uid() IN ( SELECT profiles.id
   FROM public.profiles
  WHERE (profiles.rol = 'ADMIN'::public.user_role))) OR (auth.uid() = ( SELECT profiles.titular_id
   FROM public.profiles
  WHERE (profiles.id = comercios.id)))));


--
-- Name: roles Anyone can read roles; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Anyone can read roles" ON public.roles FOR SELECT TO authenticated USING (true);


--
-- Name: user_roles Anyone can read user roles; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Anyone can read user roles" ON public.user_roles FOR SELECT TO authenticated USING (true);


--
-- Name: auditoria_logs Auditoria inalterable; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Auditoria inalterable" ON public.auditoria_logs FOR INSERT WITH CHECK (true);


--
-- Name: roles Auth users can view roles; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Auth users can view roles" ON public.roles FOR SELECT TO authenticated USING (true);


--
-- Name: user_roles Auth users can view user_roles; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Auth users can view user_roles" ON public.user_roles FOR SELECT TO authenticated USING (true);


--
-- Name: auditoria_logs Bloquear insercion anonima o autenticada normal; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Bloquear insercion anonima o autenticada normal" ON public.auditoria_logs FOR INSERT WITH CHECK (false);


--
-- Name: comercios Camaras ven comercios de su municipio; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Camaras ven comercios de su municipio" ON public.comercios FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.profiles p1
  WHERE ((p1.id = auth.uid()) AND (p1.rol = 'CAMARA'::public.user_role) AND (p1.municipio = comercios.municipio)))));


--
-- Name: promociones Comercios aprobados gestionan sus propias promos; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Comercios aprobados gestionan sus propias promos" ON public.promociones USING (((auth.uid() = comercio_id) AND (EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.rol = 'COMERCIO'::public.user_role) AND (profiles.estado = 'APROBADO'::public.user_status))))));


--
-- Name: promociones Comercios gestionan sus promociones; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Comercios gestionan sus promociones" ON public.promociones USING ((auth.uid() = comercio_id));


--
-- Name: auditoria_logs_2024 Deny all for public on audit 2024; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Deny all for public on audit 2024" ON public.auditoria_logs_2024 USING (public.is_admin_or_superadmin());


--
-- Name: auditoria_logs_2025 Deny all for public on audit 2025; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Deny all for public on audit 2025" ON public.auditoria_logs_2025 USING (public.is_admin_or_superadmin());


--
-- Name: auditoria_logs_2026 Deny all for public on audit 2026; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Deny all for public on audit 2026" ON public.auditoria_logs_2026 USING (public.is_admin_or_superadmin());


--
-- Name: auditoria_logs_2027 Deny all for public on audit 2027; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Deny all for public on audit 2027" ON public.auditoria_logs_2027 USING (public.is_admin_or_superadmin());


--
-- Name: auditoria_logs_2028 Deny all for public on audit 2028; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Deny all for public on audit 2028" ON public.auditoria_logs_2028 USING (public.is_admin_or_superadmin());


--
-- Name: auditoria_logs La auditoria es inalterable; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "La auditoria es inalterable" ON public.auditoria_logs FOR UPDATE USING (false);


--
-- Name: auditoria_logs La auditoria es indeleble; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "La auditoria es indeleble" ON public.auditoria_logs FOR DELETE USING (false);


--
-- Name: auditoria_logs Los Administradores pueden ver toda la auditoria; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Los Administradores pueden ver toda la auditoria" ON public.auditoria_logs FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.rol = 'ADMIN'::public.user_role)))));


--
-- Name: eventos_sociales Permitir lectura de todos los eventos para admins; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Permitir lectura de todos los eventos para admins" ON public.eventos_sociales FOR SELECT TO authenticated USING (true);


--
-- Name: eventos_sociales Permitir lectura publica de eventos aprobados; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Permitir lectura publica de eventos aprobados" ON public.eventos_sociales FOR SELECT USING ((status = 'aprobado'::text));


--
-- Name: promociones Promociones publicas para todos; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Promociones publicas para todos" ON public.promociones FOR SELECT USING ((activo = true));


--
-- Name: promociones Promociones son publicas; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Promociones son publicas" ON public.promociones FOR SELECT USING ((activo = true));


--
-- Name: configuracion_cuotas Public read configuracion_cuotas; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Public read configuracion_cuotas" ON public.configuracion_cuotas FOR SELECT USING (true);


--
-- Name: eventos_sociales Public read eventos_sociales; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Public read eventos_sociales" ON public.eventos_sociales FOR SELECT USING (true);


--
-- Name: localidades Public read localidades; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Public read localidades" ON public.localidades FOR SELECT USING (true);


--
-- Name: auditoria_logs Solo lectura auditoria; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Solo lectura auditoria" ON public.auditoria_logs FOR SELECT USING (true);


--
-- Name: user_roles Superadmins can manage user roles; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Superadmins can manage user roles" ON public.user_roles TO authenticated USING ((EXISTS ( SELECT 1
   FROM (public.user_roles ur
     JOIN public.roles r ON ((ur.role_id = r.id)))
  WHERE ((ur.user_id = auth.uid()) AND ((r.nombre)::text = 'SUPERADMIN'::text))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM (public.user_roles ur
     JOIN public.roles r ON ((ur.role_id = r.id)))
  WHERE ((ur.user_id = auth.uid()) AND ((r.nombre)::text = 'SUPERADMIN'::text)))));


--
-- Name: pagos_cuotas Users can view own payments; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view own payments" ON public.pagos_cuotas FOR SELECT USING ((auth.uid() = socio_id));


--
-- Name: profiles Users can view own profile; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING ((auth.uid() = id));


--
-- Name: notificaciones Users can view their notifications; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view their notifications" ON public.notificaciones FOR SELECT USING (((auth.uid() = usuario_id) OR ((is_admin_destined = true) AND (EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.rol = 'ADMIN'::public.user_role)))))));


--
-- Name: familiares Users manage own familiares; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users manage own familiares" ON public.familiares USING (((auth.uid() = titular_id) OR public.is_admin()));


--
-- Name: push_tokens Users manage own push_tokens; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users manage own push_tokens" ON public.push_tokens USING (((auth.uid() = usuario_id) OR public.is_admin()));


--
-- Name: profiles Usuarios gestionan su propio perfil; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Usuarios gestionan su propio perfil" ON public.profiles FOR UPDATE USING ((auth.uid() = id));


--
-- Name: chat_history Usuarios pueden insertar su propio historial de chat; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Usuarios pueden insertar su propio historial de chat" ON public.chat_history FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: chat_history Usuarios pueden ver su propio historial de chat; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Usuarios pueden ver su propio historial de chat" ON public.chat_history FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: activity_log; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;

--
-- Name: auditoria_logs; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.auditoria_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: auditoria_logs_2024; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.auditoria_logs_2024 ENABLE ROW LEVEL SECURITY;

--
-- Name: auditoria_logs_2025; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.auditoria_logs_2025 ENABLE ROW LEVEL SECURITY;

--
-- Name: auditoria_logs_2026; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.auditoria_logs_2026 ENABLE ROW LEVEL SECURITY;

--
-- Name: auditoria_logs_2027; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.auditoria_logs_2027 ENABLE ROW LEVEL SECURITY;

--
-- Name: auditoria_logs_2028; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.auditoria_logs_2028 ENABLE ROW LEVEL SECURITY;

--
-- Name: chat_history; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.chat_history ENABLE ROW LEVEL SECURITY;

--
-- Name: comercio_solicitudes; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.comercio_solicitudes ENABLE ROW LEVEL SECURITY;

--
-- Name: comercios; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.comercios ENABLE ROW LEVEL SECURITY;

--
-- Name: configuracion_cuotas; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.configuracion_cuotas ENABLE ROW LEVEL SECURITY;

--
-- Name: empleados_comercios; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.empleados_comercios ENABLE ROW LEVEL SECURITY;

--
-- Name: eventos_sociales; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.eventos_sociales ENABLE ROW LEVEL SECURITY;

--
-- Name: familiares; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.familiares ENABLE ROW LEVEL SECURITY;

--
-- Name: localidades; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.localidades ENABLE ROW LEVEL SECURITY;

--
-- Name: municipios; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.municipios ENABLE ROW LEVEL SECURITY;

--
-- Name: municipios municipios_public_read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY municipios_public_read ON public.municipios FOR SELECT USING ((activo = true));


--
-- Name: notificaciones; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.notificaciones ENABLE ROW LEVEL SECURITY;

--
-- Name: pagos_cuotas; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.pagos_cuotas ENABLE ROW LEVEL SECURITY;

--
-- Name: profesionales; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.profesionales ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: promociones; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.promociones ENABLE ROW LEVEL SECURITY;

--
-- Name: push_tokens; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.push_tokens ENABLE ROW LEVEL SECURITY;

--
-- Name: push_tokens push_tokens_owner_insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY push_tokens_owner_insert ON public.push_tokens FOR INSERT WITH CHECK ((auth.uid() = usuario_id));


--
-- Name: push_tokens push_tokens_owner_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY push_tokens_owner_select ON public.push_tokens FOR SELECT USING ((auth.uid() = usuario_id));


--
-- Name: push_tokens push_tokens_owner_update; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY push_tokens_owner_update ON public.push_tokens FOR UPDATE USING ((auth.uid() = usuario_id));


--
-- Name: qr_tokens; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.qr_tokens ENABLE ROW LEVEL SECURITY;

--
-- Name: roles; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;

--
-- Name: auditoria_logs superadmin_full_access_auditoria; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY superadmin_full_access_auditoria ON public.auditoria_logs USING ((public.get_auth_rol() = 'superadmin'::text));


--
-- Name: suscripciones; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.suscripciones ENABLE ROW LEVEL SECURITY;

--
-- Name: user_roles; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: pg_database_owner
--

GRANT USAGE ON SCHEMA public TO postgres;
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO service_role;


--
-- Name: FUNCTION fn_asignar_numero_socio(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.fn_asignar_numero_socio() TO anon;
GRANT ALL ON FUNCTION public.fn_asignar_numero_socio() TO authenticated;
GRANT ALL ON FUNCTION public.fn_asignar_numero_socio() TO service_role;


--
-- Name: FUNCTION fn_update_eventos_timestamp(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.fn_update_eventos_timestamp() TO anon;
GRANT ALL ON FUNCTION public.fn_update_eventos_timestamp() TO authenticated;
GRANT ALL ON FUNCTION public.fn_update_eventos_timestamp() TO service_role;


--
-- Name: FUNCTION fn_update_municipios_timestamp(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.fn_update_municipios_timestamp() TO anon;
GRANT ALL ON FUNCTION public.fn_update_municipios_timestamp() TO authenticated;
GRANT ALL ON FUNCTION public.fn_update_municipios_timestamp() TO service_role;


--
-- Name: FUNCTION get_auth_orga_id(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.get_auth_orga_id() TO anon;
GRANT ALL ON FUNCTION public.get_auth_orga_id() TO authenticated;
GRANT ALL ON FUNCTION public.get_auth_orga_id() TO service_role;


--
-- Name: FUNCTION get_auth_rol(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.get_auth_rol() TO anon;
GRANT ALL ON FUNCTION public.get_auth_rol() TO authenticated;
GRANT ALL ON FUNCTION public.get_auth_rol() TO service_role;


--
-- Name: FUNCTION is_admin(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.is_admin() TO anon;
GRANT ALL ON FUNCTION public.is_admin() TO authenticated;
GRANT ALL ON FUNCTION public.is_admin() TO service_role;


--
-- Name: FUNCTION is_admin_or_superadmin(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.is_admin_or_superadmin() TO anon;
GRANT ALL ON FUNCTION public.is_admin_or_superadmin() TO authenticated;
GRANT ALL ON FUNCTION public.is_admin_or_superadmin() TO service_role;


--
-- Name: FUNCTION prevent_auditoria_modify(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.prevent_auditoria_modify() TO anon;
GRANT ALL ON FUNCTION public.prevent_auditoria_modify() TO authenticated;
GRANT ALL ON FUNCTION public.prevent_auditoria_modify() TO service_role;


--
-- Name: FUNCTION update_membership_info(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.update_membership_info() TO anon;
GRANT ALL ON FUNCTION public.update_membership_info() TO authenticated;
GRANT ALL ON FUNCTION public.update_membership_info() TO service_role;


--
-- Name: FUNCTION update_modified_column(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.update_modified_column() TO anon;
GRANT ALL ON FUNCTION public.update_modified_column() TO authenticated;
GRANT ALL ON FUNCTION public.update_modified_column() TO service_role;


--
-- Name: FUNCTION update_updated_at_column(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.update_updated_at_column() TO anon;
GRANT ALL ON FUNCTION public.update_updated_at_column() TO authenticated;
GRANT ALL ON FUNCTION public.update_updated_at_column() TO service_role;


--
-- Name: TABLE activity_log; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.activity_log TO anon;
GRANT ALL ON TABLE public.activity_log TO authenticated;
GRANT ALL ON TABLE public.activity_log TO service_role;


--
-- Name: TABLE auditoria_logs; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.auditoria_logs TO anon;
GRANT ALL ON TABLE public.auditoria_logs TO authenticated;
GRANT ALL ON TABLE public.auditoria_logs TO service_role;


--
-- Name: TABLE auditoria_logs_2024; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.auditoria_logs_2024 TO anon;
GRANT ALL ON TABLE public.auditoria_logs_2024 TO authenticated;
GRANT ALL ON TABLE public.auditoria_logs_2024 TO service_role;


--
-- Name: TABLE auditoria_logs_2025; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.auditoria_logs_2025 TO anon;
GRANT ALL ON TABLE public.auditoria_logs_2025 TO authenticated;
GRANT ALL ON TABLE public.auditoria_logs_2025 TO service_role;


--
-- Name: TABLE auditoria_logs_2026; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.auditoria_logs_2026 TO anon;
GRANT ALL ON TABLE public.auditoria_logs_2026 TO authenticated;
GRANT ALL ON TABLE public.auditoria_logs_2026 TO service_role;


--
-- Name: TABLE auditoria_logs_2027; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.auditoria_logs_2027 TO anon;
GRANT ALL ON TABLE public.auditoria_logs_2027 TO authenticated;
GRANT ALL ON TABLE public.auditoria_logs_2027 TO service_role;


--
-- Name: TABLE auditoria_logs_2028; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.auditoria_logs_2028 TO anon;
GRANT ALL ON TABLE public.auditoria_logs_2028 TO authenticated;
GRANT ALL ON TABLE public.auditoria_logs_2028 TO service_role;


--
-- Name: TABLE chat_history; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.chat_history TO anon;
GRANT ALL ON TABLE public.chat_history TO authenticated;
GRANT ALL ON TABLE public.chat_history TO service_role;


--
-- Name: TABLE comercio_solicitudes; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.comercio_solicitudes TO anon;
GRANT ALL ON TABLE public.comercio_solicitudes TO authenticated;
GRANT ALL ON TABLE public.comercio_solicitudes TO service_role;


--
-- Name: TABLE comercios; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.comercios TO anon;
GRANT ALL ON TABLE public.comercios TO authenticated;
GRANT ALL ON TABLE public.comercios TO service_role;


--
-- Name: TABLE configuracion_cuotas; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.configuracion_cuotas TO anon;
GRANT ALL ON TABLE public.configuracion_cuotas TO authenticated;
GRANT ALL ON TABLE public.configuracion_cuotas TO service_role;


--
-- Name: TABLE empleados_comercios; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.empleados_comercios TO anon;
GRANT ALL ON TABLE public.empleados_comercios TO authenticated;
GRANT ALL ON TABLE public.empleados_comercios TO service_role;


--
-- Name: TABLE eventos_sociales; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.eventos_sociales TO anon;
GRANT ALL ON TABLE public.eventos_sociales TO authenticated;
GRANT ALL ON TABLE public.eventos_sociales TO service_role;


--
-- Name: TABLE familiares; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.familiares TO anon;
GRANT ALL ON TABLE public.familiares TO authenticated;
GRANT ALL ON TABLE public.familiares TO service_role;


--
-- Name: TABLE localidades; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.localidades TO anon;
GRANT ALL ON TABLE public.localidades TO authenticated;
GRANT ALL ON TABLE public.localidades TO service_role;


--
-- Name: TABLE municipios; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.municipios TO anon;
GRANT ALL ON TABLE public.municipios TO authenticated;
GRANT ALL ON TABLE public.municipios TO service_role;


--
-- Name: TABLE notificaciones; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.notificaciones TO anon;
GRANT ALL ON TABLE public.notificaciones TO authenticated;
GRANT ALL ON TABLE public.notificaciones TO service_role;


--
-- Name: TABLE pagos_cuotas; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.pagos_cuotas TO anon;
GRANT ALL ON TABLE public.pagos_cuotas TO authenticated;
GRANT ALL ON TABLE public.pagos_cuotas TO service_role;


--
-- Name: TABLE profesionales; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.profesionales TO anon;
GRANT ALL ON TABLE public.profesionales TO authenticated;
GRANT ALL ON TABLE public.profesionales TO service_role;


--
-- Name: TABLE profiles; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.profiles TO anon;
GRANT ALL ON TABLE public.profiles TO authenticated;
GRANT ALL ON TABLE public.profiles TO service_role;


--
-- Name: TABLE promociones; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.promociones TO anon;
GRANT ALL ON TABLE public.promociones TO authenticated;
GRANT ALL ON TABLE public.promociones TO service_role;


--
-- Name: TABLE push_tokens; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.push_tokens TO anon;
GRANT ALL ON TABLE public.push_tokens TO authenticated;
GRANT ALL ON TABLE public.push_tokens TO service_role;


--
-- Name: TABLE qr_tokens; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.qr_tokens TO anon;
GRANT ALL ON TABLE public.qr_tokens TO authenticated;
GRANT ALL ON TABLE public.qr_tokens TO service_role;


--
-- Name: TABLE roles; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.roles TO anon;
GRANT ALL ON TABLE public.roles TO authenticated;
GRANT ALL ON TABLE public.roles TO service_role;


--
-- Name: TABLE suscripciones; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.suscripciones TO anon;
GRANT ALL ON TABLE public.suscripciones TO authenticated;
GRANT ALL ON TABLE public.suscripciones TO service_role;


--
-- Name: TABLE user_roles; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.user_roles TO anon;
GRANT ALL ON TABLE public.user_roles TO authenticated;
GRANT ALL ON TABLE public.user_roles TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: supabase_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: supabase_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: supabase_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO service_role;


--
-- PostgreSQL database dump complete
--

\unrestrict AwqCO52m9WNlycFifRFuSkcarbW8smhUgboMayVauGv2ITnRl9jYyvTfCkyfRDj

