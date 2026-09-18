/* CAVYRE 16.11.94 — Verified Record Mutation Authority
   Status/complete/archive controls report success only after backend verified:true. */
(function(){
'use strict';
if(window.__CAVYRE_VERIFIED_MUTATION_AUTHORITY_161194__)return;
window.__CAVYRE_VERIFIED_MUTATION_AUTHORITY_161194__=1;

function bridge(){return window.VEUX_AGENT_V4&&window.VEUX_AGENT_V4.api?window.VEUX_AGENT_V4:null}
function org(){try{return bridge().state.org.slug||'maison-de-veux'}catch(e){return'maison-de-veux'}}
function api(path,opt){var b=bridge();if(!b)return Promise.reject(new Error('Agency bridge is still loading.'));return b.api(path,opt||{method:'GET',headers:{}})}
function toast(v){try{if(window.toast)return window.toast(v);if(window.say)return window.say(v)}catch(e){}console.log(v)}
function idFrom(el){
 if(!el)return '';
 var id=el.getAttribute('data-id')||el.getAttribute('data-task-id')||el.getAttribute('data-company-id')||el.getAttribute('data-contact-id')||'';
 if(id)return id;
 var oc=el.getAttribute('onclick')||'',m=oc.match(/(?:taskSelect|crmSelect|crmOpenContact|openCompany|openContact)\(['"]([^'"]+)['"]/);
 return m?m[1]:'';
}
function selectedTaskId(){
 var root=document.getElementById('p-tasksconsolidated')||document.getElementById('p-tasks');
 var row=root&&root.querySelector('.v148-main .v148-row.on');
 return idFrom(row);
}
function selectedCRM(){
 var root=document.getElementById('p-industrydirectory'),row=root&&root.querySelector('.v1686-crm-row.on');
 if(!row)return null;
 var tab=root.querySelector('.v1686-tabs button.on'),isContact=!!(tab&&/Professional Contacts/i.test(tab.textContent||''));
 return {kind:isContact?'contact':'company',id:idFrom(row),root:root};
}
async function taskStatus(id,status,note){
 if(!id)throw new Error('Select a task first.');
 var r=await api('/api/agent/tasks/v11',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({organization_slug:org(),action:'task_status',task_id:id,status:status,note:note||null})});
 if(!r||r.verified!==true||String(r.status||'')!==String(status==='done'?'completed':status))throw new Error('Task status change was not verified.');
 try{if(window.VEUX_AGENT_V4.clearApiCache)window.VEUX_AGENT_V4.clearApiCache()}catch(e){}
 var root=document.getElementById('p-tasksconsolidated')||document.getElementById('p-tasks');
 if(window.VEUX_V148)window.VEUX_V148.task=null;
 if(root&&typeof window.renderTasksConsolidated==='function')await window.renderTasksConsolidated(root);
 toast(status==='completed'?'✓ Task completed and verified':status==='cancelled'?'✓ Task cancelled and verified':'✓ Task status updated and verified');
 return r;
}
async function crmStatus(kind,id,status){
 if(!id)throw new Error('Select a CRM record first.');
 var d=await api('/api/agent/crm/v9?organization='+encodeURIComponent(org()),{method:'GET',headers:{},__fresh:true});
 var list=kind==='contact'?(d.contacts||[]):(d.companies||[]),rec=list.find(function(x){return String(x.id)===String(id)});
 if(!rec)throw new Error('CRM record could not be reloaded for verification.');
 var body={organization_slug:org(),action:kind==='contact'?'update_contact':'update_company',status:status};
 if(kind==='contact'){body.contact_id=id;body.display_name=rec.display_name||[rec.first_name,rec.last_name].filter(Boolean).join(' ')}
 else{body.company_id=id;body.name=rec.name}
 var r=await api('/api/agent/crm/v9',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
 var saved=kind==='contact'?r&&r.contact:r&&r.company;
 if(!r||r.verified!==true||!saved||String(saved.status||'')!==String(status))throw new Error('CRM status change was not verified.');
 try{if(window.VEUX_AGENT_V4.clearApiCache)window.VEUX_AGENT_V4.clearApiCache()}catch(e){}
 if(typeof window.rerender==='function')window.rerender('industrydirectory');
 toast(status==='archive'?'✓ '+(kind==='contact'?'Contact':'Company / Client')+' archived and verified':'✓ CRM status updated and verified');
 return r;
}
function busy(btn,on,text){
 if(!btn)return;
 if(on){btn.dataset.cvyOldText=btn.textContent;btn.disabled=true;btn.textContent=text||'VERIFYING…'}
 else{btn.disabled=false;btn.textContent=btn.dataset.cvyOldText||btn.textContent}
}
async function runTask(btn,status){
 var id=idFrom(btn)||selectedTaskId();if(!id){toast('Select a task first.');return}
 if(status==='cancelled'&&!confirm('Cancel this task? The task remains in CAVYRE with cancelled status.'))return;
 busy(btn,true,status==='completed'?'COMPLETING…':'CANCELLING…');
 try{await taskStatus(id,status)}catch(e){toast(e.message||String(e));busy(btn,false)}
}
async function runArchive(btn){
 var x=selectedCRM();if(!x||!x.id){toast('Select a Company / Client or Contact first.');return}
 if(!confirm('Archive this '+(x.kind==='contact'?'contact':'company / client')+'? It will remain in CAVYRE history.'))return;
 busy(btn,true,'ARCHIVING…');
 try{await crmStatus(x.kind,x.id,'archive')}catch(e){toast(e.message||String(e));busy(btn,false)}
}
function injectTask(){
 var root=document.getElementById('p-tasksconsolidated')||document.getElementById('p-tasks');if(!root)return;
 var rail=root.querySelector('.v148-task-detail .v148-actions-rail');if(!rail||rail.querySelector('[data-cvy-verified-task-status]'))return;
 var box=document.createElement('div');box.setAttribute('data-cvy-verified-task-status','1');box.style.cssText='display:flex;gap:8px;flex-wrap:wrap';
 box.innerHTML='<button class="v148-btn" data-cvy-task-complete>Mark Complete</button><button class="v148-btn" data-cvy-task-cancel>Cancel Task</button>';
 rail.appendChild(box);
}
function injectCRM(){
 var root=document.getElementById('p-industrydirectory');if(!root)return;
 var detail=root.querySelector('.v1686-crm-detail');if(!detail||detail.querySelector('[data-cvy-crm-archive]'))return;
 var b=document.createElement('button');b.className='v1687-edit';b.setAttribute('data-cvy-crm-archive','1');b.textContent='Archive Record';detail.appendChild(b);
}
document.addEventListener('click',function(e){
 var b=e.target&&e.target.closest&&e.target.closest('button,a,[role="button"]');if(!b)return;
 var t=String(b.textContent||'').replace(/\s+/g,' ').trim().toLowerCase();
 if(b.hasAttribute('data-cvy-task-complete')||/^(mark )?complete( task)?$/.test(t)){e.preventDefault();runTask(b,'completed');return}
 if(b.hasAttribute('data-cvy-task-cancel')||/^cancel task$/.test(t)){e.preventDefault();runTask(b,'cancelled');return}
 if(b.hasAttribute('data-cvy-crm-archive')||/^archive (record|company|client|contact|company \/ client)$/.test(t)){e.preventDefault();runArchive(b);return}
},false);

var queued=false;function tick(){if(queued)return;queued=true;requestAnimationFrame(function(){queued=false;injectTask();injectCRM()})}
document.readyState==='loading'?document.addEventListener('DOMContentLoaded',tick,{once:true}):tick();
window.addEventListener('veux:page-rendered',tick);
new MutationObserver(tick).observe(document.documentElement,{childList:true,subtree:true});

window.CAVYRE_VERIFIED_MUTATIONS={release:'16.11.94',taskStatus:taskStatus,crmStatus:crmStatus,refresh:tick};
document.documentElement.setAttribute('data-cavyre-verified-mutations','16.11.94');
})();