/* v175.40 - Modo posicionador móvil primero, drag + 4 círculos.
   Accesible exclusivamente con ?navidadDebug=1; no escribe al servidor. */
(() => {
 "use strict";
 if(new URLSearchParams(location.search).get("navidadDebug")!=="1")return;
 const style=document.createElement("link");style.rel="stylesheet";
 style.href="css/christmas-layout-editor.css?v=175.40";document.head.appendChild(style);
 const API=()=>window.RoqueWinterResponsive;
 const characterList=["santa","oso","cafe","nieves"];
 const names={tree:"Árbol",gift1:"Regalo rojo grande",gift2:"Regalo amarillo",gift3:"Regalo rojo pequeño",
   snowman:"Personaje",leafLeft:"Hoja izquierda",leafRight:"Hoja derecha"};
 let root=null,panel=null,overlay=null,selected="tree",drag=null,frame=0;
 const round=n=>Math.round(n*10)/10;
 const curr=()=>API()?.getPosition(selected);
 function status(msg){const el=panel?.querySelector("[data-status]");if(el)el.textContent=msg;}
 function draw(){
   if(frame)return;
   frame=requestAnimationFrame(()=>{
     frame=0;
     if(!root?.isConnected||!overlay)return;
     const node=API()?.getNode(selected);
     if(!node)return;
     const r=node.getBoundingClientRect();
     Object.assign(overlay.style,{left:r.left+"px",top:r.top+"px",width:r.width+"px",height:r.height+"px"});
   });
 }
 function refreshFields(){
   if(!panel)return;
   const v=curr();if(!v)return;
   for(const key of ["x","y","width"]){
     const input=panel.querySelector('[data-field="'+key+'"]');
     if(input)input.value=round(v[key]);
   }
   const rootRect=API()?.getParent(selected)?.getBoundingClientRect();
   if(rootRect)panel.querySelector('[data-coords]').textContent=
     `X: ${round(v.x)} (${round(v.x/rootRect.width*100)}%) · Y: ${round(v.y)} (${round(v.y/rootRect.height*100)}%) · Ancho: ${round(v.width)} px`;
 }
 function select(id){
   const n=API()?.getNode(id);if(!n)return;
   selected=id;
   panel.querySelector('[data-pick]').value=id;
   root.querySelectorAll('.winter-decor-image, .winter-leaf').forEach(el=>el.classList.toggle('winter-debug-chosen',el===n));
   refreshFields();draw();
 }
 function set(v){if(API()?.edit(selected,v)){refreshFields();draw();}}
 function finish(){
   if(!drag)return;
   drag=null;
   window.removeEventListener('pointermove',move);
   window.removeEventListener('pointerup',finish);
   window.removeEventListener('pointercancel',finish);
   document.body.classList.remove('winter-debug-active');
   status('Guardado en este navegador. Copia los valores al terminar.');
 }
 function move(e){
   if(!drag||(e.pointerId!==undefined&&drag.pointerId!==e.pointerId))return;
   e.preventDefault();
   const d=drag,dx=e.clientX-d.mx,dy=e.clientY-d.my;
   if(d.kind==='move'){
     set({x:d.x+dx,y:d.y+dy,width:d.width});return;
   }
   const sx=d.corner.endsWith('w')?-1:1;
   const sy=d.corner.startsWith('n')?-1:1;
   const delta=(dx*sx/Math.max(d.rect.width,1)+dy*sy/Math.max(d.rect.height,1))/2;
   const width=Math.max(12,Math.min(1200,d.width*(1+delta)));
   const factor=width/d.width;
   const h=d.rect.height*factor;
   set({x:d.x+(sx<0?d.rect.width-width:0),y:d.y+(sy<0?d.rect.height-h:0),width});
 }
 function begin(e,id,kind,corner){
   if(e.button!==undefined&&e.button!==0)return;
   const data=API()?.getPosition(id),node=API()?.getNode(id);
   if(!data||!node)return;
   e.preventDefault();e.stopPropagation();select(id);
   drag={id,kind,corner,pointerId:e.pointerId,mx:e.clientX,my:e.clientY,
     x:data.x,y:data.y,width:data.width,rect:node.getBoundingClientRect()};
   document.body.classList.add('winter-debug-active');
   window.addEventListener('pointermove',move,{passive:false});
   window.addEventListener('pointerup',finish);
   window.addEventListener('pointercancel',finish);
 }
 function change(dx,dy,dwidth){const d=curr();if(d)set({x:d.x+dx,y:d.y+dy,width:d.width+dwidth});}
 function attach(){
   panel=document.createElement('aside');panel.id='roque-winter-editor';
   panel.innerHTML=[
     '<div class="we-top"><b>❄️ Editor de Navidad</b><button data-minimize type="button" title="Minimizar">−</button></div>',
     '<div class="we-body"><p><b>Mueve los gráficos con tu mouse.</b> Estira los círculos de las esquinas para cambiar su tamaño. La distribución se adapta a móvil, 16:9 y ultrawide.</p>',
     '<label>Elemento<select data-pick>',
     API().defs.map(d=>'<option value="'+d.id+'">'+names[d.id]+'</option>').join(''),
     '</select></label>',
     '<label>Personaje visible (solo uno a la vez)<select data-character>',
     characterList.map(v=>'<option value="'+v+'">'+v.toUpperCase()+'</option>').join(''),
     '</select></label>',
     '<div class="we-grid"><label>X (px)<input type="number" step="1" data-field="x"></label>',
     '<label>Y (px)<input type="number" step="1" data-field="y"></label>',
     '<label>Ancho (px)<input type="number" step="1" min="12" data-field="width"></label></div>',
     '<div class="we-small-buttons"><button data-size="-10">−10</button><button data-size="-1">−1</button><button data-size="1">+1</button><button data-size="10">+10</button></div>',
     '<div class="we-small-buttons"><button data-move="left">←</button><button data-move="up">↑</button><button data-move="down">↓</button><button data-move="right">→</button></div>',
     '<small data-coords></small><div class="we-actions"><button type="button" data-copy>Copiar posiciones</button><button type="button" data-reset>Restablecer</button></div>',
     '<label>Datos para ChatGPT<textarea rows="3" readonly data-json></textarea></label>',
     '<small data-status></small><button type="button" data-exit>Salir del editor</button></div>'
   ].join('');
   document.body.appendChild(panel);
   overlay=document.createElement('div');overlay.id='roque-winter-selection';
   overlay.innerHTML='<span class="we-selection-caption">ARRASTRAR PARA MOVER</span>'+['nw','ne','sw','se'].map(v=>
     '<button type="button" data-corner="'+v+'" aria-label="Estirar desde la esquina '+v+'" title="Arrastra esta esquina"></button>').join('');
   document.body.appendChild(overlay);
   overlay.addEventListener('pointerdown',e=>{
     const handle=e.target.closest('[data-corner]');
     begin(e,selected,handle?'corner':'move',handle?.dataset.corner);
   });
   for(const def of API().defs){
     const el=API().getNode(def.id);
     if(el){el.classList.add('winter-debug-movable');
       el.addEventListener('pointerdown',e=>begin(e,def.id,'move'));}
   }
   panel.querySelector('[data-pick]').addEventListener('change',e=>select(e.target.value));
   panel.querySelector('[data-character]').value=window.RoqueWinterPick?.get()||'santa';
   panel.querySelector('[data-character]').addEventListener('change',e=>{
     window.RoqueWinterPick?.set(e.target.value);API().refresh();select('snowman');
     status('Personaje cambiado. Se sorteará otro al volver a entrar en la página.');
   });
   for(const input of panel.querySelectorAll('[data-field]'))input.addEventListener('change',()=>{
     const value=k=>Number(panel.querySelector('[data-field="'+k+'"]').value);
     set({x:value('x'),y:value('y'),width:value('width')});
   });
   panel.querySelectorAll('[data-size]').forEach(button=>button.addEventListener('click',()=>change(0,0,Number(button.dataset.size))));
   panel.querySelectorAll('[data-move]').forEach(button=>button.addEventListener('click',()=>{
     const t=button.dataset.move;
     change(t==='left'?-1:t==='right'?1:0,t==='up'?-1:t==='down'?1:0,0);
   }));
   panel.querySelector('[data-minimize]').addEventListener('click',()=>{
     const c=panel.classList.toggle('we-collapsed');panel.querySelector('[data-minimize]').textContent=c?'+':'−';
   });
   panel.querySelector('[data-copy]').addEventListener('click',async()=>{
     const text=JSON.stringify(API().export(),null,2),out=panel.querySelector('[data-json]');out.value=text;
     try{await navigator.clipboard.writeText(text);status('Copiado. Pega los números en ChatGPT.');}
     catch(_){out.focus();out.select();status('Seleccionado. Usa Ctrl+C para copiar los números.');}
   });
   panel.querySelector('[data-reset]').addEventListener('click',()=>{API().reset();select(selected);status('Posiciones restablecidas.');});
   panel.querySelector('[data-exit]').addEventListener('click',()=>{
     const url=new URL(location.href);url.searchParams.delete('navidadDebug');location.assign(url.href);
   });
   window.addEventListener('roqueWinterReflow',onReflow);
   window.addEventListener('scroll',draw,{passive:true});
   window.addEventListener('resize',draw,{passive:true});
   window.addEventListener('keydown',onKey);
   select(selected);
 }
 function onKey(e){
   if(!panel||e.target.matches('input,textarea,select'))return;
   const n=e.shiftKey?10:1;
   if(e.key==='ArrowLeft')change(-n,0,0);
   else if(e.key==='ArrowRight')change(n,0,0);
   else if(e.key==='ArrowUp')change(0,-n,0);
   else if(e.key==='ArrowDown')change(0,n,0);
   else return;
   e.preventDefault();
 }
 function onReflow(){refreshFields();draw();}
 function unmount(){
   if(!root)return;finish();
   window.removeEventListener('roqueWinterReflow',onReflow);
   window.removeEventListener('scroll',draw);
   window.removeEventListener('resize',draw);
   window.removeEventListener('keydown',onKey);
   panel?.remove();overlay?.remove();root=null;panel=null;overlay=null;
 }
 function start(){
   const app=document.getElementById('app');if(!app)return;
   const sync=()=>{
     const candidate=app.querySelector('.christmas-login');
     if(candidate===root)return;
     unmount();if(!candidate)return;
     root=candidate;requestAnimationFrame(()=>{
       if(!root?.isConnected)return;
       API()?.refresh();attach();
     });
   };
   new MutationObserver(sync).observe(app,{childList:true});sync();
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});
 else start();
})();
