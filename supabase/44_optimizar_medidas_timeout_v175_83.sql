-- v175.83 · Corregir trabajo cuadrático al construir medidas por estudiante.
-- No cambia registros ni notas: optimiza exclusivamente evaluación de medidas.
CREATE OR REPLACE FUNCTION roque_private.resumen_medidas(
 p_edicion text,p_id_prueba text,p_grado integer
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE
 v_restringido boolean:=false;
 v_area_keys text[]:=array[]::text[];
 v_sesiones smallint[]:=array[]::smallint[];
 v_areas jsonb:='[]'::jsonb;
 v_sesiones_json jsonb:='[]'::jsonb;
BEGIN
 -- Acceso indexado por edición/ID y salida inmediata sin medidas.
 IF NOT EXISTS(
   SELECT 1 FROM roque_private.medidas_estudiante m
   WHERE m.edicion=p_edicion AND m.id_prueba=p_id_prueba AND m.activo
 ) THEN
   RETURN jsonb_build_object(
     'id_prueba',p_id_prueba,'restringido',false,
     'areas_anuladas','[]'::jsonb,'sesiones_anuladas','[]'::jsonb
   );
 END IF;

 SELECT
   coalesce(bool_or(m.tipo='restriccion'),false),
   coalesce(array_agg(DISTINCT m.clave) FILTER (WHERE m.tipo='area'),array[]::text[]),
   coalesce(array_agg(DISTINCT m.clave::smallint) FILTER (WHERE m.tipo='sesion'),array[]::smallint[])
 INTO v_restringido,v_area_keys,v_sesiones
 FROM roque_private.medidas_estudiante m
 WHERE m.edicion=p_edicion AND m.id_prueba=p_id_prueba AND m.activo;

 SELECT coalesce(jsonb_agg(s.numero ORDER BY s.numero),'[]'::jsonb)
 INTO v_sesiones_json FROM unnest(v_sesiones) AS s(numero);

 IF NOT v_restringido AND (cardinality(v_area_keys)>0 OR cardinality(v_sesiones)>0) THEN
   SELECT coalesce(jsonb_agg(a.nombre ORDER BY a.nombre),'[]'::jsonb)
   INTO v_areas
   FROM (
     SELECT DISTINCT roque_private.canon_area_medida(it.area) AS nombre
     FROM roque_private.items it
     WHERE it.edicion=p_edicion AND it.grado=p_grado AND it.activo
       AND (roque_private.canon_area_medida(it.area)=ANY(v_area_keys)
            OR it.sesion=ANY(v_sesiones))
   ) a;
 END IF;
 RETURN jsonb_build_object('id_prueba',p_id_prueba,
   'restringido',v_restringido,
   'areas_anuladas',v_areas,
   'sesiones_anuladas',v_sesiones_json);
END;
$$;
REVOKE ALL ON FUNCTION roque_private.resumen_medidas(text,text,integer) FROM PUBLIC,anon,authenticated;

-- También limitar la búsqueda de ítems anulados únicamente a estudiantes afectados.
CREATE OR REPLACE FUNCTION roque_private.mascara_respuestas_medidas(
 p_edicion text,p_id_prueba text,p_grado integer,p_respuestas jsonb
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE
 v_res jsonb:=coalesce(p_respuestas,'{}'::jsonb);
 v_areas text[]:=array[]::text[];
 v_sesiones smallint[]:=array[]::smallint[];
 v_restringido boolean:=false;
 v_item record;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM roque_private.medidas_estudiante m
   WHERE m.edicion=p_edicion AND m.id_prueba=p_id_prueba AND m.activo)
 THEN RETURN v_res; END IF;
 SELECT coalesce(bool_or(m.tipo='restriccion'),false),
        coalesce(array_agg(DISTINCT m.clave) FILTER(WHERE m.tipo='area'),array[]::text[]),
        coalesce(array_agg(DISTINCT m.clave::smallint) FILTER(WHERE m.tipo='sesion'),array[]::smallint[])
 INTO v_restringido,v_areas,v_sesiones
 FROM roque_private.medidas_estudiante m
 WHERE m.edicion=p_edicion AND m.id_prueba=p_id_prueba AND m.activo;
 IF v_restringido THEN RETURN '{}'::jsonb; END IF;
 IF cardinality(v_areas)=0 AND cardinality(v_sesiones)=0 THEN RETURN v_res; END IF;
 FOR v_item IN
   SELECT it.numero_item FROM roque_private.items it
   WHERE it.edicion=p_edicion AND it.grado=p_grado AND it.activo
     AND (roque_private.canon_area_medida(it.area)=ANY(v_areas)
       OR it.sesion=ANY(v_sesiones))
 LOOP
   v_res:=v_res-v_item.numero_item::text;
 END LOOP;
 RETURN v_res;
END;
$$;
REVOKE ALL ON FUNCTION roque_private.mascara_respuestas_medidas(text,text,integer,jsonb) FROM PUBLIC,anon,authenticated;
