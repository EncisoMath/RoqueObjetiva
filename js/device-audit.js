/* RoqueObjetiva · identificación prudente del navegador para auditoría institucional.
   Sin acceso a sensores ni permisos de sistema. Una UUID persistente NO es un ID físico. */
(() => {
 "use strict";
 let last = null;
 const pick=(s,max=90)=>String(s||"").trim().slice(0,max);
 const match=(text,re)=>text.match(re)?.[1]||"";
 async function detect(){
  if(last)return last;
  const ua=String(navigator.userAgent||"");
  const hints=navigator.userAgentData||null;
  let high={};
  if(hints&&typeof hints.getHighEntropyValues==="function"){
   try{high=await hints.getHighEntropyValues(["model","platformVersion","fullVersionList"]);}catch(_){}
  }
  let navegador="Desconocido",version_navegador="";
  for(const [re,name] of [
   [/SamsungBrowser\/([\d.]+)/,"Samsung Internet"],
   [/EdgA?\/([\d.]+)/,"Microsoft Edge"],
   [/OPR\/([\d.]+)/,"Opera"],
   [/(?:Firefox|FxiOS)\/([\d.]+)/,"Firefox"],
   [/(?:CriOS|Chrome)\/([\d.]+)/,"Chrome"],
   [/Version\/([\d.]+).*Safari/,"Safari"]
  ]){const version=match(ua,re);if(version){navegador=name;version_navegador=version;break;}}
  let sistema=pick(hints?.platform)||pick(navigator.platform,60)||"Desconocido",version_so="";
  if(/Android/i.test(ua)){sistema="Android";version_so=match(ua,/Android\s+([\d.]+)/i);}
  else if(/iPhone|iPad|iPod/i.test(ua)){sistema="iOS/iPadOS";version_so=match(ua,/OS\s+([\d_]+)/).replace(/_/g,".");}
  else if(/Windows/i.test(ua)){sistema="Windows";version_so=match(ua,/Windows NT\s+([\d.]+)/);}
  else if(/Macintosh/i.test(ua)){sistema="macOS";version_so=match(ua,/Mac OS X\s+([\d_]+)/).replace(/_/g,".");}
  else if(/Linux/i.test(ua)){sistema="Linux";}
  if(high.platformVersion)sistema=pick(hints?.platform)||sistema,version_so=pick(high.platformVersion,30);
  const hintedModel=pick(high.model);
  const uaModel=pick(match(ua,/Android[\s\d.]*;\s*([^;)]+?)(?:\s+Build\/|[;)])/i));
  let modelo="",modelo_origen="desconocido",marca="";
  if(hintedModel&&hintedModel.toLowerCase()!=="unknown"){
   modelo=hintedModel;modelo_origen="detectado";
  }else if(uaModel&&!/^(?:[a-z]{2}[-_][a-z]{2}|wv|mobile|linux|en-us)$/i.test(uaModel)){
   modelo=uaModel;modelo_origen="estimado";
  }
  if(/^SM-|^GT-|samsung/i.test(modelo))marca="Samsung";
  else if(/^Pixel/i.test(modelo))marca="Google";
  else if(/^(?:moto|XT\d)/i.test(modelo))marca="Motorola";
  else if(/^(?:Redmi|M20|Mi\s|POCO)/i.test(modelo))marca="Xiaomi";
  else if(/OnePlus/i.test(modelo))marca="OnePlus";
  else if(/iPhone|iPad/i.test(ua))marca="Apple";
  // Solo equivalencias conocidas; jamás deducir un modelo exacto por píxeles de pantalla.
  const maps={
    "SM-S908":"Samsung Galaxy S22 Ultra","SM-S906":"Samsung Galaxy S22+",
    "SM-S901":"Samsung Galaxy S22","SM-A546":"Samsung Galaxy A54",
    "SM-A556":"Samsung Galaxy A55","SM-S918":"Samsung Galaxy S23 Ultra",
    "SM-S928":"Samsung Galaxy S24 Ultra"
  };
  const prefix=Object.keys(maps).find(k=>modelo.toUpperCase().startsWith(k));
  if(prefix){modelo=maps[prefix];modelo_origen="estimado";}
  if(!modelo&&marca==="Apple")modelo="iPhone/iPad (modelo desconocido)";
  if(!modelo)modelo="Modelo desconocido";
  const info={
   marca:pick(marca,60),modelo:pick(modelo),
   modelo_origen,sistema:pick(sistema,60),version_so:pick(version_so,30),
   navegador:pick(navegador,60),version_navegador:pick(version_navegador,30),
   ancho_pantalla:Math.round(Math.max(0,Math.min(16000,Number(screen?.width)||0))),
   alto_pantalla:Math.round(Math.max(0,Math.min(16000,Number(screen?.height)||0))),
   dpr:Math.min(99,Math.max(0,Math.round((Number(devicePixelRatio)||1)*100)/100))
  };
  last=info;return info;
 }
 window.RoqueDeviceAudit={detect};
})();
