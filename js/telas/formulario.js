// Formulário de nova cadeira / editar cadeira: dias de aula e avaliações (com partes).
import { tela, ir, alertaCampo, confirmar } from "../app.js";
import { dados, salvar, achar } from "../dados.js";
import { periodos, faltasMax, periodosEntre } from "../regras.js";
import { id, esc, fmt, num, DIAS } from "../util.js";

// Rascunho do formulário enquanto a tela está aberta (antes ficava em window._avsForm / window._aulasForm).
let _avsForm=[], _aulasForm=[];

export function telaForm(){
  const c = tela.id ? achar(tela.id) : {nome:"",ch:60,periodosDia:2,avaliacoes:[{nome:"Prova 1",peso:40},{nome:"Prova 2",peso:40},{nome:"Trabalho",peso:20}]};
  const chs=[30,45,60,75,90,120];
  _avsForm = JSON.parse(JSON.stringify(c.avaliacoes));
  _aulasForm = JSON.parse(JSON.stringify(c.aulas||[]));
  return `<div class="card">
    <label>Nome da cadeira</label><input id="f-nome" value="${esc(c.nome)}" placeholder="Ex.: Epidemiologia">
    <label>Carga horária</label>
    <select id="f-ch">${chs.map(x=>`<option value="${x}" ${x==c.ch?"selected":""}>${x}h (${periodos(x)} períodos, até ${faltasMax(x)} faltas)</option>`).join("")}</select>
  </div>
  <div class="card"><h2>Dias de aula</h2><div class="meta">Dia, início e fim. O app calcula os períodos de 50 min de cada aula.</div>
    <div id="f-aulas" style="margin-top:10px"></div>
    <button class="sec mini" onclick="addAulaForm()">+ Dia de aula</button>
  </div>
  <div class="card"><h2>Avaliações</h2><div class="meta">Nome, peso (%) &mdash; os pesos devem somar 100.</div>
    <div id="f-avs" style="margin-top:10px"></div>
    <div class="linha entre"><button class="sec mini" onclick="addAvForm()">+ Avaliação</button><span id="f-soma" class="meta"></span></div>
  </div>
  <div class="linha"><button onclick="salvarForm()">Salvar</button>${tela.id?`<button class="perigo" onclick="excluir('${c.id}')">Excluir cadeira</button>`:""}</div>`;
}

/* Pequenas ações chamadas pelos handlers inline (substituem as expressões que mexiam direto em _aulasForm/_avsForm). */
export function addAulaForm(){ _aulasForm.push({dia:'Segunda',ini:'',fim:'',periodos:2}); desenharAulasForm(); }
export function campoAulaForm(i,campo,v){ _aulasForm[i][campo]=v; }
export function removerAulaForm(i){ _aulasForm.splice(i,1); desenharAulasForm(); }
export function campoAvForm(i,campo,v){ _avsForm[i][campo]=v; }
export function removerAvForm(i){ _avsForm.splice(i,1); desenharAvsForm(); }
export function campoSubForm(i,j,campo,v){ _avsForm[i].subs[j][campo]=v; }
export function removerSubForm(i,j){ _avsForm[i].subs.splice(j,1); desenharAvsForm(); }

