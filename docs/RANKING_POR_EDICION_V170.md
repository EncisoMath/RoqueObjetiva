# RoqueObjetiva v170 · Rankings por edición en `roque_private`

## Objetivo
Migrar **cálculos** de ranking del esquema histórico `public` a `roque_private`, sin introducir nuevos resultados ni modificar las notas de `2026-1S`.

## RPC de cálculo privada
- `roque_private.ranking_calculo_por_edicion(p_login, p_edicion)` se construyó a partir de la fórmula comprobada `public.roque_get_student_ranking_context_v124`. Conserva el puntaje por área (0 si no intentó, 20–100 si intentó), ponderación global de las cinco áreas Saber (3+3+3+3+1, escala 0–500), desempates por correctas, apellidos, nombres e ID.
- Tablas: `roque_private.inscripciones`, `roque_private.resultados` y `roque_private.items` filtradas por **misma edición y grado**; cada pregunta ya posee su área, sin asumir rangos fijos.
- Solo contempla ediciones con `resultados_visibles=true` y estado `publicada`/`cerrada`.
- Es `SECURITY INVOKER` y no tiene permiso `EXECUTE` para `PUBLIC`, `anon`, `authenticated` ni `service_role`.

## RPC pública y control de acceso
- `public.roque_v3_ranking_controlado_edicion(p_login,p_terminal,p_edicion DEFAULT '2026-1S')` mantiene el control heredado: terminal identificable, perfil consultado en los últimos 60 minutos y coincidencia del `id_prueba`.
- **Por ahora solo acepta `2026-1S`**, porque la autorización de terminales todavía no lleva un identificador de edición. No debe habilitarse otro semestre hasta adaptar la autenticación y el rastreo de consultas en las etapas 4 y 5.
- Verifica paridad de datos entre el histórico `public` y `roque_private`, alineándose con la ruta de respaldo de v169. Si hay diferencias, obtiene el ranking protegido de v2 (también entrega solo el registro del alumno).
- Aunque el motor interno calcula un conjunto por grado, **solo devuelve la fila del propio estudiante** en `grado_rows` y `curso_rows`, junto con puestos y totales. El navegador no obtiene datos de otros alumnos.
- Aporta `ranking_areas` para las **cinco áreas principales** (Matemáticas, Lenguaje, Naturales, Sociales, Inglés), cada una con `puesto`, `total` y `puntaje`; no agrega nuevos datos personales al frontend.
- `anon` y `authenticated` pueden ejecutar únicamente la RPC pública protegida; sin una consulta válida el servidor la rechaza.

## PWA
- `js/app.js` pide la RPC nueva; solo ante una función ausente (`404/PGRST202`) recurre a v2. No permite eludir límites o restricciones con otro error.
- Preserva los puestos globales por **grado y curso** y los efectos de ranking/medallas en el reporte existente.
- Guarda los puestos por área en memoria y muestra, debajo de correctas/incorrectas/sin marcar, una frase breve de puesto por asignatura para el alumno autenticado. La apariencia sigue siendo flat, esquinas de máximo 4 px.
- PWA y service worker actualizados a **v170**.

## Verificaciones realizadas
1. Para un alumno de **cada grado 6, 7, 8, 9 y 10**, se comparó la función anterior con la nueva: misma respuesta `ranking` completa, mismo puntaje global, mismo puesto, mismo universo por grado y curso.
2. La nueva RPC, invocada desde una terminal de prueba, rechazó una terminal no autorizada y rechazó `2026-2S` en borrador.
3. Tras simular una visita reciente, devolvió **exactamente una fila** para el ranking por grado y una por curso, sin compañeros. También devolvió puestos por áreas y conservó la misma clasificación global que v2.
4. La simulación de visita se revirtió íntegramente mediante una subtransacción: **no quedaron registros** de consulta de prueba.
5. Se comprobaron sintaxis JavaScript y service worker, versiones e inclusiones CSS.
6. Las consultas de ranking no insertaron ni modificaron estudiantes, claves ni resultados de ninguno de los semestres.

## Qué sigue sin migrar
- El panel administrativo **Guardar y subir** todavía escribe resultados históricos en `public` (será v171): habrá que hacer correcciones auditadas por edición y reconciliación segura.
- El selector de semestre para alumnos, docentes y coordinadores, con control de acceso por edición (v172).
- La publicación revisada de `2026-2S` (v173), una vez recibidos Excel y claves oficiales.
- Pruebas de experiencia real en navegadores y dispositivos móviles para cerrar la validación de despliegue.

## Reversión
Si aparece una regresión visual o funcional, sustituir en `tryPrepareStudentRankingContextFromRpcV124` la llamada `roque_v3_ranking_controlado_edicion` por `roque_v2_ranking_controlado`, actualizar PWA/caché y desplegar. La RPC anterior se mantiene operativa. No se han eliminado tablas `public`.
