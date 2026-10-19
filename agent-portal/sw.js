const VEUX_CACHE='cavyre-agent-shell-16.12.133-app';
const OFFLINE='./offline.html';
self.addEventListener('install',event=>event.waitUntil(caches.open(VEUX_CACHE).then(cache=>cache.addAll([OFFLINE,'./manifest.webmanifest','./icons/icon-192.png','./icons/icon-512.png','./icons/maison-symbol-ivory.svg'])).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>(key.startsWith('veux-agent-shell-')||key.startsWith('cavyre-agent-shell-'))&&key!==VEUX_CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{const req=event.request,url=new URL(req.url);if(req.method!=='GET'||url.origin!==location.origin)return;if(url.pathname.includes('/api/')||url.pathname.includes('/.netlify/functions/'))return;if(req.mode==='navigate'){event.respondWith(fetch(req,{cache:'no-store'}).catch(()=>caches.match(OFFLINE)));return;}if(/\.(?:css|js)(?:\?|$)/i.test(url.pathname)){event.respondWith(fetch(req,{cache:'no-store'}).catch(()=>caches.match(req)));return;}});

/* ---- alerts (Web Push) ----
   The push itself carries no text. When it arrives we ask the server what is waiting for this device and show it. */
self.addEventListener('push',event=>{
  event.waitUntil((async()=>{
    let alerts=[];
    try{
      const sub=await self.registration.pushManager.getSubscription();
      if(sub){
        const r=await fetch(new URL('/api/public/push/inbox',self.location.origin).href,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({endpoint:sub.endpoint}),cache:'no-store'});
        const d=await r.json().catch(()=>({}));alerts=Array.isArray(d.alerts)?d.alerts:[];
      }
    }catch(_e){}
    if(!alerts.length)alerts=[{title:'Maison de Veux',body:'There is new activity in your portal.',url:'./',tag:'mdv-generic'}];
    const icon=new URL('icons/icon-192.png',self.registration.scope).href;
    await Promise.all(alerts.map(a=>self.registration.showNotification(a.title||'Maison de Veux',{body:a.body||'',icon,badge:icon,tag:a.tag||a.id||undefined,renotify:!!a.tag,data:{url:a.url||'./'}})));
  })());
});
self.addEventListener('notificationclick',event=>{
  event.notification.close();
  const raw=(event.notification.data&&event.notification.data.url)||'./';
  const target=new URL(raw,self.registration.scope).href;
  event.waitUntil((async()=>{
    const list=await self.clients.matchAll({type:'window',includeUncontrolled:true});
    for(const c of list){
      if(c.url.startsWith(self.registration.scope)){
        try{await c.focus();}catch(_e){}
        c.postMessage({type:'mdv-alert-open',url:target});
        return;
      }
    }
    await self.clients.openWindow(target);
  })());
});
