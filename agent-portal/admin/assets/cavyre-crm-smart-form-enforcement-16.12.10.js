/* CAVYRE 16.12.10 — Smart CRM Form Enforcement */
(function(){
'use strict';
if(window.__CAVYRE_CRM_SMART_ENFORCE_161210__)return;
window.__CAVYRE_CRM_SMART_ENFORCE_161210__=1;

function lock(){
  var crm=window.CavyreCRM;
  if(!crm)return false;
  if(window.VEUX_V1321){
    try{Object.defineProperty(VEUX_V1321,'openCompany',{configurable:true,enumerable:true,get:function(){return crm.openCompany},set:function(){}})}catch(e){VEUX_V1321.openCompany=crm.openCompany}
    try{Object.defineProperty(VEUX_V1321,'openContact',{configurable:true,enumerable:true,get:function(){return crm.openContact},set:function(){}})}catch(e){VEUX_V1321.openContact=crm.openContact}
  }
  if(window.VEUX_V1686){
    try{Object.defineProperty(VEUX_V1686,'crmOpenCompany',{configurable:true,get:function(){return crm.openCompany},set:function(){}})}catch(e){VEUX_V1686.crmOpenCompany=crm.openCompany}
    try{Object.defineProperty(VEUX_V1686,'crmOpenContact',{configurable:true,get:function(){return crm.openContact},set:function(){}})}catch(e){VEUX_V1686.crmOpenContact=crm.openContact}
  }
  return true;
}

function legacyModal(){
  var m=document.getElementById('vx1321-back');
  if(!m||m.dataset.cvySmartChecked)return;
  var text=(m.textContent||'').replace(/\s+/g,' ').trim();
  if(!/Industry Relations\s*·\s*CRM/i.test(text))return;
  m.dataset.cvySmartChecked='1';
  var isContact=/Contact/i.test(text)&&!/Contacts\s+\d+/i.test(text);
  var id=null;
  try{
    var save=m.querySelector('[onclick*="saveCompany("],[onclick*="saveContact("]');
    var oc=save&&save.getAttribute('onclick')||'';
    var mm=oc.match(/save(?:Company|Contact)\(['"]([^'"]*)/);
    id=mm&&mm[1]&&mm[1]!=='undefined'&&mm[1]!=='null'?mm[1]:null;
  }catch(e){}
  m.remove();
  if(!window.CavyreCRM)return;
  if(isContact)CavyreCRM.openContact(id);
  else CavyreCRM.openCompany(id);
}

var mo=new MutationObserver(function(){lock();legacyModal()});
mo.observe(document.documentElement,{childList:true,subtree:true});
['cavyre:smart-crm-forms-ready','veux:v13-21-ready','veux:assets-ready','veux:shell-ready'].forEach(function(ev){
  window.addEventListener(ev,function(){setTimeout(lock,0);setTimeout(lock,100);setTimeout(legacyModal,120)});
});
lock();setTimeout(lock,0);setTimeout(lock,250);setTimeout(lock,1000);
document.documentElement.setAttribute('data-cavyre-crm-smart-enforcement','16.12.10');
window.CAVYRE_CRM_SMART_ENFORCEMENT={release:'16.12.10',lock:lock};
})();