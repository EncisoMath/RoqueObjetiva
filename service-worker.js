const APP_VERSION = "v175.89";
const CACHE_VERSION = "resultados-pwa-v175-89-espacio-heroes-admin";
const CACHE_PREFIXES = ["resultados-pwa-", "resultados-pruebas-"];

const APP_SHELL = [
  "./",
  "index.html",
  "css/app.css?v=175.89",
  "css/login-performance.css?v=175.89",
  "css/christmas-login.css?v=175.89",
  "css/ediciones.css?v=175.89",
  "css/admin-navigation.css?v=175.89",
  "css/teacher-navigation.css?v=175.89",
  "css/teacher-dashboard.css?v=175.89",
  "css/coordinator-mover.css?v=175.89",
  "css/screen-hero.css?v=175.89",
  "css/admin-personal.css?v=175.89",
  "css/admin-asignaturas-areas.css?v=175.89",
  "css/admin-restricciones.css?v=175.89",
  "css/admin-personal-motion.css?v=175.89",
  "css/admin-estadisticas.css?v=175.89",
  "css/admin-claves.css?v=175.89",
  "css/consulta-estudiante.css?v=175.89",
  "css/shared-hero.css?v=175.89",
  "css/seasonal-hero.css?v=175.89",
  "css/student-editions.css?v=175.89",
  "css/student-dock.css?v=175.89",
  "css/student-dashboard.css?v=175.89",
  "css/student-subject-modal.css?v=175.89",
  "js/admin-personal.js?v=175.89",
  "js/admin-asignaturas-areas.js?v=175.89",
  "js/admin-restricciones.js?v=175.89",
  "js/admin-estadisticas.js?v=175.89",
  "js/admin-claves.js?v=175.89",
  "js/consulta-estudiante.js?v=175.89",
  "js/screen-hero.js?v=175.89",
  "js/app.js?v=175.89",
  "js/christmas-responsive.js?v=175.89",
  "js/ediciones.js?v=175.89",
  "version.json",
  "config/data-manifest.json",
  "config/site-config.json",
  "config/supabase-config.js?v=175.89",
  "manifest.webmanifest?v=175.89",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/maskable-512.png",
  "icons/apple-touch-icon.png",
  "icons/favicon-16.png",
  "icons/favicon-32.png",
  "assets/logo-principal.png?v=175.89",
  "assets/navidad/arbol.webp",
  "assets/navidad/hoja.webp",
  "assets/navidad/regalo1.webp",
  "assets/navidad/regalo2.webp",
  "assets/navidad/santa.webp",
  "assets/navidad/oso.webp",
  "assets/navidad/cafe.webp",
  "assets/navidad/nieves.webp",
  "assets/ZERO.png",
  "ICONOS/artistica.png",
  "ICONOS/ciencias-naturales.png",
  "ICONOS/ciencias-sociales-y-ciudadania.png",
  "ICONOS/educacion-fisica.png",
  "ICONOS/etica-y-valores.png",
  "ICONOS/informatica.png",
  "ICONOS/ingles.png",
  "ICONOS/lenguaje.png",
  "ICONOS/matematicas.png",
  "ICONOS/religion.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_VERSION);
    await cache.addAll(APP_SHELL.map((url) => new Request(url, { cache: "reload" })));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys
      .filter((key) => key !== CACHE_VERSION && CACHE_PREFIXES.some((prefix) => key.startsWith(prefix)))
      .map((key) => caches.delete(key))
    );

    await self.clients.claim();

    // Informar sin recargar ni navegar a los usuarios activos:
    // formularios, movimientos y selección de pestaña no deben interrumpirse.
    const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    await Promise.all(clients.map(async (client) => {
      try { client.postMessage({ type: "APP_UPDATED", version: APP_VERSION }); } catch (error) {}
    }));
  })());
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // v135: Supabase y cualquier API externa de datos vivos nunca se guardan ni se leen de CacheStorage.
  // Esto aplica tambien a POST/RPC, para que la PWA instalada no reutilice una base de datos vieja.
  if (isLiveDatabaseRequest(url)) {
    event.respondWith(fetch(noStoreRequest(request)));
    return;
  }

  if (request.method !== "GET") return;
  if (url.origin !== self.location.origin) return;

  const pathname = url.pathname;
  const isDocument = request.mode === "navigate" || pathname.endsWith("/") || pathname.endsWith(".html");
  // Los recursos con version ?v=... son inmutables entre actualizaciones de PWA.
  // Usar CacheStorage primero evita re-descargar 800+ KB de CSS y JS en cada acceso.
  // Los documentos, configuraciones y datos siguen buscando primero en la red.
  const isVersionedAsset = /\.(js|css)$/.test(pathname) && url.searchParams.has("v");
  if (isVersionedAsset) {
    event.respondWith(cacheFirst(request));
    return;
  }
  const mustBeFresh = isDocument
    || pathname.endsWith(".js")
    || pathname.endsWith(".css")
    || pathname.endsWith(".json")
    || pathname.endsWith(".webmanifest");

  if (mustBeFresh) {
    event.respondWith(networkFirst(request, isDocument ? "index.html" : null));
    return;
  }

  event.respondWith(cacheFirst(request));
});

function isLiveDatabaseRequest(url) {
  const host = (url.hostname || "").toLowerCase();
  return host.endsWith(".supabase.co") || host.includes("supabase");
}

function noStoreRequest(request) {
  try {
    return new Request(request, { cache: "no-store" });
  } catch (error) {
    return request;
  }
}

function requestWithReload(request) {
  try {
    return new Request(request, { cache: "reload" });
  } catch (error) {
    return request;
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(requestWithReload(request));
  if (response && response.ok) {
    const cache = await caches.open(CACHE_VERSION);
    cache.put(request, response.clone());
  }
  return response;
}

async function networkFirst(request, fallbackUrl = null) {
  const cache = await caches.open(CACHE_VERSION);
  try {
    const response = await fetch(requestWithReload(request));
    if (response && response.ok) cache.put(request, response.clone());
    return response;
  } catch (error) {
    const cached = await caches.match(request);
    if (cached) return cached;
    if (fallbackUrl) {
      const fallback = await caches.match(fallbackUrl) || await caches.match("./");
      if (fallback) return fallback;
    }
    throw error;
  }
}
