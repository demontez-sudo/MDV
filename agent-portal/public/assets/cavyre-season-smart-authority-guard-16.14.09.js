/* CAVYRE 16.14.09 — Direct Season Authority Guard */
(function(){'use strict';
if(window.__CAVYRE_SEASON_GUARD_161409__)return;window.__CAVYRE_SEASON_GUARD_161409__=1;
function repair(){var A=window.CAVYRE_SMART_SEASON_161409;if(!A||typeof A.takeover!=='function')return;var p=String(window._currentPage||location.hash.replace(/^#/,'')||'').toLowerCase(),h=document.getElementById('p-seasonmanagement')||document.getElementById('p-season'),v=!!(h&&(h.classList.contains('on')||h.offsetParent!==null));if(p!=='season'&&p!=='seasonmanagement'&&!v)return;A.takeover();var h=document.getElementById('p-seasonmanagement')||document.getElementById('p-season');if(h){var r=h.querySelector('.ss48[data-season-release="16.14.09"]');if(r&&!r.querySelector('.cvy1402-vera-mark')){A.render(h);}}}
[0,100,500,1500].forEach(function(ms){setTimeout(repair,ms)});['veux:shell-ready','veux:assets-ready','veux:page-rendered'].forEach(function(ev){window.addEventListener(ev,repair)});document.addEventListener('click',function(e){if(e.target&&e.target.closest&&e.target.closest('[data-p="season"],[data-p="seasonmanagement"]'))setTimeout(repair,20)},true);
})();
