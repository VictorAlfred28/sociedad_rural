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
from pydantic import BaseModel, EmailStr, HttpUrl, validator
from typing import Optional, Dict, Any
from dotenv import load_dotenv
from supabase import create_client, Client, ClientOptions
from datetime import datetime, timedelta
from uuid import uuid4
import firebase_admin
from firebase_admin import credentials, messaging
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger

# Cargar variables de entorno
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(BASE_DIR, ".env"))

from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from fastapi.responses import JSONResponse, StreamingResponse
from schemas.comercio import ComercioDTO
from schemas.profesional import ProfesionalDTO

"""
FUNCIONALIDAD DESACTIVADA TEMPORALMENTE
Módulo: Cámaras de Comercio
Motivo: No se utilizará en esta etapa del sistema
Estado: Código conservado para futura reactivación
IMPORTANTE: No eliminar, solo mantener comentado
"""
ENABLE_CAMARAS = False

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

scheduler = BackgroundScheduler(timezone=TZ_ARGENTINA)
# scheduler.add_job(
#     tarea_automatica_mora,
#     trigger=CronTrigger(day=11, hour=8, minute=0, timezone=TZ_ARGENTINA),
#     id="mora_mensual",
#     name="Detección automática de mora - día 11 a las 8:00 AM",
#     replace_existing=True,
# )

app = FastAPI(title="Sociedad Rural Norte de Corrientes API")
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
    camara_denominacion: Optional[str] = None
    camara_provincia: Optional[str] = None
    isStudent: Optional[bool] = False
    studentCertificate: Optional[str] = None


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


class EventCreate(BaseModel):
    titulo: str
    descripcion: str
    lugar: str
    fecha: str
    hora: str
    tipo: str
    imagen_url: Optional[str] = None
    municipio_id: str
    link_instagram: Optional[HttpUrl] = None
    link_facebook: Optional[HttpUrl] = None
    link_whatsapp: Optional[str] = None
    link_externo: Optional[HttpUrl] = None
    estado: Optional[str] = "borrador"
    destacado: Optional[bool] = False
    publico: Optional[bool] = True


class EventUpdate(BaseModel):
    titulo: Optional[str] = None
    descripcion: Optional[str] = None
    lugar: Optional[str] = None
    fecha: Optional[str] = None
    hora: Optional[str] = None
    tipo: Optional[str] = None
    imagen_url: Optional[str] = None
    municipio_id: Optional[str] = None
    link_instagram: Optional[HttpUrl] = None
    link_facebook: Optional[HttpUrl] = None
    link_whatsapp: Optional[str] = None
    link_externo: Optional[HttpUrl] = None
    estado: Optional[str] = None
    destacado: Optional[bool] = None
    publico: Optional[bool] = None


class WebhookEventoPayload(BaseModel):
    post_id: str
    caption: Optional[str] = ""          # Algunos posts pueden no tener texto
    media_url: Optional[str] = None      # Validado en el endpoint
    media_type: Optional[str] = "IMAGE"  # Fallback a IMAGE
    timestamp: Optional[str] = None
    permalink: Optional[str] = None
    # FASE 2: Campos para diferenciación de fuente (backward compatible)
    fuente: Optional[str] = "sociedad_rural"  # 'sociedad_rural' | 'municipio'
    municipio_id: Optional[str] = None        # UUID del municipio origen (si aplica)


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
        Gracias por registrarte en <strong>Sociedad Rural Norte de Corrientes</strong>.
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
        Tu cuenta en <strong>Sociedad Rural Norte de Corrientes</strong> fue aprobada por el administrador.
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
def procesar_texto_evento(caption: str) -> dict:
    caption = caption or ""  # Guard: evitar None de posts sin texto
    # 1. Extraer Lugar
    lugar_match = re.search(r"(?i)Lugar:\s*(.*)", caption)
    lugar = lugar_match.group(1).strip() if lugar_match else "A definir"

    # 1b. Extraer Municipio
    municipio_match = re.search(r"(?i)Municipio:\s*(.*)", caption)
    municipio_extraido = municipio_match.group(1).strip() if municipio_match else None

    # Concatenar municipio al lugar si existe
    if municipio_extraido and municipio_extraido.lower() not in lugar.lower():
        lugar = f"{municipio_extraido} - {lugar}"

    # 2. Extraer Fecha
    fecha_match = re.search(r"(\d{2}/\d{2}/\d{2,4})", caption)
    fecha = fecha_match.group(1) if fecha_match else None
    if fecha:
        # Convertir DD/MM/YYYY a YYYY-MM-DD para postgres (si es YY asume 2000+)
        try:
            if len(fecha.strip()) == 8:  # DD/MM/YY
                d = datetime.strptime(fecha, "%d/%m/%y")
            else:
                d = datetime.strptime(fecha, "%d/%m/%Y")
            fecha = d.strftime("%Y-%m-%d")
        except ValueError:
            pass  # Si falla el parseo se guarda como string y que falle postgres o dejarlo

    # 3. Extraer Hora
    hora_match = re.search(r"(\d{2}:\d{2})", caption)
    hora = hora_match.group(1) if hora_match else None
    if hora:
        try:
            hora = datetime.strptime(hora, "%H:%M").time().strftime("%H:%M:%S")
        except ValueError:
            pass

    # 4. Limpieza (Eliminar hashtags y líneas de etiquetas técnicas como "Lugar: ...")
    clean_text = re.sub(r"#\w+", "", caption)  # Elimina hashtags
    clean_text = re.sub(r"(?i)Lugar:\s*.*", "", clean_text)  # Elimina linea Lugar
    clean_text = re.sub(
        r"(?i)Municipio:\s*.*", "", clean_text
    )  # Elimina linea Municipio
    clean_text = re.sub(r"(\d{2}/\d{2}/\d{2,4})", "", clean_text)  # Elimina fechas
    clean_text = re.sub(r"(\d{2}:\d{2})", "", clean_text)  # Elimina horas
    clean_text = re.sub(r"\n\s*\n", "\n", clean_text).strip()  # Limpiar lineas vacias

    # Asumimos que la primera linea que queda es el título si existe
    lineas = clean_text.split("\n")
    titulo = lineas[0].strip() if lineas and lineas[0].strip() else "Evento Municipal"

    return {
        "lugar": lugar,
        "fecha_evento": fecha,
        "hora_evento": hora,
        "descripcion_limpia": clean_text,
        "titulo": titulo,
    }


def procesar_imagen_evento(media_url: str, post_id: str) -> Optional[str]:
    try:
        if not media_url:
            return None

        r = requests.get(media_url, stream=True, timeout=10)
        r.raise_for_status()

        # Guardar en memoria y subir a supabase storage
        file_bytes = r.content
        filename = f"{post_id}_{uuid4().hex[:8]}.jpg"  # Asumimos jpg de IG

        # Subir al bucket 'imagenes-eventos'.
        # Asegurarse que el bucket existe y es público en Supabase.
        supabase.storage.from_("imagenes-eventos").upload(
            file=file_bytes, path=filename, file_options={"content-type": "image/jpeg"}
        )

        # Obtener URL publica
        url_publica = supabase.storage.from_("imagenes-eventos").get_public_url(
            filename
        )
        return url_publica
    except Exception as e:
        logger.error(
            f"Error procesando imagen del evento para post {post_id}: {str(e)}"
        )
        # Si falla la imagen, no fallamos todo el proceso, retornamos la URL original temporal o None
        return media_url


