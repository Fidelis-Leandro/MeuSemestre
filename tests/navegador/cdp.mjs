// Mini cliente do Chrome DevTools Protocol para os roteiros de tests/navegador/. Sem dependências (Node 22+).
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

export const PASTA = path.dirname(fileURLToPath(import.meta.url));
export const TMP = path.join(PASTA, "tmp"); // perfis do Chrome e cópias de commits (ignorado pelo git)

// Chrome ou Edge instalado. Para usar outro, defina a variável CHROME com o caminho do executável.
export function caminhoChrome() {
  const candidatos = [process.env.CHROME,
    "C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser"];
  const exe = candidatos.find(c => c && fs.existsSync(c));
  if (!exe) throw new Error("Chrome não encontrado. Defina a variável CHROME com o caminho do executável.");
  return exe;
}

// Abre um Chrome headless com perfil limpo em tmp/<nomePerfil>.
export async function abrirChrome(nomePerfil, porta) {
  const perfil = path.join(TMP, nomePerfil);
  fs.rmSync(perfil, { recursive: true, force: true }); fs.mkdirSync(perfil, { recursive: true });
  const proc = spawn(caminhoChrome(), ["--headless=new", `--remote-debugging-port=${porta}`, `--user-data-dir=${perfil}`,
    "--no-first-run", "--no-default-browser-check", "--window-size=420,900", "about:blank"], { stdio: "ignore" });
  process.on("exit", () => proc.kill());
  return { proc, porta };
}

// Conecta numa aba (page) do Chrome: send(), avaliar(), ouvir().
export async function chrome(nomePerfil, porta = 9333) {
  const { proc } = await abrirChrome(nomePerfil, porta);
  let alvo;
  for (let i = 0; i < 50 && !alvo; i++) { await new Promise(r => setTimeout(r, 200)); try { const l = await (await fetch(`http://127.0.0.1:${porta}/json/list`)).json(); alvo = l.find(t => t.type === "page"); } catch {} }
  if (!alvo) throw new Error("o Chrome não respondeu na porta " + porta);
  const ws = new WebSocket(alvo.webSocketDebuggerUrl);
  await new Promise(r => ws.onopen = r);
  let id = 0; const pend = new Map(); const ouvintes = [];
  ws.onmessage = ev => { const m = JSON.parse(ev.data); if (m.id && pend.has(m.id)) { const { res, rej } = pend.get(m.id); pend.delete(m.id); m.error ? rej(new Error(m.error.message)) : res(m.result); } else ouvintes.forEach(f => f(m)); };
  const send = (method, params = {}) => new Promise((res, rej) => { const i = ++id; pend.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params })); });
  const avaliar = async expr => { const r = await send("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) throw new Error("JS: " + (r.exceptionDetails.exception?.description || r.exceptionDetails.text)); return r.result.value; };
  return { send, avaliar, ouvir: f => ouvintes.push(f), fechar: () => { ws.close(); proc.kill(); } };
}
