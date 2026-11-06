-- RoqueObjetiva v175.65: Consulta estudiante segura (Admin / Coordinador).
-- Desplegada en Supabase en la migración roque_v175_65_consulta_estudiante_segura.
-- Nota: al ejecutar en un entorno nuevo, aplicar después de 33_coordinador_anulacion_v175_64.sql.
CREATE TABLE IF NOT EXISTS roque_private.auditoria_consulta_estudiante (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 edicion text NOT NULL REFERENCES roque_private.ediciones(codigo),
 origen text NOT NULL CHECK (origen IN ('inscripcion','institucional')),
 documento_anterior text NOT NULL,
 documento_nuevo text NOT NULL,
 antes jsonb NOT NULL,
 despues jsonb NOT NULL,
 actor_tipo text NOT NULL CHECK (actor_tipo IN ('admin','coordinador')),
 actor_id text NOT NULL,
 creado_en timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX IF NOT EXISTS auditoria_consulta_estudiante_edicion_fecha_idx
 ON roque_private.auditoria_consulta_estudiante(edicion,creado_en DESC);
ALTER TABLE roque_private.auditoria_consulta_estudiante ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON roque_private.auditoria_consulta_estudiante FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.roque_v13_estudiante_buscar(p_edicion text, p_busqueda text DEFAULT ''::text, p_grado integer DEFAULT NULL::integer, p_sede text DEFAULT ''::text, p_grupo text DEFAULT ''::text, p_docente text DEFAULT NULL::text, p_sesion text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
 v_admin boolean;v_coord boolean;v_privado boolean;
 v_items jsonb;v_filtros jsonb;v_needle text:=lower(btrim(coalesce(p_busqueda,'')));
BEGIN
 v_admin:=auth.uid() IS NOT NULL AND EXISTS(
  SELECT 1 FROM roque_private.operadores_admin a WHERE a.user_id=auth.uid() AND a.activo);
 v_coord:=NOT v_admin AND roque_private.validar_coordinador_sesion(p_docente,p_sesion);
 IF NOT (v_admin OR v_coord) THEN
   RAISE EXCEPTION 'Acceso denegado a consulta de estudiantes.' USING ERRCODE='42501';
 END IF;
 IF NOT EXISTS(SELECT 1 FROM roque_private.ediciones e WHERE e.codigo=p_edicion) THEN
   RAISE EXCEPTION 'Edición inexistente.' USING ERRCODE='22023';
 END IF;
 IF p_grado IS NOT NULL AND p_grado NOT BETWEEN 5 AND 11 THEN
   RAISE EXCEPTION 'Grado inválido.' USING ERRCODE='22023';
 END IF;
 v_privado:=EXISTS(SELECT 1 FROM roque_private.inscripciones i
                   WHERE i.edicion=p_edicion AND i.activo);
 WITH roster AS (
  SELECT i.id_alumno,i.id_prueba,i.apellidos,i.nombres,i.sede,i.grado::integer AS grado,
    i.grupo,'inscripcion'::text AS origen
  FROM roque_private.inscripciones i WHERE v_privado AND i.edicion=p_edicion AND i.activo
  UNION ALL
  SELECT e.id_alumno,e.id_prueba,e.apellidos,e.nombres,e.sede,e.grado,
    e.grupo,'institucional'::text
  FROM public.estudiantes e WHERE NOT v_privado AND e.activo
 )
 SELECT jsonb_build_object(
  'grados',coalesce((SELECT jsonb_agg(t.grado ORDER BY t.grado) FROM
       (SELECT DISTINCT grado FROM roster WHERE grado IS NOT NULL)t),'[]'::jsonb),
  'sedes',coalesce((SELECT jsonb_agg(t.sede ORDER BY t.sede) FROM
       (SELECT DISTINCT sede FROM roster WHERE nullif(btrim(sede),'') IS NOT NULL)t),'[]'::jsonb),
  'cursos',coalesce((SELECT jsonb_agg(jsonb_build_object('grado',t.grado,'sede',t.sede,'curso',t.grupo)
        ORDER BY t.grado,t.sede,t.grupo) FROM
       (SELECT DISTINCT grado,sede,grupo FROM roster WHERE nullif(btrim(grupo),'') IS NOT NULL)t),'[]'::jsonb)
 ) INTO v_filtros;
 IF length(v_needle)<2 THEN
  v_items:='[]'::jsonb;
 ELSE
  WITH roster AS (
   SELECT i.id_alumno,i.id_prueba,i.apellidos,i.nombres,i.sede,i.grado::integer AS grado,
     i.grupo,'inscripcion'::text AS origen
   FROM roque_private.inscripciones i WHERE v_privado AND i.edicion=p_edicion AND i.activo
   UNION ALL
   SELECT e.id_alumno,e.id_prueba,e.apellidos,e.nombres,e.sede,e.grado,
     e.grupo,'institucional'::text
   FROM public.estudiantes e WHERE NOT v_privado AND e.activo
  ), matches AS (
   SELECT r.* FROM roster r
   WHERE (p_grado IS NULL OR r.grado=p_grado)
    AND (nullif(btrim(p_sede),'') IS NULL OR lower(coalesce(r.sede,''))=lower(btrim(p_sede)))
    AND (nullif(btrim(p_grupo),'') IS NULL OR lower(coalesce(r.grupo,''))=lower(btrim(p_grupo)))
    AND (position(v_needle IN lower(coalesce(r.nombres,'')||' '||coalesce(r.apellidos,'')))>0
      OR position(v_needle IN lower(coalesce(r.apellidos,'')||' '||coalesce(r.nombres,'')))>0
      OR position(v_needle IN lower(coalesce(r.id_alumno,'')))>0
      OR position(v_needle IN lower(coalesce(r.id_prueba,'')))>0)
   ORDER BY r.apellidos,r.nombres,r.grado,r.grupo LIMIT 12
  )
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id_alumno',m.id_alumno,'id_prueba',m.id_prueba,'apellidos',m.apellidos,
    'nombres',m.nombres,'sede',m.sede,'grado',m.grado,'grupo',m.grupo,'origen',m.origen)
     ORDER BY m.apellidos,m.nombres),'[]'::jsonb)
  INTO v_items FROM matches m;
 END IF;
 RETURN jsonb_build_object('ok',true,'edicion',p_edicion,
    'origen',CASE WHEN v_privado THEN 'inscripcion' ELSE 'institucional' END,
    'filtros',v_filtros,'estudiantes',v_items);
