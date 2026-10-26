# RoqueObjetiva v174 · Informe estudiante con tarjetas y grid de áreas

## Diseño y alcance
Cambios confinados a `renderStudent(roll)` de `js/app.js` y a `css/student-dashboard.css`, además de versión y registro PWA. No se modificaron respuestas, notas, claves, RPC, ranking, Supabase, roles administrativo/docente, ni el dock inferior.

### Jerarquía del informe
1. Tarjeta superior independiente con insignia de grado, nombre del alumno, ID, sede y grado/curso.
2. Tarjeta de puntaje global Saber con nota en escala /500, indicador gráfico (sin texto porcentual) y acceso a la misma explicación de cálculo `global-info`.
3. Dentro de la tarjeta global, dos bloques horizontales de ranking por curso y ranking por grado, con sus posiciones reales ya calculadas.
4. «Resultados por área»: grid de **dos columnas** para móvil y escritorio, con logotipo actual, nombre corto, nota /100, y barra del color propio de la materia.

### Paleta de barras
- Matemáticas #6366d9
- Lenguaje #ee525a
- Naturales #1ba65a
- Inglés #16b7d6
- Sociales #268dc4
- Ética #efb400
- Artística #e7b800
- Educación Física #4eb7ad
- Informática #8297a7
- Religión #dc6b9a

No hay cifras de porcentaje visibles. El tamaño de la barra sigue mostrando la proporción de la nota real. Los valores académicos son `student.globalScore`, `student.courseRank`, `student.gradeRank`, `student.subjectStats[subject.name].score`; **no se cambian fórmulas ni criterios**.

### Funcionalidad
Pulsar cada tarjeta llama `openStudentSubjectModal(subject)`, reaprovechando el detalle existente de respuestas, correctas, incorrectas, dobles, sin marcar y ranking por asignatura. Se conserva `openGlobalScoreInfo` para explicar el puntaje global. Identidad y rankings muestran los mismos datos que antes.

### Verificación
Prueba de render con 10 materias y puntajes de ejemplo, sintaxis JS y service-worker, versiones PWA, paleta, cuadrícula y compatibilidad del modal: 15 aserciones positivas. Los números de ejemplo son **datos sintéticos usados solo en la prueba**, no se escribieron en el repositorio ni en Supabase.

### Qué revisar en pantalla
Abrir examen de estudiante en móvil y escritorio, comprobar orden de tarjetas, las 2 columnas a la vez, barras coloreadas, notas /100, ausencia de «%», iconos, ranking, scroll por encima del dock y apertura del modal de Matemáticas y otra área. Confirmar que admin/docente tienen su vista previa intacta.

## Recuperación
Revertir el PR v174 si se requiere el diseño anterior; ningún dato académico requiere reversión.
