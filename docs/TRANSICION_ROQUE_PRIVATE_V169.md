# RoqueObjetiva v169 — Transición de lectura a roque_private

## Qué cambiamos
- Datos académicos del primer semestre **ya existían** en `roque_private`: 877 inscripciones, 625 claves y 699 resultados almacenados. No se hizo una segunda copia ni se vaciaron las tablas `public`.
- Nueva función `public.roque_v4_login_controlado_private` autorizada con el **mismo** control `roque_v2_login_controlado`: usuario, rol, alcance docente y bloqueo/límite de consultas.
- Tras el login, solo cambia `datasets.estudiantes`, `datasets.keys` y `datasets.resultados`. Las asignaciones `carga` y `directoresGrupo`, los perfiles docentes y la autenticación siguen en la ruta existente, para no modificar permisos.
- La función lee únicamente `2026-1S`, exige que esté visible y su estado sea publicado o cerrado. **Nunca lee `2026-2S` mientras sea borrador.**
- Las claves se leen por `edicion + grado + numero_item` y las respuestas desde el JSON de resultados privados, sin suponer que Matemáticas ocupa siempre las mismas posiciones.
- El navegador sigue utilizando las estructuras HTML y los calculadores actuales. No se rediseña el reporte ni se alteran los rankings destacados.
- `origen_academico` indica `roque_private` o la causa de un respaldo `legacy_*`. `edicion` indica el semestre activo.

## Respaldo y paridad
En cada llamada se comparan **identidad y contenidos** de estudiantes, respuestas y claves entre `public` y `roque_private`. Si cambia cualquier valor o cantidad, la llamada devuelve **todos los datos académicos del sistema legacy** (sin mezclar fuentes); esto protege el aplicativo en producción. Un cambio manual hecho en las tablas antiguas activará dicho respaldo hasta que se reconcilie de forma segura, sin sobrescribir automáticamente el histórico privado.

### Estado auditado de 2026-1S antes del cambio
- 877 estudiantes registrados en ambos esquemas, misma identidad, grado, sede y curso.
- 625 claves idénticas por grado, ítem, área, respuesta correcta, componente y competencia.
- 699 resultados totales idénticos; **696 resultados visibles** al aplicar filtro `activo` y matrícula activa (tres se conservan, pero no se exponen).
- `2026-2S` permanece borrador, con 0 inscripciones, 0 resultados y sin claves oficiales.

## Límites actuales y próximos trabajos

1. **Escritura administrativa:** el botón existente “Guardar y subir” todavía usa `public.roque_v3_admin_guardar_resultado` y escribe en `public.resultados`. En cuanto se produce una corrección manual, la verificación de paridad hará que las lecturas futuras retornen temporalmente al legado. Antes de retirar el respaldo debe crearse un procedimiento **auditado de corrección por edición**, con autorización explícita para un histórico cerrado y escritura transaccional.
2. **Rankings:** `roque_v2_ranking_controlado` todavía calcula con datos históricos de `public`. Esto sigue produciendo el mismo resultado mientras las copias coincidan, pero necesita migrarse a un cálculo por edición antes de habilitar otros semestres.
3. **Autenticación/roles:** la detección de alumnos y los permisos docentes siguen basándose en las tablas originales; antes de mostrar resultados de `2026-2S` deben reconocer inscripciones por edición y usar un selector de evaluación. Esas tareas corresponden a las etapas 4 y 5.
4. **Publicación:** preparar RPC de publicación supervisada con comprobación estricta (claves, inscripciones, resultados, ausencias, integridad por sesión). No habilitar publicación automática.
5. **Prueba en dispositivo real:** la validación de SQL y de sintaxis PWA no reemplaza la prueba de login en navegador, panel docente, ranking ni botón de guardado. Si se observan diferencias, el fallback conserva el flujo anterior mientras se investiga.
6. **Migración final:** después de las pruebas y adaptación de escrituras, eliminar la dependencia de las tablas antiguas. No borrarlas sin respaldo y autorización específica.

## Seguridad
La función es `SECURITY DEFINER`, pues las tablas privadas tienen RLS y no están expuestas; **pero primero ejecuta obligatoriamente el login controlado anterior** y genera el nuevo conjunto únicamente a partir de los IDs y grados autorizados por él. No crea acceso anónimo a las tablas `roque_private`; la respuesta académica tiene el mismo alcance que ya tenía el usuario. Se concede `EXECUTE` solo a los roles necesarios para ese login (`anon` y `authenticated`), como en el endpoint protegido anterior.

## Cómo revertir inmediatamente si hiciera falta
En `js/app.js`, cambiar la llamada dentro de `studentLoginRpc` de `roque_v4_login_controlado_private` a `roque_v2_login_controlado`, incrementar el número de versión PWA y publicar. Ninguna fila antigua ha sido eliminada o reescrita por esta transición.

**No interpretar esta versión como finalización del sistema multisemestral:** queda operativa la lectura del período histórico, no la publicación ni los reportes de un nuevo semestre.
