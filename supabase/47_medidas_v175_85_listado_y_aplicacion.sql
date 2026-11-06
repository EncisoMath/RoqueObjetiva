-- v175.85 · Listado filtrado y aplicación sin motivo escrito
-- Permisos administrativos reales y trazabilidad automática; datos fuente intactos.
create or replace function public.roque_v19_medidas_listar(
  p_edicion text,
  p_busqueda text default '',
  p_solo_afectados boolean default false,
  p_desde integer default 0,
  p_limite integer default 80,
  p_docente text default null,
  p_sesion text default null
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_lista jsonb;v_total integer;v_afectados integer;
begin
 if not (
   (auth.uid() is not null and exists(select 1 from roque_private.operadores_admin a
     where a.user_id=auth.uid() and a.activo))
   or (nullif(p_docente,'') is not null and exists(select 1 from public.docentes d
     where d.id_docente=p_docente and d.activo and d.rol='administrador')
     and roque_private.validar_coordinador_sesion(p_docente,p_sesion))
 ) then raise exception 'Acceso exclusivo del administrador.' using errcode='42501'; end if;
 if not exists(select 1 from roque_private.ediciones e where e.codigo=p_edicion) then
   raise exception 'Edición inexistente.' using errcode='22023'; end if;
 if p_desde is null or p_desde<0 or p_desde>10000 or p_limite is null or p_limite<1 or p_limite>120
   or length(coalesce(p_busqueda,''))>90 then
   raise exception 'Parámetros de búsqueda inválidos.' using errcode='22023'; end if;
 with medidas_activas as materialized (
   select m.id_prueba,
     bool_or(m.tipo='restriccion') as restringido,
     count(*) filter(where m.tipo<>'restriccion')::integer as anulaciones
   from roque_private.medidas_estudiante m
   where m.edicion=p_edicion and m.activo group by m.id_prueba
 ), roster as materialized (
   select i.edicion,i.id_prueba,i.id_alumno,i.nombres,i.apellidos,i.grado,i.grupo,i.sede,
     coalesce(m.restringido,false) restringido,
     coalesce(m.anulaciones,0) anulaciones
   from roque_private.inscripciones i
   left join medidas_activas m on m.id_prueba=i.id_prueba
   where i.edicion=p_edicion and i.activo
 ), filtrados as materialized (
   select * from roster r
   where (not coalesce(p_solo_afectados,false) or r.restringido or r.anulaciones>0)
     and (nullif(btrim(p_busqueda),'') is null
       or r.id_prueba ilike '%'||btrim(p_busqueda)||'%'
       or r.id_alumno ilike '%'||btrim(p_busqueda)||'%'
       or coalesce(r.nombres,'') ilike '%'||btrim(p_busqueda)||'%'
       or coalesce(r.apellidos,'') ilike '%'||btrim(p_busqueda)||'%'
       or (coalesce(r.nombres,'')||' '||coalesce(r.apellidos,'')) ilike '%'||btrim(p_busqueda)||'%'
       or (coalesce(r.apellidos,'')||' '||coalesce(r.nombres,'')) ilike '%'||btrim(p_busqueda)||'%')
 )
 select
   coalesce((select jsonb_agg(to_jsonb(p) order by p.apellidos,p.nombres,p.id_prueba)
     from (select * from filtrados order by apellidos,nombres,id_prueba
       offset p_desde limit p_limite) p),'[]'::jsonb),
   (select count(*)::integer from filtrados),
   (select count(*)::integer from roster r where r.restringido or r.anulaciones>0)
 into v_lista,v_total,v_afectados;
 return jsonb_build_object('ok',true,'estudiantes',v_lista,'total',v_total,
   'total_afectados',v_afectados,'desde',p_desde,
   'limite',p_limite,'mas',p_desde+jsonb_array_length(v_lista)<v_total);
end;
$$;
revoke all on function public.roque_v19_medidas_listar(text,text,boolean,integer,integer,text,text) from public,anon,authenticated;
grant execute on function public.roque_v19_medidas_listar(text,text,boolean,integer,integer,text,text) to anon,authenticated;

create or replace function public.roque_v19_medidas_aplicar(
  p_edicion text,p_id_prueba text,p_cambios jsonb,
  p_docente text default null,p_sesion text default null
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_primero jsonb;v_tipo text;v_motivo text;v_cantidad integer;
begin
 if jsonb_typeof(p_cambios)<>'array'
   or jsonb_array_length(p_cambios) not between 1 and 30 then
   raise exception 'Selecciona entre 1 y 30 modificaciones.' using errcode='22023';
 end if;
 v_primero:=p_cambios->0;
 v_tipo:=v_primero->>'tipo';
 v_cantidad:=jsonb_array_length(p_cambios);
 v_motivo:=case v_tipo
   when 'restriccion' then 'Actualización de restricción del acceso al examen desde Administración'
   when 'sesion' then 'Actualización de anulación de sesión desde Administración'
   when 'area' then 'Actualización de anulación de asignaturas desde Administración'
   else 'Actualización de medidas académicas desde Administración' end
   ||' ('||v_cantidad||' cambio'||case when v_cantidad=1 then '' else 's' end||')';
 -- El RPC legado mantiene validación de admin, sesión, edición,
 -- ámbitos válidos, transacción, escritura y auditoría por cambio.
 return public.roque_v18_medidas_guardar(
   p_edicion,p_id_prueba,p_cambios,v_motivo,p_docente,p_sesion);
end;
$$;
revoke all on function public.roque_v19_medidas_aplicar(text,text,jsonb,text,text) from public,anon,authenticated;
grant execute on function public.roque_v19_medidas_aplicar(text,text,jsonb,text,text) to anon,authenticated;
