-- RoqueObjetiva v175.73: roles de Personal docente en login y menú.
-- La sesión del Coordinador sigue requiriendo hash, expiración y registro activo.
-- IMPORTANTE: Administrador institucional NO obtiene permisos de Supabase Auth.
CREATE OR REPLACE FUNCTION public.roque_v8_login_controlado_private(p_user text, p_password text DEFAULT ''::text, p_terminal uuid DEFAULT NULL::uuid, p_device text DEFAULT NULL::text, p_mode text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
 v_payload jsonb;
 v_id text;
 v_token text;
 v_doc public.docentes%ROWTYPE;
 v_staff_role text;
BEGIN
 v_payload:=public.roque_v4_login_controlado_private(p_user,p_password,p_terminal,p_device,p_mode);
 IF coalesce((v_payload->>'ok')::boolean,false) IS DISTINCT FROM true
   OR v_payload->'session'->>'role' IS DISTINCT FROM 'teacher' THEN
   RETURN v_payload;
 END IF;
 v_id:=v_payload->'session'->>'id';
 SELECT * INTO v_doc FROM public.docentes d WHERE d.id_docente=v_id AND d.activo;
 IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'error','Docente no autorizado.'); END IF;
 v_staff_role:=CASE WHEN v_doc.rol IN ('administrador','coordinador','docente') THEN v_doc.rol
    WHEN v_doc.coordinador THEN 'coordinador' ELSE 'docente' END;
 -- Autoridad para el dock: asignación real de Personal Docente en Supabase.
 -- Adjuntar solo el perfil del docente autenticado mediante el login existente.
 v_payload:=jsonb_set(v_payload,'{session}',
   coalesce(v_payload->'session','{}'::jsonb) ||
     jsonb_build_object('staff_role',v_staff_role),true);
 v_payload:=jsonb_set(v_payload,'{datasets,docentes}',jsonb_build_array(
   jsonb_build_object(
     'id_docente',v_doc.id_docente,'nombre',v_doc.nombre,
     'rol',v_staff_role,'coordinador',(v_staff_role IN ('coordinador','administrador')),
     'sede',v_doc.sede,'direccion_sede',v_doc.direccion_sede,
     'direccion_grado',v_doc.direccion_grado,'direccion_grupo',v_doc.direccion_grupo
   )
 ),true);
 IF v_staff_role NOT IN ('coordinador','administrador') THEN RETURN v_payload; END IF;
 v_token:=encode(extensions.gen_random_bytes(32),'hex');
 DELETE FROM roque_private.coordinator_sessions
 WHERE id_docente=v_id AND expira_en<clock_timestamp();
 INSERT INTO roque_private.coordinator_sessions(token_hash,id_docente,terminal,expira_en)
 VALUES(encode(extensions.digest(v_token,'sha256'),'hex'),v_id,p_terminal,clock_timestamp()+interval '90 minutes');
 RETURN v_payload||jsonb_build_object('coordinator_session',v_token);
END $function$;

CREATE OR REPLACE FUNCTION roque_private.validar_coordinador_sesion(p_docente text, p_token text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT length(coalesce(p_token,''))=64 AND EXISTS (
    SELECT 1 FROM roque_private.coordinator_sessions s
    JOIN public.docentes d ON d.id_docente=s.id_docente
    WHERE s.token_hash=encode(extensions.digest(p_token,'sha256'),'hex')
      AND s.id_docente=p_docente AND s.expira_en>clock_timestamp()
      AND s.revocado=false AND d.activo AND (d.coordinador OR d.rol='administrador')
  );
 $function$;
