import requests
import os

# Configuración
API_URL = "http://localhost:8000"
# Puedes obtener este token después del login manual o usar el SERVICE_ROLE_KEY si el middleware lo permite (como el bypass implementado)
# Usaremos el bypass del SERVICE_ROLE_KEY para la prueba rápida
TOKEN = os.getenv("SUPABASE_SERVICE_ROLE_KEY") 

def generar_archivo_rendicion():
    """
    Crea un archivo de ejemplo siguiendo el formato:
    Fecha(8) + Monto(8) + DNI(8)
    Ej: 20260311 + 00005000 (50.00) + 31435789
    """
    filename = "rendicion_banco_corrientes.txt"
    with open(filename, "w") as f:
        # Fila 1: Superadmin (DNI 31435789), Pago de 50.00
        f.write("202603110000500031435789\n")
        # Fila 2: Socio ficticio, Pago de 45.00
        f.write("202603110000450099999999\n")
    
    print(f"Archivo {filename} generado.")
    return filename

def test_upload(filename):
    if not TOKEN:
        print("Error: Definir SUPABASE_SERVICE_ROLE_KEY en el entorno para el bypass.")
        return

    print(f"Subiendo {filename} al servidor...")
    files = {'archivo': open(filename, 'rb')}
    headers = {'Authorization': f'Bearer {TOKEN}'}
    
    try:
        response = requests.post(f"{API_URL}/api/admin/procesar-rendicion-bc", files=files, headers=headers)
        if response.status_code == 200:
            print("Éxito!")
            print(response.json())
        else:
            print(f"Error {response.status_code}: {response.text}")
    except Exception as e:
        print(f"Error de conexión: {e}")

if __name__ == "__main__":
    archivo = generar_archivo_rendicion()
    # Descomentar para probar si el servidor está corriendo
    # test_upload(archivo)
    print("\nInstrucciones:")
    print("1. Inicia el servidor del backend.")
    print(f"2. Sube el archivo {archivo} usando el endpoint /api/admin/procesar-rendicion-bc.")
