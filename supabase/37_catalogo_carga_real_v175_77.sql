-- v175.77 · Catálogo únicamente de asignaturas vigentes en carga docente.
-- No borra registros heredados; no altera datos de evaluaciones ni cargas.
-- Crear asignaturas queda expresamente prohibido desde la API.
create or replace function public.roque_v16_areas_catalogo(
  p_docente text default null, p_sesion text default null
) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
  v_autorizado boolean;
  v_areas jsonb;
  v_asignaturas jsonb;
begin
  v_autorizado :=
    (auth.uid() is not null and exists(
      select 1 from roque_private.operadores_admin o
      where o.user_id=auth.uid() and o.activo
    ))
    or (
      nullif(p_docente,'') is not null
      and exists(select 1 from public.docentes d
                 where d.id_docente=p_docente and d.activo and d.rol='administrador')
      and roque_private.validar_coordinador_sesion(p_docente,p_sesion)
    );
  if not coalesce(v_autorizado,false) then
    raise exception 'Acceso exclusivo del administrador con sesión vigente.'
      using errcode='42501';
  end if;

  with candidatos as (
    select m.area as nombre, 0 as prioridad from public.mapeo_areas m
    union all
    select coalesce(nullif(btrim(a.area_global),''),a.area) as nombre, 1 as prioridad
      from roque_private.areas a where a.activo
  ),
  areas as (
    select distinct on (roque_private.roque_v16_normalizar(nombre))
      nombre
    from candidatos
    where nullif(btrim(nombre),'') is not null
    order by roque_private.roque_v16_normalizar(nombre), prioridad, nombre
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'nombre',a.nombre,
    'orden', coalesce((
      select min(x.orden) from roque_private.areas x where x.activo
        and roque_private.roque_v16_normalizar(coalesce(nullif(btrim(x.area_global),''),x.area))
            =roque_private.roque_v16_normalizar(a.nombre)
    ),99),
    'grados',coalesce((
      select jsonb_agg(g.grado order by g.grado)
      from (
        select distinct x.grado from roque_private.areas x
        where x.activo and roque_private.roque_v16_normalizar(coalesce(nullif(btrim(x.area_global),''),x.area))
              =roque_private.roque_v16_normalizar(a.nombre)
      ) g
    ),'[]'::jsonb),
    'en_claves',(
      exists(select 1 from roque_private.items i
        where i.activo and roque_private.roque_v16_normalizar(i.area)=roque_private.roque_v16_normalizar(a.nombre))
      or exists(select 1 from public.claves k
        where k.activo and roque_private.roque_v16_normalizar(k.area)=roque_private.roque_v16_normalizar(a.nombre))
    ),
    'en_carga', exists(
      select 1 from public.carga_docente c
      join public.mapeo_areas m on m.activo
        and roque_private.roque_v16_normalizar(m.asignatura)=roque_private.roque_v16_normalizar(c.asignatura)
      where c.activo and roque_private.roque_v16_normalizar(m.area)=roque_private.roque_v16_normalizar(a.nombre)
    ),
    'en_estadisticas',exists(
      select 1 from roque_private.items i
      where i.activo and roque_private.roque_v16_normalizar(i.area)=roque_private.roque_v16_normalizar(a.nombre)
        and exists(select 1 from roque_private.resultados r where r.edicion=i.edicion and r.activo)
    )
  ) order by coalesce((
      select min(x.orden) from roque_private.areas x where x.activo
        and roque_private.roque_v16_normalizar(coalesce(nullif(btrim(x.area_global),''),x.area))
            =roque_private.roque_v16_normalizar(a.nombre)
  ),99),a.nombre),'[]'::jsonb)
  into v_areas from areas a;

  -- Fuente única: carga docente activa. El mapeo histórico solo resuelve relaciones.
  with grupos as (
    select roque_private.roque_v16_normalizar(c.asignatura) as clave,
      (array_agg(c.asignatura order by
        (c.asignatura ~ '[ÁÉÍÓÚáéíóúñ]') desc,c.asignatura))[1] as nombre
    from public.carga_docente c
    where c.activo and nullif(btrim(c.asignatura),'') is not null
    group by roque_private.roque_v16_normalizar(c.asignatura)
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'nombre',g.nombre,
    'area',(
       select m.area from public.mapeo_areas m
       where m.activo and roque_private.roque_v16_normalizar(m.asignatura)=g.clave
       order by m.id limit 1
    ),
    'en_carga', exists(
       select 1 from public.carga_docente c where c.activo and roque_private.roque_v16_normalizar(c.asignatura)=g.clave
    ),
    'en_claves', exists(
       select 1 from public.claves k where roque_private.roque_v16_normalizar(k.area)=g.clave
    ),
    'en_items', exists(
       select 1 from roque_private.items i where roque_private.roque_v16_normalizar(i.area)=g.clave
    ),
    'protegida', (
      exists(select 1 from public.carga_docente c where roque_private.roque_v16_normalizar(c.asignatura)=g.clave)
      or exists(select 1 from public.claves k where roque_private.roque_v16_normalizar(k.area)=g.clave)
      or exists(select 1 from roque_private.items i where roque_private.roque_v16_normalizar(i.area)=g.clave)
    )
  ) order by g.nombre),'[]'::jsonb)
  into v_asignaturas from grupos g;

  return jsonb_build_object('ok',true,'areas',v_areas,'asignaturas',v_asignaturas);
end;
$$;

create or replace function public.roque_v16_areas_guardar(
  p_operacion text, p_area text, p_asignatura text,
  p_docente text default null, p_sesion text default null
) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
  v_actor_tipo text;
  v_actor_id text;
  v_area text;
  v_nombre text;
  v_clave text;
  v_area_clave text;
  v_antes jsonb;
  v_despues jsonb;
  v_cambios integer := 0;
