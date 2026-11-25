// Tela inicial: lista de cadeiras, cartão "Hoje", termômetro do semestre, cartões de backup e reordenação por arraste.
import { ir, render, abas } from "../app.js";
import { dados, salvar, achar, diasDesde } from "../dados.js";
import { periodos, faltasMax, situacao, calcularNotas, porUrgencia, corFalta } from "../regras.js";
import { esc, fmt2, diasAte, hojeStr, DIA_JS } from "../util.js";
import { itensAgenda, itemAgendaHTML } from "./agenda.js";

export function telaLista(){
  const prox=itensAgenda().filter(x=>diasAte(x.data)>=0 && x.tipo==="Avaliação" && !x.lancada).slice(0,3);
  let h=abas("lista")+avisoBackup()+cartaoHoje()+termometro()+(prox.length?`<div class="card"><div class="linha entre"><h2>Próximas avaliações</h2><button class="sec mini" onclick="ir('agenda')">Ver agenda</button></div>${prox.map(itemAgendaHTML).join("")}</div>`:"")+`<div class="linha entre" style="margin-bottom:14px"><span class="meta">${dados.cadeiras.length} cadeira(s)</span><div class="linha"><button class="sec" onclick="document.getElementById('pdf-in').click()">Importar planos de ensino</button><button onclick="ir('form')">+ Nova cadeira</button></div></div>
  <input type="file" id="pdf-in" accept="application/pdf,.pdf" multiple style="display:none" onchange="importarPlanos(this.files);this.value=''">
  <div id="imp-msg"></div>`;
  if(!dados.cadeiras.length) return abas("lista")+`
    <div class="card" style="text-align:center;padding:24px 18px">
      <h2 style="font-size:1.25rem">Comece pelo seu semestre</h2>
      <div class="meta" style="margin:6px 0 18px">Cadastre suas cadeiras para acompanhar faltas, notas e provas.</div>
      <div style="background:var(--primaria-clara);border-radius:14px;padding:16px;text-align:left">
        <div class="tag" style="margin-bottom:4px">Mais rápido</div>
        <div style="font-weight:700;font-size:1.05rem;color:var(--primaria)">Importar os planos de ensino</div>
        <div class="meta" style="margin:6px 0 12px">Baixe o <b>Plano de Ensino</b> de cada cadeira em PDF (no Moodle ou com o professor) e escolha todos de uma vez. O app cadastra as cadeiras com carga horária, horários, avaliações, pesos e datas de prova. O plano é um documento público da disciplina, sem dados pessoais.</div>
        <button style="width:100%" onclick="document.getElementById('pdf-in').click()">Escolher os planos de ensino (PDF)</button>
      </div>
      <div class="meta" style="margin:14px 0 8px">ou</div>
      <button class="sec" style="width:100%" onclick="ir('form')">Cadastrar uma cadeira manualmente</button>
    </div>
    <input type="file" id="pdf-in" accept="application/pdf,.pdf" multiple style="display:none" onchange="importarPlanos(this.files);this.value=''">
    <div id="imp-msg"></div>`+cardBackup();
  const manual=dados.ordem==="manual";
  h+=`<div class="meta" style="font-size:.8rem;margin:4px 0 10px">Segure um card e arraste para mudar a ordem.</div><div id="lista-cad">`;
  (manual?dados.cadeiras:porUrgencia(dados.cadeiras)).forEach(c=>{
    const max=faltasMax(c.ch), s=situacao(c), n=calcularNotas(c);
    const pct=Math.min(100,c.faltas/max*100||0);
    h+=`<div class="card card-cad" data-id="${c.id}" onclick="abrirCadeira('${c.id}')" style="cursor:pointer">
      <div class="rotulo">${c.ch}h &middot; ${periodos(c.ch)} períodos</div>
      <div class="nome-cad">${esc(c.nome)}</div>
      <div class="meta">Faltas lançadas: <span data-falta-num="lis:${c.id}">${c.faltas}</span> de ${max}</div>
      <div class="barra"><div data-falta="lis:${c.id}" data-f="${c.faltas}" data-max="${max}" style="width:${pct}%;background:${corFalta(c.faltas,max)}"></div></div>
      <span class="status ${s.cls}" data-selo="lis:${c.id}">${s.txt}</span>
      <div class="media-linha"><span>Média</span><span data-conta="${n.pontos}" data-dec="2" data-chave="med:lis:${c.id}">${fmt2(n.pontos)}</span></div>
      <div class="meta">${s.det}</div></div>`;
  });
  return h+`</div>`+cardBackup();
}

