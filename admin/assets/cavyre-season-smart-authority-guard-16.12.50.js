/* CAVYRE 16.12.50 — Season Smart Authority Guard */
(function(){
'use strict';
if(window.__CAVYRE_SEASON_GUARD_161250__)return;
window.__CAVYRE_SEASON_GUARD_161250__=1;
function repair(){
  var A=window.CAVYRE_SMART_SEASON_161248;
  if(!A||typeof A.takeover!=='function')return;
  A.takeover();
}
setTimeout(repair,0);
setTimeout(repair,500);
setTimeout(repair,1500);
window.addEventListener('veux:shell-ready',repair);
window.addEventListener('veux:agency-v16-ready',repair);
window.addEventListener('veux:page-rendered',repair);
document.addEventListener('click',function(e){
  if(e.target&&e.target.closest&&e.target.closest('[data-p="season"],[data-p="seasonmanagement"]'))setTimeout(repair,30);
},true);
})();