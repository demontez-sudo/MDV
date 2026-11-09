/* DaySilk for models: the day, built around their model life. A first-login questionnaire (school, work, rhythm, model goals)
   turns into a daily plan with routine, training, school and work blocks, habits and a Big 3, beside what the agency has booked.
   School and work times can be shared with the agent as book-outs. Saved through /api/model/daysilk. */
(function(){
'use strict';
if(window.MDV_MODEL_DAYSILK)return;

var U=function(){return window.DS&&DS.util;};
var S={ds:null,loaded:false,loading:false,err:'',day:null,tab:'today',host:null,saving:{},asked:false,sync:null};

function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c];});}
function arr(v){return Array.isArray(v)?v:[];}
function boot(){return window.VEUX_MODEL&&VEUX_MODEL.getBoot?VEUX_MODEL.getBoot():{};}
function api(path,body){var o=body?{method:'POST',body:JSON.stringify(Object.assign({organization_slug:'maison-de-veux'},body))}:{method:'GET'};return VEUX_MODEL.api(path,o);}
function toast(m){try{if(window.toast)return window.toast(m);}catch(e){}}
function firstName(){var m=(boot().model||boot().profile||{}),n=m.display_name||m.first_name||(boot().current_user&&boot().current_user.profile&&boot().current_user.profile.first_name)||'';return String(n).trim().split(/\s+/)[0]||'';}
function today(){var d=new Date();d.setHours(0,0,0,0);return d;}
function dk(d){return U().iso(new Date(d));}
function addD(d,n){var x=new Date(d);x.setDate(x.getDate()+n);return x;}
function tl(t){return U().fmtT(t);}

/* ---------- the questionnaire ---------- */
var yes=function(k){return function(a){return a[k]==='Yes';};};
var QS=[
 {k:'you',s:'You',i:'A few basics so DaySilk fits your real life, not a template.',q:[
  ['first','What should we call you?','text','','Your first name',null,'required'],
  ['city','What city do you live in?','text'],
  ['stage','Where are you in your modeling?','choice',['Just starting','Developing','Working regularly','Established']],
  ['roles','What else fills your days besides modeling?','multi',['School','A job','Family','Fitness','Creative work','Faith or service','Content creating']]]},
 {k:'school',s:'School',i:'Share your class times and your agent will see them as book-outs, so you are never booked over class.',q:[
  ['hasSchool','Are you in school right now?','yesno'],
  ['school','What is the school or program?','text','','School name',yes('hasSchool')],
  ['schoolDays','Which days do you have class?','days',null,null,yes('hasSchool')],
  ['schoolStart','Class usually starts at','time','09:00',null,yes('hasSchool')],
  ['schoolEnd','And finishes at','time','15:00',null,yes('hasSchool')],
  ['semesterEnd','When does this term end? (optional)','date',null,'Book-outs stop on this date',yes('hasSchool')]]},
 {k:'work',s:'Work',i:'A job outside modeling? Same idea: your shifts become book-outs.',q:[
  ['hasWork','Do you work another job?','yesno'],
  ['job','Where do you work?','text','','Job or workplace',yes('hasWork')],
  ['workDays','Which days do you work?','days',null,null,yes('hasWork')],
  ['workStart','Shift usually starts at','time','10:00',null,yes('hasWork')],
  ['workEnd','And ends at','time','17:00',null,yes('hasWork')],
  ['other','Anything else your agent should plan around? (optional)','long',null,'For example: church on Sundays 10 to 12, caring for a sibling after school']]},
 {k:'availability',s:'Booking rules',i:'So your agent books you in a way that works.',q:[
  ['notice','How much notice do you need for a casting or booking?','choice',['Same day is fine','1 day','2 or more days']],
  ['shortTravel','Can you travel for work on short notice?','choice',['Yes','Sometimes','Not usually']],
  ['share','Share your school and work times with your agent as book-outs?','yesno',null,'You can change this any time. Only the times are shared, not the details.']]},
 {k:'rhythm',s:'Rhythm',i:'Your day is built around when you wake, sleep and have energy.',q:[
  ['wake','What time do you want to wake up?','time','07:00'],
  ['sleep','What time do you want to be asleep?','time','22:30'],
  ['energy','When is your energy highest?','choice',['Early morning','Late morning','Afternoon','Evening']],
  ['morning','How do your mornings usually go?','choice',['Rushed','Slow','No routine','A solid routine']],
  ['sleepq','How has your sleep been lately?','scale',['Poor','','Okay','','Great']],
  ['windDown','What helps you wind down?','multi',['Reading','Shower or bath','Music','Prayer or meditation','Stretching','Journaling','TV']]]},
 {k:'model',s:'Your model life',i:'The habits that make a model book more and last longer.',q:[
  ['want','What do you want more of?','multi',['Editorial','Runway','Commercial','Fittings and showroom','Content and social','Travel work']],
  ['skin','How is your skincare routine?','choice',['I have a full routine','Basic','I need help building one']],
  ['trainDays','How many days a week do you want to train?','choice',['0','1','2','3','4','5']],
  ['trainKind','What kind of training?','multi',['Walk or run','Pilates','Yoga','Weights','Dance','Swim','Home workout']],
  ['trainTime','When do you prefer to train?','choice',['Morning','After school or work','Evening']],
  ['nutrition','How do you want to eat?','multi',['Balanced','High protein','Plant-based','Meal prep','I need help']],
  ['water','Water goal per day','choice',['6 glasses','8 glasses','10 glasses']],
  ['practice','Do you want a daily walk and posing practice?','yesno',null,'Ten minutes keeps you sharp for castings.'],
  ['social','How often do you want to post or engage?','choice',['Not a focus','3 times a week','5 times a week','Daily']],
  ['measure','How often should you check your measurements?','choice',['Monthly','Every 3 months','Not sure yet']]]},
 {k:'goals',s:'Goals',i:'DaySilk turns these into weekly steps.',q:[
  ['vision','Picture yourself a year from now. What is different?','long'],
  ['goal1','Your number one goal for the next 90 days','text',''],
  ['goal2','A second goal (optional)','text',''],
  ['obstacle','What gets in your way most?','choice',['Consistency','Confidence','Time','Money','Travel and visas','Not sure']]]}
];

