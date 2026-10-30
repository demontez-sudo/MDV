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
  el.innerHTML='<div class="mag-page"><header class="mag-head"><div><div class="mag-kicker">AGENCY</div><h1>Mother Agencies</h1><p>Their profiles, documents and models, and the access that lets each agency into its own portal.</p></div><div class="mag-headact"><a class="mag-btn" href="'+PORTAL+'" target="_blank" rel="noopener">Open the MA portal</a><button type="button" class="mag-btn gold" onclick="MDV_MAG.add()">+ Add mother agency</button></div></header>'+kpis()+listHtml()+'</div>';
  if(keep){var s=el.querySelector('.mag-search');if(s){s.focus();var n=s.value.length;try{s.setSelectionRange(n,n);}catch(e){}}}
}

/* ---------- drawer ---------- */
function drawerEl(){var d=document.getElementById('mag-drawer');if(!d){d=document.createElement('div');d.id='mag-drawer';d.className='mag-drawer';d.onclick=function(e){if(e.target===d)close();};document.body.appendChild(d);}return d;}
function close(){S.open=null;S.detail=null;S.edit=false;S.code=null;var d=document.getElementById('mag-drawer');if(d)d.remove();document.removeEventListener('keydown',onKey);}
function onKey(e){if(e.key==='Escape')close();}
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
  var ms=arr(d.models);
  return '<section class="mag-sec"><header><h4>Models</h4><span class="mag-count">'+ms.length+'</span></header>'+(ms.length?'<div class="mag-mods">'+ms.map(function(m){return '<button type="button" class="mag-mod" onclick="MDV_MAG.model(\''+esc(m.id)+'\')"><span class="mag-mph">'+(m.photo?'<img loading="lazy" src="'+esc(m.photo)+'" alt="">':esc(initials(m.name)))+'</span><b>'+esc(m.name)+'</b><em>'+esc([m.market,m.status].filter(Boolean).join(' · ')||'—')+'</em></button>';}).join('')+'</div>':'<p class="mag-sub">No models are placed with this agency yet. Place a model from its Roster entry and it shows up here and in their portal.</p>')+'</section>';
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
  if(kind==='clear_access'&&!confirm('Remove portal access for '+a.name+'? Their current code will stop working.'))return;
  if(kind==='set_access'&&a.access.has_code&&!confirm('Make a new code for '+a.name+'? The old code stops working straight away.'))return;
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
  var name=prompt('Mother agency name (exactly as they will type it when signing in)');if(!name||!name.trim())return;
  var city=prompt('City (optional)')||'',country=prompt('Country (optional)')||'',email=prompt('Contact email (optional)')||'';
  try{var r=await post({action:'create',name:name.trim(),city:city.trim(),country:country.trim(),contact_email:email.trim()});toast('Mother agency added');await load();if(r&&r.partner_id)open(r.partner_id);}catch(e){toast((e&&e.message)||'Could not add the agency');}
}
function openModel(id){close();window._veuxV10ModelId=id;window._openModelId=id;if(typeof window.navTo==='function')window.navTo('modelpage');}

window.renderMotherAgencies=function(el){S.host=el;paint();return load();};
window.MDV_MAG={render:window.renderMotherAgencies,reload:load,open:open,close:close,filter:function(f){S.filter=f;paint();},search:function(v){S.q=v;paint();},add:add,access:access,portal:portal,edit:function(on){S.edit=!!on;paintDrawer();},save:save,view:view,copy:copy,model:openModel,state:S};
(function register(){
  function put(){var m=window.VEUX_V15_ROUTE_RENDERERS;if(m&&typeof m==='object'){m.motheragencies=function(el){return window.renderMotherAgencies(el);};return true;}return false;}
  if(put())return;var n=0,t=setInterval(function(){if(put()||++n>400)clearInterval(t);},150);
  ['veux:shell-ready','veux:assets-ready','veux:auth-ready'].forEach(function(e){window.addEventListener(e,put);});
})();
})();
