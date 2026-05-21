import os
import re
import csv
import io
import uuid
import secrets
import smtplib
import traceback
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
import requests
import pytz
from fastapi import (
    FastAPI,
    HTTPException,
    status,
    Request,
    BackgroundTasks,
    Query,
    Form,
    File,
    UploadFile,
    Depends,
)
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr, validator
from typing import Optional, Dict, Any

# =============================================================================
# ESTADOS DE CUENTA — FUENTE ÚNICA DE VERDAD
# =============================================================================
# Estados que permiten login y acceso al sistema (con posibles restricciones de features)
ESTADOS_ACTIVOS: frozenset = frozenset({"APROBADO", "RESTRINGIDO"})

# Estados que bloquean completamente el acceso de familiares vinculados al titular
# Si el titular tiene uno de estos estados, sus familiares no pueden operar.
ESTADOS_BLOQUEANTES: frozenset = frozenset({"RESTRINGIDO", "SUSPENDIDO", "RECHAZADO"})

# Todos los estados válidos del sistema (para validación en endpoints admin)
ESTADOS_VALIDOS: frozenset = frozenset({"PENDIENTE", "APROBADO", "RECHAZADO", "SUSPENDIDO", "RESTRINGIDO"})

# Mensaje estandarizado para el frontend cuando el titular está restringido
MSG_TITULAR_RESTRINGIDO = (
    "TITULAR_RESTRINGIDO: Tu cuenta está limitada porque el socio titular "
    "tiene restricciones en su cuenta. Comunicate con la administración."
)

# Usuarios excluidos permanentemente de recordatorios y mora
# Cargados desde variable de entorno: EMAILS_EXCLUIDOS_MORA="email1@x.com,email2@x.com"
# Si la variable no está definida, el set queda vacío (nadie excluido).
_raw_excluidos = os.getenv("EMAILS_EXCLUIDOS_MORA", "")
EMAILS_EXCLUIDOS_MORA: frozenset = frozenset(
    e.strip().lower() for e in _raw_excluidos.split(",") if e.strip()
)
# =============================================================================

# ─────────────────────────────────────────────────────────────────────────────
# VALIDACIÓN Y NORMALIZACIÓN DE URLs SOCIALES (función centralizada)
# ─────────────────────────────────────────────────────────────────────────────

# Dominios permitidos para links de Instagram y Facebook
_SOCIAL_URL_WHITELIST = {
    # Instagram
    "instagram.com", "www.instagram.com", "m.instagram.com",
    # Facebook
    "facebook.com", "www.facebook.com", "m.facebook.com", "fb.com", "www.fb.com",
    "fb.me", "www.fb.me",
    # WhatsApp (también usado como link_externo o instagram_url en algunos flujos)
    "wa.me", "www.wa.me", "api.whatsapp.com", "chat.whatsapp.com",
}


def normalize_social_url(v):
    """Normaliza y valida URLs de redes sociales (nivel producción).

    Proceso:
      1. Sanitiza: strip de espacios y caracteres de control.
      2. Normaliza: agrega https:// si no tiene esquema.
      3. Parsea con urllib.parse para validación estructural real.
      4. Fuerza el dominio a minúsculas.
      5. Aplica whitelist de dominios permitidos (Instagram, Facebook, WhatsApp).

    Acepta: URLs con o sin protocolo, con subdominios (www, m.),
    parámetros (?utm=...), fragmentos (#section).
    Rechaza: dominios fuera del whitelist, URLs incompletas o mal formadas.
    """
    from urllib.parse import urlparse, urlunparse

    if v is None:
        return None
    if not isinstance(v, str):
        return v

    # 1. Sanitizar: quitar espacios y caracteres de control
    v = v.strip().strip('\t\n\r')
    if not v:
        return None

    # 2. Normalizar: agregar https:// si falta el esquema
    if not re.match(r'^https?://', v, re.IGNORECASE):
        v = 'https://' + v

    # 3. Parsear con urllib para validación estructural real
    try:
        parsed = urlparse(v)
    except Exception:
        raise ValueError("Ingresá una URL válida (ej: instagram.com/tutienda)")

    # Esquema debe ser http o https
    if parsed.scheme.lower() not in ('http', 'https'):
        raise ValueError("La URL debe comenzar con http:// o https://")

    # Extraer hostname limpio (sin usuario:clave@ ni puerto)
    netloc = parsed.netloc or ''
    if '@' in netloc:
        netloc = netloc.split('@')[-1]
    hostname = netloc.split(':')[0].lower().strip()

    if not hostname:
        raise ValueError("Ingresá una URL con dominio válido (ej: instagram.com/tutienda)")

    # 4. Validar estructura de dominio: mínimo 2 etiquetas, TLD de ≥2 chars
    labels = hostname.split('.')
    if len(labels) < 2:
        raise ValueError("El dominio no es válido. Usá un link completo (ej: instagram.com/tutienda)")
    tld = labels[-1]
    if len(tld) < 2 or not re.match(r'^[a-z]+$', tld):
        raise ValueError("El dominio no es válido. Usá un link completo (ej: instagram.com/tutienda)")
    if not all(re.match(r'^[\w\-]+$', label) for label in labels if label):
        raise ValueError("El dominio contiene caracteres inválidos")

    # 5. Whitelist: solo dominios permitidos
    if hostname not in _SOCIAL_URL_WHITELIST:
        allowed = "instagram.com, facebook.com o wa.me"
        raise ValueError(
            f"Solo se permiten links de {allowed}. "
            f"El dominio '{hostname}' no está habilitado."
        )

    # Reconstruir URL con hostname en minúsculas
    normalized = urlunparse((
        'https',          # forzar https siempre
        hostname + ((':' + netloc.split(':')[1]) if ':' in netloc else ''),
        parsed.path,
        parsed.params,
        parsed.query,
        parsed.fragment,
    ))
    return normalized


def normalize_whatsapp_url(v):
    """Normaliza URLs o números de WhatsApp.

    Acepta:
      - URL completa: https://wa.me/549...
      - URL sin protocolo: wa.me/549...
      - Número de teléfono: 3794123456 (10 dígitos AR) o 549379...
      - String vacío → None
    Rechaza:
      - Texto que no sea número ni URL wa.me válida
    """
    from urllib.parse import urlparse

    if v is None:
        return None
    if not isinstance(v, str):
        return v

    v = v.strip().strip('\t\n\r')
    if not v:
        return None

    # Si parece un número de teléfono (solo dígitos, +, espacios, guiones)
    numero_raw = re.sub(r'[\s\-\(\)\+]', '', v)
    if numero_raw.isdigit():
        # Normalizar para Argentina: 10 dígitos → 549XXXXXXXXXX
        if len(numero_raw) == 10:
            numero_raw = '549' + numero_raw
        elif len(numero_raw) == 11 and numero_raw.startswith('0'):
            numero_raw = '549' + numero_raw[1:]
        return f'https://wa.me/{numero_raw}'

    # Si es una URL, agregar protocolo si falta
    if not re.match(r'^https?://', v, re.IGNORECASE):
        v = 'https://' + v

    try:
        parsed = urlparse(v)
    except Exception:
        raise ValueError("Ingresá un número de WhatsApp o link wa.me válido")

    hostname = (parsed.netloc or '').split(':')[0].lower().strip()
    if '@' in hostname:
        hostname = hostname.split('@')[-1]

    wa_domains = {'wa.me', 'www.wa.me', 'api.whatsapp.com', 'chat.whatsapp.com', 'whatsapp.com', 'www.whatsapp.com'}
    if hostname not in wa_domains:
        raise ValueError(
            f"Solo se permiten links de WhatsApp (wa.me). "
            f"El dominio '{hostname}' no está habilitado para este campo."
        )

    return v

def normalize_whatsapp_number(v):
    """Limpia el número de WhatsApp guardando solo dígitos."""
    if v is None:
        return None
    if not isinstance(v, str):
        return v
    v = v.strip()
    if not v:
        return None
    # Remover todo menos dígitos
    numero_raw = re.sub(r'\D', '', v)
    if not numero_raw:
        return None
    # Si ingresó 10 dígitos (AR sin codigo pais), agregar 549
    if len(numero_raw) == 10:
        return '549' + numero_raw
    # Si ingresó 11 dígitos con 0 (011...), reemplazar por 54911...
    if len(numero_raw) == 11 and numero_raw.startswith('0'):
        return '549' + numero_raw[1:]
    # Si ingresó 12 dígitos (54 sin 9), asume que es AR pero le falta el 9 para móviles (caso común)
    if len(numero_raw) == 12 and numero_raw.startswith('54') and not numero_raw.startswith('549'):
        return '549' + numero_raw[2:]
    return numero_raw

# ─────────────────────────────────────────────────────────────────────────────

from dotenv import load_dotenv
from supabase import create_client, Client, ClientOptions
from datetime import datetime, timedelta, timezone, date
from uuid import uuid4
import firebase_admin
from firebase_admin import credentials, messaging
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from services.cron_manager import acquire_cron_lock, release_cron_lock
from urllib.parse import quote


# Cargar variables de entorno
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(BASE_DIR, ".env"))

from schemas.comercio import ComercioDTO
from schemas.profesional import ProfesionalDTO

# --- CONFIGURACIÓN DE OBSERVABILIDAD SEGURA ---
ENV = os.getenv("ENV", "production").lower()
IS_DEV = (ENV == "development")
# DEBUG_AUTH permite logs detallados de auth incluso en prod si se activa manualmente
DEBUG_AUTH = os.getenv("DEBUG_AUTH", "false").lower() == "true"

def redact_sensitive_data(data: Any) -> Any:
    """Oculta información sensible para logs de producción."""
    if not data:
        return data
    if isinstance(data, dict):
        new_data = data.copy()
        for k, v in new_data.items():
            # Redactar claves críticas
            if k.lower() in ["password", "token", "refresh_token", "access_token", "email_verificacion_token", "secret"]:
                new_data[k] = "[REDACTED]"
            # Ofuscar emails
            elif k.lower() == "email" and isinstance(v, str) and "@" in v:
                parts = v.split("@")
                new_data[k] = f"{parts[0][0]}***{parts[0][-1]}@{parts[1]}" if len(parts[0]) > 1 else f"***@{parts[1]}"
            # Ofuscar DNI/CUIT (dejar solo últimos 4)
            elif k.lower() in ["dni", "cuit", "dni_cuit"] and isinstance(v, str) and len(v) >= 4:
                new_data[k] = f"****{v[-4:]}"
            # Recurrencia
            elif isinstance(v, (dict, list)):
                new_data[k] = redact_sensitive_data(v)
        return new_data
    elif isinstance(data, list):
        return [redact_sensitive_data(i) for i in data]
    return data

def log_debug(message: str, data: Any = None):
    """Loguea solo si estamos en modo dev o debug_auth activo."""
    if IS_DEV or DEBUG_AUTH:
        if data is not None:
            logger.info(f"{message} | Data: {data}")
        else:
            logger.info(message)

def log_secure(message: str, data: Any = None):
    """Loguea información de forma segura (redactada) en cualquier entorno."""
    if data is not None:
        safe_data = redact_sensitive_data(data)
        logger.info(f"{message} | Data: {safe_data}")
    else:
        logger.info(message)

from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from fastapi.responses import JSONResponse, StreamingResponse


"""
NUEVO SISTEMA DE QR DINÁMICO
Generación bajo demanda, uso temporal
Protección contra fraude y captura de pantalla
"""
ENABLE_DYNAMIC_QR = True

limiter = Limiter(key_func=get_remote_address)

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY")

if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
    raise ValueError(
        "Faltan variables de entorno SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY"
    )

if not SUPABASE_ANON_KEY:
    raise ValueError(
        "Falta variable de entorno SUPABASE_ANON_KEY. Esto es requerido para autenticación de usuarios (login)."
    )

# Inicializar cliente Supabase con ClientOptions
opts = ClientOptions(auto_refresh_token=False, persist_session=False)
supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY, options=opts)

# Cliente singleton con ANON_KEY para autenticación de usuarios (login)
# Evita crear un nuevo client en cada request de login (memory leak)
supabase_anon: Client = create_client(SUPABASE_URL, SUPABASE_ANON_KEY, options=opts)

# ─── SCHEDULER AUTOMÁTICO DE MORA (DESACTIVADO EN FAVOR DE ENDPOINTS) ───
import logging

logger = logging.getLogger(__name__)

# La antigua tarea_automatica_mora ha sido reemplazada por /api/v1/cron/notificar-mora
# y /api/v1/cron/verificar-bloqueos para ser llamadas vía cron externo (ej. Make.com).

# Zona horaria Argentina
TZ_ARGENTINA = pytz.timezone("America/Argentina/Buenos_Aires")

import requests
import os

def trigger_local_cron(endpoint: str, method="GET"):
    """
    Scheduler Redundante: Llama a los endpoints cron locales.
    Si Make.com ya lo ejecutó, el endpoint retornará skipped gracias al cron_manager lock.
    """
    secret = os.getenv("CRON_SECRET")
    url = f"http://127.0.0.1:8000{endpoint}"
    headers = {"X-Cron-Secret": secret}
    try:
        if method == "GET":
            res = requests.get(url, headers=headers, timeout=60)
        else:
            # detectar-mora usa X-API-Secret en vez de X-Cron-Secret
            headers = {"X-API-Secret": os.getenv("API_SECRET_TOKEN")}
            res = requests.post(url, headers=headers, timeout=60)
        logger.info(f"[REDUNDANT SCHEDULER] Llamada a {endpoint}: {res.status_code} - {res.text}")
    except requests.exceptions.Timeout:
        logger.error(f"[REDUNDANT SCHEDULER] Timeout llamando a {endpoint}")
    except requests.exceptions.ConnectionError:
        logger.error(f"[REDUNDANT SCHEDULER] Error de conexión llamando a {endpoint}")
    except requests.exceptions.RequestException as e:
        logger.error(f"[REDUNDANT SCHEDULER] Error HTTP llamando a {endpoint}: {e}")
    except Exception as e:
        logger.error(f"[REDUNDANT SCHEDULER] Error inesperado llamando a {endpoint}: {e}")

scheduler = BackgroundScheduler(timezone=TZ_ARGENTINA)

# Make.com corre a las 08:00 AM. Nosotros corremos a las 08:15 AM como respaldo.
scheduler.add_job(trigger_local_cron, CronTrigger(hour=8, minute=15, timezone=TZ_ARGENTINA), args=["/api/v1/cron/verificar-bloqueos"], id="backup_bloqueos", max_instances=1, replace_existing=True, misfire_grace_time=3600)
scheduler.add_job(trigger_local_cron, CronTrigger(hour=9, minute=15, timezone=TZ_ARGENTINA), args=["/api/v1/cron/recordatorios-pago"], id="backup_recordatorios", max_instances=1, replace_existing=True, misfire_grace_time=3600)
# Los del día 11 (Mora)
scheduler.add_job(trigger_local_cron, CronTrigger(day=11, hour=8, minute=15, timezone=TZ_ARGENTINA), args=["/api/cron/detectar-mora", "POST"], id="backup_detectar_mora", max_instances=1, replace_existing=True, misfire_grace_time=3600)
scheduler.add_job(trigger_local_cron, CronTrigger(day=11, hour=9, minute=15, timezone=TZ_ARGENTINA), args=["/api/v1/cron/notificar-mora"], id="backup_notificar_mora", max_instances=1, replace_existing=True, misfire_grace_time=3600)
scheduler.add_job(trigger_local_cron, CronTrigger(hour=0, minute=0, timezone=TZ_ARGENTINA), args=["/api/cron/limpiar-notificaciones", "POST"], id="cleanup_notificaciones", max_instances=1, replace_existing=True, misfire_grace_time=3600)

app = FastAPI(title="Sociedad Rural Del Norte De Corrientes API")
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)


@app.on_event("startup")
def startup_scheduler():
    scheduler.start()
    logger.info(
        "[SCHEDULER] Iniciado. Motor de mora programado para el día 11 de cada mes a las 8:00 AM (AR)."
    )


@app.on_event("shutdown")
def shutdown_scheduler():
    scheduler.shutdown(wait=False)
    logger.info("[SCHEDULER] Apagado correctamente.")


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    if isinstance(exc, HTTPException):
        return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})

    logger.error(f"Global Exception [500]: {str(exc)}")
    return JSONResponse(
        status_code=500,
        content={
            "detail": "Ha ocurrido un error interno en el servidor. Si el problema persiste, contacte a soporte."
        },
    )


# --- INICIALIZAR FIREBASE ADMIN ---
def get_formatted_private_key() -> str:
    raw_key = os.environ.get("FIREBASE_PRIVATE_KEY", "")
    if not raw_key:
        return ""
    # Si viene con comillas dobles al principio y al final, las quitamos
    if raw_key.startswith('"') and raw_key.endswith('"'):
        raw_key = raw_key[1:-1]

    # Reemplazamos los saltos de línea escapados por saltos de línea reales
    formatted_key = raw_key.replace("\\n", "\n")

    # Asegurarnos de limpiar correctamente cualquier espacio o salto de linea mal formado
    if "-----BEGIN PRIVATE KEY-----" in formatted_key:
        try:
            key_body = formatted_key.split("-----BEGIN PRIVATE KEY-----")[1].split(
                "-----END PRIVATE KEY-----"
            )[0]
            clean_body = (
                key_body.replace(" ", "")
                .replace("\\n", "")
                .replace("\n", "")
                .replace("\r", "")
            )
            chunks = [clean_body[i : i + 64] for i in range(0, len(clean_body), 64)]
            formatted_key = (
                "-----BEGIN PRIVATE KEY-----\n"
                + "\n".join(chunks)
                + "\n-----END PRIVATE KEY-----\n"
            )
        except Exception:
            pass

    return formatted_key


try:
    firebase_default_app = firebase_admin.get_app()
except ValueError:
    firebase_cred_json = {
        "type": os.environ.get("FIREBASE_TYPE", "service_account"),
        "project_id": os.environ.get("FIREBASE_PROJECT_ID"),
        "private_key_id": os.environ.get("FIREBASE_PRIVATE_KEY_ID"),
        "private_key": get_formatted_private_key(),
        "client_email": os.environ.get("FIREBASE_CLIENT_EMAIL"),
        "client_id": os.environ.get("FIREBASE_CLIENT_ID"),
        "auth_uri": "https://accounts.google.com/o/oauth2/auth",
        "token_uri": "https://oauth2.googleapis.com/token",
        "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
        "client_x509_cert_url": f"https://www.googleapis.com/robot/v1/metadata/x509/{os.environ.get('FIREBASE_CLIENT_EMAIL', '').replace('@', '%40')}",
        "universe_domain": "googleapis.com",
    }
    # Solo inicializar si tenemos al menos el project_id y private_key validos
    if firebase_cred_json.get("project_id") and firebase_cred_json.get("private_key"):
        try:
            cred = credentials.Certificate(firebase_cred_json)
            firebase_admin.initialize_app(cred)
            logger.info("Firebase Admin configurado correctamente.")
        except Exception as e:
            logger.info(f"Warning: Firebase Admin no pudo inicializarse: {e}")
    else:
        logger.info(
            "Warning: Faltan credenciales de Firebase en el entorno, Push Notifications deshabilitadas."
        )


# --- FUNCIONES DE AUDITORÍA ---
def registrar_auditoria(
    usuario_id: Optional[str],
    email_usuario: Optional[str],
    rol_usuario: Optional[str],
    accion: str,
    tabla: str,
    registro_id: str,
    datos_anteriores: Optional[Dict[str, Any]],
    datos_nuevos: Optional[Dict[str, Any]],
    modulo: str,
    request: Request,
):
    """
    Registra un evento crítico en la tabla auditoria_logs.
    """
    try:
        ip = request.client.host if request.client else "unknown"
        user_agent = request.headers.get("user-agent", "unknown")

        log_data = {
            "usuario_id": usuario_id,
            "email_usuario": email_usuario,
            "rol_usuario": rol_usuario,
            "accion": accion,
            "tabla_afectada": tabla,
            "registro_id": registro_id,
            "datos_anteriores": datos_anteriores,
            "datos_nuevos": datos_nuevos,
            "modulo": modulo,
            "ip_address": ip,
            "user_agent": user_agent,
        }

        supabase.table("auditoria_logs").insert(log_data).execute()
    except Exception as e:
        # La auditoría no debería bloquear el flujo principal si falla,
        # pero idealmente debería registrarse en un log del servidor.
        logger.error(f"Error crítico en registro de auditoría: {str(e)}")


# 1. CORS ESTRICTO PARA FRONTEND
# Producción: https://sociedadruraldelnorte.agentech.ar
# Desarrollo local: localhost:3000 / localhost:5173
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost",
        "https://localhost",
        "capacitor://localhost",
        "https://sociedadruraldelnorte.agentech.ar",
        "https://backend.agentech.ar",
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept", "X-Webhook-Token", "X-Webhook-Secret", "x-webhook-secret"],
)


import re

def sanitizar_y_validar_telefono(telefono: str) -> str:
    if not telefono:
        return telefono
    # Permitir guiones y espacios autocorrigiéndolos (borrándolos)
    t_limpio = re.sub(r'[\s\-]', '', str(telefono))
    
    if not t_limpio:
        raise ValueError("El teléfono solo puede contener números")
        
    if not t_limpio.isdigit():
        raise ValueError("El teléfono solo puede contener números")
        
    if len(t_limpio) < 8 or len(t_limpio) > 15:
        raise ValueError("Ingresá un número de teléfono válido (entre 8 y 15 dígitos)")
    return t_limpio

# 2. MODELOS PYDANTIC BASADOS EN FORMULARIOS DEL FRONTEND
class RegisterRequest(BaseModel):
    nombre_apellido: str
    dni_cuit: str
    email: EmailStr
    telefono: str
    rol: Optional[str] = "SOCIO"
    municipio: Optional[str] = None
    provincia: Optional[str] = None  # Provincia del socio/comercio
    rubro: Optional[str] = None
    direccion: Optional[str] = None
    barrio: Optional[str] = None  # Barrio/localidad de residencia
    es_profesional: Optional[bool] = False
    password: Optional[str] = None
    isStudent: Optional[bool] = False
    studentCertificate: Optional[str] = None

    _validar_telefono = validator("telefono", pre=True, always=True, allow_reuse=True)(sanitizar_y_validar_telefono)


class LoginRequest(BaseModel):
    identificador: str
    password: str


class ForgotPasswordRequest(BaseModel):
    identificador: str
    mensaje: Optional[str] = None


class UpdateProfileRequest(BaseModel):
    nombre_apellido: Optional[str] = None
    telefono: Optional[str] = None
    municipio: Optional[str] = None
    rubro: Optional[str] = None
    email: Optional[str] = None
    direccion: Optional[str] = None
    barrio: Optional[str] = None  # Barrio editable

    _validar_telefono = validator("telefono", pre=True, always=True, allow_reuse=True)(sanitizar_y_validar_telefono)


class ChatRequest(BaseModel):
    message: str
    image_url: Optional[str] = None
    mode: Optional[str] = "Básico"
    email: Optional[str] = None
    direccion: Optional[str] = None


class ChangePasswordRequest(BaseModel):
    new_password: str


class CreateAdminRequest(BaseModel):
    username: str
    email: EmailStr
    password: str
    nombre_apellido: str
    dni: Optional[str] = None
    rol: str


class UpdateAdminRoleRequest(BaseModel):
    rol: str


# ResetPasswordRequest se definió más abajo


class AddDependienteRequest(BaseModel):
    nombre_apellido: str
    dni_cuit: str
    tipo_vinculo: str
    email: Optional[EmailStr] = None
    telefono: Optional[str] = None
    password: Optional[str] = None

    @validator("nombre_apellido", "dni_cuit", "tipo_vinculo", "telefono", "email", pre=True)
    def trim_strings(cls, v):
        if isinstance(v, str):
            return v.strip()
        return v

    @validator("dni_cuit")
    def validate_dni_cuit(cls, v):
        # Eliminar guiones o puntos por las dudas
        v = v.replace(".", "").replace("-", "")
        if not v.isdigit():
            raise ValueError("El DNI/CUIT debe contener solo números")
        if len(v) < 7 or len(v) > 11:
            raise ValueError("El DNI/CUIT debe tener entre 7 y 11 dígitos")
        return v

    _validar_telefono = validator("telefono", pre=True, always=True, allow_reuse=True)(sanitizar_y_validar_telefono)


class EventCreate(BaseModel):
    titulo: str
    descripcion: str
    lugar: str
    fecha: str
    hora: str
    tipo: str
    imagen_url: Optional[str] = None
    municipio_id: str
    link_instagram: Optional[str] = None
    link_facebook: Optional[str] = None
    link_whatsapp: Optional[str] = None
    link_externo: Optional[str] = None
    estado: Optional[str] = "borrador"
    destacado: Optional[bool] = False
    publico: Optional[bool] = True

    _normalize_instagram = validator("link_instagram", pre=True, always=True, allow_reuse=True)(normalize_social_url)
    _normalize_facebook = validator("link_facebook", pre=True, always=True, allow_reuse=True)(normalize_social_url)
    _normalize_externo = validator("link_externo", pre=True, always=True, allow_reuse=True)(normalize_social_url)
    _normalize_whatsapp = validator("link_whatsapp", pre=True, always=True, allow_reuse=True)(normalize_whatsapp_url)


class EventUpdate(BaseModel):
    titulo: Optional[str] = None
    descripcion: Optional[str] = None
    lugar: Optional[str] = None
    fecha: Optional[str] = None
    hora: Optional[str] = None
    tipo: Optional[str] = None
    imagen_url: Optional[str] = None
    municipio_id: Optional[str] = None
    link_instagram: Optional[str] = None
    link_facebook: Optional[str] = None
    link_whatsapp: Optional[str] = None
    link_externo: Optional[str] = None
    estado: Optional[str] = None
    destacado: Optional[bool] = None
    publico: Optional[bool] = None

    _normalize_instagram = validator("link_instagram", pre=True, always=True, allow_reuse=True)(normalize_social_url)
    _normalize_facebook = validator("link_facebook", pre=True, always=True, allow_reuse=True)(normalize_social_url)
    _normalize_externo = validator("link_externo", pre=True, always=True, allow_reuse=True)(normalize_social_url)
    _normalize_whatsapp = validator("link_whatsapp", pre=True, always=True, allow_reuse=True)(normalize_whatsapp_url)



class WebhookEventoPayload(BaseModel):
    external_id: str
    titulo: str
    fecha: Optional[str] = None
    hora: Optional[str] = None
    lugar: Optional[str] = "A confirmar"
    municipio: Optional[str] = None
    imagen_url: str



class UpdateSupportNoteRequest(BaseModel):
    nota: str


import unicodedata

def slugify(value: str) -> str:
    value = unicodedata.normalize('NFKD', value).encode('ascii', 'ignore').decode('ascii')
    value = re.sub(r'[^\w\s-]', '', value.lower())
    return re.sub(r'[-\s]+', '-', value).strip('-_')


# ── UTILIDAD DE EMAIL ──────────────────────────────────────────────────────────
def enviar_email_html(destinatario: str, asunto: str, html_body: str) -> bool:
    """
    Envía un email HTML. Intenta Resend API primero (si hay RESEND_API_KEY).
    Fallback a SMTP (si hay SMTP_HOST + SMTP_USER + SMTP_PASS).
    Nunca lanza excepción — retorna True si éxito, False si falla.
    """
    resend_key = os.getenv("RESEND_API_KEY", "")
    if resend_key:
        return _enviar_via_resend(destinatario, asunto, html_body, resend_key)
    return _enviar_via_smtp(destinatario, asunto, html_body)


def _enviar_via_resend(destinatario: str, asunto: str, html_body: str, api_key: str) -> bool:
    """Envía usando la API HTTP de Resend (resend.com)."""
    from_email = os.getenv("RESEND_FROM", os.getenv("SMTP_FROM", "noreply@sociedadruraldelnorte.com"))
    try:
        r = requests.post(
            "https://api.resend.com/emails",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json={
                "from":    from_email,
                "to":      [destinatario],
                "subject": asunto,
                "html":    html_body,
            },
            timeout=12,
        )
        if r.status_code in (200, 201):
            logger.info(f"[RESEND] Email enviado a {destinatario}")
            return True
        logger.warning(f"[RESEND] Error {r.status_code}: {r.text[:200]}")
        # Fallback a SMTP si Resend falla
        return _enviar_via_smtp(destinatario, asunto, html_body)
    except requests.exceptions.Timeout:
        logger.warning(f"[RESEND] Timeout enviando a {destinatario}. Usando fallback SMTP.")
        return _enviar_via_smtp(destinatario, asunto, html_body)
    except requests.exceptions.ConnectionError:
        logger.warning(f"[RESEND] Error de conexión enviando a {destinatario}. Usando fallback SMTP.")
        return _enviar_via_smtp(destinatario, asunto, html_body)
    except requests.exceptions.RequestException as e:
        logger.warning(f"[RESEND] Error HTTP enviando a {destinatario}: {e}. Usando fallback SMTP.")
        return _enviar_via_smtp(destinatario, asunto, html_body)
    except Exception as e:
        logger.error(f"[RESEND] Excepción: {e}")
        return _enviar_via_smtp(destinatario, asunto, html_body)


def _enviar_via_smtp(destinatario: str, asunto: str, html_body: str) -> bool:
    """Envía usando SMTP estándar (starttls). Requiere SMTP_HOST, SMTP_USER, SMTP_PASS."""
    smtp_host = os.getenv("SMTP_HOST", "")
    smtp_port = int(os.getenv("SMTP_PORT", "587"))
    smtp_user = os.getenv("SMTP_USER", "")
    smtp_pass = os.getenv("SMTP_PASS", "")
    smtp_from = os.getenv("SMTP_FROM", smtp_user)

    if not all([smtp_host, smtp_user, smtp_pass]):
        logger.warning(f"[EMAIL] Sin proveedor configurado. No se envió email a {destinatario}")
        return False

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = asunto
        msg["From"]    = smtp_from
        msg["To"]      = destinatario
        msg.attach(MIMEText(html_body, "html", "utf-8"))

        with smtplib.SMTP(smtp_host, smtp_port, timeout=10) as server:
            server.ehlo()
            server.starttls()
            server.login(smtp_user, smtp_pass)
            server.sendmail(smtp_from, destinatario, msg.as_string())

        logger.info(f"[SMTP] Email enviado a {destinatario}")
        return True
    except Exception as e:
        logger.error(f"[SMTP] Error enviando a {destinatario}: {str(e)}")
        return False


def _html_verificacion(nombre: str, url: str) -> str:
    return f"""
    <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;">
      <h2 style="color:#245b31;margin-bottom:8px;">Verificación de correo electrónico</h2>
      <p style="color:#444;font-size:15px;">Hola <strong>{nombre}</strong>,</p>
      <p style="color:#444;font-size:15px;">
        Gracias por registrarte en <strong>Sociedad Rural Del Norte De Corrientes</strong>.
        Para completar tu registro, verificá tu dirección de correo electrónico.
      </p>
      <div style="text-align:center;margin:32px 0;">
        <a href="{url}" style="background:#357a38;color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:15px;">
          Verificar mi correo
        </a>
      </div>
      <p style="color:#888;font-size:12px;">Este enlace expira en 48 horas. Si no te registraste, ignorá este mensaje.</p>
    </div>
    """


def _html_aprobacion(nombre: str, login_url: str) -> str:
    return f"""
    <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;">
      <h2 style="color:#245b31;margin-bottom:8px;">Tu cuenta fue aprobada ✅</h2>
      <p style="color:#444;font-size:15px;">Hola <strong>{nombre}</strong>,</p>
      <p style="color:#444;font-size:15px;">
        Tu cuenta en <strong>Sociedad Rural Del Norte De Corrientes</strong> fue aprobada por el administrador.
        Ya podés ingresar al portal.
      </p>
      <div style="text-align:center;margin:32px 0;">
        <a href="{login_url}" style="background:#357a38;color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:15px;">
          Ingresar al Portal
        </a>
      </div>
    </div>
    """

# ── UTILIDADES PARA EL WEBHOOK DE EVENTOS SOCIALES ───────────────────────────
def procesar_imagen_evento(media_url: str, post_id: str) -> Optional[str]:
    if not media_url:
        raise ValueError("media_url no puede ser nulo")

    r = requests.get(media_url, stream=True, timeout=10)
    r.raise_for_status()

    # Guardar en memoria y subir a supabase storage
    file_bytes = r.content
    filename = f"{post_id}_{uuid4().hex[:8]}.jpg"  # Asumimos jpg de IG

    # Subir al bucket 'imagenes-eventos'.
    supabase.storage.from_("imagenes-eventos").upload(
        file=file_bytes, path=filename, file_options={"content-type": "image/jpeg"}
    )

    # Obtener URL publica
    url_publica = supabase.storage.from_("imagenes-eventos").get_public_url(
        filename
    )
    return url_publica


# 2.5 ENDPOINT CHECK EMAIL — Verificación en tiempo real
@app.get("/api/check-email")
@limiter.limit("10/minute")
def check_email(email: str, type: str = "socio", request: Request = None):
    """
    Verifica si un email ya existe en el sistema.
    Usado por el frontend para validación en tiempo real (onBlur).
    
    Query params:
      - email: dirección de correo a verificar
      - type: 'socio' | 'comercio' (para mensajes diferenciados, misma tabla)
    
    Response: { "exists": bool }
    """
    try:
        result = supabase.table("profiles").select("id").eq("email", email.lower().strip()).execute()
        return {"exists": bool(result.data)}
    except Exception as e:
        logger.error(f"[check-email] Error: {e}")
        # En caso de error, retornamos exists=False para no bloquear el registro
        return {"exists": False}


