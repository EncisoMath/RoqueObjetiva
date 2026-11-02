/* v175.38. Inspector temporal; NO altera el portal fuera de ?navidadDebug=1 */
(() => {
"use strict";
if (new URLSearchParams(location.search).get("navidadDebug") !== "1") return;
const defs=[
{id:"tree",name:"🎄 Árbol",selector:".winter-tree-emoji",parent:".winter-seasonal-emojis"},
{id:"gift1",name:"🎁 Regalo grande",selector:".winter-gift-one",parent:".winter-seasonal-emojis"},
{id:"gift2",name:"🎁 Regalo mediano",selector:".winter-gift-two",parent:".winter-seasonal-emojis"},
{id:"gift3",name:"🎁 Regalo pequeño",selector:".winter-gift-three",parent:".winter-seasonal-emojis"},
{id:"snowman",name:"☃️ Muñeco",selector:".winter-snowman-emoji",parent:".winter-seasonal-emojis"},
{id:"leafLeft",name:"🌿 Hoja izquierda",selector:".winter-leaf-left",parent:".login-main-logo"},
{id:"leafRight",name:"🌿 Hoja derecha",selector:".winter-leaf-right",parent:".login-main-logo"}];
const sheet=document.createElement("link");sheet.rel="stylesheet";sheet.href="css/christmas-layout-editor.css?v=175.38";document.head.appendChild(sheet);
const key="roque_xmas_editor_draft_v17538";
let root=null,panel=null,selection=null,current="tree",active=null,frame=0;
const nodes=new Map(),originals=new Map(),values=new Map();
const round=n=>Math.round(n*10)/10;
const parent=def=>root.querySelector(def.parent);
const clamp=(v,min,max)=>Math.max(min,Math.min(max,Number(v)||0));
const draft=(()=>{
  try {const d=JSON.parse(localStorage.getItem(key)||"null");
    return d&&Math.abs(d.viewport.width-innerWidth)<18?d:null;
  }catch(_){return null;}
})();
function apply(def,data){
 const el=nodes.get(def.id);if(!el)return;
 const x=round(clamp(data.x,-1500,3000)),y=round(clamp(data.y,-1500,3000)),size=round(clamp(data.size,12,1100));
 el.style.setProperty("position","absolute","important");
 el.style.setProperty("inset","auto","important");
 el.style.setProperty("left",x+"px","important");
 el.style.setProperty("top",y+"px","important");
 el.style.setProperty("bottom","auto","important");
 el.style.setProperty("right","auto","important");
 el.style.setProperty("font-size",size+"px","important");
 el.style.setProperty("transform",def.id==="leafRight"?"scaleX(-1)":"none","important");
 values.set(def.id,{x,y,size});paint();
}
function formatJSON(){
 const elementos={};
 for(const def of defs){
   const d=values.get(def.id);if(!d)continue;
   const r=parent(def).getBoundingClientRect();
   elementos[def.id]={nombre:def.name,contenedor:def.parent,
     xPx:d.x,yPx:d.y,tamanoPx:d.size,
     xPorcentaje:round(d.x/Math.max(r.width,1)*100),
     yPorcentaje:round(d.y/Math.max(r.height,1)*100)};
 }
 return JSON.stringify({
   version:"v175.38",
   viewport:{ancho:innerWidth,alto:innerHeight},
   comentario:"Los valores x/y son relativos al contenedor de cada elemento. Los negativos significan fuera del borde.",
   elementos
 },null,2);
}
function store(){
 try{localStorage.setItem(key,JSON.stringify({
  viewport:{width:innerWidth,height:innerHeight},
  items:Object.fromEntries(values)
 }));}catch(_){}
}
function notice(str){const n=panel?.querySelector("[data-status]");if(n)n.textContent=str;}
function paint(){
 if(frame)return;
 frame=requestAnimationFrame(()=>{
  frame=0;if(!selection||!root?.isConnected)return;
  const el=nodes.get(current);if(!el)return;
  const r=el.getBoundingClientRect();
  Object.assign(selection.style,{left:r.left+"px",top:r.top+"px",width:r.width+"px",height:r.height+"px"});
 });
}
function refresh(){
 const d=values.get(current);if(!d||!panel)return;
 for(const field of ["x","y","size"]){
  const input=panel.querySelector('[data-field="'+field+'"]');if(input)input.value=d[field];
 }
 const def=defs.find(d=>d.id===current),rect=parent(def).getBoundingClientRect();
 panel.querySelector("[data-info]").textContent=
 "X "+d.x+" px ("+round(d.x/rect.width*100)+"%), Y "+d.y+
 " px ("+round(d.y/rect.height*100)+"%), tamaño "+d.size+" px";
}
function select(id){
 if(!nodes.has(id))return;current=id;
 nodes.forEach((el,k)=>el.classList.toggle("winter-debug-chosen",k===id));
 if(panel)panel.querySelector("[data-pick]").value=id;
 refresh();paint();
}
function finish(){
 if(!active)return;active=null;
 window.removeEventListener("pointermove",move);
 window.removeEventListener("pointerup",finish);
 window.removeEventListener("pointercancel",finish);
 document.body.classList.remove("winter-debug-active");
 store();refresh();
 notice("Borrador guardado localmente. Copia las coordenadas al terminar.");
}
function move(e){
 if(!active)return;e.preventDefault();
 const d=active,dx=e.clientX-d.startX,dy=e.clientY-d.startY;
 const def=defs.find(x=>x.id===d.id);
 if(d.kind==="size")apply(def,{x:d.x,y:d.y,size:d.size+(dx+dy)*.65});
 else apply(def,{x:d.x+dx,y:d.y+dy,size:d.size});
 refresh();
}
function begin(e,id,kind){
 if(e.button!=null&&e.button!==0)return;
 const d=values.get(id);if(!d)return;
 e.preventDefault();e.stopPropagation();select(id);
 active={id,kind,x:d.x,y:d.y,size:d.size,startX:e.clientX,startY:e.clientY};
 document.body.classList.add("winter-debug-active");
 window.addEventListener("pointermove",move,{passive:false});
 window.addEventListener("pointerup",finish);
 window.addEventListener("pointercancel",finish);
}
function change(deltaX,deltaY,deltaSize){
 const def=defs.find(x=>x.id===current),d=values.get(current);
 if(!def||!d)return;
 apply(def,{x:d.x+deltaX,y:d.y+deltaY,size:d.size+deltaSize});
 store();refresh();
}
function readInputs(){
 const d=values.get(current),def=defs.find(x=>x.id===current);
 const n=field=>Number(panel.querySelector('[data-field="'+field+'"]').value);
 apply(def,{x:n("x"),y:n("y"),size:n("size")});
 store();refresh();
}
function setMessage(){notice("Edita, arrastra o usa ↘. Ningún visitante ve los cambios.");}
function makeUI(){
 panel=document.createElement("aside");panel.id="roque-winter-editor";
 const options=defs.map(x=>'<option value="'+x.id+'">'+x.name+'</option>').join("");
 panel.innerHTML=[
 '<div class="we-top"><b>❄️ Posicionar emojis</b><button type="button" data-minimize title="Minimizar">−</button></div>',
 '<div class="we-body">',
 '<p>Arrastra un emoji o el tirador ✥. Arrastra ↘ para escalar. También puedes ajustar las cifras manualmente.</p>',
 '<label>Elemento<select data-pick>',options,'</select></label>',
 '<div class="we-grid">',
 '<label>X (px)<input type="number" step="1" data-field="x"></label>',
 '<label>Y (px)<input type="number" step="1" data-field="y"></label>',
 '<label>Tamaño<input type="number" step="1" min="12" max="1100" data-field="size"></label>',
 '</div><div class="we-small-buttons">',
 '<button type="button" data-size="-10">−10</button><button type="button" data-size="-1">−1</button>',
 '<button type="button" data-size="1">+1</button><button type="button" data-size="10">+10</button>',
 '</div><div class="we-small-buttons">',
 '<button type="button" data-move="left">←</button><button type="button" data-move="up">↑</button>',
 '<button type="button" data-move="down">↓</button><button type="button" data-move="right">→</button></div>',
 '<small data-info></small>',
 '<div class="we-actions"><button type="button" data-copy>Copiar coordenadas</button><button type="button" data-reset>Restablecer</button></div>',
 '<label>JSON para enviarme<textarea rows="3" readonly data-json placeholder="Pulsa «Copiar coordenadas»"></textarea></label>',
 '<small data-status></small><button type="button" data-exit>Salir del modo edición</button>',
 '</div>'].join("");
 document.body.appendChild(panel);
 selection=document.createElement("div");selection.id="roque-winter-selection";
 selection.innerHTML='<button type="button" data-drag title="Mover">✥ MOVER</button><button type="button" data-resize title="Cambiar tamaño">↘</button>';
 document.body.appendChild(selection);
 panel.querySelector("[data-pick]").addEventListener("change",e=>select(e.target.value));
 panel.querySelectorAll("[data-field]").forEach(n=>n.addEventListener("change",readInputs));
 panel.querySelectorAll("[data-size]").forEach(n=>n.addEventListener("click",()=>change(0,0,Number(n.dataset.size))));
 panel.querySelectorAll("[data-move]").forEach(n=>n.addEventListener("click",()=>{
  const v=n.dataset.move;
  change(v==="left"?-1:v==="right"?1:0,v==="up"?-1:v==="down"?1:0,0);
 }));
 panel.querySelector("[data-minimize]").addEventListener("click",()=>{
  const minimized=panel.classList.toggle("we-collapsed");
  panel.querySelector("[data-minimize]").textContent=minimized?"+":"−";
 });
 panel.querySelector("[data-copy]").addEventListener("click",async()=>{
   const json=formatJSON(),out=panel.querySelector("[data-json]");out.value=json;
   try{if(!navigator.clipboard?.writeText)throw Error("Clipboard unavailable");
     await navigator.clipboard.writeText(json);notice("¡Copiado! Pega el JSON en ChatGPT.");
   }catch(_){out.focus();out.select();notice("Seleccionado: usa Ctrl+C y pégalo en ChatGPT.");}
 });
 panel.querySelector("[data-reset]").addEventListener("click",()=>{
   try{localStorage.removeItem(key);}catch(_){}
   defs.forEach(def=>{const el=nodes.get(def.id);if(el)el.setAttribute("style",originals.get(def.id)||"");});
   values.clear();defs.forEach(def=>initialize(def,false));select(current);
   notice("Restablecido al diseño publicado.");
 });
 panel.querySelector("[data-exit]").addEventListener("click",()=>{
   const url=new URL(location.href);url.searchParams.delete("navidadDebug");location.assign(url.href);
 });
 selection.querySelector("[data-drag]").addEventListener("pointerdown",e=>begin(e,current,"move"));
 selection.querySelector("[data-resize]").addEventListener("pointerdown",e=>begin(e,current,"size"));
 window.addEventListener("scroll",paint,{passive:true});
 window.addEventListener("resize",paint,{passive:true});
 window.addEventListener("keydown",onKey);
}
function onKey(e){
 if(!panel||e.target.matches("input,textarea,select"))return;
 const k=e.key,s=e.shiftKey?10:1;
 if(!["ArrowUp","ArrowDown","ArrowLeft","ArrowRight"].includes(k))return;
 e.preventDefault();change(k==="ArrowLeft"?-s:k==="ArrowRight"?s:0,k==="ArrowUp"?-s:k==="ArrowDown"?s:0,0);
}
function initialize(def,restore){
 const node=nodes.get(def.id),par=parent(def);
 if(!node||!par)return;
 const b=node.getBoundingClientRect(),p=par.getBoundingClientRect();
 const d=restore?draft?.items?.[def.id]:null;
 apply(def,d&&Number.isFinite(d.size)?d:{
   x:round(b.left-p.left),y:round(b.top-p.top),
   size:round(parseFloat(getComputedStyle(node).fontSize)||80)
 });
}
function mount(next){
 if(root===next)return;
 unmount();root=next;
 for(const def of defs){
  const node=root.querySelector(def.selector);if(!node)continue;
  nodes.set(def.id,node);originals.set(def.id,node.getAttribute("style"));
  node.classList.add("winter-debug-movable");
  node.addEventListener("pointerdown",e=>begin(e,def.id,"move"));
 }
 if(!nodes.size)return;
 makeUI();defs.forEach(def=>initialize(def,true));select(current);
 if(draft)notice("Recuperé tus posiciones anteriores de este tamaño de pantalla.");
 else setMessage();
}
function unmount(){
 if(!root)return;
 finish();panel?.remove();selection?.remove();
 panel=null;selection=null;root=null;
 nodes.clear();originals.clear();values.clear();
 window.removeEventListener("scroll",paint);
 window.removeEventListener("resize",paint);
 window.removeEventListener("keydown",onKey);
}
function start(){
 const app=document.getElementById("app");if(!app)return;
 const sync=()=>{
  const next=app.querySelector(".christmas-login");
  if(next)mount(next);else if(root)unmount();
 };
 new MutationObserver(sync).observe(app,{childList:true});
 sync();
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start,{once:true});
else start();
})();