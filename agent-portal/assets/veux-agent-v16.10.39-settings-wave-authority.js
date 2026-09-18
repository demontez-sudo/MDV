
(function(){
'use strict';
if(window.__VEUX_SETTINGS_WAVE_AUTHORITY_161039__)return;
window.__VEUX_SETTINGS_WAVE_AUTHORITY_161039__=true;
function repair(){
  var grid=document.querySelector('#vx-wave-settings .vx-wave-grid');
  if(!grid)return;
  var needed=['classic','green','blue','red','white','purple','burntOrange','turquoise','blueNude','greenNude','galaxy','christmas','earth','waterfall'];
  var existing=[].map.call(grid.querySelectorAll('.vx-wave-option'),function(b){return b.dataset.wave;});
  if(needed.every(function(k){return existing.indexOf(k)>=0;}))return;
  if(window.VEUX_COLOR_WAVES&&typeof VEUX_COLOR_WAVES.settingsMarkup==='function'){
    var tmp=document.createElement('div');
    tmp.innerHTML=VEUX_COLOR_WAVES.settingsMarkup();
    var replacement=tmp.querySelector('.vx-wave-grid');
    if(replacement)grid.replaceWith(replacement);
    if(typeof VEUX_COLOR_WAVES.refresh==='function')VEUX_COLOR_WAVES.refresh();
  }
}
document.addEventListener('click',function(e){
  if(e.target&&e.target.closest&&e.target.closest('[data-page="settings"],[onclick*="settings"]'))setTimeout(repair,40);
},true);
window.addEventListener('veux:agency-v16-session',function(){setTimeout(repair,50);});
var obs=new MutationObserver(function(ms){
  for(var i=0;i<ms.length;i++){
    if(ms[i].addedNodes.length){requestAnimationFrame(repair);break;}
  }
});
function start(){repair();obs.observe(document.body,{childList:true,subtree:true});}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();

document.addEventListener('click',function(e){
  var b=e.target&&e.target.closest&&e.target.closest('#vx-wave-settings .vx-wave-option[data-wave]');
  if(!b)return;
  var theme=b.dataset.wave;
  setTimeout(function(){
    if(window.VEUX_SMART_PORTAL&&typeof VEUX_SMART_PORTAL.applyWave==='function'){
      VEUX_SMART_PORTAL.applyWave(theme,true);
    }else if(window.VEUX_COLOR_WAVES&&typeof VEUX_COLOR_WAVES.set==='function'){
      VEUX_COLOR_WAVES.set(theme);
    }
  },0);
},true);
