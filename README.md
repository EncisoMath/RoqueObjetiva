# RoqueObjetiva

Aplicación web para la consulta de resultados de pruebas objetivas de la **IED Roque de los Ríos Valle**.

Permite a estudiantes, docentes y directivos revisar resultados académicos, puntajes por área y rankings de desempeño de forma sencilla y visual.

## Versión

RoqueObjetiva v175.72


## v175.72 · Restauración del dock original por rol

Se restaura el **mismo dock `t160-dock`** y los mismos menús desplegables `t160-menu-layer` para Docente, Coordinador y Administrador, conservando animaciones, indicador activo, colores, alturas y diálogos originales. Se elimina la navegación administrativa alternativa creada en v175.71.

- **Estudiante:** sin cambios.
- **Solo Docente:** Carga, Dirección de grupo si está asignada, y botón directo Cerrar sesión.
- **Coordinador:** Carga, Dirección de grupo si está asignada, Coordinador (Mover estudiantes, Estadísticas, Consultar estudiante) y Cerrar sesión. Recupera los permisos de consulta de su carga y dirección propios, sin acceso a Claves.
- **Administrador:** Carga, Dirección de grupo cuando hay direcciones registradas, Coordinador con las mismas tres opciones, Administrador (Asignaturas, Personal docente, Claves de respuestas) y Cerrar sesión. Las vistas Carga/Director usan selector de docente, y los movimientos de estudiantes utilizan la RPC administrativa auditada.
- **Todos los menús:** reutilizan exactamente la misma estructura CSS de menú del docente (`t160-menu-panel`, `t160-menu-item`) y el mismo dock tanto en escritorio como en celular. El panel Admin ya no muestra un sidebar separado.
- **Supabase:** se conservan las RPC administrativas y auditoría de movimientos de v175.71 y el control de Claves solo para Admin. No se modifican datos ni se necesita migración adicional.
- **PWA:** caché `resultados-pwa-v175-72-dock-roles-original`.

## v175.71 · Pestañas definitivas por rol

- **Docente**: Asignaturas y Director de grupo (solo si dispone de dirección). Vistas sin cambios de cálculos ni presentación.
- **Coordinador**: únicamente Mover estudiantes, Estadísticas y Consultar estudiante. Tres accesos directos en dock; sin pantallas de Asignaturas, Director de grupo ni Claves. El endpoint de consultar claves ahora es exclusivo del Administrador y la antigua RPC de Anular del Coordinador ha perdido EXECUTE.
- **Administrador**: Asignaturas, Director de grupo, Mover estudiantes, Estadísticas, Consultar estudiante, Claves de respuestas y Personal docente. Elige el docente que desea consultar para reutilizar sus vistas de Asignaturas y Director de grupo.
- Administrador utiliza `roque_v14_admin_mover_listar` / `roque_v14_admin_mover_guardar`, con autorización `auth.uid()` + `operadores_admin` y auditoría independiente `movimientos_curso_admin`; no se suplanta al Coordinador.
- Menús de escritorio y móvil simplificados; se conservan los archivos de herramientas antiguas sin exponerlas en las pestañas.
- PWA v175.71 con nueva caché para que todos reciban la navegación actualizada.

## v175.70 · Equivalencias de PNG en carga académica

- Se corrige la equivalencia de `Lengua castellana` con el área `LENGUAJE`, para mostrar su PNG real y mantener todas las asignaturas vinculadas a su área.
- Se renueva la caché PWA para distribuir la corrección. No se modifican datos ni roles existentes de Supabase.

## v175.69 · Roles y áreas en Admin → Docentes

- El selector de **Rol** (y su filtro) admite **Administrador**, **Coordinador** y **Docente**. La creación de personal también permite elegir uno de esos tres roles.
- Supabase conserva la clasificación en `public.docentes.rol` y sincroniza `coordinador`. Las cuentas existentes mantienen su clasificación sin cambios.
- **Seguridad:** elegir el rol institucional Administrador no da permisos de acceso al panel administrativo: requiere una cuenta Supabase Auth incluida en `roque_private.operadores_admin`.
- Las tarjetas de **Carga académica** muestran cada asignatura con el nombre y PNG de su **área**, según `public.mapeo_areas`. Para variantes no catalogadas (Constitución, Lengua castellana, Educación religiosa, Educación ética y valores) se usan equivalencias académicas.
- El selector para agregar una carga se agrupa por área sin cambiar la asignatura realmente almacenada.
- Migración `roque_v175_69_roles_y_areas_docentes` desplegada; nueva caché PWA v175.69.

## v175.68 · Editar datos alineado a la izquierda

- En **Coordinador/Admin → Consultar estudiante**, el botón **Editar datos** queda alineado a la izquierda dentro de su propia fila, en móviles y escritorio. Conserva su aspecto azul sólido.
- Solo se modifica la alineación de CSS y se renueva la caché PWA. No se cambia Supabase ni la lógica de edición.

## v175.67 · Botón Editar datos y ficha limpia en Consulta estudiante

