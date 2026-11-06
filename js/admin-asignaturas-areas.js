/* RoqueObjetiva v175.76 · Asignaturas y áreas, datos 100% de Supabase. */
(() => {
  "use strict";
  const S={areas:[],subjects:[],loaded:false,loading:false,busy:false,error:"",selected:"",modal:null,revision:0,lastLoad:0};
  let ctx=null, owner="";
  const esc=value=>String(value??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;");
  const norm=value=>String(value??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").trim().replace(/\s+/g," ").toLowerCase();
  const collate=(a,b)=>String(a).localeCompare(String(b),"es",{sensitivity:"base"});
  const findArea=name=>S.areas.find(a=>norm(a.nombre)===norm(name));
  const current=()=>findArea(S.selected);
  const icons={
    layers:'<path d="m12 2 9 5-9 5-9-5 9-5zM3 12l9 5 9-5M3 17l9 5 9-5"/>',
    book:'<path d="M12 7C9 5 6 5 3 5v14c3-1 6-1 9 1 3-2 6-2 9-1V5c-3 0-6 0-9 2zm0 0v13"/>',
    back:'<path d="m15 18-6-6 6-6"/>',
    next:'<path d="m9 18 6-6-6-6"/>',
    plus:'<path d="M12 5v14M5 12h14"/>',
    trash:'<path d="M4 7h16M9 7V4h6v3m-9 0 1 14h10l1-14M10 11v7m4-7v7"/>',
    lock:'<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
    info:'<circle cx="12" cy="12" r="10"/><path d="M12 11v6m0-10h.01"/>',
    close:'<path d="M5 5 19 19M19 5 5 19"/>',
    check:'<path d="m4 12 5 5L20 6"/>',
    groups:'<path d="M5 20v-3a4 4 0 0 1 8 0v3H5ZM9 4a4 4 0 1 1 0 8 4 4 0 0 1 0-8M17 7a3 3 0 0 1 0 6m-2 4a4 4 0 0 1 5 3"/>',
    bars:'<path d="M4 20v-6h4v6M10 20V9h4v11M16 20V4h4v16"/>',
    alert:'<path d="m12 3 10 18H2L12 3Zm0 7v4m0 3h.01"/>'
  };
  const icon=(name,size=22)=>'<svg width="'+size+'" height="'+size+'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+(icons[name]||icons.layers)+'</svg>';
  const images={"matematicas":"matematicas.png","lenguaje":"lenguaje.png","ciencias naturales":"ciencias-naturales.png","ciencias sociales y ciudadania":"ciencias-sociales-y-ciudadania.png","educacion fisica":"educacion-fisica.png","artistica":"artistica.png","informatica":"informatica.png","etica y valores":"etica-y-valores.png","ingles":"ingles.png","religion":"religion.png"};
  const picture=(area)=>{const src=images[norm(area)];return src?'<img src="ICONOS/'+src+'" width="36" height="36" alt="" loading="eager">':icon("layers",32);};
  const accent=(name)=>{
    const key=Object.keys(ctx?.colors||{}).find(k=>norm(k)===norm(name));
    const color=key?ctx.colors[key]:"";
    return /^#[0-9a-fA-F]{6}$/.test(color)?color:"#1975ae";
  };
  const scope=()=>document.getElementById("roque-areas");
  const allSubjects=area=>S.subjects.filter(s=>norm(s.area)===norm(area)).sort((a,b)=>collate(a.nombre,b.nombre));
  const freeSubjects=()=>S.subjects.filter(s=>!s.area).sort((a,b)=>collate(a.nombre,b.nombre));
  const areaHead=(a)=>'<span class="ra-area-tile" style="--ra-accent:'+accent(a.nombre)+'">'+picture(a.nombre)+'</span>';
  const plural=n=>n===1?"1 asignatura":n+" asignaturas";
  const header=()=>'<header class="ra-page-header"><div class="ra-kicker">ADMINISTRACIÓN</div>'+
    '<div class="ra-heading"><span class="ra-logo">'+icon("layers",29)+'</span><div><h2>Asignaturas y áreas</h2>'+
    '<p>Organiza las áreas y las asignaturas que pertenecen a cada una.</p></div></div></header>';
  const list=()=>header()+'<section class="ra-list" aria-label="Áreas académicas">'+
    S.areas.map(a=>'<button class="ra-area-row" type="button" data-ra-action="open" data-area="'+esc(a.nombre)+'">'+
      areaHead(a)+'<span class="ra-area-text"><strong>'+esc(a.nombre)+'</strong><small>'+plural(allSubjects(a.nombre).length)+'</small></span>'+
      '<span class="ra-chevron">'+icon("next",22)+'</span></button>').join("")+
    (S.areas.length?"":'<div class="ra-empty">No hay áreas académicas registradas en Supabase.</div>')+'</section>';
  const meta=(a)=>{
    const grades=Array.isArray(a.grados)?[...new Set(a.grados.map(Number).filter(Number.isFinite))].sort((x,y)=>x-y):[];
    const gradeLabel=grades.length?(grades.length>1&&grades.every((n,i)=>i===0||n===grades[i-1]+1)
      ?grades[0]+"° a "+grades[grades.length-1]+"°":grades.map(n=>n+"°").join(", ")):"Sin grados";
    return '<section class="ra-meta"><div class="ra-section-title">'+icon("info",24)+'<h3>Información del área</h3></div>'+
      '<div class="ra-meta-grid">'+
      '<div>'+icon("layers")+'<span>Grados</span><strong>'+esc(gradeLabel)+'</strong></div>'+
      '<div>'+icon("check")+'<span>Usada en claves</span><strong>'+((a.en_claves)?"Sí":"No")+'</strong></div>'+
      '<div>'+icon("groups")+'<span>En carga docente</span><strong>'+((a.en_carga)?"Sí":"No")+'</strong></div>'+
      '<div>'+icon("bars")+'<span>En estadísticas</span><strong>'+((a.en_estadisticas)?"Sí":"No")+'</strong></div>'+
      '</div></section>';
  };
  const linkedRow=s=>'<div class="ra-subject-linked"><span class="ra-handle" aria-hidden="true">•••</span>'+
    '<strong>'+esc(s.nombre)+'</strong><button type="button" class="ra-remove" data-ra-action="remove" data-subject="'+esc(s.nombre)+'" '+
    'aria-label="Desvincular '+esc(s.nombre)+'" title="'+(s.protegida?"Tiene registros asociados: ver advertencia":"Desvincular asignatura")+'">'+
    (s.protegida?icon("lock",21):icon("trash",21))+'</button></div>';
  const freeRow=s=>'<div class="ra-subject-free"><span>'+esc(s.nombre)+'</span><button type="button" data-ra-action="link" data-subject="'+esc(s.nombre)+'" '+
    'aria-label="Vincular '+esc(s.nombre)+'" title="Vincular al área">'+icon("plus",20)+'</button></div>';
  const detail=()=>{
    const a=current();if(!a)return list();
    const linked=allSubjects(a.nombre),free=freeSubjects();
    return '<div class="ra-detail">'+
      '<button class="ra-back" data-ra-action="back" type="button">'+icon("back",24)+'<span>Asignaturas y áreas</span></button>'+
      '<header class="ra-hero" style="--ra-accent:'+accent(a.nombre)+'">'+
        '<span class="ra-hero-icon">'+picture(a.nombre)+'</span><span class="ra-hero-line"></span>'+
        '<div class="ra-hero-info"><h2>'+esc(a.nombre)+'</h2><p>'+plural(linked.length)+'</p></div>'+
        '<span class="ra-hero-art" aria-hidden="true">'+icon("layers",65)+'</span>'+
      '</header>'+
      '<section class="ra-panel"><div class="ra-section-title">'+icon("book",25)+'<h3>Asignaturas de esta área</h3></div>'+
      '<div class="ra-subject-items">'+(linked.length?linked.map(linkedRow).join(""):'<div class="ra-empty">Esta área aún no tiene asignaturas vinculadas.</div>')+'</div></section>'+
      '<section class="ra-panel"><div class="ra-section-title ra-available-head">'+icon("plus",26)+
      '<div><h3>Asignaturas disponibles</h3><p>Asignaturas que actualmente no pertenecen a ningún área.</p></div></div>'+
      '<div class="ra-free-items">'+(free.length?free.map(freeRow).join(""):'<div class="ra-empty">Todas las asignaturas existentes están vinculadas.</div>')+'</div>'+
      '<button type="button" class="ra-create-link" data-ra-action="new">'+icon("plus",18)+'Crear nueva asignatura</button></section>'+
      meta(a)+'</div>';
  };
  const modal=()=>{
    if(!S.modal)return "";
    const a=current();if(!a)return "";
    const m=S.modal,subject=m.subject||"";
    let title="",body="",footer="";
    if(m.kind==="new"){
      title="Nueva asignatura";
      body='<p>Se creará y vinculará directamente a <strong>'+esc(a.nombre)+'</strong>.</p>'+
        '<form id="ra-new-form" data-ra-form="create"><label for="ra-new-name">Nombre de la asignatura</label>'+
        '<input id="ra-new-name" name="asignatura" type="text" minlength="2" maxlength="100" autocomplete="off" required placeholder="Nombre de la asignatura"></form>';
      footer='<button type="submit" form="ra-new-form" class="ra-primary" '+(S.busy?"disabled":"")+'>'+icon("plus",18)+'Crear asignatura</button>';
    }else if(m.kind==="protected"){
      title="Asignatura protegida";
      body='<p><strong>'+esc(subject)+'</strong> tiene cargas docentes o ítems/claves vinculados. Para preservar las evaluaciones, su relación actual está protegida.</p>'+
        '<div class="ra-warning">'+icon("lock",21)+'No se realizará ningún cambio en Supabase.</div>';
    }else if(m.kind==="unlink"){
      title="Desvincular asignatura";
      body='<p>¿Desvincular <strong>'+esc(subject)+'</strong> de <strong>'+esc(a.nombre)+'</strong>?</p>'+
        '<div class="ra-warning">'+icon("alert",20)+'La asignatura permanecerá registrada. No se eliminarán cargas, claves ni resultados.</div>';
      footer='<button type="button" data-ra-action="confirm-unlink" class="ra-danger" '+(S.busy?"disabled":"")+'>'+icon("trash",18)+'Desvincular</button>';
    }else if(m.kind==="link-used"){
      title="Revisar vinculación";
      body='<p><strong>'+esc(subject)+'</strong> aparece en carga docente. Vincularla a <strong>'+esc(a.nombre)+'</strong> puede cambiar la clasificación mostrada en las vistas académicas.</p>'+
        '<div class="ra-warning">'+icon("info",20)+'Las cargas, claves y calificaciones se conservarán sin modificaciones.</div>';
      footer='<button type="button" data-ra-action="confirm-link" class="ra-primary" '+(S.busy?"disabled":"")+'>'+icon("check",18)+'Vincular</button>';
    }
    return '<div class="ra-shade" data-ra-action="dismiss-outside"><div role="dialog" aria-modal="true" aria-labelledby="ra-dialog-title" class="ra-dialog">'+
      '<header><h3 id="ra-dialog-title">'+esc(title)+'</h3><button type="button" data-ra-action="close" class="ra-modal-x" aria-label="Cerrar">'+icon("close",20)+'</button></header>'+
      '<div class="ra-dialog-body">'+body+'</div>'+
      '<footer><button type="button" data-ra-action="close" class="ra-secondary">Cancelar</button>'+footer+'</footer></div></div>';
  };
  const markup=()=>'<div class="ra-root" id="roque-areas" data-revision="'+S.revision+'">'+
    (S.loading&&!S.loaded?'<div class="ra-loading">'+icon("layers",24)+'Cargando áreas y asignaturas reales…</div>':
      S.error&&!S.loaded?'<div class="ra-error">'+icon("alert",22)+'<p>'+esc(S.error)+'</p>'+
        '<button type="button" class="ra-primary" data-ra-action="reload">Reintentar</button></div>':
      (S.selected?detail():list()))+
    (S.loaded&&S.error?'<p class="ra-sync-error">'+esc(S.error)+' <button type="button" data-ra-action="reload">Reintentar</button></p>':'')+
    modal()+'</div>';
  const draw=()=>{
    const root=scope();if(root)root.outerHTML=markup();
  };
  async function reload(paint=true){
    if(!ctx?.rpc||S.loading||S.busy)return false;
    S.loading=true;S.error="";
    const scopeOwner=owner;
    try{
      const p=await ctx.rpc("roque_v16_areas_catalogo",{});
      if(scopeOwner!==owner)return false;
      if(!p?.ok||!Array.isArray(p.areas)||!Array.isArray(p.asignaturas))throw Error(p?.message||"No se recibió el catálogo académico.");
      S.areas=p.areas;S.subjects=p.asignaturas;S.loaded=true;S.lastLoad=Date.now();S.revision++;
      if(S.selected&&!current())S.selected="";
      return true;
    }catch(err){if(scopeOwner===owner)S.error=String(err?.message||err);return false;}
    finally{if(scopeOwner===owner){S.loading=false;if(paint)draw();}}
  }
  function render(context){
    if(context){
      const next=String(context.owner||"admin");
      if(owner!==next)reset(next);
      ctx=context;
    }
    if(!S.loading&&(!S.loaded||Date.now()-S.lastLoad>60000))void reload();
    return markup();
  }
  const findSubject=name=>S.subjects.find(s=>norm(s.nombre)===norm(name));
  const showModal=(kind,subject="")=>{S.modal={kind,subject};draw();if(kind==="new")requestAnimationFrame(()=>document.getElementById("ra-new-name")?.focus());};
  const closeModal=()=>{S.modal=null;draw();};
  async function save(operation,subject){
    if(S.busy||!S.selected||!ctx?.rpc)return;
    S.busy=true;const actor=owner;
    draw();
    try{
      const result=await ctx.rpc("roque_v16_areas_guardar",{
        p_operacion:operation,p_area:S.selected,p_asignatura:subject
      });
      if(!result?.ok)throw Error(result?.error||"No se guardó la asignatura.");
      if(actor!==owner)return;
      S.modal=null;
      S.busy=false;
      const fetched=await reload(false);
      if(!fetched)S.error="El cambio se guardó, pero falló la actualización de la lista. Presiona Reintentar.";
      ctx?.notify?.(result.cambiado?"Guardado correctamente en Supabase.":"La relación ya estaba guardada.");
    }catch(err){
      if(actor===owner){S.error=String(err?.message||err);ctx?.notify?.(S.error);}
    }finally{if(actor===owner){S.busy=false;draw();}}
  }
  document.addEventListener("click",event=>{
    const b=event.target.closest("[data-ra-action]"),root=scope();
    if(!b||!root||!root.contains(b))return;
    const action=b.dataset.raAction;
    if(action==="dismiss-outside"){
      if(event.target===b&&!S.busy)closeModal();return;
    }
    event.preventDefault();
    if(S.busy)return;
    if(action==="back"){S.selected="";S.modal=null;draw();scope()?.scrollIntoView({block:"start",behavior:"instant"});return;}
    if(action==="open"){const area=findArea(b.dataset.area||"");if(area){S.selected=area.nombre;S.modal=null;draw();scope()?.scrollIntoView({block:"start",behavior:"instant"});}return;}
    if(action==="reload"){void reload();return;}
    if(action==="close"){closeModal();return;}
    if(action==="new"){showModal("new");return;}
    if(action==="remove"){
      const s=findSubject(b.dataset.subject);if(!s)return;
      showModal(s.protegida?"protected":"unlink",s.nombre);return;
    }
    if(action==="link"){
      const s=findSubject(b.dataset.subject);if(!s||s.area)return;
      if(s.en_carga){showModal("link-used",s.nombre);return;}
      void save("vincular",s.nombre);return;
    }
    if(action==="confirm-unlink"&&S.modal?.kind==="unlink"){void save("desvincular",S.modal.subject);return;}
    if(action==="confirm-link"&&S.modal?.kind==="link-used"){void save("vincular",S.modal.subject);}
  });
  document.addEventListener("submit",event=>{
    const form=event.target.closest("[data-ra-form]");
    if(!form||!scope()?.contains(form))return;
    event.preventDefault();
    if(S.busy)return;
    if(form.dataset.raForm==="create"){
      const name=String(new FormData(form).get("asignatura")||"").trim();
      if(name.length<2||name.length>100)return;
      void save("crear",name);
    }
  });
  document.addEventListener("keydown",event=>{
    if(event.key==="Escape"&&S.modal&&scope()&&!S.busy){event.stopPropagation();closeModal();}
  });
  function reset(next=""){owner=next;ctx=null;S.areas=[];S.subjects=[];S.loaded=false;S.loading=false;S.busy=false;S.error="";S.selected="";S.modal=null;S.revision=0;S.lastLoad=0;}
  window.RoqueAreas={render,reset};
})();