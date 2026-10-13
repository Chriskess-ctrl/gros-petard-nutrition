import { emptyState, validateState, migrateV1 } from './core.js';

const basePath = new URL('./', location.href).pathname;
const DB_NAME = 'gp-nutrition-v2:' + basePath;
const FALLBACK_KEY = DB_NAME;
let connection = null;
let mode = 'indexeddb';
export const storageMode = () => mode;

function openDB() {
  return new Promise((resolve,reject)=>{
    const request=indexedDB.open(DB_NAME,1);
    request.onupgradeneeded=()=>request.result.createObjectStore('journal');
    request.onsuccess=()=>{connection=request.result;connection.onversionchange=()=>connection.close();resolve(connection);};
    request.onerror=()=>reject(request.error);
    request.onblocked=()=>reject(Error('Ferme les autres onglets de cette application puis réessaie.'));
  });
}
function readDB() {
  return new Promise((resolve,reject)=>{
    const tx=connection.transaction('journal','readonly');const request=tx.objectStore('journal').get('state');
    request.onsuccess=()=>resolve(request.result??null);request.onerror=()=>reject(request.error);
  });
}
export async function load() {
  let saved;
  try { if(!connection)await openDB(); saved=await readDB(); }
  catch { mode='localstorage';const probe=FALLBACK_KEY+':probe';localStorage.setItem(probe,'1');localStorage.removeItem(probe);saved=JSON.parse(localStorage.getItem(FALLBACK_KEY)||'null'); }
  // Don’t silently replace an unreadable journal with an empty one.
  if(saved) return {state:validateState(saved),migrated:false};
  const fallback=localStorage.getItem(FALLBACK_KEY);
  if(mode==='indexeddb'&&fallback){const state=validateState(JSON.parse(fallback));await save(state,null);return {state,migrated:false};}
  const old=localStorage.getItem('gp-nutrition-v1');
  if(old){const state=migrateV1(JSON.parse(old));state.updatedAt=new Date().toISOString();await save(state,null);return {state,migrated:true};}
  return {state:emptyState(),migrated:false};
}
export async function reload() {
  const data=mode==='indexeddb'?await readDB():JSON.parse(localStorage.getItem(FALLBACK_KEY)||'null');return data?validateState(data):emptyState();
}
export async function save(data, expectedUpdatedAt) {
  const clean=validateState(data);
  if(mode==='localstorage') {
    if(expectedUpdatedAt!==undefined){const current=JSON.parse(localStorage.getItem(FALLBACK_KEY)||'null');if((current?.updatedAt??null)!==expectedUpdatedAt)throw Error('Le journal a changé dans un autre onglet. Recharge la page avant de réessayer.');}
    localStorage.setItem(FALLBACK_KEY,JSON.stringify(clean));return;
  }
  return new Promise((resolve,reject)=>{
    const tx=connection.transaction('journal','readwrite'),store=tx.objectStore('journal'),r=store.get('state');
    let conflict=false;
    r.onsuccess=()=>{if(expectedUpdatedAt!==undefined&&(r.result?.updatedAt??null)!==expectedUpdatedAt){conflict=true;tx.abort();return;}store.put(clean,'state');};
    tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error||Error('L’enregistrement a échoué.'));tx.onabort=()=>reject(conflict?Error('Le journal a changé dans un autre onglet. Recharge la page avant de réessayer.'):tx.error||Error('Espace de stockage indisponible. Exporte une sauvegarde et libère de l’espace.'));
  });
}
export async function removeLegacy() { localStorage.removeItem('gp-nutrition-v1');if(mode==='indexeddb')localStorage.removeItem(FALLBACK_KEY); }
export const channelName = DB_NAME;
