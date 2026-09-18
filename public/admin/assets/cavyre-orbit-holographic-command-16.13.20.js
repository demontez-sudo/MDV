(function(){
'use strict';
if(window.__CAVYRE_ORBIT_HOLOGRAPHIC_161320__)return;window.__CAVYRE_ORBIT_HOLOGRAPHIC_161320__=1;
function el(tag,cls){var n=document.createElement(tag);n.className=cls;return n;}
function decorate(main){
  if(!main||main.dataset.cvy1320==='1')return;
  main.dataset.cvy1320='1';
  var space=el('div','cvy1320-space');
  for(var i=0;i<58;i++){var s=document.createElement('i');s.style.setProperty('--x',((i*43+11)%99)+'%');s.style.setProperty('--y',((i*67+7)%92)+'%');s.style.setProperty('--s',(1+(i%3))+'px');s.style.setProperty('--o',(0.16+(i%5)*0.08).toFixed(2));s.style.setProperty('--d',(4+(i%7))+'s');space.appendChild(s);} main.prepend(space);
  main.appendChild(el('div','cvy1320-horizon'));
  var tag=el('div','cvy1320-command-tag');tag.innerHTML='CAVYRE SPATIAL CALENDAR<b>ORBIT · LIVE 3D COMMAND</b>';main.appendChild(tag);
  var dial=main.querySelector('.vx75-dial');if(dial){
    ['r1','r2','r3','r4'].forEach(function(c){dial.prepend(el('div','cvy1320-ring '+c));});dial.prepend(el('div','cvy1320-scan'));
    var nodes=[].slice.call(dial.querySelectorAll('.vx75-orbit-node'));nodes.forEach(function(n,idx){var top=parseFloat(n.style.top)||355;var depth=Math.max(50,Math.min(125,50+(650-top)*.12));n.style.setProperty('--nodeZ',depth+'px');n.style.setProperty('--stem',Math.max(38,Math.min(92,44+(idx%5)*10))+'px');});
  }
  if(!main.__cvy1320move){main.__cvy1320move=1;main.addEventListener('pointermove',function(e){var r=main.getBoundingClientRect();var x=((e.clientX-r.left)/Math.max(1,r.width)-.5);var y=((e.clientY-r.top)/Math.max(1,r.height)-.5);main.style.setProperty('--cvy20-pan-z',(x*5.5).toFixed(2)+'deg');main.style.setProperty('--cvy20-pan-x',(y*-4.5).toFixed(2)+'deg');},{passive:true});main.addEventListener('pointerleave',function(){main.style.setProperty('--cvy20-pan-z','0deg');main.style.setProperty('--cvy20-pan-x','0deg');},{passive:true});}
}
function install(){document.querySelectorAll('#p-calendar .vx75-orbit>main').forEach(decorate);}
var queued=false;function tick(){if(queued)return;queued=true;requestAnimationFrame(function(){queued=false;install();});}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',tick,{once:true});else tick();
new MutationObserver(function(m){for(var i=0;i<m.length;i++){if(m[i].addedNodes&&m[i].addedNodes.length){tick();break;}}}).observe(document.documentElement,{subtree:true,childList:true});
})();
