/* Fascinate IT portal — service worker.
   Makes the app installable and loads the shell fast / offline.
   API calls (/api/...) are never cached, so data is always live. */
const CACHE = "fit-portal-v1";
const SHELL = ["/", "/index.html", "/manifest.json", "/icons/icon-192.png", "/icons/icon-512.png", "/image.png", "/logo-mark.svg"];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;          // e.g. API on another host
  if (url.pathname.startsWith("/api/")) return;            // never cache live data

  // Page loads: network first so a new deployment shows up immediately; fall back to the cached shell offline.
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put("/index.html", copy)).catch(() => {});
        return res;
      }).catch(() => caches.match("/index.html").then(r => r || caches.match("/")))
    );
    return;
  }

  // Static files (hashed JS/CSS, images): serve from cache, refresh in the background.
  event.respondWith(
    caches.match(req).then(cached => {
      const fresh = fetch(req).then(res => {
        if (res && res.ok && res.type === "basic") { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {}); }
        return res;
      }).catch(() => cached);
      return cached || fresh;
    })
  );
});
