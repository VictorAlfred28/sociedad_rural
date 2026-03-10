import os
from dotenv import load_dotenv
from supabase import create_client, Client

# Cargar variables de entorno
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(BASE_DIR, ".env"))

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("Error: Faltan credenciales de Supabase")
    exit(1)

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# Admin IDs from SQL query
admins = [
    {"id": "467290c0-3061-4bab-930b-791236a824f1", "username": "Superadmin"},
    {"id": "155ca05a-7fd0-4fd1-9f32-fa141084ed32", "username": "Martin_Soto"},
    {"id": "5e1706ef-b2e2-4e63-b283-e1876c7f7e5a", "username": "Luciano_Echeverría"}
]

for admin in admins:
    try:
        print(f"Checking user {admin['username']} ({admin['id']})...")
        res = supabase.auth.admin.get_user_by_id(admin['id'])
        print(f"Success loading {admin['username']} from Auth.")
    except Exception as e:
        print(f"FAILED loading {admin['username']} from Auth: {e}")
