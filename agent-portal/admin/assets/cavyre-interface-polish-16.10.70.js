(function(){
'use strict';if(window.__CAVYRE_POLISH_161070__)return;window.__CAVYRE_POLISH_161070__=true;
function viewport(){
 var h=(window.visualViewport&&window.visualViewport.height)||window.innerHeight;
 document.documentElement.style.setProperty('--cv-vh',h+'px');
}
viewport();
window.addEventListener('resize',viewport,{passive:true});
if(window.visualViewport)window.visualViewport.addEventListener('resize',viewport,{passive:true});
var touch=('ontouchstart'in window)||navigator.maxTouchPoints>0;
document.documentElement.classList.toggle('cavyre-touch',touch);
document.documentElement.classList.toggle('cavyre-pointer',!touch);
document.addEventListener('keydown',function(e){if(e.key==='Tab')document.documentElement.classList.add('cavyre-keyboard')},true);
document.addEventListener('pointerdown',function(){document.documentElement.classList.remove('cavyre-keyboard')},true);
})();