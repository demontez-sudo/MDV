(function(){
'use strict';
if(window.__CAVYRE_QUEUE_AUTHORITY_161102__)return;
window.__CAVYRE_QUEUE_AUTHORITY_161102__=true;

function convert(old){
  if(!old || old.classList.contains('vx3d-command-queue'))return old;
  var head=old.querySelector(':scope > header');
  var oldCounts=old.querySelector('.vx161086-queue-counts');
  var oldList=old.querySelector('.vx161086-queue-list');

  old.classList.remove('vx161086-command-queue');
  old.classList.add('vx3d-command-queue');
  old.removeAttribute('style');

  if(oldCounts){
    oldCounts.className='vx3d-counts';
    Array.from(oldCounts.children).forEach(function(x){
      var sev=x.className||'';
      x.className='vx3d-count '+sev.replace(/\bvx\S+/g,'').trim();
      x.removeAttribute('style');
      var b=x.querySelector('b'),s=x.querySelector('small,span');
      if(s && s.tagName==='SMALL'){
        var span=document.createElement('span');
        span.textContent=s.textContent;
        s.replaceWith(span);
      }
    });
  }

  if(oldList){
    oldList.className='vx3d-priority-grid';
    Array.from(oldList.querySelectorAll(':scope > .vx161086-queue-item')).forEach(function(card){
      var severity=['blocked','critical','urgent','action_required','watch','clear'].find(function(k){return card.classList.contains(k)})||'watch';
      card.className='vx3d-priority-card '+severity;
      card.removeAttribute('style');

      var num=card.querySelector(':scope > em');
      var body=card.querySelector(':scope > div');
      var open=card.querySelector(':scope > i');
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

    var legacyMore=oldList.querySelector('.vx161095-queue-more');
    if(legacyMore)legacyMore.remove();
  }
  old.setAttribute('data-vx161102-authority','3d');
  return old;
}

function enforce(){
  document.querySelectorAll('.vx161086-command-queue').forEach(convert);
  document.querySelectorAll('.vx3d-command-queue').forEach(function(q){
    q.setAttribute('data-vx161102-authority','3d');
  });
  
  
}
var queued=false;
function schedule(){
  if(queued)return;queued=true;
  requestAnimationFrame(function(){queued=false;enforce()});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule,{once:true});
else schedule();
new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true});
window.addEventListener('veux:shell-ready',schedule);
window.addEventListener('cavyre:vera-signals',schedule);
})();