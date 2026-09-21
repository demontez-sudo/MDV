/* CAVYRE 16.11.95 — Model / Package / Submission Action Authority */
(function(){
'use strict';
if(window.__CAVYRE_MODEL_PACKAGE_ACTION_AUTHORITY_161195__)return;
window.__CAVYRE_MODEL_PACKAGE_ACTION_AUTHORITY_161195__=1;

function closest(t,s){try{return t&&t.closest?t.closest(s):null}catch(e){return null}}
function label(el){return String(el&&el.textContent||'').replace(/\s+/g,' ').trim().toLowerCase()}
function idFrom(el){
 if(!el)return '';
 return el.getAttribute('data-id')||el.getAttribute('data-model-id')||el.getAttribute('data-package-id')||el.getAttribute('data-record-id')||'';
}
function call(fn,args){try{if(typeof fn==='function'){fn.apply(null,args||[]);return true}}catch(e){console.warn('[CAVYRE 16.11.95]',e)}return false}
function go(page){try{if(typeof window.navTo==='function'){window.navTo(page);return true}}catch(e){}return false}
function pkg(){return window.VEUX_V7||null}

function createPackage(){var p=pkg();return !!(p&&call(p.openCreatePackage,[]))}
function openPackage(id){var p=pkg();return !!(p&&id&&call(p.openPackage,[id]))}
function editPackage(id){var p=pkg();return !!(p&&id&&call(p.editPackage,[id]))}
function publishComp(){return !!(window.CAVYRE_EXCHANGE&&call(window.CAVYRE_EXCHANGE.openCompPublisher,[]))}
function newCampaign(){return !!(window.CAVYRE_MODEL_CAMPAIGNS&&call(window.CAVYRE_MODEL_CAMPAIGNS.newCampaign,[]))}
function openModel(id){
 if(!id)return false;
 window._veuxV10ModelId=id;window._openModelId=id;
 try{if(window.VEUX_PERF&&VEUX_PERF.invalidate)VEUX_PERF.invalidate('modelpage')}catch(e){}
 return go('modelpage');
}
function packageId(el){
 var id=idFrom(el);if(id)return id;
 var root=closest(el,'[data-package-id],[data-id],tr,article,.card,.package-row,.v7-package');
 return idFrom(root);
}

document.addEventListener('click',function(e){
 var b=closest(e.target,'button,a,[role="button"]');if(!b)return;var oc=b.getAttribute&&b.getAttribute('onclick')||'';if(/VEUX_V155\.(packageForm|selectPackage|sendPackage)/.test(oc))return;
 var t=label(b),id;

 if(/^\+?\s*(new|create)\s+(model\s+)?package$/.test(t)||/^create package$/.test(t)){
   if(createPackage())e.preventDefault();return;
 }

 if(/^(open|view) package$/.test(t)){
   id=packageId(b);if(id&&openPackage(id)){e.preventDefault();return}
 }

 if(/^edit (draft )?package$/.test(t)||/^edit draft$/.test(t)||/^edit & send/.test(t)){
   id=packageId(b);if(id&&editPackage(id)){e.preventDefault();return}
 }

 if(/^publish comp card$/.test(t)){
   if(publishComp()){e.preventDefault();return}
 }

 if(/^\+?\s*new campaign$/.test(t)){
   if(newCampaign()){e.preventDefault();return}
 }

 if(/^(open|view) (model|profile)$/.test(t)){
   id=idFrom(b)||idFrom(closest(b,'[data-model-id],[data-id]'));
   if(id&&openModel(id)){e.preventDefault();return}
 }

 if(/^open package library$/.test(t)||/^review$/.test(t)||/^convert/.test(t)){
   if(go('multipackage')){e.preventDefault();return}
 }
},false);

window.CAVYRE_MODEL_PACKAGE_ACTIONS={
 release:'16.11.95',
 createPackage:createPackage,openPackage:openPackage,editPackage:editPackage,
 publishComp:publishComp,newCampaign:newCampaign,openModel:openModel
};
document.documentElement.setAttribute('data-cavyre-model-package-actions','16.11.95');
})();