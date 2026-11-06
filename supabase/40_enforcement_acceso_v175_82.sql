-- v175.82 · Guardias y respuestas filtradas, sin sobrescribir originales.
CREATE OR REPLACE FUNCTION roque_private.mascara_payload_docente_legacy(p_payload jsonb, p_edicion text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_groups jsonb:='[]'::jsonb;v_group jsonb;v_rows jsonb;v_row jsonb;
 v_grade integer;v_session integer;v_start integer;v_roll text;v_item record;v_canon text;
 v_new jsonb;v_reg roque_private.inscripciones%rowtype;v_medidas jsonb;
begin
 if p_payload->'session'->>'role' not in ('student','teacher') then return p_payload; end if;
 for v_group in select value from jsonb_array_elements(coalesce(p_payload->'datasets'->'resultados','[]'::jsonb))
 loop
  v_grade:=coalesce(nullif(v_group->>'grade','')::integer,0);
  v_session:=coalesce(nullif(v_group->>'session','')::integer,1);
  v_start:=coalesce(nullif(v_group->>'startItem','')::integer,case when v_session=2 then 71 else 1 end);
  v_rows:='[]'::jsonb;
  for v_row in select value from jsonb_array_elements(coalesce(v_group->'rows','[]'::jsonb))
  loop
   v_new:=v_row;
   v_roll:=v_row->>'Roll No';
   select * into v_reg from roque_private.inscripciones i where i.edicion=p_edicion and i.id_prueba=v_roll;
   if found and exists(select 1 from roque_private.medidas_estudiante m
     where m.edicion=p_edicion and m.id_prueba=v_roll and m.activo) then
     if roque_private.examen_restringido(p_edicion,v_roll) then
       for v_item in select key from jsonb_object_keys(v_row) as key
         where key ~ '^Q [0-9]+ Options$' loop
         v_new:=v_new-v_item.key;
       end loop;
     else
       for v_item in select key from jsonb_object_keys(v_row) as key
         where key ~ '^Q [0-9]+ Options$' loop
         if exists(select 1 from roque_private.items it where it.edicion=p_edicion and it.grado=v_grade
           and it.numero_item=v_start+(substring(v_item.key from 'Q ([0-9]+) Options'))::integer-1
           and roque_private.estado_area_medida(p_edicion,v_roll,it.area,v_grade)='anulado')
         then v_new:=v_new-v_item.key; end if;
       end loop;
     end if;
   end if;
   v_rows:=v_rows||jsonb_build_array(v_new);
  end loop;
  v_groups:=v_groups||jsonb_build_array(jsonb_set(v_group,'{rows}',v_rows));
 end loop;
 select coalesce(jsonb_agg(roque_private.resumen_medidas(p_edicion,e.x->>'ID_PRUEBA',
    coalesce(nullif(e.x->>'GRADO','')::integer,0))),'[]'::jsonb) into v_medidas
 from jsonb_array_elements(coalesce(p_payload->'datasets'->'estudiantes','[]'::jsonb)) e(x);
 return jsonb_set(jsonb_set(p_payload,'{datasets,resultados}',v_groups,true),
 '{datasets,medidas}',coalesce(v_medidas,'[]'::jsonb),true);
end;
$function$;

CREATE OR REPLACE FUNCTION public.roque_login(p_user text, p_password text DEFAULT ''::text, p_device text DEFAULT NULL::text, p_mode text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_user text := lower(trim(coalesce(p_user, '')));
  v_password text := coalesce(p_password, '');
  v_role text := '';
  v_session jsonb := '{}'::jsonb;
  v_teacher public.docentes%rowtype;
  v_student public.estudiantes%rowtype;
  v_is_coord boolean := false;
  v_exam_ids text[] := array[]::text[];
  v_grades int[] := array[]::int[];
  v_teacher_id text := null;
  v_student_exam text := null;
begin
  if v_user <> 'admin'
     and not exists(select 1 from public.docentes d where d.activo and lower(d.id_docente)=v_user)
     and roque_private.examen_restringido_login(v_user) then
   return jsonb_build_object('ok',false,'restringido',true,
    'error','Examen restringido. No tienes acceso a tus resultados.');
  end if;
  if v_user = '' then
    perform public.roque_log_access('', null, 'desconocido', 'login', false, p_device, p_mode);
    return jsonb_build_object('ok', false, 'error', 'Ingresa un usuario o ID.');
  end if;

  if v_user = 'admin' then
    if auth.uid() IS NULL OR NOT EXISTS (
      SELECT 1 FROM roque_private.operadores_admin oa
      WHERE oa.user_id = auth.uid() AND oa.activo IS TRUE
    ) then
      perform public.roque_log_access(v_user, null, 'admin', 'login', false, p_device, p_mode);
      return jsonb_build_object('ok', false, 'error', 'Contraseña de administrador incorrecta.');
    end if;
    v_role := 'admin';
    v_session := jsonb_build_object('role', 'admin', 'id', 'admin');
    v_is_coord := true;
    perform public.roque_log_access(v_user, null, 'admin', 'login', true, p_device, p_mode);
  else
    select * into v_teacher
    from public.docentes
    where activo = true and lower(id_docente) = v_user
    limit 1;

    if found then
      v_role := 'teacher';
      v_teacher_id := v_teacher.id_docente;
      v_session := jsonb_build_object('role', 'teacher', 'id', v_teacher.id_docente);
      v_is_coord := coalesce(v_teacher.coordinador, false);

      if not v_is_coord then
        with teacher_scope as (
          select lower(coalesce(sede,'')) as sede_key, grado, curso as grupo
          from public.carga_docente
          where activo = true and id_docente = v_teacher.id_docente
          union
          select lower(coalesce(v_teacher.direccion_sede,'')) as sede_key, v_teacher.direccion_grado as grado, v_teacher.direccion_grupo as grupo
          where v_teacher.direccion_sede is not null and v_teacher.direccion_grado is not null and v_teacher.direccion_grupo is not null
        ), allowed_students as (
          select distinct e.id_prueba, e.grado
          from public.estudiantes e
          where e.activo = true and exists (
            select 1 from teacher_scope t
            where t.grado = e.grado
              and t.grupo = e.grupo
              and t.sede_key = lower(coalesce(e.sede,''))
          )
        )
        select
          coalesce(array_agg(distinct id_prueba) filter (where id_prueba is not null), array[]::text[]),
          coalesce(array_agg(distinct grado) filter (where grado is not null), array[]::int[])
        into v_exam_ids, v_grades
        from allowed_students;
      end if;
      perform public.roque_log_access(v_user, null, 'teacher', 'login', true, p_device, p_mode);
    else
      select * into v_student
      from public.estudiantes
      where activo = true and (lower(id_alumno) = v_user or lower(id_prueba) = v_user)
      limit 1;

      if found then
        v_role := 'student';
        v_student_exam := v_student.id_prueba;
        v_exam_ids := array[v_student.id_prueba];
        v_grades := array[v_student.grado];
        v_session := jsonb_build_object('role', 'student', 'roll', v_student.id_prueba);
        perform public.roque_log_access(v_user, v_student.id_prueba, 'student', 'login', true, p_device, p_mode);
      else
        perform public.roque_log_access(v_user, null, 'desconocido', 'login', false, p_device, p_mode);
        return jsonb_build_object('ok', false, 'error', 'No encontré ese usuario o ID de examen.');
      end if;
    end if;
  end if;

  -- En fechas bloqueadas el alumno obtiene sesión y datos identificativos,
  -- NUNCA claves, respuestas, notas ni rankings históricos.
  IF v_role='student' AND roque_private.historial_bloqueado('2026-1S') THEN
    RETURN jsonb_build_object('ok',true,'role','student','session',v_session,
      'historial_bloqueado',true,
      'datasets',jsonb_build_object(
        'estudiantes',jsonb_build_array(jsonb_build_object(
          'ID_ALUMNO',v_student.id_alumno,'ID_PRUEBA',v_student.id_prueba,
          'APELLIDOS',coalesce(v_student.apellidos,''),
          'NOMBRES',coalesce(v_student.nombres,''),
          'NOMBRE_COMPLETO',trim(coalesce(v_student.nombres,'')||' '||coalesce(v_student.apellidos,'')),
          'SEDE',coalesce(v_student.sede,''),'GRADO',v_student.grado::text,
          'GRUPO',coalesce(v_student.grupo,''))),
        'keys','[]'::jsonb,'resultados','[]'::jsonb,
        'carga','[]'::jsonb,'directoresGrupo','[]'::jsonb
      ));
  END IF;

  return roque_private.mascara_payload_docente_legacy(jsonb_build_object(
    'ok', true,
    'role', v_role,
    'session', v_session,
    'datasets', jsonb_build_object(
      'estudiantes', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'ID_ALUMNO', e.id_alumno,
          'ID_PRUEBA', e.id_prueba,
          'APELLIDOS', coalesce(e.apellidos, ''),
          'NOMBRES', coalesce(e.nombres, ''),
          'NOMBRE_COMPLETO', trim(coalesce(e.nombres,'') || ' ' || coalesce(e.apellidos,'')),
          'SEDE', coalesce(e.sede, ''),
          'GRADO', coalesce(e.grado::text, ''),
          'GRUPO', coalesce(e.grupo, '')
        ) order by e.grado, e.sede, e.grupo, e.apellidos, e.nombres), '[]'::jsonb)
        from public.estudiantes e
        where e.activo = true and (
          v_role = 'admin'
          or v_is_coord
          or (v_role = 'student' and e.id_prueba = v_student_exam)
          or (v_role = 'teacher' and e.id_prueba = any(coalesce(v_exam_ids, array[]::text[])))
        )
      ),
      'carga', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'ID', c.id_docente,
          'NOMBRE', coalesce(d.nombre, c.id_docente),
          'ASIGNATURA', c.asignatura,
          'SEDE', coalesce(c.sede, ''),
          'GRADO', coalesce(c.grado::text, ''),
          'CURSO', coalesce(c.curso, ''),
          'COORDINADOR', case when coalesce(d.coordinador,false) then 'SI' else 'NO' end
        ) order by c.grado, c.sede, c.curso, c.asignatura, d.nombre), '[]'::jsonb)
        from public.carga_docente c
        left join public.docentes d on d.id_docente = c.id_docente
        where c.activo = true and (
          v_role = 'admin'
          or v_is_coord
          or (v_role = 'teacher' and c.id_docente = v_teacher_id)
        )
      ),
      'directoresGrupo', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'Identificación', d.id_docente,
          'Sede', coalesce(d.direccion_sede, ''),
          'Grado', coalesce(d.direccion_grado::text, ''),
          'Grupo', coalesce(d.direccion_grupo, '')
        ) order by d.direccion_grado, d.direccion_sede, d.direccion_grupo), '[]'::jsonb)
        from public.docentes d
        where d.activo = true
          and d.direccion_sede is not null
          and d.direccion_grado is not null
          and d.direccion_grupo is not null
          and (
            v_role = 'admin'
            or v_is_coord
            or (v_role = 'teacher' and d.id_docente = v_teacher_id)
          )
      ),
      'keys', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'grade', k.grado,
          'path', 'SUPABASE/KEYS_' || k.grado || '.json',
          'rows', k.rows
        ) order by k.grado), '[]'::jsonb)
        from (
          select grado, jsonb_agg(jsonb_build_object(
            'Grado', grado::text,
            'Área', area,
            'Número de ítem', numero_item::text,
            'Respuesta sugerida', respuesta_sugerida,
            'Componente / pensamiento / entorno / factor / enfoque', coalesce(componente, ''),
            'Competencia', coalesce(competencia, '')
          ) order by numero_item) as rows
          from public.claves
          where activo = true and (
            v_role = 'admin'
            or v_is_coord
            or grado = any(coalesce(v_grades, array[]::int[]))
          )
          group by grado
        ) k
      ),
      'resultados', (
        with result_base as (
          select r.id_prueba, r.respuestas, e.grado
          from public.resultados r
          join public.estudiantes e on e.id_prueba = r.id_prueba
          where r.activo = true and e.activo = true and (
            v_role = 'admin'
            or v_is_coord
            or (v_role in ('student','teacher') and r.id_prueba = any(coalesce(v_exam_ids, array[]::text[])))
          )
        ), max_items as (
          select grado, max(numero_item) as max_item
          from public.claves
          where activo = true
          group by grado
        ), split_rows as (
          select
            rb.grado,
            s.session,
            s.start_item,
            jsonb_agg(
              jsonb_build_object('Roll No', rb.id_prueba) || coalesce((
                select jsonb_object_agg('Q ' || (i - s.start_item + 1) || ' Options', coalesce(rb.respuestas->>i::text, ''))
                from generate_series(s.start_item, s.end_item) as i
              ), '{}'::jsonb)
              order by rb.id_prueba
            ) as rows
          from result_base rb
          join max_items mi on mi.grado = rb.grado
          join lateral (
            select 1 as session, 1 as start_item, least(mi.max_item, 70) as end_item
            where mi.max_item >= 1
            union all
            select 2 as session, 71 as start_item, mi.max_item as end_item
            where mi.max_item >= 71
          ) s on true
          group by rb.grado, s.session, s.start_item
        )
        select coalesce(jsonb_agg(jsonb_build_object(
          'grade', grado,
          'session', session,
          'startItem', start_item,
          'path', 'SUPABASE/' || grado || 'S' || session || '.json',
          'rows', rows
        ) order by grado, session), '[]'::jsonb)
        from split_rows
      )
    )
  ), '2026-1S');
