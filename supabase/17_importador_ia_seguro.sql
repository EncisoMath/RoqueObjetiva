-- RoqueObjetiva v168 · Importador IA privado, transaccional y sin sobrescrituras.
-- NO expuesto por el Data API. Ejecutar exclusivamente mediante conexión SQL administrativa.
-- Cada llamada de escritura se ejecuta de forma atómica: cualquier error revierte el lote.
CREATE TABLE IF NOT EXISTS roque_private.cargas_ia (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  edicion text NOT NULL REFERENCES roque_private.ediciones(codigo),
  tipo text NOT NULL CHECK (tipo IN ('claves','inscripciones','resultados')),
  origen text NOT NULL,
  hash_lote text NOT NULL,
  filas integer NOT NULL CHECK (filas > 0),
  insertadas integer NOT NULL CHECK (insertadas > 0),
  identicas integer NOT NULL DEFAULT 0,
  realizado_en timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE roque_private.cargas_ia ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON roque_private.cargas_ia FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION roque_private.importar_lote_ia(
  p_edicion text,
  p_tipo text,
  p_filas jsonb,
  p_origen text,
  p_simular boolean DEFAULT true
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $func$
DECLARE
  v_estado text;
  v_visible boolean;
  v_fila jsonb;
  v_vistas text[] := ARRAY[]::text[];
  v_id text;
  v_alumno text;
  v_documento text;
  v_doc_existente text;
  v_origen text := btrim(coalesce(p_origen,''));
  v_area text;
  v_clave text;
  v_respuestas jsonb;
  v_numero integer;
  v_grado integer;
  v_sesion integer;
  v_posicion integer;
  v_item roque_private.items%ROWTYPE;
  v_inscripcion roque_private.inscripciones%ROWTYPE;
  v_resultado roque_private.resultados%ROWTYPE;
  v_persona uuid;
  v_key text;
  v_value text;
  v_repetida boolean;
  v_n integer;
  v_insertar integer := 0;
  v_identicas integer := 0;
  v_escribir integer := 0;
BEGIN
  -- DEFENSA EN PROFUNDIDAD: además de los REVOKE, solo rol SQL administrativo.
  IF current_user <> 'postgres' THEN
    RAISE EXCEPTION 'Importación restringida al conector SQL administrativo.'
      USING ERRCODE='42501';
  END IF;
  IF p_tipo IS NULL OR p_tipo NOT IN ('claves','inscripciones','resultados') THEN
    RAISE EXCEPTION 'Tipo de lote no permitido.' USING ERRCODE='22023';
  END IF;
  IF p_edicion IS NULL OR p_edicion !~ '^[0-9]{4}-[12]S$' THEN
    RAISE EXCEPTION 'El código de edición no es válido.' USING ERRCODE='22023';
  END IF;
  IF p_simular IS NULL THEN
    RAISE EXCEPTION 'Es obligatorio especificar p_simular.' USING ERRCODE='22023';
  END IF;
  IF length(v_origen) < 4 OR length(v_origen) > 120 THEN
    RAISE EXCEPTION 'Indica un origen identificable (4-120 caracteres).' USING ERRCODE='22023';
  END IF;
  IF p_filas IS NULL OR jsonb_typeof(p_filas) <> 'array' THEN
    RAISE EXCEPTION 'p_filas debe ser un arreglo JSON.' USING ERRCODE='22023';
  END IF;
  v_n := jsonb_array_length(p_filas);
  IF v_n < 1 OR v_n > 200 THEN
    RAISE EXCEPTION 'Cada lote debe contener entre 1 y 200 filas.' USING ERRCODE='22023';
  END IF;
  -- Bloquea ediciones durante una importación; evita importar mientras se cierran/publican.
  SELECT estado, resultados_visibles INTO v_estado, v_visible
  FROM roque_private.ediciones WHERE codigo = p_edicion FOR UPDATE;
  IF NOT FOUND OR v_estado <> 'borrador' OR v_visible THEN
    RAISE EXCEPTION 'Edición inexistente, cerrada, publicada o no modificable: %.', p_edicion
      USING ERRCODE='42501';
  END IF;

  -- PRIMERA PASADA: validación total, sin escrituras de ningún tipo.
  FOR v_fila IN SELECT value FROM jsonb_array_elements(p_filas)
  LOOP
    IF jsonb_typeof(v_fila) <> 'object' THEN
      RAISE EXCEPTION 'Todas las filas deben ser objetos JSON.' USING ERRCODE='22023';
    END IF;
    IF p_tipo = 'claves' THEN
      IF (v_fila->>'grado') !~ '^[0-9]{1,2}$'
        OR (v_fila->>'numero_item') !~ '^[0-9]{1,4}$'
        OR (v_fila->>'sesion') !~ '^[0-9]{1,2}$'
        OR (v_fila->>'numero_en_sesion') !~ '^[0-9]{1,4}$' THEN
        RAISE EXCEPTION 'Clave con grado, número o sesión inválidos.' USING ERRCODE='22023';
      END IF;
      v_grado := (v_fila->>'grado')::integer;
      v_numero := (v_fila->>'numero_item')::integer;
      v_sesion := (v_fila->>'sesion')::integer;
      v_posicion := (v_fila->>'numero_en_sesion')::integer;
      v_area := btrim(coalesce(v_fila->>'area',''));
      v_clave := upper(btrim(coalesce(v_fila->>'respuesta_correcta','')));
      IF v_clave !~ '^[A-H]$' THEN
        RAISE EXCEPTION 'Clave no válida en grado %, ítem %.',v_grado,v_numero USING ERRCODE='22023';
      END IF;
      SELECT * INTO v_item FROM roque_private.items
      WHERE edicion=p_edicion AND grado=v_grado AND numero_item=v_numero;
      IF NOT FOUND OR NOT v_item.activo THEN
        RAISE EXCEPTION 'No existe ítem activo para grado %, pregunta %.',v_grado,v_numero USING ERRCODE='22023';
      END IF;
      IF v_item.sesion <> v_sesion OR v_item.numero_en_sesion <> v_posicion THEN
        RAISE EXCEPTION 'Sesión o posición discordante en grado %, pregunta %.',v_grado,v_numero USING ERRCODE='22023';
      END IF;
      IF NOT EXISTS (SELECT 1 FROM roque_private.areas
        WHERE edicion=p_edicion AND grado=v_grado AND area=v_area AND activo) THEN
        RAISE EXCEPTION 'Área no configurada: grado %, área %.',v_grado,v_area USING ERRCODE='22023';
      END IF;
      -- No remapear ni sobrescribir claves ya asignadas, salvo repetición idéntica.
      IF v_item.respuesta_correcta IS NOT NULL
        AND (v_item.respuesta_correcta <> v_clave OR v_item.area <> v_area) THEN
        RAISE EXCEPTION 'Clave existente diferente; no se sobrescribe: grado %, pregunta %.',v_grado,v_numero USING ERRCODE='23505';
      END IF;
      v_key := v_grado::text||':'||v_numero::text;
      v_repetida := v_item.respuesta_correcta=v_clave AND v_item.area=v_area;

    ELSIF p_tipo='inscripciones' THEN
      v_documento := btrim(coalesce(v_fila->>'documento',''));
      v_alumno := btrim(coalesce(v_fila->>'id_alumno',''));
      v_id := btrim(coalesce(v_fila->>'id_prueba',''));
      IF length(v_documento) < 3 OR length(v_alumno) < 1
        OR length(v_id) < 1 OR length(v_documento)>60 OR length(v_alumno)>80
        OR length(v_id)>80 OR (v_fila->>'grado') !~ '^[0-9]{1,2}$' THEN
        RAISE EXCEPTION 'Inscripción incompleta: documento, ID de alumno, ID de prueba y grado obligatorios.' USING ERRCODE='22023';
      END IF;
      v_grado := (v_fila->>'grado')::integer;
      IF NOT EXISTS (SELECT 1 FROM roque_private.grados
        WHERE edicion=p_edicion AND grado=v_grado AND activo) THEN
        RAISE EXCEPTION 'Grado % no configurado para %.',v_grado,p_edicion USING ERRCODE='22023';
      END IF;
      SELECT id INTO v_persona FROM roque_private.personas
      WHERE documento_inicial=v_documento;
      -- Impedir la vinculación de un documento a varios alumnos de la misma edición.
      SELECT i.* INTO v_inscripcion FROM roque_private.inscripciones i
      WHERE i.edicion=p_edicion
        AND (i.id_alumno=v_alumno OR i.id_prueba=v_id
          OR (v_persona IS NOT NULL AND i.persona_id=v_persona))
      LIMIT 1;
      IF FOUND THEN
        SELECT documento_inicial INTO v_doc_existente
        FROM roque_private.personas WHERE id=v_inscripcion.persona_id;
        IF v_inscripcion.id_alumno<>v_alumno OR v_inscripcion.id_prueba<>v_id
          OR v_inscripcion.grado<>v_grado OR v_doc_existente<>v_documento
          OR v_inscripcion.apellidos IS DISTINCT FROM nullif(btrim(v_fila->>'apellidos'),'')
          OR v_inscripcion.nombres IS DISTINCT FROM nullif(btrim(v_fila->>'nombres'),'')
          OR v_inscripcion.sede IS DISTINCT FROM nullif(btrim(v_fila->>'sede'),'')
          OR v_inscripcion.grupo IS DISTINCT FROM nullif(btrim(v_fila->>'grupo'),'')
          OR NOT v_inscripcion.activo THEN
          RAISE EXCEPTION 'Inscripción preexistente discordante: ID de prueba %.',v_id USING ERRCODE='23505';
        END IF;
        v_repetida := true;
      ELSE
        v_repetida := false;
      END IF;
      v_key := 'P:'||v_id;
      -- Rechaza explícitamente documento duplicado en el mismo lote,
      -- incluso si el ID de prueba es diferente.
      IF 'D:'||v_documento = ANY(v_vistas) THEN
        RAISE EXCEPTION 'Documento repetido dentro del lote: revisa los registros.' USING ERRCODE='23505';
      END IF;
      v_vistas := array_append(v_vistas, 'D:'||v_documento);
      IF 'A:'||v_alumno = ANY(v_vistas) THEN
        RAISE EXCEPTION 'ID de alumno repetido dentro del lote.' USING ERRCODE='23505';
      END IF;
      v_vistas := array_append(v_vistas, 'A:'||v_alumno);

    ELSE -- resultados
      v_id := btrim(coalesce(v_fila->>'id_prueba',''));
      v_respuestas := v_fila->'respuestas';
      IF length(v_id)<1 OR length(v_id)>80 OR v_respuestas IS NULL
        OR jsonb_typeof(v_respuestas) <> 'object'
        OR v_respuestas='{}'::jsonb THEN
        RAISE EXCEPTION 'Resultado sin ID de prueba o respuestas.' USING ERRCODE='22023';
      END IF;
      SELECT * INTO v_inscripcion FROM roque_private.inscripciones
      WHERE edicion=p_edicion AND id_prueba=v_id AND activo;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'Resultado sin inscripción en la misma edición, ID %.',v_id USING ERRCODE='23503';
      END IF;
      FOR v_key,v_value IN SELECT key,value FROM jsonb_each_text(v_respuestas)
      LOOP
        IF v_key !~ '^[0-9]{1,4}$' OR v_key::integer < 1 OR
          NOT EXISTS (SELECT 1 FROM roque_private.items
            WHERE edicion=p_edicion AND grado=v_inscripcion.grado
              AND numero_item=v_key::integer AND activo) THEN
          RAISE EXCEPTION 'Número de pregunta ajeno a esta edición/grado: %.',v_key USING ERRCODE='22023';
        END IF;
        -- Letras múltiples son válidas para hojas con marcas simultáneas; vacía=sin marca.
        IF v_value IS NULL OR v_value !~ '^[A-H]{0,8}$' THEN
          RAISE EXCEPTION 'Respuesta inválida en pregunta % del ID %.',v_key,v_id USING ERRCODE='22023';
        END IF;
      END LOOP;
      SELECT * INTO v_resultado FROM roque_private.resultados
      WHERE edicion=p_edicion AND id_prueba=v_id;
      IF FOUND THEN
        IF v_resultado.respuestas<>v_respuestas OR NOT v_resultado.activo THEN
          RAISE EXCEPTION 'Resultado preexistente diferente: no se sobrescribe el ID %.',v_id USING ERRCODE='23505';
        END IF;
        v_repetida:=true;
      ELSE
        v_repetida:=false;
      END IF;
      v_key:='P:'||v_id;
    END IF;
    IF v_key = ANY(v_vistas) THEN
      RAISE EXCEPTION 'Identificador duplicado dentro del lote: %.',v_key USING ERRCODE='23505';
    END IF;
    v_vistas:=array_append(v_vistas,v_key);
    IF v_repetida THEN v_identicas:=v_identicas+1; ELSE v_insertar:=v_insertar+1; END IF;
  END LOOP;

  IF p_simular THEN
    RETURN jsonb_build_object('edicion',p_edicion,'tipo',p_tipo,
      'simulacion',true,'filas',v_n,'nuevas',v_insertar,'identicas',v_identicas,
      'escrituras',0,'sin_sobrescrituras',true);
  END IF;

  -- SEGUNDA PASADA: escrituras atómicas (todo el lote, o ninguno).
  FOR v_fila IN SELECT value FROM jsonb_array_elements(p_filas)
  LOOP
    IF p_tipo='claves' THEN
      v_grado:=(v_fila->>'grado')::integer;
      v_numero:=(v_fila->>'numero_item')::integer;
      v_clave:=upper(btrim(v_fila->>'respuesta_correcta'));
      v_area:=btrim(v_fila->>'area');
      UPDATE roque_private.items
      SET area=v_area, respuesta_correcta=v_clave
      WHERE edicion=p_edicion AND grado=v_grado AND numero_item=v_numero
        AND respuesta_correcta IS NULL;
      GET DIAGNOSTICS v_n=ROW_COUNT;
      v_escribir:=v_escribir+v_n;
    ELSIF p_tipo='inscripciones' THEN
      v_documento:=btrim(v_fila->>'documento');
      INSERT INTO roque_private.personas(documento_inicial)
      VALUES(v_documento) ON CONFLICT(documento_inicial) DO NOTHING;
      SELECT id INTO STRICT v_persona FROM roque_private.personas
      WHERE documento_inicial=v_documento;
      INSERT INTO roque_private.inscripciones
        (edicion,persona_id,id_alumno,id_prueba,apellidos,nombres,sede,grado,grupo)
      VALUES (p_edicion,v_persona,btrim(v_fila->>'id_alumno'),btrim(v_fila->>'id_prueba'),
        nullif(btrim(v_fila->>'apellidos'),''),nullif(btrim(v_fila->>'nombres'),''),
        nullif(btrim(v_fila->>'sede'),''),(v_fila->>'grado')::integer,
        nullif(btrim(v_fila->>'grupo'),''))
      ON CONFLICT(edicion,id_alumno) DO NOTHING;
      GET DIAGNOSTICS v_n=ROW_COUNT;
      v_escribir:=v_escribir+v_n;
    ELSE
      INSERT INTO roque_private.resultados(edicion,id_prueba,respuestas,origen)
      VALUES(p_edicion,btrim(v_fila->>'id_prueba'),v_fila->'respuestas',v_origen)
      ON CONFLICT(edicion,id_prueba) DO NOTHING;
      GET DIAGNOSTICS v_n=ROW_COUNT;
      v_escribir:=v_escribir+v_n;
    END IF;
  END LOOP;
  IF v_escribir <> v_insertar THEN
    RAISE EXCEPTION 'El lote cambió durante la ejecución; se revierte completo.' USING ERRCODE='40001';
  END IF;
  IF v_escribir > 0 THEN
    INSERT INTO roque_private.cargas_ia
      (edicion,tipo,origen,hash_lote,filas,insertadas,identicas)
    VALUES(p_edicion,p_tipo,v_origen,md5(p_filas::text),jsonb_array_length(p_filas),
      v_escribir,v_identicas);
  END IF;
  RETURN jsonb_build_object('edicion',p_edicion,'tipo',p_tipo,'simulacion',false,
    'filas',jsonb_array_length(p_filas),'nuevas',v_insertar,'identicas',v_identicas,
    'escrituras',v_escribir,'sin_sobrescrituras',true);
END;
$func$;

REVOKE ALL ON FUNCTION roque_private.importar_lote_ia(text,text,jsonb,text,boolean)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION roque_private.importar_lote_ia(text,text,jsonb,text,boolean) TO postgres;