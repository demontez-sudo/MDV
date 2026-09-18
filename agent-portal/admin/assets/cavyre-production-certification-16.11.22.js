(function(){
'use strict';
if(window.__CAVYRE_PRODUCTION_CERT_161122__)return;
window.__CAVYRE_PRODUCTION_CERT_161122__=1;

function I(e,p,v){if(e)e.style.setProperty(p,v,'important')}
function mark(){
 
 document.documentElement.setAttribute('data-cavyre-production-cert','ready');
 
}
function harden(){
 document.querySelectorAll('[id^="p-"]').forEach(function(root){
   root.classList.add('vx161122-production');
   I(root,'min-width','0');I(root,'max-width','100%');
   root.querySelectorAll('button,[role="button"],input,select,textarea').forEach(function(el){
     if(el.tagName==='BUTTON'||el.getAttribute('role')==='button')I(el,'min-height','34px');
     if(el.tagName==='INPUT'||el.tagName==='SELECT')I(el,'min-height','36px');
   });
 });
}
function bind(){
 mark();harden();
}
var q=0;function go(){if(q)return;q=1;requestAnimationFrame(function(){q=0;bind()})}
document.readyState==='loading'?document.addEventListener('DOMContentLoaded',go,{once:true}):go();
new MutationObserver(go).observe(document.documentElement,{childList:true,subtree:true});
window.addEventListener('resize',go,{passive:true});
window.addEventListener('veux:shell-ready',go);
})();