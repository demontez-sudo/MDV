/* Alerts: turn on notifications for this device (MacBook or iPhone), choose what you are told about, send a test.
   Uses Web Push through the portal's service worker. On iPhone, alerts only work once the portal is on the Home Screen (iOS 16.4 or later).
   Server: /api/agent/push (devices, preferences, test), /api/public/push/inbox (read by the service worker). */
(function(){
'use strict';
if(window.MDV_ALERTS)return;

var CATS=[['mentions','Someone mentions me in a note'],['tasks','A task is assigned to me'],['applications','A new Get Scouted application arrives'],['packages','A client opens or replies to a package'],['followups','A follow-up on one of my notes is due']];
var S={cfg:null,loading:false,err:'',busy:false,sub:null,host:null,perm:'default',checked:false};

function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
function arr(v){return Array.isArray(v)?v:[];}
function bridge(){var b=window.VEUX_AGENT_V4;if(!b||!b.api)throw new Error('Secure session is not ready');return b;}
function org(){try{return bridge().state.org.slug||'maison-de-veux';}catch(e){return 'maison-de-veux';}}
function msg(e){return (e&&e.message)||String(e||'Something went wrong');}
function toast(m,bad){var o=document.querySelector('.al-toast');if(o)o.remove();var d=document.createElement('div');d.className='al-toast'+(bad?' bad':'');d.textContent=m;document.body.appendChild(d);setTimeout(function(){d.remove();},4800);}
function get(){return bridge().api('/api/agent/push?organization='+encodeURIComponent(org())+'&_t='+Date.now(),{method:'GET',headers:{},__fresh:true});}
function post(b){return bridge().api('/api/agent/push',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(Object.assign({organization_slug:org()},b)),__fresh:true});}

/* ---------- what can this device do? ---------- */
var UA=navigator.userAgent||'';
var IOS=/iPhone|iPad|iPod/.test(UA)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
function standalone(){try{return navigator.standalone===true||matchMedia('(display-mode: standalone)').matches;}catch(e){return false;}}
function supported(){return 'serviceWorker' in navigator&&'PushManager' in window&&'Notification' in window;}
function mount(){return window.__VEUX_AGENT_MOUNT__||'';}
function b64(s){var p='='.repeat((4-s.length%4)%4),b=(s+p).replace(/-/g,'+').replace(/_/g,'/'),r=atob(b),o=new Uint8Array(r.length);for(var i=0;i<r.length;i++)o[i]=r.charCodeAt(i);return o;}
async function registration(){
  var reg=await navigator.serviceWorker.getRegistration(mount()+'/');
  if(!reg)reg=await navigator.serviceWorker.register(mount()+'/sw.js',{scope:mount()+'/'});
  return navigator.serviceWorker.ready.then(function(r){return r||reg;});
}
async function currentSub(){
  if(!supported())return null;
  try{var reg=await navigator.serviceWorker.getRegistration(mount()+'/');return reg?await reg.pushManager.getSubscription():null;}catch(e){return null;}
}

/* ---------- turn on / off ---------- */
async function enable(){
  if(S.busy)return;S.busy=true;paint();
  try{
    if(!S.cfg)S.cfg=await get();
    if(!S.cfg.configured)throw new Error('Alerts are not set up on the server yet.');
    if(!supported())throw new Error(IOS&&!standalone()?'On iPhone, add the portal to your Home Screen first, then open it from there.':'This browser cannot receive alerts.');
    var reg=await registration();
    var perm=await Notification.requestPermission();S.perm=perm;
    if(perm!=='granted')throw new Error(perm==='denied'?'Alerts are blocked for this site. Allow them in your browser or system settings, then try again.':'Alerts were not allowed.');
    var sub=await reg.pushManager.getSubscription();
    var key=b64(S.cfg.public_key);
    if(sub){var cur=sub.options&&sub.options.applicationServerKey;if(cur&&cur.byteLength&&new Uint8Array(cur).join()!==key.join()){await sub.unsubscribe();sub=null;}}
    if(!sub)sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:key});
    var r=await post({action:'subscribe',subscription:sub.toJSON(),platform:IOS?'iPhone / iPad':null});
    if(!r||r.verified!==true)throw new Error('The server did not confirm this device.');
    S.sub=sub;toast('✓ Alerts are on for this device');
    S.cfg=await get();
  }catch(e){toast(msg(e),true);}
  S.busy=false;paint();
}
async function disable(){
  if(S.busy)return;S.busy=true;paint();
  try{var sub=await currentSub();if(sub){try{await post({action:'unsubscribe',endpoint:sub.endpoint});}catch(e){}await sub.unsubscribe();}S.sub=null;S.cfg=await get();toast('Alerts are off for this device');}
  catch(e){toast(msg(e),true);}
  S.busy=false;paint();
}
async function test(){
  if(S.busy)return;S.busy=true;paint();
  try{var r=await post({action:'test'});toast('Test sent to '+r.devices+' device'+(r.devices===1?'':'s')+'. It should arrive in a few seconds.');}
  catch(e){toast(msg(e),true);}
  S.busy=false;paint();
}
async function savePrefs(prefs){try{await post({action:'prefs',prefs:prefs});}catch(e){toast(msg(e),true);}}

