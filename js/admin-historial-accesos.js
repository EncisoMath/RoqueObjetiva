/* RoqueObjetiva v175.101 · Historial de accesos: exclusivo de Administrador. */
(()=>{"use strict";
const S={owner:"",tab:"profesores",search:"",site:"",role:"",grade:"",course:"",date:"",status:"",page:1,size:20,
 items:[],total:0,metrics:{},loading:false,error:"",seq:0,started:false,timer:null,
 detail:null,detailKey:"",detailPage:1,detailLoading:false,detailError:"",confirm:null,saving:false};
let api=null;
const e=x=>String(x??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const nf=x=>Number(x||0).toLocaleString("es-CO");
const dt=x=>{if(!x)return "Nunca";try{return new Intl.DateTimeFormat("es-CO",{timeZone:"America/Bogota",day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"}).format(new Date(x));}catch(_){return "—";}};
const shapes={
 person:'<circle cx="12" cy="7" r="4"/><path d="M5 21v-3a7 7 0 0 1 14 0v3"/>',
 people:'<circle cx="9" cy="8" r="3"/><path d="M2 20v-2c0-3 3-5 7-5s7 2 7 5v2M17 6a3 3 0 0 1 0 6M18 14c3 0 4 2 4 5v1"/>',
 screen:'<rect x="3" y="4" width="18" height="14" rx="1"/><path d="M8 22h8M12 18v4"/>',
 clock:'<circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/>',
 search:'<circle cx="11" cy="11" r="7"/><path d="m16 16 5 5"/>',
 shield:'<path d="m12 2 9 4v6c0 5-4 9-9 10-5-1-9-5-9-10V6z"/>',
 warning:'<path d="m12 2 10 18H2z"/><path d="M12 8v5m0 4v.2"/>',
 refresh:'<path d="M20 7V3h-4M4 17v4h4M20 3a9 9 0 0 0-15 4M4 21a9 9 0 0 0 15-4"/>',
 x:'<path d="M5 5l14 14M19 5 5 19"/>'
};
const icon=(t,n=20)=>'<svg width="'+n+'" height="'+n+'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linejoin="round" stroke-linecap="round" aria-hidden="true">'+(shapes[t]||shapes.screen)+'</svg>';
const root=()=>document.getElementById("roque-audit");
const opt=(v,t,sel)=>'<option value="'+e(v)+'"'+(String(v)===String(sel)?" selected":"")+'>'+e(t)+'</option>';
const labelSite=v=>v==="San Sebastián"?"San Sebastián del Bongo":v;
const roles=[["docente","Docente"],["coordinador","Coordinador"],["administrador","Administrador"]];
const sites=["Municipal","San Sebastián","Gral Garzón AM","Gral Garzón PM","Las Flores","Punto Fijo","Zacapa"];
const states=t=>t==="profesores"?[["reciente","Acceso reciente"],["registrado","Con actividad"],["nunca","Sin actividad"],["alerta","Alerta"]]:
 t==="estudiantes"?[["consultado","Consultó"],["nunca","Sin consultar"],["reciente","Reciente"],["alerta","Alerta"]]:
 [["activo","Activo"],["sospechoso","Revisar"],["bloqueado","Bloqueado"]];
function filters(){
 const date='<label>Fecha<input type="date" data-ah-filter="date" value="'+e(S.date)+'"></label>';
 const state='<label>Estado<select data-ah-filter="status">'+opt("","Todos",S.status)+states(S.tab).map(x=>opt(x[0],x[1],S.status)).join("")+'</select></label>';
 if(S.tab==="dispositivos")return '<div class="ah-filters ah-short">'+date+state+'</div>';
 const site='<label>Sede<select data-ah-filter="site">'+opt("","Todas",S.site)+sites.map(x=>opt(x,labelSite(x),S.site)).join("")+'</select></label>';
 if(S.tab==="profesores")return '<div class="ah-filters">'+site+
 '<label>Rol<select data-ah-filter="role">'+opt("","Todos",S.role)+roles.map(x=>opt(x[0],x[1],S.role)).join("")+'</select></label>'+date+state+'</div>';
 return '<div class="ah-filters">'+site+
 '<label>Grado<select data-ah-filter="grade">'+opt("","Todos",S.grade)+[5,6,7,8,9,10,11].map(x=>opt(x,x+"°",S.grade)).join("")+'</select></label>'+
 '<label>Curso<input type="text" data-ah-filter="course" placeholder="Ej. 1PPAL" value="'+e(S.course)+'"></label>'+
 date+state+'</div>';
}
function kpis(){
 const m=S.metrics,values=S.tab==="dispositivos"?
 [["screen","Dispositivos únicos",nf(m.dispositivos||0)],["refresh","Conexiones",nf(m.accesos||0)],["shield","Bloqueados",nf(m.bloqueados||0)]]:
 S.tab==="profesores"?
 [["screen","Conexiones hoy",nf(m.accesos_docentes_hoy||0)],["people","Docentes conectados",nf(m.docentes_conectados||0)],["warning","Alertas recientes",nf(m.alertas||0)]]:
 [["people","Consultaron hoy",nf(m.estudiantes_hoy||0)],["clock","Sin consultar",nf(m.estudiantes_sin_consultar||0)],["clock","Último acceso",dt(m.ultimo_estudiante)]];
 return '<div class="ah-kpis">'+values.map((v,i)=>'<article class="ah-kpi'+(i===2&&S.tab!=="estudiantes"?' ah-kpi-alert':'')+(i===2&&S.tab==="estudiantes"?' ah-kpi-time':'')+'">'+icon(v[0],24)+'<strong>'+e(v[2])+'</strong><span>'+e(v[1])+'</span></article>').join("")+'</div>';
}
const statusText=v=>({bloqueado:"Bloqueado",sospechoso:"Actividad por revisar",activo:"Activo",nunca:"Sin consultar",consultado:"Consultado",reciente:"Reciente",alerta:"Alerta",registrado:"Registrado"}[v]||v||"Sin actividad");
const badge=v=>'<span class="ah-badge ah-'+e(v||"nunca")+'">'+e(statusText(v))+'</span>';
function person(x){
 const teacher=S.tab==="profesores",detail=teacher?
 [x.sede,x.marca,x.modelo,x.sistema,x.navegador].filter(Boolean).map(labelSite).join(" · "):
 [x.grado?x.grado+"°":"",x.curso,x.sede].filter(Boolean).map(labelSite).join(" · ");
 return '<article class="ah-person"><span class="ah-avatar">'+icon(teacher?"person":"people",23)+'</span>'+
 '<div class="ah-person-info"><div class="ah-person-name"><strong>'+e(x.nombre||x.clave)+'</strong>'+
 '<span class="ah-role">'+e(teacher?x.rol||"docente":"Estudiante")+'</span></div>'+
 '<small>'+e(detail)+'</small>'+(teacher?"":'<small>ID de prueba: '+e(x.clave)+'</small>')+'<p>Último acceso: '+e(dt(x.ultimo))+'</p>'+
 '<p>Conexiones: '+nf(x.accesos)+' · Dispositivos: '+nf(x.dispositivos)+
 (Number(x.fallidos)>0?' · Fallos: '+nf(x.fallidos):"")+'</p>'+badge(x.estado)+'</div>'+
 '<button type="button" class="ah-primary" data-ah-detail="'+e(x.clave)+'">Ver historial</button></article>';
}
function device(x){
 const name=[x.marca,x.modelo].filter(Boolean).join(" · ")||"Modelo desconocido";
 const state=x.bloqueado?"bloqueado":x.estado||"activo";
 return '<article class="ah-device"><div class="ah-device-title"><span class="ah-avatar">'+icon("screen",23)+'</span>'+
 '<div><strong>'+e(name)+'</strong><small>'+e([x.sistema,x.version_so,x.navegador,x.version_navegador].filter(Boolean).join(" · "))+
 '</small><small>Modelo '+e(x.modelo_origen||"desconocido")+'</small></div>'+badge(state)+'</div>'+
 '<div class="ah-device-stats"><span>Conexiones<strong>'+nf(x.accesos)+'</strong></span>'+
 '<span>Usuarios<strong>'+nf(x.usuarios)+'</strong></span><span>Última conexión<strong>'+e(dt(x.ultimo))+'</strong></span></div>'+
 '<div class="ah-device-info">Primera conexión: '+e(dt(x.primero))+'<br>Identificador del navegador: <code>'+e(x.clave)+'</code></div>'+
 '<div class="ah-device-buttons"><button class="ah-outline" data-ah-detail="'+e(x.clave)+'">Ver usuarios e historial</button>'+
 '<button class="ah-danger" data-ah-block="'+e(x.clave)+'" data-ah-wasblocked="'+(x.bloqueado?"1":"0")+'">'+
 (x.bloqueado?"Desbloquear":"Bloquear")+'</button></div></article>';
}
function pages(){
 const last=Math.ceil(S.total/S.size);if(last<2)return "";
 const list=[...new Set([1,last,S.page-1,S.page,S.page+1])].filter(x=>x>=1&&x<=last).sort((a,b)=>a-b);
 let previous=0,s="";
 for(const x of list){if(x-previous>1)s+='<span>…</span>';previous=x;s+='<button data-ah-page="'+x+'"'+(x===S.page?' class="active" aria-current="page"':'')+'>'+x+'</button>';}
 return '<nav class="ah-pages" aria-label="Páginas">'+
 '<button data-ah-page="'+(S.page-1)+'"'+(S.page<=1?" disabled":"")+'>‹</button>'+s+
 '<button data-ah-page="'+(S.page+1)+'"'+(S.page>=last?" disabled":"")+'>›</button></nav>';
}
function rows(){
 if(S.error)return '<div class="ah-empty ah-error" role="alert">'+e(S.error)+'<button data-ah-retry>Reintentar</button></div>';
 if(S.loading)return '<div class="ah-empty" role="status">Consultando accesos en Supabase…</div>';
 if(!S.items.length)return '<div class="ah-empty">No hay registros para los filtros seleccionados. Los accesos nuevos aparecerán desde ahora.</div>';
 return '<div class="ah-list">'+S.items.map(S.tab==="dispositivos"?device:person).join("")+'</div>'+
 '<footer class="ah-footer">Mostrando '+nf((S.page-1)*S.size+1)+'–'+nf(Math.min(S.page*S.size,S.total))+
 ' de '+nf(S.total)+' registros'+pages()+'</footer>';
}
function eventName(value){
 return ({
   login_manual:"Inicio de sesión manual",
   bloqueado_manual:"Intento manual bloqueado",
   login:"Acceso anterior (origen no identificado)",
   bloqueado:"Intento bloqueado anterior"
 })[value]||value||"Acceso";
}
function events(){
 if(!S.detail)return "";
 const events=(S.detail.filas||[]).map(x=>'<article class="ah-event"><div><strong>'+e(dt(x.fecha_hora))+'</strong>'+
 badge(x.exitoso?"activo":"bloqueado")+'</div><small>'+e([eventName(x.evento),x.rol,x.id_prueba||x.id_docente||x.usuario].filter(Boolean).join(" · "))+'</small>'+
 '<small>'+e([x.modelo,x.sistema,x.version_so,x.navegador,x.version_navegador].filter(Boolean).join(" · "))+'</small></article>').join("");
 const users=(S.detail.usuarios||[]).map(x=>'<div class="ah-related"><strong>'+e(x.nombre||x.clave||"Sin identificar")+'</strong>'+
 '<small>'+e(x.rol||"")+" · "+nf(x.accesos)+' accesos · '+e(dt(x.ultimo))+'</small></div>').join("");
 const last=Math.ceil(Number(S.detail.total||0)/20);
 return '<div class="ah-detail-body">'+
 (S.detail.tipo==="dispositivos"?'<h4>Usuarios vinculados a este navegador</h4>'+(users||'<p>Sin usuarios registrados.</p>'):'')+
 '<h4>Eventos cronológicos</h4>'+(events||'<p>Este perfil todavía no tiene conexiones registradas.</p>')+
 (last>1?'<div class="ah-detail-pages"><button data-ah-detailpage="'+(S.detailPage-1)+'"'+(S.detailPage<=1?" disabled":"")+'>Anterior</button>'+
 '<span>Página '+S.detailPage+' de '+last+'</span><button data-ah-detailpage="'+(S.detailPage+1)+'"'+(S.detailPage>=last?" disabled":"")+'>Siguiente</button></div>':"")+'</div>';
}
function modal(){
 if(!S.detail&&!S.confirm)return "";
 if(S.confirm)return '<div class="ah-overlay" data-ah-overlay><section class="ah-dialog" role="dialog" aria-modal="true" aria-labelledby="ah-modal-title">'+
 '<header><h3 id="ah-modal-title">'+(S.confirm.blocked?"Desbloquear navegador":"Bloquear navegador")+'</h3><button data-ah-close aria-label="Cerrar">'+icon("x",22)+'</button></header>'+
 '<div class="ah-dialog-text"><p>Identificador: <code>'+e(S.confirm.id)+'</code></p><p>Bloquear impedirá nuevas sesiones desde esta instalación. Varios usuarios pueden compartir el mismo equipo legítimamente.</p></div>'+
 '<form id="ah-block-form"><label>Motivo obligatorio<textarea name="reason" rows="3" minlength="5" maxlength="500" required placeholder="Escribe el motivo (mínimo 5 caracteres)"></textarea></label>'+
 (S.detailError?'<p class="ah-error">'+e(S.detailError)+'</p>':"")+
 '<footer><button type="button" class="ah-outline" data-ah-close>Cancelar</button><button class="ah-danger" type="submit"'+(S.saving?" disabled":"")+'>'+
 (S.saving?"Guardando…":S.confirm.blocked?"Confirmar desbloqueo":"Confirmar bloqueo")+'</button></footer></form></section></div>';
 return '<div class="ah-overlay" data-ah-overlay><section class="ah-dialog ah-history" role="dialog" aria-modal="true" aria-labelledby="ah-modal-title">'+
 '<header><h3 id="ah-modal-title">Historial de '+(S.tab==="dispositivos"?"dispositivo":S.tab==="profesores"?"profesor":"estudiante")+'</h3>'+
 '<button data-ah-close aria-label="Cerrar">'+icon("x",22)+'</button></header>'+
 (S.detailLoading?'<div class="ah-empty">Cargando historial…</div>':S.detailError?'<div class="ah-empty ah-error">'+e(S.detailError)+'</div>':events())+
 '</section></div>';
}
function htmlView(){
 const hero=window.RoqueScreenHero?.render({title:"Historial de accesos",subtitle:"Consulta conexiones, dispositivos y actividad.",icon:"shield",heading:"h2"})||
 '<h2>Historial de accesos</h2>';
 const tabs=[["profesores","Profesores","person"],["estudiantes","Estudiantes","people"],["dispositivos","Dispositivos","screen"]];
 return '<div class="ah-root" id="roque-audit">'+hero+
 '<nav class="ah-tabs" aria-label="Historial por categoría">'+tabs.map(x=>
 '<button data-ah-tab="'+x[0]+'" class="'+(S.tab===x[0]?"active":"")+'" aria-selected="'+(S.tab===x[0])+'">'+icon(x[2],20)+'<span>'+x[1]+'</span></button>').join("")+'</nav>'+
 '<section class="ah-controls"><label class="ah-search">'+icon("search",19)+
 '<input type="search" data-ah-search autocomplete="off" placeholder="'+
 (S.tab==="profesores"?"Buscar nombre o documento":S.tab==="estudiantes"?"Buscar estudiante o ID de prueba":"Buscar dispositivo o identificador")+
 '" value="'+e(S.search)+'"></label><div id="ah-filter">'+filters()+'</div></section>'+
 '<div id="ah-metrics">'+kpis()+'</div>'+
 '<section class="ah-section"><header class="ah-section-head">'+icon(S.tab==="dispositivos"?"screen":"people",22)+
 '<h3>'+({profesores:"Registros de profesores",estudiantes:"Actividad de estudiantes",dispositivos:"Dispositivos registrados"}[S.tab])+'</h3><span>'+nf(S.total)+' registros</span></header>'+
 '<div id="ah-rows">'+rows()+'</div></section><div id="ah-modal">'+modal()+'</div></div>';
}
function update(){const r=root();if(!r)return;
 for(const [id,value] of [["ah-filter",filters()],["ah-metrics",kpis()],["ah-rows",rows()],["ah-modal",modal()]]){const el=r.querySelector("#"+id);if(el)el.innerHTML=value;}
 const c=r.querySelector(".ah-section-head>span");if(c)c.textContent=nf(S.total)+" registros";}
function resetTab(tab){if(S.timer)clearTimeout(S.timer);S.tab=tab;S.search="";S.site="";S.role="";S.grade="";S.course="";S.date="";S.status="";
 S.page=1;S.items=[];S.total=0;S.metrics={};S.error="";S.detail=null;S.confirm=null;S.started=false;}
async function load(){if(!api?.rpc)return;const seq=++S.seq;S.loading=true;S.error="";update();
 try{const data=await api.rpc("roque_v21_historial_listar",{
 p_tipo:S.tab,p_busqueda:S.search.trim()||null,p_sede:S.site||null,p_rol:S.role||null,
 p_grado:S.grade?Number(S.grade):null,p_curso:S.course||null,p_fecha:S.date||null,
 p_estado:S.status||null,p_pagina:S.page,p_limite:S.size,
 p_docente:api.role==="teacher"?api.id:null,p_sesion:api.role==="teacher"?api.session:null
 });if(seq!==S.seq)return;if(!data?.ok)throw Error(data?.error||"Respuesta inválida.");
 S.items=Array.isArray(data.filas)?data.filas:[];S.total=Number(data.total)||0;S.metrics=data.metricas||{};
 }catch(err){if(seq!==S.seq)return;S.error=String(err?.message||"No fue posible consultar Supabase.");}
 finally{if(seq===S.seq){S.loading=false;update();}}}
async function getDetail(key,page=1){if(!api?.rpc)return;const kind=S.tab;S.detailKey=key;S.detailPage=page;S.detailLoading=true;S.detailError="";
 S.detail={tipo:kind,filas:[],usuarios:[],total:0};update();
 try{const d=await api.rpc("roque_v21_historial_detalle",{
 p_tipo:kind,p_clave:key,p_pagina:page,p_limite:20,
 p_docente:api.role==="teacher"?api.id:null,p_sesion:api.role==="teacher"?api.session:null
 });if(!d?.ok)throw Error(d?.error||"No fue posible cargar el historial.");S.detail={...d,tipo:kind};}
 catch(err){S.detailError=String(err?.message||"Error de consulta.");}
 finally{S.detailLoading=false;update();}}
async function setBlock(reason){if(S.saving||!S.confirm)return;S.saving=true;S.detailError="";const desired=!S.confirm.blocked;update();
 try{const d=await api.rpc("roque_v21_historial_bloquear",{
 p_terminal:S.confirm.id,p_bloqueado:desired,p_motivo:reason,
 p_docente:api.role==="teacher"?api.id:null,p_sesion:api.role==="teacher"?api.session:null
 });if(!d?.ok)throw Error(d?.error||"No se pudo aplicar el cambio.");S.confirm=null;
 api.notify?.("Estado del dispositivo actualizado.");await load();
 }catch(err){S.detailError=String(err?.message||"Error al guardar.");}
 finally{S.saving=false;update();}}
function render(ctx){if(!ctx||!["admin","teacher"].includes(ctx.role))return '<p class="ah-empty">Solo Administración.</p>';
 const owner=ctx.role+":"+ctx.id;
 if(owner!==S.owner){S.owner=owner;S.seq++;resetTab("profesores");}
 api=ctx;if(!S.started){S.started=true;void load();}
 return htmlView();}
document.addEventListener("click",ev=>{const r=root();if(!r?.contains(ev.target))return;
 const tab=ev.target.closest("[data-ah-tab]");
 if(tab){resetTab(tab.dataset.ahTab);r.outerHTML=htmlView();S.started=true;void load();return;}
 const p=ev.target.closest("[data-ah-page]");
 if(p){const target=Number(p.dataset.ahPage),max=Math.ceil(S.total/S.size);
 if(target>0&&target<=max&&target!==S.page){S.page=target;void load();}return;}
 const d=ev.target.closest("[data-ah-detail]");
 if(d){void getDetail(d.dataset.ahDetail);return;}
 const b=ev.target.closest("[data-ah-block]");
 if(b){S.confirm={id:b.dataset.ahBlock,blocked:b.dataset.ahWasblocked==="1"};S.detailError="";update();return;}
 const dp=ev.target.closest("[data-ah-detailpage]");
 if(dp){const target=Number(dp.dataset.ahDetailpage),max=Math.ceil(Number(S.detail?.total||0)/20);
 if(target>0&&target<=max)void getDetail(S.detailKey,target);return;}
 if(ev.target.closest("[data-ah-close]")||ev.target.matches("[data-ah-overlay]")){S.confirm=null;S.detail=null;S.detailError="";update();return;}
 if(ev.target.closest("[data-ah-retry]"))void load();
});
document.addEventListener("change",ev=>{const el=ev.target.closest("[data-ah-filter]");if(!root()?.contains(el))return;
 const k=el.dataset.ahFilter;if(k==="site")S.site=el.value;
 if(k==="role")S.role=el.value;if(k==="grade")S.grade=el.value;
 if(k==="course")S.course=el.value;if(k==="date")S.date=el.value;if(k==="status")S.status=el.value;
 S.page=1;void load();});
document.addEventListener("input",ev=>{const el=ev.target.closest("[data-ah-search]");if(!root()?.contains(el))return;
 S.search=el.value;S.page=1;if(S.timer)clearTimeout(S.timer);
 S.timer=setTimeout(()=>{S.timer=null;void load();},330);});
document.addEventListener("submit",ev=>{if(ev.target?.id!=="ah-block-form"||!root()?.contains(ev.target))return;
 ev.preventDefault();const reason=String(ev.target.elements.reason?.value||"").trim();
 if(reason.length<5){S.detailError="Escribe un motivo de al menos 5 caracteres.";update();return;}
 void setBlock(reason);});
window.RoqueAccessAudit=Object.freeze({render,reset:()=>{S.seq++;S.owner="";S.started=false;S.detail=null;S.confirm=null;}});
})();