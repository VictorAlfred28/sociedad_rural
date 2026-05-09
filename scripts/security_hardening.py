"""
SCRIPT DE HARDENING DE SEGURIDAD — BACKEND main.py
Aplica correcciones detectadas en la auditoría:
  1. Sanitizar detail=str(e) / detail=f"...{str(e)}"
  2. Eliminar tokens internos del response de registro
  3. Unificar mensajes de enumeración en login
  4. Hardening de get_current_superadmin
  5. Reducir rate limit de check-email
  6. Eliminar exc_info=True

Uso: python scripts/security_hardening.py
Genera backup en BACKEND/main.py.bak antes de modificar.
"""

import re
import shutil
import os

BACKEND_FILE = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "BACKEND", "main.py")
BACKUP_FILE = BACKEND_FILE + ".bak"

def load(path):
    with open(path, "r", encoding="utf-8") as f:
        return f.read()

def save(path, content):
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)

def backup(src, dst):
    shutil.copy2(src, dst)
    print(f"[BACKUP] {dst}")

# ─────────────────────────────────────────────────────────────────────────────
# TRANSFORMACIÓN 1: Sanitizar detail=str(e) y detail=f"...: {str(e)}"
# Reemplaza TODAS las variantes que filtran str(e) al cliente.
# ─────────────────────────────────────────────────────────────────────────────
def sanitize_str_e_in_details(src: str) -> tuple[str, int]:
    """
    Busca patrones como:
      raise HTTPException(status_code=NNN, detail=str(e))
      raise HTTPException(status_code=NNN, detail=f"...{str(e)}")
      raise HTTPException(status_code=NNN, detail=f"...{e}")
    Y los reemplaza agregando un log interno y devolviendo mensaje genérico.

    Estrategia: reemplaza el argumento detail cuando contiene str(e) o {e}.
    No toca casos que ya tienen mensaje fijo sin e.
    """
    count = 0

    # Patrón 1: detail=str(e)   (en raise HTTPException)
    pattern1 = re.compile(
        r'(raise HTTPException\(status_code\s*=\s*\d+,\s*)detail\s*=\s*str\(e\)',
        re.MULTILINE
    )
    def replace1(m):
        return m.group(1) + 'detail="Error interno del servidor"'
    result, n = pattern1.subn(replace1, src)
    count += n
    src = result

    # Patrón 2: detail=f"...{str(e)}" o detail=f"...{e}" (al final de la cadena)
    pattern2 = re.compile(
        r'(raise HTTPException\(status_code\s*=\s*\d+,\s*)detail\s*=\s*f"([^"]*)\{(?:str\(e\)|e)\}"',
        re.MULTILINE
    )
    def replace2(m):
        return m.group(1) + 'detail="Error interno del servidor"'
    result, n = pattern2.subn(replace2, src)
    count += n
    src = result

    # Patrón 3: detail=f"...{str(e)}" con comillas simples
    pattern3 = re.compile(
        r"(raise HTTPException\(status_code\s*=\s*\d+,\s*)detail\s*=\s*f'([^']*)\{(?:str\(e\)|e)\}'",
        re.MULTILINE
    )
    def replace3(m):
        return m.group(1) + "detail='Error interno del servidor'"
    result, n = pattern3.subn(replace3, src)
    count += n
    src = result

    # Patrón 4: detail multiline con str(e) al final:
    # status_code=500,
    # detail=f"Error al ...: {str(e)}"
    pattern4 = re.compile(
        r'(status_code\s*=\s*\d+,\s*\n\s*)detail\s*=\s*f"([^"]*)\{(?:str\(e\)|e)\}"',
        re.MULTILINE
    )
    def replace4(m):
        return m.group(1) + 'detail="Error interno del servidor"'
    result, n = pattern4.subn(replace4, src)
    count += n
    src = result

    return src, count


