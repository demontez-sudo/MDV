/* CAVYRE 16.11.93 — Existing Record Action Authority
   Persistent fallback for open/edit/detail actions after dynamic rerenders.
   Destructive actions are intentionally never inferred from labels without a record id/controller. */
(function(){
'use strict';
if(window.__CAVYRE_RECORD_ACTION_AUTHORITY_161193__)return;
window.__CAVYRE_RECORD_ACTION_AUTHORITY_161193__=1;
function closest(t,s){try{return t&&t.closest?t.closest(s):null}catch(e){return null}}
function idFrom(el){
 if(!el)return '';
 var id=el.getAttribute('data-id')||el.getAttribute('data-task-id')||el.getAttribute('data-model-id')||el.getAttribute('data-record-id')||el.getAttribute('data-company-id')||el.getAttribute('data-contact-id')||'';
 if(id)return id;
 var oc=el.getAttribute('onclick')||'',m=oc.match(/(?:taskSelect|openModel|crmSelect|crmOpenContact|openCompany|openContact)\(['"]([^'"]+)['"]/);
 return m?m[1]:'';
}
function taskEdit(id){var c=window.CAVYRE_TASK_CRUD_161142||window.CAVYRE_TASK_CRUD;if(c&&typeof c.open==='function'){c.open(id||null);return true}if(window.VEUX_V136&&typeof VEUX_V136.editTask==='function'&&id){VEUX_V136.editTask(id);return true}return false}
function modelOpen(id){
 if(!id)return false;
 window._veuxV10ModelId=id;window._openModelId=id;
 try{if(window.VEUX_PERF&&VEUX_PERF.invalidate)VEUX_PERF.invalidate('modelpage')}catch(e){}
 if(typeof window.navTo==='function'){window.navTo('modelpage');return true}
 return false;
}
function crmOpen(kind,id){if(!id||!window.CavyreCRM)return false;if(kind==='contact'&&typeof CavyreCRM.openContact==='function'){CavyreCRM.openContact(id);return true}if(kind==='company'&&typeof CavyreCRM.openCompany==='function'){CavyreCRM.openCompany(id);return true}return false}
function calendarEdit(kind,id){
 if(!id||!window.VEUX_V132)return false;
 if(typeof VEUX_V132.openRecord==='function'){VEUX_V132.openRecord(kind||'event',id);return true}
 if(typeof VEUX_V132.openEvent==='function'){VEUX_V132.openEvent(kind||'event',{id:id});return true}
 return false;
}
function label(el){return String(el&&el.textContent||'').replace(/\s+/g,' ').trim().toLowerCase()}
document.addEventListener('click',function(e){
 var b=closest(e.target,'button,a,[role="button"]');if(!b)return;
 var t=label(b),root,id;

 // Task detail edit.
 if(/^edit task$/.test(t)){
   root=closest(b,'#p-tasks,#p-tasksconsolidated')||document;
   var selected=root.querySelector&&root.querySelector('.v148-main .v148-row.on');
   id=idFrom(b)||idFrom(selected);
   if(id&&taskEdit(id)){e.preventDefault();return}
 }

 // CRM selected-record edit.
 if(/^edit (company\s*\/\s*client|professional contact|company|contact)$/.test(t)){
   root=closest(b,'#p-industrydirectory,.v1686-crm')||document;
   var row=root.querySelector&&root.querySelector('.v1686-crm-row.on');
   id=idFrom(b)||idFrom(row);
   var contact=/contact/.test(t);
   if(id&&crmOpen(contact?'contact':'company',id)){e.preventDefault();return}
 }

 // Generic model profile/view buttons only when a model id is actually available.
 if(/^(open|view) (model|profile)$/.test(t)){
   id=idFrom(b)||b.getAttribute('data-model-id');
   if(id&&modelOpen(id)){e.preventDefault();return}
 }

 // Calendar detail edit only with explicit selected record context.
 if(/^edit (event|booking|casting)$/.test(t)){
   id=idFrom(b)||b.getAttribute('data-record-id');
   var kind=/booking/.test(t)?'booking':/casting/.test(t)?'casting':'event';
   if(id&&calendarEdit(kind,id)){e.preventDefault();return}
 }
},false);

// Double-click is a stable, non-destructive edit shortcut for task rows.
document.addEventListener('dblclick',function(e){
 var row=closest(e.target,'.v148-main .v148-row');if(!row)return;
 var id=idFrom(row);if(id&&taskEdit(id)){e.preventDefault()}
},false);

window.CAVYRE_RECORD_ACTION_AUTHORITY={release:'16.11.93',taskEdit:taskEdit,modelOpen:modelOpen,crmOpen:crmOpen,calendarEdit:calendarEdit};
document.documentElement.setAttribute('data-cavyre-record-action-authority','16.11.93');
})();