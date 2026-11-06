/* RoqueObjetiva v175.85 · Restricciones y anulaciones. */
(() => {
 "use strict";
 const S={ctx:null,owner:"",edition:"",query:"",filter:"all",students:[],total:0,
  affected:0,hasMore:false,loaded:false,loading:false,selected:null,detail:null,
  mode:"restriccion",draft:{},busy:false,error:"",timer:0,serial:0};
 const escapeHTML=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
 const root=()=>document.getElementById("roque-medidas");
 const icon=(name,size=20)=>{
 const paths={
  shield:'<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
  user:'<circle cx="12" cy="8" r="4"/><path d="M4 21c0-5 3-8 8-8s8 3 8 8"/>',
  users:'<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
  calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  list:'<path d="M9 6h12M9 12h12M9 18h12M4 6h.01M4 12h.01M4 18h.01"/>',
  arrow:'<path d="m9 18 6-6-6-6"/>',
  back:'<path d="m15 18-6-6 6-6"/>',
  search:'<circle cx="11" cy="11" r="7"/><path d="m16 16 5 5"/>',
  check:'<path d="m4 12 5 5L20 6"/>',
  alert:'<path d="m12 3 10 18H2L12 3zm0 7v4m0 3h.01"/>',
  ban:'<circle cx="12" cy="12" r="9"/><path d="m5.5 5.5 13 13"/>',
  info:'<circle cx="12" cy="12" r="10"/><path d="M12 11v6m0-10h.01"/>'
 };
 return '<svg width="'+size+'" height="'+size+'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round" aria-hidden="true">'+(paths[name]||paths.info)+'</svg>';
 };
 const nameOf=x=>[x.apellidos,x.nombres].filter(Boolean).join(" ");
 const subjects=()=>Array.isArray(S.detail?.areas)?S.detail.areas:[];
 const stateOf=(type,key)=>Boolean(S.draft[type+":"+key]);
 const setDraft=d=>{
  const next={};
  (d.medidas||[]).forEach(m=>{next[m.tipo+":"+m.clave]=Boolean(m.activo)});
  S.draft=next;
 };
 const differences=mode=>{
  if(!S.detail)return [];
  const original=new Map((S.detail.medidas||[]).map(m=>[m.tipo+":"+m.clave,Boolean(m.activo)]));
  return Object.entries(S.draft)
   .filter(([key,active])=>key.startsWith(mode+":")&&Boolean(original.get(key))!==Boolean(active))
   .map(([key,active])=>({tipo:mode,clave:key.slice(mode.length+1),activo:Boolean(active)}));
 };
 const choice=(type,key,label,desc="")=>{
  const checked=stateOf(type,key);
  return '<label class="rm18-toggle-row'+(checked?" is-on":"")+'">'+
   '<input type="checkbox" data-rm18-type="'+escapeHTML(type)+'" data-rm18-key="'+escapeHTML(key)+'" '+
   (checked?"checked ":"")+(S.busy?"disabled ":"")+'>'+
   '<span class="rm18-toggle-label"><span>'+escapeHTML(label)+'</span>'+
   (desc?'<small>'+escapeHTML(desc)+'</small>':'')+'</span></label>';
 };
 const activePanel=()=>{
  const active=(S.detail?.medidas||[]).filter(m=>m.activo);
  return '<section class="rm18-section rm18-active"><header>'+icon("info",18)+
   '<div><h3>Medidas vigentes</h3><p>'+(active.length?active.length+" medida(s) registradas":"Sin restricciones ni anulaciones")+'</p></div></header>'+
   (active.length?'<div class="rm18-pills">'+active.map(m=>'<span class="rm18-pill '+(m.tipo==="restriccion"?"warning":"danger")+'">'+
    escapeHTML(m.tipo==="restriccion"?"Acceso restringido":m.tipo==="sesion"?"Sesión "+m.clave+" anulada":m.clave+" anulada")+
    '</span>').join("")+'</div>':'')+'</section>';
 };
 const detailTabs=()=>'<div class="rm18-modes" role="group" aria-label="Tipo de medida">'+
  [["restriccion","Restricción","shield"],["sesion","Sesiones","calendar"],["area","Asignaturas","list"]]
   .map(([mode,label,symbol])=>'<button type="button" class="rm18-mode'+(S.mode===mode?" active":"")+
    '" data-rm18-action="mode" data-mode="'+mode+'" aria-pressed="'+(S.mode===mode)+'">'+
    icon(symbol,20)+'<span>'+label+'</span></button>').join("")+'</div>';
 const currentPanel=()=>{
  const mode=S.mode,d=S.detail;
  let heading="",description="",rows="",type="warning";
  if(mode==="restriccion"){
   heading="Acceso al examen";
   description="Restringir impide iniciar sesión y consultar los resultados de este estudiante.";
   rows=choice("restriccion","general","Examen restringido","Nota temporal ⚠️ 20");
  }else if(mode==="sesion"){
   type="danger";heading="Anular sesiones";
   description="Cada sesión afecta únicamente las asignaturas que tienen ítems en ella.";
   rows='<div class="rm18-check-list">'+
    (Array.isArray(d.sesiones)&&d.sesiones.length?d.sesiones.map(n=>choice("sesion",String(n),
    Number(n)===1?"Primera sesión":Number(n)===2?"Segunda sesión":"Sesión "+n,"Nota efectiva ⛔ 20 en las áreas afectadas")).join("")
    :'<p class="rm18-muted">No hay sesiones configuradas.</p>')+'</div>';
  }else{
   type="danger";heading="Anular asignaturas";
   description="Selecciona las asignaturas que tendrán nota efectiva ⛔ 20.";
   rows='<div class="rm18-check-list">'+
    (subjects().length?subjects().map(a=>choice("area",a.clave,a.area,
    (a.sesiones||[]).some(n=>stateOf("sesion",String(n)))?"También afectada por una sesión anulada.":"")).join("")
    :'<p class="rm18-muted">Sin asignaturas configuradas.</p>')+'</div>';
  }
  return '<section class="rm18-section rm18-edit-panel rm18-'+type+'"><header>'+
    icon(mode==="restriccion"?"shield":"ban",21)+'<div><h3>'+heading+'</h3><p>'+description+'</p></div></header>'+
    rows+
    '<button class="rm18-save" type="button" data-rm18-action="apply" '+
    (S.busy||!differences(mode).length?'disabled':'')+'>'+icon("check",19)+'Aplicar</button>'+
    '<p class="rm18-muted">Los cambios quedan auditados. Las respuestas y notas originales se conservan.</p></section>';
 };
 const renderDetail=()=>{
  const d=S.detail;
  if(!d)return '<div class="rm18-detail"><button type="button" class="rm18-back" data-rm18-action="back">'+icon("back",19)+'Volver a estudiantes</button>'+
   '<p class="rm18-muted">Cargando información del estudiante…</p>'+
   (S.error?'<p class="rm18-error" role="alert">'+escapeHTML(S.error)+'</p>':'')+'</div>';
  const st=d.estudiante||{};
  return '<div class="rm18-detail">'+
   '<button type="button" class="rm18-back" data-rm18-action="back">'+icon("back",19)+'Volver a estudiantes</button>'+
   '<div class="rm18-student"><span class="rm18-student-icon">'+icon("user",27)+'</span><div><h3>'+escapeHTML(st.nombre||"")+'</h3>'+
   '<p>Documento '+escapeHTML(st.id_alumno)+' · ID prueba '+escapeHTML(st.id_prueba)+'</p></div>'+
   '<span class="rm18-grade">'+escapeHTML(st.grado)+'° · '+escapeHTML(st.grupo||"")+'</span></div>'+
   detailTabs()+currentPanel()+activePanel()+
   (Array.isArray(d.auditoria)&&d.auditoria.length?'<details class="rm18-audit"><summary>Historial de medidas</summary>'+
    d.auditoria.map(a=>'<p><strong>'+escapeHTML(a.activo_nuevo?"Aplicada":"Revertida")+'</strong> · '+
     escapeHTML(a.tipo)+' · '+escapeHTML(a.clave)+'<small>'+escapeHTML(String(a.creado_en||"").slice(0,19).replace("T"," "))+
     ' · '+escapeHTML(a.motivo)+'</small></p>').join("")+'</details>':'')+
   (S.error?'<p class="rm18-error" role="alert">'+escapeHTML(S.error)+'</p>':'')+'</div>';
 };
 const filterButton=(type,title,description,symbol)=>{
  const on=S.filter===type;
  return '<button type="button" class="rm18-filter'+(on?" active":"")+'" data-rm18-action="filter" data-filter="'+type+
   '" aria-pressed="'+on+'">'+
   '<span class="rm18-filter-icon">'+icon(symbol,22)+'</span>'+
   '<span class="rm18-filter-label"><span>'+title+'</span><small>'+description+'</small></span>'+
   (type==="active"?'<span class="rm18-counter" aria-label="'+S.affected+' estudiantes con medidas">'+S.affected+'</span>':"")+
   '</button>';
 };
 const renderHome=()=>'<div class="rm18-home"><header class="rm18-head"><p>ADMINISTRACIÓN</p><div>'+
  '<span class="rm18-head-icon">'+icon("shield",27)+'</span><section><h2>Restricciones y anulaciones</h2>'+
  '<p>Gestiona el acceso y las anulaciones de los estudiantes.</p></section></div></header>'+
  '<div class="rm18-filters" role="group" aria-label="Filtrar estudiantes">'+
   filterButton("all","Todos los estudiantes","Listado completo","users")+
   filterButton("active","Estudiantes con restricciones y anulaciones","Medidas vigentes","alert")+'</div>'+
  '<div class="rm18-search-panel"><label for="rm18-search">Buscar estudiante</label>'+
  '<div class="rm18-search-input">'+icon("search",18)+'<input id="rm18-search" type="search" maxlength="90" value="'+escapeHTML(S.query)+
   '" placeholder="Nombre, documento o ID de prueba" data-rm18-input="search"></div>'+
  '<p class="rm18-muted">'+(S.loading?"Cargando…":S.total+" estudiante(s) en esta lista")+'</p>'+
  '<div class="rm18-results">'+
   (S.students.length?S.students.map(x=>'<button type="button" class="rm18-student-result" data-rm18-action="open" data-roll="'+escapeHTML(x.id_prueba)+'">'+
    '<span class="rm18-result-name">'+escapeHTML(nameOf(x))+'<small>ID prueba '+escapeHTML(x.id_prueba)+' · '+escapeHTML(x.grado)+'° '+escapeHTML(x.grupo||"")+'</small></span>'+
    '<span class="rm18-result-flags">'+(x.restringido?'⚠️':'')+(Number(x.anulaciones)>0?' ⛔':'')+'</span>'+icon("arrow",17)+'</button>').join("")
   :'<p class="rm18-muted rm18-no-results">'+(S.loading?"Cargando estudiantes…":
    S.error?"No se pudo cargar la lista.":"No hay estudiantes que coincidan con este filtro.")+'</p>')+
  '</div>'+
  (S.hasMore?'<button type="button" class="rm18-more" data-rm18-action="more" '+(S.loading?"disabled":"")+
   '>Mostrar más estudiantes</button>':'')+
  '</div>'+(S.error?'<p class="rm18-error" role="alert">'+escapeHTML(S.error)+
   ' <button type="button" data-rm18-action="retry">Reintentar</button></p>':'')+'</div>';
 const render=ctx=>{
  if(ctx){
   const owner=String(ctx.owner||ctx.role||"admin");
   const edition=String(ctx.edition||"2026-1S");
   if(owner!==S.owner||edition!==S.edition){
    reset();S.owner=owner;S.edition=edition;
   }
   S.ctx=ctx;
   if(!S.loaded&&!S.loading)void search();
  }
  return '<section class="rm18-root" id="roque-medidas">'+(S.selected?renderDetail():renderHome())+'</section>';
 };
 const redraw=()=>{const el=root();if(el)el.outerHTML=render();};
 const call=(name,payload)=>S.ctx.rpc(name,payload);
 async function search({append=false,silent=false}={}){
  if(!S.ctx)return;
  const id=++S.serial,owner=S.owner,edition=S.edition;
  S.loading=true;S.error="";
  const offset=append?S.students.length:0;
  if(!append)S.students=[];
  if(!silent)redraw();
  try{
   const data=await call("roque_v19_medidas_listar",{
    p_edicion:edition,p_busqueda:S.query,p_solo_afectados:S.filter==="active",p_desde:offset,p_limite:80
   });
   if(id!==S.serial||owner!==S.owner||edition!==S.edition)return;
   if(!data?.ok||!Array.isArray(data.estudiantes))throw Error(data?.error||"No se pudo consultar estudiantes.");
   S.students=append?S.students.concat(data.estudiantes):data.estudiantes;
   S.total=Number(data.total)||0;
   S.affected=Number(data.total_afectados)||0;
   S.hasMore=Boolean(data.mas);
   S.loaded=true;
  }catch(e){if(id===S.serial){S.error=String(e?.message||e);S.loaded=true;}}
  finally{if(id===S.serial){S.loading=false;if(!silent)redraw();}}
 }
 async function open(roll){
  if(S.busy||!roll)return;
  S.busy=true;S.error="";S.selected=String(roll);S.detail=null;S.mode="restriccion";redraw();
  const owner=S.owner,edition=S.edition;
  try{
   const detail=await call("roque_v18_medidas_detalle",{p_edicion:edition,p_id_prueba:String(roll)});
   if(owner!==S.owner||edition!==S.edition)return;
   if(!detail?.ok)throw Error(detail?.error||"No se cargó el estudiante.");
   S.detail=detail;setDraft(detail);
  }catch(e){if(owner===S.owner){S.error=String(e?.message||e);S.selected=null;}}
  finally{if(owner===S.owner){S.busy=false;redraw();}}
 }
 async function apply(){
  if(S.busy||!S.detail)return;
  const changes=differences(S.mode);
  if(!changes.length)return;
  const owner=S.owner,edition=S.edition,student=S.selected,mode=S.mode;
  S.busy=true;S.error="";redraw();
  try{
   const result=await call("roque_v19_medidas_aplicar",{
    p_edicion:edition,p_id_prueba:student,p_cambios:changes
   });
   if(!result?.ok)throw Error(result?.error||"No se aplicaron los cambios.");
   if(owner!==S.owner||edition!==S.edition)return;
   const detail=await call("roque_v18_medidas_detalle",{p_edicion:edition,p_id_prueba:student});
   if(!detail?.ok)throw Error("Medidas guardadas. No fue posible actualizar el detalle.");
   S.detail=detail;setDraft(detail);S.mode=mode;
   S.ctx?.notify?.("Cambios aplicados y auditados en Supabase.");
   await search({silent:true});
  }catch(e){if(owner===S.owner)S.error=String(e?.message||e);}
  finally{if(owner===S.owner){S.busy=false;redraw();}}
 }
 function reset(){
  clearTimeout(S.timer);S.serial++;
  S.ctx=null;S.owner="";S.edition="";S.query="";S.filter="all";
  S.students=[];S.total=0;S.affected=0;S.hasMore=false;
  S.loaded=false;S.loading=false;S.selected=null;S.detail=null;S.mode="restriccion";
  S.draft={};S.busy=false;S.error="";
 }
 document.addEventListener("click",event=>{
  const button=event.target.closest("[data-rm18-action]");
  if(!button||!root()?.contains(button))return;
  event.preventDefault();
  if(S.busy)return;
  const action=button.dataset.rm18Action;
  if(action==="filter"){
   if(button.dataset.filter===S.filter)return;
   S.filter=button.dataset.filter==="active"?"active":"all";
   void search();return;
  }
  if(action==="open"){void open(button.dataset.roll);return;}
  if(action==="back"){S.selected=null;S.detail=null;S.error="";redraw();return;}
  if(action==="mode"){S.mode=button.dataset.mode||"restriccion";S.error="";redraw();return;}
  if(action==="apply"){void apply();return;}
  if(action==="more"){if(!S.loading)void search({append:true});return;}
  if(action==="retry"){void search();return;}
 });
 document.addEventListener("input",event=>{
  const input=event.target;
  if(!root()?.contains(input)||input.dataset.rm18Input!=="search")return;
  S.query=input.value;clearTimeout(S.timer);S.timer=setTimeout(()=>void search(),300);
 });
 document.addEventListener("change",event=>{
  const input=event.target;
  if(!root()?.contains(input)||!input.dataset.rm18Type||S.busy)return;
  const key=input.dataset.rm18Type+":"+input.dataset.rm18Key;
  S.draft[key]=input.checked;S.error="";redraw();
 });
 window.RoqueMedidas={render,reset};
})();