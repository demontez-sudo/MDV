(function(){
'use strict';if(window.__CAVYRE_MOBILE_161069__)return;window.__CAVYRE_MOBILE_161069__=true;
function mobile(){return window.matchMedia('(max-width:900px)').matches}
function apply(){document.documentElement.classList.toggle('cavyre-mobile',mobile());document.body&&document.body.classList.toggle('cavyre-mobile',mobile())}
apply();window.addEventListener('resize',apply,{passive:true});window.addEventListener('orientationchange',function(){setTimeout(apply,150)},{passive:true});

document.addEventListener('focusin',function(e){
 if(!mobile())return;
 var el=e.target;
 if(!el||!el.matches('input,select,textarea,[contenteditable="true"]'))return;
 setTimeout(function(){try{el.scrollIntoView({block:'center',inline:'nearest',behavior:'smooth'})}catch(_e){}},250);
},true);

document.addEventListener('click',function(e){
 if(!mobile())return;
 var nav=e.target&&e.target.closest&&e.target.closest('[data-page],[data-nav],.nav-item,.menu-item');
 if(nav){
   document.body.classList.remove('menu-open','sidebar-open','nav-open');
   document.documentElement.classList.remove('menu-open','sidebar-open','nav-open');
 }
},true);

/* Recover scrolling after a modal/drawer is removed by legacy code. */
new MutationObserver(function(){
 if(!mobile())return;
 clearTimeout(window.__cvMobScrollT);
 window.__cvMobScrollT=setTimeout(function(){
   var open=document.querySelector('[role="dialog"],.modal.open,.drawer.open,.sheet.open,[class*="modal"][style*="display: block"]');
   if(!open){
     document.documentElement.style.removeProperty('overflow');
     document.body.style.removeProperty('overflow');
   }
 },80);
}).observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['class','style']});
})();