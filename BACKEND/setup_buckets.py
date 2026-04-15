import os
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv("BACKEND/.env")

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("Faltan variables de entorno.")
    exit(1)

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

def create_bucket_if_not_exists(bucket_name, is_public=True):
    try:
        buckets = supabase.storage.list_buckets()
        bucket_names = [b.name for b in buckets]
        if bucket_name not in bucket_names:
            print(f"Creando bucket '{bucket_name}'...")
            supabase.storage.create_bucket(bucket_name, public=is_public)
            print(f"Bucket '{bucket_name}' creado exitosamente.")
        else:
            print(f"Bucket '{bucket_name}' ya existe.")
    except Exception as e:
        print(f"Error gestionando bucket {bucket_name}: {e}")

create_bucket_if_not_exists("comprobantes-pagos")
create_bucket_if_not_exists("recibos")
create_bucket_if_not_exists("chat-images")
