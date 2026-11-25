// Tela de detalhe da cadeira: faltas, notas, situação, simulador e lançamento de notas/exame.
import { render } from "../app.js";
import { salvar, achar } from "../dados.js";
import { periodos, faltasMax, situacao, calcularNotas, notaDe, temSubs, notaExame, corFalta, limitar, aprovada } from "../regras.js";
import { esc, fmt, fmt2, virg, num, diasAte, dataCurta, quando } from "../util.js";
import { celebrar } from "../animacoes.js";

export function telaDetalhe(c){
  const max=faltasMax(c.ch), rest=max-c.faltas, s=situacao(c), n=calcularNotas(c);
  const pct=Math.min(100,c.faltas/max*100);
  let avisoF = c.faltas>max ? `<div class="aviso" style="color:var(--erro)">Limite ultrapassado. Sem os 75% de presença você reprova e não pode fazer exame.</div>`
    : rest<=2 ? `<div class="aviso" style="color:var(--exame)">Atenção: restam só ${rest} falta(s).</div>` : `<div class="aviso meta">Restam ${rest} falta(s). ${c.aulas&&c.aulas.length ? c.aulas.map(a=>`${a.dia}: ${a.periodos}`).join(" &middot; ")+" período(s) por aula." : `Um dia inteiro de aula = ${c.periodosDia} falta(s).`}</div>`;

  let h=`<div class="card">
    <div class="linha entre"><h2>Faltas</h2><span class="meta">${c.ch}h &middot; ${periodos(c.ch)} períodos</span></div>
    <div class="linha entre" style="margin-top:6px"><div><span class="contador" data-falta-num="det:${c.id}">${c.faltas}</span><span class="meta"> / ${max} permitidas</span></div></div>
    <div class="barra"><div data-falta="det:${c.id}" data-f="${c.faltas}" data-max="${max}" style="width:${pct}%;background:${corFalta(c.faltas,max)}"></div></div>
    ${avisoF}
    <div class="linha" style="margin-top:12px">
      ${c.aulas&&c.aulas.length ? c.aulas.map(a=>`<button onclick="falta('${c.id}',${a.periodos})">Faltei ${a.dia.toLowerCase()} (+${a.periodos})</button>`).join("")
        : `<button onclick="falta('${c.id}',${c.periodosDia})">Faltei no dia (+${c.periodosDia})</button>`}
      <button class="sec" onclick="falta('${c.id}',1)">+1 período</button>
      <button class="sec" onclick="falta('${c.id}',-1)">&minus;1</button>
    </div></div>`;

  h+=`<div class="card"><div class="linha entre"><h2>Notas</h2><span class="status ${s.cls}" data-selo="det:${c.id}">${s.txt}</span></div>
    <div class="meta" style="margin-bottom:10px">Digite a nota (0 a 10) quando receber.</div>`;
  h+=`<div class="media-linha"><span>Média</span><span data-conta="${n.pontos}" data-dec="2" data-chave="med:det:${c.id}">${fmt2(n.pontos)}</span></div>`;
  c.avaliacoes.forEach((a,i)=>{
    const v=notaDe(a);
    if(a.data){ const nd=diasAte(a.data);
      h+=`<div class="meta" style="margin-top:10px;color:${v===null&&nd>=0&&nd<=1?"var(--exame)":v===null&&nd>=0&&nd<=6?"var(--atencao)":"var(--suave)"}">${esc(a.nome)} &middot; ${dataCurta(a.data)} &middot; ${v!==null?"nota lançada":nd>=0?(nd<=1?quando(nd):"faltam "+nd+" dias"):"já passou"}${v===null&&s.precisa!==undefined?` &middot; você precisa de ${fmt(s.precisa)}`:v===null&&s.precisa4!==undefined?` &middot; precisa de ${fmt(s.precisa4)} para ter exame`:""}</div>`; }
    if(temSubs(a)){
      h+=`<div class="nota-bloco">Nota ${i+1}: ${v!==null?fmt2(v)+" ":""}(${fmt(a.peso)}%) <span class="nm" style="font-size:.9rem">&middot; ${esc(a.nome)}</span>`+
        a.subs.map((sb,j)=>{ const sv=num(sb.nota); return `<div class="sub"><span><span class="nm">${esc(sb.nome)}</span> &middot; ${sv!==null?"Lançado":"Não lançado"} &middot; Peso ${fmt(sb.peso)}%</span>
        <input inputmode="decimal" placeholder="nota" value="${virg(sb.nota)}" onchange="notaSub('${c.id}',${i},${j},this.value)"></div>`; }).join("")+`</div>`;
      return;
    }
    h+=`<div class="nota-bloco">Nota ${i+1}: ${v!==null?fmt2(v)+" ":""}(${fmt(a.peso)}%)
      <div class="sub"><span><span class="nm">${esc(a.nome)}</span> &middot; ${v!==null?"Lançado":"Não lançado"}</span>
      <input inputmode="decimal" placeholder="nota" value="${virg(a.nota)}" onchange="nota('${c.id}',${i},this.value)"></div></div>`;
  });
  h+=`<div class="resumo"><div>Já avaliado<b>${fmt(n.pesoFeito)}%</b></div><div>Máximo possível<b>${fmt(n.maxPossivel)}</b></div></div>`;
  h+=blocoSituacao(c,s,n)+`</div>`;

  if(n.pesoRestante>0 && Math.abs(n.pesoTotal-100)<.01 && c.faltas<=max){
    h+=`<div class="card"><h2>Simulador</h2><div class="meta">E se eu tirar esta nota em todas as avaliações que faltam?</div>
      <input id="sim" inputmode="decimal" placeholder="Ex.: 7" style="margin-top:10px" oninput="simular('${c.id}')">
      <div id="sim-res"></div></div>`;
  }

  h+=`<div class="card meta" style="font-size:.8rem"><b style="color:var(--texto)">Regras usadas</b><br>
    Média 7 ou mais: aprovado direto. Média de 4 a 6,9: exame. Abaixo de 4: reprovado.<br>
    Exame: nota final = 0,6 &times; média + 0,4 &times; exame, precisa ser 6 ou mais.<br>
    Presença mínima de 75% (período de 50 min).</div>
    <button class="sec" onclick="ir('form','${c.id}')">Editar cadeira</button>`;
  return h;
}

