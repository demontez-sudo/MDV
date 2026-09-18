(function(){
'use strict';
if(window.__CAVYRE_ACCEPTANCE_161123__)return;window.__CAVYRE_ACCEPTANCE_161123__=1;
function I(e,p,v){if(e)e.style.setProperty(p,v,'important')}
function repairMonth(){
 document.querySelectorAll('#p-calendar .vx161123-month-layout').forEach(function(root){
  var controls=root.querySelector(':scope>.vx85-models'),matrix=root.querySelector(':scope>.vx85-matrix');
  var intel=root.querySelector(':scope>.vx85-day-intel,:scope>.vx98-month-event-intel,:scope>.vx89-event-intel');
  if(!controls||!matrix)return;
  if(root.firstElementChild!==controls)root.insertBefore(controls,root.firstElementChild);
  if(controls.nextElementSibling!==matrix)root.insertBefore(matrix,controls.nextSibling);
  if(intel&&matrix.nextElementSibling!==intel)root.insertBefore(intel,matrix.nextSibling);
  I(root,'grid-template-columns','minmax(0,1fr)');I(root,'width','100%');I(root,'overflow','visible');
  [matrix.querySelector(':scope>.vx85-dow'),matrix.querySelector(':scope>.vx85-grid')].forEach(function(g){
   if(!g)return;I(g,'grid-template-columns','repeat(7,minmax(0,1fr))');I(g,'width','100%');I(g,'min-width','0');
  });
  if(intel){I(intel,'position','relative');I(intel,'width','100%');I(intel,'grid-column','1');I(intel,'grid-row','3')}
  var cal=root.closest('.vx75-calendar');
  if(cal){
   var ctl=cal.querySelector(':scope>.vx75-control'),scope=cal.querySelector(':scope>.vx1047-scopebar,:scope>.vx84-scopebar');
   if(ctl){I(ctl,'display','grid');ctl.querySelectorAll('.vx75-date,.vx75-tabs').forEach(function(e){I(e,'display','flex')})}
   if(scope)I(scope,'display','grid');
  }
 });
}
function repairMarket(){
 document.querySelectorAll('#p-calendar .vx161123-market-card').forEach(function(c){
  I(c,'display','flex');I(c,'flex-direction','column');I(c,'align-items','flex-start');
  I(c,'grid-template-columns','none');I(c,'min-width','0');I(c,'overflow','hidden');
  Array.from(c.children).forEach(function(x){I(x,'position','static');I(x,'width','auto');I(x,'white-space','normal')});
 });
}
function run(){
 repairMonth();repairMarket();
 
 
}
var q=0;function go(){if(q)return;q=1;requestAnimationFrame(function(){q=0;run()})}
document.readyState==='loading'?document.addEventListener('DOMContentLoaded',go,{once:true}):go();
new MutationObserver(go).observe(document.documentElement,{childList:true,subtree:true});
window.addEventListener('resize',go,{passive:true});
window.addEventListener('veux:shell-ready',go);
})();