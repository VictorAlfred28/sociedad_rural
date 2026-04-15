# GUÍA DE DESPLIEGUE - SOCIEDAD RURAL DEL NORTE CORRIENTES

Este documento describe los pasos para poner el sistema en producción y realizar su venta.

## 1. Estructura del Proyecto
- `BACKEND/`: Servidor API en Python (FastAPI).
- `FRONTEND/`: Aplicación Web en React + Vite.
- `scripts/`: Herramientas para backup y migración de datos.
- `LICENSE`: Licencia de propiedad exclusiva de Victor Alfredo Torrilla.

## 2. Requerimientos
- Python 3.10+
- Node.js 18+
- Docker y Docker Compose (Recomendado para producción)
- Cuenta en Supabase

## 3. Configuración de Base de Datos (Supabase)
1. Crea un nuevo proyecto en Supabase.
2. Ejecuta los scripts SQL en el siguiente orden desde el SQL Editor:
   - `BACKEND/database_full_schema_v2.sql` (Esquema principal)
   - `BACKEND/setup_localidades.sql` (Municipios autorizados)
   - `BACKEND/setup_rls_policies.sql` (Seguridad RLS)
   - `BACKEND/add_social_columns.sql` (Nuevas columnas de redes sociales)

3. Configura los **Storage Buckets**:
   - `business-logos` (Público)
   - `member-documents` (Privado)

## 4. Variables de Entorno (.env)
Asegúrate de configurar los archivos `.env` en las carpetas correspondiente:
- **Backend**: Usa `BACKEND/.env` como plantilla.
- **Frontend**: Usa `FRONTEND/.env` como plantilla.

## 5. despliegue con Docker
Accede a la raíz del proyecto y ejecuta:
```bash
docker-compose up --build -d
```

## 6. Backup y Mantenimiento
Para exportar los datos actuales a archivos JSON (útil para migraciones o respaldo):
```bash
cd scripts
python export_data.py
```
Los archivos se guardarán en la carpeta `scripts/backup/`.

---
Sistema desarrollado y empaquetado por Antigravity AI.
Propiedad de Victor Alfredo Torrilla.
