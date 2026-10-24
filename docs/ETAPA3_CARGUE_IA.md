# RoqueObjetiva — Etapa 3: cargue de evaluaciones realizado por ChatGPT
**Versión base:** v167 · **Modo:** administración por IA, sin importación manual para el usuario

## Reparto de responsabilidades

**Docente/administrador:** escanea los exámenes con su herramienta habitual, genera/exporta el Excel de EvalBee y comparte el archivo en la conversación de ChatGPT. Si las claves oficiales de respuesta no están ya registradas, facilita también el archivo de claves, el cuadernillo u otra fuente autorizada. No tiene que abrir Supabase, ejecutar SQL, copiar y pegar claves ni realizar importaciones manuales.

**ChatGPT:** trabaja en la conversación donde están adjuntos los archivos, inspecciona exhaustivamente las hojas, cruza las identificaciones y las respuestas contra la edición correcta, prepara un diagnóstico, carga los datos mediante el conector Supabase, consulta nuevamente la BD y reporta totales, errores y excepciones. **No puede cargar archivos que todavía no se hayan compartido ni actuar en segundo plano por sí solo.** No debe pedir al usuario que haga el cargue técnico.

## Estado real al crear este módulo

| Edición | Estado | Estructura | Inscripciones | Resultados |
|---|---|---:|---:|---:|
| 2026-1S | cerrada (histórico protegido) | 625 ítems, 625 claves | 877 | 699 |
| 2026-2S | borrador (destino previsto) | 625 ítems, 0 claves | 0 | 0 |

Los números son una fotografía inicial, no valores incrustados en la aplicación. El dashboard consulta valores actualizados a través de `public.roque_v3_admin_preflight_edicion`. El sistema estudiantil vigente todavía consume la ruta histórica; **esta etapa NO habilita la consulta multisemestre**.

## Al recibir el Excel (procedimiento obligatorio del asistente)

1. Identificar la **edición destino** explícitamente. Por defecto para el próximo cargue es `2026-2S` si sigue siendo un borrador; nunca cargar en `2026-1S`.
2. Leer TODAS las hojas del Excel; identificar nombres de columnas reales. **No asumir** que todas las exportaciones de EvalBee tienen el mismo formato. Conservar los ID de prueba como texto, incluidos ceros iniciales.
3. Determinar el número de filas y de registros distintos, ID vacíos/duplicados, grado/curso/sede, sesiones presentes y preguntas respondidas. Cruzar con la configuración existente de `grados`, `sesiones`, `areas`, `items`.
4. Examinar las **claves oficiales**: no generar respuestas correctas a partir de la mayoría de respuestas estudiantiles, no reutilizar automáticamente las claves de `2026-1S`, no adivinar respuestas o número de sesión.
5. Identificar cada alumno en `roque_private.personas` por un identificador documental válido cuando esté presente; si no, clasificar como caso ambiguo **sin fusionar identidades por nombre**. Las inscripciones se registran por edición en `roque_private.inscripciones`, y un mismo alumno puede pertenecer a diferentes ediciones con un ID de prueba distinto.
6. Presentar al usuario un resumen comprensible del archivo, las filas válidas y los conflictos que impedirían un cargue fiable; resolver inconsistencias con fuentes verificables antes de modificar datos. La IA ejecuta las operaciones técnicas, no el usuario.
7. Ejecutar la carga con operaciones de base de datos **delimitadas por edición**, idealmente en transacciones atómicas, con comprobación de `ediciones.estado='borrador'` y `resultados_visibles=false`. No usar SQL destructivo (DELETE, TRUNCATE) ni operaciones que actualicen filas históricas. No introducir secretos en scripts del frontend ni en GitHub.
8. Cargar en secuencia: personas nuevas si procede, inscripciones para la edición, claves `items` respaldadas por fuente oficial, presentaciones por sesión (incluyendo ausencias conocidas) y resultados. Evitar claves de otra edición, duplicados y resultados huérfanos; registrar la procedencia como `origen` donde corresponda.
9. **Después del cargue:** consultar `public.roque_v3_admin_preflight_edicion('2026-2S')` desde una sesión administrativa autorizada y verificar conteos independientes de alumnos, resultados, preguntas y claves. Contrastar conteos por grado contra el Excel. Reportar los registros rechazados, si existieran, sin exponer PII.
10. Mantener el estado en **borrador** hasta tener calidad de datos suficiente y completar el flujo de publicación supervisada. La RPC de preflight **nunca publica**, y su `preparada_para_revision=true` no equivale a autorizar ni ejecutar una publicación.

## Reglas innegociables

- `2026-1S` y cualquier edición publicada/cerrada se tratan como **inmutables**.
- Una edición se identifica por el código `AAAA-1S` o `AAAA-2S`, no por el año solamente.
- El `id_prueba` podría repetirse en otra edición y eso NO identifica por sí mismo a la misma persona.
- Los resultados de una edición se relacionan con inscripciones de **esa misma edición**, jamás con registros por coincidencia parcial de nombre.
- Ninguna credencial de servicio de Supabase se almacena en cliente, repositorio o documento de importación.
- No cargar, crear claves oficiales ni publicar a partir de información incompleta o inventada.
- No alterar el reporte actual del estudiante hasta implementar las etapas 4–5.

## Qué ofrece v167 ahora

- `public.roque_v3_admin_preflight_edicion(text)`: solo lectura, ejecutable por Supabase Auth con autorización activa en `roque_private.operadores_admin`. Devuelve conteos y pendientes sin datos personales.
- Panel `Administración > Ediciones y pruebas`: seguimiento visible del cargue, métricas reales y advertencias para cada edición. La configuración manual heredada se mantiene como **herramienta técnica opcional**, oculta inicialmente.
- PWA v167 con caché renovada.

## Qué queda pendiente hasta recibir archivos

La **importación real del segundo semestre** no puede ejecutarse sin el Excel de EvalBee y las claves oficiales correspondientes. Cuando estén disponibles se utilizará el conector Supabase desde la conversación; el usuario solo aporta el archivo. La publicación y las vistas multisemestre para estudiantes/docentes corresponden a los pasos posteriores del plan.
