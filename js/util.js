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
