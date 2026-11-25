// Testes das regras de cálculo. Rode com:  node --test tests/regras.test.js
// Usa só node:test e node:assert, sem dependências.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  periodos, faltasMax, periodosEntre, notaExame, temSubs, notaDe, calcularNotas,
  situacao, aprovada, limitar, temNotas, corFalta, porUrgencia,
} from "../js/regras.js";
import { num, fmt, fmt2, virg, esc } from "../js/util.js";

const perto = (a, b, msg) => assert.ok(Math.abs(a - b) < 1e-9, msg || `${a} ≠ ${b}`);
// Cadeira mínima para os testes de situação.
const cad = (avaliacoes, extra = {}) => ({ ch: 60, faltas: 0, exame: null, avaliacoes, ...extra });

test("períodos de 50 min e limite de 25% de faltas", () => {
  const casos = { 30: [36, 9], 45: [54, 13], 60: [72, 18], 75: [90, 22], 90: [108, 27], 120: [144, 36] };
  for (const [ch, [p, f]] of Object.entries(casos)) {
    assert.equal(periodos(+ch), p, `períodos de ${ch}h`);
    assert.equal(faltasMax(+ch), f, `faltas máximas de ${ch}h`);
  }
});

test("períodos entre dois horários", () => {
  assert.equal(periodosEntre("08:00", "09:40"), 2);
  assert.equal(periodosEntre("13:30", "17:00"), 4); // 210 min / 50 = 4,2
  assert.equal(periodosEntre("08:00", "08:00"), 1); // mínimo 1
  assert.equal(periodosEntre("", "10:00"), 0);
  assert.equal(periodosEntre("08:00", ""), 0);
});

test("nota necessária no exame = 15 - 1,5 × média", () => {
  assert.equal(notaExame(4), 9);
  assert.equal(notaExame(5), 7.5);
  assert.equal(notaExame(6), 6);
});

test("nota de uma avaliação, com e sem partes", () => {
  assert.equal(notaDe({ nota: "7,5" }), 7.5);
  assert.equal(notaDe({ nota: "" }), null);
  assert.equal(notaDe({ nota: null }), null);
  assert.equal(temSubs({ subs: [] }), false);
  const partes = { subs: [{ nota: 8, peso: 50 }, { nota: 6, peso: 50 }] };
  assert.equal(temSubs(partes), true);
  perto(notaDe(partes), 7);
  assert.equal(notaDe({ subs: [{ nota: 8, peso: 50 }, { nota: null, peso: 50 }] }), null);
});

test("cálculo de notas: pontos, peso feito, restante e máximo possível", () => {
  const n = calcularNotas(cad([{ peso: 40, nota: 8 }, { peso: 40, nota: null }, { peso: 20, nota: 10 }]));
  assert.equal(n.pesoTotal, 100);
  perto(n.pontos, 5.2);
  assert.equal(n.pesoFeito, 60);
  assert.equal(n.pesoRestante, 40);
  perto(n.maxPossivel, 9.2);

  // Avaliação dividida em partes, só uma lançada: conta proporcionalmente.
  const p = calcularNotas(cad([{ peso: 60, subs: [{ nota: 10, peso: 50 }, { nota: null, peso: 50 }] }, { peso: 40, nota: null }]));
  perto(p.pontos, 3);
  perto(p.pesoFeito, 30);
  perto(p.pesoRestante, 70);
});

test("situação: faltas e configuração incompleta", () => {
  assert.equal(situacao(cad([{ peso: 100, nota: 10 }], { faltas: 19 })).txt, "Reprovado por falta");
  assert.equal(situacao(cad([{ peso: 100, nota: 10 }], { faltas: 18 })).txt, "Aprovado"); // no limite ainda passa
  assert.equal(situacao(cad([])).txt, "Sem avaliações");

  const pesos = situacao(cad([{ nome: "P1", peso: 50 }, { nome: "P2", peso: 40 }]));
  assert.equal(pesos.cls, "s-neutro");
  assert.equal(pesos.det, "Os pesos somam 90%. Ajuste para 100%.");

  const partes = situacao(cad([{ nome: "<Prova>", peso: 100, subs: [{ peso: 50 }, { peso: 40 }] }]));
  assert.equal(partes.txt, "Pesos incompletos");
  assert.equal(partes.det, 'As partes de "&lt;Prova&gt;" devem somar 100%.');
});

