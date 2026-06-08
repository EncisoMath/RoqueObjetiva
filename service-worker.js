const APP_VERSION = "v110";
const CACHE_VERSION = "resultados-pwa-v110";
const CACHE_PREFIXES = ["resultados-pwa-", "resultados-pruebas-"];

const APP_SHELL = [
  "./",
  "index.html",
  "css/app.css?v=109",
  "js/app.js?v=109",
  "version.json",
  "config/data-manifest.json",
  "config/site-config.json",
  "config/supabase-config.js?v=109",
  "INTERNO/DIRECTORESGRUPO.json",
  "manifest.webmanifest?v=109",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/maskable-512.png",
  "icons/apple-touch-icon.png",
  "assets/logo-principal.png?v=85",
  "icons/favicon-16.png",
  "icons/favicon-32.png",
  "assets/default-logo.svg",
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

    const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    await Promise.all(clients.map(async (client) => {
      try { client.postMessage({ type: "APP_UPDATED", version: APP_VERSION }); } catch (error) {}
      try { await client.navigate(client.url); } catch (error) {}
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
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  const pathname = url.pathname;
  const isDocument = request.mode === "navigate" || pathname.endsWith("/") || pathname.endsWith(".html");
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
