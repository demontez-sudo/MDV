/* Maison de Veux cursor: two circles (a bright dot on the pointer, a highlighted ring a beat behind).
   Mouse devices only. Runs only after the first real mouse move, so a failure can never leave you without a pointer.
   Elements that want their own cursor (text fields, resize handles, drag handles…) keep it, and the circles step aside there. */
(function(){
'use strict';
if(window.__MDV_CURSOR__)return;window.__MDV_CURSOR__=true;
try{if(!window.matchMedia||!matchMedia('(hover:hover) and (pointer:fine)').matches)return;}catch(e){return;}
var reduce=false;try{reduce=matchMedia('(prefers-reduced-motion:reduce)').matches;}catch(e){}
var root=document.documentElement,seen=typeof WeakMap==='function'?new WeakMap():null;
var el=document.createElement('div');el.className='mdv-cr';el.setAttribute('aria-hidden','true');
el.innerHTML='<i class="mdv-cr-r" data-label=""></i><i class="mdv-cr-d"></i>';
var ring=el.firstChild,dot=el.lastChild;
var x=-200,y=-200,rx=x,ry=y,dx=x,dy=y,started=false,label='';

/* what does the page want for this element? remember it before we restyle */
function kind(t){
  if(!t||t.nodeType!==1)return 'ar';
  var k=seen&&seen.get(t);if(k)return k;
  var c='';try{c=getComputedStyle(t).cursor;}catch(e){}
  if(c==='pointer')k='pt';
  else if(c==='none'||c==='auto'||c==='default'||c==='')k='ar';
  else k='nat';                       /* text, grab, resize, zoom, not-allowed… */
  if(seen)seen.set(t,k);
  if(k!=='nat'&&c!=='none')t.setAttribute('data-mdv-cur',k);
  else if(k==='nat')t.setAttribute('data-mdv-cur','nat');
  return k;
}
function state(t){
  var k=kind(t);
  var lab=t.closest?t.closest('[data-cursor]'):null,link=!lab&&t.closest?t.closest('a,button,[role="button"],summary,label,[data-mdv-cur="pt"]'):null;
  var l=lab?lab.getAttribute('data-cursor'):'';
  if(l!==label){label=l;ring.setAttribute('data-label',l);}
  el.classList.toggle('off',k==='nat');
  el.classList.toggle('label',!!lab&&k!=='nat');
  el.classList.toggle('link',!!link&&!lab&&k!=='nat');
}
function start(){
  if(started)return;started=true;
  (document.body||root).appendChild(el);
  root.classList.add('mdv-cur');
  rx=x;ry=y;dx=x;dy=y;el.classList.add('on');
  (function loop(){
    var kr=reduce?1:.16,kd=reduce?1:.55;
    rx+=(x-rx)*kr;ry+=(y-ry)*kr;dx+=(x-dx)*kd;dy+=(y-dy)*kd;
    ring.style.transform='translate3d('+rx.toFixed(1)+'px,'+ry.toFixed(1)+'px,0)';
    dot.style.transform='translate3d('+dx.toFixed(1)+'px,'+dy.toFixed(1)+'px,0)';
    requestAnimationFrame(loop);
  })();
}
document.addEventListener('mousemove',function(e){
  x=e.clientX;y=e.clientY;
  if(!started){if(document.body){start();}else return;}
  el.classList.add('on');
},{passive:true});
document.addEventListener('mouseover',function(e){if(started)state(e.target);},true);
document.addEventListener('mousedown',function(){el.classList.add('down');},true);
document.addEventListener('mouseup',function(){el.classList.remove('down');},true);
/* leaving the window, or entering an embedded frame, hands the pointer back to the system */
document.addEventListener('mouseout',function(e){if(!e.relatedTarget||(e.relatedTarget.tagName==='IFRAME')){el.classList.remove('on');}},true);
document.addEventListener('mouseenter',function(){if(started)el.classList.add('on');},true);
})();