begin
  if auth.uid() is not null and exists(
    select 1 from roque_private.operadores_admin o where o.user_id=auth.uid() and o.activo
  ) then
    v_actor_tipo:='auth_admin';
    v_actor_id:=auth.uid()::text;
  elsif nullif(p_docente,'') is not null
    and exists(select 1 from public.docentes d
               where d.id_docente=p_docente and d.activo and d.rol='administrador')
    and roque_private.validar_coordinador_sesion(p_docente,p_sesion)
  then
    v_actor_tipo:='docente_administrador';
    v_actor_id:=p_docente;
  else
    raise exception 'Operación exclusiva del administrador con sesión vigente.'
      using errcode='42501';
  end if;
  if p_operacion not in ('vincular','desvincular') then
    raise exception 'Operación académica no permitida.' using errcode='22023';
  end if;

  v_nombre:=btrim(coalesce(p_asignatura,''));
  v_clave:=roque_private.roque_v16_normalizar(v_nombre);
  v_area_clave:=roque_private.roque_v16_normalizar(p_area);
  if char_length(v_nombre)<2 or char_length(v_nombre)>100 or v_nombre ~ '[[:cntrl:]]'
    or v_area_clave='' then
    raise exception 'Nombre de asignatura o área inválido.' using errcode='22023';
  end if;
  select x.nombre into v_area from (
    select m.area nombre,0 preferencia from public.mapeo_areas m
    union all
    select coalesce(nullif(btrim(a.area_global),''),a.area),1
      from roque_private.areas a where a.activo
  ) x
  where roque_private.roque_v16_normalizar(x.nombre)=v_area_clave
  order by x.preferencia,x.nombre limit 1;
  if v_area is null then
    raise exception 'Área inexistente en la estructura académica.' using errcode='22023';
  end if;

  -- Todas las escrituras por RPC se serializan, incluso nombres equivalentes con y sin tilde.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('roque-v16-mapeo-areas',0));
  select coalesce(jsonb_agg(to_jsonb(m) order by m.id),'[]'::jsonb) into v_antes
    from public.mapeo_areas m
    where roque_private.roque_v16_normalizar(m.asignatura)=v_clave;

  if p_operacion='vincular' then
    if not exists(select 1 from public.carga_docente c
         where c.activo and roque_private.roque_v16_normalizar(c.asignatura)=v_clave) then
       raise exception 'Asignatura inexistente en la carga docente activa.'
         using errcode='22023';
    end if;
    if exists(select 1 from public.mapeo_areas m where m.activo
         and roque_private.roque_v16_normalizar(m.asignatura)=v_clave
         and roque_private.roque_v16_normalizar(m.area)<>v_area_clave) then
       raise exception 'Esta asignatura ya pertenece a otra área. Desvincúlala primero, si no tiene dependencias.'
         using errcode='23505';
    end if;
    if not exists(select 1 from public.mapeo_areas m where m.activo
         and roque_private.roque_v16_normalizar(m.asignatura)=v_clave
         and roque_private.roque_v16_normalizar(m.area)=v_area_clave) then
      update public.mapeo_areas m set activo=true
      where not m.activo
        and roque_private.roque_v16_normalizar(m.asignatura)=v_clave
        and roque_private.roque_v16_normalizar(m.area)=v_area_clave;
      get diagnostics v_cambios=row_count;
      if v_cambios=0 then
        insert into public.mapeo_areas(area,asignatura,activo)
          values(v_area,v_nombre,true);
        v_cambios:=1;
      end if;
    end if;
  else
    if not exists(select 1 from public.carga_docente c
      where c.activo and roque_private.roque_v16_normalizar(c.asignatura)=v_clave) then
      raise exception 'Asignatura inexistente en la carga docente activa.' using errcode='22023';
    end if;
    if not exists(select 1 from public.mapeo_areas m where m.activo
         and roque_private.roque_v16_normalizar(m.asignatura)=v_clave
         and roque_private.roque_v16_normalizar(m.area)=v_area_clave) then
      raise exception 'La asignatura ya no está vinculada a esta área.'
        using errcode='22023';
    end if;
    if exists(select 1 from public.carga_docente c
         where roque_private.roque_v16_normalizar(c.asignatura)=v_clave)
       or exists(select 1 from public.claves k
         where roque_private.roque_v16_normalizar(k.area)=v_clave)
       or exists(select 1 from roque_private.items i
         where roque_private.roque_v16_normalizar(i.area)=v_clave) then
      raise exception 'No se puede desvincular: hay cargas docentes o evaluaciones históricas asociadas. No se modificó ningún registro.'
        using errcode='23503';
    end if;
    update public.mapeo_areas m set activo=false where m.activo
      and roque_private.roque_v16_normalizar(m.asignatura)=v_clave
      and roque_private.roque_v16_normalizar(m.area)=v_area_clave;
    get diagnostics v_cambios=row_count;
  end if;

  if v_cambios>0 then
    select coalesce(jsonb_agg(to_jsonb(m) order by m.id),'[]'::jsonb)
      into v_despues from public.mapeo_areas m
      where roque_private.roque_v16_normalizar(m.asignatura)=v_clave;
    insert into roque_private.auditoria_asignaturas_areas(
      actor_tipo,actor_id,operacion,area,asignatura,antes,despues
    ) values (
      v_actor_tipo,v_actor_id,p_operacion,v_area,v_nombre,v_antes,v_despues
    );
  end if;
  return jsonb_build_object('ok',true,'cambiado',v_cambios>0,'operacion',p_operacion);
end;
$$;
