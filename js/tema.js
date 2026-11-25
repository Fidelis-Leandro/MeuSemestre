// Tema claro/escuro. A preferência manual fica em "meusemestre-tema" (mesma chave de sempre).
// O <script> inline no <head> do index.html aplica a classe antes da pintura, para não piscar.
const CHAVE_TEMA = "meusemestre-tema";

function sistemaEscuro(){ return matchMedia("(prefers-color-scheme: dark)").matches; }
function temaAtual(){ try{ const t=localStorage.getItem(CHAVE_TEMA); if(t==="claro"||t==="escuro") return t; }catch(e){} return sistemaEscuro()?"escuro":"claro"; }
function aplicarTema(){
  const esc=temaAtual()==="escuro";
  document.documentElement.classList.toggle("escuro",esc);
  document.querySelector('meta[name=theme-color]').content=esc?"#0d1620":"#F6FAFE";
  document.getElementById("btn-tema").textContent=esc?"Modo claro":"Modo escuro";
}
export function trocarTema(){
  const novo=temaAtual()==="escuro"?"claro":"escuro";
  try{ if((novo==="escuro")===sistemaEscuro()) localStorage.removeItem(CHAVE_TEMA); else localStorage.setItem(CHAVE_TEMA,novo); }catch(e){}
  aplicarTema();
}
export function iniciarTema(){
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change",aplicarTema);
  aplicarTema();
}
