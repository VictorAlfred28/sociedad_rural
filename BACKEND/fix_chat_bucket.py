import os
from dotenv import load_dotenv
from supabase import create_client, Client

# Cargar .env desde la carpeta actual (BACKEND)
load_dotenv(".env")

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("❌ Error: Faltan variables de entorno SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY")
    exit(1)

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

def fix_bucket():
    print(f"Intentando crear bucket 'chat-images' en {SUPABASE_URL}...")
    try:
        # Intentar crear directamente
        res = supabase.storage.create_bucket('chat-images', public=True)
        print("✅ Resultado de creación:", res)
        print("🚀 Bucket 'chat-images' configurado como PUBLICO.")
    except Exception as e:
        print("⚠️ Error al crear bucket (puede que ya exista):", str(e))
        
    # Verificar si aparece en la lista
    try:
        buckets = supabase.storage.list_buckets()
        names = [b.name for b in buckets]
        print("📊 Buckets actuales:", names)
        if 'chat-images' in names:
            print("✨ Confirmado: 'chat-images' está listo para usar.")
        else:
            print("❌ Error crítico: 'chat-images' NO aparece en la lista de buckets.")
    except Exception as e:
        print("❌ Error listando buckets:", str(e))

if __name__ == "__main__":
    fix_bucket()
