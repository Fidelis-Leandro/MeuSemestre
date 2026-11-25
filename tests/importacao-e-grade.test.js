// Testes da leitura de planos com várias turmas, das faixas da grade e do nome que cabe em cada bloco. Rode com:  node --test
// Usa as mesmas linhas do PDF sintético de tests/navegador/gerar-plano-teste.mjs (sem dados pessoais).
import { test } from "node:test";
import assert from "node:assert/strict";
import { lerPlano, aulasDoPlano, datasDoPlano } from "../js/plano-ensino.js";
import { faixasGrade, nomesCurtos, encaixarBloco } from "../js/util.js";
import { LINHAS } from "./navegador/gerar-plano-teste.mjs";

test("plano com duas turmas: detecta as turmas e não escolhe nenhuma sozinho", () => {
  const p = lerPlano(LINHAS["duas-turmas"]);
  assert.equal(p.codigo, "INF9001");
  assert.deepEqual(p.turmas, ["A", "B"]);
  assert.equal(p.turma, null);
});

test("plano com duas turmas: cada turma tem só os próprios horários e datas", () => {
  const p = lerPlano(LINHAS["duas-turmas"]);
  // Sem escolher, os horários das duas turmas se misturam (por isso a escolha é obrigatória na importação).
  assert.equal(aulasDoPlano(p).length, 2);
  assert.deepEqual(aulasDoPlano({ ...p, turma: "A" }), [{ dia: "Terça", ini: "18:20", fim: "21:40", periodos: 4 }]);
  assert.deepEqual(aulasDoPlano({ ...p, turma: "B" }), [{ dia: "Quinta", ini: "18:20", fim: "20:50", periodos: 3 }]);
  assert.deepEqual(datasDoPlano({ ...p, turma: "A" }).datas, { 0: "2026-09-01", 1: "2026-09-29" });
  assert.deepEqual(datasDoPlano({ ...p, turma: "B" }).datas, { 0: "2026-09-03", 1: "2026-10-01" });
});

test("plano de uma turma só continua sem escolha de turma", () => {
  const p = lerPlano(LINHAS.simples);
  assert.deepEqual(p.turmas, []);
  assert.equal(p.turma, null);
});

const aula = (dia, ini, fim) => ({ a: { dia, ini, fim } });
const faixas = l => { const f = faixasGrade(l); return l.map(x => `${f.get(x).k}/${f.get(x).n}`); };

test("grade: aulas sem sobreposição ocupam a coluna inteira", () => {
  // Uma termina quando a outra começa: não é sobreposição.
  assert.deepEqual(faixas([aula("Terça", "08:00", "09:40"), aula("Terça", "09:40", "11:20"), aula("Quarta", "08:00", "09:40")]), ["0/1", "0/1", "0/1"]);
});

test("grade: aulas sobrepostas ficam lado a lado", () => {
  // O caso do plano com turmas misturadas: mesma cadeira, 18:20–21:40 e 18:20–20:50.
  assert.deepEqual(faixas([aula("Terça", "18:20", "21:40"), aula("Terça", "18:20", "20:50")]), ["0/2", "1/2"]);
  // Outra cadeira, no mesmo dia e horário, mas em outro dia não conta.
  assert.deepEqual(faixas([aula("Terça", "08:00", "10:00"), aula("Terça", "09:00", "11:00"), aula("Quinta", "09:00", "11:00")]), ["0/2", "1/2", "0/1"]);
});

test("grade: grupo encadeado reaproveita faixa livre e conta o máximo de faixas", () => {
  // A (8–10) cruza B (9–12); C (10–11) começa quando A acaba e usa a faixa de A; D (13–14) é outro grupo.
  const l = [aula("Sexta", "08:00", "10:00"), aula("Sexta", "09:00", "12:00"), aula("Sexta", "10:00", "11:00"), aula("Sexta", "13:00", "14:00")];
  assert.deepEqual(faixas(l), ["0/2", "1/2", "0/2", "0/1"]);
  // Três ao mesmo tempo: três faixas.
  assert.deepEqual(faixas([aula("Sexta", "08:00", "10:00"), aula("Sexta", "08:30", "09:30"), aula("Sexta", "09:00", "11:00")]), ["0/3", "1/3", "2/3"]);
});

