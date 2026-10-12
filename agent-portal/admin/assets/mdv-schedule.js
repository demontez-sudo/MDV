/* Daily Schedule — day templates, market week and the daily rules, checked against the live calendar. */
(function(){
'use strict';
if(window.__MDV_SCHED__)return;window.__MDV_SCHED__=1;

/* ---------- small helpers ---------- */
var STORE='mdv-schedule-v1';
function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
function arr(v){return Array.isArray(v)?v:[];}
function mins(h){var p=String(h).split(':');return (+p[0])*60+(+p[1]||0);}
function clock(m){var h=Math.floor(m/60)%24,mm=m%60,ap=h>=12?'PM':'AM',h12=h%12||12;return h12+':'+String(mm).padStart(2,'0')+' '+ap;}
function dkey(d){d=new Date(d);return isNaN(d)?'':d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
function addDays(d,n){var x=new Date(d);x.setDate(x.getDate()+n);return x;}
function monday(d){var x=new Date(d);x.setHours(12,0,0,0);x.setDate(x.getDate()-((x.getDay()+6)%7));return x;}
function fmt(d,o){return new Date(d).toLocaleDateString([],o||{month:'short',day:'numeric'});}
function hrs(m){var h=Math.round(m/6)/10;return (h%1===0?h.toFixed(0):h.toFixed(1))+'h';}
function bridge(){var b=window.VEUX_AGENT_V4;if(!b||!b.api)throw new Error('Secure session is not ready');return b;}
function org(){try{return bridge().state.org.slug||'maison-de-veux';}catch(e){return 'maison-de-veux';}}
function toast(m,t){var o=document.querySelector('.sc-toast');if(o)o.remove();var d=document.createElement('div');d.className='sc-toast '+(t||'');d.textContent=m;document.body.appendChild(d);setTimeout(function(){d.remove();},3200);}

/* ---------- default templates ---------- */
var CATS={personal:'Personal',mdv:'MDV',casa:'Casa',cavyre:'Cavyre',body:'Body',recovery:'Recovery'};
var BIZ={mdv:1,casa:1,cavyre:1};
function B(s,e,t,d,c,f){return{s:mins(s),e:e?mins(e):null,t:t,d:d||'',c:c,f:f||[]};}
var reset=function(s){return B(s||'06:30',null,'Morning Reset','Wake · Water · Stretch · Mindset','personal');};
var shower=function(s){return B(s||'08:00',null,'Shower and Grooming','Breakfast · Check in','personal');};
var command=function(s){return B(s||'08:45',null,'Daily Command','Review calendar, priorities, model movements','personal');};
var lunch=function(s,e){return B(s||'12:00',e||'13:00','Lunch','Break · Nutrition','personal',['lunch','away']);};
var comms=function(s){return B(s||'17:30',null,'Communications','Clear inbox · plan tomorrow','personal',['email']);};
var dinner=function(out,note,s){return out?B(s||'18:30',null,'Dinner Out',note||'Out with people, not work','personal',['dinner','out']):B(s||'18:30',null,'Dinner',note||'Nutrition · Wind down','personal',['dinner','cook']);};
var downtime=function(s){return B(s||'20:00',null,'Personal Time','Unplug · Relax','personal');};
var review=function(s){return B(s||'21:30',null,'Daily Review','Wins · Plan tomorrow','personal');};
var wind=function(){return B('22:30',null,'Wind Down','Sleep target: 11:00 PM','recovery');};
var lift=function(t,s){return B(s||'07:00',null,'Workout: '+t,'Gym','body',['workout']);};

function defaults(){return{
  mon:{name:'Heavy scouting',label:'Mon template',blocks:[reset(),lift('Upper push'),shower(),command(),
    B('09:00','11:30','MDV · Heavy Model Scouting','20+ model prospects · Instagram, TikTok and street leads','mdv',['deep','business']),
    B('11:30','12:00','MDV · Agency Follow-ups','Emails, responses, next steps','mdv',['email','business']),lunch(),
    B('13:00','14:00','MDV · NY Board Call and Model Development','Emma · board review, model development','mdv',['meeting','business']),
    B('14:00','15:00','Casa · Relationship Building','Designers · Casting Directors · Creators','casa',['business']),
    B('15:00','16:00','Casa de Veux · Creative Development','Creative development, ideas and concepts','casa',['business']),
    B('16:00','17:30','Cavyre · Founder Growth','Agency acquisition · product, demos','cavyre',['business']),
    comms(),dinner(false),downtime(),review(),wind()]},
  tue:{name:'Model check-ins and bookings',label:'Tue template',blocks:[reset(),lift('Lower body'),shower(),command(),
    B('09:00','11:30','MDV · Model Check-ins','Every model: status, bookings, travel','mdv',['deep','business']),
    B('11:30','12:00','MDV · Client and Casting Follow-ups','Clients and casting directors · next steps','mdv',['email','business']),lunch(),
    B('13:00','14:00','MDV · Paris Board Review with Erica','Model development and training','mdv',['meeting','business']),
    B('14:00','15:00','Casa · Relationship Building','Designers · Casting Directors · Creators','casa',['business']),
    B('15:00','16:00','Casa de Veux · Creative Development','Past clients · proposals','casa',['business']),
    B('16:00','17:30','Cavyre · Founder Growth','Agency acquisition · product, demos','cavyre',['business']),
    comms(),dinner(true,'Industry dinner'),downtime('20:30'),review(),wind()]},
  wed:{name:'Studio tours',label:'Wed template',blocks:[reset(),lift('Pull and core'),shower(),command(),
    B('09:00','12:00','MDV · Studio Tours','Visit studios, meet teams, see the work','mdv',['deep','business']),lunch('12:00','13:00'),
    B('13:00','16:00','Casa de Veux · Meetings and Shoots','CDV meetings and shoots','casa',['meeting','business']),
    B('16:00','17:00','Cavyre · Founder Growth','Agency acquisition · product, demos','cavyre',['business']),
    B('17:30',null,'Gym','Free evening · train','body',['workout']),dinner(false,'Cook · Nutrition','19:00'),downtime('20:30'),review(),wind()]},
  thu:{name:'Street scouting and go-sees',label:'Thu template',blocks:[reset(),lift('Legs'),shower(),command(),
    B('09:00','12:00','MDV · Street Scouting','Stylists, photographers, editors','mdv',['deep','business']),lunch('12:00','13:00'),
    B('13:00','16:00','MDV · Go-sees','Designers, showrooms, casting directors','mdv',['meeting','business']),
    B('16:00','17:30','Cavyre · Demos','Written follow-ups go out Friday','cavyre',['meeting','business']),
    comms('17:30'),dinner(false,'Light · before the event','18:00'),
    B('19:30','21:00','Casa · Event or Show','Be seen · meet the room','casa',['business']),review('21:30'),wind()]},
  fri:{name:'Movement and planning',label:'Fri template',blocks:[reset(),lift('Full-body circuit'),shower(),command(),
    B('09:00','11:30','MDV · Movement and Planning','Next 90 days of arrivals, visas, agent schedules','mdv',['deep','business']),
    B('11:30','12:00','MDV · Partner Updates','Weekly note to every mother agency','mdv',['email','business']),lunch(),
    B('13:00','14:00','MDV · Team Leads Check-in','Emma, Erica, Troy, Sophia','mdv',['meeting','business']),
    B('14:00','15:00','Casa · Relationship Building','Designers · Casting Directors · Creators','casa',['business']),
    B('15:00','16:00','Casa de Veux · Creative Development',"Past clients · proposals · the week's connections",'casa',['business']),
    B('16:00','17:30',"Cavyre · Follow-ups","Written follow-ups from Thursday's demos",'cavyre',['business']),
    comms(),dinner(true,'Miller Union or Atlas'),downtime(),review(),wind()]},
  sat:{name:'Run club and research',label:'Sat template',blocks:[reset('07:30'),
    B('08:30',null,'Run club or class','Saturday session','body',['workout']),shower('10:00'),
    B('11:00','13:00','Casa · Galleries and Research','Exhibitions, studios, references','casa',['business']),lunch('13:00','14:00'),
    B('14:00',null,'Free Afternoon','No plan · walk, read, see friends','personal'),
    dinner(true,'Out with friends','19:00'),downtime('21:00'),wind()]},
  sun:{name:'Road refresh',label:'Sun template',blocks:[reset('08:00'),
    B('09:00',null,'Active Recovery','Walk · mobility · sauna','body',['workout','recovery']),shower('10:30'),lunch('12:30','13:30'),
    B('14:00','15:00','Weekly Review','Look ahead: calendar, travel, rules','personal'),
    B('15:00','17:00','Meal Prep','Cook the rest of the week','personal'),
    B('17:30',null,'Road Refresh','Reset the apartment, bag and desk','personal'),
    dinner(false,'Cook','19:00'),downtime('20:30'),B('21:30',null,'Set the Week','Wins · plan Monday','personal'),wind()]},
  market:{name:'Market day',label:'Special day',blocks:[reset('06:30'),lift('Short session','07:00'),shower(),command(),
    B('09:00','13:00','MDV · Market Appointments','Showrooms, designers, casting directors','mdv',['meeting','business']),lunch('13:00','14:00'),
    B('14:00','17:30','Casa · Showrooms and Shows','Move between appointments · stay visible','casa',['meeting','business']),
    B('17:30','18:30','Cavyre · Agency Catch-ups','Quick calls with agencies','cavyre',['business']),comms('18:30'),
    B('19:30',null,'Industry Dinner','Designer or stylist','casa',['dinner','out','business']),review('22:00'),wind()]},
  cali:{name:'Cali treatment',label:'Special day',blocks:[reset('07:00'),
    B('08:00',null,'Hike or Beach Run','Outside before anything else','body',['workout']),
    B('09:30',null,'Breakfast','Slow · no phone','personal'),
    B('10:30','12:30','Treatment','Massage · sauna · cold plunge','recovery'),lunch('12:30','13:30'),
    B('13:30','15:00','MDV · Focus Block','One deep block · no calls','mdv',['deep','business']),
    B('15:00',null,'Free','Open','personal'),B('17:00',null,'Sunset Walk','Reset','body',['workout']),
    dinner(false,'Light','18:30'),downtime(),review(),wind()]},
  travel:{name:'Travel day',label:'Special day',blocks:[B('05:30',null,'Wake and Pack','Passport · chargers · documents','personal'),
    B('07:00',null,'Airport','Arrive early · lounge','personal'),
    B('09:00','11:00','MDV · In-flight Deep Work','Plan, write, no email','mdv',['deep','business']),
    B('11:30',null,'Land','Customs · transfer','personal'),lunch('12:30','13:30'),B('14:00',null,'Check In','Unpack · reset','personal'),
    B('15:00','16:30','MDV · Arrival Check-ins','Models and agents on the ground','mdv',['business']),
    B('17:00',null,'Daylight Walk','Beat the jet lag','body',['workout']),dinner(false,'Light and early','18:30'),
    B('20:00',null,'Early Night Routine','Screens off','personal'),wind()]}
};}

var MARKET=[
  ['Mon',['Fly in, settle','Board review with Emma','Early dinner'],['Land, daylight walk','Light office time with Erica','Early night']],
  ['Tue',['Model check-ins, bookings','Clients and casting directors','Industry dinner'],['Board review with Erica','Model development and training','Dinner with a designer or stylist']],
  ['Wed',['Studio tours','CDV meetings and shoots','Free, gym'],['Mother and partner agencies','Castings, clients','Free, gym']],
  ['Thu',['Street scouting, go-sees','Stylists, photographers, editors','Event or show'],['Street scouting, go-sees','Designers, showrooms, casting directors','Event or show']],
  ['Fri',['Team meeting','CAVYRE meetings with NY agencies','Fly out or rest'],['Team meeting and month wrap','CDV and CAVYRE with Paris agencies','Dinner']],
  ['Sat',['Run club or gym','Galleries, research','Free'],['Run along the Seine','Exhibitions, ateliers','Free']],
  ['Sun',['Road refresh','Travel','Sleep'],['Road refresh','Fly home','Sleep at Atlanta time']]
];
var DAYIDS=['mon','tue','wed','thu','fri','sat','sun'];
var DAYNAMES={mon:'Mon',tue:'Tue',wed:'Wed',thu:'Thu',fri:'Fri',sat:'Saturday',sun:'Sunday',market:'Market day',cali:'Cali treatment',travel:'Travel day'};
var RULES=[
  ['deep','The first three hours are deep work. Email waits.'],
  ['breaks','Two screen-free breaks, mid-morning and mid-afternoon.'],
  ['lunch','Lunch is never at the desk.'],
  ['train','Train every day: lift five days, a class on Saturday, active recovery on Sunday.'],
  ['dinner','Dinner out Tuesday, Friday and Saturday. Cook the rest.'],
  ['late','No business decisions after 9:30 PM.'],
  ['evening','One full evening a week with no work at all.']
];

/* ---------- state ---------- */
var S={host:null,tab:'day',sel:null,selDate:null,market:'auto',month:null,monthSel:null,data:null,loaded:null,loading:false,err:'',
  tpl:null,over:{},timer:null};
function load(){
  var d=defaults(),saved={};try{saved=JSON.parse(localStorage.getItem(STORE)||'{}')||{};}catch(e){}
  S.tpl=d;Object.keys(saved.templates||{}).forEach(function(k){if(d[k]&&Array.isArray(saved.templates[k].blocks))d[k]=Object.assign({},d[k],saved.templates[k]);});
  S.over=saved.overrides||{};if(saved.market)S.market=saved.market;
}
function save(){try{var t={};Object.keys(S.tpl).forEach(function(k){if(S.tpl[k].edited)t[k]=S.tpl[k];});localStorage.setItem(STORE,JSON.stringify({templates:t,overrides:S.over,market:S.market}));}catch(e){}}
function weekdayId(d){return DAYIDS[(new Date(d).getDay()+6)%7];}
function tplIdFor(date){var k=dkey(date);return S.over[k]&&S.tpl[S.over[k]]?S.over[k]:weekdayId(date);}
function thisMonday(){return monday(new Date());}
function dateOfWeekday(id){var i=DAYIDS.indexOf(id);return i<0?null:addDays(thisMonday(),i);}

/* ---------- block maths ---------- */
function sorted(blocks){return blocks.slice().sort(function(a,b){return a.s-b.s;});}
function endOf(blocks,i){var b=blocks[i];if(b.e)return b.e;var n=blocks[i+1];return n?Math.max(b.s+15,n.s):Math.min(1440,b.s+60);}
function blockSpans(blocks){var s=sorted(blocks);return s.map(function(b,i){return Object.assign({},b,{end:endOf(s,i)});});}
function isBiz(b){return !!BIZ[b.c]||(b.f||[]).indexOf('business')>=0;}
function hoursByCat(spans){var o={};spans.forEach(function(b){o[b.c]=(o[b.c]||0)+(b.end-b.s);});return o;}

/* ---------- live calendar ---------- */
function names(x){var out=[];arr(x.booking_models||x.casting_models||x.model_assignments||x.models).forEach(function(m){var q=m.models||m;var n=q.display_name||q.name||[q.first_name,q.last_name].filter(Boolean).join(' ');if(n)out.push(n);});return out;}
function evType(x){var r=x.raw||{},v=(r.metadata&&r.metadata.calendar_event_type)||r.event_type||r.job_type||(x.kind==='casting'?'Casting':x.kind==='booking'?'Booking':'Meeting');return String(v||'Event').replace(/_/g,' ');}
function evKind(x){var s=(evType(x)+' '+(x.title||'')).toLowerCase();return /travel|flight|arriv|depart/.test(s)?'travel':x.kind==='casting'||/casting|go.?see|callback/.test(s)?'casting':x.kind==='booking'?'booking':'other';}
function evCity(x){var t=[x.market,x.location,x.title,x.raw&&x.raw.market_name].join(' ');if(/paris|france|\bcdg\b|\bfr\b/i.test(t))return 'Paris';if(/new york|\bnyc\b|\bny\b|brooklyn|manhattan|\bjfk\b|queens/i.test(t))return 'New York';return '';}
function evAwaiting(x){return /pending|hold|tentative|await|invited/i.test(String(x.status||''));}
function normalize(d){var out=[];function push(kind,x){if(!x.starts_at)return;var o={kind:kind,id:x.id,title:x.title||x.job_title||(kind==='booking'?'Booking':kind==='casting'?'Casting':'Event'),starts_at:x.starts_at,ends_at:x.ends_at,status:x.status||'',location:x.location||'',market:x.markets&&x.markets.name||x.market_name||x.market||'',client:x.companies&&x.companies.name||x.client_name||'',raw:x};o.models=names(x);o.k=evKind(o);o.city=evCity(o);o.visa=!!(x.metadata&&x.metadata.visa_blocking);out.push(o);}
  arr(d.bookings).forEach(function(x){push('booking',x);});arr(d.castings).forEach(function(x){push('casting',x);});arr(d.events).forEach(function(x){push('event',x);});
  return out.sort(function(a,b){return new Date(a.starts_at)-new Date(b.starts_at);});}
function needRange(){var a=S.month?new Date(S.month.getFullYear(),S.month.getMonth(),1):new Date();var s=addDays(monday(a<new Date()?a:new Date()),-7),e=addDays(new Date(),S.tab==='plan'?105:60);var me=new Date((S.month||new Date()).getFullYear(),(S.month||new Date()).getMonth()+1,8);if(me>e)e=me;return{s:s,e:e};}
async function loadLive(force){
  var r=needRange();
  if(!force&&S.loaded&&S.loaded.s<=r.s&&S.loaded.e>=r.e)return;
  S.loading=true;
  try{
    var q='?organization='+encodeURIComponent(org())+'&start='+encodeURIComponent(r.s.toISOString())+'&end='+encodeURIComponent(r.e.toISOString())+'&_t='+Date.now();
    var d=await bridge().api('/api/agent/calendar/v9'+q,{method:'GET',headers:{},__fresh:true});
    S.data=normalize(d||{});S.loaded=r;S.err='';
  }catch(e){S.err=(e&&e.message)||'Live calendar could not load';}
  S.loading=false;
}
function liveOn(date){var k=dkey(date);return (S.data||[]).filter(function(x){return dkey(x.starts_at)===k;});}
function evSpan(x){var s=new Date(x.starts_at),e=x.ends_at?new Date(x.ends_at):new Date(s.getTime()+3600000);var sm=s.getHours()*60+s.getMinutes(),em=dkey(e)===dkey(s)?e.getHours()*60+e.getMinutes():1440;if(em<=sm)em=sm+60;return[sm,em];}

/* ---------- rules (each returns {s:'ok'|'warn'|'na', t:text, fix?}) ---------- */
function ctxFor(id,date){var tpl=S.tpl[id],spans=tpl?blockSpans(tpl.blocks):[],live=date?liveOn(date).filter(function(x){return x.k!=='travel';}):[];return{id:id,date:date,spans:spans,live:live};}
function evalRule(key,c){
  var biz=c.spans.filter(isBiz),bizMin=biz.reduce(function(n,b){return n+(b.end-b.s);},0);
  if(key==='deep'){
    if(!biz.length)return{s:'na',t:'No work scheduled today.'};
    var first=biz[0],w0=first.s,w1=first.s+180,bad=[];
    c.spans.forEach(function(b){if(b!==first&&isBiz(b)&&(b.f||[]).indexOf('email')>=0&&b.s>=w0&&b.s<w1)bad.push(clock(b.s)+' '+b.t);if(b!==first&&!isBiz(b)&&(b.f||[]).indexOf('email')>=0&&b.s>=w0&&b.s<w1)bad.push(clock(b.s)+' '+b.t);});
    var ev=c.live.filter(function(x){var p=evSpan(x);return p[0]<w1&&p[1]>w0;});
    if(bad.length||ev.length){var t=[];if(bad.length)t.push('Email-type work inside the window: '+bad.join(', ')+'. Move it after lunch.');if(ev.length)t.push(ev.length+' live event'+(ev.length===1?'':'s')+' ('+ev.slice(0,2).map(function(x){return x.title;}).join(', ')+') cut into it.');return{s:'warn',t:'Window '+clock(w0)+' to '+clock(w1)+'. '+t.join(' ')};}
    return{s:'ok',t:'Protected '+clock(w0)+' to '+clock(w1)+'. Nothing interrupts it.'};
  }
  if(key==='breaks'){
    if(bizMin<240)return{s:'na',t:'Light work day, no breaks needed.'};
    var n=c.spans.filter(function(b){return (b.f||[]).indexOf('screenfree')>=0;}).length;
    return n>=2?{s:'ok',t:n+' screen-free breaks scheduled.'}:{s:'warn',t:(n?'Only one screen-free break':'No screen-free breaks')+' scheduled. Add one mid-morning and one mid-afternoon.',fix:'breaks'};
  }
  if(key==='lunch'){
    var l=c.spans.filter(function(b){return (b.f||[]).indexOf('lunch')>=0;})[0];
    if(!l)return bizMin?{s:'warn',t:'No lunch block on this day.'}:{s:'na',t:'No lunch block, no work day.'};
    var over=c.live.filter(function(x){var p=evSpan(x);return p[0]<l.end&&p[1]>l.s;});
    if(over.length)return{s:'warn',t:'Lunch '+clock(l.s)+' to '+clock(l.end)+' is overlapped by '+over[0].title+'.'};
    return (l.f||[]).indexOf('away')>=0?{s:'ok',t:'Lunch '+clock(l.s)+' to '+clock(l.end)+' is away from the desk.'}:{s:'warn',t:'Lunch is marked at the desk.'};
  }
  if(key==='late'){
    var lateB=c.spans.filter(function(b){return isBiz(b)&&b.end>21.5*60;}),lateE=c.live.filter(function(x){return evSpan(x)[1]>21.5*60;});
    if(lateB.length||lateE.length)return{s:'warn',t:'Work runs past 9:30 PM'+(lateE.length?' ('+lateE[0].title+')':lateB.length?' ('+lateB[0].t+')':'')+'. Move decisions to the morning.'};
    return{s:'ok',t:'Nothing business after 9:30 PM.'};
  }
  return{s:'na',t:''};
}
function evalWeek(key){
  var mon=thisMonday(),rows=[],i;
  if(key==='train'){
    var miss=[];for(i=0;i<7;i++){var d=addDays(mon,i),id=tplIdFor(d),sp=blockSpans(S.tpl[id].blocks),body=sp.filter(function(b){return b.c==='body'||(b.f||[]).indexOf('workout')>=0;}),ok=!!body.length;
      if(ok&&id==='sat')ok=body.some(function(b){return /run|class/i.test(b.t);});if(ok&&id==='sun')ok=body.some(function(b){return /recovery|walk|mobility/i.test(b.t+b.d);});
      rows.push({d:d,ok:ok});if(!ok)miss.push(fmt(d,{weekday:'short'}));}
    return{s:miss.length?'warn':'ok',t:miss.length?'Nothing planned for '+miss.join(', ')+'.':'Every day has its session.',rows:rows};
  }
  if(key==='dinner'){
    var bad=[];for(i=0;i<7;i++){var d2=addDays(mon,i),id2=tplIdFor(d2);if(['market','cali','travel'].indexOf(id2)>=0){rows.push({d:d2,ok:true,na:true});continue;}var dn=blockSpans(S.tpl[id2].blocks).filter(function(b){return (b.f||[]).indexOf('dinner')>=0;})[0],out=dn&&dn.f.indexOf('out')>=0,want=['tue','fri','sat'].indexOf(DAYIDS[i])>=0,ok2=!dn||out===want;rows.push({d:d2,ok:ok2,out:!!out});if(!ok2)bad.push(fmt(d2,{weekday:'short'})+(want?' should be out':' should be cooked'));}
    return{s:bad.length?'warn':'ok',t:bad.length?bad.join('; ')+'.':'Out Tuesday, Friday and Saturday; cooking the rest.',rows:rows};
  }
  if(key==='evening'){
    var free=[];for(i=0;i<7;i++){var d3=addDays(mon,i),id3=tplIdFor(d3),sp3=blockSpans(S.tpl[id3].blocks),b3=sp3.filter(function(b){return isBiz(b)&&b.end>18*60;}).length,l3=liveOn(d3).filter(function(x){return x.k!=='travel'&&evSpan(x)[1]>18*60;}).length,ok3=!b3&&!l3;rows.push({d:d3,ok:ok3});if(ok3)free.push(fmt(d3,{weekday:'short'}));}
    return{s:free.length?'ok':'warn',t:free.length?free.join(', ')+(free.length>1?' evenings are':' evening is')+' work-free.':'Every evening has work in it this week. Clear one.',rows:rows};
  }
  return{s:'na',t:''};
}
function splitBreak(blocks,target,title){
  var b=sorted(blocks),hit=null,i;
  for(i=0;i<b.length;i++){var e=endOf(b,i);if(b[i].s<target&&e>target+15){hit=i;break;}}
  var br=B('00:00',null,title,'Phone away · walk · water','personal',['screenfree']);br.s=target;br.e=target+15;
  if(hit==null)return blocks;
  var o=b[hit],oe=endOf(b,hit),a=Object.assign({},o,{e:target}),c=Object.assign({},o,{s:target+15,e:o.e?oe:null});
  var out=b.slice(0,hit).concat([a,br,c],b.slice(hit+1));return out;
}
function fixBreaks(id){
  var t=S.tpl[id],blocks=t.blocks.slice(),have=blockSpans(blocks).filter(function(b){return (b.f||[]).indexOf('screenfree')>=0;}).length;
  [[10*60+30,'Screen-free Break'],[15*60+30,'Screen-free Break']].slice(have).forEach(function(p){blocks=splitBreak(blocks,p[0],p[1]);});
  t.blocks=blocks;t.edited=true;save();
}

/* ---------- market week intelligence ---------- */
function weekLive(){var mon=thisMonday(),out=[];for(var i=0;i<7;i++){var d=addDays(mon,i),l=liveOn(d),ny=l.filter(function(x){return x.city==='New York';}).length,pa=l.filter(function(x){return x.city==='Paris';}).length;out.push({d:d,l:l,ny:ny,pa:pa,tr:l.filter(function(x){return x.k==='travel';}).length,other:l.filter(function(x){return x.k!=='travel'&&!x.city;}).length,nonTravel:l.filter(function(x){return x.k!=='travel';}).length});}return out;}
function activeCity(wl){if(S.market!=='auto')return S.market;var ny=0,pa=0;wl.forEach(function(w){ny+=w.ny;pa+=w.pa;});return pa>ny?'Paris':'New York';}

/* ---------- rendering ---------- */
function tabsHtml(){return '<nav class="sc-tabs" role="tablist">'+[['day','Day templates'],['month','Month'],['plan','90-day plan']].map(function(t){return '<button type="button" role="tab" class="'+(S.tab===t[0]?'on':'')+'" aria-selected="'+(S.tab===t[0])+'" data-sc-tab="'+t[0]+'">'+t[1]+'</button>';}).join('')+'<span class="sc-live">'+(S.loading?'Syncing calendar…':S.err?'<em>Live calendar unavailable</em>':'Live calendar connected')+'</span></nav>';}
function render(host){
  if(host)S.host=host;if(!S.host)return;
  var el=S.host;if(!S.tpl)load();
  if(!S.sel){var td=new Date(),id=tplIdFor(td);S.sel=id;S.selDate=dkey(td);}
  var body=S.tab==='month'?monthHtml():S.tab==='plan'?planHtml():dayHtml();
  var keep=el.querySelector('.sc-main')?window.scrollY:null;
  el.innerHTML='<div class="sc"><header class="sc-head"><div><small>CAVYRE · DAILY OPERATING SCHEDULE</small><h1>Daily Schedule</h1></div><p>Your day templates, market week and daily rules, checked against the live calendar.</p></header>'+tabsHtml()+'<div class="sc-main">'+body+'</div></div>';
  wire(el);
  if(keep!=null)window.scrollTo(0,keep);
}

/* -- Day templates -- */
function pillsHtml(){
  var todayId=tplIdFor(new Date());
  return '<div class="sc-pills" role="group" aria-label="Day templates">'+Object.keys(DAYNAMES).map(function(k){return '<button type="button" class="sc-pill'+(S.sel===k?' on':'')+(k===todayId?' today':'')+'" data-sc-pick="'+k+'">'+DAYNAMES[k]+'</button>';}).join('')+'</div>';
}
function liveRows(date,spans){
  return liveOn(date).map(function(x){var p=evSpan(x),over=spans.filter(function(b){return p[0]<b.end&&p[1]>b.s&&!isBiz(b)&&(b.c==='personal'||b.c==='recovery'||b.c==='body');})[0];return{s:p[0],e:p[1],x:x,over:over};});
}
function dayHtml(){
  var id=S.sel,t=S.tpl[id],date=S.selDate?new Date(S.selDate+'T12:00:00'):null;
  if(date&&tplIdFor(date)!==id&&!(DAYIDS.indexOf(id)>=0&&weekdayId(date)===id))date=null;
  var spans=blockSpans(t.blocks),by=hoursByCat(spans),live=date?liveRows(date,spans):[],now=new Date(),isToday=date&&dkey(date)===dkey(now),nm=now.getHours()*60+now.getMinutes();
  var chips=Object.keys(CATS).filter(function(k){return by[k];}).map(function(k){return '<span class="sc-chip c-'+k+'">'+CATS[k]+' · '+hrs(by[k])+'</span>';}).join('');
  var bizMin=spans.filter(isBiz).reduce(function(n,b){return n+(b.end-b.s);},0),protectedMin=spans.reduce(function(n,b){return n+((b.c==='personal'||b.c==='body'||b.c==='recovery')?b.end-b.s:0);},0);
  /* merge template + live, in time order */
  var items=spans.map(function(b){return{k:'t',s:b.s,b:b};}).concat(live.map(function(l){return{k:'l',s:l.s,l:l};})).sort(function(a,b){return a.s-b.s||(a.k==='l'?1:-1);});
  var cur=-1,nxt=-1;if(isToday){items.forEach(function(it,i){var e=it.k==='t'?it.b.end:it.l.e;if(it.s<=nm&&nm<e&&it.k==='t')cur=i;if(nxt<0&&it.s>nm)nxt=i;});}
  var rows='',i;
  for(i=0;i<items.length;i++){
    var it=items[i];
    if(it.k==='t'){var b=it.b,tag=CATS[b.c],open=!b.e;
      rows+='<button type="button" class="sc-row c-'+b.c+(i===cur?' now':'')+'" data-sc-edit="'+spans.indexOf(b)+'"><span class="sc-time">'+clock(b.s)+(b.e?'<small>'+clock(b.end).replace(' ',' ')+'</small>':'')+'</span><i class="sc-bar"></i><span class="sc-what"><b>'+esc(b.t)+'</b><em>'+esc(b.d)+'</em></span><span class="sc-tag c-'+b.c+'">'+(b.c==='recovery'?'Recovery':tag)+'</span></button>';
    }else{var l=it.l,x=l.x;
      rows+='<a class="sc-row sc-liverow k-'+x.k+'" data-sc-live="'+esc(x.kind)+'|'+esc(x.id)+'" role="button" tabindex="0"><span class="sc-time">'+clock(l.s)+'<small>'+clock(l.e).replace(' ',' ')+'</small></span><i class="sc-bar"></i><span class="sc-what"><b>'+esc(x.title)+'</b><em>'+esc([x.client,x.location,x.models.length?(x.models.length===1?x.models[0]:x.models.length+' models'):''].filter(Boolean).join(' · ')||evType(x))+(l.over?' · <u>overlaps '+esc(l.over.t)+'</u>':'')+(evAwaiting(x)?' · <u>awaiting reply</u>':'')+'</em></span><span class="sc-tag k-'+x.k+'">Live · '+esc(x.k==='other'?evType(x):x.k)+'</span></a>';
    }
    if(isToday&&i===cur&&false)rows+='';
  }
  var nowLine='';
  if(isToday&&cur>=0){var c=items[cur].b;nowLine='<div class="sc-nowbar"><b>Now</b> '+esc(c.t)+(nxt>=0?'. Next: <b>'+esc(items[nxt].k==='t'?items[nxt].b.t:items[nxt].l.x.title)+'</b> at '+clock(items[nxt].s)+' (in '+(items[nxt].s-nm>=60?Math.floor((items[nxt].s-nm)/60)+'h ':'')+((items[nxt].s-nm)%60)+'m)':'')+'</div>';}
  else if(isToday&&nxt>=0)nowLine='<div class="sc-nowbar"><b>Up next</b> '+esc(items[nxt].k==='t'?items[nxt].b.t:items[nxt].l.x.title)+' at '+clock(items[nxt].s)+'</div>';
  else if(isToday)nowLine='<div class="sc-nowbar"><b>Done for today.</b> Review and wind down.</div>';
  /* insights for the selected day */
  var c=ctxFor(id,date),flags=['deep','breaks','lunch','late'].map(function(k){return{k:k,r:evalRule(k,c)};}).filter(function(x){return x.r.s==='warn';});
  var insights=flags.length?'<div class="sc-insights"><span class="sc-vera">✦ Vera</span>'+flags.map(function(f){return '<button type="button" class="sc-ins" data-sc-rule="'+f.k+'">'+esc(RULES.filter(function(r){return r[0]===f.k;})[0][1].replace(/\.$/,''))+'<em>'+esc(f.r.t)+'</em></button>';}).join('')+'</div>':'<div class="sc-insights ok"><span class="sc-vera">✦ Vera</span><span>This day follows every daily rule.</span></div>';
  var sub=date?fmt(date,{weekday:'long',month:'long',day:'numeric'})+(isToday?' · today':''):'Not tied to a date';
  var overBtn=date&&['market','cali','travel'].indexOf(id)<0?'<button type="button" class="sc-ghost" data-sc-setover="'+dkey(date)+'">Use another template for this date</button>':'';
  var card='<section class="sc-card"><header><h2>'+esc(t.name)+'</h2><span class="sc-label">'+esc(t.label)+'</span><span class="sc-date">'+esc(sub)+'</span></header>'
    +'<div class="sc-chips">'+chips+'<span class="sc-chip sc-sum">'+hrs(bizMin)+' work · '+hrs(protectedMin)+' yours</span></div>'+nowLine+insights
    +'<div class="sc-rows">'+rows+'</div>'
    +'<footer><button type="button" class="sc-ghost" data-sc-add>+ Add block</button>'+overBtn+(t.edited?'<button type="button" class="sc-ghost" data-sc-reset="'+id+'">Reset to default</button>':'')+'<span>'+(live.length?live.length+' live event'+(live.length===1?'':'s')+' from the calendar are shown in line.':date?'No live events on this date.':'Pick a dated day to see live events.')+'</span></footer></section>';
  return pillsHtml()+'<div class="sc-grid">'+card+'<aside class="sc-aside">'+marketHtml()+rulesHtml(c)+'</aside></div>';
}
function marketHtml(){
  var wl=weekLive(),city=activeCity(wl),mon=thisMonday(),todayK=dkey(new Date());
  var ny=0,pa=0,tr=0,cross=[];wl.forEach(function(w){ny+=w.ny;pa+=w.pa;tr+=w.tr;if(w.ny&&w.pa)cross.push(fmt(w.d,{weekday:'short'}));});
  var summary='<div class="sc-mk-sum"><span><b>'+ny+'</b> New York</span><span><b>'+pa+'</b> Paris</span><span><b>'+tr+'</b> travel</span>'+(cross.length?'<span class="warn">Both cities: '+cross.join(', ')+'</span>':'')+'</div>';
  var toggle='<div class="sc-seg" role="group" aria-label="Market focus">'+['auto','New York','Paris'].map(function(m){return '<button type="button" class="'+(S.market===m?'on':'')+'" data-sc-market="'+m+'">'+(m==='auto'?'Auto':m)+'</button>';}).join('')+'</div>';
  var rows=MARKET.map(function(r,i){var w=wl[i],isT=dkey(w.d)===todayK,tid=DAYIDS[i],tag=[];
    if(w.ny&&w.pa)tag.push('<i class="warn">Both cities</i>');if(w.tr)tag.push('<i>'+w.tr+' travel</i>');
    if(i>=5&&w.nonTravel)tag.push('<i class="warn">'+w.nonTravel+' event'+(w.nonTravel===1?'':'s')+' on a protected day</i>');
    var cell=function(items,c){return '<div class="sc-mc'+(city===c?' on':'')+'">'+items.map(function(x){return '<span>'+esc(x)+'</span>';}).join('')+(w[c==='New York'?'ny':'pa']?'<small>'+w[c==='New York'?'ny':'pa']+' live in '+c+'</small>':'')+'</div>';};
    return '<button type="button" class="sc-mrow'+(isT?' today':'')+(S.sel===tid?' sel':'')+'" data-sc-pick="'+tid+'"><b>'+r[0]+'<small>'+fmt(w.d)+'</small></b>'+cell(r[1],'New York')+cell(r[2],'Paris')+(tag.length?'<div class="sc-mtags">'+tag.join('')+'</div>':'')+'</button>';}).join('');
  return '<section class="sc-panel"><header><h3>Market week</h3>'+toggle+'</header>'+summary+'<div class="sc-mhead"><span></span><span class="'+(city==='New York'?'on':'')+'">New York</span><span class="'+(city==='Paris'?'on':'')+'">Paris</span></div>'+rows+'<p class="sc-fine">Highlighted column is where the week is weighted'+(S.market==='auto'?' (from live events: more '+city+' events)':'')+'. Click a day to open its template.</p></section>';
}
function rulesHtml(c){
  var rows=RULES.map(function(r,i){
    var weekly=['train','dinner','evening'].indexOf(r[0])>=0,res=weekly?evalWeek(r[0]):evalRule(r[0],c);
    var dots='';if(res.rows)dots='<div class="sc-dots">'+res.rows.map(function(x){return '<i class="'+(x.na?'na':x.ok?'ok':'bad')+'" title="'+fmt(x.d,{weekday:'short',month:'short',day:'numeric'})+'">'+fmt(x.d,{weekday:'narrow'})+'</i>';}).join('')+'</div>';
    return '<li class="'+res.s+'" id="sc-rule-'+r[0]+'"><span class="sc-rn">'+String(i+1).padStart(2,'0')+'</span><div><b>'+esc(r[1])+'</b><em><i class="sc-st">'+({ok:'On track',warn:'Needs attention',na:'Not applicable'})[res.s]+'</i> '+esc(res.t)+'</em>'+dots+(res.fix?'<button type="button" class="sc-fix" data-sc-fix="'+res.fix+'">Add the breaks</button>':'')+'</div></li>';}).join('');
  var all=RULES.map(function(r){var weekly=['train','dinner','evening'].indexOf(r[0])>=0;return weekly?evalWeek(r[0]):evalRule(r[0],c);}),applicable=all.filter(function(r){return r.s!=='na';}),okN=applicable.filter(function(r){return r.s==='ok';}).length;
  return '<section class="sc-panel"><header><h3>Rules for every day</h3><span class="sc-score'+(okN===applicable.length?' ok':'')+'">'+okN+' of '+applicable.length+' on track</span></header><ol class="sc-rules">'+rows+'</ol><p class="sc-fine">Daily rules are checked against the selected day. Weekly rules look at this whole week, including live events.</p></section>';
}

/* -- Month -- */
function monthHtml(){
  var m=S.month||(S.month=new Date(new Date().getFullYear(),new Date().getMonth(),1)),first=monday(m),todayK=dkey(new Date()),sel=S.monthSel||todayK;
  var last=new Date(m.getFullYear(),m.getMonth()+1,0),weeks=Math.ceil(((last-first)/864e5+1)/7),cells='',w,i;
  var weekWarn=[];
  for(w=0;w<weeks;w++){
    var free=false;
    for(i=0;i<7;i++){var d=addDays(first,w*7+i),k=dkey(d),inM=d.getMonth()===m.getMonth(),id=tplIdFor(d),t=S.tpl[id],l=liveOn(d),nt=l.filter(function(x){return x.k!=='travel';}),tr=l.filter(function(x){return x.k==='travel';}),sp=blockSpans(t.blocks);
      var evening=!sp.some(function(b){return isBiz(b)&&b.end>18*60;})&&!nt.some(function(x){return evSpan(x)[1]>18*60;});if(evening)free=true;
      cells+='<button type="button" class="sc-cell'+(inM?'':' out')+(k===todayK?' today':'')+(k===sel?' sel':'')+(S.over[k]?' over':'')+'" data-sc-day="'+k+'"><b>'+d.getDate()+'</b><span class="sc-ct">'+esc(t.name)+'</span><span class="sc-cm">'+(nt.length?'<i class="live">'+nt.length+' live</i>':'')+(tr.length?'<i class="tr">✈ '+tr.length+'</i>':'')+(S.over[k]?'<i class="ov">'+esc(DAYNAMES[S.over[k]])+'</i>':'')+'</span></button>';}
    if(!free)weekWarn.push(fmt(addDays(first,w*7),{month:'short',day:'numeric'}));
  }
  var monthEvents=(S.data||[]).filter(function(x){var d=new Date(x.starts_at);return d.getMonth()===m.getMonth()&&d.getFullYear()===m.getFullYear();}),travelDays={};monthEvents.filter(function(x){return x.k==='travel';}).forEach(function(x){travelDays[dkey(x.starts_at)]=1;});
  var heavy={};monthEvents.forEach(function(x){var k=dkey(x.starts_at);heavy[k]=(heavy[k]||0)+1;});var heavyN=Object.keys(heavy).filter(function(k){return heavy[k]>=5;}).length;
  var intel='<div class="sc-insights'+(weekWarn.length?'':' ok')+'"><span class="sc-vera">✦ Vera</span>'+(weekWarn.length?'<span class="sc-ins static">Week of '+weekWarn.join(', ')+' has no work-free evening<em>Rule 07: clear one evening</em></span>':'<span>Every week this month keeps a work-free evening.</span>')+(heavyN?'<span class="sc-ins static">'+heavyN+' heavy day'+(heavyN===1?'':'s')+' (5+ events)<em>Check the days marked with many live events</em></span>':'')+'</div>';
  var stats='<div class="sc-stats"><div><b>'+monthEvents.length+'</b><span>Live events</span></div><div><b>'+Object.keys(travelDays).length+'</b><span>Travel days</span></div><div><b>'+Object.keys(S.over).filter(function(k){return k.slice(0,7)===m.getFullYear()+'-'+String(m.getMonth()+1).padStart(2,'0');}).length+'</b><span>Special days</span></div><div class="'+(weekWarn.length?'warn':'')+'"><b>'+weekWarn.length+'</b><span>Weeks with no free evening</span></div></div>';
  var head='<div class="sc-mbar"><button type="button" data-sc-mm="-1" aria-label="Previous month">‹</button><h2>'+esc(m.toLocaleDateString([],{month:'long',year:'numeric'}))+'</h2><button type="button" data-sc-mm="1" aria-label="Next month">›</button><button type="button" class="sc-ghost" data-sc-mm="0">This month</button></div>';
  var dow='<div class="sc-dow">'+['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(function(x){return '<span>'+x+'</span>';}).join('')+'</div>';
  var sd=new Date(sel+'T12:00:00'),sid=tplIdFor(sd),sl=liveOn(sd);
  var opts=['<option value="">Default ('+esc(S.tpl[weekdayId(sd)].name)+')</option>'].concat(['market','cali','travel'].map(function(k){return '<option value="'+k+'"'+(S.over[sel]===k?' selected':'')+'>'+DAYNAMES[k]+'</option>';})).join('');
  var detail='<section class="sc-card sc-mdetail"><header><h2>'+esc(fmt(sd,{weekday:'long',month:'long',day:'numeric'}))+'</h2><span class="sc-label">'+esc(S.tpl[sid].name)+'</span></header>'
    +'<div class="sc-mset"><label>Template for this date <select data-sc-over="'+sel+'">'+opts+'</select></label><button type="button" class="sc-fix" data-sc-open="'+sel+'">Open this day</button></div>'
    +(sl.length?'<div class="sc-rows">'+sl.map(function(x){var p=evSpan(x);return '<a class="sc-row sc-liverow k-'+x.k+'" data-sc-live="'+esc(x.kind)+'|'+esc(x.id)+'" role="button" tabindex="0"><span class="sc-time">'+clock(p[0])+'<small>'+clock(p[1]).replace(' ',' ')+'</small></span><i class="sc-bar"></i><span class="sc-what"><b>'+esc(x.title)+'</b><em>'+esc([x.client,x.location,x.city].filter(Boolean).join(' · ')||evType(x))+'</em></span><span class="sc-tag k-'+x.k+'">'+esc(x.k)+'</span></a>';}).join('')+'</div>':'<p class="sc-fine">No live events on this date.</p>')+'</section>';
  return intel+stats+'<div class="sc-grid sc-mgrid"><section class="sc-card sc-cal">'+head+dow+'<div class="sc-cells">'+cells+'</div></section>'+detail+'</div>';
}

/* -- 90-day plan -- */
function planHtml(){
  var start=thisMonday(),W=13,weeks=[],i,j;
  var evs=(S.data||[]).filter(function(x){var d=new Date(x.starts_at);return d>=start&&d<addDays(start,W*7);});
  for(i=0;i<W;i++){
    var ws=addDays(start,i*7),days=[],all=[],freeEve=false;
    for(j=0;j<7;j++){var d=addDays(ws,j),l=liveOn(d),id=tplIdFor(d),sp=blockSpans(S.tpl[id].blocks),nt=l.filter(function(x){return x.k!=='travel';});
      var ev=!sp.some(function(b){return isBiz(b)&&b.end>18*60;})&&!nt.some(function(x){return evSpan(x)[1]>18*60;});if(ev)freeEve=true;
      days.push({d:d,l:l,id:id});all=all.concat(l);}
    var hours=all.reduce(function(n,x){var p=evSpan(x);return n+(p[1]-p[0])/60;},0),cf=0;
    all.forEach(function(a,ia){if(all.some(function(b,ib){if(ia===ib)return false;var pa=evSpan(a),pb=evSpan(b);return dkey(a.starts_at)===dkey(b.starts_at)&&pa[0]<pb[1]&&pb[0]<pa[1]&&a.models.some(function(n){return b.models.indexOf(n)>=0;});}))cf++;});
    var load=all.length>=18||hours>=40?'Heavy':all.length>=7?'Balanced':'Light';
    weeks.push({ws:ws,days:days,all:all,hours:hours,cf:cf,load:load,freeEve:freeEve,visa:all.filter(function(x){return x.visa;}).length,travel:all.filter(function(x){return x.k==='travel';}).length,wait:all.filter(evAwaiting).length});
  }
  var heavy=weeks.slice().sort(function(a,b){return b.all.length-a.all.length;})[0],lightW=weeks.filter(function(w){return w.load==='Light'&&!w.cf&&!w.visa;})[0];
  var totalTravel=evs.filter(function(x){return x.k==='travel';}),visa=evs.filter(function(x){return x.visa;}),wait=evs.filter(function(x){return evAwaiting(x)&&new Date(x.starts_at)<addDays(new Date(),14);});
  var read='<div class="sc-insights'+(visa.length?'':' ok')+'"><span class="sc-vera">✦ Vera</span><span class="sc-ins static">'+(heavy&&heavy.all.length?'Heaviest week starts '+fmt(heavy.ws)+' with '+heavy.all.length+' events':'No heavy weeks ahead')+'<em>'+(heavy&&heavy.hours?Math.round(heavy.hours)+' scheduled hours':'')+'</em></span>'+(lightW?'<span class="sc-ins static">Best window to travel: week of '+fmt(lightW.ws)+'<em>Light load, no overlaps or visa locks</em></span>':'')+(visa.length?'<span class="sc-ins static risk">'+visa.length+' visa-locked item'+(visa.length===1?'':'s')+'<em>Clear before the trip dates</em></span>':'')+(wait.length?'<span class="sc-ins static">'+wait.length+' unconfirmed in the next 14 days<em>Chase these first</em></span>':'')+'</div>';
  var stats='<div class="sc-stats"><div><b>'+evs.length+'</b><span>Events in 90 days</span></div><div><b>'+totalTravel.length+'</b><span>Arrivals and departures</span></div><div class="'+(visa.length?'warn':'')+'"><b>'+visa.length+'</b><span>Visa locks</span></div><div><b>'+weeks.filter(function(w){return w.load==='Light';}).length+'</b><span>Light weeks</span></div></div>';
  var wk=weeks.map(function(w,n){return '<article class="sc-week '+w.load.toLowerCase()+'"><header><b>Week '+(n+1)+'</b><span>'+fmt(w.ws)+' – '+fmt(addDays(w.ws,6))+'</span><em class="sc-load">'+w.load+'</em></header>'
    +'<div class="sc-wdays">'+w.days.map(function(x){var nt=x.l.length;return '<span class="'+(dkey(x.d)===dkey(new Date())?'today ':'')+(S.over[dkey(x.d)]?'over ':'')+'" title="'+esc(fmt(x.d,{weekday:'long',month:'short',day:'numeric'})+' · '+S.tpl[x.id].name)+'" style="--h:'+Math.min(1,nt/6)+'"><small>'+fmt(x.d,{weekday:'narrow'})+'</small><b>'+(nt||'')+'</b></span>';}).join('')+'</div>'
    +'<p>'+w.all.length+' event'+(w.all.length===1?'':'s')+' · '+Math.round(w.hours)+'h'+(w.travel?' · '+w.travel+' travel':'')+'</p>'
    +'<div class="sc-wflags">'+(w.cf?'<i class="bad">'+w.cf+' overlap'+(w.cf===1?'':'s')+'</i>':'')+(w.visa?'<i class="bad">'+w.visa+' visa lock'+(w.visa===1?'':'s')+'</i>':'')+(w.wait?'<i>'+w.wait+' unconfirmed</i>':'')+(w.freeEve?'':'<i>No free evening</i>')+'</div></article>';}).join('');
  var arr1=totalTravel.slice(0,12).map(function(x){return '<a class="sc-li" data-sc-live="'+esc(x.kind)+'|'+esc(x.id)+'" role="button" tabindex="0"><b>'+esc(fmt(x.starts_at,{weekday:'short',month:'short',day:'numeric'}))+'</b><span>'+esc(x.title)+'<em>'+esc([x.models.slice(0,2).join(', '),x.city].filter(Boolean).join(' · '))+'</em></span></a>';}).join('')||'<p class="sc-fine">No travel scheduled in the next 90 days.</p>';
  var vis=visa.slice(0,8).map(function(x){return '<a class="sc-li" data-sc-live="'+esc(x.kind)+'|'+esc(x.id)+'" role="button" tabindex="0"><b>'+esc(fmt(x.starts_at))+'</b><span>'+esc(x.title)+'<em>'+esc((x.raw.metadata&&x.raw.metadata.visa_gate_message)||'Visa not cleared')+'</em></span></a>';}).join('')||'<p class="sc-fine">No visa locks. Nice.</p>';
  var wt=wait.slice(0,8).map(function(x){return '<a class="sc-li" data-sc-live="'+esc(x.kind)+'|'+esc(x.id)+'" role="button" tabindex="0"><b>'+esc(fmt(x.starts_at))+'</b><span>'+esc(x.title)+'<em>'+esc(x.status||'pending')+'</em></span></a>';}).join('')||'<p class="sc-fine">Everything in the next two weeks is confirmed.</p>';
  return read+stats+'<div class="sc-grid sc-pgrid"><section class="sc-weeks">'+wk+'</section><aside class="sc-aside"><section class="sc-panel"><header><h3>Arrivals and departures</h3></header>'+arr1+'</section><section class="sc-panel"><header><h3>Visa and compliance</h3></header>'+vis+'</section><section class="sc-panel"><header><h3>Unconfirmed, next 14 days</h3></header>'+wt+'</section></aside></div>';
}

/* ---------- edit modal ---------- */
function editModal(index){
  var t=S.tpl[S.sel],sp=blockSpans(t.blocks),b=index==null?{s:mins('09:00'),e:mins('10:00'),t:'',d:'',c:'personal',f:[]}:sp[index];
  var hhmm=function(m){return String(Math.floor(m/60)).padStart(2,'0')+':'+String(m%60).padStart(2,'0');};
  var o=document.createElement('div');o.className='sc-modal-back';
  o.innerHTML='<form class="sc-modal" role="dialog" aria-modal="true" aria-label="'+(index==null?'Add block':'Edit block')+'"><header><h3>'+(index==null?'Add a block':'Edit block')+'</h3><button type="button" data-x aria-label="Close">×</button></header>'
    +'<label>Title<input name="t" required maxlength="80" value="'+esc(b.t)+'"></label><label>Details<input name="d" maxlength="140" value="'+esc(b.d)+'"></label>'
    +'<div class="sc-two"><label>Starts<input type="time" name="s" required value="'+hhmm(b.s)+'"></label><label>Ends <small>(blank = until the next block)</small><input type="time" name="e" value="'+(b.e?hhmm(b.e):'')+'"></label></div>'
    +'<label>Category<select name="c">'+Object.keys(CATS).map(function(k){return '<option value="'+k+'"'+(b.c===k?' selected':'')+'>'+CATS[k]+'</option>';}).join('')+'</select></label>'
    +'<footer>'+(index==null?'':'<button type="button" class="sc-danger" data-del>Delete</button>')+'<span></span><button type="button" class="sc-ghost" data-x>Cancel</button><button type="submit" class="sc-gold">Save</button></footer></form>';
  document.body.appendChild(o);var f=o.querySelector('form');setTimeout(function(){f.t.focus();},20);
  function close(){o.remove();}
  o.addEventListener('click',function(e){if(e.target===o||e.target.closest('[data-x]'))close();});
  o.addEventListener('keydown',function(e){if(e.key==='Escape')close();});
  var del=o.querySelector('[data-del]');if(del)del.onclick=function(){var s=sorted(t.blocks),target=sp[index];t.blocks=s.filter(function(x){return !(x.s===target.s&&x.t===target.t);});t.edited=true;save();close();render();};
  f.onsubmit=function(e){e.preventDefault();var nb={s:mins(f.s.value),e:f.e.value?mins(f.e.value):null,t:f.t.value.trim(),d:f.d.value.trim(),c:f.c.value,f:b.f||[]};
    if(nb.e&&nb.e<=nb.s){toast('The end time must be after the start.','bad');return;}
    var s=sorted(t.blocks);if(index!=null){var target=sp[index];s=s.filter(function(x){return !(x.s===target.s&&x.t===target.t);});}
    s.push(nb);t.blocks=sorted(s);t.edited=true;save();close();render();};
}
function overrideNotice(){}

/* ---------- events ---------- */
function wire(root){
  root.querySelectorAll('[data-sc-tab]').forEach(function(b){b.onclick=function(){S.tab=b.dataset.scTab;render();loadLive().then(render);};});
  root.querySelectorAll('[data-sc-pick]').forEach(function(b){b.onclick=function(){var id=b.dataset.scPick;S.sel=id;var dt=dateOfWeekday(id);if(dt)S.selDate=dkey(dt);else{var td=new Date();S.selDate=S.over[dkey(td)]===id?dkey(td):null;}S.tab='day';render();};});
  root.querySelectorAll('[data-sc-edit]').forEach(function(b){b.onclick=function(){editModal(+b.dataset.scEdit);};});
  root.querySelectorAll('[data-sc-add]').forEach(function(b){b.onclick=function(){editModal(null);};});
  root.querySelectorAll('[data-sc-reset]').forEach(function(b){b.onclick=function(){if(!window.confirm('Reset this template to the default?'))return;S.tpl[b.dataset.scReset]=defaults()[b.dataset.scReset];save();render();};});
  root.querySelectorAll('[data-sc-fix]').forEach(function(b){b.onclick=function(){fixBreaks(S.sel);toast('Added two 15-minute screen-free breaks');render();};});
  root.querySelectorAll('[data-sc-rule]').forEach(function(b){b.onclick=function(){var el=document.getElementById('sc-rule-'+b.dataset.scRule);if(el){el.scrollIntoView({behavior:'smooth',block:'center'});el.classList.add('flash');setTimeout(function(){el.classList.remove('flash');},1600);}};});
  root.querySelectorAll('[data-sc-market]').forEach(function(b){b.onclick=function(){S.market=b.dataset.scMarket;save();render();};});
  root.querySelectorAll('[data-sc-live]').forEach(function(b){var go=function(){var p=b.dataset.scLive.split('|');var x=(S.data||[]).filter(function(i){return i.kind===p[0]&&String(i.id)===p[1];})[0];if(x&&window.VEUX_V132&&VEUX_V132.openRecord)try{VEUX_V132.openRecord(x.kind,x.raw,{occurrence:x});return;}catch(e){}if(typeof window.navTo==='function')window.navTo('calendar');};b.onclick=go;b.onkeydown=function(e){if(e.key==='Enter'||e.key===' '){e.preventDefault();go();}};});
  root.querySelectorAll('[data-sc-mm]').forEach(function(b){b.onclick=function(){var n=+b.dataset.scMm,m=S.month||new Date();S.month=n===0?new Date(new Date().getFullYear(),new Date().getMonth(),1):new Date(m.getFullYear(),m.getMonth()+n,1);render();loadLive().then(render);};});
  root.querySelectorAll('[data-sc-day]').forEach(function(b){b.onclick=function(){S.monthSel=b.dataset.scDay;render();};});
  root.querySelectorAll('[data-sc-over]').forEach(function(s){s.onchange=function(){var k=s.dataset.scOver;if(s.value)S.over[k]=s.value;else delete S.over[k];save();render();};});
  root.querySelectorAll('[data-sc-open]').forEach(function(b){b.onclick=function(){var d=new Date(b.dataset.scOpen+'T12:00:00');S.sel=tplIdFor(d);S.selDate=b.dataset.scOpen;S.tab='day';render();window.scrollTo(0,0);};});
  root.querySelectorAll('[data-sc-setover]').forEach(function(b){b.onclick=function(){S.tab='month';S.monthSel=b.dataset.scSetover;var d=new Date(b.dataset.scSetover+'T12:00:00');S.month=new Date(d.getFullYear(),d.getMonth(),1);render();};});
}

function tick(){clearInterval(S.timer);S.timer=setInterval(function(){if(!S.host||!document.body.contains(S.host)||String(window._currentPage||'')!=='dayschedule'){clearInterval(S.timer);return;}if(S.tab==='day'&&!document.querySelector('.sc-modal-back'))render();},60000);}
window.renderDaySchedule=function(el){
  load();S.host=el;S.tab=S.tab||'day';S.sel=null;S.selDate=null;
  el.innerHTML='<div class="sc"><div class="sc-loading">Opening your schedule…</div></div>';
  render(el);tick();
  return loadLive(true).then(function(){render(el);});
};
(function register(){var n=0,t=setInterval(function(){var m=window.VEUX_V15_ROUTE_RENDERERS;if(m&&typeof m==='object'){m.dayschedule=function(el){return window.renderDaySchedule(el);};clearInterval(t);}else if(++n>120)clearInterval(t);},500);})();
window.MDV_SCHEDULE={evalRule:evalRule,evalWeek:evalWeek,defaults:defaults,state:S,blockSpans:blockSpans,splitBreak:splitBreak};
})();
