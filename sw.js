// MeuSemestre: funciona offline. Mude a versão ao publicar arquivos novos.
const CACHE = "meusemestre-v13";
const ARQUIVOS = ["./", "index.html", "manifest.json", "icon-192.png", "icon-512.png", "pdf.min.js", "pdf.worker.min.js", "pdf-worker.js", "stream-polyfill.js"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ARQUIVOS)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
// Busca sempre a versão nova na internet; sem internet, usa a versão salva.
self.addEventListener("fetch", e => {
  if (e.request.method !== "GET" || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(caches.open(CACHE).then(async c => {
    try {
      const r = await fetch(e.request, { cache: "no-cache" });
      if (r.ok) c.put(e.request, r.clone());
      return r;
    } catch (err) {
      return (await c.match(e.request, { ignoreSearch: true })) || (await c.match("index.html"));
    }
  }));
});
