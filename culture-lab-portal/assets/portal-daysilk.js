/* DaySilk: one timeline for the day. Meetings and tasks woven together, focus time blocked for the work that matters,
   a plan from Lab Assistant, and an end-of-day wrap. Uses the portal's own calendar, tasks and notes; nothing separate. */
(function(){
'use strict';
var P=window.CLPortal,esc=P.esc;
var D={day:null},H0=7,H1=21,PX=56,LEN=45;
function pad(n){return String(n).padStart(2,'0');}
function ymd(d){d=new Date(d);return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());}
function at(day,m){var p=day.split('-');return new Date(+p[0],+p[1]-1,+p[2],Math.floor(m/60),m%60);}
function mins(d){d=new Date(d);return d.getHours()*60+d.getMinutes();}
function addD(day,n){var t=at(day,720);t.setDate(t.getDate()+n);return ymd(t);}
function hrs(m){var h=Math.floor(m/60),r=m%60;return h?(h+'h'+(r?' '+r+'m':'')):r+'m';}
function clock(m){var h=Math.floor(m/60)%24,mm=m%60;return (h%12||12)+(mm?':'+pad(mm):'')+(h<12?' AM':' PM');}

function data(){var u=CL.me(),day=D.day,s0=at(day,0).getTime(),s1=s0+864e5,now=Date.now();
  var evs=CL.state.events.filter(function(e){var a=new Date(e.start).getTime(),b=new Date(e.end).getTime();return e.status!=='cancelled'&&a<s1&&b>s0&&((e.attendees||[]).indexOf(u.id)>=0||e.by===u.id&&e.type==='focus');}).sort(function(a,b){return a.start<b.start?-1:1;});
  var mine=CL.state.tasks.filter(function(t){return t.assignee===u.id;}),open=mine.filter(function(t){return t.status==='open';});
  var blocked={};evs.forEach(function(e){if(e.type==='focus'&&e.taskId)blocked[e.taskId]=e;});
  var due=function(t){return t.due?new Date(t.due).getTime():Infinity;};
  var rk={high:0,normal:1,low:2},pr=function(t){return rk[t.priority]==null?1:rk[t.priority];};var todo=open.filter(function(t){return due(t)<s1;}).sort(function(a,b){return pr(a)-pr(b)||due(a)-due(b);}),soon=open.filter(function(t){var x=due(t);return x>=s1&&x<s1+6*864e5;}).sort(function(a,b){return due(a)-due(b);}).slice(0,5);
  var done=mine.filter(function(t){return t.status==='done'&&t.doneAt&&ymd(t.doneAt)===day;});
  var timed=evs.filter(function(e){return e.type!=='deadline';}),meet=timed.filter(function(e){return e.type!=='focus';}),focus=timed.filter(function(e){return e.type==='focus';});
  var span=function(list){return list.reduce(function(a,e){return a+Math.max(0,(Math.min(new Date(e.end).getTime(),s1)-Math.max(new Date(e.start).getTime(),s0))/6e4);},0);};
  return {evs:evs,timed:timed,deadlines:evs.filter(function(e){return e.type==='deadline';}),meet:meet,focus:focus,todo:todo,soon:soon,done:done,blocked:blocked,meetMin:span(meet),focusMin:span(focus),free:freeSlots(timed,day),isToday:day===ymd(now),past:at(day,0).getTime()+864e5<=now};}

/* Free time between 9 AM and 6 PM (from now, if it is today), in minutes from midnight. */
function freeSlots(timed,day){var a=9*60,b=18*60;if(day===ymd(new Date()))a=Math.max(a,Math.ceil((mins(new Date())+5)/15)*15);var busy=timed.map(function(e){var s=ymd(e.start)===day?mins(e.start):0,en=ymd(e.end)===day?mins(e.end):1440;return [s,en];}).sort(function(x,y){return x[0]-y[0];}),out=[],cur=a;
  busy.forEach(function(x){if(x[0]>cur)out.push([cur,Math.min(x[0],b)]);cur=Math.max(cur,x[1]);});if(cur<b)out.push([cur,b]);return out.filter(function(x){return x[1]-x[0]>=15;});}

function layout(list){var cols=[],out=[];list.forEach(function(e){var s=new Date(e.start).getTime(),c=0;while(cols[c]&&cols[c]>s)c++;cols[c]=new Date(e.end).getTime();out.push({e:e,c:c});});
  out.forEach(function(o){var s=new Date(o.e.start).getTime(),en=new Date(o.e.end).getTime();o.n=out.filter(function(x){return new Date(x.e.start).getTime()<en&&new Date(x.e.end).getTime()>s;}).reduce(function(m,x){return Math.max(m,x.c+1);},1);});return out;}

function timeline(x){var day=D.day,h='<div class="ds-tl" data-tl style="height:'+((H1-H0)*PX)+'px">';
  for(var i=H0;i<H1;i++)h+='<div class="ds-hr" style="top:'+((i-H0)*PX)+'px"><span>'+clock(i*60)+'</span></div>';
  x.free.forEach(function(f){var a=Math.max(f[0],H0*60),b=Math.min(f[1],H1*60);if(b-a>=30)h+='<div class="ds-free" style="top:'+((a-H0*60)/60*PX)+'px;height:'+((b-a)/60*PX)+'px"><span>Free '+hrs(b-a)+'</span></div>';});
  layout(x.timed).forEach(function(o){var e=o.e,t=CL.CAL_TYPES[e.type]||CL.CAL_TYPES.task,s=ymd(e.start)===day?mins(e.start):0,en=ymd(e.end)===day?mins(e.end):1440,a=Math.max(s,H0*60),b=Math.min(Math.max(en,s+15),H1*60);if(b<=a)return;
    var f=e.type==='focus',tk=f&&e.taskId?CL.find('tasks',e.taskId):null,doneT=tk&&tk.status==='done';
    h+='<button class="ds-ev'+(f?' focus':'')+(doneT?' done':'')+'" data-ev="'+esc(e.id)+'"'+(f&&e.by===CL.me().id?' draggable="true"':'')+' style="top:'+((a-H0*60)/60*PX)+'px;height:'+Math.max(22,(b-a)/60*PX-2)+'px;left:calc(54px + (100% - 58px) * '+(o.c/o.n)+');width:calc((100% - 58px) / '+o.n+' - 4px);--c:'+t.color+'"><small>'+(f?(doneT?'DONE · ':'FOCUS · '):esc(t.label.toUpperCase())+' · ')+esc(P.time(e.start))+'</small><b>'+esc(e.title)+'</b></button>';});
  if(x.isToday){var n=mins(new Date());if(n>=H0*60&&n<H1*60)h+='<div class="ds-now" style="top:'+((n-H0*60)/60*PX)+'px"><i></i></div>';}
  return h+'</div>';}

function dueLabel(t){if(!t.due)return 'No due date';var d=new Date(t.due),k=ymd(d),today=ymd(new Date());if(d.getTime()<Date.now()&&k===today)return '<span class="bad-t">Due '+P.time(d)+' today</span>';if(d.getTime()<Date.now()){var n=Math.max(1,Math.round((Date.now()-d.getTime())/864e5));return '<span class="bad-t">Overdue '+n+'d</span>';}return (k===today?'Today':P.date(d,{weekday:'short',month:'short',day:'numeric'}))+', '+P.time(d);}
function taskCard(t,x){var b=x.blocked[t.id],s=t.storyId?CL.story(t.storyId):null;
  var w=CL.openBlockers?CL.openBlockers(t):[];return '<div class="ds-task" draggable="true" data-task="'+esc(t.id)+'">'+(w.length?'<span class="tk-lock" title="Waiting on other tasks">'+P.icon('lock')+'</span>':'<button class="ds-chk" data-done="'+esc(t.id)+'" aria-label="Mark done: '+esc(t.title)+'"></button>')+'<div class="grow"><b>'+(t.priority==='high'?'<span class="pill bad ds-pri">High</span> ':'')+esc(t.title)+'</b><small>'+dueLabel(t)+(s?' · '+esc(s.title):'')+'</small>'+(w.length?'<small class="tk-wait">Waiting on: '+w.map(function(x){return esc(x.title);}).join('; ')+'</small>':'')+(b?'<em class="ds-on">'+P.icon('clock')+'Blocked '+esc(P.time(b.start))+'</em>':'')+'</div>'+(b||x.past?'':'<button class="btn sm" data-block="'+esc(t.id)+'">Block '+LEN+'m</button>')+'</div>';}

function render(el){var u=CL.me();if(!D.day)D.day=ymd(new Date());var x=data(),d=at(D.day,720),hr=new Date().getHours(),first=(u.name||'').split(' ')[0];
  var fm=x.free.reduce(function(a,f){return a+f[1]-f[0];},0);
  var h='<div class="ds"><header class="cc-head ds-head"><div><div class="cc-eye">'+esc(P.date(d,{weekday:'long'}).toUpperCase())+' <i>/</i> '+esc(P.date(d,{month:'long',day:'numeric'}).toUpperCase())+'</div><h1>Day<em>Silk</em></h1></div>'
   +'<p>'+(x.isToday?(hr<12?'Good morning':hr<18?'Good afternoon':'Good evening')+', '+esc(first)+'. Your meetings, tasks and focus time, woven into one day.':'Planning '+esc(P.date(d,{weekday:'long',month:'long',day:'numeric'}))+'.')+'</p>'
   +'<div class="ds-acts"><div class="ds-nav" role="group" aria-label="Choose day"><button class="btn sm" data-dd="-1" aria-label="Previous day">'+P.icon('left')+'</button><button class="btn sm'+(x.isToday?' on':'')+'" data-dd="0">Today</button><button class="btn sm" data-dd="1" aria-label="Next day">'+P.icon('right')+'</button></div>'
   +(P.assistant&&!x.past?'<button class="btn gold" data-plan>'+P.icon('spark')+'Plan my day</button>':'')+'<button class="btn" data-wrap>'+P.icon('check')+'Wrap up the day</button></div></header>';
  h+='<div class="ds-sum">'+[[x.meet.length,'Meetings',x.meetMin?hrs(x.meetMin):'None'],[x.focusMin?hrs(x.focusMin):'0m','Focus planned',x.focus.length+' block'+(x.focus.length===1?'':'s')],[fm?hrs(fm):'0m','Free time',x.isToday?'Left today, 9 to 6':'Between 9 and 6'],[x.todo.length,'To do',x.todo.filter(function(t){return !x.blocked[t.id];}).length+' not yet blocked'],[x.done.length,'Done',x.done.length?'Nice work':'Nothing yet']].map(function(k){return '<div class="ds-k"><b>'+esc(k[0])+'</b><span>'+esc(k[1])+'</span><small>'+esc(k[2])+'</small></div>';}).join('')+'</div>';
  if(x.deadlines.length)h+='<div class="ds-dl">'+P.icon('send')+'<span>Deadline'+(x.deadlines.length>1?'s':'')+' today: '+x.deadlines.map(function(e){return '<b>'+esc(e.title)+'</b>';}).join(', ')+'</span></div>';
  h+='<div class="ds-grid"><section class="card ds-day"><h3>Your day <span class="mut tiny">Drag a task onto the timeline to block time</span></h3>'+timeline(x)+'</section><div class="ds-side">';
  h+='<section class="card"><h3>To weave in <span class="mut">'+x.todo.length+'</span></h3>'+(x.todo.length?x.todo.map(function(t){return taskCard(t,x);}).join(''):'<p class="small mut">Nothing due'+(x.isToday?' today':'')+'. You are clear.</p>')+(x.soon.length?'<small class="mut ds-sub">Coming up</small>'+x.soon.map(function(t){return taskCard(t,x);}).join(''):'')+'</section>';
  if(x.done.length)h+='<section class="card"><h3>Done <span class="mut">'+x.done.length+'</span></h3>'+x.done.map(function(t){return '<div class="ds-task is-done"><span class="ds-chk on">'+P.icon('check')+'</span><div class="grow"><b>'+esc(t.title)+'</b><small>Done '+esc(P.time(t.doneAt))+'</small></div></div>';}).join('')+'</section>';
  h+='</div></div></div>';el.innerHTML=h;wire(el,x);}

function nextFree(x,len){var s=x.free.filter(function(f){return f[1]-f[0]>=len;})[0];return s?s[0]:null;}
function block(taskId,startMin,len){var t=CL.find('tasks',taskId);len=len||LEN;return P.run(function(){return CL.saveFocus({taskId:taskId,title:t?t.title:'',start:at(D.day,startMin).toISOString(),end:at(D.day,startMin+len).toISOString()});},'Focus time blocked');}
function focusMenu(e){var t=e.taskId?CL.find('tasks',e.taskId):null,s=e.storyId?CL.story(e.storyId):null;
  P.modal({title:e.title,kicker:'Focus block · '+P.time(e.start)+' to '+P.time(e.end),size:'sm',body:'<p class="mut small">'+(t?(t.status==='done'?'The task for this block is done.':'Time blocked for this task. Mark it done when you finish.'):'Focus time on your calendar.')+'</p>',
    foot:'<button class="btn bad" data-rm>Remove block</button>'+(s?'<button class="btn" data-st>Open story</button>':'')+(t&&t.status==='open'?'<button class="btn gold" data-ok>Mark task done</button>':''),
    mount:function(a){var b;if((b=a.$('[data-rm]')))b.onclick=function(){a.close();P.run(function(){CL.deleteFocus(e.id);},'Focus block removed');};if((b=a.$('[data-st]')))b.onclick=function(){a.close();P.go('story',s.id);};if((b=a.$('[data-ok]')))b.onclick=function(){a.close();P.run(function(){CL.completeTask(t.id);},'Task completed');};}});}
function wrapUp(x){var carry=x.todo,d=at(D.day,720);
  P.modal({title:'Wrap up the day',kicker:'DaySilk · '+P.date(d,{weekday:'long',month:'long',day:'numeric'}),body:
    '<div class="ds-wrap"><section><h4>Done today <span class="mut">'+x.done.length+'</span></h4>'+(x.done.length?'<ul>'+x.done.map(function(t){return '<li>'+P.icon('check')+esc(t.title)+'</li>';}).join('')+'</ul>':'<p class="small mut">No tasks marked done today.</p>')+'</section>'
    +'<section><h4>Still open</h4>'+(carry.length?carry.map(function(t){return '<label class="ds-carry"><input type="checkbox" data-carry="'+esc(t.id)+'" checked><span>'+esc(t.title)+'<small>'+dueLabel(t)+'</small></span></label>';}).join('')+'<p class="tiny mut">Ticked tasks move to tomorrow at 5 PM.</p>':'<p class="small mut">Nothing left open. A clean finish.</p>')+'</section>'
    +'<label class="ds-wn"><span>Notes for tomorrow</span><textarea class="inp" id="dsWn" rows="4" placeholder="What went well, what is blocked, what to start with tomorrow"></textarea></label></div>',
    foot:'<button class="btn" data-x>Cancel</button><button class="btn gold" data-ok>Save wrap-up</button>',
    mount:function(a){a.$('[data-ok]').onclick=function(){var ids=[].slice.call(document.querySelectorAll('[data-carry]:checked')).map(function(c){return c.dataset.carry;}),moved=carry.filter(function(t){return ids.indexOf(t.id)>=0;}),notes=a.$('#dsWn').value.trim();
      var text='Day wrap-up, '+P.date(d,{weekday:'long',month:'long',day:'numeric'})+'\n\nDone: '+(x.done.length?x.done.map(function(t){return t.title;}).join('; '):'nothing marked done')+'\nMoved to tomorrow: '+(moved.length?moved.map(function(t){return t.title;}).join('; '):'nothing')+(notes?'\n\nNotes for tomorrow:\n'+notes:'');
      var r=P.run(function(){return CL.dayWrap({day:D.day,carry:ids,text:text});},'Day wrapped up'+(ids.length?'. '+ids.length+' task'+(ids.length===1?'':'s')+' moved to tomorrow':''));if(r)a.close();};}});}

function wire(el,x){
  el.onclick=function(ev){var b;
    if((b=ev.target.closest('[data-dd]'))){var n=+b.dataset.dd;D.day=n?addD(D.day,n):ymd(new Date());P.render();return;}
    if(ev.target.closest('[data-plan]')){P.assistant({mode:'plan',text:x.isToday?'Plan my day':'Plan my day for '+P.date(at(D.day,720),{weekday:'long',month:'long',day:'numeric'})+' ('+D.day+')',run:true});return;}
    if(ev.target.closest('[data-wrap]')){wrapUp(x);return;}
    if((b=ev.target.closest('[data-done]'))){P.run(function(){CL.completeTask(b.dataset.done);},'Task completed');return;}
    if((b=ev.target.closest('[data-block]'))){var s=nextFree(x,LEN);if(s==null){P.toast('No free '+LEN+' minutes left between 9 and 6. Drag the task onto the timeline instead.',true);return;}block(b.dataset.block,s);return;}
    if((b=ev.target.closest('[data-ev]'))){var e=CL.find('events',b.dataset.ev);if(!e)return;if(e.type==='focus'&&e.by===CL.me().id)focusMenu(e);else P.go('calendar');}};
  var tl=el.querySelector('[data-tl]'),drag=null;
  el.querySelectorAll('[data-task],.ds-ev.focus[draggable]').forEach(function(n){n.addEventListener('dragstart',function(e){drag=n.dataset.task?{task:n.dataset.task}:{ev:n.dataset.ev};e.dataTransfer.effectAllowed='move';try{e.dataTransfer.setData('text/plain',n.dataset.task||n.dataset.ev);}catch(x){}n.classList.add('dragging');});n.addEventListener('dragend',function(){n.classList.remove('dragging');tl.classList.remove('over');});});
  var minAt=function(e){var r=tl.getBoundingClientRect();return Math.max(H0*60,Math.min(H1*60-15,Math.round(((e.clientY-r.top)/PX*60+H0*60)/15)*15));};
  tl.addEventListener('dragover',function(e){if(!drag)return;e.preventDefault();tl.classList.add('over');var g=tl.querySelector('.ds-ghost')||tl.appendChild(Object.assign(document.createElement('div'),{className:'ds-ghost'})),m=minAt(e),len=drag.ev?evLen(drag.ev):LEN;g.style.top=((m-H0*60)/60*PX)+'px';g.style.height=(len/60*PX)+'px';g.textContent=clock(m);});
  tl.addEventListener('dragleave',function(e){if(e.target===tl){tl.classList.remove('over');var g=tl.querySelector('.ds-ghost');if(g)g.remove();}});
  tl.addEventListener('drop',function(e){if(!drag)return;e.preventDefault();var m=minAt(e),d=drag;drag=null;var g=tl.querySelector('.ds-ghost');if(g)g.remove();tl.classList.remove('over');
    if(d.task)block(d.task,m);else{var f=CL.find('events',d.ev),len=evLen(d.ev);P.run(function(){return CL.saveFocus({id:f.id,taskId:f.taskId||null,title:f.title,start:at(D.day,m).toISOString(),end:at(D.day,m+len).toISOString()});},'Focus block moved');}});}
function evLen(id){var e=CL.find('events',id);return e?Math.max(15,Math.round((new Date(e.end)-new Date(e.start))/6e4)):LEN;}

P.pages.daysilk={title:'DaySilk',render:render};
})();
