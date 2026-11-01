# v175.5 · Encabezado de asignatura y colores flat

- Se elimina la barra superior redundante del modal estudiantil.
- El encabezado ahora inicia con **Prueba**, asignatura, puntaje sobre 100, nombre, curso y edición activa; botón cerrar integrado.
- Color flat propio de cada asignatura; para contraste en blanco, los tonos saturados claros se representan por variantes ligeramente más oscuras de la misma familia.
- Icono sobre placa blanca cuadrada de 56×56 (46×46 en móvil), radio 8–10px.
- Los cuatro estados de respuesta conservan sus diferencias: correcto (color base), incorrecto (oscurecido), doble marca (tinte medio), sin marcar (tinte claro con borde). Sin degradados.
- Barra de componentes y competencias, controles y acentos del modal: color plano de la asignatura.
- No se modifican respuestas, claves, fórmula de calificaciones, rankings, dock ni permisos de Supabase.
- El CSS nuevo tiene alcance exclusivo .student-subject-modal; no altera modales docentes ni administrativos.

Verificar visualmente en móvil: Matemáticas, Religión, Naturales, Sociales; encabezados largos, cierre, desplazamiento, detalle de respuestas y pestañas Componentes/Competencias. Verificar que el semestre mostrado coincide con el activo, que el dock permanece debajo del modal y que el modal conserva z-index superior.
