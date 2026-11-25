// Roteiro no Chrome headless (tela de iPhone, 390 px): importação de plano com duas turmas, grade com aulas
// sobrepostas e proteções contra zoom no iPhone (touch-action e fonte mínima de 16px nos campos).
// Uso: node tests/navegador/turmas-e-grade.mjs   (sai com código 1 se alguma conferência falhar)
import fs from "node:fs"; import path from "node:path";
import { chrome, PASTA } from "./cdp.mjs";
import { servir } from "../../ferramentas/servidor.mjs";

const srv = await servir({ porta: 8767, host: "127.0.0.1" });
const b = await chrome("perfil-turmas-e-grade", 9337);
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
const salvos = async () => JSON.parse(await js(`localStorage.getItem("ufcspa-faltas-notas-v1")`));
async function abrir(dados) {
  await b.send("Page.navigate", { url: "http://127.0.0.1:8767/index.html" }); await espera(700);
  await js(`localStorage.clear(); ${dados ? `localStorage.setItem("ufcspa-faltas-notas-v1", ${JSON.stringify(JSON.stringify(dados))});` : ""} true`);
  await b.send("Page.reload");
  for (let i = 0; i < 50 && !(await js(`!!document.querySelector('#app .card')`).catch(() => false)); i++) await espera(100);
  await espera(300);
}

/* ---------- 1. Importação com duas turmas ---------- */
console.log("\n[1] Plano com duas turmas: a turma precisa ser escolhida antes de importar");
await abrir(null);
const pdf = fs.readFileSync(path.join(PASTA, "plano-duas-turmas.pdf")).toString("base64");
await js(`(async()=>{ const bytes=Uint8Array.from(atob("${pdf}"),c=>c.charCodeAt(0)); const dt=new DataTransfer(); dt.items.add(new File([bytes],"plano.pdf",{type:"application/pdf"}));
  const i=document.getElementById('pdf-in'); i.files=dt.files; i.dispatchEvent(new Event("change",{bubbles:true}));
  for(let k=0;k<150&&document.getElementById('titulo').textContent!=="Revisar importação";k++) await new Promise(r=>setTimeout(r,100)); })()`);
confere(await titulo() === "Revisar importação", "abre a revisão da importação", await titulo());
let sel = await js(`(()=>{ const s=document.querySelector('[data-turma]'); return s && {valor:s.value, opcoes:[...s.options].map(o=>o.textContent), texto:document.querySelector('#app .card:nth-of-type(2) .meta').textContent}; })()`);
confere(sel && sel.valor === "" && sel.opcoes.join() === "Escolha sua turma,A,B", "seletor de turma sem nenhuma turma escolhida", sel);
confere(sel && /Escolha a turma/.test(sel.texto) && !/18:20/.test(sel.texto), "sem turma, não mostra horários misturados", sel && sel.texto);
await js(`[...document.querySelectorAll('button')].find(b=>b.textContent.startsWith("Adicionar cadeiras")).click()`); await espera(200);
const bloqueio = await js(`({titulo:document.getElementById('titulo').textContent, aviso:!![...document.querySelectorAll('.aviso')].find(a=>a.textContent.includes("Escolha a sua")), foco:document.activeElement?.dataset?.turma})`);
confere(bloqueio.titulo === "Revisar importação" && bloqueio.aviso && bloqueio.foco === "0", "sem turma, não importa: avisa e leva ao seletor", bloqueio);
confere(((await salvos())?.cadeiras || []).length === 0, "nada foi salvo antes da escolha");
await js(`(()=>{ const s=document.querySelector('[data-turma]'); if(!s) return; s.value="B"; s.dispatchEvent(new Event("change",{bubbles:true})); })()`); await espera(200);
const comB = await js(`document.querySelector('#app .card:nth-of-type(2) .meta')?.textContent || ""`);
confere(comB.includes("Quinta 18:20–20:50") && !comB.includes("Terça"), "turma B: mostra só o horário da turma B", comB);
await js(`[...document.querySelectorAll('button')].find(b=>b.textContent.startsWith("Adicionar cadeiras"))?.click()`); await espera(300);
const cad = ((await salvos())?.cadeiras || []).find(c => c.codigo === "INF9001");
confere(await titulo() === "Minhas cadeiras" && cad, "importa depois da escolha");
confere(cad && cad.turma === "B" && JSON.stringify(cad.aulas) === JSON.stringify([{ dia: "Quinta", ini: "18:20", fim: "20:50", periodos: 3 }]), "cadeira só com a aula da turma B", cad && { turma: cad.turma, aulas: cad.aulas });
confere(cad && cad.avaliacoes.map(a => a.data).join() === "2026-09-03,2026-10-01,", "datas de prova da turma B", cad && cad.avaliacoes.map(a => a.data));

