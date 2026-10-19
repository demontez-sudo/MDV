/* Schedule import: when a prepared schedule has not been added to the calendars yet, the calendar page offers it.
   Preview shows exactly which calendars each event lands on (models, team members) before anything is written.
   Server: /api/agent/calendar/import (preview, then commit in slices). Safe to run again: unchanged events are skipped, edited ones are kept. */
(function(){
'use strict';
if(window.MDV_SCHEDULE_IMPORT)return;
var S={pending:null,checked:false,busy:false,modal:null,timer:null};

function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
function bridge(){var b=window.VEUX_AGENT_V4;if(!b||!b.api)throw new Error('Secure session is not ready');return b;}
function org(){try{return bridge().state.org.slug||'maison-de-veux';}catch(e){return 'maison-de-veux';}}
function msg(e){return (e&&e.message)||String(e||'Something went wrong');}
function call(body){return bridge().api('/api/agent/calendar/import',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(Object.assign({organization_slug:org()},body)),__fresh:true});}
function dismissed(){try{return sessionStorage.getItem('mdv-sch-x')==='1';}catch(e){return false;}}
function toast(m,bad){var o=document.querySelector('.al-toast');if(o)o.remove();var d=document.createElement('div');d.className='al-toast'+(bad?' bad':'');d.textContent=m;document.documentElement.appendChild(d);setTimeout(function(){d.remove();},5200);}
function pairs(o){return Object.keys(o||{}).map(function(k){return[k,o[k]];}).sort(function(a,b){return b[1]-a[1]||a[0].localeCompare(b[0]);});}

function check(){
  if(S.checked)return;S.checked=true;
  try{call({action:'preview'}).then(function(r){var s=r&&r.summary;if(s&&(s.create+s.update)>0){S.pending={summary:s,set:r.set};place();}}).catch(function(){});}catch(e){}
}
function place(){
  var host=document.getElementById('p-calendar'),cal=host&&host.querySelector('.vx75-calendar');
  if(!cal||!S.pending||dismissed()||cal.querySelector('.sch-banner'))return;
  var s=S.pending.summary,n=s.create+s.update,b=document.createElement('div');b.className='sch-banner';
  b.innerHTML='<i>✦</i><div><b>A prepared schedule is ready to add</b><span>'+n+' event'+(n===1?'':'s')+' from Week 43 and the 90-day model plan. See which calendar each one lands on before anything is added.</span></div><button type="button" class="sch-go" data-sch-open>Preview</button><button type="button" class="sch-x" data-sch-x aria-label="Dismiss">×</button>';
  var tgt=cal.querySelector('.mdv-plan')||cal;tgt.insertBefore(b,tgt.firstChild);
}
function watch(){
  var host=document.getElementById('p-calendar');
  if(!host){setTimeout(watch,800);return;}
  new MutationObserver(function(){clearTimeout(S.timer);S.timer=setTimeout(function(){if(!host.querySelector('.vx75-calendar'))return;if(!S.checked)check();else place();},250);}).observe(host,{childList:true,subtree:true});
}

function close(){if(S.modal){S.modal.remove();S.modal=null;}document.documentElement.classList.remove('sch-lock');}
function chips(list,max){var l=list.slice(0,max||60);return l.map(function(p){return '<span class="sch-chip">'+esc(p[0])+' <b>'+p[1]+'</b></span>';}).join('');}
function open(){
  if(!S.pending)return;var s=S.pending.summary;close();
  var m=document.createElement('div');m.className='sch-modal';S.modal=m;
  var warn=[];
  if(s.unmatched_models.length)warn.push('<p><b>Not found in the roster:</b> '+s.unmatched_models.map(function(x){return esc(x.name)+' ('+x.events+')';}).join(', ')+'. Those events are still added, but are not linked to a model calendar. Add or rename the model, then run this again.</p>');
  if(s.ambiguous_models.length)warn.push('<p><b>More than one model matches:</b> '+s.ambiguous_models.map(function(x){return esc(x.name)+' ('+x.events+')';}).join(', ')+'.</p>');
  if(s.unmatched_people.length)warn.push('<p><b>Team members not found:</b> '+s.unmatched_people.map(esc).join(', ')+'. Their events are added with their name and show under their name in the Team filter, but are not assigned to a login.</p>');
  if(s.skipped_personal)warn.push('<p><b>'+s.skipped_personal+' personal blocks</b> (training, meals, home time) belong to Demontez and are only added when Demontez runs this. They are never shown to anyone else.</p>');
  if(s.kept_edits)warn.push('<p><b>'+s.kept_edits+' event'+(s.kept_edits===1?'':'s')+' you changed in the portal</b> are left exactly as you set them.</p>');
  (s.conflicts||[]).forEach(function(c){warn.push('<p class="sch-risk"><b>Conflict, not moved:</b> '+esc(c.title)+' on '+esc(c.date)+'. '+esc(c.note)+'</p>');});
  m.innerHTML='<div class="sch-card" role="dialog" aria-modal="true" aria-label="Add prepared schedule"><header><div><small>Calendar</small><h2>Add the prepared schedule</h2></div><button type="button" class="sch-x" data-sch-close aria-label="Close">×</button></header>'
   +'<div class="sch-body"><div class="sch-prog" hidden><i></i><span></span></div><div class="sch-nums"><div><b>'+s.create+'</b><span>new events</span></div><div><b>'+s.update+'</b><span>updated</span></div><div><b>'+s.same+'</b><span>already there</span></div></div>'
   +'<section><h3>Model calendars</h3><p>'+s.on_model_calendars+' events are linked to a model, so they appear on that model’s calendar. <b>'+s.shown_to_models+'</b> are also visible to the model in her or his own portal (check-ins, training, digitals, test shoots, travel and stays). The other <b>'+s.agency_only_with_models+'</b> (visa work, pushes, deadlines, briefs) stay on the agency side only.</p><div class="sch-chips">'+chips(pairs(s.per_model),80)+'</div></section>'
   +'<section><h3>Team calendars</h3><p>Each event carries the people it belongs to. Pick a name in the calendar’s Team filter to see just that person’s week.</p><div class="sch-chips">'+chips(pairs(s.per_person))+'</div></section>'
   +(warn.length?'<section class="sch-warn"><h3>Worth a look</h3>'+warn.join('')+'</section>':'')
   +'</div>'
   +'<footer><button type="button" class="sch-ghost" data-sch-close>Not now</button><button type="button" class="sch-go" data-sch-run>Add to calendars</button></footer></div>';
  document.documentElement.appendChild(m);document.documentElement.classList.add('sch-lock');var card=m.querySelector('.sch-card');if(card)card.style.maxHeight=Math.max(320,innerHeight-40)+'px';
}
function run(){
  if(S.busy||!S.modal)return;S.busy=true;
  var go=S.modal.querySelector('[data-sch-run]'),prog=S.modal.querySelector('.sch-prog'),bar=prog.querySelector('i'),txt=prog.querySelector('span');
  go.disabled=true;go.textContent='Adding…';prog.hidden=false;txt.textContent='Starting…';
  var total=S.pending.summary.create+S.pending.summary.update,created=0,updated=0,failed=[];
  function step(){
    return call({action:'commit',limit:30,exclude:failed.map(function(f){return f.key;})}).then(function(r){return r;},function(e){if(e&&e.payload)return e.payload;throw e;}).then(function(r){
      created+=r.created||0;updated+=r.updated||0;failed=failed.concat(r.failed||[]);
      var done=created+updated+failed.length;
      bar.style.width=Math.min(100,Math.round(done/Math.max(1,total)*100))+'%';txt.textContent='Added '+Math.min(done,total)+' of '+total+'\u2026';
      if(typeof r.remaining!=='number')throw new Error('Unexpected reply from the server');
      if(!r.done&&(r.created||r.updated||(r.failed&&r.failed.length)))return step();
    });
  }
  step().then(function(){
    S.busy=false;S.pending=null;S.checked=false;var b=document.querySelector('.sch-banner');if(b)b.remove();
    bar.style.width='100%';txt.innerHTML='Done. <b>'+created+'</b> added, <b>'+updated+'</b> updated'+(failed.length?', <b class="sch-bad">'+failed.length+' could not be saved</b>: '+failed.slice(0,4).map(function(f){return esc(f.title+' ('+f.date+')');}).join('; ')+(failed.length>4?'…':''):'.');
    go.textContent='Open the calendar';go.disabled=false;go.removeAttribute('data-sch-run');go.setAttribute('data-sch-finish','');
  }).catch(function(e){S.busy=false;go.disabled=false;go.textContent='Try again';txt.innerHTML='<b class="sch-bad">'+esc(msg(e))+'</b> Nothing is lost: run it again and it continues where it stopped.';});
}
document.addEventListener('click',function(e){
  var t=e.target&&e.target.closest&&e.target.closest('[data-sch-open],[data-sch-x],[data-sch-close],[data-sch-run],[data-sch-finish]');if(!t)return;
  if(t.hasAttribute('data-sch-open'))open();
  else if(t.hasAttribute('data-sch-x')){try{sessionStorage.setItem('mdv-sch-x','1');}catch(x){}var b=document.querySelector('.sch-banner');if(b)b.remove();}
  else if(t.hasAttribute('data-sch-close')){if(!S.busy)close();}
  else if(t.hasAttribute('data-sch-run'))run();
  else if(t.hasAttribute('data-sch-finish')){close();try{if(window.renderCalendar)window.renderCalendar();else location.reload();}catch(x){location.reload();}}
});
document.addEventListener('keydown',function(e){if(e.key==='Escape'&&S.modal&&!S.busy)close();});
window.MDV_SCHEDULE_IMPORT={open:function(){if(S.pending)open();else{S.checked=false;check();}}};
watch();
})();
