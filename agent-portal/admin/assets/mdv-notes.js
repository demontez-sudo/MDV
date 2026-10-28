/* Smart Notes: one notes system for the whole portal.
   - A note can be attached to anything (model, contact, company, booking, casting, package, scout record, a page) and to several things at once.
   - While you type it reads the note: names of models, contacts and companies become connections, @teammates are mentioned,
     #tags and topic words become tags, dates become a follow-up, "todo" lines become tasks you can create in one click.
   - The Notes page shows everything with filters; the slide-over (button, or Ctrl/Cmd+Shift+N) shows the notes for whatever you are looking at.
   Data: /api/agent/notes (table smart_notes; setup SQL in docs/sql/2026-10-18-smart-notes.sql). */
(function(){
'use strict';
if(window.MDV_NOTES)return;

var KINDS={note:['Note','ti-note'],call:['Call','ti-phone'],meeting:['Meeting','ti-users'],decision:['Decision','ti-gavel'],idea:['Idea','ti-bulb'],update:['Update','ti-refresh']};
var LINKS={model:['Model','ti-user','#c9a66b'],contact:['Contact','ti-address-book','#8fb7e8'],company:['Company','ti-building','#8fd1a8'],booking:['Booking','ti-calendar-event','#8fd1a8'],casting:['Casting','ti-video','#c7a2ee'],package:['Package','ti-box','#c9a66b'],task:['Task','ti-checkbox','#f0b35a'],scout:['Scout record','ti-user-search','#c9a66b'],page:['Page','ti-layout','#a89f92']};
var TOPICS=[['legal',/\b(contract|agreement|exclusiv|terms|signed|signature|nda)\b/i],['finance',/\b(invoice|payment|paid|owed|fee|rate|commission|payout|budget|deposit)\b/i],['travel',/\b(visa|passport|flight|hotel|travel|trip|airport|housing|apartment)\b/i],['booking',/\b(casting|booking|option|hold|callback|fitting|shoot|show)\b/i],['materials',/\b(polaroid|digitals?|portfolio|photos?|headshot|comp card|book)\b/i],['measurements',/\b(measurement|height|waist|hips|bust|chest|shoe size)\b/i],['scouting',/\b(scout|scouting|prospect|mother agent|interest call)\b/i],['follow-up',/\b(follow[- ]?up|circle back|chase|remind)\b/i],['urgent',/\b(urgent|asap|immediately|deadline|today)\b/i]];
var S={dir:null,dirAt:0,notes:[],me:null,loaded:false,loading:false,err:null,setup:null,scope:'all',kind:'all',q:'',link:null,host:null,timer:null,badge:0,seen:0,replyOpen:null,editing:null};

function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
function arr(v){return Array.isArray(v)?v:[];}
function bridge(){var b=window.VEUX_AGENT_V4;if(!b||!b.api)throw new Error('Secure session is not ready');return b;}
function org(){try{return bridge().state.org.slug||'maison-de-veux';}catch(e){return 'maison-de-veux';}}
function msg(e){return (e&&e.message)||String(e||'Something went wrong');}
function toast(m,bad){var o=document.querySelector('.nt-toast');if(o)o.remove();var d=document.createElement('div');d.className='nt-toast'+(bad?' bad':'');d.textContent=m;document.body.appendChild(d);setTimeout(function(){d.remove();},4200);}
function get(qs){return bridge().api('/api/agent/notes?organization='+encodeURIComponent(org())+(qs?'&'+qs:'')+'&_t='+Date.now(),{method:'GET',headers:{},__fresh:true});}
function post(b){return bridge().api('/api/agent/notes',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(Object.assign({organization_slug:org()},b)),__fresh:true});}
function initials(n){return String(n||'?').replace(/[^A-Za-z0-9 ]/g,'').split(/\s+/).filter(Boolean).slice(0,2).map(function(x){return x[0];}).join('').toUpperCase()||'?';}
function norm(s){return String(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/\s+/g,' ').trim();}

/* ---------- time ---------- */
function ago(v){if(!v)return '';var t=new Date(v).getTime();if(!t)return '';var s=Math.max(0,Math.round((Date.now()-t)/1000));if(s<60)return 'just now';if(s<3600)return Math.floor(s/60)+'m ago';if(s<86400)return Math.floor(s/3600)+'h ago';var d=Math.floor(s/86400);if(d<14)return d+'d ago';if(d<60)return Math.floor(d/7)+'w ago';return Math.floor(d/30)+'mo ago';}
function dayKey(v){var d=new Date(v);return d.getFullYear()+'-'+d.getMonth()+'-'+d.getDate();}
function dayLabel(v){var d=new Date(v),t=new Date(),y=new Date(Date.now()-864e5);if(dayKey(d)===dayKey(t))return 'Today';if(dayKey(d)===dayKey(y))return 'Yesterday';return d.toLocaleDateString([],{weekday:'long',month:'short',day:'numeric',year:d.getFullYear()===t.getFullYear()?undefined:'numeric'});}
function shortDate(v){var d=new Date(v);return isNaN(d)?'':d.toLocaleDateString([],{weekday:'short',month:'short',day:'numeric'});}
function dueState(v){var d=new Date(v);if(isNaN(d))return '';var t0=new Date();t0.setHours(0,0,0,0);var n=Math.round((new Date(d).setHours(0,0,0,0)-t0)/864e5);return n<0?'bad':n<=1?'warn':'';}
function inDays(n){var d=new Date();d.setDate(d.getDate()+n);d.setHours(9,0,0,0);return d.toISOString();}

/* ---------- reading a date out of text ---------- */
var MON=['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'],WD=['sun','mon','tue','wed','thu','fri','sat'];
function parseWhen(s){
  s=String(s||'').toLowerCase();var n=new Date();n.setHours(9,0,0,0);var d=null,m;
  if(/\b(today|tonight|this evening)\b/.test(s))d=new Date(n);
  else if(/\btomorrow\b/.test(s)){d=new Date(n);d.setDate(d.getDate()+1);}
  else if((m=s.match(/\bin (\d{1,2}) (day|days|week|weeks|month|months)\b/))){d=new Date(n);var k=+m[1];if(/week/.test(m[2]))d.setDate(d.getDate()+7*k);else if(/month/.test(m[2]))d.setMonth(d.getMonth()+k);else d.setDate(d.getDate()+k);}
  else if(/\bnext week\b/.test(s)){d=new Date(n);d.setDate(d.getDate()+7);}
  else if(/\bnext month\b/.test(s)){d=new Date(n);d.setMonth(d.getMonth()+1);}
  else if((m=s.match(/\b(mon(?:day)?|tue(?:s|sday)?|wed(?:nesday)?|thu(?:r|rs|rsday)?|fri(?:day)?|sat(?:urday)?|sun(?:day)?)\b/))){var idx=WD.indexOf(m[1].slice(0,3));d=new Date(n);var diff=(idx-d.getDay()+7)%7;if(diff===0)diff=7;d.setDate(d.getDate()+diff);}
  else if((m=s.match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(\d{1,2})(?:st|nd|rd|th)?\b/))){d=new Date(n.getFullYear(),MON.indexOf(m[1]),+m[2],9,0,0);if(d<new Date(Date.now()-864e5))d.setFullYear(d.getFullYear()+1);}
  else if((m=s.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/))){var yr=m[3]?(+m[3]<100?2000+(+m[3]):+m[3]):n.getFullYear();d=new Date(yr,+m[1]-1,+m[2],9,0,0);if(!m[3]&&d<new Date(Date.now()-864e5))d.setFullYear(d.getFullYear()+1);}
  return d&&!isNaN(d)?d.toISOString():null;
}

