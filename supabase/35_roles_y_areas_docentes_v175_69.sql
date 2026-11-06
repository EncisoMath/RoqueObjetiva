-- v175.69 · Actualización de rol institucional y agrupación área/asignatura.
-- Aplicar después de las migraciones anteriores. Backfill no cambia permisos
-- administrativos: Auth + operadores_admin continúa siendo obligatorio.
ALTER TABLE public.docentes ADD COLUMN IF NOT EXISTS rol text;
UPDATE public.docentes SET rol=CASE WHEN coordinador THEN 'coordinador' ELSE 'docente' END
 WHERE rol IS NULL OR rol NOT IN ('administrador','coordinador','docente');
ALTER TABLE public.docentes ALTER COLUMN rol SET DEFAULT 'docente';
ALTER TABLE public.docentes ALTER COLUMN rol SET NOT NULL;
ALTER TABLE public.docentes DROP CONSTRAINT IF EXISTS docentes_rol_institucional_check;
ALTER TABLE public.docentes ADD CONSTRAINT docentes_rol_institucional_check
 CHECK (rol IN ('administrador','coordinador','docente'));

CREATE OR REPLACE FUNCTION public.roque_v9_admin_personal_guardar(p_operacion text, p_datos jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
 v_id text; v_nombre text; v_sede text; v_asignatura text; v_curso text;
 v_grado integer; v_carga bigint; v_antes jsonb; v_despues jsonb; v_rol text;
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS (
   SELECT 1 FROM roque_private.operadores_admin o
   WHERE o.user_id=auth.uid() AND o.activo IS TRUE
 ) THEN
   RAISE EXCEPTION 'Acceso administrativo no autorizado.' USING ERRCODE='42501';
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
 INSERT INTO roque_private.auditoria_personal_docente(admin_user,operacion,id_docente,antes,despues)
 VALUES(auth.uid(),p_operacion,v_id,v_antes,v_despues);
 RETURN jsonb_build_object('ok',true,'id',v_id,'operacion',p_operacion);
END;
$function$;

CREATE OR REPLACE FUNCTION public.roque_v9_admin_personal_listar()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_docentes jsonb;
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS (
   SELECT 1 FROM roque_private.operadores_admin o
   WHERE o.user_id=auth.uid() AND o.activo IS TRUE
 ) THEN
   RAISE EXCEPTION 'Acceso administrativo no autorizado.' USING ERRCODE='42501';
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
