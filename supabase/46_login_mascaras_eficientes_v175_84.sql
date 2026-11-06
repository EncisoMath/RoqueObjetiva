-- v175.84b: Optimización de redacción de respuestas cuando existen medidas.
-- Los estudiantes sin medidas permanecen sin transformaciones y nunca se reescriben datos fuente.

CREATE OR REPLACE FUNCTION roque_private.mascara_fila_docente_legacy(
  p_edicion text, p_grado integer, p_inicio integer, p_fila jsonb
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE
  v_id text:=p_fila->>'Roll No';
  v_restricted boolean;
  v_keys text[];
  v_masked jsonb;
BEGIN
  IF v_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM roque_private.medidas_estudiante m
    WHERE m.edicion=p_edicion AND m.id_prueba=v_id AND m.activo
  ) THEN RETURN p_fila; END IF;

  SELECT EXISTS(
    SELECT 1 FROM roque_private.medidas_estudiante m
    WHERE m.edicion=p_edicion AND m.id_prueba=v_id AND m.tipo='restriccion' AND m.activo
  ) INTO v_restricted;

  IF v_restricted THEN
    SELECT coalesce(jsonb_object_agg(e.key,e.value),'{}'::jsonb)
    INTO v_masked FROM jsonb_each(p_fila) e
    WHERE e.key !~ '^Q [0-9]+ Options$';
    RETURN v_masked;
  END IF;

  -- Ítems afectados en esta fila y sesión. El número de pregunta visible
  -- es relativo a startItem, como el payload legacy original.
  SELECT array_agg(DISTINCT 'Q '||(it.numero_item-p_inicio+1)::text||' Options')
  INTO v_keys
  FROM roque_private.items it
  JOIN roque_private.medidas_estudiante m
    ON m.edicion=it.edicion AND m.id_prueba=v_id AND m.activo
  WHERE it.edicion=p_edicion AND it.grado=p_grado AND it.activo
    AND (
      (m.tipo='sesion' AND m.clave=it.sesion::text)
      OR (m.tipo='area' AND m.clave=roque_private.canon_area_medida(it.area))
    );
  IF cardinality(v_keys) IS NULL OR cardinality(v_keys)=0 THEN RETURN p_fila; END IF;

  SELECT coalesce(jsonb_object_agg(e.key,e.value),'{}'::jsonb)
  INTO v_masked FROM jsonb_each(p_fila) e
  WHERE NOT e.key=ANY(v_keys);
  RETURN v_masked;
END;
$$;
REVOKE ALL ON FUNCTION roque_private.mascara_fila_docente_legacy(text,integer,integer,jsonb)
 FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION roque_private.mascara_payload_docente_legacy(
  p_payload jsonb,p_edicion text
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE
  v_affected_ids text[];
  v_groups jsonb:='[]'::jsonb;
  v_group jsonb;
  v_rows jsonb;
  v_grade integer;
  v_start integer;
  v_medidas jsonb;
BEGIN
  IF p_payload->'session'->>'role' NOT IN ('student','teacher') THEN RETURN p_payload; END IF;

  SELECT array_agg(DISTINCT m.id_prueba) INTO v_affected_ids
  FROM roque_private.medidas_estudiante m
  WHERE m.edicion=p_edicion AND m.activo;

  IF coalesce(cardinality(v_affected_ids),0)=0 THEN
    RETURN jsonb_set(p_payload,'{datasets,medidas}','[]'::jsonb,true);
  END IF;

  -- Agrupar filas una única vez. Conservar el orden original de los grupos
  -- y la estructura de cada resultado. Solo tocar filas de alumnos afectados.
  FOR v_group IN SELECT value FROM jsonb_array_elements(
    coalesce(p_payload->'datasets'->'resultados','[]'::jsonb)
  ) LOOP
    v_grade:=coalesce(nullif(v_group->>'grade','')::integer,0);
    v_start:=coalesce(nullif(v_group->>'startItem','')::integer,
      CASE WHEN v_group->>'session'='2' THEN 71 ELSE 1 END);
    SELECT coalesce(jsonb_agg(
      CASE
        WHEN row_data.value->>'Roll No'=ANY(v_affected_ids)
        THEN roque_private.mascara_fila_docente_legacy(
          p_edicion,v_grade,v_start,row_data.value)
        ELSE row_data.value
      END ORDER BY row_data.ordinality
    ),'[]'::jsonb) INTO v_rows
    FROM jsonb_array_elements(coalesce(v_group->'rows','[]'::jsonb))
      WITH ORDINALITY AS row_data(value,ordinality);

    v_groups:=v_groups||jsonb_build_array(
      jsonb_set(v_group,'{rows}',v_rows,true));
  END LOOP;

  SELECT coalesce(jsonb_agg(
    roque_private.resumen_medidas(p_edicion,e.x->>'ID_PRUEBA',
    coalesce(nullif(e.x->>'GRADO','')::integer,0))
  ),'[]'::jsonb) INTO v_medidas
  FROM jsonb_array_elements(
    coalesce(p_payload->'datasets'->'estudiantes','[]'::jsonb)
  ) e(x);

  RETURN jsonb_set(
    jsonb_set(p_payload,'{datasets,resultados}',v_groups,true),
    '{datasets,medidas}',v_medidas,true);
END;
$$;
REVOKE ALL ON FUNCTION roque_private.mascara_payload_docente_legacy(jsonb,text)
 FROM PUBLIC,anon,authenticated;