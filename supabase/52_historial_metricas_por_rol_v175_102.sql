-- RoqueObjetiva v175.102 · Implementación desplegada de roque_v21_historial_listar
CREATE OR REPLACE FUNCTION public.roque_v21_historial_listar(p_tipo text DEFAULT 'profesores'::text, p_busqueda text DEFAULT NULL::text, p_sede text DEFAULT NULL::text, p_rol text DEFAULT NULL::text, p_grado integer DEFAULT NULL::integer, p_curso text DEFAULT NULL::text, p_fecha date DEFAULT NULL::date, p_estado text DEFAULT NULL::text, p_pagina integer DEFAULT 1, p_limite integer DEFAULT 20, p_docente text DEFAULT NULL::text, p_sesion text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
    'docentes_conectados',count(distinct e.id_docente)
       filter(where e.exitoso and e.fecha_hora>clock_timestamp()-interval '30 minutes'),
    'accesos_docentes_hoy',count(*) filter(where e.exitoso and e.rol='teacher'
       and (e.fecha_hora at time zone 'America/Bogota')::date=v_today),
    'estudiantes_hoy',count(distinct e.id_prueba) filter(where e.exitoso
       and e.rol='student'
       and (e.fecha_hora at time zone 'America/Bogota')::date=v_today),
    'estudiantes_sin_consultar',(
       select count(*) from (select distinct i.id_prueba
         from roque_private.inscripciones i where i.activo) roster
       where not exists(select 1 from roque_private.historial_eventos event
           where event.id_prueba=roster.id_prueba and event.exitoso)
    ),
    'ultimo_estudiante',max(e.fecha_hora) filter(where e.exitoso and e.rol='student'),
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
end $function$;
