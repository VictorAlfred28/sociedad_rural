import pytest
from unittest.mock import MagicMock, patch
from main import supabase
import uuid

# ID Temporal para cuota
TEST_PROFILE_ID = str(uuid.uuid4())

@pytest.fixture(scope="module", autouse=True)
def setup_user():
    # Crear usuario para asociar cuota
    supabase.table("profiles").insert({
        "id": TEST_PROFILE_ID,
        "dni": "PAY_TEST",
        "email": "pay@test.com",
        "rol": "comun"
    }).execute()
    yield
    # Limpieza
    supabase.table("cuotas").delete().eq("profile_id", TEST_PROFILE_ID).execute()
    supabase.table("profiles").delete().eq("id", TEST_PROFILE_ID).execute()

@pytest.mark.asyncio
async def test_create_preference(api_client, admin_token):
    headers = {"Authorization": f"Bearer {admin_token}"}
    payload = {
        "title": "Cuota Test",
        "unit_price": 1000,
        "quantity": 1
    }

    # Mockear SDK de Mercado Pago
    mock_response = {
        "response": {
            "id": "pref_123",
            "init_point": "https://mp.com/checkout",
            "sandbox_init_point": "https://sandbox.mp.com/checkout"
        }
    }

    with patch("main.mp_sdk.preference") as mock_pref:
        mock_pref.return_value.create.return_value = mock_response
        
        response = await api_client.post("/api/v1/payments/preference", json=payload, headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        assert data["preference_id"] == "pref_123"
        
        # Verificar que se creó la cuota en DB
        cuota = supabase.table("cuotas").select("*").eq("mp_preference_id", "pref_123").execute()
        assert len(cuota.data) == 1
        assert cuota.data[0]["monto"] == 1000

@pytest.mark.asyncio
async def test_webhook_payment_approved(api_client):
    """Simula un webhook de pago aprobado"""
    
    # 1. Crear una cuota pendiente manualmente
    cuota_res = supabase.table("cuotas").insert({
        "profile_id": TEST_PROFILE_ID,
        "monto": 2000,
        "mes": 1, "anio": 2024,
        "pagado": False
    }).execute()
    cuota_id = cuota_res.data[0]["id"]
    
    # 2. Mockear llamada a MP para verificar pago
    mock_payment_info = {
        "response": {
            "status": "approved",
            "external_reference": cuota_id
        }
    }
    
    with patch("main.mp_sdk.payment") as mock_pay:
        mock_pay.return_value.get.return_value = mock_payment_info
        
        # Llamar al webhook
        # MP envía query params: ?type=payment&data.id=...
        url = f"/api/v1/payments/webhook?type=payment&data.id=123456"
        response = await api_client.post(url)
        
        assert response.status_code == 200
        
        # 3. Verificar que la cuota se actualizó a PAGADO
        updated_cuota = supabase.table("cuotas").select("pagado").eq("id", cuota_id).execute()
        assert updated_cuota.data[0]["pagado"] is True
