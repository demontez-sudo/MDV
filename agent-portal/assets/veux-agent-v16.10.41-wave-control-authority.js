
(function(){
'use strict';
if(window.__VEUX_WAVE_CONTROL_AUTHORITY_161041__)return;
window.__VEUX_WAVE_CONTROL_AUTHORITY_161041__=true;

function sync(){
  var r=document.documentElement;
  var theme=r.getAttribute('data-veux-wave')||'classic';
  if(theme==='classic') return;
  var cs=getComputedStyle(r);
  var a=cs.getPropertyValue('--skin-accent').trim();
  var a2=cs.getPropertyValue('--skin-accent2').trim();
  var soft=cs.getPropertyValue('--skin-soft').trim();
  if(a)r.style.setProperty('--gold',a);
  if(a2)r.style.setProperty('--goldl',a2);
  if(soft)r.style.setProperty('--goldp',soft);
  if(document.body)document.body.dataset.waveControlAuthority=theme;
}
window.addEventListener('veux:color-wave-change',sync);
window.addEventListener('veux:smart-wave-applied',sync);
window.addEventListener('veux:full-wave',sync);
document.addEventListener('click',function(e){
  if(e.target&&e.target.closest&&e.target.closest('.vx-wave-option[data-wave]')){
    requestAnimationFrame(sync);
    setTimeout(sync,30);
  }
},true);
var obs=new MutationObserver(function(ms){
  for(var i=0;i<ms.length;i++){
    if(ms[i].type==='attributes'&&ms[i].target===document.documentElement){
      requestAnimationFrame(sync);break;
    }
  }
});
function start(){
  sync();
  obs.observe(document.documentElement,{attributes:true,attributeFilter:['data-veux-wave']});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
