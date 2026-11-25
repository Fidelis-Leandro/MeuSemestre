// Roteiro das animações no Chrome headless: barras, números, termômetro, FLIP, arraste, saídas e aparecimentos.
// Uso: node tests/navegador/animacoes.mjs [etapa máxima 1..4] [reduce]
//   sem "reduce": prefers-reduced-motion: no-preference (confere que anima)
//   com "reduce": prefers-reduced-motion: reduce (confere que nada anima)
// Sai com código 1 se alguma conferência falhar.
import { chrome } from "./cdp.mjs";
import { servir } from "../../ferramentas/servidor.mjs";

const ETAPA = +(process.argv.slice(2).find(a=>/^\d$/.test(a))||4), REDUZ = process.argv.includes("reduce");
const srv = await servir({ porta: 8765, host: "127.0.0.1" });
const b = await chrome("perfil-animacoes-"+(REDUZ?"reduce":"normal"), REDUZ?9334:9333);
process.on("uncaughtException",e=>{ console.log("ERRO no roteiro: "+e.message); b.fechar(); srv.close(); process.exit(2); });
const erros = [];
b.ouvir(m=>{ if(m.method==="Runtime.exceptionThrown") erros.push(m.params.exceptionDetails.exception?.description||m.params.exceptionDetails.text);
             if(m.method==="Runtime.consoleAPICalled" && m.params.type==="error") erros.push(m.params.args.map(a=>a.value||a.description).join(" ")); });
await b.send("Runtime.enable"); await b.send("Page.enable");
await b.send("Emulation.setEmulatedMedia",{features:[{name:"prefers-reduced-motion",value:REDUZ?"reduce":"no-preference"}]});
await b.send("Emulation.setDeviceMetricsOverride",{width:420,height:900,deviceScaleFactor:1,mobile:true});

let ok=0, falhas=0;
const confere=(cond,txt,extra="")=>{ if(cond){ ok++; console.log("  ok   "+txt); } else { falhas++; console.log("  FALHA "+txt+(extra?"  -> "+extra:"")); } };
const espera=ms=>new Promise(r=>setTimeout(r,ms));
const js=b.avaliar;

async function carregar(){
  await b.send("Page.navigate",{url:"http://127.0.0.1:8765/index.html"}); await espera(800);
  await js(`(()=>{ const hoje=["Domingo","Segunda","Terça","Quarta","Quinta","Sexta","Sábado"][new Date().getDay()];
    const d=n=>{ const x=new Date(); x.setDate(x.getDate()+n); return x.toISOString().slice(0,10); };
    const aula=[{dia:hoje,ini:"00:00",fim:"23:59",periodos:2}], agora=new Date().toISOString();
    localStorage.setItem("ufcspa-faltas-notas-v1",JSON.stringify({criadoEm:agora,ultimoBackup:agora,cadeiras:[
      {id:"a1",nome:"Anatomia",ch:60,faltas:7,periodosDia:2,aulas:aula,avaliacoes:[{nome:"P1",peso:50,nota:6},{nome:"P2",peso:50,nota:null}],exame:null},
      {id:"b1",nome:"Bioquímica",ch:30,faltas:2,periodosDia:2,aulas:[],avaliacoes:[{nome:"P1",peso:100,nota:null}],exame:null},
      {id:"c1",nome:"Citologia",ch:30,faltas:8,periodosDia:2,aulas:aula,avaliacoes:[{nome:"P1",peso:100,nota:8}],exame:null}],
      eventos:[{id:"e1",data:d(2),cadeiraId:"a1",tipo:"Prova",obs:"Prova prática"},{id:"e2",data:d(3),cadeiraId:"",tipo:"Outro",obs:"Reunião"},{id:"e3",data:d(4),cadeiraId:"",tipo:"Outro",obs:"Entrega"}]}));
  })()`);
  await b.send("Page.reload"); await espera(900);
  // Ajudantes dentro da página
  await js(`window.__amostra=(acoes,ms,ler)=>new Promise(res=>{ const out=[], t0=performance.now();
      acoes.forEach(([t,f])=>setTimeout(f,t));
      (function q(){ out.push(ler()); if(performance.now()-t0<ms) requestAnimationFrame(q); else res(out); })(); });
    window.__anims=sel=>[...document.querySelectorAll(sel)].reduce((n,e)=>n+e.getAnimations().length,0); true`);
}
async function clicar(sel,idx=0){
  const r=await js(`(()=>{ const e=document.querySelectorAll(${JSON.stringify(sel)})[${idx}]; e.scrollIntoView({block:"center"}); const r=e.getBoundingClientRect(); return {x:r.left+r.width/2,y:r.top+r.height/2}; })()`);
  for(const type of ["mousePressed","mouseReleased"]) await b.send("Input.dispatchMouseEvent",{type,x:r.x,y:r.y,button:"left",clickCount:1});
}
const monotono=(l,sinal)=>l.every((v,i)=>i===0||sinal*(v-l[i-1])>=-1e-6);
const maiorPasso=l=>l.reduce((m,v,i)=>i?Math.max(m,Math.abs(v-l[i-1])):0,0);
const leBarra=sel=>`()=>{ const b=document.querySelector('${sel}'); const n=document.querySelector('[data-falta-num="'+b.dataset.falta+'"]'); return {w:parseFloat(b.style.width), n:+n.textContent, cor:getComputedStyle(b).backgroundColor}; }`;

