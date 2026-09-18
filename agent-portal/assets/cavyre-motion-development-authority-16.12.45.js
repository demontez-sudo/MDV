/* CAVYRE 16.12.45 — Motion + Model 360 Development Direct Authority */
(function(){
'use strict';
if(window.__CAVYRE_MOTION_DEVELOPMENT_161245__)return;
window.__CAVYRE_MOTION_DEVELOPMENT_161245__=true;
document.addEventListener('click',function(ev){
  var target=ev.target&&ev.target.closest?ev.target.closest('#p-modelpage .v156-tab[data-model-tab="development"]'):null;
  if(!target)return;
  var page=document.getElementById('p-modelpage');
  if(!page||!page.classList.contains('on'))return;
  ev.preventDefault();ev.stopPropagation();if(ev.stopImmediatePropagation)ev.stopImmediatePropagation();
  if(window.VEUX_V156&&typeof window.VEUX_V156.modelTab==='function')window.VEUX_V156.modelTab('development');
},true);
function enhance(){
  var select=document.getElementById('v156-media-cat');if(!select)return;
  if(!Array.from(select.options).some(function(o){return String(o.value||o.text).toLowerCase()==='motion';})){
    var opt=document.createElement('option');opt.value='Motion';opt.textContent='Motion';
    var before=Array.from(select.options).find(function(o){return String(o.text).toLowerCase()==='commercial';});
    select.insertBefore(opt,before||null);
  }
  var url=document.getElementById('v156-media-url');
  if(url&&!url.dataset.motionHint){url.dataset.motionHint='1';url.placeholder='Paste one image or video URL · MP4 / MOV / WEBM supported';}
}
new MutationObserver(enhance).observe(document.documentElement,{childList:true,subtree:true});
setTimeout(enhance,0);
})();