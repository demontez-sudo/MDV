/* Maison de Veux as an app: install on Mac / iPhone / Android, update prompt, offline notice, unread count on the app icon.
   Shared by the agent portal and the model portal.
   Agent portal: window.__VEUX_AGENT_MOUNT__ is set ('' or '/admin').  Model portal: served from /portal. */
(function(){
'use strict';
if(window.MDV_APP)return;

var AGENT=typeof window.__VEUX_AGENT_MOUNT__!=='undefined';
var BASE=AGENT?(window.__VEUX_AGENT_MOUNT__||''):'/portal';
var UA=navigator.userAgent||'';
var IOS=/iPhone|iPad|iPod/.test(UA)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
var IOS_SAFARI=IOS&&!/CriOS|FxiOS|EdgiOS|OPiOS|GSA\//.test(UA);
var MAC_SAFARI=!IOS&&/Macintosh/.test(UA)&&/Safari\//.test(UA)&&!/Chrome|Chromium|Edg\//.test(UA);
var ANDROID=/Android/.test(UA);
var deferred=null,pill=null;

function standalone(){try{return window.matchMedia('(display-mode: standalone)').matches||window.navigator.standalone===true;}catch(e){return false;}}
function later(){try{return Date.now()<(Number(localStorage.getItem('mdv-app-later'))||0);}catch(e){return false;}}
function setLater(days){try{localStorage.setItem('mdv-app-later',String(Date.now()+days*864e5));}catch(e){}}
function esc(s){return String(s).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}

/* ---------- running as an app ---------- */
function mark(){
  var h=document.documentElement;
  if(standalone())h.classList.add('is-app');else h.classList.remove('is-app');
  if(IOS)h.classList.add('is-ios');
}
mark();try{matchMedia('(display-mode: standalone)').addEventListener('change',mark);}catch(e){}
(function css(){
  var s=document.createElement('style');s.id='mdv-app-style';
  s.textContent='html.is-app body{overscroll-behavior-y:none}html.is-app{-webkit-touch-callout:none}'
  +'#mdv-install{position:fixed;left:18px;bottom:20px;z-index:6950;display:flex;align-items:center;gap:10px;height:42px;padding:0 8px 0 16px;border-radius:999px;border:1px solid rgba(239,233,223,.22);background:rgba(18,16,13,.94);color:#efe9df;font:500 13px system-ui,-apple-system,Segoe UI,sans-serif;cursor:pointer;box-shadow:0 12px 34px rgba(0,0,0,.45)}'
  +'#mdv-install:hover{border-color:#c9a878}#mdv-install img{width:20px;height:20px;border-radius:5px}#mdv-install .x{border:0;background:none;color:#a89f92;font-size:18px;line-height:1;cursor:pointer;width:28px;height:28px;border-radius:50%}'
  +'@media(max-width:820px){#mdv-install{left:12px;bottom:calc(86px + env(safe-area-inset-bottom,0px))}}'
  +'.mdv-app-back{position:fixed;inset:0;z-index:10200;background:rgba(5,5,8,.7);-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);display:grid;place-items:center;padding:18px}'
  +'.mdv-app-card{width:min(440px,100%);border:1px solid rgba(239,233,223,.16);border-radius:24px;background:#12100d;color:#efe9df;padding:24px;font-family:system-ui,-apple-system,Segoe UI,sans-serif;box-shadow:0 30px 90px rgba(0,0,0,.6)}'
  +'.mdv-app-card img{width:56px;height:56px;border-radius:14px;display:block;margin-bottom:14px}.mdv-app-card h2{margin:0 0 6px;font:400 24px Georgia,serif}.mdv-app-card p{margin:0 0 14px;color:#a89f92;font-size:14px;line-height:1.55}'
  +'.mdv-app-card ol{margin:0 0 18px;padding-left:20px;font-size:14px;line-height:1.75}.mdv-app-card b{font-weight:600}'
  +'.mdv-app-row{display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap}.mdv-app-row button{min-height:40px;padding:0 20px;border-radius:999px;border:1px solid rgba(239,233,223,.25);background:transparent;color:#efe9df;font:500 13px system-ui;cursor:pointer}'
  +'.mdv-app-row button.gold{background:linear-gradient(135deg,#f0d19a,#d4b077);border-color:transparent;color:#12100c;font-weight:600}'
  +'#mdv-offline{position:fixed;left:50%;top:max(10px,env(safe-area-inset-top,0px));transform:translateX(-50%);z-index:10210;background:#2a1d16;color:#f0d3b8;border:1px solid rgba(229,160,122,.5);border-radius:999px;padding:8px 18px;font:500 12.5px system-ui,sans-serif;box-shadow:0 10px 30px rgba(0,0,0,.4)}'
  +'#mdv-update{position:fixed;left:50%;bottom:90px;transform:translateX(-50%);z-index:10210;display:flex;gap:12px;align-items:center;background:#1a1712;color:#efe9df;border:1px solid rgba(212,176,119,.45);border-radius:999px;padding:8px 8px 8px 18px;font:500 13px system-ui,sans-serif;box-shadow:0 12px 34px rgba(0,0,0,.45)}#mdv-update button{border:0;border-radius:999px;background:linear-gradient(135deg,#f0d19a,#d4b077);color:#12100c;font:600 12.5px system-ui;padding:8px 16px;cursor:pointer}';
  (document.head||document.documentElement).appendChild(s);
})();

/* ---------- installing ---------- */
function steps(){
  if(IOS&&!IOS_SAFARI)return {t:'Open this in Safari',p:'iPhone can only add an app to the Home Screen from Safari. Open this page in Safari, then:',o:['Tap the <b>Share</b> button.','Choose <b>Add to Home Screen</b>.','Open Maison de Veux from the new icon.']};
  if(IOS)return {t:'Add to your Home Screen',p:'It opens full screen like any other app, and it is what lets your iPhone send you alerts.',o:['Tap the <b>Share</b> button at the bottom of Safari.','Scroll and tap <b>Add to Home Screen</b>.','Tap <b>Add</b>, then open Maison de Veux from the new icon.']};
  if(MAC_SAFARI)return {t:'Add to your Dock',p:'Safari on your Mac can keep Maison de Veux in the Dock like an app.',o:['In Safari choose <b>File → Add to Dock…</b>.','Press <b>Add</b>.','Open Maison de Veux from the Dock.']};
  if(ANDROID)return {t:'Install the app',p:'Add Maison de Veux to your phone.',o:['Open the browser menu (⋮).','Tap <b>Install app</b> or <b>Add to Home screen</b>.']};
  return {t:'Install the app',p:'Chrome and Edge can install Maison de Veux as its own window.',o:['Click the <b>install icon</b> at the right end of the address bar, or open the browser menu.','Choose <b>Install Maison de Veux</b>.']};
}
function modal(){
  var s=steps(),b=document.createElement('div');b.className='mdv-app-back';
  b.innerHTML='<div class="mdv-app-card" role="dialog" aria-modal="true"><img src="'+BASE+'/icons/icon-192.png" alt=""><h2>'+esc(s.t)+'</h2><p>'+s.p+'</p><ol>'+s.o.map(function(x){return '<li>'+x+'</li>';}).join('')+'</ol><div class="mdv-app-row"><button data-c>Close</button></div></div>';
  b.onclick=function(e){if(e.target===b)b.remove();};b.querySelector('[data-c]').onclick=function(){b.remove();};
  document.documentElement.appendChild(b);
}
async function install(){
  if(standalone())return 'installed';
  if(deferred){deferred.prompt();var r=await deferred.userChoice;deferred=null;if(pill)pill.remove();return r&&r.outcome;}
  modal();return 'shown';
}
window.addEventListener('beforeinstallprompt',function(e){e.preventDefault();deferred=e;});
window.addEventListener('appinstalled',function(){if(pill)pill.remove();mark();});
function loginVisible(){var l=document.getElementById('login');return !!(l&&getComputedStyle(l).display!=='none'&&l.offsetParent!==null||l&&getComputedStyle(l).position==='fixed'&&getComputedStyle(l).display!=='none');}
function offerPill(){
  if(standalone()||later()||document.getElementById('mdv-install')||loginVisible())return;
  if(!(deferred||IOS||MAC_SAFARI))return;               /* only where there is a way to install */
  pill=document.createElement('button');pill.id='mdv-install';pill.type='button';
  pill.innerHTML='<img src="'+BASE+'/icons/icon-192.png" alt=""><span>Install the app</span><span class="x" role="button" aria-label="Not now">×</span>';
  pill.onclick=function(e){if(e.target&&e.target.classList.contains('x')){setLater(14);pill.remove();return;}install();};
  document.documentElement.appendChild(pill);
}
setTimeout(offerPill,16000);

/* ---------- the service worker, and a nudge when there is a new version ---------- */
function register(){
  if(!('serviceWorker' in navigator))return;
  navigator.serviceWorker.register(BASE+'/sw.js',{scope:BASE+'/'}).then(function(reg){
    reg.addEventListener('updatefound',function(){
      var w=reg.installing;if(!w)return;
      w.addEventListener('statechange',function(){
        if(w.state==='installed'&&navigator.serviceWorker.controller&&!document.getElementById('mdv-update')){
          var d=document.createElement('div');d.id='mdv-update';d.innerHTML='<span>A new version is ready</span><button type="button">Reload</button>';
          d.querySelector('button').onclick=function(){location.reload();};document.documentElement.appendChild(d);
        }
      });
    });
  }).catch(function(e){console.warn('[app] service worker',e&&e.message||e);});
}

/* ---------- offline ---------- */
function net(){
  var o=document.getElementById('mdv-offline');
  if(navigator.onLine===false){if(!o){o=document.createElement('div');o.id='mdv-offline';o.textContent='You are offline. What you see may be out of date.';document.documentElement.appendChild(o);}}
  else if(o)o.remove();
}
window.addEventListener('offline',net);window.addEventListener('online',net);net();

/* ---------- the number on the app icon (unread mail + notes that need you) ---------- */
function count(){
  var n=0;
  try{if(window.MDV_NOTES&&MDV_NOTES.badge)n+=Number(MDV_NOTES.badge())||0;}catch(e){}
  try{var w=window.MDV_MAIL&&MDV_MAIL.widget&&MDV_MAIL.widget();n+=Number(w&&w.unread)||0;}catch(e){}
  return n;
}
var lastBadge=-1;
function badge(){
  if(!AGENT||!('setAppBadge' in navigator))return;
  var n=count();if(n===lastBadge)return;lastBadge=n;
  try{if(n>0)navigator.setAppBadge(n);else navigator.clearAppBadge();}catch(e){}
}
if(AGENT){window.addEventListener('mdv:notes-badge',badge);window.addEventListener('mdv:mail-widget',badge);setInterval(badge,45000);setTimeout(badge,6000);}

function boot(){register();}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
window.MDV_APP={install:install,standalone:standalone,platform:function(){return IOS?'iphone':MAC_SAFARI?'mac-safari':ANDROID?'android':'desktop';},canPrompt:function(){return !!deferred;},badge:badge};
})();
