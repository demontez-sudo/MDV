(function(){
'use strict';
if(window.__CAVYRE_INTEL_DRAWER_161124__)return;
window.__CAVYRE_INTEL_DRAWER_161124__=1;

var state={open:false,current:null};

function I(e,p,v){if(e)e.style.setProperty(p,v,'important')}
function text(e){return String(e&&e.textContent||'').trim()}
function ensureDrawer(){
 var d=document.getElementById('vx161124-intel-drawer');
 if(d)return d;
 d=document.createElement('section');
 d.id='vx161124-intel-drawer';
 d.className='vx161124-intel-drawer';
 d.setAttribute('aria-label','Model Intelligence drawer');
 d.innerHTML=
   '<button type="button" class="vx161124-intel-bar" aria-expanded="false">'+
     '<span class="vx161124-intel-brand"><i>✦</i><span><small>VERA · MODEL INTELLIGENCE</small><b>Calendar Intelligence</b></span></span>'+
     '<span class="vx161124-intel-date">Current calendar view</span>'+
     '<span class="vx161124-intel-stats">'+
       '<span><b data-kpi="movements">0</b><small>Movements</small></span>'+
       '<span><b data-kpi="events">0</b><small>Events</small></span>'+
       '<span><b data-kpi="risks">0</b><small>Risks</small></span>'+
     '</span>'+
     '<span class="vx161124-intel-toggle"><b>OPEN</b><i>↑</i></span>'+
   '</button>'+
   '<div class="vx161124-intel-panel">'+
     '<div class="vx161124-intel-panel-head">'+
       '<div><small>VERA INTELLIGENCE · LIVE CALENDAR CONTEXT</small><b class="vx161124-panel-title">Calendar Intelligence</b></div>'+
       '<button type="button" class="vx161124-close">COLLAPSE ↓</button>'+
     '</div>'+
     '<div class="vx161124-intel-content"></div>'+
   '</div>';
 document.body.appendChild(d);
 d.querySelector('.vx161124-intel-bar').addEventListener('click',function(){toggle(!state.open)});
 d.querySelector('.vx161124-close').addEventListener('click',function(e){e.stopPropagation();toggle(false)});
 return d;
}
function toggle(open){
 state.open=!!open;
 var d=ensureDrawer();
 d.classList.toggle('open',state.open);
 d.querySelector('.vx161124-intel-bar').setAttribute('aria-expanded',state.open?'true':'false');
 var t=d.querySelector('.vx161124-intel-toggle');
 t.querySelector('b').textContent=state.open?'CLOSE':'OPEN';
 t.querySelector('i').textContent=state.open?'↓':'↑';
}
function candidate(){
 var root=document.getElementById('p-calendar');
 if(!root)return null;
 var list=[
   '.vx85-day-intel',
   '.vx131-day-intel',
   '.vx95-intelligence',
   '.vx89-flow-intel',
   '.vx89-event-intel',
   '.vx75-month-intel',
   '.vx75-intel'
 ];
 for(var i=0;i<list.length;i++){
   var nodes=root.querySelectorAll(list[i]);
   for(var j=0;j<nodes.length;j++){
     if(!nodes[j].closest('#vx161124-intel-drawer'))return nodes[j];
   }
 }
 return null;
}
function parseStats(node){
 var out={movements:0,events:0,risks:0};
 var stats=node.querySelector('.vx85-day-stats');
 if(stats){
   var spans=stats.querySelectorAll(':scope>span');
   if(spans[0])out.movements=parseInt(text(spans[0].querySelector('b')),10)||0;
   if(spans[1])out.events=parseInt(text(spans[1].querySelector('b')),10)||0;
   if(spans[2])out.risks=parseInt(text(spans[2].querySelector('b')),10)||0;
   return out;
 }
 var kpis=node.querySelectorAll('.vx131-day-kpis>div');
 if(kpis.length){
   out.events=parseInt(text(kpis[0]&&kpis[0].querySelector('b')),10)||0;
   out.risks=parseInt(text(kpis[1]&&kpis[1].querySelector('b')),10)||0;
   return out;
 }
 var all=text(node).toLowerCase();
 var m=all.match(/(\d+)\s+travel movements?/); if(m)out.movements=+m[1];
 m=all.match(/(\d+)\s+(?:total )?events?/); if(m)out.events=+m[1];
 m=all.match(/(\d+)\s+(?:conflicts?|risks?)/); if(m)out.risks=+m[1];
 if(!out.events){
   out.events=node.querySelectorAll('.vx85-intel-card,.vx131-schedule-item,.vx75-event,.vx95-awaiting button').length;
 }
 return out;
}
function titleFor(node){
 var h=node.querySelector('h2,h3');
 var val=text(h);
 if(val && !/model intelligence|vera intelligence|high priority/i.test(val))return val;
 var cal=document.getElementById('p-calendar');
 var active=cal&&cal.querySelector('.vx75-tabs button.on');
 return active?text(active)+' Calendar':'Calendar Intelligence';
}
function compactEmptySections(node){
 node.querySelectorAll('section').forEach(function(s){
   var p=s.querySelector(':scope>p');
   var cards=s.querySelectorAll('button,.vx85-intel-card,.vx131-schedule-item,li');
   var empty=p&&cards.length===0&&/no |none|clear|current/i.test(text(p));
   s.classList.toggle('vx161124-empty-section',!!empty);
 });
}
function normalizeNode(node){
 node.classList.add('vx161124-intel-source');
 I(node,'position','relative');I(node,'inset','auto');I(node,'width','100%');I(node,'min-width','0');
 I(node,'max-width','none');I(node,'height','auto');I(node,'max-height','none');I(node,'overflow','visible');
 compactEmptySections(node);
}
function restoreCalendarSpace(node){
 var cal=document.getElementById('p-calendar');
 if(!cal)return;
 // Month: intelligence has left the document flow, calendar gets only controls + matrix.
 cal.querySelectorAll('.vx161123-month-layout,.vx161119-month,.vx85-season').forEach(function(root){
   if(root.contains(node)){
     // node will move momentarily; preemptively collapse the third layout row.
     I(root,'grid-template-columns','minmax(0,1fr)');
     I(root,'grid-template-rows','auto auto');
   } else if(root.querySelector('.vx85-matrix')) {
     I(root,'grid-template-columns','minmax(0,1fr)');
     I(root,'grid-template-rows','auto auto');
   }
 });
 // Week: once intelligence is in drawer, board uses full width.
 cal.querySelectorAll('.vx89-flow-dashboard').forEach(function(root){
   I(root,'grid-template-columns','minmax(0,1fr)');
   var ov=root.querySelector(':scope>.vx89-flow-overview');
   if(ov)I(ov,'grid-column','1');
   var board=root.querySelector(':scope>.vx89-flow-board');
   if(board){I(board,'grid-column','1');I(board,'width','100%')}
 });
 // 3 Day: timeline uses full shell width.
 cal.querySelectorAll('.vx95-runway-shell').forEach(function(root){
   I(root,'grid-template-columns','minmax(0,1fr)');
   var main=root.querySelector('.vx95-calendar-main');
   if(main){I(main,'width','100%');I(main,'min-width','0')}
 });
 // Orbit: main gets full width.
 cal.querySelectorAll('.vx75-orbit').forEach(function(root){
   I(root,'grid-template-columns','minmax(0,1fr)');
   var main=root.querySelector(':scope>main');
   if(main){I(main,'width','100%');I(main,'min-width','0')}
 });
}
function mount(){
 var node=candidate();
 var d=ensureDrawer();
 var content=d.querySelector('.vx161124-intel-content');
 if(node && node!==state.current){
   restoreCalendarSpace(node);
   normalizeNode(node);
   content.replaceChildren(node);
   state.current=node;
 }
 if(!state.current || !document.body.contains(state.current)){
   state.current=null;
   return;
 }
 normalizeNode(state.current);
 var stats=parseStats(state.current), title=titleFor(state.current);
 d.querySelector('[data-kpi="movements"]').textContent=stats.movements;
 d.querySelector('[data-kpi="events"]').textContent=stats.events;
 d.querySelector('[data-kpi="risks"]').textContent=stats.risks;
 d.querySelector('.vx161124-intel-date').textContent=title;
 d.querySelector('.vx161124-panel-title').textContent=title;

 // Keep drawer aligned to calendar workspace, not over the left nav.
 var cal=document.getElementById('p-calendar');
 if(cal){
   var r=cal.getBoundingClientRect();
   d.style.setProperty('--vx-drawer-left',Math.max(0,Math.round(r.left))+'px');
 }
 
 
}
var q=0;
function schedule(){if(q)return;q=1;requestAnimationFrame(function(){q=0;mount()})}
document.readyState==='loading'?document.addEventListener('DOMContentLoaded',schedule,{once:true}):schedule();
new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true});
window.addEventListener('resize',schedule,{passive:true});
window.addEventListener('veux:shell-ready',schedule);
})();