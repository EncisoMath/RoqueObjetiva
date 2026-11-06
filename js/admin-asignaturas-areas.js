/* RoqueObjetiva v175.88 · Asignaturas y áreas, datos 100% de Supabase. */
(() => {
  "use strict";
  const S={areas:[],subjects:[],loaded:false,loading:false,busy:false,error:"",selected:"",modal:null,revision:0,lastLoad:0};
  let ctx=null, owner="";
  const esc=value=>String(value??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;");
  const norm=value=>String(value??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").trim().replace(/\s+/g," ").toLowerCase();
  const collate=(a,b)=>String(a).localeCompare(String(b),"es",{sensitivity:"base"});
  // Sólo presentación: no cambiar los nombres ni las claves almacenadas en Supabase.
  const displayArea=value=>String(value??"").toLocaleLowerCase("es")
    .replace(/(^|[\s-])([\p{L}])/gu,(_,sep,letter)=>sep+letter.toLocaleUpperCase("es"));
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
  const areaHead=(a)=>'<span class="ra-area-tile">'+picture(a.nombre)+'</span>';
  const plural=n=>n===1?"1 asignatura":n+" asignaturas";
  // Hero interno compartido, sin alterar el hero temático del detalle de área.
  const header=()=>window.RoqueScreenHero.render({
    title:"Asignaturas y áreas",
    subtitle:"Organiza las áreas y las asignaturas que pertenecen a cada una.",
    icon:"layers",
    heading:"h2"
  });
  const list=()=>header()+'<section class="ra-list" aria-label="Áreas académicas">'+
    S.areas.map(a=>'<button class="ra-area-row" type="button" data-ra-action="open" data-area="'+esc(a.nombre)+'">'+
      areaHead(a)+'<span class="ra-area-text"><span class="ra-area-name">'+esc(displayArea(a.nombre))+'</span><small>'+plural(allSubjects(a.nombre).length)+'</small></span>'+
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
  const linkedRow=(s,area)=>'<div class="ra-subject-linked"><span class="ra-linked-icon" style="--ra-accent:'+accent(area)+'">'+picture(area)+'</span>'+
    '<span class="ra-linked-name">'+esc(s.nombre)+'</span><button type="button" class="ra-remove" data-ra-action="remove" data-subject="'+esc(s.nombre)+'" '+
    'aria-label="Quitar '+esc(s.nombre)+' de esta área" title="Quitar asignatura de esta área">'+
    icon("trash",20)+'</button></div>';
  const addLaunch=()=>'<button type="button" class="ra-add-launch" data-ra-action="choose-add">'+
    '<span class="ra-add-launch-icon">'+icon("plus",21)+'</span><span>Agregar asignaturas a esta área</span>'+
    '<span class="ra-add-launch-arrow">'+icon("next",18)+'</span></button>';
  const detail=()=>{
    const a=current();if(!a)return list();
    const linked=allSubjects(a.nombre);
    return '<div class="ra-detail">'+
      '<button class="ra-back" data-ra-action="back" type="button">'+icon("back",24)+'<span>Asignaturas y áreas</span></button>'+
      '<header class="ra-hero" style="--ra-accent:'+accent(a.nombre)+'">'+
        '<span class="ra-hero-icon">'+picture(a.nombre)+'</span><span class="ra-hero-line"></span>'+
        '<div class="ra-hero-info"><h2>'+esc(displayArea(a.nombre))+'</h2><p>'+plural(linked.length)+'</p></div>'+
        '<span class="ra-hero-art" aria-hidden="true">'+icon("layers",65)+'</span>'+
      '</header>'+meta(a)+
      '<section class="ra-panel"><div class="ra-section-title">'+icon("book",23)+'<h3>Asignaturas de esta área</h3></div>'+
      '<div class="ra-subject-items">'+(linked.length?linked.map(s=>linkedRow(s,a.nombre)).join(""):'<div class="ra-empty">Esta área aún no tiene asignaturas vinculadas.</div>')+'</div></section>'+
      addLaunch()+'</div>';
  };
  const modal=()=>{
    if(!S.modal)return "";
    const a=current();if(!a)return "";
    const m=S.modal,subject=m.subject||"";
    let title="",body="",footer="";
    if(m.kind==="add"){
      title="Agregar asignaturas";
      const libres=freeSubjects();
      body='<p class="ra-modal-intro">Selecciona las asignaturas que deseas vincular a <strong>'+esc(a.nombre)+'</strong>.</p>'+
        '<div class="ra-choice-list" role="group" aria-label="Asignaturas sin área" tabindex="0">'+
        (libres.length?libres.map(s=>{
          const checked=(m.selected||[]).some(name=>norm(name)===norm(s.nombre));
          return '<label class="ra-choice'+(checked?" is-checked":"")+'">'+
            '<input type="checkbox" data-ra-choice="'+esc(s.nombre)+'" value="'+esc(s.nombre)+'" '+(checked?'checked ':'')+(S.busy?'disabled ':'')+'>'+
            '<span class="ra-choice-name">'+esc(s.nombre)+'</span>'+
            '<span class="ra-choice-tick" aria-hidden="true">'+icon("check",17)+'</span></label>';
        }).join(""):'<p class="ra-empty">No hay asignaturas libres disponibles.</p>')+'</div>'+
        (m.error?'<p class="ra-modal-error" role="alert">'+esc(m.error)+'</p>':'');
      const selected=(m.selected||[]).length;
      footer='<button type="button" class="ra-primary ra-confirm-add" data-ra-action="confirm-add" '+(selected===0||S.busy?'disabled':'')+'>'+
        icon("plus",17)+'<span>Agregar al área'+(selected?' ('+selected+')':'')+'</span></button>';
    }else if(m.kind==="unlink"){
      const assigned=Boolean(findSubject(subject)?.en_carga);
      const evaluated=Boolean(findSubject(subject)?.en_items||findSubject(subject)?.en_claves);
      title="Quitar asignatura del área";
      body='<p>¿Quieres quitar <strong>'+esc(subject)+'</strong> de <strong>'+esc(a.nombre)+'</strong>?</p>'+
        '<div class="ra-warning">'+icon("alert",20)+'<span>Se desactivará únicamente la relación entre asignatura y área. La asignatura quedará disponible para vincularla a otra área. Las cargas docentes, claves, notas y resultados se conservarán.</span></div>'+
        (assigned||evaluated?'<p class="ra-impact-note">Esta asignatura tiene registros académicos vinculados. Quitar su área puede modificar cómo se agrupa en algunas vistas; los registros existentes permanecerán intactos.</p>':'')+
        (m.error?'<p class="ra-modal-error" role="alert">'+esc(m.error)+'</p>':'');
      footer='<button type="button" class="ra-danger" data-ra-action="confirm-unlink" '+(S.busy?'disabled':'')+'>'+
        icon("trash",17)+'Quitar del área</button>';
    }
    return '<div class="ra-shade" data-ra-action="dismiss-outside"><div role="dialog" aria-modal="true" aria-labelledby="ra-dialog-title" class="ra-dialog">'+
      '<header><h3 id="ra-dialog-title">'+esc(title)+'</h3><button type="button" data-ra-action="close" class="ra-modal-x" aria-label="Cerrar" '+(S.busy?'disabled':'')+'>'+icon("close",20)+'</button></header>'+
      '<div class="ra-dialog-body">'+body+'</div>'+
      '<footer><button type="button" data-ra-action="close" class="ra-secondary" '+(S.busy?'disabled':'')+'>Cancelar</button>'+footer+'</footer></div></div>';
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
  const showModal=(kind,subject="")=>{
    S.modal={kind,subject,selected:[],error:""};draw();
    requestAnimationFrame(()=>scope()?.querySelector(".ra-dialog input, .ra-dialog .ra-modal-x")?.focus({preventScroll:true}));
  };
  const closeModal=()=>{S.modal=null;draw();};
  async function commitRpc(name,payload,successText){
    if(S.busy||!S.selected||!ctx?.rpc)return;
    S.busy=true;const actor=owner;
    draw();
    try{
      const result=await ctx.rpc(name,payload);
      if(!result?.ok)throw Error(result?.error||"No se guardaron los cambios.");
      if(actor!==owner)return;
      S.busy=false;S.modal=null;
      const updated=await reload(false);
      if(!updated)S.error="El cambio se guardó, pero falló la actualización del catálogo. Presiona Reintentar.";
      ctx?.notify?.(successText||"Cambios guardados en Supabase.");
    }catch(err){
      if(actor===owner){
        const message=String(err?.message||err);
        if(S.modal)S.modal.error=message;else S.error=message;
        ctx?.notify?.(message);
      }
    }finally{if(actor===owner){S.busy=false;draw();}}
  }
  const saveUnlink=(subject)=>commitRpc("roque_v16_areas_guardar",{
    p_operacion:"desvincular",p_area:S.selected,p_asignatura:subject
  },"Asignatura desvinculada. El resto de los registros permanecen intactos.");
  const saveSelected=()=> {
    const selected=(S.modal?.selected||[]).slice();
    if(!selected.length)return;
    return commitRpc("roque_v17_areas_vincular_lote",{
      p_area:S.selected,p_asignaturas:selected
    },selected.length===1?"Asignatura agregada al área.":selected.length+" asignaturas agregadas al área.");
  };
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
    if(action==="choose-add"){showModal("add");return;}
    if(action==="remove"){
      const s=findSubject(b.dataset.subject);
      if(s&&norm(s.area)===norm(S.selected))showModal("unlink",s.nombre);
      return;
    }
    if(action==="confirm-unlink"&&S.modal?.kind==="unlink"){void saveUnlink(S.modal.subject);return;}
    if(action==="confirm-add"&&S.modal?.kind==="add"){void saveSelected();return;}
  });
  document.addEventListener("change",event=>{
    const control=event.target;
    if(!control?.matches?.("[data-ra-choice]")||!scope()?.contains(control)||S.busy||S.modal?.kind!=="add")return;
    const name=control.dataset.raChoice,subject=freeSubjects().find(x=>norm(x.nombre)===norm(name));
    if(!subject)return;
    const selection=new Set(S.modal.selected||[]);
    if(control.checked)selection.add(subject.nombre);else selection.delete(subject.nombre);
    S.modal.selected=[...selection];
    control.closest(".ra-choice")?.classList.toggle("is-checked",control.checked);
    const button=scope()?.querySelector(".ra-confirm-add");
    if(button){
      button.disabled=selection.size===0;
      const label=button.querySelector("span");
      if(label)label.textContent="Agregar al área"+(selection.size?" ("+selection.size+")":"");
    }
  });
  document.addEventListener("keydown",event=>{
    if(event.key==="Escape"&&S.modal&&scope()&&!S.busy){event.stopPropagation();closeModal();}
  });
  function reset(next=""){owner=next;ctx=null;S.areas=[];S.subjects=[];S.loaded=false;S.loading=false;S.busy=false;S.error="";S.selected="";S.modal=null;S.revision=0;S.lastLoad=0;}
  window.RoqueAreas={render,reset};
})();