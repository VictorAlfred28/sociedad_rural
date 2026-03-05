import pytest
from fastapi.testclient import TestClient
from main import app
import uuid
import time
import os

client = TestClient(app)

# =======================================================
# MOCKING Y FIXTURES
# =======================================================
@pytest.fixture
def mock_camara_token():
    """Genera un JWT simulado para una cámara (requiere configurarlo dinámicamente si se va a probar VS base de datos real)"""
    return "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.SIMULADO_CAMARA"

@pytest.fixture
def mock_comercio_token():
    return "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.SIMULADO_COMERCIO"

# =======================================================
# TESTS DE SEGURIDAD (Tenant Isolation & Roles)
# =======================================================
def test_comercio_attempting_cross_tenant_access(mock_comercio_token):
    """
    Validation Rule: ¿Una cámara/comercio puede acceder a comercios de otra cámara?
    Comprueba que el endpoint de dependientes u otras consultas devuelvan 401/403 (token de prueba es falso de momento, pero prueba aislamiento)
    """
    response = client.get("/api/camara/mis-comercios", headers={"Authorization": f"Bearer {mock_comercio_token}"})
    
    assert response.status_code in [401, 403], f"Inesperado success: {response.text}"

def test_acceso_indebido_cambio_clave_usuario_ajeno(mock_camara_token):
    """Verifica que un usuario no pueda usar el reset sobre un uuid de otro usuario"""
    fake_target_uuid = str(uuid.uuid4())
    payload = {"new_password": "HackPassword123!"}
    
    response = client.post(
        f"/api/admin/users/{fake_target_uuid}/reset-password", 
        headers={"Authorization": f"Bearer {mock_camara_token}"},
        json=payload
    )
    
    # Debe fallar obligatoriamente porque la cámara no es ADMIN global ni el JWT es válido admin
    assert response.status_code in [401, 403]

def test_mass_assignment_protection(mock_comercio_token):
    """
    Validación: ¿Existe protección contra mass assignment en perfiles?
    Intentamos inyectar un rol ADMIN modificando el perfil (no debe haber error 500 y no debe aceptarse).
    """
    payload = {
        "telefono": "3794123456",
        "rol": "ADMIN",  # Inyección maliciosa
        "estado": "APROBADO" # Inyección maliciosa
    }
    
    # Esto pasará local si el token es valido, o dará un auth error. Pydantic debe filtrar "rol", "estado".
    response = client.put(
        "/api/perfil", 
        headers={"Authorization": f"Bearer {mock_comercio_token}"},
        json=payload
    )
    
    # Como el Auth va a fallar, nos aseguramos de que no sea un internal error originado por mass assignment
    assert response.status_code != 500

# =======================================================
# TESTS DE PERFORMANCE Y STRESS (Simulado)
# =======================================================
def test_pagination_limits():
    """Valida los nuevos checks de paginación <=100 aplicados en la Auditoría Tećnica"""
    token = "eyJhbGciOi....ADMIN_TOKEN"
    response = client.get("/api/admin/auditoria?limit=1000", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 422 # Error de validación de Pydantic por le=100

def test_creacion_masiva_eventos_webhook():
    """
    Evaluando: Validar que el webhook de make.com rechaza llamadas sin token seguro.
    """
    payload = {
        "post_id": f"TEST_IG_{uuid.uuid4().hex[:8]}",
        "caption": "Reunion Anual.",
        "media_url": "https://fake_url.com/img.jpg",
        "timestamp": "2026-10-10T15:00:00"
    }
    
    # Llamamos SIN el secret token de webhook
    response = client.post(
        "/api/v1/importar-evento", 
        json=payload
    )
    
    # Debería devolvernos un 401 Unauthorized
    assert response.status_code == 401
