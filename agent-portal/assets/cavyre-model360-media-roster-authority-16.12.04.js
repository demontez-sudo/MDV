/* CAVYRE 16.12.04 — Model 360 / Media / Roster Action Authority */
(function(){
'use strict';
if(window.__CAVYRE_MODEL360_ACTIONS_161204__)return;
window.__CAVYRE_MODEL360_ACTIONS_161204__=1;
function t(el){return String(el&&el.textContent||'').replace(/\s+/g,' ').trim().toLowerCase()}
document.addEventListener('click',function(e){
 var b=e.target&&e.target.closest&&e.target.closest('button,a,[role="button"]');if(!b)return;
 var x=t(b);
 if(x==='edit profile'&&window.VEUX_V156&&typeof VEUX_V156.editProfile==='function'){e.preventDefault();VEUX_V156.editProfile();return}
 if((x==='media'||x==='manage media'||x==='manage website + photos')&&window.VEUX_V156&&typeof VEUX_V156.mediaManager==='function'){e.preventDefault();VEUX_V156.mediaManager();return}
 if(x==='add to package'&&typeof window.navTo==='function'){e.preventDefault();navTo('multipackage');return}
 if((x==='new model'||x==='+ new model'||x==='add model')&&window.VEUX_V10&&typeof VEUX_V10.newModel==='function'){e.preventDefault();VEUX_V10.newModel();return}
},false);
window.CAVYRE_MODEL360_ACTIONS={release:'16.12.04'};
document.documentElement.setAttribute('data-cavyre-model360-actions','16.12.04');
})();