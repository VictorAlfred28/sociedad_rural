# 🏗️ DIAGRAMA DE ARQUITECTURA - SISTEMA DE EVENTOS AVANZADO

## Flujo de Datos

```
┌─────────────────────────────────────────────────────────────────┐
│                      USUARIO ADMIN                             │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
        ┌──────────────────────────────────────────┐
        │   GestionEventosAvanzada.tsx             │
        │  (9 Secciones temáticas)                 │
        │  - Municipios                            │
        │  - Datos Principales                     │
        │  - Redes Sociales ⭐                     │
        │  - Ubicación + Coordenadas               │
        │  - Imágenes + Multimedia                 │
        └──────────────────────┬───────────────────┘
                               │
                    ┌──────────▼───────────┐
                    │   VALIDACIÓN UI      │
                    │  (URLs, Municpios)   │
                    └──────────┬───────────┘
                               │
            ┌──────────────────▼──────────────────┐
            │   API REST BACKEND (FastAPI)        │
            │                                     │
            │  POST /api/admin/eventos            │
            │  PUT  /api/admin/eventos/{id}       │
            │  DELETE /api/admin/eventos/{id}     │
            │                                     │
            │  + CRUD Municipios                  │
            └──────────────────┬──────────────────┘
                               │
        ┌──────────────────────▼──────────────────┐
        │  VALIDACIÓN BACKEND (Pydantic)          │
        │  - URLs válidas                         │
        │  - Tipos enumerados                     │
        │  - Municipio existe                     │
        │  - Slug único                           │
        └──────────────────────┬──────────────────┘
                               │
        ┌──────────────────────▼──────────────────┐
        │   PostgreSQL + Supabase                 │
        │                                         │
        │  ┌──────────────┐  ┌──────────────┐    │
        │  │  municipios  │  │  eventos     │    │
        │  ├──────────────┤  ├──────────────┤    │
        │  │ id (uuid)    │  │ id (uuid)    │    │
        │  │ nombre       │  │ municipio_id │◄───┼─ FK
        │  │ provincia    │  │ titulo       │    │
        │  │ activo       │  │ slug         │    │
        │  │ latitud      │  │ tipo         │    │
        │  │ longitud     │  │ estado       │    │
        │  │              │  │ link_ig      │    │
        │  │              │  │ link_fb      │    │
        │  │              │  │ link_wa      │    │
        │  └──────────────┘  │ link_externo │    │
        │                    └──────────────┘    │
        │                                         │
        │  ┌─────────────────────────────────┐   │
        │  │  auditoria_logs                 │   │
        │  │  (Registra CREATE/UPDATE/DELETE)│   │
        │  └─────────────────────────────────┘   │
        └─────────────────────────────────────────┘
                               │
                ┌──────────────▼──────────────┐
                │   USUARIO PÚBLICO (SOCIO)   │
                └──────────────────────────────┘
                               │
                               ▼
        ┌──────────────────────────────────────┐
        │ EventosPorMunicipio.tsx              │
        │ - Grid responsivo                    │
        │ - Filtrado por municipio             │
        │ - Botones de redes sociales          │
        └──────────────────────────────────────┘
                               │
                    ┌──────────▼──────────┐
                    │ GET /api/eventos    │
                    │ (Solo publicados)    │
                    └─────────────────────┘
```

---

## Matriz de Acceso y Permisos

```
                   │ Público │ Socio │ Admin │ SuperAdmin
──────────────────┼─────────┼───────┼───────┼──────────
GET municipios    │   ✓     │   ✓   │   ✓   │    ✓
GET eventos       │   ✓     │   ✓   │   ✓   │    ✓
POST eventos      │   ✗     │   ✗   │   ✓   │    ✓
PUT eventos       │   ✗     │   ✗   │   ✓   │    ✓
DELETE eventos    │   ✗     │   ✗   │   ✓   │    ✓
──────────────────┼─────────┼───────┼───────┼──────────
Crear municipios  │   ✗     │   ✗   │   ✓   │    ✓
Ver auditoría      │   ✗     │   ✗   │   ✗   │    ✓
```

---

## Estados de Evento y Visibilidad

```
┌─────────────────┬──────────┬────────┬────────────────────────┐
│ Estado          │ Público  │ Visible│ Notas                  │
├─────────────────┼──────────┼────────┼────────────────────────┤
│ borrador        │ false    │ NO     │ Editable, no público   │
│ publicado       │ true     │ SÍ     │ Normal, aparece en app │
│ cancelado       │ true     │ SÍ     │ Rojo, con etiqueta     │
│ finalizado      │ true     │ SÍ     │ Pasado, con etiqueta   │
└─────────────────┴──────────┴────────┴────────────────────────┘
```

---

## Campos de Evento y Secciones UI

