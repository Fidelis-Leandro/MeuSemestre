// Leitura dos PDFs de plano de ensino (PDF.js em lib/) e interpretação do texto.
// Só lerPDF() e linhasDoPDF() usam o navegador; o resto é puro (testado com node --test).
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
// Junta os trechos de texto de uma página ({s,x,y}) em linhas, de cima para baixo e da esquerda para a direita.
export function linhasDosTextos(textos){
  const grupos={};
  textos.forEach(t=>{ if(!t.s.trim()) return; const y=Math.round(t.y/3); (grupos[y]=grupos[y]||[]).push(t); });
  return Object.keys(grupos).sort((a,b)=>b-a).map(y=>grupos[y].sort((a,b)=>a.x-b.x).map(t=>t.s.trim()).join(" ").replace(/\s+/g," "));
}
// Devolve {linhas, tabela}: o texto em linhas (como sempre) e, a partir da página do cronograma, as linhas da tabela
// montadas pelas células desenhadas no PDF (retângulos preenchidos + cor). Se algo der errado, tabela=null.
export async function lerPDF(arquivo){
  polyfillStream();
  const pdfjs=await import(PDFJS+"pdf.min.js");
  pdfjs.GlobalWorkerOptions.workerSrc=PDFJS+"pdf-worker.js";
  const doc=await pdfjs.getDocument({data:await arquivo.arrayBuffer()}).promise;
  // getOperatorList é a parte cara: só nas páginas do cronograma (até "Data de Conclusão") e sem anotações.
  const opcoes=pdfjs.AnnotationMode?{annotationMode:pdfjs.AnnotationMode.DISABLE}:{};
  const linhas=[], paginas=[]; let noCronograma=false, acabou=false, falhou=false;
  for(let i=1;i<=doc.numPages;i++){
    const pg=await doc.getPage(i);
    const textos=(await pg.getTextContent()).items.map(it=>({s:it.str,x:it.transform[4],y:it.transform[5]}));
    const daPagina=linhasDosTextos(textos); linhas.push(...daPagina);
    noCronograma=noCronograma||daPagina.some(l=>/CRONOGRAMA/i.test(l));
    if(noCronograma&&!acabou&&!falhou) try{ paginas.push({textos,rets:retangulos(await pg.getOperatorList(opcoes),pdfjs.OPS)}); }catch(e){ falhou=true; }
    acabou=acabou||(noCronograma&&daPagina.some(l=>/^Data de Conclus/i.test(l)));
  }
  let tabela=null;
  if(!falhou&&paginas.length) try{ tabela=linhasDaTabela(paginas); }catch(e){ tabela=null; }
  return {linhas,tabela};
}
export async function linhasDoPDF(arquivo){ return (await lerPDF(arquivo)).linhas; }

function corHex(a){
  if(typeof a[0]==="string") return a[0].toLowerCase();
  const h=v=>Math.max(0,Math.min(255,Math.round(v))).toString(16).padStart(2,"0"); return "#"+h(a[0])+h(a[1])+h(a[2]);
}
// Retângulos desenhados na página ({x0,y0,x1,y1,cor}), pela lista de operações do PDF.js. cor é a de preenchimento,
// ou null quando o retângulo só tem contorno (o cabeçalho da tabela é assim).
// Nas versões novas, constructPath traz a operação de pintura em args[0]; nas antigas, ela vem na operação seguinte.
export function retangulos(ol,OPS){
  const PINTA=new Set([OPS.fill,OPS.eoFill,OPS.fillStroke,OPS.eoFillStroke,OPS.closeFillStroke,OPS.closeEOFillStroke]);
  const CONTORNO=new Set([OPS.stroke,OPS.closeStroke]);
  const rets=[], pilha=[]; let cor=null;
  for(let k=0;k<ol.fnArray.length;k++){
    const fn=ol.fnArray[k], a=ol.argsArray[k];
    if(fn===OPS.save) pilha.push(cor);
    else if(fn===OPS.restore){ if(pilha.length) cor=pilha.pop(); }
    else if(fn===OPS.setFillRGBColor) cor=corHex(a);
    else if(fn===OPS.setFillGray) cor=corHex([a[0]*255,a[0]*255,a[0]*255]);
    else if(fn===OPS.constructPath){
      const op=typeof a[0]==="number"?a[0]:ol.fnArray[k+1], mm=a[2];
      if((PINTA.has(op)||CONTORNO.has(op))&&mm&&mm.length>=4) rets.push({x0:mm[0],y0:mm[1],x1:mm[2],y1:mm[3],cor:PINTA.has(op)?cor:null});
    }
  }
  return rets;
}

