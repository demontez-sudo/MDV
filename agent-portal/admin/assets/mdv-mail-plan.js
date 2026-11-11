/* Add dates, events and to-dos from an email to the Calendar or Tasks.
   Open with MDV_MAILPLAN.open({subject, from, fromName, received, body, body_type}).
   It reads the email text, finds dates, times and things you are asked to do, and lists them as rows you can
   edit, switch between Event and Task, link to a model, and add. Nothing is saved until you press Add.
   Uses the same calls as the Calendar and Tasks pages (calendar/v9 create_event, tasks/v11 create_task). */
(function(){
'use strict';
if(window.MDV_MAILPLAN)return;

var MONTHS={january:0,jan:0,february:1,feb:1,march:2,mar:2,april:3,apr:3,may:4,june:5,jun:5,july:6,jul:6,august:7,aug:7,september:8,sept:8,sep:8,october:9,oct:9,november:10,nov:10,december:11,dec:11};
var DAYS={sunday:0,sun:0,monday:1,mon:1,tuesday:2,tue:2,tues:2,wednesday:3,wed:3,thursday:4,thu:4,thur:4,thurs:4,friday:5,fri:5,saturday:6,sat:6};
var MON='(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sept|sep|oct|nov|dec)';
var DOW='(sunday|monday|tuesday|wednesday|thursday|friday|saturday|sun|mon|tues|tue|wed|thurs|thur|thu|fri|sat)';
var EV_TYPES=[['meeting','Meeting / call'],['casting','Casting / go-see'],['job','Job / shoot'],['test','Test shoot'],['fitting','Fitting'],['travel','Travel'],['visa','Visa / passport'],['deadline','Deadline'],['option','Option / hold'],['press','Press'],['other','Other']];

var P=null;
var D=null,MODELS={list:null,loading:null},MEMBERS={list:null,loading:null},uid=0;

function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
function arr(v){return Array.isArray(v)?v:[];}
function bridge(){if(!window.VEUX_AGENT_V4||!VEUX_AGENT_V4.api)throw new Error('The secure connection is not ready yet. Try again in a moment.');return window.VEUX_AGENT_V4;}
function org(){var s=bridge().state||{};return (s.org&&s.org.slug)||'maison-de-veux';}
function myId(){try{var st=bridge().state;return (st.user&&st.user.id)||(st.session&&st.session.user&&st.session.user.id)||(st.profile&&st.profile.user_id)||null;}catch(e){return null;}}
function norm(s){return String(s||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9]+/g,' ').trim();}
function toast(m){try{if(window.toast)return window.toast(m);}catch(e){}}
function pad(n){return (n<10?'0':'')+n;}
function iso(y,m,d){return y+'-'+pad(m+1)+'-'+pad(d);}
function api(path,opt){return bridge().api(path,opt);}
function post(path,body){return api(path,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(Object.assign({organization_slug:org()},body))});}

