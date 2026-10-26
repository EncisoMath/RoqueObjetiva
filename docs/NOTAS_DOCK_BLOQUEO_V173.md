# RoqueObjetiva v173 — corrección de respuestas, dock estudiantil y bloqueo temporal

## 1. Incidente de notas en cero: causa raíz confirmada
La RPC `public.roque_v4_login_controlado_private` de v169 envía los resultados privados en `datasets.resultados[].rows[].respuestas` como **objeto JSON** de ítem a opción. El parser `parseDataObjects` convertía TODOS los valores JSON a `cleanText(value)`. Los objetos quedaban como la cadena literal `"[object Object]"`. Luego `parseResultFile` ignoraba esa cadena, por lo que las respuestas quedaban vacías y `calculateStudentStatsFromRecord` marcaba todas las asignaturas como no presentadas: nota 0, todas las preguntas sin marcar. El ranking de 0-500 llegaba de una RPC separada y permanecía coherente con la base.

**Cambio:** preservar la estructura JSON exclusivamente para la propiedad `respuestas` cuando es un objeto. No tocar algoritmos de calificación, claves, escala 20-100, ranking, ni filas de producción.

**Prueba de regresión contra PostgreSQL:** se tomó una muestra por grado 6, 7, 8, 9 y 10 (identificadores anonimizados dentro de las pruebas); se ejecutó el `parseDataObjects` y `parseResultFile` reales del código corregido, y se compararon opciones únicas, dobles y respuestas correctas con agregados SQL independientes. Cinco grados coinciden exactamente:
- 6°: 123 marcas únicas, 2 dobles, 52 correctas.
- 7°: 120 únicas, 3 dobles, 44 correctas.
- 8°: 121 únicas, 3 dobles, 43 correctas.
- 9°: 124 únicas, 1 doble, 63 correctas.
- 10°: 119 únicas, 4 dobles, 37 correctas.

Estas cifras corresponden a muestras de regresión independientes, no a métricas institucionales ni a resultados de un estudiante señalado en capturas.

## 2. Navegación estudiantil
Se elimina por completo el menú superior «← Evaluaciones | Reporte general | Salir» y se utiliza un dock inferior con el mismo sistema CSS `t160-dock` que el panel docente:
- **Historial**: abre la portada para elegir examen.
- **Detalles de examen**: muestra el informe completo de la última edición seleccionada (notas, preguntas, ranking, puntaje). Permanece deshabilitado hasta que se seleccione una edición.
- **Salir**: cierra sesión y regresa al login.
El menú fijo, flat, sin gradientes, radios <= 4px, evita cubrir contenido mediante padding inferior y conserva el espacio de seguridad móvil. Los roles de docente y administrador siguen sin cambios.

## 3. Bloqueo de evaluaciones históricas
Calendario exacto hora Colombia: desde **2026-11-01 00:00** hasta el **2026-11-18 23:59:59** (inclusive), desbloqueo **2026-11-19 00:00**. La condición sobre una edición requiere además que exista **otra edición cronológicamente posterior** en `roque_private.ediciones`. No se bloquea la más reciente, aunque siga en borrador.

Nueva función privada `roque_private.historial_bloqueado(p_edicion,p_fecha)`; verificación con fechas simuladas: Oct 31=false; Nov 1=true; Nov 18=true; Nov 19=false; 2026-2S no se bloquea. `public.roque_v5_portada_ediciones` devuelve `bloqueado_periodo` calculado por el servidor. Bajo «HISTORIAL» se muestra literalmente «Estos exámenes están bloqueados hasta que finalice el periodo.» durante el cierre.

**Cierre de bypasses en servidor:** se actualizaron sin cambiar su firma `public.roque_login`, `roque_v4_login_controlado_private`, `roque_v2_ranking_controlado`, `roque_v3_ranking_controlado_edicion` y `roque_v5_historial_autorizado` para no entregar respuestas, claves, notas ni rankings históricos durante el periodo a estudiantes. Administradores y docentes mantienen su acceso habitual. El frontend también revalida el ingreso en el servidor antes de abrir un informe.

Supabase SQL de despliegue: `supabase/24_bloqueo_historial_noviembre_2026_v173.sql`. La migración se ejecutó directamente y se conservó versionada.

## 4. Auditoría de integridad
- 2026-1S: 877 inscripciones, 699 resultados y 625 claves definidas.
- 2026-2S: borrador, 0 inscripciones, 0 resultados, 0 claves definidas.
- No se aplicó ningún UPDATE/DELETE/INSERT en tablas de inscripciones, claves o respuestas.
- No se alteró `renderStudent` ni el cálculo académico existente; solo se corrigió la entrada de datos al parser.

## 5. Pruebas manuales después de la publicación
1. Cerrar PWA y volver a abrir v173; confirmar dock inferior sin botones de navegación en la cabecera.
2. Ingresar con un alumno autorizado de 2026-1S, abrir **Historial → 2026-1S → Detalles de examen**.
3. Verificar que ya aparecen notas por asignatura, marcas reales y correctas/incorrectas/dobles. Comprobar que el ranking por grado y curso permanece y que puntaje global coincide con las cinco áreas.
4. Abrir detalle de Matemáticas y de otra asignatura: NO deben aparecer todas las preguntas sin marcar si existieron respuestas en el examen.
5. Pulsar Historial: comprobar retorno; pulsar Detalles de examen: regresa al último informe seleccionado; Salir: vuelve a login.
6. Desde el 1 al 18 noviembre: 2026-1S bloqueado y mensaje bajo Historial; desde el 19: disponible. Estas fechas se verificaron ya en SQL sin cambiar el reloj ni los datos del servidor.
7. Probar login docente/admin para detectar regresiones ajenas.

**Limitación:** pruebas funcionales de parser y de restricciones SQL realizadas; no se efectuó QA visual interactivo desde un teléfono real.
