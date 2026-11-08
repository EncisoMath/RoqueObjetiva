-- RoqueObjetiva 50: consultas administrativas paginadas y bloqueo auditado.
-- Todas las filas se leen desde roque_private con SECURITY DEFINER y autorización interna.
create or replace function public.roque_v21_historial_listar(
 p_tipo text default 'profesores',p_busqueda text default null,
 p_sede text default null,p_rol text default null,p_grado integer default null,
 p_curso text default null,p_fecha date default null,p_estado text default null,
 p_pagina integer default 1,p_limite integer default 20,
 p_docente text default null,p_sesion text default null
) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
 v_total integer:=0;
 v_rows jsonb:='[]'::jsonb;
 v_metrics jsonb:='{}'::jsonb;
 v_today date:=(clock_timestamp() at time zone 'America/Bogota')::date;
 v_filter text:=lower(pg_catalog.btrim(coalesce(p_busqueda,'')));
begin
 if not roque_private.autorizar_auditoria_accesos(p_docente,p_sesion) then
   raise exception 'Solo Administración puede consultar el historial de accesos'
     using errcode='42501';
 end if;
 if p_tipo not in ('profesores','estudiantes','dispositivos')
  or p_pagina not between 1 and 10000 or p_limite not between 1 and 50
  or length(v_filter)>100 or length(coalesce(p_sede,''))>100
  or length(coalesce(p_rol,''))>40 or length(coalesce(p_curso,''))>45
  or p_grado is not null and p_grado not between 5 and 11
  or length(coalesce(p_estado,''))>35 then
    raise exception 'Filtros de historial inválidos' using errcode='22023';
 end if;
 select pg_catalog.jsonb_build_object(
    'hoy',count(*) filter(where (e.fecha_hora at time zone 'America/Bogota')::date=v_today),
    'accesos',count(*) filter(where e.exitoso),
    'fallidos',count(*) filter(where not e.exitoso),
    'alertas',count(*) filter(where not e.exitoso and
       e.fecha_hora>clock_timestamp()-interval '24 hours'),
    'dispositivos',(select count(*) from roque_private.historial_dispositivos),
    'bloqueados',(select count(*) from roque_private.historial_dispositivos where bloqueado)
 ) into v_metrics from roque_private.historial_eventos e;
 if p_tipo='profesores' then
  with roster as (
    select d.id_docente as clave,d.nombre,d.sede,
      case when d.rol in ('administrador','coordinador','docente') then d.rol
        when d.coordinador then 'coordinador' else 'docente' end as rol
    from public.docentes d
    union all
    select o.user_id::text,coalesce(u.email,'Administración Supabase'),
      null::text,'administrador'::text
    from roque_private.operadores_admin o
    left join auth.users u on u.id=o.user_id
    where o.activo
  ), matched as (
   select r.clave,r.nombre,r.sede,r.rol,
     coalesce(a.total,0) as accesos,coalesce(a.fallidos,0) as fallidos,
     a.ultimo,coalesce(a.dispositivos,0) as dispositivos,
     d.marca,d.modelo,d.modelo_origen,d.sistema,d.navegador,
     case when a.ultimo>clock_timestamp()-interval '30 minutes' then 'reciente'
       when coalesce(a.total,0)=0 then 'nunca' else 'registrado' end as estado
   from roster r
   left join lateral (
     select count(*) filter(where e.exitoso)::integer as total,
       count(*) filter(where not e.exitoso)::integer as fallidos,
       max(e.fecha_hora) filter(where e.exitoso) as ultimo,
       count(distinct e.terminal) filter(where e.exitoso)::integer as dispositivos
     from roque_private.historial_eventos e
     where (e.id_docente=r.clave or
          (r.clave ~ '^[0-9a-f]{8}-' and e.usuario=lower(r.nombre)))
       and (p_fecha is null or (e.fecha_hora at time zone 'America/Bogota')::date=p_fecha)
   ) a on true
   left join lateral (
     select x.marca,x.modelo,x.modelo_origen,x.sistema,x.navegador
     from roque_private.historial_eventos ev
     join roque_private.historial_dispositivos x on x.terminal=ev.terminal
     where ev.exitoso and (ev.id_docente=r.clave or
       (r.clave ~ '^[0-9a-f]{8}-' and ev.usuario=lower(r.nombre)))
     order by ev.fecha_hora desc limit 1
   ) d on true
   where (v_filter='' or lower(r.nombre) like '%'||v_filter||'%'
      or lower(r.clave) like '%'||v_filter||'%')
    and (coalesce(p_sede,'')='' or lower(r.sede)=lower(p_sede))
    and (coalesce(p_rol,'')='' or r.rol=p_rol)
  ), filtered as (
    select * from matched m
    where coalesce(p_estado,'')=''
      or (p_estado='reciente' and m.estado='reciente')
      or (p_estado='nunca' and m.estado='nunca')
      or (p_estado='registrado' and m.accesos>0)
      or (p_estado='alerta' and m.fallidos>=3)
  )
  select (select count(*) from filtered),
    (select coalesce(jsonb_agg(to_jsonb(paged) order by paged.accesos desc,paged.nombre),'[]'::jsonb)
      from (select * from filtered order by accesos desc,nombre
        limit p_limite offset (p_pagina-1)*p_limite) paged)
    into v_total,v_rows;
 elsif p_tipo='estudiantes' then
  with roster as (
    select distinct on (i.id_prueba) i.id_prueba as clave,
       pg_catalog.btrim(coalesce(i.nombres,'')||' '||coalesce(i.apellidos,'')) as nombre,
       i.sede,i.grado,i.grupo as curso,i.edicion
    from roque_private.inscripciones i where i.activo
    order by i.id_prueba,i.edicion desc
  ), matched as (
    select r.clave,r.nombre,r.sede,r.grado,r.curso,r.edicion,
      coalesce(a.total,0) as accesos,coalesce(a.fallidos,0) as fallidos,
      a.ultimo,coalesce(a.dispositivos,0) as dispositivos,
      case when coalesce(a.total,0)=0 then 'nunca'
        when a.ultimo>clock_timestamp()-interval '30 minutes' then 'reciente'
        else 'consultado' end as estado
    from roster r
    left join lateral (
      select count(*) filter(where e.exitoso)::integer as total,
        count(*) filter(where not e.exitoso)::integer as fallidos,
        max(e.fecha_hora) filter(where e.exitoso) as ultimo,
        count(distinct e.terminal) filter(where e.exitoso)::integer as dispositivos
      from roque_private.historial_eventos e
      where e.id_prueba=r.clave
       and (p_fecha is null or (e.fecha_hora at time zone 'America/Bogota')::date=p_fecha)
    ) a on true
    where (v_filter='' or lower(r.nombre) like '%'||v_filter||'%'
       or lower(r.clave) like '%'||v_filter||'%')
      and (coalesce(p_sede,'')='' or lower(r.sede)=lower(p_sede))
      and (p_grado is null or r.grado=p_grado)
      and (coalesce(p_curso,'')='' or r.curso=p_curso)
  ), filtered as (
    select * from matched m where coalesce(p_estado,'')=''
      or (p_estado='nunca' and m.estado='nunca')
      or (p_estado='consultado' and m.accesos>0)
      or (p_estado='reciente' and m.estado='reciente')
      or (p_estado='alerta' and m.fallidos>=3)
  )
  select (select count(*) from filtered),
   (select coalesce(jsonb_agg(to_jsonb(paged) order by paged.accesos desc,paged.nombre),'[]'::jsonb)
      from (select * from filtered order by accesos desc,nombre
         limit p_limite offset (p_pagina-1)*p_limite) paged)
    into v_total,v_rows;
 else
  with stats as (
    select d.terminal as clave,d.registrado_en as primero,d.ultimo_evento as ultimo,
      d.marca,d.modelo,d.modelo_origen,d.sistema,d.version_so,d.navegador,
      d.version_navegador,d.ancho_pantalla,d.alto_pantalla,d.dpr,d.bloqueado,
      d.bloqueado_por,d.motivo_bloqueo,d.bloqueado_en,
      coalesce(a.total,0) as accesos,coalesce(a.fallidos,0) as fallidos,
      coalesce(a.usuarios,0) as usuarios,coalesce(a.rapidas,0) as rapidas,
      case when d.bloqueado then 'bloqueado'
        when coalesce(a.usuarios,0)>=4 or coalesce(a.fallidos,0)>=5
          or coalesce(a.rapidas,0)>=10 then 'sospechoso'
        else 'activo' end as estado
    from roque_private.historial_dispositivos d
    left join lateral (
      select count(*) filter(where e.exitoso)::integer as total,
        count(*) filter(where not e.exitoso)::integer as fallidos,
        count(distinct coalesce(e.id_prueba,e.id_docente,e.usuario))::integer as usuarios,
        count(*) filter(where e.fecha_hora>clock_timestamp()-interval '2 minutes')::integer as rapidas
      from roque_private.historial_eventos e
      where e.terminal=d.terminal
       and (p_fecha is null or (e.fecha_hora at time zone 'America/Bogota')::date=p_fecha)
    ) a on true
  ), filtered as (
    select * from stats d
    where (v_filter='' or lower(coalesce(d.marca,'')||' '||coalesce(d.modelo,'')||' '||
      coalesce(d.sistema,'')||' '||coalesce(d.navegador,'')||' '||d.clave::text)
       like '%'||v_filter||'%')
     and (coalesce(p_estado,'')='' or d.estado=p_estado)
  )
  select (select count(*) from filtered),
   (select coalesce(jsonb_agg(to_jsonb(paged) order by paged.ultimo desc),'[]'::jsonb)
     from (select * from filtered order by ultimo desc
        limit p_limite offset (p_pagina-1)*p_limite) paged)
   into v_total,v_rows;
 end if;
 return pg_catalog.jsonb_build_object('ok',true,'tipo',p_tipo,'pagina',p_pagina,
   'limite',p_limite,'total',v_total,'filas',coalesce(v_rows,'[]'::jsonb),
   'metricas',v_metrics);
