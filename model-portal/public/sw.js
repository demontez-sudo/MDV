const CACHE='maison-models-shell-1';
const SCOPE=self.registration.scope;
const OFFLINE=new URL('offline.html',SCOPE).href;
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(c=>c.addAll([OFFLINE,new URL('icons/icon-192.png',SCOPE).href,new URL('icons/icon-512.png',SCOPE).href])).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('maison-models-shell-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
/* pages and data always come fresh from the network; only the offline screen is kept */
self.addEventListener('fetch',event=>{
  const req=event.request,url=new URL(req.url);
  if(req.method!=='GET'||url.origin!==location.origin)return;
  if(url.pathname.includes('/api/')||url.pathname.includes('/.netlify/functions/'))return;
  if(req.mode==='navigate'){event.respondWith(fetch(req,{cache:'no-store'}).catch(()=>caches.match(OFFLINE)));}
});