- El botón **Editar datos** utiliza el estilo azul sólido con texto blanco en negrita del botón **Componentes** (#1386bf), ancho compacto, altura de 35 px y radio de 4 px.
- Se elimina por completo el botón **Otra búsqueda** y su manejador. Para seleccionar otro estudiante sigue disponible el buscador superior y su autocompletado.
- Sin cambios en las RPC, permisos, respuestas, notas ni datos de Supabase. Nueva caché PWA para actualizar la interfaz.

## v175.66 · Consultar estudiante con la interfaz idéntica a Estudiante

- Se corrigió el alcance CSS de `css/student-dashboard.css`: la misma presentación del informe estudiantil se comparte entre `.roque-student-shell` y `.rce-report`. Se recuperan tarjetas blancas, puntaje global azul, medallas/rankings, cuadrícula de dos columnas, iconos, barras y colores reales por área.
- La ficha del alumno se compacta: nombre, curso, sede, IDs y botón **Editar datos**; al pulsarlo se despliegan los campos y **Guardar cambios**, conservando el guardado auditado en Supabase.
- Se elimina el encabezado redundante "Vista del estudiante" para que el informe aparezca inmediatamente debajo de la ficha.
- Se actualiza la caché PWA a v175.66. No se cambian calificaciones ni inscripciones de Supabase.

## v175.65 · Consultar estudiante: Admin y Coordinadores

- **Nueva pestaña:** Administración → Personal → Consultar estudiante; menú de Coordinación → Consultar estudiante. Acceso móvil en la navegación.
- **Sin lista permanente:** filtros de grado, sede y curso; búsqueda por nombre, apellido, documento o ID de prueba, con sugerencias tras escribir dos caracteres y un máximo de doce coincidencias.
- **Ficha editable:** nombres, apellidos, sede, grado, curso, documento e ID de prueba; guardado directo en Supabase con control de concurrencia y auditoría de la persona que editó.
- **Resultados como Estudiante:** reutiliza exactamente las tarjetas de puntaje global, rankings por grado/curso, grid de asignaturas con colores originales y modal con respuestas, componentes y competencias.
- **Datos por edición:** historial 2026-1S con resultados reales. Cuando 2026-2S no tiene inscripciones propias, la búsqueda utiliza el registro institucional, indicando que aún no existen notas de esa edición.
- **Seguridad:** RPC protegidas para buscar, consultar detalles y guardar. Admin requiere Supabase Auth; Coordinadores requieren sesión vigente validada en servidor. Se registra un historial privado de modificaciones.
- **PWA:** nuevos archivos `js/consulta-estudiante.js` y `css/consulta-estudiante.css` precargados en v175.65. Diseño flat, esquinas de 4px.

## v175.64 · Coordinadores pueden anular y reactivar ítems

- En **Coordinador → Claves de respuestas** se habilitan los interruptores **Anular / Reactivar** para ediciones **en borrador**. El cambio se guarda inmediatamente sin necesidad de un botón adicional.
- Las letras de respuesta correcta siguen siendo exclusivas de **Administrador**; la función SQL del coordinador solo altera `roque_private.items.anulada`.
- Supabase valida cada solicitud con la **sesión vigente del coordinador**, comprueba el estado anterior para evitar cambios concurrentes y registra docente, edición, grado, pregunta y fecha en la tabla privada `roque_private.auditoria_anulaciones_coordinador`.
- Una pregunta anulada sin clave no puede reactivarse hasta que Administración le asigne una respuesta. Las ediciones cerradas y sus claves históricas permanecen protegidas.
- Se actualizan la caché PWA y la visualización móvil de los interruptores habilitados.

## v175.63 · Anular y Reactivar guardan directamente en Supabase

- **Anular inmediato:** cada pulsación de Anular / Reactivar persiste únicamente esa pregunta mediante `roque_v12_claves_guardar` con verificación de concurrencia y auditoría, sin depender de Guardar cambios.
- **Reactivación sin respuesta:** si la pregunta anulada no tenía clave, solicita escoger A–H antes de reactivarla y guarda automáticamente al elegir la respuesta.
- **Feedback y seguridad:** indicador Guardando, confirmación de éxito/error y reversión visual si Supabase rechaza la operación; cambiar respuestas normales sigue usando Guardar cambios.
- **Permisos preservados:** lectura para Coordinador, edición para Administrador en 2026-2S y protección de anulaciones históricas. Sin migración SQL necesaria; nueva caché PWA.

## v175.62 · Claves más compactas en móvil y botón Anular / Reactivar

- **Corrección responsive:** eliminado el desbordamiento horizontal de las filas (que ocultaba el control Anular) mediante columnas calculadas con `minmax(0,1fr)`, opciones flexibles que se adaptan al ancho y un contenedor limitado al viewport. En ítems con más de cuatro opciones, el desplazamiento queda contenido en las propias respuestas.
- **Separaciones constantes:** se aplica `gap:10px` al listado interior `#rak-body` y espacio uniforme a grado, sesiones, materias, indicadores y filas; las cuatro tarjetas siguen en una sola fila con tipografía menor.
- **ABCD:** letras con peso normal (`font-weight:500`) incluso para la respuesta correcta; se conserva el verde de selección.
- **Control visible:** el antiguo checkbox oculto se sustituyó por un botón accesible y compacto `Anular` / `Reactivar` con `aria-pressed`, que actualiza la pregunta, el número de activas/anuladas y habilita Guardar cambios de forma inmediata.
- **Permisos preservados:** Coordinador tiene el control deshabilitado, ya que es de **solo lectura**; Administrador puede anular o reactivar en **2026-2S** (borrador). En **2026-1S** (cerrada) solo puede corregir respuestas justificadas, sin cambiar anulaciones históricas.
- **Guardar sin saltos:** tras confirmar el RPC, se sincroniza el estado local sin solicitar nuevamente toda la lista ni cambiar de sesión/asignatura. Se rehabilitan las opciones y los controles tras el guardado y se conservan ediciones pendientes si el servidor rechaza la operación.
- **Supabase:** la RPC `roque_v12_claves_guardar` y sus restricciones permanecen intactas; cambio de interfaz y caché PWA v175.62.

## v175.61 · Claves de respuestas generales por grado (Admin / Coordinador)

- **Nueva pantalla:** Administrador → Configuración → Claves de respuestas; Coordinador → Claves de respuestas. Diseño móvil flat según captura: selector Grado, pestañas Sesión 1 / 2 según disponibilidad, asignaturas, ítems, opciones, interruptor Anulada y contadores del área. Esquinas de 4 px, sin botón Restablecer.
- **Edición común:** utiliza automáticamente la prueba seleccionada en el hero; no presenta segundo selector de Edición. Cada clave pertenece a `(edicion, grado, numero_item)`, por lo que aplica a **todos los cursos y sedes de ese grado**.
- **Opciones:** muestra A–D habitualmente; en Inglés y otros ítems que utilizan E–G, habilita las letras adicionales para conservar las claves originales. La numeración visible reinicia dentro de cada asignatura, mientras que el guardado utiliza el número global del ítem.
- **Roles y guardado:** el Coordinador puede consultar las claves mediante su sesión validada, sin herramientas de modificación. El Administrador puede editar respuestas y anulaciones en ediciones en borrador. Los cambios se guardan por lote y se auditán en `roque_private.auditoria_correcciones`, sin refrescar el portal entero.
- **Seguridad histórica:** en la edición cerrada `2026-1S` se permite corregir respuestas con motivo obligatorio (10–500 caracteres) mediante la función histórica `roque_v4_admin_corregir_claves_edicion`, que mantiene sincronizadas `public.claves` y `roque_private.items`. Anular ítems históricos continúa bloqueado para proteger los resultados publicados.
- **Integridad:** actualizaciones con verificación de valores originales para evitar sobrescribir cambios de otra sesión. La consulta nunca entrega claves sin sesión de Coordinador válida o administrador autenticado; la RPC de escritura solamente tiene EXECUTE para `authenticated` y exige ser operador administrador activo.
- **Supabase:** migración aplicada `supabase/32_claves_institucionales_v175_61.sql`, con `roque_v12_claves_consultar` y `roque_v12_claves_guardar`. Probada la lectura autenticada, denegación de sesiones inválidas, escritura de borrador y sincronización de claves históricas, con `ROLLBACK` para no alterar exámenes.
- **Frontend/PWA:** `js/admin-claves.js`, `css/admin-claves.css`, rutas del Administrador y Coordinador, recursos precacheados, versión `v175.61`.

## v175.60 · Paletas originales de barras de Estadísticas

- Paleta **asignaturas** extraída de la primera imagen del usuario, en orden: `#1976D2`, `#0288D1`, `#0097A7`, `#00796B`, `#388E3C`, `#689F38`, `#AFB42B`, `#FBC02D`, `#FFA000`, `#F57C00`, `#E64A19`. Las asignaturas conservan su tono al cambiar filtros, según el orden institucional (5 áreas principales primero).
- Paleta **cursos de una sola asignatura** extraída de la segunda imagen: `#1976D2`, `#0288D1`, `#0097A7`, `#00796B`, `#388E3C`, `#689F38`, `#AFB42B`. Se usa al activar **Por curso** con una asignatura seleccionada, tanto en la leyenda agrupada por sede como en las barras.
- Si hay más barras que colores, los tonos se reutilizan cíclicamente. Sin cambios de cálculos, permisos, funciones o datos de Supabase. Recursos PWA versionados a v175.60.

## v175.59 · Tarjetas centradas, foco de filtros y comparación por curso con asignatura

- **Selects sin raya superior:** corregido el anillo de enfoque que se recortaba por `overflow:hidden` de las etiquetas. El foco de teclado mantiene un borde interno visible.
- **Tarjetas KPI:** iconos, números y textos centrados horizontal y verticalmente, con la misma fila de cuatro tarjetas incluso en móviles.
- **General / Por curso con asignatura:** el switch de Promedio por asignatura aparece si hay asignatura filtrada, aunque no haya grado seleccionado o incluso si hay un curso seleccionado; continúa apareciendo al filtrar únicamente un grado.
- **Cursos de diferentes grados:** al filtrar una sola asignatura para toda la institución, se distinguen simultáneamente grado, sede y curso. Las leyendas muestran el grado correcto y el gráfico reserva espacio para barras múltiples con desplazamiento horizontal interno.
- **Supabase:** migración aplicada `supabase/31_estadisticas_desglose_por_grado_v175_59.sql`, actualizando la misma RPC `roque_v11_estadisticas_institucionales` sin alterar su firma, datos, permisos o controles de acceso.
- Actualizados los recursos y caché PWA a v175.59.

## v175.58 · Estadísticas: sede, cuatro columnas y periodo compartido

- **Edición sincronizada:** se elimina el selector redundante en Estadísticas. En Coordinador usa `teacherEditionSelected` (el periodo del selector del hero); en Administrador usa `academicEdition`. Al cambiar la edición se reinician los filtros locales y se consultan los datos de la nueva prueba.
- **Cuatro filtros en una sola fila:** Sede, Grado, Curso, Asignatura (incluye teléfonos móviles). Si se escoge Sede, el resto de los conteos y promedios se calculan exclusivamente en esa sede. El Curso contiene una clave interna sede/curso para evitar mezclar grupos con códigos idénticos de sedes diferentes.
- **Cuatro métricas en una sola fila:** Inscritos, Resultados, Promedio (100) y Básico o superior. Sin porcentaje adicional de participación en Resultados registrados. CSS de 4 columnas permanentes con tipografías optimizadas a 320–390 px.
- **Orden de barras:** Matemáticas, Lenguaje, Ciencias Naturales, Ciencias Sociales y Ciudadanía e Inglés primero; todas las demás después en orden alfabético. También se conserva el orden cuando se agrupa por cursos.
- **Comparación por curso:** identificador (sede, curso), colores estables dentro del gráfico y leyenda agrupada por sede, evitando repetir el nombre de la sede por cada curso.
- **Supabase:** nueva RPC `roque_v11_estadisticas_institucionales` y migración aplicada `supabase/30_estadisticas_sedes_v175_58.sql`. Mantiene control de acceso administrador o coordinador, ítems anulados excluidos y retornos agregados sin datos personales. La versión anterior v10 queda intacta por compatibilidad.
- **Validación:** consulta 2026-1S con 877 inscritos; filtro de sede Municipal en grado 6 devuelve solamente sus inscritos y resultados sin mezclar los de San Sebastián. Caché PWA v175.58.

## v175.57 · Estadísticas compactas en móvil + nuevos niveles de desempeño

- **Móvil real:** contenedor limitado al viewport, corregido el desbordamiento de los gráficos y grids que ocultaba Grado, Asignatura, resultados y tarjetas a la derecha. La pantalla mantiene 2 × 2 filtros y 2 × 2 indicadores en móviles pequeños. La comparación por asignaturas se desplaza únicamente DENTRO del gráfico, sin ensanchar el portal.
- **Responsive:** `css/admin-estadisticas.css` usa además container queries, para respetar el ancho efectivo del panel en Coordinador y Administrador. Títulos, controles, indicadores, barras y anillo más compactos y sin bordes redondeados de más de 4 px.
- **Niveles nuevos:** **Superior (≥90)**, **Alto (80–89)**, **Básico (60–79)**, **Bajo (<60)**, implementados en la RPC `roque_v10_estadisticas_institucionales` y la leyenda. Particiones mutuamente excluyentes y exhaustivas sobre las notas evaluadas.
- **Indicador de ≥60:** renombrado como `Básico o superior (≥60)` para evitar confundirlo con un nivel antiguo. Preservado el cálculo de promedios, los filtros, los ítems anulados y el control de acceso.
- **Supabase:** migración `supabase/29_niveles_desempeno_v175_57.sql` aplicada sin cambios de datos ni permisos. PWA actualizada a v175.57.

## v175.56 · Estadísticas Institucionales (Administrador y Coordinador)

- Nueva pantalla **Estadísticas** en Administrador y en el menú Coordinador. Diseño responsive basado en la referencia: filtros Edición, Grado, Curso y Asignatura; tarjetas de inscritos, resultados, promedio y proporción satisfactoria; barras por asignatura y anillo de distribución del desempeño.
- **Sin filtros:** cifras institucionales generales de la edición seleccionada, barras por asignatura y anillo; no se muestran componentes.
- **Solo grado:** alternador **General / Por curso** dentro de Promedio por asignatura. Por curso presenta una barra delgada por curso en cada asignatura, identificada por color y leyenda. El curso exige haber seleccionado primero el grado.
- **Grado + curso:** indicadores y barras únicamente del grupo elegido, sin componentes.
- **Con asignatura:** se muestra el bloque **Componentes – asignatura**, con sus porcentajes de aciertos. Nunca se muestran componentes si no se elige una asignatura.
- **Cifras reales:** los resultados vienen de `roque_private.inscripciones`, `roque_private.resultados` y `roque_private.items`. Se excluyen ítems anulados. La nota por materia sigue `20 + 80 × aciertos / preguntas válidas`, y el promedio institucional refleja la media de las calificaciones disponibles por estudiante. Los componentes se presentan como porcentaje de aciertos.
- **Sin invenciones:** Supabase contiene 877 inscripciones y 699 resultados crudos de 2026-1S (696 resultados vinculados a inscripciones activas). En 2026-2S hay 825 ítems, 2 anulados, sin inscripciones ni resultados; se muestra estado vacío con 0, no los números ilustrativos de la captura.
- **Seguridad:** migración aplicada y versionada en `supabase/28_estadisticas_institucionales_v175_56.sql`. RPC `roque_v10_estadisticas_institucionales` protegida por sesión de administrador (`auth.uid` y `operadores_admin`) o sesión de coordinador válida y vigente. Responde **solo agregados**; no entrega datos identificables ni respuestas de estudiantes.
- **Frontend:** `js/admin-estadisticas.js` y `css/admin-estadisticas.css`, cargados por `index.html`, precacheados con la PWA v175.56. Sin recargas de página al filtrar.
- **Pruebas de datos:** validado nivel institucional 2026-1S, curso de sexto con Matemáticas (3 componentes), edición 2026-2S sin resultados y rechazo a consultas sin autorización.

## v175.55 · Corrección estructural del parpadeo en Docentes

- **Administrador:** `renderAdmin()` conserva el DOM del hero, sidebar, dock móvil y menú al cambiar de pantallas. Actualiza solo el contenido del panel, el título, el indicador activo y el tema. Así no se reinician partículas ni posiciones del dock.
- **Docentes:** eliminado `document.startViewTransition()` sobre toda la página, sus pseudo-elementos y animaciones que trasladaban/escalaban contenedores. Los cambios de Gestión / Carga académica / Dirección de grupo sustituyen únicamente `.rp-tab-content`; los botones de las pestañas y la cabecera mantienen su nodo y posición.
- **Controles internos:** abrir/cerrar edición de información o asignaciones, y desplegar cursos de una materia, actualiza únicamente el formulario o tarjeta afectada. No reemplaza el resto de contenedores ni las imágenes PNG. Se mantiene búsqueda, scroll y contexto del docente al volver.
- **Dock y Volver:** eliminados escalados al pulsar, traslaciones de iconos y animaciones que alteraban la posición. Alturas estables en móvil.
- **Íconos:** los PNG de `ICONOS/` se muestran directamente, sin ningún recuadro de color, fondo ni borde en el contenedor del icono.
- **Modales:** `#modal-root` tiene una capa global por encima del dock administrativo, con interacción en sus hijos y el toast aún más arriba. El resto de la página sigue debajo.
- **Sin cambios en Supabase:** se conservan RPC, permisos, datos, asignaciones y auditoría. Recursos y caché PWA actualizados a v175.55.

## v175.54 · Transiciones y recursos visuales de Personal Docente

- **Navegación suave:** animación de entrada/salida de la ficha de docente y cambios Gestión / Carga académica / Dirección de grupo; se usa View Transitions cuando el navegador lo admite, con alternativa Web Animations. Solo se anima `#roque-personal`, dejando hero y dock intactos. Se respeta `prefers-reduced-motion`.
- **Guardado fluido:** se evita el doble redibujado después de un RPC confirmado, se mantiene el desplazamiento del listado y el estado de la pestaña. Cada operación continúa verificada por Supabase.
- **Pestañas:** altura compactada a 48 px (47 px en teléfonos pequeños), iconos SVG de ajustes, libro abierto y grupo de personas. Esquinas de máximo 4 px.
- **Docentes:** avatar de iniciales (primer nombre y primer apellido; ejemplo CARLOS JULIO PÉREZ → CP) tanto en el listado como en la ficha.
- **Asignaturas:** los recursos originales `ICONOS/*.png` reemplazan los símbolos de relleno. Aritmética, Estadística, Álgebra, Geometría, Cálculo y Matemáticas comparten `ICONOS/matematicas.png`; el resto de áreas usa el PNG correspondiente cuando existe.
- **PWA:** módulo y hojas de estilo versionados v175.54, nuevo `css/admin-personal-motion.css` precacheado. Sin cambios en bases de datos ni roles.

## v175.53 · Personal Docente (solo Administrador)

- **Nueva pestaña Docentes:** aparece en el menú lateral y en el dock móvil del Administrador. Se muestran ficha del docente, búsqueda por nombre/ID, filtros por sede/rol y contador real de Supabase. En escritorio, lista y detalle en columnas; en móvil, navegación lista → ficha.
- **Gestión:** crear docente, modificar nombre/sede, activar o desactivar, y habilitar o deshabilitar el rol de coordinador. El identificador institucional es inmutable después de crear la ficha para no romper relaciones.
- **Carga académica:** ver asignaturas agrupadas con sus grados y cursos, agregar asignaciones y retirarlas individualmente. La retirada desactiva la fila de carga sin borrar su histórico.
- **Dirección de grupo:** asignar, cambiar o retirar una sede, grado y curso por docente.
- **Supabase:** migración `supabase/27_personal_docente_v175_53.sql` aplicada. Dos RPC: `roque_v9_admin_personal_listar` y `roque_v9_admin_personal_guardar`, restringidas a JWT de administradores activos en `roque_private.operadores_admin`. Auditoría de operaciones en `roque_private.auditoria_personal_docente`, sin permisos de lectura pública.
- **Fuentes de verdad:** `public.docentes` (50 fichas al desplegar) y `public.carga_docente` (496 cargas activas). Las imágenes de referencia contienen datos ilustrativos; se muestran los registros reales, no una cifra ficticia de 63.
- **Frontend:** `js/admin-personal.js` y `css/admin-personal.css`, cargados y precacheados por la PWA v175.53. Los cambios se aplican dentro del módulo sin reiniciar el portal. No se han modificado notas, ítems ni resultados.

## v175.52 · Limpieza de pantallas de Administrador y Coordinador

- **Ambos roles:** retiradas del menú y del enrutamiento las pantallas independientes **Estudiantes**, **Resultados**, **Claves de respuestas** y **Estadísticas**. Se preservan los cálculos y utilidades compartidas necesarios para otras vistas.
- **Solo Administrador:** retiradas además **Ediciones y pruebas**, **Exámenes sin estudiante**, **Alertas de sesiones**, **Matriz de estudiantes** y **Docentes**. Se impide reabrir pantallas eliminadas por enlaces antiguos; cualquier pestaña retirada se reconduce a Inicio.
- **Coordinador:** único acceso dentro de su menú: **Mover estudiantes**, incluyendo docentes coordinadores que no tengan asignaturas ni dirección de grupo. Se conservan el acceso docente independiente a Carga y Dirección de grupo cuando existan, la selección de evaluación, el guardado por estudiante y su auditoría.
- **Administrador:** quedan **Inicio, Mapa por grado, Asignaturas y áreas, Apariencia, Logos y Supabase**. El dock móvil muestra Inicio, Mapa y Ajustes; la opción Cerrar sesión permanece en Ajustes. No quedan grupos de menú vacíos.
- **PWA:** incrementada la versión de caché a v175.52. Sin borrados de datos, tablas o RPC de Supabase ni cambios de permisos.

## v175.51 · Tarjetas de Mover estudiantes fieles a referencia

- Tarjetas uniformes con nombre del alumno y su ID/sede a la izquierda, grado en una pequeña insignia púrpura a la derecha, separador fino y controles inferiores alineados: **Curso actual → Mover a → Guardar**.
- Mejorada la proporción entre selectores, tipografías, espacios y botones; el curso actual usa fondo azul claro y se mantiene el límite de 4 px en las esquinas. En pantallas pequeñas se reajustan las cuatro columnas sin desbordamientos.
- Encabezado de listado con icono de estudiantes y contador de visibles. Se mantiene el guardado por fila sin recargar la pantalla, con verificación por RPC y auditoría existente.
- Renovada la caché PWA y los recursos a v175.51; sin cambios en Supabase.

## v175.50 · Coordinación compacta, guardado por fila y PWA sin recargas

- **Mover estudiantes:** quitado el bloque duplicado con nombre/rol del coordinador en esta pestaña; encabezado de acción más compacto, sin las tarjetas de estadísticas. Lista móvil rediseñada con nombre, ID, sede, distintivo de grado, curso actual, selector y guardado alineados. En escritorio aparecen dos columnas.
- **Guardado:** una sola llamada a `roque_v8_coordinador_mover` por estudiante. Eliminados los RPC extra de descarga académica y la recarga total de los 877 estudiantes después de confirmar. Durante la solicitud solo se bloquea esa tarjeta; en éxito se actualiza el curso local y el resultado de esa fila, preservando búsqueda, filtros y scroll. Se mantiene la verificación/autorización y auditoría en Supabase.
- **PWA:** corregida la constante `APP_VERSION` que estaba desfasada respecto de `version.json`. Desactivadas las recargas automáticas en `controllerchange`, mensajes de actualización y activación del service worker; la nueva versión se aplica cuando el usuario vuelve a abrir o recarga voluntariamente.
- Sin migraciones ni modificaciones de registros o permisos de Supabase.

## v175.49 · Hero continuo, movimientos fluidos y aviso opcional

- **Hero de Estudiantes:** al alternar Detalle, Historial y otras vistas, la disolvencia se aplica al contenido, preservando el banner y sus partículas. Corregida la precedencia CSS que impedía desvanecer los copos y muñecos de nieve cuando cambia la apariencia de los puestos 1.º, 2.º y 3.º; las capas salientes terminan su transición incluso con navegación rápida.
- **Bienvenida del coordinador:** el estudiante sigue la tarjeta flotante con el dedo sincronizado; al salir de un curso, los compañeros restantes se recolocan mediante animación FLIP, y al llegar se funden tarjeta y dedo suavemente.
- **No volver a mostrar este mensaje:** casilla antes de «¡Dale!» que guarda la preferencia en el almacenamiento local de este navegador, asociada al ID del coordinador. No altera sesiones ni autorizaciones.
- **PWA:** actualizados HTML, scripts, estilos, caché y documentación a v175.49. No se modifican resultados, matrículas, roles ni datos de Supabase.

## v175.48 · Modal de coordinación rediseñado y sin claves individuales

- **Esquinas:** todos los elementos nuevos del panel Mover estudiantes y del modal de introducción tienen un radio máximo de 4 px.
- **Animación:** cinco tarjetas, tres en el curso 1PPAL y dos en 2PPAL. Cada ciclo escoge al azar uno de los tres estudiantes del lado más lleno y lo mueve al otro curso; los sentidos se alternan naturalmente. La tarjeta y el dedo comparten el mismo elemento flotante para que nunca se desfasen, y hay alternativa sin animación para reducir movimiento.
- **Sin clave adicional:** el login controlado del portal (`roque_v8_login_controlado_private`) emite una sesión temporal para docentes marcados `coordinador=true`. Las RPC de lectura y movimiento (`roque_v8_coordinador_listar` y `roque_v8_coordinador_mover`) requieren el identificador de sesión temporal y comprueban su vigencia y el rol. El token únicamente vive en memoria, nunca en localStorage. Los accesos anteriores basados en PIN y su tabla se retiraron de Supabase.
- **Auditoría:** `roque_private.movimientos_curso` sigue registrando edición, estudiante, curso anterior/nuevo, coordinador y fecha. Los movimientos solo modifican el curso; no modifican grado, sede ni resultados.
- **Seguridad pendiente:** el login institucional actual identifica a docentes por número de documento sin contraseña; para prevenir la suplantación de coordinadores se recomienda migrarlo a un inicio de sesión individual verificado. Una sesión temporal evita llamadas arbitrarias a las RPC, pero no resuelve por sí sola esa limitación de identificación.
- Actualizadas versiones de JavaScript, CSS y precaché PWA.

## v175.47 · Hero estudiantil persistente y «Mover estudiantes» para coordinadores

- En Estudiantes, al cambiar entre Historial y Detalle se conserva el mismo nodo del hero y la animación navideña NO se reinicia. Si aparece un 1.º, 2.º o 3.º puesto, el color de medalla y las partículas cambian con un fundido de 500 ms; hay adaptación a movimientos reducidos.
- En el menú **Coordinador** se añade la pestaña **Mover estudiantes**: tarjetas móviles con colores por grado, búsqueda de nombre/ID y filtros por sede, grado y curso; selector limitado a cursos **del mismo grado y misma sede**, botón Guardar por estudiante y paginación «Mostrar más».
- El guardado requiere clave individual de 14 caracteres, solo conservada en memoria de la sesión. Las 4 claves se entregan al responsable **por separado**, nunca en GitHub. Las funciones Supabase **roque_v7_coordinador_listar** y **roque_v7_coordinador_mover** verifican rol coordinador activo y clave bcrypt, bloquean intentos excesivos, validan el curso antiguo y auditan todos los cambios.
- Para **2026-1S**, cada cambio sincroniza `roque_private.inscripciones` y `public.estudiantes` de forma atómica para conservar la paridad histórica. Para ediciones siguientes opera sobre su propia inscripción; las notas, grados, sedes y respuestas quedan intactas.
- Tras elegir la evaluación, el coordinador ve una bienvenida «¡Hey! Eres coordinador en esta prueba!» con una animación fluida del dedo que traslada una tarjeta entre cursos. Se cierra mediante «¡Dale!».
- El SQL utilizado queda registrado en `supabase/26_mover_estudiantes_coordinador_v175_47.sql` (sin secretos). La edición 2026-2S todavía no tiene inscripciones, por lo que presentará listado vacío hasta que se carguen.
- Se actualizan CSS, JS, caché y versión PWA. Esta implementación no mueve estudiantes existentes por sí sola.

## v175.46 · Modal inicial de elección de evaluación docente

- **Antes de ver las estadísticas** el docente debe elegir la prueba a consultar en un modal responsivo que cubre el panel. La más reciente (por año y semestre) aparece como tarjeta azul destacada, con código grande, estado de publicación y botón de entrada. Las anteriores se eligen desde un desplegable independiente.
- El modal usa el mismo catálogo dinámico `roque_v5_portada_ediciones` que el selector existente en el hero. El selector en la cabecera se conserva para cambiar de edición después de entrar; las nuevas ediciones aparecerán automáticamente.
- La pantalla docente no representa tablas ni promedios detrás del modal hasta que se elija edición. Se impide cerrar el modal con Escape o tocando fuera, y se bloquean los controles del fondo.
- Elegir una prueba publicada llama a `roque_v6_docente_datos_edicion` y carga exclusivamente sus registros autorizados. Si la más reciente está en borrador (2026-2S actualmente), presenta el estado «Sin publicar» sin recurrir a calificaciones históricas; el docente puede escoger posteriormente 2026-1S en el hero.
- Solo cambia el frontend y la caché PWA. No hay escrituras en Supabase, permisos, ediciones ni resultados de estudiantes.

## v175.45 · Selector de ediciones por docente

- Cabecera Panel Docente: desplegable **Prueba a consultar** debajo del nombre, con las ediciones presentes y futuras obtenidas de la RPC `roque_v5_portada_ediciones`. Se preserva el hero y el dock persistentes al navegar.
- Al elegir una edición publicada, la nueva RPC `roque_v6_docente_datos_edicion` valida el rol docente y recupera estudiantes, claves y respuestas exclusivamente de la edición elegida, restringidos a la carga o dirección de grupo del profesor (o la totalidad para coordinadores).
- Ediciones en borrador, incluyendo 2026-2S mientras no tenga resultados publicados, muestran aviso específico sin mezclar resultados ni simular calificaciones.
- Los ajustes de respuestas/claves históricos locales solo se aplican a 2026-1S. Al reanudar una sesión docente se vuelven a cargar sus datos desde Supabase.
- SQL conservado en `supabase/25_selector_ediciones_docentes_v175_45.sql`. Caché PWA actualizada. No se modifican datos de notas ni estados de publicación.

## v175.44 · Dock persistente: evitar desaparición del botón activo

- Corregida la prioridad del marcador azul en el dock compartido (docente, director de grupo y estudiante): `syncDockMotion` toma primero `.is-active` (sección seleccionada) y utiliza `aria-expanded="true"` solo como respaldo.
- **Causa:** al abrir el menú `Cuenta`, `aria-expanded="true"` tenía prioridad y desplazaba el marcador del botón activo hacia `Cuenta`. La sección anterior seguía con su texto blanco por `.is-active`, ahora sobre el fondo blanco del dock; parecía desaparecer.
- El menú abierto se diferencia con texto y subrayado del color principal, sin desplazar el marcador de la sección. Al cerrar vuelve a su estado normal. En estudiantes, `Salir` conserva su color rojo y la selección de Detalle/Historial permanece hasta terminar realmente el cierre de sesión.
- Si no hay botón activo, el marcador queda a ancho cero en lugar de conservar una posición obsoleta. Se mantiene el DOM persistente, las transiciones y el comportamiento de la sesión; no hay cambios académicos ni de Supabase.
- Versión web y precaché PWA actualizados para invalidar los estilos anteriores.

## v175.43 · Bajar Café a una posición intermedia

- Café había quedado demasiado elevado en la v175.42. Se reduce **solo su compensación de altura** de `0.8` a `0.6` en `js/christmas-responsive.js`: aproximadamente **20 px más abajo** en la referencia móvil 360×800.
- Se conservan el tamaño y los ajustes definitivos del personaje, el diseño móvil-primero y las posiciones de Santa, Oso y Nieves.
- Se actualizan la versión, el precaché de la PWA y el historial del README. No hay cambios en Supabase, resultados académicos ni autenticación.

## v175.42 · Ajuste de altura específico para Café

- El personaje **Café** se eleva al aparecer en la bienvenida navideña: su proporción de imagen (1448/1086) es distinta de Santa, Oso y Nieves (1672/941). El sistema lo colocaba notablemente más abajo usando un anclaje vertical común.
- Corrección exclusiva para Café: `cafeLift = width * (1672/941 - 1448/1086) * 0.8`; equivale aproximadamente a **80 px hacia arriba** en la referencia móvil 360×800 y se adapta proporcionalmente en otras alturas.
- Las posiciones, los tamaños y el sorteo de Santa, Oso y Nieves siguen **sin cambios**; continúan los ajustes definitivos de v175.41 y el diseño móvil primero.
- Sin cambios en Supabase, acceso, notas ni otros paneles; versión y caché PWA actualizadas.

## v175.41 · Coordenadas definitivas y nieve emoji

- Se fijan **sin almacenamiento temporal** los ajustes exactos proporcionados en el JSON de 360×800: árbol `(-6.8, -18.6, 1)`; regalos `(-18.5, 5.6, .8)`, `(-48.8, -14.6, 1)`, `(-201, -23.1, 1)`; personaje `(-23.3, 132.2, .6)`; hojas `(0,0,1)` y `(0,0,1)`. Los valores representan `(dx,dy,scale)` relativos a los anclajes móviles originales.
- Referencia móvil exportada: árbol `(-132, 257.5, 297.4)`, regalos `(-5, 728.7, 66.5)`, `(44.9, 699.6, 68.7)`, `(-49.2, 730.2, 49.2)`, personaje `(228.1, 539.7, 137.8)`, hojas `(-61.1, 22.4, 45.1)` y `(104, 22.4, 45.1)`. Estos son `(xPx,yPx,anchoPx)` medidos en 360×800.
- El diseño continúa **móvil primero**, adaptándose a 16:9 y ultrawide usando el espacio lateral al formulario. El formulario mantiene su capa superior y difuminado.
- Se retira por completo el **modo debug**: scripts y estilos propios eliminados del repositorio, referencias HTML y precaché eliminadas, borradores locales ignorados. El parámetro `?navidadDebug=1` no activa controles.
- Los **72 copos de nieve** cambian de SVG a emoji **❄️**, más claros (opacidad .73–.955), con caída lenta y oscilación continua; los cargadores también usan ❄️.
- Se conservan imágenes del ZIP y un personaje sorteado al entrar entre Santa, Oso, Café o Nieves. `nieves` en el JSON identifica al personaje visible al editar, no anula el sorteo.
- Cambios exclusivamente frontend. No se modifica Supabase, acceso, datos académicos ni resultados. Caché PWA actualizada.

## v175.40 · Bienvenida con imágenes propias y composición móvil-primero

- **Móvil como referencia**: el motor `js/christmas-responsive.js` usa un diseño base de 360×780, alturas adaptativas y la posición del formulario como ancla. En escritorio 16:9, 21:9 y ultrawide, el árbol y los regalos ocupan la izquierda y el personaje ocupa la derecha, sin mover la tarjeta. Las hojas se alinean al logo.
- **ZIP del usuario**: ocho imágenes transparentes optimizadas a WebP en `assets/navidad`: árbol, hoja, regalos 1/2 y los personajes SANTA, OSO, CAFE y NIEVES.
- **Personaje aleatorio**: una sola de las cuatro imágenes aparece en cada entrada a la página. Un error de inicio de sesión no vuelve a sortearlo.
- **Editor** `?navidadDebug=1`: permite cambiar el personaje al instante, arrastrar las imágenes con el mouse y escalarlas desde cuatro círculos de selección. Los cambios se guardan como correcciones relativas al diseño móvil para que sigan adaptándose al tamaño de pantalla. **Copiar posiciones** exporta los valores y el personaje seleccionado; esos borradores no afectan a otros visitantes.
- Las imágenes reemplazan los emojis decorativos. La nieve y el cargador usan copos SVG con caídas suaves en lugar de caracteres emoji.
- Tarjeta de acceso y datos académicos sin cambios. Actualizados PWA, precaché y versión.

## v175.39 · Editor visual: arrastrar el emoji y redimensionar con cuatro círculos

- Modo de edición: `https://encisomath.github.io/RoqueObjetiva/?navidadDebug=1`.
- El recuadro de selección es completamente **arrastrable con el mouse**: mantén pulsado sobre el emoji o sobre cualquier parte del recuadro y muévelo, sin recurrir al panel lateral.
- Aparecen **cuatro círculos blancos con borde azul**, uno en cada esquina, al estilo de editores gráficos. Arrastra cualquier círculo para aumentar o reducir proporcionalmente el tamaño, dejando anclada la esquina opuesta.
- Mantiene selección de los siete elementos 🎄 🎁 🎁 🎁 ☃️ 🌿 🌿, controles numéricos, guardado local temporal y exportación de coordenadas JSON. Ningún cambio afecta la página normal ni los datos académicos.
- Versiones de recursos y caché PWA actualizadas para que el navegador cargue la interfaz mejorada.

## v175.38 · Editor navideño visual para ajustar los emojis con mouse

- Abrir `https://encisomath.github.io/RoqueObjetiva/?navidadDebug=1`. El editor **solo se activa con ese parámetro** cuando aparece el login; ninguna otra vista tiene herramientas de edición.
- Se pueden mover 🎄, los tres 🎁, ☃️ y las dos 🌿 con el mouse o desde un selector. Tirador **↘** para redimensionar; ajuste preciso mediante X, Y y Tamaño en píxeles, botones ±1/±10 px y flechas de posición.
- **Copiar coordenadas** exporta JSON con medidas en píxeles y porcentajes, tamaño de ventana y referencia al contenedor. Se puede pegar en ChatGPT para aplicar la distribución definitiva.
- El borrador se guarda solo en el navegador del usuario y únicamente se carga en modo edición con anchura de pantalla compatible. **Restablecer** devuelve las posiciones publicadas y **Salir** regresa a la página normal. No cambia las posiciones de otros visitantes.
- El `login-card.login-card-dark` mantiene su desenfoque y sigue delante de las decoraciones. Cambios exclusivos del frontend; sin alteración de Supabase, autenticación ni resultados.

## v175.37 · Árbol y muñeco emoji grandes detrás del login

- El 🎄 se amplía hasta cerca de la altura del título **Bienvenido** y se desplaza un 47 % de su ancho fuera del margen izquierdo, tal como la referencia del usuario.
- Se agrupan tres 🎁 de distintos tamaños y alturas en la parte inferior del árbol; los regalos quedan **por encima de las curvas de nieve**.
- A la derecha aparece ☃️ como **emoji**, no como SVG ni como imagen, grande y aproximadamente medio fuera de la pantalla.
- La tarjeta `.login-card.login-card-dark` conserva su fondo translúcido con desenfoque real y una capa superior a los emojis; nada cambia en el formulario y los accesos recientes.
- Sin modificaciones de Supabase, calificaciones, autenticación, componentes académicos o puntuación. Archivos versionados y caché PWA actualizados.

## v175.36 · Navidad simplificada: sin luces ni muñeco

- Se eliminan completamente el cable y las bombillas navideñas, así como el muñeco de nieve de la bienvenida y los cargadores. Los cargadores de temporada usan un copo ❄️ animado y sin degradados.
- Fondo más oscuro, azul sólido `#1c77ab`, sin imágenes ni degradados. La tarjeta mantiene su transparencia y desenfoque.
- Árbol 🎄 y regalos 🎁 más visibles, con `z-index` superior al de las curvas blancas de nieve para que no queden sepultados.
- Nieve con **72 copos** ❄️ de tamaños variados y velocidades lentas (27 a 44 segundos de caída); movimiento lateral suave de dos extremos con `ease-in-out`, independiente de la caída.
- Hojas 🌿 más grandes, alineadas verticalmente con el centro del escudo y simétricas (una reflejada).
- Conserva el acceso, usuarios recientes, la lógica académica y Supabase sin cambios. Actualizadas versión, caché PWA y README.

## v175.35 · Navidad completamente vectorial, sin imágenes

- Corrección íntegra de la bienvenida: fondo **azul claro sólido** `#2288c3`, sin degradados ni fotografías, PNG/WebP ni elementos precocinados. Se descartan todos los recursos navideños gráficos de v175.33 y v175.34.
- Cable superior y bombillas construidos con **SVG** (trazo curvo, óvalos de colores y brillo intermitente). Bancos de nieve inferiores dibujados mediante curvas SVG con colores sólidos.
- Muñeco de nieve trazado en **SVG geométrico** con círculos, curvas, ojos, nariz triangular, boca y sombrero; ambos brazos saludan de forma independiente y la cabeza/sombrero giran suavemente.
- Árbol **🎄**, regalos **🎁**, hojas **🌿** a ambos lados del escudo (una reflejada) y copos **❄️** de tamaños variados.
- Nieve sin saltos laterales: la traslación vertical continua y la oscilación lateral periódica son animaciones **independientes** anidadas; el retorno al inicio ocurre fuera de la pantalla.
- Logo institucional **sin gorro**; formulario original compacto, funcional y con `backdrop-filter`. En los cargadores navideños se mantiene la cabeza SVG en vez del cuadro azul. Soporta `prefers-reduced-motion`.
- Cambios exclusivamente visuales, sin alteraciones a Supabase, notas, autenticación o datos académicos. Caché PWA/versiones renovadas.

## v175.34 · Recuperación visual fiel de la propuesta navideña

- Se corrige la versión v175.33 que deformó la propuesta: el fondo vuelve a proceder de la imagen aprobada por el usuario, no de un redibujo vectorial simplificado. Se usa un recurso liviano WebP preparado desde dicha imagen, con el formulario impreso retirado para no duplicar controles.
- El muñeco de nieve reproduce el sombrero oscuro, el rostro y la bufanda roja de la referencia. Se recortaron cabeza y cuerpo como recursos reales independientes y se animan mirada/sombrero y brazos con distintas cadencias naturales.
- Se mantiene la tarjeta compacta con desenfoque real, tipografía pequeña, árboles/regalos/guirnalda de la ilustración, copos sinuosos y bombillitas intermitentes. El gorro del escudo es dibujo flat, nunca emoji de Papá Noel.
- «Consultando resultados» y el cargador de navegación usan el recorte real de la cabeza, sin cuadrado degradado. Los recursos se precachean con nueva versión PWA para invalidar la pantalla anterior.
- El cambio es exclusivamente visual y estacional (1 nov a 6 ene, hora Colombia); sin cambios en SQL, Supabase, credenciales, calificaciones, rankings ni autorizaciones. Los SVG restantes siguen disponibles como respaldo de versiones anteriores.
- Revisión estática del JS y rutas: no se modifica el flujo de autenticación. Se recomienda comprobar la versión publicada en móvil y escritorio.

## v175.33 · Inicio navideño flat y muñeco de nieve animado

- La bienvenida se ambienta con una fondo navideño obtenido de la ilustración original proporcionada, con el formulario dibujado retirado para evitar duplicados, y guirnalda/árbol/regalos originales; además: guirnalda superior, nieve, árbol, regalos, suelo nevado y muñeco animado. Se emplean colores sólidos sin degradados; la tarjeta conserva desenfoque real mediante `backdrop-filter`.
- El muñeco tiene brazos independientes que saludan a distinto ritmo; la mirada (ojos, nariz y boca) viaja suavemente de izquierda a derecha, y el sombrero acompaña la animación.
- Copos con trayectorias diagonales cambiantes y fases negativas para caída ininterrumpida; luces superiores parpadean de forma independiente.
- El indicador azul degradado de «Consultando resultados» y el cargador de transiciones se sustituyen en temporada por la cabeza del muñeco con gorro y bufanda.
- Decoración limitada a temporada navideña (1 de noviembre al 6 de enero, hora Colombia) y exclusivamente a bienvenida/carga; fuera de temporada se mantiene la pantalla original. Se respeta `prefers-reduced-motion`. Ningún resultado, nota, credencial, permiso ni dato de Supabase cambia.
- Se versionan stylesheet, SVG decorativo y precaché de la PWA. 

## v175.32 · Cascadas elegantes y dock persistente con indicador móvil

- En **Docente y Estudiante**, el dock aparece suavemente solo al montarse, pero **permanece visible** al cambiar de vista. El indicador azul se desliza de un botón al siguiente y se recalcula al redimensionar la pantalla.
- **Carga, Dirección de grupo y Coordinación** muestran selectores, tarjetas, estadísticas y tablas en una cascada corta, sin animar el hero ni reconstruir el dock.
- El **informe estudiantil y el historial** usan la misma cadencia, sin desenfoques ni esperas prolongadas.
- Los **modales** comparten transiciones de apertura y cierre, y escalonan la entrada del hero y del contenido; las ventanas padre de los modales anidados permanecen abiertas.
- Se respeta `prefers-reduced-motion`. No hay cambios en notas, respuestas ni Supabase; README, versión y caché actualizados.

## v175.31 · El hero y el dock ya no saltan al cambiar de pestaña

- Se elimina el uso de View Transitions para las pestañas docentes: sus capturas producían superposiciones, glitches y parpadeos al redibujar toda la pantalla.
- Al cambiar entre **Carga**, **Dirección de grupo** y **Coordinación**, el mismo hero y el mismo dock permanecen montados y **solo se actualiza el contenido central**. Los elementos animados del hero no se reinician.
- El dock **no se reconstruye ni se anima**: se actualiza instantáneamente el botón activo y se cierran los menús cuando corresponde.
- Única animación de opacidad de 210 ms en el contenido, sin movimientos de toda la página ni animaciones duplicadas de sus secciones.
- Las animaciones de modales de v175.30 permanecen. Respeto a `prefers-reduced-motion`.
- Sin cambios en resultados, notas, datos, autenticación o Supabase. README y versión/caché PWA actualizados.

## v175.30 · Transiciones fluidas y modales animados

- Navegación entre **Carga**, **Dirección de grupo** y las vistas de Coordinación con una transición suave de contenido (salida breve, entrada con desvanecimiento y desplazamiento sutil), manteniendo estable el **dock inferior**.
- La navegación utiliza **View Transitions API** cuando el navegador la soporta, y una animación CSS de entrada como alternativa. También aplica al cambio de grupo y asignatura.
- Todos los modales se abren con **fade + leve movimiento y escala**, y se cierran con transición coordinada.
- Los modales **anidados del Director** (detalle de estudiante y respuestas correctas) se desvanecen al cerrarse, conservando el modal padre, su desplazamiento y su estado sin parpadeos.
- Microinteracciones discretas en tarjetas de asignaturas y filas clicables; se evitan animaciones costosas de tamaño, desenfoque y desplazamiento de pantalla.
- Compatibilidad con **prefers-reduced-motion**: las animaciones se omiten cuando el usuario prefiere reducir movimiento.
- No se modifican notas, respuestas, datos ni Supabase. Actualizados README, versión y precaché PWA.

## v175.29 · Tabla de asignatura del Director igualada a Docente normal

- La tabla de **Docente → Director de grupo → Cualquier asignatura** usa ahora **exactamente la misma estructura HTML y clases CSS** de la tabla «Estudiantes» de **Docente → Asignaturas**.
- Eliminados los estilos antiguos del modal que impedían mostrar la misma jerarquía de **apellidos, nombres e ID Prueba**, cada dato en su propio renglón y con el mismo truncamiento `…`.
- Las columnas mantienen las mismas proporciones **61 % Estudiante / 16 % Nota / 23 % Correctas**, tamaños de fuente **0,91 rem en escritorio y 0,87 rem en móvil** para puntajes/aciertos y el mismo alto de filas.
- Se conserva la ordenación de las tres columnas, el acceso al detalle de cada estudiante, el modal anidado sin parpadeos y «Ver respuestas correctas».
- El color del área sigue aplicándose al hero, barras y controles del Director, sin cambiar el tema de Docente normal.
- No se alteran datos académicos, claves, notas ni Supabase. README y caché PWA actualizados.

## v175.28 · Hero ajustado a la altura exacta del logo

- Los heroes de **Estudiante, Docente normal y Director de grupo** utilizan la **altura del recuadro blanco del icono** como altura máxima para el título, la identificación y la columna derecha.
- Título de asignatura, nombre del estudiante o grupo y grado/edición aparecen **en una sola línea**: los textos que no caben se acortan con `…` y conservan el texto íntegro en `title`.
- La **X** ahora es más pequeña (21 px), está alineada arriba con el título y no necesita desplazamientos absolutos.
- La **nota /100** termina a la misma altura que el grado/edición, siempre dentro del alto del logo, y mantiene su alineación a la derecha.
- Se sustituyen las reglas problemáticas de v175.26 por un layout compacto común con medidas controladas también en móviles. Se preservan los colores por rol.
- **Sin cambios** en resultados, respuestas, permisos ni Supabase. Actualizados README, versión y caché PWA.

## v175.27 · Respuestas más limpias en el grid del modal

- En el grid de ítems del modal compartido (**Estudiante, Docente normal y Director de grupo**) se retira la línea «Correcta: X» de las tarjetas.
- Cada tarjeta conserva solo el **número del ítem** pequeño en la **esquina superior izquierda** y la **opción marcada grande y centrada**.
- Se mantienen los colores planos de los estados (correcta, incorrecta, doble marca, sin marcar), la navegación al detalle al pulsar una tarjeta y las etiquetas accesibles.
- Para no perder esa información, **Docente y Administración** pueden consultar la respuesta correcta dentro del detalle del ítem; no se habilita esa información para Estudiante.
- Ninguna nota, clave o respuesta cambia. Sin escrituras en Supabase. Actualizados README, versión y caché PWA.

## v175.26 · Alineación vertical real de la nota y del cierre

- En los modales de **Estudiante**, **Docente normal** y **Director de grupo** el botón **X** y el puntaje **/100** pasan a compartir una **tercera columna vertical** real en la cuadrícula del hero.
- La **X queda arriba, alineada con el título de la asignatura**, y la **nota abajo, alineada con la información del estudiante/curso** y con el borde lateral derecho.
- Eliminados los desplazamientos relativos/absolutos que provocaban que las notas quedaran montadas sobre el borde inferior del hero al cambiar la longitud del nombre.
- La columna se adapta a nombres y títulos largos en móvil y escritorio, sin recuperar la etiqueta «PRUEBA».
- Mantiene el azul normal en Docente y los colores específicos en Estudiante/Director. Sin cambios en resultados, notas, permisos ni Supabase.
- Actualizados README, versión y caché PWA.

## v175.25 · Hero compacto y alineación de nota y cierre en los tres modales

- **Estudiante, Docente → Asignaturas y Docente → Director de grupo**: eliminado el texto «PRUEBA» sobre el título de la asignatura, para aprovechar la altura del hero.
- Botón de cierre **X desplazado hacia abajo**, alineado visualmente con el título de la asignatura.
- Puntaje **/100 más bajo**, junto al bloque de identificación del estudiante/curso, y alineado al borde derecho con el **mismo margen lateral del icono** a la izquierda.
- Corregido el padding de la cuadrícula del hero de Director (heredado de v175.14) para que la nota se acerque realmente al borde derecho.
- Sin cambios en las barras, competencias, respuestas, notas, autenticación ni Supabase. Actualizados README, versión y caché PWA.

## v175.24 · Modal compartido compacto y Resumen de desempeño

- Ajuste del modal individual que comparten **Estudiante, Docente → Asignaturas y Docente → Director de grupo**: hero más compacto y botón **X** a la altura del contenido, sin espacio superior desperdiciado.
- El análisis individual de **Componentes y Competencias** ahora reutiliza el **mismo generador de «Resumen de desempeño» del panel Docente**: tarjeta plegable, encabezado, chevron, pestañas integradas y barras compactas.
- En el detalle individual se muestran los porcentajes del propio alumno, no un promedio del grupo. Cuando existe un único tipo de métrica se conserva el encabezado «evaluados».
- **Excepción exclusiva de Docente → Asignaturas**: hero, resumen, barras, porcentajes y pestañas emplean el **azul primario normal del tema** (`--primary`), independientemente de la asignatura. Estudiante y Director conservan los colores `STUDENT_AREA_COLORS`.
- Los colores de estado de respuestas (correcta, incorrecta, doble marca, sin marcar) permanecen intactos; se conserva la ventana padre de Director al cerrar el detalle.
- Actualizados CSS, README, `version.json` y caché PWA. **Sin cambios** de notas, respuestas, autenticación ni Supabase.

## v175.23 · El mismo modal del Estudiante en Docente y Director de grupo

- Al pulsar un estudiante desde **Docente → Asignaturas** o desde el listado interno de **Docente → Director de grupo**, se abre el **componente real** `openStudentSubjectModalForRoll` ya usado en Estudiantes, no un diseño alternativo.
- Se comparte exactamente el **hero plano con color e icono de la asignatura**, puntaje, resumen de respuestas, leyenda, tarjetas de ítems, valor de cada ítem y análisis por componentes/competencias con sus estilos originales.
- Se preserva la capacidad docente de **mostrar la respuesta correcta** junto a cada ítem (el estudiante no recibe ese permiso adicional).
- Si el detalle se abre sobre el modal del área de Director, este **permanece montado**, conservando desplazamiento y pestaña; al cerrar el detalle se retira únicamente la capa superior, sin parpadeo.
- Los detalles de Docente normal y Director aparecen **por encima del dock**, con capas aisladas.
- No se alteran notas, respuestas, resultados, claves, cálculos ni Supabase. Actualizados README, versión y precaché PWA.

## v175.22 · Tabla compacta de Docente normal, igualada a Director de grupo

- En **Docente → Asignaturas**, la tabla «Estudiantes» deja de mostrar la columna de numeración **#**.
- El estudiante aparece en tres renglones: **apellidos**, **nombres** e **ID Prueba**, con jerarquía de tamaño y truncamiento por puntos suspensivos igual a Director de grupo.
- Las columnas **Nota** y **Correctas (x/y)** usan exactamente el mismo tamaño tipográfico: **0,91 rem** en escritorio y **0,87 rem** en móvil, igual al puntaje en la tabla de Director de grupo.
- La tabla pasa a tres columnas (Estudiante, Nota y Correctas), conserva la ordenación, la apertura del detalle y «Ver respuestas correctas».
- Los cambios se limitan a la tabla de Docente normal; no modifican los modales ni el tablero del director.
- Sin modificaciones en calificaciones, respuestas, base de datos o Supabase. Se actualizan README, versión y caché PWA.

## v175.21 · Tabla de Director de grupo sin botón de eliminar

- Se retiran **«Eliminar»** y la columna **«Acción»** de la tabla general de **Docente → Director de grupo**.
- Se retiran las acciones y funciones exclusivas de eliminación desde esta tabla y sus estilos obsoletos, incluido el ajuste de tamaño del botón de v175.20.
- La tabla de calificaciones conserva únicamente las materias, el desplazamiento horizontal y la columna fija de nombres; se libera el ancho anteriormente ocupado por «Acción».
- Se mantiene la gestión de estudiantes desde las herramientas de administración existentes.
- No se borra ningún estudiante ni se alteran notas, resultados, claves o Supabase. Actualizados README, versión y caché PWA.

## v175.20 · Alineación exacta entre estudiantes y notas

- Corregido el **desfase vertical acumulativo** entre la columna fija `Estudiante` y las notas por asignatura de **Docente → Director de grupo**.
- Causa localizada: el botón administrativo **«Eliminar»** heredaba `min-height: 45px`, ensanchaba todas las filas de notas hasta aproximadamente 52 px, mientras los nombres se distribuían en filas de 42 px.
- Se limita **solo ese botón dentro de la tabla del director** a 32 px de altura, por debajo de las filas de 42–43 px, para que ambos lados compartan la misma geometría.
- La columna fija, las cabeceras verticales, los iconos, el ID de prueba, las notas y el desplazamiento horizontal permanecen iguales.
- Validación de geometría en Chromium con varias filas: desfase acumulado de 110 px antes y 0 px después en una prueba de 12 estudiantes.
- No se modificaron calificaciones, ordenamiento, datos ni Supabase. Actualizados README, versión y caché PWA.

## v175.19 · Asignaturas giradas a la izquierda y estudiantes en tres renglones

- La tabla general de **Docente → Director de grupo** muestra el título de la asignatura **90° hacia la izquierda**, con el icono normal debajo.
- Columnas de materias más estrechas: **62 px en escritorio, 56 px en móvil y 54 px en pantallas muy estrechas**.
- La columna fija muestra ahora **apellidos**, **nombres** (algo menores) e **ID Prueba** (más pequeño) en tres líneas, dividiendo el formato visible `Apellidos, Nombres` mediante la coma, con truncamiento por puntos suspensivos.
- Filas ajustadas a **42–43 px**, manteniendo la alineación entre ambas tablas, el desplazamiento solo de notas y el ordenamiento.
- Sin cambios en Supabase, nombres originales, notas, permisos ni cálculos. Versión, README y caché PWA actualizados.

## v175.18 · Tabla del director realmente fija y más compacta

- La columna **Estudiante** se separa físicamente de la zona de desplazamiento: **no se desplaza** al consultar las notas de las asignaturas. Ambas tablas utilizan la misma lista ordenada.
- Las filas de estudiantes pasan a **37–38 px**, conservando nombre abreviado con puntos suspensivos e ID Prueba debajo.
- Cabeceras de asignaturas con **nombre girado 90°** y **el icono institucional debajo, en orientación normal**.
- Notas más compactas, desplazamiento horizontal limitado al bloque de asignaturas y acción «Eliminar» conservada.
- Sin cambios en cálculos, claves, calificaciones ni Supabase. Actualizados caché PWA, README y versión.

## v175.17 · Tabla de Director de grupo: nombres fijos y asignaturas desplazables

- Rediseño de la **tabla general inferior** en Docente → Director de grupo, sin modificar las tarjetas de asignaturas ni el modal.
- Se elimina la numeración **#** para recuperar espacio horizontal.
- Primera columna **Estudiante** fija durante el desplazamiento horizontal; nombre más pequeño y truncado con puntos suspensivos, nombre completo disponible al mantener pulsado/pasar el cursor, e **ID Prueba** debajo.
- Columnas de asignaturas compactas, con **icono institucional de la materia** en la cabecera y notas un poco más grandes que los nombres.
- Se muestra parte de la primera asignatura junto al estudiante desde el inicio y se agrega la pista móvil **«Desliza las materias →»**.
- Se conservan la ordenación de notas, el botón administrativo «Eliminar» y las calificaciones reales, sin cambios en Supabase.
- Actualizados README, versión y caché PWA.

## v175.16 · Modales anidados sin parpadeo y por encima del dock

- Desde el modal de asignatura de **Docentes → Director de grupo**, «Ver respuestas correctas» abre una **capa superior real**, conservando el modal del área montado e intacto debajo.
- Al cerrar «Respuestas correctas», solo se elimina esa capa: **no se cierra, reconstruye ni anima la ventana del área**. Conserva la posición de desplazamiento y el estado de la tabla/resumen.
- La misma ventana «Respuestas correctas» funciona desde el **docente normal** cuando no hay un modal previo, conservando el cierre habitual.
- Los modales de área de director, detalle de asignatura de docente normal, y respuestas correctas tienen `z-index` superior al dock de navegación docente/estudiante (sin modificar el dock).
- Se actualizan versión, README y caché PWA; no se modifican cálculos, notas, respuestas ni Supabase.

## v175.15 · Barras flat y tabla ampliada en Director de grupo

- Se corrigió la **especificidad CSS** que seguía imponiendo el azul y el degradado del panel general de docentes sobre el modal de Director de grupo.
- Las pestañas **Componentes / Competencias**, las barras de progreso y sus porcentajes usan ahora un **único color sólido** tomado de `STUDENT_AREA_COLORS` para cada asignatura.
- La tabla de estudiantes elimina la columna **#** y el número de fila, dando más espacio al nombre (64 % del ancho), sin cambiar el orden ni la opción de ordenar.
- Se mantienen las columnas **Nota** y **Correctas**, el nombre íntegro en `title` y la navegación al detalle del estudiante.
- Se actualizan README, `version.json` y caché PWA a `v175.15`. No se alteran datos, notas ni Supabase.

## v175.14 · Corrección visual del modal Director de grupo

- Modal de asignatura **centrado horizontal y verticalmente** en móvil y escritorio, con márgenes simétricos.
- **Hero compacto** con el título, el grupo, la edición y el promedio conservados.
- **Estilo flat** sin degradados: iconos, pestañas, barras de componentes/competencias y enlaces usan el color real de la asignatura, tomado de `STUDENT_AREA_COLORS`.
- **Tabla de estudiantes en una línea por registro**: nombre y apellidos compactos, nota y aciertos alineados; el **ID Prueba ya no se muestra**. El nombre íntegro permanece en el atributo `title` y se accede al detalle pulsando la fila.
- Encabezado «Estudiantes» con separación lateral correcta; restauradas las reglas de tarjeta compacta que no se aplicaban por faltar `teacher-students-card`.
- Ajuste de versión y caché PWA a `v175.14`; se incluye `css/student-subject-modal.css` en la precarga.
- **Sin cambios** en notas, cálculos, autenticación, claves de respuesta ni base de datos Supabase.

## v172.1 · Evaluaciones antes del informe

Después del ingreso habitual por ID, aparece una portada de evaluaciones. **2026-2S** es la tarjeta principal (bloqueada mientras esté en borrador); debajo, **HISTORIAL** ofrece **2026-1S**, cuyo informe, cálculos y ranking no se alteran. El estado se consulta desde la RPC pública de metadatos `roque_v5_portada_ediciones` sin publicar resultados ni permitir acceder a otras ediciones sin autorización. La pantalla de cuenta personal introducida en v172 se retiró del ingreso.

## v173 · Corrección académica, dock estudiante y bloqueo del historial
- Respuestas privadas JSON preservadas, sin `[object Object]`: calificaciones y marcas por asignatura restauradas.
- Dock inferior estudiantil con **Historial | Detalles de examen | Salir**. Se eliminaron los botones superiores de esa navegación.
- Del **1 al 18 de noviembre de 2026** (hora Colombia) se bloquean semestres anteriores al más reciente; reapertura el **19 de noviembre de 2026**. Las rutas antiguas de resultados y ranking también se protegen en Supabase. `2026-2S` continúa en borrador.
- Prueba y detalle técnico: `docs/NOTAS_DOCK_BLOQUEO_V173.md`.

## v173.1 · Dock estudiantil idéntico al docente
El dock estudiantil reutiliza directamente `.t160-dock` y `.t160-dock-btn` (los mismos del docente), sin sobreescribir estilo activo, colores, alturas, tipografía, separaciones ni animaciones. Sólo conserva el tratamiento de estado deshabilitado para «Detalles de examen» antes de elegir una evaluación. Botones: Historial | Detalles de examen | Salir. El resto de v173, incluyendo notas y bloqueo de historial, queda intacto.

## v173.2 · Botón «Salir» rojo
El dock estudiantil conserva los estilos del docente. Únicamente el icono y el texto de «Salir» usan el mismo rojo `#af3342` de «Cerrar sesión» en el menú docente; en hover usa el mismo fondo `#fff2f2`. Sin cambios funcionales, académicos ni de Supabase.

## v174 · Nuevo informe visual del estudiante

- Ficha independiente de identidad: grado, nombre, ID, sede y curso.
- Tarjeta inferior de puntaje global con barra proporcional y explicación al pulsar.
- Dos tarjetas de ranking por curso y por grado.
- **Resultados por área** en grid de **dos columnas** en móvil y escritorio, con los iconos existentes, nota sobre 100 y barra con color propio por asignatura; sin imprimir porcentajes.
- Pulsar cualquier asignatura conserva el modal de respuestas, aciertos, errores y puesto por materia.
- Cambios únicamente en `renderStudent` y el nuevo `css/student-dashboard.css` (estilo encapsulado). Docentes, coordinadores, administradores, datos académicos y dock sin modificaciones.

## Uso

Proyecto institucional para el seguimiento y análisis de resultados de pruebas objetivas.

## Administración multiedición (v145)

Desde el panel administrativo antiguo, abre **Ediciones y pruebas** y autentícate con tu usuario de **Supabase Auth**. Este módulo utiliza las RPC `roque_v2_admin_*`, instaladas previamente en Supabase. Los cambios solo se admiten en ediciones en borrador. Consulta la documentación en `docs/ADMIN_MULTIEDICION.md`.

## Protección de consultas v146

Las consultas estudiantiles usarán `roque_v2_login_controlado` y `roque_v2_ranking_controlado`. Instalación por etapas en `docs/CONTROL_CONSULTAS.md`. La fase 12 crea las RPC sin cambios visibles; luego se despliega el frontend, se prueba y se aplica la fase 13 para revocar los endpoints antiguos. **Sin fase 13 el límite puede eludirse llamando la API antigua.** No se utiliza dirección IP ni MAC.

## v147 Administrador
La antigua contraseña pública ha sido invalidada en Supabase y quitada del JavaScript de producción. Ingresa con la cuenta autorizada de Supabase Auth usando su correo electrónico. Los cambios individuales de resultados usan `roque_v3_admin_guardar_resultado` con verificación por JWT y rol privado.

## Etapa 3 — Cargue gestionado por inteligencia artificial (v167)

El administrador solo escanea los exámenes, exporta el Excel de EvalBee y lo comparte con ChatGPT. La IA realizará las operaciones de importación en Supabase, previa validación de IDs, claves y edición. La pantalla **Ediciones y pruebas** permite vigilar los totales y pendientes sin hacer el cargue manual. La edición 2026-1S permanece histórica; 2026-2S está en borrador hasta recibir archivos válidos. Más información en [docs/ETAPA3_CARGUE_IA.md](docs/ETAPA3_CARGUE_IA.md). La importación de archivos no se ejecuta automáticamente desde el navegador.

## Etapa 3 — Importador seguro por IA (v168)

El cargador SQL privado `roque_private.importar_lote_ia` ya permite procesar lotes por edición (claves con área flexible, inscripciones y resultados), con validación/simulación sin cambios por defecto, escrituras atómicas, protección de ediciones históricas e historial de lotes. Los lotes se preparan **por ChatGPT a partir del Excel de EvalBee** que el usuario comparte; no es una importación manual en el navegador ni una carga automática sin archivo. La función se limita a la conexión SQL administrativa y mantiene el segundo semestre en borrador hasta una publicación separada. Consulta [docs/CONTRATO_IMPORTADOR_IA_V168.md](docs/CONTRATO_IMPORTADOR_IA_V168.md).

## v169 — Lectura académica desde roque_private

El inicio de sesión controlado `roque_v4_login_controlado_private` **continúa validando los mismos usuarios, roles y límites de consultas** mediante la función v2 y, tras la autorización, entrega estudiantes, claves y resultados de `roque_private` para la edición histórica publicada `2026-1S`. Los conteos y el contenido se contrastan contra `public`; si aparece una diferencia se usa automáticamente el respaldo legado para no mostrar datos incoherentes. Las asignaciones docentes, la edición manual de un examen y el ranking protegido siguen usando funciones históricas hasta completar su migración. **2026-2S permanece sin publicar y no se consulta.** Consulta [docs/TRANSICION_ROQUE_PRIVATE_V169.md](docs/TRANSICION_ROQUE_PRIVATE_V169.md).

## v170 — Rankings de roque_private por edición

Los rankings de grado y curso y los puestos del estudiante por las cinco áreas principales ahora se calculan por edición a partir de inscripciones, claves y resultados en `roque_private`. La consulta web usa `roque_v3_ranking_controlado_edicion`, exige una visita estudiantil reciente y devuelve únicamente la fila propia y puestos agregados. Mantiene reglas de puntaje/desempate v124 y recurre a v2 cuando la nueva RPC no está desplegada o cuando difieren las copias históricas. `2026-2S` continúa inaccesible mientras esté en borrador. Ver [docs/RANKING_POR_EDICION_V170.md](docs/RANKING_POR_EDICION_V170.md).

## v171 · Correcciones administrativas por edición

Los botones **Guardar y subir a Supabase** (un examen) y **Guardar y subir claves** (hasta 100 claves por lote) ahora solicitan un motivo y ejecutan RPCs verificadas con Supabase Auth. Para `2026-1S`, ambas copias (`public`/ `roque_private`) se actualizan atómicamente y se registra una bitácora privada con los valores anteriores, nuevos y usuario que realizó la corrección. Se rechazan borradores y estados desactualizados. La sincronización masiva continúa deshabilitada. Consulte [docs/CORRECCIONES_AUDITADAS_V171.md](docs/CORRECCIONES_AUDITADAS_V171.md).
