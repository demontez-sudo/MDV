/* Smooth pointer-based drag & drop for every calendar view (Google Calendar style). */
(function(){
if(window.__MDV_DND__)return;window.__MDV_DND__=1;
var THRESH=5,st=null;
function cal(){return window.MDV_CAL;}
function targetAt(x,y,ghost){
  var prev=ghost&&ghost.style.display;if(ghost)ghost.style.display='none';
  var el=document.elementFromPoint(x,y);if(ghost)ghost.style.display=prev||'';
  return el&&el.closest?el.closest('[data-vx-drop-day],[data-vx-drop-orbit],#p-calendar [data-day]'):null;
}
function ensureAttrs(t){if(t&&t.hasAttribute('data-day')&&!t.dataset.vxDropDay)t.dataset.vxDropDay=t.dataset.day;}
function clearMarks(){document.querySelectorAll('.vx100-drop-target,.vx100-drop-risk').forEach(function(n){n.classList.remove('vx100-drop-target','vx100-drop-risk');});}
function ghostFor(el,e){
  var r=el.getBoundingClientRect(),g=el.cloneNode(true);
  g.removeAttribute('id');g.removeAttribute('data-vx-drag-ref');g.classList.add('mdv-dnd-ghost');
  g.style.cssText='position:fixed;left:0;top:0;width:'+Math.min(r.width,340)+'px;height:'+Math.min(r.height,120)+'px;margin:0;pointer-events:none;z-index:2147483000;';
  var b=document.createElement('div');b.className='mdv-dnd-badge';g.appendChild(b);
  document.body.appendChild(g);
  return {node:g,badge:b,dx:Math.min(e.clientX-r.left,Math.min(r.width,340)/2),dy:Math.min(e.clientY-r.top,20)};
}
function place(e){
  var g=st.ghost;g.node.style.transform='translate3d('+(e.clientX-g.dx)+'px,'+(e.clientY-g.dy)+'px,0) scale(1.03) rotate(-1deg)';
}
function edgeScroll(e){
  var m=70,v=0;if(e.clientY<m)v=-Math.ceil((m-e.clientY)/6);else if(window.innerHeight-e.clientY<m)v=Math.ceil((m-(window.innerHeight-e.clientY))/6);
  var sc=st.scroller;if(v&&sc){if(sc===document.scrollingElement)window.scrollBy(0,v);else sc.scrollTop+=v;}
}
function scrollParent(el){var n=el.parentElement;while(n&&n!==document.body){var s=getComputedStyle(n);if(/(auto|scroll)/.test(s.overflowY)&&n.scrollHeight>n.clientHeight+4)return n;n=n.parentElement;}return document.scrollingElement;}
function update(e){
  place(e);edgeScroll(e);
  var M=cal(),t=targetAt(e.clientX,e.clientY,st.ghost.node);ensureAttrs(t);
  if(t!==st.target){clearMarks();st.target=t;}
  var ns=null,hits=[];
  if(t){ns=M.dropDateTime(t,e,st.x);hits=ns?M.moveConflicts(st.x,ns):[];t.classList.toggle('vx100-drop-risk',!!hits.length);t.classList.toggle('vx100-drop-target',!hits.length);}
  st.ns=ns;st.risk=!!hits.length;
  var b=st.ghost.badge;b.textContent=ns?M.fmt(ns)+(hits.length?' · conflict':''):'Drop on a day';b.classList.toggle('risk',!!hits.length||!ns);
  st.ghost.node.classList.toggle('risk',!!hits.length);
}
function finish(commit){
  var s=st;if(!s)return;st=null;
  document.removeEventListener('pointermove',onMove,true);document.removeEventListener('pointerup',onUp,true);document.removeEventListener('pointercancel',onCancel,true);document.removeEventListener('keydown',onKey,true);
  document.body.classList.remove('vx100-drag-active','mdv-dnd-on');
  s.el.classList.remove('vx100-dragging','mdv-dnd-src');clearMarks();
  var M=cal();if(s.started)M.S.dragSuppressUntil=Date.now()+350;M.S.drag=null;
  var g=s.ghost&&s.ghost.node;
  if(!s.started){return;}
  if(commit&&s.ns&&!s.risk&&String(s.ns.toISOString())!==String(new Date(s.x.starts_at).toISOString())){
    if(g){g.classList.add('drop');g.style.opacity='0';}
    setTimeout(function(){if(g)g.remove();},160);
    M.persistMove(s.x,s.ns).catch(function(err){M.toastMove(err&&err.message||String(err),true);});
  }else{
    if(commit&&s.risk){M.toastMove('Move blocked — that time overlaps another event for the same model.',true);}
    if(g){g.classList.add('back');var r=s.el.getBoundingClientRect();g.style.transition='transform .22s cubic-bezier(.2,.8,.2,1),opacity .22s';g.style.transform='translate3d('+r.left+'px,'+r.top+'px,0)';g.style.opacity='0';setTimeout(function(){g.remove();},240);}
  }
}
function onMove(e){
  if(!st||e.pointerId!==st.id)return;
  if(!st.started){
    if(Math.abs(e.clientX-st.sx)<THRESH&&Math.abs(e.clientY-st.sy)<THRESH)return;
    st.started=true;st.ghost=ghostFor(st.el,{clientX:st.sx,clientY:st.sy});st.scroller=scrollParent(st.el);
    st.el.classList.add('vx100-dragging','mdv-dnd-src');document.body.classList.add('vx100-drag-active','mdv-dnd-on');
    cal().S.drag={x:st.x,startedAt:Date.now()};
  }
  if(e.buttons===0){finish(true);return;}
  e.preventDefault();update(e);
}
function onUp(e){if(!st||e.pointerId!==st.id)return;if(st.started){e.preventDefault();e.stopPropagation();}finish(true);}
function onCancel(){finish(false);}
function onKey(e){if(e.key==='Escape'&&st){e.preventDefault();finish(false);}}
document.addEventListener('dragstart',function(e){var t=e.target&&e.target.closest&&e.target.closest('[data-vx-drag-ref]');if(t){e.preventDefault();e.stopImmediatePropagation();}},true);
document.addEventListener('pointerdown',function(e){
  if(st||e.button>0||!cal())return;
  var el=e.target&&e.target.closest&&e.target.closest('#p-calendar [data-vx-drag-ref]');if(!el)return;
  if(e.target.closest('input,select,textarea,a,[data-no-drag]'))return;
  var x=cal().dragRecord(el.dataset.vxDragRef);if(!x)return;
  st={id:e.pointerId,el:el,x:x,sx:e.clientX,sy:e.clientY,started:false,target:null,ns:null,risk:false};
  document.addEventListener('pointermove',onMove,{capture:true,passive:false});document.addEventListener('pointerup',onUp,true);document.addEventListener('pointercancel',onCancel,true);document.addEventListener('keydown',onKey,true);
},true);
})();
