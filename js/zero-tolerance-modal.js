/* RoqueObjetiva v175.105 · Ilustraciones originales del aviso OMR. */
(() => {
  "use strict";
  const labels=["A","B","C","D"];
  function diagram(number,type){
    const xs=[86,142,198,254];
    const bubbles=xs.map((x,index)=>{
      const solid=(type==="valid"&&index===0)||(type==="smudge"&&index===0)||(type==="erased"&&index===0);
      const ghost=type==="erased"&&index===1;
      const fill=solid?"#171719":ghost?"#bfc1c5":"#fff";
      const textColor=solid?"#171719":"#941529";
      return `<ellipse cx="${x}" cy="47" rx="21" ry="24" fill="${fill}" stroke="#97172b" stroke-width="2.7"/>
        <text x="${x}" y="54" fill="${textColor}" font-family="Arial,sans-serif" font-size="20" font-weight="700" text-anchor="middle">${labels[index]}</text>`;
    }).join("");
    const scribble=type==="scribble"?`<g fill="none" stroke="#171719" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
      <path d="M61 38q18-25 40 7t-34 21q-22-24 10-41t23 28q-21 31-39-2"/>
      <path d="M66 24l34 43M93 23L67 67M62 52q17-28 40-10"/>
      <path d="M69 31q18-9 27 23M73 62q-15-31 15-41"/>
    </g>`:"";
    const erasing=type==="erased"?`<g fill="none" stroke="#898b90" stroke-linecap="round" opacity=".75">
      <path d="M126 31l27 26M123 50l29 10M148 27l-24 30" stroke-width="7"/>
      <path d="M127 35l28 25M124 42l30 1" stroke="#d7d7d8" stroke-width="5"/>
    </g>`:"";
    const stains=type==="smudge"?`<g fill="#a7a8aa" opacity=".75">
      <ellipse cx="201" cy="49" rx="6" ry="16" transform="rotate(-28 201 49)"/>
      <circle cx="193" cy="68" r="4"/><circle cx="220" cy="31" r="3"/>
      <path d="M241 30q12 4 10 13t-11 13l-6-16z"/>
    </g><g stroke="#444" opacity=".55" stroke-width="4" stroke-linecap="round">
      <path d="M181 26l36 38M208 29l-20 35"/>
    </g>`:"";
    return `<svg class="zt105-answer-svg" viewBox="0 0 293 90" role="img" aria-label="Ítem ${number}, ejemplo ${type==='valid'?'válido':'incorrecto'}">
      <text x="7" y="58" fill="#312037" font-size="29" font-weight="700" font-family="Arial,sans-serif">${number}.</text>
      ${bubbles}${scribble}${erasing}${stains}
    </svg>`;
  }
  const scan=`<svg viewBox="0 0 64 64" aria-hidden="true" width="58" height="58" fill="none" stroke="#086eac" stroke-width="4.4" stroke-linecap="round" stroke-linejoin="round">
    <path d="M16 18V8h32v10M13 43H9V26c0-5 3-8 8-8h30c5 0 8 3 8 8v17h-5"/>
    <path d="M16 37h32v20H16zM23 46h18M46 28h2"/>
  </svg>`;
  const caution=`<svg viewBox="0 0 64 64" aria-hidden="true" width="53" height="53" fill="none" stroke="#e11b26" stroke-width="4.6" stroke-linecap="round" stroke-linejoin="round">
    <path d="M32 7q2 0 4 4l22 39q3 6-4 6H10q-7 0-4-6l22-39q2-4 4-4z"/>
    <path d="M32 24v13M32 45v1"/>
  </svg>`;
  const check=`<svg viewBox="0 0 64 64" aria-hidden="true" width="58" height="58" fill="none" stroke="#17a521" stroke-width="5" stroke-linecap="round" stroke-linejoin="round">
    <path d="M52 31v16a9 9 0 0 1-9 9H17a9 9 0 0 1-9-9V21a9 9 0 0 1 9-9h19"/>
    <path d="m21 34 10 10L57 13"/>
  </svg>`;
  function incorrect(number,type,title){
    return `<article class="zt105-example">
      <span class="zt105-error-mark" aria-label="Incorrecto">×</span>
      <div class="zt105-example-drawing">${diagram(number,type)}</div>
      <div class="zt105-example-name">${title}</div>
    </article>`;
  }
  function render(){
    return `<div class="zt105-topbar">
        <h2 id="zt105-heading" class="zt105-visually-hidden">ZERO TOLERANCE — aviso de calificación</h2>
        <button type="button" class="zt105-close" aria-label="Cerrar aviso" data-action="close-modal">
          <svg width="27" height="27" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round"><path d="M5 5l14 14M19 5 5 19"/></svg>
        </button>
      </div>
      <div class="modal-body zero-tolerance-body zt105-body">
        <div class="zt105-logo-wrap"><img class="zt105-logo" src="assets/ZERO.png" alt="ZERO TOLERANCE" width="1050" decoding="async"></div>
        <div class="zt105-notice zt105-notice-blue">
          <div class="zt105-notice-icon">${scan}</div>
          <p>Tu examen fue digitalizado y calificado mediante lectura óptica (OMR), un proceso similar al de las <strong>pruebas Saber 11.</strong></p>
        </div>
        <div class="zt105-notice zt105-notice-red">
          <div class="zt105-notice-icon">${caution}</div>
          <p>Las marcas incorrectas, incompletas o con errores <strong>fueron anuladas sin derecho a reclamos.</strong></p>
        </div>
        <div class="zt105-example-title"><h3>Evita estos errores</h3></div>
        <div class="zt105-examples">
          ${incorrect(12,"scribble","Ítem mal marcado")}
          ${incorrect(13,"erased","Ítems mal borrados")}
          ${incorrect(14,"smudge","Con tachones o manchas")}
          ${incorrect(15,"empty","Ítems sin marcar")}
        </div>
        <div class="zt105-valid">
          <div class="zt105-valid-icon">${check}</div>
          <p>Fueron <strong>válidos</strong> únicamente los ítems con <strong>una sola opción marcada</strong>, rellenando completamente el óvalo con lápiz de mina negra.</p>
          <div class="zt105-valid-diagram">${diagram(16,"valid")}</div>
        </div>
        <button type="button" class="zt105-understood" data-action="close-modal">Entendido</button>
      </div>`;
  }
  window.RoqueZeroToleranceMarkup=Object.freeze({render});
})();