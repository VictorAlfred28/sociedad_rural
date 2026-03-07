import os
import requests
from dotenv import load_dotenv

load_dotenv()

def test_evolution_api_direct():
    url_base = os.getenv("EVOLUTION_API_URL")
    instance = os.getenv("INSTANCE_NAME")
    apikey = os.getenv("EVOLUTION_API_TOKEN")
    
    print(f"URL Base: {url_base}")
    print(f"Instance: {instance}")
    print(f"API Key: {apikey[:5]}***" if apikey else "API Key: None")

    if not all([url_base, instance, apikey]):
        print("Faltan variables de entorno.")
        return

    # El usuario paso 3794330172. El sistema ahora debe anteponer 549 automaticamente.
    telefono_raw = "3794330172"
    numero_limpio = "".join(filter(str.isdigit, telefono_raw))
    if len(numero_limpio) == 10:
        numero_limpio = f"549{numero_limpio}"
    
    telefono = numero_limpio
    mensaje = "Prueba de conexión directa Evolution API - Sociedad Rural con auto-formateo 549."

    if url_base and not url_base.startswith(("http://", "https://")):
        url_base = f"https://{url_base}"

    url = f"{url_base}/message/sendText/{instance}"
    headers = {
        "Content-Type": "application/json",
        "apikey": apikey
    }
    
    payload = {
        "number": telefono,
        "text": mensaje,
        "delay": 100,
        "linkPreview": True
    }
    
    print(f"Enviando POST a {url}...")
    try:
        response = requests.post(url, json=payload, headers=headers, timeout=15)
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.text}")
    except Exception as e:
        print(f"Error en la conexión: {e}")

if __name__ == "__main__":
    test_evolution_api_direct()
