// Grade semanal (tabela de horários) e preenchimento de horários que faltam.
import { render, abas } from "../app.js";
import { dados, salvar, achar } from "../dados.js";
import { periodosEntre } from "../regras.js";
import { esc, DIAS, DIA_JS, faixasGrade } from "../util.js";

function nomeCurto(n){
  let t=n.replace(/^(Introdução|Introducao)\s+(à|a|ao|aos|às)\s+/i,"").replace(/^Fundamentos\s+de\s+/i,"")
    .replace(/Inteligência Artificial/gi,"IA").replace(/Programação Orientada a Objetos/gi,"POO").replace(/\s+na Área da\s+/i," na ");
  if(t.length>20 && /^[^\s]+,/.test(t)) t=t.split(",")[0];
  if(t.length>20){ const p=t.split(/[\s,]+/).filter(w=>w.length>3); if(p.length>1) t=p.map(w=>w[0].toUpperCase()).join("")+(/\s(I{1,3}|IV|V)$/.test(t)?" "+t.match(/\s(I{1,3}|IV|V)$/)[1]:""); }
  return t.charAt(0).toUpperCase()+t.slice(1);
}
const CORES_GRADE=[["#E6F1FB","#0C447C"],["#FAEEDA","#633806"],["#EAF3DE","#27500A"],["#FBEAF0","#72243E"],["#EEEDFE","#3C3489"],["#E1F5EE","#085041"],["#FAECE7","#712B13"],["#F1EFE8","#444441"]];
const CORES_GRADE_ESC=[["#17304a","#B5D4F4"],["#3b2a0c","#FAC775"],["#23360f","#C0DD97"],["#3d1a28","#F4C0D1"],["#26214a","#CECBF6"],["#0f3a30","#9FE1CB"],["#3d2015","#F5C4B3"],["#2c2c2a","#D3D1C7"]];
export function telaGrade(){
  const itens=[]; dados.cadeiras.forEach((c,ci)=>(c.aulas||[]).forEach(a=>itens.push({c,ci,a})));
  const com=itens.filter(x=>x.a.ini&&x.a.fim), sem=itens.filter(x=>!(x.a.ini&&x.a.fim));
  let h=abas("grade");
  if(!itens.length) return h+`<div class="card vazio">Nenhum dia de aula cadastrado.<br>Importe os planos de ensino ou adicione os dias em "Editar cadeira".</div>`;
  const dias=DIAS.filter(d=>com.some(x=>x.a.dia===d));
  const tempos=[...new Set(com.flatMap(x=>[x.a.ini,x.a.fim]))].sort();
  const esc2=document.documentElement.classList.contains("escuro")?CORES_GRADE_ESC:CORES_GRADE;
  const hojeDia=DIA_JS[new Date().getDay()];
  if(com.length){
    const faixas=faixasGrade(com);
    // Dia com aulas lado a lado ganha coluna mais larga (52px por faixa); o card rola na horizontal se precisar.
    const largura=d=>Math.max(1,...com.filter(x=>x.a.dia===d).map(x=>faixas.get(x).n));
    const colunas=dias.some(d=>largura(d)>1) ? "42px "+dias.map(d=>`minmax(${largura(d)>1?52*largura(d):64}px,1fr)`).join(" ") : `42px repeat(${dias.length},minmax(64px,1fr))`;
    h+=`<div class="card" style="padding:10px;overflow-x:auto"><div style="display:grid;grid-template-columns:${colunas};grid-template-rows:28px ${tempos.slice(0,-1).map((t,i)=>Math.max(30,Math.round(periodosEntre(t,tempos[i+1])*50*0.75))+"px").join(" ")} 14px;gap:3px;font-size:.72rem">`;
    h+=`<div></div>`+dias.map((d,i)=>`<div style="grid-column:${i+2};grid-row:1;text-align:center;font-weight:800;color:${d===hojeDia?"var(--botao-texto)":"var(--primaria)"};${d===hojeDia?"background:var(--botao);border-radius:8px;":""}padding-top:6px">${d.slice(0,3)}</div>`).join("");
    tempos.forEach((t,i)=>h+=`<div style="grid-column:1;grid-row:${i+2};color:var(--suave);font-size:.68rem;border-top:1px dashed var(--borda);padding-top:2px">${t}</div>`);
    com.forEach(x=>{ const [bg,fg]=esc2[x.ci%esc2.length], {k,n}=faixas.get(x);
      // Sobreposta: ocupa 1/n da coluna, deslocada para a faixa k, com 3px entre as faixas.
      const lado=n>1?`justify-self:start;width:calc((100% - ${3*(n-1)}px) / ${n});margin-left:calc((100% - ${3*(n-1)}px) / ${n} * ${k} + ${3*k}px);`:"";
      h+=`<div onclick="ir('detalhe','${x.c.id}')"${n>1?` data-faixa="${k}/${n}"`:""} style="cursor:pointer;${lado}grid-column:${dias.indexOf(x.a.dia)+2};grid-row:${tempos.indexOf(x.a.ini)+2}/${tempos.indexOf(x.a.fim)+2};background:${bg};color:${fg};border-radius:8px;padding:5px;line-height:1.2;overflow:hidden"><div style="font-weight:800;font-size:.8rem;hyphens:auto;overflow-wrap:anywhere">${esc(nomeCurto(x.c.nome))}</div><div style="opacity:.85;margin-top:3px;font-size:.68rem">${x.a.ini}<br>${x.a.fim}</div></div>`; });
    h+=`</div></div>`;
  }
  if(sem.length){
    h+=`<div class="card" style="border-color:var(--atencao);background:var(--aviso-fundo)">
      <h2>Faltam ${sem.length} horário(s) para montar a grade</h2>
      <div class="meta" style="margin:6px 0 12px">Reimporte os planos de ensino (suas notas e faltas são mantidas) ou preencha o início e o fim de cada aula aqui embaixo.</div>
      <button style="width:100%" onclick="document.getElementById('pdf-in').click()">Reimportar planos de ensino</button>
      <input type="file" id="pdf-in" accept="application/pdf,.pdf" multiple style="display:none" onchange="importarPlanos(this.files);this.value=''">
      <div id="imp-msg"></div></div>`;
    h+=`<div class="card"><h2>Preencher horários</h2>`;
    sem.forEach(x=>{ const [bg,fg]=esc2[x.ci%esc2.length]; const k=x.c.aulas.indexOf(x.a);
      h+=`<div style="background:${bg};color:${fg};border-radius:12px;padding:10px 12px;margin-top:10px">
        <div style="font-weight:700">${esc(x.c.nome)}</div><div style="font-size:.85rem;opacity:.85;margin-bottom:8px">${x.a.dia} &middot; ${x.a.periodos} período(s)</div>
        <div class="aval" style="grid-template-columns:1fr 1fr;margin:0">
          <label style="margin:0;color:${fg}">Início<input type="time" value="${x.a.ini||""}" onchange="horarioAula('${x.c.id}',${k},'ini',this.value)"></label>
          <label style="margin:0;color:${fg}">Fim<input type="time" value="${x.a.fim||""}" onchange="horarioAula('${x.c.id}',${k},'fim',this.value)"></label></div></div>`; });
    h+=`</div>`;
  }
  return h;
}

export function horarioAula(cid,k,campo,v){ const a=achar(cid).aulas[k]; a[campo]=v; if(a.ini&&a.fim){ a.periodos=periodosEntre(a.ini,a.fim); salvar(); render(); } else salvar(); }
