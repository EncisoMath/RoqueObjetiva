-- RoqueObjetiva v175.61 | Claves institucionales compartidas por grado.
-- Coordinador: lectura. Administrador: escritura, protegida por JWT y auditoría.
-- Las claves históricas se corrigen mediante la RPC histórica auditada,
-- sin permitir anulación en ediciones cerradas ni desincronizar public.claves.

CREATE OR REPLACE FUNCTION public.roque_v12_claves_consultar(
 p_edicion text,
 p_grado integer DEFAULT NULL,
 p_docente text DEFAULT NULL,
 p_sesion text DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $fn$
DECLARE
 v_admin boolean;
 v_coord boolean;
 v_grado integer;
 v_estado text;
 v_items jsonb;
 v_grados jsonb;
 v_last timestamptz;
BEGIN
 v_admin := auth.uid() IS NOT NULL AND EXISTS(
   SELECT 1 FROM roque_private.operadores_admin o
   WHERE o.user_id=auth.uid() AND o.activo IS TRUE
 );
 v_coord := false;
 IF NOT v_admin THEN
   v_coord := roque_private.validar_coordinador_sesion(p_docente,p_sesion);
 END IF;
 IF NOT v_admin AND NOT v_coord THEN
   RAISE EXCEPTION 'No autorizado para consultar claves.' USING ERRCODE='42501';
 END IF;
 SELECT e.estado INTO v_estado FROM roque_private.ediciones e WHERE e.codigo=p_edicion;
 IF NOT FOUND THEN RAISE EXCEPTION 'Edición inexistente.' USING ERRCODE='22023'; END IF;
 IF p_grado IS NOT NULL AND (p_grado<1 OR p_grado>11) THEN
   RAISE EXCEPTION 'Grado incorrecto.' USING ERRCODE='22023';
 END IF;
 SELECT coalesce(jsonb_agg(g.grado ORDER BY g.grado),'[]'::jsonb)
 INTO v_grados
 FROM (SELECT DISTINCT i.grado FROM roque_private.items i
       WHERE i.edicion=p_edicion AND i.activo)g;
 v_grado:=p_grado;
 IF v_grado IS NULL THEN
   SELECT CASE WHEN EXISTS(SELECT 1 FROM roque_private.items i WHERE i.edicion=p_edicion AND i.grado=10 AND i.activo)
     THEN 10 ELSE (SELECT min(i.grado) FROM roque_private.items i WHERE i.edicion=p_edicion AND i.activo) END
   INTO v_grado;
 END IF;
 SELECT coalesce(jsonb_agg(jsonb_build_object(
   'numero_item', i.numero_item,
   'sesion', i.sesion,
   'numero_en_sesion', i.numero_en_sesion,
   'area', i.area,
   'correcta', i.respuesta_correcta,
   'anulada', i.anulada
 ) ORDER BY i.sesion,i.numero_en_sesion),'[]'::jsonb)
 INTO v_items FROM roque_private.items i
 WHERE i.edicion=p_edicion AND i.grado=v_grado AND i.activo;
 SELECT max(a.creado_en) INTO v_last
 FROM roque_private.auditoria_correcciones a
 WHERE a.edicion=p_edicion AND a.grado=v_grado AND a.tipo='clave';
 RETURN jsonb_build_object(
   'ok',true,'edicion',p_edicion,'grado',v_grado,'grados',v_grados,
   'estado',v_estado,'editable',v_admin,
   'permite_anular',v_admin AND v_estado='borrador',
   'motivo_requerido',v_admin AND v_estado<>'borrador',
   'ultima_edicion',v_last,'items',v_items
 );
END;
$fn$;
REVOKE ALL ON FUNCTION public.roque_v12_claves_consultar(text,integer,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.roque_v12_claves_consultar(text,integer,text,text) TO anon,authenticated;

CREATE OR REPLACE FUNCTION public.roque_v12_claves_guardar(
 p_edicion text,
 p_grado integer,
 p_cambios jsonb,
 p_motivo text DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $fn$
DECLARE
 v_estado text;
 v_item jsonb;
 v_num integer;
 v_before text;
 v_after text;
 v_anulada_before boolean;
 v_anulada_after boolean;
 v_row roque_private.items%ROWTYPE;
 v_count integer:=0;
 v_seen integer[]:=ARRAY[]::integer[];
 v_old jsonb;
 v_new jsonb;
 v_for_historic jsonb:='[]'::jsonb;
 v_historical jsonb;
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS(
   SELECT 1 FROM roque_private.operadores_admin o WHERE o.user_id=auth.uid() AND o.activo
 ) THEN
   RAISE EXCEPTION 'Solo el administrador puede modificar claves.' USING ERRCODE='42501';
 END IF;
 IF p_grado IS NULL OR p_grado NOT BETWEEN 1 AND 11
    OR jsonb_typeof(p_cambios) IS DISTINCT FROM 'array'
    OR jsonb_array_length(p_cambios) NOT BETWEEN 1 AND 100 THEN
   RAISE EXCEPTION 'Grado o cambios incorrectos (máximo 100).' USING ERRCODE='22023';
 END IF;
 SELECT e.estado INTO v_estado FROM roque_private.ediciones e
 WHERE e.codigo=p_edicion FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Edición inexistente.' USING ERRCODE='22023'; END IF;
 IF v_estado <> 'borrador' THEN
   IF p_edicion <> '2026-1S' OR v_estado NOT IN ('cerrada','publicada') THEN
     RAISE EXCEPTION 'Esta edición no permite modificar sus claves.' USING ERRCODE='42501';
   END IF;
   IF length(btrim(coalesce(p_motivo,''))) NOT BETWEEN 10 AND 500 THEN
     RAISE EXCEPTION 'La corrección histórica requiere un motivo de 10 a 500 caracteres.' USING ERRCODE='22023';
   END IF;
 END IF;
 FOR v_item IN SELECT value FROM jsonb_array_elements(p_cambios) LOOP
   IF jsonb_typeof(v_item)<>'object'
      OR coalesce(v_item->>'numero_item','') !~ '^[1-9][0-9]{0,3}$'
      OR jsonb_typeof(v_item->'anulada_antes') IS DISTINCT FROM 'boolean'
      OR jsonb_typeof(v_item->'anulada_nueva') IS DISTINCT FROM 'boolean' THEN
     RAISE EXCEPTION 'Ítem o anulaciones incorrectos.' USING ERRCODE='22023';
   END IF;
   v_num:=(v_item->>'numero_item')::integer;
   IF v_num=ANY(v_seen) THEN
     RAISE EXCEPTION 'Ítem repetido en el lote.' USING ERRCODE='23505';
   END IF;
   v_seen:=array_append(v_seen,v_num);
   v_before:=nullif(btrim(coalesce(v_item->>'correcta_antes','')),'');
   v_after:=nullif(btrim(coalesce(v_item->>'correcta_nueva','')),'');
   v_anulada_before:=(v_item->>'anulada_antes')::boolean;
   v_anulada_after:=(v_item->>'anulada_nueva')::boolean;
   IF (v_before IS NOT NULL AND v_before !~ '^[A-H]$')
      OR (v_after IS NOT NULL AND v_after !~ '^[A-H]$')
      OR (NOT v_anulada_after AND v_after IS NULL) THEN
     RAISE EXCEPTION 'Respuesta correcta inválida; usa A-H.' USING ERRCODE='22023';
   END IF;
   SELECT * INTO v_row FROM roque_private.items i
   WHERE i.edicion=p_edicion AND i.grado=p_grado AND i.numero_item=v_num
     AND i.activo IS TRUE
   FOR UPDATE;
   IF NOT FOUND THEN RAISE EXCEPTION 'Ítem no encontrado: %',v_num USING ERRCODE='22023'; END IF;
   IF v_row.respuesta_correcta IS DISTINCT FROM v_before
       OR v_row.anulada IS DISTINCT FROM v_anulada_before THEN
     RAISE EXCEPTION 'Las claves cambiaron en otra sesión; actualiza el listado.' USING ERRCODE='40001';
   END IF;
   IF v_estado<>'borrador' THEN
     IF v_anulada_after IS DISTINCT FROM v_anulada_before THEN
       RAISE EXCEPTION 'La anulación de ítems históricos requiere revisión institucional.' USING ERRCODE='42501';
     END IF;
     IF v_before IS DISTINCT FROM v_after THEN
       v_for_historic:=v_for_historic||jsonb_build_array(jsonb_build_object(
         'grado',p_grado,'numero_item',v_num,'correcta_antes',v_before,'correcta_nueva',v_after
       ));
     END IF;
   ELSIF v_before IS DISTINCT FROM v_after OR v_anulada_before IS DISTINCT FROM v_anulada_after THEN
     v_old:=jsonb_build_object('correcta',v_before,'anulada',v_anulada_before);
     v_new:=jsonb_build_object('correcta',v_after,'anulada',v_anulada_after);
     UPDATE roque_private.items SET respuesta_correcta=v_after,anulada=v_anulada_after
     WHERE edicion=p_edicion AND grado=p_grado AND numero_item=v_num;
     INSERT INTO roque_private.auditoria_correcciones
       (edicion,tipo,grado,numero_item,valor_anterior,valor_nuevo,motivo,administrador)
     VALUES(p_edicion,'clave',p_grado,v_num,v_old,v_new,
       coalesce(nullif(btrim(p_motivo),''),'Ajuste de claves en edición borrador'),auth.uid());
     v_count:=v_count+1;
   END IF;
 END LOOP;
 IF v_estado<>'borrador' AND jsonb_array_length(v_for_historic)>0 THEN
   -- Reutiliza la corrección histórica auditada, que también sincroniza public.claves.
   v_historical:=public.roque_v4_admin_corregir_claves_edicion(
     p_edicion,v_for_historic,p_motivo
   );
   v_count:=coalesce((v_historical->>'cambios')::integer,0);
 END IF;
 RETURN jsonb_build_object('ok',true,'edicion',p_edicion,'grado',p_grado,'cambios',v_count);
END;
$fn$;
REVOKE ALL ON FUNCTION public.roque_v12_claves_guardar(text,integer,jsonb,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.roque_v12_claves_guardar(text,integer,jsonb,text) TO authenticated;
