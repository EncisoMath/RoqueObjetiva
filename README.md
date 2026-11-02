# RoqueObjetiva

Aplicación web para la consulta de resultados de pruebas objetivas de la **IED Roque de los Ríos Valle**.

Permite a estudiantes, docentes y directivos revisar resultados académicos, puntajes por área y rankings de desempeño de forma sencilla y visual.

## Versión

RoqueObjetiva v175.24


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
