(() => {
"use strict";
const app = document.getElementById("app");
const cfg = window.ROQUE_SUPABASE || {};
const base = String(cfg.url || "https://wkbczbjexnwbmyscrhah.supabase.co").replace(/\/+$/, "");
const key = String(cfg.key || "");
let auth = null, editions = [], busy = false;
function esc(v) {
  return String(v ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
}
function clear() { auth = null; editions = []; busy = false; }
async function token() {
  if (!auth) throw Error("La sesión personal no está abierta.");
  if (Date.now() >= auth.expiresAt) {
    const r = await fetch(base+"/auth/v1/token?grant_type=refresh_token",{
      method:"POST",cache:"no-store",headers:{"Content-Type":"application/json",apikey:key},
      body:JSON.stringify({refresh_token:auth.refresh_token})
    });
    const j=await r.json().catch(()=>({}));
    if (!r.ok || !j.access_token) {clear();throw Error("La sesión personal venció.");}
    auth={...j,expiresAt:Date.now()+Math.max(30,Number(j.expires_in||3600)-40)*1000};
  }
  return auth.access_token;
}
async function rpc(edicion) {
  const bearer = await token();
  const r = await fetch(base+"/rest/v1/rpc/roque_v5_historial_autorizado",{
    method:"POST",cache:"no-store",
    headers:{"Content-Type":"application/json",apikey:key,Authorization:"Bearer "+bearer,"Cache-Control":"no-store"},
    body:JSON.stringify(edicion ? {p_edicion:edicion} : {})
  });
  const j=await r.json().catch(()=>({}));
  if(!r.ok || !j.ok) throw Error(j.error || j.message || "Historial no autorizado.");
  return j;
}
function shell(body) {
  app.innerHTML='<section class="login-shell login-shell-dark history-shell">'+
  '<div class="history-background" aria-hidden="true">✦ □ ✕ ◇</div>'+
  '<div class="login-panel"><div class="login-card login-card-dark history-card">'+body+
  '</div></div></section>';
}
function showLogin(error) {
  shell('<span class="login-eyebrow">Acceso privado</span><h1>Mis evaluaciones</h1>'+
    '<p>Ingresa con la cuenta personal autorizada por el colegio. El ingreso habitual por ID sigue disponible.</p>'+
    (error ? '<p class="history-error" role="alert">'+esc(error)+'</p>' : '')+
    '<form class="login-form" id="historyAuthForm">'+
    '<div class="field"><label for="historyEmail">Correo personal</label><input id="historyEmail" type="email" autocomplete="username" required></div>'+
    '<div class="field"><label for="historyPassword">Contraseña personal</label><input id="historyPassword" type="password" autocomplete="current-password" required></div>'+
    '<div class="login-actions"><button class="primary-btn" type="submit">Consultar historial</button></div></form>'+
    '<button type="button" class="history-back-button" data-action="history-exit">Volver al ingreso por ID</button>');
}
function showSelector() {
  if (!auth || !editions.length) return showLogin("No hay evaluaciones disponibles.");
  const buttons=editions.map(e =>
    '<button type="button" class="history-edition" data-action="history-select" data-edicion="'+esc(e.codigo)+'">'+
    '<span>'+esc(e.codigo)+'</span><strong>'+esc(e.titulo || "Evaluación institucional")+'</strong>'+
    '<span class="history-arrow" aria-hidden="true">→</span></button>'
  ).join("");
  shell('<span class="login-eyebrow">Historial académico</span><h1>Mis evaluaciones</h1>'+
    '<p>Selecciona el semestre que deseas consultar.</p><div class="history-editions">'+buttons+'</div>'+
    '<button class="history-back-button" type="button" data-action="history-exit">Cerrar sesión personal</button>');
}
async function openEdition(edicion) {
  if(busy) return;
  if(!editions.some(e=>e.codigo===edicion)) return showLogin("Evaluación no autorizada.");
  busy=true;
  try {
    const data=await rpc(edicion);
    if(data.edicion!==edicion || data.session?.role!=="student") throw Error("Respuesta de edición inválida.");
    if(!window.RoqueHistorialBridge?.applyEdition) throw Error("La aplicación necesita actualizarse.");
    window.RoqueHistorialBridge.applyEdition(data,editions);
  } catch(e) {
    showSelector();
    window.alert(e.message || "No fue posible abrir la evaluación.");
  } finally {busy=false;}
}
async function login(email,password) {
  if(busy) return;
  busy=true;
  try {
    auth=null; editions=[];
    if(!key) throw Error("Falta la configuración de Supabase.");
    const r=await fetch(base+"/auth/v1/token?grant_type=password",{
      method:"POST",cache:"no-store",headers:{"Content-Type":"application/json",apikey:key},
      body:JSON.stringify({email,password})
    });
    const j=await r.json().catch(()=>({}));
    if(!r.ok || !j.access_token) throw Error("Correo o contraseña incorrectos.");
    auth={...j,expiresAt:Date.now()+Math.max(30,Number(j.expires_in||3600)-40)*1000};
    const result=await rpc(null);
    editions=Array.isArray(result.ediciones)?result.ediciones:[];
    if(!editions.length) throw Error("Esta cuenta todavía no tiene evaluaciones publicadas.");
    busy=false;
    if(editions.length===1) return openEdition(editions[0].codigo);
    showSelector();
  } catch(e) {
    clear();showLogin(e.message || "No fue posible consultar el historial.");
  } finally {busy=false;}
}
document.addEventListener("click",event=>{
  const btn=event.target.closest?.("[data-action]");
  if(!btn)return;
  const action=btn.dataset.action;
  if(action==="history-login"){clear();showLogin();}
  else if(action==="history-select"){openEdition(btn.dataset.edicion || "");}
  else if(action==="history-back"){window.RoqueHistorialBridge?.backToEditions?.();}
  else if(action==="history-exit"){window.RoqueHistorialBridge?.leave?.();}
});
document.addEventListener("submit",event=>{
  if(event.target?.id!=="historyAuthForm")return;
  event.preventDefault();
  login(String(document.getElementById("historyEmail")?.value || "").trim(),
        String(document.getElementById("historyPassword")?.value || ""));
});
window.RoqueHistorial={clear,showSelector};
})();