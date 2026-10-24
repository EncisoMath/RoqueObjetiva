# RoqueObjetiva v153 — Diagnóstico y corrección de lentitud en inicio de sesión

## Síntomas
Pantalla "Bienvenido" percibida como extremadamente lenta en dispositivo móvil.
Revisión estática del repositorio v152 encontró tres costos evitables:

1. La regla tardía `loginBreath ... !important` aplica un filtro animado de brillo/saturación a **toda la pantalla**, incluso en móviles. En una regla anterior se intentó desactivar, pero prevalece la última con `!important`.
2. El fondo contiene 12 figuras animadas continuamente y una capa translúcida de `backdrop-filter: blur(18px)`; provocan composición/recalculado gráfico costoso en algunos equipos.
3. El service worker usa network-first y `cache:"reload"` para **cada** JavaScript y CSS, incluso los versionados con `?v=...`, lo que genera descargas innecesarias en posteriores aperturas. Además, el helper de configuración añadía `Date.now()` a URLs JSON, generando nuevas entradas de caché por visita.

## Cambios, cuidadosamente limitados
- `css/login-performance.css`: desactiva animación a pantalla completa, dejando los colores intactos. En móviles detiene animación de figuras, elimina backdrop blur (fondo de tarjeta ligeramente más opaco) y elimina drop-shadow del logo.
- `service-worker.js`: JS y CSS **con ?v=VERSION** se sirven cache-first. Los assets cambian su URL en cada actualización. Documentos, JSON, manifest y solicitudes Supabase siguen red/servidor primero; ningún resultado se cachea por este ajuste.
- `js/app.js`: reemplaza el cache-busting `Date.now()` en las peticiones de configuración con el número de versión. Las peticiones siguen siendo `cache:no-store` y el SW las procesa red primero.
- PWA v153: actualización de todas las referencias de assets en HTML, manifiesto y caché.

## Límites de esta revisión
Se trata de una optimización basada en análisis de código, no una medición de FPS ni de latencia en el teléfono. La carga inicial de configuración todavía espera una consulta RPC de ajustes públicos a Supabase. Si la pantalla sigue lenta tras actualizar, capturar en DevTools las pestañas Performance y Network en móvil para distinguir retraso de red, GPU y JavaScript.

## Comprobaciones
- Verificada sintaxis de app.js y service-worker.js.
- CSS acotado a login; no se cambian vistas de estudiante, docente, coordinador o admin.
- Cache-first solo para CSS/JS versionados, cache bypass completo de URLs Supabase.
- Archivo CSS registrado en index y en APP_SHELL; se conservan todas las rutas de la aplicación.

## Prueba sugerida
1. Abrir en móvil y actualizar hasta ver v153.
2. Si es PWA instalada, cerrar y abrir de nuevo después de actualizar para usar nueva caché.
3. Escribir, tocar Ingresar, probar tarjetas de últimos accesos.
4. Probar perfil estudiante, panel docente y panel admin como antes.
5. Comparar sensación de fluidez; medir si es posible con DevTools.