# 3. ENDPOINT REGISTER (Integrado con Supabase Auth y Public Profiles)
@app.post("/api/register", status_code=status.HTTP_201_CREATED)
@limiter.limit("10/minute")
async def register(
    request: Request, background_tasks: BackgroundTasks
):
    logger.info(">>> INICIO REGISTER")
    try:
        content_type = request.headers.get("content-type", "")
        logger.info(f"Content-Type: {content_type}")
        socio_dict = {}
        constancia_file = None
        user_id = None
        
        if "multipart/form-data" in content_type:
            form = await request.form()
            # extract fields
            socio_dict = {
                "nombre_apellido": form.get("nombre_apellido"),
                "dni_cuit": form.get("dni_cuit"),
                "email": form.get("email"),
                "telefono": form.get("telefono"),
                "rol": form.get("rol"),
                "municipio": form.get("municipio"),
                "provincia": form.get("provincia"),
                "direccion": form.get("direccion"),
                "barrio": form.get("barrio"),
                "es_profesional": False,  # SIEMPRE False en registro público. Solo Gestión Integral puede marcar profesionales.
                "password": form.get("password"),
                "isStudent": str(form.get("isStudent", "")).lower() == "true",
            }
            # Remove None values
            socio_dict = {k: v for k, v in socio_dict.items() if v is not None}
            
            # File
            if "studentCertificate" in form:
                upload_file = form["studentCertificate"]
                if hasattr(upload_file, "filename") and upload_file.filename:
                    # Validar MIME
                    if upload_file.content_type not in ["image/png", "image/jpeg", "image/jpg", "application/pdf"]:
                        raise HTTPException(400, "Formato no permitido. Use PNG, JPG o PDF.")
                    
                    file_bytes = await upload_file.read()
                    if len(file_bytes) > 5 * 1024 * 1024:
                        raise HTTPException(400, "El archivo supera los 5MB permitidos.")
                    
                    constancia_file = {
                        "filename": upload_file.filename,
                        "content_type": upload_file.content_type,
                        "bytes": file_bytes
                    }
        else:
            body = await request.json()
            socio_dict = body
            
        try:
            socio = RegisterRequest(**socio_dict)
            log_secure("Payload validado", socio.dict(exclude={'password', 'studentCertificate'}))
        except Exception as e:
            logger.error(f"Error validando RegisterRequest")
            raise HTTPException(400, "Error en los datos enviados.")

        rol_asignado = (socio.rol or "SOCIO").upper()
  
        if rol_asignado not in ("SOCIO", "COMERCIO"):
            rol_asignado = "SOCIO"

        if rol_asignado == "SOCIO" and socio.isStudent and not socio.studentCertificate and not constancia_file:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Para completar el registro como estudiante, es obligatorio adjuntar la constancia de alumno regular vigente."
            )

        if rol_asignado == "SOCIO":
            if not re.match(r'^\d{8}$', str(socio.dni_cuit)):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="El DNI debe contener exactamente 8 números"
                )

        # --- 1. Validaciones previas de duplicados en profiles ---
        try:
            log_secure("Verificando duplicados", {"email": socio.email, "dni": socio.dni_cuit})
            
            # Verificamos email
            existing_email = supabase.table("profiles").select("id").eq("email", socio.email).execute()
            if existing_email.data:
                logger.warning(f"Email ya registrado en profiles")
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="El correo ya se encuentra registrado"
                )
            
            # Verificamos DNI
            existing_dni = supabase.table("profiles").select("id").eq("dni", socio.dni_cuit).execute()
            if existing_dni.data:
                logger.warning(f"DNI/CUIT ya registrado en profiles")
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="El DNI o CUIT ya se encuentra registrado"
                )
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error en validación de duplicados")
            # Continuamos si es un error de red o similar, pero ya advertimos el fallo

        # 3.B: Crear usuario en Supabase Auth con manejo de huérfanos
        user_password = socio.password if socio.password else "SRNC2026!"
        default_passwords_list = ["comercio1234", "socio1234", "socio123", "SRNC2026!"]

        user_password_was_set = (
            socio.password is not None
            and len(socio.password) >= 8
            and (socio.password not in default_passwords_list)
        )

        user_id = None
        try:
            log_secure("Intentando create_user en Supabase Auth", {"email": socio.email})
            auth_response = supabase.auth.admin.create_user({
                "email": socio.email, 
                "password": user_password, 
                "email_confirm": True,
                "user_metadata": {
                    "nombre_apellido": socio.nombre_apellido,
                    "rol": rol_asignado
                }
            })
            user_id = auth_response.user.id
            logger.info(f"Usuario creado exitosamente en Auth.")
        except Exception as e:
            err_msg = str(e).lower()
            logger.warning(f"Fallo inicial en create_user")
            
            # Si el usuario ya existe en Auth (422), verificamos si es un huérfano (sin perfil)
            if "already registered" in err_msg or "already exists" in err_msg or "422" in err_msg:
                logger.info("Detectado usuario existente en Auth. Verificando huérfano...")
                
                try:
                    # 1. ¿Tiene perfil ya? (Doble verificación para evitar condiciones de carrera)
                    check_p = supabase.table("profiles").select("id").eq("email", socio.email).execute()
                    if check_p.data:
                        logger.warning(f"Confirmado: El email ya tiene un perfil completo.")
                        raise HTTPException(
                            status_code=status.HTTP_400_BAD_REQUEST,
                            detail="Ya existe una cuenta con este correo electrónico."
                        )

                    # 2. Si no tiene perfil, buscamos el ID en Auth para limpiarlo
                    user_lookup = supabase.rpc("get_user_id_by_email", {"p_email": socio.email}).execute()
                    existing_uid = user_lookup.data
                    
                    if existing_uid:
                        log_secure("Limpiando huérfano", {"id": existing_uid})
                        supabase.auth.admin.delete_user(existing_uid)
                        
                        # 3. Reintentamos creación
                        auth_response = supabase.auth.admin.create_user({
                            "email": socio.email, 
                            "password": user_password, 
                            "email_confirm": True,
                            "user_metadata": {
                                "nombre_apellido": socio.nombre_apellido,
                                "rol": rol_asignado
                            }
                        })
                        user_id = auth_response.user.id
                    else:
                        logger.error("Auth dice que existe pero no pudimos obtener el ID.")
                        raise e
                except HTTPException:
                    raise
                except Exception as clean_err:
                    logger.error(f"Error crítico al procesar usuario existente/huérfano")
                    raise e
            else:
                raise e

        # ── Subida constancia estudiante ─────────────────────────────
        constancia_url = None
        if socio.isStudent:
            if constancia_file:
                try:
                    bucket_name = "constancias-estudiantes"
                    try:
                        supabase.storage.create_bucket(bucket_name, public=True)
                    except Exception:
                        pass
                    
                    ext = constancia_file["filename"].split(".")[-1].lower()
                    if ext not in ["pdf", "png", "jpg", "jpeg"]:
                        ext = "pdf" if "pdf" in constancia_file["content_type"] else "png"
                    
                    filename = f"{user_id}_constancia_{uuid4().hex[:6]}.{ext}"
                    supabase.storage.from_(bucket_name).upload(
                        file=constancia_file["bytes"],
                        path=filename,
                        file_options={"content-type": constancia_file["content_type"]},
                    )
                    constancia_url = supabase.storage.from_(bucket_name).get_public_url(filename)
                except Exception as e:
                    logger.error(f"Error uploading student certificate")
            elif socio.studentCertificate:
                try:
                    import base64

                    bucket_name = "constancias-estudiantes"
                    try:
                        supabase.storage.create_bucket(bucket_name, public=True)
                    except Exception:
                        pass

                    header, encoded = socio.studentCertificate.split(",", 1)
                    file_bytes = base64.b64decode(encoded)

                    ext = "pdf" if "pdf" in header.lower() else "png"
                    filename = f"{user_id}_constancia_{uuid4().hex[:6]}.{ext}"

                    content_type = (
                        "application/pdf" if ext == "pdf" else "image/png"
                    )

                    supabase.storage.from_(bucket_name).upload(
                        file=file_bytes,
                        path=filename,
                        file_options={"content-type": content_type},
                    )

                    constancia_url = (
                        supabase.storage.from_(bucket_name).get_public_url(filename)
                    )

                except Exception as e:
                    logger.error(f"Error uploading student certificate")

        # 3.C: Insertar en profiles
        estado_asignado = "PENDIENTE"
        profile_data = {
            "id": user_id,
            "nombre_apellido": socio.nombre_apellido,
            "dni": socio.dni_cuit,
            "email": socio.email,
            "telefono": socio.telefono,
            "rol": rol_asignado,
            "estado": estado_asignado,
            "municipio": socio.municipio,
            "provincia": socio.provincia,
            "direccion": socio.direccion,
            "rubro": socio.rubro,
            "barrio": socio.barrio,
            "es_profesional": False,  # SIEMPRE False en registro público. Solo admins pueden asignar este flag.
            "password_changed": user_password_was_set,
            "es_estudiante": socio.isStudent,
            "constancia_estudiante_url": constancia_url,
            "email_verificado": False,
            "email_verificacion_token": secrets.token_urlsafe(32),
            "email_verificacion_expira": (
                datetime.now() + timedelta(hours=48)
            ).isoformat(),
            # SEGURIDAD: El registro público NUNCA puede crear usuarios profesionales.
            # Los profesionales SOLO son dados de alta desde el panel de Gestión Integral.
            "registration_source": "public",
        }

        # ── Insert + rollback ───────────────────────────────────────
        try:
            log_secure("Insertando en 'profiles'", profile_data)
            supabase.table("profiles").insert(profile_data).execute()

            if rol_asignado == "COMERCIO":
                commerce_data = {
                    "id": user_id,
                    "nombre_comercio": socio.nombre_apellido,
                    "cuit": socio.dni_cuit,
                    "rubro": socio.rubro,
                    "direccion": socio.direccion,
                    "barrio": socio.barrio,
                }
                log_secure("Insertando en 'comercios'", commerce_data)
                supabase.table("comercios").insert(commerce_data).execute()

        except Exception as profile_err:
            logger.error(f"FALLA EN INSERT")
            try:
                log_secure("Rollback: eliminando user_id", {"user_id": user_id})
                supabase.auth.admin.delete_user(user_id)
            except Exception as e:
                logger.error(f"Error crítico en rollback")
            raise profile_err

        # ── Auditoría ───────────────────────────────────────────────
        background_tasks.add_task(
            registrar_auditoria,
            usuario_id=user_id,
            email_usuario=socio.email,
            rol_usuario=rol_asignado,
            accion="CREATE",
            tabla="profiles",
            registro_id=user_id,
            datos_anteriores=None,
            datos_nuevos=profile_data,
            modulo="Registro Cuentas",
            request=request,
        )

        # ── Notificación admin ──────────────────────────────────────
        background_tasks.add_task(
            notificar_admins_nuevo_registro,
            nombre=socio.nombre_apellido,
            tipo_usuario=rol_asignado,
        )

        # ── Email verificación ──────────────────────────────────────
        background_tasks.add_task(
            _enviar_email_verificacion_bg,
            email=socio.email,
            nombre=socio.nombre_apellido,
            token=profile_data["email_verificacion_token"],
        )

        # Filtrar campos sensibles del response (tokens, estado interno)
        safe_profile = {
            "id": profile_data.get("id"),
            "nombre_apellido": profile_data.get("nombre_apellido"),
            "email": profile_data.get("email"),
            "rol": profile_data.get("rol"),
            "estado": profile_data.get("estado"),
        }

        response_data = {
            "message": f"{rol_asignado.capitalize()} registrado correctamente.",
            "socio": safe_profile,
        }

        # NOTA: Eliminado auto-login para forzar verificación de email y aprobación administrativa
        return response_data

    except HTTPException as he:
        raise he
    except Exception as e:
        err_msg = str(e).lower()
        logger.error(f"EXCEPCIÓN CRÍTICA EN REGISTER: {e}", exc_info=True)

        if (
            "user already registered" in err_msg
            or ("already exists" in err_msg and "email" in err_msg)
            or ("duplicate key value" in err_msg and "profiles_email_key" in err_msg)
        ):
            friendly_detail = "El correo electrónico ya se encuentra registrado."

        elif "duplicate key value" in err_msg and ("profiles_dni_key" in err_msg or "dni" in err_msg):
            friendly_detail = "El DNI/Documento ya está asociado a otra cuenta."

        elif "duplicate key value" in err_msg and ("profiles_cuit_key" in err_msg or "cuit" in err_msg):
            friendly_detail = "El CUIT ingresado ya está asociado a otra cuenta."

        elif "password" in err_msg and "short" in err_msg:
            friendly_detail = "La contraseña es demasiado corta."

        else:
            friendly_detail = "Error al procesar el registro."

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=friendly_detail,
        )

# 3.1 ENDPOINT REGISTER COMERCIO (Dedicado)
@app.post("/api/register/comercio", status_code=status.HTTP_201_CREATED)
@limiter.limit("10/minute")
def register_comercio(
    comercio: ComercioDTO, request: Request, background_tasks: BackgroundTasks
):
    try:
        rol_asignado = "COMERCIO"
        default_password = "SRNC2026!"
        user_password = comercio.password if comercio.password else default_password
        
        # --- 1. Validaciones previas de duplicados en profiles ---
        try:
            log_secure("Verificando duplicados comercio", {"email": comercio.email, "cuit": comercio.cuit})
            
            # Verificamos email
            existing_email = supabase.table("profiles").select("id").eq("email", comercio.email).execute()
            if existing_email.data:
                logger.warning(f"Email ya registrado en profiles")
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="El correo ya se encuentra registrado"
                )
            
            # Verificamos CUIT
            existing_cuit = supabase.table("profiles").select("id").eq("dni", comercio.cuit).execute()
            if existing_cuit.data:
                logger.warning(f"CUIT ya registrado en profiles")
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="El CUIT ya se encuentra registrado"
                )
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error en validación de duplicados comercio")

        # 3.B: Crear usuario en Supabase Auth con manejo de huérfanos
        user_id = None
        try:
            log_secure("Intentando create_user para comercio", {"email": comercio.email})
            auth_response = supabase.auth.admin.create_user({
                "email": comercio.email, 
                "password": user_password, 
                "email_confirm": True,
                "user_metadata": {
                    "nombre_comercio": comercio.nombre_comercio,
                    "rol": rol_asignado
                }
            })
            user_id = auth_response.user.id
        except Exception as e:
            err_msg = str(e).lower()
            logger.warning(f"Fallo inicial en create_user comercio")
            
            if "already registered" in err_msg or "already exists" in err_msg or "422" in err_msg:
                logger.info("Detectado usuario comercio existente en Auth. Verificando huérfano...")
                
                try:
                    # 1. ¿Tiene perfil?
                    check_p = supabase.table("profiles").select("id").eq("email", comercio.email).execute()
                    if check_p.data:
                        raise HTTPException(
                            status_code=status.HTTP_400_BAD_REQUEST,
                            detail="Ya existe una cuenta de comercio con este correo."
                        )

                    # 2. Si no tiene perfil, buscamos ID para limpiar
                    user_lookup = supabase.rpc("get_user_id_by_email", {"p_email": comercio.email}).execute()
                    existing_uid = user_lookup.data
                    
                    if existing_uid:
                        logger.info(f"Limpiando huérfano comercio ID: {existing_uid}")
                        supabase.auth.admin.delete_user(existing_uid)
                        
                        # 3. Reintentar
                        auth_response = supabase.auth.admin.create_user({
                            "email": comercio.email, 
                            "password": user_password, 
                            "email_confirm": True,
                            "user_metadata": {
                                "nombre_comercio": comercio.nombre_comercio,
                                "rol": rol_asignado
                            }
                        })
                        user_id = auth_response.user.id
                        logger.info(f"Usuario comercio recreado ID: {user_id}")
                    else:
                        raise e
                except HTTPException:
                    raise
                except Exception as clean_err:
                    logger.error(f"Error limpiando huérfano comercio: {clean_err}")
                    raise e
            else:
                raise e

        profile_data = {
            "id": user_id,
            "nombre_apellido": comercio.nombre_comercio,
            "dni": comercio.cuit,
            "email": comercio.email,
            "telefono": comercio.telefono,
            "rubro": comercio.rubro,
            "municipio": comercio.municipio,
            "barrio": comercio.barrio,
            "direccion": comercio.direccion,
            "provincia": comercio.provincia or "Corrientes",
            "rol": rol_asignado,
            "estado": "PENDIENTE",
            "password_changed": False,
        }

        # ── Construir payload para tabla 'comercios' ─────────────────────────
        commerce_data = {
            "id": user_id,
            "nombre_comercio": comercio.nombre_comercio,
            "cuit": comercio.cuit,
            "rubro": comercio.rubro,
            "direccion": comercio.direccion,
            "municipio": comercio.municipio,
            "barrio": comercio.barrio,
            "telefono": comercio.telefono,
            "email": comercio.email,
        }

        try:
            log_secure("Insertando perfil de comercio", profile_data)
            supabase.table("profiles").insert(profile_data).execute()

            log_secure("Insertando datos de comercio", commerce_data)
            supabase.table("comercios").insert(commerce_data).execute()
            logger.info("[REGISTER_COMERCIO] Registro insertado exitosamente en DB")

        except Exception as profile_err:
            logger.error(
                f"[REGISTER_COMERCIO] Falla en insert DB: {type(profile_err).__name__}: {profile_err}\n"
                + traceback.format_exc()
            )
            try:
                if user_id:
                    logger.info(f"[REGISTER_COMERCIO] Rollback: eliminando user_id {user_id}")
                    supabase.auth.admin.delete_user(user_id)
            except Exception as e:
                logger.error(f"[REGISTER_COMERCIO] Error en rollback Auth: {e}")
            raise profile_err

        background_tasks.add_task(
            registrar_auditoria,
            usuario_id=user_id,
            email_usuario=comercio.email,
            rol_usuario=rol_asignado,
            accion="CREATE",
            tabla="profiles",
            registro_id=user_id,
            datos_anteriores=None,
            datos_nuevos=profile_data,
            modulo="Registro Cuentas",
            request=request,
        )

        # Notificar a los administradores
        background_tasks.add_task(
            notificar_admins_nuevo_registro,
            nombre=comercio.nombre_comercio,
            tipo_usuario="comercio",
        )

        safe_profile_comercio = {
            "id": profile_data.get("id"),
            "nombre_apellido": profile_data.get("nombre_apellido"),
            "email": profile_data.get("email"),
            "rol": profile_data.get("rol"),
            "estado": profile_data.get("estado"),
        }
        return {
            "message": "Comercio registrado correctamente. Pendiente de aprobación por Admin.",
            "socio": safe_profile_comercio,
        }

    except Exception as e:
        logger.error(
            f"[REGISTER_COMERCIO] Error interno procesando registro: "
            f"{type(e).__name__}: {e}\n{traceback.format_exc()}"
        )
        err_msg = str(e).lower()
        if (
            "user already registered" in err_msg
            or ("already exists" in err_msg and "email" in err_msg)
        ):
            friendly_detail = "Este correo electrónico ya se encuentra registrado. Podés iniciar sesión o recuperar tu contraseña."
        elif "duplicate key value" in err_msg and "cuit" in err_msg:
            friendly_detail = "El documento ingresado ya está asociado a un socio existente."
        elif "duplicate key value" in err_msg:
            friendly_detail = "Ya existe una cuenta con estos datos. Si olvidaste tu acceso, podés recuperarlo fácilmente."
        else:
            friendly_detail = "Error al procesar el registro del comercio."

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=friendly_detail
        )


# 4. ENDPOINT LOGIN (Diferenciación de DNI y Email con Auth en Supabase)
@app.post("/api/login")
@limiter.limit("5/minute")
def login(
    credentials: LoginRequest, request: Request, background_tasks: BackgroundTasks
):
    identificador_limpio = credentials.identificador.strip()
    password = credentials.password

    # 4.A IDENTIFICAR TIPO DE INGRESO
    tipo_identificacion = "unknown"
    login_email = None

    if "@" in identificador_limpio:
        tipo_identificacion = "email"
        login_email = identificador_limpio
    elif identificador_limpio.isdigit():
        tipo_identificacion = "dni"  # Numerico es DNI o CUIT

        # Si es DNI, necesitamos buscar el email en la tabla public.profiles
        try:
            response = (
                supabase.table("profiles")
                .select("email")
                .eq("dni", identificador_limpio)
                .execute()
            )
            if not response.data or len(response.data) == 0:
                raise HTTPException(
                    status_code=401, detail="Credenciales inválidas"
                )
            login_email = response.data[0]["email"]
        except Exception as e:
            if isinstance(e, HTTPException):
                raise e
            logger.error(f"Error fetching email from DNI: {e}", exc_info=True)
            raise HTTPException(status_code=401, detail="Credenciales inválidas")
    else:
        tipo_identificacion = "username"  # Alfanumérico se asume como nombre de usuario
        try:
            response = (
                supabase.table("profiles")
                .select("email")
                .eq("username", identificador_limpio)
                .execute()
            )
            if not response.data or len(response.data) == 0:
                raise HTTPException(
                    status_code=401,
                    detail="Credenciales inválidas",
                )
            login_email = response.data[0]["email"]
        except Exception as e:
            if isinstance(e, HTTPException):
                raise e
            logger.error(f"Error fetching email from username: {e}", exc_info=True)
            raise HTTPException(status_code=401, detail="Credenciales inválidas")

    if not login_email:
        raise HTTPException(status_code=401, detail="Credenciales inválidas")

    logger.info(f"Login email resolved: {login_email}")
    # 4.B: AUTENTICAR CON SUPABASE AUTH
    try:
        logger.info("Authenticating with Supabase Auth...")
        # NOTA: Para login de usuarios finales, se DEBE usar la ANON_KEY.
        # La validación de SUPABASE_ANON_KEY ya se realiza al inicio del archivo.
        auth_client = supabase_anon  # Singleton — evita crear client por cada login

        auth_session = None
        auth_user = None

        try:
            auth_response = auth_client.auth.sign_in_with_password(
                {"email": login_email, "password": password}
            )
            auth_session = auth_response.session
            auth_user = auth_response.user
        except Exception as auth_err:
            raise auth_err

        session = auth_session
        user = auth_user
        # 4.C: RECUPERAR PERFIL Y ESTADO usando el cliente global con permisos de Admin
        profile_res = supabase.table("profiles").select("*").eq("id", user.id).execute()
        if not profile_res.data:
            raise HTTPException(
                status_code=401, detail="Credenciales inválidas"
            )

        profile = profile_res.data[0]

        # Bloqueo 1: Email no verificado
        if not profile.get("email_verificado", False):
            raise HTTPException(
                status_code=403,
                detail="EMAIL_NO_VERIFICADO",
            )

        # Bloqueo 2: Estado pendiente/suspendido/rechazado
        # Solo se permite ingresar si la cuenta está en un estado activo.
        if profile.get("estado") not in ESTADOS_ACTIVOS:
            raise HTTPException(
                status_code=403,
                detail=f"CUENTA_{profile.get('estado')}",
            )

        # Bloqueo 3 (FAMILIAR): propaga el estado bloqueante del titular.
        # Si el titular tiene un estado restringido, el familiar no puede acceder.
        if profile.get("user_type") == "FAMILIAR" and profile.get("titular_id"):
            titular_res = (
                supabase.table("profiles")
                .select("id, nombre_apellido, estado")
                .eq("id", profile["titular_id"])
                .execute()
            )
            if titular_res.data:
                titular_profile = titular_res.data[0]
                if titular_profile.get("estado") in ESTADOS_BLOQUEANTES:
                    raise HTTPException(
                        status_code=403,
                        detail=MSG_TITULAR_RESTRINGIDO,
                    )

        # Validación: PRIMER LOGIN OBLIGATORIO SI USA PASS POR DEFECTO O FUE RESTABLECIDA POR ADMIN
        necesita_cambio_password = False
        default_passwords = [
            "comercio1234",
            "socio1234",
            "socio123",
            "SRNC2026!",
            "Familia1234"
        ]
        if password in default_passwords or profile.get("must_change_password") is True:
            necesita_cambio_password = True

        # Auditoría de Login para Administradores
        roles_res = (
            supabase.table("user_roles")
            .select("roles(nombre)")
            .eq("user_id", user.id)
            .execute()
        )
        user_roles_list = []
        if roles_res.data:
            for item in roles_res.data:
                role_obj = item.get("roles")
                if isinstance(role_obj, dict):
                    user_roles_list.append(role_obj.get("nombre"))
                elif isinstance(role_obj, list) and len(role_obj) > 0:
                    user_roles_list.append(role_obj[0].get("nombre"))

        profile["user_roles"] = user_roles_list

        # Si es admin de algún tipo, registrar el acceso
        if (
            profile.get("rol") == "ADMIN"
            or "SUPERADMIN" in user_roles_list
            or "ADMINISTRADOR" in user_roles_list
        ):
            background_tasks.add_task(
                registrar_auditoria,
                usuario_id=user.id,
                email_usuario=login_email,
                rol_usuario=(
                    " | ".join(user_roles_list)
                    if user_roles_list
                    else profile.get("rol")
                ),
                accion="LOGIN_ADMIN",
                tabla="auth.users",
                registro_id=user.id,
                datos_anteriores=None,
                datos_nuevos={"metodo": tipo_identificacion, "roles": user_roles_list},
                modulo="Autenticación Administrativa",
                request=request,
            )

        return {
            "message": "Login exitoso",
            "tipo_identificacion_detectado": tipo_identificacion,
            "necesita_cambio_password": necesita_cambio_password,
            "socio": profile,
            "token": session.access_token,  # JWT real de Supabase devuelto al front
            "refresh_token": session.refresh_token,  # Para renovación automática del token
        }

    except Exception as e:
        logger.error(f"Error en login [{tipo_identificacion}]: {type(e).__name__}")

        if "Invalid login credentials" in str(e):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Los datos ingresados no coinciden con nuestros registros. Verificá la información e intentá nuevamente.",
            )

        if isinstance(e, HTTPException):
            raise e

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error interno en el proceso de autenticación.",
        )


from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

# ── EMAIL VERIFICATION BACKGROUND HELPER ────────────────────────────────────
def _enviar_email_verificacion_bg(email: str, nombre: str, token: str):
    frontend_url = os.getenv("FRONTEND_URL", "https://sociedadruraldelnorte.agentech.ar")
    url = f"{frontend_url}/verificar-email?token={token}"
    enviar_email_html(
        destinatario=email,
        asunto="Verificá tu correo — Sociedad Rural Del Norte De Corrientes",
        html_body=_html_verificacion(nombre, url),
    )


# 4.1 VERIFICAR EMAIL POR TOKEN
@app.get("/api/verificar-email")
def verificar_email(token: str):
    """Valida el token de verificación de correo y marca email_verificado = true."""
    if not token:
        raise HTTPException(status_code=400, detail="Token requerido")

    res = (
        supabase.table("profiles")
        .select("id, nombre_apellido, email_verificado, email_verificacion_expira")
        .eq("email_verificacion_token", token)
        .execute()
    )

    if not res.data:
        raise HTTPException(status_code=404, detail="TOKEN_INVALIDO")

    profile = res.data[0]

    if profile.get("email_verificado"):
        return {"message": "Tu correo ya fue verificado anteriormente. Podés iniciar sesión."}

    # Verificar expiración
    expira_str = profile.get("email_verificacion_expira")
    if expira_str:
        expira = datetime.fromisoformat(expira_str.replace("Z", "+00:00"))
        if datetime.now(expira.tzinfo) > expira:
            raise HTTPException(status_code=400, detail="TOKEN_EXPIRADO")

    # Marcar verificado e invalidar el token
    supabase.table("profiles").update({
        "email_verificado": True,
        "email_verificacion_token": None,
        "email_verificacion_expira": None,
    }).eq("id", profile["id"]).execute()

    return {
        "message": "¡Correo verificado! Tu cuenta está en revisión por el administrador.",
        "nombre": profile.get("nombre_apellido"),
    }


# 4.2 REENVIAR VERIFICACIÓN
@app.post("/api/reenviar-verificacion")
@limiter.limit("3/minute")
def reenviar_verificacion(request: Request, body: dict):
    """Genera un nuevo token de verificación y reenvía el email."""
    email = (body.get("email") or "").strip().lower()
    if not email:
        raise HTTPException(status_code=400, detail="Email requerido")

    res = (
        supabase.table("profiles")
        .select("id, nombre_apellido, email_verificado")
        .eq("email", email)
        .execute()
    )

    if not res.data:
        # No revelamos si el email existe o no (seguridad)
        return {"message": "Si el correo está registrado, recibirás un nuevo enlace de verificación."}

    profile = res.data[0]

    if profile.get("email_verificado"):
        return {"message": "Tu correo ya fue verificado. Podés iniciar sesión."}

    nuevo_token  = secrets.token_urlsafe(32)
    nueva_expira = (datetime.now() + timedelta(hours=48)).isoformat()

    supabase.table("profiles").update({
        "email_verificacion_token":  nuevo_token,
        "email_verificacion_expira": nueva_expira,
    }).eq("id", profile["id"]).execute()

    _enviar_email_verificacion_bg(
        email=email,
        nombre=profile.get("nombre_apellido", ""),
        token=nuevo_token,
    )

    return {"message": "Si el correo está registrado, recibirás un nuevo enlace de verificación."}



security = HTTPBearer()


def get_current_superadmin(
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    token = credentials.credentials
    try:
        user_res = supabase.auth.get_user(token)
        if not user_res or not user_res.user:
            raise HTTPException(status_code=401, detail="Token inválido")

        roles_res = (
            supabase.table("user_roles")
            .select("roles(nombre)")
            .eq("user_id", user_res.user.id)
            .execute()
        )
        user_roles = (
            [r["roles"]["nombre"] for r in roles_res.data if r.get("roles")]
            if roles_res.data
            else []
        )

        if "SUPERADMIN" not in user_roles:
            raise HTTPException(status_code=403, detail="Requiere rol de SUPERADMIN")

        return user_res.user
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        logger.error(f"[AUTH] Error verificando permisos SUPERADMIN: {str(e)}")
        raise HTTPException(
            status_code=401, detail="No autorizado"
        )


def get_current_admin(credentials: HTTPAuthorizationCredentials = Depends(security)):
    token = credentials.credentials
    try:
        user_res = supabase.auth.get_user(token)
        if not user_res or not user_res.user:
            raise HTTPException(status_code=401, detail="Token inválido")

        profile_res = (
            supabase.table("profiles")
            .select("rol")
            .eq("id", user_res.user.id)
            .execute()
        )
        roles_res = (
            supabase.table("user_roles")
            .select("roles(nombre)")
            .eq("user_id", user_res.user.id)
            .execute()
        )
        user_roles = (
            [r["roles"]["nombre"] for r in roles_res.data if r.get("roles")]
            if roles_res.data
            else []
        )

        has_admin_role = (
            "SUPERADMIN" in user_roles
            or "ADMINISTRADOR" in user_roles
            or (profile_res.data and profile_res.data[0].get("rol") == "ADMIN")
        )

        if not has_admin_role:
            raise HTTPException(status_code=403, detail="Requiere rol de Administrador")

        return user_res.user
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        err_msg = str(e).lower()
        if "expired" in err_msg or "token expired" in err_msg:
            raise HTTPException(status_code=401, detail="Token expirado. Por favor inicia sesión nuevamente.")
        logger.error(f"Error verificando permisos de admin: {str(e)}")
        raise HTTPException(
            status_code=401, detail="Error verificando permisos de administrador."
        )


async def get_current_admin_optional(request: Request):
    """
    Versión opcional del middleware de admin.
    Si hay token válido de admin, lo retorna. Si no, retorna None sin fallar.
    Útil para endpoints mixtos (públicos/cron vs admin manual).
    """
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        return None

    token = auth_header.split(" ")[1]
    try:
        user_res = supabase.auth.get_user(token)
        if not user_res or not user_res.user:
            return None

        profile_res = (
            supabase.table("profiles")
            .select("rol")
            .eq("id", user_res.user.id)
            .execute()
        )
        roles_res = (
            supabase.table("user_roles")
            .select("roles(nombre)")
            .eq("user_id", user_res.user.id)
            .execute()
        )
        user_roles = (
            [r["roles"]["nombre"] for r in roles_res.data if r.get("roles")]
            if roles_res.data
            else []
        )

        has_admin_role = (
            "SUPERADMIN" in user_roles
            or "ADMINISTRADOR" in user_roles
            or (profile_res.data and profile_res.data[0].get("rol") == "ADMIN")
        )

        if not has_admin_role:
            return None

        return user_res.user
    except Exception:
        return None


def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    token = credentials.credentials
    try:
        user_res = supabase_anon.auth.get_user(token)
        if not user_res or not user_res.user:
            raise HTTPException(status_code=401, detail="Token inválido")
        return user_res.user
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        err_msg = str(e).lower()
        if "expired" in err_msg or "token expired" in err_msg:
            raise HTTPException(status_code=401, detail="Token expirado. Por favor inicia sesión nuevamente.")
        if "invalid" in err_msg or "malformed" in err_msg:
            raise HTTPException(status_code=401, detail="Token inválido o malformado.")
        logger.error(f"Error verificando usuario: {str(e)}")
        raise HTTPException(status_code=401, detail="Error verificando credenciales.")


def get_profile_with_titular(user_id: str) -> dict:
    """
    Retorna el perfil del usuario.
    Si el usuario es FAMILIAR, incluye también el perfil de su titular bajo la
    clave 'titular_perfil'. Usado internamente para validar propagación de estado.
    """
    res = (
        supabase.table("profiles")
        .select(
            "id, nombre_apellido, estado, rol, user_type, titular_id, tipo_vinculo, es_empleado_comercial, "
            "perfiles_titulares:profiles!titular_id(id, nombre_apellido, estado)"
        )
        .eq("id", user_id)
        .execute()
    )
    if not res.data:
        raise HTTPException(status_code=404, detail="Perfil no encontrado")
    return res.data[0]


def require_titular(current_user=Depends(get_current_user)):
    """
    Dependencia que bloquea el acceso a endpoints financieros para integrantes
    familiares (user_type == 'FAMILIAR').
    Solo el socio titular puede ejecutar pagos.
    """
    perfil = get_profile_with_titular(current_user.id)
    if perfil.get("user_type") == "FAMILIAR":
        is_empleado = perfil.get("tipo_vinculo") in ["Empleado", "Encargado"] or perfil.get("es_empleado_comercial")
        if not is_empleado:
            raise HTTPException(
                status_code=403,
                detail="Los integrantes de grupo familiar no pueden realizar pagos. "
                       "El socio titular es el único habilitado para gestionar cuotas."
            )
    return current_user



# 4.4 LISTADO DE MUNICIPIOS (DINÁMICO DESDE DB)
@app.get("/api/municipios")
@limiter.limit("60/minute")
def get_municipios(request: Request):
    """Retorna la lista de localidades/municipios activos desde la base de datos."""
    try:
        # Consultamos la tabla municipios filtrando por activo = true
        res = (
            supabase.table("municipios")
            .select("id, nombre")
            .eq("activo", True)
            .order("nombre")
            .execute()
        )
        return {"municipios": res.data or []}
    except Exception as e:
        logger.error(f"Error cargando municipios: {str(e)}")
        raise HTTPException(status_code=500, detail="Error interno al cargar municipios")


# ── ENDPOINT PÚBLICO: listar comercios adheridos ─────────────────────────────
@app.get("/api/comercios")
@limiter.limit("60/minute")
def listar_comercios(request: Request, rubro: Optional[str] = None, municipio: Optional[str] = None):
    """Retorna la lista de comercios aprobados, filtrable por rubro o municipio."""
    try:
        query = (
            supabase.table("profiles")
            .select("id, nombre_apellido, rubro, municipio, telefono, email")
            .eq("rol", "COMERCIO")
            .eq("estado", "APROBADO")
            .order("nombre_apellido")
        )
        if rubro:
            query = query.eq("rubro", rubro)
        if municipio:
            query = query.eq("municipio", municipio)
        result = query.execute()
        return {"comercios": result.data}
    except Exception as e:
        raise HTTPException(status_code=500, detail="Error interno del servidor")


# ── ENDPOINTS PARA QR DINÁMICO ────────────────────────────────────────────────


class QRTokenValidarRequest(BaseModel):
    token: str


@app.post("/api/qr/generar")
def generar_qr(request: Request):
    """
    Genera un token QR dinámico con un tiempo de vida de 60 segundos.
    """
    if not ENABLE_DYNAMIC_QR:
        raise HTTPException(status_code=403, detail="Dynamic QR is disabled.")

    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Token no proporcionado")

    token = auth_header.split(" ")[1]

    try:
        user_response = supabase.auth.get_user(token)
        if not user_response or not user_response.user:
            raise HTTPException(status_code=401, detail="Usuario no autenticado")
    except Exception:
        raise HTTPException(status_code=401, detail="Token inválido o expirado.")

    user_id = user_response.user.id
    new_token_str = str(uuid4())
    expires_at = (datetime.now(pytz.utc) + timedelta(seconds=60)).isoformat()

    try:
        supabase.table("qr_tokens").insert(
            {
                "user_id": user_id,
                "token": new_token_str,
                "expires_at": expires_at,
                "used": False,
            }
        ).execute()
    except Exception as e:
        raise HTTPException(
            status_code=500, detail="Error interno del servidor"
        )

    return {"token": new_token_str, "expires_at": expires_at}


@app.post("/api/qr/validar")
async def validar_qr_dinamico(request: Request):
    """
    Verifica un token QR dinámico escaneado por el Comercio.
    [LOGGING TEMPORAL DE AUDITORÍA AÑADIDO]
    """
    logger.info("--- INICIO AUDITORIA QR ---")
    
    # 1. Log headers y raw body
    headers = dict(request.headers)
    logger.info(f"[QR AUDIT] Headers recibidos: {headers}")
    
    try:
        raw_body = await request.body()
        logger.info(f"[QR AUDIT] Raw body recibido: {raw_body.decode('utf-8')}")
    except Exception as e:
        logger.error(f"[QR AUDIT] Error leyendo raw body: {e}")
        raise HTTPException(status_code=400, detail="No se pudo leer el body")
        
    # 2. Parse manual para auditar fallos
    try:
        json_data = await request.json()
        logger.info(f"[QR AUDIT] JSON parseado: {json_data}")
        token = json_data.get("token")
        if not token:
            logger.error("[QR AUDIT] Falta el campo 'token' en el JSON")
            raise HTTPException(status_code=400, detail="Falta el token")
    except Exception as e:
        if isinstance(e, HTTPException): raise e
        logger.error(f"[QR AUDIT] Error parseando JSON: {e}")
        raise HTTPException(status_code=400, detail="JSON inválido")

    if not ENABLE_DYNAMIC_QR:
        raise HTTPException(status_code=403, detail="Dynamic QR is disabled.")

    try:
        # 3. Buscamos el token
        logger.info(f"[QR AUDIT] Buscando token en BD: {token}")
        result = (
            supabase.table("qr_tokens").select("*").eq("token", token).execute()
        )
        if not result.data:
            logger.warning("[QR AUDIT] Token NO encontrado en BD (retorna 404)")
            raise HTTPException(
                status_code=404, detail="El código QR es inválido o no existe."
            )

        qr_data = result.data[0]

        # 2. Verificamos si fue usado
        if qr_data.get("used"):
            raise HTTPException(
                status_code=400,
                detail="Este código QR ya fue utilizado. Pida al socio que genere uno nuevo.",
            )

        # 3. Verificamos expiración
        expires_at_str = qr_data.get("expires_at")
        expires_at_dt = datetime.fromisoformat(expires_at_str)
        if datetime.now(pytz.utc) > expires_at_dt:
            raise HTTPException(
                status_code=400,
                detail="Este código QR ha expirado. Pida al socio que genere uno nuevo.",
            )

        # 4. Marcamos como usado
        supabase.table("qr_tokens").update({"used": True}).eq(
            "id", qr_data["id"]
        ).execute()

        # 5. Pasamos a validar al socio
        socio_id = qr_data["user_id"]

        res = (
            supabase.table("profiles")
            .select(
                "id, nombre_apellido, dni, rol, estado, estado_financiero, municipio, numero_socio, titular_id, tipo_vinculo, perfiles_titulares:profiles!titular_id(nombre_apellido, estado)"
            )
            .eq("id", socio_id)
            .execute()
        )

        if not res.data:
            raise HTTPException(status_code=404, detail="Usuario no encontrado.")

        perfil = res.data[0]

        # Roles válidos para presentar pasaporte QR.
        # Se aceptan todos los tipos de socio registrados en el sistema.
        ROLES_VALIDOS_QR = {"SOCIO", "COMERCIO", "PROFESIONAL", "FAMILIAR", "ESTUDIANTE"}
        rol_perfil = str(perfil.get("rol") or "").upper()
        if rol_perfil not in ROLES_VALIDOS_QR:
            raise HTTPException(
                status_code=400,
                detail="El código QR no pertenece a un Socio válido.",
            )

        es_activo = perfil["estado"] == "APROBADO"
        mensaje = (
            "✅ Socio Activo. Apto para recibir beneficios."
            if es_activo
            else f"❌ Usuario inactivo o estado pendiente ({perfil['estado']})."
        )
        
        # FASE 6: Autoridad Parcial de estado_financiero en QR (controlada por Feature Flag)
        ENABLE_NEW_QR_BLOCKING = os.environ.get("ENABLE_NEW_QR_BLOCKING", "false").lower() == "true"
        
        if ENABLE_NEW_QR_BLOCKING and perfil.get("estado_financiero"):
            if perfil["estado_financiero"] == "EN_MORA":
                es_activo = False
                mensaje = "❌ Carnet Suspendido por Mora (>40 días)."
            elif perfil["estado_financiero"] == "VENCIDO":
                mensaje = "✅ Socio Activo (Periodo de gracia - Cuota Vencida)."
            elif perfil["estado_financiero"] == "ACTIVO" and perfil["estado"] == "APROBADO":
                es_activo = True
                mensaje = "✅ Socio Activo. Apto para recibir beneficios."

        titular = perfil.get("perfiles_titulares")
        if titular:
            titular_valido = titular.get("estado") == "APROBADO"
            if not titular_valido:
                es_activo = False
                mensaje = f"❌ El titular de este usuario ({titular.get('nombre_apellido')}) está en estado {titular.get('estado')}."

        return {"valido": es_activo, "mensaje": mensaje, "socio": perfil}
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail="Error interno del servidor")


