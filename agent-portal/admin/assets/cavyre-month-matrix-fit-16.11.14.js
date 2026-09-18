(function(){'use strict';
if(window.__CAVYRE_MONTH_MATRIX_161114__)return;window.__CAVYRE_MONTH_MATRIX_161114__=1;
function I(e,p,v){if(e)e.style.setProperty(p,v,'important')}
function fix(){
 document.querySelectorAll('#p-calendar .vx85-season').forEach(function(s){
  var w=innerWidth, cols=w>1500?'220px minmax(0,1fr) 320px':w>1220?'190px minmax(0,1fr) 285px':w>980?'170px minmax(0,1fr) 250px':'1fr';
  I(s,'grid-template-columns',cols);I(s,'width','100%');I(s,'min-width','0');I(s,'max-width','100%');I(s,'overflow',w>980?'hidden':'visible');
  var m=s.querySelector('.vx85-matrix');I(m,'min-width','0');I(m,'width','100%');I(m,'overflow','hidden');
  [s.querySelector('.vx85-dow'),s.querySelector('.vx85-grid')].forEach(function(g){I(g,'width','100%');I(g,'min-width','0');I(g,'max-width','100%');I(g,'grid-template-columns','repeat(7,minmax(0,1fr))')});
  s.querySelectorAll('.vx85-grid>button').forEach(function(c){I(c,'min-width','0');I(c,'width','auto')});
 });
 
 
}
var pending=0;function go(){if(pending)return;pending=1;requestAnimationFrame(function(){pending=0;fix()})}
document.readyState==='loading'?document.addEventListener('DOMContentLoaded',go,{once:true}):go();
new MutationObserver(go).observe(document.documentElement,{subtree:true,childList:true});addEventListener('resize',go,{passive:true});
})();