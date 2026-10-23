-- RoqueObjetiva v150: ocultar fecha y eliminar el último párrafo del mensaje de bloqueo.
-- Aplicada a Supabase en el despliegue v150. No cambia bloqueos.
BEGIN;
DO $update$
DECLARE
  src text;
  body text;
BEGIN
  SELECT pg_get_functiondef('public.roque_v2_login_controlado(text,text,uuid,text,text)'::regprocedure)
    INTO src;
  body := replace(src, E'\n\nPodrás realizar nuevas consultas cuando finalice el bloqueo.', '');
  body := replace(body, E'      ''bloqueado_hasta'',v_terminal.bloqueado_hasta,\n', '');
  IF body <> src THEN EXECUTE body; END IF;
END;
$update$;
COMMIT;
NOTIFY pgrst,'reload schema';
