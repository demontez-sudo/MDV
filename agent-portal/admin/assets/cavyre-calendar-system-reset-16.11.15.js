(function(){
'use strict';
if(window.__CAVYRE_CALENDAR_SYSTEM_161115__)return;
window.__CAVYRE_CALENDAR_SYSTEM_161115__=1;
function I(e,p,v){if(e)e.style.setProperty(p,v,'important')}
function fixMonth(){
 document.querySelectorAll('#p-calendar .vx161115-month-layout').forEach(function(root){
   I(root,'grid-template-columns','minmax(0,1fr)');
   var matrix=root.querySelector('.vx161115-month-matrix');
   if(matrix){I(matrix,'width','100%');I(matrix,'min-width','0');I(matrix,'max-width','100%')}
   [root.querySelector('.vx85-dow'),root.querySelector('.vx85-grid')].forEach(function(g){
     I(g,'grid-template-columns','repeat(7,minmax(0,1fr))');I(g,'width','100%');I(g,'min-width','0');I(g,'max-width','100%');
   });
   root.querySelectorAll('.vx85-grid>button').forEach(function(c){I(c,'min-width','0');I(c,'width','auto')});
   var intel=root.querySelector('.vx85-day-intel,.vx98-month-event-intel');
   if(intel){I(intel,'position','relative');I(intel,'width','100%');I(intel,'min-width','0');I(intel,'max-width','none')}
 });
}
function fixWeek(){
 document.querySelectorAll('#p-calendar .vx161115-week-command .vx89-flow-columns').forEach(function(g){
   I(g,'grid-template-columns','repeat(7,minmax(0,1fr))');I(g,'width','100%');I(g,'min-width','0');
 });
}
function run(){
 fixMonth();fixWeek();
 
 
}
var q=0;function go(){if(q)return;q=1;requestAnimationFrame(function(){q=0;run()})}
document.readyState==='loading'?document.addEventListener('DOMContentLoaded',go,{once:true}):go();
new MutationObserver(go).observe(document.documentElement,{childList:true,subtree:true});
window.addEventListener('resize',go,{passive:true});
window.addEventListener('veux:shell-ready',go);
})();