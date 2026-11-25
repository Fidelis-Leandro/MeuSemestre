// Testes da leitura do cronograma por células, dos tipos de linha e da ligação avaliação → data. Rode com:  node --test
// Usa os planos sintéticos de tests/navegador/gerar-plano-teste.mjs (conteúdo inventado, sem dados pessoais), já como
// "páginas lidas" ({textos, rets}), no mesmo formato que lerPDF() extrai do PDF no navegador.
import { test } from "node:test";
import assert from "node:assert/strict";
import { lerPlano, datasDoPlano, aulasDoPlano, linhasDaTabela, linhasDosTextos, tipoDaLinha, tipoDaAval, numeroDe, ordemDasAvaliacoes } from "../js/plano-ensino.js";
import { PLANOS_CELULAS, paginasDoPlano, paginasComoLidas } from "./navegador/gerar-plano-teste.mjs";

const lido = (v, alterar) => {
  const pl = PLANOS_CELULAS[v](); if (alterar) alterar(pl);
  const pg = paginasComoLidas(paginasDoPlano(pl));
  return { linhas: pg.flatMap(p => linhasDosTextos(p.textos)), tabela: linhasDaTabela(pg) };
};
const plano = (v, alterar) => { const { linhas, tabela } = lido(v, alterar); return lerPlano(linhas, tabela); };
const resumo = (p, d) => ordemDasAvaliacoes(p, d).map(i => [p.avaliacoes[i].nome, d.avals[i].datas, d.avals[i].origem]);

/* ---------- Tabela por células ---------- */
test("células: uma linha por data, com as colunas do cabeçalho e a cor da legenda", () => {
  const { tabela } = lido("celulas");
  assert.equal(tabela.length, 18);
  assert.deepEqual(tabela[0], { data: "03/08", dia: "Segunda", horario: "14:00 - 17:20", turma: "A, B", conteudo: "Apresentação da disciplina e do plano de ensino.",
    aula: "Teórico", modalidade: "Presencial", categoria: "Regular", local: "Sala 101", professor: "PROFESSOR EXEMPLO", cor: null });
  // Cabeçalho e legenda não viram linhas; as cores viram tipos.
  assert.ok(!tabela.some(l => /^data$/i.test(l.data)));
  assert.deepEqual(tabela.filter(l => l.cor).map(l => l.data + " " + l.cor), ["24/08 avaliacao", "31/08 avaliacao", "21/09 avaliacao", "26/09 substitutiva",
    "28/09 avaliacao", "19/10 avaliacao", "26/10 avaliacao", "16/11 avaliacao", "30/11 exame"]);
  // Linha de exame com "Presencia l" quebrado e a Categoria TED inteira na coluna certa.
  assert.equal(tabela[17].modalidade, "Presencia l");
  assert.equal(tabela.find(l => l.data === "29/08").categoria, "Trabalho Efetivo Discente (TED)");
});

test("células: as colunas do cabeçalho valem nas páginas seguintes", () => {
  const pl = PLANOS_CELULAS.celulas(), pg = paginasDoPlano(pl);
  assert.ok(pg.length >= 3, "o plano sintético precisa ter o cronograma em mais de uma página");
  const t = linhasDaTabela(paginasComoLidas(pg));
  assert.equal(t[t.length - 1].conteudo, "Exame.");
  assert.equal(t[t.length - 1].local, "Sala 101");
});

test("células: tabela sem coluna Turma e datas com ano de dois dígitos", () => {
  const p = plano("celulas-sem-turma");
  assert.equal(p.fonte, "celulas");
  assert.deepEqual(p.turmas, []);
  assert.ok(p.aulasPlano.every(a => a.turmas.length === 0 && /^2026-/.test(a.data)));
  assert.equal(p.aulasPlano[0].data, "2026-08-04");
});

test("células: a legenda do PDF é que define as cores", () => {
  const pg = paginasComoLidas(paginasDoPlano(PLANOS_CELULAS.celulas()));
  // Troca o verde da legenda e das linhas por outro tom: continua sendo "avaliacao".
  pg.forEach(p => p.rets.forEach(r => { if (r.cor === "#e8f5e9") r.cor = "#ccffcc"; }));
  const t = linhasDaTabela(pg);
  assert.equal(t.find(l => l.data === "31/08").cor, "avaliacao");
});

