# RoqueObjetiva v175.13 — Dirección de grupo

## Aplicado exclusivamente a Docentes → Director de grupo

1. **Tarjetas de asignaturas:** la barra de progreso ahora toma `STUDENT_AREA_COLORS[subject.name]`, idéntica al color de la tarjeta del estudiante. Sin degradados.
2. **Modal de asignatura del grupo:** reutiliza el encabezado `student-subject-hero` (icono sobre placa blanca cuadrada, fondo exacto del área y textos blancos). Muestra asignatura, grupo, edición y promedio del grupo /100. Las barras de componentes, competencias y la pestaña activa toman el mismo color plano.
3. **Estudiantes y Promedio:** dos tarjetas compactas del mismo ancho, con iconos de usuarios y gráfica, texto y números legibles. Corrige la regla antigua que forzaba incorrectamente tres columnas.
4. **Resumen de desempeño:** usa el mismo componente `teacherAggregateMetricsHtmlForDetails(details,{dashboard:true})` del panel docente, con pestañas dentro, gráfica reducida, panel desplegable y chevrón SVG.
5. **Tabla:** incorpora «Estudiantes» y «Ver respuestas correctas» en su propia cabecera, conservando columnas y ordenación, con estilo compacto de panel docente.

Las reglas compartidas de `css/teacher-dashboard.css` se aplican únicamente a la vista de asignaturas del docente y a `.director-detail-modal`; no afectan a estudiantes ni a administración.

## Verificación de regresiones
- Ir a Director de grupo, tocar Matemáticas y luego Artística; comprobar que la barra exterior, encabezado y barras del modal coinciden con el color del alumno.
- Verificar los dos contadores, plegar/abrir Resumen, cambiar Componentes/Competencias y abrir «Ver respuestas correctas».
- Ordenar columnas y abrir detalles individuales de estudiantes, cerrar modal y comprobar tarjetas del grupo.
- Probar pantalla estrecha y escritorio. No modifica claves, resultados, inscripciones, fórmulas ni Supabase.

Versionado PWA v175.13.
