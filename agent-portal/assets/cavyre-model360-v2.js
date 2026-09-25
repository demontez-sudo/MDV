/* CAVYRE Model 360 v2 — intelligence layout (Overview · Work · Materials · Development · Logistics · Record) with Vera signals. */
(function(){
'use strict';
if(window.__CAVYRE_M360__)return;window.__CAVYRE_M360__=1;

var TABS=[['overview','Overview','ti-layout-grid'],['work','Work','ti-briefcase'],['materials','Materials','ti-photo'],['development','Development','ti-trending-up'],['logistics','Logistics','ti-plane'],['record','Record','ti-lock']];
var LEGACY={portfolio:'materials',polaroids:'materials',measurements:'materials',documents:'materials',history:'record',gameplan:'development',travel:'logistics',visa:'logistics'};
var KIND_ICON={media:'ti-photo',package:'ti-package',task:'ti-checkbox',profile:'ti-file-text',note:'ti-note',travel:'ti-plane',visa:'ti-id',development:'ti-target',booking:'ti-calendar-event',casting:'ti-video',event:'ti-calendar',availability:'ti-calendar-off'};
var M={tab:'overview',id:null,d:null,p:null,docs:null,intel:null,gp:null,gpLoading:false,el:null,prompts:[],week:0,day:null,mat:{cat:'All',view:'grid',sort:'recent'},rec:{q:'',type:'',src:'',range:'all'},collapsed:{},composer:false,menu:false,error:null};

function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
function arr(v){return Array.isArray(v)?v:[];}
function bridge(){if(!window.VEUX_AGENT_V4||!window.VEUX_AGENT_V4.api)throw new Error('VEUX secure bridge is not ready');return window.VEUX_AGENT_V4;}
function org(){var s=bridge().state||{};return (s.org&&s.org.slug)||'maison-de-veux';}
function get(path){return bridge().api(path,{method:'GET',headers:{}});}
function post(path,body){return bridge().api(path,{method:'POST',body:JSON.stringify(Object.assign({organization_slug:org()},body||{}))});}
function toast(v){try{if(window.toast)return window.toast(v);}catch(e){}console.log(v);}
function modelId(){if(window._veuxV10ModelId)return window._veuxV10ModelId;var k=window._openModelKey,m=window.MODELS&&window.MODELS[k];return m&&(m._veuxId||m.id)||null;}
function ts(v){var t=v?new Date(v).getTime():NaN;return isFinite(t)?t:null;}
function fmtDate(v,o){var t=ts(v);return t==null?'—':new Date(t).toLocaleDateString([],o||{month:'short',day:'numeric',year:'numeric'});}
function fmtTime(v){var t=ts(v);return t==null?'':new Date(t).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'});}
function fmtDT(v){var t=ts(v);return t==null?'—':fmtDate(v,{month:'short',day:'numeric'})+' · '+fmtTime(v);}
function initials(n){return String(n||'?').trim().split(/\s+/).slice(0,2).map(function(x){return x[0]||'';}).join('').toUpperCase()||'?';}
function ic(name){return '<i class="ti '+name+'" aria-hidden="true"></i>';}
function ask(prompt){if(!prompt)return '';M.prompts.push(prompt);return '<button type="button" class="m360-ask" title="Ask Vera" onclick="CAVYRE_M360.ask('+(M.prompts.length-1)+')">'+ic('ti-sparkles')+'<span>Ask Vera</span></button>';}
function card(title,sub,right,body,cls){return '<section class="m360-card '+(cls||'')+'"><header><div><h3>'+esc(title)+'</h3>'+(sub?'<p>'+esc(sub)+'</p>':'')+'</div>'+(right?'<div class="m360-head-r">'+right+'</div>':'')+'</header>'+body+'</section>';}
function empty(t){return '<div class="m360-empty">'+esc(t)+'</div>';}
function chip(text,tone){return '<span class="m360-chip '+(tone||'')+'">'+esc(text)+'</span>';}
function statusTone(s){s=String(s||'').toLowerCase();return /confirm|complete|done|ready|active|approved|booked|attended/.test(s)?'ok':/pending|await|request|planning|draft|open|submitted|attention/.test(s)?'warn':/cancel|declin|missing|overdue|expired|critical/.test(s)?'bad':'';}
function link(label,fn){return '<button type="button" class="m360-link" onclick="'+fn+'">'+esc(label)+' '+ic('ti-arrow-right')+'</button>';}

/* ---------- data ---------- */
function load(force){
  var id=modelId();
  if(!id)return Promise.reject(new Error('No model selected'));
  if(M.id!==id||force){M.d=M.p=M.docs=M.intel=M.gp=null;M.id=id;M.week=0;M.day=null;M.composer=false;M.menu=false;}
  var q='?organization='+encodeURIComponent(org())+'&model_id='+encodeURIComponent(id);
  return Promise.all([
    get('/api/agent/model-360'+q),
    get('/api/agent/model-portfolio/v10'+q),
    get('/api/agent/documents/v13.12'+q).catch(function(){return {documents:[]};}),
    get('/api/agent/model-360/intel'+q).catch(function(e){console.warn('[m360] intel unavailable',e);return null;})
  ]).then(function(r){
    if(String(id)!==String(modelId()||''))return null;
    M.d=r[0];M.p=r[1];M.docs=r[2];M.intel=r[3];
    var S=window.VEUX_V156_STATE;if(S){S.modelData=M.d;S.modelPortfolio=M.p;S.modelDocuments=M.docs;}
    return M;
  });
}
function loadGameplan(){
  if(M.gp||M.gpLoading||!M.id)return;
  M.gpLoading=true;
  get('/api/agent/gameplan/v1?organization='+encodeURIComponent(org())+'&model_id='+encodeURIComponent(M.id)).then(function(gp){gp.model_id=M.id;M.gp=gp;},function(e){M.gp={model_id:M.id,error:e&&e.message||String(e)};}).then(function(){M.gpLoading=false;if(M.tab==='development')paint();});
}

/* ---------- derived ---------- */
function model(){return (M.d&&M.d.model)||(M.p&&M.p.model)||{};}
function media(){return arr(M.p&&M.p.media);}
function heroUrl(){var m=media(),x=m.find(function(z){return z.is_primary;})||m[0];return x&&x.url||'';}
function primaryMarket(){var p=M.p||{},mk=arr(p.markets).find(function(x){return x.is_primary;})||arr(p.markets)[0];return (mk&&mk.name)||model().primary_market_label||'';}
function boardName(){var dv=arr(M.p&&M.p.divisions)[0];return dv&&((dv.boards&&dv.boards.name)||dv.board_name)||model().stage||'';}
function catOf(x){return String(x.category||'Other');}
function isDigital(x){return /digital|polaroid/i.test(catOf(x)+' '+(x.caption||''));}
function signals(){return arr(M.intel&&M.intel.signals);}
function openTasks(){return arr(M.d&&M.d.tasks).filter(function(t){return ['completed','cancelled'].indexOf(String(t.status||'').toLowerCase())<0;}).sort(function(a,b){return String(a.due_at||'9999').localeCompare(String(b.due_at||'9999'));});}
function goals(){var out=[];arr(M.d&&M.d.development&&M.d.development.plans).forEach(function(pl){arr(pl.development_goals).forEach(function(g){out.push(Object.assign({plan:pl},g));});});return out;}
function goalPct(g){var s=String(g.status||'').toLowerCase();return /complete|done/.test(s)?100:/progress|active|on_track/.test(s)?50:0;}

/* ---------- header ---------- */
function header(){
  var m=model(),h=heroUrl(),line=[primaryMarket(),boardName(),m.status||'active'].filter(Boolean).join(' · ');
  var dot=/active/i.test(m.status||'active')?'<span class="m360-live"></span>':'';
  return '<header class="m360-head"><div class="m360-crumb"><span class="m360-crumb-link" role="link" tabindex="0" onclick="navTo(\'roster\')" onkeydown="if(event.key===\'Enter\')navTo(\'roster\')">Roster</span><i>/</i><b>Model 360</b></div>'
   +'<div class="m360-headrow"><div class="m360-ph">'+(h?'<img src="'+esc(h)+'" alt="">':'<span>'+esc(initials(m.display_name))+'</span>')+'</div>'
   +'<div class="m360-title"><h1>'+esc(m.display_name||'Model')+'</h1><p>'+esc(line.toUpperCase())+dot+'</p></div>'
   +'<div class="m360-actions"><button type="button" class="m360-btn primary" onclick="CAVYRE_M360.createAction()">'+ic('ti-circle-plus')+'Create action</button><button type="button" class="m360-btn" onclick="CAVYRE_M360.sharePackage()">'+ic('ti-upload')+'Share package</button>'
   +'<div class="m360-menuwrap"><button type="button" class="m360-btn icon" aria-label="More" onclick="CAVYRE_M360.toggleMenu(event)">'+ic('ti-dots')+'</button>'+(M.menu?menu():'')+'</div></div></div>'
   +'<nav class="m360-tabs" role="tablist">'+TABS.map(function(t){return '<button type="button" role="tab" class="m360-tab'+(M.tab===t[0]?' on':'')+'" aria-selected="'+(M.tab===t[0])+'" onclick="CAVYRE_M360.tab(\''+t[0]+'\')">'+ic(t[2])+'<span>'+t[1]+'</span></button>';}).join('')+'</nav></header>';
}
function menu(){
  var items=[['Edit profile','ti-pencil','editProfile'],['Manage media','ti-photo','manageMedia'],['Website profile','ti-world','website'],['Account & access','ti-key','access'],['Ask Vera about '+(model().display_name||'this model'),'ti-sparkles','askAbout']];
  return '<div class="m360-menu">'+items.map(function(i){return '<button type="button" onclick="CAVYRE_M360.'+i[2]+'()">'+ic(i[1])+esc(i[0])+'</button>';}).join('')+'</div>';
}

/* ---------- vera blocks ---------- */
function veraBanner(){
  var it=M.intel;
  if(!it)return '';
  var score=it.readiness,rec=it.recommendation||{};
  var tone=score>=80?'ok':score>=55?'warn':'bad';
  return '<section class="m360-vera"><div class="m360-ring '+tone+'"><b>'+esc(score)+'</b><small>READY</small></div>'
   +'<div class="m360-vera-body"><div class="m360-eyebrow">'+ic('ti-sparkles')+' Vera recommendation <em>Beta</em></div><p>'+esc(rec.text||'')+'</p>'
   +(arr(rec.evidence).length?'<ul>'+arr(rec.evidence).map(function(e){return '<li>'+esc(e)+'</li>';}).join('')+'</ul>':'')+'</div>'
   +'<div class="m360-vera-cta">'+ask('Review '+(model().display_name||'this model')+'\'s current situation. Vera\'s live signals say: '+arr(rec.evidence).join(' | ')+'. What should I do first, and what can you prepare for me?')+'</div></section>';
}
function attention(limit){
  var s=signals().slice(0,limit||4);
  if(!M.intel)return empty('Vera signals are unavailable right now.');
  if(!s.length)return empty('Nothing needs attention. Vera will flag issues here.');
  return '<div class="m360-att">'+s.map(function(x){return '<div class="m360-att-item '+esc(x.severity)+'"><span class="m360-sev" title="'+esc(x.severity)+'"></span><div><b>'+esc(x.title)+'</b><p>'+esc(x.detail||'')+'</p><div class="m360-att-act">'+(x.action?'<button type="button" class="m360-pill" onclick="CAVYRE_M360.tab(\''+esc(x.action.target)+'\')">'+esc(x.action.label)+'</button>':'')+ask(x.vera_prompt)+'</div></div></div>';}).join('')+'</div>';
}

/* ---------- OVERVIEW ---------- */
function tOverview(){
  var it=M.intel||{},nu=it.next_up,digs=media().filter(isDigital).slice(0,4);if(!digs.length)digs=media().slice(0,4);
  var today=nu?'<div class="m360-today"><div class="m360-today-top"><div><span class="m360-kicker">'+esc(String(nu.kind||'').toUpperCase())+'</span><h4>'+esc(nu.title)+'</h4></div>'+(nu.status?chip(nu.status,statusTone(nu.status)):'')+'</div><div class="m360-today-meta"><span>'+ic('ti-calendar')+esc(fmtDT(nu.starts_at))+'</span>'+(nu.location?'<span>'+ic('ti-map-pin')+esc(nu.location)+'</span>':'')+'</div><button type="button" class="m360-cta" onclick="CAVYRE_M360.tab(\'work\')">'+ic('ti-calendar')+' Review details and confirm availability '+ic('ti-arrow-right')+'</button></div>':empty('No upcoming casting, booking or event.');
  var plan=arr(it.market_plan);
  var mp=plan.length?plan.slice(0,2).map(function(s){var a=ts(s.starts_on),b=ts(s.ends_on),n=Date.now(),pct=a&&b?Math.max(0,Math.min(100,(n-a)/(b-a)*100)):0;return '<div class="m360-mkt"><div class="m360-mkt-top"><div><h4>'+esc(s.name)+'</h4><p>'+esc(fmtDate(s.starts_on,{month:'short',day:'numeric'}))+' – '+esc(fmtDate(s.ends_on))+'</p></div>'+chip(s.model_status||s.season_status||'planned',statusTone(s.model_status||s.season_status))+'</div><div class="m360-track"><i style="width:'+pct+'%"></i></div><div class="m360-track-l"><span>Start</span><span>Arrival'+(s.arrival_at?' '+esc(fmtDate(s.arrival_at,{month:'short',day:'numeric'})):'')+'</span><span>Wrap</span></div></div>';}).join(''):empty('No season assignments yet.');
  var gl=goals().slice(0,2);
  var dev=gl.length?gl.map(function(g){var pc=goalPct(g);return '<div class="m360-goal-mini">'+ic('ti-target')+'<div><b>'+esc(g.title||'Goal')+'</b><p>'+esc(g.status||'open')+(g.target_date?' · due '+esc(fmtDate(g.target_date)):'')+'</p><div class="m360-track"><i style="width:'+pc+'%"></i></div></div><em>'+pc+'%</em></div>';}).join(''):empty('No development goals yet.');
  var act=arr(it.activity).slice(0,5);
  var recent=act.length?'<ol class="m360-mini-tl">'+act.map(function(a){return '<li>'+ic(KIND_ICON[a.kind]||'ti-circle')+'<div><b>'+esc(a.title)+'</b><p>'+esc(a.detail||a.actor_name||'')+'</p></div><time>'+esc(fmtDate(a.at,{month:'short',day:'numeric'}))+'<br>'+esc(fmtTime(a.at))+'</time></li>';}).join('')+'</ol>':empty('No activity yet.');
  return veraBanner()
   +'<div class="m360-grid g3">'
   +card('Today','Key items and next steps for '+(model().display_name||'the model')+'.',ask('What is the most important thing coming up for '+(model().display_name||'this model')+' and how should we prepare?'),today)
   +card('Needs attention',signals().length+' item'+(signals().length===1?'':'s'),link('View all',"CAVYRE_M360.tab('record')"),attention(3))
   +card('Market plan','Upcoming focus markets and key periods.',link('View plan',"CAVYRE_M360.tab('development')"),mp)
   +'</div><div class="m360-grid g3">'
   +card('Selected digitals','Current digitals on file.',link('View all photos',"CAVYRE_M360.tab('materials')"),digs.length?'<div class="m360-thumbs">'+digs.map(function(x){return '<button type="button" class="m360-thumb" onclick="CAVYRE_M360.viewer(\''+esc(x.id)+'\')"><img loading="lazy" src="'+esc(x.url||'')+'" alt=""></button>';}).join('')+'</div>':empty('No photos yet.'))
   +card('Development','Key goals and progress.',link('View all',"CAVYRE_M360.tab('development')"),dev)
   +card('Recent activity','Latest updates across castings, bookings and materials.',link('View all',"CAVYRE_M360.tab('record')"),recent)
   +'</div>';
}

/* ---------- WORK ---------- */
function weekStart(off){var n=new Date();n.setHours(0,0,0,0);n.setDate(n.getDate()+(off||0)*7);return n;}
function tWork(){
  var it=M.intel||{},items=arr(it.week&&it.week.items),ws=weekStart(M.week),days=[];
  for(var i=0;i<7;i++){var d=new Date(ws);d.setDate(ws.getDate()+i);days.push(d);}
  var sel=M.day!=null?M.day:new Date().toDateString();
  var byDay={};items.forEach(function(x){var k=new Date(x.starts_at).toDateString();(byDay[k]=byDay[k]||[]).push(x);});
  var strip=days.map(function(d){var k=d.toDateString(),n=(byDay[k]||[]).length;return '<button type="button" class="m360-day'+(k===sel?' on':'')+'" onclick="CAVYRE_M360.pickDay(\''+k+'\')"><small>'+d.toLocaleDateString([],{weekday:'short'})+'</small><b>'+d.toLocaleDateString([],{month:'short',day:'numeric'})+'</b>'+(n?'<i></i><em>'+n+' event'+(n===1?'':'s')+'</em>':'<em>—</em>')+'</button>';}).join('');
  var dayList=arr(byDay[sel]).map(function(x){return '<li>'+ic(KIND_ICON[x.kind]||'ti-circle')+'<div><b>'+esc(x.title)+'</b><p>'+esc(x.kind)+(x.location?' · '+esc(x.location):'')+'</p></div><time>'+esc(fmtTime(x.starts_at))+'</time></li>';}).join('');
  var week=card('Week at a glance','Key events, castings and travel.','<div class="m360-weeknav"><button type="button" onclick="CAVYRE_M360.weekNav(-1)" aria-label="Previous week">'+ic('ti-chevron-left')+'</button><span>'+esc(fmtDate(days[0],{month:'short',day:'numeric'}))+' – '+esc(fmtDate(days[6],{month:'short',day:'numeric'}))+'</span><button type="button" onclick="CAVYRE_M360.weekNav(1)" aria-label="Next week">'+ic('ti-chevron-right')+'</button><button type="button" class="m360-pill" onclick="CAVYRE_M360.weekNav(0)">Today</button></div>','<div class="m360-days">'+strip+'</div>'+(dayList?'<ul class="m360-dayl">'+dayList+'</ul>':''));

  var com=arr(it.commitments).filter(function(x){return x.kind!=='event'||true;});
  var rows=com.length?'<div class="m360-tblwrap"><table class="m360-tbl"><thead><tr><th>Date</th><th>Type</th><th>Opportunity</th><th>Location</th><th>Status</th></tr></thead><tbody>'+com.slice(0,12).map(function(x){return '<tr><td>'+esc(fmtDate(x.starts_at,{month:'short',day:'numeric',year:'numeric'}))+'</td><td>'+esc(x.kind)+'</td><td>'+esc(x.title)+'</td><td>'+esc(x.location||'—')+'</td><td>'+(x.status?chip(x.status,statusTone(x.status)):'—')+'</td></tr>';}).join('')+'</tbody></table></div>':empty('No castings or bookings scheduled.');
  var cast=card('Castings & opportunities','Latest opportunities for '+(model().display_name||'the model')+'.',link('View calendar',"navTo('calendar')"),rows);

  var pkgTrack={};arr(it.package_activity).forEach(function(a){var k=String(a.package_id);if(!pkgTrack[k])pkgTrack[k]=String(a.event_type||'').toLowerCase();});
  var cols={Shortlist:[],Submitted:[],Feedback:[],Confirmed:[]};
  arr(M.d&&M.d.packages).forEach(function(pm){var pk=pm.packages||{},ev=pkgTrack[String(pm.package_id)]||'',st=/respon|feedback/.test(ev)?'Feedback':/sent|view|open/.test(ev)?'Submitted':'Shortlist';cols[st].push({t:pk.title||pm.headline||'Package',s:(pk.companies&&pk.companies.name)||'Package',d:ev?ev.replace(/_/g,' '):'Not sent'});});
  arr(M.d&&M.d.castings).forEach(function(cm){var c=cm.castings||{},st=/confirm|attend/.test(String(cm.status||''))?'Confirmed':cm.feedback?'Feedback':/submit|callback/.test(String(c.status||''))?'Submitted':'Shortlist';cols[st].push({t:c.title||'Casting',s:'Casting'+((c.companies&&c.companies.name)?' · '+c.companies.name:''),d:fmtDate(c.starts_at||c.casting_at)});});
  arr(M.d&&M.d.bookings).forEach(function(bm){var b=bm.bookings||{};if(/confirm|complete/.test(String(bm.status||'')))cols.Confirmed.push({t:b.title||'Booking',s:'Booking'+((b.companies&&b.companies.name)?' · '+b.companies.name:''),d:fmtDate(b.starts_at)});});
  var pipe=card('Submissions pipeline','Track '+(model().display_name||'the model')+'\'s opportunities from shortlist to confirmed.','','<div class="m360-kan">'+Object.keys(cols).map(function(k){return '<div class="m360-col"><header><b>'+k+'</b><em>'+cols[k].length+'</em></header>'+(cols[k].length?cols[k].slice(0,4).map(function(x){return '<div class="m360-kcard"><b>'+esc(x.t)+'</b><p>'+esc(x.s)+'</p><small>'+esc(x.d)+'</small></div>';}).join(''):'<div class="m360-kempty">Nothing here</div>')+'</div>';}).join('')+'</div>');

  var acts=card('Agent actions','Quick actions for '+(model().display_name||'the model')+'\'s work.','','<div class="m360-quick"><button type="button" onclick="navTo(\'calendar\')">'+ic('ti-calendar')+'<b>Confirm availability</b><small>Update availability for upcoming opportunities.</small><span class="m360-pill">Open calendar</span></button><button type="button" onclick="CAVYRE_M360.sharePackage()">'+ic('ti-send')+'<b>Send materials</b><small>Share selected digitals, polaroids or comp card.</small><span class="m360-pill">Send materials</span></button><button type="button" onclick="CAVYRE_M360.createAction()">'+ic('ti-circle-plus')+'<b>Create action</b><small>Add a task for this model.</small><span class="m360-pill">Create action</span></button></div>');
  var tasks=openTasks();
  var next=card('Next steps','Up next for '+(model().display_name||'the model')+'.','',tasks.length?'<ul class="m360-steps">'+tasks.slice(0,5).map(function(t){var od=ts(t.due_at)!=null&&ts(t.due_at)<Date.now();return '<li><span class="m360-dot'+(od?' bad':'')+'"></span><div><b>'+esc(t.title)+'</b><p>'+(t.due_at?esc(fmtDate(t.due_at))+(od?' · overdue':''):'No due date')+'</p></div></li>';}).join('')+'</ul>':empty('No open tasks.'));
  var fu=tasks.filter(function(t){return /follow/i.test(t.title||'');});if(!fu.length)fu=tasks.slice(5,10);
  var follow=card('Agent follow-ups','Items to track and follow up on.','',fu.length?'<ul class="m360-steps">'+fu.slice(0,6).map(function(t){return '<li><span class="m360-dot"></span><div><b>'+esc(t.title)+'</b><p>'+(t.due_at?esc(fmtDate(t.due_at)):'No due date')+'</p></div></li>';}).join('')+'</ul>':empty('No follow-ups.'));
  return '<div class="m360-cols"><div class="m360-main">'+week+cast+pipe+'</div><div class="m360-side">'+acts+next+follow+'</div></div>';
}

/* ---------- MATERIALS ---------- */
var MAT_CATS=['All','Digitals','Portfolio','Runway','Video','Documents'];
function matItems(){
  var m=media(),c=M.mat.cat;
  if(c==='Documents')return [];
  var out=m.filter(function(x){if(c==='All')return true;if(c==='Digitals')return isDigital(x);if(c==='Video')return String(x.media_type||'').toLowerCase()==='video';return catOf(x).toLowerCase().indexOf(c.toLowerCase())===0;});
  if(M.mat.sort==='recent')out=out.slice().sort(function(a,b){return (ts(b.created_at)||0)-(ts(a.created_at)||0);});
  else out=out.slice().sort(function(a,b){return catOf(a).localeCompare(catOf(b));});
  return out;
}
function tMaterials(){
  var m=media(),mm=(M.p&&M.p.measurements)||{},docs=arr(M.docs&&M.docs.documents);
  var counts={All:m.length,Digitals:m.filter(isDigital).length,Portfolio:m.filter(function(x){return /portfolio/i.test(catOf(x));}).length,Runway:m.filter(function(x){return /runway/i.test(catOf(x));}).length,Video:m.filter(function(x){return String(x.media_type||'').toLowerCase()==='video';}).length,Documents:docs.length};
  var chips='<div class="m360-filters">'+MAT_CATS.map(function(c){return '<button type="button" class="m360-fchip'+(M.mat.cat===c?' on':'')+'" onclick="CAVYRE_M360.matCat(\''+c+'\')">'+c+(counts[c]?' <em>'+counts[c]+'</em>':'')+'</button>';}).join('')
   +'<span class="m360-spacer"></span><label class="m360-sort">Sort by <select onchange="CAVYRE_M360.matSort(this.value)"><option value="recent"'+(M.mat.sort==='recent'?' selected':'')+'>Most recent</option><option value="category"'+(M.mat.sort==='category'?' selected':'')+'>Category</option></select></label>'
   +'<div class="m360-viewt"><button type="button" class="'+(M.mat.view==='grid'?'on':'')+'" onclick="CAVYRE_M360.matView(\'grid\')" aria-label="Grid">'+ic('ti-layout-grid')+'</button><button type="button" class="'+(M.mat.view==='list'?'on':'')+'" onclick="CAVYRE_M360.matView(\'list\')" aria-label="List">'+ic('ti-list')+'</button></div></div>';
  var body;
  if(M.mat.cat==='Documents'){
    body=docs.length?'<ul class="m360-docs">'+docs.map(function(d){return '<li>'+ic('ti-file-text')+'<div><b>'+esc(d.name||d.title||'Document')+'</b><p>'+esc(d.category||'general')+' · '+esc(fmtDate(d.created_at))+'</p></div>'+(d.visible_to_model?chip('Model can see','ok'):chip('Internal',''))+'</li>';}).join('')+'</ul>':empty('No documents uploaded.');
  }else{
    var items=matItems();
    body=items.length?'<div class="m360-media '+M.mat.view+'">'+items.map(function(x){var vid=String(x.media_type||'').toLowerCase()==='video',id=esc(x.id);return '<article class="m360-mcard'+(x.is_primary?' primary':'')+'"><button type="button" class="m360-mimg" onclick="CAVYRE_M360.viewer(\''+id+'\')">'+(vid?'<span class="m360-play">'+ic('ti-player-play')+'</span>':'<img loading="lazy" src="'+esc(x.url||'')+'" alt="">')+(x.is_primary?'<span class="m360-badge">Profile</span>':'')+'</button><div class="m360-mmeta"><div><b>'+esc(x.caption||catOf(x))+'</b><small>'+esc(catOf(x))+' · '+esc(fmtDate(x.created_at,{month:'short',year:'numeric'}))+'</small></div><button type="button" class="m360-dots" aria-label="Actions" onclick="VEUX_V156.toggleMediaActions(\''+id+'\',event)">'+ic('ti-dots')+'</button></div><div class="v16933-media-menu" id="v16933-menu-'+id+'"><button type="button" onclick="CAVYRE_M360.viewer(\''+id+'\')">View Full</button>'+(!x.is_primary&&!vid?'<button type="button" onclick="CAVYRE_M360.setMain(\''+id+'\')">Use as Main Image</button>':'')+'<button type="button" onclick="CAVYRE_M360.viewer(\''+id+'\')">Edit Details</button>'+(!x.is_primary?'<button type="button" class="danger" onclick="CAVYRE_M360.delMedia(\''+id+'\')">Delete</button>':'')+'</div></article>';}).join('')+'</div>':empty('No media in this category.');
  }
  var main=card('Materials','Official digitals, portfolio, runway, video and documents for '+(model().display_name||'the model')+'.','<button type="button" class="m360-btn" onclick="CAVYRE_M360.manageMedia()">'+ic('ti-photo-plus')+'Manage media</button>',chips+body);

  var prev=(m.filter(isDigital).length?m.filter(isDigital):m).slice(0,5);
  var pkg=card('Package preview',prev.length+' image'+(prev.length===1?'':'s')+' selected','<button type="button" class="m360-pill" onclick="CAVYRE_M360.manageMedia()">'+ic('ti-refresh')+' Replace images</button>',prev.length?'<div class="m360-prev">'+prev.map(function(x){return '<img loading="lazy" src="'+esc(x.url||'')+'" alt="">';}).join('')+'</div>':empty('No images to preview.'));
  function mrow(k,v){return '<div><small>'+k+'</small><b>'+esc(v||'—')+'</b></div>';}
  var meas=card('Measurements','','<button type="button" class="m360-link" onclick="CAVYRE_M360.editMeasurements()">'+ic('ti-pencil')+' Edit</button>','<div class="m360-meas">'+mrow('Height',mm.height_display)+mrow(/men/i.test(model().gender||'')?'Chest':'Bust',mm.chest_display||mm.bust_display)+mrow('Waist',mm.waist_display)+mrow('Hips',mm.hips_display)+mrow('Shoe',mm.shoe)+mrow('Hair',mm.hair)+mrow('Eyes',mm.eyes)+'</div>');
  function newest(f){var t=Math.max.apply(null,[0].concat(m.filter(f).map(function(x){return ts(x.created_at)||0;})));return t?t:null;}
  var fr=[['Digitals updated',newest(isDigital)],['Portfolio images',newest(function(x){return /portfolio|editorial/i.test(catOf(x));})],['Runway media',newest(function(x){return /runway/i.test(catOf(x));})],['Video reel',newest(function(x){return String(x.media_type||'').toLowerCase()==='video';})],['Documents',docs.length?Math.max.apply(null,docs.map(function(d){return ts(d.created_at)||0;})):null]];
  var fresh=card('Media freshness','','','<ul class="m360-fresh">'+fr.map(function(r){var old=r[1]&&(Date.now()-r[1])>90*864e5;return '<li>'+(r[1]?ic(old?'ti-alert-circle m-warn':'ti-circle-check m-ok'):ic('ti-circle-x m-bad'))+'<span>'+esc(r[0])+'</span><em>'+(r[1]?esc(fmtDate(r[1],{month:'short',year:'numeric'})):'Missing')+'</em></li>';}).join('')+'</ul>'+'<div class="m360-fresh-cta">'+ask('Audit '+(model().display_name||'this model')+'\'s materials freshness and tell me what to shoot or update first.')+'</div>');
  var btns='<div class="m360-sidebtns"><button type="button" class="m360-btn primary" onclick="CAVYRE_M360.sharePackage()">'+ic('ti-package')+'Create package</button><button type="button" class="m360-btn" onclick="CAVYRE_M360.manageMedia()">'+ic('ti-upload')+'Upload media</button></div>';
  return '<div class="m360-cols mat"><div class="m360-main">'+main+'</div><div class="m360-side">'+pkg+meas+fresh+btns+'</div></div>';
}

/* ---------- DEVELOPMENT ---------- */
function tDevelopment(){
  loadGameplan();
  var gp=M.gp,doc=gp&&gp.gameplan,it=M.intel||{},gl=goals(),ev=arr(M.d&&M.d.development&&M.d.development.evaluations);
  var dir=(doc&&(doc.market_focus||doc.brand_positioning))||(arr(M.d&&M.d.development&&M.d.development.plans)[0]||{}).title||'';
  var mk=arr(it.market_plan).slice(0,2);
  var direction=card('Current direction','Strategic focus and development priorities.','<button type="button" class="m360-pill" onclick="CAVYRE_SMART_GAMEPLAN&&CAVYRE_SMART_GAMEPLAN.toggleSettings()">'+ic('ti-pencil')+' Edit direction</button>',(dir?'<p class="m360-lede">'+esc(dir)+'</p>':empty('Add a market focus in the Gameplan below.'))+(mk.length?'<div class="m360-dirmk">'+mk.map(function(s,i){return '<div><span class="m360-kicker">'+(i?'PREPARATION':'PRIMARY FOCUS')+'</span><h4>'+esc(s.name)+'</h4><p>'+esc(fmtDate(s.starts_on,{month:'short',day:'numeric'}))+' – '+esc(fmtDate(s.ends_on))+'</p></div>';}).join('')+'</div>':''),'wide');
  var goalCards=gl.length?'<div class="m360-goals">'+gl.slice(0,4).map(function(g,i){var pc=goalPct(g);return '<article class="m360-goal"><header>'+ic('ti-target')+'<div><span class="m360-kicker">GOAL '+(i+1)+'</span><h4>'+esc(g.title||'Development goal')+'</h4></div>'+chip((g.status||'open').replace(/_/g,' '),statusTone(g.status))+'</header><div class="m360-track"><i style="width:'+pc+'%"></i></div><div class="m360-goalmeta"><span>'+ic('ti-calendar')+' '+(g.target_date?'Due '+esc(fmtDate(g.target_date)):'No due date')+'</span><span>'+esc(g.plan&&g.plan.title||'')+'</span></div></article>';}).join('')+'</div>':card('Goals','','',empty('No development goals yet — create a plan in the Development desk.'));
  var tl=gl.filter(function(g){return g.target_date;}).map(function(g){return {at:g.target_date,t:g.title||'Goal',s:g.status};}).concat(ev.map(function(e){return {at:e.evaluated_on||e.created_at,t:'Evaluation',s:e.overall_current!=null?'Score '+Number(e.overall_current).toFixed(1):''};})).sort(function(a,b){return String(a.at).localeCompare(String(b.at));});
  var timeline=card('Timeline','Key milestones and upcoming focus.',link('View all',"navTo('modeldevelopment')"),tl.length?'<ol class="m360-mini-tl">'+tl.slice(-6).map(function(x){return '<li><span class="m360-dot"></span><div><b>'+esc(x.t)+'</b><p>'+esc(x.s||'')+'</p></div><time>'+esc(fmtDate(x.at,{month:'short',day:'numeric',year:'numeric'}))+'</time></li>';}).join('')+'</ol>':empty('No milestones yet.'));
  var le=ev[0],sc=arr(le&&le.model_evaluation_scores).slice().sort(function(a,b){return Number(b.current_score||0)-Number(a.current_score||0);});
  var evalCard=card('Evaluation',le?'Last reviewed '+fmtDate(le.evaluated_on||le.created_at):'No evaluation yet.',link('Evaluation desk',"VEUX_V155.openEvaluationsForModel('"+esc(M.id)+"')"),le&&sc.length?'<div class="m360-sw"><h5>Strengths</h5><ul>'+sc.slice(0,3).map(function(s){return '<li>'+esc(String(s.category_key||'').replace(/_/g,' '))+' · '+esc(Number(s.current_score).toFixed(1))+'</li>';}).join('')+'</ul><h5>Opportunities</h5><ul>'+sc.slice(-3).reverse().map(function(s){return '<li>'+esc(String(s.category_key||'').replace(/_/g,' '))+' · '+esc(Number(s.current_score).toFixed(1))+'</li>';}).join('')+'</ul></div>':empty('Record an evaluation to see strengths and opportunities.'));
  var rec=it.recommendation||{};
  var veraC=card('Vera recommendation','Based on current materials, market trends and development goals.','<span class="m360-beta">Beta</span>','<p class="m360-lede sm">'+esc(rec.text||'Vera is gathering signals…')+'</p>'+(arr(rec.evidence).length?'<ul class="m360-ev">'+arr(rec.evidence).map(function(e){return '<li>'+esc(e)+'</li>';}).join('')+'</ul>':'')+'<div class="m360-vbtns"><button type="button" class="m360-btn primary" onclick="CAVYRE_M360.askAbout()">'+ic('ti-message-circle')+'Review and discuss with Vera</button><button type="button" class="m360-btn" onclick="CAVYRE_M360.tab(\'materials\')">'+ic('ti-folder')+'View supporting materials</button></div>','vera');
  var gpBody=!gp?'<div class="m360-empty">Loading Smart Gameplan…</div>':(window.CAVYRE_SMART_GAMEPLAN&&window.CAVYRE_SMART_GAMEPLAN.render?window.CAVYRE_SMART_GAMEPLAN.render(model(),gp):empty('Smart Gameplan is not available.'));
  return direction+goalCards+'<div class="m360-grid g3 dev">'+timeline+evalCard+veraC+'</div><section class="m360-gpwrap"><div class="m360-eyebrow">'+ic('ti-target')+' Smart Gameplan</div><div class="cvygp-host" id="m360-gp">'+gpBody+'</div></section>';
}

/* ---------- LOGISTICS ---------- */
function openDesk(kind){try{if(window.VEUX_MOBILITY_1682&&VEUX_MOBILITY_1682.openDesk)return VEUX_MOBILITY_1682.openDesk(M.id,kind);}catch(e){}navTo('globalmobility');}
function tLogistics(){
  var it=M.intel||{},trips=arr(M.d&&M.d.mobility&&M.d.mobility.travel).filter(function(t){return ['cancelled'].indexOf(String(t.status||'').toLowerCase())<0;}).sort(function(a,b){return (ts(a.starts_at)||0)-(ts(b.starts_at)||0);});
  var up=trips.filter(function(t){return (ts(t.ends_at||t.starts_at)||0)>=Date.now();});var t=up[0]||trips[trips.length-1];
  var body;
  if(!t)body=empty('No trips planned yet.');
  else{var segs=arr(t.travel_segments),stays=arr(t.housing_bookings),f=segs[0],l=segs[segs.length-1];
    body='<div class="m360-trip"><div class="m360-route"><div><h4>'+esc(t.origin||'Origin')+'</h4></div><div class="m360-plane">'+ic('ti-plane')+'</div><div><h4>'+esc(t.destination||'Destination')+'</h4></div>'+chip(t.status||'planning',statusTone(t.status))+'</div>'
     +'<div class="m360-tripgrid"><div><small>Departure</small><b>'+esc(f?fmtDT(f.departs_at):fmtDate(t.starts_at))+'</b></div><div><small>Flight</small><b>'+esc(f?[f.provider,f.segment_number].filter(Boolean).join(' ')||'Booked':'To be booked')+'</b></div><div><small>Arrival</small><b>'+esc(l?fmtDT(l.arrives_at):fmtDate(t.ends_at))+'</b></div><div><small>Trip purpose</small><b>'+esc(t.purpose||'—')+'</b></div></div>'
     +'<div class="m360-tripgrid two"><div><small>Stay</small><b>'+esc(stays.length?(stays[0].property_name||stays[0].city||'Booked')+(stays.length>1?' +'+(stays.length-1):''):'Not yet added')+'</b></div><div><small>Notes</small><b>'+esc(t.notes||'—')+'</b></div></div></div>';}
  var itin=card('Travel and work itinerary','Upcoming and planned travel for castings, shows and related work.',link('View all trips',"CAVYRE_M360.openDesk('travel')"),body+'<div class="m360-btnrow"><button type="button" class="m360-btn primary" onclick="CAVYRE_M360.openDesk(\'travel\')">'+ic('ti-circle-plus')+'Create trip</button><button type="button" class="m360-btn" onclick="CAVYRE_M360.openDesk(\'travel\')">'+ic('ti-calendar')+'View itinerary details</button></div>');
  var items=arr(it.readiness_items);
  var ready=card('Travel readiness','Key items to complete before travel.',ask('Walk me through what '+(model().display_name||'this model')+' still needs before travelling, in order.'),items.length?'<ul class="m360-ready">'+items.map(function(r){var ico={passport:'ti-id',accommodation:'ti-building',flights:'ti-plane',confirmation:'ti-user-check'}[r.key]||'ti-circle';return '<li>'+ic(ico)+'<div><b>'+esc(r.title)+'</b><p>'+esc(r.detail)+'</p></div>'+chip(r.status==='ready'?'Ready':r.status==='na'?'N/A':r.status==='attention'?'Attention':'Not started',r.status==='ready'?'ok':r.status==='attention'?'warn':r.status==='missing'?'bad':'')+'</li>';}).join('')+'</ul>':empty('Readiness is unavailable right now.'));
  var visas=arr(M.d&&M.d.mobility&&M.d.mobility.visa_cases);
  var vt=card('Visa and work authorization','Track visa requirements and work authorization for international travel.',link('View all cases',"CAVYRE_M360.openDesk('visa')"),visas.length?'<div class="m360-tblwrap"><table class="m360-tbl"><thead><tr><th>Country / Region</th><th>Visa type</th><th>Deadline</th><th>Status</th><th></th></tr></thead><tbody>'+visas.map(function(v){return '<tr><td>'+esc(v.country_code||'—')+'</td><td>'+esc(v.visa_type||v.case_type||'—')+'</td><td>'+esc(v.hard_deadline?fmtDate(v.hard_deadline):'—')+'</td><td>'+chip(String(v.status||'not started').replace(/_/g,' '),statusTone(v.status))+'</td><td><button type="button" class="m360-pill" onclick="CAVYRE_M360.openDesk(\'visa\')">Open case</button></td></tr>';}).join('')+'</tbody></table></div>':empty('No visa cases. Start one from the Mobility desk.')+'<div class="m360-btnrow"><button type="button" class="m360-btn" onclick="CAVYRE_M360.openDesk(\'visa\')">'+ic('ti-circle-plus')+'Start visa case</button></div>');
  var cf=arr(it.conflicts);
  var conf=card('Calendar conflicts','Potential conflicts with existing commitments.',link('View all',"navTo('calendar')"),cf.length?'<div class="m360-conf">'+cf.slice(0,3).map(function(x){return '<div class="m360-conf-i">'+ic('ti-alert-triangle')+'<div><b>Potential scheduling conflict</b><p>'+esc(x.a.title)+' overlaps '+esc(x.b.title)+' ('+esc(fmtDate(x.starts_at))+').</p></div><button type="button" class="m360-pill bad" onclick="navTo(\'calendar\')">Review conflict</button></div>';}).join('')+'</div>':empty('No conflicts between travel and existing commitments.'));
  return '<div class="m360-grid g2"><div class="m360-stack">'+itin+vt+'</div><div class="m360-stack">'+ready+conf+'</div></div>';
}

/* ---------- RECORD ---------- */
function recFiltered(){
  var f=M.rec,q=String(f.q||'').toLowerCase(),now=Date.now(),lim=f.range==='30'?30:f.range==='90'?90:0;
  return arr(M.intel&&M.intel.activity).filter(function(a){
    if(f.type&&a.kind!==f.type)return false;if(f.src&&a.source!==f.src)return false;
    if(lim&&now-(ts(a.at)||0)>lim*864e5)return false;
    if(q&&(String(a.title||'')+' '+String(a.detail||'')+' '+String(a.actor_name||'')).toLowerCase().indexOf(q)<0)return false;return true;});
}
function tRecord(){
  var it=M.intel,feed=recFiltered(),kinds=[];arr(it&&it.activity).forEach(function(a){if(kinds.indexOf(a.kind)<0)kinds.push(a.kind);});
  var groups={},order=[];feed.forEach(function(a){var k=new Date(a.at).toLocaleDateString([],{month:'long',year:'numeric'});if(!groups[k]){groups[k]=[];order.push(k);}groups[k].push(a);});
  var filt='<div class="m360-recf"><label class="m360-search">'+ic('ti-search')+'<input type="search" placeholder="Search activity, notes, people…" value="'+esc(M.rec.q)+'" oninput="CAVYRE_M360.recSet(\'q\',this.value)"></label>'
   +'<select onchange="CAVYRE_M360.recSet(\'range\',this.value)"><option value="all"'+(M.rec.range==='all'?' selected':'')+'>All time</option><option value="30"'+(M.rec.range==='30'?' selected':'')+'>Last 30 days</option><option value="90"'+(M.rec.range==='90'?' selected':'')+'>Last 90 days</option></select>'
   +'<select onchange="CAVYRE_M360.recSet(\'type\',this.value)"><option value="">All types</option>'+kinds.map(function(k){return '<option value="'+esc(k)+'"'+(M.rec.type===k?' selected':'')+'>'+esc(k)+'</option>';}).join('')+'</select>'
   +'<select onchange="CAVYRE_M360.recSet(\'src\',this.value)"><option value="">All sources</option><option value="log"'+(M.rec.src==='log'?' selected':'')+'>Logged</option><option value="derived"'+(M.rec.src==='derived'?' selected':'')+'>Derived</option></select></div>';
  var tl=order.length?order.map(function(k){var open=!M.collapsed[k],rows=groups[k];return '<div class="m360-month"><button type="button" class="m360-monthh" onclick="CAVYRE_M360.toggleMonth(\''+esc(k)+'\')"><h4>'+esc(k)+'</h4><em>'+rows.length+' activit'+(rows.length===1?'y':'ies')+'</em><span>'+(open?'Collapse month':'Expand')+' '+ic(open?'ti-chevron-up':'ti-chevron-down')+'</span></button>'+(open?'<ol class="m360-tl">'+rows.map(function(a){var pg=a.link&&a.link.page;return '<li><div class="m360-tl-d"><b>'+esc(fmtDate(a.at,{month:'short',day:'numeric'}).toUpperCase())+'</b><small>'+esc(new Date(a.at).toLocaleDateString([],{weekday:'short'})+', '+fmtTime(a.at))+'</small></div><div class="m360-tl-i">'+ic(KIND_ICON[a.kind]||'ti-circle')+'</div><div class="m360-tl-b"><b>'+esc(a.title)+'</b>'+(a.detail?'<p>'+esc(a.detail)+'</p>':'')+(a.actor_name?'<small>By '+esc(a.actor_name)+' · '+esc(fmtTime(a.at))+'</small>':'')+'</div>'+(pg?'<button type="button" class="m360-link" onclick="CAVYRE_M360.tab(\''+esc(pg)+'\')">View '+ic('ti-arrow-right')+'</button>':'')+'</li>';}).join('')+'</ol>':'')+'</div>';}).join(''):empty(it?'No activity matches these filters.':'Activity is unavailable right now.');
  var note=(it&&!it.logging_enabled)?'<p class="m360-hint">Showing history reconstructed from existing records. New profile, measurement and note changes are now logged automatically.</p>':'';
  var main=card('Model activity record','Search and filter all activity across work, materials, development, logistics and notes.','<button type="button" class="m360-btn" onclick="CAVYRE_M360.exportRecord()">'+ic('ti-download')+'Export record</button>',filt+note+tl);
  var notes=arr(M.d&&M.d.notes);
  var composer=M.composer?'<div class="m360-composer"><textarea id="m360-note-body" rows="3" placeholder="Write a note…"></textarea><div class="m360-comp-r"><label class="m360-vis"><input type="checkbox" id="m360-note-share"> Shareable with model</label><button type="button" class="m360-btn" onclick="CAVYRE_M360.noteComposer(false)">Cancel</button><button type="button" class="m360-btn primary" onclick="CAVYRE_M360.saveNote()">Save note</button></div></div>':'';
  var nlist=notes.length?'<div class="m360-notes">'+notes.map(function(n){var sh=!!n.visible_to_model;return '<article class="m360-note'+(n.pinned?' pinned':'')+'"><header><span class="m360-av">'+esc(initials(n.author_name))+'</span><div><b>'+esc(n.author_name||'Agent')+'</b><small>'+esc(fmtDate(n.created_at))+' · '+esc(fmtTime(n.created_at))+'</small></div><button type="button" class="m360-chip vis '+(sh?'ok':'')+'" title="Toggle visibility" onclick="CAVYRE_M360.noteVis(\''+esc(n.id)+'\','+(!sh)+')">'+ic(sh?'ti-send':'ti-lock')+(sh?' Shareable':' Internal')+'</button><button type="button" class="m360-dots" aria-label="Delete note" onclick="CAVYRE_M360.noteDelete(\''+esc(n.id)+'\')">'+ic('ti-trash')+'</button></header><p>'+esc(n.body||'')+'</p></article>';}).join('')+'</div>':empty('No notes yet.');
  var side=card('Notes & ownership','Agent notes, context and visibility settings.','<button type="button" class="m360-btn primary" onclick="CAVYRE_M360.noteComposer(true)">'+ic('ti-circle-plus')+'Add note</button>',composer+nlist);
  return '<div class="m360-cols rec"><div class="m360-main">'+main+'</div><div class="m360-side">'+side+'</div></div>';
}

/* ---------- paint ---------- */
var BUILD={overview:tOverview,work:tWork,materials:tMaterials,development:tDevelopment,logistics:tLogistics,record:tRecord};
function paint(){
  var el=M.el&&M.el.isConnected?M.el:document.getElementById('p-modelpage');if(!el)return;M.el=el;
  if(M.error){el.innerHTML='<div class="m360"><div class="m360-fail"><h3>Unable to load Model 360</h3><p>'+esc(M.error)+'</p><button type="button" class="m360-btn" onclick="CAVYRE_M360.refresh()">Try again</button></div></div>';return;}
  if(!M.d){el.innerHTML='<div class="m360"><div class="m360-loading"><span></span>Loading Model 360…</div></div>';return;}
  M.prompts=[];
  var body='';try{body=(BUILD[M.tab]||tOverview)();}catch(e){console.error('[m360]',e);body='<div class="m360-fail"><h3>This section could not be drawn</h3><p>'+esc(e&&e.message||e)+'</p></div>';}
  var sc=window.scrollY;
  el.innerHTML='<div class="m360 m360-t-'+M.tab+'">'+header()+'<div class="m360-body">'+body+'</div></div>';
}
function render(el){
  M.el=el||document.getElementById('p-modelpage');M.error=null;
  var legacy=window.VEUX_V156_STATE&&window.VEUX_V156_STATE.modelTab;if(legacy&&LEGACY[legacy]){M.tab=LEGACY[legacy];}else if(legacy&&BUILD[legacy]){M.tab=legacy;}
  if(window.VEUX_V156_STATE)window.VEUX_V156_STATE.modelTab='overview';
  if(M.id&&M.id!==modelId()){M.d=null;}
  paint();
  return load(false).then(function(r){if(r)paint();}).catch(function(e){M.error=e&&e.message||String(e);paint();});
}
function setTab(t){t=LEGACY[t]||t;if(!BUILD[t])return;M.tab=t;M.menu=false;paint();try{window.scrollTo({top:0});}catch(e){}}

/* ---------- in-portal photo viewer ---------- */
var LB={on:false,i:0,ids:[]};
var PHOTO_CATS=['Headshot','Digital','Polaroid','Editorial','Runway','Motion','Commercial','Portfolio','Test','Other'];
function lbItems(){return LB.ids.map(function(id){return media().find(function(x){return String(x.id)===String(id);});}).filter(Boolean);}
function lbCur(){var it=lbItems();return it[Math.max(0,Math.min(LB.i,it.length-1))]||null;}
function lbEl(){var e=document.getElementById('m360-lb');if(!e){e=document.createElement('div');e.id='m360-lb';e.className='m360-lb';document.body.appendChild(e);}return e;}
function lbKey(ev){if(!LB.on)return;var t=ev.target&&ev.target.tagName;if(ev.key==='Escape'){lbClose();}else if(/INPUT|TEXTAREA|SELECT/.test(t||'')){return;}else if(ev.key==='ArrowRight'){lbNav(1);}else if(ev.key==='ArrowLeft'){lbNav(-1);}}
function lbClose(){LB.on=false;var e=document.getElementById('m360-lb');if(e)e.remove();document.removeEventListener('keydown',lbKey);document.documentElement.classList.remove('m360-lb-open');}
function lbNav(d){var n=LB.ids.length;if(!n)return;LB.i=(LB.i+d+n)%n;lbRender();}
function lbRender(){
  var items=lbItems(),it=lbCur();if(!it){lbClose();return;}
  var vid=String(it.media_type||'').toLowerCase()==='video',n=items.length,id=esc(it.id);
  var stage=vid?'<video src="'+esc(it.url||'')+'" controls playsinline autoplay></video>':'<img src="'+esc(it.url||'')+'" alt="'+esc(it.caption||'')+'">';
  var strip=items.map(function(x,i){var v=String(x.media_type||'').toLowerCase()==='video';return '<button type="button" class="m360-lb-th'+(i===LB.i?' on':'')+'" onclick="CAVYRE_M360.lbGo('+i+')">'+(v?'<span>'+ic('ti-player-play')+'</span>':'<img loading="lazy" src="'+esc(x.url||'')+'" alt="">')+'</button>';}).join('');
  var side='<aside class="m360-lb-side"><div class="m360-lb-sh"><div><span class="m360-kicker">PHOTO SETTINGS</span><h3>'+esc(it.caption||catOf(it))+'</h3></div></div>'
   +(it.is_primary?'<div class="m360-lb-main on">'+ic('ti-star-filled')+' This is the main photo</div>':(vid?'':'<button type="button" class="m360-btn primary m360-lb-wide" onclick="CAVYRE_M360.lbMain()">'+ic('ti-star')+' Set as main photo</button>'))
   +'<label>Category<select id="m360-lb-cat">'+PHOTO_CATS.map(function(c){var cur=String(it.category||'').toLowerCase()===c.toLowerCase()||(c==='Digital'&&/^digitals?$/i.test(it.category||''));return '<option'+(cur?' selected':'')+'>'+c+'</option>';}).join('')+'</select></label>'
   +'<label>Label<input id="m360-lb-cap" value="'+esc(it.caption||'')+'" placeholder="e.g. Front portrait"></label>'
   +'<label>Photographer<input id="m360-lb-ph" value="'+esc(it.photographer||'')+'" placeholder="Photographer / credit"></label>'
   +'<label>Usage<input id="m360-lb-use" value="'+esc(it.usage_permission||'')+'" placeholder="Usage permission"></label>'
   +'<label class="m360-lb-check"><input type="checkbox" id="m360-lb-pub"'+(it.is_public?' checked':'')+(it.is_primary?' disabled':'')+'> Show on website'+(it.is_primary?' (main photo is always public)':'')+'</label>'
   +'<div class="m360-lb-meta"><small>Added '+esc(fmtDate(it.created_at))+'</small><small>'+esc(catOf(it))+' · '+(vid?'Video':'Image')+'</small></div>'
   +'<button type="button" class="m360-btn primary m360-lb-wide" onclick="CAVYRE_M360.lbSave()">'+ic('ti-device-floppy')+' Save settings</button>'
   +'<div class="m360-lb-row"><a class="m360-btn" href="'+esc(it.url||'#')+'" target="_blank" rel="noopener">'+ic('ti-external-link')+' Open original</a><button type="button" class="m360-btn" onclick="CAVYRE_M360.lbCopy()">'+ic('ti-link')+' Copy link</button></div>'
   +(it.is_primary?'':'<button type="button" class="m360-btn danger m360-lb-wide" onclick="CAVYRE_M360.delMedia(\''+id+'\')">'+ic('ti-trash')+' Delete photo</button>')+'</aside>';
  lbEl().innerHTML='<div class="m360-lb-back" onclick="CAVYRE_M360.lbClose()"></div><div class="m360-lb-win"><div class="m360-lb-stagewrap"><div class="m360-lb-stage">'+stage
   +(n>1?'<button type="button" class="m360-lb-nav prev" aria-label="Previous" onclick="CAVYRE_M360.lbNav(-1)">'+ic('ti-chevron-left')+'</button><button type="button" class="m360-lb-nav next" aria-label="Next" onclick="CAVYRE_M360.lbNav(1)">'+ic('ti-chevron-right')+'</button>':'')
   +'<div class="m360-lb-count">'+(LB.i+1)+' / '+n+'</div>'+(it.is_primary?'<span class="m360-badge lb">Main photo</span>':'')+'</div>'+(n>1?'<div class="m360-lb-strip">'+strip+'</div>':'')+'</div>'+side+'<button type="button" class="m360-lb-x" aria-label="Close" onclick="CAVYRE_M360.lbClose()">'+ic('ti-x')+'</button></div>';
  var a=lbEl().querySelector('.m360-lb-th.on');if(a&&a.scrollIntoView)a.scrollIntoView({block:'nearest',inline:'center'});
}
function openViewer(id){
  var ids=(M.tab==='materials'?matItems():media()).map(function(x){return x.id;});
  if(ids.indexOf(id)<0)ids=media().map(function(x){return x.id;});
  LB.ids=ids;LB.i=Math.max(0,ids.indexOf(id));LB.on=true;
  document.documentElement.classList.add('m360-lb-open');document.addEventListener('keydown',lbKey);lbRender();
}
function mediaApi(body){return post('/api/agent/model-portfolio/v10',Object.assign({model_id:M.id},body));}
function afterMediaChange(keepId){return load(true).then(function(){var ids=LB.ids.filter(function(i){return media().some(function(x){return String(x.id)===String(i);});});if(keepId&&ids.indexOf(keepId)<0&&media().some(function(x){return String(x.id)===String(keepId);}))ids.push(keepId);LB.ids=ids;LB.i=Math.min(LB.i,Math.max(0,ids.length-1));paint();if(LB.on)lbRender();});}
function setMain(id){
  var x=media().find(function(m){return String(m.id)===String(id);});if(!x)return;
  var p=Promise.resolve(id);
  if(String(x.category||'').toLowerCase()!=='headshot'){
    p=mediaApi({action:'create_media',url:x.url,media_type:x.media_type||'image',provider:x.provider||'external',public_id:x.public_id||null,category:'Headshot',caption:x.caption||null,photographer:x.photographer||null,usage_permission:x.usage_permission||null,is_public:true}).then(function(r){var t=r&&r.media&&r.media.id;if(!t)throw new Error('Could not create the main-photo copy.');return t;});
  }
  return p.then(function(target){return mediaApi({action:'set_primary_media',media_id:target}).then(function(){return target;});}).then(function(target){toast('✓ Main photo updated');return afterMediaChange(target).then(function(){if(LB.on){var i=LB.ids.indexOf(target);if(i>=0){LB.i=i;lbRender();}}});}).catch(function(e){alert(e.message||e);});
}
function delMedia(id){
  if(!confirm('Delete this photo permanently?'))return;
  mediaApi({action:'delete_media',media_id:id}).then(function(){toast('Photo deleted');LB.ids=LB.ids.filter(function(i){return String(i)!==String(id);});return afterMediaChange();}).catch(function(e){alert(e.message||e);});
}
function lbSave(){
  var it=lbCur();if(!it)return;
  var pub=document.getElementById('m360-lb-pub'),body={action:'update_media',media_id:it.id,category:document.getElementById('m360-lb-cat').value,caption:document.getElementById('m360-lb-cap').value.trim()||null,photographer:document.getElementById('m360-lb-ph').value.trim()||null,usage_permission:document.getElementById('m360-lb-use').value.trim()||null};
  if(pub&&!pub.disabled)body.is_public=pub.checked;
  mediaApi(body).then(function(){toast('✓ Photo settings saved');return afterMediaChange(it.id);}).catch(function(e){alert(e.message||e);});
}

/* ---------- actions ---------- */
function notesApi(body){return post('/api/agent/model-360',Object.assign({model_id:M.id},body));}
function reload(){return load(true).then(function(){paint();});}
window.CAVYRE_M360={
  version:'2.0.0',render:render,tab:setTab,refresh:function(){M.error=null;paint();return reload().catch(function(e){M.error=e&&e.message||String(e);paint();});},
  ask:function(i){var p=M.prompts[i];if(!p)return;try{if(window.MDV_VERA_CHAT&&MDV_VERA_CHAT.open)return MDV_VERA_CHAT.open(p);}catch(e){}var inp=document.querySelector('.vx73-command input');if(inp){inp.value=p;inp.focus();toast('Press Enter to ask Vera');}},
  askAbout:function(){M.menu=false;var it=M.intel||{},n=model().display_name||'this model';var p='Review '+n+' and recommend next steps. Live signals: '+(signals().slice(0,5).map(function(s){return s.title+' ('+s.detail+')';}).join('; ')||'none')+'.';try{if(window.MDV_VERA_CHAT&&MDV_VERA_CHAT.open)return MDV_VERA_CHAT.open(p);}catch(e){}var inp=document.querySelector('.vx73-command input');if(inp){inp.value=p;inp.focus();}},
  toggleMenu:function(ev){if(ev)ev.stopPropagation();M.menu=!M.menu;paint();if(M.menu){setTimeout(function(){document.addEventListener('click',function c(){M.menu=false;document.removeEventListener('click',c);paint();},{once:true});},0);}},
  editProfile:function(){M.menu=false;paint();if(window.VEUX_V156&&VEUX_V156.editProfile)VEUX_V156.editProfile();},
  manageMedia:function(){M.menu=false;if(window.VEUX_V156&&VEUX_V156.mediaManager)VEUX_V156.mediaManager();},
  editMeasurements:function(){if(window.VEUX_V156&&VEUX_V156.editMeasurements)VEUX_V156.editMeasurements();},
  website:function(){M.menu=false;paint();if(window.VEUX_V16917&&VEUX_V16917.website)VEUX_V16917.website();},
  access:function(){M.menu=false;paint();var b=document.querySelector('[data-cvy-access],#cvy-model-access-btn');if(b)b.click();else toast('Account & access is not available on this page.');},
  createAction:function(){var A=window.CAVYRE_CREATE_ACTION_AUTHORITY;try{if(A&&A.openTask)A.openTask();else if(window.VEUX_V10&&VEUX_V10.newTask)VEUX_V10.newTask();}catch(e){}var n=0,t=setInterval(function(){var s=document.getElementById('vx161275-model');if(s){s.value=M.id;s.dispatchEvent(new Event('change',{bubbles:true}));clearInterval(t);}else if(++n>15)clearInterval(t);},120);},
  sharePackage:function(){var b=document.createElement('button');b.textContent='Add to Package';b.style.display='none';(M.el||document.body).appendChild(b);b.click();setTimeout(function(){b.remove();},50);},
  openDesk:openDesk,
  viewer:openViewer,lbClose:lbClose,lbNav:lbNav,lbGo:function(i){LB.i=i;lbRender();},lbSave:lbSave,lbMain:function(){var it=lbCur();if(it)setMain(it.id);},lbCopy:function(){var it=lbCur();if(!it)return;try{navigator.clipboard.writeText(it.url).then(function(){toast('✓ Link copied');});}catch(e){toast(it.url);}},setMain:setMain,delMedia:delMedia,
  pickDay:function(k){M.day=k;paint();},weekNav:function(n){if(n===0){M.week=0;M.day=new Date().toDateString();}else{M.week+=n;M.day=null;}paint();},
  matCat:function(c){M.mat.cat=c;paint();},matSort:function(v){M.mat.sort=v;paint();},matView:function(v){M.mat.view=v;paint();},
  recSet:function(k,v){M.rec[k]=v;var pos=document.activeElement&&document.activeElement.selectionStart;paint();if(k==='q'){var i=document.querySelector('.m360-search input');if(i){i.focus();try{i.setSelectionRange(pos,pos);}catch(e){}}}},
  toggleMonth:function(k){M.collapsed[k]=!M.collapsed[k];paint();},
  noteComposer:function(on){M.composer=!!on;paint();if(on){var t=document.getElementById('m360-note-body');if(t)t.focus();}},
  saveNote:function(){var t=document.getElementById('m360-note-body'),sh=document.getElementById('m360-note-share'),body=t&&t.value.trim();if(!body){toast('Write a note first');return;}notesApi({action:'create_note',body:body,visible_to_model:!!(sh&&sh.checked)}).then(function(){M.composer=false;toast('✓ Note added');return reload();}).catch(function(e){alert(e.message||e);});},
  noteVis:function(id,share){notesApi({action:'update_note',note_id:id,visible_to_model:!!share}).then(function(){toast(share?'✓ Note is now shareable':'✓ Note is now internal');return reload();}).catch(function(e){alert(e.message||e);});},
  noteDelete:function(id){if(!confirm('Delete this note?'))return;notesApi({action:'delete_note',note_id:id}).then(function(){toast('Note deleted');return reload();}).catch(function(e){alert(e.message||e);});},
  exportRecord:function(){
    var rows=[['When','Type','Title','Detail','By']].concat(recFiltered().map(function(a){return [a.at,a.kind,a.title,a.detail||'',a.actor_name||''];})).concat([[],['Notes'],['When','Visibility','Author','Note']]).concat(arr(M.d&&M.d.notes).map(function(n){return [n.created_at,n.visible_to_model?'Shareable':'Internal',n.author_name||'',n.body||''];}));
    var csv=rows.map(function(r){return r.map(function(c){c=String(c==null?'':c);return /[",\n]/.test(c)?'"'+c.replace(/"/g,'""')+'"':c;}).join(',');}).join('\n');
    var a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));a.download=(model().display_name||'model').replace(/\s+/g,'-').toLowerCase()+'-record.csv';document.body.appendChild(a);a.click();a.remove();setTimeout(function(){URL.revokeObjectURL(a.href);},1000);
  },
  refreshGameplan:function(){
    if(M.tab==='development')paint();
    if(M.gpLoading||!M.id)return;M.gpLoading=true;var before=JSON.stringify(M.gp||null);
    get('/api/agent/gameplan/v1?organization='+encodeURIComponent(org())+'&model_id='+encodeURIComponent(M.id)).then(function(gp){gp.model_id=M.id;M.gp=gp;},function(){}).then(function(){M.gpLoading=false;if(M.tab==='development'&&JSON.stringify(M.gp||null)!==before)paint();});
  }
};

window.renderModelDetailPage=render;
window.CAVYRE_SMART_GAMEPLAN_REFRESH=function(){window.CAVYRE_M360.refreshGameplan();};
})();