# ── ENDPOINT CHATBOT ESPECIALIZADO ──────────────────────────────────────────
from chat_service import chat_service
import asyncio


async def delete_chat_image(path: str):
    """Borra una imagen del storage después de ser procesada por la IA"""
    try:
        # Esperar unos segundos para asegurar que OpenAI terminó de descargarla
        await asyncio.sleep(10)
        supabase.storage.from_("chat-images").remove([path])
        logger.info(f"Imagen temporal borrada: {path}")
    except Exception as e:
        logger.error(f"Error borrando imagen temporal {path}: {e}")


@app.post("/api/chat/upload-image")
async def upload_chat_image(
    file: UploadFile = File(...), current_user=Depends(get_current_user)
):
    """Sube una imagen temporal para que la IA la analice"""
    try:
        file_content = await file.read()
        file_ext = file.filename.split(".")[-1]
        # Ruta temporal con prefijo 'temp_'
        path = f"temp_{current_user.id}_{uuid4().hex}.{file_ext}"

        supabase.storage.from_("chat-images").upload(
            path=path,
            file=file_content,
            file_options={"content-type": file.content_type, "upsert": "true"},
        )

        # URL Pública (asumiendo que el bucket es público para que OpenAI la vea)
        image_url = f"{SUPABASE_URL}/storage/v1/object/public/chat-images/{path}"

        return {"image_url": image_url, "path": path}
    except Exception as e:
        logger.error(f"Error en endpoint upload_chat_image: {str(e)}")
        logger.error(f"Error subiendo imagen a Supabase Storage: {str(e)}")
        raise HTTPException(
            status_code=500, detail="Error interno del servidor"
        )


@app.post("/api/chat")
async def chat_with_assistant(
    data: ChatRequest,
    background_tasks: BackgroundTasks,
    user: Any = Depends(get_current_user),
):
    """
    Endpoint para chatear con el asistente virtual especializado.
    Mantiene historial por usuario en la base de datos.
    """
    user_id = user.id

    try:
        # 1. Recuperar historial previo (últimos 20 mensajes)
        history_res = (
            supabase.table("chat_history")
            .select("role, content, metadata")
            .eq("user_id", user_id)
            .order("created_at", desc=True)
            .limit(20)
            .execute()
        )

        # Invertir para que estén en orden cronológico
        history = history_res.data[::-1] if history_res.data else []

        # 2. Obtener respuesta de la IA (puede lanzar RuntimeError con mensaje descriptivo)
        try:
            assistant_response = await chat_service.get_response(
                history=history, user_message=data.message, image_url=data.image_url
            )
        except RuntimeError as ia_err:
            # Error conocido del servicio de IA – retornar 503 con mensaje legible
            logger.warning(f"[/api/chat] Error de servicio IA para user {user_id}: {ia_err}")
            raise HTTPException(status_code=503, detail=str(ia_err))

        # 3. Guardar en historial (Mensaje del Usuario)
        supabase.table("chat_history").insert(
            {
                "user_id": user_id,
                "role": "user",
                "content": data.message,
                "metadata": {
                    "mode": data.mode,
                    "has_image": data.image_url is not None,
                    "image_url": data.image_url,
                },
            }
        ).execute()

        # 4. Guardar en historial (Respuesta del Asistente)
        supabase.table("chat_history").insert(
            {"user_id": user_id, "role": "assistant", "content": assistant_response}
        ).execute()

        # 5. Si hay imagen, NO programar su borrado automático para permitir diagnóstico guiado
        # if data.image_url and "chat-images" in data.image_url:
        #     path_coords = data.image_url.split("/")[-1]
        #     background_tasks.add_task(delete_chat_image, path_coords)

        logger.info(f"[/api/chat] Respuesta enviada al usuario {user_id}")
        return {"response": assistant_response, "history_count": len(history) + 2}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[/api/chat] Error inesperado para user {user_id}: {type(e).__name__}: {e}")
        raise HTTPException(
            status_code=500, detail="Error interno procesando la solicitud de chat."
        )


class ChatbotSoporteRequest(BaseModel):
    dispositivo: Optional[str] = None
    version_app: Optional[str] = None

@app.post("/api/chatbot/soporte")
@limiter.limit("2/minute")
async def create_chatbot_soporte_ticket(
    request: Request,
    data: ChatbotSoporteRequest,
    current_user=Depends(get_current_user)
):
    """Crea un ticket de soporte iniciado desde el Chatbot"""
    try:
        supabase.table("notificaciones").insert({
            "usuario_id": current_user.id,
            "tipo": "SOPORTE_TECNICO",
            "mensaje": "Solicitud de soporte técnico iniciada desde SapucAI",
            "estado": "PENDIENTE",
            "origen_soporte": "chatbot",
            "dispositivo": data.dispositivo,
            "version_app": data.version_app,
            "whatsapp_redirected": False
        }).execute()
        
        return {"success": True, "message": "Ticket creado exitosamente."}
    except Exception as e:
        logger.error(f"Error creando ticket chatbot soporte para {current_user.id}: {e}")
        raise HTTPException(status_code=500, detail="Error interno al crear el ticket.")


# ── ENDPOINT PARA VALIDAR CARNET DE SOCIO DESDE QR ────────────────────────────
@app.get("/api/valida-socio/{socio_id}")
@limiter.limit("60/minute")
def valida_socio(socio_id: str, request: Request):
    if ENABLE_DYNAMIC_QR:
        raise HTTPException(
            status_code=400,
            detail="Los códigos QR estáticos ya no están activos por seguridad. Por favor solicite al socio generar un nuevo QR Dinámico desde su app.",
        )
    """
    Recibe el ID del socio (codificado en el QR) y devuelve su estado de validación.
    Los Comercios llamarán a este endpoint cuando escaneen el Carnet del Socio.
    """
    try:
        # Buscamos al perfil y opcionalmente a su titular
        result = (
            supabase.table("profiles")
            .select(
                "id, nombre_apellido, dni, rol, estado, municipio, titular_id, tipo_vinculo, perfiles_titulares:profiles!titular_id(nombre_apellido, estado)"
            )
            .eq("id", socio_id)
            .execute()
        )

        if not result.data:
            raise HTTPException(
                status_code=404,
                detail="El código QR no pertenece a un usuario registrado válido.",
            )

        perfil = result.data[0]

        # Titular o empleado?
        if perfil["rol"] not in ["SOCIO", "COMERCIO"]:
            raise HTTPException(
                status_code=400,
                detail="El código QR no pertenece a un Socio o Comercio válido.",
            )

        es_activo = perfil["estado"] == "APROBADO"
        mensaje = (
            "✅ Socio Activo. Apto para recibir beneficios."
            if es_activo
            else f"❌ Usuario inactivo o estado pendiente ({perfil['estado']})."
        )

        titular = perfil.get("perfiles_titulares")
        if titular:
            titular_valido = titular.get("estado") == "APROBADO"
            if not titular_valido:
                es_activo = False
                mensaje = f"❌ El titular de este usuario ({titular.get('nombre_apellido')}) está en estado {titular.get('estado')}."
            else:
                vinculo = perfil.get("tipo_vinculo", "Adherente").capitalize()
                mensaje = (
                    f"✅ {vinculo} Activo. Titular: {titular.get('nombre_apellido')}."
                )

        return {
            "valido": es_activo,
            "socio": {
                "id": perfil["id"],
                "nombre_apellido": perfil["nombre_apellido"],
                "dni": perfil["dni"],
                "estado": perfil["estado"],
                "municipio": perfil["municipio"],
                "rol": perfil["rol"],
                "tipo_vinculo": perfil.get("tipo_vinculo"),
                "titular_id": perfil.get("titular_id"),
            },
            "mensaje": mensaje,
        }

    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail="Error interno del servidor")


@app.post("/api/change-password")
def change_password(
    req: ChangePasswordRequest,
    request: Request,
    background_tasks: BackgroundTasks,
    current_user=Depends(get_current_user),
):
    try:
        if len(req.new_password) < 6:
            raise HTTPException(
                status_code=400, detail="La contraseña debe tener al menos 6 caracteres"
            )

        # Actualizar contraseña en Auth usando modo Admin ya que tenemos la Service Role key
        supabase.auth.admin.update_user_by_id(
            current_user.id, {"password": req.new_password}
        )

        # Marcar en profile como password_changed = True
        supabase.table("profiles").update({
            "password_changed": True,
            "must_change_password": False
        }).eq("id", current_user.id).execute()

        # Auditoría
        background_tasks.add_task(
            registrar_auditoria,
            usuario_id=current_user.id,
            email_usuario=current_user.email,
            rol_usuario=None,
            accion="UPDATE",
            tabla="profiles",
            registro_id=current_user.id,
            datos_anteriores=None,
            datos_nuevos={"password_changed": True},
            modulo="Seguridad",
            request=request,
        )

        return {"message": "Contraseña actualizada correctamente"}
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(
            status_code=500, detail="Error interno del servidor"
        )


# ── GESTIÓN DE ADMINISTRADORES (SOLO SUPERADMIN) ─────────────────────────
@app.get("/api/admin/administradores")
def get_all_administradores(superadmin_user=Depends(get_current_superadmin)):
    try:
        # Obtenemos usuarios que tengan rol en user_roles con nombre 'SUPERADMIN' o 'ADMINISTRADOR'
        # Hacemos join directo usando la relación en supabase
        res = (
            supabase.table("user_roles")
            .select(
                "user_id, roles!inner(nombre), profiles!inner(id, username, email, nombre_apellido, dni, rol, estado, created_at)"
            )
            .in_("roles.nombre", ["SUPERADMIN", "ADMINISTRADOR"])
            .execute()
        )

        # Agrupar por usuario ya que pueden tener multipes roles en user_roles si algo fallo, pero solo nos importa mostrar uno o la lista
        users = {}
        for item in res.data or []:
            uid = item["user_id"]
            if uid not in users:
                users[uid] = item["profiles"]
                users[uid]["user_roles"] = []

            users[uid]["user_roles"].append(item["roles"]["nombre"])

        return {"administradores": list(users.values())}
    except Exception as e:
        raise HTTPException(status_code=500, detail="Error interno del servidor")


@app.post("/api/admin/administradores")
def create_administrador(
    req: CreateAdminRequest,
    request: Request,
    background_tasks: BackgroundTasks,
    superadmin_user=Depends(get_current_superadmin),
):
    try:
        rol_asignar = req.rol.upper()
        if rol_asignar not in ["SUPERADMIN", "ADMINISTRADOR"]:
            raise HTTPException(status_code=400, detail="Rol inválido")

        # Get Role IDs
        roles_res = supabase.table("roles").select("*").execute()
        roles_map = {r["nombre"]: r["id"] for r in roles_res.data}

        # Validar Username unico
        existing = (
            supabase.table("profiles")
            .select("id")
            .eq("username", req.username)
            .execute()
        )
        if existing.data:
            raise HTTPException(
                status_code=400, detail="El nombre de usuario ya existe"
            )

        # 1. Crear en Auth
        try:
            auth_res = supabase.auth.admin.create_user(
                {"email": req.email, "password": req.password, "email_confirm": True}
            )
            user_id = auth_res.user.id
        except Exception as e:
            if (
                "already registered" in str(e).lower()
                or "already exists" in str(e).lower()
            ):
                raise HTTPException(
                    status_code=400, detail="El correo electrónico ya está registrado"
                )
            raise HTTPException(status_code=500, detail="Error interno del servidor")

        # 2. Crear Perfil
        profile_data = {
            "id": user_id,
            "username": req.username,
            "dni": req.dni,
            "email": req.email,
            "nombre_apellido": req.nombre_apellido,
            "rol": "ADMIN",  # Rol base retrocompatible
            "estado": "APROBADO",
            "password_changed": True,
        }

        try:
            supabase.table("profiles").insert(profile_data).execute()
        except Exception as e:
            supabase.auth.admin.delete_user(user_id)
            raise HTTPException(
                status_code=500, detail="Error interno del servidor"
            )

        # 3. Asignar Roles
        try:
            # Rol admin solicitado
            supabase.table("user_roles").insert(
                {"user_id": user_id, "role_id": roles_map[rol_asignar]}
            ).execute()
            # Todos los admins también son SOCIOS
            supabase.table("user_roles").insert(
                {"user_id": user_id, "role_id": roles_map["SOCIO"]}
            ).execute()
        except Exception as e:
            logger.error(f"Error: {e}")
            pass  # Si falla no revertimos todo, quizas solo el rol. Lo dejamos así.

        background_tasks.add_task(
            registrar_auditoria,
            usuario_id=superadmin_user.id,
            email_usuario=superadmin_user.email,
            rol_usuario="SUPERADMIN",
            accion="CREATE_ADMIN",
            tabla="auth.users",
            registro_id=user_id,
            datos_anteriores=None,
            datos_nuevos=profile_data,
            modulo="Gestión de Administradores",
            request=request,
        )

        return {"message": "Administrador creado exitosamente"}
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(status_code=500, detail="Error interno del servidor")


@app.put("/api/admin/administradores/{user_id}/role")
def update_administrador_role(
    user_id: str,
    req: UpdateAdminRoleRequest,
    request: Request,
    background_tasks: BackgroundTasks,
    superadmin_user=Depends(get_current_superadmin),
):
    try:
        if user_id == superadmin_user.id and req.rol.upper() != "SUPERADMIN":
            raise HTTPException(
                status_code=400, detail="No puedes degradar tu propio rol de Superadmin"
            )

        rol_asignar = req.rol.upper()
        if rol_asignar not in ["SUPERADMIN", "ADMINISTRADOR"]:
            raise HTTPException(status_code=400, detail="Rol inválido")

        # Get Role IDs
        roles_res = supabase.table("roles").select("*").execute()
        roles_map = {r["nombre"]: r["id"] for r in roles_res.data}
        target_role_id = roles_map.get(rol_asignar)
        if not target_role_id:
            raise HTTPException(
                status_code=500, detail="Rol no encontrado en la base de datos"
            )

        # Fetch current roles for audit and validation
        current_user_roles_res = (
            supabase.table("user_roles")
            .select("roles(nombre), role_id")
            .eq("user_id", user_id)
            .in_("roles.nombre", ["SUPERADMIN", "ADMINISTRADOR"])
            .execute()
        )
        current_admin_roles = [
            r["roles"]["nombre"] for r in current_user_roles_res.data if r.get("roles")
        ]
        current_admin_role_ids = [r["role_id"] for r in current_user_roles_res.data]

        if not current_admin_roles:
            raise HTTPException(
                status_code=404, detail="Usuario no es un administrador existente"
            )

        # Determine previous role for audit
        previous_role = (
            "ADMINISTRADOR" if "ADMINISTRADOR" in current_admin_roles else "SUPERADMIN"
        )

        # Remove existing admin roles
        for role_id_to_remove in current_admin_role_ids:
            supabase.table("user_roles").delete().eq("user_id", user_id).eq(
                "role_id", role_id_to_remove
            ).execute()

        # Assign new role
        supabase.table("user_roles").insert(
            {"user_id": user_id, "role_id": target_role_id}
        ).execute()

        background_tasks.add_task(
            registrar_auditoria,
            usuario_id=superadmin_user.id,
            email_usuario=superadmin_user.email,
            rol_usuario="SUPERADMIN",
            accion="UPDATE_ADMIN_ROLE",
            tabla="user_roles",
            registro_id=user_id,
            datos_anteriores={"rol": previous_role},
            datos_nuevos={"rol": rol_asignar},
            modulo="Gestión de Administradores",
            request=request,
        )

        return {"message": f"Rol de administrador actualizado a {rol_asignar}"}
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(status_code=500, detail="Error interno del servidor")


@app.delete("/api/admin/administradores/{user_id}")
def delete_administrador(
    user_id: str,
    request: Request,
    background_tasks: BackgroundTasks,
    superadmin_user=Depends(get_current_superadmin),
):
    try:
        # Prevent self-deletion
        if user_id == superadmin_user.id:
            raise HTTPException(
                status_code=400, detail="No puede eliminarse a sí mismo"
            )

        # Fetch profile for audit
        prof_res = supabase.table("profiles").select("*").eq("id", user_id).execute()
        if not prof_res.data:
            raise HTTPException(status_code=404, detail="Administrador no encontrado")

        # Delete from Auth (Cascade)
        supabase.auth.admin.delete_user(user_id)

        background_tasks.add_task(
            registrar_auditoria,
            usuario_id=superadmin_user.id,
            email_usuario=superadmin_user.email,
            rol_usuario="SUPERADMIN",
            accion="DELETE_ADMIN",
            tabla="auth.users",
            registro_id=user_id,
            datos_anteriores=prof_res.data[0],
            datos_nuevos=None,
            modulo="Gestión de Administradores",
            request=request,
        )
        return {"message": "Administrador eliminado permanentemente"}
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(status_code=500, detail="Error interno del servidor")


# 5. ENDPOINT ADMIN: LISTAR PENDIENTES
@app.get("/api/admin/users/pending")
def get_pending_users(
    limit: int = Query(default=50, le=100),
    offset: int = Query(default=0, ge=0),
    admin_user=Depends(get_current_admin),
):
    try:
        response = (
            supabase.table("profiles")
            .select("*")
            .eq("estado", "PENDIENTE")
            .range(offset, offset + limit - 1)
            .execute()
        )
        return {"users": response.data}
    except Exception as e:
        raise HTTPException(status_code=500, detail="Error interno del servidor")


# 6. ENDPOINTS ADMIN: APROBAR / RECHAZAR USUARIO
@app.post("/api/admin/users/{user_id}/approve")
def approve_user(
    user_id: str,
    request: Request,
    background_tasks: BackgroundTasks,
    admin_user=Depends(get_current_admin),
):
    try:
        # Validar UUID para prevenir errores de base de datos
        try:
            uuid.UUID(user_id)
        except ValueError:
            raise HTTPException(
                status_code=400, detail="ID de usuario inválido (No es UUID)"
            )

        res = (
            supabase.table("profiles")
            .update({"estado": "APROBADO"})
            .eq("id", user_id)
            .execute()
        )
        if not res.data:
            raise HTTPException(status_code=404, detail="Usuario no encontrado")

        # Recuperar email y nombre del usuario para el email de notificación
        usuario_aprobado = res.data[0] if res.data else {}

        background_tasks.add_task(
            registrar_auditoria,
            usuario_id=admin_user.id,
            email_usuario=admin_user.email,
            rol_usuario="ADMIN",
            accion="APPROVE",
            tabla="profiles",
            registro_id=user_id,
            datos_anteriores={"estado": "PENDIENTE"},
            datos_nuevos={"estado": "APROBADO"},
            modulo="Gestión Usuarios",
            request=request,
        )

        # Email de aprobación (best-effort)
        if usuario_aprobado.get("email"):
            frontend_url = os.getenv("FRONTEND_URL", "https://sociedadruraldelnorte.agentech.ar")
            background_tasks.add_task(
                enviar_email_html,
                destinatario=usuario_aprobado["email"],
                asunto="¡Tu cuenta fue aprobada! — Sociedad Rural Del Norte De Corrientes",
                html_body=_html_aprobacion(
                    nombre=usuario_aprobado.get("nombre_apellido", ""),
                    login_url=f"{frontend_url}/login",
                ),
            )

        return {"message": "Usuario aprobado correctamente"}
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail="Error interno del servidor")


@app.post("/api/admin/users/{user_id}/reject")
def reject_user(
    user_id: str,
    request: Request,
    background_tasks: BackgroundTasks,
    admin_user=Depends(get_current_admin),
):
    try:
        # Validar UUID para prevenir errores de base de datos
        try:
            uuid.UUID(user_id)
        except ValueError:
            raise HTTPException(
                status_code=400, detail="ID de usuario inválido (No es UUID)"
            )

        res = (
            supabase.table("profiles")
            .update({"estado": "RECHAZADO"})
            .eq("id", user_id)
            .execute()
        )
        if not res.data:
            raise HTTPException(status_code=404, detail="Usuario no encontrado")

        background_tasks.add_task(
            registrar_auditoria,
            usuario_id=admin_user.id,
            email_usuario=admin_user.email,
            rol_usuario="ADMIN",
            accion="REJECT",
            tabla="profiles",
            registro_id=user_id,
            datos_anteriores={"estado": "PENDIENTE"},
            datos_nuevos={"estado": "RECHAZADO"},
            modulo="Gestión Usuarios",
            request=request,
        )
        return {"message": "Usuario rechazado correctamente"}
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail="Error interno del servidor")


# 6.B ENDPOINTS ADMIN OPTIMIZADOS (SPEC)


@app.get("/api/admin/users")
def get_all_users(
    limit: int = Query(default=50, le=100),
    offset: int = Query(default=0, ge=0),
    admin_user=Depends(get_current_admin),
):
    """Retorna todos los usuarios del sistema para la tabla de gestión"""
    try:
        response = (
            supabase.table("profiles")
            .select("*")
            .order("created_at", desc=True)
            .range(offset, offset + limit - 1)
            .execute()
        )
        return {"users": response.data}
    except Exception as e:
        raise HTTPException(status_code=500, detail="Error interno del servidor")


class UpdateUserStatusRequest(BaseModel):
    estado: str  # Valores válidos definidos en ESTADOS_VALIDOS

    @validator('estado')
    def validate_estado(cls, v):
        if v not in ESTADOS_VALIDOS:
            raise ValueError(f"Estado inválido: {v}. Valores permitidos: {', '.join(sorted(ESTADOS_VALIDOS))}")
        return v



@app.put("/api/admin/users/{user_id}/status")
def update_user_status(
    user_id: str,
    req: UpdateUserStatusRequest,
    request: Request,
    background_tasks: BackgroundTasks,
    admin_user=Depends(get_current_admin),
):
    """Suspende o reactiva un usuario"""
    try:
        # Validar UUID para prevenir errores de base de datos
        try:
            uuid.UUID(user_id)
        except ValueError:
            raise HTTPException(
                status_code=400,
                detail="ID de usuario inválido formatualmente (No es UUID)",
            )

        perfil_ant = (
            supabase.table("profiles").select("estado").eq("id", user_id).execute()
        )
        datos_anteriores = perfil_ant.data[0] if perfil_ant.data else None

        res = (
            supabase.table("profiles")
            .update({"estado": req.estado})
            .eq("id", user_id)
            .execute()
        )
        if not res.data:
            raise HTTPException(status_code=404, detail="Usuario no encontrado")

        background_tasks.add_task(
            registrar_auditoria,
            usuario_id=admin_user.id,
            email_usuario=admin_user.email,
            rol_usuario="ADMIN",
            accion="UPDATE",
            tabla="profiles",
            registro_id=user_id,
            datos_anteriores=datos_anteriores,
            datos_nuevos={"estado": req.estado},
            modulo="Gestión Usuarios",
            request=request,
        )
        return {"message": f"Estado actualizado a {req.estado}", "user": res.data[0]}
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(
            status_code=500, detail="Error interno del servidor"
        )

class UpdateGraciaRequest(BaseModel):
    dias_gracia: int
    motivo: str = "Extensión manual administrativa"

@app.put("/api/v1/admin/users/{user_id}/gracia")
def extender_gracia_usuario(
    user_id: str,
    req: UpdateGraciaRequest,
    request: Request,
    background_tasks: BackgroundTasks,
    admin_user=Depends(get_current_admin),
):
    """
    FASE 6: Endpoint para extender manualmente la gracia de un usuario en mora
    o rehabilitarlo temporalmente (Buffer Administrativo).
    """
    try:
        try:
            uuid.UUID(user_id)
        except ValueError:
            raise HTTPException(status_code=400, detail="ID inválido")

        nueva_fecha = datetime.now() + timedelta(days=req.dias_gracia)
        
        perfil_ant = supabase.table("profiles").select("gracia_extendida_hasta").eq("id", user_id).execute()
        datos_anteriores = perfil_ant.data[0] if perfil_ant.data else None

        res = supabase.table("profiles").update({
            "gracia_extendida_hasta": nueva_fecha.isoformat()
        }).eq("id", user_id).execute()

        if not res.data:
            raise HTTPException(status_code=404, detail="Usuario no encontrado")

        background_tasks.add_task(
            registrar_auditoria,
            usuario_id=admin_user.id,
            email_usuario=admin_user.email,
            rol_usuario="ADMIN",
            accion="UPDATE",
            tabla="profiles",
            registro_id=user_id,
            datos_anteriores=datos_anteriores,
            datos_nuevos={"gracia_extendida_hasta": nueva_fecha.isoformat(), "motivo": req.motivo},
            modulo="Extensión Gracia",
            request=request,
        )

        return {"mensaje": f"Gracia extendida por {req.dias_gracia} días", "hasta": nueva_fecha.isoformat()}
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail=str(e))



class UpdateUserRequest(BaseModel):
    nombre_apellido: Optional[str] = None
    telefono: Optional[str] = None
    municipio: Optional[str] = None
    rubro: Optional[str] = None
    email: Optional[str] = None


@app.put("/api/admin/users/{user_id}")
def update_user_details(
    user_id: str,
    req: UpdateUserRequest,
    request: Request,
    background_tasks: BackgroundTasks,
    admin_user=Depends(get_current_admin),
):
    """Edita información básica del perfil desde el dashboard admin"""
    if req.telefono:
        req.telefono = sanitizar_y_validar_telefono(req.telefono)
    try:
        # Validar UUID para prevenir errores de base de datos
        try:
            uuid.UUID(user_id)
        except ValueError:
            raise HTTPException(
                status_code=400, detail="ID de usuario inválido (No es UUID)"
            )

        update_data = req.dict(exclude_unset=True)
        if not update_data:
            return {"message": "Sin cambios"}

        perfil_ant = supabase.table("profiles").select("*").eq("id", user_id).execute()
        datos_anteriores = perfil_ant.data[0] if perfil_ant.data else None

        res = supabase.table("profiles").update(update_data).eq("id", user_id).execute()
        if not res.data:
            raise HTTPException(status_code=404, detail="Usuario no encontrado")

        background_tasks.add_task(
            registrar_auditoria,
            usuario_id=admin_user.id,
            email_usuario=admin_user.email,
            rol_usuario="ADMIN",
            accion="UPDATE",
            tabla="profiles",
            registro_id=user_id,
            datos_anteriores=datos_anteriores,
            datos_nuevos=update_data,
            modulo="Gestión Usuarios",
            request=request,
        )
        return {"message": "Usuario actualizado", "user": res.data[0]}
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(
            status_code=500, detail="Error interno del servidor"
        )


@app.delete("/api/admin/users/{user_id}")
def delete_user(
    user_id: str,
    request: Request,
    background_tasks: BackgroundTasks,
    admin_user=Depends(get_current_admin),
):
    """Elimina un usuario (y su perfil asociado) desde el dashboard admin"""
    try:
        # Validar UUID
        try:
            uuid.UUID(user_id)
        except ValueError:
            raise HTTPException(
                status_code=400, detail="ID de usuario inválido (No es UUID)"
            )

        if user_id == admin_user.id:
            raise HTTPException(
                status_code=400, detail="No puedes eliminar tu propia cuenta"
            )

        perfil_ant = supabase.table("profiles").select("*").eq("id", user_id).execute()
        datos_anteriores = perfil_ant.data[0] if perfil_ant.data else None

        # Eliminar el usuario en Supabase Auth
        # Esto debería disparar la eliminación en cascada si la base de datos está configurada así.
        # Si no, de todas formas lo borramos de Auth para revocar acceso.
        supabase.auth.admin.delete_user(user_id)

        # Intentamos borrar el profile explícitamente por si no hay On Delete Cascade.
        # Si falla porque no existe (ya se borró por cascada), lo ignoramos.
        try:
            supabase.table("profiles").delete().eq("id", user_id).execute()
        except Exception as e:
            logger.error(f"Error: {e}")
            pass

        background_tasks.add_task(
            registrar_auditoria,
            usuario_id=admin_user.id,
            email_usuario=admin_user.email,
            rol_usuario="ADMIN",
            accion="DELETE",
            tabla="auth.users / profiles",
            registro_id=user_id,
            datos_anteriores=datos_anteriores,
            datos_nuevos=None,
            modulo="Gestión Usuarios",
            request=request,
        )
        return {"message": "Usuario eliminado correctamente"}
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(
            status_code=500, detail="Error interno del servidor"
        )


class ResetPasswordRequest(BaseModel):
    new_password: Optional[str] = "SRNC2026!"


@app.post("/api/admin/users/{user_id}/reset-password")
def reset_user_password(
    user_id: str,
    req: ResetPasswordRequest,
    request: Request,
    background_tasks: BackgroundTasks,
    admin_user=Depends(get_current_admin),
):
    """Restablece la contraseña de un usuario a un valor por defecto o especificado"""
    try:
        # Validar UUID
        try:
            uuid.UUID(user_id)
        except ValueError:
            raise HTTPException(status_code=400, detail="ID de usuario inválido")

        # Prevenir que un ADMIN restablezca la clave de otro ADMIN (Tenant Security)
        # EXCEPCIÓN: Superadmin puede resetear claves de cualquiera
        roles_res = (
            supabase.table("user_roles")
            .select("roles(nombre)")
            .eq("user_id", admin_user.id)
            .execute()
        )
        user_roles = (
            [r["roles"]["nombre"] for r in roles_res.data if r.get("roles")]
            if roles_res.data
            else []
        )
        is_superadmin = "SUPERADMIN" in user_roles

        target_profile = (
            supabase.table("profiles").select("rol").eq("id", user_id).execute()
        )
        if (
            target_profile.data
            and target_profile.data[0].get("rol") == "ADMIN"
            and admin_user.id != user_id
            and not is_superadmin
        ):
            raise HTTPException(
                status_code=403,
                detail="No tienes permisos para restablecer la contraseña de otro Administrador.",
            )

        new_password = req.new_password if req.new_password else "SRNC2026!"

        # Validar longitud mínima de Supabase
        if len(new_password) < 6:
            raise HTTPException(
                status_code=400, detail="La contraseña debe tener al menos 6 caracteres"
            )

        # Actualizar en Auth
        supabase.auth.admin.update_user_by_id(
            user_id, {"password": new_password}
        )

        # Actualizar en profiles para forzar el cambio
        supabase.table("profiles").update({"password_changed": False}).eq(
            "id", user_id
        ).execute()

        background_tasks.add_task(
            registrar_auditoria,
            usuario_id=admin_user.id,
            email_usuario=admin_user.email,
            rol_usuario="SUPERADMIN" if is_superadmin else "ADMIN",
            accion="UPDATE",
            tabla="auth.users (Password)",
            registro_id=user_id,
            datos_anteriores=None,
            datos_nuevos={"password_reset": True},
            modulo="Gestión Usuarios",
            request=request,
        )
        return {
            "message": "Contraseña restablecida correctamente. El usuario debe cambiarla en su próximo acceso.",
        }
    except Exception as e:

        error_details = traceback.format_exc()
        logger.error(f"ERROR CRÍTICO RESET PASSWORD ({user_id}): {str(e)}")
        logger.error(error_details)
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(
            status_code=500, detail="Error interno del servidor"
        )


@app.get("/api/admin/metrics/overview")
def get_metrics_overview(admin_user=Depends(get_current_admin)):
    """Endpoint para dashboard principal de KPIs"""
    try:
        # Queries optimizadas: COUNT en lugar de fetch de todos los perfiles
        socios_res = supabase.table("profiles").select("id", count="exact") \
            .eq("rol", "SOCIO").eq("estado", "APROBADO").execute()
        total_socios = socios_res.count if socios_res.count is not None else 0

        comercios_res = supabase.table("profiles").select("id", count="exact") \
            .eq("rol", "COMERCIO").eq("estado", "APROBADO").execute()
        total_comercios = comercios_res.count if comercios_res.count is not None else 0

        pendientes_res = supabase.table("profiles").select("id", count="exact") \
            .eq("estado", "PENDIENTE").execute()
        total_pendientes = pendientes_res.count if pendientes_res.count is not None else 0

        # Conteo de validaciones de pago pendientes 2.0
        pagos_res = (
            supabase.table("pagos_cuotas")
            .select("id", count="exact")
            .eq("estado_pago", "PENDIENTE_VALIDACION")
            .execute()
        )
        validaciones_pendientes = pagos_res.count if pagos_res.count is not None else 0

        return {
            "metrics": {
                "total_socios": total_socios,
                "total_comercios": total_comercios,
                "total_pendientes": total_pendientes,
                "validaciones_pendientes": validaciones_pendientes,
                "ingresos_mes": 0,  # TODO: Conectar con Stripe/MercadoPago luego
            }
        }
    except Exception as e:
        raise HTTPException(
            status_code=500, detail="Error interno del servidor"
        )


# 7. ENDPOINT ADMIN: CREAR COMERCIO
@app.post("/api/admin/comercios", status_code=status.HTTP_201_CREATED)
def create_commerce(
    comercio: ComercioDTO,
    request: Request,
    background_tasks: BackgroundTasks,
    auth_user=Depends(get_current_admin),
):
    comercio.telefono = sanitizar_y_validar_telefono(comercio.telefono)
    try:
        # Extraer rol y perfil del usuario autenticado
        profile_res = (
            supabase.table("profiles")
            .select("rol", "municipio")
            .eq("id", auth_user.id)
            .execute()
        )
        if not profile_res.data:
            raise HTTPException(status_code=403, detail="Perfil no encontrado")

        user_profile = profile_res.data[0]
        user_rol = user_profile["rol"]
        user_municipio = user_profile["municipio"]

        # Si es ADMIN, usa el municipio del request; fallback al municipio del admin si aplica
        titular_id = None
        final_municipio = comercio.municipio or user_municipio

        default_password = "SRNC2026!"

        auth_response = supabase.auth.admin.create_user(
            {
                "email": comercio.email,
                "password": default_password,
                "email_confirm": True,
            }
        )

        user_id = auth_response.user.id

        profile_data = {
            "id": user_id,
            "nombre_apellido": comercio.nombre_comercio,
            "dni": comercio.cuit,
            "email": comercio.email,
            "telefono": comercio.telefono,
            "rubro": comercio.rubro,
            "rol": "COMERCIO",
            "estado": "PENDIENTE",
            "municipio": final_municipio
            or user_municipio,  # Fallback al municipio del creador si no se define
            "password_changed": False,
            "titular_id": titular_id,
        }

        supabase.table("profiles").insert(profile_data).execute()

        commerce_data = {
            "id": user_id,
            "nombre_comercio": comercio.nombre_comercio,
            "cuit": comercio.cuit,
            "rubro": comercio.rubro,
            "direccion": comercio.direccion,
        }
        supabase.table("comercios").insert(commerce_data).execute()

        # Auditoría
        background_tasks.add_task(
            registrar_auditoria,
            usuario_id=auth_user.id if auth_user else None,
            email_usuario=auth_user.email if auth_user else "Sistema",
            rol_usuario=user_rol,
            accion="CREATE",
            tabla="profiles",
            registro_id=user_id,
            datos_anteriores=None,
            datos_nuevos=profile_data,
            modulo="Gestión Comercios",
            request=request,
        )

        return {
            "message": f"Comercio creado correctamente. Contraseña temporal: {default_password}",
            "comercio": profile_data,
        }

    except Exception as e:
        logger.error(f"[ADMIN] Error creando comercio: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Error interno del servidor",
        )

