# RoqueObjetiva v172.1 · Pantalla de evaluaciones tras el ingreso

## Flujo aprobado
1. El alumno usa el **mismo ID/documento de siempre** en la pantalla original.
2. La validación `roque_v4_login_controlado_private` sigue aplicando límites del navegador, roles y filtros de 2026-1S.
3. Tras el mensaje de carga, **no se abre automáticamente el informe**. Aparece «Tus evaluaciones».
4. La edición de mayor fecha se muestra grande en «ÚLTIMA EVALUACIÓN». Hoy es **2026-2S**, con candado «PRÓXIMAMENTE» porque permanece borrador y con resultados ocultos.
5. Bajo «HISTORIAL» aparecen las anteriores, hoy **2026-1S**, en tarjeta más compacta y con acción «Abrir evaluación».
6. Al seleccionar una edición autorizada, se carga **el informe estudiantil de siempre** con notas, asignaturas, gráfico y ranking. Hay botón «← Evaluaciones» para regresar sin cerrar sesión.

## Acceso y privacidad
- Se agrega `public.roque_v5_portada_ediciones()`, RPC de metadatos públicos (código, título, año, semestre, estado y visibilidad) ordenados del más reciente al antiguo. **No entrega claves, respuestas, matriculados ni identidades**.
- Una tarjeta solo puede abrirse si el semestre está `publicada`/`cerrada`, `resultados_visibles=true` **y** corresponde a la edición ya autorizada por el login histórico. Hoy esa edición es exclusivamente 2026-1S.
- **2026-2S NO se puede abrir** mientras esté en borrador. Su publicación futura por sí sola no amplía permisos: será necesario habilitar previamente una autorización por edición/persona dentro del backend (sin suponer que un ID visible es una contraseña).
- Se retira de la UI el botón adicional de «Mis evaluaciones · cuenta personal» de v172. No es necesario ese acceso para usar la nueva portada.
- Las rutas SQL de v172 se conservan para compatibilidad pero ya no se cargan los archivos de su interfaz, y no se ha asociado ninguna cuenta estudiantil.
- Una recarga de la PWA con sesión estudiantil guardada **revalida el ingreso desde Supabase**, no muestra notas desde un caché local sin autorización.
- No se modifica el renderizador `renderStudent`, `prepareStudentRankingContext`, las métricas o el flujo de docente y administrador.

## Archivos tocados
- `js/app.js`: catálogo, vista previa, navegación y sesión.
- `css/student-editions.css`: diseño flat oscuro/claro, sin degradados, esquinas <= 4 px.
- `index.html`, `service-worker.js`, `version.json`: assets y versión 172.1.
- `supabase/23_catalogo_publico_portada_v172_1.sql`: RPC de metadatos.

## Pruebas
- Con ID de alumno válido: aparece la portada tras la carga.
- 2026-2S es la tarjeta grande; marca «PRÓXIMAMENTE» y no es un enlace.
- 2026-1S aparece bajo «HISTORIAL»; pulsar abre el mismo informe y ranking que antes.
- Pulsar «← Evaluaciones» vuelve a la portada y permite reabrir 1S.
- «Salir» cierra sesión; nueva entrada conserva límite de consultas.
- Recargar portada con sesión guardada debe mostrar la portada (no un informe con datos parciales).
- Entradas de profesor/admin **no pasan** por la portada estudiantil.
- PWA versión v172.1 actualiza los assets nuevos y descarta el caché v172 anterior.

## Estado inicial comprobado
- 2026-1S cerrada y visible: 877 inscripciones, 699 resultados, 625 claves.
- 2026-2S borrador y no visible: 0 inscripciones, 0 resultados, 0 claves oficiales.
- No se han tocado filas académicas de ninguno de los dos semestres.

## Límite deliberado
La portada es multisemestre; la lectura segura de **datos personales** de 2026-2S no puede probarse hasta recibir su Excel, claves y definir el esquema de autorización para alumnos de esa edición. Esta entrega deja la experiencia visual y la separación de ediciones listas sin inventar resultados ni permisos.
