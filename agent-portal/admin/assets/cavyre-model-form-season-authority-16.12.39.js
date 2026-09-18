
/* CAVYRE 16.12.39 — Model Form / Season Modal Authority */
(function(){
'use strict';
if(window.__CAVYRE_MODEL_FORM_AUTH_161239__)return;
window.__CAVYRE_MODEL_FORM_AUTH_161239__=1;

function page(){
  return String(window._currentPage||document.body&&document.body.dataset&&document.body.dataset.page||'').toLowerCase();
}
function isSeasonPage(){
  var p=page();
  return p==='seasonmanagement'||p==='season'||/season/.test(p)||
    !!document.querySelector('#p-seasonmanagement:not([hidden]),#p-season:not([hidden])');
}
function removeLegacySeasonModal(){
  var m=document.getElementById('vx136-modal');
  if(!m)return;
  var title=(m.querySelector('.vx136-mt')||{}).textContent||'';
  if(!isSeasonPage()&&/add model to|season/i.test(title))m.remove();
}
function removeDuplicateModelForms(){
  var all=[].slice.call(document.querySelectorAll('#vx133-modal'));
  if(all.length>1)all.slice(0,-1).forEach(function(x){x.remove();});
  document.querySelectorAll('.vx134-back').forEach(function(x){
    var t=(x.querySelector('.vx134-title')||{}).textContent||'';
    if(/add model/i.test(t))x.remove();
  });
}
function canonicalAddModel(){
  removeLegacySeasonModal();
  removeDuplicateModelForms();
  if(window.VEUX_V16917&&typeof VEUX_V16917.newModel==='function'){
    VEUX_V16917.newModel();
    setTimeout(function(){
      removeLegacySeasonModal();
      removeDuplicateModelForms();
      var m=document.getElementById('vx133-modal');
      if(m){
        m.dataset.cavyreAuthority='16.12.39';
        var box=m.querySelector('.vx133-modal');
        if(box){
          box.style.setProperty('width','min(860px,94vw)','important');
          box.style.setProperty('max-width','860px','important');
          box.style.setProperty('max-height','90vh','important');
          box.style.setProperty('overflow','auto','important');
        }
      }
    },0);
    return;
  }
  if(window.VEUX_V133&&typeof VEUX_V133.newModel==='function'&&!VEUX_V133.newModel.__cvy161239){
    return VEUX_V133.newModel();
  }
  if(window.toast)toast('Model form is still loading. Try again in a moment.');
}
canonicalAddModel.__cvy161239=true;

function installOverrides(){
  if(window.VEUX_V133)window.VEUX_V133.newModel=canonicalAddModel;
  if(window.VEUX_V155)window.VEUX_V155.newModel=canonicalAddModel;

  if(window.VEUX_V136&&typeof VEUX_V136.addSeasonModel==='function'&&!VEUX_V136.addSeasonModel.__cvy161239){
    var original=VEUX_V136.addSeasonModel;
    var wrapped=function(){
      if(!isSeasonPage()){
        removeLegacySeasonModal();
        if(window.toast)toast('Season model assignment is available only inside Season Management.');
        return;
      }
      return original.apply(this,arguments);
    };
    wrapped.__cvy161239=true;
    VEUX_V136.addSeasonModel=wrapped;
  }
}

function isRosterAddButton(b){
  if(!b)return false;
  var text=String(b.textContent||'').replace(/\s+/g,' ').trim().toLowerCase();
  if(!(text==='+ add model'||text==='add model'||text==='new model'))return false;
  var roster=b.closest&&b.closest('#p-roster,.v155-page,.vx133-actions');
  return !!roster || page()==='roster';
}

document.addEventListener('click',function(e){
  var b=e.target&&e.target.closest&&e.target.closest('button,a,[role="button"]');
  if(!b)return;

  if(isRosterAddButton(b)){
    // Capture authority before legacy document listeners can see the same click.
    e.preventDefault();
    e.stopPropagation();
    if(e.stopImmediatePropagation)e.stopImmediatePropagation();
    canonicalAddModel();
    return;
  }

  // A generic "Add Model" inside Season is allowed only if it belongs to the Season modal/page.
  var text=String(b.textContent||'').replace(/\s+/g,' ').trim().toLowerCase();
  if(text==='add model'&&!isSeasonPage()&&b.closest&&b.closest('#vx136-modal')){
    e.preventDefault();e.stopPropagation();
    if(e.stopImmediatePropagation)e.stopImmediatePropagation();
    removeLegacySeasonModal();
  }
},true);

var busy=false;
new MutationObserver(function(){
  if(busy)return;
  busy=true;
  requestAnimationFrame(function(){
    busy=false;
    installOverrides();
    removeLegacySeasonModal();
    removeDuplicateModelForms();
  });
}).observe(document.documentElement,{subtree:true,childList:true});

window.addEventListener('veux:assets-ready',function(){setTimeout(installOverrides,0)});
window.addEventListener('veux:agency-v16-ready',function(){setTimeout(installOverrides,0)});
window.addEventListener('veux:shell-ready',function(){setTimeout(installOverrides,0)});
setTimeout(installOverrides,50);
setTimeout(installOverrides,500);
setTimeout(installOverrides,1500);

window.CAVYRE_MODEL_FORM_AUTHORITY={
  release:'16.12.39',
  newModel:canonicalAddModel,
  repair:installOverrides,
  removeLegacySeasonModal:removeLegacySeasonModal
};
})();
