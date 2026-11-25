// Ponto de entrada: estado da tela, render(), navegação, ponte para os handlers inline e inicialização.
import { achar, salvarBackup, lerBackup, restaurarBackup } from "./dados.js";
import { efeitos, antesDoRender, iniciarAnimacoes } from "./animacoes.js";
import { iniciarTema, trocarTema } from "./tema.js";
import { telaLista, abrirCadeira, iniciarArraste, faltarHoje, faltarAula, desfazerFalta } from "./telas/lista.js";
import { telaDetalhe, falta, nota, notaSub, exame, simular } from "./telas/cadeira.js";
import { telaForm, desenharAvsForm, desenharAulasForm, somaForm, addSub, addAvForm, salvarForm, excluir,
         addAulaForm, campoAulaForm, removerAulaForm, campoAvForm, removerAvForm, campoSubForm, removerSubForm } from "./telas/formulario.js";
import { telaAgenda, telaEvento, salvarEvento, excluirEvento } from "./telas/agenda.js";
import { telaGrade, horarioAula, ajustarGrade } from "./telas/grade.js";
import { telaImportar, importarPlanos, opcaoPlano, confirmarImportacao } from "./telas/importacao.js";
import { telaSobre } from "./telas/sobre.js";

// Tela atual. Exportada como ligação viva: os outros módulos leem tela.nome/tela.id; só ir() a troca.
export let tela = {nome:"lista"};

const ABAS=["lista","agenda","grade"];
export function abas(at){ const b=(k,t)=>`<button class="${at===k?"on":""}" onclick="ir('${k}')">${t}</button>`; return `<div class="abas" data-para="${ABAS.indexOf(at)}"><span class="ind"></span>${b("lista","Cadeiras")}${b("agenda","Agenda")}${b("grade","Grade")}</div>`; }

/* ---------- Telas ---------- */
export function render(){
  antesDoRender(); // mede as posições atuais, para a reordenação da lista deslizar (animacoes.js)
  const app=document.getElementById("app"), topo=document.getElementById("topo"), titulo=document.getElementById("titulo");
  topo.innerHTML="";
  if(tela.nome==="lista"){ titulo.textContent="Minhas cadeiras"; app.innerHTML=telaLista(); }
  else if(tela.nome==="form"){ titulo.textContent=tela.id?"Editar cadeira":"Nova cadeira"; topo.innerHTML=`<button class="volta" onclick="ir('lista')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14.5 5.5 8 12l6.5 6.5"/></svg>Voltar</button>`; app.innerHTML=telaForm(); desenharAvsForm(); desenharAulasForm(); }
  else if(tela.nome==="sobre"){ titulo.textContent="Sobre"; topo.innerHTML=`<button class="volta" onclick="ir('lista')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14.5 5.5 8 12l6.5 6.5"/></svg>Voltar</button>`; app.innerHTML=telaSobre(); }
  else if(tela.nome==="grade"){ titulo.textContent="Grade semanal"; app.innerHTML=telaGrade(); ajustarGrade(); }
  else if(tela.nome==="agenda"){ titulo.textContent="Agenda"; app.innerHTML=telaAgenda(); }
  else if(tela.nome==="evento"){ titulo.textContent="Novo evento"; topo.innerHTML=`<button class="volta" onclick="ir('agenda')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14.5 5.5 8 12l6.5 6.5"/></svg>Voltar</button>`; app.innerHTML=telaEvento(); }
  else if(tela.nome==="importar"){ titulo.textContent="Revisar importação"; topo.innerHTML=`<button class="volta" onclick="ir('lista')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14.5 5.5 8 12l6.5 6.5"/></svg>Cancelar</button>`; app.innerHTML=telaImportar(); }
  else if(tela.nome==="detalhe"){ const c=achar(tela.id); if(!c){ir("lista");return;} titulo.textContent=c.nome; topo.innerHTML=`<button class="volta" onclick="ir('lista')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14.5 5.5 8 12l6.5 6.5"/></svg>Voltar</button>`; app.innerHTML=telaDetalhe(c); }
  efeitos();
}
export function ir(nome,id){ tela={nome,id}; render(); window.scrollTo(0,0); }

/* ---------- Auxiliares de formulário ---------- */
export function alertaCampo(i){ const e=document.getElementById(i); e.style.borderColor="var(--erro)"; e.focus(); }
let _conf=null;
// Usa window.event (o evento do handler inline que chamou), como na versão original.
export function confirmar(k){ if(_conf===k){ _conf=null; return true; } _conf=k; const b=event.target; b.textContent="Toque de novo para confirmar"; setTimeout(()=>{_conf=null;},3000); return false; }

/* ---------- Ponte para os handlers inline ----------
   O HTML gerado pelas telas usa onclick/onchange/oninput inline, que procuram as funções no escopo global.
   Módulos ES não criam globais, então expomos aqui, num lugar só, exatamente as funções que o HTML chama.
   Só funções vão para window; o estado (dados, tela, formulário, planos) continua privado nos módulos. */
Object.assign(window, {
  ir, render, trocarTema,
  // lista e "Hoje"
  abrirCadeira, faltarHoje, faltarAula, desfazerFalta,
  // detalhe da cadeira
  falta, nota, notaSub, exame, simular,
  // formulário
  desenharAulasForm, somaForm, addSub, addAvForm, salvarForm, excluir,
  addAulaForm, campoAulaForm, removerAulaForm, campoAvForm, removerAvForm, campoSubForm, removerSubForm,
  // agenda e grade
  salvarEvento, excluirEvento, horarioAula,
  // importação de planos
  importarPlanos, opcaoPlano, confirmarImportacao,
  // backup
  salvarBackup, lerBackup, restaurarBackup,
});

/* ---------- Inicialização ---------- */
iniciarAnimacoes();
iniciarArraste();
iniciarTema();
if("serviceWorker" in navigator && location.protocol.startsWith("http")) navigator.serviceWorker.register("sw.js").catch(()=>{});

render();
