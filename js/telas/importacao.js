// Importação de planos de ensino: leitura dos PDFs, tela de revisão e gravação das cadeiras.
import { ir } from "../app.js";
import { dados, salvar } from "../dados.js";
import { faltasMax, temNotas } from "../regras.js";
import { id, esc, fmt, dataCurta, semAcento } from "../util.js";
import { linhasDoPDF, lerPlano, datasDoPlano, aulasDoPlano } from "../plano-ensino.js";

let _planos=[];
export async function importarPlanos(lista){
  const arqs=[...(lista||[])]; if(!arqs.length) return;
  const msg=document.getElementById("imp-msg");
  const progresso=k=>{ msg.innerHTML=`<div class="card"><div style="font-weight:700">Lendo os planos de ensino</div><div class="meta">${k<arqs.length?`Plano ${k+1} de ${arqs.length}: ${esc(arqs[k].name)}`:"Organizando as cadeiras..."}</div><div class="carregando vai"><div style="width:${Math.round((k+.5)/arqs.length*100)}%"></div></div></div>`; };
  const lidos=[], falhas=[]; let erro=null, k=0;
  for(const f of arqs){ progresso(k++);
    try{ const p=lerPlano(await linhasDoPDF(f)); if(p) lidos.push(p); else falhas.push(f.name); }
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
function cadeiraDoPlano(p){ return dados.cadeiras.find(c=>(p.codigo&&c.codigo===p.codigo)||semAcento(c.nome)===semAcento(p.nome)); }
export function telaImportar(){
  let h=`<div class="card meta">Encontrei ${_planos.length} cadeira(s). Confira os dados e desmarque o que não quiser. Depois dá para ajustar tudo em "Editar cadeira".</div>`;
  if(_planos.falhas&&_planos.falhas.length) h+=`<div class="card" style="color:var(--exame)">Não consegui ler: ${_planos.falhas.map(esc).join(", ")}</div>`;
  _planos.forEach((p,i)=>{
    const ja=cadeiraDoPlano(p), d=datasDoPlano(p), trava=ja&&temNotas(ja);
    h+=`<div class="card"><label style="display:flex;gap:12px;align-items:flex-start;cursor:pointer">
      <input type="checkbox" style="width:22px;height:22px;flex:none;margin-top:4px" ${p.marcada?"checked":""} onchange="opcaoPlano(${i},'marcada',this.checked)">
      <div style="flex:1"><div class="rotulo">${esc(p.codigo)} &middot; ${p.ch}h &middot; até ${faltasMax(p.ch)} faltas</div>
      <div class="nome-cad" style="margin:2px 0">${esc(p.nome)}</div>
      <div class="meta">${aulasDoPlano(p).length?aulasDoPlano(p).map(a=>`${a.dia}${a.ini?` ${a.ini}–${a.fim}`:""} (${a.periodos} períodos)`).join(" &middot; "):"Sem horário no plano"}</div>
      ${ja?`<div style="color:var(--exame);font-size:.85rem;margin-top:4px">${trava?"Já cadastrada e com notas: só datas e horários serão atualizados.":"Já cadastrada: será atualizada com os dados do plano."}</div>`:""}</div></label>`;
    if(p.turmas.length) h+=`<label>Sua turma (o cronograma muda por turma)</label><select onchange="opcaoPlano(${i},'turma',this.value);render()">${p.turmas.map(t=>`<option ${t===p.turma?"selected":""}>${t}</option>`).join("")}</select>`;
    h+=`<div style="margin-top:12px;font-weight:700">Avaliações</div>`;
    h+=p.avaliacoes.length?p.avaliacoes.map((a,j)=>`<div class="linha entre" style="padding:6px 0;border-bottom:1px solid var(--borda)"><span>${esc(a.nome)}${d.datas[j]?` <span class="meta">&middot; ${dataCurta(d.datas[j])}</span>`:""}</span><b>${fmt(a.peso)}%</b></div>`).join("")
      :`<div class="meta">Não encontrei as avaliações neste plano. Cadastre depois em "Editar cadeira".</div>`;
    const extra=[]; if(d.exame) extra.push(`Exame em ${dataCurta(d.exame)}`);
    if(Object.keys(d.datas).length||d.exame) h+=`<label style="display:flex;gap:8px;align-items:center;margin-top:10px;color:var(--texto)"><input type="checkbox" style="width:20px;height:20px" ${p.datas?"checked":""} onchange="opcaoPlano(${i},'datas',this.checked)"> Usar as datas de prova do cronograma${extra.length?` (${extra.join(", ")})`:""}</label>`;
    if(d.ead.length) h+=`<label style="display:flex;gap:8px;align-items:center;margin-top:6px;color:var(--texto)"><input type="checkbox" style="width:20px;height:20px" ${p.ead?"checked":""} onchange="opcaoPlano(${i},'ead',this.checked)"> Adicionar ${d.ead.length} aula(s) EAD à agenda</label>`;
    h+=`</div>`;
  });
  return h+`<button style="width:100%" onclick="confirmarImportacao()">Adicionar cadeiras marcadas</button>`;
}
export function confirmarImportacao(){
  _planos.filter(p=>p.marcada).forEach(p=>{
    const d=datasDoPlano(p);
    let c=cadeiraDoPlano(p);
    const avs=p.avaliacoes.map((a,j)=>({id:id(),nome:a.nome,peso:a.peso,nota:null,data:p.datas&&d.datas[j]||""}));
    if(!c){ c={id:id(),faltas:0,exame:null,avaliacoes:avs}; dados.cadeiras.push(c); }
    else if(!temNotas(c)) c.avaliacoes=avs;
    else if(p.datas) c.avaliacoes.forEach(a=>{ const j=p.avaliacoes.findIndex(x=>semAcento(x.nome)===semAcento(a.nome)); if(j>=0&&d.datas[j]&&!a.data) a.data=d.datas[j]; });
    Object.assign(c,{codigo:p.codigo,nome:c.nome||p.nome,ch:p.ch,turma:p.turma||c.turma});
    const au=aulasDoPlano(p); if(au.length){ c.aulas=au; c.periodosDia=au[0].periodos; } else c.periodosDia=c.periodosDia||2;
    const novoEvento=(data,tipo,obs)=>{ if(!dados.eventos.some(e=>e.cadeiraId===c.id&&e.data===data&&e.tipo===tipo)) dados.eventos.push({id:id(),data,cadeiraId:c.id,tipo,obs}); };
    if(p.datas&&d.exame) novoEvento(d.exame,"Prova","Exame");
    if(p.ead) d.ead.forEach(r=>novoEvento(r.data,"Aula EAD","Aula a distância (Moodle)"));
  });
  salvar(); _planos=[]; ir("lista");
}