# 7.5 ENDPOINT ADMIN: CREAR PROFESIONAL
@app.post("/api/admin/profesionales", status_code=status.HTTP_201_CREATED)
def create_profesional(
    prof: ProfesionalDTO,
    request: Request,
    background_tasks: BackgroundTasks,
    auth_user=Depends(get_current_admin),
):
    prof.telefono = sanitizar_y_validar_telefono(prof.telefono)
    try:
        # Extraer rol y perfil del usuario autenticado
        profile_res = (
            supabase.table("profiles")
            .select("rol", "municipio")
            .eq("id", auth_user.id)
            .execute()
        )
        if not profile_res.data:
            raise HTTPException(status_code=403, detail="Perfil no encontrado")

        user_profile = profile_res.data[0]
        user_rol = user_profile["rol"]
        user_municipio = user_profile["municipio"]

        # Si es ADMIN, usa el municipio del request; fallback al municipio del admin si aplica
        final_municipio = prof.municipio or user_municipio

        default_password = "SRNC2026!"

        auth_response = supabase.auth.admin.create_user(
            {
                "email": prof.email,
                "password": default_password,
                "email_confirm": True,
            }
        )

        user_id = auth_response.user.id

        profile_data = {
            "id": user_id,
            "nombre_apellido": prof.nombreApellido,
            "dni": prof.dni,
            "email": prof.email,
            "telefono": prof.telefono,
            "rubro": prof.profesion, # Usamos rubro para la profesion de forma genérica
            "rol": "SOCIO", # ES UN SOCIO SEGÚN LA REGLA
            "es_profesional": True, # LO MARCAMOS COMO PROFESIONAL
            "estado": "PENDIENTE",
            "municipio": final_municipio,
            "provincia": prof.provincia,
            "direccion": prof.domicilio,
            "password_changed": False,
            # SEGURIDAD: Alta desde panel admin → aplica arancel profesional diferencial.
            "registration_source": "admin",
        }

        supabase.table("profiles").insert(profile_data).execute()

        # Insertar en tabla profesionales
        prof_data = {
            "id": user_id,
            "matricula": prof.nroMatricula,
            "titulo": prof.profesion,
        }
        supabase.table("profesionales").insert(prof_data).execute()

        # Auditoría
        background_tasks.add_task(
            registrar_auditoria,
            usuario_id=auth_user.id if auth_user else None,
            email_usuario=auth_user.email if auth_user else "Sistema",
            rol_usuario=user_rol,
            accion="CREATE",
            tabla="profiles",
            registro_id=user_id,
            datos_anteriores=None,
            datos_nuevos=profile_data,
            modulo="Gestión Profesionales",
            request=request,
        )

        return {
            "message": f"Profesional creado correctamente. Contraseña temporal: {default_password}",
            "profesional": profile_data,
        }

    except Exception as e:
        # Rollback auth just in case
        try:
            if 'user_id' in locals():
                supabase.auth.admin.delete_user(user_id)
        except Exception as e:
            logger.error(f"Error: {e}")
            pass
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Error interno del servidor",
        )



# ── ENDPOINT PÚBLICO: Listar profesionales ────────────────────────────────────
@app.get("/api/profesionales")
def get_profesionales_publicos(municipio: Optional[str] = None):
    """
    Retorna lista de profesionales aprobados para visualización pública.
    Solo expone campos no sensibles. No requiere autenticación.
    """
    try:
        query = (
            supabase.table("profiles")
            .select("id, nombre_apellido, rubro, municipio, provincia, telefono, direccion")
            .eq("rol", "SOCIO")
            .eq("es_profesional", True)
            .eq("estado", "APROBADO")
            .order("nombre_apellido")
        )
        if municipio:
            query = query.eq("municipio", municipio)
        res = query.execute()
        profesionales_list = res.data or []

        if profesionales_list:
            ids = [p["id"] for p in profesionales_list if p.get("id")]
            if ids:
                prof_extra = (
                    supabase.table("profesionales")
                    .select("id, matricula")
                    .in_("id", ids)
                    .execute()
                )
                matricula_map = {
                    row["id"]: row.get("matricula")
                    for row in (prof_extra.data or [])
                }
                for p in profesionales_list:
                    p["matricula"] = matricula_map.get(p["id"])

        return {"profesionales": profesionales_list}
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail="Error interno del servidor"
        )


# ── MODELOS PARA OFERTAS ──────────────────────────────────────────────────────
class OfertaRequest(BaseModel):
    titulo: str
    subtitulo: Optional[str] = None
    descripcion_corta: Optional[str] = None
    descripcion: Optional[str] = None
    tipo: str  # 'promocion' | 'descuento' | 'beneficio'
    precio_lista: Optional[float] = None
    precio_final: Optional[float] = None
    porcentaje_descuento: Optional[float] = None
    monto_descuento: Optional[float] = None
    valor_descuento: Optional[float] = None
    tipo_descuento: Optional[str] = None
    whatsapp: Optional[str] = None
    direccion: Optional[str] = None
    localidad: Optional[str] = None
    ubicacion: Optional[str] = None
    categoria: Optional[str] = None
    destacada: Optional[bool] = False
    imagenes_secundarias: Optional[list] = None
    imagen_url: Optional[str] = None
    fecha_fin: Optional[str] = None
    instagram_url: Optional[str] = None
    facebook_url: Optional[str] = None

    _normalize_instagram = validator("instagram_url", pre=True, always=True, allow_reuse=True)(normalize_social_url)
    _normalize_facebook = validator("facebook_url", pre=True, always=True, allow_reuse=True)(normalize_social_url)


class OfertaUpdateRequest(BaseModel):
    activo: Optional[bool] = None
    titulo: Optional[str] = None
    subtitulo: Optional[str] = None
    descripcion_corta: Optional[str] = None
    descripcion: Optional[str] = None
    precio_lista: Optional[float] = None
    precio_final: Optional[float] = None
    porcentaje_descuento: Optional[float] = None
    monto_descuento: Optional[float] = None
    valor_descuento: Optional[float] = None
    tipo_descuento: Optional[str] = None
    whatsapp: Optional[str] = None
    direccion: Optional[str] = None
    localidad: Optional[str] = None
    ubicacion: Optional[str] = None
    categoria: Optional[str] = None
    destacada: Optional[bool] = None
    imagenes_secundarias: Optional[list] = None
    imagen_url: Optional[str] = None
    fecha_fin: Optional[str] = None
    instagram_url: Optional[str] = None
    facebook_url: Optional[str] = None

    _normalize_instagram = validator("instagram_url", pre=True, always=True, allow_reuse=True)(normalize_social_url)
    _normalize_facebook = validator("facebook_url", pre=True, always=True, allow_reuse=True)(normalize_social_url)
    _normalize_whatsapp = validator("whatsapp", pre=True, always=True, allow_reuse=True)(normalize_whatsapp_number)



# ── ENDPOINTS OFERTAS ─────────────────────────────────────────────────────────


# ── ENDPOINT PÚBLICO: ver ofertas por municipio (para socios) ─────────────────
@app.get("/api/ofertas/publicas")
def get_ofertas_publicas(municipio: Optional[str] = None):
    """
    Retorna promociones/ofertas activas de comercios aprobados.
    Tabla real: 'promociones' (con FK a 'comercios' -> profiles).
    """
    try:
        query = (
            supabase.table("promociones")
            .select(
                "id, titulo, descripcion, tipo, "
                "valor_descuento, tipo_descuento, imagen_url, "
                "instagram_url, facebook_url, fecha_inicio, fecha_fin, "
                "activo, es_exclusiva_profesionales, created_at, "
                "comercio:comercios(id, nombre_apellido:profiles(nombre_apellido), "
                "municipio:profiles(municipio), rubro:profiles(rubro))"
            )
            .eq("activo", True)
            .order("created_at", desc=True)
        )

        res = query.execute()
        ofertas = res.data or []

        # Aplanar la relación anidada para compatibilidad con el frontend
        result = []
        for o in ofertas:
            comercio_data = o.pop("comercio", {}) or {}
            # comercio_data puede tener sub-relaciones anidadas de profiles
            nombre = comercio_data.get("nombre_apellido") or {}
            if isinstance(nombre, dict):
                nombre = nombre.get("nombre_apellido", "")
            mun = comercio_data.get("municipio") or {}
            if isinstance(mun, dict):
                mun = mun.get("municipio", "")
            rub = comercio_data.get("rubro") or {}
            if isinstance(rub, dict):
                rub = rub.get("rubro", "")

            o["comercio"] = {
                "nombre_apellido": nombre,
                "municipio":       mun,
                "rubro":           rub,
            }
            result.append(o)

        if municipio:
            result = [
                o for o in result
                if o["comercio"].get("municipio") == municipio
            ]

        return {"ofertas": result}

    except Exception as e:
        logger.exception(f"[/api/ofertas/publicas] Error inesperado:")
        raise HTTPException(status_code=500, detail="Error al obtener ofertas.")

@app.get("/api/ofertas/publicas/{oferta_id}")
def get_oferta_publica(oferta_id: str):
    if oferta_id == "undefined" or not oferta_id:
        raise HTTPException(status_code=400, detail="ID de oferta inválido.")
    try:
        query = (
            supabase.table("promociones")
            .select(
                "id, titulo, subtitulo, descripcion_corta, descripcion, tipo, "
                "precio_lista, precio_final, porcentaje_descuento, monto_descuento, "
                "whatsapp, direccion, localidad, ubicacion, categoria, destacada, imagenes_secundarias, "
                "valor_descuento, tipo_descuento, imagen_url, "
                "instagram_url, facebook_url, fecha_inicio, fecha_fin, "
                "activo, es_exclusiva_profesionales, created_at, "
                "comercio:comercios(id, nombre_apellido:profiles(nombre_apellido), "
                "municipio:profiles(municipio), rubro:profiles(rubro))"
            )
            .eq("id", oferta_id)
            .eq("activo", True)
        )

        res = query.execute()
        if not res.data:
            raise HTTPException(status_code=404, detail="Oferta no encontrada.")

        oferta = res.data[0]

        comercio_data = oferta.pop("comercio", {}) or {}
        nombre = comercio_data.get("nombre_apellido") or {}
        if isinstance(nombre, dict):
            nombre = nombre.get("nombre_apellido", "")
        mun = comercio_data.get("municipio") or {}
        if isinstance(mun, dict):
            mun = mun.get("municipio", "")
        rub = comercio_data.get("rubro") or {}
        if isinstance(rub, dict):
            rub = rub.get("rubro", "")

        oferta["comercio"] = {
            "nombre_apellido": nombre,
            "municipio":       mun,
            "rubro":           rub,
        }

        return {"oferta": oferta}
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"[/api/ofertas/publicas/{oferta_id}] Error inesperado:")
        raise HTTPException(status_code=500, detail="Error al obtener la oferta.")
@app.put("/api/perfil")
def update_profile(
    req: UpdateProfileRequest,
    request: Request,
    background_tasks: BackgroundTasks,
    current_user=Depends(get_current_user),
):
    """
    Actualiza los datos del perfil del usuario autenticado.
    Vulnerabilidad de Mass Assignment parcheada mediante Dict Exclude.
    """
    req.telefono = sanitizar_y_validar_telefono(req.telefono)
    try:
        update_data = req.dict(exclude_unset=True)
        if not update_data:
            return {"message": "Sin cambios"}

        perfil_ant = (
            supabase.table("profiles").select("*").eq("id", current_user.id).execute()
        )
        datos_anteriores = perfil_ant.data[0] if perfil_ant.data else None

        if "email" in update_data:
            try:
                # Update email in Supabase Auth
                supabase.auth.admin.update_user_by_id(
                    current_user.id,
                    {"email": update_data["email"], "email_confirm": True},
                )
            except Exception as e:
                raise HTTPException(
                    status_code=400,
                    detail="Error interno del servidor",
                )

        res = (
            supabase.table("profiles")
            .update(update_data)
            .eq("id", current_user.id)
            .execute()
        )
        if not res.data:
            raise HTTPException(status_code=404, detail="Usuario no encontrado")

        background_tasks.add_task(
            registrar_auditoria,
            usuario_id=current_user.id,
            email_usuario=current_user.email,
            rol_usuario=None,
            accion="UPDATE",
            tabla="profiles",
            registro_id=current_user.id,
            datos_anteriores=datos_anteriores,
            datos_nuevos=update_data,
            modulo="Perfil",
            request=request,
        )
        return {"message": "Perfil actualizado", "user": res.data[0]}
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(
            status_code=500, detail="Error interno del servidor"
        )


@app.post("/api/perfil/cambiar-password")
def change_my_password(
    req: ChangePasswordRequest,
    request: Request,
    background_tasks: BackgroundTasks,
    current_user=Depends(get_current_user),
):
    """
    Permite al usuario autenticado cambiar su propia contraseña.
    Usa admin API del backend (service role) para aplicar el cambio de forma segura.
    """
    try:
        # 1. Validar contraseña
        if len(req.new_password) < 6:
            raise HTTPException(
                status_code=400, detail="La contraseña debe tener al menos 6 caracteres"
            )

        # 2. Aplicar cambio mediante Admin API
        supabase.auth.admin.update_user_by_id(
            current_user.id, {"password": req.new_password}
        )

        # 3. Marcar como cambiada en profile
        supabase.table("profiles").update({
            "password_changed": True,
            "must_change_password": False
        }).eq("id", current_user.id).execute()

        # 4. Auditoría
        background_tasks.add_task(
            registrar_auditoria,
            usuario_id=current_user.id,
            email_usuario=current_user.email,
            rol_usuario=None,
            accion="SELF_CHANGE_PASSWORD",
            tabla="auth.users",
            registro_id=current_user.id,
            datos_anteriores=None,
            datos_nuevos={"status": "Contraseña actualizada por el usuario"},
            modulo="Perfil",
            request=request,
        )

        return {"message": "Contraseña actualizada correctamente"}
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(
            status_code=500, detail="Error interno del servidor"
        )


@app.get("/api/mis-dependientes")
def get_mis_dependientes(current_user=Depends(get_current_user)):
    """Retorna los adherentes/empleados del usuario actual."""
    try:
        res = (
            supabase.table("profiles")
            .select("*")
            .eq("titular_id", current_user.id)
            .order("created_at", desc=True)
            .execute()
        )
        return {"dependientes": res.data}
    except Exception as e:
        raise HTTPException(status_code=500, detail="Error interno del servidor")


@app.post("/api/agregar-dependiente", status_code=201)
def agregar_dependiente(
    req: AddDependienteRequest,
    request: Request,
    background_tasks: BackgroundTasks,
    current_user=Depends(get_current_user),
):
    """Crea un perfil que depende del usuario en sesión."""
    req.telefono = sanitizar_y_validar_telefono(req.telefono)
    try:
        log_secure("Inicio agregar_dependiente", {"titular_id": current_user.id, "dni": req.dni_cuit})
        
        # 1. Obtener perfil titular para heredar Rol y otros datos
        titular_res = (
            supabase.table("profiles")
            .select("rol", "municipio", "rubro")
            .eq("id", current_user.id)
            .execute()
        )
        if not titular_res.data:
            raise HTTPException(status_code=404, detail="Titular no encontrado")
        titular = titular_res.data[0]
        rol_titular = titular.get("rol")

        # 1.5 Validar límite de familiares (solo para SOCIOS)
        if rol_titular == "SOCIO":
            familiares_res = (
                supabase.table("profiles")
                .select("id", count="exact")
                .eq("titular_id", current_user.id)
                .eq("user_type", "FAMILIAR")
                .execute()
            )
            count = familiares_res.count if hasattr(familiares_res, "count") else len(familiares_res.data)
            if count is not None and count >= 3:
                raise HTTPException(
                    status_code=400,
                    detail="Solo podés registrar hasta 3 familiares por socio."
                )

        # 2. Validaciones de duplicados en Profiles
        # Verificamos DNI
        check_dni = supabase.table("profiles").select("id").eq("dni", req.dni_cuit).execute()
        if check_dni.data:
            raise HTTPException(status_code=400, detail="El DNI/Documento ya está registrado en el sistema.")

        # Email final (real o ficticio)
        user_email = (
            req.email
            if req.email
            else f"dep.{req.dni_cuit}@sociedadrural.local"
        ).lower()

        # Verificamos Email en profiles
        check_email = supabase.table("profiles").select("id").eq("email", user_email).execute()
        if check_email.data:
            raise HTTPException(status_code=400, detail="El correo electrónico ya está registrado en el sistema.")

        # 3. Crear usuario en Auth (con manejo de huérfanos)
        user_id = None
        user_password = "SRNC2026!" # Password inicial estándar

        try:
            auth_response = supabase.auth.admin.create_user(
                {"email": user_email, "password": user_password, "email_confirm": True}
            )
            user_id = auth_response.user.id
        except Exception as auth_err:
            err_msg = str(auth_err).lower()
            if "already registered" in err_msg or "already exists" in err_msg or "422" in err_msg:
                # Verificamos si es un huérfano (existe en Auth pero no en Profiles)
                # Ya verificamos profiles arriba, así que si llega acá es un huérfano en Auth
                user_lookup = supabase.rpc("get_user_id_by_email", {"p_email": user_email}).execute()
                existing_uid = user_lookup.data
                if existing_uid:
                    logger.info(f"Limpiando huérfano detectado en Auth: {existing_uid}")
                    supabase.auth.admin.delete_user(existing_uid)
                    # Reintentar
                    auth_response = supabase.auth.admin.create_user(
                        {"email": user_email, "password": user_password, "email_confirm": True}
                    )
                    user_id = auth_response.user.id
                else:
                    raise HTTPException(status_code=400, detail="Error de consistencia en la cuenta. Contacte soporte.")
            else:
                logger.error(f"Error creando usuario en Auth: {auth_err}")
                raise HTTPException(status_code=400, detail="No se pudo crear la cuenta de usuario.")

        # 4. Insertar en Profiles
        rol_dependiente = rol_titular
        es_empleado_comercial = False
        
        if rol_titular == "COMERCIO":
            rol_dependiente = "SOCIO"
            if req.tipo_vinculo in ["Empleado", "Encargado"]:
                es_empleado_comercial = True

        profile_data = {
            "id": user_id,
            "nombre_apellido": req.nombre_apellido,
            "dni": req.dni_cuit,
            "email": user_email,
            "telefono": req.telefono,
            "rol": rol_dependiente,
            "estado": "PENDIENTE", 
            "municipio": titular.get("municipio"),
            "rubro": titular.get("rubro"),
            "titular_id": current_user.id,
            "tipo_vinculo": req.tipo_vinculo,
            "password_changed": False,
            "user_type": "FAMILIAR",
            "must_change_password": True
        }
        
        if es_empleado_comercial:
            profile_data["es_empleado_comercial"] = True
            profile_data["empleado_comercio_id"] = current_user.id
            profile_data["activo_empleado"] = True
            from datetime import datetime, timezone
            profile_data["fecha_vinculacion_comercio"] = datetime.now(timezone.utc).isoformat()

        try:
            supabase.table("profiles").insert(profile_data).execute()
        except Exception as insert_err:
            logger.error(f"Falla en insert de profile dependiente: {insert_err}")
            # Rollback
            supabase.auth.admin.delete_user(user_id)
            raise HTTPException(status_code=400, detail="No se pudo vincular el perfil a su cuenta.")

        # 5. Auditoría
        background_tasks.add_task(
            registrar_auditoria,
            usuario_id=current_user.id,
            email_usuario=current_user.email,
            rol_usuario=rol_titular,
            accion="CREATE",
            tabla="profiles",
            registro_id=user_id,
            datos_anteriores=None,
            datos_nuevos=profile_data,
            modulo="Gestión Dependientes",
            request=request,
        )

        return {
            "message": "Miembro vinculado correctamente. Pendiente de aprobación por Admin.",
            "dependiente": {
                "id": user_id,
                "nombre_apellido": req.nombre_apellido,
                "email": user_email,
                "rol": rol_titular,
                "estado": "PENDIENTE"
            }
        }

    except HTTPException as he:
        raise he
    except Exception as e:
        logger.exception("Error no controlado en agregar_dependiente")
        raise HTTPException(status_code=400, detail="Ocurrió un error inesperado al agregar el miembro.")


class UpdateDependienteRequest(BaseModel):
    nombre_apellido: Optional[str] = None
    dni_cuit: Optional[str] = None
    email: Optional[str] = None
    telefono: Optional[str] = None
    tipo_vinculo: Optional[str] = None

    @validator("nombre_apellido", "dni_cuit", "tipo_vinculo", "telefono", "email", pre=True)
    def trim_strings(cls, v):
        if isinstance(v, str):
            return v.strip()
        return v

    @validator("dni_cuit")
    def validate_dni_cuit(cls, v):
        if v is None: return None
        v = v.replace(".", "").replace("-", "")
        if not v.isdigit():
            raise ValueError("El DNI/CUIT debe contener solo números")
        if len(v) < 7 or len(v) > 11:
            raise ValueError("El DNI/CUIT debe tener entre 7 y 11 dígitos")
        return v

@app.put("/api/dependientes/{dependiente_id}")
def update_dependiente(
    dependiente_id: str,
    req: UpdateDependienteRequest,
    request: Request,
    background_tasks: BackgroundTasks,
    current_user=Depends(get_current_user),
):
    """Actualiza los datos de un perfil que depende del usuario en sesión."""
    try:
        log_secure("Inicio update_dependiente", {"dep_id": dependiente_id, "titular_id": current_user.id})
        
        # 1. Verificar que el dependiente existe y pertenece al titular
        dep_res = supabase.table("profiles").select("*").eq("id", dependiente_id).eq("titular_id", current_user.id).execute()
        if not dep_res.data:
            raise HTTPException(status_code=404, detail="Dependiente no encontrado o no autorizado")
        
        old_data = dep_res.data[0]

        # 2. Preparar datos
        update_data = {k: v for k, v in req.dict(exclude_unset=True).items() if v is not None}
        if "dni_cuit" in update_data:
            update_data["dni"] = update_data.pop("dni_cuit")

        if not update_data:
            return {"message": "No hay datos para actualizar"}

        # 3. Ejecutar update
        try:
            supabase.table("profiles").update(update_data).eq("id", dependiente_id).execute()
        except Exception as up_err:
            logger.error(f"Error en update profile dependiente: {up_err}")
            raise HTTPException(status_code=400, detail="No se pudieron actualizar los datos.")

        # 4. Auditoría
        background_tasks.add_task(
            registrar_auditoria,
            usuario_id=current_user.id,
            email_usuario=current_user.email,
            rol_usuario=None,
            accion="UPDATE",
            tabla="profiles",
            registro_id=dependiente_id,
            datos_anteriores=old_data,
            datos_nuevos=update_data,
            modulo="Gestión Dependientes",
            request=request,
        )

        return {"message": "Datos actualizados correctamente"}

    except HTTPException as he:
        raise he
    except Exception as e:
        logger.exception("Error no controlado en update_dependiente")
        raise HTTPException(status_code=400, detail="Error al actualizar el miembro.")


@app.delete("/api/dependientes/{dependiente_id}")
def eliminar_dependiente(
    dependiente_id: str,
    request: Request,
    background_tasks: BackgroundTasks,
    current_user=Depends(get_current_user),
):
    """Desvincula y elimina a un adherente/empleado."""
    try:
        # Verificar que le pertenece
        check = (
            supabase.table("profiles")
            .select("*")
            .eq("id", dependiente_id)
            .eq("titular_id", current_user.id)
            .execute()
        )
        if not check.data:
            raise HTTPException(
                status_code=403,
                detail="No tienes permiso para eliminar este dependiente",
            )

        datos_anteriores = check.data[0]

        # Eliminar de Auth borrará de Profiles en cascada (o lo hacemos manual)
        supabase.auth.admin.delete_user(dependiente_id)

        background_tasks.add_task(
            registrar_auditoria,
            usuario_id=current_user.id,
            email_usuario=current_user.email,
            rol_usuario=None,
            accion="DELETE",
            tabla="profiles",
            registro_id=dependiente_id,
            datos_anteriores=datos_anteriores,
            datos_nuevos=None,
            modulo="Gestión Dependientes",
            request=request,
        )

        return {"message": "Dependiente eliminado"}
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail="Error interno del servidor")


# UploadFile y File ya importados al inicio del archivo


@app.post("/api/perfil/foto")
async def upload_foto(
    file: UploadFile = File(...), current_user=Depends(get_current_user)
):
    """
    Sube una foto al bucket 'perfiles' y actualiza la URL en el perfil.
    """
    try:
        # 1. Leer contenido del archivo
        file_content = await file.read()
        file_ext = file.filename.split(".")[-1]
        file_path = f"{current_user.id}/profile.{file_ext}"

        # 2. Subir a Supabase Storage (Migrado a bucket único 'business-logos')
        logger.info(f"Uploading profile photo. Bucket: business-logos, Path: {file_path}")
        try:
            # Asegurarse de que el bucket existe antes de subir
            try:
                supabase.storage.get_bucket("business-logos")
            except Exception:
                logger.info("Bucket 'business-logos' not found, attempting to create...")
                try:
                    supabase.storage.create_bucket(
                        "business-logos", options={"public": True}
                    )
                    logger.info("Bucket 'business-logos' created successfully.")
                except Exception as create_err:
                    logger.error(f"Critical error: Could not create bucket: {create_err}")

            res_storage = supabase.storage.from_("business-logos").upload(
                path=file_path,
                file=file_content,
                file_options={"content-type": file.content_type, "upsert": "true"},
            )
            logger.info(f"Profile upload result: {res_storage}")
        except Exception as storage_err:
            logger.error(f"Error subiendo foto al storage: {storage_err}")
            raise storage_err

        # 3. Obtener URL pública
        public_url = (
            f"{SUPABASE_URL}/storage/v1/object/public/business-logos/{file_path}"
        )

        # 4. Actualizar en la tabla profiles
        supabase.table("profiles").update({"foto_url": public_url}).eq(
            "id", current_user.id
        ).execute()

        return {"message": "Foto actualizada", "foto_url": public_url}

    except Exception as e:
        logger.error(f"Error subiendo foto de perfil: {str(e)}")
        raise HTTPException(status_code=500, detail="Error interno del servidor")


@app.post("/api/ofertas/foto")
async def upload_oferta_foto(
    file: UploadFile = File(...), current_user=Depends(get_current_user)
):
    """
    Sube una foto de oferta al bucket 'ofertas'.
    """
    try:
        file_content = await file.read()
        file_ext = file.filename.split(".")[-1]
        # Usamos UUID para evitar colisiones si el mismo comercio sube varias ofertas
        filename = f"{current_user.id}/{uuid4().hex}.{file_ext}"

        # Subir a Supabase Storage (bucket 'business-logos')
        logger.info(f"Uploading offer image. Bucket: business-logos, Path: {filename}")
        try:
            # Asegurarse de que el bucket existe antes de subir
            try:
                supabase.storage.get_bucket("business-logos")
            except Exception:
                logger.info("Bucket 'business-logos' not found, attempting to create...")
                try:
                    supabase.storage.create_bucket(
                        "business-logos", options={"public": True}
                    )
                    logger.info("Bucket 'business-logos' created successfully.")
                except Exception as create_err:
                    logger.error(f"Critical error: Could not create bucket: {create_err}")

            res_storage = supabase.storage.from_("business-logos").upload(
                path=filename,
                file=file_content,
                file_options={"content-type": file.content_type, "upsert": "true"},
            )
            logger.info(f"Offer image upload result: {res_storage}")
        except Exception as storage_err:
            logger.info(
                f"Error en Storage (asegurese que el bucket 'business-logos' sea publico): {storage_err}"
            )
            raise storage_err

        public_url = (
            f"{SUPABASE_URL}/storage/v1/object/public/business-logos/{filename}"
        )

        return {"message": "Imagen de oferta subida", "imagen_url": public_url}

    except Exception as e:
        logger.error(f"Error en endpoint /api/ofertas/foto: {str(e)}")
        raise HTTPException(
            status_code=500, detail="Error interno del servidor"
        )


@app.post("/api/notificar-olvido-password")
@limiter.limit("3/minute")
def notificar_olvido_password(
    req: ForgotPasswordRequest, request: Request, background_tasks: BackgroundTasks
):
    """
    Registra una solicitud de recuperación de contraseña y notifica a todos los administradores.
    """
    try:
        identificador = req.identificador.strip()

        # 1. Buscar el perfil del usuario que solicita
        profile_res = None
        if "@" in identificador:
            profile_res = (
                supabase.table("profiles")
                .select("id, email, nombre_apellido, dni")
                .eq("email", identificador)
                .execute()
            )
        else:
            profile_res = (
                supabase.table("profiles")
                .select("id, email, nombre_apellido, dni")
                .eq("dni", identificador)
                .execute()
            )

        if not profile_res.data:
            # Por seguridad, mensaje genérico
            return {
                "message": "Si el usuario existe, el administrador ha sido notificado."
            }

        perfil = profile_res.data[0]

        # 2. Registrar la solicitud en notificaciones
        notif_data = {
            "usuario_id": perfil["id"],
            "tipo": "OLVIDO_PASSWORD",
            "titulo": "Recuperación de Contraseña",
            "mensaje": f"El usuario {perfil['nombre_apellido']} (DNI: {perfil['dni']}) solicita restablecer su contraseña.",
            "estado": "PENDIENTE",
            "metadata": {"email": perfil["email"]},
        }

        supabase.table("notificaciones").insert(notif_data).execute()

        # 3. Notificar a todos los administradores (In-App y Push)
        # Buscamos todos los perfiles con rol ADMIN
        admins_res = (
            supabase.table("profiles").select("id").eq("rol", "ADMIN").execute()
        )
        if admins_res.data:
            for admin in admins_res.data:
                background_tasks.add_task(
                    enviar_notificacion_push_inapp,
                    usuario_id=admin["id"],
                    titulo="Solicitud de Soporte 🔑",
                    mensaje=f"{perfil['nombre_apellido']} olvidó su contraseña.",
                    link_url="/admin",  # O una sección específica si la creamos
                )

        return {
            "message": "Solicitud enviada correctamente. Un administrador procesará tu pedido a la brevedad."
        }

    except Exception as e:
        logger.error(f"Error en notificar_olvido_password: {str(e)}")
        raise HTTPException(
            status_code=500, detail="No pudimos procesar tu solicitud en este momento. Intenta nuevamente o contacta a un administrador."
        )


@app.get("/api/admin/notificaciones-soporte")
def get_support_notifications(tab: Optional[str] = "pendientes", admin_user=Depends(get_current_admin)):
    """Retorna las notificaciones de soporte para el administrador, filtradas por estado"""
    try:
        estado_filter = "PENDIENTE"
        if tab == "resueltos":
            estado_filter = "RESUELTO"
        elif tab == "archivados":
            estado_filter = "ARCHIVADO"

        # 1. Query principal sin join (siempre funciona, independiente de FK config en PostgREST)
        query = supabase.table("notificaciones").select("*").in_("tipo", ["admin", "OLVIDO_PASSWORD"]).eq("estado", estado_filter).is_("deleted_at", "null")
        res = query.order("fecha", desc=True).execute()
        notificaciones = res.data or []

        if not notificaciones:
            return {"notificaciones": []}

        # 2. Enriquecer con datos de profiles en memoria (evita dependencia de FK en PostgREST)
        user_ids = list({n["usuario_id"] for n in notificaciones if n.get("usuario_id")})
        profiles_map: dict = {}

        if user_ids:
            try:
                prof_res = (
                    supabase.table("profiles")
                    .select("id, nombre_apellido, dni, email, rol")
                    .in_("id", user_ids)
                    .execute()
                )
                profiles_map = {p["id"]: p for p in (prof_res.data or [])}
            except Exception as prof_err:
                logger.warning(f"[notificaciones-soporte] No se pudo enriquecer con profiles: {prof_err}")

        # 3. Combinar resultados
        for n in notificaciones:
            uid = n.get("usuario_id")
            n["profiles"] = profiles_map.get(uid) if uid else None

        return {"notificaciones": notificaciones}

    except Exception as e:
        logger.error({
            "event": "admin_notifications_error",
            "error": str(e)
        })
        return {"notificaciones": []}



@app.put("/api/admin/notificaciones-soporte/{notif_id}/resolver")
def resolve_support_notification(notif_id: str, admin_user=Depends(get_current_admin)):
    """Marca una notificación de soporte como resuelta"""
    try:
        supabase.table("notificaciones").update(
            {
                "estado": "RESUELTO", 
                "resolved_at": datetime.now().isoformat(),
                "admin_resolvio_id": admin_user.id
            }
        ).eq("id", notif_id).execute()
        return {"message": "Solicitud marcada como resuelta"}
    except Exception as e:
        raise HTTPException(status_code=500, detail="Error interno del servidor")

@app.put("/api/admin/notificaciones-soporte/{notif_id}/archivar")
def archivar_support_notification(notif_id: str, admin_user=Depends(get_current_admin)):
    """Marca una notificación de soporte como archivada"""
    try:
        supabase.table("notificaciones").update(
            {
                "estado": "ARCHIVADO", 
                "archivado_at": datetime.now().isoformat()
            }
        ).eq("id", notif_id).execute()
        return {"message": "Solicitud archivada"}
    except Exception as e:
        raise HTTPException(status_code=500, detail="Error interno del servidor")

@app.delete("/api/admin/notificaciones-soporte/{notif_id}")
def delete_support_notification(notif_id: str, admin_user=Depends(get_current_admin)):
    """Realiza un borrado lógico de una notificación de soporte"""
    try:
        supabase.table("notificaciones").update(
            {
                "deleted_at": datetime.now().isoformat(),
                "deleted_by": admin_user.id
            }
        ).eq("id", notif_id).execute()
        return {"message": "Solicitud eliminada correctamente"}
    except Exception as e:
        raise HTTPException(status_code=500, detail="Error interno del servidor")

@app.post("/api/cron/limpiar-notificaciones")
def cron_limpiar_notificaciones(request: Request):
    """
    Cron:
    - Archiva solicitudes resueltas > 30 días
    - Borrado lógico (oculta) solicitudes archivadas > 90 días
    """
    header_secret = request.headers.get("X-API-Secret")
    if header_secret != os.getenv("API_SECRET_TOKEN"):
        if request.headers.get("X-Cron-Secret") != os.getenv("CRON_SECRET"):
            raise HTTPException(status_code=401, detail="No autorizado")

    try:
        now = datetime.now()
        thirty_days_ago = (now - timedelta(days=30)).isoformat()
        ninety_days_ago = (now - timedelta(days=90)).isoformat()
        
        # 1. Archivar RESUELTOS > 30 días
        resueltos = supabase.table("notificaciones").select("id").eq("estado", "RESUELTO").lt("resolved_at", thirty_days_ago).execute()
        if resueltos.data:
            ids_to_archive = [n["id"] for n in resueltos.data]
            for id_notif in ids_to_archive:
                supabase.table("notificaciones").update({
                    "estado": "ARCHIVADO",
                    "archivado_at": now.isoformat()
                }).eq("id", id_notif).execute()
        
        # 2. Borrado lógico ARCHIVADOS > 90 días
        archivados = supabase.table("notificaciones").select("id").eq("estado", "ARCHIVADO").lt("archivado_at", ninety_days_ago).execute()
        if archivados.data:
            ids_to_delete = [n["id"] for n in archivados.data]
            for id_notif in ids_to_delete:
                supabase.table("notificaciones").update({
                    "deleted_at": now.isoformat(),
                    "deleted_by": None # Sistema
                }).eq("id", id_notif).execute()

        return {"message": "Limpieza de notificaciones ejecutada correctamente", "archivados": len(resueltos.data or []), "borrados": len(archivados.data or [])}
    except Exception as e:
        logger.error(f"Error en cron_limpiar_notificaciones: {e}")
        raise HTTPException(status_code=500, detail="Error ejecutando limpieza")


@app.post("/api/admin/notificaciones-soporte/{notif_id}/reset-password")
def admin_reset_password(
    notif_id: str,
    req: ResetPasswordRequest,
    request: Request,
    background_tasks: BackgroundTasks,
    admin_user=Depends(get_current_admin),
):
    """
    Permite a un administrador resetear la contraseña de un usuario que lo solicitó.
    1. Obtiene el usuario_id desde la notificación.
    2. Actualiza la contraseña en Supabase Auth.
    3. Marca la notificación como RESUELTO.
    4. Registra en auditoría.
    """
    try:
        # 1. Obtener la notificación
        notif_res = (
            supabase.table("notificaciones")
            .select("*")
            .eq("id", notif_id)
            .execute()
        )
        if not notif_res.data:
            raise HTTPException(status_code=404, detail="Notificación no encontrada")

        notif = notif_res.data[0]
        user_id = notif.get("usuario_id")

        if not user_id:
            raise HTTPException(
                status_code=400,
                detail="La notificación no tiene un usuario_id asociado",
            )

        # 2. Actualizar contraseña en Auth (usando admin privilegios)
        try:
            supabase.auth.admin.update_user_by_id(
                user_id, {"password": req.new_password, "email_confirm": True}
            )

            # Forzar flag de password_changed a False para que el usuario deba cambiarla al entrar si es política
            supabase.table("profiles").update({"password_changed": False}).eq(
                "id", user_id
            ).execute()

        except Exception as auth_err:
            raise HTTPException(
                status_code=400,
                detail=f"Error actualizando contraseña en Auth: {str(auth_err)}",
            )

        # 3. Resolver notificación
        supabase.table("notificaciones").update(
            {"estado": "RESUELTO", "resolved_at": datetime.now().isoformat()}
        ).eq("id", notif_id).execute()

        # 4. Auditoría
        perfil_res = (
            supabase.table("profiles").select("email").eq("id", user_id).execute()
        )
        user_email = perfil_res.data[0]["email"] if perfil_res.data else "unknown"

        background_tasks.add_task(
            registrar_auditoria,
            usuario_id=admin_user.id,
            email_usuario=admin_user.email,
            rol_usuario="ADMIN",
            accion="RESET_PASSWORD_ADMIN",
            tabla="auth.users",
            registro_id=user_id,
            datos_anteriores={"notif_id": notif_id},
            datos_nuevos={
                "user_email": user_email,
                "status": "Password Reseteado por Admin",
            },
            modulo="Soporte",
            request=request,
        )

        return {"message": "Contraseña actualizada exitosamente y solicitud resuelta."}

    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(
            status_code=500, detail="Error interno del servidor"
        )


