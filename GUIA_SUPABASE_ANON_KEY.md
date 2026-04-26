# 🔑 Guía: Obtener SUPABASE_ANON_KEY

## ¿POR QUÉ ES REQUERIDA?

Tu archivo `.env` actual está **incompleto**. Falta la `SUPABASE_ANON_KEY`, que es **requerida para que el login funcione**.

### Diferencia entre las claves:

| Clave | Uso | Seguridad |
|-------|-----|----------|
| `SUPABASE_SERVICE_ROLE_KEY` | Backend (operaciones admin) | ⚠️ PRIVADA - Nunca exponer |
| `SUPABASE_ANON_KEY` | Frontend + Login Backend | ✅ Pública - Se puede compartir |

---

## 📍 PASO 1: Ir a Supabase

1. Abre https://app.supabase.com
2. Selecciona tu proyecto: **"sociedad-rural-norte"**

---

## 📍 PASO 2: Obtener ANON_KEY

1. Ve a **Settings → API** (izquierda)
2. Copia el valor de **"anon public"** (la clave corta)
3. **NO uses "service_role" aquí** - eso es la SERVICE_ROLE_KEY que ya tienes

```
Tu proyecto: https://jeeurezcswuchpzwgfno.supabase.co

Deberías ver algo como:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔓 anon (public)
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFz... ← COPIA ESTO

🔐 service_role (secret)
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFz... ← YA LO TIENES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## 📍 PASO 3: Agregar a tu `.env`

Actualiza tu archivo `BACKEND/.env`:

```bash
SUPABASE_URL="https://jeeurezcswuchpzwgfno.supabase.co"
SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."  # Ya tienes
SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."  # ← NUEVA - Copia del paso 2
```

---

## ⚠️ IMPORTANTE - SEGURIDAD

✅ **ANON_KEY**: Puedes compartirla (usarla en frontend)  
❌ **SERVICE_ROLE_KEY**: NUNCA compartir - es privada  
❌ **FIREBASE_PRIVATE_KEY**: NUNCA compartir - es privada  

---

## 🧪 VALIDAR QUE FUNCIONE

Después de agregar la `ANON_KEY` a tu `.env`:

```bash
# Reinicia el backend
docker-compose restart backend

# Verifica que NO hay errores de "SUPABASE_ANON_KEY no configurada"
docker-compose logs backend | grep -i "supabase\|anon\|error"
```

---

## ❌ ERRORES COMUNES

### Error: "SUPABASE_ANON_KEY no configurada"
✅ Solución: Agregaste un valor vacío `SUPABASE_ANON_KEY=""`
→ Obtén el valor correcto de Supabase Settings → API

### Error: "Invalid login credentials"
⚠️ Puede ser varias cosas:
1. Contraseña incorrecta
2. Usuario no existe
3. ANON_KEY inválida/expirada
→ Verifica credenciales de usuario

### Error: "Token expirado"
✅ Normal - el JWT tiene un tiempo de vida
→ El frontend debe hacer refresh automático con `refresh_token`

---

## 📞 VERIFICACIÓN MANUAL (cURL)

```bash
# 1. Test login
curl -X POST http://localhost:8000/api/login \
  -H "Content-Type: application/json" \
  -d '{
    "identificador": "usuario@ejemplo.com",
    "password": "tu_contraseña"
  }'

# Deberías obtener un response con "token"
```

---

## ✅ CHECKLIST

- [ ] Copié ANON_KEY de Supabase Settings → API (anon public)
- [ ] Agregué a `BACKEND/.env` → `SUPABASE_ANON_KEY="..."`
- [ ] Reinicié backend → `docker-compose restart backend`
- [ ] No hay errores en logs → `docker-compose logs backend`
- [ ] Login funciona en /api/login

---

**Nota**: Una vez que agregues la ANON_KEY, el sistema debería funcionar correctamente. Si persisten errores, revisa los logs del backend.
