# v175.113 — Optimización de acceso docente

## Incidencia
Los registros de PostgREST confirmaron `canceling statement due to statement timeout` al generar los resultados completos de 2026-1S durante el login y al repetir esas consultas al seleccionar 2026-2S.

## Modificaciones
- El login de **todo el personal docente** entrega únicamente la carga, dirección de grupo, rol y metadatos necesarios para escoger edición; ya no genera todos los exámenes en la autenticación.
- La edición seleccionada carga los resultados desde `roque_private`, filtrados por cargas y direcciones del docente. Coordinadores y administradores conservan su alcance institucional.
- Se sustituyeron búsquedas correlacionadas repetidas sobre JSON de inscripciones por una lista de IDs validada una sola vez.
- Compatible con **2026-1S** y **2026-2S**. El histórico público y privado de 2026-1S fue contrastado y coincide en estudiantes, claves y respuestas.
- Se conservan los controles de dispositivo bloqueado, sesiones de coordinación, roles de Supabase y máscara de restricciones/anulaciones. Se mantiene el inicio especial de Jaider Moreno.
- Se conserva la RPC de auditoría de ingreso y su registro de accesos.
- No cambia contenido, notas, permisos ni navegación de otras pantallas.

## Pruebas
- Login de Docente, Coordinador y Administrador, con rol de servidor y token de coordinación esperado.
- Acceso a ambas ediciones por docente; 2026-1S y 2026-2S.
- Consulta 2026-2S de Coordinador: 1.027 inscritos y 866 resultados cargados.
- Checksum de respuestas enmascaradas sin diferencias para 2026-1S y 2026-2S.
- Ejecución RPC privada no concedida a anon; los RPC públicos conservan acceso controlado por comprobación de identidad.