/* ---------- Reordenar arrastando ---------- */
// Um toque longo começa o arraste; o clique que vem logo depois não deve abrir a cadeira.
let _arrastou=false;
export function abrirCadeira(cid){ if(!_arrastou) ir('detalhe',cid); }
export function iniciarArraste(){
  let el=null, timer=null, inicioY=0, inicioX=0, pegaY=0, ativo=false;
  const lista=()=>document.getElementById("lista-cad");
  function comecar(e){
    const card=e.target.closest(".card-cad"); if(!card || e.target.closest("button,input")) return;
    el=card; inicioY=e.clientY; inicioX=e.clientX; _arrastou=false;
    timer=setTimeout(()=>{ ativo=true; _arrastou=true;
      if(dados.ordem!=="manual"){ dados.cadeiras=[...lista().querySelectorAll(".card-cad")].map(n=>achar(n.dataset.id)); dados.ordem="manual"; }
      pegaY=inicioY-el.getBoundingClientRect().top; el.classList.add("arrastando");
      if(navigator.vibrate) navigator.vibrate(15); },380);
  }
  function mover(e){
    if(!el) return;
    if(!ativo){ if(Math.abs(e.clientY-inicioY)>8||Math.abs(e.clientX-inicioX)>8){ clearTimeout(timer); el=null; } return; }
    el.style.transform=""; const topo=el.getBoundingClientRect().top;
    el.style.transform=`translateY(${e.clientY-pegaY-topo}px) scale(1.02)`;
    const ant=el.previousElementSibling, prox=el.nextElementSibling;
    if(ant){ const r=ant.getBoundingClientRect(); if(e.clientY<r.top+r.height/2){ lista().insertBefore(el,ant); return mover(e); } }
    if(prox){ const r=prox.getBoundingClientRect(); if(e.clientY>r.top+r.height/2){ lista().insertBefore(prox,el); return mover(e); } }
    const m=60; if(e.clientY<m) scrollBy(0,-8); else if(e.clientY>innerHeight-m) scrollBy(0,8);
  }
  function soltar(){
    clearTimeout(timer);
    if(el && ativo){
      el.classList.remove("arrastando"); el.style.transform="";
      dados.cadeiras=[...lista().querySelectorAll(".card-cad")].map(n=>achar(n.dataset.id)); dados.ordem="manual"; salvar();
      setTimeout(()=>{ _arrastou=false; render(); },0);
    }
    el=null; ativo=false;
  }
  addEventListener("pointerdown",comecar);
  addEventListener("pointermove",mover);
  addEventListener("pointerup",soltar); addEventListener("pointercancel",soltar);
  addEventListener("touchmove",e=>{ if(ativo) e.preventDefault(); },{passive:false});
  addEventListener("contextmenu",e=>{ if(e.target.closest(".card-cad")) e.preventDefault(); });
}

