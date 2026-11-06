-- v175.82 · Endurecimiento de rutas legadas sin medidas y redacción de salida.
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
 IF exists(select 1 from roque_private.inscripciones i
   join roque_private.medidas_estudiante m on m.edicion=i.edicion and m.id_prueba=i.id_prueba
   where i.activo and m.activo and i.edicion='2026-1S' and
   (lower(btrim(i.id_prueba))=lower(btrim(p_login))
     or lower(btrim(i.id_alumno))=lower(btrim(p_login)))) THEN
   RETURN jsonb_build_object('ok',false,'error',
    'Utiliza la consulta autorizada de resultados; el respaldo legado está deshabilitado para este examen.');
 END IF;
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

CREATE OR REPLACE FUNCTION public.roque_get_student_ranking_context_v124(p_login text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_login text := btrim(coalesce(p_login, ''));
  v_target_id_prueba text;
  v_target_id_alumno text;
  v_target_apellidos text;
  v_target_nombres text;
  v_target_sede text;
  v_target_grado integer;
  v_target_grupo text;
  v_payload jsonb;
begin
 IF exists(select 1 from roque_private.inscripciones i
   join roque_private.medidas_estudiante m on m.edicion=i.edicion and m.id_prueba=i.id_prueba
   where i.activo and m.activo and i.edicion='2026-1S' and
   (lower(btrim(i.id_prueba))=lower(btrim(p_login))
     or lower(btrim(i.id_alumno))=lower(btrim(p_login)))) THEN
   RETURN jsonb_build_object('ok',false,'error',
    'Utiliza la consulta autorizada de resultados; el respaldo legado está deshabilitado para este examen.');
 END IF;
  if v_login = '' then
    return jsonb_build_object('ok', false, 'error', 'p_login vacío');
  end if;

  select
    btrim(coalesce(e.id_prueba, '')),
    btrim(coalesce(e.id_alumno, '')),
    coalesce(e.apellidos, ''),
    coalesce(e.nombres, ''),
    coalesce(e.sede, ''),
    e.grado,
    coalesce(e.grupo, '')
  into
    v_target_id_prueba,
    v_target_id_alumno,
    v_target_apellidos,
    v_target_nombres,
    v_target_sede,
    v_target_grado,
    v_target_grupo
  from public.estudiantes e
  where coalesce(e.activo, true)
    and (
      btrim(coalesce(e.id_prueba, '')) = v_login
      or btrim(coalesce(e.id_alumno, '')) = v_login
    )
  order by e.id_prueba
  limit 1;

  if v_target_id_prueba is null then
    return jsonb_build_object(
      'ok', false,
      'error', 'No se encontró estudiante activo para el ID enviado',
      'login', v_login
    );
  end if;

  with claves_canonicas as (
    select
      c.grado,
      c.numero_item,
      case
        when lower(translate(btrim(coalesce(c.area, '')), 'ÁÉÍÓÚÜÑáéíóúüñ', 'AEIOUUNaeiouun')) = 'matematicas' then 'Matemáticas'
        when lower(translate(btrim(coalesce(c.area, '')), 'ÁÉÍÓÚÜÑáéíóúüñ', 'AEIOUUNaeiouun')) like 'lenguaje%' then 'Lenguaje'
        when lower(translate(btrim(coalesce(c.area, '')), 'ÁÉÍÓÚÜÑáéíóúüñ', 'AEIOUUNaeiouun')) = 'ciencias naturales' then 'Ciencias Naturales'
        when lower(translate(btrim(coalesce(c.area, '')), 'ÁÉÍÓÚÜÑáéíóúüñ', 'AEIOUUNaeiouun')) = 'ciencias sociales y ciudadania' then 'Ciencias Sociales y Ciudadanía'
        when lower(translate(btrim(coalesce(c.area, '')), 'ÁÉÍÓÚÜÑáéíóúüñ', 'AEIOUUNaeiouun')) = 'ingles' then 'Inglés'
        else null
      end as area_canonica,
      substring(regexp_replace(upper(coalesce(c.respuesta_sugerida, '')), '[^A-H]', '', 'g') from 1 for 1) as respuesta_correcta
    from public.claves c
    where coalesce(c.activo, true)
      and c.grado = v_target_grado
  ),
  base as (
    select
      btrim(coalesce(e.id_prueba, '')) as id_prueba,
      btrim(coalesce(e.id_alumno, '')) as id_alumno,
      coalesce(e.apellidos, '') as apellidos,
      coalesce(e.nombres, '') as nombres,
      coalesce(e.sede, '') as sede,
      e.grado,
      coalesce(e.grupo, '') as curso,
      r.respuestas
    from public.estudiantes e
    join public.resultados r
      on btrim(coalesce(r.id_prueba, '')) = btrim(coalesce(e.id_prueba, ''))
     and coalesce(r.activo, true)
    where coalesce(e.activo, true)
      and e.grado = v_target_grado
  ),
  detalle as (
    select
      b.id_prueba,
      b.id_alumno,
      b.apellidos,
      b.nombres,
      b.sede,
      b.grado,
      b.curso,
      k.area_canonica,
      k.numero_item,
      regexp_replace(upper(coalesce(b.respuestas ->> k.numero_item::text, '')), '[^A-H]', '', 'g') as marcada,
      k.respuesta_correcta
    from base b
    join claves_canonicas k
      on k.grado = b.grado
     and k.area_canonica is not null
  ),
  area_stats as (
    select
      d.id_prueba,
      d.id_alumno,
      d.apellidos,
      d.nombres,
      d.sede,
      d.grado,
      d.curso,
      d.area_canonica,
      count(*)::int as total_items,
      sum(case when length(d.marcada) = 1 and d.marcada = d.respuesta_correcta then 1 else 0 end)::int as correctas,
      bool_or(d.marcada <> '') as intento
    from detalle d
    group by d.id_prueba, d.id_alumno, d.apellidos, d.nombres, d.sede, d.grado, d.curso, d.area_canonica
  ),
  area_scores as (
    select
      a.*,
      case
        when a.total_items <= 0 then null
        when not a.intento then 0
        else round(20 + ((a.correctas::numeric / a.total_items::numeric) * 80))::int
      end as puntaje_area
    from area_stats a
  ),
  pivoted as (
    select
      b.id_prueba,
      b.id_alumno,
      b.apellidos,
      b.nombres,
      b.sede,
      b.grado,
      b.curso,
      max(s.puntaje_area) filter (where s.area_canonica = 'Matemáticas') as matematicas,
      max(s.puntaje_area) filter (where s.area_canonica = 'Lenguaje') as lenguaje,
      max(s.puntaje_area) filter (where s.area_canonica = 'Ciencias Naturales') as naturales,
      max(s.puntaje_area) filter (where s.area_canonica = 'Ciencias Sociales y Ciudadanía') as sociales,
      max(s.puntaje_area) filter (where s.area_canonica = 'Inglés') as ingles,
      coalesce(sum(s.correctas), 0)::int as correctas_total
    from base b
    left join area_scores s
      on s.id_prueba = b.id_prueba
    group by b.id_prueba, b.id_alumno, b.apellidos, b.nombres, b.sede, b.grado, b.curso
  ),
  scored as (
    select
      p.*,
      case
        when p.matematicas is not null
         and p.lenguaje is not null
         and p.naturales is not null
         and p.sociales is not null
         and p.ingles is not null
        then round(((p.matematicas * 3 + p.lenguaje * 3 + p.naturales * 3 + p.sociales * 3 + p.ingles) * 5.0) / 13.0)::int
        else null
      end as puntaje_global,
      case
        when p.matematicas is null or p.lenguaje is null or p.naturales is null or p.sociales is null or p.ingles is null
        then 'Faltan una o más áreas principales para calcular puntaje global.'
        else ''
      end as notas
    from pivoted p
  ),
  ranked_grade as (
    select
      row_number() over (order by s.puntaje_global desc nulls last, s.correctas_total desc, s.apellidos asc, s.nombres asc, s.id_prueba asc)::int as posicion,
      count(*) over ()::int as total_grado,
      s.*
    from scored s
  ),
  ranked_course as (
    select
      row_number() over (order by s.puntaje_global desc nulls last, s.correctas_total desc, s.apellidos asc, s.nombres asc, s.id_prueba asc)::int as posicion,
      count(*) over ()::int as total_curso,
      s.*
    from scored s
    where lower(btrim(coalesce(s.sede, ''))) = lower(btrim(coalesce(v_target_sede, '')))
      and lower(regexp_replace(btrim(coalesce(s.curso, '')), '\s+', '', 'g')) = lower(regexp_replace(btrim(coalesce(v_target_grupo, '')), '\s+', '', 'g'))
  ),
  target_grade as (
    select * from ranked_grade rg
    where rg.id_prueba = v_target_id_prueba or rg.id_alumno = v_target_id_alumno
    limit 1
  ),
  target_course as (
    select * from ranked_course rc
    where rc.id_prueba = v_target_id_prueba or rc.id_alumno = v_target_id_alumno
    limit 1
  )
  select jsonb_build_object(
    'ok', true,
    'estudiante', jsonb_build_object(
      'id_prueba', v_target_id_prueba,
      'id_alumno', v_target_id_alumno,
      'apellidos', v_target_apellidos,
      'nombres', v_target_nombres,
      'nombre', btrim(v_target_nombres || ' ' || v_target_apellidos),
      'sede', v_target_sede,
      'grado', v_target_grado,
      'curso', v_target_grupo,
      'puntaje_global', (select tg.puntaje_global from target_grade tg)
    ),
    'ranking', jsonb_build_object(
      'puesto_grado', (select tg.posicion from target_grade tg),
      'total_grado', (select tg.total_grado from target_grade tg),
      'puesto_curso', (select tc.posicion from target_course tc),
      'total_curso', (select tc.total_curso from target_course tc),
      'puntaje_global', (select tg.puntaje_global from target_grade tg)
    ),
    'grado_rows', coalesce((
      select jsonb_agg(jsonb_build_object(
        'posicion', rg.posicion,
        'id_prueba', rg.id_prueba,
        'id_alumno', rg.id_alumno,
        'nombre', btrim(rg.nombres || ' ' || rg.apellidos),
        'sede', rg.sede,
        'grado', rg.grado,
        'curso', rg.curso,
        'matematicas', rg.matematicas,
        'lenguaje', rg.lenguaje,
        'naturales', rg.naturales,
        'sociales', rg.sociales,
        'ingles', rg.ingles,
        'puntaje_global', rg.puntaje_global,
        'puntaje_orden', rg.puntaje_global,
        'es_usuario', (rg.id_prueba = v_target_id_prueba or rg.id_alumno = v_target_id_alumno),
        'notas', rg.notas,
        'fuente', 'Supabase RPC v124'
      ) order by rg.posicion)
      from ranked_grade rg
    ), '[]'::jsonb),
    'curso_rows', coalesce((
      select jsonb_agg(jsonb_build_object(
        'posicion', rc.posicion,
        'id_prueba', rc.id_prueba,
        'id_alumno', rc.id_alumno,
        'nombre', btrim(rc.nombres || ' ' || rc.apellidos),
        'sede', rc.sede,
        'grado', rc.grado,
        'curso', rc.curso,
        'matematicas', rc.matematicas,
        'lenguaje', rc.lenguaje,
        'naturales', rc.naturales,
        'sociales', rc.sociales,
        'ingles', rc.ingles,
        'puntaje_global', rc.puntaje_global,
        'puntaje_orden', rc.puntaje_global,
        'es_usuario', (rc.id_prueba = v_target_id_prueba or rc.id_alumno = v_target_id_alumno),
        'notas', rc.notas,
        'fuente', 'Supabase RPC v124'
      ) order by rc.posicion)
      from ranked_course rc
    ), '[]'::jsonb),
    'debug', jsonb_build_object(
      'login', v_login,
      'grado_detectado', v_target_grado,
      'sede_detectada', v_target_sede,
      'curso_detectado', v_target_grupo,
      'total_evaluados_grado', (select count(*) from ranked_grade),
      'total_evaluados_curso', (select count(*) from ranked_course),
      'warnings', case
        when (select count(*) from ranked_grade) <= 1 then jsonb_build_array('Solo hay un evaluado disponible para este grado en resultados.')
        else '[]'::jsonb
      end,
      'errors', case
        when (select count(*) from ranked_grade) = 0 then jsonb_build_array('No hay resultados cruzables entre estudiantes/resultados/claves para el grado.')
        else '[]'::jsonb
      end
    )
  ) into v_payload;

  return v_payload;
exception when others then
  return jsonb_build_object(
    'ok', false,
    'error', SQLERRM,
    'login', v_login
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.roque_get_student_ranking_context_v123(p_login text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_login text := btrim(coalesce(p_login, ''));
  v_target_id_prueba text;
  v_target_id_alumno text;
  v_target_apellidos text;
  v_target_nombres text;
  v_target_sede text;
  v_target_grado integer;
  v_target_grupo text;
  v_payload jsonb;
begin
 IF exists(select 1 from roque_private.inscripciones i
   join roque_private.medidas_estudiante m on m.edicion=i.edicion and m.id_prueba=i.id_prueba
   where i.activo and m.activo and i.edicion='2026-1S' and
   (lower(btrim(i.id_prueba))=lower(btrim(p_login))
     or lower(btrim(i.id_alumno))=lower(btrim(p_login)))) THEN
   RETURN jsonb_build_object('ok',false,'error',
    'Utiliza la consulta autorizada de resultados; el respaldo legado está deshabilitado para este examen.');
 END IF;
  if v_login = '' then
    return jsonb_build_object('ok', false, 'error', 'p_login vacío');
  end if;

  select
    btrim(coalesce(e.id_prueba, '')),
    btrim(coalesce(e.id_alumno, '')),
    coalesce(e.apellidos, ''),
    coalesce(e.nombres, ''),
    coalesce(e.sede, ''),
    e.grado,
    coalesce(e.grupo, '')
  into
    v_target_id_prueba,
    v_target_id_alumno,
    v_target_apellidos,
    v_target_nombres,
    v_target_sede,
    v_target_grado,
    v_target_grupo
  from public.estudiantes e
  where coalesce(e.activo, true)
    and (
      btrim(coalesce(e.id_prueba, '')) = v_login
      or btrim(coalesce(e.id_alumno, '')) = v_login
    )
  order by e.id_prueba
  limit 1;

  if v_target_id_prueba is null then
    return jsonb_build_object(
      'ok', false,
      'error', 'No se encontró estudiante activo para el ID enviado',
      'login', v_login
    );
  end if;

  with claves_canonicas as (
    select
      c.grado,
      c.numero_item,
      case
        when lower(translate(btrim(coalesce(c.area, '')), 'ÁÉÍÓÚÜÑáéíóúüñ', 'AEIOUUNaeiouun')) = 'matematicas' then 'Matemáticas'
        when lower(translate(btrim(coalesce(c.area, '')), 'ÁÉÍÓÚÜÑáéíóúüñ', 'AEIOUUNaeiouun')) like 'lenguaje%' then 'Lenguaje'
        when lower(translate(btrim(coalesce(c.area, '')), 'ÁÉÍÓÚÜÑáéíóúüñ', 'AEIOUUNaeiouun')) = 'ciencias naturales' then 'Ciencias Naturales'
        when lower(translate(btrim(coalesce(c.area, '')), 'ÁÉÍÓÚÜÑáéíóúüñ', 'AEIOUUNaeiouun')) = 'ciencias sociales y ciudadania' then 'Ciencias Sociales y Ciudadanía'
        when lower(translate(btrim(coalesce(c.area, '')), 'ÁÉÍÓÚÜÑáéíóúüñ', 'AEIOUUNaeiouun')) = 'ingles' then 'Inglés'
        else null
      end as area_canonica,
      substring(regexp_replace(upper(coalesce(c.respuesta_sugerida, '')), '[^A-H]', '', 'g') from 1 for 1) as respuesta_correcta
    from public.claves c
    where coalesce(c.activo, true)
      and c.grado = v_target_grado
  ),
  base as (
    select
      btrim(coalesce(e.id_prueba, '')) as id_prueba,
      btrim(coalesce(e.id_alumno, '')) as id_alumno,
      coalesce(e.apellidos, '') as apellidos,
      coalesce(e.nombres, '') as nombres,
      coalesce(e.sede, '') as sede,
      e.grado,
      coalesce(e.grupo, '') as curso,
      r.respuestas
    from public.estudiantes e
    join public.resultados r
      on btrim(coalesce(r.id_prueba, '')) = btrim(coalesce(e.id_prueba, ''))
     and coalesce(r.activo, true)
    where coalesce(e.activo, true)
      and e.grado = v_target_grado
  ),
  detalle as (
    select
      b.id_prueba,
      b.id_alumno,
      b.apellidos,
      b.nombres,
      b.sede,
      b.grado,
      b.curso,
      k.area_canonica,
      k.numero_item,
      regexp_replace(upper(coalesce(b.respuestas ->> k.numero_item::text, '')), '[^A-H]', '', 'g') as marcada,
      k.respuesta_correcta
    from base b
    join claves_canonicas k
      on k.grado = b.grado
     and k.area_canonica is not null
  ),
  area_stats as (
    select
      d.id_prueba,
      d.id_alumno,
      d.apellidos,
      d.nombres,
      d.sede,
      d.grado,
      d.curso,
      d.area_canonica,
      count(*)::int as total_items,
      sum(case when length(d.marcada) = 1 and d.marcada = d.respuesta_correcta then 1 else 0 end)::int as correctas,
      bool_or(d.marcada <> '') as intento
    from detalle d
    group by d.id_prueba, d.id_alumno, d.apellidos, d.nombres, d.sede, d.grado, d.curso, d.area_canonica
  ),
  area_scores as (
    select
      a.*,
      case
        when a.total_items <= 0 then null
        when not a.intento then 0
        else round(20 + ((a.correctas::numeric / a.total_items::numeric) * 80))::int
      end as puntaje_area
    from area_stats a
  ),
  pivoted as (
    select
      b.id_prueba,
      b.id_alumno,
      b.apellidos,
      b.nombres,
      b.sede,
      b.grado,
      b.curso,
      max(s.puntaje_area) filter (where s.area_canonica = 'Matemáticas') as matematicas,
      max(s.puntaje_area) filter (where s.area_canonica = 'Lenguaje') as lenguaje,
      max(s.puntaje_area) filter (where s.area_canonica = 'Ciencias Naturales') as naturales,
      max(s.puntaje_area) filter (where s.area_canonica = 'Ciencias Sociales y Ciudadanía') as sociales,
      max(s.puntaje_area) filter (where s.area_canonica = 'Inglés') as ingles,
      coalesce(sum(s.correctas), 0)::int as correctas_total
    from base b
    left join area_scores s
      on s.id_prueba = b.id_prueba
    group by b.id_prueba, b.id_alumno, b.apellidos, b.nombres, b.sede, b.grado, b.curso
  ),
  scored as (
    select
      p.*,
      case
        when p.matematicas is not null
         and p.lenguaje is not null
         and p.naturales is not null
         and p.sociales is not null
         and p.ingles is not null
        then round(((p.matematicas * 3 + p.lenguaje * 3 + p.naturales * 3 + p.sociales * 3 + p.ingles) * 5.0) / 13.0)::int
        else null
      end as puntaje_global,
      case
        when p.matematicas is null or p.lenguaje is null or p.naturales is null or p.sociales is null or p.ingles is null
        then 'Faltan una o más áreas principales para calcular puntaje global.'
        else ''
      end as notas
    from pivoted p
  ),
  ranked_grade as (
    select
      row_number() over (order by s.puntaje_global desc nulls last, s.correctas_total desc, s.apellidos asc, s.nombres asc, s.id_prueba asc)::int as posicion,
      count(*) over ()::int as total_grado,
      s.*
    from scored s
  ),
  ranked_course as (
    select
      row_number() over (order by s.puntaje_global desc nulls last, s.correctas_total desc, s.apellidos asc, s.nombres asc, s.id_prueba asc)::int as posicion,
      count(*) over ()::int as total_curso,
      s.*
    from scored s
    where lower(btrim(coalesce(s.sede, ''))) = lower(btrim(coalesce(v_target_sede, '')))
      and lower(regexp_replace(btrim(coalesce(s.curso, '')), '\s+', '', 'g')) = lower(regexp_replace(btrim(coalesce(v_target_grupo, '')), '\s+', '', 'g'))
  ),
  target_grade as (
    select * from ranked_grade rg
    where rg.id_prueba = v_target_id_prueba or rg.id_alumno = v_target_id_alumno
    limit 1
  ),
  target_course as (
    select * from ranked_course rc
    where rc.id_prueba = v_target_id_prueba or rc.id_alumno = v_target_id_alumno
    limit 1
  )
  select jsonb_build_object(
    'ok', true,
    'estudiante', jsonb_build_object(
      'id_prueba', v_target_id_prueba,
      'id_alumno', v_target_id_alumno,
      'apellidos', v_target_apellidos,
      'nombres', v_target_nombres,
      'nombre', btrim(v_target_nombres || ' ' || v_target_apellidos),
      'sede', v_target_sede,
      'grado', v_target_grado,
      'curso', v_target_grupo,
      'puntaje_global', (select tg.puntaje_global from target_grade tg)
    ),
    'ranking', jsonb_build_object(
      'puesto_grado', (select tg.posicion from target_grade tg),
      'total_grado', (select tg.total_grado from target_grade tg),
      'puesto_curso', (select tc.posicion from target_course tc),
      'total_curso', (select tc.total_curso from target_course tc),
      'puntaje_global', (select tg.puntaje_global from target_grade tg)
    ),
    'grado_rows', coalesce((
      select jsonb_agg(jsonb_build_object(
        'posicion', rg.posicion,
        'id_prueba', rg.id_prueba,
        'id_alumno', rg.id_alumno,
        'nombre', btrim(rg.nombres || ' ' || rg.apellidos),
        'sede', rg.sede,
        'grado', rg.grado,
        'curso', rg.curso,
        'matematicas', rg.matematicas,
        'lenguaje', rg.lenguaje,
        'naturales', rg.naturales,
        'sociales', rg.sociales,
        'ingles', rg.ingles,
        'puntaje_global', rg.puntaje_global,
        'puntaje_orden', rg.puntaje_global,
        'es_usuario', (rg.id_prueba = v_target_id_prueba or rg.id_alumno = v_target_id_alumno),
        'notas', rg.notas,
        'fuente', 'Supabase RPC v123'
      ) order by rg.posicion)
      from ranked_grade rg
    ), '[]'::jsonb),
    'curso_rows', coalesce((
      select jsonb_agg(jsonb_build_object(
        'posicion', rc.posicion,
        'id_prueba', rc.id_prueba,
        'id_alumno', rc.id_alumno,
        'nombre', btrim(rc.nombres || ' ' || rc.apellidos),
        'sede', rc.sede,
        'grado', rc.grado,
        'curso', rc.curso,
        'matematicas', rc.matematicas,
        'lenguaje', rc.lenguaje,
        'naturales', rc.naturales,
        'sociales', rc.sociales,
        'ingles', rc.ingles,
        'puntaje_global', rc.puntaje_global,
        'puntaje_orden', rc.puntaje_global,
        'es_usuario', (rc.id_prueba = v_target_id_prueba or rc.id_alumno = v_target_id_alumno),
        'notas', rc.notas,
        'fuente', 'Supabase RPC v123'
      ) order by rc.posicion)
      from ranked_course rc
    ), '[]'::jsonb),
    'debug', jsonb_build_object(
      'login', v_login,
      'grado_detectado', v_target_grado,
      'sede_detectada', v_target_sede,
      'curso_detectado', v_target_grupo,
      'total_evaluados_grado', (select count(*) from ranked_grade),
      'total_evaluados_curso', (select count(*) from ranked_course),
      'warnings', case
        when (select count(*) from ranked_grade) <= 1 then jsonb_build_array('Solo hay un evaluado disponible para este grado en resultados.')
        else '[]'::jsonb
      end,
      'errors', case
        when (select count(*) from ranked_grade) = 0 then jsonb_build_array('No hay resultados cruzables entre estudiantes/resultados/claves para el grado.')
        else '[]'::jsonb
      end
    )
  ) into v_payload;

  return v_payload;
exception when others then
  return jsonb_build_object(
    'ok', false,
    'error', SQLERRM,
    'login', v_login
  );
end;
$function$;

CREATE OR REPLACE FUNCTION roque_private.roque_historico_2573()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_i record; v_claves jsonb; v_ranking jsonb;
BEGIN
 IF roque_private.examen_restringido('2026-1S','2573') THEN
   RETURN jsonb_build_object('ok',false,'restringido',true,'error','Examen restringido.');
 END IF;
 IF NOT EXISTS (
   SELECT 1 FROM roque_private.portal_access_gate
   WHERE id=1 AND pause_students=true AND allowed_exam_id='2573'
     AND preview_edition='2026-2S'
 ) THEN RETURN pg_catalog.jsonb_build_object('ok',false,'error','Acceso no autorizado'); END IF;
 SELECT i.id_prueba,i.id_alumno,i.apellidos,i.nombres,i.sede,i.grado,i.grupo,r.respuestas
 INTO v_i FROM roque_private.inscripciones i JOIN roque_private.resultados r
  ON r.edicion=i.edicion AND r.id_prueba=i.id_prueba
 WHERE i.edicion='2026-1S' AND i.id_prueba='2573' AND i.activo AND r.activo LIMIT 1;
 IF NOT FOUND THEN
   RETURN pg_catalog.jsonb_build_object('ok',false,'error','Informe histórico no disponible');
 END IF;
 SELECT coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
   'Grado',k.grado::text,'Área',k.area,'Número de ítem',k.numero_item::text,
   'Respuesta sugerida',k.respuesta_correcta,
   'Componente / pensamiento / entorno / factor / enfoque',coalesce(k.componente,''),
   'Competencia',coalesce(k.competencia,'')
 ) ORDER BY k.numero_item),'[]'::jsonb)
 INTO v_claves FROM roque_private.items k
 WHERE k.edicion='2026-1S' AND k.grado=v_i.grado AND k.activo
   AND NOT k.anulada AND k.respuesta_correcta IS NOT NULL;
 v_ranking:=roque_private.ranking_calculo_por_edicion('2573','2026-1S');
 RETURN pg_catalog.jsonb_build_object(
   'ok',true,'edicion','2026-1S','origen_academico','historico_2573_autorizado',
   'session',pg_catalog.jsonb_build_object('role','student','roll','2573'),
   'datasets',pg_catalog.jsonb_build_object(
     'estudiantes',pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
       'ID_ALUMNO',v_i.id_alumno,'ID_PRUEBA',v_i.id_prueba,
       'APELLIDOS',coalesce(v_i.apellidos,''),'NOMBRES',coalesce(v_i.nombres,''),
       'NOMBRE_COMPLETO',pg_catalog.btrim(coalesce(v_i.nombres,'')||' '||coalesce(v_i.apellidos,'')),
       'SEDE',coalesce(v_i.sede,''),'GRADO',v_i.grado::text,
       'GRUPO',coalesce(v_i.grupo,''),
       'PUNTAJE_GLOBAL',v_ranking->'ranking'->>'puntaje_global',
       'PUESTO_GRADO',v_ranking->'ranking'->>'puesto_grado',
       'TOTAL_GRADO',v_ranking->'ranking'->>'total_grado',
       'PUESTO_CURSO',v_ranking->'ranking'->>'puesto_curso',
       'TOTAL_CURSO',v_ranking->'ranking'->>'total_curso'
     )),
     'keys',pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
       'grade',v_i.grado,'path','SUPABASE/2026-1S/KEYS_'||v_i.grado||'.json',
       'rows',v_claves)),
     'resultados',pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
       'grade',v_i.grado,'session',0,'startItem',1,
       'path','SUPABASE/2026-1S/RESULTADOS_'||v_i.grado||'.json',
       'rows',pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
         'Roll No','2573','respuestas',roque_private.mascara_respuestas_medidas(
 '2026-1S','2573',v_i.grado,v_i.respuestas))))),
     'carga','[]'::jsonb,'docentes','[]'::jsonb,'directoresGrupo','[]'::jsonb,
 'medidas',jsonb_build_array(roque_private.resumen_medidas('2026-1S','2573',v_i.grado))
   )
 );
END $function$;

CREATE OR REPLACE FUNCTION public.roque_v4_login_original_2026_2s(p_user text, p_password text DEFAULT ''::text, p_terminal uuid DEFAULT NULL::uuid, p_device text DEFAULT NULL::text, p_mode text DEFAULT NULL::text)
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
     'respuestas',roque_private.mascara_respuestas_medidas(ed,r.id_prueba,i.grado,r.respuestas)) ORDER BY r.id_prueba) filas
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
  'estudiantes',ins,'keys',keys_new,'resultados',results_new,
   'medidas',(SELECT coalesce(jsonb_agg(roque_private.resumen_medidas(
     ed,(j.x->>'ID_PRUEBA'),coalesce(nullif(j.x->>'GRADO','')::int,0))),'[]'::jsonb)
       FROM jsonb_array_elements(ins) j(x))),true)
  || jsonb_build_object('origen_academico','roque_private','edicion',ed);
END $function$;
