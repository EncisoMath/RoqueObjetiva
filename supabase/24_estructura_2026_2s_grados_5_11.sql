-- RoqueObjetiva - 2026-2S: grados 5 y 11, SOLO estructura académica.
-- No copia claves, inscripciones, respuestas, resultados ni publicaciones.
DO $roque$
DECLARE v_estado text; v_visible boolean; v_res integer;
BEGIN
  SELECT estado, resultados_visibles INTO v_estado, v_visible
  FROM roque_private.ediciones WHERE codigo = '2026-2S' FOR UPDATE;
  IF NOT FOUND OR v_estado IS DISTINCT FROM 'borrador' OR v_visible IS DISTINCT FROM false THEN
    RAISE EXCEPTION '2026-2S no esta en borrador privado';
  END IF;
  SELECT count(*) INTO v_res FROM roque_private.resultados WHERE edicion = '2026-2S';
  IF v_res <> 0 THEN RAISE EXCEPTION 'Existen resultados; abortado sin cambios'; END IF;
  IF EXISTS(SELECT 1 FROM roque_private.items WHERE edicion='2026-2S' AND grado IN (5,11))
     OR EXISTS(SELECT 1 FROM roque_private.areas WHERE edicion='2026-2S' AND grado IN (5,11))
     OR EXISTS(SELECT 1 FROM roque_private.sesiones WHERE edicion='2026-2S' AND grado IN (5,11)) THEN
     RAISE EXCEPTION 'Grados 5/11 contienen estructura; revision manual antes de reintentar';
  END IF;

  INSERT INTO roque_private.grados(edicion,grado,nombre,metodo_global,maximo_global,activo)
  VALUES('2026-2S',5,'5°','ponderado',500,true)
  ON CONFLICT(edicion,grado) DO NOTHING;

  INSERT INTO roque_private.sesiones(edicion,grado,numero,nombre)
  VALUES('2026-2S',5,1,'Sesión 1');

  -- Pesos Saber existentes: M=3, Humanidades/Lenguaje=3, Ingles=1, Sociales=3, Naturales=3.
  INSERT INTO roque_private.areas(edicion,grado,area,area_global,orden,cantidad_preguntas,nota_minima,nota_maxima,nota_ausente,metodo_calificacion,peso_global,activo)
  VALUES
  ('2026-2S',5,'Matemáticas','Matemáticas',1,15,20,100,0,'lineal',3,true),
  ('2026-2S',5,'Humanidades','Lenguaje',2,15,20,100,0,'lineal',3,true),
  ('2026-2S',5,'Inglés','Inglés',3,15,20,100,0,'lineal',1,true),
  ('2026-2S',5,'Ciencias Sociales y Ciudadanía','Ciencias Sociales y Ciudadanía',4,15,20,100,0,'lineal',3,true),
  ('2026-2S',5,'Ciencias Naturales','Ciencias Naturales',5,15,20,100,0,'lineal',3,true);

  WITH orden AS (
    SELECT area,orden,generate_series(1,cantidad_preguntas) AS n
    FROM roque_private.areas WHERE edicion='2026-2S' AND grado=5 AND activo
  ), enumerado AS (
    SELECT area,row_number() OVER(ORDER BY orden,n)::int AS numero_item
    FROM orden
  )
  INSERT INTO roque_private.items(edicion,grado,numero_item,sesion,numero_en_sesion,area,respuesta_correcta,componente,competencia,peso_pregunta,anulada,activo)
  SELECT '2026-2S',5,numero_item,1,numero_item,area,NULL,NULL,NULL,1,false,true
  FROM enumerado;

  -- Replica exclusivamente el esquema de grado 10 para grado 11 (125 preguntas).
  INSERT INTO roque_private.sesiones(edicion,grado,numero,nombre)
  SELECT '2026-2S',11,numero,nombre FROM roque_private.sesiones
  WHERE edicion='2026-2S' AND grado=10;

  INSERT INTO roque_private.areas(edicion,grado,area,area_global,orden,cantidad_preguntas,nota_minima,nota_maxima,nota_ausente,metodo_calificacion,peso_global,activo)
  SELECT '2026-2S',11,area,area_global,orden,cantidad_preguntas,nota_minima,nota_maxima,nota_ausente,metodo_calificacion,peso_global,activo
  FROM roque_private.areas WHERE edicion='2026-2S' AND grado=10;

  INSERT INTO roque_private.items(edicion,grado,numero_item,sesion,numero_en_sesion,area,respuesta_correcta,componente,competencia,peso_pregunta,anulada,activo)
  SELECT '2026-2S',11,numero_item,sesion,numero_en_sesion,area,NULL,NULL,NULL,peso_pregunta,false,activo
  FROM roque_private.items WHERE edicion='2026-2S' AND grado=10;

  IF (SELECT count(*) FROM roque_private.items WHERE edicion='2026-2S' AND grado=5) <> 75
     OR (SELECT count(*) FROM roque_private.items WHERE edicion='2026-2S' AND grado=11) <> 125
     OR (SELECT count(*) FROM roque_private.items WHERE edicion='2026-2S') <> 825 THEN
    RAISE EXCEPTION 'Conteo de preguntas inesperado; se revierte toda la transaccion';
  END IF;
END $roque$;
