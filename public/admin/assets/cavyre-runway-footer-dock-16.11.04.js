(function(){
'use strict';
if(window.__CAVYRE_RUNWAY_FOOTER_161104__)return;
window.__CAVYRE_RUNWAY_FOOTER_161104__=true;

function imp(el,p,v){if(el)el.style.setProperty(p,v,'important')}

function repair(){
 document.querySelectorAll('.vx95-calendar-main').forEach(function(main){
   imp(main,'display','grid');
   imp(main,'grid-template-rows','auto 780px auto');
   imp(main,'align-content','start');
   imp(main,'position','relative');

   var head=main.querySelector(':scope > .vx95-day-head');
   var timeline=main.querySelector(':scope > .vx95-timeline');
   var legend=main.querySelector(':scope > .vx95-calendar-legend');

   if(head)imp(head,'grid-row','1');
   if(timeline){
     imp(timeline,'grid-row','2');
     imp(timeline,'height','780px');
     imp(timeline,'min-height','780px');
   }
   if(legend){
     imp(legend,'grid-row','3');
     imp(legend,'position','relative');
     imp(legend,'bottom','auto');
     imp(legend,'top','auto');
     imp(legend,'left','auto');
     imp(legend,'right','auto');
     imp(legend,'inset','auto');
     imp(legend,'width','100%');
     imp(legend,'min-height','46px');
     imp(legend,'margin','0');
     imp(legend,'transform','none');
   }
 });

 
 
}
var q=false;
function schedule(){
 if(q)return;q=true;
 requestAnimationFrame(function(){q=false;repair()});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule,{once:true});
else schedule();
new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true});
window.addEventListener('resize',schedule,{passive:true});
window.addEventListener('veux:shell-ready',schedule);
})();