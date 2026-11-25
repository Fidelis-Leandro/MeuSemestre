// Gera um PDF de texto simples imitando um plano de ensino (o plano-teste.pdf usado por refatoracao.mjs).
// Uso: node tests/navegador/gerar-plano-teste.mjs tests/navegador/plano-teste.pdf
import fs from "node:fs";
const L = ["Plano de Ensino","Codigo da Disciplina: INF0123","Nome da Disciplina: Introducao a Programacao","Carga Horaria Total (horas): 60","ANO: 2026",
 "Dia(s) da Semana: Segunda (08:00 - 09:40) Quarta (13:30 - 15:10)","Criterios de Avaliacao","Prova - Primeira prova individual, de peso 40","Prova - Segunda prova individual, de peso 40","Trabalho - Projeto final em grupo, de peso 20","Bibliografia","CRONOGRAMA",
 "02/03 Segunda Aula expositiva 08:00 - 09:40","04/03 Quarta Aula pratica 13:30 - 15:10","09/03 Segunda Aula 08:00 - 09:40","11/03 Quarta Aula 13:30 - 15:10","16/03 Segunda Aula 08:00 - 09:40","18/03 Quarta Atividade no Moodle a distancia",
 "23/03 Segunda Prova 1 08:00 - 09:40","25/03 Quarta Aula 13:30 - 15:10","30/03 Segunda Aula 08:00 - 09:40","01/04 Quarta Aula 13:30 - 15:10","06/04 Segunda Prova 2 08:00 - 09:40","08/04 Quarta Exame 13:30 - 15:10","Data de Conclusao"];
const conteudo = "BT /F1 10 Tf 40 800 Td 14 TL\n" + L.map(l => `(${l}) Tj T*`).join("\n") + "\nET";
const objs = ["<< /Type /Catalog /Pages 2 0 R >>","<< /Type /Pages /Kids [3 0 R] /Count 1 >>","<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
 `<< /Length ${conteudo.length} >>\nstream\n${conteudo}\nendstream`,"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"];
let s = "%PDF-1.4\n", off = []; objs.forEach((o, i) => { off.push(s.length); s += `${i+1} 0 obj\n${o}\nendobj\n`; });
const x = s.length; s += `xref\n0 ${objs.length+1}\n0000000000 65535 f \n` + off.map(o => String(o).padStart(10,"0") + " 00000 n \n").join("") + `trailer\n<< /Size ${objs.length+1} /Root 1 0 R >>\nstartxref\n${x}\n%%EOF\n`;
fs.writeFileSync(process.argv[2], s, "latin1");
