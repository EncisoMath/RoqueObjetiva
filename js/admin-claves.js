/* RoqueObjetiva v175.64 · Claves de respuestas por grado.
   Coordinador: Anular/Reactivar; Admin: edición completa de claves, con auditoría. */
(() => {
"use strict";
const S={
  owner:"",edition:"",grade:null,session:1,area:"",
  grades:[],items:[],baseline:new Map(),editable:false,allowAnnul:false,
  needReason:false,reason:"",lastEdit:null,loading:false,saving:false,error:"",
  request:0
};
let ctx=null;
const esc=x=>String(x??"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
const normal=x=>String(x??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().trim();
const rank=area=>{
 const s=normal(area);
 if(s.includes("matemat"))return 0;
 if(s.includes("lenguaje")||s.includes("castellano"))return 1;
 if(s.includes("natural"))return 2;
 if(s.includes("etica"))return 3;
 if(s.includes("artistica"))return 4;
 if(s.includes("ingles"))return 5;
 if(s.includes("social"))return 6;
 return 7;
};
const short=x=>({
 "CIENCIAS NATURALES":"Naturales","Ciencias Naturales":"Naturales",
 "CIENCIAS SOCIALES Y CIUDADANÍA":"Sociales",
 "Ciencias Sociales y Ciudadanía":"Sociales",
 "ÉTICA Y VALORES":"Ética","Ética y Valores":"Ética",
 "EDUCACIÓN FÍSICA":"Edu. Física","Educación Física":"Edu. Física",
 "MATEMÁTICAS":"Matemáticas","LENGUAJE":"Lenguaje",
 "INGLÉS":"Inglés","ARTÍSTICA":"Artística"
}[x]||x);
const icon=(name)=>({
 book:'<path d="m12 5 8 4-8 4-8-4 8-4ZM4 13l8 4 8-4M4 17l8 4 8-4"/>',
 grade:'<path d="m2 9 10-5 10 5-10 5zM6 12v5c4 3 8 3 12 0v-5"/>',
 item:'<path d="M6 3h9l4 4v14H6zM15 3v5h4M9 12h7M9 16h7"/>',
 check:'<circle cx="12" cy="12" r="9"/><path d="m7 12 3 3 7-7"/>',
 ban:'<circle cx="12" cy="12" r="9"/><path d="m6 6 12 12"/>',
 clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l4 2"/>',
 save:'<path d="M4 3h14l3 3v15H3V3h1ZM7 3v6h10V3M7 21v-8h10v8"/>'
}[name]||"");
const svg=name=>'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+icon(name)+'</svg>';
const isDirty=i=>{
 const before=S.baseline.get(i.numero_item);
 return before&&(before.correcta!==i.correcta||before.anulada!==i.anulada);
};
const changes=()=>S.items.filter(isDirty).map(i=>{
 const before=S.baseline.get(i.numero_item);
 return {numero_item:i.numero_item,correcta_antes:before.correcta,
   correcta_nueva:i.correcta,anulada_antes:before.anulada,anulada_nueva:i.anulada};
});
const valid=()=>S.items.every(i=>i.anulada||/^[A-H]$/.test(i.correcta||""));
const sessions=()=>[...new Set(S.items.map(i=>Number(i.sesion)))].sort((a,b)=>a-b);
const areas=()=>{
 const all=S.items.filter(i=>Number(i.sesion)===S.session);
 return [...new Set(all.map(i=>i.area))].sort((a,b)=>
   rank(a)-rank(b)||Math.min(...all.filter(i=>i.area===a).map(i=>i.numero_item))-
                     Math.min(...all.filter(i=>i.area===b).map(i=>i.numero_item)));
};
const rows=()=>S.items.filter(i=>Number(i.sesion)===S.session&&i.area===S.area)
 .sort((a,b)=>a.numero_en_sesion-b.numero_en_sesion);
const color=area=>{
 const n=normal(area);
 if(n.includes("matemat"))return "#0b99cc";
 if(n.includes("lenguaje"))return "#439bc4";
 if(n.includes("natural"))return "#76b13a";
 if(n.includes("etica"))return "#3d8bbb";
 if(n.includes("artistica"))return "#ad7bd1";
 if(n.includes("ingles"))return "#519cd5";
 if(n.includes("social"))return "#35a68b";
 return "#5792b5";
};
const last=()=>{
 if(!S.lastEdit)return "Sin cambios registrados";
 const date=new Date(S.lastEdit);
 if(!Number.isFinite(date.getTime()))return "Sin registro";
 return new Intl.DateTimeFormat("es-CO",{day:"2-digit",month:"short",hour:"numeric",minute:"2-digit"}).format(date);
};
const summary=()=>{
 const list=rows(),active=list.filter(x=>!x.anulada).length;
 return '<div class="rak-stats" id="rak-stats">'+
  '<div class="rak-stat"><span>'+svg("item")+'</span><strong>'+list.length+' ítems</strong></div>'+
  '<div class="rak-stat rak-green"><span>'+svg("check")+'</span><strong>'+active+' activas</strong></div>'+
  '<div class="rak-stat rak-amber"><span>'+svg("ban")+'</span><strong>'+(list.length-active)+' anuladas</strong></div>'+
  '<div class="rak-stat rak-last"><span>'+svg("clock")+'</span><strong>Última edición:<small>'+esc(last())+'</small></strong></div>'+
 '</div>';
};
const gradeControl=()=>'<section class="rak-grade"><span class="rak-field-icon">'+svg("grade")+'</span>'+
 '<label>Grado<select data-rak-grade aria-label="Seleccionar grado">'+
 S.grades.map(g=>'<option value="'+g+'"'+(Number(g)===S.grade?' selected':'')+'>'+g+'°</option>').join("")+
 '</select></label></section>';
const tabControl=()=>'<div class="rak-sessions" role="group" aria-label="Sesión del examen">'+
 sessions().map(n=>'<button type="button" class="rak-session'+(n===S.session?' is-active':'')+'" data-rak-session="'+n+'" aria-pressed="'+(n===S.session)+'">'+svg("book")+' Sesión '+n+'</button>').join("")+
 '</div><div class="rak-areas" role="group" aria-label="Asignatura">'+
 areas().map(a=>'<button type="button" class="rak-area'+(a===S.area?' is-active':'')+
 '" data-rak-area="'+esc(a)+'" style="--rak-subject:'+color(a)+'" aria-pressed="'+(a===S.area)+'" title="'+esc(a)+'">'+esc(short(a))+'</button>').join("")+
 '</div>';
const answerOptions=()=>{
 const list=rows();
 const max=Math.max(4,...list.map(i=>(i.correcta||"D").charCodeAt(0)-64));
 return Array.from({length:Math.max(4,Math.min(8,max))},(_,i)=>String.fromCharCode(65+i));
};
const answerRow=(i,idx,opts)=>{
 const readonly=!S.editable;
 const disabled=readonly||S.saving||i.anulada;
 const canAnnul=S.allowAnnul&&!S.saving;
 const annulLabel=!S.allowAnnul?(i.anulada?"Anulada":"Anular"):(i.anulada?"Reactivar":"Anular");
 const annulTip=!S.allowAnnul?"Las anulaciones solo se modifican en ediciones en borrador."
   :i.anulada?"Reactivar esta pregunta":"Anular esta pregunta";
 return '<div class="rak-item'+(i.anulada?' is-annulled':'')+(isDirty(i)?' is-dirty':'')+
 '" data-rak-item="'+i.numero_item+'">'+
 '<span class="rak-index" title="Ítem global '+i.numero_item+'">'+(idx+1)+'.</span>'+
 '<div class="rak-choices'+(opts.length>4?' has-extra':'')+'" role="group" aria-label="Opciones del ítem '+(idx+1)+'">'+
 opts.map(letter=>'<button type="button" data-rak-answer="'+letter+'" aria-label="Ítem '+(idx+1)+': '+letter+
 '" aria-pressed="'+(i.correcta===letter)+'" class="rak-choice'+(i.correcta===letter&&!i.anulada?' is-correct':'')+
 '"'+(disabled?' disabled':'')+'>'+letter+'</button>').join("")+'</div>'+
 '<button type="button" class="rak-annul'+(i.anulada?' is-on':'')+'" data-rak-toggle="'+i.numero_item+
 '" aria-label="'+(i.anulada?'Reactivar':'Anular')+' ítem '+(idx+1)+'" aria-pressed="'+i.anulada+
 '" title="'+esc(annulTip)+'"'+(canAnnul?'':' disabled')+'>'+
 '<span class="rak-annul-label">'+annulLabel+'</span>'+
 '<i class="rak-switch" aria-hidden="true"></i></button></div>';
};
const cards=()=>{
 const list=rows(),opts=answerOptions();
 const dirty=changes().length;
 return summary()+
 '<section class="rak-items-card">'+
 '<header class="rak-items-heading"><span class="rak-mini-icon">'+svg("item")+'</span>'+
 '<div><h3>'+esc(short(S.area))+' · Sesión '+S.session+'</h3>'+
 '<p>'+(S.allowAnnul?(S.editable?'Anular guarda de inmediato · las respuestas se guardan abajo.':'Puedes anular o reactivar ítems. Las respuestas están protegidas.'):(S.editable?'Corrige respuestas · anulación bloqueada en edición cerrada':'Consulta de claves · edición cerrada'))+'</p></div></header>'+
 '<div class="rak-item-list">'+list.map((i,idx)=>answerRow(i,idx,opts)).join("")+'</div>'+
 '<div class="rak-info">'+svg("check")+' Estas claves son generales para todos los cursos y sedes del grado.</div>'+
 '</section>'+
 (!S.editable?'<div class="rak-readonly">'+svg("check")+(S.allowAnnul?' Coordinación: puedes anular o reactivar ítems; solo Administración modifica respuestas correctas.':' Consulta de claves · anulación y edición bloqueadas en esta edición.')+'</div>':
 '<div class="rak-actions">'+
 (S.needReason?'<label class="rak-reason">Motivo de la corrección histórica<textarea data-rak-reason maxlength="500" rows="2" placeholder="Explica por qué se corrige la clave (mínimo 10 caracteres).">'+esc(S.reason)+'</textarea></label>'+
 '<p class="rak-caution">La edición está cerrada. Los cambios de respuesta requieren justificación y quedan auditados. Las anulaciones históricas están protegidas.</p>':'')+
 '<button type="button" class="rak-save" data-rak-save '+(!dirty||S.saving?'disabled':'')+'>'+
 svg("check")+' '+(S.saving?'Guardando…':dirty?'Guardar cambios ('+dirty+')':'Guardar cambios')+'</button>'+
 '</div>');
};
const screen=()=>{
 if(S.loading&&!S.items.length)return '<div class="rak-loading" role="status">Consultando claves del grado…</div>';
 if(S.error&&!S.items.length)return '<div class="rak-error" role="alert">'+esc(S.error)+'<button type="button" data-rak-retry>Reintentar</button></div>';
 if(!S.items.length)return '<div class="rak-empty">No hay ítems configurados para este grado.</div>';
 return gradeControl()+tabControl()+cards()+(S.error?'<p class="rak-error" role="alert">'+esc(S.error)+'</p>':'');
};
const markup=()=>'<section class="rak-screen">'+
 '<div class="rak-head"><span class="rak-eyebrow">'+(S.editable?'ADMINISTRACIÓN':'COORDINACIÓN')+'</span>'+
 '<h2>Claves de respuesta</h2><p>El examen es general por grado: la misma clave aplica a todos los cursos y sedes.</p></div>'+
 '<div id="rak-body">'+screen()+'</div></section>';
const show=()=>{
 const root=document.getElementById("roque-keys");
 if(!root)return;
 root.innerHTML=markup();
};
async function load(grade=null){
 if(!ctx?.rpc)return;
 const seq=++S.request;S.loading=true;S.error="";
 const root=document.getElementById("roque-keys");
 if(root)root.innerHTML='<div class="rak-loading" role="status">Consultando claves de '+esc(S.edition)+'…</div>';
 try{
  const result=await ctx.rpc("roque_v12_claves_consultar",{
   p_edicion:S.edition,p_grado:grade,
   p_docente:ctx.role==="teacher"?ctx.id:null,
   p_sesion:ctx.role==="teacher"?ctx.session:null
  });
  if(seq!==S.request)return;
  if(!result?.ok||!Array.isArray(result.items))throw Error(result?.error||"No se pudieron obtener las claves.");
  S.items=result.items.map(x=>({
    numero_item:Number(x.numero_item),sesion:Number(x.sesion),
    numero_en_sesion:Number(x.numero_en_sesion),area:String(x.area),
    correcta:x.correcta||null,anulada:!!x.anulada
  }));
  S.grade=Number(result.grado)||null;
  S.grades=result.grados||[];
  S.editable=ctx.role==="admin"&&result.editable===true;
  S.allowAnnul=(ctx.role==="admin"||ctx.role==="teacher")&&result.permite_anular===true;
  S.needReason=S.editable&&result.motivo_requerido===true;
  S.lastEdit=result.ultima_edicion||null;
  S.reason="";
  S.baseline=new Map(S.items.map(x=>[x.numero_item,{correcta:x.correcta,anulada:x.anulada}]));
  S.session=sessions()[0]||1;
  S.area=areas()[0]||"";
 }catch(error){
  if(seq!==S.request)return;
  S.error=String(error?.message||"No se pudieron cargar las claves.");
  S.items=[];
 }finally{if(seq===S.request){S.loading=false;show();}}
}
const hasDirty=()=>changes().length>0;
const canDiscard=()=>!hasDirty()||window.confirm("Hay claves sin guardar. ¿Quieres descartar esos cambios?");
const updateRow=(row,item)=>{
 row.classList.toggle("is-annulled",item.anulada);
 row.classList.toggle("is-dirty",Boolean(isDirty(item)));
 row.querySelectorAll("[data-rak-answer]").forEach(b=>{
   const active=b.dataset.rakAnswer===item.correcta;
   b.classList.toggle("is-correct",active&&!item.anulada);
   b.setAttribute("aria-pressed",String(active));
   b.disabled=item.anulada||S.saving||!S.editable;
 });
 const toggle=row.querySelector("[data-rak-toggle]");
 if(toggle){
   const name=!S.allowAnnul?(item.anulada?"Anulada":"Anular"):(item.anulada?"Reactivar":"Anular");
   toggle.classList.toggle("is-on",item.anulada);
   toggle.setAttribute("aria-pressed",String(item.anulada));
   toggle.setAttribute("aria-label",(item.anulada?"Reactivar":"Anular")+" ítem");
   toggle.disabled=!S.allowAnnul||S.saving;
   const label=toggle.querySelector(".rak-annul-label");
   if(label)label.textContent=row.classList.contains("is-saving")?"Guardando":name;
 }
 const stat=document.getElementById("rak-stats");
 if(stat){
  const list=rows(),active=list.filter(i=>!i.anulada).length;
  const green=stat.querySelector(".rak-green strong");
  const amber=stat.querySelector(".rak-amber strong");
  if(green)green.textContent=active+" activas";
  if(amber)amber.textContent=(list.length-active)+" anuladas";
 }
 const save=document.querySelector("#roque-keys [data-rak-save]");
 if(save){
  const n=changes().length;
  save.disabled=!n||S.saving;
  save.innerHTML=svg("check")+" "+(n?"Guardar cambios ("+n+")":"Guardar cambios");
 }
};
async function persistAnnulment(item,row){
 const before=S.baseline.get(item.numero_item);
 if(!before)return;
 if(!item.anulada&&!/^[A-H]$/.test(item.correcta||"")){
  ctx.notify?.("Selecciona una respuesta correcta para reactivar esta pregunta.");
  return;
 }
 if(!isDirty(item)){updateRow(row,item);return;}
 const edition=S.edition,grade=S.grade,activeContext=ctx;
 const annulled=item.anulada;
 const change={
  numero_item:item.numero_item,
  correcta_antes:before.correcta,correcta_nueva:item.correcta,
  anulada_antes:before.anulada,anulada_nueva:item.anulada
 };
 S.saving=true;
 row.classList.add("is-saving");
 row.setAttribute("aria-busy","true");
 updateRow(row,item);
 try{
  const coordinator=activeContext.role==="teacher";
  const result=coordinator
   ? await activeContext.rpc("roque_v12_claves_anular_coordinador",{
       p_edicion:edition,p_grado:grade,p_numero_item:item.numero_item,
       p_anulada_antes:before.anulada,
       p_docente:activeContext.id,p_sesion:activeContext.session
     })
   : await activeContext.rpc("roque_v12_claves_guardar",{
       p_edicion:edition,p_grado:grade,p_cambios:[change],p_motivo:null
     });
  if(!result?.ok||Number(result.cambios)!==1||
     (coordinator&&result.anulada!==annulled))
   throw Error(result?.error||"El servidor no confirmó la anulación.");
  if(S.edition===edition&&S.grade===grade){
   S.baseline.set(item.numero_item,{correcta:item.correcta,anulada:item.anulada});
   S.lastEdit=new Date().toISOString();
   S.error="";
  }
  activeContext.notify?.("Ítem "+item.numero_item+(annulled?" anulado":" reactivado")+" y guardado.");
 }catch(error){
  if(S.edition===edition&&S.grade===grade){
   item.correcta=before.correcta;
   item.anulada=before.anulada;
   S.error=String(error?.message||"Falló la operación.");
  }
  activeContext.notify?.("No se pudo guardar el cambio: "+String(error?.message||error));
 }finally{
  S.saving=false;
  if(row.isConnected){
   row.classList.remove("is-saving");
   row.removeAttribute("aria-busy");
   updateRow(row,item);
   const date=document.querySelector("#roque-keys .rak-last small");
   if(date)date.textContent=last();
  }
 }
}
const render=context=>{
 const owner=(context?.role||"")+":"+(context?.id||"");
 const edition=context?.edition||"2026-2S";
 if(S.owner!==owner||S.edition!==edition){
   S.owner=owner;S.edition=edition;S.grade=null;S.session=1;S.area="";
   S.items=[];S.baseline=new Map();S.grades=[];
   S.editable=context?.role==="admin";S.allowAnnul=false;S.needReason=false;
   S.reason="";S.lastEdit=null;S.error="";S.loading=false;S.request++;
 }
 ctx=context;
 if(!S.items.length&&!S.loading&&!S.error)void load(S.grade);
 return '<div id="roque-keys" class="rak-root">'+markup()+'</div>';
};
document.addEventListener("change",event=>{
 const root=document.getElementById("roque-keys");
 if(!root||!root.contains(event.target))return;
 const el=event.target;
 if(el.matches("[data-rak-grade]")){
   if(!canDiscard()){el.value=String(S.grade);return;}
   void load(Number(el.value));
 }
});
document.addEventListener("input",event=>{
 if(!document.getElementById("roque-keys"))return;
 if(event.target.matches("[data-rak-reason]"))S.reason=event.target.value;
});
document.addEventListener("click",async event=>{
 const root=document.getElementById("roque-keys");
 if(!root||!root.contains(event.target))return;
 const button=event.target.closest("button");if(!button)return;
 if(button.hasAttribute("data-rak-retry")){void load(S.grade);return;}
 if(button.dataset.rakSession!==undefined){
   const next=Number(button.dataset.rakSession);
   if(next===S.session)return;
   S.session=next;S.area=areas()[0]||"";show();return;
 }
 if(button.dataset.rakArea!==undefined){
   if(S.area===button.dataset.rakArea)return;
   S.area=button.dataset.rakArea;show();return;
 }
 if(button.dataset.rakToggle!==undefined){
   if(!S.allowAnnul||S.saving)return;
   const row=button.closest(".rak-item");
   const item=S.items.find(i=>i.numero_item===Number(button.dataset.rakToggle));
   if(!item||!row)return;
   if(ctx.role==="teacher"&&item.anulada&&!item.correcta){
     ctx.notify?.("Para reactivar este ítem, Administración debe asignar primero una respuesta correcta.");
     return;
   }
   item.anulada=!item.anulada;
   updateRow(row,item);
   if(!isDirty(item))return;
   await persistAnnulment(item,row);
   return;
 }
 if(button.dataset.rakAnswer!==undefined){
   if(!S.editable||S.saving)return;
   const row=button.closest(".rak-item");
   const item=S.items.find(i=>i.numero_item===Number(row?.dataset.rakItem));
   if(!item||item.anulada)return;
   item.correcta=button.dataset.rakAnswer;
   updateRow(row,item);
   // Reactivar una pregunta sin clave exige escoger opción antes de guardar.
   if(S.baseline.get(item.numero_item)?.anulada===true&&!item.anulada)
    await persistAnnulment(item,row);
   return;
 }
 if(!button.hasAttribute("data-rak-save")||!S.editable||S.saving)return;
 const changed=changes();
 if(!changed.length)return;
 if(changed.length>100){ctx.notify?.("Guarda menos de 100 ítems por operación.");return;}
 if(!valid()){ctx.notify?.("Los ítems activos deben tener una respuesta correcta.");return;}
 if(S.needReason&&S.reason.trim().length<10){
   root.querySelector("[data-rak-reason]")?.focus();
   ctx.notify?.("Escribe un motivo de al menos 10 caracteres.");return;
 }
 S.saving=true;button.disabled=true;button.innerHTML=svg("clock")+" Guardando…";
 try{
  const result=await ctx.rpc("roque_v12_claves_guardar",{
   p_edicion:S.edition,p_grado:S.grade,p_cambios:changed,
   p_motivo:S.needReason?S.reason.trim():null
  });
  if(!result?.ok)throw Error(result?.error||"No fue posible guardar.");
  // El servidor confirmó el lote. Actualizar el estado local sin reconstruir
  // el panel ni volver a Sesión 1: preserva asignatura, desplazamiento y dock.
  changed.forEach(change=>{
    S.baseline.set(change.numero_item,{
      correcta:change.correcta_nueva,anulada:change.anulada_nueva
    });
  });
  S.reason="";
  S.lastEdit=new Date().toISOString();
  S.error="";
  ctx.notify?.(result.cambios+" claves actualizadas.");
 }catch(error){
  // Conservar selecciones en pantalla para corregir y reintentar.
  S.error=String(error?.message||"Falló el guardado.");
  ctx.notify?.(S.error);
 }finally{
  S.saving=false;
  show();
 }
});
window.RoqueKeys={render,reset:()=>{
 S.request++;S.owner="";S.items=[];S.baseline=new Map();S.loading=false;S.saving=false;S.error="";
}};
})();