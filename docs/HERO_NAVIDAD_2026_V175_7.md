# RoqueObjetiva v175.7 — Navidad con nieve confinada al hero

**Periodo automático:** 1 de noviembre a 6 de enero (inclusive), en horario `America/Bogota`. Fuera de esas fechas, regresan los triángulos, cuadrados, cruces y círculos normales; en los banners de medalla, regresan sus estrellas. No hay que activar ni desactivar nada manualmente.

En la temporada se reemplazan SOLO las figuras de fondo del encabezado por 16 partículas de ❄, 🍪, ⛄ y 🎁. Caen con ritmos y desplazamientos laterales escalonados dentro del banner; `overflow:hidden` garantiza que nunca lleguen al contenido o al dock. No bloquean clics ni tapan la interacción.

La animación respeta `prefers-reduced-motion`. El color del banner, los premios de ranking, el nombre y el escudo no se modifican. El login mantiene su animación geométrica separada.

## Verificaciones de límites (Bogotá)
- 31/oct 23:59:59 — desactivado
- 1/nov 00:00:00 — activado
- 25/dic — activado
- 6/ene 23:59:59 — activado
- 7/ene 00:00:00 — desactivado

No se realizaron cambios en Supabase, permisos, estudiantes, calificaciones ni docks.
