(function(){'use strict';
if(window.__CAVYRE_HARDENING_161091__)return;window.__CAVYRE_HARDENING_161091__=true;
var VERSION='16.10.91',errors=[],apiFailures=[],routeFailures=[];
function now(){return new Date().toISOString()} function safe(v){try{return String(v==null?'':v).slice(0,600)}catch(e){return''}}
function record(kind,msg,meta){errors.push({at:now(),kind:kind,message:safe(msg),meta:meta||{}});if(errors.length>40)errors.shift();try{sessionStorage.setItem('cavyre.runtime.errors',JSON.stringify(errors))}catch(e){}}
addEventListener('error',function(e){record('error',e.message,{source:e.filename||'',line:e.lineno||0})});
addEventListener('unhandledrejection',function(e){record('promise',e.reason&&e.reason.message||e.reason||'Unhandled rejection',{})});
function route(){var p=location.pathname.replace(/\/+$/,'')||'/';if(/^\/(?:admin|team)\/.+/.test(p)&&!/^\/(?:admin|team)(?:\/(?:calendar|roster|models?|clients?|bookings?|castings?|travel|mobility|finance|packages?|tasks?|settings)?)?$/i.test(p)){routeFailures.push({at:now(),path:p});try{history.replaceState(history.state,'','/admin'+location.search+location.hash)}catch(e){}}}
function patchFetch(){var raw=window.fetch;if(!raw||raw.__cavyre161091)return;function wrapped(input,init){var url=typeof input==='string'?input:(input&&input.url)||'';return raw.apply(this,arguments).then(function(r){if(/\/api\/agent\//.test(url)&&!r.ok){apiFailures.push({at:now(),url:url,status:r.status});if(apiFailures.length>40)apiFailures.shift()}return r}).catch(function(err){if(/\/api\/agent\//.test(url)){apiFailures.push({at:now(),url:url,status:0,error:safe(err&&err.message||err)});if(apiFailures.length>40)apiFailures.shift()}throw err})}wrapped.__cavyre161091=true;window.fetch=wrapped}
function shell(){return{app:!!document.getElementById('app'),main:!!document.querySelector('main'),rail:!!document.getElementById('vx73-rail'),vera:!!document.querySelector('.vx73-command'),search:!!window.CAVYRE_GLOBAL_SEARCH}}
function clearStale(){try{if('caches'in window)caches.keys().then(function(keys){keys.filter(function(k){return /cavyre-agent-shell|veux-agent/i.test(k)&&k.indexOf('16.10.91')<0}).forEach(function(k){caches.delete(k)})})}catch(e){}}
function diagnostics(){return{version:VERSION,at:now(),path:location.pathname,shell:shell(),runtimeErrors:errors.slice(),apiFailures:apiFailures.slice(),routeFailures:routeFailures.slice(),online:navigator.onLine,serviceWorker:!!navigator.serviceWorker}}
route();patchFetch();clearStale();addEventListener('popstate',route);
addEventListener('veux:shell-ready',function(){setTimeout(function(){var s=shell();if(!s.app||!s.main)record('shell','Required shell surface missing',s)},100)});
window.CAVYRE_RELEASE={version:VERSION,diagnostics:diagnostics,clearRuntimeErrors:function(){errors=[];try{sessionStorage.removeItem('cavyre.runtime.errors')}catch(e){}},refreshSearch:function(){return window.CAVYRE_GLOBAL_SEARCH&&CAVYRE_GLOBAL_SEARCH.refresh?CAVYRE_GLOBAL_SEARCH.refresh():Promise.resolve([])}};
dispatchEvent(new CustomEvent('cavyre:release-ready',{detail:{version:VERSION}}));
})();