-- v175.113 · Optimización global de login y datos por edición.
-- No modifica notas, claves, respuestas ni restricciones individuales.
-- El login original de estudiantes y Auth se conserva en v8.

-- roque_private.login_personal_ligero(text,uuid)
CREATE OR REPLACE FUNCTION roque_private.login_personal_ligero(p_user text, p_terminal uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
 d public.docentes%ROWTYPE;
 v_privileged boolean;
 v_carga jsonb := '[]'::jsonb;
 v_directores jsonb := '[]'::jsonb;
 v_edicion text;
BEGIN
 IF p_terminal IS NULL THEN
  RETURN jsonb_build_object('ok',false,
   'error','No pudimos identificar esta instalación del navegador. Habilita el almacenamiento del sitio.');
 END IF;
 IF EXISTS (SELECT 1 FROM roque_private.historial_dispositivos h
  WHERE h.terminal=p_terminal AND h.bloqueado) THEN
  RETURN jsonb_build_object('ok',false,'motivo','dispositivo_bloqueado',
   'error','El acceso desde esta instalación del navegador está bloqueado por Administración.');
 END IF;
 IF roque_private.examen_restringido_login(p_user) THEN
  RETURN jsonb_build_object('ok',false,'restringido',true,'error','Examen restringido.');
 END IF;
 SELECT * INTO d FROM public.docentes u
 WHERE u.id_docente=btrim(coalesce(p_user,'')) AND u.activo
 LIMIT 1;
 IF NOT FOUND THEN
  RETURN jsonb_build_object('ok',false,'error','Docente no autorizado.');
 END IF;
 v_privileged:=coalesce(d.coordinador,false) OR d.rol IN ('coordinador','administrador');
 SELECT coalesce(jsonb_agg(jsonb_build_object(
   'ID',c.id_docente,'NOMBRE',coalesce(dt.nombre,c.id_docente),
   'ASIGNATURA',c.asignatura,'SEDE',coalesce(c.sede,''),
   'GRADO',c.grado::text,'CURSO',coalesce(c.curso,''),
   'COORDINADOR',case when coalesce(dt.coordinador,false)
    OR dt.rol IN ('coordinador','administrador') then 'SI' else 'NO' end
 ) ORDER BY c.grado,c.sede,c.curso,c.asignatura,dt.nombre),'[]'::jsonb)
 INTO v_carga
 FROM public.carga_docente c
 LEFT JOIN public.docentes dt ON dt.id_docente=c.id_docente
 WHERE c.activo AND (v_privileged OR c.id_docente=d.id_docente);
 SELECT coalesce(jsonb_agg(jsonb_build_object(
    'Identificación',x.id_docente,'Sede',coalesce(x.direccion_sede,''),
    'Grado',x.direccion_grado::text,'Grupo',x.direccion_grupo
 ) ORDER BY x.direccion_grado,x.direccion_sede,x.direccion_grupo),'[]'::jsonb)
 INTO v_directores
 FROM public.docentes x
 WHERE x.activo AND x.direccion_sede IS NOT NULL
  AND x.direccion_grado IS NOT NULL AND x.direccion_grupo IS NOT NULL
  AND (v_privileged OR x.id_docente=d.id_docente);
 SELECT e.codigo INTO v_edicion
 FROM roque_private.ediciones e
 WHERE e.resultados_visibles AND e.estado IN ('publicada','cerrada')
 ORDER BY e.anio DESC,e.semestre DESC LIMIT 1;
 RETURN jsonb_build_object(
   'ok',true,'role','teacher','edicion',coalesce(v_edicion,'2026-1S'),
   'origen_academico','roque_private_catalogo_staff',
   'session',jsonb_build_object('role','teacher','id',d.id_docente),
   'datasets',jsonb_build_object(
     'estudiantes','[]'::jsonb,'keys','[]'::jsonb,'resultados','[]'::jsonb,
     'carga',v_carga,'directoresGrupo',v_directores,
     'docentes','[]'::jsonb,'medidas','[]'::jsonb
   )
 );
END
$function$;

-- roque_v6_docente_datos_edicion(text,text,uuid,text)
CREATE OR REPLACE FUNCTION public.roque_v6_docente_datos_edicion(p_user text, p_edicion text, p_terminal uuid DEFAULT NULL::uuid, p_device text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
 v_teacher public.docentes%ROWTYPE;
 v_ed roque_private.ediciones%ROWTYPE;
 v_payload jsonb;
 v_datasets jsonb;
 v_ins jsonb := '[]'::jsonb;
 v_keys jsonb := '[]'::jsonb;
 v_results jsonb := '[]'::jsonb;
 v_grades integer[] := ARRAY[]::integer[];
 v_ids text[] := ARRAY[]::text[];
 v_result_count integer := 0;
 v_medidas jsonb:='[]'::jsonb;
BEGIN
 IF p_user IS NULL OR p_edicion IS NULL THEN
   RETURN pg_catalog.jsonb_build_object('ok',false,'error','Datos insuficientes.');
 END IF;
 SELECT * INTO v_teacher FROM public.docentes
 WHERE id_docente=pg_catalog.btrim(p_user) AND activo IS TRUE;
 IF NOT FOUND THEN
   RETURN pg_catalog.jsonb_build_object('ok',false,'error','Docente no autorizado.');
 END IF;
 SELECT * INTO v_ed FROM roque_private.ediciones
 WHERE codigo=pg_catalog.btrim(p_edicion);
 IF NOT FOUND THEN
   RETURN pg_catalog.jsonb_build_object('ok',false,'error','Edición inexistente.');
 END IF;
 -- Regla de publicación. Nunca revelar notas, respuestas o claves de borradores.
 IF v_ed.resultados_visibles IS DISTINCT FROM TRUE
    OR v_ed.estado NOT IN ('publicada','cerrada') THEN
   RETURN pg_catalog.jsonb_build_object('ok',false,'pendiente',true,
     'edicion',v_ed.codigo,
     'error','Esta prueba aún no tiene resultados publicados.');
 END IF;
 -- Valida al docente usando el MISMO login controlado del portal.
 v_payload := roque_private.login_personal_ligero(p_user,p_terminal);
 IF coalesce((v_payload->>'ok')::boolean,false) IS NOT TRUE
    OR v_payload->'session'->>'role' IS DISTINCT FROM 'teacher'
    OR v_payload->'session'->>'id' IS DISTINCT FROM v_teacher.id_docente THEN
   RETURN pg_catalog.jsonb_build_object('ok',false,'error','Acceso docente no autorizado.');
 END IF;
 -- Both 2026 editions are loaded from roque_private. The 2026-1S
 -- institutional/key/result copies have been checked for exact parity.
 v_datasets := coalesce(v_payload->'datasets','{}'::jsonb);
 -- Selecciona solo inscripciones dentro de la carga o dirección de este docente.
 -- Coordinadores conservan el alcance previsto por el acceso actual.
 SELECT coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
  'ID_ALUMNO',i.id_alumno,'ID_PRUEBA',i.id_prueba,
  'APELLIDOS',coalesce(i.apellidos,''),
  'NOMBRES',coalesce(i.nombres,''),
  'NOMBRE_COMPLETO',pg_catalog.btrim(coalesce(i.nombres,'')||' '||coalesce(i.apellidos,'')),
  'SEDE',coalesce(i.sede,''),
  'GRADO',i.grado::text,'GRUPO',coalesce(i.grupo,'')
 ) ORDER BY i.grado,i.sede,i.grupo,i.apellidos,i.nombres),'[]'::jsonb)
 INTO v_ins
 FROM roque_private.inscripciones i
 WHERE i.edicion=v_ed.codigo AND i.activo IS TRUE AND (
   (v_teacher.coordinador IS TRUE OR v_teacher.rol IN ('coordinador','administrador')) OR EXISTS(
     SELECT 1 FROM public.carga_docente c
     WHERE c.activo IS TRUE AND c.id_docente=v_teacher.id_docente
       AND c.grado=i.grado AND c.curso=i.grupo
       AND pg_catalog.lower(coalesce(c.sede,''))=pg_catalog.lower(coalesce(i.sede,''))
   ) OR (
     v_teacher.direccion_grado=i.grado AND v_teacher.direccion_grupo=i.grupo
     AND pg_catalog.lower(coalesce(v_teacher.direccion_sede,''))=pg_catalog.lower(coalesce(i.sede,''))
   )
 );
 SELECT coalesce(pg_catalog.array_agg(DISTINCT (j.x->>'GRADO')::integer),ARRAY[]::integer[])
 INTO v_grades FROM pg_catalog.jsonb_array_elements(v_ins) AS j(x);
 SELECT coalesce(pg_catalog.array_agg(j.x->>'ID_PRUEBA'),ARRAY[]::text[])
 INTO v_ids FROM pg_catalog.jsonb_array_elements(v_ins) AS j(x);
 SELECT coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
  'grade',t.grado,'path','SUPABASE/'||v_ed.codigo||'/KEYS_'||t.grado||'.json','rows',t.filas
 ) ORDER BY t.grado),'[]'::jsonb) INTO v_keys
 FROM (
   SELECT k.grado,pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
     'Grado',k.grado::text,'Área',k.area,'Número de ítem',k.numero_item::text,
     'Respuesta sugerida',k.respuesta_correcta,
     'Componente / pensamiento / entorno / factor / enfoque',coalesce(k.componente,''),
     'Competencia',coalesce(k.competencia,'')
   ) ORDER BY k.numero_item) AS filas
   FROM roque_private.items k
   WHERE k.edicion=v_ed.codigo AND k.activo IS TRUE
     AND k.respuesta_correcta IS NOT NULL AND pg_catalog.btrim(k.respuesta_correcta)<>''
     AND k.grado=ANY(v_grades)
   GROUP BY k.grado
 ) AS t;
 SELECT pg_catalog.count(*) INTO v_result_count
 FROM roque_private.resultados r
 WHERE r.edicion=v_ed.codigo AND r.activo IS TRUE
   AND r.id_prueba=ANY(v_ids);
 IF v_result_count=0 THEN
   RETURN pg_catalog.jsonb_build_object('ok',false,'sin_resultados',true,
     'edicion',v_ed.codigo,'error','Aún no hay resultados disponibles para tus cursos en esta prueba.');
 END IF;
 SELECT coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
  'grade',g.grado,'session',0,'startItem',1,
  'path','SUPABASE/'||v_ed.codigo||'/RESULTADOS_'||g.grado||'.json',
  'rows',g.filas
 ) ORDER BY g.grado),'[]'::jsonb) INTO v_results
 FROM (
   SELECT i.grado,pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object('Roll No',r.id_prueba,
 'respuestas',roque_private.mascara_respuestas_medidas(v_ed.codigo,r.id_prueba,i.grado,r.respuestas))
      ORDER BY r.id_prueba) filas
   FROM roque_private.resultados r JOIN roque_private.inscripciones i
     ON i.edicion=r.edicion AND i.id_prueba=r.id_prueba
   WHERE r.edicion=v_ed.codigo AND r.activo IS TRUE AND i.activo IS TRUE
     AND r.id_prueba=ANY(v_ids)
   GROUP BY i.grado
 ) g;
 SELECT coalesce(jsonb_agg(roque_private.resumen_medidas(v_ed.codigo,
 j.x->>'ID_PRUEBA',coalesce(nullif(j.x->>'GRADO','')::integer,0))),'[]'::jsonb)
 INTO v_medidas FROM pg_catalog.jsonb_array_elements(v_ins) j(x);
 RETURN pg_catalog.jsonb_set(v_payload,'{datasets}',v_datasets ||
      pg_catalog.jsonb_build_object('estudiantes',v_ins,'keys',v_keys,'resultados',v_results,'medidas',v_medidas),true)
    || pg_catalog.jsonb_build_object('edicion',v_ed.codigo,
       'origen_academico','roque_private','resultados_revisados',v_result_count);