# 3. ENDPOINT REGISTER (Integrado con Supabase Auth y Public Profiles)
@app.post("/api/register", status_code=status.HTTP_201_CREATED)
@limiter.limit("10/minute")
def register(
    socio: RegisterRequest, request: Request, background_tasks: BackgroundTasks
):
    try:
        rol_asignado = (socio.rol or "SOCIO").upper()
  
        if rol_asignado not in ("SOCIO", "COMERCIO"):
            rol_asignado = "SOCIO"

        # 3.B: Crear usuario en Supabase Auth
        user_password = socio.password if socio.password else "socio1234"
        default_passwords_list = ["comercio1234", "socio1234", "socio123"]

        user_password_was_set = (
            socio.password is not None
            and len(socio.password) >= 8
            and (socio.password not in default_passwords_list)
        )

        auth_response = supabase.auth.admin.create_user(
            {"email": socio.email, "password": user_password, "email_confirm": True}
        )

        user_id = auth_response.user.id

        # ── Subida constancia estudiante ─────────────────────────────
        constancia_url = None
        if socio.isStudent and socio.studentCertificate:
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
                logger.error(f"Error uploading student certificate: {e}")

        # 3.C: Insertar en profiles
        profile_data = {
            "id": user_id,
            "nombre_apellido": socio.nombre_apellido,
            "dni": socio.dni_cuit,
            "email": socio.email,
            "telefono": socio.telefono,
            "rol": rol_asignado,
            "estado": "PENDIENTE",
            "municipio": socio.municipio,
            "provincia": socio.provincia,
            "direccion": socio.direccion,
            "rubro": socio.rubro,
            "barrio": socio.barrio,
            "es_profesional": socio.es_profesional,
            "password_changed": user_password_was_set,
            "es_estudiante": socio.isStudent,
            "constancia_estudiante_url": constancia_url,
            "email_verificado": False,
            "email_verificacion_token": secrets.token_urlsafe(32),
            "email_verificacion_expira": (
                datetime.now() + timedelta(hours=48)
            ).isoformat(),
        }

        # ── Insert + rollback ───────────────────────────────────────
        try:
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

                supabase.table("comercios").insert(commerce_data).execute()

        except Exception as profile_err:
            try:
                supabase.auth.admin.delete_user(user_id)
            except Exception as e:
                logger.error(f"Rollback error: {e}")
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

        return {
            "message": f"{rol_asignado.capitalize()} registrado correctamente. Revisá tu correo para verificar tu cuenta.",
            "socio": profile_data,
        }

    except Exception as e:
        err_msg = str(e).lower()

        if (
            "user already registered" in err_msg
            or ("already exists" in err_msg and "email" in err_msg)
        ):
            friendly_detail = "El correo electrónico ya está registrado."

        elif "duplicate key value" in err_msg and "dni" in err_msg:
            friendly_detail = "El DNI/CUIT ya está registrado."

        elif "duplicate key value" in err_msg:
            friendly_detail = "Datos duplicados en el sistema."

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
        default_password = "comercio1234"
        user_password = comercio.password if comercio.password else default_password

        auth_response = supabase.auth.admin.create_user(
            {"email": comercio.email, "password": user_password, "email_confirm": True}
        )

        user_id = auth_response.user.id

        profile_data = {
            "id": user_id,
            "nombre_apellido": comercio.nombre_comercio,
            "dni": comercio.cuit,
            "email": comercio.email,
            "telefono": comercio.telefono,
            "rubro": comercio.rubro,
            "municipio": comercio.municipio,
            "barrio": comercio.barrio,  # Barrio/localidad (nuevo)
            "rol": rol_asignado,
            "estado": "PENDIENTE",
            "password_changed": False,
        }

        try:
            supabase.table("profiles").insert(profile_data).execute()

            commerce_data = {
                "id": user_id,
                "nombre_comercio": comercio.nombre_comercio,
                "cuit": comercio.cuit,
                "rubro": comercio.rubro,
                "direccion": comercio.direccion,
                "municipio": comercio.municipio,
                "barrio": comercio.barrio,  # Barrio/localidad (nuevo)
            }
            supabase.table("comercios").insert(commerce_data).execute()

        except Exception as profile_err:
            try:
                supabase.auth.admin.delete_user(user_id)
            except Exception as e:
                logger.error(f"Error: {e}")
                pass
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

        return {
            "message": "Comercio registrado correctamente. Pendiente de aprobación por Admin.",
            "socio": profile_data,
        }

    except Exception as e:
        err_msg = str(e).lower()
        if (
            "user already registered" in err_msg
            or ("already exists" in err_msg and "email" in err_msg)
        ):
            friendly_detail = (
                "El correo electrónico indicado ya se encuentra registrado."
            )
        elif "duplicate key value" in err_msg and "cuit" in err_msg:
            friendly_detail = (
                "El CUIT ingresado ya se encuentra registrado en el sistema."
            )
        elif "duplicate key value" in err_msg:
            friendly_detail = (
                "Algunos de los datos brindados ya se encuentran registrados."
            )
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
                    status_code=401, detail="Credenciales inválidas (DNI no encontrado)"
                )
            login_email = response.data[0]["email"]
        except Exception as e:
            if isinstance(e, HTTPException):
                raise e
            raise HTTPException(status_code=500, detail="Error consultando DNI")
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
                    detail="Credenciales inválidas (Usuario no encontrado)",
                )
            login_email = response.data[0]["email"]
        except Exception as e:
            if isinstance(e, HTTPException):
                raise e
            raise HTTPException(status_code=500, detail="Error consultando Usuario")

    if not login_email:
        raise HTTPException(status_code=400, detail="Identificador no válido")

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
                status_code=500, detail="Perfil no encontrado en base de datos"
            )

        profile = profile_res.data[0]

        # Bloqueo 1: Email no verificado
        if not profile.get("email_verificado", False):
            raise HTTPException(
                status_code=403,
                detail="EMAIL_NO_VERIFICADO",
            )

        # Bloqueo 2: Estado pendiente/suspendido/rechazado
        if profile.get("estado") not in ["APROBADO", "RESTRINGIDO"]:
            raise HTTPException(
                status_code=403,
                detail=f"CUENTA_{profile.get('estado')}",
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
        if password in default_passwords or profile.get("password_changed") is False or profile.get("must_change_password") is True:
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
                detail="Credenciales inválidas (Usuario o clave incorrecta)",
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
        asunto="Verificá tu correo — Sociedad Rural Norte de Corrientes",
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
        raise HTTPException(
            status_code=401, detail=f"Error verificando permisos: {str(e)}"
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
        user_res = supabase.auth.get_user(token)
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


def get_current_admin_or_camara(
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    token = credentials.credentials
    try:
        user_res = supabase.auth.get_user(token)
        if not user_res or not user_res.user:
            raise HTTPException(status_code=401, detail="Token inválido")

        profile_res = (
            supabase.table("profiles")
            .select("rol", "estado")
            .eq("id", user_res.user.id)
            .execute()
        )
        roles_res = (
            supabase.table("user_roles")
            .select("roles(nombre)")
            .eq("user_id", user_res.user.id)
            .execute()
        )

        if not profile_res.data:
            raise HTTPException(status_code=403, detail="Perfil no encontrado")

        rol = profile_res.data[0].get("rol")
        estado = profile_res.data[0].get("estado")
        user_roles = (
            [r["roles"]["nombre"] for r in roles_res.data if r.get("roles")]
            if roles_res.data
            else []
        )
        has_admin_role = (
            "SUPERADMIN" in user_roles
            or "ADMINISTRADOR" in user_roles
            or rol == "ADMIN"
        )

        if not (has_admin_role or rol == "CAMARA") or estado != "APROBADO":
            raise HTTPException(
                status_code=403,
                detail="Requiere rol de Administrador o Cámara Aprobada",
            )

        return user_res.user
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=401, detail="Error verificando permisos")


# 4.4 LISTADO DE MUNICIPIOS (DINÁMICO DESDE DB)
@app.get("/api/municipios")
def get_municipios():
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
def listar_comercios(rubro: Optional[str] = None, municipio: Optional[str] = None):
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
        raise HTTPException(status_code=500, detail=str(e))


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
            status_code=500, detail=f"Error generando token QR: {str(e)}"
        )

    return {"token": new_token_str, "expires_at": expires_at}


@app.post("/api/qr/validar")
def validar_qr_dinamico(data: QRTokenValidarRequest):
    """
    Verifica un token QR dinámico escaneado por el Comercio.
    """
    if not ENABLE_DYNAMIC_QR:
        raise HTTPException(status_code=403, detail="Dynamic QR is disabled.")

    try:
        # 1. Buscamos el token
        result = (
            supabase.table("qr_tokens").select("*").eq("token", data.token).execute()
        )
        if not result.data:
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
                "id, nombre_apellido, dni, rol, estado, municipio, numero_socio, titular_id, tipo_vinculo, perfiles_titulares:profiles!titular_id(nombre_apellido, estado)"
            )
            .eq("id", socio_id)
            .execute()
        )

        if not res.data:
            raise HTTPException(status_code=404, detail="Usuario no encontrado.")

        perfil = res.data[0]

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

        return {"valido": es_activo, "mensaje": mensaje, "socio": perfil}
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail=str(e))


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
            status_code=500, detail=f"Error en servidor al procesar imagen: {str(e)}"
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


