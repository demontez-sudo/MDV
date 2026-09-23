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

function heroBlock(gp,model){
  if(!gp)return '';
  var days=null;
  if(gp.key_date){try{var today=new Date();today.setHours(12,0,0,0);var target=new Date(String(gp.key_date).slice(0,10)+'T12:00:00');days=Math.ceil((target-today)/86400000);}catch(e){}}
  var countLabel=days!=null&&days>0?String(days):'—';
  return '<header class="cvymg-hero"><p class="cvymg-hello">Your gameplan,</p><h1 class="cvymg-name">'+esc((model&&model.display_name)||'')+'</h1>'
   +(gp.key_date?'<div class="cvymg-count"><div class="cvymg-count-v">'+countLabel+'</div><p>'+esc(gp.key_date_label||('until '+fmtDate(gp.key_date)))+(days!=null&&days<=0?' — that date has arrived.':'')+'</p></div>':'')
   +'</header>';
}

function statCard(measurements){
  var m=measurements||{};
  var rows=[['Height',m.height_display],['Bust/Chest',m.bust_display||m.chest_display],['Waist',m.waist_display],['Hips',m.hips_display],['Shoe',m.shoe],['Eyes',m.eyes],['Hair',m.hair]].filter(function(x){return x[1];});
  if(!rows.length)return '';
  return '<div class="cvymg-card"><p class="cvymg-label">Your card</p><dl class="cvymg-dl">'+rows.map(function(r){return '<dt>'+esc(r[0])+'</dt><dd>'+esc(r[1])+'</dd>';}).join('')+'</dl></div>';
}

function todoSection(tasks){
  var sorted=tasks.slice().sort(function(a,b){return String(a.due_at||'9999').localeCompare(String(b.due_at||'9999'));});
  var completed=sorted.filter(function(t){return t.status==='completed';}).length;
  var pct=sorted.length?Math.round(completed/sorted.length*100):0;
  var h='<section class="cvymg-section"><p class="cvymg-label">Your to-do list</p><h2>What you do, and when.</h2>'
   +'<div class="cvymg-progress"><span class="cvymg-pct">'+pct+'%</span><div class="cvymg-bar"><i style="width:'+pct+'%"></i></div></div>';
  var month='';
  sorted.forEach(function(t){
    var mm=t.due_at?fmtMonth(t.due_at):'No date';
    if(mm!==month){month=mm;h+='<div class="cvymg-month">'+esc(mm)+'</div>';}
    var done=t.status==='completed';
    var pending=t.reschedule_status==='pending';
    h+='<div class="cvymg-todo '+(done?'done':'')+(t.is_hard_stop?' key':'')+'">'
     +'<input type="checkbox" '+(done?'checked':'')+(done?' disabled':' onchange="CAVYRE_MODEL_GAMEPLAN.complete(\''+t.id+'\')"')+'>'
     +'<span class="cvymg-dt">'+fmtDate(t.due_at,{weekday:'short',day:'numeric',month:'short'})+'</span>'
     +'<span class="cvymg-tx">'+esc(t.title||'')+(t.description?'<small>'+esc(t.description)+'</small>':'')
     +(pending?'<small class="cvymg-pending">Reschedule to '+fmtDate(t.reschedule_requested_date)+' requested — waiting on your agent.</small>':(done?'':'<button type="button" class="cvymg-linkbtn" onclick="CAVYRE_MODEL_GAMEPLAN.openReschedule(\''+t.id+'\')">Request a new time</button>'))
     +'</span></div>';
    if(STATE.reschedulingTaskId===t.id){
      h+='<div class="cvymg-reschedule-form"><label>New date<input type="date" id="cvymg-rs-date"></label><label>Note (optional)<input type="text" id="cvymg-rs-note" placeholder="Why you need a new time"></label><div><button type="button" class="cvymg-btn" onclick="CAVYRE_MODEL_GAMEPLAN.cancelReschedule()">Cancel</button><button type="button" class="cvymg-btn primary" onclick="CAVYRE_MODEL_GAMEPLAN.submitReschedule(\''+t.id+'\')">Send Request</button></div></div>';
    }
  });
  if(!sorted.length)h+='<div class="cvymg-empty">No tasks yet.</div>';
  h+='</section>';
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

function ruleSection(text,label,heading){
  if(!text)return '';
  return '<section class="cvymg-section"><p class="cvymg-label">'+esc(label)+'</p><h2>'+esc(heading)+'</h2><div class="cvymg-prose">'+esc(text).split(/\n{2,}/).map(function(p){return '<p>'+p.replace(/\n/g,'<br>')+'</p>';}).join('')+'</div></section>';
}

function teamSection(contact){
  if(!contact)return '';
  return '<section class="cvymg-section"><p class="cvymg-label">Your team</p><h2>Who to call.</h2><div class="cvymg-team"><div class="cvymg-tm"><div class="cvymg-tm-nm">'+esc(contact.name||'Your agent')+'</div>'+(contact.email?'<div class="cvymg-tm-rl">'+esc(contact.email)+'</div>':'')+(contact.phone?'<p>'+esc(contact.phone)+'</p>':'')+'</div></div></section>';
}

function render(){
  var d=STATE.data||{},gp=d.gameplan,model=(window.VEUX_MODEL.getBoot()||{}).model||{};
  if(!gp)return page('<div class="cvymg-empty">Your agent hasn\'t published a gameplan yet.</div>');
  return page(
    heroBlock(gp,model)
    +'<div class="cvymg-two">'+ruleSection(gp.welcome_message,'Welcome to the board','A note from your agency')+statCard((window.VEUX_MODEL.getBoot()||{}).measurements)+'</div>'
    +ruleSection(gp.image_rules,'Your look','Image and grooming rules')
    +todoSection(arr(d.tasks))
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
