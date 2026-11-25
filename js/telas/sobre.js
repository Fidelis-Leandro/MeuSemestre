// Tela "Sobre o MeuSemestre".
const VERSAO="1.0";
export function telaSobre(){
  const lk=(u,t)=>`<a href="${u}" target="_blank" rel="noopener" style="color:var(--primaria);font-weight:600">${t}</a>`;
  return `<div class="card" style="text-align:center;padding:26px 18px">
    <img src="img/icon-512.png" alt="" width="96" height="96" style="border-radius:22px">
    <h2 style="font-size:1.4rem;margin:12px 0 2px">MeuSemestre</h2>
    <div class="meta">Versão ${VERSAO}</div>
    <div style="margin-top:12px">Controle de faltas, notas e agenda do semestre, feito para alunos da UFCSPA.</div>
  </div>
  <div class="card"><h2>Quem fez</h2>
    <div style="margin-top:6px"><b>Leandro Fidelis</b>, estudante de Informática Biomédica na UFCSPA.</div>
    <div style="margin-top:10px;display:flex;flex-direction:column;gap:6px">
      ${lk("https://github.com/Fidelis-Leandro/MeuSemestre","Código no GitHub")}
      ${lk("https://github.com/Fidelis-Leandro","Outros projetos")}
    </div></div>
  <div class="card"><h2>Seus dados</h2>
    <div class="meta" style="margin-top:6px">Tudo o que você cadastra fica salvo só neste aparelho. Não há login, servidor nem coleta de dados. Os planos de ensino são lidos no próprio celular e não são enviados para lugar nenhum. Use o backup para levar seus dados para outro aparelho.</div></div>
  <div class="card"><h2>Aviso</h2>
    <div class="meta" style="margin-top:6px">Este é um projeto independente e não é um sistema oficial da UFCSPA. Os cálculos seguem as regras de média 7, exame com média final 6 e presença mínima de 75%. Em caso de dúvida, confira sempre no portal oficial.</div></div>`;
}
