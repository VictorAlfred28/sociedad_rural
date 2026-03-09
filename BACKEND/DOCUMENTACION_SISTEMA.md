# Documentación Técnica del Sistema: Sociedad Rural Norte Corrientes

## 1. Arquitectura General
El sistema está compuesto por un backend monolítico en Python (FastAPI) y un frontend en React (Vite). La persistencia de datos y autenticación se gestionan a través de Supabase.

### 1.1 Backend (Python / FastAPI)
- **Archivo principal:** `BACKEND/main.py`.
- **Framework:** FastAPI.
- **Base de Datos:** Supabase (PostgreSQL).
- **Notificaciones Push:** Firebase Admin SDK.
- **WhatsApp:** Integración con Evolution API.
- **Tareas Programadas:** APScheduler (Tareas de mora el día 11 de cada mes).

### 1.2 Frontend (React / Vite)
- **Framework:** React con Vite.
- **Estilos:** Tailwind CSS.
- **Manejo de Estado:** Hooks de React (Context/State).
- **Autofilling / QR:** Integración con `html5-qrcode`.

## 2. Modelo de Datos
La base de datos utiliza PostgreSQL. Los perfiles de usuarios se centralizan en la tabla `public.profiles`, la cual se sincroniza con `auth.users` de Supabase.

### Tablas Principales:
- `profiles`: Usuarios (Socios, Comercios, Cámaras, Admins, Dependientes).
- `ofertas`: Promociones y beneficios.
- `pagos_cuotas`: Gestión de deudas y pagos.
- `eventos` / `eventos_sociales`: Agenda institucional y de redes sociales.
- `auditoria_logs`: Registro histórico de acciones administrativas.

## 3. Seguridad
- **Autenticación:** JWT vía Supabase Auth.
- **Autorización:** Roles definidos en la tabla `profiles` (`ADMIN`, `SOCIO`, `COMERCIO`, `CAMARA`).
- **Webhooks:** Protegidos por `X-Webhook-Token` (Importación) y `webhook-secret` (WhatsApp).
- **CORS:** Restringido a dominios conocidos y localhost para desarrollo.

## 4. Recomendaciones de Arquitectura (Post-Audit)
1. **Modularización:** Se recomienda dividir `main.py` en múltiples archivos (Ej: `routers/auth.py`, `routers/ofertas.py`, `services/whatsapp_service.py`) para mejorar la mantenibilidad.
2. **Validación de Datos:** Implementar esquemas de Pydantic más estrictos para todos los endpoints.
3. **Escalabilidad de Tareas:** Para un volumen masivo de socios, se recomienda migrar de APScheduler en memoria a un sistema basado en colas (Redis/Celery) o Supabase Edge Functions con CRON.
4. **Almacenamiento:** Centralizar la gestión de imágenes en Supabase Storage mediante políticas RLS.

## 5. Contacto Técnico
- **Propietario:** Sociedad Rural del Norte de Corrientes.
- **Desarrollo:** Agentech.
