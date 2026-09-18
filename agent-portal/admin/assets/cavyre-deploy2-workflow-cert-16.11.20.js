(function(){
'use strict';
if(window.__CAVYRE_DEPLOY2_161120__)return;
window.__CAVYRE_DEPLOY2_161120__=1;

function I(e,p,v){if(e)e.style.setProperty(p,v,'important')}
function normalizePage(root){
 if(!root)return;
 root.classList.add('vx161120-workflow-page');
 root.querySelectorAll('button').forEach(function(b){
  I(b,'min-height','34px');
  if((b.textContent||'').trim().length>18){I(b,'white-space','normal');I(b,'line-height','1.25')}
 });
 root.querySelectorAll('input,select,textarea').forEach(function(x){I(x,'font-size','12px');I(x,'min-height',x.tagName==='TEXTAREA'?'72px':'36px')});
 root.querySelectorAll('table').forEach(function(t){I(t,'width','100%')});
}
function tagStates(root){
 if(!root)return;
 root.querySelectorAll('[class*="status"],[class*="badge"],[class*="pill"]').forEach(function(e){
  var s=(e.textContent||'').trim().toLowerCase();
  if(/overdue|failed|blocked|critical/.test(s))e.dataset.workflowTone='danger';
  else if(/complete|paid|confirmed|ready|approved/.test(s))e.dataset.workflowTone='success';
  else if(/progress|pending|review|waiting|due/.test(s))e.dataset.workflowTone='attention';
 });
}
function bind(){
 [
  'p-tasksconsolidated','p-tasks','p-travel','p-mobility','p-packages','p-finance',
  'p-crm','p-model360','p-bookings','p-booking'
 ].forEach(function(id){
   var r=document.getElementById(id);normalizePage(r);tagStates(r);
 });
 
 
}
var q=0;function go(){if(q)return;q=1;requestAnimationFrame(function(){q=0;bind()})}
document.readyState==='loading'?document.addEventListener('DOMContentLoaded',go,{once:true}):go();
new MutationObserver(go).observe(document.documentElement,{childList:true,subtree:true});
window.addEventListener('resize',go,{passive:true});
})();