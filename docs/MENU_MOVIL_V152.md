# RoqueObjetiva v152 — refinamiento del menú móvil administrativo

## Cambios
- Los paneles Pruebas, Personas y Menú ahora tienen **altura natural** según sus elementos. No queda un espacio vacío hasta el borde superior de la pantalla.
- Se eliminó el botón Menú duplicado de la cabecera del contenido: el acceso está únicamente en la barra inferior del celular.
- **Pruebas** lista solo Ediciones y pruebas, Resultados, Claves, Exámenes sin estudiante y Alertas de sesiones.
- **Personas** lista solo Estudiantes, Docentes y Matriz de estudiantes.
- **Menú** lista únicamente Análisis y estadísticas (Estadísticas, Mapa por grado) y Configuración (Asignaturas y áreas, Apariencia, Logos, Supabase). No repite Pruebas ni Personas ni Inicio.
- Cuando se selecciona Pruebas o Personas se suprime el subtítulo de grupo repetido; el encabezado del panel ya lo identifica.
- En teléfonos pequeños el menú tiene altura máxima adaptable y scroll **dentro** del panel cuando haga falta. El fondo no se desplaza mientras esté abierto.
- Se conserva el cierre con X, toque fuera y Escape; cerrar sesión limpia el estado del panel.
- El menú lateral de PC no cambia de estructura ni estilos.

## Compatibilidad
Ningún cambio en rutas administrativas, cálculos, ediciones, API, docentes, coordinadores o reportes de estudiantes. Solo se modificaron `js/app.js`, `css/admin-navigation.css`, `index.html`, `service-worker.js` y `version.json`. Supabase y datos institucionales no requieren cambios.

## Prueba móvil después de publicar
1. Refrescar la PWA y confirmar versión v152.
2. Entrar en el administrador y verificar que **no haya botón Menú junto al título**.
3. Pulsar Pruebas: observar 5 opciones en un panel corto sin espacio vacío; seleccionar Claves.
4. Pulsar Personas: observar 3 opciones en panel todavía más corto; seleccionar Docentes.
5. Pulsar Menú: observar únicamente Análisis y estadísticas y Configuración.
6. Confirmar que se puede cerrar tocando X o fuera, cambiar de sección y salir.
7. En PC confirmar que el menú lateral conserva todos los accesos previos.

Validación estática realizada: JavaScript y service worker parsean; 15 rutas administrativas; filtrado por grupos; limpieza del estado de apertura; referencias CSS y PWA v152.