@app.put("/api/admin/notificaciones-soporte/{notif_id}/nota")
def update_support_note(
    notif_id: str, req: UpdateSupportNoteRequest, admin_user=Depends(get_current_admin)
):
    """Actualiza la nota interna en el metadata de una notificación"""
    try:
        # Recuperar metadata actual
        notif_res = (
            supabase.table("notificaciones")
            .select("metadata")
            .eq("id", notif_id)
            .execute()
        )
        if not notif_res.data:
            raise HTTPException(status_code=404, detail="Notificación no encontrada")

        metadata = notif_res.data[0].get("metadata") or {}
        metadata["nota"] = req.nota

        supabase.table("notificaciones").update({"metadata": metadata}).eq(
            "id", notif_id
        ).execute()
        return {"message": "Nota actualizada correctamente"}
    except Exception as e:
        raise HTTPException(status_code=500, detail="Error interno del servidor")


# ── ENDPOINT DE AUDITORÍA (ADMIN) ─────────────────────────────────────────────
@app.get("/api/admin/auditoria")
def get_auditoria(
    request: Request,
    superadmin_user=Depends(get_current_superadmin),
    usuario_id: Optional[str] = None,
    accion: Optional[str] = None,
    tabla_afectada: Optional[str] = None,
    modulo: Optional[str] = None,
    limit: int = Query(default=50, le=100),
    offset: int = Query(default=0, ge=0),
):
    """
    Retorna los registros de auditoría. Exclusivo para el rol Administrador.
    """
    try:
        query = supabase.table("auditoria_logs").select("*").order("fecha", desc=True)

        if usuario_id:
            query = query.eq("usuario_id", usuario_id)
        if accion:
            query = query.eq("accion", accion)
        if tabla_afectada:
            query = query.eq("tabla_afectada", tabla_afectada)
        if modulo:
            query = query.eq("modulo", modulo)

        res = query.range(offset, offset + limit - 1).execute()
        return {"logs": res.data}
    except Exception as e:
        raise HTTPException(
            status_code=500, detail="Error interno del servidor"
        )


@app.get("/api/admin/auditoria/stats")
def get_auditoria_stats(
    request: Request,
    superadmin_user=Depends(get_current_superadmin),
):
    """Retorna estadísticas de la tabla de auditoría: total, más antigua, más nueva."""
    try:
        total_res = supabase.table("auditoria_logs").select("id", count="exact").execute()
        total = total_res.count or 0

        oldest_res = supabase.table("auditoria_logs").select("fecha").order("fecha", desc=False).limit(1).execute()
        newest_res = supabase.table("auditoria_logs").select("fecha").order("fecha", desc=True).limit(1).execute()

        oldest = oldest_res.data[0]["fecha"] if oldest_res.data else None
        newest = newest_res.data[0]["fecha"] if newest_res.data else None

        return {
            "total": total,
            "mas_antigua": oldest,
            "mas_nueva": newest,
        }
    except Exception as e:
        logger.error(f"[AUDITORIA STATS] Error: {e}")
        raise HTTPException(status_code=500, detail="Error interno del servidor")


@app.delete("/api/admin/auditoria/purge")
def purge_auditoria(
    request: Request,
    superadmin_user=Depends(get_current_superadmin),
    dias: int = Query(default=90, ge=30, description="Eliminar registros anteriores a este número de días. Mínimo 30."),
):
    """
    [SUPERADMIN] Elimina registros de auditoría anteriores a N días.
    Mínimo permitido: 30 días (seguridad anti-purge accidental).
    Registra el purge como un evento de auditoría especial (autoauditoría).
    """
    try:
        fecha_corte = (datetime.now(timezone.utc) - timedelta(days=dias)).isoformat()

        # Contar cuántos se van a eliminar
        count_res = (
            supabase.table("auditoria_logs")
            .select("id", count="exact")
            .lt("fecha", fecha_corte)
            .execute()
        )
        a_eliminar = count_res.count or 0

        if a_eliminar == 0:
            return {
                "status": "ok",
                "eliminados": 0,
                "mensaje": f"No hay registros anteriores a {dias} días para eliminar.",
            }

        # Ejecutar la eliminación a través del RPC seguro (bypassea el trigger forense temporalmente)
        supabase.rpc("purge_auditoria_logs", {"dias_corte": dias}).execute()

        # Total restante
        total_res = supabase.table("auditoria_logs").select("id", count="exact").execute()
        restantes = total_res.count or 0

        # Autoauditoría: registrar el purge
        ip = request.client.host if request.client else "unknown"
        supabase.table("auditoria_logs").insert({
            "usuario_id": superadmin_user.id,
            "email_usuario": superadmin_user.email,
            "rol_usuario": "SUPERADMIN",
            "accion": "PURGE",
            "tabla_afectada": "auditoria_logs",
            "registro_id": "BULK",
            "datos_anteriores": None,
            "datos_nuevos": {"registros_eliminados": a_eliminar, "dias_corte": dias, "fecha_corte": fecha_corte},
            "modulo": "Especial: Auditoría",
            "ip_address": ip,
            "user_agent": request.headers.get("user-agent", "unknown"),
        }).execute()

        logger.info(
            f"[AUDITORIA PURGE] Superadmin {superadmin_user.email} eliminó "
            f"{a_eliminar} registros anteriores a {dias} días. Restantes: {restantes}"
        )

        return {
            "status": "success",
            "eliminados": a_eliminar,
            "restantes": restantes,
            "dias_corte": dias,
            "mensaje": f"✅ Se eliminaron {a_eliminar} registros anteriores a {dias} días. Quedan {restantes} registros.",
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[AUDITORIA PURGE] Error: {e}")
        raise HTTPException(status_code=500, detail="Error al purgar auditoría")


# ─────────────────────────────────────────────────────────────────
# 11. ENDPOINTS GESTIÓN DE EVENTOS INSTITUCIONALES
# ─────────────────────────────────────────────────────────────────
@app.get("/api/eventos")
def get_combined_eventos(
    municipio_id: Optional[str] = None,
    municipio: Optional[str] = None,
    tipo: Optional[str] = None,
    fecha_desde: Optional[str] = None,
):
    """
    Consulta la lista de eventos desde la tabla unificada eventos_sociales.
    """
    try:
        resolved_municipio_id = municipio_id
        if not resolved_municipio_id and municipio:
            # Intentar resolver el UUID real del municipio por nombre
            mun_res = supabase.table("municipios").select("id").ilike("nombre", municipio).execute()
            if mun_res.data:
                resolved_municipio_id = mun_res.data[0]["id"]

        query = supabase.table("eventos_sociales").select("*").eq("estado", "publicado")
        
        if resolved_municipio_id:
            query = query.eq("municipio_id", resolved_municipio_id)
        elif municipio:
            query = query.ilike("lugar", f"%{municipio}%")
            
        if tipo:
            query = query.ilike("tipo", f"%{tipo}%")
            
        if fecha_desde:
            query = query.gte("fecha", fecha_desde)

        res = query.order("fecha", desc=False).execute()
        eventos = res.data or []

        # Normalizar fallback_ig
        for ev in eventos:
            ev_fuente = ev.get("fuente", "sociedad_rural")
            fallback_ig = (
                "https://www.instagram.com/sociedadruralnc?igsh=MTMwcWNzbHh6aHdyMg%3D%3D"
                if ev_fuente == "sociedad_rural"
                else None
            )
            if not ev.get("link_instagram") and ev.get("metadata"):
                ev["link_instagram"] = ev["metadata"].get("permalink") or fallback_ig
            elif not ev.get("link_instagram"):
                ev["link_instagram"] = fallback_ig

        return {"eventos": eventos}
    except Exception as e:
        logger.error(f"Error combinando eventos: {str(e)}")
        raise HTTPException(
            status_code=500, detail="Error interno del servidor"
        )


@app.get("/api/eventos/{slug}")
def get_evento_by_slug(slug: str):
    """
    Obtiene un evento específico por su slug desde la tabla unificada eventos_sociales.
    """
    try:
        res = supabase.table("eventos_sociales").select("*").eq("slug", slug).execute()
        if res.data:
            evento = res.data[0]
            if evento.get("estado") != "publicado":
                raise HTTPException(status_code=404, detail="Evento no disponible")
            return {"evento": evento}
            
        raise HTTPException(status_code=404, detail="Evento no encontrado")
        
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        logger.error(f"Error obteniendo evento por slug: {str(e)}")
        raise HTTPException(status_code=500, detail="Error interno del servidor")


@app.post("/api/admin/eventos", status_code=201)
def create_evento(
    evento: EventCreate,
    request: Request,
    background_tasks: BackgroundTasks,
    admin_user=Depends(get_current_admin),
):
    """Crea un nuevo evento desde el Panel Administrador en eventos_sociales"""
    try:
        evento_data = evento.dict(exclude_unset=True)
        # Sanitizar URLs
        for key in ["link_instagram", "link_facebook", "link_externo"]:
            if evento_data.get(key):
                evento_data[key] = str(evento_data[key])
        
        # Generar slug
        evento_data["slug"] = f"{slugify(evento.titulo)}-{uuid4().hex[:6]}"
        evento_data["fuente"] = "admin"
        # external_id requerido NOT NULL — generar automático para eventos manuales
        evento_data["external_id"] = f"manual_{uuid4()}"
        # tipo_origen para métricas y filtrado futuro
        evento_data["tipo_origen"] = "manual"

        res = supabase.table("eventos_sociales").insert(evento_data).execute()

        if res.data:
            evento_creado = res.data[0]
            background_tasks.add_task(
                registrar_auditoria,
                usuario_id=admin_user.id,
                email_usuario=admin_user.email,
                rol_usuario="ADMIN",
                accion="CREATE",
                tabla="eventos_sociales",
                registro_id=evento_creado["id"],
                datos_anteriores=None,
                datos_nuevos=evento_data,
                modulo="Gestión Eventos",
                request=request,
            )
            return {"message": "Evento creado exitosamente", "evento": evento_creado}
        raise HTTPException(
            status_code=500, detail="Error desconocido al insertar evento"
        )
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail="Error interno del servidor")


@app.delete("/api/admin/eventos/{evento_id}")
def delete_evento(
    evento_id: str,
    request: Request,
    background_tasks: BackgroundTasks,
    admin_user=Depends(get_current_admin),
):
    """Elimina un evento desde el Panel Administrador"""
    try:
        evento_ant = supabase.table("eventos_sociales").select("*").eq("id", evento_id).execute()
        datos_anteriores = evento_ant.data[0] if evento_ant.data else None

        if not datos_anteriores:
            raise HTTPException(status_code=404, detail="Evento no encontrado")

        supabase.table("eventos_sociales").delete().eq("id", evento_id).execute()

        background_tasks.add_task(
            registrar_auditoria,
            usuario_id=admin_user.id,
            email_usuario=admin_user.email,
            rol_usuario="ADMIN",
            accion="DELETE",
            tabla="eventos_sociales",
            registro_id=evento_id,
            datos_anteriores=datos_anteriores,
            datos_nuevos=None,
            modulo="Gestión Eventos",
            request=request,
        )
        return {"message": "Evento eliminado correctamente"}
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(
            status_code=500, detail="Error interno del servidor"
        )


@app.put("/api/admin/eventos/{evento_id}")
def update_evento(
    evento_id: str,
    req: EventUpdate,
    request: Request,
    background_tasks: BackgroundTasks,
    admin_user=Depends(get_current_admin),
):
    """Actualiza un evento desde el Panel Administrador"""
    try:
        update_data = {k: v for k, v in req.dict(exclude_unset=True).items() if v is not None}
        if not update_data:
            return {"message": "Sin cambios"}

        # Sanitizar URLs
        for key in ["link_instagram", "link_facebook", "link_externo"]:
            if update_data.get(key):
                update_data[key] = str(update_data[key])
        
        # Generar nuevo slug solo si cambia el título
        if "titulo" in update_data:
            update_data["slug"] = f"{slugify(update_data['titulo'])}-{uuid4().hex[:6]}"

        evento_ant = supabase.table("eventos_sociales").select("*").eq("id", evento_id).execute()
        datos_anteriores = evento_ant.data[0] if evento_ant.data else None

        if not datos_anteriores:
            raise HTTPException(status_code=404, detail="Evento no encontrado")

        res = (
            supabase.table("eventos_sociales").update(update_data).eq("id", evento_id).execute()
        )

        background_tasks.add_task(
            registrar_auditoria,
            usuario_id=admin_user.id,
            email_usuario=admin_user.email,
            rol_usuario="ADMIN",
            accion="UPDATE",
            tabla="eventos_sociales",
            registro_id=evento_id,
            datos_anteriores=datos_anteriores,
            datos_nuevos=update_data,
            modulo="Gestión Eventos",
            request=request,
        )
        return {"message": "Evento actualizado correctamente", "evento": res.data[0]}
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(
            status_code=500, detail="Error interno del servidor"
        )


@app.post("/api/v1/importar-evento")
async def importar_evento(payload: WebhookEventoPayload, request: Request, background_tasks: BackgroundTasks):
    """
    Endpoint para recibir publicaciones de Make.com (Instagram/Facebook) estructuradas.
    """
    import json
    logger.info(f"==> Iniciando IMPORTAR EVENTO [external_id: {payload.external_id}]")
    
    # Validaciones obligatorias
    if not payload.external_id:
        raise HTTPException(status_code=400, detail="external_id es obligatorio")
    if not payload.titulo:
        raise HTTPException(status_code=400, detail="titulo es obligatorio")

    # Guardar LOG de recepción seguro (resumen sin payload completo)
    try:
        supabase.table("webhook_logs").insert({
            "endpoint": "/api/v1/importar-evento",
            "source": "instagram_make",
            "external_id": payload.external_id,
            "payload_resumen": {
                "titulo": payload.titulo,
                "fecha": payload.fecha,
                "lugar": payload.lugar
            },
            "status": "pending",
        }).execute()
    except Exception as e:
        logger.error(f"Error guardando webhook_log preliminar: {e}")

    # 1. Validar Token de seguridad o Webhook Secret
    token = request.headers.get("X-Webhook-Token")
    secret_header = request.headers.get("x-webhook-secret")
    webhook_secret = os.getenv("WEBHOOK_SECRET")
    secret_token = os.getenv("WEBHOOK_SECRET_TOKEN")

    if not webhook_secret and not secret_token:
        logger.critical("[WEBHOOK EVENTOS] Variables de entorno de seguridad no configuradas.")
        # Actualizar LOG
        supabase.table("webhook_logs").update({
            "status": "error", "error_message": "Webhook not configured"
        }).eq("external_id", payload.external_id).execute()
        raise HTTPException(status_code=503, detail="Webhook not configured")

    authorized = False
    if secret_header and webhook_secret and secrets.compare_digest(secret_header, webhook_secret):
        authorized = True
    elif token and secret_token and secrets.compare_digest(token, secret_token):
        authorized = True

    if not authorized:
        logger.warning(f"[WEBHOOK EVENTOS] Acceso denegado: secret/token inválido.")
        # Actualizar LOG
        supabase.table("webhook_logs").update({
            "status": "error", "error_message": "Unauthorized"
        }).eq("external_id", payload.external_id).execute()
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Unauthorized")

    try:
        # FASE 2: Validar Municipio
        municipio_id_validado = None
        if payload.municipio:
            mun_res = (
                supabase.table("municipios")
                .select("id")
                .ilike("nombre", payload.municipio)
                .eq("activo", True)
                .limit(1)
                .execute()
            )
            if mun_res.data:
                municipio_id_validado = mun_res.data[0]["id"]

        # 3. Procesar Imagen de forma estricta
        logger.info(f"Procesando imagen para external_id {payload.external_id}")
        url_final_imagen = procesar_imagen_evento(payload.imagen_url, payload.external_id)

        # 4. Preparar datos
        hoy = datetime.now(pytz.timezone("America/Argentina/Buenos_Aires"))
        fecha_str = payload.fecha if payload.fecha else hoy.strftime("%Y-%m-%d")
        hora_str = payload.hora if payload.hora else hoy.strftime("%H:%M")
        
        titulo_corto = payload.titulo
        if len(titulo_corto) > 100:
            titulo_corto = titulo_corto[:97] + "..."

        remate_data = {
            "external_id": payload.external_id,
            "titulo": titulo_corto,
            "descripcion": payload.titulo, 
            "lugar": payload.lugar,
            "fecha": fecha_str,
            "hora": hora_str,
            "imagen_url": url_final_imagen,
            "metadata": payload.model_dump(),
            "estado": "publicado",
            "fuente": "sociedad_rural",
            "slug": payload.external_id
        }

        if municipio_id_validado:
            remate_data["municipio_id"] = municipio_id_validado

        # 5. Persistencia
        logger.info(f"Guardando en BD external_id {payload.external_id}")
        res = (
            supabase.table("eventos_sociales")
            .upsert(remate_data, on_conflict="external_id")
            .execute()
        )

        if res.data:
            evento_id = res.data[0].get("id")
            
            logger.info(json.dumps({
                "event": "importar_evento_success",
                "external_id": payload.external_id,
                "evento_id": evento_id
            }))

            # Actualizar LOG a success
            supabase.table("webhook_logs").update({
                "status": "success", "error_message": None
            }).eq("external_id", payload.external_id).execute()

            # DISPARAR PUSH AUTOMÁTICA
            # Solo usuarios aprobados — evita spam a cuentas pendientes/inactivas
            users_res = supabase.table("profiles").select("id").eq("estado", "APROBADO").execute()
            logger.info({
                "event": "push_dispatch_filtered",
                "total_users": len(users_res.data or []),
                "filter": "estado=APROBADO"
            })
            for u in (users_res.data or []):
                background_tasks.add_task(
                    enviar_notificacion_push_inapp,
                    usuario_id=u["id"],
                    titulo="Nuevo evento disponible",
                    mensaje=payload.titulo,
                    link_url=f"/eventos/{payload.external_id}",
                    evento_id=evento_id
                )

            return {
                "success": True,
                "message": "Evento importado correctamente",
                "id": evento_id,
                "external_id": payload.external_id,
            }

        return {"success": True, "message": "Actualizado sin cambios", "external_id": payload.external_id}

    except Exception as e:
        logger.error(json.dumps({
            "event": "importar_evento_error",
            "external_id": payload.external_id,
            "error": str(e)
        }))
        # Actualizar LOG a error
        supabase.table("webhook_logs").update({
            "status": "error", "error_message": str(e)
        }).eq("external_id", payload.external_id).execute()
        
        # Devolver 500 para Make retry
        raise HTTPException(status_code=500, detail="Error interno del servidor")


# ── ENDPOINTS GESTIÓN DE EVENTOS DE REDES SOCIALES (ADMIN) ───────────────────
@app.get("/api/admin/eventos-sociales")
def get_all_social_eventos(
    limit: int = 50,
    offset: int = 0,
    fuente: Optional[str] = None,  # FASE 2: filtro por origen (sociedad_rural / municipio)
    admin_user=Depends(get_current_admin),
):
    """Retorna todos los eventos importados de redes sociales para gestión admin"""
    try:
        query = (
            supabase.table("eventos_sociales")
            .select("*")
            .order("created_at", desc=True)
        )
        # FASE 2: Filtro opcional por fuente
        if fuente:
            query = query.eq("fuente", fuente)
        response = query.range(offset, offset + limit - 1).execute()
        return {"eventos": response.data}
    except Exception as e:
        raise HTTPException(status_code=500, detail="Error interno del servidor")


class UpdateEventoSocialStatusRequest(BaseModel):
    status: str  # "borrador" | "publicado" | "cancelado"


@app.put("/api/admin/eventos-sociales/{evento_id}/status")
def update_evento_social_status(
    evento_id: str,
    req: UpdateEventoSocialStatusRequest,
    request: Request,
    background_tasks: BackgroundTasks,
    admin_user=Depends(get_current_admin),
):
    """Aprueba o rechaza un evento de redes sociales"""
    try:
        evento_ant = (
            supabase.table("eventos_sociales").select("*").eq("id", evento_id).execute()
        )
        datos_anteriores = evento_ant.data[0] if evento_ant.data else None

        if not datos_anteriores:
            raise HTTPException(status_code=404, detail="Evento no encontrado")

        res = (
            supabase.table("eventos_sociales")
            .update({"estado": req.status})
            .eq("id", evento_id)
            .execute()
        )

        background_tasks.add_task(
            registrar_auditoria,
            usuario_id=admin_user.id,
            email_usuario=admin_user.email,
            rol_usuario="ADMIN",
            accion="UPDATE_STATUS",
            tabla="eventos_sociales",
            registro_id=evento_id,
            datos_anteriores=datos_anteriores,
            datos_nuevos={"status": req.status},
            modulo="Gestión Eventos Sociales",
            request=request,
        )
        return {"message": f"Estado actualizado a {req.status}", "evento": res.data[0]}
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(
            status_code=500, detail="Error interno del servidor"
        )


class EventoSocialUpdate(BaseModel):
    titulo: Optional[str] = None
    descripcion: Optional[str] = None
    lugar: Optional[str] = None
    fecha: Optional[str] = None
    hora: Optional[str] = None
    imagen_url: Optional[str] = None


@app.put("/api/admin/eventos-sociales/{evento_id}")
def update_evento_social(
    evento_id: str,
    req: EventoSocialUpdate,
    request: Request,
    background_tasks: BackgroundTasks,
    admin_user=Depends(get_current_admin),
):
    """Actualiza un evento de redes sociales desde el Panel Administrador"""
    try:
        update_data = {k: v for k, v in req.dict().items() if v is not None}
        if not update_data:
            return {"message": "Sin cambios"}

        evento_ant = (
            supabase.table("eventos_sociales").select("*").eq("id", evento_id).execute()
        )
        datos_anteriores = evento_ant.data[0] if evento_ant.data else None

        if not datos_anteriores:
            raise HTTPException(status_code=404, detail="Evento no encontrado")

        res = (
            supabase.table("eventos_sociales")
            .update(update_data)
            .eq("id", evento_id)
            .execute()
        )

        background_tasks.add_task(
            registrar_auditoria,
            usuario_id=admin_user.id,
            email_usuario=admin_user.email,
            rol_usuario="ADMIN",
            accion="UPDATE",
            tabla="eventos_sociales",
            registro_id=evento_id,
            datos_anteriores=datos_anteriores,
            datos_nuevos=update_data,
            modulo="Gestión Eventos Sociales",
            request=request,
        )
        return {"message": "Evento actualizado correctamente", "evento": res.data[0]}
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(
            status_code=500, detail="Error interno del servidor"
        )


@app.delete("/api/admin/eventos-sociales/{evento_id}")
def delete_evento_social(
    evento_id: str,
    request: Request,
    background_tasks: BackgroundTasks,
    admin_user=Depends(get_current_admin),
):
    """Elimina un evento de redes sociales"""
    try:
        evento_ant = (
            supabase.table("eventos_sociales").select("*").eq("id", evento_id).execute()
        )
        datos_anteriores = evento_ant.data[0] if evento_ant.data else None

        if not datos_anteriores:
            raise HTTPException(status_code=404, detail="Evento no encontrado")

        supabase.table("eventos_sociales").delete().eq("id", evento_id).execute()

        background_tasks.add_task(
            registrar_auditoria,
            usuario_id=admin_user.id,
            email_usuario=admin_user.email,
            rol_usuario="ADMIN",
            accion="DELETE",
            tabla="eventos_sociales",
            registro_id=evento_id,
            datos_anteriores=datos_anteriores,
            datos_nuevos=None,
            modulo="Gestión Eventos Sociales",
            request=request,
        )
        return {"message": "Evento eliminado correctamente"}
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(
            status_code=500, detail="Error interno del servidor"
        )


# ── ENDPOINTS DE NOTIFICACIONES Y FCM ───────────────────────────────────────
# NOTA: El registro completo de push tokens (con deduplicación, reasignación y
# límite de dispositivos) está implementado al final del archivo en /api/push-tokens.


@app.get("/api/notificaciones")
def get_user_notifications(limit: int = 50, current_user=Depends(get_current_user)):
    """Obtiene las notificaciones in-app del usuario conectado"""
    try:
        response = (
            supabase.table("notificaciones")
            .select("*")
            .eq("usuario_id", current_user.id)
            .order("fecha", desc=True)
            .limit(limit)
            .execute()
        )

        # Conteo de no leídas
        no_leidas = sum(1 for n in response.data if not n.get("leido", True))

        return {"notificaciones": response.data, "no_leidas": no_leidas}
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(
            status_code=500, detail="Error interno del servidor"
        )


@app.put("/api/notificaciones/marcar-leidas")
def mark_notifications_read(current_user=Depends(get_current_user)):
    """Marca todas las notificaciones del usuario como leídas (o saca la bolita roja)"""
    try:
        supabase.table("notificaciones").update({"leido": True}).eq(
            "usuario_id", current_user.id
        ).eq("leido", False).execute()

        return {"message": "Notificaciones marcadas como leídas"}
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(
            status_code=500, detail="Error interno del servidor"
        )


@app.put("/api/notificaciones/{notif_id}/leer")
def mark_notification_read(notif_id: str, current_user=Depends(get_current_user)):
    try:
        supabase.table("notificaciones").update({"leido": True}).eq(
            "id", notif_id
        ).eq("usuario_id", current_user.id).execute()
        return {"message": "OK"}
    except Exception as e:
        raise HTTPException(status_code=500, detail="Error interno del servidor")


@app.delete("/api/notificaciones/{notif_id}")
def delete_notification(notif_id: str, current_user=Depends(get_current_user)):
    try:
        supabase.table("notificaciones").delete().eq(
            "id", notif_id
        ).eq("usuario_id", current_user.id).execute()
        return {"message": "OK"}
    except Exception as e:
        raise HTTPException(status_code=500, detail="Error interno del servidor")


class PreferenciaSonidoRequest(BaseModel):
    sonido_habilitado: bool


@app.put("/api/preferencias/sonido")
def update_sound_preference(
    req: PreferenciaSonidoRequest, current_user=Depends(get_current_user)
):
    """Actualiza la preferencia de sonido para notificaciones del usuario"""
    try:
        # Actualizar en la tabla profiles
        supabase.table("profiles").update(
            {"sonido_notificaciones_habilitado": req.sonido_habilitado}
        ).eq("id", current_user.id).execute()

        return {
            "message": "Preferencia de sonido actualizada",
            "sonido_habilitado": req.sonido_habilitado,
        }
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(
            status_code=500, detail="Error interno del servidor"
        )


def enviar_notificacion_push_inapp(
    usuario_id: str, titulo: str, mensaje: str, link_url: Optional[str] = None, evento_id: Optional[str] = None, tipo: Optional[str] = None
):
    """
    Función utilitaria (interna) para enviar una notificación In-App y Push (vía FCM) a un usuario.
    Incluye soporte para sonido y limpieza de tokens de Firebase inválidos.
    """
    import json
    try:
        # 1. Guardar Notificación In-App en Base de Datos
        notif_data = {
            "usuario_id": usuario_id,
            "titulo": titulo,
            "mensaje": mensaje,
            "link_url": link_url,
            "leido": False,
            "fecha": datetime.now(
                pytz.timezone("America/Argentina/Buenos_Aires")
            ).isoformat(),
        }
        if tipo:
            notif_data["tipo"] = tipo
        if evento_id:
            notif_data["evento_id"] = evento_id

        # Guard de idempotencia: no duplicar notificaciones del mismo evento por usuario
        if evento_id:
            exists = (
                supabase.table("notificaciones")
                .select("id")
                .eq("usuario_id", usuario_id)
                .eq("evento_id", evento_id)
                .limit(1)
                .execute()
            )
            if exists.data:
                logger.info({
                    "event": "push_inapp_skipped_duplicate",
                    "usuario_id": usuario_id,
                    "evento_id": evento_id
                })
                return

        supabase.table("notificaciones").insert(notif_data).execute()

        # 2. Obtener preferencia de sonido del usuario
        try:
            profile_res = (
                supabase.table("profiles")
                .select("sonido_notificaciones_habilitado")
                .eq("id", usuario_id)
                .execute()
            )
            sound_enabled = (
                profile_res.data[0]["sonido_notificaciones_habilitado"]
                if profile_res.data
                else True
            )
        except Exception as e:
            logger.error(f"Error obteniendo preferencia de sonido: {e}")
            sound_enabled = True  # Default a True si hay error

        # 3. Obtener Token(s) FCM asociados al usuario para envíos Push
        tokens_res = (
            supabase.table("push_tokens")
            .select("token")
            .eq("usuario_id", usuario_id)
            .execute()
        )
        push_tokens = [t["token"] for t in tokens_res.data] if tokens_res.data else []

        # 4. Disparar FCM si está configurado y hay tokens
        if push_tokens:
            try:
                # Utilizamos firebase_admin si está instanciado
                firebase_admin.get_app()

                data_payload = {
                    "link_url": link_url or "/",
                    "sound_enabled": "true" if sound_enabled else "false",
                    "sound_file": "notification.mp3",  # Nombre del archivo de sonido
                }
                if evento_id:
                    data_payload["evento_id"] = str(evento_id)

                # Construir payload con soporte de sonido
                push_message = messaging.MulticastMessage(
                    notification=messaging.Notification(
                        title=titulo,
                        body=mensaje,
                    ),
                    data=data_payload,
                    # Para Android: configurar sonido en el payload
                    android=messaging.AndroidConfig(
                        priority="high",
                        notification=(
                            messaging.AndroidNotification(
                                sound="notification" if sound_enabled else None,
                                channel_id="high_importance_channel",
                            )
                            if sound_enabled
                            else None
                        ),
                    ),
                    # Para iOS: configurar sonido
                    apns=messaging.APNSConfig(
                        payload=(
                            messaging.APNSPayload(
                                aps=messaging.Aps(
                                    sound="notification.mp3" if sound_enabled else None,
                                    badge=1,
                                )
                            )
                            if sound_enabled
                            else None
                        )
                    ),
                    tokens=push_tokens
                )
                response = messaging.send_each_for_multicast(push_message)
                
                # Validar tokens rechazados para limpieza
                tokens_invalidos = []
                for idx, res in enumerate(response.responses):
                    if not res.success:
                        error_code = getattr(res.exception, "code", None)
                        if error_code in [
                            "registration-token-not-registered",
                            "invalid-argument",
                            "invalid-registration-token"
                        ]:
                            tokens_invalidos.append(push_tokens[idx])
                
                if tokens_invalidos:
                    # Limpiar tokens muertos en DB
                    supabase.table("push_tokens").delete().in_("token", tokens_invalidos).execute()
                    
                logger.info({
                    "event": "push_notification_sent",
                    "success": response.success_count,
                    "failure": response.failure_count,
                    "tokens_limpiados": len(tokens_invalidos),
                    "usuario_id": usuario_id
                })

            except ValueError:
                logger.info(json.dumps({
                    "event": "push_skipped_firebase_not_init",
                    "usuario_id": usuario_id
                }))
            except Exception as e:
                logger.error(json.dumps({
                    "event": "push_notification_error",
                    "usuario_id": usuario_id,
                    "error": str(e)
                }))

    except Exception as e:
        logger.error(json.dumps({
            "event": "enviar_notificacion_general_error",
            "usuario_id": usuario_id,
            "error": str(e)
        }))


def enviar_push_segmentado(
    titulo: str,
    mensaje: str,
    link_url: Optional[str] = None,
    municipio: Optional[str] = None,
    tipo_socio: Optional[str] = None,
) -> dict:
    """
    Envía notificaciones push segmentadas por municipio y/o tipo_socio.
    Filtra siempre por estado=APROBADO. Sin filtros = todos los aprobados.
    Reutiliza enviar_notificacion_push_inapp por usuario.
    NO reemplaza el flujo existente — es una función adicional.
    """
    try:
        query = supabase.table("profiles").select("id").eq("estado", "APROBADO")
        if municipio:
            query = query.eq("municipio", municipio)
        if tipo_socio:
            query = query.eq("tipo_socio", tipo_socio)

        users_res = query.execute()
        usuarios = users_res.data or []

        logger.info({
            "event": "push_segmentado_dispatch",
            "total_users": len(usuarios),
            "filtros": {"municipio": municipio, "tipo_socio": tipo_socio}
        })

        for u in usuarios:
            enviar_notificacion_push_inapp(
                usuario_id=u["id"],
                titulo=titulo,
                mensaje=mensaje,
                link_url=link_url or "/",
            )

        return {"ok": True, "total_enviados": len(usuarios)}
    except Exception as e:
        logger.error({
            "event": "push_segmentado_error",
            "error": str(e)
        })
        return {"ok": False, "error": str(e)}


class PushSegmentadoRequest(BaseModel):
    titulo: str
    mensaje: str
    link_url: Optional[str] = None
    municipio: Optional[str] = None
    tipo_socio: Optional[str] = None


@app.post("/api/admin/push-segmentado", status_code=200)
def admin_push_segmentado(
    req: PushSegmentadoRequest,
    admin_user=Depends(get_current_admin),
):
    """
    Envía un push segmentado desde el panel admin.
    Filtros opcionales: municipio, tipo_socio.
    Sin filtros: todos los socios APROBADOS.
    """
    result = enviar_push_segmentado(
        titulo=req.titulo,
        mensaje=req.mensaje,
        link_url=req.link_url,
        municipio=req.municipio,
        tipo_socio=req.tipo_socio,
    )
    if not result["ok"]:
        raise HTTPException(status_code=500, detail=result.get("error", "Error desconocido"))
    return result


@app.post("/api/notificaciones/test")
def test_send_notification(current_user=Depends(get_current_admin)):
    """Endpoint de QA: Manda una notificación in-app y push al propio admin logueado"""
    enviar_notificacion_push_inapp(
        usuario_id=current_user.id,
        titulo="Notificación de Prueba 🚀",
        mensaje="Si ves esto, las notificaciones in-app y Push están funcionando correctamente en tu dispositivo.",
        link_url="/",
    )
    return {"message": "Notificación disparada."}


def notificar_admins_nuevo_registro(nombre: str, tipo_usuario: str):
    """Inserta una notificación para todos los administradores ante un nuevo registro."""
    try:
        # Buscar todos los administradores
        admins = supabase.table("profiles").select("id").eq("rol", "ADMIN").execute()
        if not admins.data:
            return

        titulo = f"Nuevo Registro: {tipo_usuario.capitalize()}"
        mensaje = f"Se ha registrado un nuevo {tipo_usuario.lower()}: {nombre}. Requiere revisión para aprobación."

        for admin in admins.data:
            # tipo="admin" necesario para que el endpoint /api/admin/notificaciones-soporte las filtre correctamente
            enviar_notificacion_push_inapp(
                usuario_id=admin["id"],
                titulo=titulo,
                mensaje=mensaje,
                link_url="/admin",
                tipo="admin",
            )
    except Exception as e:
        logger.error(f"Error notificando admins: {e}")


