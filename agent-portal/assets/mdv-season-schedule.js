/* Season schedule: day-by-day list, easy model assignment, Vera designer research + model fit, CRM linking. */
(function(){
if(window.MDV_SEASON_SCHED)return;
var S={q:'',type:'all',assigned:false,busy:false};
function M(){return window.MDV_SEASON;}
function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
function tzFor(season){var n=String(season&&season.name||'').toLowerCase();return /new york|nyfw/.test(n)?'America/New_York':/london|lfw/.test(n)?'Europe/London':'Europe/Paris';}
function tf(iso,tz){var d=new Date(iso);return isNaN(d)?'':d.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit',hour12:false,timeZone:tz});}
function dayKey(iso,tz){var d=new Date(iso);return d.toLocaleDateString('en-CA',{timeZone:tz});}
function dayLabel(iso,tz){return new Date(iso).toLocaleDateString([], {weekday:'long',month:'long',day:'numeric',timeZone:tz});}
function initials(n){return String(n||'?').split(/\s+/).map(function(x){return x[0];}).slice(0,2).join('').toUpperCase();}
function toast(m){M().toast(m);}
function kindOf(x){return x._kind||'show';}
function shows(season){return M().C.shows.filter(function(x){return x.season_id===season.id;}).sort(function(a,b){return new Date(a.starts_at)-new Date(b.starts_at);});}
function rosterName(id){var r=(M().C.roster||[]).find(function(x){return x.id===id;});return r&&r.display_name||'Model';}
function mdUrl(x){var n=String(x.title||'').replace(/\s*\(by appointment\)\s*$/i,'').trim();return 'https://www.google.com/search?q='+encodeURIComponent('site:models.com '+n);}
function extLinks(x){var n=String(x.title||'').replace(/\s*\(by appointment\)\s*$/i,'').trim();return '<div class="sc-ext"><a href="'+mdUrl(x)+'" target="_blank" rel="noopener noreferrer">Search models.com ↗</a><a href="https://www.google.com/search?q='+encodeURIComponent(n+' casting director')+'" target="_blank" rel="noopener noreferrer">Casting director ↗</a><a href="https://www.instagram.com/explore/search/keyword/?q='+encodeURIComponent(n)+'" target="_blank" rel="noopener noreferrer">Instagram ↗</a></div>';}
function dayShort(iso,tz){return new Date(iso).toLocaleDateString([], {month:'short',day:'numeric',timeZone:tz});}
function directorsFor(x){return (M().C.castingByCompany||{})[x.company_id]||[];}

function rowHtml(x,tz){
  var end=x._ends?tf(x._ends,tz):'',dirs=directorsFor(x),ms=x.season_show_models||[];
  var linked=((M().C.linked||{})[x.id]||[]).slice().sort(function(a,b){return new Date(a.starts_at)-new Date(b.starts_at);});var chips=linked.slice(0,4).map(function(e){return '<span class="sc-chip ev" title="'+esc(e.title)+'">'+esc(String(e.stage||'event').replace(/_/g,' '))+' · '+esc(dayShort(e.starts_at,tz))+' '+esc(tf(e.starts_at,tz))+'</span>';}).join('')+dirs.slice(0,3).map(function(d){return '<span class="sc-chip cd" title="'+esc(d.role||'Casting')+'">CD · '+esc(d.display_name)+'</span>';}).join('')
    +ms.map(function(m){var n=rosterName(m.model_id);return '<span class="sc-chip md" title="'+esc(n)+'"><i>'+esc(initials(n))+'</i>'+esc(n)+'<button type="button" data-sc-rm="'+esc(x.id)+'|'+esc(m.model_id)+'" aria-label="Remove '+esc(n)+'">×</button></span>';}).join('');
  return '<article class="sc-row" data-sc-show="'+esc(x.id)+'"><time>'+esc(tf(x.starts_at,tz))+(end?'<small>– '+esc(end)+'</small>':'')+'</time><div class="sc-main"><b>'+esc(x.title)+'</b><span>'+esc(x.location||'')+(kindOf(x)==='presentation'?' · Presentation':'')+'</span>'+(chips?'<div class="sc-chips">'+chips+'</div>':'')+'</div><div class="sc-acts"><button type="button" data-sc-models="'+esc(x.id)+'">＋ Models</button><button type="button" data-sc-step="'+esc(x.id)+'">＋ Step</button><button type="button" class="vera" data-sc-vera="'+esc(x.id)+'">✦ Vera</button></div></article>';
}
function listHtml(season){
  var tz=tzFor(season),q=S.q.trim().toLowerCase(),days=[],cur=null,n=0;
  shows(season).forEach(function(x){
    if(S.type==='show'&&kindOf(x)==='presentation')return;
    if(S.type==='presentation'&&kindOf(x)!=='presentation')return;
    if(S.assigned&&!(x.season_show_models||[]).length)return;
    if(q&&(x.title+' '+(x.location||'')).toLowerCase().indexOf(q)<0)return;
    var k=dayKey(x.starts_at,tz);if(!cur||cur.k!==k){cur={k:k,label:dayLabel(x.starts_at,tz),rows:[]};days.push(cur);}cur.rows.push(x);n++;
  });
  if(!days.length)return {n:0,html:'<p class="sc-none">No shows match. '+(M().C.shows.length?'Clear the filters.':'Import the schedule above.')+'</p>'};
  return {n:n,html:days.map(function(d){return '<section class="sc-day"><h4><span>'+esc(d.label)+'</span><em>'+d.rows.length+' scheduled</em></h4>'+d.rows.map(function(x){return rowHtml(x,tz);}).join('')+'</section>';}).join('')};
}
function render(root,season){
  var tabOn=root.querySelector('.ss48-tabs button.on'),isShows=!!(tabOn&&/^shows$/i.test(tabOn.textContent.trim()));
  root.classList.toggle('mdv-sched-on',isShows&&!!season);
  var host=root.querySelector('.mdv-ss-sched');
  if(!isShows||!season){if(host)host.remove();return;}
  var main=root.querySelector('.ss48-layout>main')||root;
  if(!host){host=document.createElement('section');host.className='mdv-ss-sched';main.insertBefore(host,main.firstChild);
    host.innerHTML='<header><div><small>Season schedule</small><h3></h3></div><div class="sc-tools"><label class="sc-search"><input data-sc-q placeholder="Search designer or venue…" autocomplete="off"><i>⌕</i></label><select data-sc-type aria-label="Type"><option value="all">All</option><option value="show">Shows</option><option value="presentation">Presentations</option></select><label class="sc-tog"><input type="checkbox" data-sc-assigned><span>With models</span></label></div></header><div class="sc-list"></div>';
    host.querySelector('[data-sc-q]').oninput=function(){S.q=this.value;fill(host,season);};
    host.querySelector('[data-sc-type]').onchange=function(){S.type=this.value;fill(host,season);};
    host.querySelector('[data-sc-assigned]').onchange=function(){S.assigned=this.checked;fill(host,season);};
  }
  fill(host,season);
}
function fill(host,season){
  var out=listHtml(season);
  host.querySelector('h3').textContent=season.name+' · '+out.n+' of '+shows(season).length;
  var list=host.querySelector('.sc-list'),top=list.scrollTop;list.innerHTML=out.html;list.scrollTop=top;
}
function refresh(){var m=M();m.C.at=0;return m.load(true).then(function(){var root=document.querySelector('#p-seasonmanagement .ss48');if(!root)return;var bar=root.querySelector('.mdv-ss-bar');if(bar)bar.dataset.sig='';m.render();var s=m.current(root),h=root.querySelector('.mdv-ss-sched');if(s&&h)fill(h,s);});}

/* ---- modal shell ---- */
function modal(html,cls){closeModal();var m=document.createElement('div');m.id='mdv-sc-modal';m.innerHTML='<div class="sc-back" data-sc-x></div><section class="sc-card '+(cls||'')+'" role="dialog" aria-modal="true">'+html+'</section>';document.body.appendChild(m);m.addEventListener('click',function(e){if(e.target.closest('[data-sc-x]'))closeModal();});return m;}
function closeModal(){var m=document.getElementById('mdv-sc-modal');if(m)m.remove();}
document.addEventListener('keydown',function(e){if(e.key==='Escape')closeModal();});

/* ---- add models ---- */
function pickModels(showId){
  var m=M(),x=m.C.shows.find(function(s){return s.id===showId;});if(!x)return;
  var have={};(x.season_show_models||[]).forEach(function(r){have[r.model_id]=1;});
  var roster=(m.C.roster||[]).slice().sort(function(a,b){return String(a.display_name).localeCompare(String(b.display_name));});
  var box=modal('<header><div><small>Add models</small><h2>'+esc(x.title)+'</h2></div><button type="button" data-sc-x aria-label="Close">×</button></header><div class="sc-body"><label class="sc-search wide"><input data-sc-mq placeholder="Search your roster…" autocomplete="off"><i>⌕</i></label><div class="sc-mlist"></div><p class="sc-err" hidden></p></div><footer><span class="sc-count">0 selected</span><button type="button" data-sc-x>Cancel</button><button type="button" class="primary" data-sc-save disabled>Add to show</button></footer>');
  var sel={};
  function draw(){
    var q=box.querySelector('[data-sc-mq]').value.trim().toLowerCase();
    box.querySelector('.sc-mlist').innerHTML=roster.filter(function(r){return !q||String(r.display_name).toLowerCase().indexOf(q)>=0;}).map(function(r){var on=have[r.id],ck=sel[r.id];return '<label class="sc-m'+(on?' have':'')+'"><input type="checkbox" data-sc-mid="'+esc(r.id)+'" '+(on?'checked disabled':(ck?'checked':''))+'><i>'+esc(initials(r.display_name))+'</i><span><b>'+esc(r.display_name)+'</b><small>'+esc([r.stage,r.primary_market_label].filter(Boolean).join(' · ')||'Roster')+(on?' · already on this show':'')+'</small></span></label>';}).join('')||'<p class="sc-none">No models found.</p>';
    var n=Object.keys(sel).length;box.querySelector('.sc-count').textContent=n+' selected';box.querySelector('[data-sc-save]').disabled=!n;
  }
  box.addEventListener('change',function(e){var c=e.target.closest('[data-sc-mid]');if(!c)return;if(c.checked)sel[c.dataset.scMid]=1;else delete sel[c.dataset.scMid];var n=Object.keys(sel).length;box.querySelector('.sc-count').textContent=n+' selected';box.querySelector('[data-sc-save]').disabled=!n;});
  box.querySelector('[data-sc-mq]').oninput=draw;draw();box.querySelector('[data-sc-mq]').focus();
  box.querySelector('[data-sc-save]').onclick=function(){assign(showId,Object.keys(sel),this,box);};
}
function assign(showId,ids,btn,box){
  var o=btn.textContent;btn.disabled=true;btn.textContent='Adding…';
  M().api('/api/agent/season/v9',{method:'POST',body:JSON.stringify({action:'assign_show_models',organization_slug:M().slug(),show_id:showId,model_ids:ids})}).then(function(r){
    toast('Added '+(r.added||ids.length)+' model'+((r.added||ids.length)===1?'':'s')+'. They now show on the Calendar.');closeModal();return refresh();
  }).catch(function(e){btn.disabled=false;btn.textContent=o;var er=box&&box.querySelector('.sc-err');if(er){er.hidden=false;er.textContent=String(e&&e.message||e);}else toast(String(e&&e.message||e));});
}
function removeModel(showId,modelId){
  M().api('/api/agent/season/v9',{method:'POST',body:JSON.stringify({action:'remove_show_model',organization_slug:M().slug(),show_id:showId,model_id:modelId})}).then(refresh).catch(function(e){toast(String(e&&e.message||e));});
}


/* ---- add a casting / fitting / option step (becomes a Calendar event linked to this show) ---- */
var STEPS=[['submission','Submission'],['casting','Casting'],['go_see','Go-see'],['callback','Callback'],['fitting','Fitting'],['option','Option / hold'],['confirmation','Confirmation'],['follow_up','Follow-up']];
function pad(n){return (n<10?'0':'')+n;}
function addStep(showId){
  var m=M(),x=m.C.shows.find(function(s){return s.id===showId;});if(!x)return;
  var season=m.C.seasons.find(function(s){return s.id===x.season_id;})||{},tz=tzFor(season);
  var base=new Date(x.starts_at),day=new Date(base.getTime()-86400000);
  var dstr=day.toLocaleDateString('en-CA',{timeZone:tz});
  var models=(x.season_show_models||[]);
  var box=modal('<header><div><small>'+esc(season.name||'Season')+' · '+esc(x.title)+'</small><h2>Add step to this show</h2></div><button type="button" data-sc-x aria-label="Close">×</button></header><div class="sc-body"><div class="sc-pills" role="group">'+STEPS.map(function(s,i){return '<button type="button" class="'+(i===1?'on':'')+'" data-sc-stage="'+s[0]+'">'+s[1]+'</button>';}).join('')+'</div><div class="sc-row2"><label><span>Date</span><input id="sc-d" type="date" value="'+dstr+'"></label><label><span>Time ('+esc(tz.split('/')[1].replace('_',' '))+')</span><input id="sc-t" type="time" value="14:00"></label><label><span>Minutes</span><input id="sc-m" type="number" min="5" step="5" value="30"></label></div><label><span>Location</span><input id="sc-l" value="'+esc(x.location||'')+'"></label><div><span class="sc-lab">Models</span><div class="sc-mchips">'+(models.length?models.map(function(r){return '<label class="sc-mc"><input type="checkbox" checked data-sc-mm="'+esc(r.model_id)+'"><span>'+esc(rosterName(r.model_id))+'</span></label>';}).join(''):'<p class="sc-hint">No models on this show yet. Add models first, or save the step without models.</p>')+'</div></div><p class="sc-hint">Creates one Calendar event linked to '+esc(x.title)+'. It shows on the Calendar and here, with no duplicate entry.</p><p class="sc-err" hidden></p></div><footer><button type="button" data-sc-x>Cancel</button><button type="button" class="primary" data-sc-save-step>Add to calendar</button></footer>');
  var stage='casting';
  box.addEventListener('click',function(e){
    var p=e.target.closest('[data-sc-stage]');if(p){stage=p.dataset.scStage;[].slice.call(box.querySelectorAll('[data-sc-stage]')).forEach(function(b){b.classList.toggle('on',b===p);});return;}
    var b=e.target.closest('[data-sc-save-step]');if(!b)return;
    var d=box.querySelector('#sc-d').value,tm=box.querySelector('#sc-t').value,mins=Number(box.querySelector('#sc-m').value)||30,err=box.querySelector('.sc-err');
    if(!d||!tm){err.hidden=false;err.textContent='Choose a date and time.';return;}
    var label=(STEPS.find(function(s){return s[0]===stage;})||['','Step'])[1];
    var start=wallToDate(d,tm,tz),end=new Date(start.getTime()+mins*60000);
    var ids=[].slice.call(box.querySelectorAll('[data-sc-mm]:checked')).map(function(c){return c.dataset.scMm;});
    b.disabled=true;b.textContent='Saving…';
    m.api('/api/agent/calendar/v9',{method:'POST',body:JSON.stringify({action:'create_event',organization_slug:m.slug(),title:String(x.title).replace(/\s*\(by appointment\)\s*$/i,'')+' — '+label,starts_at:start.toISOString(),ends_at:end.toISOString(),timezone:tz,location:box.querySelector('#sc-l').value.trim()||null,company_id:x.company_id||null,model_ids:ids,event_type:'meeting',calendar_event_type:label,season_id:x.season_id,show_id:x.id,season_stage:stage,status:'pending'})}).then(function(){
      toast(label+' added. It is on the Calendar and linked to '+x.title+'.');closeModal();return refresh();
    }).catch(function(er){b.disabled=false;b.textContent='Add to calendar';err.hidden=false;err.textContent=String(er&&er.message||er);});
  });
}
function wallToDate(d,t,tz){
  var guess=new Date(d+'T'+t+':00Z'),p={};
  new Intl.DateTimeFormat('en-CA',{timeZone:tz,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(guess).forEach(function(q){p[q.type]=q.value;});
  var shown=Date.UTC(+p.year,+p.month-1,+p.day,+p.hour,+p.minute);
  return new Date(guess.getTime()-(shown-guess.getTime()));
}
/* ---- Vera analysis ---- */
function veraPanel(showId,instruction){
  var m=M(),x=m.C.shows.find(function(s){return s.id===showId;});if(!x)return;
  var box=modal('<header><div><small>Vera · designer intelligence</small><h2>'+esc(x.title)+'</h2>'+extLinks(x)+'</div><button type="button" data-sc-x aria-label="Close">×</button></header><div class="sc-body vera"><div class="sc-loading"><i></i><b>Researching the designer on the web…</b><span>Casting history, casting director, aesthetic and which of your models fit. This can take up to 30 seconds.</span></div></div>','wide');
  var body=box.querySelector('.sc-body');
  m.api('/api/agent/season/vera',{method:'POST',body:JSON.stringify({organization_slug:m.slug(),show_id:showId,instruction:instruction||''})}).then(function(st){
    if(!st||!st.job_id)return st;
    var t0=Date.now();
    return new Promise(function(resolve,reject){(function tick(){
      if(!document.getElementById('mdv-sc-modal')){reject(new Error('Closed'));return;}
      if(Date.now()-t0>300000){reject(new Error('Vera took too long. Please try again.'));return;}
      m.api('/api/agent/season/vera?organization='+encodeURIComponent(m.slug())+'&job_id='+encodeURIComponent(st.job_id),{method:'GET',headers:{},__fresh:true}).then(function(r){
        if(r.status==='complete')resolve(r.result);else if(r.status==='failed')reject(new Error(r.error||'Vera could not finish the research.'));else{var s=body.querySelector('.sc-loading span');if(s&&Date.now()-t0>25000)s.textContent='Still researching — deep web research can take a minute or two…';setTimeout(tick,2000);}
      }).catch(function(e){if(Date.now()-t0<20000)setTimeout(tick,2500);else reject(e);});
    })();});
  }).then(function(r){renderVera(body,x,r);}).catch(function(e){body.innerHTML='<p class="sc-err">'+esc(String(e&&e.message||e))+'</p><p class="sc-hint">You can close this and try again.</p>';});
}
function renderVera(body,x,r){
  var d=r.designer||{},cp=r.casting_profile||{},dirs=r.casting_directors||[],sug=r.suggestions||[],taken={};(x.season_show_models||[]).forEach(function(q){taken[q.model_id]=1;});
  var tags=(d.aesthetic||[]).map(function(t){return '<span class="sc-tag">'+esc(t)+'</span>';}).join('');
  var links=[d.website&&'<a href="'+esc(d.website)+'" target="_blank" rel="noopener noreferrer">Website</a>',d.instagram&&'<a href="https://instagram.com/'+esc(String(d.instagram).replace(/^@/,''))+'" target="_blank" rel="noopener noreferrer">Instagram</a>'].filter(Boolean).join(' · ');
  var h='<section class="vp"><h3>'+esc(d.name||x.title)+'</h3><p>'+esc(d.summary||'No public summary found.')+'</p>'+(tags?'<div class="sc-tags">'+tags+'</div>':'')+(d.creative_director?'<p class="sc-hint">Creative director: '+esc(d.creative_director)+'</p>':'')+(links?'<p class="sc-hint">'+links+'</p>':'')+'</section>';
  h+='<section class="vp"><h4>Casting profile</h4><p>'+esc(cp.summary||'No public casting information found.')+'</p>'+(cp.height_range?'<p class="sc-hint">Typical height: '+esc(cp.height_range)+'</p>':'')+((cp.look||[]).length?'<div class="sc-tags">'+cp.look.map(function(t){return '<span class="sc-tag">'+esc(t)+'</span>';}).join('')+'</div>':'')+'</section>';
  h+='<section class="vp"><h4>Casting directors &amp; contacts</h4>'+(dirs.length?dirs.map(function(c,i){return '<label class="sc-dir"><input type="checkbox" data-sc-dir="'+i+'" '+(c.confidence>=.5?'checked':'')+'><span><b>'+esc(c.display_name)+'</b><small>'+esc([c.role,c.company].filter(Boolean).join(' · '))+' · confidence '+Math.round(c.confidence*100)+'%'+(c.source_url?' · <a href="'+esc(c.source_url)+'" target="_blank" rel="noopener noreferrer">source</a>':'')+'</small></span></label>';}).join(''):'<p class="sc-hint">No casting director found in public sources.</p>')+'<div class="sc-actrow"><button type="button" class="primary" data-sc-crm>'+(dirs.length?'Add designer &amp; selected contacts to CRM and connect':'Add designer to Companies')+'</button></div><p class="sc-crm-msg" hidden></p></section>';
  h+='<section class="vp"><h4>Models who fit</h4>'+(sug.length?sug.map(function(s){return '<div class="sc-sug"><div class="sc-score" style="--p:'+s.score+'"><b>'+s.score+'</b></div><div class="sc-sugmain"><b>'+esc(s.name)+'</b><p>'+esc(s.reason)+'</p>'+(s.risks?'<small>Watch: '+esc(s.risks)+'</small>':'')+'</div><button type="button" data-sc-addm="'+esc(s.model_id)+'" '+(taken[s.model_id]?'disabled>On show':'>Add')+'</button></div>';}).join('')+'<div class="sc-actrow"><button type="button" data-sc-addtop>Add top 5 to this show</button></div>':'<p class="sc-hint">No suggestions. Add measurements to your models so Vera can match them.</p>')+'</section>';
  if((r.notes||[]).length)h+='<section class="vp"><h4>Notes</h4><ul>'+r.notes.map(function(n){return '<li>'+esc(n)+'</li>';}).join('')+'</ul></section>';
  if((r.sources||[]).length)h+='<section class="vp"><h4>Sources</h4><div class="sc-src">'+r.sources.map(function(s,i){return '<a href="'+esc(s.url)+'" target="_blank" rel="noopener noreferrer"><b>'+(i+1)+'</b>'+esc(s.title)+'</a>';}).join('')+'</div></section>';
  if(!r.parse_ok&&r.raw)h+='<section class="vp"><h4>Raw answer</h4><pre>'+esc(r.raw)+'</pre></section>';
  h+='<section class="vp ask"><form data-sc-ask><input placeholder="Ask Vera more about this designer or refine the match (e.g. focus on runway walkers over 178cm)…"><button type="submit" class="primary">Ask</button></form></section>';
  body.innerHTML=h;
  body.onclick=function(e){
    var a=e.target.closest('[data-sc-addm]');if(a&&!a.disabled){assign(x.id,[a.dataset.scAddm],a,null);return;}
    if(e.target.closest('[data-sc-addtop]')){var ids=sug.filter(function(s){return !taken[s.model_id];}).slice(0,5).map(function(s){return s.model_id;});if(ids.length)assign(x.id,ids,e.target,null);return;}
    var c=e.target.closest('[data-sc-crm]');if(c){linkCrm(x,d,dirs,body,c);}
  };
  body.querySelector('[data-sc-ask]').onsubmit=function(e){e.preventDefault();var v=this.querySelector('input').value.trim();if(v)veraPanel(x.id,v);};
}
function linkCrm(x,d,dirs,body,btn){
  var picked=[].slice.call(body.querySelectorAll('[data-sc-dir]:checked')).map(function(c){return dirs[+c.dataset.scDir];});
  var o=btn.textContent;btn.disabled=true;btn.textContent='Saving…';
  M().api('/api/agent/season/v9',{method:'POST',body:JSON.stringify({action:'crm_link_designer',organization_slug:M().slug(),show_id:x.id,company:{name:d.name||String(x.title).replace(/\s*\(by appointment\)\s*$/i,''),website:d.website||'',company_type:'brand'},contacts:picked.map(function(c){return {display_name:c.display_name,role:c.role||'Casting Director',email:c.email,instagram:c.instagram,notes:'Found by Vera'+(c.source_url?' · '+c.source_url:'')};})})}).then(function(r){
    var msg=body.querySelector('.sc-crm-msg');msg.hidden=false;msg.textContent=(r.created_company?'Created company '+(r.company&&r.company.name)+'. ':'Linked to company '+(r.company&&r.company.name)+'. ')+(r.created_contacts?r.created_contacts+' new contact'+(r.created_contacts===1?'':'s')+' added. ':'')+(r.linked?r.linked+' connected to the designer.':'Contacts already connected.');btn.textContent='Saved to CRM';return refresh();
  }).catch(function(e){btn.disabled=false;btn.textContent=o;var msg=body.querySelector('.sc-crm-msg');msg.hidden=false;msg.textContent='Could not save: '+String(e&&e.message||e);});
}

document.addEventListener('click',function(e){
  var root=document.querySelector('#p-seasonmanagement .ss48');if(!root||!root.contains(e.target))return;
  var b;
  if((b=e.target.closest('[data-sc-step]'))){e.preventDefault();addStep(b.dataset.scStep);return;}
  if((b=e.target.closest('[data-sc-models]'))){e.preventDefault();pickModels(b.dataset.scModels);return;}
  if((b=e.target.closest('[data-sc-vera]'))){e.preventDefault();veraPanel(b.dataset.scVera);return;}
  if((b=e.target.closest('[data-sc-rm]'))){e.preventDefault();var p=b.dataset.scRm.split('|');removeModel(p[0],p[1]);return;}
  if(e.target.closest('.ss48-tabs button'))setTimeout(function(){var s=M().current(root);render(root,s);},80);
},true);
window.MDV_SEASON_SCHED={render:render,refresh:refresh};
})();
