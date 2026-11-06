/* RoqueObjetiva v175.82 · Restricciones y anulaciones. */
(() => {
 "use strict";
 const S={ctx:null,owner:"",edition:"",editions:[],query:"",students:[],selected:null,detail:null,draft:{},busy:false,error:"",reason:"",section:"students",timer:0,serial:0};
 const escapeHTML=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
 const normal=v=>String(v??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").trim().toLowerCase();
 const root=()=>document.getElementById("roque-medidas");
 const icon=(name,size=20)=>{
 const parts={
  shield:'<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
  user:'<circle cx="12" cy="8" r="4"/><path d="M4 21c0-5 3-8 8-8s8 3 8 8"/>',
  calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  list:'<path d="M9 6h12M9 12h12M9 18h12M4 6h.01M4 12h.01M4 18h.01"/>',
  arrow:'<path d="m9 18 6-6-6-6"/>',
  back:'<path d="m15 18-6-6 6-6"/>',
  search:'<circle cx="11" cy="11" r="7"/><path d="m16 16 5 5"/>',
  check:'<path d="m4 12 5 5L20 6"/>',
  save:'<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 3v7h8V3M8 21v-7h8v7"/>',
  alert:'<path d="m12 3 10 18H2L12 3zm0 7v4m0 3h.01"/>',
  ban:'<circle cx="12" cy="12" r="9"/><path d="m5.5 5.5 13 13"/>',
  info:'<circle cx="12" cy="12" r="10"/><path d="M12 11v6m0-10h.01"/>'
 };
 return '<svg width="'+size+'" height="'+size+'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.85" stroke-linejoin="round" stroke-linecap="round" aria-hidden="true">'+(parts[name]||parts.info)+'</svg>';
 };
 const card=(id,title,subtitle,symbol)=>'<button type="button" class="rm18-menu-card'+(S.section===id?" active":"")+'" data-rm18-action="section" data-section="'+id+'"><span class="rm18-menu-icon">'+icon(symbol,24)+'</span><span class="rm18-menu-text"><strong>'+title+'</strong><small>'+subtitle+'</small></span>'+icon("arrow",19)+'</button>';
 const nameOf=x=>[x.apellidos,x.nombres].filter(Boolean).join(" ");
 const subjects=()=>Array.isArray(S.detail?.areas)?S.detail.areas:[];
 const stateOf=(type,key)=>Boolean(S.draft[type+":"+key]);
 const setDraft=(detail)=>{
  const draft={};
  (detail.medidas||[]).forEach(m=>{draft[m.tipo+":"+m.clave]=Boolean(m.activo)});
  S.draft=draft;
 };
 const hasDiff=()=>{
  if(!S.detail)return false;
  const actual=new Map((S.detail.medidas||[]).map(x=>[x.tipo+":"+x.clave,Boolean(x.activo)]));
  return Object.entries(S.draft).some(([key,val])=>Boolean(actual.get(key))!==Boolean(val));
 };
 const choice=(tipo,clave,label,desc="")=>{
  const checked=stateOf(tipo,clave);
  return '<label class="rm18-toggle-row'+(checked?" is-on":"")+'">'+
   '<input type="checkbox" data-rm18-type="'+escapeHTML(tipo)+'" data-rm18-key="'+escapeHTML(clave)+'" '+(checked?"checked ":"")+(S.busy?"disabled ":"")+'>'+
   '<span class="rm18-toggle-label"><span>'+escapeHTML(label)+'</span>'+(desc?'<small>'+escapeHTML(desc)+'</small>':'')+'</span>'+
   '<span class="rm18-switch" aria-hidden="true"><i></i></span></label>';
 };
 const renderDetail=()=>{
  const d=S.detail;
  if(!d)return '<p class="rm18-muted">Cargando información del estudiante…</p>';
  const st=d.estudiante||{},areas=subjects();
  const active=(d.medidas||[]).filter(x=>x.activo);
  const currentRestricted=stateOf("restriccion","general");
  return '<div class="rm18-detail">'+
   '<button type="button" class="rm18-back" data-rm18-action="back">'+icon("back",19)+'Volver a estudiantes</button>'+
   '<div class="rm18-student"><span class="rm18-student-icon">'+icon("user",27)+'</span><div><h3>'+escapeHTML(st.nombre||"")+'</h3>'+
   '<p>Documento '+escapeHTML(st.id_alumno)+' · ID prueba '+escapeHTML(st.id_prueba)+'</p></div>'+
   '<span class="rm18-grade">'+escapeHTML(st.grado)+'° · '+escapeHTML(st.grupo||"")+'</span></div>'+
   '<section class="rm18-section rm18-yellow"><header>'+icon("shield",21)+'<div><h3>Acceso al examen</h3>'+
   '<p>Impide iniciar sesión y consultar resultados de esta edición.</p></div></header>'+
   choice("restriccion","general","Examen restringido","Nota efectiva: ⚠️ 20")+'</section>'+
   '<section class="rm18-section"><header>'+icon("ban",21)+'<div><h3>Anulaciones</h3>'+
   '<p>Selecciona las sesiones o asignaturas que se anularán.</p></div></header>'+
   '<h4>Sesiones del examen</h4><div class="rm18-check-list">'+
   (Array.isArray(d.sesiones)&&d.sesiones.length?d.sesiones.map(n=>choice("sesion",String(n),(Number(n)===1?"Primera sesión":Number(n)===2?"Segunda sesión":"Sesión "+n),"Afecta solo las áreas con ítems en esta sesión.")).join(""):'<p class="rm18-muted">No hay sesiones configuradas.</p>')+
   '</div><h4>Asignaturas específicas</h4>'+
   '<div class="rm18-check-list">'+(areas.length?areas.map(a=>choice("area",a.clave,a.area,
     (a.sesiones||[]).some(n=>stateOf("sesion",String(n)))?"También afectada por una sesión anulada.":"Nota efectiva: ⛔ 20")).join(""):'<p class="rm18-muted">Sin asignaturas configuradas.</p>')+
   '</div></section>'+
   '<section class="rm18-section rm18-active"><header>'+icon("info",20)+'<div><h3>Medidas vigentes</h3>'+
   '<p>'+ (active.length?active.length+" medida(s) registradas":"Sin restricciones ni anulaciones")+'</p></div></header>'+
   (active.length?'<div class="rm18-pills">'+active.map(a=>'<span class="rm18-pill '+(a.tipo==="restriccion"?"warning":"danger")+'">'+escapeHTML(a.tipo==="restriccion"?"Acceso restringido":a.tipo==="sesion"?"Sesión "+a.clave+" anulada":a.clave+" anulada")+'</span>').join("")+'</div>':'')+'</section>'+
   '<section class="rm18-save-panel"><label for="rm18-motivo">Motivo del cambio <span>(obligatorio)</span></label>'+
   '<textarea id="rm18-motivo" maxlength="500" minlength="5" rows="2" placeholder="Explica por qué se aplica o revierte la medida…" '+(S.busy?'disabled':'')+'>'+escapeHTML(S.reason)+'</textarea>'+
   '<button class="rm18-save" type="button" data-rm18-action="save" '+(S.busy||!hasDiff()?'disabled':'')+'>'+icon("save",19)+'Guardar cambios</button>'+
   '<p class="rm18-muted">Cada cambio guarda responsable, fecha, motivo y estado anterior. Los resultados originales se conservan.</p>'+
   '</section>'+
   (Array.isArray(d.auditoria)&&d.auditoria.length?'<details class="rm18-audit"><summary>Historial de medidas</summary>'+
      d.auditoria.map(a=>'<p><strong>'+escapeHTML(a.activo_nuevo?"Aplicada":"Revertida")+'</strong> · '+escapeHTML(a.tipo)+' · '+escapeHTML(a.clave)+
         '<small>'+escapeHTML(String(a.creado_en||"").slice(0,19).replace("T"," "))+' · '+escapeHTML(a.motivo)+'</small></p>').join("")+
      '</details>':'')+
   (S.error?'<p class="rm18-error" role="alert">'+escapeHTML(S.error)+'</p>':'')+'</div>';
 };
 const renderHome=()=>'<div class="rm18-home"><header class="rm18-head"><p>ADMINISTRACIÓN</p><div>'+
  '<span class="rm18-head-icon">'+icon("shield",27)+'</span><section><h2>Restricciones y anulaciones</h2>'+
  '<p>Gestiona el acceso a exámenes y las anulaciones por sesión o asignatura.</p></section></div></header>'+
  '<div class="rm18-menu">'+card("students","Estudiantes","Restringir acceso y administrar anulaciones","user")+
  card("sessions","Sesiones","Anular la primera o segunda sesión","calendar")+
  card("subjects","Asignaturas","Anular asignaturas específicas","list")+'</div>'+
  '<div class="rm18-search-panel"><label for="rm18-edition">Edición del examen</label>'+
  '<select id="rm18-edition" data-rm18-select="edition">'+(S.editions.length?S.editions.map(e=>'<option value="'+escapeHTML(e.codigo)+'"'+(e.codigo===S.edition?' selected':'')+'>'+escapeHTML(e.codigo)+'</option>').join(""):'<option value="'+escapeHTML(S.edition)+'">'+escapeHTML(S.edition)+'</option>')+'</select>'+
  '<label for="rm18-search">Buscar estudiante</label>'+
  '<div class="rm18-search-input">'+icon("search",18)+'<input id="rm18-search" type="search" maxlength="90" value="'+escapeHTML(S.query)+'" placeholder="Nombre, documento o ID de prueba" data-rm18-input="search"></div>'+
  '<p class="rm18-muted">Selecciona un estudiante para gestionar sus medidas.</p>'+
  '<div class="rm18-results">'+(S.students.length?S.students.map(x=>'<button type="button" class="rm18-student-result" data-rm18-action="open" data-roll="'+escapeHTML(x.id_prueba)+'">'+
  '<span class="rm18-result-name">'+escapeHTML(nameOf(x))+'<small>ID prueba '+escapeHTML(x.id_prueba)+' · '+escapeHTML(x.grado)+'° '+escapeHTML(x.grupo||"")+'</small></span>'+
  '<span class="rm18-result-flags">'+(x.restringido?'⚠️':'')+(Number(x.anulaciones)>0?' ⛔':'')+'</span>'+icon("arrow",18)+'</button>').join(""):'<p class="rm18-muted rm18-no-results">'+(S.busy?"Cargando estudiantes…":"Sin coincidencias para esta búsqueda.")+'</p>')+
  '</div></div>'+
  (S.error?'<p class="rm18-error" role="alert">'+escapeHTML(S.error)+'</p>':'')+'</div>';
 const render=ctx=>{
  if(ctx){
   const next=String(ctx.owner||ctx.role||"admin");
   if(next!==S.owner){reset();S.owner=next;S.edition=String(ctx.edition||"2026-1S");}
   S.ctx=ctx;
   if(!S.busy&&!S.students.length&&!S.detail){void search();}
  }
  return '<section class="rm18-root" id="roque-medidas">'+(S.selected?renderDetail():renderHome())+'</section>';
 };
 const redraw=()=>{const r=root();if(r)r.outerHTML=render();};
 const call=(name,params)=>S.ctx.rpc(name,params);
 async function search(){
  if(!S.ctx||S.busy)return;
  const serial=++S.serial;S.busy=true;S.error="";
  try{
   const p=await call("roque_v18_medidas_buscar",{p_edicion:S.edition,p_busqueda:S.query});
   if(serial!==S.serial)return;
   if(!p?.ok)throw Error(p?.error||"No se pudieron consultar los estudiantes.");
   S.students=Array.isArray(p.estudiantes)?p.estudiantes:[];
   if(Array.isArray(p.ediciones))S.editions=p.ediciones;
  }catch(e){if(serial===S.serial)S.error=String(e?.message||e)}
  finally{if(serial===S.serial){S.busy=false;redraw()}}
 }
 async function open(roll){
  if(S.busy||!roll)return;
  S.busy=true;S.error="";S.selected=String(roll);S.detail=null;redraw();
  try{
   const p=await call("roque_v18_medidas_detalle",{p_edicion:S.edition,p_id_prueba:S.selected});
   if(!p?.ok)throw Error(p?.error||"No se cargó el estudiante.");
   S.detail=p;setDraft(p);S.reason="";
  }catch(e){S.error=String(e?.message||e);S.selected=null}
  finally{S.busy=false;redraw()}
 }
 async function save(){
  if(S.busy||!S.detail||!hasDiff())return;
  const reason=S.reason.trim();
  if(reason.length<5){S.error="Debes escribir un motivo de al menos 5 caracteres.";redraw();return}
  const old=new Map((S.detail.medidas||[]).map(m=>[m.tipo+":"+m.clave,Boolean(m.activo)]));
  const changes=Object.entries(S.draft).filter(([k,v])=>Boolean(old.get(k))!==Boolean(v)).map(([k,v])=>{
   const pos=k.indexOf(":");return {tipo:k.slice(0,pos),clave:k.slice(pos+1),activo:Boolean(v)};
  });
  if(!changes.length)return;
  S.busy=true;S.error="";
  try{
   const p=await call("roque_v18_medidas_guardar",{p_edicion:S.edition,p_id_prueba:S.selected,p_cambios:changes,p_motivo:reason});
   if(!p?.ok)throw Error(p?.error||"No se guardaron las medidas.");
   S.ctx?.notify?.("Medidas guardadas en Supabase.");
   const updated=await call("roque_v18_medidas_detalle",{p_edicion:S.edition,p_id_prueba:S.selected});
   if(!updated?.ok)throw Error("Guardado confirmado. Actualiza el detalle para ver el nuevo estado.");
   S.detail=updated;setDraft(updated);S.reason="";
  }catch(e){S.error=String(e?.message||e)}
  finally{S.busy=false;redraw()}
 }
 function reset(){S.ctx=null;S.owner="";S.edition="";S.editions=[];S.query="";S.students=[];S.selected=null;S.detail=null;S.draft={};S.reason="";S.busy=false;S.error="";S.serial++;}
 document.addEventListener("click",event=>{
  const b=event.target.closest("[data-rm18-action]");
  if(!b||!root()?.contains(b))return;
  event.preventDefault();if(S.busy)return;
  const act=b.dataset.rm18Action;
  if(act==="section"){S.section=b.dataset.section||"students";redraw();return}
  if(act==="open"){void open(b.dataset.roll);return}
  if(act==="back"){S.selected=null;S.detail=null;S.error="";redraw();return}
  if(act==="save"){void save();return}
 });
 document.addEventListener("input",event=>{
  const el=event.target;
  if(!root()?.contains(el))return;
  if(el.id==="rm18-motivo"){S.reason=el.value;return;}
  if(el.dataset.rm18Input!=="search")return;
  S.query=el.value;clearTimeout(S.timer);S.timer=setTimeout(()=>void search(),300);
 });
 document.addEventListener("change",event=>{
  const el=event.target;
  if(!root()?.contains(el))return;
  if(el.dataset.rm18Select==="edition"){S.edition=el.value;S.students=[];S.query="";S.error="";void search();redraw();return}
  if(el.dataset.rm18Type){
   const key=el.dataset.rm18Type+":"+el.dataset.rm18Key;
   S.draft[key]=el.checked;S.error="";redraw();
  }
 });
 window.RoqueMedidas={render,reset};
})();