/* ---------- reading the email ---------- */
function bodyText(ctx){
  var t='';
  if(String(ctx.body_type||'html')==='html'){
    try{
      var doc=new DOMParser().parseFromString(String(ctx.body||''),'text/html');
      doc.querySelectorAll('script,style,head,blockquote,.gmail_quote,.gmail_attr,#divRplyFwdMsg,#appendonsend,[id^="mail-editor-reference"]').forEach(function(n){n.remove();});
      doc.querySelectorAll('br').forEach(function(n){n.replaceWith(doc.createTextNode('\n'));});
      doc.querySelectorAll('p,div,li,tr,h1,h2,h3,h4,h5,h6,table').forEach(function(n){n.appendChild(doc.createTextNode('\n'));});
      t=doc.body?doc.body.textContent:'';
    }catch(e){t=String(ctx.body||'').replace(/<[^>]+>/g,' ');}
  }else t=String(ctx.body||'');
  t=t.replace(/ /g,' ').replace(/\r/g,'');
  /* anything from "On … wrote:" / "From: … Sent:" / the signature divider down is older mail, not news */
  var cut=t.search(/^\s*(On .{5,160}wrote:|-{2,}\s*(Original|Forwarded) message|From:\s.+\n\s*(Sent|Date):|-- ?$|Sent from my )/mi);
  if(cut>0)t=t.slice(0,cut);
  return t;
}
function sentences(t){
  var out=[];
  t.split(/\n+/).forEach(function(line){
    line=line.replace(/\s+/g,' ').trim();if(line.length<4)return;
    line.split(/(?<=[.!?])\s+(?=[A-Z0-9“"(])/).forEach(function(s){s=s.trim();if(s.length>=4)out.push(s);});
  });
  return out;
}

/* ---------- dates and times ---------- */
function baseDate(ctx){var d=ctx.received?new Date(ctx.received):new Date();if(isNaN(d))d=new Date();return new Date(d.getFullYear(),d.getMonth(),d.getDate());}
function validYmd(y,m,d){var x=new Date(y,m,d);return x.getFullYear()===y&&x.getMonth()===m&&x.getDate()===d;}
function inferYear(m,d,base){var y=base.getFullYear(),c=new Date(y,m,d);if(c<new Date(base.getTime()-30*864e5))y++;return y;}
function findDates(s,base){
  var found=[],mask=s.split('');
  function take(re,fn){
    var r=new RegExp(re,'gi'),m;
    while((m=r.exec(s))){
      var a=m.index,b=a+m[0].length,clash=false;for(var i=a;i<b;i++)if(mask[i]==='\u0000'){clash=true;break;}
      if(clash)continue;
      var res=fn(m);if(!res)continue;
      for(var j=a;j<b;j++)mask[j]='\u0000';
      found.push({y:res[0],m:res[1],d:res[2],idx:a,len:m[0].length,text:m[0]});
    }
  }
  take('\\b(20\\d\\d)-(\\d{1,2})-(\\d{1,2})\\b',function(m){var y=+m[1],mo=+m[2]-1,d=+m[3];return validYmd(y,mo,d)?[y,mo,d]:null;});
  take('\\b(?:'+DOW+'\\.?,?\\s+)?'+MON+'\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b(?:,?\\s+(20\\d\\d)\\b)?',function(m){var mo=MONTHS[m[2].toLowerCase()],d=+m[3],y=m[4]?+m[4]:inferYear(mo,d,base);return validYmd(y,mo,d)?[y,mo,d]:null;});
  take('\\b(?:'+DOW+'\\.?,?\\s+)?(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:of\\s+)?'+MON+'\\b\\.?(?:,?\\s+(20\\d\\d)\\b)?',function(m){var mo=MONTHS[m[3].toLowerCase()],d=+m[2],y=m[4]?+m[4]:inferYear(mo,d,base);return validYmd(y,mo,d)?[y,mo,d]:null;});
  take('\\b(\\d{1,2})/(\\d{1,2})(?:/(\\d{2,4}))?\\b',function(m){var a=+m[1],b=+m[2],mo=a>12?b-1:a-1,d=a>12?a:b;if(mo<0||mo>11)return null;var y=m[3]?(+m[3]<100?2000+ +m[3]:+m[3]):inferYear(mo,d,base);return validYmd(y,mo,d)?[y,mo,d]:null;});
  take('\\b(tomorrow|today|tonight)\\b',function(m){var w=m[1].toLowerCase(),x=new Date(base.getTime()+(w==='tomorrow'?864e5:0));return [x.getFullYear(),x.getMonth(),x.getDate()];});
  take('\\b(next|this|coming)\\s+'+DOW+'\\b',function(m){var want=DAYS[m[2].toLowerCase()],diff=(want-base.getDay()+7)%7;if(diff===0&&m[1].toLowerCase()!=='this')diff=7;var x=new Date(base.getTime()+diff*864e5);return [x.getFullYear(),x.getMonth(),x.getDate()];});
  take('\\b(?:(?:on|by|before|until|till|this)\\s+'+DOW+'|(sunday|monday|tuesday|wednesday|thursday|friday|saturday))\\b',function(m){var want=DAYS[(m[1]||m[2]).toLowerCase()],diff=(want-base.getDay()+7)%7||7;var x=new Date(base.getTime()+diff*864e5);return [x.getFullYear(),x.getMonth(),x.getDate()];});
  found.sort(function(a,b){return a.idx-b.idx;});
  return found;
}
function to24(h,mi,mer){h=+h;mi=mi?+mi:0;mer=(mer||'').toLowerCase().replace(/\./g,'');if(mer==='pm'&&h<12)h+=12;if(mer==='am'&&h===12)h=0;if(h>23||mi>59)return null;return pad(h)+':'+pad(mi);}
function findTimes(s){
  var m=s.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm|a\.m\.|p\.m\.)?\s*(?:-|–|—|to|until|till)\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm|a\.m\.|p\.m\.)\b/i);
  if(m){
    var em=m[6],sm=m[3];
    if(!sm){sm=em;if(/pm/i.test(em)&&+m[4]===12&&+m[1]<12)sm='am';else if(+m[1]>+m[4]&&+m[4]<=12)sm='am';}
    var a=to24(m[1],m[2],sm),b=to24(m[4],m[5],em);if(a&&b)return {start:a,end:b};
  }
  m=s.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm|a\.m\.|p\.m\.)(?![a-z])/i);
  if(m){var t=to24(m[1],m[2],m[3]);if(t)return {start:t,end:''};}
  m=s.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b(?!\s*(?:am|pm))/i);
  if(m){var t2=to24(m[1],m[2],'');if(t2)return {start:t2,end:''};}
  return null;
}