/* ---------- the page ---------- */
function mine(){return arr(S.cfg&&S.cfg.devices);}
function thisDevice(){var tail=S.sub?String(S.sub.endpoint).slice(-12):'';return mine().filter(function(d){return d.endpoint_tail===tail;})[0]||null;}
function statusHtml(){
  var cfg=S.cfg;
  if(!cfg)return '<div class="al-state"><i class="ti ti-bell"></i><div><h3>Checking…</h3></div></div>';
  if(!cfg.configured||!cfg.table_ready)return '<div class="al-state warn"><i class="ti ti-settings"></i><div><h3>One-time setup needed</h3><p>Alerts need two things on the server. An admin does them once, and then everyone can turn alerts on.</p><ol class="al-steps"><li>Run <code>agent-portal/docs/sql/2026-10-18-push-alerts.sql</code> in the Supabase SQL editor.</li><li>On a computer, run <code>node scripts/generate-vapid.mjs</code> and add the three lines it prints to Netlify → Environment variables for the agent portal site. Then redeploy.</li></ol><button type="button" class="al-btn" data-act="recheck">Check again</button></div></div>';
  if(IOS&&!standalone())return '<div class="al-state"><i class="ti ti-device-mobile"></i><div><h3>Add the portal to your Home Screen</h3><p>iPhone only delivers alerts to apps on the Home Screen. It takes a moment:</p><ol class="al-steps"><li>Open this page in <b>Safari</b>.</li><li>Tap the <b>Share</b> button, then <b>Add to Home Screen</b>.</li><li>Open the portal from its new icon, sign in, and come back to this page.</li></ol></div></div>';
  if(!supported())return '<div class="al-state warn"><i class="ti ti-bell-off"></i><div><h3>This browser cannot receive alerts</h3><p>Use Safari 16 or newer, Chrome or Edge on your MacBook.</p></div></div>';
  if(S.perm==='denied')return '<div class="al-state warn"><i class="ti ti-bell-off"></i><div><h3>Alerts are blocked</h3><p>'+(IOS?'Open Settings → Notifications → the portal, and allow notifications.':'Allow notifications for this site: in Safari, Settings → Websites → Notifications; in Chrome, the lock icon next to the address.')+' Then press the button below.</p><button type="button" class="al-btn gold" data-act="on">Try again</button></div></div>';
  var on=!!S.sub&&!!thisDevice();
  return on?'<div class="al-state ok"><i class="ti ti-bell-ringing"></i><div><h3>Alerts are on for this device</h3><p>You will be told about the things ticked below, even when the portal is closed.</p><div class="al-row"><button type="button" class="al-btn gold" data-act="test">Send a test alert</button><button type="button" class="al-btn" data-act="off">Turn off on this device</button></div></div></div>'
    :'<div class="al-state"><i class="ti ti-bell"></i><div><h3>Alerts are off on this device</h3><p>Turn them on to be told about mentions, new tasks, applications and client activity. You choose what.</p><button type="button" class="al-btn gold" data-act="on">Turn on alerts</button></div></div>';
}
function prefsHtml(){
  var cfg=S.cfg;if(!cfg||!cfg.configured||!cfg.table_ready||!mine().length)return '';
  var p=mine()[0].prefs||{};
  return '<section class="al-card"><h3>Tell me when…</h3><div class="al-prefs">'+CATS.map(function(c){return '<label class="al-pref"><input type="checkbox" data-pref="'+c[0]+'"'+(p[c[0]]===false?'':' checked')+'><span>'+esc(c[1])+'</span></label>';}).join('')+'</div><p class="al-mute">These choices apply to all your devices.</p></section>';
}
function devicesHtml(){
  var d=mine();if(!d.length)return '';
  var tail=S.sub?String(S.sub.endpoint).slice(-12):'';
  return '<section class="al-card"><h3>Your devices</h3><ul class="al-dev">'+d.map(function(x){var me=x.endpoint_tail===tail;return '<li><i class="ti '+(/iPhone|iPad/.test(x.platform)?'ti-device-mobile':'ti-device-laptop')+'"></i><div><b>'+esc(x.platform)+(me?' <em>this device</em>':'')+'</b><small>Added '+esc(new Date(x.created_at).toLocaleDateString([],{month:'short',day:'numeric',year:'numeric'}))+'</small></div><button type="button" class="al-link" data-rm="'+esc(x.id)+'">Remove</button></li>';}).join('')+'</ul></section>';
}
function paint(){
  var el=S.host;if(!el||!el.isConnected)return;
  el.innerHTML='<div class="al"><header class="al-head"><small>ALERTS & DEVICES</small><h1>Know the moment something happens</h1><p>Get an alert on your MacBook and iPhone for mentions, tasks, new applications and client activity.</p></header>'
    +(S.err?'<p class="al-err">'+esc(S.err)+'</p>':'')+'<section class="al-card big">'+statusHtml()+(S.busy?'<div class="al-busy">Working…</div>':'')+'</section>'+prefsHtml()+devicesHtml()
    +'<section class="al-card"><h3>What triggers an alert</h3><ul class="al-list"><li><b>Mentions</b> Someone @mentions you in a Smart Note.</li><li><b>Tasks</b> A task is assigned to you.</li><li><b>Applications</b> Someone submits the Get Scouted form.</li><li><b>Packages</b> A client first opens a package, or replies to one.</li><li><b>Follow-ups</b> A reminder you set on a note comes due.</li></ul></section></div>';
  el.querySelectorAll('[data-act]').forEach(function(b){b.onclick=function(){var a=b.dataset.act;if(a==='on')enable();else if(a==='off')disable();else if(a==='test')test();else if(a==='recheck')load(true).then(paint);};});
  el.querySelectorAll('[data-pref]').forEach(function(c){c.onchange=function(){var p={};el.querySelectorAll('[data-pref]').forEach(function(x){p[x.dataset.pref]=x.checked;});savePrefs(p);};});
  el.querySelectorAll('[data-rm]').forEach(function(b){b.onclick=async function(){try{await post({action:'remove_device',id:b.dataset.rm});S.cfg=await get();var t=await currentSub();if(t&&!mine().some(function(d){return d.endpoint_tail===String(t.endpoint).slice(-12);})){S.sub=null;}paint();}catch(e){toast(msg(e),true);}};});
}
async function load(force){
  if(S.loading)return;S.loading=true;
  try{if(supported())S.perm=Notification.permission;S.sub=await currentSub();S.cfg=await get();S.err='';}catch(e){S.err=msg(e);}
  S.loading=false;S.checked=true;
}
window.renderAlerts=function(el){S.host=el;paint();return load(true).then(paint);};