# ── ENDPOINT PARA VALIDAR CARNET DE SOCIO DESDE QR ────────────────────────────
@app.get("/api/valida-socio/{socio_id}")
def valida_socio(socio_id: str):
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
        raise HTTPException(status_code=500, detail=f"Error al validar socio: {str(e)}")


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
            status_code=500, detail=f"Error actualizando la contraseña: {str(e)}"
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
        raise HTTPException(status_code=500, detail=str(e))


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
            raise HTTPException(status_code=500, detail=f"Error Auth: {str(e)}")

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
                status_code=500, detail=f"Error creando perfil: {str(e)}"
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
        raise HTTPException(status_code=500, detail=str(e))


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
        raise HTTPException(status_code=500, detail=str(e))


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
        raise HTTPException(status_code=500, detail=str(e))


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
        raise HTTPException(status_code=500, detail=str(e))


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
                asunto="¡Tu cuenta fue aprobada! — Sociedad Rural Norte de Corrientes",
                html_body=_html_aprobacion(
                    nombre=usuario_aprobado.get("nombre_apellido", ""),
                    login_url=f"{frontend_url}/login",
                ),
            )

        return {"message": "Usuario aprobado correctamente"}
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail=f"Error al aprobar: {str(e)}")


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
        raise HTTPException(status_code=500, detail=f"Error al rechazar: {str(e)}")


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
        raise HTTPException(status_code=500, detail=str(e))


class UpdateUserStatusRequest(BaseModel):
    estado: str  # "APROBADO" | "SUSPENDIDO" | "PENDIENTE" | "RECHAZADO" | "RESTRINGIDO"

    @validator('estado')
    def validate_estado(cls, v):
        allowed = {"PENDIENTE", "APROBADO", "RECHAZADO", "SUSPENDIDO", "RESTRINGIDO"}
        if v not in allowed:
            raise ValueError(f"Estado inválido: {v}. Valores permitidos: {', '.join(sorted(allowed))}")
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
            status_code=500, detail=f"Error al actualizar estado: {str(e)}"
        )


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
            status_code=500, detail=f"Error al editar usuario: {str(e)}"
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
            status_code=500, detail=f"Error al eliminar usuario: {str(e)}"
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
            status_code=500, detail=f"Error al restablecer contraseña: {str(e)}"
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
            status_code=500, detail=f"Error cargando métricas: {str(e)}"
        )


# 7. ENDPOINT ADMIN: CREAR COMERCIO
@app.post("/api/admin/comercios", status_code=status.HTTP_201_CREATED)
def create_commerce(
    comercio: ComercioDTO,
    request: Request,
    background_tasks: BackgroundTasks,
    auth_user=Depends(get_current_admin_or_camara),
):
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

        # Si el usuario es CAMARA, aplicar límites y reglas
        titular_id = None
        final_municipio = None  # Se tomará del request si es ADMIN

        if user_rol == "CAMARA":
            # 1. Validar límite de 10 comercios
            count_res = (
                supabase.table("profiles")
                .select("id", count="exact")
                .eq("titular_id", auth_user.id)
                .eq("rol", "COMERCIO")
                .execute()
            )
            if count_res.count is not None and count_res.count >= 10:
                raise HTTPException(
                    status_code=400,
                    detail="Has alcanzado el límite de 10 comercios registrados para tu cámara.",
                )

            # 2. El municipio del comercio DEBE ser el mismo de la cámara
            titular_id = auth_user.id
            final_municipio = user_municipio
        else:
            # Si es ADMIN, usa el municipio del request; fallback al municipio del admin si aplica
            final_municipio = comercio.municipio or user_municipio

        default_password = "comercio1234"

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
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Error al crear comercio: {str(e)}",
        )

# 7.5 ENDPOINT ADMIN: CREAR PROFESIONAL
@app.post("/api/admin/profesionales", status_code=status.HTTP_201_CREATED)
def create_profesional(
    prof: ProfesionalDTO,
    request: Request,
    background_tasks: BackgroundTasks,
    auth_user=Depends(get_current_admin_or_camara),
):
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

        default_password = "profesional1234"

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
            detail=f"Error al crear profesional: {str(e)}",
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
            .select("id, nombre_apellido, rubro, municipio, provincia, telefono")
            .eq("rol", "SOCIO")
            .eq("es_profesional", True)
            .eq("estado", "APROBADO")
            .order("nombre_apellido")
        )
        if municipio:
            query = query.eq("municipio", municipio)
        res = query.execute()
        return {"profesionales": res.data or []}
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error al obtener profesionales: {str(e)}"
        )


# ── MODELOS PARA OFERTAS ──────────────────────────────────────────────────────
class OfertaRequest(BaseModel):
    titulo: str
    descripcion: Optional[str] = None
    tipo: str  # 'promocion' | 'descuento' | 'beneficio'
    descuento_porcentaje: Optional[int] = None
    imagen_url: Optional[str] = None
    fecha_fin: Optional[str] = None
    instagram_url: Optional[str] = None
    facebook_url: Optional[str] = None


