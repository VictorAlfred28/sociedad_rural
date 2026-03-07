import os
import re
import requests
from fastapi import FastAPI, HTTPException, status, Request, BackgroundTasks, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr
from typing import Optional, Dict, Any
from dotenv import load_dotenv
from supabase import create_client, Client, ClientOptions
from datetime import datetime
from uuid import uuid4
import firebase_admin
from firebase_admin import credentials, messaging
import json
# Cargar variables de entorno
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(BASE_DIR, ".env"))

from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from fastapi.responses import JSONResponse

limiter = Limiter(key_func=get_remote_address)

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    raise ValueError("Faltan variables de entorno SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY")

# Inicializar cliente Supabase con ClientOptions para evitar errores de JWT en el backend
opts = ClientOptions(
    auto_refresh_token=False,
    persist_session=False
)
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY, options=opts)

app = FastAPI(title="Sociedad Rural Norte de Corrientes API")
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    # Log the real error to the server console but don't leak details to the client
    print(f"Global Exception [500] -> {str(exc)}")
    return JSONResponse(
        status_code=500,
        content={"detail": "Ha ocurrido un error interno en el servidor. Si el problema persiste, contacte a soporte."},
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
            key_body = formatted_key.split("-----BEGIN PRIVATE KEY-----")[1].split("-----END PRIVATE KEY-----")[0]
            clean_body = key_body.replace(" ", "").replace("\\n", "").replace("\n", "").replace("\r", "")
            chunks = [clean_body[i:i+64] for i in range(0, len(clean_body), 64)]
            formatted_key = "-----BEGIN PRIVATE KEY-----\n" + "\n".join(chunks) + "\n-----END PRIVATE KEY-----\n"
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
        "universe_domain": "googleapis.com"
    }
    # Solo inicializar si tenemos al menos el project_id y private_key validos
    if firebase_cred_json.get("project_id") and firebase_cred_json.get("private_key"):
        try:
            cred = credentials.Certificate(firebase_cred_json)
            firebase_admin.initialize_app(cred)
            print("Firebase Admin configurado correctamente.")
        except Exception as e:
            print(f"Warning: Firebase Admin no pudo inicializarse: {e}")
    else:
        print("Warning: Faltan credenciales de Firebase en el entorno, Push Notifications deshabilitadas.")

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
    request: Request
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
            "user_agent": user_agent
        }
        
        supabase.table("auditoria_logs").insert(log_data).execute()
    except Exception as e:
        # La auditoría no debería bloquear el flujo principal si falla,
        # pero idealmente debería registrarse en un log del servidor.
        print(f"Error crítico en registro de auditoría: {str(e)}")

# 1. CORS ESTRICTO PARA FRONTEND (localhost:3000 y dominios de producción)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000", 
        "http://localhost:5173", 
        "http://127.0.0.1:5173",
        "https://agentech.ar",
        "https://www.agentech.ar",
        "https://sociedadrural.agentech.ar",
        "https://sociedadruraldelnorte.agentech.ar"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 2. MODELOS PYDANTIC BASADOS EN FORMULARIOS DEL FRONTEND
class RegisterRequest(BaseModel):
    nombre_apellido: str
    dni_cuit: str
    email: EmailStr
    telefono: str
    rol: Optional[str] = "SOCIO"
    municipio: Optional[str] = None
    rubro: Optional[str] = None
    direccion: Optional[str] = None
    es_profesional: Optional[bool] = False
    password: Optional[str] = None
    camara_denominacion: Optional[str] = None
    camara_provincia: Optional[str] = None

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

class EventUpdate(BaseModel):
    titulo: Optional[str] = None
    descripcion: Optional[str] = None
    lugar: Optional[str] = None
    fecha: Optional[str] = None
    hora: Optional[str] = None
    tipo: Optional[str] = None
    imagen_url: Optional[str] = None

class WebhookEventoPayload(BaseModel):
    post_id: str
    caption: str
    media_url: str
    timestamp: str

# ── UTILIDADES PARA EL WEBHOOK DE EVENTOS SOCIALES ───────────────────────────
def procesar_texto_evento(caption: str) -> dict:
    # 1. Extraer Lugar
    lugar_match = re.search(r'(?i)Lugar:\s*(.*)', caption)
    lugar = lugar_match.group(1).strip() if lugar_match else 'A definir'
    
    # 1b. Extraer Municipio
    municipio_match = re.search(r'(?i)Municipio:\s*(.*)', caption)
    municipio_extraido = municipio_match.group(1).strip() if municipio_match else None
    
    # Concatenar municipio al lugar si existe
    if municipio_extraido and municipio_extraido.lower() not in lugar.lower():
        lugar = f"{municipio_extraido} - {lugar}"
    
    # 2. Extraer Fecha
    fecha_match = re.search(r'(\d{2}/\d{2}/\d{2,4})', caption)
    fecha = fecha_match.group(1) if fecha_match else None
    if fecha:
        # Convertir DD/MM/YYYY a YYYY-MM-DD para postgres (si es YY asume 2000+)
        try:
            if len(fecha.strip()) == 8: # DD/MM/YY
                d = datetime.strptime(fecha, "%d/%m/%y")
            else:
                d = datetime.strptime(fecha, "%d/%m/%Y")
            fecha = d.strftime("%Y-%m-%d")
        except ValueError:
            pass # Si falla el parseo se guarda como string y que falle postgres o dejarlo
            
    # 3. Extraer Hora
    hora_match = re.search(r'(\d{2}:\d{2})', caption)
    hora = hora_match.group(1) if hora_match else None
    if hora:
        try:
            hora = datetime.strptime(hora, "%H:%M").time().strftime("%H:%M:%S")
        except ValueError:
            pass

    # 4. Limpieza (Eliminar hashtags y líneas de etiquetas técnicas como "Lugar: ...")
    clean_text = re.sub(r'#\w+', '', caption) # Elimina hashtags
    clean_text = re.sub(r'(?i)Lugar:\s*.*', '', clean_text) # Elimina linea Lugar
    clean_text = re.sub(r'(?i)Municipio:\s*.*', '', clean_text) # Elimina linea Municipio
    clean_text = re.sub(r'(\d{2}/\d{2}/\d{2,4})', '', clean_text) # Elimina fechas
    clean_text = re.sub(r'(\d{2}:\d{2})', '', clean_text) # Elimina horas
    clean_text = re.sub(r'\n\s*\n', '\n', clean_text).strip() # Limpiar lineas vacias
    
    # Asumimos que la primera linea que queda es el título si existe
    lineas = clean_text.split('\n')
    titulo = lineas[0].strip() if lineas and lineas[0].strip() else "Evento Municipal"
    
    return {
        "lugar": lugar,
        "fecha_evento": fecha,
        "hora_evento": hora,
        "descripcion_limpia": clean_text,
        "titulo": titulo
    }

def procesar_imagen_evento(media_url: str, post_id: str) -> Optional[str]:
    try:
        if not media_url:
            return None
            
        r = requests.get(media_url, stream=True, timeout=10)
        r.raise_for_status()
        
        # Guardar en memoria y subir a supabase storage
        file_bytes = r.content
        filename = f"{post_id}_{uuid4().hex[:8]}.jpg" # Asumimos jpg de IG
        
        # Subir al bucket 'imagenes-eventos'. 
        # Asegurarse que el bucket existe y es público en Supabase.
        res = supabase.storage.from_("imagenes-eventos").upload(
            file=file_bytes,
            path=filename,
            file_options={"content-type": "image/jpeg"}
        )
        
        # Obtener URL publica
        url_publica = supabase.storage.from_("imagenes-eventos").get_public_url(filename)
        return url_publica
    except Exception as e:
        logger.error(f"Error procesando imagen del evento para post {post_id}: {str(e)}")
        # Si falla la imagen, no fallamos todo el proceso, retornamos la URL original temporal o None
        return media_url 


