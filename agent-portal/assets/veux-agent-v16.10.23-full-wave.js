
(function(){
'use strict';
if(window.__VEUX_FULL_WAVE_161023__)return;window.__VEUX_FULL_WAVE_161023__=true;
function sync(){
  var theme=document.documentElement.getAttribute('data-veux-wave')||'classic';
  if(document.body)document.body.dataset.fullWave=theme;
  var app=document.getElementById('app');if(app)app.dataset.fullWave=theme;
}
function bindWaveEngine(){
  sync();
  if(window.VEUX_COLOR_WAVES&&typeof VEUX_COLOR_WAVES.set==='function'&&!VEUX_COLOR_WAVES.__vx23){
    var old=VEUX_COLOR_WAVES.set;
    VEUX_COLOR_WAVES.set=function(theme){
      var r=old.apply(this,arguments);
      requestAnimationFrame(function(){sync();window.dispatchEvent(new CustomEvent('veux:full-wave',{detail:{theme:theme}}));});
      return r;
    };
    VEUX_COLOR_WAVES.__vx23=true;
  }
  if(window.VEUX_SMART_PORTAL&&typeof VEUX_SMART_PORTAL.applyWave==='function'&&!VEUX_SMART_PORTAL.__vx23){
    var sw=VEUX_SMART_PORTAL.applyWave;
    VEUX_SMART_PORTAL.applyWave=function(theme,persist){
      var r=sw.apply(this,arguments);
      requestAnimationFrame(function(){sync();window.dispatchEvent(new CustomEvent('veux:full-wave',{detail:{theme:theme}}));});
      return r;
    };
    VEUX_SMART_PORTAL.__vx23=true;
  }
}
function start(){
  bindWaveEngine();
  document.addEventListener('click',function(e){
    if(e.target&&e.target.closest&&e.target.closest('.vx-wave-option'))setTimeout(bindWaveEngine,0);
  },true);
  window.addEventListener('veux:agency-v16-session',bindWaveEngine);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
window.VEUX_FULL_WAVE_161023={sync:sync,bind:bindWaveEngine};
})();
