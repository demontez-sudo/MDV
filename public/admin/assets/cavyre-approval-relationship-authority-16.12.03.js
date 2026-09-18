/* CAVYRE 16.12.03 — Approval / Relationship Action Authority */
(function(){
'use strict';
if(window.__CAVYRE_APPROVAL_RELATIONSHIP_161203__)return;
window.__CAVYRE_APPROVAL_RELATIONSHIP_161203__=1;

function text(el){return String(el&&el.textContent||'').replace(/\s+/g,' ').trim().toLowerCase()}
function selectedApprovalId(){
  var row=document.querySelector('#p-approvals .v148-main .v148-row.on');
  if(!row)return '';
  var oc=row.getAttribute('onclick')||'',m=oc.match(/approvalSelect\(['"]([^'"]+)['"]\)/);
  return m?m[1]:'';
}
function approval(status){
  var id=selectedApprovalId();
  if(!id){alert('Select an approval request first.');return false}
  if(window.VEUX_V136&&typeof VEUX_V136.decide==='function'){VEUX_V136.decide(id,status);return true}
  return false;
}
function bridge(){if(!window.VEUX_AGENT_V4||!window.VEUX_AGENT_V4.api)throw new Error('Secure Agent bridge is not ready');return window.VEUX_AGENT_V4}
function org(){try{return bridge().state.org.slug||'maison-de-veux'}catch(e){return'maison-de-veux'}}
async function crmPost(body){
  var out=await bridge().api('/api/agent/crm/v9',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(Object.assign({organization_slug:org()},body))});
  if(!out||out.verified!==true)throw new Error('Relationship change was not verified as saved.');
  return out;
}
async function logActivity(input){
  input=input||{};
  if(!input.company_id&&!input.contact_id)throw new Error('Company or Contact record is required.');
  return crmPost({action:'log_activity',company_id:input.company_id||null,contact_id:input.contact_id||null,activity_type:input.activity_type||'note',direction:input.direction||'internal',subject:input.subject||null,summary:input.summary||null,occurred_at:input.occurred_at||new Date().toISOString(),metadata:input.metadata||{}});
}
async function setContactCompanies(contact,links){
  if(!contact||!contact.id)throw new Error('Contact record is required.');
  return crmPost({action:'update_contact',contact_id:contact.id,display_name:contact.display_name||[contact.first_name,contact.last_name].filter(Boolean).join(' '),linked_companies:Array.isArray(links)?links:[]});
}

document.addEventListener('click',function(e){
  var b=e.target&&e.target.closest&&e.target.closest('#p-approvals button');if(!b)return;
  var t=text(b);
  if(t==='hold'){e.preventDefault();approval('on_hold');return}
  if(t==='escalate'){
    e.preventDefault();
    if(typeof window.navTo==='function')window.navTo('escalations');
    return;
  }
},false);

window.CAVYRE_APPROVAL_RELATIONSHIP_ACTIONS={
  release:'16.12.03',
  holdApproval:function(){return approval('on_hold')},
  logActivity:logActivity,
  setContactCompanies:setContactCompanies
};
document.documentElement.setAttribute('data-cavyre-approval-relationship-actions','16.12.03');
})();