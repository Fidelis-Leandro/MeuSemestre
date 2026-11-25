// MeuSemestre: funciona offline. Mude a versão ao publicar arquivos novos.
const CACHE = "meusemestre-v23";
const ARQUIVOS = [
  "./", "index.html", "manifest.json",
  "css/base.css", "css/componentes.css",
  "js/app.js", "js/dados.js", "js/regras.js", "js/util.js", "js/plano-ensino.js", "js/animacoes.js", "js/tema.js",
  "js/telas/lista.js", "js/telas/cadeira.js", "js/telas/formulario.js", "js/telas/agenda.js",
  "js/telas/grade.js", "js/telas/importacao.js", "js/telas/sobre.js",
  "img/icon-192.png", "img/icon-512.png",
  "lib/pdf.min.js", "lib/pdf.worker.min.js", "lib/pdf-worker.js", "lib/stream-polyfill.js"
];

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
