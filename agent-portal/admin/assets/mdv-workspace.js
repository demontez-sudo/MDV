/* Maison Flow workspace: side menu, bottom dock, masthead and the Agency workspace home.
   Layout switch: Appearance → Layout (Workspace | Classic). Everything is scoped to html[data-outlook="workspace"]. */
(function(){
'use strict';
if(window.MDV_WORKSPACE)return;
var KEY='mdv-outlook';
function outlook(){try{return localStorage.getItem(KEY)==='classic'?'classic':'workspace';}catch(e){return 'workspace';}}
function apply(v){document.documentElement.setAttribute('data-outlook',v);}
apply(outlook());
function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
function arr(v){return Array.isArray(v)?v:[];}
function bridge(){var b=window.VEUX_AGENT_V4;if(!b||!b.api)throw new Error('not ready');return b;}
function org(){try{return bridge().state.org.slug||'maison-de-veux';}catch(e){return 'maison-de-veux';}}
function go(p){if(typeof window.navTo==='function')window.navTo(p);}
function dkey(v){var d=new Date(v);return isNaN(d)?'':d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
function ago(iso){var m=Math.round((Date.now()-new Date(iso))/6e4);if(isNaN(m))return '';if(m<1)return 'now';if(m<60)return m+'m ago';if(m<1440)return Math.round(m/60)+'h ago';if(m<2880)return 'Yesterday';return Math.round(m/1440)+'d ago';}
function initials(n){return String(n||'?').replace(/[^A-Za-z0-9 ]/g,'').split(/\s+/).filter(Boolean).slice(0,2).map(function(x){return x[0];}).join('').toUpperCase()||'?';}
function tint(s){var h=0;s=String(s||'');for(var i=0;i<s.length;i++)h=(h*31+s.charCodeAt(i))|0;return Math.abs(h)%360;}

/* ---------- menu: one grouped side bar with submenus ---------- */
var MENU=[
  {id:'home',label:'Home',icon:'ti-home-2',items:[['overview','Home']]},
  {id:'calendar',label:'Calendar & Schedule',icon:'ti-calendar',items:[['calendar','Calendar'],['availability','Availability'],['seasonmanagement','Season']]},
  {id:'talent',label:'Talent',icon:'ti-users',items:[['roster','Roster'],['scouting','Scouting'],['modeldevelopment','Development & Image'],['modelevaluations','Evaluations'],['modelsubmissions','Submissions']]},
  {id:'clients',label:'Clients',icon:'ti-briefcase',items:[['industrydirectory','Client Directory'],['multipackage','Packages'],['packageresponses','Package Responses']]},
  {id:'tasks',label:'Tasks & Approvals',icon:'ti-checkbox',items:[['tasksconsolidated','Tasks'],['approvals','Approvals'],['escalations','Escalations'],['changecontrol','Change Control']]},
  {id:'comms',label:'Communication',icon:'ti-message-circle',items:[['inbox','Messages'],['mail','Mail'],['editorial','Editorial']]},
  {id:'travel',label:'Travel & Visa',icon:'ti-plane',items:[['globalmobility','Mobility'],['visa','Visa & Compliance']]},
  {id:'finance',label:'Finance & Legal',icon:'ti-chart-bar',items:[['financelegal','Finance Overview'],['modelaccounts','Model Accounts'],['agentcommissions','Commissions']]},
  {id:'files',label:'Files & Forms',icon:'ti-files',items:[['filesforms','Files & Forms']]},
  {id:'team',label:'Team',icon:'ti-users-group',items:[['team','Team']]},
  {id:'vera',label:'Vera Intelligence',icon:'ti-sparkles',items:[['__vera__','Vera Intelligence']]}
];
var MENU_BOTTOM={id:'settings',label:'Settings',icon:'ti-settings',items:[['systemsettings','Portal Settings'],['releaseaudit','Release Audit']]};
var ALWAYS={overview:1,calendar:1,inbox:1,mail:1,systemsettings:1,__vera__:1};
var LINKED={visa:'globalmobility',agentcommissions:'financelegal'};
function groups(){return (window.NAV_AGENT||window.VEUX_V15_NAV_FULL||[]).filter(function(g){return g&&g.items&&g.items.length;});}
function allowed(){var ok=Object.assign({},ALWAYS);groups().forEach(function(g){g.items.forEach(function(i){ok[i[0]]=1;});});Object.keys(LINKED).forEach(function(k){if(ok[LINKED[k]])ok[k]=1;});return ok;}
function current(){var p=String(window._currentPage||'overview').toLowerCase();if(p==='season')return 'seasonmanagement';if(['industrydirectory','companies','contacts','allcontacts','clientbook'].indexOf(p)>-1)return 'industrydirectory';if(p==='mobility')return 'globalmobility';return p;}
function openSet(){try{return JSON.parse(localStorage.getItem('mdv-sb-open')||'[]');}catch(e){return [];}}
function saveOpen(a){try{localStorage.setItem('mdv-sb-open',JSON.stringify(a));}catch(e){}}
function collapsed(){try{return localStorage.getItem('mdv-sb-collapsed')==='1';}catch(e){return false;}}
function setCollapsed(v){try{localStorage.setItem('mdv-sb-collapsed',v?'1':'0');}catch(e){}document.documentElement.setAttribute('data-ws-collapsed',v?'1':'0');var i=document.querySelector('.ws-collapse i');if(i)i.className='ti '+(v?'ti-layout-sidebar-left-expand':'ti-layout-sidebar-left-collapse');}
document.documentElement.setAttribute('data-ws-collapsed',collapsed()?'1':'0');
function visibleMenu(){
  var ok=allowed(),seen={},out=[];
  MENU.concat([MENU_BOTTOM]).forEach(function(g){var items=g.items.filter(function(i){return ok[i[0]];});items.forEach(function(i){seen[i[0]]=1;});if(items.length)out.push({id:g.id,label:g.label,icon:g.icon,items:items,bottom:g===MENU_BOTTOM});});
  /* anything permitted that is not placed above lands in "More" so no page is ever unreachable */
  var extra=[];groups().forEach(function(g){g.items.forEach(function(i){if(!seen[i[0]]&&i[0]!=='overview'){seen[i[0]]=1;extra.push([i[0],i[1]]);}});});
  if(extra.length){var bi=out.findIndex(function(g){return g.bottom;});out.splice(bi<0?out.length:bi,0,{id:'more',label:'More',icon:'ti-layout-grid',items:extra});}
  return out;
}
function groupOf(menu,page){return menu.find(function(g){return g.items.some(function(i){return i[0]===page;});});}
var sig='',query='';
function itemHtml(g,i){return '<button type="button" class="ws-si" data-ws="'+esc(i[0])+'"><span>'+esc(i[1])+'</span></button>';}
function buildMenu(){
  var app=document.getElementById('app');if(!app)return;
  var menu=visibleMenu(),s=menu.map(function(g){return g.id+':'+g.items.map(function(i){return i[0];}).join();}).join('|');
  var sb=document.getElementById('ws-side');
  if(!sb){sb=document.createElement('nav');sb.id='ws-side';sb.setAttribute('aria-label','Main menu');app.appendChild(sb);sig='';}
  if(s!==sig){
    sig=s;
    function grp(g){
      var single=g.items.length===1,first=g.items[0];
      if(single)return '<div class="ws-g ws-direct" data-g="'+g.id+'"><button type="button" class="ws-gh" data-ws="'+esc(first[0])+'" title="'+esc(g.label)+'"><span class="ws-gi"><i class="ti '+g.icon+'"></i></span><b>'+esc(g.label)+'</b></button></div>';
      return '<div class="ws-g" data-g="'+g.id+'"><button type="button" class="ws-gh" data-ws-grp="'+g.id+'" aria-expanded="false" title="'+esc(g.label)+'"><span class="ws-gi"><i class="ti '+g.icon+'"></i></span><b>'+esc(g.label)+'</b><i class="ti ti-chevron-down ws-chev"></i></button><div class="ws-sub">'+g.items.map(function(i){return itemHtml(g,i);}).join('')+'</div></div>';
    }
    sb.innerHTML='<header class="ws-sbh"><a class="ws-logo" href="#" aria-label="Maison de Veux, home"><span>M</span><div><b>Maison de Veux</b><small>Maison Flow</small></div></a><button type="button" class="ws-collapse" data-ws-collapse aria-label="Collapse menu" title="Collapse menu"><i class="ti '+(collapsed()?'ti-layout-sidebar-left-expand':'ti-layout-sidebar-left-collapse')+'"></i></button></header>'
      +'<label class="ws-find"><i class="ti ti-search"></i><input type="search" placeholder="Find a page" autocomplete="off" aria-label="Find a page"></label>'
      +'<div class="ws-scroll"><div class="ws-groups">'+menu.filter(function(g){return !g.bottom;}).map(grp).join('')+'</div><div class="ws-results" hidden></div></div>'
      +'<div class="ws-sbf">'+menu.filter(function(g){return g.bottom;}).map(grp).join('')+'</div>';
    sb.querySelector('.ws-logo').onclick=function(e){e.preventDefault();go('overview');};
    var inp=sb.querySelector('.ws-find input');
    inp.oninput=function(){query=inp.value.trim().toLowerCase();paintResults(menu);};
    inp.onkeydown=function(e){if(e.key==='Enter'){var f=sb.querySelector('.ws-results [data-ws]');if(f){f.click();}}else if(e.key==='Escape'){inp.value='';query='';paintResults(menu);}};
    sb.dataset.menu=JSON.stringify(menu.map(function(g){return {id:g.id,label:g.label,items:g.items};}));
  }
  paintActive(menu);
}
function paintResults(menu){
  var sb=document.getElementById('ws-side'),res=sb.querySelector('.ws-results'),gr=sb.querySelector('.ws-groups');
  if(!query){res.hidden=true;gr.hidden=false;return;}
  var hits=[];menu.forEach(function(g){g.items.forEach(function(i){if((i[1]+' '+g.label).toLowerCase().indexOf(query)>=0)hits.push({g:g,i:i});});});
  gr.hidden=true;res.hidden=false;
  res.innerHTML=hits.length?hits.map(function(h){return '<button type="button" class="ws-si ws-hit" data-ws="'+esc(h.i[0])+'"><i class="ti '+h.g.icon+'"></i><span>'+esc(h.i[1])+'</span><small>'+esc(h.g.label)+'</small></button>';}).join(''):'<p class="ws-none">No page matches “'+esc(query)+'”.</p>';
}
function paintActive(menu){
  var sb=document.getElementById('ws-side');if(!sb)return;
  var cur=current(),g=groupOf(menu,cur),open=openSet();
  if(g&&g.items.length>1&&sb.dataset.curg!==cur){sb.dataset.curg=cur;if(open.indexOf(g.id)<0){open=[g.id];saveOpen(open);}}
  sb.querySelectorAll('.ws-g').forEach(function(el){
    var id=el.dataset.g,isOpen=open.indexOf(id)>=0,has=g&&g.id===id;
    el.classList.toggle('open',isOpen);el.classList.toggle('has',!!has);
    var h=el.querySelector('.ws-gh');if(h&&h.hasAttribute('data-ws-grp'))h.setAttribute('aria-expanded',isOpen?'true':'false');
    if(h&&h.hasAttribute('data-ws'))h.classList.toggle('on',h.dataset.ws===cur);
  });
  sb.querySelectorAll('.ws-si[data-ws]').forEach(function(b){b.classList.toggle('on',b.dataset.ws===cur);});
}
function fly(anchor,gid){
  var sb=document.getElementById('ws-side'),menu=JSON.parse(sb.dataset.menu||'[]'),g=menu.find(function(x){return x.id===gid;}),f=document.getElementById('ws-fly');
  if(!g){return;}
  if(!f){f=document.createElement('div');f.id='ws-fly';document.body.appendChild(f);f.addEventListener('mouseleave',function(){f.classList.remove('open');});}
  var r=anchor.getBoundingClientRect(),cur=current();
  f.innerHTML='<h4>'+esc(g.label)+'</h4>'+g.items.map(function(i){return '<button type="button" class="ws-si'+(i[0]===cur?' on':'')+'" data-ws="'+esc(i[0])+'"><span>'+esc(i[1])+'</span></button>';}).join('');
  f.style.top=Math.max(8,Math.min(innerHeight-60-g.items.length*40,r.top-6))+'px';f.classList.add('open');
}
function navigate(page){
  var f=document.getElementById('ws-fly');if(f)f.classList.remove('open');
  if(page==='__vera__'){if(window.MDV_VERA_CHAT&&MDV_VERA_CHAT.open)MDV_VERA_CHAT.open();else{var b=document.getElementById('_asst-btn');if(b)b.click();}return;}
  go(page);
}
document.addEventListener('click',function(e){
  var t=e.target;if(!t.closest)return;
  var col=t.closest('[data-ws-collapse]');if(col){setCollapsed(!collapsed());return;}
  var gh=t.closest('#ws-side [data-ws-grp]');
  if(gh){
    var id=gh.dataset.wsGrp;
    if(collapsed()){fly(gh,id);return;}
    var open=openSet(),i=open.indexOf(id);if(i>=0)open.splice(i,1);else open=[id];/* one section open at a time keeps the menu short */
    saveOpen(open);var sb=document.getElementById('ws-side');paintActive(JSON.parse(sb.dataset.menu||'[]').map(function(g){return g;}));
    return;
  }
  var b=t.closest('#ws-side [data-ws],#ws-fly [data-ws]');
  if(b){navigate(b.dataset.ws);var sb2=document.getElementById('ws-side');var inp=sb2&&sb2.querySelector('.ws-find input');if(inp&&inp.value){inp.value='';query='';paintResults(JSON.parse(sb2.dataset.menu||'[]'));}return;}
  var fl=document.getElementById('ws-fly');if(fl&&!t.closest('#ws-fly'))fl.classList.remove('open');
  var cm=document.querySelector('.ws-create.open');if(cm&&!t.closest('.ws-create'))cm.classList.remove('open');
});
document.addEventListener('mouseover',function(e){
  if(!collapsed())return;var gh=e.target.closest&&e.target.closest('#ws-side [data-ws-grp]');if(gh)fly(gh,gh.dataset.wsGrp);
});

/* masthead */
var MK=function(){try{return localStorage.getItem('mdv-market')||'both';}catch(e){return 'both';}};
function masthead(){
  var right=document.querySelector('#app .tb-right');
  if(right&&!right.querySelector('.ws-market')){
    var w=document.createElement('div');w.className='ws-market';
    function labelOf(v){return v==='ny'?'New York':v==='paris'?'Paris':'New York / Paris';}
    w.innerHTML='<button type="button" aria-haspopup="true"><span>'+labelOf(MK())+'</span><i class="ti ti-chevron-down"></i></button><div class="ws-mpop">'+[['both','New York / Paris'],['ny','New York'],['paris','Paris']].map(function(x){return '<button type="button" data-mk="'+x[0]+'">'+x[1]+'</button>';}).join('')+'</div>';
    w.onclick=function(e){var b=e.target.closest('[data-mk]');if(b){try{localStorage.setItem('mdv-market',b.dataset.mk);}catch(x){}w.querySelector('button span').textContent=labelOf(b.dataset.mk);w.classList.remove('open');window.dispatchEvent(new Event('mdv:market'));return;}w.classList.toggle('open');};
    document.addEventListener('click',function(e){if(!e.target.closest('.ws-market'))w.classList.remove('open');});
    right.insertBefore(w,right.firstChild);
    var d=document.createElement('span');d.className='ws-date';d.textContent=new Date().toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}).toUpperCase();right.insertBefore(d,w.nextSibling);
  }
}

/* ---------- home ---------- */
var S={tab:'overview',day:null,dayCache:{},dayBusy:false,board:'women',el:null,p:null,H:null};
var TABS=[['overview','Overview'],['desk','My desk'],['insights','Insights']];
function modelMap(p){var m={};arr(p.models).forEach(function(x){if(x&&x.id)m[x.id]=x;});arr(p.cal&&p.cal.lookups&&p.cal.lookups.models).forEach(function(x){if(x&&x.id&&!m[x.id])m[x.id]=x;});return m;}
function photoOf(m){if(!m)return '';var pm=m.primary_media||{};return String(pm.url||pm.public_url||m.image_url||m.avatar_url||m.profile_image_url||m.thumbnail_url||'').replace(/'/g,'%27').replace(/"/g,'%22');}
function nameOf(m){return (m&&(m.display_name||m.name||[m.first_name,m.last_name].filter(Boolean).join(' ')))||'Model';}
function avatarHtml(m,cls){var u=photoOf(m);return u?'<span class="'+cls+'" style="background-image:url(\''+esc(u)+'\')"></span>':'<span class="'+cls+' ph" style="--t:'+tint(nameOf(m))+'">'+esc(initials(nameOf(m)))+'</span>';}
function eventsOf(cal){
  var out=[];
  [['bookings','booking','booking_models'],['castings','casting','casting_models'],['events','event','event_models']].forEach(function(g){
    arr(cal&&cal[g[0]]).forEach(function(x){
      if(!x.starts_at)return;
      var links=arr(x[g[2]]||x.model_assignments),ms=links.map(function(l){return l.models||l;}).filter(function(q){return q&&(q.id||q.display_name||q.name);});
      var t=(x.title||'')+' '+((x.metadata&&x.metadata.calendar_event_type)||x.event_type||x.job_type||'');
      var kind=/travel|flight|arriv|depart/i.test(t)?'travel':g[1]==='casting'||/casting|go.?see|callback/i.test(t)?'casting':/fitting/i.test(t)?'fitting':g[1]==='booking'?'booking':'other';
      out.push({id:x.id,kind:g[1],type:kind,title:x.title||x.job_title||(g[1]==='casting'?'Casting':g[1]==='booking'?'Booking':'Event'),s:new Date(x.starts_at),e:x.ends_at?new Date(x.ends_at):null,loc:x.location||'',market:String((x.markets&&x.markets.name)||x.market_name||x.market||''),status:String(x.status||''),models:ms,raw:x});
    });
  });
  return out.sort(function(a,b){return a.s-b.s;});
}
function marketOk(ev){var m=MK();if(m==='both')return true;var t=(ev.market+' '+ev.loc).toLowerCase();if(!t.trim())return true;return m==='paris'?/paris|france/.test(t):/new york|nyc|ny\b|brooklyn|manhattan|queens/.test(t);}

function timeline(p,H){
  var key=S.day||dkey(new Date()),isToday=key===dkey(new Date()),cal=S.dayCache[key]||(isToday?p.cal:null),mm=modelMap(p);
  var all=cal?eventsOf(cal).filter(function(e){return dkey(e.s)===key&&marketOk(e);}):[];
  var rows={},order=[];
  all.forEach(function(e){(e.models.length?e.models:[{id:'x'+e.id,display_name:e.client||'Unassigned'}]).forEach(function(q){var id=q.id||q.display_name,r=rows[id];if(!r){r=rows[id]={m:mm[q.id]||q,ev:[]};order.push(id);}r.ev.push(e);});});
  var list=order.map(function(id){return rows[id];}).slice(0,6);
  /* fill with available talent so the board never looks empty */
  if(list.length<3){arr(p.models).filter(function(m){return !rows[m.id]&&!/inactive|archiv|paused|hold/i.test(String(m.status||''));}).slice(0,3-list.length).forEach(function(m){list.push({m:m,ev:[]});});}
  var h0=9,h1=18;all.forEach(function(e){h0=Math.min(h0,e.s.getHours());var en=e.e||new Date(e.s.getTime()+36e5);h1=Math.max(h1,en.getHours()+(en.getMinutes()?1:0));});
  h0=Math.max(0,Math.min(h0,9));h1=Math.min(24,Math.max(h1,h0+8));var span=(h1-h0)*60,now=new Date(),nowMin=now.getHours()*60+now.getMinutes()-h0*60;
  var cols='';for(var h=h0;h<h1;h++)cols+='<span>'+String(h).padStart(2,'0')+':00</span>';
  var body=list.map(function(r){
    var live=r.ev.some(function(e){var en=e.e||new Date(e.s.getTime()+36e5);return isToday&&e.s<=now&&en>=now;});
    var cards=r.ev.map(function(e){
      var st=(e.s.getHours()*60+e.s.getMinutes()-h0*60),en=e.e?(e.e.getHours()*60+e.e.getMinutes()-h0*60):st+60,dur=Math.max(30,en-st),
          left=Math.max(0,st/span*100),width=Math.min(100-left,dur/span*100),durTxt=dur>=60?(Math.floor(dur/60)+'h'+(dur%60?' '+(dur%60)+'m':'')):dur+'m';
      var hm=function(d){return d.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'});};
      return '<button type="button" class="ws-ev k-'+e.type+'" data-vx17-nav="calendar" style="left:'+left.toFixed(2)+'%;width:'+Math.max(width,13).toFixed(2)+'%">'+avatarHtml(r.m,'ws-evp')+'<span class="ws-evt"><b>'+esc(e.title)+'</b><small>'+hm(e.s)+(e.e?' – '+hm(e.e):'')+' · '+durTxt+'</small>'+(e.loc?'<small class="loc"><i class="ti ti-map-pin"></i>'+esc(e.loc)+'</small>':'')+'</span></button>';
    }).join('');
    return '<div class="ws-trow"><div class="ws-who">'+avatarHtml(r.m,'ws-wp')+'<span><b>'+esc(nameOf(r.m).toUpperCase())+'</b><small>'+esc(r.m.gender?'Model':'Model')+'</small><em class="'+(live?'live':'')+'"><i></i>'+(live?'On set':'Available')+'</em></span></div><div class="ws-lane" style="--cols:'+(h1-h0)+'">'+cards+'</div></div>';
  }).join('');
  var nowLine=(isToday&&nowMin>0&&nowMin<span)?'<div class="ws-now" style="left:'+(nowMin/span*100).toFixed(2)+'%"><span>'+now.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})+'</span></div>':'';
  var dl=new Date(key+'T12:00:00').toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short',year:'numeric'});
  var empty=all.length?'':'<p class="ws-empty">Nothing booked on this day'+(MK()!=='both'?' in this market':'')+'. Available talent is shown below.</p>';
  return '<section class="ws-card ws-motion"><header><h2>Today in motion <button type="button" class="ws-go" data-vx17-nav="calendar" aria-label="Open calendar"><i class="ti ti-chevron-right"></i></button></h2>'
    +'<div class="ws-dnav"><span>'+esc(dl)+'</span><button type="button" data-ws-day="-1" aria-label="Previous day"><i class="ti ti-chevron-left"></i></button><button type="button" data-ws-day="1" aria-label="Next day"><i class="ti ti-chevron-right"></i></button><select data-ws-view aria-label="View"><option>Day</option><option value="week">Week</option></select></div></header>'
    +empty+'<div class="ws-tgrid"><div class="ws-hours"><span></span><div>'+cols+'</div></div><div class="ws-tbody">'+body+'<div class="ws-lanes-fx" aria-hidden="true">'+nowLine+'</div></div></div></section>';
}
function stats(p){
  var cal=eventsOf(p.cal),today=dkey(new Date()),total=arr(p.bookings).length,todayN=cal.filter(function(e){return e.kind==='booking'&&dkey(e.s)===today;}).length;
  var talent=arr(p.models).length,wk=arr(p.models).filter(function(m){return m.created_at&&Date.now()-new Date(m.created_at)<7*864e5;}).length;
  var appr=arr(p.tasks&&p.tasks.approvals).length,ready=talent?Math.round(p.ready/talent*100):100;
  function cell(icon,n,l,sub){return '<div class="ws-stat"><i class="ti '+icon+'"></i><b>'+n+'</b><span>'+l+'</span><small>'+sub+'</small></div>';}
  return '<section class="ws-stats">'+cell('ti-calendar-event',total,'Bookings','+'+todayN+' today')+cell('ti-users',talent,'Talent',wk?'+'+wk+' this week':'active')+cell('ti-file-check',String(appr).padStart(2,'0'),'Approvals',appr?appr+' pending':'all clear')+'<div class="ws-stat"><span class="ws-ring" style="--p:'+ready+'"></span><b>'+ready+'%</b><span>Ready</span><small>'+(ready>=90?'All systems go':'Needs updates')+'</small></div></section>';
}
function genderOf(m){var g=String(m.gender||m.sex||'').toLowerCase();return /^f|wom/.test(g)?'women':/^m|^men/.test(g)?'men':'';}
function isNew(m){var t=String(m.stage||'')+' '+arr(m.tags).map(function(x){return x.name;}).join(' ')+' '+arr(m.divisions).map(function(x){return (x.name||'')+(x.board||'');}).join(' ');return /new.?face|development/i.test(t)||(m.created_at&&Date.now()-new Date(m.created_at)<60*864e5);}
function board(p){
  var all=arr(p.models),tab=S.board,list=all.filter(function(m){return tab==='women'?genderOf(m)==='women':tab==='men'?genderOf(m)==='men':isNew(m);});
  if(!list.length&&tab!=='new')list=all;
  var cards=list.slice(0,4).map(function(m){
    var u=photoOf(m),mk=m.primary_market_label||arr(m.markets).map(function(x){return x.name||x.city;}).filter(Boolean).slice(0,2).join(' / ')||'',st=String(m.status||'active').toLowerCase(),on=/set|booked|busy/.test(st);
    return '<button type="button" class="ws-mc'+(u?'':' ph')+'" data-vx17-nav="roster" data-vx17-record-type="model" data-vx17-record-id="'+esc(m.id||'')+'" style="'+(u?'background-image:url(\''+esc(u)+'\')':'--t:'+tint(nameOf(m)))+'"><span class="ws-star"><i class="ti ti-star"></i></span>'+(u?'':'<em class="ini">'+esc(initials(nameOf(m)))+'</em>')+'<span class="ws-mi"><b>'+esc(nameOf(m).toUpperCase())+'</b><small>'+esc(mk||'Maison de Veux')+'</small><span class="'+(on?'busy':'ok')+'"><i></i>'+(on?'On set':'Available')+'</span></span></button>';
  }).join('')||'<p class="ws-empty">No talent in this group yet.</p>';
  var tabs=[['women','Women'],['men','Men'],['new','New Faces']].map(function(t){return '<button type="button" class="'+(tab===t[0]?'on':'')+'" data-ws-board="'+t[0]+'">'+t[1]+'</button>';}).join('');
  var act=arr(p.relationships&&p.relationships.activity).slice(0,3).map(function(a){var name=a.company_name||(a.company&&a.company.name)||a.client_name||a.title||'Client',line=a.summary||a.description||a.activity_type||a.type||a.action||'Activity';return '<button type="button" class="ws-act" data-vx17-nav="industrydirectory"><span class="ws-ci" style="--t:'+tint(name)+'">'+esc(initials(name))+'</span><span><b>'+esc(name)+'</b><small>'+esc(String(line).replace(/_/g,' '))+'</small></span><em>'+esc(ago(a.created_at||a.occurred_at||a.at))+'</em></button>';}).join('')
    ||arr(p.relationships&&p.relationships.stale).slice(0,3).map(function(x){var name=(x.company&&x.company.name)||'Client';return '<button type="button" class="ws-act" data-vx17-nav="industrydirectory"><span class="ws-ci" style="--t:'+tint(name)+'">'+esc(initials(name))+'</span><span><b>'+esc(name)+'</b><small>Follow-up due</small></span><em>Today</em></button>';}).join('')
    ||'<p class="ws-empty">No recent client activity.</p>';
  return '<section class="ws-card ws-board"><div class="ws-bleft"><header><h2>The board <button type="button" class="ws-go" data-vx17-nav="roster" aria-label="Open roster"><i class="ti ti-chevron-right"></i></button></h2><div class="ws-seg">'+tabs+'</div><button type="button" class="ws-link" data-vx17-nav="roster">View all <i class="ti ti-chevron-right"></i></button></header><div class="ws-mcs">'+cards+'</div></div>'
    +'<div class="ws-bright"><header><h3>Client activity</h3><button type="button" class="ws-link" data-vx17-nav="industrydirectory">View all <i class="ti ti-chevron-right"></i></button></header>'+act+'</div></section>';
}
function veraPanel(p,H){
  var sig=H.veraSignals(p),n=sig.length,rows=sig.slice(0,3).map(function(x){
    var verb=/conflict|overlap/i.test(x.title)?'Open':/approv|review|submission|digital|portfolio/i.test(x.title+' '+x.domain)?'Review':/confirm|arriv|travel/i.test(x.title+' '+x.domain)?'Confirm':'Open';
    return '<div class="ws-vr"><span class="ws-vi" style="--t:'+tint(x.domain)+'"><i class="ti '+(/mobility|travel/i.test(x.domain)?'ti-plane':/finance|invoice/i.test(x.domain)?'ti-cash':/calendar|booking/i.test(x.domain)?'ti-calendar-event':/task/i.test(x.domain)?'ti-checkbox':'ti-sparkles')+'"></i></span><span class="ws-vt"><b>'+esc(x.title)+'</b><small>'+esc(String(x.domain||'').toUpperCase())+' · '+esc(x.detail||'')+'</small></span><button type="button" data-vx17-nav="'+esc(x.nav)+'" data-vx17-record-type="'+esc(x.recordType||'')+'" data-vx17-record-id="'+esc(x.recordId||'')+'">'+verb+'</button></div>';
  }).join('')||'<p class="ws-empty">Nothing needs a decision right now.</p>';
  var trav=eventsOf(p.cal).filter(function(e){return e.type==='travel'&&e.s>=new Date(Date.now()-864e5);})[0],mm=modelMap(p),mv='';
  if(trav){var q=trav.models[0],m=q?(mm[q.id]||q):null,route=(trav.title.match(/\b([A-Z]{3})\b\s*(?:→|->|to|–|-)\s*\b([A-Z]{3})\b/)||[]),txt=trav.s.toLocaleDateString('en-GB',{day:'numeric',month:'short'});
    mv='<div class="ws-mv" data-vx17-nav="globalmobility" role="button" tabindex="0">'+avatarHtml(m,'ws-mvp')+'<span><b>'+esc(nameOf(m).toUpperCase())+'</b>'+(route[1]?'<strong>'+route[1]+' <i class="ti ti-arrow-narrow-right"></i> '+route[2]+'</strong>':'<strong>'+esc(trav.title)+'</strong>')+'<small>'+esc(txt)+'</small></span><i class="ti ti-plane-departure ws-plane"></i></div>';}
  else mv='<p class="ws-empty">No travel scheduled.</p>';
  return '<aside class="ws-vera"><div class="ws-vtop"><span class="ws-orb" aria-hidden="true"></span><h2>Vera</h2><small>Agency intelligence</small></div>'
    +'<h3>'+(n?(n===1?'One decision needs':n<=3?['','','Two decisions need','Three decisions need'][n]:n+' decisions need')+' your attention.':'You are all caught up.')+'</h3><div class="ws-vrows">'+rows+'</div>'
    +'<header class="ws-vh"><h3>Movement</h3><button type="button" class="ws-link" data-vx17-nav="globalmobility">View travel <i class="ti ti-chevron-right"></i></button></header>'+mv
    +'<form class="ws-ask" data-ws-ask><i class="ti ti-sparkles"></i><input type="text" placeholder="What would you like to do?" aria-label="Ask Vera"><button type="submit" aria-label="Ask"><i class="ti ti-arrow-right"></i></button></form></aside>';
}
function createMenu(){
  var items=[['New booking','ti-calendar-plus','book'],['New casting','ti-camera','cast'],['New task','ti-checkbox','task'],['New message','ti-mail','mail'],['Add talent','ti-user-plus','roster']];
  return '<div class="ws-create"><button type="button" data-ws-create><i class="ti ti-plus"></i> Create <i class="ti ti-chevron-down"></i></button><div class="ws-cpop">'+items.map(function(x){return '<button type="button" data-ws-new="'+x[2]+'"><i class="ti '+x[1]+'"></i>'+x[0]+'</button>';}).join('')+'</div></div>';
}
function insights(p,H){
  var ss=H.series(p.cal),mx=Math.max.apply(null,ss.map(function(x){return x.v}))||1;
  var bars=ss.map(function(x){var dl=new Date(x.k+'T12:00:00').toLocaleDateString([],{weekday:'long',month:'short',day:'numeric'});return '<button type="button" class="vx17-bar" data-vx17-day="'+x.k+'" title="'+esc(dl+' · '+x.v+' scheduled')+'" style="--h:'+Math.max(18,Math.round(x.v/mx*100))+'%"><em>'+x.v+'</em><span>'+x.l+'</span></button>';}).join('');
  return '<div class="ws-two"><section class="ws-card"><header><h2>Schedule load</h2></header><div class="vx17-bars ws-bars">'+bars+'</div></section>'+H.incPanel(p)+'</div>';
}
function desk(p,H){return '<div class="ws-two">'+H.focusPanel(p)+H.calPanel(p)+'</div>';}
function paint(){
  var el=S.el,p=S.p,H=S.H;if(!el||!p)return;
  var body=S.tab==='desk'?desk(p,H):S.tab==='insights'?insights(p,H):timeline(p,H)+stats(p)+board(p);
  el.innerHTML='<div class="ws-home"><section class="ws-main"><header class="ws-title"><h1>Agency workspace</h1><span class="ws-live"><i></i>Live</span>'+createMenu()+'</header>'
    +'<nav class="ws-tabs">'+TABS.map(function(t){return '<button type="button" class="'+(S.tab===t[0]?'on':'')+'" data-ws-tab="'+t[0]+'">'+t[1]+'</button>';}).join('')+'</nav>'+body+'</section>'+veraPanel(p,H)+'</div>';
  H.bind&&H.bind(el);
}
function fetchDay(key){
  if(S.dayCache[key]||S.dayBusy)return Promise.resolve();
  S.dayBusy=true;var s=new Date(key+'T00:00:00'),e=new Date(s.getTime()+864e5);
  return bridge().api('/api/agent/calendar/v9?organization='+encodeURIComponent(org())+'&start='+encodeURIComponent(s.toISOString())+'&end='+encodeURIComponent(e.toISOString())+'&_t='+Date.now(),{method:'GET',headers:{},__fresh:true})
    .then(function(d){S.dayCache[key]=d||{};}).catch(function(){S.dayCache[key]={};}).then(function(){S.dayBusy=false;});
}
document.addEventListener('click',function(e){
  var host=e.target.closest&&e.target.closest('.ws-home');if(!host)return;
  var t=e.target.closest('[data-ws-tab]');if(t){S.tab=t.dataset.wsTab;paint();return;}
  var b=e.target.closest('[data-ws-board]');if(b){S.board=b.dataset.wsBoard;paint();return;}
  var d=e.target.closest('[data-ws-day]');if(d){var base=new Date((S.day||dkey(new Date()))+'T12:00:00');base.setDate(base.getDate()+Number(d.dataset.wsDay));S.day=dkey(base);fetchDay(S.day).then(paint);paint();return;}
  var c=e.target.closest('[data-ws-create]');if(c){c.closest('.ws-create').classList.toggle('open');return;}
  var n=e.target.closest('[data-ws-new]');if(n){
    n.closest('.ws-create').classList.remove('open');var k=n.dataset.wsNew;
    if(k==='mail'){if(window.MDV_MAIL&&MDV_MAIL.emailTo)try{MDV_MAIL.emailTo([]);return;}catch(x){}go('mail');}
    else if(k==='task'){go('tasksconsolidated');}
    else if(k==='roster'){go('roster');}
    else if(window.VEUX_V152&&VEUX_V152.createOnDate){VEUX_V152.createOnDate(dkey(new Date()));}else go('calendar');
    return;}
});
document.addEventListener('change',function(e){var v=e.target.closest&&e.target.closest('[data-ws-view]');if(v&&v.value==='week'){v.value='Day';go('calendar');}});
document.addEventListener('submit',function(e){var f=e.target.closest&&e.target.closest('[data-ws-ask]');if(!f)return;e.preventDefault();var i=f.querySelector('input'),q=i.value.trim();i.value='';if(window.MDV_VERA_CHAT&&MDV_VERA_CHAT.open)MDV_VERA_CHAT.open(q||undefined);});
window.addEventListener('mdv:market',function(){if(S.el&&S.el.isConnected)paint();});

function home(el,p,H){
  S.el=el;S.p=p;S.H=H;if(!S.day)S.day=dkey(new Date());
  paint();
  var key=S.day;if(key!==dkey(new Date()))fetchDay(key).then(paint);
}

/* ---------- Appearance toggle ---------- */
function layoutRow(){
  document.querySelectorAll('#vx-wave-settings,.mdv-appearance .v152-settings-grid').forEach(function(host){
    if(!host||host.querySelector('.ws-layoutrow')||host.parentNode.querySelector('.ws-layoutrow'))return;
    var row=document.createElement('div');row.className='ws-layoutrow';
    function paintRow(){var cur=outlook();row.innerHTML='<b>Layout</b><button type="button" data-ol="workspace" class="'+(cur==='workspace'?'on':'')+'">Workspace</button><button type="button" data-ol="classic" class="'+(cur==='classic'?'on':'')+'">Classic</button><span>Workspace has the side menu with a bottom dock and the new home. Classic is the previous look.</span>';
      row.querySelectorAll('[data-ol]').forEach(function(b){b.onclick=function(){window.MDV_WORKSPACE.set(b.dataset.ol);paintRow();};});}
    paintRow();host.parentNode.insertBefore(row,host);
  });
}

/* one-time: the Maison Flow look is purple; move people still on the default Classic skin to it (they can switch back) */
function skinOnce(){
  try{
    if(localStorage.getItem('mdv-ws-skin'))return;
    var w=window.VEUX_COLOR_WAVES;if(!w||typeof w.set!=='function')return;
    localStorage.setItem('mdv-ws-skin','1');
    var cur=document.documentElement.getAttribute('data-veux-wave')||'classic';
    if(cur==='classic'&&outlook()==='workspace')w.set('purple');
  }catch(e){}
}

function tick(){
  try{
    layoutRow();
    if(document.documentElement.getAttribute('data-outlook')!=='workspace')return;
    buildMenu();masthead();skinOnce();
  }catch(e){}
}
setInterval(tick,700);
var raf=0;new MutationObserver(function(){if(raf)return;raf=requestAnimationFrame(function(){raf=0;tick();});}).observe(document.documentElement,{childList:true,subtree:true});
window.MDV_WORKSPACE={active:function(){return outlook()==='workspace'&&window.matchMedia&&!window.matchMedia('(max-width:900px)').matches;},home:home,get:outlook,set:function(v){try{localStorage.setItem(KEY,v);}catch(e){}apply(v);tick();if(window.VEUX_SMART_PORTAL&&VEUX_SMART_PORTAL.refresh&&String(window._currentPage||'')==='overview')VEUX_SMART_PORTAL.refresh();}};
tick();
})();