end;
$function$;

CREATE OR REPLACE FUNCTION public.roque_v4_login_controlado_private(p_user text, p_password text DEFAULT ''::text, p_terminal uuid DEFAULT NULL::uuid, p_device text DEFAULT NULL::text, p_mode text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
 v_pause boolean; v_allowed text; v_edition text;
 v_login text:=lower(pg_catalog.btrim(coalesce(p_user,'')));
 v_st public.estudiantes%ROWTYPE;
BEGIN
 IF roque_private.examen_restringido_login(p_user) THEN
   RETURN jsonb_build_object('ok',false,'restringido',true,'error','Examen restringido.');
 END IF;
 SELECT pause_students,allowed_exam_id,preview_edition INTO v_pause,v_allowed,v_edition
 FROM roque_private.portal_access_gate WHERE id=1;
 IF NOT coalesce(v_pause,false) THEN
  RETURN public.roque_v4_login_original_2026_2s(p_user,p_password,p_terminal,p_device,p_mode);
 END IF;
 IF v_login='admin' OR pg_catalog.strpos(v_login,'@')>0 OR EXISTS(
  SELECT 1 FROM public.docentes d WHERE d.activo AND lower(d.id_docente)=v_login)
 THEN
  RETURN public.roque_v4_login_original_2026_2s(p_user,p_password,p_terminal,p_device,p_mode);
 END IF;
 IF v_login=v_allowed AND v_login='2573' AND v_edition='2026-2S'
   AND p_mode='roque_historico_2026_1s_2573' THEN
  RETURN roque_private.roque_historico_2573();
 END IF;
 IF v_login=v_allowed THEN
  SELECT * INTO v_st FROM public.estudiantes WHERE activo AND id_prueba=v_allowed LIMIT 1;
  IF FOUND THEN
   RETURN pg_catalog.jsonb_build_object(
    'ok',true,'role','student',
    'session',pg_catalog.jsonb_build_object('role','student','roll',v_st.id_prueba),
    'modo_vista_previa',v_edition,'edicion',v_edition,
    'origen_academico','vista_previa_sin_notas',
    'datasets',pg_catalog.jsonb_build_object(
      'estudiantes',pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
        'ID_ALUMNO',v_st.id_alumno,'ID_PRUEBA',v_st.id_prueba,
        'APELLIDOS',coalesce(v_st.apellidos,''),'NOMBRES',coalesce(v_st.nombres,''),
        'NOMBRE_COMPLETO',pg_catalog.btrim(coalesce(v_st.nombres,'')||' '||coalesce(v_st.apellidos,'')),
        'SEDE',coalesce(v_st.sede,''),'GRADO',v_st.grado::text,
        'GRUPO',coalesce(v_st.grupo,''))),
      'keys','[]'::jsonb,'resultados','[]'::jsonb,
      'carga','[]'::jsonb,'docentes','[]'::jsonb,'directoresGrupo','[]'::jsonb)
   );
  END IF;
 END IF;
 RETURN pg_catalog.jsonb_build_object('ok',false,
  'error','El acceso estudiantil está temporalmente suspendido mientras preparamos la evaluación de 2026-2S.');
