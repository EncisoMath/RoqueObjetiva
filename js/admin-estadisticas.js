/* RoqueObjetiva v175.60 · Estadísticas institucionales (Admin/Coordinador) */
(() => {
"use strict";
const S={key:"",edition:"2026-2S",site:"",grade:"",course:"",subject:"",mode:"general",
  data:null,request:0,loading:false,error:""};
let api=null;
const e=v=>String(v??"").replace(/[&<>"']/g,x=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[x]));
const num=v=>Number.isFinite(Number(v))?Number(v):0;
const exists=v=>v!==null&&v!==undefined&&v!==""&&Number.isFinite(Number(v));
const fmt=(v,d=1)=>exists(v)?Number(v).toLocaleString("es-CO",{minimumFractionDigits:d,maximumFractionDigits:d}):"—";
const percentage=v=>exists(v)?fmt(v)+" %":"—";
// Colores tomados exactamente de las dos imágenes entregadas:
 // imagen 1: asignaturas (11 tonos); imagen 2: cursos de una asignatura (7 tonos).
const SUBJECT_BAR_COLORS=[
 "#1976D2","#0288D1","#0097A7","#00796B","#388E3C","#689F38",
 "#AFB42B","#FBC02D","#FFA000","#F57C00","#E64A19"
];
const COURSE_BAR_COLORS=[
 "#1976D2","#0288D1","#0097A7","#00796B","#388E3C","#689F38","#AFB42B"
];
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
const sites=()=>S.data?.sedes||[];
const grades=()=>S.data?.grados||[];
const courseKey=(sede,curso)=>JSON.stringify([String(sede),String(curso)]);
const selectedCourse=()=>{
 if(!S.course)return null;
 try{const v=JSON.parse(S.course);return Array.isArray(v)&&v.length===2?{sede:v[0],curso:v[1]}:null}
 catch(_){return null}
};
const courses=()=>{
 if(!S.grade)return [];
 const found=new Map();
 (S.data?.cursos||[]).filter(x=>String(x.grado)===S.grade&&(!S.site||x.sede===S.site)).forEach(x=>{
   const key=courseKey(x.sede,x.curso);
   if(!found.has(key))found.set(key,courseLabel(x.curso,S.grade)+(S.site?"":" · "+x.sede));
 });
 return [...found].sort((a,b)=>a[1].localeCompare(b[1],"es",{numeric:true}));
};
const subjects=()=>S.data?.asignaturas||[];
// Las cinco áreas principales encabezan el gráfico; después van las restantes.
const subjectRank=name=>{
 const n=String(name).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
 if(/matemat/.test(n))return 0;
 if(/lenguaje|humanidad|castellano/.test(n))return 1;
 if(/natural|biolog|quimic/.test(n))return 2;
 if(/social|ciudadania|historia/.test(n))return 3;
 if(/ingles|english/.test(n))return 4;
 return 5;
};
const byPriority=(a,b)=>subjectRank(a)-subjectRank(b)||a.localeCompare(b,"es");
// Conservar el color de cada asignatura al filtrar: tomar su posición
// en el orden institucional, incluso cuando se ve una sola barra.
const subjectBarColor=subject=>{
 const all=[...new Set(subjects())].sort(byPriority);
 const ix=all.indexOf(subject);
 return SUBJECT_BAR_COLORS[(ix<0?0:ix)%SUBJECT_BAR_COLORS.length];
};
const filters=()=>'<div class="ris-filters">'+
 '<label>Sede<select data-ris="site">'+opt("","Todas",S.site)+sites().map(x=>opt(x,x,S.site)).join("")+'</select></label>'+
 '<label>Grado<select data-ris="grade">'+opt("","Todos",S.grade)+grades().map(v=>opt(v,v+"°",S.grade)).join("")+'</select></label>'+
 '<label>Curso<select data-ris="course"'+(!S.grade?' disabled title="Selecciona primero un grado"':'')+'>'+
   opt("","Todos",S.course)+courses().map(x=>opt(x[0],x[1],S.course)).join("")+'</select></label>'+
 '<label>Asignatura<select data-ris="subject">'+opt("","Todas",S.subject)+
   subjects().map(x=>opt(x,x,S.subject)).join("")+'</select></label>'+
 '</div>';
const kpis=p=>{
 const inscritos=num(p.inscritos),resultados=num(p.resultados);
 const card=(type,n,label,theme)=>'<article class="ris-kpi '+theme+'"><span class="ris-kpi-ico">'+ico(type,38)+'</span>'+
   '<div class="ris-kpi-copy"><strong>'+e(n)+'</strong><span>'+e(label)+'</span></div></article>';
 return '<div class="ris-kpis">'+
   card("people",inscritos.toLocaleString("es-CO"),"Inscritos","blue")+
   card("check",resultados.toLocaleString("es-CO"),"Resultados","green")+
   card("bars",fmt(p.promedio),"Promedio (100)","violet")+
   card("trophy",percentage(p.satisfactorio),"Básico o superior","yellow")+
 '</div>';
};
const bars=(rows,grouped)=>{
 if(!rows?.length)return '<div class="ris-empty">Todavía no hay resultados para graficar con estos filtros.</div>';
 if(grouped){
   const by=new Map();
   for(const r of rows){if(!by.has(r.asignatura))by.set(r.asignatura,[]);by.get(r.asignatura).push(r);}
   const areas=[...by].sort((a,b)=>byPriority(a[0],b[0]));
   // Con una sola asignatura pueden aparecer muchos grados. La clave completa
   // garantiza que 6°-1 y 7°-1, incluso en la misma sede, sean cursos distintos.
   const gradeOf=r=>Number(r.grado)||Number(S.grade)||0;
   const keyOf=r=>JSON.stringify([gradeOf(r),String(r.sede||""),String(r.curso||"")]);
   const unique=new Map();
   for(const r of rows)unique.set(keyOf(r),{
     grado:gradeOf(r),sede:String(r.sede||""),curso:String(r.curso||""),key:keyOf(r)
   });
   const groups=[...unique.values()].sort((a,b)=>a.sede.localeCompare(b.sede,"es")||
     a.grado-b.grado||a.curso.localeCompare(b.curso,"es",{numeric:true}));
   // Una asignatura + Por curso: paleta de siete tonos de la imagen 2.
   // Otras comparaciones por curso: paleta completa de la imagen 1.
   const palette=S.subject?COURSE_BAR_COLORS:SUBJECT_BAR_COLORS;
   const locations=new Map();
   groups.forEach((g,i)=>{
     if(!locations.has(g.sede))locations.set(g.sede,[]);
     locations.get(g.sede).push({group:g,color:palette[i%palette.length]});
   });
   const legend='<div class="ris-course-legend">'+[...locations].map(([sede,entries])=>
     '<div class="ris-site-legend"><strong class="ris-site-name">'+e(sede)+'</strong><div class="ris-site-courses">'+
     entries.map(({group,color})=>'<span><i style="background:'+color+'"></i>'+e(courseLabel(group.curso,group.grado))+'</span>').join("")+
     '</div></div>').join("")+'</div>';
   // Garantiza espacio suficiente para cada barra al filtrar una sola asignatura:
   // el desplazamiento ocurre solo dentro del gráfico y no de la pantalla.
   const minPlot=Math.max(100*areas.length,(groups.length*18+16)*areas.length);
   return legend+'<div class="ris-chart-scroll"><div class="ris-plot ris-grouped" style="--count:'+areas.length+';--plot-min:'+minPlot+'px">'+
     areas.map(([subject,values])=>'<div class="ris-bar-column"><div class="ris-cluster">'+groups.map((g,i)=>{
       const match=values.find(r=>r.curso===g.curso&&r.sede===g.sede&&gradeOf(r)===g.grado),v=match?num(match.promedio):0;
       return '<div class="ris-bar ris-thin" style="--height:'+Math.round(Math.min(100,v)*1.6)+'px;--bar:'+palette[i%palette.length]+'" title="'+e(subject+" · "+courseLabel(g.curso,g.grado)+" · "+g.sede+": "+(match?fmt(v):"Sin datos"))+'"></div>';
     }).join("")+'</div><span class="ris-subject-label">'+e(short(subject))+'</span></div>').join("")+
     '</div></div>';
 }
 const sorted=[...rows].sort((a,b)=>byPriority(a.asignatura,b.asignatura));
 return '<div class="ris-chart-scroll"><div class="ris-plot" style="--count:'+sorted.length+'">'+
 sorted.map(x=>'<div class="ris-bar-column"><strong class="ris-bar-number">'+fmt(x.promedio)+'</strong>'+
   '<div class="ris-bar" style="--height:'+Math.round(Math.min(100,Math.max(0,num(x.promedio)))*1.6)+'px;--bar:'+subjectBarColor(x.asignatura)+'" title="'+e(x.asignatura+": "+fmt(x.promedio))+'"></div>'+
   '<span class="ris-subject-label">'+e(short(x.asignatura))+'</span></div>').join("")+'</div></div>';
};
const barsCard=p=>{
 // Una asignatura siempre puede compararse General / Por curso, aun sin grado.
  // El modo Por curso con curso seleccionado muestra únicamente ese curso.
  const toggle=Boolean(S.subject||(S.grade&&!S.course));
 const switcher=toggle?'<div class="ris-switch" role="group" aria-label="Comparación por curso">'+
  ['general','curso'].map(mode=>'<button type="button" data-ris-mode="'+mode+'" class="'+(S.mode===mode?"active":"")+
    '" aria-pressed="'+(S.mode===mode)+'">'+(mode==="general"?"General":"Por curso")+'</button>').join("")+'</div>':'';
 return '<section class="ris-card"><div class="ris-card-title"><h3>'+ico("bars")+' Promedio por asignatura</h3>'+switcher+'</div>'+
   '<div id="ris-chart">'+bars(toggle&&S.mode==="curso"?p.cursos_promedio:p.asignaturas_promedio,toggle&&S.mode==="curso")+'</div></section>';
};
const distribution=p=>{
 const base=["superior","alto","basico","bajo"];
 const definitions=["Superior (≥ 90)","Alto (80 – 89)","Básico (60 – 79)","Bajo (< 60)"];
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
 '<header class="ris-heading"><span class="ris-heading-icon">'+ico("bars",32)+'</span><h2>Estadísticas Institucionales</h2><span class="ris-current-edition">'+e(S.edition)+'</span></header>'+
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
  const selected=selectedCourse();
  const p=await api.rpc("roque_v11_estadisticas_institucionales",{
   p_edicion:S.edition,p_grado:S.grade?Number(S.grade):null,
   p_sede:S.site||selected?.sede||null,
   p_curso:selected?.curso||null,p_asignatura:S.subject||null,
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
 const edition=context?.edition||"2026-2S";
 if(S.key!==key||S.edition!==edition){
  S.key=key;S.edition=edition;S.site="";S.grade="";S.course="";S.subject="";
  S.mode="general";S.data=null;S.loading=false;S.error="";S.request++;
 }
 api=context;
 if(!S.data&&!S.loading)void load();
 return '<div class="ris-root" id="roque-statistics">'+view()+'</div>';
}
document.addEventListener("change",event=>{
 const el=event.target.closest("[data-ris]");
 if(!el||!document.getElementById("roque-statistics"))return;
 if(el.dataset.ris==="site"){S.site=el.value;S.course="";S.mode="general";}
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
window.RoqueStatistics={render,reset:()=>{S.request++;S.key="";S.data=null;S.loading=false;S.error="";S.site="";}};
})();
