(function(){
'use strict';
if(window.__CAVYRE_AGENCY_DESK_RUNTIME_161109__)return;
window.__CAVYRE_AGENCY_DESK_RUNTIME_161109__=true;
var ID='cavyre-agency-desk-runtime-authority-161109';
function mount(){
  var old=document.getElementById(ID); if(old) old.remove();
  var m=window.__VEUX_AGENT_MOUNT__;
  if(m==null)m=/^\/(?:admin|team)(?:\/|$)/.test(location.pathname)?'/admin':'';
  var l=document.createElement('link');
  l.id=ID;l.rel='stylesheet';l.href=m+'/assets/cavyre-agency-desk-runtime-authority-16.11.09.css?v=161109';
  document.head.appendChild(l);
  document.documentElement.setAttribute('data-cavyre-desk-authority','16.11.09');
}
function mark(){
 document.querySelectorAll('.vx17-command[data-mode="desk"] .vx3d-command-queue').forEach(function(q){q.classList.add('vx161109-authority')});
}
function enforce(){mount();mark();}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){setTimeout(enforce,0)},{once:true});else setTimeout(enforce,0);
window.addEventListener('veux:shell-ready',function(){setTimeout(enforce,80)});
var t;new MutationObserver(function(ms){
 var cssAdded=ms.some(function(m){return Array.from(m.addedNodes||[]).some(function(n){return n.nodeType===1&&(n.tagName==='LINK'||n.tagName==='STYLE')&&n.id!==ID})});
 if(cssAdded){clearTimeout(t);t=setTimeout(enforce,30)} else mark();
}).observe(document.documentElement,{subtree:true,childList:true});
})();
