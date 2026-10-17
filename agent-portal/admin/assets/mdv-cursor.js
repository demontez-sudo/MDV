/* Maison de Veux cursor. Marks what the pointer is over so mdv-cursor.css can give it the brand arrow or ring.
   Mouse devices only. Nothing is moved or rebuilt; it only adds a data attribute to what you hover. */
(function(){
'use strict';
if(window.__MDV_CURSOR__)return;window.__MDV_CURSOR__=true;
try{if(!window.matchMedia||!matchMedia('(hover:hover) and (pointer:fine)').matches)return;}catch(e){return;}
var root=document.documentElement,seen=typeof WeakMap==='function'?new WeakMap():null;
root.classList.add('mdv-cur');
/* the first time an element is hovered, remember what the page itself wanted for it (clickable / plain) before we restyle it */
function kind(el){
  if(!el||el.nodeType!==1)return 'x';
  var k=seen&&seen.get(el);if(k)return k;
  var c='';try{c=getComputedStyle(el).cursor;}catch(e){}
  k=c==='pointer'?'pt':c==='default'?'ar':'x';
  if(seen)seen.set(el,k);
  if(k!=='x')el.setAttribute('data-mdv-cur',k);
  return k;
}
document.addEventListener('mouseover',function(e){kind(e.target);},true);
})();