test("plano B: sem tabela, ou com número de linhas diferente, vale a leitura por texto", () => {
  const { linhas, tabela } = lido("celulas");
  assert.equal(lerPlano(linhas, tabela).fonte, "celulas");
  assert.equal(lerPlano(linhas, null).fonte, "texto");
  assert.equal(lerPlano(linhas, tabela.slice(1)).fonte, "texto");
  assert.equal(lerPlano(linhas, tabela.slice(0, -1)).fonte, "texto"); // as primeiras datas batem, mas falta uma linha
  const p = lerPlano(linhas, null);
  assert.equal(p.aulasPlano.length, 18);
  assert.ok(p.aulasPlano.every(a => a.cor === null));
});

test("EAD pela coluna Modalidade, não pelo Local", () => {
  const p = plano("celulas");
  // 17/08: parte EAD no mesmo dia da aula presencial, com Local "Sala 101" → EAD, mas o dia tem aula presencial.
  const r = p.aulasPlano.filter(a => a.data === "2026-08-17");
  assert.deepEqual(r.map(a => a.ead), [false, true]);
  assert.deepEqual(datasDoPlano(p).ead.map(a => a.data), ["2026-08-29", "2026-09-26"]);
  // O horário da grade vem só das aulas presenciais.
  assert.deepEqual(aulasDoPlano(p), [{ dia: "Segunda", ini: "14:00", fim: "17:20", periodos: 4 }]);
});

/* ---------- Tipos ---------- */
test("tipo da linha: cor e texto juntos", () => {
  const t = (conteudo, cor = null) => tipoDaLinha({ conteudo, cor }).tipo;
  assert.equal(t("Prova 1."), "prova");
  assert.equal(t("I Avaliação"), "prova");
  assert.equal(t("EXAME."), "exame");
  assert.equal(t("Qualquer coisa", "exame"), "exame");
  assert.equal(t("Correção da prova 2. Orientações para o exame."), "aula");
  assert.equal(t("Aula de revisão para o Exame Final."), "aula");
  assert.equal(t("Revisão para a prova"), "aula");
  assert.equal(t("Atividade prática 1."), "trabalho");
  assert.equal(t("Trabalho de laboratório II"), "trabalho");
  assert.equal(t("Questionário II."), "questionario");
  assert.equal(t("Apresentação dos seminários"), "seminario");
  assert.equal(t("Preparação dos seminários"), "aula");
  assert.equal(t("Semana Acadêmica do Curso"), "evento");
  assert.equal(t("XII Mostra de Ensino, Pesquisa e Extensão"), "evento");
  assert.equal(t("Jornada Acadêmica"), "evento");
  assert.equal(t("Atividade de reposição", "substitutiva"), "substitutiva");
  assert.equal(t("Estudo de caso em laboratório", "avaliacao"), "avaliacao-sem-nome");
  assert.equal(t("Estudo de caso em laboratório"), "aula");
  // A Categoria "Trabalho Efetivo Discente (TED)" não é entrega de trabalho.
  assert.equal(tipoDaLinha({ conteudo: "Exercícios.", categoria: "Trabalho Efetivo Discente (TED)" }).tipo, "aula");
  // Texto que cita duas avaliações é ambíguo.
  assert.deepEqual(tipoDaLinha({ conteudo: "Questionário e continuidade de atividades. - Trabalho Prático." }), { tipo: "questionario", tipos: ["questionario", "trabalho"], ambiguo: true });
});

test("tipo da avaliação dos critérios e números", () => {
  const a = (tipo, nome) => tipoDaAval({ tipo, nome });
  assert.equal(a("Avaliação Escrita (Prova)", "Prova 2"), "prova");
  assert.equal(a("Outros", "Avaliação 3"), "prova");
  assert.equal(a("Trabalho", "Seminário final"), "seminario");
  assert.equal(a("Apresentação", "Temas livres"), "seminario");
  assert.equal(a("Outros", "Questionários"), "questionario");
  assert.equal(a("Outros", "Atividades de Aula"), "trabalho");
  assert.equal(a("Trabalho", "Projeto em grupo"), "trabalho");
  assert.equal(a("Outros", "Relatórios de leitura"), "outro");
  assert.equal(numeroDe("PROVA 01."), 1);
  assert.equal(numeroDe("II Avaliação"), 2);
  assert.equal(numeroDe("2ª prova"), 2);
  assert.equal(numeroDe("Trabalho de laboratório II"), 2);
  assert.equal(numeroDe("Atividade Prática I no ambiente virtual"), 1);
  assert.equal(numeroDe("Prova escrita"), null);
});

