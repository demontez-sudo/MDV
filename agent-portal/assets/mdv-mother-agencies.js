/* Mother Agencies (staff side): every mother agency, how complete its profile is, what is expiring, who the models are,
   and the key to its portal at maisondeveux.com/ma. */
(function(){
'use strict';
if(window.__MDV_MAG__)return;window.__MDV_MAG__=true;

var S={host:null,list:null,loading:false,error:null,filter:'all',q:'',open:null,detail:null,detailLoading:false,edit:false,teamEdit:null,termsEdit:false,roster:null,rosterLoading:false,code:null,busy:''};
var PORTAL='https://www.maisondeveux.com/ma';
var FIELDS=[['tagline','Tagline',1],['bio','About',1],['legal_name','Legal name'],['registration_no','Registration / licence no.'],['tax_id','Tax ID'],['founded_year','Founded'],['models_count','Models in the agency'],['address_line','Address'],['address_line2','Address line 2'],['city','City'],['state','State / region'],['postal_code','Postal code'],['country','Country'],['specialties','Specialties (comma separated)',1],['regions','Markets and regions covered (comma separated)',1],['languages','Languages (comma separated)',1],['website','Website'],['instagram','Instagram'],['contact_name','Contact person'],['contact_role','Their role'],['contact_email','Contact email'],['contact_phone','Contact phone'],['whatsapp','WhatsApp']];

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
  if(a.contract&&a.contract.state==='ended')f.push({tone:'bad',text:'Contract ended'});
  if(a.contract&&a.contract.state==='renew')f.push({tone:'warn',text:'Contract renews in '+a.contract.days_left+' days'});
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
  if(S.open&&S.inl){paintDrawer();return;}
  if(S.loading&&!S.list){el.innerHTML='<div class="mag-page"><div class="mag-empty">Loading mother agencies…</div></div>';return;}
  if(S.error&&!S.list){el.innerHTML='<div class="mag-page"><div class="mag-empty">'+esc(S.error)+'</div><p style="text-align:center"><button class="mag-btn" onclick="MDV_MAG.reload()">Try again</button></p></div>';return;}
  var keep=document.activeElement&&document.activeElement.classList&&document.activeElement.classList.contains('mag-search');
  el.innerHTML='<div class="mag-page"><header class="mag-head"><div><div class="mag-kicker">AGENCY</div><h1>Mother Agencies</h1><p>Their profiles, documents and models, and the access that lets each agency into its own portal.</p></div><div class="mag-headact"><a class="mag-btn" href="'+PORTAL+'" target="_blank" rel="noopener">Open the MA portal</a><button type="button" class="mag-btn" onclick="MDV_MAG.openBulk()">Connect models</button><button type="button" class="mag-btn gold" onclick="MDV_MAG.add()">+ Add mother agency</button></div></header>'+kpis()+listHtml()+'</div>';
  if(keep){var s=el.querySelector('.mag-search');if(s){s.focus();var n=s.value.length;try{s.setSelectionRange(n,n);}catch(e){}}}
}

/* ---------- drawer ---------- */
/* The profile is a page inside the portal (like a model's or a contact's), not an overlay: it replaces the list in the page area and keeps the portal's header and menu. Only when the Mother Agencies page is not on screen does it fall back to an overlay. */
function inlineOK(){return !!(S.host&&document.body.contains(S.host)&&S.host.offsetParent!==null);}
function drawerEl(){if(S.inl&&S.host&&document.body.contains(S.host))return S.host;var d=document.getElementById('mag-drawer');if(!d){d=document.createElement('div');d.id='mag-drawer';d.className='mag-drawer';d.onclick=function(e){if(e.target===d)close();};document.body.appendChild(d);}return d;}
function close(){var was=S.inl;S.open=null;S.detail=null;S.edit=false;S.code=null;S.inl=false;var d=document.getElementById('mag-drawer');if(d)d.remove();document.removeEventListener('keydown',onKey);if(was){paint();try{window.scrollTo(0,0);}catch(e){}}}
function onKey(e){if(e.key!=='Escape')return;var m=document.getElementById('mag-pick')||document.getElementById('mag-bulk');if(m){closeModal(m.id);return;}close();}
function accessPanel(a){
  var ac=accessState(a),x=a.access||{};
  var msg=S.code?('Sign in to the Mother Agency portal\n'+PORTAL+'\n\nAgency: '+a.name+'\nAccess code: '+S.code):'';
  var codeBox=S.code?'<div class="mag-code"><small>Access code — shown once, copy it now</small><b>'+esc(S.code)+'</b><div class="mag-code-act"><button type="button" class="mag-btn" onclick="MDV_MAG.copy(\'code\')">Copy code</button><button type="button" class="mag-btn gold" onclick="MDV_MAG.copy(\'message\')">Copy message to send</button></div><pre id="mag-msg">'+esc(msg)+'</pre></div>':'';
  return '<section class="mag-sec"><header><h4>Portal access</h4><span class="mag-pill '+ac.k+'">'+esc(ac.t)+'</span></header><p class="mag-sub">'+esc(ac.s)+'. They sign in at <b>'+PORTAL.replace('https://www.','')+'</b> with the agency name and the code.</p>'+codeBox
   +'<div class="mag-actions">'+(x.has_code?'<button type="button" class="mag-btn" '+(S.busy?'disabled':'')+' onclick="MDV_MAG.access(\'set_access\')">Reset code</button><button type="button" class="mag-btn" onclick="MDV_MAG.access(\'clear_access\')">Remove access</button>':'<button type="button" class="mag-btn gold" '+(S.busy?'disabled':'')+' onclick="MDV_MAG.access(\'set_access\')">Create access code</button>')
   +(x.has_code?'<button type="button" class="mag-btn" onclick="MDV_MAG.portal('+(x.portal_enabled===false?'true':'false')+')">'+(x.portal_enabled===false?'Enable portal':'Disable portal')+'</button>':'')+'</div></section>';
}
/* ---------- in depth: company, team and terms ---------- */
var TOPICS=[['bookings','Bookings'],['castings','Castings'],['travel','Travel'],['visa','Visa'],['accounts','Accounts and payments'],['contracts','Contracts'],['development','Development'],['general','General']];
var EXCL=[['','Not set'],['none','Not exclusive'],['market','Exclusive in some markets'],['full','Fully exclusive']];
var PAYT=[['','Not set'],['on_receipt','On receipt'],['net_15','Net 15 days'],['net_30','Net 30 days'],['net_45','Net 45 days'],['net_60','Net 60 days'],['custom','Custom (see notes)']];
var CURS=['','USD','EUR','GBP','CAD','AUD','CHF','JPY','NGN','ZAR','BRL'];
var ROLES=['Director','Head booker','Booker','Scout','Accounts','Travel coordinator','Visa and legal','Assistant'];
function listTxt(v){return Array.isArray(v)?v.join(', '):(v||'');}
function chips(v){var l=Array.isArray(v)?v:[];return l.length?'<span class="mag-tags">'+l.map(function(x){return '<i>'+esc(x)+'</i>';}).join('')+'</span>':'<i class="mag-none">Not added</i>';}
function lookup(list,k){var x=list.filter(function(e){return e[0]===k;})[0];return x?x[1]:'';}
function companyPanel(d){
  var f=d.agency.fields||{};
  if(S.edit){
    var groups=[['The agency',['tagline','bio']],['Company',['legal_name','registration_no','tax_id','founded_year','models_count']],['Address',['address_line','address_line2','city','state','postal_code','country']],['Focus',['specialties','regions','languages']],['Online',['website','instagram']],['Main contact',['contact_name','contact_role','contact_email','contact_phone','whatsapp']]];
    var byK={};FIELDS.forEach(function(x){byK[x[0]]=x;});
    return '<section class="mag-sec"><header><h4>Edit company details</h4></header>'+groups.map(function(g){return '<h5 class="mag-h5">'+esc(g[0])+'</h5><div class="mag-form">'+g[1].map(function(k){var x=byK[k];if(!x)return '';return '<label class="'+(x[2]?'full':'')+'"><span>'+esc(x[1])+'</span>'+(k==='bio'?'<textarea id="mag-f-'+k+'" rows="5">'+esc(f[k]||'')+'</textarea>':'<input id="mag-f-'+k+'" value="'+esc(listTxt(f[k]))+'">')+'</label>';}).join('')+'</div>';}).join('')+'<div class="mag-actions"><button type="button" class="mag-btn" onclick="MDV_MAG.edit(false)">Cancel</button><button type="button" class="mag-btn gold" onclick="MDV_MAG.save()">Save</button></div></section>';
  }
  var addr=[f.address_line,f.address_line2,[f.postal_code,f.city].filter(Boolean).join(' '),f.state,f.country].filter(Boolean).join(', ');
  var items=[['Legal name',f.legal_name],['Registration / licence no.',f.registration_no],['Tax ID',f.tax_id],['Founded',f.founded_year],['Models in the agency',f.models_count],['Website',f.website],['Address',addr,1],['Specialties',arr(f.specialties).length?{html:chips(f.specialties)}:'',1],['Markets and regions',arr(f.regions).length?{html:chips(f.regions)}:'',1],['Languages',arr(f.languages).length?{html:chips(f.languages)}:'',1],['Instagram',f.instagram],['Main contact',[f.contact_name,f.contact_role].filter(Boolean).join(' · ')],['Email',f.contact_email],['Phone',f.contact_phone],['WhatsApp',f.whatsapp]];
  var have=items.filter(function(x){return x[1];}),gone=items.filter(function(x){return !x[1];}).map(function(x){return x[0];});
  var total=items.length+(f.tagline?0:1)+(f.bio?0:1)+(f.tagline?1:0)+(f.bio?1:0),done=have.length+(f.tagline?1:0)+(f.bio?1:0);
  var miss=arr(d.agency.profile.missing);
  return '<section class="mag-sec"><header><h4>Company</h4><span class="mag-prog" title="Details added">'+done+' of '+total+'<i><b style="width:'+Math.round(done/total*100)+'%"></b></i></span><button type="button" class="mag-link" onclick="MDV_MAG.edit(true)">Edit</button></header>'
   +(f.tagline?'<p class="mag-tag">'+esc(f.tagline)+'</p>':'')+(f.bio?'<p class="mag-bio">'+esc(f.bio).replace(/\n/g,'<br>')+'</p>':'')
   +(have.length?'<div class="mag-grid">'+have.map(function(x){return '<div'+(x[2]?' class="full"':'')+'><small>'+esc(x[0])+'</small><b>'+(typeof x[1]==='string'?esc(x[1]):x[1].html)+'</b></div>';}).join('')+'</div>':'<p class="mag-sub">Nothing added yet.</p>')
   +(gone.length||!f.tagline||!f.bio?'<p class="mag-empties"><span>Not added yet:</span> '+esc(gone.concat(f.tagline?[]:['Tagline']).concat(f.bio?[]:['About']).join(', '))+' <button type="button" class="mag-link" onclick="MDV_MAG.edit(true)">+ Add details</button></p>':'')
   +(miss.length?'<p class="mag-miss">Still missing from the profile score: '+esc(miss.join(', '))+'.</p>':'')+'</section>';
}
function teamPanel(d){
  var team=arr(d.team),e=S.teamEdit;
  function card(m,i){
    return '<div class="mag-person"><div class="mag-pav">'+esc(initials(m.name))+'</div><div class="mag-pinfo"><b>'+esc(m.name)+(m.primary?' <em class="mag-badge">Main contact</em>':'')+'</b><small>'+esc(m.role||'No role added')+'</small>'
     +'<span class="mag-plinks">'+(m.email?'<a href="mailto:'+esc(m.email)+'">'+esc(m.email)+'</a>':'')+(m.phone?'<a href="tel:'+esc(m.phone)+'">'+esc(m.phone)+'</a>':'')+(m.whatsapp?'<span>WhatsApp '+esc(m.whatsapp)+'</span>':'')+'</span>'
     +(arr(m.topics).length?'<span class="mag-tags">'+m.topics.map(function(t){return '<i>'+esc(lookup(TOPICS,t))+'</i>';}).join('')+'</span>':'')+'</div>'
     +'<div class="mag-pact"><button type="button" class="mag-link" onclick="MDV_MAG.teamEdit('+i+')">Edit</button><button type="button" class="mag-link bad" onclick="MDV_MAG.teamRemove('+i+')">Remove</button></div></div>';
  }
  var form='';
  if(e!==null&&e!==undefined){
    var m=e==='new'?{topics:[]}:team[e]||{topics:[]};
    form='<div class="mag-pform"><h5 class="mag-h5">'+(e==='new'?'Add a person':'Edit '+esc(m.name))+'</h5><div class="mag-form"><label><span>Name</span><input id="mag-t-name" value="'+esc(m.name||'')+'"></label><label><span>Role</span><input id="mag-t-role" list="mag-roles" value="'+esc(m.role||'')+'"><datalist id="mag-roles">'+ROLES.map(function(r){return '<option>'+r+'</option>';}).join('')+'</datalist></label><label><span>Email</span><input id="mag-t-email" type="email" value="'+esc(m.email||'')+'"></label><label><span>Phone</span><input id="mag-t-phone" value="'+esc(m.phone||'')+'"></label><label><span>WhatsApp</span><input id="mag-t-whatsapp" value="'+esc(m.whatsapp||'')+'"></label><label class="mag-chkrow"><input type="checkbox" id="mag-t-primary" '+(m.primary?'checked':'')+'><span>Main contact for this agency</span></label></div>'
      +'<div class="mag-topics"><span>Reach them about</span>'+TOPICS.map(function(t){return '<label><input type="checkbox" class="mag-t-topic" value="'+t[0]+'" '+(arr(m.topics).indexOf(t[0])>=0?'checked':'')+'> '+t[1]+'</label>';}).join('')+'</div>'
      +'<div class="mag-actions"><button type="button" class="mag-btn" onclick="MDV_MAG.teamCancel()">Cancel</button><button type="button" class="mag-btn gold" onclick="MDV_MAG.teamSave()">Save person</button></div></div>';
  }
  return '<section class="mag-sec"><header><h4>Team</h4><span class="mag-count">'+team.length+'</span><span class="mag-sec-act"><button type="button" class="mag-btn gold" onclick="MDV_MAG.teamAdd()">+ Add person</button></span></header>'
   +(team.length?'<div class="mag-people">'+team.map(card).join('')+'</div>':'<p class="mag-sub">No team added yet. Add the people we work with at this agency and what to reach them about.</p>')+form+'</section>';
}
function termsPanel(d){
  var t=d.terms||{},c=d.agency.contract||{state:'none'};
  if(S.termsEdit){
    function sel(id,list,v){return '<select id="'+id+'">'+list.map(function(o){var k=Array.isArray(o)?o[0]:o,l=Array.isArray(o)?o[1]:(o||'Not set');return '<option value="'+esc(k)+'"'+(String(v||'')===String(k)?' selected':'')+'>'+esc(l)+'</option>';}).join('')+'</select>';}
    function inp(id,v,type,ph){return '<input id="'+id+'" type="'+(type||'text')+'" value="'+esc(v==null?'':v)+'"'+(ph?' placeholder="'+esc(ph)+'"':'')+'>';}
    return '<section class="mag-sec"><header><h4>Edit terms</h4></header><h5 class="mag-h5">Split</h5><div class="mag-form"><label><span>Maison de Veux commission (%)</span>'+inp('mag-x-commission_pct',t.commission_pct,'number','e.g. 20')+'</label><label><span>Agency share (%)</span>'+inp('mag-x-agency_share_pct',t.agency_share_pct,'number','e.g. 50')+'</label></div>'
     +'<h5 class="mag-h5">Contract</h5><div class="mag-form"><label><span>Starts</span>'+inp('mag-x-contract_start',t.contract_start,'date')+'</label><label><span>Ends</span>'+inp('mag-x-contract_end',t.contract_end,'date')+'</label><label><span>Renewal notice (days)</span>'+inp('mag-x-renewal_notice_days',t.renewal_notice_days,'number','60')+'</label><label><span>Exclusivity</span>'+sel('mag-x-exclusivity',EXCL,t.exclusivity)+'</label><label class="full"><span>Exclusivity details</span>'+inp('mag-x-exclusivity_note',t.exclusivity_note,'text','Which markets, which models')+'</label></div>'
     +'<h5 class="mag-h5">Payment</h5><div class="mag-form"><label><span>Payment terms</span>'+sel('mag-x-payment_terms',PAYT,t.payment_terms)+'</label><label><span>Currency</span>'+sel('mag-x-currency',CURS,t.currency)+'</label><label class="full"><span>Payment notes</span>'+inp('mag-x-payment_terms_note',t.payment_terms_note,'text','Anything outside the standard terms')+'</label><label><span>Payout contact</span>'+inp('mag-x-payout_contact_name',t.payout_contact_name)+'</label><label><span>Payout email</span>'+inp('mag-x-payout_contact_email',t.payout_contact_email,'email')+'</label><label class="full"><span>Invoicing notes</span><textarea id="mag-x-invoicing_notes" rows="3" placeholder="How they invoice, what each invoice needs. Bank details are shared securely, not stored here.">'+esc(t.invoicing_notes||'')+'</textarea></label></div>'
     +'<h5 class="mag-h5">Internal</h5><div class="mag-form"><label class="full"><span>Private notes (the agency never sees these)</span><textarea id="mag-x-internal_notes" rows="3">'+esc(t.internal_notes||'')+'</textarea></label></div>'
     +'<div class="mag-actions"><button type="button" class="mag-btn" onclick="MDV_MAG.termsEdit(false)">Cancel</button><button type="button" class="mag-btn gold" onclick="MDV_MAG.termsSave()">Save terms</button></div></section>';
  }
  var badge=c.state==='active'?'<span class="mag-pill ok">Contract active</span>':c.state==='renew'?'<span class="mag-pill warn">Renews in '+c.days_left+' days</span>':c.state==='ended'?'<span class="mag-pill bad">Contract ended</span>':c.state==='open'?'<span class="mag-pill info">Open-ended</span>':'';
  var split=(t.commission_pct!=null||t.agency_share_pct!=null)?[t.commission_pct!=null?'MDV '+t.commission_pct+'%':'',t.agency_share_pct!=null?'Agency '+t.agency_share_pct+'%':''].filter(Boolean).join(' · '):'';
  var items=[['Split',split],['Contract',[t.contract_start&&'from '+t.contract_start,t.contract_end&&'to '+t.contract_end].filter(Boolean).join(' ')],['Renewal notice',t.renewal_notice_days!=null?t.renewal_notice_days+' days':''],['Exclusivity',[lookup(EXCL,t.exclusivity||''),t.exclusivity_note].filter(Boolean).join(' · ')],['Payment terms',[lookup(PAYT,t.payment_terms||''),t.payment_terms_note].filter(Boolean).join(' · ')],['Currency',t.currency],['Payout contact',[t.payout_contact_name,t.payout_contact_email].filter(Boolean).join(' · ')],['Invoicing',t.invoicing_notes,1],['Private notes',t.internal_notes,1]];
  var have=items.filter(function(x){return x[1];}),gone=items.filter(function(x){return !x[1]&&x[0]!=='Private notes';}).map(function(x){return x[0];});
  var core=items.slice(0,8),done=core.filter(function(x){return x[1];}).length;
  return '<section class="mag-sec"><header><h4>Terms</h4>'+badge+'<span class="mag-prog" title="Terms set">'+done+' of '+core.length+'<i><b style="width:'+Math.round(done/core.length*100)+'%"></b></i></span><button type="button" class="mag-link" onclick="MDV_MAG.termsEdit(true)">Edit</button></header>'
   +(have.length?'<div class="mag-grid">'+have.map(function(x){return '<div'+(x[2]?' class="full"':'')+'><small>'+esc(x[0])+'</small><b>'+esc(x[1])+'</b></div>';}).join('')+'</div>':'<p class="mag-sub">No terms set yet. Add the commission split, contract dates and payment terms.</p>')
   +(gone.length&&have.length?'<p class="mag-empties"><span>Not set yet:</span> '+esc(gone.join(', '))+' <button type="button" class="mag-link" onclick="MDV_MAG.termsEdit(true)">+ Set terms</button></p>':'')+'</section>';
}
async function saveTeamList(list,msg){
  var a=S.detail&&S.detail.agency;if(!a)return;
  try{var r=await post({action:'save_team',partner_id:a.id,team:list});S.detail.team=r.team;S.teamEdit=null;toast(msg);}catch(e){toast((e&&e.message)||'Could not save the team');return;}   /* on an error the form stays as typed */
  paintDrawer();load();
}
function readPerson(){
  var g=function(id){var el=document.getElementById(id);return el?el.value.trim():'';};
  return {name:g('mag-t-name'),role:g('mag-t-role'),email:g('mag-t-email'),phone:g('mag-t-phone'),whatsapp:g('mag-t-whatsapp'),primary:!!(document.getElementById('mag-t-primary')||{}).checked,topics:Array.prototype.map.call(document.querySelectorAll('.mag-t-topic:checked'),function(x){return x.value;})};
}
function teamSave(){
  var team=arr(S.detail&&S.detail.team).slice(),p=readPerson(),e=S.teamEdit;
  if(!p.name){toast('Add the person’s name.');return;}
  if(e==='new'){team.push(p);}else{p.id=team[e].id;team[e]=p;}
  if(p.primary)team.forEach(function(m){if(m!==p)m.primary=false;});
  return saveTeamList(team,e==='new'?'Person added':'Person saved');
}
async function teamRemove(i){
  var team=arr(S.detail&&S.detail.team).slice(),m=team[i];if(!m)return;
  if(!(await MDV_DIALOG.confirm({title:'Remove '+m.name+'?',message:m.name+' is removed from this agency’s team. This does not affect their portal access.',confirm:'Remove',danger:true})))return;
  team.splice(i,1);return saveTeamList(team,'Person removed');
}
async function termsSave(){
  var a=S.detail&&S.detail.agency;if(!a)return;var t={};
  ['commission_pct','agency_share_pct','contract_start','contract_end','renewal_notice_days','exclusivity','exclusivity_note','payment_terms','payment_terms_note','currency','payout_contact_name','payout_contact_email','invoicing_notes','internal_notes'].forEach(function(k){var el=document.getElementById('mag-x-'+k);if(el)t[k]=el.value;});
  try{var r=await post({action:'save_terms',partner_id:a.id,terms:t});S.detail.terms=r.terms;S.detail.agency.contract=r.contract;S.termsEdit=false;toast('Terms saved');}catch(e){toast((e&&e.message)||'Could not save the terms');return;}   /* on an error the form stays as typed */
  paintDrawer();load();
}
function docsPanel(d){
  var all=arr(d.agency.documents).map(function(x){var have=arr(d.documents).filter(function(q){return q.type===x.type;}).sort(function(a,b){return String(b.uploaded_at).localeCompare(String(a.uploaded_at));})[0];return {s:x,doc:have};});
  var other=arr(d.documents).filter(function(q){return q.type==='other';});
  function state(x,doc){return x?(x.state==='missing'?'Not uploaded':x.state==='expired'?'Expired '+(-x.days_left)+' days ago':x.state==='expiring'?'Expires in '+x.days_left+' days':(x.expires_on?'Valid until '+esc(x.expires_on):'On file')):'On file';}
  return '<section class="mag-sec"><header><h4>Documents</h4></header><div class="mag-docs-l">'+all.map(function(z){return '<div class="mag-doc '+z.s.state+'"><div><b>'+esc(z.s.label)+'</b><em>'+state(z.s)+'</em></div>'+(z.doc?'<button type="button" class="mag-link" onclick="MDV_MAG.view(\''+esc(z.doc.id)+'\')">View</button>':'')+'</div>';}).join('')+other.map(function(q){return '<div class="mag-doc ok"><div><b>'+esc(q.name)+'</b><em>Other</em></div><button type="button" class="mag-link" onclick="MDV_MAG.view(\''+esc(q.id)+'\')">View</button></div>';}).join('')+'</div></section>';
}
/* ---------- the roster in depth ---------- */
var RS={filter:'all',q:'',open:null,edit:null};
function fmtD(v){if(!v)return '';var d=new Date(String(v).slice(0,10)+'T12:00:00');return isNaN(d)?'':d.toLocaleDateString([], {month:'short',day:'numeric'});}
function plural(n,w){return n+' '+w+(n===1?'':'s');}
function chip(tone,text,title){return '<span class="mag-rc '+tone+'"'+(title?' title="'+esc(title)+'"':'')+'>'+esc(text)+'</span>';}
function rcAvail(r){var a=r.availability;if(a.state==='away')return chip('warn','Away'+(a.now&&a.now.until?' until '+fmtD(a.now.until):''),a.now&&a.now.type);if(a.state==='soon'&&a.next)return chip('info','Unavailable from '+fmtD(a.next.starts_at));return chip('ok','Available');}
function rcTravel(r){var t=r.travel.next;if(!t)return chip('off','No trips');return chip(t.days!=null&&t.days<=14&&!/^(confirmed|booked|ticketed)$/i.test(t.status)?'warn':'info',(t.destination||'Trip')+' · '+fmtD(t.starts_at),t.status);}
function rcVisa(r){var v=r.visa;if(v.state==='none')return chip('off','No visa cases');if(v.state==='urgent')return chip('bad','Visa urgent');if(v.state==='action')return chip('warn',plural(v.open,'visa case')+' open');return chip('ok','Visa clear');}
function rcWork(r){var b=r.bookings;if(b.in_30_days)return chip('info',plural(b.in_30_days,'booking')+' in 30 days');return chip('off','Nothing booked');}
function rosterFiltered(){
  var list=arr(S.roster&&S.roster.roster),q=RS.q.trim().toLowerCase(),f=RS.filter;
  return list.filter(function(r){
    if(q&&r.name.toLowerCase().indexOf(q)<0)return false;
    if(f==='attention')return r.level!=='ok';
    if(f==='away')return r.availability.state==='away';
    if(f==='travel')return !!(r.travel.next&&r.travel.next.days!=null&&r.travel.next.days<=30);
    if(f==='visa')return r.visa.open>0||r.visa.state==='urgent';
    if(f==='contract')return r.terms.contract_state==='renew'||r.terms.contract_state==='ended';
    return true;
  });
}
function rosterDetail(r){
  var t=r.terms||{},edit=RS.edit===r.model_id;
  function sec(h,body){return '<div class="mag-rd-sec"><h6>'+esc(h)+'</h6>'+body+'</div>';}
  var out=arr(r.outstanding).length?'<ul class="mag-rd-out">'+r.outstanding.map(function(o){return '<li class="'+o.tone+'"><i></i>'+esc(o.text)+'</li>';}).join('')+'</ul>':'<p class="mag-sub">Nothing outstanding.</p>';
  var av=arr(r.availability.upcoming).length?'<ul class="mag-rd-l">'+r.availability.upcoming.map(function(b){return '<li><b>'+esc(String(b.type).replace(/_/g,' '))+'</b> '+esc(fmtD(b.starts_at)+(b.ends_at&&b.ends_at!==b.starts_at?' to '+fmtD(b.ends_at):''))+(b.status==='pending'?' <em>pending</em>':'')+'</li>';}).join('')+'</ul>':'<p class="mag-sub">No time off or blocks coming up.</p>';
  var tr=r.travel.next?'<p><b>'+esc(r.travel.next.destination||'Trip')+'</b> '+esc(fmtD(r.travel.next.starts_at)+(r.travel.next.ends_at?' to '+fmtD(r.travel.next.ends_at):''))+' · '+esc(r.travel.next.status||'planned')+(r.travel.count>1?'<br><span class="mag-sub">+ '+(r.travel.count-1)+' more</span>':'')+'</p>':'<p class="mag-sub">No trips planned.</p>';
  var vz=arr(r.visa.cases).length?'<ul class="mag-rd-l">'+r.visa.cases.map(function(c){return '<li><b>'+esc((c.country||'')+' '+(c.type||'visa'))+'</b> '+esc(String(c.status||'').replace(/_/g,' '))+(c.deadline?' · due '+esc(fmtD(c.deadline)):'')+'</li>';}).join('')+'</ul>':'<p class="mag-sub">No visa cases.</p>';
  var pp=r.passport?'<p>Passport '+(r.passport.state==='expired'?'<span class="bad">expired</span>':'expires')+' '+esc(fmtD(r.passport.expires_on))+(r.passport.days_left!=null&&r.passport.days_left>=0?' <span class="mag-sub">('+r.passport.days_left+' days)</span>':'')+'</p>':'';
  var wk='<p>'+(r.bookings.next?'Next: <b>'+esc(r.bookings.next.title)+'</b> '+esc(fmtD(r.bookings.next.starts_at)):'Nothing booked ahead')+'</p>'+(r.bookings.last?'<p class="mag-sub">Last job: '+esc(r.bookings.last.title)+', '+esc(fmtD(r.bookings.last.starts_at))+'</p>':'')+(r.castings.upcoming?'<p class="mag-sub">'+plural(r.castings.upcoming,'casting')+' coming up</p>':'');
  var up=arr(r.updates).length?'<ul class="mag-rd-l">'+r.updates.map(function(u){return '<li><b>'+esc(u.type)+'</b> '+esc(fmtD(u.at))+'<br>'+esc(u.note)+'</li>';}).join('')+'</ul>':'<p class="mag-sub">No updates from the agency.</p>';
  var excl={none:'Not exclusive',market:'Exclusive in some markets',full:'Fully exclusive'};
  var terms;
  if(edit){
    var f=function(id,label,v,type){return '<label><span>'+label+'</span><input id="mag-pt-'+id+'" type="'+(type||'text')+'" value="'+esc(v==null?'':v)+'"></label>';};
    terms='<div class="mag-form">'+f('contract_start','Contract starts',t.contract_start,'date')+f('contract_end','Contract ends',t.contract_end,'date')+f('commission_override_pct','Commission for this model (%)',t.commission_override_pct,'number')+'<label><span>Exclusivity</span><select id="mag-pt-exclusivity">'+[['','Not set'],['none','Not exclusive'],['market','Exclusive in some markets'],['full','Fully exclusive']].map(function(o){return '<option value="'+o[0]+'"'+((t.exclusivity||'')===o[0]?' selected':'')+'>'+o[1]+'</option>';}).join('')+'</select></label><label class="full"><span>Notes (the agency sees these)</span><input id="mag-pt-notes" value="'+esc(t.notes||'')+'"></label><label class="full"><span>Private notes (the agency never sees these)</span><textarea id="mag-pt-staff_notes" rows="2">'+esc(t.staff_notes||'')+'</textarea></label></div><div class="mag-actions"><button type="button" class="mag-btn" onclick="MDV_MAG.rosterEdit(null)">Cancel</button><button type="button" class="mag-btn gold" onclick="MDV_MAG.rosterSave(\''+esc(r.model_id)+'\')">Save terms</button></div>';
  }else{
    var cs=t.contract_state,badge=cs==='active'?'<span class="mag-pill ok">Contract active</span>':cs==='renew'?'<span class="mag-pill warn">Ends in '+t.contract_days_left+' days</span>':cs==='ended'?'<span class="mag-pill bad">Contract ended</span>':'<span class="mag-pill off">No contract dates</span>';
    terms='<p>'+badge+'</p><div class="mag-grid">'+[['Contract',[t.contract_start&&'from '+fmtD(t.contract_start),t.contract_end&&'to '+fmtD(t.contract_end)].filter(Boolean).join(' ')],['Commission',t.commission_override_pct!=null?t.commission_override_pct+'%':''],['Exclusivity',excl[t.exclusivity]||''],['With the agency since',fmtD(r.placement.since)]].map(function(x){return '<div><small>'+esc(x[0])+'</small><b>'+(x[1]?esc(x[1]):'<i class="mag-none">Not set</i>')+'</b></div>';}).join('')+'</div>'+(t.notes?'<p class="mag-sub">'+esc(t.notes)+'</p>':'')+(t.staff_notes?'<p class="mag-priv"><em>Private</em> '+esc(t.staff_notes)+'</p>':'')+'<button type="button" class="mag-link" onclick="MDV_MAG.rosterEdit(\''+esc(r.model_id)+'\')">Edit terms</button>';
  }
  return '<div class="mag-rd"><div class="mag-rd-grid">'+sec('Outstanding',out)+sec('Availability',av)+sec('Travel',tr)+sec('Visa'+(r.work_auth?' and work':''),vz+(r.work_auth?'<p class="mag-sub">Work authorisation expires '+esc(fmtD(r.work_auth.expires_on))+'</p>':'')+pp)+sec('Work',wk)+sec('Updates from the agency',up)+sec('Placement and terms',terms)+'</div><div class="mag-actions"><button type="button" class="mag-btn" onclick="MDV_MAG.model(\''+esc(r.model_id)+'\')">Open model profile</button><button type="button" class="mag-btn" onclick="MDV_MAG.disconnect(\''+esc(r.model_id)+'\',\''+esc(String(r.name).replace(/[\\\']/g,''))+'\')">Disconnect</button></div></div>';
}
function rosterRow(r){
  var open=RS.open===r.model_id,n=arr(r.outstanding).filter(function(o){return o.tone!=='info';}).length;
  return '<article class="mag-rr'+(open?' open':'')+' '+r.level+'"><button type="button" class="mag-rr-h" onclick="MDV_MAG.rosterOpen(\''+esc(r.model_id)+'\')" aria-expanded="'+open+'"><span class="mag-mph">'+(r.photo?'<img loading="lazy" src="'+esc(r.photo)+'" alt="">':esc(initials(r.name)))+'</span><span class="mag-rr-name"><b>'+esc(r.name)+'</b><small>'+esc([r.placement.markets.join(', '),r.placement.status].filter(Boolean).join(' · ')||'Placed')+'</small></span><span class="mag-rr-chips">'+rcAvail(r)+rcTravel(r)+rcVisa(r)+rcWork(r)+'</span>'+(n?'<span class="mag-rr-n '+r.level+'" title="Needs attention">'+n+'</span>':'<span class="mag-rr-n ok" title="All clear">✓</span>')+'</button>'+(open?rosterDetail(r):'')+'</article>';
}
function modelsPanel(d){
  var a=d.agency||{},R=S.roster,ms=arr(d.models),warn=d.warning?'<div class="mag-note bad">'+esc(d.warning)+'</div>':'';
  var head='<header><h4>Models</h4><span class="mag-count">'+(R&&R.roster?R.roster.length:ms.length)+'</span><span class="mag-sec-act"><button type="button" class="mag-btn" onclick="MDV_MAG.openBulk(\''+esc(a.id)+'\')">Paste a list</button><button type="button" class="mag-btn gold" onclick="MDV_MAG.pick(\''+esc(a.id)+'\')">+ Connect models</button></span></header>'+warn;
  if(S.rosterLoading&&!R)return '<section class="mag-sec">'+head+'<p class="mag-sub">Loading the roster…</p></section>';
  if(!R||!R.roster)return '<section class="mag-sec">'+head+(ms.length?'<div class="mag-mods">'+ms.map(function(m){return '<div class="mag-modw"><button type="button" class="mag-mod" onclick="MDV_MAG.model(\''+esc(m.id)+'\')"><span class="mag-mph">'+(m.photo?'<img loading="lazy" src="'+esc(m.photo)+'" alt="">':esc(initials(m.name)))+'</span><b>'+esc(m.name)+'</b><em>'+esc([m.market,m.status].filter(Boolean).join(' · ')||'—')+'</em></button></div>';}).join('')+'</div>':'<p class="mag-sub">No models are connected to this agency yet. Choose <b>Connect models</b> to pick them from your roster, or <b>Paste a list</b> of names.</p>')+'</section>';
  var s=R.summary||{},list=rosterFiltered();
  var kp=[['Need attention',s.needs_attention,s.urgent?'bad':s.needs_attention?'warn':''],['Away now',s.away_now,''],['Traveling in 30 days',s.traveling_soon,''],['Visa open',s.visa_open,s.visa_open?'warn':''],['Bookings in 30 days',s.upcoming_bookings,'']].map(function(x){return '<div class="mag-rk '+x[2]+'"><b>'+(x[1]||0)+'</b><small>'+esc(x[0])+'</small></div>';}).join('');
  var chips=[['all','All'],['attention','Needs attention'],['away','Away'],['travel','Traveling'],['visa','Visa'],['contract','Contract']].map(function(c){return '<button type="button" class="mag-chip'+(RS.filter===c[0]?' on':'')+'" onclick="MDV_MAG.rosterFilter(\''+c[0]+'\')">'+c[1]+'</button>';}).join('');
  var warns=arr(R.warnings).length?'<p class="mag-sub">Some information could not be read ('+esc(R.warnings.map(function(w){return w.section;}).join(', '))+').</p>':'';
  return '<section class="mag-sec">'+head+(R.roster.length?'<div class="mag-rks">'+kp+'</div><div class="mag-tools"><div class="mag-chips">'+chips+'</div><input class="mag-search" id="mag-rq" type="search" placeholder="Search models" value="'+esc(RS.q)+'" oninput="MDV_MAG.rosterSearch(this.value)"></div>'+warns+(list.length?'<div class="mag-rr-list">'+list.map(rosterRow).join('')+'</div>':'<div class="mag-empty">No models match.</div>'):'<p class="mag-sub">No models are connected to this agency yet. Choose <b>Connect models</b> to pick them from your roster, or <b>Paste a list</b> of names.</p>')+'</section>';
}
function loadRoster(id){
  S.rosterLoading=true;
  return get('/api/agent/mother-agencies?organization='+encodeURIComponent(org())+'&partner_id='+encodeURIComponent(id)+'&roster=1').then(function(r){if(S.open===id)S.roster=r;}).catch(function(e){if(S.open===id){S.roster=null;toast('The roster details could not load: '+((e&&e.message)||'try again'));}}).then(function(){S.rosterLoading=false;if(S.open===id)paintDrawer();});
}
async function rosterSave(modelId){
  var a=S.detail&&S.detail.agency;if(!a)return;var t={};
  ['contract_start','contract_end','commission_override_pct','exclusivity','notes','staff_notes'].forEach(function(k){var el=document.getElementById('mag-pt-'+k);if(el)t[k]=el.value;});
  try{await post({action:'save_placement_terms',partner_id:a.id,model_id:modelId,terms:t});RS.edit=null;toast('Terms saved');}catch(e){toast((e&&e.message)||'Could not save the terms');return;}   /* on an error the form stays as typed */
  await loadRoster(a.id);
}
/* ---------- activity and earnings ---------- */
var AC={days:90,open:false,loading:false,tl:12};
function money(n,c){try{return new Intl.NumberFormat('en-US',{style:'currency',currency:c||'USD',maximumFractionDigits:0}).format(Number(n)||0);}catch(e){return (c||'')+' '+Math.round(Number(n)||0);}}
function monthLbl(m){var d=new Date(m+'-15T12:00:00');return isNaN(d)?m:d.toLocaleDateString([], {month:'short'});}
var KIND_ICON={placement:'◍',update:'✎',booking:'▤',approval:'✓',statement:'≡',payment:'$',document:'▣',terms:'§'};
function activityPanel(d){
  var a=S.activity,head='<header><h4>Activity and earnings</h4><span class="mag-sec-act">'+(AC.open?[[30,'30 days'],[90,'90 days'],[365,'1 year'],[0,'All']].map(function(p){return '<button type="button" class="mag-chip'+(AC.days===p[0]?' on':'')+'" onclick="MDV_MAG.actDays('+p[0]+')">'+p[1]+'</button>';}).join(''):'<button type="button" class="mag-btn" onclick="MDV_MAG.actOpen()">Show</button>')+'</span></header>';
  if(!AC.open)return '<section class="mag-sec">'+head+'<p class="mag-sub">What this agency’s models have worked on, what it earns, what has been paid, and a timeline of everything between you.</p></section>';
  if(AC.loading&&!a)return '<section class="mag-sec">'+head+'<p class="mag-sub">Loading…</p></section>';
  if(!a)return '<section class="mag-sec">'+head+'<p class="mag-sub">The activity could not be loaded. <button type="button" class="mag-link" onclick="MDV_MAG.actOpen()">Try again</button></p></section>';
  var k=a.kpis,cur=a.main_currency,tiles=[['Jobs worked',k.bookings,k.upcoming?k.upcoming+' coming up':''],['Gross billed',money(k.gross,cur),''],['Agency commission',money(k.commission,cur),a.money.length>1?'plus '+a.money.slice(1).map(function(m){return money(m.commission,m.currency);}).join(', '):''],['Paid so far',money(k.paid,k.paid_currency||cur),''],['Castings',k.castings,k.booking_rate!=null?k.booking_rate+'% booked':''],['Waiting on models',k.waiting_on_models,k.no_rate?k.no_rate+' without a rate':'']].map(function(x){return '<div class="mag-rk"><b>'+esc(String(x[1]))+'</b><small>'+esc(x[0])+'</small>'+(x[2]?'<em>'+esc(x[2])+'</em>':'')+'</div>';}).join('');
  var maxC=Math.max.apply(null,a.monthly.map(function(m){return m.commission;}).concat([1]));
  var chart='<div class="mag-bars" role="img" aria-label="Commission by month">'+a.monthly.map(function(m){return '<div class="mag-bar" title="'+esc(monthLbl(m.month)+': '+money(m.commission,cur)+' · '+m.bookings+' job'+(m.bookings===1?'':'s'))+'"><i style="height:'+Math.max(m.commission?4:1,Math.round(m.commission/maxC*100))+'%"></i><small>'+esc(monthLbl(m.month))+'</small></div>';}).join('')+'</div>';
  var tot=a.commission_by_state.reduce(function(n,s){return n+s.amount;},0),states=tot?'<div class="mag-stack">'+a.commission_by_state.filter(function(s){return s.amount>0;}).map(function(s){return '<i class="s-'+s.key+'" style="flex:'+s.amount+'" title="'+esc(s.label+': '+money(s.amount,cur))+'"></i>';}).join('')+'</div><div class="mag-legend">'+a.commission_by_state.map(function(s){return '<span class="s-'+s.key+'"><i></i>'+esc(s.label)+' <b>'+esc(money(s.amount,cur))+'</b></span>';}).join('')+'</div>':'<p class="mag-sub">No commission on worked jobs in this period.</p>';
  var bm=a.by_model.length?'<table class="mag-tbl"><thead><tr><th>Model</th><th>Jobs</th><th>Gross</th><th>Commission</th><th>Castings</th><th>Last job</th></tr></thead><tbody>'+a.by_model.map(function(m){return '<tr><td><b>'+esc(m.name)+'</b>'+(m.current?'':' <em class="mag-badge">Past</em>')+(m.no_rate?' <em class="mag-badge warn">'+m.no_rate+' no rate</em>':'')+'</td><td>'+m.bookings+(m.upcoming?' <small>+'+m.upcoming+'</small>':'')+'</td><td>'+esc(money(m.gross,cur))+'</td><td><b>'+esc(money(m.commission,cur))+'</b></td><td>'+m.castings+(m.castings?' <small>'+m.castings_booked+' booked</small>':'')+'</td><td>'+esc(fmtD(m.last_booking)||'—')+'</td></tr>';}).join('')+'</tbody></table>':'<p class="mag-sub">No models connected yet.</p>';
  var cl=arr(a.by_client).length?'<ul class="mag-rd-l">'+a.by_client.map(function(c){return '<li><b>'+esc(c.client)+'</b> '+esc(plural(c.bookings,'job'))+' · '+esc(money(c.gross,cur))+' billed · '+esc(money(c.commission,cur))+' commission</li>';}).join('')+'</ul>':'<p class="mag-sub">No client jobs in this period.</p>';
  var rb=arr(a.recent_bookings).length?'<ul class="mag-rd-l">'+a.recent_bookings.map(function(b){return '<li><b>'+esc(b.title)+'</b> '+esc(b.model)+' · '+esc(fmtD(b.starts_at))+' · '+(b.has_rate?esc(money(b.commission,b.currency))+' commission':'<span class="bad">no rate</span>')+'</li>';}).join('')+'</ul>':'<p class="mag-sub">Nothing worked in this period.</p>';
  var st=arr(a.statements).length?'<ul class="mag-rd-l">'+a.statements.map(function(s){return '<li><b>'+esc(fmtD(s.period_start)+' to '+fmtD(s.period_end))+'</b> '+esc(s.status)+(s.closing_balance!=null?' · '+esc(money(s.closing_balance,s.currency)):'')+'</li>';}).join('')+'</ul>':'<p class="mag-sub">No statements issued yet.</p>';
  var tl=arr(a.timeline),shown=tl.slice(0,AC.tl);
  var tlh=tl.length?'<ol class="mag-tl">'+shown.map(function(t){return '<li class="'+t.tone+'"><span class="mag-tl-i">'+(KIND_ICON[t.kind]||'•')+'</span><div><b>'+esc(t.title)+'</b>'+(t.detail?'<small>'+esc(t.detail)+'</small>':'')+'</div><time>'+esc(fmtD(t.at))+'</time></li>';}).join('')+'</ol>'+(tl.length>AC.tl?'<button type="button" class="mag-link" onclick="MDV_MAG.actMore()">Show more ('+(tl.length-AC.tl)+')</button>':''):'<p class="mag-sub">Nothing has happened yet.</p>';
  var warns=arr(S.activityWarn).length?'<p class="mag-sub">Some information could not be read ('+esc(S.activityWarn.map(function(w){return w.section;}).join(', '))+').</p>':'';
  return '<section class="mag-sec">'+head+warns+'<div class="mag-rks">'+tiles+'</div><h5 class="mag-h5">Commission by month</h5>'+chart+'<h5 class="mag-h5">Where the commission stands</h5>'+states
   +'<h5 class="mag-h5">By model</h5><div class="mag-tblwrap">'+bm+'</div>'
   +'<div class="mag-rd-grid"><div class="mag-rd-sec"><h6>Recent jobs</h6>'+rb+'</div><div class="mag-rd-sec"><h6>Clients</h6>'+cl+'</div><div class="mag-rd-sec"><h6>Statements</h6>'+st+'</div></div>'
   +'<h5 class="mag-h5">Timeline</h5>'+tlh+'</section>';
}
function loadActivity(){
  var id=S.open;if(!id)return Promise.resolve();AC.loading=true;paintDrawer();
  return get('/api/agent/mother-agencies?organization='+encodeURIComponent(org())+'&partner_id='+encodeURIComponent(id)+'&activity=1&days='+AC.days).then(function(r){if(S.open===id){S.activity=r.activity;S.activityWarn=r.warnings;}}).catch(function(e){if(S.open===id){S.activity=null;toast('The activity could not load: '+((e&&e.message)||'try again'));}}).then(function(){AC.loading=false;if(S.open===id)paintDrawer();});
}

/* ---------- what is left to fill in ---------- */
function tasksLeft(d){
  var f=d.agency.fields||{},t=d.terms||{},out=[];
  function add(tab,text){out.push({tab:tab,text:text});}
  if(!arr(d.agency.documents).every(function(x){return x.state==='ok'||x.state==='expiring';}))add('docs','Agency documents are missing or expired');
  if(!f.legal_name||!f.registration_no)add('company','Add the legal name and registration number');
  if(!f.address_line)add('company','Add the office address');
  if(!arr(f.specialties).length)add('company','Add the agency’s specialties');
  if(!arr(d.team).length)add('team','Add the people we work with there');
  if(t.commission_pct==null&&t.agency_share_pct==null)add('terms','Set the commission split');
  if(!t.contract_start&&!t.contract_end)add('terms','Add the contract dates');
  if(!t.payment_terms)add('terms','Set the payment terms');
  if(!arr(d.models).length)add('models','Connect this agency’s models');
  return out;
}
/* ---------- the profile page: header card, figures, a main column and a sidebar (like a company or contact profile) ---------- */
function mainContact(d){var f=d.agency.fields||{},m=arr(d.team).filter(function(x){return x.primary;})[0]||arr(d.team)[0];return {name:(m&&m.name)||f.contact_name||'',role:(m&&m.role)||f.contact_role||'',email:(m&&m.email)||f.contact_email||'',phone:(m&&m.phone)||f.contact_phone||''};}
function lastActivity(){var t=S.activity&&arr(S.activity.timeline)[0];return t?fmtD(t.at):'';}
function heroHtml(d){
  var a=d.agency,c=mainContact(d),fl=flags(a),logo=a.logo_url?'<img src="'+esc(a.logo_url)+'" alt="">':'<span>'+esc(initials(a.name))+'</span>';
  var first=(c.name||'').split(' ')[0];
  var acts=(c.email?'<a class="mag-ha primary" href="mailto:'+esc(c.email)+'">✉ Email '+esc(first||'the agency')+'</a>':'<button type="button" class="mag-ha primary" onclick="MDV_MAG.teamAdd()">+ Add a contact</button>')
    +'<button type="button" class="mag-ha" onclick="MDV_MAG.pick(\''+esc(a.id)+'\')">+ Connect models</button><a class="mag-ha" href="'+PORTAL+'" target="_blank" rel="noopener">Open the portal</a><button type="button" class="mag-ha" onclick="MDV_MAG.edit(true)">Edit</button>';
  return '<header class="mag-hero"><div class="mag-hero-l"><div class="mag-logo big">'+logo+'</div><div class="mag-hero-t"><div class="mag-kicker">MOTHER AGENCY PROFILE</div><h2>'+esc(a.name)+'</h2><p>'+esc([a.city,a.country].filter(Boolean).join(', ')||'Location not added')+(c.name?' · '+esc(c.name)+(c.role?', '+esc(c.role):''):'')+'</p>'+(fl.length?'<div class="mag-flags big">'+fl.map(function(x){return '<span class="'+x.tone+'">'+esc(x.text)+'</span>';}).join('')+'</div>':'')+'</div></div><div class="mag-hero-a">'+acts+'</div></header>';
}
function tilesHtml(d){
  var a=d.agency,k=S.activity&&S.activity.kpis,cur=S.activity&&S.activity.main_currency,c=a.contract||{state:'none'};
  var contract=c.state==='active'?'Active':c.state==='renew'?'Renews in '+c.days_left+'d':c.state==='ended'?'Ended':c.state==='open'?'Open':'—';
  var cells=[[S.roster&&S.roster.roster?S.roster.roster.length:arr(d.models).length,'Models'],[k?k.bookings:'…','Jobs, 90 days'],[k?k.castings:'…','Castings'],[k?money(k.commission,cur):'…','Commission, 90 days'],[contract,'Contract'],[lastActivity()||'—','Last activity']];
  return '<div class="mag-tiles">'+cells.map(function(x){return '<div class="mag-tile"><b>'+esc(String(x[0]))+'</b><small>'+esc(x[1])+'</small></div>';}).join('')+'</div>';
}
function veuxHtml(d){
  var a=d.agency,R=S.roster,s=(R&&R.summary)||{},c=a.contract||{},parts=[],todo=tasksLeft(d),ct=mainContact(d);
  if(s.urgent)parts.push(plural(s.urgent,'model')+' need'+(s.urgent===1?'s':'')+' urgent attention.');else if(s.needs_attention)parts.push(plural(s.needs_attention,'model')+' need'+(s.needs_attention===1?'s':'')+' a look.');
  if(c.state==='renew')parts.push('The contract renews in '+c.days_left+' days.');else if(c.state==='ended')parts.push('The contract has ended.');
  if(S.activity&&S.activity.kpis&&S.activity.kpis.waiting_on_models)parts.push(plural(S.activity.kpis.waiting_on_models,'model')+' still to answer a booking request.');
  if(todo.length)parts.push(plural(todo.length,'detail')+' still to fill in on this profile.');
  var text=parts.length?parts.join(' '):(S.activity&&arr(S.activity.timeline).length?'Everything is up to date.':'No recorded activity with '+a.name+' yet. A short introduction is the best next step.');
  var cta=ct.email?'<a class="mag-cta" href="mailto:'+esc(ct.email)+'?subject='+encodeURIComponent('Maison de Veux · '+a.name)+'">✉ Write a follow-up</a>':'<button type="button" class="mag-cta" onclick="MDV_MAG.teamAdd()">+ Add a contact</button>';
  return '<section class="mag-veux"><small>✦ VEUX</small><p>'+esc(text)+'</p>'+cta+'</section>';
}
function todoCard(d){
  var todo=tasksLeft(d);if(!todo.length)return '';
  return '<section class="mag-sec"><header><h4>To do</h4><span class="mag-count">'+todo.length+'</span></header><ul class="mag-todo">'+todo.map(function(x){return '<li><span>'+esc(x.text)+'</span><button type="button" class="mag-link" onclick="MDV_MAG.tab(\''+x.tab+'\')">Open</button></li>';}).join('')+'</ul></section>';
}
function recentCard(){
  var a=S.activity;if(!a||!arr(a.recent_bookings).length)return '';
  return '<section class="mag-sec"><header><h4>Recent jobs</h4><span class="mag-count">'+a.recent_bookings.length+'</span></header><ul class="mag-rd-l">'+a.recent_bookings.map(function(b){return '<li><b>'+esc(b.title)+'</b> '+esc(b.model)+' · '+esc(fmtD(b.starts_at))+' · '+(b.has_rate?esc(money(b.commission,b.currency))+' commission':'<span class="bad">no rate</span>')+'</li>';}).join('')+'</ul></section>';
}
function secWrap(id,html){return '<div id="mag-s-'+id+'" class="mag-anchor">'+html+'</div>';}
function profilePage(d){
  return heroHtml(d)+tilesHtml(d)
   +'<div class="mag-pcols"><div class="mag-pmain">'+secWrap('company',companyPanel(d))+secWrap('team',teamPanel(d))+secWrap('models',modelsPanel(d))+secWrap('activity',activityPanel(d))+secWrap('terms',termsPanel(d))+'</div>'
   +'<aside class="mag-pside">'+veuxHtml(d)+accessPanel(d.agency)+todoCard(d)+secWrap('docs',docsPanel(d))+recentCard()+'</aside></div>';
}
function paintDrawer(){
  var d=drawerEl(),a=S.detail&&S.detail.agency,oldP=d.querySelector('.mag-panel'),keepTop=oldP&&!S.inl?oldP.scrollTop:0,keepY=S.inl?window.scrollY:0;
  if(S.detailLoading&&!S.detail){d.innerHTML='<aside class="mag-panel'+(S.inl?' inl':'')+'"><div class="mag-empty">Loading…</div></aside>';return;}
  if(!S.detail){d.innerHTML='<aside class="mag-panel'+(S.inl?' inl':'')+'"><button class="mag-x" onclick="MDV_MAG.close()">×</button><div class="mag-empty">'+esc(S.error||'Could not load this agency.')+'</div></aside>';return;}
  var logo=a.logo_url?'<img src="'+esc(a.logo_url)+'" alt="">':'<span>'+esc(initials(a.name))+'</span>',fl=flags(a);
  d.innerHTML='<aside class="mag-panel'+(S.inl?' inl':'')+' mag-profile" role="dialog" aria-label="'+esc(a.name)+'"><button class="mag-back" onclick="MDV_MAG.close()">← Mother agencies</button><button class="mag-x" aria-label="Close" onclick="MDV_MAG.close()">×</button>'+profilePage(S.detail)+'</aside>';
  var np=d.querySelector('.mag-panel');if(np&&keepTop)np.scrollTop=keepTop;
  if(S.inl&&keepY)window.scrollTo(0,keepY);
}

/* ---------- data and actions ---------- */
function load(){
  if(S.loading)return Promise.resolve();
  S.loading=true;S.error=null;paint();
  return get('/api/agent/mother-agencies?organization='+encodeURIComponent(org())).then(function(r){S.list=arr(r.agencies);}).catch(function(e){S.error=(e&&e.message)||'Could not load mother agencies.';}).then(function(){S.loading=false;paint();});
}
function open(id){
  if(!inlineOK()&&typeof window.navTo==='function'&&!S.noNav){S.pending=id;window.navTo('motheragencies');return Promise.resolve();}   /* from another page: go to the Mother Agencies page first */
  S.inl=inlineOK();S.open=id;S.detail=null;S.edit=false;S.teamEdit=null;S.termsEdit=false;S.roster=null;S.activity=null;S.activityWarn=null;AC.open=true;AC.tl=12;RS.open=null;RS.edit=null;S.code=null;S.detailLoading=true;S.error=null;paintDrawer();document.addEventListener('keydown',onKey);
  return get('/api/agent/mother-agencies?organization='+encodeURIComponent(org())+'&partner_id='+encodeURIComponent(id)).then(function(r){S.detail=r;}).catch(function(e){S.error=(e&&e.message)||'';}).then(function(){S.detailLoading=false;paintDrawer();if(S.detail){loadRoster(id);loadActivity();}});
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

window.renderMotherAgencies=function(el){S.host=el;paint();return load().then(function(){if(S.pending){var id=S.pending;S.pending=null;S.noNav=true;open(id);S.noNav=false;}});};
window.MDV_MAG={render:window.renderMotherAgencies,reload:load,open:open,close:close,filter:function(f){S.filter=f;paint();},search:function(v){S.q=v;paint();},add:add,access:access,portal:portal,edit:function(on){S.edit=!!on;paintDrawer();},save:save,view:view,copy:copy,model:openModel,state:S,actOpen:function(){AC.open=true;AC.tl=12;loadActivity();},actDays:function(n){AC.days=n;loadActivity();},actMore:function(){AC.tl+=20;paintDrawer();},rosterOpen:function(id){RS.open=RS.open===id?null:id;RS.edit=null;paintDrawer();},rosterFilter:function(f){RS.filter=f;paintDrawer();},rosterSearch:function(v){RS.q=v;var el=document.querySelector('.mag-rr-list'),l=rosterFiltered();if(el)el.innerHTML=l.length?l.map(rosterRow).join(''):'<div class="mag-empty">No models match.</div>';},rosterEdit:function(id){RS.edit=id;paintDrawer();},rosterSave:rosterSave,tab:function(t){var el=document.getElementById('mag-s-'+t);if(el)el.scrollIntoView({behavior:'smooth',block:'start'});},teamAdd:function(){S.teamEdit='new';paintDrawer();},teamEdit:function(i){S.teamEdit=i;paintDrawer();},teamCancel:function(){S.teamEdit=null;paintDrawer();},teamSave:teamSave,teamRemove:teamRemove,termsEdit:function(on){S.termsEdit=!!on;paintDrawer();},termsSave:termsSave,pick:openPick,pickFilter:function(f){LK.pick.filter=f;paintPick();},pickSearch:function(v){LK.pick.q=v;LK.pick.focusSearch=true;paintPick();},pickToggle:function(id,on){if(on)LK.pick.sel[id]=1;else delete LK.pick.sel[id];paintPick();},pickGo:pickGo,disconnect:disconnect,openBulk:openBulk,closeModal:closeModal,bulkText:function(v){LK.bulk.text=v;var b=document.querySelector('#mag-bulk footer .gold');if(b)b.disabled=!v.trim();},bulkFile:readFile,bulkCheck:bulkCheck,bulkGo:bulkGo,bulkBack:function(){LK.bulk.res=null;LK.bulk.dec={};paintBulk();},bulkTick:function(line,on){var row=LK.bulk.res.rows.find(function(x){return x.line===line;});decOf(row).on=!!on;paintBulk();},bulkSet:function(line,what,val){var row=LK.bulk.res.rows.find(function(x){return x.line===line;}),d=decOf(row);if(what==='model')d.model_id=val||null;else{d.partner_id=val||'';if(val)d.create=false;}d.on=!!(d.model_id&&(d.partner_id||d.create));paintBulk();},bulkCreate:function(line,on){var row=LK.bulk.res.rows.find(function(x){return x.line===line;}),d=decOf(row);d.create=!!on;if(on)d.partner_id='';d.on=!!(d.model_id&&(d.partner_id||d.create));paintBulk();},template:function(){download('mother-agency-template.csv',TEMPLATE);},exportAll:exportAll};
(function register(){
  function put(){var m=window.VEUX_V15_ROUTE_RENDERERS;if(m&&typeof m==='object'){m.motheragencies=function(el){return window.renderMotherAgencies(el);};return true;}return false;}
  if(put())return;var n=0,t=setInterval(function(){if(put()||++n>400)clearInterval(t);},150);
  ['veux:shell-ready','veux:assets-ready','veux:auth-ready'].forEach(function(e){window.addEventListener(e,put);});
})();
})();