end $$;
revoke all on function public.roque_v21_historial_listar(text,text,text,text,integer,text,date,text,integer,integer,text,text)
 from public,anon,authenticated;
grant execute on function public.roque_v21_historial_listar(text,text,text,text,integer,text,date,text,integer,integer,text,text)
 to anon,authenticated;

create or replace function public.roque_v21_historial_detalle(
 p_tipo text,p_clave text,p_pagina integer default 1,p_limite integer default 30,
 p_docente text default null,p_sesion text default null
) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
 v_terminal uuid;
 v_total integer;
 v_rows jsonb;
 v_people jsonb:='[]'::jsonb;
begin
 if not roque_private.autorizar_auditoria_accesos(p_docente,p_sesion) then
   raise exception 'Solo Administración puede consultar estos accesos' using errcode='42501';
 end if;
 if p_tipo not in ('profesores','estudiantes','dispositivos')
 or length(coalesce(p_clave,'')) not between 1 and 120
 or p_pagina not between 1 and 10000 or p_limite not between 1 and 50 then
   raise exception 'Parámetros inválidos' using errcode='22023';
 end if;
 if p_tipo='dispositivos' then
  if p_clave !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  then raise exception 'Identificador inválido' using errcode='22023'; end if;
  v_terminal:=p_clave::uuid;
 end if;
 with base as (
  select e.fecha_hora,e.terminal,e.usuario,e.rol,e.id_prueba,e.id_docente,
    e.evento,e.exitoso,
    d.marca,d.modelo,d.modelo_origen,d.sistema,d.version_so,
    d.navegador,d.version_navegador
  from roque_private.historial_eventos e
  join roque_private.historial_dispositivos d on d.terminal=e.terminal
  where (p_tipo='dispositivos' and e.terminal=v_terminal)
    or (p_tipo='estudiantes' and e.id_prueba=p_clave)
    or (p_tipo='profesores' and (e.id_docente=p_clave or e.usuario=lower(p_clave)))
 ), pages as (
   select * from base order by fecha_hora desc limit p_limite
      offset (p_pagina-1)*p_limite
 )
 select (select count(*) from base),
   (select coalesce(jsonb_agg(to_jsonb(x) order by x.fecha_hora desc),'[]'::jsonb) from pages x)
 into v_total,v_rows;
 if p_tipo='dispositivos' then
   with grouped as (
     select e.rol,coalesce(e.id_prueba,e.id_docente,e.usuario) as clave,
       count(*) as accesos,max(e.fecha_hora) as ultimo
     from roque_private.historial_eventos e
     where e.terminal=v_terminal and e.exitoso
     group by e.rol,coalesce(e.id_prueba,e.id_docente,e.usuario)
   ), names as (
    select g.*,
      coalesce(d.nombre,
        (select pg_catalog.btrim(i.nombres||' '||i.apellidos)
         from roque_private.inscripciones i where i.id_prueba=g.clave
         order by i.edicion desc limit 1),
        g.clave) as nombre
    from grouped g left join public.docentes d on d.id_docente=g.clave
   )
   select coalesce(jsonb_agg(to_jsonb(x) order by x.accesos desc),'[]'::jsonb)
     into v_people
     from (select * from names order by accesos desc limit 100) x;
 end if;
 return pg_catalog.jsonb_build_object('ok',true,'total',v_total,
  'filas',coalesce(v_rows,'[]'::jsonb),'usuarios',v_people);
