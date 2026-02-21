import os
import time
import logging
from dotenv import load_dotenv

# Cargar variables de entorno al inicio (para evitar valores nulos/por defecto incorrectos)
load_dotenv()
from typing import List, Optional, Dict, Any, Union
from datetime import datetime, timedelta

from fastapi import FastAPI, Depends, HTTPException, status, Request, Query, Response
from fastapi.responses import JSONResponse
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from jose import JWTError, jwt
from passlib.context import CryptContext
import mercadopago
from supabase import create_client, Client
from supabase.client import ClientOptions
import firebase_admin
from firebase_admin import credentials, messaging

# --- SECURITY: RATE LIMITING ---
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

# --- CONFIGURACIÓN DE ENTORNO ---
ENV = os.getenv("ENV", "development") # development | production
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")
API_PUBLIC_URL = os.getenv("API_PUBLIC_URL", "https://api.tudominio.com") 

# --- LOGGING CONFIG ---
logging.basicConfig(
    level=getattr(logging, LOG_LEVEL),
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S"
)
logger = logging.getLogger("SociedadRuralAPI")

# --- CONFIGURACIÓN SECRETOS ---
SECRET_KEY = os.getenv("SECRET_KEY", "prod-secret-fallback-spec-2026")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 # Reducido a 1 hora por seguridad SPEC
MP_ACCESS_TOKEN = os.getenv("MP_ACCESS_TOKEN", "TEST-token-placeholder")

# Inicializar Mercado Pago
mp_sdk = mercadopago.SDK(MP_ACCESS_TOKEN)

url: str = os.getenv("SUPABASE_URL", "")
key: str = os.getenv("SUPABASE_KEY", "")
service_role_key: str = os.getenv("SUPABASE_SERVICE_KEY", key)

# Cliente Privilegiado (Para operaciones de base de datos protegidas)
if service_role_key == key:
    logger.warning("⚠️ SUPABASE_SERVICE_KEY no detectada o igual a ANON_KEY. La creación de usuarios fallará.")
else:
    logger.info("✅ SUPABASE_SERVICE_KEY detectada y cargada.")

try:
    supabase: Client = create_client(
        url, 
        service_role_key,
        options=ClientOptions(
            postgrest_client_timeout=10,
            schema="public"
        )
    )
except Exception as e:
    logger.critical(f"FATAL: No se pudo conectar a Supabase (Admin). {str(e)}")
    supabase = None

# Cliente Público (Para Auth signUp)
try:
    supabase_anon: Client = create_client(
        url, 
        key,
        options=ClientOptions(
            postgrest_client_timeout=10,
            schema="public"
        )
    )
except Exception as e:
    logger.critical(f"FATAL: No se pudo conectar a Supabase (Anon). {str(e)}")
    supabase_anon = None

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/v1/auth/token")

# --- FIREBASE CONFIG ---
firebase_app = None
fcm_creds_path = os.getenv("FIREBASE_SERVICE_ACCOUNT_PATH")
if fcm_creds_path and os.path.exists(fcm_creds_path):
    try:
        cred = credentials.Certificate(fcm_creds_path)
        firebase_app = firebase_admin.initialize_app(cred)
        logger.info("✅ Firebase Admin inicializado correctamente")
    except Exception as e:
        logger.error(f"❌ Error inicializando Firebase: {e}")
else:
    logger.warning("⚠️ Firebase no configurado (FIREBASE_SERVICE_ACCOUNT_PATH falta o no existe). Modo simulación activado.")

async def send_push_notification(token: str, title: str, body: str, data: dict = None):
    if not firebase_app:
        logger.info(f"🔔 [NOTIF - SIMULADA] To: {token} | {title}: {body}")
        return True
    try:
        message = messaging.Message(
            notification=messaging.Notification(title=title, body=body),
            data=data or {},
            token=token
        )
        messaging.send(message)
        return True
    except Exception as e:
        logger.error(f"Error enviando push: {e}")
        return False

# --- INICIALIZACIÓN APP ---
limiter = Limiter(key_func=get_remote_address)
app = FastAPI(
    title="Sociedad Rural API", 
    version="7.0.0-CTO-Optimized",
    description="API de Gestión para Sociedad Rural - Enterprise Ready",
    docs_url=None if ENV == "production" else "/docs", 
    redoc_url=None if ENV == "production" else "/redoc"
)

# Integrar Rate Limiter
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# --- MIDDLEWARE: CORS DINÁMICO ---
allowed_origins_str = os.getenv("ALLOWED_ORIGINS", "*")
allowed_origins = allowed_origins_str.split(",") if allowed_origins_str != "*" else ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True if "*" not in allowed_origins else False, # Credentials only allowed for specific origins
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- CTO OPTIMIZATION: HTTP CACHING & HEADERS ---
@app.middleware("http")
async def add_security_and_cache_headers(request: Request, call_next):
    response = await call_next(request)
    
    # 1. Security Headers (OWASP recommendation)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    
    # 2. Smart Caching Strategy
    # Solo cachear GETs exitosos que no sean autenticación o datos sensibles personales directos
    # DESHABILITAR CACHÉ si hay encabezado de Authorization (Admin/User logueado)
    has_auth = request.headers.get("Authorization")
    
    if request.method == "GET" and response.status_code == 200 and not has_auth:
        path = request.url.path
        # Datos estáticos (Cámaras, Municipios): Cache largo (1 hora)
        if "camaras" in path or "municipios" in path:
            response.headers["Cache-Control"] = "public, max-age=3600"
        # Datos semi-estáticos (Comercios públicos): Cache medio (5 min)
        elif "comercios" in path and "admin" not in path:
            response.headers["Cache-Control"] = "public, max-age=300"
        # Datos volátiles (Validación QR, Stats): No cache
        elif "qr/validate" in path or "stats" in path:
            response.headers["Cache-Control"] = "no-store"
    else:
        # Asegurar que no se cachee nada autenticado o no-GET
        response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate"
            
    return response

# --- MIDDLEWARE: LOGGING & PERFORMANCE ---
@app.middleware("http")
async def log_requests(request: Request, call_next):
    start_time = time.time()
    
    # Log Request
    logger.info(f"➡️ {request.method} {request.url.path} - IP: {request.client.host}")
    
    try:
        response = await call_next(request)
        process_time = (time.time() - start_time) * 1000
        logger.info(f"⬅️ {response.status_code} - {process_time:.2f}ms")
        return response
    except Exception as e:
        process_time = (time.time() - start_time) * 1000
        logger.error(f"❌ ERROR 500 - {process_time:.2f}ms - Details: {str(e)}", exc_info=True)
        return JSONResponse(
            status_code=500,
            content={"detail": "Error interno del servidor. Contacte al administrador."}
        )

