import os
import sys
from dotenv import load_dotenv
from supabase import create_client, Client

# Cargar variables de entorno
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(BASE_DIR, ".env"))

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("Error: Faltan credenciales de Supabase")
    sys.exit(1)

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# Roles IDs
roles_res = supabase.table("roles").select("id, nombre").execute()
roles_map = {r["nombre"]: r["id"] for r in roles_res.data}

# Usuarios a crear
admins = [
    {
        "username": "Superadmin",
        "dni": "31435789",
        "password": "x3n3iz3@41",
        "rol_nombre": "SUPERADMIN",
        "email": "superadmin@sociedadruralnorte.com.ar", # Dummy email para Auth
        "nombre_apellido": "Super Administrador"
    },
    {
        "username": "Martin_Soto",
        "password": "Admin1234",
        "rol_nombre": "ADMINISTRADOR",
        "email": "martin_soto@sociedadruralnorte.com.ar",
        "nombre_apellido": "Martin Soto"
    },
    {
        "username": "Luciano_Echeverría",
        "password": "Admin1234",
        "rol_nombre": "ADMINISTRADOR",
        "email": "luciano_echeverria@sociedadruralnorte.com.ar",
        "nombre_apellido": "Luciano Echeverría"
    }
]

for admin in admins:
    try:
        # Check if already exists in profiles
        existing = supabase.table("profiles").select("id").eq("username", admin["username"]).execute()
        
        user_id = None
        if existing.data:
            print(f"Usuario {admin['username']} ya existe en profiles.")
            user_id = existing.data[0]["id"]
        else:
            print(f"Creando cuenta en Auth para {admin['username']}...")
            try:
                auth_res = supabase.auth.admin.create_user({
                    "email": admin["email"],
                    "password": admin["password"],
                    "email_confirm": True
                })
                user_id = auth_res.user.id
            except Exception as e:
                # Si falla auth, quiza ya existe el email, intentamos buscar el usuario
                print(f"Info: {e} - recuperando ID de usuario por email si existe")
                # Hack: Supabase Python admin no tiene get_user_by_email, usamos select en profiles si existe email
                prof = supabase.table("profiles").select("id").eq("email", admin["email"]).execute()
                if prof.data:
                    user_id = prof.data[0]["id"]
                else:
                    raise e
                    
            if user_id:
                # Insert in profiles
                profile_data = {
                    "id": user_id,
                    "username": admin["username"],
                    "dni": admin.get("dni", None),
                    "email": admin["email"],
                    "nombre_apellido": admin["nombre_apellido"],
                    "rol": "ADMIN", # Mantenemos retrocompatibilidad con el enum base
                    "estado": "APROBADO",
                    "password_changed": True
                }
                supabase.table("profiles").insert(profile_data).execute()
                print(f"Perfil creado para {admin['username']}")

        # Asignar roles (SUPERADMIN/ADMIN y SOCIO)
        if user_id:
            for rol_asignar in [admin["rol_nombre"], "SOCIO"]:
                role_id = roles_map.get(rol_asignar)
                if role_id:
                    try:
                        supabase.table("user_roles").insert({
                            "user_id": user_id,
                            "role_id": role_id
                        }).execute()
                        print(f"Rol {rol_asignar} asignado a {admin['username']}")
                    except Exception as e:
                        if "duplicate key" not in str(e).lower():
                            print(f"Error asignando rol {rol_asignar}: {e}")
    except Exception as e:
        print(f"Error procesando {admin['username']}: {e}")

print("Proceso de seedeo de roles completado.")
