# RoqueObjetiva v159 — menú administrativo según referencia visual

## Comportamiento y aspecto
- La hoja móvil oscura termina **justo encima** de la barra fija, con offset de 67 px más el área segura del teléfono.
- El dock permanece visible, en primer plano y utilizable mientras se abre el panel; sus cuatro botones son Inicio, Pruebas, Personas y Menú.
- Se resalta el botón que abrió el panel. Pulsar otro grupo cambia la categoría sin cerrar la navegación.
- Se añade indicador superior de arrastre visual: permite cerrar mediante toque; también se conserva el toque fuera o Escape.
- Se elimina el botón X grande, el pie de versión y la barra de cierre de sesión separada.
- Se añade Cerrar sesión como última fila dentro de la lista.
- Cada opción es un botón oscuro flat con separadores finos, icono a la izquierda y pequeña flecha a la derecha.
- Sin oscurecer el fondo de la página; menú azul marino casi opaco, blur de 3 px, esquinas hasta 4 px.
- Se conservan la animación de entrada y salida y la aparición escalonada de filas.

## Protección de funciones
Se conservan las 15 rutas administrativas y sus mismos manejadores de eventos. No se modifica el menú de PC, el informe de resultados estudiantiles, los docentes/coordinadores ni Supabase.

## Verificación
- JavaScript y service worker sin errores de sintaxis.
- Todas las rutas de menú presentes.
- Pruebas (5 opciones), Personas (3), Otros (Análisis y Configuración) con estado visual correcto del dock.
- Tras cerrar, se retira el estado de seleccionado y el panel.
- Hoja posicionada con `bottom: var(--adm159-dock-height)`, dock con z-index superior al overlay.
- Se conservaron esquinas 4 px, blur 3 px y fondo transparente fuera de la hoja.

## Prueba de usuario
Abrir v159 en móvil como administrador, pulsar Pruebas y comprobar que aparece encima del dock. Pulsar Personas o Menú mientras está abierto; probar opciones, Cerrar sesión, pulsar fuera y la barra superior. En PC, comprobar que el menú lateral no cambia.
