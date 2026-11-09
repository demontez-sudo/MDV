const VEUX_CACHE='cavyre-agent-shell-16.12.133-app';
const OFFLINE='./offline.html';
self.addEventListener('install',event=>event.waitUntil(caches.open(VEUX_CACHE).then(cache=>cache.addAll([OFFLINE,'./manifest.webmanifest','./icons/icon-192.png','./icons/icon-512.png','./icons/maison-symbol-ivory.svg'])).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>(key.startsWith('veux-agent-shell-')||key.startsWith('cavyre-agent-shell-'))&&key!==VEUX_CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{const req=event.request,url=new URL(req.url);if(req.method!=='GET'||url.origin!==location.origin)return;if(url.pathname.includes('/api/')||url.pathname.includes('/.netlify/functions/'))return;if(req.mode==='navigate'){event.respondWith(fetch(req,{cache:'no-store'}).catch(()=>caches.match(OFFLINE)));return;}if(/\.(?:css|js)(?:\?|$)/i.test(url.pathname)){event.respondWith(fetch(req,{cache:'no-store'}).catch(()=>caches.match(req)));return;}});

/* ---- alerts (Web Push) ----
   The push itself carries no text. When it arrives we ask the server what is waiting for this device and show it.
   How an alert behaves depends on its level: urgent stays on screen until dismissed and buzzes in a pattern; soon buzzes twice;
   info is a single quiet tap; win is a short happy flutter. The app icon also gets a number for what is still unread. */
const LOOK={
  urgent:{requireInteraction:true,vibrate:[300,120,300,120,600],actions:true},
  soon:{requireInteraction:false,vibrate:[200,100,200],actions:true},
  info:{requireInteraction:false,vibrate:[120],actions:false},
  win:{requireInteraction:false,vibrate:[80,60,80,60,220],actions:false}
};
function levelOf(a){
  const m=a.meta&&a.meta.level;if(LOOK[m])return m;
  const t=String(a.title||'');
  if(/hard stop in|🚨|missed a hard stop/i.test(t))return 'urgent';
  if(/slipped|overdue|missed|⚠️/i.test(t))return 'soon';
  return 'info';
}
async function setBadge(){
  try{
    const n=(await self.registration.getNotifications()).length;
    if(self.navigator&&self.navigator.setAppBadge){if(n>0)await self.navigator.setAppBadge(n);else if(self.navigator.clearAppBadge)await self.navigator.clearAppBadge();}
  }catch(_e){}
}
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
    /* when several arrive at once, show the most urgent last so it is the one on top */
    const rank={info:0,win:0,soon:1,urgent:2};
    alerts.sort((a,b)=>rank[levelOf(a)]-rank[levelOf(b)]);
    await Promise.all(alerts.map(a=>{
      const lv=levelOf(a),look=LOOK[lv],meta=a.meta||{};
      const opts={body:a.body||'',icon,badge:icon,tag:a.tag||a.id||undefined,renotify:!!a.tag,requireInteraction:look.requireInteraction,vibrate:look.vibrate,
        timestamp:Date.parse(a.created_at)||Date.now(),data:{url:a.url||'./',level:lv}};
      if(/^https:\/\//.test(String(meta.image||'')))opts.image=meta.image;
      if(look.actions)opts.actions=[{action:'open',title:'Open'},{action:'dismiss',title:'Got it'}];
      return self.registration.showNotification(a.title||'Maison de Veux',opts);
    }));
    await setBadge();
    /* a portal tab that is open gets the alert too, as a banner with a chime (see assets/mdv-alerts.js) */
    try{
      const wins=await self.clients.matchAll({type:'window',includeUncontrolled:true});
      wins.forEach(w=>{if(w.url.startsWith(self.registration.scope))w.postMessage({type:'mdv-alert-show',alerts:alerts.map(a=>({title:a.title,body:a.body,url:a.url,level:levelOf(a)}))});});
    }catch(_e){}
  })());
});
self.addEventListener('notificationclose',event=>{event.waitUntil(setBadge());});
self.addEventListener('notificationclick',event=>{
  event.notification.close();
  if(event.action==='dismiss'){event.waitUntil(setBadge());return;}
  const raw=(event.notification.data&&event.notification.data.url)||'./';
  const target=new URL(raw,self.registration.scope).href;
  event.waitUntil((async()=>{
    await setBadge();
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
