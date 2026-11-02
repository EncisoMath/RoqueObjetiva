/* v175.42: ajustes definitivos móvil primero (360×800); corrección de altura de Café.
 En escritorio, árbol/regalos usan espacio izquierdo y personaje el derecho.
 Sin edición, sin persistencia local ni modo debug. */
(() => {
  "use strict";
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
  const ajustesDefinitivos = {
      "tree": {
          "dx": -6.8,
          "dy": -18.6,
          "scale": 1
      },
      "gift1": {
          "dx": -18.5,
          "dy": 5.6,
          "scale": 0.8
      },
      "gift2": {
          "dx": -48.8,
          "dy": -14.6,
          "scale": 1
      },
      "gift3": {
          "dx": -201,
          "dy": -23.1,
          "scale": 1
      },
      "snowman": {
          "dx": -23.3,
          "dy": 132.2,
          "scale": 0.6
      },
      "leafLeft": {
          "dx": 0,
          "dy": 0,
          "scale": 1
      },
      "leafRight": {
          "dx": 0,
          "dy": 0,
          "scale": 1
      }
  };
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
    // Café tiene relación alto/ancho 1448/1086, diferente de Santa/Oso/Nieves.
    // El anclaje anterior lo desplazaba demasiado hacia abajo. Lo elevamos
    // de manera proporcional al alto móvil, sin alterar a otros personajes.
    const cafeLift = def.id==="snowman" && refs.get(def.id)?.dataset.character==="cafe"
      ? width * (1672/941 - 1448/1086) * .8
      : 0;
    return {x:mix(xm,xd,blend),y:s.height-height-def.bottom*hScale-cafeLift,width};
  }
  function refresh(){
    if(!scene?.isConnected)return;
    const ctx=context();if(!ctx)return;
    for (const def of defs) {
      const el=refs.get(def.id);if(!el)continue;
      const base=baseFor(def,ctx);
      defaults.set(def.id,base);
      const edit=ajustesDefinitivos[def.id];
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
  window.RoqueWinterResponsive={refresh:schedule};
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start,{once:true});
  else start();
})();
