/* CAVYRE 16.11.98 — Finance / Communication / Development Action Authority */
(function(){
'use strict';
if(window.__CAVYRE_FCD_ACTION_AUTHORITY_161198__)return;
window.__CAVYRE_FCD_ACTION_AUTHORITY_161198__=1;
function c(t,s){try{return t&&t.closest?t.closest(s):null}catch(e){return null}}
function text(x){return String(x&&x.textContent||'').replace(/\s+/g,' ').trim().toLowerCase()}
function call(o,n,a){try{if(o&&typeof o[n]==='function'){o[n].apply(o,a||[]);return true}}catch(e){console.warn('[CAVYRE 16.11.98]',e)}return false}
function selectedModelId(el){var x=c(el,'[data-model-id]');return (x&&x.getAttribute('data-model-id'))||window._veuxV10ModelId||window._openModelId||''}
document.addEventListener('click',function(e){
 var b=c(e.target,'button,a,[role="button"]');if(!b)return;
 var t=text(b),p=window.VEUX_V153,f=window.VEUX_V152,v=window.VEUX_V1686,id;
 if(/^\+?\s*(new|compose)\s+(message|communication)$/.test(t)||/^new message$/.test(t)){if(call(p,'newMessage'))e.preventDefault();return}
 var fm=t.match(/^(overview|invoices|payments|payouts|legal)$/);
 if(fm&&c(b,'#p-agentcommissions,#p-financelegal,.v152-tabs')){if(call(f,'financeTab',[fm[1]]))e.preventDefault();return}
 if(/^\+?\s*new development plan$/.test(t)||/^(create|add) development plan$/.test(t)){if(call(p,'newPlan'))e.preventDefault();return}
 if(/^\+?\s*new development activity$/.test(t)||/^(create|add) development activity$/.test(t)){if(call(p,'newActivity'))e.preventDefault();return}
 if(/^smart gameplan$/.test(t)||/^build smart gameplan$/.test(t)){id=selectedModelId(b);if(call(v,'smartGameplan',[id||null]))e.preventDefault();return}
},false);
window.CAVYRE_FCD_ACTIONS={release:'16.11.98'};
document.documentElement.setAttribute('data-cavyre-fcd-actions','16.11.98');
})();