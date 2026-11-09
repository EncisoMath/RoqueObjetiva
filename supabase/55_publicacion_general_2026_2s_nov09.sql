-- roque_private.login_estudiante_2s_publicado(text,uuid)
CREATE OR REPLACE FUNCTION roque_private.login_estudiante_2s_publicado(p_user text, p_terminal uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
 v_login text:=lower(pg_catalog.btrim(coalesce(p_user,'')));
 v_i roque_private.inscripciones%ROWTYPE;
 v_r roque_private.resultados%ROWTYPE;
 v_hash text; v_t roque_private.terminales_consulta%ROWTYPE;
 v_seen_ever boolean; v_seen_today boolean; v_count int; v_recent int; v_denied int; v_hours int;
 v_now timestamptz:=clock_timestamp();
 v_date date:=(clock_timestamp() AT TIME ZONE 'America/Bogota')::date;
 v_key jsonb; v_results jsonb:='[]'::jsonb;
BEGIN
 IF NOT roque_private.ventana_publicacion_2s() THEN
   RETURN jsonb_build_object('ok',false,'error','2026-2S no está habilitado.');
 END IF;
 IF p_terminal IS NULL THEN
   RETURN jsonb_build_object('ok',false,'error','Navegador no identificado.');
 END IF;
 IF EXISTS(SELECT 1 FROM roque_private.historial_dispositivos WHERE terminal=p_terminal AND bloqueado) THEN
   RETURN jsonb_build_object('ok',false,'error','Dispositivo bloqueado.','motivo','dispositivo_bloqueado');
 END IF;
 IF roque_private.examen_restringido_login(p_user) THEN
   RETURN jsonb_build_object('ok',false,'restringido',true,'error','Examen restringido.');
 END IF;
 SELECT * INTO v_i FROM roque_private.inscripciones i WHERE i.edicion='2026-2S' AND i.activo
 AND (lower(i.id_prueba)=v_login OR lower(i.id_alumno)=v_login)
 ORDER BY i.id_prueba LIMIT 1;
 IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'error','Estudiante no inscrito en 2026-2S.'); END IF;
 IF roque_private.examen_restringido('2026-2S',v_i.id_prueba) THEN
   RETURN jsonb_build_object('ok',false,'restringido',true,'error','Examen restringido.');
 END IF;
 v_hash:=encode(sha256(convert_to(p_terminal::text,'UTF8')),'hex');
 PERFORM pg_advisory_xact_lock(hashtextextended(v_hash,0));
 INSERT INTO roque_private.terminales_consulta(terminal_hash) VALUES(v_hash)
 ON CONFLICT(terminal_hash) DO UPDATE SET ultimo_acceso=excluded.ultimo_acceso;
 SELECT * INTO v_t FROM roque_private.terminales_consulta WHERE terminal_hash=v_hash FOR UPDATE;
 SELECT EXISTS(SELECT 1 FROM roque_private.perfiles_consultados q WHERE q.terminal_hash=v_hash
  AND q.id_prueba=v_i.id_prueba) INTO v_seen_ever;
 SELECT EXISTS(SELECT 1 FROM roque_private.perfiles_consultados q WHERE q.terminal_hash=v_hash
  AND q.fecha_colombia=v_date AND q.id_prueba=v_i.id_prueba) INTO v_seen_today;
 IF v_t.bloqueado_hasta>v_now AND NOT v_seen_ever THEN
   INSERT INTO roque_private.intentos_durante_bloqueo(terminal_hash,id_prueba,instante)
    VALUES(v_hash,v_i.id_prueba,v_now);
   SELECT count(DISTINCT id_prueba) INTO v_denied FROM roque_private.intentos_durante_bloqueo
    WHERE terminal_hash=v_hash AND instante>=v_now-interval '2 minutes';
   IF v_denied>=5 AND v_t.bloqueos_acumulados=1 THEN
     UPDATE roque_private.terminales_consulta SET bloqueado_hasta=v_now+interval '72 hours',
     bloqueos_acumulados=2 WHERE terminal_hash=v_hash;
   END IF;
   RETURN jsonb_build_object('ok',false,'motivo','bloqueo_por_consultas_rapidas',
    'error','Este navegador está temporalmente restringido por consultas reiteradas.');
 END IF;
 SELECT count(*) INTO v_count FROM roque_private.perfiles_consultados
 WHERE terminal_hash=v_hash AND fecha_colombia=v_date;
 IF NOT v_seen_today AND v_count>=5 THEN
   RETURN jsonb_build_object('ok',false,'motivo','limite_diario','limite',5,
    'error','Has alcanzado el límite diario de cinco perfiles diferentes.');
 END IF;
 INSERT INTO roque_private.perfiles_consultados
 (terminal_hash,fecha_colombia,id_prueba,primer_acceso,ultimo_acceso,consultas)
 VALUES(v_hash,v_date,v_i.id_prueba,v_now,v_now,1)
 ON CONFLICT(terminal_hash,fecha_colombia,id_prueba)
 DO UPDATE SET ultimo_acceso=excluded.ultimo_acceso,
 consultas=roque_private.perfiles_consultados.consultas+1;
 SELECT count(*) INTO v_recent FROM
 (SELECT DISTINCT id_prueba FROM roque_private.perfiles_consultados
 WHERE terminal_hash=v_hash AND ultimo_acceso>=v_now-interval '2 minutes') x;
 IF v_recent>=5 AND (v_t.bloqueado_hasta IS NULL OR v_t.bloqueado_hasta<=v_now) THEN
   v_hours:=CASE WHEN v_t.bloqueos_acumulados>=1 THEN 72 ELSE 48 END;
   UPDATE roque_private.terminales_consulta
   SET bloqueado_hasta=v_now+make_interval(hours=>v_hours),
   bloqueos_acumulados=bloqueos_acumulados+1 WHERE terminal_hash=v_hash;
 END IF;
 SELECT coalesce(jsonb_agg(jsonb_build_object(
   'Grado',k.grado::text,'Área',k.area,'Número de ítem',k.numero_item::text,
   'Respuesta sugerida',k.respuesta_correcta,
   'Componente / pensamiento / entorno / factor / enfoque',coalesce(k.componente,''),
   'Competencia',coalesce(k.competencia,'')
 ) ORDER BY k.numero_item),'[]'::jsonb) INTO v_key
 FROM roque_private.items k WHERE k.edicion='2026-2S'
 AND k.grado=v_i.grado AND k.activo AND NOT k.anulada AND k.respuesta_correcta IS NOT NULL;
 SELECT * INTO v_r FROM roque_private.resultados WHERE edicion='2026-2S'
 AND id_prueba=v_i.id_prueba AND activo;
 IF FOUND THEN
   v_results:=jsonb_build_array(jsonb_build_object(
     'grade',v_i.grado,'session',0,'startItem',1,
     'path','SUPABASE/2026-2S/RESULTADOS_'||v_i.grado||'.json',
     'rows',jsonb_build_array(jsonb_build_object('Roll No',v_i.id_prueba,
       'respuestas',roque_private.mascara_respuestas_medidas('2026-2S',
          v_i.id_prueba,v_i.grado,v_r.respuestas)))));
 END IF;
 RETURN jsonb_build_object('ok',true,'role','student','edicion','2026-2S',
 'origen_academico','roque_private',
 'session',jsonb_build_object('role','student','roll',v_i.id_prueba),
 'datasets',jsonb_build_object(
  'estudiantes',jsonb_build_array(jsonb_build_object(
    'ID_ALUMNO',v_i.id_alumno,'ID_PRUEBA',v_i.id_prueba,
    'APELLIDOS',coalesce(v_i.apellidos,''),'NOMBRES',coalesce(v_i.nombres,''),
    'NOMBRE_COMPLETO',btrim(coalesce(v_i.nombres,'')||' '||coalesce(v_i.apellidos,'')),
    'SEDE',coalesce(v_i.sede,''),'GRADO',v_i.grado::text,'GRUPO',coalesce(v_i.grupo,'')
  )),
  'keys',jsonb_build_array(jsonb_build_object(
    'grade',v_i.grado,'path','SUPABASE/2026-2S/KEYS_'||v_i.grado||'.json','rows',v_key)),
  'resultados',v_results,
  'carga','[]'::jsonb,'docentes','[]'::jsonb,'directoresGrupo','[]'::jsonb
 ));
