(function(){
'use strict';if(window.__CAVYRE_CMD_SECTIONS_161097__)return;window.__CAVYRE_CMD_SECTIONS_161097__=true;
function repair(){
  document.querySelectorAll('.vx161061-mobility,.vx161063-finance,.vx161062-relationship').forEach(function(sec){
    sec.setAttribute('data-vx161097-polished','true');
    sec.querySelectorAll('button').forEach(function(b){
      if(!b.getAttribute('aria-label')){
        var txt=(b.textContent||'Open section').replace(/\s+/g,' ').trim();
        if(txt)b.setAttribute('aria-label',txt);
      }
    });
  });
  
  
}
var pending=false;function schedule(){if(pending)return;pending=true;requestAnimationFrame(function(){pending=false;repair()})}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule,{once:true});else schedule();
new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true});
window.addEventListener('veux:shell-ready',schedule);
})();