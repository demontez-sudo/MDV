(function(){
'use strict';
if(window.__CAVYRE_RELATIONSHIP_AUTHORITY_161146__) return;
window.__CAVYRE_RELATIONSHIP_AUTHORITY_161146__=true;
var VERSION='16.11.46';
var busy=false, queued=false, obs=null, badgeObs=null;
function panel(){return document.getElementById('p-industrydirectory');}
function active(){return window._currentPage==='industrydirectory' || (panel()&&panel().classList.contains('on'));}
function setRelease(){
  try{
    document.documentElement.setAttribute('data-cavyre-release',VERSION);
    var m=document.querySelector('meta[name="cavyre-release"]');
    if(m)m.setAttribute('content',VERSION+'-relationship-runtime-authority');
    var b=document.getElementById('cavyre-release-badge-161075');
    if(b && b.textContent!=='AGENT '+VERSION)b.textContent='AGENT '+VERSION;
  }catch(e){}
}
async function own(){
  if(busy){queued=true;return;}
  if(!active()) return;
  var el=panel(); if(!el) return;
  if(!window.CavyreRelationships || !window.CavyreRelationships.refresh) return;
  busy=true;
  try{ await window.CavyreRelationships.refresh(); }
  catch(e){ console.error('[CAVYRE 16.11.46] relationship authority',e); }
  finally{busy=false;setRelease(); if(queued){queued=false;setTimeout(own,0);}}
}
function installRenderer(){
  window.renderIndustryDirectory=function(el){
    if(el && el.id!=='p-industrydirectory') el.id='p-industrydirectory';
    setTimeout(own,0);
    return Promise.resolve();
  };
}
function guardLegacy(){
  var el=panel(); if(!el) return;
  if(obs)obs.disconnect();
  obs=new MutationObserver(function(){
    if(!active()||busy)return;
    if(el.querySelector('.vxdir-page') || /Client Intelligence|CONTACT DOSSIER/i.test(el.textContent||'')){
      clearTimeout(guardLegacy.t);guardLegacy.t=setTimeout(own,30);
    }
  });
  obs.observe(el,{childList:true,subtree:true});
}
function guardBadge(){
  var b=document.getElementById('cavyre-release-badge-161075'); if(!b)return;
  if(badgeObs)badgeObs.disconnect();
  badgeObs=new MutationObserver(function(){setRelease();});
  badgeObs.observe(b,{childList:true,characterData:true,subtree:true});
}
function boot(){installRenderer();setRelease();guardBadge();if(active()){guardLegacy();own();setTimeout(own,150);setTimeout(own,900);}}
window.addEventListener('veux:page-rendered',function(e){
  installRenderer();setRelease();
  var p=e&&e.detail&&e.detail.page||window._currentPage;
  if(p==='industrydirectory'){setTimeout(function(){guardLegacy();own();},0);setTimeout(own,250);}
});
window.addEventListener('load',function(){setTimeout(boot,0);setTimeout(boot,1200);});
setTimeout(boot,0);setTimeout(boot,600);setTimeout(boot,1800);
})();
