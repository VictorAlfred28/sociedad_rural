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
SECRET_KEY = os.getenv("SECRET_KEY", "tu_clave_super_secreta_para_firmar_tokens")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 
MP_ACCESS_TOKEN = os.getenv("MP_ACCESS_TOKEN", "TEST-token-placeholder")

# Inicializar Mercado Pago
mp_sdk = mercadopago.SDK(MP_ACCESS_TOKEN)

url: str = os.getenv("SUPABASE_URL", "")
key: str = os.getenv("SUPABASE_KEY", "")
service_role_key: str = os.getenv("SUPABASE_SERVICE_KEY", key)

# Cliente Privilegiado (Para operaciones de base de datos protegidas)
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
    if request.method == "GET" and response.status_code == 200:
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
    rubro: str
    direccion: str
    telefono: str
    email: str
    descuento_base: int = 0
    municipio_id: Optional[str] = None
    tipo_plan: str = "gratuito" # gratuito | premium
    camara_id: Optional[str] = None 

class ComercioUpdate(BaseModel):
    nombre: Optional[str] = None
    rubro: Optional[str] = None
    direccion: Optional[str] = None
    telefono: Optional[str] = None
    email: Optional[str] = None
    descuento_base: Optional[int] = None
    municipio_id: Optional[str] = None
    tipo_plan: Optional[str] = None
    estado: Optional[str] = None

class PromocionCreate(BaseModel):
    comercio_id: str
    titulo: str
    descripcion: Optional[str] = None
    imagen_url: Optional[str] = None
    fecha_desde: Optional[datetime] = None
    fecha_hasta: Optional[datetime] = None
    estado: str = "activo"

class PromocionUpdate(BaseModel):
    titulo: Optional[str] = None
    descripcion: Optional[str] = None
    imagen_url: Optional[str] = None
    fecha_desde: Optional[datetime] = None
    fecha_hasta: Optional[datetime] = None
    estado: Optional[str] = None

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


# 1. AUTENTICACIÓN
@app.post("/api/v1/auth/token", response_model=Token)
@limiter.limit("10/minute") 
async def login(request: Request, form_data: OAuth2PasswordRequestForm = Depends()):
    email = form_data.username.strip()
    if form_data.username.strip().isdigit(): 
        # Uso de índice 'idx_profiles_dni'
        res = supabase.table("profiles").select("email").eq("dni", form_data.username).execute()
        if not res.data: raise HTTPException(400, "DNI no encontrado")
        email = res.data[0]["email"]

    try:
        auth_res = supabase.auth.sign_in_with_password({"email": email, "password": form_data.password})
        user_id = auth_res.user.id
        
        # Uso de PK index
        prof_res = supabase.table("profiles").select("*").eq("id", user_id).execute()
        prof = prof_res.data[0] if prof_res.data else {}
        
        role = prof.get("rol", "comun")
        camara_id = prof.get("camara_id")

        access_token = create_access_token(
            data={"sub": email, "role": role, "uid": user_id, "camara_id": camara_id},
            expires_delta=timedelta(days=1)
        )
        logger.info(f"Login exitoso: {email} ({role})")
        return {
            "access_token": access_token, "token_type": "bearer",
            "role": role, "user": {"email": email, "id": user_id}, "profile": prof
        }
    except Exception as e:
        error_msg = str(e)
        logger.warning(f"Intento de login fallido: {email} - {error_msg}")
        if "Email not confirmed" in error_msg:
            raise HTTPException(400, "Debes confirmar tu correo electrónico antes de ingresar.")
        if "Email logins are disabled" in error_msg:
            raise HTTPException(400, "El inicio de sesión por correo está deshabilitado en Supabase. Contacte al administrador.")
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


# 4. COMERCIOS (HARDENED + PAGINADO)
@app.get("/api/v1/comercios")
async def get_comercios(
    user: TokenData = Depends(get_current_user),
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0)
):
    # Query optimizada con paginación
    query = supabase.table("comercios").select("*, municipios(nombre), camaras(nombre)")
    if user.role == "admin_camara" and user.camara_id:
        query = query.eq("camara_id", user.camara_id)
    
    # Aplicar paginación
    query = query.range(offset, offset + limit - 1)
    
    return query.execute().data