/* ---------- from answers to a plan ---------- */
function spread(n,pool){n=Math.max(0,Math.min(Number(n)||0,pool.length));if(!n)return [];var out=[],step=pool.length/n;for(var i=0;i<n;i++)out.push(pool[Math.floor(i*step)]);return out;}
function overlap(a1,a2,b1,b2){return a1<b2&&b1<a2;}
/* The gameplan adds routine blocks, habits and weekly items beside the plan (ds.gameplan). They are merged for display only, so saving the questionnaire never erases them. */
function withGp(ds){
  if(!ds||!ds.plan||!ds.gameplan)return ds;
  var g=ds.gameplan,p=ds.plan,seen={};
  function add(base,extra,key){var have={};arr(base).forEach(function(x){have[x[key]]=1;});return arr(base).concat(arr(extra).filter(function(x){return !have[x[key]];}));}
  var out={};for(var k in ds)out[k]=ds[k];
  var np={};for(var j in p)np[j]=p[j];
  np.blocks=add(p.blocks,g.blocks,'id');np.habits=add(p.habits,g.habits,'id');np.weekly=add(p.weekly,g.weekly,'k');
  out.plan=np;return out;
}
function buildPlan(a){
  var T=U(),tm=T.tMin,mt=T.m2t,all=['0','1','2','3','4','5','6'];
  var wake=a.wake||'07:00',sleep=a.sleep||'22:30',blocks=[],fixed=[];
  if(a.hasSchool==='Yes'&&arr(a.schoolDays).length)fixed.push({id:'school',days:a.schoolDays,start:a.schoolStart||'09:00',end:a.schoolEnd||'15:00',title:a.school||'School',cat:'school',bookout:true,until:a.semesterEnd||''});
  if(a.hasWork==='Yes'&&arr(a.workDays).length)fixed.push({id:'work',days:a.workDays,start:a.workStart||'10:00',end:a.workEnd||'17:00',title:a.job||'Work',cat:'work',bookout:true,until:''});
  fixed.forEach(function(f){blocks.push(f);});
  var w=tm(wake);
  blocks.push({id:'wake',days:all,start:wake,end:mt(w+15),title:'Wake up · water first',cat:'routine'});
  if(a.skin&&a.skin!=='')blocks.push({id:'skin_am',days:all,start:mt(w+15),end:mt(w+25),title:'Skincare · morning',cat:'routine'});
  blocks.push({id:'breakfast',days:all,start:mt(w+30),end:mt(w+60),title:'Breakfast',cat:'meal'});
  blocks.push({id:'lunch',days:all,start:'12:30',end:'13:15',title:'Lunch',cat:'meal'});
  blocks.push({id:'dinner',days:all,start:'18:45',end:'19:30',title:'Dinner',cat:'meal'});
  function busyOn(d,s,e){return fixed.some(function(f){return f.days.indexOf(d)>-1&&overlap(s,e,tm(f.start),tm(f.end));});}
  /* training: spread across the week, in the preferred slot, nudged clear of school and work */
  var n=Number(a.trainDays)||0,mins=45,kind=arr(a.trainKind)[0]||'Workout';
  var order=['1','3','5','2','4','6','0'],tdays=spread(n,order.slice(0,Math.max(n,1)));
  if(n>3)tdays=order.slice(0,n);
  tdays.forEach(function(d){
    var pref=a.trainTime||(a.energy==='Evening'?'Evening':'Morning'),start=pref==='Morning'?w+75:pref==='Evening'?18*60+30:15*60+30;
    if(pref==='After school or work'){var ends=fixed.filter(function(f){return f.days.indexOf(d)>-1;}).map(function(f){return tm(f.end);});if(ends.length)start=Math.max.apply(null,ends)+45;}
    var guard=0;while(busyOn(d,start,start+mins)&&guard++<12)start+=60;
    if(start+mins>tm(sleep)-60){start=w+75;guard=0;while(busyOn(d,start,start+mins)&&guard++<10)start+=45;}
    blocks.push({id:'train_'+d,days:[d],start:mt(start),end:mt(start+mins),title:kind+' · training',cat:'train'});
  });
  if(a.practice==='Yes'){var ps=(a.energy==='Evening'?20*60:w+60+20);blocks.push({id:'practice',days:all,start:mt(ps),end:mt(ps+15),title:'Walk and posing practice',cat:'model'});}
  if(a.hasSchool==='Yes'&&arr(a.schoolDays).length){var se=tm(a.schoolEnd||'15:00');blocks.push({id:'study',days:a.schoolDays,start:mt(se+45),end:mt(se+105),title:'Study time',cat:'school'});}
  blocks.push({id:'wind',days:all,start:mt(tm(sleep)-60),end:mt(tm(sleep)-30),title:'Wind down · skincare night',cat:'routine'});
  blocks.push({id:'sleep',days:all,start:sleep,end:mt(tm(sleep)+10),title:'Lights out',cat:'rest'});

  var habits=[{id:'water',label:'Water: '+(a.water||'8 glasses')},{id:'sleep',label:'In bed by '+T.fmtT(sleep)},{id:'move',label:'Move your body'},{id:'portal',label:'Check the portal and reply to your agent'}];
  if(a.skin)habits.splice(1,0,{id:'skin',label:'Skincare morning and night'});
  if(a.practice==='Yes')habits.push({id:'practice',label:'Walk and posing practice'});
  if(arr(a.nutrition).length&&arr(a.nutrition)[0]!=='I need help')habits.push({id:'eat',label:'Eat to your plan: '+arr(a.nutrition).slice(0,2).join(', ').toLowerCase()});
  if(/times|Daily/.test(a.social||''))habits.push({id:'social',label:'Post or engage ('+String(a.social).toLowerCase()+')'});
  habits.push({id:'stretch',label:'Stretch for 5 minutes'});
  var goals=[a.goal1,a.goal2].filter(function(g){return g&&String(g).trim();});
  var weekly=[{k:'sun',t:'Sunday review: what went well, what to change, your Big 3 for Monday'}];
  if(a.measure==='Monthly')weekly.push({k:'measure',t:'Update your measurements in My Profile on the 1st of the month'});
  if(a.measure==='Every 3 months')weekly.push({k:'measure',t:'Update your measurements every 3 months'});
  weekly.push({k:'digitals',t:'Check your digitals are current. Fresh digitals book more'});
  return {built:dk(new Date()),blocks:blocks,habits:habits.slice(0,9),goals:goals,weekly:weekly,share:a.share!=='No',notice:a.notice||'',tz:(Intl.DateTimeFormat().resolvedOptions().timeZone)||''};
}
function blocksOn(plan,date){var d=new Date(date),dow=String(d.getDay()),k=dk(d);return arr(plan&&plan.blocks).filter(function(b){return arr(b.days).indexOf(dow)>-1&&(!b.until||k<=b.until);}).sort(function(a,b){return U().tMin(a.start)-U().tMin(b.start);});}
function bookoutBlocks(plan,weeks){
  var out=[],t0=today();
  for(var i=0;i<weeks*7;i++){
    var day=addD(t0,i);
    blocksOn(plan,day).filter(function(b){return b.bookout;}).forEach(function(b){
      var sp=b.start.split(':').map(Number),ep=b.end.split(':').map(Number),s=new Date(day),e=new Date(day);s.setHours(sp[0],sp[1],0,0);e.setHours(ep[0],ep[1],0,0);
      out.push({starts_at:s.toISOString(),ends_at:e.toISOString(),reason:b.title+' '+tl(b.start)+' to '+tl(b.end)});
    });
  }
  return out;
}

