(function(){
'use strict';
if(window.__CAVYRE_AUTHORITY_DIAGNOSTIC_161133__)return;
window.__CAVYRE_AUTHORITY_DIAGNOSTIC_161133__=1;

function stamp(){
  
  document.documentElement.setAttribute('data-agenda-authority','16.11.33');
  document.documentElement.setAttribute('data-package-authority','16.11.33');

  

  var orbit=document.querySelector('#p-calendar .vx75-orbit');
  var rail=orbit && orbit.querySelector(':scope > .vx161128-agenda-side-intel');
  if(orbit) orbit.setAttribute('data-agenda-grid-authority','16.11.33');
  if(rail) rail.setAttribute('data-agenda-rail-authority','16.11.33');
}
var q=0;
function run(){
  if(q)return;
  q=1;
  requestAnimationFrame(function(){q=0;stamp();});
}
document.readyState==='loading'
  ? document.addEventListener('DOMContentLoaded',run,{once:true})
  : run();
new MutationObserver(run).observe(document.documentElement,{childList:true,subtree:true});
})();