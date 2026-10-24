-- RoqueObjetiva v168 · Resumen de cargas IA, solo administradores autorizados.
CREATE OR REPLACE FUNCTION public.roque_v3_admin_resumen_cargas_ia(p_edicion text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $func$
DECLARE v_result jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
     SELECT 1 FROM roque_private.operadores_admin o
     WHERE o.user_id=auth.uid() AND o.activo
  ) THEN
    RAISE EXCEPTION 'Acceso administrativo no autorizado.' USING ERRCODE='42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM roque_private.ediciones WHERE codigo=p_edicion) THEN
    RAISE EXCEPTION 'Edición inexistente.' USING ERRCODE='22023';
  END IF;
  SELECT jsonb_build_object(
      'lotes',count(*),
      'filas_agregadas',coalesce(sum(insertadas),0),
      'por_tipo',jsonb_build_object(
        'claves',count(*) FILTER (WHERE tipo='claves'),
        'inscripciones',count(*) FILTER (WHERE tipo='inscripciones'),
        'resultados',count(*) FILTER (WHERE tipo='resultados')),
      'ultimo_cargue',max(realizado_en),
      'recientes',coalesce(
        (SELECT jsonb_agg(jsonb_build_object(
           'tipo',x.tipo,'insertadas',x.insertadas,
           'identicas',x.identicas,'fecha',x.realizado_en)
         ORDER BY x.realizado_en DESC)
         FROM (SELECT tipo,insertadas,identicas,realizado_en
               FROM roque_private.cargas_ia
               WHERE edicion=p_edicion
               ORDER BY realizado_en DESC, id DESC LIMIT 8) x), '[]'::jsonb)
    ) INTO v_result
  FROM roque_private.cargas_ia
  WHERE edicion=p_edicion;
  RETURN v_result;
END;
$func$;
REVOKE ALL ON FUNCTION public.roque_v3_admin_resumen_cargas_ia(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.roque_v3_admin_resumen_cargas_ia(text) TO authenticated;