end $$;
revoke all on function public.roque_v21_historial_detalle(text,text,integer,integer,text,text)
 from public,anon,authenticated;
grant execute on function public.roque_v21_historial_detalle(text,text,integer,integer,text,text)
 to anon,authenticated;

create or replace function public.roque_v21_historial_bloquear(
 p_terminal uuid,p_bloqueado boolean,p_motivo text,
 p_docente text default null,p_sesion text default null
) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_actor_tipo text;v_actor_id text;v_before boolean;
begin
 if not roque_private.autorizar_auditoria_accesos(p_docente,p_sesion) then
   raise exception 'Solo Administración puede bloquear navegadores'
      using errcode='42501';
 end if;
 if p_terminal is null or p_bloqueado is null or
    length(pg_catalog.btrim(coalesce(p_motivo,''))) not between 5 and 500 then
   raise exception 'Es obligatorio indicar un motivo de 5 a 500 caracteres.'
    using errcode='22023';
 end if;
 if auth.uid() is not null and exists (
    select 1 from roque_private.operadores_admin a where a.user_id=auth.uid() and a.activo)
 then
   v_actor_tipo:='admin_auth';v_actor_id:=auth.uid()::text;
 else
   v_actor_tipo:='admin_docente';v_actor_id:=p_docente;
 end if;
 select d.bloqueado into v_before from roque_private.historial_dispositivos d
 where d.terminal=p_terminal for update;
 if not found then raise exception 'Identificador inexistente' using errcode='22023';end if;
 if v_before is not distinct from p_bloqueado then
  return pg_catalog.jsonb_build_object('ok',true,'sin_cambio',true,'bloqueado',v_before);
 end if;
 update roque_private.historial_dispositivos
 set bloqueado=p_bloqueado,
   bloqueado_en=case when p_bloqueado then clock_timestamp() else null end,
   bloqueado_por=case when p_bloqueado then v_actor_id else null end,
   motivo_bloqueo=case when p_bloqueado then pg_catalog.btrim(p_motivo) else null end
 where terminal=p_terminal;
 insert into roque_private.historial_bloqueos
   (terminal,bloqueado,motivo,actor_tipo,actor_id)
 values(p_terminal,p_bloqueado,pg_catalog.btrim(p_motivo),v_actor_tipo,v_actor_id);
 -- Cancela las sesiones de coordinación abiertas mediante este identificador.
 -- La restricción a los estudiantes sigue siendo independiente (ID 2573 intacto).
 if p_bloqueado then
  update roque_private.coordinator_sessions
  set revocado=true where terminal=p_terminal and not revocado;
 end if;
 return pg_catalog.jsonb_build_object('ok',true,'bloqueado',p_bloqueado);
end $$;
revoke all on function public.roque_v21_historial_bloquear(uuid,boolean,text,text,text)
 from public,anon,authenticated;
grant execute on function public.roque_v21_historial_bloquear(uuid,boolean,text,text,text)
 to anon,authenticated;
