-- v175.84 · Login rápido cuando no hay medidas activas; se mantienen protecciones al existir medidas.
CREATE OR REPLACE FUNCTION roque_private.mascara_payload_docente_legacy(p_payload jsonb, p_edicion text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_groups jsonb:='[]'::jsonb;v_group jsonb;v_rows jsonb;v_row jsonb;
 v_grade integer;v_session integer;v_start integer;v_roll text;v_item record;v_canon text;
 v_new jsonb;v_reg roque_private.inscripciones%rowtype;v_medidas jsonb;
begin
 if p_payload->'session'->>'role' not in ('student','teacher') then return p_payload; end if;
 -- Fast path: cuando la edición no tiene medidas activas, no recorrer los
 -- miles de ítems ni reconstruir los grupos completos de resultados.
 -- Devuelve payload idéntico con la lista de medidas vacía.
 if not exists(
   select 1 from roque_private.medidas_estudiante m
   where m.edicion=p_edicion and m.activo
 ) then
   return jsonb_set(p_payload,'{datasets,medidas}','[]'::jsonb,true);
 end if;
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
 select coalesce(jsonb_agg(roque_private.resumen_medidas(p_edicion,e.x->>'ID_PRUEBA',
    coalesce(nullif(e.x->>'GRADO','')::integer,0))),'[]'::jsonb) into v_medidas
 from jsonb_array_elements(coalesce(p_payload->'datasets'->'estudiantes','[]'::jsonb)) e(x);
 return jsonb_set(jsonb_set(p_payload,'{datasets,resultados}',v_groups,true),
 '{datasets,medidas}',coalesce(v_medidas,'[]'::jsonb),true);
end;
$function$

