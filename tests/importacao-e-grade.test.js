// Testes da leitura de planos com várias turmas e das faixas da grade. Rode com:  node --test
// Usa as mesmas linhas do PDF sintético de tests/navegador/gerar-plano-teste.mjs (sem dados pessoais).
import { test } from "node:test";
import assert from "node:assert/strict";
import { lerPlano, aulasDoPlano, datasDoPlano } from "../js/plano-ensino.js";
import { faixasGrade } from "../js/util.js";
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
