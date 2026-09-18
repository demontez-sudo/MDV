(function(){
'use strict';
if(window.__CAVYRE_AGENDA_ENGINE_REPAIR_161132__)return;
window.__CAVYRE_AGENDA_ENGINE_REPAIR_161132__=1;
function verify(){
 var orbit=document.querySelector('#p-calendar .vx75-orbit');
 var rail=orbit&&orbit.querySelector(':scope > .vx161128-agenda-side-intel');
 if(orbit)orbit.setAttribute('data-agenda-engine','16.11.32');
 if(rail){
   rail.setAttribute('data-agenda-side-rail','active');
   if(innerWidth>1080)rail.classList.add('open');
 }
 
 
}
var q=0;function run(){if(q)return;q=1;requestAnimationFrame(function(){q=0;verify()})}
document.readyState==='loading'?document.addEventListener('DOMContentLoaded',run,{once:true}):run();
new MutationObserver(run).observe(document.documentElement,{childList:true,subtree:true});
window.addEventListener('resize',run,{passive:true});
})();