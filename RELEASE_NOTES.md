# 🚀 Release Notes — v1.0.0-stable
## Sociedad Rural Del Norte De Corrientes
**Fecha de Release:** 2026-05-10  
**Commit Base:** `bb99e62`  
**Branch:** `main` → `release/v1.0.0-stable`

---

## 🔐 Autenticación y Sesiones

### Auto-Login Post-Registro
- El registro de nuevos socios retorna tokens JWT directamente desde el backend
- El usuario queda logueado automáticamente tras registrarse sin pasos adicionales
- Eliminados los estados de sesión corrupta (`Session from session_id claim does not exist`)

### Validación JWT al Montar la Aplicación
- `AuthContext` ahora valida el claim `exp` del JWT al iniciar la app
- Si el token está expirado al reabrir (Capacitor background), intenta refresh automático
- Fallback a logout seguro si el refresh_token también es inválido
- Elimina estados "semi-autenticados" que causaban 401 en endpoints protegidos

### Manejo Global de Errores 401
- Handler global `auth-unauthorized` escucha errores de sesión desde cualquier componente
- Limpieza completa de localStorage (token, socio, refresh_token, fcm tokens)
- Redirección automática a `/login` con mensaje amigable persistido en localStorage
- El Login muestra el error guardado sin tecnicismos al usuario

### Refresh Token Automático
- Timer de refresh programado 5 minutos antes del vencimiento del JWT
- El timer se cancela correctamente en logout (sin race conditions)
- Soporte completo para multi-tab (el 401 global detendrá la sesión en todos los tabs)

---

## 🔒 Hardening de Seguridad

### Supabase — Funciones RPC Admin
- `REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC, anon`
- `REVOKE EXECUTE ON FUNCTION public.is_admin_or_superadmin() FROM PUBLIC, anon`
- Verificado: `anon = false`, `authenticated = true`, `service_role = true`
- Los admins legítimos conservan acceso completo

### Firebase — Eliminación de Información Sensible
- Migración completa de todas las claves hardcodeadas a variables de entorno `VITE_FIREBASE_*`:
  - `VITE_FIREBASE_API_KEY`
  - `VITE_FIREBASE_AUTH_DOMAIN`
  - `VITE_FIREBASE_PROJECT_ID`
  - `VITE_FIREBASE_STORAGE_BUCKET`
  - `VITE_FIREBASE_MESSAGING_SENDER_ID`
  - `VITE_FIREBASE_APP_ID`
  - `VITE_FIREBASE_MEASUREMENT_ID`
  - `VITE_FIREBASE_VAPID_KEY`
- Validación de arranque con degradación graceful si faltan variables
- Todos los `console.log` de tokens FCM restringidos a entornos `DEV`

### Backend — Emails Hardcodeados
- `EMAILS_EXCLUIDOS_MORA` migrado de frozenset hardcodeado a `os.getenv("EMAILS_EXCLUIDOS_MORA", "")`
- Formato: lista CSV separada por comas
- Fallback seguro: set vacío (ningún usuario excluido por defecto)

---

## 📱 Mobile & Capacitor

### Dropdown de Notificaciones — Fix Responsive
- **Problema resuelto:** Panel de notificaciones aparecía cortado y fuera del viewport en mobile
- Implementado posicionamiento dinámico `position: fixed` con `getBoundingClientRect()`
- Cálculos automáticos de `safe-area` para notch/iPhone/Capacitor WebViews
- Re-cálculo automático ante eventos `resize` y `scroll`
- Márgenes seguros respetados en todos los tamaños de pantalla
- Compatible con Android, iOS WebView y PWA

---

## 🎨 Mejoras UX

### Toast Notifications
- Migración de alertas genéricas a `react-hot-toast` en flujos críticos
- Mensajes amigables diferenciados para errores de auth, registro y validación
- Sin tecnicismos expuestos al usuario final

### Validaciones de Formularios
- Validación de email duplicado en registro con mensaje específico
- Validación de contraseña con requisitos claros
- Estados de carga (loading) en botones de submit para evitar doble envío

### Registro de Socios
- Flujo robusto: validación → registro → auto-login → redirect al panel
- Socios (`SOCIO`) se aprueban automáticamente en el backend
- Mensajes de error por tipo: email existente, datos inválidos, error de servidor

---

## 🏗️ Infraestructura

### Build
- `npm run build` → `✓ built in 4.77s, 0 errores`
- Vite chunk splitting activo — 2207 módulos procesados
- TypeScript sin errores de compilación

### Variables de Entorno
- `.env.example` completamente documentado con instrucciones para cada variable
- Separación clara entre variables frontend (`VITE_*`) y backend

### Git
- Working tree limpio en `main`
- Historial de commits profesional con mensajes descriptivos
- Tags de versión creados y sincronizados con remote

---

## 📋 Checklist de Producción

- [x] Build sin errores TypeScript
- [x] Vite compilación exitosa (0 errores)
- [x] Git status limpio
- [x] Auth/JWT robusto con refresh automático
- [x] Auto-login post-registro sin errores
- [x] Manejo de 401 global con redirección segura
- [x] Dropdown notificaciones mobile corregido
- [x] Safe-area (notch/Capacitor) implementado
- [x] Validación server-side en backend (Pydantic)
- [x] CORS configurado correctamente
- [x] Service Key no expuesta al cliente
- [x] is_admin() bloqueada para anon ✅ VERIFIED
- [x] is_admin_or_superadmin() bloqueada para anon ✅ VERIFIED
- [x] Firebase keys en env vars
- [x] FCM token no logueado en producción
- [x] Email hardcodeado removido del backend
- [ ] Leaked Password Protection (Supabase Dashboard manual)
- [ ] VITE_FIREBASE_* vars configuradas en Vercel Dashboard

---

## ⚠️ Acciones Manuales Pendientes (Post-Deploy)

### 1. Supabase Dashboard — Password Protection
```
Authentication → Sign In / Up → Password security
→ "Check for leaked passwords with HaveIBeenPwned" → ON
```

### 2. Vercel — Environment Variables
Agregar en Vercel Dashboard → Settings → Environment Variables:
```
VITE_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN
VITE_FIREBASE_PROJECT_ID
VITE_FIREBASE_STORAGE_BUCKET
VITE_FIREBASE_MESSAGING_SENDER_ID
VITE_FIREBASE_APP_ID
VITE_FIREBASE_MEASUREMENT_ID
VITE_FIREBASE_VAPID_KEY
```

### 3. Backend .env — Variable de Exclusión
Si se requiere excluir emails de mora, agregar en el `.env` del backend:
```
EMAILS_EXCLUIDOS_MORA=email1@dominio.com,email2@dominio.com
```

---

## 🔄 Commits Incluidos en esta Release

| Hash | Descripción |
|---|---|
| `bb99e62` | security(hardening): apply production auth and Supabase security fixes |
| `7c9ebb4` | security: audit fixes - revoke anon exec, token expiry check, remove fcm log leak |
| `7bbeb53` | fix(mobile-notifications): resolve responsive dropdown clipping |
| `9784f43` | fix: stable student upload + admin labels + negocio image improvements |
| `c538581` | cleanup: remove admin simulation tools and dead code |
| `4d6a53c` | release: stable payments refactor and camera removal |
| `b3f8e26` | build: ios pwa support and final optimizations |
| `42ca72f` | security hardening final backend |

---

*Sociedad Rural Del Norte De Corrientes — Sistema de Gestión v1.0.0-stable*
