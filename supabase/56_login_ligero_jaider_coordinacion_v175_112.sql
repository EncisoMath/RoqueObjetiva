-- v175.112 · Corrección accesos Jaider Moreno (coordinador académico)
-- Protección de rol validado con public.docentes + check del bloqueo de dispositivo.
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

CREATE OR REPLACE FUNCTION roque_private.login_jaider_ligero(p_user text, p_terminal uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
 d public.docentes%ROWTYPE;
 v_ins jsonb;v_carga jsonb;v_keys jsonb;
BEGIN
 IF p_terminal IS NULL THEN
   RETURN pg_catalog.jsonb_build_object('ok',false,
     'error','No pudimos identificar esta instalación del navegador. Habilita el almacenamiento del sitio.');
 END IF;
 IF EXISTS (SELECT 1 FROM roque_private.historial_dispositivos h
            WHERE h.terminal=p_terminal AND h.bloqueado) THEN
   RETURN pg_catalog.jsonb_build_object('ok',false,'motivo','dispositivo_bloqueado',
      'error','El acceso desde esta instalación del navegador está bloqueado por Administración.');
 END IF;
 SELECT * INTO d FROM public.docentes x
 WHERE x.activo AND x.id_docente=pg_catalog.btrim(coalesce(p_user,''))
   AND x.id_docente IN ('19616753','jm')
   AND pg_catalog.lower(pg_catalog.btrim(x.nombre))='jaider moreno'
   AND (x.rol IN ('coordinador','administrador') OR x.coordinador)
 LIMIT 1;
 IF NOT FOUND THEN
   RETURN pg_catalog.jsonb_build_object('ok',false,'error','Docente no autorizado.');
 END IF;
 -- Lightweight 2S institutional catalog keeps existing administrative
 -- student/course filters functional; exam results remain server-side in RPCs.
 SELECT coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
  'ID_ALUMNO',i.id_alumno,'ID_PRUEBA',i.id_prueba,
  'APELLIDOS',coalesce(i.apellidos,''),'NOMBRES',coalesce(i.nombres,''),
  'NOMBRE_COMPLETO',pg_catalog.btrim(coalesce(i.nombres,'')||' '||coalesce(i.apellidos,'')),
  'SEDE',coalesce(i.sede,''),'GRADO',i.grado::text,'GRUPO',coalesce(i.grupo,'')
 ) ORDER BY i.grado,i.sede,i.grupo,i.apellidos,i.nombres),'[]'::jsonb)
 INTO v_ins FROM roque_private.inscripciones i
 WHERE i.edicion='2026-2S' AND i.activo;
 SELECT coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
  'ID',c.id_docente,'NOMBRE',coalesce(dt.nombre,c.id_docente),
  'ASIGNATURA',c.asignatura,'SEDE',coalesce(c.sede,''),
  'GRADO',c.grado::text,'CURSO',coalesce(c.curso,''),
  'COORDINADOR',CASE WHEN coalesce(dt.coordinador,false)
     OR dt.rol IN ('coordinador','administrador') THEN 'SI' ELSE 'NO' END
 ) ORDER BY c.id_docente,c.grado,c.sede,c.curso,c.asignatura),'[]'::jsonb)
 INTO v_carga FROM public.carga_docente c
 LEFT JOIN public.docentes dt ON dt.id_docente=c.id_docente
 WHERE c.activo;
 SELECT coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
   'grade',x.grado,'path','SUPABASE/2026-2S/KEYS_'||x.grado||'.json','rows',x.rows
 ) ORDER BY x.grado),'[]'::jsonb)
 INTO v_keys FROM (
   SELECT k.grado,pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
     'Grado',k.grado::text,'Área',k.area,
     'Número de ítem',k.numero_item::text,
     'Respuesta sugerida',k.respuesta_correcta,
     'Componente / pensamiento / entorno / factor / enfoque',coalesce(k.componente,''),
     'Competencia',coalesce(k.competencia,'')
   ) ORDER BY k.numero_item) AS rows
   FROM roque_private.items k
   WHERE k.edicion='2026-2S' AND k.activo AND NOT k.anulada
    AND k.respuesta_correcta IS NOT NULL
   GROUP BY k.grado
 ) x;
 RETURN pg_catalog.jsonb_build_object(
   'ok',true,'role','teacher','edicion','2026-2S',
   'origen_academico','roque_private_catalogo_staff',
   'session',pg_catalog.jsonb_build_object('role','teacher','id',d.id_docente),
   'datasets',pg_catalog.jsonb_build_object(
     'estudiantes',v_ins,'carga',v_carga,'docentes','[]'::jsonb,
     'directoresGrupo','[]'::jsonb,'keys',v_keys,
     'resultados','[]'::jsonb,'medidas','[]'::jsonb
   )
 );
END
$function$;
REVOKE ALL ON FUNCTION roque_private.login_jaider_ligero(text,uuid) FROM PUBLIC,anon,authenticated,service_role;
