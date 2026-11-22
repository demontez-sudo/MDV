/* Tasks and Approvals. Tasks carry a priority and can wait on other tasks; timed rules remind and escalate.
   Approvals lists every decision waiting on the signed-in person, oldest first. */
(function(){
'use strict';
var P=window.CLPortal,esc=P.esc;
var T=P.ui.tasks||(P.ui.tasks={scope:'mine',view:'open',q:''});
var PRI={high:['High','bad'],normal:['Normal',''],low:['Low','mute']},RANK={high:0,normal:1,low:2};
function pri(t){return PRI[t.priority]?t.priority:'normal';}
function dueMs(t){return t.due?new Date(t.due).getTime():Infinity;}
function ymd(d){d=new Date(d);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
function waits(t){return CL.openBlockers(t);}
function groupOf(t){if(!t.due)return 'none';var d=dueMs(t),now=Date.now();if(d<now&&ymd(d)!==ymd(now))return 'over';if(ymd(d)===ymd(now))return 'today';if(d<now+7*864e5)return 'week';return 'later';}
var GROUPS=[['over','Overdue'],['today','Today'],['week','Next 7 days'],['later','Later'],['none','No due date']];
function dueText(t){if(!t.due)return '';var g=groupOf(t);if(g==='over'){var n=Math.max(1,Math.round((Date.now()-dueMs(t))/864e5));return '<span class="bad-t">'+n+'d late</span>';}if(g==='today')return (dueMs(t)<Date.now()?'<span class="bad-t">':'<span>')+'Today '+esc(P.time(t.due))+'</span>';return esc(P.date(t.due,{weekday:'short',month:'short',day:'numeric'}));}
function pool(){var u=CL.me();return CL.state.tasks.filter(function(t){return T.scope==='team'&&CL.can('stories.all')?true:t.assignee===u.id;});}
function sortT(a,b){return RANK[pri(a)]-RANK[pri(b)]||dueMs(a)-dueMs(b);}

function row(t){var w=waits(t),s=t.storyId?CL.story(t.storyId):null,p=PRI[pri(t)],done=t.status!=='open',team=T.scope==='team';
  return '<div class="tk-row'+(done?' is-done':'')+(w.length?' is-wait':'')+'">'+(done?'<span class="ds-chk on">'+P.icon('check')+'</span>':w.length?'<span class="tk-lock" title="Waiting on other tasks">'+P.icon('lock')+'</span>':'<button class="ds-chk" data-done="'+esc(t.id)+'" aria-label="Mark done: '+esc(t.title)+'"></button>')
   +'<div class="grow"><b>'+esc(t.title)+'</b><small>'+(s?'<button class="tk-link" data-story="'+esc(s.id)+'">'+esc(s.title)+'</button> · ':'')+esc(t.source||'Task')+(team?' · '+esc(P.uname(t.assignee)):'')+(t.eventId?' · Prep for a meeting':'')+'</small>'
   +(w.length?'<small class="tk-wait">Waiting on: '+w.map(function(x){return esc(x.title);}).join('; ')+'</small>':'')+'</div>'
   +(pri(t)!=='normal'?'<span class="pill '+p[1]+'">'+p[0]+'</span>':'')+'<span class="tk-due">'+(done?esc('Done '+P.ago(t.doneAt||t.due)):dueText(t))+'</span>'+(!done?'<button class="icon-btn tk-ed" data-edit="'+esc(t.id)+'" aria-label="Edit task">'+P.icon('edit')+'</button>':'')+'</div>';}

function dialog(t){var isNew=!t,u=CL.me(),lead=CL.can('stories.all');t=t||{priority:'normal'};
  var cands=CL.state.tasks.filter(function(x){return x.status==='open'&&x.id!==t.id;}).sort(function(a,b){return (b.storyId&&b.storyId===t.storyId?1:0)-(a.storyId&&a.storyId===t.storyId?1:0)||sortT(a,b);}).slice(0,60),bl=t.blockedBy||[];
  var staff=CL.state.users.filter(function(x){return x.active&&x.role!=='network_reviewer';}).map(function(x){return [x.id,x.name+(x.id===u.id?' (you)':'')];});
  P.modal({title:isNew?'New task':'Edit task',kicker:'Tasks',body:'<div class="fg">'+P.input('Task','t_ti',t.title||'','w')
    +P.select('Priority','t_pr',[['high','High'],['normal','Normal'],['low','Low']],pri(t))+P.input('Due','t_du',t.due?P.localInput(t.due):'','','datetime-local')
    +(lead?P.select('Owner','t_ow',staff,t.assignee||u.id):'')+P.select('Story','t_st',[['','No story']].concat(CL.visibleStories().map(function(s){return [s.id,s.title];})),t.storyId||'',lead?'':'w')
    +P.area('Notes','t_no',t.notes||'','w')
    +'<fieldset class="fld w tk-dep"><span>Waits on <small class="mut">This task cannot be finished until these are done.</small></span>'+(cands.length?'<input class="inp" id="t_df" placeholder="Filter tasks" aria-label="Filter tasks"><div class="tk-deps">'+cands.map(function(x){var s=x.storyId?CL.story(x.storyId):null;return '<label class="chk small" data-dt="'+esc((x.title+' '+(s?s.title:'')).toLowerCase())+'"><input type="checkbox" data-dep="'+esc(x.id)+'"'+(bl.indexOf(x.id)>=0?' checked':'')+'><span>'+esc(x.title)+(s?' <em class="mut">· '+esc(s.title)+'</em>':'')+'</span></label>';}).join('')+'</div>':'<p class="tiny mut">No other open tasks.</p>')+'</fieldset></div>',
    foot:'<button class="btn" data-x>Cancel</button><button class="btn gold" data-ok>'+(isNew?'Add task':'Save')+'</button>',
    mount:function(a){var f=a.$('#t_df');if(f)f.oninput=function(){var q=f.value.toLowerCase();a.el.querySelectorAll('[data-dt]').forEach(function(l){l.hidden=q&&l.dataset.dt.indexOf(q)<0;});};
      a.$('[data-ok]').onclick=function(){var due=P.val('t_du',a.el),d={title:P.val('t_ti',a.el),priority:P.val('t_pr',a.el),due:due?new Date(due).toISOString():null,storyId:P.val('t_st',a.el)||null,notes:P.val('t_no',a.el),blockedBy:[].map.call(a.el.querySelectorAll('[data-dep]:checked'),function(x){return x.dataset.dep;})};if(lead)d.assignee=P.val('t_ow',a.el);
        if(P.run(function(){return isNew?CL.createTask(d):CL.editTask(t.id,d);},isNew?'Task added':'Task saved'))a.close();};}});}
P.taskDialog=dialog;

P.pages.tasks={title:'Tasks',render:function(el){var u=CL.me(),lead=CL.can('stories.all'),all=pool(),open=all.filter(function(t){return t.status==='open';}),q=T.q.toLowerCase(),wk=Date.now()-7*864e5;if(!lead)T.scope='mine';
  var list=(T.view==='done'?all.filter(function(t){return t.status==='done'&&new Date(t.doneAt||0).getTime()>Date.now()-30*864e5;}).sort(function(a,b){return new Date(b.doneAt)-new Date(a.doneAt);}):open.filter(function(t){return T.view==='waiting'?waits(t).length:T.view==='high'?pri(t)==='high':true;})).filter(function(t){if(!q)return true;var s=t.storyId?CL.story(t.storyId):null;return (t.title+' '+(s?s.title:'')+' '+P.uname(t.assignee)).toLowerCase().indexOf(q)>=0;});
  var k=[['open','Open',open.length,'list'],['high','High priority',open.filter(function(t){return pri(t)==='high';}).length,'star'],['waiting','Waiting',open.filter(function(t){return waits(t).length;}).length,'lock'],['done','Done this week',all.filter(function(t){return t.status==='done'&&new Date(t.doneAt||0).getTime()>wk;}).length,'check']];
  var h=P.head('Daily','Tasks','Everything '+(T.scope==='team'?'the team owns':'you own')+', in priority order. Tasks that wait on other work unlock when it is done.','<button class="btn gold" data-new>'+P.icon('plus')+'New task</button>')
   +'<div class="kpis">'+k.map(function(x){return '<button class="kpi'+(T.view===x[0]?' on':'')+'" data-view="'+x[0]+'">'+P.icon(x[3])+'<div><small>'+x[1]+'</small><b>'+x[2]+'</b></div></button>';}).join('')+'</div>'
   +'<div class="tools">'+(lead?'<div class="seg" role="group" aria-label="Whose tasks"><button class="'+(T.scope==='mine'?'on':'')+'" data-scope="mine">Mine</button><button class="'+(T.scope==='team'?'on':'')+'" data-scope="team">Team</button></div>':'')+'<label class="search">'+P.icon('search')+'<input id="tq" type="search" value="'+esc(T.q)+'" placeholder="Search tasks" aria-label="Search tasks"></label></div>';
  if(T.view==='done')h+='<section class="card tk-card"><h3>Done in the last 30 days <span class="mut">'+list.length+'</span></h3>'+(list.map(row).join('')||'<p class="small mut">Nothing completed yet.</p>')+'</section>';
  else{var any=false;GROUPS.forEach(function(g){var rows=list.filter(function(t){return groupOf(t)===g[0];}).sort(sortT);if(!rows.length)return;any=true;h+='<section class="card tk-card'+(g[0]==='over'?' tk-over':'')+'"><h3>'+g[1]+' <span class="mut">'+rows.length+'</span></h3>'+rows.map(row).join('')+'</section>';});if(!any)h+='<p class="empty">'+(T.view==='open'&&!q?'No open tasks. Clear desk.':'Nothing in this view.')+'</p>';}
  el.innerHTML='<div class="tk">'+h+'</div>';
  el.onclick=function(e){var b;if(e.target.closest('[data-new]')){dialog(null);return;}if((b=e.target.closest('[data-view]'))){T.view=T.view===b.dataset.view&&b.dataset.view!=='open'?'open':b.dataset.view;P.render();return;}if((b=e.target.closest('[data-scope]'))){T.scope=b.dataset.scope;P.render();return;}
    if((b=e.target.closest('[data-done]'))){P.run(function(){CL.completeTask(b.dataset.done);},'Task completed');return;}if((b=e.target.closest('[data-edit]'))){dialog(CL.find('tasks',b.dataset.edit));return;}if((b=e.target.closest('[data-story]'))){P.go('story',b.dataset.story);}};
  var i=el.querySelector('#tq');i.onchange=function(){T.q=i.value;P.render();};}};

var KIND_ICON={Pitch:'mic',Screening:'shield',Cut:'play','One Sheet':'star',Delivery:'send',Lead:'pin'};
P.pages.approvals={title:'Approvals',render:function(el){var list=CL.approvalsFor(CL.me()),kinds={};list.forEach(function(a){(kinds[a.kind]=kinds[a.kind]||[]).push(a);});
  var age=function(v){if(!v)return '';var n=Math.floor((Date.now()-new Date(v).getTime())/864e5);return n<=0?'Since today':n===1?'Waiting 1 day':'Waiting '+n+' days';};
  var h=P.head('Daily','Approvals','Every decision waiting on you, oldest first. Each opens the record where you decide.')
   +'<div class="kpis">'+Object.keys(KIND_ICON).filter(function(k){return kinds[k];}).map(function(k){return P.kpi(KIND_ICON[k],k,kinds[k].length,'Waiting on you');}).join('')+'</div>';
  h+=list.length?'<section class="card tk-card"><h3>Waiting on you <span class="mut">'+list.length+'</span></h3>'+list.map(function(a){var n=a.since?Math.floor((Date.now()-new Date(a.since).getTime())/864e5):0;return '<div class="tk-row ap-row">'+'<span class="ap-ic">'+P.icon(KIND_ICON[a.kind]||'check')+'</span><div class="grow"><b>'+esc(a.title)+'</b><small>'+esc(a.kind)+' · '+esc(a.sub)+'</small></div><span class="tk-due'+(n>=3?' bad-t':'')+'">'+esc(age(a.since))+'</span><button class="btn sm" data-open="'+esc(a.page)+'"'+(a.id?' data-id="'+esc(a.id)+'"':'')+'>Open</button></div>';}).join('')+'</section>':'<p class="empty">Nothing is waiting on you. Every decision is made.</p>';
  el.innerHTML='<div class="tk">'+h+'</div>';
  el.onclick=function(e){var b=e.target.closest('[data-open]');if(b)P.go(b.dataset.open,b.dataset.id||undefined);};}};
})();
