-- RoqueObjetiva v175.45, ya aplicada en Supabase.
CREATE OR REPLACE FUNCTION public.roque_v6_docente_datos_edicion(p_user text, p_edicion text, p_terminal uuid DEFAULT NULL::uuid, p_device text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
 v_teacher public.docentes%ROWTYPE;
 v_ed roque_private.ediciones%ROWTYPE;
 v_payload jsonb;
 v_datasets jsonb;
 v_ins jsonb := '[]'::jsonb;
 v_keys jsonb := '[]'::jsonb;
 v_results jsonb := '[]'::jsonb;
 v_grades integer[] := ARRAY[]::integer[];
 v_result_count integer := 0;
BEGIN
 IF p_user IS NULL OR p_edicion IS NULL THEN
   RETURN pg_catalog.jsonb_build_object('ok',false,'error','Datos insuficientes.');
 END IF;
 SELECT * INTO v_teacher FROM public.docentes
 WHERE id_docente=pg_catalog.btrim(p_user) AND activo IS TRUE;
 IF NOT FOUND THEN
   RETURN pg_catalog.jsonb_build_object('ok',false,'error','Docente no autorizado.');
 END IF;
 SELECT * INTO v_ed FROM roque_private.ediciones
 WHERE codigo=pg_catalog.btrim(p_edicion);
 IF NOT FOUND THEN
   RETURN pg_catalog.jsonb_build_object('ok',false,'error','Edición inexistente.');
 END IF;
 -- Regla de publicación. Nunca revelar notas, respuestas o claves de borradores.
 IF v_ed.resultados_visibles IS DISTINCT FROM TRUE
    OR v_ed.estado NOT IN ('publicada','cerrada') THEN
   RETURN pg_catalog.jsonb_build_object('ok',false,'pendiente',true,
     'edicion',v_ed.codigo,
     'error','Esta prueba aún no tiene resultados publicados.');
 END IF;
 -- Valida al docente usando el MISMO login controlado del portal.
 v_payload := public.roque_v4_login_controlado_private(
    p_user,'',p_terminal,p_device,'docente_cambio_edicion');
 IF coalesce((v_payload->>'ok')::boolean,false) IS NOT TRUE
    OR v_payload->'session'->>'role' IS DISTINCT FROM 'teacher'
    OR v_payload->'session'->>'id' IS DISTINCT FROM v_teacher.id_docente THEN
   RETURN pg_catalog.jsonb_build_object('ok',false,'error','Acceso docente no autorizado.');
 END IF;
 IF v_ed.codigo='2026-1S' THEN
   RETURN v_payload || pg_catalog.jsonb_build_object('edicion',v_ed.codigo);
 END IF;
 v_datasets := coalesce(v_payload->'datasets','{}'::jsonb);
 -- Selecciona solo inscripciones dentro de la carga o dirección de este docente.
 -- Coordinadores conservan el alcance previsto por el acceso actual.
 SELECT coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
  'ID_ALUMNO',i.id_alumno,'ID_PRUEBA',i.id_prueba,
  'APELLIDOS',coalesce(i.apellidos,''),
  'NOMBRES',coalesce(i.nombres,''),
  'NOMBRE_COMPLETO',pg_catalog.btrim(coalesce(i.nombres,'')||' '||coalesce(i.apellidos,'')),
  'SEDE',coalesce(i.sede,''),
  'GRADO',i.grado::text,'GRUPO',coalesce(i.grupo,'')
 ) ORDER BY i.grado,i.sede,i.grupo,i.apellidos,i.nombres),'[]'::jsonb)
 INTO v_ins
 FROM roque_private.inscripciones i
 WHERE i.edicion=v_ed.codigo AND i.activo IS TRUE AND (
   v_teacher.coordinador IS TRUE OR EXISTS(
     SELECT 1 FROM public.carga_docente c
     WHERE c.activo IS TRUE AND c.id_docente=v_teacher.id_docente
       AND c.grado=i.grado AND c.curso=i.grupo
       AND pg_catalog.lower(coalesce(c.sede,''))=pg_catalog.lower(coalesce(i.sede,''))
   ) OR (
     v_teacher.direccion_grado=i.grado AND v_teacher.direccion_grupo=i.grupo
     AND pg_catalog.lower(coalesce(v_teacher.direccion_sede,''))=pg_catalog.lower(coalesce(i.sede,''))
   )
 );
 SELECT coalesce(pg_catalog.array_agg(DISTINCT (j.x->>'GRADO')::integer),ARRAY[]::integer[])
 INTO v_grades FROM pg_catalog.jsonb_array_elements(v_ins) AS j(x);
 SELECT coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
  'grade',t.grado,'path','SUPABASE/'||v_ed.codigo||'/KEYS_'||t.grado||'.json','rows',t.filas
 ) ORDER BY t.grado),'[]'::jsonb) INTO v_keys
 FROM (
   SELECT k.grado,pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
     'Grado',k.grado::text,'Área',k.area,'Número de ítem',k.numero_item::text,
     'Respuesta sugerida',k.respuesta_correcta,
     'Componente / pensamiento / entorno / factor / enfoque',coalesce(k.componente,''),
     'Competencia',coalesce(k.competencia,'')
   ) ORDER BY k.numero_item) AS filas
   FROM roque_private.items k
   WHERE k.edicion=v_ed.codigo AND k.activo IS TRUE
     AND k.respuesta_correcta IS NOT NULL AND pg_catalog.btrim(k.respuesta_correcta)<>''
     AND k.grado=ANY(v_grades)
   GROUP BY k.grado
 ) AS t;
 SELECT pg_catalog.count(*) INTO v_result_count
 FROM roque_private.resultados r
 WHERE r.edicion=v_ed.codigo AND r.activo IS TRUE
   AND EXISTS (SELECT 1 FROM pg_catalog.jsonb_array_elements(v_ins) j(x)
               WHERE j.x->>'ID_PRUEBA'=r.id_prueba);
 IF v_result_count=0 THEN
   RETURN pg_catalog.jsonb_build_object('ok',false,'sin_resultados',true,
     'edicion',v_ed.codigo,'error','Aún no hay resultados disponibles para tus cursos en esta prueba.');
 END IF;
 SELECT coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
  'grade',g.grado,'session',0,'startItem',1,
  'path','SUPABASE/'||v_ed.codigo||'/RESULTADOS_'||g.grado||'.json',
  'rows',g.filas
 ) ORDER BY g.grado),'[]'::jsonb) INTO v_results
 FROM (
   SELECT i.grado,pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object('Roll No',r.id_prueba,'respuestas',r.respuestas)
      ORDER BY r.id_prueba) filas
   FROM roque_private.resultados r JOIN roque_private.inscripciones i
     ON i.edicion=r.edicion AND i.id_prueba=r.id_prueba
   WHERE r.edicion=v_ed.codigo AND r.activo IS TRUE AND i.activo IS TRUE
     AND EXISTS (SELECT 1 FROM pg_catalog.jsonb_array_elements(v_ins) j(x)
                 WHERE j.x->>'ID_PRUEBA'=r.id_prueba)
   GROUP BY i.grado
 ) g;
 RETURN pg_catalog.jsonb_set(v_payload,'{datasets}',v_datasets ||
      pg_catalog.jsonb_build_object('estudiantes',v_ins,'keys',v_keys,'resultados',v_results),true)
    || pg_catalog.jsonb_build_object('edicion',v_ed.codigo,
       'origen_academico','roque_private','resultados_revisados',v_result_count);
END
$function$

REVOKE ALL ON FUNCTION public.roque_v6_docente_datos_edicion(text,text,uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.roque_v6_docente_datos_edicion(text,text,uuid,text) TO anon, authenticated;