class OfertaUpdateRequest(BaseModel):
    activo: Optional[bool] = None
    titulo: Optional[str] = None
    descripcion: Optional[str] = None
    imagen_url: Optional[str] = None
    instagram_url: Optional[str] = None
    facebook_url: Optional[str] = None


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
                "id, titulo, descripcion, tipo, descuento_porcentaje, "
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
                    detail=f"No se pudo actualizar el email de acceso: {str(e)}",
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
            status_code=500, detail=f"Error al editar usuario: {str(e)}"
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
            status_code=500, detail=f"Error al cambiar contraseña: {str(e)}"
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
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/agregar-dependiente", status_code=201)
def agregar_dependiente(
    req: AddDependienteRequest,
    request: Request,
    background_tasks: BackgroundTasks,
    current_user=Depends(get_current_user),
):
    """Crea un perfil que depende del usuario en sesión."""
    try:
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

        # 2. Email ficticio si no provee (para Supabase Auth)
        user_email = (
            req.email
            if req.email
            else f"dependiente.{req.dni_cuit}@sociedadrural.local"
        )
        
        # Asignar contraseña inicial fija
        user_password = "Familia1234"

        # 3. Crear usuario en Auth
        auth_response = supabase.auth.admin.create_user(
            {"email": user_email, "password": user_password, "email_confirm": True}
        )
        user_id = auth_response.user.id

        # 4. Insertar en Profiles
        profile_data = {
            "id": user_id,
            "nombre_apellido": req.nombre_apellido,
            "dni": req.dni_cuit,
            "email": user_email,
            "telefono": req.telefono,
            "rol": titular["rol"],  # Hereda rol del titular (ej. SOCIO o COMERCIO)
            "estado": "PENDIENTE",  # Requiere verificación de ADMIN
            "municipio": titular["municipio"],
            "rubro": titular["rubro"],
            "titular_id": current_user.id,
            "tipo_vinculo": req.tipo_vinculo,
            "password_changed": False,
            "user_type": "FAMILIAR",
            "must_change_password": True
        }

        try:
            supabase.table("profiles").insert(profile_data).execute()

            background_tasks.add_task(
                registrar_auditoria,
                usuario_id=current_user.id,
                email_usuario=current_user.email,
                rol_usuario=titular["rol"],
                accion="CREATE",
                tabla="profiles",
                registro_id=user_id,
                datos_anteriores=None,
                datos_nuevos=profile_data,
                modulo="Gestión Dependientes",
                request=request,
            )
        except Exception as e:
            supabase.auth.admin.delete_user(user_id)
            raise e

        return {
            "message": "Dependiente agregado correctamente",
            "dependiente": profile_data,
        }
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=400, detail=f"Error al agregar: {str(e)}")


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
        raise HTTPException(status_code=500, detail=str(e))


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
        raise HTTPException(status_code=500, detail=f"Error subiendo foto: {str(e)}")


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
            status_code=500, detail=f"Error subiendo imagen de oferta: {str(e)}"
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

        # 2. Registrar la solicitud en notificaciones_admin
        notif_data = {
            "usuario_id": perfil["id"],
            "tipo": "OLVIDO_PASSWORD",
            "descripcion": f"El usuario {perfil['nombre_apellido']} (DNI: {perfil['dni']}) solicita restablecer su contraseña.",
            "estado": "PENDIENTE",
            "metadata": {"email": perfil["email"]},
        }

        supabase.table("notificaciones_admin").insert(notif_data).execute()

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
            status_code=500, detail=f"Error al procesar solicitud: {str(e)}"
        )


@app.get("/api/admin/notificaciones-soporte")
def get_support_notifications(admin_user=Depends(get_current_admin)):
    """Retorna las notificaciones de soporte pendientes para el administrador"""
    try:
        # 1. Query principal sin join (siempre funciona, independiente de FK config en PostgREST)
        res = (
            supabase.table("notificaciones_admin")
            .select("*")
            .eq("estado", "PENDIENTE")
            .order("created_at", desc=True)
            .execute()
        )
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
        logger.exception(f"[/api/admin/notificaciones-soporte] Error inesperado:")
        raise HTTPException(status_code=500, detail="Error al obtener notificaciones de soporte.")



