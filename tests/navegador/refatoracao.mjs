// Roteiro de regressão no Chrome headless: roda os mesmos ~60 passos (cadastro, notas, faltas, formulário, agenda,
// grade, tema, backup, importação de PDF) na pasta do projeto e numa cópia de um commit, e compara o HTML e os
// dados salvos passo a passo. Depois, só no projeto: animações ligadas, service worker e importação de PDF offline.
// Uso: node tests/navegador/refatoracao.mjs [commit]   (padrão: HEAD, ou seja, compara o que mudou desde o último commit)
// A cópia do commit é gerada com git archive em tests/navegador/tmp/. Sai com código 1 se algo falhar ou diferir.
import fs from "node:fs"; import path from "node:path"; import { execFileSync } from "node:child_process";
import { abrirChrome, PASTA, TMP } from "./cdp.mjs";
import { servir, RAIZ_PROJETO } from "../../ferramentas/servidor.mjs";

// Extrai o commit pedido com git archive (formato tar, lido aqui mesmo, sem depender do tar do sistema).
function extrairCommit(ref) {
  const sha = execFileSync("git", ["rev-parse", "--verify", ref + "^{commit}"], { cwd: RAIZ_PROJETO, encoding: "utf8" }).trim();
  const dest = path.join(TMP, "commit-" + sha.slice(0, 12));
  if (fs.existsSync(path.join(dest, ".completo"))) return { sha, dest };
  fs.rmSync(dest, { recursive: true, force: true });
  const tar = execFileSync("git", ["archive", "--format=tar", sha], { cwd: RAIZ_PROJETO, maxBuffer: 1 << 30 });
  const txt = (b, i, n) => b.toString("utf8", i, i + n).replace(/\0.*$/s, "");
  let i = 0, proxNome = null;
  while (i + 512 <= tar.length && tar[i] !== 0) {
    const tam = parseInt(txt(tar, i + 124, 12).trim() || "0", 8), tipo = String.fromCharCode(tar[i + 156] || 48);
    const prefixo = txt(tar, i + 345, 155), nome = proxNome || (prefixo ? prefixo + "/" : "") + txt(tar, i + 0, 100);
    const dados = tar.subarray(i + 512, i + 512 + tam); proxNome = null;
    if (tipo === "x") { const m = dados.toString("utf8").match(/\d+ path=([^\n]*)\n/); if (m) proxNome = m[1]; }
    else if (tipo === "0") { const f = path.join(dest, nome); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, dados); }
    else if (tipo === "5") fs.mkdirSync(path.join(dest, nome), { recursive: true });
    i += 512 + Math.ceil(tam / 512) * 512;
  }
  fs.writeFileSync(path.join(dest, ".completo"), sha);
  return { sha, dest };
}