def enviar_whatsapp(telefono: str, mensaje: str):
    """
    Función utilitaria para enviar mensajes de WhatsApp vía Evolution API.
    Se recomienda usar números con formato internacional (ej: 549...).
    """
    try:
        url_base = os.getenv("EVOLUTION_API_URL")
        instance = os.getenv("INSTANCE_NAME")
        apikey = os.getenv("EVOLUTION_API_TOKEN")

        if not all([url_base, instance, apikey]):
            logger.info(
                "Configuración de WhatsApp incompleta. Verifique EVOLUTION_API_URL, INSTANCE_NAME y EVOLUTION_API_TOKEN."
            )
            return

        # Asegurar que la URL tenga el protocolo correcto
        if url_base and not url_base.startswith(("http://", "https://")):
            url_base = f"https://{url_base}"


        url = f"{url_base}/message/sendText/{quote(instance)}"
        headers = {"Content-Type": "application/json", "apikey": apikey}

        # Limpiar el teléfono (solo dígitos)
        numero_limpio = "".join(filter(str.isdigit, telefono))

        # Lógica para Argentina: Si tiene 10 dígitos (ej: 3794xxxxxx), anteponer 549
        if len(numero_limpio) == 10:
            numero_limpio = f"549{numero_limpio}"
        # Si tiene 12 dígitos y empieza con 15 (ej: 153794330172), remover el 15 y anteponer 549
        elif len(numero_limpio) == 12 and numero_limpio.startswith("15"):
            numero_limpio = f"549{numero_limpio[2:]}"
        # Si tiene 13 y empieza con 549, ya está correcto.

        payload = {
            "number": numero_limpio,
            "text": mensaje,
            "delay": 1200,
            "linkPreview": True,
        }

        max_retries = 2
        timeout_sec = 3
        for attempt in range(1, max_retries + 1):
            try:
                response = requests.post(url, json=payload, headers=headers, timeout=timeout_sec)
                if response.status_code in [200, 201]:
                    logger.info(f"[WHATSAPP] Mensaje enviado exitosamente a {numero_limpio} (Intento {attempt})")
                    return True
                else:
                    logger.error(f"[WHATSAPP] Error API (Intento {attempt}/{max_retries}): {response.status_code} - {response.text}")
            except requests.exceptions.Timeout:
                logger.warning(f"[WHATSAPP] Timeout ({timeout_sec}s) para {numero_limpio}. (Intento {attempt}/{max_retries})")
            except requests.exceptions.ConnectionError:
                logger.error(f"[WHATSAPP] Error conexión a Evolution API. (Intento {attempt}/{max_retries})")
            except requests.exceptions.RequestException as req_err:
                logger.error(f"[WHATSAPP] Error request: {req_err}. (Intento {attempt}/{max_retries})")
                
            if attempt < max_retries:
                import time
                time.sleep(1) # Backoff simple de 1s
                
        logger.error(f"[WHATSAPP] ❌ Falló el envío a {numero_limpio} de forma definitiva tras {max_retries} intentos.")
        return False

    except Exception as e:
        logger.error(f"Error crítico enviando WhatsApp: {str(e)}")


# ─────────────────────────────────────────────────────────────────────────────
# 12. MÓDULO CONTABLE 2.0: PAGOS, VALIDACIÓN Y AUTOMATIZACIÓN
# ─────────────────────────────────────────────────────────────────────────────


class SubirComprobanteRequest(BaseModel):
    mes: int
    anio: int


class AprobarPagoRequest(BaseModel):
    pago_id: str


class RechazarPagoRequest(BaseModel):
    pago_id: str
    motivo: str




@app.get("/api/v1/perfil/estado-financiero")
def get_estado_financiero_perfil(current_user=Depends(get_current_user)):
    """
    Endpoint de solo lectura para la Fase 5 (Shadow Mode / Gradual Rollout).
    Retorna el estado financiero paralelo y los días de mora sin alterar la auth.
    """
    from services.financial_engine import calcular_dias_mora, calcular_estado_financiero
    

    socio_id = current_user.get("id")
    if not socio_id:
        raise HTTPException(status_code=401, detail="Usuario no identificado")
        
    # Obtener perfil y estado DB
    perfil_res = supabase.table("profiles").select("estado, estado_financiero, gracia_extendida_hasta").eq("id", socio_id).execute()
    if not perfil_res.data:
        raise HTTPException(status_code=404, detail="Perfil no encontrado")
        
    perfil = perfil_res.data[0]
    
    # Calcular mora real en vivo
    hoy = date.today()
    pagos_res = supabase.table("pagos_cuotas").select("fecha_vencimiento, estado_pago").eq("socio_id", socio_id).in_("estado_pago", ["PENDIENTE", "VENCIDO", "PENDIENTE_VALIDACION"]).execute()
    pagos = pagos_res.data or []
    
    tiene_pago_revision = any(pago["estado_pago"] == "PENDIENTE_VALIDACION" for pago in pagos)
    deudas_activas = [pago for pago in pagos if pago["estado_pago"] in ["PENDIENTE", "VENCIDO"]]
    
    max_dias_mora = 0
    if deudas_activas:
        deudas_activas.sort(key=lambda x: x["fecha_vencimiento"])
        vto_mas_antiguo = datetime.strptime(deudas_activas[0]["fecha_vencimiento"], "%Y-%m-%d").date()
        max_dias_mora = calcular_dias_mora(vto_mas_antiguo, hoy, solo_habiles=False)
        
    gracia_extendida = perfil.get("gracia_extendida_hasta")
    gracia_date = datetime.fromisoformat(gracia_extendida).date() if gracia_extendida else None
    
    estado_fin_calculado = calcular_estado_financiero(max_dias_mora, tiene_pago_revision, gracia_date)
    
    return {
        "estado_autoridad": perfil.get("estado"),
        "estado_financiero_db": perfil.get("estado_financiero"),
        "estado_financiero_calculado": estado_fin_calculado,
        "dias_mora": max_dias_mora,
        "dias_restantes_gracia": max(0, 40 - max_dias_mora) if max_dias_mora > 0 and max_dias_mora <= 40 else 0,
        "en_riesgo": estado_fin_calculado == "VENCIDO" and max_dias_mora >= 30,
        "tiene_pago_revision": tiene_pago_revision
    }

# 12.5 AUTOMACIÓN: Detección de Mora (Cron)
@app.post("/api/cron/detectar-mora")
def detectar_mora(
    request: Request,
    background_tasks: BackgroundTasks,
    admin_user=Depends(get_current_admin_optional),
):
    """
    Motor de detección de mora.
    Ejecución automática compatible con Cron o manual por Admin.
    Requiere: token de admin válido O header X-API-Secret con el API_SECRET_TOKEN.
    """
    # Seguridad: requiere admin autenticado O API secret token válido
    api_token = request.headers.get("X-API-Secret")
    if not admin_user and api_token != os.getenv("API_SECRET_TOKEN"):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Acceso no autorizado. Se requiere autenticación de admin o API secret válido."
        )

    hoy = datetime.now()

    # Si NO es admin, validar que sea después del día 10 (regla automática)
    if not admin_user and hoy.day < 10:
        return {"message": "Aún no es fecha de mora automática (esperar al día 11)"}
    cron_id = None
    if not admin_user:
        cron_id = acquire_cron_lock(supabase, "detectar_mora", "make.com")
        if not cron_id:
            return {"message": "Ejecución omitida. Ya se procesó hoy o hay un proceso en curso."}

    try:
        # 1. Buscar socios que NO tengan pago para el mes actual
        mes_actual = hoy.month
        anio_actual = hoy.year
        fecha_venci = f"{anio_actual}-{mes_actual:02d}-10"

        # Obtenemos todos los miembros aprobados/restringidos:
        # SOCIOs, COMERCIOs y EMPLEADOS COMERCIALES activos.
        query = (
            supabase.table("profiles")
            .select("id, nombre_apellido, telefono, rol, email, es_empleado_comercial, activo_empleado")
            .in_("estado", list(ESTADOS_ACTIVOS))
        )

        socios_res = query.execute()
        todos = socios_res.data or []

        if not admin_user:
            # Incluir SOCIOs y EMPLEADOS COMERCIALES activos.
            # Excluir COMERCIOs puros (no pagan cuota mensual propia).
            todos = [
                s for s in todos
                if s.get("rol") == "SOCIO"
                or (s.get("es_empleado_comercial") and s.get("activo_empleado", True))
            ]

        socios = [s for s in todos if s.get("email") not in EMAILS_EXCLUIDOS_MORA]

        # Definir rango del mes para la consulta de pagos (Ajuste 1)
        fecha_inicio_mes = f"{anio_actual}-{mes_actual:02d}-01"
        next_month = mes_actual + 1 if mes_actual < 12 else 1
        next_year = anio_actual if mes_actual < 12 else anio_actual + 1
        fecha_fin_mes = f"{next_year}-{next_month:02d}-01"

        # 1. Traer TODOS los pagos del mes en una sola query optimizada
        pagos_res = (
            supabase.table("pagos_cuotas")
            .select("socio_id")
            .gte("fecha_vencimiento", fecha_inicio_mes)
            .lt("fecha_vencimiento", fecha_fin_mes)
            .in_("estado_pago", ["PAGADO", "PENDIENTE_VALIDACION"])
            .execute()
        )

        # 2. Usar un Set en memoria (O(1) lookup) para socios al día
        socios_al_dia = {pago["socio_id"] for pago in pagos_res.data}

        # 3. Filtrar morosos
        morosos = [socio for socio in socios if socio["id"] not in socios_al_dia]
        detectados = len(morosos)

        if detectados > 0:
            # 4. Operaciones BULK divididas en chunks
            chunk_size = 100
            for i in range(0, detectados, chunk_size):
                chunk = morosos[i : i + chunk_size]
                chunk_ids = [m["id"] for m in chunk]

                try:
                    # A. Marcar como RESTRINGIDO en bloque
                    supabase.table("profiles").update(
                        {
                            "estado": "RESTRINGIDO",
                            "motivo": f"Mora automática cuota {mes_actual}/{anio_actual}",
                        }
                    ).in_("id", chunk_ids).execute()

                    # B. Upsert Deudas (Bulk). UNIQUE(socio_id, fecha_vencimiento) confirmado en DB (Ajuste 2)
                    deudas_bulk = []
                    for m in chunk:
                        socio_id = m["id"]
                        monto_cuota = 5000
                        try:
                            calculo = calcular_cuota_dinamica_internal(socio_id)
                            monto_cuota = calculo.get("monto_total", 5000)
                            logger.info(f"[MORA] Socio {socio_id} ({m.get('nombre_apellido', 'Sin Nombre')}) -> cuota dinámica calculada: ${monto_cuota}")
                        except Exception as e:
                            logger.error(
                                f"[MORA][CRITICAL_FALLBACK] ⚠️ Error calculando cuota para socio_id={socio_id} ({m.get('nombre_apellido', 'Sin Nombre')}). "
                                f"Aplicando fallback TEMPORAL de 5000 para evitar interrupción del cron masivo. Error: {str(e)}", 
                                exc_info=True
                            )
                            
                        deudas_bulk.append({
                            "socio_id": socio_id,
                            "monto": monto_cuota,
                            "fecha_vencimiento": fecha_venci,
                            "estado_pago": "PENDIENTE",
                        })

                    supabase.table("pagos_cuotas").upsert(
                        deudas_bulk, on_conflict="socio_id,fecha_vencimiento"
                    ).execute()

                    # C. Insertar Activity Logs en bloque
                    logs_bulk = [
                        {
                            "socio_id": m["id"],
                            "tipo_evento": "MORA_DETECTADA",
                            "descripcion": f"Detección automática de mora para cuota {mes_actual}/{anio_actual}",
                            "usuario_id": None,
                        } for m in chunk
                    ]
                    supabase.table("activity_log").insert(logs_bulk).execute()
                except Exception as e:
                    # Ajuste 3: Try/Catch por chunk para trazabilidad
                    logger.error(f"[DETECTAR MORA] Error procesando chunk de morosos (índices {i} a {i+chunk_size}): {str(e)}")
                    continue

            # 5. Notificaciones WhatsApp (síncrono por regla)
            for socio in morosos:
                if socio.get("telefono"):
                    mensaje_wa = (
                        f"Hola {socio['nombre_apellido']}! 👋\n"
                        f"Detectamos un atraso en el pago de tu cuota de *Sociedad Rural Del Norte De Corrientes* ({mes_actual}/{anio_actual}).\n\n"
                        "¿Deseás regularizar tu situación? Respondé *SÍ*, *ACEPTO* o *PAGAR* para enviarte el detalle de tu deuda y el link de pago."
                    )
                    enviar_whatsapp(socio["telefono"], mensaje_wa)

        if cron_id:
            release_cron_lock(supabase, cron_id, "SUCCESS")

        return {
            "message": f"Proceso completado. Socios detectados en mora: {detectados}"
        }

    except Exception as e:
        if cron_id:
            release_cron_lock(supabase, cron_id, "FAILED", str(e))
        logger.error(f"Error en detectar_mora: {str(e)}")
        raise HTTPException(status_code=500, detail="Error interno del servidor")


# 12.5b TEST: Endpoint de prueba directa WhatsApp (Solo Admin)
class TestWhatsAppRequest(BaseModel):
    numero: str  # ej: 3794330172
    mensaje: Optional[str] = None


@app.post("/api/admin/test-whatsapp")
def test_whatsapp_directo(
    req: TestWhatsAppRequest, admin_user=Depends(get_current_admin)
):
    """
    Envía un mensaje de WhatsApp de prueba directa a un número específico.
    Permite verificar la conectividad con Evolution API independientemente del motor de mora.
    """
    try:
        mensaje = req.mensaje or (
            "🔔 *PRUEBA - SOCIEDAD RURAL DEL NORTE DE CORRIENTES*\n\n"
            "Este es un mensaje de prueba del sistema automático de notificaciones. "
            "Si recibiste este mensaje, la integración con WhatsApp está funcionando correctamente.\n\n"
            "_Sociedad Rural Del Norte De Corrientes_"
        )
        enviar_whatsapp(req.numero, mensaje)
        return {
            "message": f"Mensaje enviado al número {req.numero}. Verificá el celular."
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail="Error interno del servidor")


@app.get("/api/admin/users/{user_id}/activity")
def get_user_activity(user_id: str, admin_user=Depends(get_current_admin)):
    """Consulta el historial de actividades de un socio específico"""
    try:
        # Validar UUID
        try:
            uuid.UUID(user_id)
        except ValueError:
            return {"activity": []}  # Si es simulado o inválido, retornar vacío

        res = (
            supabase.table("activity_log")
            .select("*")
            .eq("socio_id", user_id)
            .order("fecha", desc=True)
            .execute()
        )
        return {"activity": res.data}
    except Exception as e:
        raise HTTPException(status_code=500, detail="Error interno del servidor")


# 12.6 REPORTES: Exportación de Socios (Excel/PDF)
@app.get("/api/admin/reports/socios/excel")
def exportar_socios_excel(admin_user=Depends(get_current_admin)):
    """Genera un reporte en Excel (.xlsx) nativo con la lista de socios."""
    try:
        import pandas as pd

        # Consultar socios y comercios (que actúan como socios en el sistema)
        logger.info("[REPORTS] Solicitando perfiles para rol: SOCIO, COMERCIO, ADMIN")
        res = (
            supabase.table("profiles")
            .select(
                "nombre_apellido, dni, email, telefono, estado, municipio, created_at, rol"
            )
            .in_("rol", ["SOCIO", "COMERCIO", "ADMIN"])
            .execute()
        )

        logger.info(f"[REPORTS] Datos encontrados: {len(res.data) if res.data else 0}")

        if not res.data:
            return JSONResponse(
                status_code=404, content={"detail": "No hay socios para exportar"}
            )

        df = pd.DataFrame(res.data)

        # Mapeo de nombres de columnas
        cols_map = {
            "nombre_apellido": "Nombre y Apellido",
            "dni": "DNI",
            "email": "Email",
            "telefono": "Teléfono",
            "estado": "Estado",
            "municipio": "Municipio",
            "created_at": "Fecha de Alta",
        }
        df = df[list(cols_map.keys())].rename(columns=cols_map)

        # Formatear fecha
        df["Fecha de Alta"] = pd.to_datetime(df["Fecha de Alta"]).dt.strftime(
            "%d/%m/%Y"
        )

        # Crear Excel en memoria
        output = io.BytesIO()
        with pd.ExcelWriter(output, engine="openpyxl") as writer:
            df.to_excel(writer, index=False, sheet_name="Socios")

            # Ajustar ancho de columnas automáticamente (opcional pero profesional)
            worksheet = writer.sheets["Socios"]
            for i, col in enumerate(df.columns):
                column_len = max(df[col].astype(str).str.len().max(), len(col)) + 2
                worksheet.column_dimensions[chr(65 + i)].width = min(column_len, 50)

        output.seek(0)

        return StreamingResponse(
            output,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={
                "Content-Disposition": "attachment; filename=socios_sociedad_rural.xlsx"
            },
        )
    except Exception as e:
        logger.error(f"Error en reporte excel: {e}")
        raise HTTPException(status_code=500, detail="Error al generar el reporte Excel")


@app.get("/api/admin/reports/contabilidad/csv")
def exportar_contabilidad_csv(admin_user=Depends(get_current_admin)):
    """Genera un reporte CSV especializado para contabilidad con resumen de categorías."""
    try:
        # 1. Obtener todos los perfiles
        res = (
            supabase.table("profiles")
            .select(
                "nombre_apellido, dni, email, telefono, estado, municipio, rol, es_profesional, titular_id, created_at, es_empleado_comercial, activo_empleado"
            )
            .execute()
        )

        if not res.data:
            raise HTTPException(status_code=404, detail="No hay datos para exportar")

        data = res.data

        # 2. Calcular Conteos
        conteos = {
            "Socio Común": 0,
            "Grupo Familiar": 0,
            "Profesional": 0,
            "Comercial": 0,
            "Empleados": 0,
            "Total General (Al día)": 0,
        }

        for p in data:
            rol = p.get("rol", "SOCIO")
            titular_id = p.get("titular_id")
            es_profesional = p.get("es_profesional", False)
            estado = p.get("estado", "PENDIENTE")
            es_empleado = p.get("es_empleado_comercial", False) and p.get("activo_empleado", True)

            # Clasificación
            if es_empleado:
                conteos["Empleados"] += 1
            elif rol == "COMERCIO":
                if titular_id:
                    conteos["Empleados"] += 1
                else:
                    conteos["Comercial"] += 1
            else:  # SOCIO o fallback
                if titular_id:
                    conteos["Grupo Familiar"] += 1
                elif es_profesional:
                    conteos["Profesional"] += 1
                else:
                    conteos["Socio Común"] += 1

            # Total al día
            if estado == "APROBADO":
                conteos["Total General (Al día)"] += 1

        # 3. Generar CSV en memoria (Delimitado por punto y coma para Excel)
        output = io.StringIO()
        # Añadir BOM para que Excel detecte UTF-8 correctamente
        output.write("\ufeff")

        writer = csv.writer(output, delimiter=";", quoting=csv.QUOTE_MINIMAL)

        # Encabezado del Reporte
        writer.writerow(["REPORTE DE CONTABILIDAD - SOCIEDAD RURAL DEL NORTE DE CORRIENTES"])
        writer.writerow(
            [
                "Fecha de Generación",
                datetime.now(TZ_ARGENTINA).strftime("%d/%m/%Y %H:%M:%S"),
            ]
        )
        writer.writerow([])

        # DETALLE DE SOCIOS (Arriba)
        writer.writerow(["DETALLE DE SOCIOS"])
        headers = [
            "Nombre y Apellido",
            "DNI/CUIT",
            "Email",
            "Teléfono",
            "Categoría",
            "Municipio",
            "Estado",
            "Fecha Alta",
        ]
        writer.writerow(headers)

        # Filas de detalle
        for p in data:
            # Re-clasificar para mostrar en la columna Categoría
            rol = p.get("rol", "SOCIO")
            titular_id = p.get("titular_id")
            es_profesional = p.get("es_profesional", False)
            es_empleado = p.get("es_empleado_comercial", False) and p.get("activo_empleado", True)

            cat_label = "Socio Común"
            if es_empleado:
                cat_label = "Empleado Comercial"
            elif rol == "COMERCIO":
                cat_label = "Empleado Comercial" if titular_id else "Comercio"
            else:
                if titular_id:
                    cat_label = "Familiar (Adherente)"
                elif es_profesional:
                    cat_label = "Profesional"

            fecha_alta = (
                datetime.fromisoformat(p["created_at"].replace("Z", "+00:00")).strftime(
                    "%d/%m/%Y"
                )
                if p.get("created_at")
                else "-"
            )

            writer.writerow(
                [
                    p.get("nombre_apellido", "-"),
                    p.get("dni", "-"),
                    p.get("email", "-"),
                    p.get("telefono", "-"),
                    cat_label,
                    p.get("municipio", "No especificado"),
                    p.get("estado", "PENDIENTE"),
                    fecha_alta,
                ]
            )

        writer.writerow([])
        writer.writerow([])

        # Sección de Resumen (Abajo)
        writer.writerow(["RESUMEN DE CATEGORÍAS"])
        writer.writerow(["Categoría", "Cantidad"])
        for cat, cant in conteos.items():
            writer.writerow([cat, cant])

        # 4. Retornar StreamingResponse
        output.seek(0)
        return StreamingResponse(
            io.BytesIO(output.getvalue().encode("utf-8-sig")),
            media_type="text/csv",
            headers={
                "Content-Disposition": "attachment; filename=reporte_contabilidad_sr.csv"
            },
        )
    except Exception as e:
        logger.error(f"Error en reporte contabilidad: {e}")
        raise HTTPException(
            status_code=500, detail="Error al generar el reporte de contabilidad"
        )


@app.get("/api/admin/reports/socios/pdf")
def exportar_socios_pdf(admin_user=Depends(get_current_admin)):
    """Genera un reporte PDF con diseño institucional de los socios."""
    try:
        from reportlab.lib.pagesizes import A4, landscape
        from reportlab.platypus import (
            SimpleDocTemplate,
            Table,
            TableStyle,
            Paragraph,
            Spacer,
            Image,
        )
        from reportlab.lib.styles import getSampleStyleSheet
        from reportlab.lib import colors
        from reportlab.lib.units import cm

        res = (
            supabase.table("profiles")
            .select("nombre_apellido, dni, estado, telefono, municipio, rol")
            .in_("rol", ["SOCIO", "COMERCIO", "ADMIN"])
            .execute()
        )
        logger.info(f"[REPORTS-PDF] Datos encontrados: {len(res.data) if res.data else 0}")
        data = res.data

        buffer = io.BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=landscape(A4), topMargin=20)
        elements = []

        styles = getSampleStyleSheet()

        # Logo Centrado
        logo_path = "logo.jpg"
        if os.path.exists(logo_path):
            img = Image(logo_path, width=4 * cm, height=4 * cm)
            img.hAlign = "CENTER"
            elements.append(img)
            elements.append(Spacer(1, 10))

        # Título
        elements.append(
            Paragraph("<b>SOCIEDAD RURAL DEL NORTE DE CORRIENTES</b>", styles["Title"])
        )
        elements.append(
            Paragraph("<b>INFORME ESTATUTARIO DE SOCIOS</b>", styles["Heading2"])
        )
        elements.append(Spacer(1, 10))
        elements.append(
            Paragraph(
                f"Fecha de reporte: {datetime.now(TZ_ARGENTINA).strftime('%d/%m/%Y %H:%M')}",
                styles["Normal"],
            )
        )
        elements.append(Spacer(1, 20))

        # Tabla de datos
        table_data = [
            ["SOCIO / NOMBRE Y APELLIDO", "DNI", "ESTADO", "TELÉFONO", "MUNICIPIO"]
        ]
        for s in data:
            # Limpieza de datos Nones para evitar "None" en el PDF
            nombre = s.get("nombre_apellido") or "-"
            dni = s.get("dni") or "-"
            estado = s.get("estado") or "-"
            tel = s.get("telefono") or "-"
            muni = s.get("municipio") or "No especificado"

            table_data.append([str(nombre), str(dni), str(estado), str(tel), str(muni)])

        # Diseño de la tabla
        t = Table(table_data, colWidths=[200, 80, 100, 100, 150])
        t.setStyle(
            TableStyle(
                [
                    (
                        "BACKGROUND",
                        (0, 0),
                        (-1, 0),
                        colors.Color(0.1, 0.4, 0.2),
                    ),  # Verde institucional sugerido
                    ("TEXTCOLOR", (0, 0), (-1, 0), colors.whitesmoke),
                    ("ALIGN", (0, 0), (-1, -1), "LEFT"),
                    ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                    ("FONTSIZE", (0, 0), (-1, 0), 10),
                    ("BOTTOMPADDING", (0, 0), (-1, 0), 10),
                    ("TOPPADDING", (0, 0), (-1, 0), 10),
                    ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
                    ("FONTSIZE", (0, 1), (-1, -1), 9),
                    ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ]
            )
        )
        elements.append(t)

        # Pie de página
        elements.append(Spacer(1, 30))
        elements.append(
            Paragraph(
                "Documento emitido por el Sistema de Gestión Digital - Sociedad Rural Del Norte De Corrientes.",
                styles["Italic"],
            )
        )

        doc.build(elements)
        buffer.seek(0)

        return StreamingResponse(
            buffer,
            media_type="application/pdf",
            headers={"Content-Disposition": "attachment; filename=reporte_socios.pdf"},
        )
    except Exception as e:
        logger.error(f"Error en reporte PDF: {e}")
        raise HTTPException(status_code=500, detail="Error al generar reporte PDF")


# ─────────────────────────────────────────────────────────────────────────────
# 14. WEBHOOK WHATSAPP (Chatbot de Consulta Automática)
@app.post("/api/whatsapp/webhook")
async def whatsapp_webhook(request: Request, background_tasks: BackgroundTasks):
    """
    Recibe eventos de Evolution API para responder consultas de socios de forma automática.
    """
    try:
        # LOG DE DEBUG SEGURO: trazabilidad sin exponer secrets ni tokens
        try:
            client_ip = request.client.host if request.client else "unknown"
            supabase.table("webhook_logs").insert({
                "endpoint": "/api/whatsapp/webhook",
                "source": "evolution_api",
                "status": "received",
                "payload_resumen": {"ip": client_ip}
            }).execute()
        except Exception as log_err:
            logger.error(f"[WEBHOOK] Error guardando log seguro: {log_err}")

        # 1. Validar Token de Seguridad obligatoriamente
        secret_header = request.headers.get("webhook-secret")
        env_secret = os.getenv("WEBHOOK_SECRET_TOKEN")

        if not env_secret:
            logger.critical("[WEBHOOK WA] WEBHOOK_SECRET_TOKEN no configurado en entorno.")
            raise HTTPException(status_code=503, detail="Webhook not configured")

        # Log inicial para debug
        logger.info("[WEBHOOK] Recibida petición WhatsApp.")

        if secret_header != env_secret:
            logger.warning("[WEBHOOK] Webhook secret mismatch. Acceso denegado.")
            raise HTTPException(status_code=401, detail="Webhook secret inválido")

        data = await request.json()
        event = data.get("event")

        # Solo procesamos la creación de nuevos mensajes
        if event != "messages.upsert":
            return {"status": "event-ignored"}

        message_data = data.get("data", {})
        key = message_data.get("key", {})

        if key.get("fromMe"):
            logger.info(
                "[WEBHOOK] Mensaje ignorado porque es 'fromMe' (del propio bot)."
            )
            return {"status": "self-message-ignored"}

        remote_jid = key.get("remoteJid", "")
        if not remote_jid.endswith("@s.whatsapp.net"):
            return {"status": "group-ignored"}

        numero_sender = remote_jid.split("@")[0]  # ej: 5493794330172

        # Extraer texto del mensaje (soporta texto simple y mensajes con respuesta)
        msg_obj = message_data.get("message", {})
        msg_text = ""
        if "conversation" in msg_obj:
            msg_text = msg_obj["conversation"]
        elif "extendedTextMessage" in msg_obj:
            msg_text = msg_obj["extendedTextMessage"].get("text", "")

        msg_text_upper = msg_text.strip().upper()
        logger.info(f"[WEBHOOK] De: {numero_sender} | Msg: {msg_text_upper}")

        # Palabras clave que activan el bot (petición de estado)
        keywords_estado = [
            "DEUDA",
            "ESTADO",
            "PAGOS",
            "VENCIMIENTO",
            "CUOTAS",
            "SALDO",
            "VENCIMIENTOS",
        ]

        # Palabras clave afirmativas (respuestas a la notificación de mora)
        keywords_afirmacion = [
            "SI",
            "SÍ",
            "ACEPTO",
            "PAGAR",
            "QUIERO PAGAR",
            "DALE",
            "OK",
            "OKAY",
            "PAGO",
        ]

        match_estado = any(kw in msg_text_upper for kw in keywords_estado)
        match_afirmacion = any(kw in msg_text_upper for kw in keywords_afirmacion)

        logger.info(
            f"[WEBHOOK] Match Estado: {match_estado} | Match Afirmación: {match_afirmacion}"
        )

        if match_estado or match_afirmacion:
            # Identificar al socio por los últimos 10 dígitos (formato Argentina)
            diez_digitos = "".join(filter(str.isdigit, numero_sender))[-10:]
            logger.info(f"[WEBHOOK] Buscando socio con últimos 10 dígitos: {diez_digitos}")

            res_user = (
                supabase.table("profiles")
                .select("id, nombre_apellido, estado")
                .ilike("telefono", f"%{diez_digitos}%")
                .execute()
            )

            if not res_user.data:
                logger.info(f"[WEBHOOK] Socio no encontrado para el número: {diez_digitos}")
                return {"status": "user-not-found"}

            socio = res_user.data[0]
            logger.info(
                f"[WEBHOOK] Socio encontrado: {socio['nombre_apellido']} (ID: {socio['id']})"
            )

            # Buscar cuotas en estado PENDIENTE
            res_pagos = (
                supabase.table("pagos_cuotas")
                .select("monto, fecha_vencimiento")
                .eq("socio_id", socio["id"])
                .eq("estado_pago", "PENDIENTE")
                .order("fecha_vencimiento")
                .execute()
            )

            if not res_pagos.data:
                logger.info(f"[WEBHOOK] El socio {socio['nombre_apellido']} no tiene deudas.")
                msg_ok = f"¡Hola {socio['nombre_apellido']}! 👋 No registramos cuotas pendientes a tu nombre. Tu cuenta está al día. ¡Muchas gracias!"
                background_tasks.add_task(enviar_whatsapp, numero_sender, msg_ok)
            else:
                total = sum(float(p["monto"]) for p in res_pagos.data)
                logger.info(
                    f"[WEBHOOK] Deuda total calculada para {socio['nombre_apellido']}: ${total}"
                )
                detalle = ""
                for p in res_pagos.data:
                    # Formatear fecha YYYY-MM-DD a MM/YYYY
                    fv = p["fecha_vencimiento"].split("-")
                    detalle += f"• Cuota {fv[1]}/{fv[0]}: ${float(p['monto']):,.0f}\n"

                msg_deuda = (
                    f"Hola {socio['nombre_apellido']}! 👋\n\n"
                    f"Tu estado de cuenta actual registra:\n\n"
                    f"{detalle}\n"
                    f"*Total adeudado: ${total:,.0f}*\n\n"
                    "Podés abonar y subir tu comprobante de transferencia siguiendo este link:\n"
                    "https://sociedadruraldelnorte.agentech.ar/pagar-cuota\n\n"
                    "_Muchas gracias! Sociedad Rural Del Norte De Corrientes._"
                )
                background_tasks.add_task(enviar_whatsapp, numero_sender, msg_deuda)

        return {"status": "success"}
    except Exception as e:
        logger.exception("[WEBHOOK WA] Error procesando webhook WhatsApp:")
        return {"status": "error"}


# ─────────────────────────────────────────────────────────────────────────────

# ─── SISTEMA DE COBRANZA DIGITAL ─────────────────────────────────────────────
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
import tempfile


class PagoActionRequest(BaseModel):
    pago_id: str
    motivo: Optional[str] = None


@app.get("/api/mis-pagos")
def get_mis_pagos(current_user=Depends(require_titular)):
    """Retorna los pagos del socio titular. Bloqueado para integrantes FAMILIAR."""
    try:
        pagos = (
            supabase.table("pagos_cuotas")
            .select("*")
            .eq("socio_id", current_user.id)
            .order("fecha_vencimiento", desc=True)
            .execute()
        )
        return {"pagos": pagos.data}
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        logger.error(f"[GET /api/mis-pagos] Error inesperado: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Error interno del servidor")


@app.post("/api/pagos/subir-comprobante")
async def subir_comprobante(
    mes: int = Form(...),
    anio: int = Form(...),
    file: UploadFile = File(...),
    current_user=Depends(require_titular),
):
    """Sube comprobante de pago. Bloqueado para integrantes FAMILIAR."""
    try:
        if not file.filename:
            raise HTTPException(
                status_code=400, detail="El archivo no puede estar vacío."
            )

        # Guardar en storage (usamos un bucket "recibos" o "comprobantes-pagos")
        bucket_name = "comprobantes-pagos"

        # Subir archivo
        file_bytes = await file.read()
        file_ext = file.filename.split(".")[-1]
        filename = f"{current_user.id}_{anio}_{mes}_{uuid4().hex[:6]}.{file_ext}"

        try:
            supabase.storage.create_bucket(bucket_name, public=True)
        except Exception:
            pass  # Si ya existe, ignoramos.

        supabase.storage.from_(bucket_name).upload(
            file=file_bytes,
            path=filename,
            file_options={"content-type": file.content_type},
        )
        url_publica = supabase.storage.from_(bucket_name).get_public_url(filename)

        fecha_vto = f"{anio}-{mes:02d}-10"

        monto_cuota = 0
        try:
            calculo = calcular_cuota_dinamica_internal(current_user.id)
            monto_cuota = calculo["monto_total"]
        except Exception:
            pass

        supabase.table("pagos_cuotas").upsert(
            {
                "socio_id": current_user.id,
                "monto": monto_cuota,
                "fecha_vencimiento": fecha_vto,
                "estado_pago": "PENDIENTE_VALIDACION",
                "comprobante_url": url_publica,
                "fecha_envio_comprobante": datetime.now().isoformat(),
            },
            on_conflict="socio_id,fecha_vencimiento",
        ).execute()

        return {"status": "success", "url": url_publica}
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        logger.error(f"[POST /api/pagos/subir-comprobante] Error inesperado: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Error interno del servidor")


@app.get("/api/admin/pagos/pendientes")
def get_pagos_pendientes(current_admin=Depends(get_current_admin)):
    try:
        # Hacemos join con profiles
        res = (
            supabase.table("pagos_cuotas")
            .select("*, profiles!inner(nombre_apellido, dni)")
            .eq("estado_pago", "PENDIENTE_VALIDACION")
            .order("fecha_envio_comprobante")
            .execute()
        )
        return {"pendientes": res.data}
    except Exception as e:
        logger.error(f"[GET /api/admin/pagos/pendientes] Error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Error interno del servidor")


@app.post("/api/admin/pagos/aprobar")
def validar_pago(
    req: PagoActionRequest,
    background_tasks: BackgroundTasks,
    current_admin=Depends(get_current_admin),
):
    pago_id = req.pago_id
    try:
        # Obtener datos del pago
        pago_res = (
            supabase.table("pagos_cuotas")
            .select("*, profiles!inner(nombre_apellido, dni, telefono)")
            .eq("id", pago_id)
            .execute()
        )
        if not pago_res.data:
            raise HTTPException(status_code=404, detail="Pago no encontrado")

        pago = pago_res.data[0]
        socio_profile = pago["profiles"]

        # Actualizar estado a PAGADO
        supabase.table("pagos_cuotas").update(
            {
                "estado_pago": "PAGADO",
                "fecha_validacion": datetime.now().isoformat(),
                "admin_validador_id": current_admin.id,
            }
        ).eq("id", pago_id).execute()

        # Update del perfil a APROBADO y borrar mora:
        supabase.table("profiles").update({"estado": "APROBADO", "motivo": None}).eq(
            "id", pago["socio_id"]
        ).execute()

        # Generar Recibo PDF
        pdf_bucket = "recibos"
        try:
            supabase.storage.create_bucket(pdf_bucket, public=True)
        except Exception:
            pass

        filename = f"recibo_{pago_id}.pdf"
        filepath = os.path.join(tempfile.gettempdir(), filename)

        c = canvas.Canvas(filepath, pagesize=A4)
        c.setFont("Helvetica-Bold", 20)
        c.drawString(50, 750, "SOCIEDAD RURAL DEL NORTE DE CORRIENTES")
        c.setFont("Helvetica", 14)
        c.drawString(50, 720, "RECIBO OFICIAL DE CUOTA SOCIAL")

        # Probar incluir logo
        logo_path = os.path.join(BASE_DIR, "logo.jpg")
        if os.path.exists(logo_path):
            try:
                c.drawImage(logo_path, 400, 710, width=100, height=100)
            except Exception:
                pass

        c.setFont("Helvetica", 12)
        c.drawString(50, 680, f"Recibo N°: {pago_id[-8:].upper()}")
        c.drawString(
            50, 660, f"Fecha de Pago: {datetime.now(TZ_ARGENTINA).strftime('%d/%m/%Y')}"
        )
        c.drawString(50, 640, "-" * 80)

        c.setFont("Helvetica", 14)
        c.drawString(50, 600, f"Señor/a: {socio_profile['nombre_apellido']}")
        c.drawString(50, 580, f"DNI/CUIT: {socio_profile['dni']}")
        c.drawString(50, 560, f"Concepto: Cuota Social {pago['fecha_vencimiento'][:7]}")
        c.setFont("Helvetica-Bold", 14)
        c.drawString(50, 530, f"Importe Abonado: ${pago['monto']}")
        c.drawString(50, 510, "Firma digital SRNC: Aprobado por tesorería.")

        c.save()

        with open(filepath, "rb") as f:
            pdf_bytes = f.read()

        supabase.storage.from_(pdf_bucket).upload(
            file=pdf_bytes,
            path=filename,
            file_options={"content-type": "application/pdf"},
        )
        pdf_url = supabase.storage.from_(pdf_bucket).get_public_url(filename)

        # Enviar WhatsApp al socio
        if socio_profile.get("telefono"):
            mensaje_wa = (
                f"¡Hola {socio_profile['nombre_apellido']}! 👋\n"
                f"Queriamos confirmarte que hemos recibido y validado el pago de tu Cuota Social ({pago['fecha_vencimiento'][:7]}).\n\n"
                f"Podés descargar tu Recibo Oficial directamente aquí: {pdf_url}\n\n"
                "Muchas gracias por estar al día. Sociedad Rural Del Norte De Corrientes."
            )
            background_tasks.add_task(
                enviar_whatsapp, socio_profile["telefono"], mensaje_wa
            )

        return {"status": "success", "pdf_url": pdf_url}
    except Exception as e:
        logger.exception("[/api/admin/pagos/aprobar] Error al validar pago:")
        raise HTTPException(status_code=500, detail="Error al procesar el pago.")


