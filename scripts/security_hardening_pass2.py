"""
Segunda pasada: captura patrones multilínea residuales donde
raise HTTPException(
    status_code=NNN, detail=f"...: {str(e)}"
)
"""
import re, os, sys

BACKEND_FILE = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "BACKEND", "main.py")

def load(p):
    with open(p, "r", encoding="utf-8") as f:
        return f.read()

def save(p, c):
    with open(p, "w", encoding="utf-8") as f:
        f.write(c)

src = load(BACKEND_FILE)
original = src

# Patrón: raise HTTPException(\n        status_code=NNN, detail=f"...{str(e)}"\n    )
# La parte de detail está en la MISMA línea que status_code (una sola línea con la coma)
pattern = re.compile(
    r'(raise HTTPException\(\s*\n\s*status_code\s*=\s*\d+,\s*)detail\s*=\s*f"[^"]*\{(?:str\(e\)|e)\}"',
    re.MULTILINE
)

def replacer(m):
    return m.group(1) + 'detail="Error interno del servidor"'

result, count = pattern.subn(replacer, src)

# Segunda variante: detail en línea separada del status_code
pattern2 = re.compile(
    r'(raise HTTPException\(\s*\n\s*status_code\s*=\s*\d+,\s*\n\s*)detail\s*=\s*f"[^"]*\{(?:str\(e\)|e)\}"',
    re.MULTILINE
)
result2, count2 = pattern2.subn(replacer, result)

total = count + count2
if total > 0:
    save(BACKEND_FILE, result2)
    print(f"[OK] Segunda pasada: {total} instancias adicionales reemplazadas.")
else:
    print("[WARN] No se encontraron instancias adicionales con el patron multilínea.")

# Verificar cuántos quedan
remaining = re.findall(r'detail\s*=\s*f"[^"]*\{(?:str\(e\)|e)\}"', result2)
print(f"[CHECK] Instancias residuales restantes: {len(remaining)}")
for r in remaining:
    print(f"  -> {r[:80]}")
