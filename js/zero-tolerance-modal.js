/* v175.106 · Usa únicamente el PNG suministrado y el botón Entendido. */
(() => {
  "use strict";
  function render() {
    return `<div class="modal-body zero-tolerance-body zt106-body">
      <div class="zt106-image-wrap">
        <img class="zt106-image" src="assets/zero-tolerance-aviso.png"
          alt="ZERO TOLERANCE. El examen fue digitalizado mediante lectura óptica OMR. Las marcas incorrectas, incompletas o con errores fueron anuladas. Solo fueron válidos los ítems con una sola opción completamente rellenada."
          width="1229" height="1219" decoding="sync" fetchpriority="high">
      </div>
      <div class="zt106-actions">
        <button type="button" class="zt106-understood" data-action="close-modal">Entendido</button>
      </div>
    </div>`;
  }
  window.RoqueZeroToleranceMarkup = Object.freeze({ render });
})();
