-- 2026-2S: pausa temporal de inicios de sesion estudiantiles.
-- La excepcion es SOLO ID_PRUEBA 2573. Docentes/admin siguen igual.
-- Reversible: UPDATE roque_private.control_acceso_portal SET bloqueo_estudiantes=false WHERE clave='portal';
CREATE TABLE IF NOT EXISTS roque_private.control_acceso_portal (
 clave text PRIMARY KEY,
 bloqueo_estudiantes boolean NOT NULL DEFAULT true,
 id_prueba_tester text NOT NULL DEFAULT '2573',
 edicion_vista_previa text NOT NULL DEFAULT '2026-2S',
 actualizado_en timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE roque_private.control_acceso_portal ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON roque_private.control_acceso_portal FROM PUBLIC, anon, authenticated, service_role;
INSERT INTO roque_private.control_acceso_portal(clave,bloqueo_estudiantes,id_prueba_tester,edicion_vista_previa)
VALUES('portal',true,'2573','2026-2S')
ON CONFLICT(clave) DO UPDATE SET bloqueo_estudiantes=true,id_prueba_tester=EXCLUDED.id_prueba_tester,edicion_vista_previa=EXCLUDED.edicion_vista_previa,actualizado_en=now();

DO $guard$
DECLARE src text; marker text;
BEGIN
  -- Punto central de entrada de alumnos: protege también invocaciones RPC directas.
  SELECT pg_get_functiondef('public.roque_login(text,text,text,text)'::regprocedure) INTO src;
  marker := '  -- En fechas bloqueadas el alumno obtiene sesión y datos identificativos,';
  IF strpos(src, marker) = 0 THEN RAISE EXCEPTION 'No coincide la función roque_login original'; END IF;
  IF strpos(src,'CONTROL_ACCESO_2026_2S') <> 0 THEN RAISE EXCEPTION 'Migración ya aplicada; abortar'; END IF;
  src := replace(src, marker, $code$  -- CONTROL_ACCESO_2026_2S: pausa reversible por configuración privada.
  IF v_role = 'student' AND EXISTS (
    SELECT 1 FROM roque_private.control_acceso_portal c
    WHERE c.clave='portal' AND c.bloqueo_estudiantes
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM roque_private.control_acceso_portal c
      WHERE c.clave='portal' AND c.id_prueba_tester=v_student_exam
    ) THEN
      RETURN jsonb_build_object('ok',false,
        'error','El acceso de estudiantes está temporalmente suspendido mientras preparamos 2026-2S.');
    END IF;
    -- Sin consultar ni entregar claves o respuestas de 2026-1S o 2026-2S.
    RETURN jsonb_build_object(
      'ok',true,'role','student','session',v_session,
      'modo_vista_previa','2026-2S',
      'datasets',jsonb_build_object(
        'estudiantes',jsonb_build_array(jsonb_build_object(
          'ID_ALUMNO',v_student.id_alumno,'ID_PRUEBA',v_student.id_prueba,
          'APELLIDOS',coalesce(v_student.apellidos,''),
          'NOMBRES',coalesce(v_student.nombres,''),
          'NOMBRE_COMPLETO',trim(coalesce(v_student.nombres,'')||' '||coalesce(v_student.apellidos,'')),
          'SEDE',coalesce(v_student.sede,''),'GRADO',v_student.grado::text,
          'GRUPO',coalesce(v_student.grupo,''))),
        'keys','[]'::jsonb,'resultados','[]'::jsonb,
        'carga','[]'::jsonb,'directoresGrupo','[]'::jsonb
      )
    );
  END IF;

$code$ || marker);
  EXECUTE src;

  -- Compatibilidad del login v4: no intentar hidratar el semestre histórico.
  SELECT pg_get_functiondef('public.roque_v4_login_controlado_private(text,text,uuid,text,text)'::regprocedure) INTO src;
  marker := '  IF o->' || '''' || 'session' || '''' || '->>' || '''' || 'role' || '''' || '=' || '''' || 'student' || '''' || ' AND roque_private.historial_bloqueado(ed) THEN';
  IF strpos(src,marker)=0 THEN
    -- En caso de formato diferente, detectar por texto esencial (sin abrir accesos).
    RAISE EXCEPTION 'No coincide la función roque_v4_login_controlado_private';
  END IF;
  src:=replace(src,marker, $code$  IF o->>'modo_vista_previa' = '2026-2S' THEN RETURN o; END IF;
$code$ || marker);
  EXECUTE src;

  -- Los endpoints de ranking histórico no deben seguir disponibles durante la pausa.
  SELECT pg_get_functiondef('public.roque_v2_ranking_controlado(text,uuid)'::regprocedure) INTO src;
  marker := ' IF roque_private.historial_bloqueado(' || '''' || '2026-1S' || '''' || ') THEN';
  IF strpos(src,marker)=0 THEN RAISE EXCEPTION 'No coincide ranking v2'; END IF;
  src := replace(src,marker, $code$ IF EXISTS (SELECT 1 FROM roque_private.control_acceso_portal c
   WHERE c.clave='portal' AND c.bloqueo_estudiantes) THEN
   RETURN jsonb_build_object('ok',false,'error','Consultas estudiantiles suspendidas temporalmente.');
 END IF;
$code$||marker);
  EXECUTE src;

  SELECT pg_get_functiondef('public.roque_v3_ranking_controlado_edicion(text,uuid,text)'::regprocedure) INTO src;
  marker := ' IF roque_private.historial_bloqueado(' || '''' || '2026-1S' || '''' || ') THEN';
  IF strpos(src,marker)=0 THEN RAISE EXCEPTION 'No coincide ranking v3'; END IF;
  src := replace(src,marker, $code$ IF EXISTS (SELECT 1 FROM roque_private.control_acceso_portal c
   WHERE c.clave='portal' AND c.bloqueo_estudiantes) THEN
   RETURN jsonb_build_object('ok',false,'error','Consultas estudiantiles suspendidas temporalmente.');
 END IF;
$code$||marker);
  EXECUTE src;

  SELECT pg_get_functiondef('public.roque_v5_historial_autorizado(text)'::regprocedure) INTO src;
  marker := ' IF p_edicion IS NOT NULL AND roque_private.historial_bloqueado(p_edicion) THEN';
  IF strpos(src,marker)=0 THEN RAISE EXCEPTION 'No coincide historial Auth'; END IF;
  src := replace(src,marker, $code$ IF EXISTS (SELECT 1 FROM roque_private.control_acceso_portal c
   WHERE c.clave='portal' AND c.bloqueo_estudiantes) THEN
   RETURN jsonb_build_object('ok',false,'error','Historial estudiantil suspendido temporalmente.');
 END IF;
$code$||marker);
  EXECUTE src;
END $guard$;
