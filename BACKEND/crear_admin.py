import os
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("Faltan variables de entorno.")
    exit(1)

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

def crear_admin():
    email = "victoralfredo2498@gmail.com"
    password = "xEnEizE@28"
    
    print(f"Intentando crear usuario admin con email: {email}...")
    try:
        # 1. Crear usuario en Auth
        user_id = None
        try:
            auth_response = supabase.auth.admin.create_user({
                "email": email,
                "password": password,
                "email_confirm": True
            })
            user_id = auth_response.user.id
            print(f"Usuario creado en Auth con ID: {user_id}")
        except Exception as auth_err:
            if "already been registered" in str(auth_err):
                print(f"El usuario {email} ya existía en Auth. Obteniendo ID y actualizando contraseña...")
                # Buscar el usuario existente por email
                users = supabase.auth.admin.list_users()
                for u in users:
                    if u.email == email:
                        user_id = u.id
                        break
                
                if user_id:
                     supabase.auth.admin.update_user_by_id(user_id, {"password": password})
                else:
                    raise Exception("No se pudo encontrar el ID del usuario existente.")
            else:
                 raise auth_err
        
        # 2. Upsert perfil como ADMIN
        profile_data = {
            "id": user_id,
            "nombre_apellido": "Victor Alfredo",
            "dni": "12345678", # DNI por defecto
            "email": email,
            "telefono": "000000000",
            "rol": "ADMIN",
            "estado": "APROBADO",
            "password_changed": True
        }
        
        # Upsert: Si ya existe un perfil con ese ID, lo actualiza, sino lo crea.
        supabase.table("profiles").upsert(profile_data).execute()
        print("Perfil de administrador (Upsert) creado/actualizado correctamente en public.profiles.")
        
        print("\n--- CREDENCIALES DEL ADMINISTRADOR ---")
        print(f"Usuario/Email: {email}")
        print(f"Contraseña: {password}")
        print("--------------------------------------")
        
    except Exception as e:
        print(f"Error al crear el administrador: {str(e)}")

if __name__ == "__main__":
    crear_admin()
