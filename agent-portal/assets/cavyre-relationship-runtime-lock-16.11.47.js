(function(){
'use strict';
if(window.__CAVYRE_RELATIONSHIP_RUNTIME_LOCK_161147__)return;
window.__CAVYRE_RELATIONSHIP_RUNTIME_LOCK_161147__=true;
var VERSION='16.11.47', currentRenderer=null, retry=0;
function panel(){return document.getElementById('p-industrydirectory');}
function active(){var p=panel();return window._currentPage==='industrydirectory'||!!(p&&p.classList.contains('on'));}
function setRelease(){
 document.documentElement.setAttribute('data-cavyre-release',VERSION);
 var m=document.querySelector('meta[name="cavyre-release"]'); if(m)m.content=VERSION+'-relationship-runtime-lock';
 var b=document.getElementById('cavyre-release-badge-161075');
 if(b)b.textContent='AGENT '+VERSION;
}
function renderRelationships(el){
 el=el||panel(); if(!el)return Promise.resolve();
 if(window.CavyreRelationships&&typeof window.CavyreRelationships.refresh==='function'){
   return window.CavyreRelationships.refresh().then(function(){setRelease();});
 }
 if(retry++<30){
   if(!el.querySelector('.vxrel')) el.innerHTML='<div style="padding:34px 28px;color:var(--mute);font:9px var(--fM);letter-spacing:.12em">CAVYRE · Loading Relationships…</div>';
   return new Promise(function(resolve){setTimeout(function(){resolve(renderRelationships(el));},100);});
 }
 el.innerHTML='<div class="vxrel-empty">Relationships could not initialize. Reload once; if this persists, the secure CAVYRE bridge is not ready.</div>';
 return Promise.resolve();
}
currentRenderer=renderRelationships;
try{
 Object.defineProperty(window,'renderIndustryDirectory',{
   configurable:false,
   enumerable:true,
   get:function(){return currentRenderer;},
   set:function(fn){
     // Deliberately ignore legacy Client Intelligence renderers loaded after this release.
     if(fn===renderRelationships) currentRenderer=fn;
   }
 });
}catch(e){window.renderIndustryDirectory=renderRelationships;}
function scrubLegacy(){
 if(!active())return;
 var el=panel(); if(!el)return;
 var t=el.textContent||'';
 if(el.querySelector('.vxdir-page')||/Loading Client Intelligence|Building Client Intelligence|Contact Dossier/i.test(t))renderRelationships(el);
}
function boot(){setRelease(); if(active())renderRelationships(panel()); scrubLegacy();}
window.addEventListener('veux:page-rendered',function(e){var p=e&&e.detail&&e.detail.page||window._currentPage;if(p==='industrydirectory')setTimeout(boot,0);});
window.addEventListener('load',function(){setTimeout(boot,0);setTimeout(boot,500);});
setInterval(function(){setRelease();scrubLegacy();},750);
setTimeout(boot,0);setTimeout(boot,300);setTimeout(boot,1200);
})();
