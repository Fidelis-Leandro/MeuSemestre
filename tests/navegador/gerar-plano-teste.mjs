// Gera PDFs sintéticos imitando planos de ensino, sem dados pessoais, para os testes.
// Uso: node tests/navegador/gerar-plano-teste.mjs <saida.pdf> [simples|duas-turmas]
//   simples      (padrão) o plano-teste.pdf usado por refatoracao.mjs
//   duas-turmas  cronograma com turmas A (terça 18:20–21:40) e B (quinta 18:20–20:50), no formato em que o horário
//                vem quebrado em duas linhas ("18:20 -" antes da data e "21:40" depois) e a turma vem após o dia
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

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, "/").split("/").pop())) {
  const [, , saida, variante = "simples"] = process.argv;
  if (!saida || !LINHAS[variante]) { console.error("Uso: node gerar-plano-teste.mjs <saida.pdf> [simples|duas-turmas]"); process.exit(1); }
  fs.writeFileSync(saida, gerarPDF(LINHAS[variante]));
  console.log(`${saida}: ${LINHAS[variante].length} linhas (${variante})`);
}
