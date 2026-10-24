# RoqueObjetiva v168 · Contrato del importador IA de EvalBee

## Qué está implementado
La edición se gestiona sin que el usuario tenga que cargar hojas de cálculo en RoqueObjetiva ni ejecutar SQL. El usuario escanea con EvalBee, genera el Excel y lo adjunta a ChatGPT. **ChatGPT procesa el archivo en el turno de trabajo en que está disponible**, comprueba el contenido y utiliza el conector SQL de Supabase para importar los lotes verificados.

El importador ya está instalado en Supabase: `roque_private.importar_lote_ia(p_edicion,p_tipo,p_filas,p_origen,p_simular)`. La función **NO ES una ruta REST** ni una RPC expuesta al navegador: es `SECURITY INVOKER` y solo el rol SQL administrativo `postgres` puede ejecutarla. No hay credenciales de alto privilegio en el frontend.

## Reglas de seguridad, indispensables
- **Edición:** se pasa siempre como argumento explícito, por ejemplo `2026-2S`; nada se infiere únicamente del año. La función bloquea ediciones `cerrada`, `publicada`, `aplicacion` o con resultados visibles. La edición histórica `2026-1S` no se modifica.
- **Simular primero:** `p_simular=true` es el valor por defecto y **no escribe nada**. Para escribir se necesita `p_simular=false` de manera explícita, después de una validación completa.
- **Transacciones:** cada lote contiene de 1 a 200 filas y es atómico; si falla una, **no se guarda ninguna**. Los lotes se envían por orden: claves oficiales, inscripciones, resultados.
- **Nunca reemplazar:** no hay UPDATE de resultados o inscripciones existentes. Una fila repetida exactamente se contabiliza como `identica`; una fila con valores contradictorios se rechaza. Las claves de una pregunta solo pueden añadirse si no existían, aunque se permite asociar ese ítem a un área diferente antes de definir la clave.
- **Procedencia y auditoría:** cada lote guardado registra origen, tipo, hash, cantidad de filas y fecha, sin copiar datos personales en la bitácora. El administrador puede ver conteos resumidos mediante `public.roque_v3_admin_resumen_cargas_ia`.
- **No publicación:** importar no significa publicar; la edición conserva estado de borrador. Validar el preflight después de cargar: `public.roque_v3_admin_preflight_edicion`.
- **Cero invenciones:** claves oficiales faltantes se dejan como pendientes, no se deducen de lo que respondió la mayoría de estudiantes. Nombres similares no permiten fusionar personas sin documento fiable.
- **Sin exposición pública:** usuarios `anon`, `authenticated` y `service_role` no tienen permiso para ejecutar la función privada. La RPC pública de consulta requiere JWT de operador administrativo autorizado.

## Contrato JSON por tipo de lote

No es un formato que el docente deba crear; **ChatGPT lo prepara a partir del Excel real** después de revisar todas las hojas.

### 1) Claves oficiales y asignación flexible de áreas
Cada fila usa `grado`, `numero_item`, `sesion`, `numero_en_sesion`, `area`, `respuesta_correcta`.

```json
[
  {"grado":10,"numero_item":45,"sesion":1,"numero_en_sesion":45,
   "area":"MATEMÁTICAS","respuesta_correcta":"B"}
]
```

El ítem 45 debe estar configurado previamente para ese grado y sesión en la edición. **El área se toma de la fila oficial, no de rangos fijos**, así Matemáticas puede ocupar 1–20 en `2026-1S` y 40–60 en `2026-2S`. Si el examen cambia la numeración interna por sesión, hay que reconciliar antes el catálogo de ítems y sesiones. No intentar cambiar posiciones mediante datos de respuestas. La asignación de áreas y el número de preguntas declaradas deben quedar coherentes al finalizar, como comprueba el preflight.

### 2) Inscripciones
Se exige `documento` fiable, `id_alumno`, `id_prueba` y `grado`. Los demás campos son `apellidos`, `nombres`, `sede`, `grupo`. Los valores identificadores se conservan como **cadenas**, especialmente los ceros iniciales del ID de prueba.

```json
[
  {"documento":"DOCUMENTO_VERIFICADO","id_alumno":"CODIGO_ESTABLE",
   "id_prueba":"0007","grado":10,"apellidos":"APELLIDOS",
   "nombres":"NOMBRES","sede":"SEDE","grupo":"10-1"}
]
```

Si el documento corresponde a una persona existente, se reutiliza la identidad de `roque_private.personas` pero se crea una inscripción nueva para la edición. Si el documento es dudoso, se aparta y **no se confunde por nombre**. El importador detecta documentos, IDs de alumno e IDs de prueba duplicados en el mismo lote y evita colisiones con los inscritos previamente.

### 3) Resultados
Cada registro incluye `id_prueba` y un objeto `respuestas` indexado por el número global del ítem **para el grado y la edición del alumno**. No se inserta si no existe antes la inscripción.

```json
[
  {"id_prueba":"0007","respuestas":{"1":"A","2":"BC","3":""}}
]
```

Se admiten `A`–`H`, marcas múltiples como `BC` y cadena vacía para sin marca; se rechazan caracteres incorrectos y números de pregunta inexistentes. **Nunca** se calcula la nota desde una supuesta clave implícita.

## Procedimiento para ChatGPT al recibir el archivo
1. Abrir cada hoja de EvalBee y detectar columnas reales; nunca confiar solo en las cabeceras esperadas.
2. Asegurar `2026-2S` (o edición destino explícita) y comparar contra `grados`, `items`, `areas`, `sesiones` existentes.
3. Detectar IDs duplicados, faltantes, preguntas fuera de rango, sesiones que no coinciden y ambigüedades documentales; separar incidencias para corrección antes de escribir.
4. Validar respuestas y **claves oficiales aportadas**. Si una asignatura cambió de posición, preparar el mapeo por ítem y validar la distribución.
5. Partir registros válidos en lotes de hasta 200 y ejecutar primero **simulación** de cada lote.
6. Realizar escrituras de forma explícita con `p_simular=false`, sin sobreescribir; el importador crea bitácora agregada.
7. Volver a consultar la edición y comparar los conteos reales contra las filas válidas, desglose por grado y preflight.
8. Mostrar al usuario el balance de insertados, idénticos, rechazados y pendientes, sin incluir datos personales en logs públicos.

## Ejemplo de uso SQL (solo rol postgres por conector)

```sql
SELECT roque_private.importar_lote_ia(
  '2026-2S', 'resultados',
  '[{"id_prueba":"0007","respuestas":{"1":"A","2":"BC"}}]'::jsonb,
  'EvalBee - exportación verificada - lote 01',
  true -- SIMULAR primero; false solo para realizar la escritura real
);
```

**No ejecutar el ejemplo como carga real:** `0007` es un identificador ilustrativo y debe existir una inscripción auténtica en la edición.

## Estado de entrega v168
La función de importación fue instalada y probada con escrituras **revertidas en una subtransacción**: inscripción, clave, resultado con marcas múltiples, duplicado idéntico y colisión contradictoria. También se verificó que el cambio de área para una pregunta se admite en un borrador. Al acabar las pruebas, `2026-2S` conserva **0 inscripciones, 0 resultados, 0 claves y 0 lotes de auditoría**.

No se ha realizado la carga del examen nuevo: aún no existe en la conversación un Excel de EvalBee ni claves oficiales para ese examen.
