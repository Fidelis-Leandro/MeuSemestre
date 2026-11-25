// Animações: entrada das telas, indicador das abas, contadores e a comemoração de aprovação.
import { tela, render } from "./app.js";
import { dados } from "./dados.js";
import { aprovada } from "./regras.js";
import { esc } from "./util.js";

let _telaAnimada=null, _abaAnterior=null;
const semMovimento=()=>matchMedia("(prefers-reduced-motion: reduce)").matches;
function posicionarAbas(el,i,anima){
  const ind=el.querySelector(".ind"), bt=el.querySelectorAll("button")[i]; if(!ind||!bt) return;
  ind.style.transition=anima?"":"none"; ind.style.width=bt.offsetWidth+"px"; ind.style.transform=`translateX(${bt.offsetLeft-4}px)`;
}
export function efeitos(){
  const chave=tela.nome+"|"+(tela.id||""), nova=chave!==_telaAnimada; _telaAnimada=chave;
  const ab=document.querySelector(".abas[data-para]");
  if(ab){ const para=+ab.dataset.para; ab.dataset.ok="1";
    if(_abaAnterior!==null && _abaAnterior!==para && !semMovimento()){ posicionarAbas(ab,_abaAnterior,false); ab.offsetWidth; posicionarAbas(ab,para,true); }
    else posicionarAbas(ab,para,false);
    _abaAnterior=para; }
  if(!nova || semMovimento()) return;
  document.querySelectorAll("#app > .card, #app > div > .card").forEach((c,i)=>{ if(i<12){ c.classList.add("entra"); c.style.animationDelay=(i*45)+"ms"; } });
  document.querySelectorAll(".barra>div").forEach(b=>{ const w=b.style.width; b.style.transition="none"; b.style.width="0"; b.offsetWidth; b.style.transition="width .8s cubic-bezier(.2,.8,.3,1)"; b.style.width=w; });
  document.querySelectorAll(".termo-barra").forEach(t=>{ t.animate([{transform:"scaleX(0)"},{transform:"scaleX(1)"}],{duration:800,easing:"cubic-bezier(.2,.8,.3,1)"}); });
  document.querySelectorAll("[data-conta]").forEach(el=>{
    const fim=parseFloat(el.dataset.conta), dec=+el.dataset.dec, t0=performance.now(), dur=700;
    if(!fim) return;
    const f=n=>n.toLocaleString("pt-BR",{minimumFractionDigits:dec,maximumFractionDigits:dec});
    (function passo(t){ const p=Math.min(1,(t-t0)/dur), e=1-Math.pow(1-p,3); el.textContent=f(fim*e); if(p<1) requestAnimationFrame(passo); })(t0);
  });
}
export function iniciarAnimacoes(){
  addEventListener("resize",()=>{ const ab=document.querySelector(".abas[data-para]"); if(ab) posicionarAbas(ab,+ab.dataset.para,false); });
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
  if(matchMedia("(prefers-reduced-motion: reduce)").matches) return;
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
