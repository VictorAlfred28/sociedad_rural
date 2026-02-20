import pytest
import os
import asyncio
from httpx import AsyncClient
from main import app, supabase

# Asegurarse de que estamos en entorno de prueba
os.environ["MP_ACCESS_TOKEN"] = "TEST-TOKEN"

@pytest.fixture(scope="session")
def event_loop():
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()

@pytest.fixture(scope="session")
async def admin_token():
    """
    Loguea un usuario admin y retorna el token.
    NOTA: Requiere que exista el usuario 'admin@sociedadrural.com' o similar en la DB de Supabase.
    Si no existe, se puede usar un mock si la DB está aislada, pero aquí usamos la DB real (dev).
    """
    # Intentar login con credenciales conocidas de desarrollo
    # Si falla, usamos el modo DEMO/Fallback que programaste si estuviera habilitado en el backend,
    # pero como estamos testeando el backend real, necesitamos un usuario real.
    try:
        # Credenciales de prueba (Ajustar según tu seed data)
        # Asumimos que tienes el usuario admin creado. Si no, el test fallará en setup.
        response = supabase.auth.sign_in_with_password({
            "email": "admin@sociedadrural.com", 
            "password": "password123" 
        })
        # Si falla login normal, intentamos crear uno temporal para el test
        if not response.user:
             raise Exception("No user")
        
        # Generar token manualmente para el test usando la secret key del backend
        from main import create_access_token
        token = create_access_token(
            data={"sub": response.user.email, "role": "superadmin", "uid": response.user.id}
        )
        return token
    except Exception as e:
        # FALLBACK: Generar token firmado válido sin usuario real en Auth (Solo funciona si el backend confía en la firma)
        from main import create_access_token
        print("⚠️ Usando token simulado para tests")
        return create_access_token(
            data={"sub": "test_admin@rural.com", "role": "superadmin", "uid": "test-admin-uid", "camara_id": "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11"}
        )

@pytest.fixture(scope="module")
async def api_client():
    async with AsyncClient(app=app, base_url="http://test") as client:
        yield client
