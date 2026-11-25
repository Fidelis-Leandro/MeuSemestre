// Roteiro no Chrome headless (tela de iPhone, 390 px): importação de planos com o cronograma em células coloridas.
// Confere a tela de revisão (data de cada avaliação e de onde veio, eventos e EAD), o que vai para a agenda,
// a reimportação na mesma cadeira (sem duplicar eventos e sem apagar notas), a escolha de turma e o plano B por texto.
// Os PDFs são gerados na hora por gerar-plano-teste.mjs (conteúdo inventado).
// Uso: node tests/navegador/plano-celulas.mjs   (sai com código 1 se alguma conferência falhar)
import fs from "node:fs"; import path from "node:path";
import { chrome, PASTA } from "./cdp.mjs";
import { servir } from "../../ferramentas/servidor.mjs";
import { PLANOS_CELULAS, paginasDoPlano, gerarPDFPaginas } from "./gerar-plano-teste.mjs";

const srv = await servir({ porta: 8781, host: "127.0.0.1" });
const b = await chrome("perfil-plano-celulas", 9351);
const erros = [];
b.ouvir(m => { if (m.method === "Runtime.exceptionThrown") erros.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text);
               if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error") erros.push(m.params.args.map(a => a.value || a.description).join(" ")); });
process.on("uncaughtException", e => { console.log("ERRO no roteiro: " + e.message + (erros.length ? "\nerros na página: " + erros.join(" || ") : "")); b.fechar(); srv.close(); process.exit(2); });
await b.send("Runtime.enable"); await b.send("Page.enable");
await b.send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
let ok = 0, falhas = 0;
const confere = (cond, txt, extra = "") => { if (cond) { ok++; console.log("  ok    " + txt); } else { falhas++; console.log("  FALHA " + txt + (extra ? "  -> " + JSON.stringify(extra) : "")); } };
const espera = ms => new Promise(r => setTimeout(r, ms));
const js = b.avaliar;
const titulo = () => js(`document.getElementById('titulo').textContent`);
const salvos = async () => JSON.parse(await js(`localStorage.getItem("ufcspa-faltas-notas-v1")`)) || { cadeiras: [], eventos: [] };
async function abrir(dados) {
  await b.send("Page.navigate", { url: "http://127.0.0.1:8781/index.html" }); await espera(700);
  await js(`localStorage.clear(); ${dados ? `localStorage.setItem("ufcspa-faltas-notas-v1", ${JSON.stringify(JSON.stringify(dados))});` : ""} true`);
  await b.send("Page.reload");
  for (let i = 0; i < 50 && !(await js(`!!document.querySelector('#app .card')`).catch(() => false)); i++) await espera(100);
  await espera(300);
}
const pdfDe = (v, inicio) => gerarPDFPaginas(paginasDoPlano(PLANOS_CELULAS[v](inicio))).toString("base64");
async function importar(b64, nome = "plano.pdf") {
  await js(`(async()=>{ const bytes=Uint8Array.from(atob("${b64}"),c=>c.charCodeAt(0)); const dt=new DataTransfer(); dt.items.add(new File([bytes],"${nome}",{type:"application/pdf"}));
    const i=document.getElementById('pdf-in'); i.files=dt.files; i.dispatchEvent(new Event("change",{bubbles:true}));
    for(let k=0;k<150&&document.getElementById('titulo').textContent!=="Revisar importação";k++) await new Promise(r=>setTimeout(r,100)); })()`);
}
const revisao = () => js(`(()=>{ const card=document.querySelectorAll('#app .card')[1];
  return { avals:[...card.querySelectorAll('.linha.entre')].map(l=>({nome:l.querySelector('span').firstChild.textContent.trim(), data:(l.querySelector('.meta')||{}).textContent||"", peso:l.querySelector('b').textContent})),
    opcoes:[...card.querySelectorAll('label')].filter(l=>l.querySelector('input[type=checkbox]')).map(l=>l.textContent.replace(/\\s+/g," ").trim()) }; })()`);
const adicionar = async () => { await js(`[...document.querySelectorAll('button')].find(b=>b.textContent.startsWith("Adicionar cadeiras")).click()`); await espera(300); };
const daCadeira = (d, cod) => { const c = d.cadeiras.find(x => x.codigo === cod); return { c, ev: c ? d.eventos.filter(e => e.cadeiraId === c.id) : [] }; };

/* ---------- 1. Revisão e importação ---------- */
console.log("\n[1] Plano com células coloridas: revisão e importação");
await abrir(null);
const pdfCel = pdfDe("celulas", new Date(2026, 7, 3));
await importar(pdfCel);
confere(await titulo() === "Revisar importação", "abre a revisão da importação", await titulo());
let r = await revisao();
confere(r.avals.map(a => a.nome).join(" | ") === "Questionários | Prova 1 | Seminário final | Prova 2 | Relatórios de leitura", "avaliações em ordem de data, com a prova sem número deduzida", r.avals.map(a => a.nome));
const dataDe = n => (r.avals.find(a => a.nome === n) || {}).data || "";
confere(/^24\/08 e mais 1 data · confira esta data/.test(dataDe("Questionários")) && /mais de uma avaliação/.test(dataDe("Questionários")), "texto ambíguo: confira esta data", dataDe("Questionários"));
confere(/^31\/08 · confira esta data/.test(dataDe("Prova 1")) && /ordem/.test(dataDe("Prova 1")), "por eliminação: confira esta data", dataDe("Prova 1"));
confere(dataDe("Seminário final") === "19/10 e mais 1 data · do cronograma", "várias datas: mostra a primeira e quantas mais", dataDe("Seminário final"));
confere(dataDe("Prova 2") === "16/11 · do cronograma", "pelo número: do cronograma", dataDe("Prova 2"));
confere(dataDe("Relatórios de leitura") === "sem data no plano", "sem data no plano", dataDe("Relatórios de leitura"));
confere(r.opcoes.some(o => o.includes("Usar as datas das avaliações do cronograma (Exame em 30/11)")), "opção das datas com o exame", r.opcoes);
confere(r.opcoes.some(o => o.startsWith("Adicionar 5 evento(s) à agenda") && o.includes("1 evento(s) do plano, 1 atividade(s) substitutiva(s), 2 outra(s) data(s) de avaliações, 1 avaliação(ões) sem nome para conferir")),
  "conta os eventos que vão para a agenda", r.opcoes);
confere(r.opcoes.some(o => o === "Adicionar 2 aula(s) EAD à agenda"), "conta as aulas EAD (só os dias inteiros a distância)", r.opcoes);
await adicionar();
let d = await salvos(), { c, ev } = daCadeira(d, "INF9101");
confere(await titulo() === "Minhas cadeiras" && c, "importa a cadeira");
confere(c && c.avaliacoes.map(a => a.nome + "=" + a.data).join(" ") === "Questionários=2026-08-24 Prova 1=2026-08-31 Seminário final=2026-10-19 Prova 2=2026-11-16 Relatórios de leitura=",
  "avaliações gravadas em ordem de data, cada uma com a primeira data", c && c.avaliacoes.map(a => a.nome + "=" + a.data));
const evTxt = l => l.map(e => `${e.data} ${e.tipo} ${e.obs}`).sort();
const esperados = ["2026-08-29 Aula EAD Aula a distância (Moodle)", "2026-09-14 Evento Semana Acadêmica do Curso", "2026-09-21 Outro Avaliação sem nome no plano (confira)",
  "2026-09-26 Atividade substitutiva Atividade de reposição no ambiente virtual", "2026-09-26 Aula EAD Aula a distância (Moodle)", "2026-09-28 Outro Questionários, 2ª data",
  "2026-10-26 Seminário Seminário final, 2ª data", "2026-11-30 Prova Exame"];
confere(JSON.stringify(evTxt(ev)) === JSON.stringify(esperados), "eventos na agenda: evento, substitutiva, sem nome, outras datas, EAD e exame", evTxt(ev));
await js(`ir('agenda')`); await espera(300);
const ag = await js(`document.getElementById('app').textContent`);
confere(/Atividade substitutiva/.test(ag) && /Semana Acadêmica do Curso/.test(ag) && /Avaliação sem nome no plano \(confira\)/.test(ag), "a agenda mostra eventos, substitutiva e a avaliação sem nome");

/* ---------- 2. Reimportação ---------- */
console.log("\n[2] Reimportar na mesma cadeira não duplica eventos nem apaga notas");
await js(`ir('lista')`); await espera(200);
await importar(pdfCel);
r = await revisao();
confere(r.avals.length === 5, "reimportação abre a revisão de novo");
await adicionar();
d = await salvos(); ({ c, ev } = daCadeira(d, "INF9101"));
confere(d.cadeiras.length === 1 && ev.length === esperados.length && JSON.stringify(evTxt(ev)) === JSON.stringify(esperados), "sem notas: mesma cadeira, eventos sem duplicar", { cadeiras: d.cadeiras.length, eventos: evTxt(ev) });
// Lança uma nota, apaga uma data e reimporta: a nota fica, a data volta, os eventos não duplicam.
const ids = c.avaliacoes.map(a => a.id);
c.avaliacoes.find(a => a.nome === "Prova 1").nota = 7.5;
c.avaliacoes.find(a => a.nome === "Prova 2").data = "";
await abrir(d);
await importar(pdfCel);
const aviso = await js(`document.querySelectorAll('#app .card')[1].textContent`);
confere(/Já cadastrada e com notas/.test(aviso), "revisão avisa que a cadeira já tem notas");
await adicionar();
d = await salvos(); ({ c, ev } = daCadeira(d, "INF9101"));
confere(c.avaliacoes.find(a => a.nome === "Prova 1").nota === 7.5, "com notas: a nota continua lá", c.avaliacoes.map(a => [a.nome, a.nota]));
confere(JSON.stringify(c.avaliacoes.map(a => a.id)) === JSON.stringify(ids), "com notas: as avaliações não são trocadas", c.avaliacoes.map(a => a.id));
confere(c.avaliacoes.find(a => a.nome === "Prova 2").data === "2026-11-16", "com notas: a data que faltava volta do cronograma", c.avaliacoes.find(a => a.nome === "Prova 2"));
confere(d.cadeiras.length === 1 && JSON.stringify(evTxt(ev)) === JSON.stringify(esperados), "com notas: eventos sem duplicar", evTxt(ev));

/* ---------- 3. Tela inicial ---------- */
console.log("\n[3] Avaliação sem nome fica fora das próximas avaliações da tela inicial");
const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
const inicio = new Date(hoje); inicio.setDate(inicio.getDate() - 33); // linha verde sem nome em 3 dias, prova em 17
await abrir(null);
await importar(pdfDe("celulas-sem-turma", inicio));
r = await revisao();
confere(r.avals.map(a => a.nome).join() === "Atividades práticas,Prova", "plano sem coluna Turma e com ano na data é lido", r.avals);
await adicionar();
const lista = await js(`document.getElementById('app').innerText`);
confere(/Próximas avaliações/.test(lista) && /Prova/.test(lista.split("Próximas avaliações")[1] || "") && !/sem nome/.test(lista), "próximas avaliações sem a linha verde sem nome", lista.slice(0, 400));
await js(`ir('agenda')`); await espera(300);
confere(/Avaliação sem nome no plano \(confira\)/.test(await js(`document.getElementById('app').innerText`)), "a linha verde sem nome está na agenda como evento");

/* ---------- 4. Duas turmas ---------- */
console.log("\n[4] Células com duas turmas: datas da turma escolhida");
await abrir(null);
await importar(pdfDe("celulas-duas-turmas", new Date(2026, 7, 3)));
r = await revisao();
confere(r.avals.every(a => a.data === ""), "sem turma escolhida, não mostra datas", r.avals);
await js(`(()=>{ const s=document.querySelector('[data-turma]'); s.value="B"; s.dispatchEvent(new Event("change",{bubbles:true})); })()`); await espera(200);
r = await revisao();
confere(r.avals.map(a => a.data.slice(0, 5)).join() === "27/08,24/09,26/09", "turma B: datas da turma B", r.avals);
await adicionar();
d = await salvos(); ({ c, ev } = daCadeira(d, "INF9103"));
confere(c && c.turma === "B" && c.avaliacoes.map(a => a.data).join() === "2026-08-27,2026-09-24,2026-09-26", "grava as datas da turma B", c && c.avaliacoes);
confere(evTxt(ev).join() === "2026-09-26 Aula EAD Aula a distância (Moodle),2026-10-01 Prova Exame", "exame da turma B e o sábado EAD", evTxt(ev));

/* ---------- 5. Plano B por texto ---------- */
console.log("\n[5] PDF sem células: continua importando pelo texto");
await abrir(null);
await importar(fs.readFileSync(path.join(PASTA, "plano-teste.pdf")).toString("base64"));
r = await revisao();
confere(r.avals.length === 3 && /^23\/03 · confira esta data/.test(r.avals[0].data) && /^06\/04 · confira esta data/.test(r.avals[1].data), "datas das provas pelo texto (por eliminação)", r.avals);

confere(erros.length === 0, "sem erros no console", erros);
console.log(`\nResultado: ${ok} ok, ${falhas} falha(s)`);
b.fechar(); srv.close();
process.exit(falhas ? 1 : 0);
