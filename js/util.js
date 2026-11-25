// Utilitários puros (sem DOM e sem estado): formatação, datas e constantes de calendário.

export const id = () => Math.random().toString(36).slice(2,10);
export const fmt = n => (Math.round(n*100)/100).toLocaleString("pt-BR",{maximumFractionDigits:2});
export const fmt2 = n => n.toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2});
export const virg = v => v===null||v===undefined||v==="" ? "" : String(v).replace(".",",");
export const num = v => { if(v===""||v===null||v===undefined) return null; const n=parseFloat(String(v).replace(",",".")); return isNaN(n)?null:n; };
export const esc = s => String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
export function semAcento(t){ return t.normalize("NFD").replace(/[̀-ͯ]/g,"").toLowerCase(); }

/* ---------- Datas ---------- */
function hojeISO(){ const d=new Date(); return new Date(d.getFullYear(),d.getMonth(),d.getDate()); }
export function dataDe(iso){ const [a,m,d]=iso.split("-").map(Number); return new Date(a,m-1,d); }
export function diasAte(iso){ return Math.round((dataDe(iso)-hojeISO())/86400000); }
export function dataCurta(iso){ const [,m,d]=iso.split("-"); return `${d}/${m}`; }
export function quando(n){ return n===0?"hoje":n===1?"amanhã":n>1?`em ${n} dias`:n===-1?"ontem":`há ${-n} dias`; }
export function hojeStr(){ const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; }
export const MESES=["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];
export const DIAS=["Segunda","Terça","Quarta","Quinta","Sexta","Sábado","Domingo"];
export const DIA_JS=["Domingo","Segunda","Terça","Quarta","Quinta","Sexta","Sábado"];

/* ---------- Grade ---------- */
// Nomes para o bloco da grade, do mais completo ao mais curto. Nenhum parte palavra: quem escolhe o que cabe é
// encaixarBloco(). Ex.: "Anatomia Humana" → "Anatomia H." → "Anat. H." → "AH";
// "Introdução à Programação" → "Intro. Programação" → "Programação" → "Prog." → "P".
// Preposições e artigos ficam de fora das abreviações e das iniciais; siglas (IA, POO) e numerais romanos ficam inteiros.
const PREPOSICOES=new Set(["a","à","às","ao","aos","as","o","os","e","de","da","das","do","dos","na","nas","no","nos","em","para","com","por"]);
const ROMANO=/^(I{1,3}|IV|V|VI{1,3})$/, SIGLA=/^[A-ZÀ-Ú]{2,}$/, VOGAL=/[aeiouáéíóúâêôãõà]/i;
const ePrep=w=>PREPOSICOES.has(w.toLowerCase());
const maiuscula=t=>t.charAt(0).toUpperCase()+t.slice(1);
// Prefixo de 4 letras que termina em consoante (até 6), sem separar "gr", "pr", "ch" etc. do que vem depois:
// "Anatomia" → "Anat.", "Bioestatística" → "Bioest.", "Programação" → "Prog.", "Genética" → "Genét.".
function prefixo(w){
  let n=4;
  while(n<6&&n<w.length&&VOGAL.test(w[n-1])) n++;
  if(n<6&&n<w.length&&!VOGAL.test(w[n])&&!/[rlh]/i.test(w[n])) n++;
  return n>=w.length-1?w:w.slice(0,n)+".";
}
export function nomesCurtos(nome){
  // O numeral romano do fim fica preso à palavra anterior (espaço não separável): "POO I" não quebra em "POO" / "I".
  const out=[], add=(t,junto=true)=>{ t=maiuscula(t.replace(/\s+/g," ").replace(/\s+,/g,",").trim()); if(junto) t=t.replace(/ (I{1,3}|IV|V|VI{1,3})$/," $1"); if(t&&!out.includes(t)) out.push(t); };
  const n=nome.replace(/\s+/g," ").trim(); add(n);
  const s1=n.replace(/Programação Orientada a Objetos/gi,"POO").replace(/Intelig[êe]ncia Artificial/gi,"IA").replace(/\s+na Área da\s+/i," na ")
    .replace(/^(Introdução|Introducao)\s+(à|a|ao|aos|às)\s+/i,"Intro. ").replace(/^Fundamentos\s+(de|da|do|das|dos)\s+/i,"Fund. ");
  add(s1);
  const s2=maiuscula(s1.replace(/^(Intro\.|Fund\.)\s+/,"")); add(s2);
  if(s2.includes(",")) add(s2.split(",")[0]);
  // Abrevia da última palavra para a segunda ("Humana" → "H."), tirando as preposições que ficam junto de abreviações.
  const ws=s2.replace(/,/g,"").split(/[  ]/);
  const letra=w=>/^[A-Za-zÀ-ÿ]/.test(w);
  const conteudo=i=>letra(ws[i])&&!ePrep(ws[i])&&!ROMANO.test(ws[i])&&!SIGLA.test(ws[i])&&!/\.$/.test(ws[i]);
  const montar=c=>c.filter((w,i)=>!(ePrep(w)&&(/\.$/.test(c[i+1]||"")||/\.$/.test(c[i-1]||"")&&i===c.length-1))).join(" ");
  const cur=[...ws];
  for(let i=ws.length-1;i>0;i--) if(conteudo(i)){ cur[i]=ws[i][0].toUpperCase()+"."; add(montar(cur)); }
  if(conteudo(0)&&ws[0].length>5){ cur[0]=prefixo(ws[0]); add(montar(cur)); }
  const romano=ws.filter(w=>ROMANO.test(w)).pop(), base=ws.filter(w=>letra(w)&&!ePrep(w)&&!ROMANO.test(w));
  // Iniciais (último recurso): com o numeral preso e, por fim, com espaço comum, que pode quebrar.
  const iniciais=base.map(w=>SIGLA.test(w)?w:w[0].toUpperCase()).join("")+(romano?" "+romano:"");
  add(iniciais); if(romano) add(iniciais,false);
  return out;
}
// Escolhe o nome e o formato do horário de um bloco da grade, sem partir palavra e sem cortar texto.
// medirNome/medirHora: largura em px de um texto (canvas no navegador, função de teste no Node).
// Ordem de preferência: horário em duas linhas, em uma linha ("13:30–15:10"), sem horário; para cada formato,
// o nome mais completo que couber. As iniciais (último candidato) só entram se nenhum outro nome couber.
// aperto=true: nem as iniciais couberam (aí a grade liga a hifenização como último recurso).
export function encaixarBloco({candidatos,largura,altura,medirNome,medirHora,linhaNome,linhaHora,margemHora=3,ini,fim}){
  const folga=0.5, espaco=medirNome(" ");
  const linhas=t=>{ const ws=t.split(" "); if(ws.some(w=>medirNome(w)>largura-folga)) return Infinity;
    let n=1, atual=medirNome(ws[0]); for(const w of ws.slice(1)){ const l=medirNome(w); if(atual+espaco+l<=largura-folga) atual+=espaco+l; else { n++; atual=l; } } return n; };
  const formatos=[{hora:"duas",alt:2*linhaHora+margemHora},{hora:"uma",alt:linhaHora+margemHora,cabe:medirHora(`${ini}–${fim}`)<=largura-folga},{hora:"nenhuma",alt:0}];
  const grupos=candidatos.length>1?[candidatos.slice(0,-1),candidatos.slice(-1)]:[candidatos];
  for(const grupo of grupos) for(const f of formatos){ if(f.cabe===false) continue;
    for(const c of grupo){ const n=linhas(c); if(n*linhaNome+f.alt<=altura+folga) return {nome:c,hora:f.hora,linhas:n,aperto:false}; } }
  return {nome:candidatos[candidatos.length-1],hora:"nenhuma",linhas:1,aperto:true};
}
// Aulas que se sobrepõem no mesmo dia ficam lado a lado. Cada aula recebe uma faixa (k) e o número de faixas (n)
// do seu grupo: aulas encadeadas por sobreposição formam um grupo e dividem a largura da coluna entre si.
// Sem sobreposição, n=1 e k=0. Recebe itens com {a:{dia,ini,fim}} e devolve um Map item -> {k,n}.
export function faixasGrade(itens){
  const res=new Map(), porDia={};
  itens.forEach(x=>(porDia[x.a.dia]=porDia[x.a.dia]||[]).push(x));
  Object.values(porDia).forEach(l=>{
    l=[...l].sort((x,y)=>x.a.ini.localeCompare(y.a.ini)||y.a.fim.localeCompare(x.a.fim));
    let grupo=[], fimGrupo="", fins=[]; // fins[k] = horário em que a faixa k fica livre
    const fecha=()=>grupo.forEach(x=>res.get(x).n=fins.length);
    l.forEach(x=>{
      if(grupo.length && x.a.ini>=fimGrupo){ fecha(); grupo=[]; fins=[]; }
      let k=fins.findIndex(f=>f<=x.a.ini); if(k<0) k=fins.length;
      if(!grupo.length || x.a.fim>fimGrupo) fimGrupo=x.a.fim;
      fins[k]=x.a.fim; res.set(x,{k,n:1}); grupo.push(x);
    });
    fecha();
  });
  return res;
}
