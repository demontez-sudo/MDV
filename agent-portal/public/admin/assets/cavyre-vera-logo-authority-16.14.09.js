(function(){
'use strict';
if(window.__CAVYRE_VERA_IDENTITY_AUTHORITY_161409__)return;window.__CAVYRE_VERA_IDENTITY_AUTHORITY_161409__=true;
var SVG='<svg class="cvy-vera-native" viewBox="0 0 96 96" aria-hidden="true" focusable="false"><circle cx="48" cy="48" r="46" fill="#09080d" stroke="#9b7548" stroke-width="2"/><path d="M48 20c2.5 14.5 9.5 21.5 24 24-14.5 2.5-21.5 9.5-24 24-2.5-14.5-9.5-21.5-24-24 14.5-2.5 21.5-9.5 24-24Z" fill="#d3a85f"/><circle cx="48" cy="44" r="3.5" fill="#f4dfb8"/></svg>';
function own(el){if(!el)return;el.setAttribute('data-vera-identity-authority','16.14.09');el.querySelectorAll('.vx20-vera-wave-mark,.vera-mark-img,.vera-avatar-img,.cvy-vera-canonical').forEach(function(n){n.remove();});if(!el.querySelector(':scope > .cvy-vera-native'))el.insertAdjacentHTML('afterbegin',SVG);}
function install(){document.querySelectorAll('.vx17-vera-orb').forEach(own);own(document.getElementById('_asst-btn'));}
function start(){install();['veux:route-ready','veux:shell-ready','cavyre:season-rendered','cavyre:calendar-rendered'].forEach(function(e){document.addEventListener(e,install);window.addEventListener(e,install);});}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
window.CAVYRE_VERA_IDENTITY={version:'16.14.09',refresh:install};
})();
