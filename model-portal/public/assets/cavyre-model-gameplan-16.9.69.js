/* CAVYRE 16.9.69 — Smart Gameplan (model-facing "Your Gameplan" page). */
(function(){
'use strict';
if(window.__CAVYRE_MODEL_GAMEPLAN_16969__)return;window.__CAVYRE_MODEL_GAMEPLAN_16969__=1;

var STATE={data:null,loading:false,error:null,reschedulingTaskId:null};

function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
function arr(v){return Array.isArray(v)?v:[];}
function fmtDate(v,opts){if(!v)return '—';try{return new Date(String(v).slice(0,10)+'T12:00:00').toLocaleDateString([],opts||{month:'short',day:'numeric',year:'numeric'});}catch(e){return String(v);}}
function fmtMonth(v){return fmtDate(v,{month:'long',year:'numeric'});}
function toast(v){try{if(window.toast)return window.toast(v);}catch(e){}console.log(v);}
function val(id){var el=document.getElementById(id);return el?el.value:'';}

async function load(container){
  STATE.loading=true;STATE.error=null;
  container.innerHTML=page('<div class="cvymg-empty">Loading your gameplan…</div>');
  try{
    var out=await window.VEUX_MODEL.api('/api/model/gameplan',{method:'GET',headers:{}});
    STATE.data=out;STATE.loading=false;
    container.innerHTML=render();
  }catch(e){
    STATE.loading=false;STATE.error=e&&e.message||String(e);
    container.innerHTML=page('<div class="cvymg-empty">Could not load your gameplan: '+esc(STATE.error)+'</div>');
  }
}

function page(inner){return '<div class="v15m-page cvymg-wrap">'+inner+'</div>';}

function when(v){if(!v)return null;var d=new Date(v);return isNaN(d)?null:d;}
function dayKey(d){return d.getFullYear()+'-'+(d.getMonth()+1)+'-'+d.getDate();}
function startOfToday(){var t=new Date();t.setHours(0,0,0,0);return t;}
function timeOf(v){var s=String(v||'');if(s.length<=10)return '';var d=when(v);return d?d.toLocaleTimeString([],{hour:'numeric',minute:'2-digit'}):'';}
function nl2p(text){return esc(text).split(/\n{2,}/).map(function(p){return '<p>'+p.replace(/\n/g,'<br>')+'</p>';}).join('');}

function heroBlock(gp,model,tasks){
  if(!gp)return '';
  var days=null;
  if(gp.key_date){try{var today=new Date();today.setHours(12,0,0,0);var target=new Date(String(gp.key_date).slice(0,10)+'T12:00:00');days=Math.ceil((target-today)/86400000);}catch(e){}}
  var label=gp.key_date_label||(gp.key_date?'until '+fmtDate(gp.key_date):'');
  var first=String((model&&model.display_name)||'').trim();
  return '<header class="cvymg-hero"><div class="cvymg-hero-main"><p class="cvymg-hello">Your 90-day gameplan</p><h1 class="cvymg-name">'+esc(first)+'</h1>'
   +(gp.key_date?'<p class="cvymg-sub">'+esc(label)+'</p>':'')+'</div>'
   +(gp.key_date?'<div class="cvymg-count"><div class="cvymg-count-v">'+(days!=null&&days>0?days:'0')+'</div><div class="cvymg-count-l"><b>'+(days!=null&&days>0?(days===1?'day to go':'days to go'):'Today')+'</b><span>'+esc(fmtDate(gp.key_date,{weekday:'short',month:'short',day:'numeric',year:'numeric'}))+'</span></div></div>':'')
   +'</header>';
}

function summaryStrip(tasks){
  var total=tasks.length,done=tasks.filter(function(t){return t.status==='completed';}).length;
  var open=tasks.filter(function(t){return t.status!=='completed';});
  var t0=startOfToday(),wk=new Date(t0.getTime()+7*86400000);
  var overdue=open.filter(function(t){var d=when(t.due_at);return d&&d<t0;}).length;
  var week=open.filter(function(t){var d=when(t.due_at);return d&&d>=t0&&d<wk;}).length;
  var pct=total?Math.round(done/total*100):0;
  var C=2*Math.PI*26,off=C*(1-pct/100);
  return '<div class="cvymg-strip">'
   +'<div class="cvymg-stat cvymg-ringstat"><svg viewBox="0 0 64 64" width="64" height="64" aria-hidden="true"><circle cx="32" cy="32" r="26" class="cvymg-ring-bg"/><circle cx="32" cy="32" r="26" class="cvymg-ring-fg" stroke-dasharray="'+C.toFixed(1)+'" stroke-dashoffset="'+off.toFixed(1)+'" transform="rotate(-90 32 32)"/></svg><div><b>'+pct+'%</b><span>'+done+' of '+total+' done</span></div></div>'
   +'<div class="cvymg-stat"><b>'+week+'</b><span>Due in the next 7 days</span></div>'
   +'<div class="cvymg-stat'+(overdue?' warn':'')+'"><b>'+overdue+'</b><span>'+(overdue?'Overdue':'Nothing overdue')+'</span></div>'
   +'</div>';
}

function dateBlock(v){
  var d=when(v);if(!d)return '<div class="cvymg-date none"><b>—</b><span>No date</span></div>';
  return '<div class="cvymg-date"><span>'+esc(d.toLocaleDateString([],{weekday:'short'}))+'</span><b>'+d.getDate()+'</b><span>'+esc(d.toLocaleDateString([],{month:'short'}))+'</span></div>';
}

function nextUp(tasks){
  var open=tasks.filter(function(t){return t.status!=='completed';}).sort(function(a,b){return String(a.due_at||'9999').localeCompare(String(b.due_at||'9999'));});
  var t=open[0];if(!t)return tasks.length?'<div class="cvymg-next done"><b>All caught up.</b><span>Everything on your list is done. Nice work.</span></div>':'';
  var d=when(t.due_at),late=d&&d<startOfToday(),pending=t.reschedule_status==='pending';
  return '<section class="cvymg-focus"><p class="cvymg-label">Do this next</p><div class="cvymg-focus-card">'+dateBlock(t.due_at)
   +'<div class="cvymg-focus-body"><h2>'+esc(t.title||'')+'</h2>'
   +'<p class="cvymg-meta">'+(late?'<span class="cvymg-chip bad">Overdue</span>':'')+(t.is_hard_stop?'<span class="cvymg-chip key">Must happen</span>':'')+(d?'<span>'+esc(d.toLocaleDateString([],{weekday:'long',month:'long',day:'numeric'}))+(timeOf(t.due_at)?' · '+esc(timeOf(t.due_at)):'')+'</span>':'')+'</p>'
   +(t.description?'<p class="cvymg-focus-desc">'+esc(t.description)+'</p>':'')
   +'<div class="cvymg-actions"><button type="button" class="cvymg-btn primary" onclick="CAVYRE_MODEL_GAMEPLAN.complete(\''+t.id+'\')">Mark complete</button>'
   +(pending?'<span class="cvymg-chip gold">New time requested</span>':'<button type="button" class="cvymg-btn" onclick="CAVYRE_MODEL_GAMEPLAN.openReschedule(\''+t.id+'\')">Request a new time</button>')+'</div>'
   +(STATE.reschedulingTaskId===t.id?rescheduleForm(t.id):'')
   +'</div></div></section>';
}

function rescheduleForm(id){
  return '<div class="cvymg-reschedule-form"><label>New date<input type="date" id="cvymg-rs-date"></label><label class="grow">Note (optional)<input type="text" id="cvymg-rs-note" placeholder="Why you need a new time"></label><div class="cvymg-actions"><button type="button" class="cvymg-btn" onclick="CAVYRE_MODEL_GAMEPLAN.cancelReschedule()">Cancel</button><button type="button" class="cvymg-btn primary" onclick="CAVYRE_MODEL_GAMEPLAN.submitReschedule(\''+id+'\')">Send request</button></div></div>';
}

function statCard(measurements){
  var m=measurements||{};
  var rows=[['Height',m.height_display],['Bust/Chest',m.bust_display||m.chest_display],['Waist',m.waist_display],['Hips',m.hips_display],['Shoe',m.shoe],['Eyes',m.eyes],['Hair',m.hair]].filter(function(x){return x[1];});
  if(!rows.length)return '';
  return '<div class="cvymg-card"><p class="cvymg-label">Your card</p><dl class="cvymg-dl">'+rows.map(function(r){return '<dt>'+esc(r[0])+'</dt><dd>'+esc(r[1])+'</dd>';}).join('')+'</dl></div>';
}

function todoSection(tasks){
  var sorted=tasks.slice().sort(function(a,b){return String(a.due_at||'9999').localeCompare(String(b.due_at||'9999'));});
  var t0=startOfToday();
  var h='<section class="cvymg-section"><p class="cvymg-label">Your to-do list</p><h2>What you do, and when.</h2><div class="cvymg-tl">';
  var month='',counts={};
  sorted.forEach(function(t){var mm=t.due_at?fmtMonth(t.due_at):'No date';counts[mm]=counts[mm]||{n:0,d:0};counts[mm].n++;if(t.status==='completed')counts[mm].d++;});
  sorted.forEach(function(t){
    var mm=t.due_at?fmtMonth(t.due_at):'No date';
    if(mm!==month){month=mm;h+='<div class="cvymg-month"><span>'+esc(mm)+'</span><small>'+counts[mm].d+'/'+counts[mm].n+' done</small></div>';}
    var done=t.status==='completed',pending=t.reschedule_status==='pending',d=when(t.due_at),late=!done&&d&&d<t0;
    h+='<article class="cvymg-todo'+(done?' done':'')+(t.is_hard_stop?' key':'')+(late?' late':'')+'">'
     +dateBlock(t.due_at)
     +'<div class="cvymg-tx"><h3>'+esc(t.title||'')+'</h3>'
     +'<p class="cvymg-meta">'+(done?'<span class="cvymg-chip good">Done</span>':'')+(late?'<span class="cvymg-chip bad">Overdue</span>':'')+(t.is_hard_stop&&!done?'<span class="cvymg-chip key">Must happen</span>':'')+(pending?'<span class="cvymg-chip gold">New time requested</span>':'')+(timeOf(t.due_at)?'<span>'+esc(timeOf(t.due_at))+'</span>':'')+'</p>'
     +(t.description?'<details class="cvymg-more"><summary>Details</summary><p>'+esc(t.description)+'</p></details>':'')
     +(pending?'<p class="cvymg-pending">Asked for '+esc(fmtDate(t.reschedule_requested_date))+'. Waiting on your agent.</p>':'')
     +(STATE.reschedulingTaskId===t.id?rescheduleForm(t.id):'')
     +'</div>'
     +(done?'<span class="cvymg-tick" aria-label="Completed">✓</span>':'<div class="cvymg-row-actions"><button type="button" class="cvymg-btn small primary" onclick="CAVYRE_MODEL_GAMEPLAN.complete(\''+t.id+'\')">Complete</button>'+(pending?'':'<button type="button" class="cvymg-btn small" onclick="CAVYRE_MODEL_GAMEPLAN.openReschedule(\''+t.id+'\')">New time</button>')+'</div>')
     +'</article>';
  });
  if(!sorted.length)h+='<div class="cvymg-empty">No tasks yet.</div>';
  h+='</div></section>';
  return h;
}

function visaSection(mobility){
  var travel=arr(mobility&&mobility.travel),visa=arr(mobility&&mobility.visa_cases);
  if(!travel.length&&!visa.length)return '';
  return '<section class="cvymg-section"><p class="cvymg-label">Visa and travel</p><h2>Key dates.</h2><div class="cvymg-two">'
   +(visa.length?'<div><h3>Visa</h3><ul class="cvymg-list">'+visa.map(function(v){return '<li><b>'+esc(v.visa_type||v.case_type||'Visa')+'</b> · '+esc(v.status||'')+(v.hard_deadline?'<br>Hard deadline: '+fmtDate(v.hard_deadline):'')+(v.appointment_at?'<br>Appointment: '+fmtDate(v.appointment_at):'')+'</li>';}).join('')+'</ul></div>':'')
   +(travel.length?'<div><h3>Travel</h3><ul class="cvymg-list">'+travel.map(function(t){return '<li><b>'+esc([t.origin,t.destination].filter(Boolean).join(' → ')||t.purpose||'Trip')+'</b><br>'+fmtDate(t.starts_at)+' → '+fmtDate(t.ends_at)+' · '+esc(t.status||'')+'</li>';}).join('')+'</ul></div>':'')
   +'</div></section>';
}

function checkinSection(cadence){
  if(!cadence||!cadence.interval_days||!cadence.start_date)return '';
  var focus=Array.isArray(cadence.focus_labels)&&cadence.focus_labels.length?cadence.focus_labels:['Develop','Pipeline','Brand'];
  var start=new Date(cadence.start_date+'T12:00:00'),end=cadence.end_date?new Date(cadence.end_date+'T12:00:00'):new Date(start.getTime()+90*86400000);
  var today=new Date();today.setHours(12,0,0,0);
  var cells='',i=0,month='',next=null,d=new Date(start.getTime());
  while(d<=end&&i<200){
    var mm=d.toLocaleDateString([],{month:'long',year:'numeric'});
    if(mm!==month){month=mm;cells+='<div class="cvymg-cal-mh">'+esc(mm)+'</div>';}
    if(!next&&d>=today)next={date:new Date(d.getTime()),focus:focus[i%focus.length]};
    cells+='<div class="cvymg-ci"><span class="cvymg-ci-dd">'+d.getDate()+'</span>'+d.toLocaleDateString([],{weekday:'short'})+'<br><span class="cvymg-ci-ag">'+esc(focus[i%focus.length])+'</span></div>';
    d.setDate(d.getDate()+Number(cadence.interval_days||2));i++;
  }
  return '<section class="cvymg-section"><p class="cvymg-label">Agent check-ins</p><h2>Every '+esc(cadence.interval_days)+' days'+(cadence.time_local?', '+esc(cadence.time_local):'')+(cadence.timezone?' '+esc(cadence.timezone):'')+'.</h2>'
   +(next?'<div class="cvymg-next"><b>Next check-in: '+esc(next.date.toLocaleDateString([],{weekday:'long',day:'numeric',month:'long'}))+'</b>Focus: '+esc(next.focus)+'</div>':'')
   +'<div class="cvymg-cal">'+cells+'</div></section>';
}

function ruleSection(text,label,heading,cls){
  if(!text)return '';
  return '<section class="cvymg-section cvymg-callout '+(cls||'')+'"><p class="cvymg-label">'+esc(label)+'</p><h2>'+esc(heading)+'</h2><div class="cvymg-prose">'+nl2p(text)+'</div></section>';
}

function teamSection(contact){
  if(!contact)return '';
  return '<section class="cvymg-section"><p class="cvymg-label">Your team</p><h2>Who to call.</h2><div class="cvymg-team"><div class="cvymg-tm"><div class="cvymg-tm-nm">'+esc(contact.name||'Your agent')+'</div>'+(contact.email?'<div class="cvymg-tm-rl">'+esc(contact.email)+'</div>':'')+(contact.phone?'<p>'+esc(contact.phone)+'</p>':'')+'</div></div></section>';
}

function render(){
  var d=STATE.data||{},gp=d.gameplan,boot=window.VEUX_MODEL.getBoot()||{},model=boot.model||{},tasks=arr(d.tasks);
  if(!gp)return page('<div class="cvymg-empty">Your agent hasn\'t published a gameplan yet.</div>');
  var card=statCard(boot.measurements);
  return page(
    heroBlock(gp,model,tasks)
    +summaryStrip(tasks)
    +nextUp(tasks)
    +'<div class="cvymg-two">'+ruleSection(gp.welcome_message,'Welcome to the board','A note from your agency')+card+'</div>'
    +ruleSection(gp.image_rules,'Your look','Image and grooming rules','look')
    +todoSection(tasks)
    +visaSection(d.mobility)
    +checkinSection(gp.checkin_cadence)
    +teamSection(d.agent_contact)
  );
}

window.CAVYRE_MODEL_GAMEPLAN={
  version:'16.9.69',
  render:function(el){load(el);return '';},
  complete:async function(taskId){
    try{await window.VEUX_MODEL.api('/api/portal/task-status',{method:'POST',body:JSON.stringify({portal:'model',organization_slug:'maison-de-veux',task_id:taskId,status:'completed'})});toast('✓ Marked complete');var c=document.querySelector('.cvymg-wrap');if(c)await load(c.parentElement||c);}catch(e){toast('Could not update: '+(e.message||e));}
  },
  openReschedule:function(taskId){STATE.reschedulingTaskId=taskId;var c=document.querySelector('.cvymg-wrap');if(c)c.parentElement.innerHTML=render();},
  cancelReschedule:function(){STATE.reschedulingTaskId=null;var c=document.querySelector('.cvymg-wrap');if(c)c.parentElement.innerHTML=render();},
  submitReschedule:async function(taskId){
    var date=val('cvymg-rs-date');if(!date){alert('Choose a date first.');return;}
    try{await window.VEUX_MODEL.api('/api/portal/task-reschedule',{method:'POST',body:JSON.stringify({portal:'model',organization_slug:'maison-de-veux',task_id:taskId,requested_date:date,note:val('cvymg-rs-note')||''})});toast('✓ Reschedule requested');STATE.reschedulingTaskId=null;var c=document.querySelector('.cvymg-wrap');if(c)await load(c.parentElement||c);}catch(e){toast('Could not send request: '+(e.message||e));}
  }
};
})();
