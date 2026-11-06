-- v175.64: coordinadores pueden anular/reactivar ítems únicamente en borrador.
-- Se conserva la RPC de administración para editar letras, y su auditoría.
CREATE TABLE IF NOT EXISTS roque_private.auditoria_anulaciones_coordinador (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 edicion text NOT NULL REFERENCES roque_private.ediciones(codigo),
 grado smallint NOT NULL,
 numero_item integer NOT NULL,
 anulada_antes boolean NOT NULL,
 anulada_nueva boolean NOT NULL,
 id_docente text NOT NULL,
 creado_en timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX IF NOT EXISTS auditoria_anulaciones_coordinador_edicion_grado_fecha_idx
 ON roque_private.auditoria_anulaciones_coordinador(edicion,grado,creado_en DESC);
ALTER TABLE roque_private.auditoria_anulaciones_coordinador ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE roque_private.auditoria_anulaciones_coordinador FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.roque_v12_claves_anular_coordinador(
 p_edicion text,p_grado integer,p_numero_item integer,
 p_anulada_antes boolean,p_docente text,p_sesion text
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $fn$
DECLARE
 v_estado text;
 v_row roque_private.items%ROWTYPE;
 v_anulada_nueva boolean;
BEGIN
 IF NOT roque_private.validar_coordinador_sesion(p_docente,p_sesion) THEN
  RAISE EXCEPTION 'Sesión de coordinador no autorizada o vencida.' USING ERRCODE='42501';
 END IF;
 IF p_grado IS NULL OR p_grado NOT BETWEEN 1 AND 11
    OR p_numero_item IS NULL OR p_numero_item<=0 OR p_anulada_antes IS NULL THEN
  RAISE EXCEPTION 'Grado, ítem o estado anterior incorrectos.' USING ERRCODE='22023';
 END IF;
 SELECT e.estado INTO v_estado FROM roque_private.ediciones e
  WHERE e.codigo=p_edicion FOR SHARE;
 IF NOT FOUND OR v_estado<>'borrador' THEN
  RAISE EXCEPTION 'Solo se permiten anulaciones en una edición en borrador.' USING ERRCODE='42501';
 END IF;
 SELECT * INTO v_row FROM roque_private.items i
  WHERE i.edicion=p_edicion AND i.grado=p_grado AND i.numero_item=p_numero_item
    AND i.activo IS TRUE FOR UPDATE;
 IF NOT FOUND THEN
  RAISE EXCEPTION 'El ítem no existe o está inactivo.' USING ERRCODE='22023';
 END IF;
 IF v_row.anulada IS DISTINCT FROM p_anulada_antes THEN
  RAISE EXCEPTION 'El estado del ítem cambió en otra sesión. Actualiza la pantalla.' USING ERRCODE='40001';
 END IF;
 v_anulada_nueva:=NOT v_row.anulada;
 IF v_anulada_nueva IS FALSE AND v_row.respuesta_correcta IS NULL THEN
  RAISE EXCEPTION 'El administrador debe asignar una clave correcta antes de reactivar este ítem.' USING ERRCODE='22023';
 END IF;
 UPDATE roque_private.items SET anulada=v_anulada_nueva
 WHERE edicion=p_edicion AND grado=p_grado AND numero_item=p_numero_item;
 INSERT INTO roque_private.auditoria_anulaciones_coordinador
  (edicion,grado,numero_item,anulada_antes,anulada_nueva,id_docente)
 VALUES(p_edicion,p_grado,p_numero_item,p_anulada_antes,v_anulada_nueva,p_docente);
 RETURN jsonb_build_object('ok',true,'cambios',1,'edicion',p_edicion,
  'grado',p_grado,'numero_item',p_numero_item,'anulada',v_anulada_nueva);
END;
$fn$;
REVOKE ALL ON FUNCTION public.roque_v12_claves_anular_coordinador(
 text,integer,integer,boolean,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.roque_v12_claves_anular_coordinador(
 text,integer,integer,boolean,text,text) TO anon,authenticated;

-- Consolida permisos al consultar sin habilitar la escritura de letras correctas.
CREATE OR REPLACE FUNCTION public.roque_v12_claves_consultar(
 p_edicion text,
 p_grado integer DEFAULT NULL,
 p_docente text DEFAULT NULL,
 p_sesion text DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $fn$
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
   v_coord := roque_private.validar_coordinador_sesion(p_docente,p_sesion);
 END IF;
 IF NOT v_admin AND NOT v_coord THEN
   RAISE EXCEPTION 'No autorizado para consultar claves.' USING ERRCODE='42501';
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
   'permite_anular',(v_admin OR v_coord) AND v_estado='borrador',
   'motivo_requerido',v_admin AND v_estado<>'borrador',
   'ultima_edicion',v_last,'items',v_items
 );
END;
$fn$;
