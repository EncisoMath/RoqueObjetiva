(() => {
"use strict";
// Adaptador de datos, sin elementos visuales propios. Las pantallas y modales son los originales.
const CODE="2026-3E";
const AREAS=["Matemáticas","Lenguaje","Ciencias Naturales","Ciencias Sociales y Ciudadanía","Inglés"];
let source=null,students=[],questions=[],byExam=new Map(),byDocument=new Map();
const trim=x=>String(x??"").trim();
const lower=x=>trim(x).toLocaleLowerCase("es").normalize("NFD").replace(/[\u0300-\u036f]/g,"");
const unique=a=>[...new Set(a.filter(x=>x!==null&&x!==undefined&&String(x)!==""))];
const avg=a=>a.length?Math.round(a.reduce((s,x)=>s+Number(x||0),0)*10/a.length)/10:null;
const pct=(a,n)=>n?Math.round(a*1000/n)/10:0;
const name=x=>trim([x.nombres,x.apellidos].filter(Boolean).join(" "))||trim(x.nombre);
const course=x=>trim(x.curso);
const grade=x=>Number(x.grado)||10;
const site=x=>trim(x.sede);
const score=(x,i)=>Number(x.areas[i]);
const ans=(s,i)=>trim(s.respuestas[i]).toUpperCase();
const yes=(s,q,i)=>ans(s,i)===trim(q.key).toUpperCase();
const official=s=>({global:Number(s.global),areas:s.areas.map(Number),
 puesto_grado:Number(s.puesto_grado),puesto_curso:Number(s.puesto_curso),puesto_areas:s.puesto_areas||[]});
const clean=()=>{source=null;students=[];questions=[];byExam=new Map();byDocument=new Map();};
function prepare(payload){
 clean();
 if(!payload?.ok || payload.edicion!==CODE || payload.solo_lectura!==true ||
  payload.session?.role!=="teacher" || !Array.isArray(payload.alumnos) ||
  (payload.alumnos.length<1 || payload.alumnos.length>107) || !Array.isArray(payload.preguntas) || payload.preguntas.length!==254){
  throw new Error("El servidor no autorizó una carga diagnóstica completa.");
 }
 const questionsChecked=payload.preguntas.map((q,i)=>{
  const a=Number(q.area);
  if(!Number.isInteger(a)||a<0||a>4||!(/^[A-H]$/i.test(trim(q.key))))throw new Error("Clave inválida en pregunta "+(i+1));
  return {...q,area:a,index:i+1};
 });
 const rows=payload.alumnos.map(r=>{
  if(!r||!trim(r.documento)||!trim(r.id_prueba)||!Array.isArray(r.areas)||r.areas.length!==5||
    !Array.isArray(r.respuestas)||r.respuestas.length!==254)throw new Error("Registro diagnóstico incompleto.");
  const x={...r,global:Number(r.global),areas:r.areas.map(Number)};
  const weighted=3*(x.areas[0]+x.areas[1]+x.areas[2]+x.areas[3])+x.areas[4];
  if(x.areas.some(z=>!Number.isInteger(z)||z<0||z>100) || x.global!==Math.round(weighted*5/13))
    throw new Error("Puntaje oficial inconsistente para "+trim(x.id_prueba));
  return x;
 });
 if(unique(rows.map(r=>trim(r.id_prueba))).length!==rows.length||unique(rows.map(r=>trim(r.documento))).length!==rows.length)
  throw new Error("Identificadores diagnósticos duplicados.");
 source=payload;students=rows;questions=questionsChecked;
 byExam=new Map(students.map(r=>[trim(r.id_prueba),r]));
 byDocument=new Map(students.map(r=>[trim(r.documento),r]));
 return {ok:true,total:students.length,items:questions.length};
}
const ready=()=>!!source;
const catalogEntry=()=>({
 codigo:CODE,titulo:"Prueba Diagnóstica 3E · 2026-2S",
 anio:2026,semestre:1.5,estado:"publicada",resultados_visibles:true,solo_lectura:true
});
// Carga efectiva suministrada por Supabase: nunca inventar áreas ni cursos.
function assignments(){
 if(!ready())return [];
 const permitted=new Set(students.map(x=>JSON.stringify([site(x),course(x)])));
 const seen=new Set();
 return (Array.isArray(source.datasets?.carga)?source.datasets.carga:[])
  .filter(c=>trim(c.ID)===trim(source.session.id) && Number(c.GRADO)===10 &&
    AREAS.includes(trim(c.ASIGNATURA)) &&
    permitted.has(JSON.stringify([trim(c.SEDE),trim(c.CURSO)])))
  .filter(c=>{const key=JSON.stringify([trim(c.ASIGNATURA),trim(c.SEDE),trim(c.CURSO)]);
    if(seen.has(key))return false;seen.add(key);return true;});
}
const assignedAreas=()=>AREAS.filter(a=>assignments().some(c=>trim(c.ASIGNATURA)===a));
function dataset(){
 if(!ready())throw new Error("No hay datos diagnósticos autorizados.");
 if(!assignments().length)throw new Error("No hay áreas de 10° asignadas a este docente.");
 return {
  ok:true,edicion:CODE,session:{role:"teacher",id:source.session.id},
  origen_academico:"diagnostica_3t",resultados_revisados:students.length,
  datasets:{
   carga:assignments(),
   directoresGrupo:source.datasets?.directoresGrupo||[],
   docentes:source.datasets?.docentes||[],medidas:[],
   estudiantes:students.map(x=>({
    ID_ALUMNO:trim(x.documento),ID_PRUEBA:trim(x.id_prueba),
    NOMBRES:trim(x.nombres),APELLIDOS:trim(x.apellidos),NOMBRE_COMPLETO:name(x),
    SEDE:site(x),GRADO:"10",GRUPO:course(x)
   })),
   keys:[{grade:10,session:0,path:"DIAGNOSTICA_3E/CLAVES.json",
     rows:questions.map(q=>({
      "Grado":"10","Área":AREAS[q.area],"Número de ítem":String(q.index),
      "Respuesta sugerida":trim(q.key),"Componente / pensamiento / entorno / factor / enfoque":trim(q.comp),
      "Competencia":trim(q.compet)
     }))
   }],
   resultados:[{grade:10,session:0,startItem:1,path:"DIAGNOSTICA_3E/RESULTADOS.json",
     rows:students.map(x=>({
      "Roll No":trim(x.id_prueba),ID_ALUMNO:trim(x.documento),
      GRADO:"10",GRUPO:course(x),SEDE:site(x),
      respuestas:Object.fromEntries(x.respuestas.map((answer,i)=>[String(i+1),trim(answer)]))
     }))
   }]
  }
 };
}
function groupOf(studentsList,keyFn){const m=new Map();studentsList.forEach(v=>{const k=keyFn(v);if(!m.has(k))m.set(k,[]);m.get(k).push(v);});return m;}
function filters(){const sedes=unique(students.map(site)).sort((a,b)=>a.localeCompare(b,"es"));
const courses=unique(students.map(x=>JSON.stringify([grade(x),site(x),course(x)]))).map(v=>{const [g,s,c]=JSON.parse(v);return{grado:g,sede:s,curso:c};})
.sort((a,b)=>a.sede.localeCompare(b.sede,"es")||a.curso.localeCompare(b.curso,"es",{numeric:true}));
return{grados:[10],sedes,cursos:courses};}
function selectRows(p){return students.filter(x=>
(!p.p_grado||grade(x)===Number(p.p_grado))&&
(!p.p_sede||site(x)===trim(p.p_sede))&&
(!p.p_curso||course(x)===trim(p.p_curso))&&
(!p.p_grupo||course(x)===trim(p.p_grupo))
);}
function stats(p){
 const subset=selectRows(p),active=assignedAreas().filter(n=>!p.p_asignatura||trim(p.p_asignatura)===n);
 const selAreas=active.map(n=>AREAS.indexOf(n));
 const items=subset.flatMap(x=>selAreas.map(i=>({x,area:AREAS[i],score:score(x,i)})));
 const perStudent=subset.map(x=>avg(selAreas.map(i=>score(x,i)))).filter(v=>v!==null);
 const num=v=>perStudent.filter(v).length, count=perStudent.length;
 const distribution=[
  {id:"superior",nombre:"Superior (≥ 90)",cantidad:num(v=>v>=90)},
  {id:"alto",nombre:"Alto (80 – 89)",cantidad:num(v=>v>=80&&v<90)},
  {id:"basico",nombre:"Básico (60 – 79)",cantidad:num(v=>v>=60&&v<80)},
  {id:"bajo",nombre:"Bajo (< 60)",cantidad:num(v=>v<60)}
 ].map(x=>({...x,porcentaje:pct(x.cantidad,count)}));
 const bySubject=groupOf(items,z=>z.area),byCourse=groupOf(items,z=>JSON.stringify([z.area,site(z.x),grade(z.x),course(z.x)]));
 const subjectAverages=[...bySubject].map(([asignatura,records])=>({asignatura,promedio:avg(records.map(r=>r.score)),evaluados:records.length}))
 .sort((a,b)=>a.asignatura.localeCompare(b.asignatura,"es"));
 const courseAverages=[...byCourse].map(([key,records])=>{const [asignatura,sede,grado,curso]=JSON.parse(key);return{asignatura,sede,grado,curso,promedio:avg(records.map(r=>r.score)),evaluados:records.length}});
 const componentItems=[];
 if(p.p_asignatura){
  const area=AREAS.indexOf(trim(p.p_asignatura));
  const indexes=questions.map((q,i)=>q.area===area?i:-1).filter(i=>i>=0);
  for(const x of subset){
   const by=groupOf(indexes.map(i=>({q:questions[i],hit:yes(x,questions[i],i)})),r=>trim(r.q.comp)||"Sin componente");
   for(const [nombre,v] of by)componentItems.push({nombre,score:pct(v.filter(r=>r.hit).length,v.length)});
  }
 }
 const components=[...groupOf(componentItems,x=>x.nombre)].map(([nombre,arr])=>({nombre,promedio:avg(arr.map(x=>x.score)),evaluados:arr.length}));
 return {ok:true,edicion:CODE,ediciones:[CODE],grados:[10],sedes:filters().sedes,
 cursos:filters().cursos.filter(c=>(!p.p_grado||c.grado===Number(p.p_grado))&&(!p.p_sede||c.sede===p.p_sede)),
 asignaturas:active,inscritos:subset.length,resultados:subset.length,evaluados:perStudent.length,
 promedio:avg(perStudent),satisfactorio:pct(num(v=>v>=60),count),distribucion:distribution,
 asignaturas_promedio:subjectAverages,cursos_promedio:courseAverages,componentes:components,
 escala:"Notas oficiales de 0 a 100 por asignatura; componentes: porcentaje de aciertos."};
}
function ranking(p){
 const all=selectRows(p);
 const scores=[...all].sort((a,b)=>b.global-a.global||name(a).localeCompare(name(b),"es")||trim(a.id_prueba).localeCompare(trim(b.id_prueba),"es"));
 let previous=null,rank=0;
 const ranked=scores.map((x,i)=>{if(x.global!==previous){rank=i+1;previous=x.global;}return{x,position:rank};});
 const needle=lower(p.p_busqueda);const searched=ranked.filter(({x})=>
 !needle||lower(name(x)).includes(needle)||lower([x.apellidos,x.nombres].join(" ")).includes(needle)||
 lower(x.id_prueba).includes(needle)||lower(x.documento).includes(needle));
 const page=Math.max(1,Math.min(1000,Number(p.p_pagina)||1));
 const limit=Math.max(1,Math.min(50,Number(p.p_limite)||15));
 return {ok:true,edicion:CODE,filtros:filters(),total_estudiantes:ranked.length,
 promedio_global:avg(ranked.map(({x})=>x.global)),
 puntaje_maximo:ranked.length?ranked[0].x.global:null,total_coincidencias:searched.length,
 pagina:page,limite:limit,total_paginas:Math.ceil(searched.length/limit),
 filas:searched.slice((page-1)*limit,page*limit).map(({x,position})=>({
  posicion:position,id_prueba:trim(x.id_prueba),id_alumno:trim(x.documento),
  nombre:name(x),grado:10,curso:course(x),sede:site(x),puntaje_global:x.global}))};
}
function studentObject(x){
 return {id_alumno:trim(x.documento),id_prueba:trim(x.id_prueba),
 nombres:trim(x.nombres),apellidos:trim(x.apellidos),sede:site(x),
 grado:10,grupo:course(x),origen:"inscripcion"};
}
function buscar(p){
 const f=filters(),needle=lower(p.p_busqueda),all=selectRows(p);
 const matched=needle.length<2?[]:all.filter(x=>lower(name(x)).includes(needle)||
 lower([x.apellidos,x.nombres].join(" ")).includes(needle)||
 trim(x.documento).includes(needle)||trim(x.id_prueba).includes(needle))
 .sort((a,b)=>trim(a.apellidos).localeCompare(trim(b.apellidos),"es")).slice(0,12);
 return{ok:true,edicion:CODE,origen:"inscripcion",filtros:f,estudiantes:matched.map(studentObject)};
}
function detalle(p){
 const x=byDocument.get(trim(p.p_id_alumno))||byExam.get(trim(p.p_id_alumno));
 if(!x)return{ok:false,error:"El estudiante no tiene resultados de la diagnóstica."};
 const subjects=AREAS;
 const cohort=students.filter(z=>course(z)===course(x)&&site(z)===site(x));
 return{ok:true,edicion:CODE,estudiante:studentObject(x),tiene_resultados:true,
 respuestas:Object.fromEntries(x.respuestas.map((answer,i)=>[String(i+1),trim(answer)])),
 claves:questions.map(q=>({numero_item:q.index,area:subjects[q.area],correcta:trim(q.key),
  componente:trim(q.comp),competencia:trim(q.compet),sesion:Number(q.ses)||1})),
 ranking:{puesto_grado:Number(x.puesto_grado),total_grado:107,
  puesto_curso:Number(x.puesto_curso),total_curso:cohort.length,puntaje_global:Number(x.global)},
 puntajes_oficiales:official(x)};
}
function claves(p){
 const g=p.p_grado==null||p.p_grado===""?10:Number(p.p_grado);
 return{ok:true,edicion:CODE,grado:g,grados:[10],editable:false,
 permite_anular:false,motivo_requerido:false,
 items:g===10?questions.map(q=>({numero_item:q.index,sesion:Number(q.ses)||1,
   numero_en_sesion:Number(q.n)||q.index,area:AREAS[q.area],correcta:trim(q.key),anulada:false})):[]
 };
}
function restricciones(p){
 const needle=lower(p.p_busqueda),arr=students.filter(x=>!needle||
 lower(name(x)).includes(needle)||trim(x.id_prueba).includes(needle)||trim(x.documento).includes(needle));
 const entries=p.p_solo_afectados?[]:arr.slice(Math.max(0,Number(p.p_desde)||0),(Number(p.p_desde)||0)+Math.min(80,Number(p.p_limite)||80));
 return {ok:true,edicion:CODE,total:p.p_solo_afectados?0:arr.length,total_afectados:0,mas:p.p_solo_afectados?false:arr.length>(Number(p.p_desde)||0)+entries.length,
 estudiantes:entries.map(x=>({...studentObject(x),restringido:false,anulaciones:0}))};
}
function restriccionesDetalle(p){
 const x=byExam.get(trim(p.p_id_prueba));
 if(!x)return {ok:false,error:"Estudiante no encontrado"};
 return {ok:true,edicion:CODE,estudiante:{...studentObject(x),nombre:name(x)},
 medidas:[],sesiones:[1,2],areas:AREAS.map(area=>({clave:area,area,sesiones:unique(questions.filter(q=>AREAS[q.area]===area).map(q=>Number(q.ses)))})),auditoria:[]};
}
function roster(){
 return{ok:true,edicion:CODE,solo_lectura:true,
 estudiantes:students.map(x=>({roll:trim(x.id_prueba),nombre:name(x),grado:10,
  sede:site(x),curso:course(x)})),
 cursos:filters().cursos};
}
function rpc(name,p={}){
 if(!ready())throw new Error("Abre primero la Prueba Diagnóstica 3E.");
 if(p.p_edicion && trim(p.p_edicion)!==CODE)throw new Error("La prueba solicitada no corresponde a la diagnóstica.");
 switch(name){
 case "roque_v11_estadisticas_institucionales":return stats(p);
 case "roque_v20_ranking_institucional":return ranking(p);
 case "roque_v13_estudiante_buscar":return buscar(p);
 case "roque_v13_estudiante_detalle":return detalle(p);
 case "roque_v12_claves_consultar":
 case "roque_v15_staff_admin_claves_consultar":return claves(p);
 case "roque_v19_medidas_listar":return restricciones(p);
 case "roque_v18_medidas_detalle":return restriccionesDetalle(p);
 case "roque_v8_coordinador_listar":
 case "roque_v14_admin_mover_listar":return roster();
 default:throw new Error("La Diagnóstica 3E es de solo consulta. No se modificó ninguna evaluación.");
 }
}
window.RoqueDiagnostica3EStaff={CODE,AREAS,prepare,ready,clear:clean,raw:()=>source,dataset,students:()=>students,questions:()=>questions,catalogEntry,rpc};
})();