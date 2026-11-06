
-- v175.82 · Medidas académicas reversibles y auditadas.
-- Independientes de los resultados de EvalBee y de las claves.
create table if not exists roque_private.medidas_estudiante (
  edicion text not null,
  id_prueba text not null,
  tipo text not null check (tipo in ('restriccion','sesion','area')),
  clave text not null,
  activo boolean not null default true,
  motivo text not null check(length(btrim(motivo)) between 5 and 500),
  actor_tipo text not null check(actor_tipo in ('admin_auth','admin_docente')),
  actor_id text not null,
  actualizado_en timestamptz not null default clock_timestamp(),
  primary key(edicion,id_prueba,tipo,clave),
  foreign key(edicion,id_prueba) references roque_private.inscripciones(edicion,id_prueba)
);
create index if not exists idx_medidas_estudiante_activo
  on roque_private.medidas_estudiante(edicion,id_prueba) where activo;
alter table roque_private.medidas_estudiante enable row level security;
revoke all on roque_private.medidas_estudiante from public,anon,authenticated;

create table if not exists roque_private.auditoria_medidas_estudiante (
  id bigint generated always as identity primary key,
  edicion text not null,
  id_prueba text not null,
  tipo text not null,
  clave text not null,
  activo_anterior boolean not null,
  activo_nuevo boolean not null,
  motivo text not null,
  actor_tipo text not null,
  actor_id text not null,
  antes jsonb,
  despues jsonb,
  creado_en timestamptz not null default clock_timestamp()
);
create index if not exists idx_auditoria_medidas_buscar
  on roque_private.auditoria_medidas_estudiante(edicion,id_prueba,creado_en desc);
alter table roque_private.auditoria_medidas_estudiante enable row level security;
revoke all on roque_private.auditoria_medidas_estudiante from public,anon,authenticated;

create or replace function roque_private.canon_area_medida(p_area text)
returns text language sql immutable set search_path='' as $$
  select case when roque_private.roque_v16_normalizar(p_area) like 'lenguaje%'
    then 'lenguaje'
    else roque_private.roque_v16_normalizar(p_area)
    end;
$$;
revoke all on function roque_private.canon_area_medida(text) from public,anon,authenticated;

create or replace function roque_private.examen_restringido(p_edicion text,p_id_prueba text)
returns boolean language sql stable security definer set search_path='' as $$
  select exists(
    select 1 from roque_private.medidas_estudiante m
    where m.edicion=p_edicion and m.id_prueba=p_id_prueba
      and m.tipo='restriccion' and m.activo);
$$;
revoke all on function roque_private.examen_restringido(text,text) from public,anon,authenticated;

create or replace function roque_private.examen_restringido_login(p_login text)
returns boolean language sql stable security definer set search_path='' as $$
  select exists(
    select 1 from roque_private.inscripciones i
    join roque_private.medidas_estudiante m on m.edicion=i.edicion and m.id_prueba=i.id_prueba
    where i.activo and m.tipo='restriccion' and m.activo
      and (lower(btrim(i.id_prueba))=lower(btrim(coalesce(p_login,'')))
        or lower(btrim(i.id_alumno))=lower(btrim(coalesce(p_login,''))))
  );
$$;
revoke all on function roque_private.examen_restringido_login(text) from public,anon,authenticated;

create or replace function roque_private.estado_area_medida(
 p_edicion text,p_id_prueba text,p_area text,p_grado integer
) returns text language sql stable security definer set search_path='' as $$
 select case
  when roque_private.examen_restringido(p_edicion,p_id_prueba) then 'restringido'
  when exists(
    select 1 from roque_private.medidas_estudiante m
    where m.edicion=p_edicion and m.id_prueba=p_id_prueba and m.activo
      and (
        (m.tipo='area' and m.clave=roque_private.canon_area_medida(p_area))
        or (m.tipo='sesion' and exists(
          select 1 from roque_private.items it
          where it.edicion=p_edicion and it.grado=p_grado and it.activo
            and roque_private.canon_area_medida(it.area)=roque_private.canon_area_medida(p_area)
            and it.sesion::text=m.clave))
      )
  ) then 'anulado'
  else 'normal'
 end;
$$;
revoke all on function roque_private.estado_area_medida(text,text,text,integer) from public,anon,authenticated;