@app.post("/api/admin/pagos/rechazar")
def rechazar_pago(req: PagoActionRequest, current_admin=Depends(get_current_admin)):
    pago_id = req.pago_id
    motivo = req.motivo or "Sin motivo especificado"
    try:
        supabase.table("pagos_cuotas").update({
            "estado_pago": "RECHAZADO",
            "motivo_rechazo": motivo,
        }).eq("id", pago_id).execute()
        return {"status": "success", "motivo": motivo}
    except Exception as e:
        logger.error(f"[POST /api/admin/pagos/rechazar] Error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Error interno del servidor")


# ─────────────────────────────────────────────────────────────────────────────
# GESTIÓN DINÁMICA DE CUOTAS
# ─────────────────────────────────────────────────────────────────────────────

class CuotaUpdate(BaseModel):
    rol: str
    monto: float

class CuotasUpdateRequest(BaseModel):
    cuotas: list[CuotaUpdate]

@app.get("/api/cuotas/valores")
def get_cuotas_valores():
    try:
        response = supabase.table("configuracion_cuotas").select("*").execute()
        return {"cuotas": response.data}
    except Exception as e:
        raise HTTPException(status_code=500, detail="Error interno del servidor")

@app.put("/api/admin/cuotas/valores")
def update_cuotas_valores(req: CuotasUpdateRequest, current_admin=Depends(get_current_admin)):
    try:
        for cuota in req.cuotas:
            res = supabase.table("configuracion_cuotas").select("id").eq("rol", cuota.rol).execute()
            if res.data:
                supabase.table("configuracion_cuotas").update({
                    "monto": cuota.monto, 
                    "ultima_actualizacion": "now()"
                }).eq("rol", cuota.rol).execute()
            else:
                supabase.table("configuracion_cuotas").insert({
                    "rol": cuota.rol,
                    "monto": cuota.monto,
                    "ultima_actualizacion": "now()"
                }).execute()
        return {"status": "success"}
    except Exception as e:
        logger.error(f"[PUT /api/admin/cuotas/valores] Error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Error interno del servidor")

def calcular_cuota_dinamica_internal(user_id: str):
    # fetch user profile — incluye registration_source para validar arancel profesional
    profile_res = supabase.table("profiles").select(
        "rol, es_estudiante, es_profesional, registration_source, "
        "es_empleado_comercial, activo_empleado, empleado_comercio_id, tipo_vinculo"
    ).eq("id", user_id).execute()
    if not profile_res.data:
        raise HTTPException(status_code=404, detail="Perfil no encontrado")
    profile = profile_res.data[0]

    # Recalcular SIEMPRE consultando la tabla profiles (los dependientes están en profiles con titular_id)
    fam_res = supabase.table("profiles").select("id", count="exact").eq("titular_id", user_id).execute()
    familiares_count = fam_res.count if fam_res.count is not None else 0
    
    membership_type = "FAMILIAR" if familiares_count > 0 else "INDIVIDUAL"

    # SEGURIDAD: El descuento profesional SOLO aplica si el alta fue desde panel admin.
    # Registros públicos (registration_source='public' o None) abonan como socio común.
    # Esto evita manipulación via DevTools o requests manuales.
    registration_source = profile.get("registration_source", "public")
    descuento_profesional_habilitado = (registration_source == "admin")

    # Traer valores base
    cuotas_res = supabase.table("configuracion_cuotas").select("*").execute()
    cuotas_map = {str(c["rol"]).upper(): float(c["monto"]) for c in cuotas_res.data}
    
    comercio_nombre = None
    descuento_pct_aplicado = 0
    
    # Priority logic — EMPLEADO COMERCIAL tiene máxima prioridad para evitar
    # que sea clasificado como GRUPO FAMILIAR si tiene dependientes a su cargo.
    is_legacy_empleado = (
        profile.get("rol") == "COMERCIO"
        and profile.get("tipo_vinculo") in ["Empleado", "Encargado"]
    )
    
    if (profile.get("es_empleado_comercial") and profile.get("activo_empleado", True)) or is_legacy_empleado:
        # EMPLEADO COMERCIAL: arancel fijo configurable desde panel admin.
        # SEGURIDAD: validamos el vínculo comercio en el backend, nunca confiamos en el frontend.
        # IMPORTANTE: el flag es_empleado_comercial es la fuente de verdad principal.
        # Si el vínculo comercio no está activo, se mantiene el arancel de EMPLEADO COMERCIAL
        # (NO se hace fallback a SOCIO, para no castigar al empleado por un problema de configuración).
        comercio_id = profile.get("empleado_comercio_id")
        if comercio_id:
            try:
                comercio_res = supabase.table("profiles").select("estado, nombre_apellido").eq("id", comercio_id).execute()
                if comercio_res.data and comercio_res.data[0].get("estado") == "APROBADO":
                    comercio_nombre = comercio_res.data[0].get("nombre_apellido")
            except Exception:
                pass
        rol_efectivo = "EMPLEADO COMERCIAL"
        tipo_plan = "Empleado Comercial"
    elif membership_type == "FAMILIAR":
        rol_efectivo = "GRUPO FAMILIAR"
        tipo_plan = "Grupo Familiar"
    elif profile.get("es_profesional") and descuento_profesional_habilitado:
        # Solo aplica precio profesional si fue dado de alta desde el panel admin
        rol_efectivo = "PROFESIONAL"
        tipo_plan = "Socio Profesional"
    elif profile.get("es_estudiante"):
        rol_efectivo = "ESTUDIANTE"
        tipo_plan = "Estudiante"
    else:
        rol_efectivo = str(profile.get("rol", "SOCIO")).upper()
        tipo_plan = "Individual"
        
    monto_base = cuotas_map.get(rol_efectivo, 0)
    
    # Defaults in case not in DB yet (o rol sin monto configurado)
    # REGLA: cada rol tiene su default propio. El fallback final es SOCIO SOLO para rol=SOCIO.
    # COMERCIO y cualquier otro rol sin monto configurado NO heredan la cuota de SOCIO.
    if monto_base == 0:
        if rol_efectivo == "GRUPO FAMILIAR":
            monto_base = 20000
        elif rol_efectivo == "PROFESIONAL":
            monto_base = 7000
        elif rol_efectivo == "EMPLEADO COMERCIAL":
            monto_base = 8000  # Default $8000 monto fijo (configurable por admin en Gestión Aranceles)
        elif rol_efectivo == "ESTUDIANTE":
            monto_base = 5000
        elif rol_efectivo == "SOCIO":
            monto_base = cuotas_map.get("SOCIO", 10000)
        else:
            # COMERCIO u otro rol sin cuota propia: sin obligación de pago mensual
            monto_base = 0

    # Estado de cuota
    estado_cuota = "Al Día"
    try:
        pagos_res = supabase.table("pagos_cuotas").select("estado_pago").eq("socio_id", user_id).in_("estado_pago", ["PENDIENTE", "VENCIDO"]).execute()
        if pagos_res.data:
            if any(p["estado_pago"] == "VENCIDO" for p in pagos_res.data):
                estado_cuota = "Deuda Pendiente"
            else:
                estado_cuota = "Pago Pendiente"
    except Exception:
        pass
    
    monto_total = monto_base
    monto_base_usado = monto_base

    detalle_res = {
        "base": monto_base_usado,
        "familiares": familiares_count,
        "cantidad": familiares_count + 1 if membership_type == "FAMILIAR" else 1,
        "tipo_plan": tipo_plan
    }
    
    if rol_efectivo == "EMPLEADO COMERCIAL":
        detalle_res["comercio_nombre"] = comercio_nombre
        detalle_res["origen"] = "EMPLEADO_COMERCIAL"

    return {
        "monto": monto_total,
        "monto_total": monto_total, # For backward compatibility
        "tipo": rol_efectivo,
        "estado_cuota": estado_cuota,
        "detalle": detalle_res
    }

@app.get("/api/cuota/calcular")
def calcular_cuota_dinamica(current_user=Depends(require_titular)):
    """Calcula la cuota del socio titular. Bloqueado para integrantes FAMILIAR."""
    try:
        return calcular_cuota_dinamica_internal(current_user.id)
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e


# =============================================================================
# GESTIÓN DE EMPLEADOS COMERCIALES — Mi Negocio
# =============================================================================
# Endpoints para que comercios adheridos vinculen/gestionen sus empleados.
# Todos requieren JWT de un perfil con rol=COMERCIO y estado=APROBADO.
# El backend valida SIEMPRE la identidad y el vínculo real.
# =============================================================================

class VincularEmpleadoRequest(BaseModel):
    """Busca al empleado por DNI o email. Uno de los dos es obligatorio."""
    dni: Optional[str] = None
    email: Optional[str] = None


def _get_comercio_aprobado(current_user) -> dict:
    """Helper: verifica que el usuario actual sea un COMERCIO APROBADO.
    Lee el rol desde la tabla profiles (fuente de verdad) de forma defensiva,
    ya que el objeto current_user (Supabase Auth) no expone el atributo rol.
    Retorna el perfil completo o lanza 403."""
    try:
        perfil_res = supabase.table("profiles").select(
            "id, estado, nombre_apellido, rol, user_type"
        ).eq("id", current_user.id).execute()
    except Exception as e:
        logger.warning(f"[_get_comercio_aprobado] Error consultando perfil de {current_user.id}: {e}")
        raise HTTPException(
            status_code=403,
            detail="No se pudo verificar los permisos del comercio."
        )

    if not perfil_res.data:
        raise HTTPException(
            status_code=403,
            detail="Perfil de comercio no encontrado."
        )

    perfil = perfil_res.data[0]

    # Lectura defensiva del rol: soporta distintas variantes del modelo User
    rol_valor = (
        perfil.get("rol")
        or perfil.get("user_type")
        or ""
    )
    if str(rol_valor).upper() != "COMERCIO":
        logger.warning(
            f"[_get_comercio_aprobado] Usuario {current_user.id} intentó acceder "
            f"con rol='{rol_valor}' (no es COMERCIO)."
        )
        raise HTTPException(
            status_code=403,
            detail="Solo los comercios adheridos pueden gestionar empleados."
        )

    if perfil.get("estado") != "APROBADO":
        raise HTTPException(
            status_code=403,
            detail="El comercio debe estar aprobado para gestionar empleados."
        )

    return perfil


@app.get("/api/mi-negocio/empleados")
def listar_empleados_comercio(current_user=Depends(get_current_user)):
    """Lista todos los empleados vinculados al comercio actual."""
    _get_comercio_aprobado(current_user)
    try:
        res = supabase.table("profiles").select(
            "id, nombre_apellido, dni, email, telefono, estado, "
            "es_empleado_comercial, activo_empleado, fecha_vinculacion_comercio"
        ).eq("empleado_comercio_id", current_user.id).execute()
        return {"empleados": res.data or []}
    except Exception as e:
        logger.exception("[listar_empleados_comercio] Error:")
        raise HTTPException(status_code=500, detail="Error al obtener empleados")


@app.post("/api/mi-negocio/empleados")
def vincular_empleado_comercio(
    req: VincularEmpleadoRequest,
    current_user=Depends(get_current_user)
):
    """Vincula un empleado existente al comercio.
    Busca por DNI o email. Aplica todas las reglas de seguridad.
    """
    comercio = _get_comercio_aprobado(current_user)

    if not req.dni and not req.email:
        raise HTTPException(status_code=422, detail="Debe proveer DNI o email del empleado.")

    try:
        # Buscar empleado por DNI o email
        query = supabase.table("profiles").select(
            "id, nombre_apellido, dni, email, estado, empleado_comercio_id, es_empleado_comercial"
        )
        if req.dni:
            query = query.eq("dni", req.dni.strip())
        else:
            query = query.eq("email", req.email.strip().lower())

        empleado_res = query.execute()

        if not empleado_res.data:
            raise HTTPException(status_code=404, detail="No se encontró un socio con esos datos.")

        empleado = empleado_res.data[0]
        empleado_id = empleado["id"]

        # ── REGLAS DE SEGURIDAD ──────────────────────────────────────────────
        # 1. No autoasignación
        if empleado_id == current_user.id:
            raise HTTPException(status_code=400, detail="Un comercio no puede vincularse a sí mismo.")

        # 2. No doble vinculación (ya tiene otro comercio)
        if empleado.get("empleado_comercio_id") and empleado["empleado_comercio_id"] != current_user.id:
            raise HTTPException(
                status_code=409,
                detail="Este socio ya está vinculado a otro comercio. Debe ser desvinculado primero."
            )

        # 3. El empleado debe estar APROBADO
        if empleado.get("estado") not in ["APROBADO"]:
            raise HTTPException(
                status_code=400,
                detail=f"El socio tiene estado '{empleado.get('estado')}'. Solo socios APROBADOS pueden ser empleados comerciales."
            )
        # ─────────────────────────────────────────────────────────────────────

        # Vincular empleado al comercio
        supabase.table("profiles").update({
            "es_empleado_comercial": True,
            "empleado_comercio_id": current_user.id,
            "activo_empleado": True,
            "fecha_vinculacion_comercio": datetime.now(timezone.utc).isoformat(),
        }).eq("id", empleado_id).execute()

        logger.info(f"[vincular_empleado] Comercio {current_user.id} vinculó a empleado {empleado_id}")

        return {
            "status": "success",
            "mensaje": f"✅ {empleado['nombre_apellido']} vinculado como Empleado Comercial.",
            "empleado": {
                "id": empleado_id,
                "nombre_apellido": empleado["nombre_apellido"],
                "dni": empleado.get("dni"),
                "email": empleado.get("email"),
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("[vincular_empleado_comercio] Error:")
        raise HTTPException(status_code=500, detail="Error al vincular empleado")


@app.patch("/api/mi-negocio/empleados/{empleado_id}/estado")
def cambiar_estado_empleado(empleado_id: str, current_user=Depends(get_current_user)):
    """Activa o desactiva un empleado (soft toggle). Mantiene el vínculo para auditoría."""
    _get_comercio_aprobado(current_user)
    try:
        # Verificar que el empleado pertenece a este comercio
        emp_res = supabase.table("profiles").select("id, activo_empleado, nombre_apellido, empleado_comercio_id").eq("id", empleado_id).execute()
        if not emp_res.data:
            raise HTTPException(status_code=404, detail="Empleado no encontrado.")
        emp = emp_res.data[0]
        if emp.get("empleado_comercio_id") != current_user.id:
            raise HTTPException(status_code=403, detail="Este empleado no pertenece a tu comercio.")

        nuevo_estado = not emp.get("activo_empleado", True)
        supabase.table("profiles").update({
            "activo_empleado": nuevo_estado
        }).eq("id", empleado_id).execute()

        accion = "activado" if nuevo_estado else "desactivado"
        logger.info(f"[cambiar_estado_empleado] Empleado {empleado_id} {accion} por comercio {current_user.id}")
        return {"status": "success", "activo_empleado": nuevo_estado, "mensaje": f"Empleado {accion} correctamente."}
    except HTTPException:
        raise
    except Exception:
        logger.exception("[cambiar_estado_empleado] Error:")
        raise HTTPException(status_code=500, detail="Error al cambiar estado del empleado")


@app.delete("/api/mi-negocio/empleados/{empleado_id}")
def desvincular_empleado(empleado_id: str, current_user=Depends(get_current_user)):
    """Desvincula completamente a un empleado del comercio. Limpia todos los flags."""
    _get_comercio_aprobado(current_user)
    try:
        # Verificar propiedad del vínculo
        emp_res = supabase.table("profiles").select("id, nombre_apellido, empleado_comercio_id").eq("id", empleado_id).execute()
        if not emp_res.data:
            raise HTTPException(status_code=404, detail="Empleado no encontrado.")
        emp = emp_res.data[0]
        if emp.get("empleado_comercio_id") != current_user.id:
            raise HTTPException(status_code=403, detail="Este empleado no pertenece a tu comercio.")

        # Limpiar todos los flags de vínculo comercial
        supabase.table("profiles").update({
            "es_empleado_comercial": False,
            "empleado_comercio_id": None,
            "activo_empleado": True,
            "fecha_vinculacion_comercio": None,
        }).eq("id", empleado_id).execute()

        nombre = emp.get("nombre_apellido", empleado_id)
        logger.info(f"[desvincular_empleado] Empleado {empleado_id} desvinculado de comercio {current_user.id}")
        return {"status": "success", "mensaje": f"{nombre} desvinculado del comercio correctamente."}
    except HTTPException:
        raise
    except Exception:
        logger.exception("[desvincular_empleado] Error:")
        raise HTTPException(status_code=500, detail="Error al desvincular empleado")

# ─────────────────────────────────────────────────────────────────────────────
# ADMIN: VINCULACIÓN MANUAL DE EMPLEADOS COMERCIALES
# ─────────────────────────────────────────────────────────────────────────────

class AdminVincularEmpleadoRequest(BaseModel):
    empleado_id: str
    comercio_id: str  # ID del perfil COMERCIO


@app.post("/api/admin/empleados/vincular")
def admin_vincular_empleado(
    req: AdminVincularEmpleadoRequest,
    current_user=Depends(get_current_admin),
):
    """
    [SUPERADMIN/ADMIN] Vincula manualmente un socio como Empleado Comercial a un comercio.
    Útil cuando el comercio no lo vinculó desde Mi Negocio, o para corregir vínculos erróneos.
    """
    try:
        # Validar que el empleado existe y está APROBADO
        emp_res = supabase.table("profiles").select(
            "id, nombre_apellido, estado, empleado_comercio_id, es_empleado_comercial"
        ).eq("id", req.empleado_id).execute()
        if not emp_res.data:
            raise HTTPException(status_code=404, detail="Empleado no encontrado.")
        empleado = emp_res.data[0]
        if empleado.get("estado") not in ["APROBADO", "RESTRINGIDO"]:
            raise HTTPException(status_code=400, detail=f"El socio tiene estado '{empleado.get('estado')}'. Solo APROBADO o RESTRINGIDO.")

        # Validar que el comercio existe y está APROBADO
        com_res = supabase.table("profiles").select(
            "id, nombre_apellido, estado, rol"
        ).eq("id", req.comercio_id).execute()
        if not com_res.data:
            raise HTTPException(status_code=404, detail="Comercio no encontrado.")
        comercio = com_res.data[0]
        if comercio.get("rol") != "COMERCIO":
            raise HTTPException(status_code=400, detail="El ID provisto no corresponde a un perfil COMERCIO.")
        if comercio.get("estado") != "APROBADO":
            raise HTTPException(status_code=400, detail=f"El comercio tiene estado '{comercio.get('estado')}'. Debe estar APROBADO.")

        # Verificar doble vínculo
        if empleado.get("empleado_comercio_id") and empleado["empleado_comercio_id"] != req.comercio_id:
            raise HTTPException(
                status_code=409,
                detail="Este socio ya está vinculado a otro comercio. Desvinculalo primero."
            )

        # Aplicar vínculo
        supabase.table("profiles").update({
            "es_empleado_comercial": True,
            "empleado_comercio_id": req.comercio_id,
            "activo_empleado": True,
            "fecha_vinculacion_comercio": datetime.now(timezone.utc).isoformat(),
        }).eq("id", req.empleado_id).execute()

        logger.info(
            f"[admin_vincular_empleado] Admin {current_user.id} vinculó "
            f"empleado {req.empleado_id} a comercio {req.comercio_id}"
        )
        return {
            "status": "success",
            "mensaje": f"✅ {empleado['nombre_apellido']} vinculado como Empleado Comercial de {comercio['nombre_apellido']}.",
        }
    except HTTPException:
        raise
    except Exception:
        logger.exception("[admin_vincular_empleado] Error:")
        raise HTTPException(status_code=500, detail="Error al vincular empleado")


@app.delete("/api/admin/empleados/{empleado_id}/desvincular")
def admin_desvincular_empleado(
    empleado_id: str,
    current_user=Depends(get_current_admin),
):
    """[SUPERADMIN/ADMIN] Desvincula manualmente un empleado de su comercio."""
    try:
        emp_res = supabase.table("profiles").select(
            "id, nombre_apellido, empleado_comercio_id"
        ).eq("id", empleado_id).execute()
        if not emp_res.data:
            raise HTTPException(status_code=404, detail="Empleado no encontrado.")
        empleado = emp_res.data[0]

        supabase.table("profiles").update({
            "es_empleado_comercial": False,
            "empleado_comercio_id": None,
            "activo_empleado": True,
            "fecha_vinculacion_comercio": None,
        }).eq("id", empleado_id).execute()

        logger.info(f"[admin_desvincular_empleado] Admin {current_user.id} desvinculó empleado {empleado_id}")
        return {"status": "success", "mensaje": f"{empleado['nombre_apellido']} desvinculado correctamente."}
    except HTTPException:
        raise
    except Exception:
        logger.exception("[admin_desvincular_empleado] Error:")
        raise HTTPException(status_code=500, detail="Error al desvincular empleado")


# ─────────────────────────────────────────────────────────────────────────────
# MÓDULO CRON: CONTROL DE MORA Y WHATSAPP AUTOMÁTICO
# ─────────────────────────────────────────────────────────────────────────────

def business_days_between(start_date, end_date) -> int:
    """Calcula días hábiles entre dos fechas (excluye sábados y domingos)."""
    if start_date > end_date:
        return 0
    days = (end_date - start_date).days
    business_days = 0
    for i in range(days + 1):
        day = start_date + timedelta(days=i)
        if day.weekday() < 5:  # 0=Lunes, 4=Viernes
            business_days += 1
    return max(0, business_days - 1)


@app.get("/api/v1/cron/verificar-bloqueos")
def cron_verificar_bloqueos(request: Request):
    """
    Se ejecuta diario. Verifica vencimientos y bloquea ('SUSPENDIDO') 
    si pasaron 10 días hábiles de mora.
    """
    cron_secret_header = request.headers.get("X-Cron-Secret")
    cron_secret_env = os.getenv("CRON_SECRET")

    if not cron_secret_env:
        logger.critical("[CRON] CRON_SECRET no configurado. Endpoint /api/v1/cron/verificar-bloqueos bloqueado.")
        raise HTTPException(status_code=503, detail="Cron not configured")

    if not cron_secret_header or not secrets.compare_digest(cron_secret_header, cron_secret_env):
        client_ip = request.client.host if request.client else "unknown"
        logger.warning(f"[CRON] Acceso no autorizado desde {client_ip} a /api/v1/cron/verificar-bloqueos")
        raise HTTPException(status_code=401, detail="Unauthorized")

    cron_id = acquire_cron_lock(supabase, "verificar_bloqueos", "make.com")
    if not cron_id:
        return {"status": "skipped", "reason": "Already processed today or running"}

    try:
        hoy = datetime.now(TZ_ARGENTINA).date()
        
        # Consultamos cuotas en mora (PENDIENTE o VENCIDO)
        cuotas_res = supabase.table("pagos_cuotas").select("id, socio_id, fecha_vencimiento, estado_pago").in_("estado_pago", ["PENDIENTE", "VENCIDO"]).execute()
        cuotas = cuotas_res.data or []
        
        marcados = 0
        bloqueos = 0
        
        for cuota in cuotas:
            v_str = cuota.get("fecha_vencimiento")
            if not v_str:
                continue
                
            try:
                vencimiento = datetime.strptime(v_str, "%Y-%m-%d").date()
            except ValueError:
                continue
                
            estado_actual = cuota.get("estado_pago", "").upper()
            
            # 1. Marcar como vencido si ya pasó la fecha de vencimiento
            if hoy > vencimiento and estado_actual != "VENCIDO":
                supabase.table("pagos_cuotas").update({"estado_pago": "VENCIDO"}).eq("id", cuota["id"]).execute()
                estado_actual = "VENCIDO"
                marcados += 1
                
            # 2. Control de Bloqueo Automático (10 días hábiles)
            if estado_actual == "VENCIDO":
                dias_habiles = business_days_between(vencimiento, hoy)
                if dias_habiles >= 10:
                    socio_id = cuota["socio_id"]
                    
                    perfil_res = supabase.table("profiles").select("estado, email").eq("id", socio_id).execute()
                    if perfil_res.data:
                        perfil = perfil_res.data[0]
                        if perfil.get("email") in EMAILS_EXCLUIDOS_MORA:
                            continue  # Excluido de bloqueos automáticos
                        # Si no está suspendido ya, lo suspendemos
                        if perfil.get("estado") != "SUSPENDIDO":
                            supabase.table("profiles").update({
                                "estado": "SUSPENDIDO",
                                "motivo": f"Suspendido por mora de {dias_habiles} días hábiles (cuota {v_str})"
                            }).eq("id", socio_id).execute()
                            
                            # Loguear en auditoría
                            supabase.table("auditoria_logs").insert({
                                "usuario_id": socio_id,
                                "email_usuario": "sistema_cron",
                                "rol_usuario": "SYSTEM",
                                "accion": "bloqueo_por_mora",
                                "tabla_afectada": "profiles",
                                "registro_id": str(socio_id),
                                "datos_anteriores": {"estado": perfil.get("estado")},
                                "datos_nuevos": {"estado": "SUSPENDIDO", "motivo": "Mora >= 10 días hábiles"}
                            }).execute()
                            
                            bloqueos += 1
                            
        release_cron_lock(supabase, cron_id, "SUCCESS")
        return {"status": "success", "cuotas_vencidas_marcadas": marcados, "socios_suspendidos": bloqueos}
    except Exception as e:
        release_cron_lock(supabase, cron_id, "FAILED", str(e))
        logger.error(f"[CRON] Error verificar_bloqueos: {str(e)}")
        raise HTTPException(status_code=500, detail="Error interno del servidor")


@app.get("/api/v1/cron/notificar-mora")
def cron_notificar_mora(request: Request):
    """
    Se ejecuta el día 11 de cada mes.
    Notifica vía WhatsApp a los que tienen cuota vencida.
    Previene duplicados en el mismo mes usando la tabla 'notificaciones'.
    """
    cron_secret_header = request.headers.get("X-Cron-Secret")
    cron_secret_env = os.getenv("CRON_SECRET")

    if not cron_secret_env:
        logger.critical("[CRON] CRON_SECRET no configurado. Endpoint /api/v1/cron/notificar-mora bloqueado.")
        raise HTTPException(status_code=503, detail="Cron not configured")

    if not cron_secret_header or not secrets.compare_digest(cron_secret_header, cron_secret_env):
        client_ip = request.client.host if request.client else "unknown"
        logger.warning(f"[CRON] Acceso no autorizado desde {client_ip} a /api/v1/cron/notificar-mora")
        raise HTTPException(status_code=401, detail="Unauthorized")

    cron_id = acquire_cron_lock(supabase, "notificar_mora", "make.com")
    if not cron_id:
        return {"status": "skipped", "reason": "Already processed today or running"}

    try:
        hoy = datetime.now(TZ_ARGENTINA).date()
        mes_actual_str = f"{hoy.year}-{hoy.month:02d}"
        
        cuotas_res = supabase.table("pagos_cuotas").select("id, socio_id, fecha_vencimiento").eq("estado_pago", "VENCIDO").execute()
        cuotas = cuotas_res.data or []
        
        enviados = 0
        errores = 0
        
        for cuota in cuotas:
            socio_id = cuota["socio_id"]
            cuota_id = cuota["id"]
            
            # Verificación Anti-Duplicados: ¿Ya notificamos este mes por esta mora?
            notif_res = supabase.table("notificaciones").select("id").eq("usuario_id", socio_id).eq("tipo", "whatsapp_mora").like("metadata->>mes", mes_actual_str).execute()
            if notif_res.data and len(notif_res.data) > 0:
                continue  # Ya fue notificado
                
            perfil_res = supabase.table("profiles").select("nombre_apellido, telefono, estado").eq("id", socio_id).execute()
            if not perfil_res.data:
                continue
                
            perfil = perfil_res.data[0]
            telefono = perfil.get("telefono")
            
            if not telefono:
                continue
                
            # Extraer primer nombre
            nombre_completo = perfil.get("nombre_apellido", "Socio")
            nombre_corto = nombre_completo.split()[0] if nombre_completo else "Socio"
            
            mensaje = f"Hola {nombre_corto}, tu cuota se encuentra vencida desde el día 10. Regularizá tu pago para evitar la suspensión de tu carnet y beneficios."
            
            try:
                # Usa Evolution API internamente de forma síncrona
                enviar_whatsapp(telefono, mensaje)
                
                # Registrar el log de la notificación para evitar doble envío futuro
                supabase.table("notificaciones").insert({
                    "usuario_id": socio_id,
                    "tipo": "whatsapp_mora",
                    "mensaje": mensaje,
                    "estado_envio": "enviado",
                    "titulo": "Notificación Mora WhatsApp",
                    "metadata": {"cuota_id": cuota_id, "mes": mes_actual_str, "telefono": telefono}
                }).execute()
                
                enviados += 1
            except Exception as w_err:
                logger.error(f"[CRON] Error WhatsApp a {telefono}: {str(w_err)}")
                errores += 1
        
        release_cron_lock(supabase, cron_id, "SUCCESS")
        return {"status": "success", "whatsapp_enviados": enviados, "errores": errores}
    except Exception as e:
        release_cron_lock(supabase, cron_id, "FAILED", str(e))
        logger.error(f"[CRON] Error notificar_mora: {str(e)}")
        raise HTTPException(status_code=500, detail="Error interno del servidor")


# =============================================================================
# MÓDULO: RECORDATORIOS INTELIGENTES DE PAGO
# Sistema multichannel: WhatsApp + Push + In-App
# Lógica: socios con 40+ días registrados sin pago aprobado
# Anti-spam: cooldown configurable por canal (default 7 días)
# =============================================================================

# ── Constantes configurables ─────────────────────────────────────────────────
REMINDER_DIAS_DESDE_REGISTRO = 40      # días mínimos desde registro para recordar
REMINDER_COOLDOWN_DIAS = 7             # días de espera entre recordatorios del mismo canal
REMINDER_EXCLUIR_ESTADOS = frozenset({"SUSPENDIDO", "RECHAZADO"})  # no recordar a estos

# Link de pago institucional (frontend)
FRONTEND_URL = os.getenv("FRONTEND_URL", "https://sociedadruraldelnorte.agentech.ar")
PAYMENT_LINK = f"{FRONTEND_URL}/cuotas"


def _reminder_en_cooldown(user_id: str, canal: str, tipo_reminder: str = "MORA_40") -> bool:
    """
    Devuelve True si el usuario ya recibió un recordatorio por este canal y tipo
    dentro del período de cooldown (REMINDER_COOLDOWN_DIAS).
    Consulta la tabla payment_reminder_logs.
    """
    try:
        cutoff = (datetime.now(TZ_ARGENTINA) - timedelta(days=REMINDER_COOLDOWN_DIAS)).isoformat()
        res = (
            supabase.table("payment_reminder_logs")
            .select("id")
            .eq("user_id", user_id)
            .eq("canal", canal)
            .eq("tipo_reminder", tipo_reminder)
            .eq("resultado", "enviado")
            .gte("created_at", cutoff)
            .limit(1)
            .execute()
        )
        return bool(res.data)
    except Exception as e:
        logger.error(f"[REMINDER] Error verificando cooldown {user_id}/{canal}/{tipo_reminder}: {e}")
        return False  # ante la duda, no bloquear


def _registrar_log_reminder(
    user_id: str,
    canal: str,
    resultado: str,
    mensaje: str = "",
    motivo_omision: str = "",
    tipo_reminder: str = "MORA_40",
):
    """Persiste el resultado del intento de envío en payment_reminder_logs."""
    try:
        supabase.table("payment_reminder_logs").insert({
            "user_id": user_id,
            "canal": canal,
            "resultado": resultado,
            "tipo_reminder": tipo_reminder,
            "mensaje": mensaje[:1000] if mensaje else "",
            "motivo_omision": motivo_omision,
        }).execute()
    except Exception as e:
        logger.error(f"[REMINDER] Error guardando log {user_id}/{canal}: {e}")


def _detectar_socios_sin_pago() -> list[dict]:
    """
    Retorna lista de socios Y empleados comerciales activos que:
    - Tienen 40+ días (MORA_40) o exactamente 29 días (PRE_VENCIMIENTO_30) desde created_at
    - NO tienen ningún pago en estado APROBADO
    - NO tienen comprobante pendiente de revisión (REVISION)
    - NO están SUSPENDIDOS ni RECHAZADOS
    Incluye: rol=SOCIO + es_empleado_comercial=True y activo_empleado=True.
    """
    try:
        # Detectamos perfiles desde el día 29 en adelante para evaluar en memoria.
        fecha_limite = (
            datetime.now(TZ_ARGENTINA) - timedelta(days=29)
        ).isoformat()

        # Socios Y empleados comerciales activos registrados hace al menos 29 días
        perfiles_res = (
            supabase.table("profiles")
            .select("id, nombre_apellido, telefono, email, estado, created_at, rol, es_empleado_comercial, activo_empleado")
            .in_("estado", ["APROBADO", "PENDIENTE"])
            .lt("created_at", fecha_limite)
            .execute()
        )
        # Filtrar: SOCIOs normales + EMPLEADOS COMERCIALES activos
        perfiles = [
            p for p in (perfiles_res.data or [])
            if p.get("rol") == "SOCIO"
            or (p.get("es_empleado_comercial") and p.get("activo_empleado", True))
        ]

        socios_sin_pago = []
        now_utc = datetime.now(timezone.utc)

        for p in perfiles:
            if p.get("email") in EMAILS_EXCLUIDOS_MORA:
                continue
                
            uid = p["id"]

            # Excluir estados bloqueantes
            if p.get("estado") in REMINDER_EXCLUIR_ESTADOS:
                continue
                
            # Calcular días registrados exactos
            created_at_str = p.get("created_at")
            if not created_at_str:
                continue
                
            created_at_dt = datetime.fromisoformat(created_at_str.replace("Z", "+00:00"))
            dias_registrado = (now_utc - created_at_dt).days

            if dias_registrado >= REMINDER_DIAS_DESDE_REGISTRO:
                p["tipo_reminder"] = "MORA_40"
            elif dias_registrado == 29:
                p["tipo_reminder"] = "PRE_VENCIMIENTO_30"
            else:
                continue # Días entre 30 y 39 no reciben mensaje nuevo

            # Verificar si tiene algún pago APROBADO
            pago_aprobado = (
                supabase.table("pagos_cuotas")
                .select("id")
                .eq("socio_id", uid)
                .eq("estado_pago", "APROBADO")
                .limit(1)
                .execute()
            )
            if pago_aprobado.data:
                continue  # ya pagó, no recordar

            # Verificar si tiene comprobante en revisión (no molestar mientras espera validación)
            en_revision = (
                supabase.table("pagos_cuotas")
                .select("id")
                .eq("socio_id", uid)
                .eq("estado_pago", "REVISION")
                .limit(1)
                .execute()
            )
            if en_revision.data:
                continue  # esperando aprobación, no molestar

            socios_sin_pago.append(p)

        return socios_sin_pago

    except Exception as e:
        logger.error(f"[REMINDER] Error detectando socios sin pago: {e}")
        return []


def _construir_mensaje_whatsapp(nombre: str, tipo_reminder: str = "MORA_40") -> str:
    """Genera el mensaje WhatsApp institucional, diferenciando PREVENTIVO y MORA."""
    nombre_corto = nombre.split()[0] if nombre else "Estimado/a socio/a"
    
    if tipo_reminder == "PRE_VENCIMIENTO_30":
        return (
            f"Hola {nombre_corto} 👋\n\n"
            f"Te recordamos que mañana se cumplirán 30 días desde tu registro como socio de *Sociedad Rural Del Norte De Corrientes*.\n\n"
            f"Actualmente tu cuota aún figura pendiente de pago.\n\n"
            f"Contás con un plazo adicional de 10 días para regularizarla y evitar restricciones o bloqueos preventivos de tu cuenta y beneficios.\n\n"
            f"📲 Podés realizar el pago desde aquí:\n"
            f"{PAYMENT_LINK}\n\n"
            f"Si ya abonaste o enviaste comprobante, podés ignorar este mensaje.\n\n"
            f"Muchas gracias 🤝\n"
            f"_Sociedad Rural Del Norte De Corrientes_"
        )
    else:
        return (
            f"Hola {nombre_corto} 👋\n\n"
            f"Te recordamos que tu cuota de socio de *Sociedad Rural Del Norte De Corrientes* "
            f"aún figura como pendiente.\n\n"
            f"Para mantener activos tus beneficios y el acceso completo al portal, "
            f"te pedimos que regularices tu pago.\n\n"
            f"📲 Podés abonar desde el portal:\n"
            f"{PAYMENT_LINK}\n\n"
            f"Si ya realizaste el pago, podés subir tu comprobante desde la misma sección "
            f"o ignorar este mensaje.\n\n"
            f"¡Muchas gracias! 🤝\n"
            f"_Sociedad Rural Del Norte De Corrientes_"
        )


def _procesar_recordatorio_socio(socio: dict) -> dict:
    """
    Procesa los 3 canales de recordatorio para un socio.
    Respeta cooldowns individuales por canal.
    Retorna dict con resultado por canal.
    """
    uid = socio["id"]
    nombre = socio.get("nombre_apellido", "Socio")
    telefono = socio.get("telefono", "")
    tipo_reminder = socio.get("tipo_reminder", "MORA_40")
    resultado = {"user_id": uid, "nombre": nombre, "whatsapp": "omitido", "push": "omitido", "inapp": "omitido"}

    # ── Canal 1: WhatsApp ───────────────────────────────────────────────
    if telefono and not _reminder_en_cooldown(uid, "whatsapp", tipo_reminder):
        try:
            mensaje_wa = _construir_mensaje_whatsapp(nombre, tipo_reminder)
            enviar_whatsapp(telefono, mensaje_wa)
            _registrar_log_reminder(uid, "whatsapp", "enviado", mensaje_wa, tipo_reminder=tipo_reminder)
            resultado["whatsapp"] = "enviado"
        except Exception as e:
            _registrar_log_reminder(uid, "whatsapp", "fallido", motivo_omision=str(e), tipo_reminder=tipo_reminder)
            resultado["whatsapp"] = "fallido"
    elif not telefono:
        _registrar_log_reminder(uid, "whatsapp", "omitido", motivo_omision="sin_telefono", tipo_reminder=tipo_reminder)
    else:
        resultado["whatsapp"] = "cooldown"

    # ── Canal 2: Push Notification ──────────────────────────────────────
    if not _reminder_en_cooldown(uid, "push", tipo_reminder):
        try:
            # Usar función existente — crea in-app + FCM en un solo call
            # Pasamos tipo especial para que no duplique con el canal inapp
            tokens_res = (
                supabase.table("push_tokens")
                .select("token")
                .eq("usuario_id", uid)
                .execute()
            )
            push_tokens = [t["token"] for t in (tokens_res.data or [])]

            if push_tokens:
                import json as _json
                title_push = "💰 Tu cuota aún está pendiente" if tipo_reminder == "PRE_VENCIMIENTO_30" else "💰 Recordatorio de Pago"
                body_push = "Recordá regularizar tu cuota dentro del plazo disponible." if tipo_reminder == "PRE_VENCIMIENTO_30" else "Tu cuota aún figura pendiente. Ingresá para regularizarla."
                
                push_message = messaging.MulticastMessage(
                    notification=messaging.Notification(
                        title=title_push,
                        body=body_push,
                    ),
                    data={
                        "link_url": "/cuotas",
                        "tipo": "recordatorio_pago",
                        "sound_enabled": "true",
                    },
                    android=messaging.AndroidConfig(
                        priority="high",
                        notification=messaging.AndroidNotification(
                            sound="notification",
                            channel_id="high_importance_channel",
                        ),
                    ),
                    apns=messaging.APNSConfig(
                        payload=messaging.APNSPayload(
                            aps=messaging.Aps(sound="notification.mp3", badge=1)
                        )
                    ),
                    tokens=push_tokens,
                )
                resp_fcm = messaging.send_each_for_multicast(push_message)

                # Limpiar tokens inválidos
                invalidos = [
                    push_tokens[i]
                    for i, r in enumerate(resp_fcm.responses)
                    if not r.success
                    and getattr(r.exception, "code", None) in (
                        "registration-token-not-registered",
                        "invalid-argument",
                        "invalid-registration-token",
                    )
                ]
                if invalidos:
                    supabase.table("push_tokens").delete().in_("token", invalidos).execute()

                _registrar_log_reminder(uid, "push", "enviado", tipo_reminder=tipo_reminder)
                resultado["push"] = f"enviado ({resp_fcm.success_count}/{len(push_tokens)})"
            else:
                _registrar_log_reminder(uid, "push", "omitido", motivo_omision="sin_tokens_fcm", tipo_reminder=tipo_reminder)
                resultado["push"] = "sin_tokens"

        except ValueError:
            # Firebase no inicializado
            _registrar_log_reminder(uid, "push", "omitido", motivo_omision="firebase_no_init", tipo_reminder=tipo_reminder)
            resultado["push"] = "firebase_no_init"
        except Exception as e:
            _registrar_log_reminder(uid, "push", "fallido", motivo_omision=str(e), tipo_reminder=tipo_reminder)
            resultado["push"] = "fallido"
    else:
        resultado["push"] = "cooldown"

    # ── Canal 3: Notificación In-App ────────────────────────────────────
    if not _reminder_en_cooldown(uid, "inapp", tipo_reminder):
        try:
            msg_inapp = (
                "Mañana se cumplirán 30 días desde tu registro. Recordá regularizar tu cuota dentro del plazo disponible para evitar restricciones." 
                if tipo_reminder == "PRE_VENCIMIENTO_30" 
                else "Tu cuota de socio aún figura pendiente. Regularizá tu pago para mantener todos tus beneficios activos."
            )
            
            supabase.table("notificaciones").insert({
                "usuario_id": uid,
                "titulo": "💰 Recordatorio de Pago",
                "mensaje": msg_inapp,
                "link_url": "/cuotas",
                "leido": False,
                "tipo": "recordatorio_pago",
                "fecha": datetime.now(TZ_ARGENTINA).isoformat(),
                "metadata": {"payment_link": PAYMENT_LINK, "tipo_reminder": tipo_reminder},
            }).execute()
            _registrar_log_reminder(uid, "inapp", "enviado", tipo_reminder=tipo_reminder)
            resultado["inapp"] = "enviado"
        except Exception as e:
            _registrar_log_reminder(uid, "inapp", "fallido", motivo_omision=str(e), tipo_reminder=tipo_reminder)
            resultado["inapp"] = "fallido"
    else:
        resultado["inapp"] = "cooldown"

    return resultado


# ── CRON ENDPOINT ─────────────────────────────────────────────────────────────

@app.get("/api/v1/cron/recordatorios-pago")
def cron_recordatorios_pago(request: Request):
    """
    Cron diario (09:00 AM AR) — Detecta socios sin pago y envía recordatorios multichannel.

    Autenticación: Header X-Cron-Secret (mismo secreto que otros cron endpoints).
    Rate limit: protegido por el mismo CRON_SECRET.
    Canales: WhatsApp + Push Notification + In-App.
    Anti-spam: cooldown de 7 días por canal por usuario.
    Registra todo en payment_reminder_logs.

    Llamar desde Make.com / cron externo:
      GET /api/v1/cron/recordatorios-pago
      Header: X-Cron-Secret: {CRON_SECRET}
    """
    cron_secret_header = request.headers.get("X-Cron-Secret")
    cron_secret_env = os.getenv("CRON_SECRET")

    if not cron_secret_env:
        logger.critical("[REMINDER-CRON] CRON_SECRET no configurado. Endpoint bloqueado.")
        raise HTTPException(status_code=503, detail="Cron not configured")

    if not cron_secret_header or not secrets.compare_digest(cron_secret_header, cron_secret_env):
        client_ip = request.client.host if request.client else "unknown"
        logger.warning(f"[REMINDER-CRON] Acceso no autorizado desde {client_ip}")
        raise HTTPException(status_code=401, detail="Unauthorized")

    cron_id = acquire_cron_lock(supabase, "recordatorios_pago", "make.com")
    if not cron_id:
        return {"status": "skipped", "reason": "Already processed today or running"}

    logger.info("[REMINDER-CRON] Iniciando proceso de recordatorios de pago...")
    inicio = datetime.now(TZ_ARGENTINA)

    try:
        socios = _detectar_socios_sin_pago()
        logger.info(f"[REMINDER-CRON] {len(socios)} socios detectados sin pago.")

        resultados = []
        wa_enviados = 0
        push_enviados = 0
        inapp_enviados = 0

        for socio in socios:
            res = _procesar_recordatorio_socio(socio)
            resultados.append(res)
            if res["whatsapp"] == "enviado": wa_enviados += 1
            if "enviado" in str(res["push"]): push_enviados += 1
            if res["inapp"] == "enviado": inapp_enviados += 1

        duracion = (datetime.now(TZ_ARGENTINA) - inicio).total_seconds()

        logger.info(
            f"[REMINDER-CRON] Completado en {duracion:.1f}s — "
            f"WA:{wa_enviados} Push:{push_enviados} InApp:{inapp_enviados}"
        )

        release_cron_lock(supabase, cron_id, "SUCCESS")
        return {
            "status": "success",
            "socios_evaluados": len(socios),
            "whatsapp_enviados": wa_enviados,
            "push_enviados": push_enviados,
            "inapp_enviados": inapp_enviados,
            "duracion_segundos": round(duracion, 2),
            "detalle": resultados,
        }

    except Exception as e:
        release_cron_lock(supabase, cron_id, "FAILED", str(e))
        logger.error(f"[REMINDER-CRON] Error crítico: {str(e)}")
        raise HTTPException(status_code=500, detail="Error interno del servidor")


# ── ENDPOINT ADMIN: historial de recordatorios ────────────────────────────────

@app.get("/api/admin/recordatorios")
def admin_listar_recordatorios(
    request: Request,
    user_id: Optional[str] = None,
    canal: Optional[str] = None,
    resultado: Optional[str] = None,
    tipo_reminder: Optional[str] = None,
    limit: int = 100,
    current_user=Depends(get_current_admin),
):
    """
    Panel Admin: historial de recordatorios enviados.
    Filtros: user_id, canal (whatsapp/push/inapp), resultado (enviado/fallido/omitido).
    Requiere JWT de admin/superadmin.
    """
    try:
        query = (
            supabase.table("payment_reminder_logs")
            .select("*, profiles(nombre_apellido, email, telefono)")
            .order("created_at", desc=True)
            .limit(min(limit, 500))
        )
        if user_id:
            query = query.eq("user_id", user_id)
        if canal:
            query = query.eq("canal", canal)
        if resultado:
            query = query.eq("resultado", resultado)
        if tipo_reminder:
            query = query.eq("tipo_reminder", tipo_reminder)

        res = query.execute()
        return {"recordatorios": res.data or [], "total": len(res.data or [])}

    except Exception as e:
        logger.error(f"[REMINDER-ADMIN] Error listando recordatorios: {e}")
        raise HTTPException(status_code=500, detail="Error consultando recordatorios")


@app.get("/api/admin/recordatorios/metricas")
def admin_metricas_recordatorios(
    request: Request,
    current_user=Depends(get_current_admin),
):
    """
    Dashboard admin: métricas de cobranza y tasa de respuesta.
    Devuelve contadores agrupados por canal y resultado en últimos 30 días.
    """
    try:
        hace_30_dias = (datetime.now(TZ_ARGENTINA) - timedelta(days=30)).isoformat()

        res = (
            supabase.table("payment_reminder_logs")
            .select("canal, resultado")
            .gte("created_at", hace_30_dias)
            .execute()
        )
        logs = res.data or []

        metricas: dict = {}
        for log in logs:
            key = f"{log['canal']}.{log['resultado']}"
            metricas[key] = metricas.get(key, 0) + 1

        # Socios sin pago actuales
        socios_pendientes = len(_detectar_socios_sin_pago())

        return {
            "periodo_dias": 30,
            "socios_pendientes_actuales": socios_pendientes,
            "metricas_por_canal": metricas,
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail="Error interno del servidor")


@app.post("/api/admin/recordatorios/reenviar/{user_id}")
def admin_reenviar_recordatorio(
    user_id: str,
    request: Request,
    tipo_reminder: str = "MORA_40",
    current_user=Depends(get_current_superadmin),
):
    """
    Reenvío manual desde panel admin (solo SUPERADMIN).
    Ignora cooldown — fuerza el envío de los 3 canales.
    Registra en logs con resultado.
    """
    try:
        perfil_res = (
            supabase.table("profiles")
            .select("id, nombre_apellido, telefono, email, estado, rol, es_empleado_comercial, activo_empleado")
            .eq("id", user_id)
            .single()
            .execute()
        )
        if not perfil_res.data:
            raise HTTPException(status_code=404, detail="Socio no encontrado")

        perfil = perfil_res.data

        # Permitir SOCIO y EMPLEADO COMERCIAL activo. Rechazar otros roles.
        es_socio = perfil.get("rol") == "SOCIO"
        es_empleado = perfil.get("es_empleado_comercial") and perfil.get("activo_empleado", True)
        if not es_socio and not es_empleado:
            raise HTTPException(status_code=400, detail="Solo aplicable a socios y empleados comerciales activos")

        if perfil.get("estado") in REMINDER_EXCLUIR_ESTADOS:
            raise HTTPException(
                status_code=400,
                detail=f"No se puede recordar a un socio con estado {perfil.get('estado')}"
            )

        # Forzar envío ignorando cooldown (reenvío manual)
        resultado = {}

        # WhatsApp
        telefono = perfil.get("telefono", "")
        if telefono:
            try:
                msg = _construir_mensaje_whatsapp(perfil.get("nombre_apellido", "Socio"), tipo_reminder)
                enviar_whatsapp(telefono, msg)
                _registrar_log_reminder(user_id, "whatsapp", "enviado", msg, tipo_reminder=tipo_reminder)
                resultado["whatsapp"] = "enviado"
            except Exception as e:
                _registrar_log_reminder(user_id, "whatsapp", "fallido", motivo_omision=str(e), tipo_reminder=tipo_reminder)
                resultado["whatsapp"] = f"fallido: {str(e)}"
        else:
            resultado["whatsapp"] = "sin_telefono"

        # In-App (siempre disponible)
        try:
            msg_inapp = (
                "Mañana se cumplirán 30 días desde tu registro. Recordá regularizar tu cuota dentro del plazo disponible para evitar restricciones." 
                if tipo_reminder == "PRE_VENCIMIENTO_30" 
                else "La administración te recuerda que tu cuota sigue pendiente. Por favor regularizá tu situación para mantener tus beneficios activos."
            )
            supabase.table("notificaciones").insert({
                "usuario_id": user_id,
                "titulo": "💰 Recordatorio de Pago — Administración",
                "mensaje": msg_inapp,
                "link_url": "/cuotas",
                "leido": False,
                "tipo": "recordatorio_pago",
                "fecha": datetime.now(TZ_ARGENTINA).isoformat(),
                "metadata": {"tipo_reminder": tipo_reminder},
            }).execute()
            _registrar_log_reminder(user_id, "inapp", "enviado", tipo_reminder=tipo_reminder)
            resultado["inapp"] = "enviado"
        except Exception as e:
            resultado["inapp"] = f"fallido: {str(e)}"

        resultado["push"] = "procesado_via_inapp"

        return {"status": "ok", "resultado": resultado}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail="Error interno del servidor")


# ─────────────────────────────────────────────────────────────────────────────
# ── PUSH TOKENS: Registro de tokens FCM (Android / Web) ──────────────────────
# ─────────────────────────────────────────────────────────────────────────────

class PushTokenRequest(BaseModel):
    token: str
    plataforma: Optional[str] = "android"  # 'android' | 'web' | 'ios'


def _get_user_from_bearer(authorization: Optional[str]) -> Optional[str]:
    """
    Extrae y valida el JWT Bearer, retorna el user_id (sub) si es válido.
    Usa el cliente service_role de Supabase para verificar sin depender del anon key.
    Retorna None si el token es inválido o expirado.
    """
    if not authorization or not authorization.startswith("Bearer "):
        return None
    jwt_token = authorization.split(" ", 1)[1].strip()
    try:
        user_resp = supabase.auth.get_user(jwt_token)
        if user_resp and user_resp.user:
            return str(user_resp.user.id)
    except Exception as e:
        logger.warning(f"[PUSH_TOKEN] JWT inválido o expirado: {e}")
    return None


def _register_push_token(user_id: str, token_value: str, plataforma: str) -> dict:
    """
    Lógica de negocio para registrar/actualizar un token FCM.
    - Upsert por token (conflict en columna token): evita duplicados absolutos.
    - Si el token ya existe para otro user, lo reasigna (device cambió de cuenta).
    - Actualiza created_at (last_used) para mantenerlo vivo.
    - Limpieza automática de tokens viejos (> 30 días).
    - Limita a 5 dispositivos por usuario.
    """
    plataforma = (plataforma or "android").lower()
    if plataforma not in ("android", "web", "ios"):
        plataforma = "android"

    # 0. Limpieza automática global (tokens inactivos por > 30 días)
    try:
        thirty_days_ago = (datetime.utcnow() - timedelta(days=30)).isoformat()
        supabase.table("push_tokens").delete().lt("created_at", thirty_days_ago).execute()
    except Exception as e:
        logger.error({
            "event": "push_token_cleanup_error",
            "error": str(e)
        })

    # 1 y 2. UPSERT por token para evitar duplicaciones
    upsert_res = (
        supabase.table("push_tokens")
        .upsert(
            {
                "usuario_id": user_id,
                "token": token_value,
                "plataforma": plataforma,
                "created_at": datetime.utcnow().isoformat()
            },
            on_conflict="token"
        )
        .execute()
    )
    new_id = upsert_res.data[0]["id"] if upsert_res.data else None

    logger.info({
        "event": "push_token_upsert",
        "user_id": user_id,
        "status": "ok"
    })

    # 3. Cap de dispositivos: máx 5 por usuario (FIFO — elimina el más antiguo)
    all_tokens = (
        supabase.table("push_tokens")
        .select("id, created_at")
        .eq("usuario_id", user_id)
        .order("created_at", desc=False)
        .execute()
    )
    if all_tokens.data and len(all_tokens.data) > 5:
        oldest_ids = [r["id"] for r in all_tokens.data[: len(all_tokens.data) - 5]]
        supabase.table("push_tokens").delete().in_("id", oldest_ids).execute()
        logger.info({
            "event": "push_token_rotation",
            "user_id": user_id,
            "deleted_count": len(oldest_ids)
        })

    return {"status": "registered", "token_id": new_id}


@app.post("/api/push-tokens", status_code=200)
@limiter.limit("30/minute")
def register_push_token(
    payload: PushTokenRequest,
    request: Request,
):
    """
    Registra un token FCM. Requiere JWT válido en Authorization header.
    Llamado desde el frontend (web y Android vía Capacitor).
    """
    authorization = request.headers.get("Authorization")
    user_id = _get_user_from_bearer(authorization)

    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token de sesión inválido o ausente.",
        )

    if not payload.token or len(payload.token) < 20:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Token FCM inválido.",
        )

    try:
        result = _register_push_token(user_id, payload.token, payload.plataforma or "android")
        return {"ok": True, **result}
    except Exception as e:
        logger.error(f"[PUSH_TOKEN] Error inesperado: {e}")
        raise HTTPException(status_code=500, detail="Error al registrar token push.")