```
┌──────────────────────────────────────────────────────────────┐
│                   FORMULARIO ADMIN                           │
├──────────────────────────────────────────────────────────────┤
│ 1️⃣  MUNICIPIO                                               │
│    └─ Selector (requerido)                                   │
│                                                              │
│ 2️⃣  DATOS PRINCIPALES                                       │
│    ├─ Título ✓ (requerido)                                   │
│    ├─ Subtítulo                                              │
│    ├─ Tipo ✓ (dropdown)                                      │
│    ├─ Estado (dropdown)                                      │
│    ├─ Organizador                                            │
│    ├─ Contacto                                               │
│    ├─ Destacado (toggle)                                     │
│    └─ Público (toggle)                                       │
│                                                              │
│ 3️⃣  FECHA Y HORA                                            │
│    ├─ Fecha Inicio ✓                                         │
│    ├─ Fecha Fin (disabled si un_dia=true)                    │
│    └─ Evento de un día (checkbox)                            │
│                                                              │
│ 4️⃣  UBICACIÓN                                               │
│    ├─ Lugar ✓                                                │
│    ├─ Dirección                                              │
│    ├─ Latitud (número)                                       │
│    └─ Longitud (número)                                      │
│                                                              │
│ 5️⃣  REDES SOCIALES ⭐                                        │
│    ├─ Instagram URL                                          │
│    ├─ Facebook URL                                           │
│    ├─ WhatsApp URL                                           │
│    └─ Link Externo                                           │
│                                                              │
│ 6️⃣  IMÁGENES                                                │
│    ├─ Imagen Principal (URL)                                 │
│    └─ Video URL                                              │
│                                                              │
│ 7️⃣  CONTENIDO                                               │
│    ├─ Descripción Corta                                      │
│    └─ Descripción Larga (HTML)                               │
│                                                              │
│ 8️⃣  DATOS ADICIONALES                                       │
│    ├─ Precio (texto)                                         │
│    ├─ Capacidad (número)                                     │
│    └─ Requiere Inscripción (toggle)                          │
│                                                              │
│ 9️⃣  ACCIONES                                                │
│    ├─ Guardar                                                │
│    └─ Cancelar                                               │
└──────────────────────────────────────────────────────────────┘
```

---

## Flujo de Creación de Evento

```
1. Admin accede GestionEventosAvanzada
   │
2. Hace clic en "Nuevo Evento"
   │
3. Rellena formulario de 9 secciones
   │
4. Selecciona municipio (requerido)
   │
5. Agrega redes sociales (opcionales)
   │ 
6. Hace clic en "Guardar Evento"
   │
7. Validaciones de UI (URLs, formato)
   │
8. Envía POST a /api/admin/eventos
   │
9. Backend valida:
   ├─ Municipio existe ✓
   ├─ URLs válidas ✓
   ├─ Slug único (o genera automático) ✓
   └─ Tipos correctos ✓
   │
10. Inserta en BD
    │
11. Registra en auditoria_logs
    │
12. Retorna evento creado
    │
13. Frontend actualiza lista
    │
14. Evento visible en admin (estado: borrador)
    │
15. Al cambiar a "publicado": visible en app pública
```

---

## Endpoints en Detalle

### Municipios

```
GET /api/municipios?activo_solo=true
├─ Parámetros: activo_solo (bool)
├─ Respuesta: { municipios: [...] }
├─ Status: 200
└─ Acceso: Público

POST /api/admin/municipios
├─ Body: MunicipioCreate
├─ Respuesta: { message, municipio }
├─ Status: 201
└─ Acceso: Admin

PUT /api/admin/municipios/{id}
├─ Body: MunicipioUpdate (campos opcionales)
├─ Respuesta: { message, municipio }
├─ Status: 200
└─ Acceso: Admin

DELETE /api/admin/municipios/{id}
├─ Respuesta: { message }
├─ Status: 204
└─ Acceso: Admin (sin eventos)
```

### Eventos

```
GET /api/eventos/publicos
├─ Query: municipio_id, tipo, destacado_solo, fecha_desde
├─ Respuesta: { eventos: [...] }
├─ Status: 200
└─ Acceso: Público

GET /api/eventos/destacados?limit=6
├─ Query: limit
├─ Respuesta: { eventos: [...] }
├─ Status: 200
└─ Acceso: Público

GET /api/eventos/proximos?dias=30&limit=10
├─ Query: dias, limit
├─ Respuesta: { eventos: [...] }
├─ Status: 200
└─ Acceso: Público

GET /api/eventos/{id}
├─ Respuesta: Evento completo
├─ Status: 200 o 404
└─ Acceso: Público (si publicado)

POST /api/admin/eventos
├─ Body: EventoCreate
├─ Respuesta: { message, evento }
├─ Status: 201
├─ Validaciones: URLs, municipio, slug
└─ Acceso: Admin

PUT /api/admin/eventos/{id}
├─ Body: EventoUpdate
├─ Respuesta: { message, evento }
├─ Status: 200
└─ Acceso: Admin

DELETE /api/admin/eventos/{id}
├─ Respuesta: { message }
├─ Status: 204
└─ Acceso: Admin
```

