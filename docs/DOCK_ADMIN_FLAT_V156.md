# RoqueObjetiva v156 — navegación flat y translúcida

## Diseño
La barra de administración móvil y sus paneles se han refinado en respuesta a la revisión del acabado v155, que resultaba opaco y excesivamente brillante.

- **Estilo flat:** superficies de color azul hielo uniforme, sin degradados en los componentes móviles.
- **Transparencia real:** dock con `rgba(196, 228, 246, .56)`; menú con `rgba(223, 241, 251, .67)` y cabecera/pie translúcidos.
- **Desenfoque:** `backdrop-filter: blur(3px)`, también en WebKit.
- **Esquinas:** máximo 4 px en dock, menú y controles estilizados.
- **Animaciones:** se conservan las transiciones suaves de entrada/salida, la aparición escalonada de elementos y el respeto por `prefers-reduced-motion`.

## Alcance
CSS limitado a la navegación administrativa móvil. El menú lateral de computador no cambia, ni la interfaz estudiantil. No se modifica Supabase, las notas o las funciones de consulta. Se versionan los recursos estáticos de la PWA como v156.

## Verificaciones
JS y service worker válidos. Se conservan 15 secciones administrativas, los cuatro accesos del dock, el blur 3 px, la transparencia y los radios de 4 px. Verificación visual pendiente en dispositivo real.

## Prueba
Actualizar la aplicación hasta v156, abrir el panel administrativo desde un celular y desplazarse hasta que haya contenido visible detrás del dock. Abrir Pruebas, Personas y Menú: deben permitir percibir sutilmente el contenido posterior, sin perder legibilidad. Comparar con v155.