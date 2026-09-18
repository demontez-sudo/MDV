/* CAVYRE 16.11.92 — Create Action Authority
   Repairs primary create/open buttons after dynamic rerenders without replacing native APIs. */
(function(){
'use strict';
if(window.__CAVYRE_CREATE_ACTION_AUTHORITY_161192__)return;
window.__CAVYRE_CREATE_ACTION_AUTHORITY_161192__=1;
function text(b){return String(b&&b.textContent||'').replace(/\s+/g,' ').trim().toLowerCase()}
function call(fn,args){try{if(typeof fn==='function'){fn.apply(null,args||[]);return true}}catch(e){console.warn('[CAVYRE 16.11.92] action failed',e)}return false}
function openTask(){
 if(window.CAVYRE_TASK_CRUD&&call(window.CAVYRE_TASK_CRUD.open,[]))return true;
 if(window.VEUX_V10&&call(window.VEUX_V10.newTask,[]))return true;
 if(window.VEUX_V136&&call(window.VEUX_V136.newTask,[]))return true;
 return false;
}
function openModel(){
 if(window.VEUX_V133&&call(window.VEUX_V133.newModel,[]))return true;
 return false;
}
function openBooking(){
 if(window.VEUX_V132&&call(window.VEUX_V132.openEvent,['booking']))return true;
 if(window.openEvent&&call(window.openEvent,[null,'booking']))return true;
 return false;
}
function openEvent(){
 if(window.VEUX_V132&&call(window.VEUX_V132.openEvent,['event']))return true;
 if(window.openEvent&&call(window.openEvent,[null]))return true;
 return false;
}
function openCompany(){return !!(window.CAVYRE_CRM_BUTTON_AUTHORITY&&window.CAVYRE_CRM_BUTTON_AUTHORITY.openCompany&&window.CAVYRE_CRM_BUTTON_AUTHORITY.openCompany())}
function openContact(){return !!(window.CAVYRE_CRM_BUTTON_AUTHORITY&&window.CAVYRE_CRM_BUTTON_AUTHORITY.openContact&&window.CAVYRE_CRM_BUTTON_AUTHORITY.openContact())}
function classify(b){
 var t=text(b);
 if(/^\+?\s*(new|add|create)\s+task$/.test(t))return 'task';
 if(/^\+?\s*(new|add)\s+model$/.test(t))return 'model';
 if(/^\+?\s*(new|add|create)\s+booking$/.test(t))return 'booking';
 if(/^\+?\s*(new|add|create)\s+event$/.test(t))return 'event';
 if(/^\+?\s*(new|add|create)\s+(company|client|company\s*\/\s*client)$/.test(t))return 'company';
 if(/^\+?\s*(new|add|create)\s+contact$/.test(t))return 'contact';
 return '';
}
document.addEventListener('click',function(e){
 var b=e.target&&e.target.closest&&e.target.closest('button,a,[role="button"]');if(!b)return;
 var kind=classify(b);if(!kind)return;
 var ok=false;
 if(kind==='task')ok=openTask();
 else if(kind==='model')ok=openModel();
 else if(kind==='booking')ok=openBooking();
 else if(kind==='event')ok=openEvent();
 else if(kind==='company')ok=openCompany();
 else if(kind==='contact')ok=openContact();
 if(ok){e.preventDefault();}
},false);
window.CAVYRE_CREATE_ACTION_AUTHORITY={
 release:'16.11.92',
 openTask:openTask,openModel:openModel,openBooking:openBooking,openEvent:openEvent,
 openCompany:openCompany,openContact:openContact
};
document.documentElement.setAttribute('data-cavyre-create-action-authority','16.11.92');
})();