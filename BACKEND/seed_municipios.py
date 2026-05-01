# coding=utf-8
import os
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
    print("Faltan credenciales")
    exit(1)

supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

municipios_seed = [
    {"nombre": "Gobernador Virasoro", "provincia": "Corrientes"},
    {"nombre": "Santo Tomé", "provincia": "Corrientes"},
    {"nombre": "Ituzaingó", "provincia": "Corrientes"},
    {"nombre": "San Carlos", "provincia": "Corrientes"},
    {"nombre": "Garruchos", "provincia": "Corrientes"},
    {"nombre": "Colonia Carlos Pellegrini", "provincia": "Corrientes"},
    {"nombre": "Yapeyú", "provincia": "Corrientes"},
    {"nombre": "Itatí", "provincia": "Corrientes"},
    {"nombre": "Ramada Paso", "provincia": "Corrientes"},
    {"nombre": "San Cosme", "provincia": "Corrientes"},
    {"nombre": "Santa Ana", "provincia": "Corrientes"},
    {"nombre": "Paso de la Patria", "provincia": "Corrientes"},
    {"nombre": "Capital", "provincia": "Corrientes"},
    {"nombre": "Riachuelo", "provincia": "Corrientes"},
    {"nombre": "El Sombrero", "provincia": "Corrientes"}
]

for m in municipios_seed:
    try:
        exist = supabase.table("municipios").select("id").eq("nombre", m["nombre"]).execute()
        if not exist.data:
            supabase.table("municipios").insert(m).execute()
            print(f"Insertado {m['nombre']}")
        else:
            print(f"Ya existe {m['nombre']}")
    except Exception as e:
        print(f"Error insertando {m['nombre']}: {e}")

print("Seed finalizado.")
