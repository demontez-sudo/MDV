(function(){
'use strict';
if(window.__CAVYRE_DEPLOY1_161119__)return;
window.__CAVYRE_DEPLOY1_161119__=1;
function I(e,p,v){if(e)e.style.setProperty(p,v,'important')}

function month(){
 document.querySelectorAll('#p-calendar .vx85-season').forEach(function(root){
  var controls=root.querySelector('.vx85-models'), matrix=root.querySelector('.vx85-matrix');
  var intel=root.querySelector('.vx85-day-intel,.vx98-month-event-intel,.vx89-event-intel');
  if(!controls||!matrix)return;
  root.classList.add('vx161119-month');
  controls.classList.add('vx161119-month-controls');
  matrix.classList.add('vx161119-month-matrix');
  if(intel)intel.classList.add('vx161119-month-intel');

  if(root.firstElementChild!==controls)root.insertBefore(controls,root.firstElementChild);
  if(controls.nextElementSibling!==matrix)root.insertBefore(matrix,controls.nextSibling);
  if(intel&&matrix.nextElementSibling!==intel)root.insertBefore(intel,matrix.nextSibling);

  I(root,'display','grid');I(root,'grid-template-columns','minmax(0,1fr)');
  I(root,'grid-template-rows','auto auto auto');I(root,'width','100%');I(root,'min-width','0');
  I(root,'max-width','100%');I(root,'height','auto');I(root,'overflow','visible');

  I(controls,'grid-column','1');I(controls,'grid-row','1');I(controls,'width','100%');
  I(controls,'min-width','0');I(controls,'height','auto');I(controls,'max-height','none');
  I(controls,'border-right','0');I(controls,'overflow','visible');

  I(matrix,'grid-column','1');I(matrix,'grid-row','2');I(matrix,'width','100%');
  I(matrix,'min-width','0');I(matrix,'max-width','100%');I(matrix,'overflow','hidden');
  [matrix.querySelector(':scope>.vx85-dow'),matrix.querySelector(':scope>.vx85-grid')].forEach(function(g){
   if(!g)return;I(g,'display','grid');I(g,'grid-template-columns','repeat(7,minmax(0,1fr))');
   I(g,'width','100%');I(g,'min-width','0');I(g,'max-width','100%');
  });
  matrix.querySelectorAll('.vx85-grid>button').forEach(function(c){
   I(c,'display','block');I(c,'visibility','visible');I(c,'opacity','1');I(c,'min-width','0');
   I(c,'width','auto');I(c,'max-width','none');
  });
  if(intel){
   I(intel,'grid-column','1');I(intel,'grid-row','3');I(intel,'position','relative');
   I(intel,'inset','auto');I(intel,'width','100%');I(intel,'min-width','0');
   I(intel,'max-width','none');I(intel,'height','auto');I(intel,'overflow','visible');
   I(intel,'border-left','0');
  }
 });
}
function week(){
 document.querySelectorAll('#p-calendar .vx89-flow-dashboard').forEach(function(root){
  root.classList.add('vx161119-week');
  var cols=root.querySelector('.vx89-flow-columns');
  if(cols){I(cols,'display','grid');I(cols,'grid-template-columns','repeat(7,minmax(0,1fr))');I(cols,'width','100%');I(cols,'min-width','0')}
  root.querySelectorAll('.vx89-flow-day').forEach(function(d){I(d,'min-width','0')});
 });
}
function command(){
 document.querySelectorAll('#p-calendar .vx75-control').forEach(function(c){c.classList.add('vx161119-calendar-command')});
}
function industry(){
 document.querySelectorAll('#p-calendar .vx1044-agency-intel').forEach(function(p){
  p.classList.add('vx161119-industry');
  var stages=p.querySelector('.vx1044-stages');
  if(stages){I(stages,'display','grid');I(stages,'grid-template-columns','repeat(6,minmax(0,1fr))');I(stages,'gap','8px')}
 });
}
function certify(){
 month();week();command();industry();
 
 
}
var q=0;function go(){if(q)return;q=1;requestAnimationFrame(function(){q=0;certify()})}
document.readyState==='loading'?document.addEventListener('DOMContentLoaded',go,{once:true}):go();
new MutationObserver(go).observe(document.documentElement,{childList:true,subtree:true});
window.addEventListener('resize',go,{passive:true});
window.addEventListener('veux:shell-ready',go);
})();