# 3. ENDPOINT REGISTER (Integrado con Supabase Auth y Public Profiles)
@app.post("/api/register", status_code=status.HTTP_201_CREATED)
@limiter.limit("10/minute")
def register(socio: RegisterRequest, request: Request, background_tasks: BackgroundTasks):
    try:
        # 3.A: Validar Rol
        rol_asignado = socio.rol.upper() if socio.rol else "SOCIO"
        if rol_asignado not in ["SOCIO", "COMERCIO", "CAMARA"]:
            rol_asignado = "SOCIO" # Fallback de seguridad

        # 3.B: Crear usuario en Supabase Auth con la contraseña elegida por el usuario
        user_password = socio.password if socio.password else "socio1234"
        default_passwords_list = ["comercio1234", "socio1234", "socio123", "camara1234"]
        user_password_was_set = socio.password is not None and len(socio.password) >= 8 and (socio.password not in default_passwords_list)
        
        auth_response = supabase.auth.admin.create_user({
            "email": socio.email,
            "password": user_password,
            "email_confirm": True
        })
        
        user_id = auth_response.user.id
        
        # 3.C: Insertar en la tabla public.profiles (El DNI debe ser UNIQUE segun esquema)
        profile_data = {
            "id": user_id,
            "nombre_apellido": socio.nombre_apellido,
            "dni": socio.dni_cuit,
            "email": socio.email,
            "telefono": socio.telefono,
            "rol": rol_asignado,
            "estado": "PENDIENTE", 
            "municipio": socio.municipio,
            "direccion": socio.direccion,
            "rubro": socio.rubro,
            "es_profesional": socio.es_profesional,
            "password_changed": user_password_was_set,  # Solo True si NO es una de las default
        }
        
        # Inserción en tabla profiles - con rollback al auth si falla
        try:
            supabase.table("profiles").insert(profile_data).execute()
            
            # 3.D: Si es COMERCIO, insertar en la tabla comercios
            if rol_asignado == "COMERCIO":
                commerce_data = {
                    "id": user_id,
                    "nombre_comercio": socio.nombre_apellido,
                    "cuit": socio.dni_cuit,
                    "rubro": socio.rubro,
                    "direccion": socio.direccion
                }
                supabase.table("comercios").insert(commerce_data).execute()
                
            # 3.E: Si es CAMARA, insertar en la tabla camaras
            elif rol_asignado == "CAMARA":
                # Al llegar desde el front como 'CAMARA', esperamos que use los campos correspondientes
                # Mapeamos los campos del RegisterRequest para la Cámara
                # Como el request actualmente define: nombre_apellido, dni_cuit, municipio, email, telefono
                camara_data = {
                    "id": user_id,
                    "denominacion": socio.nombre_apellido, # El form del frente envía denominación aquí
                    "cuit": socio.dni_cuit,
                    "municipio": socio.municipio or "",
                    "provincia": socio.direccion or "", # Usamos direccion para la provincia (según el mapping esperado o adaptamos)
                    "responsable_nombre": socio.rubro or "", # Usamos rubro para el responsable (según como lo manda el front, revisaremos Registro.tsx)
                    "email": socio.email,
                    "telefono": socio.telefono
                }
                supabase.table("camaras").insert(camara_data).execute()

        except Exception as profile_err:
            # Rollback: eliminar usuario de Auth para que pueda reintentar el registro
            try:
                supabase.auth.admin.delete_user(user_id)
            except:
                pass
            raise profile_err
        
        # Auditoría
        background_tasks.add_task(registrar_auditoria, 
            usuario_id=user_id,
            email_usuario=socio.email,
            rol_usuario=rol_asignado,
            accion="CREATE",
            tabla="profiles",
            registro_id=user_id,
            datos_anteriores=None,
            datos_nuevos=profile_data,
            modulo="Registro Cuentas",
            request=request
        )
        
        return {
            "message": f"{rol_asignado.capitalize()} registrado correctamente. Pendiente de aprobación por Admin.", 
            "socio": profile_data
        }
        
    except Exception as e:
        # Manejo basico de error (ej: Email o DNI ya existente en Supabase)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Error al registrar: {str(e)}"
        )


# 4. ENDPOINT LOGIN (Diferenciación de DNI y Email con Auth en Supabase)
@app.post("/api/login")
@limiter.limit("5/minute")
def login(credentials: LoginRequest, request: Request):
    identificador_limpio = credentials.identificador.strip()
    password = credentials.password
    
    print(f"Login attempt for: {identificador_limpio}")
    # 4.A IDENTIFICAR TIPO DE INGRESO
    tipo_identificacion = "unknown"
    login_email = None
    
    if "@" in identificador_limpio:
        tipo_identificacion = "email"
        login_email = identificador_limpio
    elif identificador_limpio.isdigit():
        tipo_identificacion = "dni" # Numerico es DNI o CUIT
        
        # Si es DNI, necesitamos buscar el email en la tabla public.profiles porque Supabase Auth signInWithPassword requiere Email
        try:
            response = supabase.table("profiles").select("email").eq("dni", identificador_limpio).execute()
            if not response.data or len(response.data) == 0:
                raise HTTPException(status_code=401, detail="Credenciales inválidas (DNI no encontrado)")
            login_email = response.data[0]["email"]
        except Exception as e:
            if isinstance(e, HTTPException): raise e
            raise HTTPException(status_code=500, detail="Error consultando DNI")
            
    if not login_email:
        raise HTTPException(status_code=400, detail="Identificador no válido")

    print(f"Login email resolved: {login_email}")
    # 4.B: AUTENTICAR CON SUPABASE AUTH
    try:
        print("Authenticating with Supabase Auth...")
        # Hacemos signIn para generar y verificar token/pass.
        # IMPORTANTE: Usamos un cliente local para no sobreescribir la sesión del cliente global 'supabase' (Service Role)
        auth_client = create_client(SUPABASE_URL, SUPABASE_KEY)
        auth_response = auth_client.auth.sign_in_with_password({
            "email": login_email,
            "password": password
        })
        
        session = auth_response.session
        user = auth_response.user
        print("Auth success, fetching profile...")
        # 4.C: RECUPERAR PERFIL Y ESTADO usando el cliente global con permisos de Admin
        profile_res = supabase.table("profiles").select("*").eq("id", user.id).execute()
        print("Profile fetched.")
        if not profile_res.data:
            raise HTTPException(status_code=500, detail="Perfil no encontrado en base de datos")
            
        profile = profile_res.data[0]
        
        # Validar si está pendiente o suspendido (Bloquear aquí en el login)
        if profile["estado"] not in ["APROBADO", "RESTRINGIDO"]:
            raise HTTPException(status_code=403, detail=f"Su usuario se encuentra {profile['estado']}. Contacte a la Administración.")

        # Validación: PRIMER LOGIN OBLIGATORIO SI USA PASS POR DEFECTO O FUE RESTABLECIDA POR ADMIN
        necesita_cambio_password = False
        default_passwords = ["comercio1234", "socio1234", "socio123", "SRNC2026!"]
        if password in default_passwords or profile.get("password_changed") is False:
            necesita_cambio_password = True
            
        return {
            "message": "Login exitoso",
            "tipo_identificacion_detectado": tipo_identificacion,
            "necesita_cambio_password": necesita_cambio_password,
            "socio": profile,
            "token": session.access_token # JWT real de Supabase devuelto al front
        }
        
    except Exception as e:
        # Auth api error format fallback
        if "Invalid login credentials" in str(e) or getattr(e, "status_code", 400) == 400:
             raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Credenciales inválidas"
            )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error en login: {str(e)}"
        )

from fastapi import Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

security = HTTPBearer()

def get_current_admin(credentials: HTTPAuthorizationCredentials = Depends(security)):
    token = credentials.credentials
    try:
        user_res = supabase.auth.get_user(token)
        if not user_res or not user_res.user:
            raise HTTPException(status_code=401, detail="Token inválido")
            
        profile_res = supabase.table("profiles").select("rol").eq("id", user_res.user.id).execute()
        if not profile_res.data or profile_res.data[0].get("rol") != "ADMIN":
            raise HTTPException(status_code=403, detail="Requiere rol de Administrador")
            
        return user_res.user
    except Exception as e:
        if isinstance(e, HTTPException): raise e
        raise HTTPException(status_code=401, detail="Error verificando permisos")

def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    token = credentials.credentials
    try:
        user_res = supabase.auth.get_user(token)
        if not user_res or not user_res.user:
            raise HTTPException(status_code=401, detail="Token inválido")
        return user_res.user
    except Exception as e:
        if isinstance(e, HTTPException): raise e
        print(f"Error verificando sesión en get_current_user: {str(e)}")
        raise HTTPException(status_code=401, detail=f"Error verificando sesión: {str(e)}")

def get_current_admin_or_camara(credentials: HTTPAuthorizationCredentials = Depends(security)):
    token = credentials.credentials
    try:
        user_res = supabase.auth.get_user(token)
        if not user_res or not user_res.user:
            raise HTTPException(status_code=401, detail="Token inválido")
            
        profile_res = supabase.table("profiles").select("rol", "estado").eq("id", user_res.user.id).execute()
        if not profile_res.data:
            raise HTTPException(status_code=403, detail="Perfil no encontrado")
            
        rol = profile_res.data[0].get("rol")
        estado = profile_res.data[0].get("estado")
        
        if rol not in ["ADMIN", "CAMARA"] or estado != "APROBADO":
            raise HTTPException(status_code=403, detail="Requiere rol de Administrador o Cámara Aprobada")
            
        return user_res.user
    except Exception as e:
        if isinstance(e, HTTPException): raise e
        raise HTTPException(status_code=401, detail="Error verificando permisos")

# 4.4 LISTADO DE MUNICIPIOS FIJOS
@app.get("/api/municipios")
def get_municipios():
    # Lista predeterminada y fija de cámaras de municipios sugerida
    municipios = [
        {"id": "ctes-capital", "nombre": "Corrientes Capital"},
        {"id": "goya", "nombre": "Goya"},
        {"id": "paso-de-los-libres", "nombre": "Paso de los Libres"},
        {"id": "curuzu-cuatia", "nombre": "Curuzú Cuatiá"},
        {"id": "mercedes", "nombre": "Mercedes"},
        {"id": "bella-vista", "nombre": "Bella Vista"},
        {"id": "ituzaingo", "nombre": "Ituzaingó"},
        {"id": "gobernador-virasoro", "nombre": "Gobernador Virasoro"},
        {"id": "esquina", "nombre": "Esquina"},
        {"id": "monte-caseros", "nombre": "Monte Caseros"}
    ]
    return {"municipios": municipios}