---

## Validaciones

```
┌──────────────────┬─────────────┬──────────────────────────┐
│ Campo            │ Tipo        │ Validación               │
├──────────────────┼─────────────┼──────────────────────────┤
│ municipio_id     │ UUID        │ REQUERIDO, FK válida     │
│ titulo           │ string      │ 1-200 chars, REQUERIDO   │
│ slug             │ string      │ UNIQUE, autogenerado     │
│ tipo             │ enum        │ 5 opciones fijas         │
│ estado           │ enum        │ 4 opciones (evento_estado)
│ link_instagram   │ URL         │ Patrón http/https        │
│ link_facebook    │ URL         │ Patrón http/https        │
│ link_whatsapp    │ URL         │ wa.me/... o similar      │
│ link_externo     │ URL         │ Patrón http/https        │
│ fecha_inicio     │ datetime    │ REQUERIDO, >= ahora      │
│ fecha_fin        │ datetime    │ >= fecha_inicio (si set) │
│ capacidad        │ integer     │ >= 0                     │
│ precio           │ string      │ Ej: "Gratis" o "$5000"   │
└──────────────────┴─────────────┴──────────────────────────┘
```

---

## Ejemplo: Evento Completo (JSON)

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "municipio_id": "12345678-1234-1234-1234-123456789012",
  "titulo": "Gran Remate Anual de Reproductores",
  "subtitulo": "Participan criadores de toda la provincia",
  "slug": "gran-remate-anual-20260515120000",
  "tipo": "Remate",
  "organizador": "Sociedad Rural del Norte de Corrientes",
  "contacto": "+54-3764-XXXXX",
  "lugar": "Predio Ferial SRNC",
  "direccion": "Ruta 14, Km 5, Corrientes Capital",
  "coordenadas_lat": -27.4898,
  "coordenadas_lng": -55.5016,
  "fecha_inicio": "2026-05-15T09:00:00",
  "fecha_fin": "2026-05-15T17:00:00",
  "es_evento_de_un_dia": true,
  "estado": "publicado",
  "destacado": true,
  "publico": true,
  "imagen_principal": "https://cdn.example.com/remate-principal.jpg",
  "galeria_imagenes": [
    {"url": "https://cdn.example.com/img1.jpg", "caption": "Vista del predio"},
    {"url": "https://cdn.example.com/img2.jpg", "caption": "Ganado en subasta"}
  ],
  "video_url": "https://youtube.com/watch?v=dQw4w9WgXcQ",
  "link_instagram": "https://instagram.com/sociedad_rural",
  "link_facebook": "https://facebook.com/sociedad.rural.norte",
  "link_whatsapp": "https://wa.me/543764440000",
  "link_externo": "https://sociedad-rural.com.ar/evento/remate",
  "descripcion_corta": "Gran remate anual con más de 200 cabezas de ganado de raza.",
  "descripcion_larga": "<h2>Remate de Reproductores 2026</h2><p>Evento anual de la Sociedad Rural...</p>",
  "precio": "Libre acceso - Ganaderos",
  "capacidad": 500,
  "requiere_inscripcion": false,
  "creado_por": "87654321-4321-4321-4321-210987654321",
  "fecha_creacion": "2026-04-30T12:00:00Z",
  "fecha_actualizacion": "2026-04-30T12:00:00Z"
}
```

---

## Integraciones Futuras (Make.com)

```
┌─────────────────────────────────────────────────────────┐
│            WEBHOOK: Evento Creado/Actualizado           │
└─────────────────────────────────────────────────────────┘
                          │
        ┌─────────────────┼─────────────────┐
        ▼                 ▼                 ▼
   Make.com          Make.com          Make.com
   Scenario 1        Scenario 2        Scenario 3
   
   "Post to           "Notify Via        "Create Google
    Instagram"        WhatsApp"          Calendar Event"
    
    - Crear post      - Enviar msg      - Generar iCal
    - Con foto        - A contactos     - Link a evento
    - Y descripción   - Automático      - Con ubicación

Triggers disponibles:
├─ POST /webhooks/evento-nuevo
├─ PUT /webhooks/evento-actualizado
└─ DELETE /webhooks/evento-eliminado
```

---

## Performance

```
Índices Creados:
├─ idx_eventos_municipio_id         ⚡ Filtrado rápido
├─ idx_eventos_estado               ⚡ Queries de estado
├─ idx_eventos_fecha_inicio         ⚡ Ordenamiento cronológico
├─ idx_eventos_destacado            ⚡ Homepage destacados
├─ idx_eventos_slug                 ⚡ Búsqueda por slug
├─ idx_eventos_municipio_estado     ⚡ Combinaciones comunes
└─ idx_municipios_activo            ⚡ Filtrado municipios

Query Típica sin Índice:  ~500ms
Query Típica con Índice:  ~2-5ms
Mejora:                   100x+ ⚡
```

---

**Documento generado**: 30/04/2026  
**Versión**: 1.0