END $function$;

-- roque_private.ventana_publicacion_2s(timestamp with time zone)
CREATE OR REPLACE FUNCTION roque_private.ventana_publicacion_2s(p_momento timestamp with time zone DEFAULT CURRENT_TIMESTAMP)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$ SELECT p_momento >= timestamptz '2026-11-09 05:00:00+00'
 AND EXISTS(SELECT 1 FROM roque_private.ediciones e WHERE e.codigo='2026-2S'
 AND e.resultados_visibles AND e.estado IN ('publicada','cerrada')) $function$;

-- roque_v22_ranking_publicado_2s(text,uuid,text)
CREATE OR REPLACE FUNCTION public.roque_v22_ranking_publicado_2s(p_login text, p_terminal uuid, p_edicion text DEFAULT '2026-2S'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
 v_hash text; v_exam text; v_payload jsonb; v_grado jsonb; v_curso jsonb; v_rank_areas jsonb;
BEGIN
 IF p_edicion IS DISTINCT FROM '2026-2S' OR NOT roque_private.ventana_publicacion_2s() THEN
  RETURN pg_catalog.jsonb_build_object('ok',false,'error','Edición 2026-2S aún no habilitada.');
 END IF;
 IF p_terminal IS NULL THEN
  RETURN pg_catalog.jsonb_build_object('ok',false,'error','Navegador no identificado.');
 END IF;
 IF EXISTS(SELECT 1 FROM roque_private.historial_dispositivos d WHERE d.terminal=p_terminal AND d.bloqueado) THEN
  RETURN pg_catalog.jsonb_build_object('ok',false,'error','Dispositivo bloqueado.');
 END IF;
 SELECT i.id_prueba INTO v_exam FROM roque_private.inscripciones i
 WHERE i.edicion='2026-2S' AND i.activo AND
  (lower(i.id_prueba)=lower(pg_catalog.btrim(p_login)) OR lower(i.id_alumno)=lower(pg_catalog.btrim(p_login)))
 ORDER BY i.id_prueba LIMIT 1;
 IF v_exam IS NULL OR roque_private.examen_restringido('2026-2S',v_exam) THEN
  RETURN pg_catalog.jsonb_build_object('ok',false,'error','Examen no autorizado.');
 END IF;
 v_hash:=pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(p_terminal::text,'UTF8')),'hex');
 IF NOT EXISTS(SELECT 1 FROM roque_private.perfiles_consultados q
 WHERE q.terminal_hash=v_hash AND q.id_prueba=v_exam
 AND q.ultimo_acceso>=pg_catalog.clock_timestamp()-interval '60 minutes') THEN
  RETURN pg_catalog.jsonb_build_object('ok',false,'error','Primero ingresa a este examen con el mismo navegador.');
 END IF;
 v_payload:=roque_private.ranking_calculo_por_edicion(v_exam,'2026-2S');
 IF coalesce((v_payload->>'ok')::boolean,false) IS DISTINCT FROM true THEN RETURN v_payload; END IF;
 SELECT coalesce(pg_catalog.jsonb_agg(x.rowdata),'[]'::jsonb) INTO v_grado
 FROM pg_catalog.jsonb_array_elements(coalesce(v_payload->'grado_rows','[]'::jsonb)) x(rowdata)
 WHERE x.rowdata->>'id_prueba'=v_exam;
 SELECT coalesce(pg_catalog.jsonb_agg(x.rowdata),'[]'::jsonb) INTO v_curso
 FROM pg_catalog.jsonb_array_elements(coalesce(v_payload->'curso_rows','[]'::jsonb)) x(rowdata)
 WHERE x.rowdata->>'id_prueba'=v_exam;
 WITH det AS (
  SELECT x.rowdata FROM pg_catalog.jsonb_array_elements(coalesce(v_payload->'grado_rows','[]'::jsonb)) x(rowdata)
 ), scores AS (
  SELECT d.rowdata->>'id_prueba' id_prueba,a.area,(d.rowdata->>a.key)::numeric puntaje,
  (d.rowdata->>'puntaje_global')::numeric global_score,d.rowdata->>'nombre' nombre
  FROM det d CROSS JOIN (VALUES
   ('Matemáticas','matematicas'),('Lenguaje','lenguaje'),
   ('Ciencias Naturales','naturales'),('Ciencias Sociales y Ciudadanía','sociales'),
   ('Inglés','ingles')) a(area,key)
  WHERE d.rowdata->>a.key IS NOT NULL
 ), ranks AS (
  SELECT id_prueba,area,puntaje,
   row_number() OVER(PARTITION BY area ORDER BY puntaje DESC,global_score DESC NULLS LAST,nombre,id_prueba)::int posicion,
   count(*) OVER(PARTITION BY area)::int total
  FROM scores
 )
 SELECT coalesce(pg_catalog.jsonb_object_agg(area,pg_catalog.jsonb_build_object(
   'puesto',posicion,'total',total,'puntaje',puntaje)),'{}'::jsonb)
 INTO v_rank_areas FROM ranks WHERE id_prueba=v_exam;
 RETURN pg_catalog.jsonb_set(pg_catalog.jsonb_set(v_payload,
 '{grado_rows}',v_grado,true),'{curso_rows}',v_curso,true)
 || pg_catalog.jsonb_build_object('origen_academico','roque_private','edicion','2026-2S',
 'ranking_areas',v_rank_areas);
