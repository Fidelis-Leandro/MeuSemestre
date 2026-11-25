// Gera PDFs sintéticos imitando planos de ensino, sem dados pessoais, para os testes.
// Uso: node tests/navegador/gerar-plano-teste.mjs <saida.pdf> [simples|duas-turmas|celulas|celulas-sem-turma|celulas-duas-turmas]
//   simples      (padrão) o plano-teste.pdf usado por refatoracao.mjs
//   duas-turmas  cronograma com turmas A (terça 18:20–21:40) e B (quinta 18:20–20:50), no formato em que o horário
//                vem quebrado em duas linhas ("18:20 -" antes da data e "21:40" depois) e a turma vem após o dia
//   celulas*     cronograma desenhado como tabela, com células coloridas pela legenda do sistema acadêmico
//                (verde = Avaliação, vermelho = Exame, azul = Atividade Substitutiva); ver PLANOS_CELULAS abaixo
import fs from "node:fs";

export const LINHAS = {
  simples: ["Plano de Ensino","Codigo da Disciplina: INF0123","Nome da Disciplina: Introducao a Programacao","Carga Horaria Total (horas): 60","ANO: 2026",
    "Dia(s) da Semana: Segunda (08:00 - 09:40) Quarta (13:30 - 15:10)","Criterios de Avaliacao","Prova - Primeira prova individual, de peso 40","Prova - Segunda prova individual, de peso 40","Trabalho - Projeto final em grupo, de peso 20","Bibliografia","CRONOGRAMA",
    "02/03 Segunda Aula expositiva 08:00 - 09:40","04/03 Quarta Aula pratica 13:30 - 15:10","09/03 Segunda Aula 08:00 - 09:40","11/03 Quarta Aula 13:30 - 15:10","16/03 Segunda Aula 08:00 - 09:40","18/03 Quarta Atividade no Moodle a distancia",
    "23/03 Segunda Prova 1 08:00 - 09:40","25/03 Quarta Aula 13:30 - 15:10","30/03 Segunda Aula 08:00 - 09:40","01/04 Quarta Aula 13:30 - 15:10","06/04 Segunda Prova 2 08:00 - 09:40","08/04 Quarta Exame 13:30 - 15:10","Data de Conclusao"],
  "duas-turmas": duasTurmas(),
};