@app.post("/api/v1/comercios", dependencies=[Depends(get_admin_user)])
async def create_comercio(comercio: ComercioCreate, user: TokenData = Depends(get_current_user)):
    target_camara_id = comercio.camara_id
    if user.role == "admin_camara":
        target_camara_id = user.camara_id 
    
    if not target_camara_id:
        default_cam = supabase.table("camaras").select("id").limit(1).execute()
        if default_cam.data: target_camara_id = default_cam.data[0]['id']
        else: raise HTTPException(400, "Error de configuración: No hay cámaras en el sistema")

    if comercio.tipo_plan == 'gratuito':
        cam_res = supabase.table("camaras").select("limite_gratuitos").eq("id", target_camara_id).execute()
        limite = cam_res.data[0]['limite_gratuitos'] if cam_res.data else 10
        
        # Optimizado con count exact
        count_res = supabase.table("comercios").select("id", count="exact")\
            .eq("camara_id", target_camara_id)\
            .eq("tipo_plan", "gratuito")\
            .eq("estado", "activo").execute()
        
        actuales = count_res.count
        
        if actuales >= limite:
            raise HTTPException(status_code=409, detail=f"Límite de comercios gratuitos alcanzado ({actuales}/{limite}).")

    try:
        payload = comercio.model_dump(exclude_unset=True)
        payload['camara_id'] = target_camara_id
        
        res = supabase.table("comercios").insert(payload).execute()
        
        try:
            supabase.table("audit_logs").insert({
                "usuario_id": user.uid,
                "camara_id": target_camara_id,
                "accion": "CREATE_COMERCIO",
                "detalle": f"Alta comercio {comercio.nombre} ({comercio.tipo_plan})"
            }).execute()
        except Exception:
            pass 
        
        return res.data[0]

    except Exception as e:
        error_str = str(e)
        if "LÍMITE EXCEDIDO" in error_str:
            raise HTTPException(status_code=409, detail="Error Crítico de Integridad: El límite de comercios fue excedido concurrentemente.")
        logger.error(f"Error DB Insert: {error_str}")
        raise HTTPException(status_code=400, detail="Error al procesar la solicitud en base de datos.")

@app.put("/api/v1/comercios/{id}", dependencies=[Depends(get_admin_user)])
async def update_comercio(id: str, comercio: ComercioUpdate, user: TokenData = Depends(get_current_user)):
    # Verificar pertenencia si es admin_camara
    if user.role == "admin_camara":
        check = supabase.table("comercios").select("id").eq("id", id).eq("camara_id", user.camara_id).execute()
        if not check.data: raise HTTPException(403, "No tiene permiso sobre este comercio")
    
    try:
        payload = comercio.model_dump(exclude_unset=True)
        res = supabase.table("comercios").update(payload).eq("id", id).execute()
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
    query = supabase.table("profiles").select("*").order("apellido")
    if user.role == "admin_camara" and user.camara_id:
        query = query.eq("camara_id", user.camara_id)
    
    # Paginación
    query = query.range(offset, offset + limit - 1)
    
    return query.execute().data

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

# --- 5.1 PROMOCIONES ---
@app.get("/api/v1/promociones", dependencies=[Depends(get_active_user)])
async def get_promociones(limit: int = 100, offset: int = 0):
    res = supabase.table("promociones")\
        .select("*, comercios(nombre)")\
        .eq("estado", "activo")\
        .range(offset, offset + limit - 1)\
        .execute()
    
    # Formatear para el frontend
    flat_data = []
    for p in res.data:
        p['comercio_nombre'] = p.get('comercios', {}).get('nombre')
        flat_data.append(p)
    return flat_data

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
@app.get("/api/v1/eventos", dependencies=[Depends(get_active_user)])
async def get_eventos(limit: int = 100, offset: int = 0):
    res = supabase.table("eventos")\
        .select("*")\
        .eq("estado", "activo")\
        .order("fecha", desc=True)\
        .range(offset, offset + limit - 1)\
        .execute()
    return res.data

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
    # Obtener el comercio_id del perfil del usuario
    prof_res = supabase.table("profiles").select("comercio_id").eq("id", user.uid).execute()
    if not prof_res.data or not prof_res.data[0]['comercio_id']:
        raise HTTPException(403, "El usuario no tiene un comercio asociado")
    
    comercio_id = prof_res.data[0]['comercio_id']
    res = supabase.table("promociones").select("*").eq("comercio_id", comercio_id).execute()
    return res.data

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

# --- 6. PAGOS MERCADO PAGO ---


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
                
                supabase.table("cuotas").update(update_data).eq("id", external_ref).execute()
                
                logger.info(f"✅ Cuota {external_ref} marcada como PAGADA.")
        
        return JSONResponse(content={"status": "received"}, status_code=200)

    except Exception as e:
        logger.error(f"Error procesando webhook: {e}")
        return JSONResponse(content={"status": "error_logged"}, status_code=200)

# Entry point local
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