/* ---------- what is each line? ---------- */
var TASK_RE=/\b(deadline|due|submit|send (?:me|us|over|through|back)|reply|respond|confirm|sign|upload|provide|renew|follow up|remind|need(?:s)? to|must|have to|make sure|don'?t forget|please (?:send|share|review|book|check|sort|arrange|let))\b/i;
function evType(t){
  t=t.toLowerCase();
  if(/casting|go[- ]?see/.test(t))return 'casting';
  if(/fitting/.test(t))return 'fitting';
  if(/test shoot|\btests?\b|digitals?/.test(t))return 'test';
  if(/flight|fly|depart|arriv|train|travel|hotel|airport|check[- ]in/.test(t))return 'travel';
  if(/visa|embassy|passport|consulate/.test(t))return 'visa';
  if(/deadline|due\b/.test(t))return 'deadline';
  if(/option|\bhold\b/.test(t))return 'option';
  if(/shoot|campaign|booking|\bjob\b|runway|show\b|rehearsal/.test(t))return 'job';
  if(/press|interview/.test(t))return 'press';
  if(/meeting|call|zoom|meet\b|catch[- ]up|chat|review|teams|coffee|lunch|dinner/.test(t))return 'meeting';
  return 'meeting';
}
function cleanTitle(s,subject){
  var t=s.replace(/\s+/g,' ').trim().replace(/^(?:hi|hello|hey|dear)\s+[A-Za-z.' -]{2,30}?[,!]\s*/i,'').replace(/^(also|and|so|but|hi|hello|hey|thanks?|thank you)[,!\s-]+/i,'').replace(/^[-–•*\s]+/,'');
  t=t.replace(/\b(?:i'?ll|we'?ll|i will|we will)\s+/i,'');
  if(t.length>90){var cut=t.slice(0,90),sp=cut.lastIndexOf(' ');t=(sp>50?cut.slice(0,sp):cut)+'…';}
  t=t.replace(/[.!?]+$/,'');
  return t.charAt(0).toUpperCase()+t.slice(1)||subject||'From email';
}
function meetLink(ctx){var t=bodyText(ctx),m=t.match(/\b((?:https?:\/\/)?(?:meet\.google\.com\/[a-z0-9-]+|(?:[a-z0-9-]+\.)?zoom\.us\/j\/[0-9]+(?:\?pwd=[\w.-]+)?|teams\.microsoft\.com\/l\/meetup-join\/[^\s"'<>]+))/i);return m?(/^https?:/i.test(m[1])?m[1]:'https://'+m[1]):'';}
function detect(ctx){
  var base=baseDate(ctx),items=[],seen={};
  sentences(bodyText(ctx)).forEach(function(s){
    var ds=findDates(s,base),tm=findTimes(s);
    if(ds.length){
      var range=ds.length>1&&/\b(to|until|through|thru|till|-|–|—)\b/i.test(s.slice(ds[0].idx+ds[0].len,ds[1].idx))&&iso(ds[1].y,ds[1].m,ds[1].d)>iso(ds[0].y,ds[0].m,ds[0].d);
      var list=range?[ds[0]]:ds.slice(0,3);
      list.forEach(function(d,i){
        var date=iso(d.y,d.m,d.d),taskish=TASK_RE.test(s),type=evType(s),kind=(taskish&&!tm)||/deadline|\bdue\b/i.test(s)&&!tm?'task':'event';
        var key=date+'|'+(tm&&tm.start||'')+'|'+norm(s).slice(0,40);if(seen[key])return;seen[key]=1;
        var strong=!!tm||taskish||type!=='meeting'||/meeting|call|zoom|meet\b/i.test(s);
        items.push({id:++uid,on:strong,kind:kind,title:cleanTitle(s,ctx.subject),date:date,start:tm?tm.start:'',end:tm?tm.end:'',endDate:range?iso(ds[1].y,ds[1].m,ds[1].d):'',etype:type,snippet:s,status:'ready',error:'',found:d.text,where:'',cal:true,ds:false});
      });
    }else if(/^(please|kindly|could you|can you|would you)\b/i.test(s)&&s.length<200&&TASK_RE.test(s)){
      items.push({id:++uid,on:false,kind:'task',title:cleanTitle(s.replace(/^(please|kindly|could you|can you|would you)\s+/i,''),ctx.subject),date:'',start:'',end:'',endDate:'',etype:'other',snippet:s,status:'ready',error:'',found:'',where:'',cal:true,ds:false});
    }
  });
  /* a calendar invitation says the same thing several times (When, the header, the footer): keep one row, named from the subject */
  var inv=String(ctx.subject||'').match(/^(?:updated invitation|invitation|accepted|declined|tentatively accepted|canceled event|canceled)[^:]*:\s*(.+?)\s*(?:@.*)?$/i),link=meetLink(ctx),byKey={},uniq=[];
  items.forEach(function(i){var k=i.date?i.date+'|'+i.start+'|'+i.end:'u'+i.id;if(byKey[k])return;byKey[k]=1;uniq.push(i);});
  if(inv&&inv[1]){var first=uniq.filter(function(i){return i.date;})[0];if(first){first.title=inv[1].trim().slice(0,200);first.kind='event';first.on=true;uniq=uniq.filter(function(i){return !i.date||i===first;});}}
  uniq.forEach(function(i){if(i.kind==='event'&&link&&!i.where)i.where=link;});
  var dated=uniq.filter(function(i){return i.date;}).slice(0,10),undated=uniq.filter(function(i){return !i.date;}).slice(0,4);
  return dated.concat(undated);
}

/* ---------- models and people ---------- */
function loadModels(){
  if(MODELS.list)return Promise.resolve(MODELS.list);
  if(MODELS.loading)return MODELS.loading;
  MODELS.loading=api('/api/agent/save-to-model?organization='+encodeURIComponent(org()),{method:'GET',headers:{}}).then(function(r){MODELS.list=arr(r&&r.models);return MODELS.list;}).catch(function(){MODELS.loading=null;return [];});
  return MODELS.loading;
}
function loadMembers(){
  if(MEMBERS.list)return Promise.resolve(MEMBERS.list);
  if(MEMBERS.loading)return MEMBERS.loading;
  MEMBERS.loading=api('/api/agent/tasks/v11?organization='+encodeURIComponent(org())+'&_t='+Date.now(),{method:'GET',headers:{},__fresh:true}).then(function(r){MEMBERS.list=arr(r&&r.members);return MEMBERS.list;}).catch(function(){MEMBERS.loading=null;return [];});
  return MEMBERS.loading;
}
function guessModel(ctx,models){
  var hay=' '+norm([ctx.subject,ctx.fromName,bodyText(ctx)].join(' '))+' ',full=[],first={};
  models.forEach(function(m){var n=norm(m.name);if(n.length<5)return;if(hay.indexOf(' '+n+' ')>-1)full.push(m);var f=n.split(' ')[0];if(f.length>=4&&hay.indexOf(' '+f+' ')>-1)(first[f]=first[f]||[]).push(m);});
  if(full.length===1)return full[0];
  if(!full.length){var k=Object.keys(first).filter(function(x){return first[x].length===1;});if(k.length===1)return first[k[0]][0];}
  return null;
}
function memberName(m){return (m.profile&&m.profile.display_name)||m.display_name||m.name||[m.first_name,m.last_name].filter(Boolean).join(' ')||m.job_title||m.email||'Team member';}
function activeMembers(list){return arr(list).filter(function(m){return !m.status||/^(active|invited|pending)?$/i.test(String(m.status));}).sort(function(a,b){var am=a.user_id&&a.user_id===myId()?0:1,bm=b.user_id&&b.user_id===myId()?0:1;return am-bm||memberName(a).localeCompare(memberName(b));});}

/* ---------- pickers: a searchable list for Model and for Team (replaces the long native menus) ---------- */
function initials(n){var p=String(n||'').trim().split(/\s+/).filter(Boolean);return (((p[0]||'')[0]||'')+((p.length>1?p[p.length-1][0]:'')||'')).toUpperCase();}
function hue(n){var h=0;String(n||'').split('').forEach(function(c){h=(h*31+c.charCodeAt(0))%360;});return h;}
function av(o){return o.img?'<span class="mp-av"><img src="'+esc(o.img)+'" alt="" loading="lazy"></span>':'<span class="mp-av'+(o.none?' none':'')+'" style="--h:'+hue(o.name)+'">'+esc(o.none?'–':initials(o.name))+'</span>';}
function pastModel(m){return /^(archiv|releas|inactive|former)/i.test(String(m.status||''));}
function options(kind){
  var out=[];
  if(kind==='model'){
    var list=arr(MODELS.list).filter(function(m){return m&&m.id&&m.name;}).sort(function(a,b){return String(a.name).localeCompare(String(b.name));});
    out.push({id:'',name:'No model',sub:'Not linked to anyone',none:true});
    var g=D&&D.guess?list.filter(function(m){return m.id===D.guess;})[0]:null;
    if(g)out.push({id:g.id,name:g.name,sub:'Matched from this email',group:'Suggested'});
    var act=[],old=[];
    list.forEach(function(m){if(g&&m.id===g.id)return;var o={id:m.id,name:m.name,sub:[m.market,m.status&&!/^active$/i.test(m.status)?m.status:''].filter(Boolean).join(' · ')};(pastModel(m)?old:act).push(o);});
    act.forEach(function(o,i){o.group=i===0?'Models':undefined;});old.forEach(function(o,i){o.group=i===0?'Past models':undefined;o.dim=true;});
    return out.concat(act,old);
  }
  var ms=activeMembers(MEMBERS.list);
  out.push({id:'',name:'Nobody',sub:'Leave unassigned',none:true});
  var firstTeam=true;
  ms.forEach(function(m,i){var me=!!(m.user_id&&m.user_id===myId()),n=memberName(m),jt=m.job_title&&m.job_title!==n?m.job_title:'';
    var o={id:m.id,name:n,sub:(me?'Me':'')+(me&&jt?' · ':'')+jt,img:m.profile&&m.profile.avatar_url||''};
    if(me)o.group='You';else if(firstTeam){o.group='Team';firstTeam=false;}
    out.push(o);});
  return out;
}
function curId(kind){return kind==='model'?D.model:D.assignee;}
function triggerHtml(kind){
  var label=kind==='model'?'Model':'Assign tasks to',opts=options(kind),cur=opts.filter(function(o){return o.id===curId(kind);})[0]||opts[0];
  var loading=kind==='model'?!MODELS.list:!MEMBERS.list;
  var sub=loading&&!cur.id?'Loading…':(cur.id&&kind==='model'&&cur.id===D.guess?'Matched from this email':cur.sub||'');
  return '<div class="mp-pk"><span class="mp-pkl">'+label+'</span><button type="button" class="mp-pkb" data-pick="'+kind+'" aria-haspopup="listbox" aria-expanded="'+(P&&P.kind===kind?'true':'false')+'"'+(D.busy?' disabled':'')+'>'+av(cur)+'<span class="mp-pkt"><b>'+esc(cur.name)+'</b>'+(sub?'<small>'+esc(sub)+'</small>':'')+'</span><svg viewBox="0 0 12 8" width="12" height="8" aria-hidden="true"><path d="M1 1.5l5 5 5-5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg></button></div>';
}
function closePick(){
  if(!P)return;var b=P.btn;
  if(P.pop&&P.pop.parentNode)P.pop.remove();
  document.removeEventListener('mousedown',pickAway,true);window.removeEventListener('resize',closePick);
  P=null;if(b&&b.isConnected)b.setAttribute('aria-expanded','false');
}
function pickAway(e){if(P&&!P.pop.contains(e.target)&&!(P.btn&&P.btn.contains(e.target)))closePick();}
function place(){
  var pop=P.pop,b=P.btn,r=b.getBoundingClientRect(),vh=window.innerHeight;
  if(window.innerWidth<640){pop.classList.add('sheet');pop.style.cssText='';return;}
  var w=Math.max(r.width,320),left=Math.min(Math.max(8,r.left),window.innerWidth-w-8),below=vh-r.bottom-14,above=r.top-14,up=below<260&&above>below,room=Math.min(420,up?above:below);
  pop.style.cssText='left:'+left+'px;width:'+w+'px;max-height:'+room+'px;'+(up?'bottom:'+(vh-r.top+6)+'px':'top:'+(r.bottom+6)+'px');
}
function fillPick(){
  if(!P)return;
  var toks=norm(P.q).split(' ').filter(Boolean),list=P.pop.querySelector('.mp-pl'),sel=curId(P.kind);
  P.vis=P.opts.filter(function(o){if(!toks.length)return true;if(o.none)return false;var h=norm(o.name+' '+(o.sub||''));return toks.every(function(t){return h.indexOf(t)>-1;});});
  if(P.idx>=P.vis.length)P.idx=Math.max(0,P.vis.length-1);
  var html='',lastGroup=null;
  P.vis.forEach(function(o,i){
    var g=toks.length?(o.group||lastGroup):o.group;if(g&&g!==lastGroup&&(!toks.length||o.group)){html+='<div class="mp-pg" role="presentation">'+esc(g)+'</div>';}if(o.group)lastGroup=o.group;
    html+='<button type="button" role="option" class="mp-opt'+(o.id===sel?' on':'')+(i===P.idx?' act':'')+(o.dim?' dim':'')+'" data-i="'+i+'" aria-selected="'+(o.id===sel?'true':'false')+'">'+av(o)+'<span class="mp-pkt"><b>'+esc(o.name)+'</b>'+(o.sub?'<small>'+esc(o.sub)+'</small>':'')+'</span>'+(o.id===sel?'<svg class="mp-ck2" viewBox="0 0 14 11" width="14" height="11" aria-hidden="true"><path d="M1 5.5l4 4 8-8.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>':'')+'</button>';
  });
  if(!P.vis.length)html='<p class="mp-pn">No match for “'+esc(P.q)+'”.</p>';
  list.innerHTML=html;
  list.querySelectorAll('.mp-opt').forEach(function(b){
    b.onmousemove=function(){var i=+b.dataset.i;if(P.idx!==i){var o=list.querySelector('.mp-opt.act');if(o)o.classList.remove('act');P.idx=i;b.classList.add('act');}};
    b.onclick=function(){choose(P.vis[+b.dataset.i]);};
  });
  var a=list.querySelector('.mp-opt.act');if(a&&a.scrollIntoView)a.scrollIntoView({block:'nearest'});
}
function choose(o){if(!o||!P)return;if(P.kind==='model')D.model=o.id;else D.assignee=o.id;closePick();paint();}
function openPick(kind,btn){
  if(P&&P.kind===kind){closePick();return;}
  closePick();
  var pop=document.createElement('div');pop.id='mdv-mp-pop';pop.className='mp-pop';
  pop.innerHTML='<div class="mp-ps"><input type="text" autocomplete="off" spellcheck="false" placeholder="'+(kind==='model'?'Search models…':'Search the team…')+'" aria-label="Search"></div><div class="mp-pl" role="listbox"></div>';
  document.body.appendChild(pop);
  P={kind:kind,btn:btn,pop:pop,q:'',idx:0,opts:options(kind),vis:[]};
  var sel=curId(kind),at=P.opts.map(function(o){return o.id;}).indexOf(sel);if(at>0)P.idx=at;
  btn.setAttribute('aria-expanded','true');place();fillPick();
  var inp=pop.querySelector('input');
  inp.oninput=function(){P.q=inp.value;P.idx=0;fillPick();};
  inp.onkeydown=function(e){
    if(e.key==='Escape'){e.preventDefault();e.stopPropagation();var b=P.btn;closePick();if(b&&b.focus)b.focus();}
    else if(e.key==='ArrowDown'){e.preventDefault();P.idx=Math.min(P.vis.length-1,P.idx+1);fillPick();}
    else if(e.key==='ArrowUp'){e.preventDefault();P.idx=Math.max(0,P.idx-1);fillPick();}
    else if(e.key==='Enter'){e.preventDefault();choose(P.vis[P.idx]);}
    else if(e.key==='Tab'){closePick();}
  };
  document.addEventListener('mousedown',pickAway,true);window.addEventListener('resize',closePick);
  setTimeout(function(){if(P&&inp.isConnected)inp.focus({preventScroll:true});},0);
}

/* ---------- dialog ---------- */
function root(){var r=document.getElementById('mdv-mp');if(!r){r=document.createElement('div');r.id='mdv-mp';r.className='mp-back';r.addEventListener('click',function(e){if(e.target===r&&D&&!D.busy)close();});document.body.appendChild(r);}return r;}
function close(){closePick();D=null;var r=document.getElementById('mdv-mp');if(r)r.remove();document.removeEventListener('keydown',onKey);}
function onKey(e){if(e.key==='Escape'&&D&&!D.busy){if(P){closePick();return;}close();}}
function fmtDay(d){if(!d)return '';var p=d.split('-');return new Date(+p[0],+p[1]-1,+p[2]).toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric',year:'numeric'});}

function rowHtml(i){
  var done=i.status==='done',lock=done||D.busy,dis=lock?' disabled':'';
  var ev=i.kind==='event';
  return '<li class="mp-row '+i.status+(i.on?' on':'')+'" data-id="'+i.id+'">'
    +'<label class="mp-ck"><input type="checkbox" data-k="on"'+(i.on?' checked':'')+dis+' aria-label="Include this"></label>'
    +'<div class="mp-bd">'
    +'<div class="mp-top"><div class="mp-seg" role="group" aria-label="Add as"><button type="button" data-kind="event" class="'+(ev?'on':'')+'"'+dis+'>Event</button><button type="button" data-kind="task" class="'+(ev?'':'on')+'"'+dis+'>Task</button></div>'
    +'<input type="text" class="mp-title" data-k="title" maxlength="200" value="'+esc(i.title)+'" placeholder="'+(ev?'Event title':'Task title')+'" aria-label="Title"'+dis+'></div>'
    +'<div class="mp-when">'
    +'<label>Date<input type="date" data-k="date" value="'+esc(i.date)+'"'+dis+'></label>'
    +'<label>'+(ev?'Starts':'Time')+'<input type="time" data-k="start" value="'+esc(i.start)+'"'+dis+'></label>'
    +(ev?'<label>Ends<input type="time" data-k="end" value="'+esc(i.end)+'"'+dis+'></label><label>Until (date)<input type="date" data-k="endDate" value="'+esc(i.endDate)+'"'+dis+'></label>':'')
    +(ev?'<label>Type<select data-k="etype"'+dis+'>'+EV_TYPES.map(function(t){return '<option value="'+t[0]+'"'+(i.etype===t[0]?' selected':'')+'>'+t[1]+'</option>';}).join('')+'</select></label>':'')
    +'</div>'
    +(ev?'<div class="mp-dest"><label class="mp-wh">Where / link<input type="text" data-k="where" maxlength="300" value="'+esc(i.where||'')+'" placeholder="Room, address or meeting link"'+dis+'></label><span class="mp-to">Add to</span><label class="mp-chk"><input type="checkbox" data-k="cal"'+(i.cal?' checked':'')+(i.calDone?' disabled':dis)+'> Model Agenda</label>'+(D.owner?'<label class="mp-chk"><input type="checkbox" data-k="ds"'+(i.ds?' checked':'')+(i.dsDone?' disabled':dis)+'> My DaySilk</label>':'')+'</div>':'')
    +(i.snippet?'<p class="mp-src">From the email: “'+esc(i.snippet.length>170?i.snippet.slice(0,170)+'…':i.snippet)+'”</p>':'')
    +(done?'<em class="mp-ok">✓ Added to '+(ev?(i.calDone&&i.dsDone?'the calendar and DaySilk':i.dsDone?'DaySilk':'the calendar'):'tasks')+'</em>':i.status==='saving'?'<em class="mp-wait">Adding…</em>':i.error?'<em class="mp-bad">'+esc(i.error)+'</em>':!i.date&&i.kind==='event'?'<em class="mp-bad">Pick a date for an event.</em>':'')
    +'</div>'
    +(!lock?'<button type="button" class="mp-x" data-rm="'+i.id+'" aria-label="Remove">×</button>':'')
    +'</li>';
}
function paint(){
  if(!D)return;
  var r=root(),ctx=D.ctx,models=arr(MODELS.list).filter(function(m){return m&&m.id;});
  var picked=D.items.filter(function(i){return i.on&&i.status!=='done';}).length,left=D.items.filter(function(i){return i.status!=='done';}).length;
  var allDone=D.items.length&&!left;
  var anyEv=D.items.some(function(i){return i.kind==='event'&&i.status==='done';}),anyTk=D.items.some(function(i){return i.kind==='task'&&i.status==='done';});
  r.innerHTML='<div class="mp-card" role="dialog" aria-modal="true" aria-label="Add to calendar and tasks">'
    +'<header><div><h3>Add to calendar &amp; tasks</h3><p>'+(D.items.length?'Dates and things to do found in this email. Check what you want, fix anything, then add it.':'No dates or to-dos found in this email. Add one yourself below.')+'</p><small class="mp-from">'+esc(ctx.subject||'(no subject)')+(ctx.fromName?' · '+esc(ctx.fromName):'')+'</small></div><button type="button" class="mp-x big" data-close aria-label="Close"'+(D.busy?' disabled':'')+'>×</button></header>'
    +'<div class="mp-opts">'+triggerHtml('model')+triggerHtml('assignee')+'</div>'
    +'<ul class="mp-list">'+D.items.map(rowHtml).join('')+'</ul>'
    +'<div class="mp-more"><button type="button" class="mp-link" data-add="event">+ Add an event</button><button type="button" class="mp-link" data-add="task">+ Add a task</button></div>'
    +'<footer><div class="mp-fl">'+(anyEv?'<button type="button" class="mp-link" data-go="calendar">Open Calendar</button>':'')+(anyTk?'<button type="button" class="mp-link" data-go="tasksconsolidated">Open Tasks</button>':'')+'</div>'
    +'<div class="mp-fr"><button type="button" class="mp-btn" data-close'+(D.busy?' disabled':'')+'>'+(allDone?'Done':D.items.some(function(i){return i.status==='done';})?'Close':'Cancel')+'</button>'
    +(allDone?'':'<button type="button" class="mp-btn pri" data-save'+(!picked||D.busy?' disabled':'')+'>'+(D.busy?'Adding…':'Add '+(picked||'')+(picked===1?' item':' items'))+'</button>')+'</div></footer></div>';
  wire(r);
  if(P){var nb=r.querySelector('[data-pick="'+P.kind+'"]');if(nb){P.btn=nb;nb.setAttribute('aria-expanded','true');P.opts=options(P.kind);fillPick();}else closePick();}
}
function find(id){return D.items.filter(function(i){return String(i.id)===String(id);})[0];}
function wire(r){
  r.querySelectorAll('[data-close]').forEach(function(b){b.onclick=function(){if(!D||!D.busy)close();};});
  r.querySelectorAll('[data-go]').forEach(function(b){b.onclick=function(){var p=b.dataset.go;close();try{if(typeof window.navTo==='function')window.navTo(p);}catch(e){}};});
  r.querySelectorAll('[data-add]').forEach(function(b){b.onclick=function(){var k=b.dataset.add,t=new Date(),dt=iso(t.getFullYear(),t.getMonth(),t.getDate());D.items.push({id:++uid,on:true,kind:k,title:'',date:dt,start:'',end:'',endDate:'',etype:'meeting',snippet:'',status:'ready',error:'',found:'',where:'',cal:true,ds:!!(D.owner&&k==='event')});paint();var ins=r.querySelectorAll('.mp-title');if(ins.length)ins[ins.length-1].focus();};});
  r.querySelectorAll('[data-rm]').forEach(function(b){b.onclick=function(){D.items=D.items.filter(function(i){return String(i.id)!==b.dataset.rm;});paint();};});
  r.querySelectorAll('.mp-seg [data-kind]').forEach(function(b){b.onclick=function(){var i=find(b.closest('.mp-row').dataset.id);if(!i)return;i.kind=b.dataset.kind;paint();};});
  r.querySelectorAll('.mp-row [data-k]').forEach(function(el){
    var ev=el.type==='text'?'input':'change';
    el.addEventListener(ev,function(){var i=find(el.closest('.mp-row').dataset.id);if(!i)return;var k=el.dataset.k;i[k]=el.type==='checkbox'?el.checked:el.value;i.error='';if(k==='on'){paint();}else if(k==='date'){var row=el.closest('.mp-row'),w=row.querySelector('.mp-bad');if(w&&/Pick a date/.test(w.textContent)&&i.date)w.remove();}});
  });
  r.querySelectorAll('[data-pick]').forEach(function(b){b.onclick=function(){openPick(b.dataset.pick,b);};});
  var s=r.querySelector('[data-save]');if(s)s.onclick=save;
}
function startIso(i){var p=i.date.split('-'),t=i.start?i.start.split(':'):['12','00'];return new Date(+p[0],+p[1]-1,+p[2],+t[0],+t[1]).toISOString();}
function endIso(i){
  if(!i.start)return null;
  var p=(i.endDate||i.date).split('-'),t=i.end?i.end.split(':'):null,s=i.start.split(':');
  var e=t?new Date(+p[0],+p[1]-1,+p[2],+t[0],+t[1]):new Date(+p[0],+p[1]-1,+p[2],+s[0]+1,+s[1]);
  var st=new Date(startIso(i));if(e<=st)e=new Date(st.getTime()+3600000);return e.toISOString();
}
function notesFor(i){var c=D.ctx;return 'From email: '+(c.subject||'(no subject)')+(c.fromName||c.from?' — '+(c.fromName||'')+(c.from?' <'+c.from+'>':''):'')+(i.snippet?'\n\n“'+i.snippet+'”':'');}
async function saveOne(i){
  var tz='';try{tz=Intl.DateTimeFormat().resolvedOptions().timeZone||'';}catch(e){}
  if(i.kind==='event'){
    if(!i.date)throw new Error('Pick a date for this event.');
    var toDs=!!(D.owner&&i.ds);
    if(!i.cal&&!toDs)throw new Error('Choose where to add it: Model Agenda or My DaySilk.');
    if(i.cal&&!i.calDone){
    var body={action:'create_event',title:i.title.trim(),starts_at:startIso(i),ends_at:endIso(i)||(i.endDate&&i.endDate>i.date?new Date(+i.endDate.slice(0,4),+i.endDate.slice(5,7)-1,+i.endDate.slice(8,10),23,59).toISOString():null),all_day:!i.start,timezone:tz||null,status:'scheduled',event_type:i.etype||'meeting',calendar_event_type:i.etype||'meeting',notes:notesFor(i),model_ids:D.model?[D.model]:[],location:i.where||null};
    var r=await post('/api/agent/calendar/v9',body);if(!r||r.verified!==true)throw new Error('The calendar did not confirm the save.');
    i.calDone=true;}
    if(toDs&&!i.dsDone){
      var e2='';if(i.start){var sp=i.start.split(':'),mins=(+sp[0])*60+(+sp[1])+60;e2=i.end||pad(Math.min(23,Math.floor(mins/60)))+':'+pad(mins>=1440?59:mins%60);}
      try{await window.MDV_DS_EMBED.addEvents([{id:'mp'+Date.now().toString(36)+Math.random().toString(36).slice(2,5),title:i.title.trim(),d:i.date,t:i.start||'',e:e2,cat:i.etype==='travel'?'travel':'connect',rep:'',where:i.where||'',notes:notesFor(i)}]);i.dsDone=true;}
      catch(err){throw new Error((i.calDone?'Added to the calendar, but not to DaySilk: ':'Not added to DaySilk: ')+((err&&err.message)||'try again.'));}
    }
  }else{
    var due=null;if(i.date){var p=i.date.split('-'),t=i.start?i.start.split(':'):['12','00'];due=new Date(+p[0],+p[1]-1,+p[2],+t[0],+t[1]).toISOString();}
    var tb={action:'create_task',title:i.title.trim(),description:notesFor(i),priority:'normal',category:null,due_at:due,model_id:D.model||null,member_ids:D.assignee?[D.assignee]:[]};
    var rt=await post('/api/agent/tasks/v11',tb);if(!rt||rt.verified!==true)throw new Error('Tasks did not confirm the save.');
  }
}
async function save(){
  if(!D||D.busy)return;
  var todo=D.items.filter(function(i){return i.on&&i.status!=='done';});
  var bad=false;todo.forEach(function(i){if(!i.title.trim()){i.error='Add a title.';bad=true;}else if(i.kind==='event'&&!i.date){i.error='Pick a date for an event.';bad=true;}else i.error='';});
  if(bad){paint();return;}
  D.busy=true;paint();
  var ok=0,fail=0;
  for(var n=0;n<todo.length;n++){
    var i=todo[n];i.status='saving';paint();
    try{await saveOne(i);i.status='done';i.error='';ok++;}catch(e){i.status='ready';i.error=(e&&e.message)||'Could not add this.';fail++;}
    paint();
  }
  D.busy=false;paint();
  toast(ok?(ok+' item'+(ok===1?'':'s')+' added'+(fail?'; '+fail+' could not be added.':'.')):'Nothing was added. Check the messages in the list.');
}

function open(ctx){
  ctx=ctx||{};if(D)close();
  var ownerP=(window.MDV_DS_EMBED&&MDV_DS_EMBED.prepare)?MDV_DS_EMBED.prepare().catch(function(){return {owner:false};}):Promise.resolve({owner:false});
  var items=[];try{items=detect(ctx);}catch(e){items=[];}
  D={ctx:ctx,items:items,model:'',assignee:'',busy:false};
  document.addEventListener('keydown',onKey);paint();
  ownerP.then(function(r){if(!D)return;D.owner=!!(r&&r.owner);if(D.owner)D.items.forEach(function(i){if(i.kind==='event'&&i.start&&i.on)i.ds=true;});paint();});
  loadModels().then(function(list){if(!D)return;var g=guessModel(ctx,arr(list));if(g){D.guess=g.id;if(!D.model)D.model=g.id;}paint();});
  loadMembers().then(function(list){if(!D)return;var me=activeMembers(list).filter(function(m){return m.user_id&&m.user_id===myId();})[0];if(me&&!D.assignee)D.assignee=me.id;paint();});
}
window.MDV_MAILPLAN={open:open,detect:detect,close:close,state:function(){return D;}};
})();
