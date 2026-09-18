
(function(){
'use strict';
if(window.__CAVYRE_CALENDAR_AUTHORITY_161178__)return;
window.__CAVYRE_CALENDAR_AUTHORITY_161178__=1;

function directDrawer(root){
  if(!root)return null;
  return Array.prototype.find.call(root.children||[],function(n){
    return n.classList&&n.classList.contains('vx161125-native-drawer');
  })||null;
}
function apply(){
  var cal=document.getElementById('p-calendar');
  if(!cal)return;
  document.documentElement.setAttribute('data-cavyre-calendar-authority','16.11.78');

  [
    '.vx75-orbit',
    '.vx95-runway-shell',
    '.vx89-flow-dashboard.vx161115-week-command',
    '.vx85-season.vx161123-month-layout'
  ].forEach(function(sel){
    cal.querySelectorAll(sel).forEach(function(root){
      var drawer=directDrawer(root);
      if(!drawer)return;
      drawer.classList.add('cvy-cal-intel-side');
      if(window.innerWidth>1180)drawer.classList.add('open');
    });
  });

  /* Industry Intelligence is a lower command board, never a calendar overlay.
     Keep it as the final direct child of the main calendar shell. */
  var calendarShell=cal.querySelector('.vx75-calendar');
  if(calendarShell){
    var industry=calendarShell.querySelector('.vx1044-agency-intel');
    if(industry){
      industry.classList.add('cvy-cal-industry-below');
      if(industry!==calendarShell.lastElementChild)calendarShell.appendChild(industry);
    }
  }

  /* Month: if an obsolete runtime physically pulled intelligence out of the drawer,
     put it back into the drawer content instead of allowing a bottom intelligence row. */
  cal.querySelectorAll('.vx85-season.vx161123-month-layout').forEach(function(root){
    var drawer=directDrawer(root);
    if(!drawer)return;
    var content=drawer.querySelector('.vx161125-native-content');
    if(!content)return;
    Array.from(root.children).forEach(function(ch){
      if(ch===drawer||ch.classList.contains('vx85-models')||ch.classList.contains('vx85-matrix'))return;
      if(ch.matches&&ch.matches('.vx85-day-intel,.vx98-month-event-intel,.vx89-event-intel')){
        content.replaceChildren(ch);
      }
    });
  });
}
var queued=false;
function schedule(){
  if(queued)return;
  queued=true;
  requestAnimationFrame(function(){queued=false;apply();});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule,{once:true});
else schedule();
window.addEventListener('veux:shell-ready',schedule);
window.addEventListener('veux:page-rendered',schedule);
window.addEventListener('resize',schedule,{passive:true});
var host=document.getElementById('p-calendar')||document.documentElement;
new MutationObserver(function(ms){
  if(ms.some(function(m){return m.addedNodes&&m.addedNodes.length;}))schedule();
}).observe(host,{childList:true,subtree:true});
})();
