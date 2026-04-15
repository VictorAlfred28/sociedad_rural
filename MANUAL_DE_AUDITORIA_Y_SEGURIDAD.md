# Manual de Auditoría y Seguridad - Nivel Enterprise

## 1. Protocolos de Seguridad Implementados

El sistema implementa el top 10 de recomendaciones OWASP y controles propios basados en la arquitectura Supabase + FastAPI.

### 1.1 Autenticación y Autorización (Broken Access Control Mitigation)
- **Token Based Auth:** Toda interacción se realiza a través de JWT (JSON Web Tokens) generados por Supabase Auth.
- **RLS (Row Level Security):** El PostgreSQL subyacente obliga la evaluación de pertenencia. Un usuario **nunca** podrá extraer la base de datos de otros perfiles debido al RLS activo bajo la condición `auth.uid() = user_id`.
- **Ausencia de Backdoors:** Las versiones de producción están sanitizadas sin credenciales de rescate (*hardcoded*), toda provisión administrativa debe ocurrir alterando los roles en la base de datos central.

### 1.2 Prevención de Abusos (Rate Limiting)
- Regulado mediante `SlowAPI` a nivel proxy FastAPI.
- El ingreso al Login tolera un máximo de **5 intentos por minuto** para sofocar ataques de fuerza bruta.
- Los registros se acotan a **10 por minuto** por IP.

### 1.3 CORS Estricto
La comunicación está limitada por Origin (`allow_origins`), imposibilitando ataques de suplantación desde otros dominios.

### 1.4 QR Dinámico (Prevención Anti-Fraude)
El QR de acceso expide un JWT temporal de 1 solo uso que vence después de 30 minutos. La lógica bloquea las clonaciones y la intercepción visual del QR.

## 2. Puntos de Monitoreo Analítico

Existe la tabla de `auditoria_logs`, diseñada con particiones anuales. El Administrador podrá consultar desde allí el *User Agent*, *IP* e historial de cambios (*Capa de Trazabilidad Total*).

## 3. Mantenimiento y Buenas Prácticas
1. Respaldar variables ocultas del `.env`.
2. Actualizar el Secret Token asociado al Webhook de recolección de eventos (Instagram).
3. Monitorear los contenedores de Supabase para evitar sobrecargas de cuota de almacenamiento (`business-logos`, `imagenes-eventos`).