END
$function$;

-- roque_v8_login_controlado_private(text,text,uuid,text,text)
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
 v_roll text;
 v_persona uuid;
 v_ediciones jsonb;
BEGIN
 IF pg_catalog.btrim(coalesce(p_user,'')) IN ('19616753','jm')
 AND EXISTS(
   SELECT 1 FROM public.docentes d
   WHERE d.id_docente=pg_catalog.btrim(p_user) AND d.activo
     AND pg_catalog.lower(pg_catalog.btrim(d.nombre))='jaider moreno'
     AND (d.rol IN ('coordinador','administrador') OR d.coordinador)
 ) THEN
   v_payload:=roque_private.login_jaider_ligero(p_user,p_terminal);
 ELSIF EXISTS (
   SELECT 1 FROM public.docentes u
   WHERE u.id_docente=pg_catalog.btrim(coalesce(p_user,'')) AND u.activo
 ) THEN
   v_payload:=roque_private.login_personal_ligero(p_user,p_terminal);
 ELSE
   v_payload:=public.roque_v4_login_controlado_private(p_user,p_password,p_terminal,p_device,p_mode);
 END IF;
 -- Las ediciones se resuelven con persona_id tras autenticar al estudiante.
 IF coalesce((v_payload->>'ok')::boolean,false) IS TRUE
    AND v_payload->'session'->>'role' = 'student' THEN
   v_roll := pg_catalog.btrim(coalesce(v_payload->'session'->>'roll',''));
   IF v_roll <> '' THEN
     SELECT i.persona_id INTO v_persona
       FROM roque_private.inscripciones i
       WHERE i.id_prueba=v_roll AND i.activo
       ORDER BY CASE WHEN i.edicion=coalesce(nullif(v_payload->>'edicion',''),'2026-1S')
                     THEN 0 ELSE 1 END
       LIMIT 1;
     SELECT coalesce(pg_catalog.jsonb_agg(elegible.edicion ORDER BY elegible.edicion),'[]'::jsonb)
       INTO v_ediciones
       FROM (
         SELECT DISTINCT i.edicion
         FROM roque_private.inscripciones i
         JOIN roque_private.ediciones e ON e.codigo=i.edicion
         WHERE i.persona_id=v_persona AND i.activo
           AND e.resultados_visibles AND e.estado IN ('publicada','cerrada')
       ) elegible;
     v_payload:=v_payload || pg_catalog.jsonb_build_object('ediciones_inscritas',v_ediciones);
   END IF;
 END IF;
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

REVOKE ALL ON FUNCTION roque_private.login_personal_ligero(text,uuid) FROM PUBLIC,anon,authenticated,service_role;
