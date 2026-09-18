(function(){
'use strict';
if(window.__CAVYRE_MONTH_SPLIT_161126__)return;
window.__CAVYRE_MONTH_SPLIT_161126__=1;
function sync(){
 document.querySelectorAll('#p-calendar .vx161126-month-side-intel').forEach(function(d){
   var desktop=window.innerWidth>1120;
   d.classList.toggle('vx161126-side-active',desktop);
   if(desktop)d.classList.add('open');
 });
 
 
}
var q=0;function go(){if(q)return;q=1;requestAnimationFrame(function(){q=0;sync()})}
document.readyState==='loading'?document.addEventListener('DOMContentLoaded',go,{once:true}):go();
new MutationObserver(go).observe(document.documentElement,{childList:true,subtree:true});
window.addEventListener('resize',go,{passive:true});
})();