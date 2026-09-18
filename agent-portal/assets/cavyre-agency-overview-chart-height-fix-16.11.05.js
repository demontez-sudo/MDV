(function(){
'use strict';
if(window.__CAVYRE_OVERVIEW_HEIGHT_161105__)return;
window.__CAVYRE_OVERVIEW_HEIGHT_161105__=true;

function imp(el,p,v){if(el)el.style.setProperty(p,v,'important')}

function repair(){
  document.querySelectorAll('.vx17-main-grid').forEach(function(grid){
    imp(grid,'align-items','start');

    var panels=Array.from(grid.querySelectorAll(':scope > .vx17-panel'));
    if(panels[0]){
      imp(panels[0],'height','auto');
      imp(panels[0],'min-height','0');
      imp(panels[0],'align-self','start');

      var bars=panels[0].querySelector('.vx17-bars');
      if(bars){
        var h=window.innerWidth<=760?220:(window.innerWidth>=1500?285:270);
        imp(bars,'height',h+'px');
        imp(bars,'max-height',h+'px');
        imp(bars,'min-height','0');
      }
    }

    if(panels[1]){
      imp(panels[1],'align-self','start');
      imp(panels[1],'height','auto');
      if(window.innerWidth>1150){
        imp(panels[1],'max-height',window.innerWidth>=1500?'640px':'620px');
        var stream=panels[1].querySelector('.vx17-priority');
        if(stream){
          imp(stream,'max-height',window.innerWidth>=1500?'580px':'560px');
          imp(stream,'overflow-y','auto');
        }
      }else{
        imp(panels[1],'max-height','none');
        var stream2=panels[1].querySelector('.vx17-priority');
        if(stream2){
          imp(stream2,'max-height','none');
          imp(stream2,'overflow-y','visible');
        }
      }
    }
  });

  
  
}

var q=false;
function schedule(){
  if(q)return;
  q=true;
  requestAnimationFrame(function(){q=false;repair()});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule,{once:true});
else schedule();

new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true});
window.addEventListener('resize',schedule,{passive:true});
window.addEventListener('veux:shell-ready',schedule);
})();