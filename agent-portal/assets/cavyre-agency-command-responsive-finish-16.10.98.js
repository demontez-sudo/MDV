(function(){
'use strict';
if(window.__CAVYRE_CMD_RESPONSIVE_161098__)return;
window.__CAVYRE_CMD_RESPONSIVE_161098__=true;

function repair(){
  var surfaces=document.querySelectorAll(
    '.vx161086-command-queue,.vx161061-mobility,.vx161063-finance,.vx161062-relationship'
  );
  surfaces.forEach(function(el){
    el.setAttribute('data-vx161098-responsive','true');
  });

  // Ensure queue action cards never retain accidental inline widths from prior renders.
  document.querySelectorAll('.vx161086-queue-item').forEach(function(card){
    if(card.style && card.style.width) card.style.removeProperty('width');
    if(card.style && card.style.maxWidth) card.style.removeProperty('max-width');
  });

  
  
}
var queued=false;
function schedule(){
  if(queued)return; queued=true;
  requestAnimationFrame(function(){queued=false;repair()});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule,{once:true});
else schedule();
new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true});
window.addEventListener('resize',schedule,{passive:true});
window.addEventListener('veux:shell-ready',schedule);
})();