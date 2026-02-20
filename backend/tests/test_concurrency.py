import pytest
import asyncio
import random
from main import supabase

# Cámara ID del Seed Data (Sociedad Rural Central)
CAMARA_ID = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11" 

@pytest.mark.asyncio
async def test_concurrency_limit_10_free_shops(api_client, admin_token):
    """
    OBJETIVO: Intentar crear 15 comercios GRATUITOS simultáneamente.
    ESPERADO: 10 Éxitos (200 OK), 5 Fallos (409 Conflict).
    """
    
    # 1. PREPARACIÓN: Limpiar comercios de prueba para esta cámara
    print("\n🧹 Limpiando DB para test de concurrencia...")
    supabase.table("comercios").delete().eq("rubro", "TEST_CONCURRENCY").execute()
    
    # Verificar que empezamos en 0 (o bajo el límite)
    # Nota: Si hay otros comercios reales, esto podría fallar. Lo ideal es usar una cámara de test aislada.
    # Para este script, asumiremos que podemos borrar por rubro 'TEST_CONCURRENCY'.
    
    headers = {"Authorization": f"Bearer {admin_token}"}
    
    async def create_request(index):
        payload = {
            "nombre": f"Comercio Test {index}",
            "rubro": "TEST_CONCURRENCY",
            "direccion": "Calle Falsa 123",
            "telefono": "1111111",
            "email": f"test{index}@rural.com",
            "tipo_plan": "gratuito",
            "camara_id": CAMARA_ID
        }
        # Pequeño jitter para simular realidad pero manteniendo concurrencia alta
        await asyncio.sleep(random.uniform(0.01, 0.05)) 
        return await api_client.post("/api/v1/comercios", json=payload, headers=headers)

    # 2. EJECUCIÓN: Lanzar 15 peticiones simultáneas
    print("🚀 Lanzando 15 peticiones concurrentes...")
    tasks = [create_request(i) for i in range(15)]
    responses = await asyncio.gather(*tasks)

    # 3. ANÁLISIS
    success_count = 0
    fail_409_count = 0
    other_errors = 0

    for res in responses:
        if res.status_code == 200:
            success_count += 1
        elif res.status_code == 409:
            fail_409_count += 1
            print(f"✅ Bloqueo correcto: {res.json()['detail']}")
        else:
            other_errors += 1
            print(f"⚠️ Error inesperado: {res.status_code} - {res.text}")

    print(f"\n📊 RESULTADOS:")
    print(f"   Éxitos (200): {success_count} (Esperado: <=10)")
    print(f"   Bloqueos (409): {fail_409_count} (Esperado: >=5)")
    
    # 4. ASSERTIONS
    # Consultar DB para la verdad absoluta
    db_count = supabase.table("comercios").select("id", count="exact")\
        .eq("rubro", "TEST_CONCURRENCY")\
        .eq("camara_id", CAMARA_ID)\
        .execute().count

    print(f"   Registros reales en DB: {db_count}")

    assert db_count <= 10, f"FALLO GRAVE: Hay {db_count} comercios en DB. El límite es 10."
    assert success_count <= 10, "El API reportó más de 10 éxitos."
    assert fail_409_count >= 5, "No se rechazaron suficientes peticiones."

    # Limpieza final
    supabase.table("comercios").delete().eq("rubro", "TEST_CONCURRENCY").execute()
