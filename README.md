# 🌾 Sociedad Rural - Plataforma Integral
  
Sistema modular para la gestión integral de socios, comercios adheridos, credenciales digitales, pagos, notificaciones y eventos, diseñado específicamente para la Sociedad Rural Norte Corrientes. Construido con arquitectura robusta y escalable lista para producción comercial web y móvil.

---

## 🛠️ Tecnologías Utilizadas

- **Frontend**: React + Vite + TypeScript + TailwindCSS.
- **Móvil**: Capacitor (Android nativo).
- **Backend**: FastAPI (Python 3.11).
- **Base de Datos**: Supabase (PostgreSQL).
- **Infraestructura**: Docker + Nginx.

---

## 🚀 Despliegue en VPS (Recomendado con Docker)

La forma más rápida y segura de desplegar es mediante **Docker Compose**, ya que configura automáticamente el servidor Nginx para servir el frontend y el proxy inverso para el backend.

1. **Clonar el repositorio**:
   ```bash
   git clone https://github.com/VictorAlfred28/sociedad_rural.git
   cd sociedad_rural
   ```
2. **Configurar Entorno**:
   - Copia `.env.example` a `.env` en la raíz.
   - Ajusta las credenciales de Supabase y las URLs de los dominios.
3. **Instalación y Arranque**:
   ```bash
   chmod +x scripts/*.sh
   ./scripts/install.sh
   docker-compose up -d --build
   ```

---

## 🌐 Despliegue Manual (Frontend - Nginx)

Si prefieres servir el frontend sin Docker:

1. **Construir el proyecto localmente**:
   ```bash
   cd FRONTEND
   npm install
   npm run build
   ```
2. **Subir archivos**:
   - Sube el contenido de la carpeta `FRONTEND/dist/` a tu servidor VPS (ej: `/var/www/sociedad-rural`).
3. **Configurar Nginx**:
   Crea un archivo de configuración en `/etc/nginx/sites-available/sociedad-rural`:
   ```nginx
   server {
       listen 80;
       server_name tu-dominio.com;
       root /var/www/sociedad-rural;
       index index.html;

       location / {
           try_files $uri $uri/ /index.html;
       }
   }
   ```
4. **Reiniciar Nginx**: `sudo systemctl restart nginx`.

---

## 📱 Compilación Android (Capacitor)

Para generar la versión móvil:

1. **Preparar Build**:
   ```bash
   cd FRONTEND
   npm install
   npm run build
   npx cap sync android
   ```
2. **Firma y Generación**:
   - Abre el proyecto en **Android Studio**: `npx cap open android`.
   - Genera el APK/AAB firmado desde el menú `Build > Generate Signed Bundle / APK`.
   - *Nota*: Asegúrate de que las `<queries>` en `AndroidManifest.xml` estén presentes para que la redirección a billeteras funcione correctamente.

---

## 📚 Documentación Adjunta

- **Guía Técnica**: `/docs/technical.md`
- **Manual de Usuario**: `/docs/user_manual.md`

---

## 🛠️ Comandos de Mantenimiento

- `docker-compose logs -f`: Ver registros del servidor.
- `docker-compose down`: Apagar la plataforma.
- `git pull origin main && docker-compose up -d --build`: Actualizar sistema.
