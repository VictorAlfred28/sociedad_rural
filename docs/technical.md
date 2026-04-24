# 🏗️ Sociedad Rural Norte Corrientes - Documentación Técnica

Esta documentación está orientada a desarrolladores y administradores de sistemas responsables del despliegue, mantenimiento y escalabilidad de la aplicación.

## 1. Arquitectura del Sistema

El sistema utiliza una arquitectura de cliente-servidor, con clientes web/móviles interactuando con una API RESTful centralizada, y delegando la persistencia y autenticación de usuarios a Supabase.

### 1.1 Tecnologías Utilizadas

- **Frontend / Móvil**: React 19, TypeScript, Vite, Zustand, React Query, Tailwind CSS 4, HTML5-QRCode, Capacitor 8 (Push Notifications, Network, Geolocation, Camera).
- **Backend**: Python 3.11, FastAPI, OpenAI GPT-4o (Chatbot IA), MercadoPago SDK.
- **Base de Datos / Backend-as-a-Service**: Supabase (PostgreSQL 17, Storage, Auth, Edge Functions, Row Level Security).
- **Despliegue (VPS)**: Docker, Docker Compose, Nginx.
- **Integraciones**: Mercado Pago API, Evolution API (WhatsApp), Make.com (Webhooks), Firebase Cloud Messaging.

### 1.2 Estructura del Repositorio

El proyecto final ha sido configurado bajo el modelo Monorepo:
```
/proyecto-produccion
 ├── backend/                 # API FastAPI (Python)
 ├── frontend/                # SPA Web React (TypeScript)
 │    └── android/            # Directorio Capacitor nativo para compilación de APK/AAB
 ├── docs/                    # Documentación
 ├── scripts/                 # Scripts bash de instalación de VPS
 ├── docker-compose.yml       # Orquestación de entorno de producción
 ├── .env.example             # Variables de entorno globales requeridas
 └── README.md
```

## 2. Guía de Despliegue en VPS (Producción Web)

El despliegue está contenerizado para garantizar paridad de entornos. Recomendamos Ubuntu 22.04 LTS o 24.04 LTS.

### 2.1 Requisitos Previos en VPS
- Servidor Linux (recomendado 2 vCPUs, 4GB RAM)
- Dominio apuntando a la IP del VPS (ej. api.sociedadrural.com para backend y app.sociedadrural.com para frontend)

### 2.2 Instalación Paso a Paso

1. Clonar o subir el paquete comprimido `proyecto-produccion.zip` al VPS y descomprimir:
   ```bash
   unzip proyecto-produccion.zip -d /var/www/sociedad_rural
   cd /var/www/sociedad_rural
   ```
2. Ejecutar el script de instalación (instala dependencias base y Docker):
   ```bash
   chmod +x scripts/install.sh
   ./scripts/install.sh
   ```
3. Configurar variables de entorno:
   Deberás editar dos archivos generados a partir de los templates:
   - `backend/.env` (Contiene `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, Tokens de MercadoPago y OpenAI).
   - `frontend/.env.production` (Contiene `VITE_API_URL` apuntando a tu dominio).
4. Levantar la infraestructura:
   ```bash
   chmod +x scripts/start.sh
   ./scripts/start.sh
   ```

El frontend estará corriendo en el puerto 80 del VPS (Nginx interno de Docker), y el backend en el puerto 8000. Recomendamos configurar un Proxy Inverso adicional (ej. Nginx Proxy Manager o Traefik) con certificados SSL apuntando a estos contenedores.

## 3. Uso y Compilación en Capacitor (Android App)

La aplicación web ha sido refactorizada para poder compilarse como App Nativa Android. El directorio `android` se encuentra mapeado correctamente dentro de `/frontend`.

### 3.1 Detección automática del entorno
El frontend utiliza la variable `VITE_API_URL` que en desarrollo se resuelve a localhost.
En producción o app móvil, el fetch resolverá de forma absoluta contra la URL productiva del servidor evitando problemas CORS o fallos "Failed to fetch".

### 3.2 Construcción y Compilación Android

1. Instalar dependencias en la carpeta frontend:
   ```bash
   cd frontend
   npm install
   ```
2. Generar compilación optimizada (inyecta variables de entorno productivas):
   ```bash
   npm run build
   ```
3. Sincronizar activos web en la carpeta nativa Android:
   ```bash
   npx cap sync android
   ```
4. Abrir en Android Studio (Para firma manual y deploy):
   ```bash
   npx cap open android
   ```

Dentro de Android Studio se puede generar el App Bundle Signado (AAB) requerido para publicar en **Google Play Store**. Los iconos y splashscreens han sido optimizados e integrados.

## 4. Estructura de Base de Datos y Supabase

El esquema SQL oficial está contenido en `backend/database_schema_v4_complete.sql`.
* **Profiles**: Manejo RBAC (Socios, Admin, Cámara, Comercio). Control manual y automatizado.
* **RLS (Row Level Security)**: Habilitado por defecto en todas las tablas sensibles. Solo usuarios autenticados acceden a su información, mientras que los Admins poseen políticas exentas (vía API Service Role).
* **Triggers**: Automatización de generación de identificadores `numero_socio` secuencial para nuevos miembros aprobados.

## 5. Consideraciones de Seguridad
- Nunca exponer la `SUPABASE_SERVICE_ROLE_KEY` del backend en entornos cliente (Frontend).
- Asegurarse de que el bucket de Storage de perfiles en Supabase tenga las políticas de protección adecuadas para prevenir escritura maliciosa.
- Todas las peticiones fetch de Capacitor originan en un protocolo seguro `https://` o scheme `capacitor://localhost` (según config). Para evitar problemas de CORS, el servidor FastAPI permite el Origen en su middleware de configuración global.
