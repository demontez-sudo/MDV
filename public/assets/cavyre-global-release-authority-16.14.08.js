(function(){
'use strict';
var V='16.14.08';
function stamp(){document.documentElement.setAttribute('data-cavyre-release',V);document.documentElement.setAttribute('data-cavyre-release-authority',V);var b=document.getElementById('cavyre-release-badge-current');if(b)b.textContent='AGENT '+V;}
function boot(){stamp();new MutationObserver(function(){var b=document.getElementById('cavyre-release-badge-current');if((b&&b.textContent!=='AGENT '+V)||document.documentElement.getAttribute('data-cavyre-release')!==V)stamp();}).observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['data-cavyre-release']});['veux:shell-ready','veux:assets-ready','veux:page-rendered','pageshow'].forEach(function(ev){window.addEventListener(ev,stamp);});}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();window.CAVYRE_RELEASE_AUTHORITY={version:V,stamp:stamp};
})();
