/* Outreach: one running log of every time someone at the agency reaches out — email, model package, call, text, DM, meeting —
   with the time, who did it, who it was to, and what is waiting for a reply.
   Emails sent from the portal Mail and model packages are written here automatically; anything else is logged by hand.
   Whoever is contacted is locked in as a contact (and a company, when one is given) — new ones are created on the spot.
   Data: /api/agent/outreach (stored on the CRM activity ledger). */
(function(){
'use strict';
if(window.MDV_OUTREACH)return;

var S={host:null,data:null,loading:false,err:'',at:0,view:'timeline',q:'',ch:'all',who:'all',st:'all',pf:'all',timer:null,log:null};
var CH={email:['Email','ti-mail'],package:['Model package','ti-box'],call:['Call','ti-phone'],text:['Text','ti-message'],whatsapp:['WhatsApp','ti-brand-whatsapp'],instagram:['Instagram DM','ti-brand-instagram'],linkedin:['LinkedIn','ti-brand-linkedin'],meeting:['Meeting','ti-calendar-event'],other:['Other','ti-dots']};
var ST={sent:'Sent',replied:'Replied',no_reply:'No reply',meeting_set:'Meeting set',won:'Won',closed:'Closed'};
var DAY=864e5;

function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
function arr(v){return Array.isArray(v)?v:[];}
function bridge(){var b=window.VEUX_AGENT_V4;if(!b||!b.api)throw new Error('Secure session is not ready');return b;}
function org(){try{return bridge().state.org.slug||'maison-de-veux';}catch(e){return 'maison-de-veux';}}
function msg(e){return (e&&e.message)||String(e||'Something went wrong');}
function get(){return bridge().api('/api/agent/outreach?organization='+encodeURIComponent(org())+'&_t='+Date.now(),{method:'GET',headers:{},__fresh:true});}
function post(body){return bridge().api('/api/agent/outreach',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(Object.assign({organization_slug:org()},body)),__fresh:true});}
function toast(m,bad){var o=document.querySelector('.ot-toast');if(o)o.remove();var d=document.createElement('div');d.className='ot-toast'+(bad?' bad':'');d.textContent=m;document.body.appendChild(d);setTimeout(function(){d.remove();},4800);}
function initials(n){return String(n||'?').replace(/[^A-Za-z0-9 ]/g,'').split(/\s+/).filter(Boolean).slice(0,2).map(function(x){return x[0];}).join('').toUpperCase()||'?';}

/* ---------- time ---------- */
function ago(v){
  if(!v)return '';var t=new Date(v).getTime();if(!t)return '';var s=Math.max(0,Math.round((Date.now()-t)/1000));
  if(s<60)return 'just now';if(s<3600)return Math.floor(s/60)+'m ago';if(s<86400)return Math.floor(s/3600)+'h ago';
  var d=Math.floor(s/86400);if(d<14)return d+'d ago';if(d<60)return Math.floor(d/7)+'w ago';return Math.floor(d/30)+'mo ago';
}
function clock(v){var d=new Date(v);return isNaN(d)?'':d.toLocaleTimeString([],{hour:'numeric',minute:'2-digit'});}
function dayKey(v){var d=new Date(v);return d.getFullYear()+'-'+(d.getMonth()+1)+'-'+d.getDate();}
function dayLabel(v){
  var d=new Date(v),t=new Date(),y=new Date(Date.now()-DAY);
  if(dayKey(d)===dayKey(t))return 'Today';if(dayKey(d)===dayKey(y))return 'Yesterday';
  return d.toLocaleDateString([],{weekday:'long',month:'short',day:'numeric',year:d.getFullYear()===t.getFullYear()?undefined:'numeric'});
}
function fullDate(v){var d=new Date(v);return isNaN(d)?'':d.toLocaleString([],{month:'short',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit'});}
function dueLabel(v){
  var d=new Date(v);if(isNaN(d))return '';var t0=new Date();t0.setHours(0,0,0,0);var n=Math.round((new Date(d).setHours(0,0,0,0)-t0)/DAY);
  return n<0?(-n===1?'1 day overdue':(-n)+' days overdue'):n===0?'Due today':n===1?'Due tomorrow':'Due '+d.toLocaleDateString([],{month:'short',day:'numeric'});
}
function isDue(e){return e.follow_up_at&&!e.follow_up_done_at;}
function overdue(e){return isDue(e)&&new Date(e.follow_up_at).getTime()<Date.now()-0;}
function localInput(d){d=d||new Date();var p=function(n){return String(n).padStart(2,'0');};return d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate())+'T'+p(d.getHours())+':'+p(d.getMinutes());}
function inDays(n){var d=new Date();d.setDate(d.getDate()+n);d.setHours(9,0,0,0);return d.toISOString();}

/* ---------- data ---------- */
async function load(force){
  if(S.loading){if(force)S.again=true;return S.loading;}
  if(!force&&S.data&&Date.now()-S.at<20000)return;
  S.loading=(async function(){
    try{S.data=await get();S.at=Date.now();S.err='';}catch(e){S.err=msg(e);}
    S.loading=false;
    if(S.again){S.again=false;return load(true);}
  })();
  return S.loading;
}
function list(){return arr(S.data&&S.data.outreach);}
function people(){return arr(S.data&&S.data.people);}
function companies(){return arr(S.data&&S.data.companies);}
function inRange(e){return true;}
function shown(){
  var q=S.q.toLowerCase();
  return list().filter(function(e){
    if(S.ch!=='all'&&e.channel!==S.ch)return false;
    if(S.who!=='all'&&(e.by||'')!==S.who)return false;
    if(S.st!=='all'&&e.status!==S.st)return false;
    if(q){var hay=[e.subject,e.summary,e.contact&&e.contact.name,e.contact&&e.contact.email,e.company&&e.company.name,e.by,e.package_title].join(' ').toLowerCase();if(hay.indexOf(q)<0)return false;}
    return true;
  });
}

/* ---------- page ---------- */
function kpis(){
  var L=list(),now=Date.now(),t0=new Date();t0.setHours(0,0,0,0);var wk=now-7*DAY;
  var out=L.filter(function(e){return e.direction==='outbound';});
  var today=out.filter(function(e){return new Date(e.at)>=t0;}).length,week=out.filter(function(e){return new Date(e.at).getTime()>=wk;}).length;
  var wait=people().filter(function(p){return p.awaiting;}),oldest=wait.reduce(function(m,p){return Math.max(m,Math.floor((now-new Date(p.last_at))/DAY));},0);
  var fu=L.filter(isDue),od=fu.filter(overdue).length;
  var never=people().filter(function(p){return !p.touches;}).length;
  var neu=people().filter(function(p){return p.auto&&p.created_at&&new Date(p.created_at).getTime()>=now-30*DAY;}).length;
  return {today:today,week:week,wait:wait.length,oldest:oldest,fu:fu.length,od:od,never:never,neu:neu};
}
function signals(k){
  var s=[];
  var stale=people().filter(function(p){return p.awaiting&&p.last_at&&Date.now()-new Date(p.last_at)>7*DAY;}).length;
  if(stale)s.push({t:stale+' '+(stale===1?'person has':'people have')+' waited over a week for a reply',go:'people',pf:'awaiting'});
  if(k.od)s.push({t:k.od+' follow-up'+(k.od===1?' is':'s are')+' overdue',go:'followups'});
  var nc=people().filter(function(p){return p.auto&&!p.company_id;}).length;
  if(nc)s.push({t:nc+' contact'+(nc===1?'':'s')+' added from outreach '+(nc===1?'has':'have')+' no company yet',go:'people',pf:'nocompany'});
  var cold=people().filter(function(p){return p.touches&&p.last_at&&Date.now()-new Date(p.last_at)>45*DAY;}).length;
  if(cold)s.push({t:cold+' contact'+(cold===1?'':'s')+' not reached in 45+ days',go:'people',pf:'cold'});
  return s;
}
function paint(){
  var el=S.host;if(!el)return;
  var k=S.data?kpis():null,sig=k?signals(k):[];
  var keep=el.querySelector('[data-q]'),had=keep&&document.activeElement===keep,pos=had?keep.selectionStart:0;
  el.innerHTML='<div class="ot">'
   +'<header class="ot-head"><div><small>OUTREACH</small><h1>Every touch, on the clock</h1><p>Emails and model packages are logged automatically. Add calls, texts, DMs and meetings here. Everyone you contact is saved as a contact.</p></div>'
   +'<div class="ot-ha"><button type="button" class="ot-btn" data-a="mail"><i class="ti ti-mail"></i> New email</button><button type="button" class="ot-btn gold" data-a="log"><i class="ti ti-plus"></i> Log outreach</button></div></header>'
   +(S.err?'<p class="ot-err">'+esc(S.err)+' <button type="button" class="ot-link" data-a="refresh">Try again</button></p>':'')
   +(k?kpiHtml(k):'<div class="ot-kpis sk"><span></span><span></span><span></span><span></span></div>')
   +(sig.length?'<div class="ot-sig"><b><i class="ti ti-sparkles"></i> Vera</b>'+sig.map(function(x,i){return '<button type="button" data-sig="'+i+'">'+esc(x.t)+'</button>';}).join('')+'</div>':'')
   +'<nav class="ot-tabs">'+[['timeline','Timeline'],['followups','Follow-ups'+(k&&k.fu?' <i>'+k.fu+'</i>':'')],['people','People'],['companies','Companies']].map(function(t){return '<button type="button" data-view="'+t[0]+'" class="'+(S.view===t[0]?'on':'')+'">'+t[1]+'</button>';}).join('')+'</nav>'
   +(S.view==='timeline'?filtersHtml():'')
   +'<div class="ot-body">'+(S.data?body():'<p class="ot-empty">Loading your outreach…</p>')+'</div></div>';
  var nq=el.querySelector('[data-q]');if(had&&nq){nq.focus();try{nq.setSelectionRange(pos,pos);}catch(e){}}
  wire(el,sig);
}
function kpiHtml(k){
  function c(n,l,s,a,bad){return '<button type="button" class="ot-k'+(bad?' bad':'')+'" '+(a?'data-kgo="'+a+'"':'')+'><b>'+n+'</b><span>'+l+'</span><small>'+s+'</small></button>';}
  return '<div class="ot-kpis">'+c(k.today,'Today','this week '+k.week,'timeline')+c(k.wait,'Awaiting reply',k.wait?'oldest '+k.oldest+'d':'all caught up','people:awaiting',k.oldest>7)
   +c(k.fu,'Follow-ups',k.od?k.od+' overdue':'none overdue','followups',k.od>0)+c(k.never,'Never contacted','in your contacts','people:never')+'</div>';
}
function filtersHtml(){
  var by=[];list().forEach(function(e){if(e.by&&by.indexOf(e.by)<0)by.push(e.by);});
  function sel(k,label,opts){return '<select data-f="'+k+'" aria-label="'+label+'"><option value="all">'+label+'</option>'+opts.map(function(o){return '<option value="'+esc(o[0])+'"'+(S[k]===o[0]?' selected':'')+'>'+esc(o[1])+'</option>';}).join('')+'</select>';}
  return '<div class="ot-filters"><label class="ot-search"><i class="ti ti-search"></i><input data-q type="search" placeholder="Search people, companies, subjects…" value="'+esc(S.q)+'" autocomplete="off"></label>'
   +sel('ch','All channels',Object.keys(CH).map(function(k){return [k,CH[k][0]];}))+sel('st','Any status',Object.keys(ST).map(function(k){return [k,ST[k]];}))+(by.length>1?sel('who','Everyone',by.map(function(b){return [b,b];})):'')+'</div>';
}
function body(){
  if(S.view==='followups')return followHtml();
  if(S.view==='people')return peopleHtml();
  if(S.view==='companies')return companiesHtml();
  return timelineHtml();
}

/* timeline */
function who(e){
  var n=e.contact&&e.contact.name,c=e.company&&e.company.name;
  return {n:n||c||'Unknown',c:n&&c?c:''};
}
function rowHtml(e){
  var w=who(e),ch=CH[e.channel]||CH.other,out=e.direction!=='inbound';
  var verb=e.channel==='call'?(out?'Called':'Call from'):e.channel==='meeting'?'Meeting with':e.channel==='package'?'Package sent to':out?(ch[0]+' to'):(ch[0]+' from');
  var fu=isDue(e)?'<span class="ot-chip '+(overdue(e)?'bad':'warn')+'"><i class="ti ti-bell"></i> '+dueLabel(e.follow_up_at)+'</span>':'';
  var rep=e.replied_at&&e.at?'<span class="ot-chip ok">Replied in '+span(e.at,e.replied_at)+'</span>':'';
  var src=e.source==='mail'?'<span class="ot-tag">Auto · Mail</span>':e.source==='package'?'<span class="ot-tag">Auto · Package</span>':'';
  var open=e.opened_at?'<span class="ot-chip ok"><i class="ti ti-eye"></i> Opened '+ago(e.opened_at)+'</span>':'';
  var ro=e.derived;
  return '<li class="ot-row" data-id="'+esc(e.id)+'"><span class="ot-ic '+esc(e.channel)+'"><i class="ti '+ch[1]+'"></i></span>'
   +'<div class="ot-main"><div class="ot-line"><b>'+esc(verb)+' '+(e.contact&&e.contact.id?'<a href="#" data-prof="contact:'+esc(e.contact.id)+'">'+esc(w.n)+'</a>':esc(w.n))+'</b>'+(w.c?'<span class="ot-co">· '+(e.company&&e.company.id?'<a href="#" data-prof="company:'+esc(e.company.id)+'">'+esc(w.c)+'</a>':esc(w.c))+'</span>':'')+'</div>'
   +(e.subject?'<div class="ot-sub">'+esc(e.subject)+'</div>':'')+(e.summary?'<div class="ot-sum">'+esc(e.summary)+'</div>':'')
   +'<div class="ot-meta"><span class="ot-chip st-'+esc(e.status)+'">'+esc(ST[e.status]||e.status)+'</span>'+fu+rep+open+src+(e.by?'<span class="ot-by">by '+esc(e.by)+'</span>':'')+'</div>'
   +(ro?'':'<div class="ot-acts">'+(e.status==='sent'&&out?'<button type="button" class="ot-link" data-do="replied">Mark replied</button>':'')
     +'<select data-fu aria-label="Set a follow-up"><option value="">'+(isDue(e)?'Move follow-up':'Follow up…')+'</option><option value="1">Tomorrow</option><option value="3">In 3 days</option><option value="7">In a week</option><option value="14">In 2 weeks</option>'+(isDue(e)?'<option value="done">Mark done</option><option value="clear">Clear</option>':'')+'</select>'
     +(e.contact&&e.contact.email?'<button type="button" class="ot-link" data-do="again" data-email="'+esc(e.contact.email)+'" data-subj="'+esc(e.subject||'')+'">Email again</button>':'')+'</div>')
   +'</div><time class="ot-time" title="'+esc(fullDate(e.at))+'"><b>'+esc(clock(e.at))+'</b><span>'+esc(ago(e.at))+'</span></time></li>';
}
function span(a,b){var ms=new Date(b)-new Date(a);if(!(ms>0))return '—';var m=Math.round(ms/60000);if(m<60)return m+'m';var h=Math.round(m/60);if(h<48)return h+'h';return Math.round(h/24)+'d';}
function timelineHtml(){
  var L=shown();
  if(!L.length)return emptyHtml(list().length?'Nothing matches those filters.':null);
  var out='',day='';
  L.forEach(function(e){var k=dayKey(e.at);if(k!==day){if(day)out+='</ul>';day=k;out+='<h3 class="ot-day">'+esc(dayLabel(e.at))+'</h3><ul class="ot-list">';}out+=rowHtml(e);});
  return out+'</ul>';
}
function emptyHtml(m){
  return '<div class="ot-empty"><i class="ti ti-send"></i><h3>'+esc(m||'No outreach logged yet')+'</h3>'+(m?'':'<p>From now on, every email you send from <b>Mail</b> and every <b>model package</b> you send is added here with the time, and the person is saved as a contact. For calls, texts, DMs and meetings, use <b>Log outreach</b>.</p><button type="button" class="ot-btn gold" data-a="log"><i class="ti ti-plus"></i> Log outreach</button>')+'</div>';
}

/* follow-ups */
function followHtml(){
  var L=list().filter(isDue).sort(function(a,b){return new Date(a.follow_up_at)-new Date(b.follow_up_at);});
  if(!L.length)return '<div class="ot-empty"><i class="ti ti-bell-check"></i><h3>No follow-ups waiting</h3><p>Set a follow-up on any entry in the timeline and it shows up here, ordered by date.</p></div>';
  var groups=[['Overdue',function(e){return overdue(e);}],['Due today',function(e){return !overdue(e)&&dayKey(e.follow_up_at)===dayKey(new Date());}],['Coming up',function(e){return !overdue(e)&&dayKey(e.follow_up_at)!==dayKey(new Date());}]];
  return groups.map(function(g){var r=L.filter(g[1]);if(!r.length)return '';return '<h3 class="ot-day '+(g[0]==='Overdue'?'bad':'')+'">'+g[0]+' <i>'+r.length+'</i></h3><ul class="ot-list">'+r.map(function(e){
    var w=who(e);return '<li class="ot-row" data-id="'+esc(e.id)+'"><span class="ot-ic '+esc(e.channel)+'"><i class="ti '+(CH[e.channel]||CH.other)[1]+'"></i></span><div class="ot-main"><div class="ot-line"><b>'+esc(w.n)+'</b>'+(w.c?'<span class="ot-co">· '+esc(w.c)+'</span>':'')+'</div><div class="ot-sub">'+esc(e.subject||CH[e.channel][0])+'</div><div class="ot-meta"><span class="ot-chip '+(overdue(e)?'bad':'warn')+'"><i class="ti ti-bell"></i> '+esc(dueLabel(e.follow_up_at))+'</span><span class="ot-by">last touch '+esc(ago(e.at))+'</span></div>'
     +'<div class="ot-acts"><button type="button" class="ot-btn sm gold" data-do="reach" data-cid="'+esc(e.contact&&e.contact.id||'')+'">Reach out now</button><button type="button" class="ot-btn sm" data-do="fdone">Done</button><select data-fu aria-label="Snooze"><option value="">Snooze…</option><option value="1">Tomorrow</option><option value="3">In 3 days</option><option value="7">In a week</option></select></div></div><time class="ot-time"><b>'+esc(new Date(e.follow_up_at).toLocaleDateString([],{month:'short',day:'numeric'}))+'</b><span>follow-up</span></time></li>';}).join('')+'</ul>';}).join('');
}

/* people */
function peopleHtml(){
  var pf=S.pf,q=S.q.toLowerCase(),now=Date.now();
  var P=people().filter(function(p){
    if(pf==='awaiting'&&!p.awaiting)return false;if(pf==='never'&&p.touches)return false;if(pf==='nocompany'&&(p.company_id||!p.auto))return false;
    if(pf==='cold'&&!(p.touches&&p.last_at&&now-new Date(p.last_at)>45*DAY))return false;
    if(q&&[p.name,p.email,p.company_name,p.role].join(' ').toLowerCase().indexOf(q)<0)return false;return true;
  }).sort(function(a,b){return (new Date(b.last_at||0))-(new Date(a.last_at||0))||String(a.name).localeCompare(b.name);}).slice(0,300);
  var chips=[['all','Everyone'],['awaiting','Awaiting reply'],['cold','Not reached 45+ days'],['never','Never contacted'],['nocompany','Added automatically, no company']];
  return '<div class="ot-filters"><label class="ot-search"><i class="ti ti-search"></i><input data-q type="search" placeholder="Search contacts…" value="'+esc(S.q)+'" autocomplete="off"></label></div><div class="ot-pf">'+chips.map(function(c){return '<button type="button" data-pf="'+c[0]+'" class="'+(pf===c[0]?'on':'')+'">'+c[1]+'</button>';}).join('')+'</div>'
   +(P.length?'<ul class="ot-people">'+P.map(function(p){
     var ch=CH[p.last_channel]||CH.other,state=!p.touches?'<span class="ot-chip">Never contacted</span>':p.awaiting?'<span class="ot-chip warn">Awaiting reply · '+esc(ago(p.last_at).replace(' ago',''))+'</span>':'<span class="ot-chip ok">In touch</span>';
     return '<li class="ot-person"><span class="ot-av">'+esc(initials(p.name))+'</span><div class="ot-main"><div class="ot-line"><b><a href="#" data-prof="contact:'+esc(p.id)+'">'+esc(p.name)+'</a></b>'+(p.role?'<span class="ot-co">· '+esc(p.role)+'</span>':'')+(p.auto?'<span class="ot-tag">Auto-added</span>':'')+'</div>'
      +'<div class="ot-sub">'+(p.company_name?esc(p.company_name):'<button type="button" class="ot-link" data-do="company" data-cid="'+esc(p.id)+'">＋ Add company</button>')+(p.email?' · '+esc(p.email):'')+'</div>'
      +'<div class="ot-meta">'+state+(p.touches?'<span class="ot-by"><i class="ti '+ch[1]+'"></i> '+esc(ago(p.last_at))+' · '+esc(fullDate(p.last_at))+' · '+p.touches+' touch'+(p.touches===1?'':'es')+'</span>':'')+'</div></div>'
      +'<div class="ot-acts col"><button type="button" class="ot-btn sm gold" data-do="reach" data-cid="'+esc(p.id)+'">Reach out</button></div></li>';}).join('')+'</ul>':'<p class="ot-empty small">Nobody matches.</p>');
}

/* companies */
function companiesHtml(){
  var map={};
  list().forEach(function(e){var c=e.company;if(!c)return;var o=map[c.id]||(map[c.id]={id:c.id,name:c.name,last:null,n:0,people:{},wait:false,ch:null});o.n++;if(!o.last||e.at>o.last){o.last=e.at;o.ch=e.channel;}if(e.contact&&e.contact.id)o.people[e.contact.id]=1;});
  people().forEach(function(p){if(p.company_id&&map[p.company_id]&&p.awaiting)map[p.company_id].wait=true;});
  var C=Object.keys(map).map(function(k){return map[k];}).sort(function(a,b){return new Date(b.last)-new Date(a.last);});
  if(!C.length)return '<div class="ot-empty"><i class="ti ti-building"></i><h3>No companies reached yet</h3><p>Companies appear here once an outreach is linked to one.</p></div>';
  return '<ul class="ot-people">'+C.map(function(c){var ch=CH[c.ch]||CH.other;return '<li class="ot-person"><span class="ot-av sq">'+esc(initials(c.name))+'</span><div class="ot-main"><div class="ot-line"><b><a href="#" data-prof="company:'+esc(c.id)+'">'+esc(c.name)+'</a></b></div><div class="ot-meta">'+(c.wait?'<span class="ot-chip warn">Awaiting reply</span>':'<span class="ot-chip ok">In touch</span>')+'<span class="ot-by"><i class="ti '+ch[1]+'"></i> last '+esc(ago(c.last))+' · '+esc(fullDate(c.last))+' · '+c.n+' touch'+(c.n===1?'':'es')+' · '+Object.keys(c.people).length+' contact'+(Object.keys(c.people).length===1?'':'s')+'</span></div></div></li>';}).join('')+'</ul>';
}

/* ---------- wiring ---------- */
function openProfile(ref){if(window.MDV_CONTACTS&&MDV_CONTACTS.show)MDV_CONTACTS.show(ref);else if(typeof window.navTo==='function')window.navTo('industrydirectory');}
function entry(id){return list().filter(function(e){return String(e.id)===String(id);})[0]||null;}
async function mutate(p,okMsg){
  try{var r=await post(p);if(!r||r.verified!==true)throw new Error('That change was not confirmed.');if(okMsg)toast(okMsg);await load(true);paint();return r;}
  catch(e){toast(msg(e),true);}
}
function wire(el,sig){
  el.querySelectorAll('[data-a]').forEach(function(b){b.onclick=function(){
    var a=b.dataset.a;if(a==='log')openLog();else if(a==='mail'){if(window.MDV_MAIL&&MDV_MAIL.newMessage)MDV_MAIL.newMessage();else if(typeof window.navTo==='function')window.navTo('mail');}else if(a==='refresh'){load(true).then(paint);}};});
  el.querySelectorAll('[data-view]').forEach(function(b){b.onclick=function(){S.view=b.dataset.view;S.q='';paint();};});
  el.querySelectorAll('[data-kgo]').forEach(function(b){b.onclick=function(){var p=b.dataset.kgo.split(':');S.view=p[0];S.pf=p[1]||'all';S.q='';paint();};});
  el.querySelectorAll('[data-sig]').forEach(function(b){b.onclick=function(){var s=sig[+b.dataset.sig];S.view=s.go;if(s.pf)S.pf=s.pf;S.q='';paint();};});
  el.querySelectorAll('[data-pf]').forEach(function(b){b.onclick=function(){S.pf=b.dataset.pf;paint();};});
  var q=el.querySelector('[data-q]');if(q)q.oninput=function(){S.q=q.value;clearTimeout(S.qt);S.qt=setTimeout(paint,160);};
  el.querySelectorAll('[data-f]').forEach(function(s){s.onchange=function(){S[s.dataset.f]=s.value;paint();};});
  el.querySelectorAll('[data-prof]').forEach(function(a){a.onclick=function(e){e.preventDefault();openProfile(a.dataset.prof);};});
  el.querySelectorAll('[data-fu]').forEach(function(s){s.onchange=function(){
    var row=s.closest('[data-id]'),id=row&&row.dataset.id,v=s.value;if(!v)return;
    if(v==='done')mutate({action:'update',id:id,follow_up_done:true},'Follow-up done');
    else if(v==='clear')mutate({action:'update',id:id,follow_up_at:null},'Follow-up cleared');
    else mutate({action:'update',id:id,follow_up_at:inDays(+v)},'Follow-up set');};});
  el.querySelectorAll('[data-do]').forEach(function(b){b.onclick=function(){
    var row=b.closest('[data-id]'),id=row&&row.dataset.id,d=b.dataset.do;
    if(d==='replied')mutate({action:'update',id:id,status:'replied'},'Marked as replied');
    else if(d==='fdone')mutate({action:'update',id:id,follow_up_done:true},'Follow-up done');
    else if(d==='again'){if(window.MDV_MAIL&&MDV_MAIL.emailTo)MDV_MAIL.emailTo([b.dataset.email],{subject:/^re:/i.test(b.dataset.subj)?b.dataset.subj:(b.dataset.subj?'Re: '+b.dataset.subj:'')});}
    else if(d==='reach'){var cid=b.dataset.cid;var p=people().filter(function(x){return x.id===cid;})[0];if(p)openLog({contact:p});else openLog();}
    else if(d==='company')openCompany(b.dataset.cid);};});
}

/* ---------- log outreach ---------- */
function openLog(pre){
  pre=pre||{};
  S.log={ch:'call',dir:'outbound',contact:pre.contact||null,newc:false,q:'',when:localInput(),status:'sent',fu:'',subject:'',summary:'',pkg:''};
  if(pre.channel)S.log.ch=pre.channel;
  var back=document.createElement('div');back.className='ot-back';back.id='ot-log';document.body.appendChild(back);
  paintLog();
}
function closeLog(){var b=document.getElementById('ot-log');if(b)b.remove();S.log=null;}
function match(q){
  q=String(q||'').toLowerCase().trim();if(q.length<1)return {p:[],c:[]};
  return {p:people().filter(function(p){return [p.name,p.email,p.company_name].join(' ').toLowerCase().indexOf(q)>=0;}).slice(0,6),c:companies().filter(function(c){return c.name.toLowerCase().indexOf(q)>=0;}).slice(0,4)};
}
function paintLog(){
  var back=document.getElementById('ot-log');if(!back||!S.log)return;var L=S.log;
  var fuOpts=[['','No follow-up'],['1','Tomorrow'],['3','In 3 days'],['7','In a week'],['14','In 2 weeks']];
  var who='';
  if(L.contact)who='<div class="ot-sel"><span class="ot-av">'+esc(initials(L.contact.name||L.contact.display_name))+'</span><div><b>'+esc(L.contact.name||L.contact.display_name)+'</b><small>'+esc([L.contact.company_name||'',L.contact.email||''].filter(Boolean).join(' · ')||'Saved contact')+'</small></div><button type="button" class="ot-x" data-unsel aria-label="Change">×</button></div>';
  else if(L.company)who='<div class="ot-sel"><span class="ot-av sq">'+esc(initials(L.company.name))+'</span><div><b>'+esc(L.company.name)+'</b><small>Company</small></div><button type="button" class="ot-x" data-unsel aria-label="Change">×</button></div>';
  else if(L.newc)who='<div class="ot-new"><div class="ot-grid"><label><span>Name</span><input id="n_name" value="'+esc(L.n_name||L.q||'')+'" placeholder="Full name"></label><label><span>Email</span><input id="n_email" type="email" value="'+esc(L.n_email||'')+'" placeholder="name@company.com"></label>'
    +'<label><span>Phone</span><input id="n_phone" value="'+esc(L.n_phone||'')+'"></label><label><span>Role</span><input id="n_role" value="'+esc(L.n_role||'')+'" placeholder="Casting director, booker…"></label>'
    +'<label class="wide"><span>Company</span><input id="n_company" list="ot-cos" value="'+esc(L.n_company||'')+'" placeholder="Pick one, or type a new company to create it" autocomplete="off"><datalist id="ot-cos">'+companies().map(function(c){return '<option value="'+esc(c.name)+'">';}).join('')+'</datalist></label></div>'
    +'<p class="ot-hint"><i class="ti ti-user-plus"></i> Saved as a new contact when you log this'+'. A company you type that is not in your list is created too.</p><button type="button" class="ot-link" data-unnew>Search existing instead</button></div>';
  else{
    var m=match(L.q);
    who='<div class="ot-find"><input id="o_q" type="search" value="'+esc(L.q)+'" placeholder="Search a contact or company by name or email" autocomplete="off">'
      +(L.q?'<div class="ot-res">'+m.p.map(function(p){return '<button type="button" data-pick-p="'+esc(p.id)+'"><span class="ot-av">'+esc(initials(p.name))+'</span><span><b>'+esc(p.name)+'</b><small>'+esc([p.company_name,p.email].filter(Boolean).join(' · '))+'</small></span></button>';}).join('')
      +m.c.map(function(c){return '<button type="button" data-pick-c="'+esc(c.id)+'"><span class="ot-av sq">'+esc(initials(c.name))+'</span><span><b>'+esc(c.name)+'</b><small>Company</small></span></button>';}).join('')
      +'<button type="button" class="new" data-new><i class="ti ti-user-plus"></i> Create “'+esc(L.q)+'” as a new contact</button></div>':'<button type="button" class="ot-link" data-new>＋ Someone new (not saved yet)</button>')+'</div>';
  }
  back.innerHTML='<section class="ot-dlg" role="dialog" aria-modal="true" aria-label="Log outreach"><header><div><small>OUTREACH</small><h2>Log outreach</h2></div><button type="button" class="ot-x" data-x aria-label="Close">×</button></header>'
   +'<div class="ot-form"><div class="ot-lbl">How</div><div class="ot-chs">'+Object.keys(CH).filter(function(k){return k!=='email'||true;}).map(function(k){return '<button type="button" data-ch="'+k+'" class="'+(L.ch===k?'on':'')+'"><i class="ti '+CH[k][1]+'"></i> '+CH[k][0]+'</button>';}).join('')+'</div>'
   +'<div class="ot-seg"><button type="button" data-dir="outbound" class="'+(L.dir==='outbound'?'on':'')+'">We reached out</button><button type="button" data-dir="inbound" class="'+(L.dir==='inbound'?'on':'')+'">They contacted us</button></div>'
   +'<div class="ot-lbl">Who</div>'+who
   +'<div class="ot-grid"><label><span>When</span><input id="o_when" type="datetime-local" value="'+esc(L.when)+'"></label><label><span>Status</span><select id="o_status">'+Object.keys(ST).map(function(k){return '<option value="'+k+'"'+(L.status===k?' selected':'')+'>'+ST[k]+'</option>';}).join('')+'</select></label>'
   +'<label class="wide"><span>'+(L.ch==='package'?'Package':'Subject / topic')+'</span><input id="o_subject" value="'+esc(L.subject)+'" placeholder="'+(L.ch==='call'?'e.g. Intro call about the fall casting':'What it was about')+'"></label>'
   +'<label class="wide"><span>Notes</span><textarea id="o_summary" rows="3" placeholder="What was said, what was agreed">'+esc(L.summary)+'</textarea></label>'
   +'<label><span>Follow up</span><select id="o_fu">'+fuOpts.map(function(o){return '<option value="'+o[0]+'"'+(L.fu===o[0]?' selected':'')+'>'+o[1]+'</option>';}).join('')+'<option value="date"'+(L.fu==='date'?' selected':'')+'>Pick a date…</option></select></label>'
   +(L.fu==='date'?'<label><span>Follow-up date</span><input id="o_fud" type="date" value="'+esc(L.fud||'')+'"></label>':'')+'</div>'
   +'<p class="ot-err" id="o_err"></p></div><footer><button type="button" class="ot-btn" data-x>Cancel</button><button type="button" class="ot-btn gold" id="o_save">Log it</button></footer></section>';
  wireLog(back);
}
function readLog(back){
  var L=S.log,v=function(id){var e=back.querySelector('#'+id);return e?e.value:null;};
  if(v('o_when')!=null)L.when=v('o_when');if(v('o_status')!=null)L.status=v('o_status');if(v('o_subject')!=null)L.subject=v('o_subject');if(v('o_summary')!=null)L.summary=v('o_summary');if(v('o_fu')!=null)L.fu=v('o_fu');if(v('o_fud')!=null)L.fud=v('o_fud');
  if(L.newc){L.n_name=v('n_name');L.n_email=v('n_email');L.n_phone=v('n_phone');L.n_role=v('n_role');L.n_company=v('n_company');}
  if(v('o_q')!=null)L.q=v('o_q');
}
function wireLog(back){
  var L=S.log;
  function rp(){readLog(back);paintLog();}
  back.querySelectorAll('[data-x]').forEach(function(b){b.onclick=closeLog;});
  back.onclick=function(e){if(e.target===back)closeLog();};
  back.querySelectorAll('[data-ch]').forEach(function(b){b.onclick=function(){readLog(back);L.ch=b.dataset.ch;paintLog();};});
  back.querySelectorAll('[data-dir]').forEach(function(b){b.onclick=function(){readLog(back);L.dir=b.dataset.dir;paintLog();};});
  var q=back.querySelector('#o_q');if(q){q.oninput=function(){readLog(back);var pos=q.selectionStart;paintLog();var n=back.querySelector('#o_q');if(n){n.focus();try{n.setSelectionRange(pos,pos);}catch(e){}}};if(!L.q)setTimeout(function(){q.focus();},50);}
  back.querySelectorAll('[data-pick-p]').forEach(function(b){b.onclick=function(){readLog(back);L.contact=people().filter(function(p){return p.id===b.dataset.pickP;})[0];paintLog();};});
  back.querySelectorAll('[data-pick-c]').forEach(function(b){b.onclick=function(){readLog(back);L.company=companies().filter(function(c){return c.id===b.dataset.pickC;})[0];paintLog();};});
  back.querySelectorAll('[data-new]').forEach(function(b){b.onclick=function(){readLog(back);L.newc=true;paintLog();};});
  back.querySelectorAll('[data-unnew]').forEach(function(b){b.onclick=function(){readLog(back);L.newc=false;paintLog();};});
  back.querySelectorAll('[data-unsel]').forEach(function(b){b.onclick=function(){readLog(back);L.contact=null;L.company=null;L.q='';paintLog();};});
  var fu=back.querySelector('#o_fu');if(fu)fu.onchange=rp;
  back.querySelector('#o_save').onclick=save;
}
async function save(){
  var back=document.getElementById('ot-log');if(!back||!S.log)return;readLog(back);var L=S.log,err=back.querySelector('#o_err'),btn=back.querySelector('#o_save');err.textContent='';
  var body={action:'log',channel:L.ch,direction:L.dir,subject:L.subject,summary:L.summary,status:L.status,occurred_at:L.when?new Date(L.when).toISOString():null};
  if(L.ch==='package')body.package_title=L.subject;
  if(L.fu==='date'){if(!L.fud){err.textContent='Pick the follow-up date.';return;}var d=new Date(L.fud+'T09:00:00');body.follow_up_at=d.toISOString();}else if(L.fu)body.follow_up_at=inDays(+L.fu);
  if(L.contact)body.contact_id=L.contact.id;
  else if(L.company)body.company_id=L.company.id;
  else if(L.newc){
    if(!String(L.n_name||'').trim()&&!String(L.n_email||'').trim()){err.textContent='Add a name or an email for the new contact.';return;}
    body.new_contact={name:String(L.n_name||'').trim(),email:String(L.n_email||'').trim(),phone:L.n_phone,role:L.n_role};
    var cn=String(L.n_company||'').trim();if(cn){var ex=companies().filter(function(c){return c.name.toLowerCase()===cn.toLowerCase();})[0];if(ex)body.company_id=ex.id;else body.new_company={name:cn};}
  }else{err.textContent='Choose who this was to, or add someone new.';return;}
  btn.disabled=true;btn.textContent='Saving…';
  try{
    var r=await post(body);if(!r||r.verified!==true)throw new Error('The entry was not confirmed as saved.');
    var bits=['Logged'];if(r.created_contact)bits.push('new contact '+(r.contact_name||'created'));if(r.created_company)bits.push('new company '+(r.company_name||'created'));
    closeLog();toast('✓ '+bits.join(' · '));S.view='timeline';await load(true);paint();
  }catch(e){err.textContent=msg(e);btn.disabled=false;btn.textContent='Log it';}
}
/* give an auto-added contact a company */
function openCompany(contactId){
  var p=people().filter(function(x){return x.id===contactId;})[0];if(!p)return;
  var back=document.createElement('div');back.className='ot-back';back.id='ot-co';
  back.innerHTML='<section class="ot-dlg ot-small" role="dialog" aria-modal="true"><header><div><small>COMPANY</small><h2>Add a company for '+esc(p.name)+'</h2></div><button type="button" class="ot-x" data-x aria-label="Close">×</button></header><div class="ot-form"><label><span>Company</span><input id="c_name" list="ot-cos2" placeholder="Pick one, or type a new company to create it" autocomplete="off"><datalist id="ot-cos2">'+companies().map(function(c){return '<option value="'+esc(c.name)+'">';}).join('')+'</datalist></label><p class="ot-err" id="c_err"></p></div><footer><button type="button" class="ot-btn" data-x>Cancel</button><button type="button" class="ot-btn gold" id="c_save">Save</button></footer></section>';
  document.body.appendChild(back);
  back.querySelectorAll('[data-x]').forEach(function(b){b.onclick=function(){back.remove();};});
  back.onclick=function(e){if(e.target===back)back.remove();};
  back.querySelector('#c_save').onclick=async function(){
    var n=back.querySelector('#c_name').value.trim(),err=back.querySelector('#c_err'),btn=this;if(!n){err.textContent='Type or pick a company.';return;}
    var ex=companies().filter(function(c){return c.name.toLowerCase()===n.toLowerCase();})[0];btn.disabled=true;
    try{var r=await post(ex?{action:'attach_company',contact_id:contactId,company_id:ex.id}:{action:'attach_company',contact_id:contactId,company_name:n});if(!r||r.verified!==true)throw new Error('Not confirmed.');back.remove();toast('✓ '+p.name+' added to '+(r.company_name||ex&&ex.name||n)+(r.created_company?' (new company)':''));await load(true);paint();}
    catch(e){err.textContent=msg(e);btn.disabled=false;}
  };
}
document.addEventListener('keydown',function(e){if(e.key==='Escape'){if(document.getElementById('ot-co')){document.getElementById('ot-co').remove();return;}if(document.getElementById('ot-log'))closeLog();}},true);

/* ---------- page entry ---------- */
function active(){return String(window._currentPage||'')==='outreach'&&S.host&&document.body.contains(S.host);}
function tick(){clearInterval(S.timer);S.timer=setInterval(function(){if(!active()){clearInterval(S.timer);return;}if(document.hidden||document.getElementById('ot-log')||document.getElementById('ot-co'))return;load(true).then(function(){if(active()&&!document.getElementById('ot-log'))paint();});},45000);}
/* keep the log current without a page refresh: reload when the page is opened, when the window is shown again, and right after anything is sent from Mail or Packages */
var wasActive=false,hooked=false;
function hookApi(){
  var b=window.VEUX_AGENT_V4;if(!b||typeof b.api!=='function')return;if(b.api.__ot){hooked=true;return;}
  var orig=b.api;
  var w=function(path,opts){
    var p=orig.apply(this,arguments);
    try{
      if(opts&&String(opts.method||'').toUpperCase()==='POST'&&/\/api\/agent\/(mail|packages?)/i.test(String(path))){
        var act=JSON.parse(opts.body||'{}').action;
        if(/^(send|reply|bulk_send)$/.test(act)&&p&&p.then)p.then(function(){S.dirty=Date.now();},function(){});
      }
    }catch(e){}
    return p;
  };
  w.__ot=1;for(var k in orig){try{w[k]=orig[k];}catch(e){}}
  try{b.api=w;hooked=true;}catch(e){}
}
function watch(){
  if(!hooked)hookApi();
  var el=document.getElementById('p-outreach'),on=!!el&&String(window._currentPage||'')==='outreach';
  if(on){
    if(el!==S.host||!el.firstChild){S.host=el;paint();}
    if(!wasActive||(S.dirty&&Date.now()-S.dirty>700)){S.dirty=0;load(true).then(function(){if(active()&&!document.getElementById('ot-log'))paint();});}
  }
  wasActive=on;
}
setInterval(watch,1000);
document.addEventListener('visibilitychange',function(){if(!document.hidden&&active())load(true).then(function(){if(!document.getElementById('ot-log'))paint();});});
window.addEventListener('focus',function(){if(active())load(true).then(function(){if(!document.getElementById('ot-log'))paint();});});
window.renderOutreach=function(el){
  S.host=el;paint();tick();
  return load(true).then(paint);
};
window.MDV_OUTREACH={render:window.renderOutreach,log:openLog,state:S};
(function register(){
  function put(){var m=window.VEUX_V15_ROUTE_RENDERERS;if(m&&typeof m==='object'){m.outreach=function(el){return window.renderOutreach(el);};return true;}return false;}
  if(put())return;var n=0,t=setInterval(function(){if(put()||++n>400)clearInterval(t);},150);
  ['veux:shell-ready','veux:assets-ready','veux:auth-ready'].forEach(function(e){window.addEventListener(e,put);});
})();
})();