create or replace function roque_private.resumen_medidas(
 p_edicion text,p_id_prueba text,p_grado integer
) returns jsonb language sql stable security definer set search_path='' as $$
  select jsonb_build_object(
    'id_prueba',p_id_prueba,
    'restringido',roque_private.examen_restringido(p_edicion,p_id_prueba),
    'areas_anuladas',coalesce((
      select jsonb_agg(a.nombre order by a.nombre) from (
        select distinct roque_private.canon_area_medida(it.area) nombre
        from roque_private.items it where it.edicion=p_edicion and it.grado=p_grado
          and it.activo and roque_private.estado_area_medida(p_edicion,p_id_prueba,it.area,p_grado)='anulado'
      ) a
    ),'[]'::jsonb),
    'sesiones_anuladas',coalesce((
      select jsonb_agg(m.clave::integer order by m.clave::integer)
      from roque_private.medidas_estudiante m where m.edicion=p_edicion and m.id_prueba=p_id_prueba
        and m.tipo='sesion' and m.activo
    ),'[]'::jsonb)
  );
$$;
revoke all on function roque_private.resumen_medidas(text,text,integer) from public,anon,authenticated;

create or replace function roque_private.mascara_respuestas_medidas(
 p_edicion text,p_id_prueba text,p_grado integer,p_respuestas jsonb
) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_res jsonb:=coalesce(p_respuestas,'{}'::jsonb); v_item record;
begin
  if roque_private.examen_restringido(p_edicion,p_id_prueba) then return '{}'::jsonb; end if;
  if not exists(select 1 from roque_private.medidas_estudiante m
    where m.edicion=p_edicion and m.id_prueba=p_id_prueba and m.activo) then return v_res; end if;
  for v_item in
    select it.numero_item from roque_private.items it
    where it.edicion=p_edicion and it.grado=p_grado and it.activo and
      roque_private.estado_area_medida(p_edicion,p_id_prueba,it.area,p_grado)='anulado'
  loop
    v_res:=v_res-v_item.numero_item::text;
  end loop;
  return v_res;
end;
$$;
revoke all on function roque_private.mascara_respuestas_medidas(text,text,integer,jsonb) from public,anon,authenticated;

create or replace function roque_private.mascara_payload_docente_legacy(p_payload jsonb,p_edicion text)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_groups jsonb:='[]'::jsonb;v_group jsonb;v_rows jsonb;v_row jsonb;
 v_grade integer;v_session integer;v_start integer;v_roll text;v_item record;v_canon text;
 v_new jsonb;v_reg roque_private.inscripciones%rowtype;
begin
 if p_payload->'session'->>'role' <> 'teacher' then return p_payload; end if;
 for v_group in select value from jsonb_array_elements(coalesce(p_payload->'datasets'->'resultados','[]'::jsonb))
 loop
  v_grade:=coalesce(nullif(v_group->>'grade','')::integer,0);
  v_session:=coalesce(nullif(v_group->>'session','')::integer,1);
  v_start:=coalesce(nullif(v_group->>'startItem','')::integer,case when v_session=2 then 71 else 1 end);
  v_rows:='[]'::jsonb;
  for v_row in select value from jsonb_array_elements(coalesce(v_group->'rows','[]'::jsonb))
  loop
   v_new:=v_row;
   v_roll:=v_row->>'Roll No';
   select * into v_reg from roque_private.inscripciones i where i.edicion=p_edicion and i.id_prueba=v_roll;
   if found and exists(select 1 from roque_private.medidas_estudiante m
     where m.edicion=p_edicion and m.id_prueba=v_roll and m.activo) then
     if roque_private.examen_restringido(p_edicion,v_roll) then
       for v_item in select key from jsonb_object_keys(v_row) as key
         where key ~ '^Q [0-9]+ Options$' loop
         v_new:=v_new-v_item.key;
       end loop;
     else
       for v_item in select key from jsonb_object_keys(v_row) as key
         where key ~ '^Q [0-9]+ Options$' loop
         if exists(select 1 from roque_private.items it where it.edicion=p_edicion and it.grado=v_grade
           and it.numero_item=v_start+(substring(v_item.key from 'Q ([0-9]+) Options'))::integer-1
           and roque_private.estado_area_medida(p_edicion,v_roll,it.area,v_grade)='anulado')
         then v_new:=v_new-v_item.key; end if;
       end loop;
     end if;
   end if;
   v_rows:=v_rows||jsonb_build_array(v_new);
  end loop;
  v_groups:=v_groups||jsonb_build_array(jsonb_set(v_group,'{rows}',v_rows));
 end loop;
 return jsonb_set(p_payload,'{datasets,resultados}',v_groups,true);
