-- Etapa 3 · RoqueObjetiva v167
-- Diagnóstico de cargue por IA; SOLO LECTURA. No importa, publica ni altera resultados.
-- Ejecutable exclusivamente por cuentas Supabase Auth presentes en operadores_admin.
CREATE OR REPLACE FUNCTION public.roque_v3_admin_preflight_edicion(p_edicion text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_ed roque_private.ediciones%ROWTYPE;
  v_grados integer;
  v_areas integer;
  v_sesiones integer;
  v_items integer;
  v_items_activos integer;
  v_claves integer;
  v_claves_pendientes integer;
  v_diferencias_areas integer;
  v_inscripciones integer;
  v_resultados integer;
  v_presentaciones integer;
  v_resultados_sin_inscripcion integer;
  v_por_grado jsonb;
  v_bloqueos jsonb;
  v_listo boolean;
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM roque_private.operadores_admin o
    WHERE o.user_id = auth.uid() AND o.activo
  ) THEN
    RAISE EXCEPTION 'Acceso administrativo no autorizado.'
      USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_ed FROM roque_private.ediciones
  WHERE codigo = p_edicion;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Edición inexistente.' USING ERRCODE = '22023';
  END IF;

  SELECT count(*) INTO v_grados FROM roque_private.grados
  WHERE edicion = p_edicion AND activo;
  SELECT count(*) INTO v_areas FROM roque_private.areas
  WHERE edicion = p_edicion AND activo;
  SELECT count(*) INTO v_sesiones FROM roque_private.sesiones
  WHERE edicion = p_edicion;
  SELECT count(*), count(*) FILTER (WHERE activo),
         count(*) FILTER (WHERE respuesta_correcta IS NOT NULL),
         count(*) FILTER (WHERE activo AND NOT anulada AND respuesta_correcta IS NULL)
  INTO v_items, v_items_activos, v_claves, v_claves_pendientes
  FROM roque_private.items WHERE edicion = p_edicion;

  SELECT count(*) INTO v_diferencias_areas
  FROM roque_private.areas a
  WHERE a.edicion = p_edicion AND a.activo
    AND a.cantidad_preguntas <> (
      SELECT count(*) FROM roque_private.items i
      WHERE i.edicion = a.edicion AND i.grado = a.grado AND i.area = a.area
    );

  SELECT count(*) INTO v_inscripciones
  FROM roque_private.inscripciones WHERE edicion = p_edicion AND activo;
  SELECT count(*) INTO v_resultados
  FROM roque_private.resultados WHERE edicion = p_edicion AND activo;
  SELECT count(*) INTO v_presentaciones
  FROM roque_private.presentaciones WHERE edicion = p_edicion;
  SELECT count(*) INTO v_resultados_sin_inscripcion
  FROM roque_private.resultados r
  WHERE r.edicion = p_edicion AND r.activo
    AND NOT EXISTS (
      SELECT 1 FROM roque_private.inscripciones i
      WHERE i.edicion = r.edicion AND i.id_prueba = r.id_prueba
    );

  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'grado', g.grado,
    'areas', (SELECT count(*) FROM roque_private.areas a
              WHERE a.edicion = g.edicion AND a.grado = g.grado AND a.activo),
    'preguntas', (SELECT count(*) FROM roque_private.items i
                  WHERE i.edicion = g.edicion AND i.grado = g.grado),
    'claves_pendientes', (SELECT count(*) FROM roque_private.items i
                         WHERE i.edicion = g.edicion AND i.grado = g.grado
                           AND i.activo AND NOT i.anulada AND i.respuesta_correcta IS NULL),
    'inscripciones', (SELECT count(*) FROM roque_private.inscripciones n
                      WHERE n.edicion = g.edicion AND n.grado = g.grado AND n.activo)
  ) ORDER BY g.grado), '[]'::jsonb)
  INTO v_por_grado
  FROM roque_private.grados g
  WHERE g.edicion = p_edicion AND g.activo;

  SELECT coalesce(jsonb_agg(mensaje), '[]'::jsonb)
  INTO v_bloqueos
  FROM (VALUES
    (CASE WHEN v_ed.estado <> 'borrador' THEN
       'La edición no está en borrador; no se admite un nuevo cargue.' END),
    (CASE WHEN v_ed.resultados_visibles THEN
       'La edición tiene resultados visibles; no se debe sobrescribir.' END),
    (CASE WHEN v_grados = 0 OR v_areas = 0 OR v_items_activos = 0 THEN
       'La estructura de grados, áreas o preguntas está incompleta.' END),
    (CASE WHEN v_diferencias_areas > 0 THEN
       'Hay áreas cuya cantidad de preguntas no coincide con los ítems.' END),
    (CASE WHEN v_claves_pendientes > 0 THEN
       'Hay preguntas activas sin clave de respuesta.' END),
    (CASE WHEN v_inscripciones = 0 THEN
       'Faltan las inscripciones de estudiantes de esta edición.' END),
    (CASE WHEN v_resultados = 0 THEN
       'Faltan resultados de exámenes de esta edición.' END),
    (CASE WHEN v_resultados_sin_inscripcion > 0 THEN
       'Hay resultados sin inscripción en la misma edición.' END)
  ) AS t(mensaje)
  WHERE mensaje IS NOT NULL;

  v_listo := v_ed.estado = 'borrador'
    AND NOT v_ed.resultados_visibles
    AND v_grados > 0 AND v_areas > 0 AND v_items_activos > 0
    AND v_diferencias_areas = 0 AND v_claves_pendientes = 0
    AND v_inscripciones > 0 AND v_resultados > 0
    AND v_resultados_sin_inscripcion = 0;

  RETURN jsonb_build_object(
    'edicion', v_ed.codigo,
    'titulo', v_ed.titulo,
    'estado', v_ed.estado,
    'resultados_visibles', v_ed.resultados_visibles,
    'estructura', jsonb_build_object(
       'grados', v_grados, 'areas', v_areas, 'sesiones', v_sesiones,
       'preguntas', v_items, 'preguntas_activas', v_items_activos,
       'claves_definidas', v_claves, 'claves_pendientes', v_claves_pendientes,
       'areas_desajustadas', v_diferencias_areas),
    'cargue', jsonb_build_object(
       'inscripciones', v_inscripciones, 'resultados', v_resultados,
       'presentaciones', v_presentaciones,
       'resultados_sin_inscripcion', v_resultados_sin_inscripcion),
    'por_grado', v_por_grado,
    'bloqueos_publicacion', v_bloqueos,
    'preparada_para_revision', v_listo,
    'publicacion_automatica', false,
    'consultado_en', now()
  );
END;
$function$;

-- Privilegio de ejecución controlado: la función vuelve a comprobar auth.uid().
REVOKE ALL ON FUNCTION public.roque_v3_admin_preflight_edicion(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.roque_v3_admin_preflight_edicion(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.roque_v3_admin_preflight_edicion(text) TO authenticated;
