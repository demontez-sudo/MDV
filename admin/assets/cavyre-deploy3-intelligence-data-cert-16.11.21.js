(function(){
'use strict';
if(window.__CAVYRE_DEPLOY3_161121__)return;
window.__CAVYRE_DEPLOY3_161121__=1;
function I(e,p,v){if(e)e.style.setProperty(p,v,'important')}
function normalize(root){
 if(!root)return;
 root.classList.add('vx161121-intelligence-surface');
 root.querySelectorAll('button,a,[role="button"]').forEach(function(e){
  var s=(e.textContent||'').trim();
  if(s.length>22){I(e,'white-space','normal');I(e,'line-height','1.25')}
 });
 root.querySelectorAll('[class*="count"],[class*="metric"],[class*="kpi"]').forEach(function(e){I(e,'min-width','0')});
}
function signals(root){
 if(!root)return;
 root.querySelectorAll('[class*="alert"],[class*="signal"],[class*="status"],[class*="badge"]').forEach(function(e){
  var s=(e.textContent||'').toLowerCase();
  if(/critical|blocked|failed|overdue|conflict/.test(s))e.dataset.intelTone='critical';
  else if(/warning|attention|pending|review|stale|due/.test(s))e.dataset.intelTone='attention';
  else if(/ready|clear|confirmed|complete|healthy|paid/.test(s))e.dataset.intelTone='clear';
 });
}
function bind(){
 [
  'p-agencycommand','p-agencydesk','p-dashboard','p-search','p-notifications',
  'p-calendar','p-crm','p-model360','p-travel','p-mobility','p-finance'
 ].forEach(function(id){var r=document.getElementById(id);normalize(r);signals(r)});
 
 
}
var q=0;function go(){if(q)return;q=1;requestAnimationFrame(function(){q=0;bind()})}
document.readyState==='loading'?document.addEventListener('DOMContentLoaded',go,{once:true}):go();
new MutationObserver(go).observe(document.documentElement,{childList:true,subtree:true});
window.addEventListener('resize',go,{passive:true});
})();