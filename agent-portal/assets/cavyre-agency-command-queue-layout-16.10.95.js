(function(){
'use strict';
if(window.__CAVYRE_QUEUE_LAYOUT_161095__)return;
window.__CAVYRE_QUEUE_LAYOUT_161095__=true;

function apply(queue){
  if(!queue)return;
  var list=queue.querySelector('.vx161086-queue-list');
  if(!list)return;
  var cards=Array.from(list.querySelectorAll(':scope > .vx161086-queue-item'));
  if(!cards.length)return;

  var existing=list.querySelector(':scope > .vx161095-queue-more');
  if(existing)existing.remove();

  var expanded=queue.getAttribute('data-vx161095-expanded')==='true';
  cards.forEach(function(card,i){
    card.classList.toggle('vx161095-queue-hidden',!expanded && i>=6);
  });

  if(cards.length>6){
    var more=document.createElement('button');
    more.type='button';
    more.className='vx161095-queue-more';
    more.textContent=expanded?'Show Top 6':'View All '+cards.length+' Priorities';
    more.addEventListener('click',function(){
      queue.setAttribute('data-vx161095-expanded',expanded?'false':'true');
      apply(queue);
    });
    list.appendChild(more);
  }
}

function repair(){
  document.querySelectorAll('.vx161086-command-queue').forEach(apply);

  // The production badge in the inherited inline authority was still stuck on 16.10.92.
  
  
}

var scheduled=false;
function schedule(){
  if(scheduled)return;
  scheduled=true;
  requestAnimationFrame(function(){scheduled=false;repair()});
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule,{once:true});
else schedule();

new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true});
window.addEventListener('resize',schedule,{passive:true});
window.addEventListener('veux:shell-ready',schedule);
})();