END;
$function$;
REVOKE ALL ON FUNCTION public.roque_v13_estudiante_buscar(text,text,integer,text,text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.roque_v13_estudiante_buscar(text,text,integer,text,text,text,text) TO anon,authenticated;

CREATE OR REPLACE FUNCTION public.roque_v13_estudiante_detalle(p_edicion text, p_id_alumno text, p_docente text DEFAULT NULL::text, p_sesion text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
 v_admin boolean;v_coord boolean;v_privado boolean;
 v_e roque_private.inscripciones%ROWTYPE;
 v_p public.estudiantes%ROWTYPE;
 v_row jsonb;v_respuestas jsonb;v_claves jsonb;
 v_rank jsonb:='{}'::jsonb;v_estado text;v_visibles boolean;
BEGIN
 v_admin:=auth.uid() IS NOT NULL AND EXISTS(
  SELECT 1 FROM roque_private.operadores_admin a WHERE a.user_id=auth.uid() AND a.activo);
 v_coord:=NOT v_admin AND roque_private.validar_coordinador_sesion(p_docente,p_sesion);
 IF NOT (v_admin OR v_coord) THEN
  RAISE EXCEPTION 'Acceso denegado al detalle del estudiante.' USING ERRCODE='42501';
 END IF;
 SELECT e.estado,e.resultados_visibles INTO v_estado,v_visibles FROM roque_private.ediciones e
 WHERE e.codigo=p_edicion;
 IF NOT FOUND THEN RAISE EXCEPTION 'Edición inexistente.' USING ERRCODE='22023'; END IF;
 v_privado:=EXISTS(SELECT 1 FROM roque_private.inscripciones i WHERE i.edicion=p_edicion AND i.activo);
 IF v_privado THEN
  SELECT * INTO v_e FROM roque_private.inscripciones i
   WHERE i.edicion=p_edicion AND i.id_alumno=p_id_alumno AND i.activo;
  IF NOT FOUND THEN RAISE EXCEPTION 'Estudiante no encontrado en la edición.' USING ERRCODE='22023'; END IF;
  v_row:=jsonb_build_object('id_alumno',v_e.id_alumno,'id_prueba',v_e.id_prueba,
   'nombres',coalesce(v_e.nombres,''),'apellidos',coalesce(v_e.apellidos,''),
   'sede',coalesce(v_e.sede,''),'grado',v_e.grado,'grupo',coalesce(v_e.grupo,''),
   'origen','inscripcion');
 ELSE
  SELECT * INTO v_p FROM public.estudiantes e WHERE e.id_alumno=p_id_alumno AND e.activo;
  IF NOT FOUND THEN RAISE EXCEPTION 'Estudiante no encontrado en el registro institucional.' USING ERRCODE='22023'; END IF;
  v_row:=jsonb_build_object('id_alumno',v_p.id_alumno,'id_prueba',v_p.id_prueba,
   'nombres',coalesce(v_p.nombres,''),'apellidos',coalesce(v_p.apellidos,''),
   'sede',coalesce(v_p.sede,''),'grado',v_p.grado,'grupo',coalesce(v_p.grupo,''),
   'origen','institucional');
 END IF;
 SELECT r.respuestas INTO v_respuestas FROM roque_private.resultados r
 WHERE r.edicion=p_edicion AND r.id_prueba=v_row->>'id_prueba' AND r.activo;
 IF v_respuestas IS NOT NULL THEN
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'numero_item',i.numero_item,'area',i.area,'correcta',i.respuesta_correcta,
    'componente',i.componente,'competencia',i.competencia,'sesion',i.sesion)
     ORDER BY i.numero_item),'[]'::jsonb) INTO v_claves
  FROM roque_private.items i WHERE i.edicion=p_edicion AND i.grado=(v_row->>'grado')::integer
   AND i.activo AND NOT i.anulada AND i.respuesta_correcta ~ '^[A-H]$';
  IF v_visibles AND v_estado IN ('cerrada','publicada') AND v_privado THEN
   SELECT roque_private.ranking_calculo_por_edicion(v_row->>'id_prueba',p_edicion)
      ->'ranking' INTO v_rank;
  END IF;
 ELSE
  v_claves:='[]'::jsonb;
 END IF;
 RETURN jsonb_build_object('ok',true,'edicion',p_edicion,'estudiante',v_row,
   'tiene_resultados',v_respuestas IS NOT NULL,'respuestas',v_respuestas,
   'claves',coalesce(v_claves,'[]'::jsonb),'ranking',coalesce(v_rank,'{}'::jsonb));
