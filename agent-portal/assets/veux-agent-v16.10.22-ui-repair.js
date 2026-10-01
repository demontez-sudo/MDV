
(function(){
'use strict';
if(window.__VEUX_UI_REPAIR_161022__)return;window.__VEUX_UI_REPAIR_161022__=true;
/* 16.10.22 used to replace the official vera-mark-img/.vx17-vera-orb/#_asst-btn
   icons with an empty .vx20-vera-wave-mark span (a CSS clip-path shape that only
   renders when html[data-veux-wave] is present and its CSS has loaded). When that
   didn't apply, the wipe left a correctly-styled but completely empty icon — the
   search bar mark, the Agency Command hero orb, and the chat launcher all went
   blank. The image-based mark is the one proven-reliable path, so this file no
   longer deletes it; it only keeps the non-destructive UX touches (arrow button,
   placeholder, Enter-to-open). */
function normalizeCommand(cmd){
  if(!cmd||cmd.dataset.vx22Normalized==='1')return;cmd.dataset.vx22Normalized='1';
  var b=cmd.querySelector('button');
  if(b){b.innerHTML='<span class="vx21-command-arrow" aria-hidden="true">→</span>';b.title='Open Vera Intelligence';b.setAttribute('aria-label','Open Vera Intelligence');b.onclick=function(e){e.preventDefault();var x=document.getElementById('_asst-btn');if(x)x.click();};}
  var input=cmd.querySelector('input');
  if(input){input.setAttribute('placeholder','Ask Vera to plan, move or resolve…');input.setAttribute('aria-label','Ask Vera');input.addEventListener('keydown',function(e){if(e.key==='Enter'){e.preventDefault();var x=document.getElementById('_asst-btn');if(x)x.click();}});}
}
function process(root){
  if(!root||!root.querySelectorAll)return;
  if(root.matches&&root.matches('.vx73-command'))normalizeCommand(root);
  root.querySelectorAll('.vx73-command').forEach(normalizeCommand);
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