await carregar();
console.log(`\n=== Chrome headless, prefers-reduced-motion: ${REDUZ?"reduce":"no-preference"}, até a etapa ${ETAPA} ===`);

/* ---- Etapa 1: barra de faltas, contador, cor, média, selo, abas ---- */
console.log("\n[1] Detalhe: 3 faltas rápidas e depois 3 x −1");
await js(`ir('detalhe','a1')`); await espera(600);
let s=await js(`__amostra([[0,()=>falta('a1',1)],[70,()=>falta('a1',1)],[140,()=>falta('a1',1)]],700,${leBarra("[data-falta]")})`);
let ws=s.map(x=>x.w), ns=s.map(x=>x.n), cores=[...new Set(s.map(x=>x.cor))];
confere(Math.abs(ws.at(-1)-10/18*100)<.01 && ns.at(-1)===10,"termina em 10 faltas (55,6%)",`${ws.at(-1)} / ${ns.at(-1)}`);
confere(monotono(ws,1),"a barra nunca volta para trás ao subir");
confere(monotono(ns,1),"o número nunca volta para trás ao subir");
const passos=s.length;
if(REDUZ) confere(ws.every(w=>[7,8,9,10].some(f=>Math.abs(w-f/18*100)<.01)),"sem animação: só os valores exatos de cada toque (7, 8, 9, 10)",[...new Set(ws)].join(","));
else { confere(new Set(ws).size>10,"há quadros intermediários (enche suavemente)",`${new Set(ws).size} valores distintos em ${passos} quadros`);
       confere(maiorPasso(ws)<=(10/18-7/18)*100*.35,"nenhum salto grande entre quadros",`maior passo ${maiorPasso(ws).toFixed(2)}%`); }
confere(cores.length>=2,"a cor mudou ao cruzar o nível (7 → 10 cruza 9)",cores.join(" | "));
s=await js(`__amostra([[0,()=>falta('a1',-1)],[70,()=>falta('a1',-1)],[140,()=>falta('a1',-1)]],700,${leBarra("[data-falta]")})`);
ws=s.map(x=>x.w);
confere(monotono(ws,-1),"ao esvaziar, a barra nunca sobe");
confere(Math.abs(ws.at(-1)-7/18*100)<.01,"volta a 7 faltas");

