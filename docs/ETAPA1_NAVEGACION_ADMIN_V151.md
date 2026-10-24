# Etapa 1 · Navegación administrativa v151

## Alcance
Se sustituyeron los 15 botones de la cabecera administrativa por un panel de navegación agrupado. La funcionalidad de las pestañas se conserva; `renderAdminTab()`, operaciones de Supabase, estudiantes, docentes, coordinadores y reportes de estudiantes no se modificaron.

## En computadores (más de 1000 px)
- Barra lateral de 242 px, con desplazamiento interno y resaltado de la sección activa.
- Categorías: Inicio; Pruebas y evaluaciones; Personas; Análisis y estadísticas; Configuración.
- Versión de la app y Cerrar sesión en el pie del menú.
- La cabecera institucional ocupa menos espacio y no contiene pestañas.

## En móviles y tabletas (hasta 1000 px)
- Barra inferior con Inicio, Pruebas, Personas, Menú.
- Pruebas abre únicamente: Ediciones, Resultados, Claves, Exámenes sin estudiante, Alertas.
- Personas abre: Estudiantes, Docentes, Matriz.
- Menú abre todas las categorías, incluso Estadísticas y Configuración.
- Botón adicional Menú en la cabecera del contenido, útil como acceso alternativo.
- El menú desplegable ofrece cierre con X, toque fuera, tecla Escape y Cerrar sesión.

## Compatibilidad
- Se conserva `data-action="admin-tab"` y `data-tab` de las 15 vistas originales; ninguna función se elimina.
- En esta etapa NO se modifican bases de datos, permisos ni usuarios.
- La clase `adm151-shell` permite aplicar CSS solo cuando la sesión es de administrador.
- La vista de estudiantes y sus detalles de respuestas permanecen iguales.
- No se cambia navegación de docentes/coordinadores: corresponde a la Etapa 2.
- Se renuevan versiones de CSS/JS y caché de la PWA a v151.

## Pruebas sugeridas tras publicar
1. Iniciar sesión con la cuenta administrativa de Supabase Auth.
2. En computador, recorrer cada sección del lateral y comprobar que la opción activa se resalte.
3. En móvil, comprobar Inicio, Pruebas, Personas y Menú; cerrar panel tocando X o fuera.
4. Abrir Ediciones y pruebas e iniciar la consulta; no crear ediciones de prueba en producción.
5. Abrir Estadísticas, Claves, Resultados y Supabase; validar contenido y datos reales.
6. Cerrar sesión, entrar como docente y estudiante y confirmar que sus interfaces NO cambiaron.
7. Si la PWA conserva una cabecera antigua, recargar la aplicación y comprobar v151.

Las pruebas estáticas incluyen sintaxis JS, rutas de las 15 vistas y presencia del CSS aislado en HTML y en el service worker. Se requiere prueba final visual en navegadores reales.