@app.post("/api/push/register-token", status_code=200)
@limiter.limit("30/minute")
def register_push_token_alias(
    payload: PushTokenRequest,
    request: Request,
):
    """
    Alias de /api/push-tokens para compatibilidad con CapacitorUI.tsx.
    Misma lógica — delega internamente.
    """
    authorization = request.headers.get("Authorization")
    user_id = _get_user_from_bearer(authorization)

    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token de sesión inválido o ausente.",
        )

    if not payload.token or len(payload.token) < 20:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Token FCM inválido.",
        )

    try:
        result = _register_push_token(user_id, payload.token, payload.plataforma or "android")
        return {"ok": True, **result}
    except Exception as e:
        logger.error(f"[PUSH_TOKEN] Error inesperado (alias): {e}")
        raise HTTPException(status_code=500, detail="Error al registrar token push.")


@app.delete("/api/push-tokens", status_code=200)
@limiter.limit("10/minute")
def unregister_push_token(
    payload: PushTokenRequest,
    request: Request,
):
    """
    Elimina un token FCM (logout / desactivar notificaciones).
    Requiere JWT válido.
    """
    authorization = request.headers.get("Authorization")
    user_id = _get_user_from_bearer(authorization)

    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="No autorizado.")

    try:
        supabase.table("push_tokens").delete().eq("token", payload.token).eq("usuario_id", user_id).execute()
        logger.info(f"[PUSH_TOKEN] Token eliminado para user {user_id}.")
        return {"ok": True, "status": "deleted"}
    except Exception as e:
        logger.error(f"[PUSH_TOKEN] Error al eliminar token: {e}")
        raise HTTPException(status_code=500, detail="Error al eliminar token push.")


# ─────────────────────────────────────────────────────────────────────────────
# RUTAS PARA OFERTAS / PROMOCIONES (PANEL COMERCIO)
# ─────────────────────────────────────────────────────────────────────────────

class OfertaCreate(BaseModel):
    titulo: str
    subtitulo: Optional[str] = None
    descripcion_corta: Optional[str] = None
    descripcion: Optional[str] = None
    tipo: str
    precio_lista: Optional[float] = None
    precio_final: Optional[float] = None
    porcentaje_descuento: Optional[float] = None
    monto_descuento: Optional[float] = None
    valor_descuento: Optional[float] = None  # campo canónico
    tipo_descuento: Optional[str] = None     # 'porcentaje' | 'fijo'
    whatsapp: Optional[str] = None
    direccion: Optional[str] = None
    localidad: Optional[str] = None
    ubicacion: Optional[str] = None
    categoria: Optional[str] = None
    destacada: Optional[bool] = False
    imagenes_secundarias: Optional[list] = None
    fecha_fin: Optional[str] = None
    imagen_url: Optional[str] = None
    instagram_url: Optional[str] = None
    facebook_url: Optional[str] = None

    _normalize_urls = validator("instagram_url", "facebook_url", pre=True, always=True, allow_reuse=True)(normalize_social_url)
    _normalize_whatsapp = validator("whatsapp", pre=True, always=True, allow_reuse=True)(normalize_whatsapp_number)

class OfertaUpdateActivo(BaseModel):
    activo: bool

class OfertaUpdate(BaseModel):
    titulo: Optional[str] = None
    subtitulo: Optional[str] = None
    descripcion_corta: Optional[str] = None
    descripcion: Optional[str] = None
    tipo: Optional[str] = None
    precio_lista: Optional[float] = None
    precio_final: Optional[float] = None
    porcentaje_descuento: Optional[float] = None
    monto_descuento: Optional[float] = None
    valor_descuento: Optional[float] = None
    tipo_descuento: Optional[str] = None
    whatsapp: Optional[str] = None
    direccion: Optional[str] = None
    localidad: Optional[str] = None
    ubicacion: Optional[str] = None
    categoria: Optional[str] = None
    destacada: Optional[bool] = None
    imagenes_secundarias: Optional[list] = None
    fecha_fin: Optional[str] = None
    imagen_url: Optional[str] = None
    instagram_url: Optional[str] = None
    facebook_url: Optional[str] = None
    activo: Optional[bool] = None

    _normalize_urls = validator("instagram_url", "facebook_url", pre=True, always=True, allow_reuse=True)(normalize_social_url)
    _normalize_whatsapp = validator("whatsapp", pre=True, always=True, allow_reuse=True)(normalize_whatsapp_number)

@app.get("/api/ofertas")
def get_ofertas(request: Request):
    authorization = request.headers.get("Authorization")
    user_id = _get_user_from_bearer(authorization)
    if not user_id:
        raise HTTPException(status_code=401, detail="No autorizado.")

    try:
        res = supabase.table("promociones").select("*").eq("comercio_id", user_id).order("created_at", desc=True).execute()
        return {"ofertas": res.data or []}
    except Exception as e:
        logger.error(f"[OFERTAS] Error al obtener ofertas: {e}")
        raise HTTPException(status_code=500, detail="Error al cargar las ofertas.")

@app.post("/api/ofertas")
def create_oferta(oferta: OfertaCreate, request: Request, background_tasks: BackgroundTasks):
    authorization = request.headers.get("Authorization")
    user_id = _get_user_from_bearer(authorization)
    if not user_id:
        raise HTTPException(status_code=401, detail="No autorizado.")

    # Verificar que el usuario sea un comercio
    # F0: Corregido de nombre_fantasia → nombre_comercio (columna real)
    comercio_check = supabase.table("comercios").select("id, nombre_comercio").eq("id", user_id).execute()
    if not comercio_check.data:
        raise HTTPException(status_code=403, detail="Solo los comercios pueden crear ofertas.")

    try:
        data_insert = {
            "comercio_id": user_id,
            "titulo": oferta.titulo,
            "subtitulo": oferta.subtitulo,
            "descripcion_corta": oferta.descripcion_corta,
            "descripcion": oferta.descripcion,
            "tipo": oferta.tipo,
            "precio_lista": oferta.precio_lista,
            "precio_final": oferta.precio_final,
            "porcentaje_descuento": oferta.porcentaje_descuento,
            "monto_descuento": oferta.monto_descuento,
            "valor_descuento": oferta.valor_descuento or 0.0,
            "tipo_descuento": oferta.tipo_descuento or "porcentaje",
            "whatsapp": oferta.whatsapp,
            "direccion": oferta.direccion,
            "localidad": oferta.localidad,
            "ubicacion": oferta.ubicacion,
            "categoria": oferta.categoria,
            "destacada": oferta.destacada or False,
            "imagenes_secundarias": oferta.imagenes_secundarias,
            "fecha_fin": oferta.fecha_fin,
            "imagen_url": oferta.imagen_url,
            "instagram_url": oferta.instagram_url,
            "facebook_url": oferta.facebook_url,
            "activo": True
        }
        res = supabase.table("promociones").insert(data_insert).execute()
        
        # Enviar notificación push a todos los socios aprobados en segundo plano
        # F0: Corregido de nombre_fantasia → nombre_comercio
        nombre_comercio = comercio_check.data[0].get("nombre_comercio", "Un comercio")
        background_tasks.add_task(
            enviar_push_segmentado,
            titulo=f"¡Nueva oferta en {nombre_comercio}!",
            mensaje=f"{oferta.titulo}",
            link_url="/MiNegocio",
            municipio=None,
            tipo_socio=None
        )
        
        return res.data[0]
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[OFERTAS] Error al crear oferta: {e}")
        raise HTTPException(status_code=500, detail="Error al crear la oferta.")

@app.patch("/api/ofertas/{oferta_id}")
def update_oferta_status(oferta_id: str, update_data: OfertaUpdateActivo, request: Request):
    authorization = request.headers.get("Authorization")
    user_id = _get_user_from_bearer(authorization)
    if not user_id:
        raise HTTPException(status_code=401, detail="No autorizado.")

    try:
        # Verificar que la oferta pertenezca al comercio
        check = supabase.table("promociones").select("comercio_id").eq("id", oferta_id).execute()
        if not check.data or check.data[0]["comercio_id"] != user_id:
            raise HTTPException(status_code=403, detail="No tienes permiso para modificar esta oferta.")

        res = supabase.table("promociones").update({"activo": update_data.activo}).eq("id", oferta_id).execute()
        return res.data[0]
    except Exception as e:
        logger.error(f"[OFERTAS] Error al actualizar oferta: {e}")
        raise HTTPException(status_code=500, detail="Error al actualizar la oferta.")

@app.put("/api/ofertas/{oferta_id}")
def update_oferta(oferta_id: str, update_data: OfertaUpdate, request: Request):
    authorization = request.headers.get("Authorization")
    user_id = _get_user_from_bearer(authorization)
    if not user_id:
        raise HTTPException(status_code=401, detail="No autorizado.")

    try:
        # Verificar que la oferta pertenezca al comercio
        check = supabase.table("promociones").select("comercio_id").eq("id", oferta_id).execute()
        if not check.data or check.data[0]["comercio_id"] != user_id:
            raise HTTPException(status_code=403, detail="No tienes permiso para modificar esta oferta.")

        # Filtrar valores None del payload
        update_dict = {k: v for k, v in update_data.dict(exclude_unset=True).items() if v is not None}
        if not update_dict:
            return {"message": "No hay datos para actualizar"}

        res = supabase.table("promociones").update(update_dict).eq("id", oferta_id).execute()
        if not res.data:
            raise HTTPException(status_code=404, detail="Oferta no encontrada.")
        return res.data[0]
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[OFERTAS] Error al actualizar oferta: {e}")
        raise HTTPException(status_code=500, detail="Error al actualizar la oferta.")

@app.delete("/api/ofertas/{oferta_id}")
def delete_oferta(oferta_id: str, request: Request):
    authorization = request.headers.get("Authorization")
    user_id = _get_user_from_bearer(authorization)
    if not user_id:
        raise HTTPException(status_code=401, detail="No autorizado.")

    try:
        check = supabase.table("promociones").select("comercio_id").eq("id", oferta_id).execute()
        if not check.data or check.data[0]["comercio_id"] != user_id:
            raise HTTPException(status_code=403, detail="No tienes permiso para eliminar esta oferta.")

        supabase.table("promociones").delete().eq("id", oferta_id).execute()
        return {"message": "Oferta eliminada correctamente."}
    except Exception as e:
        logger.error(f"[OFERTAS] Error al eliminar oferta: {e}")
        raise HTTPException(status_code=500, detail="Error al eliminar la oferta.")

@app.post("/api/ofertas/foto")
def upload_oferta_foto(file: UploadFile = File(...), request: Request = None):
    authorization = request.headers.get("Authorization") if request else None
    user_id = _get_user_from_bearer(authorization)
    if not user_id:
        raise HTTPException(status_code=401, detail="No autorizado.")

    try:
        bucket_name = "promociones"
        try:
            supabase.storage.create_bucket(bucket_name, public=True)
        except Exception:
            pass

        file_ext = file.filename.split(".")[-1]
        file_name = f"{user_id}_{uuid.uuid4().hex[:8]}.{file_ext}"

        file_bytes = file.file.read()

        res = supabase.storage.from_(bucket_name).upload(
            file=file_bytes,
            path=file_name,
            file_options={"content-type": file.content_type}
        )

        public_url = supabase.storage.from_(bucket_name).get_public_url(file_name)
        return {"imagen_url": public_url}
    except Exception as e:
        logger.error(f"[OFERTAS] Error al subir foto: {e}")
        raise HTTPException(status_code=500, detail="Error al subir la imagen.")


class AnalyticsEvent(BaseModel):
    tipo_evento: str
    comercio_id: str

# ── Rate limiting suave para analytics (in-memory, anti-spam) ──────────────────
# Estructura: { "ip:promo_id:tipo_evento": last_timestamp }
_analytics_rate_limit: dict = {}
_ANALYTICS_COOLDOWN_SECONDS = 30  # Mismo evento del mismo IP por la misma promo: 30s cooldown

def _analytics_allowed(ip: str, promo_id: str, tipo_evento: str) -> bool:
    import time
    # Clicks (whatsapp, instagram, maps, share) tienen cooldown corto
    # Views tienen cooldown largo (5 min) para evitar spam de recargas
    cooldown = 300 if tipo_evento == "view" else _ANALYTICS_COOLDOWN_SECONDS
    key = f"{ip}:{promo_id}:{tipo_evento}"
    now = time.time()
    last = _analytics_rate_limit.get(key, 0)
    if now - last < cooldown:
        return False
    _analytics_rate_limit[key] = now
    # Limpieza periódica para no crecer indefinidamente (cada 1000 keys)
    if len(_analytics_rate_limit) > 1000:
        cutoff = now - 600
        keys_to_delete = [k for k, v in _analytics_rate_limit.items() if v < cutoff]
        for k in keys_to_delete:
            del _analytics_rate_limit[k]
    return True

@app.post("/api/ofertas/{oferta_id}/analytics")
def registrar_oferta_analytics(oferta_id: str, payload: AnalyticsEvent, request: Request):
    user_id = _get_user_from_bearer(request.headers.get("Authorization"))
    client_ip = request.client.host if request.client else "unknown"

    # Rate limiting anti-spam
    if not _analytics_allowed(client_ip, oferta_id, payload.tipo_evento):
        return {"ok": True, "rate_limited": True}

    # Validar tipo_evento permitido
    ALLOWED_EVENTS = {"view", "whatsapp_click", "instagram_click", "maps_click", "share", "share_whatsapp", "share_facebook", "favorito"}
    if payload.tipo_evento not in ALLOWED_EVENTS:
        return {"ok": False, "error": "invalid_event"}

    try:
        supabase.table("promociones_analytics").insert({
            "promocion_id": oferta_id,
            "comercio_id": payload.comercio_id,
            "tipo_evento": payload.tipo_evento,
            "usuario_id": user_id
        }).execute()
        return {"ok": True}
    except Exception as e:
        logger.warning(f"[ANALYTICS] Error registrando evento (non-critical): {e}")
        return {"ok": False}


@app.get("/api/ofertas/analytics/mis-metricas")
def mis_metricas_comercio(request: Request):
    """
    Panel simple de analytics para el comercio autenticado.
    Devuelve métricas agregadas por promoción (últimos 30 días).
    """
    user_id = _get_user_from_bearer(request.headers.get("Authorization"))
    if not user_id:
        raise HTTPException(status_code=401, detail="No autorizado")

    try:
        # Buscar comercio_id del usuario
        comercio_res = supabase.table("comercios").select("id").eq("id", user_id).execute()
        if not comercio_res.data:
            # Intentar también por user_id (algunos comercios usan ese campo)
            comercio_res = supabase.table("comercios").select("id").eq("user_id", user_id).execute()
        if not comercio_res.data:
            return {"metricas": [], "totales": {}}

        comercio_id = comercio_res.data[0]["id"]

        # Obtener analytics de los últimos 30 días
        desde = (datetime.utcnow() - timedelta(days=30)).isoformat()

        analytics_res = supabase.table("promociones_analytics")\
            .select("promocion_id, tipo_evento")\
            .eq("comercio_id", comercio_id)\
            .gte("created_at", desde)\
            .execute()

        # Obtener nombres de promociones del comercio
        promos_res = supabase.table("promociones")\
            .select("id, titulo, imagen_url, activo")\
            .eq("comercio_id", comercio_id)\
            .execute()

        promos_map = {p["id"]: p for p in (promos_res.data or [])}

        # Agregar métricas por promoción
        from collections import defaultdict
        metricas_por_promo: dict = defaultdict(lambda: {
            "vistas": 0, "whatsapp_clicks": 0, "instagram_clicks": 0,
            "maps_clicks": 0, "shares": 0, "favoritos": 0
        })

        totales = {"vistas": 0, "whatsapp_clicks": 0, "instagram_clicks": 0,
                   "maps_clicks": 0, "shares": 0, "favoritos": 0}

        event_map = {
            "view": "vistas",
            "whatsapp_click": "whatsapp_clicks",
            "instagram_click": "instagram_clicks",
            "maps_click": "maps_clicks",
            "share": "shares",
            "share_whatsapp": "shares",
            "share_facebook": "shares",
            "favorito": "favoritos"
        }

        for row in (analytics_res.data or []):
            promo_id = row["promocion_id"]
            key = event_map.get(row["tipo_evento"])
            if key:
                metricas_por_promo[promo_id][key] += 1
                totales[key] += 1

        # Construir respuesta con info de promoción
        metricas_list = []
        for promo_id, stats in metricas_por_promo.items():
            promo = promos_map.get(promo_id, {})
            total_interacciones = sum(stats.values())
            metricas_list.append({
                "promocion_id": promo_id,
                "titulo": promo.get("titulo", "Promoción"),
                "imagen_url": promo.get("imagen_url"),
                "activo": promo.get("activo", True),
                "total_interacciones": total_interacciones,
                **stats
            })

        # Ordenar por total de interacciones desc
        metricas_list.sort(key=lambda x: x["total_interacciones"], reverse=True)

        return {"metricas": metricas_list, "totales": totales, "dias": 30}

    except Exception as e:
        logger.error(f"[ANALYTICS] Error en mis-metricas: {e}")
        return {"metricas": [], "totales": {}}


@app.post("/api/ofertas/{oferta_id}/favoritos")
def toggle_favorito(oferta_id: str, request: Request):
    user_id = _get_user_from_bearer(request.headers.get("Authorization"))
    if not user_id:
        raise HTTPException(status_code=401, detail="Debes iniciar sesión para agregar a favoritos.")
    try:
        check = supabase.table("favoritos").select("id").eq("usuario_id", user_id).eq("promocion_id", oferta_id).execute()
        if check.data:
            supabase.table("favoritos").delete().eq("id", check.data[0]["id"]).execute()
            return {"es_favorito": False}
        else:
            supabase.table("favoritos").insert({"usuario_id": user_id, "promocion_id": oferta_id}).execute()
            return {"es_favorito": True}
    except Exception as e:
        logger.error(f"[FAVORITOS] Error: {e}")
        raise HTTPException(status_code=500, detail="Error al gestionar favorito")

@app.get("/api/ofertas/favoritos/lista")
def mis_favoritos(request: Request):
    user_id = _get_user_from_bearer(request.headers.get("Authorization"))
    if not user_id:
        raise HTTPException(status_code=401, detail="No autorizado")
    try:
        res = supabase.table("favoritos").select("promocion_id").eq("usuario_id", user_id).execute()
        return {"favoritos": [f["promocion_id"] for f in res.data or []]}
    except Exception:
        return {"favoritos": []}

# ─────────────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
