-- RoqueObjetiva v172 | Instalacion idempotente.
-- Historial solo por cuenta Supabase Auth, sin ampliar IDs antiguos a otras ediciones.
CREATE TABLE IF NOT EXISTS roque_private.cuentas_estudiante (
 user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
 persona_id uuid UNIQUE NOT NULL REFERENCES roque_private.personas(id),
 activo boolean NOT NULL DEFAULT true,
 creado_en timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE roque_private.cuentas_estudiante ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON roque_private.cuentas_estudiante FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.roque_v5_admin_vincular_estudiante(p_usuario_auth uuid, p_persona uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS(
  SELECT 1 FROM roque_private.operadores_admin
  WHERE user_id=auth.uid() AND activo
 ) THEN RETURN jsonb_build_object('ok',false,'error','No autorizado'); END IF;
 IF p_usuario_auth IS NULL OR p_persona IS NULL
    OR NOT EXISTS(SELECT 1 FROM auth.users WHERE id=p_usuario_auth)
    OR NOT EXISTS(SELECT 1 FROM roque_private.personas WHERE id=p_persona)
 THEN RETURN jsonb_build_object('ok',false,'error','Cuenta o persona inexistente'); END IF;
 IF EXISTS(SELECT 1 FROM roque_private.cuentas_estudiante
           WHERE persona_id=p_persona AND user_id<>p_usuario_auth) THEN
  RETURN jsonb_build_object('ok',false,'error','La persona ya tiene otra cuenta vinculada');
 END IF;
 INSERT INTO roque_private.cuentas_estudiante(user_id,persona_id,activo)
 VALUES(p_usuario_auth,p_persona,true)
 ON CONFLICT(user_id) DO UPDATE SET persona_id=excluded.persona_id,activo=true;
 RETURN jsonb_build_object('ok',true);
END $function$

CREATE OR REPLACE FUNCTION public.roque_v5_historial_autorizado(p_edicion text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
 v_persona uuid; v_ediciones jsonb; v_i record;
 v_keys jsonb; v_results jsonb; v_rank jsonb;
 v_grado jsonb; v_curso jsonb; v_areas jsonb;
BEGIN
 IF auth.uid() IS NULL THEN RETURN jsonb_build_object('ok',false,'error','Inicia sesion'); END IF;
 SELECT persona_id INTO v_persona FROM roque_private.cuentas_estudiante
 WHERE user_id=auth.uid() AND activo;
 IF v_persona IS NULL THEN RETURN jsonb_build_object('ok',false,'error','La cuenta no esta vinculada al historial'); END IF;
 SELECT coalesce(jsonb_agg(jsonb_build_object(
  'codigo',e.codigo,'titulo',e.titulo,'anio',e.anio,'semestre',e.semestre)
  ORDER BY e.anio DESC,e.semestre DESC),'[]'::jsonb) INTO v_ediciones
 FROM roque_private.inscripciones i JOIN roque_private.ediciones e ON e.codigo=i.edicion
 WHERE i.persona_id=v_persona AND i.activo
  AND e.resultados_visibles AND e.estado IN('publicada','cerrada');
 IF p_edicion IS NULL THEN
  RETURN jsonb_build_object('ok',true,'ediciones',v_ediciones);
 END IF;
 SELECT i.id_prueba,i.id_alumno,i.apellidos,i.nombres,i.grado,i.sede,i.grupo
 INTO v_i FROM roque_private.inscripciones i JOIN roque_private.ediciones e
 ON e.codigo=i.edicion
 WHERE i.persona_id=v_persona AND i.edicion=p_edicion AND i.activo
 AND e.resultados_visibles AND e.estado IN('publicada','cerrada');
 IF NOT FOUND THEN
  RETURN jsonb_build_object('ok',false,'error','Evaluacion no autorizada o no publicada');
 END IF;
 SELECT coalesce(jsonb_agg(jsonb_build_object(
  'Grado',k.grado::text,'Área',k.area,'Número de ítem',k.numero_item::text,
  'Respuesta sugerida',k.respuesta_correcta,
  'Componente / pensamiento / entorno / factor / enfoque',coalesce(k.componente,''),
  'Competencia',coalesce(k.competencia,'')) ORDER BY k.numero_item),'[]'::jsonb)
 INTO v_keys FROM roque_private.items k
 WHERE k.edicion=p_edicion AND k.grado=v_i.grado AND k.activo
 AND k.respuesta_correcta IS NOT NULL;
 SELECT coalesce(jsonb_agg(jsonb_build_object('Roll No',r.id_prueba,
  'respuestas',r.respuestas)),'[]'::jsonb) INTO v_results
 FROM roque_private.resultados r
 WHERE r.edicion=p_edicion AND r.id_prueba=v_i.id_prueba AND r.activo;
 v_rank:=roque_private.ranking_calculo_por_edicion(v_i.id_prueba,p_edicion);
 IF coalesce((v_rank->>'ok')::boolean,false) THEN
  SELECT coalesce(jsonb_agg(x.fila),'[]'::jsonb) INTO v_grado
  FROM pg_catalog.jsonb_array_elements(coalesce(v_rank->'grado_rows','[]'::jsonb)) x(fila)
  WHERE x.fila->>'id_prueba'=v_i.id_prueba;
  SELECT coalesce(jsonb_agg(x.fila),'[]'::jsonb) INTO v_curso
  FROM pg_catalog.jsonb_array_elements(coalesce(v_rank->'curso_rows','[]'::jsonb)) x(fila)
  WHERE x.fila->>'id_prueba'=v_i.id_prueba;
  WITH filas AS (
   SELECT x.fila FROM pg_catalog.jsonb_array_elements(coalesce(v_rank->'grado_rows','[]'::jsonb)) x(fila)
  ), scores AS (
   SELECT f.fila->>'id_prueba' AS id_prueba,
     a.area,(f.fila->>a.key)::numeric AS puntaje,
     (f.fila->>'puntaje_global')::numeric AS global,
     f.fila->>'nombre' AS nombre
   FROM filas f CROSS JOIN (VALUES
    ('Matemáticas','matematicas'),('Lenguaje','lenguaje'),
    ('Ciencias Naturales','naturales'),
    ('Ciencias Sociales y Ciudadanía','sociales'),('Inglés','ingles')
   ) a(area,key)
   WHERE f.fila->>a.key IS NOT NULL
  ), puestos AS (
   SELECT id_prueba,area,puntaje,
     row_number() OVER(PARTITION BY area ORDER BY puntaje DESC,global DESC NULLS LAST,nombre,id_prueba)::int puesto,
     count(*) OVER(PARTITION BY area)::int total
   FROM scores
  )
  SELECT coalesce(jsonb_object_agg(area,jsonb_build_object('puesto',puesto,
   'total',total,'puntaje',puntaje)),'{}'::jsonb)
  INTO v_areas FROM puestos WHERE id_prueba=v_i.id_prueba;
 ELSE
  v_grado:='[]'::jsonb;v_curso:='[]'::jsonb;v_areas:='{}'::jsonb;
 END IF;
 RETURN jsonb_build_object(
  'ok',true,'edicion',p_edicion,'ediciones',v_ediciones,
  'origen_academico','roque_private_auth_v172',
  'session',jsonb_build_object('role','student','roll',v_i.id_prueba),
  'ranking_personal',jsonb_build_object(
    'ranking',coalesce(v_rank->'ranking','{}'::jsonb),
    'grado_rows',v_grado,'curso_rows',v_curso,'ranking_areas',v_areas),
  'datasets',jsonb_build_object(
   'estudiantes',jsonb_build_array(jsonb_build_object(
    'ID_ALUMNO',v_i.id_alumno,'ID_PRUEBA',v_i.id_prueba,
    'APELLIDOS',coalesce(v_i.apellidos,''),'NOMBRES',coalesce(v_i.nombres,''),
    'NOMBRE_COMPLETO',pg_catalog.btrim(coalesce(v_i.nombres,'')||' '||coalesce(v_i.apellidos,'')),
    'SEDE',coalesce(v_i.sede,''),'GRADO',v_i.grado::text,'GRUPO',coalesce(v_i.grupo,''))),
   'keys',jsonb_build_array(jsonb_build_object('grade',v_i.grado,
    'path','SUPABASE/'||p_edicion||'/KEYS_'||v_i.grado||'.json','rows',v_keys)),
   'resultados',jsonb_build_array(jsonb_build_object('grade',v_i.grado,
    'session',0,'startItem',1,
    'path','SUPABASE/'||p_edicion||'/RESULTADOS_'||v_i.grado||'.json','rows',v_results)),
   'carga','[]'::jsonb,'docentes','[]'::jsonb,'directoresGrupo','[]'::jsonb)
 );
END $function$

REVOKE ALL ON FUNCTION public.roque_v5_admin_vincular_estudiante(uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.roque_v5_admin_vincular_estudiante(uuid,uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.roque_v5_historial_autorizado(text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.roque_v5_historial_autorizado(text) TO authenticated;
