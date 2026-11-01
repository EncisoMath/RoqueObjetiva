# RoqueObjetiva v175.11 — Panel Docente compacto

Fecha: 2026-11-01. Rama: `main`.

## Diseño actualizado
- Hero del rol docente: **Panel Docente** y el nombre real del profesor, a partir de `state.teachers`. Otros roles mantienen sus títulos anteriores.
- En la vista de asignaturas se elimina el cuadro de presentación redundante.
- Selectores de asignatura y curso: **2 columnas y 1 fila**, también en móvil. Sus etiquetas siguen accesibles para lectores de pantalla.
- Indicadores: **Estudiantes, Promedio y puntos por ítem** en **3 columnas**, con iconos existentes de usuarios/gráfica/capas. Se conserva la acción informativa del tercero.
- Pestañas Componentes y Competencias más delgadas, y **Resumen de desempeño** como `details` plegable con barras y textos más compactos. Solo cambia su presentación, no el cálculo.
- Tarjeta Estudiantes: nombre de sección y botón «Ver respuestas correctas» en la misma fila; tabla compacta de cuatro columnas sin ancho mínimo de 620px.
- El estilo `css/teacher-dashboard.css` solo se aplica bajo `.teacher-assignments-ui`, por lo que evita cambiar dirección de grupo, coordinación, administración y estudiantes.
- Se mantienen los filtros, acciones de respuesta correcta, ordenación de estudiantes, apertura de resultados individuales, calificaciones y permisos.

## Pruebas recomendadas
Desde un acceso docente autorizado: cambiar asignatura y curso; abrir valor por ítem, alternar Componentes y Competencias, plegar el resumen, pulsar «Ver respuestas correctas», ordenar cada columna de la tabla y abrir el detalle de estudiante. Validar en móvil y escritorio y revisar que el dock docente siga visible.

No se ejecutaron operaciones SQL ni se modificaron resultados.
