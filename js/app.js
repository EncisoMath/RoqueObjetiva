
(() => {
  "use strict";

  const APP_VERSION = "v135";
  const SUBJECT_AREA_UNASSIGNED = "__UNASSIGNED__";

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
    students: "po_students_override_v1",
    resultOverrides: "po_result_overrides_v1",
    subjectAreas: "po_subject_area_map_v1",
    recentLogins: "po_recent_logins_v1"
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
    title: "Roque Objetiva",
    subtitle: "Este reporte no se pasa ni se pierde. Es una herramienta para identificar fortalezas, habilidades y oportunidades de mejora.",
    logoImage: "assets/logo-principal.png?v=134",
    appIcon: "icons/icon-512.png",
    bannerImage: "",
    footerText: "Consulta institucional de resultados",
    primaryColor: "#1975ae",
    buttonRadius: 4,
    cornerRadius: 4,
    logoZoom: 1,
    subjectLogos: {},
    github: { owner: "", repo: "", branch: "main" },
    appName: "Roque Objetiva",
    identityVersion: "v85",
    logoAssetVersion: "v85"
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

  const SUPABASE_CONFIG = {
    enabled: true,
    url: (window.ROQUE_SUPABASE && window.ROQUE_SUPABASE.url) || "https://wkbczbjexnwbmyscrhah.supabase.co",
    key: (window.ROQUE_SUPABASE && window.ROQUE_SUPABASE.key) || "sb_publishable_6U4vM0f1TZ7sNRkjqQI1CQ_H1uCYSD_"
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
    rankingMetadataByRoll: new Map(),
    rankingFallbackResponsesByRoll: new Map(),
    rankingFallbackRegistryByExamId: new Map(),
    rankingFallbackRegistryByNationalId: new Map(),
    rankingFallbackLoaded: false,
    rankingSupplementLoaded: false,
    sessionRankContextByRoll: new Map(),
    studentRankDebugByRoll: new Map(),
    missingFiles: [],
    computedStudents: [],
    orphanExams: [],
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
    adminMapGrade: 6,
    adminMapSede: "",
    adminStatsMode: "estructura",
    adminStatsSede: "all",
    adminStatsGrade: "all",
    adminStatsGroup: "all",
    adminStatsSubject: "all",
    adminResultScope: "sede",
    adminResultSede: "all",
    adminResultGrade: "all",
    adminResultGroup: "all",
    adminResultSubject: "all",
    adminResultStudent: "all",
    adminRosterSede: "all",
    adminRosterGrade: "all",
    adminRosterGroup: "all",
    adminAnalysisMode: "grado",
    adminAnalysisSede: "all",
    adminAnalysisGrade: "all",
    adminAnalysisSubject: "all",
    adminAnalysisPath: {},
    adminGraphMode: "estructura",
    adminGraphSede: "all",
    adminGraphGrade: "all",
    adminGraphSubject: "all",
    adminGraphOpen: {},
    adminTableSort: {},
    sessionAuditStudentSearch: "",
    sessionAuditAssignRoll: "",
    subjectAreaMap: {},
    adminCargaTeacherId: "",
    adminDirectorTeacherId: "",
    modalStack: [],
    activeSession: null,
    zeroToleranceShown: false
  };

  document.addEventListener("DOMContentLoaded", init);
  document.addEventListener("submit", handleSubmit);
  document.addEventListener("click", handleCriticalStatsClick, true);
  document.addEventListener("click", handleClick);
  document.addEventListener("input", handleInput);
  document.addEventListener("change", handleCriticalStatsChange, true);
  document.addEventListener("change", handleChange);
  document.addEventListener("dragstart", handleDragStart);
  document.addEventListener("dragover", handleDragOver);
  document.addEventListener("drop", handleDrop);
  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeModal();
  });

  async function init() {
    try {
      if (window.location.hash) history.replaceState(null, "", window.location.pathname + window.location.search);
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
    state.subjectAreaMap = readJSON(STORAGE.subjectAreas, {}) || {};
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
    state.config = reconcileIdentityAssets(fileConfig, savedConfig, state.config);
    state.subjectAreaMap = { ...(fileConfig.subjectAreaMap || {}), ...state.subjectAreaMap, ...((savedConfig || {}).subjectAreaMap || {}) };
    state.config.subjectLogos = { ...(fileConfig.subjectLogos || {}), ...(savedConfig?.subjectLogos || {}) };
    state.logos = { ...state.config.subjectLogos, ...localLogos };
    applyAppMeta();

    if (SUPABASE_CONFIG.enabled) {
      await loadSupabasePublicSettings();
    }

    if (SUPABASE_CONFIG.enabled) {
      state.keys = [];
      state.responsesByRoll = new Map();
      state.rankingMetadataByRoll = new Map();
      state.rankingFallbackResponsesByRoll = new Map();
      state.rankingFallbackRegistryByExamId = new Map();
      state.rankingFallbackRegistryByNationalId = new Map();
      state.rankingFallbackLoaded = false;
      state.rankingSupplementLoaded = false;
      clearSessionRankContext();
      state.missingFiles = [];
      state.studentsRegistry = [];
      state.cargaRows = [];
      state.directorRows = [];
      state.orphanExams = [];
      state.computedStudents = [];
      state.computedByRoll = new Map();
      state.studentLogin = new Map();
      return;
    }

    state.keys = [];
    state.responsesByRoll = new Map();
    state.rankingMetadataByRoll = new Map();
    state.rankingFallbackResponsesByRoll = new Map();
    state.rankingFallbackRegistryByExamId = new Map();
    state.rankingFallbackRegistryByNationalId = new Map();
    state.rankingFallbackLoaded = false;
    state.rankingSupplementLoaded = false;
    clearSessionRankContext();
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
    applyResultOverrides();
  }

  async function supabaseRpc(functionName, payload = {}) {
    const baseUrl = cleanText(SUPABASE_CONFIG.url).replace(/\/$/, "");
    const key = cleanText(SUPABASE_CONFIG.key);
    if (!baseUrl || !key) throw new Error("Falta configurar Supabase.");
    const response = await fetch(`${baseUrl}/rest/v1/rpc/${functionName}`, {
      method: "POST",
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        "apikey": key,
        "Authorization": `Bearer ${key}`,
        "Cache-Control": "no-store, no-cache, max-age=0",
        "Pragma": "no-cache"
      },
      body: JSON.stringify(payload || {})
    });
    const text = await response.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch (error) { data = text; }
    if (!response.ok) {
      const message = data?.message || data?.error || text || `Error ${response.status}`;
      throw new Error(message);
    }
    return data;
  }

  async function supabaseRestSelect(tableName) {
    const baseUrl = cleanText(SUPABASE_CONFIG.url).replace(/\/$/, "");
    const key = cleanText(SUPABASE_CONFIG.key);
    if (!baseUrl || !key || !tableName) return null;
    const response = await fetch(`${baseUrl}/rest/v1/${encodeURIComponent(tableName)}?select=*`, {
      method: "GET",
      cache: "no-store",
      headers: {
        "apikey": key,
        "Authorization": `Bearer ${key}`,
        "Cache-Control": "no-store, no-cache, max-age=0",
        "Pragma": "no-cache"
      }
    });
    if (!response.ok) return null;
    const data = await response.json().catch(() => null);
    return Array.isArray(data) ? data : null;
  }


  function normalizeRpcRankingRowV123(row = {}, targetLogin = "") {
    const position = positiveIntOrNull(row.posicion || row.puesto || row.rank || row.position);
    const roll = cleanId(row.id_prueba || row.roll || row.ID_PRUEBA || "");
    const nationalId = cleanId(row.id_alumno || row.documento || row.ID_ALUMNO || "");
    const name = cleanText(row.nombre || row.name || [row.nombres, row.apellidos].filter(Boolean).join(" "));
    const grade = toInt(row.grado || row.grade || row.GRADO);
    const group = cleanText(row.curso || row.grupo || row.group || row.GRUPO || "");
    const sede = cleanText(row.sede || row.SEDE || "");
    const login = cleanId(targetLogin);
    const isTarget = !!(row.es_usuario === true || row.isTarget === true || (login && [roll, nationalId].includes(login)));
    const globalScore = numberOrNull(row.puntaje_global ?? row.globalScore ?? row.global_score ?? row.PUNTAJE_GLOBAL);
    const rankingScore = numberOrNull(row.puntaje_orden ?? row.rankingScore ?? row.score_used ?? row.puntaje_global ?? row.globalScore);
    return {
      position,
      rank: position,
      isTarget,
      roll,
      nationalId,
      name,
      sede,
      grade,
      group,
      math: numberOrNull(row.matematicas ?? row.math ?? row.MATEMATICAS),
      language: numberOrNull(row.lenguaje ?? row.language ?? row.LENGUAJE),
      natural: numberOrNull(row.naturales ?? row.ciencias_naturales ?? row.natural ?? row.CIENCIAS_NATURALES),
      social: numberOrNull(row.sociales ?? row.ciencias_sociales ?? row.social ?? row.CIENCIAS_SOCIALES),
      english: numberOrNull(row.ingles ?? row.english ?? row.INGLES),
      globalScore,
      rankingScore,
      source: cleanText(row.fuente || row.source || "Supabase RPC ranking"),
      notes: cleanText(row.notas || row.notes || row.debug || "")
    };
  }

  async function tryPrepareStudentRankingContextFromRpcV124(loginKey, warnings = [], errors = []) {
    if (!SUPABASE_CONFIG.enabled) return false;
    const key = cleanId(loginKey);
    if (!key) return false;
    let data = null;
    try {
      data = await supabaseRpc("roque_get_student_ranking_context", { p_login: key });
    } catch (error) {
      warnings.push(`RPC roque_get_student_ranking_context no disponible o falló: ${error?.message || error}`);
      return false;
    }

    if (!data || data.ok === false) {
      warnings.push(`RPC de ranking respondió sin ranking usable: ${data?.error || data?.message || "respuesta vacía"}`);
      return false;
    }

    const estudiante = data.estudiante || data.student || {};
    const ranking = data.ranking || {};
    const gradeRows = (Array.isArray(data.grado_rows) ? data.grado_rows : Array.isArray(data.gradeRows) ? data.gradeRows : [])
      .map((row) => normalizeRpcRankingRowV123(row, key));
    const courseRows = (Array.isArray(data.curso_rows) ? data.curso_rows : Array.isArray(data.courseRows) ? data.courseRows : [])
      .map((row) => normalizeRpcRankingRowV123(row, key));

    if (!gradeRows.length) errors.push("RPC de ranking no devolvió filas para ranking por grado.");
    if (!courseRows.length) errors.push("RPC de ranking no devolvió filas para ranking por curso.");

    const gradeTarget = gradeRows.find((row) => row.isTarget) || gradeRows.find((row) => [row.roll, row.nationalId].includes(key));
    const courseTarget = courseRows.find((row) => row.isTarget) || courseRows.find((row) => [row.roll, row.nationalId].includes(key));
    const globalScore = numberOrNull(estudiante.puntaje_global ?? ranking.puntaje_global ?? gradeTarget?.globalScore ?? courseTarget?.globalScore);
    const meta = {
      globalScore,
      rawGlobalScore: numberOrNull(estudiante.puntaje_bruto ?? ranking.puntaje_bruto),
      gradeRank: positiveIntOrNull(ranking.puesto_grado || gradeTarget?.position),
      gradeCount: positiveIntOrNull(ranking.total_grado || gradeRows.length),
      courseRank: positiveIntOrNull(ranking.puesto_curso || courseTarget?.position),
      courseCount: positiveIntOrNull(ranking.total_curso || courseRows.length)
    };

    setSessionRankContext(key, meta);
    const examId = cleanId(estudiante.id_prueba || estudiante.roll || gradeTarget?.roll || courseTarget?.roll || "");
    const nationalId = cleanId(estudiante.id_alumno || estudiante.documento || gradeTarget?.nationalId || courseTarget?.nationalId || "");
    if (examId && examId !== key) setSessionRankContext(examId, meta);
    if (nationalId && nationalId !== key) setSessionRankContext(nationalId, meta);

    const visibleStudent = findRankingStudentByRoll(key) || findRankingStudentByRoll(examId) || findRankingStudentByRoll(nationalId);
    if (visibleStudent) applySessionRankContextToStudent(visibleStudent);

    const debugWarnings = Array.isArray(data?.debug?.warnings) ? data.debug.warnings : [];
    const debugErrors = Array.isArray(data?.debug?.errors) ? data.debug.errors : [];
    warnings.push(...debugWarnings.map(String));
    errors.push(...debugErrors.map(String));

    const targetInfo = {
      roll: examId || cleanId(estudiante.id_prueba || ""),
      nationalId: nationalId || cleanId(estudiante.id_alumno || ""),
      name: cleanText(estudiante.nombre || estudiante.name || [estudiante.nombres, estudiante.apellidos].filter(Boolean).join(" ")),
      sede: cleanText(estudiante.sede || ""),
      grade: toInt(estudiante.grado || estudiante.grade) || "",
      group: cleanText(estudiante.curso || estudiante.grupo || estudiante.group || "")
    };

    if (!meta.gradeRank) errors.push("RPC de ranking no pudo ubicar el puesto del estudiante en el ranking de grado.");
    if (!meta.courseRank) errors.push("RPC de ranking no pudo ubicar el puesto del estudiante en el ranking de curso.");

    setStudentRankingDebug(key, {
      loginKey: key,
      target: targetInfo,
      targetRankingScore: numberOrNull(globalScore),
      gradeRank: meta.gradeRank,
      gradeCount: meta.gradeCount,
      courseRank: meta.courseRank,
      courseCount: meta.courseCount,
      counts: {
        computedStudents: state.computedStudents?.length || 0,
        responsesByRoll: state.responsesByRoll?.size || 0,
        fallbackResponses: state.rankingFallbackResponsesByRoll?.size || 0,
        pool: positiveIntOrNull(data?.debug?.total_evaluados_grado) || gradeRows.length,
        gradeRows: gradeRows.length,
        courseRows: courseRows.length
      },
      warnings: [`Ranking calculado por Supabase RPC roque_get_student_ranking_context.`, ...warnings],
      errors,
      gradeRows,
      courseRows
    });
    return true;
  }

  async function loadSupabaseRankingSupplement(payload = null) {
    if (!SUPABASE_CONFIG.enabled || state.rankingSupplementLoaded) return;
    state.rankingSupplementLoaded = true;

    // Si el login ya trajo varios resultados por grado, no se necesita pedir nada más.
    const currentGrades = groupBy(Array.from(state.responsesByRoll.values()), (record) => String(toInt(record?.grade) || ""));
    const hasUsableUniverse = Array.from(currentGrades.values()).some((rows) => rows.length > 1);
    const hasMetadata = state.rankingMetadataByRoll && state.rankingMetadataByRoll.size > 0;
    if (hasUsableUniverse && hasMetadata) return;

    const rpcNames = ["roque_get_rankings", "roque_get_ranking_dataset", "roque_ranking", "roque_get_resultados_publicos"];
    for (const name of rpcNames) {
      try {
        const extra = await supabaseRpc(name, {});
        const datasets = extra?.datasets || extra?.data?.datasets || extra?.data || extra || {};
        if (Array.isArray(datasets?.ranking) || Array.isArray(datasets?.rankings) || Array.isArray(extra)) {
          applyRankingMetadataRows(datasets.ranking || datasets.rankings || extra);
        }
        if (datasets?.estudiantes || datasets?.students) {
          const parsed = parseStudents(JSON.stringify(datasets.estudiantes || datasets.students || []));
          mergeSupplementalStudents(parsed);
        }
        if (datasets?.resultados || datasets?.results) {
          hydrateSupplementalResultGroups(datasets.resultados || datasets.results);
        }
        if ((state.rankingMetadataByRoll?.size || 0) > 0 || state.responsesByRoll.size > 1) return;
      } catch (error) {
        // Las funciones opcionales pueden no existir en instalaciones anteriores.
      }
    }

    // Respaldo: si las tablas son legibles por la publishable key, se usan solo para ranking.
    try {
      const students = await supabaseRestSelect("estudiantes");
      if (students?.length) mergeSupplementalStudents(parseStudents(JSON.stringify(students)));
    } catch (error) {}
    try {
      const rankings = await supabaseRestSelect("ranking");
      if (rankings?.length) applyRankingMetadataRows(rankings);
    } catch (error) {}
    try {
      const rankings = await supabaseRestSelect("rankings");
      if (rankings?.length) applyRankingMetadataRows(rankings);
    } catch (error) {}
    try {
      const results = await supabaseRestSelect("resultados");
      if (results?.length) hydrateSupplementalResultGroups(results);
    } catch (error) {}
  }


  function hydrateRankingContextPayload(payload, debug = null, sourceLabel = "Supabase") {
    const datasets = payload?.datasets || payload?.data?.datasets || payload?.data || payload || {};
    const beforeStudents = state.studentsRegistry.length;
    const beforeResponses = state.responsesByRoll.size;
    const beforeKeys = state.keys.length;
    const beforeRanks = state.rankingMetadataByRoll.size;

    const estudiantes = datasets.estudiantes || datasets.students || datasets.alumnos || datasets.registry || datasets.registro || [];
    const claves = datasets.keys || datasets.claves || datasets.answer_keys || datasets.answerKeys || [];
    const resultados = datasets.resultados || datasets.results || datasets.respuestas || datasets.responses || [];
    const rankings = datasets.ranking || datasets.rankings || datasets.puestos || datasets.ranking_global || datasets.rankingGlobal || [];

    if (Array.isArray(estudiantes) && estudiantes.length) mergeSupplementalStudents(parseStudents(JSON.stringify(estudiantes)));
    if (Array.isArray(claves) && claves.length) {
      claves.forEach((group) => {
        if (Array.isArray(group?.rows)) {
          const grade = toInt(group.grade || group.grado || group.GRADO);
          state.keys.push(...parseAnswerKey(JSON.stringify(group.rows), { grade, path: group.path || `SUPABASE/RANKING_KEYS_${grade || ""}.json` }));
        } else if (group && typeof group === "object") {
          state.keys.push(...parseAnswerKey(JSON.stringify([group]), { grade: toInt(group.grade || group.grado || group.GRADO), path: "SUPABASE/ranking_claves" }));
        }
      });
    }
    if (Array.isArray(resultados) && resultados.length) hydrateSupplementalResultGroups(resultados);
    if (Array.isArray(rankings) && rankings.length) applyRankingMetadataRows(rankings);

    const summary = {
      studentsAdded: state.studentsRegistry.length - beforeStudents,
      responsesAdded: state.responsesByRoll.size - beforeResponses,
      keysAdded: state.keys.length - beforeKeys,
      ranksAdded: state.rankingMetadataByRoll.size - beforeRanks
    };
    if (debug?.warnings) debug.warnings.push(`${sourceLabel}: estudiantes +${summary.studentsAdded}, claves +${summary.keysAdded}, resultados +${summary.responsesAdded}, rankings +${summary.ranksAdded}.`);
    return summary;
  }

  async function loadSupabaseRankingContextForStudent(target, loginKey, debug = null) {
    if (!SUPABASE_CONFIG.enabled || !target) return;
    const payload = {
      p_user: cleanId(loginKey),
      p_roll: cleanId(target.roll || target.registry?.examId || loginKey),
      p_id: cleanId(loginKey),
      p_documento: cleanId(target.registry?.nationalId || target.nationalId || loginKey),
      p_grade: toInt(target.grade || target.registry?.grade),
      p_grado: toInt(target.grade || target.registry?.grade),
      p_sede: cleanText(target.sede || target.registry?.sede || ""),
      p_curso: cleanText(target.group || target.registry?.group || ""),
      p_group: cleanText(target.group || target.registry?.group || "")
    };

    const rpcNames = [
      "roque_get_student_ranking_context",
      "roque_student_ranking_context",
      "roque_get_ranking_context",
      "roque_get_contexto_ranking",
      "roque_ranking_context",
      "roque_get_rankings",
      "roque_get_ranking_dataset",
      "roque_get_resultados_publicos"
    ];

    for (const name of rpcNames) {
      const before = state.responsesByRoll.size;
      try {
        const data = await supabaseRpc(name, payload);
        hydrateRankingContextPayload(data, debug, `RPC ${name}`);
        if (state.responsesByRoll.size > before + 1 || state.responsesByRoll.size > 1) return;
      } catch (error) {
        if (debug?.warnings) debug.warnings.push(`RPC ${name} no disponible o no autorizada: ${error?.message || error}`);
      }
    }

    const tableSets = [
      { table: "estudiantes", type: "students" },
      { table: "roque_estudiantes", type: "students" },
      { table: "app_estudiantes", type: "students" },
      { table: "claves", type: "keys" },
      { table: "keys", type: "keys" },
      { table: "roque_claves", type: "keys" },
      { table: "resultados", type: "results" },
      { table: "results", type: "results" },
      { table: "roque_resultados", type: "results" },
      { table: "ranking", type: "ranking" },
      { table: "rankings", type: "ranking" },
      { table: "roque_ranking", type: "ranking" }
    ];

    for (const item of tableSets) {
      try {
        const rows = await supabaseRestSelect(item.table);
        if (!rows?.length) {
          if (debug?.warnings) debug.warnings.push(`Tabla ${item.table}: sin filas visibles para la llave publica.`);
          continue;
        }
        if (item.type === "students") mergeSupplementalStudents(parseStudents(JSON.stringify(rows)));
        if (item.type === "keys") state.keys.push(...parseAnswerKey(JSON.stringify(rows), { grade: 0, path: `SUPABASE/${item.table}` }));
        if (item.type === "results") hydrateSupplementalResultGroups(rows);
        if (item.type === "ranking") applyRankingMetadataRows(rows);
        if (debug?.warnings) debug.warnings.push(`Tabla ${item.table}: ${rows.length} fila(s) visibles procesadas.`);
      } catch (error) {
        if (debug?.warnings) debug.warnings.push(`Tabla ${item.table} no legible: ${error?.message || error}`);
      }
    }
  }

  function hasUsableRankingUniverse() {
    const responseRows = Array.from(state.responsesByRoll?.values?.() || []);
    const byGrade = groupBy(responseRows, (record) => String(toInt(record?.grade) || ""));
    return Array.from(byGrade.values()).some((rows) => rows.length > 1);
  }

  function hasPrecomputedRankMetadata() {
    return !!(state.rankingMetadataByRoll && state.rankingMetadataByRoll.size > 0);
  }

  async function ensureRankingFallbackUniverse() {
    // v119: si Supabase entrega solo el estudiante que inició sesión, se puede usar el paquete local
    // únicamente como universo temporal de ranking. No modifica las listas visibles ni la matrícula.
    if (!SUPABASE_CONFIG.enabled) return;
    if (hasUsableRankingUniverse() || hasPrecomputedRankMetadata()) return;
    await loadBundledRankingFallbackData();
  }

  async function loadBundledRankingFallbackData(options = {}) {
    // v124: el diagnostico de ranking NO puede depender del payload filtrado de roque_login.
    // Por eso, cuando force=true, se recarga siempre el paquete local incluido en la PWA
    // y se arma un universo temporal con ESTUDIANTES + KEYS + RESULTADOS. Esto no modifica
    // las listas visibles ni reemplaza los datos vivos de Supabase; solo alimenta el ranking.
    const force = options?.force === true;
    const debug = options?.debug || null;
    const gradesHint = (Array.isArray(options?.gradesHint) ? options.gradesHint : [])
      .map((grade) => toInt(grade))
      .filter(Boolean);

    const pushDebug = (type, message) => {
      if (debug && Array.isArray(debug[type])) debug[type].push(message);
    };

    if (state.rankingFallbackLoaded && !force) return;
    state.rankingFallbackLoaded = true;
    state.rankingFallbackResponsesByRoll = new Map();
    state.rankingFallbackRegistryByExamId = new Map();
    state.rankingFallbackRegistryByNationalId = new Map();

    let bundledManifest = null;
    try {
      const manifestText = await fetchText("config/data-manifest.json", false);
      if (manifestText) bundledManifest = normalizeManifest({ ...DEFAULT_MANIFEST, ...JSON.parse(manifestText) });
    } catch (error) {
      pushDebug("warnings", `No se pudo leer config/data-manifest.json para respaldo local: ${error?.message || error}`);
    }

    const fallbackManifest = normalizeManifest({ ...DEFAULT_MANIFEST, grades: DEFAULT_GRADES });
    const manifests = [state.manifest, bundledManifest, fallbackManifest].filter(Boolean);

    const uniqueByPath = (items) => {
      const seen = new Set();
      return (items || []).filter((item) => {
        const path = cleanText(item?.path || item);
        if (!path || seen.has(path)) return false;
        seen.add(path);
        return true;
      });
    };

    const studentPaths = uniqueByPath([
      state.manifest?.estudiantes,
      bundledManifest?.estudiantes,
      fallbackManifest.estudiantes,
      "ESTUDIANTES/ESTUDIANTES.json"
    ].filter(Boolean).map((path) => ({ path })));

    let studentsLoaded = 0;
    for (const item of studentPaths) {
      try {
        const studentText = await fetchText(item.path, false);
        if (!studentText) continue;
        const students = parseStudents(studentText);
        students.forEach((student) => {
          const examId = cleanId(student?.examId);
          const nationalId = cleanId(student?.nationalId);
          if (examId) state.rankingFallbackRegistryByExamId.set(examId, student);
          if (nationalId) state.rankingFallbackRegistryByNationalId.set(nationalId, student);
        });
        studentsLoaded += students.length;
        if (students.length) break;
      } catch (error) {
        pushDebug("warnings", `No se pudo cargar estudiantes locales desde ${item.path}: ${error?.message || error}`);
      }
    }
    if (!studentsLoaded) pushDebug("warnings", "El respaldo local de estudiantes quedo vacio; no se pudo armar contexto amplio de ranking desde ESTUDIANTES.json.");

    const gradeSet = new Set(gradesHint);
    manifests.forEach((manifest) => (manifest?.grades || []).forEach((grade) => { const g = toInt(grade); if (g) gradeSet.add(g); }));
    DEFAULT_GRADES.forEach((grade) => { const g = toInt(grade); if (g) gradeSet.add(g); });
    state.studentsRegistry.forEach((student) => { const g = toInt(student?.grade); if (g) gradeSet.add(g); });
    state.cargaRows.forEach((row) => { const g = toInt(row?.grade); if (g) gradeSet.add(g); });

    const keyCandidates = [];
    manifests.forEach((manifest) => {
      (manifest?.keys || []).forEach((item) => keyCandidates.push(item));
      const template = manifest?.keyTemplate || "KEYS/KEYS_{grade}.json";
      gradeSet.forEach((grade) => keyCandidates.push({ grade, path: templatePath(template, { grade }), optional: true }));
    });
    const keyFiles = uniqueByPath(keyCandidates);

    const currentKeyIds = new Set((state.keys || []).map((key) => keyId(key)));
    let keyRowsLoaded = 0;
    for (const keyFile of keyFiles) {
      try {
        const text = await fetchText(keyFile.path, false);
        if (!text) continue;
        const rows = parseAnswerKey(text, keyFile);
        rows.forEach((row) => {
          const id = keyId(row);
          if (!currentKeyIds.has(id)) {
            state.keys.push(row);
            currentKeyIds.add(id);
            keyRowsLoaded += 1;
          }
        });
      } catch (error) {
        pushDebug("warnings", `No se pudieron cargar claves locales desde ${keyFile.path}: ${error?.message || error}`);
      }
    }
    if (!state.keys.length) pushDebug("errors", "No hay claves disponibles; no se puede calcular puntaje global ni ranking real.");
    if (!keyRowsLoaded && !currentKeyIds.size) pushDebug("warnings", "El respaldo local de claves no agrego filas.");

    const resultCandidates = [];
    manifests.forEach((manifest) => {
      (manifest?.resultados || []).forEach((item) => resultCandidates.push(item));
      const template = manifest?.resultTemplate || "RESULTADOS/{grade}S{session}.json";
      const sessions = manifest?.sessions || DEFAULT_MANIFEST.sessions || [];
      gradeSet.forEach((grade) => sessions.forEach((sessionInfo) => {
        const session = toInt(sessionInfo?.session || sessionInfo) || 1;
        resultCandidates.push({
          grade,
          session,
          startItem: toInt(sessionInfo?.startItem || sessionInfo?.start_item) || (session === 2 ? 71 : 1),
          path: templatePath(template, { grade, session }),
          optional: true
        });
      }));
    });
    const resultFiles = uniqueByPath(resultCandidates);

    const originalResponses = state.responsesByRoll;
    const tempResponses = new Map();
    let resultRowsLoaded = 0;
    try {
      state.responsesByRoll = tempResponses;
      for (const resultFile of resultFiles) {
        try {
          const text = await fetchText(resultFile.path, false);
          if (!text) continue;
          const before = tempResponses.size;
          parseResultFile(text, resultFile);
          resultRowsLoaded += Math.max(0, tempResponses.size - before);
        } catch (error) {
          pushDebug("warnings", `No se pudieron cargar resultados locales desde ${resultFile.path}: ${error?.message || error}`);
        }
      }
    } finally {
      state.responsesByRoll = originalResponses;
    }
    state.rankingFallbackResponsesByRoll = tempResponses;
    if (!tempResponses.size) pushDebug("warnings", "El respaldo local de RESULTADOS quedo vacio; si Supabase solo entrega el estudiante actual, la tabla de ranking seguira con una sola fila.");
    pushDebug("warnings", `Diagnostico local: estudiantes=${studentsLoaded}, claves=${state.keys.length}, resultadosRespaldo=${tempResponses.size}.`);
  }

  function clearRankingFallbackData() {
    state.rankingFallbackResponsesByRoll = new Map();
    state.rankingFallbackRegistryByExamId = new Map();
    state.rankingFallbackRegistryByNationalId = new Map();
    state.rankingFallbackLoaded = false;
  }

  function clearSessionRankContext() {
    state.sessionRankContextByRoll = new Map();
    state.studentRankDebugByRoll = new Map();
  }

  function setSessionRankContext(roll, meta = {}) {
    const key = cleanId(roll);
    if (!key) return;
    state.sessionRankContextByRoll.set(key, {
      gradeRank: positiveIntOrNull(meta.gradeRank),
      gradeCount: positiveIntOrNull(meta.gradeCount),
      courseRank: positiveIntOrNull(meta.courseRank),
      courseCount: positiveIntOrNull(meta.courseCount),
      globalScore: numberOrNull(meta.globalScore),
      rawGlobalScore: numberOrNull(meta.rawGlobalScore)
    });
  }

  function applySessionRankContextToStudent(student) {
    if (!student) return;
    const roll = cleanId(student.roll || student.registry?.examId);
    const meta = roll ? state.sessionRankContextByRoll?.get?.(roll) : null;
    if (!meta) return;
    const gradeRank = positiveIntOrNull(meta.gradeRank);
    const gradeCount = positiveIntOrNull(meta.gradeCount);
    const courseRank = positiveIntOrNull(meta.courseRank);
    const courseCount = positiveIntOrNull(meta.courseCount);
    if (gradeRank) student.gradeRank = gradeRank;
    if (gradeCount) student.gradeCount = gradeCount;
    if (courseRank) student.courseRank = courseRank;
    if (courseCount) student.courseCount = courseCount;
    if (Number.isFinite(Number(meta.globalScore))) student.globalScore = Number(meta.globalScore);
    if (student.gradeRank && student.gradeCount) {
      student.percentile = student.gradeCount > 1 ? Math.round(((student.gradeCount - student.gradeRank) / (student.gradeCount - 1)) * 100) : 100;
    }
  }

  function mergeSupplementalStudents(students = []) {
    if (!Array.isArray(students) || !students.length) return;
    const byExam = new Map((state.studentsRegistry || []).map((student) => [cleanId(student.examId), student]).filter(([id]) => id));
    students.forEach((student) => {
      const examId = cleanId(student?.examId);
      if (!examId) return;
      const existing = byExam.get(examId);
      if (existing) {
        existing.serverRank = mergeRankMeta(existing.serverRank, student.serverRank);
        if (!existing.sede && student.sede) existing.sede = student.sede;
        if (!existing.group && student.group) existing.group = student.group;
        if (!existing.grade && student.grade) existing.grade = student.grade;
        return;
      }
      state.studentsRegistry.push(student);
      byExam.set(examId, student);
    });
  }

  function hydrateSupplementalResultGroups(resultados = []) {
    const groups = Array.isArray(resultados) ? resultados : [];
    groups.forEach((group) => {
      if (Array.isArray(group?.rows)) {
        const grade = toInt(group.grade || group.grado);
        const session = toInt(group.session || group.sesion);
        parseResultFile(JSON.stringify(group.rows), {
          grade,
          session,
          startItem: toInt(group.startItem || group.start_item) || (session === 2 ? 71 : 1),
          path: group.path || `SUPABASE/${grade || ""}S${session || ""}.json`
        });
      } else if (group && typeof group === "object") {
        const grade = toInt(group.grade || group.grado || group.GRADO || group.Grado);
        const session = toInt(group.session || group.sesion || group.SESION || group.Sesion);
        parseResultFile(JSON.stringify([group]), {
          grade,
          session,
          startItem: toInt(group.startItem || group.start_item) || (session === 2 ? 71 : 1),
          path: "SUPABASE/resultados"
        });
      }
    });
  }

  function hydrateSupabasePayload(payload) {
    const datasets = payload?.datasets || {};
    state.keys = [];
    state.responsesByRoll = new Map();
    state.rankingMetadataByRoll = new Map();
    state.rankingFallbackResponsesByRoll = new Map();
    state.rankingFallbackRegistryByExamId = new Map();
    state.rankingFallbackRegistryByNationalId = new Map();
    state.rankingFallbackLoaded = false;
    state.rankingSupplementLoaded = false;
    clearSessionRankContext();
    state.missingFiles = [];
    state.orphanExams = [];

    const estudiantes = datasets.estudiantes || datasets.students || [];
    const carga = datasets.carga || datasets.carga_docente || datasets.cargaDocente || [];
    const docentes = datasets.docentes || datasets.teachers || [];
    const directores = datasets.directoresGrupo || datasets.directores_grupo || datasets.directores || directorRowsFromDocentes(docentes);
    const claves = datasets.keys || datasets.claves || [];
    const resultados = datasets.resultados || datasets.results || [];
    const rankings = datasets.ranking || datasets.rankings || datasets.ranking_global || datasets.rankingGlobal || datasets.puestos || [];
    const mapeoAreas = datasets.mapeo_areas || datasets.mapeoAreas || datasets.subjectAreaMap || [];
    if (Array.isArray(mapeoAreas)) {
      mapeoAreas.forEach((row) => {
        const asignatura = cleanText(row.asignatura || row.ASIGNATURA || row.Asignatura || row.subject || row.Subject);
        const area = cleanText(row.area || row.AREA || row.Area);
        if (asignatura && area) setSubjectAreaMap(asignatura, area);
      });
    } else if (mapeoAreas && typeof mapeoAreas === "object") {
      state.subjectAreaMap = { ...state.subjectAreaMap, ...mapeoAreas };
    }

    state.studentsRegistry = parseStudents(JSON.stringify(estudiantes || []));
    state.cargaRows = parseCarga(JSON.stringify(carga || []));
    state.directorRows = parseDirectoresGrupo(JSON.stringify(directores || []));
    mergeTeacherMetaFromDocentes(docentes);

    const gradeValues = [];
    state.studentsRegistry.forEach((student) => { if (student.grade) gradeValues.push(student.grade); });
    state.cargaRows.forEach((row) => { if (row.grade) gradeValues.push(row.grade); });
    state.directorRows.forEach((row) => { if (row.grade) gradeValues.push(row.grade); });
    (claves || []).forEach((group) => { if (group.grade || group.grado) gradeValues.push(group.grade || group.grado); });
    (resultados || []).forEach((group) => { if (group.grade || group.grado) gradeValues.push(group.grade || group.grado); });
    state.manifest = addGradesToManifest(normalizeManifest({ ...DEFAULT_MANIFEST, grades: DEFAULT_GRADES }), gradeValues);

    (claves || []).forEach((group) => {
      if (Array.isArray(group?.rows)) {
        const grade = toInt(group.grade || group.grado);
        state.keys.push(...parseAnswerKey(JSON.stringify(group.rows), { grade, path: group.path || `SUPABASE/KEYS_${grade}.json` }));
      } else if (group && typeof group === "object") {
        state.keys.push(...parseAnswerKey(JSON.stringify([group]), { grade: toInt(group.grade || group.grado), path: "SUPABASE/claves" }));
      }
    });
    applyAnswerOverrides();

    (resultados || []).forEach((group) => {
      if (Array.isArray(group?.rows)) {
        const grade = toInt(group.grade || group.grado);
        const session = toInt(group.session || group.sesion);
        const rows = Array.isArray(group.rows) ? group.rows : [];
        parseResultFile(JSON.stringify(rows), {
          grade,
          session,
          startItem: toInt(group.startItem || group.start_item) || (session === 2 ? 71 : 1),
          path: group.path || `SUPABASE/${grade}S${session}.json`
        });
      } else if (group && typeof group === "object") {
        parseResultFile(JSON.stringify([group]), { grade: toInt(group.grade || group.grado), session: 0, startItem: 1, path: "SUPABASE/resultados" });
      }
    });
    applyResultOverrides();
    applyRankingMetadataRows(rankings);
  }

  function applyRankingMetadataRows(rows = []) {
    const list = Array.isArray(rows) ? rows : (Array.isArray(rows?.rows) ? rows.rows : []);
    list.forEach((row) => {
      if (!row || typeof row !== "object") return;
      const normalized = {};
      Object.entries(row).forEach(([key, value]) => { normalized[cleanText(key)] = cleanText(value); });
      const roll = cleanId(normalized.ID_PRUEBA || normalized.id_prueba || normalized.roll || normalized.Roll || normalized["Roll No"] || normalized.ID || normalized.id);
      if (!roll) return;
      const meta = parseRankMeta(normalized);
      if (!hasRankMeta(meta)) return;
      state.rankingMetadataByRoll.set(roll, mergeRankMeta(state.rankingMetadataByRoll.get(roll), meta));
      const registry = state.registryByExamId?.get?.(roll);
      if (registry) registry.serverRank = mergeRankMeta(registry.serverRank, meta);
      const record = state.responsesByRoll?.get?.(roll);
      if (record) record.serverRank = mergeRankMeta(record.serverRank, meta);
    });
  }

  function directorRowsFromDocentes(docentes = []) {
    if (!Array.isArray(docentes)) return [];
    return docentes.map((row) => ({
      "Identificación": row.id_docente || row.ID_DOCENTE || row.ID || row.id || "",
      "Sede": row.direccion_sede || row.DIRECCION_SEDE || row.Sede || row.SEDE || "",
      "Grado": row.direccion_grado || row.DIRECCION_GRADO || row.Grado || row.GRADO || "",
      "Grupo": row.direccion_grupo || row.DIRECCION_GRUPO || row.Grupo || row.GRUPO || ""
    })).filter((row) => cleanId(row["Identificación"]) && cleanText(row.Sede) && cleanText(row.Grado) && cleanText(row.Grupo));
  }

  function mergeTeacherMetaFromDocentes(docentes = []) {
    if (!Array.isArray(docentes) || !docentes.length) return;
    const byId = new Map();
    docentes.forEach((row) => {
      const id = cleanId(row.id_docente || row.ID_DOCENTE || row.ID || row.Id || row.id);
      if (!id) return;
      byId.set(id, {
        id,
        name: cleanText(row.nombre || row.NOMBRE || row.Nombre || row.name),
        coordinator: isTruthy(row.coordinador || row.COORDINADOR || row.Coordinador),
        direccion_sede: cleanText(row.direccion_sede || row.DIRECCION_SEDE || row.Sede || row.SEDE),
        direccion_grado: toInt(row.direccion_grado || row.DIRECCION_GRADO || row.Grado || row.GRADO),
        direccion_grupo: cleanText(row.direccion_grupo || row.DIRECCION_GRUPO || row.Grupo || row.GRUPO)
      });
    });
    state.cargaRows = (state.cargaRows || []).map((row) => {
      const meta = byId.get(row.id);
      return meta ? { ...row, name: row.name || meta.name, coordinator: row.coordinator || meta.coordinator } : row;
    });
    byId.forEach((meta, id) => {
      if (!(state.cargaRows || []).some((row) => row.id === id) && meta.name) {
        state.cargaRows.push({ id, name: meta.name, subjectRaw: "", subject: "", sede: "", grade: 0, group: "", coordinator: meta.coordinator });
      }
    });
  }

  const FUNNY_LOADER_COPIES = [
    { title: "Tranquilo, estamos haciendo este examen por ti", subtitle: "Mentira... pero ya estamos preparando tus resultados." },
    { title: "Seguro que borraste bien? Hmm...", subtitle: "Revisando respuestas, cursos y ese sospechoso ítem 37." },
    { title: "Invocando al espíritu del ICFES", subtitle: "Si aparece una gráfica rara, no fuimos nosotros. Bueno, sí." },
    { title: "Consultando la bola de cristal académica", subtitle: "También estamos calculando promedios, rankings y cositas serias." },
    { title: "No cierres esto, se asusta la base de datos", subtitle: "Estamos acomodando tus resultados en una bandejita bonita." },
    { title: "Contando respuestas correctas con los dedos", subtitle: "Ya casi. Nos prestaron una calculadora." },
    { title: "Respira. Si sale cero rojo, hablamos luego", subtitle: "Cargando vista, notas y reportes autorizados." }
  ];

  function randomLoaderCopy() {
    return FUNNY_LOADER_COPIES[Math.floor(Math.random() * FUNNY_LOADER_COPIES.length)] || FUNNY_LOADER_COPIES[0];
  }

  async function loadSupabasePublicSettings() {
    try {
      const settings = await supabaseRpc("roque_get_public_settings", {});
      const config = settings?.config || settings?.publicConfig || null;
      if (config && typeof config === "object") {
        state.config = { ...state.config, ...config };
        if (config.subjectAreaMap && typeof config.subjectAreaMap === "object") {
          state.subjectAreaMap = { ...state.subjectAreaMap, ...config.subjectAreaMap };
        }
        if (config.subjectLogos && typeof config.subjectLogos === "object") {
          state.logos = { ...state.logos, ...config.subjectLogos };
        }
        applyAppMeta();
      }
    } catch (error) {
      console.warn("No se pudieron cargar ajustes públicos desde Supabase:", error?.message || error);
    }
  }

  async function loginWithSupabase(user, pass = "", options = {}) {
    const parsedLogin = parseRankingLoginInput(user);
    const cleanUser = parsedLogin.login;
    const wantsRankingDebug = !!(options.rankingDebug || parsedLogin.rankingDebug);
    try {
      const bootCopy = randomLoaderCopy();
      fadeAppOut();
      await wait(180);
      app.innerHTML = `
        <div class="boot">
          <div class="boot-mark"></div>
          <h1>${esc(bootCopy.title)}</h1>
          <p>${esc(bootCopy.subtitle)}</p>
        </div>
      `;
      fadeAppIn();
      const payload = await supabaseRpc("roque_login", { p_user: cleanUser, p_password: pass || "", p_device: deviceInfoText(), p_mode: appModeText() });
      if (!payload?.ok) {
        return renderLogin(payload?.error || "No fue posible iniciar sesion.");
      }
      hydrateSupabasePayload(payload);
      // v124: no se hacen consultas exploratorias de ranking aquí.
      // El ranking de estudiante se calcula después con la RPC dedicada.
      buildRepository();

      const session = payload.session || {};
      if (session.role === "admin") {
        sessionStorage.setItem("po_supabase_admin_password", pass || "");
        state.adminTab = "resumen";
        state.zeroToleranceShown = false;
        return enterSessionWithLoader({ role: "admin", id: "admin" }, () => renderAdmin(), "Abriendo panel de administración...");
      }

      if (session.role === "teacher") {
        const id = cleanId(session.id);
        const teacher = state.teachers.get(id);
        if (!teacher) return renderLogin("No encontré ese docente en Supabase.");
        state.teacherActive = null;
        state.teacherMode = "asignaturas";
        state.teacherDirectorActiveKey = "";
        if (!(teacher?.assignments || []).length && (teacher?.directorGroups || []).length) state.teacherMode = "director";
        if (!(teacher?.assignments || []).length && !(teacher?.directorGroups || []).length && teacher?.coordinator) state.teacherMode = "coord-estudiantes";
        state.zeroToleranceShown = false;
        return enterSessionWithLoader({ role: "teacher", id }, () => renderTeacher(teacher), "Preparando vista docente...");
      }

      if (session.role === "student") {
        const roll = cleanId(session.roll);
        return enterStudentSessionWithRankingMode(roll, { debug: wantsRankingDebug, message: wantsRankingDebug ? "Preparando diagnóstico de ranking..." : "Calculando ranking y preparando resultados..." });
      }

      return renderLogin("No se pudo identificar el tipo de usuario.");
    } catch (error) {
      console.error(error);
      return renderLogin(error.message || "No fue posible conectar con Supabase.");
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

  function reconcileIdentityAssets(fileConfig = {}, savedConfig = null, mergedConfig = {}) {
    const repoIdentityVersion = fileConfig.identityVersion || DEFAULT_CONFIG.identityVersion || APP_VERSION;
    const localIdentityVersion = savedConfig?.identityVersion || "";
    const repoConfig = { ...DEFAULT_CONFIG, ...fileConfig };
    const out = { ...mergedConfig };

    const identityFields = [
      "title",
      "appName",
      "logoImage",
      "appIcon",
      "appIcon192",
      "appIconMaskable",
      "appleTouchIcon",
      "favicon32",
      "favicon16",
      "identityVersion",
      "logoAssetVersion"
    ];

    const localLogoLooksLikeAppIcon = typeof savedConfig?.logoImage === "string"
      && (/^icons\//i.test(savedConfig.logoImage) || /icon-512|maskable|apple-touch-icon|favicon/i.test(savedConfig.logoImage));

    if (localIdentityVersion !== repoIdentityVersion || localLogoLooksLikeAppIcon) {
      identityFields.forEach((field) => {
        if (repoConfig[field] !== undefined) out[field] = repoConfig[field];
      });
      out.identityVersion = repoIdentityVersion;
      out.logoAssetVersion = repoConfig.logoAssetVersion || repoIdentityVersion;
    }

    return out;
  }

  function firstPresent(row, keys = []) {
    if (!row || typeof row !== "object") return "";
    for (const key of keys) {
      if (row[key] !== undefined && row[key] !== null && cleanText(row[key]) !== "") return row[key];
    }
    const normalizedKeys = keys.map(normalizeText);
    const foundKey = Object.keys(row).find((key) => normalizedKeys.includes(normalizeText(key)));
    return foundKey ? row[foundKey] : "";
  }

  function numberOrNull(value) {
    if (value === null || value === undefined || value === "") return null;
    const normalized = cleanText(value).replace(/,/g, ".").replace(/[^0-9.\-]+/g, "");
    if (!normalized) return null;
    const number = Number(normalized);
    return Number.isFinite(number) ? number : null;
  }

  function positiveIntOrNull(value) {
    const number = numberOrNull(value);
    return Number.isFinite(number) && number > 0 ? Math.round(number) : null;
  }

  function parseRankMeta(row = {}) {
    const meta = {
      globalScore: numberOrNull(firstPresent(row, [
        "PUNTAJE_GLOBAL", "Puntaje global", "puntaje_global", "globalScore", "global_score", "score_global", "saber_global", "SABER_GLOBAL"
      ])),
      rawGlobalScore: numberOrNull(firstPresent(row, [
        "PUNTAJE_BRUTO", "PROMEDIO_GLOBAL", "rawGlobalScore", "raw_global_score", "promedio_global"
      ])),
      gradeRank: positiveIntOrNull(firstPresent(row, [
        "PUESTO_GRADO", "Puesto grado", "puesto_grado", "ranking_grado", "rank_grado", "gradeRank", "grade_rank"
      ])),
      gradeCount: positiveIntOrNull(firstPresent(row, [
        "TOTAL_GRADO", "Total grado", "total_grado", "conteo_grado", "gradeCount", "grade_count"
      ])),
      courseRank: positiveIntOrNull(firstPresent(row, [
        "PUESTO_CURSO", "Puesto curso", "puesto_curso", "ranking_curso", "rank_curso", "courseRank", "course_rank"
      ])),
      courseCount: positiveIntOrNull(firstPresent(row, [
        "TOTAL_CURSO", "Total curso", "total_curso", "conteo_curso", "courseCount", "course_count"
      ]))
    };
    return Object.fromEntries(Object.entries(meta).filter(([, value]) => value !== null && value !== undefined && value !== ""));
  }

  function hasRankMeta(meta) {
    return !!(meta && Object.values(meta).some((value) => value !== null && value !== undefined && value !== ""));
  }

  function mergeRankMeta(...metas) {
    const out = {};
    metas.forEach((meta) => {
      if (!meta || typeof meta !== "object") return;
      Object.entries(meta).forEach(([key, value]) => {
        if (value !== null && value !== undefined && value !== "") out[key] = value;
      });
    });
    return out;
  }

  function parseStudents(text) {
    const objects = parseDataObjects(text, ["ID_PRUEBA", "NOMBRES"]);
    return objects.map((row) => {
      const apellidos = cleanText(row.APELLIDOS || row.Apellidos || row.apellidos || row.APELLIDO || row.Apellido);
      const nombres = cleanText(row.NOMBRES || row.Nombres || row.nombres || row.NOMBRE || row.Nombre || row.nombre);
      const fullFromParts = cleanText(nombres && apellidos ? `${nombres} ${apellidos}` : (nombres || apellidos));
      const fullName = cleanText(row.NOMBRE_COMPLETO || row.NombreCompleto || row.Name || row.name || fullFromParts);
      const serverRank = parseRankMeta(row);
      return {
        examId: cleanId(row.ID_PRUEBA || row.id_prueba || row.IdPrueba || row.ID || row.Id || row.id),
        nationalId: cleanId(row.ID_ALUMNO || row.id_alumno || row.IdAlumno || row["Carné"] || row.Carne || row.Carnet || row.Documento || row.documento),
        nombres,
        apellidos,
        name: fullName,
        sede: cleanText(row.SEDE || row.sede || row.Sede),
        grade: toInt(row.GRADO || row.grado || row.Grado),
        group: cleanText(row.GRUPO || row.grupo || row.Grupo || row.CURSO || row.curso || row.Curso),
        serverRank: hasRankMeta(serverRank) ? serverRank : null
      };
    }).filter((s) => s.examId || s.nationalId || s.name);
  }

  function parseCarga(text) {
    const objects = parseDataObjects(text, ["ID", "ASIGNATURA"]);
    return objects.map((row) => ({
      id: cleanId(row.ID || row.id_docente || row.ID_DOCENTE || row.Id || row.id),
      name: cleanText(row.NOMBRE || row.nombre || row.Nombre || row.Name),
      subjectRaw: cleanText(row.ASIGNATURA || row.asignatura || row.Asignatura || row.Area || row.area || row["Área"]),
      subject: canonicalSubject(row.ASIGNATURA || row.asignatura || row.Asignatura || row.Area || row.area || row["Área"]),
      sede: cleanText(row.SEDE || row.sede || row.Sede),
      grade: toInt(row.GRADO || row.grado || row.Grado),
      group: cleanText(row.CURSO || row.curso || row.Curso || row.GRUPO || row.grupo || row.Grupo),
      coordinator: isTruthy(row.COORDINADOR || row.coordinador || row.Coordinador || row.COORD || row.coord)
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
      .map((row, idx) => {
        const rowGrade = toInt(row.GRADO || row.grado || row.Grado || row.grade || row.GRADE || grade);
        return ({
        sourcePath: fileInfo.path,
        grade: rowGrade,
        areaRaw: cleanText(row["Área"] || row.area || row.Area || row.AREA || row.Asignatura || row.ASIGNATURA),
        area: canonicalSubject(row["Área"] || row.area || row.Area || row.AREA || row.Asignatura || row.ASIGNATURA),
        item: toInt(row["Número de ítem"] || row.numero_item || row["Numero de item"] || row.Numero || row.Número || row.Item || row.ITEM || row["N°"]),
        correct: cleanOption(row["Respuesta sugerida"] || row.respuesta_sugerida || row.Respuesta || row.RESPUESTA || row.Key),
        component: cleanText(row["Componente / pensamiento / entorno / factor / enfoque"] || row.componente || row.Componente || row.COMPONENTE || row.Pensamiento || row.Enfoque),
        competence: cleanText(row.competencia || row.Competencia || row.COMPETENCIA || row.Competencias),
        idx
      }); })
      .filter((r) => r.grade && r.area && r.item && r.correct);
  }

  function parseResultFile(text, fileInfo) {
    const objects = parseDataObjects(text, ["Roll No"]);
    const grade = toInt(fileInfo.grade) || inferGradeFromPath(fileInfo.path) || inferGradeFromExam(objects);
    const session = toInt(fileInfo.session) || inferSessionFromPath(fileInfo.path);
    const startItem = toInt(fileInfo.startItem) || (session === 2 ? 71 : 1);

    for (const row of objects) {
      const roll = cleanId(row["Roll No"] || row.RollNo || row.Roll || row.ID || row.ID_PRUEBA || row.id_prueba || row.id);
      if (!roll) continue;

      const rowGrade = toInt(row.GRADO || row.grado || row.Grado || row.grade || row.GRADE || grade);
      const current = state.responsesByRoll.get(roll) || {
        roll,
        name: cleanText(row.Name || row.Nombre || row.NOMBRE),
        grade: rowGrade,
        sessions: [],
        answers: {}
      };

      if (!current.name) current.name = cleanText(row.Name || row.Nombre || row.NOMBRE);
      if (!current.grade) current.grade = rowGrade;
      const rowSede = cleanText(row.SEDE || row.sede || row.Sede || row.sede_nombre || row.sedeNombre);
      const rowGroup = cleanText(row.GRUPO || row.grupo || row.Grupo || row.CURSO || row.curso || row.Curso);
      const rowNationalId = cleanId(row.ID_ALUMNO || row.id_alumno || row.IdAlumno || row.Documento || row.documento || row.ID_ESTUDIANTE || row.id_estudiante);
      const rowRankMeta = parseRankMeta(row);
      if (rowSede && !current.sede) current.sede = rowSede;
      if (rowGroup && !current.group) current.group = rowGroup;
      if (rowNationalId && !current.nationalId) current.nationalId = rowNationalId;
      if (hasRankMeta(rowRankMeta)) current.serverRank = mergeRankMeta(current.serverRank, rowRankMeta);

      let foundAnswer = false;
      const rawAnswers = row.respuestas || row.Respuestas || row.RESPUESTAS || null;
      if (rawAnswers && typeof rawAnswers === "object" && !Array.isArray(rawAnswers)) {
        Object.entries(rawAnswers).forEach(([item, value]) => {
          const itemNumber = toInt(item);
          if (!itemNumber) return;
          const marked = cleanMarked(value);
          if (marked) foundAnswer = true;
          current.answers[itemNumber] = marked;
        });
      } else if (rawAnswers && typeof rawAnswers === "string" && rawAnswers.trim().startsWith("{")) {
        try {
          const parsed = JSON.parse(rawAnswers);
          Object.entries(parsed || {}).forEach(([item, value]) => {
            const itemNumber = toInt(item);
            if (!itemNumber) return;
            const marked = cleanMarked(value);
            if (marked) foundAnswer = true;
            current.answers[itemNumber] = marked;
          });
        } catch (error) {
          // Si no es JSON válido, se ignora y se procesa como EvalBee tradicional.
        }
      }

      Object.entries(row).forEach(([key, value]) => {
        const match = String(key).match(/^Q\s*(\d+)\s*Options$/i) || String(key).match(/^q\s*(\d+)$/i);
        if (!match) return;
        const localItem = Number(match[1]);
        const globalItem = startItem + localItem - 1;
        const marked = cleanMarked(value);
        if (marked) foundAnswer = true;
        current.answers[globalItem] = marked;
      });

      if (foundAnswer || !current.sessions.length) {
        current.sessions.push({ session: session || 1, path: fileInfo.path });
      }
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

  function calculateStudentStatsFromRecord(record, grade) {
    const cleanGrade = toInt(grade || record?.grade);
    const keys = (state.keys || []).filter((key) => String(key.grade) === String(cleanGrade));
    const subjectStats = {};
    const allDetails = [];

    for (const subject of SUBJECTS) {
      const subjectKeys = keys.filter((key) => sameSubject(key.area, subject.name));
      const total = subjectKeys.length;
      const hasAttempt = hasAnyMarkedAnswerForKeys(record, subjectKeys);
      const absent = total > 0 && !hasAttempt;
      const details = subjectKeys.map((key) => {
        const marked = absent ? "" : (record?.answers?.[key.item] || "");
        const status = absent ? "empty" : classifyAnswer(marked, key.correct);
        return {
          item: key.item,
          subject: subject.name,
          marked,
          correct: key.correct,
          status,
          absent,
          component: key.component,
          competence: key.competence
        };
      });

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
        absent,
        score: total ? (absent ? 0 : calculateScore(correct, total)) : null,
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
    const anyAttempt = Object.values(subjectStats).some((stat) => stat?.total && !stat.absent);

    return { subjectStats, allDetails, total, correct, wrong, doubleMark, empty, anyAttempt };
  }

  function buildComputedStudentFromRegistry(registry, index = 0) {
    const examId = cleanId(registry?.examId);
    const record = examId ? state.responsesByRoll.get(examId) : null;
    const grade = toInt(registry?.grade) || toInt(record?.grade);
    const roll = examId || cleanId(registry?.nationalId) || `REG-${index + 1}`;
    const stats = calculateStudentStatsFromRecord(record, grade);
    const serverRank = mergeRankMeta(registry?.serverRank, record?.serverRank, state.rankingMetadataByRoll?.get(examId));

    return {
      roll,
      loginIds: [roll, registry?.nationalId].filter(Boolean),
      name: cleanText(registry?.name) || cleanText(record?.name) || `Estudiante ${roll}`,
      scannedName: cleanText(record?.name),
      grade,
      group: cleanText(registry?.group) || cleanText(record?.group) || `Grado ${grade}`,
      sede: cleanText(registry?.sede) || cleanText(record?.sede),
      registry,
      missingExam: !record,
      total: stats.total,
      correct: stats.correct,
      wrong: stats.wrong,
      doubleMark: stats.doubleMark,
      empty: stats.empty,
      globalScore: calculateSaberGlobal(stats.subjectStats),
      rawGlobalScore: stats.total ? (stats.anyAttempt ? calculateScore(stats.correct, stats.total) : 0) : null,
      serverRank: hasRankMeta(serverRank) ? serverRank : null,
      percentile: 0,
      gradeRank: null,
      gradeCount: null,
      courseRank: null,
      courseCount: null,
      subjectStats: stats.subjectStats
    };
  }

  function buildComputedStudentFromResultRecord(record, fallbackIndex = 0) {
    const roll = cleanId(record?.roll) || `RESULT-${fallbackIndex + 1}`;
    const registry = state.registryByExamId.get(roll)
      || state.rankingFallbackRegistryByExamId?.get?.(roll)
      || state.registryByNationalId.get(cleanId(record?.nationalId))
      || state.rankingFallbackRegistryByNationalId?.get?.(cleanId(record?.nationalId))
      || null;
    const grade = toInt(registry?.grade) || toInt(record?.grade);
    if (!roll || !grade) return null;
    const stats = calculateStudentStatsFromRecord(record, grade);
    const serverRank = mergeRankMeta(registry?.serverRank, record?.serverRank, state.rankingMetadataByRoll?.get(roll));

    return {
      roll,
      loginIds: [roll, registry?.nationalId, record?.nationalId].filter(Boolean),
      name: cleanText(registry?.name) || cleanText(record?.name) || `Estudiante ${roll}`,
      scannedName: cleanText(record?.name),
      grade,
      group: cleanText(registry?.group) || cleanText(record?.group) || `Grado ${grade}`,
      sede: cleanText(registry?.sede) || cleanText(record?.sede),
      registry,
      missingExam: false,
      total: stats.total,
      correct: stats.correct,
      wrong: stats.wrong,
      doubleMark: stats.doubleMark,
      empty: stats.empty,
      globalScore: calculateSaberGlobal(stats.subjectStats),
      rawGlobalScore: stats.total ? (stats.anyAttempt ? calculateScore(stats.correct, stats.total) : 0) : null,
      serverRank: hasRankMeta(serverRank) ? serverRank : null,
      percentile: 0,
      gradeRank: null,
      gradeCount: null,
      courseRank: null,
      courseCount: null,
      subjectStats: stats.subjectStats,
      rankingOnly: true
    };
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
      if (!row?.id) continue;
      if (!state.teachers.has(row.id)) {
        state.teachers.set(row.id, { id: row.id, name: row.name, assignments: [], directorGroups: [], coordinator: false });
      }
      const teacher = state.teachers.get(row.id);
      if (!teacher.name && row.name) teacher.name = row.name;
      if (row.coordinator) teacher.coordinator = true;
      if (!row.subjectRaw || !row.grade) continue;
      const assignmentKey = assignmentKeyFor(row);
      if (!teacher.assignments.some((a) => a.key === assignmentKey)) {
        teacher.assignments.push({
          key: assignmentKey,
          grade: row.grade,
          subject: mappedSubject(row.subjectRaw || row.subject),
          subjectRaw: row.subjectRaw,
          sede: row.sede || "",
          group: row.group || ""
        });
      }
    }

    for (const row of state.directorRows || []) {
      if (!row.id) continue;
      if (!state.teachers.has(row.id)) {
        state.teachers.set(row.id, { id: row.id, name: teacherNameById(row.id), assignments: [], directorGroups: [], coordinator: false });
      }
      const teacher = state.teachers.get(row.id);
      if (!teacher.directorGroups) teacher.directorGroups = [];
      const key = directorKeyFor(row);
      if (!teacher.directorGroups.some((item) => item.key === key)) {
        teacher.directorGroups.push({ key, id: row.id, sede: row.sede || "", grade: row.grade, group: row.group || "" });
      }
    }

    const keysByGrade = groupBy(state.keys, (row) => String(row.grade));
    const responseRecords = Array.from(state.responsesByRoll.values());
    state.orphanExams = buildOrphanExams(responseRecords);

    // v88: las tablas se basan en ESTUDIANTES.json, no solo en quienes aparecen en S1/S2.
    // Si el estudiante registrado no aparece en la sesión correspondiente a una asignatura,
    // esa asignatura queda con nota 0 y marcada como no presentada.
    state.computedStudents = state.studentsRegistry
      .filter((registry) => registry && (registry.examId || registry.nationalId || registry.name) && (toInt(registry.grade) || registry.examId))
      .map((registry, index) => buildComputedStudentFromRegistry(registry, index))
      .filter((student) => student.grade);

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
    // v119: ranking por PUNTAJE GLOBAL. Las listas visibles pueden estar filtradas por rol,
    // pero los puestos se calculan con un universo independiente: resultados Supabase,
    // ranking precomputado o respaldo local empaquetado.
    const visibleStudents = state.computedStudents || [];
    visibleStudents.forEach((student) => resetRankFields(student));

    const rankedStudents = buildRankingStudentsPool()
      .filter((student) => studentHasRankingResult(student) && Number.isFinite(rankBaseScore(student)));

    const byGrade = groupBy(rankedStudents, gradeRankKey);
    byGrade.forEach((gradeStudents, key) => {
      if (!key) return;
      const orderedGrade = orderStudentsForRanking(gradeStudents);
      applyOrderedRanks(orderedGrade, "grade");
      orderedGrade.forEach((student) => applyServerRankFallback(student, "grade", orderedGrade.length));

      const byCourse = groupBy(gradeStudents, courseRankKey);
      byCourse.forEach((courseStudents, courseKey) => {
        if (!courseKey) return;
        const orderedCourse = orderStudentsForRanking(courseStudents);
        applyOrderedRanks(orderedCourse, "course");
        orderedCourse.forEach((student) => applyServerRankFallback(student, "course", orderedCourse.length));
      });

      for (const subject of SUBJECTS) {
        const scored = gradeStudents.filter((student) => {
          const stat = student.subjectStats?.[subject.name];
          return isExistingResultStat(student, stat);
        });
        const ordered = orderStudentsForRanking(scored, (student) => Number(student.subjectStats?.[subject.name]?.score));
        ordered.forEach((student, index) => {
          const stat = student.subjectStats?.[subject.name];
          if (!stat) return;
          stat.percentile = ordered.length > 1 ? Math.round(((ordered.length - index - 1) / (ordered.length - 1)) * 100) : 100;
        });
      }
    });

    const rankByRoll = new Map(rankedStudents.map((student) => [cleanId(student.roll), student]));
    visibleStudents.forEach((student) => {
      const ranked = rankByRoll.get(cleanId(student.roll || student.registry?.examId));
      if (!ranked) {
        applyServerRankFallback(student, "grade", 0);
        applyServerRankFallback(student, "course", 0);
        return;
      }
      student.gradeRank = ranked.gradeRank;
      student.gradeCount = ranked.gradeCount;
      student.courseRank = ranked.courseRank;
      student.courseCount = ranked.courseCount;
      student.percentile = ranked.percentile;
      for (const subject of SUBJECTS) {
        const visibleStat = student.subjectStats?.[subject.name];
        const rankedStat = ranked.subjectStats?.[subject.name];
        if (visibleStat && rankedStat) visibleStat.percentile = rankedStat.percentile;
      }
    });
  }

  function applyServerRankFallback(student, scope, localGroupSize = 0) {
    if (!student) return;
    const meta = mergeRankMeta(student.serverRank, state.rankingMetadataByRoll?.get(cleanId(student.roll || student.registry?.examId)));
    if (!hasRankMeta(meta)) return;
    if (scope === "grade") {
      const serverRank = positiveIntOrNull(meta.gradeRank);
      const serverCount = positiveIntOrNull(meta.gradeCount);
      if (serverRank && (!student.gradeRank || (serverCount && serverCount > localGroupSize))) {
        student.gradeRank = serverRank;
        student.gradeCount = serverCount || student.gradeCount || localGroupSize || null;
        student.percentile = student.gradeCount && student.gradeCount > 1 ? Math.round(((student.gradeCount - student.gradeRank) / (student.gradeCount - 1)) * 100) : 100;
      }
    }
    if (scope === "course") {
      const serverRank = positiveIntOrNull(meta.courseRank);
      const serverCount = positiveIntOrNull(meta.courseCount);
      if (serverRank && (!student.courseRank || (serverCount && serverCount > localGroupSize))) {
        student.courseRank = serverRank;
        student.courseCount = serverCount || student.courseCount || localGroupSize || null;
      }
    }
  }

  function resetRankFields(student) {
    if (!student) return;
    student.gradeRank = null;
    student.gradeCount = null;
    student.courseRank = null;
    student.courseCount = null;
    student.percentile = 0;
  }

  function buildRankingStudentsPool() {
    const byRoll = new Map();
    (state.computedStudents || []).forEach((student) => {
      const roll = cleanId(student?.roll || student?.registry?.examId);
      if (!roll || !studentHasRankingResult(student)) return;
      resetRankFields(student);
      byRoll.set(roll, student);
    });

    let index = 0;
    (state.responsesByRoll || new Map()).forEach((record, rollKey) => {
      const roll = cleanId(record?.roll || rollKey);
      if (!roll || byRoll.has(roll)) return;
      const synthetic = buildComputedStudentFromResultRecord({ ...record, roll }, index++);
      if (!synthetic) return;
      resetRankFields(synthetic);
      byRoll.set(roll, synthetic);
    });

    (state.rankingFallbackResponsesByRoll || new Map()).forEach((record, rollKey) => {
      const roll = cleanId(record?.roll || rollKey);
      if (!roll || byRoll.has(roll)) return;
      const synthetic = buildComputedStudentFromResultRecord({ ...record, roll }, index++);
      if (!synthetic) return;
      resetRankFields(synthetic);
      byRoll.set(roll, synthetic);
    });

    return [...byRoll.values()];
  }

  function gradeRankKey(student) {
    const grade = toInt(student?.grade);
    return grade ? String(grade) : "";
  }

  function courseRankKey(student) {
    const grade = toInt(student?.grade);
    const sede = normalizeText(student?.sede || student?.registry?.sede || "");
    const group = normalizeText(student?.group || student?.registry?.group || "");
    return grade && group ? `${sede}|${grade}|${group}` : "";
  }

  function rankBaseScore(student) {
    // Ranking principal por puntaje global. Ojo: Number(null) da 0, por eso se valida
    // explicitamente null/undefined antes de convertir. Si el global tipo Saber no puede
    // calcularse por falta de alguna area, se usa un respaldo equivalente en escala /500
    // basado en el puntaje bruto del examen o en el promedio de areas presentadas.
    const globalValue = student?.globalScore;
    if (globalValue !== null && globalValue !== undefined && globalValue !== "" && Number.isFinite(Number(globalValue))) {
      return Number(globalValue);
    }
    const serverGlobal = student?.serverRank?.globalScore ?? state.rankingMetadataByRoll?.get(cleanId(student?.roll || student?.registry?.examId))?.globalScore;
    if (serverGlobal !== null && serverGlobal !== undefined && serverGlobal !== "" && Number.isFinite(Number(serverGlobal))) {
      return Number(serverGlobal);
    }
    const raw = student?.rawGlobalScore;
    if (raw !== null && raw !== undefined && raw !== "" && Number.isFinite(Number(raw))) {
      return Number(raw) * 5;
    }
    const scores = scoresForAllSubjectsAverage(student);
    if (!scores.length) return NaN;
    const total = scores.reduce((sum, value) => sum + Number(value), 0);
    return (total / scores.length) * 5;
  }

  function orderStudentsForRanking(students, scoreGetter = rankBaseScore) {
    return (students || [])
      .filter((student) => Number.isFinite(Number(scoreGetter(student))))
      .slice()
      .sort((a, b) => {
        const scoreDiff = Number(scoreGetter(b)) - Number(scoreGetter(a));
        if (scoreDiff) return scoreDiff;
        const correctDiff = Number(b.correct || 0) - Number(a.correct || 0);
        if (correctDiff) return correctDiff;
        const rawDiff = Number(b.rawGlobalScore || 0) - Number(a.rawGlobalScore || 0);
        if (rawDiff) return rawDiff;
        const nameDiff = displayListName(a).localeCompare(displayListName(b), "es", { sensitivity: "base", numeric: true });
        if (nameDiff) return nameDiff;
        return String(a.roll || "").localeCompare(String(b.roll || ""), "es", { numeric: true });
      });
  }

  function applyOrderedRanks(students, scope) {
    const ordered = orderStudentsForRanking(students);
    const count = ordered.length;
    ordered.forEach((student, index) => {
      const rank = index + 1;
      if (scope === "grade") {
        student.gradeCount = count;
        student.gradeRank = rank;
        student.percentile = count > 1 ? Math.round(((count - rank) / (count - 1)) * 100) : 100;
      } else if (scope === "course") {
        student.courseCount = count;
        student.courseRank = rank;
      }
    });
  }


  function findRankingStudentByRoll(roll) {
    const key = cleanId(roll);
    if (!key) return null;
    return state.computedByRoll?.get?.(key)
      || state.computedByRoll?.get?.(state.studentLogin?.get?.(key))
      || (state.computedStudents || []).find((student) => cleanId(student.roll) === key || (student.loginIds || []).some((id) => cleanId(id) === key))
      || null;
  }

  function sameRankCourse(student, targetSede, targetGrade, targetGroup) {
    if (!student || !targetGrade || !targetGroup) return false;
    const grade = toInt(student.grade);
    const sede = normalizeText(student.sede || student.registry?.sede || "");
    const group = normalizeText(student.group || student.registry?.group || "");
    return grade === targetGrade && sede === targetSede && group === targetGroup;
  }

  function rankInfoForRoll(rows, roll) {
    const key = cleanId(roll);
    const ordered = orderStudentsForRanking(rows || []);
    const index = ordered.findIndex((student) => cleanId(student.roll || student.registry?.examId) === key || (student.loginIds || []).some((id) => cleanId(id) === key));
    return { rank: index >= 0 ? index + 1 : null, count: ordered.length };
  }

  function studentIdentityIds(student, extra = []) {
    const ids = new Set();
    const add = (value) => {
      const clean = cleanId(value || "");
      if (clean) ids.add(clean);
    };
    add(student?.roll);
    add(student?.registry?.examId);
    add(student?.registry?.nationalId);
    add(student?.nationalId);
    (student?.loginIds || []).forEach(add);
    (extra || []).forEach(add);
    return ids;
  }

  function sameRankingStudent(a, b, extraA = [], extraB = []) {
    const aIds = studentIdentityIds(a, extraA);
    const bIds = studentIdentityIds(b, extraB);
    for (const id of aIds) if (bIds.has(id)) return true;
    return false;
  }

  function rankInfoForTarget(rows, target, loginKey = "") {
    const ordered = orderStudentsForRanking(rows || []);
    const targetIds = studentIdentityIds(target, [loginKey]);
    const index = ordered.findIndex((student) => {
      const ids = studentIdentityIds(student);
      for (const id of targetIds) if (ids.has(id)) return true;
      return false;
    });
    return { rank: index >= 0 ? index + 1 : null, count: ordered.length, ordered };
  }

  function debugSubjectScore(student, subject) {
    const stat = statForSubject(student, subject);
    const value = stat?.score;
    return Number.isFinite(Number(value)) ? Math.round(Number(value)) : null;
  }

  function debugMainAreaScores(student) {
    return {
      matematicas: debugSubjectScore(student, "Matem\u00e1ticas"),
      lenguaje: debugSubjectScore(student, "Lenguaje"),
      naturales: debugSubjectScore(student, "Ciencias Naturales"),
      sociales: debugSubjectScore(student, "Ciencias Sociales y Ciudadan\u00eda"),
      ingles: debugSubjectScore(student, "Ingl\u00e9s")
    };
  }

  function debugRowForRanking(student, index, target, loginKey = "") {
    const scores = debugMainAreaScores(student);
    const global = Number.isFinite(Number(student?.globalScore)) ? Number(student.globalScore) : null;
    const base = rankBaseScore(student);
    const missing = Object.entries(scores).filter(([, value]) => !Number.isFinite(Number(value))).map(([key]) => key);
    return {
      rank: index + 1,
      isTarget: sameRankingStudent(student, target, [loginKey], [loginKey]),
      roll: cleanId(student?.roll || student?.registry?.examId || ""),
      nationalId: cleanId(student?.registry?.nationalId || student?.nationalId || ""),
      name: student?.name || student?.registry?.name || "",
      sede: student?.sede || student?.registry?.sede || "",
      grade: toInt(student?.grade || student?.registry?.grade) || "",
      group: student?.group || student?.registry?.group || "",
      scores,
      globalScore: global,
      rankingScore: Number.isFinite(Number(base)) ? Math.round(Number(base)) : null,
      hasResult: studentHasRankingResult(student),
      source: student?.rankingOnly ? "respaldo/local" : "principal",
      notes: missing.length ? `Faltan areas: ${missing.join(", ")}` : ""
    };
  }

  function setStudentRankingDebug(roll, debug) {
    const key = cleanId(roll);
    if (!key) return;
    state.studentRankDebugByRoll.set(key, debug);
  }

  function getStudentRankingDebug(roll) {
    const key = cleanId(roll);
    return key ? state.studentRankDebugByRoll.get(key) : null;
  }

  function buildRankingDebugHtmlTable(rows, title, subtitle) {
    const value = (v) => (v === null || v === undefined || v === "" ? "\u2014" : v);
    const tableRows = (rows || []).map((row = {}) => {
      const scores = row.scores || {};
      const math = row.math ?? row.matematicas ?? row.MATEMATICAS ?? scores.matematicas ?? scores.math;
      const language = row.language ?? row.lenguaje ?? row.LENGUAJE ?? scores.lenguaje ?? scores.language;
      const natural = row.natural ?? row.naturales ?? row.ciencias_naturales ?? row.CIENCIAS_NATURALES ?? scores.naturales ?? scores.natural;
      const social = row.social ?? row.sociales ?? row.ciencias_sociales ?? row.CIENCIAS_SOCIALES ?? scores.sociales ?? scores.social;
      const english = row.english ?? row.ingles ?? row.INGLES ?? scores.ingles ?? scores.english;
      const pos = row.position ?? row.rank ?? row.posicion ?? row.puesto;
      return `
      <tr class="${row.isTarget ? "rank-debug-target" : ""}">
        <td>${esc(value(pos))}</td>
        <td>${row.isTarget ? "\u2605" : ""}</td>
        <td>${esc(value(row.roll || row.id_prueba))}</td>
        <td>${esc(value(row.nationalId || row.id_alumno || row.documento))}</td>
        <td>${esc(value(row.name || row.nombre))}</td>
        <td>${esc(value(row.sede))}</td>
        <td>${esc(value(row.grade || row.grado))}</td>
        <td>${esc(value(row.group || row.curso || row.grupo))}</td>
        <td>${esc(value(math))}</td>
        <td>${esc(value(language))}</td>
        <td>${esc(value(natural))}</td>
        <td>${esc(value(social))}</td>
        <td>${esc(value(english))}</td>
        <td><strong>${esc(value(row.globalScore ?? row.puntaje_global))}</strong></td>
        <td><strong>${esc(value(row.rankingScore ?? row.puntaje_orden ?? row.globalScore ?? row.puntaje_global))}</strong></td>
        <td>${esc(value(row.source || row.fuente))}</td>
        <td>${esc(value(row.notes || row.notas))}</td>
      </tr>`;
    }).join("");
    return `
      <section class="card card-pad rank-debug-table-card">
        <h3>${esc(title)}</h3>
        <p>${esc(subtitle || "")}</p>
        <div class="rank-debug-table-wrap">
          <table class="rank-debug-table">
            <thead>
              <tr>
                <th>Pos.</th><th>Yo</th><th>ID prueba</th><th>Documento</th><th>Nombre</th><th>Sede</th><th>Grado</th><th>Curso</th>
                <th>Mat.</th><th>Len.</th><th>Nat.</th><th>Soc.</th><th>Ing.</th><th>Global</th><th>Usado</th><th>Fuente</th><th>Notas</th>
              </tr>
            </thead>
            <tbody>${tableRows || `<tr><td colspan="17">No hay filas para este ranking.</td></tr>`}</tbody>
          </table>
        </div>
      </section>
    `;
  }

  function renderStudentRankingDebug(roll) {
    const key = cleanId(roll);
    const debug = getStudentRankingDebug(key);
    const student = state.computedByRoll.get(key) || findRankingStudentByRoll(key);
    if (!debug) {
      renderShell(`
        <div class="card card-pad empty-state rank-debug-screen">
          <h2>No se pudo construir el diagnostico de ranking</h2>
          <p>No hay datos de ranking guardados para el usuario <strong>${esc(key || "sin ID")}</strong>.</p>
          <button class="primary-btn" data-action="student-ranking-debug-refresh" data-roll="${escAttr(key)}">Reintentar diagnostico</button>
          <button class="ghost-btn" data-action="student-ranking-debug-next" data-roll="${escAttr(key)}">Continuar a resultados</button>
          <button class="ghost-btn" data-action="logout">Salir</button>
        </div>
      `, navFor("student"));
      return;
    }

    const warnings = (debug.warnings || []).map((item) => `<li>${esc(item)}</li>`).join("");
    const errors = (debug.errors || []).map((item) => `<li>${esc(item)}</li>`).join("");
    const target = debug.target || {};
    renderShell(`
      <section class="rank-debug-screen">
        <div class="card card-pad rank-debug-header">
          <div>
            <span class="eyebrow">Diagnostico de ranking</span>
            <h2>Verificacion antes de mostrar resultados</h2>
            <p>Esta pantalla muestra el universo real usado para calcular el ranking. La fila marcada con \u2605 es el estudiante que inicio sesion.</p>
          </div>
          <div class="rank-debug-actions">
            <button class="ghost-btn" data-action="student-ranking-debug-refresh" data-roll="${escAttr(key)}">Recalcular</button>
            <button class="primary-btn" data-action="student-ranking-debug-next" data-roll="${escAttr(key)}">Siguiente: ver resultados</button>
          </div>
        </div>

        <section class="rank-debug-grid">
          <article class="card card-pad">
            <h3>Estudiante detectado</h3>
            <dl class="rank-debug-dl">
              <dt>ID ingresado</dt><dd>${esc(debug.loginKey || key)}</dd>
              <dt>ID prueba resuelto</dt><dd>${esc(target.roll || "\u2014")}</dd>
              <dt>Documento</dt><dd>${esc(target.nationalId || "\u2014")}</dd>
              <dt>Nombre</dt><dd>${esc(target.name || student?.name || "\u2014")}</dd>
              <dt>Sede</dt><dd>${esc(target.sede || "\u2014")}</dd>
              <dt>Grado</dt><dd>${esc(target.grade || "\u2014")}</dd>
              <dt>Curso</dt><dd>${esc(target.group || "\u2014")}</dd>
            </dl>
          </article>
          <article class="card card-pad">
            <h3>Resultado calculado</h3>
            <dl class="rank-debug-dl">
              <dt>Puntaje global usado</dt><dd>${esc(debug.targetRankingScore ?? "\u2014")}</dd>
              <dt>Ranking grado</dt><dd>${esc(rankText(debug.gradeRank, debug.gradeCount))}</dd>
              <dt>Ranking curso</dt><dd>${esc(rankText(debug.courseRank, debug.courseCount))}</dd>
              <dt>Filas universo total</dt><dd>${esc(debug.counts?.pool ?? 0)}</dd>
              <dt>Filas mismo grado</dt><dd>${esc(debug.counts?.gradeRows ?? 0)}</dd>
              <dt>Filas mismo curso</dt><dd>${esc(debug.counts?.courseRows ?? 0)}</dd>
            </dl>
          </article>
          <article class="card card-pad">
            <h3>Debugger</h3>
            ${errors ? `<div class="debug-errors"><strong>Errores</strong><ul>${errors}</ul></div>` : `<p class="ok-pill">Sin errores criticos detectados.</p>`}
            ${warnings ? `<div class="debug-warnings"><strong>Advertencias</strong><ul>${warnings}</ul></div>` : `<p class="ok-pill">Sin advertencias.</p>`}
          </article>
        </section>

        ${buildRankingDebugHtmlTable(debug.gradeRows || [], "Tabla para ranking por grado", "Agrupa a todos los evaluados del mismo grado, sin importar sede ni curso.")}
        ${buildRankingDebugHtmlTable(debug.courseRows || [], "Tabla para ranking por curso", "Agrupa solo la misma sede + grado + curso del estudiante.")}

        <div class="rank-debug-footer card card-pad">
          <button class="primary-btn" data-action="student-ranking-debug-next" data-roll="${escAttr(key)}">Siguiente: ver pantalla normal del estudiante</button>
          <button class="ghost-btn" data-action="logout">Salir</button>
        </div>
      </section>
    `, navFor("student"));
  }

  async function prepareStudentRankingContext(roll) {
    const key = cleanId(roll);
    if (!key) return;
    clearSessionRankContext();
    const warnings = [];
    const errors = [];

    // v124: solución definitiva: el ranking se pide SOLO a una RPC SECURITY DEFINER de Supabase.
    // Esto evita 404/401 de funciones/tablas exploratorias y evita quedarse pegado.
    // Si esta RPC no existe, se muestra el diagnóstico con el error y no se inventa ranking.
    const rpcReady = await tryPrepareStudentRankingContextFromRpcV124(key, warnings, errors);
    if (rpcReady) return;

    errors.push("No se pudo cargar el ranking porque falta o falló la RPC roque_get_student_ranking_context. Ejecuta SUPABASE_RANKING_CONTEXT_V124.sql en Supabase y vuelve a iniciar sesión.");

    let target = findRankingStudentByRoll(key);
    if (!target && state.responsesByRoll?.has?.(key)) target = buildComputedStudentFromResultRecord({ ...state.responsesByRoll.get(key), roll: key }, 0);
    if (!target) {
      errors.push("No se encontro el estudiante en computedStudents ni en el payload del login.");
      setStudentRankingDebug(key, { loginKey: key, target: {}, warnings, errors, counts: { pool: 0, gradeRows: 0, courseRows: 0 }, gradeRows: [], courseRows: [] });
      return;
    }

    setStudentRankingDebug(key, {
      loginKey: key,
      target: {
        roll: cleanId(target.roll || target.registry?.examId || key),
        nationalId: cleanId(target.nationalId || target.registry?.nationalId || ""),
        name: cleanText(target.name || target.registry?.name || ""),
        sede: cleanText(target.sede || target.registry?.sede || ""),
        grade: toInt(target.grade || target.registry?.grade) || "",
        group: cleanText(target.group || target.registry?.group || "")
      },
      targetRankingScore: null,
      gradeRank: null,
      gradeCount: null,
      courseRank: null,
      courseCount: null,
      counts: { pool: 0, gradeRows: 0, courseRows: 0 },
      warnings,
      errors,
      gradeRows: [],
      courseRows: []
    });
    return;

    const localRegistry = state.rankingFallbackRegistryByExamId?.get?.(key)
      || state.rankingFallbackRegistryByNationalId?.get?.(cleanId(target.registry?.nationalId))
      || state.rankingFallbackRegistryByNationalId?.get?.(key)
      || state.rankingFallbackRegistryByExamId?.get?.(cleanId(target.registry?.examId));

    const targetGrade = toInt(target.grade) || toInt(localRegistry?.grade);
    const targetSedeRaw = target.sede || target.registry?.sede || localRegistry?.sede || "";
    const targetGroupRaw = target.group || target.registry?.group || localRegistry?.group || "";
    const targetSede = normalizeText(targetSedeRaw);
    const targetGroup = normalizeText(targetGroupRaw);

    if (!targetGrade) errors.push("No se pudo determinar el grado del estudiante.");
    if (!targetSede) warnings.push("No se pudo determinar la sede del estudiante; el ranking por curso puede quedar vacio.");
    if (!targetGroup) warnings.push("No se pudo determinar el curso del estudiante; el ranking por curso puede quedar vacio.");

    // v124: si el login trae solo el estudiante actual, se intenta pedir un contexto amplio
    // directamente a Supabase mediante RPC/tablas legibles. Luego se reconstruye el repositorio
    // para que buildRankingStudentsPool pueda cruzar estudiantes + resultados.
    try {
      const beforeResponses = state.responsesByRoll?.size || 0;
      await loadSupabaseRankingContextForStudent(target, key, { warnings, errors });
      if ((state.responsesByRoll?.size || 0) !== beforeResponses) buildRepository();
      const refreshedTarget = findRankingStudentByRoll(key);
      if (refreshedTarget) target = refreshedTarget;
    } catch (error) {
      warnings.push(`No se pudo ampliar el contexto de ranking desde Supabase: ${error?.message || error}`);
    }

    const pool = buildRankingStudentsPool()
      .filter((student) => studentHasRankingResult(student) && Number.isFinite(rankBaseScore(student)));

    if (!pool.length) errors.push("El universo temporal de ranking quedo vacio: no hay estudiantes con resultado y puntaje usable.");

    const gradeRows = targetGrade ? pool.filter((student) => toInt(student.grade) === targetGrade) : [];
    const courseRows = gradeRows.filter((student) => sameRankCourse(student, targetSede, targetGrade, targetGroup));

    if (targetGrade && !gradeRows.length) errors.push(`No aparecieron evaluados para el grado ${targetGrade}.`);
    if (targetGrade && targetSede && targetGroup && !courseRows.length) errors.push(`No aparecieron evaluados para el curso ${targetSedeRaw} / ${targetGrade} / ${targetGroupRaw}.`);

    const gradeInfo = rankInfoForTarget(gradeRows, target, key);
    const courseInfo = rankInfoForTarget(courseRows, target, key);

    if (!gradeInfo.rank) errors.push("El estudiante no aparecio dentro de la tabla de ranking por grado.");
    if (!courseInfo.rank) errors.push("El estudiante no aparecio dentro de la tabla de ranking por curso.");

    const meta = {
      globalScore: rankBaseScore(target),
      rawGlobalScore: target.rawGlobalScore,
      gradeRank: gradeInfo.rank,
      gradeCount: gradeInfo.count,
      courseRank: courseInfo.rank,
      courseCount: courseInfo.count
    };
    setSessionRankContext(key, meta);

    const visibleStudent = findRankingStudentByRoll(key);
    if (visibleStudent) {
      const visibleRoll = cleanId(visibleStudent.roll || visibleStudent.registry?.examId);
      if (visibleRoll && visibleRoll !== key) setSessionRankContext(visibleRoll, meta);
      applySessionRankContextToStudent(visibleStudent);
    }

    const orderedGrade = gradeInfo.ordered || [];
    const orderedCourse = courseInfo.ordered || [];
    const debug = {
      loginKey: key,
      target: {
        roll: cleanId(target.roll || target.registry?.examId || localRegistry?.examId || ""),
        nationalId: cleanId(target.registry?.nationalId || localRegistry?.nationalId || ""),
        name: target.name || target.registry?.name || localRegistry?.name || "",
        sede: targetSedeRaw,
        grade: targetGrade || "",
        group: targetGroupRaw
      },
      targetRankingScore: Number.isFinite(Number(rankBaseScore(target))) ? Math.round(Number(rankBaseScore(target))) : null,
      gradeRank: gradeInfo.rank,
      gradeCount: gradeInfo.count,
      courseRank: courseInfo.rank,
      courseCount: courseInfo.count,
      counts: {
        computedStudents: state.computedStudents?.length || 0,
        responsesByRoll: state.responsesByRoll?.size || 0,
        fallbackResponses: state.rankingFallbackResponsesByRoll?.size || 0,
        pool: pool.length,
        gradeRows: orderedGrade.length,
        courseRows: orderedCourse.length
      },
      warnings,
      errors,
      gradeRows: orderedGrade.map((student, index) => debugRowForRanking(student, index, target, key)),
      courseRows: orderedCourse.map((student, index) => debugRowForRanking(student, index, target, key))
    };
    setStudentRankingDebug(key, debug);

    // Se descarta el universo bruto local. Quedan solo variables finales y la tabla reducida de diagnostico de esta sesion.
    clearRankingFallbackData();
  }

  function openAdminStatsView(event = null) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
      if (event.stopImmediatePropagation) event.stopImmediatePropagation();
    }
    state.adminTab = "estadisticas";
    renderAdminContext();
  }

  function updateAdminStatsFromElement(event = null, element = null) {
    const target = element || event?.target;
    if (!target?.dataset?.adminStatsField) return;
    if (event) {
      event.preventDefault();
      event.stopPropagation();
      if (event.stopImmediatePropagation) event.stopImmediatePropagation();
    }
    setAdminStatsField(target.dataset.adminStatsField, target.value);
    state.adminTab = "estadisticas";
    renderAdminContext();
  }

  window.__poOpenAdminStats = openAdminStatsView;
  window.__poAdminStatsFieldFromElement = updateAdminStatsFromElement;

  function handleCriticalStatsClick(event) {
    const target = event.target.closest?.('[data-force-admin-stats="true"], [data-tab="estadisticas"]');
    if (!target) return;
    openAdminStatsView(event);
  }

  function handleCriticalStatsChange(event) {
    const target = event.target.closest?.('[data-admin-stats-field]');
    if (!target) return;
    updateAdminStatsFromElement(event, target);
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
      const roll = cleanId(state.activeSession.roll);
      if (state.activeSession.rankingDebugRequested && (!state.activeSession.rankingDebugDone || state.activeSession.rankingDebugVersion !== "v135")) {
        return showStudentRankingDebugGate(roll, "Reconstruyendo diagnóstico de ranking...");
      }
      return renderStudent(roll);
    }

    renderLogin();
  }

  function enterStudentSessionWithRankingMode(roll, options = {}) {
    const cleanRoll = cleanId(roll);
    const debug = !!options.debug;
    const message = options.message || (debug ? "Preparando diagnóstico de ranking..." : "Calculando ranking y preparando resultados...");
    state.selectedSubject = null;
    state.metricTab = "components";
    state.zeroToleranceShown = false;
    const session = {
      role: "student",
      roll: cleanRoll,
      rankingDebugRequested: debug,
      rankingDebugDone: !debug,
      rankingDebugVersion: "v135"
    };
    state.activeSession = session;
    writeJSON(STORAGE.session, state.activeSession);
    rememberRecentLogin(session);
    fadeAppOut();
    showRouteLoader(message);
    window.setTimeout(async () => {
      try {
        await prepareStudentRankingContext(cleanRoll);
        if (debug) {
          state.activeSession = { ...(state.activeSession || session), rankingDebugRequested: true, rankingDebugDone: false, rankingDebugVersion: "v135" };
          writeJSON(STORAGE.session, state.activeSession);
          renderStudentRankingDebug(cleanRoll);
        } else {
          renderStudent(cleanRoll);
        }
      } catch (error) {
        console.error(error);
        if (debug) {
          renderStudentRankingDebug(cleanRoll);
        } else {
          renderStudent(cleanRoll);
        }
      } finally {
        fadeAppIn();
        window.setTimeout(hideRouteLoader, 180);
      }
    }, 420);
  }

  async function showStudentRankingDebugGate(roll, message = "Preparando diagnóstico de ranking...") {
    const cleanRoll = cleanId(roll);
    if (!cleanRoll) return renderLogin("No se pudo identificar el estudiante para ranking.");
    const existing = getStudentRankingDebug(cleanRoll);
    if (existing) return renderStudentRankingDebug(cleanRoll);
    renderShell(`
      <div class="boot rank-debug-loading">
        <div class="boot-mark"></div>
        <h1>${esc(message)}</h1>
        <p>Estoy armando las tablas temporales de grado y curso antes de mostrar resultados.</p>
      </div>
    `, navFor("student"));
    await prepareStudentRankingContext(cleanRoll);
    return renderStudentRankingDebug(cleanRoll);
  }

  function adminTabIds() {
    return new Set(["resumen", "estudiantes", "resultados", "estadisticas", "docentes", "mapa-grado", "examenes-huerfanos", "alerta-sesiones", "matriz-estudiantes", "asignaturas-areas", "apariencia", "logos", "claves", "github"]);
  }

  function handleHashRoute() {
    // Las pestañas ya no modifican la URL.
  }

  function getRecentLogins() {
    const list = readJSON(STORAGE.recentLogins, []);
    if (!Array.isArray(list)) return [];
    return list
      .filter((item) => item && item.key && item.session && item.session.role)
      .slice(0, 4);
  }

  function recentLoginKey(session) {
    if (!session || !session.role) return "";
    if (session.role === "admin") return "admin:admin";
    if (session.role === "teacher") return `teacher:${cleanId(session.id)}`;
    if (session.role === "student") return `student:${cleanId(session.roll)}`;
    return "";
  }

  function initialsFor(name, fallback = "U") {
    const parts = cleanText(name).split(/\s+/).filter(Boolean);
    if (!parts.length) return fallback.slice(0, 2).toUpperCase();
    const first = parts[0]?.[0] || "";
    const last = parts.length > 1 ? parts[parts.length - 1]?.[0] || "" : "";
    return `${first}${last || (parts[0]?.[1] || "")}`.toUpperCase();
  }

  function describeRecentSession(session, stored = {}) {
    if (!session || !session.role) return null;

    if (session.role === "admin") {
      return {
        title: "Administrador",
        detail: "Panel de administración",
        initials: "AD"
      };
    }

    if (session.role === "teacher") {
      const id = cleanId(session.id);
      const teacher = state.teachers.get(id);
      const title = cleanText(teacher?.name) || cleanText(stored.title) || `Docente ${id}`;
      const hasGroups = (teacher?.directorGroups || []).length;
      const hasAssignments = (teacher?.assignments || []).length;
      const detail = teacher?.coordinator
        ? "Coordinación"
        : hasGroups && !hasAssignments
          ? "Dirección de grupo"
          : "Vista docente";
      return { title, detail, initials: initialsFor(title, "DO") };
    }

    if (session.role === "student") {
      const roll = cleanId(session.roll);
      const student = state.computedByRoll.get(roll);
      const title = cleanText(student?.name) || cleanText(stored.title) || `Estudiante ${roll}`;
      const details = [];
      if (student?.grade) details.push(`${student.grade}°`);
      if (student?.group) details.push(student.group);
      if (student?.sede) details.push(student.sede);
      return {
        title,
        detail: details.join(" · ") || "Vista estudiante",
        initials: initialsFor(title, "ES")
      };
    }

    return null;
  }

  function rememberRecentLogin(session) {
    const key = recentLoginKey(session);
    if (!key) return;
    const info = describeRecentSession(session);
    if (!info) return;
    const record = {
      key,
      session: { ...session },
      title: info.title,
      detail: info.detail,
      initials: info.initials,
      savedAt: new Date().toISOString()
    };
    const next = [record, ...getRecentLogins().filter((item) => item.key !== key)].slice(0, 4);
    writeJSON(STORAGE.recentLogins, next);
  }

  function removeRecentLogin(key) {
    const next = getRecentLogins().filter((item) => item.key !== key);
    writeJSON(STORAGE.recentLogins, next);
    renderLogin();
  }

  function renderRecentLoginsHtml() {
    const items = getRecentLogins();
    if (!items.length) return "";
    return `
      <div class="recent-login-grid" aria-label="Últimas cuentas">
        ${items.map((item) => {
          const info = describeRecentSession(item.session, item) || item;
          return `
            <div class="recent-login-card">
              <button type="button" class="recent-login-main" data-action="quick-login" data-login-key="${escAttr(item.key)}" title="Ingresar como ${escAttr(info.title)}">
                <span class="recent-login-avatar">${esc(info.initials || "U")}</span>
                <span class="recent-login-text">
                  <strong>${esc(info.title || item.title || "Usuario")}</strong>
                  <small>${esc(info.detail || item.detail || "Ingreso reciente")}</small>
                </span>
              </button>
              <button type="button" class="recent-login-remove" data-action="remove-recent-login" data-login-key="${escAttr(item.key)}" aria-label="Quitar ${escAttr(info.title || item.title || "usuario")}">×</button>
            </div>
          `;
        }).join("")}
      </div>
    `;
  }

  const LOGIN_ACCESS_EXAMPLES = [
    { first: "Ruben", rest: "Andres Enciso Lopez", idPrefix: "123456", idLast: "7890", user: "ruben7890" },
    { first: "Alain", rest: "Junior Cassis", idPrefix: "516313", idLast: "1110", user: "alain1110" },
    { first: "Peggy", rest: "Castillo Pacheco", idPrefix: "12345", idLast: "6781", user: "peggy6781" },
    { first: "Aydee", rest: "Cuadros Martinez", idPrefix: "98765", idLast: "4321", user: "aydee4321" },
    { first: "Kelly", rest: "Murgas Castillos", idPrefix: "45786", idLast: "5231", user: "kelly5231" }
  ];

  function renderLoginAccessGuide() {
    const sample = LOGIN_ACCESS_EXAMPLES[0];
    return `
      <div class="login-access-guide access-story-v96" aria-hidden="true" data-access-example-index="0">
        <div class="access-v96-ambient access-v96-ambient-a"></div>
        <div class="access-v96-ambient access-v96-ambient-b"></div>
        <div class="access-v96-glyph access-v96-glyph-x">×</div>
        <div class="access-v96-glyph access-v96-glyph-ring"></div>
        <div class="access-v96-glyph access-v96-glyph-triangle"></div>

        <div class="access-v96-stage">
          <article class="access-v96-card">
            <div class="access-v96-card-grid"></div>
            <div class="access-v96-card-sheen"></div>
            <header class="access-v96-card-head">
              <span>Roque Objetiva</span>
              <strong>Acceso</strong>
            </header>
            <div class="access-v96-card-body">
              <div class="access-v96-photo"><span>😎</span></div>
              <div class="access-v96-info">
                <small>Nombre completo</small>
                <div class="access-v96-name-line">
                  <span class="access-v96-source-name" data-access-part="first">${esc(sample.first)}</span>
                  <span class="access-v96-muted-part" data-access-part="rest">${esc(sample.rest)}</span>
                </div>
                <small>Documento / ID</small>
                <div class="access-v96-id-line">
                  <span class="access-v96-muted-part" data-access-part="idPrefix">${esc(sample.idPrefix)}</span><span class="access-v96-source-id" data-access-part="idLast">${esc(sample.idLast)}</span>
                </div>
              </div>
            </div>
            <footer class="access-v96-card-foot">
              <i></i><i></i><i></i>
            </footer>
          </article>

          <div class="access-v96-caption" aria-hidden="true">
            <span class="access-v96-caption-line access-v96-caption-line-main">Tu usuario es</span>
            <span class="access-v96-caption-line">tu primer nombre <b>+</b> los 4 últimos dígitos</span>
            <small class="access-v96-caption-line access-v96-caption-line-sub">de tu tarjeta de identidad o cédula</small>
          </div>
          <div class="access-v96-token access-v96-token-name" data-access-part="tokenName">${esc(sample.first.toLowerCase())}</div>
          <div class="access-v96-token access-v96-token-id" data-access-part="tokenId">${esc(sample.idLast)}</div>
          <div class="access-v96-plus">+</div>
          <div class="access-v96-result" data-access-part="result">${esc(sample.user)}</div>
        </div>
      </div>
    `;
  }

  function initLoginAccessGuide() {
    const guide = document.querySelector(".login-access-guide.access-story-v96");
    if (!guide || guide.dataset.accessGuideReady === "1") return;
    guide.dataset.accessGuideReady = "1";

    const cycleMs = 12500;
    const updateCardAtMs = 7600;   // El carne esta atras, opaco y difuminado.
    const updateTokensAtMs = 11900; // Los tokens ya no se ven; queda listo el siguiente ciclo.

    const writeParts = (parts) => {
      Object.entries(parts).forEach(([key, value]) => {
        guide.querySelectorAll(`[data-access-part="${key}"]`).forEach((node) => {
          node.textContent = value;
        });
      });
    };

    const setCardExample = (sample) => {
      writeParts({
        first: sample.first,
        rest: sample.rest,
        idPrefix: sample.idPrefix,
        idLast: sample.idLast
      });
    };

    const setTokenExample = (sample, index) => {
      guide.dataset.accessExampleIndex = String(index);
      writeParts({
        tokenName: sample.first.toLowerCase(),
        tokenId: sample.idLast,
        result: sample.user
      });
    };

    const randomNextIndex = (currentIndex) => {
      if (LOGIN_ACCESS_EXAMPLES.length <= 1) return 0;
      let next = currentIndex;
      while (next === currentIndex) {
        next = Math.floor(Math.random() * LOGIN_ACCESS_EXAMPLES.length);
      }
      return next;
    };

    let activeIndex = 0;
    let queuedIndex = randomNextIndex(activeIndex);
    setCardExample(LOGIN_ACCESS_EXAMPLES[activeIndex]);
    setTokenExample(LOGIN_ACCESS_EXAMPLES[activeIndex], activeIndex);

    const scheduleCycle = () => {
      window.setTimeout(() => {
        // Cambia el carne mientras esta difuminado al fondo; asi reaparece con el nuevo nombre.
        setCardExample(LOGIN_ACCESS_EXAMPLES[queuedIndex]);
      }, updateCardAtMs);

      window.setTimeout(() => {
        // Prepara las plaquitas del siguiente ciclo cuando estan invisibles.
        activeIndex = queuedIndex;
        setTokenExample(LOGIN_ACCESS_EXAMPLES[activeIndex], activeIndex);
        queuedIndex = randomNextIndex(activeIndex);
      }, updateTokensAtMs);
    };

    scheduleCycle();
    window.setInterval(scheduleCycle, cycleMs);
  }

  function startRecentLogin(key) {
    const item = getRecentLogins().find((entry) => entry.key === key);
    if (!item || !item.session) return renderLogin("No se encontró ese ingreso reciente.");
    const session = item.session;

    if (SUPABASE_CONFIG.enabled) {
      if (session.role === "admin") return renderLogin("Por seguridad, vuelve a escribir la contraseña de administrador.");
      if (session.role === "teacher") return loginWithSupabase(cleanId(session.id), "");
      if (session.role === "student") return loginWithSupabase(cleanId(session.roll), "");
    }

    if (session.role === "admin") {
      state.adminTab = "resumen";
      state.zeroToleranceShown = false;
      return enterSessionWithLoader({ role: "admin", id: "admin" }, () => renderAdmin(), "Abriendo panel de administración...");
    }

    if (session.role === "teacher") {
      const id = cleanId(session.id);
      const teacher = state.teachers.get(id);
      if (!teacher) {
        removeRecentLogin(key);
        return renderLogin("Ese docente ya no aparece en la carga actual.");
      }
      state.teacherActive = null;
      state.teacherMode = "asignaturas";
      state.teacherDirectorActiveKey = "";
      if (!(teacher?.assignments || []).length && (teacher?.directorGroups || []).length) state.teacherMode = "director";
      if (!(teacher?.assignments || []).length && !(teacher?.directorGroups || []).length && teacher?.coordinator) state.teacherMode = "coord-estudiantes";
      state.zeroToleranceShown = false;
      return enterSessionWithLoader({ role: "teacher", id }, () => renderTeacher(teacher), "Preparando vista docente...");
    }

    if (session.role === "student") {
      const roll = cleanId(session.roll);
      if (!state.computedByRoll.has(roll) && !state.responsesByRoll.has(roll) && !state.studentLogin.has(roll)) {
        removeRecentLogin(key);
        return renderLogin("Ese estudiante ya no aparece en los resultados actuales.");
      }
      return enterStudentSessionWithRankingMode(roll, { debug: wantsRankingDebug, message: wantsRankingDebug ? "Preparando diagnóstico de ranking..." : "Calculando ranking y preparando resultados..." });
    }

    renderLogin("No se pudo abrir ese ingreso reciente.");
  }

  function renderLogin(error = "") {
    const primary = normalizeColor(state.config.primaryColor || "#1975ae");
    const primaryDark = shadeColor(primary, -26);
    const primaryDeep = shadeColor(primary, -52);
    const primarySoft = mixWithWhite(primary, 34);
    const rgb = hexToRgb(primary);
    document.documentElement.style.setProperty("--button-radius", `${Number(state.config.cornerRadius ?? state.config.buttonRadius ?? 4)}px`);
    document.documentElement.style.setProperty("--corner-radius", `${Number(state.config.cornerRadius ?? state.config.buttonRadius ?? 4)}px`);
    document.documentElement.style.setProperty("--logo-zoom", `${Number(state.config.logoZoom ?? 1)}`);
    document.documentElement.style.setProperty("--orange", primary);
    document.documentElement.style.setProperty("--orange-2", primarySoft);
    document.documentElement.style.setProperty("--orange-3", primaryDark);
    document.documentElement.style.setProperty("--primary", primary);
    document.documentElement.style.setProperty("--primary-soft", primarySoft);
    document.documentElement.style.setProperty("--login-deep", primaryDeep);
    document.documentElement.style.setProperty("--primary-rgb", `${rgb.r}, ${rgb.g}, ${rgb.b}`);
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", primaryDark);
    applyAppMeta(primaryDark);
    const logo = state.config.logoImage || "assets/logo-principal.png";
    const recentLoginsHtml = renderRecentLoginsHtml();
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
            <p>Ingresa con el ID de tu prueba o tu número de documento de identidad.</p>
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
              </div>
            </form>
            ${recentLoginsHtml}
          </div>
        </div>
      </section>
    `;
    if (!window.matchMedia || !window.matchMedia("(max-width: 680px)").matches) {
      setTimeout(() => document.getElementById("loginUser")?.focus(), 50);
    }
  }

  function zeroToleranceLogoHtml() {
    return `
      <div class="zt-logo-image-wrap" aria-label="Zero Tolerance">
        <img class="zt-logo-image" src="assets/ZERO.png" alt="ZERO TOLERANCE">
      </div>
    `;
  }

  function openZeroToleranceModal() {
    const copy = [
      "Las respuestas con doble marca se anulan.",
      "Los tachones, enmendaduras o correcciones mal hechas no se tienen en cuenta.",
      "Las marcas fuera del espacio indicado no son válidas.",
      "Los ítems sin responder no se califican.",
      "Solo se califican respuestas limpias, claras y correctamente marcadas."
    ];
    modalRoot.innerHTML = `
      <div class="modal-backdrop zero-tolerance-backdrop" data-action="close-modal">
        <section class="modal zero-tolerance-modal">
          <div class="modal-head zero-tolerance-head">
            <div>
              <h2>Advertencia de calificación</h2>
              <span class="zt-subhead">Lee esto antes de revisar tus resultados.</span>
            </div>
            <button type="button" class="icon-btn" data-action="close-modal" aria-label="Cerrar">×</button>
          </div>
          <div class="modal-body zero-tolerance-body">
            ${zeroToleranceLogoHtml()}
            <p class="zt-lead">Para prepararte frente a estándares exigentes como ICFES, Saber y Misión Saber, esta evaluación fue revisada con un sistema <strong>automatizado y riguroso</strong>. Por eso, cualquier marca dudosa, ambigua o fuera del formato se invalida.</p>
            <div class="zt-rules">
              <div class="zt-rule zt-bad">✘ <span>${copy[0]}</span></div>
              <div class="zt-rule zt-bad">✘ <span>${copy[1]}</span></div>
              <div class="zt-rule zt-bad">✘ <span>${copy[2]}</span></div>
              <div class="zt-rule zt-bad">✘ <span>${copy[3]}</span></div>
              <div class="zt-rule zt-good">✔ <span>${copy[4]}</span></div>
            </div>
            <p class="zt-footer-note">La precisión también se entrena. Responder con orden y cuidado mejora tus resultados.</p>
            <div class="zero-tolerance-actions">
              <button class="primary-btn" data-action="close-modal">ACEPTAR</button>
            </div>
          </div>
        </section>
      </div>
    `;
    document.body.classList.add("modal-open");
  }

  function renderPlayShapes(prefix = "banner", stars = false) {
    const shapes = ["x", "square", "tri", "circle"];
    const variants = ["", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve"];
    const symbols = stars
      ? { x: "★", square: "✦", tri: "✧", circle: "✷" }
      : { x: "×", square: "□", tri: "△", circle: "○" };
    return variants.map((variant, index) => {
      const shape = shapes[index % shapes.length];
      return `<span class="shape ${stars ? "star" : ""} ${shape} ${variant}" aria-hidden="true">${symbols[shape]}</span>`;
    }).join("");
  }

  function studentBannerTone(student) {
    const ranks = [student?.courseRank, student?.gradeRank]
      .map((value) => Number(value))
      .filter((value) => Number.isFinite(value) && value > 0);
    if (ranks.includes(1)) return "banner-rank-gold";
    if (ranks.includes(2)) return "banner-rank-silver";
    if (ranks.includes(3)) return "banner-rank-bronze";
    return "";
  }

  function renderShell(content, nav = "", bannerToneClass = "") {
    const cfg = state.config;
    const primary = normalizeColor(cfg.primaryColor || "#1975ae");
    const primaryDark = shadeColor(primary, -18);
    const primarySoft = mixWithWhite(primary, 34);
    const rgb = hexToRgb(primary);
    document.documentElement.style.setProperty("--orange", primary);
    document.documentElement.style.setProperty("--orange-2", primarySoft);
    document.documentElement.style.setProperty("--orange-3", primaryDark);
    document.documentElement.style.setProperty("--primary", primary);
    document.documentElement.style.setProperty("--primary-soft", primarySoft);
    document.documentElement.style.setProperty("--primary-rgb", `${rgb.r}, ${rgb.g}, ${rgb.b}`);
    document.documentElement.style.setProperty("--button-radius", `${Number(cfg.cornerRadius ?? cfg.buttonRadius ?? 4)}px`);
    document.documentElement.style.setProperty("--corner-radius", `${Number(cfg.cornerRadius ?? cfg.buttonRadius ?? 4)}px`);
    document.documentElement.style.setProperty("--logo-zoom", `${Number(cfg.logoZoom ?? 1)}`);
    document.documentElement.removeAttribute("data-theme");
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", primary);
    applyAppMeta(primary);
    const bannerStyle = `style="background: linear-gradient(105deg, ${primary} 0%, ${primary} 42%, ${primaryDark} 100%)"`;
    const isMedalBanner = ["banner-rank-gold", "banner-rank-silver", "banner-rank-bronze"].includes(bannerToneClass);
    const bannerClass = isMedalBanner ? ` ${bannerToneClass}` : "";
    app.innerHTML = `
      <div class="app-shell">
        <header class="top-banner${bannerClass}" ${bannerStyle}>
          <div class="banner-shapes ${isMedalBanner ? "banner-stars" : ""}" aria-hidden="true">
            ${renderPlayShapes("banner", isMedalBanner)}
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
    applySessionRankContextToStudent(student);
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
      const percent = Number.isFinite(Number(s.score)) ? clamp(Number(s.score), 0, 100) : 0;
      return `
        <article class="subject-list-item ${active ? "active" : ""}">
          <button class="subject-row subject-row-grid-card" data-action="select-subject" data-subject="${escAttr(item.name)}" aria-expanded="${active ? "true" : "false"}">
            <span class="subject-card-main">
              ${subjectIcon(item.name)}
              <span class="subject-card-text">
                <span class="subject-card-title">${esc(item.short || item.name)}</span>
                <span class="subject-card-scoreline">
                  ${scoreDisplayHtml(s, "subject-score", true)}
                  <span class="subject-chevron" aria-hidden="true">⌄</span>
                </span>
              </span>
            </span>
            <span class="subject-card-progress" aria-hidden="true" style="--score:${percent}%;"><i style="width:${percent}%"></i></span>
          </button>
          <div class="subject-mobile-detail">
            <div class="subject-mobile-detail-inner">
              ${active ? buildSubjectDetailHtml(student, item.name, s, true) : ""}
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
    `, navFor("student"), studentBannerTone(student));
    if (!state.zeroToleranceShown) {
      state.zeroToleranceShown = true;
      window.setTimeout(() => openZeroToleranceModal(), 260);
    }
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

  function isMobileViewport() {
    return window.matchMedia && window.matchMedia("(max-width: 940px)").matches;
  }

  function openStudentSubjectModal(subject) {
    openStudentSubjectModalForRoll(state.activeSession?.roll, subject, false);
  }

  function openStudentSubjectModalForRoll(roll, subject, showCorrect = false) {
    const student = state.computedByRoll.get(cleanId(roll));
    if (!student || !subject) return;
    const stat = student.subjectStats?.[subject];
    if (!stat?.total) return;
    state.metricTab = "components";
    document.body.classList.add("modal-open");
    modalRoot.innerHTML = `
      <div class="modal-backdrop student-subject-modal-backdrop" data-action="close-modal">
        <section class="modal student-subject-modal" style="max-width:760px;">
          <div class="modal-head">
            <div>
              <h2>${esc(subject)}</h2>
              <span style="color:#7d8089;font-weight:600;">${esc(student.name)} · ${esc(student.grade)}° ${esc(student.group || "")}</span>
            </div>
            <button type="button" class="icon-btn" data-action="close-modal" aria-label="Cerrar">×</button>
          </div>
          <div class="modal-body">
            ${buildSubjectDetailHtml(student, subject, stat, true, showCorrect)}
          </div>
        </section>
      </div>
    `;
  }

  function openAdminStudentReportModal(roll) {
    const student = state.computedByRoll.get(cleanId(roll));
    if (!student) {
      toast("Este estudiante no tiene resultados cargados.");
      return;
    }
    const subjects = SUBJECTS.filter((subject) => student.subjectStats[subject.name]?.total);
    const cards = subjects.map((subject) => {
      const stat = student.subjectStats[subject.name];
      const percent = Number.isFinite(Number(stat.score)) ? clamp(Number(stat.score), 0, 100) : 0;
      return `
        <button class="subject-row subject-row-grid-card admin-student-subject-card" data-action="admin-student-subject" data-roll="${escAttr(student.roll)}" data-subject="${escAttr(subject.name)}">
          <span class="subject-card-main">
            ${subjectIcon(subject.name)}
            <span class="subject-card-text">
              <span class="subject-card-title">${esc(subject.short || subject.name)}</span>
              <span class="subject-card-scoreline">${scoreDisplayHtml(stat, "subject-score", true)}<span class="subject-chevron">⌄</span></span>
            </span>
          </span>
          <span class="subject-card-progress" aria-hidden="true" style="--score:${percent}%;"><i style="width:${percent}%"></i></span>
        </button>
      `;
    }).join("");
    document.body.classList.add("modal-open");
    modalRoot.innerHTML = `
      <div class="modal-backdrop admin-student-report-backdrop" data-action="close-modal">
        <section class="modal admin-student-report-modal" style="max-width:1040px;">
          <div class="modal-head">
            <div>
              <h2>${esc(student.name)}</h2>
              <span style="color:#7d8089;font-weight:600;">ID ${esc(student.roll)} · ${esc(student.sede || "—")} · ${esc(student.grade)}° ${esc(student.group || "")}</span>
            </div>
            <button type="button" class="icon-btn" data-action="close-modal" aria-label="Cerrar">×</button>
          </div>
          <div class="modal-body">
            <section class="student-summary card admin-student-summary">
              <div class="summary-score-block saber-score-block"><div class="score-label"><span class="score-icon">🏆</span><span>Puntaje global tipo Saber</span></div><div class="score-number">${student.globalScore ?? "—"}<small>/500</small></div></div>
              <div class="summary-info-block">
                <div class="student-identity"><span>Alumno</span><strong>${esc(student.name)}</strong></div>
                <div class="student-identity"><span>Identificación</span><strong>${esc(student.registry?.nationalId || student.roll)}</strong></div>
                <div class="student-identity"><span>Grado y curso</span><strong>${esc(student.grade)}° · ${esc(student.group)}</strong></div>
                <div class="student-identity"><span>Sede</span><strong>${esc(student.sede)}</strong></div>
              </div>
            </section>
            <h3 style="margin:16px 0 10px;font-weight:900;">Puntaje por pruebas</h3>
            <div class="subject-list admin-student-subject-grid">${cards || `<div class="empty-state">No hay asignaturas calculadas para este estudiante.</div>`}</div>
          </div>
        </section>
      </div>
    `;
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
        <div class="empty-subject-icon">↑</div>
        <h3>Selecciona una asignatura</h3>
        <p>Al tocar una prueba se abrirá aquí su detalle, con las opciones marcadas y el análisis por componentes y competencias.</p>
      </div>
    `;
  }

  function buildSubjectDetailHtml(student, subject, stat, compact = false, showCorrect = false) {
    if (!stat) return `<div class="empty-state">No hay información para esta asignatura.</div>`;
    const detailRows = (stat.details || []).map((detail) => answerPill(detail, student.roll, detail.item, showCorrect)).join("");
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
          <div class="subject-detail-score-wrap">${scoreDisplayHtml(stat, "subject-detail-score", true)}</div>
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
        ${(() => {
          const info = subjectItemValue(student.grade, subject, stat);
          return info.total ? `<div class="item-value-note"><span>Valor de cada ítem</span><strong>${esc(info.label)} puntos</strong><small>Si presentó la prueba, la nota se calcula desde 20 hasta 100. Si no aparece en la sesión correspondiente, se registra como 0.</small></div>` : "";
        })()}

        ${subjectMetricBlockHtml(stat.details || [], activeMetric)}
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
    const isCoordinator = !!teacher.coordinator;

    if (state.teacherMode === "coord-graficas") state.teacherMode = "coord-estudiantes";
    if (isCoordinator && String(state.teacherMode || "").startsWith("coord-")) {
      return renderCoordinatorPanel(teacher);
    }
    if (!hasAssignments && hasDirector) state.teacherMode = "director";
    if (!hasDirector && state.teacherMode === "director") state.teacherMode = hasAssignments ? "asignaturas" : (isCoordinator ? "coord-estudiantes" : "asignaturas");
    if (!state.teacherMode) state.teacherMode = hasAssignments ? "asignaturas" : (hasDirector ? "director" : (isCoordinator ? "coord-estudiantes" : "asignaturas"));

    if (state.teacherMode === "director" && hasDirector) {
      return renderTeacherDirector(teacher);
    }
    return renderTeacherAssignments(teacher);
  }

  function renderCoordinatorPanel(teacher) {
    const mode = state.teacherMode || "coord-estudiantes";
    let title = "Estudiantes";
    let content = adminStudentsHtml();
    if (mode === "coord-resultados") {
      title = "Resultados";
      content = adminResultsHtml();
    } else if (mode === "coord-estadisticas") {
      title = "Estadísticas";
      content = safeAdminStatsHtml();
    } else if (mode === "coord-claves") {
      title = "Claves";
      content = adminKeysHtml();
    }
    renderShell(`
      <section class="toolbar teacher-toolbar">
        <div>
          <span class="section-eyebrow">Coordinación académica</span>
          <h2 style="margin:8px 0 0;font-size:clamp(1.4rem,4vw,2.2rem);font-weight:900;letter-spacing:-.04em;">${esc(teacher.name || "Coordinador")}</h2>
          <p class="teacher-active-label">${esc(title)} · vistas administrativas habilitadas</p>
        </div>
      </section>
      <section class="coordinator-admin-panel">${content}</section>
    `, navFor("teacher"));
  }

  function teacherModeTabs(teacher, activeMode) {
    return "";
  }

  function renderTeacherAssignments(teacher) {
    const assignments = teacher.assignments || [];
    if (!state.teacherActive || !assignments.some((a) => a.key === state.teacherActive.key)) {
      state.teacherActive = assignments.find((assignment) => state.computedStudents.some((student) => teacherAssignmentMatches(student, assignment))) || assignments[0] || null;
    }

    const active = state.teacherActive;
    const activeResolvedSubject = active ? subjectNameForAssignment(active) : "";
    const groupedAssignments = groupAssignmentsBySubject(assignments);
    const activeSubject = activeResolvedSubject || active?.subject || groupedAssignments[0]?.subject || "";
    const activeSubjectGroup = groupedAssignments.find((group) => sameSubject(group.subject, activeSubject)) || groupedAssignments[0] || null;
    const visibleGradeAssignments = (activeSubjectGroup?.assignments || assignments.filter((assignment) => sameSubject(subjectNameForAssignment(assignment), activeSubject) || sameSubject(assignment.subject, activeSubject))).slice();

    const subjectButtons = groupedAssignments.map((group) => `
      <button class="tab-btn teacher-subject-tab ${sameSubject(activeSubject, group.subject) ? "active" : ""}" data-action="teacher-subject" data-subject="${escAttr(group.subject)}">
        ${esc(group.subject)}
      </button>
    `).join("");

    const groupButtons = visibleGradeAssignments.map((a) => `
      <button class="tab-btn teacher-group-tab ${active?.key === a.key ? "active" : ""}" data-action="teacher-assignment" data-key="${escAttr(a.key)}" data-grade="${escAttr(a.grade)}" data-subject="${escAttr(a.subjectRaw || a.subject)}" data-group="${escAttr(a.group || "")}" data-sede="${escAttr(a.sede || "")}">
        ${esc(a.grade)}°${a.group ? ` · ${esc(a.group)}` : ""}${a.sede ? ` · ${esc(a.sede)}` : ""}
      </button>
    `).join("");

    const students = active
      ? state.computedStudents.filter((student) => teacherAssignmentMatches(student, active))
      : [];

    const filtered = sortRowsByState(students, "teacher-active", (student, key) => {
      const stat = active ? statForSubject(student, active) || {} : {};
      if (key === "score") return stat.score;
      if (key === "correct") return stat.correct;
      return displayListName(student);
    });

    const activeStatForValue = active ? filtered.map((student) => statForSubject(student, active)).find(Boolean) || null : null;
    const activeSubjectForStats = activeStatForValue?.subject || activeSubject || active?.subject || "";
    const statsSubject = activeSubjectForStats || active?.subject || "";
    const studentsForStats = active ? evaluatedStudentsForSubject(filtered, statsSubject) : [];
    const teacherScoreValues = scoresForSubjectAverage(studentsForStats, statsSubject);
    const itemValueInfo = active ? subjectItemValue(active.grade, activeSubjectForStats, activeStatForValue) : { total: 0, value: null, label: "—" };

    const rows = filtered.map((student, index) => {
      const stat = statForSubject(student, active) || { score: null, correct: 0, total: 0, absent: true };
      const subjectForDetail = stat.subject || activeSubjectForStats || active?.subject || "";
      return `
        <tr class="table-row-click" data-action="open-detail" data-roll="${escAttr(student.roll)}" data-subject="${escAttr(subjectForDetail)}">
          <td class="teacher-index">${index + 1}</td>
          <td><strong>${esc(displayListName(student))}</strong><br><span class="student-subid">ID Prueba ${esc(student.roll)}</span></td>
          <td>${scoreDisplayHtml(stat)}</td>
          <td><strong>${Number(stat.correct || 0)}/${Number(stat.total || 0)}</strong></td>
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
          <article class="card card-pad teacher-stat"><span>Promedio</span><strong>${avg(teacherScoreValues)}<small>/100</small></strong></article>
          <button class="card card-pad teacher-stat teacher-stat-action" data-action="teacher-score-info" data-subject="${escAttr(active.subject)}" data-grade="${escAttr(active.grade)}" data-total="${escAttr(itemValueInfo.total)}">
            <span>Valor de cada ítem</span>
            <strong>${esc(itemValueInfo.label)}<small> puntos</small></strong>
            <em>Toca para ver cómo se calculan las notas de tus estudiantes.</em>
          </button>
        </section>
        <section class="teacher-metrics-row">
          ${teacherAggregateMetricsHtml(studentsForStats, statsSubject)}
        </section>
        <section class="teacher-key-actions">
          <button class="secondary-btn" data-action="open-answer-key" data-grade="${escAttr(active.grade)}" data-subject="${escAttr(active.subject)}">Ver respuestas correctas</button>
        </section>
      ` : ""}

      <section class="card table-card teacher-table-card">
        <div class="table-wrap">
          <table class="teacher-table">
            <thead><tr><th>#</th><th>${sortHeader("Estudiante", "teacher-active", "name")}</th><th>${sortHeader("Nota", "teacher-active", "score")}</th><th>${sortHeader("Correctas", "teacher-active", "correct")}</th></tr></thead>
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
    const baseStudents = active ? state.computedStudents.filter((student) => directorGroupMatches(student, active)) : [];
    const subjects = SUBJECTS.filter((subject) => baseStudents.some((student) => isExistingResultStat(student, statForSubject(student, subject.name))));
    const students = sortRowsByState(baseStudents, "director-group", (student, key) => {
      if (key === "name") return displayListName(student);
      const subject = subjects.find((s) => s.name === key || s.short === key);
      if (subject) return student.subjectStats[subject.name]?.score;
      return displayListName(student);
    });
    const groupButtons = groups.map((group) => `
      <button class="tab-btn teacher-group-tab ${active?.key === group.key ? "active" : ""}" data-action="teacher-director-group" data-key="${escAttr(group.key)}">
        ${esc(group.sede)} · ${esc(group.grade)}° · ${esc(group.group)}
      </button>
    `).join("");
    const subjectCards = subjects.map((subject) => {
      const studentsForSubjectStats = evaluatedStudentsForSubject(students, subject.name);
      const values = scoresForSubjectAverage(studentsForSubjectStats, subject.name);
      const display = avg(values);
      const percent = Number.isFinite(Number(display)) ? clamp(Number(display), 0, 100) : 0;
      return `
        <button class="director-subject-card" data-action="director-subject-detail" data-key="${escAttr(active?.key || "")}" data-subject="${escAttr(subject.name)}">
          <span class="director-card-main">
            ${subjectIcon(subject.name)}
            <span class="director-card-text">
              <strong class="director-card-title">${esc(subject.short || subject.name)}</strong>
              <span class="director-subject-score">${display}<small>/100</small></span>
            </span>
          </span>
          <span class="director-mini-bar" style="--score:${percent}%;"><i style="width:${percent}%"></i></span>
        </button>
      `;
    }).join("");
    const tableRows = students.map((student, index) => `
      <tr>
        <td class="teacher-index">${index + 1}</td>
        <td><strong>${esc(displayListName(student))}</strong><br><span class="student-subid">ID Prueba ${esc(student.roll)}</span></td>
        ${subjects.map((subject) => `<td>${scoreDisplayHtml(student.subjectStats[subject.name])}</td>`).join("")}
        <td><button class="danger-btn mini-btn director-delete-student-btn" data-action="director-delete-student" data-roll="${escAttr(student.roll)}">Eliminar</button></td>
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
        <section class="director-subject-grid">
          ${subjectCards || `<div class="card card-pad empty-state">No hay resultados por asignatura para este grupo.</div>`}
        </section>
        <section class="card table-card teacher-table-card director-table-card" style="--director-cols:${subjects.length};">
          <div class="table-wrap director-table-wrap">
            <table class="teacher-table director-table">
              <thead><tr><th>#</th><th>${sortHeader("Estudiante", "director-group", "name")}</th>${subjects.map((subject) => `<th>${sortHeader(subject.short || subject.name, "director-group", subject.name)}</th>`).join("")}<th>Acción</th></tr></thead>
              <tbody>${tableRows || `<tr><td colspan="${3 + subjects.length}" class="empty-state">No hay estudiantes con resultados en este grupo.</td></tr>`}</tbody>
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
    const students = sortRowsByState(
      state.computedStudents.filter((student) => directorGroupMatches(student, directorGroup)),
      "director-detail",
      (student, key) => {
        const stat = statForSubject(student, subject) || {};
        if (key === "score") return stat.score;
        if (key === "correct") return stat.correct;
        return displayListName(student);
      }
    );
    const studentsForStats = evaluatedStudentsForSubject(students, subject);
    const details = aggregateDetails(studentsForStats, subject);
    const scores = scoresForSubjectAverage(studentsForStats, subject);
    const rows = students.map((student, index) => {
      const stat = statForSubject(student, subject) || {};
      return `
        <tr class="table-row-click" data-action="open-detail" data-roll="${escAttr(student.roll)}" data-subject="${escAttr(subject)}">
          <td class="teacher-index">${index + 1}</td>
          <td><strong>${esc(displayListName(student))}</strong><br><span class="student-subid">ID Prueba ${esc(student.roll)}</span></td>
          <td>${scoreDisplayHtml(stat)}</td>
          <td><strong>${stat.correct}/${stat.total}</strong></td>
        </tr>
      `;
    }).join("");
    document.body.classList.add("modal-open");
    modalRoot.innerHTML = `
      <div class="modal-backdrop director-detail-backdrop" data-action="close-modal">
        <section class="modal director-detail-modal" style="max-width:980px;">
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
                  <thead><tr><th>#</th><th>${sortHeader("Estudiante", "director-detail", "name")}</th><th>${sortHeader("Nota", "director-detail", "score")}</th><th>${sortHeader("Correctas", "director-detail", "correct")}</th></tr></thead>
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
    const details = aggregateDetails(students, subject);
    return teacherAggregateMetricsHtmlForDetails(details);
  }

  function renderAdmin() {
    if (state.adminTab === "graficas") state.adminTab = "resumen";
    const tabs = [
      ["resumen", "Resumen"],
      ["estudiantes", "Estudiantes"],
      ["resultados", "Resultados"],
      ["estadisticas", "Estadísticas"],
      ["docentes", "Docentes"],
      ["mapa-grado", "Mapa por grado"],
      ["examenes-huerfanos", "Exámenes sin estudiante"],
      ["alerta-sesiones", "Alertas sesiones"],
      ["matriz-estudiantes", "Matriz estudiantes"],
      ["asignaturas-areas", "Asignaturas y áreas"],
      ["apariencia", "Apariencia"],
      ["logos", "Logos"],
      ["claves", "Claves"],
      ["github", "Supabase"]
    ];

    const nav = `
      <nav class="app-nav admin-top-tabs">
        ${tabs.map(([id, label]) => `<button type="button" class="nav-chip ${state.adminTab === id ? "active" : ""}" data-action="admin-tab" data-tab="${id}" ${id === "estadisticas" ? 'data-force-admin-stats="true" onclick="window.__poOpenAdminStats&&window.__poOpenAdminStats(event)"' : ''}>${label}</button>`).join("")}
        <span class="nav-chip admin-version-chip">${esc(APP_VERSION)}</span>
        <button class="nav-chip logout" data-action="logout">Salir</button>
      </nav>
    `;

    renderShell(`
      <section class="admin-layout admin-layout-full">
        <div class="admin-panel">${renderAdminTab()}</div>
      </section>
    `, nav);
  }

  function renderAdminContext() {
    if (state.activeSession?.role === "teacher") renderBySession();
    else renderAdmin();
  }

  function renderAdminTab() {
    switch (state.adminTab) {
      case "estudiantes": return adminStudentsHtml();
      case "resultados": return adminResultsHtml();
      case "estadisticas": return safeAdminStatsHtml();
      case "docentes": return adminDocentesHtml();
      case "mapa-grado": return adminGradeMapHtml();
      case "examenes-huerfanos": return adminOrphanExamsHtml();
      case "alerta-sesiones": return adminSessionAuditHtml();
      case "matriz-estudiantes": return adminRosterMatrixHtml();
      case "asignaturas-areas": return adminSubjectAreasHtml();
      case "apariencia": return adminAppearanceHtml();
      case "logos": return adminLogosHtml();
      case "cargas": return adminDocentesHtml();
      case "directores": return adminDocentesHtml();
      case "claves": return adminKeysHtml();
      case "github": return adminGithubHtml();
      default: return adminSummaryHtml();
    }
  }


  function safeAdminStatsHtml() {
    try {
      return adminStatsHtml();
    } catch (error) {
      console.error("Error en Estadísticas", error);
      return `
        <section class="toolbar">
          <div>
            <span class="section-eyebrow">Panel administrativo</span>
            <h2 style="margin:8px 0 0;font-size:clamp(1.4rem,4vw,2.2rem);font-weight:900;letter-spacing:-.04em;">Estadísticas</h2>
            <p class="teacher-active-label">No se pudo construir esta vista con los datos actuales.</p>
          </div>
        </section>
        <section class="card card-pad">
          <div class="empty-state">
            Hubo un error al calcular las estadísticas. Revisa que existan estudiantes, claves y resultados cargados. Detalle técnico: ${esc(error?.message || String(error))}
          </div>
        </section>
      `;
    }
  }

  function setAdminStatsField(field, value) {
    const clean = cleanText(value || "all") || "all";
    if (field === "mode") {
      state.adminStatsMode = clean === "area" ? "area" : "estructura";
      state.adminStatsSede = "all";
      state.adminStatsGrade = "all";
      state.adminStatsGroup = "all";
      state.adminStatsSubject = "all";
      return;
    }
    if (field === "sede") {
      state.adminStatsSede = clean;
      state.adminStatsGrade = "all";
      state.adminStatsGroup = "all";
      return;
    }
    if (field === "grade") {
      state.adminStatsGrade = clean;
      state.adminStatsGroup = "all";
      return;
    }
    if (field === "group") {
      state.adminStatsGroup = clean;
      return;
    }
    if (field === "subject") {
      state.adminStatsSubject = clean;
      return;
    }
  }

  function adminStatsHtml() {
    const mode = state.adminStatsMode === "area" ? "area" : "estructura";
    const allStudents = evaluatedStudentsOnly(state.computedStudents);
    const sedes = ["all", ...uniqueValues(allStudents.map((student) => student.sede || "—"))];
    const gradeBase = allStudents.filter((student) => state.adminStatsSede === "all" || (student.sede || "—") === state.adminStatsSede);
    const grades = ["all", ...uniqueValues(gradeBase.map((student) => student.grade).filter(Boolean))];
    const groupBase = gradeBase.filter((student) => state.adminStatsGrade === "all" || String(student.grade) === String(state.adminStatsGrade));
    const groups = ["all", ...uniqueValues(groupBase.map((student) => student.group).filter(Boolean))];
    const subjectBase = groupBase.filter((student) => state.adminStatsGroup === "all" || student.group === state.adminStatsGroup);
    const subjects = ["all", ...statsSubjectsFor(subjectBase.length ? subjectBase : allStudents)];

    if (!sedes.includes(state.adminStatsSede)) state.adminStatsSede = "all";
    if (!grades.some((value) => String(value) === String(state.adminStatsGrade))) state.adminStatsGrade = "all";
    if (!groups.includes(state.adminStatsGroup)) state.adminStatsGroup = "all";
    if (!subjects.includes(state.adminStatsSubject)) state.adminStatsSubject = "all";

    const title = mode === "area" ? "Estadísticas por área/asignatura" : "Estadísticas por ubicación académica";
    const description = mode === "area"
      ? "Selecciona un área y luego filtra por sede, grado o curso para ver el desempeño sin depender de gráficas clicables."
      : "Selecciona sede, grado y curso para bajar de lo general a lo específico; al elegir un área se muestran componentes y competencias si existen.";

    const chart = mode === "area" ? adminStatsAreaView(allStudents) : adminStatsStructureView(allStudents);

    return `
      <section class="toolbar">
        <div>
          <span class="section-eyebrow">Panel administrativo</span>
          <h2 style="margin:8px 0 0;font-size:clamp(1.4rem,4vw,2.2rem);font-weight:900;letter-spacing:-.04em;">${title}</h2>
          <p class="teacher-active-label">${description}</p>
        </div>
      </section>
      <section class="card card-pad stats-filter-card">
        <div class="form-grid compact stats-filter-grid">
          <div class="field"><label>Modo de lectura</label><select class="select-pill" data-admin-stats-field="mode" onchange="window.__poAdminStatsFieldFromElement&&window.__poAdminStatsFieldFromElement(event,this)">
            <option value="estructura" ${mode === "estructura" ? "selected" : ""}>Ubicación académica</option>
            <option value="area" ${mode === "area" ? "selected" : ""}>Área / asignatura</option>
          </select></div>
          ${mode === "area" ? `
            <div class="field"><label>Área/asignatura</label><select class="select-pill" data-admin-stats-field="subject" onchange="window.__poAdminStatsFieldFromElement&&window.__poAdminStatsFieldFromElement(event,this)">${subjects.map((value) => `<option value="${escAttr(value)}" ${state.adminStatsSubject === value ? "selected" : ""}>${value === "all" ? "Todas las áreas" : esc(shortSubjectName(value))}</option>`).join("")}</select></div>
            <div class="field"><label>Sede</label><select class="select-pill" data-admin-stats-field="sede" onchange="window.__poAdminStatsFieldFromElement&&window.__poAdminStatsFieldFromElement(event,this)">${sedes.map((value) => `<option value="${escAttr(value)}" ${state.adminStatsSede === value ? "selected" : ""}>${value === "all" ? "Todas las sedes" : esc(value)}</option>`).join("")}</select></div>
            <div class="field"><label>Grado</label><select class="select-pill" data-admin-stats-field="grade" onchange="window.__poAdminStatsFieldFromElement&&window.__poAdminStatsFieldFromElement(event,this)">${grades.map((value) => `<option value="${escAttr(value)}" ${String(state.adminStatsGrade) === String(value) ? "selected" : ""}>${value === "all" ? "Todos los grados" : `${esc(value)}°`}</option>`).join("")}</select></div>
            <div class="field"><label>Curso</label><select class="select-pill" data-admin-stats-field="group" onchange="window.__poAdminStatsFieldFromElement&&window.__poAdminStatsFieldFromElement(event,this)">${groups.map((value) => `<option value="${escAttr(value)}" ${state.adminStatsGroup === value ? "selected" : ""}>${value === "all" ? "Todos los cursos" : esc(value)}</option>`).join("")}</select></div>
          ` : `
            <div class="field"><label>Sede</label><select class="select-pill" data-admin-stats-field="sede" onchange="window.__poAdminStatsFieldFromElement&&window.__poAdminStatsFieldFromElement(event,this)">${sedes.map((value) => `<option value="${escAttr(value)}" ${state.adminStatsSede === value ? "selected" : ""}>${value === "all" ? "Todas las sedes" : esc(value)}</option>`).join("")}</select></div>
            <div class="field"><label>Grado</label><select class="select-pill" data-admin-stats-field="grade" onchange="window.__poAdminStatsFieldFromElement&&window.__poAdminStatsFieldFromElement(event,this)">${grades.map((value) => `<option value="${escAttr(value)}" ${String(state.adminStatsGrade) === String(value) ? "selected" : ""}>${value === "all" ? "Todos los grados" : `${esc(value)}°`}</option>`).join("")}</select></div>
            <div class="field"><label>Curso</label><select class="select-pill" data-admin-stats-field="group" onchange="window.__poAdminStatsFieldFromElement&&window.__poAdminStatsFieldFromElement(event,this)">${groups.map((value) => `<option value="${escAttr(value)}" ${state.adminStatsGroup === value ? "selected" : ""}>${value === "all" ? "Todos los cursos" : esc(value)}</option>`).join("")}</select></div>
            <div class="field"><label>Área/asignatura</label><select class="select-pill" data-admin-stats-field="subject" onchange="window.__poAdminStatsFieldFromElement&&window.__poAdminStatsFieldFromElement(event,this)">${subjects.map((value) => `<option value="${escAttr(value)}" ${state.adminStatsSubject === value ? "selected" : ""}>${value === "all" ? "Todas las áreas" : esc(shortSubjectName(value))}</option>`).join("")}</select></div>
          `}
        </div>
      </section>
      ${chart}
    `;
  }

  function adminStatsStructureView(students) {
    const filtered = filterStudentsByStats(students, { subject: false });
    const subject = state.adminStatsSubject === "all" ? "" : state.adminStatsSubject;
    if (subject) {
      const subjectStudents = evaluatedStudentsForSubject(filtered, subject);
      return statsMetricsPanel(subjectStudents, subject, statsContextText("estructura", true));
    }
    if (state.adminStatsGroup !== "all") {
      const rows = statsSubjectRows(filtered);
      return statsPanelHtml("Promedio por área/asignatura", statsContextText("estructura"), rows, true, "Selecciona un área/asignatura arriba para ver componentes y competencias.");
    }
    if (state.adminStatsGrade !== "all") {
      const rows = groupStatsRows(filtered, (student) => student.group || "Sin curso", (key) => key);
      return statsPanelHtml("Promedio por curso", statsContextText("estructura"), rows, false, "Selecciona un curso arriba para ver sus áreas/asignaturas.");
    }
    if (state.adminStatsSede !== "all") {
      const rows = groupStatsRows(filtered, (student) => String(student.grade || "Sin grado"), (key) => key === "Sin grado" ? key : `${key}°`);
      return statsPanelHtml("Promedio por grado", statsContextText("estructura"), rows, false, "Selecciona un grado arriba para ver sus cursos.");
    }
    const rows = groupStatsRows(filtered, (student) => student.sede || "—", (key) => key);
    return statsPanelHtml("Promedio por sede", "Todas las sedes · todas las áreas", rows, false, "Selecciona una sede arriba para ver sus grados.");
  }

  function adminStatsAreaView(students) {
    const subject = state.adminStatsSubject === "all" ? "" : state.adminStatsSubject;
    const filtered = filterStudentsByStats(students, { subject: false });
    if (!subject) {
      return statsPanelHtml("Promedio general por área/asignatura", statsContextText("area"), statsSubjectRows(filtered), true, "Selecciona un área arriba para comparar sedes, grados y cursos.");
    }
    const subjectStudents = evaluatedStudentsForSubject(filtered, subject);
    if (state.adminStatsGroup !== "all") {
      return statsMetricsPanel(subjectStudents, subject, statsContextText("area", true));
    }
    if (state.adminStatsGrade !== "all") {
      const rows = subjectGroupRows(subjectStudents, subject, (student) => student.group || "Sin curso", (key) => key);
      return statsPanelHtml(`${esc(shortSubjectName(subject))} por curso`, statsContextText("area"), rows, false, "Selecciona un curso arriba para ver componentes y competencias.");
    }
    if (state.adminStatsSede !== "all") {
      const rows = subjectGroupRows(subjectStudents, subject, (student) => String(student.grade || "Sin grado"), (key) => key === "Sin grado" ? key : `${key}°`);
      return statsPanelHtml(`${esc(shortSubjectName(subject))} por grado`, statsContextText("area"), rows, false, "Selecciona un grado arriba para ver sus cursos.");
    }
    const rows = subjectGroupRows(subjectStudents, subject, (student) => student.sede || "—", (key) => key);
    return statsPanelHtml(`${esc(shortSubjectName(subject))} por sede`, statsContextText("area"), rows, false, "Selecciona una sede arriba para ver sus grados.");
  }

  function filterStudentsByStats(students, options = {}) {
    const includeSubject = options.subject !== false;
    const subject = state.adminStatsSubject === "all" ? "" : state.adminStatsSubject;
    return students.filter((student) => {
      if (state.adminStatsSede !== "all" && (student.sede || "—") !== state.adminStatsSede) return false;
      if (state.adminStatsGrade !== "all" && String(student.grade) !== String(state.adminStatsGrade)) return false;
      if (state.adminStatsGroup !== "all" && student.group !== state.adminStatsGroup) return false;
      if (includeSubject && subject && !student.subjectStats?.[subject]?.total) return false;
      return true;
    });
  }

  function statsSubjectsFor(students) {
    const set = new Set();
    students.forEach((student) => {
      Object.entries(student.subjectStats || {}).forEach(([subject, stat]) => {
        if (isExistingResultStat(student, stat)) set.add(canonicalSubject(subject));
      });
    });
    return [...set].filter(Boolean).sort((a, b) => a.localeCompare(b, "es", { sensitivity: "base" }));
  }

  function statsSubjectRows(students) {
    return statsSubjectsFor(students).map((subject) => {
      const values = scoresForSubjectAverage(students, subject);
      const evaluated = students.filter((student) => isExistingResultStat(student, statForSubject(student, subject))).length;
      return { key: subject, label: shortSubjectName(subject), avg: values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : null, count: evaluated, evaluations: values.length };
    }).filter((row) => row.avg !== null).sort((a, b) => b.avg - a.avg || a.label.localeCompare(b.label, "es"));
  }

  function groupStatsRows(students, getKey, getLabel) {
    const map = new Map();
    students.forEach((student) => {
      const key = cleanText(getKey(student)) || "Sin dato";
      const studentScores = scoresForAllSubjectsAverage(student);
      if (!studentScores.length) return;
      if (!map.has(key)) map.set(key, { key, label: getLabel(key), scores: [], students: new Set() });
      const row = map.get(key);
      row.students.add(student.roll || student.name || key);
      studentScores.forEach((score) => row.scores.push(score));
    });
    return [...map.values()].map((row) => ({ key: row.key, label: row.label, avg: row.scores.length ? Math.round(row.scores.reduce((sum, value) => sum + value, 0) / row.scores.length) : null, count: row.students.size, evaluations: row.scores.length }))
      .filter((row) => row.avg !== null).sort((a, b) => b.avg - a.avg || String(a.label).localeCompare(String(b.label), "es", { numeric: true }));
  }

  function subjectGroupRows(students, subject, getKey, getLabel) {
    const map = new Map();
    students.forEach((student) => {
      const stat = statForSubject(student, subject);
      if (!isExistingResultStat(student, stat)) return;
      const key = cleanText(getKey(student)) || "Sin dato";
      if (!map.has(key)) map.set(key, { key, label: getLabel(key), scores: [], students: new Set() });
      const row = map.get(key);
      row.students.add(student.roll || student.name || key);
      row.scores.push(Number(stat.score));
    });
    return [...map.values()].map((row) => ({ key: row.key, label: row.label, avg: row.scores.length ? Math.round(row.scores.reduce((sum, value) => sum + value, 0) / row.scores.length) : null, count: row.students.size, evaluations: row.scores.length }))
      .filter((row) => row.avg !== null).sort((a, b) => b.avg - a.avg || String(a.label).localeCompare(String(b.label), "es", { numeric: true }));
  }

  function statsPanelHtml(title, context, rows, withIcon = false, hint = "") {
    const weighted = rows.flatMap((row) => Array(Math.max(0, Number(row.evaluations || row.count || 0))).fill(Number(row.avg))).filter((value) => Number.isFinite(value));
    const values = weighted.length ? weighted : rows.map((row) => row.avg).filter((value) => Number.isFinite(value));
    const general = values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : "—";
    const totalStudents = rows.reduce((sum, row) => sum + (row.count || 0), 0);
    return `
      <section class="stats-main-card card card-pad">
        <div class="stats-main-head">
          <div>
            <span class="section-eyebrow">Promedio de nota</span>
            <h3>${title}</h3>
            <p>${esc(context)}${hint ? ` · ${esc(hint)}` : ""}</p>
          </div>
          <div class="stats-big-number"><span>Promedio</span><strong>${esc(general)}<small>/100</small></strong></div>
        </div>
        <div class="stats-bars-list">
          ${rows.length ? rows.map((row) => statsBarHtml(row, withIcon)).join("") : `<div class="empty-state">No hay datos suficientes para esta selección.</div>`}
        </div>
      </section>
    `;
  }

  function statsBarHtml(row, withIcon = false) {
    const width = clamp(Number(row.avg) || 0, 0, 100);
    const count = row.count || 0;
    const countText = `${count} estudiante${count === 1 ? "" : "s"}`;
    return `
      <article class="stats-bar-row ${withIcon ? "stats-bar-row-subject" : "stats-bar-row-group"}">
        ${withIcon ? subjectIcon(row.key) : ""}
        <span class="stats-card-body">
          <span class="stats-title-line">
            <strong class="stats-title">${esc(row.label)}</strong>
            ${withIcon ? "" : `<small class="stats-count">${esc(countText)}</small>`}
          </span>
          <span class="stats-progress-line">
            <span class="stats-track"><i style="width:${width}%"></i></span>
            <strong class="stats-score">${esc(row.avg ?? "—")}<small>/100</small></strong>
          </span>
        </span>
      </article>
    `;
  }

  function statsMetricsPanel(students, subject, context) {
    const values = scoresForSubjectAverage(students, subject);
    const score = values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : "—";
    const details = aggregateDetails(students, subject);
    const metricHtml = teacherAggregateMetricsHtmlForDetails(details);
    return `
      <section class="stats-main-card card card-pad">
        <div class="stats-main-head">
          <div>
            <span class="section-eyebrow">Componentes y competencias</span>
            <h3>${subjectIcon(subject)} ${esc(shortSubjectName(subject))}</h3>
            <p>${esc(context)} · Promedio de nota del área seleccionada.</p>
          </div>
          <div class="stats-big-number"><span>Promedio</span><strong>${esc(score)}<small>/100</small></strong></div>
        </div>
        ${metricHtml ? `<div class="teacher-metrics-row admin-results-metrics stats-metrics-row">${metricHtml}</div>` : `<div class="empty-state">Esta área no tiene componentes ni competencias registrados en las claves.</div>`}
      </section>
    `;
  }

  function statsContextText(mode, includeSubject = false) {
    const parts = [];
    if (state.adminStatsSede !== "all") parts.push(state.adminStatsSede);
    if (state.adminStatsGrade !== "all") parts.push(`${state.adminStatsGrade}°`);
    if (state.adminStatsGroup !== "all") parts.push(state.adminStatsGroup);
    if (includeSubject && state.adminStatsSubject !== "all") parts.push(shortSubjectName(state.adminStatsSubject));
    if (!parts.length) return mode === "area" ? "Todas las áreas · todos los estudiantes evaluados" : "Todas las sedes · todos los estudiantes evaluados";
    return parts.join(" · ");
  }

  function adminSummaryHtml() {
    const grades = [...new Set(state.computedStudents.map((s) => s.grade).filter(Boolean))].sort((a, b) => a - b);
    const avgGlobal = avg(state.computedStudents.filter(studentHasPresentedAnySubject).map((s) => s.globalScore));
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
Esta versión usa GitHub Pages como interfaz y Supabase como base de datos privada. Puedes editar en el panel y luego usar <strong>Subir a Supabase</strong> para dejar los cambios disponibles para todos.
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
            const values = scoresForSubjectAverage(state.computedStudents, subject.name);
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


  function buildOrphanExams(responseRecords = []) {
    return responseRecords
      .filter((record) => record?.roll && !state.registryByExamId.has(cleanId(record.roll)))
      .map((record) => {
        const grade = toInt(record.grade) || inferGradeFromPath(record.sessions?.[0]?.path || "") || "";
        return {
          roll: cleanId(record.roll),
          name: cleanText(record.name) || `Examen ${cleanId(record.roll)}`,
          grade,
          sessions: Array.isArray(record.sessions) ? record.sessions : [],
          answerCount: Object.keys(record.answers || {}).length
        };
      })
      .sort((a, b) => (Number(a.grade) || 0) - (Number(b.grade) || 0) || String(a.roll).localeCompare(String(b.roll), "es", { numeric: true }));
  }

  function adminOrphanExamsHtml() {
    const orphans = state.orphanExams || [];
    const grades = ["all", ...uniqueValues(orphans.map((item) => item.grade).filter(Boolean)).sort((a,b)=>Number(a)-Number(b))];
    const rows = orphans.filter((item) => state.adminGradeFilter === "all" || String(item.grade) === String(state.adminGradeFilter));
    return `
      <section class="toolbar">
        <div>
          <span class="section-eyebrow">Exámenes no vinculados</span>
          <h2 style="margin:8px 0 0;font-weight:900;">Exámenes sin estudiante</h2>
          <p class="muted-copy">Estos exámenes existen en RESULTADOS, pero su ID prueba no aparece en ESTUDIANTES.json. No entran en estadísticas, rankings, docentes ni reportes hasta que los vincules o crees el estudiante.</p>
        </div>
        <div class="toolbar-right">
          <select class="select-pill" data-action="admin-grade-filter">
            ${grades.map((g) => `<option value="${escAttr(g)}" ${String(state.adminGradeFilter) === String(g) ? "selected" : ""}>${g === "all" ? "Todos los grados" : `${esc(g)}°`}</option>`).join("")}
          </select>
        </div>
      </section>
      <div class="orphan-summary ${orphans.length ? "has-orphans" : "is-clear"}">
        <strong>${orphans.length}</strong>
        <span>${orphans.length === 1 ? "examen sin estudiante vinculado" : "exámenes sin estudiante vinculado"}</span>
      </div>
      <section class="card table-card admin-orphan-table">
        <div class="table-wrap">
          <table>
            <thead><tr><th>#</th><th>ID prueba</th><th>Nombre leído</th><th>Grado</th><th>Sesiones</th><th>Respuestas</th><th>Acciones</th></tr></thead>
            <tbody>
              ${rows.map((item, index) => `
                <tr>
                  <td><span class="badge gray">${index + 1}</span></td>
                  <td><strong>${esc(item.roll)}</strong></td>
                  <td>${esc(item.name || "—")}</td>
                  <td>${item.grade ? `${esc(item.grade)}°` : "—"}</td>
                  <td>${esc((item.sessions || []).map((s) => `S${s.session || "?"}`).join(" · ") || "—")}</td>
                  <td>${esc(item.answerCount || 0)}</td>
                  <td class="row-actions">
                    <button class="secondary-btn mini-btn" data-action="link-orphan-exam" data-roll="${escAttr(item.roll)}">Vincular</button>
                    <button class="primary-btn mini-btn" data-action="add-student-from-orphan" data-roll="${escAttr(item.roll)}">Crear estudiante</button>
                  </td>
                </tr>
              `).join("") || `<tr><td colspan="7" class="empty-state">No hay exámenes sin estudiante. Todo está vinculado con ESTUDIANTES.json.</td></tr>`}
            </tbody>
          </table>
        </div>
      </section>
      <div class="admin-note" style="margin-top:14px;">Al vincular o crear, se actualiza el registro local de estudiantes. Luego usa <strong>Guardar estudiantes</strong> y <strong>Subir a Supabase</strong> para dejarlo fijo en la base privada.</div>
      <div class="inline-actions admin-actions-line">
        <button class="secondary-btn" data-action="save-students">Guardar estudiantes</button>
        <button class="ghost-btn" data-action="export-students">Exportar ESTUDIANTES</button>
        <button class="secondary-btn" data-action="publish-supabase">Subir a Supabase</button>
      </div>
    `;
  }

  function orphanByRoll(roll) {
    const clean = cleanId(roll);
    return (state.orphanExams || []).find((item) => cleanId(item.roll) === clean) || null;
  }

  function studentOptionsForOrphan(selected = "") {
    const active = cleanId(selected);
    return state.studentsRegistry
      .slice()
      .sort(compareStudentsByName)
      .map((student, index) => {
        const realIndex = state.studentsRegistry.indexOf(student);
        const label = `${displayListName(student)} · ${student.sede || ""} ${student.grade ? `· ${student.grade}°` : ""} ${student.group || ""} · ID prueba actual: ${student.examId || "—"}`;
        return `<option value="${realIndex}" ${String(realIndex) === String(active) ? "selected" : ""}>${esc(label)}</option>`;
      }).join("");
  }

  function openLinkOrphanExamModal(roll) {
    const orphan = orphanByRoll(roll);
    if (!orphan) return;
    document.body.classList.add("modal-open");
    modalRoot.innerHTML = `
      <div class="modal-backdrop" data-action="close-modal">
        <section class="modal orphan-modal" style="max-width:760px;">
          <div class="modal-head">
            <div><h2>Vincular examen a estudiante</h2><span style="color:#7d8089;font-weight:600;">ID prueba ${esc(orphan.roll)} · ${orphan.grade ? `${esc(orphan.grade)}°` : "Grado no detectado"}</span></div>
            <button type="button" class="icon-btn" data-action="close-modal" aria-label="Cerrar">×</button>
          </div>
          <div class="modal-body">
            <div class="orphan-card-inline"><strong>${esc(orphan.name)}</strong><span>${esc(orphan.answerCount || 0)} respuestas registradas en RESULTADOS</span></div>
            <div class="field"><label>Estudiante existente en ESTUDIANTES.json</label><select id="orphanTargetStudent" class="select-pill">${studentOptionsForOrphan()}</select></div>
            <div class="warning-note-soft">Esto reemplazará el <strong>ID prueba</strong> del estudiante seleccionado por <strong>${esc(orphan.roll)}</strong>. El examen quedará vinculado a ese estudiante y empezará a aparecer en reportes.</div>
            <div class="inline-actions" style="margin-top:16px;">
              <button class="primary-btn" data-action="confirm-link-orphan-exam" data-roll="${escAttr(orphan.roll)}">Vincular examen</button>
              <button class="ghost-btn" data-action="close-modal">Cancelar</button>
            </div>
          </div>
        </section>
      </div>`;
  }

  function confirmLinkOrphanExam(roll) {
    const orphan = orphanByRoll(roll);
    const index = Number(document.getElementById("orphanTargetStudent")?.value);
    const student = state.studentsRegistry[index];
    if (!orphan || !student) { toast("Selecciona un estudiante válido."); return; }
    student.examId = cleanId(orphan.roll);
    if (!student.grade && orphan.grade) student.grade = toInt(orphan.grade);
    state.studentsRegistry[index] = normalizeStudentRow(student);
    writeJSON(STORAGE.students, { rows: state.studentsRegistry });
    buildRepository();
    toast("Examen vinculado al estudiante.");
    closeModal();
    renderAdminContext();
  }

  function openAddStudentFromOrphanModal(roll) {
    const orphan = orphanByRoll(roll);
    if (!orphan) return;
    document.body.classList.add("modal-open");
    modalRoot.innerHTML = `
      <div class="modal-backdrop" data-action="close-modal">
        <section class="modal orphan-modal" style="max-width:760px;">
          <div class="modal-head">
            <div><h2>Crear estudiante desde examen</h2><span style="color:#7d8089;font-weight:600;">Se usará el ID prueba ${esc(orphan.roll)}</span></div>
            <button type="button" class="icon-btn" data-action="close-modal" aria-label="Cerrar">×</button>
          </div>
          <div class="modal-body">
            <div class="form-grid compact">
              <div class="field"><label>ID prueba</label><input id="newOrphanExamId" value="${escAttr(orphan.roll)}" readonly></div>
              <div class="field"><label>ID nacional del estudiante</label><input id="newOrphanNationalId" placeholder="Documento / identificación"></div>
              <div class="field span-2"><label>Nombre completo</label><input id="newOrphanName" value="${escAttr(orphan.name || "")}" placeholder="Nombres y apellidos"></div>
              <div class="field"><label>Sede</label><select id="newOrphanSede" class="select-pill">${cargaSelectOptions("sede", "")}</select></div>
              <div class="field"><label>Grado</label><select id="newOrphanGrade" class="select-pill">${cargaSelectOptions("grade", orphan.grade || "")}</select></div>
              <div class="field"><label>Curso</label><select id="newOrphanGroup" class="select-pill">${cargaSelectOptions("group", "")}</select></div>
            </div>
            <div class="warning-note-soft">Al crear el estudiante, este examen deja de estar oculto y entra a estadísticas, rankings, docentes y reportes.</div>
            <div class="inline-actions" style="margin-top:16px;">
              <button class="primary-btn" data-action="confirm-add-student-from-orphan" data-roll="${escAttr(orphan.roll)}">Crear estudiante</button>
              <button class="ghost-btn" data-action="close-modal">Cancelar</button>
            </div>
          </div>
        </section>
      </div>`;
  }

  function confirmAddStudentFromOrphan(roll) {
    const orphan = orphanByRoll(roll);
    if (!orphan) return;
    const row = normalizeStudentRow({
      examId: orphan.roll,
      nationalId: document.getElementById("newOrphanNationalId")?.value || "",
      name: document.getElementById("newOrphanName")?.value || "",
      sede: document.getElementById("newOrphanSede")?.value || "",
      grade: document.getElementById("newOrphanGrade")?.value || orphan.grade || "",
      group: document.getElementById("newOrphanGroup")?.value || ""
    });
    if (!row.nationalId || !row.name || !row.sede || !row.grade || !row.group) {
      toast("Completa ID nacional, nombre, sede, grado y curso.");
      return;
    }
    state.studentsRegistry.unshift(row);
    writeJSON(STORAGE.students, { rows: state.studentsRegistry });
    buildRepository();
    toast("Estudiante creado y examen vinculado.");
    closeModal();
    renderAdminContext();
  }


  function detectedSessionsForRecord(record) {
    const sessions = responseSessions(record);
    Object.entries(record?.answers || {}).forEach(([item, value]) => {
      if (!cleanMarked(value)) return;
      const session = sessionForItem(Number(item));
      if (session) sessions.add(Number(session));
    });
    return sessions;
  }

  function sessionAuditRowForRoll(roll) {
    const clean = cleanId(roll);
    return buildSessionAuditRows().find((row) => cleanId(row.roll) === clean) || null;
  }

  function buildSessionAuditRows() {
    const rows = [];
    const required = (state.manifest.sessions || DEFAULT_MANIFEST.sessions || [])
      .map((item) => Number(item.session || item))
      .filter(Boolean);
    const sessionOne = required.includes(1) ? 1 : (required[0] || 1);
    const sessionTwo = required.includes(2) ? 2 : (required[1] || 2);

    (state.responsesByRoll || new Map()).forEach((record, rollKey) => {
      const roll = cleanId(record?.roll || rollKey);
      if (!roll) return;
      const sessions = detectedSessionsForRecord(record);
      const hasOne = sessions.has(sessionOne);
      const hasTwo = sessions.has(sessionTwo);
      if (hasOne === hasTwo) return;
      const registry = state.registryByExamId.get(roll) || state.registryByNationalId.get(cleanId(record?.nationalId)) || null;
      const computed = state.computedByRoll.get(roll) || null;
      const studentName = cleanText(registry?.name) || cleanText(computed?.name) || cleanText(record?.name) || "Sin estudiante vinculado";
      const grade = toInt(registry?.grade) || toInt(computed?.grade) || toInt(record?.grade) || "";
      const group = cleanText(registry?.group) || cleanText(computed?.group) || cleanText(record?.group) || "";
      const sede = cleanText(registry?.sede) || cleanText(computed?.sede) || cleanText(record?.sede) || "";
      rows.push({
        roll,
        type: hasOne ? "s1_only" : "s2_only",
        missing: hasOne ? sessionTwo : sessionOne,
        present: hasOne ? sessionOne : sessionTwo,
        sessions: [...sessions].sort((a, b) => a - b),
        name: studentName,
        grade,
        group,
        sede,
        registry,
        record,
        answerCount: Object.values(record?.answers || {}).filter((value) => !!cleanMarked(value)).length
      });
    });

    return rows.sort((a, b) => {
      const type = String(a.type).localeCompare(String(b.type));
      if (type) return type;
      const gradeDiff = Number(a.grade || 999) - Number(b.grade || 999);
      if (gradeDiff) return gradeDiff;
      const groupDiff = String(a.group || "").localeCompare(String(b.group || ""), "es", { numeric: true, sensitivity: "base" });
      if (groupDiff) return groupDiff;
      return String(a.name || "").localeCompare(String(b.name || ""), "es", { numeric: true, sensitivity: "base" });
    });
  }

  function adminSessionAuditRowsTable(rows = [], title = "", subtitle = "") {
    return `
      <section class="card table-card admin-session-audit-table">
        <div class="card-pad audit-card-head">
          <span class="section-eyebrow">${esc(title)}</span>
          <p class="muted-copy">${esc(subtitle)}</p>
        </div>
        <div class="table-wrap">
          <table>
            <thead><tr><th>#</th><th>ID prueba</th><th>Estudiante detectado</th><th>Sede</th><th>Grado</th><th>Curso</th><th>Sesión encontrada</th><th>Falta</th><th>Acciones</th></tr></thead>
            <tbody>
              ${rows.map((row, index) => `
                <tr>
                  <td><span class="badge gray">${index + 1}</span></td>
                  <td><strong>${esc(row.roll)}</strong><br><span class="student-subid">${esc(row.answerCount || 0)} respuestas</span></td>
                  <td><strong>${esc(row.name || "—")}</strong>${row.registry ? `<br><span class="student-subid">Vinculado en estudiantes</span>` : `<br><span class="student-subid warning-text">No aparece vinculado en estudiantes</span>`}</td>
                  <td>${esc(row.sede || "—")}</td>
                  <td>${row.grade ? `${esc(row.grade)}°` : "—"}</td>
                  <td>${esc(row.group || "—")}</td>
                  <td><span class="badge ${row.present === 1 ? "blue" : "purple"}">S${esc(row.present)}</span></td>
                  <td><span class="badge red">S${esc(row.missing)}</span></td>
                  <td class="row-actions">
                    <button class="secondary-btn mini-btn" data-action="open-session-audit-assign" data-roll="${escAttr(row.roll)}">Asignar ID</button>
                    <button class="ghost-btn mini-btn" data-action="edit-student-exam" data-roll="${escAttr(row.roll)}">Ver/editar examen</button>
                  </td>
                </tr>
              `).join("") || `<tr><td colspan="9" class="empty-state">No hay casos en este grupo.</td></tr>`}
            </tbody>
          </table>
        </div>
      </section>`;
  }

  function adminSessionAuditHtml() {
    const rows = buildSessionAuditRows();
    const onlyS1 = rows.filter((row) => row.type === "s1_only");
    const onlyS2 = rows.filter((row) => row.type === "s2_only");
    return `
      <section class="toolbar">
        <div>
          <span class="section-eyebrow">Control administrativo</span>
          <h2 style="margin:8px 0 0;font-weight:900;">Alertas de sesiones incompletas</h2>
          <p class="muted-copy">Detecta estudiantes o ID prueba que aparecen solo en primera sesión o solo en segunda sesión. Sirve para ubicar errores de lectura, ausencias o ID asignados al estudiante equivocado.</p>
        </div>
        <div class="toolbar-right">
          <button class="secondary-btn" data-action="save-students">Guardar estudiantes</button>
          <button class="primary-btn" data-action="publish-supabase">Subir a Supabase</button>
        </div>
      </section>
      <section class="teacher-stat-strip teacher-stat-strip-two session-audit-summary">
        <article><span>Solo 1ra sesión</span><strong>${esc(onlyS1.length)}</strong><small>tienen S1, falta S2</small></article>
        <article><span>Solo 2da sesión</span><strong>${esc(onlyS2.length)}</strong><small>tienen S2, falta S1</small></article>
      </section>
      <div class="admin-note session-audit-note">Si asignas un ID prueba a otro estudiante, se modifica el registro de estudiantes local. Para dejarlo fijo en Supabase, usa <strong>Guardar estudiantes</strong> y luego <strong>Subir a Supabase</strong>.</div>
      ${adminSessionAuditRowsTable(onlyS1, "Examen en 1ra sesión, falta 2da", "Casos con respuestas detectadas en S1 pero sin respuestas de S2.")}
      ${adminSessionAuditRowsTable(onlyS2, "Examen en 2da sesión, falta 1ra", "Casos con respuestas detectadas en S2 pero sin respuestas de S1.")}
    `;
  }

  function sessionAuditStudentMatches(query = "") {
    const clean = normalizeText(query);
    const rows = state.studentsRegistry
      .map((student, index) => ({ student, index }))
      .filter(({ student }) => {
        if (!clean) return true;
        return normalizeText(`${student.name} ${student.nombres} ${student.apellidos} ${student.examId} ${student.nationalId} ${student.sede} ${student.grade} ${student.group}`).includes(clean);
      })
      .sort((a, b) => compareStudentsByName(a.student, b.student));
    return rows.slice(0, clean ? 30 : 15);
  }

  function openSessionAuditAssignModal(roll) {
    if (state.activeSession?.role !== "admin") { toast("Solo el administrador puede asignar ID prueba."); return; }
    const row = sessionAuditRowForRoll(roll);
    if (!row) { toast("No se encontró la alerta de sesión."); return; }
    state.sessionAuditAssignRoll = cleanId(roll);
    const query = state.sessionAuditStudentSearch || "";
    const matches = sessionAuditStudentMatches(query);
    document.body.classList.add("modal-open");
    modalRoot.innerHTML = `
      <div class="modal-backdrop" data-action="close-modal">
        <section class="modal session-audit-modal" style="max-width:980px;">
          <div class="modal-head">
            <div><h2>Asignar ID prueba a estudiante</h2><span style="color:#7d8089;font-weight:600;">ID prueba ${esc(row.roll)} · encontrado en S${esc(row.present)} · falta S${esc(row.missing)}</span></div>
            <button type="button" class="icon-btn" data-action="close-modal" aria-label="Cerrar">×</button>
          </div>
          <div class="modal-body">
            <div class="warning-note-soft">Busca el estudiante correcto por nombre, documento, sede, grado o curso. Al elegirlo, su <strong>ID_PRUEBA</strong> quedará como <strong>${esc(row.roll)}</strong>.</div>
            <div class="audit-source-card">
              <strong>${esc(row.name || "Examen sin estudiante")}</strong>
              <span>ID prueba detectado: ${esc(row.roll)} · ${row.grade ? `${esc(row.grade)}°` : "grado no detectado"} ${esc(row.group || "")} · ${esc(row.sede || "sede no detectada")}</span>
            </div>
            <div class="field session-audit-search-field"><label>Buscar estudiante destino</label><input id="sessionAuditStudentSearch" data-action="session-audit-student-search" data-roll="${escAttr(row.roll)}" value="${escAttr(query)}" placeholder="Escribe nombre, documento, sede, grado o curso"></div>
            <section class="card table-card session-audit-search-results">
              <div class="table-wrap">
                <table>
                  <thead><tr><th>Estudiante</th><th>Sede</th><th>Grado</th><th>Curso</th><th>ID prueba actual</th><th>Acción</th></tr></thead>
                  <tbody>
                    ${matches.map(({ student, index }) => `
                      <tr>
                        <td><strong>${esc(displayListName(student))}</strong><br><span class="student-subid">Documento: ${esc(student.nationalId || "—")}</span></td>
                        <td>${esc(student.sede || "—")}</td>
                        <td>${student.grade ? `${esc(student.grade)}°` : "—"}</td>
                        <td>${esc(student.group || "—")}</td>
                        <td><strong>${esc(student.examId || "—")}</strong></td>
                        <td class="row-actions"><button class="primary-btn mini-btn" data-action="confirm-session-audit-assign-upload" data-roll="${escAttr(row.roll)}" data-index="${escAttr(index)}">Asignar y subir</button><button class="ghost-btn mini-btn" data-action="confirm-session-audit-assign" data-roll="${escAttr(row.roll)}" data-index="${escAttr(index)}">Solo asignar</button></td>
                      </tr>
                    `).join("") || `<tr><td colspan="6" class="empty-state">No hay coincidencias. Intenta con otro nombre o documento.</td></tr>`}
                  </tbody>
                </table>
              </div>
            </section>
            <div class="inline-actions" style="margin-top:16px;"><button class="ghost-btn" data-action="close-modal">Cancelar</button></div>
          </div>
        </section>
      </div>`;
    setTimeout(() => {
      const input = document.getElementById("sessionAuditStudentSearch");
      if (input) {
        input.focus();
        try { input.setSelectionRange(input.value.length, input.value.length); } catch (error) {}
      }
    }, 30);
  }

  async function confirmSessionAuditAssign(roll, index, upload = false) {
    if (state.activeSession?.role !== "admin") { toast("Solo el administrador puede asignar ID prueba."); return; }
    const cleanRoll = cleanId(roll);
    const studentIndex = Number(index);
    const student = state.studentsRegistry[studentIndex];
    if (!cleanRoll || !student) { toast("Selecciona un estudiante válido."); return; }
    const previous = cleanId(student.examId);
    state.studentsRegistry.forEach((row, idx) => {
      if (idx !== studentIndex && cleanId(row.examId) === cleanRoll) row.examId = "";
    });
    student.examId = cleanRoll;
    state.studentsRegistry[studentIndex] = normalizeStudentRow(student);
    state.studentsRegistry = state.studentsRegistry.map(normalizeStudentRow).filter((s) => s.examId || s.nationalId || s.name);
    writeJSON(STORAGE.students, { rows: state.studentsRegistry });
    buildRepository();
    state.sessionAuditStudentSearch = "";
    state.adminTab = "alerta-sesiones";
    closeModal();
    if (upload) {
      toast(previous && previous !== cleanRoll ? `ID prueba cambiado: ${previous} → ${cleanRoll}. Subiendo a Supabase...` : "ID prueba asignado. Subiendo a Supabase...");
      await publishAllToSupabase();
    } else {
      toast(previous && previous !== cleanRoll ? `ID prueba cambiado: ${previous} → ${cleanRoll}. Usa Subir a Supabase para dejarlo fijo.` : "ID prueba asignado localmente. Usa Subir a Supabase para dejarlo fijo.");
      renderAdminContext();
    }
  }


  const ADMIN_ROSTER_SUBJECTS = [
    { key: "matematicas", label: "MATEMÁTICAS", subject: "Matemáticas" },
    { key: "lenguaje", label: "LENGUAJE", subject: "Lenguaje" },
    { key: "naturales", label: "NATURALES", subject: "Ciencias Naturales" },
    { key: "sociales", label: "SOCIALES", subject: "Ciencias Sociales y Ciudadanía" },
    { key: "ingles", label: "INGLÉS", subject: "Inglés" },
    { key: "artistica", label: "ARTÍSTICA", subject: "Artística" },
    { key: "etica", label: "ÉTICA", subject: "Ética y Valores" },
    { key: "informatica", label: "INFORMÁTICA", subject: "Informática" },
    { key: "edufisica", label: "EDUFÍSICA", subject: "Educación Física" }
  ];

  function adminRosterBaseRows() {
    return (state.computedStudents || []).slice().sort((a, b) => {
      const sedeDiff = String(a.sede || "").localeCompare(String(b.sede || ""), "es", { numeric: true, sensitivity: "base" });
      if (sedeDiff) return sedeDiff;
      const gradeDiff = Number(a.grade || 0) - Number(b.grade || 0);
      if (gradeDiff) return gradeDiff;
      const groupDiff = String(a.group || "").localeCompare(String(b.group || ""), "es", { numeric: true, sensitivity: "base" });
      if (groupDiff) return groupDiff;
      return displayListName(a).localeCompare(displayListName(b), "es", { numeric: true, sensitivity: "base" });
    });
  }

  function adminRosterFilteredRows() {
    return adminRosterBaseRows()
      .filter((student) => state.adminRosterSede === "all" || String(student.sede || "") === String(state.adminRosterSede))
      .filter((student) => state.adminRosterGrade === "all" || String(student.grade || "") === String(state.adminRosterGrade))
      .filter((student) => state.adminRosterGroup === "all" || String(student.group || "") === String(state.adminRosterGroup));
  }

  function adminRosterFilterOptions() {
    const base = adminRosterBaseRows();
    const sedes = ["all", ...uniqueValues(base.map((student) => student.sede).filter(Boolean))];
    const grades = ["all", ...uniqueValues(base
      .filter((student) => state.adminRosterSede === "all" || String(student.sede || "") === String(state.adminRosterSede))
      .map((student) => student.grade).filter(Boolean)).sort((a, b) => Number(a) - Number(b))];
    const groups = ["all", ...uniqueValues(base
      .filter((student) => state.adminRosterSede === "all" || String(student.sede || "") === String(state.adminRosterSede))
      .filter((student) => state.adminRosterGrade === "all" || String(student.grade || "") === String(state.adminRosterGrade))
      .map((student) => student.group).filter(Boolean))];
    return { sedes, grades, groups };
  }

  function adminRosterScoreCell(student, subjectName) {
    const stat = student?.subjectStats?.[subjectName] || null;
    return scoreDisplayHtml(stat, "teacher-score teacher-score-plain admin-roster-score", false);
  }

  function adminRosterMatrixHtml() {
    const options = adminRosterFilterOptions();
    const rows = adminRosterFilteredRows();
    const totalMissing = rows.reduce((sum, student) => sum + ADMIN_ROSTER_SUBJECTS.filter((subject) => {
      const stat = student?.subjectStats?.[subject.subject];
      return stat?.total && stat.absent && Number(stat.score) === 0;
    }).length, 0);
    return `
      <section class="toolbar">
        <div>
          <span class="section-eyebrow">Control administrativo</span>
          <h2 style="margin:8px 0 0;font-weight:900;">Matriz de estudiantes y notas</h2>
          <p class="muted-copy">Muestra todos los estudiantes registrados en ESTUDIANTES. El <strong>0 rojo</strong> indica que el estudiante no presentó esa asignatura o no aparece en la sesión correspondiente.</p>
        </div>
        <div class="toolbar-right admin-roster-filters">
          <select class="select-pill" data-admin-roster-field="sede">
            ${options.sedes.map((value) => `<option value="${escAttr(value)}" ${String(state.adminRosterSede) === String(value) ? "selected" : ""}>${value === "all" ? "Todas las sedes" : esc(value)}</option>`).join("")}
          </select>
          <select class="select-pill" data-admin-roster-field="grade">
            ${options.grades.map((value) => `<option value="${escAttr(value)}" ${String(state.adminRosterGrade) === String(value) ? "selected" : ""}>${value === "all" ? "Todos los grados" : `${esc(value)}°`}</option>`).join("")}
          </select>
          <select class="select-pill" data-admin-roster-field="group">
            ${options.groups.map((value) => `<option value="${escAttr(value)}" ${String(state.adminRosterGroup) === String(value) ? "selected" : ""}>${value === "all" ? "Todos los cursos" : esc(value)}</option>`).join("")}
          </select>
        </div>
      </section>
      <section class="teacher-stat-strip teacher-stat-strip-two admin-roster-summary">
        <article><span>Estudiantes visibles</span><strong>${esc(rows.length)}</strong><small>según filtros activos</small></article>
        <article><span>Notas faltantes</span><strong>${esc(totalMissing)}</strong><small>ceros rojos detectados</small></article>
      </section>
      <section class="card table-card admin-roster-table-card">
        <div class="table-wrap admin-roster-table-wrap">
          <table class="admin-roster-table">
            <thead>
              <tr>
                <th>SEDE</th><th>GRADO</th><th>CURSO</th><th>ID_PRUEBA</th><th>ALUMNO</th>
                ${ADMIN_ROSTER_SUBJECTS.map((subject) => `<th>${esc(subject.label)}</th>`).join("")}
                <th>ACCIÓN</th>
              </tr>
            </thead>
            <tbody>
              ${rows.map((student) => {
                const roll = cleanId(student?.registry?.examId || student?.roll || "");
                const hasExam = !!roll && state.responsesByRoll.has(roll);
                return `
                  <tr>
                    <td>${esc(student.sede || "—")}</td>
                    <td class="tiny-cell">${student.grade ? `${esc(student.grade)}°` : "—"}</td>
                    <td class="tiny-cell">${esc(student.group || "—")}</td>
                    <td><strong>${esc(roll || "—")}</strong></td>
                    <td class="student-name-cell"><strong>${esc(displayListName(student))}</strong></td>
                    ${ADMIN_ROSTER_SUBJECTS.map((subject) => `<td class="score-cell">${adminRosterScoreCell(student, subject.subject)}</td>`).join("")}
                    <td class="row-actions"><button class="secondary-btn mini-btn" data-action="edit-student-exam" data-roll="${escAttr(roll)}" ${hasExam ? "" : "disabled title=\"No hay respuestas cargadas para este ID prueba\""}>Ver examen</button></td>
                  </tr>
                `;
              }).join("") || `<tr><td colspan="15" class="empty-state">No hay estudiantes con los filtros actuales.</td></tr>`}
            </tbody>
          </table>
        </div>
      </section>
    `;
  }

  function adminStudentsHtml() {
    const canEditExam = state.activeSession?.role === "admin";
    const grades = [...new Set(state.studentsRegistry.map((s) => s.grade).filter(Boolean))].sort((a, b) => a - b);
    const query = normalizeText(state.adminStudentSearch);
    let rows = state.studentsRegistry.filter((s) => {
      const matchesText = !query || normalizeText(`${s.name} ${s.examId} ${s.nationalId} ${s.group} ${s.sede}`).includes(query);
      const matchesGrade = state.adminGradeFilter === "all" || String(s.grade) === String(state.adminGradeFilter);
      return matchesText && matchesGrade;
    }).sort((a, b) => compareStudentsByName(a, b));

    return `
      <section class="toolbar">
        <div>
          <span class="section-eyebrow">Registro de estudiantes</span>
          <h2 style="margin:8px 0 0;font-weight:900;">Alumnos</h2>
          <p class="muted-copy">La tabla queda compacta. Para modificar datos o examen, usa los botones de acciones.</p>
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
        <button class="secondary-btn" data-action="publish-supabase">Subir a Supabase</button>
      </div>
      <section class="card table-card admin-students-compact">
        <div class="table-wrap">
          <table>
            <thead><tr><th>#</th><th>ID prueba</th><th>ID estudiante</th><th>Estudiante</th><th>Sede</th><th>Grado</th><th>Curso</th><th>Acciones</th></tr></thead>
            <tbody>
              ${rows.map((student, viewIndex) => {
                const index = state.studentsRegistry.indexOf(student);
                const hasExam = state.computedByRoll.has(cleanId(student.examId));
                return `
                  <tr>
                    <td><span class="badge gray">${viewIndex + 1}</span></td>
                    <td><strong>${esc(student.examId || "—")}</strong></td>
                    <td>${esc(student.nationalId || "—")}</td>
                    <td class="student-name-cell"><strong>${esc(displayListName(student))}</strong></td>
                    <td class="compact-cell">${esc(student.sede || "—")}</td>
                    <td class="tiny-cell">${esc(student.grade || "—")}°</td>
                    <td class="tiny-cell">${esc(student.group || "—")}</td>
                    <td class="row-actions">
                      <button class="secondary-btn mini-btn" data-action="edit-student-info" data-index="${index}">Editar info</button>
                      <button class="secondary-btn mini-btn" data-action="admin-view-student" data-roll="${escAttr(student.examId)}" ${hasExam ? "" : "disabled"}>Ver examen</button>
                      ${canEditExam ? `<button class="ghost-btn mini-btn" data-action="edit-student-exam" data-roll="${escAttr(student.examId)}" ${hasExam ? "" : "disabled"}>Editar examen</button>` : ""}
                      <button class="danger-btn mini-btn" data-action="delete-student" data-index="${index}">Eliminar</button>
                    </td>
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
    const resultStudents = evaluatedStudentsOnly(state.computedStudents);
    const sedes = ["all", ...uniqueValues(resultStudents.map((s) => s.sede))];
    const grades = ["all", ...uniqueValues(resultStudents
      .filter((s) => state.adminResultSede === "all" || s.sede === state.adminResultSede)
      .map((s) => s.grade).filter(Boolean)).sort((a, b) => Number(a) - Number(b))];
    const groups = ["all", ...uniqueValues(resultStudents
      .filter((s) => state.adminResultSede === "all" || s.sede === state.adminResultSede)
      .filter((s) => state.adminResultGrade === "all" || String(s.grade) === String(state.adminResultGrade))
      .map((s) => s.group))];
    const subjectBase = resultStudents
      .filter((s) => state.adminResultSede === "all" || s.sede === state.adminResultSede)
      .filter((s) => state.adminResultGrade === "all" || String(s.grade) === String(state.adminResultGrade))
      .filter((s) => state.adminResultGroup === "all" || s.group === state.adminResultGroup);
    const subjectOptions = ["all", ...uniqueValues(subjectBase.flatMap((student) => Object.entries(student.subjectStats || {})
      .filter(([name, stat]) => isExistingResultStat(student, statForSubject(student, name) || stat))
      .map(([name]) => name)))];
    const subject = state.adminResultSubject || "all";
    const isReady = state.adminResultSede !== "all" && state.adminResultGrade !== "all" && state.adminResultGroup !== "all" && subject !== "all";

    const filtered = isReady ? resultStudents.filter((student) => {
      const okSede = student.sede === state.adminResultSede;
      const okGrade = String(student.grade) === String(state.adminResultGrade);
      const okGroup = student.group === state.adminResultGroup;
      const okSubject = isExistingResultStat(student, statForSubject(student, subject));
      return okSede && okGrade && okGroup && okSubject;
    }) : [];
    const filteredSorted = sortRowsByState(filtered, "admin-results", (student, key) => {
      const stat = adminStudentSubjectStat(student, subject);
      if (key === "score") return stat.score;
      if (key === "correct") return stat.correct;
      return displayListName(student);
    });

    const details = aggregateDetails(filtered, subject);
    const scoreValues = scoresForSubjectAverage(filtered, subject);

    const rows = filteredSorted.map((student, index) => {
      const stat = adminStudentSubjectStat(student, subject);
      return `
        <tr class="table-row-click" data-action="open-detail" data-roll="${escAttr(student.roll)}" data-subject="${escAttr(subject)}">
          <td class="teacher-index">${index + 1}</td>
          <td><strong>${esc(displayListName(student))}</strong><br><span class="student-subid">ID Prueba ${esc(student.roll)} · ${esc(student.sede || "—")} · ${esc(student.grade)}° ${esc(student.group || "")}</span></td>
          <td>${scoreDisplayHtml(stat)}</td>
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
            <thead><tr><th>#</th><th>${sortHeader("Estudiante", "admin-results", "name")}</th><th>${sortHeader("Nota", "admin-results", "score")}</th><th>${sortHeader("Correctas", "admin-results", "correct")}</th></tr></thead>
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
    const hasComponents = hasMetricData(details, "component");
    const hasCompetences = hasMetricData(details, "competence");
    if (!hasComponents && !hasCompetences) return "";
    const active = hasComponents ? (state.metricTab === "competences" && hasCompetences ? "competences" : "components") : "competences";
    return `
      <div class="teacher-metric-tabbed ${hasComponents && hasCompetences ? "" : "single"}">
        ${hasComponents && hasCompetences ? `
          <div class="metric-tabs teacher-metric-tabs" role="tablist" aria-label="Promedio por componentes y competencias">
            <button class="metric-tab ${active === "components" ? "active" : ""}" data-action="select-metric-tab" data-tab="components">Componentes</button>
            <button class="metric-tab ${active === "competences" ? "active" : ""}" data-action="select-metric-tab" data-tab="competences">Competencias</button>
          </div>
        ` : ""}
        <div class="metric-grid teacher-metric-grid" data-active="${escAttr(active)}">
          ${hasComponents ? `<section class="metric-panel components"><h4>Promedio por componentes</h4>${buildMetricBars(details, "component")}</section>` : ""}
          ${hasCompetences ? `<section class="metric-panel competences"><h4>Promedio por competencias</h4>${buildMetricBars(details, "competence")}</section>` : ""}
        </div>
      </div>
    `;
  }

  function adminStudentSubjectStat(student, subject) {
    if (subject !== "all") {
      const stat = statForSubject(student, subject) || {};
      return { score: stat.score, correct: stat.correct || 0, total: stat.total || 0, absent: !!stat.absent };
    }
    const stats = SUBJECTS.map((subjectInfo) => statForSubject(student, subjectInfo.name)).filter((stat) => stat?.total);
    const scores = stats.map((stat) => scoreForAverageFromStudentStat(student, stat)).filter((value) => Number.isFinite(value));
    return {
      score: scores.length ? Math.round(scores.reduce((sum, value) => sum + value, 0) / scores.length) : null,
      correct: stats.reduce((sum, stat) => sum + (stat.correct || 0), 0),
      total: stats.reduce((sum, stat) => sum + (stat.total || 0), 0),
      absent: stats.length > 0 && scores.length === 0
    };
  }

  function uniqueValues(values) {
    return [...new Set(values.map((value) => cleanText(value)).filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b), "es", { numeric: true, sensitivity: "base" }));
  }

  function uniqueDisplayValues(values) {
    const map = new Map();
    (values || []).forEach((value) => {
      const clean = cleanText(value);
      const key = normalizeText(clean);
      if (!clean || !key) return;
      const current = map.get(key);
      const cleanIsAllCaps = clean === clean.toUpperCase() && /[A-ZÁÉÍÓÚÑ]/.test(clean);
      const currentIsAllCaps = current && current === current.toUpperCase() && /[A-ZÁÉÍÓÚÑ]/.test(current);
      if (!current || (currentIsAllCaps && !cleanIsAllCaps) || clean.length < current.length) map.set(key, clean);
    });
    return [...map.values()].sort((a, b) => String(a).localeCompare(String(b), "es", { numeric: true, sensitivity: "base" }));
  }

  function availableSubjects() {
    const fromKeys = uniqueValues(state.keys.map((key) => key.area));
    const base = SUBJECTS.map((subject) => subject.name);
    return [...new Set([...base, ...fromKeys].map(canonicalSubject).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b, "es", { sensitivity: "base" }));
  }


  function shortSubjectName(value) {
    const canonical = canonicalSubject(value);
    const match = SUBJECTS.find((subject) => sameSubject(subject.name, canonical) || normalizeText(subject.name) === normalizeText(canonical));
    if (match) return match.short || match.name;
    const clean = cleanText(canonical || value);
    if (!clean) return "Área";
    return clean;
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
      <div class="admin-note">Puedes ajustar la apariencia desde el panel. Para que los cambios públicos de apariencia queden disponibles para todos, usa <strong>Subir a Supabase</strong>.</div>
      <form id="appearanceForm" class="card card-pad">
        <div class="form-grid">
          <div class="field span-2">
            <label>Título superior</label>
            <input value="${escAttr(cfg.title)}" data-config-field="title">
          </div>
          <div class="field span-2">
            <label>Nombre de la app en Android / PWA</label>
            <input value="${escAttr(cfg.appName || cfg.title || "Roque Objetiva")}" data-config-field="appName">
            <small style="color:#7d8089;">Este nombre se usa en el manifiesto de la app instalable.</small>
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
            <label>Esquinas generales (px)</label>
            <input type="number" min="0" max="40" value="${escAttr(cfg.cornerRadius ?? cfg.buttonRadius ?? 4)}" data-config-field="cornerRadius">
            <small style="color:#7d8089;">Aplica a cuadros, contenedores, modales, tarjetas, tablas y botones.</small>
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
            <button class="ghost-btn" type="button" data-action="publish-supabase">Subir a Supabase</button>
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
        <div class="inline-actions"><button class="secondary-btn" data-action="reset-logos">Restaurar íconos</button><button class="ghost-btn" data-action="publish-supabase">Subir a Supabase</button></div>
      </section>
      <div class="admin-note">Los logos base siguen en la carpeta <strong>ICONOS</strong>. Los cambios de apariencia se sincronizan desde esta versión con <strong>Supabase</strong>.</div>
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
    return `
      <section class="toolbar">
        <div>
          <span class="section-eyebrow">Supabase</span>
          <h2 style="margin:8px 0 0;font-weight:900;">Subir cambios a la base privada</h2>
          <p class="muted-copy">Sin JSON públicos: los cambios administrativos se sincronizan con Supabase.</p>
        </div>
        <div class="inline-actions"><button class="primary-btn" type="button" data-action="publish-supabase">Subir cambios a Supabase</button></div>
      </section>
      <div class="admin-note github-note">
        Esta acción reemplaza en Supabase la estructura minimalista: estudiantes, docentes, carga_docente, claves, resultados, mapeo_areas y configuracion_app usando lo que tienes cargado en este panel.
      </div>
      <section class="card card-pad github-panel supabase-panel">
        <div class="github-publish-box">
          <h3>Qué se sube</h3>
          <ul style="margin:0;padding-left:18px;color:#4d5260;line-height:1.65;">
            <li>ESTUDIANTES</li>
            <li>DOCENTES y CARGA_DOCENTE</li>
            <li>KEYS / claves editadas</li>
            <li>RESULTADOS con cambios hechos desde Admin</li>
            <li>Configuración pública de apariencia y mapeos de áreas</li>
          </ul>
          <button class="primary-btn" type="button" data-action="publish-supabase">Subir cambios a Supabase</button>
        </div>
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
          <button class="secondary-btn" data-action="publish-supabase">Subir a Supabase</button>
        </div>
      </section>
      <div class="admin-note">La carga se organiza por docente. Cada tarjeta de asignatura puede modificarse o eliminarse. Para que todos vean los cambios, súbelos a Supabase.</div>
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
    const nombres = cleanText(row.nombres || row.NOMBRES || row.Nombres || row.NOMBRE || row.Nombre);
    const apellidos = cleanText(row.apellidos || row.APELLIDOS || row.Apellidos || row.APELLIDO || row.Apellido);
    const name = cleanText(row.name || row.NOMBRE_COMPLETO || row.NombreCompleto || row.NOMBRE || row.Nombre || (nombres && apellidos ? `${nombres} ${apellidos}` : (nombres || apellidos)));
    return {
      examId: cleanId(row.examId || row.ID_PRUEBA || row.IdPrueba || row.ID || row.id),
      nationalId: cleanId(row.nationalId || row.ID_ALUMNO || row.IdAlumno || row.Documento || row.documento),
      nombres,
      apellidos,
      name,
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
      if (subject !== "all") {
        const stat = statForSubject(student, subject);
        return isExistingResultStat(student, stat) ? (stat.details || []) : [];
      }
      return SUBJECTS.flatMap((s) => {
        const stat = statForSubject(student, s.name);
        return isExistingResultStat(student, stat) ? (stat.details || []) : [];
      });
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
      add(student.sede || "—", student.sede || "—", "", subject, student);
    });

    return [...map.values()].map((group) => {
      const scores = group.students.flatMap((student) => {
        if (group.subject && group.subject !== "all") return scoresForSubjectAverage([student], group.subject);
        return scoresForAllSubjectsAverage(student);
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
      if (!map.has(id)) map.set(id, { id, name: row.name || "", assignments: [], coordinator: false });
      const teacher = map.get(id);
      if (!teacher.name && row.name) teacher.name = row.name;
      if (row.coordinator) teacher.coordinator = true;
      teacher.assignments.push({ ...row, index });
    });
    return [...map.values()].sort((a, b) => String(a.name || a.id).localeCompare(String(b.name || b.id), "es", { sensitivity: "base" }));
  }

  function cargaTeacherDetailHtml(teacher) {
    const firstIndex = teacher.assignments[0]?.index;
    const baseRow = firstIndex !== undefined ? state.cargaRows[firstIndex] : { id: teacher.id, name: teacher.name };
    const isCoordinator = teacher.assignments.some((row) => row.coordinator);
    return `
      <div class="carga-teacher-head">
        <section class="docente-identity-summary">
          <div>
            <span class="section-eyebrow">Datos del docente</span>
            <h3>${esc(baseRow.name || teacher.name || "Docente sin nombre")}</h3>
            <p>ID ${esc(baseRow.id || teacher.id || "sin ID")}</p>
          </div>
          <button class="secondary-btn" data-action="edit-teacher-identity" data-id="${escAttr(teacher.id)}">Editar datos</button>
        </section>
        <label class="coordinator-check">
          <input type="checkbox" data-carga-coordinator="${escAttr(teacher.id)}" ${isCoordinator ? "checked" : ""}>
          <span>Coordinador: puede ver Estudiantes, Resultados y Claves</span>
        </label>
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
          <div><strong>${esc(row.subjectRaw || row.subject || "Carga sin asignatura")}</strong><span>${row.grade ? `${esc(row.grade)}°` : "Sin grado"} ${esc(row.group || "")} · ${esc(row.sede || "—")}</span></div>
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
          <button class="secondary-btn" data-action="publish-supabase">Subir a Supabase</button>
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
          <div><strong>Dirección de grupo</strong><span>${row.grade ? `${esc(row.grade)}°` : "Sin grado"} ${esc(row.group || "")} · ${esc(row.sede || "—")}</span></div>
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


  function keySourceOrder(row) {
    const idx = Number(row?.idx);
    if (Number.isFinite(idx)) return idx;
    const item = Number(row?.item);
    return Number.isFinite(item) ? item : 999999;
  }

  function compareKeysByOriginalOrder(a, b) {
    const gradeCompare = Number(a?.grade || 0) - Number(b?.grade || 0);
    if (gradeCompare) return gradeCompare;
    const pathCompare = String(a?.sourcePath || "").localeCompare(String(b?.sourcePath || ""), "es", { numeric: true, sensitivity: "base" });
    if (pathCompare) return pathCompare;
    const orderCompare = keySourceOrder(a) - keySourceOrder(b);
    if (orderCompare) return orderCompare;
    return Number(a?.item || 0) - Number(b?.item || 0);
  }

  function orderedSubjectsFromKeys(rows) {
    const seen = new Set();
    const ordered = [];
    rows.slice().sort(compareKeysByOriginalOrder).forEach((key) => {
      const subject = canonicalSubject(key.area || key.areaRaw);
      if (!subject) return;
      const id = normalizeText(subject);
      if (seen.has(id)) return;
      seen.add(id);
      ordered.push(subject);
    });
    return ordered;
  }

  function adminKeysHtml() {
    const canEditKeys = state.activeSession?.role === "admin";
    const grades = [...new Set(state.keys.map((k) => k.grade).filter(Boolean))].sort((a, b) => a - b);
    let grade = state.adminGradeFilter === "all" ? (grades[0] || "all") : state.adminGradeFilter;
    if (!grades.some((g) => String(g) === String(grade))) grade = grades[0] || "all";

    const gradeRows = state.keys
      .filter((key) => String(key.grade) === String(grade))
      .sort(compareKeysByOriginalOrder);
    const availableSubjects = orderedSubjectsFromKeys(gradeRows);
    let subject = state.adminSubjectFilter || "all";
    if (subject !== "all" && !availableSubjects.some((item) => sameSubject(item, subject))) subject = "all";

    let rows = gradeRows;
    if (subject !== "all") rows = rows.filter((key) => sameSubject(key.area, subject));
    rows = [...rows].sort(compareKeysByOriginalOrder);

    const title = canEditKeys ? "Claves de respuesta" : "Consulta de claves";
    const subtitle = canEditKeys
      ? "Selecciona grado y asignatura. Solo el administrador puede modificar las respuestas."
      : "Vista de consulta: las respuestas se muestran sin controles de edición.";

    return `
      <section class="toolbar keys-toolbar-v80">
        <div>
          <span class="section-eyebrow">Claves de respuesta</span>
          <h2 style="margin:8px 0 0;font-weight:900;">${esc(title)}</h2>
          <p class="muted-copy">${esc(subtitle)}</p>
        </div>
      </section>

      <section class="card card-pad keys-filter-card-v80">
        <div class="keys-filter-title">Grado</div>
        <div class="key-tab-row key-grade-tabs" role="tablist" aria-label="Seleccionar grado">
          ${grades.map((g) => `<button type="button" class="key-tab-btn ${String(grade) === String(g) ? "active" : ""}" data-action="key-grade-tab" data-grade="${escAttr(g)}">${esc(g)}°</button>`).join("") || `<span class="empty-state">No hay grados con claves cargadas.</span>`}
        </div>
        <div class="keys-filter-title subject-title">Área/asignatura</div>
        <div class="key-tab-row key-subject-tabs" role="tablist" aria-label="Seleccionar área o asignatura">
          <button type="button" class="key-tab-btn ${subject === "all" ? "active" : ""}" data-action="key-subject-tab" data-subject="all">Todas</button>
          ${availableSubjects.map((name) => `<button type="button" class="key-tab-btn ${sameSubject(subject, name) ? "active" : ""}" data-action="key-subject-tab" data-subject="${escAttr(name)}">${esc(shortSubjectName(name))}</button>`).join("")}
        </div>
      </section>

      ${canEditKeys ? `
        <div class="admin-note">Los cambios quedan guardados localmente al usar <strong>Guardar claves</strong>. Para publicarlos para todos, usa <strong>Subir a Supabase</strong>.</div>
        <div class="inline-actions" style="margin-bottom:14px;">
          <button class="secondary-btn" data-action="save-keys">Guardar claves</button>
          <button class="ghost-btn" data-action="export-keys">Exportar JSON</button>
          <button class="danger-btn" data-action="reset-keys">Restaurar claves originales</button>
          <button class="secondary-btn" data-action="publish-supabase">Subir a Supabase</button>
        </div>
      ` : `<div class="admin-note">Modo consulta. Las claves no se pueden editar desde una cuenta de coordinación.</div>`}

      <section class="card table-card keys-table-card-v80">
        <div class="table-wrap">
          <table>
            <thead><tr><th>Área</th><th>Ítem</th><th>Respuesta</th><th>Componente</th><th>Competencia</th></tr></thead>
            <tbody>
              ${rows.map((key) => `
                <tr>
                  <td>${esc(key.areaRaw || key.area)}</td>
                  <td><strong>${esc(key.item)}</strong></td>
                  <td>
                    ${canEditKeys ? `
                      <select class="small-input" data-key-id="${escAttr(keyId(key))}">
                        ${["A","B","C","D","E","F","G","H"].map((op) => `<option value="${op}" ${key.correct === op ? "selected" : ""}>${op}</option>`).join("")}
                      </select>
                    ` : `<strong class="answer-readonly">${esc(key.correct || "—")}</strong>`}
                  </td>
                  <td>${esc(key.component || "—")}</td>
                  <td>${esc(key.competence || "—")}</td>
                </tr>
              `).join("") || `<tr><td colspan="5" class="empty-state">No hay claves con este filtro.</td></tr>`}
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
      const teacher = state.teachers.get(state.activeSession?.id) || null;
      const hasAssignments = !!(teacher?.assignments || []).length;
      const hasDirector = !!(teacher?.directorGroups || []).length;
      const isCoordinator = !!teacher?.coordinator;
      const activeMode = state.teacherMode || "asignaturas";
      return `
        <nav class="app-nav teacher-top-nav">
          <button class="nav-chip ${activeMode === "asignaturas" ? "active" : ""}" onclick="window.__poTeacherModeFromElement&&window.__poTeacherModeFromElement(event,this)" data-action="teacher-mode" data-mode="asignaturas" ${hasAssignments ? "" : "disabled"}>Panel docente</button>
          ${hasDirector ? `<button class="nav-chip ${activeMode === "director" ? "active" : ""}" onclick="window.__poTeacherModeFromElement&&window.__poTeacherModeFromElement(event,this)" data-action="teacher-mode" data-mode="director">Panel director de grupo</button>` : ""}
          ${isCoordinator ? `<button class="nav-chip ${activeMode === "coord-estudiantes" ? "active" : ""}" onclick="window.__poTeacherModeFromElement&&window.__poTeacherModeFromElement(event,this)" data-action="teacher-mode" data-mode="coord-estudiantes">Estudiantes</button><button class="nav-chip ${activeMode === "coord-resultados" ? "active" : ""}" onclick="window.__poTeacherModeFromElement&&window.__poTeacherModeFromElement(event,this)" data-action="teacher-mode" data-mode="coord-resultados">Resultados</button><button class="nav-chip ${activeMode === "coord-estadisticas" ? "active" : ""}" onclick="window.__poTeacherModeFromElement&&window.__poTeacherModeFromElement(event,this)" data-action="teacher-mode" data-mode="coord-estadisticas">Estadísticas</button><button class="nav-chip ${activeMode === "coord-claves" ? "active" : ""}" onclick="window.__poTeacherModeFromElement&&window.__poTeacherModeFromElement(event,this)" data-action="teacher-mode" data-mode="coord-claves">Claves</button>` : ""}
          <button class="nav-chip logout" data-action="logout">Salir</button>
        </nav>
      `;
    }
    return "";
  }

  function setAnalysisField(field, value) {
    if (field === "mode") state.adminAnalysisMode = value === "area" ? "area" : "estructura";
    if (field === "sede") { state.adminAnalysisSede = value; state.adminAnalysisGrade = "all"; }
    if (field === "grade") state.adminAnalysisGrade = value;
    if (field === "subject") state.adminAnalysisSubject = value;
    state.adminAnalysisPath = {};
  }

  function drillAnalysis(level, value) {
    if (!level) return;
    if (!state.adminAnalysisPath) state.adminAnalysisPath = {};
    const mode = state.adminAnalysisMode === "area" ? "area" : "estructura";
    const activeOrder = mode === "area" ? ["subject", "sede", "grade", "course"] : ["sede", "grade", "course", "subject"];
    const idx = activeOrder.indexOf(level);
    if (idx >= 0) activeOrder.slice(idx + 1).forEach((key) => delete state.adminAnalysisPath[key]);
    if (String(state.adminAnalysisPath[level] || "") === String(value || "")) {
      delete state.adminAnalysisPath[level];
      if (idx >= 0) activeOrder.slice(idx + 1).forEach((key) => delete state.adminAnalysisPath[key]);
    } else {
      state.adminAnalysisPath[level] = value;
    }
    renderAdminContext();
  }

  function clearAnalysisFrom(level = "all") {
    if (level === "all") state.adminAnalysisPath = {};
    else {
      const order = state.adminAnalysisMode === "area" ? ["subject", "sede", "grade", "course"] : ["sede", "grade", "course", "subject"];
      const idx = order.indexOf(level);
      if (idx >= 0) order.slice(idx).forEach((key) => delete state.adminAnalysisPath[key]);
    }
    renderAdminContext();
  }

  window.__poAnalysisDrillFromElement = function(event, element) {
    if (event) { event.preventDefault(); event.stopPropagation(); }
    drillAnalysis(element?.dataset?.level || "", element?.dataset?.value || "");
  };

  window.__poAnalysisChangeFromElement = function(element) {
    setAnalysisField(element?.dataset?.adminAnalysisField || "", element?.value || "all");
    renderAdminContext();
  };

  window.__poAdminTabFromElement = function(event, element) {
    if (event) { event.preventDefault(); event.stopPropagation(); }
    const tab = element?.dataset?.tab || "resumen";
    if (!adminTabIds().has(tab)) return;
    state.adminTab = tab;
    if (state.adminTab !== "claves") state.adminSubjectFilter = "all";
    renderAdminContext();
  };

  window.__poTeacherModeFromElement = function(event, element) {
    if (event) { event.preventDefault(); event.stopPropagation(); }
    const mode = element?.dataset?.mode || "asignaturas";
    state.teacherMode = ["director", "asignaturas", "coord-estudiantes", "coord-resultados", "coord-estadisticas", "coord-claves"].includes(mode) ? mode : "asignaturas";
    renderBySession();
  };


  window.__poGraphToggleFromElement = function(event, element) {
    if (event) { event.preventDefault(); event.stopPropagation(); }
    toggleGraphNode(element?.dataset?.graphKey || "");
  };

  window.__poGraphChangeFromElement = function(element) {
    setGraphField(element?.dataset?.adminGraphField || "", element?.value || "all");
  };

  function handleSubmit(event) {
    if (event.target.id === "loginForm") {
      event.preventDefault();
      const loginParsed = parseRankingLoginInput(document.getElementById("loginUser").value);
      const user = loginParsed.login;
      const wantsRankingDebug = loginParsed.rankingDebug;
      const pass = String(document.getElementById("loginPass").value || "").trim();

      if (!user) return renderLogin("Ingresa un usuario o ID.");

      if (SUPABASE_CONFIG.enabled) {
        loginWithSupabase(user, pass, { rankingDebug: wantsRankingDebug });
        return;
      }

      if (normalizeText(user) === "admin") {
        if (pass === "Nintendo64!") {
          state.adminTab = "resumen";
          state.zeroToleranceShown = false;
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
        if (!(teacher?.assignments || []).length && !(teacher?.directorGroups || []).length && teacher?.coordinator) state.teacherMode = "coord-estudiantes";
        state.zeroToleranceShown = false;
        enterSessionWithLoader({ role: "teacher", id: user }, () => renderTeacher(teacher), "Preparando vista docente...");
        return;
      }

      if (state.studentLogin.has(user)) {
        const roll = state.studentLogin.get(user);
        enterStudentSessionWithRankingMode(roll, { debug: wantsRankingDebug, message: wantsRankingDebug ? "Preparando diagnóstico de ranking..." : "Calculando ranking y preparando resultados..." });
        return;
      }

      if (state.responsesByRoll.has(user)) {
        enterStudentSessionWithRankingMode(user, { debug: wantsRankingDebug, message: wantsRankingDebug ? "Preparando diagnóstico de ranking..." : "Calculando ranking y preparando resultados..." });
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

    const opensNestedModal = new Set([
      "admin-student-subject",
      "open-answer-key",
      "answer-info",
      "edit-carga-assignment",
      "add-carga-to-teacher",
      "open-grade-subject-map",
      "edit-director-assignment",
      "add-director-assignment"
    ]);
    if (opensNestedModal.has(action) && modalRoot.querySelector(".modal-backdrop")) {
      state.modalStack.push(modalRoot.innerHTML);
    }

    if (action === "retry") {
      init();
    }

    if (action === "quick-login") {
      startRecentLogin(target.dataset.loginKey || "");
      return;
    }

    if (action === "remove-recent-login") {
      event.preventDefault();
      event.stopPropagation();
      removeRecentLogin(target.dataset.loginKey || "");
      return;
    }

    if (action === "logout") {
      logoutWithFade();
      return;
    }

    if (action === "student-ranking-debug-next") {
      const roll = cleanId(target.dataset.roll || state.activeSession?.roll || "");
      state.zeroToleranceShown = false;
      state.activeSession = { ...(state.activeSession || {}), role: "student", roll, rankingDebugRequested: false, rankingDebugDone: true, rankingDebugVersion: "v135" };
      writeJSON(STORAGE.session, state.activeSession);
      return enterSessionWithLoader(state.activeSession, () => renderStudent(roll), "Abriendo tus resultados...");
    }

    if (action === "student-ranking-debug-refresh") {
      const roll = cleanId(target.dataset.roll || state.activeSession?.roll || "");
      if (state.activeSession?.role === "student") {
        state.activeSession.rankingDebugRequested = true;
        state.activeSession.rankingDebugDone = false;
        state.activeSession.rankingDebugVersion = "v135";
        writeJSON(STORAGE.session, state.activeSession);
      }
      state.studentRankDebugByRoll?.delete?.(roll);
      await prepareStudentRankingContext(roll);
      return renderStudentRankingDebug(roll);
    }

    if (action === "print") {
      window.print();
    }

    if (action === "select-subject") {
      const nextSubject = target.dataset.subject;
      if (state.activeSession?.role === "student" && isMobileViewport()) {
        openStudentSubjectModal(nextSubject);
      } else {
        transitionStudentSubject(nextSubject, target);
      }
      return;
    }


    if (action === "map-sede-tab") {
      state.adminMapSede = displaySedeForMap(target.dataset.sede || "");
      renderAdminContext();
      return;
    }

    if (action === "map-grade-tab") {
      state.adminMapGrade = toInt(target.dataset.grade) || state.adminMapGrade || 6;
      renderAdminContext();
      return;
    }

    if (action === "open-grade-subject-map") {
      openGradeSubjectMapModal(toInt(target.dataset.grade), target.dataset.subject || "");
      return;
    }

    if (action === "confirm-grade-subject-map") {
      confirmGradeSubjectMapAssignment();
      return;
    }

    if (action === "delete-grade-map-row") {
      openDeleteCargaWarning(Number(target.dataset.index));
      return;
    }

    if (action === "key-grade-tab") {
      state.adminGradeFilter = target.dataset.grade || state.adminGradeFilter;
      state.adminSubjectFilter = "all";
      renderAdminContext();
      return;
    }

    if (action === "key-subject-tab") {
      state.adminSubjectFilter = target.dataset.subject || "all";
      renderAdminContext();
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
      const assignments = (teacher?.assignments || []).filter((assignment) => sameSubject(subjectNameForAssignment(assignment), subject) || sameSubject(assignment.subject, subject) || sameSubject(assignment.subjectRaw, subject));
      state.teacherActive = assignments.find((assignment) => state.computedStudents.some((student) => teacherAssignmentMatches(student, assignment))) || assignments[0] || null;
      renderBySession();
      return;
    }

    if (action === "graph-toggle") {
      event.preventDefault();
      toggleGraphNode(target.dataset.graphKey || "");
      return;
    }

    if (action === "graph-clear") {
      event.preventDefault();
      state.adminGraphOpen = {};
      renderAdminContext();
      return;
    }

    if (action === "analysis-drill") {
      drillAnalysis(target.dataset.level || "", target.dataset.value || "");
      return;
    }

    if (action === "analysis-clear") {
      clearAnalysisFrom(target.dataset.level || "all");
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
      const mode = target.dataset.mode || "asignaturas";
      state.teacherMode = ["director", "asignaturas", "coord-estudiantes", "coord-resultados", "coord-estadisticas", "coord-claves"].includes(mode) ? mode : "asignaturas";
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
      return;
    }

    if (action === "admin-view-student") {
      openAdminStudentReportModal(target.dataset.roll);
      return;
    }

    if (action === "edit-student-info") {
      openEditStudentInfoModal(Number(target.dataset.index));
      return;
    }

    if (action === "confirm-edit-student-info") {
      confirmEditStudentInfo(Number(target.dataset.index));
      return;
    }

    if (action === "edit-student-exam") {
      if (state.activeSession?.role !== "admin") { toast("Solo el administrador puede editar exámenes."); return; }
      openEditStudentExamModal(target.dataset.roll);
      return;
    }

    if (action === "exam-edit-tab") {
      if (state.activeSession?.role !== "admin") { toast("Solo el administrador puede editar exámenes."); return; }
      openEditStudentExamModal(target.dataset.roll, target.dataset.subject);
      return;
    }

    if (action === "set-student-answer") {
      if (state.activeSession?.role !== "admin") { toast("Solo el administrador puede editar exámenes."); return; }
      setStudentAnswer(target.dataset.roll, Number(target.dataset.item), target.dataset.option);
      target.closest(".exam-option-row")?.querySelectorAll(".exam-option-btn").forEach((btn) => btn.classList.remove("active"));
      target.classList.add("active");
      return;
    }

    if (action === "clear-student-answer") {
      if (state.activeSession?.role !== "admin") { toast("Solo el administrador puede editar exámenes."); return; }
      setStudentAnswer(target.dataset.roll, Number(target.dataset.item), "");
      target.closest(".exam-option-row")?.querySelectorAll(".exam-option-btn").forEach((btn) => btn.classList.remove("active"));
      return;
    }

    if (action === "save-student-exam" || action === "save-student-exam-upload") {
      if (state.activeSession?.role !== "admin") { toast("Solo el administrador puede guardar exámenes."); return; }
      persistResultOverrides();
      buildRepository();
      closeModal();
      if (action === "save-student-exam-upload") {
        toast("Examen actualizado. Subiendo a Supabase...");
        await publishAllToSupabase();
      } else {
        toast("Examen actualizado localmente. Usa Subir a Supabase para dejarlo fijo.");
        renderAdminContext();
      }
      return;
    }

    if (action === "admin-student-subject") {
      openStudentSubjectModalForRoll(target.dataset.roll, target.dataset.subject, true);
      return;
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

    if (action === "force-admin-stats") {
      openAdminStatsView(event);
      return;
    }

    if (action === "admin-tab") {
      event.preventDefault();
      const tab = target.dataset.tab || "resumen";
      if (adminTabIds().has(tab)) {
        state.adminTab = tab;
        if (state.adminTab !== "claves") {
          state.adminSubjectFilter = "all";
        }
        renderAdminContext();
      }
      return;
    }

    if (action === "clear-banner") {
      state.config.bannerImage = "";
      writeJSON(STORAGE.config, state.config);
      toast("Imagen de banner eliminada.");
      renderAdminContext();
    }

    if (action === "export-config") {
      downloadFile("configuracion-resultados.json", JSON.stringify({ config: buildRepoConfigPreview(), logos: state.logos }, null, 2), "application/json");
    }

    if (action === "publish-github" || action === "publish-supabase") {
      await publishAllToSupabase();
      return;
    }

    if (action === "reset-logos") {
      state.logos = {};
      writeJSON(STORAGE.logos, state.logos);
      toast("Íconos restaurados.");
      renderAdminContext();
    }

    if (action === "clear-subject-logo") {
      delete state.logos[target.dataset.subject];
      writeJSON(STORAGE.logos, state.logos);
      toast("Logo eliminado.");
      renderAdmin();
    }



    if (action === "open-session-audit-assign") {
      openSessionAuditAssignModal(target.dataset.roll || "");
      return;
    }

    if (action === "confirm-session-audit-assign" || action === "confirm-session-audit-assign-upload") {
      await confirmSessionAuditAssign(target.dataset.roll || "", target.dataset.index, action === "confirm-session-audit-assign-upload");
      return;
    }

    if (action === "link-orphan-exam") {
      openLinkOrphanExamModal(target.dataset.roll || "");
      return;
    }

    if (action === "confirm-link-orphan-exam") {
      confirmLinkOrphanExam(target.dataset.roll || "");
      return;
    }

    if (action === "add-student-from-orphan") {
      openAddStudentFromOrphanModal(target.dataset.roll || "");
      return;
    }

    if (action === "confirm-add-student-from-orphan") {
      confirmAddStudentFromOrphan(target.dataset.roll || "");
      return;
    }

    if (action === "add-student") {
      state.studentsRegistry.unshift({ examId: "", nationalId: "", name: "", sede: "", grade: 10, group: "" });
      renderAdminContext();
      setTimeout(() => openEditStudentInfoModal(0), 60);
      return;
    }

    if (action === "delete-student") {
      openDeleteStudentWarning(Number(target.dataset.index), false);
      return;
    }

    if (action === "confirm-delete-student") {
      deleteStudentByIndex(Number(target.dataset.index), false);
      return;
    }

    if (action === "director-delete-student") {
      openDeleteStudentWarningByRoll(target.dataset.roll || "", true);
      return;
    }

    if (action === "confirm-director-delete-student") {
      deleteStudentByRoll(target.dataset.roll || "", true);
      return;
    }

    if (action === "save-students") {
      state.studentsRegistry = state.studentsRegistry.map(normalizeStudentRow).filter((s) => s.examId || s.nationalId || s.name);
      writeJSON(STORAGE.students, { rows: state.studentsRegistry });
      buildRepository();
      toast("Estudiantes guardados localmente.");
      renderAdminContext();
      return;
    }

    if (action === "export-students") {
      exportStudents();
      return;
    }

    if (action === "select-carga-teacher") {
      state.adminCargaTeacherId = target.dataset.id || "";
      if (isMobileViewport()) openTeacherAdminModal(state.adminCargaTeacherId);
      else renderAdminContext();
      return;
    }

    if (action === "open-teacher-admin") {
      openTeacherAdminModal(target.dataset.id || state.adminCargaTeacherId || "");
      return;
    }

    if (action === "edit-carga-assignment") {
      openEditCargaAssignmentModal(Number(target.dataset.index));
      return;
    }

    if (action === "confirm-edit-carga-assignment") {
      confirmEditCargaAssignment(Number(target.dataset.index));
      return;
    }

    if (action === "edit-director-assignment") {
      openEditDirectorAssignmentModal(Number(target.dataset.index));
      return;
    }

    if (action === "confirm-edit-director-assignment") {
      confirmEditDirectorAssignment(Number(target.dataset.index));
      return;
    }

    if (action === "sort-table") {
      tableSort(target.dataset.scope || "default", target.dataset.key || "name");
      renderAdminContext();
      return;
    }

    if (action === "subject-area-map") {
      const subject = target.dataset.subject;
      const area = target.dataset.area;
      if (subject && area) {
        setSubjectAreaMap(subject, area);
        writeJSON(STORAGE.subjectAreas, state.subjectAreaMap);
        normalizeCargaRows();
        buildRepository();
        renderAdminContext();
      }
      return;
    }

    if (action === "assign-subject-area-manual") {
      const subject = document.getElementById("subjectAreaMapSubject")?.value || "";
      const area = document.getElementById("subjectAreaMapArea")?.value || "";
      if (!subject || !area) {
        toast("Selecciona asignatura y área.");
        return;
      }
      setSubjectAreaMap(subject, area);
      writeJSON(STORAGE.subjectAreas, state.subjectAreaMap);
      normalizeCargaRows();
      buildRepository();
      toast(`${subject} asignada a ${area}.`);
      renderAdminContext();
      return;
    }

    if (action === "remove-subject-area-map") {
      const subject = target.dataset.subject || "";
      removeSubjectAreaMap(subject);
      writeJSON(STORAGE.subjectAreas, state.subjectAreaMap);
      normalizeCargaRows();
      buildRepository();
      toast("Asignatura quitada del área. Quedará en pendientes hasta que la reasignes.");
      renderAdminContext();
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
      renderAdminContext();
      return;
    }

    if (action === "edit-teacher-identity") {
      openEditTeacherIdentityModal(target.dataset.id || state.adminCargaTeacherId || "");
      return;
    }

    if (action === "confirm-edit-teacher-identity") {
      confirmEditTeacherIdentity(target.dataset.oldId || "");
      return;
    }

    if (action === "delete-carga-teacher") {
      openDeleteTeacherWarning(target.dataset.id || "");
      return;
    }

    if (action === "confirm-delete-carga-teacher") {
      const id = target.dataset.id || "";
      state.cargaRows = state.cargaRows.filter((row) => row.id !== id);
      state.directorRows = state.directorRows.filter((row) => row.id !== id);
      state.adminCargaTeacherId = "";
      state.adminDirectorTeacherId = "";
      normalizeDirectorRows();
      buildRepository();
      closeModal();
      toast("Docente eliminado de cargas y direcciones.");
      renderAdminContext();
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
      state.cargaRows.push({ id: existing.id, name: existing.name, subjectRaw, subject: mappedSubject(subjectRaw), sede, grade, group });
      state.adminCargaTeacherId = existing.id;
      closeModal();
      renderAdminContext();
      return;
    }

    if (action === "add-carga") {
      state.cargaRows.unshift({ id: "", name: "", subjectRaw: "Matemáticas", subject: "Matemáticas", sede: "", grade: 10, group: "" });
      renderAdminContext();
    }

    if (action === "delete-carga") {
      openDeleteCargaWarning(Number(target.dataset.index));
      return;
    }

    if (action === "confirm-delete-carga") {
      const index = Number(target.dataset.index);
      if (state.cargaRows[index]) state.cargaRows.splice(index, 1);
      buildRepository();
      closeModal();
      toast("Carga eliminada.");
      renderAdminContext();
      return;
    }

    if (action === "save-carga") {
      normalizeCargaRows();
      writeJSON(STORAGE.carga, { rows: state.cargaRows });
      writeJSON(STORAGE.subjectAreas, state.subjectAreaMap);
      writeJSON(STORAGE.directores, { rows: state.directorRows });
      buildRepository();
      toast("Carga guardada localmente.");
      renderAdminContext();
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
      openDeleteDirectorWarning(Number(target.dataset.index));
      return;
    }

    if (action === "confirm-delete-director") {
      const index = Number(target.dataset.index);
      if (state.directorRows[index]) state.directorRows.splice(index, 1);
      normalizeDirectorRows();
      buildRepository();
      closeModal();
      toast("Dirección de grupo eliminada.");
      renderAdminContext();
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
      if (state.activeSession?.role !== "admin") { toast("Solo el administrador puede editar claves."); return; }
      saveKeys();
      toast("Claves guardadas localmente.");
      renderAdmin();
    }

    if (action === "export-keys") {
      if (state.activeSession?.role !== "admin") { toast("Solo el administrador puede exportar claves desde esta vista."); return; }
      exportKeys();
    }

    if (action === "reset-keys") {
      if (state.activeSession?.role !== "admin") { toast("Solo el administrador puede restaurar claves."); return; }
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
      clearTimeout(state._studentSearchTimer);
      state._studentSearchTimer = setTimeout(() => renderAdminContext(), 220);
    }


    if (target.dataset.action === "session-audit-student-search") {
      state.sessionAuditStudentSearch = target.value;
      const roll = target.dataset.roll || state.sessionAuditAssignRoll || "";
      clearTimeout(state._sessionAuditSearchTimer);
      state._sessionAuditSearchTimer = setTimeout(() => openSessionAuditAssignModal(roll), 160);
    }

    if (target.dataset.adminRosterField) {
      setAdminRosterField(target.dataset.adminRosterField, target.value);
      renderAdminContext();
      return;
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

    // v86: los datos personales del docente se editan desde un modal y se guardan con boton.

    if (target.dataset.cargaCoordinator) {
      const id = target.dataset.cargaCoordinator;
      state.cargaRows.forEach((row) => {
        if (row.id === id) row.coordinator = !!target.checked;
      });
      buildRepository();
      renderAdminContext();
      return;
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


  function setAdminRosterField(field, value) {
    const clean = value || "all";
    if (field === "sede") {
      state.adminRosterSede = clean;
      state.adminRosterGrade = "all";
      state.adminRosterGroup = "all";
    } else if (field === "grade") {
      state.adminRosterGrade = clean;
      state.adminRosterGroup = "all";
    } else if (field === "group") {
      state.adminRosterGroup = clean;
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

    if (target.dataset.adminRosterField) {
      setAdminRosterField(target.dataset.adminRosterField, target.value);
      renderAdminContext();
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
      renderAdminContext();
      return;
    }

    if (target.dataset.adminStatsField) {
      setAdminStatsField(target.dataset.adminStatsField, target.value);
      renderAdminContext();
      return;
    }

    if (target.dataset.adminGraphField) {
      setGraphField(target.dataset.adminGraphField, target.value);
      return;
    }

    if (target.dataset.adminAnalysisField) {
      setAnalysisField(target.dataset.adminAnalysisField, target.value);
      renderAdminContext();
      return;
    }

    if (target.dataset.action === "admin-grade-filter") {
      state.adminGradeFilter = target.value;
      renderAdminContext();
    }

    if (target.dataset.action === "admin-subject-filter") {
      state.adminSubjectFilter = target.value;
      renderAdminContext();
    }

    if (target.dataset.action === "upload-logo-main") {
      readImageFile(target.files?.[0], (dataUrl) => {
        state.config.logoImage = dataUrl;
        state.config.identityVersion = DEFAULT_CONFIG.identityVersion || APP_VERSION;
        state.config.logoAssetVersion = DEFAULT_CONFIG.logoAssetVersion || APP_VERSION;
        writeJSON(STORAGE.config, state.config);
        toast("Logo principal actualizado.");
        renderAdmin();
      });
    }

    if (target.dataset.action === "upload-app-icon") {
      readImageFile(target.files?.[0], (dataUrl) => {
        state.config.appIcon = dataUrl;
        state.config.identityVersion = DEFAULT_CONFIG.identityVersion || APP_VERSION;
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
      if (state.activeSession?.role !== "admin") return;
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
    const radius = clamp(Number(state.config.cornerRadius ?? state.config.buttonRadius ?? 4), 0, 40);
    state.config.cornerRadius = radius;
    state.config.buttonRadius = radius;
    state.config.logoZoom = clamp(Number(state.config.logoZoom ?? 1), 0.65, 2.4);
    writeJSON(STORAGE.config, state.config);
  }

  function normalizeCargaRows() {
    state.cargaRows = state.cargaRows
      .map((row) => ({
        id: cleanId(row.id),
        name: cleanText(row.name),
        subjectRaw: cleanText(row.subjectRaw || row.subject),
        subject: mappedSubject(row.subjectRaw || row.subject),
        sede: cleanText(row.sede),
        grade: toInt(row.grade),
        group: cleanText(row.group),
        coordinator: !!row.coordinator
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
      subjectLogos: { ...state.config.subjectLogos, ...state.logos },
      subjectAreaMap: { ...state.subjectAreaMap }
    };
  }

  function exportRankingRows() {
    const students = (state.computedStudents || [])
      .filter((student) => studentHasExistingResult(student))
      .slice()
      .sort((a, b) => {
        const gradeDiff = Number(a.grade || 0) - Number(b.grade || 0);
        if (gradeDiff) return gradeDiff;
        const courseDiff = courseRankKey(a).localeCompare(courseRankKey(b), "es", { numeric: true, sensitivity: "base" });
        if (courseDiff) return courseDiff;
        return (Number(a.gradeRank || 999999) - Number(b.gradeRank || 999999)) || displayListName(a).localeCompare(displayListName(b), "es", { numeric: true, sensitivity: "base" });
      });
    return students.map((student) => ({
      ID_PRUEBA: student.roll || student.registry?.examId || "",
      ID_ALUMNO: student.registry?.nationalId || "",
      NOMBRE: displayListName(student),
      SEDE: student.sede || student.registry?.sede || "",
      GRADO: String(student.grade || ""),
      GRUPO: student.group || student.registry?.group || "",
      PUNTAJE_GLOBAL: student.globalScore ?? "",
      PUNTAJE_BRUTO: student.rawGlobalScore ?? "",
      PUESTO_GRADO: student.gradeRank ?? "",
      TOTAL_GRADO: student.gradeCount ?? "",
      PUESTO_CURSO: student.courseRank ?? "",
      TOTAL_CURSO: student.courseCount ?? ""
    }));
  }

  function buildSupabaseSyncPayload() {
    state.studentsRegistry = state.studentsRegistry.map(normalizeStudentRow).filter((s) => s.examId || s.nationalId || s.name);
    normalizeCargaRows();
    normalizeDirectorRows();
    saveKeys();
    persistResultOverrides();
    buildRepository();

    const keyGroups = Array.from(new Set(state.keys.map((row) => Number(row.grade)).filter(Boolean)))
      .sort((a, b) => a - b)
      .map((grade) => ({
        grade,
        rows: exportKeyRows(state.keys.filter((row) => Number(row.grade) === grade))
      }));

    const resultGroups = exportResultFilesForRepo().map((file) => {
      const match = String(file.path || "").match(/(\d{1,2})S(\d)/i);
      const rows = JSON.parse(file.content || "[]");
      const grade = match ? Number(match[1]) : inferGradeFromPath(file.path);
      const session = match ? Number(match[2]) : inferSessionFromPath(file.path);
      return {
        grade,
        session,
        startItem: session === 2 ? 71 : 1,
        rows
      };
    }).filter((group) => group.grade && group.session);

    const rankingRows = exportRankingRows();
    return {
      version: APP_VERSION,
      savedAt: new Date().toISOString(),
      settings: {
        config: buildRepoConfigPreview()
      },
      datasets: {
        estudiantes: exportStudentRows(),
        carga: exportCargaRows(),
        directoresGrupo: exportDirectoresRows(),
        keys: keyGroups,
        resultados: resultGroups,
        ranking: rankingRows
      }
    };
  }

  function getSupabaseAdminPassword() {
    let password = sessionStorage.getItem("po_supabase_admin_password") || "";
    if (!password) {
      password = window.prompt("Confirma la contraseña de administrador para subir a Supabase:") || "";
      if (password) sessionStorage.setItem("po_supabase_admin_password", password);
    }
    return password;
  }

  async function publishAllToSupabase() {
    if (!SUPABASE_CONFIG.enabled) {
      toast("Supabase no está habilitado en esta versión.");
      return;
    }
    if (state.activeSession?.role !== "admin") {
      toast("Solo el administrador puede subir cambios a Supabase.");
      return;
    }
    const password = getSupabaseAdminPassword();
    if (!password) return;
    const payload = buildSupabaseSyncPayload();
    showRouteLoader("Subiendo cambios a Supabase...");
    try {
      const result = await supabaseRpc("roque_admin_sync", { p_password: password, p_payload: payload });
      if (!result?.ok) throw new Error(result?.error || "Supabase rechazó la sincronización.");
      toast("Cambios subidos a Supabase.");
      localStorage.removeItem(STORAGE.students);
      localStorage.removeItem(STORAGE.carga);
      localStorage.removeItem(STORAGE.directores);
      localStorage.removeItem(STORAGE.answers);
      localStorage.removeItem(STORAGE.resultOverrides);
      localStorage.removeItem(STORAGE.subjectAreas);
      renderAdminContext();
    } catch (error) {
      console.error(error);
      toast(error.message || "No se pudo subir a Supabase.");
      if (/contrase/i.test(error.message || "")) sessionStorage.removeItem("po_supabase_admin_password");
    } finally {
      hideRouteLoader();
    }
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
      const repoConfig = { ...state.config, subjectLogos: {}, subjectAreaMap: { ...state.subjectAreaMap } };
      delete repoConfig.github;

      if (isDataUrl(repoConfig.logoImage)) {
        const ext = extensionFromDataUrl(repoConfig.logoImage);
        const path = `assets/logo-principal-${Date.now()}.${ext}`;
        files.push({ path, contentBase64: base64FromDataUrl(repoConfig.logoImage) });
        repoConfig.logoImage = path;
      }

      if (isDataUrl(repoConfig.bannerImage)) {
        const ext = extensionFromDataUrl(repoConfig.bannerImage);
        const path = `assets/banner-principal-${Date.now()}.${ext}`;
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
      for (const file of exportResultFilesForRepo()) {
        files.push(file);
      }

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
      persistResultOverrides();
      writeJSON(STORAGE.subjectAreas, state.subjectAreaMap);
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
    return state.studentsRegistry.map((row) => {
      const nombres = cleanText(row.nombres);
      const apellidos = cleanText(row.apellidos);
      const full = cleanText(row.name);
      const computed = state.computedByRoll?.get?.(cleanId(row.examId));
      const meta = mergeRankMeta(row.serverRank, computed ? {
        globalScore: computed.globalScore,
        rawGlobalScore: computed.rawGlobalScore,
        gradeRank: computed.gradeRank,
        gradeCount: computed.gradeCount,
        courseRank: computed.courseRank,
        courseCount: computed.courseCount
      } : null);
      return {
        ID_ALUMNO: row.nationalId || "",
        ID_PRUEBA: row.examId || "",
        APELLIDOS: apellidos || "",
        NOMBRES: nombres || full || "",
        SEDE: row.sede || "",
        GRADO: String(row.grade || ""),
        GRUPO: row.group || "",
        PUNTAJE_GLOBAL: meta.globalScore ?? "",
        PUNTAJE_BRUTO: meta.rawGlobalScore ?? "",
        PUESTO_GRADO: meta.gradeRank ?? "",
        TOTAL_GRADO: meta.gradeCount ?? "",
        PUESTO_CURSO: meta.courseRank ?? "",
        TOTAL_CURSO: meta.courseCount ?? ""
      };
    });
  }

  function exportCargaRows() {
    return state.cargaRows.map((row) => ({
      ID: row.id,
      NOMBRE: row.name,
      ASIGNATURA: row.subjectRaw || row.subject,
      SEDE: row.sede || "",
      GRADO: String(row.grade || ""),
      CURSO: row.group || "",
      COORDINADOR: row.coordinator ? "SI" : "NO"
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
      .sort(compareKeysByOriginalOrder)
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
            <section class="score-explain-card score-explain-clean">
              <div class="score-mini-hero">
                <span>Valor de cada ítem</span>
                <strong>${esc(itemValue)}<small> puntos</small></strong>
              </div>

              <div class="formula-steps teacher-formula-steps">
                <div class="formula-step">
                  <span>1</span>
                  <p>La escala va de <strong>20</strong> a <strong>100</strong>. La diferencia entre esos dos valores es <strong>80 puntos</strong>.</p>
                </div>
                <div class="formula-step">
                  <span>2</span>
                  <p>Esos <strong>80 puntos</strong> se reparten entre los <strong>${esc(total || "ítems")}</strong> ítems de la prueba.</p>
                </div>
                <div class="formula-line colorful">(100 − 20) ÷ ${esc(total || "total de ítems")} = ${esc(itemValue)} puntos por ítem</div>
                <div class="formula-step">
                  <span>3</span>
                  <p>La nota se calcula sumando a la base mínima <strong>20</strong> el valor de los ítems correctos.</p>
                </div>
                <div class="formula-line">Nota = 20 + (correctas × ${esc(itemValue)})</div>
                ${total ? `<div class="formula-step"><span>4</span><p>Ejemplo: con <strong>${exampleCorrect}</strong> correctas de <strong>${total}</strong>, la nota sería <strong>20 + (${exampleCorrect} × ${esc(itemValue)}) = ${exampleScore}</strong>.</p></div>` : `<p>Cuando haya ítems registrados para esta asignatura, aquí se mostrará el valor exacto por pregunta.</p>`}
              </div>
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
      .sort(compareKeysByOriginalOrder);
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
    const requestedStat = statForSubject(student, subject);
    const realSubject = requestedStat?.total ? (requestedStat.subject || subject) : SUBJECTS.find((s) => statForSubject(student, s.name)?.total)?.name;
    const stat = statForSubject(student, realSubject);
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
    const stat = statForSubject(student, subject);
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



  function openEditTeacherIdentityModal(id) {
    const clean = cleanId(id || state.adminCargaTeacherId || "");
    const teacher = buildUnifiedTeachers().find((item) => cleanId(item.id) === clean) || buildCargaTeachers().find((item) => cleanId(item.id) === clean);
    if (!teacher) return;
    document.body.classList.add("modal-open");
    modalRoot.innerHTML = `
      <div class="modal-backdrop" data-action="close-modal">
        <section class="modal teacher-identity-modal" style="max-width:560px;">
          <div class="modal-head">
            <div>
              <h2>Editar docente</h2>
              <span style="color:#7d8089;font-weight:600;">Modifica el ID o el nombre y guarda cuando termines.</span>
            </div>
            <button type="button" class="icon-btn" data-action="close-modal" aria-label="Cerrar">×</button>
          </div>
          <div class="modal-body">
            <div class="form-grid compact">
              <div class="field"><label>ID docente</label><input id="editTeacherId" value="${escAttr(teacher.id || "")}" autocomplete="off"></div>
              <div class="field"><label>Nombre docente</label><input id="editTeacherName" value="${escAttr(teacher.name || "")}" autocomplete="off"></div>
            </div>
            <div class="inline-actions" style="margin-top:16px;">
              <button class="primary-btn" data-action="confirm-edit-teacher-identity" data-old-id="${escAttr(teacher.id || "")}">Guardar datos</button>
              <button class="ghost-btn" data-action="close-modal">Cancelar</button>
            </div>
          </div>
        </section>
      </div>`;
  }

  function confirmEditTeacherIdentity(oldId) {
    const previousId = cleanId(oldId || state.adminCargaTeacherId || "");
    const nextId = cleanId(document.getElementById("editTeacherId")?.value || "");
    const nextName = cleanText(document.getElementById("editTeacherName")?.value || "");
    if (!nextId || !nextName) {
      toast("Escribe ID y nombre del docente.");
      return;
    }
    const duplicate = nextId !== previousId && buildUnifiedTeachers().some((teacher) => cleanId(teacher.id) === nextId);
    if (duplicate) {
      toast("Ya existe otro docente con ese ID.");
      return;
    }
    let touchedCarga = false;
    state.cargaRows.forEach((row) => {
      if (cleanId(row.id) === previousId) {
        row.id = nextId;
        row.name = nextName;
        touchedCarga = true;
      }
    });
    state.directorRows.forEach((row) => {
      if (cleanId(row.id) === previousId) row.id = nextId;
    });
    if (!touchedCarga) {
      state.cargaRows.push({ id: nextId, name: nextName, subjectRaw: "", subject: "", sede: "", grade: "", group: "", coordinator: false });
    }
    if (cleanId(state.adminCargaTeacherId) === previousId) state.adminCargaTeacherId = nextId;
    if (cleanId(state.adminDirectorTeacherId) === previousId) state.adminDirectorTeacherId = nextId;
    normalizeCargaRows();
    normalizeDirectorRows();
    buildRepository();
    closeModal();
    toast("Datos del docente guardados.");
    renderAdminContext();
  }

  function warningModal({ title, message, details = "", confirmLabel = "Confirmar", confirmAction, attrs = "", severe = false }) {
    document.body.classList.add("modal-open");
    modalRoot.innerHTML = `
      <div class="modal-backdrop warning-backdrop ${severe ? "warning-backdrop-severe" : ""}" data-action="close-modal">
        <section class="modal warning-modal ${severe ? "warning-modal-severe" : ""}" style="max-width:${severe ? "700" : "620"}px;">
          <div class="warning-topline">
            <div class="warning-icon ${severe ? "severe" : ""}" aria-hidden="true">!</div>
            <div class="warning-copy">
              <h2>${esc(title)}</h2>
              <p>${esc(message)}</p>
            </div>
            <button type="button" class="icon-btn warning-close" data-action="close-modal" aria-label="Cerrar">×</button>
          </div>
          <div class="modal-body warning-body">
            ${details ? `<div class="warning-details">${details}</div>` : ""}
            <div class="inline-actions warning-actions">
              <button class="danger-btn ${severe ? "danger-btn-severe" : ""}" data-action="${escAttr(confirmAction)}" ${attrs}>${esc(confirmLabel)}</button>
              <button class="ghost-btn warning-cancel" data-action="close-modal">Cancelar</button>
            </div>
          </div>
        </section>
      </div>`;
  }

  function openDeleteCargaWarning(index) {
    const row = state.cargaRows[index];
    if (!row) return;
    warningModal({
      title: "Eliminar carga académica",
      message: "Vas a quitar esta asignación del docente. Revisa bien antes de confirmar.",
      details: `<strong>${esc(row.name || teacherNameById(row.id))}</strong><span>${esc(row.subjectRaw || row.subject || "Sin asignatura")} · ${esc(row.grade || "—")}° ${esc(row.group || "")} · ${esc(row.sede || "—")}</span>`,
      confirmLabel: "Sí, eliminar carga",
      confirmAction: "confirm-delete-carga",
      attrs: `data-index="${escAttr(index)}"`
    });
  }

  function openDeleteDirectorWarning(index) {
    const row = state.directorRows[index];
    if (!row) return;
    warningModal({
      title: "Eliminar dirección de grupo",
      message: "Vas a quitar esta dirección asignada a un docente.",
      details: `<strong>ID ${esc(row.id)}</strong><span>${esc(row.sede || "—")} · ${esc(row.grade || "—")}° ${esc(row.group || "")}</span>`,
      confirmLabel: "Sí, eliminar dirección",
      confirmAction: "confirm-delete-director",
      attrs: `data-index="${escAttr(index)}"`
    });
  }

  function openDeleteTeacherWarning(id) {
    const teacher = buildUnifiedTeachers().find((item) => cleanId(item.id) === cleanId(id));
    if (!teacher) return;
    warningModal({
      title: "Eliminar docente",
      message: "Esto eliminará sus cargas académicas y direcciones de grupo en esta configuración local.",
      details: `<strong>${esc(teacher.name || `Docente ${teacher.id}`)}</strong><span>ID ${esc(teacher.id)} · ${teacher.assignments.length} carga(s) · ${teacher.directorGroups.length} dirección(es)</span>`,
      confirmLabel: "Sí, eliminar docente",
      confirmAction: "confirm-delete-carga-teacher",
      attrs: `data-id="${escAttr(id)}"`
    });
  }

  function openDeleteStudentWarning(index, severe = false) {
    const student = state.studentsRegistry[index];
    if (!student) return;
    warningModal({
      title: severe ? "¡OJO! Eliminar estudiante" : "Eliminar estudiante",
      message: severe ? "Esta acción sacará al estudiante del grupo del director. Confirma solo si estás completamente seguro." : "Vas a eliminar este estudiante del registro local.",
      details: `<strong>${esc(displayListName(student) || student.name || "Estudiante")}</strong><span>ID prueba ${esc(student.examId || "—")} · ID ${esc(student.nationalId || "—")} · ${esc(student.sede || "—")} · ${esc(student.grade || "—")}° ${esc(student.group || "")}</span>`,
      confirmLabel: severe ? "SÍ, ELIMINAR ESTUDIANTE" : "Sí, eliminar estudiante",
      confirmAction: severe ? "confirm-director-delete-student" : "confirm-delete-student",
      attrs: severe ? `data-roll="${escAttr(student.examId || student.nationalId || "")}"` : `data-index="${escAttr(index)}"`,
      severe
    });
  }

  function openDeleteStudentWarningByRoll(roll, severe = true) {
    const clean = cleanId(roll);
    const index = state.studentsRegistry.findIndex((student) => cleanId(student.examId) === clean || cleanId(student.nationalId) === clean);
    if (index >= 0) openDeleteStudentWarning(index, severe);
  }

  function deleteStudentByIndex(index, severe = false) {
    const student = state.studentsRegistry[index];
    if (!student) return;
    state.studentsRegistry.splice(index, 1);
    buildRepository();
    closeModal();
    toast(severe ? "Estudiante eliminado del grupo." : "Estudiante eliminado.");
    renderAdminContext();
  }

  function deleteStudentByRoll(roll, severe = true) {
    const clean = cleanId(roll);
    const index = state.studentsRegistry.findIndex((student) => cleanId(student.examId) === clean || cleanId(student.nationalId) === clean);
    if (index >= 0) deleteStudentByIndex(index, severe);
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

  function subjectMetricBlockHtml(details = [], activeMetric = "components") {
    const hasComponents = hasMetricData(details, "component");
    const hasCompetences = hasMetricData(details, "competence");
    if (!hasComponents && !hasCompetences) return "";
    const active = hasComponents ? (activeMetric === "competences" && hasCompetences ? "competences" : "components") : "competences";
    return `
        <div class="metric-tabs" role="tablist" aria-label="Análisis por componente y competencia">
          ${hasComponents ? `<button class="metric-tab ${active === "components" ? "active" : ""}" data-action="select-metric-tab" data-tab="components">Componentes</button>` : ""}
          ${hasCompetences ? `<button class="metric-tab ${active === "competences" ? "active" : ""}" data-action="select-metric-tab" data-tab="competences">Competencias</button>` : ""}
        </div>
        <div class="metric-grid" data-active="${escAttr(active)}">
          ${hasComponents ? `<section class="metric-panel components"><h4>Componentes evaluados</h4>${buildMetricBars(details, "component")}</section>` : ""}
          ${hasCompetences ? `<section class="metric-panel competences"><h4>Competencias evaluadas</h4>${buildMetricBars(details, "competence")}</section>` : ""}
        </div>`;
  }

  function openEditStudentInfoModal(index) {
    const student = state.studentsRegistry[index];
    if (!student) return;
    document.body.classList.add("modal-open");
    modalRoot.innerHTML = `
      <div class="modal-backdrop" data-action="close-modal">
        <section class="modal" style="max-width:720px;">
          <div class="modal-head">
            <div><h2>Editar información del estudiante</h2><span style="color:#7d8089;font-weight:600;">${esc(student.name || student.examId || "Nuevo estudiante")}</span></div>
            <button type="button" class="icon-btn" data-action="close-modal" aria-label="Cerrar">×</button>
          </div>
          <div class="modal-body">
            <div class="form-grid compact">
              <div class="field"><label>ID prueba</label><input id="editStudentExamId" value="${escAttr(student.examId)}"></div>
              <div class="field"><label>ID estudiante</label><input id="editStudentNationalId" value="${escAttr(student.nationalId)}"></div>
              <div class="field span-2"><label>Nombre completo</label><input id="editStudentName" value="${escAttr(student.name)}"></div>
              <div class="field"><label>Sede</label><select id="editStudentSede" class="select-pill">${cargaSelectOptions("sede", student.sede)}</select></div>
              <div class="field"><label>Grado</label><select id="editStudentGrade" class="select-pill">${cargaSelectOptions("grade", student.grade)}</select></div>
              <div class="field"><label>Curso</label><select id="editStudentGroup" class="select-pill">${cargaSelectOptions("group", student.group)}</select></div>
            </div>
            <div class="inline-actions" style="margin-top:16px;">
              <button class="primary-btn" data-action="confirm-edit-student-info" data-index="${index}">Guardar cambios</button>
              <button class="ghost-btn" data-action="close-modal">Cancelar</button>
            </div>
          </div>
        </section>
      </div>`;
  }

  function confirmEditStudentInfo(index) {
    const row = state.studentsRegistry[index];
    if (!row) return;
    row.examId = cleanId(document.getElementById("editStudentExamId")?.value || "");
    row.nationalId = cleanId(document.getElementById("editStudentNationalId")?.value || "");
    row.name = cleanText(document.getElementById("editStudentName")?.value || "");
    row.sede = cleanText(document.getElementById("editStudentSede")?.value || "");
    row.grade = toInt(document.getElementById("editStudentGrade")?.value || "");
    row.group = cleanText(document.getElementById("editStudentGroup")?.value || "");
    state.studentsRegistry[index] = normalizeStudentRow(row);
    buildRepository();
    toast("Información del estudiante actualizada.");
    closeModal();
    renderAdminContext();
  }

  function answerOptionsForSubject(subject) {
    return sameSubject(subject, "Inglés") ? ["A","B","C","D","E","F","G","H"] : ["A","B","C","D"];
  }

  function sessionRangeForExamEdit(session) {
    const sessionNumber = Number(session || 1);
    const sessions = (state.manifest.sessions || DEFAULT_MANIFEST.sessions || [])
      .slice()
      .sort((a, b) => Number(a.startItem || 0) - Number(b.startItem || 0));
    const current = sessions.find((item) => Number(item.session) === sessionNumber) || { session: sessionNumber, startItem: sessionNumber === 2 ? 71 : 1 };
    const index = sessions.findIndex((item) => Number(item.session) === sessionNumber);
    const next = index >= 0 ? sessions[index + 1] : null;
    const start = Number(current.startItem || (sessionNumber === 2 ? 71 : 1));
    const end = next ? Number(next.startItem || start + 70) - 1 : start + 69;
    return { start, end };
  }

  function examEditSectionsForRecord(record, student) {
    const grade = toInt(student?.grade || student?.registry?.grade || record?.grade);
    const keys = (state.keys || []).filter((key) => Number(key.grade) === Number(grade));
    const sections = [];

    if (keys.length) {
      for (const subject of SUBJECTS) {
        const subjectKeys = keys.filter((key) => sameSubject(key.area, subject.name));
        if (!subjectKeys.length) continue;
        const statDetails = student?.subjectStats?.[subject.name]?.details || [];
        const details = (statDetails.length ? statDetails : subjectKeys.map((key) => ({
          item: key.item,
          subject: subject.name,
          marked: record?.answers?.[key.item] || "",
          correct: key.correct,
          component: key.component,
          competence: key.competence
        }))).slice().sort((a, b) => Number(a.item) - Number(b.item));
        sections.push({
          id: subject.name,
          label: subject.short || subject.name,
          subject: subject.name,
          fallback: false,
          details
        });
      }
    }

    if (sections.length) return sections;

    const answerItems = Object.keys(record?.answers || {}).map((item) => Number(item)).filter(Boolean).sort((a, b) => a - b);
    const sessions = detectedSessionsForRecord(record);
    if (!sessions.size && answerItems.length) answerItems.forEach((item) => sessions.add(sessionForItem(item)));
    if (!sessions.size) sessions.add(1);

    return [...sessions].sort((a, b) => Number(a) - Number(b)).map((session) => {
      const range = sessionRangeForExamEdit(session);
      const itemsInRange = [];
      for (let item = range.start; item <= range.end; item++) itemsInRange.push(item);
      return {
        id: `session-${session}`,
        label: `Sesión ${session}`,
        subject: "",
        fallback: true,
        details: itemsInRange.map((item) => ({ item, subject: `Sesión ${session}`, marked: record?.answers?.[item] || "", correct: "" }))
      };
    });
  }

  function examEditOptionsForDetail(detail, section) {
    if (section?.fallback) return ["A","B","C","D","E","F","G","H"];
    return answerOptionsForSubject(detail?.subject || section?.subject || "");
  }

  function openEditStudentExamModal(roll, subject = "") {
    const cleanRoll = cleanId(roll);
    const record = state.responsesByRoll.get(cleanRoll);
    if (!record) { toast("No encontré respuestas cargadas para ese ID prueba."); return; }
    const student = state.computedByRoll.get(cleanRoll) || state.computedStudents.find((item) => cleanId(item?.registry?.examId) === cleanRoll) || null;
    const registry = state.registryByExamId.get(cleanRoll) || state.registryByNationalId.get(cleanId(record?.nationalId)) || null;
    const displayName = displayListName(student || registry || record) || cleanText(record?.name) || cleanText(registry?.name) || "Examen sin estudiante vinculado";
    const sections = examEditSectionsForRecord(record, student || registry);
    const activeId = cleanText(subject || sections[0]?.id || "");
    const activeSection = sections.find((section) => section.id === activeId || sameSubject(section.subject, activeId)) || sections[0] || { details: [], label: "Examen", fallback: true };
    const tabs = sections.map((section) => `<button class="tab-btn ${section.id === activeSection.id ? "active" : ""}" data-action="exam-edit-tab" data-roll="${escAttr(cleanRoll)}" data-subject="${escAttr(section.id)}">${esc(section.label)}</button>`).join("");
    const rows = (activeSection.details || []).slice().sort((a,b)=>Number(a.item)-Number(b.item)).map((detail) => {
      const marked = cleanMarked(record.answers?.[detail.item] ?? detail.marked ?? "");
      const options = examEditOptionsForDetail(detail, activeSection);
      const correct = cleanOption(detail.correct || "");
      return `<div class="exam-option-row">
        <div class="exam-item-num">${esc(detail.item)}${correct ? `<small title="Respuesta correcta">${esc(correct)}</small>` : ""}</div>
        <div class="exam-option-buttons">
          ${options.map((op) => `<button type="button" class="exam-option-btn ${marked === op ? "active" : ""}" data-action="set-student-answer" data-roll="${escAttr(cleanRoll)}" data-item="${escAttr(detail.item)}" data-option="${op}">${op}</button>`).join("")}
          <button type="button" class="exam-option-btn clear" data-action="clear-student-answer" data-roll="${escAttr(cleanRoll)}" data-item="${escAttr(detail.item)}">—</button>
        </div>
      </div>`;
    }).join("");
    const fallbackNote = activeSection.fallback
      ? "No hay claves de asignatura disponibles para este examen en la carga actual. Por eso se muestran las respuestas por sesión para que el administrador pueda corregirlas y subirlas a Supabase."
      : "Los ítems usan la numeración real del examen según las claves cargadas. Selecciona una opción o usa <strong>—</strong> para dejarla sin marcar.";
    document.body.classList.add("modal-open");
    modalRoot.innerHTML = `
      <div class="modal-backdrop" data-action="close-modal">
        <section class="modal exam-edit-modal" style="max-width:980px;">
          <div class="modal-head">
            <div><h2>Editar examen</h2><span style="color:#7d8089;font-weight:600;">${esc(displayName)} · ID ${esc(cleanRoll)}</span></div>
            <button type="button" class="icon-btn" data-action="close-modal" aria-label="Cerrar">×</button>
          </div>
          <div class="modal-body">
            <nav class="teacher-assignment-nav exam-edit-tabs">${tabs}</nav>
            <div class="admin-note">${fallbackNote}</div>
            <div class="exam-edit-grid">${rows || `<div class="empty-state">No hay respuestas detectadas para editar.</div>`}</div>
            <div class="inline-actions" style="margin-top:16px;">
              <button class="primary-btn" data-action="save-student-exam-upload">Guardar y subir a Supabase</button>
              <button class="secondary-btn" data-action="save-student-exam">Guardar sin subir</button>
              <button class="ghost-btn" data-action="close-modal">Cancelar</button>
            </div>
          </div>
        </section>
      </div>`;
  }

  function setStudentAnswer(roll, item, option) {
    const cleanRoll = cleanId(roll);
    if (!cleanRoll || !item) return;
    const record = state.responsesByRoll.get(cleanRoll);
    if (!record) return;
    record.answers[item] = cleanMarked(option || "");
    state.responsesByRoll.set(cleanRoll, record);
  }

  function persistResultOverrides() {
    const data = {};
    state.responsesByRoll.forEach((record, roll) => {
      data[roll] = { grade: record.grade, name: record.name, answers: record.answers || {} };
    });
    writeJSON(STORAGE.resultOverrides, data);
  }

  function applyResultOverrides() {
    const data = readJSON(STORAGE.resultOverrides, null);
    if (!data || typeof data !== "object") return;
    Object.entries(data).forEach(([roll, patch]) => {
      const cleanRoll = cleanId(roll);
      const record = state.responsesByRoll.get(cleanRoll);
      if (!record) return;
      record.answers = { ...(record.answers || {}), ...(patch.answers || {}) };
      state.responsesByRoll.set(cleanRoll, record);
    });
  }

  function exportResultFilesForRepo() {
    const files = [];
    for (const resultFile of state.manifest.resultados || []) {
      const grade = Number(resultFile.grade);
      const session = Number(resultFile.session || inferSessionFromPath(resultFile.path));
      const startItem = Number(resultFile.startItem || (session === 2 ? 71 : 1));
      const nextSession = (state.manifest.sessions || []).find((s) => Number(s.session) === session + 1);
      const endItem = nextSession ? Number(nextSession.startItem) - 1 : Math.max(...state.keys.filter((k) => Number(k.grade) === grade).map((k) => Number(k.item)), startItem);
      const rows = Array.from(state.responsesByRoll.values())
        .filter((record) => Number(record.grade) === grade)
        .map((record) => {
          const computed = state.computedByRoll?.get?.(cleanId(record.roll));
          const meta = mergeRankMeta(record.serverRank, computed ? {
            globalScore: computed.globalScore,
            rawGlobalScore: computed.rawGlobalScore,
            gradeRank: computed.gradeRank,
            gradeCount: computed.gradeCount,
            courseRank: computed.courseRank,
            courseCount: computed.courseCount
          } : null);
          const row = {
            "Roll No": record.roll,
            PUNTAJE_GLOBAL: meta.globalScore ?? "",
            PUNTAJE_BRUTO: meta.rawGlobalScore ?? "",
            PUESTO_GRADO: meta.gradeRank ?? "",
            TOTAL_GRADO: meta.gradeCount ?? "",
            PUESTO_CURSO: meta.courseRank ?? "",
            TOTAL_CURSO: meta.courseCount ?? ""
          };
          for (let item = startItem; item <= endItem; item++) {
            const local = item - startItem + 1;
            row[`Q ${local} Options`] = record.answers?.[item] || "";
          }
          return row;
        });
      files.push({ path: resultFile.path, content: JSON.stringify(rows, null, 2) });
    }
    return files;
  }

  function adminDocentesHtml() {
    const teachers = buildUnifiedTeachers();
    if (!state.adminCargaTeacherId || !teachers.some((t) => t.id === state.adminCargaTeacherId)) state.adminCargaTeacherId = teachers[0]?.id || "";
    const active = teachers.find((t) => t.id === state.adminCargaTeacherId) || teachers[0] || null;
    return `
      <section class="toolbar">
        <div><span class="section-eyebrow">Docentes</span><h2 style="margin:8px 0 0;font-weight:900;">Cargas, dirección de grupo y coordinación</h2><p class="muted-copy">Todo se administra desde una sola pestaña. En celular, al tocar un docente se abre su panel en ventana emergente.</p></div>
        <div class="inline-actions"><button class="primary-btn" data-action="add-carga-teacher">Agregar docente</button><button class="secondary-btn" data-action="save-carga">Guardar docentes</button><button class="ghost-btn" data-action="export-carga">Exportar CARGA</button><button class="ghost-btn" data-action="export-directores">Exportar directores</button><button class="secondary-btn" data-action="publish-supabase">Subir a Supabase</button></div>
      </section>
      <section class="carga-manager docentes-manager">
        <aside class="card carga-teacher-list">
          <h3>Docentes</h3>
          ${teachers.map((teacher) => `<button class="carga-teacher-card ${active?.id === teacher.id ? "active" : ""}" data-action="select-carga-teacher" data-id="${escAttr(teacher.id)}"><strong>${esc(teacher.name || `Docente ${teacher.id}`)}</strong><span>ID ${esc(teacher.id)} · ${teacher.assignments.length} carga${teacher.assignments.length === 1 ? "" : "s"} · ${teacher.directorGroups.length} dirección${teacher.directorGroups.length === 1 ? "" : "es"}${teacher.coordinator ? " · Coordinador" : ""}</span></button>`).join("") || `<div class="empty-state">No hay docentes registrados.</div>`}
        </aside>
        <div class="card card-pad carga-detail docentes-detail">${active ? teacherAdminDetailHtml(active, false) : `<div class="empty-state">Selecciona un docente.</div>`}</div>
      </section>`;
  }

  function buildUnifiedTeachers() {
    const map = new Map();
    buildCargaTeachers().forEach((teacher) => map.set(teacher.id, { ...teacher, directorGroups: [] }));
    buildDirectorTeachers().forEach((teacher) => {
      if (!map.has(teacher.id)) map.set(teacher.id, { id: teacher.id, name: teacher.name, assignments: [], coordinator: false, directorGroups: [] });
      const item = map.get(teacher.id);
      if (!item.name && teacher.name) item.name = teacher.name;
      item.directorGroups = teacher.directorGroups || [];
    });
    return Array.from(map.values()).sort((a,b)=>String(a.name||a.id).localeCompare(String(b.name||b.id), "es", { sensitivity:"base" }));
  }

  function teacherAdminDetailHtml(teacher, inModal = false) {
    const isCoordinator = teacher.assignments.some((row) => row.coordinator) || !!teacher.coordinator;
    return `
      <div class="carga-teacher-head docente-editor-head">
        <div>
          <span class="section-eyebrow">Docente</span>
          <h3 style="margin:6px 0 0;font-size:1.4rem;">${esc(teacher.name || `Docente ${teacher.id}`)}</h3>
          <p class="muted-copy">ID ${esc(teacher.id)} · ${teacher.assignments.length} carga${teacher.assignments.length === 1 ? "" : "s"} · ${teacher.directorGroups.length} dirección${teacher.directorGroups.length === 1 ? "" : "es"}</p>
        </div>
        <div class="inline-actions teacher-danger-actions"><button class="danger-btn" data-action="delete-carga-teacher" data-id="${escAttr(teacher.id)}">Eliminar docente</button></div>
      </div>
      <section class="docente-subsection docente-identity-card">
        <div class="docente-identity-summary compact-summary">
          <div>
            <span class="section-eyebrow">Datos personales</span>
            <h3>${esc(teacher.name || `Docente ${teacher.id}`)}</h3>
            <p>ID ${esc(teacher.id || "sin ID")}</p>
          </div>
          <button class="secondary-btn" data-action="edit-teacher-identity" data-id="${escAttr(teacher.id)}">Editar datos</button>
        </div>
        <label class="coordinator-check"><input type="checkbox" ${isCoordinator ? "checked" : ""} data-carga-coordinator="${escAttr(teacher.id)}"> Coordinador</label>
      </section>
      <section class="docente-subsection"><div class="subsection-head"><h4>Cargas académicas</h4><button class="primary-btn" data-action="add-carga-to-teacher" data-id="${escAttr(teacher.id)}">Agregar carga</button></div><div class="carga-assignment-grid compact-carga-grid">${teacher.assignments.map((row) => cargaAssignmentTag(row)).join("") || `<div class="empty-state">Este docente no tiene cargas.</div>`}</div></section>
      <section class="docente-subsection"><div class="subsection-head"><h4>Dirección de grupo</h4><button class="secondary-btn" data-action="add-director-assignment" data-id="${escAttr(teacher.id)}">Agregar dirección</button></div><div class="carga-assignment-grid compact-carga-grid">${teacher.directorGroups.map((row) => directorAssignmentTag(row)).join("") || `<div class="empty-state">Este docente no tiene dirección de grupo.</div>`}</div></section>
      ${inModal ? `<div class="inline-actions" style="margin-top:16px;"><button class="secondary-btn" data-action="save-carga">Guardar cambios</button><button class="ghost-btn" data-action="close-modal">Cerrar</button></div>` : ""}`;
  }

  function openTeacherAdminModal(id) {
    const teacher = buildUnifiedTeachers().find((t) => t.id === id);
    if (!teacher) return;
    document.body.classList.add("modal-open");
    modalRoot.innerHTML = `<div class="modal-backdrop" data-action="close-modal"><section class="modal teacher-admin-modal" style="max-width:900px;"><div class="modal-head"><div><h2>${esc(teacher.name || `Docente ${teacher.id}`)}</h2><span style="color:#7d8089;font-weight:600;">Administrar carga, dirección y coordinación</span></div><button type="button" class="icon-btn" data-action="close-modal">×</button></div><div class="modal-body">${teacherAdminDetailHtml(teacher, true)}</div></section></div>`;
  }

  function cargaAssignmentTag(row) {
    return `<article class="carga-tag-card" style="--subject-color:${subjectAccent(row.subjectRaw || row.subject)};">
      <div class="carga-tag-main">${subjectIcon(mappedSubject(row.subjectRaw || row.subject))}<div><strong>${esc(row.subjectRaw || row.subject || "Sin asignatura")}</strong><span>${esc(row.grade || "—")}° ${esc(row.group || "")} · ${esc(row.sede || "—")}</span></div></div>
      <div class="tag-actions"><button class="ghost-btn mini-btn" data-action="edit-carga-assignment" data-index="${row.index}">Editar</button><button class="danger-btn mini-btn" data-action="delete-carga" data-index="${row.index}">Eliminar</button></div>
    </article>`;
  }

  function directorAssignmentTag(row) {
    return `<article class="carga-tag-card director-tag-card" style="--subject-color:var(--primary);"><div class="carga-tag-main"><span class="director-card-icon">DG</span><div><strong>Dirección de grupo</strong><span>${esc(row.grade || "—")}° ${esc(row.group || "")} · ${esc(row.sede || "—")}</span></div></div><div class="tag-actions"><button class="ghost-btn mini-btn" data-action="edit-director-assignment" data-index="${row.index}">Editar</button><button class="danger-btn mini-btn" data-action="delete-director" data-index="${row.index}">Eliminar</button></div></article>`;
  }

  function subjectAccent(subject) {
    const colors = ["#7c8cff", "#ff8f8b", "#ffd86b", "#7bd88f", "#59d0e5", "#e8f571", "#ffc14d", "#53d0c6", "#9aa8b5", "#ff7eb0"];
    const idx = SUBJECTS.findIndex((s) => s.name === mappedSubject(subject));
    return colors[idx >= 0 ? idx : 0];
  }

  function openEditCargaAssignmentModal(index) {
    const row = state.cargaRows[index];
    if (!row) return;
    modalRoot.innerHTML = `<div class="modal-backdrop" data-action="close-modal"><section class="modal" style="max-width:660px;"><div class="modal-head"><div><h2>Editar carga</h2><span style="color:#7d8089;font-weight:600;">${esc(row.name || row.id)}</span></div><button class="icon-btn" data-action="close-modal">×</button></div><div class="modal-body"><div class="form-grid compact"><div class="field"><label>Asignatura</label><select id="editCargaSubject" class="select-pill">${cargaSelectOptions("subject", row.subjectRaw || row.subject)}</select></div><div class="field"><label>Sede</label><select id="editCargaSede" class="select-pill">${cargaSelectOptions("sede", row.sede)}</select></div><div class="field"><label>Grado</label><select id="editCargaGrade" class="select-pill">${cargaSelectOptions("grade", row.grade)}</select></div><div class="field"><label>Curso</label><select id="editCargaGroup" class="select-pill">${cargaSelectOptions("group", row.group)}</select></div></div><div class="inline-actions" style="margin-top:16px;"><button class="primary-btn" data-action="confirm-edit-carga-assignment" data-index="${index}">Guardar carga</button><button class="ghost-btn" data-action="close-modal">Cancelar</button></div></div></section></div>`;
  }

  function confirmEditCargaAssignment(index) {
    const row = state.cargaRows[index];
    if (!row) return;
    row.subjectRaw = document.getElementById("editCargaSubject")?.value || row.subjectRaw;
    row.subject = mappedSubject(row.subjectRaw);
    row.sede = document.getElementById("editCargaSede")?.value || "";
    row.grade = toInt(document.getElementById("editCargaGrade")?.value || "");
    row.group = document.getElementById("editCargaGroup")?.value || "";
    normalizeCargaRows();
    buildRepository();
    closeModal();
    renderAdminContext();
  }

  function openEditDirectorAssignmentModal(index) {
    const row = state.directorRows[index];
    if (!row) return;
    modalRoot.innerHTML = `<div class="modal-backdrop" data-action="close-modal"><section class="modal" style="max-width:660px;"><div class="modal-head"><div><h2>Editar dirección de grupo</h2><span style="color:#7d8089;font-weight:600;">ID ${esc(row.id)}</span></div><button class="icon-btn" data-action="close-modal">×</button></div><div class="modal-body"><div class="form-grid compact"><div class="field"><label>Sede</label><select id="editDirectorSede" class="select-pill">${cargaSelectOptions("sede", row.sede)}</select></div><div class="field"><label>Grado</label><select id="editDirectorGrade" class="select-pill">${cargaSelectOptions("grade", row.grade)}</select></div><div class="field"><label>Curso</label><select id="editDirectorGroup" class="select-pill">${cargaSelectOptions("group", row.group)}</select></div></div><div class="inline-actions" style="margin-top:16px;"><button class="primary-btn" data-action="confirm-edit-director-assignment" data-index="${index}">Guardar dirección</button><button class="ghost-btn" data-action="close-modal">Cancelar</button></div></div></section></div>`;
  }

  function confirmEditDirectorAssignment(index) {
    const row = state.directorRows[index];
    if (!row) return;
    row.sede = document.getElementById("editDirectorSede")?.value || "";
    row.grade = toInt(document.getElementById("editDirectorGrade")?.value || "");
    row.group = document.getElementById("editDirectorGroup")?.value || "";
    normalizeDirectorRows();
    buildRepository();
    closeModal();
    renderAdminContext();
  }

  function adminGradeMapHtml() {
    const sedes = adminGradeMapSedes();
    if (!sedes.length) sedes.push("Municipal");
    if (!sedes.some((s) => sameMapSede(s, state.adminMapSede))) state.adminMapSede = sedes[0] || "Municipal";
    const activeSede = displaySedeForMap(state.adminMapSede || sedes[0] || "Municipal");
    const grades = adminGradeMapGrades(activeSede);
    if (!grades.length) grades.push(6, 7, 8, 9, 10, 11);
    if (!grades.includes(Number(state.adminMapGrade))) state.adminMapGrade = grades[0] || 6;
    const grade = Number(state.adminMapGrade || grades[0] || 6);
    const cards = adminGradeSubjectCards(grade, activeSede);
    const warningCount = cards.filter((card) => card.needsAttention).length;
    return `
      <section class="toolbar">
        <div>
          <span class="section-eyebrow">Mapa por grado</span>
          <h2 style="margin:8px 0 0;font-weight:900;">Asignaturas, áreas y docentes por grado</h2>
          <p class="muted-copy">Revisa rápidamente qué áreas tienen docente asignado. Las tarjetas con <strong>!</strong> rojo indican que falta asignación total o parcial.</p>
        </div>
        <div class="inline-actions">
          <button class="secondary-btn" data-action="save-carga">Guardar cargas</button>
          <button class="ghost-btn" data-action="export-carga">Exportar CARGA</button>
          <button class="secondary-btn" data-action="publish-supabase">Subir a Supabase</button>
        </div>
      </section>
      <div class="grade-map-tab-block">
        <span class="section-eyebrow">Sedes</span>
        <nav class="grade-map-tabs grade-map-sede-tabs">
          ${sedes.map((sede) => `<button type="button" class="nav-chip ${sameMapSede(sede, activeSede) ? "active" : ""}" data-action="map-sede-tab" data-sede="${escAttr(sede)}">${esc(sede)}</button>`).join("")}
        </nav>
        <span class="section-eyebrow">Grados</span>
        <nav class="grade-map-tabs grade-map-grade-tabs">
          ${grades.map((g) => `<button type="button" class="nav-chip ${Number(g) === grade ? "active" : ""}" data-action="map-grade-tab" data-grade="${escAttr(g)}">${esc(g)}°</button>`).join("")}
        </nav>
      </div>
      <div class="admin-note grade-map-note">
        ${esc(activeSede)} · Grado ${esc(grade)}° · ${cards.length} áreas/asignaturas revisadas · ${warningCount ? `${warningCount} con alerta` : "sin alertas visibles"}.
      </div>
      <section class="grade-subject-map-grid">
        ${cards.map((card) => gradeSubjectMapCardHtml(card)).join("") || `<div class="empty-state">No hay áreas para este grado y sede.</div>`}
      </section>
    `;
  }

  function adminGradeMapGrades(activeSede = "") {
    const values = [];
    const sede = displaySedeForMap(activeSede || state.adminMapSede || "");
    const sedeFilter = (row) => !sede || sameMapSede(row?.sede, sede);
    values.push(...(state.manifest.grades || []));
    values.push(...(state.studentsRegistry || []).filter(sedeFilter).map((s) => s.grade));
    values.push(...(state.computedStudents || []).filter(sedeFilter).map((s) => s.grade));
    values.push(...(state.cargaRows || []).filter(sedeFilter).map((r) => r.grade));
    values.push(...(state.keys || []).map((k) => k.grade));
    const unique = [...new Set(values.map((v) => Number(v)).filter((v) => v >= 6 && v <= 11))].sort((a, b) => a - b);
    return unique.length ? unique : [6, 7, 8, 9, 10, 11];
  }

  function displaySedeForMap(value) {
    const text = cleanText(value) || "Municipal";
    const norm = normalizeText(text);
    if (norm.includes("bongo")) return "Bongo";
    if (norm.includes("municipal") || norm.includes("principal")) return "Municipal";
    return text;
  }

  function sameMapSede(a, b) {
    return normalizeText(displaySedeForMap(a)) === normalizeText(displaySedeForMap(b));
  }

  function adminGradeMapSedes() {
    const values = [];
    values.push(...(state.studentsRegistry || []).map((student) => student.sede));
    values.push(...(state.computedStudents || []).map((student) => student.sede));
    values.push(...(state.cargaRows || []).map((row) => row.sede));
    return uniqueValues(values.map(displaySedeForMap).filter(Boolean)).sort((a, b) => {
      const order = { municipal: 1, bongo: 2 };
      const av = order[normalizeText(a)] || 99;
      const bv = order[normalizeText(b)] || 99;
      if (av !== bv) return av - bv;
      return String(a).localeCompare(String(b), "es", { sensitivity: "base", numeric: true });
    });
  }

  function formatGradeCourseLabel(item, includeSede = false) {
    const grade = Number(item?.grade || state.adminMapGrade || 0);
    const group = cleanText(item?.group || "Sin curso");
    const base = grade ? `${grade}-${group}` : group;
    return includeSede ? `${base} · ${displaySedeForMap(item?.sede)}` : base;
  }

  function adminGradeCourses(grade, activeSede = "") {
    const map = new Map();
    const sedeFilter = displaySedeForMap(activeSede || state.adminMapSede || "");
    const add = (sede, group) => {
      const cleanGroup = cleanText(group);
      if (!cleanGroup) return;
      const cleanSede = displaySedeForMap(sede || "Municipal");
      if (sedeFilter && !sameMapSede(cleanSede, sedeFilter)) return;
      const key = `${normalizeText(cleanSede)}|${normalizeText(cleanGroup)}`;
      if (!map.has(key)) map.set(key, { sede: cleanSede, grade: Number(grade), group: cleanGroup });
    };
    (state.studentsRegistry || []).filter((s) => Number(s.grade) === Number(grade)).forEach((s) => add(s.sede, s.group));
    (state.computedStudents || []).filter((s) => Number(s.grade) === Number(grade)).forEach((s) => add(s.sede, s.group));
    (state.cargaRows || []).filter((r) => Number(r.grade) === Number(grade)).forEach((r) => add(r.sede, r.group));
    return [...map.values()].sort((a, b) => {
      const sedeDiff = String(a.sede).localeCompare(String(b.sede), "es", { sensitivity: "base", numeric: true });
      if (sedeDiff) return sedeDiff;
      return String(a.group).localeCompare(String(b.group), "es", { sensitivity: "base", numeric: true });
    });
  }

  function adminExpectedSubjectsForGrade(grade) {
    const fromKeys = uniqueValues((state.keys || []).filter((k) => Number(k.grade) === Number(grade)).map((k) => k.area));
    const fromCarga = uniqueValues((state.cargaRows || []).filter((r) => Number(r.grade) === Number(grade)).map((r) => mappedSubject(r.subjectRaw || r.subject)));
    const base = SUBJECTS.map((subject) => subject.name);
    return [...new Set([...base, ...fromKeys, ...fromCarga].map(canonicalSubject).filter(Boolean))]
      .sort((a, b) => {
        const ai = SUBJECTS.findIndex((subject) => sameSubject(subject.name, a));
        const bi = SUBJECTS.findIndex((subject) => sameSubject(subject.name, b));
        if (ai >= 0 && bi >= 0) return ai - bi;
        if (ai >= 0) return -1;
        if (bi >= 0) return 1;
        return String(a).localeCompare(String(b), "es", { sensitivity: "base" });
      });
  }

  function adminGradeSubjectCards(grade, activeSede = "") {
    const sede = displaySedeForMap(activeSede || state.adminMapSede || "");
    const courses = adminGradeCourses(grade, sede);
    const subjects = adminExpectedSubjectsForGrade(grade);
    return subjects.map((subject) => {
      const rows = (state.cargaRows || [])
        .map((row, index) => ({ ...row, index, sede: displaySedeForMap(row.sede || "Municipal") }))
        .filter((row) => Number(row.grade) === Number(grade) && sameMapSede(row.sede, sede) && sameSubject(mappedSubject(row.subjectRaw || row.subject), subject));
      const covered = new Set(rows.map((row) => `${normalizeText(row.sede || "Municipal")}|${normalizeText(row.group || "")}`));
      const missingCourses = courses.filter((course) => !covered.has(`${normalizeText(course.sede)}|${normalizeText(course.group)}`));
      const needsAttention = !rows.length || missingCourses.length > 0;
      return { grade, sede, subject, rows, courses, missingCourses, needsAttention };
    });
  }

  function gradeSubjectMapCardHtml(card) {
    const teacherMap = new Map();
    card.rows.forEach((row) => {
      const id = cleanId(row.id);
      const name = cleanText(row.name || teacherNameById(id));
      const key = id || name || `docente-${teacherMap.size}`;
      if (!teacherMap.has(key)) teacherMap.set(key, { id, name, courses: [] });
      teacherMap.get(key).courses.push(formatGradeCourseLabel({ ...row, grade: card.grade }, false));
    });
    const teachers = [...teacherMap.values()];
    const status = !card.rows.length
      ? "Sin docente asignado"
      : card.missingCourses.length
        ? `Faltan ${card.missingCourses.length} curso${card.missingCourses.length === 1 ? "" : "s"}`
        : "Asignación completa";
    const statusClass = card.needsAttention ? "warning" : "ok";
    return `
      <button type="button" class="grade-subject-card ${card.needsAttention ? "needs-attention" : "is-complete"}" data-action="open-grade-subject-map" data-grade="${escAttr(card.grade)}" data-subject="${escAttr(card.subject)}" style="--subject-color:${escAttr(subjectAccent(card.subject))};">
        ${card.needsAttention ? `<span class="grade-subject-alert">!</span>` : ""}
        <div class="grade-subject-head">
          ${subjectIcon(card.subject)}
          <div>
            <strong>${esc(shortSubjectName(card.subject))}</strong>
            <span class="grade-subject-status ${statusClass}">${esc(status)}</span>
          </div>
        </div>
        <div class="grade-subject-teachers">
          ${teachers.length ? teachers.map((teacher) => `<div class="grade-map-teacher"><strong>${esc(teacher.name || `Docente ${teacher.id}`)}</strong><span>${esc(uniqueValues(teacher.courses).join(", "))}</span></div>`).join("") : `<span class="muted-copy">Toca para asignar docente.</span>`}
        </div>
        ${card.missingCourses.length ? `<div class="grade-map-missing"><strong>Sin cubrir:</strong> ${esc(card.missingCourses.slice(0, 6).map((c) => formatGradeCourseLabel(c, false)).join(", "))}${card.missingCourses.length > 6 ? "…" : ""}</div>` : ""}
      </button>
    `;
  }

  function openGradeSubjectMapModal(grade, subject) {
    grade = Number(grade || state.adminMapGrade || 6);
    subject = canonicalSubject(subject);
    if (!grade || !subject) return;
    const activeSede = displaySedeForMap(state.adminMapSede || "Municipal");
    const card = adminGradeSubjectCards(grade, activeSede).find((item) => sameSubject(item.subject, subject)) || { grade, sede: activeSede, subject, rows: [], courses: adminGradeCourses(grade, activeSede), missingCourses: adminGradeCourses(grade, activeSede) };
    const teachers = buildUnifiedTeachers().filter((teacher) => cleanId(teacher.id) && !String(teacher.id).startsWith("sin-id-"));
    const missing = card.missingCourses || [];
    const allCourses = card.courses || [];
    const courseOptions = [
      `<option value="__missing__">Todos los cursos sin docente (${missing.length || 0})</option>`,
      `<option value="__all__">Todos los cursos del grado</option>`,
      ...allCourses.map((course) => `<option value="${escAttr(`${course.sede}|${course.group}`)}">${esc(formatGradeCourseLabel(course, false))}</option>`)
    ].join("");
    const teacherOptions = teachers.map((teacher) => `<option value="${escAttr(teacher.id)}">${esc(teacher.name || `Docente ${teacher.id}`)} · ID ${esc(teacher.id)}</option>`).join("");
    document.body.classList.add("modal-open");
    modalRoot.innerHTML = `
      <div class="modal-backdrop" data-action="close-modal">
        <section class="modal grade-map-modal" style="max-width:760px;">
          <div class="modal-head">
            <div>
              <h2>Asignar docente</h2>
              <span style="color:#7d8089;font-weight:600;">${esc(subject)} · ${esc(activeSede)} · ${esc(grade)}°</span>
            </div>
            <button type="button" class="icon-btn" data-action="close-modal">×</button>
          </div>
          <div class="modal-body">
            <div class="admin-note">Selecciona un docente y el alcance de la asignación. Después usa <strong>Guardar cargas</strong> y, si quieres hacerlo global, <strong>Subir a Supabase</strong>.</div>
            <div class="form-grid compact">
              <div class="field span-2"><label>Docente</label><select id="gradeMapTeacher" class="select-pill">${teacherOptions || `<option value="">No hay docentes registrados</option>`}</select></div>
              <div class="field"><label>Asignatura / área</label><input id="gradeMapSubject" value="${escAttr(subject)}"></div>
              <div class="field"><label>Alcance</label><select id="gradeMapScope" class="select-pill">${courseOptions}</select></div>
            </div>
            ${card.rows.length ? `<section class="grade-map-current"><h3>Asignación actual</h3>${card.rows.map((row) => `<div class="grade-map-current-row"><span><strong>${esc(row.name || teacherNameById(row.id))}</strong><em>${esc(formatGradeCourseLabel({ ...row, grade }, false))}</em></span><button type="button" class="grade-map-row-remove" data-action="delete-grade-map-row" data-index="${escAttr(row.index)}" title="Eliminar esta carga">×</button></div>`).join("")}</section>` : `<div class="empty-state">Esta área no tiene docentes asignados todavía en ${esc(activeSede)} · ${esc(grade)}°.</div>`}
            <div class="inline-actions" style="margin-top:16px;">
              <button class="primary-btn" data-action="confirm-grade-subject-map" data-grade="${escAttr(grade)}" data-subject="${escAttr(subject)}">Asignar docente</button>
              <button class="ghost-btn" data-action="close-modal">Cancelar</button>
            </div>
          </div>
        </section>
      </div>`;
  }

  function confirmGradeSubjectMapAssignment() {
    const button = modalRoot.querySelector('[data-action="confirm-grade-subject-map"]');
    const grade = Number(button?.dataset.grade || state.adminMapGrade || 0);
    const baseSubject = document.getElementById("gradeMapSubject")?.value || button?.dataset.subject || "";
    const subjectRaw = cleanText(baseSubject);
    const subject = mappedSubject(subjectRaw);
    const teacherId = cleanId(document.getElementById("gradeMapTeacher")?.value || "");
    const scope = document.getElementById("gradeMapScope")?.value || "__missing__";
    const teacher = buildUnifiedTeachers().find((item) => cleanId(item.id) === teacherId);
    if (!grade || !subjectRaw || !teacherId || !teacher) {
      toast("Selecciona docente y asignatura.");
      return;
    }
    const activeSede = displaySedeForMap(state.adminMapSede || "Municipal");
    const courses = adminGradeCourses(grade, activeSede);
    const currentRows = (state.cargaRows || []).filter((row) => Number(row.grade) === grade && sameMapSede(row.sede || "Municipal", activeSede) && sameSubject(mappedSubject(row.subjectRaw || row.subject), subject));
    const covered = new Set(currentRows.map((row) => `${normalizeText(row.sede || "Municipal")}|${normalizeText(row.group || "")}`));
    let selectedCourses = [];
    if (scope === "__all__") {
      selectedCourses = courses;
    } else if (scope === "__missing__") {
      selectedCourses = courses.filter((course) => !covered.has(`${normalizeText(course.sede)}|${normalizeText(course.group)}`));
    } else {
      const [sede, group] = scope.split("|");
      selectedCourses = courses.filter((course) => normalizeText(course.sede) === normalizeText(sede) && normalizeText(course.group) === normalizeText(group));
    }
    if (!selectedCourses.length) {
      toast("No hay cursos pendientes para asignar con ese alcance.");
      return;
    }
    let created = 0;
    selectedCourses.forEach((course) => {
      const duplicate = state.cargaRows.some((row) => cleanId(row.id) === teacherId && Number(row.grade) === grade && sameSubject(mappedSubject(row.subjectRaw || row.subject), subject) && sameMapSede(row.sede || "Municipal", course.sede || "Municipal") && normalizeText(row.group || "") === normalizeText(course.group));
      if (duplicate) return;
      state.cargaRows.push({
        id: teacherId,
        name: teacher.name || teacherNameById(teacherId),
        subjectRaw,
        subject,
        sede: course.sede || "Municipal",
        grade,
        group: course.group || "",
        coordinator: false
      });
      created += 1;
    });
    normalizeCargaRows();
    writeJSON(STORAGE.carga, { rows: state.cargaRows });
    buildRepository();
    closeModal();
    toast(created ? `Asignación creada en ${created} curso${created === 1 ? "" : "s"}.` : "Ese docente ya tenía esa asignación.");
    renderAdminContext();
  }

  function subjectAreaMapValue(subject) {
    const raw = cleanText(subject);
    const norm = normalizeText(raw);
    if (!raw) return undefined;
    const map = state.subjectAreaMap || {};
    const hasRaw = Object.prototype.hasOwnProperty.call(map, raw);
    const hasNorm = Object.prototype.hasOwnProperty.call(map, norm);
    const value = hasRaw ? map[raw] : (hasNorm ? map[norm] : undefined);
    if (value === SUBJECT_AREA_UNASSIGNED) return SUBJECT_AREA_UNASSIGNED;
    return value ? canonicalAreaName(value) : undefined;
  }

  function isSubjectAreaUnassigned(subject) {
    return subjectAreaMapValue(subject) === SUBJECT_AREA_UNASSIGNED;
  }

  function setSubjectAreaMap(subject, area) {
    const raw = cleanText(subject);
    const norm = normalizeText(raw);
    if (!raw) return;
    const mappedArea = cleanText(area) === SUBJECT_AREA_UNASSIGNED ? SUBJECT_AREA_UNASSIGNED : canonicalAreaName(area);
    state.subjectAreaMap[raw] = mappedArea;
    state.subjectAreaMap[norm] = mappedArea;
  }

  function removeSubjectAreaMap(subject) {
    const raw = cleanText(subject);
    if (!raw) return;
    setSubjectAreaMap(raw, SUBJECT_AREA_UNASSIGNED);
  }

  function adminSubjectAreasHtml() {
    const areas = availableSubjects();
    const areaSet = new Set(areas.map((area) => canonicalSubject(area)));
    const rawSubjects = uniqueDisplayValues(state.cargaRows.map((row) => row.subjectRaw || row.subject)).filter(Boolean).sort((a, b) => a.localeCompare(b, "es", { sensitivity: "base" }));
    const subjectAssignedArea = (subject) => {
      const direct = subjectAreaMapValue(subject);
      if (direct === SUBJECT_AREA_UNASSIGNED) return "";
      return cleanText(direct || mappedSubject(subject));
    };
    const isSubjectAssigned = (subject) => !isSubjectAreaUnassigned(subject) && areaSet.has(canonicalSubject(subjectAssignedArea(subject)));
    const unassigned = rawSubjects.filter((subject) => !isSubjectAssigned(subject));
    const manualSubjectOptions = unassigned.map((subject) => `<option value="${escAttr(subject)}">${esc(subject)}</option>`).join("");
    const manualAreaOptions = areas.map((area) => `<option value="${escAttr(area)}">${esc(area)}</option>`).join("");
    const allOrganizedMessage = `<div class="empty-state subject-map-happy"><strong>😊 Todo está organizado</strong><span>No hay asignaturas pendientes por asignar a un área.</span></div>`;
    return `<section class="toolbar"><div><span class="section-eyebrow">Asignaturas y áreas</span><h2 style="margin:8px 0 0;font-weight:900;">Cruce entre carga docente y áreas del examen</h2><p class="muted-copy">En PC puedes arrastrar una asignatura pendiente hacia su área. Usa la X para quitar una asignatura de un área y devolverla a pendientes. En celular usa los selectores de abajo para reasignar.</p></div><div class="inline-actions"><button class="secondary-btn" data-action="save-carga">Guardar mapeos</button><button class="secondary-btn" data-action="publish-supabase">Subir a Supabase</button></div></section>
    <section class="subject-map-mobile card card-pad"><span class="section-eyebrow">Asignar desde celular</span><h3>Asignatura → área del examen</h3><p class="muted-copy">Solo aparecen asignaturas que todavía no están organizadas en un área.</p>${unassigned.length ? `<div class="form-grid compact subject-map-form"><div class="field"><label>Asignatura de la carga</label><select id="subjectAreaMapSubject" class="select-pill">${manualSubjectOptions}</select></div><div class="field"><label>Área del examen</label><select id="subjectAreaMapArea" class="select-pill">${manualAreaOptions}</select></div><div class="field subject-map-submit"><label>&nbsp;</label><button class="primary-btn" data-action="assign-subject-area-manual">Asignar</button></div></div>` : allOrganizedMessage}</section>
    <section class="subject-map-layout"><aside class="card card-pad subject-source"><h3>Asignaturas pendientes</h3>${unassigned.map((subject) => `<button class="subject-chip" draggable="true" data-drag-subject="${escAttr(subject)}">${esc(subject)}</button>`).join("") || allOrganizedMessage}</aside><div class="subject-drop-grid">${areas.map((area) => { const assigned = rawSubjects.filter((subject) => sameSubject(subjectAssignedArea(subject), area)); return `<article class="subject-drop-zone" data-drop-area="${escAttr(area)}" style="--subject-color:${subjectAccent(area)};">${subjectIcon(area)}<h3>${esc(area)}</h3><div class="assigned-chip-list">${assigned.map((subject) => `<span class="assigned-chip">${esc(subject)} <button type="button" title="Quitar esta asignatura del área" aria-label="Quitar ${escAttr(subject)}" data-action="remove-subject-area-map" data-subject="${escAttr(subject)}">×</button></span>`).join("") || `<span class="muted-copy">Suelta aquí una asignatura</span>`}</div></article>`; }).join("")}</div></section>`;
  }

  function handleDragStart(event) {
    const chip = event.target.closest("[data-drag-subject]");
    if (!chip) return;
    event.dataTransfer.setData("text/plain", chip.dataset.dragSubject || "");
  }
  function handleDragOver(event) {
    if (event.target.closest("[data-drop-area]")) event.preventDefault();
  }
  function handleDrop(event) {
    const zone = event.target.closest("[data-drop-area]");
    if (!zone) return;
    event.preventDefault();
    const subject = event.dataTransfer.getData("text/plain");
    const area = zone.dataset.dropArea;
    if (!subject || !area) return;
    setSubjectAreaMap(subject, area);
    writeJSON(STORAGE.subjectAreas, state.subjectAreaMap);
    normalizeCargaRows();
    buildRepository();
    renderAdminContext();
  }

  function setGraphField(field, value) {
    const safe = cleanText(value) || "all";
    if (field === "mode") state.adminGraphMode = safe === "area" ? "area" : "estructura";
    if (field === "sede") { state.adminGraphSede = safe; state.adminGraphGrade = "all"; }
    if (field === "grade") state.adminGraphGrade = safe;
    if (field === "subject") state.adminGraphSubject = safe;
    state.adminGraphOpen = {};
    renderAdminContext();
  }

  function toggleGraphNode(key) {
    if (!key) return;
    if (!state.adminGraphOpen) state.adminGraphOpen = {};
    state.adminGraphOpen[key] = !state.adminGraphOpen[key];
    renderAdminContext();
  }

  function adminGraphicsHtml() {
    const mode = state.adminGraphMode === "area" ? "area" : "estructura";
    state.adminGraphMode = mode;
    const graphStudents = evaluatedStudentsOnly(state.computedStudents);
    const sedes = ["all", ...uniqueValues(graphStudents.map((s) => s.sede || "—"))];
    const grades = ["all", ...uniqueValues(graphStudents
      .filter((s) => state.adminGraphSede === "all" || (s.sede || "—") === state.adminGraphSede)
      .map((s) => s.grade).filter(Boolean)).sort((a, b) => Number(a) - Number(b))];
    const subjects = ["all", ...availableSubjects()];
    const base = graphStudents
      .filter((s) => state.adminGraphSede === "all" || (s.sede || "—") === state.adminGraphSede)
      .filter((s) => state.adminGraphGrade === "all" || String(s.grade) === String(state.adminGraphGrade));
    const content = mode === "area" ? graphByAreaHtml(base) : graphByStructureHtml(base);
    const modeText = mode === "area"
      ? "Primero ves las áreas/asignaturas. Al abrir una, aparecen sedes, grados, cursos y luego componentes/competencias."
      : "Primero ves las sedes. Al abrir una, aparecen grados, cursos, áreas/asignaturas y luego componentes/competencias.";
    return `
      <section class="toolbar">
        <div>
          <span class="section-eyebrow">Gráficas</span>
          <h2 style="margin:8px 0 0;font-weight:900;">Desempeño institucional</h2>
          <p class="muted-copy">${esc(modeText)} Cada barra muestra el <strong>promedio de nota</strong> en escala de 20 a 100.</p>
        </div>
      </section>
      <section class="card card-pad admin-results-filters graphics-filters">
        <div class="form-grid compact admin-results-required-grid">
          <div class="field"><label>Ver gráficas por</label><select class="select-pill" data-admin-graph-field="mode"><option value="estructura" ${mode === "estructura" ? "selected" : ""}>Sede / grado / curso</option><option value="area" ${mode === "area" ? "selected" : ""}>Área / asignatura</option></select></div>
          <div class="field"><label>Limitar sede</label><select class="select-pill" data-admin-graph-field="sede">${sedes.map((v)=>`<option value="${escAttr(v)}" ${state.adminGraphSede===v?"selected":""}>${v==="all"?"Todas":esc(v)}</option>`).join("")}</select></div>
          <div class="field"><label>Limitar grado</label><select class="select-pill" data-admin-graph-field="grade">${grades.map((v)=>`<option value="${escAttr(v)}" ${String(state.adminGraphGrade)===String(v)?"selected":""}>${v==="all"?"Todos":`${esc(v)}°`}</option>`).join("")}</select></div>
          <div class="field"><label>Área rápida</label><select class="select-pill" data-admin-graph-field="subject">${subjects.map((v)=>`<option value="${escAttr(v)}" ${state.adminGraphSubject===v?"selected":""}>${v==="all"?"Todas":esc(shortSubjectName(v))}</option>`).join("")}</select></div>
        </div>
      </section>
      <section class="graphics-tree card card-pad">
        <div class="graphics-help"><strong>Promedio de nota</strong><span>La barra combina las notas de los estudiantes dentro del grupo seleccionado. Toca una barra para desplegar el siguiente nivel debajo, sin ocultar los demás.</span><button class="mini-btn" data-action="graph-clear">Cerrar niveles</button></div>
        ${content || `<div class="empty-state">No hay datos para estos filtros.</div>`}
      </section>`;
  }

  function graphByStructureHtml(students) {
    const subject = state.adminGraphSubject || "all";
    const sedeRows = graphGroupRows(students, (s) => s.sede || "—", (key) => key, subject);
    return graphLevelHtml("Sedes", sedeRows, 0, (sedeRow) => {
      const sedeStudents = students.filter((s) => (s.sede || "—") === sedeRow.key);
      const gradeRows = graphGroupRows(sedeStudents, (s) => String(s.grade || "Sin grado"), (key) => key === "Sin grado" ? key : `${key}°`, subject);
      return graphLevelHtml(`Grados en ${sedeRow.label}`, gradeRows, 1, (gradeRow) => {
        const gradeStudents = sedeStudents.filter((s) => String(s.grade || "Sin grado") === String(gradeRow.key));
        const courseRows = graphGroupRows(gradeStudents, (s) => s.group || "Sin curso", (key) => `${gradeRow.label} ${key}`, subject);
        return graphLevelHtml(`Cursos de ${gradeRow.label}`, courseRows, 2, (courseRow) => {
          const courseStudents = gradeStudents.filter((s) => (s.group || "Sin curso") === courseRow.key);
          const subjectRows = graphSubjectRows(courseStudents, subject);
          return graphLevelHtml("Áreas / asignaturas", subjectRows, 3, (subjectRow) => graphMetricsFor(courseStudents, subjectRow.subject, 4), true, `estructura|sede:${sedeRow.key}|grade:${gradeRow.key}|course:${courseRow.key}`);
        }, false, `estructura|sede:${sedeRow.key}|grade:${gradeRow.key}`);
      }, false, `estructura|sede:${sedeRow.key}`);
    }, false, "estructura");
  }

  function graphByAreaHtml(students) {
    const subjectRows = graphSubjectRows(students, state.adminGraphSubject || "all");
    return graphLevelHtml("Áreas / asignaturas", subjectRows, 0, (subjectRow) => {
      const subject = subjectRow.subject;
      const subjectStudents = students.filter((s) => s.subjectStats[subject]?.total);
      const sedeRows = graphGroupRows(subjectStudents, (s) => s.sede || "—", (key) => key, subject);
      return graphLevelHtml(`Sedes en ${shortSubjectName(subject)}`, sedeRows, 1, (sedeRow) => {
        const sedeStudents = subjectStudents.filter((s) => (s.sede || "—") === sedeRow.key);
        const gradeRows = graphGroupRows(sedeStudents, (s) => String(s.grade || "Sin grado"), (key) => key === "Sin grado" ? key : `${key}°`, subject);
        return graphLevelHtml(`Grados en ${sedeRow.label}`, gradeRows, 2, (gradeRow) => {
          const gradeStudents = sedeStudents.filter((s) => String(s.grade || "Sin grado") === String(gradeRow.key));
          const courseRows = graphGroupRows(gradeStudents, (s) => s.group || "Sin curso", (key) => `${gradeRow.label} ${key}`, subject);
          return graphLevelHtml(`Cursos de ${gradeRow.label}`, courseRows, 3, (courseRow) => {
            const courseStudents = gradeStudents.filter((s) => (s.group || "Sin curso") === courseRow.key);
            return graphMetricsFor(courseStudents, subject, 4);
          }, false, `area|subject:${subject}|sede:${sedeRow.key}|grade:${gradeRow.key}`);
        }, false, `area|subject:${subject}|sede:${sedeRow.key}`);
      }, false, `area|subject:${subject}`);
    }, true, "area");
  }

  function graphLevelHtml(title, rows, depth, childRenderer, withIcon = false, parentKey = "") {
    const sorted = [...rows].sort((a, b) => b.avg - a.avg || a.label.localeCompare(b.label, "es"));
    const max = Math.max(100, ...sorted.map((r) => r.avg || 0));
    return `<div class="graphics-level graphics-depth-${depth}"><div class="graphics-level-head"><h3>${esc(title)}</h3></div><div class="graphics-bars-list">${sorted.map((row, index) => {
      const key = `${parentKey || title}|d:${depth}|k:${row.key}|s:${row.subject || ""}`;
      const open = !!state.adminGraphOpen?.[key];
      const child = open && typeof childRenderer === "function" ? `<div class="graphics-child smooth-reveal">${childRenderer(row) || ""}</div>` : "";
      return `<div class="graphics-row-wrap">${graphBarHtml(row, key, index, max, withIcon, open)}${child}</div>`;
    }).join("") || `<div class="empty-state">No hay datos en este nivel.</div>`}</div></div>`;
  }

  function graphBarHtml(row, key, index, max, withIcon = false, open = false) {
    const width = clamp(row.avg || 0, 0, 100);
    return `<button type="button" class="graphics-drill-row ${open ? "active" : ""}" data-action="graph-toggle" data-graph-key="${escAttr(key)}" title="Promedio de nota: ${escAttr(row.avg)}/100">
      <span class="graphics-rank">${index + 1}</span>
      ${withIcon ? subjectIcon(row.subject || row.label) : ""}
      <span class="graphics-label"><strong>${esc(row.label)}</strong><small>${esc(row.caption || "Promedio de nota")} · ${row.count} estudiante${row.count === 1 ? "" : "s"}</small></span>
      <span class="graphics-track" aria-label="Promedio ${escAttr(row.avg)} de 100"><i style="width:${width}%"></i></span>
      <strong class="graphics-score"><span>Promedio</span>${esc(row.avg)}<small>/100</small></strong>
    </button>`;
  }

  function graphGroupRows(students, keyFn, labelFn, subject = "all") {
    const map = new Map();
    students.forEach((student) => {
      const key = cleanText(keyFn(student)) || "Sin dato";
      if (!map.has(key)) map.set(key, { key, label: cleanText(labelFn(key)) || key, scores: [], studentIds: new Set(), subject });
      const item = map.get(key);
      const scores = graphScoresForStudent(student, subject);
      scores.forEach((score) => item.scores.push(score));
      if (scores.length) item.studentIds.add(student.roll);
    });
    return [...map.values()].filter((item) => item.scores.length).map((item) => ({
      key: item.key,
      graphKey: `group|${subject}|${item.label}|${item.key}`,
      label: item.label,
      avg: Math.round(avg(item.scores)),
      count: item.studentIds.size,
      caption: subject === "all" ? "Promedio general de áreas" : `Promedio de ${shortSubjectName(subject)}`
    }));
  }

  function graphSubjectRows(students, subjectFilter = "all") {
    const selected = subjectFilter !== "all" ? [subjectFilter] : availableSubjects();
    return selected.map((subject) => {
      const scores = [];
      const ids = new Set();
      students.forEach((student) => {
        const stat = statForSubject(student, subject);
        if (isExistingResultStat(student, stat)) {
          scores.push(Number(stat.score));
          ids.add(student.roll);
        }
      });
      return { key: subject, graphKey: `subject|${subject}`, label: shortSubjectName(subject), subject, avg: scores.length ? Math.round(avg(scores)) : 0, count: ids.size, caption: `Promedio de ${shortSubjectName(subject)}` };
    }).filter((item) => item.count > 0);
  }

  function graphScoresForStudent(student, subject = "all") {
    if (subject && subject !== "all") {
      const stat = statForSubject(student, subject);
      return isExistingResultStat(student, stat) ? [Number(stat.score)] : [];
    }
    return scoresForAllSubjectsAverage(student);
  }

  function graphMetricsFor(students, subject, depth = 0) {
    const details = aggregateDetails(students.filter((s) => isExistingResultStat(s, statForSubject(s, subject))), subject);
    if (!hasMetricData(details)) return `<div class="graphics-level graphics-depth-${depth}"><div class="empty-state">${esc(shortSubjectName(subject))} no tiene componentes ni competencias registrados en las claves.</div></div>`;
    return `<div class="graphics-level graphics-depth-${depth} graphics-metrics"><div class="graphics-level-head"><h3>Componentes y competencias de ${esc(shortSubjectName(subject))}</h3></div><div class="teacher-metrics-row admin-results-metrics">${teacherAggregateMetricsHtmlForDetails(details)}</div></div>`;
  }

  function adminAnalysisHtml() {
    const mode = state.adminAnalysisMode === "area" ? "area" : "estructura";
    state.adminAnalysisMode = mode;
    const analysisStudents = evaluatedStudentsOnly(state.computedStudents);
    const sedes = ["all", ...uniqueValues(analysisStudents.map((s) => s.sede))];
    const grades = ["all", ...uniqueValues(analysisStudents
      .filter((s) => state.adminAnalysisSede === "all" || s.sede === state.adminAnalysisSede)
      .map((s) => s.grade)).sort((a,b)=>Number(a)-Number(b))];
    const subjects = ["all", ...availableSubjects()];
    const path = state.adminAnalysisPath || {};
    const base = analysisStudents
      .filter((s) => state.adminAnalysisSede === "all" || s.sede === state.adminAnalysisSede)
      .filter((s) => state.adminAnalysisGrade === "all" || String(s.grade) === String(state.adminAnalysisGrade));

    const content = mode === "area" ? analysisByAreaHtml(base, path) : analysisByStructureHtml(base, path);
    const modeHelp = mode === "area"
      ? "Primero compara áreas/asignaturas. Al abrir una asignatura verás sedes, grados, cursos y luego componentes/competencias si existen."
      : "Primero compara sedes. Al abrir una sede verás grados, cursos, áreas/asignaturas y luego componentes/competencias si existen.";

    return `<section class="toolbar"><div><span class="section-eyebrow">Análisis / ranking</span><h2 style="margin:8px 0 0;font-weight:900;">Desempeño institucional</h2><p class="muted-copy">${modeHelp} Cada barra muestra el <strong>promedio de nota</strong> en escala de 20 a 100.</p></div></section>
      <section class="card card-pad admin-results-filters"><div class="form-grid compact admin-results-required-grid"><div class="field"><label>Ver ranking por</label><select class="select-pill" onchange="window.__poAnalysisChangeFromElement&&window.__poAnalysisChangeFromElement(this)" data-admin-analysis-field="mode"><option value="estructura" ${mode === "estructura" ? "selected" : ""}>Sede / grado / curso</option><option value="area" ${mode === "area" ? "selected" : ""}>Área / asignatura</option></select></div><div class="field"><label>Limitar sede</label><select class="select-pill" onchange="window.__poAnalysisChangeFromElement&&window.__poAnalysisChangeFromElement(this)" data-admin-analysis-field="sede">${sedes.map((v)=>`<option value="${escAttr(v)}" ${state.adminAnalysisSede===v?"selected":""}>${v==="all"?"Todas":esc(v)}</option>`).join("")}</select></div><div class="field"><label>Limitar grado</label><select class="select-pill" onchange="window.__poAnalysisChangeFromElement&&window.__poAnalysisChangeFromElement(this)" data-admin-analysis-field="grade">${grades.map((v)=>`<option value="${escAttr(v)}" ${String(state.adminAnalysisGrade)===String(v)?"selected":""}>${v==="all"?"Todos":`${esc(v)}°`}</option>`).join("")}</select></div><div class="field"><label>Área rápida</label><select class="select-pill" onchange="window.__poAnalysisChangeFromElement&&window.__poAnalysisChangeFromElement(this)" data-admin-analysis-field="subject">${subjects.map((v)=>`<option value="${escAttr(v)}" ${state.adminAnalysisSubject===v?"selected":""}>${v==="all"?"Todas":esc(shortSubjectName(v))}</option>`).join("")}</select></div></div></section>
      <section class="analysis-tree card card-pad">${content || `<div class="empty-state">No hay datos para estos filtros.</div>`}</section>`;
  }

  function analysisByStructureHtml(students, path) {
    const subjectFilter = state.adminAnalysisSubject || "all";
    const sedes = groupMetric(students, (s) => s.sede, (s) => s.sede, subjectFilter, "sede");
    return analysisLevelHtml("Sedes", sedes, "sede", path.sede, 0, false, (sedeRow) => {
      const sedeStudents = students.filter((s) => s.sede === sedeRow.key);
      const gradeRows = groupMetric(sedeStudents, (s) => String(s.grade), (s) => `${s.grade}°`, subjectFilter, "grade");
      return analysisLevelHtml(`Grados en ${esc(sedeRow.label)}`, gradeRows, "grade", path.grade, 1, false, (gradeRow) => {
        const gradeStudents = sedeStudents.filter((s) => String(s.grade) === String(gradeRow.key));
        const courseRows = groupMetric(gradeStudents, (s) => `${s.grade}|${s.group}|${s.sede}`, (s) => `${s.grade}° ${s.group}`, subjectFilter, "course");
        return analysisLevelHtml(`Cursos de ${esc(gradeRow.label)}`, courseRows, "course", path.course, 2, false, (courseRow) => {
          const courseStudents = gradeStudents.filter((s) => `${s.grade}|${s.group}|${s.sede}` === courseRow.key);
          const subjectRows = subjectMetric(courseStudents);
          return analysisLevelHtml("Áreas / asignaturas", subjectRows, "subject", path.subject, 3, true, (subjectRow) => analysisMetricsFor(courseStudents, subjectRow.key, 4));
        });
      });
    });
  }

  function analysisByAreaHtml(students, path) {
    const subjectRows = subjectMetric(students);
    return analysisLevelHtml("Áreas / asignaturas", subjectRows, "subject", path.subject, 0, true, (subjectRow) => {
      const subject = subjectRow.key;
      const sedes = groupMetric(students, (s) => s.sede, (s) => s.sede, subject, "sede");
      return analysisLevelHtml(`Sedes en ${esc(shortSubjectName(subject))}`, sedes, "sede", path.sede, 1, false, (sedeRow) => {
        const sedeStudents = students.filter((s) => s.sede === sedeRow.key);
        const gradeRows = groupMetric(sedeStudents, (s) => String(s.grade), (s) => `${s.grade}°`, subject, "grade");
        return analysisLevelHtml(`Grados en ${esc(sedeRow.label)}`, gradeRows, "grade", path.grade, 2, false, (gradeRow) => {
          const gradeStudents = sedeStudents.filter((s) => String(s.grade) === String(gradeRow.key));
          const courseRows = groupMetric(gradeStudents, (s) => `${s.grade}|${s.group}|${s.sede}`, (s) => `${s.grade}° ${s.group}`, subject, "course");
          return analysisLevelHtml(`Cursos de ${esc(gradeRow.label)}`, courseRows, "course", path.course, 3, false, (courseRow) => {
            const courseStudents = gradeStudents.filter((s) => `${s.grade}|${s.group}|${s.sede}` === courseRow.key);
            return analysisMetricsFor(courseStudents, subject, 4);
          });
        });
      });
    });
  }

  function analysisLevelHtml(title, rows, level, activeValue = "", depth = 0, withIcon = false, childRenderer = null) {
    const max = Math.max(100, ...rows.map((r) => Number(r.avg) || 0));
    const renderedRows = rows.map((row, idx) => {
      const active = activeValue && String(activeValue) === String(row.key);
      const child = active && typeof childRenderer === "function" ? `<div class="analysis-child smooth-reveal">${childRenderer(row) || ""}</div>` : "";
      return `<div class="analysis-row-wrap">${analysisBarHtml(row, level, activeValue, max, idx, withIcon)}${child}</div>`;
    }).join("");
    return `<div class="analysis-level analysis-depth-${depth}"><div class="analysis-level-head"><h3>${title}</h3>${activeValue ? `<button class="mini-btn" data-action="analysis-clear" data-level="${escAttr(level)}">Limpiar desde aquí</button>` : ""}</div><div class="analysis-bars-list">${renderedRows || `<div class="empty-state">No hay datos en este nivel.</div>`}</div></div>`;
  }

  function analysisBarHtml(row, level, activeValue, max, index, withIcon = false) {
    const avgValue = Number(row.avg) || 0;
    const width = clamp(avgValue / 100 * 100, 0, 100);
    const active = activeValue && String(activeValue) === String(row.key);
    return `<button type="button" class="analysis-drill-row ${active ? "active" : ""}" onclick="window.__poAnalysisDrillFromElement&&window.__poAnalysisDrillFromElement(event,this)" data-action="analysis-drill" data-level="${escAttr(level)}" data-value="${escAttr(row.key)}" title="Promedio de nota: ${escAttr(row.avg)}/100">
      <span class="analysis-rank">${index + 1}</span>
      ${withIcon ? subjectIcon(row.subject || row.label) : ""}
      <span class="analysis-label"><strong>${esc(row.label)}</strong><small>Promedio de nota · ${row.count} estudiante${row.count === 1 ? "" : "s"}</small></span>
      <span class="analysis-track" aria-label="Promedio ${escAttr(row.avg)} de 100"><i style="width:${width}%"></i></span>
      <strong class="analysis-score"><span>Promedio</span>${esc(row.avg)}<small>/100</small></strong>
    </button>`;
  }

  function groupMetric(students, keyFn, labelFn, subject = "all") {
    const map = new Map();
    students.forEach((student) => {
      const key = keyFn(student);
      if (!key) return;
      if (!map.has(key)) map.set(key, { key, label: labelFn(student), scores: [], students: new Set() });
      const item = map.get(key);
      const scores = scoresForStudent(student, subject);
      scores.forEach((score) => item.scores.push(score));
      if (scores.length) item.students.add(student.roll);
    });
    return Array.from(map.values()).map((item) => ({ key: item.key, label: item.label, count: item.students.size, avg: avg(item.scores) })).filter((item) => item.avg !== "—").sort((a,b)=>(Number(b.avg)||0)-(Number(a.avg)||0));
  }

  function subjectMetric(students) {
    const selected = state.adminAnalysisSubject !== "all" ? [state.adminAnalysisSubject] : availableSubjects();
    return selected.map((subject) => {
      const scores = scoresForSubjectAverage(students, subject);
      const count = students.filter((student) => isExistingResultStat(student, statForSubject(student, subject))).length;
      return { key: subject, subject, label: shortSubjectName(subject), count, avg: avg(scores) };
    }).filter((item) => item.count && item.avg !== "—").sort((a,b)=>(Number(b.avg)||0)-(Number(a.avg)||0));
  }

  function scoresForStudent(student, subject = "all") {
    if (subject && subject !== "all") {
      const stat = statForSubject(student, subject);
      return isExistingResultStat(student, stat) ? [Number(stat.score)] : [];
    }
    return availableSubjects().flatMap((subject) => scoresForSubjectAverage([student], subject));
  }

  function analysisMetricsFor(students, subject, depth = 0) {
    const details = aggregateDetails(students, subject);
    if (!hasMetricData(details)) return `<div class="analysis-level analysis-depth-${depth}"><div class="empty-state">${esc(shortSubjectName(subject))} no tiene componentes ni competencias registrados en las claves.</div></div>`;
    return `<div class="analysis-level analysis-depth-${depth} analysis-metrics"><div class="analysis-level-head"><h3>Componentes y competencias de ${esc(shortSubjectName(subject))}</h3></div><div class="teacher-metrics-row admin-results-metrics">${teacherAggregateMetricsHtmlForDetails(details)}</div></div>`;
  }

  function buildAnalysisGroups(students, mode, subject) {
    return groupMetric(students, mode === "curso" ? (s) => `${s.sede}|${s.grade}|${s.group}` : (s) => String(s.grade), mode === "curso" ? (s) => `${s.grade}° ${s.group} · ${s.sede}` : (s) => `${s.grade}°`, subject);
  }


  function closeModal() {
    const backdrop = modalRoot.querySelector(".modal-backdrop");
    if (!backdrop) {
      modalRoot.innerHTML = "";
      state.modalStack = [];
      document.body.classList.remove("modal-open");
      return;
    }
    backdrop.classList.add("is-closing");
    window.setTimeout(() => {
      if (state.modalStack.length) {
        modalRoot.innerHTML = state.modalStack.pop();
        document.body.classList.add("modal-open");
        return;
      }
      modalRoot.innerHTML = "";
      document.body.classList.remove("modal-open");
    }, 160);
  }

  function appModeText() {
    const standalone = window.matchMedia?.("(display-mode: standalone)")?.matches || window.navigator?.standalone;
    return standalone ? "PWA" : "Web";
  }

  function deviceInfoText() {
    const ua = navigator.userAgent || "";
    const os = /Android/i.test(ua) ? "Android" : /iPhone|iPad|iPod/i.test(ua) ? "iOS" : /Windows/i.test(ua) ? "Windows" : /Mac OS/i.test(ua) ? "Mac" : /Linux/i.test(ua) ? "Linux" : "Dispositivo";
    const browser = /Edg\//i.test(ua) ? "Edge" : /Chrome\//i.test(ua) ? "Chrome" : /Safari\//i.test(ua) ? "Safari" : /Firefox\//i.test(ua) ? "Firefox" : "Navegador";
    return `${os} · ${browser}`;
  }

  async function logSupabaseLogout(session) {
    if (!SUPABASE_CONFIG.enabled || !session?.role) return;
    try {
      await supabaseRpc("roque_log_access", {
        p_usuario: session.id || session.roll || session.role,
        p_id_prueba: session.roll || "",
        p_rol: session.role,
        p_evento: "logout",
        p_exitoso: true,
        p_dispositivo: deviceInfoText(),
        p_modo: appModeText()
      });
    } catch (error) {
      console.warn("No se pudo registrar cierre de sesión:", error?.message || error);
    }
  }

  function clearSession() {
    state.activeSession = null;
    state.zeroToleranceShown = false;
    clearSessionRankContext();
    clearRankingFallbackData();
    localStorage.removeItem(STORAGE.session);
    sessionStorage.removeItem("po_supabase_admin_password");
  }

  function enterSessionWithLoader(session, renderFn, message = "Preparando resultados...") {
    state.activeSession = session;
    writeJSON(STORAGE.session, state.activeSession);
    rememberRecentLogin(session);
    fadeAppOut();
    showRouteLoader(message);
    window.setTimeout(() => {
      renderFn();
      fadeAppIn();
      window.setTimeout(hideRouteLoader, 180);
    }, 620);
  }

  function logoutWithFade() {
    const current = state.activeSession;
    logSupabaseLogout(current);
    fadeAppOut();
    showRouteLoader("Cerrando sesión...");
    window.setTimeout(() => {
      clearSession();
      renderLogin();
      fadeAppIn();
      window.setTimeout(hideRouteLoader, 180);
    }, 420);
  }

  function fadeAppOut() {
    app.classList.remove("route-view-enter", "route-view-enter-active");
    app.classList.add("route-view-leave");
  }

  function fadeAppIn() {
    app.classList.remove("route-view-leave");
    app.classList.add("route-view-enter");
    requestAnimationFrame(() => app.classList.add("route-view-enter-active"));
    window.setTimeout(() => app.classList.remove("route-view-enter", "route-view-enter-active"), 460);
  }

  function wait(ms = 0) {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
  }

  function showRouteLoader(message) {
    document.querySelector(".route-loader")?.remove();
    const loader = document.createElement("div");
    const copy = randomLoaderCopy();
    loader.className = "route-loader";
    loader.innerHTML = `
      <div class="route-loader-card">
        <div class="route-loader-mark"></div>
        <strong>${esc(copy.title || message)}</strong>
        <span>${esc(copy.subtitle || "Calculando puntajes, rankings y reportes.")}</span>
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
      "matematicas": "matematicas.png",
      "lenguaje": "lenguaje.png",
      "ciencias-naturales": "ciencias-naturales.png",
      "ingles": "ingles.png",
      "ciencias-sociales-y-ciudadania": "ciencias-sociales-y-ciudadania.png",
      "etica-y-valores": "etica-y-valores.png",
      "artistica": "artistica.png",
      "educacion-fisica": "educacion-fisica.png",
      "informatica": "informatica.png",
      "religion": "religion.png"
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
      empty: "Sin marcar",
      absent: "No presentó"
    }[status] || status;
  }

  function scoreOf(subjectStats, subjectName) {
    const stat = subjectStats?.[subjectName];
    if (!isPresentedStat(stat)) return null;
    const value = stat?.score;
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

  function subjectCandidates(input) {
    const values = [];
    const add = (value) => {
      const clean = cleanText(value);
      if (clean && !values.some((item) => normalizeText(item) === normalizeText(clean))) values.push(clean);
    };
    if (input && typeof input === "object") {
      add(input.subject);
      add(input.subjectRaw);
      add(mappedSubject(input.subjectRaw || input.subject));
      add(canonicalSubject(input.subjectRaw || input.subject));
      add(mappedSubject(input.subject));
      add(canonicalSubject(input.subject));
    } else {
      add(input);
      add(mappedSubject(input));
      add(canonicalSubject(input));
    }
    return values;
  }

  function statForSubject(student, subjectOrAssignment) {
    const stats = student?.subjectStats || {};
    const candidates = subjectCandidates(subjectOrAssignment);
    for (const candidate of candidates) {
      if (stats[candidate]) return stats[candidate];
    }
    const normalized = new Set(candidates.map((candidate) => normalizeText(candidate)).filter(Boolean));
    const key = Object.keys(stats).find((name) => normalized.has(normalizeText(name)));
    return key ? stats[key] : null;
  }

  function subjectNameForAssignment(assignment) {
    if (assignment && typeof assignment === "object") {
      return mappedSubject(assignment.subjectRaw || assignment.subject) || canonicalSubject(assignment.subjectRaw || assignment.subject) || cleanText(assignment.subject || assignment.subjectRaw);
    }
    return mappedSubject(assignment) || canonicalSubject(assignment) || cleanText(assignment);
  }

  // v114: listas completas, promedios y gráficas solo con exámenes reales de RESULTADOS/Supabase.
  function isPresentedStat(stat) {
    return !!(stat && stat.total && !stat.absent && Number.isFinite(Number(stat.score)));
  }

  function studentHasExistingResult(student) {
    if (!student || student.missingExam) return false;
    const roll = cleanId(student.roll || student.registry?.examId);
    const examId = cleanId(student.registry?.examId || "");
    return !!((roll && state.responsesByRoll.has(roll)) || (examId && state.responsesByRoll.has(examId)));
  }


  function studentHasRankingResult(student) {
    if (!student || student.missingExam) return false;
    const roll = cleanId(student.roll || student.registry?.examId);
    const examId = cleanId(student.registry?.examId || "");
    return !!(
      (roll && state.responsesByRoll.has(roll)) ||
      (examId && state.responsesByRoll.has(examId)) ||
      (roll && state.rankingFallbackResponsesByRoll?.has?.(roll)) ||
      (examId && state.rankingFallbackResponsesByRoll?.has?.(examId))
    );
  }

  function evaluatedStudentsOnly(students = []) {
    return (students || []).filter((student) => studentHasExistingResult(student));
  }

  function isExistingResultStat(student, stat) {
    return !!(studentHasExistingResult(student) && stat && stat.total && Number.isFinite(Number(stat.score)));
  }

  function evaluatedStudentsForSubject(students = [], subject) {
    return (students || []).filter((student) => isExistingResultStat(student, statForSubject(student, subject)));
  }

  function scoreForAverageFromStudentStat(student, stat) {
    return isExistingResultStat(student, stat) ? Number(stat.score) : null;
  }

  function scoreForAverageFromStat(stat) {
    return isPresentedStat(stat) ? Number(stat.score) : null;
  }

  function scoresForSubjectAverage(students, subject) {
    return evaluatedStudentsForSubject(students, subject)
      .map((student) => Number(statForSubject(student, subject)?.score))
      .filter((value) => Number.isFinite(Number(value)));
  }

  function scoresForAllSubjectsAverage(student) {
    return Object.values(student?.subjectStats || {}).map((stat) => scoreForAverageFromStudentStat(student, stat)).filter((value) => Number.isFinite(Number(value))).map(Number);
  }

  function studentHasPresentedAnySubject(student) {
    return studentHasExistingResult(student) && Object.values(student?.subjectStats || {}).some((stat) => stat?.total);
  }

  function hasAnyMarkedAnswerForKeys(record, keys = []) {
    if (!record || !record.answers || !Array.isArray(keys) || !keys.length) return false;
    return keys.some((key) => cleanMarked(record.answers?.[key.item] || ""));
  }

  function responseSessions(record) {
    return new Set((record?.sessions || []).map((item) => Number(item.session)).filter(Boolean));
  }

  function sessionForItem(itemNumber) {
    const item = Number(itemNumber || 0);
    const sessions = (state.manifest.sessions || DEFAULT_MANIFEST.sessions || [])
      .slice()
      .sort((a, b) => Number(a.startItem || 0) - Number(b.startItem || 0));
    let selected = sessions[0]?.session ? Number(sessions[0].session) : 1;
    sessions.forEach((session) => {
      if (item >= Number(session.startItem || 0)) selected = Number(session.session || selected);
    });
    return selected;
  }

  function requiredSessionsForKeys(keys = []) {
    return [...new Set((keys || []).map((key) => sessionForItem(key.item)).filter(Boolean))];
  }

  function scoreDisplayHtml(stat, className = "teacher-score teacher-score-plain", showScale = false) {
    const value = Number.isFinite(Number(stat?.score)) ? Number(stat.score) : null;
    const absent = !!stat?.absent && value === 0;
    const classes = `${className}${absent ? " score-absent" : ""}`;
    const title = absent ? ' title="No presentó esta prueba"' : "";
    return `<span class="${classes}"${title}>${value === null ? "—" : value}${showScale ? "<small>/100</small>" : ""}</span>`;
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
        <strong data-rank-number="${escAttr(Number.isFinite(cleanRank) && cleanRank > 0 ? cleanRank : "—")}">${Number.isFinite(cleanRank) && cleanRank > 0 ? cleanRank : "—"}</strong>
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

  function canonicalAreaName(value) {
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

  function canonicalSubject(value) {
    const directMap = subjectAreaMapValue(value);
    if (directMap === SUBJECT_AREA_UNASSIGNED) return "";
    if (directMap) return canonicalAreaName(directMap);
    return canonicalAreaName(value);
  }

  function mappedSubject(value) {
    const raw = cleanText(value);
    if (!raw) return "";
    const directMap = subjectAreaMapValue(raw);
    if (directMap === SUBJECT_AREA_UNASSIGNED) return "";
    return canonicalAreaName(directMap || raw);
  }

  function shortAppName(name) {
    const clean = cleanText(name || "Resultados");
    return clean.length > 24 ? clean.slice(0, 24).trim() : clean;
  }

  function hasMetricData(details, field = null) {
    const list = Array.isArray(details) ? details : [];
    if (field) return list.some((d) => cleanText(d?.[field]));
    return list.some((d) => cleanText(d?.component) || cleanText(d?.competence));
  }

  function displayListName(studentOrName) {
    const raw = typeof studentOrName === "string" ? studentOrName : (studentOrName?.name || "");
    const name = cleanText(raw);
    if (!name) return "";
    if (name.includes(",")) return name;
    const parts = name.split(/\s+/).filter(Boolean);
    if (parts.length >= 4) return `${parts.slice(-2).join(" ")}, ${parts.slice(0, -2).join(" ")}`;
    if (parts.length === 3) return `${parts.slice(-1).join(" ")}, ${parts.slice(0, -1).join(" ")}`;
    return name;
  }

  function compareStudentsByName(a, b) {
    return displayListName(a).localeCompare(displayListName(b), "es", { sensitivity: "base", numeric: true });
  }

  function sortStateKey(scope) {
    return `${scope || "default"}`;
  }

  function tableSort(scope, key) {
    const id = sortStateKey(scope);
    const prev = state.adminTableSort[id] || { key: "name", dir: "asc" };
    const dir = prev.key === key && prev.dir === "asc" ? "desc" : "asc";
    state.adminTableSort[id] = { key, dir };
  }

  function sortRowsByState(rows, scope, getValue) {
    const { key = "name", dir = "asc" } = state.adminTableSort[sortStateKey(scope)] || {};
    const mult = dir === "desc" ? -1 : 1;
    return rows.slice().sort((a, b) => {
      const av = getValue(a, key);
      const bv = getValue(b, key);
      if (typeof av === "number" || typeof bv === "number") return ((Number(av) || 0) - (Number(bv) || 0)) * mult;
      return String(av ?? "").localeCompare(String(bv ?? ""), "es", { sensitivity: "base", numeric: true }) * mult;
    });
  }

  function sortHeader(label, scope, key) {
    const sort = state.adminTableSort[sortStateKey(scope)] || {};
    const mark = sort.key === key ? (sort.dir === "desc" ? " ↓" : " ↑") : "";
    return `<button type="button" class="sort-head" data-action="sort-table" data-scope="${escAttr(scope)}" data-key="${escAttr(key)}">${esc(label)}${mark}</button>`;
  }

  function sameSubject(a, b) {
    return normalizeText(canonicalSubject(a)) === normalizeText(canonicalSubject(b));
  }

  function isTruthy(value) {
    const text = normalizeText(value);
    return ["si", "s", "yes", "y", "true", "1", "coordinador", "coordinator"].includes(text);
  }

  function cleanText(value) {
    return String(value ?? "").replace(/\uFEFF/g, "").trim();
  }

  function cleanId(value) {
    return cleanText(value).replace(/\.0$/, "");
  }

  function parseRankingLoginInput(value) {
    const raw = cleanText(value);
    const suffix = "--ranking";
    const lower = raw.toLowerCase();
    if (lower.endsWith(suffix)) {
      return { login: cleanId(raw.slice(0, -suffix.length)), rankingDebug: true };
    }
    return { login: cleanId(raw), rankingDebug: false };
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
    const subject = normalizeText(mappedSubject(row.subjectRaw || row.subject) || canonicalSubject(row.subjectRaw || row.subject));
    const sede = normalizeText(row.sede || "");
    const group = normalizeText(row.group || "");
    return `${sede}|${grade}|${group}|${subject}`;
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
      const subject = subjectNameForAssignment(assignment) || canonicalSubject(assignment.subject || assignment.subjectRaw);
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
    const sameSede = !assignment.sede || normalizeText(student.sede) === normalizeText(assignment.sede);
    const subjects = subjectCandidates(assignment);
    const hasSubject = !!(statForSubject(student, assignment)?.total || subjects.some((subject) => statForSubject(student, subject)?.total));
    return sameGrade && sameGroup && sameSede && hasSubject;
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
    setHeadLink('icon', state.config.favicon32 || icon, { type: "image/png", sizes: "32x32" });
    setHeadLink('shortcut icon', state.config.favicon32 || icon, { type: "image/png" });
    setHeadLink('apple-touch-icon', state.config.appleTouchIcon || icon);
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
      name: cfg.appName || cfg.title || "Roque Objetiva",
      short_name: shortAppName(cfg.appName || cfg.title || "Roque Objetiva"),
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
        const padding = maskable ? 0 : Math.round(size * 0.08);
        const box = size - padding * 2;
        const ratio = maskable ? Math.max(size / img.width, size / img.height) : Math.min(box / img.width, box / img.height);
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

    let reloadingForUpdate = false;
    const reloadForUpdate = () => {
      if (reloadingForUpdate) return;
      reloadingForUpdate = true;
      try { toast("Actualizando aplicación..."); } catch (error) {}
      window.setTimeout(() => window.location.reload(), 450);
    };

    const checkLatestVersion = async (registration) => {
      try {
        const response = await fetch(`version.json?t=${Date.now()}`, { cache: "no-store" });
        if (!response.ok) return;
        const info = await response.json();
        if (info?.version && info.version !== APP_VERSION) {
          await registration.update();
          if (registration.waiting) registration.waiting.postMessage({ type: "SKIP_WAITING" });
        }
      } catch (error) {
        /* Si no hay red, se conserva la versión instalada. */
      }
    };

    navigator.serviceWorker.addEventListener("controllerchange", reloadForUpdate);
    navigator.serviceWorker.addEventListener("message", (event) => {
      if (event.data?.type === "APP_UPDATED") reloadForUpdate();
    });

    window.addEventListener("load", async () => {
      try {
        const registration = await navigator.serviceWorker.register("service-worker.js", { updateViaCache: "none" });
        if (registration.waiting) registration.waiting.postMessage({ type: "SKIP_WAITING" });
        await registration.update();
        await checkLatestVersion(registration);

        window.setInterval(() => checkLatestVersion(registration), 15 * 60 * 1000);
        window.addEventListener("focus", () => checkLatestVersion(registration));
        document.addEventListener("visibilitychange", () => {
          if (document.visibilityState === "visible") checkLatestVersion(registration);
        });
      } catch (error) {
        /* La app sigue funcionando aunque el registro PWA falle. */
      }
    });
  }

  registerPWA();

  /* Gráficas v54: implementación simple, sin hash y sin rutas externas */
  function adminGraphicsHtml() {
    const mode = state.adminGraphMode === "area" ? "area" : "estructura";
    state.adminGraphMode = mode;
    state.adminGraphSede = state.adminGraphSede || "all";
    state.adminGraphGrade = state.adminGraphGrade || "all";
    state.adminGraphSubject = state.adminGraphSubject || "all";
    if (!state.adminGraphOpen) state.adminGraphOpen = {};

    const allStudents = evaluatedStudentsOnly(state.computedStudents || []);
    const sedes = ["all", ...uniqueValues(allStudents.map((s) => s.sede || "—"))];
    const gradeBase = allStudents.filter((s) => state.adminGraphSede === "all" || (s.sede || "—") === state.adminGraphSede);
    const grades = ["all", ...uniqueValues(gradeBase.map((s) => s.grade).filter(Boolean)).sort((a, b) => Number(a) - Number(b))];
    const subjects = ["all", ...availableSubjects()];
    const base = allStudents
      .filter((s) => state.adminGraphSede === "all" || (s.sede || "—") === state.adminGraphSede)
      .filter((s) => state.adminGraphGrade === "all" || String(s.grade) === String(state.adminGraphGrade));

    const content = mode === "area" ? graphByAreaHtml(base) : graphByStructureHtml(base);
    const help = mode === "area"
      ? "Primero aparecen las áreas/asignaturas. Toca una barra para desplegar sedes, grados, cursos y componentes/competencias debajo."
      : "Primero aparecen las sedes. Toca una barra para desplegar grados, cursos, áreas/asignaturas y componentes/competencias debajo.";

    return `
      <section class="toolbar">
        <div>
          <span class="section-eyebrow">Gráficas</span>
          <h2 style="margin:8px 0 0;font-weight:900;">Desempeño institucional</h2>
          <p class="muted-copy">${esc(help)} Cada valor mostrado es el <strong>promedio de nota</strong> en escala de 20 a 100.</p>
        </div>
      </section>
      <section class="card card-pad admin-results-filters graphics-filters">
        <div class="form-grid compact admin-results-required-grid">
          <div class="field"><label>Ver gráficas por</label><select class="select-pill" data-admin-graph-field="mode"><option value="estructura" ${mode === "estructura" ? "selected" : ""}>Sede / grado / curso</option><option value="area" ${mode === "area" ? "selected" : ""}>Área / asignatura</option></select></div>
          <div class="field"><label>Limitar sede</label><select class="select-pill" data-admin-graph-field="sede">${sedes.map((v)=>`<option value="${escAttr(v)}" ${state.adminGraphSede===v?"selected":""}>${v==="all"?"Todas":esc(v)}</option>`).join("")}</select></div>
          <div class="field"><label>Limitar grado</label><select class="select-pill" data-admin-graph-field="grade">${grades.map((v)=>`<option value="${escAttr(v)}" ${String(state.adminGraphGrade)===String(v)?"selected":""}>${v==="all"?"Todos":`${esc(v)}°`}</option>`).join("")}</select></div>
          <div class="field"><label>Área rápida</label><select class="select-pill" data-admin-graph-field="subject">${subjects.map((v)=>`<option value="${escAttr(v)}" ${state.adminGraphSubject===v?"selected":""}>${v==="all"?"Todas":esc(shortSubjectName(v))}</option>`).join("")}</select></div>
        </div>
      </section>
      <section class="graphics-tree card card-pad">
        <div class="graphics-help"><strong>Promedio de nota</strong><span>El número de cada barra corresponde al promedio de los estudiantes incluidos en ese grupo.</span><button type="button" class="mini-btn" data-action="graph-clear">Cerrar niveles</button></div>
        ${content || `<div class="empty-state">No hay datos para estos filtros.</div>`}
      </section>`;
  }

  function graphByStructureHtml(students) {
    const subject = state.adminGraphSubject || "all";
    const sedes = graphGroupRows(students, (s) => s.sede || "—", (key) => key, subject);
    return graphLevelHtml("Sedes", sedes, 0, (sedeRow) => {
      const sedeStudents = students.filter((s) => (s.sede || "—") === sedeRow.key);
      const grades = graphGroupRows(sedeStudents, (s) => String(s.grade || "Sin grado"), (key) => key === "Sin grado" ? key : `${key}°`, subject);
      return graphLevelHtml(`Grados en ${sedeRow.label}`, grades, 1, (gradeRow) => {
        const gradeStudents = sedeStudents.filter((s) => String(s.grade || "Sin grado") === String(gradeRow.key));
        const courses = graphGroupRows(gradeStudents, (s) => s.group || "Sin curso", (key) => `${gradeRow.label} ${key}`, subject);
        return graphLevelHtml(`Cursos de ${gradeRow.label}`, courses, 2, (courseRow) => {
          const courseStudents = gradeStudents.filter((s) => (s.group || "Sin curso") === courseRow.key);
          const subjects = graphSubjectRows(courseStudents, subject);
          return graphLevelHtml("Áreas / asignaturas", subjects, 3, (subjectRow) => graphMetricsFor(courseStudents, subjectRow.subject, 4), true, `estructura|${sedeRow.key}|${gradeRow.key}|${courseRow.key}`);
        }, false, `estructura|${sedeRow.key}|${gradeRow.key}`);
      }, false, `estructura|${sedeRow.key}`);
    }, false, "estructura");
  }

  function graphByAreaHtml(students) {
    const subjects = graphSubjectRows(students, state.adminGraphSubject || "all");
    return graphLevelHtml("Áreas / asignaturas", subjects, 0, (subjectRow) => {
      const subject = subjectRow.subject;
      const subjectStudents = students.filter((s) => isExistingResultStat(s, statForSubject(s, subject)));
      const sedes = graphGroupRows(subjectStudents, (s) => s.sede || "—", (key) => key, subject);
      return graphLevelHtml(`Sedes en ${shortSubjectName(subject)}`, sedes, 1, (sedeRow) => {
        const sedeStudents = subjectStudents.filter((s) => (s.sede || "—") === sedeRow.key);
        const grades = graphGroupRows(sedeStudents, (s) => String(s.grade || "Sin grado"), (key) => key === "Sin grado" ? key : `${key}°`, subject);
        return graphLevelHtml(`Grados en ${sedeRow.label}`, grades, 2, (gradeRow) => {
          const gradeStudents = sedeStudents.filter((s) => String(s.grade || "Sin grado") === String(gradeRow.key));
          const courses = graphGroupRows(gradeStudents, (s) => s.group || "Sin curso", (key) => `${gradeRow.label} ${key}`, subject);
          return graphLevelHtml(`Cursos de ${gradeRow.label}`, courses, 3, (courseRow) => {
            const courseStudents = gradeStudents.filter((s) => (s.group || "Sin curso") === courseRow.key);
            return graphMetricsFor(courseStudents, subject, 4);
          }, false, `area|${subject}|${sedeRow.key}|${gradeRow.key}`);
        }, false, `area|${subject}|${sedeRow.key}`);
      }, false, `area|${subject}`);
    }, true, "area");
  }

  function graphLevelHtml(title, rows, depth, childRenderer, withIcon = false, parentKey = "") {
    const sorted = [...rows].sort((a, b) => (b.avg || 0) - (a.avg || 0) || a.label.localeCompare(b.label, "es", { numeric: true }));
    return `<div class="graphics-level graphics-depth-${depth}"><div class="graphics-level-head"><h3>${esc(title)}</h3></div><div class="graphics-bars-list">${sorted.map((row, index) => {
      const key = graphNodeKey(parentKey || title, depth, row.key, row.subject || "");
      const open = !!state.adminGraphOpen?.[key];
      const child = open && typeof childRenderer === "function" ? `<div class="graphics-child smooth-reveal">${childRenderer(row) || ""}</div>` : "";
      return `<div class="graphics-row-wrap">${graphBarHtml(row, key, index, withIcon, open)}${child}</div>`;
    }).join("") || `<div class="empty-state">No hay datos en este nivel.</div>`}</div></div>`;
  }

  function graphNodeKey(parent, depth, key, subject) {
    return [parent, `d${depth}`, key, subject].map((part) => String(part || "").replace(/\|/g, "/")).join("|");
  }

  function graphBarHtml(row, key, index, withIcon = false, open = false) {
    const width = clamp(row.avg || 0, 0, 100);
    return `<button type="button" class="graphics-drill-row ${open ? "active" : ""}" data-action="graph-toggle" data-graph-key="${escAttr(key)}" title="Promedio de nota: ${escAttr(row.avg)}/100">
      <span class="graphics-rank">${index + 1}</span>
      ${withIcon ? subjectIcon(row.subject || row.label) : ""}
      <span class="graphics-label"><strong>${esc(row.label)}</strong><small>${esc(row.caption || "Promedio de nota")} · ${row.count} estudiante${row.count === 1 ? "" : "s"}</small></span>
      <span class="graphics-track" aria-label="Promedio ${escAttr(row.avg)} de 100"><i style="width:${width}%"></i></span>
      <strong class="graphics-score"><span>Promedio</span>${esc(row.avg)}<small>/100</small></strong>
    </button>`;
  }

  function setGraphField(field, value) {
    const safe = cleanText(value) || "all";
    if (field === "mode") state.adminGraphMode = safe === "area" ? "area" : "estructura";
    if (field === "sede") { state.adminGraphSede = safe; state.adminGraphGrade = "all"; }
    if (field === "grade") state.adminGraphGrade = safe;
    if (field === "subject") state.adminGraphSubject = safe;
    state.adminGraphOpen = {};
    renderAdminContext();
  }

  function toggleGraphNode(key) {
    if (!key) return;
    if (!state.adminGraphOpen) state.adminGraphOpen = {};
    state.adminGraphOpen[key] = !state.adminGraphOpen[key];
    renderAdminContext();
  }

  function lockMobileZoom() {
    const viewport = document.querySelector('meta[name="viewport"]');
    if (viewport) {
      viewport.setAttribute("content", "width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no, viewport-fit=cover");
    }

    let lastTouchEnd = 0;
    const preventMultiTouch = (event) => {
      if (event.touches && event.touches.length > 1) {
        event.preventDefault();
      }
    };
    const preventGesture = (event) => event.preventDefault();

    document.addEventListener("touchstart", preventMultiTouch, { passive: false });
    document.addEventListener("touchmove", preventMultiTouch, { passive: false });
    document.addEventListener("gesturestart", preventGesture, { passive: false });
    document.addEventListener("gesturechange", preventGesture, { passive: false });
    document.addEventListener("gestureend", preventGesture, { passive: false });
    document.addEventListener("touchend", (event) => {
      const now = Date.now();
      if (now - lastTouchEnd <= 300) {
        event.preventDefault();
      }
      lastTouchEnd = now;
    }, { passive: false });
  }

  lockMobileZoom();

})();
