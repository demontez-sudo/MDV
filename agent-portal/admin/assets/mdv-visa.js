/* Visa Desk · Travel Clearance
   The Visa Desk is the gate for travel: a model can only be booked, confirmed or sent on a trip once
   their visa (or a recorded "not required"), and passport, are clear. This page turns the mobility data
   into a command view — lock board, Vera signals, model clearance cards, pipeline and a 60-day timeline —
   and reuses the existing visa / passport / trip forms for editing. Visa changes re-sync Travel + Calendar
   on the server (calendar events carry the lock state). */
(function(){
'use strict';
if(window.__MDV_VISA__)return;window.__MDV_VISA__=true;

var STEPS=['not_started','gathering_documents','appointment_pending','submitted','processing','approved'];
var LABEL={not_started:'Not started',gathering_documents:'Documents',appointment_pending:'Appointment',submitted:'Submitted',processing:'Processing',approved:'Approved',issued:'Issued',refused:'Refused',expired:'Expired',cancelled:'Cancelled'};
var NEXT={not_started:'gathering_documents',gathering_documents:'appointment_pending',appointment_pending:'submitted',submitted:'processing',processing:'approved'};
var S={d:null,loading:false,err:'',filter:'all',q:'',host:null,seq:0};

function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
function arr(v){return Array.isArray(v)?v:[];}
function bridge(){var b=window.VEUX_AGENT_V4;if(!b||!b.api)throw new Error('Secure session is not ready');return b;}
function org(){try{return bridge().state.org.slug||'maison-de-veux';}catch(e){return 'maison-de-veux';}}
function getMob(){return bridge().api('/api/agent/mobility?organization='+encodeURIComponent(org())+'&_t='+Date.now(),{method:'GET',headers:{},__fresh:true});}
function postMob(body){return bridge().api('/api/agent/mobility',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(Object.assign({organization_slug:org()},body))});}
function toast(m,t){var old=document.querySelector('.vsd-toast');if(old)old.remove();var d=document.createElement('div');d.className='vsd-toast '+(t||'');d.textContent=m;document.body.appendChild(d);setTimeout(function(){d.remove();},3600);}
function day(v){if(!v)return null;var s=String(v),d=new Date(/^\d{4}-\d{2}-\d{2}$/.test(s)?s+'T12:00:00':s);return isNaN(d)?null:d;}
function days(v){var d=day(v);if(!d)return null;var n=new Date();n.setHours(0,0,0,0);var x=new Date(d);x.setHours(0,0,0,0);return Math.round((x-n)/864e5);}
function fd(v,withYear){var d=day(v);return d?d.toLocaleDateString([],withYear?{month:'short',day:'numeric',year:'numeric'}:{month:'short',day:'numeric'}):'—';}
function ft(v){var d=day(v);return d?d.toLocaleTimeString([],{hour:'numeric',minute:'2-digit'}):'';}
function initials(n){return String(n||'?').split(/\s+/).map(function(x){return x[0];}).join('').slice(0,2).toUpperCase();}
function until(n){return n==null?'':n<0?Math.abs(n)+'d ago':n===0?'today':n===1?'tomorrow':'in '+n+'d';}
function isOpen(v){return !/^(approved|issued|refused|expired|cancelled)$/.test(String(v.status||'not_started'));}
function isGood(v){return /^(approved|issued)$/.test(String(v.status||''));}

/* ---------- derive the clearance model ---------- */
function passportFor(passports,modelId,ref){
  var act=arr(passports).filter(function(p){return String(p.model_id)===String(modelId)&&!/^(lost|cancelled)$/.test(String(p.status||''));});
  if(!act.length)return {state:'missing',p:null};
  var best=act.slice().sort(function(a,b){return String(b.expires_on||'9999-12-31').localeCompare(String(a.expires_on||'9999-12-31'));})[0];
  var exp=best.expires_on?String(best.expires_on).slice(0,10):null,refD=ref||new Date().toISOString().slice(0,10);
  if(exp&&exp<refD)return {state:'expired',p:best,expires:exp};
  if(exp){var six=new Date(refD+'T12:00:00');six.setMonth(six.getMonth()+6);if(exp<six.toISOString().slice(0,10))return {state:'expiring',p:best,expires:exp};}
  return {state:'ok',p:best,expires:exp};
}
function build(d){
  var models=arr(d.lookups&&d.lookups.models),mName={};models.forEach(function(m){mName[m.id]=m.display_name||'Model';});
  var visas=arr(d.visa_cases),passports=arr(d.passports),travel=arr(d.travel);
  var open=travel.filter(function(t){return !/^(completed|cancelled)$/.test(String(t.status||''));}).sort(function(a,b){return String(a.starts_at||'').localeCompare(String(b.starts_at||''));});
  var upcoming=open.filter(function(t){var n=days(t.ends_at||t.starts_at);return n==null||n>=-1;});
  var committed=function(t){return /^(booked|confirmed|in_progress)$/.test(String(t.status||''));};
  var rows=models.map(function(m){
    var mv=visas.filter(function(v){return String(v.model_id)===String(m.id);}),mt=upcoming.filter(function(t){return String(t.model_id)===String(m.id);});
    var pp=passportFor(passports,m.id),blocked=mt.filter(function(t){return t.visa_gate&&t.visa_gate.blocking;}),atRisk=blocked.filter(committed);
    var casesOpen=mv.filter(function(v){return isOpen(v)&&!(v.metadata&&v.metadata.waiver);}),cleared=mv.filter(function(v){return isGood(v);});
    var state=atRisk.length?'risk':blocked.length?'action':casesOpen.length?'progress':(mt.length||cleared.length)?'clear':'idle';
    return {m:m,name:m.display_name||'Model',visas:mv,trips:mt,pp:pp,blocked:blocked,atRisk:atRisk,casesOpen:casesOpen,cleared:cleared,state:state};
  });
  /* Vera signals */
  var sig=[];
  upcoming.forEach(function(t){
    var g=t.visa_gate||{},n=days(t.starts_at),who=mName[t.model_id]||'Model',route=[t.origin,t.destination].filter(Boolean).join(' → ')||t.destination||'trip';
    if(g.blocking&&committed(t))sig.push({sev:'critical',title:who+' is '+String(t.status).replace(/_/g,' ')+' to '+(t.destination||'travel')+' but cannot travel',text:g.message,act:[g.visa_case_id?['edit-visa','Open visa case',g.visa_case_id]:['new-visa','Start visa case',t.model_id,g.country_code],['edit-trip','Edit trip',t.id]],w:0});
    else if(g.blocking)sig.push({sev:n!=null&&n<=21?'critical':'warn',title:who+': travel to '+(t.destination||'destination')+' is locked'+(n!=null?' · departs '+until(n):''),text:g.message,act:[g.visa_case_id?['edit-visa','Open visa case',g.visa_case_id]:['new-visa','Start visa case',t.model_id,g.country_code],g.state==='none'&&g.country_code?['waive','Visa not required',t.model_id,g.country_code]:null].filter(Boolean),w:n!=null&&n<=21?1:3});
    else if(g.state==='none'&&g.country_code)sig.push({sev:'warn',title:who+': no visa decision recorded for '+g.country_code,text:'Trip '+route+' · '+fd(t.starts_at)+'. Start a case or record that no visa is needed.',act:[['new-visa','Start visa case',t.model_id,g.country_code],['waive','Visa not required',t.model_id,g.country_code]],w:4});
    if(g.passport&&g.passport.state==='expiring'&&!g.blocking)sig.push({sev:'warn',title:who+': passport has under 6 months left at departure',text:'Expires '+fd(g.passport.expires_on,true)+'. Many countries refuse entry inside 6 months.',act:[['new-passport','Update passport',t.model_id]],w:3});
    if(g.passport&&g.passport.state==='missing'&&g.state!=='domestic')sig.push({sev:'warn',title:who+': no passport on file',text:'Add the passport so travel can be cleared for '+route+'.',act:[['new-passport','Add passport',t.model_id]],w:3});
  });
  visas.forEach(function(v){
    var who=mName[v.model_id]||'Model',dl=days(v.hard_deadline),ap=days(v.appointment_at),ex=days(v.expires_on);
    if(v.metadata&&v.metadata.waiver)return;
    if(isOpen(v)&&dl!=null&&dl<=14)sig.push({sev:dl<0?'critical':'warn',title:who+' · '+(v.country_code||'')+' visa deadline '+(dl<0?'passed '+Math.abs(dl)+'d ago':until(dl)),text:'Status: '+(LABEL[v.status||'not_started']||v.status)+'. Hard deadline '+fd(v.hard_deadline)+'.',act:[['edit-visa','Open case',v.id]],w:1});
    if(isOpen(v)&&ap!=null&&ap>=0&&ap<=7)sig.push({sev:'info',title:who+' · '+(v.country_code||'')+' visa appointment '+until(ap),text:fd(v.appointment_at)+(ft(v.appointment_at)?' · '+ft(v.appointment_at):'')+(v.consulate?' · '+v.consulate:'')+'. It is on the calendar.',act:[['calendar','Open calendar'],['edit-visa','Open case',v.id]],w:5});
    if(isGood(v)&&ex!=null&&ex>=0&&ex<=60)sig.push({sev:'warn',title:who+' · '+(v.country_code||'')+' visa expires '+until(ex),text:'Valid to '+fd(v.expires_on,true)+'. Start renewal before trips beyond that date.',act:[['edit-visa','Open case',v.id]],w:4});
  });
  sig.sort(function(a,b){return a.w-b.w;});
  var kpi={cleared:rows.filter(function(r){return r.state==='clear';}).length,locked:upcoming.filter(function(t){return t.visa_gate&&t.visa_gate.blocking;}).length,risk:rows.filter(function(r){return r.state==='risk';}).length,open:visas.filter(function(v){return isOpen(v)&&!(v.metadata&&v.metadata.waiver);}).length,expiring:visas.filter(function(v){var x=days(v.expires_on);return isGood(v)&&x!=null&&x>=0&&x<=60;}).length};
  /* 60-day timeline */
  var tl=[];
  visas.forEach(function(v){var who=mName[v.model_id]||'Model';if(v.metadata&&v.metadata.waiver)return;
    if(isOpen(v)&&v.appointment_at){var a=days(v.appointment_at);if(a!=null&&a>=0&&a<=60)tl.push({at:v.appointment_at,k:'Appointment',t:who+' · '+(v.country_code||'')+' visa',id:v.id,type:'visa'});}
    if(isOpen(v)&&v.hard_deadline){var h=days(v.hard_deadline);if(h!=null&&h>=0&&h<=60)tl.push({at:v.hard_deadline,k:'Deadline',t:who+' · '+(v.country_code||'')+' visa',id:v.id,type:'visa'});}});
  upcoming.forEach(function(t){var n=days(t.starts_at);if(n!=null&&n>=0&&n<=60){var g=t.visa_gate||{};tl.push({at:t.starts_at,k:g.blocking?'Departure · locked':'Departure',t:(mName[t.model_id]||'Model')+' → '+(t.destination||'trip'),id:t.id,type:'trip',lock:!!g.blocking});}});
  tl.sort(function(a,b){return String(a.at).localeCompare(String(b.at));});
  return {rows:rows,upcoming:upcoming,sig:sig,kpi:kpi,tl:tl,mName:mName,visas:visas};
}

/* ---------- render ---------- */
function lockChip(g){
  if(!g)return '<span class="vsd-chip mute">Checking…</span>';
  if(g.blocking)return '<span class="vsd-chip lock" title="'+esc(g.message||'')+'">🔒 Locked</span>';
  if(g.state==='clear')return '<span class="vsd-chip ok" title="'+esc(g.message||'')+'">🔓 '+(g.waiver?'No visa needed':'Cleared')+'</span>';
  if(g.state==='domestic')return '<span class="vsd-chip ok" title="'+esc(g.message||'')+'">🔓 No visa needed</span>';
  return '<span class="vsd-chip mute" title="'+esc(g.message||'')+'">Unchecked</span>';
}
function stepper(status){
  var st=String(status||'not_started'),idx=STEPS.indexOf(st==='issued'?'approved':st),bad=/^(refused|expired|cancelled)$/.test(st);
  return '<div class="vsd-steps'+(bad?' bad':'')+'">'+STEPS.map(function(k,n){return '<i class="'+(!bad&&n<=idx?'on':'')+(n===idx?' now':'')+'" title="'+esc(LABEL[k])+'"></i>';}).join('')+'<em>'+esc(LABEL[st]||st)+'</em></div>';
}
function kpiHtml(k){
  function c(n,l,cls){return '<div class="vsd-kpi '+(cls||'')+'"><b>'+n+'</b><span>'+l+'</span></div>';}
  return '<section class="vsd-kpis">'+c(k.cleared,'Models cleared to travel','ok')+c(k.locked,'Trips locked',k.locked?'bad':'')+c(k.risk,'Confirmed trips at risk',k.risk?'crit':'')+c(k.open,'Open visa cases')+c(k.expiring,'Visas expiring ≤ 60d',k.expiring?'warn':'')+'</section>';
}
function signalsHtml(sig){
  if(!sig.length)return '<section class="vsd-card"><header><div><small>✦ VERA · TRAVEL INTELLIGENCE</small><h3>All clear</h3></div></header><p class="vsd-empty">No visa, passport or deadline risks across upcoming travel.</p></section>';
  return '<section class="vsd-card"><header><div><small>✦ VERA · TRAVEL INTELLIGENCE</small><h3>'+sig.length+' signal'+(sig.length===1?'':'s')+' need attention</h3></div></header><div class="vsd-signals">'+sig.slice(0,8).map(function(x){
    return '<article class="vsd-sig '+x.sev+'"><div><b>'+esc(x.title)+'</b><p>'+esc(x.text||'')+'</p></div><div class="vsd-sig-act">'+arr(x.act).map(function(a){return '<button type="button" data-act="'+a[0]+'" data-a="'+esc(a[2]||'')+'" data-b="'+esc(a[3]||'')+'">'+esc(a[1])+'</button>';}).join('')+'</div></article>';
  }).join('')+(sig.length>8?'<p class="vsd-more">+ '+(sig.length-8)+' more</p>':'')+'</div></section>';
}
function lockBoardHtml(b){
  var rows=b.upcoming.slice(0,14);
  return '<section class="vsd-card"><header><div><small>TRAVEL LOCK BOARD</small><h3>Upcoming trips and their visa gate</h3></div><div class="vsd-tools"><button type="button" data-act="new-trip">+ Plan trip</button></div></header>'
   +(rows.length?'<div class="vsd-trips">'+rows.map(function(t){
      var g=t.visa_gate||{},n=days(t.starts_at),who=b.mName[t.model_id]||'Model',cc=g.country_code;
      var acts=[];
      if(g.blocking){acts.push(g.visa_case_id?'<button type="button" data-act="edit-visa" data-a="'+esc(g.visa_case_id)+'">Open visa case</button>':'<button type="button" data-act="new-visa" data-a="'+esc(t.model_id)+'" data-b="'+esc(cc||'')+'">Start visa case</button>');if(g.state==='none'&&cc)acts.push('<button type="button" data-act="waive" data-a="'+esc(t.model_id)+'" data-b="'+esc(cc)+'">Visa not required</button>');if(g.passport&&(g.passport.state==='expired'||g.passport.state==='missing'))acts.push('<button type="button" data-act="new-passport" data-a="'+esc(t.model_id)+'">'+(g.passport.state==='missing'?'Add':'Update')+' passport</button>');}
      acts.push('<button type="button" data-act="edit-trip" data-a="'+esc(t.id)+'">Trip</button>');
      return '<article class="vsd-trip '+(g.blocking?'locked':'open')+'"><div class="vsd-trip-date"><b>'+esc(fd(t.starts_at))+'</b><small>'+esc(n!=null?until(n):'')+'</small></div><div class="vsd-trip-main"><b>'+esc(who)+'</b><span>'+esc([t.origin,t.destination].filter(Boolean).join(' → ')||'Trip')+' · '+esc(String(t.status||'planning').replace(/_/g,' '))+'</span><em>'+esc(g.message||'')+'</em></div><div class="vsd-trip-gate">'+lockChip(g)+'</div><div class="vsd-trip-act">'+acts.join('')+'</div></article>';
    }).join('')+'</div>':'<p class="vsd-empty">No upcoming trips. Plan a trip and the gate checks the visa automatically.</p>')+'</section>';
}
function modelCardHtml(r){
  var label={risk:'At risk',action:'Needs clearance',progress:'In progress',clear:'Cleared',idle:'No travel'}[r.state];
  var byCountry={};r.visas.forEach(function(v){if(v.country_code)(byCountry[v.country_code]=byCountry[v.country_code]||[]).push(v);});
  var cc=Object.keys(byCountry).map(function(c){
    var vs=byCountry[c],best=vs.filter(isGood)[0]||vs.filter(isOpen)[0]||vs[0],waiver=best.metadata&&best.metadata.waiver,ex=days(best.expires_on);
    return '<button type="button" class="vsd-cc '+(isGood(best)?'ok':isOpen(best)?'wait':'bad')+'" data-act="edit-visa" data-a="'+esc(best.id)+'"><b>'+esc(c)+'</b><span>'+(waiver?'Not required':esc(LABEL[best.status||'not_started']||best.status))+'</span>'+(isGood(best)&&!waiver&&best.expires_on?'<small>to '+esc(fd(best.expires_on))+(ex!=null&&ex<=60?' · '+ex+'d':'')+'</small>':'')+'</button>';
  }).join('');
  var pp=r.pp,ppText=pp.state==='missing'?'No passport':pp.state==='expired'?'Passport expired '+fd(pp.expires,true):pp.state==='expiring'?'Passport expires '+fd(pp.expires,true):'Passport · '+(pp.p&&pp.p.country_code||'')+(pp.expires?' · to '+fd(pp.expires,true):'');
  var next=r.trips[0];
  return '<article class="vsd-model '+r.state+'"><header><span class="vsd-av">'+esc(initials(r.name))+'</span><div><b>'+esc(r.name)+'</b><small>'+label+'</small></div><span class="vsd-gate">'+(r.state==='risk'||r.state==='action'?'🔒':r.state==='clear'?'🔓':r.state==='progress'?'◔':'·')+'</span></header>'
   +'<button type="button" class="vsd-pass '+pp.state+'" data-act="'+(pp.p?'edit-passport':'new-passport')+'" data-a="'+esc(pp.p?pp.p.id:r.m.id)+'">'+esc(ppText)+'</button>'
   +(cc?'<div class="vsd-ccs">'+cc+'</div>':'<p class="vsd-none">No visa cases</p>')
   +(next?'<div class="vsd-next"><small>Next trip</small><span>'+esc(next.destination||'Trip')+' · '+esc(fd(next.starts_at))+'</span>'+lockChip(next.visa_gate)+'</div>':'')
   +'<footer><button type="button" data-act="new-visa" data-a="'+esc(r.m.id)+'">+ Visa case</button><button type="button" data-act="new-trip" data-a="'+esc(r.m.id)+'">+ Trip</button></footer></article>';
}
function pipelineHtml(b){
  var cols=[['Needs action',function(v){return /^(not_started|gathering_documents|appointment_pending)$/.test(v.status||'not_started');}],['Submitted / processing',function(v){return /^(submitted|processing)$/.test(v.status);}],['Approved',function(v){return isGood(v);}]];
  var vs=b.visas.filter(function(v){return !(v.metadata&&v.metadata.waiver);});
  return '<section class="vsd-card"><header><div><small>VISA PIPELINE</small><h3>'+vs.filter(isOpen).length+' open · '+vs.filter(isGood).length+' approved</h3></div></header><div class="vsd-pipe">'+cols.map(function(c){
    var items=vs.filter(c[1]);
    return '<div class="vsd-col"><h4>'+c[0]+' <em>'+items.length+'</em></h4>'+(items.map(function(v){
      var dl=days(v.hard_deadline),nx=NEXT[v.status||'not_started'];
      return '<article class="vsd-case"><button type="button" class="vsd-case-main" data-act="edit-visa" data-a="'+esc(v.id)+'"><b>'+esc(b.mName[v.model_id]||'Model')+'</b><span>'+esc(v.country_code||'')+(v.visa_type?' · '+esc(v.visa_type):'')+'</span></button>'+stepper(v.status)
        +'<div class="vsd-case-meta">'+(v.hard_deadline&&isOpen(v)?'<span class="'+(dl!=null&&dl<=14?'bad':'')+'">Deadline '+esc(fd(v.hard_deadline))+(dl!=null?' · '+until(dl):'')+'</span>':'')+(v.appointment_at&&isOpen(v)?'<span>Appt '+esc(fd(v.appointment_at))+'</span>':'')+(isGood(v)&&v.expires_on?'<span>Valid to '+esc(fd(v.expires_on))+'</span>':'')+'</div>'
        +(nx?'<button type="button" class="vsd-adv" data-act="advance" data-a="'+esc(v.id)+'" data-b="'+nx+'">Move to '+esc(LABEL[nx])+' →</button>':'')+'</article>';}).join('')||'<p class="vsd-empty">—</p>')+'</div>';
  }).join('')+'</div></section>';
}
function timelineHtml(b){
  return '<section class="vsd-card"><header><div><small>NEXT 60 DAYS</small><h3>Appointments, deadlines and departures</h3></div><div class="vsd-tools"><button type="button" data-act="calendar">Open in Calendar</button></div></header>'
   +(b.tl.length?'<ol class="vsd-tl">'+b.tl.slice(0,12).map(function(x){return '<li class="'+(x.lock?'lock':'')+'"><time>'+esc(fd(x.at))+'</time><span><b>'+esc(x.k)+'</b>'+esc(x.t)+'</span><button type="button" data-act="'+(x.type==='visa'?'edit-visa':'edit-trip')+'" data-a="'+esc(x.id)+'">Open</button></li>';}).join('')+'</ol>':'<p class="vsd-empty">Nothing scheduled in the next 60 days. Visa appointments and deadlines appear here and on the Calendar automatically.</p>')+'</section>';
}
function paint(){
  var host=S.host;if(!host)return;
  if(S.loading&&!S.d){host.innerHTML='<div class="vsd"><p class="vsd-empty">Loading Visa Desk…</p></div>';return;}
  if(S.err&&!S.d){host.innerHTML='<div class="vsd"><p class="vsd-err">'+esc(S.err)+'</p><button type="button" class="vsd-btn" data-act="reload">Retry</button></div>';wire();return;}
  var b=build(S.d),q=S.q.trim().toLowerCase();
  var rows=b.rows.filter(function(r){return (S.filter==='all'?r.state!=='idle'||r.visas.length:r.state===S.filter)&&(!q||r.name.toLowerCase().indexOf(q)>=0);}).sort(function(a,c){var o={risk:0,action:1,progress:2,clear:3,idle:4};return o[a.state]-o[c.state]||a.name.localeCompare(c.name);});
  var counts={all:b.rows.filter(function(r){return r.state!=='idle'||r.visas.length;}).length};['risk','action','progress','clear'].forEach(function(k){counts[k]=b.rows.filter(function(r){return r.state===k;}).length;});
  var chips=[['all','All'],['risk','At risk'],['action','Needs clearance'],['progress','In progress'],['clear','Cleared']].map(function(c){return '<button type="button" class="'+(S.filter===c[0]?'on':'')+'" data-act="filter" data-a="'+c[0]+'">'+c[1]+' <em>'+counts[c[0]]+'</em></button>';}).join('');
  host.innerHTML='<div class="vsd"><header class="vsd-head"><div><small>GLOBAL MOBILITY · VISA DESK</small><h1>Travel Clearance</h1><p>A model can only travel once their visa and passport are clear. Everything here is connected to Travel and the Calendar.</p></div><div class="vsd-head-act"><button type="button" class="vsd-btn" data-act="travel-desk">Travel Desk →</button><button type="button" class="vsd-btn gold" data-act="new-visa">+ Start visa case</button></div></header>'
   +kpiHtml(b.kpi)+signalsHtml(b.sig)+lockBoardHtml(b)
   +'<section class="vsd-card"><header><div><small>MODEL CLEARANCE</small><h3>Who can travel</h3></div><div class="vsd-tools"><input type="search" placeholder="Search models…" value="'+esc(S.q)+'" data-q></div></header><div class="vsd-chips">'+chips+'</div>'+(rows.length?'<div class="vsd-models">'+rows.map(modelCardHtml).join('')+'</div>':'<p class="vsd-empty">No models match this filter.</p>')+'</section>'
   +pipelineHtml(b)+timelineHtml(b)+'</div>';
  wire();
}
/* ---------- actions ---------- */
function mob(){return window.VEUX_MOBILITY_1682;}
async function act(a,x,y,btn){
  var M=mob();
  try{
    if(a==='filter'){S.filter=x||'all';paint();return;}
    if(a==='reload'){await load(true);return;}
    if(a==='calendar'){if(typeof window.navTo==='function')window.navTo('calendar');else location.hash='calendar';return;}
    if(a==='travel-desk'){if(M&&M.desk)M.desk('travel');if(typeof window.navTo==='function')window.navTo('globalmobility');return;}
    if(!M)throw new Error('Visa forms are still loading. Try again in a moment.');
    if(S.d&&M.setData)M.setData(S.d);
    if(a==='new-visa'){M.newVisa(x?{model_id:x,country_code:y||''}:{});return;}
    if(a==='edit-visa'){M.editVisa(x);return;}
    if(a==='new-passport'){M.newPassport(x?{model_id:x}:{});return;}
    if(a==='edit-passport'){M.editPassport(x);return;}
    if(a==='new-trip'){M.newTravel(x?{model_id:x}:{});return;}
    if(a==='edit-trip'){M.editTravel(x);return;}
    if(a==='advance'){
      if(btn)btn.disabled=true;
      var out=await postMob({action:'set_visa_status',id:x,status:y});
      if(!out||out.verified!==true)throw new Error('The status change could not be confirmed.');
      var tg=out.trip_gates||{};toast('Moved to '+(LABEL[y]||y)+(tg.refreshed?' · '+tg.refreshed+' trip'+(tg.refreshed===1?'':'s')+' re-checked':''));
      await load(true);return;
    }
    if(a==='waive'){
      if(!window.confirm('Record that '+(S.d&&S.d.lookups&&arr(S.d.lookups.models).filter(function(m){return m.id===x;}).map(function(m){return m.display_name;})[0]||'this model')+' does not need a visa for '+y+'?\n\nThis unlocks travel to '+y+' and is logged on the model.'))return;
      if(btn)btn.disabled=true;
      var w=await postMob({action:'waive_visa',model_id:x,country_code:y});
      if(!w||w.verified!==true)throw new Error('Could not record the visa waiver.');
      toast('Travel to '+y+' unlocked · visa not required'+(w.trip_gates&&w.trip_gates.refreshed?' · '+w.trip_gates.refreshed+' trip(s) re-checked':''));
      await load(true);return;
    }
  }catch(e){toast(e&&e.message||String(e),'bad');if(btn)btn.disabled=false;}
}
function wire(){
  var h=S.host;if(!h)return;
  h.querySelectorAll('[data-act]').forEach(function(b){b.onclick=function(){act(b.dataset.act,b.dataset.a||'',b.dataset.b||'',b);};});
  var q=h.querySelector('[data-q]');if(q)q.oninput=function(){S.q=q.value;var pos=q.selectionStart;paint();var n=h.querySelector('[data-q]');if(n){n.focus();try{n.setSelectionRange(pos,pos);}catch(e){}}};
}
async function load(force){
  var seq=++S.seq;S.loading=true;if(!S.d)paint();
  try{var d=await getMob();if(seq!==S.seq)return;S.d=d;S.err='';if(mob()&&mob().setData)mob().setData(d);}
  catch(e){S.err='Could not load the Visa Desk: '+(e&&e.message||e);}
  S.loading=false;paint();
}
function render(host){
  S.host=host;S.filter=S.filter||'all';
  host.innerHTML='<div class="vsd"><p class="vsd-empty">Loading Visa Desk…</p></div>';
  return load(true);
}

/* ---------- take over the Visa page only; every other mobility page keeps its renderer ---------- */
var prev=window.renderGlobalMobility;
function wrapper(el){
  if(el&&(el.id==='p-visa'||(window._currentPage==='visa'&&el.id!=='p-globalmobility')))return render(el);
  return typeof prev==='function'?prev.apply(this,arguments):undefined;
}
try{Object.defineProperty(window,'renderGlobalMobility',{configurable:true,enumerable:true,get:function(){return wrapper;},set:function(v){if(v!==wrapper)prev=v;}});}
catch(e){window.renderGlobalMobility=wrapper;}
window.MDV_VISA={render:render,build:build,passportFor:passportFor};
})();
