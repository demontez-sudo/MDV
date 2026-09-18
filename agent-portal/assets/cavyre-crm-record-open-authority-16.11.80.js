/* CAVYRE 16.11.80 — CRM Record Open Authority
   Company/client and professional-contact rows open the canonical smart CRM record. */
(function(){
'use strict';
if(window.__CAVYRE_CRM_RECORD_OPEN_161180__)return;
window.__CAVYRE_CRM_RECORD_OPEN_161180__=1;

function idFrom(el){
  if(!el)return '';
  var id=el.getAttribute('data-id')||el.getAttribute('data-company-id')||el.getAttribute('data-contact-id')||'';
  if(id)return id;
  var oc=el.getAttribute('onclick')||'';
  var m=oc.match(/(?:crmSelect|crmOpenContact)\(['"]([^'"]+)['"]/);
  return m?m[1]:'';
}
function contactMode(root){
  var on=root&&root.querySelector('.v1686-tabs button.on');
  return !!(on&&/Professional Contacts/i.test(on.textContent||''));
}
function open(kind,id){
  if(!id||!window.CavyreCRM)return false;
  if(kind==='contact'&&typeof CavyreCRM.openContact==='function'){CavyreCRM.openContact(id);return true;}
  if(kind==='company'&&typeof CavyreCRM.openCompany==='function'){CavyreCRM.openCompany(id);return true;}
  return false;
}
function capture(e){
  var root=e.target&&e.target.closest&&(e.target.closest('#p-industrydirectory')||e.target.closest('.v1686-crm')||e.target.closest('.v1686-page'));
  if(!root)return;

  var row=e.target.closest('.v1686-crm-row');
  if(row){
    var id=idFrom(row);
    if(id&&open(contactMode(root)?'contact':'company',id)){
      e.preventDefault();
      e.stopImmediatePropagation();
    }
    return;
  }

  /* Contact names shown inside a company preview should open that contact record,
     not switch the entire directory into the contacts list first. */
  var linked=e.target.closest('.v1686-crm-detail section button');
  if(linked){
    var cid=idFrom(linked);
    if(cid&&open('contact',cid)){
      e.preventDefault();
      e.stopImmediatePropagation();
    }
    return;
  }

  /* Existing edit button remains a direct record-open action. */
  var edit=e.target.closest('.v1687-edit');
  if(edit){
    var selected=root.querySelector('.v1686-crm-row.on');
    var sid=idFrom(selected);
    if(sid&&open(contactMode(root)?'contact':'company',sid)){
      e.preventDefault();
      e.stopImmediatePropagation();
    }
  }
}

document.addEventListener('click',capture,true);
document.documentElement.setAttribute('data-cavyre-crm-record-open','16.11.80');
window.CavyreCRMRecordOpen={version:'16.11.80',open:open};
})();
