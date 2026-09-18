(function(){
'use strict';
if(window.__CAVYRE_MONTH_SPLIT_AUTH_161127__)return;
window.__CAVYRE_MONTH_SPLIT_AUTH_161127__=1;
function apply(){
 document.querySelectorAll('#p-calendar .vx85-season.vx161123-month-layout').forEach(function(root){
   var intel=root.querySelector(':scope > .vx161126-month-side-intel');
   var models=root.querySelector(':scope > .vx85-models');
   var matrix=root.querySelector(':scope > .vx85-matrix');
   if(!intel||!models||!matrix)return;
   root.dataset.monthSplitAuthority='16.11.27';
   if(window.innerWidth>1120)intel.classList.add('open');
 });
 
 
}
var q=0;function go(){if(q)return;q=1;requestAnimationFrame(function(){q=0;apply()})}
document.readyState==='loading'?document.addEventListener('DOMContentLoaded',go,{once:true}):go();
new MutationObserver(go).observe(document.documentElement,{childList:true,subtree:true});
window.addEventListener('resize',go,{passive:true});
})();