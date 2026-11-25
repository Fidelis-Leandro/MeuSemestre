// Leitura dos PDFs de plano de ensino (PDF.js em lib/) e interpretação do texto.
// Só linhasDoPDF() usa o navegador; lerPlano(), datasDoPlano() e aulasDoPlano() são puras.
import { DIAS, semAcento } from "./util.js";
import { periodosEntre } from "./regras.js";

/* ---------- Leitura de PDF ---------- */
const PDFJS=new URL("../lib/",import.meta.url).href;
// Safari antigo não sabe percorrer ReadableStream com "for await"; o PDF.js precisa disso.
function polyfillStream(){
  if(typeof ReadableStream==="undefined" || ReadableStream.prototype[Symbol.asyncIterator]) return;
  const it=async function*(){ const r=this.getReader(); try{ for(;;){ const {done,value}=await r.read(); if(done) return; yield value; } } finally{ r.releaseLock(); } };
  ReadableStream.prototype[Symbol.asyncIterator]=it; if(!ReadableStream.prototype.values) ReadableStream.prototype.values=it;
}
export async function linhasDoPDF(arquivo){
  polyfillStream();
  const pdfjs=await import(PDFJS+"pdf.min.js");
  pdfjs.GlobalWorkerOptions.workerSrc=PDFJS+"pdf-worker.js";
  const doc=await pdfjs.getDocument({data:await arquivo.arrayBuffer()}).promise;
  const linhas=[];
  for(let i=1;i<=doc.numPages;i++){
    const tc=await (await doc.getPage(i)).getTextContent();
    const grupos={};
    tc.items.forEach(it=>{ if(!it.str.trim()) return; const y=Math.round(it.transform[5]/3); (grupos[y]=grupos[y]||[]).push(it); });
    Object.keys(grupos).sort((a,b)=>b-a).forEach(y=>linhas.push(grupos[y].sort((a,b)=>a.transform[4]-b.transform[4]).map(t=>t.str.trim()).join(" ").replace(/\s+/g," ")));
  }
  return linhas;
}
/* ---------- Interpretar plano de ensino ---------- */
const ROMANOS={i:1,ii:2,iii:3,iv:4,v:5};
function limparNomeAval(tipo,desc){
  let n=desc.replace(/\s+/g," ").trim().replace(/[,.;\s]+$/,"");
  n=n.replace(/\s*(valendo|vale|com peso|de peso)\b.*$/i,"").trim();
  if(n.includes(":")) n=n.split(":")[0].trim();
  if(n.length>32){ const c=n.split(/[,.;(]/)[0].trim(); n=c.length<=32?c:""; }
  if(!n){ const t=semAcento(tipo); n=t.includes("prova")?"Prova":t.includes("trabalho")?"Trabalho":t.includes("apresenta")?"Apresentação":"Atividade"; }
  return n.charAt(0).toUpperCase()+n.slice(1);
}
function numeroDe(t){
  const s=semAcento(t);
  let m=s.match(/(?:prova|avaliacao|av)\s*0?(\d)\b/)||s.match(/\b0?(\d)\s*[ªaº]?\s*(?:prova|avaliacao)/);
  if(m) return +m[1];
  m=s.match(/\b(iv|v|i{1,3})\s*(?:prova|avaliacao)/)||s.match(/(?:prova|avaliacao)\s+(iv|v|i{1,3})\b/);
  return m?ROMANOS[m[1]]:null;
}
export function lerPlano(linhas){
  const txt=linhas.join("\n");
  const pega=re=>{ const m=txt.match(re); return m?m[1].trim():""; };
  const codigo=pega(/C[óo]digo da Disciplina:\s*([A-Z]{2,5}\d{3,6})/);
  const nome=pega(/Nome da Disciplina:\s*(.+)/);
  if(!codigo && !nome) return null;
  const ch=+pega(/Carga Hor[áa]ria Total \(horas\):\s*(\d+)/)||60;
  const ano=+pega(/\bANO:\s*(\d{4})/)||new Date().getFullYear();
  const aulas=[]; const diasTxt=pega(/Dia\(s\) da Semana:\s*(.+)/);
  for(const m of diasTxt.matchAll(/(Segunda|Terça|Quarta|Quinta|Sexta|Sábado|Domingo)\S*\s*\((\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})\)/g)){
    const ini=`${m[2].padStart(2,"0")}:${m[3]}`, fim=`${m[4].padStart(2,"0")}:${m[5]}`; aulas.push({dia:m[1],ini,fim,periodos:periodosEntre(ini,fim)});
  }
  // avaliações
  const ini=linhas.findIndex(l=>/Crit[ée]rios de Avalia/i.test(l)); let avaliacoes=[];
  if(ini>=0){
    let bloco=[]; for(let i=ini+1;i<linhas.length;i++){ const l=linhas[i]; if(/^(Bibliografia|Recupera|Observa|BLOCO|Plano de Ensino|Cronograma)/i.test(l)) break; bloco.push(l); }
    const itens=[]; bloco.forEach(l=>{ if(/^[A-ZÀ-Ú][^\-]{1,45}?\s-\s/.test(l)||!itens.length) itens.push(l); else itens[itens.length-1]+=" "+l; });
    itens.forEach(it=>{
      const m=it.match(/^(.+?)\s-\s(.+)$/); if(!m) return;
      const pesos=[...it.matchAll(/de peso\s*(\d+(?:[.,]\d+)?)/gi)]; if(!pesos.length) return;
      const tipo=m[1].trim(), desc=m[2].replace(/,\s*de peso\s*\d+(?:[.,]\d+)?\s*%?\.?\s*$/i,"");
      const peso=parseFloat(pesos[pesos.length-1][1].replace(",","."));
      const pct=desc.match(/(\d+(?:[.,]\d+)?)\s*%/);
      avaliacoes.push({tipo,nome:limparNomeAval(tipo,desc),peso,pct:pct?parseFloat(pct[1].replace(",",".")):0,texto:tipo+" "+desc});
    });
    if(avaliacoes.length && avaliacoes.every(a=>!a.peso)) avaliacoes.forEach(a=>a.peso=a.pct);
    const soma=avaliacoes.reduce((t,a)=>t+a.peso,0);
    if(soma>0){ let acc=0; avaliacoes.forEach((a,i)=>{ a.peso=i<avaliacoes.length-1?Math.round(a.peso*1000/soma)/10:Math.round((100-acc)*10)/10; acc+=a.peso; }); }
    const vistos={}; avaliacoes.forEach(a=>{ const k=a.nome.toLowerCase(); vistos[k]=(vistos[k]||0)+1; if(vistos[k]>1) a.nome+=" "+vistos[k]; });
  }
  // cronograma
  const reData=new RegExp(`^(\\d{2})/(\\d{2})(?:/(\\d{2,4}))?\\s+(${DIAS.join("|")})\\b\\s*(.*)$`);
  const ci=linhas.findIndex(l=>/CRONOGRAMA/i.test(l)); const fim=linhas.findIndex((l,i)=>i>ci&&/^Data de Conclus/i.test(l));
  const corpo=ci>=0?linhas.slice(ci,fim>0?fim:linhas.length).filter(l=>!/^(Plano de Ensino|PROGRAD\/PROPPGI|\d+\s*\/\s*\d+)$/.test(l.trim())):[];
  const idx=[]; corpo.forEach((l,i)=>{ if(reData.test(l)) idx.push(i); });
  const aulasPlano=idx.map((p,k)=>{
    const de=k?Math.floor((idx[k-1]+p)/2)+1:p, ate=k<idx.length-1?Math.floor((p+idx[k+1])/2):Math.min(corpo.length-1,p+4);
    const m=corpo[p].match(reData), resto=m[5];
    const tm=resto.match(/^((?:[A-Z])(?:\s*,\s*[A-Z])*)(?=\s|$)/);
    return {data:`${m[3]?(m[3].length===2?"20"+m[3]:m[3]):ano}-${m[2]}-${m[1]}`,dia:m[4],turmas:tm?tm[1].split(/\s*,\s*/):[],texto:corpo.slice(de,ate+1).join(" ")};
  });
  const turmas=[...new Set(aulasPlano.filter(a=>a.turmas.length===1).map(a=>a.turmas[0]))].sort();
  return {codigo,nome,ch,aulas,avaliacoes,aulasPlano,turmas:turmas.length>1?turmas:[],turma:turmas.length>1?turmas[0]:null,marcada:true,ead:true,datas:true};
}
export function datasDoPlano(p){
  const rows=p.aulasPlano.filter(a=>!p.turma||!a.turmas.length||a.turmas.includes(p.turma));
  const s=r=>semAcento(r.texto);
  const exame=rows.find(r=>/\bexame\b/.test(s(r)) && !/para o exame|orientac/.test(s(r)));
  const provas=rows.filter(r=>r!==exame && /\bprova\b|\bavaliacao\b/.test(s(r)) && !/revis|correc|vista|devolu|plano de ensino|metodo de avaliacao|avaliacao formativa/.test(s(r)));
  const ehEad=r=>/moodle|distancia|\bead\b/.test(s(r)) && !/\bpresencial\b/.test(s(r).replace(/presencial\./g,""));
  const presenciais=new Set(rows.filter(r=>!ehEad(r)).map(r=>r.data));
  const ead=[...new Map(rows.filter(r=>ehEad(r)&&!presenciais.has(r.data)&&r!==exame).map(r=>[r.data,r])).values()];
  const usados=new Set(), datas={};
  const ehProva=a=>/prova|avalia/.test(semAcento(a.texto)) && !/trabalho|semin|apresenta|questionar|atividades de aula/.test(semAcento(a.nome));
  p.avaliacoes.forEach((a,i)=>{ if(!ehProva(a)) return; const n=numeroDe(a.nome);
    let r=n?provas.find(r=>!usados.has(r)&&numeroDe(r.texto)===n):null;
    if(!r) r=provas.find(r=>!usados.has(r)); if(r){ usados.add(r); datas[i]=r.data; } });
  return {datas,exame:exame?exame.data:null,ead};
}
export function aulasDoPlano(p){
  const rows=p.aulasPlano.filter(a=>(!p.turma||!a.turmas.length||a.turmas.includes(p.turma)) && !/moodle|distancia/.test(semAcento(a.texto)));
  const cont={}; rows.forEach(r=>cont[r.dia]=(cont[r.dia]||0)+1);
  const dias=DIAS.filter(d=>(cont[d]||0)>=3);
  if(!dias.length) return p.aulas;
  const padrao=p.aulas[0]?p.aulas[0].periodos:2;
  return dias.map(d=>{ const a=p.aulas.find(x=>x.dia===d);
    const conta={}; rows.filter(r=>r.dia===d).forEach(r=>{ const m=r.texto.match(/(\d{2}:\d{2})\s*-\s*(?:.*?\s)?(\d{2}:\d{2})/); if(m&&m[1]<m[2]){ const k=m[1]+"-"+m[2]; conta[k]=(conta[k]||0)+1; } });
    const k=Object.keys(conta).sort((x,y)=>conta[y]-conta[x])[0];
    // O horário real da aula presencial vem do cronograma (o cabeçalho pode incluir a parte EAD pelo Moodle).
    if(k && conta[k]>=2){ const [ini,fim]=k.split("-"); return {dia:d,ini,fim,periodos:periodosEntre(ini,fim)}; }
    if(a) return a;
    if(k){ const [ini,fim]=k.split("-"); return {dia:d,ini,fim,periodos:periodosEntre(ini,fim)}; }
    return {dia:d,ini:"",fim:"",periodos:padrao}; });
}
