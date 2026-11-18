(() => {
  "use strict";
  // Solo transporta la respuesta privada autorizada. El informe, modales,
  // colores, iconos y animaciones son los NATIVOS de js/app.js.
  const CODE="2026-3E";
  let data=null, noResult=false;
  const accessible=()=>!!(data && data.ok===true && /^\d{6,15}$/.test(String(data.documento||"")) && data.codigo===CODE);
  const documento=()=>accessible()?String(data.documento):"";
  const payload=()=>accessible()?data:null;
  const clear=()=>{data=null;noResult=false;};
  const withoutResult=()=>noResult;
  async function probe(documentoIngresado,terminal,rpc){
    if(!/^\d{6,15}$/.test(String(documentoIngresado||"")) || typeof rpc!=="function" || !terminal){clear();return false;}
    try{
      const response=await rpc("roque_v23_diagnostica_3e_piloto",{p_documento:String(documentoIngresado),p_terminal:terminal});
      if(response?.ok===true && response.codigo===CODE && response.documento===String(documentoIngresado)
         && response.sin_resultado===true){
        data=null;noResult=true;return true;
      }
      if(response?.ok===true && response.codigo===CODE && response.documento===String(documentoIngresado)
         && Array.isArray(response.areas) && response.areas.length===5
         && Array.isArray(response.preguntas) && response.preguntas.length===254
         && Array.isArray(response.respuestas) && response.respuestas.length===254
         && Number.isFinite(Number(response.global)) && Number(response.global)>=0 && Number(response.global)<=500){
        data=response;return true;
      }
    }catch(error){console.warn("Diagnóstica 3E no disponible:",error?.message||error);}
    clear();return false;
  }
  const catalogEntry=()=>({
    codigo:CODE,titulo:"Prueba Diagnóstica 3E · 2026-2S",
    anio:2026,semestre:3,estado:"publicada",resultados_visibles:true,
    bloqueado_periodo:false
  });
  window.RoqueDiagnostica3E={probe,accessible,withoutResult,documento,payload,catalogEntry,clear,CODE};
})();