# ── ENDPOINT PÚBLICO: listar comercios adheridos ─────────────────────────────
class ChangePasswordRequest(BaseModel):
    new_password: str

@app.get("/api/comercios")
def listar_comercios(rubro: Optional[str] = None, municipio: Optional[str] = None):
    """Retorna la lista de comercios aprobados, filtrable por rubro o municipio."""
    try:
        query = supabase.table("profiles") \
            .select("id, nombre_apellido, rubro, municipio, telefono, email") \
            .eq("rol", "COMERCIO") \
            .eq("estado", "APROBADO") \
            .order("nombre_apellido")
        if rubro:
            query = query.eq("rubro", rubro)
        if municipio:
            query = query.eq("municipio", municipio)
        result = query.execute()
        return {"comercios": result.data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ── ENDPOINT PARA VALIDAR CARNET DE SOCIO DESDE QR ────────────────────────────
@app.get("/api/valida-socio/{socio_id}")
def valida_socio(socio_id: str):
    """
    Recibe el ID del socio (codificado en el QR) y devuelve su estado de validación.
    Los Comercios llamarán a este endpoint cuando escaneen el Carnet del Socio.
    """
    try:
        # Buscamos al perfil y opcionalmente a su titular
        result = supabase.table("profiles").select("id, nombre_apellido, dni, rol, estado, municipio, titular_id, tipo_vinculo, perfiles_titulares:profiles!titular_id(nombre_apellido, estado)").eq("id", socio_id).execute()
        
        if not result.data:
            raise HTTPException(status_code=404, detail="El código QR no pertenece a un usuario registrado válido.")
            
        perfil = result.data[0]
        
        # Titular o empleado?
        if perfil["rol"] not in ["SOCIO", "COMERCIO"]:
            raise HTTPException(status_code=400, detail="El código QR no pertenece a un Socio o Comercio válido.")
            
        es_activo = (perfil["estado"] == "APROBADO")
        mensaje = "✅ Socio Activo. Apto para recibir beneficios." if es_activo else f"❌ Usuario inactivo o estado pendiente ({perfil['estado']})."
        
        titular = perfil.get("perfiles_titulares")
        if titular:
            titular_valido = titular.get("estado") == "APROBADO"
            if not titular_valido:
                es_activo = False
                mensaje = f"❌ El titular de este usuario ({titular.get('nombre_apellido')}) está en estado {titular.get('estado')}."
            else:
                vinculo = perfil.get("tipo_vinculo", "Adherente").capitalize()
                mensaje = f"✅ {vinculo} Activo. Titular: {titular.get('nombre_apellido')}."

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
                "titular_id": perfil.get("titular_id")
            },
            "mensaje": mensaje
        }
        
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail=f"Error al validar socio: {str(e)}")


@app.post("/api/change-password")
def change_password(req: ChangePasswordRequest, request: Request,background_tasks: BackgroundTasks,  current_user  = Depends(get_current_user)):
    try:
        if len(req.new_password) < 6:
            raise HTTPException(status_code=400, detail="La contraseña debe tener al menos 6 caracteres")
            
        # Actualizar contraseña en Auth usando modo Admin ya que tenemos la Service Role key
        supabase.auth.admin.update_user_by_id(
            current_user.id,
            {"password": req.new_password}
        )
        
        # Marcar en profile como password_changed = True
        supabase.table("profiles").update({"password_changed": True}).eq("id", current_user.id).execute()
        
        # Auditoría
        background_tasks.add_task(registrar_auditoria, 
            usuario_id=current_user.id,
            email_usuario=current_user.email,
            rol_usuario=None,
            accion="UPDATE",
            tabla="profiles",
            registro_id=current_user.id,
            datos_anteriores=None,
            datos_nuevos={"password_changed": True},
            modulo="Seguridad",
            request=request
        )
        
        return {"message": "Contraseña actualizada correctamente"}
    except Exception as e:
        if isinstance(e, HTTPException): raise e
        raise HTTPException(status_code=500, detail=f"Error actualizando la contraseña: {str(e)}")

# 5. ENDPOINT ADMIN: LISTAR PENDIENTES
@app.get("/api/admin/users/pending")
def get_pending_users(limit: int = Query(default=50, le=100), offset: int = Query(default=0, ge=0), admin_user = Depends(get_current_admin)):
    try:
        response = supabase.table("profiles").select("*").eq("estado", "PENDIENTE").range(offset, offset + limit - 1).execute()
        return {"users": response.data}
    except Exception as e:
         raise HTTPException(status_code=500, detail=str(e))

# 6. ENDPOINTS ADMIN: APROBAR / RECHAZAR USUARIO
@app.post("/api/admin/users/{user_id}/approve")
def approve_user(user_id: str, request: Request,background_tasks: BackgroundTasks,  admin_user  = Depends(get_current_admin)):
    try:
        res = supabase.table("profiles").update({"estado": "APROBADO"}).eq("id", user_id).execute()
        if not res.data:
            raise HTTPException(status_code=404, detail="Usuario no encontrado")
            
        background_tasks.add_task(registrar_auditoria, 
            usuario_id=admin_user.id,
            email_usuario=admin_user.email,
            rol_usuario="ADMIN",
            accion="APPROVE",
            tabla="profiles",
            registro_id=user_id,
            datos_anteriores={"estado": "PENDIENTE"},
            datos_nuevos={"estado": "APROBADO"},
            modulo="Gestión Usuarios",
            request=request
        )
        return {"message": "Usuario aprobado correctamente"}
    except Exception as e:
        if isinstance(e, HTTPException): raise e
        raise HTTPException(status_code=500, detail=f"Error al aprobar: {str(e)}")

@app.post("/api/admin/users/{user_id}/reject")
def reject_user(user_id: str, request: Request,background_tasks: BackgroundTasks,  admin_user  = Depends(get_current_admin)):
    try:
        res = supabase.table("profiles").update({"estado": "RECHAZADO"}).eq("id", user_id).execute()
        if not res.data:
            raise HTTPException(status_code=404, detail="Usuario no encontrado")
            
        background_tasks.add_task(registrar_auditoria, 
            usuario_id=admin_user.id,
            email_usuario=admin_user.email,
            rol_usuario="ADMIN",
            accion="REJECT",
            tabla="profiles",
            registro_id=user_id,
            datos_anteriores={"estado": "PENDIENTE"},
            datos_nuevos={"estado": "RECHAZADO"},
            modulo="Gestión Usuarios",
            request=request
        )
        return {"message": "Usuario rechazado correctamente"}
    except Exception as e:
        if isinstance(e, HTTPException): raise e
        raise HTTPException(status_code=500, detail=f"Error al rechazar: {str(e)}")

# 6.B ENDPOINTS ADMIN OPTIMIZADOS (SPEC)

