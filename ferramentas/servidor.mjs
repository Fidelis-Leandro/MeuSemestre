// Servidor estático para desenvolvimento, sem dependências.
// Uso: node ferramentas/servidor.mjs [porta]   (padrão: 8080, em 0.0.0.0, para abrir também pelo celular na mesma rede)
// Também é importado pelos roteiros de tests/navegador/ (função servir).
import http from "node:http";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const RAIZ_PROJETO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const TIPOS = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8", ".md": "text/plain; charset=utf-8",
  ".png": "image/png", ".svg": "image/svg+xml", ".ico": "image/x-icon", ".pdf": "application/pdf",
};

// Serve a pasta "raiz". Sem cache HTTP (no-store), para cada recarga pegar o arquivo atual do disco.
export function servir({ raiz = RAIZ_PROJETO, porta = 8080, host = "0.0.0.0", log = false } = {}) {
  const base = path.resolve(raiz);
  const srv = http.createServer((req, res) => {
    let p;
    try { p = decodeURIComponent(new URL(req.url, "http://x").pathname); } catch { res.writeHead(400).end(); return; }
    if (p.endsWith("/")) p += "index.html";
    const f = path.resolve(base, "." + p);
    if (f !== base && !f.startsWith(base + path.sep)) { res.writeHead(403).end(); return; }
    fs.readFile(f, (e, d) => {
      if (log) console.log(e ? "404" : "200", p);
      if (e) { res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }).end("404"); return; }
      res.writeHead(200, { "Content-Type": TIPOS[path.extname(f).toLowerCase()] || "application/octet-stream", "Cache-Control": "no-store" }).end(d);
    });
  });
  return new Promise((ok, erro) => { srv.once("error", erro); srv.listen(porta, host, () => ok(srv)); });
}

// Endereços IPv4 do PC na rede local (Wi-Fi, cabo), para abrir no celular.
function enderecosLocais() {
  return Object.values(os.networkInterfaces()).flat().filter(i => i && i.family === "IPv4" && !i.internal).map(i => i.address);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const porta = +(process.argv[2] || 8080);
  servir({ porta, log: true }).then(() => {
    console.log(`MeuSemestre servido de ${RAIZ_PROJETO}`);
    console.log(`  Neste PC:  http://localhost:${porta}/`);
    const ips = enderecosLocais();
    if (ips.length) ips.forEach(ip => console.log(`  Na rede:   http://${ip}:${porta}/   (celular no mesmo Wi-Fi)`));
    else console.log("  Nenhum endereço de rede local encontrado (o PC está conectado?).");
    console.log("Ctrl+C para parar.");
  }).catch(e => { console.error(e.code === "EADDRINUSE" ? `A porta ${porta} já está em uso. Tente: node ferramentas/servidor.mjs ${porta + 1}` : e.message); process.exit(1); });
}