@app.put("/api/admin/notificaciones-soporte/{notif_id}/resolver")
def resolve_support_notification(notif_id: str, admin_user=Depends(get_current_admin)):
    """Marca una notificación de soporte como resuelta"""
    try:
        supabase.table("notificaciones_admin").update(
            {"estado": "RESUELTO", "resolved_at": datetime.now().isoformat()}
        ).eq("id", notif_id).execute()
        return {"message": "Solicitud marcada como resuelta"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


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
            supabase.table("notificaciones_admin")
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
        supabase.table("notificaciones_admin").update(
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
            status_code=500, detail=f"Error al resetear contraseña: {str(e)}"
        )


@app.put("/api/admin/notificaciones-soporte/{notif_id}/nota")
def update_support_note(
    notif_id: str, req: UpdateSupportNoteRequest, admin_user=Depends(get_current_admin)
):
    """Actualiza la nota interna en el metadata de una notificación"""
    try:
        # Recuperar metadata actual
        notif_res = (
            supabase.table("notificaciones_admin")
            .select("metadata")
            .eq("id", notif_id)
            .execute()
        )
        if not notif_res.data:
            raise HTTPException(status_code=404, detail="Notificación no encontrada")

        metadata = notif_res.data[0].get("metadata") or {}
        metadata["nota"] = req.nota

        supabase.table("notificaciones_admin").update({"metadata": metadata}).eq(
            "id", notif_id
        ).execute()
        return {"message": "Nota actualizada correctamente"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


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
            status_code=500, detail=f"Error obteniendo logs de auditoría: {str(e)}"
        )


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
    Consulta la lista de eventos combinando eventos institucionales y
    eventos importados de redes sociales (aprobados).
    """
    try:
        resolved_municipio_id = municipio_id
        if not resolved_municipio_id and municipio:
            # Intentar resolver el UUID real del municipio por nombre
            mun_res = supabase.table("municipios").select("id").ilike("nombre", municipio).execute()
            if mun_res.data:
                resolved_municipio_id = mun_res.data[0]["id"]

        # 1. Obtener eventos institucionales (solo publicados)
        query1 = supabase.table("eventos").select("*").eq("estado", "publicado")
        if resolved_municipio_id:
            query1 = query1.eq("municipio_id", resolved_municipio_id)
        elif municipio:
            # Fallback a texto solo si no se encontró en la tabla municipios
            query1 = query1.ilike("lugar", f"%{municipio}%")
        if tipo:
            query1 = query1.ilike("tipo", f"%{tipo}%")
        if fecha_desde:
            query1 = query1.gte("fecha", fecha_desde)

        res1 = query1.order("fecha", desc=False).execute()
        eventos_inst = res1.data or []

        # 2. Obtener eventos de redes sociales (aprobados)
        query2 = supabase.table("eventos_sociales").select("*").eq("status", "aprobado")
        # FASE 2: Filtrar por municipio_id (UUID) cuando está disponible, fallback a texto
        if resolved_municipio_id:
            query2 = query2.eq("municipio_id", resolved_municipio_id)
        elif municipio:
            query2 = query2.ilike("lugar", f"%{municipio}%")
        if tipo:
            # Buscamos en el titulo para eventos sociales
            query2 = query2.ilike("titulo", f"%{tipo}%")
        if fecha_desde:
            query2 = query2.gte("fecha_evento", fecha_desde)

        res2 = query2.order("fecha_evento", desc=False).execute()
        eventos_soc = res2.data or []

        # 3. Normalizar eventos sociales al esquema que espera el frontend
        social_normalized = []
        for ev in eventos_soc:
            # FASE 2: fallback IG depende de la fuente para no apuntar a cuenta incorrecta
            ev_fuente = ev.get("fuente", "sociedad_rural")
            fallback_ig = (
                "https://www.instagram.com/sociedadruralnc?igsh=MTMwcWNzbHh6aHdyMg%3D%3D"
                if ev_fuente == "sociedad_rural"
                else None  # Municipios sin permalink no heredan la cuenta de SR
            )
            social_normalized.append(
                {
                    "id": ev["id"],
                    "titulo": ev["titulo"],
                    "descripcion": ev.get("descripcion_limpia", ""),
                    "lugar": ev.get("lugar", "A definir"),
                    "fecha": ev["fecha_evento"],
                    "hora": ev["hora_evento"],
                    "tipo": "Social",  # Etiqueta para distinguir origen
                    "imagen_url": ev.get("imagen_url"),
                    "link_instagram": ev.get("link_instagram") or ev.get("metadata", {}).get("permalink") or fallback_ig,
                    "link_facebook": ev.get("link_facebook"),
                    "link_whatsapp": ev.get("link_whatsapp"),
                    "slug": ev.get("slug"),
                    "estado": "publicado",
                    "fuente": ev_fuente,
                    "municipio_id": ev.get("municipio_id"),
                }
            )

        # 4. Combinar y ordenar por fecha
        combined = eventos_inst + social_normalized
        combined.sort(key=lambda x: x.get("fecha") or "9999-12-31")

        return {"eventos": combined}
    except Exception as e:
        logger.error(f"Error combinando eventos: {str(e)}")
        raise HTTPException(
            status_code=500, detail=f"Error al obtener eventos: {str(e)}"
        )


@app.get("/api/eventos/{slug}")
def get_evento_by_slug(slug: str):
    """
    Obtiene un evento específico por su slug (sea institucional o de redes sociales).
    """
    try:
        # Primero buscar en eventos institucionales
        res_inst = supabase.table("eventos").select("*").eq("slug", slug).execute()
        if res_inst.data:
            evento = res_inst.data[0]
            # Si es borrador, ocultarlo en endpoints publicos
            if evento.get("estado") != "publicado":
                raise HTTPException(status_code=404, detail="Evento no disponible")
            return {"evento": evento}
            
        # Si no está, buscar en eventos sociales
        res_soc = supabase.table("eventos_sociales").select("*").eq("slug", slug).execute()
        if res_soc.data:
            ev = res_soc.data[0]
            if ev.get("status") != "aprobado":
                raise HTTPException(status_code=404, detail="Evento no disponible")
            # Normalizar
            evento_normalizado = {
                "id": ev["id"],
                "titulo": ev["titulo"],
                "descripcion": ev.get("descripcion_limpia", ""),
                "lugar": ev.get("lugar", "A definir"),
                "fecha": ev["fecha_evento"],
                "hora": ev["hora_evento"],
                "tipo": "Social",
                "imagen_url": ev.get("imagen_url"),
                "link_instagram": ev.get("link_instagram") or ev.get("metadata", {}).get("permalink"),
                "link_facebook": ev.get("link_facebook"),
                "link_whatsapp": ev.get("link_whatsapp"),
                "slug": ev.get("slug"),
                "estado": "publicado"
            }
            return {"evento": evento_normalizado}
            
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
    """Crea un nuevo evento desde el Panel Administrador"""
    try:
        evento_data = evento.dict(exclude_unset=True)
        # Sanitizar URLs
        for key in ["link_instagram", "link_facebook", "link_externo"]:
            if evento_data.get(key):
                evento_data[key] = str(evento_data[key])
        
        # Generar slug
        evento_data["slug"] = f"{slugify(evento.titulo)}-{uuid4().hex[:6]}"

        res = supabase.table("eventos").insert(evento_data).execute()

        if res.data:
            evento_creado = res.data[0]
            background_tasks.add_task(
                registrar_auditoria,
                usuario_id=admin_user.id,
                email_usuario=admin_user.email,
                rol_usuario="ADMIN",
                accion="CREATE",
                tabla="eventos",
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
        raise HTTPException(status_code=500, detail=f"Error al crear evento: {str(e)}")


@app.delete("/api/admin/eventos/{evento_id}")
def delete_evento(
    evento_id: str,
    request: Request,
    background_tasks: BackgroundTasks,
    admin_user=Depends(get_current_admin),
):
    """Elimina un evento desde el Panel Administrador"""
    try:
        evento_ant = supabase.table("eventos").select("*").eq("id", evento_id).execute()
        datos_anteriores = evento_ant.data[0] if evento_ant.data else None

        if not datos_anteriores:
            raise HTTPException(status_code=404, detail="Evento no encontrado")

        supabase.table("eventos").delete().eq("id", evento_id).execute()

        background_tasks.add_task(
            registrar_auditoria,
            usuario_id=admin_user.id,
            email_usuario=admin_user.email,
            rol_usuario="ADMIN",
            accion="DELETE",
            tabla="eventos",
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
            status_code=500, detail=f"Error al eliminar evento: {str(e)}"
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

        evento_ant = supabase.table("eventos").select("*").eq("id", evento_id).execute()
        datos_anteriores = evento_ant.data[0] if evento_ant.data else None

        if not datos_anteriores:
            raise HTTPException(status_code=404, detail="Evento no encontrado")

        res = (
            supabase.table("eventos").update(update_data).eq("id", evento_id).execute()
        )

        background_tasks.add_task(
            registrar_auditoria,
            usuario_id=admin_user.id,
            email_usuario=admin_user.email,
            rol_usuario="ADMIN",
            accion="UPDATE",
            tabla="eventos",
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
            status_code=500, detail=f"Error al actualizar evento: {str(e)}"
        )


@app.post("/api/v1/importar-evento")
async def importar_evento(payload: WebhookEventoPayload, request: Request):
    """
    Endpoint para recibir publicaciones de Make.com (Instagram/Facebook).
    Procesa el texto, guarda la imagen en Storage y persiste en la tabla eventos_sociales.
    """
    logger.info(f"==> Iniciando IMPORTAR EVENTO [post_id: {payload.post_id}]")
    
    # Validación Input Estricta (Fase 4)
    if not payload.media_url or str(payload.media_url).strip() == "":
        logger.error(f"Falta media_url en post_id {payload.post_id}")
        # Retornar 400 Bad Request si no hay imagen (OBLIGATORIO)
        raise HTTPException(
            status_code=400,
            detail="El campo media_url es obligatorio"
        )

    # 1. Validar Token de seguridad o Webhook Secret
    token = request.headers.get("X-Webhook-Token")
    secret_header = request.headers.get("x-webhook-secret")

    webhook_secret = os.getenv("WEBHOOK_SECRET", "make_webhook_secret_2026")
    secret_token = os.getenv("WEBHOOK_SECRET_TOKEN")

    authorized = False
    if secret_header and secrets.compare_digest(secret_header, webhook_secret):
        authorized = True
    elif token and secret_token and secrets.compare_digest(token, secret_token):
        authorized = True

    if not authorized:
        logger.warning(f"[WEBHOOK EVENTOS] Acceso denegado: secret/token inválido.")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Webhook secret mismatch o token no válido",
        )

    try:
        # FASE 2: Determinar fuente
        fuente = payload.fuente or "sociedad_rural"
        municipio_id_validado = None
        nombre_municipio = None

        if payload.municipio_id:
            mun_res = (
                supabase.table("municipios")
                .select("id, nombre")
                .eq("id", payload.municipio_id)
                .eq("activo", True)
                .execute()
            )
            if not mun_res.data:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"El municipio_id '{payload.municipio_id}' no existe o no está activo.",
                )
            municipio_id_validado = mun_res.data[0]["id"]
            nombre_municipio = mun_res.data[0]["nombre"]

        # 2. Procesar Texto con Regex
        logger.info(f"Procesando texto para post_id {payload.post_id}")
        datos_procesados = procesar_texto_evento(payload.caption)

        titulo = datos_procesados["titulo"]
        if fuente == "municipio" and not (payload.caption and payload.caption.strip()) and nombre_municipio:
            titulo = f"Novedad de {nombre_municipio}"

        status_evento = "aprobado" if fuente == "sociedad_rural" else "borrador"

        # 3. Procesar Imagen
        logger.info(f"Procesando imagen para post_id {payload.post_id}")
        url_final_imagen = procesar_imagen_evento(payload.media_url, payload.post_id)

        # 4. Preparar datos para inserción/actualización
        remate_data = {
            "external_id": payload.post_id,
            "titulo": titulo,
            "descripcion_limpia": datos_procesados["descripcion_limpia"],
            "lugar": datos_procesados["lugar"],
            "fecha_evento": datos_procesados["fecha_evento"],
            "hora_evento": datos_procesados["hora_evento"],
            "imagen_url": url_final_imagen,
            "metadata": {
                "original_caption": payload.caption,
                "original_media_url": payload.media_url,
                "media_type": payload.media_type,
                "timestamp": payload.timestamp,
                "permalink": payload.permalink,
            },
            "status": status_evento,
            "fuente": fuente
        }

        if municipio_id_validado:
            remate_data["municipio_id"] = municipio_id_validado

        # 5. Persistencia
        logger.info(f"Guardando en BD post_id {payload.post_id}")
        res = (
            supabase.table("eventos_sociales")
            .upsert(remate_data, on_conflict="external_id")
            .execute()
        )

        if res.data:
            evento_id = res.data[0].get("id")
            logger.info(f"✅ Evento importado exitosamente: {payload.post_id} [id={evento_id}]")

            if fuente == "municipio" and nombre_municipio:
                try:
                    admins_res = (
                        supabase.table("profiles")
                        .select("id")
                        .eq("rol", "ADMIN")
                        .execute()
                    )
                    for admin in (admins_res.data or []):
                        enviar_notificacion_push_inapp(
                            usuario_id=admin["id"],
                            titulo="📍 Nuevo Evento de Municipio",
                            mensaje=f"Publicación de {nombre_municipio} pendiente de moderación",
                            link_url="/admin",
                        )
                except Exception as notif_err:
                    logger.error(f"Error notificando admins: {notif_err}")

            return {
                "success": True,
                "message": "Evento importado correctamente",
                "id": evento_id,
                "external_id": payload.post_id,
                "status_evento": status_evento,
            }

        return {"success": True, "message": "Actualizado sin cambios", "external_id": payload.post_id}

    except Exception as e:
        logger.error(f"ERROR IMPORTAR EVENTO [post_id: {payload.post_id}]: {str(e)}")
        # Capturamos el error para Make y devolvemos 500 con el detalle para debug
        return JSONResponse(
            status_code=500,
            content={
                "error": "Error interno",
                "detail": str(e)
            }
        )


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
        raise HTTPException(status_code=500, detail=str(e))


class UpdateEventoSocialStatusRequest(BaseModel):
    status: str  # "borrador" | "aprobado" | "rechazado"


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
            .update({"status": req.status})
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
            status_code=500, detail=f"Error al actualizar estado del evento: {str(e)}"
        )


class EventoSocialUpdate(BaseModel):
    titulo: Optional[str] = None
    descripcion_limpia: Optional[str] = None
    lugar: Optional[str] = None
    fecha_evento: Optional[str] = None
    hora_evento: Optional[str] = None
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
            status_code=500, detail=f"Error al actualizar evento: {str(e)}"
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
            status_code=500, detail=f"Error al eliminar evento: {str(e)}"
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
            status_code=500, detail=f"Error obteniendo notificaciones: {str(e)}"
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
            status_code=500, detail=f"Error al actualizar notificaciones: {str(e)}"
        )


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
            status_code=500, detail=f"Error al actualizar preferencia: {str(e)}"
        )


def enviar_notificacion_push_inapp(
    usuario_id: str, titulo: str, mensaje: str, link_url: Optional[str] = None
):
    """
    Función utilitaria (interna) para enviar una notificación In-App y Push (vía FCM) a un usuario.
    Incluye soporte para sonido de notificación basado en preferencias del usuario.
    Debe ser llamada de manera asíncrona o bloqueante según sea necesario.
    """
    try:
        # 1. Guardar Notificación In-App en Base de Datos
        supabase.table("notificaciones").insert(
            {
                "usuario_id": usuario_id,
                "titulo": titulo,
                "mensaje": mensaje,
                "link_url": link_url,
                "leido": False,
                "fecha": datetime.now(
                    pytz.timezone("America/Argentina/Buenos_Aires")
                ).isoformat(),
            }
        ).execute()

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

                # Construir payload con soporte de sonido
                push_message = messaging.MulticastMessage(
                    notification=messaging.Notification(
                        title=titulo,
                        body=mensaje,
                    ),
                    data={
                        "link_url": link_url or "/",
                        "sound_enabled": "true" if sound_enabled else "false",
                        "sound_file": "notification.mp3",  # Nombre del archivo de sonido
                    },
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
                )
                messaging.send_each_for_multicast(push_message)
            except ValueError:
                logger.info(
                    "Firebase no inicializado. Se guardó In-App pero no se envió Push."
                )
            except Exception as e:
                logger.error(f"Error al enviar Push a fcm: {e}")

    except Exception as e:
        logger.error(f"Error general en enviar_notificacion_push_inapp: {e}")


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
            # Usar background task o directo? Como ya estamos en background en register, lo hacemos directo o por hilos
            enviar_notificacion_push_inapp(
                usuario_id=admin["id"],
                titulo=titulo,
                mensaje=mensaje,
                link_url="/admin",
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
        # Si tiene 11 dígitos y empieza con 15 (común en AR), corregir a 549 + area + resto
        elif len(numero_limpio) == 11 and numero_limpio.startswith("15"):
            # Este es un caso borde, mejor dejarlo pasar o intentar normalizarlo si conocemos el area
            pass
        # Si empieza con 379 y tiene 10 digitos ya fue cubierto arriba.
        # Si tiene 13 y empieza con 549, ya está correcto.

        payload = {
            "number": numero_limpio,
            "text": mensaje,
            "delay": 1200,
            "linkPreview": True,
        }

        response = requests.post(url, json=payload, headers=headers)
        if response.status_code not in [200, 201]:
            logger.error(f"Error Evolution API: {response.status_code} - {response.text}")

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


# 12.4b ADMIN: Procesar Rendición Bancaria (.txt)
@app.post("/api/admin/procesar-rendicion-bc")
async def procesar_rendicion_bc(
    request: Request,
    background_tasks: BackgroundTasks,
    archivo: UploadFile = File(...),
    admin_user=Depends(get_current_admin),
):
    """
    Recibe un archivo .txt con el formato del Banco de Corrientes:
    Fecha(8) + Monto(8) + DNI(8)
    Ej: 202603110000500031435789 -> Pago de $50 para el DNI 31435789
    """
    try:
        content = await archivo.read()
        lines = content.decode("utf-8").splitlines()

        procesados = 0
        errores = []
        datetime.now().strftime("%Y-%m-%d")

        for line in lines:
            if not line.strip():
                continue
            try:
                # Parsear según formato fijo
                # fecha = line[0:8]
                monto_raw = line[8:16]  # "00005000" -> 50.00
                dni_raw = line[16:24].strip()

                monto = float(monto_raw) / 100

                # Buscar socio por DNI
                res_perfil = (
                    supabase.table("profiles")
                    .select("id, nombre_apellido, telefono")
                    .eq("dni", dni_raw)
                    .execute()
                )
                if not res_perfil.data:
                    errores.append(f"DNI {dni_raw} no encontrado")
                    continue

                socio = res_perfil.data[0]
                socio_id = socio["id"]

                # 1. Registrar el pago como validado automáticamente por el banco
                # Buscamos la cuota pendiente más antigua o la del mes actual
                # Para simplificar este flujo de banco, creamos o actualizamos la del mes en curso
                mes_actual = datetime.now().month
                anio_actual = datetime.now().year
                fecha_venci = f"{anio_actual}-{mes_actual:02d}-10"

                # Buscamos si ya tiene registro
                pago_existente = (
                    supabase.table("pagos_cuotas")
                    .select("id")
                    .eq("socio_id", socio_id)
                    .eq("fecha_vencimiento", fecha_venci)
                    .execute()
                )

                pago_data = {
                    "socio_id": socio_id,
                    "monto": monto,
                    "estado_pago": "PAGADO",
                    "fecha_validacion": datetime.now().isoformat(),
                    "admin_validador_id": admin_user.id,
                    "comprobante_url": "PAGO_POR_BANCO",  # Marca especial
                }

                if pago_existente.data:
                    supabase.table("pagos_cuotas").update(pago_data).eq(
                        "id", pago_existente.data[0]["id"]
                    ).execute()
                else:
                    pago_data["fecha_vencimiento"] = fecha_venci
                    supabase.table("pagos_cuotas").insert(pago_data).execute()

                # 2. Reactivar Socio si estaba restringido
                supabase.table("profiles").update(
                    {"estado": "APROBADO", "motivo": None}
                ).eq("id", socio_id).execute()

                # 3. Log y Notificación
                supabase.table("activity_log").insert(
                    {
                        "socio_id": socio_id,
                        "tipo_evento": "PAGO_BANCO_AUTOMATICO",
                        "descripcion": f"Pago de ${monto} procesado vía rendición bancaria.",
                        "usuario_id": admin_user.id,
                    }
                ).execute()

                enviar_notificacion_push_inapp(
                    socio_id,
                    "Pago Recibido (Banco) ✅",
                    f"Hemos recibido tu pago de ${monto} a través del Banco. Tu cuenta está activa.",
                    "/cuotas",
                )

                if socio.get("telefono"):
                    mensaje_wa = f"¡Hola {socio['nombre_apellido']}! ✅ Hemos procesado tu pago de ${monto} recibido vía rendición bancaria. Tu carnet ya está activo."
                    background_tasks.add_task(
                        enviar_whatsapp, socio["telefono"], mensaje_wa
                    )

                procesados += 1
            except Exception as e:
                errores.append(f"Error en línea '{line}': {str(e)}")

        return {
            "message": f"Proceso finalizado. {procesados} pagos procesados con éxito.",
            "errores": errores,
        }
    except Exception as e:
        logger.error(f"Error procesando rendición bancaria: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error crítico: {str(e)}")


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

    try:
        # 1. Buscar socios que NO tengan pago para el mes actual
        mes_actual = hoy.month
        anio_actual = hoy.year
        fecha_venci = f"{anio_actual}-{mes_actual:02d}-10"

        # Obtenemos todos los miembros (Socios y Comercios) aprobados y restringidos
        query = (
            supabase.table("profiles")
            .select("id, nombre_apellido, telefono, rol")
            .in_("estado", ["APROBADO", "RESTRINGIDO"])
        )

        if not admin_user:
            query = query.in_("rol", ["SOCIO", "COMERCIO"])

        socios_res = query.execute()
        socios = socios_res.data

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
                    deudas_bulk = [
                        {
                            "socio_id": m["id"],
                            "monto": 5000,
                            "fecha_vencimiento": fecha_venci,
                            "estado_pago": "PENDIENTE",
                        } for m in chunk
                    ]
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
                        f"Detectamos un atraso en el pago de tu cuota de la Sociedad Rural ({mes_actual}/{anio_actual}).\n\n"
                        "¿Deseás regularizar tu situación? Respondé *SÍ*, *ACEPTO* o *PAGAR* para enviarte el detalle de tu deuda y el link de pago."
                    )
                    enviar_whatsapp(socio["telefono"], mensaje_wa)

        return {
            "message": f"Proceso completado. Socios detectados en mora: {detectados}"
        }

    except Exception as e:
        logger.error(f"Error en detectar_mora: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


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
            "🔔 *PRUEBA - SOCIEDAD RURAL DEL NORTE*\n\n"
            "Este es un mensaje de prueba del sistema automático de notificaciones. "
            "Si recibiste este mensaje, la integración con WhatsApp está funcionando correctamente.\n\n"
            "_Sociedad Rural del Norte de Corrientes_"
        )
        enviar_whatsapp(req.numero, mensaje)
        return {
            "message": f"Mensaje enviado al número {req.numero}. Verificá el celular."
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


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
        raise HTTPException(status_code=500, detail=str(e))


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
                "nombre_apellido, dni, email, telefono, estado, municipio, rol, es_profesional, titular_id, created_at"
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

            # Clasificación
            if rol == "COMERCIO":
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
        writer.writerow(["REPORTE DE CONTABILIDAD - SOCIEDAD RURAL"])
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

            cat_label = "Socio Común"
            if rol == "COMERCIO":
                cat_label = "Empleado" if titular_id else "Comercio"
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
                "Documento emitido por el Sistema de Gestión Digital - Sociedad Rural.",
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
        # LOG DE DEBUG en activity_log para verificar si el webhook es alcanzado
        try:
            # NO USAR request.body() aquí porque consume el stream y rompe el request.json() posterior
            supabase.table("activity_log").insert(
                {
                    "tipo_evento": "DEBUG_WEBHOOK",
                    "descripcion": f"Webhook WhatsApp alcanzado. Headers: {dict(request.headers)}",
                    "socio_id": None,
                }
            ).execute()
        except Exception as log_err:
            logger.error(f"[WEBHOOK] Error guardando log debug: {log_err}")

        # 1. Validar Token de Seguridad (si está configurado)
        secret_header = request.headers.get("webhook-secret")
        env_secret = os.getenv("WEBHOOK_SECRET_TOKEN")

        # Log inicial para debug
        logger.info("[WEBHOOK] Recibida petición WhatsApp.")

        if env_secret and secret_header != env_secret:
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
                    "_Muchas gracias! Sociedad Rural del Norte de Corrientes._"
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
def get_mis_pagos(current_user=Depends(get_current_user)):
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
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/pagos/subir-comprobante")
async def subir_comprobante(
    mes: int = Form(...),
    anio: int = Form(...),
    file: UploadFile = File(...),
    current_user=Depends(get_current_user),
):
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
        raise HTTPException(status_code=500, detail=str(e))


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
        raise HTTPException(status_code=500, detail=str(e))


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
        c.drawString(50, 750, "SOCIEDAD RURAL NORTE CORRIENTES")
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
                "Muchas gracias por estar al día. Sociedad Rural del Norte de Corrientes."
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
        raise HTTPException(status_code=500, detail=str(e))


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
        raise HTTPException(status_code=500, detail=str(e))

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
        raise HTTPException(status_code=500, detail=str(e))

def calcular_cuota_dinamica_internal(user_id: str):
    # fetch user profile
    profile_res = supabase.table("profiles").select("rol, es_estudiante, es_profesional").eq("id", user_id).execute()
    if not profile_res.data:
        raise HTTPException(status_code=404, detail="Perfil no encontrado")
    profile = profile_res.data[0]

    # Recalcular SIEMPRE consultando la tabla profiles (los dependientes están en profiles con titular_id)
    fam_res = supabase.table("profiles").select("id", count="exact").eq("titular_id", user_id).execute()
    familiares_count = fam_res.count if fam_res.count is not None else 0
    
    membership_type = "FAMILIAR" if familiares_count > 0 else "INDIVIDUAL"

    # Traer valores base
    cuotas_res = supabase.table("configuracion_cuotas").select("*").execute()
    cuotas_map = {c["rol"]: c["monto"] for c in cuotas_res.data}
    
    # Priority logic
    if membership_type == "FAMILIAR":
        rol_efectivo = "GRUPO FAMILIAR"
        tipo_plan = "Grupo Familiar"
    elif profile.get("es_profesional"):
        rol_efectivo = "PROFESIONAL"
        tipo_plan = "Socio Profesional"
    elif profile.get("es_estudiante"):
        rol_efectivo = "ESTUDIANTE"
        tipo_plan = "Estudiante"
    else:
        rol_efectivo = profile.get("rol", "SOCIO")
        tipo_plan = "Individual"
        
    monto_base = cuotas_map.get(rol_efectivo, 0)
    
    # Defaults in case not in DB yet
    if monto_base == 0:
        if rol_efectivo == "GRUPO FAMILIAR":
            monto_base = 20000
        elif rol_efectivo == "PROFESIONAL":
            monto_base = 7000
        elif rol_efectivo == "ESTUDIANTE":
            monto_base = 5000
        elif rol_efectivo == "SOCIO":
            monto_base = 10000
    
    monto_total = monto_base
    monto_base_usado = monto_base

    return {
        "monto": monto_total,
        "monto_total": monto_total, # For backward compatibility
        "tipo": rol_efectivo,
        "detalle": {
            "base": monto_base_usado,
            "familiares": familiares_count,
            "cantidad": familiares_count + 1 if membership_type == "FAMILIAR" else 1,
            "tipo_plan": tipo_plan
        }
    }

@app.get("/api/cuota/calcular")
def calcular_cuota_dinamica(current_user=Depends(get_current_user)):
    try:
        return calcular_cuota_dinamica_internal(current_user.id)
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail=str(e))

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
def cron_verificar_bloqueos():
    """
    Se ejecuta diario. Verifica vencimientos y bloquea ('SUSPENDIDO') 
    si pasaron 10 días hábiles de mora.
    """
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
                    
                    perfil_res = supabase.table("profiles").select("estado").eq("id", socio_id).execute()
                    if perfil_res.data:
                        perfil = perfil_res.data[0]
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
                            
        return {"status": "success", "cuotas_vencidas_marcadas": marcados, "socios_suspendidos": bloqueos}
    except Exception as e:
        logger.error(f"[CRON] Error verificar_bloqueos: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/v1/cron/notificar-mora")
def cron_notificar_mora():
    """
    Se ejecuta el día 11 de cada mes.
    Notifica vía WhatsApp a los que tienen cuota vencida.
    Previene duplicados en el mismo mes usando la tabla 'notificaciones'.
    """
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
                
        return {"status": "success", "whatsapp_enviados": enviados, "errores": errores}
    except Exception as e:
        logger.error(f"[CRON] Error notificar_mora: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

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
    - Limita a 5 dispositivos por usuario (elimina el más antiguo si supera).
    """
    plataforma = (plataforma or "android").lower()
    if plataforma not in ("android", "web", "ios"):
        plataforma = "android"

    # 1. ¿Ya existe este token exacto en la DB?
    existing = (
        supabase.table("push_tokens")
        .select("id, usuario_id, plataforma")
        .eq("token", token_value)
        .execute()
    )

    if existing.data:
        row = existing.data[0]
        # Si ya pertenece al mismo usuario → nada que hacer
        if str(row["usuario_id"]) == user_id:
            logger.info(f"[PUSH_TOKEN] Token ya registrado para user {user_id} — sin cambios.")
            return {"status": "already_registered", "token_id": row["id"]}
        # Token de otro usuario → actualizamos owner (device re-login)
        supabase.table("push_tokens").update(
            {"usuario_id": user_id, "plataforma": plataforma, "created_at": datetime.utcnow().isoformat()}
        ).eq("id", row["id"]).execute()
        logger.info(f"[PUSH_TOKEN] Token reasignado de {row['usuario_id']} → {user_id}.")
        return {"status": "reassigned", "token_id": row["id"]}

    # 2. Token nuevo: insertar
    insert_res = (
        supabase.table("push_tokens")
        .insert({"usuario_id": user_id, "token": token_value, "plataforma": plataforma})
        .execute()
    )
    new_id = insert_res.data[0]["id"] if insert_res.data else None
    logger.info(f"[PUSH_TOKEN] ✅ Token registrado para user {user_id} ({plataforma}).")

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
        logger.info(f"[PUSH_TOKEN] Rotación: {len(oldest_ids)} token(s) antiguo(s) eliminado(s) para user {user_id}.")

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

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
