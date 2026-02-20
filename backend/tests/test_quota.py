import pytest
from main import supabase

# Usar una cámara fija para pruebas (Debe existir en seed data)
CAMARA_ID = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11" 

@pytest.fixture(autouse=True)
def clean_comercios():
    """Limpia comercios de prueba antes y después de cada test"""
    supabase.table("comercios").delete().eq("rubro", "TEST_QUOTA").execute()
    yield
    supabase.table("comercios").delete().eq("rubro", "TEST_QUOTA").execute()

@pytest.mark.asyncio
async def test_quota_enforcement_sequential(api_client, admin_token):
    """Prueba que el límite de 10 se respete secuencialmente"""
    headers = {"Authorization": f"Bearer {admin_token}"}
    
    # 1. Llenar el cupo (10 comercios)
    for i in range(10):
        payload = {
            "nombre": f"Comercio {i}",
            "rubro": "TEST_QUOTA",
            "direccion": "Test St",
            "telefono": "123",
            "email": f"t{i}@test.com",
            "tipo_plan": "gratuito",
            "camara_id": CAMARA_ID
        }
        res = await api_client.post("/api/v1/comercios", json=payload, headers=headers)
        assert res.status_code == 200

    # 2. Intentar el número 11 (Debe fallar)
    payload_overflow = {
        "nombre": "Comercio Overflow",
        "rubro": "TEST_QUOTA",
        "direccion": "Test St",
        "telefono": "123",
        "email": "overflow@test.com",
        "tipo_plan": "gratuito",
        "camara_id": CAMARA_ID
    }
    res_overflow = await api_client.post("/api/v1/comercios", json=payload_overflow, headers=headers)
    assert res_overflow.status_code == 409
    assert "Límite de comercios gratuitos alcanzado" in res_overflow.json()["detail"]

@pytest.mark.asyncio
async def test_premium_bypass_quota(api_client, admin_token):
    """Los comercios Premium NO deben ocupar cupo gratuito"""
    headers = {"Authorization": f"Bearer {admin_token}"}
    
    # Insertar 10 gratuitos primero
    for i in range(10):
        supabase.table("comercios").insert({
            "nombre": f"Free {i}", "rubro": "TEST_QUOTA", "direccion": "X", "telefono": "X", "email": f"f{i}@x.com",
            "tipo_plan": "gratuito", "camara_id": CAMARA_ID, "estado": "activo"
        }).execute()
        
    # Intentar insertar un Premium (Debe funcionar aunque el cupo gratuito esté lleno)
    payload_premium = {
        "nombre": "Comercio Premium",
        "rubro": "TEST_QUOTA",
        "direccion": "Test St",
        "telefono": "123",
        "email": "premium@test.com",
        "tipo_plan": "premium",
        "camara_id": CAMARA_ID
    }
    res = await api_client.post("/api/v1/comercios", json=payload_premium, headers=headers)
    assert res.status_code == 200
    assert res.json()["tipo_plan"] == "premium"
