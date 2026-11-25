// Dados do usuário: leitura/gravação no localStorage, backup e restauração.
// A chave "ufcspa-faltas-notas-v1" é a mesma desde a primeira versão: não mude, senão os dados salvos somem.
import { ir, render } from "./app.js";

const CHAVE = "ufcspa-faltas-notas-v1";
// "dados" é exportado como ligação viva (live binding): quem importa sempre enxerga o valor atual,
// inclusive depois de restaurarBackup() trocar o objeto inteiro.
export let dados = carregar(); dados.eventos = dados.eventos || []; dados.criadoEm = dados.criadoEm || new Date().toISOString();
try{ navigator.storage && navigator.storage.persist && navigator.storage.persist(); }catch(e){}

function carregar(){ try{ return JSON.parse(localStorage.getItem(CHAVE)) || {cadeiras:[]}; }catch(e){ return {cadeiras:[]}; } }
export function salvar(){ try{ localStorage.setItem(CHAVE, JSON.stringify(dados)); }catch(e){} }
export function achar(i){ return dados.cadeiras.find(c=>c.id===i); }

/* ---------- Backup ---------- */
export function diasDesde(iso){ return iso ? Math.floor((Date.now()-new Date(iso))/86400000) : null; }
export function salvarBackup(){
  dados.ultimoBackup=new Date().toISOString(); salvar();
  const blob=new Blob([JSON.stringify({app:"MeuSemestre",versao:1,salvoEm:dados.ultimoBackup,dados},null,1)],{type:"application/json"});
  const a=document.createElement("a"); a.href=URL.createObjectURL(blob);
  a.download=`meusemestre-backup-${dados.ultimoBackup.slice(0,10)}.json`;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(a.href),1000);
  render();
}
let _backupPendente=null;
export async function lerBackup(f){
  if(!f) return;
  const msg=document.getElementById("bk-msg");
  try{
    const j=JSON.parse(await f.text()), d=j.dados||j;
    if(!Array.isArray(d.cadeiras)) throw 0;
    _backupPendente=d;
    const quando=j.salvoEm?new Date(j.salvoEm).toLocaleDateString("pt-BR"):"data desconhecida";
    msg.innerHTML=`<div class="destaque"><div style="font-weight:700">Backup de ${quando}: ${d.cadeiras.length} cadeira(s), ${(d.eventos||[]).length} evento(s).</div>
      <div class="meta" style="margin:4px 0 10px">Restaurar substitui tudo o que está neste aparelho agora.</div>
      <div class="linha"><button onclick="restaurarBackup()">Restaurar</button><button class="sec" onclick="document.getElementById('bk-msg').innerHTML=''">Cancelar</button></div></div>`;
  }catch(e){ msg.innerHTML=`<div class="aviso" style="color:var(--erro)">Este arquivo não é um backup do MeuSemestre.</div>`; }
}
export function restaurarBackup(){
  if(!_backupPendente) return;
  dados=_backupPendente; dados.eventos=dados.eventos||[]; dados.ultimoBackup=dados.ultimoBackup||new Date().toISOString();
  _backupPendente=null; salvar(); ir("lista");
}
