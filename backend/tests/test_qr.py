import pytest
from main import supabase
import uuid
from datetime import datetime

# Identificadores temporales para el test
TEST_ID_ACTIVO = str(uuid.uuid4())
TEST_ID_PENDIENTE = str(uuid.uuid4())

@pytest.fixture(scope="module", autouse=True)
def setup_profiles():
    """Crea perfiles dummy para probar el escaneo QR"""
    # 1. Crear perfil ACTIVO
    supabase.table("profiles").insert({
        "id": TEST_ID_ACTIVO,
        "dni": "QR_TEST_1",
        "email": "qr_active@test.com",
        "nombre": "Test",
        "apellido": "Activo",
        "estado": "activo",
        "rol": "comun"
    }).execute()

    # 2. Crear perfil PENDIENTE
    supabase.table("profiles").insert({
        "id": TEST_ID_PENDIENTE,
        "dni": "QR_TEST_2",
        "email": "qr_pending@test.com",
        "nombre": "Test",
        "apellido": "Pendiente",
        "estado": "pendiente",
        "rol": "comun"
    }).execute()

    yield

    # Teardown
    supabase.table("profiles").delete().in_("id", [TEST_ID_ACTIVO, TEST_ID_PENDIENTE]).execute()

@pytest.mark.asyncio
async def test_qr_validate_active_member(api_client, admin_token):
    headers = {"Authorization": f"Bearer {admin_token}"}
    response = await api_client.get(f"/api/v1/qr/validate/{TEST_ID_ACTIVO}", headers=headers)
    
    assert response.status_code == 200
    data = response.json()
    assert data["valid"] is True
    assert data["socio"]["nombre"] == "Test"
    assert "timestamp" in data

@pytest.mark.asyncio
async def test_qr_validate_pending_member(api_client, admin_token):
    headers = {"Authorization": f"Bearer {admin_token}"}
    response = await api_client.get(f"/api/v1/qr/validate/{TEST_ID_PENDIENTE}", headers=headers)
    
    assert response.status_code == 200
    data = response.json()
    # Debe ser inválido para acceso aunque el socio exista
    assert data["valid"] is False 
    assert data["socio"]["estado"] == "pendiente"

@pytest.mark.asyncio
async def test_qr_validate_not_found(api_client, admin_token):
    headers = {"Authorization": f"Bearer {admin_token}"}
    fake_id = str(uuid.uuid4())
    response = await api_client.get(f"/api/v1/qr/validate/{fake_id}", headers=headers)
    
    assert response.status_code == 404