END $function$;

CREATE OR REPLACE FUNCTION public.roque_v5_historial_autorizado(p_edicion text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
 v_persona uuid; v_ediciones jsonb; v_i record;
 v_keys jsonb; v_results jsonb; v_rank jsonb;
 v_grado jsonb; v_curso jsonb; v_areas jsonb;
BEGIN
 IF p_edicion IS NOT NULL AND roque_private.historial_bloqueado(p_edicion) THEN
   RETURN jsonb_build_object('ok',false,'historial_bloqueado',true,
     'error','Estos exámenes están bloqueados hasta que finalice el periodo.');
 END IF;
 IF auth.uid() IS NULL THEN RETURN jsonb_build_object('ok',false,'error','Inicia sesion'); END IF;
 SELECT persona_id INTO v_persona FROM roque_private.cuentas_estudiante
 WHERE user_id=auth.uid() AND activo;
 IF v_persona IS NULL THEN RETURN jsonb_build_object('ok',false,'error','La cuenta no esta vinculada al historial'); END IF;
 IF EXISTS(select 1 from roque_private.inscripciones i join roque_private.medidas_estudiante m
 on m.edicion=i.edicion and m.id_prueba=i.id_prueba
 where i.persona_id=v_persona and m.tipo='restriccion' and m.activo
 and (p_edicion is null or i.edicion=p_edicion)) THEN
   RETURN jsonb_build_object('ok',false,'restringido',true,'error','Examen restringido.');
 END IF;
 SELECT coalesce(jsonb_agg(jsonb_build_object(
  'codigo',e.codigo,'titulo',e.titulo,'anio',e.anio,'semestre',e.semestre)
  ORDER BY e.anio DESC,e.semestre DESC),'[]'::jsonb) INTO v_ediciones
 FROM roque_private.inscripciones i JOIN roque_private.ediciones e ON e.codigo=i.edicion
 WHERE i.persona_id=v_persona AND i.activo
  AND e.resultados_visibles AND e.estado IN('publicada','cerrada');
 IF p_edicion IS NULL THEN
  RETURN jsonb_build_object('ok',true,'ediciones',v_ediciones);
 END IF;
 SELECT i.id_prueba,i.id_alumno,i.apellidos,i.nombres,i.grado,i.sede,i.grupo
 INTO v_i FROM roque_private.inscripciones i JOIN roque_private.ediciones e
 ON e.codigo=i.edicion
 WHERE i.persona_id=v_persona AND i.edicion=p_edicion AND i.activo
 AND e.resultados_visibles AND e.estado IN('publicada','cerrada');
 IF NOT FOUND THEN
  RETURN jsonb_build_object('ok',false,'error','Evaluacion no autorizada o no publicada');
 END IF;
 SELECT coalesce(jsonb_agg(jsonb_build_object(
  'Grado',k.grado::text,'Área',k.area,'Número de ítem',k.numero_item::text,
  'Respuesta sugerida',k.respuesta_correcta,
  'Componente / pensamiento / entorno / factor / enfoque',coalesce(k.componente,''),
  'Competencia',coalesce(k.competencia,'')) ORDER BY k.numero_item),'[]'::jsonb)
 INTO v_keys FROM roque_private.items k
 WHERE k.edicion=p_edicion AND k.grado=v_i.grado AND k.activo
 AND k.respuesta_correcta IS NOT NULL;
 SELECT coalesce(jsonb_agg(jsonb_build_object('Roll No',r.id_prueba,
  'respuestas',roque_private.mascara_respuestas_medidas(p_edicion,r.id_prueba,v_i.grado,r.respuestas))),'[]'::jsonb) INTO v_results
 FROM roque_private.resultados r
 WHERE r.edicion=p_edicion AND r.id_prueba=v_i.id_prueba AND r.activo;
 v_rank:=roque_private.ranking_calculo_por_edicion(v_i.id_prueba,p_edicion);
 IF coalesce((v_rank->>'ok')::boolean,false) THEN
  SELECT coalesce(jsonb_agg(x.fila),'[]'::jsonb) INTO v_grado
  FROM pg_catalog.jsonb_array_elements(coalesce(v_rank->'grado_rows','[]'::jsonb)) x(fila)
  WHERE x.fila->>'id_prueba'=v_i.id_prueba;
  SELECT coalesce(jsonb_agg(x.fila),'[]'::jsonb) INTO v_curso
  FROM pg_catalog.jsonb_array_elements(coalesce(v_rank->'curso_rows','[]'::jsonb)) x(fila)
  WHERE x.fila->>'id_prueba'=v_i.id_prueba;
  WITH filas AS (
   SELECT x.fila FROM pg_catalog.jsonb_array_elements(coalesce(v_rank->'grado_rows','[]'::jsonb)) x(fila)
  ), scores AS (
   SELECT f.fila->>'id_prueba' AS id_prueba,
     a.area,(f.fila->>a.key)::numeric AS puntaje,
     (f.fila->>'puntaje_global')::numeric AS global,
     f.fila->>'nombre' AS nombre
   FROM filas f CROSS JOIN (VALUES
    ('Matemáticas','matematicas'),('Lenguaje','lenguaje'),
    ('Ciencias Naturales','naturales'),
    ('Ciencias Sociales y Ciudadanía','sociales'),('Inglés','ingles')
   ) a(area,key)
   WHERE f.fila->>a.key IS NOT NULL
  ), puestos AS (
   SELECT id_prueba,area,puntaje,
     row_number() OVER(PARTITION BY area ORDER BY puntaje DESC,global DESC NULLS LAST,nombre,id_prueba)::int puesto,
     count(*) OVER(PARTITION BY area)::int total
   FROM scores
  )
  SELECT coalesce(jsonb_object_agg(area,jsonb_build_object('puesto',puesto,
   'total',total,'puntaje',puntaje)),'{}'::jsonb)
  INTO v_areas FROM puestos WHERE id_prueba=v_i.id_prueba;
 ELSE
  v_grado:='[]'::jsonb;v_curso:='[]'::jsonb;v_areas:='{}'::jsonb;
 END IF;
 RETURN jsonb_build_object(
  'ok',true,'edicion',p_edicion,'ediciones',v_ediciones,
  'origen_academico','roque_private_auth_v172',
  'session',jsonb_build_object('role','student','roll',v_i.id_prueba),
  'ranking_personal',jsonb_build_object(
    'ranking',coalesce(v_rank->'ranking','{}'::jsonb),
    'grado_rows',v_grado,'curso_rows',v_curso,'ranking_areas',v_areas),
  'datasets',jsonb_build_object(
   'estudiantes',jsonb_build_array(jsonb_build_object(
    'ID_ALUMNO',v_i.id_alumno,'ID_PRUEBA',v_i.id_prueba,
    'APELLIDOS',coalesce(v_i.apellidos,''),'NOMBRES',coalesce(v_i.nombres,''),
    'NOMBRE_COMPLETO',pg_catalog.btrim(coalesce(v_i.nombres,'')||' '||coalesce(v_i.apellidos,'')),
    'SEDE',coalesce(v_i.sede,''),'GRADO',v_i.grado::text,'GRUPO',coalesce(v_i.grupo,''))),
   'keys',jsonb_build_array(jsonb_build_object('grade',v_i.grado,
    'path','SUPABASE/'||p_edicion||'/KEYS_'||v_i.grado||'.json','rows',v_keys)),
   'medidas',jsonb_build_array(roque_private.resumen_medidas(p_edicion,v_i.id_prueba,v_i.grado)),
 'resultados',jsonb_build_array(jsonb_build_object('grade',v_i.grado,
    'session',0,'startItem',1,
    'path','SUPABASE/'||p_edicion||'/RESULTADOS_'||v_i.grado||'.json','rows',v_results)),
   'carga','[]'::jsonb,'docentes','[]'::jsonb,'directoresGrupo','[]'::jsonb)
 );
END $function$;

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
 v_medidas jsonb:='[]'::jsonb;
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
      pg_catalog.jsonb_build_object('Roll No',r.id_prueba,
 'respuestas',roque_private.mascara_respuestas_medidas(v_ed.codigo,r.id_prueba,i.grado,r.respuestas))
      ORDER BY r.id_prueba) filas
   FROM roque_private.resultados r JOIN roque_private.inscripciones i
     ON i.edicion=r.edicion AND i.id_prueba=r.id_prueba
   WHERE r.edicion=v_ed.codigo AND r.activo IS TRUE AND i.activo IS TRUE
     AND EXISTS (SELECT 1 FROM pg_catalog.jsonb_array_elements(v_ins) j(x)
                 WHERE j.x->>'ID_PRUEBA'=r.id_prueba)
   GROUP BY i.grado
 ) g;
 SELECT coalesce(jsonb_agg(roque_private.resumen_medidas(v_ed.codigo,
 j.x->>'ID_PRUEBA',coalesce(nullif(j.x->>'GRADO','')::integer,0))),'[]'::jsonb)
 INTO v_medidas FROM pg_catalog.jsonb_array_elements(v_ins) j(x);
 RETURN pg_catalog.jsonb_set(v_payload,'{datasets}',v_datasets ||
      pg_catalog.jsonb_build_object('estudiantes',v_ins,'keys',v_keys,'resultados',v_results,'medidas',v_medidas),true)
    || pg_catalog.jsonb_build_object('edicion',v_ed.codigo,
       'origen_academico','roque_private','resultados_revisados',v_result_count);
END
$function$;
