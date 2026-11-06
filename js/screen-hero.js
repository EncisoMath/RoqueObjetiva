/* RoqueObjetiva v175.88 · Hero compacto genérico para pantallas internas.
   Uso: window.RoqueScreenHero.render({title, subtitle, icon:"transfer",
     iconSrc, colors:{background, wave, waveSecondary, icon, iconBackground}});
   Independiente del hero institucional: no modifica .top-banner. */
(() => {
  "use strict";
  const ICONS=Object.freeze({
    transfer:'<path d="M4 8h15m-5-5 5 5-5 5M20 16H5m5-5-5 5 5 5"/>',
    users:'<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
    book:'<path d="M12 7C9 5 6 5 3 5v14c3-1 6-1 9 1 3-2 6-2 9-1V5c-3 0-6 0-9 2zm0 0v13"/>',
    chart:'<path d="M4 20v-6h4v6M10 20V9h4v11M16 20V4h4v16"/>',
    search:'<circle cx="10.8" cy="10.8" r="6.6"/><path d="m16 16 5 5"/>',
    shield:'<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
    key:'<circle cx="8" cy="14" r="5"/><path d="M11.6 10.4 21 1m-3.5 3.5 3 3M15 7l3 3"/>',
    layers:'<path d="m12 2 9 5-9 5-9-5 9-5zM3 12l9 5 9-5M3 17l9 5 9-5"/>'
  });
  const escapeHTML=value=>String(value??"").replace(/[&<>"']/g,char=>
    ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
  // Los colores no se interpolan como CSS arbitrario.
  const color=(value,fallback)=>{
    const input=String(value??"").trim();
    return /^#(?:[a-f0-9]{3}|[a-f0-9]{6})$/i.test(input)?input:fallback;
  };
  const iconMarkup=(icon,iconSrc)=>{
    const path=String(iconSrc??"").trim();
    // Permite PNG, WebP o SVG locales cuando otra pantalla necesite su propio icono.
    if(/^(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$))[a-z0-9_./-]+\.(?:svg|png|webp)$/i.test(path)){
      return '<img src="'+escapeHTML(path)+'" alt="" decoding="async">';
    }
    const glyph=ICONS[String(icon||"transfer")]||ICONS.transfer;
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" '+
      'stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+
      glyph+'</svg>';
  };
  const movingWave=()=>{
    const tile='<svg viewBox="0 0 1200 220" preserveAspectRatio="none" aria-hidden="true">'+
      '<path d="M0 218 C190 218 330 199 520 187 C670 174 770 121 902 120 '+
      'C1040 118 1080 196 1200 218 L1200 220 L0 220 Z"/></svg>';
    return '<span class="roque-screen-hero__wave-track" aria-hidden="true">'+tile+tile+'</span>';
  };
  function render(options={}){
    const c=options.colors||{};
    const background=color(c.background,"#1975AE");
    const wave=color(c.wave,"#348FC4");
    const waveSecondary=color(c.waveSecondary,"#155E8E");
    const iconColor=color(c.icon,"#1975AE");
    const iconBackground=color(c.iconBackground,"#EFF6FB");
    const title=escapeHTML(options.title||"");
    const subtitle=escapeHTML(options.subtitle||"");
    const heading=options.heading==="h2"?"h2":"h3";
    const vars='--rsh-background:'+background+';--rsh-wave:'+wave+
      ';--rsh-wave-secondary:'+waveSecondary+';--rsh-icon:'+iconColor+
      ';--rsh-icon-background:'+iconBackground;
    return '<header class="roque-screen-hero" style="'+vars+'">'+
      '<svg class="roque-screen-hero__wave-base" viewBox="0 0 1200 220" '+
      'preserveAspectRatio="none" aria-hidden="true">'+
      '<path d="M0 220 C235 220 402 218 525 200 C670 177 805 105 '+
      '970 99 C1060 94 1140 102 1200 105 L1200 220 L0 220 Z"/></svg>'+
      movingWave()+
      '<span class="roque-screen-hero__icon" aria-hidden="true">'+
      iconMarkup(options.icon,options.iconSrc)+'</span>'+
      '<span class="roque-screen-hero__divider" aria-hidden="true"></span>'+
      '<span class="roque-screen-hero__copy"><'+heading+
      ' class="roque-screen-hero__title">'+title+'</'+heading+'>'+
      (subtitle?'<span class="roque-screen-hero__subtitle">'+subtitle+'</span>':'')+
      '</span></header>';
  }
  window.RoqueScreenHero=Object.freeze({render});
})();