export function desenharAulasForm(){
  const el=document.getElementById("f-aulas"); if(!el) return;
  el.innerHTML=_aulasForm.length?_aulasForm.map((a,i)=>`<div style="background:var(--primaria-clara);border-radius:12px;padding:10px;margin-bottom:8px">
    <div class="aval" style="grid-template-columns:1fr 28px;margin-bottom:6px">
    <select onchange="campoAulaForm(${i},'dia',this.value)">${DIAS.slice(0,6).map(d=>`<option ${d===a.dia?"selected":""}>${d}</option>`).join("")}</select>
    <button class="x" onclick="removerAulaForm(${i})">&times;</button></div>
    <div class="aval" style="grid-template-columns:1fr 1fr;margin-bottom:0">
    <label style="margin:0">Início<input type="time" value="${a.ini||""}" onchange="campoAulaForm(${i},'ini',this.value);desenharAulasForm()"></label>
    <label style="margin:0">Fim<input type="time" value="${a.fim||""}" onchange="campoAulaForm(${i},'fim',this.value);desenharAulasForm()"></label></div>
    <div class="meta" style="margin-top:6px;font-size:.8rem">${a.ini&&a.fim?`${periodosEntre(a.ini,a.fim)} período(s)`:`Informe início e fim${a.periodos?` (hoje: ${a.periodos} períodos)`:""}`}</div></div>`).join("")
    :`<div class="meta" style="margin-bottom:10px">Nenhum dia cadastrado.</div>`;
}
export function desenharAvsForm(){
  const el=document.getElementById("f-avs"); if(!el) return;
  el.innerHTML=_avsForm.map((a,i)=>`<div class="aval" style="grid-template-columns:1fr 80px 32px">
    <input value="${esc(a.nome)}" oninput="campoAvForm(${i},'nome',this.value)">
    <input inputmode="decimal" value="${a.peso}" oninput="campoAvForm(${i},'peso',this.value);somaForm()" placeholder="%">
    <button class="x" onclick="removerAvForm(${i})">&times;</button></div>
    <div class="linha" style="margin:-2px 0 8px"><span class="meta">Data</span><input type="date" value="${a.data||""}" oninput="campoAvForm(${i},'data',this.value)" style="padding:6px;width:auto;flex:1"></div>
    ${(a.subs||[]).map((sb,j)=>`<div class="aval" style="grid-template-columns:16px 1fr 80px 32px">
      <span class="meta">&#8627;</span>
      <input value="${esc(sb.nome)}" oninput="campoSubForm(${i},${j},'nome',this.value)">
      <input inputmode="decimal" value="${sb.peso}" oninput="campoSubForm(${i},${j},'peso',this.value);somaForm()" placeholder="%">
      <button class="x" onclick="removerSubForm(${i},${j})">&times;</button></div>`).join("")}
    <div style="margin:0 0 12px 22px"><button class="sec mini" onclick="addSub(${i})">${(a.subs||[]).length?"+ Parte":"Dividir em partes"}</button>
    ${(a.subs||[]).length?`<span class="meta" id="f-sub-${i}"></span>`:""}</div>`).join("");
  somaForm();
}
export function addSub(i){ const a=_avsForm[i]; a.subs=a.subs||[];
  if(!a.subs.length){ a.subs.push({nome:"Prova",peso:50,nota:a.nota??null},{nome:"Trabalho",peso:50,nota:null}); }
  else a.subs.push({nome:`Parte ${a.subs.length+1}`,peso:"",nota:null});
  desenharAvsForm(); }
export function somaForm(){
  _avsForm.forEach((a,i)=>{ const el=document.getElementById("f-sub-"+i); if(!el) return; const t=a.subs.reduce((x,sb)=>x+(num(sb.peso)||0),0);
    el.textContent=` Partes: ${fmt(t)}%`; el.style.color=Math.abs(t-100)<.01?"var(--ok)":"var(--erro)"; });
  const s=_avsForm.reduce((t,a)=>t+(num(a.peso)||0),0); const el=document.getElementById("f-soma"); el.textContent=`Total: ${fmt(s)}%`; el.style.color=Math.abs(s-100)<.01?"var(--ok)":"var(--erro)"; }
export function addAvForm(){ _avsForm.push({nome:`Avaliação ${_avsForm.length+1}`,peso:""}); desenharAvsForm(); }
export function salvarForm(){
  const nome=document.getElementById("f-nome").value.trim();
  if(!nome){ alertaCampo("f-nome"); return; }
  const ch=+document.getElementById("f-ch").value;
  const aulas=_aulasForm.map(a=>({dia:a.dia,ini:a.ini||"",fim:a.fim||"",periodos:a.ini&&a.fim?periodosEntre(a.ini,a.fim):(a.periodos||2)}));
  const pd=aulas[0]?aulas[0].periodos:2;
  if(tela.id){
    const c=achar(tela.id); c.nome=nome; c.ch=ch; c.periodosDia=pd; c.aulas=aulas;
    c.avaliacoes=_avsForm.map(mapAv);
  } else {
    dados.cadeiras.push({id:id(),nome,ch,periodosDia:pd,aulas,faltas:0,exame:null,avaliacoes:_avsForm.map(mapAv)});
  }
  salvar(); ir("detalhe", tela.id || dados.cadeiras[dados.cadeiras.length-1].id);
}
function mapAv(a){ const o={id:a.id||id(),nome:a.nome,peso:num(a.peso)||0,nota:a.nota??null,data:a.data||""};
  if(a.subs&&a.subs.length){ o.subs=a.subs.map(sb=>({nome:sb.nome,peso:num(sb.peso)||0,nota:sb.nota??null})); o.nota=null; }
  return o; }
export function excluir(i){ if(!confirmar("excluir")) return; dados.cadeiras=dados.cadeiras.filter(c=>c.id!==i); salvar(); ir("lista"); }
