/* CAVYRE 16.12.62 — Package CRM Quick Create */
(function(){'use strict';
if(window.__CAVYRE_PACKAGE_CRM_161262__)return;window.__CAVYRE_PACKAGE_CRM_161262__=1;
var cache=null,loading=null;
function E(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]})}
function api(path,opt){if(!window.VEUX_AGENT_V4||!VEUX_AGENT_V4.api)throw new Error('CAVYRE secure bridge is not ready');return VEUX_AGENT_V4.api(path,opt||{method:'GET',headers:{}})}
function org(){var s=window.VEUX_AGENT_V4&&VEUX_AGENT_V4.state||{};return s.org&&s.org.slug||'maison-de-veux'}
function load(){
 if(cache)return Promise.resolve(cache);
 if(loading)return loading;
 loading=api('/api/agent/crm/v9?organization='+encodeURIComponent(org()),{method:'GET',headers:{}}).then(function(d){cache=d||{};return cache}).finally(function(){loading=null});
 return loading;
}
function post(body){return api('/api/agent/crm/v9',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(Object.assign({organization_slug:org()},body))})}
function panel(){return document.getElementById('cvy-pkg-crm-161262')}
function status(m,bad){var e=document.getElementById('cvy-pkg-crm-status');if(e){e.textContent=m||'';e.classList.toggle('bad',!!bad)}}
function fill(name,email){var n=document.getElementById('veuxPkgRecipientName'),e=document.getElementById('veuxPkgRecipientEmail');if(n)n.value=name||'';if(e)e.value=email||'';status('Recipient filled from CRM.',false)}
function contactOptions(d){
 var cs=(d&&d.contacts)||[];
 return '<option value="">Select CRM contact…</option>'+cs.filter(function(x){return x.email}).sort(function(a,b){return String(a.display_name||'').localeCompare(String(b.display_name||''))}).map(function(x){return'<option value="'+E(x.id)+'" data-email="'+E(x.email)+'" data-name="'+E(x.display_name||'')+'">'+E(x.display_name||x.email)+' · '+E(x.email)+'</option>'}).join('')
}
function companyOptions(d){
 var cs=(d&&d.companies)||[];
 return '<option value="">No company / independent</option>'+cs.slice().sort(function(a,b){return String(a.name||'').localeCompare(String(b.name||''))}).map(function(x){return'<option value="'+E(x.id)+'">'+E(x.name)+'</option>'}).join('')
}
function show(kind){
 var box=document.getElementById('cvy-pkg-crm-form');if(!box)return;
 if(kind==='company')box.innerHTML='<div class="cvy-pkg-mini-grid"><label>Company Name<input id="cvy-pkg-company-name" placeholder="Company / client name"></label><label>Type<select id="cvy-pkg-company-type"><option value="brand">Brand / Fashion House</option><option value="casting_office">Casting Office</option><option value="agency">Agency</option><option value="media">Publication / Media</option><option value="photographer">Photographer</option><option value="other">Other</option></select></label><label class="wide">Company Email<input id="cvy-pkg-company-email" type="email" placeholder="optional@company.com"></label></div><div class="cvy-pkg-mini-actions"><button data-cvy-pkg-cancel>Cancel</button><button class="primary" data-cvy-pkg-save-company>Create Company</button></div>';
 else box.innerHTML='<div class="cvy-pkg-mini-grid"><label>Contact Name<input id="cvy-pkg-contact-name" placeholder="Client / contact name"></label><label>Email<input id="cvy-pkg-contact-email" type="email" placeholder="client@company.com"></label><label>Role<input id="cvy-pkg-contact-role" placeholder="Casting Director, Booker…"></label><label>Company<select id="cvy-pkg-contact-company">'+companyOptions(cache||{})+'</select></label></div><div class="cvy-pkg-mini-actions"><button data-cvy-pkg-cancel>Cancel</button><button class="primary" data-cvy-pkg-save-contact>Create & Use Contact</button></div>';
 bindMini(box)
}
function bindMini(box){
 var c=box.querySelector('[data-cvy-pkg-cancel]');if(c)c.onclick=function(){box.innerHTML=''};
 var sc=box.querySelector('[data-cvy-pkg-save-company]');if(sc)sc.onclick=async function(){
   var name=(document.getElementById('cvy-pkg-company-name')||{}).value||'',email=(document.getElementById('cvy-pkg-company-email')||{}).value||'',type=(document.getElementById('cvy-pkg-company-type')||{}).value||'other';
   if(!name.trim())return status('Company name is required.',true);
   sc.disabled=true;try{var r=await post({action:'create_company',name:name.trim(),company_type:type,status:'active',email:email.trim()});if(!r||r.verified!==true)throw new Error('Company save was not verified.');cache=null;await refresh();status('Company created and verified. You can now add/select its contact.',false);box.innerHTML=''}catch(e){status(e.message||String(e),true);sc.disabled=false}
 };
 var st=box.querySelector('[data-cvy-pkg-save-contact]');if(st)st.onclick=async function(){
   var name=(document.getElementById('cvy-pkg-contact-name')||{}).value||'',email=(document.getElementById('cvy-pkg-contact-email')||{}).value||'',role=(document.getElementById('cvy-pkg-contact-role')||{}).value||'',company=(document.getElementById('cvy-pkg-contact-company')||{}).value||null;
   if(!name.trim()||!email.trim())return status('Contact name and email are required.',true);
   st.disabled=true;try{var r=await post({action:'create_contact',company_id:company,display_name:name.trim(),role:role.trim(),email:email.trim(),status:'active',linked_companies:company?[{company_id:company,is_primary:true,relationship_role:role.trim()||null}]:[]});if(!r||r.verified!==true)throw new Error('Contact save was not verified.');fill((r.contact&&r.contact.display_name)||name,(r.contact&&r.contact.email)||email);cache=null;await refresh();box.innerHTML=''}catch(e){status(e.message||String(e),true);st.disabled=false}
 }
}
async function refresh(){
 var d=await load(),sel=document.getElementById('cvyPkgCrmContact');if(sel)sel.innerHTML=contactOptions(d);return d
}
function enhance(){
 var email=document.getElementById('veuxPkgRecipientEmail');if(!email||panel())return;
 var grid=email.closest('div[style*="grid-template-columns"]')||email.parentElement&&email.parentElement.parentElement;
 if(!grid)return;
 var box=document.createElement('div');box.id='cvy-pkg-crm-161262';box.className='cvy-pkg-crm-tools';
 box.innerHTML='<div class="cvy-pkg-crm-head"><div><small>CLIENT CRM</small><b>Choose or create the recipient without leaving the package.</b></div><div><button data-cvy-pkg-company>+ Company</button><button data-cvy-pkg-contact>+ Contact</button></div></div><div class="cvy-pkg-crm-select"><select id="cvyPkgCrmContact"><option>Loading CRM contacts…</option></select><button data-cvy-pkg-refresh>Refresh</button></div><div id="cvy-pkg-crm-form"></div><div id="cvy-pkg-crm-status"></div>';
 grid.parentNode.insertBefore(box,grid);
 box.querySelector('[data-cvy-pkg-company]').onclick=function(){show('company')};
 box.querySelector('[data-cvy-pkg-contact]').onclick=function(){show('contact')};
 box.querySelector('[data-cvy-pkg-refresh]').onclick=function(){cache=null;refresh().catch(function(e){status(e.message||String(e),true)})};
 var sel=box.querySelector('#cvyPkgCrmContact');sel.onchange=function(){var o=sel.options[sel.selectedIndex];if(o&&o.value)fill(o.dataset.name,o.dataset.email)};
 refresh().catch(function(e){sel.innerHTML='<option value="">CRM contacts unavailable</option>';status(e.message||String(e),true)})
}
var timer=null,observerQueued=false;
function schedule(){
 if(observerQueued)return;observerQueued=true;
 clearTimeout(timer);timer=setTimeout(function(){observerQueued=false;enhance()},80)
}
new MutationObserver(function(records){
 var needs=records.some(function(r){
   if(!r.addedNodes||!r.addedNodes.length)return false;
   return Array.prototype.some.call(r.addedNodes,function(n){
     if(!n||n.nodeType!==1)return false;
     return (n.id==='veuxPkgRecipientEmail')||(n.querySelector&&n.querySelector('#veuxPkgRecipientEmail'));
   });
 });
 if(needs)schedule();
}).observe(document.body||document.documentElement,{childList:true,subtree:true});
setTimeout(enhance,300);
window.CAVYRE_PACKAGE_CRM_161262={enhance:enhance,refresh:function(){cache=null;return refresh()},release:'16.12.64'};
})();