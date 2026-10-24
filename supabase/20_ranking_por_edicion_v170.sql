-- RoqueObjetiva v170: ranking compatible por edición, sin difundir rankings ajenos.
CREATE OR REPLACE FUNCTION roque_private.ranking_calculo_por_edicion(p_login text,p_edicion text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY INVOKER
 SET search_path TO ''
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
  if v_login = '' then
    return jsonb_build_object('ok', false, 'error', 'p_login vacío');
  end if;
  IF p_edicion IS NULL OR NOT EXISTS (
    SELECT 1 FROM roque_private.ediciones
    WHERE codigo=p_edicion AND resultados_visibles
      AND estado IN ('publicada','cerrada')
  ) THEN
    RETURN jsonb_build_object('ok',false,'error','Edición no publicada');
  END IF;

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
  from roque_private.inscripciones e
  where e.edicion = p_edicion AND coalesce(e.activo,true)
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
      substring(regexp_replace(upper(coalesce(c.respuesta_correcta, '')), '[^A-H]', '', 'g') from 1 for 1) as respuesta_correcta
    from roque_private.items c
    where c.edicion = p_edicion AND NOT c.anulada AND coalesce(c.activo,true)
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
    from roque_private.inscripciones e
    join roque_private.resultados r
      on r.edicion=e.edicion AND btrim(coalesce(r.id_prueba, '')) = btrim(coalesce(e.id_prueba, ''))
     and coalesce(r.activo, true)
    where e.edicion = p_edicion AND coalesce(e.activo,true)
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
        'fuente', 'roque_private v170'
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
        'fuente', 'roque_private v170'
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

CREATE OR REPLACE FUNCTION public.roque_v3_ranking_controlado_edicion(
 p_login text, p_terminal uuid, p_edicion text DEFAULT '2026-1S'
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $wrap$
DECLARE
 v_hash text;
 v_exam text;
 v_payload jsonb;
 v_grado jsonb;
 v_curso jsonb;
 v_rank_areas jsonb;
BEGIN
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
END $wrap$;
REVOKE ALL ON FUNCTION roque_private.ranking_calculo_por_edicion(text,text)
  FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.roque_v3_ranking_controlado_edicion(text,uuid,text)
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.roque_v3_ranking_controlado_edicion(text,uuid,text)
  TO anon,authenticated;
