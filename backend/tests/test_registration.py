import requests
import uuid
import time

BASE_URL = "http://localhost:8000/api/v1"

def register_user(email, password, nombre, apellido, dni):
    payload = {
        "email": email,
        "password": password,
        "nombre": nombre,
        "apellido": apellido,
        "dni": dni,
        "rol": "comun"
    }
    response = requests.post(f"{BASE_URL}/auth/register", json=payload)
    return response

def test_multiple_registrations():
    print("Starting multiple registration test...")
    
    # Test 1: First user
    unique_id1 = str(uuid.uuid4())[:8]
    email1 = f"test_{unique_id1}@example.com"
    dni1 = str(int(time.time()))[-8:]
    
    print(f"Registering User 1: {email1}...")
    res1 = register_user(email1, "Password123!", "Test1", "User1", dni1)
    print(f"User 1 Result: {res1.status_code} - {res1.json()}")
    assert res1.status_code == 200 or res1.status_code == 201

    # Test 2: Second user (the one that used to fail)
    unique_id2 = str(uuid.uuid4())[:8]
    email2 = f"test_{unique_id2}@example.com"
    dni2 = str(int(time.time()) + 1)[-8:]
    
    print(f"Registering User 2: {email2}...")
    res2 = register_user(email2, "Password123!", "Test2", "User2", dni2)
    print(f"User 2 Result: {res2.status_code} - {res2.json()}")
    assert res2.status_code == 200 or res2.status_code == 201

    # Test 3: Duplicate DNI
    print(f"Registering User with duplicate DNI: {dni1}...")
    res3 = register_user(f"other_{unique_id1}@example.com", "Password123!", "Test3", "User3", dni1)
    print(f"Duplicate DNI Result: {res3.status_code} - {res3.json()}")
    assert res3.status_code == 409

    print("\nAll tests passed successfully!")

if __name__ == "__main__":
    try:
        test_multiple_registrations()
    except Exception as e:
        print(f"\nTest failed: {e}")
        exit(1)
