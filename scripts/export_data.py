import os
import json
from datetime import datetime
from supabase import create_client, Client
from dotenv import load_dotenv

# Cargar variables de entorno desde el Backend
load_dotenv('../BACKEND/.env')

url: str = os.environ.get("SUPABASE_URL")
key: str = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

if not url or not key:
    print("Error: SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY no encontradas en el archivo .env")
    exit(1)

supabase: Client = create_client(url, key)

# Lista de tablas a respaldar
TABLES = [
    "profiles",
    "roles",
    "user_roles",
    "ofertas",
    "comercios",
    "camaras",
    "eventos",
    "eventos_sociales",
    "pagos_cuotas",
    "familiares",
    "profesionales",
    "localidades"
]

def backup_database():
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_path = f"backup_{timestamp}"
    
    if not os.path.exists(backup_path):
        os.makedirs(backup_path)
    
    print(f"Iniciando respaldo en: {backup_path}")
    
    for table in TABLES:
        try:
            print(f"Exportando tabla: {table}...", end=" ", flush=True)
            response = supabase.table(table).select("*").execute()
            
            with open(os.path.join(backup_path, f"{table}.json"), "w", encoding="utf-8") as f:
                json.dump(response.data, f, indent=2, ensure_ascii=False)
            
            print("OK")
        except Exception as e:
            print(f"ERROR: {str(e)}")

    print(f"\nRespaldo completado satisfactoriamente en la carpeta: {backup_path}")

if __name__ == "__main__":
    backup_database()
