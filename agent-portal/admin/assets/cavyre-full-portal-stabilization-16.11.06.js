(function(){
'use strict';
if(window.__CAVYRE_STABILIZE_161106__)return;
window.__CAVYRE_STABILIZE_161106__=true;
function imp(el,p,v){if(el)el.style.setProperty(p,v,'important')}
function repairOverview(){
 document.querySelectorAll('.vx17-main-grid').forEach(function(grid){
   imp(grid,'align-items','start');
   imp(grid,'grid-auto-rows','max-content');

   var overview=grid.querySelector(':scope > .vx17-overview-panel');
   var priority=grid.querySelector(':scope > .vx17-priority-panel');

   if(overview){
     var compact=window.innerWidth<=760?210:245;
     imp(overview,'display','grid');
     imp(overview,'grid-template-rows','auto auto '+compact+'px');
     imp(overview,'height','max-content');
     imp(overview,'min-height','0');
     imp(overview,'max-height','none');
     imp(overview,'align-self','start');

     var bars=overview.querySelector(':scope > .vx17-bars');
     if(bars){
       imp(bars,'height',compact+'px');
       imp(bars,'min-height',compact+'px');
       imp(bars,'max-height',compact+'px');
     }
   }

   if(priority){
     imp(priority,'align-self','start');
     imp(priority,'height','auto');
     imp(priority,'min-height','0');
     if(window.innerWidth>1150){
       imp(priority,'max-height','520px');
       var stream=priority.querySelector(':scope > .vx17-priority');
       if(stream){imp(stream,'max-height','462px');imp(stream,'overflow-y','auto')}
     }else{
       imp(priority,'max-height','none');
       var stream2=priority.querySelector(':scope > .vx17-priority');
       if(stream2){imp(stream2,'max-height','none');imp(stream2,'overflow-y','visible')}
     }
   }
 });
}
function repairOverflow(){
 document.querySelectorAll('input,select,textarea,button,[role="button"],[role="option"],[role="menuitem"]').forEach(function(el){
   if(el.scrollWidth>el.clientWidth+8 && el.clientWidth>0){
     el.setAttribute('data-cavyre-overflow-watch','true');
   }else el.removeAttribute('data-cavyre-overflow-watch');
 });
}
function repair(){
 repairOverview();repairOverflow();
 
 
}
var queued=false;
function schedule(){if(queued)return;queued=true;requestAnimationFrame(function(){queued=false;repair()})}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule,{once:true});else schedule();
new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true});
window.addEventListener('resize',schedule,{passive:true});
window.addEventListener('veux:shell-ready',schedule);
})();