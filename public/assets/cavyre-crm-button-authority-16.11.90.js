/* CAVYRE 16.11.90 — CRM Company + Contact Button Authority */
(function(){
'use strict';
if(window.__CAVYRE_CRM_BUTTON_AUTHORITY_161190__)return;
window.__CAVYRE_CRM_BUTTON_AUTHORITY_161190__=1;
function crm(){return window.CavyreCRM||window.CAVYRE_CRM||null}
function txt(el){return String(el&&el.textContent||'').replace(/\s+/g,' ').trim().toLowerCase()}
function isCompany(b){var t=txt(b);return b.matches('[data-cvy-crm-company],[data-action="add-company"],#add-company,#crm-add-company')||/^\+?\s*(add\s+)?(company|client|company\s*\/\s*client)$/.test(t)}
function isContact(b){var t=txt(b);return b.matches('[data-cvy-crm-contact],[data-action="add-contact"],#add-contact,#crm-add-contact')||/^\+?\s*(add\s+)?contact$/.test(t)}
function open(kind){
 var c=crm();
 if(c&&kind==='company'&&typeof c.openCompany==='function'){c.openCompany();return true}
 if(c&&kind==='contact'&&typeof c.openContact==='function'){c.openContact();return true}
 try{if(window.VEUX_V1321&&kind==='company'&&typeof VEUX_V1321.openCompany==='function'){VEUX_V1321.openCompany();return true}
 if(window.VEUX_V1321&&kind==='contact'&&typeof VEUX_V1321.openContact==='function'){VEUX_V1321.openContact();return true}}catch(e){}
 return false;
}
document.addEventListener('click',function(e){
 var b=e.target&&e.target.closest&&e.target.closest('button,a,[role="button"]');if(!b)return;
 if(isCompany(b)){e.preventDefault();open('company');return}
 if(isContact(b)){e.preventDefault();open('contact');return}
},false);
window.CAVYRE_CRM_BUTTON_AUTHORITY={release:'16.11.90',openCompany:function(){return open('company')},openContact:function(){return open('contact')}};
})();