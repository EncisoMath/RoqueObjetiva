/* v175.40: composicion movil primero. Las posiciones se calculan tomando
   como referencia el formulario, no coordenadas absolutas de escritorio.
   En una pantalla ancha el arbol/regalos pasan a la izquierda del card y el
   personaje al espacio derecho. El editor solo guarda cambios locales. */
(() => {
  "use strict";
  const enabled = new URLSearchParams(location.search).get("navidadDebug") === "1";
  const STORAGE = "roque_winter_mobile_first_v17540";
  const defs = [
    {id:"tree",selector:".winter-tree-emoji",parent:"scene",x:-125,bottom:-5,width:290,group:"left",ratio:1672/941},
    {id:"gift1",selector:".winter-gift-one",parent:"scene",x:14,bottom:1,width:81,group:"left",ratio:1199/1312},
    {id:"gift2",selector:".winter-gift-two",parent:"scene",x:95,bottom:10,width:67,group:"left",ratio:1312/1199},
    {id:"gift3",selector:".winter-gift-three",parent:"scene",x:157,bottom:1,width:48,group:"left",ratio:1199/1312},
    {id:"snowman",selector:".winter-snowman-emoji",parent:"scene",x:255,bottom:-12,width:224,group:"right",ratio:1672/941},
    {id:"leafLeft",selector:".winter-leaf-left",parent:"logo",x:-61,top:25,width:44,group:"logo",ratio:1},
    {id:"leafRight",selector:".winter-leaf-right",parent:"logo",x:107,top:25,width:44,group:"logo",ratio:1}
  ];
  const byId = Object.fromEntries(defs.map(item=>[item.id,item]));
  const refs = new Map(),defaults = new Map(),layout = new Map();
  let scene = null, card = null, logo = null, root = null, scheduled = false;
  let edits = {};
  if (enabled) {
    try {edits = JSON.parse(localStorage.getItem(STORAGE)||"{}");}catch (_) {edits={};}
  }
  const clamp=(n,min,max)=>Math.min(max,Math.max(min,n));
  const r=n=>Math.round(n*10)/10;
  const mix=(a,b,t)=>a+(b-a)*t;
  function ratioFor(id,node) {
    if (id==="snowman") {
      return node?.dataset.character==="cafe"?1448/1086:1672/941;
    }
    if (node?.naturalWidth && node?.naturalHeight) return node.naturalHeight/node.naturalWidth;
    return byId[id].ratio;
  }
  function context(){
    if(!scene?.isConnected || !card?.isConnected)return null;
    const s=scene.getBoundingClientRect(),c=card.getBoundingClientRect();
    const hScale=clamp(window.innerHeight/780,.72,1.22);
    const wScale=clamp(s.width/360,.85,1.13);
    const blend=clamp((s.width-480)/440,0,1);
    const unit=hScale;
    return {s,c,hScale,wScale,blend,unit};
  }
  function baseFor(def,ctx){
    const {s,c,hScale,wScale,blend}=ctx;
    const p=def.parent==="logo"?logo.getBoundingClientRect():s;
    const width=def.width*hScale;
    const height=width*ratioFor(def.id,refs.get(def.id));
    if (def.parent==="logo") {
      const leafWidth=clamp(def.width*hScale,32,55);
      const x=def.id==="leafLeft"?-leafWidth-16:p.width+16;
      return {x,y:(p.height-leafWidth)/2,width:leafWidth};
    }
    let xm=def.group==="right"
      ? s.width-width*.47 + (def.x-255)*wScale
      : def.x*wScale;
    let xd=xm;
    const treeWidth=defs[0].width*hScale;
    const treeDesktop=(c.left-s.left)-treeWidth-22;
    if(def.group==="left") {
      const delta=(def.x-defs[0].x)*hScale;
      xd=treeDesktop+delta;
    } else if (def.group==="right") xd=(c.right-s.left)+22+(def.x-255)*hScale;
    return {x:mix(xm,xd,blend),y:s.height-height-def.bottom*hScale,width};
  }
  function refresh(){
    if(!scene?.isConnected)return;
    const ctx=context();if(!ctx)return;
    for (const def of defs) {
      const el=refs.get(def.id);if(!el)continue;
      const base=baseFor(def,ctx);
      defaults.set(def.id,base);
      const edit=enabled?edits[def.id]:null;
      const x=r(base.x+(edit?.dx||0)*ctx.unit);
      const y=r(base.y+(edit?.dy||0)*ctx.unit);
      const width=r(base.width*(edit?.scale||1));
      const p=def.parent==="logo"?logo:scene;
      if(!p)continue;
      el.style.setProperty("position","absolute","important");
      el.style.setProperty("left",x+"px","important");
      el.style.setProperty("top",y+"px","important");
      el.style.setProperty("right","auto","important");
      el.style.setProperty("bottom","auto","important");
      el.style.setProperty("width",width+"px","important");
      el.style.setProperty("height","auto","important");
      el.style.setProperty("font-size","initial","important");
      el.style.setProperty("transform",def.id==="leafRight"?"scaleX(-1)":"none","important");
      layout.set(def.id,{x,y,width});
    }
    window.dispatchEvent(new CustomEvent("roqueWinterReflow"));
  }
  function schedule(){if(scheduled)return;scheduled=true;requestAnimationFrame(()=>{scheduled=false;refresh();});}
  function mount(next){
    if(root===next){schedule();return;}
    root=next;
    scene=next?.querySelector(".winter-seasonal-emojis")||null;
    card=next?.querySelector(".login-card-dark")||null;
    logo=next?.querySelector(".login-main-logo")||null;
    refs.clear();defaults.clear();layout.clear();
    if(!scene||!card||!logo)return;
    for(const def of defs){
      const el=next.querySelector(def.selector);
      if(!el)continue;
      refs.set(def.id,el);
      el.addEventListener("load",schedule,{passive:true});
    }
    schedule();
  }
  function edit(id,position){
    if(!enabled || !byId[id])return false;
    const current=defaults.get(id),ctx=context();
    if(!ctx || !current)return false;
    const o={
      dx:r((position.x-current.x)/ctx.unit),
      dy:r((position.y-current.y)/ctx.unit),
      scale:r(clamp(position.width/current.width,.08,8))
    };
    edits[id]=o;
    try{localStorage.setItem(STORAGE,JSON.stringify(edits));}catch(_){}
    refresh();return true;
  }
  function reset(){
    if(!enabled)return;
    edits={};try{localStorage.removeItem(STORAGE);}catch(_){}
    refresh();
  }
  function serialize(){
    const position={};
    for(const def of defs){
      const p=layout.get(def.id),b=defaults.get(def.id);
      if(!p||!b)continue;
      position[def.id]={nombre:def.id,ancla:def.parent==="logo"?"escudo":"formulario",
        xPx:p.x,yPx:p.y,anchoPx:p.width,regla:"movil-principal, laterales en escritorio",
        ajustes:edits[def.id]||{dx:0,dy:0,scale:1}};
    }
    return {version:"v175.40",referenciaMovil:{ancho:360,alto:780},
      viewport:{ancho:innerWidth,alto:innerHeight},
      personaje:window.RoqueWinterPick?.get()||"nieves",
      descripcion:"Posiciones editables relativas a un diseño base móvil; el escritorio aprovecha los laterales del formulario.",
      elementos:position};
  }
  function start(){
    const app=document.getElementById("app");if(!app)return;
    const sync=()=>{
      const next=app.querySelector(".christmas-login");
      if(next!==root)mount(next);
    };
    const observer=new MutationObserver(sync);
    observer.observe(app,{childList:true});
    sync();
    window.addEventListener("resize",schedule,{passive:true});
    window.addEventListener("orientationchange",schedule,{passive:true});
  }
  window.RoqueWinterResponsive={defs,getNode:id=>refs.get(id),getPosition:id=>layout.get(id),
    getBase:id=>defaults.get(id),getParent:id=>byId[id]?.parent==="logo"?logo:scene,
    edit,reset,export:serialize,refresh:schedule};
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start,{once:true});
  else start();
})();
