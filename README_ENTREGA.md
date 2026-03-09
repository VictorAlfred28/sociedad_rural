# Sociedad Rural Norte Corrientes - Sistema de Gestión

Este es el paquete oficial de entrega del sistema integral para la Sociedad Rural del Norte de Corrientes. El proyecto ha sido auditado técnicamente, optimizado en performance y asegurado bajo estándares de producción.

## 🚀 Arquitectura del Sistema
- **Frontend:** Single Page Application (SPA) construida con **React**, **Vite**, **TypeScript** y **Tailwind CSS**.
- **Backend:** API REST robusta construida con **FastAPI** (Python).
- **Base de Datos & Auth:** Gestionado íntegramente por **Supabase** (PostgreSQL).
- **Notificaciones:** Integración con **Firebase Cloud Messaging** para notificaciones Push.
- **WhatsApp:** Motor de chatbot e interacción vía **Evolution API**.

## 📂 Estructura del Paquete
- `/BACKEND`: Código fuente del servidor, documentación técnica (`DOCUMENTACION_SISTEMA.md`), reporte de auditoría y esquemas SQL.
- `/FRONTEND`: Código fuente de la interfaz de usuario, componentes y lógica de cliente.
- `database_full_schema.sql`: Script completo para replicar la estructura de la base de datos en Supabase.
- `database_erd.mermaid`: Diagrama de Entidad-Relación detallado.

## 🛠️ Instalación y Configuración

### 1. Base de Datos (Supabase)
1. Crear un nuevo proyecto en [Supabase](https://supabase.com).
2. Ejecutar el contenido de `BACKEND/database_full_schema.sql` en el SQL Editor de Supabase para crear las tablas y triggers.

### 2. Backend (FastAPI)
1. Entrar en la carpeta: `cd BACKEND`.
2. Crear un entorno virtual: `python -m venv .venv`.
3. Activar el entorno e instalar dependencias: `pip install -r requirements.txt`.
4. Configurar variables de entorno: Renombrar `.env.example` a `.env` y completar con sus credenciales de Supabase, Evolution API y Firebase.
5. Iniciar servidor: `uvicorn main:app --reload`.

### 3. Frontend (React)
1. Entrar en la carpeta: `cd FRONTEND`.
2. Instalar dependencias: `npm install`.
3. Configurar variables de entorno: Renombrar `.env.example` a `.env` y completar con la URL del Backend y las llaves de Supabase.
4. Iniciar aplicación: `npm run dev`.

## 📜 Documentación Adicional
Para más detalles técnicos, consulte:
- `BACKEND/DOCUMENTACION_SISTEMA.md`: Detalles de arquitectura y endpoints.
- `BACKEND/INFORME_AUDITORIA_FINAL.md`: Resumen de mejoras de seguridad y performance aplicadas.

---
**Desarrollado para la Sociedad Rural Norte Corrientes.**
Paquete preparado para despliegue productivo.