/* ---------- Ligação avaliação → data ---------- */
test("ligação: número, prova sem número deduzida, várias datas, texto ambíguo e ordem por data", () => {
  const p = plano("celulas"), d = datasDoPlano(p);
  assert.deepEqual(resumo(p, d), [
    ["Questionários", ["2026-08-24", "2026-09-28"], "ambiguo"],
    ["Prova 1", ["2026-08-31"], "eliminacao"],          // "Prova ," sem número: só faltava o 1
    ["Seminário final", ["2026-10-19", "2026-10-26"], "cronograma"],
    ["Prova 2", ["2026-11-16"], "cronograma"],
    ["Relatórios de leitura", [], null],
  ]);
  assert.equal(d.exame, "2026-11-30");
  assert.deepEqual(d.datas, { 0: "2026-11-16", 1: "2026-08-31", 2: "2026-10-19", 3: "2026-08-24" });
});

test("agenda: eventos, substitutiva (não é avaliação), verde sem nome e as outras datas das avaliações", () => {
  const d = datasDoPlano(plano("celulas"));
  assert.deepEqual(d.eventos, [
    { data: "2026-09-14", tipo: "Evento", titulo: "Semana Acadêmica do Curso" },
    { data: "2026-09-21", tipo: "Outro", titulo: "Avaliação sem nome no plano (confira)" },
    { data: "2026-09-26", tipo: "Atividade substitutiva", titulo: "Atividade de reposição no ambiente virtual" },
    { data: "2026-09-28", tipo: "Outro", titulo: "Questionários, 2ª data" },
    { data: "2026-10-26", tipo: "Seminário", titulo: "Seminário final, 2ª data" },
  ]);
  assert.ok(!d.avals.some(a => a.datas.includes("2026-09-26")), "a atividade substitutiva não vira data de avaliação");
});

test("nunca liga avaliação a data só pela cor", () => {
  const linha = (data, conteudo, cor) => ({ data, dia: "Quarta", turmas: [], conteudo, texto: conteudo, cor, ead: false });
  const p = { turma: null, avaliacoes: [{ tipo: "Trabalho", nome: "Trabalho" }, { tipo: "Avaliação Escrita (Prova)", nome: "Prova" }],
    aulasPlano: [linha("2026-09-02", "Bancos de dados de sequências.", "avaliacao"), linha("2026-10-14", "PROVA 01.", "avaliacao")] };
  const d = datasDoPlano(p);
  assert.deepEqual(d.avals[0], { datas: [], origem: null });
  assert.deepEqual(d.avals[1], { datas: ["2026-10-14"], origem: "cronograma" });
  assert.deepEqual(d.eventos, [{ data: "2026-09-02", tipo: "Outro", titulo: "Avaliação sem nome no plano (confira)" }]);
});

test("atividade substitutiva nunca vira data de avaliação, mesmo citando o tipo da avaliação", () => {
  const linha = (data, conteudo, cor) => ({ data, dia: "Sábado", turmas: [], conteudo, texto: conteudo, cor, ead: true });
  const p = { turma: null, avaliacoes: [{ tipo: "Trabalho", nome: "Atividades práticas" }],
    aulasPlano: [linha("2026-09-05", "Atividade prática 1.", "avaliacao"), linha("2026-09-12", "Atividade prática de reposição.", "substitutiva")] };
  const d = datasDoPlano(p);
  assert.deepEqual(d.avals[0], { datas: ["2026-09-05"], origem: "cronograma" });
  assert.deepEqual(d.eventos, [{ data: "2026-09-12", tipo: "Atividade substitutiva", titulo: "Atividade prática de reposição" }]);
});

test("prova única sem número não é renomeada; só deduz quando falta um número entre várias", () => {
  const p = plano("celulas-sem-turma");
  assert.deepEqual(p.avaliacoes.map(a => a.nome), ["Prova", "Atividades práticas"]);
  assert.deepEqual(resumo(p, datasDoPlano(p)), [["Atividades práticas", ["2026-08-18", "2026-09-15"], "cronograma"], ["Prova", ["2026-09-22"], "cronograma"]]);
});

test("duas turmas: datas, exame e EAD de cada turma", () => {
  const p = plano("celulas-duas-turmas");
  assert.deepEqual(p.turmas, ["A", "B"]);
  const a = datasDoPlano({ ...p, turma: "A" }), b = datasDoPlano({ ...p, turma: "B" });
  assert.deepEqual(resumo(p, a).map(x => x[1][0]), ["2026-08-25", "2026-09-22", "2026-09-26"]);
  assert.deepEqual(resumo(p, b).map(x => x[1][0]), ["2026-08-27", "2026-09-24", "2026-09-26"]);
  assert.equal(a.exame, "2026-09-29"); assert.equal(b.exame, "2026-10-01");
  assert.deepEqual(aulasDoPlano({ ...p, turma: "B" }), [{ dia: "Quinta", ini: "18:20", fim: "21:40", periodos: 4 }]);
});
