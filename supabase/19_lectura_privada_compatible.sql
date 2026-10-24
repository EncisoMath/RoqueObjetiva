-- v169. Lectura academica por edicion: login y autorizacion siguen en roque_v2_login_controlado.
CREATE OR REPLACE FUNCTION public.roque_v4_login_controlado_private(
 p_user text, p_password text DEFAULT ''::text, p_terminal uuid DEFAULT NULL::uuid,
 p_device text DEFAULT NULL::text, p_mode text DEFAULT NULL::text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $f$
DECLARE
 o jsonb; d jsonb; ins jsonb; keys_new jsonb; results_new jsonb;
 ed text := '2026-1S'; olds integer; news integer; oldk integer; newk integer; oldr integer; newr integer;
BEGIN
 -- Los limites diarios, bloqueos y roles se comprueban antes de tocar roque_private.
 o := public.roque_v2_login_controlado(p_user,p_password,p_terminal,p_device,p_mode);
 IF coalesce((o->>'ok')::boolean,false) IS NOT TRUE THEN RETURN o; END IF;
 IF NOT EXISTS (SELECT 1 FROM roque_private.ediciones
    WHERE codigo=ed AND resultados_visibles AND estado IN ('publicada','cerrada')) THEN
   RETURN o || jsonb_build_object('origen_academico','legacy_edicion_no_visible');
 END IF;
 d := coalesce(o->'datasets','{}'::jsonb);
 -- Paridad completa antes del cambio de lectura. Si un admin edita una fila
 -- en public, la app continua por la ruta historica hasta reconciliarla.
 IF (SELECT count(*) FROM public.estudiantes e FULL JOIN roque_private.inscripciones i
       ON i.edicion=ed AND i.id_prueba=e.id_prueba
       WHERE e.id_prueba IS NULL OR i.id_prueba IS NULL OR e.id_alumno IS DISTINCT FROM i.id_alumno
         OR e.grado IS DISTINCT FROM i.grado OR e.sede IS DISTINCT FROM i.sede
         OR e.grupo IS DISTINCT FROM i.grupo OR e.apellidos IS DISTINCT FROM i.apellidos
         OR e.nombres IS DISTINCT FROM i.nombres OR e.activo IS DISTINCT FROM i.activo) > 0
 OR (SELECT count(*) FROM public.resultados r FULL JOIN roque_private.resultados n
       ON n.edicion=ed AND n.id_prueba=r.id_prueba
       WHERE r.id_prueba IS NULL OR n.id_prueba IS NULL
         OR r.respuestas IS DISTINCT FROM n.respuestas OR r.activo IS DISTINCT FROM n.activo) > 0
 OR (SELECT count(*) FROM public.claves k FULL JOIN roque_private.items n
       ON n.edicion=ed AND n.grado=k.grado AND n.numero_item=k.numero_item
       WHERE k.id IS NULL OR n.numero_item IS NULL OR k.area IS DISTINCT FROM n.area
         OR k.respuesta_sugerida IS DISTINCT FROM n.respuesta_correcta
         OR k.activo IS DISTINCT FROM n.activo OR k.componente IS DISTINCT FROM n.componente
         OR k.competencia IS DISTINCT FROM n.competencia) > 0 THEN
    RETURN o || jsonb_build_object('origen_academico','legacy_respaldo_diferencia','edicion',ed);
 END IF;
 -- Respetar estrictamente la lista de ID_PRUEBA que el login autorizo.
 SELECT coalesce(jsonb_agg(jsonb_build_object(
  'ID_ALUMNO',i.id_alumno,'ID_PRUEBA',i.id_prueba,
  'APELLIDOS',coalesce(i.apellidos,''),'NOMBRES',coalesce(i.nombres,''),
  'NOMBRE_COMPLETO',trim(coalesce(i.nombres,'')||' '||coalesce(i.apellidos,'')),
  'SEDE',coalesce(i.sede,''),'GRADO',i.grado::text,'GRUPO',coalesce(i.grupo,'')
 ) ORDER BY i.grado,i.sede,i.grupo,i.apellidos,i.nombres),'[]'::jsonb)
 INTO ins
 FROM roque_private.inscripciones i WHERE i.edicion=ed AND i.activo
   AND EXISTS(SELECT 1 FROM jsonb_array_elements(coalesce(d->'estudiantes','[]'::jsonb)) src(x)
              WHERE src.x->>'ID_PRUEBA'=i.id_prueba);
 SELECT coalesce(jsonb_agg(jsonb_build_object(
   'grade',x.grado,'path','SUPABASE/KEYS_'||x.grado||'.json','rows',x.filas
 ) ORDER BY x.grado),'[]'::jsonb) INTO keys_new
 FROM (
   SELECT k.grado,jsonb_agg(jsonb_build_object(
     'Grado',k.grado::text,'Área',k.area,
     'Número de ítem',k.numero_item::text,'Respuesta sugerida',k.respuesta_correcta,
     'Componente / pensamiento / entorno / factor / enfoque',coalesce(k.componente,''),
     'Competencia',coalesce(k.competencia,'')
   ) ORDER BY k.numero_item) filas
   FROM roque_private.items k
   WHERE k.edicion=ed AND k.activo AND k.respuesta_correcta IS NOT NULL
     AND EXISTS(SELECT 1 FROM jsonb_array_elements(coalesce(d->'keys','[]'::jsonb)) src(x)
                WHERE src.x->>'grade'=k.grado::text)
   GROUP BY k.grado
 ) x;
 -- JSON de respuestas mantiene los numeros globales, sin rangos de area fijos.
 SELECT coalesce(jsonb_agg(jsonb_build_object(
   'grade',x.grado,'session',0,'startItem',1,
   'path','SUPABASE/'||ed||'/RESULTADOS_'||x.grado||'.json','rows',x.filas
 ) ORDER BY x.grado),'[]'::jsonb) INTO results_new
 FROM (
   SELECT i.grado,jsonb_agg(jsonb_build_object('Roll No',r.id_prueba,
     'respuestas',r.respuestas) ORDER BY r.id_prueba) filas
   FROM roque_private.resultados r JOIN roque_private.inscripciones i
     ON i.edicion=r.edicion AND i.id_prueba=r.id_prueba
   WHERE r.edicion=ed AND r.activo AND i.activo
     AND EXISTS(SELECT 1 FROM jsonb_array_elements(coalesce(d->'estudiantes','[]'::jsonb)) src(x)
                WHERE src.x->>'ID_PRUEBA'=r.id_prueba)
   GROUP BY i.grado
 ) x;
 -- Respaldo automatico si las listas autorizadas dejan de coincidir.
 olds:=jsonb_array_length(coalesce(d->'estudiantes','[]'::jsonb));news:=jsonb_array_length(ins);
 SELECT coalesce(sum(jsonb_array_length(x.j->'rows')),0)::int INTO oldk
 FROM jsonb_array_elements(coalesce(d->'keys','[]'::jsonb)) x(j);
 SELECT coalesce(sum(jsonb_array_length(x.j->'rows')),0)::int INTO newk
 FROM jsonb_array_elements(keys_new) x(j);
 SELECT count(DISTINCT r.j->>'Roll No')::int INTO oldr
 FROM jsonb_array_elements(coalesce(d->'resultados','[]'::jsonb)) x(j),
 LATERAL jsonb_array_elements(x.j->'rows') r(j);
 SELECT coalesce(sum(jsonb_array_length(x.j->'rows')),0)::int INTO newr
 FROM jsonb_array_elements(results_new) x(j);
 IF olds<>news OR oldk<>newk OR oldr<>newr THEN
   RETURN o || jsonb_build_object('origen_academico','legacy_respaldo_cantidad','edicion',ed);
 END IF;
 RETURN jsonb_set(o,'{datasets}',d || jsonb_build_object(
  'estudiantes',ins,'keys',keys_new,'resultados',results_new),true)
  || jsonb_build_object('origen_academico','roque_private','edicion',ed);
END $f$;
REVOKE ALL ON FUNCTION public.roque_v4_login_controlado_private(text,text,uuid,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.roque_v4_login_controlado_private(text,text,uuid,text,text) TO anon,authenticated;