const REF = process.argv[2] || "HEAD";
const orig = extrairCommit(REF);
console.log(`Comparando a pasta do projeto com ${REF} (${orig.sha.slice(0, 7)})`);
const srvNovo = await servir({ raiz: RAIZ_PROJETO, porta: 8123, host: "127.0.0.1" });
const srvOrig = await servir({ raiz: orig.dest, porta: 8124, host: "127.0.0.1" });
const PORTA = 9335;
const { proc } = await abrirChrome("perfil-refatoracao", PORTA);
const espera = ms => new Promise(r => setTimeout(r, ms));
let info; for (let i = 0; i < 50 && !info; i++) { try { info = await (await fetch(`http://127.0.0.1:${PORTA}/json/version`)).json(); } catch { await espera(200); } }
const ws = new WebSocket(info.webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
let nid = 0; const pend = new Map(), ouvintes = [];
ws.onmessage = m => { const d = JSON.parse(m.data); if (d.id && pend.has(d.id)) { const p = pend.get(d.id); pend.delete(d.id); d.error ? p.rej(new Error(JSON.stringify(d.error))) : p.res(d.result); } else ouvintes.forEach(h => h(d)); };
const cdp = (method, params = {}, sessionId) => new Promise((res, rej) => { const id = ++nid; pend.set(id, { res, rej }); ws.send(JSON.stringify({ id, method, params, sessionId })); });

const hoje = new Date(); const iso = k => { const d = new Date(hoje); d.setDate(d.getDate() + k); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; };
const DIA_JS = ["Domingo","Segunda","Terça","Quarta","Quinta","Sexta","Sábado"]; const diaHoje = DIA_JS[hoje.getDay()];
const semente = { cadeiras: [
  { id:"c1", nome:"Epidemiologia", ch:60, periodosDia:2, faltas:3, exame:null, aulas:[{dia:diaHoje,ini:"00:00",fim:"23:59",periodos:2},{dia:"Quarta",ini:"10:00",fim:"11:40",periodos:2}],
    avaliacoes:[{id:"a1",nome:"Prova 1",peso:40,nota:8,data:iso(-4)},{id:"a2",nome:"Prova 2",peso:40,nota:null,data:iso(3)},{id:"a3",nome:"Trabalho",peso:20,nota:null,data:iso(10),subs:[{nome:"Prova",peso:50,nota:6},{nome:"Relatório",peso:50,nota:null}]}] },
  { id:"c2", nome:"Bioestatística <b>x</b>", ch:30, periodosDia:2, faltas:10, exame:null, avaliacoes:[{id:"b1",nome:"P",peso:100,nota:5,data:""}] },
  { id:"c3", nome:"Introdução à Inteligência Artificial na Área da Saúde", ch:90, periodosDia:3, faltas:0, exame:null, aulas:[{dia:"Sexta",ini:"",fim:"",periodos:3}],
    avaliacoes:[{id:"d1",nome:"P1",peso:50,nota:5,data:iso(-1)},{id:"d2",nome:"P2",peso:50,nota:null,data:iso(1)}] },
  { id:"c4", nome:"Anatomia", ch:45, periodosDia:2, faltas:0, exame:null, aulas:[{dia:"Segunda",ini:"08:00",fim:"09:40",periodos:2}], avaliacoes:[{id:"f1",nome:"Prova",peso:100,nota:6.5,data:""}] } ],
  eventos: [{id:"e1",data:iso(2),cadeiraId:"c1",tipo:"Trabalho",obs:"Entregar"},{id:"e2",data:iso(-5),cadeiraId:"",tipo:"Outro",obs:""},{id:"e3",data:iso(0),cadeiraId:"c4",tipo:"Sem aula",obs:""}],
  criadoEm: new Date(Date.now()-30*864e5).toISOString() };
const backupOk = JSON.stringify({ app:"MeuSemestre", versao:1, salvoEm:"2026-10-01T12:00:00.000Z", dados:{ cadeiras:[{id:"r1",nome:"Restaurada",ch:60,periodosDia:2,faltas:1,exame:null,avaliacoes:[{id:"x",nome:"P",peso:100,nota:null,data:""}]}], eventos:[] } });
const pdfB64 = fs.readFileSync(path.join(PASTA, "plano-teste.pdf")).toString("base64");

// Ajudantes injetados antes de qualquer script (inclui Math.random com semente, para os ids saírem iguais nas duas versões).
const PRELUDIO = `(()=>{ let s=12345; Math.random=()=>{ s=(s*1103515245+12345)%2147483648; return s/2147483648; };
  window.__btn=(t,n=0)=>{ const b=[...document.querySelectorAll("button")].filter(b=>b.textContent.trim().startsWith(t))[n]; if(!b) throw new Error("botão não achado: "+t); b.click(); };
  window.__val=(el,v,ev="change")=>{ if(typeof el==="string") el=document.querySelector(el); if(!el) throw new Error("campo não achado"); el.value=v; el.dispatchEvent(new Event(ev,{bubbles:true})); };
  window.__arquivo=(sel,nome,tipo,conteudo,b64)=>{ const bytes=b64?Uint8Array.from(atob(conteudo),c=>c.charCodeAt(0)):conteudo; const dt=new DataTransfer(); dt.items.add(new File([bytes],nome,{type:tipo})); const i=document.querySelector(sel); i.files=dt.files; i.dispatchEvent(new Event("change",{bubbles:true})); };
  window.__snap=()=>{ const ov=document.body.lastElementChild; return JSON.stringify({ titulo:document.getElementById("titulo").textContent, topo:document.getElementById("topo").innerHTML,
    app:document.getElementById("app").innerHTML, dados:localStorage.getItem("ufcspa-faltas-notas-v1"), tema:localStorage.getItem("meusemestre-tema"),
    classe:document.documentElement.className, cor:document.querySelector('meta[name=theme-color]').content, btnTema:document.getElementById("btn-tema").textContent,
    sobreposicao: ov.tagName==="DIV"&&ov.style.position==="fixed" ? ov.innerHTML : "" }); };
})();`;

const esperaImport = `for(let i=0;i<150&&document.getElementById('titulo').textContent!=="Revisar importação";i++) await new Promise(r=>setTimeout(r,100));`;
const PASSOS = [
  ["lista inicial", ""],
  ["faltei agora", `__btn("Faltei (+")`], ["desfazer agora", `__btn("Desfazer")`],
  ["abre cadeira pelo card",`document.querySelector('.card-cad[data-id=c1]').click()`],
  ["+1 período", `__btn("+1 período")`], ["−1", `__btn("−1")`], ["faltei no dia", `__btn("Faltei ")`],
  ["lança nota P2", `__val(document.querySelectorAll('.nota-bloco input')[1],"7,5")`],
  ["lança parte (aprova e comemora)", `__val(document.querySelectorAll('.nota-bloco input')[3],"9")`],
  ["fecha comemoração", `__btn("Continuar")`],
  ["nota fora da faixa", `__val(document.querySelectorAll('.nota-bloco input')[0],"12")`],
  ["simulador", `ir('detalhe','c3'); __val("#sim","8","input")`], ["simulador inválido", `__val("#sim","11","input")`],
  ["nota do exame", `ir('detalhe','c4'); __val('.destaque input',"8")`], ["fecha comemoração 2", `__btn("Continuar")`],
  ["reprovado por falta", `ir('detalhe','c2')`],
  ["editar cadeira", `ir('lista'); ir('detalhe','c1'); __btn("Editar cadeira")`],
  ["+ dia de aula", `__btn("+ Dia de aula")`],
  ["muda dia/horário", `const s=document.querySelectorAll('#f-aulas select'); __val(s[s.length-1],"Sexta"); let t=document.querySelectorAll('#f-aulas input[type=time]'); __val(t[t.length-2],"14:00"); t=document.querySelectorAll('#f-aulas input[type=time]'); __val(t[t.length-1],"15:40")`],
  // Remove a aula recém-adicionada (a última). Antes removia a primeira, que é a aula de hoje (00:00–23:59);
  // sem ela, o "faltei agora (de novo)" lá embaixo só achava o botão se o roteiro rodasse no horário da aula de quarta.
  ["remove aula", `const x=document.querySelectorAll('#f-aulas .x'); x[x.length-1].click()`],
  ["+ avaliação", `__btn("+ Avaliação")`],
  ["edita avaliação", `let ins=document.querySelectorAll('#f-avs .aval input'); __val(ins[ins.length-2],"Seminário","input"); ins=document.querySelectorAll('#f-avs .aval input'); __val(ins[ins.length-1],"10","input")`],
  ["divide em partes", `__btn("Dividir em partes")`],
  ["edita parte", `const r=document.querySelectorAll('#f-avs .aval[style*="16px"] input'); __val(r[0],"Teórica","input"); __val(r[1],"60","input")`],
  ["+ parte e remove parte", `__btn("+ Parte"); document.querySelectorAll('#f-avs .aval[style*="16px"] .x')[2].click()`],
  ["data da avaliação", `__val(document.querySelector('#f-avs input[type=date]'),"${iso(20)}","input")`],
  ["remove avaliação", `const x=document.querySelectorAll('#f-avs .aval[style*="80px 32px"] .x'); x[x.length-1].click()`],
  ["salva edição", `__btn("Salvar")`],
  ["nova cadeira sem nome", `ir('form'); __btn("Salvar")`],
  ["nova cadeira salva", `__val("#f-nome","Fisiologia","input"); __val("#f-ch","90"); __btn("Salvar")`],
  ["excluir (1º toque)", `__btn("Editar cadeira"); __btn("Excluir cadeira")`],
  ["excluir (2º toque)", `__btn("Toque de novo")`],
  ["agenda", `__btn("Agenda")`], ["novo evento", `__btn("+ Evento")`],
  ["evento sem data", `__btn("Salvar evento")`],
  ["salva evento", `__val("#e-data","${iso(5)}"); __val("#e-cad","c3"); __val("#e-tipo","Prova"); __val("#e-obs","  Prova extra  ","input"); __btn("Salvar evento")`],
  ["exclui evento", `document.querySelector('.ag .x').click()`],
  ["abre cadeira pela agenda", `ir('agenda'); document.querySelector('.ag [onclick]').click()`],
  ["grade", `ir('grade')`],
  ["preenche horário na grade", `__val(document.querySelectorAll('#app input[type=time]')[0],"10:00"); __val(document.querySelectorAll('#app input[type=time]')[1],"12:30")`],
  ["cadeira pela grade", `[...document.querySelectorAll('#app [onclick]')].find(e=>e.getAttribute('onclick').startsWith("ir('detalhe'")).click()`],
  ["lista: faltei hoje", `ir('lista'); __btn("Faltei hoje")`], ["desfazer", `__btn("Desfazer")`], ["faltei agora (de novo)", `__btn("Faltei (+")`],
  ["próximas avaliações → agenda", `__btn("Ver agenda")`],
  ["tema 1", `__btn("Cadeiras"); document.getElementById('btn-tema').click()`], ["grade no escuro", `ir('grade')`], ["tema 2", `document.getElementById('btn-tema').click()`],
  ["sobre pelo rodapé", `document.querySelector('footer a').click()`], ["voltar", `document.querySelector('#topo .volta').click()`],
  ["backup inválido", `__arquivo('#bk-in','x.json','application/json','{"a":1}'); await new Promise(r=>setTimeout(r,300))`],
  ["backup válido", `__arquivo('#bk-in','b.json','application/json',${JSON.stringify(backupOk)}); await new Promise(r=>setTimeout(r,300))`],
  ["cancela restauração", `__btn("Cancelar")`],
  ["restaura", `__arquivo('#bk-in','b.json','application/json',${JSON.stringify(backupOk)}); await new Promise(r=>setTimeout(r,300)); __btn("Restaurar",1)`],
  ["salvar backup", `__btn("Salvar backup")`],
  ["importa PDF", `__arquivo('#pdf-in','plano.pdf','application/pdf','${pdfB64}',true); ${esperaImport}`],
  ["desmarca EAD", `const c=[...document.querySelectorAll('#app input[type=checkbox]')]; const u=c[c.length-1]; u.checked=false; u.dispatchEvent(new Event("change"))`],
  ["confirma importação", `__btn("Adicionar cadeiras marcadas")`],
  ["importa de novo e cancela", `__arquivo('#pdf-in','plano.pdf','application/pdf','${pdfB64}',true); ${esperaImport} document.querySelector('#topo .volta').click()`],
  ["PDF inválido", `__arquivo('#pdf-in','ruim.pdf','application/pdf','nao e pdf'); for(let i=0;i<100&&!document.getElementById('imp-msg').textContent.includes("Não consegui");i++) await new Promise(r=>setTimeout(r,100))`],
];

// Normaliza as poucas diferenças intencionais do HTML novo para a forma original.
const normaliza = s => s
  .replace(/onclick="abrirCadeira\('(\w+)'\)"/g, `onclick="if(!_arrastou) ir('detalhe','$1')"`)
  .replace(/onclick="addAulaForm\(\)"/g, `onclick="_aulasForm.push({dia:'Segunda',ini:'',fim:'',periodos:2});desenharAulasForm()"`)
  .replace(/campoAulaForm\((\d+),'(\w+)',this\.value\)/g, "_aulasForm[$1].$2=this.value")
  .replace(/removerAulaForm\((\d+)\)/g, "_aulasForm.splice($1,1);desenharAulasForm()")
  .replace(/campoAvForm\((\d+),'(\w+)',this\.value\)/g, "_avsForm[$1].$2=this.value")
  .replace(/removerAvForm\((\d+)\)/g, "_avsForm.splice($1,1);desenharAvsForm()")
  .replace(/campoSubForm\((\d+),(\d+),'(\w+)',this\.value\)/g, "_avsForm[$1].subs[$2].$3=this.value")
  .replace(/removerSubForm\((\d+),(\d+)\)/g, "_avsForm[$1].subs.splice($2,1);desenharAvsForm()")
  .replace(/opcaoPlano\((\d+),'(\w+)',this\.(\w+)\)/g, "_planos[$1].$2=this.$3")
  .replace(/src="img\//g, 'src="')
  // Tipos novos de evento (Atividade substitutiva, Evento) e a origem da data de cada avaliação na revisão da importação.
  .replace(/<option>Atividade substitutiva<\/option><option>Evento<\/option>/g, "")
  .replace(/<div class="meta" style="font-size:\.8rem">(\d\d\/\d\d)[^<]*?(?:<span[^>]*>confira esta data<\/span> \([^)]*\)|do cronograma)<\/div>/g, ' <span class="meta">· $1</span>')
  .replace(/<div class="meta" style="font-size:\.8rem">sem data no plano<\/div>/g, "")
  .replace(/Usar as datas das avaliações do cronograma/g, "Usar as datas de prova do cronograma")
  // Bloco da grade: o nome mostrado e o formato do horário dependem da medida do texto (ajustarGrade);
  // compara só a cadeira, a faixa e o estilo (posição, tamanho e cores).
  .replace(/<div onclick="ir\('detalhe','(\w+)'\)"((?: data-faixa="[^"]*")?)(?: data-nomes="[^"]*" data-ini="[^"]*" data-fim="[^"]*" title="[^"]*")? (style="[^"]*")><div[^>]*>[^<]*<\/div><div[^>]*>[^<]*(?:<br>[^<]*)?<\/div><\/div>/g, "<bloco-grade $1$2 $3>");
const semHora = s => s && s.replace(/\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d+Z/g, "<ts>");

async function sessao(movimento) {
  const { targetId } = await cdp("Target.createTarget", { url: "about:blank" });
  const { sessionId } = await cdp("Target.attachToTarget", { targetId, flatten: true });
  const erros = [];
  ouvintes.push(d => { if (d.sessionId !== sessionId) return;
    if (d.method === "Runtime.exceptionThrown") erros.push("EXCEÇÃO: " + (d.params.exceptionDetails.exception?.description || d.params.exceptionDetails.text));
    if (d.method === "Runtime.consoleAPICalled" && ["error", "warning", "assert"].includes(d.params.type)) erros.push(`console.${d.params.type}: ` + d.params.args.map(a => a.value ?? a.description).join(" ").slice(0, 300));
    if (d.method === "Log.entryAdded" && ["error", "warning"].includes(d.params.entry.level)) erros.push(`log ${d.params.entry.level}: ${d.params.entry.text} ${d.params.entry.url || ""}`);
  });
  const c = (m, p) => cdp(m, p, sessionId);
  await c("Runtime.enable"); await c("Log.enable"); await c("Page.enable");
  await c("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: movimento ? "no-preference" : "reduce" }, { name: "prefers-color-scheme", value: "light" }] });
  await c("Page.addScriptToEvaluateOnNewDocument", { source: PRELUDIO });
  const avalia = async expr => { const r = await c("Runtime.evaluate", { expression: `(async()=>{ ${expr} })()`, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text); return r.result.value; };
  const vai = async url => { const carregou = new Promise(r => { const h = d => { if (d.sessionId === sessionId && d.method === "Page.loadEventFired") { ouvintes.splice(ouvintes.indexOf(h), 1); r(); } }; ouvintes.push(h); });
    await c("Page.navigate", { url }); await carregou; await espera(500); };
  return { c, avalia, vai, erros, targetId };
}

async function roteiro(base) {
  const s = await sessao(false);
  await s.vai(base + "index.html");
  await s.avalia(`localStorage.clear(); localStorage.setItem("ufcspa-faltas-notas-v1", ${JSON.stringify(JSON.stringify(semente))});`);
  await s.vai(base + "index.html");
  const fotos = [];
  if (process.env.DEPURA) { console.log(base, await s.avalia(`return new Date().toTimeString()+" | "+[...document.querySelectorAll('#app .card')].slice(0,3).map(c=>c.innerText.replace(/\\n/g," / ")).join(" ## ")`)); }
  for (const [nome, expr] of PASSOS) {
    try { if (expr) await s.avalia(expr); await espera(60); fotos.push([nome, JSON.parse(await s.avalia("return __snap()"))]); }
    catch (e) { fotos.push([nome, { falhou: e.message.split("\n")[0] }]); }
    if (nome === "lista inicial") { // toque longo no 1º card e arraste até o fim do 2º, com eventos reais de ponteiro
      const [x, y, y2] = await s.avalia(`document.querySelectorAll('.card-cad')[0].scrollIntoView({block:"start"}); await new Promise(r=>setTimeout(r,100)); const a=document.querySelectorAll('.card-cad'); const b0=a[0].getBoundingClientRect(), b1=a[1].getBoundingClientRect(); return [b0.x+40,b0.y+30,b1.y+b1.height-10]`);
      await s.c("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", buttons: 1, clickCount: 1 });
      await espera(500);
      for (let k = 1; k <= 6; k++) await s.c("Input.dispatchMouseEvent", { type: "mouseMoved", x, y: y + (y2 - y) * k / 6, button: "left", buttons: 1 });
      await s.c("Input.dispatchMouseEvent", { type: "mouseReleased", x, y: y2, button: "left", buttons: 0, clickCount: 1 });
      await espera(200);
      fotos.push(["arrastar card", JSON.parse(await s.avalia("return __snap()"))]);
    }
  }
  await cdp("Target.closeTarget", { targetId: s.targetId });
  return { fotos, erros: s.erros };
}

const NOVO = "http://127.0.0.1:8123/", ORIG = "http://127.0.0.1:8124/";
const o = await roteiro(ORIG), n = await roteiro(NOVO);
let difs = 0, falhas = 0;
for (let i = 0; i < o.fotos.length; i++) {
  const [nome, a] = o.fotos[i], [, b] = n.fotos[i];
  if (a.falhou || b.falhou) { falhas++; console.log(`PASSO FALHOU "${nome}": original=${a.falhou || "ok"} | novo=${b.falhou || "ok"}`); continue; }
  for (const k of Object.keys(a)) {
    // A normalização vale para os dois lados: assim o commit comparado pode ser de antes ou de depois da refatoração.
    const ajusta = v => semHora(["app", "topo", "sobreposicao"].includes(k) ? normaliza(v ?? "") : v) ?? "";
    const va = ajusta(a[k]), vb = ajusta(b[k]);
    if (va !== vb) { difs++; let j = 0; while (j < va.length && va[j] === vb[j]) j++;
      console.log(`DIFERENÇA "${nome}" [${k}] @${j}\n  original: …${va.slice(Math.max(0,j-80), j+120)}\n  novo:     …${vb.slice(Math.max(0,j-80), j+120)}`); }
  }
}
console.log(`\n${o.fotos.length} passos comparados com ${REF}: ${difs} diferença(s), ${falhas} passo(s) com falha.`);

const ftit = nome => n.fotos.find(f => f[0] === nome)[1];
const dImp = JSON.parse(ftit("confirma importação").dados);
console.log("cadeira importada do PDF:", JSON.stringify(dImp.cadeiras.find(c => c.codigo === "INF0123")).slice(0, 160) + "…");

// Avisos que já se sabe que aparecem e não indicam problema.
const ESPERADOS = [/apple-mobile-web-app-capable/, /Indexing all PDF objects/, /InvalidPDFException/ /* passo "PDF inválido" */];
const inesperados = l => l.filter(e => !ESPERADOS.some(r => r.test(e)));

// Passada com animações ligadas + service worker + modo offline, só na pasta do projeto.
let ok = 0, ruins = 0;
const confere = (cond, txt, extra = "") => { if (cond) { ok++; console.log("  ok    " + txt); } else { ruins++; console.log("  FALHA " + txt + (extra ? "  -> " + extra : "")); } };
console.log("\nConferências na pasta do projeto:");
confere(!inesperados(o.erros).length && !inesperados(n.erros).length, "sem erros inesperados no console (comparação)", JSON.stringify(inesperados([...o.erros, ...n.erros])));

// Cache ativo e lista de arquivos lidos do próprio sw.js (nada de nome fixo).
const swTexto = fs.readFileSync(path.join(RAIZ_PROJETO, "sw.js"), "utf8");
const CACHE = swTexto.match(/const CACHE = "([^"]+)"/)[1];
const ARQUIVOS = JSON.parse(swTexto.match(/const ARQUIVOS = (\[[\s\S]*?\]);/)[1]);
// Arquivos citados nos CSS (fontes): precisam estar em ARQUIVOS para ir ao cache já na instalação, não só depois de usados.
const doCSS = ["css/base.css", "css/componentes.css"].flatMap(css => [...fs.readFileSync(path.join(RAIZ_PROJETO, css), "utf8").matchAll(/url\(["']?([^"')]+)["']?\)/g)]
  .map(m => path.posix.normalize(path.posix.join(path.posix.dirname(css), m[1]))));
confere(doCSS.length > 0 && doCSS.every(a => ARQUIVOS.includes(a)), `os ${doCSS.length} arquivos citados nos CSS estão em ARQUIVOS do sw.js`, doCSS.filter(a => !ARQUIVOS.includes(a)).join(" "));

const s = await sessao(true);
await s.vai(NOVO + "index.html");
await s.avalia(`localStorage.setItem("ufcspa-faltas-notas-v1", ${JSON.stringify(JSON.stringify(semente))});`);
await s.vai(NOVO + "index.html");
for (const t of ["lista", "agenda", "grade", "sobre", "evento", "form", "lista"]) { await s.avalia(`ir('${t}')`); await espera(300); }
await s.avalia(`ir('detalhe','c1')`); await espera(300);
await s.avalia(`__val(document.querySelectorAll('.nota-bloco input')[1],"10"); __val(document.querySelectorAll('.nota-bloco input')[3],"10")`); await espera(1000);
confere(await s.avalia(`return !!document.querySelector('body > div canvas')`), "comemoração com confete");

await s.avalia(`await navigator.serviceWorker.ready; await new Promise(r=>setTimeout(r,1500));`);
await s.vai(NOVO + "index.html"); // recarrega para a página ficar sob controle do service worker
const sw = await s.avalia(`const r=await navigator.serviceWorker.ready;
  for(const u of ["tests/navegador/cdp.mjs","ferramentas/servidor.mjs","index.html"]) await fetch(u);
  await new Promise(r=>setTimeout(r,500));
  const ks=await caches.keys(), todos=[];
  for(const k of ks) for(const q of await (await caches.open(k)).keys()) todos.push(k+" "+new URL(q.url).pathname);
  return {ativo:!!r.active, controlada:!!navigator.serviceWorker.controller, caches:ks, todos}`);
const doCache = sw.todos.filter(x => x.startsWith(CACHE + " ")).map(x => x.slice(CACHE.length + 1));
const esperados = ARQUIVOS.map(a => "/" + a.replace(/^\.\//, ""));
confere(sw.ativo && sw.controlada, "service worker ativo e controlando a página");
confere(sw.caches.length === 1 && sw.caches[0] === CACHE, `só o cache ativo do sw.js (${CACHE})`, sw.caches.join(","));
confere(esperados.every(a => doCache.includes(a)), `os ${esperados.length} itens de ARQUIVOS estão no cache`, esperados.filter(a => !doCache.includes(a)).join(" "));
confere(!sw.todos.some(x => /\/(tests|ferramentas)\//.test(x)), "nada de tests/ nem ferramentas/ no cache", sw.todos.filter(x => /\/(tests|ferramentas)\//.test(x)).join(" "));
confere(!inesperados(s.erros).length, "sem erros inesperados no console (animações + SW, online)", inesperados(s.erros).join(" || "));

await s.c("Network.enable"); await s.c("Network.emulateNetworkConditions", { offline: true, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
s.erros.length = 0;
await s.vai(NOVO + "index.html"); await espera(500);
const off = await s.avalia(`const r={titulo:document.getElementById('titulo').textContent, cards:document.querySelectorAll('.card-cad').length};
  await document.fonts.ready; r.familia=getComputedStyle(document.body).fontFamily.split(",")[0].replace(/"/g,"");
  r.fonte=[...document.fonts].filter(f=>f.family.replace(/"/g,"")==="Lexend").map(f=>f.status);
  r.arquivoFonte=performance.getEntriesByType("resource").some(e=>e.name.endsWith("/fonts/lexend-latin.woff2"));
  __arquivo('#pdf-in','plano.pdf','application/pdf','${pdfB64}',true); ${esperaImport} r.pdfOffline=document.getElementById('titulo').textContent; return r`);
confere(off.titulo === "Minhas cadeiras" && off.cards > 0, "offline: o app abre do cache", JSON.stringify(off));
confere(off.pdfOffline === "Revisar importação", "offline: importa o plano de ensino em PDF", off.pdfOffline);
// Sem rede, a Lexend só carrega se vier do cache do service worker.
confere(off.familia === "Lexend" && off.fonte.includes("loaded") && off.arquivoFonte, "offline: a fonte Lexend carrega do cache", JSON.stringify({ familia: off.familia, fonte: off.fonte, arquivo: off.arquivoFonte }));
confere(!inesperados(s.erros).length, "sem erros inesperados no console (offline)", inesperados(s.erros).join(" || "));

console.log(`\nResultado: ${difs} diferença(s) e ${falhas} passo(s) com falha na comparação com ${REF}; ${ok} ok e ${ruins} falha(s) nas conferências.`);
ws.close(); proc.kill(); srvNovo.close(); srvOrig.close();
process.exit(difs || falhas || ruins ? 1 : 0);
