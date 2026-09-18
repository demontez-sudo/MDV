/* CAVYRE 16.12.46 — Model 360 Development Route Lock */
(function(){
'use strict';
if(window.__CAVYRE_MODEL360_DEV_LOCK_161246__)return;
window.__CAVYRE_MODEL360_DEV_LOCK_161246__=true;

function host(){
  return document.getElementById('p-modelpage')||document.querySelector('[data-page-root="modelpage"]');
}
function model360Visible(){
  var h=host();
  if(!h)return false;
  return !!h.querySelector('.v156-model-page,.v156-model-main,#v156-model-content');
}
function localDevelopment(){
  if(!model360Visible())return false;
  if(window.VEUX_V156&&typeof window.VEUX_V156.modelTab==='function'){
    window.VEUX_V156.modelTab('development');
    var h=host(),tab=h&&h.querySelector('.v156-tab[data-model-tab="development"]');
    if(tab){
      tab.classList.add('on');
      tab.setAttribute('aria-selected','true');
      tab.setAttribute('tabindex','0');
    }
    var content=document.getElementById('v156-model-content');
    if(content&&typeof content.scrollIntoView==='function'){
      try{content.scrollIntoView({block:'start',behavior:'instant'});}catch(_e){}
    }
    return true;
  }
  return false;
}
function isLocalDevelopmentTrigger(el){
  if(!el||!model360Visible())return false;
  var h=host();
  if(!h||!h.contains(el))return false;

  if(el.closest('.v156-tab[data-model-tab="development"]'))return true;
  if(el.closest('[data-vx161065-nav="development"]'))return true;

  var b=el.closest('button,a,[role="button"]');
  if(!b)return false;
  var text=String(b.textContent||'').replace(/\s+/g,' ').trim().toLowerCase();
  if(text==='development'||text==='open development →'||text==='open development'||text==='review →'||text==='review'){
    var section=b.closest('.v155-card,.vx161065-model-intel,.v156-model-main');
    if(section&&/development/i.test(String(section.textContent||'')))return true;
  }
  return false;
}

/* Capture BEFORE the legacy intelligence/router listeners. */
document.addEventListener('click',function(e){
  if(!isLocalDevelopmentTrigger(e.target))return;
  e.preventDefault();
  e.stopPropagation();
  if(e.stopImmediatePropagation)e.stopImmediatePropagation();
  localDevelopment();
},true);

/* Remove the legacy global destination from Model Command development signals. */
function harden(){
  var h=host();
  if(!h)return;

  h.querySelectorAll('.v156-tab[data-model-tab="development"]').forEach(function(b){
    b.setAttribute('onclick',"return CAVYRE_MODEL360_DEVELOPMENT_161246.open(event)");
    b.dataset.cavyreDevLocal='161246';
  });

  h.querySelectorAll('[data-vx161065-nav="development"]').forEach(function(b){
    b.removeAttribute('data-vx161065-nav');
    b.dataset.cavyreModelDevelopment='local';
    b.setAttribute('onclick',"return CAVYRE_MODEL360_DEVELOPMENT_161246.open(event)");
  });

  h.querySelectorAll('button').forEach(function(b){
    var oc=String(b.getAttribute('onclick')||'');
    if(/VEUX_V156\.modelTab\(['"]development['"]\)/.test(oc)){
      b.setAttribute('onclick',"return CAVYRE_MODEL360_DEVELOPMENT_161246.open(event)");
      b.dataset.cavyreDevLocal='161246';
    }
  });
}

var queued=false;
function queue(){
  if(queued)return;
  queued=true;
  requestAnimationFrame(function(){queued=false;harden();});
}
new MutationObserver(queue).observe(document.documentElement,{subtree:true,childList:true});
window.addEventListener('veux:page-rendered',function(){setTimeout(harden,0)});
window.addEventListener('veux:shell-ready',function(){setTimeout(harden,0)});
setTimeout(harden,100);setTimeout(harden,600);setTimeout(harden,1400);

window.CAVYRE_MODEL360_DEVELOPMENT_161246={
  release:'16.12.46',
  open:function(e){
    if(e){e.preventDefault();e.stopPropagation();if(e.stopImmediatePropagation)e.stopImmediatePropagation();}
    localDevelopment();
    return false;
  },
  repair:harden
};
})();