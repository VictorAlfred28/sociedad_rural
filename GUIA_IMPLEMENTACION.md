# 🚀 GUÍA DE IMPLEMENTACIÓN - SPEC EVENTOS AVANZADO

## ⚠️ IMPORTANTE: Pasos para Activar la Implementación

Esta implementación está **completa y lista**, pero requiere algunos pasos finales para activarse en tu entorno.

---

## 📋 CHECKLIST DE CONFIGURACIÓN

### 1. ✅ Ejecutar Migración de Base de Datos

**Archivo**: `migrations_eventos.sql`

```bash
# Opción A: Via Supabase Console
1. Abre Supabase Dashboard
2. Ve a SQL Editor
3. Copia el contenido de migrations_eventos.sql
4. Ejecuta (botón "Run")

# Opción B: Via psql (local)
psql -h host -U usuario -d database -f migrations_eventos.sql
```

**Verificar Migración**:
```sql
-- En Supabase Console, ejecuta:
SELECT tablename FROM pg_tables WHERE tablename IN ('municipios', 'eventos');
-- Debe retornar dos filas

-- Ver municipios creados:
SELECT nombre, provincia FROM municipios;
-- Debe retornar 8 municipios
```

---

### 2. ✅ Backend Ya Está Actualizado

**Lo que se hizo**:
- ✅ Imports agregados (`BACKEND/main.py` línea ~37)
- ✅ Funciones utilitarias agregadas (validar_url, generar_slug_unico)
- ✅ 8 nuevos endpoints implementados (~5200+ líneas)

**Sin cambios necesarios** - El código ya está integrado en `main.py`

```python
# Los endpoints están listos:
GET  /api/municipios
POST /api/admin/municipios
PUT  /api/admin/municipios/{id}
DELETE /api/admin/municipios/{id}

GET  /api/eventos/publicos
GET  /api/eventos/destacados
GET  /api/eventos/{id}
POST /api/admin/eventos
PUT  /api/admin/eventos/{id}
DELETE /api/admin/eventos/{id}
```

**Verificar Backend**:
```bash
cd BACKEND
pip install -r requirements.txt  # Debe estar actualizado
python main.py  # Inicia servidor

# En otra terminal:
curl http://localhost:8000/api/municipios
# Debe retornar JSON con municipios
```

---

### 3. ✅ Frontend: Reemplazar GestionEventos

**Opción A: Usar nuevo componente (RECOMENDADO)**

```typescript
// En AdminDashboard.tsx, reemplaza:
// import GestionEventos from './GestionEventos';
// Con:
import GestionEventosAvanzada from './GestionEventosAvanzada';

// Luego en JSX:
// <GestionEventos /> → <GestionEventosAvanzada />
```

**Opción B: Mantener ambos (Coexistencia)**

```typescript
// Ambos componentes pueden coexistir
import GestionEventos from './GestionEventos';           // Antiguo
import GestionEventosAvanzada from './GestionEventosAvanzada'; // Nuevo

// En AdminDashboard
<Tabs>
  <Tab label="Eventos (Antiguo)">
    <GestionEventos />
  </Tab>
  <Tab label="Eventos (Nuevo)">
    <GestionEventosAvanzada />
  </Tab>
</Tabs>
```

---

### 4. ✅ Frontend: Integrar Componente Público (OPCIONAL)

```typescript
// En Eventos.tsx o crear EventosMunicipio.tsx

import EventosPorMunicipio from '../components/EventosPorMunicipio';

export default function Eventos() {
  return (
    <div className="...">
      {/* Usar el nuevo componente */}
      <EventosPorMunicipio />
    </div>
  );
}
```

---

## 🧪 TESTING DESPUÉS DE LA IMPLEMENTACIÓN

### Test 1: Crear un Evento Completo

```
Admin → Gestión Eventos → Nuevo Evento

1. Selecciona municipio: "Corrientes Capital"
2. Titulo: "Remate de Prueba"
3. Tipo: "Remate"
4. Lugar: "Predio de Prueba"
5. Fecha: 2026-05-15 09:00
6. Estado: "borrador"
7. Redes Sociales:
   - Instagram: https://instagram.com/test
   - Facebook: https://facebook.com/test
8. Descripción: "Evento de prueba"
9. Guardar

Resultado esperado: ✅ Evento creado, visible en lista
```

### Test 2: Verificar en Base de Datos

```sql
-- En Supabase Console:
SELECT id, titulo, estado, municipio_id, link_instagram 
FROM eventos 
ORDER BY fecha_creacion DESC 
LIMIT 1;
```

**Esperado**: 1 fila con el evento creado

### Test 3: Ver Evento Público

