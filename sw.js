const CACHE = "urban-nex-v1";
const FILES = ["./", "index.html", "style.css", "util.js", "store.js", "game.js", "app.js", "manifest.webmanifest",
  "icon-192.png", "icon-512.png", "maskable-512.png", "apple-touch-icon.png"];
self.addEventListener("install", e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting())); });
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
// abre na hora pelo cache e atualiza em segundo plano (a versão nova aparece na abertura seguinte)
self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  e.respondWith(caches.open(CACHE).then(async c => {
    const hit = await c.match(e.request, { ignoreSearch: true });
    const net = fetch(e.request).then(r => { if (r.ok) c.put(e.request, r.clone()); return r; }).catch(() => null);
    return hit || (await net) || (await c.match("index.html"));
  }));
});
