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
el.innerHTML='<i class="mdv-cr-r" data-label=""></i><i class="mdv-cr-d"><svg class="mdv-cr-a" viewBox="0 0 16 22" aria-hidden="true"><path d="M1.5 1.5v16.2l4.1-3.9 2.8 6.4 3-1.3-2.8-6.2 5.6-.2z"/></svg></i>';
var ring=el.firstChild,dot=el.lastChild;
var x=-200,y=-200,rx=x,ry=y,dx=x,dy=y,started=false,label='',running=false,pending=null,queued=false;

/* Two cursors, chosen per backdrop (the colour wave that is on):
     arrow    a basic pointer on the mouse, with the backdrop's colour wave drifting a beat behind it
     circles  a bright dot on the mouse with the wave ring behind it
   The choice is kept on this device, one per backdrop; a backdrop with no choice yet uses the arrow. */
var STORE='mdv-cursor-styles',STYLES=['arrow','circles'],arrow=true;
function waveName(){return root.getAttribute('data-veux-wave')||'classic';}
function readMap(){try{return JSON.parse(localStorage.getItem(STORE)||'{}')||{};}catch(e){return {};}}
function styleFor(w){var s=readMap()[w];return STYLES.indexOf(s)>=0?s:'arrow';}
function applyStyle(){
  var s=styleFor(waveName());arrow=s==='arrow';
  if(root.getAttribute('data-mdv-cstyle')!==s)root.setAttribute('data-mdv-cstyle',s);
  syncPicker();
}
function setStyle(w,s){
  if(STYLES.indexOf(s)<0)return;
  var m=readMap();m[w]=s;try{localStorage.setItem(STORE,JSON.stringify(m));}catch(e){}
  applyStyle();
}
window.MDV_CURSOR={styles:STYLES.slice(),get:function(w){return styleFor(w||waveName());},set:function(w,s){setStyle(w||waveName(),s);}};
try{applyStyle();}catch(e){}

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
  var kr=reduce?1:.2,kd=(reduce||arrow)?1:.6;
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
try{new MutationObserver(applyStyle).observe(root,{attributes:true,attributeFilter:['data-veux-wave']});}catch(e){}
window.addEventListener('storage',function(e){if(e.key===STORE||e.key===null)applyStyle();});
document.addEventListener('mousemove',function(e){
  px=x;py=y;x=e.clientX;y=e.clientY;lastAt=Date.now();
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
/* Over a frame we cannot reach (an email body is sandboxed on purpose) the page gets no mouse events at all, so the circles would stay frozen
   at the spot where the pointer went in. A frame under the pointer is visible to the browser as :hover, so check for that and step aside. */
var px=-200,py=-200,lastAt=0;
function overFrame(){
  try{
    if(document.querySelector('iframe:hover'))return true;
    /* the last move before the pointer went in ended just short of the frame: look a little further along the way it was heading */
    if(px<0&&py<0)return false;
    var dx=x-px,dy=y-py,len=Math.sqrt(dx*dx+dy*dy);if(len<.5)return false;
    var ux=dx/len,uy=dy/len,max=Math.min(100,len+3);
    for(var s=2;s<=max;s+=3){var t=document.elementFromPoint(x+ux*s,y+uy*s);if(t&&t.tagName==='IFRAME')return true;}
  }catch(e){}
  return false;
}
setInterval(function(){if(started&&el.classList.contains('on')&&Date.now()-lastAt>140&&overFrame())el.classList.remove('on');},90);
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
    var z=parseFloat(getComputedStyle(document.body).zoom)||1,mz=String(Math.round(100/z)/100);
    if(r.style.getPropertyValue('--mz')!==mz)r.style.setProperty('--mz',mz);
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

/* The chooser sits in the Appearance card under the backdrop picker (top page only; frames just follow the saved choice). */
var PICK_ART={arrow:'<svg viewBox="0 0 48 30" aria-hidden="true"><circle cx="15" cy="12" r="10" class="r"/><circle cx="15" cy="12" r="6" class="r2"/><path class="a" d="M12 4v15l3.8-3.5 2.6 5.9 2.8-1.2-2.6-5.7 5-.2z"/></svg>',
             circles:'<svg viewBox="0 0 48 30" aria-hidden="true"><circle cx="15" cy="15" r="10" class="r"/><circle cx="15" cy="15" r="6" class="r2"/><circle cx="15" cy="15" r="2.6" class="d"/></svg>'};
var PICK_NAME={arrow:'Arrow + wave',circles:'Dot + ring'};
function themeName(w){try{var t=window.VEUX_COLOR_WAVES&&window.VEUX_COLOR_WAVES.themes&&window.VEUX_COLOR_WAVES.themes[w];return t&&t.name?t.name:'this backdrop';}catch(e){return 'this backdrop';}}
function pickerHTML(){
  var w=waveName(),cur=styleFor(w);
  return '<b>Cursor for '+themeName(w).replace(/[<>&]/g,'')+'</b><p>Pick the pointer for this backdrop. Each backdrop remembers its own.</p><div class="mdv-cp-row">'+
    STYLES.map(function(k){return '<button type="button" class="mdv-cp-opt'+(k===cur?' on':'')+'" data-mdv-cstyle-set="'+k+'" aria-pressed="'+(k===cur?'true':'false')+'">'+PICK_ART[k]+'<span>'+PICK_NAME[k]+'</span></button>';}).join('')+'</div>';
}
function syncPicker(){
  var n=document.getElementById('mdv-cursor-pick');if(!n)return;
  var h=pickerHTML();if(n.getAttribute('data-sig')!==waveName()+'|'+styleFor(waveName())){n.innerHTML=h;n.setAttribute('data-sig',waveName()+'|'+styleFor(waveName()));}
}
function installPicker(){
  if(window!==window.top)return;
  var card=document.getElementById('vx-wave-settings');
  if(!card||card.querySelector('#mdv-cursor-pick'))return;
  var n=document.createElement('div');n.id='mdv-cursor-pick';n.className='mdv-cp';n.setAttribute('data-sig','');
  card.appendChild(n);syncPicker();
}
document.addEventListener('click',function(e){
  var b=e.target.closest&&e.target.closest('[data-mdv-cstyle-set]');if(!b)return;
  e.preventDefault();setStyle(waveName(),b.getAttribute('data-mdv-cstyle-set'));
});
function scan(){
  try{installPicker();}catch(e){}
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
var scanT=0;try{new MutationObserver(function(){if(scanT)return;scanT=setTimeout(function(){scanT=0;scan();},400);}).observe(document.documentElement,{childList:true,subtree:true});}catch(e){}   /* this portal redraws constantly: look for new frames at most every 0.4s */
scan();
})();