END;
$function$;
REVOKE ALL ON FUNCTION public.roque_v13_estudiante_detalle(text,text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.roque_v13_estudiante_detalle(text,text,text,text) TO anon,authenticated;

CREATE OR REPLACE FUNCTION public.roque_v13_estudiante_guardar(p_edicion text, p_id_alumno text, p_antes jsonb, p_nuevo jsonb, p_docente text DEFAULT NULL::text, p_sesion text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
 v_admin boolean;v_coord boolean;v_privado boolean;
 v_e roque_private.inscripciones%ROWTYPE;v_p public.estudiantes%ROWTYPE;
 v_before jsonb;v_after jsonb;v_actor text;v_tipo text;
 v_doc text;v_prueba text;v_nombres text;v_apellidos text;v_sede text;v_grupo text;
 v_grado integer;v_origen text;v_rows integer;
BEGIN
 v_admin:=auth.uid() IS NOT NULL AND EXISTS(
  SELECT 1 FROM roque_private.operadores_admin a WHERE a.user_id=auth.uid() AND a.activo);
 v_coord:=NOT v_admin AND roque_private.validar_coordinador_sesion(p_docente,p_sesion);
 IF NOT (v_admin OR v_coord) THEN
  RAISE EXCEPTION 'Solo Administración o un coordinador activo pueden editar estudiantes.' USING ERRCODE='42501';
 END IF;
 IF jsonb_typeof(p_antes) IS DISTINCT FROM 'object'
  OR jsonb_typeof(p_nuevo) IS DISTINCT FROM 'object' THEN
  RAISE EXCEPTION 'Ficha inválida.' USING ERRCODE='22023';
 END IF;
 IF NOT EXISTS(SELECT 1 FROM roque_private.ediciones e WHERE e.codigo=p_edicion) THEN
  RAISE EXCEPTION 'Edición inexistente.' USING ERRCODE='22023';
 END IF;
 v_doc:=btrim(coalesce(p_nuevo->>'id_alumno',''));
 v_prueba:=btrim(coalesce(p_nuevo->>'id_prueba',''));
 v_nombres:=btrim(coalesce(p_nuevo->>'nombres',''));
 v_apellidos:=btrim(coalesce(p_nuevo->>'apellidos',''));
 v_sede:=btrim(coalesce(p_nuevo->>'sede',''));
 v_grupo:=btrim(coalesce(p_nuevo->>'grupo',''));
 IF coalesce(p_nuevo->>'grado','') !~ '^[0-9]{1,2}$' THEN
  RAISE EXCEPTION 'El grado es inválido.' USING ERRCODE='22023';
 END IF;
 v_grado:=(p_nuevo->>'grado')::integer;
 IF length(v_doc) NOT BETWEEN 2 AND 40 OR length(v_prueba) NOT BETWEEN 1 AND 40
    OR length(v_nombres) NOT BETWEEN 1 AND 120 OR length(v_apellidos) NOT BETWEEN 1 AND 120
    OR length(v_sede)>120 OR length(v_grupo)>35 OR v_grado NOT BETWEEN 5 AND 11 THEN
  RAISE EXCEPTION 'Completa los campos obligatorios y revisa las longitudes.' USING ERRCODE='22023';
 END IF;
 -- Se bloquea la edición de claves desconocidas, incluyendo flags de acceso.
 IF EXISTS (SELECT 1 FROM jsonb_object_keys(p_nuevo) k
   WHERE k NOT IN ('id_alumno','id_prueba','nombres','apellidos','sede','grado','grupo','origen')) THEN
  RAISE EXCEPTION 'Campos de actualización no permitidos.' USING ERRCODE='22023';
 END IF;
 v_privado:=EXISTS(SELECT 1 FROM roque_private.inscripciones i WHERE i.edicion=p_edicion AND i.activo);
 IF v_privado THEN
  SELECT * INTO v_e FROM roque_private.inscripciones i
    WHERE i.edicion=p_edicion AND i.id_alumno=p_id_alumno AND i.activo FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Estudiante no encontrado en la edición.' USING ERRCODE='22023'; END IF;
  v_before:=jsonb_build_object('id_alumno',v_e.id_alumno,'id_prueba',v_e.id_prueba,
    'nombres',coalesce(v_e.nombres,''),'apellidos',coalesce(v_e.apellidos,''),
    'sede',coalesce(v_e.sede,''),'grado',v_e.grado,'grupo',coalesce(v_e.grupo,''),
    'origen','inscripcion');
  v_origen:='inscripcion';
 ELSE
  SELECT * INTO v_p FROM public.estudiantes e
   WHERE e.id_alumno=p_id_alumno AND e.activo FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Estudiante no encontrado en el registro institucional.' USING ERRCODE='22023'; END IF;
  v_before:=jsonb_build_object('id_alumno',v_p.id_alumno,'id_prueba',v_p.id_prueba,
    'nombres',coalesce(v_p.nombres,''),'apellidos',coalesce(v_p.apellidos,''),
    'sede',coalesce(v_p.sede,''),'grado',v_p.grado,'grupo',coalesce(v_p.grupo,''),
    'origen','institucional');
  v_origen:='institucional';
 END IF;
 IF v_before IS DISTINCT FROM p_antes THEN
  RAISE EXCEPTION 'Los datos del estudiante cambiaron en otra sesión. Vuelve a consultarlo.' USING ERRCODE='40001';
 END IF;
 IF v_privado THEN
  IF EXISTS (SELECT 1 FROM roque_private.inscripciones i
      WHERE i.edicion=p_edicion AND i.activo AND i.id_alumno=v_doc AND i.id_alumno<>v_e.id_alumno)
     OR EXISTS (SELECT 1 FROM roque_private.inscripciones i
      WHERE i.edicion=p_edicion AND i.activo AND i.id_prueba=v_prueba AND i.id_prueba<>v_e.id_prueba) THEN
   RAISE EXCEPTION 'El documento o ID de prueba ya pertenece a otro estudiante.' USING ERRCODE='23505';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM roque_private.grados g WHERE g.edicion=p_edicion AND g.grado=v_grado) THEN
   RAISE EXCEPTION 'El grado solicitado no existe en la edición.' USING ERRCODE='22023';
  END IF;
  -- 1S posee una copia operativa en public: exigir paridad antes de tocarla.
  IF p_edicion='2026-1S' THEN
   SELECT * INTO v_p FROM public.estudiantes e
    WHERE e.id_alumno=v_e.id_alumno AND e.id_prueba=v_e.id_prueba FOR UPDATE;
   IF FOUND THEN
    IF v_p.grado IS DISTINCT FROM v_e.grado OR
      coalesce(v_p.sede,'') IS DISTINCT FROM coalesce(v_e.sede,'') OR
      coalesce(v_p.grupo,'') IS DISTINCT FROM coalesce(v_e.grupo,'') THEN
      RAISE EXCEPTION 'Las copias del registro histórico no coinciden; se canceló el cambio.' USING ERRCODE='40001';
    END IF;
    UPDATE public.estudiantes SET id_alumno=v_doc,id_prueba=v_prueba,
     nombres=v_nombres,apellidos=v_apellidos,sede=v_sede,grado=v_grado,grupo=v_grupo
    WHERE id_alumno=v_e.id_alumno;
   END IF;
   IF v_prueba<>v_e.id_prueba THEN
    UPDATE public.resultados SET id_prueba=v_prueba WHERE id_prueba=v_e.id_prueba;
   END IF;
  END IF;
  IF v_prueba<>v_e.id_prueba THEN
   UPDATE roque_private.resultados SET id_prueba=v_prueba
    WHERE edicion=p_edicion AND id_prueba=v_e.id_prueba;
  END IF;
  UPDATE roque_private.inscripciones
   SET id_alumno=v_doc,id_prueba=v_prueba,nombres=v_nombres,apellidos=v_apellidos,
      sede=v_sede,grado=v_grado,grupo=v_grupo
   WHERE edicion=p_edicion AND id_alumno=v_e.id_alumno;
 ELSE
  IF EXISTS(SELECT 1 FROM public.estudiantes e
    WHERE e.id_alumno=v_doc AND e.id_alumno<>v_p.id_alumno)
    OR EXISTS(SELECT 1 FROM public.estudiantes e
    WHERE e.id_prueba=v_prueba AND e.id_prueba<>v_p.id_prueba) THEN
    RAISE EXCEPTION 'El documento o ID de prueba ya pertenece a otro estudiante.' USING ERRCODE='23505';
  END IF;
  UPDATE public.estudiantes SET id_alumno=v_doc,id_prueba=v_prueba,
     nombres=v_nombres,apellidos=v_apellidos,sede=v_sede,grado=v_grado,grupo=v_grupo
   WHERE id_alumno=v_p.id_alumno;
  IF v_prueba<>v_p.id_prueba THEN
    UPDATE public.resultados SET id_prueba=v_prueba WHERE id_prueba=v_p.id_prueba;
  END IF;
 END IF;
 v_after:=jsonb_build_object('id_alumno',v_doc,'id_prueba',v_prueba,
  'nombres',v_nombres,'apellidos',v_apellidos,'sede',v_sede,'grado',v_grado,'grupo',v_grupo,
  'origen',v_origen);
 v_actor:=CASE WHEN v_admin THEN auth.uid()::text ELSE p_docente END;
 v_tipo:=CASE WHEN v_admin THEN 'admin' ELSE 'coordinador' END;
 IF v_after=v_before THEN
  RETURN jsonb_build_object('ok',true,'sin_cambio',true,'estudiante',v_after);
 END IF;
 INSERT INTO roque_private.auditoria_consulta_estudiante
  (edicion,origen,documento_anterior,documento_nuevo,antes,despues,actor_tipo,actor_id)
 VALUES(p_edicion,v_origen,p_id_alumno,v_doc,v_before,v_after,v_tipo,v_actor);
 RETURN jsonb_build_object('ok',true,'estudiante',v_after,'guardado',true);
END;
$function$;
REVOKE ALL ON FUNCTION public.roque_v13_estudiante_guardar(text,text,jsonb,jsonb,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.roque_v13_estudiante_guardar(text,text,jsonb,jsonb,text,text) TO anon,authenticated;

