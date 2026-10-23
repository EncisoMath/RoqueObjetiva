-- ROQUEOBJETIVA v146 / FASE 13: CERRAR RUTAS ANTIGUAS QUE ELUDEN EL LÍMITE.
-- SOLO EJECUTAR cuando FASE 12 esté instalada y la web v146 esté desplegada
-- y se haya verificado un acceso estudiantil con el nuevo RPC.
-- Es normal que navegadores con la versión PWA antigua necesiten actualizar.
-- NO revoca las funciones nuevas roque_v2_* ni roque_get_public_settings.
BEGIN;
SET LOCAL lock_timeout = '5s';

REVOKE ALL ON FUNCTION public.roque_login(text,text,text,text)
  FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.roque_get_student_ranking_context(text)
  FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.roque_get_student_ranking_context_v123(text)
  FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.roque_get_student_ranking_context_v124(text)
  FROM PUBLIC,anon,authenticated;

-- Desactivar dos rutas de sustitución MASIVA heredadas que v145 ya no utiliza.
-- NO afecta las funciones de guardar/corregir un resultado individual.
REVOKE ALL ON FUNCTION public.roque_admin_sync(text,jsonb)
  FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.roque_upload_resultados_v109(text,jsonb)
  FROM PUBLIC,anon,authenticated;

COMMIT;
NOTIFY pgrst, 'reload schema';

-- Verificación de que ya NO hay desvíos (todos deben decir false):
SELECT
  has_function_privilege('anon','public.roque_login(text,text,text,text)','EXECUTE') AS login_antiguo_expuesto,
  has_function_privilege('anon','public.roque_get_student_ranking_context(text)','EXECUTE') AS ranking_antiguo_expuesto,
  has_function_privilege('anon','public.roque_get_student_ranking_context_v123(text)','EXECUTE') AS ranking_v123_expuesto,
  has_function_privilege('anon','public.roque_get_student_ranking_context_v124(text)','EXECUTE') AS ranking_v124_expuesto,
  has_function_privilege('anon','public.roque_v2_login_controlado(text,text,uuid,text,text)','EXECUTE') AS login_controlado_disponible,
  has_function_privilege('anon','public.roque_v2_ranking_controlado(text,uuid)','EXECUTE') AS ranking_controlado_disponible;

-- Ambas deben devolver false para anon, al igual que las rutas antiguas:
SELECT
  has_function_privilege('anon','public.roque_admin_sync(text,jsonb)','EXECUTE') AS admin_sync_masivo_expuesto,
  has_function_privilege('anon','public.roque_upload_resultados_v109(text,jsonb)','EXECUTE') AS carga_masiva_expuesta;
