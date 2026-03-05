import uuid
import os
import sys
import httpx
from dotenv import load_dotenv
from supabase import create_client, Client

# Cargar variables
load_dotenv(".env")
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
API_BASE_URL = "http://localhost:8000" # Asume que el uvicorn no esta corriendo?
# No, usaremos la api local con httpx para TestClient
from fastapi.testclient import TestClient
from main import app
client = TestClient(app)

print("INICIANDO TEST DE INTEGRACION SENIOR - PLATAFORMA SOCIEDAD RURAL...")

# CONTENEDORES PARA LIMPIEZA
created_users = []

def cleanup():
    print("\n[CLEANUP] Eliminando datos de prueba...")
    for uid in created_users:
        try:
            supabase.auth.admin.delete_user(uid)
            print(f" - Usuario {uid} eliminado de Auth.")
        except Exception as e:
            print(f" - Error borrando {uid}: {e}")
    print("[CLEANUP] Finalizado.")

def create_test_user(email, password, rol, nombre, dni, titular_id=None):
    res = supabase.auth.admin.create_user({
        "email": email,
        "password": password,
        "email_confirm": True
    })
    uid = res.user.id
    created_users.append(uid)
    
    profile_data = {
        "id": uid,
        "nombre_apellido": nombre,
        "email": email,
        "dni": dni,
        "rol": rol,
        "estado": "APROBADO",
        "titular_id": titular_id
    }
    supabase.table("profiles").insert(profile_data).execute()
    return uid, email, password

def test_login_and_get_token(email, password, is_dni=False, dni=None):
    ident = dni if is_dni else email
    resp = client.post("/api/login", json={"identificador": ident, "password": password})
    assert resp.status_code == 200, f"Login fallido para {ident}: {resp.text}"
    return resp.json()["token"]

try:
    print("[1] PREPARANDO DATOS DE PRUEBA (DB REAL)...")
    # 1. Admin
    uid_admin, em_admin, pw_admin = create_test_user("test_admin@srn.com", "Test1234!", "ADMIN", "Test Admin", "99999001")
    # 2. Cámara A
    uid_camara_a, em_camara_a, pw_camara_a = create_test_user("test_camaraA@srn.com", "Test1234!", "CAMARA", "Camara A", "99999002")
    # 3. Comercio de Cámara A
    uid_comA, em_comA, pw_comA = create_test_user("test_comA@srn.com", "Test1234!", "COMERCIO", "Comercio A", "99999003", titular_id=uid_camara_a)
    # 4. Cámara B
    uid_camara_b, em_camara_b, pw_camara_b = create_test_user("test_camaraB@srn.com", "Test1234!", "CAMARA", "Camara B", "99999004")
    # 5. Comercio Independiente / Otra cámara
    uid_com_indep, em_com_indep, pw_com_indep = create_test_user("test_comIndep@srn.com", "Test1234!", "COMERCIO", "Comercio Indep", "99999005")

    print("[SUCCESS] Usuarios creados.\n")

    print("[2] AUTENTICANDO USUARIOS (Generando JWTs)...")
    token_admin = test_login_and_get_token(em_admin, pw_admin)
    token_camara_a = test_login_and_get_token(em_camara_a, pw_camara_a)
    token_camara_b = test_login_and_get_token(em_camara_b, pw_camara_b)
    token_comA = test_login_and_get_token(em_comA, pw_comA, is_dni=True, dni="99999003") # Login con DNI
    print("[SUCCESS] Tokens generados.\n")

    print("[3] EJECUTANDO TESTS DE VULNERABILIDAD Y PERMISOS...")
    
    # --- TEST 1: Tenant Isolation (Cámara B intenta ver/modificar comercio de Cámara A) ---
    print("  -> Test 1: Cross-Tenant Isolation (Cámara B editando Comercio A)...")
    resp_t1 = client.put(f"/api/camara/comercios/{uid_comA}", headers={"Authorization": f"Bearer {token_camara_b}"}, json={"telefono": "1111111"})
    assert resp_t1.status_code == 403, f"FALLO: La Cámara B logró modificar/ver el comercio A! Status: {resp_t1.status_code}"
    print("     [OK] Bloqueo efectivo 403 comprobado.")

    # --- TEST 2: Mass Assignment ---
    print("  -> Test 2: Mass Assignment en Perfiles...")
    resp_t2 = client.put("/api/perfil", headers={"Authorization": f"Bearer {token_comA}"}, json={"telefono": "2222222", "rol": "ADMIN", "estado": "APROBADO"})
    assert resp_t2.status_code == 200, f"Error actualizando perfil: {resp_t2.text}"
    # Verificar en DB que el rol sigue siendo COMERCIO
    check_t2 = supabase.table("profiles").select("rol").eq("id", uid_comA).execute()
    assert check_t2.data[0]["rol"] == "COMERCIO", "FALLO: El usuario logró auto-elevar sus privilegios a ADMIN!"
    print("     [OK] Mass assignment ignorado exitosamente por Pydantic.")

    # --- TEST 3: Escalada de Privilegios para Reset Password ---
    print("  -> Test 3: Horizontal Privilege Escalation (Cámara reseteando a Admin)...")
    resp_t3 = client.post(f"/api/admin/users/{uid_admin}/reset-password", headers={"Authorization": f"Bearer {token_camara_a}"}, json={"new_password": "Hacked123!"})
    assert resp_t3.status_code == 403, f"FALLO: Una Cámara pudo resetear la contraseña del ADMIN GLOBAL! Status: {resp_t3.status_code} Resp: {resp_t3.text}"
    print("     [OK] Intento bloqueado 403 comprobado.")

    # --- TEST 4: Paginación Máxima Efectiva ---
    print("  -> Test 4: Límite de Paginación RAM (Prevención DDoS)...")
    resp_t4 = client.get("/api/admin/auditoria?limit=500", headers={"Authorization": f"Bearer {token_admin}"})
    assert resp_t4.status_code == 422, f"FALLO: El backend permitió solicitar más de 100 auditorías. Pag: {resp_t4.status_code}"
    print("     [OK] Límite Query(le=100) respetado. Max result: 422 Unprocessable.")

    print("\n✅ TODAS LAS PRUEBAS DE SEGURIDAD PASARON CON EXITO.")

except AssertionError as e:
    print(f"\n❌ ERROR DE ASEVERACION (TEST FALLIDO): {e}")
    sys.exit(1)
except Exception as e:
    print(f"\n❌ ERROR CRITICO RUNTIME: {e}")
    sys.exit(1)
finally:
    cleanup()

