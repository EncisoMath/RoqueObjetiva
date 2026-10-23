-- ROQUEOBJETIVA / FASE 4 — GENERACIÓN ATÓMICA DE ÍTEMS
-- Instalar en SQL Editor como propietario de funciones, después de Fase 3.
-- Solo añade UNA función RPC. No ejecuta ninguna generación al instalarse.
-- Para una edición y grado, solo genera cuando aún no existen ítems.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '90s';

CREATE OR REPLACE FUNCTION public.roque_v2_admin_generar_items(
  p_edicion text,
  p_grado smallint,
  p_sesiones jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $BODY$
DECLARE
  v_insertados integer := 0;
BEGIN
  -- Defensa doble: JWT de Auth y lista privada de administradores.
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM roque_private.operadores_admin o
    WHERE o.user_id = auth.uid() AND o.activo
  ) THEN
    RAISE EXCEPTION 'Acceso administrativo no autorizado.' USING ERRCODE = '42501';
  END IF;

  IF p_sesiones IS NULL OR jsonb_typeof(p_sesiones) <> 'object' THEN
    RAISE EXCEPTION 'p_sesiones debe ser un objeto JSON.' USING ERRCODE = '22023';
  END IF;

  -- Bloquea la edición, exige borrador y prohíbe tocar cualquier edición con resultados.
  PERFORM roque_private.exigir_borrador(p_edicion);

  IF NOT EXISTS (
    SELECT 1 FROM roque_private.grados g
    WHERE g.edicion = p_edicion AND g.grado = p_grado AND g.activo
  ) THEN
    RAISE EXCEPTION 'El grado % no existe o está inactivo.', p_grado USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1 FROM roque_private.items i
    WHERE i.edicion = p_edicion AND i.grado = p_grado
  ) THEN
    RAISE EXCEPTION 'El grado ya tiene ítems: para proteger las preguntas existentes no se regenerarán.'
      USING ERRCODE = '23505';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM roque_private.areas a
    WHERE a.edicion = p_edicion AND a.grado = p_grado
      AND a.activo AND a.cantidad_preguntas > 0
  ) THEN
    RAISE EXCEPTION 'Configura al menos un área activa con preguntas.' USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1 FROM roque_private.areas a
    LEFT JOIN roque_private.sesiones s
      ON s.edicion = a.edicion AND s.grado = a.grado
     AND s.numero = COALESCE(NULLIF(p_sesiones->>a.area, '')::smallint, 1)
    WHERE a.edicion = p_edicion AND a.grado = p_grado AND a.activo
      AND a.cantidad_preguntas > 0 AND s.numero IS NULL
  ) THEN
    RAISE EXCEPTION 'Hay áreas asignadas a sesiones que no existen.' USING ERRCODE = '22023';
  END IF;

  -- Crea todas las filas en una única transacción de PostgreSQL.
  -- Si una falla, no queda una carga a medias.
  WITH plan AS (
    SELECT a.area, a.orden, a.cantidad_preguntas,
           COALESCE(NULLIF(p_sesiones->>a.area, '')::smallint, 1) AS sesion
    FROM roque_private.areas a
    WHERE a.edicion = p_edicion AND a.grado = p_grado
      AND a.activo AND a.cantidad_preguntas > 0
  ),
  enumeradas AS (
    SELECT p.area, p.sesion,
      ROW_NUMBER() OVER (ORDER BY p.sesion, p.orden, p.area, n) AS numero_item,
      ROW_NUMBER() OVER (PARTITION BY p.sesion ORDER BY p.orden, p.area, n) AS numero_en_sesion
    FROM plan p CROSS JOIN LATERAL generate_series(1, p.cantidad_preguntas) AS serie(n)
  )
  INSERT INTO roque_private.items
    (edicion, grado, numero_item, sesion, numero_en_sesion, area,
     respuesta_correcta, componente, competencia, peso_pregunta, anulada, activo)
  SELECT p_edicion, p_grado, e.numero_item::integer, e.sesion,
         e.numero_en_sesion::integer, e.area, NULL, NULL, NULL, 1, false, true
  FROM enumeradas e;

  GET DIAGNOSTICS v_insertados = ROW_COUNT;
  RETURN jsonb_build_object('ok', true, 'edicion', p_edicion,
    'grado', p_grado, 'items_generados', v_insertados, 'claves_copiadas', 0);
END;
$BODY$;

REVOKE EXECUTE ON FUNCTION public.roque_v2_admin_generar_items(text,smallint,jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.roque_v2_admin_generar_items(text,smallint,jsonb)
  TO authenticated;

COMMIT;

-- Verificación de permisos, solo lectura:
-- SELECT has_function_privilege('anon','public.roque_v2_admin_generar_items(text,smallint,jsonb)','EXECUTE') AS anon_execute,
--        has_function_privilege('authenticated','public.roque_v2_admin_generar_items(text,smallint,jsonb)','EXECUTE') AS authenticated_execute;