/* ---------- 2. Grade com aulas sobrepostas ---------- */
console.log("\n[2] Grade: aulas sobrepostas lado a lado, sem texto encavalado");
const av = [{ id: "x", nome: "P", peso: 100, nota: null, data: "" }];
const grade2 = { cadeiras: [
  { id: "p1", nome: "Programação Orientada a Objetos I", ch: 60, faltas: 0, exame: null, periodosDia: 4, avaliacoes: av,
    aulas: [{ dia: "Terça", ini: "18:20", fim: "21:40", periodos: 4 }, { dia: "Terça", ini: "18:20", fim: "20:50", periodos: 3 }] },
  { id: "e1", nome: "Introdução à Epidemiologia", ch: 60, faltas: 0, exame: null, periodosDia: 2, avaliacoes: av,
    aulas: [{ dia: "Terça", ini: "19:10", fim: "20:00", periodos: 1 }, { dia: "Quarta", ini: "08:00", fim: "09:40", periodos: 2 }] },
  { id: "g1", nome: "Genética e Evolução", ch: 60, faltas: 0, exame: null, periodosDia: 2, avaliacoes: av,
    aulas: [{ dia: "Quarta", ini: "09:40", fim: "11:20", periodos: 2 }] } ], eventos: [], criadoEm: new Date().toISOString(), ultimoBackup: new Date().toISOString() };
await abrir(grade2);
await js(`ir('grade')`); await espera(500);
const blocos = await js(`[...document.querySelectorAll('#app [onclick^="ir(\\'detalhe\\'"]')].map(e=>{ const r=e.getBoundingClientRect();
  const textos=[...e.querySelectorAll('div')].filter(d=>d.offsetWidth>0).map(d=>{ const t=d.getBoundingClientRect(); return {l:t.left,r:t.right,larg:d.scrollWidth,vis:d.clientWidth}; });
  return {txt:e.innerText.replace(/\\n/g," "), ini:e.dataset.ini, l:r.left, r:r.right, t:r.top, b:r.bottom, faixa:e.dataset.faixa||"", textos}; })`);
// Pelo horário de início (data-ini): em bloco baixo o horário pode não aparecer no texto.
const terca = blocos.filter(x => x.ini === "18:20" || x.ini === "19:10");
const cruzam = (x, y) => Math.min(x.r, y.r) - Math.max(x.l, y.l) > 0.5 && Math.min(x.b, y.b) - Math.max(x.t, y.t) > 0.5;
const pares = []; for (let i = 0; i < blocos.length; i++) for (let j = i + 1; j < blocos.length; j++) if (cruzam(blocos[i], blocos[j])) pares.push([blocos[i].txt, blocos[j].txt]);
confere(terca.length === 3 && terca.every(x => /\/3$/.test(x.faixa)), "as três aulas de terça dividem a coluna em 3 faixas", terca.map(x => x.faixa));
confere(pares.length === 0, "nenhum bloco desenhado por cima de outro", pares);
confere(blocos.every(x => x.textos.every(t => t.l >= x.l - 0.5 && t.r <= x.r + 0.5 && t.larg <= t.vis + 1)), "o texto de cada bloco fica dentro do bloco", blocos.map(x => [x.txt.slice(0, 20), x.r - x.l]));
const quarta = blocos.filter(x => !terca.includes(x));
confere(quarta.length === 2 && quarta.every(x => !x.faixa) && Math.abs((quarta[0].r - quarta[0].l) - (quarta[1].r - quarta[1].l)) < 0.5, "aulas seguidas sem sobreposição ocupam a coluna inteira", quarta.map(x => [x.faixa, x.r - x.l]));
// Captura para conferir a olho: tests/navegador/tmp/grade-sobreposta.png
const foto = await b.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true, clip: await js(`(()=>{ const r=document.querySelector('#app .card[style*="overflow-x"]').getBoundingClientRect(); return {x:0,y:r.top+scrollY,width:innerWidth,height:r.height,scale:2}; })()`) });
fs.mkdirSync(path.join(PASTA, "tmp"), { recursive: true }); fs.writeFileSync(path.join(PASTA, "tmp", "grade-sobreposta.png"), Buffer.from(foto.data, "base64"));
// Compara com clientWidth: em tela de celular, se algo passa da largura, o Chrome alarga a página e innerWidth acompanha.
const rola = await js(`(()=>{ const c=document.querySelector('#app .card[style*="overflow-x"]'); return {rolavel:c.scrollWidth>c.clientWidth, pagina:document.documentElement.scrollWidth<=document.documentElement.clientWidth}; })()`);
confere(rola.pagina, "a página não ganha rolagem horizontal (só o card da grade, se precisar)", rola);

