/* CAVYRE 16.12.98 — Season Smart Authority Guard */
(function(){
'use strict';
if(window.__CAVYRE_SEASON_GUARD_161303__)return;
window.__CAVYRE_SEASON_GUARD_161303__=1;
function repair(){
  var A=window.CAVYRE_SMART_SEASON_161248;
  if(!A||typeof A.takeover!=='function')return;
  var page=String(window._currentPage||location.hash.replace(/^#/,'')||'').toLowerCase();
  var host=document.getElementById('p-seasonmanagement')||document.getElementById('p-season');
  var visible=!!(host&&(host.classList.contains('on')||host.offsetParent!==null));
  if(page!=='season'&&page!=='seasonmanagement'&&!visible)return;
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