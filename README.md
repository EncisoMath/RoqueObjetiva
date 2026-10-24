# RoqueObjetiva

Aplicación web para la consulta de resultados de pruebas objetivas de la **IED Roque de los Ríos Valle**.

Permite a estudiantes, docentes y directivos revisar resultados académicos, puntajes por área y rankings de desempeño de forma sencilla y visual.

## Versión

RoqueObjetiva v171

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
