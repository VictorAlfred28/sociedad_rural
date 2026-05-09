import os
from supabase import create_client, Client
from dotenv import load_dotenv

# Cargar variables de entorno desde el Backend
load_dotenv('BACKEND/.env')

url: str = os.environ.get("SUPABASE_URL")
key: str = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

if not url or not key:
    print("Error: SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY no encontradas en el archivo .env")
    exit(1)

supabase: Client = create_client(url, key)

def main():
    print("Iniciando normalización de contraseñas temporales...")
    
    # Obtener usuarios que necesitan cambiar contraseña (tienen contraseñas temporales)
    res = supabase.table("profiles").select("id, email, rol").or_("must_change_password.eq.true,password_changed.eq.false").execute()
    
    usuarios = res.data
    
    if not usuarios:
        print("No se encontraron usuarios con contraseñas temporales.")
        return
        
    print(f"Se detectaron {len(usuarios)} usuarios con contraseña temporal.")
    
    count_success = 0
    count_error = 0
    
    for user in usuarios:
        user_id = user["id"]
        email = user["email"]
        try:
            # Actualizar contraseña en Auth a SRNC2026!
            supabase.auth.admin.update_user_by_id(
                user_id,
                {"password": "SRNC2026!"}
            )
            print(f"[OK] Contraseña normalizada para: {email}")
            count_success += 1
        except Exception as e:
            print(f"[ERROR] Fallo al actualizar a {email}: {e}")
            count_error += 1
            
    print("-" * 40)
    print("Resumen de Normalización:")
    print(f"Total procesados: {len(usuarios)}")
    print(f"Exitosos: {count_success}")
    print(f"Errores: {count_error}")
    print("-" * 40)

if __name__ == "__main__":
    main()