# ─────────────────────────────────────────────────────────────────────────────
# TRANSFORMACIÓN 2: Eliminar email_verificacion_token del response de /register
# ─────────────────────────────────────────────────────────────────────────────
def strip_token_from_register_response(src: str) -> tuple[str, int]:
    """
    Busca el return del endpoint register que devuelve profile_data completo
    y lo reemplaza para filtrar campos sensibles.
    Aplica a /api/register y /api/register/comercio.
    """
    count = 0

    # Reemplazar el return que devuelve "socio": profile_data (con todo)
    # por una versión que excluye campos sensibles
    old_register_return = '''\
        return {
            "message": f"{rol_asignado.capitalize()} registrado correctamente. Revisá tu correo para verificar tu cuenta.",
            "socio": profile_data,
        }'''

    new_register_return = '''\
        # Filtrar campos sensibles del response (tokens, estado interno)
        safe_profile = {
            "id": profile_data.get("id"),
            "nombre_apellido": profile_data.get("nombre_apellido"),
            "email": profile_data.get("email"),
            "rol": profile_data.get("rol"),
            "estado": profile_data.get("estado"),
        }
        return {
            "message": f"{rol_asignado.capitalize()} registrado correctamente. Revisá tu correo para verificar tu cuenta.",
            "socio": safe_profile,
        }'''

    if old_register_return in src:
        src = src.replace(old_register_return, new_register_return, 1)
        count += 1

    # Register comercio
    old_comercio_return = '''\
        return {
            "message": "Comercio registrado correctamente. Pendiente de aprobación por Admin.",
            "socio": profile_data,
        }'''

    new_comercio_return = '''\
        safe_profile_comercio = {
            "id": profile_data.get("id"),
            "nombre_apellido": profile_data.get("nombre_apellido"),
            "email": profile_data.get("email"),
            "rol": profile_data.get("rol"),
            "estado": profile_data.get("estado"),
        }
        return {
            "message": "Comercio registrado correctamente. Pendiente de aprobación por Admin.",
            "socio": safe_profile_comercio,
        }'''

    if old_comercio_return in src:
        src = src.replace(old_comercio_return, new_comercio_return, 1)
        count += 1

    return src, count


# ─────────────────────────────────────────────────────────────────────────────
# TRANSFORMACIÓN 3: Unificar mensajes de enumeración en login
# ─────────────────────────────────────────────────────────────────────────────
def unify_login_enum_messages(src: str) -> tuple[str, int]:
    count = 0

    replacements = [
        # DNI enumeration
        (
            'raise HTTPException(\n                    status_code=401, detail="Credenciales inválidas (DNI no encontrado)"\n                )',
            'raise HTTPException(\n                    status_code=401, detail="Credenciales inválidas"\n                )'
        ),
        (
            'detail="Credenciales inválidas (DNI no encontrado)"',
            'detail="Credenciales inválidas"'
        ),
        # Username enumeration
        (
            'detail="Credenciales inválidas (Usuario no encontrado)"',
            'detail="Credenciales inválidas"'
        ),
        # Error consultando DNI — puede revelar qué tipo de identificador falló
        (
            'raise HTTPException(status_code=500, detail="Error consultando DNI")',
            'raise HTTPException(status_code=401, detail="Credenciales inválidas")'
        ),
        (
            'raise HTTPException(status_code=500, detail="Error consultando Usuario")',
            'raise HTTPException(status_code=401, detail="Credenciales inválidas")'
        ),
    ]

    for old, new in replacements:
        if old in src:
            src = src.replace(old, new, 1)
            count += 1

    return src, count


# ─────────────────────────────────────────────────────────────────────────────
# TRANSFORMACIÓN 4: Hardening get_current_superadmin — evitar str(e) en detail
# ─────────────────────────────────────────────────────────────────────────────
def harden_superadmin_auth(src: str) -> tuple[str, int]:
    count = 0

    old = '''\
        raise HTTPException(
            status_code=401, detail=f"Error verificando permisos: {str(e)}"
        )'''
    new = '''\
        logger.error(f"[AUTH] Error verificando permisos SUPERADMIN: {str(e)}")
        raise HTTPException(
            status_code=401, detail="No autorizado"
        )'''
    if old in src:
        src = src.replace(old, new, 1)
        count += 1

    return src, count