/* ---------- opening the portal from an alert ---------- */
function openFromUrl(u){
  try{var page=new URL(u,location.href).searchParams.get('page');if(page&&typeof window.navTo==='function'){window.navTo(page);return true;}}catch(e){}
  return false;
}
if('serviceWorker' in navigator)navigator.serviceWorker.addEventListener('message',function(e){if(e.data&&e.data.type==='mdv-alert-open')openFromUrl(e.data.url);});
(function landing(){
  try{var pg=new URLSearchParams(location.search).get('page');if(!pg)return;var n=0,t=setInterval(function(){if(typeof window.navTo==='function'&&document.getElementById('app')&&getComputedStyle(document.getElementById('app')).display!=='none'){clearInterval(t);window.navTo(pg);}else if(++n>60)clearInterval(t);},500);}catch(e){}
})();

/* ---------- a gentle one-time offer ---------- */
function ready(){return window.VEUX_AGENT_V4&&VEUX_AGENT_V4.api&&document.getElementById('app')&&getComputedStyle(document.getElementById('app')).display!=='none';}
function offer(){
  try{
    if(!supported()||Notification.permission!=='default'||(IOS&&!standalone()))return;
    var until=Number(localStorage.getItem('mdv-alerts-later'))||0;if(Date.now()<until)return;
    if(document.getElementById('al-offer'))return;
    get().then(function(cfg){
      S.cfg=cfg;if(!cfg.configured||!cfg.table_ready)return;
      if(cfg.devices&&cfg.devices.length)return;
      var d=document.createElement('div');d.id='al-offer';d.setAttribute('role','dialog');
      d.innerHTML='<i class="ti ti-bell-ringing"></i><div><b>Get alerts on this device?</b><span>Mentions, new tasks, applications and client activity, even when the portal is closed.</span></div><button type="button" class="al-btn gold" data-y>Turn on</button><button type="button" class="al-x" data-n aria-label="Not now">×</button>';
      document.documentElement.appendChild(d);
      d.querySelector('[data-y]').onclick=function(){d.remove();enable();};
      d.querySelector('[data-n]').onclick=function(){try{localStorage.setItem('mdv-alerts-later',String(Date.now()+7*864e5));}catch(e){}d.remove();};
    }).catch(function(){});
  }catch(e){}
}
var tries=0,iv=setInterval(function(){if(++tries>120){clearInterval(iv);return;}if(ready()){clearInterval(iv);setTimeout(offer,9000);}},2000);
(function register(){
  function put(){var m=window.VEUX_V15_ROUTE_RENDERERS;if(m&&typeof m==='object'){m.alerts=function(el){return window.renderAlerts(el);};return true;}return false;}
  if(put())return;var n=0,t=setInterval(function(){if(put()||++n>400)clearInterval(t);},150);
  ['veux:shell-ready','veux:assets-ready','veux:auth-ready'].forEach(function(e){window.addEventListener(e,put);});
})();
window.MDV_ALERTS={enable:enable,disable:disable,test:test,state:S};
})();
