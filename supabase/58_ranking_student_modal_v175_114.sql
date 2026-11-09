-- v175.114 · Solo añade id_alumno a cada fila de Ranking institucional.
-- No cambia cálculos, filtros ni permisos. Permite usar Consulta estudiante como modal.

CREATE OR REPLACE FUNCTION public.roque_v20_ranking_institucional(p_edicion text DEFAULT '2026-2S'::text, p_sede text DEFAULT NULL::text, p_grado integer DEFAULT NULL::integer, p_curso text DEFAULT NULL::text, p_busqueda text DEFAULT NULL::text, p_pagina integer DEFAULT 1, p_limite integer DEFAULT 15, p_docente text DEFAULT NULL::text, p_sesion text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_admin boolean;
  v_coordinador boolean;
  v_respuesta jsonb;
  v_needle text := lower(btrim(coalesce(p_busqueda,'')));
BEGIN
  -- La conexión anónima únicamente accede con un token de coordinación vigente.
  v_admin := auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 FROM roque_private.operadores_admin o
    WHERE o.user_id=auth.uid() AND o.activo
  );
  v_coordinador := NOT v_admin AND
    roque_private.validar_coordinador_sesion(p_docente,p_sesion);
  IF NOT (v_admin OR v_coordinador) THEN
    RAISE EXCEPTION 'Acceso a Ranking institucional no autorizado.'
      USING ERRCODE='42501';
  END IF;
  IF p_edicion IS NULL OR NOT EXISTS (
    SELECT 1 FROM roque_private.ediciones ed
    WHERE ed.codigo=p_edicion AND ed.resultados_visibles
      AND ed.estado IN ('publicada','cerrada')
  ) THEN
    RAISE EXCEPTION 'La edición no tiene resultados publicados.'
      USING ERRCODE='22023';
  END IF;
  IF p_grado IS NOT NULL AND p_grado NOT BETWEEN 5 AND 11
     OR p_pagina IS NULL OR p_pagina NOT BETWEEN 1 AND 1000
     OR p_limite IS NULL OR p_limite NOT BETWEEN 1 AND 50
     OR length(coalesce(p_sede,''))>120
     OR length(coalesce(p_curso,''))>60
     OR length(coalesce(p_busqueda,''))>100 THEN
    RAISE EXCEPTION 'Filtros del ranking inválidos.' USING ERRCODE='22023';
  END IF;

  WITH
  roster AS MATERIALIZED (
    SELECT i.id_prueba,i.nombres,i.apellidos,i.sede,i.grado,i.grupo
    FROM roque_private.inscripciones i
    WHERE i.edicion=p_edicion AND i.activo
  ),
  sedes AS (
    SELECT coalesce(jsonb_agg(x.sede ORDER BY x.sede),'[]'::jsonb) listado
    FROM (SELECT DISTINCT sede FROM roster
      WHERE nullif(btrim(coalesce(sede,'')),'') IS NOT NULL) x
  ),
  grados AS (
    SELECT coalesce(jsonb_agg(x.grado ORDER BY x.grado),'[]'::jsonb) listado
    FROM (SELECT DISTINCT grado FROM roster WHERE grado BETWEEN 5 AND 11) x
  ),
  cursos AS (
    SELECT coalesce(jsonb_agg(jsonb_build_object(
      'grado',x.grado,'sede',x.sede,'curso',x.grupo)
      ORDER BY x.grado,x.sede,x.grupo),'[]'::jsonb) listado
    FROM (
      SELECT DISTINCT grado,sede,grupo FROM roster
      WHERE nullif(btrim(coalesce(grupo,'')),'') IS NOT NULL
        AND (p_grado IS NULL OR grado=p_grado)
        AND (nullif(btrim(coalesce(p_sede,'')),'') IS NULL OR lower(sede)=lower(btrim(p_sede)))
    ) x
  ),
  valid_keys AS MATERIALIZED (
    SELECT k.grado,k.numero_item,upper(btrim(k.respuesta_correcta)) correcta,
      CASE
        WHEN lower(translate(btrim(k.area),'ÁÉÍÓÚÜÑáéíóúüñ','AEIOUUNaeiouun'))='matematicas'
          THEN 'Matemáticas'
        WHEN lower(translate(btrim(k.area),'ÁÉÍÓÚÜÑáéíóúüñ','AEIOUUNaeiouun')) LIKE 'lenguaje%'
          THEN 'Lenguaje'
        WHEN lower(translate(btrim(k.area),'ÁÉÍÓÚÜÑáéíóúüñ','AEIOUUNaeiouun'))='ciencias naturales'
          THEN 'Ciencias Naturales'
        WHEN lower(translate(btrim(k.area),'ÁÉÍÓÚÜÑáéíóúüñ','AEIOUUNaeiouun'))='ciencias sociales y ciudadania'
          THEN 'Ciencias Sociales y Ciudadanía'
        WHEN lower(translate(btrim(k.area),'ÁÉÍÓÚÜÑáéíóúüñ','AEIOUUNaeiouun'))='ingles'
          THEN 'Inglés'
        ELSE NULL
      END area
    FROM roque_private.items k
    WHERE k.edicion=p_edicion AND k.activo
      AND k.anulada IS NOT TRUE
      AND upper(btrim(coalesce(k.respuesta_correcta,''))) ~ '^[A-H]$'
      AND (p_grado IS NULL OR k.grado=p_grado)
  ),
  eligible AS MATERIALIZED (
    SELECT i.*,r.respuestas
    FROM roster i
    JOIN roque_private.resultados r
      ON r.edicion=p_edicion AND r.id_prueba=i.id_prueba AND r.activo
    WHERE NOT roque_private.examen_restringido(p_edicion,i.id_prueba)
      AND (p_grado IS NULL OR i.grado=p_grado)
      AND (nullif(btrim(coalesce(p_sede,'')),'') IS NULL
        OR lower(i.sede)=lower(btrim(p_sede)))
      AND (nullif(btrim(coalesce(p_curso,'')),'') IS NULL
        OR lower(i.grupo)=lower(btrim(p_curso)))
  ),
  detail AS MATERIALIZED (
    SELECT e.id_prueba,e.grado,k.area,
      regexp_replace(upper(coalesce(e.respuestas->>k.numero_item::text,'')),
        '[^A-H]','','g') marcada,k.correcta
    FROM eligible e JOIN valid_keys k
      ON k.grado=e.grado AND k.area IS NOT NULL
  ),
  per_area AS MATERIALIZED (
    SELECT d.id_prueba,d.grado,d.area,
      count(*)::integer total,
      count(*) FILTER (WHERE length(d.marcada)=1 AND d.marcada=d.correcta)::integer aciertos,
      bool_or(d.marcada<>'') intento
    FROM detail d
    GROUP BY d.id_prueba,d.grado,d.area
  ),
  measured AS MATERIALIZED (
    SELECT a.*,roque_private.estado_area_medida(
      p_edicion,a.id_prueba,a.area,a.grado) estado
    FROM per_area a
  ),
  scores AS MATERIALIZED (
    SELECT m.id_prueba,m.area,
      CASE WHEN m.estado<>'normal' THEN 20
           WHEN m.total=0 THEN NULL
           WHEN NOT m.intento THEN 0
           ELSE round(20 + 80.0*m.aciertos/m.total)::integer
      END puntaje,
      CASE WHEN m.estado='normal' THEN m.aciertos ELSE 0 END validas
    FROM measured m
  ),
  pivot AS MATERIALIZED (
    SELECT e.id_prueba,
      max(s.puntaje) FILTER (WHERE s.area='Matemáticas') matematicas,
      max(s.puntaje) FILTER (WHERE s.area='Lenguaje') lenguaje,
      max(s.puntaje) FILTER (WHERE s.area='Ciencias Naturales') naturales,
      max(s.puntaje) FILTER (WHERE s.area='Ciencias Sociales y Ciudadanía') sociales,
      max(s.puntaje) FILTER (WHERE s.area='Inglés') ingles,
      coalesce(sum(s.validas),0)::integer correctas
    FROM eligible e LEFT JOIN scores s ON s.id_prueba=e.id_prueba
    GROUP BY e.id_prueba
  ),
  scored AS MATERIALIZED (
    SELECT e.id_prueba,e.nombres,e.apellidos,e.sede,e.grado,e.grupo,
      round(((p.matematicas*3 + p.lenguaje*3 + p.naturales*3 +
        p.sociales*3 + p.ingles)*5.0)/13.0)::integer puntaje_global,
      p.correctas
    FROM eligible e JOIN pivot p ON p.id_prueba=e.id_prueba
    WHERE p.matematicas IS NOT NULL AND p.lenguaje IS NOT NULL
      AND p.naturales IS NOT NULL AND p.sociales IS NOT NULL
      AND p.ingles IS NOT NULL
  ),
  ranked AS MATERIALIZED (
    SELECT s.*,
      rank() OVER (ORDER BY s.puntaje_global DESC)::integer posicion,
      row_number() OVER (ORDER BY s.puntaje_global DESC,s.correctas DESC,
        s.apellidos COLLATE "C",s.nombres COLLATE "C",s.id_prueba)::integer orden
    FROM scored s
  ),
  searched AS MATERIALIZED (
    SELECT * FROM ranked z
    WHERE v_needle='' OR
      position(v_needle IN lower(coalesce(z.nombres,'')||' '||coalesce(z.apellidos,'')))>0
      OR position(v_needle IN lower(coalesce(z.apellidos,'')||' '||coalesce(z.nombres,'')))>0
      OR position(v_needle IN lower(z.id_prueba))>0
  )
  SELECT jsonb_build_object(
    'ok',true,
    'edicion',p_edicion,
    'filtros',jsonb_build_object('sedes',(SELECT listado FROM sedes),
      'grados',(SELECT listado FROM grados),
      'cursos',(SELECT listado FROM cursos)),
    'total_estudiantes',(SELECT count(*)::integer FROM ranked),
    'promedio_global',(SELECT round(avg(puntaje_global),1) FROM ranked),
    'puntaje_maximo',(SELECT max(puntaje_global) FROM ranked),
    'total_coincidencias',(SELECT count(*)::integer FROM searched),
    'pagina',p_pagina,'limite',p_limite,
    'total_paginas',(SELECT ceil(count(*)::numeric/p_limite)::integer FROM searched),
    'filas',coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'posicion',t.posicion,'id_prueba',t.id_prueba,
        'id_alumno',(SELECT i.id_alumno FROM roque_private.inscripciones i
          WHERE i.edicion=p_edicion AND i.id_prueba=t.id_prueba AND i.activo),
        'nombre',btrim(coalesce(t.nombres,'')||' '||coalesce(t.apellidos,'')),
        'grado',t.grado,'curso',t.grupo,'sede',t.sede,
        'puntaje_global',t.puntaje_global)
        ORDER BY t.orden)
      FROM (SELECT * FROM searched ORDER BY orden
        LIMIT p_limite OFFSET (p_pagina-1)*p_limite) t
    ),'[]'::jsonb)
  ) INTO v_respuesta;
  RETURN v_respuesta;
END
$function$;