/* ---------- Hoje e aula de agora ---------- */
function semAulaEm(c,iso){ return dados.eventos.some(e=>e.cadeiraId===c.id&&e.data===iso&&e.tipo==="Sem aula"); }
function aulasDoDia(dia,iso){
  const l=[]; dados.cadeiras.forEach(c=>(c.aulas||[]).forEach(a=>{ if(a.dia===dia && !(iso&&semAulaEm(c,iso))) l.push({c,a}); }));
  return l.sort((x,y)=>(x.a.ini||"99").localeCompare(y.a.ini||"99"));
}
let _ultimaFalta=null;
export function faltarHoje(){
  const l=aulasDoDia(DIA_JS[new Date().getDay()],hojeStr()); if(!l.length) return;
  _ultimaFalta=l.map(x=>({id:x.c.id,n:x.a.periodos})); l.forEach(x=>x.c.faltas+=x.a.periodos); salvar(); render();
}
export function faltarAula(cid,n){ const c=achar(cid); _ultimaFalta=[{id:cid,n}]; c.faltas+=n; salvar(); render(); }
export function desfazerFalta(){ if(!_ultimaFalta) return; _ultimaFalta.forEach(x=>{ const c=achar(x.id); if(c) c.faltas=Math.max(0,c.faltas-x.n); }); _ultimaFalta=null; salvar(); render(); }
function cartaoHoje(){
  if(!dados.cadeiras.some(c=>(c.aulas||[]).length)) return "";
  const agora=new Date(), dia=DIA_JS[agora.getDay()], hm=agora.toTimeString().slice(0,5);
  const hoje=aulasDoDia(dia,hojeStr());
  const atual=hoje.find(x=>x.a.ini&&x.a.ini<=hm&&hm<x.a.fim);
  let prox=null;
  for(let k=0;k<8&&!prox;k++){ const d=new Date(agora); d.setDate(d.getDate()+k); const iso=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
    prox=aulasDoDia(DIA_JS[d.getDay()],iso).find(x=>x.a.ini&&(k>0||x.a.ini>hm)); if(prox) prox.k=k; }
  const quando=k=>k===0?"hoje":k===1?"amanhã":DIA_JS[(agora.getDay()+k)%7].toLowerCase();
  let h=`<div class="card"><div class="linha entre"><h2>Hoje</h2><span class="meta">${dia.toLowerCase()}</span></div>`;
  if(atual) h+=`<div class="destaque" style="display:flex;justify-content:space-between;align-items:center;gap:10px"><div><div class="tag">Agora</div><div style="font-weight:700">${esc(atual.c.nome)}</div><div class="meta">${atual.a.ini}–${atual.a.fim}</div></div><button class="mini" onclick="faltarAula('${atual.c.id}',${atual.a.periodos})">Faltei (+${atual.a.periodos})</button></div>`;
  if(prox) h+=`<div class="meta" style="margin-top:10px">Próxima: <b style="color:var(--texto)">${esc(prox.c.nome)}</b>, ${quando(prox.k)} ${prox.a.ini}</div>`;
  if(hoje.length){
    h+=`<div style="margin-top:10px">${hoje.map(x=>`<div class="linha entre" style="padding:6px 0;border-bottom:1px solid var(--borda)"><span>${esc(x.c.nome)}</span><span class="meta">${x.a.ini?x.a.ini+"–"+x.a.fim:""} &middot; ${x.a.periodos}p</span></div>`).join("")}</div>`;
    const tot=hoje.reduce((t,x)=>t+x.a.periodos,0);
    h+=`<button style="width:100%;margin-top:12px" onclick="faltarHoje()">Faltei hoje (+${tot} falta${tot>1?"s":""} em ${hoje.length} cadeira${hoje.length>1?"s":""})</button>`;
  } else h+=`<div class="meta" style="margin-top:6px">Sem aulas hoje.</div>`;
  if(_ultimaFalta) h+=`<div class="linha entre" style="margin-top:10px"><span class="meta">Falta registrada.</span><button class="sec mini" onclick="desfazerFalta()">Desfazer</button></div>`;
  return h+`</div>`;
}

