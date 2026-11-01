# v175.6 — Colores exactos del modal de asignatura

- Se eliminó por completo `STUDENT_MODAL_COLORS`: era una segunda paleta oscurecida.
- Ahora el modal usa `STUDENT_AREA_COLORS[subject]`, la **misma variable** que colorea cada tarjeta del informe. Por ejemplo, Artística = `#e7b800`, Matemáticas = `#6366d9`.
- Cabecera, pestañas Componentes/Competencias, barra de progreso y acento de valor por ítem: color exacto de la asignatura, plano, sin degradados.
- Las opciones de respuestas **no** heredan el color de la materia; son fijas y planas:
  - Correcta `#7CB342`
  - Incorrecta `#F44336`
  - Doble marca `#FFCA28`
  - Sin marcar `#607D8B`
- Los cuatro colores también se aplican a la leyenda del modal.
- Ninguna nota, respuesta, ranking, dock o dato de Supabase se modifica.

QA de interfaz: abrir Artística, Matemáticas y Naturales para verificar que sus cabeceras tienen exactamente el color de la barrita exterior. Revisar respuestas de todos los estados y leyendas.