/* ---------- reading the note ---------- */
function dirList(){return S.dir||{members:[],models:[],contacts:[],companies:[]};}
function nameIndex(){
  if(S.dir&&S.dir.__idx)return S.dir.__idx;
  var d=dirList(),idx={full:[],first:{}};
  function add(type,list){list.forEach(function(x){var nm=norm(x.name);if(nm.length<4)return;idx.full.push({type:type,id:x.id,label:x.name,n:nm,words:nm.split(' ').length});
    if(type==='model'){var f=nm.split(' ')[0];if(f.length>=4)(idx.first[f]=idx.first[f]||[]).push({type:type,id:x.id,label:x.name});}});}
  add('model',d.models);add('contact',d.contacts);add('company',d.companies);
  idx.full.sort(function(a,b){return b.n.length-a.n.length;});
  if(S.dir)S.dir.__idx=idx;return idx;
}
function wordAt(hay,needle){var i=-1;while((i=hay.indexOf(needle,i+1))>=0){var a=hay[i-1],b=hay[i+needle.length];if((!a||!/[a-z0-9]/.test(a))&&(!b||!/[a-z0-9]/.test(b)))return true;}return false;}
function analyze(text,have){
  text=String(text||'');var low=norm(text),out={links:[],suggest:[],mentions:[],tags:[],tasks:[],follow_up:null,kind:'note',title:'',priority:''};
  var haveKey={};arr(have).forEach(function(l){haveKey[l.type+':'+l.id]=1;});
  /* names of models, contacts and companies */
  var idx=nameIndex(),used=low;
  idx.full.forEach(function(e){
    if(haveKey[e.type+':'+e.id])return;
    if(e.type==='contact'&&e.words<2)return;                       /* a contact's first name alone is too ambiguous */
    if(e.type==='company'&&e.words<2&&e.n.length<5)return;
    if(wordAt(used,e.n)){out.links.push({type:e.type,id:e.id,label:e.label});haveKey[e.type+':'+e.id]=1;used=used.split(e.n).join(' ');}
  });
  /* a first name on its own: suggest it, but do not attach it */
  var words=low.split(/[^a-z0-9'-]+/).filter(function(w){return w.length>=4;});
  words.forEach(function(w){var c=idx.first[w];if(c&&c.length===1&&!haveKey[c[0].type+':'+c[0].id]&&wordAt(used,w)){out.suggest.push(c[0]);haveKey[c[0].type+':'+c[0].id]=1;}});
  /* teammates */
  dirList().members.forEach(function(m){
    var first=norm(m.name).split(' ')[0],re=new RegExp('@'+first.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'(?![a-z0-9])','i');
    if(first&&re.test(text)||new RegExp('@'+norm(m.name).replace(/\s+/g,'\\s?'),'i').test(low))out.mentions.push({user_id:m.user_id,name:m.name});
  });
  /* tags: #words and topic words */
  (text.match(/#([a-z0-9_-]{2,30})/gi)||[]).forEach(function(t){out.tags.push(t.slice(1).toLowerCase());});
  TOPICS.forEach(function(t){if(t[1].test(text)&&out.tags.indexOf(t[0])<0)out.tags.push(t[0]);});
  out.tags=out.tags.slice(0,8);
  /* tasks: lines that read like something to do */
  var lines=text.split(/\n/);
  var EXPL=/^\s*(?:[-*•]\s*)?(?:\[\s?\]\s*|(?:todo|to-do|action|task|follow[- ]?up|remind(?:er)?(?: me)?(?: to)?)\b\s*[:\-–]?\s*)/i,STRIP=/^\s*(?:[-*•]\s*)?(?:\[\s?\]\s*|(?:todo|to-do|action|task)\b\s*[:\-–]?\s*)/i,FU=/^\s*(?:[-*•]\s*)?(?:follow[- ]?up|remind(?:er)?(?: me)?(?: to)?)\b/i;
  var VERB=/^\s*(?:[-*•]\s*)?(send|call|email|book|confirm|schedule|check|chase|ask|share|update|prepare|arrange|collect|renew|invoice|submit|contact)\b(?!\s+(?:with|from|about|back)\b)/i;
  lines.forEach(function(ln){
    var t=ln.trim();if(t.length<6||t.length>220)return;
    var inl=!EXPL.test(ln)&&t.match(/\b(?:todo|to-do|action|reminder)\s*:\s*([^\n]{4,160})$/i);
    if(inl){var it=inl[1].replace(/[.\s]+$/,'').trim();out.tasks.push({title:it.charAt(0).toUpperCase()+it.slice(1,140),due:parseWhen(inl[1]),on:true});return;}
    var ex=EXPL.test(ln),vb=VERB.test(ln)&&!/\b(had|was|were|did|just|already|yesterday|spoke|told)\b/i.test(t);if(!ex&&!vb)return;
    var title=(FU.test(ln)?t.replace(/^[-*•]\s*/,''):t.replace(STRIP,'').replace(/^[-*•]\s*/,'')).trim();if(title.length<4)title=t;
    out.tasks.push({title:title.charAt(0).toUpperCase()+title.slice(1,140),due:parseWhen(t),on:ex});
  });
  out.tasks=out.tasks.slice(0,6);
  /* follow-up: an explicit "follow up / remind" line with a date, else the earliest task date */
  var fu=null;lines.forEach(function(ln){if(!fu&&/follow[- ]?up|remind|circle back|check back/i.test(ln)){var w=parseWhen(ln);if(w)fu=w;}});
  if(!fu){var ds=out.tasks.map(function(t){return t.due;}).filter(Boolean).sort();if(ds.length)fu=ds[0];}
  out.follow_up=fu;
  /* what kind of note is it */
  var first=lines[0]||'';
  out.kind=/^\s*(call|called|spoke|phoned|phone call)\b/i.test(first)||/\b(spoke (to|with)|had a call|phoned)\b/i.test(text)?'call':/\b(meeting|met with|catch[- ]?up|sat down)\b/i.test(text)?'meeting':/\b(decided|decision|agreed|we will|approved)\b/i.test(text)?'decision':/\b(idea|what if|we could|maybe we)\b/i.test(text)?'idea':'note';
  if(/\b(urgent|asap|immediately)\b/i.test(text))out.priority='high';
  if(lines.length>1&&first.length<=90)out.title=first.replace(/^#+\s*/,'');
  return out;
}

/* ---------- context: what is the person looking at? ---------- */
function modelIdNow(){return window._veuxV10ModelId||window._openModelId||null;}
function context(){
  var p=String(window._currentPage||'overview');
  if(window.MDV_SCOUT_RECORDS&&MDV_SCOUT_RECORDS.current&&MDV_SCOUT_RECORDS.current()){var sh=document.querySelector('#sr-modal .sr-rt h2');return {type:'scout',id:String(MDV_SCOUT_RECORDS.current()),label:sh?sh.textContent.trim():'Scout record'};}
  if(p==='modelpage'){var id=modelIdNow();if(id){var h=document.querySelector('#p-modelpage .m360-title h1');return {type:'model',id:String(id),label:h?h.textContent.trim():'This model'};}}
  if(p==='clientbook'&&window.MDV_CONTACTS&&MDV_CONTACTS.state&&MDV_CONTACTS.state.prof){var pr=MDV_CONTACTS.state.prof,h2=document.querySelector('#p-clientbook h1,#p-clientbook .ct h1');return {type:pr.kind==='company'?'company':'contact',id:String(pr.id),label:h2?h2.textContent.trim():(pr.kind==='company'?'This company':'This contact')};}
  var titles={overview:'Home',tasksconsolidated:'Tasks',mail:'Mail',calendar:'Calendar',roster:'Roster',scouting:'Scouting',industrydirectory:'Clients',outreach:'Outreach',multipackage:'Packages',financelegal:'Finance & Legal',seasonmanagement:'Season',notes:'Notes'};
  return {type:'page',id:p,label:titles[p]||p.replace(/([a-z])([A-Z])/g,'$1 $2')};
}
function sameLink(a,b){return a&&b&&a.type===b.type&&String(a.id)===String(b.id);}

/* ---------- connections: open the thing a note is about ---------- */
function openLink(l){
  try{
    if(l.type==='model'){window._veuxV10ModelId=l.id;window._openModelId=l.id;closePanel();if(typeof window.navTo==='function')window.navTo('modelpage');}
    else if(l.type==='contact'||l.type==='company'){closePanel();if(window.MDV_CONTACTS&&MDV_CONTACTS.show)MDV_CONTACTS.show(l.type+':'+l.id);}
    else if(l.type==='scout'){closePanel();if(typeof window.navTo==='function')window.navTo('scouting');setTimeout(function(){if(window.MDV_SCOUT_RECORDS&&MDV_SCOUT_RECORDS.open)MDV_SCOUT_RECORDS.open(l.id);},600);}
    else if(l.type==='page'){closePanel();if(typeof window.navTo==='function')window.navTo(l.id);}
    else if(l.type==='task'){closePanel();if(typeof window.navTo==='function')window.navTo('tasksconsolidated');}
    else if(l.type==='package'){closePanel();if(typeof window.navTo==='function')window.navTo('multipackage');}
    else toast('Open it from the calendar.');
  }catch(e){toast(msg(e),true);}
}

/* ---------- data ---------- */
async function load(opts){
  opts=opts||{};if(S.loading)return S.loading;
  S.loading=(async function(){
    try{
      var qs=[];if(!S.dir||opts.dir||Date.now()-S.dirAt>600000)qs.push('directory=1');
      var d=await get(qs.join('&'));
      S.notes=arr(d.notes);S.me=d.me||S.me;S.err=null;S.setup=null;S.loaded=true;S.at=Date.now();
      if(d.directory){S.dir=d.directory;S.dirAt=Date.now();}
    }catch(e){
      if(e&&e.code==='SMART_NOTES_TABLE_MISSING'||/SMART_NOTES_TABLE_MISSING|needs its database table/i.test(msg(e)))S.setup=true;else S.err=msg(e);
    }
    S.loading=false;badge();
  })();
  return S.loading;
}
function mentionsMe(n){return S.me&&arr(n.mentions).some(function(m){return m.user_id===S.me.id;});}
function badge(){
  var due=0,men=0,now=Date.now();
  S.notes.forEach(function(n){if(n.resolved)return;if(n.follow_up_at&&new Date(n.follow_up_at).getTime()<=now+864e5)due++;if(mentionsMe(n)&&n.author_id!==(S.me&&S.me.id)&&new Date(n.created_at).getTime()>S.seen)men++;});
  var v=due+men;if(v!==S.badge){S.badge=v;try{window.dispatchEvent(new CustomEvent('mdv:notes-badge'));}catch(e){}}
}
try{S.seen=Number(localStorage.getItem('mdv-nt-seen'))||0;}catch(e){}
function markSeen(){S.seen=Date.now();try{localStorage.setItem('mdv-nt-seen',String(S.seen));}catch(e){}badge();}

/* ---------- the composer (used on the page and in the slide-over) ---------- */
function newCompose(ctx){return {text:'',links:ctx?[Object.assign({},ctx)]:[],dismissed:{},vis:'team',kind:'auto',follow:null,followSet:false,taskOff:{},ctx:ctx||null,busy:false};}
function chip(l,rm){var m=LINKS[l.type]||LINKS.page;return '<span class="nt-chip lk" style="--c:'+m[2]+'"><i class="ti '+m[1]+'"></i>'+esc(l.label||m[0])+(rm?'<button type="button" data-rm="'+esc(l.type+':'+l.id)+'" aria-label="Remove">×</button>':'')+'</span>';}
function composerHtml(C,id){
  return '<section class="nt-comp" data-c="'+id+'"><textarea class="nt-ta" rows="3" placeholder="Write a note. Name a model, contact or company to connect it, @ a teammate, add #tags. Start a line with “todo” to make it a task.">'+esc(C.text)+'</textarea><div class="nt-live"></div>'
   +'<div class="nt-bar"><label class="nt-sel"><i class="ti ti-eye"></i><select data-vis><option value="team">Team can see</option><option value="private">Only me</option><option value="model">Shareable with the model</option></select></label>'
   +'<label class="nt-sel"><i class="ti ti-tag"></i><select data-kind><option value="auto">Type: auto</option>'+Object.keys(KINDS).map(function(k){return '<option value="'+k+'">'+KINDS[k][0]+'</option>';}).join('')+'</select></label><span class="nt-sp"></span><button type="button" class="nt-btn gold" data-save>Save note</button></div></section>';
}
function liveHtml(C,A){
  var h='';
  var all=C.links.concat(A.links);
  if(all.length)h+='<div class="nt-row"><b>Connected to</b>'+all.map(function(l){return chip(l,true);}).join('')+'</div>';
  if(A.suggest.length)h+='<div class="nt-row"><b>Did you mean</b>'+A.suggest.map(function(l){var m=LINKS[l.type];return '<button type="button" class="nt-chip sg" data-add="'+esc(l.type+':'+l.id)+'" data-label="'+esc(l.label)+'"><i class="ti ti-plus"></i>'+esc(l.label)+'</button>';}).join('')+'</div>';
  if(A.mentions.length)h+='<div class="nt-row"><b>Mentions</b>'+A.mentions.map(function(m){return '<span class="nt-chip mn"><i class="ti ti-at"></i>'+esc(m.name)+'</span>';}).join('')+'</div>';
  if(A.tags.length)h+='<div class="nt-row"><b>Tags</b>'+A.tags.map(function(t){return '<span class="nt-chip tg">#'+esc(t)+'</span>';}).join('')+'</div>';
  var fu=C.followSet?C.follow:A.follow_up;
  h+='<div class="nt-row"><b>Follow-up</b>'+(fu?'<span class="nt-chip fu '+dueState(fu)+'"><i class="ti ti-bell"></i>'+esc(shortDate(fu))+'<button type="button" data-fu-clear aria-label="Clear">×</button></span>':'')+'<select class="nt-fu" data-fu><option value="">'+(fu?'Change…':'Remind me…')+'</option><option value="1">Tomorrow</option><option value="3">In 3 days</option><option value="7">In a week</option><option value="14">In 2 weeks</option></select></div>';
  if(A.tasks.length)h+='<div class="nt-row col"><b>Tasks I found</b>'+A.tasks.map(function(t,i){return '<label class="nt-task"><input type="checkbox" data-task="'+i+'"'+(C.taskOff[i]===undefined?(t.on?' checked':''):(C.taskOff[i]?'':' checked'))+'> <span>'+esc(t.title)+'</span>'+(t.due?'<em>'+esc(shortDate(t.due))+'</em>':'')+'</label>';}).join('')+'<small>Ticked tasks are created for you when you save.</small></div>';
  var kind=C.kind==='auto'?A.kind:C.kind;
  h+='<div class="nt-row dim">Reads like a <b>'+esc((KINDS[kind]||KINDS.note)[0].toLowerCase())+'</b>'+(A.priority?' · <b>high priority</b>':'')+'</div>';
  return h;
}
/* wires one composer; getC() returns its state; onSaved runs after a note is saved */
function wireComposer(root,C,onSaved){
  var ta=root.querySelector('.nt-ta'),live=root.querySelector('.nt-live'),t;
  var vs=root.querySelector('[data-vis]'),ks=root.querySelector('[data-kind]');vs.value=C.vis;ks.value=C.kind;
  function refresh(){
    C.text=ta.value;var dis=Object.keys(C.dismissed).map(function(k){var p=k.split(':');return {type:p[0],id:p.slice(1).join(':')};});var A=C._A=analyze(C.text,C.links.concat(dis));
    /* exact name matches are attached for you, unless you removed them */
    live.innerHTML=liveHtml(C,A);
    live.querySelectorAll('[data-rm]').forEach(function(b){b.onclick=function(){var k=b.dataset.rm;C.links=C.links.filter(function(l){return l.type+':'+l.id!==k;});C.dismissed[k]=1;refresh();};});
    live.querySelectorAll('[data-add]').forEach(function(b){b.onclick=function(){var p=b.dataset.add.split(':');C.links.push({type:p[0],id:p.slice(1).join(':'),label:b.dataset.label});refresh();};});
    var fc=live.querySelector('[data-fu-clear]');if(fc)fc.onclick=function(){C.followSet=true;C.follow=null;refresh();};
    var fs=live.querySelector('[data-fu]');if(fs)fs.onchange=function(){if(fs.value){C.followSet=true;C.follow=inDays(+fs.value);refresh();}};
    live.querySelectorAll('[data-task]').forEach(function(c){c.onchange=function(){C.taskOff[c.dataset.task]=!c.checked;};});
  }
  ta.oninput=function(){clearTimeout(t);t=setTimeout(refresh,180);};
  vs.onchange=function(){C.vis=vs.value;};ks.onchange=function(){C.kind=ks.value;};
  ta.addEventListener('keydown',function(e){if((e.metaKey||e.ctrlKey)&&e.key==='Enter'){e.preventDefault();save();}});
  async function save(){
    if(C.busy)return;C.text=ta.value;var text=C.text.trim();if(!text){toast('Write something first.',true);return;}
    var dis2=Object.keys(C.dismissed).map(function(k){var p=k.split(':');return {type:p[0],id:p.slice(1).join(':')};});var A=analyze(text,C.links.concat(dis2)),btn=root.querySelector('[data-save]');
    var links=C.links.concat(A.links);
    var fu=C.followSet?C.follow:A.follow_up;
    C.busy=true;btn.disabled=true;btn.textContent='Saving…';
    var made=[];
    try{
      /* tasks first, so the note can say which ones it created */
      for(var i=0;i<A.tasks.length;i++){
        var on=C.taskOff[i]===undefined?A.tasks[i].on:!C.taskOff[i];if(!on)continue;
        var model=links.filter(function(l){return l.type==='model';})[0];
        try{
          var r=await bridge().api('/api/agent/tasks/v11',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({organization_slug:org(),action:'create_task',title:A.tasks[i].title,description:'From a note: '+text.slice(0,240),priority:A.priority||'normal',due_at:A.tasks[i].due||null,model_id:model?model.id:null,member_ids:S.me&&S.me.member_id?[S.me.member_id]:[]}),__fresh:true});
          if(r&&r.task)made.push({id:r.task.id,title:A.tasks[i].title});
        }catch(e){toast('A task could not be created: '+msg(e),true);}
      }
      var r2=await post({action:'create',body:text,title:A.title,kind:C.kind==='auto'?A.kind:C.kind,visibility:C.vis,links:links,mentions:A.mentions,tags:A.tags,follow_up_at:fu,smart:{priority:A.priority||null,tasks:made,suggested_tasks:A.tasks.length}});
      if(!r2||r2.verified!==true)throw new Error('The note was not confirmed as saved.');
      S.notes.unshift(r2.note);badge();
      toast('✓ Note saved'+(links.length?' · connected to '+links.length:'')+(made.length?' · '+made.length+' task'+(made.length===1?'':'s')+' created':''));
      var ctx=C.ctx;Object.assign(C,newCompose(ctx));
      if(onSaved)onSaved(r2.note);
    }catch(e){toast(msg(e),true);C.busy=false;btn.disabled=false;btn.textContent='Save note';}
  }
  root.querySelector('[data-save]').onclick=save;
  refresh();
}

/* ---------- a note ---------- */
function bodyHtml(t){
  return esc(t).replace(/\n/g,'<br>').replace(/(^|\s|>)#([a-z0-9_-]{2,30})/gi,'$1<span class="nt-ht">#$2</span>').replace(/(^|\s|>)@([A-Za-z][\w.'-]*)/g,'$1<span class="nt-hm">@$2</span>').replace(/(^|<br>)\s*(?:[-*•]\s*)?\[ \]/g,'$1<span class="nt-cb">☐</span>').replace(/(^|<br>)\s*(?:[-*•]\s*)?\[x\]/gi,'$1<span class="nt-cb on">☑</span>');
}
function noteHtml(n,replies,compact){
  var k=KINDS[n.kind]||KINDS.note,mine=S.me&&n.author_id===S.me.id,hl=mentionsMe(n)&&!mine;
  var chips=arr(n.links).map(function(l){var m=LINKS[l.type]||LINKS.page;return '<span class="nt-chip lk" style="--c:'+m[2]+'"><button type="button" class="nt-lkf" data-f="'+esc(l.type+':'+l.id)+'" data-l="'+esc(l.label||'')+'" title="Show every note connected to this">'+'<i class="ti '+m[1]+'"></i>'+esc(l.label||m[0])+'</button><button type="button" class="nt-lko" data-o="'+esc(l.type+':'+l.id)+'" aria-label="Open" title="Open">↗</button></span>';}).join('');
  var tags=arr(n.tags).map(function(t){return '<span class="nt-chip tg">#'+esc(t)+'</span>';}).join('');
  var fu=n.follow_up_at&&!n.resolved?'<span class="nt-chip fu '+dueState(n.follow_up_at)+'"><i class="ti ti-bell"></i>'+esc(shortDate(n.follow_up_at))+'</span>':'';
  var tk=arr(n.smart&&n.smart.tasks).length?'<span class="nt-chip tk"><i class="ti ti-checkbox"></i>'+n.smart.tasks.length+' task'+(n.smart.tasks.length===1?'':'s')+' created</span>':'';
  var vis=n.visibility==='private'?'<span class="nt-chip vs"><i class="ti ti-lock"></i>Only author</span>':n.visibility==='model'?'<span class="nt-chip vs"><i class="ti ti-share"></i>Shareable with model</span>':'';
  var editing=S.editing===n.id;
  return '<article class="nt-note'+(n.pinned?' pin':'')+(n.resolved?' done':'')+(hl?' hl':'')+'" data-id="'+esc(n.id)+'"><header><span class="nt-av">'+esc(initials(n.author_name))+'</span><div class="nt-by"><b>'+esc(n.author_name||'Team')+'</b><small><i class="ti '+k[1]+'"></i>'+esc(k[0])+' · '+esc(ago(n.created_at))+'</small></div>'+(n.pinned?'<i class="ti ti-pin-filled nt-pn" title="Pinned"></i>':'')+'</header>'
   +(n.title?'<h4>'+esc(n.title)+'</h4>':'')
   +(editing?'<textarea class="nt-edit" rows="5">'+esc(n.body)+'</textarea><div class="nt-acts"><button type="button" class="nt-btn sm gold" data-esave>Save</button><button type="button" class="nt-btn sm" data-ecancel>Cancel</button></div>':'<div class="nt-body">'+bodyHtml(n.title&&n.body.indexOf(n.title)===0?n.body.slice(n.title.length).replace(/^\s+/,''):n.body)+'</div>')
   +((chips||tags||fu||tk||vis)?'<div class="nt-chips">'+chips+fu+tk+tags+vis+'</div>':'')
   +(compact?'':'<footer class="nt-acts"><button type="button" data-a="pin">'+(n.pinned?'Unpin':'Pin')+'</button><button type="button" data-a="resolve">'+(n.resolved?'Reopen':'Mark done')+'</button><button type="button" data-a="reply">Reply</button><button type="button" data-a="veuxi"><i class="ti ti-sparkles"></i> Ask Veux</button>'+(mine?'<button type="button" data-a="edit">Edit</button><button type="button" data-a="del" class="danger">Delete</button>':'')+'</footer>')
   +(arr(replies).length?'<div class="nt-replies">'+replies.map(function(r){return '<div class="nt-rep"><b>'+esc(r.author_name||'Team')+'</b> <small>'+esc(ago(r.created_at))+'</small><div>'+bodyHtml(r.body)+'</div></div>';}).join('')+'</div>':'')
   +(S.replyOpen===n.id?'<div class="nt-replybox"><textarea rows="2" placeholder="Reply…" data-rtext></textarea><button type="button" class="nt-btn sm gold" data-rsend>Send</button></div>':'')+'</article>';
}
function wireNotes(root,rerender){
  root.querySelectorAll('.nt-lkf').forEach(function(b){b.onclick=function(){var p=b.dataset.f.split(':');S.link={type:p[0],id:p.slice(1).join(':'),label:b.dataset.l};S.scope='all';if(rerender)rerender();};});
  root.querySelectorAll('.nt-lko').forEach(function(b){b.onclick=function(){var p=b.dataset.o.split(':');var n=b.closest('.nt-note');var note=S.notes.filter(function(x){return x.id===(n&&n.dataset.id);})[0];var l=note&&arr(note.links).filter(function(x){return x.type===p[0]&&String(x.id)===p.slice(1).join(':');})[0];openLink(l||{type:p[0],id:p.slice(1).join(':')});};});
  root.querySelectorAll('.nt-note').forEach(function(card){
    var id=card.dataset.id,note=S.notes.filter(function(x){return x.id===id;})[0];if(!note)return;
    card.querySelectorAll('[data-a]').forEach(function(b){b.onclick=async function(){
      var a=b.dataset.a;
      try{
        if(a==='pin'){var r=await post({action:'pin',id:id,pinned:!note.pinned});Object.assign(note,r.note);}
        else if(a==='resolve'){var r2=await post({action:'resolve',id:id,resolved:!note.resolved});Object.assign(note,r2.note);}
        else if(a==='reply'){S.replyOpen=S.replyOpen===id?null:id;}
        else if(a==='edit'){S.editing=id;}
        else if(a==='del'){if(!window.confirm('Delete this note?'))return;await post({action:'archive',id:id});S.notes=S.notes.filter(function(x){return x.id!==id&&x.parent_id!==id;});toast('Note deleted');}
        else if(a==='veuxi'){askVeuxi('Help me with this note and what to do next.\n\n'+note.body+(arr(note.links).length?'\n\nConnected to: '+note.links.map(function(l){return l.label;}).join(', '):''));return;}
        badge();if(rerender)rerender();
      }catch(e){toast(msg(e),true);}
    };});
    var es=card.querySelector('[data-esave]');if(es)es.onclick=async function(){var t=card.querySelector('.nt-edit').value;try{var r=await post({action:'update',id:id,body:t});Object.assign(note,r.note);S.editing=null;toast('✓ Saved');if(rerender)rerender();}catch(e){toast(msg(e),true);}};
    var ec=card.querySelector('[data-ecancel]');if(ec)ec.onclick=function(){S.editing=null;if(rerender)rerender();};
    var rs=card.querySelector('[data-rsend]');if(rs)rs.onclick=async function(){var t=card.querySelector('[data-rtext]').value.trim();if(!t)return;try{var r=await post({action:'create',body:t,parent_id:id,visibility:note.visibility,links:[]});S.notes.push(r.note);S.replyOpen=null;if(rerender)rerender();}catch(e){toast(msg(e),true);}};
  });
}
function askVeuxi(prompt){
  try{if(window.MDV_VEUXI_CHAT&&MDV_VEUXI_CHAT.open){MDV_VEUXI_CHAT.open(prompt);return;}}catch(e){}
  toast('Veux is not available right now.',true);
}
function repliesOf(id){return S.notes.filter(function(n){return n.parent_id===id;}).sort(function(a,b){return new Date(a.created_at)-new Date(b.created_at);});}
function setupHtml(){
  return '<div class="nt-setup"><i class="ti ti-database-cog"></i><h3>One-time setup</h3><p>Smart Notes needs its database table. An admin runs the SQL file once in the Supabase SQL editor, then this page works for everyone.</p><p class="nt-file"><code>agent-portal/docs/sql/2026-10-18-smart-notes.sql</code></p><button type="button" class="nt-btn" data-retry>Check again</button></div>';
}

/* ---------- the Notes page ---------- */
function filtered(){
  var q=norm(S.q),now=Date.now(),me=S.me||{};
  return S.notes.filter(function(n){
    if(n.parent_id)return false;
    if(S.link&&!arr(n.links).some(function(l){return l.type===S.link.type&&String(l.id)===String(S.link.id);}))return false;
    if(S.kind!=='all'&&n.kind!==S.kind)return false;
    if(S.scope==='mine'&&n.author_id!==me.id)return false;
    if(S.scope==='mentions'&&!mentionsMe(n))return false;
    if(S.scope==='followups'&&!(n.follow_up_at&&!n.resolved))return false;
    if(S.scope==='pinned'&&!n.pinned)return false;
    if(S.scope==='private'&&n.visibility!=='private')return false;
    if(S.scope==='unlinked'&&arr(n.links).filter(function(l){return l.type!=='page';}).length)return false;
    if(q&&norm([n.title,n.body,n.author_name,arr(n.tags).join(' '),arr(n.links).map(function(l){return l.label;}).join(' ')].join(' ')).indexOf(q)<0)return false;
    return true;
  }).sort(function(a,b){if(S.scope==='followups')return new Date(a.follow_up_at)-new Date(b.follow_up_at);return (b.pinned?1:0)-(a.pinned?1:0)||new Date(b.created_at)-new Date(a.created_at);});
}
var PC=newCompose(null),pageHost=null;
function kpis(){
  var now=Date.now(),root=S.notes.filter(function(n){return !n.parent_id;});
  var due=root.filter(function(n){return n.follow_up_at&&!n.resolved&&new Date(n.follow_up_at).getTime()<=now+864e5;}).length;
  var men=root.filter(function(n){return mentionsMe(n)&&!n.resolved;}).length;
  var wk=root.filter(function(n){return new Date(n.created_at).getTime()>now-7*864e5;}).length;
  var unl=root.filter(function(n){return !arr(n.links).filter(function(l){return l.type!=='page';}).length;}).length;
  return {due:due,men:men,pin:root.filter(function(n){return n.pinned;}).length,wk:wk,unl:unl,total:root.length};
}
function topLinks(){
  var m={};S.notes.forEach(function(n){arr(n.links).forEach(function(l){if(l.type==='page')return;var k=l.type+':'+l.id;var o=m[k]||(m[k]={type:l.type,id:l.id,label:l.label,n:0});o.n++;});});
  return Object.keys(m).map(function(k){return m[k];}).sort(function(a,b){return b.n-a.n;}).slice(0,7);
}
function paintPage(){
  var el=pageHost;if(!el||!el.isConnected)return;
  var k=kpis(),list=S.loaded?filtered():[],now=Date.now();
  var scopes=[['all','All'],['mine','Mine'],['mentions','Mentions'+(k.men?' <i>'+k.men+'</i>':'')],['followups','Follow-ups'+(k.due?' <i>'+k.due+'</i>':'')],['pinned','Pinned'],['private','Private'],['unlinked','Unconnected'+(k.unl?' <i>'+k.unl+'</i>':'')]];
  var keep=el.querySelector('.nt-ta'),ctxSel=PC;
  var feed='';
  if(S.setup)feed=setupHtml();
  else if(S.err)feed='<p class="nt-err">'+esc(S.err)+' <button type="button" class="nt-link" data-retry>Try again</button></p>';
  else if(!S.loaded)feed='<p class="nt-empty">Loading your notes…</p>';
  else if(!list.length)feed='<div class="nt-empty big"><i class="ti ti-notes"></i><h3>'+(S.notes.length?'No notes match.':'No notes yet')+'</h3><p>'+(S.notes.length?'Try a different filter.':'Write the first one above. Name a model, a contact or a company and it connects itself.')+'</p></div>';
  else{var day='';feed=list.map(function(n){var k2=dayKey(n.created_at),h='';if(S.scope!=='followups'&&k2!==day){day=k2;h='<h3 class="nt-day">'+esc(dayLabel(n.created_at))+'</h3>';}return h+noteHtml(n,repliesOf(n.id));}).join('');}
  var tl=topLinks();
  var due=S.notes.filter(function(n){return !n.parent_id&&n.follow_up_at&&!n.resolved;}).sort(function(a,b){return new Date(a.follow_up_at)-new Date(b.follow_up_at);}).slice(0,5);
  var side='<aside class="nt-side"><section class="nt-card"><h3><i class="ti ti-sparkles"></i> Veux</h3><div class="nt-veuxi">'
   +'<button type="button" data-v="week">Summarise this week’s notes</button><button type="button" data-v="follow">What needs a follow-up?</button><button type="button" data-v="team">What does the team need to know?</button></div></section>'
   +'<section class="nt-card"><h3>Most connected</h3>'+(tl.length?'<div class="nt-top">'+tl.map(function(l){var m=LINKS[l.type]||LINKS.page;return '<button type="button" data-f="'+esc(l.type+':'+l.id)+'" data-l="'+esc(l.label||'')+'"><i class="ti '+m[1]+'" style="color:'+m[2]+'"></i><span>'+esc(l.label||m[0])+'</span><em>'+l.n+'</em></button>';}).join('')+'</div>':'<p class="nt-mute">Connections appear as you write.</p>')+'</section>'
   +'<section class="nt-card"><h3>Coming up</h3>'+(due.length?'<ul class="nt-fl">'+due.map(function(n){return '<li data-jump="'+esc(n.id)+'"><span class="nt-chip fu '+dueState(n.follow_up_at)+'"><i class="ti ti-bell"></i>'+esc(shortDate(n.follow_up_at))+'</span><span>'+esc((n.title||n.body).slice(0,70))+'</span></li>';}).join('')+'</ul>':'<p class="nt-mute">No follow-ups set.</p>')+'</section></aside>';
  el.innerHTML='<div class="nt"><header class="nt-head"><div><small>SMART NOTES</small><h1>Everything the team knows, connected</h1><p>Write once. Notes link themselves to models, contacts and companies, remind you to follow up, turn to-dos into tasks and show up wherever they matter.</p></div></header>'
   +'<div class="nt-kpis"><button type="button" data-s="followups"><b>'+k.due+'</b><span>Follow-ups due</span></button><button type="button" data-s="mentions"><b>'+k.men+'</b><span>Mention you</span></button><button type="button" data-s="pinned"><b>'+k.pin+'</b><span>Pinned</span></button><button type="button" data-s="all"><b>'+k.wk+'</b><span>This week</span></button></div>'
   +'<div class="nt-cols"><div class="nt-main">'+composerHtml(PC,'pg')
   +'<div class="nt-filters"><label class="nt-search"><i class="ti ti-search"></i><input data-q type="search" placeholder="Search notes, people, tags…" value="'+esc(S.q)+'" autocomplete="off"></label><select data-kindf><option value="all">All types</option>'+Object.keys(KINDS).map(function(x){return '<option value="'+x+'"'+(S.kind===x?' selected':'')+'>'+KINDS[x][0]+'</option>';}).join('')+'</select></div>'
   +'<nav class="nt-tabs">'+scopes.map(function(s){return '<button type="button" data-s="'+s[0]+'" class="'+(S.scope===s[0]?'on':'')+'">'+s[1]+'</button>';}).join('')+'</nav>'
   +(S.link?'<div class="nt-lf">Showing notes connected to '+chip(S.link,false)+' <button type="button" class="nt-link" data-clearlink>Show all</button></div>':'')
   +'<div class="nt-feed">'+feed+'</div></div>'+side+'</div></div>';
  wireComposer(el.querySelector('.nt-comp'),PC,function(){paintPage();});
  var q=el.querySelector('[data-q]');if(q)q.oninput=function(){S.q=q.value;clearTimeout(S.qt);S.qt=setTimeout(function(){var pos=q.selectionStart;paintPage();var n=el.querySelector('[data-q]');if(n){n.focus();try{n.setSelectionRange(pos,pos);}catch(e){}}},180);};
  var kf=el.querySelector('[data-kindf]');if(kf)kf.onchange=function(){S.kind=kf.value;paintPage();};
  el.querySelectorAll('[data-s]').forEach(function(b){b.onclick=function(){S.scope=b.dataset.s;S.link=null;paintPage();};});
  var cl=el.querySelector('[data-clearlink]');if(cl)cl.onclick=function(){S.link=null;paintPage();};
  el.querySelectorAll('.nt-top [data-f]').forEach(function(b){b.onclick=function(){var p=b.dataset.f.split(':');S.link={type:p[0],id:p.slice(1).join(':'),label:b.dataset.l};S.scope='all';paintPage();};});
  el.querySelectorAll('[data-retry]').forEach(function(b){b.onclick=function(){load({dir:true}).then(paintPage);};});
  el.querySelectorAll('[data-jump]').forEach(function(li){li.onclick=function(){var c=el.querySelector('.nt-note[data-id="'+li.dataset.jump+'"]');if(c)c.scrollIntoView({behavior:'smooth',block:'center'});else{S.scope='followups';paintPage();}};});
  el.querySelectorAll('[data-v]').forEach(function(b){b.onclick=function(){
    var recent=S.notes.filter(function(n){return !n.parent_id;}).slice(0,25).map(function(n){return '- '+(n.author_name||'Team')+' ('+ago(n.created_at)+'): '+n.body.replace(/\s+/g,' ').slice(0,300)+(arr(n.links).length?' ['+n.links.map(function(l){return l.label;}).join(', ')+']':'');}).join('\n');
    var p={week:'Summarise what the team noted recently and what matters most.',follow:'From these notes, what needs a follow-up and who should do it?',team:'What does the whole team need to know from these notes?'}[b.dataset.v];
    askVeuxi(p+'\n\nNotes:\n'+recent);};});
  wireNotes(el.querySelector('.nt-feed'),paintPage);
}
window.renderNotes=function(el){
  pageHost=el;S.host=el;paintPage();markSeen();
  return load({dir:true}).then(function(){paintPage();});
};

/* ---------- the slide-over ---------- */
var PNC=null,panelCtx=null;
function ensureFab(){
  if(document.getElementById('nt-fab')||document.documentElement.classList.contains('is-login'))return;
  var b=document.createElement('button');b.id='nt-fab';b.type='button';b.setAttribute('aria-label','Notes for this page');b.title='Notes (Ctrl/Cmd+Shift+N)';b.innerHTML='<i class="ti ti-notes"></i><span>Notes</span><em hidden></em>';
  b.onclick=function(){togglePanel();};document.documentElement.appendChild(b);
}
function panelNotes(ctx){return S.notes.filter(function(n){return !n.parent_id&&(ctx.type==='page'?arr(n.links).some(function(l){return l.type==='page'&&l.id===ctx.id;}):arr(n.links).some(function(l){return l.type===ctx.type&&String(l.id)===String(ctx.id);}));});}
function paintPanel(){
  var p=document.getElementById('nt-panel');if(!p||!panelCtx)return;
  var ctx=panelCtx,list=panelNotes(ctx),m=LINKS[ctx.type]||LINKS.page;
  var keepText=PNC&&PNC.text;
  p.innerHTML='<header><div><small>NOTES</small><h2><i class="ti '+m[1]+'" style="color:'+m[2]+'"></i> '+esc(ctx.label||m[0])+'</h2></div><button type="button" class="nt-x" data-x aria-label="Close">×</button></header>'
   +'<div class="nt-pbody">'+(S.setup?setupHtml():composerHtml(PNC,'pn')+'<div class="nt-phead"><b>'+list.length+' note'+(list.length===1?'':'s')+' here</b>'+(list.length?'<button type="button" class="nt-link" data-all>See in Notes</button>':'<button type="button" class="nt-link" data-all>Open all notes</button>')+'</div><div class="nt-feed">'+(!S.loaded?'<p class="nt-empty">Loading…</p>':list.length?list.map(function(n){return noteHtml(n,repliesOf(n.id),false);}).join(''):'<p class="nt-empty">Nothing written about this yet. Be the first.</p>')+'</div>')+'</div>';
  p.querySelector('[data-x]').onclick=closePanel;
  var all=p.querySelector('[data-all]');if(all)all.onclick=function(){S.link=ctx.type==='page'?null:{type:ctx.type,id:ctx.id,label:ctx.label};S.scope='all';closePanel();if(typeof window.navTo==='function')window.navTo('notes');};
  var rt=p.querySelector('[data-retry]');if(rt)rt.onclick=function(){load({dir:true}).then(paintPanel);};
  var comp=p.querySelector('.nt-comp');if(comp){wireComposer(comp,PNC,function(){paintPanel();});}
  wireNotes(p.querySelector('.nt-feed')||p,paintPanel);
}
function openPanel(ctx){
  ctx=ctx||context();
  if(!panelCtx||!sameLink(panelCtx,ctx)||!PNC){PNC=newCompose(ctx.type==='page'?{type:'page',id:ctx.id,label:ctx.label}:ctx);}
  panelCtx=ctx;
  var p=document.getElementById('nt-panel');
  if(!p){p=document.createElement('aside');p.id='nt-panel';p.setAttribute('role','dialog');p.setAttribute('aria-label','Notes');document.documentElement.appendChild(p);}
  p.classList.add('open');document.documentElement.classList.add('nt-open');
  paintPanel();
  load().then(function(){if(p.classList.contains('open'))paintPanel();});
  setTimeout(function(){var t=p.querySelector('.nt-ta');if(t&&!t.value)t.focus();},120);
}
function closePanel(){var p=document.getElementById('nt-panel');if(p)p.classList.remove('open');document.documentElement.classList.remove('nt-open');}
function togglePanel(){var p=document.getElementById('nt-panel');if(p&&p.classList.contains('open'))closePanel();else openPanel(context());}
document.addEventListener('keydown',function(e){
  if((e.metaKey||e.ctrlKey)&&e.shiftKey&&(e.key==='N'||e.key==='n')){e.preventDefault();togglePanel();return;}
  if(e.key==='Escape'){var p=document.getElementById('nt-panel');if(p&&p.classList.contains('open')&&!document.querySelector('[data-mdv-dlg],.sr-back,.ct-back')){closePanel();}}
});
/* any element can open notes for a record: <button data-mdv-note='{"type":"model","id":"…","label":"…"}'> */
document.addEventListener('click',function(e){
  var b=e.target.closest&&e.target.closest('[data-mdv-note]');if(!b)return;
  e.preventDefault();var c=null;try{c=JSON.parse(b.getAttribute('data-mdv-note'));}catch(x){}
  openPanel(c&&c.type?c:context());
},true);

/* ---------- keep the count fresh ---------- */
function ready(){return window.VEUX_AGENT_V4&&VEUX_AGENT_V4.api&&document.getElementById('app')&&getComputedStyle(document.getElementById('app')).display!=='none';}
function tick(){
  if(!ready())return;ensureFab();
  var onNotes=String(window._currentPage||'')==='notes';
  if(!S.loaded&&!S.loading&&!S.setup)load({dir:true});
  else if(!document.hidden&&!S.loading&&Date.now()-(S.at||0)>120000){S.at=Date.now();load().then(function(){if(onNotes)paintPage();});}
  if(onNotes&&S.loaded)markSeen();
}
S.at=Date.now();
setInterval(tick,5000);
function slide(){var f=document.getElementById('nt-fab');if(!f)return;var em=f.querySelector('em');if(em){em.hidden=!S.badge;em.textContent=S.badge>99?'99+':S.badge;}}
window.addEventListener('mdv:notes-badge',slide);
(function register(){
  function put(){var m=window.VEUX_V15_ROUTE_RENDERERS;if(m&&typeof m==='object'){m.notes=function(el){return window.renderNotes(el);};return true;}return false;}
  if(put())return;var n=0,t=setInterval(function(){if(put()||++n>400)clearInterval(t);},150);
  ['veux:shell-ready','veux:assets-ready','veux:auth-ready'].forEach(function(e){window.addEventListener(e,put);});
})();
window.MDV_NOTES={open:openPanel,close:closePanel,context:context,badge:function(){return S.badge;},analyze:analyze,state:S,render:window.renderNotes};
})();
