/* DaySilk for agents: set up on first sign-in with the DaySilk questionnaire, in the same format as Demontez's own DaySilk
   (rhythm, work, goals, body, fuel), made for an agent's day: board review, scouting, calls, protected focus, admin and team rhythm.
   The answers become a routine (shown on the DaySilk timeline as "My routine"), daily habits and Big 3 seeds.
   Saved on the agent's own member record through /api/agent/daysilk. */
(function(){
'use strict';
if(window.MDV_DS_AGENT)return;

var A={ds:null,loaded:false,loading:false,asked:false,listeners:[]};
function U(){return window.DS&&DS.util;}
function arr(v){return Array.isArray(v)?v:[];}
function bridge(){var b=window.VEUX_AGENT_V4;if(!b||!b.api)throw new Error('The secure connection is not ready yet');return b;}
function org(){try{return bridge().state.org.slug||'maison-de-veux';}catch(e){return 'maison-de-veux';}}
function toast(m){try{if(window.toast)return window.toast(m);}catch(e){}}
function get(path){return bridge().api(path,{method:'GET',headers:{},__fresh:true});}
function post(body){return bridge().api('/api/agent/daysilk',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(Object.assign({organization_slug:org()},body))});}
function changed(){A.listeners.forEach(function(f){try{f();}catch(e){}});}

var yes=function(k){return function(a){return a[k]==='Yes';};};
var QS=[
 {k:'you',s:'You',i:'The basics, so DaySilk fits your real life.',q:[
  ['first','What is your first name?','text','','',null,'required'],
  ['city','What city are you based in?','text'],
  ['season','How would you describe this season of your life?','choice',['Rebuilding','Growing','Steady','Overwhelmed','Starting fresh']],
  ['roles','What fills your days?','multi',['Booking and agenting','Scouting','Development','Travel coordination','Admin and operations','School','Family','Fitness','Side project','Faith or service']],
  ['workdays','Which days do you work?','days',null,null,null,'required'],
  ['workStart','When does your work day usually start?','time','09:00'],
  ['workEnd','And when does it usually end?','time','17:30']]},
 {k:'rhythm',s:'Rhythm',i:'Your day is built around when you wake, sleep and have energy.',q:[
  ['wake','What time do you want to wake up?','time','06:30'],
  ['sleep','What time do you want to be asleep?','time','22:30'],
  ['energy','When is your energy highest?','choice',['Early morning','Late morning','Afternoon','Evening']],
  ['morning','How do your mornings usually go?','choice',['Rushed','Slow','No routine','A solid routine']],
  ['phone','How much of your first hour goes to your phone?','choice',['Almost none','Some','Most of it']],
  ['sleepq','How has your sleep been lately?','scale',['Poor','','Okay','','Great']],
  ['windDown','What helps you wind down?','multi',['Reading','Shower or bath','Music','Prayer or meditation','Stretching','Journaling','TV']]]},
 {k:'agenda',s:'Your agenda',i:'This builds your board, scouting and call rhythm.',q:[
  ['markets','Which markets do you work most?','multi',['New York','Paris','Milan','London','Los Angeles','Other']],
  ['boardTime','When do you want to review the board each morning?','time','08:30','Options, confirmations and who is moving today'],
  ['scoutGoal','How many scouting targets a day?','choice',['None','5','10','20']],
  ['callDay','Which day is best for client and mother agency calls?','choice',['Monday','Tuesday','Wednesday','Thursday','Friday']],
  ['adminDay','Which day should hold admin, invoices and planning?','choice',['Monday','Tuesday','Wednesday','Thursday','Friday']],
  ['focusBlocks','How many protected focus blocks a day can you hold?','choice',['0','1','2','3']],
  ['teamMeet','How does your team meet?','choice',['Monday morning board meeting','Daily stand-up','Friday wrap-up','We do not yet']],
  ['eats','What eats your day the most?','multi',['Email','Client calls','Chasing mother agencies','Travel and visas','Casting follow-ups','Scheduling','Chasing payments','Scouting','Putting out fires']],
  ['cover','When you are out, who covers you?','text','','A name, or leave blank']]},
 {k:'life',s:'Life outside work',i:'Your agenda should respect the rest of your life.',q:[
  ['hasOther','Do you have a standing commitment outside work? (school, childcare, a second job, service)','yesno'],
  ['otherLabel','What is it?','text','','',yes('hasOther')],
  ['otherDays','Which days?','days',null,null,yes('hasOther')],
  ['otherStart','From','time','16:00',null,yes('hasOther')],
  ['otherEnd','Until','time','18:00',null,yes('hasOther')]]},
 {k:'body',s:'Body and fuel',i:'You make better calls when you feel good.',q:[
  ['trainDays','How many days a week do you want to move?','choice',['0','1','2','3','4','5']],
  ['trainKind','What kind of movement?','multi',['Walk','Run','Pilates or yoga','Weights','Cycling','Sports','Swim','Home workout']],
  ['trainTime','When do you prefer to train?','choice',['Morning','Lunch','After work']],
  ['water','Water goal per day','choice',['6 glasses','8 glasses','10 glasses']],
  ['caffeine','Do you want a caffeine cutoff?','choice',['No cutoff','2 PM','12 PM']],
  ['meals','How do you want to eat on workdays?','multi',['Three real meals','Meal prep','High protein','No skipping lunch','I need help']]]},
 {k:'goals',s:'Goals',i:'DaySilk turns these into weekly steps.',q:[
  ['vision','Picture yourself a year from now. What is different?','long'],
  ['goal1','Your number one goal for the next 90 days','text',''],
  ['goal2','A second goal (optional)','text',''],
  ['obstacle','What gets in your way most?','choice',['Interruptions','Too many tools','No clear priorities','Time','Travel and time zones','Energy']]]}
];

var DAYNAME={Monday:'1',Tuesday:'2',Wednesday:'3',Thursday:'4',Friday:'5'};
function overlap(a1,a2,b1,b2){return a1<b2&&b1<a2;}
function buildPlan(a){
  var T=U(),tm=T.tMin,mt=T.m2t;
  var wd=arr(a.workdays).length?a.workdays:['1','2','3','4','5'],all=['0','1','2','3','4','5','6'];
  var wake=a.wake||'06:30',sleep=a.sleep||'22:30',ws=a.workStart||'09:00',we=a.workEnd||'17:30',w=tm(wake),blocks=[];
  var fixed=[];
  if(a.hasOther==='Yes'&&arr(a.otherDays).length)fixed.push({days:a.otherDays,s:tm(a.otherStart||'16:00'),e:tm(a.otherEnd||'18:00')});
  function busy(d,s,e){return fixed.some(function(f){return f.days.indexOf(d)>-1&&overlap(s,e,f.s,f.e);});}
  blocks.push({id:'wake',days:all,start:wake,end:mt(w+20),title:'Wake up · water first',cat:'routine'});
  blocks.push({id:'breakfast',days:all,start:mt(w+40),end:mt(w+70),title:'Breakfast',cat:'meal'});
  /* the working day */
  var board=a.boardTime||'08:30';
  blocks.push({id:'board',days:wd,start:board,end:mt(tm(board)+30),title:'Board review · options, confirmations, who is moving',cat:'work'});
  var sg=Number(a.scoutGoal)||0;
  if(sg)blocks.push({id:'scout',days:wd,start:mt(tm(board)+45),end:mt(tm(board)+105),title:'Scouting · '+sg+' targets',cat:'work'});
  var fb=Number(a.focusBlocks)||0,fstart=a.energy==='Afternoon'?13*60:a.energy==='Early morning'?tm(ws):11*60;
  for(var i=0;i<fb;i++)blocks.push({id:'focus'+i,days:wd,start:mt(fstart+i*105),end:mt(fstart+i*105+90),title:'Protected focus',cat:'focus'});
  var callDay=DAYNAME[a.callDay];if(callDay&&wd.indexOf(callDay)>-1)blocks.push({id:'calls',days:[callDay],start:'14:00',end:'16:00',title:'Client and mother agency calls',cat:'work'});
  var adminDay=DAYNAME[a.adminDay];if(adminDay&&wd.indexOf(adminDay)>-1)blocks.push({id:'admin',days:[adminDay],start:mt(tm(we)-90),end:we,title:'Admin, invoices and planning',cat:'work'});
  if(/Monday/.test(a.teamMeet||'')&&wd.indexOf('1')>-1)blocks.push({id:'meet',days:['1'],start:ws,end:mt(tm(ws)+45),title:'Team board meeting',cat:'work'});
  else if(/stand-up/.test(a.teamMeet||''))blocks.push({id:'meet',days:wd,start:ws,end:mt(tm(ws)+15),title:'Team stand-up',cat:'work'});
  else if(/Friday/.test(a.teamMeet||'')&&wd.indexOf('5')>-1)blocks.push({id:'meet',days:['5'],start:mt(tm(we)-60),end:we,title:'Team wrap-up',cat:'work'});
  blocks.push({id:'lunch',days:all,start:'12:30',end:'13:15',title:'Lunch · away from the desk',cat:'meal'});
  blocks.push({id:'shutdown',days:wd,start:mt(tm(we)-15),end:we,title:'Evening shutdown · clear the board, set tomorrow’s Big 3',cat:'routine'});
  /* the rest of life */
  if(a.hasOther==='Yes'&&arr(a.otherDays).length)blocks.push({id:'life',days:a.otherDays,start:a.otherStart||'16:00',end:a.otherEnd||'18:00',title:a.otherLabel||'Personal commitment',cat:'life'});
  /* movement, placed clear of work and commitments */
  var n=Number(a.trainDays)||0,order=['1','3','5','2','4','6','0'],kind=arr(a.trainKind)[0]||'Workout';
  order.slice(0,n).forEach(function(d){
    var pref=a.trainTime||'Morning',start=pref==='Morning'?w+80:pref==='Lunch'?13*60+15:tm(we)+30,mins=45,g=0;
    var working=wd.indexOf(d)>-1;
    function clash(s){return busy(d,s,s+mins)||(working&&pref==='Morning'&&s+mins>tm(ws)-15&&s<tm(ws))||(working&&pref==='Lunch'&&overlap(s,s+mins,12*60+30,13*60+15));}
    while(clash(start)&&g++<12)start+=30;
    if(start+mins>tm(sleep)-60){start=w+80;g=0;while(clash(start)&&g++<10)start+=15;}
    blocks.push({id:'train_'+d,days:[d],start:mt(start),end:mt(start+mins),title:kind+' · movement',cat:'train'});
  });
  blocks.push({id:'wind',days:all,start:mt(tm(sleep)-45),end:mt(tm(sleep)-15),title:'Wind down',cat:'routine'});
  blocks.push({id:'sleep',days:all,start:sleep,end:mt(tm(sleep)+10),title:'Lights out',cat:'rest'});

  var habits=[{id:'water',label:'Water: '+(a.water||'8 glasses')},{id:'sleep',label:'In bed by '+T.fmtT(sleep)},{id:'board',label:'Board reviewed before the first call'},{id:'followups',label:'Every casting and option follow-up answered'},{id:'inbox',label:'Inbox cleared by end of day'}];
  if(n)habits.push({id:'move',label:'Move your body'});
  if(a.caffeine&&a.caffeine!=='No cutoff')habits.push({id:'caffeine',label:'No caffeine after '+a.caffeine});
  if(arr(a.meals).indexOf('No skipping lunch')>-1||arr(a.meals).indexOf('Three real meals')>-1)habits.push({id:'meals',label:'Real lunch, not at the desk'});
  habits.push({id:'shutdown',label:'Evening shutdown done'});
  var big=['Review the board and confirm today’s options'];
  if(sg)big.push('Scouting: '+sg+' targets');
  big.push('Answer every casting and option follow-up');
  var goals=[a.goal1,a.goal2].filter(function(g){return g&&String(g).trim();});
  var weekly=[{t:'Sunday: plan the week and pick Monday’s Big 3'}];
  if(a.callDay)weekly.push({t:a.callDay+' holds client and mother agency calls'});
  if(a.adminDay)weekly.push({t:a.adminDay+' holds admin, invoices and planning'});
  if(a.cover)weekly.push({t:'When you are out, '+a.cover+' covers you'});
  return {built:U().iso(new Date()),blocks:blocks,habits:habits.slice(0,9),big3:big.slice(0,3),goals:goals,weekly:weekly,markets:arr(a.markets),cover:a.cover||''};
}

/* ---------- data and onboarding ---------- */
function load(force){
  if(A.loading||(A.loaded&&!force))return Promise.resolve();
  A.loading=true;
  return get('/api/agent/daysilk?me=1&organization='+encodeURIComponent(org())+'&_t='+Date.now()).then(function(r){A.ds=(r&&r.me&&r.me.daysilk&&r.me.daysilk.answers)?r.me.daysilk:null;A.loaded=true;A.hasMember=!!(r&&r.me);}).catch(function(){A.loaded=true;}).then(function(){A.loading=false;changed();});
}
function ask(force){
  if(!window.DS||(A.asked&&!force))return Promise.resolve(null);A.asked=true;
  var a=Object.assign({workdays:['1','2','3','4','5']},(A.ds&&A.ds.answers)||{});
  return DS.wizard({title:'Set up your DaySilk',brand:'DaySilk · for agents',sections:QS,answers:a,intro:'About 5 minutes. You can change any answer later.',saveLabel:'Build my DaySilk',skipLabel:force?'Cancel':'Do this later',
    onSave:function(ans){var plan=buildPlan(ans);return post({action:'save_profile',answers:ans,plan:plan}).then(function(r){A.ds=r.daysilk;});}
  }).then(function(ans){if(ans){toast('Your DaySilk is ready');}changed();return ans;});
}
function setDay(date,patch){
  if(!A.ds)return;var k=U().iso(new Date(date));A.ds.days=A.ds.days||{};var cur=A.ds.days[k]||{done:[]};var next=Object.assign({},cur,patch);A.ds.days[k]=next;
  clearTimeout(setDay['t'+k]);setDay['t'+k]=setTimeout(function(){post({action:'save_day',date:k,day:next}).catch(function(){toast('Could not save. Check your connection.');});},700);
}
function dayDone(date){var d=A.ds&&A.ds.days&&A.ds.days[U().iso(new Date(date))];return arr(d&&d.done);}
function blocksOn(date){
  var plan=A.ds&&A.ds.plan;if(!plan)return [];var d=new Date(date),dow=String(d.getDay());
  return arr(plan.blocks).filter(function(b){return arr(b.days).indexOf(dow)>-1;}).sort(function(a,b){return U().tMin(a.start)-U().tMin(b.start);});
}
function whenReady(fn){var n=0,t=setInterval(function(){if((window.DS&&window.VEUX_AGENT_V4&&VEUX_AGENT_V4.api&&VEUX_AGENT_V4.state&&(VEUX_AGENT_V4.state.org||VEUX_AGENT_V4.state.user))||++n>120){clearInterval(t);if(n<=120)fn();}},500);}

window.MDV_DS_AGENT={load:load,ask:ask,state:A,plan:function(){return A.ds&&A.ds.plan||null;},answers:function(){return A.ds&&A.ds.answers||null;},blocksOn:blocksOn,dayDone:dayDone,setDay:setDay,onChange:function(f){A.listeners.push(f);},questions:QS,buildPlan:buildPlan};

/* first sign-in: ask the questions once */
whenReady(function(){
  load(false).then(function(){if(A.hasMember!==false&&!A.ds)setTimeout(function(){ask(false);},1200);});
});
})();
