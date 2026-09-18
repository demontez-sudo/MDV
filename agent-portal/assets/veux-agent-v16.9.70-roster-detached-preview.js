(function(){
'use strict';
if(window.__VEUX_16970_ROSTER_DETACHED_PREVIEW__)return;
window.__VEUX_16970_ROSTER_DETACHED_PREVIEW__=true;
var VERSION='16.9.70';

function install(){
  var api=window.VEUX_V155;
  if(!api||typeof api.selectRoster!=='function'||api.selectRoster.__vx16970)return;
  var original=api.selectRoster.__vx16969Original||api.selectRoster.__vx16967Original||api.selectRoster;
  function detachedPreview(id){
    var live=document.getElementById('p-roster');
    if(window._currentPage!=='roster'||!live||!live.classList.contains('on'))return original.apply(this,arguments);
    var oldSide=live.querySelector('.v155-side');
    if(!oldSide)return original.apply(this,arguments);
    var stage=document.createElement('div'),oldId=live.id,result,newSide;
    stage.id=oldId;
    stage.setAttribute('aria-hidden','true');
    stage.style.cssText='position:fixed!important;left:-100000px!important;top:0!important;width:1600px!important;visibility:hidden!important;pointer-events:none!important;contain:strict!important;';
    live.id=oldId+'-live';
    document.body.appendChild(stage);
    try{
      result=original.apply(this,arguments);
      newSide=stage.querySelector('.v155-side');
    }finally{
      stage.remove();
      live.id=oldId;
    }
    if(newSide){
      oldSide.replaceWith(newSide);
      live.querySelectorAll('.v155-table-row.roster').forEach(function(row){row.classList.toggle('on',row.dataset.modelId===id);});
      live.dataset.vx16964Hover=id;
      if(window.VEUX_V16964&&typeof window.VEUX_V16964.cleanRoster==='function')window.VEUX_V16964.cleanRoster(live);
    }
    return result;
  }
  detachedPreview.__vx16970=true;
  detachedPreview.__vx16970Original=original;
  api.selectRoster=detachedPreview;
}

window.VEUX_V16970={version:VERSION,install:install};
window.addEventListener('veux:assets-ready',install);
window.addEventListener('veux:v15.5-ready',install);
setTimeout(install,0);
console.info('[VEUX DESK] Detached roster preview '+VERSION+' loaded');
})();
