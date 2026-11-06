CREATE OR REPLACE FUNCTION public.roque_v18_medidas_buscar(p_edicion text, p_busqueda text DEFAULT ''::text, p_docente text DEFAULT NULL::text, p_sesion text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_rows jsonb;
begin
 if not (
  (auth.uid() is not null and exists(select 1 from roque_private.operadores_admin a where a.user_id=auth.uid() and a.activo))
  or (nullif(p_docente,'') is not null and exists(select 1 from public.docentes d where d.id_docente=p_docente and d.activo and d.rol='administrador')
      and roque_private.validar_coordinador_sesion(p_docente,p_sesion))
 ) then raise exception 'Acceso exclusivo del administrador.' using errcode='42501'; end if;
 if not exists(select 1 from roque_private.ediciones e where e.codigo=p_edicion) then
  raise exception 'Edición inexistente.' using errcode='22023'; end if;
 select coalesce(jsonb_agg(to_jsonb(x) order by x.apellidos,x.nombres,x.id_prueba),'[]'::jsonb) into v_rows
 from (
   select i.edicion,i.id_prueba,i.id_alumno,i.nombres,i.apellidos,i.grado,i.grupo,i.sede,
      roque_private.examen_restringido(i.edicion,i.id_prueba) restringido,
      (select count(*) from roque_private.medidas_estudiante m
        where m.edicion=i.edicion and m.id_prueba=i.id_prueba and m.activo and m.tipo<>'restriccion') anulaciones
   from roque_private.inscripciones i
   where i.edicion=p_edicion and i.activo
     and (nullif(btrim(p_busqueda),'') is null
       or i.id_prueba ilike '%'||btrim(p_busqueda)||'%'
       or i.id_alumno ilike '%'||btrim(p_busqueda)||'%'
       or coalesce(i.nombres,'') ilike '%'||btrim(p_busqueda)||'%'
       or coalesce(i.apellidos,'') ilike '%'||btrim(p_busqueda)||'%'
       or (coalesce(i.nombres,'')||' '||coalesce(i.apellidos,'')) ilike '%'||btrim(p_busqueda)||'%'
       or (coalesce(i.apellidos,'')||' '||coalesce(i.nombres,'')) ilike '%'||btrim(p_busqueda)||'%')
   order by i.apellidos,i.nombres,i.id_prueba limit 70
 ) x;
 return jsonb_build_object('ok',true,'estudiantes',v_rows,
  'ediciones',(
    select coalesce(jsonb_agg(jsonb_build_object('codigo',e.codigo,'estado',e.estado)
      order by e.anio desc,e.semestre desc),'[]'::jsonb)
    from roque_private.ediciones e
  ));
end;
$function$;
