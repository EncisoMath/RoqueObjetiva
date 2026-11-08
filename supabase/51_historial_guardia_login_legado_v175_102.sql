-- RoqueObjetiva v175.102 · Implementación desplegada de roque_v4_login_controlado_private
CREATE OR REPLACE FUNCTION public.roque_v4_login_controlado_private(p_user text, p_password text DEFAULT ''::text, p_terminal uuid DEFAULT NULL::uuid, p_device text DEFAULT NULL::text, p_mode text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
 v_pause boolean; v_allowed text; v_edition text;
 v_login text:=lower(pg_catalog.btrim(coalesce(p_user,'')));
 v_st public.estudiantes%ROWTYPE;
BEGIN
 -- Toda ruta de login (incluidos clientes antiguos) valida la instalación en SQL.
 IF p_terminal IS NULL THEN
   RETURN pg_catalog.jsonb_build_object('ok',false,
     'error','No pudimos identificar esta instalación del navegador. Habilita el almacenamiento del sitio.');
 END IF;
 IF EXISTS (SELECT 1 FROM roque_private.historial_dispositivos d
            WHERE d.terminal=p_terminal AND d.bloqueado) THEN
   RETURN pg_catalog.jsonb_build_object('ok',false,
     'error','El acceso desde esta instalación del navegador está bloqueado por Administración.',
     'motivo','dispositivo_bloqueado');
 END IF;
 IF roque_private.examen_restringido_login(p_user) THEN
   RETURN jsonb_build_object('ok',false,'restringido',true,'error','Examen restringido.');
 END IF;
 SELECT pause_students,allowed_exam_id,preview_edition INTO v_pause,v_allowed,v_edition
 FROM roque_private.portal_access_gate WHERE id=1;
 IF NOT coalesce(v_pause,false) THEN
  RETURN public.roque_v4_login_original_2026_2s(p_user,p_password,p_terminal,p_device,p_mode);
 END IF;
 IF v_login='admin' OR pg_catalog.strpos(v_login,'@')>0 OR EXISTS(
  SELECT 1 FROM public.docentes d WHERE d.activo AND lower(d.id_docente)=v_login)
 THEN
  RETURN public.roque_v4_login_original_2026_2s(p_user,p_password,p_terminal,p_device,p_mode);
 END IF;
 IF v_login=v_allowed AND v_login='2573' AND v_edition='2026-2S'
   AND p_mode='roque_historico_2026_1s_2573' THEN
  RETURN roque_private.roque_historico_2573();
 END IF;
 IF v_login=v_allowed AND v_login='2573' AND v_edition='2026-2S' THEN
  RETURN roque_private.roque_2s_2573();
 END IF;
 IF v_login=v_allowed THEN
  SELECT * INTO v_st FROM public.estudiantes WHERE activo AND id_prueba=v_allowed LIMIT 1;
  IF FOUND THEN
   RETURN pg_catalog.jsonb_build_object(
    'ok',true,'role','student',
    'session',pg_catalog.jsonb_build_object('role','student','roll',v_st.id_prueba),
    'modo_vista_previa',v_edition,'edicion',v_edition,
    'origen_academico','vista_previa_sin_notas',
    'datasets',pg_catalog.jsonb_build_object(
      'estudiantes',pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
        'ID_ALUMNO',v_st.id_alumno,'ID_PRUEBA',v_st.id_prueba,
        'APELLIDOS',coalesce(v_st.apellidos,''),'NOMBRES',coalesce(v_st.nombres,''),
        'NOMBRE_COMPLETO',pg_catalog.btrim(coalesce(v_st.nombres,'')||' '||coalesce(v_st.apellidos,'')),
        'SEDE',coalesce(v_st.sede,''),'GRADO',v_st.grado::text,
        'GRUPO',coalesce(v_st.grupo,''))),
      'keys','[]'::jsonb,'resultados','[]'::jsonb,
      'carga','[]'::jsonb,'docentes','[]'::jsonb,'directoresGrupo','[]'::jsonb)
   );
  END IF;
 END IF;
 RETURN pg_catalog.jsonb_build_object('ok',false,
  'error','El acceso estudiantil está temporalmente suspendido mientras preparamos la evaluación de 2026-2S.');
END $function$;
