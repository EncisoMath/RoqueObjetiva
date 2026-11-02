# v175.12 — Resumen docente unificado y Dirección de grupo

- Componentes/Competencias: ambos botones ahora están DENTRO de la tarjeta desplegable "Resumen de desempeño", entre el título y las barras. Su función de alternar métricas continúa usando la misma acción y cálculos originales.
- Flecha: se reemplazó la letra "⌄" por un icono SVG de trazo grueso en contenedor de 30×30 px, borde suave y giro al abrir/cerrar. El despliegue usa el elemento nativo `details` (teclado y accesibilidad).
- Dirección de grupo: se eliminó el bloque repetido que mostraba "DIRECTOR DE GRUPO", nombre y grupo. El nombre del docente ya aparece en el hero. Se conservan las pestañas de rol, selector "Grupo a cargo", tarjetas de materias y tabla.
- Se mantienen todas las fórmulas, calificaciones, clave de respuestas, datos de estudiantes y permisos de Supabase.
- Archivos modificados: JS del panel, CSS de dashboard docente, HTML/CSS cacheado, service worker y versión.
## Verificación manual
En móvil: asignaturas → comprobar un solo contenedor con Resumen / botones / gráficas; plegar, desplegar, cambiar de pestaña. Ir a Dirección de grupo → ver el selector de grupo directamente, sin tarjeta de presentación. Confirmar que los botones del dock docente y las notas permanecen igual.
