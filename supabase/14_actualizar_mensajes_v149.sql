-- RoqueObjetiva v149: mensajes de acceso y consulta.
-- No modifica estudiantes, resultados, registros de bloqueos ni las reglas de frecuencia.
-- Actualiza solamente el texto de dos respuestas y oculta el estado de la antigua cuenta genérica.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '45s';

DO $deploy$
DECLARE
  v_sql text;
  v_before text := $before$IF v_login = 'admin' OR EXISTS ($before$;
  v_after text := $after$IF v_login = 'admin' THEN
    v_payload := public.roque_login(p_user, p_password, p_device, p_mode);
    IF coalesce((v_payload->>'ok')::boolean,false) IS TRUE
       AND v_payload->'session'->>'role' = 'admin' THEN
      RETURN v_payload;
    END IF;
    RETURN jsonb_build_object('ok',false,'error','No se encontró ese usuario.');
  END IF;

  IF EXISTS ($after$;
BEGIN
  SELECT pg_get_functiondef('public.roque_v2_login_controlado(text,text,uuid,text,text)'::regprocedure)
    INTO v_sql;
  IF position(v_before IN v_sql) = 0 THEN
    RAISE EXCEPTION 'No se encuentra el punto de login para esta versión.';
  END IF;
  IF position('Este navegador tiene temporalmente suspendida la consulta de perfiles nuevos.' IN v_sql) = 0 THEN
    RAISE EXCEPTION 'No se encuentra el texto de suspensión esperado.';
  END IF;
  IF position('Límite diario alcanzado: este navegador ya consultó cinco perfiles diferentes.' IN v_sql) = 0 THEN
    RAISE EXCEPTION 'No se encuentra el texto del límite diario esperado.';
  END IF;

  v_sql := replace(v_sql, v_before, v_after);

  v_sql := replace(
    v_sql,
    'Este navegador tiene temporalmente suspendida la consulta de perfiles nuevos.',
    $message$Ingresar códigos uno tras otro, como si la plataforma tuviera que satisfacer cada impulso de consulta, constituye un uso abusivo del servicio.

Por eso, se ha restringido temporalmente el acceso desde este dispositivo. Aprende a distinguir entre una consulta necesaria y una insistencia innecesaria.

La próxima vez, dedica esa misma insistencia a estudiar y preocuparte por tus propios resultados. Estar pendiente de las calificaciones ajenas no va a mejorar las tuyas.

Podrás realizar nuevas consultas cuando finalice el bloqueo.$message$
  );

  v_sql := replace(
    v_sql,
    'Límite diario alcanzado: este navegador ya consultó cinco perfiles diferentes. Puedes volver a consultar esos mismos perfiles.',
    'Has alcanzado el límite diario de cinco perfiles diferentes. Puedes volver a consultar los perfiles que ya revisaste. Para consultar otros, regresa mañana.'
  );

  EXECUTE v_sql;
END;
$deploy$;

COMMIT;
NOTIFY pgrst,'reload schema';