test("situação: semestre fechado (aprovado, exame, reprovado)", () => {
  const ok = situacao(cad([{ peso: 100, nota: 8 }]));
  assert.deepEqual([ok.cls, ok.txt, ok.det], ["s-ok", "Aprovado", "Média final 8."]);
  assert.equal(situacao(cad([{ peso: 100, nota: 7 }])).txt, "Aprovado"); // 7 exato passa direto

  const rep = situacao(cad([{ peso: 100, nota: 3.9 }]));
  assert.deepEqual([rep.cls, rep.txt], ["s-erro", "Reprovado"]);

  const ex = situacao(cad([{ peso: 100, nota: 5 }]));
  assert.equal(ex.cls, "s-exame");
  assert.equal(ex.exame, 7.5);
  assert.equal(ex.det, "Média 5. Você precisa de 7,5 no exame.");
  assert.equal(situacao(cad([{ peso: 100, nota: 4 }])).txt, "Exame"); // 4 exato tem direito a exame

  const passou = situacao(cad([{ peso: 100, nota: 5 }], { exame: 8 }));
  assert.equal(passou.txt, "Aprovado no exame");
  assert.equal(passou.det, "Nota final 6,2 (mínimo 6).");
  assert.equal(situacao(cad([{ peso: 100, nota: 5 }], { exame: 7 })).txt, "Reprovado no exame");
});

test("situação: tirando a nota do exame que o app mostra, o aluno passa", () => {
  for (let i = 40; i < 70; i++) {
    const m = i / 10, pedido = num(fmt(notaExame(m)));
    assert.equal(situacao(cad([{ peso: 100, nota: m }], { exame: pedido })).txt, "Aprovado no exame", `média ${m}`);
  }
});

test("situação: semestre em andamento", () => {
  const and = situacao(cad([{ peso: 50, nota: 10 }, { peso: 50 }]));
  assert.equal(and.txt, "Em andamento");
  perto(and.precisa, 4);

  assert.equal(situacao(cad([{ peso: 80, nota: 10 }, { peso: 20 }])).txt, "Aprovação garantida");

  const rumo = situacao(cad([{ peso: 50, nota: 2 }, { peso: 50 }]));
  assert.equal(rumo.txt, "Rumo ao exame");
  perto(rumo.precisa4, 6);

  const prov = situacao(cad([{ peso: 80, nota: 0 }, { peso: 20 }]));
  assert.equal(prov.txt, "Reprovação provável");
  assert.equal(prov.det, "Mesmo com 10 em tudo, a média máxima é 2, abaixo de 4.");
});

test("aprovada, limitar e temNotas", () => {
  assert.equal(aprovada(cad([{ peso: 100, nota: 7 }])), true);
  assert.equal(aprovada(cad([{ peso: 100, nota: 6 }])), false);
  assert.equal(limitar("11"), 10);
  assert.equal(limitar("-1"), 0);
  assert.equal(limitar("7,5"), 7.5);
  assert.equal(limitar(""), null);
  assert.equal(temNotas(cad([{ peso: 100, nota: null }])), false);
  assert.equal(temNotas(cad([{ peso: 100, nota: 0 }])), true);
  assert.equal(temNotas(cad([{ peso: 100, subs: [{ nota: 5, peso: 50 }, { nota: null, peso: 50 }] }])), true);
});

test("cor da barra de faltas", () => {
  assert.equal(corFalta(19, 18), "var(--erro)");
  assert.equal(corFalta(16, 18), "var(--exame)");   // restam 2
  assert.equal(corFalta(9, 18), "var(--atencao)");  // metade
  assert.equal(corFalta(8, 18), "var(--ok)");
});

test("ordem por urgência: risco primeiro, empate mantém a ordem original", () => {
  const erro = cad([{ peso: 100, nota: 2 }]), exame = cad([{ peso: 100, nota: 5 }]),
    andamento = cad([{ peso: 50, nota: 10 }, { peso: 50 }]), neutro = cad([]), ok = cad([{ peso: 100, nota: 9 }]),
    ok2 = cad([{ peso: 100, nota: 8 }]);
  const lista = [ok, neutro, andamento, ok2, exame, erro];
  assert.deepEqual(porUrgencia(lista), [erro, exame, andamento, neutro, ok, ok2]);
  assert.deepEqual(lista, [ok, neutro, andamento, ok2, exame, erro]); // não altera a lista recebida
});

test("formatação em pt-BR", () => {
  assert.equal(fmt(7.456), "7,46");
  assert.equal(fmt(8), "8");
  assert.equal(fmt2(5), "5,00");
  assert.equal(virg(7.5), "7,5");
  assert.equal(virg(null), "");
  assert.equal(num("abc"), null);
  assert.equal(esc(`<a href="x">'&'</a>`), "&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;");
});
