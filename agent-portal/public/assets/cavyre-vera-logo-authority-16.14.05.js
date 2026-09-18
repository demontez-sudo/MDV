(function(){
'use strict';
if(window.__CAVYRE_VERA_LOGO_AUTHORITY_161405__)return;
window.__CAVYRE_VERA_LOGO_AUTHORITY_161405__=true;
var SVG='<svg viewBox="0 0 64 64" aria-hidden="true" focusable="false"><circle cx="32" cy="32" r="29" fill="#0b0a0f" stroke="currentColor" stroke-width="1.6"/><path d="M32 13c1.8 10.2 6.8 15.2 17 17-10.2 1.8-15.2 6.8-17 17-1.8-10.2-6.8-15.2-17-17 10.2-1.8 15.2-6.8 17-17Z" fill="currentColor"/><circle cx="32" cy="30" r="2.5" fill="#f4dfb8"/></svg>';
function mark(cls){var s=document.createElement('span');s.className='cvy-vera-logo-161405'+(cls?' '+cls:'');s.innerHTML=SVG;return s;}
function set(el,cls){if(!el)return;if(el.querySelector(':scope > .cvy-vera-logo-161405'))return;el.querySelectorAll(':scope > img,:scope > .vera-mark,:scope > .vera-mark-img,:scope > .vera-avatar-img,:scope > .vx20-vera-wave-mark,:scope > i').forEach(function(n){n.remove();});el.insertBefore(mark(cls),el.firstChild);}
function apply(){
 document.querySelectorAll('.vx17-vera-orb').forEach(function(el){set(el,'hero');});
 var launch=document.getElementById('_asst-btn');if(launch)set(launch,'launcher');
 document.querySelectorAll('.ss48-vera-title').forEach(function(el){set(el,'panel');});
 document.querySelectorAll('.vx95-intelligence > header').forEach(function(el){set(el,'small');});
 document.querySelectorAll('.vera-panel-identity').forEach(function(el){set(el,'avatar');});
}
function start(){apply();var queued=false;new MutationObserver(function(){if(queued)return;queued=true;requestAnimationFrame(function(){queued=false;apply();});}).observe(document.body,{childList:true,subtree:true});window.addEventListener('veux:smart-wave-applied',apply);window.addEventListener('cavyre:season-rendered',apply);setInterval(apply,1500);}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
window.CAVYRE_VERA_LOGO={version:'16.14.05',refresh:apply};
})();
