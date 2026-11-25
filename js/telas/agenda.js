// Agenda (avaliações com data + eventos avulsos) e a tela "Novo evento".
import { ir, render, abas, alertaCampo } from "../app.js";
import { dados, salvar, achar } from "../dados.js";
import { notaDe } from "../regras.js";
import { id, esc, dataDe, diasAte, quando, MESES } from "../util.js";

const TIPOS=["Prova","Trabalho","Seminário","Aula prática","Aula EAD","Sem aula","Data limite","Outro"];
export function itensAgenda(){
  const it=[];
  dados.cadeiras.forEach(c=>c.avaliacoes.forEach(a=>{ if(a.data) it.push({data:a.data,cadeira:c.nome,cid:c.id,tipo:"Avaliação",titulo:a.nome,lancada:notaDe(a)!==null}); }));
  dados.eventos.forEach(e=>{ const c=achar(e.cadeiraId); it.push({data:e.data,cadeira:c?c.nome:"Geral",cid:c?c.id:null,tipo:e.tipo,titulo:e.obs||e.tipo,evento:e.id}); });
  return it.sort((a,b)=>a.data.localeCompare(b.data));
}
export function itemAgendaHTML(x){
  const n=diasAte(x.data), d=dataDe(x.data);
  const cls=n<0?"ag-passou":n<=1?"ag-hoje":n<=6?"ag-semana":"";
  return `<div class="ag ${n<0?"ag-passou":""}">
    <div class="ag-data ${cls}"><b>${d.getDate()}</b><span>${MESES[d.getMonth()]}</span></div>
    <div style="flex:1;cursor:${x.cid?"pointer":"default"}" ${x.cid?`onclick="ir('detalhe','${x.cid}')"`:""}>
      <div class="tag">${esc(x.tipo)} &middot; ${quando(n)}</div>
      <div style="font-weight:700">${esc(x.titulo)}</div>
      <div class="meta">${esc(x.cadeira)}${x.lancada?" &middot; nota lançada":""}</div></div>
    ${x.evento?`<button class="x" onclick="excluirEvento('${x.evento}')">&times;</button>`:""}</div>`;
}

export function telaAgenda(){
  const it=itensAgenda(), sem=it.filter(x=>{const n=diasAte(x.data);return n>=0&&n<=6;}), prox=it.filter(x=>diasAte(x.data)>6), pas=it.filter(x=>diasAte(x.data)<0).reverse();
  let h=abas("agenda")+`<div class="linha entre" style="margin-bottom:14px"><span class="meta">${it.length} item(ns)</span><button onclick="ir('evento')">+ Evento</button></div>`;
  if(!it.length) return h+`<div class="card vazio">Nada na agenda ainda.<br>Adicione datas nas avaliações (Editar cadeira) ou crie um evento.</div>`;
  const bloco=(t,l)=>l.length?`<div class="card"><h2>${t}</h2>${l.map(itemAgendaHTML).join("")}</div>`:"";
  return h+bloco("Esta semana",sem)+bloco("Próximas semanas",prox)+bloco("Já passou",pas);
}
export function telaEvento(){
  return `<div class="card">
    <label>Data</label><input type="date" id="e-data">
    <label>Cadeira</label><select id="e-cad"><option value="">Geral (sem cadeira)</option>${dados.cadeiras.map(c=>`<option value="${c.id}">${esc(c.nome)}</option>`).join("")}</select>
    <label>Tipo</label><select id="e-tipo">${TIPOS.map(t=>`<option>${t}</option>`).join("")}</select>
    <label>Observação</label><input id="e-obs" placeholder="Ex.: entregar relatório impresso">
  </div><button onclick="salvarEvento()">Salvar evento</button>`;
}
export function salvarEvento(){
  const data=document.getElementById("e-data").value; if(!data){ alertaCampo("e-data"); return; }
  dados.eventos.push({id:id(),data,cadeiraId:document.getElementById("e-cad").value,tipo:document.getElementById("e-tipo").value,obs:document.getElementById("e-obs").value.trim()});
  salvar(); ir("agenda");
}
export function excluirEvento(e){ dados.eventos=dados.eventos.filter(x=>x.id!==e); salvar(); render(); }
