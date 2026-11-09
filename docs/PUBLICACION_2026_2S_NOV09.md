# Publicación general 2026-2S — 9 de noviembre de 2026

Hora oficial: **00:00 America/Bogota**, equivalente a **05:00 UTC**.
Servidor: **Supabase EncisoMath**, proyecto `wkbczbjexnwbmyscrhah`.

## Qué se habilita
- Exámenes reales de **2026-2S** para todos los estudiantes con inscripción activa, incluida la población sin registro en 2026-1S.
- Lectura de cada estudiante por su ID de prueba o documento con payload limitado a su propio examen.
- Claves válidas por grado, respuestas reales enmascaradas según medidas, y puestos/ranking personal mediante RPC `roque_v22_ranking_publicado_2s`.
- Selección de 2026-2S en el frontend sin excepción exclusiva para la cuenta 2573.

## Precisión temporal
- `roque_private.ventana_publicacion_2s()` usa el reloj de PostgreSQL: acceso cerrado antes de `2026-11-09 05:00:00+00`, abierto desde ese instante.
- Un Cron activo (zona `GMT`, expresión `0 5 9 11 *`) desactiva `portal_access_gate.pause_students` el 9 nov 2026; el propio SQL lleva un límite de fecha para impedir ejecuciones posteriores.
- El desbloqueo por hora no depende de que el usuario actualice la PWA ni de que Cron ejecute exactamente en el primer segundo.

## Seguridad y datos
- Se conservan bloqueos disciplinarios individuales, anulaciones, auditoría de accesos, limitación diaria por navegador y bloqueo de dispositivos.
- Los exámenes históricos `2026-1S` mantienen las restricciones de consulta temporal hasta la fecha configurada originalmente (19 nov).
- No se modifican notas, respuestas, inscripción ni claves.
- Al programar: 1027 inscripciones activas y 866 resultados activos para 2026-2S; estudiantes sin resultado almacenado no reciben una nota inventada.

## Verificación previa
- Supabase confirmó `visible_now=false`, `visible_second_before=false`, `visible_at_midnight=true`.
- Cron activo: `roque_publicar_2026_2s_20261109_0000_co`.
- Login y ranking 2S continuaron bloqueados durante la preparación.
- Validación en una sesión real de estudiante tras las 00:00 queda pendiente.
