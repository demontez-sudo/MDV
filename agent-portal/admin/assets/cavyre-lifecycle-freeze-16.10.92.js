(function(){
'use strict';
if(window.__CAVYRE_LIFECYCLE_FREEZE_161092__)return;
window.__CAVYRE_LIFECYCLE_FREEZE_161092__=true;
var VERSION='16.10.92';
var REQUIRED=[
 {name:'shell',test:function(){return !!document.getElementById('app')}},
 {name:'main',test:function(){return !!document.querySelector('main')}},
 {name:'release-diagnostics',test:function(){return !!(window.CAVYRE_RELEASE&&CAVYRE_RELEASE.diagnostics)}},
 {name:'global-search',test:function(){return !!window.CAVYRE_GLOBAL_SEARCH}},
 {name:'vera-command',test:function(){return !!document.querySelector('.vx73-command')}},
 {name:'agent-rail',test:function(){return !!document.getElementById('vx73-rail')}}
];
function check(){
 var checks=REQUIRED.map(function(x){var ok=false;try{ok=!!x.test()}catch(e){}return{name:x.name,ok:ok}});
 var failed=checks.filter(function(x){return !x.ok});
 return {version:VERSION,at:new Date().toISOString(),path:location.pathname,ready:failed.length===0,checks:checks,failed:failed.map(function(x){return x.name})};
}
function report(){
 var r=check();
 try{sessionStorage.setItem('cavyre.lifecycle.last',JSON.stringify(r))}catch(e){}
 window.dispatchEvent(new CustomEvent('cavyre:lifecycle-check',{detail:r}));
 return r;
}
function routeContract(){
 var p=location.pathname.replace(/\/+$/,'')||'/';
 var known=/^\/(?:admin|team)(?:\/(?:calendar|roster|models?|clients?|bookings?|castings?|travel|mobility|finance|packages?|tasks?|settings)?)?$/i;
 return {path:p,agentRoute:!/^\/(?:admin|team)/.test(p)||known.test(p)};
}
window.CAVYRE_FREEZE={
 version:VERSION,
 check:report,
 routeContract:routeContract,
 diagnostics:function(){
  var release=window.CAVYRE_RELEASE&&CAVYRE_RELEASE.diagnostics?CAVYRE_RELEASE.diagnostics():null;
  return {freeze:report(),route:routeContract(),release:release};
 }
};
function boot(){setTimeout(report,350)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
window.addEventListener('cavyre:release-ready',boot);
})();