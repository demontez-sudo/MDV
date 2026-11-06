/* Maison de Veux cursor: two circles (a bright dot on the pointer, a highlighted ring a beat behind).
   Mouse devices only. Runs only after the first real mouse move, so a failure can never leave you without a pointer.
   Elements that want their own cursor (text fields, resize handles, drag handles…) keep it, and the circles step aside there.
   Light by design: the animation frame loop runs only while the circles are catching up, and hover changes are coalesced. */
(function(){
'use strict';
/* guard on the document, not the window: a frame's window is reused when it goes from blank to its page, and must start fresh */
if(document.__mdvCursor)return;document.__mdvCursor=true;window.__MDV_CURSOR__=true;
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

/* Pages that open inside a frame (DaySilk and the like) are separate documents: the page's pointer events never reach this file from inside them,
   so the circles would vanish there. Give each same-origin frame its own copy of the cursor, in the same colours as the page's background. */
var SRC='';try{SRC=(document.currentScript&&document.currentScript.src)||'';}catch(e){}
if(!SRC){var sc=document.querySelectorAll('script[src*="mdv-cursor.js"]');if(sc.length)SRC=sc[sc.length-1].src;}
var CSS=SRC?SRC.replace(/mdv-cursor\.js/,'mdv-cursor.css'):'',wired=[];
function skin(d){
  try{
    var r=d.documentElement,w=root.getAttribute('data-veux-wave');
    if(w!==null&&r.getAttribute('data-veux-wave')!==w)r.setAttribute('data-veux-wave',w);
    var v=getComputedStyle(root).getPropertyValue('--wave').trim();
    if(v&&r.style.getPropertyValue('--wave')!==v)r.style.setProperty('--wave',v);
  }catch(e){}
}
function wire(fr){
  if(!SRC)return;
  try{
    var d=fr.contentDocument;if(!d||!d.documentElement||!d.head&&!d.body)return;
    var h=''+(fr.contentWindow&&fr.contentWindow.location.href);if(h==='about:blank'||h==='')return;
    if(!d.getElementById('mdv-cursor-css')){
      var l=d.createElement('link');l.id='mdv-cursor-css';l.rel='stylesheet';l.href=CSS;(d.head||d.documentElement).appendChild(l);
    }
    if(!d.getElementById('mdv-cursor-js')){
      var j=d.createElement('script');j.id='mdv-cursor-js';j.src=SRC;(d.body||d.documentElement).appendChild(j);
    }
    skin(d);if(wired.indexOf(fr)<0)wired.push(fr);
  }catch(e){}   /* a frame from another site is left alone */
}
function scan(){
  var f=document.querySelectorAll('iframe');
  for(var i=0;i<f.length;i++){(function(fr){
    if(!fr.__mdvCur){fr.__mdvCur=1;fr.addEventListener('load',function(){wire(fr);});}
    try{var d=fr.contentDocument;if(d&&d.readyState!=='loading'&&!d.getElementById('mdv-cursor-js'))wire(fr);}catch(e){}
  })(f[i]);}
}
setInterval(function(){
  scan();
  for(var i=wired.length-1;i>=0;i--){var fr=wired[i];if(!fr.isConnected){wired.splice(i,1);continue;}try{skin(fr.contentDocument);}catch(e){}}
},1000);
try{new MutationObserver(scan).observe(document.documentElement,{childList:true,subtree:true});}catch(e){}
scan();
})();
