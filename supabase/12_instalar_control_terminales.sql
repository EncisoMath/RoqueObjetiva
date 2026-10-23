-- ROQUEOBJETIVA v146 / FASE 12: instalar los controles sin interrumpir la web.
-- Instalar por SQL Editor, sin copiar claves ni contraseñas.
-- Esta fase SOLO crea RPC nuevas y tablas privadas: no revoca las RPC antiguas.
-- Ejecutar ANTES de activar/revocar en Fase 13.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '90s';

CREATE TABLE IF NOT EXISTS roque_private.terminales_consulta (
  terminal_hash text PRIMARY KEY CHECK (length(terminal_hash) = 64),
  primer_acceso timestamptz NOT NULL DEFAULT now(),
  ultimo_acceso timestamptz NOT NULL DEFAULT now(),
  bloqueado_hasta timestamptz,
  bloqueos_acumulados integer NOT NULL DEFAULT 0 CHECK (bloqueos_acumulados >= 0)
);
CREATE TABLE IF NOT EXISTS roque_private.perfiles_consultados (
  terminal_hash text NOT NULL REFERENCES roque_private.terminales_consulta(terminal_hash),
  fecha_colombia date NOT NULL,
  id_prueba text NOT NULL,
  primer_acceso timestamptz NOT NULL,
  ultimo_acceso timestamptz NOT NULL,
  consultas integer NOT NULL DEFAULT 1,
  PRIMARY KEY (terminal_hash, fecha_colombia, id_prueba)
);
CREATE INDEX IF NOT EXISTS roque_pc_reciente_idx
  ON roque_private.perfiles_consultados (terminal_hash, ultimo_acceso DESC);