/* ---------- Nome que cabe no bloco da grade ---------- */
test("grade: nomes curtos abreviam palavras inteiras, sem preposições, siglas e romanos intactos", () => {
  assert.deepEqual(nomesCurtos("Anatomia Humana"), ["Anatomia Humana", "Anatomia H.", "Anat. H.", "AH"]);
  assert.deepEqual(nomesCurtos("Introdução à Programação"), ["Introdução à Programação", "Intro. Programação", "Programação", "Prog.", "P"]);
  assert.deepEqual(nomesCurtos("Introdução à Inteligência Artificial na Área da Saúde"),
    ["Introdução à Inteligência Artificial na Área da Saúde", "Intro. IA na Saúde", "IA na Saúde", "IA S.", "IAS"]);
  assert.deepEqual(nomesCurtos("Banco de Dados"), ["Banco de Dados", "Banco D.", "BD"]);
  // O numeral romano fica preso por espaço não separável ( ); só a última forma usa espaço comum.
  assert.deepEqual(nomesCurtos("Programação Orientada a Objetos I"), ["Programação Orientada a Objetos I", "POO I", "POO I"]);
  assert.deepEqual(nomesCurtos("Bioestatística"), ["Bioestatística", "Bioest.", "B"]);
  assert.deepEqual(nomesCurtos("Cálculo II"), ["Cálculo II", "Cálc. II", "C II", "C II"]);
  // Nenhum candidato tem pedaço de palavra sem ponto (abreviação) ou preposição solta no fim.
  for (const n of ["Genética e Evolução", "Autômatos, Computabilidade e Complexidade", "Fundamentos de Imunologia"])
    nomesCurtos(n).forEach(c => assert.ok(!/\s(de|da|do|e|à|na)$/.test(c), `${n} → "${c}"`));
});

// Medida de teste: 7 px por letra no nome, 6 px no horário; linhas de 15 px (nome) e 13 px (horário).
const medidas = { medirNome: t => t.length * 7, medirHora: t => t.length * 6, linhaNome: 15, linhaHora: 13, margemHora: 3, ini: "13:30", fim: "15:10" };
const encaixa = (nome, largura, altura) => { const r = encaixarBloco({ candidatos: nomesCurtos(nome), largura, altura, ...medidas }); return `${r.nome} | ${r.hora}${r.aperto ? " | aperto" : ""}`; };

test("grade: escolhe o nome mais completo que cabe sem partir palavra, e o horário que cabe", () => {
  // Bloco largo e alto (3h20): nome inteiro em linhas e horário em duas linhas.
  assert.equal(encaixa("Anatomia Humana", 120, 150), "Anatomia Humana | duas");
  // Bloco estreito: "Anatomia" (56 px) não cabe em 54 px, então nenhuma forma com a palavra inteira serve.
  assert.equal(encaixa("Anatomia Humana", 54, 65), "Anat. H. | duas");
  // 1h40 (65 px úteis): com 100 px o nome inteiro ocupa 2 linhas ("Introdução à" / "Programação") e o horário ainda cabe.
  assert.equal(encaixa("Introdução à Programação", 100, 65), "Introdução à Programação | duas");
  // Com 80 px ele precisaria de 3 linhas (45 + 29 > 65): entra a forma abreviada, em 2 linhas.
  assert.equal(encaixa("Introdução à Programação", 80, 65), "Intro. Programação | duas");
  // Baixo demais para duas linhas de horário: vai para uma linha ("13:30–15:10" = 66 px).
  assert.equal(encaixa("Banco de Dados", 110, 32), "Banco de Dados | uma");
  // 50 min (27 px úteis) e estreito: só o nome.
  assert.equal(encaixa("Banco de Dados", 60, 27), "Banco D. | nenhuma");
  // Ainda mais estreito ("Banco D." = 56 px não cabe em 54): iniciais.
  assert.equal(encaixa("Banco de Dados", 54, 27), "BD | nenhuma");
  // Iniciais só quando nada mais cabe.
  assert.equal(encaixa("Introdução à Inteligência Artificial na Área da Saúde", 30, 27), "IAS | nenhuma");
  // Nem as iniciais cabem: último recurso, com aviso.
  assert.equal(encaixa("Introdução à Inteligência Artificial na Área da Saúde", 14, 27), "IAS | nenhuma | aperto");
});