end;
$$;
revoke all on function roque_private.mascara_payload_docente_legacy(jsonb,text) from public,anon,authenticated;

create or replace function public.roque_v18_medidas_buscar(
 p_edicion text,p_busqueda text default '',p_docente text default null,p_sesion text default null
) returns jsonb language plpgsql security definer set search_path='' as $$
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
 return jsonb_build_object('ok',true,'estudiantes',v_rows);
end;
$$;
revoke all on function public.roque_v18_medidas_buscar(text,text,text,text) from public,anon,authenticated;
grant execute on function public.roque_v18_medidas_buscar(text,text,text,text) to anon,authenticated;

create or replace function public.roque_v18_medidas_detalle(
 p_edicion text,p_id_prueba text,p_docente text default null,p_sesion text default null
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_i roque_private.inscripciones%rowtype;v_sessions jsonb;v_areas jsonb;v_medidas jsonb;v_log jsonb;
begin
 if not (
  (auth.uid() is not null and exists(select 1 from roque_private.operadores_admin a where a.user_id=auth.uid() and a.activo))
  or (nullif(p_docente,'') is not null and exists(select 1 from public.docentes d where d.id_docente=p_docente and d.activo and d.rol='administrador')
      and roque_private.validar_coordinador_sesion(p_docente,p_sesion))
 ) then raise exception 'Acceso exclusivo del administrador.' using errcode='42501'; end if;
 select * into v_i from roque_private.inscripciones i where i.edicion=p_edicion and i.id_prueba=p_id_prueba and i.activo;
 if not found then raise exception 'Estudiante no encontrado en esta edición.' using errcode='22023'; end if;
 select coalesce(jsonb_agg(s.numero order by s.numero),'[]'::jsonb) into v_sessions
 from roque_private.sesiones s where s.edicion=p_edicion and s.grado=v_i.grado;
 select coalesce(jsonb_agg(jsonb_build_object('area',x.area,'clave',x.clave,'sesiones',x.sesiones)
   order by x.area),'[]'::jsonb) into v_areas
 from (
  select min(it.area) area,roque_private.canon_area_medida(it.area) clave,
    array_agg(distinct it.sesion order by it.sesion) sesiones
  from roque_private.items it where it.edicion=p_edicion and it.grado=v_i.grado and it.activo
  group by roque_private.canon_area_medida(it.area)
 ) x;
 select coalesce(jsonb_agg(jsonb_build_object('tipo',m.tipo,'clave',m.clave,'activo',m.activo,
  'motivo',m.motivo,'actualizado_en',m.actualizado_en) order by m.tipo,m.clave),'[]'::jsonb)
 into v_medidas from roque_private.medidas_estudiante m
 where m.edicion=p_edicion and m.id_prueba=p_id_prueba and m.activo;
 select coalesce(jsonb_agg(to_jsonb(t) order by t.creado_en desc),'[]'::jsonb) into v_log from (
  select operacion.creado_en,operacion.actor_tipo,operacion.tipo,operacion.clave,
    operacion.activo_nuevo,operacion.motivo
  from roque_private.auditoria_medidas_estudiante operacion
  where operacion.edicion=p_edicion and operacion.id_prueba=p_id_prueba
  order by creado_en desc limit 15
 ) t;
 return jsonb_build_object('ok',true,'estudiante',jsonb_build_object(
    'edicion',v_i.edicion,'id_prueba',v_i.id_prueba,'id_alumno',v_i.id_alumno,
    'nombre',btrim(coalesce(v_i.nombres,'')||' '||coalesce(v_i.apellidos,'')),
    'grado',v_i.grado,'grupo',v_i.grupo,'sede',v_i.sede
  ),'sesiones',v_sessions,'areas',v_areas,'medidas',v_medidas,'auditoria',v_log);
end;
$$;
revoke all on function public.roque_v18_medidas_detalle(text,text,text,text) from public,anon,authenticated;
grant execute on function public.roque_v18_medidas_detalle(text,text,text,text) to anon,authenticated;

create or replace function public.roque_v18_medidas_guardar(
 p_edicion text,p_id_prueba text,p_cambios jsonb,p_motivo text,
 p_docente text default null,p_sesion text default null
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor text;v_actor_tipo text;v_i roque_private.inscripciones%rowtype;
 v_row jsonb;v_tipo text;v_clave text;v_activo boolean;v_prev roque_private.medidas_estudiante%rowtype;
 v_changed integer:=0;v_seen text[]:=array[]::text[];v_input text;
begin
 if auth.uid() is not null and exists(
   select 1 from roque_private.operadores_admin a where a.user_id=auth.uid() and a.activo
 ) then v_actor:=auth.uid()::text;v_actor_tipo:='admin_auth';
 elsif nullif(p_docente,'') is not null and exists(
   select 1 from public.docentes d where d.id_docente=p_docente and d.activo and d.rol='administrador'
 ) and roque_private.validar_coordinador_sesion(p_docente,p_sesion)
 then v_actor:=p_docente;v_actor_tipo:='admin_docente';
 else raise exception 'Solo el administrador puede modificar medidas.' using errcode='42501'; end if;
 if length(btrim(coalesce(p_motivo,''))) not between 5 and 500 then
   raise exception 'Escribe un motivo de entre 5 y 500 caracteres.' using errcode='22023';end if;
 if jsonb_typeof(p_cambios)<>'array' or jsonb_array_length(p_cambios) not between 1 and 30 then
   raise exception 'Selecciona entre 1 y 30 cambios.' using errcode='22023';end if;
 select * into v_i from roque_private.inscripciones i where i.edicion=p_edicion and i.id_prueba=p_id_prueba and i.activo;
 if not found then raise exception 'Estudiante o edición inexistentes.' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended('roque-medidas:'||p_edicion||':'||p_id_prueba,0));
 for v_row in select value from jsonb_array_elements(p_cambios) loop
   v_tipo:=v_row->>'tipo';v_input:=coalesce(v_row->>'clave','');
   v_clave:=case when v_tipo='restriccion' then 'general'
                 when v_tipo='area' then roque_private.canon_area_medida(v_input)
                 else btrim(v_input) end;
   if v_tipo not in ('restriccion','sesion','area') or
      jsonb_typeof(v_row->'activo')<>'boolean' or
      (v_tipo='sesion' and not exists(
       select 1 from roque_private.sesiones se
       where se.edicion=p_edicion and se.grado=v_i.grado and se.numero::text=v_clave)) or
      (v_tipo='area' and not exists(
       select 1 from roque_private.items it where it.edicion=p_edicion and it.grado=v_i.grado
         and it.activo and roque_private.canon_area_medida(it.area)=v_clave)) or
       v_clave='' or (v_tipo='restriccion' and v_input<>'general')
   then raise exception 'Alcance académico inválido.' using errcode='22023'; end if;
   if (v_tipo||':'||v_clave)=any(v_seen) then
      raise exception 'Hay medidas duplicadas en la solicitud.' using errcode='22023';end if;
   v_seen:=array_append(v_seen,v_tipo||':'||v_clave);
   v_activo:=(v_row->>'activo')::boolean;
   select * into v_prev from roque_private.medidas_estudiante m
      where m.edicion=p_edicion and m.id_prueba=p_id_prueba and m.tipo=v_tipo and m.clave=v_clave;
   if found and v_prev.activo=v_activo then continue;end if;
   if not found and not v_activo then continue; end if;
   insert into roque_private.medidas_estudiante(edicion,id_prueba,tipo,clave,activo,motivo,actor_tipo,actor_id,actualizado_en)
    values(p_edicion,p_id_prueba,v_tipo,v_clave,v_activo,btrim(p_motivo),v_actor_tipo,v_actor,clock_timestamp())
   on conflict(edicion,id_prueba,tipo,clave) do update set
    activo=excluded.activo,motivo=excluded.motivo,actor_tipo=excluded.actor_tipo,
    actor_id=excluded.actor_id,actualizado_en=excluded.actualizado_en;
   insert into roque_private.auditoria_medidas_estudiante(
     edicion,id_prueba,tipo,clave,activo_anterior,activo_nuevo,motivo,actor_tipo,actor_id,antes,despues
   ) values (p_edicion,p_id_prueba,v_tipo,v_clave,coalesce(v_prev.activo,false),v_activo,btrim(p_motivo),
     v_actor_tipo,v_actor,to_jsonb(v_prev),jsonb_build_object('activo',v_activo,'motivo',btrim(p_motivo)));
   v_changed:=v_changed+1;
 end loop;
 return jsonb_build_object('ok',true,'cambios',v_changed,
   'restringido',roque_private.examen_restringido(p_edicion,p_id_prueba));
end;
$$;
revoke all on function public.roque_v18_medidas_guardar(text,text,jsonb,text,text,text) from public,anon,authenticated;
grant execute on function public.roque_v18_medidas_guardar(text,text,jsonb,text,text,text) to anon,authenticated;
