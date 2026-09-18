(function(){
'use strict';
if(window.__CAVYRE_RUNTIME_AUTHORITY_161148__)return;window.__CAVYRE_RUNTIME_AUTHORITY_161148__=1;
var VERSION='16.11.49', relationshipRenderer=null, relationshipBound=false;
function stamp(){
  var root=document.documentElement;
  if(root.getAttribute('data-cavyre-release')!==VERSION)root.setAttribute('data-cavyre-release',VERSION);
  var b=document.getElementById('cavyre-release-badge-161075');
  if(b&&b.textContent!=='AGENT '+VERSION)b.textContent='AGENT '+VERSION;
}
function relPanel(){return document.getElementById('p-industrydirectory');}
function activeRelationship(){var p=relPanel();return window._currentPage==='industrydirectory'||!!(p&&p.classList.contains('on'));}
function refreshRelationships(){
  if(!activeRelationship())return Promise.resolve(false);
  var p=relPanel();if(!p)return Promise.resolve(false);
  if(window.CavyreRelationships&&typeof window.CavyreRelationships.refresh==='function'){
    return window.CavyreRelationships.refresh().then(function(){stamp();return true;}).catch(function(e){console.error('[CAVYRE 16.11.49 Relationships]',e);return false;});
  }
  p.innerHTML='<div style="padding:34px 28px;color:var(--mute);font:9px var(--fM);letter-spacing:.12em">CAVYRE · Loading Relationships…</div>';
  return Promise.resolve(false);
}
function bindRelationshipAuthority(){
  if(relationshipBound)return;relationshipBound=true;
  relationshipRenderer=function(){return refreshRelationships();};
  try{Object.defineProperty(window,'renderIndustryDirectory',{configurable:false,enumerable:true,get:function(){return relationshipRenderer;},set:function(){}});}catch(e){window.renderIndustryDirectory=relationshipRenderer;}
}
function boot(){stamp();bindRelationshipAuthority();if(activeRelationship())refreshRelationships();}
function onReady(){boot();setTimeout(boot,120);}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',onReady,{once:true});else onReady();
window.addEventListener('veux:shell-ready',onReady);
window.addEventListener('veux:assets-ready',onReady);
window.addEventListener('veux:page-rendered',function(e){stamp();var p=e&&e.detail&&e.detail.page||window._currentPage;if(p==='industrydirectory')setTimeout(refreshRelationships,0);});
window.addEventListener('pageshow',stamp);
var rb=document.documentElement;
new MutationObserver(function(muts){
  var needs=false;
  for(var i=0;i<muts.length;i++){
    if(muts[i].type==='attributes'&&muts[i].attributeName==='data-cavyre-release'){needs=true;break;}
    var b=document.getElementById('cavyre-release-badge-161075');if(b&&b.textContent!=='AGENT '+VERSION){needs=true;break;}
  }
  if(needs)queueMicrotask(stamp);
}).observe(rb,{attributes:true,attributeFilter:['data-cavyre-release'],childList:true,subtree:true});
})();
