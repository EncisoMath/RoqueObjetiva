-- v173 / bloqueo 2026 Nov 1 a Nov 18, Colombia; no reescribir notas.
CREATE OR REPLACE FUNCTION roque_private.historial_bloqueado(
 p_edicion text, p_fecha date DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'America/Bogota')::date
) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $func$
 SELECT coalesce(p_fecha BETWEEN date '2026-11-01' AND date '2026-11-18'
   AND EXISTS (SELECT 1 FROM roque_private.ediciones old_e
     JOIN roque_private.ediciones new_e
       ON (new_e.anio,new_e.semestre)>(old_e.anio,old_e.semestre)
     WHERE old_e.codigo=p_edicion),false)
$func$;
REVOKE ALL ON FUNCTION roque_private.historial_bloqueado(text,date) FROM PUBLIC,anon,authenticated,service_role;

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

  return jsonb_build_object(
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
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.roque_v4_login_controlado_private(p_user text, p_password text DEFAULT ''::text, p_terminal uuid DEFAULT NULL::uuid, p_device text DEFAULT NULL::text, p_mode text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
 o jsonb; d jsonb; ins jsonb; keys_new jsonb; results_new jsonb;
 ed text := '2026-1S'; olds integer; news integer; oldk integer; newk integer; oldr integer; newr integer;
BEGIN
 -- Los limites diarios, bloqueos y roles se comprueban antes de tocar roque_private.
 o := public.roque_v2_login_controlado(p_user,p_password,p_terminal,p_device,p_mode);
 IF coalesce((o->>'ok')::boolean,false) IS NOT TRUE THEN RETURN o; END IF;
 IF o->'session'->>'role'='student' AND roque_private.historial_bloqueado(ed) THEN
   RETURN o || jsonb_build_object('historial_bloqueado',true);
 END IF;
 IF NOT EXISTS (SELECT 1 FROM roque_private.ediciones
    WHERE codigo=ed AND resultados_visibles AND estado IN ('publicada','cerrada')) THEN
   RETURN o || jsonb_build_object('origen_academico','legacy_edicion_no_visible');
 END IF;
 d := coalesce(o->'datasets','{}'::jsonb);
 -- Paridad completa antes del cambio de lectura. Si un admin edita una fila
 -- en public, la app continua por la ruta historica hasta reconciliarla.
 IF (SELECT count(*) FROM public.estudiantes e FULL JOIN
       (SELECT * FROM roque_private.inscripciones WHERE edicion=ed) i
       ON i.id_prueba=e.id_prueba
       WHERE e.id_prueba IS NULL OR i.id_prueba IS NULL OR e.id_alumno IS DISTINCT FROM i.id_alumno
         OR e.grado IS DISTINCT FROM i.grado OR e.sede IS DISTINCT FROM i.sede
         OR e.grupo IS DISTINCT FROM i.grupo OR e.apellidos IS DISTINCT FROM i.apellidos
         OR e.nombres IS DISTINCT FROM i.nombres OR e.activo IS DISTINCT FROM i.activo) > 0
 OR (SELECT count(*) FROM public.resultados r FULL JOIN
       (SELECT * FROM roque_private.resultados WHERE edicion=ed) n
       ON n.id_prueba=r.id_prueba
       WHERE r.id_prueba IS NULL OR n.id_prueba IS NULL
         OR r.respuestas IS DISTINCT FROM n.respuestas OR r.activo IS DISTINCT FROM n.activo) > 0
 OR (SELECT count(*) FROM public.claves k FULL JOIN
       (SELECT * FROM roque_private.items WHERE edicion=ed) n
       ON n.grado=k.grado AND n.numero_item=k.numero_item
       WHERE k.id IS NULL OR n.numero_item IS NULL OR k.area IS DISTINCT FROM n.area
         OR k.respuesta_sugerida IS DISTINCT FROM n.respuesta_correcta
         OR k.activo IS DISTINCT FROM n.activo OR k.componente IS DISTINCT FROM n.componente
         OR k.competencia IS DISTINCT FROM n.competencia) > 0 THEN
    RETURN o || jsonb_build_object('origen_academico','legacy_respaldo_diferencia','edicion',ed);
 END IF;
 -- Respetar estrictamente la lista de ID_PRUEBA que el login autorizo.
 SELECT coalesce(jsonb_agg(jsonb_build_object(
  'ID_ALUMNO',i.id_alumno,'ID_PRUEBA',i.id_prueba,
  'APELLIDOS',coalesce(i.apellidos,''),'NOMBRES',coalesce(i.nombres,''),
  'NOMBRE_COMPLETO',trim(coalesce(i.nombres,'')||' '||coalesce(i.apellidos,'')),
  'SEDE',coalesce(i.sede,''),'GRADO',i.grado::text,'GRUPO',coalesce(i.grupo,'')
 ) ORDER BY i.grado,i.sede,i.grupo,i.apellidos,i.nombres),'[]'::jsonb)
 INTO ins
 FROM roque_private.inscripciones i WHERE i.edicion=ed AND i.activo
   AND EXISTS(SELECT 1 FROM jsonb_array_elements(coalesce(d->'estudiantes','[]'::jsonb)) src(x)
              WHERE src.x->>'ID_PRUEBA'=i.id_prueba);
 SELECT coalesce(jsonb_agg(jsonb_build_object(
   'grade',x.grado,'path','SUPABASE/KEYS_'||x.grado||'.json','rows',x.filas
 ) ORDER BY x.grado),'[]'::jsonb) INTO keys_new
 FROM (
   SELECT k.grado,jsonb_agg(jsonb_build_object(
     'Grado',k.grado::text,'Área',k.area,
     'Número de ítem',k.numero_item::text,'Respuesta sugerida',k.respuesta_correcta,
     'Componente / pensamiento / entorno / factor / enfoque',coalesce(k.componente,''),
     'Competencia',coalesce(k.competencia,'')
   ) ORDER BY k.numero_item) filas
   FROM roque_private.items k
   WHERE k.edicion=ed AND k.activo AND k.respuesta_correcta IS NOT NULL
     AND EXISTS(SELECT 1 FROM jsonb_array_elements(coalesce(d->'keys','[]'::jsonb)) src(x)
                WHERE src.x->>'grade'=k.grado::text)
   GROUP BY k.grado
 ) x;
 -- JSON de respuestas mantiene los numeros globales, sin rangos de area fijos.
 SELECT coalesce(jsonb_agg(jsonb_build_object(
   'grade',x.grado,'session',0,'startItem',1,
   'path','SUPABASE/'||ed||'/RESULTADOS_'||x.grado||'.json','rows',x.filas
 ) ORDER BY x.grado),'[]'::jsonb) INTO results_new
 FROM (
   SELECT i.grado,jsonb_agg(jsonb_build_object('Roll No',r.id_prueba,
     'respuestas',r.respuestas) ORDER BY r.id_prueba) filas
   FROM roque_private.resultados r JOIN roque_private.inscripciones i
     ON i.edicion=r.edicion AND i.id_prueba=r.id_prueba
   WHERE r.edicion=ed AND r.activo AND i.activo
     AND EXISTS(SELECT 1 FROM jsonb_array_elements(coalesce(d->'estudiantes','[]'::jsonb)) src(x)
                WHERE src.x->>'ID_PRUEBA'=r.id_prueba)
   GROUP BY i.grado
 ) x;
 -- Respaldo automatico si las listas autorizadas dejan de coincidir.
 olds:=jsonb_array_length(coalesce(d->'estudiantes','[]'::jsonb));news:=jsonb_array_length(ins);
 SELECT coalesce(sum(jsonb_array_length(x.j->'rows')),0)::int INTO oldk
 FROM jsonb_array_elements(coalesce(d->'keys','[]'::jsonb)) x(j);
 SELECT coalesce(sum(jsonb_array_length(x.j->'rows')),0)::int INTO newk
 FROM jsonb_array_elements(keys_new) x(j);
 SELECT count(DISTINCT r.j->>'Roll No')::int INTO oldr
 FROM jsonb_array_elements(coalesce(d->'resultados','[]'::jsonb)) x(j),
 LATERAL jsonb_array_elements(x.j->'rows') r(j);
 SELECT coalesce(sum(jsonb_array_length(x.j->'rows')),0)::int INTO newr
 FROM jsonb_array_elements(results_new) x(j);
 IF olds<>news OR oldk<>newk OR oldr<>newr THEN
   RETURN o || jsonb_build_object('origen_academico','legacy_respaldo_cantidad','edicion',ed);
 END IF;
 RETURN jsonb_set(o,'{datasets}',d || jsonb_build_object(
  'estudiantes',ins,'keys',keys_new,'resultados',results_new),true)
  || jsonb_build_object('origen_academico','roque_private','edicion',ed);
END $function$;

CREATE OR REPLACE FUNCTION public.roque_v2_ranking_controlado(p_login text, p_terminal uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_hash text;
  v_exam text;
  v_payload jsonb;
  v_grado jsonb;
  v_curso jsonb;
BEGIN
 IF roque_private.historial_bloqueado('2026-1S') THEN
   RETURN jsonb_build_object('ok',false,'historial_bloqueado',true,
     'error','Estos exámenes están bloqueados hasta que finalice el periodo.');
 END IF;
  IF p_terminal IS NULL THEN
    RETURN jsonb_build_object('ok',false,'error','Navegador no identificado.');
  END IF;
  v_hash := pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(p_terminal::text,'UTF8')),'hex');
  SELECT e.id_prueba INTO v_exam FROM public.estudiantes e
    WHERE e.activo = true
      AND (lower(e.id_prueba)=lower(btrim(p_login))
        OR lower(e.id_alumno)=lower(btrim(p_login)))
    ORDER BY e.id_prueba LIMIT 1;
  IF v_exam IS NULL OR NOT EXISTS (
    SELECT 1 FROM roque_private.perfiles_consultados q
    WHERE q.terminal_hash=v_hash AND q.id_prueba=v_exam
      AND q.ultimo_acceso >= pg_catalog.clock_timestamp() - interval '60 minutes'
  ) THEN
    RETURN jsonb_build_object('ok',false,
      'error','Primero ingresa al perfil del estudiante con este navegador.');
  END IF;

  v_payload := public.roque_get_student_ranking_context(v_exam);
  IF coalesce((v_payload->>'ok')::boolean,false) IS NOT TRUE THEN
    RETURN v_payload;
  END IF;

  -- El ranking completo del grado expone notas/nombres de cientos de estudiantes:
  -- no entregarlo a un navegador anónimo. Conservar exclusivamente la fila propia,
  -- y los valores agregados de puesto y total para la pantalla estudiantil.
  SELECT coalesce(jsonb_agg(x.rowdata),'[]'::jsonb) INTO v_grado
  FROM pg_catalog.jsonb_array_elements(coalesce(v_payload->'grado_rows','[]'::jsonb)) AS x(rowdata)
  WHERE x.rowdata->>'id_prueba'=v_exam;
  SELECT coalesce(jsonb_agg(x.rowdata),'[]'::jsonb) INTO v_curso
  FROM pg_catalog.jsonb_array_elements(coalesce(v_payload->'curso_rows','[]'::jsonb)) AS x(rowdata)
  WHERE x.rowdata->>'id_prueba'=v_exam;

  RETURN pg_catalog.jsonb_set(
    pg_catalog.jsonb_set(v_payload,'{grado_rows}',v_grado,true),
    '{curso_rows}',v_curso,true);
END;
$function$;

CREATE OR REPLACE FUNCTION public.roque_v3_ranking_controlado_edicion(p_login text, p_terminal uuid, p_edicion text DEFAULT '2026-1S'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
 v_hash text;
 v_exam text;
 v_payload jsonb;
 v_grado jsonb;
 v_curso jsonb;
 v_rank_areas jsonb;
BEGIN
 IF roque_private.historial_bloqueado('2026-1S') THEN
   RETURN jsonb_build_object('ok',false,'historial_bloqueado',true,
     'error','Estos exámenes están bloqueados hasta que finalice el periodo.');
 END IF;
 -- La autorización por edición de estudiantes llega en la siguiente etapa.
 -- El v170 nunca acepta una edición diferente del semestre histórico visible.
 IF p_edicion IS DISTINCT FROM '2026-1S' OR NOT EXISTS(
    SELECT 1 FROM roque_private.ediciones e
    WHERE e.codigo=p_edicion AND e.resultados_visibles
      AND e.estado IN ('publicada','cerrada')) THEN
   RETURN jsonb_build_object('ok',false,'error','Edición no disponible para consulta.');
 END IF;
 IF p_terminal IS NULL THEN
   RETURN jsonb_build_object('ok',false,'error','Navegador no identificado.');
 END IF;
 v_hash := pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(p_terminal::text,'UTF8')),'hex');
 SELECT i.id_prueba INTO v_exam
 FROM roque_private.inscripciones i
 WHERE i.edicion=p_edicion AND i.activo
   AND (lower(i.id_prueba)=lower(btrim(p_login))
     OR lower(i.id_alumno)=lower(btrim(p_login)))
 ORDER BY i.id_prueba LIMIT 1;
 -- Mismo control del v2: solo el perfil abierto durante los últimos 60 minutos.
 IF v_exam IS NULL OR NOT EXISTS(
   SELECT 1 FROM roque_private.perfiles_consultados q
   WHERE q.terminal_hash=v_hash AND q.id_prueba=v_exam
     AND q.ultimo_acceso>=pg_catalog.clock_timestamp()-interval '60 minutes'
 ) THEN
   RETURN jsonb_build_object('ok',false,
     'error','Primero ingresa al perfil del estudiante con este navegador.');
 END IF;
 -- La v169 vuelve íntegramente a public si hay divergencia. Alinear ranking.
 IF EXISTS(
  SELECT 1 FROM public.estudiantes p
  FULL JOIN (SELECT * FROM roque_private.inscripciones WHERE edicion=p_edicion) i
    ON i.id_prueba=p.id_prueba
  WHERE p.id_prueba IS NULL OR i.id_prueba IS NULL
    OR p.id_alumno IS DISTINCT FROM i.id_alumno
    OR p.grado IS DISTINCT FROM i.grado OR p.sede IS DISTINCT FROM i.sede
    OR p.grupo IS DISTINCT FROM i.grupo
    OR p.apellidos IS DISTINCT FROM i.apellidos
    OR p.nombres IS DISTINCT FROM i.nombres OR p.activo IS DISTINCT FROM i.activo
 ) OR EXISTS (
  SELECT 1 FROM public.claves p
  FULL JOIN (SELECT * FROM roque_private.items WHERE edicion=p_edicion) i
    ON p.grado=i.grado AND p.numero_item=i.numero_item
  WHERE p.id IS NULL OR i.numero_item IS NULL
    OR p.area IS DISTINCT FROM i.area
    OR p.respuesta_sugerida IS DISTINCT FROM i.respuesta_correcta
    OR p.activo IS DISTINCT FROM i.activo
    OR p.componente IS DISTINCT FROM i.componente
    OR p.competencia IS DISTINCT FROM i.competencia
 ) OR EXISTS (
  SELECT 1 FROM public.resultados p
  FULL JOIN (SELECT * FROM roque_private.resultados WHERE edicion=p_edicion) i
    ON p.id_prueba=i.id_prueba
  WHERE p.id_prueba IS NULL OR i.id_prueba IS NULL
    OR p.respuestas IS DISTINCT FROM i.respuestas OR p.activo IS DISTINCT FROM i.activo
 ) THEN
   RETURN public.roque_v2_ranking_controlado(p_login,p_terminal)
     || jsonb_build_object('origen_academico','legacy_respaldo_diferencia',
                           'edicion',p_edicion);
 END IF;
 v_payload := roque_private.ranking_calculo_por_edicion(v_exam,p_edicion);
 IF coalesce((v_payload->>'ok')::boolean,false) IS NOT TRUE THEN RETURN v_payload; END IF;
 SELECT coalesce(jsonb_agg(x.rowdata),'[]'::jsonb) INTO v_grado
 FROM pg_catalog.jsonb_array_elements(coalesce(v_payload->'grado_rows','[]'::jsonb)) x(rowdata)
 WHERE x.rowdata->>'id_prueba'=v_exam;
 SELECT coalesce(jsonb_agg(x.rowdata),'[]'::jsonb) INTO v_curso
 FROM pg_catalog.jsonb_array_elements(coalesce(v_payload->'curso_rows','[]'::jsonb)) x(rowdata)
 WHERE x.rowdata->>'id_prueba'=v_exam;
 IF jsonb_array_length(v_grado)<>1 OR jsonb_array_length(v_curso)<>1 THEN
   RETURN jsonb_build_object('ok',false,'error','No fue posible validar el ranking personal.');
 END IF;
 -- Agregados por asignatura. Solo puesto/total/puntaje del alumno autenticado.
 WITH detalles AS (
   SELECT x.data AS fila
   FROM pg_catalog.jsonb_array_elements(coalesce(v_payload->'grado_rows','[]'::jsonb)) x(data)
 ), scores AS (
   SELECT d.fila->>'id_prueba' AS id_prueba,
     a.area, (d.fila->>a.key)::numeric AS puntaje,
     (d.fila->>'puntaje_global')::numeric AS global,
     d.fila->>'nombre' AS nombre
   FROM detalles d CROSS JOIN (VALUES
     ('Matemáticas','matematicas'),('Lenguaje','lenguaje'),
     ('Ciencias Naturales','naturales'),
     ('Ciencias Sociales y Ciudadanía','sociales'),
     ('Inglés','ingles')) a(area,key)
   WHERE d.fila->>a.key IS NOT NULL
 ), puesto AS (
   SELECT id_prueba,area,puntaje,
    row_number() OVER(PARTITION BY area ORDER BY puntaje DESC,global DESC NULLS LAST,nombre,id_prueba)::int posicion,
    count(*) OVER(PARTITION BY area)::int total
   FROM scores
 )
 SELECT coalesce(jsonb_object_agg(area,jsonb_build_object(
    'puesto',posicion,'total',total,'puntaje',puntaje)),'{}'::jsonb)
 INTO v_rank_areas FROM puesto WHERE id_prueba=v_exam;
 RETURN pg_catalog.jsonb_set(
   pg_catalog.jsonb_set(v_payload,'{grado_rows}',v_grado,true),
   '{curso_rows}',v_curso,true
 ) || jsonb_build_object('origen_academico','roque_private','edicion',p_edicion,
                         'ranking_areas',v_rank_areas);
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
  'respuestas',r.respuestas)),'[]'::jsonb) INTO v_results
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
   'resultados',jsonb_build_array(jsonb_build_object('grade',v_i.grado,
    'session',0,'startItem',1,
    'path','SUPABASE/'||p_edicion||'/RESULTADOS_'||v_i.grado||'.json','rows',v_results)),
   'carga','[]'::jsonb,'docentes','[]'::jsonb,'directoresGrupo','[]'::jsonb)
 );
END $function$;

CREATE OR REPLACE FUNCTION public.roque_v5_portada_ediciones()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT pg_catalog.jsonb_build_object(
    'ok',true,
    'ediciones',coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'codigo',e.codigo,'titulo',e.titulo,'anio',e.anio,'semestre',e.semestre,
      'estado',e.estado,'resultados_visibles',e.resultados_visibles,
      'bloqueado_periodo',roque_private.historial_bloqueado(e.codigo)
    ) ORDER BY e.anio DESC,e.semestre DESC),'[]'::jsonb)
  )
  FROM roque_private.ediciones AS e
$function$;
