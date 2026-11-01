# RoqueObjetiva v175.4 — Dock estudiantil persistente

Fecha: 2026-11-01. Alcance: frontend y PWA. No se alteran Supabase, calificaciones ni permisos.

## Problema resuelto
El dock estaba anidado en `#app` y `renderShell()` lo creaba repetidamente con cada pantalla. Las transiciones `#app.route-view-leave` y `#app.route-view-enter` ocultaban y movían el dock, además de convertir `#app` transformado en bloque contenedor de un elemento `position:fixed`.

## Diseño adoptado
- Se crea `#student-dock-root` una vez, fuera de `#app`.
- `renderShell()` renderiza el informe o Historial y llama a `syncPersistentStudentDock()`.
- El dock solo se monta una vez por sesión; los siguientes renders actualizan `is-active`, `aria-current`, `disabled` y el nombre del semestre **sin reconstruir botones**.
- La etiqueta mantiene el semestre seleccionado: `2026-1S` o `2026-2S`.
- La transición de `#app` ya no altera la opacidad, la posición ni la existencia del dock.
- `clearSession()` y `renderLogin()` desmontan el dock al finalizar la sesión.
- Las variables de CSS que antes heredaba de `.roque-student-shell` se declaran sobre `.student-bottom-dock`.

## Pruebas de regresión
Iniciar 2573 y recorrer: 2026-2S -> Historial -> 2026-1S -> Historial -> Detalle -> Historial -> 2026-2S. Comprobar que hay exactamente un dock visible, inmóvil, sin parpadeos, sin reaparecer ni ocultarse durante el cambio de pantalla. Verificar funcionamiento y superposición de los modales, cambio de etiqueta de semestre y salida. Comprobar en móvil y escritorio.