function blocoSituacao(c,s,n){
  let grande="", rot="";
  if(s.precisa!==undefined){ rot="Média mínima nas próximas avaliações"; grande=fmt(s.precisa); }
  else if(s.exame!==undefined){ rot="Nota necessária no exame"; grande=fmt(s.exame); }
  else if(s.precisa4!==undefined){ rot="Média mínima nas próximas para ter exame"; grande=fmt(s.precisa4); }
  let h=`<div class="destaque">${rot?`<div class="meta">${rot}</div><div class="grande">${grande}</div>`:""}<div>${s.det}</div>`;
  if(s.exame!==undefined || (n.pesoRestante<=0 && num(c.exame)!==null)){
    h+=`<label>Nota do exame (quando sair)</label><input inputmode="decimal" value="${virg(c.exame)}" onchange="exame('${c.id}',this.value)">`;
  }
  return h+`</div>`;
}

export function simular(cid){
  const c=achar(cid), n=calcularNotas(c), v=num(document.getElementById("sim").value), el=document.getElementById("sim-res");
  if(v===null||v<0||v>10){ el.innerHTML=""; return; }
  const m=n.pontos+v*n.pesoRestante/100;
  let t;
  if(m>=7) t=`<span class="status s-ok">Aprovado direto</span><div style="margin-top:6px">Média final ${fmt(m)}.</div>`;
  else if(m>=4) t=`<span class="status s-exame">Exame</span><div style="margin-top:6px">Média final ${fmt(m)}. Você precisaria de <b>${fmt(notaExame(m))}</b> no exame.</div>`;
  else t=`<span class="status s-erro">Reprovado</span><div style="margin-top:6px">Média final ${fmt(m)}, abaixo de 4.</div>`;
  el.innerHTML=`<div class="destaque">${t}</div>`;
}

export function falta(cid,d){ const c=achar(cid); c.faltas=Math.max(0,c.faltas+d); salvar(); render(); }
function lancar(cid,muda){ const c=achar(cid), antes=aprovada(c); muda(c); salvar(); render(); if(!antes && aprovada(c)) celebrar(c); }
export function nota(cid,i,v){ lancar(cid,c=>c.avaliacoes[i].nota=limitar(v)); }
export function notaSub(cid,i,j,v){ lancar(cid,c=>c.avaliacoes[i].subs[j].nota=limitar(v)); }
export function exame(cid,v){ lancar(cid,c=>c.exame=limitar(v)); }
