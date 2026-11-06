-- RoqueObjetiva v175.57. Estadísticas institucionales: niveles Superior / Alto / Básico / Bajo.
-- Función desplegada en Supabase, restringida por sesión Admin / Coordinador.

CREATE OR REPLACE FUNCTION public.roque_v10_estadisticas_institucionales(p_edicion text DEFAULT '2026-2S'::text, p_grado integer DEFAULT NULL::integer, p_curso text DEFAULT NULL::text, p_asignatura text DEFAULT NULL::text, p_docente text DEFAULT NULL::text, p_sesion text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
 v_admin boolean := false;
 v_coord boolean := false;
 v_result jsonb;
BEGIN
 v_admin := auth.uid() IS NOT NULL AND EXISTS(
   SELECT 1 FROM roque_private.operadores_admin x
   WHERE x.user_id=auth.uid() AND x.activo IS TRUE
 );
 IF NOT v_admin THEN
   v_coord := roque_private.validar_coordinador_sesion(p_docente,p_sesion);
 END IF;
 IF NOT v_admin AND NOT v_coord THEN
   RAISE EXCEPTION 'Acceso a estadísticas no autorizado' USING ERRCODE='42501';
 END IF;
 IF NOT EXISTS(SELECT 1 FROM roque_private.ediciones e WHERE e.codigo=p_edicion) THEN
   RAISE EXCEPTION 'Edición inexistente' USING ERRCODE='22023';
 END IF;
 IF p_grado IS NOT NULL AND (p_grado<1 OR p_grado>11) THEN
   RAISE EXCEPTION 'Grado inválido' USING ERRCODE='22023';
 END IF;
 IF length(coalesce(p_curso,''))>50 OR length(coalesce(p_asignatura,''))>120 THEN
   RAISE EXCEPTION 'Filtros inválidos' USING ERRCODE='22023';
 END IF;

 WITH
 i AS MATERIALIZED (
   SELECT x.id_prueba,x.grado,x.grupo,x.sede
   FROM roque_private.inscripciones x
   WHERE x.edicion=p_edicion AND x.activo IS TRUE
     AND (p_grado IS NULL OR x.grado=p_grado)
     AND (p_curso IS NULL OR p_curso='' OR x.grupo=p_curso)
 ),
 keys AS MATERIALIZED (
   SELECT k.grado,k.numero_item,upper(btrim(k.respuesta_correcta)) correct,
     CASE
      WHEN lower(k.area) LIKE 'lenguaje%' THEN 'Lenguaje'
      WHEN lower(k.area) LIKE 'matem%' THEN 'Matemáticas'
      WHEN lower(k.area) LIKE 'ingl%' THEN 'Inglés'
      WHEN lower(k.area) LIKE 'ciencias naturales%' THEN 'Ciencias Naturales'
      WHEN lower(k.area) LIKE 'ciencias sociales%' THEN 'Ciencias Sociales y Ciudadanía'
      WHEN lower(k.area) LIKE 'educaci%n f%sica%' THEN 'Educación Física'
      WHEN lower(k.area) LIKE 'inform%' THEN 'Informática'
      WHEN lower(k.area) LIKE '%relig%' THEN 'Religión'
      WHEN lower(k.area) LIKE '%art%stica%' THEN 'Artística'
      WHEN lower(k.area) LIKE '%tica y valores%' THEN 'Ética y Valores'
      ELSE initcap(btrim(k.area))
     END area,
     nullif(btrim(coalesce(k.componente,'')),'') componente
   FROM roque_private.items k
   WHERE k.edicion=p_edicion AND k.activo IS TRUE AND k.anulada IS NOT TRUE
     AND nullif(btrim(coalesce(k.respuesta_correcta,'')),'') IS NOT NULL
     AND upper(btrim(k.respuesta_correcta)) NOT IN ('ANULADA','ANULADO','X','-')
     AND (p_grado IS NULL OR k.grado=p_grado)
 ),
 all_ed AS (
   SELECT coalesce(jsonb_agg(e.codigo ORDER BY e.anio DESC,e.semestre DESC),'[]'::jsonb) val
   FROM roque_private.ediciones e
 ),
 all_grades AS (
   SELECT coalesce(jsonb_agg(g.grado ORDER BY g.grado),'[]'::jsonb) val
   FROM (
     SELECT DISTINCT k.grado FROM roque_private.items k WHERE k.edicion=p_edicion AND k.activo
     UNION
     SELECT DISTINCT x.grado FROM roque_private.inscripciones x WHERE x.edicion=p_edicion AND x.activo
   )g
 ),
 all_courses AS (
   SELECT coalesce(jsonb_agg(jsonb_build_object('grado',c.grado,'curso',c.grupo,'sede',c.sede)
       ORDER BY c.grado,c.grupo,c.sede),'[]'::jsonb) val
   FROM (
     SELECT DISTINCT x.grado,x.grupo,x.sede
     FROM roque_private.inscripciones x
     WHERE x.edicion=p_edicion AND x.activo AND (p_grado IS NULL OR x.grado=p_grado)
   ) c
 ),
 all_subjects AS (
   SELECT coalesce(jsonb_agg(q.area ORDER BY q.area),'[]'::jsonb) val
   FROM (SELECT DISTINCT k.area FROM keys k)q
 ),
 registered AS (SELECT count(*)::integer n FROM i),
 results AS MATERIALIZED (
   SELECT i.id_prueba,i.grado,i.grupo,r.respuestas
   FROM i JOIN roque_private.resultados r
   ON r.edicion=p_edicion AND r.id_prueba=i.id_prueba AND r.activo IS TRUE
 ),
 evaluated AS (SELECT count(*)::integer n FROM results),
 marked AS MATERIALIZED (
   SELECT r.id_prueba,r.grado,r.grupo,k.area,k.componente,
     nullif(upper(btrim(coalesce(r.respuestas->>k.numero_item::text,''))),'') marked,
     (upper(btrim(coalesce(r.respuestas->>k.numero_item::text,'')))=k.correct)::integer hit
   FROM results r JOIN keys k ON k.grado=r.grado
 ),
 per_subject AS MATERIALIZED (
   SELECT id_prueba,grado,grupo,area,
     round(20+80.0*sum(hit)::numeric/nullif(count(*),0),2) score
   FROM marked
   GROUP BY id_prueba,grado,grupo,area
   HAVING count(*) FILTER(WHERE marked IS NOT NULL)>0
 ),
 subject_scores AS MATERIALIZED (
   SELECT * FROM per_subject
   WHERE p_asignatura IS NULL OR p_asignatura='' OR area=p_asignatura
 ),
 per_student AS MATERIALIZED (
   SELECT id_prueba,round(avg(score),2) score
   FROM subject_scores GROUP BY id_prueba
 ),
 kpis AS (
   SELECT round(avg(score),1) average,
     count(*)::integer scored,
     round(100.0*count(*) FILTER(WHERE score>=60)/nullif(count(*),0),1) satisfactory
   FROM per_student
 ),
 distribution AS (
   SELECT coalesce(jsonb_agg(jsonb_build_object('id',x.id,'nombre',x.label,'cantidad',x.n,'porcentaje',
       CASE WHEN (SELECT count(*) FROM per_student)>0
         THEN round(100.0*x.n/(SELECT count(*) FROM per_student),1) ELSE 0 END)
       ORDER BY x.order_id),'[]'::jsonb) val
   FROM (
     SELECT 1 order_id,'superior' id,'Superior (≥ 90)' label,count(*) FILTER(WHERE score>=90) n FROM per_student
     UNION ALL SELECT 2,'alto','Alto (80 – 89)',count(*) FILTER(WHERE score>=80 AND score<90) FROM per_student
     UNION ALL SELECT 3,'basico','Básico (60 – 79)',count(*) FILTER(WHERE score>=60 AND score<80) FROM per_student
     UNION ALL SELECT 4,'bajo','Bajo (< 60)',count(*) FILTER(WHERE score<60) FROM per_student
   )x
 ),
 by_subject AS (
   SELECT coalesce(jsonb_agg(jsonb_build_object('asignatura',x.area,'promedio',x.score,'evaluados',x.n)
      ORDER BY x.area),'[]'::jsonb) val
   FROM (SELECT area,round(avg(score),1) score,count(*) n FROM subject_scores GROUP BY area)x
 ),
 by_course AS (
   SELECT coalesce(jsonb_agg(jsonb_build_object('asignatura',x.area,'curso',x.grupo,'promedio',x.score,'evaluados',x.n)
      ORDER BY x.area,x.grupo),'[]'::jsonb) val
   FROM (SELECT area,grupo,round(avg(score),1) score,count(*) n
      FROM subject_scores GROUP BY area,grupo)x
 ),
 per_component AS MATERIALIZED (
   SELECT id_prueba,area,componente,
     round(100.0*sum(hit)::numeric/nullif(count(*),0),2) score
   FROM marked
   WHERE componente IS NOT NULL AND (p_asignatura IS NULL OR p_asignatura='' OR area=p_asignatura)
   GROUP BY id_prueba,area,componente
   HAVING count(*) FILTER(WHERE marked IS NOT NULL)>0
 ),
 components AS (
   SELECT coalesce(jsonb_agg(jsonb_build_object('nombre',x.componente,'promedio',x.score,'evaluados',x.n)
    ORDER BY x.componente),'[]'::jsonb) val
   FROM (SELECT componente,round(avg(score),1) score,count(*) n
     FROM per_component
     WHERE p_asignatura IS NOT NULL AND p_asignatura<>'' 
     GROUP BY componente)x
 )
 SELECT jsonb_build_object(
   'ok',true,'edicion',p_edicion,'ediciones',(SELECT val FROM all_ed),
   'grados',(SELECT val FROM all_grades),'cursos',(SELECT val FROM all_courses),
   'asignaturas',(SELECT val FROM all_subjects),
   'inscritos',(SELECT n FROM registered),'resultados',(SELECT n FROM evaluated),
   'evaluados',(SELECT scored FROM kpis),
   'promedio',(SELECT average FROM kpis),
   'satisfactorio',(SELECT satisfactory FROM kpis),
   'distribucion',(SELECT val FROM distribution),
   'asignaturas_promedio',(SELECT val FROM by_subject),
   'cursos_promedio',(SELECT val FROM by_course),
   'componentes',(SELECT val FROM components),
   'escala','Nota por asignatura: 20+80×(aciertos/ítems válidos). Componentes: % de aciertos.'
 ) INTO v_result;
 RETURN v_result;
END $function$;

REVOKE ALL ON FUNCTION public.roque_v10_estadisticas_institucionales(text,integer,text,text,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.roque_v10_estadisticas_institucionales(text,integer,text,text,text,text) TO authenticated, anon;