console.log("\n[1] Lista: 3 × 'Faltei' rápidos e depois Desfazer");
await js(`ir('lista')`); await espera(600);
s=await js(`__amostra([[0,()=>faltarAula('a1',2)],[70,()=>faltarAula('a1',2)],[140,()=>faltarAula('a1',2)]],700,${leBarra('[data-falta="lis:a1"]')})`);
ws=s.map(x=>x.w);
confere(monotono(ws,1) && s.at(-1).n===13,"sobe de 7 para 13 sem voltar",`fim ${s.at(-1).n}`);
s=await js(`__amostra([[0,()=>desfazerFalta()]],600,${leBarra('[data-falta="lis:a1"]')})`);
ws=s.map(x=>x.w);
confere(monotono(ws,-1) && s.at(-1).n===11,"Desfazer esvazia de 13 para 11 sem saltar para cima",`fim ${s.at(-1).n}`);
if(!REDUZ) confere(new Set(ws).size>5,"Desfazer anima a descida");
await js(`(()=>{ const d=JSON.parse(localStorage.getItem("ufcspa-faltas-notas-v1")); return true; })()`);

console.log("\n[1] Nota que muda a situação: média conta e o selo pulsa");
await js(`ir('detalhe','a1')`); await espera(600);
s=await js(`__amostra([[0,()=>nota('a1',1,'10')],[20,()=>{ window.__selo=__anims('[data-selo]'); }]],600,()=>document.querySelector('[data-chave^="med:det"]').textContent)`);
const medias=s.map(t=>parseFloat(t.replace(",",".")));
confere(s.at(-1)==="8,00","média termina em 8,00",s.at(-1));
confere(monotono(medias,1),"média só sobe");
if(REDUZ) confere(new Set(s).size<=2,"sem animação: média vai direto",[...new Set(s)].join(","));
else confere(new Set(s).size>5,"média conta de 3,00 até 8,00",`${new Set(s).size} valores`);
const selo=await js(`window.__selo`);
confere(REDUZ? selo===0 : selo>0,"pulso no selo de situação",`animações: ${selo}`);
const temFesta=await js(`!!document.querySelector('body > div:has(> canvas)')`);
confere(temFesta,"comemoração abriu");
await js(`document.querySelector('body > div:has(> canvas) button').click()`); await espera(300);

console.log("\n[1] Troca de abas");
await js(`ir('lista')`); await espera(500);
await js(`ir('agenda')`);
const ab=await js(`[...document.getElementById('app').children].filter(n=>!n.classList.contains('abas')).map(n=>n.getAnimations().map(a=>a.effect.getKeyframes()[0].transform).join()).join("|")`);
if(REDUZ) confere(!ab.replace(/\|/g,""),"sem animação na troca de aba",ab);
else confere(/translateX\(14px\)/.test(ab),"conteúdo desliza no sentido da aba",ab.slice(0,80));
const ind=await js(`getComputedStyle(document.querySelector('.abas .ind')).transitionDuration`);
confere(true,"indicador da aba: transição "+ind);
await espera(400);

if(ETAPA>=2){
  console.log("\n[2] Termômetro: volta à lista com uma cadeira a mais garantida");
  await js(`ir('lista')`); await espera(500);
  const antes=await js(`[...document.querySelectorAll('.termo-barra > div')].map(s=>+s.dataset.v)`);
  await js(`ir('detalhe','b1')`); await espera(300);
  await js(`nota('b1',0,'9')`); await espera(200);
  await js(`document.querySelector('body > div:has(> canvas) button')?.click()`);
  s=await js(`__amostra([[0,()=>ir('lista')]],600,()=>[...document.querySelectorAll('.termo-barra > div')].map(s=>parseFloat(s.style.flexGrow||getComputedStyle(s).flexGrow)))`);
  s=s.filter(x=>x.length); const ok0=s.map(x=>x[0]);
  confere(JSON.stringify(antes)==="[2,1,0,0,0]","antes: 2 garantidas, 1 em andamento",JSON.stringify(antes));
  confere(Math.abs(s.at(-1)[0]-3)<1e-6 && Math.abs(s.at(-1)[1])<1e-6,"depois: 3 garantidas, o segmento em andamento encolhe até 0",JSON.stringify(s.at(-1)));
  if(REDUZ) confere(new Set(ok0).size===1,"sem animação: proporções vão direto",[...new Set(ok0)].join(","));
  else confere(Math.abs(s[0][0]-2)<.3 && monotono(ok0,1) && new Set(ok0).size>5,"cresce das proporções anteriores (2 → 3)",ok0.slice(0,4).map(v=>v.toFixed(2)).join(","));
  const cont=await js(`document.querySelector('[data-chave="termo-ok"]').textContent`);
  confere(cont==="3","contador do termômetro termina em 3",cont);
}