/* ---------- Tabela do cronograma pelas células ---------- */
const COLUNAS=[["data",/^data$/],["dia",/^dia/],["horario",/^horario/],["turma",/^turma/],["conteudo",/^conteudo/],["aula",/^aula/],
  ["modalidade",/^modalida/],["categoria",/^categoria/],["local",/^local/],["professor",/^professor/]];
// Cores da legenda do sistema acadêmico; se a legenda estiver no PDF, ela é que vale.
const CORES={"#e8f5e9":"avaliacao","#ffebee":"exame","#e3f2fd":"substitutiva"};
const RE_DATA_CEL=/^\d{2}\/\d{2}(\/\d{2,4})?$/;
// Recebe [{rets,textos}] por página e devolve as linhas com data, cada uma com as colunas do cabeçalho e a cor:
// {data, dia, horario, turma?, conteudo, aula, modalidade, categoria, local, professor, cor: "avaliacao"|"exame"|"substitutiva"|null}.
// O cabeçalho e a legenda não entram. As colunas do cabeçalho valem para as páginas seguintes.
export function linhasDaTabela(paginas){
  let colunas=null; const cores={...CORES}, linhas=[];
  for(const {rets,textos} of paginas){
    // Uma célula por retângulo (sem fios de borda); se o mesmo retângulo tem preenchimento e contorno, vale o preenchido.
    const porChave=new Map();
    rets.forEach(r=>{ if(r.x1-r.x0<8||r.y1-r.y0<6) return; const k=[r.x0,r.y0,r.x1,r.y1].map(Math.round).join(); const j=porChave.get(k); if(!j||(!j.cor&&r.cor)) porChave.set(k,r); });
    const celulas=[...porChave.values()].map(r=>({...r,txt:[]}));
    if(!celulas.length) continue;
    // Cada trecho de texto vai para a menor célula que o contém.
    textos.forEach(t=>{ if(!t.s.trim()) return; let m=null, am=Infinity;
      celulas.forEach(c=>{ if(t.x>=c.x0-1&&t.x<=c.x1+1&&t.y>=c.y0-1&&t.y<=c.y1+1){ const a=(c.x1-c.x0)*(c.y1-c.y0); if(a<am){ am=a; m=c; } } });
      if(m) m.txt.push(t); });
    const filas={}; celulas.forEach(c=>{ const k=Math.round(c.y0)+"|"+Math.round(c.y1); (filas[k]=filas[k]||[]).push(c); });
    Object.values(filas).sort((a,b)=>b[0].y1-a[0].y1).forEach(f=>{
      f.sort((a,b)=>a.x0-b.x0);
      const txt=f.map(c=>linhasDosTextos(c.txt).join(" ").trim()), nomes=txt.map(t=>semAcento(t).replace(/\s+/g,""));
      if(nomes.includes("exame")&&nomes.includes("avaliacao")){ // legenda
        f.forEach((c,i)=>{ const n=nomes[i], tipo=n.startsWith("atividadesubstitutiva")?"substitutiva":n==="exame"?"exame":n==="avaliacao"?"avaliacao":null;
          if(tipo&&c.cor){ for(const k in cores) if(cores[k]===tipo) delete cores[k]; cores[c.cor]=tipo; } });
        return;
      }
      if(nomes[0]==="data"&&nomes.some(n=>n.startsWith("conteudo"))){ // cabeçalho
        colunas=f.map((c,i)=>({x:(c.x0+c.x1)/2,nome:(COLUNAS.find(([,re])=>re.test(nomes[i]))||[null])[0]})); return;
      }
      if(!colunas||!RE_DATA_CEL.test(txt[0])) return;
      const l={};
      f.forEach((c,i)=>{ const cx=(c.x0+c.x1)/2; let col=null, dm=Infinity; colunas.forEach(k=>{ const d=Math.abs(k.x-cx); if(d<dm){ dm=d; col=k; } });
        if(col&&col.nome&&txt[i]) l[col.nome]=l[col.nome]?l[col.nome]+" "+txt[i]:txt[i]; });
      l.cor=cores[f[0].cor]||null;
      linhas.push(l);
    });
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
// Número de uma avaliação ou de uma linha do cronograma: "Prova 1", "PROVA 01", "2ª prova", "II Avaliação",
// "Questionário II", "Trabalho de bioinformática II" (até duas palavras entre o nome e o número romano).
const CHAVES="prova|avaliacao|\\bav|trabalho|atividades? praticas?|questionario|seminario";
const RE_NUM=[new RegExp(`(?:${CHAVES})s?\\s*0?(\\d)\\b`),new RegExp(`\\b0?(\\d)\\s*[ªaº]?\\s*(?:${CHAVES})`)];
const RE_ROM=[new RegExp(`\\b(iv|v|i{1,3})\\s*(?:${CHAVES})`),new RegExp(`(?:${CHAVES})s?\\s+(?:\\S+\\s+){0,2}?(iv|v|i{1,3})\\b`)];
export function numeroDe(t){
  const s=semAcento(t);
  for(const re of RE_NUM){ const m=s.match(re); if(m) return +m[1]; }
  for(const re of RE_ROM){ const m=s.match(re); if(m) return ROMANOS[m[1]]; }
  return null;
}
// Tipo de uma avaliação dos critérios: prova, trabalho, seminario, questionario ou outro.
export function tipoDaAval(a){
  const n=semAcento(a.nome), t=semAcento(a.tipo||"");
  if(/question/.test(n)) return "questionario";
  if(/semin|apresenta/.test(n)||/apresenta/.test(t)) return "seminario";
  if(/trabalho|atividade|pratic|exercic/.test(n)) return "trabalho";
  if(/prova|avaliac|teste/.test(n)||/prova/.test(t)) return "prova";
  if(/trabalho/.test(t)) return "trabalho";
  return "outro";
}
// Tipo de uma linha do cronograma, pela cor e pelo texto do Conteúdo (nunca pela Categoria "Trabalho Efetivo Discente").
// tipo: exame | substitutiva | prova | questionario | seminario | trabalho | evento | avaliacao-sem-nome | aula.
// tipos: todos os tipos de avaliação que o texto menciona; ambiguo quando menciona mais de um (ex.: "Questionário ... Trabalho Prático").
export function tipoDaLinha(r){
  const s=semAcento(r.conteudo!=null?r.conteudo:r.texto||"").replace(/\s+/g," ");
  const tipos=[];
  if(/\bprova\b|\bavaliac(ao|oes)\b/.test(s) && !/revis|correc|vista|devolu|plano de ensino|metodo de avaliacao|avaliacao formativa|para a prova/.test(s)) tipos.push("prova");
  if(/questionario/.test(s)) tipos.push("questionario");
  if(/seminario|apresentacao oral/.test(s) && !/prepar|organiz|divulg|orienta/.test(s)) tipos.push("seminario");
  if(/atividades? pratica|trabalho (de|do|da|em|final|pratico|\d|i{1,3}\b)|\bentrega/.test(s)) tipos.push("trabalho");
  const exame=r.cor==="exame" || (/\bexame\b/.test(s) && !/para o exame|orientac|revis/.test(s));
  const evento=/semana (brasileira|academica)|\bmostra\b|\bjornada\b|\bsalao\b|eramia|congresso|simposio/.test(s);
  const tipo=exame?"exame":r.cor==="substitutiva"?"substitutiva":tipos.length?tipos[0]:evento?"evento":r.cor==="avaliacao"?"avaliacao-sem-nome":"aula";
  return {tipo,tipos:tipo==="exame"||tipo==="substitutiva"?[]:tipos,ambiguo:tipos.length>1};
}
const RE_DATA_TXT=new RegExp(`^(\\d{2})/(\\d{2})(?:/(\\d{2,4}))?\\s+(${DIAS.join("|")})\\b\\s*(.*)$`);
const anoDe=(a,ano)=>a?(a.length===2?"20"+a:a):ano;
const hhmm=h=>h?h.padStart(5,"0"):"";
// Linha da tabela (células) no formato usado pelo resto do app.
function linhaDaCelula(l,ano){
  const j=s=>(s||"").replace(/\s+/g," ").trim();
  const [d,m,a]=l.data.split("/"), [ini,fim]=(l.horario||"").match(/\d{1,2}:\d{2}/g)||[];
  const modalidade=j(l.modalidade).replace(/Presencia\s+l\b/,"Presencial");
  return {data:`${anoDe(a,ano)}-${m}-${d}`,dia:j(l.dia),turmas:l.turma?l.turma.split(/\s*,\s*/).map(t=>t.trim()).filter(Boolean):[],
    ini:hhmm(ini),fim:hhmm(fim),conteudo:j(l.conteudo),modalidade,categoria:j(l.categoria),local:j(l.local),cor:l.cor||null,
    ead:/distancia/.test(semAcento(modalidade)),texto:j([l.horario,l.turma,l.conteudo,l.aula,modalidade,l.categoria,l.local].filter(Boolean).join(" "))};
}
// EAD no modo texto (plano B): menções a Moodle/distância sem "presencial" (o "Presencial." do conteúdo não conta).
function eadPeloTexto(t){ const s=semAcento(t); return /moodle|distancia|\bead\b/.test(s) && !/\bpresencial\b/.test(s.replace(/presencial\./g,"")); }

// tabela: as linhas de linhasDaTabela() (ou null). Só é usada se tiver as mesmas datas, na mesma ordem, que a leitura
// por texto; senão vale o modo por texto (plano B). O resultado diz qual valeu em "fonte".
export function lerPlano(linhas,tabela=null){
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
    // "Prova ," sem número: se só falta um número entre as provas (ex.: "Prova 2" e "Prova"), ela vira "Prova 1".
    const provas=avaliacoes.filter(a=>tipoDaAval(a)==="prova"), nums=provas.map(a=>numeroDe(a.nome)), semNum=provas.filter((a,i)=>nums[i]===null);
    if(provas.length>1 && semNum.length===1 && /^(prova|avaliacao)$/.test(semAcento(semNum[0].nome))){
      const faltam=[]; for(let n=1;n<=provas.length;n++) if(!nums.includes(n)) faltam.push(n);
      if(faltam.length===1){ semNum[0].nome+=" "+faltam[0]; semNum[0].deduzido=true; }
    }
    const vistos={}; avaliacoes.forEach(a=>{ const k=a.nome.toLowerCase(); vistos[k]=(vistos[k]||0)+1; if(vistos[k]>1) a.nome+=" "+vistos[k]; });
  }
  // cronograma (por texto)
  const ci=linhas.findIndex(l=>/CRONOGRAMA/i.test(l)); const fim=linhas.findIndex((l,i)=>i>ci&&/^Data de Conclus/i.test(l));
  const corpo=ci>=0?linhas.slice(ci,fim>0?fim:linhas.length).filter(l=>!/^(Plano de Ensino|PROGRAD\/PROPPGI|\d+\s*\/\s*\d+)$/.test(l.trim())):[];
  const idx=[]; corpo.forEach((l,i)=>{ if(RE_DATA_TXT.test(l)) idx.push(i); });
  let aulasPlano=idx.map((p,k)=>{
    const de=k?Math.floor((idx[k-1]+p)/2)+1:p, ate=k<idx.length-1?Math.floor((p+idx[k+1])/2):Math.min(corpo.length-1,p+4);
    const m=corpo[p].match(RE_DATA_TXT), resto=m[5];
    const tm=resto.match(/^((?:[A-Z])(?:\s*,\s*[A-Z])*)(?=\s|$)/);
    const texto=corpo.slice(de,ate+1).join(" ");
    return {data:`${anoDe(m[3],ano)}-${m[2]}-${m[1]}`,dia:m[4],turmas:tm?tm[1].split(/\s*,\s*/):[],texto,conteudo:null,cor:null,ead:eadPeloTexto(texto)};
  });
  // cronograma pelas células, se bater com o texto
  let fonte="texto";
  if(tabela && tabela.length && tabela.length===aulasPlano.length){
    const cel=tabela.map(l=>linhaDaCelula(l,ano));
    if(cel.every((l,i)=>l.data===aulasPlano[i].data)){ aulasPlano=cel; fonte="celulas"; }
  }
  const turmas=[...new Set(aulasPlano.filter(a=>a.turmas.length===1).map(a=>a.turmas[0]))].sort();
  // Com mais de uma turma, nenhuma vem escolhida: a pessoa escolhe na revisão antes de importar (importacao.js).
  return {codigo,nome,ch,aulas,avaliacoes,aulasPlano,fonte,turmas:turmas.length>1?turmas:[],turma:null,marcada:true,ead:true,datas:true,eventos:true};
}

const TIPO_EVENTO={prova:"Prova",trabalho:"Trabalho",seminario:"Seminário",questionario:"Outro"};
function tituloLinha(r){
  let t=(r.conteudo!=null?r.conteudo:r.texto).replace(/\s+/g," ").trim();
  t=t.replace(/^SEMANA\s*\d+\s*[-:]?\s*A\d+\s*[-:]?\s*(Presencial\.|EaD\.)?\s*/i,"").replace(/^Aula\s*\d+\s*:?\s*/i,"").replace(/^[-–:\s]+/,"").replace(/[.\s]+$/,"");
  return t.length>80?t.slice(0,77).trim()+"…":t||"Sem descrição";
}
// Datas do cronograma para a turma escolhida (ou para todas, se não houver turma):
//  avals[i] = {datas:[...], origem}: datas da avaliação i (a primeira é a dela; as outras viram eventos).
//    origem: "cronograma" (pelo nome/número), "eliminacao" (sem número, pela ordem; ou número deduzido),
//            "ambiguo" (a linha cita mais de um tipo de avaliação) ou null (sem data no plano). Nunca só pela cor.
//  datas = {i: primeira data} (compatível com a versão anterior), exame, ead (linhas só EAD),
//  eventos = [{data, tipo, titulo}]: eventos do plano, atividades substitutivas, linhas verdes sem nome e as outras datas das avaliações.
export function datasDoPlano(p){
  const rows=p.aulasPlano.filter(a=>!p.turma||!a.turmas.length||a.turmas.includes(p.turma)).map(r=>({...r,...tipoDaLinha(r)}));
  const exame=rows.find(r=>r.tipo==="exame");
  const presenciais=new Set(rows.filter(r=>!r.ead).map(r=>r.data));
  const ead=[...new Map(rows.filter(r=>r.ead&&!presenciais.has(r.data)&&r!==exame).map(r=>[r.data,r])).values()];
  const tiposAval=p.avaliacoes.map(tipoDaAval);
  const avals=p.avaliacoes.map(()=>({datas:[],origem:null}));
  const numLinha=r=>numeroDe(r.conteudo!=null?r.conteudo:r.texto);
  ["prova","trabalho","seminario","questionario"].forEach(k=>{
    const idx=tiposAval.map((t,i)=>t===k?i:-1).filter(i=>i>=0); if(!idx.length) return;
    const cand=rows.filter(r=>r.tipos.includes(k)), usadas=new Set();
    const liga=(i,rs,origem)=>{ rs.forEach(r=>usadas.add(r)); avals[i]={datas:[...new Set(rs.map(r=>r.data))].sort(),origem:origem!=="eliminacao"&&rs.some(r=>r.ambiguo)?"ambiguo":origem}; };
    // 1) pelo número (uma prova tem uma data; trabalhos e seminários podem ter várias)
    const nums=new Set();
    idx.forEach(i=>{ const n=numeroDe(p.avaliacoes[i].nome); if(n===null) return; nums.add(n);
      let rs=cand.filter(r=>!usadas.has(r)&&numLinha(r)===n); if(k==="prova") rs=rs.slice(0,1);
      if(rs.length) liga(i,rs,p.avaliacoes[i].deduzido?"eliminacao":"cronograma"); });
    // 2) as que sobraram ficam com as linhas do mesmo tipo que não são de outra avaliação numerada
    const resto=cand.filter(r=>!usadas.has(r)&&!nums.has(numLinha(r))), sobram=idx.filter(i=>!avals[i].datas.length);
    if(!sobram.length||!resto.length) return;
    const unica=idx.length===1&&resto.length===cand.length;
    if(k==="prova") sobram.forEach((i,j)=>{ if(resto[j]) liga(i,[resto[j]],unica&&resto.length===1?"cronograma":"eliminacao"); });
    else if(sobram.length===1) liga(sobram[0],resto,unica?"cronograma":"eliminacao");
  });
  const eventos=[], novo=(data,tipo,titulo)=>{ if(!eventos.some(e=>e.data===data&&e.tipo===tipo&&e.titulo===titulo)) eventos.push({data,tipo,titulo}); };
  avals.forEach((a,i)=>a.datas.slice(1).forEach((d,j)=>novo(d,TIPO_EVENTO[tiposAval[i]]||"Outro",`${p.avaliacoes[i].nome}, ${j+2}ª data`)));
  rows.forEach(r=>{
    if(r.tipo==="evento") novo(r.data,"Evento",tituloLinha(r));
    else if(r.tipo==="substitutiva") novo(r.data,"Atividade substitutiva",tituloLinha(r));
    else if(r.tipo==="avaliacao-sem-nome") novo(r.data,"Outro","Avaliação sem nome no plano (confira)");
  });
  eventos.sort((a,b)=>a.data.localeCompare(b.data));
  const datas={}; avals.forEach((a,i)=>{ if(a.datas.length) datas[i]=a.datas[0]; });
  return {avals,datas,exame:exame?exame.data:null,ead,eventos};
}
// Índices das avaliações em ordem de data (as sem data no fim, na ordem do plano).
export function ordemDasAvaliacoes(p,d){
  const i=p.avaliacoes.map((a,k)=>k); if(!d) return i;
  return i.sort((x,y)=>(d.avals[x].datas[0]||"9999").localeCompare(d.avals[y].datas[0]||"9999")||x-y);
}
export function aulasDoPlano(p){
  // Aulas só EAD não definem o horário da grade. No modo texto, vale a regra antiga (menção a Moodle/distância).
  const eadLinha=r=>p.fonte==="celulas"?r.ead:/moodle|distancia/.test(semAcento(r.texto));
  const rows=p.aulasPlano.filter(a=>(!p.turma||!a.turmas.length||a.turmas.includes(p.turma)) && !eadLinha(a));
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
