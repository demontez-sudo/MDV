/* CAVYRE 16.11.97 — Operations Control Authority */
(function(){
'use strict';
if(window.__CAVYRE_OPERATIONS_CONTROL_161197__)return;
window.__CAVYRE_OPERATIONS_CONTROL_161197__=1;
function c(t,s){try{return t&&t.closest?t.closest(s):null}catch(e){return null}}
function text(x){return String(x&&x.textContent||'').replace(/\s+/g,' ').trim().toLowerCase()}
function go(p){try{if(window.CAVYRE_INTERACTION_AUTHORITY&&CAVYRE_INTERACTION_AUTHORITY.navigate)return !!CAVYRE_INTERACTION_AUTHORITY.navigate(p);if(window.navTo){window.navTo(p);return true}}catch(e){}return false}
function mobility(){return window.VEUX_MOBILITY_1682||null}
function product(){return window.VEUX_V1686||null}
function call(o,n,a){try{if(o&&typeof o[n]==='function'){o[n].apply(o,a||[]);return true}}catch(e){console.warn('[CAVYRE 16.11.97]',e)}return false}

document.addEventListener('click',function(e){
 var b=c(e.target,'button,a,[role="button"]');if(!b)return;
 // 16.15.09: local in-page tab/segment controls (e.g. the Model 360 profile's
 // Overview/Development/Travel/Visa tabs) own their own click handling and must
 // not be hijacked into a full workspace navigation just because their label
 // text also matches a global routing phrase.
 if(c(b,'.v144-model-tabs,[data-cavyre-local-tabs],[role="tablist"]'))return;
 var t=text(b),m=mobility(),p=product();

 // Mobility creation/detail actions.
 if(/^\+?\s*(new|add|create)\s+visa( case)?$/.test(t)){if(call(m,'newVisa'))e.preventDefault();return}
 if(/^\+?\s*(new|add|create)\s+(travel|trip)$/.test(t)){if(call(m,'newTravel'))e.preventDefault();return}
 if(/^\+?\s*(new|add|create)\s+(housing|accommodation)$/.test(t)){if(call(m,'newHousing'))e.preventDefault();return}
 if(/^\+?\s*(new|add|create)\s+passport$/.test(t)){if(call(m,'newPassport'))e.preventDefault();return}
 if(/^\+?\s*(new|add|create)\s+(work authorization|work permit)$/.test(t)){if(call(m,'newWorkAuth'))e.preventDefault();return}

 // Scouting/development.
 if(/^\+?\s*new prospect$/.test(t)||/^(add|create) prospect$/.test(t)){if(call(p,'newProspect'))e.preventDefault();return}
 if(/^(build )?smart gameplan$/.test(t)){if(call(p,'smartGameplan',[null]))e.preventDefault();return}

 // Workspace routing.
 if(/^(open |view )?(inbox|communication|communications)$/.test(t)){if(go('inbox'))e.preventDefault();return}
 if(/^(open |view )?(travel|travel desk|mobility|travel & visa)$/.test(t)){if(go('globalmobility'))e.preventDefault();return}
 if(/^(open |view )?visa$/.test(t)){if(go('visa'))e.preventDefault();return}
 if(/^(open |view )?(finance|finance & legal|commissions)$/.test(t)){if(go('agentcommissions'))e.preventDefault();return}
 if(/^(open |view )?(scouting|scouting pipeline)$/.test(t)){if(go('scouting'))e.preventDefault();return}
 if(/^(open |view )?(development|model development)$/.test(t)){if(go('modeldevelopment'))e.preventDefault();return}
},false);

window.CAVYRE_OPERATIONS_CONTROL={release:'16.11.97',navigate:go,mobility:mobility,product:product};
document.documentElement.setAttribute('data-cavyre-operations-control','16.11.97');
})();