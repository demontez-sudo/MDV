/* Maison Flow workspace: sectioned side menu, masthead and the Agency Command home.
   Layout switch: Appearance → Layout (Workspace | Classic). Everything is scoped to html[data-outlook="workspace"]. */
(function(){
'use strict';
if(window.MDV_WORKSPACE)return;
var KEY='mdv-outlook';
function outlook(){try{return localStorage.getItem(KEY)==='classic'?'classic':'workspace';}catch(e){return 'workspace';}}
function apply(v){document.documentElement.setAttribute('data-outlook',v);}
apply(outlook());
function size(){try{return localStorage.getItem('mdv-ws-size')==='standard'?'standard':'compact';}catch(e){return 'compact';}}
document.documentElement.setAttribute('data-ws-size',size());
function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
function arr(v){return Array.isArray(v)?v:[];}
function bridge(){var b=window.VEUX_AGENT_V4;if(!b||!b.api)throw new Error('not ready');return b;}
function org(){try{return bridge().state.org.slug||'maison-de-veux';}catch(e){return 'maison-de-veux';}}
function go(p){if(typeof window.navTo==='function')window.navTo(p);}
function dkey(v){var d=new Date(v);return isNaN(d)?'':d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
function initials(n){return String(n||'?').replace(/[^A-Za-z0-9 ]/g,'').split(/\s+/).filter(Boolean).slice(0,2).map(function(x){return x[0];}).join('').toUpperCase()||'?';}
function tint(s){var h=0;s=String(s||'');for(var i=0;i<s.length;i++)h=(h*31+s.charCodeAt(i))|0;return Math.abs(h)%360;}
function hm(d){return new Date(d).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'});}
function money(n,c){try{return new Intl.NumberFormat('en-US',{style:'currency',currency:c||'USD',maximumFractionDigits:0}).format(Number(n)||0);}catch(e){return '$'+Math.round(Number(n)||0);}}
function dayDiff(iso){if(!iso)return null;var d=new Date(iso);if(isNaN(d))return null;var a=new Date(d.getFullYear(),d.getMonth(),d.getDate()),n=new Date();n=new Date(n.getFullYear(),n.getMonth(),n.getDate());return Math.round((a-n)/864e5);}

/* ================= menu ================= */
var SECTIONS=[
 {cap:'Daily',items:[
  {id:'home',label:'Home',icon:'ti-home-2',page:'overview'},
  {id:'tasks',label:'Tasks',icon:'ti-checkbox',page:'tasksconsolidated',badge:'tasks',sub:[['tasksconsolidated','Tasks'],['approvals','Approvals'],['escalations','Escalations'],['changecontrol','Change Control']]},
  {id:'messages',label:'Messages',icon:'ti-message-circle',page:'inbox'},
  {id:'mail',label:'Mail',icon:'ti-mail',page:'mail',badge:'mail'},
  {id:'calendar',label:'Calendar',icon:'ti-calendar',page:'calendar',sub:[['calendar','Calendar'],['availability','Availability']]}]},
 {cap:'Agency',items:[
  {id:'roster',label:'Roster',icon:'ti-users',page:'roster'},
  {id:'clients',label:'Clients',icon:'ti-user-circle',page:'industrydirectory'},
  {id:'modeltools',label:'Model Tools',icon:'ti-heart-handshake',sub:[['multipackage','Packages'],['packageresponses','Package Responses'],['modelevaluations','Evaluations'],['modelsubmissions','Submissions']]},
  {id:'scouting',label:'Scouting',icon:'ti-user-search',page:'scouting'},
  {id:'season',label:'Season',icon:'ti-layout-grid',page:'seasonmanagement'},
  {id:'development',label:'Development',icon:'ti-chart-bar',page:'modeldevelopment'},
  {id:'editorial',label:'Editorial',icon:'ti-notebook',page:'editorial'}]},
 {cap:'Management',items:[
  {id:'travel',label:'Travel & Visa',icon:'ti-plane',sub:[['globalmobility','Mobility'],['visa','Visa & Compliance']]},
  {id:'finance',label:'Finance & Legal',icon:'ti-scale',sub:[['financelegal','Finance Overview'],['modelaccounts','Model Accounts'],['agentcommissions','Commissions']]},
  {id:'team',label:'Team',icon:'ti-users-group',page:'team'},
  {id:'files',label:'Files & Forms',icon:'ti-file-text',page:'filesforms'}]}
];
var SETTINGS={id:'settings',label:'Settings',icon:'ti-settings',sub:[['systemsettings','Portal Settings'],['releaseaudit','Release Audit']]};
var ALWAYS={overview:1,calendar:1,inbox:1,mail:1,systemsettings:1};
var LINKED={visa:'globalmobility',agentcommissions:'financelegal'};
function groups(){return (window.NAV_AGENT||window.VEUX_V15_NAV_FULL||[]).filter(function(g){return g&&g.items&&g.items.length;});}
function allowed(){var ok=Object.assign({},ALWAYS);groups().forEach(function(g){g.items.forEach(function(i){ok[i[0]]=1;});});Object.keys(LINKED).forEach(function(k){if(ok[LINKED[k]])ok[k]=1;});return ok;}
function current(){var p=String(window._currentPage||'overview').toLowerCase();if(p==='season')return 'seasonmanagement';if(['industrydirectory','companies','contacts','allcontacts','clientbook'].indexOf(p)>-1)return 'industrydirectory';if(p==='mobility')return 'globalmobility';return p;}
function visible(){
  var ok=allowed(),seen={};
  function fix(it){var sub=arr(it.sub).filter(function(s){return ok[s[0]];}),page=it.page&&ok[it.page]?it.page:(sub[0]&&sub[0][0])||null;if(!page)return null;sub.forEach(function(s){seen[s[0]]=1;});seen[page]=1;return Object.assign({},it,{page:page,sub:sub.length>1?sub:[]});}
  var secs=SECTIONS.map(function(sc){return {cap:sc.cap,items:sc.items.map(fix).filter(Boolean)};}).filter(function(sc){return sc.items.length;});
  var settings=fix(SETTINGS);
  var extra=[];groups().forEach(function(g){g.items.forEach(function(i){if(!seen[i[0]]&&i[0]!=='overview'){seen[i[0]]=1;extra.push([i[0],i[1]]);}});});
  if(extra.length)secs.push({cap:'More',items:[{id:'more',label:'More pages',icon:'ti-dots',page:extra[0][0],sub:extra.length>1?extra:[]}]});
  return {secs:secs,settings:settings};
}
function pagesOf(it){return [it.page].concat(arr(it.sub).map(function(s){return s[0];}));}
var sig='',openId='';
var DOCK=[['tasksconsolidated','Tasks','ti-checkbox'],['multipackage','Packages','ti-package'],['mail','Mail','ti-mail'],['financelegal','Finance','ti-chart-bar'],['globalmobility','Travel','ti-plane']];
function buildDock(){
  var app=document.getElementById('app');if(!app)return;
  var ok=allowed(),items=DOCK.filter(function(d){return ok[d[0]];}),dk=document.getElementById('ws-dock');
  if(!dk){dk=document.createElement('nav');dk.id='ws-dock';dk.setAttribute('aria-label','Shortcuts');app.appendChild(dk);}
  var s=items.map(function(d){return d[0];}).join();
  if(dk.dataset.sig!==s){dk.dataset.sig=s;dk.innerHTML=items.map(function(d){return '<button type="button" class="ws-dk" data-dock="'+d[0]+'"><i class="ti '+d[2]+'"></i><span>'+d[1]+'</span>'+(d[0]==='tasksconsolidated'||d[0]==='mail'?'<em class="ws-dkb" data-badge="'+(d[0]==='mail'?'mail':'tasks')+'" hidden></em>':'')+'</button>';}).join('');}
  var cur=current();dk.querySelectorAll('.ws-dk').forEach(function(b){b.classList.toggle('on',b.dataset.dock===cur||(b.dataset.dock==='globalmobility'&&cur==='visa')||(b.dataset.dock==='financelegal'&&['modelaccounts','agentcommissions'].indexOf(cur)>-1));});
}
function itemHtml(it){
  var has=it.sub&&it.sub.length;
  return '<button type="button" class="ws-it" data-item="'+it.id+'" data-page="'+esc(it.page)+'"'+(has?' data-sub="1" aria-haspopup="true"':'')+'><i class="ti '+it.icon+' ws-ic"></i><span>'+esc(it.label)+'</span>'+(it.badge?'<em class="ws-badge" data-badge="'+it.badge+'" hidden></em>':'')+(has?'<i class="ti ti-chevron-right ws-ch"></i>':'')+'</button>';
}
function userCard(){
  var n=(document.getElementById('tbName')||{}).textContent||'',r=(document.getElementById('tbRole')||{}).textContent||'';
  return '<button type="button" class="ws-user" data-ws-user><span class="ws-uav">'+esc(initials(n))+'</span><span class="ws-un"><b>'+esc(n||'Your account')+'</b><small>'+esc(r||'Team')+'</small></span><i class="ti ti-chevron-right ws-ch"></i></button>';
}
function buildMenu(){
  var app=document.getElementById('app');if(!app)return;
  var v=visible(),s=v.secs.map(function(sc){return sc.cap+sc.items.map(function(i){return i.id+i.page+arr(i.sub).length;}).join();}).join('|')+((document.getElementById('tbName')||{}).textContent||'');
  var sb=document.getElementById('ws-side');
  if(!sb){sb=document.createElement('nav');sb.id='ws-side';sb.setAttribute('aria-label','Main menu');app.appendChild(sb);sig='';}
  if(s!==sig){
    sig=s;
    sb.innerHTML='<a class="ws-logo" href="#" aria-label="Maison de Veux, home"><span class="ws-sym" aria-hidden="true"></span><small>Maison Flow</small></a>'
      +'<div class="ws-scroll">'+v.secs.map(function(sc){return '<div class="ws-sec"><h4>'+esc(sc.cap)+'</h4>'+sc.items.map(itemHtml).join('')+'</div>';}).join('')+'</div>'
      +'<div class="ws-sbf">'+(v.settings?itemHtml(v.settings):'')+userCard()+'</div>';
    sb.querySelector('.ws-logo').onclick=function(e){e.preventDefault();go('overview');};
    sb.__items={};v.secs.forEach(function(sc){sc.items.forEach(function(i){sb.__items[i.id]=i;});});if(v.settings)sb.__items.settings=v.settings;
    badges();
  }
  var cur=current();
  sb.querySelectorAll('.ws-it').forEach(function(b){var it=sb.__items[b.dataset.item],on=it&&pagesOf(it).indexOf(cur)>=0;b.classList.toggle('on',!!on);});
}
function badges(){
  var p=window.VEUX_SMART_PORTAL&&VEUX_SMART_PORTAL.last,sb=document.getElementById('ws-side');if(!sb)return;
  var w=window.MDV_MAIL&&MDV_MAIL.widget&&MDV_MAIL.widget();
  var counts={tasks:p&&p.tasks?arr(p.tasks.open).length:0,mail:(w&&w.unread)||0};
  document.querySelectorAll('#ws-side [data-badge],#ws-dock [data-badge]').forEach(function(e){var n=counts[e.dataset.badge]||0;e.hidden=!n;e.textContent=n>99?'99+':n;});
}
function fly(anchor,it){
  var f=document.getElementById('ws-fly');
  if(!f){f=document.createElement('div');f.id='ws-fly';document.body.appendChild(f);}
  var cur=current();
  f.innerHTML='<h4>'+esc(it.label)+'</h4>'+arr(it.sub).map(function(s){return '<button type="button" class="ws-fi'+(s[0]===cur?' on':'')+'" data-go="'+esc(s[0])+'">'+esc(s[1])+'</button>';}).join('');
  var app=document.getElementById('app');if(f.parentNode!==app)app.appendChild(f);
  var y=0,n=anchor,sb=document.getElementById('ws-side'),sc=anchor.closest('.ws-scroll');while(n&&n!==sb){y+=n.offsetTop;n=n.offsetParent;}if(sc)y-=sc.scrollTop;
  var vh=window.innerHeight/(parseFloat(getComputedStyle(document.body).zoom)||1);f.style.top=Math.max(8,Math.min(vh-70-it.sub.length*40,y-8))+'px';f.classList.add('open');openId=it.id;
}
function closeFly(){var f=document.getElementById('ws-fly');if(f)f.classList.remove('open');openId='';}
function navigate(page){closeFly();go(page);}
document.addEventListener('click',function(e){
  var t=e.target;if(!t.closest)return;
  var so=t.closest('#ws-fly [data-go="__signout__"]');if(so){closeFly();if(typeof window.signOut==='function')window.signOut();return;}
  var it=t.closest('#ws-side .ws-it');
  if(it){var sb=document.getElementById('ws-side'),def=sb.__items&&sb.__items[it.dataset.item];if(def&&def.sub&&def.sub.length){if(openId===def.id)closeFly();else fly(it,def);}else navigate(it.dataset.page);return;}
  var dk=t.closest('#ws-dock [data-dock]');if(dk){navigate(dk.dataset.dock);return;}
  var fi=t.closest('#ws-fly [data-go]');if(fi){navigate(fi.dataset.go);return;}
  var u=t.closest('[data-ws-user]');if(u){if(openId==='user')closeFly();else fly(u,{id:'user',label:'Account',sub:[['systemsettings','Settings & appearance'],['__signout__','Sign out']]});return;}
  if(!t.closest('#ws-fly'))closeFly();
  var cm=document.querySelector('.ws-create.open');if(cm&&!t.closest('.ws-create'))cm.classList.remove('open');
});
document.addEventListener('keydown',function(e){if(e.key==='Escape')closeFly();});

/* ================= masthead ================= */
var TEMPS={ny:'',paris:''};
function temp(lat,lon,k){try{fetch('https://api.open-meteo.com/v1/forecast?latitude='+lat+'&longitude='+lon+'&current=temperature_2m&temperature_unit=fahrenheit').then(function(r){return r.json();}).then(function(d){var t=Math.round(d.current&&d.current.temperature_2m);if(isFinite(t)){TEMPS[k]=t+'°F';clocks();}}).catch(function(){});}catch(e){}}
function clocks(){
  var el=document.getElementById('ws-clocks');if(!el)return;var n=new Date();
  function one(tz,label,k){var t=n.toLocaleTimeString('en-GB',{timeZone:tz,hour:'2-digit',minute:'2-digit'}),d=n.toLocaleDateString('en-US',{timeZone:tz,weekday:'short',month:'short',day:'numeric'});return '<div><small>'+label+'</small><b>'+t+'</b><span>'+d+(TEMPS[k]?' <i>•</i> '+TEMPS[k]:'')+'</span></div>';}
  el.innerHTML=one('America/New_York','New York','ny')+one('Europe/Paris','Paris','paris');
}
function masthead(){
  var tb=document.querySelector('#app .topbar');if(!tb)return;
  var brand=tb.querySelector('.tb-brand');
  if(brand&&!brand.querySelector('.ws-brand')){
    var a=document.createElement('a');a.className='ws-brand';a.href='#';a.setAttribute('aria-label','Maison de Veux, home');a.innerHTML='<b>Maison de Veux</b><small>Agent Portal</small>';a.onclick=function(e){e.preventDefault();go('overview');};brand.appendChild(a);
  }
  var cmd=tb.querySelector('.vx73-command input');if(cmd&&cmd.placeholder.indexOf('Find anything')<0)cmd.placeholder='Find anything — talent, clients, bookings, tasks…';
  var right=tb.querySelector('.tb-right');
  if(right&&!document.getElementById('ws-clocks')){
    var c=document.createElement('div');c.id='ws-clocks';right.parentNode.insertBefore(c,right);clocks();temp(40.71,-74.01,'ny');temp(48.86,2.35,'paris');
  }
}
setInterval(function(){clocks();},15000);

/* ================= home: Agency Command ================= */
var S={deskRange:'today',deskScope:'mine',sday:null,dayCache:{},el:null,p:null,H:null};
function modelMap(p){var m={};arr(p.models).forEach(function(x){if(x&&x.id)m[x.id]=x;});arr(p.cal&&p.cal.lookups&&p.cal.lookups.models).forEach(function(x){if(x&&x.id&&!m[x.id])m[x.id]=x;});return m;}
function photoOf(m){if(!m)return '';var pm=m.primary_media||{};return String(pm.url||pm.public_url||m.image_url||m.avatar_url||m.profile_image_url||m.thumbnail_url||'').replace(/'/g,'%27').replace(/"/g,'%22');}
function nameOf(m){return (m&&(m.display_name||m.name||[m.first_name,m.last_name].filter(Boolean).join(' ')))||'Model';}
function thumb(m,cls,fallbackName){var u=photoOf(m),n=nameOf(m)||fallbackName;return u?'<span class="'+cls+'" style="background-image:url(\''+esc(u)+'\')"></span>':'<span class="'+cls+' ph" style="--t:'+tint(n)+'">'+esc(initials(n))+'</span>';}
function eventsOf(cal){
  var out=[];
  [['bookings','booking','booking_models'],['castings','casting','casting_models'],['events','event','event_models']].forEach(function(g){
    arr(cal&&cal[g[0]]).forEach(function(x){
      if(!x.starts_at)return;
      var links=arr(x[g[2]]||x.model_assignments),ms=links.map(function(l){return l.models||l;}).filter(function(q){return q&&(q.id||q.display_name||q.name);});
      var t=(x.title||'')+' '+((x.metadata&&x.metadata.calendar_event_type)||x.event_type||x.job_type||'');
      var type=/travel|flight|arriv|depart/i.test(t)?'Travel':g[1]==='casting'||/casting|go.?see|callback/i.test(t)?'Casting':/fitting/i.test(t)?'Fitting':g[1]==='booking'?'Booking':'Meeting';
      out.push({id:x.id,kind:g[1],type:type,title:x.title||x.job_title||type,s:new Date(x.starts_at),e:x.ends_at?new Date(x.ends_at):null,loc:x.location||'',client:(x.companies&&x.companies.name)||x.client_name||'',market:String((x.markets&&x.markets.name)||x.market_name||x.market||x.location||''),status:String(x.status||''),models:ms,raw:x});
    });
  });
  return out.sort(function(a,b){return a.s-b.s;});
}
function spark(vals,w,h){
  if(!vals.length)return '';var mx=Math.max.apply(null,vals)||1,mn=Math.min.apply(null,vals),rg=(mx-mn)||1;
  var pts=vals.map(function(v,i){return (i/(Math.max(1,vals.length-1))*w).toFixed(1)+','+(h-2-((v-mn)/rg)*(h-6)).toFixed(1);});
  return '<svg class="ws-sp" viewBox="0 0 '+w+' '+h+'" preserveAspectRatio="none" aria-hidden="true"><polyline fill="none" stroke="currentColor" stroke-width="1.6" points="'+pts.join(' ')+'"/></svg>';
}
function bars(vals){var mx=Math.max.apply(null,vals)||1;return '<span class="ws-bs" aria-hidden="true">'+vals.map(function(v){return '<i style="height:'+Math.max(10,Math.round(v/mx*100))+'%"></i>';}).join('')+'</span>';}
function weekDays(){var t=new Date();t.setHours(12,0,0,0);var m=new Date(t);m.setDate(t.getDate()-((t.getDay()+6)%7));var out=[];for(var i=0;i<7;i++){var d=new Date(m);d.setDate(m.getDate()+i);out.push(d);}return out;}

function stripHtml(p,H){
  var ev=eventsOf(p.cal),days=weekDays(),wk=days.map(function(d){return ev.filter(function(e){return e.kind==='booking'&&dkey(e.s)===dkey(d);}).length;}),weekN=wk.reduce(function(a,b){return a+b;},0);
  var talent=arr(p.models).length,ready=p.ready||0,amt=H.amount,
      val=days.map(function(d){return arr(p.bookings).filter(function(b){return dkey(b.starts_at)===dkey(d);}).reduce(function(n,b){return n+Number(amt(b)||0);},0);}),valTotal=val.reduce(function(a,b){return a+b;},0);
  var unpaid=arr(p.finance&&p.finance.unpaid),os=Number(p.finance&&p.finance.outstanding||0),cur=(p.finance&&p.finance.currency)||'USD',osSeries=unpaid.slice(0,10).map(function(x){return Number(x.amount_due||x.balance_due||0);});
  function cell(icon,big,label,sub,vis){return '<div class="ws-st"><i class="ti '+icon+' ws-sti"></i><div class="ws-stn"><b>'+big+'</b></div><div class="ws-stl"><span>'+label+'</span><small>'+sub+'</small></div><div class="ws-stv">'+vis+'</div></div>';}
  return '<section class="ws-strip">'+cell('ti-calendar-event',weekN||arr(p.bookings).length,'Bookings','this week',bars(wk.some(function(x){return x;})?wk:[1,1,1,1,1,1,1]))
   +cell('ti-users',talent,'Active talent',ready+' ready',bars(arr(p.models).slice(0,8).map(function(m,i){return 4+((i*3)%5);})))
   +cell('ti-currency-dollar',money(valTotal||arr(p.bookings).reduce(function(n,b){return n+Number(amt(b)||0);},0),cur),'Booking value','this week',spark(val.length?val:[0,0],70,28))
   +cell('ti-file-invoice',money(os,cur),'Outstanding',unpaid.length+' invoice'+(unpaid.length===1?'':'s'),spark(osSeries.length>1?osSeries:[0,0],70,28))+'</section>';
}

/* ----- desk ----- */
function deskItems(p,H){
  var mm=modelMap(p),members=arr(p.taskMembers),memberById={};members.forEach(function(m){memberById[m.id]=m;});
  var uid=null;try{var st=bridge().state;uid=(st.user&&st.user.id)||(st.session&&st.session.user&&st.session.user.id)||null;}catch(e){}
  var me=uid?members.filter(function(m){return m.user_id===uid;})[0]:null,out=[];
  function mname(m){return m?((m.profile&&m.profile.display_name)||m.job_title||'Team'):'Unassigned';}
  arr(p.tasks&&p.tasks.open).forEach(function(t){
    var due=t.due_at||t.due_date||null,d=dayDiff(due),pr=String(t.priority||'').toLowerCase(),owners=arr(t.assignments||t.assignees).map(function(a){return memberById[a.member_id||a]||null;}).filter(Boolean),mod=mm[t.model_id];
    out.push({k:'task',pri:(d!=null&&d<0)||/urgent|critical/.test(pr)?'r':d===0||/high/.test(pr)?'o':/low/.test(pr)?'g':'y',title:t.title||'Task',sub:(mod?nameOf(mod)+' · ':'')+String(t.category||'Task'),model:mod||null,owner:owners[0]?mname(owners[0]):'Unassigned',due:due,btn:'Open',nav:'tasksconsolidated',mine:!owners.length||!me||owners.some(function(o){return o.id===me.id;}),id:t.id});
  });
  arr(p.tasks&&p.tasks.approvals).forEach(function(a){var due=a.due_at||a.created_at||null;out.push({k:'approval',pri:'o',title:a.title||a.subject||'Approval required',sub:a.requested_by_name||a.type||'Needs a decision',owner:(me&&mname(me))||'You',due:due,btn:'Approve',nav:'approvals',mine:true,id:a.id});});
  H.calList(p.cal).filter(function(x){var t=new Date(x.starts_at).getTime();return t>=Date.now()&&t<=Date.now()+48*36e5&&/pending|hold|tentative|await|invited/i.test(x.status);}).slice(0,3).forEach(function(x){out.push({k:'booking',pri:'y',title:'Confirm '+x.title,sub:(x.models[0]||'')+(x.sub?(x.models[0]?' · ':'')+x.sub:''),owner:'Bookings',due:x.starts_at,btn:'Review',nav:'calendar',mine:true,modelName:x.models[0]});});
  arr(p.finance&&p.finance.overdue).slice(0,2).forEach(function(x){out.push({k:'invoice',pri:'r',title:'Follow up overdue invoice',sub:((x.companies&&x.companies.name)||'Client')+' · '+(x.invoice_number||'Invoice'),owner:'Finance',due:x.due_date||null,btn:'Open',nav:'agentcommissions',mine:true,overdue:true});});
  H.veraSignals(p).filter(function(x){return /blocked|critical/.test(x.severity);}).slice(0,2).forEach(function(x){out.push({k:'vera',pri:'r',title:x.title,sub:String(x.domain||'')+' · '+(x.detail||''),owner:'Vera',due:null,btn:'Open',nav:x.nav,mine:true,blocked:true,rt:x.recordType,rid:x.recordId});});
  return out;
}
function dueLabel(it){
  if(it.overdue)return {t:'Overdue',c:'over'};var d=dayDiff(it.due);
  if(d==null)return {t:'—',c:''};if(d<0)return {t:'Overdue',c:'over'};
  if(d===0){var dt=new Date(it.due),timed=(dt.getHours()||dt.getMinutes())&&!(dt.getHours()===12&&dt.getMinutes()===0)&&it.k==='booking';return timed?{t:hm(it.due),c:''}:{t:'Today',c:'today'};}
  if(d===1)return {t:'Tomorrow',c:''};return {t:new Date(it.due).toLocaleDateString('en-GB',{day:'numeric',month:'short'}),c:''};
}
function deskHtml(p,H){
  var all=deskItems(p,H),bucket=function(it){if(it.overdue)return 'overdue';var d=dayDiff(it.due);return d!=null&&d<0?'overdue':d===0?'today':'upcoming';};
  var counts={today:0,upcoming:0,overdue:0};all.forEach(function(i){counts[bucket(i)]++;});
  var rows=all.filter(function(i){return bucket(i)===S.deskRange&&(S.deskScope==='team'||i.mine);});
  rows.sort(function(a,b){var o={r:0,o:1,y:2,g:3};return o[a.pri]-o[b.pri]||(new Date(a.due||8e15)-new Date(b.due||8e15));});
  var dueToday=counts.today,appr=arr(p.tasks&&p.tasks.approvals).length,blocked=all.filter(function(i){return i.blocked;}).length;
  var body=rows.slice(0,6).map(function(i){
    var d=dueLabel(i),mod=i.model||(i.modelName?arr(p.models).filter(function(m){return nameOf(m)===i.modelName;})[0]:null);
    var rec=mod?thumb(mod,'ws-dp'):'<span class="ws-dp ph" style="--t:'+tint(i.title)+'">'+esc(initials(i.sub||i.title))+'</span>';
    return '<div class="ws-dr"><span class="ws-pr pr-'+i.pri+'"></span><div class="ws-rec">'+rec+'<span><b>'+esc(i.title)+'</b><small>'+esc(i.sub)+'</small></span></div><div class="ws-own"><span class="ws-oav">'+esc(initials(i.owner))+'</span><span>'+esc(i.owner)+'</span></div><span class="ws-due '+d.c+'">'+esc(d.t)+'</span><button type="button" class="ws-act" data-vx17-nav="'+esc(i.nav)+'" data-vx17-record-type="'+esc(i.rt||'')+'" data-vx17-record-id="'+esc(i.rid||'')+'">'+i.btn+'</button><button type="button" class="ws-more" aria-label="More">⋯</button></div>';
  }).join('')||'<p class="ws-empty">Nothing here. Clear desk.</p>';
  var tab=function(a,k,label){return '<button type="button" class="'+(S[a]===k?'on':'')+'" data-ws-'+(a==='deskRange'?'range':'scope')+'="'+k+'">'+label+'</button>';};
  return '<section class="ws-card ws-desk"><header><h2>Agency Desk</h2><span class="ws-rule"></span><div class="ws-seg">'+tab('deskRange','today','Today')+tab('deskRange','upcoming','Upcoming')+tab('deskRange','overdue','Overdue')+'</div><div class="ws-seg">'+tab('deskScope','mine','My tasks')+tab('deskScope','team','Team')+'</div></header>'
    +'<p class="ws-dsum"><b>'+dueToday+'</b> due today<i>·</i><b>'+appr+'</b> approvals<i>·</i><b>'+blocked+'</b> blocked</p>'
    +'<div class="ws-dh"><span>Priority</span><span>Action / Record</span><span>Owner</span><span>Due</span><span>Next step</span><span></span></div>'+body
    +'<footer><button type="button" class="ws-link" data-vx17-nav="tasksconsolidated">View all tasks →</button></footer></section>';
}

/* ----- schedule ----- */
function scheduleHtml(p){
  var key=S.sday||dkey(new Date()),days=weekDays(),todayK=dkey(new Date()),diff=dayDiff(key+'T12:00:00');
  var cal=S.dayCache[key]||(diff!=null&&diff>=0&&diff<=8?p.cal:null),mm=modelMap(p);
  var list=cal?eventsOf(cal).filter(function(e){return dkey(e.s)===key;}):[];
  var strip=days.map(function(d){var k=dkey(d);return '<button type="button" class="'+(k===key?'on':'')+(k===todayK?' today':'')+'" data-ws-sday="'+k+'"><small>'+d.toLocaleDateString('en-US',{weekday:'short'}).toUpperCase()+'</small><b>'+d.getDate()+'</b></button>';}).join('');
  var rows=list.slice(0,5).map(function(e){
    var q=e.models[0],m=q?(mm[q.id]||q):null,who=m?nameOf(m):(e.client||e.title);
    return '<button type="button" class="ws-sr" data-vx17-nav="calendar"><span class="ws-st1">'+hm(e.s)+'</span>'+(m?thumb(m,'ws-sp1'):'<span class="ws-sp1 ph" style="--t:'+tint(who)+'">'+esc(initials(who))+'</span>')+'<span class="ws-sw"><b>'+esc(who)+'</b><small>'+esc(e.type+(e.client?' – '+e.client:e.title&&e.title!==e.type?' – '+e.title:''))+'</small></span><span class="ws-sm">'+esc(String(e.market||'').split(',')[0].slice(0,14))+'</span><i class="ti ti-map-pin"></i></button>';
  }).join('')||'<p class="ws-empty">Nothing scheduled.</p>';
  return '<section class="ws-card ws-sched"><header><h2>Today’s Schedule</h2><button type="button" class="ws-link" data-vx17-nav="calendar">View calendar →</button></header><div class="ws-wk">'+strip+'</div><div class="ws-sl">'+rows+'</div>'+veraHtml(p)+'</section>';
}
function veraHtml(p){
  var sg=S.H.veraSignals(p),top=sg[0],n=sg.length;
  var txt=top?(n>1?n+' items need a decision. ':'')+top.title+(top.detail?' — '+top.detail:''):'Nothing needs a decision right now.';
  return '<div class="ws-vera"><header><span class="ws-vmark"></span><h3>Vera Briefing</h3><button type="button" class="ws-more" aria-label="Ask Vera" data-vx17-vera>⋯</button></header><div class="ws-vb"><p>'+esc(txt)+'</p>'+(top?'<button type="button" class="ws-act" data-vx17-nav="'+esc(top.nav)+'" data-vx17-record-type="'+esc(top.recordType||'')+'" data-vx17-record-id="'+esc(top.recordId||'')+'">Review options</button>':'')+'</div>'
    +'<form class="ws-ask" data-ws-ask><i class="ti ti-sparkles"></i><input type="text" placeholder="Ask Vera to research, decide or draft…" aria-label="Ask Vera"><button type="submit" aria-label="Ask"><i class="ti ti-arrow-right"></i></button></form></div>';
}

/* ----- talent readiness ----- */
function talentHtml(p){
  var ev=eventsOf(p.cal),mob={};
  arr(p.mobility&&p.mobility.items).forEach(function(x){var b=x.booking||{};arr(b.booking_models).forEach(function(l){var q=l.models||l;if(q&&q.id)mob[q.id]=1;});});
  var opt={};ev.filter(function(e){return /pending|hold|tentative|option/i.test(e.status);}).forEach(function(e){e.models.forEach(function(q){if(q.id)opt[q.id]=1;});});
  var list=arr(p.models).filter(function(m){return !/inactive|archiv|paused/i.test(String(m.status||''));}).slice(0,4);
  var cards=list.map(function(m){
    var st=mob[m.id]?['Visa review','y']:opt[m.id]?['On option','g']:!photoOf(m)?['Digitals due','y']:['Ready','g'];
    var mk=m.primary_market_label||arr(m.markets).map(function(x){return x.name||x.city;}).filter(Boolean).slice(0,2).join(' / ')||'',u=photoOf(m);
    return '<button type="button" class="ws-tc" data-vx17-nav="roster" data-vx17-record-type="model" data-vx17-record-id="'+esc(m.id||'')+'"><span class="ws-tp'+(u?'':' ph')+'" style="'+(u?'background-image:url(\''+esc(u)+'\')':'--t:'+tint(nameOf(m)))+'">'+(u?'':'<em>'+esc(initials(nameOf(m)))+'</em>')+'</span><span class="ws-tn"><b>'+esc(nameOf(m))+'</b><span class="ws-ts"><i class="d-'+st[1]+'"></i>'+st[0]+'</span><small>'+esc(mk||'Maison de Veux')+'</small></span><i class="ti ti-plane-departure ws-tpl"></i></button>';
  }).join('')||'<p class="ws-empty">No talent yet.</p>';
  return '<section class="ws-card ws-talent"><header><h2>Talent Readiness</h2><button type="button" class="ws-link" data-vx17-nav="roster">View roster →</button></header><div class="ws-tcs">'+cards+'</div></section>';
}

/* ----- finance watch ----- */
function financeHtml(p){
  var f=p.finance||{},cur=f.currency||'USD',now=new Date();now.setHours(0,0,0,0);var t0=+now,DAY=864e5;
  var pays=arr(f.payments).filter(function(x){return String(x.status||'')!=='failed';}).map(function(x){return{d:+new Date(x.paid_at||x.settled_at||x.created_at||0),a:Number(x.base_amount||x.amount||0)};});
  function sum(a,b){return pays.filter(function(x){return x.d>=a&&x.d<b;}).reduce(function(n,x){return n+x.a;},0);}
  var inc=sum(t0-6*DAY,t0+DAY),prev=sum(t0-13*DAY,t0-6*DAY),delta=prev>0?Math.round((inc-prev)/prev*100):null,series=[];for(var i=13;i>=0;i--)series.push(sum(t0-i*DAY,t0-(i-1)*DAY));
  var unpaid=arr(f.unpaid).slice().sort(function(a,b){return new Date(a.due_date||8e15)-new Date(b.due_date||8e15);});
  var rows=unpaid.slice(0,2).map(function(x){var over=/overdue/i.test(x.status||'')||(x.due_date&&+new Date(x.due_date)<Date.now());return '<div class="ws-fr"><b>'+esc((x.companies&&x.companies.name)||'Client')+'</b><span>• '+esc(x.invoice_number||'Invoice')+'</span><em>'+money(x.amount_due||x.balance_due,x.currency||cur)+'</em><span class="'+(over?'bad':'warn')+'"><i></i>'+(over?'Overdue':'Due '+(x.due_date?new Date(x.due_date).toLocaleDateString('en-GB',{day:'numeric',month:'short'}):'soon'))+'</span><button type="button" class="ws-act sm" data-vx17-nav="agentcommissions">View</button></div>';}).join('')||'<p class="ws-empty">No open invoices.</p>';
  return '<section class="ws-card ws-fin"><header><h2>Finance Watch</h2><button type="button" class="ws-link" data-vx17-nav="agentcommissions">View finance →</button></header>'
    +'<div class="ws-fk"><div><b>'+money(inc,cur)+'</b><span>Incoming<br><small>(7 days)</small></span>'+(delta==null?'':'<em class="'+(delta>=0?'up':'down')+'">'+(delta>=0?'↑ ':'↓ ')+Math.abs(delta)+'%</em>')+'</div><div><b>'+money(f.outstanding,cur)+'</b><span>Outstanding<br><small>('+unpaid.length+' invoice'+(unpaid.length===1?'':'s')+')</small></span></div><div class="ws-fsp">'+spark(series,160,48)+'</div></div>'+rows+'</section>';
}

/* ----- client signals + mail ----- */
function signalsHtml(p){
  var act=arr(p.relationships&&p.relationships.activity).slice(0,3);
  var rows=act.map(function(a){var name=a.company_name||(a.company&&a.company.name)||a.client_name||a.title||'Client',t=a.created_at||a.occurred_at||a.at;return '<button type="button" class="ws-cs" data-vx17-nav="industrydirectory"><span class="t">'+(t?hm(t):'')+'</span><i class="d-o"></i><b>'+esc(name)+'</b><span class="ev">'+esc(String(a.activity_type||a.type||a.action||'Activity').replace(/_/g,' '))+'</span><small>'+esc(a.summary||a.description||'')+'</small><span class="ws-ct" style="--t:'+tint(name)+'">'+esc(initials(name))+'</span></button>';}).join('')
    ||arr(p.relationships&&p.relationships.stale).slice(0,3).map(function(x){var name=(x.company&&x.company.name)||'Client';return '<button type="button" class="ws-cs" data-vx17-nav="industrydirectory"><span class="t">Today</span><i class="d-o"></i><b>'+esc(name)+'</b><span class="ev">Follow-up due</span><small>'+(x.days>999?'No recent activity':x.days+' days since activity')+'</small><span class="ws-ct" style="--t:'+tint(name)+'">'+esc(initials(name))+'</span></button>';}).join('')
    ||'<p class="ws-empty">No client signals yet.</p>';
  return '<section class="ws-card ws-sig"><header><h2>Client Signals</h2><button type="button" class="ws-link" data-vx17-nav="industrydirectory">View all →</button></header>'+rows+'</section>';
}
function mailHtml(){
  var w=window.MDV_MAIL&&MDV_MAIL.widget&&MDV_MAIL.widget(),rows='';
  if(!w){rows='<p class="ws-empty">Checking your inbox…</p>';try{if(window.MDV_MAIL&&MDV_MAIL.refreshWidget)MDV_MAIL.refreshWidget();}catch(e){}}
  else if(w.state==='ok'){rows=arr(w.rows).slice(0,3).map(function(m){var from=(m.from&&(m.from.name||m.from.address))||'Unknown';return '<button type="button" class="ws-ml" data-vx17-nav="mail"><span class="t">'+hm(m.received)+'</span><i class="'+(m.is_read?'d-g':'d-o')+'"></i><b>'+esc(from)+'</b><span class="sj">'+esc(m.subject)+'</span><small>'+esc(m.preview||'')+'</small>'+(m.has_attachments?'<i class="ti ti-paperclip clip"></i>':'<span></span>')+'</button>';}).join('')||'<p class="ws-empty">Inbox is clear.</p>';}
  else rows='<p class="ws-empty">Connect your email to see messages here. <button type="button" class="ws-link" data-vx17-nav="mail">Open mail →</button></p>';
  return '<section class="ws-card ws-mail"><header><h2>Mail &amp; Handoffs</h2><button type="button" class="ws-link" data-vx17-nav="mail">Open inbox →</button></header>'+rows+'</section>';
}
function createMenu(){
  var items=[['New booking','ti-calendar-plus','book'],['New casting','ti-camera','cast'],['New task','ti-checkbox','task'],['New message','ti-mail','mail'],['Add talent','ti-user-plus','roster']];
  return '<div class="ws-create"><button type="button" data-ws-create><i class="ti ti-plus"></i> CREATE <i class="ti ti-chevron-down"></i></button><div class="ws-cpop">'+items.map(function(x){return '<button type="button" data-ws-new="'+x[2]+'"><i class="ti '+x[1]+'"></i>'+x[0]+'</button>';}).join('')+'</div></div>';
}
function glanceHtml(){
  var tb=null;try{tb=window.MDV_SCHEDULE&&MDV_SCHEDULE.todayBlocks&&MDV_SCHEDULE.todayBlocks();}catch(e){}
  if(!tb||!tb.spans.length)return '';
  var sp=tb.spans,a=Math.floor(Math.min.apply(null,sp.map(function(x){return x.s;}))/60)*60,b=Math.ceil(Math.max.apply(null,sp.map(function(x){return x.e;}))/60)*60,span=b-a,n=new Date(),nm=n.getHours()*60+n.getMinutes();
  function cat(c){return c==='mdv'||c==='casa'||c==='cavyre'?'work':c==='body'?'health':'daily';}
  var ticks='';for(var h=Math.ceil(a/60/3)*3;h*60<=b;h+=3){ticks+='<span style="left:'+((h*60-a)/span*100).toFixed(2)+'%">'+(h%12||12)+' '+(h>=12?'PM':'AM')+'</span>';}
  var blocks=sp.map(function(x){return '<button type="button" class="ws-gb g-'+cat(x.c)+'" data-ws-open-day style="left:'+((x.s-a)/span*100).toFixed(3)+'%;width:'+Math.max(0.6,(x.e-x.s)/span*100-0.25).toFixed(3)+'%" title="'+esc(x.t)+'"><span>'+esc(x.t)+'</span></button>';}).join('');
  var now=(nm>=a&&nm<=b)?'<i class="ws-gn" style="left:'+((nm-a)/span*100).toFixed(2)+'%"></i>':'';
  return '<section class="ws-card ws-glance"><header><h2>Day at a glance</h2><span class="ws-gl"><i class="g-daily"></i>Daily<i class="g-work"></i>Work<i class="g-health"></i>Health</span><button type="button" class="ws-link" data-ws-open-day>Open Today →</button></header><div class="ws-gt">'+ticks+'</div><div class="ws-gbar">'+blocks+now+'</div></section>';
}
function paint(){
  var el=S.el,p=S.p,H=S.H;if(!el||!p)return;
  var now=new Date();
  el.innerHTML='<div class="ws-home"><header class="ws-head"><div><div class="ws-eye">'+now.toLocaleDateString('en-US',{weekday:'long'}).toUpperCase()+' <i>/</i> '+now.toLocaleDateString('en-US',{month:'long',day:'numeric'}).toUpperCase()+'</div><h1>AGENCY <em>COMMAND</em></h1></div><p>Agency performance. Daily action. One workspace.</p>'+createMenu()+'</header>'
    +stripHtml(p,H)
    +glanceHtml()
    +'<div class="ws-r2">'+deskHtml(p,H)+scheduleHtml(p)+'</div>'
    +'<div class="ws-r3">'+talentHtml(p)+financeHtml(p)+'</div>'
    +'<div class="ws-r4">'+signalsHtml(p)+mailHtml()+'</div></div>';
  H.bind&&H.bind(el);
}
function fetchDay(key){
  if(S.dayCache[key])return Promise.resolve();
  var s=new Date(key+'T00:00:00'),e=new Date(s.getTime()+864e5);
  return bridge().api('/api/agent/calendar/v9?organization='+encodeURIComponent(org())+'&start='+encodeURIComponent(s.toISOString())+'&end='+encodeURIComponent(e.toISOString())+'&_t='+Date.now(),{method:'GET',headers:{},__fresh:true}).then(function(d){S.dayCache[key]=d||{};}).catch(function(){S.dayCache[key]={};});
}
document.addEventListener('click',function(e){
  var host=e.target.closest&&e.target.closest('.ws-home');if(!host)return;
  var r=e.target.closest('[data-ws-range]');if(r){S.deskRange=r.dataset.wsRange;paint();return;}
  var sc=e.target.closest('[data-ws-scope]');if(sc){S.deskScope=sc.dataset.wsScope;paint();return;}
  var d=e.target.closest('[data-ws-sday]');if(d){S.sday=d.dataset.wsSday;paint();if(!S.dayCache[S.sday])fetchDay(S.sday).then(paint);return;}
  if(e.target.closest('[data-ws-open-day]')){go('dayschedule');return;}
  var c=e.target.closest('[data-ws-create]');if(c){c.closest('.ws-create').classList.toggle('open');return;}
  var n=e.target.closest('[data-ws-new]');if(n){
    n.closest('.ws-create').classList.remove('open');var k=n.dataset.wsNew;
    if(k==='mail'){if(window.MDV_MAIL&&MDV_MAIL.emailTo)try{MDV_MAIL.emailTo([]);return;}catch(x){}go('mail');}
    else if(k==='task')go('tasksconsolidated');else if(k==='roster')go('roster');
    else if(window.VEUX_V152&&VEUX_V152.createOnDate)VEUX_V152.createOnDate(dkey(new Date()));else go('calendar');
  }
});
document.addEventListener('submit',function(e){var f=e.target.closest&&e.target.closest('[data-ws-ask]');if(!f)return;e.preventDefault();var i=f.querySelector('input'),q=i.value.trim();i.value='';if(window.MDV_VERA_CHAT&&MDV_VERA_CHAT.open)MDV_VERA_CHAT.open(q||undefined);});
window.addEventListener('mdv:mail-widget',function(){if(S.el&&S.el.isConnected&&S.p)paint();badges();});
function home(el,p,H){S.el=el;S.p=p;S.H=H;if(!S.sday)S.sday=dkey(new Date());paint();badges();}

/* ================= appearance + one-time skin ================= */
function layoutRow(){
  document.querySelectorAll('#vx-wave-settings,.mdv-appearance .v152-settings-grid').forEach(function(host){
    if(!host||host.querySelector('.ws-layoutrow')||host.parentNode.querySelector('.ws-layoutrow'))return;
    var row=document.createElement('div');row.className='ws-layoutrow';
    function paintRow(){var cur=outlook();row.innerHTML='<b>Layout</b><button type="button" data-ol="workspace" class="'+(cur==='workspace'?'on':'')+'">Workspace</button><button type="button" data-ol="classic" class="'+(cur==='classic'?'on':'')+'">Classic</button><b style="margin-left:18px">Size</b><button type="button" data-size="compact" class="'+(size()==='compact'?'on':'')+'">Compact</button><button type="button" data-size="standard" class="'+(size()==='standard'?'on':'')+'">Standard</button><span>Workspace has the sectioned side menu and the Agency Command home. Classic is the previous look. Compact fits more on screen.</span>';
      row.querySelectorAll('[data-ol]').forEach(function(b){b.onclick=function(){window.MDV_WORKSPACE.set(b.dataset.ol);paintRow();};});
      row.querySelectorAll('[data-size]').forEach(function(b){b.onclick=function(){try{localStorage.setItem('mdv-ws-size',b.dataset.size);}catch(x){}document.documentElement.setAttribute('data-ws-size',b.dataset.size);paintRow();};});}
    paintRow();host.parentNode.insertBefore(row,host);
  });
}
/* one-time: the Agency Command look is copper on black; move people on the default or the earlier violet trial to Burnt Orange */
function skinOnce(){
  try{
    if(localStorage.getItem('mdv-ws-skin2'))return;
    var w=window.VEUX_COLOR_WAVES;if(!w||typeof w.set!=='function')return;
    localStorage.setItem('mdv-ws-skin2','1');
    var cur=document.documentElement.getAttribute('data-veux-wave')||'classic';
    if((cur==='classic'||cur==='purple')&&outlook()==='workspace')w.set('burntOrange');
  }catch(e){}
}
function docTop(el){var y=0,n=el;while(n){y+=n.offsetTop||0;n=n.offsetParent;}return y;}
/* keep the page content just under the top bar, whatever else the page adds above it */
function tighten(){
  var tb=document.querySelector('#app .topbar'),root=document.documentElement;if(!tb)return;
  var panel=document.querySelector('#pm .panel.on, .pm .panel.on');if(!panel){return;}
  var first=null,kids=panel.children;for(var i=0;i<kids.length;i++){var k=kids[i];if(k.offsetParent===null&&getComputedStyle(k).position!=='fixed')continue;if(k.offsetHeight>8){first=k;break;}}
  if(!first)return;
  var inner=first.querySelector('.ws-home')||first;
  var cur=parseFloat(root.style.getPropertyValue('--ws-adj'))||0;
  var tbBottom=(tb.offsetTop||0)+tb.offsetHeight,want=tbBottom+14,have=docTop(first);
  if(window.scrollY>2)return;
  var next=Math.max(-160,Math.min(60,Math.round(cur-(have-want))));
  if(Math.abs(next-cur)>2)root.style.setProperty('--ws-adj',next+'px');
}
function tick(){
  try{
    layoutRow();
    if(document.documentElement.getAttribute('data-outlook')!=='workspace')return;
    buildMenu();buildDock();masthead();skinOnce();tighten();
  }catch(e){}
}
setInterval(tick,700);
var raf=0;new MutationObserver(function(){if(raf)return;raf=requestAnimationFrame(function(){raf=0;tick();});}).observe(document.documentElement,{childList:true,subtree:true});
window.MDV_WORKSPACE={active:function(){return outlook()==='workspace'&&window.matchMedia&&!window.matchMedia('(max-width:900px)').matches;},home:home,get:outlook,set:function(v){try{localStorage.setItem(KEY,v);}catch(e){}apply(v);tick();if(window.VEUX_SMART_PORTAL&&VEUX_SMART_PORTAL.refresh&&String(window._currentPage||'')==='overview')VEUX_SMART_PORTAL.refresh();}};
tick();
})();
