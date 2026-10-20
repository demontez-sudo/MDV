/* Scout Records — a smart scouting pipeline.
   Scouted → Emailed model → Emailed MA → Interest call scheduled → Interest call done → Test → Offer → Contract → Signed.
   Each step opens the form that belongs to it (basic details first, then outreach, the interest-call questionnaire with
   walk and posing, the deal, and finally the merge into the model profile). Everything is stored on the prospect
   (metadata.scout) through /api/agent/scouting/v9, so it connects straight to the model profile when they sign. */
(function(){
'use strict';
if(window.__MDV_SR__)return;window.__MDV_SR__=true;

/* ---------- the pipeline ---------- */
var STEPS=[
  {k:'scouted',label:'Scouted',stage:'new_lead',tab:'profile',icon:'ti-eye'},
  {k:'emailed_model',label:'Emailed model',stage:'contacted',tab:'outreach',icon:'ti-mail'},
  {k:'emailed_ma',label:'Emailed MA',stage:'contacted',tab:'outreach',icon:'ti-building'},
  {k:'call_scheduled',label:'Interest call scheduled',stage:'meeting_scheduled',tab:'call',icon:'ti-phone-call'},
  {k:'call_done',label:'Interest call done',stage:'meeting_scheduled',tab:'call',icon:'ti-circle-check'},
  {k:'offer',label:'Offer',stage:'offer',tab:'deal',icon:'ti-file-description'},
  {k:'contract',label:'Contract sent',stage:'contract_sent',tab:'deal',icon:'ti-signature'},
  {k:'signed',label:'Signed',stage:'signed',tab:'deal',icon:'ti-rosette-discount-check'},
  /* the test / go-see happens once the contract is signed (it keeps the Signed stage in the database) */
  {k:'test',label:'Test / go-see',stage:'signed',tab:'deal',icon:'ti-camera'}
];
var IDX={};STEPS.forEach(function(s,i){IDX[s.k]=i;});
var TERMINAL={development:'Transferred',roster:'Transferred',declined:'Declined'};
var TABS=[['profile','Profile'],['outreach','Outreach'],['call','Interest call'],['deal','Deal & merge'],['timeline','Timeline']];

/* ---------- the interest call (questions to ask, walk and posing included) ---------- */
var CALL=[
  {id:'warm',title:'Warm-up & motivation',say:'Introduce yourself and the agency, thank them for their time and keep it relaxed. Let them talk.',qs:[
    {k:'from',t:'ta',l:'Tell us about yourself: where are you from, and where do you live now?'},
    {k:'why',t:'ta',l:'Why modeling, and why now?'},
    {k:'goals',t:'ta',l:'Where do they want to be in 12–24 months?'},
    {k:'know_us',t:'ta',l:'What do they know about Maison de Veux, and what made them reply?'},
    {k:'commit',t:'rate',l:'How committed do they sound?'}]},
  {id:'exp',title:'Experience & presence',say:'Ask about work they are proud of. Note anything they can send as proof.',qs:[
    {k:'shoots',t:'ta',l:'Shoots, campaigns or editorials so far?'},
    {k:'runway',t:'ta',l:'Runway or show experience?'},
    {k:'training',t:'ta',l:'Training, classes or coaching?'},
    {k:'social',t:'tx',l:'Instagram / TikTok following and the kind of content they post'}]},
  {id:'rep',title:'Representation & contracts',say:'Always check this before going further. If they have a mother agent we speak to them first.',qs:[
    {k:'current_agency',t:'tx',l:'Currently represented? By whom, and where?'},
    {k:'contract_status',t:'sel',o:['No representation','Non-exclusive','Exclusive elsewhere','Not sure'],l:'Contract status'},
    {k:'ma_status',t:'sel',o:['Not applicable','MA is aware','MA approved','MA not told yet','MA declined'],l:'Mother agent (MA) status'},
    {k:'conflicts',t:'ta',l:'Past contracts, exclusivity or conflicts we should know about'}]},
  {id:'logi',title:'Logistics & availability',say:'Practical questions: can they actually take work and travel?',qs:[
    {k:'availability',t:'ta',l:'Availability and typical schedule'},
    {k:'school_work',t:'ta',l:'School or work commitments'},
    {k:'travel',t:'sel',o:['Local only','Open to travel','Ready to relocate','Needs discussion'],l:'Travel & relocation'},
    {k:'passport',t:'sel',o:['Valid passport','Expired','No passport','Applying'],l:'Passport'},
    {k:'visa',t:'tx',l:'Work authorization / visa (US, UK, EU)'},
    {k:'address',t:'tx',l:'Mailing address (for contracts and travel documents)'},
    {k:'support',t:'ta',l:'Who supports them (family, partner, friends)? Any concerns?'}]},
  {id:'body',title:'Measurements (as stated)',say:'Ask them to measure standing straight, no shoes. Note “approximate” if they are guessing.',measure:true},
  {id:'walk',title:'Walk',say:'Ask them to walk 5–6 steps toward the camera, turn, and walk back, in the shoes they would normally wear. Ask what their walk feels like to them first.',walk:true},
  {id:'pose',title:'Posing',say:'Ask for a neutral stand, three-quarter turn, profile, hands in different positions, and one “mood” pose each for editorial and commercial. Let them move naturally between poses.',pose:true},
  {id:'wrap',title:'Wrap-up & recommendation',say:'Explain the next steps and the timeline. Thank them. Then score honestly.',wrap:true}
];
var WALK_R=[['posture','Posture & alignment'],['stride','Stride & rhythm'],['turn','Turn / pivot'],['move','Shoulder & hip movement'],['eye','Eye line & presence'],['conf','Confidence & energy']];
var POSE_R=[['stance','Neutral stance'],['hands','Hand & arm placement'],['angles','Angles (3/4, profile)'],['face','Expression range'],['flow','Flow between poses'],['camera','Camera awareness']];
var POSES=[['neutral','Neutral stand'],['three','3/4 turn'],['profile','Profile'],['hands','Hands in pockets / on hips'],['seated','Seated'],['editorial','Editorial mood'],['commercial','Commercial / smiling']];
var DIGITALS=[['front','Full length front'],['side','Full length side'],['back','Full length back'],['close','Close-up, no makeup'],['three','3/4 portrait'],['profile','Profile']];
var WRAP_R=[['look','Look & market fit'],['comm','Communication'],['prof','Professionalism'],['coach','Coachability']];
/* Full measurements. Stored once on the record (profile.measurements) and shared by the Profile tab, the interest call and the merge into the model profile. */
var MEAS_CORE=[['height','Height','len'],['bust_chest','Bust / chest','len'],['waist','Waist','len'],['hips','Hips','len'],['inseam','Inseam','len'],['neck','Neck','len'],['sleeve','Sleeve','len'],['shoulder','Shoulder width','len']];
var MEAS_SIZE=[['dress','Dress size',''],['suit','Suit / jacket',''],['shoe','Shoe size',''],['cup','Cup / bra',''],['collar','Collar','']];
var MEAS_LOOK=[['hair','Hair colour',''],['hair_length','Hair length',''],['eyes','Eye colour',''],['skin','Skin tone',''],['marks','Tattoos / piercings / scars','']];
var MEASURE=MEAS_CORE.concat(MEAS_SIZE,MEAS_LOOK);
var RECS=['','Advance to test','Develop first','Hold','Pass'];

var R={legal:null,legalAt:0,data:null,view:'board',q:'',flt:'all',id:null,tab:'profile',sc:null,dirty:{},timer:null,saving:false,saved:false,call:{i:0},busy:false};

/* ---------- small helpers ---------- */
function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
function arr(v){return Array.isArray(v)?v:[];}
function bridge(){var b=window.VEUX_AGENT_V4;if(!b||!b.api)throw new Error('Secure session is not ready');return b;}
function org(){try{return bridge().state.org.slug||'maison-de-veux';}catch(e){return 'maison-de-veux';}}
function get(){return bridge().api('/api/agent/scouting/v9?organization='+encodeURIComponent(org())+'&_t='+Date.now(),{method:'GET',headers:{},__fresh:true});}
function post(body){return bridge().api('/api/agent/scouting/v9',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(Object.assign({organization_slug:org()},body)),__fresh:true});}
function msg(e){return (e&&e.message)||String(e||'Something went wrong');}
function toast(m,bad){var o=document.querySelector('.sr-toast');if(o)o.remove();var d=document.createElement('div');d.className='sr-toast'+(bad?' bad':'');d.textContent=m;document.body.appendChild(d);setTimeout(function(){d.remove();},3600);}
function nowIso(){return new Date().toISOString();}
function fmt(v,time){if(!v)return '';var d=new Date(v);if(isNaN(d))return '';return time?d.toLocaleString([],{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}):d.toLocaleDateString([],{month:'short',day:'numeric',year:'numeric'});}
function days(v){if(!v)return null;var d=new Date(v);if(isNaN(d))return null;return Math.floor((Date.now()-d.getTime())/864e5);}
function localInput(v){if(!v)return '';var d=new Date(v);if(isNaN(d))return '';var p=function(n){return String(n).padStart(2,'0');};return d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate())+'T'+p(d.getHours())+':'+p(d.getMinutes());}
function initials(n){return String(n||'?').split(/\s+/).filter(Boolean).slice(0,2).map(function(x){return x[0];}).join('').toUpperCase()||'?';}
function first(n){return String(n||'').trim().split(/\s+/)[0]||'there';}
function lookups(){return (R.data&&R.data.lookups)||{};}
function prospects(){return arr(R.data&&R.data.prospects);}
function byId(id){return prospects().filter(function(p){return p.id===id;})[0]||null;}
function scoutOf(p){return (p&&p.metadata&&p.metadata.scout)||{};}
function clone(o){try{return JSON.parse(JSON.stringify(o||{}));}catch(e){return {};}}
function getPath(o,path){return path.split('.').reduce(function(a,k){return a==null?undefined:a[k];},o);}
function setPath(o,path,v){var ks=path.split('.'),a=o;for(var i=0;i<ks.length-1;i++){if(a[ks[i]]==null||typeof a[ks[i]]!=='object')a[ks[i]]={};a=a[ks[i]];}a[ks[ks.length-1]]=v;}
/* ---- measurements ---- */
function num(v){var m=String(v==null?'':v).replace(',','.').match(/-?\d+(\.\d+)?/);return m?Number(m[0]):null;}
function toCm(v,units){
  var t=String(v==null?'':v).trim();if(!t)return null;
  var ft=t.match(/(\d+)\s*(?:'|′|ft|feet|foot)\s*(\d+(?:\.\d+)?)?/i);
  if(ft)return Math.round((Number(ft[1])*12+Number(ft[2]||0))*2.54*10)/10;
  var n=num(t);if(n==null)return null;
  if(/cm/i.test(t))return n;
  if(/\bin\b|inch|"|″/i.test(t))return Math.round(n*2.54*10)/10;
  return units==='in'?Math.round(n*2.54*10)/10:n;
}
function convText(v,units){
  var cm=toCm(v,units);if(cm==null||cm<=0)return '';
  if(units==='in'){return cm.toFixed(1).replace(/\.0$/,'')+' cm';}
  var totalIn=cm/2.54,ft=Math.floor(totalIn/12),inch=Math.round((totalIn-ft*12)*10)/10;
  return (cm>=120?ft+'\u2032'+String(inch).replace(/\.0$/,'')+'\u2033 · ':'')+(Math.round(totalIn*10)/10)+' in';
}
function measOf(p){
  var sc=R.sc||{},pf=sc.profile||{},own=pf.measurements,c=(sc.call||{}).measurements||{};
  var app=(p.metadata&&p.metadata.application)||{},am=app.measurements||{};
  if(own&&typeof own==='object')return own;
  /* first time: bring over what they put on the application and anything entered on the old call form */
  var m={units:app.units==='in'||app.units==='imperial'?'in':'cm'};
  var map={height:am.height,bust_chest:am.bust_chest,waist:am.waist,hips:am.hips,shoe:am.shoe,dress:am.dress_suit,cup:am.cup,hair:am.hair,eyes:am.eyes,inseam:am.inseam,neck:am.neck,sleeve:am.sleeve};
  Object.keys(map).forEach(function(k){if(map[k])m[k]=map[k];});
  var legacy={height:c.height_cm,bust_chest:c.bust_cm,waist:c.waist_cm,hips:c.hips_cm,shoe:c.shoe,dress:c.dress,hair:c.hair,eyes:c.eyes,skin:c.skin,marks:c.marks};
  Object.keys(legacy).forEach(function(k){if(legacy[k]&&!m[k])m[k]=legacy[k];});
  if(!m.height&&p.height_display)m.height=p.height_display;
  if(c.how)m.how=c.how;
  m.__seeded=Object.keys(am).length?'application':'';
  return m;
}
function ageOf(p){
  if(p.date_of_birth){var d=new Date(p.date_of_birth);if(!isNaN(d)){var n=new Date(),a=n.getFullYear()-d.getFullYear();if(n<new Date(n.getFullYear(),d.getMonth(),d.getDate()))a--;return a;}}
  return p.age_reported!=null?Number(p.age_reported):null;
}
function isMinor(p){var a=ageOf(p);return a!=null&&a<18;}
function stepOf(p){
  var st=String(p.stage||'new_lead');
  if(TERMINAL[st])return st==='declined'?'declined':'transferred';
  if(st==='test_requested')return 'call_done';   /* older records that were put at "test" before the contract step */
  var s=scoutOf(p).step;
  if(s&&IDX[s]!=null&&STEPS[IDX[s]].stage===st)return s;
  for(var i=0;i<STEPS.length;i++)if(STEPS[i].stage===st)return STEPS[i].k;
  return 'scouted';
}
function isSigned(k){return IDX[k]!=null&&IDX[k]>=IDX.signed;}
function stepLabel(k){return k==='transferred'?'Transferred':k==='declined'?'Declined':(STEPS[IDX[k]]||{}).label||k;}
function avg(list){var n=list.filter(function(x){return typeof x==='number'&&x>0;});return n.length?Math.round(n.reduce(function(a,b){return a+b;},0)/n.length*10)/10:null;}
function scores(sc){
  var c=(sc&&sc.call)||{},w=c.walk&&c.walk.ratings||{},po=c.pose&&c.pose.ratings||{},wr=c.wrap&&c.wrap.ratings||{};
  var walk=avg(WALK_R.map(function(x){return Number(w[x[0]]);})),pose=avg(POSE_R.map(function(x){return Number(po[x[0]]);})),wrap=avg(WRAP_R.map(function(x){return Number(wr[x[0]]);}));
  return {walk:walk,pose:pose,wrap:wrap,overall:avg([walk,pose,wrap])};
}
function answeredCount(sc){
  var c=(sc&&sc.call)||{},a=c.answers||{},n=0,t=0;
  CALL.forEach(function(s){arr(s.qs).forEach(function(q){t++;if(a[q.k]!=null&&String(a[q.k]).trim()!==''&&a[q.k]!==0)n++;});});
  var m=measOf(R.id?byId(R.id)||{}:{});['height','bust_chest','waist','hips','shoe'].forEach(function(k){t++;if(m[k])n++;});
  var sc2=scores(sc);[sc2.walk,sc2.pose,sc2.wrap].forEach(function(x){t++;if(x)n++;});
  return {done:n,total:t};
}

/* ---------- smart "what next" for each prospect ---------- */
function nextAction(p){
  var k=stepOf(p),sc=scoutOf(p),o=sc.outreach||{},m=o.model||{},ma=o.ma||{},c=sc.call||{};
  var hasContact=!!(p.email||p.phone||p.instagram);
  if(k==='declined')return {t:'Declined',c:'muted'};
  if(k==='transferred')return {t:'On the board',c:'good'};
  if(k==='scouted')return hasContact?{t:'Email the model',c:'go'}:{t:'Add contact details',c:'warn'};
  if(k==='emailed_model'){var d=days(m.emailed_at);return d!=null&&d>=3?{t:'Follow up · '+d+'d quiet',c:'warn'}:{t:'Waiting for a reply',c:'muted'};}
  if(k==='emailed_ma'){var d2=days(ma.emailed_at);return d2!=null&&d2>=4?{t:'Chase MA · '+d2+'d',c:'warn'}:{t:'Schedule interest call',c:'go'};}
  if(k==='call_scheduled'){
    if(!c.scheduled_at)return {t:'Pick a call time',c:'warn'};
    var diff=new Date(c.scheduled_at)-Date.now();
    if(diff<-36e5)return {t:'Call time passed · log it',c:'warn'};
    if(diff<864e5)return {t:'Call '+fmt(c.scheduled_at,true),c:'go'};
    return {t:'Call '+fmt(c.scheduled_at,true),c:'muted'};
  }
  if(k==='call_done'){var rec=c.wrap&&c.wrap.recommendation;return rec?{t:rec,c:/pass/i.test(rec)?'muted':'go'}:{t:'Add recommendation',c:'warn'};}
  if(k==='test')return {t:'Test / go-see in progress',c:'go'};
  if(k==='offer')return {t:'Send offer',c:'go'};
  if(k==='contract')return {t:'Chase signature',c:'warn'};
  if(k==='signed')return {t:'Book the test or merge into profile',c:'go'};
  return {t:'',c:'muted'};
}
function quiet(p){var d=days(p.updated_at);return d!=null&&d>=10&&!TERMINAL[p.stage]&&p.stage!=='signed';}

/* ---------- the page ---------- */
var HOST=null;
function filtered(){
  var q=R.q.toLowerCase();
  return prospects().filter(function(p){
    if(R.flt==='quiet'&&!quiet(p))return false;
    if(R.flt==='action'&&nextAction(p).c!=='go'&&nextAction(p).c!=='warn')return false;
    if(R.flt!=='all'&&R.flt!=='quiet'&&R.flt!=='action'){var k=stepOf(p);if(k!==R.flt)return false;}
    return !q||[p.display_name,p.city,p.country,p.instagram,p.email,p.phone,p.source].join(' ').toLowerCase().indexOf(q)>-1;
  });
}
function card(p){
  var k=stepOf(p),na=nextAction(p),m=arr(p.scouting_media)[0],ph=m&&m.url,sc=scoutOf(p),s=scores(sc);
  return '<article class="sr-card" data-sr="open" data-id="'+esc(p.id)+'">'
    +(ph?'<span class="sr-ph" style="background-image:url(\''+esc(ph).replace(/'/g,'%27')+'\')"></span>':'<span class="sr-ph ph">'+esc(initials(p.display_name))+'</span>')
    +'<div class="sr-ct"><b>'+esc(p.display_name)+'</b><small>'+esc([p.city,p.country].filter(Boolean).join(', ')||p.instagram||p.email||'')+(p.height_display?' · '+esc(p.height_display):'')+'</small>'
    +'<span class="sr-tags"><span class="sr-next '+na.c+'">'+esc(na.t)+'</span>'
    +(isMinor(p)?'<i class="sr-minor" title="Under 18: guardian consent needed">U18</i>':'')+(quiet(p)?'<i class="sr-quiet" title="No activity for 10+ days">10d quiet</i>':'')+'</span></div>'
    +(s.overall?'<em class="sr-score" title="Interest call score">'+s.overall+'</em>':'')+'</article>';
}
function board(list){
  var cols=STEPS.map(function(s){return {k:s.k,label:s.label,rows:list.filter(function(p){return stepOf(p)===s.k;})};});
  cols.push({k:'transferred',label:'On the board',rows:list.filter(function(p){return stepOf(p)==='transferred';})});
  cols.push({k:'declined',label:'Declined',rows:list.filter(function(p){return stepOf(p)==='declined';})});
  return '<div class="sr-board">'+cols.map(function(c){
    return '<section class="sr-col"><header><b>'+esc(c.label)+'</b><span>'+c.rows.length+'</span></header><div class="sr-cc">'+(c.rows.map(card).join('')||'<p class="sr-none">—</p>')+'</div></section>';
  }).join('')+'</div>';
}
function listView(list){
  return '<div class="sr-list">'+(list.map(function(p){
    var na=nextAction(p);
    return '<button type="button" class="sr-row" data-sr="open" data-id="'+esc(p.id)+'"><span class="sr-ph ph">'+esc(initials(p.display_name))+'</span><span class="sr-rn"><b>'+esc(p.display_name)+'</b><small>'+esc([p.city,p.country].filter(Boolean).join(', ')||p.instagram||'')+'</small></span><span class="sr-rs">'+esc(stepLabel(stepOf(p)))+'</span><span class="sr-next '+na.c+'">'+esc(na.t)+'</span></button>';
  }).join('')||'<p class="sr-none">No scout records match this view.</p>')+'</div>';
}
function pageHtml(){
  var list=filtered(),pros=prospects();
  var inCall=pros.filter(function(p){var k=stepOf(p);return k==='call_scheduled';}).length;
  var act=pros.filter(function(p){var c=nextAction(p).c;return c==='go'||c==='warn';}).length;
  return '<div class="v1686-page v1686-scout sr-page"><header class="v1686-pagehead"><div><small>SCOUTING · TALENT PIPELINE</small><h1>Scout Records</h1><p>From first sighting to the model profile: every step opens the form it needs, and everything carries over when they sign.</p></div><button class="v1686-btn gold" data-sr="new">+ New Prospect</button></header>'
    +'<div class="sr-stats"><div><strong>'+pros.length+'</strong><span>Prospects</span></div><div><strong>'+act+'</strong><span>Need action</span></div><div><strong>'+inCall+'</strong><span>Calls scheduled</span></div><div><strong>'+pros.filter(function(p){return p.stage==='signed'||p.converted_model_id;}).length+'</strong><span>Signed</span></div></div>'
    +'<div class="sr-tools"><label class="sr-search"><i class="ti ti-search"></i><input type="search" placeholder="Search name, city, Instagram…" value="'+esc(R.q)+'" data-sr-q></label>'
    +'<select data-sr-f><option value="all">All steps</option><option value="action"'+(R.flt==='action'?' selected':'')+'>Needs action</option><option value="quiet"'+(R.flt==='quiet'?' selected':'')+'>Quiet 10+ days</option>'+STEPS.map(function(s){return '<option value="'+s.k+'"'+(R.flt===s.k?' selected':'')+'>'+esc(s.label)+'</option>';}).join('')+'</select>'
    +'<div class="sr-seg"><button type="button" data-sr="view" data-v="board" class="'+(R.view==='board'?'on':'')+'">Board</button><button type="button" data-sr="view" data-v="list" class="'+(R.view==='list'?'on':'')+'">List</button></div></div>'
    +(R.view==='board'?board(list):listView(list))+'</div>';
}
async function load(){R.data=await get();return R.data;}
function paintPage(){if(!HOST)return;var q=HOST.querySelector('[data-sr-q]'),had=q&&document.activeElement===q,pos=had?q.selectionStart:0;HOST.innerHTML=pageHtml();wirePage();if(had){var n=HOST.querySelector('[data-sr-q]');if(n){n.focus();try{n.setSelectionRange(pos,pos);}catch(e){}}}}
function wirePage(){
  var q=HOST.querySelector('[data-sr-q]');if(q)q.oninput=function(){R.q=q.value;clearTimeout(R.qt);R.qt=setTimeout(paintPage,200);};
  var f=HOST.querySelector('[data-sr-f]');if(f)f.onchange=function(){R.flt=f.value;paintPage();};
}
async function render(el){
  HOST=el;el.innerHTML='<div class="v1686-page"><div class="v1686-loading">Loading scout records…</div></div>';
  try{await load();paintPage();if(R.id&&byId(R.id)&&document.getElementById('sr-modal'))paintRecord();}
  catch(e){el.innerHTML='<div class="v1686-page"><div class="v1686-error">'+esc(msg(e))+'</div></div>';}
}
document.addEventListener('click',function(e){
  var b=e.target&&e.target.closest&&e.target.closest('#p-scouting [data-sr]');
  if(!b||!HOST)return;
  var a=b.dataset.sr;
  if(a==='view'){R.view=b.dataset.v;paintPage();}
  else if(a==='open')openRecord(b.dataset.id);
  else if(a==='new')newProspect();
});

/* ---------- new prospect: basic details only ---------- */
function modalRoot(){var m=document.getElementById('sr-modal');if(!m){m=document.createElement('div');m.id='sr-modal';m.className='sr-back';document.body.appendChild(m);}return m;}
function closeModal(){
  /* read the About fields while they are still on screen, then save everything before the record is forgotten */
  var pending=[];
  if(R.profDirty){pending.push(saveProfile(true).catch(function(){}));}
  var m=document.getElementById('sr-modal');if(m)m.remove();var c=document.getElementById('sr-call');if(c)c.remove();
  var id=R.id;pending.push(flush());R.id=null;
  Promise.all(pending).then(function(){if(R.failed&&Object.keys(R.dirty).length){toast('Some changes to this record were not saved: '+R.failed,true);}}).catch(function(){});
}
function newProspect(){
  var m=modalRoot();
  m.innerHTML='<section class="sr-dlg sr-small" role="dialog" aria-modal="true" aria-label="New prospect"><header><div><small>SCOUT RECORDS</small><h2>New prospect</h2></div><button type="button" data-x aria-label="Close">×</button></header>'
    +'<div class="sr-body"><p class="sr-lead">Just the basics for now. The rest comes as they move through the steps.</p>'
    +'<div class="sr-grid">'+fld('Name *','n_name','','text','wide')+fld('Instagram','n_ig')+fld('Email','n_email','','email')+fld('Phone','n_phone')+fld('City','n_city')+fld('Country','n_country')+fld('Height','n_height','','text','','5′10″ / 178 cm')+fld('Where did you find them?','n_source','','text','','Street, Instagram, open call…')+'</div>'
    +'<p class="sr-err" id="n_err"></p></div><footer><button type="button" class="sr-btn" data-x>Cancel</button><button type="button" class="sr-btn gold" id="n_save">Add as Scouted</button></footer></section>';
  m.querySelectorAll('[data-x]').forEach(function(x){x.onclick=closeModal;});
  setTimeout(function(){var i=m.querySelector('#n_name');if(i)i.focus();},40);
  m.querySelector('#n_save').onclick=async function(){
    var v=function(id){return String(m.querySelector('#'+id).value||'').trim();},err=m.querySelector('#n_err'),btn=this;
    err.textContent='';if(!v('n_name')){err.textContent='Add a name.';return;}
    btn.disabled=true;btn.textContent='Adding…';
    try{
      var out=await post({action:'create',display_name:v('n_name'),instagram:v('n_ig')||null,email:v('n_email')||null,phone:v('n_phone')||null,city:v('n_city')||null,country:v('n_country')||null,height_display:v('n_height')||null,source:v('n_source')||null,stage:'new_lead'});
      if(!out||out.verified!==true)throw new Error('The record was not confirmed as saved.');
      await post({action:'scout_save',prospect_id:out.prospect.id,scout:{step:'scouted'},log_entry:{type:'created',text:'Scouted'+(v('n_source')?' · '+v('n_source'):'')}});
      toast('✓ Added to Scouted');await load();paintPage();openRecord(out.prospect.id);
    }catch(e){err.textContent=msg(e);btn.disabled=false;btn.textContent='Add as Scouted';}
  };
}
function fld(label,id,val,type,cls,ph,attrs){return '<label class="'+(cls||'')+'"><span>'+esc(label)+'</span><input id="'+id+'" type="'+(type||'text')+'" value="'+esc(val||'')+'"'+(ph?' placeholder="'+esc(ph)+'"':'')+(attrs||'')+' autocomplete="off"></label>';}

/* ---------- the record (opens on the tab that matches the step) ---------- */
function openRecord(id,tab){
  var p=byId(id);if(!p)return;
  flush();
  R.id=id;R.lead=0;R.sc=clone(scoutOf(p));R.dirty={};R.saved=false;
  var k=stepOf(p);var s=STEPS[IDX[k]];
  R.tab=tab||(s?s.tab:'profile');
  paintRecord();
}
function stepper(p){
  var k=stepOf(p),cur=IDX[k];
  return '<ol class="sr-steps">'+STEPS.map(function(s,i){
    var cls=cur==null?(k==='transferred'?'done':''):(i<cur?'done':i===cur?'cur':'');
    return '<li class="'+cls+'"><button type="button" data-go="'+s.k+'" title="Move to '+esc(s.label)+'"><i class="ti '+s.icon+'"></i><span>'+esc(s.label)+'</span></button></li>';
  }).join('')+'</ol>';
}
function paintRecord(){
  var p=byId(R.id);if(!p)return;
  var m=modalRoot(),body=m.querySelector('.sr-main'),scroll=body?body.scrollTop:0;
  var k=stepOf(p),na=nextAction(p),media=arr(p.scouting_media),lead=Math.min(R.lead||0,Math.max(0,media.length-1)),ph=media[lead]&&media[lead].url;
  var idx=IDX[k]==null?(k==='transferred'?STEPS.length:-1):IDX[k];
  var tabs=TABS.filter(function(t){return t[0]!=='call'||idx>=IDX.emailed_model||R.tab==='call';});
  m.innerHTML='<section class="sr-dlg" role="dialog" aria-modal="true" aria-label="Scout record">'
    +'<header class="sr-rh"><span class="sr-ph big'+(ph?'':' ph')+'"'+(ph?' style="background-image:url(\''+esc(String(ph).replace(/'/g,'%27'))+'\')"':'')+'>'+(ph?'':esc(initials(p.display_name)))+'</span>'
    +'<div class="sr-rt"><small>'+esc([p.city,p.country].filter(Boolean).join(', ')||'SCOUT RECORD')+'</small><h2>'+esc(p.display_name)+'</h2><p>'+esc([ageOf(p)!=null?ageOf(p)+' years':'',p.instagram,p.email,p.phone].filter(Boolean).join(' · '))+'</p>'
    +'<span class="sr-chip">'+esc(stepLabel(k))+'</span>'+(isMinor(p)?'<span class="sr-chip warn">Under 18 · guardian consent</span>':'')+'</div><button type="button" class="sr-x" data-x aria-label="Close">×</button></header>'
    +compCard(p)
    +'<div class="sr-next-bar"><span class="sr-next '+na.c+'">'+esc(na.t||'')+'</span><span class="sr-save" id="sr-save">'+(R.saving?'Saving…':R.saved?'Saved':'')+'</span></div>'
    +stepper(p)
    +'<nav class="sr-tabs">'+tabs.map(function(t){return '<button type="button" data-tab="'+t[0]+'" class="'+(R.tab===t[0]?'on':'')+'">'+esc(t[1])+'</button>';}).join('')+'</nav>'
    +'<div class="sr-main">'+tabHtml(p)+'</div></section>';
  var nm=m.querySelector('.sr-main');if(nm)nm.scrollTop=scroll;
  wireRecord(m,p);
}
/* two contracts live on a record: the model's own agreement ('model', stored at contract) and the mother agency's ('ma', stored at contract.ma) */
function cstate(who){var ct=R.sc.contract||{};return who==='ma'?(ct.ma||{}):ct;}
function contractRec(who){var id=cstate(who).contract_id;return id&&R.legal?arr(R.legal.contracts).filter(function(x){return x.id===id;})[0]||null:null;}
function sigReq(who){var id=cstate(who).contract_id;if(!id||!R.legal)return null;return arr(R.legal.signature_requests).filter(function(x){return x.contract_id===id;})[0]||null;}
async function loadLegal(force){
  if(!window.MDV_CONTRACTS)return;
  if(!force&&R.legal&&Date.now()-R.legalAt<20000)return;
  try{R.legal=await MDV_CONTRACTS.getLegal();R.legalAt=Date.now();}catch(e){return;}
  if(R.tab==='deal'&&document.getElementById('sr-modal'))paintRecord();
}
function tabHtml(p){
  if(R.tab==='deal'&&(R.sc.contract||{}).contract_id)loadLegal();
  if(R.tab==='outreach')return outreachHtml(p);
  if(R.tab==='call')return callTabHtml(p);
  if(R.tab==='deal')return dealHtml(p);
  if(R.tab==='timeline')return timelineHtml(p);
  return profileHtml(p);
}

/* --- profile (basic details) --- */
function profileHtml(p){
  var l=lookups(),pr=R.sc.profile||{};
  function sel(id,label,opts,val){return '<label><span>'+esc(label)+'</span><select id="'+id+'">'+opts.map(function(o){return '<option value="'+esc(o[0])+'"'+(String(o[0])===String(val||'')?' selected':'')+'>'+esc(o[1])+'</option>';}).join('')+'</select></label>';}
  return '<div class="sr-prof"><aside class="sr-gal">'+galleryHtml(p)+'</aside><div class="sr-pcol"><section class="sr-sec"><h3>About</h3><div class="sr-grid">'
    +fld('Name','p_name',p.display_name,'text','wide')
    +fld('Email','p_email',p.email,'email')+fld('Phone','p_phone',p.phone)
    +fld('Instagram','p_ig',p.instagram)+fld('TikTok','p_tt',p.tiktok)
    +fld('City','p_city',p.city)+fld('Country','p_country',p.country)
    +fld('Date of birth','p_dob',p.date_of_birth||'','date')+fld('Height','p_height',p.height_display,'text','','5′10″ / 178 cm')
    +fld('Found via','p_source',p.source)
    +sel('p_market','Target market',[['','Not set']].concat(arr(l.markets).map(function(x){return [x.id,x.name];})),p.target_market_id)
    +sel('p_div','Division',[['','Not set']].concat(arr(l.divisions).map(function(x){return [x.id,x.name];})),p.target_division_id)
    +sel('p_agent','Assigned agent',[['','Unassigned']].concat(arr(l.members).map(function(x){return [x.id,x.display_name+(x.job_title?' · '+x.job_title:'')];})),p.assigned_member_id)
    +'<label class="wide"><span>First impression / notes</span><textarea id="p_notes" rows="3">'+esc(p.notes||'')+'</textarea></label>'
    +'<label><span>Languages</span><input data-p="profile.languages" value="'+esc(pr.languages||'')+'" placeholder="English, French…"></label>'
    +'<label><span>Referred by</span><input data-p="profile.referred_by" value="'+esc(pr.referred_by||'')+'"></label>'
    +'</div></section>'
    +measureHtml(p)
    +'<div class="sr-savebar"><span class="sr-hint">Name, contact, notes and the other details above are saved when you press Save. Measurements save as you type.</span><button type="button" class="sr-btn gold" data-do="save_profile">Save details</button></div></div></div>';
}
function measFieldHtml(f,m,u){
  var v=m[f[0]]||'',conv=f[2]==='len'?convText(v,u):'';
  var ph=f[2]==='len'?(u==='in'?'in':'cm'):'';
  return '<label><span>'+esc(f[1])+(f[2]==='len'?' <i>('+u+')</i>':'')+'</span><input data-p="profile.measurements.'+f[0]+'" data-meas="'+(f[2]||'')+'" value="'+esc(v)+'"'+(ph?' placeholder="'+ph+'"':'')+' autocomplete="off"'+(f[2]==='len'?' inputmode="decimal"':'')+'>'+(f[2]==='len'?'<small class="sr-conv">'+esc(conv)+'</small>':'')+'</label>';
}
function measureHtml(p,compact){
  var m=measOf(p),u=m.units==='in'?'in':'cm';
  var h='<section class="sr-sec sr-meas"><h3>Measurements'+(m.__seeded==='application'&&!(R.sc.profile||{}).measurements?' <em class="sr-tag">filled from their application</em>':'')+'</h3>'
   +'<div class="sr-grid"><label><span>Units for lengths</span><select data-p="profile.measurements.units"><option value="cm"'+(u==='cm'?' selected':'')+'>Centimetres (cm)</option><option value="in"'+(u==='in'?' selected':'')+'>Inches (in)</option></select></label>'
   +'<label><span>How were these taken?</span><select data-p="profile.measurements.how"><option value=""></option>'+['Stated by model','Measured on video','Measured in person'].map(function(o){return '<option'+(m.how===o?' selected':'')+'>'+o+'</option>';}).join('')+'</select></label></div>'
   +'<h4>Body</h4><div class="sr-grid sr-g3">'+MEAS_CORE.map(function(f){return measFieldHtml(f,m,u);}).join('')+'</div>'
   +'<h4>Sizes</h4><div class="sr-grid sr-g3">'+MEAS_SIZE.map(function(f){return measFieldHtml(f,m,u);}).join('')
   +'<label><span>Shoe system</span><select data-p="profile.measurements.shoe_sys"><option value=""></option>'+['US','EU','UK'].map(function(o){return '<option'+(m.shoe_sys===o?' selected':'')+'>'+o+'</option>';}).join('')+'</select></label></div>'
   +'<h4>Look</h4><div class="sr-grid sr-g3">'+MEAS_LOOK.map(function(f){return measFieldHtml(f,m,u);}).join('')+'</div>'
   +'<div class="sr-grid"><label><span>Measured on</span><input type="date" data-p="profile.measurements.measured_on" value="'+esc(m.measured_on||'')+'"></label><label><span>Measurement notes</span><input data-p="profile.measurements.notes" value="'+esc(m.notes||'')+'" placeholder="e.g. measured over light clothing"></label></div>'
   +'<p class="sr-hint">Everything here carries over to the model profile when they sign. Lengths are saved in your chosen units and converted to cm for the profile.</p></section>';
  return h;
}
function compCard(p){
  var m=measOf(p),u=m.units==='in'?'in':'cm';
  function len(k){var v=String(m[k]||'').trim();if(!v)return '';return /^[\d.,]+$/.test(v)?v+' '+u:v;}
  var tiles=[['Height',len('height')],['Bust',len('bust_chest')],['Waist',len('waist')],['Hips',len('hips')],['Shoe',m.shoe?m.shoe+(m.shoe_sys?' '+m.shoe_sys:''):''],['Hair',m.hair||''],['Eyes',m.eyes||'']];
  return '<div class="sr-comp" aria-label="Measurements">'+tiles.map(function(x){return '<div'+(x[1]?'':' class="empty"')+'><small>'+esc(x[0])+'</small><b>'+esc(x[1]||'—')+'</b></div>';}).join('')
    +'<button type="button" class="sr-link" data-tab-go="profile">Edit</button></div>';
}
function galleryHtml(p){
  var m=arr(p.scouting_media),lead=Math.min(R.lead||0,Math.max(0,m.length-1)),cur=m[lead];
  return '<div class="sr-gal-main'+(cur?'':' none')+'">'+(cur?'<img src="'+esc(cur.url)+'" alt="" data-zoom="'+lead+'">':'<span>'+esc(initials(p.display_name))+'</span>')+'</div>'
    +'<div class="sr-photos">'+m.map(function(x,i){return '<button type="button" class="sr-th'+(i===lead?' on':'')+'" data-ph="'+i+'" aria-label="Photo '+(i+1)+'"><img src="'+esc(x.url)+'" alt=""></button>';}).join('')
    +'<label class="sr-up">＋<input id="sr-files" type="file" accept="image/*" multiple hidden><span>Upload</span></label></div>'
    +'<p class="sr-hint">'+(m.length?m.length+' photo'+(m.length===1?'':'s')+' · tap one to make it the lead':'Add digitals or Instagram screenshots.')+'</p>';
}
function lightbox(url){
  var o=document.createElement('div');o.className='sr-lb';o.innerHTML='<img src="'+esc(url)+'" alt=""><button type="button" aria-label="Close">×</button>';
  function close(){o.remove();document.removeEventListener('keydown',k,true);}
  function k(e){if(e.key==='Escape'){e.stopPropagation();close();}}
  o.onclick=close;document.addEventListener('keydown',k,true);document.body.appendChild(o);
}
/* --- outreach --- */
function srcText(v){
  v=String(v||'').trim();if(!v)return '';
  if(/^website[_ ]?get[_ ]?scouted$/i.test(v)||/^website/i.test(v))return 'on our website';
  if(/^[a-z0-9_]+$/.test(v)&&v.indexOf('_')>-1)return v.replace(/_/g,' ');
  return v;
}
function tpl(p,kind){
  var sc=R.sc,ma=(sc.outreach&&sc.outreach.ma)||{},nm=first(p.display_name),agent=who();
  if(kind==='ma')return {subject:'Interest in '+p.display_name+' — Maison de Veux',body:'Hello '+first(ma.name||'')+',\n\nWe have been following '+p.display_name+(p.instagram?' ('+p.instagram+')':'')+' and would love to speak with them about representation with Maison de Veux in New York and Paris.\n\nCould you let us know '+nm+'\'s current status'+(ma.agency?' with '+ma.agency:'')+', and whether you are open to a conversation or a placement with us?\n\nThank you,\n'+agent};
  return {subject:'Maison de Veux — we would love to get to know you',body:'Hi '+nm+',\n\nI am '+agent+' at Maison de Veux, a modeling agency in New York and Paris. We came across your profile'+(srcText(p.source)?' ('+srcText(p.source)+')':'')+' and think you could be a great fit.\n\nWould you be open to a short call this week to talk about modeling and what you are looking for? Reply with a couple of times that suit you and the best number to reach you.\n\nIf you already have an agent, tell us who they are. We always speak with your mother agent first.\n\nWarmly,\n'+agent};
}
/* what will actually be sent: the edited text if there is some, otherwise the suggestion */
function mailFor(p,kind){
  var t=tpl(p,kind),o=((R.sc.outreach||{})[kind==='ma'?'ma':'model'])||{};
  return {subject:(o.subject!=null&&String(o.subject).trim()!=='')?o.subject:t.subject,body:(o.body!=null&&String(o.body).trim()!=='')?o.body:t.body,edited:!!(o.body||o.subject)};
}
function who(){var n=String((document.getElementById('tbName')||{}).textContent||'').trim();return n||'the Maison de Veux team';}
function composerHtml(kind,m){
  var base='outreach.'+(kind==='ma'?'ma':'model');
  return '<div class="sr-compose"><div class="sr-compose-h"><b>'+(kind==='ma'?'Email to the MA':'Email to the model')+'</b><span class="sr-hint">'+(m.edited?'Edited by you':'Suggested. Change anything you like.')+'</span><button type="button" class="sr-link" data-do="reset_mail" data-kind="'+kind+'">Reset to suggested</button></div>'
    +'<label><span>Subject</span><input data-p="'+base+'.subject" value="'+esc(m.subject)+'"></label>'
    +'<label><span>Message</span><textarea rows="11" data-p="'+base+'.body">'+esc(m.body)+'</textarea></label></div>';
}
function outreachHtml(p){
  var o=R.sc.outreach||{},m=o.model||{},ma=o.ma||{},log=arr(R.sc.log).filter(function(x){return x.type==='outreach'||x.type==='note';}).slice(-8).reverse();
  var tm=mailFor(p,'model'),tma=mailFor(p,'ma');
  var guard=isMinor(p)?'<section class="sr-sec warn"><h3>Guardian consent (under 18)</h3><div class="sr-grid"><label><span>Parent / guardian name</span><input data-p="profile.guardian_name" value="'+esc((R.sc.profile||{}).guardian_name||'')+'"></label><label><span>Guardian phone / email</span><input data-p="profile.guardian_contact" value="'+esc((R.sc.profile||{}).guardian_contact||'')+'"></label><label class="chk"><input type="checkbox" data-p="profile.guardian_consent"'+((R.sc.profile||{}).guardian_consent?' checked':'')+'> Guardian has agreed to us speaking with the model</label></div></section>':'';
  return guard
    +'<section class="sr-sec"><h3>1 · The model</h3><p class="sr-hint">'+esc([p.email,p.phone,p.instagram].filter(Boolean).join(' · ')||'No contact details yet. Add them on the Profile tab.')+'</p>'
    +composerHtml('model',tm)
    +'<div class="sr-row2"><label><span>Status</span><select data-p="outreach.model.status">'+['Not contacted','Emailed','Replied','Interested','Not interested','No reply'].map(function(x){return '<option'+(((m.status||'Not contacted')===x)?' selected':'')+'>'+x+'</option>';}).join('')+'</select></label><label class="wide"><span>Notes</span><input data-p="outreach.model.notes" value="'+esc(m.notes||'')+'" placeholder="What they said, when they are free…"></label></div>'
    +'<div class="sr-actions">'+(p.email?'<button type="button" class="sr-btn gold" data-do="email_model">Email the model</button>':'')+'<button type="button" class="sr-btn" data-do="mark_model">Mark as emailed'+(m.emailed_at?' · '+fmt(m.emailed_at):'')+'</button></div></section>'
    +'<section class="sr-sec"><h3>2 · Mother agent (MA)</h3><div class="sr-grid">'
    +'<label><span>MA name</span><input data-p="outreach.ma.name" value="'+esc(ma.name||'')+'"></label><label><span>Agency</span><input data-p="outreach.ma.agency" value="'+esc(ma.agency||'')+'"></label>'
    +'<label><span>MA email</span><input type="email" data-p="outreach.ma.email" value="'+esc(ma.email||'')+'"></label><label><span>MA phone</span><input data-p="outreach.ma.phone" value="'+esc(ma.phone||'')+'"></label>'
    +'<label><span>Status</span><select data-p="outreach.ma.status">'+['Not contacted','Emailed','Replied','Open to a conversation','Placement possible','Declined','Exclusive elsewhere'].map(function(x){return '<option'+(((ma.status||'Not contacted')===x)?' selected':'')+'>'+x+'</option>';}).join('')+'</select></label>'
    +'<label><span>Replied on</span><input type="date" data-p="outreach.ma.replied_at" value="'+esc((ma.replied_at||'').slice(0,10))+'"></label>'
    +'<label class="wide"><span>Notes</span><input data-p="outreach.ma.notes" value="'+esc(ma.notes||'')+'" placeholder="Terms, split, conditions…"></label></div>'
    +composerHtml('ma',tma)
    +'<div class="sr-actions">'+(ma.email?'<button type="button" class="sr-btn gold" data-do="email_ma">Email the MA</button>':'<span class="sr-hint">Add the MA email above to send from here.</span>')+'<button type="button" class="sr-btn" data-do="mark_ma">Mark MA as emailed'+(ma.emailed_at?' · '+fmt(ma.emailed_at):'')+'</button></div></section>'
    +'<section class="sr-sec"><h3>Contact log</h3><div class="sr-row2"><label class="wide"><span>Add a note</span><input id="sr-lognote" placeholder="e.g. Left voicemail, texted, DM’d on Instagram…"></label><button type="button" class="sr-btn" data-do="add_log">Add</button></div>'
    +(log.map(function(x){return '<p class="sr-log"><span>'+fmt(x.at,true)+'</span>'+esc(x.text)+'</p>';}).join('')||'<p class="sr-hint">Nothing logged yet.</p>')+'</section>';
}

/* --- sending the interest call details to the model or the mother agency --- */
var ZONES={brazil:'America/Sao_Paulo',italy:'Europe/Rome',france:'Europe/Paris','united kingdom':'Europe/London',uk:'Europe/London',england:'Europe/London',germany:'Europe/Berlin',spain:'Europe/Madrid',nigeria:'Africa/Lagos','south africa':'Africa/Johannesburg',kenya:'Africa/Nairobi',ghana:'Africa/Accra',japan:'Asia/Tokyo','south korea':'Asia/Seoul',china:'Asia/Shanghai',india:'Asia/Kolkata',australia:'Australia/Sydney',canada:'America/Toronto',mexico:'America/Mexico_City',colombia:'America/Bogota',argentina:'America/Argentina/Buenos_Aires',chile:'America/Santiago',germany2:'Europe/Berlin',sweden:'Europe/Stockholm',denmark:'Europe/Copenhagen',netherlands:'Europe/Amsterdam',poland:'Europe/Warsaw',ukraine:'Europe/Kyiv',russia:'Europe/Moscow',turkey:'Europe/Istanbul',uae:'Asia/Dubai','united arab emirates':'Asia/Dubai'};
function atTz(iso,tz,long){try{return new Date(iso).toLocaleString('en-US',long?{timeZone:tz,weekday:'long',month:'long',day:'numeric',hour:'numeric',minute:'2-digit'}:{timeZone:tz,hour:'numeric',minute:'2-digit'});}catch(e){return '';}}
function dayTz(iso){try{return new Date(iso).toLocaleDateString('en-US',{timeZone:'America/New_York',weekday:'long',month:'long',day:'numeric'});}catch(e){return '';}}
function whenText(p,iso,withTheirs){
  var paris=atTz(iso,'Europe/Paris'),own=withTheirs?ZONES[String(p.country||'').trim().toLowerCase()]:'';
  var out=dayTz(iso)+' at '+atTz(iso,'America/New_York')+' New York time';
  var extra=['('+paris+' in Paris'];
  if(own&&atTz(iso,own)!==paris&&atTz(iso,own)!==atTz(iso,'America/New_York'))extra.push(atTz(iso,own)+' where you are');
  return out+' '+extra.join(', ')+')';
}
function hostName(){var c=R.sc.call||{},m=arr(lookups().members).filter(function(x){return x.id===c.host_member_id;})[0];return m?m.display_name:who();}
/* A pasted Zoom invitation is long: keep the link, meeting ID and passcode, drop the rest */
function joinText(v){
  var s=String(v||'').replace(/\s+/g,' ').trim();if(!s)return '';
  var url=(s.match(/https?:\/\/[^\s<>"']+/)||[])[0];
  if(!url)return s.length>140?s.slice(0,137)+'…':s;
  url=url.replace(/[.,;)]+$/,'');
  var id=(s.match(/Meeting ID:?\s*([\d ]{6,})/i)||[])[1],pw=(s.match(/Pass(?:code|word):?\s*([A-Za-z0-9]+)/i)||[])[1];
  return url+(id?' · Meeting ID '+id.trim():'')+(pw?' · Passcode '+pw:'');
}
function callTpl(p,kind){
  var c=R.sc.call||{},ma=(R.sc.outreach&&R.sc.outreach.ma)||{},nm=first(p.display_name),host=hostName(),how=[c.channel||'Phone',joinText(c.link)].filter(Boolean).join(' · ');
  var mins=Number(c.minutes)||30,minor=isMinor(p);
  if(kind==='ma')return {subject:'Interest call with '+p.display_name+' — '+dayTz(c.scheduled_at)+' — Maison de Veux',body:'Hello '+first(ma.name||'')+',\n\nThank you for speaking with us about '+p.display_name+'. We would like to set up an interest call with '+nm+' so we can get to know '+nm+' and talk about representation in New York and Paris.\n\n• When: '+whenText(p,c.scheduled_at,false)+'\n• How: '+how+'\n• With: '+host+', Maison de Veux\n• Length: about '+mins+' minutes\n\nCould you confirm that this time works for '+nm+' and let us know if you would like to join? If another time is better, send two options and we will fit one.'+(minor?'\n\nAs '+nm+' is under 18, a parent or guardian should be on the call.':'')+'\n\nThank you,\n'+host+'\nMaison de Veux'};
  return {subject:'Your call with Maison de Veux — '+dayTz(c.scheduled_at),body:'Hi '+nm+',\n\nThank you for your interest in Maison de Veux. We are looking forward to speaking with you.\n\nYour interest call:\n• When: '+whenText(p,c.scheduled_at,true)+'\n• How: '+how+'\n• With: '+host+', Maison de Veux\n• Length: about '+mins+' minutes\n\nIt helps to have ready: a few recent photos, your measurements, when you are free to travel, and your passport status.'+(minor?'\n\nBecause you are under 18, please have a parent or guardian join the call.':'')+'\n\nPlease reply to confirm this time works. If it does not, send me a couple of times that suit you and I will change it.\n\nSee you soon,\n'+host+'\nMaison de Veux'};
}
function callMailFor(p,kind){
  var t=callTpl(p,kind),o=(((R.sc.call||{}).send||{})[kind])||{};
  return {subject:(o.subject!=null&&String(o.subject).trim()!=='')?o.subject:t.subject,body:(o.body!=null&&String(o.body).trim()!=='')?o.body:t.body,edited:!!(o.body||o.subject)};
}
var CONFIRM=['Not sent','Sent','Confirmed','Wants another time','No reply'];
function sendBlock(p,kind){
  var c=R.sc.call||{},ma=(R.sc.outreach&&R.sc.outreach.ma)||{},m=callMailFor(p,kind),base='call.send.'+kind,addr=kind==='ma'?ma.email:p.email,st=((c.confirm||{})[kind])||'Not sent',sentAt=(c.sent||{})[kind+'_at'];
  var title=kind==='ma'?'Send to the mother agency'+(ma.name?' · '+esc(ma.name):''):'Send to the model';
  return '<div class="sr-compose"><div class="sr-compose-h"><b>'+title+'</b><span class="sr-hint">'+(addr?esc(addr):(kind==='ma'?'Add the MA email on the Outreach tab.':'No email yet. Add it on the Profile tab.'))+(m.edited?' · Edited by you':'')+'</span><button type="button" class="sr-link" data-do="reset_call_mail" data-kind="'+kind+'">Reset to suggested</button></div>'
    +'<label><span>Subject</span><input data-p="'+base+'.subject" value="'+esc(m.subject)+'"></label>'
    +'<label><span>Message</span><textarea rows="12" data-p="'+base+'.body">'+esc(m.body)+'</textarea></label>'
    +'<div class="sr-row2"><label><span>Confirmation</span><select data-p="call.confirm.'+kind+'">'+CONFIRM.map(function(x){return '<option'+(st===x?' selected':'')+'>'+x+'</option>';}).join('')+'</select></label>'
    +'<div class="sr-actions">'+(addr?'<button type="button" class="sr-btn gold" data-do="email_call" data-kind="'+kind+'">Email the call details</button>':'')+(sentAt?'<span class="sr-hint">Sent '+esc(fmt(sentAt,true))+'</span>':'')+'</div></div></div>';
}
function sendSection(p){
  var c=R.sc.call||{};
  if(!c.scheduled_at)return '<section class="sr-sec"><h3>Send the call details</h3><p class="sr-hint">Pick a date and time above, schedule the call, then send the details to the model or the mother agency.</p></section>';
  return '<section class="sr-sec"><h3>Send the call details</h3><p class="sr-hint">The email has the date and time (New York, Paris and the model’s own time where known), how to join, who hosts, and what to have ready. It opens in your portal mail so you can read it before it goes. Opening it marks the call as Sent; change Confirmation when they reply.</p>'+sendBlock(p,'model')+sendBlock(p,'ma')+'</section>';
}
/* --- interest call: schedule + summary, with the questionnaire in its own pop-up --- */
function callTabHtml(p){
  var c=R.sc.call||{},cnt=answeredCount(R.sc),s=scores(R.sc),k=stepOf(p);
  var members=arr(lookups().members);
  var sched='<section class="sr-sec"><h3>Interest call</h3><div class="sr-grid">'
    +'<label><span>Date & time</span><input type="datetime-local" data-p="call.scheduled_at_local" data-iso="call.scheduled_at" value="'+esc(localInput(c.scheduled_at))+'"></label>'
    +'<label><span>How</span><select data-p="call.channel">'+['Phone','Zoom','FaceTime','WhatsApp','Instagram video','In person'].map(function(x){return '<option'+((c.channel||'Phone')===x?' selected':'')+'>'+x+'</option>';}).join('')+'</select></label>'
    +'<label><span>Host</span><select data-p="call.host_member_id"><option value="">Me</option>'+members.map(function(x){return '<option value="'+esc(x.id)+'"'+(c.host_member_id===x.id?' selected':'')+'>'+esc(x.display_name)+'</option>';}).join('')+'</select></label>'
    +'<label><span>Link / number</span><input data-p="call.link" value="'+esc(c.link||'')+'" placeholder="Zoom link or phone number"></label></div>'
    +'<div class="sr-actions"><button type="button" class="sr-btn gold" data-do="schedule_call">'+(k==='call_scheduled'?'Update call':'Schedule the call')+'</button>'
    +'<button type="button" class="sr-btn" data-do="open_call">Start the questionnaire</button></div></section>';
  var sum='<section class="sr-sec"><h3>Questionnaire</h3><div class="sr-prog"><i style="width:'+Math.round(cnt.done/Math.max(1,cnt.total)*100)+'%"></i></div><p class="sr-hint">'+cnt.done+' of '+cnt.total+' answered'+(c.completed_at?' · completed '+fmt(c.completed_at):'')+'</p>'
    +'<div class="sr-scores"><div><b>'+(s.walk||'–')+'</b><span>Walk</span></div><div><b>'+(s.pose||'–')+'</b><span>Posing</span></div><div><b>'+(s.wrap||'–')+'</b><span>Presence</span></div><div class="all"><b>'+(s.overall||'–')+'</b><span>Overall</span></div></div>'
    +(c.wrap&&c.wrap.recommendation?'<p class="sr-rec">Recommendation: <b>'+esc(c.wrap.recommendation)+'</b></p>':'')
    +(c.wrap&&c.wrap.summary?'<p class="sr-sumtxt">'+esc(c.wrap.summary)+'</p>':'')
    +'<div class="sr-actions"><button type="button" class="sr-btn gold" data-do="open_call">'+(cnt.done?'Open the questionnaire':'Start the questionnaire')+'</button></div></section>';
  return sched+sendSection(p)+sum;
}

/* --- the questionnaire pop-up, one section at a time --- */
function ratingRow(path,label,val){
  var h='<div class="sr-rate"><span>'+esc(label)+'</span><div>';
  for(var i=1;i<=5;i++)h+='<button type="button" data-rate="'+path+'" data-v="'+i+'" class="'+(Number(val)===i?'on':'')+'">'+i+'</button>';
  return h+'</div></div>';
}
function qHtml(q,a){
  var path='call.answers.'+q.k,v=a[q.k];
  if(q.t==='ta')return '<label class="wide"><span>'+esc(q.l)+'</span><textarea rows="3" data-p="'+path+'">'+esc(v||'')+'</textarea></label>';
  if(q.t==='tx')return '<label class="wide"><span>'+esc(q.l)+'</span><input data-p="'+path+'" value="'+esc(v||'')+'"></label>';
  if(q.t==='sel')return '<label class="wide"><span>'+esc(q.l)+'</span><select data-p="'+path+'"><option value=""></option>'+q.o.map(function(o){return '<option'+(v===o?' selected':'')+'>'+esc(o)+'</option>';}).join('')+'</select></label>';
  if(q.t==='rate')return '<div class="wide">'+ratingRow(path,q.l,v)+'</div>';
  return '';
}
function sectionBody(sec,p){
  var c=R.sc.call||{},a=c.answers||{},h='<p class="sr-say"><b>Say:</b> '+esc(sec.say)+'</p>';
  if(sec.qs){
    var qs=sec.qs;
    h+='<div class="sr-grid">'+qs.map(function(q){return qHtml(q,a);}).join('')+(sec.id==='logi'&&isMinor(p)?'<label class="wide chk"><input type="checkbox" data-p="profile.guardian_consent"'+((R.sc.profile||{}).guardian_consent?' checked':'')+'> Guardian knows about this call and agrees</label>':'')+'</div>';
  }else if(sec.measure){
    h+=measureHtml(p,true);
  }else if(sec.walk){
    var w=c.walk||{},r=w.ratings||{};
    h+='<div class="sr-rates">'+WALK_R.map(function(x){return ratingRow('call.walk.ratings.'+x[0],x[1],r[x[0]]);}).join('')+'</div>'
      +'<div class="sr-grid"><label><span>Shoes worn</span><select data-p="call.walk.shoes"><option value=""></option>'+['Barefoot','Flats / sneakers','Boots','Heels'].map(function(o){return '<option'+(w.shoes===o?' selected':'')+'>'+o+'</option>';}).join('')+'</select></label>'
      +'<label><span>Space to walk</span><select data-p="call.walk.space"><option value=""></option>'+['Plenty','Tight','No space'].map(function(o){return '<option'+(w.space===o?' selected':'')+'>'+o+'</option>';}).join('')+'</select></label>'
      +'<label class="wide"><span>Walk video link (if they send one)</span><input data-p="call.walk.video_url" value="'+esc(w.video_url||'')+'" placeholder="https://…"></label>'
      +'<label class="wide chk"><input type="checkbox" data-p="call.walk.video_requested"'+(w.video_requested?' checked':'')+'> Walk video requested</label>'
      +'<label class="wide"><span>Walk notes</span><textarea rows="3" data-p="call.walk.notes" placeholder="Stride, pace, turn, what to coach…">'+esc(w.notes||'')+'</textarea></label></div>';
  }else if(sec.pose){
    var po=c.pose||{},pr=po.ratings||{},ps=po.poses||{},dg=po.digitals||{};
    h+='<div class="sr-rates">'+POSE_R.map(function(x){return ratingRow('call.pose.ratings.'+x[0],x[1],pr[x[0]]);}).join('')+'</div>'
      +'<h4>Poses they showed</h4><div class="sr-checks">'+POSES.map(function(x){return '<label><input type="checkbox" data-p="call.pose.poses.'+x[0]+'"'+(ps[x[0]]?' checked':'')+'> '+esc(x[1])+'</label>';}).join('')+'</div>'
      +'<h4>Digitals to request</h4><div class="sr-checks">'+DIGITALS.map(function(x){return '<label><select data-p="call.pose.digitals.'+x[0]+'"><option value=""></option>'+['Requested','Received'].map(function(o){return '<option'+(dg[x[0]]===o?' selected':'')+'>'+o+'</option>';}).join('')+'</select> '+esc(x[1])+'</label>';}).join('')+'</div>'
      +'<label class="wide"><span>Posing notes</span><textarea rows="3" data-p="call.pose.notes" placeholder="Strongest pose, what to coach, editorial vs commercial…">'+esc(po.notes||'')+'</textarea></label>';
  }else if(sec.wrap){
    var wp=c.wrap||{},wr=wp.ratings||{},s=scores(R.sc);
    h+='<div class="sr-rates">'+WRAP_R.map(function(x){return ratingRow('call.wrap.ratings.'+x[0],x[1],wr[x[0]]);}).join('')+'</div>'
      +'<div class="sr-scores"><div><b>'+(s.walk||'–')+'</b><span>Walk</span></div><div><b>'+(s.pose||'–')+'</b><span>Posing</span></div><div><b>'+(s.wrap||'–')+'</b><span>Presence</span></div><div class="all"><b>'+(s.overall||'–')+'</b><span>Overall</span></div></div>'
      +'<div class="sr-grid"><label><span>Recommendation</span><select data-p="call.wrap.recommendation">'+RECS.map(function(o){return '<option'+(wp.recommendation===o?' selected':'')+'>'+esc(o)+'</option>';}).join('')+'</select></label>'
      +'<label><span>Next step</span><input data-p="call.wrap.next_step" value="'+esc(wp.next_step||'')+'" placeholder="Send digitals by Friday…"></label>'
      +'<label class="wide"><span>Summary for the team</span><textarea rows="4" data-p="call.wrap.summary" placeholder="Overall impression, strengths, concerns…">'+esc(wp.summary||'')+'</textarea></label></div>';
  }
  return h;
}
function openCall(){
  var p=byId(R.id);if(!p)return;
  var el=document.getElementById('sr-call');if(el)el.remove();
  el=document.createElement('div');el.id='sr-call';el.className='sr-back sr-top';document.body.appendChild(el);
  R.call.i=Math.min(R.call.i||0,CALL.length-1);
  paintCall();
}
function paintCall(){
  var el=document.getElementById('sr-call'),p=byId(R.id);if(!el||!p)return;
  var i=R.call.i,sec=CALL[i],last=i===CALL.length-1,sc=el.querySelector('.sr-main'),pos=sc?sc.scrollTop:0;
  el.innerHTML='<section class="sr-dlg sr-callp" role="dialog" aria-modal="true" aria-label="Interest call"><header><div><small>INTEREST CALL · '+esc(p.display_name)+'</small><h2>'+esc(sec.title)+'</h2></div><button type="button" data-cx aria-label="Close">×</button></header>'
    +'<div class="sr-dots">'+CALL.map(function(s,j){return '<button type="button" data-ci="'+j+'" class="'+(j===i?'cur':j<i?'done':'')+'" title="'+esc(s.title)+'"><span>'+(j+1)+'</span></button>';}).join('')+'</div>'
    +'<div class="sr-main">'+sectionBody(sec,p)+'</div>'
    +'<footer><span class="sr-save" id="sr-save2">'+(R.saving?'Saving…':R.saved?'Saved':'')+'</span><span class="sr-sp"></span>'
    +(i>0?'<button type="button" class="sr-btn" data-cn="-1">← Back</button>':'')
    +(last?'<button type="button" class="sr-btn gold" data-cdone>Complete the call</button>':'<button type="button" class="sr-btn gold" data-cn="1">Next →</button>')+'</footer></section>';
  var nm=el.querySelector('.sr-main');if(nm)nm.scrollTop=pos;
  el.querySelectorAll('[data-cx]').forEach(function(b){b.onclick=function(){flush();el.remove();paintRecord();};});
  el.querySelectorAll('[data-ci]').forEach(function(b){b.onclick=function(){R.call.i=+b.dataset.ci;paintCall();};});
  el.querySelectorAll('[data-cn]').forEach(function(b){b.onclick=function(){R.call.i=Math.max(0,Math.min(CALL.length-1,R.call.i+(+b.dataset.cn)));paintCall();};});
  var d=el.querySelector('[data-cdone]');if(d)d.onclick=completeCall;
  wireInputs(el);
}
async function completeCall(){
  var p=byId(R.id);if(!p)return;
  setPath(R.sc,'call.completed_at',nowIso());setPath(R.sc,'call.status','done');R.dirty.call=true;
  await flush(true);
  var el=document.getElementById('sr-call');if(el)el.remove();
  var rec=(R.sc.call.wrap&&R.sc.call.wrap.recommendation)||'';
  await moveTo('call_done',{note:'Interest call completed'+(rec?' · '+rec:''),quiet:true});
  toast('✓ Interest call saved');
}

/* --- deal: test → offer → contract → merge --- */
function measurementsForModel(p){
  var m=measOf(p),u=m.units==='in'?'in':'cm',men=/^m(en|ale)?$/i.test(String((p.metadata&&p.metadata.application&&p.metadata.application.gender)||'')),out={};
  var cm=function(k){var v=toCm(m[k],u);return v==null?null:v;};
  var h=cm('height');if(h)out.height_cm=h;else if(p.height_cm)out.height_cm=p.height_cm;
  if(m.height)out.height_display=String(m.height);else if(p.height_display)out.height_display=p.height_display;
  var bc=cm('bust_chest');if(bc)out[men?'chest_cm':'bust_cm']=bc;
  var w=cm('waist');if(w)out.waist_cm=w;var hp=cm('hips');if(hp)out.hips_cm=hp;
  if(m.dress)out.dress=String(m.dress);if(m.suit)out.suit=String(m.suit);
  if(m.shoe)out.shoe=String(m.shoe)+(m.shoe_sys&&!/[a-z]/i.test(String(m.shoe))?' '+m.shoe_sys:'');
  if(m.hair)out.hair=String(m.hair);if(m.eyes)out.eyes=String(m.eyes);if(m.skin)out.skin=String(m.skin);
  var extra=[];
  [['cup','Cup'],['inseam','Inseam'],['neck','Neck'],['sleeve','Sleeve'],['shoulder','Shoulder'],['collar','Collar'],['hair_length','Hair length'],['marks','Marks']].forEach(function(x){if(m[x[0]])extra.push(x[1]+': '+m[x[0]]+(['inseam','neck','sleeve','shoulder'].indexOf(x[0])>-1&&!/[a-z]/i.test(String(m[x[0]]))?' '+u:''));});
  if(m.notes)extra.push(m.notes);
  if(extra.length)out.notes=('From scouting'+(m.how?' ('+m.how.toLowerCase()+')':'')+': '+extra.join(' · ')).slice(0,480);
  return out;
}
function summaryNote(p){
  var sc=R.sc,c=sc.call||{},a=c.answers||{},s=scores(sc),lines=[];
  lines.push('SCOUTING SUMMARY · '+p.display_name);
  lines.push('Found: '+(p.source||'—')+(p.created_at?' · '+fmt(p.created_at):''));
  var mm0=measOf(p);if(mm0.height||mm0.waist||mm0.hips)lines.push('Measurements ('+(mm0.units==='in'?'in':'cm')+'): '+MEASURE.filter(function(x){return mm0[x[0]];}).slice(0,12).map(function(x){return x[1]+' '+mm0[x[0]];}).join(', '));
  var o=sc.outreach||{};if(o.ma&&(o.ma.name||o.ma.agency))lines.push('Mother agent: '+[o.ma.name,o.ma.agency].filter(Boolean).join(' · ')+(o.ma.status?' ('+o.ma.status+')':''));
  if(c.completed_at||c.scheduled_at)lines.push('Interest call: '+fmt(c.completed_at||c.scheduled_at)+(c.wrap&&c.wrap.recommendation?' · '+c.wrap.recommendation:'')+(s.overall?' · overall '+s.overall+'/5':''));
  CALL.forEach(function(sec){arr(sec.qs).forEach(function(q){var v=a[q.k];if(v!=null&&String(v).trim()&&q.t!=='rate')lines.push(q.l+': '+v);});});
  if(c.walk&&(c.walk.notes||s.walk))lines.push('Walk'+(s.walk?' ('+s.walk+'/5)':'')+': '+(c.walk.notes||'—'));
  if(c.pose&&(c.pose.notes||s.pose))lines.push('Posing'+(s.pose?' ('+s.pose+'/5)':'')+': '+(c.pose.notes||'—'));
  if(c.wrap&&c.wrap.summary)lines.push('Summary: '+c.wrap.summary);
  return lines.join('\n');
}
function dealHtml(p){
  var t=R.sc.test||{},of=R.sc.offer||{},ct=R.sc.contract||{},l=lookups(),k=stepOf(p),c=R.sc.call||{};
  function sel(path,label,opts,val){return '<label><span>'+esc(label)+'</span><select data-p="'+path+'">'+opts.map(function(o){return '<option value="'+esc(o[0])+'"'+(String(o[0])===String(val||'')?' selected':'')+'>'+esc(o[1])+'</option>';}).join('')+'</select></label>';}
  var merged=p.converted_model_id||(R.sc.linked&&R.sc.linked.model_id);
  var mm=measOf(p),u2=mm.units==='in'?'in':'cm',fill=MEASURE.filter(function(x){return mm[x[0]]&&x[0]!=='marks';});
  var merge='<section class="sr-sec merge"><h3>Merge into the model profile</h3>'
    +(merged?'<p class="sr-ok">✓ Connected to the model profile'+(R.sc.linked&&R.sc.linked.at?' on '+fmt(R.sc.linked.at):'')+'. '+(R.sc.linked&&arr(R.sc.linked.measurements).length?'Measurements filled: '+esc(R.sc.linked.measurements.join(', '))+'. ':'')+(R.sc.linked&&R.sc.linked.note?'Scouting summary pinned as a note.':'')+'</p><div class="sr-actions"><button type="button" class="sr-btn gold" data-do="open_model">Open Model 360 →</button></div>'
     :'<p class="sr-hint">When they sign, everything below carries over to the new model profile. Nothing is typed twice.</p>'
      +'<ul class="sr-mapl"><li><b>Contact</b> '+esc([p.email,p.phone].filter(Boolean).join(' · ')||'—')+'</li><li><b>Social</b> '+esc([p.instagram,p.tiktok].filter(Boolean).join(' · ')||'—')+'</li><li><b>Measurements</b> '+(fill.length?fill.slice(0,9).map(function(x){return esc(x[1]+': '+mm[x[0]]+(x[2]==='len'&&!/[a-z\u2032\u2033'"]/i.test(String(mm[x[0]]))?' '+u2:''));}).join(' · '):(p.height_display?esc('Height: '+p.height_display):'—'))+'</li><li><b>Photos</b> '+arr(p.scouting_media).length+' scouting image'+(arr(p.scouting_media).length===1?'':'s')+'</li><li><b>Scouting summary</b> pinned to the profile as an internal note</li></ul>'
      +'<div class="sr-grid">'+sel('offer.market_id','Market',[['','Use scouting market']].concat(arr(l.markets).map(function(x){return [x.id,x.name];})),of.market_id||p.target_market_id)
      +sel('offer.division_id','Division',[['','Use scouting division']].concat(arr(l.divisions).map(function(x){return [x.id,x.name];})),of.division_id||p.target_division_id)
      +sel('offer.board_id','Board',[['','Use scouting board']].concat(arr(l.boards).map(function(x){return [x.id,x.name];})),of.board_id||(p.metadata&&p.metadata.preferred_board_id))
      +sel('offer.model_stage','Starts as',[['development','Development'],['new_face','New face'],['main_board','Main board']],of.model_stage||'development')+'</div>'
      +'<div class="sr-actions"><button type="button" class="sr-btn gold" data-do="merge"'+(isSigned(k)?'':' title="Available once they are marked Signed"')+'>'+(isSigned(k)?'Create the model profile →':'Mark as signed first')+'</button></div>')+'</section>';
  var testSec='<section class="sr-sec"><h3>Test / go-see <em class="sr-tag">after the contract is signed</em></h3><div class="sr-grid"><label><span>Date</span><input type="date" data-p="test.date" value="'+esc(t.date||'')+'"></label><label><span>Where / who</span><input data-p="test.where" value="'+esc(t.where||'')+'" placeholder="Studio, photographer…"></label>'
    +sel('test.result','Result',[['','Not yet'],['Strong','Strong'],['Promising','Promising'],['Needs work','Needs work'],['Pass','Pass']],t.result)
    +'<label class="wide"><span>Notes</span><input data-p="test.notes" value="'+esc(t.notes||'')+'"></label></div></section>';
  return ''
    +'<section class="sr-sec"><h3>Offer</h3><div class="sr-grid"><label><span>Offered on</span><input type="date" data-p="offer.offered_at" value="'+esc(of.offered_at||'')+'"></label><label><span>Commission %</span><input data-p="offer.commission" value="'+esc(of.commission||'')+'"></label>'
    +'<label><span>Term</span><input data-p="offer.term" value="'+esc(of.term||'')+'" placeholder="e.g. 3 years, exclusive in US"></label>'+sel('offer.response','Their answer',[['','Waiting'],['Accepted','Accepted'],['Negotiating','Negotiating'],['Declined','Declined']],of.response)
    +'<label class="wide"><span>Terms / notes</span><input data-p="offer.notes" value="'+esc(of.notes||'')+'"></label></div></section>'
    +contractHtml(p)+testSec+merge;
}
function contractHtml(p){return contractBlock(p,'model')+contractBlock(p,'ma');}
function contractBlock(p,who){
  var ma=who==='ma',ct=cstate(who),rec=contractRec(who),docs=rec?(window.MDV_CONTRACTS?MDV_CONTRACTS.docsOf(rec):[]):[],sig=sigReq(who);
  var mi=(R.sc.outreach&&R.sc.outreach.ma)||{},base=ma?'contract.ma.':'contract.',signers=sig?arr(sig.signature_signers):[];
  var allSigned=sig&&/complete|signed/i.test(String(sig.status||''))||(signers.length&&signers.every(function(x){return /signed/i.test(String(x.status||''));}));
  var h='<section class="sr-sec"><h3>'+(ma?'Mother agency (MA) contract'+(mi.agency||mi.name?' <em class="sr-tag">'+esc([mi.name,mi.agency].filter(Boolean).join(' · '))+'</em>':''):'Contract')+'</h3>';
  var hint=ma?(ct.contract_id?'No PDF attached yet.':'Load the mother agency agreement as a PDF: the model\u2019s current MA contract, or the agreement with the MA. You can send it to the MA for e-signature from here.'):(ct.contract_id?'No PDF attached yet.':'Upload the agreement as a PDF, then send it for e-signature. They read and sign on a secure page, no account needed.');
  h+=docs.length?docs.map(function(d){return '<p class="sr-doc">\ud83d\udcc4 '+esc(d.name||'Contract.pdf')+' <button type="button" class="sr-link" data-do="view_pdf" data-doc="'+esc(d.id)+'">View</button><button type="button" class="sr-link" data-do="remove_pdf" data-who="'+who+'" data-doc="'+esc(d.id)+'">Remove</button></p>';}).join(''):'<p class="sr-hint">'+hint+'</p>';
  if(signers.length)h+='<div class="sr-signers">'+signers.map(function(x){return '<span class="sr-sg '+(/signed/i.test(x.status||'')?'ok':/declin/i.test(x.status||'')?'bad':'')+'">'+esc(x.display_name||x.email||'Signer')+' \u00b7 '+esc(x.status||'pending')+'</span>';}).join('')+'</div>';
  if(sig&&!allSigned)h+='<p class="sr-hint">Signature request: '+esc(sig.status||'sent')+(sig.expires_at?' \u00b7 link expires '+fmt(sig.expires_at):'')+'</p>';
  if(allSigned)h+='<p class="sr-ok">\u2713 '+(ma?'The MA has signed.':'Everyone has signed.')+'</p>';
  h+='<div class="sr-grid"><label><span>Sent on</span><input type="date" data-p="'+base+'sent_at" value="'+esc(ct.sent_at||'')+'"></label><label><span>Signed on</span><input type="date" data-p="'+base+'signed_at" value="'+esc(ct.signed_at||'')+'"></label>'
    +(ma?'<label class="wide"><span>Terms (split, term, exclusivity)</span><input data-p="contract.ma.terms" value="'+esc(ct.terms||'')+'" placeholder="e.g. 20% to the MA for 2 years, non-exclusive"></label>':'')+'</div>';
  h+='<div class="sr-actions"><label class="sr-btn">'+(docs.length?'Replace PDF':(ma?'Load MA contract PDF':'Upload contract PDF'))+'<input type="file" id="'+(ma?'sr-pdf-ma':'sr-pdf')+'" accept="application/pdf,.pdf" hidden></label>'
    +'<button type="button" class="sr-btn gold" data-do="send_sign" data-who="'+who+'">'+(ma?(sig&&!allSigned?'Resend to the MA':'Send to the MA for e-signature'):(sig&&!allSigned?'Resend for e-signature':'Send for e-signature'))+'</button>'
    +(ct.contract_id?'<button type="button" class="sr-btn" data-do="refresh_sign">Refresh status</button>':'')
    +(!ma&&allSigned&&!isSigned(stepOf(p))?'<button type="button" class="sr-btn gold" data-do="mark_signed">Mark as signed \u2192</button>':'')+'</div></section>';
  return h;
}
async function ensureContract(p,who){
  var ma=who==='ma',ct=cstate(who);
  if(ct.contract_id)return ct.contract_id;
  if(!window.MDV_CONTRACTS)throw new Error('Contracts are still loading. Try again in a moment.');
  var mi=(R.sc.outreach&&R.sc.outreach.ma)||{};
  var out=await MDV_CONTRACTS.legal({action:'upsert_contract',contract:ma
    ?{title:'Mother agency agreement \u00b7 '+p.display_name+(mi.agency?' \u00b7 '+mi.agency:''),contract_type:'other',status:'draft',structured_terms:{scout_prospect_id:p.id,kind:'mother_agency',ma_name:mi.name||null,ma_agency:mi.agency||null}}
    :{title:'Representation agreement \u00b7 '+p.display_name,contract_type:'representation',status:'draft',structured_terms:{scout_prospect_id:p.id}}});
  var id=out&&out.contract&&out.contract.id;if(!id)throw new Error('The contract could not be created.');
  setPath(R.sc,ma?'contract.ma.contract_id':'contract.contract_id',id);R.dirty.contract=true;await flush(true);
  await loadLegal(true);
  return id;
}
function timelineHtml(p){
  var hist=arr(R.data&&R.data.stage_history).filter(function(x){return x.prospect_id===p.id;}).map(function(x){return {at:x.created_at,t:'Stage: '+String(x.from_stage||'new').replace(/_/g,' ')+' → '+String(x.to_stage).replace(/_/g,' '),s:x.reason||''};});
  var log=arr(R.sc.log).map(function(x){return {at:x.at,t:x.text,s:x.type};});
  var all=hist.concat(log).sort(function(a,b){return String(b.at).localeCompare(String(a.at));});
  return '<section class="sr-sec"><h3>Timeline</h3>'+(all.map(function(x){return '<p class="sr-log"><span>'+fmt(x.at,true)+'</span>'+esc(x.t)+(x.s?' <i>'+esc(x.s)+'</i>':'')+'</p>';}).join('')||'<p class="sr-hint">No activity yet.</p>')+'</section>';
}

/* ---------- wiring inside the record ---------- */
function ensureMeas(){
  if(!R.id)return;var pp=byId(R.id);if(!pp)return;
  if(!R.sc.profile)R.sc.profile={};
  if(!R.sc.profile.measurements){var b=Object.assign({},measOf(pp));delete b.__seeded;R.sc.profile.measurements=b;}
}
function wireInputs(root){
  root.querySelectorAll('[data-p]').forEach(function(inp){
    var path=inp.dataset.p;
    var handler=function(){
      if(/^profile\.measurements\./.test(path))ensureMeas();
      var v=inp.type==='checkbox'?inp.checked:inp.value;
      if(inp.dataset.iso){setPath(R.sc,inp.dataset.iso,v?new Date(v).toISOString():null);}
      else setPath(R.sc,path,v);
      markDirty(path);
    };
    if(inp.dataset.meas==='len'){inp.addEventListener('input',function(){var u=(getPath(R.sc,'profile.measurements.units')||(measOf(byId(R.id)||{}).units)||'cm'),sm=inp.parentNode.querySelector('.sr-conv');if(sm)sm.textContent=convText(inp.value,u);});}
    if(path==='profile.measurements.units'){inp.addEventListener('change',function(){if(document.getElementById('sr-call'))paintCall();else paintRecord();});}
    inp.addEventListener(inp.tagName==='SELECT'||inp.type==='checkbox'||inp.type==='date'||inp.type==='datetime-local'?'change':'input',handler);
  });
  root.querySelectorAll('[data-rate]').forEach(function(b){b.onclick=function(){
    var path=b.dataset.rate,v=Number(b.dataset.v),cur=Number(getPath(R.sc,path));
    setPath(R.sc,path,cur===v?0:v);markDirty(path);
    if(document.getElementById('sr-call'))paintCall();else paintRecord();
  };});
}
function markDirty(path){
  var top=path.split('.')[0];R.dirty[top]=true;R.saved=false;
  setSaveText('Unsaved changes…');
  clearTimeout(R.timer);R.timer=setTimeout(function(){flush();},900);
}
/* Saves go through one line, so an edit to the call time or a measurement can never be overwritten by a detail save that started a moment earlier */
function serial(fn){var run=(R.q2||Promise.resolve()).then(fn,fn);R.q2=run.catch(function(){});return run;}
function setSaveText(t,bad){
  ['sr-save','sr-save2'].forEach(function(id){var e=document.getElementById(id);if(!e)return;e.textContent=t;e.classList.toggle('bad',!!bad);e.style.cursor=bad?'pointer':'';e.title=bad?'Tap to try again':'';});
}
document.addEventListener('click',function(e){var t=e.target&&e.target.closest&&e.target.closest('.sr-save.bad');if(t&&document.getElementById('sr-modal')){flush();if(R.profDirty)saveProfile(true).catch(function(){});}});
async function flush(wait){
  clearTimeout(R.timer);
  var keys=Object.keys(R.dirty);if(!keys.length||!R.id)return;
  var id=R.id,body={};keys.forEach(function(k){body[k]=R.sc[k];});R.dirty={};R.saving=true;
  var s=document.getElementById('sr-save'),s2=document.getElementById('sr-save2');if(s)s.textContent='Saving…';if(s2)s2.textContent='Saving…';
  try{
    var out=await serial(function(){return post({action:'scout_save',prospect_id:id,scout:body});});
    if(!out||out.verified!==true)throw new Error('Not confirmed');
    var p=byId(id);if(p&&out.prospect)p.metadata=out.prospect.metadata;
    R.saved=true;
  }catch(e){keys.forEach(function(k){R.dirty[k]=true;});R.failed=msg(e);toast('Could not save: '+msg(e),true);R.saving=false;setSaveText('Not saved · tap to retry',true);return;}
  R.failed=null;R.saving=false;
  s=document.getElementById('sr-save');s2=document.getElementById('sr-save2');
  if(s)s.textContent=R.saved?'Saved':'';if(s2)s2.textContent=R.saved?'Saved':'';
}
/* About details (name, contact, notes…) are saved as you type, a moment after you stop, and always before the tab changes or the record closes */
function markProfile(){R.profDirty=true;setSaveText('Unsaved changes…');clearTimeout(R.pt);R.pt=setTimeout(function(){saveProfile(true).catch(function(){});},1200);}
async function saveProfile(quiet){
  clearTimeout(R.pt);
  var p=byId(R.id);if(!p||!document.getElementById('p_name'))return false;
  var g=function(id){var e=document.getElementById(id);return e?String(e.value||'').trim():'';};
  var name=g('p_name');
  if(!name){if(quiet){setSaveText('Name is empty · not saved',true);return false;}throw new Error('The name cannot be empty.');}
  var h=g('p_height'),cm=null,mt=h.match(/(\d{3})\s*cm/i);if(mt)cm=Number(mt[1]);
  var patch={display_name:name,email:g('p_email')||null,phone:g('p_phone')||null,instagram:g('p_ig')||null,tiktok:g('p_tt')||null,city:g('p_city')||null,country:g('p_country')||null,date_of_birth:g('p_dob')||null,height_display:h||null,height_cm:cm!=null?cm:p.height_cm,source:g('p_source')||null,target_market_id:g('p_market')||null,target_division_id:g('p_div')||null,assigned_member_id:g('p_agent')||null,notes:g('p_notes')||null};
  R.profDirty=false;setSaveText('Saving…');
  try{
    var out=await serial(function(){return post(fullPayload(p,patch));});
    if(!out||out.verified!==true)throw new Error('The details were not confirmed as saved.');
    if(out.prospect){var keep={};['scouting_media','organization_members','markets','divisions','boards'].forEach(function(k){keep[k]=p[k];});Object.assign(p,out.prospect,keep);}
    if(quiet){R.saved=true;R.failed=null;setSaveText('Saved');}
    return true;
  }catch(e){R.profDirty=true;R.failed=msg(e);setSaveText('Not saved · tap to retry',true);toast('Could not save: '+msg(e),true);throw e;}
}
function fullPayload(p,patch){
  var md=p.metadata||{};
  return Object.assign({action:'update',prospect_id:p.id,display_name:p.display_name,first_name:p.first_name,last_name:p.last_name,pronouns:p.pronouns,email:p.email,phone:p.phone,instagram:p.instagram,tiktok:p.tiktok,city:p.city,country:p.country,date_of_birth:p.date_of_birth,age_reported:p.age_reported,height_cm:p.height_cm,height_display:p.height_display,stage:p.stage,status:p.status||'active',source:p.source,target_market_id:p.target_market_id,target_division_id:p.target_division_id,assigned_member_id:p.assigned_member_id,tags:arr(p.tags),notes:p.notes,board_id:md.preferred_board_id||null,questionnaire:md.questionnaire||{}},patch||{});
}
async function moveTo(stepKey,opts){
  opts=opts||{};
  var p=byId(R.id);if(!p)return;
  var step=STEPS[IDX[stepKey]];if(!step)return;
  if(R.profDirty){try{await saveProfile(true);}catch(e){return;}}
  if(R.busy)return;R.busy=true;
  try{
    await flush();
    var logText=opts.note||('Moved to '+step.label);
    var out=await post({action:'scout_save',prospect_id:p.id,scout:{step:stepKey},log_entry:{type:'step',text:logText}});
    if(!out||out.verified!==true)throw new Error('The step was not confirmed as saved.');
    if(step.stage!==p.stage){
      var mv=await post({action:'move_stage',prospect_id:p.id,stage:step.stage,reason:step.label});
      if(!mv||mv.verified!==true)throw new Error('The stage change was not confirmed.');
    }
    await load();
    var np=byId(p.id);R.sc=clone(scoutOf(np));R.dirty={};
    paintPage();
    R.tab=step.tab;
    if(!opts.quiet)toast('Moved to '+step.label);
    paintRecord();
    /* the form that belongs to the new step pops up */
    if(stepKey==='call_done'&&!opts.quiet){R.call.i=0;openCall();}
  }catch(e){toast(msg(e),true);}
  R.busy=false;
}
async function decline(){
  var p=byId(R.id);if(!p)return;
  var why=window.prompt('Why are they not moving forward? (optional)','');
  if(why===null)return;
  try{
    await post({action:'scout_save',prospect_id:p.id,scout:{step:'declined'},log_entry:{type:'step',text:'Declined'+(why?' · '+why:'')}});
    var mv=await post({action:'move_stage',prospect_id:p.id,stage:'declined',reason:why||'Declined'});
    if(!mv||mv.verified!==true)throw new Error('The stage change was not confirmed.');
    await load();paintPage();R.sc=clone(scoutOf(byId(p.id)));paintRecord();toast('Marked as declined');
  }catch(e){toast(msg(e),true);}
}
function addLog(text,type){
  var p=byId(R.id);if(!p||!text)return Promise.resolve();
  return post({action:'scout_save',prospect_id:p.id,scout:{},log_entry:{type:type||'note',text:text}}).then(function(out){if(out&&out.prospect){p.metadata=out.prospect.metadata;R.sc.log=clone(out.prospect.metadata.scout||{}).log||R.sc.log;}});
}
async function doAction(a,btn){
  var p=byId(R.id);if(!p)return;
  var o=R.sc.outreach||{},m=o.model||{},ma=o.ma||{};
  if(R.profDirty&&a!=='save_profile'){try{await saveProfile(true);}catch(e){return;}}
  try{
    if(a==='save_profile'){
      await saveProfile(false);
      await flush();await load();paintPage();R.sc=clone(scoutOf(byId(p.id)));paintRecord();toast('✓ Details saved');
    }else if(a==='email_model'||a==='email_ma'){
      var kind=a==='email_ma'?'ma':'model',t=mailFor(p,kind),addr=kind==='ma'?ma.email:p.email;
      if(!addr)throw new Error('There is no email address yet.');
      if(window.MDV_MAIL&&MDV_MAIL.emailTo){closeModal();window.MDV_MAIL.emailTo([addr],{subject:t.subject,text:t.body});}
      else window.location.href='mailto:'+addr+'?subject='+encodeURIComponent(t.subject)+'&body='+encodeURIComponent(t.body);
    }else if(a==='email_call'){
      var ck=btn&&btn.dataset.kind==='ma'?'ma':'model',cm=callMailFor(p,ck),ca=ck==='ma'?ma.email:p.email;
      if(!ca)throw new Error('There is no email address yet.');
      if(!(R.sc.call||{}).scheduled_at)throw new Error('Pick a date and time first.');
      var cur=((R.sc.call||{}).confirm||{})[ck];if(!cur||cur==='Not sent')setPath(R.sc,'call.confirm.'+ck,'Sent');
      setPath(R.sc,'call.sent.'+ck+'_at',nowIso());R.dirty.call=true;await flush();
      await addLog('Sent the interest call details to the '+(ck==='ma'?'mother agent':'model'),'outreach');
      if(window.MDV_MAIL&&MDV_MAIL.emailTo){closeModal();window.MDV_MAIL.emailTo([ca],{subject:cm.subject,text:cm.body});}
      else window.location.href='mailto:'+ca+'?subject='+encodeURIComponent(cm.subject)+'&body='+encodeURIComponent(cm.body);
    }else if(a==='reset_call_mail'){
      var rk=btn&&btn.dataset.kind==='ma'?'ma':'model';
      setPath(R.sc,'call.send.'+rk+'.subject','');setPath(R.sc,'call.send.'+rk+'.body','');R.dirty.call=true;await flush();paintRecord();toast('Back to the suggested email');
    }else if(a==='reset_mail'){
      var kk=btn&&btn.dataset.kind==='ma'?'ma':'model';
      setPath(R.sc,'outreach.'+kk+'.subject','');setPath(R.sc,'outreach.'+kk+'.body','');R.dirty.outreach=true;await flush();paintRecord();toast('Back to the suggested email');
    }else if(a==='mark_model'){
      setPath(R.sc,'outreach.model.emailed_at',nowIso());if(!m.status||m.status==='Not contacted')setPath(R.sc,'outreach.model.status','Emailed');R.dirty.outreach=true;await flush();
      await addLog('Emailed the model','outreach');
      if(IDX[stepOf(p)]==null||IDX[stepOf(p)]<IDX.emailed_model)await moveTo('emailed_model',{note:'Emailed the model'});else paintRecord();
    }else if(a==='mark_ma'){
      setPath(R.sc,'outreach.ma.emailed_at',nowIso());if(!ma.status||ma.status==='Not contacted')setPath(R.sc,'outreach.ma.status','Emailed');R.dirty.outreach=true;await flush();
      await addLog('Emailed the mother agent'+(ma.name?' · '+ma.name:''),'outreach');
      if(IDX[stepOf(p)]==null||IDX[stepOf(p)]<IDX.emailed_ma)await moveTo('emailed_ma',{note:'Emailed the mother agent'});else paintRecord();
    }else if(a==='add_log'){
      var inp=document.getElementById('sr-lognote'),txt=inp?inp.value.trim():'';if(!txt)return;
      await addLog(txt,'outreach');paintRecord();
    }else if(a==='schedule_call'){
      var c=R.sc.call||{};if(!c.scheduled_at)throw new Error('Pick a date and time first.');
      await flush();
      var linkText=String(c.link||'').trim(),url=(linkText.match(/https?:\/\/[^\s<>"']+/)||[])[0]||'',place=[c.channel,url||(linkText.length<=80?linkText:'')].filter(Boolean).join(' · ')||null;
      await post({action:'schedule_meeting',prospect_id:p.id,meeting_type:'intro',starts_at:c.scheduled_at,location:place?place.slice(0,200):null,notes:('Interest call with '+p.display_name+(linkText&&linkText!==url?'\n'+linkText:'')).slice(0,1200)});
      await moveTo('call_scheduled',{note:'Interest call scheduled for '+fmt(c.scheduled_at,true)});
    }else if(a==='open_call'){
      openCall();
    }else if(a==='merge'){
      if(!isSigned(stepOf(p))){await moveTo('signed',{note:'Signed'});p=byId(R.id);}
      await flush();
      var of=R.sc.offer||{};
      var res=await post({action:'convert_to_model',prospect_id:p.id,market_id:of.market_id||null,division_id:of.division_id||null,board_id:of.board_id||null,model_stage:of.model_stage||'development'});
      if(!res||res.verified!==true)throw new Error('The transfer was not confirmed.');
      var meas=measurementsForModel(p);
      var link=await post({action:'link_to_model',prospect_id:p.id,model_id:res.model_id||(res.model&&res.model.id),measurements:meas,note:summaryNote(p)});
      await addLog('Merged into the model profile','step');
      await load();R.sc=clone(scoutOf(byId(p.id)));paintPage();paintRecord();
      toast('✓ Model profile created'+(link&&link.measurements_filled&&link.measurements_filled.length?' · measurements carried over':''));
    }else if(a==='send_sign'){
      var who=btn&&btn.dataset.who==='ma'?'ma':'model',isMa=who==='ma',mi2=(R.sc.outreach&&R.sc.outreach.ma)||{};
      if(isMa&&!mi2.email)throw new Error('Add the MA\u2019s email on the Outreach tab first.');
      var cid=await ensureContract(p,who);await loadLegal(true);
      var rec=contractRec(who)||{id:cid,title:(isMa?'Mother agency agreement \u00b7 ':'Representation agreement \u00b7 ')+p.display_name,structured_terms:{}};
      MDV_CONTRACTS.dialog({contract:rec,signers:[isMa?{display_name:mi2.name||mi2.agency||'Mother agent',email:mi2.email||''}:{display_name:p.display_name,email:p.email||''}],
        onChange:function(){loadLegal(true);},
        onSent:async function(){
          setPath(R.sc,isMa?'contract.ma.sent_at':'contract.sent_at',nowIso().slice(0,10));R.dirty.contract=true;await flush(true);
          await addLog(isMa?'Mother agency contract sent for e-signature':'Contract sent for e-signature','step');
          if(!isMa&&(IDX[stepOf(p)]==null||IDX[stepOf(p)]<IDX.contract))await moveTo('contract',{note:'Contract sent for e-signature',quiet:true});
          await loadLegal(true);paintRecord();
        }});
    }else if(a==='refresh_sign'){
      await loadLegal(true);paintRecord();toast('Status updated');
    }else if(a==='view_pdf'){
      if(window.MDV_CONTRACTS&&btn)MDV_CONTRACTS.openDoc(btn.dataset.doc);
    }else if(a==='remove_pdf'){
      if(!btn||!window.confirm('Remove this PDF from the contract?'))return;
      await MDV_CONTRACTS.detach(cstate(btn.dataset.who==='ma'?'ma':'model').contract_id,btn.dataset.doc);
      await loadLegal(true);paintRecord();toast('PDF removed');
    }else if(a==='mark_signed'){
      setPath(R.sc,'contract.signed_at',nowIso().slice(0,10));R.dirty.contract=true;await flush(true);
      await moveTo('signed',{note:'Contract signed by everyone'});
    }else if(a==='open_model'){
      var id=p.converted_model_id||(R.sc.linked&&R.sc.linked.model_id);
      if(id){closeModal();window._veuxV10ModelId=id;if(typeof window.navTo==='function')window.navTo('modelpage');}
    }
  }catch(e){toast(msg(e),true);}
}
function wireRecord(m,p){
  m.querySelectorAll('[data-x]').forEach(function(b){b.onclick=closeModal;});
  m.querySelectorAll('[data-tab]').forEach(function(b){b.onclick=async function(){try{if(R.profDirty)await saveProfile(true);await flush();}catch(e){return;}R.tab=b.dataset.tab;paintRecord();};});
  m.querySelectorAll('[data-go]').forEach(function(b){b.onclick=function(){moveTo(b.dataset.go);};});
  m.querySelectorAll('[data-do]').forEach(function(b){b.onclick=function(){doAction(b.dataset.do,b);};});
  var pdf=m.querySelector('#sr-pdf');
  if(pdf)pdf.onchange=async function(){
    var file=pdf.files&&pdf.files[0];if(!file)return;
    try{
      var cid=await ensureContract(p);
      var doc=await MDV_CONTRACTS.upload(file,cid);await MDV_CONTRACTS.attach(cid,doc.id);
      await addLog('Contract PDF uploaded · '+file.name,'step');
      await loadLegal(true);paintRecord();toast('✓ Contract PDF attached');
    }catch(e){toast(msg(e),true);}
  };
  var pdfMa=m.querySelector('#sr-pdf-ma');
  if(pdfMa)pdfMa.onchange=async function(){
    var file=pdfMa.files&&pdfMa.files[0];if(!file)return;
    try{
      var cid=await ensureContract(p,'ma');
      var doc=await MDV_CONTRACTS.upload(file,cid);await MDV_CONTRACTS.attach(cid,doc.id);
      await addLog('Mother agency contract PDF uploaded \u00b7 '+file.name,'step');
      await loadLegal(true);paintRecord();toast('\u2713 MA contract attached');
    }catch(e){toast(msg(e),true);}
  };
  wireInputs(m);
  m.querySelectorAll('[id^="p_"]').forEach(function(e){var h=function(){markProfile();};e.addEventListener(e.tagName==='SELECT'||e.type==='date'?'change':'input',h);if(e.tagName!=='SELECT'&&e.type!=='date')e.addEventListener('change',h);});
  m.querySelectorAll('[data-ph]').forEach(function(b){b.onclick=function(){R.lead=+b.dataset.ph;paintRecord();};});
  var zm=m.querySelector('[data-zoom]');if(zm)zm.onclick=function(){lightbox(zm.src);};
  var tg=m.querySelector('[data-tab-go]');if(tg)tg.onclick=function(){R.tab=tg.dataset.tabGo;paintRecord();};
  var f=m.querySelector('#sr-files');
  if(f)f.onchange=async function(){
    var files=Array.from(f.files||[]);if(!files.length)return;
    try{
      if(window.VEUX_V1686&&VEUX_V1686.uploadScout){await VEUX_V1686.uploadScout(p.id,files);await load();paintRecord();return;}
      throw new Error('Image upload is not ready yet.');
    }catch(e){toast(msg(e),true);}
  };
  var foot=document.createElement('div');foot.className='sr-foot';
  foot.innerHTML='<button type="button" class="sr-btn danger" data-decline>Decline</button>';
  var main=m.querySelector('.sr-main');if(main)main.appendChild(foot);
  var dc=foot.querySelector('[data-decline]');if(dc)dc.onclick=decline;
}
document.addEventListener('keydown',function(e){
  if(e.key!=='Escape')return;
  var c=document.getElementById('sr-call');if(c){e.stopPropagation();flush();c.remove();paintRecord();return;}
  if(document.getElementById('sr-modal'))closeModal();
},true);

/* ---------- take over the page ---------- */
function install(){
  try{
    Object.defineProperty(window,'renderScoutingRecords',{configurable:true,get:function(){return render;},set:function(){}});
  }catch(e){window.renderScoutingRecords=render;}
  var map=window.VEUX_V15_ROUTE_RENDERERS;
  if(map&&typeof map==='object')map.scouting=function(el){return render(el);};
  /* the older Scouting forms had empty market / board lists here: send them to the Scout Records forms instead */
  [window.VEUX_V1686,window.VEUX_V153,window.VEUX_DESK&&window.VEUX_DESK.scouting].forEach(function(o){
    if(!o||o.__srPatched)return;
    try{
      o.newProspect=function(){newProspect();};
      if(o.editProspect)o.editProspect=function(id){byId(id)?openRecord(id,'profile'):load().then(function(){openRecord(id,'profile');});};
      if(o.scoutDetail)o.scoutDetail=function(id){byId(id)?openRecord(id):load().then(function(){openRecord(id);});};
      o.__srPatched=true;
    }catch(e){}
  });
}
install();
var n=0,t=setInterval(function(){install();if(++n>40)clearInterval(t);},500);
window.MDV_SCOUT_RECORDS={render:render,open:openRecord,steps:STEPS,current:function(){return document.getElementById('sr-modal')?R.id:null;}};
})();
