/* RoqueObjetiva v175.100 · Medallas con cintas detrás del círculo */
(()=>{"use strict";
const S={owner:"",edition:"",site:"",grade:"",course:"",search:"",page:1,limit:15,request:0,busy:false,error:"",data:null,options:{sedes:[],grados:[],cursos:[]},timer:null};
let api=null;
const esc=v=>String(v??"").replace(/[&<>"']/g,x=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[x]));
const fmt=v=>Number(v).toLocaleString("es-CO"),number=v=>v==null?"—":fmt(v),average=v=>v==null?"—":Number(v).toLocaleString("es-CO",{minimumFractionDigits:1,maximumFractionDigits:1});
const shapes={people:'<circle cx="9" cy="8" r="3"/><path d="M2 20v-2c0-3 3-5 7-5s7 2 7 5v2M17 6a3 3 0 0 0 0 6M18 14c3 0 4 2 4 5v1"/>',chart:'<path d="M4 20v-6h4v6M10 20V9h4v11M16 20V4h4v16"/>',star:'<path d="m12 2 3.1 6.5 7.2 1-5.2 5.1 1.2 7.3-6.3-3.4-6.3 3.4 1.2-7.3L1.7 9.5l7.2-1Z"/>',list:'<path d="M9 5h12M9 12h12M9 19h12M3 5h2M3 12h2M3 19h2"/>',search:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>'};
const icon=(id,size=24)=>'<svg width="'+size+'" height="'+size+'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+(shapes[id]||shapes.list)+'</svg>';
const root=()=>document.getElementById("roque-ranking");
const option=(v,text,sel)=>'<option value="'+esc(v)+'"'+(String(v)===String(sel)?" selected":"")+'>'+esc(text)+'</option>';
const siteName=s=>s==="San Sebastián"?"San Sebastián del Bongo":s;
function choice(){try{const x=JSON.parse(S.course);return Array.isArray(x)&&x.length===3?{grado:Number(x[0]),sede:x[1],curso:x[2]}:null;}catch(_){return null;}}
function courseOptions(){const found=new Map();
 (S.options.cursos||[]).forEach(c=>{const g=Number(c.grado),site=String(c.sede||""),course=String(c.curso||"");
 if(!g||!course||(S.grade&&String(g)!==S.grade)||(S.site&&site!==S.site))return;
 const key=JSON.stringify([g,site,course]),s=course.match(/^\d+/)?.[0];
 found.set(key,g+"°-"+(s||course)+(S.site&&S.grade?"":" · "+siteName(site)));});
 return [...found].sort((a,b)=>a[1].localeCompare(b[1],"es",{numeric:true}));}
function filters(){return '<div class="rir-filters">'+
 '<label>Sede<select data-rir-filter="site">'+option("","Todas",S.site)+(S.options.sedes||[]).map(v=>option(v,siteName(v),S.site)).join("")+'</select></label>'+
 '<label>Grado<select data-rir-filter="grade">'+option("","Todos",S.grade)+(S.options.grados||[]).map(v=>option(v,v+"°",S.grade)).join("")+'</select></label>'+
 '<label>Curso<select data-rir-filter="course">'+option("","Todos",S.course)+courseOptions().map(v=>option(v[0],v[1],S.course)).join("")+'</select></label></div>';}
function kpis(){const d=S.data||{};return [
 ['people','Estudiantes',d.total_estudiantes===undefined?"—":fmt(d.total_estudiantes)],
 ['chart','Promedio global',average(d.promedio_global)],
 ['star','Puntaje más alto',number(d.puntaje_maximo)]
 ].map(v=>'<article class="rir-kpi"><span class="rir-kpi-icon">'+icon(v[0],29)+'</span><div><span class="rir-kpi-label">'+esc(v[1])+'</span><strong class="rir-kpi-number">'+esc(v[2])+'</strong></div></article>').join("");}
function row(item){const n=Number(item.posicion)||0,first=n>=1&&n<=3;
 const marker=first?'<span class="rir-medal rir-medal-'+n+'" aria-label="Puesto '+n+'"><span class="rir-medal-face">'+n+'</span></span>':'<span class="rir-place">'+esc(n)+'</span>';
 const subtitle=Number(item.grado)+"°-"+String(item.curso||"")+(S.site?"":" · "+siteName(String(item.sede||"")));
 return '<div class="rir-row'+(first?' rir-top rir-top-'+n:'')+'" role="row">'+
 '<span class="rir-cell-pos" role="cell">'+marker+'</span>'+
 '<span class="rir-cell-student" role="cell"><span>'+esc(item.nombre||"Sin nombre")+'</span><small>'+esc(subtitle)+'</small></span>'+
 '<span class="rir-cell-score" role="cell"><span>'+esc(number(item.puntaje_global))+'</span></span></div>';}
function pagination(total){
 if(total<=1)return "";
 const p=S.page;let numbers=new Set([1,total,p-1,p,p+1]);if(p<4){numbers.add(2);numbers.add(3);}if(p>total-3){numbers.add(total-1);numbers.add(total-2);}
 let prev=0,html="";
 for(const n of [...numbers].filter(v=>v>=1&&v<=total).sort((a,b)=>a-b)){if(n>prev+1)html+='<span class="rir-ellipsis">…</span>';prev=n;
 html+='<button type="button" data-rir-page="'+n+'" class="rir-page'+(n===p?' active':'')+'"'+(n===p?' aria-current="page"':'')+'>'+n+'</button>';}
 return '<nav class="rir-pagination" aria-label="Páginas del ranking"><button type="button" data-rir-page="'+(p-1)+'" class="rir-page rir-arrow" aria-label="Anterior"'+(p<=1?' disabled':'')+'>‹</button>'+html+
 '<button type="button" data-rir-page="'+(p+1)+'" class="rir-page rir-arrow" aria-label="Siguiente"'+(p>=total?' disabled':'')+'>›</button></nav>';}
function content(){if(S.error)return '<div class="rir-empty rir-error" role="alert">'+esc(S.error)+'<button data-rir-retry type="button">Reintentar</button></div>';
 if(S.busy||!S.data)return '<div class="rir-empty" role="status">Consultando resultados en Supabase…</div>';
 const d=S.data,rows=Array.isArray(d.filas)?d.filas:[],matched=Number(d.total_coincidencias)||0;
 if(!Number(d.total_estudiantes))return '<div class="rir-empty">Todavía no hay resultados con puntaje global para este grupo.</div>';
 if(!rows.length)return '<div class="rir-empty">No se encontraron estudiantes con esta búsqueda.</div>';
 const from=(S.page-1)*S.limit+1,to=Math.min(S.page*S.limit,matched);
 return '<div class="rir-list" role="table" aria-label="Ranking de estudiantes">'+
 '<div class="rir-list-head" role="row"><span>Pos.</span><span>Estudiante</span><span>Puntaje global /500</span></div>'+rows.map(row).join("")+'</div>'+
 '<footer class="rir-footer"><span>Mostrando '+fmt(from)+'–'+fmt(to)+' de '+fmt(matched)+(S.search.trim()?" coincidencias":" estudiantes")+'</span>'+
 pagination(Number(d.total_paginas)||0)+'</footer>'+
 (S.search.trim()?'<p class="rir-hint">La búsqueda conserva la posición obtenida en el grupo filtrado.</p>':"");}
function view(){
 const hero=window.RoqueScreenHero?.render({title:"Ranking institucional",subtitle:"Consulta posiciones por sede, grado y curso.",icon:"trophy",heading:"h2",colors:{iconBackground:"#FFFFFF"}})||'<h2>Ranking institucional</h2>';
 return '<div class="rir-root" id="roque-ranking">'+hero+
 '<section id="rir-filters" class="rir-filter-card" aria-label="Filtros del ranking">'+filters()+'</section>'+
 '<section id="rir-kpis" class="rir-kpis" aria-label="Indicadores del ranking">'+kpis()+'</section>'+
 '<section class="rir-panel"><header class="rir-panel-head">'+icon("list",28)+'<h3>Ranking de estudiantes</h3></header>'+
 '<label class="rir-search">'+icon("search",21)+'<input type="search" data-rir-search autocomplete="off" placeholder="Buscar estudiante o ID de prueba" aria-label="Buscar por nombre o ID de prueba" value="'+esc(S.search)+'"></label>'+
 '<div id="rir-content" aria-live="polite">'+content()+'</div></section></div>';
}
function update(){const r=root();if(!r)return;const f=r.querySelector("#rir-filters"),k=r.querySelector("#rir-kpis"),c=r.querySelector("#rir-content");
 if(f)f.innerHTML=filters();if(k)k.innerHTML=kpis();if(c)c.innerHTML=content();}
async function load(){if(!api?.rpc)return;const req=++S.request,course=choice();
 S.busy=true;S.error="";S.data=null;update();
 try{const d=await api.rpc("roque_v20_ranking_institucional",{
  p_edicion:S.edition,p_sede:S.site||course?.sede||null,p_grado:S.grade?Number(S.grade):course?.grado||null,
  p_curso:course?.curso||null,p_busqueda:S.search.trim()||null,p_pagina:S.page,p_limite:S.limit,
  p_docente:api.role==="teacher"?api.id:null,p_sesion:api.role==="teacher"?api.session:null
 });if(req!==S.request)return;if(!d?.ok)throw Error(d?.error||"La consulta de ranking falló.");
 S.data=d;if(d.filtros)S.options=d.filtros;}catch(err){if(req!==S.request)return;S.error=String(err?.message||"Error de conexión.");}
 finally{if(req===S.request){S.busy=false;update();}}}
function render(ctx){const owner=String(ctx?.role||"")+":"+String(ctx?.id||"admin"),edition=String(ctx?.edition||"2026-2S");
 if(S.owner!==owner||S.edition!==edition){if(S.timer)clearTimeout(S.timer);
 S.owner=owner;S.edition=edition;S.site="";S.grade="";S.course="";S.search="";S.page=1;
 S.data=null;S.error="";S.busy=false;S.request++;S.options={sedes:[],grados:[],cursos:[]};}
 api=ctx;if(!S.data&&!S.busy&&!S.error)void load();return view();}
document.addEventListener("change",ev=>{const t=ev.target.closest("[data-rir-filter]");
 if(!t||!root()?.contains(t))return;switch(t.dataset.rirFilter){
 case "site":S.site=t.value;S.course="";break;
 case "grade":S.grade=t.value;S.course="";break;
 case "course":S.course=t.value;break;}
 S.page=1;void load();});
document.addEventListener("input",ev=>{const t=ev.target.closest("[data-rir-search]");if(!t||!root()?.contains(t))return;
 S.search=t.value;S.page=1;if(S.timer)clearTimeout(S.timer);
 S.timer=setTimeout(()=>{S.timer=null;void load();},320);});
document.addEventListener("keydown",ev=>{const t=ev.target.closest("[data-rir-search]");if(!t||!root()?.contains(t)||ev.key!=="Enter")return;
 ev.preventDefault();if(S.timer)clearTimeout(S.timer);S.timer=null;S.search=t.value;S.page=1;void load();});
document.addEventListener("click",ev=>{const r=root();if(!r||!r.contains(ev.target))return;
 const btn=ev.target.closest("[data-rir-page]");if(btn&&!btn.disabled){
 const p=Number(btn.dataset.rirPage);if(p>=1&&p<=Number(S.data?.total_paginas)&&p!==S.page){S.page=p;void load();}}
 if(ev.target.closest("[data-rir-retry]"))void load();});
window.RoqueRanking=Object.freeze({render,reset:()=>{if(S.timer)clearTimeout(S.timer);S.request++;S.owner="";S.data=null;S.busy=false;S.error="";}});
})();