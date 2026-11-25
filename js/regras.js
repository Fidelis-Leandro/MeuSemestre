// Regras acadêmicas: funções puras, sem DOM e sem localStorage. Testadas em tests/regras.test.js.
import { num, fmt, esc } from "./util.js";

// Período = 50 min. Faltas máximas = 25% dos períodos (arredondado para baixo).
export function periodos(ch){ return Math.round(ch*60/50); }
export function faltasMax(ch){ return Math.floor(periodos(ch)*0.25); }
export function periodosEntre(ini,fim){ if(!ini||!fim) return 0; const m=t=>{const [h,mi]=t.split(":").map(Number); return h*60+mi;}; return Math.max(1,Math.round((m(fim)-m(ini))/50)); }
// Exame: final = 0,6*média + 0,4*exame >= 6  ->  exame necessário = 15 - 1,5*média
export function notaExame(media){ return 15 - 1.5*media; }

export function temSubs(a){ return a.subs && a.subs.length>0; }
export function notaDe(a){ // nota da avaliação (0-10) ou null se incompleta
  if(!temSubs(a)) return num(a.nota);
  if(a.subs.some(sb=>num(sb.nota)===null)) return null;
  return a.subs.reduce((t,sb)=>t+num(sb.nota)*(num(sb.peso)||0)/100,0);
}
export function calcularNotas(c){
  const avs = c.avaliacoes;
  const pesoTotal = avs.reduce((s,a)=>s+(num(a.peso)||0),0);
  let pontos=0, pesoFeito=0;
  avs.forEach(a=>{
    const p=num(a.peso)||0;
    if(temSubs(a)){
      a.subs.forEach(sb=>{ const n=num(sb.nota), sp=(num(sb.peso)||0)/100; if(n!==null){ pontos+=n*p/100*sp; pesoFeito+=p*sp; } });
    } else { const n=num(a.nota); if(n!==null){ pontos+=n*p/100; pesoFeito+=p; } }
  });
  const pesoRestante = Math.max(0,100-pesoFeito);
  return {pesoTotal, pontos, pesoFeito, pesoRestante, maxPossivel: pontos + pesoRestante*10/100};
}

export function situacao(c){
  const max = faltasMax(c.ch);
  if(c.faltas > max) return {cls:"s-erro", txt:"Reprovado por falta", det:`Você passou do limite de ${max} faltas (75% de presença).`};
  const n = calcularNotas(c);
  if(c.avaliacoes.length===0) return {cls:"s-neutro", txt:"Sem avaliações", det:"Cadastre as avaliações e os pesos."};
  const subRuim=c.avaliacoes.find(a=>temSubs(a)&&Math.abs(a.subs.reduce((t,sb)=>t+(num(sb.peso)||0),0)-100)>0.01);
  if(subRuim) return {cls:"s-neutro", txt:"Pesos incompletos", det:`As partes de "${esc(subRuim.nome)}" devem somar 100%.`};
  if(Math.abs(n.pesoTotal-100)>0.01) return {cls:"s-neutro", txt:"Pesos incompletos", det:`Os pesos somam ${fmt(n.pesoTotal)}%. Ajuste para 100%.`};

  if(n.pesoRestante<=0.0001){
    const m=n.pontos;
    if(m>=7) return {cls:"s-ok", txt:"Aprovado", det:`Média final ${fmt(m)}.`, media:m};
    if(m<4) return {cls:"s-erro", txt:"Reprovado", det:`Média ${fmt(m)}, abaixo de 4. Não tem direito a exame.`, media:m};
    const e=num(c.exame);
    if(e!==null){
      const f=0.6*m+0.4*e;
      return f>=6 ? {cls:"s-ok", txt:"Aprovado no exame", det:`Nota final ${fmt(f)} (mínimo 6).`, media:m}
                  : {cls:"s-erro", txt:"Reprovado no exame", det:`Nota final ${fmt(f)} (mínimo 6).`, media:m};
    }
    return {cls:"s-exame", txt:"Exame", det:`Média ${fmt(m)}. Você precisa de ${fmt(notaExame(m))} no exame.`, media:m, exame:notaExame(m)};
  }

  const rest=n.pesoRestante/100;
  const precisa7=(7-n.pontos)/rest;
  const precisa4=(4-n.pontos)/rest;
  if(precisa7<=0) return {cls:"s-ok", txt:"Aprovação garantida", det:"Você já atingiu média 7, mesmo tirando zero no resto."};
  if(precisa7<=10) return {cls:"s-atencao", txt:"Em andamento", det:`Precisa de média ${fmt(precisa7)} nas próximas avaliações para passar direto.`, precisa:precisa7};
  if(precisa4<=10) return {cls:"s-exame", txt:"Rumo ao exame", det:`Passar direto não é mais possível (máximo ${fmt(n.maxPossivel)}). Precisa de média ${fmt(Math.max(0,precisa4))} nas próximas para ter direito a exame.`, precisa4:Math.max(0,precisa4)};
  return {cls:"s-erro", txt:"Reprovação provável", det:`Mesmo com 10 em tudo, a média máxima é ${fmt(n.maxPossivel)}, abaixo de 4.`};
}

export function aprovada(c){ return situacao(c).cls==="s-ok"; }
export function limitar(v){ let n=num(v); return n===null?null:Math.min(10,Math.max(0,n)); }
export function temNotas(c){ return c.avaliacoes.some(a=>notaDe(a)!==null||(a.subs||[]).some(s=>num(s.nota)!==null)); }
export function corFalta(f,max){ const r=max-f; if(f>max) return "var(--erro)"; if(r<=2) return "var(--exame)"; if(f/max>=.5) return "var(--atencao)"; return "var(--ok)"; }

const URGENCIA={"s-erro":0,"s-exame":1,"s-atencao":2,"s-neutro":3,"s-ok":4};
export function porUrgencia(lista){ return lista.map((c,i)=>({c,i,u:URGENCIA[situacao(c).cls]})).sort((a,b)=>a.u-b.u||a.i-b.i).map(x=>x.c); }
