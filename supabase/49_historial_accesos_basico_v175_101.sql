-- RoqueObjetiva 49: Auditoría de accesos aislada de datos académicos.
-- No se insertan eventos históricos: el registro comienza al desplegar el nuevo login.
create table if not exists roque_private.historial_dispositivos (
 terminal uuid primary key,
 registrado_en timestamptz not null default clock_timestamp(),
 ultimo_evento timestamptz not null default clock_timestamp(),
 marca text, modelo text, modelo_origen text not null default 'desconocido'
   check (modelo_origen in ('detectado','estimado','desconocido')),
 sistema text, version_so text, navegador text, version_navegador text,
 ancho_pantalla integer, alto_pantalla integer, dpr numeric(5,2),
 bloqueado boolean not null default false,
 bloqueado_en timestamptz, bloqueado_por text, motivo_bloqueo text
);
create index if not exists idx_historial_disp_ultimo
  on roque_private.historial_dispositivos(ultimo_evento desc);
create table if not exists roque_private.historial_eventos (
 id bigint generated always as identity primary key,
 terminal uuid not null references roque_private.historial_dispositivos(terminal),
 fecha_hora timestamptz not null default clock_timestamp(),
 usuario text,
 rol text not null default 'desconocido',
 id_prueba text,
 id_docente text,
 evento text not null check (evento in ('login','bloqueado')),
 exitoso boolean not null default false
);
create index if not exists idx_historial_eventos_fecha
  on roque_private.historial_eventos(fecha_hora desc,id desc);
create index if not exists idx_historial_eventos_terminal
  on roque_private.historial_eventos(terminal,fecha_hora desc);
create index if not exists idx_historial_eventos_estudiante
  on roque_private.historial_eventos(id_prueba,fecha_hora desc) where id_prueba is not null;
create index if not exists idx_historial_eventos_docente
  on roque_private.historial_eventos(id_docente,fecha_hora desc) where id_docente is not null;
create table if not exists roque_private.historial_bloqueos (
 id bigint generated always as identity primary key,
 terminal uuid not null references roque_private.historial_dispositivos(terminal),
 bloqueado boolean not null, motivo text not null,
 actor_tipo text not null check(actor_tipo in ('admin_auth','admin_docente')),
 actor_id text not null,
 fecha_hora timestamptz not null default clock_timestamp()
);
create index if not exists idx_historial_bloqueos_terminal
 on roque_private.historial_bloqueos(terminal,fecha_hora desc);
alter table roque_private.historial_dispositivos enable row level security;
alter table roque_private.historial_eventos enable row level security;
alter table roque_private.historial_bloqueos enable row level security;
revoke all on roque_private.historial_dispositivos,
  roque_private.historial_eventos,roque_private.historial_bloqueos
  from public,anon,authenticated;
revoke all on all sequences in schema roque_private from anon,authenticated;

create or replace function roque_private.autorizar_auditoria_accesos(p_docente text,p_sesion text)
returns boolean language sql stable security definer set search_path='' as $$
 select
  (auth.uid() is not null and exists (
    select 1 from roque_private.operadores_admin a where a.user_id=auth.uid() and a.activo))
  or
  (length(coalesce(p_docente,'')) between 1 and 100 and
    roque_private.validar_coordinador_sesion(p_docente,p_sesion) and exists (
      select 1 from public.docentes d where d.id_docente=p_docente
        and d.activo and d.rol='administrador'));
$$;
revoke all on function roque_private.autorizar_auditoria_accesos(text,text)
 from public,anon,authenticated;

-- Único login de la versión nueva. Conserva la respuesta exacta del login antiguo,
-- incluidos 2573, medidas, expiración, edición y límites de consulta.
create or replace function public.roque_v21_login_auditado(
 p_user text, p_password text default '',
 p_terminal uuid default null, p_device text default null,
 p_mode text default null, p_client jsonb default '{}'::jsonb
) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
 v_answer jsonb;
 v_login text:=left(pg_catalog.btrim(coalesce(p_user,'')),120);
 v_role text:='desconocido';
 v_exam text;
 v_teacher text;
 v_blocked boolean;
 v_client jsonb:=coalesce(p_client,'{}'::jsonb);
 v_now timestamptz:=clock_timestamp();
