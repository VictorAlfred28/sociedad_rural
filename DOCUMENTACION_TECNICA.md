# Documentación Técnica del Sistema: Sociedad Rural Norte Corrientes

## 1. Arquitectura General
El sistema está construido siguiendo una arquitectura Cliente-Servidor separada en dos repositorios/carpetas principales:
- **Frontend**: SPA desarrollada en React con Vite y empaquetada como aplicación móvil/web mediante Capacitor. Estilado con Tailwind CSS.
- **Backend**: API REST monolítica desarrollada en Python utilizando FastAPI.
- **Base de Datos**: PostgreSQL alojado en Supabase, utilizando RLS (Row Level Security) y Supabase Storage para almacenamiento de archivos (imágenes, PDFs).
- **Servicios Cloud**: Firebase Admin SDK (para notificaciones push), Evolution API (para integración con WhatsApp).

## 2. Descripción de Módulos

### 2.1 Backend (`main.py`)
- **Autenticación (Auth)**: Gestión de tokens JWT, login, registro y recuperación de contraseñas. Integrado con Supabase Auth.
- **Gestión de Perfiles y Roles**: Administra Socios, Comercios y Administradores. Diferencia permisos basados en la tabla `user_roles`.
- **Cobranza Digital**: Procesa validaciones de pago, generación de recibos en formato PDF (ReportLab) y recordatorios automáticos por mora (APScheduler).
- **Eventos**: Creación de eventos manuales y sincronización de eventos sociales a través de webhooks.
- **Notificaciones**: Motor unificado para el envío de alertas Push (Firebase) y WhatsApp.
- **Auditoría**: Registro automático de todas las operaciones administrativas críticas en la tabla `auditoria_logs`.

### 2.2 Frontend (`FRONTEND/src`)
- **App/Main**: Puntos de entrada y configuración de Capacitor.
- **Pages**: Contiene las vistas principales (Home, Cuotas, Promociones, Perfil, ValidacionPagos).
- **Componentes**: Módulos de UI reutilizables (Chatbot, Navbars).
- **Context**: Contextos globales de React (AuthContext) para estado de autenticación.

## 3. Listado de Endpoints API (Principales)

**Autenticación y Usuarios**
- `POST /api/register` : Registra a un nuevo usuario (Socio).
- `POST /api/register/comercio` : Registra a un nuevo comercio.
- `POST /api/login` : Autentica usuarios (por DNI/Username/Email) y retorna token.
- `PUT /api/perfil` : Actualiza la información del perfil del usuario logueado.

**Gestión de Administradores**
- `GET /api/admin/users/pending` : Obtiene los usuarios pendientes de aprobación.
- `POST /api/admin/users/{user_id}/approve` : Aprueba a un nuevo socio/comercio.
- `GET /api/admin/auditoria` : Retorna el historial de auditoría de las acciones del sistema.

**Pagos y Cuotas**
- `GET /api/mis-pagos` : Lista el historial de pagos del usuario logueado.
- `POST /api/pagos/subir-comprobante` : Sube un comprobante de pago al Storage y marca el pago como PENDIENTE_VALIDACION.
- `GET /api/admin/pagos/pendientes` : Lista comprobantes subidos pendientes de validación por un administrador.
- `POST /api/admin/pagos/aprobar` : El administrador aprueba el pago, genera un recibo en PDF y notifica al usuario por WhatsApp.
- `POST /api/admin/pagos/rechazar` : Rechaza un comprobante indicando el motivo.
- `POST /api/admin/procesar-rendicion-bc` : Procesa archivo TXT del Banco de Corrientes para conciliación bancaria.

**Eventos**
- `GET /api/eventos` : Obtiene el feed de eventos disponibles.
- `POST /api/admin/eventos` : Crea un evento en el sistema.

**Notificaciones**
- `POST /api/push-tokens` : Registra un token de Firebase para un usuario.
- `POST /api/admin/test-whatsapp` : Endpoint administrativo para probar la conexión con Evolution API.

## 4. Descripción de Modelos de Datos

El esquema se encuentra definido en `database_full_schema.sql` y utiliza las siguientes tablas principales:
- **auth.users**: Tabla interna de Supabase que maneja credenciales y hashing de contraseñas.
- **public.profiles**: Tabla central. Mapea 1-a-1 con `auth.users`. Almacena datos como DNI, teléfono, estado y tipo (Socio, Comercio).
- **public.roles** y **public.user_roles**: Implementa un sistema de control de acceso basado en roles (SUPERADMIN, ADMIN, SOCIO).
- **public.comercios**: Extensión de `profiles` para entidades de tipo comercio.
- **public.ofertas**: Promociones exclusivas creadas por los comercios.
- **public.pagos_cuotas**: Gestión de deuda, vencimientos e historial de pagos. Relaciona al socio con un monto y estado de pago.
- **public.eventos**: Agenda de actividades de la Sociedad Rural.
- **public.auditoria_logs**: Registro inmutable de acciones en el sistema. Incluye usuario responsable, IP, tabla afectada y payload modificado.

## 5. Flujos Principales del Sistema

### 5.1 Flujo de Registro y Aprobación
1. El usuario completa el formulario en la web o app (`/api/register`).
2. Se crea la cuenta en `auth.users` y en `public.profiles` con estado `PENDIENTE`.
3. El administrador revisa el perfil en el panel y lo aprueba.
4. El sistema notifica al usuario (vía Push/WhatsApp) que su cuenta fue activada.

### 5.2 Flujo de Pago de Cuotas
1. El motor automático (APScheduler) evalúa deudas el día 11 de cada mes.
2. Si se detecta mora, se inserta una deuda en `pagos_cuotas` y se notifica vía WhatsApp.
3. El socio entra a la app y sube una transferencia bancaria (`/api/pagos/subir-comprobante`).
4. El administrador recibe el comprobante en su bandeja y lo valida (`/api/admin/pagos/aprobar`).
5. El sistema marca la cuota como pagada, genera un recibo oficial PDF (usando ReportLab) y lo envía al socio.

### 5.3 Flujo de Beneficios y QR
1. El socio logueado y al día genera un token QR temporal en la app.
2. El socio exhibe el QR en un comercio adherido.
3. El comercio escanea el QR, y el sistema valida criptográficamente que el socio está `APROBADO` y al día, garantizando la promoción.
