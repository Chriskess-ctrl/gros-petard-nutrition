// Un cache de code par dossier. Aucun journal personnel ni requête externe.
const VERSION = '2.0.0';
const SCOPE = new URL(self.registration.scope).pathname;
const PREFIX = 'gp-nutrition:'+SCOPE+':';
const CACHE = PREFIX+VERSION;
const FILES = ['./','./index.html','./style.css','./app.js','./core.js','./storage.js','./foods.js','./reports.js','./pdf-lib.min.js','./manifest.webmanifest','./icon-192.png','./icon-512.png','./icon-maskable-512.png'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(FILES))));
self.addEventListener('message',event=>{if(event.data?.type==='SKIP_WAITING')self.skipWaiting();});
self.addEventListener('activate',event=>event.waitUntil((async()=>{
  const names=await caches.keys();await Promise.all(names.filter(n=>n.startsWith(PREFIX)&&n!==CACHE).map(n=>caches.delete(n)));
  // Retire uniquement le cache connu de la V1, sans toucher aux autres applis.
  await caches.delete('gp-nutrition-v1');await self.clients.claim();
})()));
self.addEventListener('fetch',event=>{
  const url=new URL(event.request.url);
  if(event.request.method!=='GET'||url.origin!==self.location.origin||!url.pathname.startsWith(SCOPE))return;
  event.respondWith((async()=>{
    const cache=await caches.open(CACHE);
    if(event.request.mode==='navigate')return (await cache.match('./index.html'))||fetch(event.request);
    const cached=await cache.match(event.request,{ignoreSearch:true});if(cached)return cached;
    return fetch(event.request);
  })());
});