begin
 if p_terminal is null then
   return pg_catalog.jsonb_build_object('ok',false,
    'error','No pudimos identificar esta instalación del navegador. Habilita el almacenamiento del sitio.');
 end if;
 if length(v_login)=0 or length(v_login)>120 then
   return pg_catalog.jsonb_build_object('ok',false,'error','Usuario inválido.');
 end if;
 -- Etiquetas de navegador NO se usan para autorizar; solo la UUID del navegador.
 insert into roque_private.historial_dispositivos
 (terminal,registrado_en,ultimo_evento,marca,modelo,modelo_origen,
  sistema,version_so,navegador,version_navegador,ancho_pantalla,alto_pantalla,dpr)
 values(p_terminal,v_now,v_now,
  left(nullif(btrim(v_client->>'marca'),''),60),
  left(nullif(btrim(v_client->>'modelo'),''),90),
  case when v_client->>'modelo_origen' in ('detectado','estimado','desconocido')
    then v_client->>'modelo_origen' else 'desconocido' end,
  left(nullif(btrim(v_client->>'sistema'),''),60),
  left(nullif(btrim(v_client->>'version_so'),''),30),
  left(nullif(btrim(v_client->>'navegador'),''),60),
  left(nullif(btrim(v_client->>'version_navegador'),''),30),
  case when (v_client->>'ancho_pantalla') ~ '^[0-9]{1,5}$'
       then least((v_client->>'ancho_pantalla')::integer,16000) end,
  case when (v_client->>'alto_pantalla') ~ '^[0-9]{1,5}$'
       then least((v_client->>'alto_pantalla')::integer,16000) end,
  case when (v_client->>'dpr') ~ '^[0-9]{1,3}(\.[0-9]{1,2})?$'
       then least((v_client->>'dpr')::numeric,99) end
 )
 on conflict (terminal) do update
 set ultimo_evento=v_now,
 marca=coalesce(excluded.marca,roque_private.historial_dispositivos.marca),
 modelo=coalesce(excluded.modelo,roque_private.historial_dispositivos.modelo),
 modelo_origen=case when excluded.modelo is not null
   then excluded.modelo_origen else roque_private.historial_dispositivos.modelo_origen end,
 sistema=coalesce(excluded.sistema,roque_private.historial_dispositivos.sistema),
 version_so=coalesce(excluded.version_so,roque_private.historial_dispositivos.version_so),
 navegador=coalesce(excluded.navegador,roque_private.historial_dispositivos.navegador),
 version_navegador=coalesce(excluded.version_navegador,roque_private.historial_dispositivos.version_navegador),
 ancho_pantalla=coalesce(excluded.ancho_pantalla,roque_private.historial_dispositivos.ancho_pantalla),
 alto_pantalla=coalesce(excluded.alto_pantalla,roque_private.historial_dispositivos.alto_pantalla),
 dpr=coalesce(excluded.dpr,roque_private.historial_dispositivos.dpr);

 select d.bloqueado into v_blocked
 from roque_private.historial_dispositivos d where d.terminal=p_terminal;
 if v_blocked then
   insert into roque_private.historial_eventos(terminal,fecha_hora,usuario,evento,exitoso)
   values(p_terminal,v_now,v_login,'bloqueado',false);
   return pg_catalog.jsonb_build_object('ok',false,
      'error','El acceso desde esta instalación del navegador está bloqueado por Administración.',
      'motivo','dispositivo_bloqueado');
 end if;
 -- Sin modificar la lógica preexistente de autenticación y evaluación.
 v_answer:=public.roque_v8_login_controlado_private(
   p_user,p_password,p_terminal,p_device,p_mode);
 v_role:=case when v_answer->'session'->>'role' in ('student','teacher','admin')
   then v_answer->'session'->>'role' else 'desconocido' end;
 if v_role='student' then v_exam:=v_answer->'session'->>'roll';end if;
 if v_role='teacher' then v_teacher:=v_answer->'session'->>'id';end if;
 -- En intentos fallidos no devolver identidad inferida al cliente; solo el admin ve el login intentado.
 insert into roque_private.historial_eventos
   (terminal,fecha_hora,usuario,rol,id_prueba,id_docente,evento,exitoso)
 values(p_terminal,v_now,v_login,v_role,v_exam,v_teacher,'login',
   coalesce((v_answer->>'ok')::boolean,false));
 return v_answer;
end $$;
revoke all on function public.roque_v21_login_auditado(text,text,uuid,text,text,jsonb)
 from public,anon,authenticated;
grant execute on function public.roque_v21_login_auditado(text,text,uuid,text,text,jsonb)
 to anon,authenticated;
-- End initial audit migration.