CREATE TABLE IF NOT EXISTS roque_private.intentos_durante_bloqueo (
  terminal_hash text NOT NULL REFERENCES roque_private.terminales_consulta(terminal_hash),
  id_prueba text NOT NULL,
  instante timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS roque_ib_terminal_idx
  ON roque_private.intentos_durante_bloqueo(terminal_hash, instante DESC);

ALTER TABLE roque_private.terminales_consulta ENABLE ROW LEVEL SECURITY;
ALTER TABLE roque_private.perfiles_consultados ENABLE ROW LEVEL SECURITY;
ALTER TABLE roque_private.intentos_durante_bloqueo ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON roque_private.terminales_consulta FROM PUBLIC, anon, authenticated;
REVOKE ALL ON roque_private.perfiles_consultados FROM PUBLIC, anon, authenticated;
REVOKE ALL ON roque_private.intentos_durante_bloqueo FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.roque_v2_login_controlado(
  p_user text,
  p_password text DEFAULT '',
  p_terminal uuid DEFAULT NULL,
  p_device text DEFAULT NULL,
  p_mode text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $fn$
DECLARE
  v_login text := lower(btrim(coalesce(p_user,'')));
  v_exam text;
  v_hash text;
  v_now timestamptz := clock_timestamp();
  v_date date := (clock_timestamp() AT TIME ZONE 'America/Bogota')::date;
  v_terminal roque_private.terminales_consulta%ROWTYPE;
  v_seen_today boolean;
  v_seen_ever boolean;
  v_today_count integer;
  v_recent_count integer;
  v_denied_count integer;
  v_hours integer;
  v_payload jsonb;
BEGIN
  -- Administradores y docentes conservan su flujo actual. Esta RPC regula consultas estudiantiles.
  IF v_login = 'admin' OR EXISTS (
    SELECT 1 FROM public.docentes d
    WHERE d.activo = true AND lower(d.id_docente) = v_login
  ) THEN
    RETURN public.roque_login(p_user, p_password, p_device, p_mode);
  END IF;

  SELECT e.id_prueba INTO v_exam
  FROM public.estudiantes e
  WHERE e.activo = true AND
    (lower(e.id_alumno) = v_login OR lower(e.id_prueba) = v_login)
  ORDER BY e.id_prueba LIMIT 1;

  IF v_exam IS NULL THEN
    -- Conserva la misma respuesta habitual sin revelar si el terminal ha visto otros perfiles.
    RETURN public.roque_login(p_user, p_password, p_device, p_mode);
  END IF;

  IF p_terminal IS NULL THEN
    RETURN jsonb_build_object('ok',false,
      'error','No pudimos identificar esta instalación del navegador. Habilita el almacenamiento del sitio.');
  END IF;

  v_hash := pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(p_terminal::text,'UTF8')),'hex');
  -- Evita que pestañas simultáneas rebasen el límite entre validación e inserción.
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_hash,0));
  INSERT INTO roque_private.terminales_consulta(terminal_hash)
  VALUES (v_hash) ON CONFLICT (terminal_hash)
  DO UPDATE SET ultimo_acceso = excluded.ultimo_acceso;

  SELECT * INTO v_terminal FROM roque_private.terminales_consulta
  WHERE terminal_hash = v_hash FOR UPDATE;

  SELECT EXISTS (
    SELECT 1 FROM roque_private.perfiles_consultados q
    WHERE q.terminal_hash=v_hash AND q.id_prueba=v_exam
  ) INTO v_seen_ever;
  SELECT EXISTS (
    SELECT 1 FROM roque_private.perfiles_consultados q
    WHERE q.terminal_hash=v_hash AND q.fecha_colombia=v_date AND q.id_prueba=v_exam
  ) INTO v_seen_today;

  -- Durante el bloqueo se mantienen los perfiles ya vistos previamente,
  -- pero no se permite ampliar el conjunto.
  IF v_terminal.bloqueado_hasta > v_now AND NOT v_seen_ever THEN
    INSERT INTO roque_private.intentos_durante_bloqueo
      (terminal_hash,id_prueba,instante) VALUES(v_hash,v_exam,v_now);
    SELECT count(DISTINCT b.id_prueba) INTO v_denied_count
    FROM roque_private.intentos_durante_bloqueo b
    WHERE b.terminal_hash=v_hash AND b.instante >= v_now - interval '2 minutes';
    IF v_denied_count >= 5 AND v_terminal.bloqueos_acumulados = 1 THEN
      UPDATE roque_private.terminales_consulta
      SET bloqueado_hasta=v_now + interval '72 hours', bloqueos_acumulados=2
      WHERE terminal_hash=v_hash;
      v_terminal.bloqueado_hasta := v_now + interval '72 hours';
    END IF;
    RETURN jsonb_build_object('ok',false,'error',
      'Este navegador tiene temporalmente suspendida la consulta de perfiles nuevos.',
      'bloqueado_hasta',v_terminal.bloqueado_hasta,
      'motivo','bloqueo_por_consultas_rapidas');
  END IF;

  SELECT count(*) INTO v_today_count FROM roque_private.perfiles_consultados q
  WHERE q.terminal_hash=v_hash AND q.fecha_colombia=v_date;

  IF NOT v_seen_today AND v_today_count >= 5 THEN
    RETURN jsonb_build_object('ok',false,
      'error','Límite diario alcanzado: este navegador ya consultó cinco perfiles diferentes. Puedes volver a consultar esos mismos perfiles.',
      'motivo','limite_diario','limite',5,'proximo_dia',v_date+1);
  END IF;

  v_payload := public.roque_login(p_user, p_password, p_device, p_mode);
  IF coalesce((v_payload->>'ok')::boolean,false) IS NOT TRUE
     OR v_payload->'session'->>'role' IS DISTINCT FROM 'student' THEN
    RETURN v_payload;
  END IF;

  INSERT INTO roque_private.perfiles_consultados
    (terminal_hash,fecha_colombia,id_prueba,primer_acceso,ultimo_acceso,consultas)
  VALUES(v_hash,v_date,v_exam,v_now,v_now,1)
  ON CONFLICT (terminal_hash,fecha_colombia,id_prueba)
  DO UPDATE SET ultimo_acceso=excluded.ultimo_acceso,
                consultas=roque_private.perfiles_consultados.consultas+1;

  -- Cinco estudiantes distintos en <= 120 segundos: 48 h primera vez,
  -- 72 h si reincide después; también se agrava si intenta 5 nuevos durante bloqueo.
  SELECT count(*) INTO v_recent_count FROM (
    SELECT DISTINCT q.id_prueba
    FROM roque_private.perfiles_consultados q
    WHERE q.terminal_hash=v_hash
      AND q.ultimo_acceso >= v_now - interval '2 minutes'
  ) recent;

  IF v_recent_count >= 5 AND (v_terminal.bloqueado_hasta IS NULL
                              OR v_terminal.bloqueado_hasta <= v_now) THEN
    v_hours := CASE WHEN v_terminal.bloqueos_acumulados >= 1 THEN 72 ELSE 48 END;
    UPDATE roque_private.terminales_consulta
    SET bloqueado_hasta=v_now + pg_catalog.make_interval(hours=>v_hours),
        bloqueos_acumulados=bloqueos_acumulados+1
    WHERE terminal_hash=v_hash;
    v_terminal.bloqueado_hasta := v_now + pg_catalog.make_interval(hours=>v_hours);
  END IF;

  RETURN v_payload || jsonb_build_object('control_consultas',
    jsonb_build_object(
      'fecha_colombia',v_date,
      'perfiles_hoy',v_today_count + CASE WHEN v_seen_today THEN 0 ELSE 1 END,
      'maximo_perfiles_dia',5,
      'bloqueado_hasta',v_terminal.bloqueado_hasta));
