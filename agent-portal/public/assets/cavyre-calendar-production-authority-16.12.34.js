
/* CAVYRE 16.12.34 — Calendar Production Runtime */
(function(){
'use strict';
if(window.__CAVYRE_CALENDAR_PRODUCTION_161234__)return;
window.__CAVYRE_CALENDAR_PRODUCTION_161234__=1;

function imp(el,p,v){if(el)el.style.setProperty(p,v,'important');}

function ensureThreeDay(main){
  if(!main)return;
  var wrap=main.querySelector(':scope > .cvy-three-day-scroll');
  var timeline=wrap&&wrap.querySelector(':scope > .vx95-timeline');
  if(!timeline){
    timeline=main.querySelector(':scope > .vx95-timeline');
    if(!timeline)return;
    wrap=document.createElement('div');
    wrap.className='cvy-three-day-scroll';
    wrap.tabIndex=0;
    wrap.setAttribute('role','region');
    wrap.setAttribute('aria-label','Three day schedule. Scroll vertically to view later times.');
    main.insertBefore(wrap,timeline);
    wrap.appendChild(timeline);
  }

  imp(timeline,'display','block');
  imp(timeline,'position','relative');
  imp(timeline,'height','780px');
  imp(timeline,'min-height','780px');
  imp(timeline,'max-height','780px');
  imp(timeline,'overflow','visible');

  var hours=timeline.querySelector(':scope > .vx95-hours');
  if(hours){
    imp(hours,'height','780px');
    imp(hours,'min-height','780px');
    imp(hours,'max-height','780px');
  }

  timeline.querySelectorAll(':scope > .vx95-day-column').forEach(function(col){
    imp(col,'height','780px');
    imp(col,'min-height','780px');
    imp(col,'max-height','780px');
    imp(col,'overflow','visible');
  });

  timeline.querySelectorAll('.vx95-runway-event').forEach(function(ev){
    var h=ev.style.getPropertyValue('--vx-runway-height');
    var top=ev.style.getPropertyValue('--vx-runway-top');
    var left=ev.style.getPropertyValue('--vx-runway-left');
    var width=ev.style.getPropertyValue('--vx-runway-width');
    if(h){imp(ev,'height',h);imp(ev,'min-height',h);imp(ev,'max-height',h);}
    if(top)imp(ev,'top',top);
    if(left)imp(ev,'left',left);
    if(width)imp(ev,'width',width);
  });
}

function repair(){
  var panel=document.getElementById('p-calendar');
  if(!panel)return;
  panel.querySelectorAll('.vx95-calendar-main').forEach(ensureThreeDay);

  panel.querySelectorAll('.vx89-flow-columns').forEach(function(x){
    x.style.removeProperty('height');
    x.style.removeProperty('max-height');
  });
  panel.querySelectorAll('.vx75-weekrow,.vx85-weekrow').forEach(function(x){
    x.style.removeProperty('height');
    x.style.removeProperty('max-height');
  });
}

var queued=false;
function queue(){
  if(queued)return;
  queued=true;
  requestAnimationFrame(function(){queued=false;repair();});
}
new MutationObserver(queue).observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['class','style']});
document.addEventListener('click',function(){setTimeout(repair,25)},true);
window.addEventListener('resize',queue,{passive:true});
window.addEventListener('veux:shell-ready',function(){setTimeout(repair,60)});
setTimeout(repair,120);setTimeout(repair,650);setTimeout(repair,1600);

window.CAVYRE_CALENDAR_PRODUCTION={
  release:'16.12.34',
  repair:repair,
  contract:{
    day:'responsive orbit + right-side intelligence',
    threeDay:'780px full canvas + native scroll + exact event duration',
    week:'7 equal columns + horizontal fallback',
    month:'7-column matrix + contained intelligence'
  }
};
})();
