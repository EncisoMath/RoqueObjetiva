# RoqueObjetiva v171 — Correcciones administrativas por edición

## Implementación

Esta entrega adapta las dos acciones de **corrección manual** a `roque_private`, sin nuevas tablas duplicadas de resultados ni publicación de evaluaciones.

- `public.roque_v4_admin_corregir_resultado_edicion(edicion,id_prueba,respuestas,esperado,motivo)`
- `public.roque_v4_admin_corregir_claves_edicion(edicion,cambios,motivo)`
- Auditoría privada `roque_private.auditoria_correcciones` con edición, tipo, ID o pregunta, valor anterior, valor nuevo, motivo, UUID del operador y fecha.
- La RPC antigua `roque_v3_admin_guardar_resultado` ahora delega a la nueva vía auditada para que clientes antiguos no generen divergencias.

Las nuevas funciones aceptan únicamente una sesión **Supabase Auth** cuyo `auth.uid()` figure activo en `roque_private.operadores_admin`. El rol `anon` no puede ejecutarlas. La bitácora activa RLS y no es consultable desde la PWA.

## Protección de datos históricos

**Por ahora SOLO `2026-1S` tiene habilitadas correcciones administrativas manuales.** Aunque está cerrado, el administrador autorizado puede corregir errores puntuales con motivo documentado. El segundo semestre sigue en borrador, sin posibilidad de corregir desde la interfaz ni publicar.

En `2026-1S`, antes de escribir se bloquea la edición y se comparan ambos registros actuales (`public` y `roque_private`). Si difieren, se rechaza todo. La modificación de ambas copias y el registro de auditoría ocurren **en la misma transacción de PostgreSQL**, o no ocurre ninguna. De esta manera, el lector de v169 y el ranking de v170 siguen encontrando fuentes idénticas.

### Resultados

En **Ver examen > Guardar y subir a Supabase**:

1. Se toma una instantánea de las respuestas al abrir el examen; si cambiaron desde entonces, la función rechaza el guardado.
2. Se solicita una justificación de al menos diez caracteres.
3. Se valida el ID, grado, edición, existencia del examen y números de ítems del grado. Las marcas admitidas son letras A–H y marcas múltiples.
4. Se comparan las respuestas originales con la versión del servidor para detectar ediciones simultáneas.
5. Se actualiza **un único `id_prueba`** en las tablas `public.resultados` y `roque_private.resultados`; no se hacen `DELETE`, sincronizaciones completas ni inserciones de exámenes nuevos.
6. Se registra el antes y después. La modificación es atómica.

Los exámenes inactivos no se reactivan por este mecanismo.

### Claves

En **Claves > Guardar y subir claves**:

1. La aplicación compara los controles modificados contra las claves recibidas del servidor, antes de cualquier almacenamiento local.
2. Envía únicamente las claves diferentes de `2026-1S` (máximo 100 por transacción), con grado y número de ítem y clave original esperada.
3. Exige un motivo, comprueba que ambas tablas coincidan, que el ítem esté activo y que la clave anterior sea la esperada.
4. Actualiza `public.claves` y `roque_private.items` sin cambiar el área ni los metadatos; audita cada cambio.
5. Si una sola clave del lote falla, **ninguna clave del lote se modifica**.

**Guardar claves** sigue siendo una acción local. La sincronización general de todo el aplicativo sigue deshabilitada. No se permite utilizar este mecanismo para actualizar claves de `2026-2S` mientras no se haya implementado el flujo de publicación y revisión de esa edición.

## Pruebas de base de datos realizadas

- Se invocó cada operación con una cuenta administrativa válida, dentro de **subtransacciones revertidas**.
- Se confirmó que la corrección de respuestas modificaba las dos tablas, generaba auditoría y rechazaba un formulario desactualizado.
- Se confirmó que la corrección de clave modificaba ambas tablas y generaba auditoría.
- Las subtransacciones revirtieron también las anotaciones de auditoría de prueba: no se guardaron notas, claves ni motivos ficticios.
- Se comprobó `anon EXECUTE=false`, `authenticated EXECUTE=true` y la verificación explícita de `operadores_admin` dentro de cada función.
- Se comprobó paridad final: **0 diferencias** entre resultados y claves de ambas estructuras.
- Totales conservados: `2026-1S` 877 inscripciones, 699 resultados y 625 claves. `2026-2S` sigue borrador sin claves ni resultados.

## Pendientes

- Prueba funcional final de abrir/corregir un examen desde el navegador y verificar que la PWA se actualice tras el guardado.
- Una pantalla de consulta de historial de correcciones, con autenticación de administrador y paginación limitada.
- Etapa 4/5: selector y autorización por edición para estudiantes y docentes, antes de permitir correcciones de una segunda edición publicada.
- Etapa de publicación segura del segundo semestre cuando existan los Excel y claves reales.
- No borrar ni retirar todavía las tablas `public`: permanecen como respaldo durante la migración.
