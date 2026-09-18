
(function(){
'use strict';
if(window.__VEUX_UI_REPAIR_161022__)return;window.__VEUX_UI_REPAIR_161022__=true;
function mark(avatar){var s=document.createElement('span');s.className='vx20-vera-wave-mark'+(avatar?' avatar':'');s.setAttribute('aria-hidden','true');return s;}
function normalizeCommand(cmd){
  if(!cmd||cmd.dataset.vx22Normalized==='1')return;cmd.dataset.vx22Normalized='1';
  Array.from(cmd.children).forEach(function(n){if(n.matches&&n.matches('.vera-mark,.vera-mark-img,.vx20-vera-wave-mark'))n.remove();});
  cmd.insertBefore(mark(false),cmd.firstChild);
  var b=cmd.querySelector('button');
  if(b){b.innerHTML='<span class="vx21-command-arrow" aria-hidden="true">→</span>';b.title='Open Vera Intelligence';b.setAttribute('aria-label','Open Vera Intelligence');b.onclick=function(e){e.preventDefault();var x=document.getElementById('_asst-btn');if(x)x.click();};}
  var input=cmd.querySelector('input');
  if(input){input.setAttribute('placeholder','Ask Vera to plan, move or resolve…');input.setAttribute('aria-label','Ask Vera');input.addEventListener('keydown',function(e){if(e.key==='Enter'){e.preventDefault();var x=document.getElementById('_asst-btn');if(x)x.click();}});}
}
function normalizeLauncher(){var b=document.getElementById('_asst-btn');if(!b||b.dataset.vx22Normalized==='1')return;b.dataset.vx22Normalized='1';b.innerHTML='';b.appendChild(mark(true));}
function process(root){
  if(!root||!root.querySelectorAll)return;
  if(root.matches&&root.matches('.vx73-command'))normalizeCommand(root);
  root.querySelectorAll('.vx73-command').forEach(normalizeCommand);
  root.querySelectorAll('.vx17-vera-orb').forEach(function(b){if(b.dataset.vx22Normalized==='1')return;b.dataset.vx22Normalized='1';b.innerHTML='';b.appendChild(mark(true));});
  root.querySelectorAll('.vera-mark-img,.vera-avatar-img').forEach(function(img){if(img.closest&&img.closest('.vx73-command'))return;var a=img.classList.contains('vera-avatar-img');img.replaceWith(mark(a));});
  normalizeLauncher();
}
function rosterClick(e){var row=e.target&&e.target.closest&&e.target.closest('[data-v155-roster-id]');if(!row)return;var id=row.dataset.v155RosterId;if(id&&window.VEUX_V155&&typeof VEUX_V155.selectRoster==='function')VEUX_V155.selectRoster(id);}
function start(){
  process(document);
  document.addEventListener('click',rosterClick,true);
  var queue=[],scheduled=false;
  var obs=new MutationObserver(function(ms){
    ms.forEach(function(m){m.addedNodes.forEach(function(n){if(n.nodeType===1)queue.push(n);});});
    if(scheduled||!queue.length)return;
    scheduled=true;requestAnimationFrame(function(){scheduled=false;queue.splice(0).forEach(process);});
  });
  obs.observe(document.body,{childList:true,subtree:true});
  window.__VEUX_UI_REPAIR_OBSERVER__=obs;
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
window.VEUX_UI_REPAIR_161022={version:'16.10.22',process:process};
})();
