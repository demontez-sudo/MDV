(function(){
'use strict';
if(window.__CAVYRE_MOBILITY_ROUTE_161089__)return;window.__CAVYRE_MOBILITY_ROUTE_161089__=true;
var ALIAS={mobility:'globalmobility',travel:'globalmobility',travelvisa:'globalmobility','travel-visa':'globalmobility'};
function canon(p){p=String(p||'');return ALIAS[p]||p}
function normalizeState(){
  ['veux-agent-nav-state-v1'].forEach(function(k){try{var s=JSON.parse(sessionStorage.getItem(k)||'null');if(s&&s.page&&canon(s.page)!==s.page){s.page=canon(s.page);sessionStorage.setItem(k,JSON.stringify(s));}}catch(e){}});
  try{var stack=JSON.parse(sessionStorage.getItem('veux-agent-nav-stack-v1')||'[]');if(Array.isArray(stack)){var dirty=false;stack.forEach(function(s){if(s&&s.page&&canon(s.page)!==s.page){s.page=canon(s.page);dirty=true;}});if(dirty)sessionStorage.setItem('veux-agent-nav-stack-v1',JSON.stringify(stack));}}catch(e){}
  try{if(history.state&&history.state.veuxPortal==='agent'&&history.state.page&&canon(history.state.page)!==history.state.page){var s=Object.assign({},history.state,{page:canon(history.state.page)});history.replaceState(s,document.title,location.href);}}catch(e){}
}
function wrapNav(){
  var old=window.navTo;if(typeof old!=='function'||old.__cavyreMobilityAlias)return;
  var fn=function(p){arguments[0]=canon(p);return old.apply(this,arguments)};fn.__cavyreMobilityAlias=true;fn.__previous=old;window.navTo=fn;
}
function wrapBuild(){
  var old=window.build;if(typeof old!=='function'||old.__cavyreMobilityAlias)return;
  var fn=function(p,el){return old.call(this,canon(p),el)};fn.__cavyreMobilityAlias=true;fn.__previous=old;window.build=fn;
}
function patchRenderers(){
  try{if(window.VEUX_V15_ROUTE_RENDERERS&&window.VEUX_V15_ROUTE_RENDERERS.globalmobility)window.VEUX_V15_ROUTE_RENDERERS.mobility=window.VEUX_V15_ROUTE_RENDERERS.globalmobility;}catch(e){}
}
function recover(){
  normalizeState();patchRenderers();wrapBuild();wrapNav();
  var p=window._currentPage||'';
  if(canon(p)!==p&&typeof window.navTo==='function'){
    try{window.navTo(canon(p),{skipPortalStack:true,historyMode:'replace'});}catch(e){}
  }
}
window.addEventListener('popstate',function(){setTimeout(recover,0)});
window.addEventListener('veux:agency-v16-shell-ready',function(){setTimeout(recover,0)});
window.addEventListener('veux:shell-ready',function(){setTimeout(recover,0)});
document.addEventListener('click',function(e){
  var n=e.target&&e.target.closest&&e.target.closest('[data-page="mobility"],[data-p="mobility"],[data-vx17-nav="mobility"]');
  if(!n)return;
  e.preventDefault();e.stopImmediatePropagation();
  if(typeof window.navTo==='function')window.navTo('globalmobility');
},true);
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',recover,{once:true});else recover();
setTimeout(recover,80);setTimeout(recover,600);setTimeout(recover,1600);
})();