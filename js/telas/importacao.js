// Importação de planos de ensino: leitura dos PDFs, tela de revisão e gravação das cadeiras.
import { ir, render } from "../app.js";
import { dados, salvar } from "../dados.js";
import { faltasMax, temNotas } from "../regras.js";
import { id, esc, fmt, dataCurta, semAcento } from "../util.js";
import { lerPDF, lerPlano, datasDoPlano, aulasDoPlano, ordemDasAvaliacoes } from "../plano-ensino.js";

let _planos=[];
export async function importarPlanos(lista){
  const arqs=[...(lista||[])]; if(!arqs.length) return;
  const msg=document.getElementById("imp-msg");
  const progresso=k=>{ msg.innerHTML=`<div class="card"><div style="font-weight:700">Lendo os planos de ensino</div><div class="meta">${k<arqs.length?`Plano ${k+1} de ${arqs.length}: ${esc(arqs[k].name)}`:"Organizando as cadeiras..."}</div><div class="carregando vai"><div style="width:${Math.round((k+.5)/arqs.length*100)}%"></div></div></div>`; };
  const lidos=[], falhas=[]; let erro=null, k=0;
  for(const f of arqs){ progresso(k++);
    try{ const {linhas,tabela}=await lerPDF(f); const p=lerPlano(linhas,tabela); if(p) lidos.push(p); else falhas.push(f.name); }
    catch(e){ console.error(e); erro=e; falhas.push(f.name); }
  }
  if(!lidos.length){ msg.innerHTML=`<div class="card"><div style="color:var(--erro);font-weight:700">Não consegui ler ${arqs.length>1?"esses PDFs":"este PDF"}.</div>
    <div class="meta" style="margin-top:6px">Use o <b>Plano de Ensino</b> da disciplina em PDF, do jeito que o professor disponibilizou (não uma foto ou print). Se continuar, cadastre a cadeira em "+ Nova cadeira".</div>
    ${erro?`<div class="meta" style="margin-top:6px;font-size:.75rem">Detalhe técnico: ${esc(erro.message||String(erro))}</div>`:""}</div>`; return; }
  const vistos=new Set(); _planos=lidos.filter(p=>{ const k=p.codigo||p.nome; if(vistos.has(k)) return false; vistos.add(k); return true; });
  _planos.falhas=falhas; ir("importar");
}
// Chamada pelos checkboxes/select da revisão (antes: _planos[i].campo=valor direto no HTML).
export function opcaoPlano(i,campo,v){ _planos[i][campo]=v; }
// Data de cada avaliação na revisão: a primeira data, quantas mais existem e de onde veio.
function dataDaAval(x){
  if(!x.datas.length) return `<div class="meta" style="font-size:.8rem">sem data no plano</div>`;
  const mais=x.datas.length>1?` e mais ${x.datas.length-1} data${x.datas.length>2?"s":""}`:"";
  const porque=x.origem==="eliminacao"?"deduzida pela ordem das avaliações":x.origem==="ambiguo"?"o cronograma cita mais de uma avaliação nesse dia":"";
  return `<div class="meta" style="font-size:.8rem">${dataCurta(x.datas[0])}${mais} &middot; ${porque?`<span style="color:var(--exame)" title="${porque}">confira esta data</span> (${porque})`:"do cronograma"}</div>`;
}
// Resumo dos eventos que vão para a agenda, por grupo.
function resumoEventos(ev){
  const n=t=>ev.filter(t).length, partes=[];
  const sem=n(e=>e.tipo==="Outro"&&/^Avaliação sem nome/.test(e.titulo)), plano=n(e=>e.tipo==="Evento"), subs=n(e=>e.tipo==="Atividade substitutiva"), outras=ev.length-sem-plano-subs;
  if(plano) partes.push(`${plano} evento(s) do plano`); if(subs) partes.push(`${subs} atividade(s) substitutiva(s)`);
  if(outras) partes.push(`${outras} outra(s) data(s) de avaliações`); if(sem) partes.push(`${sem} avaliação(ões) sem nome para conferir`);
  return partes.join(", ");
}
function cadeiraDoPlano(p){ return dados.cadeiras.find(c=>(p.codigo&&c.codigo===p.codigo)||semAcento(c.nome)===semAcento(p.nome)); }
export function telaImportar(){
  let h=`<div class="card meta">Encontrei ${_planos.length} cadeira(s). Confira os dados e desmarque o que não quiser. Depois dá para ajustar tudo em "Editar cadeira".</div>`;
  if(_planos.falhas&&_planos.falhas.length) h+=`<div class="card" style="color:var(--exame)">Não consegui ler: ${_planos.falhas.map(esc).join(", ")}</div>`;
  _planos.forEach((p,i)=>{
    const ja=cadeiraDoPlano(p), trava=ja&&temNotas(ja);
    // Com várias turmas e nenhuma escolhida, horários e datas ainda não existem: misturariam as turmas.
    const semTurma=p.turmas.length>0 && !p.turma, d=semTurma?null:datasDoPlano(p);
    h+=`<div class="card"><label style="display:flex;gap:12px;align-items:flex-start;cursor:pointer">
      <input type="checkbox" style="width:22px;height:22px;flex:none;margin-top:4px" ${p.marcada?"checked":""} onchange="opcaoPlano(${i},'marcada',this.checked)">
      <div style="flex:1"><div class="rotulo">${esc(p.codigo)} &middot; ${p.ch}h &middot; até ${faltasMax(p.ch)} faltas</div>
      <div class="nome-cad" style="margin:2px 0">${esc(p.nome)}</div>
      <div class="meta">${semTurma?"Escolha a turma para ver os horários.":aulasDoPlano(p).length?aulasDoPlano(p).map(a=>`${a.dia}${a.ini?` ${a.ini}–${a.fim}`:""} (${a.periodos} períodos)`).join(" &middot; "):"Sem horário no plano"}</div>
      ${ja?`<div style="color:var(--exame);font-size:.85rem;margin-top:4px">${trava?"Já cadastrada e com notas: só datas e horários serão atualizados.":"Já cadastrada: será atualizada com os dados do plano."}</div>`:""}</div></label>`;
    if(p.turmas.length){
      const alerta=semTurma && p.marcada && _planos.avisoTurma;
      h+=`<label>Sua turma (o cronograma muda por turma)</label><select data-turma="${i}" onchange="opcaoPlano(${i},'turma',this.value);render()"${alerta?` style="border-color:var(--erro)"`:""}>${semTurma?`<option value="" selected disabled>Escolha sua turma</option>`:""}${p.turmas.map(t=>`<option ${t===p.turma?"selected":""}>${t}</option>`).join("")}</select>`;
      if(alerta) h+=`<div class="aviso" style="color:var(--erro)">Este plano tem ${p.turmas.length} turmas. Escolha a sua para importar.</div>`;
    }
    h+=`<div style="margin-top:12px;font-weight:700">Avaliações</div>`;
    // Em ordem de data; cada avaliação mostra a data encontrada e de onde ela veio.
    h+=p.avaliacoes.length?ordemDasAvaliacoes(p,d).map(j=>{ const a=p.avaliacoes[j];
      return `<div class="linha entre" style="padding:6px 0;border-bottom:1px solid var(--borda)"><span>${esc(a.nome)}${d?dataDaAval(d.avals[j]):""}</span><b>${fmt(a.peso)}%</b></div>`; }).join("")
      :`<div class="meta">Não encontrei as avaliações neste plano. Cadastre depois em "Editar cadeira".</div>`;
    if(d){
      const extra=[]; if(d.exame) extra.push(`Exame em ${dataCurta(d.exame)}`);
      if(Object.keys(d.datas).length||d.exame) h+=`<label style="display:flex;gap:8px;align-items:center;margin-top:10px;color:var(--texto)"><input type="checkbox" style="width:20px;height:20px" ${p.datas?"checked":""} onchange="opcaoPlano(${i},'datas',this.checked)"> Usar as datas das avaliações do cronograma${extra.length?` (${extra.join(", ")})`:""}</label>`;
      if(d.eventos.length) h+=`<label style="display:flex;gap:8px;align-items:flex-start;margin-top:6px;color:var(--texto)"><input type="checkbox" style="width:20px;height:20px;flex:none" ${p.eventos?"checked":""} onchange="opcaoPlano(${i},'eventos',this.checked)"> <span>Adicionar ${d.eventos.length} evento(s) à agenda<span class="meta" style="display:block;font-size:.8rem">${resumoEventos(d.eventos)}</span></span></label>`;
      if(d.ead.length) h+=`<label style="display:flex;gap:8px;align-items:center;margin-top:6px;color:var(--texto)"><input type="checkbox" style="width:20px;height:20px" ${p.ead?"checked":""} onchange="opcaoPlano(${i},'ead',this.checked)"> Adicionar ${d.ead.length} aula(s) EAD à agenda</label>`;
    }
    h+=`</div>`;
  });
  return h+`<button style="width:100%" onclick="confirmarImportacao()">Adicionar cadeiras marcadas</button>`;
}
export function confirmarImportacao(){
  // Nenhum plano marcado com várias turmas pode entrar sem a turma escolhida.
  const pendente=_planos.findIndex(p=>p.marcada && p.turmas.length && !p.turma);
  if(pendente>=0){ _planos.avisoTurma=true; render(); const s=document.querySelector(`[data-turma="${pendente}"]`); if(s){ s.scrollIntoView({block:"center"}); s.focus(); } return; }
  _planos.filter(p=>p.marcada).forEach(p=>{
    const d=datasDoPlano(p);
    let c=cadeiraDoPlano(p);
    const avs=ordemDasAvaliacoes(p,d).map(j=>({id:id(),nome:p.avaliacoes[j].nome,peso:p.avaliacoes[j].peso,nota:null,data:p.datas&&d.datas[j]||""}));
    if(!c){ c={id:id(),faltas:0,exame:null,avaliacoes:avs}; dados.cadeiras.push(c); }
    else if(!temNotas(c)) c.avaliacoes=avs;
    else if(p.datas) c.avaliacoes.forEach(a=>{ const j=p.avaliacoes.findIndex(x=>semAcento(x.nome)===semAcento(a.nome)); if(j>=0&&d.datas[j]&&!a.data) a.data=d.datas[j]; });
    Object.assign(c,{codigo:p.codigo,nome:c.nome||p.nome,ch:p.ch,turma:p.turma||c.turma});
    const au=aulasDoPlano(p); if(au.length){ c.aulas=au; c.periodosDia=au[0].periodos; } else c.periodosDia=c.periodosDia||2;
    // Reimportar não duplica: o mesmo evento (cadeira, data, tipo e texto) só entra uma vez.
    const novoEvento=(data,tipo,obs)=>{ if(!dados.eventos.some(e=>e.cadeiraId===c.id&&e.data===data&&e.tipo===tipo&&(e.obs||"")===obs)) dados.eventos.push({id:id(),data,cadeiraId:c.id,tipo,obs}); };
    if(p.datas&&d.exame) novoEvento(d.exame,"Prova","Exame");
    if(p.eventos) d.eventos.forEach(e=>novoEvento(e.data,e.tipo,e.titulo));
    if(p.ead) d.ead.forEach(r=>novoEvento(r.data,"Aula EAD","Aula a distância (Moodle)"));
  });
  salvar(); _planos=[]; ir("lista");
}