# ─────────────────────────────────────────────────────────────────────────────
# TRANSFORMACIÓN 5: Reducir rate limit de /api/check-email (30 → 10/minute)
# ─────────────────────────────────────────────────────────────────────────────
def reduce_check_email_rate_limit(src: str) -> tuple[str, int]:
    count = 0
    old = '@app.get("/api/check-email")\n@limiter.limit("30/minute")'
    new = '@app.get("/api/check-email")\n@limiter.limit("10/minute")'
    if old in src:
        src = src.replace(old, new, 1)
        count += 1
    return src, count


# ─────────────────────────────────────────────────────────────────────────────
# TRANSFORMACIÓN 6: Eliminar exc_info=True (único caso en línea ~1008)
# ─────────────────────────────────────────────────────────────────────────────
def remove_exc_info(src: str) -> tuple[str, int]:
    count = 0
    old = 'logger.error(f"Error in register_comercio: {str(e)}", exc_info=True)'
    new = 'logger.error(f"[REGISTER_COMERCIO] Error interno procesando registro")'
    if old in src:
        src = src.replace(old, new, 1)
        count += 1
    return src, count


# ─────────────────────────────────────────────────────────────────────────────
# TRANSFORMACIÓN 7: Sanitizar detalles residuales que filtran info de tablas/DB
# ─────────────────────────────────────────────────────────────────────────────
def sanitize_db_info_leaks(src: str) -> tuple[str, int]:
    """
    Casos específicos que filtran nombres de operaciones internas
    pero que no cayeron en el patrón genérico de str(e).
    """
    count = 0

    specific_replacements = [
        # Login info leak
        (
            'raise HTTPException(status_code=400, detail="Identificador no válido")',
            'raise HTTPException(status_code=401, detail="Credenciales inválidas")'
        ),
        # Perfil no encontrado en login (no debe distinguirse del 401)
        (
            'raise HTTPException(\n                status_code=500, detail="Perfil no encontrado en base de datos"\n            )',
            'raise HTTPException(\n                status_code=401, detail="Credenciales inválidas"\n            )'
        ),
    ]

    for old, new in specific_replacements:
        if old in src:
            src = src.replace(old, new, 1)
            count += 1

    return src, count


# ─────────────────────────────────────────────────────────────────────────────
# MAIN
# ─────────────────────────────────────────────────────────────────────────────
def main():
    if not os.path.exists(BACKEND_FILE):
        print(f"[ERROR] No se encontró: {BACKEND_FILE}")
        return

    print(f"[INFO] Leyendo: {BACKEND_FILE}")
    original = load(BACKEND_FILE)

    # Backup
    backup(BACKEND_FILE, BACKUP_FILE)

    src = original
    total = 0

    print("\n[1/7] Sanitizando detail=str(e) en HTTPExceptions...")
    src, n = sanitize_str_e_in_details(src)
    print(f"      → {n} instancias reemplazadas")
    total += n

    print("[2/7] Eliminando tokens internos del response de registro...")
    src, n = strip_token_from_register_response(src)
    print(f"      → {n} instancias reemplazadas")
    total += n

    print("[3/7] Unificando mensajes de enumeración en login...")
    src, n = unify_login_enum_messages(src)
    print(f"      → {n} instancias reemplazadas")
    total += n

    print("[4/7] Hardening get_current_superadmin()...")
    src, n = harden_superadmin_auth(src)
    print(f"      → {n} instancias reemplazadas")
    total += n

    print("[5/7] Reduciendo rate limit de /api/check-email...")
    src, n = reduce_check_email_rate_limit(src)
    print(f"      → {n} instancias reemplazadas")
    total += n

    print("[6/7] Eliminando exc_info=True...")
    src, n = remove_exc_info(src)
    print(f"      → {n} instancias reemplazadas")
    total += n

    print("[7/7] Sanitizando leaks específicos de DB info...")
    src, n = sanitize_db_info_leaks(src)
    print(f"      → {n} instancias reemplazadas")
    total += n

    if src == original:
        print("\n[WARN] No se realizaron cambios. Verificar patrones manualmente.")
        return

    save(BACKEND_FILE, src)
    print(f"\n[OK] Hardening completado. Total de cambios: {total}")
    print(f"[OK] Archivo guardado: {BACKEND_FILE}")
    print(f"[OK] Backup disponible en: {BACKUP_FILE}")


if __name__ == "__main__":
    main()
