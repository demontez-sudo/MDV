
function vxOrbitSameTimeLanes(events){
  const groups = new Map();
  (events||[]).forEach((ev,idx)=>{
    const raw = String(ev.start_time || ev.start || ev.time || ev.start_at || "");
    const d = raw ? new Date(raw) : null;
    const key = d && !isNaN(d) ? `${d.getHours()}:${String(d.getMinutes()).padStart(2,"0")}` : raw.slice(0,5);
    if(!groups.has(key)) groups.set(key,[]);
    groups.get(key).push({ev,idx});
  });
  const lanes = new Map();
  groups.forEach(items=>{
    const n=items.length;
    items.forEach((item,i)=>{
      // Center the simultaneous items around their original orbital point.
      lanes.set(item.idx,{index:i,count:n,offset:(i-(n-1)/2)});
    });
  });
  return lanes;
}


(function(){
'use strict';
if(window.__VEUX_KINETIC_ORBIT_161024__)return;window.__VEUX_KINETIC_ORBIT_161024__=true;
function decorate(root){
  (root||document).querySelectorAll('.vx75-dial').forEach(function(d){
    if(d.querySelector('.vx102-orbit-ring'))return;
    ['a','b','c'].forEach(function(k){
      var r=document.createElement('i');r.className='vx102-orbit-ring vx102-ring-'+k;r.setAttribute('aria-hidden','true');d.prepend(r);
    });
    ['a','b','c'].forEach(function(k){
      var s=document.createElement('i');s.className='vx102-orbit-sat vx102-sat-'+k;s.setAttribute('aria-hidden','true');d.appendChild(s);
    });
  });
}
var obs=new MutationObserver(function(m){
  for(var i=0;i<m.length;i++)if(m[i].addedNodes.length){requestAnimationFrame(function(){decorate(document)});break;}
});
function start(){decorate(document);obs.observe(document.body,{childList:true,subtree:true});}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();


function vxArrangeOrbitSimultaneous(){
  const root=document.querySelector(".vx75-orbit-stage,.vx75-orbit,.orbit-command");
  if(!root)return;
  const nodes=[...root.querySelectorAll(".vx75-orbit-node")];
  const groups=new Map();
  nodes.forEach(node=>{
    const txt=(node.innerText||"").toUpperCase();
    const m=txt.match(/\b(\d{1,2}:\d{2})\s*(AM|PM)?\b/);
    if(!m)return;
    const key=m[1]+" "+(m[2]||"");
    if(!groups.has(key))groups.set(key,[]);
    groups.get(key).push(node);
  });
  nodes.forEach(n=>{n.style.removeProperty("--vx-time-lane");n.style.removeProperty("--vx-time-count");n.classList.remove("vx-same-time");});
  groups.forEach(items=>{
    if(items.length<2)return;
    items.forEach((node,i)=>{
      node.classList.add("vx-same-time");
      node.style.setProperty("--vx-time-lane",String(i-(items.length-1)/2));
      node.style.setProperty("--vx-time-count",String(items.length));
    });
  });
}
if(!window.__vxOrbitLaneObserver){
  window.__vxOrbitLaneObserver=true;
  const run=()=>requestAnimationFrame(vxArrangeOrbitSimultaneous);
  document.addEventListener("DOMContentLoaded",run,{once:true});
  new MutationObserver(run).observe(document.documentElement,{subtree:true,childList:true});
}


/* 16.10.29 — Orbit hover preview + click full expansion
   Hover: full event label rises upright toward the screen.
   Click: the forward card expands and mirrors the full Orbit event detail. */
(function(){
  if(window.__vxOrbitPreviewExpand) return;
  window.__vxOrbitPreviewExpand=true;

  let lift=null, source=null, locked=false;

  function esc(s){
    return String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  function removeLift(force){
    if(locked && !force) return;
    if(lift){ lift.remove(); lift=null; }
    source=null;
  }

  function eventLabel(node){
    const raw=(node.innerText||'').split('\n').map(s=>s.trim()).filter(Boolean);
    const time=raw.find(s=>/\b\d{1,2}:\d{2}\s*(AM|PM)?\b/i.test(s))||'';
    const title=raw.find(s=>s!==time && !/^[A-Z]{1,3}$/.test(s) && !/confirmed|scheduled|pending|tentative|conflict/i.test(s)) || raw[raw.length-1] || 'Calendar Event';
    const status=raw.find(s=>/confirmed|scheduled|pending|tentative|conflict|option/i.test(s))||'';
    return {time,title,status,raw};
  }

  function previewHTML(node){
    const x=eventLabel(node);
    return '<div class="vx109-preview-kicker">ORBIT EVENT</div>'+
      '<div class="vx109-preview-time">'+esc(x.time)+'</div>'+
      '<div class="vx109-preview-title">'+esc(x.title)+'</div>'+
      (x.status?'<div class="vx109-preview-status">'+esc(x.status)+'</div>':'')+
      '<div class="vx109-preview-hint">Click to expand event</div>';
  }

  function detailHTML(){
    /* Orbit already creates a full event card when an event is selected.
       Mirror that card into the viewport-level forward panel instead of
       duplicating its business logic. */
    const card=document.querySelector('.vx75-orbit-card');
    if(card){
      const clone=card.cloneNode(true);
      clone.querySelectorAll('[id]').forEach(n=>n.removeAttribute('id'));
      return clone.innerHTML;
    }
    return '';
  }

  function positionLift(node){
    if(!lift||!node)return;
    const r=node.getBoundingClientRect();
    lift.style.left=(r.left+r.width/2)+'px';
    lift.style.top=(r.top+r.height/2)+'px';
  }

  function makePreview(node){
    if(!node || locked) return;
    removeLift(true);
    source=node;
    lift=document.createElement('div');
    lift.className='vx109-orbit-forward vx109-preview';
    lift.innerHTML=previewHTML(node);
    positionLift(node);
    document.body.appendChild(lift);
    requestAnimationFrame(()=>lift&&lift.classList.add('vx109-show'));
  }

  function expand(node){
    if(!node)return;
    source=node;
    locked=true;

    if(!lift){
      lift=document.createElement('div');
      lift.className='vx109-orbit-forward';
      positionLift(node);
      document.body.appendChild(lift);
    }

    lift.classList.remove('vx109-preview');
    lift.classList.add('vx109-expanded','vx109-show');
    lift.innerHTML='<div class="vx109-expanding"><span></span><span></span><span></span></div>';

    /* Let the existing Orbit click handler build/select the official detail card,
       then mirror the actual event content. */
    requestAnimationFrame(function(){
      setTimeout(function(){
        if(!lift)return;
        const details=detailHTML();
        if(details){
          lift.innerHTML='<button type="button" class="vx109-close" aria-label="Close expanded event">×</button>'+
                         '<div class="vx109-full-detail">'+details+'</div>';
        }else{
          lift.innerHTML='<button type="button" class="vx109-close" aria-label="Close expanded event">×</button>'+
                         '<div class="vx109-full-detail">'+previewHTML(node)+'</div>';
        }
      },80);
    });
  }

  document.addEventListener('pointerover',function(e){
    const node=e.target.closest && e.target.closest('.vx75-orbit-node');
    if(!node || locked) return;
    if(e.relatedTarget && node.contains(e.relatedTarget)) return;
    makePreview(node);
  },true);

  document.addEventListener('pointerout',function(e){
    const node=e.target.closest && e.target.closest('.vx75-orbit-node');
    if(!node || locked) return;
    if(e.relatedTarget && node.contains(e.relatedTarget)) return;
    removeLift(false);
  },true);

  document.addEventListener('click',function(e){
    const close=e.target.closest && e.target.closest('.vx109-close');
    if(close){
      e.preventDefault();e.stopPropagation();
      locked=false;removeLift(true);return;
    }

    const node=e.target.closest && e.target.closest('.vx75-orbit-node');
    if(node){
      /* Do not suppress the original click. It still selects the event and
         drives Model Intelligence / existing Orbit behavior. */
      expand(node);
      return;
    }

    if(locked &&
       !e.target.closest('.vx109-orbit-forward') &&
       !e.target.closest('.vx75-orbit-card') &&
       !e.target.closest('.vx75-intelligence')){
      locked=false;removeLift(true);
    }
  },true);

  window.addEventListener('resize',function(){
    if(source&&lift) positionLift(source);
  },{passive:true});

  window.addEventListener('scroll',function(){
    if(source&&lift) positionLift(source);
  },{passive:true});
})();;
