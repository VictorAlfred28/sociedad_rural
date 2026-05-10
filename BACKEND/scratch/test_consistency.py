import requests
import json
import uuid

API_URL = "http://localhost:8000" # Asumimos que el server está corriendo localmente

def test_registration_consistency():
    email = f"test_{uuid.uuid4().hex[:6]}@example.com"
    dni = f"99{uuid.uuid4().hex[:6]}"[:8]
    
    payload = {
        "nombre_apellido": "Test Consistency",
        "dni_cuit": dni,
        "email": email,
        "telefono": "1234567890",
        "rol": "SOCIO",
        "password": "Password123!"
    }

    print(f"\n1. Registrando usuario nuevo: {email}")
    r = requests.post(f"{API_URL}/api/register", data=payload)
    print(f"Status: {r.status_code}")
    print(f"Response: {r.json()}")
    
    if r.status_code == 200:
        print("SUCCESS: Registro inicial exitoso.")
    else:
        print("FAIL: No se pudo registrar al usuario inicial.")
        return

    print(f"\n2. Intentando duplicar email: {email}")
    r = requests.post(f"{API_URL}/api/register", data=payload)
    print(f"Status: {r.status_code}")
    print(f"Response: {r.json()}")
    if r.status_code == 400 and "correo" in r.json().get("detail", "").lower():
        print("SUCCESS: Bloqueo de email duplicado correcto.")
    else:
        print("FAIL: El bloqueo de email duplicado falló o dio un error inesperado.")

    print(f"\n3. Intentando duplicar DNI con otro email")
    new_email = f"test_{uuid.uuid4().hex[:6]}@example.com"
    payload["email"] = new_email
    r = requests.post(f"{API_URL}/api/register", data=payload)
    print(f"Status: {r.status_code}")
    print(f"Response: {r.json()}")
    if r.status_code == 400 and "dni" in r.json().get("detail", "").lower():
        print("SUCCESS: Bloqueo de DNI duplicado correcto.")
    else:
        print("FAIL: El bloqueo de DNI duplicado falló o dio un error inesperado.")

if __name__ == "__main__":
    # Nota: Este script requiere que el servidor esté corriendo.
    # Como no puedo asegurar que el servidor esté arriba, este script es para uso del usuario o validación manual.
    print("Script de validación de consistencia preparado.")
    # test_registration_consistency()
