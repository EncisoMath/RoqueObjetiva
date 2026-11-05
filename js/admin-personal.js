/* RoqueObjetiva v175.54 | Personal Docente
   Admin solamente: identidad, carga academica, direccion de grupo y coordinador. */
(() => {
  "use strict";
  const S = {
    loaded:false,loading:false,busy:false,error:"",items:[],
    selected:"",view:"list",tab:"gestion",search:"",sede:"all",rol:"all",
    editor:"",expanded:""
  };
  let ctx = null;
  const $ = (sel,root=document) => root.querySelector(sel);
  const e = (s) => String(s??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;");
  const norm = (s) => String(s??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
  const current = () => S.items.find(t=>t.id===S.selected);
  const assignments = t => Array.isArray(t?.cargas)?t.cargas:[];
  const getSites = () => [...new Set([...(ctx?.sites||[]),...S.items.map(t=>t.sede),...S.items.flatMap(t=>assignments(t).map(c=>c.sede))].filter(Boolean))].sort((a,b)=>a.localeCompare(b,"es"));
  const getGrades = () => [...new Set([...(ctx?.grades||[]),...S.items.flatMap(t=>assignments(t).map(c=>c.grado))].map(Number).filter(Boolean))].sort((a,b)=>a-b);
  const getSubjects = () => [...new Set([...(ctx?.subjects||[]),...S.items.flatMap(t=>assignments(t).map(c=>c.asignatura))].filter(Boolean))].sort((a,b)=>a.localeCompare(b,"es"));
  const options = (values,selected,placeholder="Selecciona") =>
    '<option value="">'+e(placeholder)+'</option>'+values.map(v=>'<option value="'+e(v)+'"'+(String(v)===String(selected)?" selected":"")+'>'+e(v)+'</option>').join("");
  // Iniciales de primer nombre y primer apellido.
  const initials = name => {
    const words=String(name||"").trim().split(/\s+/).filter(Boolean);
    const first=words[0]?.charAt(0)||"D";
    const surname=words.length>=3?words[2]:words[1]||words[0]||"";
    return (first+(surname.charAt(0)||"")).toLocaleUpperCase("es");
  };
  const svgIcon = type => {
    const paths={
      gestion:'<path d="M4 7h16M4 17h16M9 4v6M15 14v6"/><circle cx="9" cy="7" r="2"/><circle cx="15" cy="17" r="2"/>',
      carga:'<path d="M12 7.5c-2-2-4.5-2.7-9-2.5v14c4.7-.2 7 .6 9 2 2-1.4 4.3-2.2 9-2V5c-4.5-.2-7 .5-9 2.5ZM12 7.5V21"/>',
      direccion:'<path d="M16 20v-2c0-1.7-1.6-3-4-3H6c-2.4 0-4 1.3-4 3v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM19 20v-2c0-1.5-1-2.5-2.5-2.9M17 3.2a4 4 0 0 1 0 7.6"/>',
      perfil:'<circle cx="12" cy="8" r="4"/><path d="M4 21v-2c0-3 3-5 8-5s8 2 8 5v2"/>'
    };
    return '<svg class="rp-ui-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round">'+(paths[type]||paths.perfil)+'</svg>';
  };
  const subjectImage = subject => {
    const n=norm(subject);
    let file="";
    if(/matemat|aritmet|estadist|algebra|geometr|trigonom|calculo|probabil/.test(n))file="matematicas.png";
    else if(/educacion fisica|deporte|recreacion/.test(n))file="educacion-fisica.png";
    else if(/natural|biolog|quimic|fisica|ambiental/.test(n))file="ciencias-naturales.png";
    else if(/social|historia|geografia|ciudadania|politic/.test(n))file="ciencias-sociales-y-ciudadania.png";
    else if(/informat|tecnolog|sistem|comput/.test(n))file="informatica.png";
    else if(/ingles|english/.test(n))file="ingles.png";
    else if(/lenguaje|humanidad|espanol|castellano|lectura|literatura/.test(n))file="lenguaje.png";
    else if(/etica|valores|convivencia|filosofi/.test(n))file="etica-y-valores.png";
    else if(/artist|musica|danza|dibujo|arte/.test(n))file="artistica.png";
    else if(/religion|espiritual/.test(n))file="religion.png";
    return file
      ? '<img class="rp-subject-image" src="ICONOS/'+file+'" alt="" width="30" height="30" loading="eager" decoding="async">'
      : '<span class="rp-subject-glyph" aria-hidden="true">✦</span>';
  };
  const palette = name => {
    const n=norm(name);
    if(/matemat|aritmet|estadist|algebra|geometr|trigonom|calculo|probabil/.test(n))return "math";
    if(/natural|biolog|quimic|fisica/.test(n)&&!/educacion fisica/.test(n))return "science";
    if(/informat|tecnolog|sistem|comput/.test(n))return "tech";
    if(/educacion fisica|deporte|recreacion/.test(n))return "sport";
    return "other";
  };
  const overview = t => {
    const groups=new Set(assignments(t).map(c=>c.asignatura));
    const dir=t.direccion;
    return '<div class="rp-mini-meta"><span>▤ '+groups.size+' asignaturas</span><span>♧ Dir. grupo: '+(dir?.grado?e(dir.grado+'°-'+(dir.curso||'')):"—")+'</span></div>';
  };
  const sidebarList = () => {
    let rows=S.items.filter(t=>(S.sede==="all"||t.sede===S.sede) &&
      (S.rol==="all"||(S.rol==="coordinador"?t.coordinador:!t.coordinador)) &&
      (!S.search||norm(t.nombre+" "+t.id).includes(norm(S.search))));
    const total=rows.length;
    return '<div class="rp-list-head"><strong>♟ '+total+' docentes</strong>'+
      '<button type="button" class="rp-new" data-rp-action="new">＋ Nuevo docente</button></div>'+
      '<div class="rp-roster">'+(rows.map(t=>'<button type="button" class="rp-person'+(S.selected===t.id&&S.view==="detail"?" is-current":"")+'" data-rp-action="select" data-id="'+e(t.id)+'">'+
        '<span class="rp-avatar" aria-hidden="true">♙</span><span class="rp-person-info"><span class="rp-person-name">'+e(t.nombre)+'</span>'+
        '<span class="rp-person-id">ID '+e(t.id)+(t.activo===false?' · Inactivo':'')+'</span>'+overview(t)+'</span>'+
        (t.coordinador?'<span class="rp-role-tag">Coordinador</span>':'')+
        '<span class="rp-chevron" aria-hidden="true">›</span></button>').join("")+
        '<p class="rp-empty">No hay docentes con esos filtros.</p>'.repeat(total===0))+
      '</div>';
  };
  const rosterView=()=>'<div class="rp-roster-view">'+
    '<header class="rp-title-strip"><span class="rp-head-icon">♟</span><div><h2>Personal Docente</h2>'+
    '<p>Gestiona docentes, cargas, direcciones y roles.</p></div></header>'+
    '<label class="rp-search"><span class="rp-sr">Buscar docente</span><input type="search" id="rp-search" value="'+e(S.search)+'" placeholder="⌕  Buscar por nombre o identificación" autocomplete="off"></label>'+
    '<div class="rp-filter-row"><label><span>Sede</span><select id="rp-site-filter"><option value="all">Todas</option>'+
      getSites().map(s=>'<option value="'+e(s)+'"'+(S.sede===s?" selected":"")+'>'+e(s)+'</option>').join("")+'</select></label>'+
    '<label><span>Rol</span><select id="rp-role-filter"><option value="all">Todos</option>'+
    '<option value="docente"'+(S.rol==="docente"?" selected":"")+'>Docente</option>'+
    '<option value="coordinador"'+(S.rol==="coordinador"?" selected":"")+'>Coordinador</option></select></label></div>'+
    '<div id="rp-list-wrap">'+sidebarList()+'</div></div>';
  const teacherHead=t=>'<div class="rp-teacher-head">'+
    '<span class="rp-big-avatar">♙</span><div class="rp-teacher-summary"><strong>'+e(t.nombre)+'</strong>'+
    '<small>ID '+e(t.id)+'</small>'+overview(t)+'</div>'+
    (t.coordinador?'<span class="rp-role-tag">Coordinador</span>':'')+'</div>';
  const tabs=()=>'<nav class="rp-tabs" aria-label="Personal docente">'+
    [["gestion","☷","Gestión"],["carga","▣","Carga académica"],["direccion","♧","Dirección de grupo"]]
      .map(([value,ico,label])=>'<button type="button" class="'+(S.tab===value?"active":"")+
      '" data-rp-action="tab" data-tab="'+value+'"><span>'+ico+'</span>'+label+'</button>').join("")+'</nav>';
  const management=t=>'<div class="rp-manage">'+
    '<section class="rp-section"><h3>♢ Rol y permisos</h3>'+
    '<div class="rp-permissions"><label><span>Rol</span><select disabled><option>Docente</option></select></label>'+
    '<label class="rp-toggle-field"><span>¿Es coordinador?</span><input type="checkbox" data-rp-role="coord"'+(t.coordinador?" checked":"")+
    (S.busy?" disabled":"")+'><span class="rp-toggle-ui"></span></label></div></section>'+
    '<section class="rp-section"><div class="rp-section-title"><h3>♙ Información docente</h3>'+
    '<button class="rp-edit-icon" type="button" data-rp-action="toggle-edit">✎</button></div>'+
    '<form data-rp-form="identity" class="rp-form">'+
      '<label><span>Nombre</span><input name="nombre" required maxlength="160" value="'+e(t.nombre)+'"'+(S.editor==="identity"?"":" readonly")+'></label>'+
      '<label><span>Identificación</span><input value="'+e(t.id)+'" readonly title="La identificación es la clave institucional de acceso."></label>'+
      '<label><span>Sede</span><select name="sede"'+(S.editor==="identity"?"":" disabled")+'>'+
        options(getSites(),t.sede,"Sin sede asignada")+'</select></label>'+
      (S.editor==="identity"?'<button class="rp-primary" type="submit">Guardar información</button>':'')+
    '</form></section>'+
    '<section class="rp-section"><h3>▤ Resumen de asignaciones</h3><div class="rp-summary-grid">'+
    '<div><span>▣</span><strong>'+new Set(assignments(t).map(c=>c.asignatura)).size+'</strong><small>Asignaturas</small></div>'+
    '<div><span>♧</span><strong>'+(t.direccion?.grado?"1":"0")+'</strong><small>Dirección de grupo</small></div>'+
    '</div></section>'+
    '<div class="rp-danger-action"><button type="button" data-rp-action="toggle-active">'+
      (t.activo===false?"Reactivar docente":"Desactivar docente")+'</button></div>'+
    '</div>';
  const gradeChips = entries => [...new Set(entries.map(c=>String(c.grado)+"°"))].sort((a,b)=>parseInt(a)-parseInt(b)).map(x=>'<span class="rp-grade-chip">'+e(x)+'</span>').join("");
  const groupedAssignments=t=>{
    const group=new Map();
    for(const c of assignments(t)) {if(!group.has(c.asignatura))group.set(c.asignatura,[]);group.get(c.asignatura).push(c);}
    return [...group].sort((a,b)=>a[0].localeCompare(b[0],"es")).map(([subject,records])=>{
      const opened=S.expanded===subject;
      return '<article class="rp-assignment-card"><div class="rp-assignment-top">'+
        '<span class="rp-subject-icon '+palette(subject)+'">'+e(icon(subject))+'</span>'+
        '<div class="rp-subject-copy"><strong>'+e(subject)+'</strong><small>'+records.length+' '+(records.length===1?"curso":"cursos")+'</small></div>'+
        '<div class="rp-grade-chips">'+gradeChips(records)+'</div>'+
        '<button type="button" class="rp-dots" aria-expanded="'+opened+'" data-rp-action="expand" data-subject="'+e(subject)+'">⋮</button></div>'+
        (opened?'<div class="rp-assignment-details">'+records.map(c=>'<div><span>'+e(c.grado)+'° · '+e(c.curso)+' · '+e(c.sede)+'</span>'+
          '<button type="button" data-rp-action="remove-load" data-load="'+e(c.id)+'">Quitar</button></div>').join("")+'</div>':'')+
        '</article>';
    }).join("");
  };
  const courseOptions = (site,grade,selected="")=>{
    const courses=(ctx?.courses||[]).filter(c=>(!site||c.sede===site)&&(!grade||Number(c.grado)===Number(grade))).map(c=>c.curso);
    const vals=[...new Set([selected,...courses].filter(Boolean))].sort((a,b)=>a.localeCompare(b,"es",{numeric:true}));
    return options(vals,selected,"Selecciona curso");
  };
  const assignmentForm=()=>{
    const sites=getSites(),grades=getGrades();
    return '<form data-rp-form="load" class="rp-add-form"><h4>Asignar carga académica</h4>'+
      '<label><span>Asignatura</span><select name="asignatura" required>'+options(getSubjects(),"","Selecciona asignatura")+'</select></label>'+
      '<div class="rp-duo"><label><span>Sede</span><select name="sede" data-rp-dependency="load" required>'+options(sites,"","Selecciona sede")+'</select></label>'+
      '<label><span>Grado</span><select name="grado" data-rp-dependency="load" required>'+options(grades,"","Selecciona grado")+'</select></label></div>'+
      '<label><span>Curso</span><select name="curso" data-rp-course required>'+courseOptions("","","")+'</select></label>'+
      '<div class="rp-form-actions"><button type="button" data-rp-action="close-editor">Cancelar</button><button type="submit" class="rp-primary">Guardar asignación</button></div></form>';
  };
  const loadView=t=>'<section class="rp-section rp-screen-card"><div class="rp-feature-heading">'+
    '<h3>▣ Carga académica</h3><button type="button" class="rp-assign" data-rp-action="assign-load">＋ Asignar</button></div>'+
    (S.editor==="load"?assignmentForm():"")+
    '<div class="rp-assignments">'+(groupedAssignments(t)||'<p class="rp-empty">Este docente aún no tiene asignaturas.</p>')+'</div>'+
    '</section>';
  const directionForm=t=>{
    const d=t.direccion||{};
    return '<form data-rp-form="direction" class="rp-add-form">'+
    '<h4>'+(d.grado?"Cambiar dirección de grupo":"Asignar dirección de grupo")+'</h4>'+
    '<label><span>Sede</span><select name="sede" data-rp-dependency="direction" required>'+
      options(getSites(),d.sede||t.sede,"Selecciona sede")+'</select></label>'+
    '<div class="rp-duo"><label><span>Grado</span><select name="grado" data-rp-dependency="direction" required>'+
      options(getGrades(),d.grado||"","Selecciona grado")+'</select></label>'+
    '<label><span>Curso</span><select name="curso" data-rp-course required>'+
      courseOptions(d.sede||t.sede,d.grado,d.curso||"")+'</select></label></div>'+
    '<div class="rp-form-actions"><button type="button" data-rp-action="close-editor">Cancelar</button>'+
    '<button type="submit" class="rp-primary">Guardar dirección</button></div></form>';
  };
  const directionView=t=>{
    const d=t.direccion;
    return '<section class="rp-section rp-screen-card"><div class="rp-feature-heading"><h3>♧ Dirección de grupo</h3>'+
      '<button type="button" class="rp-assign" data-rp-action="assign-direction">＋ Asignar</button></div>'+
      (S.editor==="direction"?directionForm(t):"")+
      (d?.grado?'<div class="rp-director-card"><span class="rp-director-grade">'+e(d.grado)+'°-'+e(d.curso)+'</span>'+
        '<div><strong>Dirección de grupo actual</strong><small>Sede '+e(d.sede||"—")+'</small></div>'+
        '<button class="rp-dots" type="button" data-rp-action="remove-direction" aria-label="Retirar dirección">⋮</button></div>':
        '<p class="rp-empty">Este docente no tiene dirección de grupo asignada.</p>')+
      '</section><p class="rp-info">ⓘ Puedes asignar, cambiar o retirar la dirección de grupo de este docente.</p>';
  };
  const detailView=()=>{
    if(S.selected==="__new")return newTeacherView();
    const t=current();if(!t){S.view="list";return rosterView();}
    return '<div class="rp-detail-view">'+
      '<button type="button" class="rp-back" data-rp-action="back">‹ Volver a docentes</button>'+
      teacherHead(t)+tabs()+
      (S.tab==="gestion"?management(t):S.tab==="carga"?loadView(t):directionView(t))+
      '</div>';
  };
  const newTeacherView=()=>'<div class="rp-detail-view"><button class="rp-back" type="button" data-rp-action="back">‹ Volver a docentes</button>'+
    '<section class="rp-section rp-new-panel"><h2>＋ Nuevo docente</h2><p>Registra al docente antes de asignarle cursos o direcciones.</p>'+
    '<form data-rp-form="new"><label><span>Nombre completo</span><input name="nombre" required maxlength="160" placeholder="Nombres y apellidos"></label>'+
    '<label><span>Identificación</span><input name="id" required maxlength="40" placeholder="Número de documento"></label>'+
    '<label><span>Sede</span><select name="sede">'+options(getSites(),"","Selecciona sede")+'</select></label>'+
    '<label class="rp-check"><input type="checkbox" name="coordinador"> Es coordinador</label>'+
    '<button class="rp-primary" type="submit">Crear docente</button></form></section></div>';
  const view=()=>{
    if(S.loading&&!S.loaded)return '<div class="rp-loading">Consultando personal docente en Supabase…</div>';
    if(S.error&&!S.loaded)return '<div class="rp-error">'+e(S.error)+'<button type="button" data-rp-action="reload">Reintentar</button></div>';
    return '<div class="rp-layout"><div class="rp-list-pane '+(S.view==="detail"?"rp-list-hidden":"")+'">'+rosterView()+'</div>'+
      '<div class="rp-detail-pane '+(S.view==="detail"?"rp-detail-visible":"")+'">'+
        (S.view==="detail"?detailView():'<div class="rp-desktop-placeholder">Selecciona un docente para gestionar sus datos y asignaciones.</div>')+
      '</div></div>';
  };
  const draw=()=>requestAnimationFrame(()=>{
    const root=document.getElementById("roque-personal");
    if(root)root.innerHTML=view();
  });
  async function reload(){
    if(!ctx?.rpc||S.loading)return;
    S.loading=true;S.error="";
    try{
      const p=await ctx.rpc("roque_v9_admin_personal_listar",{});
      if(!p?.ok||!Array.isArray(p.docentes))throw Error(p?.error||"No se pudo cargar personal docente.");
      S.items=p.docentes;S.loaded=true;
    }catch(err){S.error=String(err?.message||err);ctx?.notify?.(S.error);}
    finally{S.loading=false;draw();}
  }
  function render(context) {
    if(context)ctx=context;
    if(!S.loaded&&!S.loading)void reload();
    return '<div id="roque-personal" class="rp-root">'+view()+'</div>';
  }
  async function save(op,payload){
    if(S.busy||!ctx?.rpc)return false;
    S.busy=true;
    try{
      const p=await ctx.rpc("roque_v9_admin_personal_guardar",{p_operacion:op,p_datos:payload});
      if(!p?.ok)throw Error(p?.error||"No se guardaron los cambios.");
      await reload();
      ctx.notify?.("Cambios guardados correctamente.");
      return true;
    }catch(err){ctx.notify?.(String(err?.message||err));return false;}
    finally{S.busy=false;}
  }
  document.addEventListener("click",async event=>{
    const b=event.target.closest("[data-rp-action]");
    if(!b||!document.getElementById("roque-personal"))return;
    const a=b.dataset.rpAction;
    if(a==="back"){S.view="list";S.editor="";draw();return;}
    if(a==="new"){S.selected="__new";S.view="detail";S.editor="";draw();return;}
    if(a==="select"){S.selected=b.dataset.id;S.tab="gestion";S.editor="";S.expanded="";S.view="detail";draw();return;}
    if(a==="tab"){S.tab=b.dataset.tab;S.editor="";draw();return;}
    if(a==="toggle-edit"){S.editor=S.editor==="identity"?"":"identity";draw();return;}
    if(a==="close-editor"){S.editor="";draw();return;}
    if(a==="assign-load"){S.editor=S.editor==="load"?"":"load";draw();return;}
    if(a==="assign-direction"){S.editor=S.editor==="direction"?"":"direction";draw();return;}
    if(a==="expand"){S.expanded=S.expanded===b.dataset.subject?"":b.dataset.subject;draw();return;}
    if(a==="reload"){void reload();return;}
    const t=current();
    if(!t||S.busy)return;
    if(a==="remove-load"){
      if(!window.confirm("¿Retirar esta asignación de carga académica?"))return;
      await save("carga_quitar",{id:t.id,carga_id:Number(b.dataset.load)});
      return;
    }
    if(a==="remove-direction"){
      if(!window.confirm("¿Retirar la dirección de grupo actual?"))return;
      await save("direccion",{id:t.id,grado:null,sede:"",curso:""});
      return;
    }
    if(a==="toggle-active"){
      const willBeActive=t.activo===false;
      if(!window.confirm(willBeActive?"¿Reactivar este docente?":"¿Desactivar este docente y su acceso?"))return;
      await save("actualizar",{id:t.id,nombre:t.nombre,activo:willBeActive});
    }
  });
  document.addEventListener("input",event=>{
    if(event.target.id!=="rp-search"||!document.getElementById("roque-personal"))return;
    S.search=event.target.value;
    const wrap=document.getElementById("rp-list-wrap");
    if(wrap)wrap.innerHTML=sidebarList();
  });
  document.addEventListener("change",async event=>{
    const el=event.target;
    if(!document.getElementById("roque-personal"))return;
    if(el.id==="rp-site-filter"){S.sede=el.value;const x=$("#rp-list-wrap");if(x)x.innerHTML=sidebarList();return;}
    if(el.id==="rp-role-filter"){S.rol=el.value;const x=$("#rp-list-wrap");if(x)x.innerHTML=sidebarList();return;}
    if(el.dataset.rpDependency){
      const form=el.closest("form");
      const site=form?.querySelector('[name="sede"]')?.value||"";
      const grade=form?.querySelector('[name="grado"]')?.value||"";
      const course=form?.querySelector('[name="curso"]');
      if(course)course.innerHTML=courseOptions(site,grade);
      return;
    }
    if(el.dataset.rpRole==="coord"){
      const t=current();
      if(!t||S.busy)return;
      const ok=await save("actualizar",{id:t.id,nombre:t.nombre,coordinador:el.checked});
      if(!ok){el.checked=t.coordinador;}
    }
  });
  document.addEventListener("submit",async event=>{
    const form=event.target.closest("[data-rp-form]");
    if(!form||!document.getElementById("roque-personal"))return;
    event.preventDefault();
    if(S.busy)return;
    const data=Object.fromEntries(new FormData(form).entries());
    const t=current();
    const button=form.querySelector('[type="submit"]');
    if(button){button.disabled=true;button.textContent="Guardando…";}
    let success=false;
    if(form.dataset.rpForm==="new"){
      success=await save("crear",{id:String(data.id||"").trim(),nombre:data.nombre,sede:data.sede,coordinador:!!data.coordinador});
      if(success){S.selected=String(data.id||"").trim();S.view="detail";S.tab="gestion";}
    }else if(t&&form.dataset.rpForm==="identity"){
      success=await save("actualizar",{id:t.id,nombre:data.nombre,sede:data.sede});
    }else if(t&&form.dataset.rpForm==="load"){
      success=await save("carga_guardar",{id:t.id,asignatura:data.asignatura,sede:data.sede,grado:Number(data.grado),curso:data.curso});
    }else if(t&&form.dataset.rpForm==="direction"){
      success=await save("direccion",{id:t.id,sede:data.sede,grado:Number(data.grado),curso:data.curso});
    }
    if(success){S.editor="";draw();}
    else if(button){button.disabled=false;button.textContent="Volver a intentar";}
  });
  window.RoquePersonal={render,reset:()=>{S.loaded=false;S.loading=false;S.items=[];S.selected="";S.view="list";S.tab="gestion";}};
})();
