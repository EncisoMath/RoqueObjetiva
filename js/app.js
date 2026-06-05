
(() => {
  "use strict";

  const app = document.getElementById("app");
  const toastEl = document.getElementById("toast");
  const modalRoot = document.getElementById("modal-root");

  const STORAGE = {
    config: "po_config_v1",
    logos: "po_subject_logos_v1",
    answers: "po_answer_overrides_v1",
    carga: "po_carga_override_v1",
    session: "po_session_v1",
    github: "po_github_publish_v1"
  };

  const SUBJECTS = [
    { name: "Matemáticas", short: "Matemáticas", icon: "∑" },
    { name: "Lenguaje", short: "Lenguaje", icon: "📖" },
    { name: "Ciencias Naturales", short: "Naturales", icon: "🌿" },
    { name: "Inglés", short: "Inglés", icon: "Hi" },
    { name: "Ciencias Sociales y Ciudadanía", short: "Sociales", icon: "🌎" },
    { name: "Ética y Valores", short: "Ética", icon: "🤝" },
    { name: "Artística", short: "Artística", icon: "🎨" },
    { name: "Educación Física", short: "Ed. Física", icon: "🏃" },
    { name: "Informática", short: "Informática", icon: "💻" },
    { name: "Religión", short: "Religión", icon: "🕊️" }
  ];

  const DEFAULT_CONFIG = {
    title: "Resultados de Pruebas Objetivas",
    subtitle: "Este reporte no se pasa ni se pierde. Es una herramienta para identificar fortalezas, habilidades y oportunidades de mejora.",
    logoImage: "assets/default-logo.svg",
    bannerImage: "",
    footerText: "Consulta institucional de resultados",
    primaryColor: "#ff7900",
    buttonRadius: 4,
    logoZoom: 1,
    subjectLogos: {},
    github: { owner: "", repo: "", branch: "main" }
  };

  const DEFAULT_MANIFEST = {
    config: "config/site-config.json",
    keys: [{ grade: 10, path: "KEYS/KEYS_10.json" }],
    resultados: [
      { grade: 10, session: 1, startItem: 1, path: "RESULTADOS/10S1.json" },
      { grade: 10, session: 2, startItem: 71, path: "RESULTADOS/10S2.json" }
    ],
    estudiantes: "ESTUDIANTES/ESTUDIANTES.json",
    carga: "INTERNO/CARGA.json"
  };

  const state = {
    manifest: DEFAULT_MANIFEST,
    config: { ...DEFAULT_CONFIG },
    logos: {},
    keys: [],
    studentsRegistry: [],
    cargaRows: [],
    teachers: new Map(),
    responsesByRoll: new Map(),
    computedStudents: [],
    computedByRoll: new Map(),
    studentLogin: new Map(),
    registryByExamId: new Map(),
    registryByNationalId: new Map(),
    selectedSubject: null,
    metricTab: "components",
    teacherActive: null,
    teacherSearch: "",
    adminTab: "resumen",
    adminStudentSearch: "",
    adminGradeFilter: "all",
    adminSubjectFilter: "all",
    activeSession: null
  };

  document.addEventListener("DOMContentLoaded", init);
  document.addEventListener("submit", handleSubmit);
  document.addEventListener("click", handleClick);
  document.addEventListener("input", handleInput);
  document.addEventListener("change", handleChange);
  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeModal();
  });

  async function init() {
    try {
      loadLocalState();
      await loadAllData();
      buildRepository();
      const saved = readJSON(STORAGE.session, null);
      if (saved && saved.role) {
        state.activeSession = saved;
        renderBySession();
      } else {
        renderLogin();
      }
    } catch (error) {
      console.error(error);
      app.innerHTML = `
        <div class="boot">
          <div class="boot-mark"></div>
          <h1>No fue posible cargar la información</h1>
          <p>${esc(error.message || "Revisa que las carpetas y los JSON existan en el repositorio.")}</p>
          <button class="primary-btn" data-action="retry">Reintentar</button>
        </div>
      `;
    }
  }

  function loadLocalState() {
    state.config = { ...DEFAULT_CONFIG, ...readJSON(STORAGE.config, {}) };
    state.logos = readJSON(STORAGE.logos, {});
    const storedCarga = readJSON(STORAGE.carga, null);
    if (storedCarga && Array.isArray(storedCarga.rows)) {
      state.cargaRows = storedCarga.rows;
    }
  }

  async function loadAllData() {
    const manifestText = await fetchText("config/data-manifest.json", false);
    if (manifestText) {
      state.manifest = { ...DEFAULT_MANIFEST, ...JSON.parse(manifestText) };
    }

    const savedConfig = readJSON(STORAGE.config, null);
    const localLogos = readJSON(STORAGE.logos, {});
    const configText = await fetchText(state.manifest.config || "config/site-config.json", false);
    let fileConfig = {};
    if (configText) {
      const parsedConfig = JSON.parse(configText);
      fileConfig = parsedConfig.config || parsedConfig;
    }
    state.config = { ...DEFAULT_CONFIG, ...fileConfig, ...(savedConfig || {}) };
    state.config.subjectLogos = { ...(fileConfig.subjectLogos || {}), ...(savedConfig?.subjectLogos || {}) };
    state.logos = { ...state.config.subjectLogos, ...localLogos };

    state.keys = [];
    state.responsesByRoll = new Map();

    const studentText = await fetchText(state.manifest.estudiantes, true);
    state.studentsRegistry = parseStudents(studentText);

    const storedCarga = readJSON(STORAGE.carga, null);
    if (storedCarga && Array.isArray(storedCarga.rows)) {
      state.cargaRows = storedCarga.rows;
    } else {
      const cargaText = await fetchText(state.manifest.carga, true);
      state.cargaRows = parseCarga(cargaText);
    }

    for (const keyFile of state.manifest.keys || []) {
      const text = await fetchText(keyFile.path, true);
      state.keys.push(...parseAnswerKey(text, keyFile));
    }

    applyAnswerOverrides();

    for (const resultFile of state.manifest.resultados || []) {
      const text = await fetchText(resultFile.path, true);
      parseResultFile(text, resultFile);
    }
  }

  async function fetchText(path, required = true) {
    if (!path) {
      if (required) throw new Error("Falta una ruta en el manifiesto.");
      return "";
    }
    try {
      const url = `${path}${path.includes("?") ? "&" : "?"}v=${Date.now()}`;
      const response = await fetch(url, { cache: "no-store" });
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      return await response.text();
    } catch (error) {
      if (!required) return "";
      throw new Error(`No se pudo leer "${path}". En GitHub Pages verifica la carpeta, el nombre y las mayúsculas/minúsculas.`);
    }
  }

  function parseStudents(text) {
    const objects = parseDataObjects(text, ["ID_PRUEBA", "NOMBRES"]);
    return objects.map((row) => {
      const apellidos = cleanText(row.APELLIDOS || row.Apellidos || row.apellidos);
      const nombres = cleanText(row.NOMBRES || row.Nombres || row.Name || row.Nombre || row.nombre);
      const fullName = cleanText(nombres && apellidos ? `${nombres} ${apellidos}` : (nombres || apellidos));
      return {
        examId: cleanId(row.ID_PRUEBA || row.IdPrueba || row.ID || row.Id || row.id),
        nationalId: cleanId(row.ID_ALUMNO || row.IdAlumno || row["Carné"] || row.Carne || row.Carnet || row.Documento || row.documento),
        name: fullName,
        sede: cleanText(row.SEDE || row.Sede),
        grade: toInt(row.GRADO || row.Grado),
        group: cleanText(row.GRUPO || row.Grupo || row.CURSO || row.Curso)
      };
    }).filter((s) => s.examId || s.nationalId || s.name);
  }

  function parseCarga(text) {
    const objects = parseDataObjects(text, ["ID", "ASIGNATURA"]);
    return objects.map((row) => ({
      id: cleanId(row.ID || row.Id || row.id),
      name: cleanText(row.NOMBRE || row.Nombre || row.Name),
      subjectRaw: cleanText(row.ASIGNATURA || row.Asignatura || row.Area || row["Área"]),
      subject: canonicalSubject(row.ASIGNATURA || row.Asignatura || row.Area || row["Área"]),
      sede: cleanText(row.SEDE || row.Sede),
      grade: toInt(row.GRADO || row.Grado),
      group: cleanText(row.CURSO || row.Curso || row.GRUPO || row.Grupo)
    })).filter((r) => r.id && r.subjectRaw && r.grade);
  }

  function parseAnswerKey(text, fileInfo) {
    const objects = parseDataObjects(text, ["Respuesta sugerida"]);
    const grade = toInt(fileInfo.grade) || inferGradeFromPath(fileInfo.path);
    return objects
      .map((row, idx) => ({
        sourcePath: fileInfo.path,
        grade,
        areaRaw: cleanText(row["Área"] || row.Area || row.AREA || row.Asignatura || row.ASIGNATURA),
        area: canonicalSubject(row["Área"] || row.Area || row.AREA || row.Asignatura || row.ASIGNATURA),
        item: toInt(row["Número de ítem"] || row["Numero de item"] || row.Numero || row.Número || row.Item || row.ITEM || row["N°"]),
        correct: cleanOption(row["Respuesta sugerida"] || row.Respuesta || row.RESPUESTA || row.Key),
        component: cleanText(row["Componente / pensamiento / entorno / factor / enfoque"] || row.Componente || row.COMPONENTE || row.Pensamiento || row.Enfoque),
        competence: cleanText(row.Competencia || row.COMPETENCIA || row.Competencias),
        idx
      }))
      .filter((r) => r.grade && r.area && r.item && r.correct);
  }

  function parseResultFile(text, fileInfo) {
    const objects = parseDataObjects(text, ["Roll No"]);
    const grade = toInt(fileInfo.grade) || inferGradeFromPath(fileInfo.path) || inferGradeFromExam(objects);
    const session = toInt(fileInfo.session) || inferSessionFromPath(fileInfo.path);
    const startItem = toInt(fileInfo.startItem) || (session === 2 ? 71 : 1);

    for (const row of objects) {
      const roll = cleanId(row["Roll No"] || row.RollNo || row.Roll || row.ID || row.ID_PRUEBA);
      if (!roll) continue;

      const current = state.responsesByRoll.get(roll) || {
        roll,
        name: cleanText(row.Name || row.Nombre || row.NOMBRE),
        grade,
        sessions: [],
        answers: {}
      };

      if (!current.name) current.name = cleanText(row.Name || row.Nombre || row.NOMBRE);
      if (!current.grade) current.grade = grade;
      current.sessions.push({ session, path: fileInfo.path });

      Object.entries(row).forEach(([key, value]) => {
        const match = String(key).match(/^Q\s*(\d+)\s*Options$/i) || String(key).match(/^q\s*(\d+)$/i);
        if (!match) return;
        const localItem = Number(match[1]);
        const globalItem = startItem + localItem - 1;
        current.answers[globalItem] = cleanMarked(value);
      });

      state.responsesByRoll.set(roll, current);
    }
  }

  function applyAnswerOverrides() {
    const overrides = readJSON(STORAGE.answers, {});
    state.keys = state.keys.map((row) => {
      const id = keyId(row);
      return overrides[id] ? { ...row, correct: cleanOption(overrides[id]) } : row;
    });
  }

  function buildRepository() {
    state.registryByExamId = new Map();
    state.registryByNationalId = new Map();
    state.studentsRegistry.forEach((student) => {
      if (student.examId) state.registryByExamId.set(student.examId, student);
      if (student.nationalId) state.registryByNationalId.set(student.nationalId, student);
    });

    state.teachers = new Map();
    for (const row of state.cargaRows) {
      if (!state.teachers.has(row.id)) {
        state.teachers.set(row.id, { id: row.id, name: row.name, assignments: [] });
      }
      const teacher = state.teachers.get(row.id);
      if (!teacher.name && row.name) teacher.name = row.name;
      const assignmentKey = assignmentKeyFor(row);
      if (!teacher.assignments.some((a) => a.key === assignmentKey)) {
        teacher.assignments.push({
          key: assignmentKey,
          grade: row.grade,
          subject: canonicalSubject(row.subjectRaw),
          subjectRaw: row.subjectRaw,
          sede: row.sede || "",
          group: row.group || ""
        });
      }
    }

    const keysByGrade = groupBy(state.keys, (row) => String(row.grade));
    state.computedStudents = Array.from(state.responsesByRoll.values()).map((record) => {
      const registry = state.registryByExamId.get(record.roll);
      const grade = toInt(registry?.grade) || toInt(record.grade);
      const keys = keysByGrade.get(String(grade)) || [];
      const subjectStats = {};
      const allDetails = [];

      for (const subject of SUBJECTS) {
        const subjectKeys = keys.filter((key) => sameSubject(key.area, subject.name));
        const details = subjectKeys.map((key) => {
          const marked = record.answers[key.item] || "";
          const status = classifyAnswer(marked, key.correct);
          return {
            item: key.item,
            subject: subject.name,
            marked,
            correct: key.correct,
            status,
            component: key.component,
            competence: key.competence
          };
        });

        const total = details.length;
        const correct = details.filter((d) => d.status === "correct").length;
        const wrong = details.filter((d) => d.status === "wrong").length;
        const doubleMark = details.filter((d) => d.status === "double").length;
        const empty = details.filter((d) => d.status === "empty").length;

        subjectStats[subject.name] = {
          subject: subject.name,
          total,
          correct,
          wrong,
          doubleMark,
          empty,
          score: total ? calculateScore(correct, total) : null,
          percentile: 0,
          details
        };

        allDetails.push(...details);
      }

      const total = allDetails.length;
      const correct = allDetails.filter((d) => d.status === "correct").length;
      const wrong = allDetails.filter((d) => d.status === "wrong").length;
      const doubleMark = allDetails.filter((d) => d.status === "double").length;
      const empty = allDetails.filter((d) => d.status === "empty").length;

      return {
        roll: record.roll,
        loginIds: [record.roll, registry?.nationalId].filter(Boolean),
        name: cleanText(registry?.name) || cleanText(record.name) || `Estudiante ${record.roll}`,
        scannedName: cleanText(record.name),
        grade,
        group: cleanText(registry?.group) || `Grado ${grade}`,
        sede: cleanText(registry?.sede) || "Sin sede registrada",
        registry,
        total,
        correct,
        wrong,
        doubleMark,
        empty,
        globalScore: calculateSaberGlobal(subjectStats),
        rawGlobalScore: total ? calculateScore(correct, total) : null,
        percentile: 0,
        gradeRank: null,
        gradeCount: null,
        courseRank: null,
        courseCount: null,
        subjectStats
      };
    });

    assignRanks();

    state.computedByRoll = new Map();
    state.studentLogin = new Map();
    for (const student of state.computedStudents) {
      state.computedByRoll.set(student.roll, student);
      student.loginIds.forEach((id) => state.studentLogin.set(id, student.roll));
    }

    for (const registry of state.studentsRegistry) {
      if (registry.examId && !state.studentLogin.has(registry.examId)) {
        state.studentLogin.set(registry.examId, registry.examId);
      }
      if (registry.nationalId && !state.studentLogin.has(registry.nationalId)) {
        state.studentLogin.set(registry.nationalId, registry.examId || registry.nationalId);
      }
    }
  }

  function assignRanks() {
    const byGrade = groupBy(state.computedStudents.filter((s) => s.globalScore !== null), (s) => String(s.grade || ""));
    byGrade.forEach((students) => {
      students.forEach((student) => {
        student.gradeCount = students.length;
        student.gradeRank = 1 + students.filter((other) => (other.globalScore || 0) > (student.globalScore || 0)).length;
        student.percentile = students.length ? Math.round((students.filter((other) => (other.globalScore || 0) < (student.globalScore || 0)).length / students.length) * 100) : 0;
      });

      const byCourse = groupBy(students, (s) => `${s.grade}|${s.group || ""}`);
      byCourse.forEach((courseStudents) => {
        courseStudents.forEach((student) => {
          student.courseCount = courseStudents.length;
          student.courseRank = 1 + courseStudents.filter((other) => (other.globalScore || 0) > (student.globalScore || 0)).length;
        });
      });

      for (const subject of SUBJECTS) {
        const scored = students.filter((student) => student.subjectStats[subject.name]?.score !== null);
        scored.forEach((student) => {
          const stat = student.subjectStats[subject.name];
          stat.percentile = scored.length ? Math.round((scored.filter((other) => (other.subjectStats[subject.name]?.score || 0) < stat.score).length / scored.length) * 100) : 0;
        });
      }
    });
  }

  function renderBySession() {
    if (!state.activeSession) return renderLogin();

    if (state.activeSession.role === "admin") {
      return renderAdmin();
    }

    if (state.activeSession.role === "teacher") {
      const teacher = state.teachers.get(state.activeSession.id);
      if (!teacher) {
        clearSession();
        return renderLogin("No se encontró el docente. Revisa la carga.");
      }
      return renderTeacher(teacher);
    }

    if (state.activeSession.role === "student") {
      return renderStudent(state.activeSession.roll);
    }

    renderLogin();
  }

  function renderLogin(error = "") {
    const primary = normalizeColor(state.config.primaryColor || "#ff7900");
    const primaryDark = shadeColor(primary, -18);
    const primarySoft = mixWithWhite(primary, 34);
    const rgb = hexToRgb(primary);
    document.documentElement.style.setProperty("--button-radius", `${Number(state.config.buttonRadius ?? 4)}px`);
    document.documentElement.style.setProperty("--logo-zoom", `${Number(state.config.logoZoom ?? 1)}`);
    document.documentElement.style.setProperty("--orange", primary);
    document.documentElement.style.setProperty("--orange-2", primarySoft);
    document.documentElement.style.setProperty("--orange-3", primaryDark);
    document.documentElement.style.setProperty("--primary-rgb", `${rgb.r}, ${rgb.g}, ${rgb.b}`);
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", primary);
    const logo = state.config.logoImage || "assets/default-logo.svg";
    app.innerHTML = `
      <section class="login-shell">
        <div class="login-panel">
          <div class="login-card">
            <span class="login-eyebrow">Consulta de resultados</span>
            <h1>Bienvenido</h1>
            <p>Ingresa con el ID del examen, el documento del estudiante o el ID docente. Para administración usa <strong>admin</strong> / <strong>admin</strong>.</p>
            ${error ? `<div class="admin-note">${esc(error)}</div>` : ""}
            <form class="login-form" id="loginForm">
              <div class="field">
                <label for="loginUser">Usuario o ID</label>
                <input id="loginUser" autocomplete="username" placeholder="Ej. 2585, 1085111839, ID docente o admin" required />
              </div>
              <div class="field">
                <label for="loginPass">Contraseña</label>
                <input id="loginPass" type="password" autocomplete="current-password" placeholder="Solo requerida para admin" />
              </div>
              <div class="login-actions">
                <button class="primary-btn" type="submit">Ingresar</button>
                <span class="login-hint">Los estudiantes y docentes ingresan solo con su ID.</span>
              </div>
            </form>
          </div>
        </div>
        <div class="login-hero">
          <div class="hero-logo">
            ${logo ? `<img src="${escAttr(logo)}" alt="Logo institucional">` : `<div class="hero-wordmark">icfes+</div>`}
          </div>
        </div>
      </section>
    `;
    setTimeout(() => document.getElementById("loginUser")?.focus(), 50);
  }

  function renderShell(content, nav = "") {
    const cfg = state.config;
    const primary = normalizeColor(cfg.primaryColor || "#ff7900");
    const primaryDark = shadeColor(primary, -18);
    const primarySoft = mixWithWhite(primary, 34);
    const rgb = hexToRgb(primary);
    document.documentElement.style.setProperty("--orange", primary);
    document.documentElement.style.setProperty("--orange-2", primarySoft);
    document.documentElement.style.setProperty("--orange-3", primaryDark);
    document.documentElement.style.setProperty("--primary-rgb", `${rgb.r}, ${rgb.g}, ${rgb.b}`);
    document.documentElement.style.setProperty("--button-radius", `${Number(cfg.buttonRadius ?? 4)}px`);
    document.documentElement.style.setProperty("--logo-zoom", `${Number(cfg.logoZoom ?? 1)}`);
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", primary);
    const bannerStyle = cfg.bannerImage
      ? `style="background-image: linear-gradient(100deg, ${alphaColor(primary, .88)}, ${alphaColor(primaryDark, .82)}), url('${escAttr(cfg.bannerImage)}')"`
      : "";
    app.innerHTML = `
      <div class="app-shell">
        <header class="top-banner" ${bannerStyle}>
          <div class="banner-inner">
            <div class="banner-copy">
              <h1>${esc(cfg.title)}</h1>
              <p>${esc(cfg.subtitle)}</p>
            </div>
            <div class="banner-brand">
              ${cfg.logoImage ? `<span class="banner-logo-frame"><img class="banner-logo" src="${escAttr(cfg.logoImage)}" alt="Logo"></span>` : `<div class="banner-mark-text">Resultados</div>`}
            </div>
          </div>
          ${nav}
        </header>
        <main class="page">
          ${content}
        </main>
      </div>
    `;
  }

  function renderStudent(roll) {
    const student = state.computedByRoll.get(roll);
    if (!student) {
      const registry = state.registryByExamId.get(roll) || Array.from(state.registryByNationalId.values()).find((s) => s.examId === roll);
      renderShell(`
        <div class="card card-pad empty-state">
          <h2>No hay resultados cargados para este estudiante</h2>
          <p>${registry ? `El estudiante ${esc(registry.name)} está registrado, pero no aparece en los archivos de RESULTADOS.` : "El ID ingresado no tiene un examen asociado."}</p>
          <button class="ghost-btn" data-action="logout">Salir</button>
        </div>
      `, navFor("student"));
      return;
    }

    const availableSubjects = SUBJECTS.filter((s) => student.subjectStats[s.name]?.total);
    if (state.selectedSubject && !student.subjectStats[state.selectedSubject]?.total) {
      state.selectedSubject = null;
    }
    if (!state.metricTab) state.metricTab = "components";
    const subject = state.selectedSubject;
    const stat = subject ? student.subjectStats[subject] : null;

    const subjectItems = availableSubjects.map((item) => {
      const s = student.subjectStats[item.name];
      const active = item.name === subject;
      return `
        <article class="subject-list-item ${active ? "active" : ""}">
          <button class="subject-row" data-action="select-subject" data-subject="${escAttr(item.name)}" aria-expanded="${active ? "true" : "false"}">
            <span class="subject-row-left">
              ${subjectIcon(item.name)}
              <span>${esc(item.short)}</span>
            </span>
            <span class="subject-row-right">
              <span class="subject-score">${s.score ?? "—"}<small>/100</small></span>
              <span class="subject-chevron" aria-hidden="true">⌄</span>
            </span>
          </button>
          <div class="subject-mobile-detail" aria-hidden="${active ? "false" : "true"}">
            <div class="subject-mobile-detail-inner">
              ${active ? buildSubjectDetailHtml(student, subject, stat, false) : ""}
            </div>
          </div>
        </article>
      `;
    }).join("");

    renderShell(`
      <section class="student-summary card">
        <div class="summary-score-block saber-score-block" data-action="global-info" data-roll="${escAttr(student.roll)}" role="button" tabindex="0">
          <div class="score-label"><span class="score-icon">🏆</span><span>Si esto fuese una prueba Saber, tu puntaje global sería...</span></div>
          <div class="score-number">${student.globalScore ?? "—"}<small>puntos</small></div>
          <button type="button" class="score-help" data-action="global-info" data-roll="${escAttr(student.roll)}">Toca para entender cómo se calcula este puntaje</button>
        </div>
        <div class="summary-info-block">
          <div class="student-identity">
            <span>Alumno</span>
            <strong>${esc(student.name)}</strong>
          </div>
          <div class="student-identity">
            <span>Identificación</span>
            <strong>${esc(student.registry?.nationalId || student.roll)}</strong>
          </div>
          <div class="student-identity">
            <span>Grado y curso</span>
            <strong>${esc(student.grade)}° · ${esc(student.group)}</strong>
          </div>
          <div class="student-identity">
            <span>Sede</span>
            <strong>${esc(student.sede)}</strong>
          </div>
        </div>
        <div class="ranking-mini">
          ${rankingBoxHtml(student.courseRank, "Ranking por curso")}
          ${rankingBoxHtml(student.gradeRank, "Ranking por grado")}
        </div>
      </section>

      <section class="student-workspace">
        <aside class="subject-list-panel">
          <h2>Puntaje por pruebas</h2>
          <div class="subject-list">${subjectItems}</div>
        </aside>
        <section class="student-detail-panel card detail-card ${subject ? "" : "is-empty"}">
          ${subject ? buildSubjectDetailHtml(student, subject, stat, false) : buildEmptySubjectDetailHtml()}
        </section>
      </section>
    `, navFor("student"));
  }

  function transitionStudentSubject(nextSubject, trigger) {
    const current = state.selectedSubject;
    const same = current === nextSubject;
    const detailPanel = document.querySelector(".student-detail-panel");
    const currentItem = same ? trigger?.closest(".subject-list-item") : document.querySelector(".subject-list-item.active");

    if (!current && !same) {
      state.selectedSubject = nextSubject;
      state.metricTab = "components";
      renderBySession();
      return;
    }

    detailPanel?.classList.add("detail-fading-out");
    currentItem?.classList.add("closing");

    window.setTimeout(() => {
      if (same) {
        state.selectedSubject = null;
      } else {
        state.selectedSubject = nextSubject;
        state.metricTab = "components";
      }
      renderBySession();
    }, 220);
  }

  function updateMetricTabDom() {
    const activeMetric = state.metricTab === "competences" ? "competences" : "components";
    document.querySelectorAll(".metric-tab").forEach((button) => {
      button.classList.toggle("active", button.dataset.tab === activeMetric);
    });
    document.querySelectorAll(".metric-grid").forEach((grid) => {
      grid.dataset.active = activeMetric;
      grid.classList.remove("metric-switching");
      void grid.offsetWidth;
      grid.classList.add("metric-switching");
    });
  }

  function buildEmptySubjectDetailHtml() {
    return `
      <div class="empty-subject-detail">
        <div class="empty-subject-icon">↙</div>
        <h3>Selecciona una asignatura</h3>
        <p>Al tocar una prueba se abrirá aquí su detalle, con las opciones marcadas y el análisis por componentes y competencias.</p>
      </div>
    `;
  }

  function buildSubjectDetailHtml(student, subject, stat, compact = false) {
    if (!stat) return `<div class="empty-state">No hay información para esta asignatura.</div>`;
    const detailRows = (stat.details || []).map((detail, index) => answerPill(detail, student.roll, index + 1)).join("");
    const activeMetric = state.metricTab === "competences" ? "competences" : "components";
    return `
      <div class="subject-detail">
        <header class="subject-detail-head">
          <div class="subject-detail-title">
            ${subjectIcon(subject)}
            <div>
              <span>Prueba</span>
              <h3>${esc(subject)}</h3>
            </div>
          </div>
          <div class="subject-detail-score">${stat.score ?? "—"}<small>/100</small></div>
        </header>

        <div class="subject-stats-row">
          <div><span>Correctas</span><strong>${stat.correct ?? 0} de ${stat.total ?? 0}</strong></div>
          <div><span>Incorrectas</span><strong>${(stat.wrong ?? 0) + (stat.doubleMark ?? 0)}</strong></div>
          <div><span>Sin marcar</span><strong>${stat.empty ?? 0}</strong></div>
        </div>

        <div class="answer-tools clean">
          <h4>Estas fueron las opciones que marcaste</h4>
          <div class="legend">
            <span class="legend-item"><i class="dot correct"></i>Correcta</span>
            <span class="legend-item"><i class="dot wrong"></i>Incorrecta</span>
            <span class="legend-item"><i class="dot double"></i>Doble marca</span>
            <span class="legend-item"><i class="dot empty"></i>Sin marcar</span>
          </div>
        </div>
        <div class="answers-grid">${detailRows || `<div class="empty-state">No hay ítems para esta asignatura.</div>`}</div>

        <div class="metric-tabs" role="tablist" aria-label="Análisis por componente y competencia">
          <button class="metric-tab ${activeMetric === "components" ? "active" : ""}" data-action="select-metric-tab" data-tab="components">Componentes</button>
          <button class="metric-tab ${activeMetric === "competences" ? "active" : ""}" data-action="select-metric-tab" data-tab="competences">Competencias</button>
        </div>

        <div class="metric-grid" data-active="${escAttr(activeMetric)}">
          <section class="metric-panel components">
            <h4>Componentes evaluados</h4>
            ${buildMetricBars(stat.details || [], "component")}
          </section>
          <section class="metric-panel competences">
            <h4>Competencias evaluadas</h4>
            ${buildMetricBars(stat.details || [], "competence")}
          </section>
        </div>
      </div>
    `;
  }

  function renderTeacher(teacher) {
    const assignments = teacher.assignments || [];
    if (!state.teacherActive || !assignments.some((a) => a.key === state.teacherActive.key)) {
      state.teacherActive = assignments.find((assignment) => state.computedStudents.some((student) => teacherAssignmentMatches(student, assignment))) || assignments[0] || null;
    }

    const active = state.teacherActive;
    const assignmentButtons = assignments.map((a) => `
      <button class="tab-btn ${active?.key === a.key ? "active" : ""}" data-action="teacher-assignment" data-key="${escAttr(a.key)}" data-grade="${escAttr(a.grade)}" data-subject="${escAttr(a.subject)}" data-group="${escAttr(a.group || "")}" data-sede="${escAttr(a.sede || "")}">
        ${esc(a.subject)} · ${esc(a.grade)}°${a.group ? ` · ${esc(a.group)}` : ""}
      </button>
    `).join("");

    const students = active
      ? state.computedStudents.filter((student) => teacherAssignmentMatches(student, active))
      : [];

    const query = normalizeText(state.teacherSearch);
    const filtered = students
      .filter((s) => !query || normalizeText(`${s.name} ${s.roll} ${s.group}`).includes(query))
      .sort((a, b) => a.name.localeCompare(b.name, "es", { sensitivity: "base" }));

    const rows = filtered.map((student, index) => {
      const stat = student.subjectStats[active.subject];
      return `
        <tr class="table-row-click" data-action="open-detail" data-roll="${escAttr(student.roll)}" data-subject="${escAttr(active.subject)}">
          <td class="teacher-index">${index + 1}</td>
          <td><strong>${esc(student.name)}</strong><br><span class="student-subid">ID Prueba ${esc(student.roll)}</span></td>
          <td><span class="teacher-score">${stat.score ?? "—"}<small>/100</small></span></td>
          <td><strong>${stat.correct}/${stat.total}</strong></td>
        </tr>
      `;
    }).join("");

    renderShell(`
      <section class="toolbar teacher-toolbar">
        <div>
          <span class="section-eyebrow">Panel docente</span>
          <h2 style="margin:8px 0 0;font-size:clamp(1.4rem,4vw,2.2rem);font-weight:900;letter-spacing:-.04em;">${esc(teacher.name || "Docente")}</h2>
          ${active ? `<p class="teacher-active-label">${esc(active.subject)} · ${esc(active.grade)}°${active.group ? ` · ${esc(active.group)}` : ""}</p>` : ""}
        </div>
        <div class="search-box"><input placeholder="Buscar estudiante..." value="${escAttr(state.teacherSearch)}" data-action="teacher-search"></div>
      </section>

      <nav class="teacher-assignment-nav">${assignmentButtons || `<span class="badge gray">Sin cargas asignadas</span>`}</nav>

      ${active ? `
        <section class="teacher-stat-strip">
          <article class="card card-pad teacher-stat"><span>Grado</span><strong>${esc(active.grade)}°${active.group ? ` · ${esc(active.group)}` : ""}</strong></article>
          <article class="card card-pad teacher-stat"><span>Estudiantes</span><strong>${filtered.length}</strong></article>
          <article class="card card-pad teacher-stat"><span>Promedio</span><strong>${avg(filtered.map((s) => s.subjectStats[active.subject].score))}<small>/100</small></strong></article>
        </section>
        <section class="teacher-metrics-row">
          ${teacherAggregateMetricsHtml(filtered, active.subject)}
        </section>
        <section class="teacher-key-actions">
          <button class="secondary-btn" data-action="open-answer-key" data-grade="${escAttr(active.grade)}" data-subject="${escAttr(active.subject)}">Ver respuestas correctas</button>
        </section>
      ` : ""}

      <section class="card table-card teacher-table-card">
        <div class="table-wrap">
          <table class="teacher-table">
            <thead><tr><th>#</th><th>Estudiante</th><th>Nota</th><th>Correctas</th></tr></thead>
            <tbody>${rows || `<tr><td colspan="4" class="empty-state">No hay estudiantes para esta asignación con los archivos cargados.</td></tr>`}</tbody>
          </table>
        </div>
      </section>
    `, navFor("teacher"));
  }

  function teacherAggregateMetricsHtml(students, subject) {
    const details = students.flatMap((student) => student.subjectStats[subject]?.details || []);
    return `
      <article class="teacher-metric-card">
        <h3>Promedio por componentes</h3>
        ${buildMetricBars(details, "component")}
      </article>
      <article class="teacher-metric-card">
        <h3>Promedio por competencias</h3>
        ${buildMetricBars(details, "competence")}
      </article>
    `;
  }

  function renderAdmin() {
    const tabs = [
      ["resumen", "Resumen"],
      ["estudiantes", "Estudiantes"],
      ["apariencia", "Apariencia"],
      ["logos", "Logos"],
      ["cargas", "Cargas"],
      ["claves", "Claves"],
      ["github", "GitHub"]
    ];

    const nav = `
      <nav class="app-nav">
        ${tabs.map(([id, label]) => `<button class="nav-chip ${state.adminTab === id ? "active" : ""}" data-action="admin-tab" data-tab="${id}">${label}</button>`).join("")}
        <button class="nav-chip logout" data-action="logout">Salir</button>
      </nav>
    `;

    const menu = `
      <aside class="card admin-menu">
        ${tabs.map(([id, label]) => `<button class="ghost-btn ${state.adminTab === id ? "active" : ""}" data-action="admin-tab" data-tab="${id}">${label}</button>`).join("")}
      </aside>
    `;

    renderShell(`
      <section class="admin-layout">
        ${menu}
        <div class="admin-panel">${renderAdminTab()}</div>
      </section>
    `, nav);
  }

  function renderAdminTab() {
    switch (state.adminTab) {
      case "estudiantes": return adminStudentsHtml();
      case "apariencia": return adminAppearanceHtml();
      case "logos": return adminLogosHtml();
      case "cargas": return adminCargaHtml();
      case "claves": return adminKeysHtml();
      case "github": return adminGithubHtml();
      default: return adminSummaryHtml();
    }
  }

  function adminSummaryHtml() {
    const grades = [...new Set(state.computedStudents.map((s) => s.grade).filter(Boolean))].sort((a, b) => a - b);
    const avgGlobal = avg(state.computedStudents.map((s) => s.globalScore));
    return `
      <section class="toolbar">
        <div>
          <span class="section-eyebrow">Administración</span>
          <h2 style="margin:8px 0 0;font-size:clamp(1.5rem,4vw,2.4rem);font-weight:900;letter-spacing:-.04em;">Panel general</h2>
        </div>
        <div class="inline-actions">
          <button class="secondary-btn" data-action="export-config">Exportar configuración</button>
        </div>
      </section>
      <div class="admin-note">
Esta versión funciona en GitHub Pages como aplicación estática. Los cambios se guardan localmente mientras editas. Para que los vea todo el mundo, entra a la pestaña <strong>GitHub</strong> y publícalos directamente en el repositorio.
      </div>
      <section class="grid grid-auto">
        <article class="card card-pad"><span class="section-eyebrow">Exámenes</span><h3 style="margin:8px 0 0;font-size:2rem;">${state.computedStudents.length}</h3></article>
        <article class="card card-pad"><span class="section-eyebrow">Docentes</span><h3 style="margin:8px 0 0;font-size:2rem;">${state.teachers.size}</h3></article>
        <article class="card card-pad"><span class="section-eyebrow">Grados</span><h3 style="margin:8px 0 0;font-size:2rem;">${grades.join(", ") || "—"}</h3></article>
        <article class="card card-pad"><span class="section-eyebrow">Promedio global</span><h3 style="margin:8px 0 0;font-size:2rem;">${avgGlobal}<small style="color:#8c8f98">/100</small></h3></article>
      </section>
      <section class="grid grid-2" style="margin-top:18px;">
        <article class="card card-pad">
          <h3 style="margin:0 0 12px;font-weight:900;">Promedios por asignatura</h3>
          ${SUBJECTS.map((subject) => {
            const values = state.computedStudents.map((s) => s.subjectStats[subject.name]?.score).filter((v) => Number.isFinite(v));
            const value = Number(avg(values));
            return `
              <div class="meta-row">
                <span>${subjectIcon(subject.name)} ${esc(subject.name)}</span>
                <strong>${Number.isFinite(value) ? value : "—"}/100</strong>
              </div>
            `;
          }).join("")}
        </article>
        <article class="card card-pad">
          <h3 style="margin:0 0 12px;font-weight:900;">Carpetas esperadas en GitHub</h3>
          <div class="meta-row"><span>Claves</span><strong>KEYS/KEYS_10.json</strong></div>
          <div class="meta-row"><span>Resultados</span><strong>RESULTADOS/10S1.json · 10S2.json</strong></div>
          <div class="meta-row"><span>Estudiantes</span><strong>ESTUDIANTES/ESTUDIANTES.json</strong></div>
          <div class="meta-row"><span>Carga docente</span><strong>INTERNO/CARGA.json</strong></div>
          <p style="color:#686b74;font-weight:650;line-height:1.5;">Para nuevos grados agrega los archivos y actualiza <strong>config/data-manifest.json</strong>.</p>
        </article>
      </section>
    `;
  }

  function adminStudentsHtml() {
    const grades = [...new Set(state.computedStudents.map((s) => s.grade).filter(Boolean))].sort((a, b) => a - b);
    const query = normalizeText(state.adminStudentSearch);
    const subject = state.adminSubjectFilter;
    let students = state.computedStudents.filter((s) => {
      const matchesText = !query || normalizeText(`${s.name} ${s.roll} ${s.group} ${s.sede}`).includes(query);
      const matchesGrade = state.adminGradeFilter === "all" || String(s.grade) === String(state.adminGradeFilter);
      const matchesSubject = subject === "all" || s.subjectStats[subject]?.total;
      return matchesText && matchesGrade && matchesSubject;
    });

    students = students.sort((a, b) => (b.globalScore ?? 0) - (a.globalScore ?? 0));

    return `
      <section class="toolbar">
        <div>
          <span class="section-eyebrow">Todos los exámenes</span>
          <h2 style="margin:8px 0 0;font-weight:900;">Resultados por estudiante</h2>
        </div>
        <div class="toolbar-right">
          <div class="search-box"><input placeholder="Buscar..." value="${escAttr(state.adminStudentSearch)}" data-action="admin-student-search"></div>
          <select class="select-pill" data-action="admin-grade-filter">
            <option value="all">Todos los grados</option>
            ${grades.map((g) => `<option value="${g}" ${String(state.adminGradeFilter) === String(g) ? "selected" : ""}>${g}°</option>`).join("")}
          </select>
          <select class="select-pill" data-action="admin-subject-filter">
            <option value="all">Todas las áreas</option>
            ${SUBJECTS.map((s) => `<option value="${escAttr(s.name)}" ${subject === s.name ? "selected" : ""}>${esc(s.name)}</option>`).join("")}
          </select>
        </div>
      </section>
      <section class="card table-card">
        <div class="table-wrap">
          <table>
            <thead><tr><th>#</th><th>Estudiante</th><th>Grado/curso</th><th>Global</th><th>Rank grado</th><th>Acción</th></tr></thead>
            <tbody>
              ${students.map((student, index) => `
                <tr>
                  <td><span class="badge gray">${index + 1}</span></td>
                  <td><strong>${esc(student.name)}</strong><br><span style="color:#83858e;font-size:.78rem;">ID ${esc(student.roll)} · ${esc(student.sede)}</span></td>
                  <td>${esc(student.grade)}° · ${esc(student.group)}</td>
                  <td><span class="inline-score">${student.globalScore ?? "—"}<small>/500</small></span></td>
                  <td>${rankText(student.gradeRank, student.gradeCount)}</td>
                  <td><button class="secondary-btn" data-action="open-detail" data-roll="${escAttr(student.roll)}" data-subject="${escAttr(subject === "all" ? SUBJECTS[0].name : subject)}">Ver</button></td>
                </tr>
              `).join("") || `<tr><td colspan="6" class="empty-state">No hay resultados con los filtros actuales.</td></tr>`}
            </tbody>
          </table>
        </div>
      </section>
    `;
  }

  function adminAppearanceHtml() {
    const cfg = state.config;
    return `
      <section class="toolbar">
        <div>
          <span class="section-eyebrow">Apariencia</span>
          <h2 style="margin:8px 0 0;font-weight:900;">Banner, logo y textos</h2>
        </div>
      </section>
      <div class="admin-note">Puedes subir imágenes desde el panel. Para que el color, banner y logo queden disponibles para todos los usuarios, usa la pestaña <strong>GitHub</strong> y pulsa <strong>Publicar cambios en el repositorio</strong>.</div>
      <form id="appearanceForm" class="card card-pad">
        <div class="form-grid">
          <div class="field span-2">
            <label>Título superior</label>
            <input value="${escAttr(cfg.title)}" data-config-field="title">
          </div>
          <div class="field span-2">
            <label>Texto inferior / subtítulo</label>
            <textarea data-config-field="subtitle">${esc(cfg.subtitle)}</textarea>
          </div>
          <div class="field">
            <label>Color principal</label>
            <input type="color" value="${escAttr(cfg.primaryColor || "#ff7900")}" data-config-field="primaryColor">
          </div>
          <div class="field">
            <label>Texto institucional auxiliar</label>
            <input value="${escAttr(cfg.footerText || "")}" data-config-field="footerText">
          </div>
          <div class="field">
            <label>Borde de botones (px)</label>
            <input type="number" min="0" max="24" value="${escAttr(cfg.buttonRadius ?? 4)}" data-config-field="buttonRadius">
          </div>
          <div class="field">
            <label>Zoom del logo principal</label>
            <input type="range" min="0.65" max="2.4" step="0.05" value="${escAttr(cfg.logoZoom ?? 1)}" data-config-field="logoZoom">
            <small style="color:#7d8089;">Ajusta qué tanto peso gana el logo en el banner.</small>
          </div>
          <div class="field">
            <label>Logo principal</label>
            <input type="file" accept="image/*" data-action="upload-logo-main">
          </div>
          <div class="field">
            <label>Imagen de banner</label>
            <input type="file" accept="image/*" data-action="upload-banner">
          </div>
          <div class="span-2 inline-actions">
            <button class="primary-btn" type="submit">Guardar apariencia</button>
            <button class="ghost-btn" type="button" data-action="clear-banner">Quitar imagen de banner</button>
            <button class="secondary-btn" type="button" data-action="export-config">Exportar configuración</button>
            <button class="ghost-btn" type="button" data-action="publish-github">Publicar en GitHub</button>
          </div>
        </div>
      </form>
    `;
  }

  function adminLogosHtml() {
    return `
      <section class="toolbar">
        <div>
          <span class="section-eyebrow">Logos por asignatura</span>
          <h2 style="margin:8px 0 0;font-weight:900;">Íconos de las pruebas</h2>
        </div>
        <div class="inline-actions"><button class="secondary-btn" data-action="reset-logos">Restaurar íconos</button><button class="ghost-btn" data-action="publish-github">Publicar en GitHub</button></div>
      </section>
      <div class="admin-note">Los logos base del repositorio están en la carpeta <strong>ICONOS</strong>. Las imágenes que subas aquí se pueden publicar directamente en esa carpeta desde la pestaña <strong>GitHub</strong>.</div>
      <section class="logo-grid">
        ${SUBJECTS.map((subject) => `
          <article class="logo-item">
            <div style="display:flex;align-items:center;gap:12px;">
              <div class="preview-logo">${subjectIcon(subject.name)}</div>
              <strong>${esc(subject.name)}</strong>
            </div>
            <input class="small-input" type="file" accept="image/*" data-action="upload-subject-logo" data-subject="${escAttr(subject.name)}">
            <button class="ghost-btn" data-action="clear-subject-logo" data-subject="${escAttr(subject.name)}">Quitar logo</button>
          </article>
        `).join("")}
      </section>
    `;
  }

  function adminGithubHtml() {
    const gh = getGithubSettings();
    const inferred = inferGithubFromLocation();
    return `
      <section class="toolbar">
        <div>
          <span class="section-eyebrow">Publicación en repositorio</span>
          <h2 style="margin:8px 0 0;font-weight:900;">Guardar cambios directamente en GitHub</h2>
        </div>
      </section>
      <div class="admin-note github-note">
        GitHub Pages no puede modificar archivos del repositorio sin autorización. Pega un token de GitHub con permiso de escritura para este repositorio y pulsa <strong>Publicar cambios</strong>. El token se usa desde este navegador para crear commits; no lo dejes escrito dentro del código del sitio.
      </div>
      <section class="card card-pad github-panel">
        <div class="form-grid">
          <div class="field">
            <label>Usuario / dueño del repo</label>
            <input value="${escAttr(gh.owner || inferred.owner || "")}" placeholder="Ej. rubendarioenciso" data-github-field="owner">
          </div>
          <div class="field">
            <label>Repositorio</label>
            <input value="${escAttr(gh.repo || inferred.repo || "")}" placeholder="Ej. resultados-pruebas" data-github-field="repo">
          </div>
          <div class="field">
            <label>Rama</label>
            <input value="${escAttr(gh.branch || "main")}" placeholder="main" data-github-field="branch">
          </div>
          <div class="field span-2">
            <label>Token de GitHub</label>
            <input type="password" value="${escAttr(gh.token || "")}" placeholder="github_pat_..." data-github-field="token">
          </div>
          <div class="span-2 github-publish-box">
            <div>
              <strong>Archivos que se publicarán</strong>
              <p>config/site-config.json, INTERNO/CARGA.json, KEYS/KEYS_10.json y las imágenes nuevas en ICONOS o assets.</p>
            </div>
            <button class="primary-btn" type="button" data-action="publish-github">Publicar cambios en GitHub</button>
          </div>
        </div>
      </section>
      <section class="grid grid-2" style="margin-top:16px;">
        <article class="card card-pad">
          <h3 style="margin:0 0 10px;font-weight:800;">Qué queda global</h3>
          <p style="margin:0;color:#666a73;line-height:1.55;">Después de publicar, el color, el banner, los logos, las cargas y las claves quedan en el repositorio. Los demás navegadores los leerán desde los JSON y carpetas del sitio.</p>
        </article>
        <article class="card card-pad">
          <h3 style="margin:0 0 10px;font-weight:800;">Qué no debes hacer</h3>
          <p style="margin:0;color:#666a73;line-height:1.55;">No pegues el token dentro de <strong>app.js</strong> ni en ningún archivo público. Úsalo solo desde esta pantalla de administración.</p>
        </article>
      </section>
    `;
  }

  function adminCargaHtml() {
    const rows = state.cargaRows;
    return `
      <section class="toolbar">
        <div>
          <span class="section-eyebrow">Carga docente</span>
          <h2 style="margin:8px 0 0;font-weight:900;">Docente · asignatura · sede · grado · curso</h2>
        </div>
        <div class="inline-actions">
          <button class="primary-btn" data-action="add-carga">Agregar fila</button>
          <button class="secondary-btn" data-action="save-carga">Guardar cargas</button>
          <button class="ghost-btn" data-action="export-carga">Exportar JSON</button>
          <button class="secondary-btn" data-action="publish-github">Publicar en GitHub</button>
        </div>
      </section>
      <div class="admin-note">Al guardar, la carga se reemplaza localmente. Para publicarla para todos, usa la pestaña <strong>GitHub</strong> o exporta el JSON manualmente.</div>
      <section class="card table-card">
        <div class="table-wrap">
          <table>
            <thead><tr><th>ID docente</th><th>Nombre</th><th>Asignatura</th><th>Sede</th><th>Grado</th><th>Curso</th><th></th></tr></thead>
            <tbody>
              ${rows.map((row, index) => `
                <tr>
                  <td><input class="small-input" value="${escAttr(row.id)}" data-carga-row="${index}" data-field="id"></td>
                  <td><input class="small-input" value="${escAttr(row.name)}" data-carga-row="${index}" data-field="name"></td>
                  <td><input class="small-input" value="${escAttr(row.subjectRaw || row.subject)}" data-carga-row="${index}" data-field="subjectRaw"></td>
                  <td><input class="small-input" value="${escAttr(row.sede || "")}" data-carga-row="${index}" data-field="sede"></td>
                  <td><input class="small-input" value="${escAttr(row.grade)}" data-carga-row="${index}" data-field="grade"></td>
                  <td><input class="small-input" value="${escAttr(row.group || "")}" data-carga-row="${index}" data-field="group"></td>
                  <td><button class="danger-btn" data-action="delete-carga" data-index="${index}">Eliminar</button></td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      </section>
    `;
  }

  function adminKeysHtml() {
    const grades = [...new Set(state.keys.map((k) => k.grade).filter(Boolean))].sort((a, b) => a - b);
    const grade = state.adminGradeFilter === "all" ? (grades[0] || "all") : state.adminGradeFilter;
    const subject = state.adminSubjectFilter;
    let rows = state.keys.filter((key) => String(key.grade) === String(grade));
    if (subject !== "all") rows = rows.filter((key) => sameSubject(key.area, subject));

    return `
      <section class="toolbar">
        <div>
          <span class="section-eyebrow">Claves de respuesta</span>
          <h2 style="margin:8px 0 0;font-weight:900;">Editar respuestas correctas</h2>
        </div>
        <div class="toolbar-right">
          <select class="select-pill" data-action="admin-grade-filter">
            ${grades.map((g) => `<option value="${g}" ${String(grade) === String(g) ? "selected" : ""}>Grado ${g}°</option>`).join("")}
          </select>
          <select class="select-pill" data-action="admin-subject-filter">
            <option value="all">Todas las áreas</option>
            ${SUBJECTS.map((s) => `<option value="${escAttr(s.name)}" ${subject === s.name ? "selected" : ""}>${esc(s.name)}</option>`).join("")}
          </select>
        </div>
      </section>
      <div class="admin-note">Después de guardar, los cálculos se actualizan en este navegador. Para publicar las claves para todos, usa la pestaña <strong>GitHub</strong> o exporta el JSON manualmente.</div>
      <div class="inline-actions" style="margin-bottom:14px;">
        <button class="secondary-btn" data-action="save-keys">Guardar claves</button>
        <button class="ghost-btn" data-action="export-keys">Exportar JSON</button>
        <button class="danger-btn" data-action="reset-keys">Restaurar claves originales</button>
        <button class="secondary-btn" data-action="publish-github">Publicar en GitHub</button>
      </div>
      <section class="card table-card">
        <div class="table-wrap">
          <table>
            <thead><tr><th>Grado</th><th>Área</th><th>Ítem</th><th>Respuesta</th><th>Componente</th><th>Competencia</th></tr></thead>
            <tbody>
              ${rows.map((key) => `
                <tr>
                  <td>${esc(key.grade)}°</td>
                  <td>${esc(key.areaRaw || key.area)}</td>
                  <td><strong>${esc(key.item)}</strong></td>
                  <td>
                    <select class="small-input" data-key-id="${escAttr(keyId(key))}">
                      ${["A","B","C","D","E","F","G","H"].map((op) => `<option value="${op}" ${key.correct === op ? "selected" : ""}>${op}</option>`).join("")}
                    </select>
                  </td>
                  <td>${esc(key.component)}</td>
                  <td>${esc(key.competence)}</td>
                </tr>
              `).join("") || `<tr><td colspan="6" class="empty-state">No hay claves con este filtro.</td></tr>`}
            </tbody>
          </table>
        </div>
      </section>
    `;
  }

  function navFor(role) {
    if (role === "student") {
      return `
        <nav class="app-nav">
          <button class="nav-chip active">Reporte general</button>
          <button class="nav-chip logout" data-action="logout">Salir</button>
        </nav>
      `;
    }
    if (role === "teacher") {
      return `
        <nav class="app-nav">
          <button class="nav-chip active">Panel docente</button>
          <button class="nav-chip logout" data-action="logout">Salir</button>
        </nav>
      `;
    }
    return "";
  }

  function handleSubmit(event) {
    if (event.target.id === "loginForm") {
      event.preventDefault();
      const user = cleanId(document.getElementById("loginUser").value);
      const pass = String(document.getElementById("loginPass").value || "").trim();

      if (!user) return renderLogin("Ingresa un usuario o ID.");

      if (normalizeText(user) === "admin") {
        if (pass === "admin") {
          state.adminTab = "resumen";
          enterSessionWithLoader({ role: "admin", id: "admin" }, () => renderAdmin(), "Abriendo panel de administración...");
        } else {
          renderLogin("Contraseña de administrador incorrecta.");
        }
        return;
      }

      if (state.teachers.has(user)) {
        state.teacherActive = null;
        enterSessionWithLoader({ role: "teacher", id: user }, () => renderTeacher(state.teachers.get(user)), "Preparando vista docente...");
        return;
      }

      if (state.studentLogin.has(user)) {
        const roll = state.studentLogin.get(user);
        state.selectedSubject = null;
        state.metricTab = "components";
        enterSessionWithLoader({ role: "student", roll }, () => renderStudent(roll), "Preparando tus resultados...");
        return;
      }

      if (state.responsesByRoll.has(user)) {
        state.selectedSubject = null;
        state.metricTab = "components";
        enterSessionWithLoader({ role: "student", roll: user }, () => renderStudent(user), "Preparando tus resultados...");
        return;
      }

      renderLogin("No encontré ese ID en estudiantes, docentes o resultados.");
    }

    if (event.target.id === "appearanceForm") {
      event.preventDefault();
      saveConfig();
      toast("Apariencia guardada.");
      renderAdmin();
    }
  }

  async function handleClick(event) {
    const target = event.target.closest("[data-action]");
    if (!target) return;
    if (target.classList.contains("modal-backdrop") && event.target !== target) return;

    const action = target.dataset.action;

    if (action === "retry") {
      init();
    }

    if (action === "logout") {
      clearSession();
      renderLogin();
    }

    if (action === "print") {
      window.print();
    }

    if (action === "select-subject") {
      const nextSubject = target.dataset.subject;
      transitionStudentSubject(nextSubject, target);
      return;
    }

    if (action === "select-metric-tab") {
      state.metricTab = target.dataset.tab === "competences" ? "competences" : "components";
      updateMetricTabDom();
      return;
    }

    if (action === "teacher-assignment") {
      state.teacherActive = {
        key: target.dataset.key || assignmentKeyFor({ grade: target.dataset.grade, subjectRaw: target.dataset.subject, group: target.dataset.group, sede: target.dataset.sede }),
        grade: toInt(target.dataset.grade),
        subject: canonicalSubject(target.dataset.subject),
        subjectRaw: target.dataset.subject,
        group: cleanText(target.dataset.group),
        sede: cleanText(target.dataset.sede)
      };
      renderBySession();
    }

    if (action === "open-detail") {
      openDetailModal(target.dataset.roll, target.dataset.subject);
    }

    if (action === "global-info") {
      openGlobalScoreInfo(target.dataset.roll);
      return;
    }

    if (action === "open-answer-key") {
      openAnswerKeyModal(toInt(target.dataset.grade), target.dataset.subject);
      return;
    }

    if (action === "close-modal") {
      event.preventDefault();
      event.stopPropagation();
      closeModal();
      return;
    }

    if (action === "answer-info") {
      openAnswerInfo(target.dataset.roll, target.dataset.subject, toInt(target.dataset.item));
    }

    if (action === "admin-tab") {
      state.adminTab = target.dataset.tab;
      if (state.adminTab !== "claves") {
        state.adminSubjectFilter = "all";
      }
      renderAdmin();
    }

    if (action === "clear-banner") {
      state.config.bannerImage = "";
      writeJSON(STORAGE.config, state.config);
      toast("Imagen de banner eliminada.");
      renderAdmin();
    }

    if (action === "export-config") {
      downloadFile("configuracion-resultados.json", JSON.stringify({ config: buildRepoConfigPreview(), logos: state.logos }, null, 2), "application/json");
    }

    if (action === "publish-github") {
      await publishAllToGithub();
      return;
    }

    if (action === "reset-logos") {
      state.logos = {};
      writeJSON(STORAGE.logos, state.logos);
      toast("Íconos restaurados.");
      renderAdmin();
    }

    if (action === "clear-subject-logo") {
      delete state.logos[target.dataset.subject];
      writeJSON(STORAGE.logos, state.logos);
      toast("Logo eliminado.");
      renderAdmin();
    }

    if (action === "add-carga") {
      state.cargaRows.unshift({ id: "", name: "", subjectRaw: "Matemáticas", subject: "Matemáticas", sede: "", grade: 10, group: "" });
      renderAdmin();
    }

    if (action === "delete-carga") {
      const index = Number(target.dataset.index);
      state.cargaRows.splice(index, 1);
      renderAdmin();
    }

    if (action === "save-carga") {
      normalizeCargaRows();
      writeJSON(STORAGE.carga, { rows: state.cargaRows });
      buildRepository();
      toast("Carga guardada localmente.");
      renderAdmin();
    }

    if (action === "export-carga") {
      exportCarga();
    }

    if (action === "save-keys") {
      saveKeys();
      toast("Claves guardadas localmente.");
      renderAdmin();
    }

    if (action === "export-keys") {
      exportKeys();
    }

    if (action === "reset-keys") {
      localStorage.removeItem(STORAGE.answers);
      toast("Claves locales eliminadas. Recargando datos...");
      setTimeout(() => location.reload(), 500);
    }
  }

  function handleInput(event) {
    const target = event.target;

    if (target.dataset.action === "teacher-search") {
      state.teacherSearch = target.value;
      renderBySession();
    }

    if (target.dataset.action === "admin-student-search") {
      state.adminStudentSearch = target.value;
      renderAdmin();
    }

    if (target.dataset.configField) {
      state.config[target.dataset.configField] = target.value;
    }

    if (target.dataset.githubField) {
      const settings = getGithubSettings();
      settings[target.dataset.githubField] = target.value.trim();
      saveGithubSettings(settings);
    }

    if (target.dataset.cargaRow) {
      const index = Number(target.dataset.cargaRow);
      const field = target.dataset.field;
      if (!state.cargaRows[index]) return;
      if (field === "grade") {
        state.cargaRows[index].grade = toInt(target.value);
      } else if (field === "subjectRaw") {
        state.cargaRows[index].subjectRaw = target.value;
        state.cargaRows[index].subject = canonicalSubject(target.value);
      } else if (field === "id") {
        state.cargaRows[index].id = cleanId(target.value);
      } else if (field === "name") {
        state.cargaRows[index].name = target.value;
      } else if (field === "sede") {
        state.cargaRows[index].sede = target.value;
      } else if (field === "group") {
        state.cargaRows[index].group = target.value;
      }
    }
  }

  function handleChange(event) {
    const target = event.target;

    if (target.dataset.action === "admin-grade-filter") {
      state.adminGradeFilter = target.value;
      renderAdmin();
    }

    if (target.dataset.action === "admin-subject-filter") {
      state.adminSubjectFilter = target.value;
      renderAdmin();
    }

    if (target.dataset.action === "upload-logo-main") {
      readImageFile(target.files?.[0], (dataUrl) => {
        state.config.logoImage = dataUrl;
        writeJSON(STORAGE.config, state.config);
        toast("Logo principal actualizado.");
        renderAdmin();
      });
    }

    if (target.dataset.action === "upload-banner") {
      readImageFile(target.files?.[0], (dataUrl) => {
        state.config.bannerImage = dataUrl;
        writeJSON(STORAGE.config, state.config);
        toast("Banner actualizado.");
        renderAdmin();
      });
    }

    if (target.dataset.action === "upload-subject-logo") {
      const subject = target.dataset.subject;
      readImageFile(target.files?.[0], (dataUrl) => {
        state.logos[subject] = dataUrl;
        writeJSON(STORAGE.logos, state.logos);
        toast(`Logo de ${subject} actualizado.`);
        renderAdmin();
      });
    }

    if (target.dataset.keyId) {
      const id = target.dataset.keyId;
      const key = state.keys.find((row) => keyId(row) === id);
      if (key) {
        key.correct = cleanOption(target.value);
        buildRepository();
      }
    }
  }

  function saveConfig() {
    state.config = { ...DEFAULT_CONFIG, ...state.config };
    state.config.buttonRadius = clamp(Number(state.config.buttonRadius ?? 4), 0, 24);
    state.config.logoZoom = clamp(Number(state.config.logoZoom ?? 1), 0.65, 2.4);
    writeJSON(STORAGE.config, state.config);
  }

  function normalizeCargaRows() {
    state.cargaRows = state.cargaRows
      .map((row) => ({
        id: cleanId(row.id),
        name: cleanText(row.name),
        subjectRaw: cleanText(row.subjectRaw || row.subject),
        subject: canonicalSubject(row.subjectRaw || row.subject),
        sede: cleanText(row.sede),
        grade: toInt(row.grade),
        group: cleanText(row.group)
      }))
      .filter((row) => row.id && row.subjectRaw && row.grade);
  }

  function saveKeys() {
    const overrides = {};
    state.keys.forEach((row) => {
      overrides[keyId(row)] = cleanOption(row.correct);
    });
    writeJSON(STORAGE.answers, overrides);
    buildRepository();
  }

  function exportCarga() {
    normalizeCargaRows();
    downloadFile("CARGA.json", JSON.stringify(exportCargaRows(), null, 2), "application/json;charset=utf-8");
  }

  function exportKeys() {
    downloadFile("KEYS_EDITADO.json", JSON.stringify(exportKeyRows(), null, 2), "application/json;charset=utf-8");
  }

  function buildRepoConfigPreview() {
    return {
      ...state.config,
      subjectLogos: { ...state.config.subjectLogos, ...state.logos }
    };
  }

  function getGithubSettings() {
    const saved = readJSON(STORAGE.github, {});
    const inferred = inferGithubFromLocation();
    return {
      owner: saved.owner || state.config.github?.owner || inferred.owner || "",
      repo: saved.repo || state.config.github?.repo || inferred.repo || "",
      branch: saved.branch || state.config.github?.branch || inferred.branch || "main",
      token: sessionStorage.getItem(`${STORAGE.github}_token`) || ""
    };
  }

  function saveGithubSettings(settings) {
    const clean = {
      owner: cleanText(settings.owner),
      repo: cleanText(settings.repo),
      branch: cleanText(settings.branch || "main")
    };
    writeJSON(STORAGE.github, clean);
    if (settings.token !== undefined) {
      if (settings.token) sessionStorage.setItem(`${STORAGE.github}_token`, settings.token);
      else sessionStorage.removeItem(`${STORAGE.github}_token`);
    }
  }

  function inferGithubFromLocation() {
    const host = location.hostname || "";
    const path = location.pathname.split("/").filter(Boolean);
    if (host.endsWith("github.io")) {
      return { owner: host.split(".")[0] || "", repo: path[0] || "", branch: "main" };
    }
    return { owner: "", repo: "", branch: "main" };
  }

  async function publishAllToGithub() {
    normalizeCargaRows();
    const gh = getGithubSettings();
    if (!gh.owner || !gh.repo || !gh.branch || !gh.token) {
      toast("Completa usuario, repositorio, rama y token de GitHub.");
      state.adminTab = "github";
      renderAdmin();
      return;
    }

    showRouteLoader("Publicando cambios en GitHub...");
    try {
      const files = [];
      const repoConfig = { ...state.config, subjectLogos: {} };
      delete repoConfig.github;

      if (isDataUrl(repoConfig.logoImage)) {
        const ext = extensionFromDataUrl(repoConfig.logoImage);
        const path = `assets/logo-principal.${ext}`;
        files.push({ path, contentBase64: base64FromDataUrl(repoConfig.logoImage) });
        repoConfig.logoImage = path;
      }

      if (isDataUrl(repoConfig.bannerImage)) {
        const ext = extensionFromDataUrl(repoConfig.bannerImage);
        const path = `assets/banner-principal.${ext}`;
        files.push({ path, contentBase64: base64FromDataUrl(repoConfig.bannerImage) });
        repoConfig.bannerImage = path;
      }

      for (const subject of SUBJECTS) {
        const logo = state.logos[subject.name];
        if (!logo) continue;
        if (isDataUrl(logo)) {
          const ext = extensionFromDataUrl(logo);
          const path = `ICONOS/${slugify(subject.name)}.${ext}`;
          files.push({ path, contentBase64: base64FromDataUrl(logo) });
          repoConfig.subjectLogos[subject.name] = path;
        } else {
          repoConfig.subjectLogos[subject.name] = logo;
        }
      }

      files.push({ path: state.manifest.config || "config/site-config.json", content: JSON.stringify(repoConfig, null, 2) });
      files.push({ path: state.manifest.carga || "INTERNO/CARGA.json", content: JSON.stringify(exportCargaRows(), null, 2) });

      const keysByPath = groupBy(state.keys, (row) => row.sourcePath || `KEYS/KEYS_${row.grade}.json`);
      for (const [path, rows] of keysByPath.entries()) {
        files.push({ path, content: JSON.stringify(exportKeyRows(rows), null, 2) });
      }

      for (const file of files) {
        await githubPutFile(gh, file.path, file.contentBase64 || textToBase64(file.content), file.contentBase64 ? "Actualizar imagen del reporte" : "Actualizar datos del reporte");
      }

      state.config = { ...state.config, ...repoConfig };
      state.logos = { ...repoConfig.subjectLogos };
      state.config.subjectLogos = { ...repoConfig.subjectLogos };
      writeJSON(STORAGE.config, state.config);
      writeJSON(STORAGE.logos, state.logos);
      writeJSON(STORAGE.carga, { rows: state.cargaRows });
      toast("Cambios publicados en GitHub. GitHub Pages puede tardar un momento en reflejarlos.");
      hideRouteLoader();
      state.adminTab = "github";
      renderAdmin();
    } catch (error) {
      console.error(error);
      hideRouteLoader();
      toast(error.message || "No fue posible publicar en GitHub.");
    }
  }

  function exportCargaRows() {
    return state.cargaRows.map((row) => ({
      ID: row.id,
      NOMBRE: row.name,
      ASIGNATURA: row.subjectRaw || row.subject,
      SEDE: row.sede || "",
      GRADO: String(row.grade || ""),
      CURSO: row.group || ""
    }));
  }

  function exportKeyRows(rows = state.keys) {
    return rows
      .slice()
      .sort((a, b) => (a.grade - b.grade) || (a.item - b.item))
      .map((row) => ({
        "Área": row.areaRaw || row.area,
        "Número de ítem": String(row.item),
        "Respuesta sugerida": row.correct,
        "Componente / pensamiento / entorno / factor / enfoque": row.component,
        "Competencia": row.competence
      }));
  }

  async function githubPutFile(settings, path, contentBase64, message) {
    const apiPath = path.split("/").map(encodeURIComponent).join("/");
    const url = `https://api.github.com/repos/${encodeURIComponent(settings.owner)}/${encodeURIComponent(settings.repo)}/contents/${apiPath}`;
    const headers = {
      "Accept": "application/vnd.github+json",
      "Authorization": `Bearer ${settings.token}`,
      "X-GitHub-Api-Version": "2022-11-28"
    };

    let sha = null;
    const getResponse = await fetch(`${url}?ref=${encodeURIComponent(settings.branch)}`, { headers });
    if (getResponse.ok) {
      const current = await getResponse.json();
      sha = current.sha;
    } else if (getResponse.status !== 404) {
      throw new Error(`No se pudo revisar ${path}: ${getResponse.status}`);
    }

    const body = {
      message: `${message}: ${path}`,
      content: contentBase64,
      branch: settings.branch,
      ...(sha ? { sha } : {})
    };

    const putResponse = await fetch(url, {
      method: "PUT",
      headers,
      body: JSON.stringify(body)
    });
    if (!putResponse.ok) {
      const detail = await putResponse.text().catch(() => "");
      throw new Error(`GitHub rechazó ${path}: ${putResponse.status} ${detail.slice(0, 160)}`);
    }
    return putResponse.json();
  }

  function isDataUrl(value) {
    return /^data:[^;]+;base64,/i.test(String(value || ""));
  }

  function extensionFromDataUrl(dataUrl) {
    const mime = String(dataUrl).match(/^data:([^;]+);base64,/i)?.[1] || "image/png";
    if (mime.includes("svg")) return "svg";
    if (mime.includes("jpeg") || mime.includes("jpg")) return "jpg";
    if (mime.includes("webp")) return "webp";
    if (mime.includes("gif")) return "gif";
    return "png";
  }

  function base64FromDataUrl(dataUrl) {
    return String(dataUrl).split(",")[1] || "";
  }

  function textToBase64(text) {
    return btoa(unescape(encodeURIComponent(String(text || ""))));
  }

  function slugify(value) {
    return normalizeText(value).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "archivo";
  }

  function openGlobalScoreInfo(roll) {
    const student = state.computedByRoll.get(roll) || state.computedByRoll.get(state.activeSession?.roll);
    if (!student) return;
    const calc = saberGlobalBreakdown(student.subjectStats);
    const rows = calc.areas.map((area) => `
      <tr>
        <td>${esc(area.label)}</td>
        <td><span class="weight-pill">×${area.weight}</span></td>
        <td>${area.score ?? "—"}</td>
        <td>${Number.isFinite(area.weighted) ? area.weighted : "—"}</td>
      </tr>
    `).join("");
    const cards = calc.areas.map((area) => `
      <article class="saber-area-card">
        <span>${esc(area.label)}</span>
        <strong>${area.score ?? "—"}</strong>
        <small>Peso ×${area.weight} · aporte ${Number.isFinite(area.weighted) ? area.weighted : "—"}</small>
      </article>
    `).join("");
    const formulaValues = calc.canCalculate
      ? `((${calc.math} × 3) + (${calc.language} × 3) + (${calc.natural} × 3) + (${calc.social} × 3) + (${calc.english} × 1)) × 5 ÷ 13 = ${calc.score}`
      : "Falta al menos una de las cinco áreas que componen el cálculo.";
    const weightedList = calc.canCalculate
      ? `${calc.math * 3} + ${calc.language * 3} + ${calc.natural * 3} + ${calc.social * 3} + ${calc.english * 1} = ${calc.weightedSum}`
      : "No disponible";

    modalRoot.innerHTML = `
      <div class="modal-backdrop" data-action="close-modal">
        <section class="modal global-modal" style="max-width:760px;">
          <div class="modal-head">
            <div>
              <h2>Puntaje global tipo Saber</h2>
              <span style="color:#7d8089;font-weight:600;">${esc(student.name)} · ID ${esc(student.roll)}</span>
            </div>
            <button type="button" class="icon-btn" data-action="close-modal" aria-label="Cerrar">×</button>
          </div>
          <div class="modal-body">
            <section class="global-score-hero">
              <div>
                <span>Resultado estimado</span>
                <strong>${calc.score ?? "—"}<small>/500</small></strong>
              </div>
              <p>Este valor simula el puntaje global de una Prueba Saber usando solo las áreas que hacen parte de ese cálculo.</p>
            </section>

            <div class="formula-box formula-box-strong">
              <div class="formula-step">
                <span>1</span>
                <p>Primero se ponderan las áreas: Matemáticas, Lenguaje, Ciencias Naturales y Ciencias Sociales valen <strong>×3</strong>. Inglés vale <strong>×1</strong>.</p>
              </div>
              <div class="formula-step">
                <span>2</span>
                <p>Luego se suman esos aportes: <strong>${esc(weightedList)}</strong>.</p>
              </div>
              <div class="formula-step">
                <span>3</span>
                <p>Finalmente esa suma se multiplica por <strong>5</strong> y se divide entre <strong>13</strong>.</p>
              </div>
              <div class="formula-line colorful">${esc(formulaValues)}</div>
              <p class="excluded-note">Ética, Artística, Educación Física, Informática y Religión no cuentan dentro de este cálculo tipo Saber.</p>
            </div>

            <div class="saber-area-cards">${cards}</div>
            <div class="table-wrap saber-table-wrap">
              <table class="compact-table saber-global-table">
                <thead><tr><th>Área</th><th>Peso</th><th>Nota</th><th>Aporte</th></tr></thead>
                <tbody>
                  ${rows}
                  <tr class="weighted-sum-row"><td colspan="3">Suma ponderada</td><td>${calc.canCalculate ? calc.weightedSum : "—"}</td></tr>
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </div>
    `;
  }

  function openAnswerKeyModal(grade, subject) {
    const rows = state.keys
      .filter((key) => (!grade || key.grade === grade) && sameSubject(key.area, subject))
      .sort((a, b) => a.item - b.item);
    modalRoot.innerHTML = `
      <div class="modal-backdrop" data-action="close-modal">
        <section class="modal answer-key-modal">
          <div class="modal-head">
            <div>
              <h2>Respuestas correctas</h2>
              <span style="color:#7d8089;font-weight:600;">${esc(subject)} · ${grade ? `${esc(grade)}°` : "Todos los grados"}</span>
            </div>
            <button type="button" class="icon-btn" data-action="close-modal" aria-label="Cerrar">×</button>
          </div>
          <div class="modal-body">
            <div class="table-wrap">
              <table class="compact-table answer-key-table">
                <thead><tr><th>Ítem</th><th>Respuesta</th><th>Componente</th><th>Competencia</th></tr></thead>
                <tbody>
                  ${rows.map((row) => `
                    <tr>
                      <td>${esc(row.item)}</td>
                      <td><strong>${esc(row.correct)}</strong></td>
                      <td>${esc(row.component || "—")}</td>
                      <td>${esc(row.competence || "—")}</td>
                    </tr>
                  `).join("") || `<tr><td colspan="4" class="empty-state">No hay clave registrada para esta asignatura.</td></tr>`}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </div>
    `;
  }

  function openDetailModal(roll, subject) {
    const student = state.computedByRoll.get(roll);
    if (!student) return;
    const realSubject = student.subjectStats[subject]?.total ? subject : SUBJECTS.find((s) => student.subjectStats[s.name]?.total)?.name;
    const stat = student.subjectStats[realSubject];
    modalRoot.innerHTML = `
      <div class="modal-backdrop" data-action="close-modal">
        <section class="modal">
          <div class="modal-head">
            <div>
              <h2>${esc(student.name)}</h2>
              <span style="color:#7d8089;font-weight:700;">${esc(realSubject)} · ID ${esc(student.roll)} · ${esc(student.grade)}° ${esc(student.group)}</span>
            </div>
            <button type="button" class="icon-btn" data-action="close-modal" aria-label="Cerrar">×</button>
          </div>
          <div class="modal-body">
            <section class="card detail-card">${buildSubjectDetailHtml(student, realSubject, stat, true)}</section>
          </div>
        </section>
      </div>
    `;
  }

  function openAnswerInfo(roll, subject, item) {
    const student = state.computedByRoll.get(roll) || (state.activeSession?.role === "student" ? state.computedByRoll.get(state.activeSession.roll) : null);
    if (!student) return;
    const stat = student.subjectStats[subject];
    const detail = stat?.details.find((d) => d.item === item);
    if (!detail) return;

    modalRoot.innerHTML = `
      <div class="modal-backdrop" data-action="close-modal">
        <section class="modal" style="max-width:560px;">
          <div class="modal-head">
            <h2>Ítem ${esc(detail.item)} · ${esc(subject)}</h2>
            <button type="button" class="icon-btn" data-action="close-modal" aria-label="Cerrar">×</button>
          </div>
          <div class="modal-body">
            <div class="grid">
              <div class="card card-pad">
                <div class="meta-row"><span>Marcó</span><strong>${esc(displayMarked(detail.marked))}</strong></div>
                <div class="meta-row"><span>Estado</span><strong>${esc(statusLabel(detail.status))}</strong></div>
                <div class="meta-row"><span>Componente</span><strong>${esc(detail.component || "Sin registro")}</strong></div>
                <div class="meta-row"><span>Competencia</span><strong>${esc(detail.competence || "Sin registro")}</strong></div>
              </div>
            </div>
          </div>
        </section>
      </div>
    `;
  }

  function closeModal() {
    const backdrop = modalRoot.querySelector(".modal-backdrop");
    if (!backdrop) {
      modalRoot.innerHTML = "";
      return;
    }
    backdrop.classList.add("is-closing");
    window.setTimeout(() => {
      modalRoot.innerHTML = "";
    }, 180);
  }

  function clearSession() {
    state.activeSession = null;
    localStorage.removeItem(STORAGE.session);
  }

  function enterSessionWithLoader(session, renderFn, message = "Preparando resultados...") {
    state.activeSession = session;
    writeJSON(STORAGE.session, state.activeSession);
    showRouteLoader(message);
    window.setTimeout(() => {
      renderFn();
      window.setTimeout(hideRouteLoader, 150);
    }, 620);
  }

  function showRouteLoader(message) {
    document.querySelector(".route-loader")?.remove();
    const loader = document.createElement("div");
    loader.className = "route-loader";
    loader.innerHTML = `
      <div class="route-loader-card">
        <div class="route-loader-mark"></div>
        <strong>${esc(message)}</strong>
        <span>Calculando puntajes, rankings y reportes.</span>
      </div>
    `;
    document.body.appendChild(loader);
    requestAnimationFrame(() => loader.classList.add("active"));
  }

  function hideRouteLoader() {
    const loader = document.querySelector(".route-loader");
    if (!loader) return;
    loader.classList.add("leaving");
    window.setTimeout(() => loader.remove(), 360);
  }

  function answerPill(detail, roll, displayIndex = detail.item) {
    return `
      <button class="answer-pill ${detail.status}" data-action="answer-info" data-roll="${escAttr(roll)}" data-subject="${escAttr(detail.subject)}" data-item="${escAttr(detail.item)}" title="Ver detalle del ítem ${escAttr(displayIndex)}">
        <strong>${esc(displayIndex)}.</strong>
        <span>${esc(displayMarked(detail.marked))}</span>
      </button>
    `;
  }

  function buildMetricBars(details, field) {
    if (!details.length) return `<p class="metric-empty">No hay datos para graficar.</p>`;
    const grouped = new Map();
    details.forEach((detail) => {
      const name = cleanText(detail[field]) || (field === "component" ? "Componente sin registrar" : "Competencia sin registrar");
      if (!grouped.has(name)) grouped.set(name, { name, total: 0, correct: 0 });
      const item = grouped.get(name);
      item.total += 1;
      if (detail.status === "correct") item.correct += 1;
    });
    return [...grouped.values()]
      .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name, "es"))
      .map((item) => {
        const percent = item.total ? Math.round((item.correct / item.total) * 100) : 0;
        return `
          <div class="metric-bar-item">
            <div class="metric-bar-head">
              <span>${esc(item.name)}</span>
              <strong>${esc(percent)}%</strong>
            </div>
            <div class="metric-progress" aria-label="${escAttr(item.name)} ${percent}%">
              <div class="metric-progress-fill" style="width:${clamp(percent, 0, 100)}%"></div>
            </div>
          </div>
        `;
      }).join("");
  }

  function subjectIcon(subjectName) {
    const logo = state.logos[subjectName];
    if (logo) return `<span class="subject-icon"><img src="${escAttr(logo)}" alt=""></span>`;
    const path = defaultIconPath(subjectName);
    const subject = SUBJECTS.find((s) => s.name === subjectName) || { icon: "•" };
    if (path) return `<span class="subject-icon"><img src="${escAttr(path)}" alt="" onerror="this.parentElement.textContent='${escAttr(subject.icon)}'"></span>`;
    return `<span class="subject-icon">${esc(subject.icon)}</span>`;
  }

  function defaultIconPath(subjectName) {
    const slug = normalizeText(subjectName).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const map = {
      "matematicas": "matematicas.svg",
      "lenguaje": "lenguaje.svg",
      "ciencias-naturales": "ciencias-naturales.svg",
      "ingles": "ingles.svg",
      "ciencias-sociales-y-ciudadania": "ciencias-sociales.svg",
      "etica-y-valores": "etica.svg",
      "artistica": "artistica.svg",
      "educacion-fisica": "educacion-fisica.svg",
      "informatica": "informatica.svg",
      "religion": "religion.svg"
    };
    return map[slug] ? `ICONOS/${map[slug]}` : "";
  }

  function classifyAnswer(markedRaw, correctRaw) {
    const marked = cleanMarked(markedRaw);
    const correct = cleanOption(correctRaw);
    const letters = (marked.match(/[A-H]/g) || []);
    const unique = [...new Set(letters)];
    if (!marked || unique.length === 0) return "empty";
    if (unique.length > 1 || (marked.length > 1 && /^[A-H]+$/.test(marked))) return "double";
    return unique[0] === correct ? "correct" : "wrong";
  }

  function statusLabel(status) {
    return {
      correct: "Correcta",
      wrong: "Incorrecta",
      double: "Doble marca",
      empty: "Sin marcar"
    }[status] || status;
  }

  function scoreOf(subjectStats, subjectName) {
    const value = subjectStats?.[subjectName]?.score;
    if (value === null || value === undefined || value === "") return null;
    return Number.isFinite(Number(value)) ? Number(value) : null;
  }

  function saberGlobalBreakdown(subjectStats) {
    const math = scoreOf(subjectStats, "Matemáticas");
    const language = scoreOf(subjectStats, "Lenguaje");
    const natural = scoreOf(subjectStats, "Ciencias Naturales");
    const social = scoreOf(subjectStats, "Ciencias Sociales y Ciudadanía");
    const english = scoreOf(subjectStats, "Inglés");
    const areas = [
      { key: "math", label: "Matemáticas", score: math, weight: 3 },
      { key: "language", label: "Lenguaje", score: language, weight: 3 },
      { key: "natural", label: "Ciencias Naturales", score: natural, weight: 3 },
      { key: "social", label: "Ciencias Sociales y Ciudadanía", score: social, weight: 3 },
      { key: "english", label: "Inglés", score: english, weight: 1 }
    ].map((area) => ({ ...area, weighted: Number.isFinite(area.score) ? area.score * area.weight : null }));
    const canCalculate = areas.every((area) => Number.isFinite(area.score));
    const weightedSum = areas.reduce((sum, area) => sum + (Number.isFinite(area.weighted) ? area.weighted : 0), 0);
    const score = canCalculate ? Math.round((weightedSum * 5) / 13) : null;
    return { math, language, natural, social, english, areas, weightedSum, score, canCalculate };
  }

  function calculateSaberGlobal(subjectStats) {
    return saberGlobalBreakdown(subjectStats).score;
  }

  function calculateScore(correct, total) {
    if (!total) return null;
    return Math.round(20 + (correct / total) * 80);
  }

  function performanceLevel(score) {
    const value = Number(score ?? 20);
    if (value >= 85) return 4;
    if (value >= 70) return 3;
    if (value >= 50) return 2;
    return 1;
  }

  function performanceClass(score) {
    const level = performanceLevel(score);
    if (level >= 4) return "green";
    if (level >= 3) return "orange";
    return "gray";
  }

  function rankingBoxHtml(rank, label) {
    const cleanRank = Number(rank);
    const medal = cleanRank === 1 ? "gold" : cleanRank === 2 ? "silver" : cleanRank === 3 ? "bronze" : "plain";
    const title = cleanRank === 1 ? "Primer puesto" : cleanRank === 2 ? "Segundo puesto" : cleanRank === 3 ? "Tercer puesto" : "Ranking";
    return `
      <div class="ranking-box rank-${medal} ${medal !== "plain" ? "rank-medal" : ""}" title="${escAttr(title)}">
        <strong>${Number.isFinite(cleanRank) && cleanRank > 0 ? cleanRank : "—"}</strong>
        <small>${esc(label)}</small>
      </div>
    `;
  }

  function rankText(rank, total) {
    if (!rank || !total) return "—";
    return `${rank} de ${total}`;
  }

  function displayMarked(value) {
    const clean = cleanMarked(value);
    return clean || "—";
  }

  function parseDataObjects(text, requiredLabels = []) {
    const raw = String(text || "").replace(/^\uFEFF/, "").trim();
    if (!raw) return [];

    if (raw.startsWith("[") || raw.startsWith("{")) {
      const parsed = JSON.parse(raw);
      const list = Array.isArray(parsed)
        ? parsed
        : (Array.isArray(parsed.rows) ? parsed.rows : (Array.isArray(parsed.data) ? parsed.data : []));
      return list
        .filter((row) => row && typeof row === "object" && !Array.isArray(row))
        .map((row) => {
          const obj = {};
          Object.entries(row).forEach(([key, value]) => {
            obj[cleanText(key)] = cleanText(value);
          });
          return obj;
        });
    }

    const rows = parseCSV(raw);
    const headerIndex = findHeaderIndex(rows, requiredLabels);
    return rowsToObjects(rows, headerIndex);
  }

  function parseCSV(text) {
    const rows = [];
    let row = [];
    let cell = "";
    let inQuotes = false;

    const clean = String(text || "").replace(/^\uFEFF/, "");
    for (let i = 0; i < clean.length; i++) {
      const char = clean[i];
      const next = clean[i + 1];

      if (char === '"' && inQuotes && next === '"') {
        cell += '"';
        i++;
        continue;
      }

      if (char === '"') {
        inQuotes = !inQuotes;
        continue;
      }

      if (char === "," && !inQuotes) {
        row.push(cell);
        cell = "";
        continue;
      }

      if ((char === "\n" || char === "\r") && !inQuotes) {
        if (char === "\r" && next === "\n") i++;
        row.push(cell);
        rows.push(row);
        row = [];
        cell = "";
        continue;
      }

      cell += char;
    }

    if (cell.length || row.length) {
      row.push(cell);
      rows.push(row);
    }

    return rows.filter((r) => r.some((cellValue) => String(cellValue).trim() !== ""));
  }

  function findHeaderIndex(rows, requiredLabels) {
    const labels = requiredLabels.map(normalizeText);
    const index = rows.findIndex((row) => {
      const normalized = row.map(normalizeText);
      return labels.every((label) => normalized.some((cell) => cell.includes(label)));
    });
    return index >= 0 ? index : 0;
  }

  function rowsToObjects(rows, headerIndex) {
    const headers = rows[headerIndex].map((h, idx) => cleanText(h) || `col_${idx}`);
    return rows.slice(headerIndex + 1).map((row) => {
      const obj = {};
      headers.forEach((header, idx) => {
        obj[header] = cleanText(row[idx]);
      });
      return obj;
    });
  }

  function groupBy(items, getKey) {
    const map = new Map();
    for (const item of items) {
      const key = getKey(item);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(item);
    }
    return map;
  }

  function countBy(items, getKey) {
    const map = new Map();
    for (const item of items) {
      const key = getKey(item);
      map.set(key, (map.get(key) || 0) + 1);
    }
    return map;
  }

  function canonicalSubject(value) {
    const text = normalizeText(value);
    if (!text) return "";

    if (/(matemat|estadistic|geometr|algebra|calculo|aritmet)/.test(text)) return "Matemáticas";
    if (/(lenguaje|lengua|castellano|espanol|lectura|literatura)/.test(text)) return "Lenguaje";
    if (/(educacion fisica|ed fisica|fisica deporte|deporte|recreacion)/.test(text)) return "Educación Física";
    if (/(natural|biolog|quimic|fisic|ambiental|ciencia)/.test(text) && !/social/.test(text)) return "Ciencias Naturales";
    if (/(ingles|english)/.test(text)) return "Inglés";
    if (/(social|ciudadan|historia|geografia|constitucion|democracia|politic)/.test(text)) return "Ciencias Sociales y Ciudadanía";
    if (/(etica|valores|convivencia|formacion humana|filosofia)/.test(text)) return "Ética y Valores";
    if (/(artist|arte|musica|dibujo|danza)/.test(text)) return "Artística";
    if (/(informat|tecnolog|sistema|programac|comput)/.test(text)) return "Informática";
    if (/(relig|ere|biblic|cristolog|eclesiolog)/.test(text)) return "Religión";

    const exact = SUBJECTS.find((subject) => normalizeText(subject.name) === text);
    return exact ? exact.name : cleanText(value);
  }

  function sameSubject(a, b) {
    return normalizeText(canonicalSubject(a)) === normalizeText(canonicalSubject(b));
  }

  function cleanText(value) {
    return String(value ?? "").replace(/\uFEFF/g, "").trim();
  }

  function cleanId(value) {
    return cleanText(value).replace(/\.0$/, "");
  }

  function cleanOption(value) {
    return cleanText(value).toUpperCase().replace(/[^A-H]/g, "").slice(0, 1);
  }

  function cleanMarked(value) {
    const text = cleanText(value).toUpperCase();
    if (!text || ["NAN", "NULL", "NA", "N/A", "-", "—", "SIN MARCAR"].includes(text)) return "";
    return text.replace(/[^A-H]/g, "");
  }

  function normalizeText(value) {
    return cleanText(value)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  }

  function toInt(value) {
    const match = cleanText(value).match(/\d+/);
    return match ? Number(match[0]) : 0;
  }

  function inferGradeFromPath(path) {
    const answer = String(path || "").match(/ANSWER[_-]?(\d+)/i);
    if (answer) return Number(answer[1]);
    const result = String(path || "").match(/(?:^|\/)(\d{1,2})S\d/i);
    if (result) return Number(result[1]);
    return 0;
  }

  function inferSessionFromPath(path) {
    const match = String(path || "").match(/S(\d+)/i);
    return match ? Number(match[1]) : 1;
  }

  function inferGradeFromExam(objects) {
    const exam = objects.find((obj) => obj.Exam)?.Exam || "";
    const match = String(exam).match(/\d+/);
    return match ? Number(match[0]) : 0;
  }

  function assignmentKeyFor(row) {
    const grade = toInt(row.grade);
    const subject = normalizeText(canonicalSubject(row.subjectRaw || row.subject));
    const group = normalizeText(row.group || "");
    return `${grade}|${group}|${subject}`;
  }

  function teacherAssignmentMatches(student, assignment) {
    if (!student || !assignment) return false;
    const sameGrade = String(student.grade) === String(assignment.grade);
    const sameGroup = !assignment.group || normalizeText(student.group) === normalizeText(assignment.group);
    return sameGrade && sameGroup && student.subjectStats[assignment.subject]?.total;
  }

  function keyId(row) {
    return `${row.grade}-${row.item}`;
  }

  function esc(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function escAttr(value) {
    return esc(value)
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, Number(value) || 0));
  }

  function normalizeColor(value) {
    const fallback = "#ff7900";
    const raw = String(value || "").trim();
    if (/^#[0-9a-f]{6}$/i.test(raw)) return raw.toLowerCase();
    if (/^#[0-9a-f]{3}$/i.test(raw)) {
      return `#${raw[1]}${raw[1]}${raw[2]}${raw[2]}${raw[3]}${raw[3]}`.toLowerCase();
    }
    return fallback;
  }

  function hexToRgb(hex) {
    const color = normalizeColor(hex).slice(1);
    return {
      r: parseInt(color.slice(0, 2), 16),
      g: parseInt(color.slice(2, 4), 16),
      b: parseInt(color.slice(4, 6), 16)
    };
  }

  function alphaColor(hex, alpha) {
    const rgb = hexToRgb(hex);
    return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
  }

  function mixWithWhite(hex, percent) {
    const rgb = hexToRgb(hex);
    const ratio = clamp(percent, 0, 100) / 100;
    const r = Math.round(rgb.r + (255 - rgb.r) * ratio);
    const g = Math.round(rgb.g + (255 - rgb.g) * ratio);
    const b = Math.round(rgb.b + (255 - rgb.b) * ratio);
    return `#${[r, g, b].map((v) => Number(v).toString(16).padStart(2, "0")).join("")}`;
  }

  function shadeColor(hex, percent) {
    const rgb = hexToRgb(hex);
    const amount = Math.round(2.55 * percent);
    const r = clamp(rgb.r + amount, 0, 255);
    const g = clamp(rgb.g + amount, 0, 255);
    const b = clamp(rgb.b + amount, 0, 255);
    return `#${[r, g, b].map((v) => Number(v).toString(16).padStart(2, "0")).join("")}`;
  }

  function avg(values) {
    const nums = values.filter((value) => Number.isFinite(Number(value))).map(Number);
    if (!nums.length) return "—";
    return Math.round(nums.reduce((a, b) => a + b, 0) / nums.length);
  }

  function readJSON(key, fallback) {
    try {
      const value = localStorage.getItem(key);
      return value ? JSON.parse(value) : fallback;
    } catch {
      return fallback;
    }
  }

  function writeJSON(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function readImageFile(file, callback) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast("Selecciona una imagen válida.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => callback(reader.result);
    reader.onerror = () => toast("No se pudo leer la imagen.");
    reader.readAsDataURL(file);
  }

  function downloadFile(filename, text, type) {
    const blob = new Blob([text], { type });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    URL.revokeObjectURL(link.href);
    link.remove();
  }

  function toCSV(rows) {
    return rows.map((row) => row.map((cell) => {
      const value = String(cell ?? "");
      if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
      return value;
    }).join(",")).join("\r\n");
  }

  function toast(message) {
    toastEl.textContent = message;
    toastEl.classList.add("show");
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => toastEl.classList.remove("show"), 2500);
  }
})();
