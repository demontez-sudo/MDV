(function(){
'use strict';
if(window.__CAVYRE_QUEUE_RUNTIME_161099__)return;
window.__CAVYRE_QUEUE_RUNTIME_161099__=true;
function imp(el,p,v){if(el)el.style.setProperty(p,v,'important')}
function all(root,sel,fn){Array.from(root.querySelectorAll(sel)).forEach(fn)}
function fix(){
 all(document,'.vx161086-command-queue',function(q){
  imp(q,'display','block');imp(q,'width','100%');imp(q,'max-width','100%');imp(q,'margin','16px 0 20px');
  imp(q,'border','1px solid rgba(255,255,255,.14)');imp(q,'overflow','hidden');
  imp(q,'background','linear-gradient(150deg,rgba(255,255,255,.035),rgba(255,255,255,.012) 48%,rgba(0,0,0,.12))');
  var h=q.querySelector(':scope > header');
  if(h){imp(h,'display','grid');imp(h,'grid-template-columns','minmax(0,1fr) minmax(390px,440px)');
    imp(h,'gap','24px');imp(h,'align-items','end');imp(h,'padding','18px 20px 16px');
    imp(h,'border-bottom','1px solid rgba(255,255,255,.10)')}
  var counts=q.querySelector('.vx161086-queue-counts');
  if(counts){imp(counts,'display','grid');imp(counts,'grid-template-columns','repeat(5,minmax(0,1fr))');
    imp(counts,'gap','8px');imp(counts,'min-width','0');imp(counts,'width','100%')}
  all(q,'.vx161086-queue-counts > span',function(s){
    imp(s,'display','flex');imp(s,'flex-direction','column');imp(s,'justify-content','center');
    imp(s,'align-items','flex-start');imp(s,'gap','3px');imp(s,'min-width','0');imp(s,'min-height','52px');
    imp(s,'padding','9px 10px');imp(s,'border','1px solid rgba(255,255,255,.12)');
    imp(s,'background','rgba(255,255,255,.03)');imp(s,'text-align','left')
  });
  all(q,'.vx161086-queue-counts b',function(x){imp(x,'display','block');imp(x,'font-size','17px');imp(x,'line-height','1')});
  all(q,'.vx161086-queue-counts small',function(x){imp(x,'display','block');imp(x,'font-size','7px');imp(x,'line-height','1.25');imp(x,'white-space','normal')});
  var list=q.querySelector('.vx161086-queue-list');
  if(list){imp(list,'display','grid');imp(list,'grid-template-columns','repeat(3,minmax(0,1fr))');
    imp(list,'gap','12px');imp(list,'padding','14px');imp(list,'align-items','stretch')}
  all(q,'.vx161086-queue-item',function(c){
    imp(c,'display','grid');imp(c,'grid-template-columns','28px minmax(0,1fr)');imp(c,'grid-template-rows','1fr auto');
    imp(c,'column-gap','12px');imp(c,'row-gap','10px');imp(c,'width','auto');imp(c,'min-width','0');
    imp(c,'min-height','132px');imp(c,'padding','15px 16px');imp(c,'border','1px solid rgba(255,255,255,.11)');
    imp(c,'background','linear-gradient(145deg,rgba(255,255,255,.045),rgba(255,255,255,.012))');
    imp(c,'overflow','hidden');imp(c,'text-align','left');imp(c,'align-items','start');
    var n=c.querySelector(':scope > em');if(n){imp(n,'grid-column','1');imp(n,'grid-row','1');
      imp(n,'display','flex');imp(n,'width','26px');imp(n,'height','26px');imp(n,'align-items','center');imp(n,'justify-content','center');
      imp(n,'border','1px solid rgba(255,255,255,.12)')}
    var d=c.querySelector(':scope > div');if(d){imp(d,'grid-column','2');imp(d,'grid-row','1');imp(d,'min-width','0');imp(d,'overflow','hidden')}
    var sm=d&&d.querySelector('small');if(sm){imp(sm,'display','block');imp(sm,'margin','0 0 7px');imp(sm,'font-size','7px');imp(sm,'line-height','1.35');imp(sm,'white-space','normal')}
    var b=d&&d.querySelector('b');if(b){imp(b,'display','block');imp(b,'font-size','11.5px');imp(b,'line-height','1.38');imp(b,'white-space','normal');imp(b,'overflow-wrap','anywhere')}
    var sp=d&&d.querySelector('span');if(sp){imp(sp,'display','block');imp(sp,'margin-top','6px');imp(sp,'font-size','9px');imp(sp,'line-height','1.45');imp(sp,'white-space','normal');imp(sp,'overflow-wrap','anywhere')}
    var open=c.querySelector(':scope > i');if(open){imp(open,'grid-column','2');imp(open,'grid-row','2');imp(open,'justify-self','start');imp(open,'font-size','8px');imp(open,'font-style','normal')}
  });
  function responsive(){
   var w=window.innerWidth;
   if(h){imp(h,'grid-template-columns',w<=900?'1fr':'minmax(0,1fr) minmax(390px,440px)')}
   if(counts){imp(counts,'grid-template-columns',w<=520?'repeat(2,minmax(0,1fr))':'repeat(5,minmax(0,1fr)')}
   if(list){imp(list,'grid-template-columns',w<=680?'1fr':w<=1100?'repeat(2,minmax(0,1fr))':'repeat(3,minmax(0,1fr))')}
  }
  responsive();
 });
 
 
}
var queued=false;function schedule(){if(queued)return;queued=true;requestAnimationFrame(function(){queued=false;fix()})}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule,{once:true});else schedule();
new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true});
window.addEventListener('resize',schedule,{passive:true});
window.addEventListener('veux:shell-ready',schedule);
window.addEventListener('cavyre:vera-signals',schedule);
})();