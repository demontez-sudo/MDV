(function(){
'use strict';if(window.__CAVYRE_ACCEPT_161094__)return;window.__CAVYRE_ACCEPT_161094__=true;
var V='16.10.94';
function test(name,fn){var ok=false,detail='';try{ok=!!fn()}catch(e){detail=String(e&&e.message||e)}return{name:name,ok:ok,detail:detail}}
function run(){
 var r=[
  test('Application shell',function(){return!!document.getElementById('app')}),
  test('Primary workspace',function(){return!!document.querySelector('main')}),
  test('Agency navigation rail',function(){return!!document.getElementById('vx73-rail')}),
  test('Vera command',function(){return!!document.querySelector('.vx73-command')}),
  test('Global Search',function(){return!!(window.CAVYRE_GLOBAL_SEARCH&&CAVYRE_GLOBAL_SEARCH.open)}),
  test('Production diagnostics',function(){return!!(window.CAVYRE_RELEASE&&CAVYRE_RELEASE.diagnostics)}),
  test('Lifecycle freeze',function(){return!!(window.CAVYRE_FREEZE&&CAVYRE_FREEZE.check)}),
  test('Release certification',function(){return!!(window.CAVYRE_CERTIFICATION&&CAVYRE_CERTIFICATION.run)}),
  test('Mobility route authority',function(){return!!window.__CAVYRE_MOBILITY_ROUTE_161089__}),
  test('Online state',function(){return navigator.onLine!==false})
 ];
 var d=window.CAVYRE_RELEASE&&CAVYRE_RELEASE.diagnostics?CAVYRE_RELEASE.diagnostics():null;
 var out={version:V,at:new Date().toISOString(),pass:r.every(function(x){return x.ok}),tests:r,release:d};
 try{sessionStorage.setItem('cavyre.acceptance.last',JSON.stringify(out))}catch(e){}
 dispatchEvent(new CustomEvent('cavyre:acceptance',{detail:out}));return out;
}
window.CAVYRE_ACCEPTANCE={version:V,run:run};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){setTimeout(run,900)},{once:true});else setTimeout(run,900);
})();