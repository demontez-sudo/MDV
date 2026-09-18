/* CAVYRE 16.12.11 — Single CRM Runtime Authority */
(function(){
'use strict';if(window.__CAVYRE_CRM_RUNTIME_161211__)return;window.__CAVYRE_CRM_RUNTIME_161211__=1;
function canonical(){return window.CavyreCRM&&typeof CavyreCRM.openCompany==='function'&&typeof CavyreCRM.openContact==='function'}
function bind(){if(!canonical())return false;var crm=window.CavyreCRM;
 if(window.VEUX_V1321){VEUX_V1321.openCompany=function(id){return crm.openCompany(id)};VEUX_V1321.openContact=function(id){return crm.openContact(id)};VEUX_V1321.saveCompany=function(){throw new Error('Legacy Company editor disabled by CAVYRE 16.12.11')};VEUX_V1321.saveContact=function(){throw new Error('Legacy Contact editor disabled by CAVYRE 16.12.11')}}
 if(window.VEUX_V1686){VEUX_V1686.crmOpenCompany=function(id){return crm.openCompany(id)};VEUX_V1686.crmOpenContact=function(id){return crm.openContact(id)}}
 if(window.VEUX_V1694){VEUX_V1694.openCompany=function(id){return crm.openCompany(id)};VEUX_V1694.openContact=function(id){return crm.openContact(id)}}return true}
function purgeLegacy(){document.querySelectorAll('#vx1321-back').forEach(function(m){var t=(m.textContent||'').replace(/\s+/g,' ');if(/INDUSTRY RELATIONS\s*·\s*CRM/i.test(t)||/SAVE COMPANY|SAVE CONTACT/i.test(t))m.remove()})}
function verify(){bind();purgeLegacy();document.documentElement.setAttribute('data-cavyre-crm-runtime','16.12.11')}
['DOMContentLoaded','cavyre:smart-crm-forms-ready','veux:v13-21-ready','veux:assets-ready','veux:shell-ready'].forEach(function(ev){window.addEventListener(ev,function(){verify();setTimeout(verify,50);setTimeout(verify,300)})});
var mo=new MutationObserver(function(){purgeLegacy();bind()});mo.observe(document.documentElement,{childList:true,subtree:true});
verify();setTimeout(verify,500);setTimeout(verify,1500);window.CAVYRE_CRM_RUNTIME={release:'16.12.11',verify:verify};
})();