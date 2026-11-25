// Animações: entrada das telas, abas, barras e números que vão de X para Y, e a comemoração de aprovação.
// Regra geral: o render() continua recriando o HTML; aqui só desenhamos a transição por cima, sem atrasar nada.
// Tudo respeita prefers-reduced-motion: com ele ativo, os valores vão direto para o final.
import { tela, render } from "./app.js";
import { dados } from "./dados.js";
import { aprovada, corFalta } from "./regras.js";
import { esc } from "./util.js";

const _mq=matchMedia("(prefers-reduced-motion: reduce)");
export const semMovimento=()=>_mq.matches;
const SUAVE="cubic-bezier(.2,.8,.3,1)";
const raiz=()=>document.getElementById("app");
const chaveTela=()=>tela.nome+"|"+(tela.id||"");

/* ---------- Estado das animações ----------
   Para cada chave (barra de faltas, número, selo) guardamos o valor que está NA TELA agora e o
   requestAnimationFrame em andamento. Como o render() recria os elementos, é daqui que cada animação
   sabe de onde partir. Chaves que não aparecem mais na tela são apagadas em podar(), então o Map
   nunca guarda mais do que a tela atual mostra (mais as chaves fixas do termômetro). */
const _estado=new Map();
const PERSISTENTE=k=>k.startsWith("termo");

// Único laço de animação de valores do app: barras de faltas e todos os números passam por aqui.
// Uma chave só tem um laço por vez: começar outro cancela o anterior e parte do valor atual.
function animar(chave,para,aplicar,de,dur=350){
  let st=_estado.get(chave); if(!st){ st={}; _estado.set(chave,st); }
  cancelAnimationFrame(st.raf); st.raf=0;
  const ini=de ?? st.v ?? para;
  if(semMovimento() || Math.abs(ini-para)<1e-9){ st.v=para; aplicar(para); return; }
  const t0=performance.now(); st.v=ini; aplicar(ini);
  const passo=t=>{
    const p=Math.min(1,Math.max(0,(t-t0)/dur)), e=1-Math.pow(1-p,3);
    st.v=p<1 ? ini+(para-ini)*e : para; aplicar(st.v);
    st.raf=p<1 ? requestAnimationFrame(passo) : 0;
  };
  st.raf=requestAnimationFrame(passo);
}
// De onde partir: do valor na tela, se já existe; de zero, na entrada de uma tela nova; senão, sem animação.
const origem=(chave,nova,para)=>_estado.has(chave) ? undefined : nova ? 0 : para;
const duracao=(chave,nova)=>nova && !_estado.has(chave) ? 400 : 350;

function podar(ativos){
  for(const [k,st] of _estado) if(!ativos.has(k) && !PERSISTENTE(k)){ cancelAnimationFrame(st.raf); _estado.delete(k); }
}

/* ---------- Barras de faltas ----------
   HTML: <div data-falta="tela:id" data-f="5" data-max="18"> e, opcional, <span data-falta-num="tela:id">.
   Barra e número andam no mesmo laço; a cor vem de corFalta() no número mostrado, então ela troca
   exatamente quando a barra cruza o nível (a transição de cor do CSS suaviza a troca). */
function barrasFalta(nova,ativos){
  const app=raiz();
  app.querySelectorAll("[data-falta]").forEach(b=>{
    const k=b.dataset.falta, chave="f:"+k, f=+b.dataset.f, max=+b.dataset.max;
    const num=app.querySelector(`[data-falta-num="${k}"]`);
    let cor=null;
    ativos.add(chave);
    animar(chave,f,v=>{
      const r=Math.round(v), c=corFalta(r,max);
      b.style.width=Math.min(100,v/max*100||0)+"%";
      if(c!==cor){ b.style.background=c; cor=c; }
      if(num) num.textContent=r;
    },origem(chave,nova,f),duracao(chave,nova));
  });
}

/* ---------- Números (data-conta) ---------- */
function numeros(nova,ativos){
  raiz().querySelectorAll("[data-conta][data-chave]").forEach(el=>{
    const fim=parseFloat(el.dataset.conta), dec=+el.dataset.dec||0, chave=el.dataset.chave;
    const f=n=>n.toLocaleString("pt-BR",{minimumFractionDigits:dec,maximumFractionDigits:dec});
    ativos.add(chave);
    animar(chave,fim,v=>{ el.textContent=f(v); },origem(chave,nova,fim),duracao(chave,nova));
  });
}

/* ---------- Selo de situação: pulso quando o texto muda ---------- */
export function pulsar(el){
  if(!el||semMovimento()) return;
  el.animate([{transform:"scale(1)"},{transform:"scale(1.1)"},{transform:"scale(1)"}],{duration:280,easing:"ease-out"});
}
function selos(ativos){
  raiz().querySelectorAll("[data-selo]").forEach(el=>{
    const chave="selo:"+el.dataset.selo, txt=el.textContent, st=_estado.get(chave);
    ativos.add(chave);
    if(st && st.txt!==txt) pulsar(el);
    _estado.set(chave,{txt});
  });
}

