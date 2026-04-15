# Manual de Usuario - Plataforma Sociedad Rural

## 1. Introducción
La plataforma Sociedad Rural es un sistema integral para la gestión de socios, cobro de cuotas, publicación de promociones comerciales, y emisión de Carnets Digitales. Cuenta con un panel público y privado, y distintos niveles de acceso.

## 2. Tipos de Usuarios

### 2.1. Administrador (ADMIN / SUPERADMIN)
Tiene acceso total a las configuraciones, aprobación de usuarios, gestión de morosidad y auditoría.
- **Acceso:** Ir a `https://[DOMINIO]/login` e ingresar las credenciales administrativas.
- **Funciones:** 
  - Ver el Dashboard Administrativo (Ingresos, Socios Activos).
  - Aprobar o Rechazar nuevos registros.
  - Publicar Eventos y enviar notificaciones Masivas.
  - Gestionar cobros y registrar pagos manuales.

### 2.2. Socios
Pueden visualizar su estado de deuda, su carnet digital y disfrutar de las promociones.
- **Funceso:** Registro público vía web, sujeto a aprobación.
- **Funciones:**
  - Visualizar y descargar el **Carnet Digital QR**.
  - Gestionar Familiares adheridos al plan.
  - Ver el listado de promociones vigentes publicadas por los Comercios.

### 2.3. Comercios
Tienen un panel especial para ofertar descuentos exclusivos a los socios validos.
- **Funciones:**
  - **Mi Negocio:** Administrar el perfil del comercio (Rubro, Logo).
  - **Mis Promociones:** Crear y dar de baja ofertas con integración a redes sociales.

## 3. Uso del Carnet Digital

Cada Socio y Comercio posee un Carnet Digital. El Carnet genera un **Código QR Dinámico** con protección anti-captura. Cuando un Comercio escanea este código desde la opción de validación, el sistema certifica si el portador tiene **estado habilitado** para acceder a su promoción.

## 4. Gestión de Pagos
La cuota se vence cada mes. El Administrador puede gestionar qué socio está al día.
El día 11 de cada mes ingresa una revisión automática; si no tienen el pago registrado, ingresan a **Mora Automática**, deshabilitando el QR de Carnet Digital al instante.

*Plataforma desarrollada y licenciada para despliegues cerrados - Tecnología Antigravity AI.*
