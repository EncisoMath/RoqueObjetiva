/* RoqueObjetiva v175.56 · Estadísticas institucionales (Admin/Coordinador) */
(() => {
"use strict";
const S={key:"",edition:"2026-2S",grade:"",course:"",subject:"",mode:"general",
  data:null,request:0,loading:false,error:""};
let api=null;
const e=v=>String(v??"").replace(/[&<>"']/g,x=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[x]));
const num=v=>Number.isFinite(Number(v))?Number(v):0;
const exists=v=>v!==null&&v!==undefined&&v!==""&&Number.isFinite(Number(v));
const fmt=(v,d=1)=>exists(v)?Number(v).toLocaleString("es-CO",{minimumFractionDigits:d,maximumFractionDigits:d}):"—";
const percentage=v=>exists(v)?fmt(v)+" %":"—";
const color={
 "Matemáticas":"#2399fa","Lenguaje":"#f04b82","Inglés":"#2399fa",
 "Ciencias Sociales y Ciudadanía":"#5bbb2f","Ciencias Naturales":"#58b72f",
 "Educación Física":"#f54c84","Informática":"#a777e4","Religión":"#ffa52e",
 "Ética y Valores":"#e4b937","Artística":"#ad75d5"
};
const short=x=>({"Ciencias Sociales y Ciudadanía":"Sociales","Ciencias Naturales":"Naturales","Educación Física":"Edu. Física","Ética y Valores":"Ética"}[x]||x);
const courseLabel=(v,grade,sede)=>{
 const m=String(v).match(/^(\d+)/);
 return (m?String(grade||"")+"°-"+m[1]:String(v))+(sede&&/SS$/i.test(String(v))?" · "+sede:"");
};
const paths={
 bars:'<path d="M4 20v-8h4v8M10 20V7h4v13M16 20V3h4v17"/>',
 people:'<circle cx="9" cy="8" r="3"/><path d="M2 20v-2c0-3 3-5 7-5s7 2 7 5v2M17 6a3 3 0 0 1 0 6M18 14c3 0 4 2 4 5v1"/>',
 check:'<circle cx="12" cy="12" r="9"/><path d="m7 12 3 3 6-7"/>',
 trophy:'<path d="M7 4h10v7a5 5 0 0 1-10 0V4ZM7 6H3v4a4 4 0 0 0 4 4M17 6h4v4a4 4 0 0 1-4 4M12 16v4M8 21h8"/>',
 layers:'<path d="m12 3 9 5-9 5-9-5ZM3 12l9 5 9-5M3 16l9 5 9-5"/>'
};
const ico=(type,size=22)=>'<svg class="ris-icon" width="'+size+'" height="'+size+'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linejoin="round" stroke-linecap="round" stroke-width="2" aria-hidden="true">'+paths[type]+'</svg>';
const opt=(v,label,selected)=>'<option value="'+e(v)+'"'+(String(v)===String(selected)?" selected":"")+'>'+e(label)+'</option>';
const editions=()=>S.data?.ediciones?.length?S.data.ediciones:["2026-2S","2026-1S"];
const grades=()=>S.data?.grados||[];
const courses=()=>{
 if(!S.grade)return [];
 const found=new Map();
 (S.data?.cursos||[]).filter(x=>String(x.grado)===S.grade).forEach(x=>{
   if(!found.has(x.curso))found.set(x.curso,courseLabel(x.curso,S.grade,x.sede));
 });
 return [...found].sort((a,b)=>a[1].localeCompare(b[1],"es",{numeric:true}));
};
const subjects=()=>S.data?.asignaturas||[];
const filters=()=>'<div class="ris-filters">'+
 '<label>Edición<select data-ris="edition">'+editions().map(v=>opt(v,v,S.edition)).join("")+'</select></label>'+
 '<label>Grado<select data-ris="grade">'+opt("","Todos",S.grade)+grades().map(v=>opt(v,v+"°",S.grade)).join("")+'</select></label>'+
 '<label>Curso<select data-ris="course"'+(!S.grade?' disabled title="Selecciona primero un grado"':'')+'>'+
   opt("","Todos",S.course)+courses().map(x=>opt(x[0],x[1],S.course)).join("")+'</select></label>'+
 '<label>Asignatura<select data-ris="subject">'+opt("","Todas",S.subject)+
   subjects().map(x=>opt(x,x,S.subject)).join("")+'</select></label>'+
 '</div>';
const kpis=p=>{
 const inscritos=num(p.inscritos),resultados=num(p.resultados);
 const coverage=inscritos?resultados*100/inscritos:null;
 const card=(type,n,label,theme,aside)=>'<article class="ris-kpi '+theme+'"><span class="ris-kpi-ico">'+ico(type,47)+'</span>'+
   '<div class="ris-kpi-copy"><strong>'+e(n)+'</strong><span>'+e(label)+'</span></div>'+
   (aside?'<b class="ris-kpi-aside">'+e(aside)+'</b>':'')+'</article>';
 return '<div class="ris-kpis">'+
   card("people",inscritos.toLocaleString("es-CO"),"Estudiantes inscritos","blue")+
   card("check",resultados.toLocaleString("es-CO"),"Resultados registrados","green",coverage===null?"":percentage(coverage))+
   card("bars",fmt(p.promedio),S.subject?"Promedio · "+S.subject:"Promedio general (100)","violet")+
   card("trophy",percentage(p.satisfactorio),"Nivel de desempeño satisfactorio","yellow")+
 '</div>';
};
const bars=(rows,grouped)=>{
 if(!rows?.length)return '<div class="ris-empty">Todavía no hay resultados para graficar con estos filtros.</div>';
 if(grouped){
   const by=new Map();
   for(const r of rows){if(!by.has(r.asignatura))by.set(r.asignatura,[]);by.get(r.asignatura).push(r);}
   const areas=[...by].sort((a,b)=>a[0].localeCompare(b[0],"es"));
   const groups=[...new Set(rows.map(x=>x.curso))].sort((a,b)=>a.localeCompare(b,"es",{numeric:true}));
   const palette=["#1988cf","#59b7eb","#8264de","#37b5a1","#efa04a","#ed659c","#627da6"];
   return '<div class="ris-course-legend">'+groups.map((x,i)=>'<span><i style="background:'+palette[i%palette.length]+'"></i>'+e(courseLabel(x,S.grade))+'</span>').join("")+'</div>'+
     '<div class="ris-chart-scroll"><div class="ris-plot ris-grouped" style="--count:'+areas.length+'">'+
     areas.map(([subject,values])=>'<div class="ris-bar-column"><div class="ris-cluster">'+groups.map((c,i)=>{
       const match=values.find(x=>x.curso===c),v=match?num(match.promedio):0;
       return '<div class="ris-bar ris-thin" style="--height:'+Math.round(Math.min(100,v)*1.6)+'px;--bar:'+palette[i%palette.length]+'" title="'+e(subject+" · "+courseLabel(c,S.grade)+": "+(match?fmt(v):"Sin datos"))+'"></div>';
     }).join("")+'</div><span class="ris-subject-label">'+e(short(subject))+'</span></div>').join("")+
     '</div></div>';
 }
 const sorted=[...rows].sort((a,b)=>a.asignatura.localeCompare(b.asignatura,"es"));
 return '<div class="ris-chart-scroll"><div class="ris-plot" style="--count:'+sorted.length+'">'+
 sorted.map(x=>'<div class="ris-bar-column"><strong class="ris-bar-number">'+fmt(x.promedio)+'</strong>'+
   '<div class="ris-bar" style="--height:'+Math.round(Math.min(100,Math.max(0,num(x.promedio)))*1.6)+'px;--bar:'+(color[x.asignatura]||"#209ac8")+'" title="'+e(x.asignatura+": "+fmt(x.promedio))+'"></div>'+
   '<span class="ris-subject-label">'+e(short(x.asignatura))+'</span></div>').join("")+'</div></div>';
};
const barsCard=p=>{
 const toggle=Boolean(S.grade&&!S.course&&!S.subject);
 const switcher=toggle?'<div class="ris-switch" role="group" aria-label="Comparación por curso">'+
  ['general','curso'].map(mode=>'<button type="button" data-ris-mode="'+mode+'" class="'+(S.mode===mode?"active":"")+
    '" aria-pressed="'+(S.mode===mode)+'">'+(mode==="general"?"General":"Por curso")+'</button>').join("")+'</div>':'';
 return '<section class="ris-card"><div class="ris-card-title"><h3>'+ico("bars")+' Promedio por asignatura</h3>'+switcher+'</div>'+
   '<div id="ris-chart">'+bars(toggle&&S.mode==="curso"?p.cursos_promedio:p.asignaturas_promedio,toggle&&S.mode==="curso")+'</div></section>';
};
const distribution=p=>{
 const base=["avanzado","satisfactorio","basico","bajo"];
 const definitions=["Avanzado (≥ 80)","Satisfactorio (60 – 79)","Básico (40 – 59)","Bajo (< 40)"];
 const palette=["#56b82d","#258dff","#ffbe00","#ff534c"];
 const rows=base.map((id,i)=>(p.distribucion||[]).find(x=>x.id===id)||{id,nombre:definitions[i],cantidad:0,porcentaje:0});
 const n=num(p.evaluados),has=n>0;
 let end=0;
 const fills=has?rows.map((x,i)=>{
   const start=end;end+=num(x.cantidad)/n*360;
   return palette[i]+" "+start+"deg "+end+"deg";
 }).join(","):"#d6e3ef 0deg 360deg";
 return '<section class="ris-card"><div class="ris-card-title"><h3>'+ico("bars")+' Distribución del desempeño</h3></div>'+
  '<div class="ris-distribution"><div class="ris-donut" style="background:conic-gradient('+fills+')" role="img" aria-label="Distribución de desempeño">'+
   '<div class="ris-donut-inner"><strong>'+n.toLocaleString("es-CO")+'</strong><span>Estudiantes</span></div></div>'+
   '<div class="ris-legend">'+rows.map((x,i)=>'<div><i style="background:'+palette[i]+'"></i>'+
     '<span>'+e(x.nombre)+'</span><b>'+(has?percentage(x.porcentaje):"—")+'</b></div>').join("")+'</div></div></section>';
};
const components=p=>{
 if(!S.subject)return "";
 const rows=p.componentes||[];
 return '<section class="ris-card ris-component-card"><div class="ris-card-title"><h3>'+ico("layers")+' Componentes – '+e(S.subject)+'</h3></div>'+
  (rows.length?'<div class="ris-component-list">'+rows.map(x=>'<div class="ris-component-row"><span>'+e(x.nombre)+'</span>'+
    '<div class="ris-track"><i style="width:'+Math.min(100,Math.max(0,num(x.promedio)))+'%"></i></div>'+
    '<b>'+percentage(x.promedio)+'</b></div>').join("")+'</div>':
    '<p class="ris-empty">'+(num(p.resultados)===0?'Los componentes aparecerán cuando se registren resultados.':'No hay componentes registrados para este filtro.')+'</p>')+'</section>';
};
const body=()=>{
 if(S.loading&&!S.data)return '<div class="ris-loading" role="status">Consultando datos institucionales…</div>';
 if(S.error&&!S.data)return '<div class="ris-error" role="alert">'+e(S.error)+' <button data-ris-retry="1">Reintentar</button></div>';
 const p=S.data||{};
 return (S.loading?'<div class="ris-updating" role="status">Actualizando…</div>':'')+
   (S.error?'<p class="ris-error">'+e(S.error)+'</p>':'')+
   (num(p.resultados)===0?'<p class="ris-warning">Esta selección aún no tiene resultados registrados. Las gráficas aparecerán cuando existan datos reales.</p>':'')+
   kpis(p)+barsCard(p)+distribution(p)+components(p)+
   '<p class="ris-footnote">Nota por asignatura: 20 + 80 × (respuestas correctas / ítems válidos). Componentes: porcentaje de aciertos. Se excluyen ítems anulados y evaluaciones sin respuestas marcadas.</p>';
};
const view=()=>'<section class="ris-screen"><div class="ris-eyebrow">ESTADÍSTICAS</div>'+
 '<header class="ris-heading"><span class="ris-heading-icon">'+ico("bars",32)+'</span><h2>Estadísticas Institucionales</h2></header>'+
 '<div id="ris-filters">'+filters()+'</div><div id="ris-body">'+body()+'</div></section>';
const update=()=>{
 const root=document.getElementById("roque-statistics");if(!root)return;
 const f=root.querySelector("#ris-filters"),b=root.querySelector("#ris-body");
 if(f)f.innerHTML=filters();if(b)b.innerHTML=body();
};
async function load(){
 if(!api?.rpc)return;
 const seq=++S.request;S.loading=true;S.error="";
 const host=document.querySelector("#roque-statistics #ris-body");
 if(host)host.classList.add("ris-busy");
 try{
  const p=await api.rpc("roque_v10_estadisticas_institucionales",{
   p_edicion:S.edition,p_grado:S.grade?Number(S.grade):null,
   p_curso:S.course||null,p_asignatura:S.subject||null,
   p_docente:api.role==="teacher"?api.id:null,
   p_sesion:api.role==="teacher"?api.session:null
  });
  if(seq!==S.request)return;
  if(!p?.ok)throw Error(p?.error||"No se recibieron las estadísticas.");
  S.data=p;
  if(S.grade&&!grades().some(x=>String(x)===S.grade)){S.grade="";S.course="";}
  if(S.course&&!courses().some(x=>x[0]===S.course))S.course="";
  if(S.subject&&!subjects().includes(S.subject))S.subject="";
 }catch(error){
  if(seq!==S.request)return;
  S.error=String(error?.message||"No se pudo consultar Supabase.");
 }finally{if(seq===S.request){S.loading=false;update();}}
}
function render(context){
 const key=(context?.role||"")+":"+(context?.id||"admin");
 if(S.key!==key){
  S.key=key;S.edition="2026-2S";S.grade="";S.course="";S.subject="";
  S.mode="general";S.data=null;S.loading=false;S.error="";S.request++;
 }
 api=context;
 if(!S.data&&!S.loading)void load();
 return '<div class="ris-root" id="roque-statistics">'+view()+'</div>';
}
document.addEventListener("change",event=>{
 const el=event.target.closest("[data-ris]");
 if(!el||!document.getElementById("roque-statistics"))return;
 if(el.dataset.ris==="edition"){S.edition=el.value;S.grade="";S.course="";S.subject="";S.mode="general";S.data=null;}
 if(el.dataset.ris==="grade"){S.grade=el.value;S.course="";S.subject="";S.mode="general";}
 if(el.dataset.ris==="course"){S.course=el.value;S.mode="general";}
 if(el.dataset.ris==="subject"){S.subject=el.value;S.mode="general";}
 void load();
});
document.addEventListener("click",event=>{
 const root=document.getElementById("roque-statistics");if(!root)return;
 const el=event.target.closest("[data-ris-mode]");
 if(el){
  S.mode=el.dataset.risMode;
  root.querySelectorAll("[data-ris-mode]").forEach(b=>{const chosen=b.dataset.risMode===S.mode;b.classList.toggle("active",chosen);b.setAttribute("aria-pressed",String(chosen));});
  const chart=root.querySelector("#ris-chart");
  if(chart)chart.innerHTML=bars(S.mode==="curso"?S.data?.cursos_promedio:S.data?.asignaturas_promedio,S.mode==="curso");
 }
 if(event.target.closest("[data-ris-retry]"))void load();
});
window.RoqueStatistics={render,reset:()=>{S.request++;S.key="";S.data=null;S.loading=false;S.error="";}};
})();