/* ---------- Termômetro do semestre ---------- */
function termometro(){
  const n=dados.cadeiras.length; if(!n) return "";
  const g={ok:0,atencao:0,exame:0,erro:0,neutro:0};
  dados.cadeiras.forEach(c=>{ g[situacao(c).cls.slice(2)]++; });
  // Os 5 segmentos existem sempre (os vazios com flex 0), para o termômetro poder crescer das proporções
  // anteriores (animacoes.js). O espaço de 3px entre eles é margem, e não gap, para sumir junto com o segmento.
  const ORDEM=["ok","atencao","exame","erro","neutro"], primeiro=ORDEM.find(k=>g[k]);
  const seg=(k,cor)=>`<div data-seg="${k}" data-v="${g[k]}" style="flex:${g[k]} 1 0%;min-width:0;margin-left:${g[k]&&k!==primeiro?3:0}px;background:${cor}"></div>`;
  const leg=(k,cor,t)=>g[k]?`<span style="display:inline-flex;align-items:center;gap:5px;margin-right:12px"><i style="width:10px;height:10px;border-radius:3px;background:${cor};display:inline-block"></i>${g[k]} ${t}</span>`:"";
  const frase = g.ok===n ? "Semestre garantido. Todas as cadeiras aprovadas!" : g.ok ? `Faltam ${n-g.ok} para fechar o semestre.` : "Nenhuma cadeira garantida ainda. Bora!";
  return `<div class="card">
    <div class="linha entre"><h2>Seu semestre</h2><span style="font-weight:800;color:var(--primaria);font-size:1.1rem"><span data-conta="${g.ok}" data-dec="0" data-chave="termo-ok">${g.ok}</span> de ${n}</span></div>
    <div class="meta">cadeiras garantidas &middot; ${frase}</div>
    <div class="termo-barra" style="display:flex;height:16px;border-radius:99px;overflow:hidden;margin:12px 0 10px;background:var(--primaria-clara);transform-origin:left">
      ${seg("ok","var(--ok)")}${seg("atencao","var(--barra-cor)")}${seg("exame","var(--atencao)")}${seg("erro","var(--erro)")}${seg("neutro","var(--borda)")}
    </div>
    <div class="meta" style="font-size:.8rem">${leg("ok","var(--ok)","garantida(s)")}${leg("atencao","var(--barra-cor)","em andamento")}${leg("exame","var(--atencao)","rumo ao exame")}${leg("erro","var(--erro)","em risco")}${leg("neutro","var(--borda)","sem notas")}</div>
  </div>`;
}

/* ---------- Cartões de backup ---------- */
function avisoBackup(){
  if(!dados.cadeiras.length) return "";
  const d=diasDesde(dados.ultimoBackup), base=diasDesde(dados.criadoEm);
  if(d===null ? base<7 : d<7) return "";
  const txt=d===null?"Você ainda não fez nenhum backup.":`Faz ${d} dias desde o último backup.`;
  return `<div class="card" style="border-color:var(--atencao);background:var(--aviso-fundo)">
    <div style="font-weight:700">${txt}</div>
    <div class="meta" style="margin:4px 0 10px">Salve um backup para não perder suas notas e faltas se trocar de celular ou limpar o navegador.</div>
    <button onclick="salvarBackup()">Salvar backup agora</button></div>`;
}
function cardBackup(){
  const d=diasDesde(dados.ultimoBackup);
  return `<div class="card"><h2>Backup</h2>
    <div class="meta" style="margin-bottom:10px">${d===null?"Nenhum backup salvo ainda.":d===0?"Último backup: hoje.":`Último backup: há ${d} dia(s).`}
    Guarde o arquivo no Google Drive, no e-mail ou no WhatsApp para restaurar em outro aparelho.</div>
    <div class="linha"><button onclick="salvarBackup()">Salvar backup</button>
    <button class="sec" onclick="document.getElementById('bk-in').click()">Restaurar backup</button></div>
    <input type="file" id="bk-in" accept=".json,application/json" style="display:none" onchange="lerBackup(this.files[0]);this.value=''">
    <div id="bk-msg"></div></div>`;
}
