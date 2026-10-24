-- RoqueObjetiva v171: correcciones auditadas, atómicas y por edición.
-- No altera datos existentes durante la instalación.
CREATE TABLE IF NOT EXISTS roque_private.auditoria_correcciones (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 edicion text NOT NULL REFERENCES roque_private.ediciones(codigo),
 tipo text NOT NULL CHECK(tipo IN ('resultado','clave')),
 id_prueba text,
 grado smallint,
 numero_item integer,
 valor_anterior jsonb NOT NULL,
 valor_nuevo jsonb NOT NULL,
 motivo text NOT NULL,
 administrador uuid NOT NULL,
 creado_en timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS correcciones_edicion_fecha_idx ON roque_private.auditoria_correcciones(edicion,creado_en DESC);
ALTER TABLE roque_private.auditoria_correcciones ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON roque_private.auditoria_correcciones FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.roque_v4_admin_corregir_resultado_edicion(
 p_edicion text, p_id_prueba text, p_respuestas jsonb, p_esperado jsonb, p_motivo text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $f$
DECLARE
 v_exam text:=btrim(coalesce(p_id_prueba,''));
 v_old public.resultados%ROWTYPE;
 v_private roque_private.resultados%ROWTYPE;
 v_antes jsonb;
 v_nuevas jsonb:='{}'::jsonb;
 v_esperadas jsonb:='{}'::jsonb;
 v_key text; v_value text; v_grado smallint; v_estado text; v_visible boolean;
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS (
   SELECT 1 FROM roque_private.operadores_admin a
   WHERE a.user_id=auth.uid() AND a.activo
 ) THEN RAISE EXCEPTION 'Acceso administrativo no autorizado' USING ERRCODE='42501'; END IF;
 IF p_edicion IS DISTINCT FROM '2026-1S' THEN
   RAISE EXCEPTION 'Las correcciones históricas solo están autorizadas para 2026-1S; 2026-2S sigue en preparación.' USING ERRCODE='42501';
 END IF;
 IF length(btrim(coalesce(p_motivo,'')))<10 OR length(p_motivo)>500 THEN
   RAISE EXCEPTION 'Indica el motivo de la corrección (10 a 500 caracteres).' USING ERRCODE='22023';
 END IF;
 IF v_exam='' OR jsonb_typeof(p_respuestas) IS DISTINCT FROM 'object'
   OR jsonb_typeof(p_esperado) IS DISTINCT FROM 'object' THEN
   RAISE EXCEPTION 'El ID y las respuestas antes/después son obligatorios.' USING ERRCODE='22023'; END IF;
 SELECT estado,resultados_visibles INTO v_estado,v_visible
 FROM roque_private.ediciones WHERE codigo=p_edicion FOR UPDATE;
 IF NOT FOUND OR v_estado NOT IN ('cerrada','publicada') OR NOT v_visible THEN
  RAISE EXCEPTION 'Edición no publicada o no editable.' USING ERRCODE='42501'; END IF;
 SELECT grado INTO v_grado FROM roque_private.inscripciones
 WHERE edicion=p_edicion AND id_prueba=v_exam AND activo;
 IF NOT FOUND THEN RAISE EXCEPTION 'No existe la inscripción activa en esta edición.' USING ERRCODE='22023'; END IF;
 SELECT * INTO v_old FROM public.resultados WHERE id_prueba=v_exam FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'El examen histórico no existe en public.' USING ERRCODE='22023'; END IF;
 SELECT * INTO v_private FROM roque_private.resultados
 WHERE edicion=p_edicion AND id_prueba=v_exam FOR UPDATE;
 IF NOT FOUND OR v_old.respuestas IS DISTINCT FROM v_private.respuestas
   OR v_old.activo IS DISTINCT FROM v_private.activo THEN
   RAISE EXCEPTION 'Las copias históricas difieren; no se modificó ninguna.' USING ERRCODE='40001'; END IF;
 IF NOT v_old.activo THEN
   RAISE EXCEPTION 'No se permite activar exámenes inactivos mediante esta operación.' USING ERRCODE='42501'; END IF;
 -- Comparación optimista: formulario desactualizado o sobrescrito en otra sesión.
 SELECT coalesce(jsonb_object_agg(key, upper(btrim(value)))
                  FILTER(WHERE btrim(value)<>''),'{}'::jsonb)
 INTO v_antes FROM jsonb_each_text(v_old.respuestas);
 FOR v_key,v_value IN SELECT key,value FROM jsonb_each_text(p_esperado)
 LOOP
   IF v_key !~ '^[1-9][0-9]{0,3}$' OR v_value !~ '^[A-H]{1,8}$' THEN
      RAISE EXCEPTION 'Estado anterior inválido.' USING ERRCODE='22023'; END IF;
   v_esperadas:=v_esperadas||jsonb_build_object(v_key,v_value);
 END LOOP;
 IF v_esperadas IS DISTINCT FROM v_antes THEN
   RAISE EXCEPTION 'Este examen cambió después de abrirlo; vuelve a cargar antes de corregir.' USING ERRCODE='40001'; END IF;
 FOR v_key,v_value IN SELECT key,value FROM jsonb_each_text(p_respuestas)
 LOOP
   IF v_key !~ '^[1-9][0-9]{0,3}$' OR v_value !~ '^[A-H]{1,8}$'
     OR NOT EXISTS(SELECT 1 FROM roque_private.items k
       WHERE k.edicion=p_edicion AND k.grado=v_grado
        AND k.numero_item=v_key::integer AND k.activo AND NOT k.anulada)
   THEN RAISE EXCEPTION 'Respuesta o pregunta inválida: %',v_key USING ERRCODE='22023'; END IF;
   v_nuevas:=v_nuevas||jsonb_build_object(v_key,v_value);
 END LOOP;
 IF v_nuevas=v_antes THEN
   RETURN jsonb_build_object('ok',true,'cambios',0,'edicion',p_edicion,'id_prueba',v_exam);
 END IF;
 -- Cambiar DOS copias o NINGUNA, sin UPSERT ni eliminación masiva.
 UPDATE public.resultados SET respuestas=v_nuevas
 WHERE id_prueba=v_exam;
 UPDATE roque_private.resultados
 SET respuestas=v_nuevas,origen='correccion_admin',actualizado_en=now()
 WHERE edicion=p_edicion AND id_prueba=v_exam;
 INSERT INTO roque_private.auditoria_correcciones
 (edicion,tipo,id_prueba,valor_anterior,valor_nuevo,motivo,administrador)
 VALUES(p_edicion,'resultado',v_exam,v_old.respuestas,v_nuevas,btrim(p_motivo),auth.uid());
 RETURN jsonb_build_object('ok',true,'cambios',1,'edicion',p_edicion,'id_prueba',v_exam);
END
$f$;

CREATE OR REPLACE FUNCTION public.roque_v4_admin_corregir_claves_edicion(
 p_edicion text,p_cambios jsonb,p_motivo text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $f$
DECLARE
 v_item jsonb; v_grade int; v_num int; v_before text; v_after text;
 v_public public.claves%ROWTYPE; v_private roque_private.items%ROWTYPE;
 v_seen text[]:=ARRAY[]::text[]; v_count int:=0; v_key text; v_estado text;v_visible bool;
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS (
   SELECT 1 FROM roque_private.operadores_admin WHERE user_id=auth.uid() AND activo
 ) THEN RAISE EXCEPTION 'Acceso administrativo no autorizado' USING ERRCODE='42501'; END IF;
 IF p_edicion IS DISTINCT FROM '2026-1S' THEN
   RAISE EXCEPTION 'Esta corrección histórica no permite modificar borradores.' USING ERRCODE='42501'; END IF;
 IF length(btrim(coalesce(p_motivo,'')))<10 OR length(p_motivo)>500 THEN
   RAISE EXCEPTION 'Indica el motivo de la corrección (10 a 500 caracteres).' USING ERRCODE='22023'; END IF;
 IF jsonb_typeof(p_cambios) IS DISTINCT FROM 'array'
    OR jsonb_array_length(p_cambios) NOT BETWEEN 1 AND 100 THEN
   RAISE EXCEPTION 'Se requiere una lista de 1 a 100 cambios de clave.' USING ERRCODE='22023'; END IF;
 SELECT estado,resultados_visibles INTO v_estado,v_visible FROM roque_private.ediciones
 WHERE codigo=p_edicion FOR UPDATE;
 IF NOT FOUND OR v_estado NOT IN('cerrada','publicada') OR NOT v_visible THEN
   RAISE EXCEPTION 'Edición no publicada.' USING ERRCODE='42501'; END IF;
 FOR v_item IN SELECT value FROM jsonb_array_elements(p_cambios)
 LOOP
   IF jsonb_typeof(v_item)<>'object'
      OR (v_item->>'grado') !~ '^[0-9]{1,2}$'
      OR (v_item->>'numero_item') !~ '^[1-9][0-9]{0,3}$' THEN
      RAISE EXCEPTION 'Grado o ítem inválido.' USING ERRCODE='22023'; END IF;
   v_grade:=(v_item->>'grado')::int;v_num:=(v_item->>'numero_item')::int;
   v_before:=v_item->>'correcta_antes';v_after:=v_item->>'correcta_nueva';
   IF v_before !~ '^[A-H]$' OR v_after !~ '^[A-H]$' THEN
      RAISE EXCEPTION 'Las claves deben ser A-H.' USING ERRCODE='22023'; END IF;
   v_key:=v_grade::text||':'||v_num::text;
   IF v_key=ANY(v_seen) THEN RAISE EXCEPTION 'Clave duplicada en el lote: %',v_key USING ERRCODE='23505'; END IF;
   v_seen:=array_append(v_seen,v_key);
   SELECT * INTO v_public FROM public.claves WHERE grado=v_grade AND numero_item=v_num FOR UPDATE;
   IF NOT FOUND THEN RAISE EXCEPTION 'No existe clave pública: %',v_key USING ERRCODE='22023'; END IF;
   SELECT * INTO v_private FROM roque_private.items WHERE edicion=p_edicion AND grado=v_grade
    AND numero_item=v_num FOR UPDATE;
   IF NOT FOUND OR v_public.respuesta_sugerida IS DISTINCT FROM v_private.respuesta_correcta
     OR v_public.area IS DISTINCT FROM v_private.area
     OR v_public.activo IS DISTINCT FROM v_private.activo
   THEN RAISE EXCEPTION 'Copias de clave diferentes: %; operación revertida',v_key USING ERRCODE='40001'; END IF;
   IF NOT v_public.activo OR v_private.anulada
     OR v_public.respuesta_sugerida IS DISTINCT FROM v_before THEN
     RAISE EXCEPTION 'Clave cambió o está inactiva: %; actualiza la pantalla.',v_key USING ERRCODE='40001'; END IF;
   IF v_before<>v_after THEN
    UPDATE public.claves SET respuesta_sugerida=v_after WHERE id=v_public.id;
    UPDATE roque_private.items SET respuesta_correcta=v_after WHERE edicion=p_edicion
      AND grado=v_grade AND numero_item=v_num;
    INSERT INTO roque_private.auditoria_correcciones
       (edicion,tipo,grado,numero_item,valor_anterior,valor_nuevo,motivo,administrador)
    VALUES(p_edicion,'clave',v_grade,v_num,to_jsonb(v_before),to_jsonb(v_after),
      btrim(p_motivo),auth.uid());
    v_count:=v_count+1;
   END IF;
 END LOOP;
 RETURN jsonb_build_object('ok',true,'edicion',p_edicion,'cambios',v_count);
END
$f$;

REVOKE ALL ON FUNCTION public.roque_v4_admin_corregir_resultado_edicion(text,text,jsonb,jsonb,text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.roque_v4_admin_corregir_claves_edicion(text,jsonb,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.roque_v4_admin_corregir_resultado_edicion(text,text,jsonb,jsonb,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.roque_v4_admin_corregir_claves_edicion(text,jsonb,text) TO authenticated;

-- Compatibilidad con clientes v170 almacenados en caché: nunca permitir escritura
-- únicamente en public. Se encamina por la misma operación dual auditada.
CREATE OR REPLACE FUNCTION public.roque_v3_admin_guardar_resultado(
  p_id_prueba text,p_respuestas jsonb,p_activo boolean DEFAULT true
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $old$
DECLARE v_current jsonb; v_resp jsonb; v_raw jsonb;
BEGIN
 IF NOT coalesce(p_activo,true) THEN
   RAISE EXCEPTION 'La edición de estado activo está deshabilitada.' USING ERRCODE='42501'; END IF;
 IF auth.uid() IS NULL OR NOT EXISTS (
   SELECT 1 FROM roque_private.operadores_admin WHERE user_id=auth.uid() AND activo
 ) THEN RAISE EXCEPTION 'Acceso administrativo no autorizado.' USING ERRCODE='42501'; END IF;
 SELECT r.respuestas INTO v_raw FROM public.resultados r WHERE r.id_prueba=btrim(p_id_prueba);
 IF NOT FOUND THEN RAISE EXCEPTION 'No existe el examen; no se hacen inserciones sin revisar.' USING ERRCODE='22023'; END IF;
 SELECT coalesce(jsonb_object_agg(key,upper(btrim(value)))
   FILTER(WHERE btrim(value)<>''),'{}'::jsonb) INTO v_current FROM jsonb_each_text(v_raw);
 SELECT coalesce(jsonb_object_agg(key,upper(btrim(value)))
   FILTER(WHERE btrim(value)<>''),'{}'::jsonb) INTO v_resp FROM jsonb_each_text(p_respuestas);
 RETURN public.roque_v4_admin_corregir_resultado_edicion(
  '2026-1S',p_id_prueba,v_resp,v_current,'Compatibilidad con cliente antiguo; corrección administrativa individual');
END
$old$;
REVOKE ALL ON FUNCTION public.roque_v3_admin_guardar_resultado(text,jsonb,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.roque_v3_admin_guardar_resultado(text,jsonb,boolean) TO authenticated;
