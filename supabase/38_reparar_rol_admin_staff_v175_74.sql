-- v175.74 · Personal y Claves para administrador institucional con
-- sesión de coordinación validada y rol de Personal docente 'administrador'.
-- Aplicar después de 37_roles_personal_docente_login_v175_73.sql.
CREATE TABLE IF NOT EXISTS roque_private.auditoria_personal_docente_staff(
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 actor_docente text NOT NULL REFERENCES public.docentes(id_docente),
 operacion text NOT NULL,id_docente text NOT NULL,antes jsonb,despues jsonb,
 creado_en timestamptz NOT NULL DEFAULT clock_timestamp()
);
ALTER TABLE roque_private.auditoria_personal_docente_staff ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON roque_private.auditoria_personal_docente_staff FROM PUBLIC,anon,authenticated;

CREATE TABLE IF NOT EXISTS roque_private.auditoria_claves_staff(
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 edicion text NOT NULL REFERENCES roque_private.ediciones(codigo),
 grado integer NOT NULL,numero_item integer NOT NULL,
 valor_anterior jsonb NOT NULL,valor_nuevo jsonb NOT NULL,
 motivo text NOT NULL,actor_docente text NOT NULL REFERENCES public.docentes(id_docente),
 creado_en timestamptz NOT NULL DEFAULT clock_timestamp()
);
ALTER TABLE roque_private.auditoria_claves_staff ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON roque_private.auditoria_claves_staff FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.roque_v15_staff_admin_claves_consultar(p_edicion text, p_grado integer, p_docente text, p_sesion text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
 v_admin boolean;
 v_coord boolean;
 v_grado integer;
 v_estado text;
 v_items jsonb;
 v_grados jsonb;
 v_last timestamptz;
BEGIN
 IF NOT EXISTS(
 SELECT 1 FROM public.docentes d
 WHERE d.id_docente=p_docente AND d.activo AND d.rol='administrador'
) OR NOT roque_private.validar_coordinador_sesion(p_docente,p_sesion) THEN
 RAISE EXCEPTION 'Sesión administrativa inválida o vencida.' USING ERRCODE='42501';
END IF;
 v_admin := true;
 v_coord := false;
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
 SELECT greatest(
   (SELECT max(a.creado_en) FROM roque_private.auditoria_correcciones a
    WHERE a.edicion=p_edicion AND a.grado=v_grado AND a.tipo='clave'),
   (SELECT max(c.creado_en) FROM roque_private.auditoria_anulaciones_coordinador c
    WHERE c.edicion=p_edicion AND c.grado=v_grado)
 ) INTO v_last;
 RETURN jsonb_build_object(
   'ok',true,'edicion',p_edicion,'grado',v_grado,'grados',v_grados,
   'estado',v_estado,'editable',v_admin AND v_estado='borrador',
   'permite_anular',v_admin AND v_estado='borrador',
   'motivo_requerido',false,
   'ultima_edicion',v_last,'items',v_items
 );
END;
$function$;
REVOKE ALL ON FUNCTION public.roque_v15_staff_admin_claves_consultar(text,integer,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.roque_v15_staff_admin_claves_consultar(text,integer,text,text) TO anon,authenticated;

CREATE OR REPLACE FUNCTION public.roque_v15_staff_admin_claves_guardar(p_edicion text, p_grado integer, p_cambios jsonb, p_motivo text, p_docente text, p_sesion text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
 IF NOT EXISTS(
 SELECT 1 FROM public.docentes d
 WHERE d.id_docente=p_docente AND d.activo AND d.rol='administrador'
) OR NOT roque_private.validar_coordinador_sesion(p_docente,p_sesion) THEN
 RAISE EXCEPTION 'Sesión administrativa inválida o vencida.' USING ERRCODE='42501';
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
   RAISE EXCEPTION 'La edición está cerrada. Las claves históricas se consultan sin modificarlas.' USING ERRCODE='42501';
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
     INSERT INTO roque_private.auditoria_claves_staff
       (edicion,grado,numero_item,valor_anterior,valor_nuevo,motivo,actor_docente)
     VALUES(p_edicion,p_grado,v_num,v_old,v_new,
       coalesce(nullif(btrim(p_motivo),''),'Ajuste de claves en edición borrador'),p_docente);
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
$function$;
REVOKE ALL ON FUNCTION public.roque_v15_staff_admin_claves_guardar(text,integer,jsonb,text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.roque_v15_staff_admin_claves_guardar(text,integer,jsonb,text,text,text) TO anon,authenticated;

CREATE OR REPLACE FUNCTION public.roque_v15_staff_admin_personal_guardar(p_operacion text, p_datos jsonb, p_docente text, p_sesion text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
 v_id text; v_nombre text; v_sede text; v_asignatura text; v_curso text;
 v_grado integer; v_carga bigint; v_antes jsonb; v_despues jsonb; v_rol text;
BEGIN
 IF NOT EXISTS(
 SELECT 1 FROM public.docentes d
 WHERE d.id_docente=p_docente AND d.activo AND d.rol='administrador'
) OR NOT roque_private.validar_coordinador_sesion(p_docente,p_sesion) THEN
 RAISE EXCEPTION 'Sesión administrativa inválida o vencida.' USING ERRCODE='42501';
END IF;
 IF p_datos IS NULL OR jsonb_typeof(p_datos)<>'object' THEN
   RAISE EXCEPTION 'Datos incorrectos.' USING ERRCODE='22023';
 END IF;
 v_id:=btrim(coalesce(p_datos->>'id',''));
 IF p_datos ? 'rol' THEN
   v_rol:=lower(btrim(coalesce(p_datos->>'rol','')));
   IF v_rol NOT IN ('administrador','coordinador','docente') THEN
     RAISE EXCEPTION 'Rol institucional inválido.' USING ERRCODE='22023';
   END IF;
 END IF;
 IF v_id='' OR length(v_id)>40 THEN
   RAISE EXCEPTION 'Identificación de docente inválida.' USING ERRCODE='22023';
 END IF;
 CASE p_operacion
 WHEN 'crear' THEN
   v_nombre:=btrim(coalesce(p_datos->>'nombre',''));
   IF length(v_nombre)<4 OR length(v_nombre)>160 THEN
     RAISE EXCEPTION 'Ingresa un nombre de docente válido.' USING ERRCODE='22023';
   END IF;
   INSERT INTO public.docentes(id_docente,nombre,sede,coordinador,rol,activo)
   VALUES(v_id,v_nombre,nullif(btrim(coalesce(p_datos->>'sede','')),''),
     coalesce(v_rol='coordinador',coalesce((p_datos->>'coordinador')::boolean,false)),
     coalesce(v_rol,CASE WHEN coalesce((p_datos->>'coordinador')::boolean,false) THEN 'coordinador' ELSE 'docente' END),true);
   v_despues:=jsonb_build_object('id',v_id,'nombre',v_nombre,'sede',p_datos->>'sede');
 WHEN 'actualizar' THEN
   SELECT to_jsonb(d) INTO v_antes FROM public.docentes d WHERE d.id_docente=v_id FOR UPDATE;
   IF v_antes IS NULL THEN RAISE EXCEPTION 'Docente inexistente.' USING ERRCODE='22023'; END IF;
   v_nombre:=btrim(coalesce(p_datos->>'nombre',v_antes->>'nombre'));
   IF length(v_nombre)<4 OR length(v_nombre)>160 THEN
     RAISE EXCEPTION 'Ingresa un nombre válido.' USING ERRCODE='22023';
   END IF;
   UPDATE public.docentes d SET
     nombre=v_nombre,
     sede=CASE WHEN p_datos ? 'sede' THEN nullif(btrim(p_datos->>'sede'),'') ELSE d.sede END,
     coordinador=CASE WHEN p_datos ? 'rol' THEN v_rol='coordinador'
                  WHEN p_datos ? 'coordinador' THEN (p_datos->>'coordinador')::boolean
                  ELSE d.coordinador END,
     rol=CASE WHEN p_datos ? 'rol' THEN v_rol
              WHEN p_datos ? 'coordinador' THEN
                CASE WHEN (p_datos->>'coordinador')::boolean THEN 'coordinador' ELSE 'docente' END
              ELSE d.rol END,
     activo=CASE WHEN p_datos ? 'activo' THEN (p_datos->>'activo')::boolean ELSE d.activo END
   WHERE d.id_docente=v_id;
   SELECT to_jsonb(d) INTO v_despues FROM public.docentes d WHERE d.id_docente=v_id;
 WHEN 'carga_guardar' THEN
   IF NOT EXISTS(SELECT 1 FROM public.docentes d WHERE d.id_docente=v_id AND d.activo) THEN
     RAISE EXCEPTION 'Docente no disponible.' USING ERRCODE='22023';
   END IF;
   v_asignatura:=btrim(coalesce(p_datos->>'asignatura',''));
   v_sede:=btrim(coalesce(p_datos->>'sede',''));
   v_curso:=btrim(coalesce(p_datos->>'curso',''));
   v_grado:=nullif(p_datos->>'grado','')::integer;
   v_carga:=nullif(p_datos->>'carga_id','')::bigint;
   IF length(v_asignatura)<2 OR length(v_asignatura)>100 OR v_sede='' OR v_curso=''
      OR v_grado IS NULL OR v_grado NOT BETWEEN 1 AND 11 THEN
     RAISE EXCEPTION 'Completa asignatura, sede, grado y curso.' USING ERRCODE='22023';
   END IF;
   IF EXISTS(SELECT 1 FROM public.carga_docente c WHERE c.id_docente=v_id AND c.activo
       AND c.asignatura=v_asignatura AND c.sede=v_sede AND c.grado=v_grado AND c.curso=v_curso
       AND (v_carga IS NULL OR c.id<>v_carga)) THEN
     RAISE EXCEPTION 'Esta carga ya está asignada.' USING ERRCODE='23505';
   END IF;
   IF v_carga IS NULL THEN
     INSERT INTO public.carga_docente(id_docente,asignatura,sede,grado,curso,activo)
     VALUES(v_id,v_asignatura,v_sede,v_grado,v_curso,true) RETURNING id INTO v_carga;
   ELSE
     SELECT to_jsonb(c) INTO v_antes FROM public.carga_docente c
       WHERE c.id=v_carga AND c.id_docente=v_id FOR UPDATE;
     IF v_antes IS NULL THEN RAISE EXCEPTION 'Carga no encontrada.' USING ERRCODE='22023'; END IF;
     UPDATE public.carga_docente SET asignatura=v_asignatura,sede=v_sede,
       grado=v_grado,curso=v_curso,activo=true WHERE id=v_carga AND id_docente=v_id;
   END IF;
   SELECT to_jsonb(c) INTO v_despues FROM public.carga_docente c WHERE c.id=v_carga;
 WHEN 'carga_quitar' THEN
   v_carga:=nullif(p_datos->>'carga_id','')::bigint;
   SELECT to_jsonb(c) INTO v_antes FROM public.carga_docente c
   WHERE c.id=v_carga AND c.id_docente=v_id AND c.activo FOR UPDATE;
   IF v_antes IS NULL THEN RAISE EXCEPTION 'Carga no encontrada.' USING ERRCODE='22023'; END IF;
   UPDATE public.carga_docente SET activo=false WHERE id=v_carga AND id_docente=v_id;
   SELECT to_jsonb(c) INTO v_despues FROM public.carga_docente c WHERE c.id=v_carga;
 WHEN 'direccion' THEN
   SELECT to_jsonb(d) INTO v_antes FROM public.docentes d WHERE d.id_docente=v_id FOR UPDATE;
   IF v_antes IS NULL THEN RAISE EXCEPTION 'Docente inexistente.' USING ERRCODE='22023'; END IF;
   v_grado:=nullif(p_datos->>'grado','')::integer;
   v_sede:=btrim(coalesce(p_datos->>'sede',''));
   v_curso:=btrim(coalesce(p_datos->>'curso',''));
   IF v_grado IS NOT NULL AND (v_grado NOT BETWEEN 1 AND 11 OR v_sede='' OR v_curso='') THEN
     RAISE EXCEPTION 'Selecciona sede, grado y curso.' USING ERRCODE='22023';
   END IF;
   UPDATE public.docentes d SET direccion_grado=v_grado,
     direccion_sede=CASE WHEN v_grado IS NULL THEN NULL ELSE v_sede END,
     direccion_grupo=CASE WHEN v_grado IS NULL THEN NULL ELSE v_curso END
   WHERE d.id_docente=v_id;
   SELECT to_jsonb(d) INTO v_despues FROM public.docentes d WHERE d.id_docente=v_id;
 ELSE
   RAISE EXCEPTION 'Operación no permitida.' USING ERRCODE='22023';
 END CASE;
 INSERT INTO roque_private.auditoria_personal_docente_staff(actor_docente,operacion,id_docente,antes,despues)
 VALUES(p_docente,p_operacion,v_id,v_antes,v_despues);
 RETURN jsonb_build_object('ok',true,'id',v_id,'operacion',p_operacion);
END;
$function$;
REVOKE ALL ON FUNCTION public.roque_v15_staff_admin_personal_guardar(text,jsonb,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.roque_v15_staff_admin_personal_guardar(text,jsonb,text,text) TO anon,authenticated;

CREATE OR REPLACE FUNCTION public.roque_v15_staff_admin_personal_listar(p_docente text, p_sesion text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_docentes jsonb;
BEGIN
 IF NOT EXISTS(
 SELECT 1 FROM public.docentes d
 WHERE d.id_docente=p_docente AND d.activo AND d.rol='administrador'
) OR NOT roque_private.validar_coordinador_sesion(p_docente,p_sesion) THEN
 RAISE EXCEPTION 'Sesión administrativa inválida o vencida.' USING ERRCODE='42501';
END IF;
 SELECT coalesce(jsonb_agg(
   jsonb_build_object(
     'id',d.id_docente,'nombre',d.nombre,'coordinador',d.coordinador,'rol',d.rol,
     'sede',coalesce(nullif(d.sede,''),nullif(d.direccion_sede,''),(
       SELECT min(c.sede) FROM public.carga_docente c
       WHERE c.id_docente=d.id_docente AND c.activo AND nullif(c.sede,'') IS NOT NULL
     ),''),
     'activo',d.activo,
     'direccion',CASE WHEN d.direccion_grado IS NOT NULL THEN
       jsonb_build_object('sede',d.direccion_sede,'grado',d.direccion_grado,'curso',d.direccion_grupo)
       ELSE 'null'::jsonb END,
     'cargas',(
       SELECT coalesce(jsonb_agg(jsonb_build_object(
         'id',c.id,'asignatura',c.asignatura,'sede',c.sede,
         'grado',c.grado,'curso',c.curso
       ) ORDER BY c.asignatura,c.grado,c.curso),'[]'::jsonb)
       FROM public.carga_docente c WHERE c.id_docente=d.id_docente AND c.activo
     )
   ) ORDER BY d.nombre,d.id_docente
 ),'[]'::jsonb)
 INTO v_docentes FROM public.docentes d;
 RETURN jsonb_build_object('ok',true,'docentes',v_docentes,'mapeo_areas',coalesce(
   (SELECT jsonb_agg(jsonb_build_object('area',m.area,'asignatura',m.asignatura)
       ORDER BY m.area,m.asignatura) FROM public.mapeo_areas m WHERE m.activo),'[]'::jsonb));
END;
$function$;
REVOKE ALL ON FUNCTION public.roque_v15_staff_admin_personal_listar(text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.roque_v15_staff_admin_personal_listar(text,text) TO anon,authenticated;