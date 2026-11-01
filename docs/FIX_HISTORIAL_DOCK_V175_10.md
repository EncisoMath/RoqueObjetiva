# v175.10 — Historial sin resaltado sobre el dock

Problema: al tocar una tarjeta de examen situada detrás del dock, su resaltado táctil azul podía verse sobre la botonera en el móvil.

Corrección exclusivamente de estilos:
- Elimina `-webkit-tap-highlight-color` de las tarjetas de evaluación; conserva el contorno `:focus-visible` para navegación accesible con teclado.
- `#student-dock-root` recibe capa de apilamiento propia, por encima del historial, por debajo del modal de asignaturas (z-index 300).
- El dock conserva fondo blanco totalmente opaco y su posicionamiento fijo. No se cambian iconos, dimensiones, textos, estado activo ni navegación.
- Las tarjetas siguen siendo desplazables bajo la barra; dejan de transparentarse visualmente a través de ella.
- Actualiza recursos versionados de la PWA para no reutilizar CSS anterior.

Prueba en móvil: Historial → tocar 2026-1S desde la parte baja, deslizar la página detrás del dock, volver a Historial y verificar que el rectángulo azul no cubre la barra.
Sin cambios en Supabase, calificaciones, resultados, permisos o fechas.
