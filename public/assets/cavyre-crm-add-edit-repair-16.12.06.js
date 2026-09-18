/* CAVYRE 16.12.06 — CRM Add/Edit Repair */
(function(){
'use strict';if(window.__CAVYRE_CRM_ADD_EDIT_161206__)return;window.__CAVYRE_CRM_ADD_EDIT_161206__=1;
function apply(){
 var crm=window.CavyreCRM;if(!crm)return false;
 if(window.VEUX_V1686){
   try{Object.defineProperty(VEUX_V1686,'crmOpenCompany',{configurable:true,get:function(){return crm.openCompany},set:function(){}})}catch(e){VEUX_V1686.crmOpenCompany=crm.openCompany}
   try{Object.defineProperty(VEUX_V1686,'crmOpenContact',{configurable:true,get:function(){return crm.openContact},set:function(){}})}catch(e){VEUX_V1686.crmOpenContact=crm.openContact}
 }
 return true;
}
apply();setTimeout(apply,0);setTimeout(apply,250);setTimeout(apply,1000);
window.addEventListener('cavyre:smart-crm-forms-ready',apply);
window.addEventListener('veux:assets-ready',apply);
document.documentElement.setAttribute('data-cavyre-crm-add-edit','16.12.06');
})();