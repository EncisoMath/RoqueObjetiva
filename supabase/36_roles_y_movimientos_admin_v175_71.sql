-- RoqueObjetiva v175.71: función administrativa de movimientos, auditoría y restricción de Claves.
-- Aplicar después de 35_roles_y_areas_docentes_v175_69.sql.
CREATE TABLE IF NOT EXISTS roque_private.movimientos_curso_admin (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 edicion text NOT NULL REFERENCES roque_private.ediciones(codigo),
 id_prueba text NOT NULL,id_alumno text NOT NULL,grado integer NOT NULL,
 sede text NOT NULL,curso_anterior text NOT NULL,curso_nuevo text NOT NULL,
 admin_user uuid NOT NULL REFERENCES auth.users(id),
 creado_en timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX IF NOT EXISTS idx_movimientos_curso_admin_fecha
 ON roque_private.movimientos_curso_admin(edicion,creado_en DESC);
ALTER TABLE roque_private.movimientos_curso_admin ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE roque_private.movimientos_curso_admin FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.roque_v12_claves_consultar(p_edicion text, p_grado integer DEFAULT NULL::integer, p_docente text DEFAULT NULL::text, p_sesion text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
 v_admin boolean;
 v_coord boolean;
 v_grado integer;
 v_estado text;
 v_items jsonb;
 v_grados jsonb;
 v_last timestamptz;
BEGIN
 v_admin := auth.uid() IS NOT NULL AND EXISTS(
   SELECT 1 FROM roque_private.operadores_admin o
   WHERE o.user_id=auth.uid() AND o.activo IS TRUE
 );
 v_coord := false;
 IF NOT v_admin THEN
   RAISE EXCEPTION 'Solo administración puede consultar claves.' USING ERRCODE='42501';
 END IF;
 SELECT e.estado INTO v_estado FROM roque_private.ediciones e WHERE e.codigo=p_edicion;
 IF NOT FOUND THEN RAISE EXCEPTION 'Edición inexistente.' USING ERRCODE='22023'; END IF;
 IF p_grado IS NOT NULL AND (p_grado<1 OR p_grado>11) THEN
   RAISE EXCEPTION 'Grado incorrecto.' USING ERRCODE='22023';
 END IF;
 SELECT coalesce(jsonb_agg(g.grado ORDER BY g.grado),'[]'::jsonb)
 INTO v_grados
 FROM (SELECT DISTINCT i.grado FROM roque_private.items i
       WHERE i.edicion=p_edicion AND i.activo)g;
 v_grado:=p_grado;
 IF v_grado IS NULL THEN
   SELECT CASE WHEN EXISTS(SELECT 1 FROM roque_private.items i WHERE i.edicion=p_edicion AND i.grado=10 AND i.activo)
     THEN 10 ELSE (SELECT min(i.grado) FROM roque_private.items i WHERE i.edicion=p_edicion AND i.activo) END
   INTO v_grado;
 END IF;
 SELECT coalesce(jsonb_agg(jsonb_build_object(
   'numero_item', i.numero_item,
   'sesion', i.sesion,
   'numero_en_sesion', i.numero_en_sesion,
   'area', i.area,
   'correcta', i.respuesta_correcta,
   'anulada', i.anulada
 ) ORDER BY i.sesion,i.numero_en_sesion),'[]'::jsonb)
 INTO v_items FROM roque_private.items i
 WHERE i.edicion=p_edicion AND i.grado=v_grado AND i.activo;
 SELECT greatest(
   (SELECT max(a.creado_en) FROM roque_private.auditoria_correcciones a
    WHERE a.edicion=p_edicion AND a.grado=v_grado AND a.tipo='clave'),
   (SELECT max(c.creado_en) FROM roque_private.auditoria_anulaciones_coordinador c
    WHERE c.edicion=p_edicion AND c.grado=v_grado)
 ) INTO v_last;
 RETURN jsonb_build_object(
   'ok',true,'edicion',p_edicion,'grado',v_grado,'grados',v_grados,
   'estado',v_estado,'editable',v_admin,
   'permite_anular',v_admin AND v_estado='borrador',
   'motivo_requerido',v_admin AND v_estado<>'borrador',
   'ultima_edicion',v_last,'items',v_items
 );
END;
$function$;

CREATE OR REPLACE FUNCTION public.roque_v14_admin_mover_guardar(p_edicion text, p_roll text, p_curso_anterior text, p_curso_nuevo text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_i roque_private.inscripciones%rowtype;
 v_public public.estudiantes%rowtype;
 v_rows integer;v_new text:=btrim(coalesce(p_curso_nuevo,''));
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS (
 SELECT 1 FROM roque_private.operadores_admin a WHERE a.user_id=auth.uid() AND a.activo
) THEN RETURN jsonb_build_object('ok',false,'error','Solo administradores autorizados.'); END IF;
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
 INSERT INTO roque_private.movimientos_curso_admin
 (edicion,id_prueba,id_alumno,grado,sede,curso_anterior,curso_nuevo,admin_user)
 VALUES(p_edicion,v_i.id_prueba,v_i.id_alumno,v_i.grado,coalesce(v_i.sede,''),
 coalesce(v_i.grupo,''),v_new,auth.uid());
 RETURN jsonb_build_object('ok',true,'edicion',p_edicion,'id_prueba',p_roll,
 'grado',v_i.grado,'sede',v_i.sede,'curso_anterior',v_i.grupo,'curso_nuevo',v_new);
END $function$;

CREATE OR REPLACE FUNCTION public.roque_v14_admin_mover_listar(p_edicion text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_estudiantes jsonb;v_grupos jsonb;
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS (
 SELECT 1 FROM roque_private.operadores_admin a WHERE a.user_id=auth.uid() AND a.activo
) THEN RETURN jsonb_build_object('ok',false,'error','Solo administradores autorizados.'); END IF;
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

REVOKE ALL ON FUNCTION public.roque_v14_admin_mover_listar(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.roque_v14_admin_mover_listar(text) TO authenticated;
REVOKE ALL ON FUNCTION public.roque_v14_admin_mover_guardar(text,text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.roque_v14_admin_mover_guardar(text,text,text,text) TO authenticated;
REVOKE ALL ON FUNCTION public.roque_v12_claves_anular_coordinador(text,integer,integer,boolean,text,text)
 FROM PUBLIC,anon,authenticated;
