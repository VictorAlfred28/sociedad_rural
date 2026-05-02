# Plan de Implementación: Reubicación de Buscador y Mejoras

## Fase 0: Análisis
1. El buscador principal está actualmente renderizado en `HomeSocio.tsx` a través del componente `<Lupita />`.
2. El error "Cannot read properties of undefined (reading 'toLowerCase')" ocurre en la función `norm` del archivo `src/components/Lupita.tsx`, al intentar normalizar cadenas que resultan ser `undefined` (por ejemplo, subtipo o municipio en algunos ítems).
3. La barra de navegación se define en `BottomNav.tsx` y actualmente consta de 3 elementos.

## Fase 1: Eliminar Buscador Actual
- **Archivo:** `src/pages/HomeSocio.tsx`
- **Acción:** Remover la importación de `<Lupita />` y la renderización del componente en la zona inferior (eliminar el `<motion.div>` que envuelve a `<Lupita />`).

## Fase 2: Nueva Navegación Inferior
- **Archivo:** `src/components/BottomNav.tsx`
- **Acción:** Insertar un nuevo tab para el buscador con ruta `/buscar`, etiqueta 'BUSCAR' e ícono `search`. Asegurar que se inserte antes del tab de 'PERFIL', resultando en 4 elementos: Inicio, Novedades (o tab central correspondiente), Buscar y Perfil.

## Fase 3: Crear Pantalla de Buscador
- **Archivos:** `src/App.tsx` (o donde estén las rutas), `src/pages/Buscador.tsx`.
- **Acción:** 
  1. Crear una nueva página `Buscador.tsx` que contendrá la UI del buscador a pantalla completa (reutilizando la lógica o el componente `Lupita` pero adaptándolo a una vista sin dropdowns que colapsen por click outside, sino con una lista nativa).
  2. Agregar la ruta `/buscar` en el sistema de enrutamiento (ej: `App.tsx` o `Routes.tsx`).
  3. Modificar `Lupita.tsx` para que su layout se adapte a pantalla completa, agregar filtros rápidos debajo del input (Eventos, Comercios, Profesionales, Municipios) y mostrar los resultados de forma clara.

## Fase 4: Lógica de Búsqueda Mejorada
- **Archivo:** `src/components/Lupita.tsx` (o su equivalente en la nueva pantalla).
- **Acción:** 
  1. Corregir función `norm`: `if (!s || typeof s !== 'string') return ''; return s.toLowerCase()...`.
  2. Filtrado dinámico mejorado usando los nuevos botones de filtro por tipo.

## Fase 5: Corrección de Errores
- **Acción:** 
  1. Ya se resolvió el `toLowerCase` (Fase 4).
  2. Para el favicon 404: Verificar `index.html` y eliminar referencia errónea al favicon si no existe, o proveer uno básico.

## Fase 6: Experiencia de Usuario (UX)
- Implementar transiciones suaves.
- Añadir placeholder requerido: "Buscar eventos, comercios o profesionales...".
- Mostrar "No encontramos resultados" u otro mensaje de fallback claro cuando no haya match.
- Asegurar que la nueva pantalla tenga el header adecuado.

## Fase 7: Validación Final
- Correr la app localmente o asegurarse de que todo compila bien sin errores.
- Comprobar accesibilidad y layout.