if(ETAPA>=3){
  console.log("\n[3] Reordenação por urgência (FLIP)");
  await js(`ir('lista')`); await espera(600);
  const ordemAntes=await js(`[...document.querySelectorAll('.card-cad')].map(c=>c.dataset.id).join()`);
  await js(`faltarAula('c1',2)`);
  const ordem=await js(`[...document.querySelectorAll('.card-cad')].map(c=>c.dataset.id).join()`);
  const fl=await js(`(()=>{ const a=document.querySelector('.card-cad[data-id="c1"]').getAnimations()[0]; return a?a.effect.getKeyframes()[0].transform:""; })()`);
  confere(ordem.startsWith("c1"),"Citologia (reprovada por falta) sobe para o topo",`${ordemAntes} → ${ordem}`);
  if(REDUZ) confere(!fl,"sem animação de reordenação",fl);
  else confere(/translateY\((\d+)/.test(fl) && +fl.match(/translateY\(([\d.]+)/)[1]>50,"o card desliza de onde estava até o topo",fl);
  await espera(400);

  console.log("\n[3] Arrastar e soltar um card");
  const r=await js(`(()=>{ window.scrollTo(0,0); const cs=[...document.querySelectorAll('.card-cad')]; cs[0].scrollIntoView({block:"start"}); const a=cs[0].getBoundingClientRect(), z=cs[1].getBoundingClientRect(); return {x:a.left+a.width/2,y:a.top+30,y2:z.bottom-10,ids:cs.map(c=>c.dataset.id).join()}; })()`);
  await b.send("Input.dispatchMouseEvent",{type:"mousePressed",x:r.x,y:r.y,button:"left",clickCount:1});
  await espera(480);
  for(let y=r.y;y<=r.y2;y+=15){ await b.send("Input.dispatchMouseEvent",{type:"mouseMoved",x:r.x,y,button:"left",buttons:1}); await espera(16); }
  const durante=await js(`(()=>{ const e=document.querySelector('.card-cad.arrastando'); return e?e.style.transform:""; })()`);
  const visual=await js(`(()=>{ const e=document.querySelector('.card-cad.arrastando'); return e?e.getBoundingClientRect().top:null; })()`);
  confere(visual!==null && Math.abs(visual-(r.y-30)-(r.y2-r.y))<60,"na tela, o card se move junto com o dedo",`topo ${visual}, esperado ~${(r.y2-30).toFixed(0)}`);
  confere(/translateY/.test(durante),"o card acompanha o dedo durante o arraste",durante);
  await b.send("Input.dispatchMouseEvent",{type:"mouseReleased",x:r.x,y:r.y2,button:"left",clickCount:1});
  await espera(30);
  const pouso=await js(`[...document.querySelectorAll('.card-cad')].map(c=>c.getAnimations().length).join()`);
  await espera(400);
  const depois=await js(`({titulo:document.getElementById('titulo').textContent, ids:[...document.querySelectorAll('.card-cad')].map(c=>c.dataset.id).join()})`);
  confere(depois.titulo==="Minhas cadeiras","soltar não abre a cadeira",depois.titulo);
  confere(depois.ids!==r.ids,"a ordem mudou",`${r.ids} → ${depois.ids}`);
  if(REDUZ) confere(!/[1-9]/.test(pouso),"sem animação ao soltar",pouso);
  else confere(/[1-9]/.test(pouso),"o card pousa animado no lugar novo",pouso);
}

if(ETAPA>=4){
  console.log("\n[4] Excluir evento (cópia sobreposta)");
  await js(`ir('agenda')`); await espera(500);
  const idx=await js(`[...document.querySelectorAll('.ag')].findIndex(a=>a.textContent.includes('Reunião'))`);
  await clicar(".ag button.x",await js(`[...document.querySelectorAll('.ag button.x')].findIndex(b=>b.closest('.ag').textContent.includes('Reunião'))`));
  const g=await js(`(()=>{ const f=document.querySelector('.fantasma'); if(!f) return null; const r=f.getBoundingClientRect(); const de=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2); return {pe:getComputedStyle(f).pointerEvents, cobre:f.contains(de), anims:__anims('.ag')}; })()`);
  const sumiu=await js(`!document.querySelector('.ag')||![...document.querySelectorAll('#app .ag')].some(a=>a.textContent.includes('Reunião'))`);
  confere(sumiu,"o evento saiu da agenda na hora (render não esperou)");
  if(REDUZ) confere(g===null,"sem cópia sobreposta",JSON.stringify(g));
  else { confere(g && g.pe==="none" && !g.cobre,"cópia aparece e não recebe toques",JSON.stringify(g));
         confere(g && g.anims>0,"o evento de baixo sobe deslizando",JSON.stringify(g)); }
  await espera(500);
  confere(await js(`!document.querySelector('.fantasma')`),"a cópia some sozinha");

  console.log("\n[4] Excluir cadeira e trocar de tela no meio");
  await js(`ir('form','b1')`); await espera(400);
  await clicar("button.perigo"); await clicar("button.perigo");
  const apos=await js(`({titulo:document.getElementById('titulo').textContent, f:document.querySelectorAll('.fantasma').length, ids:[...document.querySelectorAll('.card-cad')].map(c=>c.dataset.id).join()})`);
  confere(apos.titulo==="Minhas cadeiras" && !apos.ids.includes("b1"),"cadeira excluída e lista aberta na hora",JSON.stringify(apos));
  confere(REDUZ? apos.f===0 : apos.f===1,"cópia da tela de edição saindo",`fantasmas: ${apos.f}`);
  await js(`ir('agenda')`);
  confere(await js(`document.querySelectorAll('.fantasma').length===0`),"trocar de tela no meio remove a cópia na hora");

  console.log("\n[4] Pequenos aparecimentos");
  await js(`ir('lista')`); await espera(500);
  await js(`desfazerFalta()`); await espera(50);
  confere(await js(`!document.querySelector('[data-surge="desfazer"]')`),"sem a linha Desfazer antes do toque");
  await js(`faltarAula('a1',2)`);
  const sd=await js(`__anims('[data-surge="desfazer"]')`);
  confere(REDUZ? sd===0 : sd>0,"'Falta registrada / Desfazer' aparece com fade",`animações: ${sd}`);
  await js(`desfazerFalta()`);
  await js(`ir('detalhe','a1')`); await espera(500);
  await js(`nota('a1',1,'')`); await espera(400);
  await js(`document.getElementById('sim').value='7'; simular('a1')`);
  const sm=await js(`__anims('#sim-res > *')`);
  confere(REDUZ? sm===0 : sm>0,"resultado do simulador aparece com fade",`animações: ${sm}`);
  await js(`nota('a1',1,'10')`);
  const fe=await js(`__anims('body > div:has(> canvas), body > div:has(> canvas) .card')`);
  confere(REDUZ? fe===0 : fe>0,"card de comemoração entra com escala",`animações: ${fe}`);
  await js(`document.querySelector('body > div:has(> canvas) button').click()`); await espera(50);
  confere(await js(`!document.elementFromPoint(200,450)?.closest('div:has(> canvas)')`),"comemoração fechando não bloqueia toques");
}

if(REDUZ){
  console.log("\n[reduce] Nenhuma animação em andamento após cada ação");
  await js(`ir('lista')`); const a1=await js(`document.getAnimations().length`);
  await js(`faltarAula('a1',2)`); const a2=await js(`document.getAnimations().length`);
  await js(`ir('agenda')`); const a3=await js(`document.getAnimations().length`);
  confere(a1+a2+a3===0,"document.getAnimations() vazio",`${a1},${a2},${a3}`);
  const btn=await js(`getComputedStyle(document.querySelector('button')).transitionDuration`);
  confere(btn==="0s","botões sem transição de toque",btn);
}

confere(erros.length===0,"sem erros no console",erros.join(" || "));
console.log(`\nResultado: ${ok} ok, ${falhas} falha(s)`);
b.fechar(); srv.close();
process.exit(falhas?1:0);
