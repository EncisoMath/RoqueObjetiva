# RoqueObjetiva v155 — Rediseño del dock administrativo móvil

## Estilo aplicado
- Barra inferior con fondo en degradado azul hielo, transparencia medida y backdrop-filter exactamente 3px (incluye -webkit-backdrop-filter para Safari).
- Acceso activo con contraste azul, borde fino, iluminación discreta y subrayado animado.
- Esquinas **máximo 4px** en todos los elementos nuevos de la barra y el panel móvil. No se alteran las tarjetas ni el menú lateral de escritorio.
- Panel inferior con fondo de degradado frío, blur 3px, esquinas superiores 4px, sombra suave y altura automática según contenido.

## Animaciones
- Entrada escalonada de los 4 botones inferiores y de los renglones del panel.
- Abertura: fondo se oscurece progresivamente; el panel asciende con transición de 350ms.
- Cierre: el panel baja suavemente y el fondo se desvanece; la navegación a otra sección espera ~235ms para completar el cierre.
- Estado pulsado: reducción temporal de escala y cambio de color.
- Respeta prefers-reduced-motion: reduce; animaciones y transiciones desactivadas cuando el sistema así lo solicita.
- Apertura tras doble requestAnimationFrame para garantizar transición visible sin saltos.

## Funcionalidad conservada
- Grupos visibles: Pruebas (5 opciones); Personas (3); Menú (Análisis, Configuración).
- Las 15 vistas administrativas y eventos data-action siguen funcionando.
- Cierre mediante X, toque fuera o Escape; cierre de sesión también espera la animación.
- Recuperación de enfoque al botón de la barra; fondo no desplazable mientras esté abierto.
- Ningún cambio en Supabase, resultados, controles de consultas, docentes, coordinadores ni vista de estudiantes.

## Pruebas
1. Abrir administrador en celular y confirmar v155.
2. Presionar Pruebas; comprobar entrada ascendiendo, aparición por filas y botones de categoría.
3. Elegir una sección; comprobar salida del panel sin desaparecer abruptamente.
4. Abrir Personas y Menú, cerrar con X y toque fuera. Comprobar los accesos conservados.
5. Presionar cada botón inferior y confirmar microanimación y estado activo.
6. En PC confirmar navegación lateral como antes; en una cuenta de estudiante, interfaz original.
7. Si la PWA instalada mantiene v154, actualizar y reabrir.

Validado en código: sintaxis JS y service worker, mapeo de las 15 rutas, 4 accesos inferiores, estilo blur 3px, radios máximos de 4px en componentes modificados, y apertura/cierre con callback.
