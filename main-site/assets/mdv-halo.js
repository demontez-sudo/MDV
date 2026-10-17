/* Maison de Veux halo: a thin ring that trails the pointer. Over a link it widens; over an element marked data-cursor="View" it becomes a small label. */
(function(){
'use strict';
if(window.__MDV_HALO__)return;window.__MDV_HALO__=true;
try{if(!matchMedia('(hover:hover) and (pointer:fine)').matches||matchMedia('(prefers-reduced-motion:reduce)').matches)return;}catch(e){return;}
var el=document.createElement('div');el.className='mdv-halo';el.setAttribute('aria-hidden','true');el.innerHTML='<span data-label=""></span>';
var dot=el.firstChild,x=-200,y=-200,hx=x,hy=y,shown=false,label='';
function add(){document.body.appendChild(el);}
if(document.body)add();else document.addEventListener('DOMContentLoaded',add);
function state(t){
  var lab=t&&t.closest?t.closest('[data-cursor]'):null,link=!lab&&t&&t.closest?t.closest('a,button,[role="button"],summary,label'):null,txt=t&&t.closest?t.closest('input:not([type=checkbox]):not([type=radio]),textarea,[contenteditable="true"]'):null;
  var l=lab?lab.getAttribute('data-cursor'):'';
  if(l!==label){label=l;dot.setAttribute('data-label',l);}
  el.classList.toggle('label',!!lab);el.classList.toggle('link',!!link);el.classList.toggle('text',!!txt);
}
document.addEventListener('mousemove',function(e){
  x=e.clientX;y=e.clientY;
  if(!shown){shown=true;hx=x;hy=y;el.classList.add('on');}
},{passive:true});
document.addEventListener('mouseover',function(e){state(e.target);},true);
document.addEventListener('mousedown',function(){el.classList.add('down');},true);
document.addEventListener('mouseup',function(){el.classList.remove('down');},true);
document.documentElement.addEventListener('mouseleave',function(){shown=false;el.classList.remove('on');});
(function loop(){
  hx+=(x-hx)*.17;hy+=(y-hy)*.17;
  el.style.transform='translate3d('+hx.toFixed(1)+'px,'+hy.toFixed(1)+'px,0)';
  requestAnimationFrame(loop);
})();
})();