@app.get("/api/admin/users")
def get_all_users(limit: int = Query(default=50, le=100), offset: int = Query(default=0, ge=0), admin_user = Depends(get_current_admin)):
    """Retorna todos los usuarios del sistema para la tabla de gestión"""
    try:
        response = supabase.table("profiles").select("*").order("created_at", desc=True).range(offset, offset + limit - 1).execute()
        return {"users": response.data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class UpdateUserStatusRequest(BaseModel):
    estado: str # "APROBADO" | "SUSPENDIDO" | "PENDIENTE" | "RECHAZADO"

@app.put("/api/admin/users/{user_id}/status")
def update_user_status(user_id: str, req: UpdateUserStatusRequest, request: Request,background_tasks: BackgroundTasks,  admin_user  = Depends(get_current_admin)):
    """Suspende o reactiva un usuario"""
    try:
        perfil_ant = supabase.table("profiles").select("estado").eq("id", user_id).execute()
        datos_anteriores = perfil_ant.data[0] if perfil_ant.data else None
        
        res = supabase.table("profiles").update({"estado": req.estado}).eq("id", user_id).execute()
        if not res.data:
            raise HTTPException(status_code=404, detail="Usuario no encontrado")
            
        background_tasks.add_task(registrar_auditoria, 
            usuario_id=admin_user.id,
            email_usuario=admin_user.email,
            rol_usuario="ADMIN",
            accion="UPDATE",
            tabla="profiles",
            registro_id=user_id,
            datos_anteriores=datos_anteriores,
            datos_nuevos={"estado": req.estado},
            modulo="Gestión Usuarios",
            request=request
        )
        return {"message": f"Estado actualizado a {req.estado}", "user": res.data[0]}
    except Exception as e:
        if isinstance(e, HTTPException): raise e
        raise HTTPException(status_code=500, detail=f"Error al actualizar estado: {str(e)}")

class UpdateUserRequest(BaseModel):
    nombre_apellido: Optional[str] = None
    telefono: Optional[str] = None
    rubro: Optional[str] = None
    email: Optional[str] = None

@app.put("/api/admin/users/{user_id}")
def update_user_details(user_id: str, req: UpdateUserRequest, request: Request,background_tasks: BackgroundTasks,  admin_user  = Depends(get_current_admin)):
    """Edita información básica del perfil desde el dashboard admin"""
    try:
        update_data = req.dict(exclude_unset=True)
        if not update_data:
            return {"message": "Sin cambios"}
            
        perfil_ant = supabase.table("profiles").select("*").eq("id", user_id).execute()
        datos_anteriores = perfil_ant.data[0] if perfil_ant.data else None
            
        res = supabase.table("profiles").update(update_data).eq("id", user_id).execute()
        if not res.data:
            raise HTTPException(status_code=404, detail="Usuario no encontrado")
            
        background_tasks.add_task(registrar_auditoria, 
            usuario_id=admin_user.id,
            email_usuario=admin_user.email,
            rol_usuario="ADMIN",
            accion="UPDATE",
            tabla="profiles",
            registro_id=user_id,
            datos_anteriores=datos_anteriores,
            datos_nuevos=update_data,
            modulo="Gestión Usuarios",
            request=request
        )
        return {"message": "Usuario actualizado", "user": res.data[0]}
    except Exception as e:
        if isinstance(e, HTTPException): raise e
        raise HTTPException(status_code=500, detail=f"Error al editar usuario: {str(e)}")

@app.delete("/api/admin/users/{user_id}")
def delete_user(user_id: str, request: Request, background_tasks: BackgroundTasks, admin_user = Depends(get_current_admin)):
    """Elimina un usuario (y su perfil asociado) desde el dashboard admin"""
    try:
        if user_id == admin_user.id:
            raise HTTPException(status_code=400, detail="No puedes eliminar tu propia cuenta")
            
        perfil_ant = supabase.table("profiles").select("*").eq("id", user_id).execute()
        datos_anteriores = perfil_ant.data[0] if perfil_ant.data else None
        
        # Eliminar el usuario en Supabase Auth
        # Esto debería disparar la eliminación en cascada si la base de datos está configurada así.
        # Si no, de todas formas lo borramos de Auth para revocar acceso.
        auth_response = supabase.auth.admin.delete_user(user_id)
        
        # Intentamos borrar el profile explícitamente por si no hay On Delete Cascade. 
        # Si falla porque no existe (ya se borró por cascada), lo ignoramos.
        try:
            supabase.table("profiles").delete().eq("id", user_id).execute()
        except:
            pass

        background_tasks.add_task(registrar_auditoria, 
            usuario_id=admin_user.id,
            email_usuario=admin_user.email,
            rol_usuario="ADMIN",
            accion="DELETE",
            tabla="auth.users / profiles",
            registro_id=user_id,
            datos_anteriores=datos_anteriores,
            datos_nuevos=None,
            modulo="Gestión Usuarios",
            request=request
        )
        return {"message": "Usuario eliminado correctamente"}
    except Exception as e:
        if isinstance(e, HTTPException): raise e
        raise HTTPException(status_code=500, detail=f"Error al eliminar usuario: {str(e)}")

class ResetPasswordRequest(BaseModel):
    new_password: Optional[str] = "SRNC2026!"

@app.post("/api/admin/users/{user_id}/reset-password")
def reset_user_password(user_id: str, req: ResetPasswordRequest, request: Request, background_tasks: BackgroundTasks, admin_user = Depends(get_current_admin)):
    """Restablece la contraseña de un usuario a un valor por defecto o especificado"""
    try:
        # Prevenir que un ADMIN restablezca la clave de otro ADMIN (Tenant Security)
        target_profile = supabase.table("profiles").select("rol").eq("id", user_id).execute()
        if target_profile.data and target_profile.data[0].get("rol") == "ADMIN" and admin_user.id != user_id:
            raise HTTPException(status_code=403, detail="No tienes permisos para restablecer la contraseña de otro Administrador.")
            
        new_password = req.new_password if req.new_password else "SRNC2026!"
        
        # Validar longitud mínima de Supabase
        if len(new_password) < 6:
            raise HTTPException(status_code=400, detail="La contraseña debe tener al menos 6 caracteres")
            
        # Actualizar en Auth
        auth_response = supabase.auth.admin.update_user_by_id(user_id, {"password": new_password})
        
        # Actualizar en profiles para forzar el cambio
        supabase.table("profiles").update({"password_changed": False}).eq("id", user_id).execute()
        
        background_tasks.add_task(registrar_auditoria, 
            usuario_id=admin_user.id,
            email_usuario=admin_user.email,
            rol_usuario="ADMIN",
            accion="UPDATE",
            tabla="auth.users (Password)",
            registro_id=user_id,
            datos_anteriores=None,
            datos_nuevos={"password_reset": True},
            modulo="Gestión Usuarios",
            request=request
        )
        return {"message": "Contraseña restablecida correctamente", "temporary_password": new_password}
    except Exception as e:
        if isinstance(e, HTTPException): raise e
        raise HTTPException(status_code=500, detail=f"Error al restablecer contraseña: {str(e)}")


@app.put("/api/camara/comercios/{user_id}")
def update_commerce_by_camara(user_id: str, req: UpdateUserRequest, request: Request,background_tasks: BackgroundTasks,  auth_user  = Depends(get_current_admin_or_camara)):
    """Edita información del comercio vinculada a la cámara."""
    try:
        check = supabase.table("profiles").select("*").eq("id", user_id).execute()
        if not check.data:
             raise HTTPException(status_code=404, detail="Comercio no encontrado")
        
        perfil = check.data[0]
        if perfil.get("rol") != "COMERCIO":
             raise HTTPException(status_code=403, detail="Solo se pueden editar comercios")
             
        if perfil.get("titular_id") != auth_user.id:
             raise HTTPException(status_code=403, detail="Este comercio no pertenece a su cámara")

        update_data = req.dict(exclude_unset=True)
        if not update_data:
            return {"message": "Sin cambios"}
            
        update_data["estado"] = "PENDIENTE" 
            
        res = supabase.table("profiles").update(update_data).eq("id", user_id).execute()
        
        background_tasks.add_task(registrar_auditoria, 
            usuario_id=auth_user.id,
            email_usuario=auth_user.email,
            rol_usuario="CAMARA",
            accion="UPDATE",
            tabla="profiles",
            registro_id=user_id,
            datos_anteriores=perfil,
            datos_nuevos=update_data,
            modulo="Gestión Comercios",
            request=request
        )
        return {"message": "Datos de comercio actualizados. Pendiente de re-aprobación del Admin.", "user": res.data[0]}
    except Exception as e:
        if isinstance(e, HTTPException): raise e
        raise HTTPException(status_code=500, detail=f"Error al editar comercio: {str(e)}")

@app.get("/api/admin/metrics/overview")
def get_metrics_overview(admin_user = Depends(get_current_admin)):
    """Endpoint para dashboard principal de KPIs"""
    try:
        # Extraer todos los perfiles para procesar metricas en memoria es mas facil por ahora
        # En prod con millones de registros se harian queries SELECT count(*) con raw SQL en rpc()
        res = supabase.table("profiles").select("rol, estado").execute()
        profiles = res.data or []
        
        total_socios = sum(1 for p in profiles if p.get("rol") == "SOCIO" and p.get("estado") == "APROBADO")
        total_comercios = sum(1 for p in profiles if p.get("rol") == "COMERCIO" and p.get("estado") == "APROBADO")
        total_pendientes = sum(1 for p in profiles if p.get("estado") == "PENDIENTE")
        
        return {
            "metrics": {
                "total_socios": total_socios,
                "total_comercios": total_comercios,
                "total_pendientes": total_pendientes,
                "ingresos_mes": 0 # TODO: Conectar con Stripe/MercadoPago luego
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error cargando métricas: {str(e)}")

@app.get("/api/camara/mis-comercios")
def get_my_dependents(auth_user = Depends(get_current_admin_or_camara)):
    """Retorna los comercios vinculados a la cámara o todos si es admin"""
    try:
        # Extraemos el rol del usuario autenticado de la tabla profiles
        profile_res = supabase.table("profiles").select("rol").eq("id", auth_user.id).execute()
        if not profile_res.data:
            raise HTTPException(status_code=403, detail="Perfil no encontrado")
            
        rol = profile_res.data[0]["rol"]
        
        query = supabase.table("profiles").select("*")
        if rol == "CAMARA":
            query = query.eq("titular_id", auth_user.id).eq("rol", "COMERCIO")
        elif rol == "ADMIN":
            query = query.eq("rol", "COMERCIO")
        
        res = query.execute()
        return {"dependientes": res.data}
    except Exception as e:
        if isinstance(e, HTTPException): raise e
        raise HTTPException(status_code=500, detail=f"Error al obtener dependientes: {str(e)}")

# 7. MODELO Y ENDPOINT ADMIN: CREAR COMERCIO
class ComercioRequest(BaseModel):
    nombre_comercio: str
    cuit: str
    email: EmailStr
    telefono: str
    rubro: str
    direccion: Optional[str] = None

@app.post("/api/admin/comercios", status_code=status.HTTP_201_CREATED)
def create_commerce(comercio: ComercioRequest, request: Request, background_tasks: BackgroundTasks, auth_user = Depends(get_current_admin_or_camara)):
    try:
        # Extraer rol y perfil del usuario autenticado
        profile_res = supabase.table("profiles").select("rol", "municipio").eq("id", auth_user.id).execute()
        if not profile_res.data:
            raise HTTPException(status_code=403, detail="Perfil no encontrado")
        
        user_profile = profile_res.data[0]
        user_rol = user_profile["rol"]
        user_municipio = user_profile["municipio"]

        # Si el usuario es CAMARA, aplicar límites y reglas
        titular_id = None
        final_municipio = None # Se tomará del request si es ADMIN

        if user_rol == "CAMARA":
            # 1. Validar límite de 10 comercios
            count_res = supabase.table("profiles").select("id", count="exact").eq("titular_id", auth_user.id).eq("rol", "COMERCIO").execute()
            if count_res.count is not None and count_res.count >= 10:
                raise HTTPException(status_code=400, detail="Has alcanzado el límite de 10 comercios registrados para tu cámara.")
            
            # 2. El municipio del comercio DEBE ser el mismo de la cámara
            titular_id = auth_user.id
            final_municipio = user_municipio
        else:
            # Si es ADMIN, puede elegir municipio (si viene en el request, aunque el modelo no lo tiene, lo dejamos para el futuro o usamos rubro temporalmente si se mapeó así)
            # Por ahora, si es ADMIN, titular_id queda en None.
            pass

        default_password = "comercio1234" 
        
        auth_response = supabase.auth.admin.create_user({
            "email": comercio.email,
            "password": default_password,
            "email_confirm": True
        })
        
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
            "municipio": final_municipio or user_municipio, # Fallback al municipio del creador si no se define
            "password_changed": False,
            "titular_id": titular_id
        }
        
        supabase.table("profiles").insert(profile_data).execute()

        commerce_data = {
            "id": user_id,
            "nombre_comercio": comercio.nombre_comercio,
            "cuit": comercio.cuit,
            "rubro": comercio.rubro,
            "direccion": comercio.direccion
        }
        supabase.table("comercios").insert(commerce_data).execute()
        
        # Auditoría
        background_tasks.add_task(registrar_auditoria, 
            usuario_id=auth_user.id if auth_user else None,
            email_usuario=auth_user.email if auth_user else "Sistema",
            rol_usuario=user_rol,
            accion="CREATE",
            tabla="profiles",
            registro_id=user_id,
            datos_anteriores=None,
            datos_nuevos=profile_data,
            modulo="Gestión Comercios",
            request=request
        )
        
        return {
            "message": f"Comercio creado correctamente. Contraseña temporal: {default_password}", 
            "comercio": profile_data
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Error al crear comercio: {str(e)}"
        )


# ── MODELOS PARA OFERTAS ──────────────────────────────────────────────────────
class OfertaRequest(BaseModel):
    titulo: str
    descripcion: Optional[str] = None
    tipo: str  # 'promocion' | 'descuento' | 'beneficio'
    descuento_porcentaje: Optional[int] = None
    imagen_url: Optional[str] = None
    fecha_fin: Optional[str] = None

class OfertaUpdateRequest(BaseModel):
    activo: Optional[bool] = None
    titulo: Optional[str] = None
    descripcion: Optional[str] = None
    imagen_url: Optional[str] = None

# ── Función auxiliar para obtener el comercio_id del JWT ─────────────────────
def get_current_user_id(authorization: str) -> str:
    """Extrae el user_id del JWT de Supabase."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Token requerido")
    token = authorization.replace("Bearer ", "")
    try:
        user = supabase.auth.get_user(token)
        return user.user.id
    except Exception:
        raise HTTPException(status_code=401, detail="Token inválido o expirado")

# ── ENDPOINTS OFERTAS ─────────────────────────────────────────────────────────

@app.get("/api/ofertas")
def listar_ofertas(authorization: str = ""):
    """Lista las ofertas del comercio autenticado."""
    from fastapi import Request
    comercio_id = get_current_user_id(authorization)
    try:
        result = supabase.table("ofertas") \
            .select("*") \
            .eq("comercio_id", comercio_id) \
            .order("created_at", desc=True) \
            .execute()
        return {"ofertas": result.data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/ofertas", status_code=201)
def crear_oferta(oferta: OfertaRequest, request: Request, background_tasks: BackgroundTasks, authorization: str = ""):
    """Crea una nueva oferta para el comercio autenticado."""
    comercio_id = get_current_user_id(authorization)
    if oferta.tipo not in ["promocion", "descuento", "beneficio"]:
        raise HTTPException(status_code=400, detail="Tipo inválido. Usar: promocion, descuento, beneficio")
    try:
        data = {
            "comercio_id": comercio_id,
            "titulo": oferta.titulo,
            "descripcion": oferta.descripcion,
            "tipo": oferta.tipo,
            "descuento_porcentaje": oferta.descuento_porcentaje,
            "imagen_url": oferta.imagen_url,
            "fecha_fin": oferta.fecha_fin,
            "activo": True,
        }
        result = supabase.table("ofertas").insert(data).execute()
        
        # Auditoría
        background_tasks.add_task(registrar_auditoria, 
            usuario_id=comercio_id,
            email_usuario=None,
            rol_usuario="COMERCIO",
            accion="CREATE",
            tabla="ofertas",
            registro_id=result.data[0]["id"],
            datos_anteriores=None,
            datos_nuevos=data,
            modulo="Promociones",
            request=request
        )
        return {"message": "Oferta creada", "oferta": result.data[0]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.patch("/api/ofertas/{oferta_id}")
def actualizar_oferta(oferta_id: str, update: OfertaUpdateRequest, request: Request, background_tasks: BackgroundTasks, authorization: str = ""):
    """Actualiza (activo, título, descripción) de una oferta del comercio autenticado."""
    comercio_id = get_current_user_id(authorization)
    try:
        oferta_ant = supabase.table("ofertas").select("*").eq("id", oferta_id).eq("comercio_id", comercio_id).execute()
        datos_anteriores = oferta_ant.data[0] if oferta_ant.data else None
        
        update_data = {k: v for k, v in update.model_dump().items() if v is not None}
        result = supabase.table("ofertas") \
            .update(update_data) \
            .eq("id", oferta_id) \
            .eq("comercio_id", comercio_id) \
            .execute()
        if not result.data:
            raise HTTPException(status_code=404, detail="Oferta no encontrada")
            
        # Auditoría
        background_tasks.add_task(registrar_auditoria, 
            usuario_id=comercio_id,
            email_usuario=None,
            rol_usuario="COMERCIO",
            accion="UPDATE",
            tabla="ofertas",
            registro_id=oferta_id,
            datos_anteriores=datos_anteriores,
            datos_nuevos=update_data,
            modulo="Promociones",
            request=request
        )
        return {"message": "Oferta actualizada", "oferta": result.data[0]}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/ofertas/{oferta_id}", status_code=204)
def eliminar_oferta(oferta_id: str, request: Request, background_tasks: BackgroundTasks, authorization: str = ""):
    """Elimina una oferta del comercio autenticado."""
    comercio_id = get_current_user_id(authorization)
    try:
        oferta_ant = supabase.table("ofertas").select("*").eq("id", oferta_id).eq("comercio_id", comercio_id).execute()
        datos_anteriores = oferta_ant.data[0] if oferta_ant.data else None
        
        supabase.table("ofertas") \
            .delete() \
            .eq("id", oferta_id) \
            .eq("comercio_id", comercio_id) \
            .execute()
            
        background_tasks.add_task(registrar_auditoria, 
            usuario_id=comercio_id,
            email_usuario=None,
            rol_usuario="COMERCIO",
            accion="DELETE",
            tabla="ofertas",
            registro_id=oferta_id,
            datos_anteriores=datos_anteriores,
            datos_nuevos=None,
            modulo="Promociones",
            request=request
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ── ENDPOINT PÚBLICO: ver ofertas por municipio (para socios) ─────────────────
@app.get("/api/ofertas/publicas")
def ofertas_publicas(limit: int = Query(default=50, le=100), offset: int = Query(default=0, ge=0), municipio: Optional[str] = None):
    """Ofertas activas de comercios, filtradas opcionalmente por municipio."""
    try:
        query = supabase.table("ofertas") \
            .select("*, profiles!comercio_id(nombre_apellido, municipio, rubro)") \
            .eq("activo", True) \
            .order("created_at", desc=True) \
            .range(offset, offset + limit - 1)
        if municipio:
            query = query.eq("profiles.municipio", municipio)
        result = query.execute()
        return {"ofertas": result.data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.put("/api/perfil")
def update_profile(req: UpdateProfileRequest, request: Request,background_tasks: BackgroundTasks,  current_user  = Depends(get_current_user)):
    """
    Actualiza los datos del perfil del usuario autenticado.
    Vulnerabilidad de Mass Assignment parcheada mediante Dict Exclude.
    """
    try:
        update_data = req.dict(exclude_unset=True)
        if not update_data:
            return {"message": "Sin cambios"}
            
        perfil_ant = supabase.table("profiles").select("*").eq("id", current_user.id).execute()
        datos_anteriores = perfil_ant.data[0] if perfil_ant.data else None
            
        if "email" in update_data:
            try:
                # Update email in Supabase Auth
                supabase.auth.admin.update_user_by_id(current_user.id, {"email": update_data["email"], "email_confirm": True})
            except Exception as e:
                raise HTTPException(status_code=400, detail=f"No se pudo actualizar el email de acceso: {str(e)}")

        res = supabase.table("profiles").update(update_data).eq("id", current_user.id).execute()
        if not res.data:
            raise HTTPException(status_code=404, detail="Usuario no encontrado")
            
        background_tasks.add_task(registrar_auditoria, 
            usuario_id=current_user.id,
            email_usuario=current_user.email,
            rol_usuario=None,
            accion="UPDATE",
            tabla="profiles",
            registro_id=current_user.id,
            datos_anteriores=datos_anteriores,
            datos_nuevos=update_data,
            modulo="Perfil",
            request=request
        )
        return {"message": "Perfil actualizado", "user": res.data[0]}
    except Exception as e:
        if isinstance(e, HTTPException): raise e
        raise HTTPException(status_code=500, detail=f"Error al editar usuario: {str(e)}")

# ── ENDPOINTS GESTIÓN DE DEPENDIENTES (ADHERENTES / EMPLEADOS) ────────────────
@app.get("/api/mis-dependientes")
def get_mis_dependientes(current_user = Depends(get_current_user)):
    """Retorna los adherentes/empleados del usuario actual."""
    try:
        res = supabase.table("profiles").select("*").eq("titular_id", current_user.id).order("created_at", desc=True).execute()
        return {"dependientes": res.data}
    except Exception as e:
         raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/agregar-dependiente", status_code=201)
def agregar_dependiente(req: AddDependienteRequest, request: Request,background_tasks: BackgroundTasks,  current_user  = Depends(get_current_user)):
    """Crea un perfil que depende del usuario en sesión."""
    try:
        # 1. Obtener perfil titular para heredar Rol y otros datos
        titular_res = supabase.table("profiles").select("rol, municipio, rubro").eq("id", current_user.id).execute()
        if not titular_res.data:
            raise HTTPException(status_code=404, detail="Titular no encontrado")
        titular = titular_res.data[0]
        
        # 2. Email ficticio si no provee (para Supabase Auth)
        user_email = req.email if req.email else f"dependiente.{req.dni_cuit}@sociedadrural.local"
        user_password = req.password if req.password and len(req.password) >= 6 else "socio1234"
        
        # 3. Crear usuario en Auth
        auth_response = supabase.auth.admin.create_user({
            "email": user_email,
            "password": user_password,
            "email_confirm": True
        })
        user_id = auth_response.user.id
        
        # 4. Insertar en Profiles
        profile_data = {
            "id": user_id,
            "nombre_apellido": req.nombre_apellido,
            "dni": req.dni_cuit,
            "email": user_email,
            "telefono": req.telefono,
            "rol": titular["rol"], # Hereda rol del titular (ej. SOCIO o COMERCIO)
            "estado": "APROBADO", # Dependientes pre-aprobados por el titular
            "municipio": titular["municipio"],
            "rubro": titular["rubro"],
            "titular_id": current_user.id,
            "tipo_vinculo": req.tipo_vinculo,
            "password_changed": False
        }
        
        try:
            supabase.table("profiles").insert(profile_data).execute()
            
            background_tasks.add_task(registrar_auditoria, 
                usuario_id=current_user.id,
                email_usuario=current_user.email,
                rol_usuario=titular["rol"],
                accion="CREATE",
                tabla="profiles",
                registro_id=user_id,
                datos_anteriores=None,
                datos_nuevos=profile_data,
                modulo="Gestión Dependientes",
                request=request
            )
        except Exception as e:
            supabase.auth.admin.delete_user(user_id)
            raise e
            
        return {"message": "Dependiente agregado correctamente", "dependiente": profile_data}
    except Exception as e:
        if isinstance(e, HTTPException): raise e
        raise HTTPException(status_code=400, detail=f"Error al agregar: {str(e)}")

@app.delete("/api/dependientes/{dependiente_id}")
def eliminar_dependiente(dependiente_id: str, request: Request,background_tasks: BackgroundTasks,  current_user  = Depends(get_current_user)):
    """Desvincula y elimina a un adherente/empleado."""
    try:
        # Verificar que le pertenece
        check = supabase.table("profiles").select("*").eq("id", dependiente_id).eq("titular_id", current_user.id).execute()
        if not check.data:
            raise HTTPException(status_code=403, detail="No tienes permiso para eliminar este dependiente")
            
        datos_anteriores = check.data[0]
            
        # Eliminar de Auth borrará de Profiles en cascada (o lo hacemos manual)
        supabase.auth.admin.delete_user(dependiente_id)
        
        background_tasks.add_task(registrar_auditoria, 
            usuario_id=current_user.id,
            email_usuario=current_user.email,
            rol_usuario=None,
            accion="DELETE",
            tabla="profiles",
            registro_id=dependiente_id,
            datos_anteriores=datos_anteriores,
            datos_nuevos=None,
            modulo="Gestión Dependientes",
            request=request
        )
        
        return {"message": "Dependiente eliminado"}
    except Exception as e:
        if isinstance(e, HTTPException): raise e
        raise HTTPException(status_code=500, detail=str(e))

from fastapi import UploadFile, File

@app.post("/api/perfil/foto")
async def upload_foto(file: UploadFile = File(...), current_user = Depends(get_current_user)):
    """
    Sube una foto al bucket 'perfiles' y actualiza la URL en el perfil.
    """
    try:
        # 1. Leer contenido del archivo
        file_content = await file.read()
        file_ext = file.filename.split(".")[-1]
        file_path = f"{current_user.id}/profile.{file_ext}"
        
        # 2. Subir a Supabase Storage
        res_storage = supabase.storage.from_("perfiles").upload(
            path=file_path,
            file=file_content,
            file_options={"content-type": file.content_type, "upsert": "true"}
        )
        
        # 3. Obtener URL pública
        public_url = f"{SUPABASE_URL}/storage/v1/object/public/perfiles/{file_path}"
        
        # 4. Actualizar en la tabla profiles
        supabase.table("profiles").update({"foto_url": public_url}).eq("id", current_user.id).execute()
        
        return {"message": "Foto actualizada", "foto_url": public_url}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error subiendo foto: {str(e)}")

@app.post("/api/ofertas/foto")
async def upload_oferta_foto(file: UploadFile = File(...), current_user = Depends(get_current_user)):
    """
    Sube una foto de oferta al bucket 'ofertas'.
    """
    try:
        file_content = await file.read()
        file_ext = file.filename.split(".")[-1]
        # Usamos UUID para evitar colisiones si el mismo comercio sube varias ofertas
        filename = f"{current_user.id}/{uuid4().hex}.{file_ext}"
        
        # Subir a Supabase Storage (bucket 'ofertas')
        try:
            supabase.storage.from_("ofertas").upload(
                path=filename,
                file=file_content,
                file_options={"content-type": file.content_type, "upsert": "true"}
            )
        except Exception as storage_err:
            # Si el bucket no existe en el primer intento, loggeamos el error
            # En entorno real, el bucket 'ofertas' debe ser creado manualmente en el dashboard de Supabase
            print(f"Error en Storage (asegurese que el bucket 'ofertas' sea publico): {storage_err}")
            raise storage_err
        
        public_url = f"{SUPABASE_URL}/storage/v1/object/public/ofertas/{filename}"
        
        return {"message": "Imagen de oferta subida", "imagen_url": public_url}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error subiendo imagen de oferta: {str(e)}")

@app.post("/api/notificar-olvido-password")
@limiter.limit("3/minute")
def notificar_olvido_password(req: ForgotPasswordRequest, request: Request):
    """
    Registra una solicitud de recuperación de contraseña para que el administrador la procese.
    """
    try:
        identificador = req.identificador.strip()
        
        # Opcional: Buscar el perfil para validar que existe y obtener más datos
        profile_res = None
        if "@" in identificador:
            profile_res = supabase.table("profiles").select("id, email, nombre_apellido").eq("email", identificador).execute()
        else:
            profile_res = supabase.table("profiles").select("id, email, nombre_apellido").eq("dni", identificador).execute()
            
        if not profile_res.data:
            # Por seguridad, no informamos si el usuario existe o no, pero internamente fallamos
            return {"message": "Si el usuario existe, el administrador ha sido notificado."}

        perfil = profile_res.data[0]
        
        # Registrar la solicitud en una tabla 'soporte' o similar. 
        # Si no existe la tabla, podemos usar un log o una tabla genérica de notificaciones.
        # Por simplicidad ahora, intentaremos insertar en una tabla 'notificaciones_admin'
        notif_data = {
            "usuario_id": perfil["id"],
            "tipo": "OLVIDO_PASSWORD",
            "descripcion": f"El usuario {perfil['nombre_apellido']} ({perfil['email']}) solicita restablecer su contraseña.",
            "estado": "PENDIENTE"
        }
        
        # Nota: Asumimos que existe una tabla o la creamos vía código si falla el insert directo por falta de tabla
        try:
            supabase.table("notificaciones_admin").insert(notif_data).execute()
        except:
            # Fallback a un log si la tabla no existe aún o falla
            print(f"⚠️ NOTIFICACIÓN ADMIN: {notif_data['descripcion']}")

        return {"message": "Solicitud enviada correctamente. El administrador se pondrá en contacto pronto."}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al procesar solicitud: {str(e)}")

# ── ENDPOINT DE AUDITORÍA (ADMIN) ─────────────────────────────────────────────
@app.get("/api/admin/auditoria")
def get_auditoria(
    request: Request,
    admin_user = Depends(get_current_admin),
    usuario_id: Optional[str] = None,
    accion: Optional[str] = None,
    tabla_afectada: Optional[str] = None,
    modulo: Optional[str] = None,
    limit: int = Query(default=50, le=100),
    offset: int = Query(default=0, ge=0)
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
        raise HTTPException(status_code=500, detail=f"Error obteniendo logs de auditoría: {str(e)}")

# ─────────────────────────────────────────────────────────────────
# 11. ENDPOINTS GESTIÓN DE EVENTOS INSTITUCIONALES
# ─────────────────────────────────────────────────────────────────
@app.get("/api/eventos")
def get_combined_eventos(
    municipio: Optional[str] = None,
    tipo: Optional[str] = None,
    fecha_desde: Optional[str] = None
):
    """
    Consulta la lista de eventos combinando eventos institucionales y 
    eventos importados de redes sociales (aprobados).
    """
    try:
        # 1. Obtener eventos institucionales
        query1 = supabase.table("eventos").select("*")
        if municipio:
            query1 = query1.ilike("lugar", f"%{municipio}%")
        if tipo:
            query1 = query1.ilike("tipo", f"%{tipo}%")
        if fecha_desde:
            query1 = query1.gte("fecha", fecha_desde)
            
        res1 = query1.order("fecha", desc=False).execute()
        eventos_inst = res1.data or []

        # 2. Obtener eventos de redes sociales (aprobados)
        query2 = supabase.table("eventos_sociales").select("*").eq("status", "aprobado")
        if municipio:
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
            social_normalized.append({
                "id": ev["id"],
                "titulo": ev["titulo"],
                "descripcion": ev.get("descripcion_limpia", ""),
                "lugar": ev.get("lugar", "A definir"),
                "fecha": ev["fecha_evento"],
                "hora": ev["hora_evento"],
                "tipo": "Social", # Etiqueta para distinguir origen
                "imagen_url": ev.get("imagen_url")
            })
            
        # 4. Combinar y ordenar por fecha
        combined = eventos_inst + social_normalized
        combined.sort(key=lambda x: x["fecha"])
        
        return {"eventos": combined}
    except Exception as e:
        logger.error(f"Error combinando eventos: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error al obtener eventos: {str(e)}")

@app.post("/api/admin/eventos", status_code=201)
def create_evento(evento: EventCreate, request: Request, background_tasks: BackgroundTasks, admin_user = Depends(get_current_admin)):
    """Crea un nuevo evento desde el Panel Administrador"""
    try:
        evento_data = evento.dict()
        res = supabase.table("eventos").insert(evento_data).execute()
        
        if res.data:
            evento_creado = res.data[0]
            background_tasks.add_task(registrar_auditoria, 
                usuario_id=admin_user.id,
                email_usuario=admin_user.email,
                rol_usuario="ADMIN",
                accion="CREATE",
                tabla="eventos",
                registro_id=evento_creado["id"],
                datos_anteriores=None,
                datos_nuevos=evento_data,
                modulo="Gestión Eventos",
                request=request
            )
            return {"message": "Evento creado exitosamente", "evento": evento_creado}
        raise HTTPException(status_code=500, detail="Error desconocido al insertar evento")
    except Exception as e:
        if isinstance(e, HTTPException): raise e
        raise HTTPException(status_code=500, detail=f"Error al crear evento: {str(e)}")

@app.delete("/api/admin/eventos/{evento_id}")
def delete_evento(evento_id: str, request: Request, background_tasks: BackgroundTasks, admin_user = Depends(get_current_admin)):
    """Elimina un evento desde el Panel Administrador"""
    try:
        evento_ant = supabase.table("eventos").select("*").eq("id", evento_id).execute()
        datos_anteriores = evento_ant.data[0] if evento_ant.data else None
        
        if not datos_anteriores:
            raise HTTPException(status_code=404, detail="Evento no encontrado")

        res = supabase.table("eventos").delete().eq("id", evento_id).execute()
        
        background_tasks.add_task(registrar_auditoria, 
            usuario_id=admin_user.id,
            email_usuario=admin_user.email,
            rol_usuario="ADMIN",
            accion="DELETE",
            tabla="eventos",
            registro_id=evento_id,
            datos_anteriores=datos_anteriores,
            datos_nuevos=None,
            modulo="Gestión Eventos",
            request=request
        )
        return {"message": "Evento eliminado correctamente"}
    except Exception as e:
        if isinstance(e, HTTPException): raise e
        raise HTTPException(status_code=500, detail=f"Error al eliminar evento: {str(e)}")

@app.put("/api/admin/eventos/{evento_id}")
def update_evento(evento_id: str, req: EventUpdate, request: Request, background_tasks: BackgroundTasks, admin_user = Depends(get_current_admin)):
    """Actualiza un evento desde el Panel Administrador"""
    try:
        update_data = {k: v for k, v in req.dict().items() if v is not None}
        if not update_data:
            return {"message": "Sin cambios"}

        evento_ant = supabase.table("eventos").select("*").eq("id", evento_id).execute()
        datos_anteriores = evento_ant.data[0] if evento_ant.data else None
        
        if not datos_anteriores:
            raise HTTPException(status_code=404, detail="Evento no encontrado")

        res = supabase.table("eventos").update(update_data).eq("id", evento_id).execute()
        
        background_tasks.add_task(registrar_auditoria, 
            usuario_id=admin_user.id,
            email_usuario=admin_user.email,
            rol_usuario="ADMIN",
            accion="UPDATE",
            tabla="eventos",
            registro_id=evento_id,
            datos_anteriores=datos_anteriores,
            datos_nuevos=update_data,
            modulo="Gestión Eventos",
            request=request
        )
        return {"message": "Evento actualizado correctamente", "evento": res.data[0]}
    except Exception as e:
        if isinstance(e, HTTPException): raise e
        raise HTTPException(status_code=500, detail=f"Error al actualizar evento: {str(e)}")


@app.post("/api/v1/importar-evento")
async def importar_evento(payload: WebhookEventoPayload, request: Request):
    """
    Endpoint para recibir publicaciones de Make.com (Instagram/Facebook).
    Procesa el texto, guarda la imagen en Storage y persiste en la tabla eventos_sociales.
    """
    # 1. Validar Token de seguridad
    token = request.headers.get("X-Webhook-Token")
    secret_token = os.getenv("WEBHOOK_SECRET_TOKEN")
    
    if not token or token != secret_token:
        logger.warning(f"Intento de acceso no autorizado al webhook desde IP {request.client.host if request.client else 'unknown'}")
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token de webhook no válido o ausente")

    try:
        # 2. Procesar Texto con Regex
        datos_procesados = procesar_texto_evento(payload.caption)
        
        # 3. Procesar Imagen (Descargar y subir a Supabase Storage)
        url_final_imagen = procesar_imagen_evento(payload.media_url, payload.post_id)
        
        # 4. Preparar datos para inserción/actualización
        remate_data = {
            "external_id": payload.post_id,
            "titulo": datos_procesados["titulo"],
            "descripcion_limpia": datos_procesados["descripcion_limpia"],
            "lugar": datos_procesados["lugar"],
            "fecha_evento": datos_procesados["fecha_evento"],
            "hora_evento": datos_procesados["hora_evento"],
            "imagen_url": url_final_imagen,
            "metadata": {
                "original_caption": payload.caption,
                "original_media_url": payload.media_url,
                "timestamp": payload.timestamp
            },
            "status": "borrador" # Por defecto entra para aprobación manual
        }
        
        # 5. Persistencia (Upsert por external_id)
        # La tabla debe tener external_id como UNIQUE
        res = supabase.table("eventos_sociales").upsert(remate_data, on_conflict="external_id").execute()
        
        if res.data:
            logger.info(f"Evento importado exitosamente: {payload.post_id}")
            return {
                "status": "success", 
                "message": "Evento procesado correctamente",
                "id": res.data[0].get("id"),
                "external_id": payload.post_id
            }
        
        return {"status": "success", "external_id": payload.post_id}
        
    except Exception as e:
        logger.error(f"Error crítico procesando evento webhook {payload.post_id}: {str(e)}")
        # No queremos dar demasiados detalles del error interno al webhook remoto
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, 
            detail="Error interno procesando el remate"
        )



# ── ENDPOINTS GESTIÓN DE EVENTOS DE REDES SOCIALES (ADMIN) ───────────────────
@app.get("/api/admin/eventos-sociales")
def get_all_social_eventos(limit: int = 50, offset: int = 0, admin_user = Depends(get_current_admin)):
    """Retorna todos los eventos importados de redes sociales para gestión admin"""
    try:
        response = supabase.table("eventos_sociales").select("*").order("created_at", desc=True).range(offset, offset + limit - 1).execute()
        return {"eventos": response.data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class UpdateEventoSocialStatusRequest(BaseModel):
    status: str # "borrador" | "aprobado" | "rechazado"

@app.put("/api/admin/eventos-sociales/{evento_id}/status")
def update_evento_social_status(evento_id: str, req: UpdateEventoSocialStatusRequest, request: Request, background_tasks: BackgroundTasks, admin_user = Depends(get_current_admin)):
    """Aprueba o rechaza un evento de redes sociales"""
    try:
        evento_ant = supabase.table("eventos_sociales").select("*").eq("id", evento_id).execute()
        datos_anteriores = evento_ant.data[0] if evento_ant.data else None
        
        if not datos_anteriores:
            raise HTTPException(status_code=404, detail="Evento no encontrado")

        res = supabase.table("eventos_sociales").update({"status": req.status}).eq("id", evento_id).execute()
        
        background_tasks.add_task(registrar_auditoria, 
            usuario_id=admin_user.id,
            email_usuario=admin_user.email,
            rol_usuario="ADMIN",
            accion="UPDATE_STATUS",
            tabla="eventos_sociales",
            registro_id=evento_id,
            datos_anteriores=datos_anteriores,
            datos_nuevos={"status": req.status},
            modulo="Gestión Eventos Sociales",
            request=request
        )
        return {"message": f"Estado actualizado a {req.status}", "evento": res.data[0]}
    except Exception as e:
        if isinstance(e, HTTPException): raise e
        raise HTTPException(status_code=500, detail=f"Error al actualizar estado del evento: {str(e)}")

class EventoSocialUpdate(BaseModel):
    titulo: Optional[str] = None
    descripcion_limpia: Optional[str] = None
    lugar: Optional[str] = None
    fecha_evento: Optional[str] = None
    hora_evento: Optional[str] = None
    imagen_url: Optional[str] = None

@app.put("/api/admin/eventos-sociales/{evento_id}")
def update_evento_social(evento_id: str, req: EventoSocialUpdate, request: Request, background_tasks: BackgroundTasks, admin_user = Depends(get_current_admin)):
    """Actualiza un evento de redes sociales desde el Panel Administrador"""
    try:
        update_data = {k: v for k, v in req.dict().items() if v is not None}
        if not update_data:
            return {"message": "Sin cambios"}

        evento_ant = supabase.table("eventos_sociales").select("*").eq("id", evento_id).execute()
        datos_anteriores = evento_ant.data[0] if evento_ant.data else None
        
        if not datos_anteriores:
            raise HTTPException(status_code=404, detail="Evento no encontrado")

        res = supabase.table("eventos_sociales").update(update_data).eq("id", evento_id).execute()
        
        background_tasks.add_task(registrar_auditoria, 
            usuario_id=admin_user.id,
            email_usuario=admin_user.email,
            rol_usuario="ADMIN",
            accion="UPDATE",
            tabla="eventos_sociales",
            registro_id=evento_id,
            datos_anteriores=datos_anteriores,
            datos_nuevos=update_data,
            modulo="Gestión Eventos Sociales",
            request=request
        )
        return {"message": "Evento actualizado correctamente", "evento": res.data[0]}
    except Exception as e:
        if isinstance(e, HTTPException): raise e
        raise HTTPException(status_code=500, detail=f"Error al actualizar evento: {str(e)}")

@app.delete("/api/admin/eventos-sociales/{evento_id}")
def delete_evento_social(evento_id: str, request: Request, background_tasks: BackgroundTasks, admin_user = Depends(get_current_admin)):
    """Elimina un evento de redes sociales"""
    try:
        evento_ant = supabase.table("eventos_sociales").select("*").eq("id", evento_id).execute()
        datos_anteriores = evento_ant.data[0] if evento_ant.data else None
        
        if not datos_anteriores:
            raise HTTPException(status_code=404, detail="Evento no encontrado")

        res = supabase.table("eventos_sociales").delete().eq("id", evento_id).execute()
        
        background_tasks.add_task(registrar_auditoria, 
            usuario_id=admin_user.id,
            email_usuario=admin_user.email,
            rol_usuario="ADMIN",
            accion="DELETE",
            tabla="eventos_sociales",
            registro_id=evento_id,
            datos_anteriores=datos_anteriores,
            datos_nuevos=None,
            modulo="Gestión Eventos Sociales",
            request=request
        )
        return {"message": "Evento eliminado correctamente"}
    except Exception as e:
        if isinstance(e, HTTPException): raise e
        raise HTTPException(status_code=500, detail=f"Error al eliminar evento: {str(e)}")


# ── ENDPOINTS DE NOTIFICACIONES Y FCM ───────────────────────────────────────

class PushTokenRequest(BaseModel):
    token: str
    plataforma: str = "web"

@app.post("/api/push-tokens")
def register_push_token(req: PushTokenRequest, current_user = Depends(get_current_user)):
    """Registra o actualiza el token FCM del usuario conectado"""
    try:
        # Upsert token (usualmente un usuario tiene un token por dispositivo,
        # simplificamos guardando el último o actualizando si ya existe).
        # Verificamos si el token existe
        existente = supabase.table("push_tokens").select("id").eq("token", req.token).execute()
        if existente.data:
            supabase.table("push_tokens").update({
                "usuario_id": current_user.id,
                "plataforma": req.plataforma
            }).eq("token", req.token).execute()
        else:
            supabase.table("push_tokens").insert({
                "usuario_id": current_user.id,
                "token": req.token,
                "plataforma": req.plataforma
            }).execute()
            
        return {"message": "Token registrado exitosamente"}
    except Exception as e:
        if isinstance(e, HTTPException): raise e
        raise HTTPException(status_code=500, detail=f"Error al registrar token: {str(e)}")


@app.get("/api/notificaciones")
def get_user_notifications(limit: int = 50, current_user = Depends(get_current_user)):
    """Obtiene las notificaciones in-app del usuario conectado"""
    try:
        response = supabase.table("notificaciones_usuarios") \
            .select("*") \
            .eq("usuario_id", current_user.id) \
            .order("created_at", desc=True) \
            .limit(limit) \
            .execute()
        
        # Conteo de no leídas
        no_leidas = sum(1 for n in response.data if not n.get("leido", True))
            
        return {
            "notificaciones": response.data,
            "no_leidas": no_leidas
        }
    except Exception as e:
        if isinstance(e, HTTPException): raise e
        raise HTTPException(status_code=500, detail=f"Error obteniendo notificaciones: {str(e)}")


@app.put("/api/notificaciones/marcar-leidas")
def mark_notifications_read(current_user = Depends(get_current_user)):
    """Marca todas las notificaciones del usuario como leídas (o saca la bolita roja)"""
    try:
        supabase.table("notificaciones_usuarios") \
            .update({"leido": True}) \
            .eq("usuario_id", current_user.id) \
            .eq("leido", False) \
            .execute()
            
        return {"message": "Notificaciones marcadas como leídas"}
    except Exception as e:
        if isinstance(e, HTTPException): raise e
        raise HTTPException(status_code=500, detail=f"Error al actualizar notificaciones: {str(e)}")


def enviar_notificacion_push_inapp(usuario_id: str, titulo: str, mensaje: str, link_url: Optional[str] = None):
    """
    Función utilitaria (interna) para enviar una notificación In-App y Push (vía FCM) a un usuario.
    Debe ser llamada de manera asíncrona o bloqueante según sea necesario.
    """
    try:
        # 1. Guardar Notificación In-App en Base de Datos
        supabase.table("notificaciones_usuarios").insert({
            "usuario_id": usuario_id,
            "titulo": titulo,
            "mensaje": mensaje,
            "link_url": link_url
        }).execute()
        
        # 2. Obtener Token(s) FCM asociados al usuario para envíos Push
        tokens_res = supabase.table("push_tokens").select("token").eq("usuario_id", usuario_id).execute()
        push_tokens = [t["token"] for t in tokens_res.data] if tokens_res.data else []
        
        # 3. Disparar FCM si está configurado y hay tokens
        if push_tokens:
            try:
                # Utilizamos firebase_admin si está instanciado
                app_firebase = firebase_admin.get_app()
                
                push_message = messaging.MulticastMessage(
                    notification=messaging.Notification(
                        title=titulo,
                        body=mensaje,
                    ),
                    data={"link_url": link_url or "/"},
                    tokens=push_tokens,
                )
                messaging.send_each_for_multicast(push_message)
            except ValueError:
                print("Firebase no inicializado. Se guardó In-App pero no se envió Push.")
            except Exception as e:
                print(f"Error al enviar Push a fcm: {e}")
                
    except Exception as e:
        print(f"Error general en enviar_notificacion_push_inapp: {e}")

@app.post("/api/notificaciones/test")
def test_send_notification(current_user = Depends(get_current_admin)):
    """Endpoint de QA: Manda una notificación in-app y push al propio admin logueado"""
    enviar_notificacion_push_inapp(
        usuario_id=current_user.id,
        titulo="Notificación de Prueba 🚀",
        mensaje="Si ves esto, las notificaciones in-app y Push están funcionando correctamente en tu dispositivo.",
        link_url="/"
    )
    return {"message": "Notificación disparada."}

# ─────────────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
