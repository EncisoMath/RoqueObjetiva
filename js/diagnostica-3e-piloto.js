(() => {
  "use strict";
  // Piloto 3E: datos exclusivamente del servidor. Nada personal se incluye en GitHub.
  const CODE="2026-3E";
  const NAMES=["Matemáticas","Lectura Crítica","Ciencias Naturales","Ciencias Sociales","Inglés"];
  const ICONS=["🧮","📖","🧪","🌍","💬"];
  const COLORS=["#f35b22","#d81b3d","#43b233","#16a0d0","#8135ac"];
  const PDF_COMPONENTS=[
    [["MAT1","Numérico-variacional"],["MAT2","Geométrico-métrico"],["MAT3","Aleatorio"]],
    [],
    [["CN1","Procesos biológicos"],["CN2","Procesos físicos"],["CN3","Procesos químicos"],["CN4","Ciencia, tecnología y sociedad"]],
    [["SOC1","Ciencias sociales"],["SOC2","Competencias ciudadanas"]],
    []
  ];
  let data=null, modalArea=0, modalTab="componentes";
  const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const fmt=v=>Number.isFinite(Number(v))?String(Math.round(Number(v))):"—";
  const accessible=()=>!!(data && data.ok===true && /^\d{6,15}$/.test(String(data.documento||"")) && data.codigo===CODE);
  const documento=()=>accessible()?String(data.documento):"";
  const clear=()=>{data=null;modalTab="componentes";document.getElementById("modal-root")?.querySelector(".d3e-backdrop")?.remove();};
  async function probe(documento,terminal,rpc){
    if(!/^\d{6,15}$/.test(String(documento||"")) || typeof rpc!=="function" || !terminal){clear();return false;}
    try {
      const response=await rpc("roque_v23_diagnostica_3e_piloto",{p_documento:documento,p_terminal:terminal});
      if(response?.ok===true && response.codigo===CODE && response.documento===String(documento) &&
         String(response.id_prueba)==="2573" && Array.isArray(response.areas) &&
         response.areas.length===5 && Array.isArray(response.preguntas) &&
         response.preguntas.length===254 && Array.isArray(response.respuestas) &&
         response.respuestas.length===254) {
        data=response;return true;
      }
    } catch(e){console.warn("Diagnóstica 3E aún no disponible:",e?.message||e);}
    clear();return false;
  }
  const catalogEntry=()=>({codigo:CODE,titulo:"Prueba Diagnóstica 3E · 2026-2S",
    anio:2026,semestre:3,estado:"publicada",resultados_visibles:true,bloqueado_periodo:false,piloto:true});
  function card(i){
    const value=Number(data.areas[i]||0);
    const rank=Array.isArray(data.puesto_areas)?data.puesto_areas[i]?.puesto:null;
    return '<button type="button" class="d3e-area" data-d3e-area="'+i+'" style="--d3e-color:'+COLORS[i]+'">'+
      '<span class="d3e-area-top"><span>'+ICONS[i]+' '+esc(NAMES[i])+'</span><span aria-hidden="true">›</span></span>'+
      '<span class="d3e-area-score">'+fmt(value)+'<small>/100</small></span>'+
      '<span class="d3e-track"><i style="width:'+Math.max(0,Math.min(100,value))+'%"></i></span>'+
      '<span class="d3e-area-foot">'+(rank?'Puesto '+fmt(rank)+' del grado':'Ver componentes y respuestas')+'</span></button>';
  }
  function render(){
    if(!accessible())return '<section class="d3e-shell"><p>Evaluación no autorizada.</p></section>';
    const v=data.areas.map(Number);
    return '<section class="d3e-shell">'+
      '<header class="d3e-heading"><span class="d3e-eyebrow">DIAGNÓSTICA 3E · 2026-2S · GRADO 10°</span>'+
      '<h1>Mis resultados diagnósticos</h1><p>'+esc(data.nombre)+' · '+esc(data.curso)+' · '+esc(data.sede)+'</p></header>'+
      '<section class="d3e-global" aria-label="Puntaje global oficial">'+
      '<div><span class="d3e-global-label">PUNTAJE GLOBAL</span><div class="d3e-global-value">'+fmt(data.global)+'<small>/500</small></div></div>'+
      '<div class="d3e-position"><span>Puesto en grado 10°</span><strong>'+fmt(data.puesto_grado)+' <small>de '+fmt(data.total_evaluados)+'</small></strong>'+
      '<span>Posición en '+esc(data.curso)+'</span><strong>'+fmt(data.puesto_curso)+'</strong></div></section>'+
      '<div class="d3e-section-title"><h2>Resultados por área</h2><span>Notas oficiales</span></div>'+
      '<div class="d3e-areas">'+NAMES.map((_,i)=>card(i)).join("")+'</div>'+
      '<section class="d3e-formula"><h2>¿Cómo se calculó mi global?</h2><div class="d3e-weight">'+
      NAMES.map((x,i)=>'<div><span>'+esc(x)+'</span><strong>'+fmt(v[i])+' × '+(i===4?'1':'3')+'</strong></div>').join("")+
      '</div><div class="d3e-equation">('+fmt(v[0])+'×3 + '+fmt(v[1])+'×3 + '+fmt(v[2])+'×3 + '+fmt(v[3])+'×3 + '+fmt(v[4])+'×1) × 5 ÷ 13 = <strong>'+fmt(data.global)+'</strong></div></section>'+
      '<p class="d3e-source">Las notas y el puntaje global provienen del informe oficial. El detalle de aciertos se analiza a partir de las sábanas de respuestas y puede no coincidir numéricamente con la nota oficial.</p>'+
      '</section>';
  }
  function grouped(area,by){
    const src=data.preguntas.map((q,i)=>({...q,indice:i})).filter(q=>Number(q.area)===area && typeof q.key==="string" && /^[A-H]$/i.test(q.key));
    const groups=new Map();
    for(const q of src){
      const key=String(q[by]||"Sin especificar").trim();
      if(!groups.has(key))groups.set(key,{name:key,total:0,right:0});
      const g=groups.get(key);g.total++;
      if(String(data.respuestas[q.indice]||"").toUpperCase()===q.key.toUpperCase())g.right++;
    }
    return [...groups.values()].map(g=>({...g,score:Math.round(g.right*100/g.total)})).sort((a,b)=>b.score-a.score || a.name.localeCompare(b.name,"es"));
  }
  function rateRows(groups){
    if(!groups.length)return '<p class="d3e-empty">Sin información desagregada.</p>';
    return groups.map(g=>'<div class="d3e-metric"><div class="d3e-metric-title"><strong>'+esc(g.name)+'</strong><span>'+fmt(g.score)+'/100</span></div>'+
      '<div class="d3e-progress"><i style="width:'+fmt(g.score)+'%"></i></div>'+
      '<div class="d3e-metric-foot">'+fmt(g.right)+' aciertos de '+fmt(g.total)+' preguntas</div></div>').join("");
  }
  function officialComponents(area){
    const fields=PDF_COMPONENTS[area]||[];
    if(!fields.length)return "";
    return '<div class="d3e-official"><h3>Componentes del informe oficial</h3>'+
      '<div class="d3e-official-grid">'+fields.map(([key,label])=>'<div><span>'+esc(label)+'</span><strong>'+fmt(data.componentes_pdf?.[key])+'<small>/100</small></strong></div>').join("")+'</div>'+
      '<small>Estos valores son las calificaciones publicadas en el PDF.</small></div>';
  }
  function answers(area){
    const rows=data.preguntas.map((q,i)=>({...q,indice:i})).filter(q=>Number(q.area)===area);
    return '<div class="d3e-question-list">'+rows.map(q=>{
      const marked=String(data.respuestas[q.indice]||"").toUpperCase(),right=String(q.key||"").toUpperCase();
      const kind=!marked?"omit":marked===right?"ok":"bad";
      return '<div class="d3e-question '+kind+'"><div><strong>'+esc(q.id)+'</strong><small>'+esc(q.comp||"")+'</small></div>'+
        '<span>Marcada <b>'+esc(marked||"—")+'</b></span><span>Clave <b>'+esc(right||"—")+'</b></span></div>';
    }).join("")+'</div>';
  }
  function modalHtml(){
    const a=modalArea,t=modalTab;
    const tabs=[["componentes","Componentes"],["competencias","Competencias"],["preguntas","Preguntas"]];
    const content=t==="preguntas"?answers(a):rateRows(grouped(a,t==="componentes"?"comp":"compet"));
    return '<div class="d3e-backdrop" role="presentation">'+
      '<section class="d3e-modal" role="dialog" aria-modal="true" aria-label="Detalle de '+esc(NAMES[a])+'">'+
      '<header class="d3e-modal-head" style="--d3e-color:'+COLORS[a]+'"><div><span>ÁREA EVALUADA</span><h2>'+ICONS[a]+' '+esc(NAMES[a])+'</h2></div>'+
      '<div class="d3e-modal-score">'+fmt(data.areas[a])+'<small>/100</small></div>'+
      '<button type="button" data-d3e-close aria-label="Cerrar">×</button></header>'+
      '<div class="d3e-modal-tabs">'+tabs.map(([id,label])=>'<button type="button" data-d3e-tab="'+id+'" class="'+(t===id?'active':'')+'">'+label+'</button>').join("")+'</div>'+
      '<div class="d3e-modal-body">'+(t==="componentes"?officialComponents(a):"")+
      (t!=="preguntas"?'<h3>'+ (t==="componentes"?"Aciertos por componente":"Aciertos por competencia")+'</h3>':'<h3>Respuestas por pregunta</h3>')+
      content+'<p class="d3e-mini-note">Aciertos calculados desde las respuestas de la sábana. No representan el puntaje oficial del área.</p></div>'+
      '<footer class="d3e-modal-footer"><button type="button" data-d3e-close>Cerrar</button></footer></section></div>';
  }
  function showModal(area,tab){
    if(!accessible())return;
    modalArea=area;modalTab=tab||"componentes";
    const root=document.getElementById("modal-root");if(root)root.innerHTML=modalHtml();
  }
  document.addEventListener("click",e=>{
    const btn=e.target.closest?.("[data-d3e-area],[data-d3e-tab],[data-d3e-close]");
    if(!btn)return;
    if(btn.hasAttribute("data-d3e-area"))showModal(Number(btn.dataset.d3eArea),"componentes");
    else if(btn.hasAttribute("data-d3e-tab"))showModal(modalArea,String(btn.dataset.d3eTab));
    else if(btn.hasAttribute("data-d3e-close"))document.getElementById("modal-root")?.querySelector(".d3e-backdrop")?.remove();
  },true);
  window.RoqueDiagnostica3E={probe,accessible,documento,catalogEntry,render,clear,CODE};
})();