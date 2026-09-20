/* Season: live strip, add show, import fashion-week schedules, and hand-off to the main Calendar. */
(function(){
if(window.__MDV_SEASON__)return;window.__MDV_SEASON__=1;
var C={at:0,seasons:[],shows:[],busy:false,msg:'',msgErr:false,auto:false},sig='';
function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
function api(path,opt){var V=window.VEUX_AGENT_V4;return V.api(path,opt);}
function slug(){var V=window.VEUX_AGENT_V4;return V&&V.state&&V.state.org&&V.state.org.slug||'maison-de-veux';}
function toast(m){try{if(window.toast)window.toast(m);}catch(_e){}}
function load(force){
  if(C.busy||(!force&&C.at&&Date.now()-C.at<30000))return Promise.resolve();
  C.busy=true;
  return api('/api/agent/season/v9?organization='+encodeURIComponent(slug()),{method:'GET',headers:{},__fresh:true}).then(function(d){
    C.seasons=d.seasons||[];C.roster=d.roster||[];C.companies=d.companies||[];C.castingByCompany=d.casting_by_company||{};C.linked=d.linked_events||{};C.shows=(d.shows||[]).map(function(x){var n=String(x.notes||'');x._kind=(n.match(/kind=(\w+)/)||[])[1]||'show';x._ends=(n.match(/ends=([^;]+)/)||[])[1]||'';return x;});C.at=Date.now();
  }).catch(function(){}).then(function(){C.busy=false;});
}
function fmtD(iso){var d=new Date(iso+(String(iso).length<=10?'T12:00:00':''));return isNaN(d)?'':d.toLocaleDateString([],{month:'short',day:'numeric'});}
function tzOf(season){var n=String(season&&season.name||'').toLowerCase();return /new york|nyfw/.test(n)?'America/New_York':/london|lfw/.test(n)?'Europe/London':'Europe/Paris';}
function fmtT(iso,tz){var d=new Date(iso);return isNaN(d)?'':d.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit',hour12:false,timeZone:tz});}
function sameDay(a,b){return a.getFullYear()===b.getFullYear()&&a.getMonth()===b.getMonth()&&a.getDate()===b.getDate();}
function current(root){var b=root.querySelector('.ss48-season-tabs button.on');var name=b&&b.textContent.trim();return C.seasons.find(function(s){return s.name===name;})||null;}
function barHtml(season){
  var shows=C.shows.filter(function(x){return x.season_id===season.id;}),now=new Date();
  var nShow=shows.filter(function(x){return x._kind!=='presentation';}).length,nPres=shows.length-nShow;
  var today=shows.filter(function(x){return sameDay(new Date(x.starts_at),now);}).sort(function(a,b){return new Date(a.starts_at)-new Date(b.starts_at);});
  var upcoming=shows.filter(function(x){return new Date(x.starts_at)>now;}).sort(function(a,b){return new Date(a.starts_at)-new Date(b.starts_at);});
  var s0=season.starts_on?new Date(season.starts_on+'T00:00:00'):null,e0=season.ends_on?new Date(season.ends_on+'T23:59:59'):null,pct=0,state='No dates set';
  if(s0&&e0){var total=e0-s0;pct=Math.max(0,Math.min(100,(now-s0)/total*100));var days=Math.ceil((e0-s0)/86400000);if(now<s0)state='Starts in '+Math.ceil((s0-now)/86400000)+' days';else if(now>e0)state='Season complete';else state='Day '+(Math.floor((now-s0)/86400000)+1)+' of '+days;}
  var assigned={};shows.forEach(function(x){(x.season_show_models||[]).forEach(function(m){assigned[m.model_id]=1;});});
  var rows=today.length?today.slice(0,6):upcoming.slice(0,5),label=today.length?'Today · '+now.toLocaleDateString([],{weekday:'long',month:'long',day:'numeric'}):'Next up';
  var list=rows.length?rows.map(function(x){return '<li><b>'+esc(fmtT(x.starts_at,tzOf(season)))+'</b><span>'+esc(x.title)+'</span><em>'+esc(today.length?(x.location||''):fmtD(x.starts_at))+'</em></li>';}).join(''):'<li class="none">'+(shows.length?'No more scheduled shows.':'No shows yet. Import the fashion-week schedule or add a show.')+'</li>';
  return '<div class="mdv-ss-strip"><div class="ss-head"><small>Live season strip</small><b>'+esc(season.starts_on?fmtD(season.starts_on)+' – '+fmtD(season.ends_on||season.starts_on):'Dates to be set')+'</b><span>'+esc(state)+'</span></div><div class="ss-track" role="img" aria-label="'+esc(state)+'"><em style="width:'+pct.toFixed(1)+'%"></em><i style="left:'+pct.toFixed(1)+'%"></i></div><div class="ss-counts"><span><b>'+nShow+'</b>Shows</span><span><b>'+nPres+'</b>Presentations</span><span><b>'+today.length+'</b>Today</span><span><b>'+Object.keys(assigned).length+'</b>Models on shows</span></div></div>'
   +'<div class="mdv-ss-today"><small>'+esc(label)+'</small><ul>'+list+'</ul></div>'
   +(C.msg?'<p class="mdv-ss-msg'+(C.msgErr?' err':'')+'">'+esc(C.msg)+'</p>':'')+'<div class="mdv-ss-actions"><button type="button" '+(shows.length?'class="primary" ':'')+'data-ss-cal>Open full calendar →</button><button type="button" data-ss-add>+ Add show</button><button type="button" data-ss-designers>Add all designers to Companies</button><button type="button" data-ss-diag>Check setup</button><button type="button" '+(shows.length?'':'class="primary" ')+'data-ss-import>'+(shows.length?'Refresh fashion-week schedules':'Import fashion-week schedules (London, Milan, Paris)')+'</button></div>';
}
function render(){
  var root=document.querySelector('#p-seasonmanagement .ss48');if(!root)return;
  var season=current(root),key=season?season.id+'|'+C.at+'|'+C.shows.length+'|'+C.msg:'none';
  var bar=root.querySelector('.mdv-ss-bar');
  var tabOn=root.querySelector('.ss48-tabs button.on'),isShows=!!(tabOn&&/^shows$/i.test(tabOn.textContent.trim())),schedMismatch=isShows!==!!root.querySelector('.mdv-ss-sched');
  if(bar&&bar.dataset.sig===key&&!schedMismatch)return;
  if(!bar){bar=document.createElement('section');bar.className='mdv-ss-bar';var tabs=root.querySelector('.ss48-tabs');if(tabs&&tabs.parentNode)tabs.parentNode.insertBefore(bar,tabs.nextSibling);else root.insertBefore(bar,root.firstChild);}
  var changed=bar.dataset.sig!==key;bar.dataset.sig=key;
  bar.innerHTML=season?barHtml(season):'<div class="mdv-ss-strip"><div class="ss-head"><small>Live season strip</small><b>No season selected</b></div></div><div class="mdv-ss-actions"><button type="button" data-ss-import>Import fashion-week schedules</button></div>';
  if(window.MDV_SEASON_SCHED){if(changed){var h0=root.querySelector('.mdv-ss-sched');if(h0)h0.remove();}window.MDV_SEASON_SCHED.render(root,season);}
}
function designersToCrm(btn,season){
  if(!season){toast('Select a season first.');return;}
  var o=btn.textContent;btn.disabled=true;btn.textContent='Adding designers…';
  api('/api/agent/season/v9',{method:'POST',body:JSON.stringify({action:'import_designers_to_crm',organization_slug:slug(),season_id:season.id})}).then(function(r){
    setMsg('Added '+(r.created_companies||0)+' new designers to Companies and connected '+(r.linked_shows||0)+' shows.',false);C.at=0;return load(true);
  }).catch(function(e){setMsg('Could not add designers: '+String(e&&e.message||e),true);}).then(function(){btn.disabled=false;btn.textContent=o;});
}
function diagnose(btn){
  var o=btn.textContent;btn.disabled=true;btn.textContent='Checking…';
  api('/api/agent/season/v9',{method:'POST',body:JSON.stringify({action:'diagnose',organization_slug:slug()})}).then(function(r){
    var bad=(r.checks||[]).filter(function(x){return !x.ok;});
    var txt='Setup check: '+(bad.length?bad.length+' problem'+(bad.length===1?'':'s')+' found. ':'database OK. ')+'AI provider: '+r.ai_provider+'. Seasons: '+(r.season_rows||[]).length+', shows saved: '+(r.show_count==null?'?':r.show_count)+'.'+bad.map(function(x){return ' ['+x.table+': '+x.error+']';}).join('');
    setMsg(txt,!!bad.length||r.ai_provider==='none');
  }).catch(function(e){setMsg('Setup check failed: '+String(e&&e.message||e),true);}).then(function(){btn.disabled=false;btn.textContent=o;});
}
function closeModal(){var m=document.getElementById('mdv-ss-modal');if(m)m.remove();}
function addShow(season){
  closeModal();var m=document.createElement('div');m.id='mdv-ss-modal';
  var d=season.starts_on||new Date().toISOString().slice(0,10);
  m.innerHTML='<div class="ss-back" data-ss-x></div><section class="ss-card" role="dialog" aria-modal="true"><header><div><small>'+esc(season.name)+'</small><h2>Add show</h2></div><button type="button" data-ss-x aria-label="Close">×</button></header><div class="ss-body"><label><span>Designer / show</span><input id="ss-title" placeholder="e.g. Saint Laurent" maxlength="120"></label><div class="ss-row"><label><span>Date</span><input id="ss-date" type="date" value="'+esc(d)+'"></label><label><span>Start</span><input id="ss-time" type="time" value="10:00"></label></div><label><span>Location</span><input id="ss-loc" placeholder="Venue or address" maxlength="160"></label><p class="ss-err" hidden></p></div><footer><button type="button" data-ss-x>Cancel</button><button type="button" class="primary" data-ss-save>Add to season &amp; calendar</button></footer></section>';
  document.body.appendChild(m);m.querySelector('#ss-title').focus();
  m.addEventListener('click',function(e){
    if(e.target.closest('[data-ss-x]')){closeModal();return;}
    var b=e.target.closest('[data-ss-save]');if(!b)return;
    var t=m.querySelector('#ss-title').value.trim(),dd=m.querySelector('#ss-date').value,tm=m.querySelector('#ss-time').value,err=m.querySelector('.ss-err');
    if(!t||!dd){err.hidden=false;err.textContent='Enter a name and a date.';return;}
    b.disabled=true;b.textContent='Saving…';
    var when=new Date(dd+'T'+(tm||'10:00')+':00');
    api('/api/agent/season/v9',{method:'POST',body:JSON.stringify({action:'create_show',organization_slug:slug(),season_id:season.id,title:t,starts_at:when.toISOString(),location:m.querySelector('#ss-loc').value.trim()||null,status:'planned',notes:'kind=show;ends=;src=manual'})}).then(function(){
      closeModal();toast('Show added. It is now on the Calendar.');C.at=0;return load(true);
    }).then(function(){var root=document.querySelector('#p-seasonmanagement .ss48');var bar=root&&root.querySelector('.mdv-ss-bar');if(bar)bar.dataset.sig='';render();if(window.navTo)navTo('seasonmanagement');}).catch(function(x){b.disabled=false;b.textContent='Add to season & calendar';err.hidden=false;err.textContent=String(x&&x.message||x);});
  });
}
function setMsg(m,err){C.msg=m||'';C.msgErr=!!err;var root=document.querySelector('#p-seasonmanagement .ss48'),bar=root&&root.querySelector('.mdv-ss-bar');if(bar)bar.dataset.sig='';render();}
function importAll(btn){
  var o=btn&&btn.textContent;if(btn){btn.disabled=true;btn.textContent='Importing…';}
  setMsg('Importing the New York, London, Milan and Paris schedules…',false);
  return api('/api/agent/season/v9',{method:'POST',body:JSON.stringify({action:'import_fashion_weeks',organization_slug:slug()})}).then(function(r){
    var n=(r.report||[]).reduce(function(a,x){return a+(x.imported||0);},0);
    C.at=0;return load(true).then(function(){setMsg('Imported '+n+' shows and presentations across '+(r.report||[]).length+' seasons. Reloading Season…',false);toast('Imported '+n+' shows and presentations.');setTimeout(function(){setMsg('',false);if(window.navTo)navTo('seasonmanagement');},900);});
  }).catch(function(e){setMsg('Import failed: '+String(e&&e.message||e),true);}).then(function(){if(btn){btn.disabled=false;btn.textContent=o;}});
}
document.addEventListener('click',function(e){
  var root=document.querySelector('#p-seasonmanagement .ss48');if(!root)return;
  var b=e.target.closest&&e.target.closest('[data-ss-cal],[data-ss-add],[data-ss-import],[data-ss-designers],[data-ss-diag]');if(!b||!root.contains(b))return;
  e.preventDefault();e.stopImmediatePropagation();
  var season=current(root);
  if(b.hasAttribute('data-ss-import'))return importAll(b);
  if(b.hasAttribute('data-ss-designers'))return designersToCrm(b,current(root));
  if(b.hasAttribute('data-ss-diag'))return diagnose(b);
  if(!season){toast('Select a season first.');return;}
  if(b.hasAttribute('data-ss-add'))return addShow(season);
  if(window.MDV_CAL&&MDV_CAL.openSeason)MDV_CAL.openSeason(season.id,season.starts_on);
  else if(window.navTo)navTo('calendar');
},true);
document.addEventListener('click',function(e){if(e.target&&e.target.closest&&e.target.closest('.ss48-season-tabs button'))setTimeout(render,60);},true);
document.addEventListener('keydown',function(e){if(e.key==='Escape')closeModal();});
setInterval(function(){if(!document.querySelector('#p-seasonmanagement .ss48'))return;load().then(function(){render();if(!C.auto&&C.at&&!C.shows.length&&C.seasons.length&&!sessionStorage.getItem('mdv-ss-auto')){C.auto=true;try{sessionStorage.setItem('mdv-ss-auto','1');}catch(_e){}importAll(null);}});},1000);
window.MDV_SEASON={C:C,load:load,api:api,slug:slug,toast:toast,current:current,render:render};
})();
