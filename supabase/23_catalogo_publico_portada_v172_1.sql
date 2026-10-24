-- RoqueObjetiva v172.1: catálogo público MINIMO (sin estudiantes, claves ni respuestas).
-- El servidor decide qué semestre está publicado; nunca confiar en el estado del frontend.
CREATE OR REPLACE FUNCTION public.roque_v5_portada_ediciones()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT pg_catalog.jsonb_build_object(
    'ok',true,
    'ediciones',coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'codigo',e.codigo,'titulo',e.titulo,'anio',e.anio,'semestre',e.semestre,
      'estado',e.estado,'resultados_visibles',e.resultados_visibles
    ) ORDER BY e.anio DESC,e.semestre DESC),'[]'::jsonb)
  )
  FROM roque_private.ediciones AS e
$$;
REVOKE ALL ON FUNCTION public.roque_v5_portada_ediciones() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.roque_v5_portada_ediciones() TO anon,authenticated;
