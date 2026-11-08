-- RoqueObjetiva v175.102 · Implementación desplegada de roque_v21_login_auditado
CREATE OR REPLACE FUNCTION public.roque_v21_login_auditado(p_user text, p_password text DEFAULT ''::text, p_terminal uuid DEFAULT NULL::uuid, p_device text DEFAULT NULL::text, p_mode text DEFAULT NULL::text, p_client jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
 if v_role='admin' and auth.uid() is not null then
   -- Asociar el acceso del operador Auth con su fila administrativa.
   v_teacher:=auth.uid()::text;
   v_login:=auth.uid()::text;
 end if;
 if v_role='desconocido' then
   -- En los fallos, registrar la cuenta INTENTADA solo para la auditoría;
   -- jamás se revela esta asociación en la respuesta del login.
   select d.id_docente into v_teacher from public.docentes d
   where d.activo and lower(d.id_docente)=lower(v_login) limit 1;
   if v_teacher is null then
     select i.id_prueba into v_exam from roque_private.inscripciones i
     where i.activo and (lower(i.id_prueba)=lower(v_login) or lower(i.id_alumno)=lower(v_login))
     order by i.edicion desc limit 1;
   end if;
 end if;
 -- En intentos fallidos no devolver identidad inferida al cliente; solo el admin ve el login intentado.
 insert into roque_private.historial_eventos
   (terminal,fecha_hora,usuario,rol,id_prueba,id_docente,evento,exitoso)
 values(p_terminal,v_now,v_login,v_role,v_exam,v_teacher,'login',
   coalesce((v_answer->>'ok')::boolean,false));
 return v_answer;
end $function$;
