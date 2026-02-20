
import os
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

url: str = os.getenv("SUPABASE_URL")
key: str = os.getenv("SUPABASE_SERVICE_KEY")

if not key:
    print("Error: SUPABASE_SERVICE_KEY no encontrada en .env")
    exit(1)

supabase: Client = create_client(url, key)

email = "victoralfredo27@gmail.com"
password = "xEnEizE@41"
role = "superadmin"
nombre = "Victor" 
apellido = "Alfredo"
dni = "11111111" 
camara_id = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11" 

print(f"Creando usuario {email}...")

try:
    # 1. Check if user exists in profiles to get ID
    res = supabase.table("profiles").select("id").eq("email", email).execute()
    user_id = None
    if res.data:
        user_id = res.data[0]['id']
        print(f"Usuario encontrado en profiles: {user_id}")
    else:
        # Try to find in auth.users via admin api (listing is heavy but necessary if profile missing)
        # Actually, let's just try create.
        pass

    if not user_id:
        try:
            user_attributes = {
                "email": email,
                "password": password,
                "email_confirm": True,
                "user_metadata": {
                    "dni": dni,
                    "nombre": nombre,
                    "apellido": apellido,
                    "camara_id": camara_id
                }
            }
            # This requires 'service_role' key
            user = supabase.auth.admin.create_user(user_attributes)
            user_id = user.user.id
            print(f"Usuario Auth creado: {user_id}")
        except Exception as e:
            if "User already registered" in str(e):
                 print("El usuario ya existe en Auth. Intentando recuperar ID simulando login...")
                 # We can't login with service role easily to getting ID without password.
                 # But we know the password!
                 try:
                     session = supabase.auth.sign_in_with_password({"email": email, "password": password})
                     user_id = session.user.id
                     print(f"Logueado exitosamente, ID: {user_id}")
                 except Exception as login_err:
                     print(f"No se pudo loguear para obtener ID: {login_err}")
                     raise e
            else:
                raise e

    # 2. Upsert Profile
    if user_id:
        profile_data = {
            "id": user_id,
            "email": email,
            "dni": dni,
            "nombre": nombre,
            "apellido": apellido,
            "rol": role,
            "estado": "activo",
            "camara_id": camara_id
        }
        
        # Upsert profile
        res = supabase.table("profiles").upsert(profile_data).execute()
        print(f"Perfil actualizado para {email} con rol {role}.")
        print("✅ Superadmin listo.")
    else:
        print("❌ No se pudo determinar el User ID.")

except Exception as e:
    print(f"Error General: {e}")
