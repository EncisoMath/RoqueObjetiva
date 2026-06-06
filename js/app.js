
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
    directores: "po_directores_grupo_override_v1",
    session: "po_session_v1",
    github: "po_github_publish_v1",
    students: "po_students_override_v1"
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
    logoImage: "assets/logo-principal.png",
    appIcon: "icons/icon-512.png",
    bannerImage: "",
    footerText: "Consulta institucional de resultados",
    primaryColor: "#1975ae",
    buttonRadius: 4,
    logoZoom: 1,
    subjectLogos: {},
    github: { owner: "", repo: "", branch: "main" }
  };

  const DEFAULT_GRADES = [6, 7, 8, 9, 10];

  const DEFAULT_MANIFEST = {
    config: "config/site-config.json",
    estudiantes: "ESTUDIANTES/ESTUDIANTES.json",
    carga: "INTERNO/CARGA.json",
    directoresGrupo: "INTERNO/DIRECTORESGRUPO.json",
    grades: DEFAULT_GRADES,
    keyTemplate: "KEYS/KEYS_{grade}.json",
    resultTemplate: "RESULTADOS/{grade}S{session}.json",
    sessions: [
      { session: 1, startItem: 1 },
      { session: 2, startItem: 71 }
    ],
    optionalGradeFiles: true,
    keys: [],
    resultados: []
  };

  const state = {
    manifest: DEFAULT_MANIFEST,
    config: { ...DEFAULT_CONFIG },
    logos: {},
    keys: [],
    studentsRegistry: [],
    cargaRows: [],
    directorRows: [],
    teachers: new Map(),
    responsesByRoll: new Map(),
    missingFiles: [],
    computedStudents: [],
    computedByRoll: new Map(),
    studentLogin: new Map(),
    registryByExamId: new Map(),
    registryByNationalId: new Map(),
    selectedSubject: null,
    metricTab: "components",
    teacherActive: null,
    teacherMode: "asignaturas",
    teacherDirectorActiveKey: "",
    teacherSearch: "",
    adminTab: "resumen",
    adminStudentSearch: "",
    adminGradeFilter: "all",
    adminSubjectFilter: "all",
    adminResultScope: "sede",
    adminResultSede: "all",
    adminResultGrade: "all",
    adminResultGroup: "all",
    adminResultSubject: "all",
    adminResultStudent: "all",
    adminAnalysisSede: "all",
    adminAnalysisGrade: "all",
    adminAnalysisMode: "grade",
    adminAnalysisSubject: "all",
    adminAnalysisDetail: null,
    adminCargaTeacherId: "",
    adminDirectorTeacherId: "",
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
    document.documentElement.removeAttribute("data-theme");
    applyAppMeta();
    const storedCarga = readJSON(STORAGE.carga, null);
    if (storedCarga && Array.isArray(storedCarga.rows)) {
      state.cargaRows = storedCarga.rows;
    }
  }

  async function loadAllData() {
    const manifestText = await fetchText("config/data-manifest.json", false);
    if (manifestText) {
      state.manifest = normalizeManifest({ ...DEFAULT_MANIFEST, ...JSON.parse(manifestText) });
    } else {
      state.manifest = normalizeManifest(DEFAULT_MANIFEST);
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
    applyAppMeta();

    state.keys = [];
    state.responsesByRoll = new Map();
    state.missingFiles = [];

    const studentText = await fetchText(state.manifest.estudiantes, true);
    state.studentsRegistry = parseStudents(studentText);
    const storedStudents = readJSON(STORAGE.students, null);
    if (storedStudents && Array.isArray(storedStudents.rows)) {
      state.studentsRegistry = storedStudents.rows.map(normalizeStudentRow).filter((s) => s.examId || s.nationalId || s.name);
    }
    state.manifest = addGradesToManifest(state.manifest, state.studentsRegistry.map((student) => student.grade));

    const storedCarga = readJSON(STORAGE.carga, null);
    if (storedCarga && Array.isArray(storedCarga.rows)) {
      state.cargaRows = storedCarga.rows;
    } else {
      const cargaText = await fetchText(state.manifest.carga, true);
      state.cargaRows = parseCarga(cargaText);
    }
    state.manifest = addGradesToManifest(state.manifest, state.cargaRows.map((row) => row.grade));

    const storedDirectores = readJSON(STORAGE.directores, null);
    if (storedDirectores && Array.isArray(storedDirectores.rows)) {
      state.directorRows = storedDirectores.rows.map(normalizeDirectorRow).filter((row) => row.id && row.sede && row.grade && row.group);
    } else {
      const directorText = await fetchText(state.manifest.directoresGrupo || "INTERNO/DIRECTORESGRUPO.json", false);
      state.directorRows = directorText ? parseDirectoresGrupo(directorText) : [];
    }
    state.manifest = addGradesToManifest(state.manifest, state.directorRows.map((row) => row.grade));

    for (const keyFile of state.manifest.keys || []) {
      const required = !(keyFile.optional || keyFile.required === false);
      const text = await fetchText(keyFile.path, required);
      if (!text) {
        state.missingFiles.push({ type: "key", grade: keyFile.grade, path: keyFile.path });
        continue;
      }
      state.keys.push(...parseAnswerKey(text, keyFile));
    }

    applyAnswerOverrides();

    for (const resultFile of state.manifest.resultados || []) {
      const required = !(resultFile.optional || resultFile.required === false);
      const text = await fetchText(resultFile.path, required);
      if (!text) {
        state.missingFiles.push({ type: "result", grade: resultFile.grade, session: resultFile.session, path: resultFile.path });
        continue;
      }
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

  function normalizeManifest(rawManifest = {}) {
    const base = { ...DEFAULT_MANIFEST, ...(rawManifest || {}) };
    const configuredGrades = normalizeGradeList(base.grades, base.keys, base.resultados);
    const sessions = normalizeManifestSessions(base.sessions);
    const optional = base.optionalGradeFiles !== false;

    const generatedKeys = configuredGrades.map((grade) => ({
      grade,
      path: templatePath(base.keyTemplate || "KEYS/KEYS_{grade}.json", { grade }),
      optional
    }));

    const generatedResults = configuredGrades.flatMap((grade) => sessions.map((sessionInfo) => ({
      grade,
      session: sessionInfo.session,
      startItem: sessionInfo.startItem,
      path: templatePath(base.resultTemplate || "RESULTADOS/{grade}S{session}.json", { grade, session: sessionInfo.session }),
      optional
    })));

    const explicitKeys = (Array.isArray(base.keys) ? base.keys : [])
      .map((item) => ({ ...item, grade: toInt(item.grade) || inferGradeFromPath(item.path), path: cleanText(item.path), optional: item.optional !== undefined ? item.optional : (item.required === false ? true : optional) }))
      .filter((item) => item.grade && item.path);

    const explicitResults = (Array.isArray(base.resultados) ? base.resultados : [])
      .map((item) => ({
        ...item,
        grade: toInt(item.grade) || inferGradeFromPath(item.path),
        session: toInt(item.session) || inferSessionFromPath(item.path),
        startItem: toInt(item.startItem) || (toInt(item.session) === 2 || inferSessionFromPath(item.path) === 2 ? 71 : 1),
        path: cleanText(item.path),
        optional: item.optional !== undefined ? item.optional : (item.required === false ? true : optional)
      }))
      .filter((item) => item.grade && item.path);

    return {
      ...base,
      grades: configuredGrades,
      sessions,
      keys: mergeManifestFiles(generatedKeys, explicitKeys),
      resultados: mergeManifestFiles(generatedResults, explicitResults)
    };
  }

  function normalizeGradeList(grades, keys = [], resultados = []) {
    const values = [];
    const pushGrade = (value) => {
      const grade = toInt(typeof value === "object" && value ? (value.grade || value.GRADO || value.value) : value);
      if (grade && !values.includes(grade)) values.push(grade);
    };
    if (Array.isArray(grades) && grades.length) grades.forEach(pushGrade);
    (Array.isArray(keys) ? keys : []).forEach((item) => pushGrade(item.grade || inferGradeFromPath(item.path)));
    (Array.isArray(resultados) ? resultados : []).forEach((item) => pushGrade(item.grade || inferGradeFromPath(item.path)));
    if (!values.length) DEFAULT_GRADES.forEach(pushGrade);
    return values.sort((a, b) => a - b);
  }

  function addGradesToManifest(manifest, gradeValues = []) {
    const current = normalizeGradeList(manifest?.grades || [], manifest?.keys || [], manifest?.resultados || []);
    const next = [...current];
    (gradeValues || []).forEach((value) => {
      const grade = toInt(value);
      if (grade && !next.includes(grade)) next.push(grade);
    });
    next.sort((a, b) => a - b);
    if (next.join("|") === current.join("|")) return manifest;
    return normalizeManifest({ ...manifest, grades: next });
  }

  function normalizeManifestSessions(sessions) {
    const list = Array.isArray(sessions) && sessions.length ? sessions : DEFAULT_MANIFEST.sessions;
    return list.map((item, index) => {
      const session = toInt(item.session || item.id || item.SESSION) || index + 1;
      return {
        session,
        startItem: toInt(item.startItem || item.start || item.offset && Number(item.offset) + 1) || (session === 2 ? 71 : 1)
      };
    }).filter((item) => item.session && item.startItem);
  }

  function templatePath(template, values) {
    return cleanText(template)
      .replace(/\{grade\}/g, String(values.grade ?? ""))
      .replace(/\{session\}/g, String(values.session ?? ""));
  }

  function mergeManifestFiles(generated, explicit) {
    const map = new Map();
    [...generated, ...explicit].forEach((item) => {
      if (!item?.path) return;
      map.set(item.path, { ...map.get(item.path), ...item });
    });
    return [...map.values()].sort((a, b) => (Number(a.grade || 0) - Number(b.grade || 0)) || (Number(a.session || 0) - Number(b.session || 0)) || String(a.path).localeCompare(String(b.path)));
  }

  function parseStudents(text) {
    const objects = parseDataObjects(text, ["ID_PRUEBA", "NOMBRES"]);
    return objects.map((row) => {
      const apellidos = cleanText(row.APELLIDOS || row.Apellidos || row.apellidos);
      const nombres = cleanText(row.NOMBRE_COMPLETO || row.NOMBRES || row.Nombres || row.Name || row.Nombre || row.nombre);
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

  function parseDirectoresGrupo(text) {
    const objects = parseDataObjects(text, ["Identificación", "Sede"]);
    return objects.map(normalizeDirectorRow).filter((row) => row.id && row.sede && row.grade && row.group);
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
        state.teachers.set(row.id, { id: row.id, name: row.name, assignments: [], directorGroups: [] });
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

    for (const row of state.directorRows || []) {
      if (!row.id) continue;
      if (!state.teachers.has(row.id)) {
        state.teachers.set(row.id, { id: row.id, name: teacherNameById(row.id), assignments: [], directorGroups: [] });
      }
      const teacher = state.teachers.get(row.id);
      if (!teacher.directorGroups) teacher.directorGroups = [];
      const key = directorKeyFor(row);
      if (!teacher.directorGroups.some((item) => item.key === key)) {
        teacher.directorGroups.push({ key, id: row.id, sede: row.sede || "", grade: row.grade, group: row.group || "" });
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
    const primary = normalizeColor(state.config.primaryColor || "#1975ae");
    const primaryDark = shadeColor(primary, -26);
    const primaryDeep = shadeColor(primary, -52);
    const primarySoft = mixWithWhite(primary, 34);
    const rgb = hexToRgb(primary);
    document.documentElement.style.setProperty("--button-radius", `${Number(state.config.buttonRadius ?? 4)}px`);
    document.documentElement.style.setProperty("--logo-zoom", `${Number(state.config.logoZoom ?? 1)}`);
    document.documentElement.style.setProperty("--orange", primary);
    document.documentElement.style.setProperty("--orange-2", primarySoft);
    document.documentElement.style.setProperty("--orange-3", primaryDark);
    document.documentElement.style.setProperty("--login-deep", primaryDeep);
    document.documentElement.style.setProperty("--primary-rgb", `${rgb.r}, ${rgb.g}, ${rgb.b}`);
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", primaryDark);
    applyAppMeta(primaryDark);
    const logo = state.config.logoImage || "assets/logo-principal.png";
    app.innerHTML = `
      <section class="login-shell login-shell-dark" style="--login-primary:${primary};--login-dark:${primaryDark};--login-deep:${primaryDeep};">
        <div class="login-bg-shapes" aria-hidden="true">
          ${renderPlayShapes("login")}
        </div>
        <div class="login-panel">
          <div class="login-card login-card-dark">
            ${logo ? `<div class="login-main-logo"><img src="${escAttr(logo)}" alt="Logo institucional"></div>` : ""}
            <span class="login-eyebrow">Consulta de resultados</span>
            <h1>Bienvenido</h1>
            <p>Ingresa con el ID del examen, el documento del estudiante o el ID docente.</p>
            ${error ? `<div class="admin-note login-error">${esc(error)}</div>` : ""}
            <form class="login-form" id="loginForm">
              <div class="field">
                <label for="loginUser">Usuario o ID</label>
                <input id="loginUser" autocomplete="username" placeholder="Ej. 2585, 1085111839, ID docente o admin" required />
              </div>
              <div class="field login-password-field is-hidden" id="loginPasswordField">
                <label for="loginPass">Contraseña</label>
                <input id="loginPass" type="password" autocomplete="current-password" placeholder="Contraseña de administrador" />
              </div>
              <div class="login-actions">
                <button class="primary-btn" type="submit">Ingresar</button>
                <span class="login-hint">Estudiantes y docentes ingresan solo con su ID.</span>
              </div>
            </form>
          </div>
        </div>
      </section>
    `;
    setTimeout(() => document.getElementById("loginUser")?.focus(), 50);
  }

  function renderPlayShapes(prefix = "banner") {
    const shapes = ["x", "square", "tri", "circle"];
    const variants = ["", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve"];
    const symbols = { x: "×", square: "□", tri: "△", circle: "○" };
    return variants.map((variant, index) => {
      const shape = shapes[index % shapes.length];
      return `<span class="shape ${shape} ${variant}" aria-hidden="true">${symbols[shape]}</span>`;
    }).join("");
  }

  function renderShell(content, nav = "") {
    const cfg = state.config;
    const primary = normalizeColor(cfg.primaryColor || "#1975ae");
    const primaryDark = shadeColor(primary, -18);
    const primarySoft = mixWithWhite(primary, 34);
    const rgb = hexToRgb(primary);
    document.documentElement.style.setProperty("--orange", primary);
    document.documentElement.style.setProperty("--orange-2", primarySoft);
    document.documentElement.style.setProperty("--orange-3", primaryDark);
    document.documentElement.style.setProperty("--primary-rgb", `${rgb.r}, ${rgb.g}, ${rgb.b}`);
    document.documentElement.style.setProperty("--button-radius", `${Number(cfg.buttonRadius ?? 4)}px`);
    document.documentElement.style.setProperty("--logo-zoom", `${Number(cfg.logoZoom ?? 1)}`);
    document.documentElement.removeAttribute("data-theme");
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", primary);
    applyAppMeta(primary);
    const bannerStyle = `style="background: linear-gradient(105deg, ${primary} 0%, ${primary} 42%, ${primaryDark} 100%)"`;
    app.innerHTML = `
      <div class="app-shell">
        <header class="top-banner" ${bannerStyle}>
          <div class="banner-shapes" aria-hidden="true">
            ${renderPlayShapes("banner")}
          </div>
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
          <div class="score-number">${student.globalScore ?? "—"}<small>/500</small></div>
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

  function buildSubjectDetailHtml(student, subject, stat, compact = false, showCorrect = false) {
    if (!stat) return `<div class="empty-state">No hay información para esta asignatura.</div>`;
    const detailRows = (stat.details || []).map((detail, index) => answerPill(detail, student.roll, index + 1, showCorrect)).join("");
    const activeMetric = state.metricTab === "competences" ? "competences" : "components";
    const detailHeader = compact ? `
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
    ` : "";
    return `
      <div class="subject-detail">
        ${detailHeader}

        <div class="subject-stats-row">
          <div><span>Correctas</span><strong>${stat.correct ?? 0}</strong></div>
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

  function subjectItemValue(grade, subject, stat = null) {
    const total = Number(stat?.total) || state.keys.filter((key) => (!grade || key.grade === Number(grade)) && sameSubject(key.area, subject)).length;
    if (!total) return { total: 0, value: null, label: "—" };
    const value = 80 / total;
    const label = Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
    return { total, value, label };
  }

  function renderTeacher(teacher) {
    const assignments = teacher.assignments || [];
    const directorGroups = teacher.directorGroups || [];
    const hasAssignments = assignments.length > 0;
    const hasDirector = directorGroups.length > 0;

    if (!hasAssignments && hasDirector) state.teacherMode = "director";
    if (!hasDirector && state.teacherMode === "director") state.teacherMode = "asignaturas";
    if (!state.teacherMode) state.teacherMode = hasAssignments ? "asignaturas" : "director";

    if (state.teacherMode === "director" && hasDirector) {
      return renderTeacherDirector(teacher);
    }
    return renderTeacherAssignments(teacher);
  }

  function teacherModeTabs(teacher, activeMode) {
    const assignments = teacher.assignments || [];
    const directorGroups = teacher.directorGroups || [];
    if (!assignments.length && !directorGroups.length) return "";
    return `
      <nav class="teacher-mode-tabs">
        <button class="nav-chip ${activeMode === "asignaturas" ? "active" : ""}" data-action="teacher-mode" data-mode="asignaturas" ${assignments.length ? "" : "disabled"}>Mis asignaturas</button>
        <button class="nav-chip ${activeMode === "director" ? "active" : ""}" data-action="teacher-mode" data-mode="director" ${directorGroups.length ? "" : "disabled"}>Director de grupo</button>
      </nav>
    `;
  }

  function renderTeacherAssignments(teacher) {
    const assignments = teacher.assignments || [];
    if (!state.teacherActive || !assignments.some((a) => a.key === state.teacherActive.key)) {
      state.teacherActive = assignments.find((assignment) => state.computedStudents.some((student) => teacherAssignmentMatches(student, assignment))) || assignments[0] || null;
    }

    const active = state.teacherActive;
    const groupedAssignments = groupAssignmentsBySubject(assignments);
    const activeSubject = active?.subject || groupedAssignments[0]?.subject || "";

    const subjectButtons = groupedAssignments.map((group) => `
      <button class="tab-btn teacher-subject-tab ${activeSubject === group.subject ? "active" : ""}" data-action="teacher-subject" data-subject="${escAttr(group.subject)}">
        ${esc(group.subject)}
      </button>
    `).join("");

    const groupButtons = (groupedAssignments.find((group) => group.subject === activeSubject)?.assignments || []).map((a) => `
      <button class="tab-btn teacher-group-tab ${active?.key === a.key ? "active" : ""}" data-action="teacher-assignment" data-key="${escAttr(a.key)}" data-grade="${escAttr(a.grade)}" data-subject="${escAttr(a.subject)}" data-group="${escAttr(a.group || "")}" data-sede="${escAttr(a.sede || "")}">
        ${esc(a.grade)}°${a.group ? ` · ${esc(a.group)}` : ""}${a.sede ? ` · ${esc(a.sede)}` : ""}
      </button>
    `).join("");

    const students = active
      ? state.computedStudents.filter((student) => teacherAssignmentMatches(student, active))
      : [];

    const filtered = students
      .sort((a, b) => a.name.localeCompare(b.name, "es", { sensitivity: "base" }));

    const activeStatForValue = filtered.find((student) => student.subjectStats[active?.subject])?.subjectStats?.[active?.subject] || null;
    const itemValueInfo = active ? subjectItemValue(active.grade, active.subject, activeStatForValue) : { total: 0, value: null, label: "—" };

    const rows = filtered.map((student, index) => {
      const stat = student.subjectStats[active.subject];
      return `
        <tr class="table-row-click" data-action="open-detail" data-roll="${escAttr(student.roll)}" data-subject="${escAttr(active.subject)}">
          <td class="teacher-index">${index + 1}</td>
          <td><strong>${esc(student.name)}</strong><br><span class="student-subid">ID Prueba ${esc(student.roll)}</span></td>
          <td><span class="teacher-score teacher-score-plain">${stat.score ?? "—"}</span></td>
          <td><strong>${stat.correct}/${stat.total}</strong></td>
        </tr>
      `;
    }).join("");

    renderShell(`
      <section class="toolbar teacher-toolbar">
        <div>
          <span class="section-eyebrow">Panel docente</span>
          <h2 style="margin:8px 0 0;font-size:clamp(1.4rem,4vw,2.2rem);font-weight:900;letter-spacing:-.04em;">${esc(teacher.name || "Docente")}</h2>
          ${active ? `<p class="teacher-active-label">${esc(active.subject)} · ${esc(active.grade)}°${active.group ? ` · ${esc(active.group)}` : ""}${active.sede ? ` · ${esc(active.sede)}` : ""}</p>` : ""}
        </div>
      </section>

      ${teacherModeTabs(teacher, "asignaturas")}

      <div class="teacher-nav-block">
        <nav class="teacher-assignment-nav teacher-subject-nav">${subjectButtons || `<span class="badge gray">Sin cargas asignadas</span>`}</nav>
        ${activeSubject ? `<nav class="teacher-assignment-nav teacher-group-nav">${groupButtons || `<span class="badge gray">Sin cursos para esta asignatura</span>`}</nav>` : ""}
      </div>

      ${active ? `
        <section class="teacher-stat-strip teacher-stat-strip-three">
          <article class="card card-pad teacher-stat"><span>Estudiantes</span><strong>${filtered.length}</strong></article>
          <article class="card card-pad teacher-stat"><span>Promedio</span><strong>${avg(filtered.map((s) => s.subjectStats[active.subject].score))}<small>/100</small></strong></article>
          <button class="card card-pad teacher-stat teacher-stat-action" data-action="teacher-score-info" data-subject="${escAttr(active.subject)}" data-grade="${escAttr(active.grade)}" data-total="${escAttr(itemValueInfo.total)}">
            <span>Valor de cada ítem</span>
            <strong>${esc(itemValueInfo.label)}<small> puntos</small></strong>
            <em>Toca para ver cómo se calculan las notas de tus estudiantes.</em>
          </button>
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

  function renderTeacherDirector(teacher) {
    const groups = (teacher.directorGroups || []).slice().sort((a, b) => {
      const sede = String(a.sede || "").localeCompare(String(b.sede || ""), "es", { sensitivity: "base" });
      if (sede) return sede;
      const grade = Number(a.grade || 0) - Number(b.grade || 0);
      if (grade) return grade;
      return String(a.group || "").localeCompare(String(b.group || ""), "es", { sensitivity: "base", numeric: true });
    });
    if (!state.teacherDirectorActiveKey || !groups.some((group) => group.key === state.teacherDirectorActiveKey)) {
      state.teacherDirectorActiveKey = groups[0]?.key || "";
    }
    const active = groups.find((group) => group.key === state.teacherDirectorActiveKey) || groups[0] || null;
    const students = active
      ? state.computedStudents.filter((student) => directorGroupMatches(student, active)).sort((a, b) => a.name.localeCompare(b.name, "es", { sensitivity: "base" }))
      : [];
    const subjects = SUBJECTS.filter((subject) => students.some((student) => student.subjectStats[subject.name]?.total));
    const scorePool = students.flatMap((student) => subjects.map((subject) => student.subjectStats[subject.name]?.score).filter((value) => Number.isFinite(value)));
    const groupButtons = groups.map((group) => `
      <button class="tab-btn teacher-group-tab ${active?.key === group.key ? "active" : ""}" data-action="teacher-director-group" data-key="${escAttr(group.key)}">
        ${esc(group.sede)} · ${esc(group.grade)}° · ${esc(group.group)}
      </button>
    `).join("");
    const subjectCards = subjects.map((subject) => {
      const values = students.map((student) => student.subjectStats[subject.name]?.score).filter((value) => Number.isFinite(value));
      const display = avg(values);
      const percent = Number.isFinite(Number(display)) ? clamp(Number(display), 0, 100) : 0;
      return `
        <button class="director-subject-card" data-action="director-subject-detail" data-key="${escAttr(active?.key || "")}" data-subject="${escAttr(subject.name)}">
          <span class="director-subject-head">${subjectIcon(subject.name)}<strong>${esc(subject.name)}</strong></span>
          <span class="director-subject-score">${display}<small>/100</small></span>
          <span class="admin-analysis-mini-bar"><i style="width:${percent}%"></i></span>
          <em>${values.length} estudiante${values.length === 1 ? "" : "s"}</em>
        </button>
      `;
    }).join("");
    const tableRows = students.map((student, index) => `
      <tr>
        <td class="teacher-index">${index + 1}</td>
        <td><strong>${esc(student.name)}</strong><br><span class="student-subid">ID Prueba ${esc(student.roll)}</span></td>
        ${subjects.map((subject) => `<td><span class="teacher-score teacher-score-plain">${student.subjectStats[subject.name]?.score ?? "—"}</span></td>`).join("")}
      </tr>
    `).join("");

    renderShell(`
      <section class="toolbar teacher-toolbar">
        <div>
          <span class="section-eyebrow">Director de grupo</span>
          <h2 style="margin:8px 0 0;font-size:clamp(1.4rem,4vw,2.2rem);font-weight:900;letter-spacing:-.04em;">${esc(teacher.name || "Docente")}</h2>
          ${active ? `<p class="teacher-active-label">${esc(active.sede)} · ${esc(active.grade)}° · ${esc(active.group)}</p>` : ""}
        </div>
      </section>

      ${teacherModeTabs(teacher, "director")}

      <div class="teacher-nav-block">
        <nav class="teacher-assignment-nav teacher-group-nav">${groupButtons || `<span class="badge gray">No tienes dirección de grupo asignada.</span>`}</nav>
      </div>

      ${active ? `
        <section class="teacher-stat-strip teacher-stat-strip-three">
          <article class="card card-pad teacher-stat"><span>Estudiantes</span><strong>${students.length}</strong></article>
          <article class="card card-pad teacher-stat"><span>Promedio general</span><strong>${avg(scorePool)}<small>/100</small></strong></article>
          <article class="card card-pad teacher-stat"><span>Áreas evaluadas</span><strong>${subjects.length}</strong></article>
        </section>
        <section class="director-subject-grid">
          ${subjectCards || `<div class="card card-pad empty-state">No hay resultados por asignatura para este grupo.</div>`}
        </section>
        <section class="card table-card teacher-table-card director-table-card">
          <div class="table-wrap">
            <table class="teacher-table director-table">
              <thead><tr><th>#</th><th>Estudiante</th>${subjects.map((subject) => `<th>${esc(subject.short || subject.name)}</th>`).join("")}</tr></thead>
              <tbody>${tableRows || `<tr><td colspan="${2 + subjects.length}" class="empty-state">No hay estudiantes con resultados en este grupo.</td></tr>`}</tbody>
            </table>
          </div>
        </section>
      ` : `<section class="card card-pad empty-state">No tienes dirección de grupo asignada.</section>`}
    `, navFor("teacher"));
  }

  function openDirectorSubjectDetail(key, subject) {
    const teacher = state.teachers.get(state.activeSession?.id);
    const directorGroup = (teacher?.directorGroups || []).find((group) => group.key === key);
    if (!directorGroup || !subject) return;
    const students = state.computedStudents
      .filter((student) => directorGroupMatches(student, directorGroup) && student.subjectStats[subject]?.total)
      .sort((a, b) => a.name.localeCompare(b.name, "es", { sensitivity: "base" }));
    const details = aggregateDetails(students, subject);
    const scores = students.map((student) => student.subjectStats[subject]?.score).filter((value) => Number.isFinite(value));
    const rows = students.map((student, index) => {
      const stat = student.subjectStats[subject];
      return `
        <tr class="table-row-click" data-action="open-detail" data-roll="${escAttr(student.roll)}" data-subject="${escAttr(subject)}">
          <td class="teacher-index">${index + 1}</td>
          <td><strong>${esc(student.name)}</strong><br><span class="student-subid">ID Prueba ${esc(student.roll)}</span></td>
          <td><span class="teacher-score teacher-score-plain">${stat.score ?? "—"}</span></td>
          <td><strong>${stat.correct}/${stat.total}</strong></td>
        </tr>
      `;
    }).join("");
    modalRoot.innerHTML = `
      <div class="modal-backdrop" data-action="close-modal">
        <section class="modal" style="max-width:980px;">
          <div class="modal-head">
            <div>
              <h2>${esc(subject)}</h2>
              <span style="color:#7d8089;font-weight:600;">${esc(directorGroup.sede)} · ${esc(directorGroup.grade)}° · ${esc(directorGroup.group)}</span>
            </div>
            <button type="button" class="icon-btn" data-action="close-modal" aria-label="Cerrar">×</button>
          </div>
          <div class="modal-body">
            <section class="teacher-stat-strip teacher-stat-strip-two admin-results-stats">
              <article class="card card-pad teacher-stat"><span>Estudiantes</span><strong>${students.length}</strong></article>
              <article class="card card-pad teacher-stat"><span>Promedio</span><strong>${avg(scores)}<small>/100</small></strong></article>
            </section>
            <section class="teacher-metrics-row admin-results-metrics">
              ${teacherAggregateMetricsHtmlForDetails(details)}
            </section>
            <section class="teacher-key-actions">
              <button class="secondary-btn" data-action="open-answer-key" data-grade="${escAttr(directorGroup.grade)}" data-subject="${escAttr(subject)}">Ver respuestas correctas</button>
            </section>
            <section class="card table-card teacher-table-card">
              <div class="table-wrap">
                <table class="teacher-table">
                  <thead><tr><th>#</th><th>Estudiante</th><th>Nota</th><th>Correctas</th></tr></thead>
                  <tbody>${rows || `<tr><td colspan="4" class="empty-state">No hay estudiantes para esta selección.</td></tr>`}</tbody>
                </table>
              </div>
            </section>
          </div>
        </section>
      </div>
    `;
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
      ["resultados", "Resultados"],
      ["analisis", "Análisis"],
      ["apariencia", "Apariencia"],
      ["logos", "Logos"],
      ["cargas", "Cargas"],
      ["directores", "Directores de grupo"],
      ["claves", "Claves"],
      ["github", "GitHub"]
    ];

    const nav = `
      <nav class="app-nav admin-top-tabs">
        ${tabs.map(([id, label]) => `<button class="nav-chip ${state.adminTab === id ? "active" : ""}" data-action="admin-tab" data-tab="${id}">${label}</button>`).join("")}
        <button class="nav-chip logout" data-action="logout">Salir</button>
      </nav>
    `;

    renderShell(`
      <section class="admin-layout admin-layout-full">
        <div class="admin-panel">${renderAdminTab()}</div>
      </section>
    `, nav);
  }

  function renderAdminTab() {
    switch (state.adminTab) {
      case "estudiantes": return adminStudentsHtml();
      case "resultados": return adminResultsHtml();
      case "analisis": return adminAnalyticsHtml();
      case "apariencia": return adminAppearanceHtml();
      case "logos": return adminLogosHtml();
      case "cargas": return adminCargaHtml();
      case "directores": return adminDirectoresHtml();
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
        <article class="card card-pad"><span class="section-eyebrow">Promedio global tipo Saber</span><h3 style="margin:8px 0 0;font-size:2rem;">${avgGlobal}<small style="color:#8c8f98">/500</small></h3></article>
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
          <h3 style="margin:0 0 12px;font-weight:900;">Estructura multigrado</h3>
          <div class="meta-row"><span>Grados configurados</span><strong>${(state.manifest.grades || []).join(", ") || "—"}</strong></div>
          <div class="meta-row"><span>Claves esperadas</span><strong>KEYS/KEYS_#.json</strong></div>
          <div class="meta-row"><span>Resultados esperados</span><strong>RESULTADOS/#S1.json · #S2.json</strong></div>
          <div class="meta-row"><span>Estudiantes</span><strong>ESTUDIANTES/ESTUDIANTES.json</strong></div>
          <div class="meta-row"><span>Carga docente</span><strong>INTERNO/CARGA.json</strong></div>
          ${state.missingFiles.length ? `<p style="color:#8a5a00;font-weight:700;line-height:1.5;">Hay ${state.missingFiles.length} archivo(s) de grados configurados que aún no existen. No bloquean la página; se activarán cuando los subas al repo.</p>` : ""}
          <p style="color:#686b74;font-weight:650;line-height:1.5;">Para agregar otro grado, súbelo con el patrón <strong>KEYS_#.json</strong>, <strong>#S1.json</strong>, <strong>#S2.json</strong> y añade el grado en <strong>config/data-manifest.json</strong>.</p>
        </article>
      </section>
    `;
  }

  function adminStudentsHtml() {
    const grades = [...new Set(state.studentsRegistry.map((s) => s.grade).filter(Boolean))].sort((a, b) => a - b);
    const query = normalizeText(state.adminStudentSearch);
    let rows = state.studentsRegistry.filter((s) => {
      const matchesText = !query || normalizeText(`${s.name} ${s.examId} ${s.nationalId} ${s.group} ${s.sede}`).includes(query);
      const matchesGrade = state.adminGradeFilter === "all" || String(s.grade) === String(state.adminGradeFilter);
      return matchesText && matchesGrade;
    }).sort((a, b) => a.name.localeCompare(b.name, "es", { sensitivity: "base" }));

    return `
      <section class="toolbar">
        <div>
          <span class="section-eyebrow">Registro de estudiantes</span>
          <h2 style="margin:8px 0 0;font-weight:900;">Modificar información de estudiantes</h2>
          <p class="muted-copy">Edita nombres, identificaciones, sedes, grados y cursos. Estos datos se cruzan con el ID de prueba para mostrar resultados.</p>
        </div>
        <div class="toolbar-right">
          <div class="search-box"><input placeholder="Buscar estudiante..." value="${escAttr(state.adminStudentSearch)}" data-action="admin-student-search"></div>
          <select class="select-pill" data-action="admin-grade-filter">
            <option value="all">Todos los grados</option>
            ${grades.map((g) => `<option value="${g}" ${String(state.adminGradeFilter) === String(g) ? "selected" : ""}>${g}°</option>`).join("")}
          </select>
        </div>
      </section>
      <div class="inline-actions admin-actions-line">
        <button class="primary-btn" data-action="add-student">Agregar estudiante</button>
        <button class="secondary-btn" data-action="save-students">Guardar estudiantes</button>
        <button class="ghost-btn" data-action="export-students">Exportar JSON</button>
        <button class="secondary-btn" data-action="publish-github">Publicar en GitHub</button>
      </div>
      <section class="card table-card admin-edit-table">
        <div class="table-wrap">
          <table>
            <thead><tr><th>#</th><th>ID prueba</th><th>ID estudiante</th><th>Nombre completo</th><th>Sede</th><th>Grado</th><th>Curso</th><th></th></tr></thead>
            <tbody>
              ${rows.map((student, viewIndex) => {
                const index = state.studentsRegistry.indexOf(student);
                return `
                  <tr>
                    <td><span class="badge gray">${viewIndex + 1}</span></td>
                    <td><input class="small-input" value="${escAttr(student.examId)}" data-student-row="${index}" data-field="examId"></td>
                    <td><input class="small-input" value="${escAttr(student.nationalId)}" data-student-row="${index}" data-field="nationalId"></td>
                    <td><input class="small-input wide-input" value="${escAttr(student.name)}" data-student-row="${index}" data-field="name"></td>
                    <td><input class="small-input" value="${escAttr(student.sede)}" data-student-row="${index}" data-field="sede"></td>
                    <td><input class="small-input" value="${escAttr(student.grade)}" data-student-row="${index}" data-field="grade"></td>
                    <td><input class="small-input" value="${escAttr(student.group)}" data-student-row="${index}" data-field="group"></td>
                    <td><button class="danger-btn" data-action="delete-student" data-index="${index}">Eliminar</button></td>
                  </tr>
                `;
              }).join("") || `<tr><td colspan="8" class="empty-state">No hay estudiantes con los filtros actuales.</td></tr>`}
            </tbody>
          </table>
        </div>
      </section>
    `;
  }

  function adminResultsHtml() {
    const sedes = ["all", ...uniqueValues(state.computedStudents.map((s) => s.sede))];
    const grades = ["all", ...uniqueValues(state.computedStudents
      .filter((s) => state.adminResultSede === "all" || s.sede === state.adminResultSede)
      .map((s) => s.grade).filter(Boolean)).sort((a, b) => Number(a) - Number(b))];
    const groups = ["all", ...uniqueValues(state.computedStudents
      .filter((s) => state.adminResultSede === "all" || s.sede === state.adminResultSede)
      .filter((s) => state.adminResultGrade === "all" || String(s.grade) === String(state.adminResultGrade))
      .map((s) => s.group))];
    const subjectBase = state.computedStudents
      .filter((s) => state.adminResultSede === "all" || s.sede === state.adminResultSede)
      .filter((s) => state.adminResultGrade === "all" || String(s.grade) === String(state.adminResultGrade))
      .filter((s) => state.adminResultGroup === "all" || s.group === state.adminResultGroup);
    const subjectOptions = ["all", ...uniqueValues(subjectBase.flatMap((student) => Object.entries(student.subjectStats || {})
      .filter(([, stat]) => stat?.total)
      .map(([name]) => name)))];
    const subject = state.adminResultSubject || "all";
    const isReady = state.adminResultSede !== "all" && state.adminResultGrade !== "all" && state.adminResultGroup !== "all" && subject !== "all";

    const filtered = isReady ? state.computedStudents.filter((student) => {
      const okSede = student.sede === state.adminResultSede;
      const okGrade = String(student.grade) === String(state.adminResultGrade);
      const okGroup = student.group === state.adminResultGroup;
      const okSubject = student.subjectStats[subject]?.total;
      return okSede && okGrade && okGroup && okSubject;
    }).sort((a, b) => a.name.localeCompare(b.name, "es", { sensitivity: "base" })) : [];

    const details = aggregateDetails(filtered, subject);
    const scoreValues = filtered.map((student) => adminStudentSubjectStat(student, subject).score).filter((value) => Number.isFinite(value));

    const rows = filtered.map((student, index) => {
      const stat = adminStudentSubjectStat(student, subject);
      return `
        <tr class="table-row-click" data-action="open-detail" data-roll="${escAttr(student.roll)}" data-subject="${escAttr(subject)}">
          <td class="teacher-index">${index + 1}</td>
          <td><strong>${esc(student.name)}</strong><br><span class="student-subid">ID Prueba ${esc(student.roll)} · ${esc(student.sede || "Sin sede")} · ${esc(student.grade)}° ${esc(student.group || "")}</span></td>
          <td><span class="teacher-score teacher-score-plain">${Number.isFinite(stat.score) ? stat.score : "—"}</span></td>
          <td><strong>${stat.total ? `${stat.correct}/${stat.total}` : "—"}</strong></td>
        </tr>
      `;
    }).join("");

    const scopeText = isReady
      ? `${state.adminResultSede} · ${state.adminResultGrade}° · ${state.adminResultGroup} · ${subject}`
      : "Selecciona sede, grado, curso y asignatura para generar la vista";

    const readyContent = isReady ? `
      <div class="teacher-active-label admin-results-scope">${esc(scopeText)}</div>
      <section class="teacher-stat-strip teacher-stat-strip-two admin-results-stats">
        <article class="card card-pad teacher-stat"><span>Estudiantes</span><strong>${filtered.length}</strong></article>
        <article class="card card-pad teacher-stat"><span>Promedio</span><strong>${avg(scoreValues)}<small>/100</small></strong></article>
      </section>
      <section class="teacher-metrics-row admin-results-metrics">
        ${teacherAggregateMetricsHtmlForDetails(details)}
      </section>
      <section class="teacher-key-actions">
        <button class="secondary-btn" data-action="open-answer-key" data-grade="${escAttr(state.adminResultGrade)}" data-subject="${escAttr(subject)}">Ver respuestas correctas</button>
      </section>
      <section class="card table-card teacher-table-card admin-results-table">
        <div class="table-wrap">
          <table class="teacher-table">
            <thead><tr><th>#</th><th>Estudiante</th><th>Nota</th><th>Correctas</th></tr></thead>
            <tbody>${rows || `<tr><td colspan="4" class="empty-state">No hay estudiantes con los filtros actuales.</td></tr>`}</tbody>
          </table>
        </div>
      </section>
    ` : `
      <section class="card card-pad admin-results-wait">
        <div class="empty-state">
          <h3>Parametriza la consulta</h3>
          <p>Para evitar promedios mezclados o lecturas confusas, la tabla solo aparece cuando selecciones <strong>sede</strong>, <strong>grado</strong>, <strong>curso</strong> y <strong>asignatura</strong>.</p>
        </div>
      </section>
    `;

    return `
      <section class="toolbar">
        <div>
          <span class="section-eyebrow">Resultados institucionales</span>
          <h2 style="margin:8px 0 0;font-weight:900;">Vista tipo docente, con filtros de admin</h2>
          <p class="muted-copy">Selecciona una combinación exacta. Cuando estén definidos sede, grado, curso y área, se mostrará la misma estructura de resultados que ven los docentes.</p>
        </div>
      </section>
      <section class="card card-pad admin-results-filters">
        <div class="form-grid compact admin-results-required-grid">
          <div class="field"><label>Sede</label><select class="select-pill" data-admin-results-field="sede">
            ${sedes.map((value) => `<option value="${escAttr(value)}" ${state.adminResultSede === value ? "selected" : ""}>${value === "all" ? "Selecciona sede" : esc(value)}</option>`).join("")}
          </select></div>
          <div class="field"><label>Grado</label><select class="select-pill" data-admin-results-field="grade">
            ${grades.map((value) => `<option value="${escAttr(value)}" ${String(state.adminResultGrade) === String(value) ? "selected" : ""}>${value === "all" ? "Selecciona grado" : `${esc(value)}°`}</option>`).join("")}
          </select></div>
          <div class="field"><label>Curso</label><select class="select-pill" data-admin-results-field="group">
            ${groups.map((value) => `<option value="${escAttr(value)}" ${state.adminResultGroup === value ? "selected" : ""}>${value === "all" ? "Selecciona curso" : esc(value)}</option>`).join("")}
          </select></div>
          <div class="field"><label>Área/asignatura</label><select class="select-pill" data-admin-results-field="subject">
            ${subjectOptions.map((value) => `<option value="${escAttr(value)}" ${subject === value ? "selected" : ""}>${value === "all" ? "Selecciona asignatura" : esc(value)}</option>`).join("")}
          </select></div>
        </div>
      </section>
      ${readyContent}
    `;
  }

  function teacherAggregateMetricsHtmlForDetails(details) {
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

  function adminStudentSubjectStat(student, subject) {
    if (subject !== "all") {
      const stat = student.subjectStats[subject] || {};
      return { score: stat.score, correct: stat.correct || 0, total: stat.total || 0 };
    }
    const stats = SUBJECTS.map((subjectInfo) => student.subjectStats[subjectInfo.name]).filter((stat) => stat?.total);
    const scores = stats.map((stat) => stat.score).filter((value) => Number.isFinite(value));
    return {
      score: scores.length ? Math.round(scores.reduce((sum, value) => sum + value, 0) / scores.length) : null,
      correct: stats.reduce((sum, stat) => sum + (stat.correct || 0), 0),
      total: stats.reduce((sum, stat) => sum + (stat.total || 0), 0)
    };
  }

  function uniqueValues(values) {
    return [...new Set(values.map((value) => cleanText(value)).filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b), "es", { numeric: true, sensitivity: "base" }));
  }

  function availableSubjects() {
    const fromKeys = uniqueValues(state.keys.map((key) => key.area));
    const base = SUBJECTS.map((subject) => subject.name);
    return [...new Set([...base, ...fromKeys].map(canonicalSubject).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b, "es", { sensitivity: "base" }));
  }

  function adminAnalyticsHtml() {
    const sedes = ["all", ...uniqueValues(state.computedStudents.map((s) => s.sede))];
    const grades = ["all", ...uniqueValues(state.computedStudents
      .filter((s) => state.adminAnalysisSede === "all" || s.sede === state.adminAnalysisSede)
      .map((s) => s.grade).filter(Boolean)).sort((a, b) => Number(a) - Number(b))];
    const subjects = ["all", ...availableSubjects()];
    const selectedSubjects = state.adminAnalysisSubject === "all" ? availableSubjects() : [state.adminAnalysisSubject];
    const baseStudents = state.computedStudents
      .filter((s) => state.adminAnalysisSede === "all" || s.sede === state.adminAnalysisSede)
      .filter((s) => state.adminAnalysisGrade === "all" || String(s.grade) === String(state.adminAnalysisGrade));
    const mode = state.adminAnalysisMode === "course" ? "course" : "grade";
    const groups = adminAnalysisGroups(baseStudents, mode);
    const detail = state.adminAnalysisDetail;

    return `
      <section class="toolbar">
        <div>
          <span class="section-eyebrow">Análisis visual</span>
          <h2 style="margin:8px 0 0;font-weight:900;">Mapa de desempeño por grado, curso y asignatura</h2>
          <p class="muted-copy">Mira rápidamente cómo va cada grado o curso. Cada tarjeta muestra el promedio de nota y permite abrir el detalle con la misma lógica de la vista docente.</p>
        </div>
      </section>
      <section class="card card-pad admin-analysis-filters">
        <div class="form-grid compact">
          <div class="field"><label>Sede</label><select class="select-pill" data-admin-analysis-field="sede">
            ${sedes.map((value) => `<option value="${escAttr(value)}" ${state.adminAnalysisSede === value ? "selected" : ""}>${value === "all" ? "Todas las sedes" : esc(value)}</option>`).join("")}
          </select></div>
          <div class="field"><label>Grado</label><select class="select-pill" data-admin-analysis-field="grade">
            ${grades.map((value) => `<option value="${escAttr(value)}" ${String(state.adminAnalysisGrade) === String(value) ? "selected" : ""}>${value === "all" ? "Todos los grados" : `${esc(value)}°`}</option>`).join("")}
          </select></div>
          <div class="field"><label>Agrupar por</label><select class="select-pill" data-admin-analysis-field="mode">
            <option value="grade" ${mode === "grade" ? "selected" : ""}>Grado general</option>
            <option value="course" ${mode === "course" ? "selected" : ""}>Curso</option>
          </select></div>
          <div class="field"><label>Asignatura</label><select class="select-pill" data-admin-analysis-field="subject">
            ${subjects.map((value) => `<option value="${escAttr(value)}" ${state.adminAnalysisSubject === value ? "selected" : ""}>${value === "all" ? "Todas las asignaturas" : esc(value)}</option>`).join("")}
          </select></div>
        </div>
      </section>
      <section class="admin-analysis-board">
        ${groups.map((group) => adminAnalysisGroupCard(group, selectedSubjects)).join("") || `<div class="card card-pad empty-state">No hay datos para los filtros seleccionados.</div>`}
      </section>
      ${detail ? adminAnalysisDetailHtml(detail) : `<section class="card card-pad admin-analysis-hint"><strong>Toca una asignatura</strong><span> para abrir promedios de componentes, competencias y listado de estudiantes.</span></section>`}
    `;
  }

  function adminAnalysisGroups(students, mode) {
    const map = new Map();
    students.forEach((student) => {
      const key = mode === "course" ? `${student.sede || "Sin sede"}||${student.grade}||${student.group || "Sin curso"}` : `${student.sede || "Sin sede"}||${student.grade}`;
      if (!map.has(key)) {
        map.set(key, {
          key,
          mode,
          sede: student.sede || "Sin sede",
          grade: student.grade,
          group: mode === "course" ? (student.group || "Sin curso") : "",
          label: mode === "course" ? `${student.grade}° · ${student.group || "Sin curso"}` : `${student.grade}°`,
          students: []
        });
      }
      map.get(key).students.push(student);
    });
    return [...map.values()].sort((a, b) => Number(a.grade) - Number(b.grade) || String(a.group).localeCompare(String(b.group), "es", { numeric: true, sensitivity: "base" }));
  }

  function adminAnalysisGroupCard(group, subjects) {
    const cells = subjects.map((subject) => {
      const scores = group.students.map((student) => student.subjectStats[subject]?.score).filter((value) => Number.isFinite(value));
      const value = Number(avg(scores));
      const display = Number.isFinite(value) ? value : "—";
      const percent = Number.isFinite(value) ? clamp(value, 0, 100) : 0;
      const count = scores.length;
      return `
        <button class="admin-analysis-subject ${count ? "has-data" : "no-data"}" data-action="admin-analysis-cell" data-mode="${escAttr(group.mode)}" data-sede="${escAttr(group.sede)}" data-grade="${escAttr(group.grade)}" data-group="${escAttr(group.group)}" data-subject="${escAttr(subject)}">
          <span class="admin-analysis-subject-head">${subjectIcon(subject)} <strong>${esc(subject)}</strong></span>
          <span class="admin-analysis-score">${display}<small>/100</small></span>
          <span class="admin-analysis-mini-bar"><i style="width:${percent}%"></i></span>
          <small>${count} estudiante${count === 1 ? "" : "s"}</small>
        </button>
      `;
    }).join("");
    const allScores = group.students.flatMap((student) => Object.values(student.subjectStats || {}).map((stat) => stat?.score).filter((value) => Number.isFinite(value)));
    return `
      <article class="card card-pad admin-analysis-group-card">
        <header>
          <div>
            <span class="section-eyebrow">${group.mode === "course" ? "Curso" : "Grado"}</span>
            <h3>${esc(group.label)}</h3>
            <p>${esc(group.sede)} · ${group.students.length} estudiante${group.students.length === 1 ? "" : "s"}</p>
          </div>
          <strong class="admin-analysis-group-avg">${avg(allScores)}<small>/100</small></strong>
        </header>
        <div class="admin-analysis-subject-grid">${cells}</div>
      </article>
    `;
  }

  function adminAnalysisDetailHtml(detail) {
    const subject = canonicalSubject(detail.subject);
    const students = state.computedStudents
      .filter((student) => detail.sede === "all" || student.sede === detail.sede)
      .filter((student) => String(student.grade) === String(detail.grade))
      .filter((student) => !detail.group || student.group === detail.group)
      .filter((student) => student.subjectStats[subject]?.total)
      .sort((a, b) => a.name.localeCompare(b.name, "es", { sensitivity: "base" }));
    const details = aggregateDetails(students, subject);
    const scores = students.map((student) => student.subjectStats[subject]?.score).filter((value) => Number.isFinite(value));
    const rows = students.map((student, index) => {
      const stat = student.subjectStats[subject];
      return `
        <tr class="table-row-click" data-action="open-detail" data-roll="${escAttr(student.roll)}" data-subject="${escAttr(subject)}">
          <td class="teacher-index">${index + 1}</td>
          <td><strong>${esc(student.name)}</strong><br><span class="student-subid">ID Prueba ${esc(student.roll)} · ${esc(student.sede || "Sin sede")} · ${esc(student.grade)}° ${esc(student.group || "")}</span></td>
          <td><span class="teacher-score teacher-score-plain">${stat.score ?? "—"}</span></td>
          <td><strong>${stat.correct}/${stat.total}</strong></td>
        </tr>
      `;
    }).join("");
    return `
      <section class="card card-pad admin-analysis-detail">
        <div class="toolbar compact-toolbar">
          <div>
            <span class="section-eyebrow">Detalle seleccionado</span>
            <h3>${esc(subject)} · ${esc(detail.grade)}°${detail.group ? ` · ${esc(detail.group)}` : ""}</h3>
            <p class="muted-copy">${esc(detail.sede)} · ${students.length} estudiante${students.length === 1 ? "" : "s"}</p>
          </div>
          <div class="inline-actions">
            <button class="secondary-btn" data-action="open-answer-key" data-grade="${escAttr(detail.grade)}" data-subject="${escAttr(subject)}">Ver respuestas correctas</button>
            <button class="ghost-btn" data-action="admin-analysis-clear-detail">Cerrar detalle</button>
          </div>
        </div>
        <section class="teacher-stat-strip teacher-stat-strip-two admin-results-stats">
          <article class="card card-pad teacher-stat"><span>Estudiantes</span><strong>${students.length}</strong></article>
          <article class="card card-pad teacher-stat"><span>Promedio</span><strong>${avg(scores)}<small>/100</small></strong></article>
        </section>
        <section class="teacher-metrics-row admin-results-metrics">
          ${teacherAggregateMetricsHtmlForDetails(details)}
        </section>
        <div class="table-wrap">
          <table class="teacher-table">
            <thead><tr><th>#</th><th>Estudiante</th><th>Nota</th><th>Correctas</th></tr></thead>
            <tbody>${rows || `<tr><td colspan="4" class="empty-state">No hay estudiantes con esta selección.</td></tr>`}</tbody>
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
            <input type="color" value="${escAttr(cfg.primaryColor || "#1975ae")}" data-config-field="primaryColor">
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
            <label>Icono de app / pestaña</label>
            <div class="app-icon-preview"><img src="${escAttr(cfg.appIcon || "icons/icon-512.png")}" alt="Icono actual" onerror="this.style.display='none'"></div>
            <input type="file" accept="image/*" data-action="upload-app-icon">
            <small style="color:#7d8089;">Se usará como favicon de Chrome y como icono instalable de la PWA.</small>
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
              <p>config/site-config.json, config/data-manifest.json, ESTUDIANTES/ESTUDIANTES.json, INTERNO/CARGA.json, INTERNO/DIRECTORESGRUPO.json, las claves KEYS/KEYS_#.json y las imágenes nuevas en ICONOS o assets.</p>
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
    const teachers = buildCargaTeachers();
    if (!state.adminCargaTeacherId || !teachers.some((t) => t.id === state.adminCargaTeacherId)) {
      state.adminCargaTeacherId = teachers[0]?.id || "";
    }
    const active = teachers.find((t) => t.id === state.adminCargaTeacherId) || teachers[0] || null;
    return `
      <section class="toolbar">
        <div>
          <span class="section-eyebrow">Carga docente</span>
          <h2 style="margin:8px 0 0;font-weight:900;">Docentes y asignaciones</h2>
          <p class="muted-copy">Selecciona un docente, edita sus datos y administra sus asignaturas por sede, grado y curso.</p>
        </div>
        <div class="inline-actions">
          <button class="primary-btn" data-action="add-carga-teacher">Agregar docente</button>
          <button class="secondary-btn" data-action="save-carga">Guardar cargas</button>
          <button class="ghost-btn" data-action="export-carga">Exportar JSON</button>
          <button class="secondary-btn" data-action="publish-github">Publicar en GitHub</button>
        </div>
      </section>
      <div class="admin-note">La carga se organiza por docente. Cada tarjeta de asignatura puede modificarse o eliminarse. Para que todos vean los cambios, publícalos en GitHub.</div>
      <section class="carga-manager">
        <aside class="card carga-teacher-list">
          <h3>Docentes</h3>
          ${teachers.map((teacher) => `
            <button class="carga-teacher-card ${active?.id === teacher.id ? "active" : ""}" data-action="select-carga-teacher" data-id="${escAttr(teacher.id)}">
              <strong>${esc(teacher.name || "Docente sin nombre")}</strong>
              <span>ID ${esc(teacher.id || "sin ID")} · ${teacher.assignments.length} carga${teacher.assignments.length === 1 ? "" : "s"}</span>
            </button>
          `).join("") || `<div class="empty-state">No hay docentes registrados.</div>`}
        </aside>
        <div class="card card-pad carga-detail">
          ${active ? cargaTeacherDetailHtml(active) : `<div class="empty-state">Agrega o selecciona un docente para editar su carga.</div>`}
        </div>
      </section>
    `;
  }



  function normalizeStudentRow(row) {
    return {
      examId: cleanId(row.examId || row.ID_PRUEBA || row.IdPrueba || row.ID || row.id),
      nationalId: cleanId(row.nationalId || row.ID_ALUMNO || row.IdAlumno || row.Documento || row.documento),
      name: cleanText(row.name || row.NOMBRE_COMPLETO || row.NOMBRE || row.Nombre || row.NOMBRES || row.APellidos),
      sede: cleanText(row.sede || row.SEDE || row.Sede),
      grade: toInt(row.grade || row.GRADO || row.Grado),
      group: cleanText(row.group || row.GRUPO || row.Grupo || row.CURSO || row.Curso)
    };
  }

  function normalizeDirectorRow(row) {
    return {
      id: cleanId(row.id || row.ID || row.Id || row.Identificacion || row["Identificación"] || row.identificacion),
      sede: cleanText(row.sede || row.SEDE || row.Sede),
      grade: toInt(row.grade || row.GRADO || row.Grado),
      group: cleanText(row.group || row.GRUPO || row.Grupo || row.CURSO || row.Curso)
    };
  }

  function aggregateDetails(students, subject = "all") {
    return students.flatMap((student) => {
      if (subject !== "all") return student.subjectStats[subject]?.details || [];
      return SUBJECTS.flatMap((s) => student.subjectStats[s.name]?.details || []);
    });
  }

  function percentFromDetails(details, field) {
    const usable = details.filter((d) => cleanText(d[field]));
    if (!usable.length) return 0;
    const correct = usable.filter((d) => d.status === "correct").length;
    return Math.round((correct / usable.length) * 100);
  }

  function scopeLabel(scope) {
    return {
      sede: "Sede",
      grado: "Grado",
      curso: "Curso",
      area: "Área/asignatura",
      estudiante: "Estudiante"
    }[scope] || "Grupo";
  }

  function buildAdminResultRows(students, scope, subject) {
    const map = new Map();
    const add = (key, label, sub, listSubject, student) => {
      if (!map.has(key)) map.set(key, { label, sub, students: [], subject: listSubject });
      map.get(key).students.push(student);
    };

    students.forEach((student) => {
      if (scope === "estudiante") {
        add(student.roll, student.name, `ID ${student.roll} · ${student.grade}° ${student.group || ""}`, subject, student);
        return;
      }
      if (scope === "grado") {
        add(String(student.grade), `${student.grade}°`, student.sede || "", subject, student);
        return;
      }
      if (scope === "curso") {
        add(`${student.sede}|${student.grade}|${student.group}`, `${student.grade}° · ${student.group || "Sin curso"}`, student.sede || "", subject, student);
        return;
      }
      if (scope === "area") {
        const subjects = subject === "all" ? SUBJECTS.map((s) => s.name) : [subject];
        subjects.forEach((subj) => {
          if (student.subjectStats[subj]?.total) add(subj, subj, "Promedio del área", subj, student);
        });
        return;
      }
      add(student.sede || "Sin sede", student.sede || "Sin sede", "", subject, student);
    });

    return [...map.values()].map((group) => {
      const scores = group.students.flatMap((student) => {
        if (group.subject && group.subject !== "all") return [student.subjectStats[group.subject]?.score].filter((v) => Number.isFinite(v));
        return SUBJECTS.map((s) => student.subjectStats[s.name]?.score).filter((v) => Number.isFinite(v));
      });
      const details = aggregateDetails(group.students, group.subject || subject);
      return {
        label: group.label,
        sub: group.sub,
        count: new Set(group.students.map((s) => s.roll)).size,
        avg: avg(scores),
        componentAvg: percentFromDetails(details, "component"),
        competenceAvg: percentFromDetails(details, "competence")
      };
    }).sort((a, b) => String(a.label).localeCompare(String(b.label), "es", { numeric: true, sensitivity: "base" }));
  }

  function buildCargaTeachers() {
    const map = new Map();
    state.cargaRows.forEach((row, index) => {
      const id = row.id || `sin-id-${index}`;
      if (!map.has(id)) map.set(id, { id, name: row.name || "", assignments: [] });
      const teacher = map.get(id);
      if (!teacher.name && row.name) teacher.name = row.name;
      teacher.assignments.push({ ...row, index });
    });
    return [...map.values()].sort((a, b) => String(a.name || a.id).localeCompare(String(b.name || b.id), "es", { sensitivity: "base" }));
  }

  function cargaTeacherDetailHtml(teacher) {
    const firstIndex = teacher.assignments[0]?.index;
    const baseRow = firstIndex !== undefined ? state.cargaRows[firstIndex] : { id: teacher.id, name: teacher.name };
    return `
      <div class="carga-teacher-head">
        <div class="form-grid compact">
          <div class="field"><label>ID docente</label><input value="${escAttr(baseRow.id || "")}" data-carga-teacher-field="id" data-old-id="${escAttr(teacher.id)}"></div>
          <div class="field"><label>Nombre docente</label><input value="${escAttr(baseRow.name || teacher.name || "")}" data-carga-teacher-field="name" data-old-id="${escAttr(teacher.id)}"></div>
        </div>
        <div class="inline-actions">
          <button class="primary-btn" data-action="add-carga-to-teacher" data-id="${escAttr(teacher.id)}">Agregar carga</button>
          <button class="danger-btn" data-action="delete-carga-teacher" data-id="${escAttr(teacher.id)}">Eliminar docente</button>
        </div>
      </div>
      <div class="carga-assignment-grid">
        ${teacher.assignments.map((row) => cargaAssignmentCard(row)).join("") || `<div class="empty-state">Este docente no tiene cargas todavía.</div>`}
      </div>
    `;
  }

  function cargaAssignmentCard(row) {
    const subjectName = canonicalSubject(row.subjectRaw || row.subject);
    const colorIndex = SUBJECTS.findIndex((s) => s.name === subjectName);
    const colors = ["#1975ae", "#8b5cf6", "#16a34a", "#eab308", "#dc2626", "#f97316", "#ec4899", "#0891b2", "#4f46e5", "#64748b"];
    const color = colors[colorIndex >= 0 ? colorIndex : 0];
    return `
      <article class="carga-assignment-card" style="--subject-color:${escAttr(color)};">
        <div class="carga-card-title">
          ${subjectIcon(subjectName || "Matemáticas")}
          <div><strong>${esc(row.subjectRaw || row.subject || "Carga sin asignatura")}</strong><span>${row.grade ? `${esc(row.grade)}°` : "Sin grado"} ${esc(row.group || "")} · ${esc(row.sede || "Sin sede")}</span></div>
        </div>
        <div class="form-grid compact">
          <div class="field"><label>Asignatura</label><select class="select-pill" data-carga-row="${row.index}" data-field="subjectRaw">${cargaSelectOptions("subject", row.subjectRaw || row.subject)}</select></div>
          <div class="field"><label>Sede</label><select class="select-pill" data-carga-row="${row.index}" data-field="sede">${cargaSelectOptions("sede", row.sede)}</select></div>
          <div class="field"><label>Grado</label><select class="select-pill" data-carga-row="${row.index}" data-field="grade">${cargaSelectOptions("grade", row.grade)}</select></div>
          <div class="field"><label>Curso</label><select class="select-pill" data-carga-row="${row.index}" data-field="group">${cargaSelectOptions("group", row.group)}</select></div>
        </div>
        <button class="danger-btn" data-action="delete-carga" data-index="${row.index}">Quitar carga</button>
      </article>
    `;
  }

  function cargaSelectOptions(kind, currentValue = "") {
    const current = cleanText(currentValue);
    let values = [];
    if (kind === "subject") values = availableSubjects();
    if (kind === "sede") values = uniqueValues(state.studentsRegistry.map((student) => student.sede).concat(state.computedStudents.map((student) => student.sede)));
    if (kind === "grade") values = uniqueValues(state.studentsRegistry.map((student) => student.grade).concat(state.computedStudents.map((student) => student.grade)).filter(Boolean)).sort((a, b) => Number(a) - Number(b));
    if (kind === "group") values = uniqueValues(state.studentsRegistry.map((student) => student.group).concat(state.computedStudents.map((student) => student.group)));
    if (current && !values.some((value) => String(value) === String(current))) values.unshift(current);
    const placeholder = kind === "subject" ? "Selecciona asignatura" : kind === "sede" ? "Selecciona sede" : kind === "grade" ? "Selecciona grado" : "Selecciona curso";
    return [`<option value="">${placeholder}</option>`, ...values.map((value) => `<option value="${escAttr(value)}" ${String(value) === String(current) ? "selected" : ""}>${kind === "grade" && value ? `${esc(value)}°` : esc(value)}</option>`)].join("");
  }

  function updateCargaRowField(target) {
    if (!target.dataset.cargaRow) return false;
    const index = Number(target.dataset.cargaRow);
    const field = target.dataset.field;
    if (!state.cargaRows[index]) return true;
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
    return true;
  }

  function adminDirectoresHtml() {
    const teachers = buildDirectorTeachers();
    if (!state.adminDirectorTeacherId || !teachers.some((teacher) => teacher.id === state.adminDirectorTeacherId)) {
      state.adminDirectorTeacherId = teachers[0]?.id || "";
    }
    const active = teachers.find((teacher) => teacher.id === state.adminDirectorTeacherId) || teachers[0] || null;
    return `
      <section class="toolbar">
        <div>
          <span class="section-eyebrow">Directores de grupo</span>
          <h2 style="margin:8px 0 0;font-weight:900;">Asignación de salones</h2>
          <p class="muted-copy">Asigna a docentes ya existentes una dirección de grupo. Las sedes, grados y cursos salen de ESTUDIANTES.json.</p>
        </div>
        <div class="inline-actions">
          <button class="primary-btn" data-action="add-director-assignment">Agregar dirección de grupo</button>
          <button class="secondary-btn" data-action="save-directores">Guardar directores</button>
          <button class="ghost-btn" data-action="export-directores">Exportar JSON</button>
          <button class="secondary-btn" data-action="publish-github">Publicar en GitHub</button>
        </div>
      </section>
      <div class="admin-note">No se crean docentes nuevos en esta vista. Para asignar una dirección de grupo, primero el docente debe existir en la carga docente o en el archivo de directores actual.</div>
      <section class="carga-manager director-manager">
        <aside class="card carga-teacher-list">
          <h3>Docentes</h3>
          ${teachers.map((teacher) => `
            <button class="carga-teacher-card ${active?.id === teacher.id ? "active" : ""}" data-action="select-director-teacher" data-id="${escAttr(teacher.id)}">
              <strong>${esc(teacher.name || `Docente ${teacher.id}`)}</strong>
              <span>ID ${esc(teacher.id || "sin ID")} · ${teacher.directorGroups.length} dirección${teacher.directorGroups.length === 1 ? "" : "es"}</span>
            </button>
          `).join("") || `<div class="empty-state">No hay docentes disponibles para asignar dirección.</div>`}
        </aside>
        <div class="card card-pad carga-detail">
          ${active ? directorTeacherDetailHtml(active) : `<div class="empty-state">Agrega una dirección de grupo a un docente existente.</div>`}
        </div>
      </section>
    `;
  }

  function buildDirectorTeachers() {
    const map = new Map();
    (state.teachers || new Map()).forEach((teacher, id) => {
      map.set(id, { id, name: teacher.name || teacherNameById(id), directorGroups: [] });
    });
    (state.directorRows || []).forEach((row, index) => {
      const id = row.id;
      if (!id) return;
      if (!map.has(id)) map.set(id, { id, name: teacherNameById(id), directorGroups: [] });
      map.get(id).directorGroups.push({ ...row, index, key: directorKeyFor(row) });
    });
    return Array.from(map.values())
      .sort((a, b) => (a.name || a.id).localeCompare((b.name || b.id), "es", { sensitivity: "base" }));
  }

  function directorTeacherDetailHtml(teacher) {
    return `
      <div class="carga-teacher-head">
        <div>
          <span class="section-eyebrow">Docente</span>
          <h3 style="margin:6px 0 0;font-size:1.4rem;">${esc(teacher.name || `Docente ${teacher.id}`)}</h3>
          <p class="muted-copy">ID ${esc(teacher.id)} · ${teacher.directorGroups.length} dirección${teacher.directorGroups.length === 1 ? "" : "es"} de grupo</p>
        </div>
        <div class="inline-actions">
          <button class="primary-btn" data-action="add-director-assignment" data-id="${escAttr(teacher.id)}">Agregar dirección</button>
        </div>
      </div>
      <div class="carga-assignment-grid director-assignment-grid">
        ${teacher.directorGroups.map((row) => directorAssignmentCard(row)).join("") || `<div class="empty-state">Este docente todavía no tiene dirección de grupo.</div>`}
      </div>
    `;
  }

  function directorAssignmentCard(row) {
    return `
      <article class="carga-assignment-card director-assignment-card" style="--subject-color:var(--primary);">
        <div class="carga-card-title">
          <span class="director-card-icon">DG</span>
          <div><strong>Dirección de grupo</strong><span>${row.grade ? `${esc(row.grade)}°` : "Sin grado"} ${esc(row.group || "")} · ${esc(row.sede || "Sin sede")}</span></div>
        </div>
        <div class="form-grid compact">
          <div class="field"><label>Sede</label><select class="select-pill" data-director-row="${row.index}" data-field="sede">${cargaSelectOptions("sede", row.sede)}</select></div>
          <div class="field"><label>Grado</label><select class="select-pill" data-director-row="${row.index}" data-field="grade">${cargaSelectOptions("grade", row.grade)}</select></div>
          <div class="field"><label>Curso</label><select class="select-pill" data-director-row="${row.index}" data-field="group">${cargaSelectOptions("group", row.group)}</select></div>
        </div>
        <button class="danger-btn" data-action="delete-director" data-index="${row.index}">Quitar dirección</button>
      </article>
    `;
  }

  function directorTeacherOptions(currentId = "") {
    const current = cleanId(currentId);
    const teachers = buildDirectorTeachers().filter((teacher) => teacher.id);
    return [`<option value="">Selecciona docente</option>`, ...teachers.map((teacher) => `<option value="${escAttr(teacher.id)}" ${teacher.id === current ? "selected" : ""}>${esc(teacher.name || `Docente ${teacher.id}`)} · ID ${esc(teacher.id)}</option>`)].join("");
  }

  function updateDirectorRowField(target) {
    if (!target.dataset.directorRow) return false;
    const index = Number(target.dataset.directorRow);
    const field = target.dataset.field;
    if (!state.directorRows[index]) return true;
    if (field === "grade") state.directorRows[index].grade = toInt(target.value);
    if (field === "sede") state.directorRows[index].sede = target.value;
    if (field === "group") state.directorRows[index].group = target.value;
    state.directorRows[index] = normalizeDirectorRow(state.directorRows[index]);
    return true;
  }

  function normalizeDirectorRows() {
    state.directorRows = (state.directorRows || [])
      .map(normalizeDirectorRow)
      .filter((row) => row.id && row.sede && row.grade && row.group);
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
        state.teacherMode = "asignaturas";
        state.teacherDirectorActiveKey = "";
        const teacher = state.teachers.get(user);
        if (!(teacher?.assignments || []).length && (teacher?.directorGroups || []).length) state.teacherMode = "director";
        enterSessionWithLoader({ role: "teacher", id: user }, () => renderTeacher(teacher), "Preparando vista docente...");
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

    if (action === "teacher-subject") {
      const teacher = state.teachers.get(state.activeSession?.id);
      const subject = canonicalSubject(target.dataset.subject);
      const assignments = (teacher?.assignments || []).filter((assignment) => assignment.subject === subject);
      state.teacherActive = assignments.find((assignment) => state.computedStudents.some((student) => teacherAssignmentMatches(student, assignment))) || assignments[0] || null;
      renderBySession();
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
      return;
    }

    if (action === "teacher-mode") {
      state.teacherMode = target.dataset.mode === "director" ? "director" : "asignaturas";
      renderBySession();
      return;
    }

    if (action === "teacher-director-group") {
      state.teacherDirectorActiveKey = target.dataset.key || "";
      renderBySession();
      return;
    }

    if (action === "director-subject-detail") {
      openDirectorSubjectDetail(target.dataset.key || "", canonicalSubject(target.dataset.subject));
      return;
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

    if (action === "teacher-score-info") {
      openTeacherScoreInfo(toInt(target.dataset.grade), target.dataset.subject, toInt(target.dataset.total));
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

    if (action === "admin-analysis-cell") {
      state.adminAnalysisDetail = {
        mode: target.dataset.mode || "grade",
        sede: target.dataset.sede || "all",
        grade: toInt(target.dataset.grade),
        group: cleanText(target.dataset.group || ""),
        subject: canonicalSubject(target.dataset.subject)
      };
      renderAdmin();
      return;
    }

    if (action === "admin-analysis-clear-detail") {
      state.adminAnalysisDetail = null;
      renderAdmin();
      return;
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

    if (action === "add-student") {
      state.studentsRegistry.unshift({ examId: "", nationalId: "", name: "", sede: "", grade: 10, group: "" });
      renderAdmin();
      return;
    }

    if (action === "delete-student") {
      const index = Number(target.dataset.index);
      state.studentsRegistry.splice(index, 1);
      buildRepository();
      renderAdmin();
      return;
    }

    if (action === "save-students") {
      state.studentsRegistry = state.studentsRegistry.map(normalizeStudentRow).filter((s) => s.examId || s.nationalId || s.name);
      writeJSON(STORAGE.students, { rows: state.studentsRegistry });
      buildRepository();
      toast("Estudiantes guardados localmente.");
      renderAdmin();
      return;
    }

    if (action === "export-students") {
      exportStudents();
      return;
    }

    if (action === "select-carga-teacher") {
      state.adminCargaTeacherId = target.dataset.id || "";
      renderAdmin();
      return;
    }

    if (action === "add-carga-teacher") {
      openAddCargaTeacherModal();
      return;
    }

    if (action === "confirm-add-carga-teacher") {
      const id = cleanId(document.getElementById("newTeacherId")?.value || "");
      const name = cleanText(document.getElementById("newTeacherName")?.value || "");
      if (!id || !name) {
        toast("Escribe ID y nombre del docente.");
        return;
      }
      state.cargaRows.unshift({ id, name, subjectRaw: "", subject: "", sede: "", grade: "", group: "" });
      state.adminCargaTeacherId = id;
      closeModal();
      renderAdmin();
      return;
    }

    if (action === "delete-carga-teacher") {
      const id = target.dataset.id || "";
      state.cargaRows = state.cargaRows.filter((row) => row.id !== id);
      state.adminCargaTeacherId = "";
      renderAdmin();
      return;
    }

    if (action === "add-carga-to-teacher") {
      openAddCargaAssignmentModal(target.dataset.id || state.adminCargaTeacherId || "");
      return;
    }

    if (action === "confirm-add-carga-assignment") {
      const id = target.dataset.id || state.adminCargaTeacherId || "";
      const existing = state.cargaRows.find((row) => row.id === id) || { id, name: "" };
      const subjectRaw = document.getElementById("newCargaSubject")?.value || "";
      const sede = document.getElementById("newCargaSede")?.value || "";
      const grade = toInt(document.getElementById("newCargaGrade")?.value || "");
      const group = document.getElementById("newCargaGroup")?.value || "";
      if (!id || !subjectRaw || !sede || !grade || !group) {
        toast("Selecciona asignatura, sede, grado y curso.");
        return;
      }
      state.cargaRows = state.cargaRows.filter((row) => !(row.id === id && !row.subjectRaw && !row.subject));
      state.cargaRows.push({ id: existing.id, name: existing.name, subjectRaw, subject: canonicalSubject(subjectRaw), sede, grade, group });
      state.adminCargaTeacherId = existing.id;
      closeModal();
      renderAdmin();
      return;
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
      writeJSON(STORAGE.directores, { rows: state.directorRows });
      buildRepository();
      toast("Carga guardada localmente.");
      renderAdmin();
    }

    if (action === "export-carga") {
      exportCarga();
    }

    if (action === "select-director-teacher") {
      state.adminDirectorTeacherId = target.dataset.id || "";
      renderAdmin();
      return;
    }

    if (action === "add-director-assignment") {
      openAddDirectorAssignmentModal(target.dataset.id || state.adminDirectorTeacherId || "");
      return;
    }

    if (action === "confirm-add-director-assignment") {
      const id = cleanId(document.getElementById("newDirectorTeacher")?.value || "");
      const sede = document.getElementById("newDirectorSede")?.value || "";
      const grade = toInt(document.getElementById("newDirectorGrade")?.value || "");
      const group = document.getElementById("newDirectorGroup")?.value || "";
      if (!id || !sede || !grade || !group) {
        toast("Selecciona docente, sede, grado y curso.");
        return;
      }
      const row = { id, sede, grade, group };
      const key = directorKeyFor(row);
      const duplicated = state.directorRows.some((item) => item.id === id && directorKeyFor(item) === key);
      if (duplicated) {
        toast("Ese docente ya tiene asignado ese grupo.");
        return;
      }
      state.directorRows.push(row);
      state.adminDirectorTeacherId = id;
      buildRepository();
      closeModal();
      renderAdmin();
      return;
    }

    if (action === "delete-director") {
      const index = Number(target.dataset.index);
      state.directorRows.splice(index, 1);
      normalizeDirectorRows();
      buildRepository();
      renderAdmin();
      return;
    }

    if (action === "save-directores") {
      normalizeDirectorRows();
      writeJSON(STORAGE.directores, { rows: state.directorRows });
      buildRepository();
      toast("Directores de grupo guardados localmente.");
      renderAdmin();
      return;
    }

    if (action === "export-directores") {
      exportDirectores();
      return;
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

    if (target.id === "loginUser") {
      const passField = document.getElementById("loginPasswordField");
      const passInput = document.getElementById("loginPass");
      const isAdmin = normalizeText(target.value) === "admin";
      passField?.classList.toggle("is-hidden", !isAdmin);
      if (!isAdmin && passInput) passInput.value = "";
    }

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

    if (target.dataset.studentRow) {
      const index = Number(target.dataset.studentRow);
      const field = target.dataset.field;
      if (!state.studentsRegistry[index]) return;
      if (field === "grade") state.studentsRegistry[index].grade = toInt(target.value);
      else if (field === "examId") state.studentsRegistry[index].examId = cleanId(target.value);
      else if (field === "nationalId") state.studentsRegistry[index].nationalId = cleanId(target.value);
      else if (field === "name") state.studentsRegistry[index].name = target.value;
      else if (field === "sede") state.studentsRegistry[index].sede = target.value;
      else if (field === "group") state.studentsRegistry[index].group = target.value;
    }

    if (target.dataset.cargaTeacherField) {
      const oldId = target.dataset.oldId || state.adminCargaTeacherId;
      const currentId = state.adminCargaTeacherId;
      const field = target.dataset.cargaTeacherField;
      const value = field === "id" ? cleanId(target.value) : target.value;
      state.cargaRows.forEach((row) => {
        if (row.id === oldId || row.id === currentId) {
          if (field === "id") row.id = value;
          if (field === "name") row.name = value;
        }
      });
      if (field === "id") {
        state.adminCargaTeacherId = value;
        target.dataset.oldId = value;
      }
    }

    if (target.dataset.githubField) {
      const settings = getGithubSettings();
      settings[target.dataset.githubField] = target.value.trim();
      saveGithubSettings(settings);
    }

    if (target.dataset.cargaRow) {
      updateCargaRowField(target);
    }
  }

  function handleChange(event) {
    const target = event.target;

    if (target.dataset.cargaRow) {
      updateCargaRowField(target);
      renderAdmin();
      return;
    }

    if (target.dataset.directorRow) {
      updateDirectorRowField(target);
      buildRepository();
      renderAdmin();
      return;
    }

    if (target.dataset.adminResultsField) {
      const field = target.dataset.adminResultsField;
      const map = { sede: "adminResultSede", grade: "adminResultGrade", group: "adminResultGroup", subject: "adminResultSubject" };
      if (map[field]) state[map[field]] = target.value;
      if (field === "sede") { state.adminResultGrade = "all"; state.adminResultGroup = "all"; state.adminResultSubject = "all"; }
      if (field === "grade") { state.adminResultGroup = "all"; state.adminResultSubject = "all"; }
      if (field === "group") { state.adminResultSubject = "all"; }
      state.adminResultStudent = "all";
      renderAdmin();
      return;
    }

    if (target.dataset.adminAnalysisField) {
      const field = target.dataset.adminAnalysisField;
      const map = { sede: "adminAnalysisSede", grade: "adminAnalysisGrade", mode: "adminAnalysisMode", subject: "adminAnalysisSubject" };
      if (map[field]) state[map[field]] = target.value;
      if (field === "sede") state.adminAnalysisGrade = "all";
      state.adminAnalysisDetail = null;
      renderAdmin();
      return;
    }

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

    if (target.dataset.action === "upload-app-icon") {
      readImageFile(target.files?.[0], (dataUrl) => {
        state.config.appIcon = dataUrl;
        writeJSON(STORAGE.config, state.config);
        applyAppMeta();
        toast("Icono de app actualizado.");
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

  function exportDirectores() {
    normalizeDirectorRows();
    downloadFile("DIRECTORESGRUPO.json", JSON.stringify(exportDirectoresRows(), null, 2), "application/json;charset=utf-8");
  }

  function exportStudents() {
    state.studentsRegistry = state.studentsRegistry.map(normalizeStudentRow).filter((s) => s.examId || s.nationalId || s.name);
    downloadFile("ESTUDIANTES.json", JSON.stringify(exportStudentRows(), null, 2), "application/json;charset=utf-8");
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
    normalizeDirectorRows();
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

      if (isDataUrl(repoConfig.appIcon)) {
        const iconPackage = await buildPwaIconFiles(repoConfig.appIcon);
        files.push(...iconPackage.files);
        repoConfig.appIcon = iconPackage.paths.icon512;
        repoConfig.appIcon192 = iconPackage.paths.icon192;
        repoConfig.appIconMaskable = iconPackage.paths.maskable;
        repoConfig.appleTouchIcon = iconPackage.paths.apple;
        repoConfig.favicon32 = iconPackage.paths.favicon32;
        repoConfig.favicon16 = iconPackage.paths.favicon16;
      }

      files.push({ path: "manifest.webmanifest", content: JSON.stringify(buildWebManifest(repoConfig), null, 2) });

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
      files.push({ path: "config/data-manifest.json", content: JSON.stringify(exportManifestForRepo(), null, 2) });
      files.push({ path: state.manifest.estudiantes || "ESTUDIANTES/ESTUDIANTES.json", content: JSON.stringify(exportStudentRows(), null, 2) });
      files.push({ path: state.manifest.carga || "INTERNO/CARGA.json", content: JSON.stringify(exportCargaRows(), null, 2) });
      files.push({ path: state.manifest.directoresGrupo || "INTERNO/DIRECTORESGRUPO.json", content: JSON.stringify(exportDirectoresRows(), null, 2) });

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
      applyAppMeta();
      writeJSON(STORAGE.logos, state.logos);
      writeJSON(STORAGE.students, { rows: state.studentsRegistry });
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

  function exportManifestForRepo() {
    return {
      config: state.manifest.config || "config/site-config.json",
      estudiantes: state.manifest.estudiantes || "ESTUDIANTES/ESTUDIANTES.json",
      carga: state.manifest.carga || "INTERNO/CARGA.json",
      directoresGrupo: state.manifest.directoresGrupo || "INTERNO/DIRECTORESGRUPO.json",
      grades: (state.manifest.grades || DEFAULT_GRADES).map(Number).filter(Boolean),
      keyTemplate: state.manifest.keyTemplate || "KEYS/KEYS_{grade}.json",
      resultTemplate: state.manifest.resultTemplate || "RESULTADOS/{grade}S{session}.json",
      sessions: state.manifest.sessions || DEFAULT_MANIFEST.sessions,
      optionalGradeFiles: true,
      keys: [],
      resultados: []
    };
  }

  function exportStudentRows() {
    return state.studentsRegistry.map((row) => ({
      ID_PRUEBA: row.examId || "",
      ID_ALUMNO: row.nationalId || "",
      NOMBRE_COMPLETO: row.name || "",
      SEDE: row.sede || "",
      GRADO: String(row.grade || ""),
      GRUPO: row.group || ""
    }));
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

  function exportDirectoresRows() {
    return (state.directorRows || []).map((row) => ({
      "Identificación": row.id || "",
      "Sede": row.sede || "",
      "Grado": String(row.grade || ""),
      "Grupo": row.group || ""
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
    const multiplicationLines = calc.areas.map((area) => `
      <li>
        <span>${esc(area.label)}</span>
        <strong>${area.score ?? "—"} × ${area.weight} = ${Number.isFinite(area.weighted) ? area.weighted : "—"}</strong>
      </li>
    `).join("");
    const weightedList = calc.canCalculate
      ? `${calc.math * 3} + ${calc.language * 3} + ${calc.natural * 3} + ${calc.social * 3} + ${calc.english * 1} = ${calc.weightedSum}`
      : "No disponible";
    const timesFive = calc.canCalculate ? calc.weightedSum * 5 : null;
    const rawScore = calc.canCalculate ? ((calc.weightedSum * 5) / 13) : null;
    const rawScoreText = Number.isFinite(rawScore) ? rawScore.toFixed(1).replace(".0", "") : "—";

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
            <section class="global-score-hero clean">
              <div>
                <span>Resultado estimado</span>
                <strong>${calc.score ?? "—"}<small>/500</small></strong>
              </div>
              <p>Este valor simula el puntaje global de una Prueba Saber. Solo se usan Matemáticas, Lenguaje, Ciencias Naturales, Ciencias Sociales e Inglés.</p>
            </section>

            <div class="formula-box formula-box-strong clean">
              <div class="formula-step">
                <span>1</span>
                <div>
                  <p>Primero se multiplica cada nota por su peso.</p>
                  <ul class="global-step-list">${multiplicationLines}</ul>
                </div>
              </div>
              <div class="formula-step">
                <span>2</span>
                <p>Después se suman todos los aportes ponderados: <strong>${esc(weightedList)}</strong>.</p>
              </div>
              <div class="formula-step">
                <span>3</span>
                <p>Luego esa suma se multiplica por <strong>5</strong>: <strong>${calc.canCalculate ? `${calc.weightedSum} × 5 = ${timesFive}` : "—"}</strong>.</p>
              </div>
              <div class="formula-step">
                <span>4</span>
                <p>Finalmente se divide entre <strong>13</strong>: <strong>${calc.canCalculate ? `${timesFive} ÷ 13 = ${rawScoreText}` : "—"}</strong>. Redondeado, el puntaje global es <strong>${calc.score ?? "—"}/500</strong>.</p>
              </div>
              <div class="formula-line colorful">${calc.canCalculate ? `${calc.weightedSum} × 5 ÷ 13 = ${calc.score}` : "Falta al menos una de las cinco áreas que componen el cálculo."}</div>
              <p class="excluded-note">Ética, Artística, Educación Física, Informática y Religión no cuentan dentro de este cálculo tipo Saber.</p>
            </div>

          </div>
        </section>
      </div>
    `;
  }

  function openTeacherScoreInfo(grade, subject, totalFromButton = 0) {
    const info = subjectItemValue(grade, subject, { total: totalFromButton });
    const total = info.total || totalFromButton || 0;
    const itemValue = info.label;
    const exampleCorrect = total ? Math.min(Math.max(Math.round(total * 0.6), 1), total) : 0;
    const exampleScore = total ? Math.round(20 + exampleCorrect * (80 / total)) : "—";
    modalRoot.innerHTML = `
      <div class="modal-backdrop" data-action="close-modal">
        <section class="modal" style="max-width:620px;">
          <div class="modal-head">
            <div>
              <h2>Cómo se calcula la nota</h2>
              <span style="color:#7d8089;font-weight:600;">${esc(subject)} · ${grade ? `${esc(grade)}°` : "grado activo"}</span>
            </div>
            <button type="button" class="icon-btn" data-action="close-modal" aria-label="Cerrar">×</button>
          </div>
          <div class="modal-body">
            <section class="score-explain-card">
              <div class="score-explain-hero">
                <span>Valor por ítem</span>
                <strong>${esc(itemValue)}<small> puntos</small></strong>
              </div>
              <p>La escala de la prueba va de <strong>20</strong> a <strong>100</strong>. Por eso, los ítems no reparten 100 puntos completos, sino los <strong>80 puntos</strong> que hay entre la nota mínima y la nota máxima.</p>
              <div class="formula-line colorful">Valor de cada ítem = (100 − 20) ÷ ${esc(total || "total de ítems")} = ${esc(itemValue)}</div>
              <div class="formula-line">Nota = 20 + (correctas × ${esc(itemValue)})</div>
              ${total ? `<p>Ejemplo: si un estudiante responde bien <strong>${exampleCorrect}</strong> de <strong>${total}</strong> ítems, su nota sería <strong>20 + (${exampleCorrect} × ${esc(itemValue)}) = ${exampleScore}</strong>.</p>` : `<p>Cuando haya ítems registrados para esta asignatura, aquí se mostrará el valor exacto por pregunta.</p>`}
              <p class="excluded-note">Las dobles marcas y las respuestas sin marcar no suman como correctas.</p>
            </section>
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
            <section class="card detail-card">${buildSubjectDetailHtml(student, realSubject, stat, true, true)}</section>
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

  function openAddCargaTeacherModal() {
    modalRoot.innerHTML = `
      <div class="modal-backdrop" data-action="close-modal">
        <section class="modal" style="max-width:560px;">
          <div class="modal-head">
            <div>
              <h2>Agregar docente</h2>
              <span style="color:#7d8089;font-weight:600;">Registra el ID y el nombre. Luego podrás asignarle cargas.</span>
            </div>
            <button type="button" class="icon-btn" data-action="close-modal" aria-label="Cerrar">×</button>
          </div>
          <div class="modal-body">
            <div class="form-grid compact">
              <div class="field"><label>ID docente</label><input id="newTeacherId" placeholder="Ej. 12345678"></div>
              <div class="field"><label>Nombre docente</label><input id="newTeacherName" placeholder="Nombre completo"></div>
            </div>
            <div class="inline-actions" style="margin-top:16px;">
              <button class="primary-btn" data-action="confirm-add-carga-teacher">Agregar docente</button>
              <button class="ghost-btn" data-action="close-modal">Cancelar</button>
            </div>
          </div>
        </section>
      </div>
    `;
  }

  function openAddCargaAssignmentModal(teacherId) {
    const teacher = buildCargaTeachers().find((item) => item.id === teacherId);
    modalRoot.innerHTML = `
      <div class="modal-backdrop" data-action="close-modal">
        <section class="modal" style="max-width:660px;">
          <div class="modal-head">
            <div>
              <h2>Agregar carga</h2>
              <span style="color:#7d8089;font-weight:600;">${esc(teacher?.name || "Docente")} · ID ${esc(teacherId || "sin ID")}</span>
            </div>
            <button type="button" class="icon-btn" data-action="close-modal" aria-label="Cerrar">×</button>
          </div>
          <div class="modal-body">
            <div class="form-grid compact">
              <div class="field"><label>Área/asignatura</label><select id="newCargaSubject" class="select-pill">${cargaSelectOptions("subject", "")}</select></div>
              <div class="field"><label>Sede</label><select id="newCargaSede" class="select-pill">${cargaSelectOptions("sede", "")}</select></div>
              <div class="field"><label>Grado</label><select id="newCargaGrade" class="select-pill">${cargaSelectOptions("grade", "")}</select></div>
              <div class="field"><label>Curso</label><select id="newCargaGroup" class="select-pill">${cargaSelectOptions("group", "")}</select></div>
            </div>
            <div class="admin-note" style="margin-top:14px;">Las sedes, grados y cursos salen de <strong>ESTUDIANTES.json</strong>. Las asignaturas salen de las claves cargadas en <strong>KEYS</strong>.</div>
            <div class="inline-actions" style="margin-top:16px;">
              <button class="primary-btn" data-action="confirm-add-carga-assignment" data-id="${escAttr(teacherId)}">Agregar carga</button>
              <button class="ghost-btn" data-action="close-modal">Cancelar</button>
            </div>
          </div>
        </section>
      </div>
    `;
  }

  function openAddDirectorAssignmentModal(teacherId = "") {
    const selectedTeacher = cleanId(teacherId || state.adminDirectorTeacherId || "");
    modalRoot.innerHTML = `
      <div class="modal-backdrop" data-action="close-modal">
        <section class="modal" style="max-width:660px;">
          <div class="modal-head">
            <div>
              <h2>Agregar dirección de grupo</h2>
              <span style="color:#7d8089;font-weight:600;">Selecciona un docente existente y el grupo a cargo.</span>
            </div>
            <button type="button" class="icon-btn" data-action="close-modal" aria-label="Cerrar">×</button>
          </div>
          <div class="modal-body">
            <div class="form-grid compact">
              <div class="field span-2"><label>Docente</label><select id="newDirectorTeacher" class="select-pill">${directorTeacherOptions(selectedTeacher)}</select></div>
              <div class="field"><label>Sede</label><select id="newDirectorSede" class="select-pill">${cargaSelectOptions("sede", "")}</select></div>
              <div class="field"><label>Grado</label><select id="newDirectorGrade" class="select-pill">${cargaSelectOptions("grade", "")}</select></div>
              <div class="field"><label>Curso</label><select id="newDirectorGroup" class="select-pill">${cargaSelectOptions("group", "")}</select></div>
            </div>
            <div class="admin-note" style="margin-top:14px;">Las sedes, grados y cursos salen de <strong>ESTUDIANTES.json</strong>. En esta pantalla no se crean docentes nuevos.</div>
            <div class="inline-actions" style="margin-top:16px;">
              <button class="primary-btn" data-action="confirm-add-director-assignment">Agregar dirección</button>
              <button class="ghost-btn" data-action="close-modal">Cancelar</button>
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

  function answerPill(detail, roll, displayIndex = detail.item, showCorrect = false) {
    return `
      <button class="answer-pill ${detail.status} ${showCorrect ? "with-correct" : ""}" data-action="answer-info" data-roll="${escAttr(roll)}" data-subject="${escAttr(detail.subject)}" data-item="${escAttr(detail.item)}" title="Ver detalle del ítem ${escAttr(displayIndex)}">
        <strong>${esc(displayIndex)}.</strong>
        <span>${esc(displayMarked(detail.marked))}</span>
        ${showCorrect ? `<small>Correcta: ${esc(displayMarked(detail.correct))}</small>` : ""}
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
    const match = cleanText(value).match(/-?\d+/);
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

  function directorKeyFor(row) {
    const sede = normalizeText(row.sede || "");
    const grade = toInt(row.grade);
    const group = normalizeText(row.group || "");
    return `${sede}|${grade}|${group}`;
  }

  function directorGroupMatches(student, directorGroup) {
    if (!student || !directorGroup) return false;
    return normalizeText(student.sede) === normalizeText(directorGroup.sede)
      && String(student.grade) === String(directorGroup.grade)
      && normalizeText(student.group) === normalizeText(directorGroup.group);
  }

  function teacherNameById(id) {
    const clean = cleanId(id);
    const carga = (state.cargaRows || []).find((row) => row.id === clean && row.name);
    return cleanText(carga?.name || `Docente ${clean}`);
  }

  function groupAssignmentsBySubject(assignments) {
    const map = new Map();
    (assignments || []).forEach((assignment) => {
      const subject = canonicalSubject(assignment.subject || assignment.subjectRaw);
      if (!map.has(subject)) map.set(subject, { subject, assignments: [] });
      map.get(subject).assignments.push(assignment);
    });
    return Array.from(map.values())
      .sort((a, b) => a.subject.localeCompare(b.subject, "es", { sensitivity: "base" }))
      .map((group) => ({
        ...group,
        assignments: group.assignments.slice().sort((a, b) => {
          const gradeDiff = Number(a.grade || 0) - Number(b.grade || 0);
          if (gradeDiff) return gradeDiff;
          return String(a.group || "").localeCompare(String(b.group || ""), "es", { sensitivity: "base", numeric: true });
        })
      }));
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
    const fallback = "#1975ae";
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


  function applyAppMeta(themeColor = null) {
    const icon = state.config.appIcon || "icons/icon-512.png";
    const primary = normalizeColor(themeColor || state.config.primaryColor || "#1975ae");
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", primary);
    setHeadLink('icon', icon, { type: icon.includes("svg") ? "image/svg+xml" : "image/png", sizes: "any" });
    setHeadLink('apple-touch-icon', icon);
  }

  function setHeadLink(rel, href, attrs = {}) {
    if (!href) return;
    let link = document.head.querySelector(`link[rel="${rel}"]`);
    if (!link) {
      link = document.createElement("link");
      link.rel = rel;
      document.head.appendChild(link);
    }
    link.href = href;
    Object.entries(attrs).forEach(([key, value]) => value ? link.setAttribute(key, value) : link.removeAttribute(key));
  }

  function buildWebManifest(cfg = state.config) {
    const primary = normalizeColor(cfg.primaryColor || "#1975ae");
    return {
      name: "Consulta de Resultados",
      short_name: "Resultados",
      description: "Consulta institucional de resultados de pruebas objetivas.",
      start_url: "./",
      scope: "./",
      display: "standalone",
      display_override: ["window-controls-overlay", "standalone", "minimal-ui", "browser"],
      orientation: "portrait-primary",
      background_color: primary,
      theme_color: primary,
      lang: "es-CO",
      categories: ["education", "productivity"],
      icons: [
        { src: cfg.appIcon192 || "icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
        { src: cfg.appIcon || "icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
        { src: cfg.appIconMaskable || "icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" }
      ]
    };
  }

  async function buildPwaIconFiles(sourceDataUrl) {
    const stamp = Date.now();
    const paths = {
      icon192: `icons/app-icon-${stamp}-192.png`,
      icon512: `icons/app-icon-${stamp}-512.png`,
      maskable: `icons/app-icon-${stamp}-maskable.png`,
      apple: `icons/app-icon-${stamp}-apple.png`,
      favicon32: `icons/favicon-${stamp}-32.png`,
      favicon16: `icons/favicon-${stamp}-16.png`
    };
    const files = [];
    const variants = [
      [paths.icon192, 192, false],
      [paths.icon512, 512, false],
      [paths.maskable, 512, true],
      [paths.apple, 180, false],
      [paths.favicon32, 32, false],
      [paths.favicon16, 16, false]
    ];
    for (const [path, size, maskable] of variants) {
      const dataUrl = await resizeImageToPng(sourceDataUrl, size, maskable);
      files.push({ path, contentBase64: base64FromDataUrl(dataUrl) });
    }
    return { files, paths };
  }

  function resizeImageToPng(sourceDataUrl, size, maskable = false) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");
        ctx.clearRect(0, 0, size, size);
        if (maskable) {
          ctx.fillStyle = normalizeColor(state.config.primaryColor || "#1975ae");
          ctx.fillRect(0, 0, size, size);
        }
        const padding = maskable ? Math.round(size * 0.16) : Math.round(size * 0.08);
        const box = size - padding * 2;
        const ratio = Math.min(box / img.width, box / img.height);
        const width = img.width * ratio;
        const height = img.height * ratio;
        const x = (size - width) / 2;
        const y = (size - height) / 2;
        ctx.drawImage(img, x, y, width, height);
        resolve(canvas.toDataURL("image/png"));
      };
      img.onerror = () => reject(new Error("No se pudo procesar el icono de la app."));
      img.src = sourceDataUrl;
    });
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

  function registerPWA() {
    if (!("serviceWorker" in navigator)) return;
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("service-worker.js").catch(() => {
        /* La app sigue funcionando aunque el registro PWA falle. */
      });
    });
  }

  registerPWA();
})();
