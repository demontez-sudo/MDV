/* Reload recorder. Keeps a short trail of what the portal was doing, and if the page reloads itself repeatedly
   (or dies without a clean exit) it says so on screen with the last few events, so the cause can be found.
   Nothing leaves the browser. */
(function(){
'use strict';
if(window.MDV_DIAG)return;
var KEY='mdv-diag-v1',trail=[],t0=Date.now();
function ss(k,v){try{if(v===undefined)return sessionStorage.getItem(k);sessionStorage.setItem(k,v);}catch(e){}return null;}
function ls(k,v){try{if(v===undefined)return localStorage.getItem(k);localStorage.setItem(k,v);}catch(e){}return null;}
function note(t){trail.push(((Date.now()-t0)/1000).toFixed(1)+'s '+String(t).slice(0,90));if(trail.length>25)trail.shift();}
function flush(clean){try{ss(KEY,JSON.stringify({t:Date.now(),born:t0,clean:!!clean,trail:trail.slice(-14),page:window._currentPage||''}));}catch(e){}}

/* what happened before the previous page ended? */
var prev=null;try{prev=JSON.parse(ss(KEY)||'null');}catch(e){}
var nav=(performance.getEntriesByType&&performance.getEntriesByType('navigation')[0])||{};
var hist=[];try{hist=JSON.parse(ls('mdv-diag-loads')||'[]');}catch(e){}
hist=hist.filter(function(x){return Date.now()-x<4*60000;});hist.push(Date.now());ls('mdv-diag-loads',JSON.stringify(hist.slice(-12)));
var report=null;
if(prev&&(Date.now()-prev.t)<20000&&(prev.t-prev.born)<120000){
  report={looping:hist.length>=3,crashed:!prev.clean,type:nav.type||'',lived:Math.round((prev.t-prev.born)/1000),page:prev.page,trail:prev.trail};
  try{ls('mdv-diag-last',JSON.stringify(Object.assign({at:new Date().toISOString()},report)));}catch(e){}
}

/* the trail */
['hashchange','popstate','online','offline','visibilitychange','veux:agency-v16-session','veux:shell-ready','veux:page-rendered','mdv:mail-widget','controllerchange'].forEach(function(n){
  window.addEventListener(n,function(){note(n+(n==='visibilitychange'?' '+document.visibilityState:''));});
});
window.addEventListener('error',function(e){note('ERROR '+(e&&e.message||''));});
window.addEventListener('unhandledrejection',function(e){note('REJECTED '+((e&&e.reason&&e.reason.message)||e.reason||''));});
try{if(navigator.serviceWorker)navigator.serviceWorker.addEventListener('controllerchange',function(){note('service worker changed');});}catch(e){}
(function(){var of=window.fetch;if(!of)return;window.fetch=function(u){var url=String(typeof u==='string'?u:(u&&u.url)||'').replace(/^https?:\/\/[^/]+/,'').split('?')[0];return of.apply(this,arguments).then(function(r){if(r&&r.status>=400)note('HTTP '+r.status+' '+url.slice(0,50));return r;},function(e){note('NETWORK FAIL '+url.slice(0,50));throw e;});};})();
(function hook(){var n=0,t=setInterval(function(){
  if(typeof window.navTo==='function'&&!window.navTo.__diag){var p=window.navTo;var w=function(x){note('page '+x);return p.apply(this,arguments);};for(var k in p){try{w[k]=p[k];}catch(e){}}w.__diag=1;w.__orig=p;window.navTo=w;clearInterval(t);}
  else if(++n>60)clearInterval(t);},500);})();
note('loaded '+(nav.type||''));
window.addEventListener('pagehide',function(){flush(true);});
setInterval(function(){flush(false);},4000);flush(false);

/* say so on screen only when something is clearly wrong: three loads in four minutes, or the last page died */
function show(){
  if(!report||!(report.looping||report.crashed))return;
  var d=document.createElement('div');d.setAttribute('role','status');
  d.style.cssText='position:fixed;left:12px;right:12px;bottom:84px;z-index:2147483000;max-width:560px;margin:0 auto;padding:12px 14px;border:1px solid rgba(224,144,122,.6);background:#1a1410;color:#f1e6d6;font:12.5px/1.5 Inter,system-ui,sans-serif;border-radius:10px;box-shadow:0 10px 30px rgba(0,0,0,.5)';
  d.innerHTML='<b>The page reloaded by itself'+(report.looping?' several times':'')+(report.crashed?' (the last page stopped without closing properly)':'')+'.</b><br>Last events: '+report.trail.slice(-5).map(function(x){return x.replace(/[<&]/g,'');}).join(' · ')+' <button type="button" style="margin-left:8px;background:none;border:0;color:#e6a06c;text-decoration:underline;cursor:pointer;font:inherit">Dismiss</button>';
  d.querySelector('button').onclick=function(){d.remove();};
  document.body.appendChild(d);setTimeout(function(){if(d.parentNode)d.remove();},30000);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',show,{once:true});else setTimeout(show,800);
window.MDV_DIAG={trail:function(){return trail.slice();},last:function(){try{return JSON.parse(ls('mdv-diag-last')||'null');}catch(e){return null;}}};
})();
