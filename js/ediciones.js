/* RoqueObjetiva v145: administrador multiedicion.
   La contraseña de Supabase Auth solo se usa durante el inicio de sesión.
   Los tokens permanecen en memoria; nunca se guardan en localStorage. */
(() => {
  "use strict";
  const S = {
    token: "", refresh: "", expires: 0, email: "",
    editions: [], config: null, edition: "", grade: 0, page: 0,
    busy: false, error: "", info: "", form: "", edit: null
  };
  const HTML = (value) => String(value == null ? "" : value)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
  const attr = HTML;
  const el = () => document.getElementById("roque-ediciones-root");
  const num = (v, fallback = 0) => Number.isFinite(Number(v)) ? Number(v) : fallback;
  const cfg = () => window.ROQUE_SUPABASE || {};
  const base = () => String(cfg().url || "").replace(/\/$/, "");
  const key = () => String(cfg().key || "");
  const field = (label, name, value, type = "text", extra = "") =>
    '<label class="ed-field"><span>' + HTML(label) + '</span><input name="' + attr(name) +
    '" type="' + attr(type) + '" value="' + attr(value == null ? "" : value) +
    '" ' + extra + '></label>';
  const select = (label, name, selected, options) =>
    '<label class="ed-field"><span>' + HTML(label) + '</span><select name="' + attr(name) + '">' +
    options.map((item) => '<option value="' + attr(item[0]) + '"' +
      (String(item[0]) === String(selected) ? " selected" : "") + '>' + HTML(item[1]) + '</option>').join("") +
    '</select></label>';
  const tick = (label, name, checked) =>
    '<label class="ed-check"><input type="checkbox" name="' + attr(name) + '"' +
    (checked ? " checked" : "") + '> ' + HTML(label) + '</label>';
  const button = (label, action, extra = "", kind = "") =>
    '<button type="button" class="ed-btn ' + kind + '" data-ed-action="' + attr(action) +
    '" ' + extra + '>' + HTML(label) + '</button>';

  async function authRequest(path, data) {
    if (!base() || !key()) throw new Error("Falta configurar Supabase en esta página.");
    const response = await fetch(base() + "/auth/v1/" + path, {
      method: "POST", cache: "no-store",
      headers: { "Content-Type": "application/json", "apikey": key() },
      body: JSON.stringify(data)
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.msg || result.error_description || result.message || "Autenticación rechazada.");
    return result;
  }
  function applyToken(session) {
    if (!session || !session.access_token) throw new Error("Supabase no devolvió una sesión válida.");
    S.token = session.access_token;
    S.refresh = session.refresh_token || "";
    S.expires = Date.now() + Math.max(0, num(session.expires_in, 3600) - 35) * 1000;
    S.email = String(session.user && session.user.email || S.email);
  }
  async function validToken() {
    if (!S.token) throw new Error("Primero inicia sesión con Supabase Auth.");
    if (S.expires && Date.now() > S.expires) {
      if (!S.refresh) throw new Error("Tu sesión caducó. Ingresa nuevamente.");
      applyToken(await authRequest("token?grant_type=refresh_token", { refresh_token: S.refresh }));
    }
    return S.token;
  }
  async function rpc(name, params = {}) {
    const access = await validToken();
    const response = await fetch(base() + "/rest/v1/rpc/" + name, {
      method: "POST", cache: "no-store",
      headers: { "Content-Type": "application/json", "apikey": key(), "Authorization": "Bearer " + access },
      body: JSON.stringify(params)
    });
    const text = await response.text();
    let data;
    try { data = text ? JSON.parse(text) : null; } catch (_) { data = text; }
    if (!response.ok) {
      if (response.status === 401) { logout(); throw new Error("Sesión vencida. Ingresa de nuevo."); }
      throw new Error((data && (data.message || data.error)) || "Supabase respondió con error " + response.status);
    }
    return data;
  }
  function logout() {
    S.token = ""; S.refresh = ""; S.expires = 0; S.email = "";
    S.editions = []; S.config = null; S.edition = ""; S.grade = 0; S.form = ""; S.edit = null;
    S.error = ""; S.info = "";
    redraw();
  }
  async function loadEditions(preferred = "") {
    const result = await rpc("roque_v2_admin_listar_ediciones");
    S.editions = Array.isArray(result) ? result : [];
    const target = preferred || S.edition;
    S.edition = S.editions.some((e) => e.codigo === target) ? target : (S.editions[0] && S.editions[0].codigo || "");
    if (S.edition) await loadConfiguration(S.edition);
    else S.config = null;
  }
  async function loadConfiguration(code) {
    S.config = await rpc("roque_v2_admin_ver_configuracion", { p_edicion: code });
    const grades = Array.isArray(S.config.grados) ? S.config.grados : [];
    if (!grades.some((g) => num(g.grado) === S.grade)) S.grade = grades.length ? num(grades[0].grado) : 0;
    S.page = 0;
  }
  async function task(action, success) {
    S.busy = true; S.error = ""; S.info = ""; redraw();
    try { await action(); S.info = success || "Operación completada."; }
    catch (error) { S.error = String(error.message || error); }
    finally { S.busy = false; redraw(); }
  }
  async function save(operation, data) {
    const answer = await rpc("roque_v2_admin_guardar_parametro", { p_operacion: operation, p_datos: data });
    if (answer && answer.ok === false) throw new Error(answer.error || "No se pudo guardar.");
    if (operation === "crear_edicion") await loadEditions(data.codigo);
    else { await loadConfiguration(S.edition); await loadEditions(S.edition); }
    S.form = ""; S.edit = null;
  }

  const editAllowed = () => !!(S.config && S.config.edicion &&
    S.config.edicion.estado === "borrador" && !S.config.edicion.resultados_visibles);
  const grades = () => S.config && Array.isArray(S.config.grados) ? S.config.grados : [];
  const areas = () => S.config && Array.isArray(S.config.areas) ? S.config.areas.filter((a) => num(a.grado) === S.grade) : [];
  const sessions = () => S.config && Array.isArray(S.config.sesiones) ? S.config.sesiones.filter((s) => num(s.grado) === S.grade) : [];
  const items = () => S.config && Array.isArray(S.config.items) ? S.config.items.filter((i) => num(i.grado) === S.grade) : [];
  function loginPanel() {
    return '<section class="card card-pad ed-card"><h2>Acceso a ediciones y pruebas</h2>' +
      '<p>Ingresa con tu cuenta nueva de <strong>Supabase Authentication</strong>. Esta autenticación es independiente del administrador antiguo.</p>' +
      '<form data-ed-form="login" class="ed-form">' +
      field("Correo de Supabase Auth", "email", S.email, "email", 'required autocomplete="username"') +
      '<label class="ed-field"><span>Contraseña</span><input name="password" type="password" autocomplete="current-password" required></label>' +
      '<div class="ed-actions"><button class="ed-btn ed-primary" type="submit">Conectar de forma segura</button></div></form>' +
      '<p class="ed-note">La contraseña no se guarda en el navegador ni se envía al repositorio GitHub.</p></section>';
  }
  function optionsEd() { return S.editions.map((e) => [e.codigo, e.codigo + " · " + e.estado]); }
  function selectorPanel() {
    const edition = S.config && S.config.edicion || {};
    return '<section class="ed-controls">' +
      select("Edición", "edicion", S.edition, optionsEd()).replace('<select name="edicion">', '<select name="edicion" data-ed-select="edition">') +
      button("Crear edición", "new-edition", "", "ed-primary") +
      button("Actualizar datos", "reload") +
      button("Cerrar Supabase Auth", "signout") + '</section>' +
      '<p class="ed-note">Sesión de gestión: ' + HTML(S.email) + '. La página publicada continúa consultando el sistema antiguo hasta completar la transición.</p>' +
      '<div class="ed-metrics">' +
      metric("Estado", edition.estado || "—") +
      metric("Grados", grades().length) +
      metric("Áreas", S.config && S.config.areas.length || 0) +
      metric("Preguntas", S.config && S.config.items.length || 0) +
      '</div>';
  }
  function metric(label, value) {
    return '<div class="ed-metric"><span>' + HTML(label) + '</span><strong>' + HTML(value) + '</strong></div>';
  }
  function createEditionForm() {
    if (S.form !== "edition") return "";
    return '<section class="card card-pad ed-card"><h3>Nueva edición</h3>' +
      '<p class="ed-note">El código tiene formato AAAA-1S o AAAA-2S. Al clonar, no se copian claves ni resultados.</p>' +
      '<form class="ed-form" data-ed-form="edition">' +
      field("Código", "codigo", "", "text", 'required pattern="[0-9]{4}-[12]S" placeholder="2027-1S"') +
      field("Nombre", "titulo", "", "text", 'required maxlength="140"') +
      select("Copiar estructura desde (opcional)", "plantilla", "", [["", "Crear vacía"], ...S.editions.map((e) => [e.codigo, e.codigo])]) +
      '<div class="ed-actions"><button class="ed-btn ed-primary" type="submit">Crear borrador</button>' +
      button("Cancelar", "cancel") + '</div></form></section>';
  }
  function configSection() {
    if (!S.config) return '<div class="card card-pad">No existen ediciones configuradas.</div>';
    const frozen = !editAllowed();
    const gs = grades();
    const selected = gs.find((g) => num(g.grado) === S.grade) || null;
    let view = '<section class="ed-section"><div class="ed-section-head"><div><h3>Grados y asignaturas</h3>' +
      '<p>Configura los grados, las sesiones, las áreas y las preguntas de la edición seleccionada.</p></div>' +
      (frozen ? '<span class="ed-tag">Solo lectura · edición histórica</span>' : button("Añadir grado", "new-grade", "", "ed-primary")) +
      '</div><div class="ed-controls">' +
      select("Grado activo", "grado-elegido", S.grade, gs.map((g) => [g.grado, g.grado + "° · " + (g.nombre || "Grado " + g.grado)]))
        .replace('<select name="grado-elegido">', '<select name="grado-elegido" data-ed-select="grade">') +
      (selected && !frozen ? button("Editar grado", "edit-grade") : "") + '</div>';
    if (!selected) return view + '<p class="ed-note">Esta edición todavía no tiene grados. Agrega el primero para comenzar.</p>' + editor() + '</section>';
    view += '<div class="ed-summary">' +
      metric("Método global", selected.metodo_global) +
      metric("Máximo global", selected.maximo_global) +
      metric("Sesiones", sessions().length) +
      metric("Áreas", areas().length) + '</div>';
    view += editor();
    view += '<div class="ed-section-head ed-subhead"><h3>Sesiones</h3>' +
      (frozen ? "" : button("Añadir sesión", "new-session")) + '</div>' +
      '<div class="ed-table-wrap"><table class="ed-table"><thead><tr><th>Sesión</th><th>Nombre</th><th></th></tr></thead><tbody>' +
      sessions().map((s) => '<tr><td>' + HTML(s.numero) + '</td><td>' + HTML(s.nombre || "—") + '</td><td>' +
        (frozen ? "" : button("Editar", "edit-session", 'data-ed-id="' + attr(s.numero) + '"')) + '</td></tr>').join("") +
      '</tbody></table></div>';
    view += '<div class="ed-section-head ed-subhead"><h3>Áreas y calificaciones</h3>' +
      (frozen ? "" : button("Añadir área", "new-area")) + '</div>' +
      '<div class="ed-table-wrap"><table class="ed-table"><thead><tr><th>Área</th><th>Preguntas configuradas</th><th>Ítems existentes</th><th>Escala</th><th>Peso global</th><th></th></tr></thead><tbody>' +
      areas().map((a) => '<tr><td>' + HTML(a.area) + '</td><td>' + HTML(a.cantidad_preguntas) + '</td><td>' +
        items().filter((i) => i.area === a.area).length + '</td><td>' + HTML(a.nota_minima) + "–" + HTML(a.nota_maxima) +
        '</td><td>' + HTML(a.peso_global) + '</td><td>' +
        (frozen ? "" : button("Editar", "edit-area", 'data-ed-id="' + attr(a.area) + '"')) + '</td></tr>').join("") +
      '</tbody></table></div><p class="ed-note">Cambiar la cantidad de preguntas no genera ni elimina ítems automáticamente. ' +
      'La cantidad configurada y la cantidad real deben coincidir antes de publicar.</p>';
    view += itemSection(frozen) + '</section>';
    return view;
  }
  function generatorPanel() {
    if (!editAllowed() || items().length || !sessions().length) return "";
    const available = areas().filter((a) => a.activo && num(a.cantidad_preguntas) > 0);
    if (!available.length) return "";
    return '<section class="card card-pad ed-editor"><h3>Generar preguntas automáticamente</h3>' +
      '<p class="ed-note">Solo para grados sin ítems. Se genera la numeración por sesión y área en una única operación, sin claves correctas. Requiere instalar SQL 11 en Supabase.</p>' +
      '<form data-ed-form="generate" class="ed-form">' +
      available.map((a) => select(a.area + " · " + a.cantidad_preguntas + " preguntas", "sesion:" + a.area,
        sessions()[0].numero, sessions().map((s) => [s.numero, s.numero + " · " + (s.nombre || "")]))).join("") +
      '<div class="ed-actions"><button type="submit" class="ed-btn ed-primary">Generar ' +
      available.reduce((sum, a) => sum + num(a.cantidad_preguntas), 0) +
      ' preguntas del grado</button></div></form></section>';
  }
  function itemSection(frozen) {
    const list = items().slice().sort((a, b) => num(a.numero_item) - num(b.numero_item));
    const pageSize = 15;
    const pages = Math.max(1, Math.ceil(list.length / pageSize));
    S.page = Math.max(0, Math.min(S.page, pages - 1));
    const page = list.slice(S.page * pageSize, (S.page + 1) * pageSize);
    return generatorPanel() + '<div class="ed-section-head ed-subhead"><div><h3>Preguntas e ítems</h3><p>' +
      HTML(list.length) + ' ítems en este grado · página ' + (S.page + 1) + " de " + pages +
      '</p></div>' + (frozen ? "" : button("Añadir ítem", "new-item")) + '</div>' +
      '<div class="ed-table-wrap"><table class="ed-table"><thead><tr><th>Ítem</th><th>Sesión</th><th>N.º sesión</th><th>Área</th><th>Clave</th><th></th></tr></thead><tbody>' +
      page.map((i) => '<tr><td>' + HTML(i.numero_item) + '</td><td>' + HTML(i.sesion) + '</td><td>' +
        HTML(i.numero_en_sesion) + '</td><td>' + HTML(i.area) + '</td><td>' + HTML(i.respuesta_correcta || "Pendiente") +
        '</td><td>' + (frozen ? "" : button("Editar", "edit-item", 'data-ed-id="' + attr(i.numero_item) + '"')) +
        '</td></tr>').join("") + '</tbody></table></div>' +
      '<div class="ed-actions">' + button("Anterior", "prev", S.page === 0 ? "disabled" : "") +
      button("Siguiente", "next", S.page >= pages - 1 ? "disabled" : "") + '</div>';
  }
  function editor() {
    if (!S.form || S.form === "edition") return "";
    const t = S.form, r = S.edit || {};
    let fields = "";
    const readonly = S.edit !== null;
    if (t === "grade") {
      fields = field("Grado", "grado", r.grado || "", "number",
        'required min="1" max="11" ' + (readonly ? "readonly" : "")) +
        field("Nombre", "nombre", r.nombre || "", "text") +
        select("Método global", "metodo_global", r.metodo_global || "ponderado", [["ponderado", "Ponderado"], ["ninguno", "Sin global"]]) +
        field("Máximo global", "maximo_global", r.maximo_global == null ? 500 : r.maximo_global, "number", 'required min="1" step="0.01"') +
        tick("Grado habilitado", "activo", r.activo !== false);
    } else if (t === "session") {
      fields = field("N.º de sesión", "numero", r.numero || "", "number", 'required min="1" ' + (readonly ? "readonly" : "")) +
        field("Nombre", "nombre", r.nombre || "", "text");
    } else if (t === "area") {
      fields = field("Nombre del área", "area", r.area || "", "text", 'required ' + (readonly ? "readonly" : "")) +
        field("Cantidad de preguntas", "cantidad_preguntas", r.cantidad_preguntas == null ? 0 : r.cantidad_preguntas, "number", 'required min="0"') +
        field("Nota mínima", "nota_minima", r.nota_minima == null ? 20 : r.nota_minima, "number", 'required step="0.01"') +
        field("Nota máxima", "nota_maxima", r.nota_maxima == null ? 100 : r.nota_maxima, "number", 'required step="0.01"') +
        field("Nota si no presentó", "nota_ausente", r.nota_ausente == null ? 0 : r.nota_ausente, "number", 'required step="0.01"') +
        select("Método", "metodo_calificacion", r.metodo_calificacion || "lineal", [["lineal", "Lineal"], ["ponderada", "Ponderada"]]) +
        field("Peso global", "peso_global", r.peso_global == null ? 0 : r.peso_global, "number", 'required step="0.0001" min="0"') +
        field("Área global equivalente (opcional)", "area_global", r.area_global || "") +
        field("Orden", "orden", r.orden == null ? areas().length + 1 : r.orden, "number", 'required min="1"') +
        tick("Área habilitada", "activo", r.activo !== false);
    } else if (t === "item") {
      fields = field("N.º global del ítem", "numero_item", r.numero_item || "", "number",
        'required min="1" ' + (readonly ? "readonly" : "")) +
        select("Sesión", "sesion", r.sesion || (sessions()[0] && sessions()[0].numero), sessions().map((s) => [s.numero, s.numero + " · " + (s.nombre || "")])) +
        field("N.º dentro de la sesión", "numero_en_sesion", r.numero_en_sesion || "", "number", 'required min="1"') +
        select("Área", "area", r.area || (areas()[0] && areas()[0].area), areas().map((a) => [a.area, a.area])) +
        select("Clave correcta", "respuesta_correcta", r.respuesta_correcta || "",
          [["", "Pendiente"], ...["A","B","C","D","E","F","G","H"].map((v) => [v, v])]) +
        field("Componente", "componente", r.componente || "") +
        field("Competencia", "competencia", r.competencia || "") +
        field("Peso de pregunta", "peso_pregunta", r.peso_pregunta == null ? 1 : r.peso_pregunta, "number", 'required step="0.0001" min="0.0001"') +
        tick("Pregunta anulada", "anulada", r.anulada === true) +
        tick("Pregunta activa", "activo", r.activo !== false);
    }
    return '<section class="card card-pad ed-editor"><h3>' + (readonly ? "Editar " : "Añadir ") + HTML(t) + '</h3>' +
      '<form class="ed-form" data-ed-form="' + attr(t) + '">' + fields +
      '<div class="ed-actions"><button type="submit" class="ed-btn ed-primary">Guardar cambios</button>' +
      button("Cancelar", "cancel") + '</div></form></section>';
  }
  function panel() {
    if (!S.token) return loginPanel();
    return selectorPanel() + createEditionForm() + configSection();
  }
  function render() {
    return '<div id="roque-ediciones-root" class="ed-root">' +
      '<header class="ed-heading"><h2>Ediciones y pruebas</h2>' +
      '<p>Configuración académica histórica y nuevas evaluaciones por semestre.</p></header>' +
      (S.error ? '<p class="ed-message ed-error" role="alert">' + HTML(S.error) + '</p>' : "") +
      (S.info ? '<p class="ed-message ed-ok" role="status">' + HTML(S.info) + '</p>' : "") +
      (S.busy ? '<p class="ed-message">Consultando Supabase…</p>' : "") +
      panel() + '</div>';
  }
  function redraw() {
    const root = el();
    if (root) {
      const wrapper = document.createElement("div");
      wrapper.innerHTML = render();
      root.replaceWith(wrapper.firstElementChild);
    }
  }
  function setForm(type, row = null) { S.form = type; S.edit = row; S.error = ""; S.info = ""; redraw(); }
  document.addEventListener("click", (event) => {
    const target = event.target.closest("[data-ed-action]");
    if (!target || !el() || S.busy) return;
    event.preventDefault();
    const action = target.dataset.edAction;
    const id = target.dataset.edId;
    if (action === "signout") return logout();
    if (action === "cancel") return setForm("");
    if (action === "new-edition") return setForm("edition");
    if (action === "new-grade") return setForm("grade");
    if (action === "new-session") return setForm("session");
    if (action === "new-area") return setForm("area");
    if (action === "new-item") return setForm("item");
    if (action === "prev") { S.page = Math.max(0, S.page - 1); return redraw(); }
    if (action === "next") { S.page += 1; return redraw(); }
    if (action === "edit-grade") return setForm("grade", grades().find((x) => num(x.grado) === S.grade) || null);
    if (action === "edit-session") return setForm("session", sessions().find((x) => String(x.numero) === id) || null);
    if (action === "edit-area") return setForm("area", areas().find((x) => x.area === id) || null);
    if (action === "edit-item") return setForm("item", items().find((x) => String(x.numero_item) === id) || null);
    if (action === "reload") return task(() => loadEditions(), "Datos actualizados.");
  });
  document.addEventListener("change", (event) => {
    const target = event.target.closest("[data-ed-select]");
    if (!target || !el() || S.busy) return;
    if (target.dataset.edSelect === "grade") {
      S.grade = num(target.value);
      S.form = ""; S.edit = null; S.page = 0; redraw();
    }
    if (target.dataset.edSelect === "edition") {
      S.edition = target.value; S.form = ""; S.edit = null;
      task(() => loadConfiguration(S.edition), "Edición cargada.");
    }
  });
  document.addEventListener("submit", (event) => {
    const form = event.target.closest("form[data-ed-form]");
    if (!form || !el() || S.busy) return;
    event.preventDefault();
    const kind = form.dataset.edForm;
    const values = Object.fromEntries(new FormData(form).entries());
    if (kind === "login") {
      const password = String(values.password || "");
      const email = String(values.email || "").trim();
      if (!password || !email) return;
      S.email = email;
      task(async () => {
        applyToken(await authRequest("token?grant_type=password", { email, password }));
        try { await loadEditions(); }
        catch (error) { logout(); throw error; }
      }, "Acceso administrativo confirmado.");
      return;
    }
    if (!editAllowed() && kind !== "edition") { S.error = "Solo puedes editar borradores."; redraw(); return; }
    if (kind === "generate") {
      const map = {};
      Object.entries(values).forEach(([name, value]) => {
        if (name.startsWith("sesion:")) map[name.slice(7)] = num(value);
      });
      return task(async () => {
        const result = await rpc("roque_v2_admin_generar_items",
          { p_edicion: S.edition, p_grado: S.grade, p_sesiones: map });
        if (result && result.ok === false) throw new Error(result.error || "No se generaron preguntas.");
        await loadConfiguration(S.edition);
        await loadEditions(S.edition);
      }, "Preguntas generadas. Ahora configura las claves correctas.");
    }
    if (kind === "edition") {
      const data = { codigo: String(values.codigo || "").trim(), titulo: String(values.titulo || "").trim(),
        plantilla: values.plantilla || null };
      if (!/^[0-9]{4}-[12]S$/.test(data.codigo)) { S.error = "Código inválido (ej. 2027-1S)."; redraw(); return; }
      return task(() => save("crear_edicion", data), "Edición creada en borrador.");
    }
    const data = { ...values, edicion: S.edition, grado: kind === "grade" ? num(values.grado) : S.grade };
    ["activo", "anulada"].forEach((k) => { if (kind === "grade" || kind === "area" || kind === "item") {
      if (k === "activo" || (k === "anulada" && kind === "item")) data[k] = values[k] === "on";
    } });
    const operation = { grade: "guardar_grado", session: "guardar_sesion",
      area: "guardar_area", item: "guardar_item" }[kind];
    if (!operation) return;
    return task(async () => {
      await save(operation, data);
      if (kind === "grade") S.grade = num(data.grado);
    }, "Cambios guardados en " + S.edition + ".");
  });
  async function adoptAuthSession(session) { applyToken(session); await loadEditions(); }
  window.RoqueEdiciones = { render, logout, adoptAuthSession };
})();