/* ---------- Abas ---------- */
let _telaAnimada=null, _abaAnterior=null;
function posicionarAbas(el,i,anima){
  const ind=el.querySelector(".ind"), bt=el.querySelectorAll("button")[i]; if(!ind||!bt) return;
  ind.style.transition=anima?"":"none"; ind.style.width=bt.offsetWidth+"px"; ind.style.transform=`translateX(${bt.offsetLeft-4}px)`;
}
// Devolve 1 ou -1 (sentido da troca de aba) ou 0 se não houve troca.
function abas(){
  const ab=raiz().querySelector(".abas[data-para]"); if(!ab) return 0;
  const para=+ab.dataset.para, ant=_abaAnterior; ab.dataset.ok="1"; _abaAnterior=para;
  if(ant!==null && ant!==para && !semMovimento()){ posicionarAbas(ab,ant,false); ab.offsetWidth; posicionarAbas(ab,para,true); return para>ant?1:-1; }
  posicionarAbas(ab,para,false); return 0;
}

/* ---------- Depois de cada render() ---------- */
export function efeitos(){
  const chave=chaveTela(), nova=chave!==_telaAnimada; _telaAnimada=chave;
  const app=raiz(), sentido=abas(), ativos=new Set();
  // Os elementos acabaram de nascer com o valor final; a classe desliga a transição de cor
  // enquanto voltamos ao valor anterior, para não aparecer um piscar de cor.
  app.classList.add("sem-trans");
  barrasFalta(nova,ativos); numeros(nova,ativos); selos(ativos);
  void app.offsetWidth; app.classList.remove("sem-trans");
  podar(ativos);
  if(!nova || semMovimento()) return;
  if(sentido){ // troca de aba: o conteúdo desliza no sentido da aba
    [...app.children].forEach(n=>{ if(!n.classList.contains("abas")) n.animate([{opacity:0,transform:`translateX(${14*sentido}px)`},{opacity:1,transform:"none"}],{duration:220,easing:SUAVE}); });
  } else {
    app.querySelectorAll("#app > .card, #app > div > .card").forEach((c,i)=>{ if(i<6){ c.classList.add("entra"); c.style.animationDelay=(i*25)+"ms"; } });
  }
  app.querySelectorAll(".termo-barra").forEach(t=>{ t.animate([{transform:"scaleX(0)"},{transform:"scaleX(1)"}],{duration:400,easing:SUAVE}); });
}
export function iniciarAnimacoes(){
  addEventListener("resize",()=>{ const ab=raiz().querySelector(".abas[data-para]"); if(ab) posicionarAbas(ab,+ab.dataset.para,false); });
}

/* ---------- Comemoração ---------- */
export function celebrar(c){
  const g=dados.cadeiras.filter(aprovada).length, n=dados.cadeiras.length;
  const fundo=document.createElement("div");
  fundo.style.cssText="position:fixed;inset:0;z-index:50;display:flex;align-items:center;justify-content:center;background:rgba(4,44,83,.35);padding:20px";
  fundo.innerHTML=`<canvas style="position:absolute;inset:0;width:100%;height:100%;pointer-events:none"></canvas>
    <div class="card" style="position:relative;max-width:340px;text-align:center;padding:26px 20px;margin:0">
      <div style="font-size:.85rem;font-weight:700;color:var(--ok-t);background:var(--ok-f);display:inline-block;padding:4px 12px;border-radius:99px">Aprovado</div>
      <h2 style="font-size:1.4rem;margin:12px 0 6px">Parabéns!</h2>
      <div>Você passou em <b>${esc(c.nome)}</b>.</div>
      <div class="meta" style="margin-top:8px">${g===n?"Era a última: semestre fechado!":`Agora são ${g} de ${n} cadeiras garantidas.`}</div>
      <button style="margin-top:16px;width:100%">Continuar</button></div>`;
  document.body.appendChild(fundo);
  const fechar=()=>{ fundo.remove(); render(); };
  fundo.querySelector("button").onclick=fechar;
  fundo.onclick=e=>{ if(e.target===fundo) fechar(); };
  if(semMovimento()) return;
  const cv=fundo.querySelector("canvas"), ctx=cv.getContext("2d"), dpr=devicePixelRatio||1;
  cv.width=innerWidth*dpr; cv.height=innerHeight*dpr; ctx.scale(dpr,dpr);
  const cores=["#FAC775","#85B7EB","#B5D4F4","#97C459","#F5C4B3","#EF9F27"];
  const ps=Array.from({length:140},()=>({x:innerWidth/2+(Math.random()-.5)*80,y:innerHeight*.45,vx:(Math.random()-.5)*12,vy:-Math.random()*13-4,r:Math.random()*Math.PI,vr:(Math.random()-.5)*.3,w:6+Math.random()*6,h:8+Math.random()*8,c:cores[Math.random()*cores.length|0]}));
  const t0=performance.now();
  (function quadro(t){
    if(!fundo.isConnected) return;
    ctx.clearRect(0,0,innerWidth,innerHeight);
    ps.forEach(p=>{ p.vy+=.35; p.vx*=.99; p.x+=p.vx; p.y+=p.vy; p.r+=p.vr;
      ctx.save(); ctx.translate(p.x,p.y); ctx.rotate(p.r); ctx.fillStyle=p.c; ctx.fillRect(-p.w/2,-p.h/2,p.w,p.h*Math.abs(Math.cos(p.r*2))); ctx.restore(); });
    if(t-t0<3500) requestAnimationFrame(quadro); else ctx.clearRect(0,0,innerWidth,innerHeight);
  })(t0);
}
