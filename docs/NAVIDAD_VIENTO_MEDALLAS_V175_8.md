# v175.8 — Navidad más visible con viento; medallas intactas

**Decisión de diseño**
- **Hero normal**, del 1 de noviembre al 6 de enero en `America/Bogota`: 16 partículas ❄ 🍪 ⛄ 🎁 de entre 29 y 45 px, con trayectorias diagonales, variaciones de velocidad y ráfagas de viento.
- Las partículas se mantienen estrictamente en `.top-banner` con `overflow:hidden`, detrás del texto y el escudo. No interactúan con el contenido.
- **Top 3**: primero, segundo y tercero conservan las **estrellas de sus banners de medalla**, y sus colores oro/plata/bronce. Sus estrellas tienen prioridad incluso en fechas navideñas.
- Fuera de temporada, los banners normales recuperan las figuras geométricas anteriores.
- Se respeta `prefers-reduced-motion`: adornos estáticos, sin caídas.

El movimiento no usa una trayectoria recta: 7 puntos en la animación con oscilaciones laterales, frenadas y dos ráfagas. Se conserva el escalonamiento de inicio, las distintas duraciones y el comportamiento responsivo.

Sin cambios de Supabase, notas, rankings, dock, estructura del hero o permisos.
