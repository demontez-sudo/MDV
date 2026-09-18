(function(){
'use strict';
if(window.__CAVYRE_MONTH_WEEKEND_161113__)return;
window.__CAVYRE_MONTH_WEEKEND_161113__=true;
function imp(el,p,v){if(el)el.style.setProperty(p,v,'important')}
function repair(){
  document.querySelectorAll('#p-calendar .vx75-season').forEach(function(season){
    var w=window.innerWidth;
    imp(season,'min-width','0');
    imp(season,'max-width','100%');
    if(w>1180) imp(season,'grid-template-columns','minmax(0,1fr) '+(w<=1450?'270px':'300px'));
    else imp(season,'grid-template-columns','1fr');

    var grid=season.querySelector('.vx75-month-grid');
    if(grid){
      imp(grid,'width','100%');
      imp(grid,'min-width','0');
      imp(grid,'max-width','100%');
    }
    season.querySelectorAll('.vx75-weekrow,.vx75-dow').forEach(function(row){
      if(w>760){
        imp(row,'width','100%');
        imp(row,'min-width','0');
        imp(row,'grid-template-columns','repeat(7,minmax(0,1fr))');
      }
    });
  });
  
  
}
var q=false;
function schedule(){if(q)return;q=true;requestAnimationFrame(function(){q=false;repair()})}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule,{once:true});else schedule();
new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true});
window.addEventListener('resize',schedule,{passive:true});
window.addEventListener('veux:shell-ready',schedule);
})();