/* Helm: the agent's smart agenda. One timeline per person that joins their schedule (desk blocks, duties, meetings, interest calls)
   with their Tasks. Complete a task, add one, drag it onto the timeline or let Helm find the next free slot.
   Reads /api/agent/calendar/v9 (events carry metadata.team) and /api/agent/tasks/v11; writes only through the Tasks API. */
(function(){
'use strict';
if(window.MDV_HELM)return;

var CATS=[['calls','Interest calls & check-ins'],['meetings','Meetings'],['duties','Duties & desk'],['models','Model items on the schedule'],['tasks','Tasks']];
var START_H=6,END_H=22,HH=56,SNAP=15;
var KEY='mdv.helm.v1';
var H={mode:'full',day:today(),view:'day',person:'me',cats:{calls:true,meetings:true,duties:true,models:true,tasks:true},events:[],scout:[],tasks:[],members:[],myUid:null,week:'',loading:false,err:'',host:null,sel:null,loaded:false};
try{var sv=JSON.parse(localStorage.getItem(KEY)||'{}');if(sv.view==='week'||sv.view==='day'||sv.view==='month')H.view=sv.view;if(typeof sv.person==='string'&&sv.person)H.person=sv.person;if(sv.cats&&typeof sv.cats==='object')Object.keys(H.cats).forEach(function(k){if(sv.cats[k]===false)H.cats[k]=false;});}catch(e){}
function save(){try{localStorage.setItem(KEY,JSON.stringify({view:H.view,person:H.person,cats:H.cats}));}catch(e){}}

function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
function arr(v){return Array.isArray(v)?v:[];}
function today(){var d=new Date();d.setHours(0,0,0,0);return d;}
function addDays(d,n){var x=new Date(d);x.setDate(x.getDate()+n);return x;}
function monday(d){var x=new Date(d),n=(x.getDay()+6)%7;x.setDate(x.getDate()-n);x.setHours(0,0,0,0);return x;}
function dkey(d){d=new Date(d);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
function mins(d){d=new Date(d);return d.getHours()*60+d.getMinutes();}
function clock(m){var h=Math.floor(m/60),mm=m%60,ap=h<12?'am':'pm';h=h%12||12;return h+(mm?':'+String(mm).padStart(2,'0'):'')+ap;}
function tlabel(d){return clock(mins(d));}
function first(n){return String(n||'').trim().split(/\s+/)[0]||'';}
function bridge(){var b=window.VEUX_AGENT_V4;if(!b||!b.api)throw new Error('Secure session is not ready');return b;}
function org(){try{return bridge().state.org.slug||'maison-de-veux';}catch(e){return 'maison-de-veux';}}
function msg(e){return (e&&e.message)||String(e||'Something went wrong');}
function get(path){return bridge().api(path,{method:'GET',headers:{},__fresh:true});}
function post(path,b){return bridge().api(path,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(Object.assign({organization_slug:org()},b)),__fresh:true});}
function toast(m,bad,undo){var o=document.querySelector('.hm-toast');if(o)o.remove();var d=document.createElement('div');d.className='hm-toast'+(bad?' bad':'');d.innerHTML='<span>'+esc(m)+'</span>'+(undo?'<button type="button">Undo</button>':'');document.documentElement.appendChild(d);if(undo)d.querySelector('button').onclick=function(){d.remove();undo();};setTimeout(function(){d.remove();},undo?8000:4200);}

/* ---------- who am I, who is on the team ---------- */
function myMember(){return H.members.filter(function(m){return m.user_id&&m.user_id===H.myUid;})[0]||null;}
function memberName(m){var p=m&&m.profile||{};return first(p.first_name||p.display_name||'');}
function myName(){var m=myMember();return m?memberName(m):'';}
function peopleList(){var seen={};H.members.forEach(function(m){var n=memberName(m);if(n)seen[n]=1;});H.events.forEach(function(x){x.people.forEach(function(n){seen[n]=1;});});return Object.keys(seen).sort(function(a,b){return a.localeCompare(b);});}
function viewing(){if(H.person==='all')return '';if(H.person==='me')return myName();return H.person;}
function matches(item,who){return !who||item.people.some(function(n){return n.toLowerCase()===who.toLowerCase();});}

/* ---------- turning data into agenda items ---------- */
function catOf(it){
  var s=(it.title+' '+it.label).toLowerCase();
  if(it.kind==='task')return 'tasks';
  if(/interest|check-in|check in|\bcalls?\b| x mdv|zoom|pre-departure|readiness|training session/.test(s))return 'calls';
  if(it.kind==='booking'||it.kind==='casting'||/^(travel|visa|stay|housing|digitals|test shoot|booking|deadline)$/.test(String(it.label||'').toLowerCase())||/\b(travel|visa|flight|casting|go.?see|fitting|booking|test shoot|digitals)\b/.test(s))return 'models';
  if(/team meeting|meeting|sync|board|command|scorecard|review|wrap|training|new face|delegation/.test(s)||it.type==='meeting')return 'meetings';
  return 'duties';
}
/* Helm is the agent calendar: an item belongs on it only when it is on someone's schedule (metadata.team), or is an agent-owned event with no model attached.
   Model bookings, castings and model events that are not on the schedule stay on the model calendar only. */
function peopleOf(x,kind){var meta=x.metadata||{},out=[];arr(meta.team).forEach(function(n){out.push(first(n));});if(!out.length&&kind==='event'&&!arr(x.event_models).length){var n=x.owner_member&&first(x.owner_member.display_name);if(n)out.push(n);}return out.filter(function(n,i){return n&&out.indexOf(n)===i;});}
function modelNames(rows){return arr(rows).map(function(r){var m=r.models||r;return m&&m.display_name;}).filter(Boolean);}
function buildEvents(d){
  var out=[];
  function push(kind,x,modelsKey){
    if(!x.starts_at)return;var meta=x.metadata||{};
    var it={kind:kind,id:x.id,title:x.title||(kind==='booking'?'Booking':kind==='casting'?'Casting':'Event'),start:new Date(x.starts_at),end:x.ends_at?new Date(x.ends_at):null,allDay:!!x.all_day,label:meta.calendar_event_type||(kind==='event'?String(x.event_type||'').replace(/_/g,' '):kind),type:String(x.event_type||kind),status:x.status||'',location:x.location||'',notes:x.notes||'',meta:meta,people:peopleOf(x,kind),models:modelNames(x[modelsKey]),conflict:meta.conflict||'',onOutlook:!!meta.on_outlook};
    if(!it.allDay&&it.end&&it.end-it.start>=20*3600e3)it.allDay=true;
    if(!it.allDay&&it.end&&dkey(it.end)!==dkey(it.start)&&mins(it.start)===0)it.allDay=true;
    if(!it.people.length)return;
    it.cat=catOf(it);out.push(it);
  }
  arr(d.events).forEach(function(x){push('event',x,'event_models');});
  arr(d.bookings).forEach(function(x){push('booking',x,'booking_models');});
  arr(d.castings).forEach(function(x){push('casting',x,'casting_models');});
  return out;
}
/* Interest calls scheduled in Scouting (Scout Records) belong on the agent calendar too. They are read straight from the scout records, so they are always current.
   A call that is already on the calendar as an event (same candidate, same day) is not shown twice; if the two disagree on the time, both are shown and the difference is flagged. */
function memberById(id){return H.members.filter(function(m){return String(m.id)===String(id);})[0]||null;}
function buildScoutCalls(d){
  if(!d)return [];var out=[];
  arr(d.calls).forEach(function(c){
    var st=new Date(c.scheduled_at);if(isNaN(st))return;
    var host=c.host_member_id?memberById(c.host_member_id):null,name=host?memberName(host):'';
    if(!name&&c.assigned_member_id){var am=memberById(c.assigned_member_id);if(am)name=memberName(am);}
    if(!name&&c.created_by){var cm=H.members.filter(function(m){return m.user_id===c.created_by;})[0];if(cm)name=memberName(cm);}
    if(!name)name=myName();if(!name)return;
    var link=String(c.link||'').trim(),nm=c.name||'Prospect',done=c.step==='call_done';
    out.push({kind:'scout',id:c.id,title:nm+' · interest call',cand:nm,start:st,end:new Date(st.getTime()+(Number(c.minutes)||30)*60000),allDay:false,label:'Interest call',type:'meeting',status:done?'completed':'scheduled',location:[c.channel,link].filter(Boolean).join(' · '),notes:[c.confirm&&(c.confirm.model||c.confirm.ma)&&('Confirmation: model '+(c.confirm.model||'Not sent')+' · MA '+(c.confirm.ma||'Not sent')),c.instagram&&('Instagram '+c.instagram),[c.city,c.country].filter(Boolean).join(', '),c.height&&('Height '+c.height)].filter(Boolean).join(' · '),people:[name],models:[],meta:{category:'scout_call',step:c.step},conflict:'',cat:'calls',fromScout:true});
  });
  return out;
}
function scoutItems(){
  return H.scout.filter(function(sc){
    var tok=norm(sc.cand).split(' ')[0],k=dkey(sc.start);
    var twin=H.events.filter(function(e){return e.people.length&&dkey(e.start)===k&&tok&&norm(e.title).indexOf(tok)>=0;})[0];
    if(!twin)return true;
    if(Math.abs(twin.start-sc.start)<=15*60000)return false;
    sc.conflict='Scouting says '+tlabel(sc.start)+'; the calendar has '+tlabel(twin.start)+' ('+twin.title+')';return true;
  });
}
function norm(s){return String(s||'').toLowerCase().replace(/[^a-z0-9 ]+/g,' ').replace(/\s+/g,' ').trim();}
function taskOpen(t){var s=String(t.status||'open').toLowerCase();return !/^(completed|done|complete|cancelled|canceled)$/.test(s);}
function taskPeople(t){var ids=arr(t.assignments).map(function(a){return a.member_id;});return H.members.filter(function(m){return ids.indexOf(m.id)>=0;}).map(memberName).filter(Boolean);}
function dayOnly(iso){var d=new Date(iso);return d.getHours()===12&&d.getMinutes()===0;}   /* tasks made from the Calendar page carry a 12:00 placeholder; treat as "due that day" */
function taskItems(){return H.tasks.filter(function(t){return !t.parent_task_id&&taskOpen(t);}).map(function(t){var due=t.due_at?new Date(t.due_at):null;return{kind:'task',id:t.id,title:t.title||'Untitled',start:due,end:due?new Date(due.getTime()+30*60000):null,allDay:!!due&&dayOnly(t.due_at),label:'Task',type:'task',status:t.status||'open',priority:String(t.priority||'').toLowerCase(),people:taskPeople(t),models:[],cat:'tasks',raw:t};});}

/* ---------- loading ---------- */
function uid(){try{var st=bridge().state;return (st.user&&st.user.id)||(st.session&&st.session.user&&st.session.user.id)||(st.profile&&st.profile.user_id)||null;}catch(e){return null;}}
function rangeKey(){return H.view==='month'?'m'+H.day.getFullYear()+'-'+(H.day.getMonth()+1):'w'+dkey(monday(H.day));}
function loadRange(){
  if(H.view==='month'){var f=new Date(H.day.getFullYear(),H.day.getMonth(),1),l=new Date(H.day.getFullYear(),H.day.getMonth()+1,0);return [addDays(monday(f),-1),addDays(addDays(monday(l),6),2)];}
  return [addDays(monday(H.day),-1),addDays(monday(H.day),8)];
}
async function load(force){
  if(H.loading)return;var wk=rangeKey();
  if(!force&&H.loaded&&H.week===wk){paint();return;}
  H.loading=true;paint();
  try{
    var rg=loadRange(),s=rg[0],e=rg[1];
    var res=await Promise.all([
      get('/api/agent/calendar/v9?organization='+encodeURIComponent(org())+'&start='+encodeURIComponent(s.toISOString())+'&end='+encodeURIComponent(e.toISOString())+'&_t='+Date.now()),
      get('/api/agent/tasks/v11?organization='+encodeURIComponent(org())+'&_t='+Date.now())
    ]);
    H.members=arr(res[1].members);H.myUid=uid();H.events=buildEvents(res[0]||{});H.tasks=arr(res[1].tasks);H.scout=buildScoutCalls(H.scoutRaw);H.week=wk;H.loaded=true;H.err='';
    if(H.person==='me'&&!myName())H.person='all';
  }catch(err){H.err=msg(err);}
  H.loading=false;paint();
  /* Scouting calls arrive a moment later and never hold the calendar up */
  get('/api/agent/scouting/calls?organization='+encodeURIComponent(org())+'&_t='+Date.now()).then(function(d){H.scoutRaw=d;H.scout=buildScoutCalls(d);paint();}).catch(function(){});
}
async function reloadTasks(){try{var r=await get('/api/agent/tasks/v11?organization='+encodeURIComponent(org())+'&_t='+Date.now());H.members=arr(r.members);H.tasks=arr(r.tasks);}catch(e){}paint();}

/* ---------- what is on the agenda for a day ---------- */
function itemsFor(day,who){
  var k=dkey(day),all=H.events.concat(scoutItems(),taskItems()).filter(function(it){return it.start&&dkey(it.start)===k&&H.cats[it.cat]!==false&&matches(it,who);});
  var timed=all.filter(function(it){return !it.allDay;}).sort(function(a,b){return a.start-b.start;}),whole=all.filter(function(it){return it.allDay;});
  return{timed:timed,whole:whole};
}
function busy(day,who,skipId){return itemsFor(day,who).timed.filter(function(it){return String(it.id)!==String(skipId);}).map(function(it){var s=mins(it.start),e=it.end&&dkey(it.end)===dkey(it.start)?mins(it.end):s+30;return[s,Math.max(e,s+15)];});}
function findSlot(day,who,dur,skipId){
  var b=busy(day,who,skipId),from=9*60,to=18*60,now=new Date();
  if(dkey(day)===dkey(now))from=Math.max(from,Math.ceil((now.getHours()*60+now.getMinutes()+5)/15)*15);
  for(var t=from;t+dur<=to;t+=15){if(t<13*60&&t+dur>12*60)continue;var clash=b.some(function(x){return t<x[1]&&t+dur>x[0];});if(!clash)return t;}
  return null;
}
function freeMinutes(day,who){var b=busy(day,who),total=0,from=9*60,to=17*60+30;for(var t=from;t<to;t+=15){if(!b.some(function(x){return t<x[1]&&t+15>x[0];}))total+=15;}return total;}
function overlaps(list){var out=[];for(var i=0;i<list.length;i++)for(var j=i+1;j<list.length;j++){var a=list[i],b=list[j];if(a.kind==='task'||b.kind==='task')continue;var ae=a.end||new Date(a.start.getTime()+3600e3),be=b.end||new Date(b.start.getTime()+3600e3);if(a.start<be&&b.start<ae)out.push([a,b]);}return out;}

/* ---------- painting ---------- */
function fmtDay(d){return d.toLocaleDateString([],{weekday:'long',month:'long',day:'numeric'});}
function header(who){
  var names=peopleList(),me=myName();
  var opts='<option value="all"'+(H.person==='all'?' selected':'')+'>Everyone</option>'+(me?'<option value="me"'+(H.person==='me'?' selected':'')+'>Me ('+esc(me)+')</option>':'')+names.filter(function(n){return n!==me;}).map(function(n){return '<option value="'+esc(n)+'"'+(H.person===n?' selected':'')+'>'+esc(n)+'</option>';}).join('');
  var label=H.view==='month'?H.day.toLocaleDateString([],{month:'long',year:'numeric'}):H.view==='week'?(monday(H.day).toLocaleDateString([],{month:'short',day:'numeric'})+' – '+addDays(monday(H.day),6).toLocaleDateString([],{month:'short',day:'numeric'})):fmtDay(H.day);
  return '<header class="hm-head"><div class="hm-title"><small>'+(H.mode==='calendar'?'Agent calendar':'Smart agenda')+'</small><h1>'+(H.mode==='calendar'?'Helm Calendar':'Helm')+'</h1></div>'
   +'<div class="hm-nav"><button type="button" data-hm="prev" aria-label="Previous">‹</button><button type="button" data-hm="today">Today</button><button type="button" data-hm="next" aria-label="Next">›</button><strong>'+esc(label)+'</strong></div>'
   +'<div class="hm-tools">'+(H.mode==='calendar'?'<div class="hm-seg hm-calsw" role="group" aria-label="Calendar"><button type="button" data-hm-go="calendar">Agency</button><button type="button" class="on">Helm</button></div>':'')+'<div class="hm-seg"><button type="button" data-hm-view="day" class="'+(H.view==='day'?'on':'')+'">Day</button><button type="button" data-hm-view="week" class="'+(H.view==='week'?'on':'')+'">Week</button><button type="button" data-hm-view="month" class="'+(H.view==='month'?'on':'')+'">Month</button></div><div class="hm-addwrap"><button type="button" class="hm-btn hm-add" data-hm-add aria-haspopup="true">+ Add</button><div class="hm-addmenu" role="menu"><button type="button" role="menuitem" data-hm-new="event"><b>Event</b><small>A meeting, call, block of time or trip</small></button><button type="button" role="menuitem" data-hm-new="task"><b>Task</b><small>Something to do, with a due date and time</small></button><button type="button" role="menuitem" data-hm-new="call"><b>Interest call</b><small>A call with a prospective model or mother agency</small></button></div></div><label class="hm-who"><span>Agenda for</span><select data-hm-person>'+opts+'</select></label></div></header>';
}
function chips(){return '<div class="hm-cats" role="group" aria-label="Show">'+CATS.map(function(c){return '<button type="button" class="hm-cat c-'+c[0]+(H.cats[c[0]]===false?' off':'')+'" data-hm-cat="'+c[0]+'" aria-pressed="'+(H.cats[c[0]]!==false)+'"><i></i>'+esc(c[1])+'</button>';}).join('')+'</div>';}
function signals(who){
  var d=itemsFor(H.day,who),out=[],k=dkey(H.day),isToday=k===dkey(new Date());
  var allTasks=taskItems().filter(function(t){return matches(t,who);}),over=allTasks.filter(function(t){return t.start&&dkey(t.start)<dkey(new Date());});
  var calls=d.timed.concat(d.whole).filter(function(x){return x.cat==='calls';}).length,ov=overlaps(d.timed);
  if(ov.length)out.push(['risk',ov.length+' overlap'+(ov.length===1?'':'s')+': '+ov[0][0].title+' / '+ov[0][1].title]);
  if(over.length)out.push(['risk',over.length+' overdue task'+(over.length===1?'':'s')]);
  if(calls)out.push(['',calls+' call'+(calls===1?'':'s')+' '+(isToday?'today':'this day')]);
  var conflict=d.timed.concat(d.whole).filter(function(x){return x.conflict;})[0];if(conflict)out.push(['risk','Flagged: '+conflict.title]);
  if(isToday){var tm=addDays(H.day,1),tn=itemsFor(tm,who),tc=tn.timed.concat(tn.whole).filter(function(x){return x.cat==='calls';}).sort(function(a,b){return a.start-b.start;});
    if(tc.length)out.push(['go','Tomorrow: '+tc.length+' call'+(tc.length===1?'':'s')+' from '+tlabel(tc[0].start),dkey(tm)]);}
  if(who||true){var f=freeMinutes(H.day,who);if(d.timed.length||isToday)out.push(['ok',(f>=60?Math.floor(f/60)+'h'+(f%60?' '+f%60+'m':''):f+'m')+' free in the working day']);}
  var unsched=allTasks.filter(function(t){return !t.start||t.allDay&&dkey(t.start)===k;}).length;
  if(unsched&&who)out.push(['',unsched+' task'+(unsched===1?'':'s')+' without a time']);
  return '<div class="hm-sig"><span class="hm-vera">✦ Helm</span>'+(out.length?out.map(function(s){return s[2]?'<button type="button" class="hm-s '+s[0]+'" data-hm-goto="'+esc(s[2])+'">'+esc(s[1])+' →</button>':'<span class="hm-s '+s[0]+'">'+esc(s[1])+'</span>';}).join(''):'<span class="hm-s">Nothing needs attention.</span>')+'</div>';
}
function layout(list){
  var items=list.map(function(it){var s=Math.max(mins(it.start),START_H*60),e=it.end&&dkey(it.end)===dkey(it.start)?mins(it.end):s+30;e=Math.min(Math.max(e,s+20),END_H*60);return{it:it,s:s,e:e,col:0,cols:1};}).sort(function(a,b){return a.s-b.s||b.e-a.e;});
  var cluster=[],active=[];
  function close(){var max=cluster.reduce(function(m,x){return Math.max(m,x.col+1);},1);cluster.forEach(function(x){x.cols=max;});cluster=[];}
  items.forEach(function(x){active=active.filter(function(a){return a.e>x.s;});if(!active.length&&cluster.length)close();var used=active.map(function(a){return a.col;}),c=0;while(used.indexOf(c)>=0)c++;x.col=c;active.push(x);cluster.push(x);});
  if(cluster.length)close();
  return items;
}
function block(x){
  var it=x.it,top=(x.s-START_H*60)/60*HH,h=Math.max(20,(x.e-x.s)/60*HH-2),w=100/x.cols,l=x.col*w;
  var sel=H.sel&&H.sel.kind===it.kind&&String(H.sel.id)===String(it.id);
  var sub=[it.kind==='task'?'Task':'',it.models.length?(it.models.length>1?it.models.length+' models':it.models[0]):'',it.location].filter(Boolean).join(' · ');
  return '<div class="hm-blk c-'+it.cat+(sel?' sel':'')+(it.conflict?' flag':'')+(it.kind==='task'?' task':'')+'" style="top:'+top+'px;height:'+h+'px;left:calc('+l+'% + 2px);width:calc('+w+'% - 4px)" data-hm-pick="'+esc(it.kind)+'|'+esc(it.id)+'">'
   +(it.kind==='task'?'<i class="hm-chk" tabindex="0" data-hm-done="'+esc(it.id)+'" aria-label="Mark done"></i>':'')
   +'<b>'+esc(it.title)+'</b>'+(h>34?'<small>'+esc(tlabel(it.start)+(it.end&&it.kind!=='task'?' – '+tlabel(it.end):''))+(sub?' · '+esc(sub):'')+'</small>':'')+'</div>';
}
function timeline(who){
  var d=itemsFor(H.day,who),rows='',k=dkey(H.day),now=new Date(),isToday=k===dkey(now);
  for(var h=START_H;h<END_H;h++)rows+='<div class="hm-hr" style="top:'+(h-START_H)*HH+'px"><span>'+clock(h*60)+'</span></div>';
  var nowLine=isToday&&mins(now)>=START_H*60&&mins(now)<END_H*60?'<div class="hm-now" style="top:'+((mins(now)-START_H*60)/60*HH)+'px"><i></i></div>':'';
  var whole=d.whole.length?'<div class="hm-whole">'+d.whole.map(function(it){return '<button type="button" class="hm-w c-'+it.cat+'" data-hm-pick="'+esc(it.kind)+'|'+esc(it.id)+'">'+(it.kind==='task'?'☐ ':'')+esc(it.title)+'</button>';}).join('')+'</div>':'';
  return whole+'<div class="hm-tl" data-hm-drop="'+k+'" data-hm-slot="'+k+'" style="height:'+(END_H-START_H)*HH+'px">'+rows+'<div class="hm-lane">'+layout(d.timed).map(block).join('')+'</div>'+nowLine+'</div>'+(d.timed.length||d.whole.length?'':'<p class="hm-empty">Nothing on this agenda for '+esc(fmtDay(H.day))+'.</p>');
}
function detail(){
  if(!H.sel)return '';
  var all=H.events.concat(scoutItems(),taskItems()),it=all.filter(function(x){return x.kind===H.sel.kind&&String(x.id)===String(H.sel.id);})[0];if(!it)return '';
  var when=it.start?(it.allDay?'All day · '+fmtDay(it.start):tlabel(it.start)+(it.end&&it.kind!=='task'?' – '+tlabel(it.end):'')+' · '+it.start.toLocaleDateString([],{weekday:'short',month:'short',day:'numeric'})):'No date';
  var cat=CATS.filter(function(c){return c[0]===it.cat;})[0];
  return '<section class="hm-card hm-detail c-'+it.cat+'"><header><small>'+esc(cat?cat[1]:'')+'</small><button type="button" data-hm-close aria-label="Close">×</button></header><h3>'+esc(it.title)+'</h3><p class="hm-when">'+esc(when)+'</p>'
   +(it.people.length?'<p><b>With</b> '+esc(it.people.join(', '))+'</p>':'')+(it.models.length?'<p><b>Models</b> '+esc(it.models.join(', '))+'</p>':'')+(it.location?'<p><b>Where</b> '+esc(it.location)+'</p>':'')
   +(it.conflict?'<p class="hm-risk">'+esc(it.conflict)+'</p>':'')+(it.notes&&it.kind!=='task'?'<p class="hm-note">'+esc(it.notes)+'</p>':'')+interestBlock(it)+rescheduleBlock(it)
   +'<footer>'+(it.kind==='task'?'<button type="button" class="hm-btn" data-hm-done="'+esc(it.id)+'">Mark done</button><button type="button" class="hm-ghost" data-hm-tasks>Open in Tasks</button>':(it.kind==='scout'?'<button type="button" class="hm-ghost" data-hm-scout>Open in Scouting</button>':'<button type="button" class="hm-ghost" data-hm-cal>Open in Calendar</button>'))+'</footer></section>';
}
function rescheduleBlock(it){
  if(it.kind==='scout'||(it.kind!=='event'&&it.kind!=='task')||!it.start)return '';
  var b=(it.allDay?[]:[['30','+30 min'],['60','+1 hour']]).concat([['d1','Tomorrow'],['d7','Next week']]);
  var del=it.kind==='event'&&it.meta&&it.meta.created_in==='helm'?'<button type="button" class="hm-ghost sm bad" data-hm-del="one" data-hm-delid="'+esc(it.id)+'">Delete</button>'+(it.meta.series?'<button type="button" class="hm-ghost sm bad" data-hm-del="series" data-hm-delid="'+esc(it.id)+'">Delete this and later</button>':''):'';
  return '<div class="hm-ic"><h5>Reschedule</h5><div class="hm-seg hm-resched">'+b.map(function(x){return '<button type="button" data-hm-rs="'+x[0]+'" data-hm-kind="'+esc(it.kind)+'" data-hm-rsid="'+esc(it.id)+'">'+x[1]+'</button>';}).join('')+'</div>'+(del?'<div class="hm-delrow">'+del+'</div>':'')+'</div>';
}
var OUTCOMES=[['sign','Sign'],['develop','Develop'],['pass','Pass'],['no_show','No show'],['reschedule','Reschedule']];
function interestBlock(it){
  var ic=it.meta&&it.meta.category==='interest_call'?(it.meta.interest_call||{}):null;if(!ic)return '';
  var done=ic.outcome;
  return '<div class="hm-ic"><h5>Interest call outcome</h5><div class="hm-seg hm-outcomes">'+OUTCOMES.map(function(o){return '<button type="button" class="'+(done===o[0]?'on':'')+'" data-hm-outcome="'+o[0]+'" data-hm-event="'+esc(it.id)+'">'+o[1]+'</button>';}).join('')+'</div>'+(ic.outcome_note?'<p class="hm-note">'+esc(ic.outcome_note)+'</p>':'')+'</div>';
}
function taskRail(who){
  var me=who||'',list=taskItems().filter(function(t){return matches(t,who);}),todayK=dkey(new Date()),dayK=dkey(H.day);
  var G={over:[],day:[],week:[],none:[]},wkEnd=dkey(addDays(new Date(),7));
  list.forEach(function(t){if(!t.start)G.none.push(t);else{var k=dkey(t.start);if(k<todayK)G.over.push(t);else if(k===dayK)G.day.push(t);else if(k<=wkEnd)G.week.push(t);else G.none.push(t);}});
  function row(t){
    var timed=t.start&&!t.allDay,due=!t.start?'':(timed?tlabel(t.start)+' · ':'')+t.start.toLocaleDateString([],{month:'short',day:'numeric'});
    var can=!timed||dkey(t.start)!==dkey(H.day);
    return '<div class="hm-trow'+(t.start&&dkey(t.start)<todayK?' over':'')+'" draggable="true" data-hm-drag="'+esc(t.id)+'"><i class="hm-chk" tabindex="0" data-hm-done="'+esc(t.id)+'" aria-label="Mark done"></i><button type="button" class="hm-ttl" data-hm-pick="task|'+esc(t.id)+'">'+esc(t.title)+'</button>'+(t.priority==='urgent'||t.priority==='high'?'<i class="hm-pr '+(t.priority==='urgent'?'u':'h')+'" title="'+esc(t.priority)+'"></i>':'')+'<em>'+esc(due)+'</em>'+(can?'<button type="button" class="hm-slot" data-hm-slot="'+esc(t.id)+'" title="Put it in the next free slot on '+esc(fmtDay(H.day))+'">Schedule</button>':'')+'</div>';
  }
  function grp(t,l,cls){return l.length?'<div class="hm-grp '+(cls||'')+'"><h4>'+t+' <em>'+l.length+'</em></h4>'+l.slice(0,8).map(row).join('')+(l.length>8?'<p class="hm-more">+ '+(l.length-8)+' more in Tasks</p>':'')+'</div>':'';}
  var body=grp('Overdue',G.over,'over')+grp(fmtDay(H.day).split(',')[0]+' ('+H.day.toLocaleDateString([],{month:'short',day:'numeric'})+')',G.day)+grp('Next 7 days',G.week)+grp('No date',G.none);
  if(!list.length)body='<p class="hm-empty">No open tasks'+(me?' for '+esc(me):'')+'. Nice work.</p>';
  return '<section class="hm-card hm-tasks"><header><h3>Tasks</h3><span>'+list.length+' open</span><button type="button" class="hm-ghost sm" data-hm-tasks>Open Tasks →</button></header>'
   +'<form class="hm-add" data-hm-add><input type="text" maxlength="200" placeholder="Add a task for '+esc(H.day.toLocaleDateString([],{weekday:'short',month:'short',day:'numeric'}))+'…" aria-label="New task"><button type="submit">Add</button></form><div class="hm-tlist">'+body+'</div><p class="hm-tip">Drag a task onto the timeline, or press Schedule to place it in the next free slot.</p></section>';
}
function weekGrid(who){
  var m=monday(H.day),todayK=dkey(new Date()),now=new Date(),heads='',whole='',cols='',gut='';
  for(var h=START_H;h<END_H;h++)gut+='<div class="hm-gh" style="top:'+(h-START_H)*HH+'px"><span>'+clock(h*60)+'</span></div>';
  for(var i=0;i<7;i++){
    var d=addDays(m,i),k=dkey(d),it=itemsFor(d,who),isT=k===todayK;
    heads+='<button type="button" class="hm-wh'+(isT?' today':'')+(k===dkey(H.day)?' cur':'')+'" data-hm-goto="'+k+'"><small>'+d.toLocaleDateString([],{weekday:'short'})+'</small><b>'+d.getDate()+'</b></button>';
    whole+='<div class="hm-wwd">'+it.whole.slice(0,3).map(function(x){return '<button type="button" class="hm-w c-'+x.cat+'" data-hm-pick="'+esc(x.kind)+'|'+esc(x.id)+'">'+(x.kind==='task'?'☐ ':'')+esc(x.title)+'</button>';}).join('')+(it.whole.length>3?'<p class="hm-more">+ '+(it.whole.length-3)+' more</p>':'')+'</div>';
    var nowLine=isT&&mins(now)>=START_H*60&&mins(now)<END_H*60?'<div class="hm-now" style="top:'+((mins(now)-START_H*60)/60*HH)+'px"><i></i></div>':'';
    cols+='<div class="hm-wcol'+(isT?' today':'')+'" data-hm-slot="'+k+'" style="height:'+(END_H-START_H)*HH+'px"><div class="hm-lane">'+layout(it.timed).map(block).join('')+'</div>'+nowLine+'</div>';
  }
  return '<div class="hm-wk"><div class="hm-wk-h"><span class="hm-gut"></span>'+heads+'</div><div class="hm-wk-w"><span class="hm-gut"></span>'+whole+'</div><div class="hm-wk-b"><div class="hm-gutcol" style="height:'+(END_H-START_H)*HH+'px">'+gut+'</div>'+cols+'</div></div>';
}
function monthGrid(who){
  var y=H.day.getFullYear(),mo=H.day.getMonth(),first=new Date(y,mo,1),start=monday(first),todayK=dkey(new Date()),days=new Date(y,mo+1,0).getDate(),weeks=Math.ceil(((first.getDay()+6)%7+days)/7),cells='';
  ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].forEach(function(n){cells+='<div class="hm-mdow">'+n+'</div>';});
  for(var i=0;i<weeks*7;i++){
    var d=addDays(start,i),k=dkey(d),out=d.getMonth()!==mo,it=itemsFor(d,who),all=it.whole.concat(it.timed);
    cells+='<div class="hm-mc'+(out?' out':'')+(k===todayK?' today':'')+'" data-hm-goto="'+k+'"><div class="hm-mh"><button type="button" class="hm-mn" data-hm-goto="'+k+'">'+d.getDate()+'</button><i class="hm-madd" data-hm-addon="'+k+'" title="Add on '+esc(d.toLocaleDateString([],{month:'short',day:'numeric'}))+'">+</i></div>'
     +all.slice(0,3).map(function(x){return '<button type="button" class="hm-mi c-'+x.cat+(x.kind==='task'?' task':'')+'" data-hm-goto="'+k+'" data-hm-pick="'+esc(x.kind)+'|'+esc(x.id)+'"><span>'+(x.allDay?'':tlabel(x.start).replace(/(\d)(am|pm)$/,'$1$2'))+'</span>'+esc(x.title)+'</button>';}).join('')
     +(all.length>3?'<button type="button" class="hm-mmore" data-hm-goto="'+k+'">+ '+(all.length-3)+' more</button>':'')+'</div>';
  }
  return '<div class="hm-month">'+cells+'</div>';
}
function paint(){
  var el=H.host;if(!el)return;
  var who=viewing();
  if(H.loading&&!H.loaded){el.innerHTML='<div class="hm">'+header(who)+'<div class="hm-state"><i></i><span>Loading your agenda…</span></div></div>';return;}
  if(H.err&&!H.loaded){el.innerHTML='<div class="hm">'+header(who)+'<div class="hm-state bad"><span>'+esc(H.err)+'</span><button type="button" class="hm-btn" data-hm="retry">Try again</button></div></div>';return;}
  var scroller=el.querySelector('.hm-tlwrap'),sy=scroller?scroller.scrollTop:null;
  var main=H.view==='month'?monthGrid(who):H.view==='week'?'<div class="hm-tlwrap hm-wkwrap" data-hm-scroll>'+weekGrid(who)+'</div>':'<div class="hm-tlwrap" data-hm-scroll>'+timeline(who)+'</div>';
  el.innerHTML='<div class="hm'+(H.loading?' busy':'')+'">'+header(who)+signals(who)+chips()+'<div class="hm-grid'+(H.mode==='calendar'&&!H.sel?' solo':'')+'"><div class="hm-main">'+main+'</div>'+(H.mode==='calendar'&&!H.sel?'':'<aside class="hm-rail">'+detail()+(H.mode==='calendar'?'':taskRail(who))+'</aside>')+'</div></div>';
  var sc=el.querySelector('.hm-tlwrap');
  if(sc){if(sy!=null)sc.scrollTop=sy;else{var n=new Date(),target=(H.view==='week'||dkey(H.day)===dkey(n))?Math.max(0,(mins(n)-START_H*60)/60*HH-120):(8-START_H)*HH-10;sc.scrollTop=target;}}
}

/* ---------- actions ---------- */
function taskById(id){return H.tasks.filter(function(t){return String(t.id)===String(id);})[0];}
function updateDue(t,iso){
  var body={action:'update_task',task_id:t.id,title:t.title,description:t.description||null,priority:t.priority||'normal',due_at:iso,category:t.category||null,model_id:t.model_id||null};
  return post('/api/agent/tasks/v11',body).then(function(r){if(!r||r.verified!==true)throw new Error('The change was not confirmed');return r;});
}
function moveTask(id,minutes,dayDate){
  var t=taskById(id);if(!t)return;var prev=t.due_at||null,d=new Date(dayDate);d.setHours(Math.floor(minutes/60),minutes%60,0,0);var iso=d.toISOString();
  t.due_at=iso;paint();
  updateDue(t,iso).then(function(){toast('Scheduled "'+t.title+'" for '+clock(minutes)+' on '+d.toLocaleDateString([],{weekday:'short',month:'short',day:'numeric'}),false,function(){t.due_at=prev;paint();updateDue(t,prev).catch(function(e){toast('Could not undo: '+msg(e),true);});});}).catch(function(e){t.due_at=prev;paint();toast('Could not schedule: '+msg(e),true);});
}
function complete(id){
  var t=taskById(id);if(!t)return;var prev=t.status;t.status='completed';if(H.sel&&H.sel.kind==='task'&&String(H.sel.id)===String(id))H.sel=null;paint();
  post('/api/agent/tasks/v11',{action:'task_status',task_id:id,status:'completed'}).then(function(r){if(!r||r.verified!==true)throw new Error('Not confirmed');toast('Task done');}).catch(function(e){t.status=prev;paint();toast('Could not save: '+msg(e),true);});
}
function addTask(title){
  var who=viewing(),m=who?H.members.filter(function(x){return memberName(x).toLowerCase()===who.toLowerCase();})[0]:myMember();
  var body={action:'create_task',title:title,priority:'normal',category:null,member_ids:m?[m.id]:[],due_at:new Date(H.day.getFullYear(),H.day.getMonth(),H.day.getDate(),12,0,0).toISOString()};
  return post('/api/agent/tasks/v11',body).then(function(r){if(!r||r.verified!==true)throw new Error('Not confirmed');toast('Task added');return reloadTasks();});
}
function nav(n){if(H.view==='month')H.day=new Date(H.day.getFullYear(),H.day.getMonth()+n,1);else H.day=addDays(H.day,H.view==='week'?n*7:n);H.sel=null;load();}
function goto(path){if(typeof window.navTo==='function')window.navTo(path);}

document.addEventListener('click',function(e){
  var host=H.host;if(!host||!host.contains(e.target))return;
  var openMenu=host.querySelector('.hm-addmenu.open');if(openMenu&&!e.target.closest('.hm-addwrap'))openMenu.classList.remove('open');
  var slot=e.target.closest('[data-hm-slot]');
  if(slot&&!e.target.closest('.hm-blk,.hm-w,button,.hm-chk,i')){
    var r=slot.getBoundingClientRect(),zoom=r.height/(slot.offsetHeight||1)||1,y=(e.clientY-r.top)/zoom,mn=START_H*60+Math.floor(y/HH*60/30)*30;
    openEvent({date:slot.getAttribute('data-hm-slot'),start:hhmm(mn),end:hhmm(mn+60)});return;
  }
  var t=e.target.closest('[data-hm-add],[data-hm-new],[data-hm-addon],[data-hm-rs],[data-hm-del],[data-hm-scout],[data-hm-newcall],[data-hm-outcome],[data-hm],[data-hm-view],[data-hm-cat],[data-hm-done],[data-hm-pick],[data-hm-slot],[data-hm-goto],[data-hm-close],[data-hm-tasks],[data-hm-cal]');if(!t)return;
  if(t.hasAttribute('data-hm-add')){var mn2=host.querySelector('.hm-addmenu');if(mn2)mn2.classList.toggle('open');return;}
  if(t.hasAttribute('data-hm-new')){var kk=t.getAttribute('data-hm-new'),m3=host.querySelector('.hm-addmenu');if(m3)m3.classList.remove('open');if(kk==='event')openEvent();else if(kk==='task')openTask();else openCall();return;}
  if(t.hasAttribute('data-hm-addon')){e.stopPropagation();openEvent({date:t.getAttribute('data-hm-addon')});return;}
  if(t.hasAttribute('data-hm-rs')){reschedule(t.getAttribute('data-hm-kind'),t.getAttribute('data-hm-rsid'),t.getAttribute('data-hm-rs'));return;}
  if(t.hasAttribute('data-hm-del')){deleteEvent(t.getAttribute('data-hm-delid'),t.getAttribute('data-hm-del')==='series');return;}
  if(t.hasAttribute('data-hm-newcall')){openCall();return;}
  if(t.hasAttribute('data-hm-outcome')){setOutcome(t.getAttribute('data-hm-event'),t.getAttribute('data-hm-outcome'));return;}
  if(t.hasAttribute('data-hm-done')){e.stopPropagation();complete(t.getAttribute('data-hm-done'));return;}
  if(t.hasAttribute('data-hm-slot')){var tk=taskById(t.getAttribute('data-hm-slot')),who=viewing()||myName(),slot=findSlot(H.day,who,30,tk&&tk.id);if(slot==null){toast('No free 30-minute slot left on '+fmtDay(H.day)+'. Try another day.',true);return;}moveTask(tk.id,slot,H.day);return;}
  if(t.hasAttribute('data-hm-goto')&&!t.hasAttribute('data-hm-pick')){H.day=new Date(t.getAttribute('data-hm-goto')+'T12:00:00');H.day.setHours(0,0,0,0);H.view='day';save();H.sel=null;load();return;}
  if(t.hasAttribute('data-hm-pick')){var p=t.getAttribute('data-hm-pick').split('|');H.sel={kind:p[0],id:p[1]};if(t.hasAttribute('data-hm-goto')){H.day=new Date(t.getAttribute('data-hm-goto')+'T12:00:00');H.day.setHours(0,0,0,0);H.view='day';save();}paint();return;}
  if(t.hasAttribute('data-hm-close')){H.sel=null;paint();return;}
  if(t.hasAttribute('data-hm-tasks')){goto('tasksconsolidated');return;}
  if(t.hasAttribute('data-hm-cal')){goto('calendar');return;}
  if(t.hasAttribute('data-hm-scout')){goto('scouting');return;}
  if(t.hasAttribute('data-hm-view')){H.view=t.getAttribute('data-hm-view');save();H.sel=null;if(H.view==='month'&&H.day.getDate()!==1&&false)H.day=new Date(H.day);load();return;}
  if(t.hasAttribute('data-hm-cat')){var c=t.getAttribute('data-hm-cat');H.cats[c]=H.cats[c]===false;save();paint();return;}
  var a=t.getAttribute('data-hm');if(a==='prev')nav(-1);else if(a==='next')nav(1);else if(a==='today'){H.day=today();H.sel=null;load();}else if(a==='retry'){H.err='';load(true);}
});
document.addEventListener('click',function(e){var b=e.target&&e.target.closest&&e.target.closest('[data-hm-go]');if(b&&H.host&&H.host.contains(b)){e.preventDefault();goto(b.getAttribute('data-hm-go'));}});
document.addEventListener('keydown',function(e){if((e.key==='Enter'||e.key===' ')&&e.target&&e.target.matches&&e.target.matches('.hm-chk')&&H.host&&H.host.contains(e.target)){e.preventDefault();complete(e.target.getAttribute('data-hm-done'));}});
document.addEventListener('change',function(e){if(!H.host||!H.host.contains(e.target))return;if(e.target.matches('[data-hm-person]')){H.person=e.target.value;H.sel=null;save();paint();}});
document.addEventListener('submit',function(e){var f=e.target&&e.target.closest&&e.target.closest('[data-hm-add]');if(!f||!H.host||!H.host.contains(f))return;e.preventDefault();var inp=f.querySelector('input'),title=inp.value.trim();if(!title)return;inp.disabled=true;addTask(title).catch(function(err){inp.disabled=false;toast('Could not add: '+msg(err),true);});});
/* drag a task from the list onto the timeline */
document.addEventListener('dragstart',function(e){var r=e.target&&e.target.closest&&e.target.closest('[data-hm-drag]');if(!r||!H.host||!H.host.contains(r))return;try{e.dataTransfer.setData('text/plain',r.getAttribute('data-hm-drag'));e.dataTransfer.effectAllowed='move';}catch(x){}});
document.addEventListener('dragover',function(e){var tl=e.target&&e.target.closest&&e.target.closest('[data-hm-drop]');if(tl&&H.host&&H.host.contains(tl)){e.preventDefault();tl.classList.add('drop');}});
document.addEventListener('dragleave',function(e){var tl=e.target&&e.target.closest&&e.target.closest('[data-hm-drop]');if(tl)tl.classList.remove('drop');});
document.addEventListener('drop',function(e){var tl=e.target&&e.target.closest&&e.target.closest('[data-hm-drop]');if(!tl||!H.host||!H.host.contains(tl))return;e.preventDefault();tl.classList.remove('drop');var id='';try{id=e.dataTransfer.getData('text/plain');}catch(x){}if(!id||!taskById(id))return;var r=tl.getBoundingClientRect(),zoom=r.height/tl.offsetHeight||1,y=(e.clientY-r.top)/zoom,m=START_H*60+Math.round(y/HH*60/SNAP)*SNAP;m=Math.min(Math.max(m,START_H*60),END_H*60-SNAP);moveTask(id,m,H.day);});

/* ---------- interest calls: one format, added to the agent calendar and to tasks ---------- */
var CALL_CHANNELS=['Zoom','Phone','In person','Teams','WhatsApp','FaceTime','Other'],CALL_TEMPLATE='candidate,instagram,market,date,time,minutes,channel,link,host,with,source,notes\nThanh Tran,@thanh.tran,New York,2026-10-20,08:00,30,Zoom,https://zoom.us/j/0000000000,Demontez,,Instagram,Tall and Paris-facing\nRoberta Silva,roberta@example.com,Paris,2026-10-20,09:30,30,Zoom,,Demontez,Erica,Scout referral,Mother agency in Milan\n';
var CALL={tab:'one',busy:false,checked:null};
function callApi(b){return post('/api/agent/interest-calls',b);}
function closeCall(){var m=document.getElementById('hm-callmodal');if(m)m.remove();document.documentElement.classList.remove('hm-lock');}
function sel(name,opts,val){return '<select name="'+name+'">'+opts.map(function(o){var v=Array.isArray(o)?o[0]:o,l=Array.isArray(o)?o[1]:o;return '<option value="'+esc(v)+'"'+(String(v)===String(val)?' selected':'')+'>'+esc(l)+'</option>';}).join('')+'</select>';}
function fld(label,inner,wide){return '<label class="hm-f'+(wide?' wide':'')+'"><span>'+esc(label)+'</span>'+inner+'</label>';}
function callForm(){
  var hosts=peopleList(),me=myName()||hosts[0]||'',d=dkey(H.day);
  return '<div class="hm-fgrid">'
   +fld('Candidate name *','<input name="candidate" type="text" maxlength="120" placeholder="Full name" autocomplete="off">',true)
   +fld('Instagram or contact','<input name="instagram" type="text" maxlength="120" placeholder="@handle, email or phone">')
   +fld('Market',sel('market',['New York','Paris','Other'],'New York'))
   +fld('Date *','<input name="date" type="date" value="'+d+'">')
   +fld('Start time (Eastern) *','<input name="time" type="time" value="10:00">')
   +fld('Length',sel('minutes',[[15,'15 min'],[20,'20 min'],[30,'30 min'],[45,'45 min'],[60,'60 min']],30))
   +fld('How',sel('channel',CALL_CHANNELS,'Zoom'))
   +fld('Link or place','<input name="link" type="text" maxlength="300" placeholder="Meeting link, number or address">',true)
   +fld('Host',sel('host',hosts.length?hosts:[me],me))
   +fld('Also on the call','<input name="with" type="text" maxlength="200" placeholder="e.g. Erica; Emma">')
   +fld('Where we found them','<input name="source" type="text" maxlength="120" placeholder="Instagram, TikTok, scout, referral, open call">',true)
   +fld('Notes for the call','<textarea name="notes" rows="3" maxlength="1000" placeholder="Anything to know before the call"></textarea>',true)
   +'<div class="hm-checks wide"><label><input type="checkbox" name="prep_task" checked> Add a task: prepare one hour before</label><label><input type="checkbox" name="decide_task" checked> Add a task: decide to sign, develop or pass after the call</label></div></div>';
}
function callList(){
  return '<div class="hm-list"><p>Paste one call per row, in this format. The first row must be the column names.</p><div class="hm-fmt"><code>'+esc(CALL_TEMPLATE.split('\n')[0])+'</code></div>'
   +'<textarea name="csv" rows="9" placeholder="'+esc(CALL_TEMPLATE.split('\n').slice(0,2).join('\n'))+'"></textarea>'
   +'<div class="hm-listbar"><button type="button" class="hm-ghost" data-hm-dl>Download the format</button><button type="button" class="hm-ghost" data-hm-check>Check the list</button></div><div class="hm-checked" data-hm-checked></div></div>';
}
function callModal(){
  var m=document.createElement('div');m.id='hm-callmodal';m.className='hm-modal';
  m.innerHTML='<div class="hm-mcard" role="dialog" aria-modal="true" aria-label="Add interest calls"><header><div><small>Agent calendar + tasks</small><h2>Add interest calls</h2></div><button type="button" class="hm-x" data-hm-callclose aria-label="Close">×</button></header>'
   +'<div class="hm-mbody"><div class="hm-seg hm-ctabs"><button type="button" class="on" data-hm-ctab="one">One call</button><button type="button" data-hm-ctab="list">Paste a list</button></div><div data-hm-cpane="one">'+callForm()+'</div><div data-hm-cpane="list" hidden>'+callList()+'</div><p class="hm-cmsg" data-hm-cmsg></p></div>'
   +'<footer><span class="hm-fine">Each call goes on the agent calendar as an Interest call (Helm) and adds prep and decision tasks for the host.</span><button type="button" class="hm-ghost" data-hm-callclose>Cancel</button><button type="button" class="hm-btn" data-hm-callgo>Add to calendar and tasks</button></footer></div>';
  return m;
}
function openCall(){
  closeCall();var m=callModal();document.documentElement.appendChild(m);document.documentElement.classList.add('hm-lock');CALL.tab='one';CALL.checked=null;
  var card=m.querySelector('.hm-mcard');card.style.maxHeight=Math.max(360,innerHeight-40)+'px';var f=m.querySelector('[name=candidate]');if(f)f.focus({preventScroll:true});
}
function cmsg(t,bad){var e=document.querySelector('#hm-callmodal [data-hm-cmsg]');if(e){e.textContent=t||'';e.className='hm-cmsg'+(bad?' bad':'');}}
function readOne(m){
  function v(n){var e=m.querySelector('[name="'+n+'"]');return e?e.value.trim():'';}
  function c(n){var e=m.querySelector('[name="'+n+'"]');return !!(e&&e.checked);}
  return {candidate:v('candidate'),instagram:v('instagram'),market:v('market'),date:v('date'),time:v('time'),minutes:Number(v('minutes'))||30,channel:v('channel'),link:v('link'),host:v('host'),with:v('with'),source:v('source'),notes:v('notes'),prep_task:c('prep_task'),decide_task:c('decide_task')};
}
function resultsHtml(res){
  return '<table><thead><tr><th>Candidate</th><th>When (ET)</th><th>Host</th><th></th></tr></thead><tbody>'+res.results.map(function(r){var cls=r.status==='error'?'bad':'';return '<tr class="'+cls+'"><td>'+esc(r.candidate||'—')+'</td><td>'+esc((r.date||'')+' '+(r.time||''))+'</td><td>'+esc(r.host||'')+'</td><td>'+(r.status==='error'?esc(r.errors.join('; ')):esc(({create:'New',update:'Update',created:'Added',updated:'Updated'})[r.status]||r.status)+(r.warnings&&r.warnings.length?' · '+esc(r.warnings.join('; ')):''))+'</td></tr>';}).join('')+'</tbody></table>';
}
async function submitCalls(check){
  var m=document.getElementById('hm-callmodal');if(!m||CALL.busy)return;
  var body=CALL.tab==='one'?{calls:[readOne(m)]}:{csv:(m.querySelector('[name=csv]')||{}).value||''};
  if(CALL.tab==='list'&&!body.csv.trim()){cmsg('Paste your list first.',true);return;}
  body.action=check?'check':'schedule';CALL.busy=true;cmsg(check?'Checking…':'Adding…');
  var go=m.querySelector('[data-hm-callgo]');if(go)go.disabled=true;
  try{
    var r;try{r=await callApi(body);}catch(e){if(e&&e.payload&&e.payload.results)r=e.payload;else throw e;}
    if(check){var box=m.querySelector('[data-hm-checked]');if(box)box.innerHTML=resultsHtml(r);cmsg(r.summary.errors?r.summary.errors+' row'+(r.summary.errors===1?' has':'s have')+' a problem. Fix them, then check again.':r.summary.total+' ready to add.',!!r.summary.errors);CALL.checked=r;return;}
    var made=r.summary.created+r.summary.updated;
    if(r.summary.errors&&!made){cmsg(r.results.filter(function(x){return x.status==='error';}).map(function(x){return (x.candidate||'Row')+': '+x.errors.join('; ');}).join(' | '),true);return;}
    var first=r.results.filter(function(x){return x.event_id;})[0];
    closeCall();toast((made===1?'Call':made+' calls')+' added to the agent calendar'+(r.results.some(function(x){return x.tasks;})?' and tasks':'')+(r.summary.errors?' ('+r.summary.errors+' skipped)':''));
    if(first&&first.date){H.day=new Date(first.date+'T12:00:00');H.day.setHours(0,0,0,0);}
    H.loaded=false;load(true);
  }catch(err){cmsg(msg(err),true);}
  finally{CALL.busy=false;if(go)go.disabled=false;}
}
async function setOutcome(eventId,outcome){
  var it=H.events.filter(function(x){return String(x.id)===String(eventId);})[0],note='';
  if(outcome==='no_show'||outcome==='pass'){try{note=window.prompt('Add a short note (optional)','')||'';}catch(e){}}
  try{var r=await callApi({action:'set_outcome',event_id:eventId,outcome:outcome,note:note});if(!r||r.verified!==true)throw new Error('Not confirmed');toast('Outcome saved: '+(OUTCOMES.filter(function(o){return o[0]===outcome;})[0]||[,outcome])[1]+(it?' · '+it.title:''));H.loaded=false;await load(true);}
  catch(e){toast('Could not save the outcome: '+msg(e),true);}
}
document.addEventListener('click',function(e){
  var t=e.target&&e.target.closest&&e.target.closest('#hm-callmodal [data-hm-callclose],#hm-callmodal [data-hm-ctab],#hm-callmodal [data-hm-callgo],#hm-callmodal [data-hm-check],#hm-callmodal [data-hm-dl]');if(!t)return;
  if(t.hasAttribute('data-hm-callclose')){if(!CALL.busy)closeCall();return;}
  if(t.hasAttribute('data-hm-ctab')){CALL.tab=t.getAttribute('data-hm-ctab');var m=document.getElementById('hm-callmodal');m.querySelectorAll('[data-hm-ctab]').forEach(function(b){b.classList.toggle('on',b===t);});m.querySelectorAll('[data-hm-cpane]').forEach(function(p){p.hidden=p.getAttribute('data-hm-cpane')!==CALL.tab;});cmsg('');return;}
  if(t.hasAttribute('data-hm-callgo')){submitCalls(false);return;}
  if(t.hasAttribute('data-hm-check')){submitCalls(true);return;}
  if(t.hasAttribute('data-hm-dl')){try{var b=new Blob([CALL_TEMPLATE],{type:'text/csv'}),a=document.createElement('a');a.href=URL.createObjectURL(b);a.download='interest-calls-format.csv';document.body.appendChild(a);a.click();setTimeout(function(){URL.revokeObjectURL(a.href);a.remove();},500);}catch(x){}return;}
});
document.addEventListener('keydown',function(e){if(e.key==='Escape'&&document.getElementById('hm-callmodal')&&!CALL.busy)closeCall();});

/* ---------- add: event and task (the interest call form is above) ---------- */
var EV_TYPES=[['connect','Meeting or call'],['focus','Deep work'],['move','Training'],['recharge','Meal or rest'],['travel','Travel'],['close','Personal']],EV_REPEAT=[['','Once'],['w','Every week'],['wd','Every weekday'],['d','Every day']];
function closeAdd(){var m=document.getElementById('hm-addmodal');if(m)m.remove();document.documentElement.classList.remove('hm-lock');}
function pad2(n){return String(n).padStart(2,'0');}
function hhmm(m){m=Math.max(0,Math.min(m,24*60-1));return pad2(Math.floor(m/60))+':'+pad2(m%60);}
function hostChoice(){var hosts=peopleList(),me=myName();return {list:hosts.length?hosts:[me].filter(Boolean),def:viewing()||me||hosts[0]||''};}
function addShell(title,sub,body,goLabel,kind){
  closeAdd();var m=document.createElement('div');m.id='hm-addmodal';m.className='hm-modal';
  m.innerHTML='<div class="hm-mcard" role="dialog" aria-modal="true" aria-label="'+esc(title)+'"><header><div><small>'+esc(sub)+'</small><h2>'+esc(title)+'</h2></div><button type="button" class="hm-x" data-hm-aclose aria-label="Close">×</button></header><div class="hm-mbody">'+body+'<p class="hm-cmsg" data-hm-amsg></p></div><footer><span class="hm-fine" data-hm-ahint></span><button type="button" class="hm-ghost" data-hm-aclose>Cancel</button><button type="button" class="hm-btn" data-hm-ago="'+kind+'">'+esc(goLabel)+'</button></footer></div>';
  document.documentElement.appendChild(m);document.documentElement.classList.add('hm-lock');
  var c=m.querySelector('.hm-mcard');c.style.maxHeight=Math.max(360,innerHeight-40)+'px';
  var f=m.querySelector('[name=title]');if(f)f.focus({preventScroll:true});return m;
}
function openEvent(pre){
  pre=pre||{};var hc=hostChoice();
  var m=addShell('Add an event','Agent calendar',
   '<div class="hm-fgrid">'+fld('What *','<input name="title" type="text" maxlength="200" placeholder="Call with Erica, casting prep, dinner with a designer" autocomplete="off">',true)
   +fld('Date *','<input name="date" type="date" value="'+esc(pre.date||dkey(H.day))+'">')+fld('Type',sel('type',EV_TYPES,pre.type||'connect'))
   +fld('Starts','<input name="start" type="time" value="'+esc(pre.start||'')+'">')+fld('Ends','<input name="end" type="time" value="'+esc(pre.end||'')+'">')
   +fld('For',sel('host',hc.list,hc.def))+fld('Also with','<input name="with" type="text" maxlength="200" placeholder="e.g. Erica; Emma">')
   +fld('Repeats',sel('repeat',EV_REPEAT,''))+fld('Where','<input name="where" type="text" maxlength="300" placeholder="Zoom, studio, address">')
   +fld('Notes','<textarea name="notes" rows="3" maxlength="1000" placeholder="Anything to remember"></textarea>',true)+'</div>','Add event','event');
  var hint=m.querySelector('[data-hm-ahint]'),ty=m.querySelector('[name=type]');
  function upd(){hint.textContent=/^(move|recharge|close)$/.test(ty.value)?'Only you can see this one.':'Leave the times empty for an all-day event.';}
  ty.addEventListener('change',upd);upd();
}
function openTask(pre){
  pre=pre||{};var hc=hostChoice();
  addShell('Add a task','Tasks',
   '<div class="hm-fgrid">'+fld('Task *','<input name="title" type="text" maxlength="200" placeholder="What needs to be done?" autocomplete="off">',true)
   +fld('Due date','<input name="date" type="date" value="'+esc(pre.date||dkey(H.day))+'">')+fld('Due time (optional)','<input name="time" type="time" value="'+esc(pre.time||'')+'">')
   +fld('Priority',sel('priority',[['normal','Normal'],['high','High'],['urgent','Urgent']],'normal'))+fld('For',sel('host',hc.list,hc.def))
   +fld('Notes','<textarea name="notes" rows="3" maxlength="1000" placeholder="Details"></textarea>',true)+'</div>','Add task','task').querySelector('[data-hm-ahint]').textContent='It shows on this calendar at its due time, and in Tasks.';
}
function amsg(t,bad){var e=document.querySelector('#hm-addmodal [data-hm-amsg]');if(e){e.textContent=t||'';e.className='hm-cmsg'+(bad?' bad':'');}}
function readAdd(m){var o={};m.querySelectorAll('[name]').forEach(function(e){o[e.name]=e.type==='checkbox'?e.checked:String(e.value||'').trim();});return o;}
var ADDING=false;
async function submitAdd(kind){
  var m=document.getElementById('hm-addmodal');if(!m||ADDING)return;var v=readAdd(m);
  if(!v.title){amsg('Add a title first.',true);return;}
  if(kind==='event'&&!v.date){amsg('Pick a date.',true);return;}
  ADDING=true;amsg('Adding…');var go=m.querySelector('[data-hm-ago]');if(go)go.disabled=true;
  try{
    if(kind==='event'){
      var r=await post('/api/agent/helm/events',{action:'create',event:v});
      if(!r||r.verified!==true)throw new Error('The calendar did not confirm it');
      closeAdd();toast((r.created>1?r.created+' events':'Event')+' added'+(r.warning?'. '+r.warning:''));
      var d=new Date(v.date+'T12:00:00');d.setHours(0,0,0,0);H.day=d;H.loaded=false;await load(true);
    }else{
      var mem=H.members.filter(function(x){return memberName(x).toLowerCase()===String(v.host||'').toLowerCase();})[0],due=null;
      if(v.date){var t=v.time||'12:00',pr=t.split(':');var dd=new Date(v.date+'T12:00:00');dd.setHours(+pr[0]||12,+pr[1]||0,0,0);due=dd.toISOString();}
      var r2=await post('/api/agent/tasks/v11',{action:'create_task',title:v.title,description:v.notes||null,priority:v.priority||'normal',category:null,member_ids:mem?[mem.id]:[],due_at:due});
      if(!r2||r2.verified!==true)throw new Error('The task was not confirmed');
      closeAdd();toast('Task added');await reloadTasks();
    }
  }catch(err){amsg(msg(err),true);if(go)go.disabled=false;}
  finally{ADDING=false;}
}
/* move or remove things from the detail card */
async function reschedule(kind,id,how){
  var all=H.events.concat(taskItems()),it=all.filter(function(x){return x.kind===kind&&String(x.id)===String(id);})[0];if(!it||!it.start)return;
  var d=new Date(it.start);if(how==='30')d=new Date(d.getTime()+30*60000);else if(how==='60')d=new Date(d.getTime()+60*60000);else if(how==='d1')d=addDays(d,1);else if(how==='d7')d=addDays(d,7);
  try{
    if(kind==='task'){var t=taskById(id);await updateDue(t,d.toISOString());t.due_at=d.toISOString();}
    else{var r=await post('/api/agent/calendar/v9',{action:'move_event',event_id:id,starts_at:d.toISOString()});if(!r||r.ok!==true)throw new Error('The calendar did not confirm the move');}
    toast('Moved to '+d.toLocaleDateString([],{weekday:'short',month:'short',day:'numeric'})+(it.allDay?'':' at '+tlabel(d)));
    H.sel=null;H.loaded=false;await load(true);
  }catch(e){toast('Could not move it: '+msg(e),true);}
}
async function deleteEvent(id,series){
  if(!window.confirm(series?'Delete this and every later event in the series?':'Delete this event?'))return;
  try{var r=await post('/api/agent/helm/events',{action:'delete',event_id:id,series:!!series});if(!r||r.verified!==true)throw new Error('Not confirmed');toast(r.deleted>1?r.deleted+' events deleted':'Event deleted');H.sel=null;H.loaded=false;await load(true);}
  catch(e){toast('Could not delete: '+msg(e),true);}
}
document.addEventListener('click',function(e){
  var t=e.target&&e.target.closest&&e.target.closest('#hm-addmodal [data-hm-aclose],#hm-addmodal [data-hm-ago]');if(!t)return;
  if(t.hasAttribute('data-hm-aclose')){if(!ADDING)closeAdd();return;}
  submitAdd(t.getAttribute('data-hm-ago'));
});
document.addEventListener('keydown',function(e){if(e.key==='Escape'&&document.getElementById('hm-addmodal')&&!ADDING)closeAdd();});

/* ---------- page + route ---------- */
window.renderHelm=function(el){H.mode='full';H.host=el;H.loaded=H.loaded&&H.week===rangeKey();paint();return load(true);};
(function register(){
  function put(){var m=window.VEUX_V15_ROUTE_RENDERERS;if(m&&typeof m==='object'){m.helm=function(el){return window.renderHelm(el);};m.helmcalendar=function(el){return window.renderHelmCalendar(el);};return true;}return false;}
  if(put())return;var n=0,t=setInterval(function(){if(put()||++n>400)clearInterval(t);},150);
  ['veux:shell-ready','veux:assets-ready','veux:auth-ready'].forEach(function(ev){window.addEventListener(ev,put);});
})();
window.renderHelmCalendar=function(el){H.mode='calendar';H.host=el;H.loaded=H.loaded&&H.week===rangeKey();paint();return load(true);};
window.MDV_HELM={render:window.renderHelm,calendar:window.renderHelmCalendar,state:H,findSlot:findSlot,catOf:catOf};
})();