// Nome e horário de cada bloco: o nome é um dos candidatos de nomesCurtos(), cada palavra fica numa linha só
// (medido com Range: se uma palavra quebra, ela tem retângulos em alturas diferentes), e nada fica cortado no bloco.
const NOMES_GRADE = `(()=>{ const prob=[], vistos=[];
  document.querySelectorAll('#app [data-nomes]').forEach(b=>{ const nome=b.querySelector('.g-nome'), hora=b.querySelector('.g-hora'), tx=nome.textContent;
    vistos.push(tx+(hora.hidden?"":" ["+hora.textContent+"]"));
    if(!JSON.parse(b.dataset.nomes).includes(tx)) prob.push('nome fora dos candidatos: '+tx);
    const no=nome.firstChild; let i=0;
    if(no) for(const w of tx.split(' ')){ const r=document.createRange(); r.setStart(no,i); r.setEnd(no,i+w.length);
      if(new Set([...r.getClientRects()].filter(q=>q.width>0).map(q=>Math.round(q.top))).size>1) prob.push('palavra partida: "'+w+'" em "'+tx+'"'); i+=w.length+1; }
    const bb=b.getBoundingClientRect(), s=getComputedStyle(b), fundo=bb.bottom-parseFloat(s.paddingBottom)+0.5, dir=bb.right-parseFloat(s.paddingRight)+0.5;
    if(nome.getBoundingClientRect().bottom>fundo||nome.scrollWidth>nome.clientWidth+1) prob.push('nome cortado: '+tx);
    if(!hora.hidden){ const rh=hora.getBoundingClientRect(); if(rh.bottom>fundo||rh.right>dir||hora.scrollWidth>hora.clientWidth+1) prob.push('horário cortado: '+tx+' '+hora.textContent); }
  }); return {prob, vistos}; })()`;
let ng = await js(NOMES_GRADE);
confere(ng.prob.length === 0, "nenhuma palavra do nome partida e nada cortado nos blocos", ng);

/* ---------- 2b. Nomes longos reais, aulas de 50 min, 1h40 e 3h20, temas claro e escuro ---------- */
console.log("\n[2b] Grade com nomes longos: nome curto inteiro, horário que cabe, nos dois temas");
const longos = { cadeiras: [
  { id: "ia", nome: "Introdução à Inteligência Artificial na Área da Saúde", ch: 60, faltas: 0, exame: null, periodosDia: 2, avaliacoes: av,
    aulas: [{ dia: "Segunda", ini: "08:00", fim: "08:50", periodos: 1 }, { dia: "Quinta", ini: "15:00", fim: "16:40", periodos: 2 }, { dia: "Sexta", ini: "13:30", fim: "16:50", periodos: 4 }] },
  { id: "an", nome: "Anatomia Humana", ch: 60, faltas: 0, exame: null, periodosDia: 2, avaliacoes: av,
    aulas: [{ dia: "Segunda", ini: "13:30", fim: "15:10", periodos: 2 }, { dia: "Quarta", ini: "08:00", fim: "08:50", periodos: 1 }] },
  { id: "au", nome: "Autômatos, Computabilidade e Complexidade", ch: 60, faltas: 0, exame: null, periodosDia: 3, avaliacoes: av,
    aulas: [{ dia: "Quarta", ini: "15:00", fim: "17:30", periodos: 3 }, { dia: "Quarta", ini: "15:00", fim: "15:50", periodos: 1 }] },
  { id: "po", nome: "Programação Orientada a Objetos I", ch: 60, faltas: 0, exame: null, periodosDia: 4, avaliacoes: av, aulas: [{ dia: "Terça", ini: "18:20", fim: "21:40", periodos: 4 }] },
  { id: "bd", nome: "Banco de Dados", ch: 45, faltas: 0, exame: null, periodosDia: 1, avaliacoes: av, aulas: [{ dia: "Terça", ini: "19:10", fim: "20:00", periodos: 1 }] } ],
  eventos: [], criadoEm: new Date().toISOString(), ultimoBackup: new Date().toISOString() };