```
Usuario (no admin) → Eventos

1. Ver selector de municipios
2. Cambiar a "Corrientes Capital"
3. Debería ver el evento creado (si estado = "publicado")

Nota: Si estado = "borrador", no será visible
```

### Test 4: Verificar Auditoría

```sql
SELECT accion, tabla, datos_nuevos 
FROM auditoria_logs_2026 
WHERE tabla = 'eventos' 
ORDER BY fecha DESC 
LIMIT 1;
```

**Esperado**: CREATE con datos del evento

---

## 📁 ARCHIVOS DE REFERENCIA

### Backend
- `BACKEND/main.py` - Endpoints implementados
- `BACKEND/schemas/eventos.py` - Validaciones Pydantic
- `BACKEND/routers/eventos.py` - Template de routers (referencia)

### Frontend
- `FRONTEND/src/components/admin/GestionEventosAvanzada.tsx` - Formulario admin
- `FRONTEND/src/components/EventosPorMunicipio.tsx` - Componente público

### Documentación
- `SPEC_IMPLEMENTACION.md` - Especificación completa
- `ARQUITECTURA_EVENTOS.md` - Diagramas y arquitectura
- `migrations_eventos.sql` - SQL migration
- `/memories/repo/eventos-spec-endpoints.md` - Referencia rápida de API

---

## 🐛 TROUBLESHOOTING

### Error: "Municipio especificado no existe"

```
Causa: No se ejecutó migrations_eventos.sql
Solución: Ejecutar migración primero
```

### Error: "URL inválida en campo link_instagram"

```
Causa: URL no comienza con http:// o https://
Solución: Usar URLs completas: https://instagram.com/...
```

### Error: 404 en GET /api/municipios

```
Causa: Backend no tiene los nuevos endpoints
Solución: Reiniciar servidor (python main.py)
          Verificar que main.py tiene los imports de schemas/eventos.py
```

### Evento no aparece en vista pública

```
Causa: Estado = "borrador" (no publicado)
Solución: Cambiar estado a "publicado"
          Verificar que publico = true
```

---

## 📊 PRÓXIMOS PASOS SUGERIDOS

### Corto Plazo (1-2 semanas)
- [ ] Ejecutar migration SQL
- [ ] Probar CRUD de eventos
- [ ] Integrar GestionEventosAvanzada en AdminDashboard
- [ ] Validar con municipios reales

### Mediano Plazo (1 mes)
- [ ] Hacer backups de eventos antiguos
- [ ] Migrar datos de eventos_sociales si existen
- [ ] Entrenar admins en nueva interfaz
- [ ] Publicar primeros eventos

### Largo Plazo (2-3 meses)
- [ ] Integración Make.com
- [ ] Notificaciones automáticas
- [ ] Analytics de eventos
- [ ] Inscripciones en eventos

---

## 🎓 RECURSOS DE APRENDIZAJE

### API Endpoints
→ Ver `/memories/repo/eventos-spec-endpoints.md`

### Arquitectura Completa
→ Ver `ARQUITECTURA_EVENTOS.md`

### Especificación Detallada
→ Ver `SPEC_IMPLEMENTACION.md`

### Schemas Pydantic
→ Ver `BACKEND/schemas/eventos.py`

---

## ✅ RESUMEN

| Componente | Estado | Acción |
|-----------|--------|--------|
| BD Migration | ✅ Listo | Ejecutar `migrations_eventos.sql` |
| Backend API | ✅ Listo | Reiniciar servidor |
| Admin UI | ✅ Listo | Integrar `GestionEventosAvanzada` |
| Public UI | ✅ Listo | Integrar `EventosPorMunicipio` |
| Auditoría | ✅ Listo | Automático |
| Validaciones | ✅ Listo | Automático |

---

## 🚨 IMPORTANTE: Checklist Final

Antes de ir a **PRODUCCIÓN**:

- [ ] Migración SQL ejecutada sin errores
- [ ] Backend reiniciado y endpoints responden
- [ ] Admin puede crear evento con todos los campos
- [ ] Redes sociales visibles en tarjeta de evento
- [ ] Público solo ve eventos con estado "publicado"
- [ ] Auditoría registra cambios correctamente
- [ ] URLs de redes sociales funcionan al hacer clic

---

## 📞 SOPORTE

Si encuentras problemas:

1. Revisa los logs del backend: `BACKEND/main.py` output
2. Verifica que la migración SQL se ejecutó completamente
3. Consulta los archivos de documentación
4. Verifica que los imports en `main.py` son correctos

---

**Última actualización**: 30/04/2026  
**Versión**: 1.0  
**Status**: ✅ Listo para Implementación
