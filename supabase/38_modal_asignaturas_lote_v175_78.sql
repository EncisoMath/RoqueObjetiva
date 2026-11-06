-- v175.78 · Eliminar asociación de áreas sin eliminar registros académicos; vinculación múltiple transaccional.
-- No se modifican tablas de cargas, claves, ítems ni resultados.
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
    -- Administrador puede retirar únicamente la asociación: inactivación lógica.
    -- Se preservan las filas de carga_docente, claves, items y resultados.
    -- El frontend exige confirmación y advierte sobre cambios en clasificación.
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

create or replace function public.roque_v17_areas_vincular_lote(
  p_area text, p_asignaturas text[], p_docente text default null, p_sesion text default null
) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
  v_subject text;
  v_subject_norm text;
  v_seen text[]:=array[]::text[];
  v_count integer:=0;
  v_activos integer;
  v_resultado jsonb;
begin
  -- Validación de permisos independiente, idéntica al guardado individual.
  if not (
    (auth.uid() is not null and exists(
      select 1 from roque_private.operadores_admin o
      where o.user_id=auth.uid() and o.activo
    ))
    or (
      nullif(p_docente,'') is not null
      and exists(
        select 1 from public.docentes d
        where d.id_docente=p_docente and d.activo and d.rol='administrador'
      )
      and roque_private.validar_coordinador_sesion(p_docente,p_sesion)
    )
  ) then
    raise exception 'Operación exclusiva del administrador con sesión vigente.' using errcode='42501';
  end if;
  if p_asignaturas is null or cardinality(p_asignaturas)<1 or cardinality(p_asignaturas)>60 then
    raise exception 'Selecciona entre 1 y 60 asignaturas.' using errcode='22023';
  end if;
  if nullif(btrim(coalesce(p_area,'')),'') is null then
    raise exception 'Área inválida.' using errcode='22023';
  end if;
  foreach v_subject in array p_asignaturas loop
    v_subject:=btrim(coalesce(v_subject,''));
    v_subject_norm:=roque_private.roque_v16_normalizar(v_subject);
    if length(v_subject)<2 or v_subject_norm=any(v_seen) then
      raise exception 'Hay asignaturas vacías o repetidas en la selección.' using errcode='22023';
    end if;
    v_seen:=array_append(v_seen,v_subject_norm);
    v_resultado:=public.roque_v16_areas_guardar('vincular',p_area,v_subject,p_docente,p_sesion);
    if coalesce((v_resultado->>'cambiado')::boolean,false) then
      v_count:=v_count+1;
    end if;
  end loop;
  return jsonb_build_object('ok',true,'vinculadas',v_count,'seleccionadas',cardinality(p_asignaturas));
end;
$$;
revoke all on function public.roque_v17_areas_vincular_lote(text,text[],text,text) from public,anon,authenticated;
grant execute on function public.roque_v17_areas_vincular_lote(text,text[],text,text) to anon,authenticated;
comment on function public.roque_v17_areas_vincular_lote(text,text[],text,text)
is 'Vincula en una sola transacción únicamente asignaturas existentes de carga docente activa; permiso administrador y auditoría por asignatura.';
