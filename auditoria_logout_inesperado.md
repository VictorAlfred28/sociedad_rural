# Informe de Auditoría y Diagnóstico: Logout Inesperado

## A. RESUMEN EJECUTIVO
**Causa encontrada:** La aplicación sufre una condición de carrera (race condition) entre los temporizadores de fondo (sleep/wake) del navegador y las peticiones en segundo plano que los componentes ejecutan al reanudar el uso. Cuando el JWT provisto por Supabase caduca (tiempo de vida típico 1h) y el dispositivo del usuario ha estado suspendido, el `setTimeout` encargado de renovarlo silenciosamente no se dispara a tiempo. 
Cualquier acción del usuario o *polling* automático (como notificaciones) dispara una petición con el token vencido, recibiendo un error HTTP 401 del backend. El frontend interceptaba este error disparando globalmente el evento `auth-unauthorized`, el cual **forzaba el borrado inmediato de la sesión (`doLogout()`)** y redirigía al login, sin intentar utilizar el `refresh_token` disponible.
**Impacto:** Alto. Perjudica severamente la UX ya que el usuario pierde su progreso y se desloguea de la plataforma en pleno uso tras un lapso de inactividad, siendo esto un fallo crítico de retención de sesión.
**Gravedad:** Crítica, pero el arreglo es simple y circunscrito a un solo archivo del frontend, sin riesgos estructurales.

## B. ARCHIVOS AFECTADOS
- `FRONTEND/src/context/AuthContext.tsx` (Manejo del estado de sesión y renovación de token).
- Componentes que sufren el impacto (no requirieron modificación directa): `NotificationBell.tsx`, `MiNegocio.tsx`, `GestionDependientes.tsx`, `Perfil.tsx`, `AdminDashboard.tsx`.

## C. FLUJO TÉCNICO EXPLICADO
1. El usuario se loguea y recibe un `access_token` y un `refresh_token` de Supabase.
2. `AuthContext.tsx` programa un `setTimeout` para renovar el token 5 minutos antes de su vencimiento.
3. El dispositivo entra en modo suspensión, o la pestaña queda inactiva, congelando el reloj del `setTimeout`.
4. El token expira oficialmente en el backend.
5. El dispositivo se despierta. Antes de que el `setTimeout` reaccione o termine de procesar el refresco, un componente realiza una petición HTTP (`fetch`).
6. El backend (`FastAPI` -> `get_current_user()`) rechaza el token con un `401 Unauthorized`.
7. El componente captura el `401` y emite `window.dispatchEvent(new Event('auth-unauthorized'))`.
8. `AuthContext` escucha el evento y ejecuta `doLogout()`, destruyendo las variables del Storage y enviando al usuario a `/login` **antes de siquiera intentar renovar su credencial**.

## D. RIESGOS MITIGADOS
- **Riesgo de bucle infinito (mitigado):** Al intentar renovar tras un 401, existe riesgo de entrar en un bucle si el refresh también devuelve 401. Esto fue controlado utilizando el flag/ref `isRefreshingRef` para asegurar que ocurra un único intento. Si el intento falla, la sesión muere de forma segura.
- **Race conditions con Supabase (mitigado):** Si varios componentes reciben el 401 al mismo tiempo y envían múltiples eventos `auth-unauthorized`, el sistema intentaría refrescar el token múltiples veces, invalidando la cadena de rotación de Supabase. El `isRefreshingRef` asegura una transición thread-safe (único hilo de ejecución en el browser).

## E. FIX PROPUESTO (Ya aplicado)
Se modificó `AuthContext.tsx` con un enfoque **minimalista y conservador**:
1. Agregado de una bandera `isRefreshingRef = useRef(false)` para evitar llamadas concurrentes a `performRefresh`.
2. `performRefresh` ahora retorna un `Promise<boolean>` indicando si el refresco de la sesión fue exitoso o fallido.
3. El manejador `handleUnauthorized` fue convertido a una función asíncrona. En lugar de ejecutar `doLogout()` directamente, primero busca el `refresh_token` en `localStorage` e intenta llamar a `performRefresh()`.
4. Sólo en caso de que el `performRefresh()` fracase de forma irrecuperable (o si el lock estaba activo y se ignora el evento adicional), la aplicación procederá a borrar la sesión y enviar al login.