function duasTurmas() {
  const L = ["Plano de Ensino", "Código da Disciplina: INF9001", "Nome da Disciplina: Programação de Teste com Turmas", "Enfoque: Obrigatória",
    "Dia(s) da Semana: Terça (18:20 - 21:40)", "Quinta (18:20 - 20:50)", "Carga Horária Total (horas): 60", "SEMESTRE LETIVO DO ANO: 2 ANO: 2026",
    "Situações e Critérios de Avaliação:", "Avaliação Escrita (Prova) - Prova 1, de peso 4", "Avaliação Escrita (Prova) - Prova 2, de peso 4",
    "Outros - Atividades de Aula, de peso 2", "Bibliografia Básica:", "Livro de exemplo.", "BLOCO V - CRONOGRAMA",
    "Data Dia da Horário Turma Conteúdo da Aula Aula Modalidade Categoria Local Professor", "Semana"];
  const dd = d => `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
  for (let s = 1; s <= 8; s++) {
    const terca = new Date(2026, 7, 4 + 7 * s), quinta = new Date(2026, 7, 6 + 7 * s);
    const tema = s === 4 ? "Prova 1." : s === 8 ? "Prova 2." : `Conteúdo da semana ${s}.`;
    L.push(`SEMANA ${s} - A${s}: Presencial.`, `18:20 - ${tema} Teórico- Laboratório`, `${dd(terca)} Terça A Presencial Regular`, "21:40 Prático Sala 1");
    L.push(`SEMANA ${s} - A${s}: Presencial.`, `18:20 - ${tema} Teórico- Laboratório`, `${dd(quinta)} Quinta B Presencial Regular`, "20:50 Prático Sala 2");
  }
  L.push("Data de Conclusão do Plano: 01/07/2026");
  return L;
}

// PDF mínimo: Helvetica com WinAnsiEncoding (acentos em latin1), 60 linhas por página.
export function gerarPDF(linhas) {
  const esc = l => l.replace(/[\\()]/g, c => "\\" + c);
  const paginas = []; for (let i = 0; i < linhas.length; i += 60) paginas.push(linhas.slice(i, i + 60));
  const objs = ["<< /Type /Catalog /Pages 2 0 R >>", null, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>"];
  const kids = [];
  paginas.forEach(p => {
    const conteudo = "BT /F1 10 Tf 40 800 Td 12.5 TL\n" + p.map(l => `(${esc(l)}) Tj T*`).join("\n") + "\nET";
    objs.push(`<< /Length ${Buffer.byteLength(conteudo, "latin1")} >>\nstream\n${conteudo}\nendstream`);
    objs.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents ${objs.length} 0 R /Resources << /Font << /F1 3 0 R >> >> >>`);
    kids.push(`${objs.length} 0 R`);
  });
  objs[1] = `<< /Type /Pages /Kids [${kids.join(" ")}] /Count ${kids.length} >>`;
  let s = "%PDF-1.4\n"; const off = [];
  objs.forEach((o, i) => { off.push(Buffer.byteLength(s, "latin1")); s += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const x = Buffer.byteLength(s, "latin1");
  s += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n` + off.map(o => String(o).padStart(10, "0") + " 00000 n \n").join("") + `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${x}\n%%EOF\n`;
  return Buffer.from(s, "latin1");
}

/* ---------- Planos com o cronograma em células coloridas ---------- */
// Conteúdo inventado (sem nomes reais nem texto copiado de planos). Cada plano é uma função de "inicio" (a primeira
// segunda-feira), para os roteiros poderem gerar datas perto de hoje. Cada linha do cronograma:
// {d: dias depois do início, ini, fim, turma, conteudo, modalidade, categoria, local, cor: "verde"|"vermelho"|"azul"|null}.
const COR_RGB = { verde: [0xe8, 0xf5, 0xe9], vermelho: [0xff, 0xeb, 0xee], azul: [0xe3, 0xf2, 0xfd], branco: [255, 255, 255] };
const DIAS_JS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
const P = "Presencial", D = "Ensino à Distância", R = "Regular";

export const PLANOS_CELULAS = {
  // Turma "A, B" em todas as linhas, datas sem ano, mesma data em duas linhas (presencial + EAD), prova sem número,
  // seminário em duas datas, questionários (um deles ambíguo), evento, verde sem nome, substitutiva e exame "Presencia l".
  celulas: (inicio = new Date(2026, 7, 3)) => ({
    codigo: "INF9101", nome: "Disciplina Sintética com Células", ano: inicio.getFullYear(), comAno: false,
    dias: ["Segunda (14:00 - 17:20)", "Sábado (09:00 - 12:20)"],
    criterios: ["Avaliação Escrita (Prova) - Prova 2, de peso 30", "Avaliação Escrita (Prova) - Prova , de peso 30", "Trabalho - Seminário final, de peso 20",
      "Outros - Questionários, de peso 10", "Outros - Relatórios de leitura, de peso 10"],
    inicio, turmaColuna: true,
    linhas: [
      { d: 0, conteudo: "Apresentação da disciplina e do plano de ensino." },
      { d: 7, conteudo: "Conceitos iniciais do conteúdo." },
      { d: 14, fim: "16:30", conteudo: "Exercícios em sala." },
      { d: 14, ini: "16:30", fim: "17:20", conteudo: "Leituras no ambiente virtual.", modalidade: D, local: "Sala 101" },
      { d: 21, conteudo: "Questionário 1.", cor: "verde" },
      { d: 26, ini: "09:00", fim: "12:20", conteudo: "Estudo dirigido.", modalidade: D, categoria: "Trabalho Efetivo Discente (TED)", local: "Ambiente Moodle" },
      { d: 28, conteudo: "Prova 1.", cor: "verde" },
      { d: 42, conteudo: "Semana Acadêmica do Curso.", local: "Auditório" },
      { d: 49, conteudo: "Estudo de caso em laboratório.", cor: "verde", local: "Laboratório 2" },
      { d: 54, ini: "09:00", fim: "12:20", conteudo: "Atividade de reposição no ambiente virtual.", modalidade: D, local: "Ambiente Moodle", cor: "azul" },
      { d: 56, conteudo: "Questionário 2 e trabalho prático em grupo.", cor: "verde" },
      { d: 63, conteudo: "Preparação dos seminários." },
      { d: 77, conteudo: "Apresentação dos seminários.", cor: "verde" },
      { d: 84, conteudo: "Apresentação dos seminários.", cor: "verde" },
      { d: 98, conteudo: "Revisão para a prova." },
      { d: 105, conteudo: "Prova 2.", cor: "verde" },
      { d: 112, conteudo: "Correção da prova e orientações para o exame." },
      { d: 119, conteudo: "Exame.", cor: "vermelho" },
    ].map(l => ({ ini: "14:00", fim: "17:20", turma: "A, B", modalidade: P, categoria: R, local: "Sala 101", ...l })),
  }),
  // Sem coluna Turma ("Turma(s): A" acima da tabela) e datas com ano de dois dígitos, como em alguns planos.
  "celulas-sem-turma": (inicio = new Date(2026, 7, 3)) => ({
    codigo: "INF9102", nome: "Disciplina Sintética sem Turma", ano: inicio.getFullYear(), comAno: true,
    dias: ["Terça (18:20 - 20:50)"], criterios: ["Avaliação Escrita (Prova) - Prova, de peso 50", "Trabalho - Atividades práticas, de peso 50"],
    inicio, turmaColuna: false, turmaTexto: "Turma(s): A",
    linhas: [
      { d: 1, conteudo: "Apresentação da disciplina." }, { d: 8, conteudo: "Fundamentos." },
      { d: 15, conteudo: "Atividade prática 1.", cor: "verde" }, { d: 22, conteudo: "Leitura orientada.", modalidade: D, local: "Ambiente Moodle" },
      { d: 29, conteudo: "Mostra de trabalhos do curso." }, { d: 36, conteudo: "Discussão em grupos.", cor: "verde" },
      { d: 43, conteudo: "Atividade prática 2.", cor: "verde" }, { d: 50, conteudo: "Prova escrita.", cor: "verde" },
      { d: 57, conteudo: "Exame.", cor: "vermelho" },
    ].map(l => ({ ini: "18:20", fim: "20:50", modalidade: P, categoria: R, local: "Sala 202", ...l })),
  }),
  // Turmas A (terça) e B (quinta) em linhas separadas, com laboratórios diferentes e uma atividade EAD no sábado.
  "celulas-duas-turmas": (inicio = new Date(2026, 7, 3)) => {
    const linhas = [];
    const sem = (s, txt, cor) => { linhas.push({ d: 7 * s + 1, turma: "A", conteudo: txt, cor, local: "Laboratório 1" }, { d: 7 * s + 3, turma: "B", conteudo: txt, cor, local: "Laboratório 2" }); };
    for (let s = 0; s < 8; s++) sem(s, s === 3 ? "Prova 1." : s === 7 ? "Prova 2." : `Conteúdo da semana ${s + 1}.`, s === 3 || s === 7 ? "verde" : null);
    linhas.push({ d: 54, turma: "A", ini: "13:20", fim: "16:40", conteudo: "Atividade Prática I no ambiente virtual.", modalidade: D, local: "Ambiente Moodle", cor: "verde" },
      { d: 54, turma: "B", ini: "13:20", fim: "16:40", conteudo: "Atividade Prática I no ambiente virtual.", modalidade: D, local: "Ambiente Moodle", cor: "verde" });
    sem(8, "Exame.", "vermelho");
    return { codigo: "INF9103", nome: "Disciplina Sintética com Duas Turmas", ano: inicio.getFullYear(), comAno: false,
      dias: ["Terça (18:20 - 21:40)", "Quinta (18:20 - 21:40)", "Sábado (13:20 - 16:40)"],
      criterios: ["Avaliação Escrita (Prova) - Prova 1, de peso 4", "Avaliação Escrita (Prova) - Prova 2, de peso 4", "Outros - Atividades de Aula, de peso 2"],
      inicio, turmaColuna: true,
      linhas: linhas.sort((a, b) => a.d - b.d).map(l => ({ ini: "18:20", fim: "21:40", modalidade: P, categoria: R, ...l })) };
  },
};

// Páginas do plano como desenho: [{textos:[{s,x,y}], rets:[{x0,y0,x1,y1,cor,contorno}]}], no mesmo formato que
// lerPDF() extrai do PDF (cor null = só contorno). gerarPDFPaginas() transforma isso em PDF.
export function paginasDoPlano(pl) {
  const L = 842, A = 595, paginas = [];
  const nova = () => { const p = { textos: [], rets: [] }; paginas.push(p); p.textos.push({ s: "Plano de Ensino", x: 40, y: A - 30 }, { s: "PROGRAD/PROPPGI", x: 40, y: A - 42 }); return p; };
  // Página 1: identificação e critérios (texto corrido).
  let p = nova(), y = A - 70;
  const linha = s => { if (y < 50) { p = nova(); y = A - 70; } p.textos.push({ s, x: 40, y }); y -= 13; };
  [`SEMESTRE LETIVO DO ANO: 2 ANO: ${pl.ano}`, `Código da Disciplina: ${pl.codigo}`, `Nome da Disciplina: ${pl.nome}`, `Dia(s) da Semana: ${pl.dias[0]}`, ...pl.dias.slice(1),
    "Carga Horária Total (horas): 60", "Situações e Critérios de Avaliação:", ...pl.criterios, "Bibliografia Básica:", "Livro de exemplo, sem autor real."].forEach(linha);
  // Cronograma.
  p = nova(); y = A - 70;
  p.textos.push({ s: "BLOCO V - CRONOGRAMA", x: 40, y }); y -= 14;
  p.textos.push({ s: "Cronograma de Atividades para DISCIPLINAS", x: 40, y }); y -= 26;
  [["Atividade Substitutiva", "azul", 43, 184], ["Exame", "vermelho", 184, 326], ["Avaliação", "verde", 326, 468]].forEach(([s, c, x0, x1]) => {
    p.rets.push({ x0, y0: y - 6, x1, y1: y + 14, cor: c }); p.textos.push({ s, x: x0 + 20, y });
  });
  y -= 22;
  if (pl.turmaTexto) { p.textos.push({ s: pl.turmaTexto, x: 43, y }); y -= 14; }
  const xs = pl.turmaColuna ? [43, 99, 156, 204, 247, 388, 445, 502, 558, 700, 800] : [43, 99, 156, 204, 360, 420, 480, 540, 680, 800];
  const cab = pl.turmaColuna ? ["Data", "Dia da|Semana", "Horário", "Turma", "Conteúdo da Aula", "Aula", "Modalida|de", "Categoria", "Local", "Professor"]
    : ["Data", "Dia da|Semana", "Horário", "Conteúdo da Aula", "Aula", "Modalida|de", "Categoria", "Local", "Professor"];
  const fila = (celulas, cor, alt) => {
    if (y - alt < 40) { p = nova(); y = A - 60; }
    celulas.forEach((linhasCel, i) => {
      const x0 = xs[i], x1 = xs[i + 1];
      p.rets.push({ x0, y0: y - alt, x1, y1: y, cor, contorno: true });
      const meio = y - alt / 2, n = linhasCel.length;
      linhasCel.forEach((s, k) => p.textos.push({ s, x: x0 + 4, y: meio + (n - 1) * 4.5 - k * 9 - 2 }));
    });
    y -= alt;
  };
  fila(cab.map(c => c.split("|")), null, 40);
  const quebra = (s, n) => { const out = []; let l = ""; s.split(" ").forEach(w => { if ((l + " " + w).trim().length > n) { out.push(l); l = w; } else l = (l + " " + w).trim(); }); if (l) out.push(l); return out; };
  for (const r of pl.linhas) {
    const dt = new Date(pl.inicio); dt.setDate(dt.getDate() + r.d);
    const dd = `${String(dt.getDate()).padStart(2, "0")}/${String(dt.getMonth() + 1).padStart(2, "0")}${pl.comAno ? "/" + String(dt.getFullYear()).slice(2) : ""}`;
    const exame = r.cor === "vermelho";
    const cel = [[dd], [DIAS_JS[dt.getDay()]], [r.ini + " -", r.fim], ...(pl.turmaColuna ? [[r.turma]] : []), quebra(r.conteudo, pl.turmaColuna ? 26 : 22),
      ["Teórico"], exame ? ["Presencia", "l"] : quebra(r.modalidade, 10), quebra(r.categoria, 10), quebra(r.local, 22), ["PROFESSOR EXEMPLO"]];
    fila(cel, r.cor || "branco", Math.max(28, Math.max(...cel.map(c => c.length)) * 9 + 10));
  }
  y -= 16; if (y < 40) { p = nova(); y = A - 60; }
  p.textos.push({ s: "Data de Conclusão: 01/07/" + pl.ano, x: 40, y });
  paginas.forEach((pg, i) => pg.textos.push({ s: `${i + 1} / ${paginas.length}`, x: L / 2, y: 20 }));
  return paginas;
}
// Como lerPDF() enxerga essas páginas: cor em hexadecimal, ou null para retângulo só com contorno.
export function paginasComoLidas(paginas) {
  const hex = c => c ? "#" + COR_RGB[c].map(v => v.toString(16).padStart(2, "0")).join("") : null;
  return paginas.map(p => ({ textos: p.textos, rets: p.rets.map(r => ({ x0: r.x0, y0: r.y0, x1: r.x1, y1: r.y1, cor: hex(r.cor) })) }));
}
// PDF em paisagem a partir das páginas: retângulos preenchidos com contorno (re B), só contorno (re S) e texto Helvetica 7.
export function gerarPDFPaginas(paginas) {
  const esc = l => l.replace(/[\\()]/g, c => "\\" + c);
  const objs = ["<< /Type /Catalog /Pages 2 0 R >>", null, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>"];
  const kids = [];
  paginas.forEach(p => {
    const ops = ["0.57 w 0 0 0 RG"];
    p.rets.forEach(r => { const re = `${r.x0} ${r.y0} ${r.x1 - r.x0} ${r.y1 - r.y0} re`;
      ops.push(r.cor ? `${COR_RGB[r.cor].map(v => (v / 255).toFixed(4)).join(" ")} rg ${re} ${r.contorno ? "B" : "f"}` : `${re} S`); });
    ops.push("0 0 0 rg");
    p.textos.forEach(t => ops.push(`BT /F1 7 Tf 1 0 0 1 ${t.x.toFixed(2)} ${t.y.toFixed(2)} Tm (${esc(t.s)}) Tj ET`));
    const conteudo = ops.join("\n");
    objs.push(`<< /Length ${Buffer.byteLength(conteudo, "latin1")} >>\nstream\n${conteudo}\nendstream`);
    objs.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 842 595] /Contents ${objs.length} 0 R /Resources << /Font << /F1 3 0 R >> >> >>`);
    kids.push(`${objs.length} 0 R`);
  });
  objs[1] = `<< /Type /Pages /Kids [${kids.join(" ")}] /Count ${kids.length} >>`;
  let s = "%PDF-1.4\n"; const off = [];
  objs.forEach((o, i) => { off.push(Buffer.byteLength(s, "latin1")); s += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const x = Buffer.byteLength(s, "latin1");
  s += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n` + off.map(o => String(o).padStart(10, "0") + " 00000 n \n").join("") + `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${x}\n%%EOF\n`;
  return Buffer.from(s, "latin1");
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, "/").split("/").pop())) {
  const [, , saida, variante = "simples"] = process.argv;
  if (!saida || !(LINHAS[variante] || PLANOS_CELULAS[variante])) { console.error("Uso: node gerar-plano-teste.mjs <saida.pdf> [" + [...Object.keys(LINHAS), ...Object.keys(PLANOS_CELULAS)].join("|") + "]"); process.exit(1); }
  if (LINHAS[variante]) { fs.writeFileSync(saida, gerarPDF(LINHAS[variante])); console.log(`${saida}: ${LINHAS[variante].length} linhas (${variante})`); }
  else { const pg = paginasDoPlano(PLANOS_CELULAS[variante]()); fs.writeFileSync(saida, gerarPDFPaginas(pg)); console.log(`${saida}: ${pg.length} páginas (${variante})`); }
}
