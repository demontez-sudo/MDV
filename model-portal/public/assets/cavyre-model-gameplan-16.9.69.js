/* CAVYRE 16.9.69 — Smart Gameplan (model-facing "Your Gameplan" page). Card-row layout. */
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
function when(v){if(!v)return null;var d=new Date(v);return isNaN(d)?null:d;}
function startOfToday(){var t=new Date();t.setHours(0,0,0,0);return t;}
function timeOf(v){var s=String(v||'');if(s.length<=10)return '';var d=when(v);return d?d.toLocaleTimeString([],{hour:'numeric',minute:'2-digit'}):'';}
function nl2p(text){return esc(text).split(/\n{2,}/).map(function(p){return '<p>'+p.replace(/\n/g,'<br>')+'</p>';}).join('');}

var ICON={
  cal:'<path d="M7 3v3M17 3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z"/>',
  star:'<path d="M12 3c.6 4.6 2.4 6.4 7 7-4.6.6-6.4 2.4-7 7-.6-4.6-2.4-6.4-7-7 4.6-.6 6.4-2.4 7-7z"/>',
  eye:'<path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  clap:'<path d="M4 9h16v10a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V9zM4 9l2-4 3 1-2 4M10 6.5l3 1-2 3.5M15 8l3 1-2 3.5"/>',
  check:'<circle cx="12" cy="12" r="9"/><path d="m8 12.5 3 3 5-6"/>',
  plane:'<path d="M3 13l18-8-6 16-3-7-9-1z"/>',
  pulse:'<path d="M3 12h4l2-6 4 12 2-6h6"/>',
  team:'<circle cx="9" cy="8" r="3.2"/><path d="M3 20c.4-3.6 2.9-5.5 6-5.5s5.6 1.9 6 5.5M16 5.2a3 3 0 0 1 0 5.6M18 14.8c1.8.6 3 2.2 3.3 5.2"/>'
};
function icon(name){return '<span class="cvymg-ic"><svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+ICON[name]+'</svg></span>';}
function vmark(){return '<svg viewBox="0 0 40 36" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 3l17 30L37 3M11 3l9 16 9-16"/></svg>';}
function row(ic,body,aside,cls){return '<section class="cvymg-row '+(cls||'')+'">'+icon(ic)+'<div class="cvymg-row-body">'+body+'</div>'+(aside?'<div class="cvymg-row-aside">'+aside+'</div>':'')+'</section>';}

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

function heroBlock(gp,model){
  var days=null;
  if(gp.key_date){try{var today=new Date();today.setHours(12,0,0,0);var target=new Date(String(gp.key_date).slice(0,10)+'T12:00:00');days=Math.ceil((target-today)/86400000);}catch(e){}}
  var label=gp.key_date_label||(gp.key_date?'until '+fmtDate(gp.key_date):'');
  return '<header class="cvymg-hero"><div class="cvymg-hero-main"><p class="cvymg-eyebrow">Your gameplan</p><h1 class="cvymg-name">'+esc((model&&model.display_name)||'')+'</h1>'
   +(gp.key_date?'<div class="cvymg-pill"><b>'+(days!=null&&days>0?days:0)+'</b><i></i><span>'+esc(label)+'</span></div>':'')
   +'<p class="cvymg-hero-line">'+icon('cal').replace('cvymg-ic','cvymg-ic bare')+'<span>'+(days!=null&&days>0?(days===1?'1 day to go':days+' days to go')+(gp.key_date?' · '+esc(fmtDate(gp.key_date,{weekday:'short',month:'short',day:'numeric',year:'numeric'})):''):'Welcome to the board')+'</span></p></div>'
   +'<div class="cvymg-hero-art" aria-hidden="true">'+vmark()+'</div></header>';
}

function agentAside(contact){
  var name=(contact&&contact.name)||'';
  return '<div class="cvymg-sign"><span class="cvymg-script">Your Agent</span><b>'+esc(name||'Your agent')+'</b></div>';
}

function lookRow(m,rules){
  m=m||{};
  var rows=[['Height',m.height_display],['Bust/Chest',m.bust_display||m.chest_display],['Waist',m.waist_display],['Hips',m.hips_display],['Shoe',m.shoe],['Eyes',m.eyes],['Hair',m.hair]].filter(function(x){return x[1];});
  if(!rows.length)return '';
  return row('eye','<h2>Your look</h2><div class="cvymg-chips">'+rows.map(function(r){return '<span class="cvymg-tag"><small>'+esc(r[0])+'</small>'+esc(r[1])+'</span>';}).join('')+'</div>');
}

function rulesRow(text){
  if(!text)return '';
  return row('clap','<h2>Image and grooming rules</h2><div class="cvymg-prose">'+nl2p(text)+'</div><a class="cvymg-jump" href="#cvymg-todo" onclick="var e=document.getElementById(\'cvymg-todo\');if(e){e.scrollIntoView({behavior:\'smooth\',block:\'start\'});}return false;">Your to-do list →</a>',
   '<div class="cvymg-ready">'+vmark()+'<span>Stay ready</span></div>','has-ready');
}

function rescheduleForm(id){
  return '<div class="cvymg-reschedule-form"><label>New date<input type="date" id="cvymg-rs-date"></label><label class="grow">Note (optional)<input type="text" id="cvymg-rs-note" placeholder="Why you need a new time"></label><div class="cvymg-actions"><button type="button" class="cvymg-btn" onclick="CAVYRE_MODEL_GAMEPLAN.cancelReschedule()">Cancel</button><button type="button" class="cvymg-btn primary" onclick="CAVYRE_MODEL_GAMEPLAN.submitReschedule(\''+id+'\')">Send request</button></div></div>';
}

function todoRow(tasks){
  var sorted=tasks.slice().sort(function(a,b){return String(a.due_at||'9999').localeCompare(String(b.due_at||'9999'));});
  var t0=startOfToday(),wk=new Date(t0.getTime()+7*86400000);
  var total=sorted.length,done=sorted.filter(function(t){return t.status==='completed';}).length,pct=total?Math.round(done/total*100):0;
  var open=sorted.filter(function(t){return t.status!=='completed';});
  var overdue=open.filter(function(t){var d=when(t.due_at);return d&&d<t0;}).length;
  var week=open.filter(function(t){var d=when(t.due_at);return d&&d>=t0&&d<wk;}).length;
  var head='<h2 id="cvymg-todo">What you do, and when.</h2>'
   +'<div class="cvymg-progress"><span class="cvymg-pct">'+pct+'%</span><div class="cvymg-bar"><i style="width:'+pct+'%"></i></div><span class="cvymg-count-t">'+done+' of '+total+'</span></div>';
  var h='',month='';
  sorted.forEach(function(t){
    var mm=t.due_at?fmtMonth(t.due_at):'No date';
    if(mm!==month){month=mm;h+='<div class="cvymg-month"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">'+ICON.cal+'</svg>'+esc(mm)+'</div>';}
    var isDone=t.status==='completed',pending=t.reschedule_status==='pending',d=when(t.due_at),late=!isDone&&d&&d<t0;
    var dt=d?d.toLocaleDateString([],{weekday:'short',month:'short',day:'numeric'}):'No date';
    h+='<div class="cvymg-todo'+(isDone?' done':'')+(late?' late':'')+(t.is_hard_stop&&!isDone?' key':'')+'">'
     +(isDone?'<span class="cvymg-box on" aria-label="Completed">✓</span>':'<button type="button" class="cvymg-box" aria-label="Mark complete" title="Mark complete" onclick="CAVYRE_MODEL_GAMEPLAN.complete(\''+t.id+'\')"></button>')
     +'<div class="cvymg-tx"><div class="cvymg-line"><span class="cvymg-dt">'+esc(dt)+'</span><b>'+esc(t.title||'')+'</b>'
     +(timeOf(t.due_at)?'<span class="cvymg-time">'+esc(timeOf(t.due_at))+'</span>':'')
     +(late?'<span class="cvymg-chip bad">Overdue</span>':'')+(t.is_hard_stop&&!isDone?'<span class="cvymg-chip key">Must happen</span>':'')+(pending?'<span class="cvymg-chip gold">New time requested</span>':'')+'</div>'
     +(t.description?'<details class="cvymg-more"><summary><span class="cvymg-desc">'+esc(t.description)+'</span></summary><p>'+esc(t.description)+'</p></details>':'')
     +(pending?'<p class="cvymg-pending">Asked for '+esc(fmtDate(t.reschedule_requested_date))+'. Waiting on your agent.</p>':'')
     +(STATE.reschedulingTaskId===t.id?rescheduleForm(t.id):'')
     +'</div>'
     +((isDone||pending)?'':'<button type="button" class="cvymg-pillbtn" onclick="CAVYRE_MODEL_GAMEPLAN.openReschedule(\''+t.id+'\')"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">'+ICON.cal+'</svg>New time</button>')
     +'</div>';
  });
  if(!sorted.length)h='<div class="cvymg-empty">No tasks yet.</div>';
  var aside='<div class="cvymg-sumchips"><span class="cvymg-chip">'+week+' due this week</span>'+(overdue?'<span class="cvymg-chip bad">'+overdue+' overdue</span>':'')+'</div>';
  return row('check',head+h,aside,'todo-row');
}

function visaRow(mobility){
  var travel=arr(mobility&&mobility.travel),visa=arr(mobility&&mobility.visa_cases);
  if(!travel.length&&!visa.length)return '';
  return row('plane','<h2>Visa and travel</h2><p class="cvymg-sub">Key dates.</p><div class="cvymg-two">'
   +(visa.length?'<div><h3>Visa</h3><ul class="cvymg-list">'+visa.map(function(v){return '<li><b>'+esc(v.visa_type||v.case_type||'Visa')+'</b> · '+esc(v.status||'')+(v.hard_deadline?'<br>Hard deadline: '+fmtDate(v.hard_deadline):'')+(v.appointment_at?'<br>Appointment: '+fmtDate(v.appointment_at):'')+'</li>';}).join('')+'</ul></div>':'')
   +(travel.length?'<div><h3>Travel</h3><ul class="cvymg-list">'+travel.map(function(t){return '<li><b>'+esc([t.origin,t.destination].filter(Boolean).join(' → ')||t.purpose||'Trip')+'</b><br>'+fmtDate(t.starts_at)+' → '+fmtDate(t.ends_at)+' · '+esc(t.status||'')+'</li>';}).join('')+'</ul></div>':'')
   +'</div>');
}

function checkinRow(cadence){
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
  return row('pulse','<h2>Agent check-ins</h2><p class="cvymg-sub">Every '+esc(cadence.interval_days)+' days'+(cadence.time_local?', '+esc(cadence.time_local):'')+(cadence.timezone?' '+esc(cadence.timezone):'')+'.</p>'
   +(next?'<div class="cvymg-next"><b>Next check-in: '+esc(next.date.toLocaleDateString([],{weekday:'long',day:'numeric',month:'long'}))+'</b>Focus: '+esc(next.focus)+'</div>':'')
   +'<div class="cvymg-cal">'+cells+'</div>');
}

function teamRow(contact){
  if(!contact)return '';
  return row('team','<h2>Your team</h2><p class="cvymg-sub">Who to call.</p><div class="cvymg-tm"><div class="cvymg-tm-nm">'+esc(contact.name||'Your agent')+'</div>'+(contact.email?'<div class="cvymg-tm-rl">'+esc(contact.email)+'</div>':'')+(contact.phone?'<p>'+esc(contact.phone)+'</p>':'')+'</div>');
}

function render(){
  var d=STATE.data||{},gp=d.gameplan,boot=window.VEUX_MODEL.getBoot()||{},model=boot.model||{},tasks=arr(d.tasks);
  if(!gp)return page('<div class="cvymg-empty">Your agent hasn\'t published a gameplan yet.</div>');
  return page(
    heroBlock(gp,model)
    +(gp.welcome_message?row('star','<h2>A note from your agency</h2><div class="cvymg-prose">'+nl2p(gp.welcome_message)+'</div>',agentAside(d.agent_contact),'has-sign'):'')
    +lookRow(boot.measurements)
    +rulesRow(gp.image_rules)
    +todoRow(tasks)
    +visaRow(d.mobility)
    +checkinRow(gp.checkin_cadence)
    +(gp.welcome_message?'':teamRow(d.agent_contact))
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
