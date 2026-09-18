(function(){
'use strict';if(window.__CAVYRE_QUEUE_HARDEN_161096__)return;window.__CAVYRE_QUEUE_HARDEN_161096__=true;
function repair(){
 document.querySelectorAll('.vx161086-command-queue').forEach(function(q){
  var list=q.querySelector('.vx161086-queue-list');if(!list)return;
  var cards=Array.from(list.querySelectorAll('.vx161086-queue-item'));
  cards.forEach(function(c,i){
   c.setAttribute('aria-label',(c.innerText||('Priority '+(i+1))).replace(/\s+/g,' ').trim());
   if(c.tagName!=='BUTTON'&&!c.hasAttribute('tabindex'))c.setAttribute('tabindex','0');
   if(c.tagName!=='BUTTON'&&!c.__vx161096Key){
    c.__vx161096Key=true;c.addEventListener('keydown',function(e){if(e.key==='Enter'||e.key===' '){e.preventDefault();c.click()}});
   }
  });
  var old=list.querySelector('.vx161096-empty');
  if(!cards.length){
   q.setAttribute('data-vx161096-empty','true');
   if(!old){old=document.createElement('p');old.className='vx161096-empty';old.textContent='No command priorities require attention right now.';list.appendChild(old)}
  }else{
   q.removeAttribute('data-vx161096-empty');if(old)old.remove();
  }
 });
 
 
}
var pending=false;function schedule(){if(pending)return;pending=true;requestAnimationFrame(function(){pending=false;repair()})}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule,{once:true});else schedule();
new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true});
window.addEventListener('veux:shell-ready',schedule);})();