for (const tema of ["claro", "escuro"]) {
  await abrir(longos);
  await js(`localStorage.setItem("meusemestre-tema","${tema}"); true`); await b.send("Page.reload"); await espera(900);
  await js(`document.fonts.ready.then(()=>{ ir('grade'); return true; })`); await espera(500);
  ng = await js(NOMES_GRADE);
  const lexend = await js(`document.fonts.check("800 16px Lexend") && getComputedStyle(document.querySelector('.g-nome')).fontFamily.startsWith("Lexend")`);
  confere(lexend && ng.vistos.length === 9, `${tema}: grade com a Lexend e os 9 blocos`, { lexend, vistos: ng.vistos });
  confere(ng.prob.length === 0, `${tema}: nenhuma palavra partida e nada cortado (${ng.vistos.join(" · ")})`, ng.prob);
  const f = await b.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true, clip: await js(`(()=>{ const r=document.querySelector('#app .card[style*="overflow-x"]').getBoundingClientRect(); return {x:0,y:r.top+scrollY,width:innerWidth,height:r.height,scale:2}; })()`) });
  fs.writeFileSync(path.join(PASTA, "tmp", `grade-nomes-${tema}.png`), Buffer.from(f.data, "base64"));
}
await abrir(grade2); // a parte 3 usa as cadeiras da parte 2

/* ---------- 3. Zoom no iPhone ---------- */
console.log("\n[3] iPhone: sem zoom de dois toques e sem zoom ao focar campos");
const vp = await js(`document.querySelector('meta[name=viewport]').content`);
confere(!/user-scalable\s*=\s*no|maximum-scale/.test(vp), "viewport continua permitindo zoom de pinça", vp);
const ta = await js(`["html","body","button","a","input","select","label","[onclick]"].map(s=>{ const e=document.querySelector(s); return e?s+"="+getComputedStyle(e).touchAction:s+"=?"; })`);
confere(ta.every(x => x.endsWith("=manipulation") || x.endsWith("=?")), "touch-action: manipulation em html, body e clicáveis", ta);
const pequenos = [];
for (const [tela, prep] of [["form nova", `ir('form')`], ["form editar", `ir('form','p1')`], ["detalhe", `ir('detalhe','p1')`], ["evento", `ir('evento')`], ["grade", `ir('grade')`], ["lista", `ir('lista')`]]) {
  await js(prep); await espera(250);
  if (tela === "form nova") await js(`addAulaForm(); addSub(0); true`);
  const r = await js(`[...document.querySelectorAll('#app input, #app select, #app textarea')].filter(e=>!["checkbox","radio","file","hidden"].includes(e.type)).map(e=>({t:e.type,id:e.id,px:parseFloat(getComputedStyle(e).fontSize)}))`);
  r.filter(x => x.px < 16).forEach(x => pequenos.push(tela + ": " + x.t + "#" + x.id + " " + x.px + "px"));
}
confere(pequenos.length === 0, "todos os campos de texto, número, data e hora com fonte de 16px ou mais", pequenos);

confere(erros.length === 0, "sem erros no console", erros);
console.log(`\nResultado: ${ok} ok, ${falhas} falha(s)`);
b.fechar(); srv.close();
process.exit(falhas ? 1 : 0);
