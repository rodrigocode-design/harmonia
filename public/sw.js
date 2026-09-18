const CACHE = "harmonia-shell-v1";
const SAFE_ASSETS = ["/favicon.svg", "/icon-192.png", "/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SAFE_ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))).then(() => self.clients.claim()));
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/signin-") || url.pathname.startsWith("/signout-") || request.mode === "navigate") {
    event.respondWith(fetch(request));
    return;
  }
  if (url.pathname.startsWith("/_next/static/") || SAFE_ASSETS.includes(url.pathname)) {
    event.respondWith(caches.match(request).then((cached) => cached || fetch(request).then((response) => {
      if (response.ok && response.type === "basic") caches.open(CACHE).then((cache) => cache.put(request, response.clone()));
      return response;
    })));
  }
});
