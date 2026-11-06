/* RoqueObjetiva v175.67 · Consulta individual · Admin / Coordinador.
 * La búsqueda solo abre sugerencias al escribir. Toda lectura y edición utiliza RPC seguras.
 */
(() => {
"use strict";
const S={
 owner:"",edition:"",ctx:null,ready:false,loading:false,saving:false,detailLoading:false,
 grades:[],sedes:[],courses:[],origin:"",grade:"",sede:"",course:"",
 query:"",matches:[],selected:null,detail:null,original:null,draft:null,
 error:"",tip:"",editing:false,request:0,searchTimer:null,searchSeq:0
};
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const name=e=>[e?.nombres,e?.apellidos].filter(Boolean).join(" ").trim();
const root=()=>document.getElementById("roque-student-lookup");
const args=()=>({
 p_edicion:S.edition,
 p_docente:S.ctx?.role==="teacher"?S.ctx?.id:null,
 p_sesion:S.ctx?.role==="teacher"?S.ctx?.session:null
});
const dirty=()=>!!S.draft&&!!S.original&&["id_alumno","id_prueba","nombres","apellidos","sede","grado","grupo"].some(k=>String(S.draft[k]??"").trim()!==String(S.original[k]??"").trim());
const options=(values,selected,placeholder)=>'<option value="">'+esc(placeholder)+'</option>'+
 values.map(v=>'<option value="'+esc(v)+'"'+(String(v)===String(selected)?' selected':'')+'>'+esc(v)+'</option>').join("");
function filterHtml(){
 const grades=S.grades.length?S.grades:[5,6,7,8,9,10,11];
 const sedes=S.sedes;
 const courses=S.courses.filter(c=>(!S.grade||String(c.grado)===String(S.grade))&&(!S.sede||c.sede===S.sede))
  .map(c=>c.curso).filter((v,i,a)=>v&&a.indexOf(v)===i).sort((a,b)=>a.localeCompare(b,"es",{numeric:true}));
 return '<div class="rce-filters">'+
  '<label>Grado<select data-rce-filter="grade">'+options(grades,S.grade,"Todos los grados")+'</select></label>'+
  '<label>Sede<select data-rce-filter="sede">'+options(sedes,S.sede,"Todas las sedes")+'</select></label>'+
  '<label>Curso<select data-rce-filter="course">'+options(courses,S.course,"Todos los cursos")+'</select></label>'+
 '</div>';
}
function suggestions(){
 if(!S.query.trim()||(S.selected&&S.query===name(S.selected)))return "";
 if(S.query.trim().length<2)return '<div class="rce-hint">Escribe al menos dos caracteres.</div>';
 if(S.tip==="Buscando…")return '<div class="rce-hint">Buscando estudiantes…</div>';
 if(S.error)return '<div class="rce-hint rce-error">'+esc(S.error)+'</div>';
 if(!S.matches.length)return '<div class="rce-hint">No se encontraron coincidencias.</div>';
 return '<div class="rce-suggestions" role="listbox" aria-label="Estudiantes encontrados">'+
  S.matches.map((e,i)=>'<button type="button" role="option" class="rce-suggestion" data-rce-pick="'+i+'">'+
   '<span class="rce-avatar">'+esc((e.nombres||"?").charAt(0))+'</span>'+
   '<span><strong>'+esc(name(e))+'</strong><small>'+esc(e.sede||"Sede sin registrar")+' · '+esc(e.grado)+'° '+esc(e.grupo||"")+' · Prueba '+esc(e.id_prueba)+'</small></span>'+
   '<span class="rce-next">›</span></button>').join("")+'</div>';
}
function field(label,key,value,extra=""){
 return '<label class="rce-field"><span>'+esc(label)+'</span><input data-rce-field="'+key+
 '" value="'+esc(value??"")+'" maxlength="'+(key==="id_alumno"||key==="id_prueba"?40:key==="grupo"?35:120)+
 '" '+extra+'></label>';
}
function profileHtml(){
 const e=S.draft;
 if(!e)return "";
 const gradeOptions=Array.from({length:7},(_,i)=>i+5).map(v=>
  '<option value="'+v+'"'+(Number(e.grado)===v?' selected':'')+'>'+v+'°</option>').join("");
 const sourceHint=e.origen==="institucional"
  ?"Registro institucional. La edición consultada aún no tiene inscripciones propias; los cambios de esta ficha se guardan en el registro institucional."
  :"Inscripción de "+S.edition+". Los cambios quedan registrados con auditoría.";
 const editFields='<div class="rce-profile-grid">'+
  field("Nombres","nombres",e.nombres)+field("Apellidos","apellidos",e.apellidos)+
  field("Sede","sede",e.sede)+
  '<label class="rce-field"><span>Grado</span><select data-rce-field="grado">'+gradeOptions+'</select></label>'+
  field("Curso","grupo",e.grupo)+
  field("ID de prueba","id_prueba",e.id_prueba)+
  field("ID de documento","id_alumno",e.id_alumno)+
 '</div>';
 return '<section class="rce-profile">'+
  '<div class="rce-profile-heading"><span class="rce-profile-icon">'+esc((e.nombres||"?").charAt(0))+'</span>'+
  '<div><span class="rce-eyebrow">FICHA DEL ESTUDIANTE</span><h3>'+esc(name(e))+'</h3>'+
  '<p>'+esc(e.sede||"Sede sin registrar")+' · '+esc(e.grado)+'° '+esc(e.grupo||"")+'</p></div>'+
  '<div class="rce-profile-actions">'+
   '<button class="rce-edit-toggle" type="button" data-rce-edit-toggle aria-expanded="'+S.editing+'">'+
    (S.editing?'Cerrar edición':'Editar datos')+'</button>'+
  '</div></div>'+
  '<div class="rce-profile-tags">'+
   '<span class="rce-profile-tag">ID de prueba <strong>'+esc(e.id_prueba||"—")+'</strong></span>'+
   '<span class="rce-profile-tag">Documento <strong>'+esc(e.id_alumno||"—")+'</strong></span>'+
  '</div>'+
  (S.editing?'<div class="rce-editor">'+editFields+
  '<p class="rce-source">'+esc(sourceHint)+'</p>'+
  '<p class="rce-caution">Cambiar grado, documento o ID de prueba puede modificar la vinculación del examen y los rankings. Verifica los datos antes de guardar.</p>'+
  '<div class="rce-save-bar"><span id="rce-save-state" aria-live="polite">'+(S.error?esc(S.error):esc(S.tip||""))+'</span>'+
  '<button type="button" id="rce-save" data-rce-save '+(!dirty()||S.saving?'disabled':'')+'>'+
   (S.saving?"Guardando…":"Guardar cambios")+'</button></div></div>':'')+'</section>';
}
function resultsHtml(){
 if(S.detailLoading)return '<div class="rce-loading">Consultando las respuestas y resultados…</div>';
 if(!S.detail)return "";
 if(!S.detail.tiene_resultados)return '<section class="rce-no-results"><span>📋</span><h3>Sin resultados registrados</h3>'+
  '<p>Este estudiante todavía no tiene un examen con respuestas cargadas en '+esc(S.edition)+'. Sus datos de identificación sí pueden editarse arriba.</p></section>';
 const html=window.RoqueStudentLookupBridge?.render(S.detail)||"";
 if(!html)return '<section class="rce-no-results"><h3>Resultados aún no calculables</h3>'+
  '<p>Existe un examen, pero faltan claves válidas para mostrar sus puntajes y áreas.</p></section>';
 return '<section class="rce-report" aria-label="Resultados del estudiante en '+esc(S.edition)+'">'+html+'</section>';
}
function screen(){
 return '<div class="rce-screen">'+
  '<header class="rce-header"><span class="rce-eyebrow">CONSULTA INSTITUCIONAL</span><h2>Consultar estudiante</h2>'+
  '<p>Busca un estudiante por nombre, apellido, documento o ID de prueba. El listado aparecerá solo mientras escribes.</p></header>'+
  '<section class="rce-search-card">'+filterHtml()+
  '<div class="rce-search-area"><label for="rce-search-input">Buscar estudiante</label>'+
  '<div class="rce-search-box"><span aria-hidden="true">⌕</span>'+
  '<input id="rce-search-input" data-rce-search type="search" value="'+esc(S.query)+
  '" placeholder="Escribe nombre, apellido o identificación…" autocomplete="off" aria-controls="rce-suggestions-box" aria-autocomplete="list"></div>'+
  '<div id="rce-suggestions-box" aria-live="polite">'+suggestions()+'</div></div>'+
  '<div class="rce-edition">Edición <strong>'+esc(S.edition)+'</strong>'+
   (S.origin==="institucional"?'<small> · Registro institucional provisional</small>':'')+'</div></section>'+
  (S.loading?'<div class="rce-loading">Preparando filtros…</div>':'')+
  (!S.selected&&!S.loading?'<div class="rce-empty"><span>⌕</span><strong>Busca y selecciona un estudiante</strong>'+
   '<p>Su ficha y sus resultados aparecerán aquí, sin tablas ni listados permanentes.</p></div>':'')+
  (S.selected?profileHtml()+resultsHtml():'')+'</div>';
}
function show(){const el=root();if(el)el.innerHTML=screen();}
function feedback(message,error=false){
 S.tip=message;S.error=error?message:"";
 const el=root()?.querySelector("#rce-save-state");
 if(el)el.textContent=message;
}
async function initialize(){
 if(!S.ctx?.rpc)return;
 S.loading=true;S.error="";S.ready=false;
 const seq=++S.request;
 try{
  const result=await S.ctx.rpc("roque_v13_estudiante_buscar",{...args(),p_busqueda:""});
  if(seq!==S.request)return;
  if(!result?.ok)throw Error(result?.error||"No fue posible cargar filtros.");
  S.grades=result.filtros?.grados||[];
  S.sedes=result.filtros?.sedes||[];
  S.courses=result.filtros?.cursos||[];
  S.origin=result.origen||"";
  S.ready=true;
 }catch(err){if(seq===S.request){S.error=String(err.message||err);S.ctx.notify?.(S.error);}}
 finally{if(seq===S.request){S.loading=false;show();}}
}
async function search(){
 const query=S.query.trim();
 const seq=++S.searchSeq;
 if(query.length<2){S.matches=[];S.tip="";showSuggestions();return;}
 S.tip="Buscando…";S.error="";showSuggestions();
 try{
  const result=await S.ctx.rpc("roque_v13_estudiante_buscar",{
   ...args(),p_busqueda:query,p_grado:S.grade?Number(S.grade):null,p_sede:S.sede,p_grupo:S.course
  });
  if(seq!==S.searchSeq||query!==S.query.trim())return;
  if(!result?.ok)throw Error(result?.error||"Error al buscar.");
  S.matches=result.estudiantes||[];S.tip="";
 }catch(err){if(seq===S.searchSeq){S.matches=[];S.error=String(err?.message||err);S.tip="";}}
 if(seq===S.searchSeq)showSuggestions();
}
function showSuggestions(){const e=root()?.querySelector("#rce-suggestions-box");if(e)e.innerHTML=suggestions();}
async function choose(student){
 S.matches=[];S.query=name(student);S.selected=student;S.detail=null;S.original=null;S.draft=null;S.editing=false;
 S.detailLoading=true;S.error="";S.tip="";show();
 const seq=++S.request;
 try{
  const data=await S.ctx.rpc("roque_v13_estudiante_detalle",{
   ...args(),p_id_alumno:student.id_alumno
  });
  if(seq!==S.request)return;
  if(!data?.ok||!data.estudiante)throw Error(data?.error||"No se pudo consultar el estudiante.");
  S.detail=data;S.original={...data.estudiante};S.draft={...data.estudiante};
  S.selected=data.estudiante;
 }catch(err){if(seq===S.request){S.error=String(err?.message||err);S.ctx.notify?.(S.error);S.selected=null;}}
 finally{if(seq===S.request){S.detailLoading=false;show();}}
}
async function save(){
 if(!S.selected||!S.original||!dirty()||S.saving)return;
 const updated={...S.draft,grado:Number(S.draft.grado)};
 if(!String(updated.nombres||"").trim()||!String(updated.apellidos||"").trim()||
   !String(updated.id_prueba||"").trim()||!String(updated.id_alumno||"").trim()){
  feedback("Completa nombres, apellidos, documento e ID de prueba.",true);return;
 }
 S.saving=true;feedback("Guardando cambios…");
 const btn=root()?.querySelector("#rce-save");if(btn)btn.disabled=true;
 const seq=S.request;
 try{
  const response=await S.ctx.rpc("roque_v13_estudiante_guardar",{
   ...args(),p_id_alumno:S.original.id_alumno,p_antes:S.original,p_nuevo:updated
  });
  if(seq!==S.request)return;
  if(!response?.ok)throw Error(response?.error||"No fue posible guardar.");
  S.original={...response.estudiante};S.draft={...response.estudiante};
  S.selected=response.estudiante;S.query=name(response.estudiante);
  S.ctx.notify?.("Datos del estudiante guardados en Supabase.");
  const detail=await S.ctx.rpc("roque_v13_estudiante_detalle",{
   ...args(),p_id_alumno:response.estudiante.id_alumno
  });
  if(seq!==S.request)return;
  if(detail?.ok)S.detail=detail;
  S.tip="Cambios guardados correctamente.";S.error="";S.editing=false;
 }catch(err){S.error=String(err?.message||err);S.tip=S.error;S.ctx.notify?.(S.error);}
 finally{S.saving=false;if(seq===S.request)show();}
}
function resetFilters(){
 S.matches=[];S.query="";S.selected=null;S.original=null;S.draft=null;S.detail=null;S.editing=false;
 S.error="";S.tip="";S.searchSeq++;S.request++;
 show();
}
function render(context){
 const owner=(context?.role||"")+":"+(context?.id||"");
 const edition=context?.edition||"2026-2S";
 if(owner!==S.owner||edition!==S.edition){
  clearTimeout(S.searchTimer);S.searchSeq++;S.request++;
  Object.assign(S,{owner,edition,ctx:context,ready:false,loading:false,saving:false,detailLoading:false,
   grades:[],sedes:[],courses:[],origin:"",grade:"",sede:"",course:"",
   query:"",matches:[],selected:null,detail:null,original:null,draft:null,error:"",tip:"",editing:false});
 }
 S.ctx=context;
 if(!S.ready&&!S.loading)void initialize();
 return '<div id="roque-student-lookup" class="rce-root">'+screen()+'</div>';
}
document.addEventListener("input",event=>{
 const r=root();if(!r||!r.contains(event.target))return;
 const el=event.target;
 if(el.matches("[data-rce-search]")){
  S.query=el.value;S.error="";S.matches=[];S.tip="";
  clearTimeout(S.searchTimer);S.searchSeq++;
  if(S.query.trim().length>=2)S.searchTimer=setTimeout(()=>void search(),220);
  showSuggestions();
  return;
 }
 if(el.dataset.rceField&&S.draft){
  S.draft[el.dataset.rceField]=el.dataset.rceField==="grado"?Number(el.value):el.value;
  const b=r.querySelector("#rce-save");if(b)b.disabled=!dirty()||S.saving;
  feedback(dirty()?"Cambios pendientes de guardar.":"");
 }
});
document.addEventListener("change",event=>{
 const r=root();if(!r||!r.contains(event.target))return;
 const el=event.target;
 if(!el.dataset.rceFilter)return;
 const key=el.dataset.rceFilter;
 if(key==="grade"){S.grade=el.value;S.course="";}
 if(key==="sede"){S.sede=el.value;S.course="";}
 if(key==="course")S.course=el.value;
 resetFilters();
});
document.addEventListener("click",event=>{
 const r=root();if(!r||!r.contains(event.target))return;
 const button=event.target.closest("button");if(!button)return;
 if(button.dataset.rcePick!==undefined){const person=S.matches[Number(button.dataset.rcePick)];if(person)void choose(person);return;}
 if(button.hasAttribute("data-rce-edit-toggle")){
  if(S.saving)return;
  if(S.editing&&dirty()&&!window.confirm("Hay datos sin guardar. ¿Descartar los cambios?"))return;
  if(S.editing)S.draft={...S.original};
  S.editing=!S.editing;
  show();return;
 }
 if(button.hasAttribute("data-rce-save")){void save();return;}
 if(button.dataset.action==="student-area-open"){
  window.RoqueStudentLookupBridge?.openArea(button.dataset.subject||"");
 }
});
window.RoqueStudentLookup={render,reset:()=>{
 clearTimeout(S.searchTimer);S.request++;S.searchSeq++;
 S.owner="";S.selected=null;S.original=null;S.draft=null;S.detail=null;S.ready=false;
}};
})();