# --- ROUTES: BASE ---
@app.get("/", tags=["Health"])
async def root():
    return {
        "status": "online",
        "message": "Sociedad Rural API is fully operational",
        "version": "7.0.0-CTO",
        "timestamp": datetime.utcnow().isoformat()
    }

@app.get("/api/v1/municipios", tags=["Configuración"])
async def get_municipios():
    """Retorna la lista de municipios configurados"""
    res = supabase.table("municipios").select("*").order("nombre").execute()
    return res.data or []

# --- MODELOS ---

class Token(BaseModel):
    access_token: str
    token_type: str
    user: Optional[dict] = None
    role: Optional[str] = None
    profile: Optional[dict] = None

class TokenData(BaseModel):
    username: Optional[str] = None
    role: Optional[str] = None
    uid: Optional[str] = None
    camara_id: Optional[str] = None 
    is_moroso: bool = False
    is_active: bool = True

class SocioCreate(BaseModel):
    nombre: str
    apellido: str
    dni: str
    email: str
    password: str
    rol: str = "comun"
    camara_id: Optional[str] = None

class SocioUpdate(BaseModel):
    nombre: Optional[str] = None
    apellido: Optional[str] = None
    rol: Optional[str] = None
    estado: Optional[str] = None
    is_moroso: Optional[bool] = None
    telefono: Optional[str] = None
    ciudad: Optional[str] = None
    provincia: Optional[str] = None
    dni: Optional[str] = None

class ComercioCreate(BaseModel):
    nombre: str
    cuit: str
    categoria: str
    barrio: Optional[str] = None
    provincia: Optional[str] = "Corrientes"
    ubicacion: str
    descripcion: Optional[str] = None
    logo_url: Optional[str] = None
    direccion: Optional[str] = ""
    telefono: Optional[str] = ""
    email: Optional[str] = ""
    temp_password: str
    municipio_id: Optional[str] = None
    camara_id: Optional[str] = None

class ComercioUpdate(BaseModel):
    nombre: Optional[str] = None
    categoria: Optional[str] = None
    barrio: Optional[str] = None
    provincia: Optional[str] = None
    ubicacion: Optional[str] = None
    descripcion: Optional[str] = None
    logo_url: Optional[str] = None
    direccion: Optional[str] = None
    telefono: Optional[str] = None
    email: Optional[str] = None
    descuento_base: Optional[int] = None
    rubro: Optional[str] = None

class PromocionCreate(BaseModel):
    comercio_id: Optional[str] = None
    titulo: str
    descripcion: Optional[str] = None
    imagen_url: Optional[str] = ""
    fecha_inicio: Optional[Union[datetime, str]] = None
    fecha_fin: Optional[Union[datetime, str]] = None
    estado: str = "activo"
    porcentaje_descuento: Optional[int] = 0

class PromocionUpdate(BaseModel):
    titulo: Optional[str] = None
    descripcion: Optional[str] = None
    imagen_url: Optional[str] = None
    fecha_inicio: Optional[datetime] = None
    fecha_fin: Optional[datetime] = None
    estado: Optional[str] = None
    porcentaje_descuento: Optional[int] = None

class EventoCreate(BaseModel):
    titulo: str
    descripcion: Optional[str] = None
    imagen_url: Optional[str] = None
    fecha: datetime
    lugar: Optional[str] = None
    estado: str = "activo"

class EventoUpdate(BaseModel):
    titulo: Optional[str] = None
    descripcion: Optional[str] = None
    imagen_url: Optional[str] = None
    fecha: Optional[datetime] = None
    lugar: Optional[str] = None
    estado: Optional[str] = None

class PasswordChange(BaseModel):
    current_password: str
    new_password: str

class PaymentPreferenceRequest(BaseModel):

    title: str = "Cuota Social Mensual"
    unit_price: float
    quantity: int = 1
    type: str = "cuota" # cuota | comercio_premium

# --- SEGURIDAD Y UTILIDADES ---

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=15))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

async def get_current_user(token: str = Depends(oauth2_scheme)):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        role: str = payload.get("role")
        uid: str = payload.get("uid")
        camara_id: str = payload.get("camara_id") 
        
        if username is None: raise HTTPException(status_code=401, detail="Token inválido")
        
        # Verificar estado actualizado en DB
        # Verificar estado actualizado en DB (Safe Mode: seleccionar todo para evitar error si faltan columnas nuevas)
        res = supabase.table("profiles").select("*").eq("id", uid).execute()
        if not res.data:
            raise HTTPException(status_code=401, detail="Usuario no encontrado")
        
        profile = res.data[0]
        is_active = profile.get("estado") == "activo"
        is_moroso = profile.get("is_moroso", False)

        return TokenData(
            username=username, 
            role=role, 
            uid=uid, 
            camara_id=camara_id,
            is_active=is_active,
            is_moroso=is_moroso
        )
    except JWTError:
        raise HTTPException(status_code=401, detail="No se pudo validar credenciales")

async def get_admin_user(user: TokenData = Depends(get_current_user)):
    if user.role not in ["admin_camara", "superadmin"]:
        raise HTTPException(status_code=403, detail="Requiere permisos de administrador")
    return user

async def get_active_user(user: TokenData = Depends(get_current_user)):
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Usuario inactivo. Contacte soporte.")
    if user.is_moroso:
        raise HTTPException(status_code=403, detail="Acceso restringido por deuda pendiente.")
    return user

# --- ENDPOINTS ---

@app.get("/api/v1/health")
@limiter.limit("5/minute")
async def health_check(request: Request):
    db_status = "unknown"
    if supabase:
        try:
            supabase.table("camaras").select("id").limit(1).execute()
            db_status = "connected"
        except Exception:
            db_status = "disconnected"
            
    return {
        "status": "ok", 
        "phase": "8.0 - CTO Audit & Final Optimization",
        "env": ENV,
        "db": db_status
    }

