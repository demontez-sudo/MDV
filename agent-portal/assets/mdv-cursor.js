/* Maison de Veux cursor: two circles (a bright dot on the pointer, a highlighted ring a beat behind).
   Mouse devices only. Runs only after the first real mouse move, so a failure can never leave you without a pointer.
   Elements that want their own cursor (text fields, resize handles, drag handles…) keep it, and the circles step aside there.
   Light by design: the animation frame loop runs only while the circles are catching up, and hover changes are coalesced. */
(function(){
'use strict';
if(window.__MDV_CURSOR__)return;window.__MDV_CURSOR__=true;
try{if(!window.matchMedia||!matchMedia('(hover:hover) and (pointer:fine)').matches)return;}catch(e){return;}
var reduce=false;try{reduce=matchMedia('(prefers-reduced-motion:reduce)').matches;}catch(e){}
var root=document.documentElement,seen=typeof WeakMap==='function'?new WeakMap():null;
var el=document.createElement('div');el.className='mdv-cr';el.setAttribute('aria-hidden','true');
el.innerHTML='<i class="mdv-cr-r" data-label=""></i><i class="mdv-cr-d"></i>';
var ring=el.firstChild,dot=el.lastChild;
var x=-200,y=-200,rx=x,ry=y,dx=x,dy=y,started=false,label='',running=false,pending=null,queued=false;

/* what does the page want for this element? remember it before we restyle it */
function kind(t){
  if(!t||t.nodeType!==1)return 'ar';
  var k=seen&&seen.get(t);if(k)return k;
  var c='';try{c=getComputedStyle(t).cursor;}catch(e){}
  if(c==='pointer')k='pt';
  else if(c==='none'||c==='auto'||c==='default'||c==='')k='ar';
  else k='nat';                       /* text, grab, resize, zoom, not-allowed… */
  if(seen)seen.set(t,k);
  if(t!==root&&t!==document.body){
    if(k==='nat')t.setAttribute('data-mdv-cur','nat');
    else if(c!=='none')t.setAttribute('data-mdv-cur',k);
  }
  return k;
}
/* the look of the circles is worked out once per frame, not once per event */
function paintState(){
  queued=false;var t=pending;pending=null;if(!t||!t.isConnected)return;
  var k=kind(t);
  var lab=t.closest?t.closest('[data-cursor]'):null,link=!lab&&t.closest?t.closest('a,button,[role="button"],summary,label,[data-mdv-cur="pt"]'):null;
  var l=lab?lab.getAttribute('data-cursor'):'';
  if(l!==label){label=l;ring.setAttribute('data-label',l);}
  el.classList.toggle('off',k==='nat');
  el.classList.toggle('label',!!lab&&k!=='nat');
  el.classList.toggle('link',!!link&&!lab&&k!=='nat');
}
function loop(){
  var kr=reduce?1:.2,kd=reduce?1:.6;
  rx+=(x-rx)*kr;ry+=(y-ry)*kr;dx+=(x-dx)*kd;dy+=(y-dy)*kd;
  ring.style.transform='translate3d('+rx.toFixed(1)+'px,'+ry.toFixed(1)+'px,0)';
  dot.style.transform='translate3d('+dx.toFixed(1)+'px,'+dy.toFixed(1)+'px,0)';
  if(Math.abs(x-rx)>.15||Math.abs(y-ry)>.15||Math.abs(x-dx)>.15||Math.abs(y-dy)>.15)requestAnimationFrame(loop);else running=false;
}
function kick(){if(!running){running=true;requestAnimationFrame(loop);}}
function start(){
  if(started)return;started=true;
  /* on the page root, not the body: the portal zooms its body, which would shift the circles away from the pointer */
  root.appendChild(el);
  root.classList.add('mdv-cur');
  rx=x;ry=y;dx=x;dy=y;
}
document.addEventListener('mousemove',function(e){
  x=e.clientX;y=e.clientY;
  if(!started)start();
  el.classList.add('on');kick();
},{passive:true});
document.addEventListener('mouseover',function(e){
  if(!started)return;
  kind(e.target);                       /* tag right away so the system pointer never flashes */
  pending=e.target;if(!queued){queued=true;requestAnimationFrame(paintState);}
},true);
document.addEventListener('mousedown',function(){el.classList.add('down');},true);
document.addEventListener('mouseup',function(){el.classList.remove('down');},true);
/* leaving the window, or entering an embedded frame, hands the pointer back to the system */
document.addEventListener('mouseout',function(e){if(!e.relatedTarget||(e.relatedTarget.tagName==='IFRAME')){el.classList.remove('on');}},true);
})();
