/* CAVYRE 16.12.100 — Smart Gameplan (agent-side authoring view, Model 360 tab). */
(function(){
'use strict';
if(window.__CAVYRE_SMART_GAMEPLAN_161200__)return;window.__CAVYRE_SMART_GAMEPLAN_161200__=1;

var TASK_TYPES=[['agent','Agent'],['training','Training'],['progress_submission','Progress Submission'],['branding','Branding'],['testing','Testing'],['direct_booking','Direct Booking'],['visa_travel','Visa & Travel'],['casting_show','Casting & Show']];
var TYPE_LABEL={};TASK_TYPES.forEach(function(t){TYPE_LABEL[t[0]]=t[1];});
var UI={typeFilter:'',settingsOpen:false,addOpen:false,editingTaskId:null};

function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
function bridge(){if(!window.VEUX_AGENT_V4||!window.VEUX_AGENT_V4.api)throw new Error('VEUX secure bridge is not ready');return window.VEUX_AGENT_V4;}
function org(){var s=bridge().state||{};return (s.org&&s.org.slug)||'maison-de-veux';}
function api(path,opts){return bridge().api(path,opts||{method:'GET',headers:{}});}
function post(body){return api('/api/agent/gameplan/v1',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(Object.assign({organization_slug:org()},body||{}))});}
function toast(v){try{if(window.toast)return window.toast(v);}catch(e){}console.log(v);}
function val(id){var el=document.getElementById(id);return el?el.value:'';}
function checked(id){var el=document.getElementById(id);return !!(el&&el.checked);}
function fmtDate(v){if(!v)return '—';try{return new Date(v+'T12:00:00').toLocaleDateString([],{month:'short',day:'numeric',year:'numeric'});}catch(e){return String(v);}}
function fmtDateTime(v){if(!v)return '—';try{return new Date(v).toLocaleString([],{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});}catch(e){return String(v);}}
function refresh(){if(window.CAVYRE_SMART_GAMEPLAN_REFRESH)window.CAVYRE_SMART_GAMEPLAN_REFRESH();}

function cadenceRow(label,id,value,placeholder,type){return '<label><span>'+esc(label)+'</span><input id="'+id+'" type="'+(type||'text')+'" value="'+esc(value==null?'':value)+'" placeholder="'+esc(placeholder||'')+'"></label>';}

function settingsForm(model,gp){
  var c=(gp&&gp.checkin_cadence)||{};
  var focus=Array.isArray(c.focus_labels)&&c.focus_labels.length?c.focus_labels:['Develop','Pipeline','Brand'];
  return '<div class="cvygp-card"><header><div><small>PLAN DETAILS</small><h2>'+(gp&&gp.id?'Edit Gameplan':'Create Smart Gameplan')+'</h2></div><button type="button" class="v152-btn" onclick="CAVYRE_SMART_GAMEPLAN.toggleSettings()">'+(UI.settingsOpen?'Close':'Cancel')+'</button></header>'
   +'<div class="v155-form-grid">'
   +'<label><span>Title</span><input id="cvygp-title" value="'+esc(gp&&gp.title||'')+'" placeholder="e.g. New York Board — FW27"></label>'
   +'<label><span>Key Date</span><input id="cvygp-keydate" type="date" value="'+esc(gp&&gp.key_date||'')+'"></label>'
   +'<label class="wide"><span>Key Date Label (shown as the countdown caption)</span><input id="cvygp-keydatelabel" value="'+esc(gp&&gp.key_date_label||'')+'" placeholder="e.g. days until you land in New York"></label>'
   +'<label class="wide"><span>Welcome Message (to the model)</span><textarea id="cvygp-welcome" rows="4">'+esc(gp&&gp.welcome_message||'')+'</textarea></label>'
   +'<label class="wide"><span>Brand Positioning</span><textarea id="cvygp-brand" rows="4">'+esc(gp&&gp.brand_positioning||'')+'</textarea></label>'
   +'<label class="wide"><span>Market Focus</span><textarea id="cvygp-market" rows="3">'+esc(gp&&gp.market_focus||'')+'</textarea></label>'
   +'<label class="wide"><span>Image & Grooming Rules (shown to the model)</span><textarea id="cvygp-rules" rows="4">'+esc(gp&&gp.image_rules||'')+'</textarea></label>'
   +'<label class="wide"><span>Watch List / Risks <em>(staff only — never shown to the model)</em></span><textarea id="cvygp-risks" rows="4">'+esc(gp&&gp.risks||'')+'</textarea></label>'
   +'</div>'
   +'<div class="cvygp-subhead">Check-in cadence</div>'
   +'<div class="v155-form-grid">'
   +cadenceRow('Every N days','cvygp-cadence-interval',c.interval_days||2,'2','number')
   +cadenceRow('Local time','cvygp-cadence-time',c.time_local||'16:00','16:00')
   +cadenceRow('Timezone','cvygp-cadence-tz',c.timezone||'','Europe/Madrid')
   +cadenceRow('Start date','cvygp-cadence-start',c.start_date||'','','date')
   +cadenceRow('End date','cvygp-cadence-end',c.end_date||'','','date')
   +cadenceRow('Focus rotation (comma-separated)','cvygp-cadence-focus',focus.join(', '),'Develop, Pipeline, Brand')
   +'</div>'
   +'<div class="cvygp-actions"><button type="button" class="v152-btn primary" onclick="CAVYRE_SMART_GAMEPLAN.saveSettings(\''+model.id+'\')">Save Plan Details</button></div>'
   +'</div>';
}

function addTaskForm(model,gp){
  return '<div class="cvygp-card"><header><div><small>NEW TASK</small><h2>Add Task</h2></div><button type="button" class="v152-btn" onclick="CAVYRE_SMART_GAMEPLAN.toggleAdd()">Cancel</button></header>'
   +'<div class="v155-form-grid">'
   +'<label class="wide"><span>Title</span><input id="cvygp-t-title" placeholder="e.g. Send passport scan to Troy"></label>'
   +'<label class="wide"><span>Description</span><textarea id="cvygp-t-desc" rows="2"></textarea></label>'
   +'<label><span>Type</span><select id="cvygp-t-type">'+TASK_TYPES.map(function(t){return '<option value="'+t[0]+'">'+esc(t[1])+'</option>';}).join('')+'</select></label>'
   +'<label><span>Due date</span><input id="cvygp-t-date" type="date"></label>'
   +'<label><span><input id="cvygp-t-hard" type="checkbox"> Hard stop / must happen</span></label>'
   +'</div>'
   +'<div class="cvygp-actions"><button type="button" class="v152-btn primary" onclick="CAVYRE_SMART_GAMEPLAN.createTask(\''+model.id+'\',\''+gp.id+'\')">Add Task</button></div>'
   +'</div>';
}

function taskRow(t,model,gp){
  var editing=UI.editingTaskId===t.id;
  if(editing){
    return '<tr class="cvygp-edit-row"><td colspan="5"><div class="v155-form-grid">'
     +'<label class="wide"><span>Title</span><input id="cvygp-e-title" value="'+esc(t.title||'')+'"></label>'
     +'<label class="wide"><span>Description</span><textarea id="cvygp-e-desc" rows="2">'+esc(t.description||'')+'</textarea></label>'
     +'<label><span>Type</span><select id="cvygp-e-type">'+TASK_TYPES.map(function(x){return '<option value="'+x[0]+'" '+((t.metadata&&t.metadata.task_type)===x[0]?'selected':'')+'>'+esc(x[1])+'</option>';}).join('')+'</select></label>'
     +'<label><span>Due date</span><input id="cvygp-e-date" type="date" value="'+esc(t.due_at?String(t.due_at).slice(0,10):'')+'"></label>'
     +'<label><span>Status</span><select id="cvygp-e-status"><option value="open" '+(t.status==='open'?'selected':'')+'>Open</option><option value="in_progress" '+(t.status==='in_progress'?'selected':'')+'>In Progress</option><option value="completed" '+(t.status==='completed'?'selected':'')+'>Completed</option><option value="cancelled" '+(t.status==='cancelled'?'selected':'')+'>Cancelled</option></select></label>'
     +'<label><span><input id="cvygp-e-hard" type="checkbox" '+(t.metadata&&t.metadata.is_hard_stop?'checked':'')+'> Hard stop</span></label>'
     +'</div><div class="cvygp-actions"><button type="button" class="v152-btn" onclick="CAVYRE_SMART_GAMEPLAN.cancelEdit()">Cancel</button><button type="button" class="v152-btn primary" onclick="CAVYRE_SMART_GAMEPLAN.saveTask(\''+t.id+'\')">Save</button></div></td></tr>';
  }
  var meta=t.metadata||{},type=meta.task_type||'agent',hard=!!meta.is_hard_stop,pending=meta.reschedule_status==='pending';
  return '<tr class="'+(hard?'cvygp-hard':'')+'">'
   +'<td class="cvygp-date">'+fmtDate(t.due_at?String(t.due_at).slice(0,10):null)+(hard?'<span class="cvygp-badge-hard">Hard stop</span>':'')+'</td>'
   +'<td><span class="cvygp-type-chip">'+esc(TYPE_LABEL[type]||type)+'</span></td>'
   +'<td><b>'+esc(t.title||'')+'</b>'+(t.description?'<small>'+esc(t.description)+'</small>':'')+(pending?'<div class="cvygp-reschedule-flag">Model requested '+fmtDate(meta.reschedule_requested_date)+(meta.reschedule_note?' — "'+esc(meta.reschedule_note)+'"':'')+'</div>':'')+'</td>'
   +'<td>'+esc((t.status||'open').replace('_',' '))+'</td>'
   +'<td class="cvygp-row-actions">'
   +(pending?'<button type="button" class="v152-btn primary" onclick="CAVYRE_SMART_GAMEPLAN.decideReschedule(\''+t.id+'\',\'approve\')">Approve</button><button type="button" class="v152-btn" onclick="CAVYRE_SMART_GAMEPLAN.decideReschedule(\''+t.id+'\',\'deny\')">Deny</button>':'<button type="button" class="v152-btn" onclick="CAVYRE_SMART_GAMEPLAN.editTask(\''+t.id+'\')">Edit</button>')
   +'</td></tr>';
}

function render(model,gp){
  if(gp&&gp.loading)return '<div class="v155-empty">Loading Smart Gameplan…</div>';
  if(gp&&gp.error)return '<div class="v155-empty">Could not load Smart Gameplan: '+esc(gp.error)+'</div>';
  var doc=gp&&gp.gameplan;
  var h='';
  if(!doc||UI.settingsOpen){
    h+=settingsForm(model,doc);
    if(!doc)return h;
  }
  h+='<div class="v155-card"><header><div><small>SMART GAMEPLAN</small><h2>'+esc(doc.title||model.display_name||'Gameplan')+'</h2>'+(doc.key_date?'<p>'+esc(doc.key_date_label||'Key date')+': '+fmtDate(doc.key_date)+'</p>':'')+'</div><div class="cvygp-actions"><button type="button" class="v152-btn" onclick="CAVYRE_SMART_GAMEPLAN.toggleSettings()">Edit Plan Details</button></div></header>'
   +(gp.development_plan?'<p class="cvygp-note">Linked to Development Plan: <b>'+esc(gp.development_plan.title||'Development Plan')+'</b> · '+esc((gp.development_plan.status||'active'))+'</p>':'')
   +'</div>';

  var tasks=arr(gp.tasks),filtered=UI.typeFilter?tasks.filter(function(t){return (t.metadata&&t.metadata.task_type)===UI.typeFilter;}):tasks;
  var completed=tasks.filter(function(t){return t.status==='completed';}).length;
  var pct=tasks.length?Math.round(completed/tasks.length*100):0;
  h+='<div class="v155-card"><header><div><small>TASK SCHEDULE</small><h2>'+pct+'% complete</h2><p>'+completed+' of '+tasks.length+' tasks done</p></div><div class="cvygp-actions">'+(UI.addOpen?'':'<button type="button" class="v152-btn primary" onclick="CAVYRE_SMART_GAMEPLAN.toggleAdd()">+ Add Task</button>')+'</div></header>'
   +(UI.addOpen?addTaskForm(model,doc):'')
   +'<div class="cvygp-filters">'
   +'<button type="button" class="cvygp-chip '+(UI.typeFilter?'':'on')+'" onclick="CAVYRE_SMART_GAMEPLAN.setFilter(\'\')">All</button>'
   +TASK_TYPES.map(function(t){return '<button type="button" class="cvygp-chip '+(UI.typeFilter===t[0]?'on':'')+'" onclick="CAVYRE_SMART_GAMEPLAN.setFilter(\''+t[0]+'\')">'+esc(t[1])+'</button>';}).join('')
   +'</div>'
   +'<div class="cvygp-tbl-wrap"><table><thead><tr><th>Date</th><th>Type</th><th>Task</th><th>Status</th><th></th></tr></thead><tbody>'
   +(filtered.length?filtered.map(function(t){return taskRow(t,model,doc);}).join(''):'<tr><td colspan="5" class="v155-empty">No tasks yet.</td></tr>')
   +'</tbody></table></div></div>';

  var travel=arr(gp.travel),visa=arr(gp.visa);
  if(travel.length||visa.length){
    h+='<div class="v155-card"><header><div><small>VISA & TRAVEL</small><h2>Key dates</h2></div></header>'
     +(visa.length?'<ul class="cvygp-list">'+visa.map(function(v){return '<li><b>'+esc(v.visa_type||v.case_type||'Visa case')+'</b> · '+esc(v.status||'')+(v.hard_deadline?' · hard deadline '+fmtDate(v.hard_deadline):'')+(v.appointment_at?' · appointment '+fmtDateTime(v.appointment_at):'')+'</li>';}).join('')+'</ul>':'')
     +(travel.length?'<ul class="cvygp-list">'+travel.map(function(tr){return '<li><b>'+esc([tr.origin,tr.destination].filter(Boolean).join(' → ')||tr.purpose||'Travel')+'</b> · '+fmtDate(tr.starts_at?String(tr.starts_at).slice(0,10):null)+' → '+fmtDate(tr.ends_at?String(tr.ends_at).slice(0,10):null)+' · '+esc(tr.status||'')+'</li>';}).join('')+'</ul>':'')
     +'</div>';
  }
  return h;
}
function arr(v){return Array.isArray(v)?v:[];}

window.CAVYRE_SMART_GAMEPLAN={
  version:'16.12.100',
  render:render,
  toggleSettings:function(){UI.settingsOpen=!UI.settingsOpen;refresh();},
  toggleAdd:function(){UI.addOpen=!UI.addOpen;refresh();},
  setFilter:function(t){UI.typeFilter=t||'';refresh();},
  cancelEdit:function(){UI.editingTaskId=null;refresh();},
  editTask:function(id){UI.editingTaskId=id;refresh();},
  saveSettings:async function(modelId){
    try{
      var focusRaw=val('cvygp-cadence-focus')||'';
      var cadence={interval_days:Number(val('cvygp-cadence-interval'))||2,time_local:val('cvygp-cadence-time')||null,timezone:val('cvygp-cadence-tz')||null,start_date:val('cvygp-cadence-start')||null,end_date:val('cvygp-cadence-end')||null,focus_labels:focusRaw.split(',').map(function(s){return s.trim();}).filter(Boolean)};
      var title=val('cvygp-title');if(!title){alert('A title is required.');return;}
      await post({action:'save_gameplan',model_id:modelId,title:title,key_date:val('cvygp-keydate')||null,key_date_label:val('cvygp-keydatelabel')||null,welcome_message:val('cvygp-welcome')||null,brand_positioning:val('cvygp-brand')||null,market_focus:val('cvygp-market')||null,image_rules:val('cvygp-rules')||null,risks:val('cvygp-risks')||null,checkin_cadence:cadence});
      UI.settingsOpen=false;toast('✓ Gameplan saved');refresh();
    }catch(e){alert(e.message||e);}
  },
  createTask:async function(modelId,gameplanId){
    try{
      var title=val('cvygp-t-title');if(!title){alert('A title is required.');return;}
      await post({action:'create_task',model_id:modelId,gameplan_id:gameplanId,title:title,description:val('cvygp-t-desc')||null,task_type:val('cvygp-t-type'),due_at:val('cvygp-t-date')||null,is_hard_stop:checked('cvygp-t-hard')});
      UI.addOpen=false;toast('✓ Task added');refresh();
    }catch(e){alert(e.message||e);}
  },
  saveTask:async function(taskId){
    try{
      await post({action:'update_task',task_id:taskId,title:val('cvygp-e-title'),description:val('cvygp-e-desc')||null,task_type:val('cvygp-e-type'),due_at:val('cvygp-e-date')||null,status:val('cvygp-e-status'),is_hard_stop:checked('cvygp-e-hard')});
      UI.editingTaskId=null;toast('✓ Task updated');refresh();
    }catch(e){alert(e.message||e);}
  },
  decideReschedule:async function(taskId,decision){
    try{await post({action:'decide_reschedule',task_id:taskId,decision:decision});toast(decision==='approve'?'✓ New date applied':'Reschedule request denied');refresh();}catch(e){alert(e.message||e);}
  }
};
})();
