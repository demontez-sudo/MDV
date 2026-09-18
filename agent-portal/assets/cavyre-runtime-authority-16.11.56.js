(function(){
'use strict';
if(window.__CAVYRE_RUNTIME_AUTHORITY_161150__)return;window.__CAVYRE_RUNTIME_AUTHORITY_161150__=1;
var VERSION='16.11.56', relationshipRenderer=null, relationshipBound=false;
function stamp(){
  var root=document.documentElement;
  root.setAttribute('data-cavyre-release',VERSION);
  var b=document.getElementById('cavyre-release-badge-161075');
  if(b)b.textContent='AGENT '+VERSION;
}
function relPanel(){return document.getElementById('p-industrydirectory');}
function activeRelationship(){var p=relPanel();return window._currentPage==='industrydirectory'||!!(p&&p.classList.contains('on'));}
function refreshRelationships(){
  if(!activeRelationship())return Promise.resolve(false);
  var p=relPanel();if(!p)return Promise.resolve(false);
  if(window.CavyreRelationships&&typeof window.CavyreRelationships.refresh==='function'){
    return window.CavyreRelationships.refresh().then(function(){return true;}).catch(function(e){console.error('[CAVYRE Relationships]',e);return false;});
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
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
window.addEventListener('veux:shell-ready',boot,{once:true});
window.addEventListener('veux:page-rendered',function(e){var p=e&&e.detail&&e.detail.page||window._currentPage;if(p==='industrydirectory')refreshRelationships();});
window.addEventListener('pageshow',stamp);
})();