END;
$fn$;

CREATE OR REPLACE FUNCTION public.roque_v2_ranking_controlado(
  p_login text,
  p_terminal uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $fn$
DECLARE
  v_hash text;
  v_exam text;
  v_payload jsonb;
  v_grado jsonb;
  v_curso jsonb;
BEGIN
  IF p_terminal IS NULL THEN
    RETURN jsonb_build_object('ok',false,'error','Navegador no identificado.');
  END IF;
  v_hash := pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(p_terminal::text,'UTF8')),'hex');
  SELECT e.id_prueba INTO v_exam FROM public.estudiantes e
    WHERE e.activo = true
      AND (lower(e.id_prueba)=lower(btrim(p_login))
        OR lower(e.id_alumno)=lower(btrim(p_login)))
    ORDER BY e.id_prueba LIMIT 1;
  IF v_exam IS NULL OR NOT EXISTS (
    SELECT 1 FROM roque_private.perfiles_consultados q
    WHERE q.terminal_hash=v_hash AND q.id_prueba=v_exam
      AND q.ultimo_acceso >= pg_catalog.clock_timestamp() - interval '60 minutes'
  ) THEN
    RETURN jsonb_build_object('ok',false,
      'error','Primero ingresa al perfil del estudiante con este navegador.');
  END IF;

  v_payload := public.roque_get_student_ranking_context(v_exam);
  IF coalesce((v_payload->>'ok')::boolean,false) IS NOT TRUE THEN
    RETURN v_payload;
  END IF;

  -- El ranking completo del grado expone notas/nombres de cientos de estudiantes:
  -- no entregarlo a un navegador anónimo. Conservar exclusivamente la fila propia,
  -- y los valores agregados de puesto y total para la pantalla estudiantil.
  SELECT coalesce(jsonb_agg(x.rowdata),'[]'::jsonb) INTO v_grado
  FROM pg_catalog.jsonb_array_elements(coalesce(v_payload->'grado_rows','[]'::jsonb)) AS x(rowdata)
  WHERE x.rowdata->>'id_prueba'=v_exam;
  SELECT coalesce(jsonb_agg(x.rowdata),'[]'::jsonb) INTO v_curso
  FROM pg_catalog.jsonb_array_elements(coalesce(v_payload->'curso_rows','[]'::jsonb)) AS x(rowdata)
  WHERE x.rowdata->>'id_prueba'=v_exam;

  RETURN pg_catalog.jsonb_set(
    pg_catalog.jsonb_set(v_payload,'{grado_rows}',v_grado,true),
    '{curso_rows}',v_curso,true);
END;
$fn$;

REVOKE ALL ON FUNCTION public.roque_v2_login_controlado(text,text,uuid,text,text)
  FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.roque_v2_ranking_controlado(text,uuid)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.roque_v2_login_controlado(text,text,uuid,text,text) TO anon,authenticated;
GRANT EXECUTE ON FUNCTION public.roque_v2_ranking_controlado(text,uuid) TO anon,authenticated;

COMMIT;
NOTIFY pgrst, 'reload schema';

-- Después verificar:
-- SELECT has_function_privilege('anon','public.roque_v2_login_controlado(text,text,uuid,text,text)','EXECUTE'),
--        has_function_privilege('anon','public.roque_v2_ranking_controlado(text,uuid)','EXECUTE');
