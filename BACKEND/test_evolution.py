"""
Test completo de Evolution API para verificar el envío de mensajes de mora.
Ejecutar desde la carpeta BACKEND: python test_evolution.py
"""
import os
import requests
from dotenv import load_dotenv

# Cargar variables de entorno
load_dotenv()

EVOLUTION_API_URL = os.getenv("EVOLUTION_API_URL", "https://api-sociedad-rural.agentech.ar")
EVOLUTION_API_TOKEN = os.getenv("EVOLUTION_API_TOKEN", "429683C4C977415CAAFCCE10F7D57E11")
INSTANCE_NAME = os.getenv("INSTANCE_NAME", "Sociedad Rural Del Norte")

# Número de destino para la prueba (Victor Alfredo)
NUMERO_PRUEBA = "3794330172"  # Sin prefijo, lo formateamos abajo

def format_numero(numero: str) -> str:
    """Normaliza número argentino al formato 549XXXXXXXXXX"""
    digitos = "".join(filter(str.isdigit, numero))
    if digitos.startswith("549") and len(digitos) == 13:
        return digitos
    if digitos.startswith("54") and len(digitos) == 12:
        return "549" + digitos[2:]
    if len(digitos) == 10:
        return "549" + digitos
    return digitos

def step(titulo: str):
    print(f"\n{'='*60}")
    print(f"  {titulo}")
    print(f"{'='*60}")

def ok(msg: str):
    print(f"  ✅ {msg}")

def error(msg: str):
    print(f"  ❌ {msg}")

def info(msg: str):
    print(f"  ℹ️  {msg}")

# ─────────────────────────────────────────────────
# TEST 1: Verificar que Evolution API responde
# ─────────────────────────────────────────────────
step("TEST 1: Conectividad con Evolution API")
try:
    r = requests.get(f"{EVOLUTION_API_URL}/", timeout=10)
    if r.status_code < 500:
        ok(f"Evolution API respondió → HTTP {r.status_code}")
    else:
        error(f"Evolution API respondió con error → HTTP {r.status_code}")
except Exception as e:
    error(f"No se pudo conectar a {EVOLUTION_API_URL}: {e}")

# ─────────────────────────────────────────────────
# TEST 2: Verificar estado de la instancia
# ─────────────────────────────────────────────────
step(f"TEST 2: Estado de la instancia '{INSTANCE_NAME}'")
headers = {"apikey": EVOLUTION_API_TOKEN, "Content-Type": "application/json"}

try:
    r = requests.get(
        f"{EVOLUTION_API_URL}/instance/fetchInstances",
        headers=headers,
        timeout=10
    )
    if r.status_code == 200:
        instancias = r.json()
        if isinstance(instancias, list):
            encontrada = None
            for inst in instancias:
                nombre = inst.get("instance", {}).get("instanceName") or inst.get("name", "")
                if INSTANCE_NAME.lower() in nombre.lower():
                    encontrada = inst
                    break
            if encontrada:
                estado = encontrada.get("instance", {}).get("state", "desconocido")
                ok(f"Instancia encontrada: '{nombre}' → estado: {estado.upper()}")
                if estado.lower() != "open":
                    error(f"La instancia NO está conectada (estado: {estado}). Necesita escanear el QR.")
            else:
                nombres = [i.get("instance", {}).get("instanceName", "?") for i in instancias]
                error(f"No se encontró la instancia '{INSTANCE_NAME}'. Instancias disponibles: {nombres}")
        else:
            info(f"Respuesta inesperada: {instancias}")
    else:
        error(f"Error al obtener instancias: HTTP {r.status_code} → {r.text[:200]}")
except Exception as e:
    error(f"Error consultando instancias: {e}")

# ─────────────────────────────────────────────────
# TEST 3: Enviar mensaje de prueba de mora
# ─────────────────────────────────────────────────
step(f"TEST 3: Enviar mensaje de mora a {NUMERO_PRUEBA}")

numero_formateado = format_numero(NUMERO_PRUEBA)
info(f"Número formateado: {NUMERO_PRUEBA} → {numero_formateado}")

mensaje = (
    "🔔 *AVISO DE MORA - SOCIEDAD RURAL DEL NORTE*\n\n"
    "Estimado Victor Alfredo,\n\n"
    "Este es un mensaje de *PRUEBA* del sistema automático.\n\n"
    "Registramos una cuota pendiente de *Marzo 2026*.\n\n"
    "Podés abonar y subir tu comprobante en:\n"
    "https://agentech.ar/cuotas\n\n"
    "_Sociedad Rural del Norte de Corrientes_"
)

payload = {
    "number": numero_formateado,
    "text": mensaje
}

instance_slug = INSTANCE_NAME.replace(" ", "%20")

try:
    r = requests.post(
        f"{EVOLUTION_API_URL}/message/sendText/{INSTANCE_NAME}",
        headers=headers,
        json=payload,
        timeout=15
    )
    
    if r.status_code in [200, 201]:
        data = r.json()
        ok(f"Mensaje enviado exitosamente!")
        ok(f"Message ID: {data.get('key', {}).get('id', 'N/A')}")
    else:
        error(f"Error al enviar mensaje: HTTP {r.status_code}")
        print(f"  Respuesta: {r.text[:400]}")
except Exception as e:
    error(f"Error en el envío: {e}")

print(f"\n{'='*60}")
print("  Test finalizado.")
print(f"{'='*60}\n")
