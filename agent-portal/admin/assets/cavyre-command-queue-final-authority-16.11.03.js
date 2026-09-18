(function(){
'use strict';
if(window.__CAVYRE_QUEUE_FINAL_161103__)return;
window.__CAVYRE_QUEUE_FINAL_161103__=true;

function upgradeLegacy(q){
 if(!q||q.classList.contains('vx3d-command-queue'))return;
 var head=q.querySelector(':scope > header');
 var counts=q.querySelector('.vx161086-queue-counts');
 var list=q.querySelector('.vx161086-queue-list');

 q.className='vx3d-command-queue';
 q.removeAttribute('style');

 if(counts){
   counts.className='vx3d-counts';
   Array.from(counts.children).forEach(function(c){
     var severity=['blocked','critical','urgent','action_required','watch','clear'].find(function(k){return c.classList.contains(k)})||'watch';
     c.className='vx3d-count '+severity;
     c.removeAttribute('style');
     var sm=c.querySelector('small');
     if(sm){var sp=document.createElement('span');sp.textContent=sm.textContent;sm.replaceWith(sp);}
   });
 }

 if(list){
   list.className='vx3d-priority-grid';
   Array.from(list.children).forEach(function(card){
     if(!card.classList.contains('vx161086-queue-item'))return;
     var severity=['blocked','critical','urgent','action_required','watch','clear'].find(function(k){return card.classList.contains(k)})||'watch';
     var num=card.querySelector(':scope > em');
     var body=card.querySelector(':scope > div');
     var open=card.querySelector(':scope > i');

     card.className='vx3d-priority-card '+severity;
     card.removeAttribute('style');

     if(body){
       var meta=body.querySelector('small');
       var title=body.querySelector('b');
       var detail=body.querySelector('span');

       var top=document.createElement('div');
       top.className='vx3d-priority-top';
       if(num)top.appendChild(num);
       if(meta)top.appendChild(meta);
       card.insertBefore(top,body);
       if(title)card.appendChild(title);
       if(detail)card.appendChild(detail);
       body.remove();
       if(open)card.appendChild(open);
     }
   });
 }
 q.dataset.vx161103='upgraded';
}

function enforce(){
 document.querySelectorAll('.vx161086-command-queue').forEach(upgradeLegacy);
 document.querySelectorAll('.vx3d-command-queue').forEach(function(q){q.dataset.vx161103='active'});
 
 
}

var scheduled=false;
function schedule(){
 if(scheduled)return; scheduled=true;
 requestAnimationFrame(function(){scheduled=false;enforce();});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule,{once:true});
else schedule();
new MutationObserver(schedule).observe(document.documentElement,{subtree:true,childList:true});
window.addEventListener('veux:shell-ready',schedule);
window.addEventListener('cavyre:vera-signals',schedule);
setInterval(enforce,1200);
})();