/* ---------- data ---------- */
function load(force){
  if(S.loading||(S.loaded&&!force))return Promise.resolve();
  S.loading=true;S.err='';
  return api('/api/model/daysilk').then(function(r){S.ds=withGp(r&&r.daysilk||null);S.loaded=true;}).catch(function(e){S.err=(e&&e.message)||'Could not load DaySilk.';S.loaded=true;}).then(function(){S.loading=false;paint();if(!S.ds&&!S.err)ask(false);});
}
function dayData(date){var d=(S.ds&&S.ds.days&&S.ds.days[dk(date)])||{};return {done:arr(d.done),big3:arr(d.big3),review:d.review||null};}
var timers={};
function setDay(date,patch){
  if(!S.ds)return;var k=dk(date),cur=dayData(date),next=Object.assign({},cur,patch);
  S.ds.days=S.ds.days||{};S.ds.days[k]=next;
  clearTimeout(timers[k]);timers[k]=setTimeout(function(){api('/api/model/daysilk',{action:'save_day',date:k,day:next}).catch(function(){toast('Could not save. Check your connection.');});},700);
}
function ask(force){
  if(!window.DS||(S.asked&&!force))return;S.asked=true;
  var a=Object.assign({first:firstName()},(S.ds&&S.ds.answers)||{});
  DS.wizard({title:'Set up your DaySilk',brand:'DaySilk · for models',sections:QS,answers:a,intro:'About 4 minutes. You can change any answer later.',saveLabel:'Build my DaySilk',skipLabel:force?'Cancel':'Do this later',
    onSave:function(ans){var plan=buildPlan(ans);return api('/api/model/daysilk',{action:'save_profile',answers:ans,plan:plan}).then(function(r){S.ds=withGp(r.daysilk);return syncBookouts(ans.share!=='No',true);});}
  }).then(function(ans){if(ans){toast('Your DaySilk is ready');S.tab='today';}paint();});
}
function syncBookouts(share,quiet){
  var plan=S.ds&&S.ds.plan;if(!plan)return Promise.resolve();
  var blocks=share?bookoutBlocks(plan,8):[];
  return api('/api/model/daysilk',{action:'sync_bookouts',share:!!share,blocks:blocks,timezone:plan.tz||''}).then(function(r){S.ds.bookouts={shared:!!share,count:r.created||0,synced_at:new Date().toISOString()};if(!quiet)toast(share?('Shared '+(r.created||0)+' book-outs with your agent'):'Book-outs removed');paint();return r;}).catch(function(e){if(!quiet)toast((e&&e.message)||'Could not update your book-outs');throw e;});
}

