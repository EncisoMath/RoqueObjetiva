-- RoqueObjetiva v124
-- RPC para calcular ranking real del estudiante desde Supabase.
-- Ejecutar en Supabase > SQL Editor antes de usar la v124.
-- No usa cache ni tablas temporales persistentes: todo se calcula en CTEs en memoria.

create or replace function public.roque_get_student_ranking_context_v124(
  p_login text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
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
$$;

grant execute on function public.roque_get_student_ranking_context_v124(text) to anon, authenticated;

-- Alias opcional para que versiones futuras puedan llamar un nombre estable.
create or replace function public.roque_get_student_ranking_context(
  p_login text
)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select public.roque_get_student_ranking_context_v124(p_login);
$$;

grant execute on function public.roque_get_student_ranking_context(text) to anon, authenticated;