## F. PATCHES (Diff aplicado a `AuthContext.tsx`)
```diff
--- FRONTEND/src/context/AuthContext.tsx
+++ FRONTEND/src/context/AuthContext.tsx
@@ -58,8 +58,11 @@
     const [token, setToken] = useState<string | null>(null);
     const [isLoading, setIsLoading] = useState(true);
     const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
-
-    const performRefresh = async (refreshToken: string) => {
+    const isRefreshingRef = useRef(false);
+
+    const performRefresh = async (refreshToken: string): Promise<boolean> => {
+        if (isRefreshingRef.current) return false;
+        isRefreshingRef.current = true;
         try {
             const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
             const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
@@ -66,4 +66,4 @@
-            if (!SUPABASE_URL || !SUPABASE_KEY) return;
+            if (!SUPABASE_URL || !SUPABASE_KEY) return false;
 
             const resp = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
                 method: 'POST',
@@ -76,7 +76,7 @@
             if (!resp.ok) {
                 // Refresh falló (sesión revocada), hacer logout
                 doLogout();
-                return;
+                return false;
             }
 
             const data = await resp.json();
@@ -86,10 +86,14 @@
                     localStorage.setItem('refresh_token', data.refresh_token);
                     scheduleTokenRefresh(data.access_token, data.refresh_token);
                 }
+                return true;
             }
         } catch (err) {
             console.error('Error renovando token:', err);
-        }
+        } finally {
+            isRefreshingRef.current = false;
+        }
+        return false;
     };
 
@@ -165,7 +165,19 @@
         initAuth();
 
         // Listener para errores 401 globales (Token expirado o inválido)
-        const handleUnauthorized = () => {
+        const handleUnauthorized = async () => {
+            if (isRefreshingRef.current) return;
+            
+            const currentRefreshToken = localStorage.getItem('refresh_token');
+            if (currentRefreshToken) {
+                console.warn("Recibido 401. Intentando renovar sesión...");
+                const success = await performRefresh(currentRefreshToken);
+                if (success) {
+                    console.log("Sesión recuperada exitosamente tras 401.");
+                    return;
+                }
+            }
+            
             console.warn("Sesión expirada o no autorizada. Redirigiendo...");
             doLogout();
```

## G. VALIDACIÓN
Pasos para comprobar la estabilidad del fix sin alterar producción de forma riesgosa:
1. **Pérdida forzada simulada**: 
   - Abrir la App, hacer Login. 
   - Ir a la solapa *Application* en las DevTools y eliminar manualmente la key `token` de `localStorage` (dejando `refresh_token` intacto). 
   - Navegar entre páginas. La App recibirá un 401, detectará la anomalía, renegociará la sesión recuperando el token, y el usuario no notará la expulsión.
2. **Multitabs**: Abrir dos pestañas. Forzar la misma acción en ambas pestañas simultáneamente. La consola mostrará que solo un proceso toma el Lock (`isRefreshingRef`) evitando colisiones HTTP de actualización en Supabase Auth.
3. **Expiración Natural Real**: Dejar la aplicación inactiva por más de 1 hora, o con el equipo suspendido. Al despertar el equipo y clickear cualquier menú, la App lanzará advertencia en consola (recibiendo 401), pero la sesión se renovará y se mantendrá persistente gracias al rescate del evento `auth-unauthorized`.
4. **Invalidación total (Logout correcto)**: Eliminar el `refresh_token` y el `token` del storage. Al navegar, la aplicación nos debe redirigir al login al no poseer manera algorítmica de refrescar la credencial (Comportamiento esperado).