/* ---------- what the agency has planned ---------- */
function agencyItems(date){
  var k=dk(date),rows=[];
  try{rows=window.VEUX_MODEL_V15&&VEUX_MODEL_V15.calendarRows?VEUX_MODEL_V15.calendarRows():[];}catch(e){rows=[];}
  return rows.filter(function(r){return r.date&&dk(r.date)===k&&!/declin|cancel/i.test(String(r.status||''));}).map(function(r){return {kind:r.kind,title:r.title,start:new Date(r.date),end:(r.end||r.deadline)?new Date(r.end||r.deadline):null,sub:r.sub||'',status:r.status||'',id:r.id};});
}
function tlabel(d){var h=d.getHours(),m=d.getMinutes();return (h%12||12)+(m?':'+String(m).padStart(2,'0'):'')+(h>=12?'pm':'am');}

/* ---------- painting ---------- */
function ring(p){var tone=p>=80?'ok':p>=40?'warn':'bad';return '<div class="mds-ring '+tone+'" style="--p:'+p+'"><b>'+p+'</b><small>%</small></div>';}
function greet(){var h=new Date().getHours();return h<12?'Good morning':h<17?'Good afternoon':'Good evening';}
function todayTab(){
  var d=S.day,plan=S.ds.plan,dd=dayData(d),isT=dk(d)===dk(new Date()),blocks=blocksOn(plan,d),ag=agencyItems(d),now=new Date();
  var habits=arr(plan.habits),doneH=dd.done.filter(function(x){return habits.some(function(h){return h.id===x;});}).length;
  var big=[0,1,2].map(function(i){return dd.big3[i]||{t:'',done:false};});
  var totalTasks=habits.length+big.filter(function(b){return b.t;}).length,doneTasks=doneH+big.filter(function(b){return b.t&&b.done;}).length,pct=totalTasks?Math.round(doneTasks/totalTasks*100):0;
  var timed=ag.map(function(x){return {s:x.start.getHours()*60+x.start.getMinutes(),title:x.title,kind:'agency',sub:x.sub,e:x.end?x.end.getHours()*60+x.end.getMinutes():null};}).concat(blocks.filter(function(b){return b.cat!=='rest';}).map(function(b){return {s:U().tMin(b.start),e:U().tMin(b.end),title:b.title,kind:b.cat,id:b.id,bookout:b.bookout};})).sort(function(a,b){return a.s-b.s;});
  var nowM=now.getHours()*60+now.getMinutes(),cur=null,nxt=null;
  timed.forEach(function(x){var e=x.e||x.s+30;if(isT&&x.s<=nowM&&e>nowM&&!cur)cur=x;else if((!isT||x.s>nowM)&&!nxt)nxt=x;});
  function line(l,x){return '<div class="mds-nn"><small>'+l+'</small>'+(x?'<b>'+esc(x.title)+'</b><span>'+esc(tl(U().m2t(x.s)))+(x.sub?' · '+esc(x.sub):'')+'</span>':'<b class="mute">Nothing '+(l==='Now'?'right now':'else planned')+'</b>')+'</div>';}
  var agencyHtml=ag.length?ag.map(function(x){return '<div class="mds-ag '+esc(x.kind)+'"><time>'+esc(x.start.getHours()===0&&x.start.getMinutes()===0?'All day':tlabel(x.start)+(x.end&&x.end>x.start?' – '+tlabel(x.end):''))+'</time><div><b>'+esc(x.title)+'</b><small>'+esc([x.kind,x.sub,x.status].filter(Boolean).join(' · '))+'</small></div></div>';}).join(''):'<p class="mds-empty">Nothing booked by your agency today.</p>';
  var routine=blocks.map(function(b){var on=dd.done.indexOf('b:'+b.id)>-1;return '<li class="'+esc(b.cat)+(on?' done':'')+'"><button type="button" class="mds-chk'+(on?' on':'')+'" data-mds-block="'+esc(b.id)+'" aria-label="Mark done"></button><time>'+esc(tl(b.start))+'</time><span>'+esc(b.title)+'</span>'+(b.bookout?'<em>Shared as a book-out</em>':'')+'</li>';}).join('');
  var hab=habits.map(function(h){var on=dd.done.indexOf(h.id)>-1;return '<button type="button" class="mds-h'+(on?' on':'')+'" data-mds-habit="'+esc(h.id)+'">'+(on?'✓ ':'')+esc(h.label)+'</button>';}).join('');
  var bigH=big.map(function(b,i){return '<li class="'+(b.done?'done':'')+'"><button type="button" class="mds-chk'+(b.done?' on':'')+'" data-mds-big="'+i+'" aria-label="Mark done"></button><input type="text" maxlength="140" data-mds-bigt="'+i+'" value="'+esc(b.t)+'" placeholder="Big '+(i+1)+': one result that makes today a win"></li>';}).join('');
  var rv=dd.review||{};
  return '<section class="mds-top"><div class="mds-t1">'+ring(pct)+'<div><small>'+esc(d.toLocaleDateString([],{weekday:'long',month:'long',day:'numeric'}))+'</small><h2>'+(isT?greet()+(firstName()?', '+esc(firstName()):''):esc(d.toLocaleDateString([],{weekday:'long'})))+'</h2><p>'+doneTasks+' of '+totalTasks+' done'+(ag.length?' · '+ag.length+' from your agency':'')+'</p></div></div><div class="mds-t2">'+(isT?line('Now',cur):'')+line(isT?'Next':'First up',nxt)+'</div><div class="mds-t3"><h4>Big 3</h4><ul class="mds-big">'+bigH+'</ul></div></section>'
   +'<div class="mds-cols"><div><section class="mds-card"><header><h3>From your agency</h3></header>'+agencyHtml+'</section><section class="mds-card"><header><h3>Your day</h3><span>'+blocks.length+' blocks</span></header><ul class="mds-rt">'+routine+'</ul></section></div>'
   +'<div><section class="mds-card"><header><h3>Daily habits</h3><span>'+doneH+' of '+habits.length+'</span></header><div class="mds-hb">'+hab+'</div></section>'
   +'<section class="mds-card"><header><h3>Evening review</h3><span>2 minutes</span></header><label class="mds-f"><span>One win today</span><input type="text" maxlength="300" data-mds-rv="win" value="'+esc(rv.win||'')+'"></label><label class="mds-f"><span>What was hard</span><input type="text" maxlength="300" data-mds-rv="hard" value="'+esc(rv.hard||'')+'"></label><div class="mds-mood"><span>Energy today</span>'+[1,2,3,4,5].map(function(n){return '<button type="button" class="'+(Number(rv.mood)===n?'on':'')+'" data-mds-mood="'+n+'">'+n+'</button>';}).join('')+'</div></section></div></div>';
}
function weekTab(){
  var plan=S.ds.plan,m=new Date(S.day);m.setDate(m.getDate()-((m.getDay()+6)%7));m.setHours(0,0,0,0);var habits=arr(plan.habits),cols='';
  for(var i=0;i<7;i++){
    var d=addD(m,i),bl=blocksOn(plan,d).filter(function(b){return b.cat==='school'||b.cat==='work'||b.cat==='train'||b.cat==='model';}),ag=agencyItems(d),dd=dayData(d),isT=dk(d)===dk(new Date()),pct=habits.length?Math.round(dd.done.filter(function(x){return habits.some(function(h){return h.id===x;});}).length/habits.length*100):0;
    cols+='<button type="button" class="mds-wd'+(isT?' today':'')+'" data-mds-go="'+dk(d)+'"><header><small>'+d.toLocaleDateString([],{weekday:'short'})+'</small><b>'+d.getDate()+'</b></header>'
      +ag.map(function(x){return '<div class="mds-wi ag"><span>'+esc(x.title)+'</span></div>';}).join('')
      +bl.map(function(b){return '<div class="mds-wi '+esc(b.cat)+'"><span>'+esc(b.title)+'</span><em>'+esc(tl(b.start))+'</em></div>';}).join('')
      +'<div class="mds-wbar" title="Habits done"><i style="width:'+pct+'%"></i></div></button>';
  }
  var ws=m.toLocaleDateString([],{month:'short',day:'numeric'}),we=addD(m,6).toLocaleDateString([],{month:'short',day:'numeric'});
  return '<section class="mds-card"><header><h3>Week of '+esc(ws)+' to '+esc(we)+'</h3><span>Tap a day to open it</span></header><div class="mds-wk">'+cols+'</div></section>'
    +'<section class="mds-card"><header><h3>This week</h3></header><ul class="mds-ul">'+arr(plan.weekly).map(function(w){return '<li>'+esc(w.t)+'</li>';}).join('')+'</ul></section>';
}
function planTab(){
  var ds=S.ds,plan=ds.plan,a=ds.answers||{},bo=ds.bookouts||{},fixed=arr(plan.blocks).filter(function(b){return b.bookout;});
  var names={'1':'Mon','2':'Tue','3':'Wed','4':'Thu','5':'Fri','6':'Sat','0':'Sun'};
  var fx=fixed.length?fixed.map(function(b){return '<li><b>'+esc(b.title)+'</b><span>'+arr(b.days).map(function(d){return names[d];}).join(', ')+' · '+esc(tl(b.start))+' to '+esc(tl(b.end))+(b.until?' · until '+esc(b.until):'')+'</span></li>';}).join(''):'<li><span>No school or work times added.</span></li>';
  return '<section class="mds-card"><header><h3>Book-outs shared with your agent</h3><span>'+(bo.shared?'On':'Off')+'</span></header><p class="mds-p">'+(bo.shared?'Your school and work times show on your agent’s calendar as book-outs for the next 8 weeks, so you are not booked over them.'+(bo.synced_at?' Last updated '+esc(new Date(bo.synced_at).toLocaleDateString([],{month:'short',day:'numeric'}))+' ('+(bo.count||0)+' book-outs).':''):'Nothing is shared. Turn it on so your agent can see when you are in class or at work.')+'</p><ul class="mds-ul fx">'+fx+'</ul><div class="mds-act">'+(bo.shared?'<button type="button" class="mds-btn" data-mds-sync="1">Refresh book-outs</button><button type="button" class="mds-btn" data-mds-sync="0">Stop sharing</button>':'<button type="button" class="mds-btn gold" data-mds-sync="1">Share with my agent</button>')+'</div></section>'
   +'<section class="mds-card"><header><h3>Your goals</h3></header>'+(arr(plan.goals).length?'<ul class="mds-ul">'+plan.goals.map(function(g){return '<li>'+esc(g)+'</li>';}).join('')+'</ul>':'<p class="mds-p">No goals yet.</p>')+(a.vision?'<p class="mds-p"><b>A year from now:</b> '+esc(a.vision)+'</p>':'')+(a.obstacle&&a.obstacle!=='Not sure'?'<p class="mds-p"><b>What gets in the way:</b> '+esc(a.obstacle)+'. Your habits are built to help with that.</p>':'')+'</section>'
   +'<section class="mds-card"><header><h3>Your answers</h3></header><p class="mds-p">Change your school, work, routine or goals and DaySilk rebuilds your plan.</p><div class="mds-act"><button type="button" class="mds-btn gold" data-mds-redo="1">Update my answers</button></div></section>';
}
function paint(){
  var el=S.host;if(!el)return;
  if(!S.loaded){el.innerHTML='<div class="v15m-page mds"><div class="mds-empty">Loading your DaySilk…</div></div>';return;}
  if(S.err&&!S.ds){el.innerHTML='<div class="v15m-page mds"><div class="mds-empty">'+esc(S.err)+'</div></div>';return;}
  if(!S.ds){el.innerHTML='<div class="v15m-page mds"><div class="v15m-head"><div><div class="v15m-kicker">DaySilk</div><h1>Your day, built around you</h1></div></div><div class="mds-card mds-intro"><p class="mds-p">Answer a few questions about your school, work, routine and goals. DaySilk builds your daily plan, shares your class and work times with your agent as book-outs, and helps you become a better model, one good day at a time.</p><div class="mds-act"><button type="button" class="mds-btn gold" data-mds-redo="1">Set up my DaySilk</button></div></div></div>';return;}
  var d=S.day,nav='<div class="mds-nav"><button type="button" data-mds-nav="-1" aria-label="Previous">‹</button><button type="button" data-mds-nav="0">Today</button><button type="button" data-mds-nav="1" aria-label="Next">›</button></div>';
  var tabs=[['today','Today'],['week','Week'],['plan','My plan']].map(function(t){return '<button type="button" class="'+(S.tab===t[0]?'on':'')+'" data-mds-tab="'+t[0]+'">'+t[1]+'</button>';}).join('');
  var body=S.tab==='week'?weekTab():S.tab==='plan'?planTab():todayTab();
  var keep=document.activeElement&&document.activeElement.getAttribute&&(document.activeElement.getAttribute('data-mds-bigt')||document.activeElement.getAttribute('data-mds-rv'));
  var focusKey=document.activeElement&&document.activeElement.hasAttribute&&(document.activeElement.hasAttribute('data-mds-bigt')?'bigt:'+document.activeElement.getAttribute('data-mds-bigt'):document.activeElement.hasAttribute('data-mds-rv')?'rv:'+document.activeElement.getAttribute('data-mds-rv'):'');
  el.innerHTML='<div class="v15m-page mds"><div class="v15m-head"><div><div class="v15m-kicker">DaySilk · for models</div><h1>Your day</h1></div><div class="mds-tools">'+nav+'<div class="mds-tabs">'+tabs+'</div></div></div>'+body+'</div>';
  if(focusKey){var sel=focusKey.indexOf('bigt:')===0?'[data-mds-bigt="'+focusKey.slice(5)+'"]':'[data-mds-rv="'+focusKey.slice(3)+'"]',f=el.querySelector(sel);if(f){f.focus();try{f.setSelectionRange(f.value.length,f.value.length);}catch(e){}}}
}
document.addEventListener('click',function(e){
  var host=S.host;if(!host||!host.contains(e.target)||!S.ds)return;
  var b=e.target.closest&&e.target.closest('[data-mds-nav],[data-mds-tab],[data-mds-go],[data-mds-habit],[data-mds-block],[data-mds-big],[data-mds-mood],[data-mds-sync],[data-mds-redo]');
  if(!b&&!e.target.closest('[data-mds-redo]'))return;
  if(!b)return;
  if(b.hasAttribute('data-mds-nav')){var n=Number(b.getAttribute('data-mds-nav'));S.day=n===0?today():addD(S.day,n*(S.tab==='week'?7:1));paint();return;}
  if(b.hasAttribute('data-mds-tab')){S.tab=b.getAttribute('data-mds-tab');paint();return;}
  if(b.hasAttribute('data-mds-go')){var p=b.getAttribute('data-mds-go').split('-').map(Number);S.day=new Date(p[0],p[1]-1,p[2]);S.tab='today';paint();return;}
  if(b.hasAttribute('data-mds-habit')){var id=b.getAttribute('data-mds-habit'),dd=dayData(S.day),i=dd.done.indexOf(id);var done=dd.done.slice();if(i>-1)done.splice(i,1);else done.push(id);setDay(S.day,{done:done});paint();return;}
  if(b.hasAttribute('data-mds-block')){var bid='b:'+b.getAttribute('data-mds-block'),d2=dayData(S.day),dn=d2.done.slice(),j=dn.indexOf(bid);if(j>-1)dn.splice(j,1);else dn.push(bid);setDay(S.day,{done:dn});paint();return;}
  if(b.hasAttribute('data-mds-big')){var ix=Number(b.getAttribute('data-mds-big')),bg=dayData(S.day).big3.slice();while(bg.length<3)bg.push({t:'',done:false});bg[ix]={t:bg[ix].t,done:!bg[ix].done};setDay(S.day,{big3:bg});paint();return;}
  if(b.hasAttribute('data-mds-mood')){var rv=Object.assign({},dayData(S.day).review||{});rv.mood=Number(b.getAttribute('data-mds-mood'));setDay(S.day,{review:rv});paint();return;}
  if(b.hasAttribute('data-mds-sync')){var share=b.getAttribute('data-mds-sync')==='1';b.disabled=true;syncBookouts(share,false).catch(function(){}).then(function(){paint();});return;}
  if(b.hasAttribute('data-mds-redo')){ask(true);return;}
},true);
document.addEventListener('click',function(e){var b=e.target.closest&&e.target.closest('[data-mds-redo]');if(!b||!S.host||!S.host.contains(b)||S.ds)return;ask(true);});
document.addEventListener('input',function(e){
  var t=e.target;if(!S.host||!S.host.contains(t)||!S.ds)return;
  if(t.hasAttribute('data-mds-bigt')){var i=Number(t.getAttribute('data-mds-bigt')),bg=dayData(S.day).big3.slice();while(bg.length<3)bg.push({t:'',done:false});bg[i]={t:t.value,done:bg[i].done};setDay(S.day,{big3:bg});}
  else if(t.hasAttribute('data-mds-rv')){var rv=Object.assign({},dayData(S.day).review||{});rv[t.getAttribute('data-mds-rv')]=t.value;setDay(S.day,{review:rv});}
});

function render(el){
  S.host=el;S.day=S.day||today();paint();
  var go=function(){load(false);};
  if(window.DS)go();else{var n=0,t=setInterval(function(){if(window.DS||++n>40){clearInterval(t);go();}},100);}
}
/* first sign-in: ask the questions once, without waiting for the person to find the page */
function firstRun(){
  var tries=0,t=setInterval(function(){
    if(++tries>80){clearInterval(t);return;}
    if(!window.VEUX_MODEL||!VEUX_MODEL.getBoot||!window.DS)return;
    var b=VEUX_MODEL.getBoot();if(!b||!(b.model||b.profile||b.current_user))return;
    clearInterval(t);
    if(S.loaded||S.loading)return;
    S.day=today();load(false);
  },400);
}
window.MDV_MODEL_DAYSILK={render:render,state:S,buildPlan:buildPlan,firstRun:firstRun,questions:QS};
firstRun();
})();