END
$function$;

-- roque_v4_login_controlado_private(text,text,uuid,text,text)
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
 IF roque_private.ventana_publicacion_2s()
 AND v_login<>'admin' AND pg_catalog.strpos(v_login,'@')=0
 AND NOT EXISTS(SELECT 1 FROM public.docentes d WHERE d.activo AND lower(d.id_docente)=v_login)
 AND EXISTS(SELECT 1 FROM roque_private.inscripciones i WHERE i.edicion='2026-2S'
  AND i.activo AND (lower(i.id_prueba)=v_login OR lower(i.id_alumno)=v_login))
 THEN RETURN roque_private.login_estudiante_2s_publicado(p_user,p_terminal); END IF;
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
REVOKE ALL ON FUNCTION roque_private.ventana_publicacion_2s(timestamptz) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION roque_private.login_estudiante_2s_publicado(text,uuid) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.roque_v22_ranking_publicado_2s(text,uuid,text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.roque_v22_ranking_publicado_2s(text,uuid,text) TO anon,authenticated;
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
GRANT USAGE ON SCHEMA cron TO postgres;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA cron TO postgres;
SELECT cron.schedule(
 'roque_publicar_2026_2s_20261109_0000_co','0 5 9 11 *',
 $job$UPDATE roque_private.portal_access_gate
 SET pause_students=false WHERE id=1
 AND CURRENT_TIMESTAMP>=timestamptz '2026-11-09 05:00:00+00'
 AND CURRENT_TIMESTAMP<timestamptz '2026-11-10 05:00:00+00';$job$
);
