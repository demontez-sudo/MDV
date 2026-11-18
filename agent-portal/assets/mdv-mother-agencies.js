/* Mother Agencies (staff side): every mother agency, how complete its profile is, what is expiring, who the models are,
   and the key to its portal at maisondeveux.com/ma. */
(function(){
'use strict';
if(window.__MDV_MAG__)return;window.__MDV_MAG__=true;

var S={host:null,list:null,loading:false,error:null,filter:'all',q:'',open:null,detail:null,detailLoading:false,edit:false,code:null,busy:''};
var PORTAL='https://www.maisondeveux.com/ma';
var FIELDS=[['tagline','Tagline',1],['bio','About',1],['city','City'],['country','Country'],['founded_year','Founded'],['website','Website'],['instagram','Instagram'],['contact_name','Contact person'],['contact_role','Their role'],['contact_email','Contact email'],['contact_phone','Contact phone'],['whatsapp','WhatsApp']];

function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
function arr(v){return Array.isArray(v)?v:[];}
function bridge(){if(!window.VEUX_AGENT_V4||!window.VEUX_AGENT_V4.api)throw new Error('The secure connection is not ready yet');return window.VEUX_AGENT_V4;}
function org(){var s=bridge().state||{};return (s.org&&s.org.slug)||'maison-de-veux';}
function get(path){return bridge().api(path,{method:'GET',headers:{}});}
function post(body){return bridge().api('/api/agent/mother-agencies',{method:'POST',body:JSON.stringify(Object.assign({organization_slug:org()},body))});}
function toast(m){try{if(window.toast)return window.toast(m);}catch(e){}}
function initials(n){return String(n||'?').trim().split(/\s+/).slice(0,2).map(function(x){return x[0]||'';}).join('').toUpperCase()||'?';}
function ago(iso){var t=iso?new Date(iso).getTime():NaN;if(!isFinite(t))return '';var d=Math.floor((Date.now()-t)/864e5);if(d<1)return 'today';if(d<2)return 'yesterday';if(d<31)return d+' days ago';var m=Math.round(d/30);return m<12?m+' mo ago':'over a year ago';}

/* ---------- the smart bits: one verdict per agency ---------- */
function accessState(a){
  var x=a.access||{};
  if(x.locked)return {k:'bad',t:'Locked',s:'Too many wrong codes. Unlocks by itself, or reset the code.'};
  if(x.portal_enabled===false)return {k:'off',t:'Disabled',s:'Portal switched off'};
  if(!x.has_code)return {k:'warn',t:'No access yet',s:'Create an access code to let them in'};
  if(!x.last_login_at)return {k:'info',t:'Ready',s:'Code made '+ago(x.set_at)+' · never signed in'};
  return {k:'ok',t:'Active',s:'Last sign-in '+ago(x.last_login_at)};
}
function flags(a){
  var f=[],ac=accessState(a);
  if(ac.k==='warn')f.push({tone:'warn',text:'No portal access'});
  if(ac.k==='bad')f.push({tone:'bad',text:'Portal locked'});
  if(a.expired)f.push({tone:'bad',text:a.expired+' document'+(a.expired===1?'':'s')+' expired'});
  if(a.expiring)f.push({tone:'warn',text:a.expiring+' expiring soon'});
  var miss=arr(a.documents).filter(function(d){return d.state==='missing';}).length;
  if(miss)f.push({tone:'info',text:miss+' document'+(miss===1?'':'s')+' missing'});
  if(a.profile&&a.profile.score<60)f.push({tone:'info',text:'Profile '+a.profile.score+'%'});
  if(ac.k==='info'&&a.access.set_at&&(Date.now()-new Date(a.access.set_at).getTime())>14*864e5)f.push({tone:'info',text:'Never signed in'});
  return f;
}
function needsAttention(a){return flags(a).some(function(x){return x.tone==='bad'||x.tone==='warn';});}
function shown(){
  var q=S.q.trim().toLowerCase();
  return arr(S.list).filter(function(a){
    if(q&&(a.name+' '+a.city+' '+a.country).toLowerCase().indexOf(q)<0)return false;
    var ac=accessState(a);
    if(S.filter==='noaccess')return ac.k==='warn'||ac.k==='bad';
    if(S.filter==='attention')return needsAttention(a);
    if(S.filter==='disabled')return ac.k==='off';
    return true;
  });
}

/* ---------- list ---------- */
function kpis(){
  var l=arr(S.list),acs=l.map(accessState);
  function c(fn){return l.filter(fn).length;}
  var cells=[['Mother agencies',l.length,''],['With access',acs.filter(function(a){return a.k==='ok'||a.k==='info';}).length,'ok'],['Need access',acs.filter(function(a){return a.k==='warn'||a.k==='bad';}).length,acs.some(function(a){return a.k==='warn'||a.k==='bad';})?'warn':''],['Documents to renew',l.reduce(function(n,a){return n+a.expired+a.expiring;},0),c(function(a){return a.expired;})?'bad':c(function(a){return a.expiring;})?'warn':''],['Models represented',l.reduce(function(n,a){return n+a.models;},0),'']];
  return '<div class="mag-kpis">'+cells.map(function(x){return '<div class="mag-kpi '+x[2]+'"><b>'+x[1]+'</b><small>'+esc(x[0])+'</small></div>';}).join('')+'</div>';
}
function row(a){
  var ac=accessState(a),f=flags(a).slice(0,3),score=a.profile.score,tone=score>=80?'ok':score>=50?'warn':'bad';
  var docs=arr(a.documents).map(function(d){return '<i class="mag-dd '+d.state+'" title="'+esc(d.label+': '+(d.state==='missing'?'not on file':d.state==='expired'?'expired':d.state==='expiring'?'expires in '+d.days_left+' days':'on file'))+'"></i>';}).join('');
  var logo=a.logo_url?'<img src="'+esc(a.logo_url)+'" alt="">':'<span>'+esc(initials(a.name))+'</span>';
  return '<article class="mag-row" tabindex="0" onclick="MDV_MAG.open(\''+esc(a.id)+'\')" onkeydown="if(event.key===\'Enter\')MDV_MAG.open(\''+esc(a.id)+'\')">'
   +'<div class="mag-logo">'+logo+'</div>'
   +'<div class="mag-main"><h3>'+esc(a.name)+'</h3><p>'+esc([a.city,a.country].filter(Boolean).join(', ')||'Location not added')+' · '+a.models+' model'+(a.models===1?'':'s')+'</p>'+(f.length?'<div class="mag-flags">'+f.map(function(x){return '<span class="'+x.tone+'">'+esc(x.text)+'</span>';}).join('')+'</div>':'<div class="mag-flags"><span class="ok">All good</span></div>')+'</div>'
   +'<div class="mag-col mag-prof"><small>Profile</small><div class="mag-bar '+tone+'"><i style="width:'+score+'%"></i></div><b>'+score+'%</b></div>'
   +'<div class="mag-col mag-docs"><small>Documents</small><div class="mag-dds">'+docs+'</div></div>'
   +'<div class="mag-col mag-acc"><small>Portal</small><span class="mag-pill '+ac.k+'">'+esc(ac.t)+'</span><em>'+esc(ac.s)+'</em></div>'
   +'</article>';
}
function listHtml(){
  var rows=shown();
  var chips=[['all','All'],['attention','Needs attention'],['noaccess','No access'],['disabled','Disabled']].map(function(c){return '<button type="button" class="mag-chip'+(S.filter===c[0]?' on':'')+'" onclick="MDV_MAG.filter(\''+c[0]+'\')">'+c[1]+'</button>';}).join('');
  return '<div class="mag-tools"><div class="mag-chips">'+chips+'</div><input class="mag-search" type="search" placeholder="Search agencies" value="'+esc(S.q)+'" oninput="MDV_MAG.search(this.value)"></div>'
   +(rows.length?'<div class="mag-rows">'+rows.map(row).join('')+'</div>':'<div class="mag-empty">'+(arr(S.list).length?'No agencies match.':'No mother agencies yet. Add one to give them a portal.')+'</div>');
}
function paint(){
  var el=S.host;if(!el||!document.body.contains(el))return;
  if(S.loading&&!S.list){el.innerHTML='<div class="mag-page"><div class="mag-empty">Loading mother agencies…</div></div>';return;}
  if(S.error&&!S.list){el.innerHTML='<div class="mag-page"><div class="mag-empty">'+esc(S.error)+'</div><p style="text-align:center"><button class="mag-btn" onclick="MDV_MAG.reload()">Try again</button></p></div>';return;}
  var keep=document.activeElement&&document.activeElement.classList&&document.activeElement.classList.contains('mag-search');
  el.innerHTML='<div class="mag-page"><header class="mag-head"><div><div class="mag-kicker">AGENCY</div><h1>Mother Agencies</h1><p>Their profiles, documents and models, and the access that lets each agency into its own portal.</p></div><div class="mag-headact"><a class="mag-btn" href="'+PORTAL+'" target="_blank" rel="noopener">Open the MA portal</a><button type="button" class="mag-btn" onclick="MDV_MAG.openBulk()">Connect models</button><button type="button" class="mag-btn gold" onclick="MDV_MAG.add()">+ Add mother agency</button></div></header>'+kpis()+listHtml()+'</div>';
  if(keep){var s=el.querySelector('.mag-search');if(s){s.focus();var n=s.value.length;try{s.setSelectionRange(n,n);}catch(e){}}}
}

/* ---------- drawer ---------- */
function drawerEl(){var d=document.getElementById('mag-drawer');if(!d){d=document.createElement('div');d.id='mag-drawer';d.className='mag-drawer';d.onclick=function(e){if(e.target===d)close();};document.body.appendChild(d);}return d;}
function close(){S.open=null;S.detail=null;S.edit=false;S.code=null;var d=document.getElementById('mag-drawer');if(d)d.remove();document.removeEventListener('keydown',onKey);}
function onKey(e){if(e.key!=='Escape')return;var m=document.getElementById('mag-pick')||document.getElementById('mag-bulk');if(m){closeModal(m.id);return;}close();}
function accessPanel(a){
  var ac=accessState(a),x=a.access||{};
  var msg=S.code?('Sign in to the Mother Agency portal\n'+PORTAL+'\n\nAgency: '+a.name+'\nAccess code: '+S.code):'';
  var codeBox=S.code?'<div class="mag-code"><small>Access code — shown once, copy it now</small><b>'+esc(S.code)+'</b><div class="mag-code-act"><button type="button" class="mag-btn" onclick="MDV_MAG.copy(\'code\')">Copy code</button><button type="button" class="mag-btn gold" onclick="MDV_MAG.copy(\'message\')">Copy message to send</button></div><pre id="mag-msg">'+esc(msg)+'</pre></div>':'';
  return '<section class="mag-sec"><header><h4>Portal access</h4><span class="mag-pill '+ac.k+'">'+esc(ac.t)+'</span></header><p class="mag-sub">'+esc(ac.s)+'. They sign in at <b>'+PORTAL.replace('https://www.','')+'</b> with the agency name and the code.</p>'+codeBox
   +'<div class="mag-actions">'+(x.has_code?'<button type="button" class="mag-btn" '+(S.busy?'disabled':'')+' onclick="MDV_MAG.access(\'set_access\')">Reset code</button><button type="button" class="mag-btn" onclick="MDV_MAG.access(\'clear_access\')">Remove access</button>':'<button type="button" class="mag-btn gold" '+(S.busy?'disabled':'')+' onclick="MDV_MAG.access(\'set_access\')">Create access code</button>')
   +(x.has_code?'<button type="button" class="mag-btn" onclick="MDV_MAG.portal('+(x.portal_enabled===false?'true':'false')+')">'+(x.portal_enabled===false?'Enable portal':'Disable portal')+'</button>':'')+'</div></section>';
}
function profilePanel(d){
  var f=d.agency.fields||{};
  if(S.edit){
    return '<section class="mag-sec"><header><h4>Edit profile</h4></header><div class="mag-form">'+FIELDS.map(function(x){return '<label class="'+(x[2]?'full':'')+'"><span>'+esc(x[1])+'</span>'+(x[0]==='bio'?'<textarea id="mag-f-'+x[0]+'" rows="5">'+esc(f[x[0]]||'')+'</textarea>':'<input id="mag-f-'+x[0]+'" value="'+esc(f[x[0]]||'')+'">')+'</label>';}).join('')+'</div><div class="mag-actions"><button type="button" class="mag-btn" onclick="MDV_MAG.edit(false)">Cancel</button><button type="button" class="mag-btn gold" onclick="MDV_MAG.save()">Save</button></div></section>';
  }
  function r(k,v){return '<div><small>'+esc(k)+'</small><b>'+(v?esc(v):'<i class="mag-none">Not added</i>')+'</b></div>';}
  var miss=arr(d.agency.profile.missing);
  return '<section class="mag-sec"><header><h4>Profile</h4><button type="button" class="mag-link" onclick="MDV_MAG.edit(true)">Edit</button></header>'
   +(f.tagline?'<p class="mag-tag">'+esc(f.tagline)+'</p>':'')+(f.bio?'<p class="mag-bio">'+esc(f.bio).replace(/\n/g,'<br>')+'</p>':'')
   +'<div class="mag-grid">'+r('Location',[f.city,f.country].filter(Boolean).join(', '))+r('Founded',f.founded_year)+r('Website',f.website)+r('Instagram',f.instagram)+r('Contact',[f.contact_name,f.contact_role].filter(Boolean).join(' · '))+r('Email',f.contact_email)+r('Phone',f.contact_phone)+r('WhatsApp',f.whatsapp)+'</div>'
   +(miss.length?'<p class="mag-miss">Still missing: '+esc(miss.join(', '))+'.</p>':'')+'</section>';
}
function docsPanel(d){
  var all=arr(d.agency.documents).map(function(x){var have=arr(d.documents).filter(function(q){return q.type===x.type;}).sort(function(a,b){return String(b.uploaded_at).localeCompare(String(a.uploaded_at));})[0];return {s:x,doc:have};});
  var other=arr(d.documents).filter(function(q){return q.type==='other';});
  function state(x,doc){return x?(x.state==='missing'?'Not uploaded':x.state==='expired'?'Expired '+(-x.days_left)+' days ago':x.state==='expiring'?'Expires in '+x.days_left+' days':(x.expires_on?'Valid until '+esc(x.expires_on):'On file')):'On file';}
  return '<section class="mag-sec"><header><h4>Documents</h4></header><div class="mag-docs-l">'+all.map(function(z){return '<div class="mag-doc '+z.s.state+'"><div><b>'+esc(z.s.label)+'</b><em>'+state(z.s)+'</em></div>'+(z.doc?'<button type="button" class="mag-link" onclick="MDV_MAG.view(\''+esc(z.doc.id)+'\')">View</button>':'')+'</div>';}).join('')+other.map(function(q){return '<div class="mag-doc ok"><div><b>'+esc(q.name)+'</b><em>Other</em></div><button type="button" class="mag-link" onclick="MDV_MAG.view(\''+esc(q.id)+'\')">View</button></div>';}).join('')+'</div></section>';
}
function modelsPanel(d){
  var ms=arr(d.models),a=d.agency||{};
  return '<section class="mag-sec"><header><h4>Models</h4><span class="mag-count">'+ms.length+'</span><span class="mag-sec-act"><button type="button" class="mag-btn" onclick="MDV_MAG.openBulk(\''+esc(a.id)+'\')">Paste a list</button><button type="button" class="mag-btn gold" onclick="MDV_MAG.pick(\''+esc(a.id)+'\')">+ Connect models</button></span></header>'
   +(ms.length?'<div class="mag-mods">'+ms.map(function(m){return '<div class="mag-modw"><button type="button" class="mag-mod" onclick="MDV_MAG.model(\''+esc(m.id)+'\')"><span class="mag-mph">'+(m.photo?'<img loading="lazy" src="'+esc(m.photo)+'" alt="">':esc(initials(m.name)))+'</span><b>'+esc(m.name)+'</b><em>'+esc([m.market,m.status].filter(Boolean).join(' · ')||'—')+'</em></button><button type="button" class="mag-mod-x" title="Disconnect from this agency" aria-label="Disconnect '+esc(m.name)+'" onclick="MDV_MAG.disconnect(\''+esc(m.id)+'\',\''+esc(String(m.name).replace(/\\/g,'').replace(/'/g,''))+'\')">×</button></div>';}).join('')+'</div>':'<p class="mag-sub">No models are connected to this agency yet. Choose <b>Connect models</b> to pick them from your roster, or <b>Paste a list</b> of names.</p>')+'</section>';
}
function paintDrawer(){
  var d=drawerEl(),a=S.detail&&S.detail.agency;
  if(S.detailLoading&&!S.detail){d.innerHTML='<aside class="mag-panel"><div class="mag-empty">Loading…</div></aside>';return;}
  if(!S.detail){d.innerHTML='<aside class="mag-panel"><button class="mag-x" onclick="MDV_MAG.close()">×</button><div class="mag-empty">'+esc(S.error||'Could not load this agency.')+'</div></aside>';return;}
  var logo=a.logo_url?'<img src="'+esc(a.logo_url)+'" alt="">':'<span>'+esc(initials(a.name))+'</span>',fl=flags(a);
  d.innerHTML='<aside class="mag-panel" role="dialog" aria-label="'+esc(a.name)+'"><button class="mag-x" aria-label="Close" onclick="MDV_MAG.close()">×</button>'
   +'<div class="mag-phead"><div class="mag-logo big">'+logo+'</div><div><div class="mag-kicker">MOTHER AGENCY</div><h2>'+esc(a.name)+'</h2><p>'+esc([a.city,a.country].filter(Boolean).join(', ')||'Location not added')+' · '+a.models+' model'+(a.models===1?'':'s')+' · profile '+a.profile.score+'%</p></div></div>'
   +(fl.length?'<div class="mag-flags big">'+fl.map(function(x){return '<span class="'+x.tone+'">'+esc(x.text)+'</span>';}).join('')+'</div>':'')
   +accessPanel(a)+profilePanel(S.detail)+docsPanel(S.detail)+modelsPanel(S.detail)+'</aside>';
}

/* ---------- data and actions ---------- */
function load(){
  if(S.loading)return Promise.resolve();
  S.loading=true;S.error=null;paint();
  return get('/api/agent/mother-agencies?organization='+encodeURIComponent(org())).then(function(r){S.list=arr(r.agencies);}).catch(function(e){S.error=(e&&e.message)||'Could not load mother agencies.';}).then(function(){S.loading=false;paint();});
}
function open(id){
  S.open=id;S.detail=null;S.edit=false;S.code=null;S.detailLoading=true;S.error=null;paintDrawer();document.addEventListener('keydown',onKey);
  return get('/api/agent/mother-agencies?organization='+encodeURIComponent(org())+'&partner_id='+encodeURIComponent(id)).then(function(r){S.detail=r;}).catch(function(e){S.error=(e&&e.message)||'';}).then(function(){S.detailLoading=false;paintDrawer();});
}
function refreshOpen(){return open(S.open).then(function(){return load();});}
async function access(kind){
  var a=S.detail&&S.detail.agency;if(!a||S.busy)return;
  if(kind==='clear_access'&&!(await MDV_DIALOG.confirm({title:'Remove portal access?',message:a.name+' will no longer be able to sign in. Their current code stops working straight away. You can create a new one at any time.',confirm:'Remove access',danger:true})))return;
  if(kind==='set_access'&&a.access.has_code&&!(await MDV_DIALOG.confirm({title:'Make a new access code?',message:'The old code for '+a.name+' stops working straight away. You will see the new code once, so be ready to copy it.',confirm:'Make new code'})))return;
  S.busy=kind;paintDrawer();
  try{
    var r=await post({action:kind,partner_id:a.id});
    S.code=r.code||null;
    S.detail.agency=Object.assign({},S.detail.agency,r.agency||{});
    toast(kind==='set_access'?'Access code created':'Access removed');
  }catch(e){toast((e&&e.message)||'Could not change access');}
  S.busy='';paintDrawer();load();
}
async function portal(on){
  var a=S.detail&&S.detail.agency;if(!a)return;
  try{var r=await post({action:'set_portal',partner_id:a.id,enabled:!!on});S.detail.agency=Object.assign({},S.detail.agency,r.agency||{});toast(on?'Portal enabled':'Portal disabled');}catch(e){toast((e&&e.message)||'Could not change the portal');}
  paintDrawer();load();
}
async function save(){
  var a=S.detail&&S.detail.agency;if(!a)return;var p={};FIELDS.forEach(function(x){var el=document.getElementById('mag-f-'+x[0]);if(el)p[x[0]]=el.value;});
  try{await post({action:'save_profile',partner_id:a.id,profile:p});S.edit=false;toast('Profile saved');await refreshOpen();}catch(e){toast((e&&e.message)||'Could not save');}
}
async function view(docId){try{var r=await post({action:'download_url',partner_id:S.open,document_id:docId});if(r&&r.url)window.open(r.url,'_blank','noopener');}catch(e){toast((e&&e.message)||'Could not open the file');}}
function copy(what){
  var a=S.detail&&S.detail.agency,text=what==='code'?S.code:(document.getElementById('mag-msg')||{}).textContent;if(!text)return;
  function ok(){toast(what==='code'?'Code copied':'Message copied');}
  try{navigator.clipboard.writeText(text).then(ok,function(){fallback();});}catch(e){fallback();}
  function fallback(){var t=document.createElement('textarea');t.value=text;document.body.appendChild(t);t.select();try{document.execCommand('copy');ok();}catch(e){toast('Select the text and copy it');}t.remove();}
}
async function add(){
  var f=await MDV_DIALOG.form({title:'Add a mother agency',message:'Use the name exactly as they will type it when signing in to their portal.',fields:[{k:'name',label:'Agency name',required:true,placeholder:'e.g. Zane Models'},{k:'city',label:'City',placeholder:'Optional'},{k:'country',label:'Country',placeholder:'Optional'},{k:'contact_email',label:'Contact email',type:'email',placeholder:'Optional',pattern:'^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$',patternMessage:'Enter a valid email address.'}],confirm:'Add agency'});
  if(!f)return;
  try{var r=await post({action:'create',name:f.name,city:f.city,country:f.country,contact_email:f.contact_email});toast('Mother agency added');await load();if(r&&r.partner_id)open(r.partner_id);}catch(e){MDV_DIALOG.alert({title:'The agency could not be added',message:(e&&e.message)||'Try again in a moment.',tone:'danger'});}
}
function openModel(id){close();window._veuxV10ModelId=id;window._openModelId=id;if(typeof window.navTo==='function')window.navTo('modelpage');}

/* ---------- connecting models to a mother agency ----------
   From an agency's profile: pick models from the roster (search, tick, connect) or paste a list.
   From the Mother Agencies page: connect many models to many agencies in one go from a "Model, Mother Agency" list. */
var LK={dir:null,dirAt:0,pick:null,bulk:null};
function loadDir(force){
  if(!force&&LK.dir&&Date.now()-LK.dirAt<20000)return Promise.resolve(LK.dir);
  return get('/api/agent/mother-agencies?organization='+encodeURIComponent(org())+'&models=1').then(function(r){LK.dir=r;LK.dirAt=Date.now();return r;});
}
function modal(id){var d=document.getElementById(id);if(!d){d=document.createElement('div');d.id=id;d.className='mag-modal';d.onclick=function(e){if(e.target===d)closeModal(id);};document.body.appendChild(d);}return d;}
function closeModal(id){var d=document.getElementById(id);if(d)d.remove();if(id==='mag-pick')LK.pick=null;if(id==='mag-bulk')LK.bulk=null;}
function csvCell(v){v=String(v==null?'':v);return /[",\n]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v;}
function download(name,text){try{var a=document.createElement('a');a.href=URL.createObjectURL(new Blob([text],{type:'text/csv;charset=utf-8'}));a.download=name;document.body.appendChild(a);a.click();setTimeout(function(){URL.revokeObjectURL(a.href);a.remove();},500);}catch(e){toast('Could not make the file');}}

/* ---- 1. the model picker ---- */
function openPick(partnerId){
  var a=S.detail&&S.detail.agency;LK.pick={partnerId:partnerId,name:a?a.name:'',q:'',filter:'free',sel:{},data:null,busy:false,err:''};
  paintPick();
  loadDir(true).then(function(d){if(!LK.pick)return;LK.pick.data=d;paintPick();}).catch(function(e){if(!LK.pick)return;LK.pick.err=(e&&e.message)||'Could not load the models.';paintPick();});
}
function pickRows(){
  var P=LK.pick,d=P.data;if(!d)return [];var q=P.q.trim().toLowerCase();
  return d.models.filter(function(m){
    if(q&&m.name.toLowerCase().indexOf(q)<0)return false;
    if(m.agency_id===P.partnerId)return false;                     /* already with this agency: it shows in the Models list instead */
    if(P.filter==='free')return !m.agency_id;
    if(P.filter==='other')return !!m.agency_id;
    return true;
  });
}
function paintPick(){
  var P=LK.pick;if(!P)return;var el=modal('mag-pick'),n=Object.keys(P.sel).length,oldList=el.querySelector('.mag-pk-list'),keepTop=oldList?oldList.scrollTop:0;
  var body;
  if(P.err)body='<div class="mag-empty">'+esc(P.err)+'</div>';
  else if(!P.data)body='<div class="mag-empty">Loading models…</div>';
  else{
    var rows=pickRows(),free=P.data.models.filter(function(m){return !m.agency_id;}).length;
    var chips=[['free','Not connected ('+free+')'],['other','With another agency'],['all','All models']].map(function(c){return '<button type="button" class="mag-chip'+(P.filter===c[0]?' on':'')+'" onclick="MDV_MAG.pickFilter(\''+c[0]+'\')">'+c[1]+'</button>';}).join('');
    body='<div class="mag-pk-tools"><input class="mag-search" type="search" placeholder="Search models" value="'+esc(P.q)+'" oninput="MDV_MAG.pickSearch(this.value)" autofocus><div class="mag-chips">'+chips+'</div></div>'
      +'<div class="mag-pk-list">'+(rows.length?rows.slice(0,400).map(function(m){var on=!!P.sel[m.id];return '<label class="mag-pk-row'+(on?' on':'')+'"><input type="checkbox" '+(on?'checked ':'')+'onchange="MDV_MAG.pickToggle(\''+esc(m.id)+'\',this.checked)"><b>'+esc(m.name)+'</b>'+(m.agency_name?'<em class="warn">With '+esc(m.agency_name)+', will move here</em>':'<em>Not connected</em>')+'</label>';}).join('')+(rows.length>400?'<p class="mag-sub">Showing the first 400. Search to narrow it down.</p>':''):'<div class="mag-empty">'+(P.q?'No models match.':P.filter==='free'?'Every model is already connected to a mother agency.':'No models to show.')+'</div>')+'</div>';
  }
  el.innerHTML='<div class="mag-box" role="dialog" aria-label="Connect models"><header><div><div class="mag-kicker">CONNECT MODELS</div><h3>'+esc(P.name||'Mother agency')+'</h3></div><button class="mag-x" aria-label="Close" onclick="MDV_MAG.closeModal(\'mag-pick\')">×</button></header>'+body+'<footer><span class="mag-sub">'+n+' selected</span><button type="button" class="mag-btn" onclick="MDV_MAG.openBulk(\''+esc(P.partnerId)+'\')">Paste a list instead</button><button type="button" class="mag-btn gold" '+(n&&!P.busy?'':'disabled ')+'onclick="MDV_MAG.pickGo()">'+(P.busy?'Connecting…':'Connect '+(n||'')+' model'+(n===1?'':'s'))+'</button></footer></div>';
  var nl=el.querySelector('.mag-pk-list');if(nl)nl.scrollTop=keepTop;
  var s=el.querySelector('.mag-search');if(s&&document.activeElement!==s&&P.focusSearch){s.focus();var l=s.value.length;try{s.setSelectionRange(l,l);}catch(e){}}
}
async function pickGo(){
  var P=LK.pick;if(!P||P.busy)return;var ids=Object.keys(P.sel);if(!ids.length)return;
  var moving=ids.filter(function(id){var m=P.data.models.find(function(x){return x.id===id;});return m&&m.agency_id;}).length;
  if(moving&&!(await MDV_DIALOG.confirm({title:'Move '+moving+' model'+(moving===1?'':'s')+'?',message:(moving===1?'This model is':'These models are')+' connected to another mother agency now. Connecting '+(moving===1?'it':'them')+' here ends that connection.',confirm:'Move and connect'})))return;
  P.busy=true;paintPick();
  try{
    var r=await post({action:'connect_models',partner_id:P.partnerId,model_ids:ids});
    toast(r.connected+' model'+(r.connected===1?'':'s')+' connected'+(r.failed?' · '+r.failed+' could not be connected':''));
    closeModal('mag-pick');LK.dirAt=0;
    if(S.open===P.partnerId)await refreshOpen();else load();
  }catch(e){P.busy=false;P.err=(e&&e.message)||'Could not connect.';paintPick();}
}
async function disconnect(modelId,name){
  var a=S.detail&&S.detail.agency;if(!a)return;
  if(!(await MDV_DIALOG.confirm({title:'Disconnect '+name+'?',message:name+' is no longer represented by '+a.name+' and leaves its portal. You can connect them again any time.',confirm:'Disconnect',danger:true})))return;
  try{await post({action:'disconnect_model',partner_id:a.id,model_id:modelId});toast(name+' disconnected');LK.dirAt=0;await refreshOpen();}catch(e){toast((e&&e.message)||'Could not disconnect');}
}

/* ---- 2. the list format ---- */
var TEMPLATE='Model,Mother Agency\nLovelyn Okoro,Zane Models\nSullivan Jordan,Elite Model Management\nZhiyan Li,Next Agency\n';
function openBulk(partnerId){
  closeModal('mag-pick');
  var fixed=partnerId||'',a=fixed&&S.detail&&S.detail.agency&&S.detail.agency.id===fixed?S.detail.agency:null;
  LK.bulk={fixed:fixed,name:a?a.name:'',text:'',res:null,dec:{},busy:false,done:null,err:''};
  if(fixed&&!a)loadDir(false).then(function(d){var x=d.agencies.find(function(g){return g.id===fixed;});if(LK.bulk&&x){LK.bulk.name=x.name;paintBulk();}});
  paintBulk();
}
function bulkHelp(B){
  return B.fixed?'<p class="mag-sub">One model per line. Paste names from a sheet, a message or an email. They all go to <b>'+esc(B.name||'this agency')+'</b>.</p><pre class="mag-ex">Lovelyn Okoro\nSullivan Jordan\nZhiyan Li</pre>'
   :'<p class="mag-sub">One connection per line: the <b>model</b>, then the <b>mother agency</b>, separated by a comma, a tab (straight from Excel or Sheets), a semicolon, a pipe or a dash. A header line is fine. Names do not have to be exact: “Zane” finds “Zane Models”.</p><pre class="mag-ex">Model, Mother Agency\nLovelyn Okoro, Zane Models\nSullivan Jordan, Elite\nZhiyan Li, Next Agency</pre>';
}
function paintBulk(){
  var B=LK.bulk;if(!B)return;var el=modal('mag-bulk'),r=B.res,oldW=el.querySelector('.mag-bk-wrap'),keepB=oldW?oldW.scrollTop:0;
  var head='<header><div><div class="mag-kicker">CONNECT MODELS</div><h3>'+(B.fixed?'Paste a list for '+esc(B.name||'this agency'):'Connect models from a list')+'</h3></div><button class="mag-x" aria-label="Close" onclick="MDV_MAG.closeModal(\'mag-bulk\')">×</button></header>';
  var body;
  if(B.done){
    var d=B.done,bad=(d.results||[]).filter(function(x){return !x.ok;});
    body='<div class="mag-done"><b>'+d.connected+' model'+(d.connected===1?'':'s')+' connected</b>'+(d.already?' <span>('+d.already+' were already there)</span>':'')+(d.agencies_created?'<p>'+d.agencies_created+' new mother agenc'+(d.agencies_created===1?'y was':'ies were')+' added. Give each one a portal code from its profile.</p>':'')+(bad.length?'<p class="warn">'+bad.length+' could not be connected: '+esc(bad.slice(0,3).map(function(x){return x.error||'unknown problem';}).join('; '))+'</p>':'')+'</div>';
  }else if(!r){
    body=bulkHelp(B)+'<textarea class="mag-ta" placeholder="'+(B.fixed?'Paste model names here':'Paste the list here')+'" oninput="MDV_MAG.bulkText(this.value)">'+esc(B.text)+'</textarea>'
      +'<div class="mag-bk-tools"><label class="mag-btn">Upload a CSV<input type="file" accept=".csv,.tsv,.txt,text/csv,text/plain" hidden onchange="MDV_MAG.bulkFile(this)"></label>'+(B.fixed?'':'<button type="button" class="mag-btn" onclick="MDV_MAG.template()">Download the template</button><button type="button" class="mag-btn" onclick="MDV_MAG.exportAll()">Download all my models</button>')+'</div>'+(B.err?'<div class="mag-note bad">'+esc(B.err)+'</div>':'');
  }else{
    body=bulkTable(B);
  }
  var foot;
  if(B.done)foot='<button type="button" class="mag-btn gold" onclick="MDV_MAG.closeModal(\'mag-bulk\')">Done</button>';
  else if(!r)foot='<button type="button" class="mag-btn gold" '+(B.text.trim()&&!B.busy?'':'disabled ')+'onclick="MDV_MAG.bulkCheck()">'+(B.busy?'Checking…':'Check the list')+'</button>';
  else{var n=bulkChosen().length;foot='<span class="mag-sub">'+n+' to connect</span><button type="button" class="mag-btn" onclick="MDV_MAG.bulkBack()">Back</button><button type="button" class="mag-btn gold" '+(n&&!B.busy?'':'disabled ')+'onclick="MDV_MAG.bulkGo()">'+(B.busy?'Connecting…':'Connect '+n+' model'+(n===1?'':'s'))+'</button>';}
  el.innerHTML='<div class="mag-box wide" role="dialog" aria-label="Connect models from a list">'+head+body+'<footer>'+foot+'</footer></div>';
  var nw=el.querySelector('.mag-bk-wrap');if(nw)nw.scrollTop=keepB;
}
function decOf(row){var d=LK.bulk.dec[row.line];if(!d){d={on:row.status==='ready'||row.status==='move',model_id:row.model_id,partner_id:row.agency_id,create:false};LK.bulk.dec[row.line]=d;}return d;}
function bulkChosen(){
  var B=LK.bulk;if(!B||!B.res)return [];
  return B.res.rows.filter(function(row){var d=decOf(row);return d.on&&d.model_id&&(d.partner_id||(d.create&&row.agency_typed))&&row.status!=='already'&&row.status!=='duplicate';});
}
var STAT={ready:['ok','Ready'],move:['warn','Moves agency'],already:['info','Already connected'],duplicate:['off','Listed twice'],no_agency:['off','No agency on this line'],model_missing:['bad','Model not found'],model_ambiguous:['warn','Which model?'],agency_missing:['warn','Agency not found'],agency_ambiguous:['warn','Which agency?']};
function bulkTable(B){
  var R=B.res,s=R.summary,agencies=R.agencies;
  var sum='<div class="mag-bk-sum"><span class="ok"><b>'+s.ready+'</b> ready</span><span class="warn"><b>'+s.move+'</b> move agency</span><span class="info"><b>'+s.already+'</b> already there</span>'+(s.skipped?'<span><b>'+s.skipped+'</b> skipped</span>':'')+'<span class="'+(s.problems?'bad':'')+'"><b>'+s.problems+'</b> need a look</span></div>';
  var rows=R.rows.map(function(row){
    var d=decOf(row),st=STAT[row.status]||['off',row.status],canTick=row.status!=='already'&&row.status!=='duplicate'&&row.status!=='model_missing'&&row.status!=='no_agency';
    var fix='';
    if(row.status==='model_ambiguous')fix='<select class="mag-sel" onchange="MDV_MAG.bulkSet('+row.line+',\'model\',this.value)"><option value="">Choose the model…</option>'+row.model_candidates.map(function(c){return '<option value="'+esc(c.id)+'"'+(d.model_id===c.id?' selected':'')+'>'+esc(c.name)+'</option>';}).join('')+'</select>';
    if(row.status==='agency_ambiguous')fix='<select class="mag-sel" onchange="MDV_MAG.bulkSet('+row.line+',\'agency\',this.value)"><option value="">Choose the agency…</option>'+row.agency_candidates.map(function(c){return '<option value="'+esc(c.id)+'"'+(d.partner_id===c.id?' selected':'')+'>'+esc(c.name)+'</option>';}).join('')+'</select>';
    if(row.status==='agency_missing'&&row.agency_typed)fix='<label class="mag-chk"><input type="checkbox" '+(d.create?'checked ':'')+'onchange="MDV_MAG.bulkCreate('+row.line+',this.checked)"> Add “'+esc(row.agency_typed)+'” as a new mother agency</label><select class="mag-sel" onchange="MDV_MAG.bulkSet('+row.line+',\'agency\',this.value)"><option value="">…or pick an existing one</option>'+agencies.map(function(c){return '<option value="'+esc(c.id)+'"'+(d.partner_id===c.id?' selected':'')+'>'+esc(c.name)+'</option>';}).join('')+'</select>';
    var who=row.model_name||row.model_typed,to=row.agency_name||row.agency_typed||'';
    return '<tr class="'+st[0]+'"><td><input type="checkbox" '+(d.on&&canTick?'checked ':'')+(canTick?'':'disabled ')+'onchange="MDV_MAG.bulkTick('+row.line+',this.checked)" aria-label="Include"></td><td><b>'+esc(who)+'</b>'+(row.model_name&&row.model_name!==row.model_typed?'<small>typed “'+esc(row.model_typed)+'”</small>':'')+'</td><td>'+(B.fixed?'':'<b>'+esc(to||'—')+'</b>'+(row.agency_name&&row.agency_typed&&row.agency_name!==row.agency_typed?'<small>typed “'+esc(row.agency_typed)+'”</small>':''))+(row.status==='move'?'<small class="warn">from '+esc(row.current_agency_name||'another agency')+'</small>':'')+fix+'</td><td><span class="mag-st '+st[0]+'">'+st[1]+'</span></td></tr>';
  }).join('');
  return sum+'<div class="mag-bk-wrap"><table class="mag-bk"><thead><tr><th></th><th>Model</th><th>'+(B.fixed?'':'Mother agency')+'</th><th>Check</th></tr></thead><tbody>'+rows+'</tbody></table></div>';
}
async function bulkCheck(){
  var B=LK.bulk;if(!B||B.busy||!B.text.trim())return;B.busy=true;B.err='';paintBulk();
  try{var r=await post({action:'bulk_preview',text:B.text,agency_id:B.fixed||undefined});B.res=r;B.dec={};}catch(e){B.err=(e&&e.message)||'Could not check the list.';}
  B.busy=false;paintBulk();
}
async function bulkGo(){
  var B=LK.bulk;if(!B||B.busy)return;var chosen=bulkChosen();if(!chosen.length)return;
  var moves=chosen.filter(function(row){return row.status==='move';}).length,created=chosen.filter(function(row){return !decOf(row).partner_id&&decOf(row).create;}).length;
  if((moves||created)&&!(await MDV_DIALOG.confirm({title:'Connect '+chosen.length+' model'+(chosen.length===1?'':'s')+'?',message:(moves?moves+' will leave the mother agency they are with now. ':'')+(created?created+' new mother agenc'+(created===1?'y':'ies')+' will be added. ':'')+'You can undo any single connection from the agency profile.',confirm:'Connect'})))return;
  B.busy=true;paintBulk();
  try{
    var r=await post({action:'bulk_apply',rows:chosen.map(function(row){var d=decOf(row);return {model_id:d.model_id,partner_id:d.partner_id||undefined,agency_name:!d.partner_id&&d.create?row.agency_typed:undefined};})});
    B.done=r;LK.dirAt=0;toast(r.connected+' model'+(r.connected===1?'':'s')+' connected');
    if(S.open)await refreshOpen();
    await load();
  }catch(e){B.err=(e&&e.message)||'Could not connect.';B.res=B.res;}
  B.busy=false;paintBulk();
}
function readFile(input){
  var f=input.files&&input.files[0];if(!f||!LK.bulk)return;
  if(f.size>1500000){LK.bulk.err='That file is too big. A list of names is a few kilobytes.';paintBulk();return;}
  var rd=new FileReader();rd.onload=function(){if(!LK.bulk)return;LK.bulk.text=String(rd.result||'');LK.bulk.err='';paintBulk();};rd.onerror=function(){if(LK.bulk){LK.bulk.err='That file could not be read.';paintBulk();}};rd.readAsText(f);
}
function exportAll(){
  loadDir(true).then(function(d){
    var lines=['Model,Mother Agency'].concat(d.models.map(function(m){return csvCell(m.name)+','+csvCell(m.agency_name||'');}));
    download('models-and-mother-agencies.csv',lines.join('\n')+'\n');
  }).catch(function(e){toast((e&&e.message)||'Could not make the file');});
}

window.renderMotherAgencies=function(el){S.host=el;paint();return load();};
window.MDV_MAG={render:window.renderMotherAgencies,reload:load,open:open,close:close,filter:function(f){S.filter=f;paint();},search:function(v){S.q=v;paint();},add:add,access:access,portal:portal,edit:function(on){S.edit=!!on;paintDrawer();},save:save,view:view,copy:copy,model:openModel,state:S,pick:openPick,pickFilter:function(f){LK.pick.filter=f;paintPick();},pickSearch:function(v){LK.pick.q=v;LK.pick.focusSearch=true;paintPick();},pickToggle:function(id,on){if(on)LK.pick.sel[id]=1;else delete LK.pick.sel[id];paintPick();},pickGo:pickGo,disconnect:disconnect,openBulk:openBulk,closeModal:closeModal,bulkText:function(v){LK.bulk.text=v;var b=document.querySelector('#mag-bulk footer .gold');if(b)b.disabled=!v.trim();},bulkFile:readFile,bulkCheck:bulkCheck,bulkGo:bulkGo,bulkBack:function(){LK.bulk.res=null;LK.bulk.dec={};paintBulk();},bulkTick:function(line,on){var row=LK.bulk.res.rows.find(function(x){return x.line===line;});decOf(row).on=!!on;paintBulk();},bulkSet:function(line,what,val){var row=LK.bulk.res.rows.find(function(x){return x.line===line;}),d=decOf(row);if(what==='model')d.model_id=val||null;else{d.partner_id=val||'';if(val)d.create=false;}d.on=!!(d.model_id&&(d.partner_id||d.create));paintBulk();},bulkCreate:function(line,on){var row=LK.bulk.res.rows.find(function(x){return x.line===line;}),d=decOf(row);d.create=!!on;if(on)d.partner_id='';d.on=!!(d.model_id&&(d.partner_id||d.create));paintBulk();},template:function(){download('mother-agency-template.csv',TEMPLATE);},exportAll:exportAll};
(function register(){
  function put(){var m=window.VEUX_V15_ROUTE_RENDERERS;if(m&&typeof m==='object'){m.motheragencies=function(el){return window.renderMotherAgencies(el);};return true;}return false;}
  if(put())return;var n=0,t=setInterval(function(){if(put()||++n>400)clearInterval(t);},150);
  ['veux:shell-ready','veux:assets-ready','veux:auth-ready'].forEach(function(e){window.addEventListener(e,put);});
})();
})();