# --- VALIDACIÓN QR INSTANTÁNEA (OPTIMIZADO) ---
@app.get("/api/v1/qr/validate/{profile_id}")
@limiter.limit("60/minute") # Límite más alto para escaneos rápidos en puerta
async def validate_qr(request: Request, profile_id: str, user: TokenData = Depends(get_admin_user)):
    """
    Endpoint ultraligero para validación de acceso.
    Solo selecciona columnas necesarias y usa índices primarios.
    """
    try:
        # Seleccionar lo necesario incluyendo campos nuevos de forma segura
        res = supabase.table("profiles")\
            .select("*")\
            .eq("id", profile_id)\
            .execute()
            
        if not res.data:
            raise HTTPException(status_code=404, detail="Socio no encontrado")
            
        socio = res.data[0]
        
        # Lógica rápida de validación
        access_granted = socio['estado'] == 'activo'
        
        return {
            "valid": access_granted,
            "socio": socio,
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        logger.error(f"Error QR Check: {e}")
        raise HTTPException(status_code=400, detail="Error de validación")


# --- 0. USUARIO (PERFIL) ---
@app.get("/api/v1/users/profile")
async def get_my_profile(user: TokenData = Depends(get_current_user)):
    res = supabase.table("profiles").select("*").eq("id", user.uid).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Perfil no encontrado")
    return res.data[0]

# 1. AUTENTICACIÓN
@app.post("/api/v1/auth/token", response_model=Token)
@limiter.limit("10/minute") 
async def login(request: Request, form_data: OAuth2PasswordRequestForm = Depends()):
    username_input = form_data.username.strip()
    email = None
    is_commerce = False

    # 1. DETECCIÓN AUTOMÁTICA (CUIT vs Email/DNI)
    if username_input.isdigit():
        if len(username_input) >= 10: # Probablemente CUIT
            # Buscar por CUIT
            res = supabase.table("profiles").select("email, rol, estado, temp_password").eq("cuit", username_input).execute()
            if not res.data: raise HTTPException(400, "CUIT no encontrado")
            email = res.data[0]["email"]
            is_commerce = True
        else: # Probablemente DNI
            res = supabase.table("profiles").select("email").eq("dni", username_input).execute()
            if not res.data: raise HTTPException(400, "DNI no encontrado")
            email = res.data[0]["email"]
    else:
        email = username_input

    try:
        # Verificar estado y contraseña temporal antes de autenticar en Supabase si es comercio
        user_check = supabase.table("profiles").select("*").eq("email", email).execute()
        if not user_check.data: raise HTTPException(400, "Usuario no encontrado")
        
        profile = user_check.data[0]
        
        # Validar si es comercio y está aprobado
        if profile.get("rol") == "COMERCIO" or profile.get("rol") == "comercial":
            if profile.get("estado") != "activo":
                raise HTTPException(403, "El comercio aún no ha sido aprobado por el administrador.")

        # Intentar login
        auth_res = supabase.auth.sign_in_with_password({"email": email, "password": form_data.password})
        user_id = auth_res.user.id
        
        role = profile.get("rol", "comun")
        camara_id = profile.get("camara_id")

        # Verificar si requiere cambio de contraseña (primer login)
        force_password_change = False
        if profile.get("temp_password") and profile.get("temp_password") == form_data.password:
            force_password_change = True

        access_token = create_access_token(
            data={"sub": email, "role": role, "uid": user_id, "camara_id": camara_id},
            expires_delta=timedelta(days=1)
        )
        
        logger.info(f"Login exitoso: {email} ({role})")
        
        # Retornar info extendida si es necesario forzar cambio
        response_user = {"email": email, "id": user_id}
        if force_password_change:
            response_user["force_password_change"] = True

        return {
            "access_token": access_token, 
            "token_type": "bearer",
            "role": role, 
            "user": response_user, 
            "profile": profile
        }
    except HTTPException:
        raise
    except Exception as e:
        error_msg = str(e)
        logger.warning(f"Intento de login fallido: {email} - {error_msg}")
        if "Email not confirmed" in error_msg:
            raise HTTPException(400, "Debes confirmar tu correo electrónico.")
        raise HTTPException(400, "Usuario o contraseña incorrectos")

@app.post("/api/v1/auth/register")
@limiter.limit("5/minute")
async def register_public(request: Request, socio: SocioCreate):
    logger.info(f"Registro usuario iniciado: {socio.email}")
    try:
        # Sanitizar entrada
        socio.email = socio.email.strip().lower()
        socio.dni = socio.dni.strip()

        # 1. Verificar DNI duplicado en DB antes de ir a Auth
        # (Usamos el cliente admin para bypass RLS de lectura si fuera necesario)
        existing_dni = supabase.table("profiles").select("id").eq("dni", socio.dni).execute()
        if existing_dni.data:
            logger.warning(f"Intento de registro con DNI duplicado: {socio.dni}")
            raise HTTPException(status_code=409, detail="El DNI ya está registrado.")

        # 2. Registro vía Auth (USANDO CLIENTE ANON Y MÉTODO SIGN_UP)
        # Esto evita el error "User not allowed" de la Admin API
        try:
            auth_response = supabase_anon.auth.sign_up({
                "email": socio.email,
                "password": socio.password,
                "options": {
                    "data": {
                        "dni": socio.dni,
                        "nombre": socio.nombre.strip(),
                        "apellido": socio.apellido.strip(),
                        "camara_id": socio.camara_id or 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'
                    }
                }
            })
            
            if not auth_response.user:
                logger.error("Error en signUp: No se recibió objeto usuario")
                raise HTTPException(status_code=400, detail="Error al crear usuario en Supabase Auth")

            user_id = auth_response.user.id
            logger.info(f"Usuario creado en Auth successfully: {user_id}")

            # 3. Creación manual del perfil (Backup si el trigger falla)
            # Usamos el cliente admin para asegurar permisos de escritura en 'profiles'
            # 'estado' inicia en 'pendiente' para flujo de aprobación
            try:
                supabase.table("profiles").upsert({
                    "id": user_id,
                    "email": socio.email,
                    "dni": socio.dni,
                    "nombre": socio.nombre.strip(),
                    "apellido": socio.apellido.strip(),
                    "rol": "comun",
                    "estado": "pendiente",
                    "camara_id": socio.camara_id or 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'
                }).execute()
                logger.info(f"Perfil creado/actualizado para {user_id}")
            except Exception as profile_err:
                logger.warning(f"Fallo creación de perfil manual (posible trigger ya lo hizo): {profile_err}")

            return {"success": True, "message": "Registro completado. Pendiente de aprobación por la administración."}

        except Exception as auth_err:
            error_str = str(auth_err)
            logger.error(f"Error en Supabase Auth: {error_str}")
            
            if "User already registered" in error_str:
                raise HTTPException(status_code=409, detail="El correo electrónico ya está registrado.")
            if "Email signups are disabled" in error_str:
                raise HTTPException(status_code=400, detail="El registro público está deshabilitado.")
            
            raise HTTPException(status_code=400, detail=f"Error en autenticación: {error_str}")

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error inesperado en registro: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Error interno al procesar el registro")

# 2. GESTIÓN DE CÁMARAS 
@app.get("/api/v1/camaras")
async def get_camaras(user: TokenData = Depends(get_current_user)):
    query = supabase.table("camaras").select("*")
    if user.role != "superadmin" and user.camara_id:
        query = query.eq("id", user.camara_id)
    return query.execute().data

# 3. STATS & QUOTA
@app.get("/api/v1/stats/quota", dependencies=[Depends(get_admin_user)])
async def get_quota_stats(user: TokenData = Depends(get_current_user)):
    target_camara_id = user.camara_id
    if not target_camara_id:
        default_cam = supabase.table("camaras").select("id").limit(1).execute()
        if default_cam.data: 
            target_camara_id = default_cam.data[0]['id']
        else:
            return {"used": 0, "limit": 10, "percent": 0}

    cam_res = supabase.table("camaras").select("limite_gratuitos, nombre").eq("id", target_camara_id).execute()
    if not cam_res.data:
        return {"used": 0, "limit": 10, "percent": 0}
        
    limite = cam_res.data[0]['limite_gratuitos']
    cam_nombre = cam_res.data[0]['nombre']

    # Optimizado: Uso de count='exact' sin traer datos, usa índice si existe
    count_res = supabase.table("comercios").select("id", count="exact")\
        .eq("camara_id", target_camara_id)\
        .eq("tipo_plan", "gratuito")\
        .eq("estado", "activo").execute()
    
    used = count_res.count
    percent = int((used / limite) * 100) if limite > 0 else 100

    return {
        "camara_nombre": cam_nombre,
        "used": used,
        "limit": limite,
        "percent": percent,
        "is_full": used >= limite
    }


@app.get("/api/v1/dashboard/stats", dependencies=[Depends(get_admin_user)])
async def get_dashboard_stats(user: TokenData = Depends(get_current_user)):
    """
    Estadísticas consolidadas para el Dashboard Administrativo.
    """
    try:
        # Base queries con filtro por cámara si no es superadmin
        profiles_q = supabase.table("profiles").select("id", count="exact")
        comercios_q = supabase.table("comercios").select("id", count="exact")
        
        if user.role == "admin_camara" and user.camara_id:
            profiles_q = profiles_q.eq("camara_id", user.camara_id)
            comercios_q = comercios_q.eq("camara_id", user.camara_id)
            
        # 1. Socios Activos
        activos = profiles_q.eq("rol", "comun").eq("estado", "activo").execute().count or 0
        
        # 2. Socios Pendientes
        pendientes = profiles_q.eq("rol", "comun").eq("estado", "pendiente").execute().count or 0
        
        # 3. Comercios Adheridos
        comercios = comercios_q.eq("estado", "activo").execute().count or 0
        
        # 4. Recaudación (Placeholder logic - Suma mensual de cuotas pagadas)
        # En prod esto debería filtrar por mes actual
        recaudacion = 0
        try:
            pago_res = supabase.table("cuotas").select("monto").eq("pagado", True).execute()
            recaudacion = sum(float(p['monto']) for p in pago_res.data) if pago_res.data else 0
        except: pass

        return {
            "sociosActivos": activos,
            "sociosPendientes": pendientes,
            "recaudacionMensual": recaudacion,
            "comerciosAdheridos": comercios
        }
    except Exception as e:
        logger.error(f"Error generating dashboard stats: {e}")
        return {
            "sociosActivos": 0,
            "sociosPendientes": 0,
            "recaudacionMensual": 0,
            "comerciosAdheridos": 0
        }


# 4. COMERCIOS (ADMIN & PUBLIC)

@app.get("/api/v1/comercios")
async def get_comercios(
    user: TokenData = Depends(get_current_user),
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0)
):
    try:
        query = supabase.table("comercios").select("*, municipios(nombre), camaras(nombre)")
        if user.role == "admin_camara" and user.camara_id:
            query = query.eq("camara_id", user.camara_id)
        
        query = query.range(offset, offset + limit - 1)
        res = query.execute()
        return res.data or []
    except Exception as e:
        logger.error(f"Error fetching comercios: {e}")
        return []

