-- RoqueObjetiva v175.47 · Mover estudiantes mediante coordinación
-- Instalado en Supabase el 2026-11-05.
-- IMPORTANTE: no se incluyen códigos, contraseñas ni hashes individuales en este archivo.
-- Los códigos se entregan por separado al responsable de la institución.
CREATE TABLE IF NOT EXISTS roque_private.coordinator_move_keys (
 id_docente text PRIMARY KEY REFERENCES public.docentes(id_docente),
 clave_hash text NOT NULL,
 fallos integer NOT NULL DEFAULT 0 CHECK (fallos>=0),
 bloqueado_hasta timestamptz,
 creado_en timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS roque_private.movimientos_curso (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 edicion text NOT NULL REFERENCES roque_private.ediciones(codigo),
 id_prueba text NOT NULL,
 id_alumno text NOT NULL,
 grado smallint NOT NULL,
 sede text NOT NULL,
 curso_anterior text NOT NULL,
 curso_nuevo text NOT NULL,
 coordinador_id text NOT NULL REFERENCES public.docentes(id_docente),
 realizado_en timestamptz NOT NULL DEFAULT clock_timestamp(),
 CHECK (curso_anterior <> curso_nuevo)
);
ALTER TABLE roque_private.coordinator_move_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE roque_private.movimientos_curso ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON roque_private.coordinator_move_keys FROM PUBLIC,anon,authenticated;
REVOKE ALL ON roque_private.movimientos_curso FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.roque_v7_coordinador_listar(p_docente text, p_clave text, p_edicion text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_estudiantes jsonb;v_grupos jsonb;
BEGIN
 IF NOT roque_private.verificar_coordinador_curso(p_docente,p_clave) THEN
   RETURN jsonb_build_object('ok',false,'error','Clave de coordinación incorrecta o temporalmente bloqueada.');
 END IF;
 IF NOT EXISTS (SELECT 1 FROM roque_private.ediciones WHERE codigo=p_edicion) THEN
   RETURN jsonb_build_object('ok',false,'error','La edición solicitada no existe.');
 END IF;
 SELECT coalesce(jsonb_agg(jsonb_build_object(
   'roll',i.id_prueba,'nombre',btrim(coalesce(i.nombres,'')||' '||coalesce(i.apellidos,'')),
   'sede',coalesce(i.sede,''),'grado',i.grado,'curso',coalesce(i.grupo,'')
 ) ORDER BY i.grado,i.sede,i.grupo,i.apellidos,i.nombres),'[]'::jsonb)
 INTO v_estudiantes FROM roque_private.inscripciones i
 WHERE i.edicion=p_edicion AND i.activo;
 SELECT coalesce(jsonb_agg(jsonb_build_object('grado',g.grado,'sede',g.sede,'curso',g.grupo)
 ORDER BY g.grado,g.sede,g.grupo),'[]'::jsonb) INTO v_grupos
 FROM (
   SELECT DISTINCT grado,coalesce(sede,'') AS sede,btrim(grupo) grupo
   FROM roque_private.inscripciones
   WHERE edicion=p_edicion AND activo AND nullif(btrim(grupo),'') IS NOT NULL
   UNION
   SELECT DISTINCT c.grado,coalesce(c.sede,''),btrim(c.curso)
   FROM public.carga_docente c
   WHERE c.activo AND c.grado IS NOT NULL AND nullif(btrim(c.curso),'') IS NOT NULL
   UNION
   SELECT DISTINCT d.direccion_grado,coalesce(d.direccion_sede,''),btrim(d.direccion_grupo)
   FROM public.docentes d WHERE d.activo AND d.direccion_grado IS NOT NULL
    AND nullif(btrim(d.direccion_grupo),'') IS NOT NULL
 ) g;
 RETURN jsonb_build_object('ok',true,'edicion',p_edicion,
  'estudiantes',v_estudiantes,'cursos',v_grupos);
END $function$;

CREATE OR REPLACE FUNCTION public.roque_v7_coordinador_mover(p_docente text, p_clave text, p_edicion text, p_roll text, p_curso_anterior text, p_curso_nuevo text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_i roque_private.inscripciones%rowtype;
 v_public public.estudiantes%rowtype;
 v_rows integer;v_new text:=btrim(coalesce(p_curso_nuevo,''));
BEGIN
 IF NOT roque_private.verificar_coordinador_curso(p_docente,p_clave) THEN
  RETURN jsonb_build_object('ok',false,'error','Clave incorrecta o temporalmente bloqueada.');
 END IF;
 IF NOT EXISTS (SELECT 1 FROM roque_private.ediciones WHERE codigo=p_edicion) THEN
  RETURN jsonb_build_object('ok',false,'error','Edición inexistente.');
 END IF;
 IF v_new='' OR length(v_new)>35 OR p_curso_anterior IS NULL OR p_roll IS NULL THEN
  RETURN jsonb_build_object('ok',false,'error','Curso o estudiante inválido.');
 END IF;
 SELECT * INTO v_i FROM roque_private.inscripciones i WHERE
   i.edicion=p_edicion AND i.id_prueba=p_roll AND i.activo FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'error','Estudiante no encontrado en esta edición.');END IF;
 IF coalesce(v_i.grupo,'') IS DISTINCT FROM p_curso_anterior THEN
   RETURN jsonb_build_object('ok',false,'conflicto',true,
     'error','El curso cambió desde que abriste el listado. Actualiza antes de guardar.');
 END IF;
 IF v_new=coalesce(v_i.grupo,'') THEN
   RETURN jsonb_build_object('ok',true,'sin_cambio',true,'curso',v_new);
 END IF;
 -- La sede y el grado son INMUTABLES. Únicamente cursos existentes para esa sede y grado.
 IF NOT (
   EXISTS(SELECT 1 FROM roque_private.inscripciones i
     WHERE i.edicion=p_edicion AND i.activo AND i.grado=v_i.grado
       AND lower(coalesce(i.sede,''))=lower(coalesce(v_i.sede,''))
       AND btrim(coalesce(i.grupo,''))=v_new)
   OR EXISTS(SELECT 1 FROM public.carga_docente c
     WHERE c.activo AND c.grado=v_i.grado
       AND lower(coalesce(c.sede,''))=lower(coalesce(v_i.sede,''))
       AND btrim(coalesce(c.curso,''))=v_new)
   OR EXISTS(SELECT 1 FROM public.docentes d
     WHERE d.activo AND d.direccion_grado=v_i.grado
       AND lower(coalesce(d.direccion_sede,''))=lower(coalesce(v_i.sede,''))
       AND btrim(coalesce(d.direccion_grupo,''))=v_new)
 ) THEN RETURN jsonb_build_object('ok',false,'error','Ese curso no existe en la sede y grado del estudiante.');END IF;
 IF p_edicion='2026-1S' THEN
   SELECT * INTO v_public FROM public.estudiantes
   WHERE id_prueba=v_i.id_prueba FOR UPDATE;
   IF NOT FOUND OR v_public.id_alumno IS DISTINCT FROM v_i.id_alumno
     OR v_public.grado IS DISTINCT FROM v_i.grado
     OR lower(coalesce(v_public.sede,'')) IS DISTINCT FROM lower(coalesce(v_i.sede,''))
     OR coalesce(v_public.grupo,'') IS DISTINCT FROM coalesce(v_i.grupo,'') THEN
     RETURN jsonb_build_object('ok',false,'error','Las copias históricas no coinciden. Movimiento cancelado.');
   END IF;
   UPDATE public.estudiantes SET grupo=v_new WHERE id_prueba=v_i.id_prueba;
   GET DIAGNOSTICS v_rows=ROW_COUNT;
   IF v_rows<>1 THEN RAISE EXCEPTION 'Error al modificar copia pública del estudiante.'; END IF;
 END IF;
 UPDATE roque_private.inscripciones SET grupo=v_new
 WHERE edicion=p_edicion AND id_prueba=p_roll;
 GET DIAGNOSTICS v_rows=ROW_COUNT;
 IF v_rows<>1 THEN RAISE EXCEPTION 'Error al modificar inscripción privada.'; END IF;
 INSERT INTO roque_private.movimientos_curso
 (edicion,id_prueba,id_alumno,grado,sede,curso_anterior,curso_nuevo,coordinador_id)
 VALUES(p_edicion,v_i.id_prueba,v_i.id_alumno,v_i.grado,coalesce(v_i.sede,''),
 coalesce(v_i.grupo,''),v_new,p_docente);
 RETURN jsonb_build_object('ok',true,'edicion',p_edicion,'id_prueba',p_roll,
 'grado',v_i.grado,'sede',v_i.sede,'curso_anterior',v_i.grupo,'curso_nuevo',v_new);
END $function$;

CREATE OR REPLACE FUNCTION roque_private.verificar_coordinador_curso(p_docente text, p_clave text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_key roque_private.coordinator_move_keys%rowtype;
BEGIN
 IF p_docente IS NULL OR p_clave IS NULL OR length(p_clave) NOT BETWEEN 10 AND 60 THEN RETURN false; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.docentes d
   WHERE d.id_docente=p_docente AND d.activo AND d.coordinador) THEN RETURN false; END IF;
 SELECT * INTO v_key FROM roque_private.coordinator_move_keys WHERE id_docente=p_docente FOR UPDATE;
 IF NOT FOUND THEN RETURN false; END IF;
 IF v_key.bloqueado_hasta>clock_timestamp() THEN RETURN false; END IF;
 IF extensions.crypt(p_clave,v_key.clave_hash)=v_key.clave_hash THEN
   UPDATE roque_private.coordinator_move_keys SET fallos=0,bloqueado_hasta=NULL WHERE id_docente=p_docente;
   RETURN true;
 END IF;
 UPDATE roque_private.coordinator_move_keys SET
   fallos=CASE WHEN v_key.fallos>=4 THEN 0 ELSE v_key.fallos+1 END,
   bloqueado_hasta=CASE WHEN v_key.fallos>=4 THEN clock_timestamp()+interval '15 minutes' ELSE NULL END
 WHERE id_docente=p_docente;
 RETURN false;
END $function$;
REVOKE ALL ON FUNCTION roque_private.verificar_coordinador_curso(text,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.roque_v7_coordinador_listar(text,text,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.roque_v7_coordinador_mover(text,text,text,text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.roque_v7_coordinador_listar(text,text,text) TO anon,authenticated;
GRANT EXECUTE ON FUNCTION public.roque_v7_coordinador_mover(text,text,text,text,text,text) TO anon,authenticated;
-- Para emitir claves nuevas usar extensiones pgcrypto fuera del repositorio:
-- extensions.crypt(pin,extensions.gen_salt('bf',10))