@app.post("/api/v1/admin/comercios", dependencies=[Depends(get_admin_user)])
async def admin_create_comercio(comercio: ComercioCreate, user: TokenData = Depends(get_admin_user)):
    """
    SuperAdmin crea comercio:
    1. Crea usuario en Auth con temp_password
    2. Crea perfil con rol COMERCIO y estado PENDIENTE
    3. Crea entrada en tabla comercios
    """
    try:
        # Generar un email ficticio basado en CUIT si no se provee, 
        # o usar uno genérico para cumplir con Supabase Auth
        email = f"comercio_{comercio.cuit}@sociedad-rural.com"
        
        # 1. Crear en Auth
        try:
            auth_res = supabase.auth.admin.create_user({
                "email": email,
                "password": comercio.temp_password,
                "user_metadata": {
                    "nombre": comercio.nombre,
                    "cuit": comercio.cuit,
                    "rol": "COMERCIO"
                },
                "email_confirm": True
            })
            
            if not auth_res.user:
                logger.error(f"Supabase Auth Error: {auth_res}")
                raise HTTPException(status_code=400, detail="Error de Supabase Auth: No se pudo crear el usuario")
            
            new_user_id = auth_res.user.id
        except Exception as auth_err:
            logger.error(f"Excepción en Supabase Auth: {auth_err}")
            if "User not allowed" in str(auth_err):
                detail = "Error de Permisos: La SERVICE_KEY no tiene permisos suficientes para crear usuarios o el email ya existe."
            else:
                detail = f"Error al crear usuario en Auth: {str(auth_err)}"
            raise HTTPException(status_code=400, detail=detail)
        
        # 2. Crear Perfil
        profile_data = {
            "id": new_user_id,
            "email": email,
            "dni": comercio.cuit, # El CUIT actúa como DNI para perfiles comerciales
            "nombre": comercio.nombre,
            "cuit": comercio.cuit,
            "rol": "COMERCIO",
            "estado": "pendiente",
            "temp_password": comercio.temp_password,
            "camara_id": comercio.camara_id or user.camara_id
        }
        supabase.table("profiles").upsert(profile_data).execute()
        
        # 3. Crear Comercio
        comercio_db_data = {
            "user_id": new_user_id,
            "nombre": comercio.nombre,
            "categoria": comercio.categoria,
            "barrio": comercio.barrio,
            "provincia": comercio.provincia,
            "ubicacion": comercio.ubicacion,
            "descripcion": comercio.descripcion,
            "logo_url": comercio.logo_url,
            "direccion": comercio.direccion,
            "telefono": comercio.telefono,
            "email": comercio.email,
            "rubro": comercio.categoria, # Rubro inicial mapeado a categoría
            "cuit": comercio.cuit,
            "municipio_id": comercio.municipio_id,
            "camara_id": comercio.camara_id or user.camara_id,
            "estado": "pendiente"
        }
        res = supabase.table("comercios").insert(comercio_db_data).execute()
        if res.data:
            supabase.table("profiles").update({"comercio_id": res.data[0]['id']}).eq("id", new_user_id).execute()
            
        return {"success": True, "comercio": res.data[0] if res.data else None, "user_id": new_user_id}
        
    except Exception as e:
        logger.error(f"Error admin creating commerce: {e}")
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/v1/admin/comercios/{id}/approve", dependencies=[Depends(get_admin_user)])
async def approve_comercio(id: str):
    """Aprueba un comercio (tanto en perfiles como en tabla comercios)"""
    try:
        # 1. Obtener el comercio para saber el user_id
        com_res = supabase.table("comercios").select("user_id, nombre").eq("id", id).execute()
        if not com_res.data: 
            raise HTTPException(404, "Comercio no encontrado")
        
        user_id = com_res.data[0]["user_id"]
        nombre_com = com_res.data[0]["nombre"]
        
        # 2. Activar perfil y comercio de forma secuencial con verificación
        p_res = supabase.table("profiles").update({"estado": "activo"}).eq("id", user_id).execute()
        c_res = supabase.table("comercios").update({"estado": "activo"}).eq("id", id).execute()
        
        if not p_res.data or not c_res.data:
            logger.error(f"Fallo de actualización en DB: Profile={bool(p_res.data)}, Comercio={bool(c_res.data)}")
            raise HTTPException(400, "No se pudo actualizar el estado en la base de datos")
        
        logger.info(f"✅ Comercio '{nombre_com}' ({id}) aprobado exitosamente.")
        return {"success": True, "message": f"Comercio '{nombre_com}' aprobado y activado correctamente"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error approving commerce {id}: {e}")
        raise HTTPException(400, detail=str(e))

@app.post("/api/v1/admin/camaras", dependencies=[Depends(get_admin_user)])
async def create_camara(camara_data: dict):
    res = supabase.table("camaras").insert(camara_data).execute()
    return res.data[0]

@app.post("/api/v1/admin/camaras/{id}/asignar-comercios", dependencies=[Depends(get_admin_user)])
async def asignar_comercios_camara(id: str, payload: dict):
    """Asigna una lista de comercios a una cámara (Máximo 10)"""
    comercios_ids = payload.get("comercios_ids", [])
    
    if len(comercios_ids) > 10:
        raise HTTPException(400, "Una cámara solo puede gestionar hasta 10 comercios asignados.")
    
    try:
        # Limpiar asignaciones previas si es necesario o manejar incrementalmente
        # Aquí optamos por reemplazar la lista de asignados para esa cámara
        # 1. Borrar actuales
        supabase.table("camara_comercios").delete().eq("camara_id", id).execute()
        
        # 2. Insertar nuevos
        if comercios_ids:
            inserts = [{"camara_id": id, "comercio_id": c_id} for c_id in comercios_ids]
            supabase.table("camara_comercios").insert(inserts).execute()
            
        return {"success": True, "count": len(comercios_ids)}
    except Exception as e:
        logger.error(f"Error assigning comercios to camera: {e}")
        raise HTTPException(400, detail=str(e))

@app.put("/api/v1/comercios/{id}", dependencies=[Depends(get_admin_user)])
async def update_comercio(id: str, comercio: ComercioUpdate, user: TokenData = Depends(get_current_user)):
    # Verificar pertenencia si es admin_camara
    if user.role == "admin_camara":
        check = supabase.table("comercios").select("id").eq("id", id).eq("camara_id", user.camara_id).execute()
        if not check.data: raise HTTPException(403, "No tiene permiso sobre este comercio")
    
    try:
        payload = comercio.model_dump(exclude_unset=True)
        res = supabase.table("comercios").update(payload).eq("id", id).execute()
        
        # Sincronizar nombre en profiles si cambia en comercios
        if "nombre" in payload:
            com_res = supabase.table("comercios").select("user_id").eq("id", id).execute()
            if com_res.data:
                supabase.table("profiles").update({"nombre": payload["nombre"]}).eq("id", com_res.data[0]["user_id"]).execute()

        if not res.data: raise HTTPException(404, "Comercio no encontrado")
        return res.data[0]
    except Exception as e:
        logger.error(f"Error DB Update Comercio: {e}")
        raise HTTPException(status_code=400, detail="Error al actualizar comercio")

@app.delete("/api/v1/comercios/{id}", dependencies=[Depends(get_admin_user)])

async def delete_comercio(id: str, user: TokenData = Depends(get_current_user)):
    if user.role == "admin_camara":
        check = supabase.table("comercios").select("id").eq("id", id).eq("camara_id", user.camara_id).execute()
        if not check.data: raise HTTPException(403, "No tiene permiso sobre este comercio")
    
    supabase.table("comercios").delete().eq("id", id).execute()
    return {"message": "Comercio eliminado"}

# 5. SOCIOS (PAGINADO)
@app.get("/api/v1/socios", dependencies=[Depends(get_admin_user)])
async def get_socios(
    user: TokenData = Depends(get_current_user),
    limit: int = Query(50, ge=1, le=1000),
    offset: int = Query(0, ge=0)
):
    try:
        query = supabase.table("profiles").select("*").order("apellido")
        if user.role == "admin_camara" and user.camara_id:
            query = query.eq("camara_id", user.camara_id)
        
        # Paginación
        query = query.range(offset, offset + limit - 1)
        
        res = query.execute()
        return res.data or []
    except Exception as e:
        logger.error(f"Error fetching socios: {e}")
        return []

@app.post("/api/v1/socios", dependencies=[Depends(get_admin_user)])
async def create_socio(socio: SocioCreate, user: TokenData = Depends(get_admin_user)):
    logger.info(f"Admin {user.username} creando socio: {socio.email}")
    try:
        # Sanitizar
        socio.email = socio.email.strip().lower()
        
        # 1. Registro vía Auth (USANDO SIGN_UP para evitar errores de Admin API en prod)
        try:
            auth_res = supabase_anon.auth.sign_up({
                "email": socio.email,
                "password": socio.password,
                "options": {
                    "data": {
                        "dni": socio.dni,
                        "nombre": socio.nombre.strip(),
                        "apellido": socio.apellido.strip(),
                        "camara_id": socio.camara_id or user.camara_id
                    }
                }
            })
            
            if not auth_res.user:
                raise Exception("No se pudo crear el usuario en Auth")
            
            new_user_id = auth_res.user.id
            logger.info(f"Socio creado en Auth: {new_user_id}")

            # 2. Actualizar perfil con datos adicionales y estado ACTIVO (ya que es creado por admin)
            # Usamos el cliente privilegiado 'supabase'
            update_data = {
                "id": new_user_id,
                "email": socio.email,
                "nombre": socio.nombre.strip(),
                "apellido": socio.apellido.strip(),
                "dni": socio.dni.strip(),
                "rol": socio.rol,
                "estado": "activo",
                "camara_id": socio.camara_id or user.camara_id
            }
            
            supabase.table("profiles").upsert(update_data).execute()
            logger.info(f"Perfil de socio {new_user_id} activado por admin")

            return {"success": True, "message": "Socio creado y activado correctamente", "id": new_user_id}

        except Exception as auth_err:
            error_str = str(auth_err)
            logger.error(f"Error Auth en create_socio: {error_str}")
            if "User already registered" in error_str:
                raise HTTPException(409, "El usuario ya existe")
            raise HTTPException(400, f"Error de autenticación: {error_str}")

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error crítico en create_socio: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Error interno del servidor")

@app.post("/api/v1/socios/{socio_id}/aprobar", dependencies=[Depends(get_admin_user)])
async def aprobar_socio(socio_id: str):
    supabase.table("profiles").update({"estado": "activo"}).eq("id", socio_id).execute()
    return {"message": "Socio aprobado"}

@app.put("/api/v1/socios/{socio_id}", dependencies=[Depends(get_admin_user)])
async def update_socio(socio_id: str, data: SocioUpdate, user: TokenData = Depends(get_admin_user)):
    # Protección: admin_camara solo puede editar socios de su propia cámara
    if user.role == "admin_camara":
        check = supabase.table("profiles").select("camara_id").eq("id", socio_id).execute()
        if not check.data or check.data[0]["camara_id"] != user.camara_id:
            raise HTTPException(status_code=403, detail="No tiene permisos sobre este socio.")

    try:
        payload = data.model_dump(exclude_unset=True)
        res = supabase.table("profiles").update(payload).eq("id", socio_id).execute()
        
        if not res.data:
            raise HTTPException(status_code=404, detail="Socio no encontrado")
            
        return res.data[0]
    except Exception as e:
        logger.error(f"Error actualizando socio {socio_id}: {e}")
        raise HTTPException(status_code=400, detail="Error al actualizar datos del socio")

@app.get("/api/v1/beneficios", dependencies=[Depends(get_current_user)])
async def get_beneficios_premium(
    categoria: Optional[str] = Query(None),
    sort: str = Query("recientes"), # recientes, descuento, vencimiento
    limit: int = Query(20),
    offset: int = Query(0)
):
    """
    Endpoint Premium unificado para obtener beneficios (promociones)
    con filtrado avanzado y ordenamiento.
    """
    try:
        query = supabase.table("promociones").select("*, comercios(*)")
        
        # Filtro de estado activo siempre
        query = query.eq("estado", "activo")
        
        # Filtro de fecha de fin (solo vigentes)
        today = datetime.now().strftime("%Y-%m-%d")
        query = query.gte("fecha_fin", today)
        
        # Ejecutar base para poder filtrar por categoría del comercio unido
        res = query.execute()
        beneficios = res.data or []
        
        # 1. Filtrado por categoría (Rubro del comercio)
        if categoria and categoria.lower() != "todos":
            beneficios = [b for b in beneficios if b.get("comercios", {}).get("rubro", "").lower() == categoria.lower()]
            
        # 2. Mapeo plano para el frontend
        for b in beneficios:
            comercio = b.get("comercios") or {}
            b["comercio_nombre"] = comercio.get("nombre", "Comercio")
            b["comercio_logo"] = comercio.get("logo_url", "")
            b["categoria"] = comercio.get("rubro", "General")
            
        # 3. Ordenamiento
        if sort == "recientes":
            beneficios.sort(key=lambda x: x.get("fecha_inicio", "") or "", reverse=True)
        elif sort == "descuento":
            beneficios.sort(key=lambda x: x.get("porcentaje_descuento", 0) or 0, reverse=True)
        elif sort == "vencimiento":
            beneficios.sort(key=lambda x: x.get("fecha_fin", "") or "")
            
        # 4. Paginación manual tras ordenamiento/filtrado
        end_idx = offset + limit
        paginated = beneficios[offset : end_idx]
        
        return paginated
    except Exception as e:
        logger.error(f"Error in benefits premium endpoint: {e}")
        raise HTTPException(500, f"Error al procesar beneficios: {str(e)}")

# --- 5.1 PROMOCIONES ---
@app.get("/api/v1/promociones", dependencies=[Depends(get_current_user)])
async def get_promociones(limit: int = 100, offset: int = 0):
    try:
        # Safe Get: Sin filtro de estado por si la columna no existe aún
        res = supabase.table("promociones")\
            .select("*, comercios(nombre)")\
            .range(offset, offset + limit - 1)\
            .execute()
        
        # Formatear para el frontend
        flat_data = []
        for p in (res.data or []):
            comercio = p.get('comercios')
            p['comercio_nombre'] = comercio.get('nombre') if comercio else "Comercio Desconocido"
            flat_data.append(p)
        return flat_data
    except Exception as e:
        logger.error(f"Error fetching promociones: {e}")
        return []

@app.post("/api/v1/promociones", dependencies=[Depends(get_admin_user)])
async def create_promocion(promo: PromocionCreate):
    res = supabase.table("promociones").insert(promo.model_dump()).execute()
    return res.data[0]

@app.put("/api/v1/promociones/{id}", dependencies=[Depends(get_admin_user)])
async def update_promocion(id: str, promo: PromocionUpdate):
    res = supabase.table("promociones").update(promo.model_dump(exclude_unset=True)).eq("id", id).execute()
    return res.data[0]

@app.delete("/api/v1/promociones/{id}", dependencies=[Depends(get_admin_user)])
async def delete_promocion(id: str):
    supabase.table("promociones").delete().eq("id", id).execute()
    return {"message": "Promoción eliminada"}

# --- 5.2 EVENTOS ---
@app.get("/api/v1/eventos", dependencies=[Depends(get_current_user)])
async def get_eventos(limit: int = 100, offset: int = 0):
    try:
        # Safe Get: Sin filtro de estado por si la columna no existe aún
        res = supabase.table("eventos")\
            .select("*")\
            .order("fecha", desc=True)\
            .range(offset, offset + limit - 1)\
            .execute()
        return res.data or []
    except Exception as e:
        logger.error(f"Error fetching eventos: {e}")
        return []

@app.post("/api/v1/eventos", dependencies=[Depends(get_admin_user)])
async def create_evento(evento: EventoCreate):
    res = supabase.table("eventos").insert(evento.model_dump()).execute()
    return res.data[0]

@app.put("/api/v1/eventos/{id}", dependencies=[Depends(get_admin_user)])
async def update_evento(id: str, evento: EventoUpdate):
    res = supabase.table("eventos").update(evento.model_dump(exclude_unset=True)).eq("id", id).execute()
    return res.data[0]

@app.delete("/api/v1/eventos/{id}", dependencies=[Depends(get_admin_user)])
async def delete_evento(id: str):
    supabase.table("eventos").delete().eq("id", id).execute()
    return {"message": "Evento eliminado"}

# --- 5.3 GESTIÓN DE COMERCIO (PARA DUEÑOS) ---

@app.get("/api/v1/my-promotions")
async def get_my_promotions(user: TokenData = Depends(get_current_user)):
    try:
        # Obtener el comercio_id del perfil del usuario
        prof_res = supabase.table("profiles").select("comercio_id").eq("id", user.uid).execute()
        if not prof_res.data or not prof_res.data[0].get('comercio_id'):
            raise HTTPException(403, "El usuario no tiene un comercio asociado")
        
        comercio_id = prof_res.data[0]['comercio_id']
        res = supabase.table("promociones").select("*").eq("comercio_id", comercio_id).execute()
        return res.data or []
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching my promotions: {e}")
        return []

@app.get("/api/v1/my-stats")
async def get_my_stats(user: TokenData = Depends(get_current_user)):
    prof_res = supabase.table("profiles").select("comercio_id").eq("id", user.uid).execute()
    if not prof_res.data or not prof_res.data[0]['comercio_id']:
        raise HTTPException(403, "El usuario no tiene un comercio asociado")
    
    comercio_id = prof_res.data[0]['comercio_id']
    # Aquí se podrían agregar estadísticas reales, por ahora devolvemos datos placeholder logic
    return {
        "visualizaciones": 1250,
        "clics": 450,
        "cupones_canjeados": 85
    }

@app.post("/api/v1/validate-coupon")
async def validate_coupon(coupon_data: dict, user: TokenData = Depends(get_current_user)):
    # Lógica de validación de cupón
    # Por ahora aceptamos cualquier cupón para el demo
    return {"valid": True, "message": "Cupón validado correctamente"}

# --- 5.4 USUARIO Y GEOLOCALIZACIÓN ---

@app.post("/api/v1/user/location-update")
async def update_location(location_data: dict, user: TokenData = Depends(get_current_user)):
    try:
        supabase.table("profiles").update({
            "last_location": location_data
        }).eq("id", user.uid).execute()
        return {"success": True}
    except Exception as e:
        logger.error(f"Error updating location: {e}")
        raise HTTPException(500, "Error al actualizar ubicación")

@app.post("/api/v1/user/test-notification")
async def test_notification(data: dict, user: TokenData = Depends(get_current_user)):
    # Obtener token FCM del perfil si no viene en el body
    fcm_token = data.get("fcm_token")
    if not fcm_token:
        prof = supabase.table("profiles").select("fcm_token").eq("id", user.uid).execute()
        if prof.data:
            fcm_token = prof.data[0].get("fcm_token")
    
    if not fcm_token:
        raise HTTPException(400, "No se encontró un token FCM para este usuario")
    
    success = await send_push_notification(
        token=fcm_token,
        title="Prueba de Notificación",
        body="Si recibes esto, Firebase está funcionando correctamente."
    )
    return {"success": success}

@app.post("/api/v1/user/fcm-token")
@app.post("/users/firebase-token") # Alias solicitado en el SPEC
async def update_fcm_token(payload: dict, user: TokenData = Depends(get_current_user)):
    token = payload.get("token") or payload.get("firebase_token")
    if not token: raise HTTPException(400, "Token requerido")
    supabase.table("profiles").update({"firebase_token": token}).eq("id", user.uid).execute()
    return {"status": "ok", "token": token}

@app.post("/api/v1/user/change-password")
@limiter.limit("10/hour")
async def change_password(data: PasswordChange, request: Request, user: TokenData = Depends(get_current_user)):
    # 1. Validar contraseña actual (re-autenticando)
    logger.info(f"Intento de cambio de clave para: {user.username}")
    try:
        # Intentamos re-autenticar al usuario para confirmar que conoce la clave actual
        auth_res = supabase_anon.auth.sign_in_with_password({
            "email": user.username,
            "password": data.current_password
        })
        if not auth_res.user:
            raise Exception("No se pudo validar la identidad")
    except Exception as e:
        logger.warning(f"Fallo re-autenticación en cambio de clave: {user.username} - {str(e)}")
        raise HTTPException(401, "La contraseña actual es incorrecta o la sesión ha expirado")

    # 2. Actualizar a la nueva contraseña usando Admin API (para mayor fiabilidad)
    try:
        # Usamos el admin client para bypass de cualquier restricción de sesión en el cambio forzado
        supabase.auth.admin.update_user_by_id(
            user.uid,
            attributes={"password": data.new_password}
        )
        
        # Opcional: Si el usuario tenía temp_password, borrarlo del perfil para marcar que ya cambió clave
        supabase.table("profiles").update({"temp_password": None}).eq("id", user.uid).execute()
        
        logger.info(f"Contraseña actualizada exitosamente para: {user.username} ({user.uid})")
        return {"message": "¡Contraseña actualizada con éxito!"}
    except Exception as e:
        logger.error(f"Error fatal actualizando contraseña para {user.uid}: {e}")
        raise HTTPException(400, f"No se pudo establecer la nueva contraseña: {str(e)}")

# --- 6. AUTOGESTIÓN COMERCIAL ---

@app.get("/api/v1/my-commerce")
async def get_my_commerce(user: TokenData = Depends(get_current_user)):
    # Obtener comercio_id del perfil del usuario
    prof = supabase.table("profiles").select("comercio_id").eq("id", user.uid).execute()
    if not prof.data or not prof.data[0].get("comercio_id"):
        raise HTTPException(404, "Este usuario no tiene un comercio vinculado")
    
    comercio_id = prof.data[0]["comercio_id"]
    res = supabase.table("comercios").select("*, municipios(nombre), camaras(nombre)").eq("id", comercio_id).execute()
    if not res.data:
        raise HTTPException(404, "Comercio no encontrado")
    return res.data[0]

@app.patch("/api/v1/my-commerce")
async def update_my_commerce(comercio_data: dict, user: TokenData = Depends(get_current_user)):
    prof = supabase.table("profiles").select("comercio_id").eq("id", user.uid).execute()
    comercio_id = prof.data[0].get("comercio_id")
    if not comercio_id:
        raise HTTPException(403, "No tiene un comercio vinculado")
    
    # Solo permitir editar ciertos campos
    allowed_fields = ["nombre", "direccion", "telefono", "email", "descuento_base", "rubro"]
    payload = {k: v for k, v in comercio_data.items() if k in allowed_fields}
    
    try:
        res = supabase.table("comercios").update(payload).eq("id", comercio_id).execute()
        return res.data[0]
    except Exception as e:
        logger.error(f"Error self-updating commerce: {e}")
        raise HTTPException(400, "Error al actualizar los datos de su comercio")

@app.get("/api/v1/my-commerce/promos")
async def get_my_promos(user: TokenData = Depends(get_current_user)):
    prof = supabase.table("profiles").select("comercio_id").eq("id", user.uid).execute()
    comercio_id = prof.data[0].get("comercio_id")
    if not comercio_id: return []
    
    res = supabase.table("promociones").select("*").eq("comercio_id", comercio_id).execute()
    return res.data or []

@app.post("/api/v1/my-commerce/promos")
async def create_my_promo(promo: PromocionCreate, user: TokenData = Depends(get_current_user)):
    prof = supabase.table("profiles").select("comercio_id").eq("id", user.uid).execute()
    comercio_id = prof.data[0].get("comercio_id")
    if not comercio_id:
        raise HTTPException(403, "No tiene un comercio vinculado")
    
    # Usar dict() para compatibilidad con Pydantic v1/v2
    payload = promo.dict() if hasattr(promo, 'dict') else promo.model_dump()
    payload["comercio_id"] = comercio_id
    
    try:
        res = supabase.table("promociones").insert(payload).execute()
        if not res.data:
            # Si no hay data, puede ser un error de RLS o constraint
            logger.error(f"No data returned on promo insert. Error?: {getattr(res, 'error', 'Unknown')}")
            raise Exception("No se recibió confirmación de la base de datos")
            
        return res.data[0]
    except Exception as e:
        logger.error(f"Error creating commerce promo for commerce {comercio_id}: {e}")
        # Intentar obtener un mensaje más descriptivo si es posible
        detail = str(e) if "403" not in str(e) else "No tiene permisos para crear promociones en este comercio"
        raise HTTPException(400, f"Error al crear la promoción: {detail}")

@app.delete("/api/v1/my-commerce/promos/{promo_id}")
async def delete_my_promo(promo_id: str, user: TokenData = Depends(get_current_user)):
    prof = supabase.table("profiles").select("comercio_id").eq("id", user.uid).execute()
    comercio_id = prof.data[0].get("comercio_id")
    if not comercio_id:
        raise HTTPException(403, "No tiene permiso")
    
    # Verificar que la promo sea suya
    check = supabase.table("promociones").select("id").eq("id", promo_id).eq("comercio_id", comercio_id).execute()
    if not check.data:
        raise HTTPException(404, "Promoción no encontrada o no pertenece a su comercio")
    
    supabase.table("promociones").delete().eq("id", promo_id).execute()
    return {"success": True}

@app.get("/api/v1/my-commerce/validate-member/{dni_or_id}")
async def validate_member_for_commerce(dni_or_id: str, user: TokenData = Depends(get_current_user)):
    # Verificar que el usuario sea comercial
    if user.role not in ["comercial", "admin", "superadmin", "admin_camara"]:
        raise HTTPException(403, "No tiene permiso para validar socios")
    
    query = supabase.table("profiles").select("*")
    if dni_or_id.isdigit():
        query = query.eq("dni", dni_or_id)
    else:
        query = query.eq("id", dni_or_id)
    
    res = query.execute()
    if not res.data:
        raise HTTPException(404, "Socio no encontrado")
        
    socio = res.data[0]
    return {
        "is_active": socio.get("estado") == "activo",
        "is_moroso": socio.get("is_moroso", False),
        "nombre": f"{socio.get('nombre')} {socio.get('apellido')}",
        "dni": socio.get("dni")
    }

# --- 7. PAGOS MERCADO PAGO ---


@app.post("/api/v1/payments/preference")
async def create_payment_preference(payment_data: PaymentPreferenceRequest, user: TokenData = Depends(get_current_user)):
    try:
        now = datetime.now()
        cuota_data = {
            "profile_id": user.uid,
            "monto": payment_data.unit_price,
            "mes": now.month,
            "anio": now.year,
            "pagado": False,
            "fecha_vencimiento": (now + timedelta(days=10)).strftime("%Y-%m-%d")
        }
        
        cuota_res = supabase.table("cuotas").insert(cuota_data).execute()
        cuota_id = cuota_res.data[0]['id']

        notification_url = f"{API_PUBLIC_URL}/api/v1/payments/webhook"
        
        preference_data = {
            "items": [
                {
                    "title": payment_data.title,
                    "quantity": payment_data.quantity,
                    "unit_price": payment_data.unit_price,
                    "currency_id": "ARS"
                }
            ],
            "payer": {
                "email": user.username 
            },
            "external_reference": cuota_id, 
            "notification_url": notification_url, 
            "auto_return": "approved",
            "back_urls": {
                "success": f"{API_PUBLIC_URL}/#/portal?status=success",
                "failure": f"{API_PUBLIC_URL}/#/portal?status=failure",
                "pending": f"{API_PUBLIC_URL}/#/portal?status=pending"
            }
        }

        preference_response = mp_sdk.preference().create(preference_data)
        preference = preference_response["response"]
        
        supabase.table("cuotas").update({"mp_preference_id": preference['id']}).eq("id", cuota_id).execute()
        
        return {"init_point": preference["init_point"], "sandbox_init_point": preference["sandbox_init_point"], "preference_id": preference['id']}

    except Exception as e:
        logger.error(f"Error creando preferencia: {e}")
        raise HTTPException(status_code=500, detail="Error al generar link de pago")


@app.post("/api/v1/payments/webhook")
async def payment_webhook(request: Request):
    try:
        query_params = dict(request.query_params)
        topic = query_params.get("topic") or query_params.get("type")
        payment_id = query_params.get("id") or query_params.get("data.id")

        if not payment_id and topic == "payment":
             body = await request.json()
             payment_id = body.get("data", {}).get("id")

        if topic == "payment" and payment_id:
            logger.info(f"Webhook recibido. Payment ID: {payment_id}")
            
            payment_info = mp_sdk.payment().get(payment_id)
            payment_data = payment_info["response"]
            
            status = payment_data.get("status")
            external_ref = payment_data.get("external_reference") 

            logger.info(f"Estado pago {payment_id}: {status} (Ref: {external_ref})")

            if status == "approved" and external_ref:
                update_data = {
                    "pagado": True,
                    "fecha_pago": datetime.now().isoformat(),
                    "mp_preference_id": payment_id 
                }
                
                logger.info(f"✅ Pago aprobado: {payment_id} para cuota {external_ref}")
                supabase.table("cuotas").update(update_data).eq("id", external_ref).execute()
        
        return JSONResponse(content={"status": "received"}, status_code=200)

    except Exception as e:
        logger.error(f"Error procesando webhook: {e}")
        return JSONResponse(content={"status": "error_logged"}, status_code=200)

# Entry point local
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
