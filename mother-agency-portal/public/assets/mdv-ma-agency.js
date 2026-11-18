/* Mother Agency portal: "My Agency" — the agency's own profile (details, logo, documents) beside the models it represents,
   with a plain-rule summary of what is complete, what is missing and what is about to expire. */
(function(){
'use strict';
if(window.MDV_MA_AGENCY)return;

var A={data:null,loading:false,error:null,edit:false,busy:'',tab:'profile',teamEdit:null,roster:null,rosterLoading:false,rosterErr:'',rFilter:'all',rQ:'',rOpen:null,act:null,actLoading:false,aDays:90,aTl:12};
var DOCS=[['contract','Agency agreement','The signed agreement between your agency and Maison de Veux.'],['licence','Business licence','Your licence or registration to operate as a model agency.'],['id','Representative ID','Passport or ID of the person who signs for your agency.']];
var FIELDS=[['tagline','Tagline','text','One line that sums up your agency'],['bio','About the agency','area','Who you are, who you represent and what you are known for'],['legal_name','Legal name','text','The registered company name'],['registration_no','Registration / licence no.','text',''],['tax_id','Tax ID','text',''],['founded_year','Founded','text','2012'],['models_count','Models in your agency','text','e.g. 40'],['address_line','Address','text','Street and number'],['address_line2','Address line 2','text',''],['city','City','text',''],['state','State / region','text',''],['postal_code','Postal code','text',''],['country','Country','text',''],['specialties','Specialties','list','Editorial, Commercial, Runway (separate with commas)'],['regions','Markets and regions you cover','list','Lagos, West Africa, Europe'],['languages','Languages spoken','list','English, French, Yoruba'],['website','Website','text','www.youragency.com'],['instagram','Instagram','text','@youragency'],['contact_name','Main contact','text',''],['contact_role','Their role','text','Head booker, director…'],['contact_email','Contact email','text',''],['contact_phone','Contact phone','text',''],['whatsapp','WhatsApp','text','']];
var GROUPS=[['About',['tagline','bio']],['Company',['legal_name','registration_no','tax_id','founded_year','models_count']],['Address',['address_line','address_line2','city','state','postal_code','country']],['Focus',['specialties','regions','languages']],['Online',['website','instagram']],['Main contact',['contact_name','contact_role','contact_email','contact_phone','whatsapp']]];
var TOPICS=[['bookings','Bookings'],['castings','Castings'],['travel','Travel'],['visa','Visa'],['accounts','Accounts and payments'],['contracts','Contracts'],['development','Development'],['general','General']];
var ROLES=['Director','Head booker','Booker','Scout','Accounts','Travel coordinator','Visa and legal','Assistant'];
var EXCL={none:'Not exclusive',market:'Exclusive in some markets',full:'Fully exclusive'},PAYT={on_receipt:'On receipt',net_15:'Net 15 days',net_30:'Net 30 days',net_45:'Net 45 days',net_60:'Net 60 days',custom:'Custom (see notes)'};

function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
function arr(v){return Array.isArray(v)?v:[];}
function boot(){return (window.VEUX_PARTNER&&VEUX_PARTNER.getBoot&&VEUX_PARTNER.getBoot())||{};}
function toast(m){try{if(window.toast)return window.toast(m);}catch(e){}}
function api(path,body){var o=body?{method:'POST',body:JSON.stringify(Object.assign({organization_slug:'maison-de-veux'},body))}:{method:'GET'};return VEUX_PARTNER.api(path,o);}
function lc(s){return String(s||'').replace(/^[A-Z](?![A-Z])/,function(c){return c.toLowerCase();});}
function initials(n){return String(n||'?').trim().split(/\s+/).slice(0,2).map(function(x){return x[0]||'';}).join('').toUpperCase()||'?';}
function agencyName(){var b=boot(),p=b.partner||{},c=p.companies||{};return (A.data&&A.data.agency&&A.data.agency.name)||c.name||p.name||'Your agency';}

/* ---------- measurements, read whichever way they were typed and shown in both units ---------- */
function num(v){var n=parseFloat(String(v==null?'':v).replace(',','.'));return isFinite(n)?n:null;}
function readM(kind,cm,disp){
  var c=num(cm),inch=null,s=String(disp==null?'':disp).trim();
  if(c&&c>0)inch=c/2.54;
  else if(s){
    var ft=s.match(/^(\d+)\s*(?:'|’|′|ft)\s*(\d+(?:\.\d+)?)?/i),cmm=s.match(/(\d+(?:\.\d+)?)\s*cm/i),im=s.match(/(\d+(?:\.\d+)?)\s*(?:"|”|″|in\b)/i),pl=s.match(/^(\d+(?:\.\d+)?)$/);
    if(ft){inch=parseInt(ft[1],10)*12+(ft[2]?parseFloat(ft[2]):0);c=inch*2.54;}
    else if(cmm){c=parseFloat(cmm[1]);inch=c/2.54;}
    else if(im){inch=parseFloat(im[1]);c=inch*2.54;}
    else if(pl){var n=parseFloat(pl[1]);if(kind==='h'?n>=100:n>=50){c=n;inch=n/2.54;}else{inch=n;c=n*2.54;}}
  }
  return (c>0&&inch>0)?{cm:c,inch:inch}:null;
}
function ftin(r){var t=Math.round(r.inch),f=Math.floor(t/12);return f+'′'+(t-f*12)+'″';}
function measLine(mm){
  mm=mm||{};
  var h=readM('h',mm.height_cm,mm.height_display),b=readM('c',mm.bust_cm||mm.chest_cm,mm.bust_display||mm.chest_display),w=readM('c',mm.waist_cm,mm.waist_display),hp=readM('c',mm.hips_cm,mm.hips_display);
  var out=[];
  if(h)out.push(ftin(h)+' · '+Math.round(h.cm)+' cm');
  if(b&&w&&hp)out.push([b,w,hp].map(function(r){return Math.round(r.inch*2)/2;}).join('-')+'″');
  return {text:out.join('  ·  '),missing:[!h&&'height',!b&&'bust',!w&&'waist',!hp&&'hips'].filter(Boolean)};
}
function placementFor(id){return arr(boot().placements).find(function(p){return p.model_id===id;})||{};}
function photoOf(m){var a=arr(m.media),x=a.find(function(y){return y.is_primary;})||a[0]||{};return x.url||x.public_url||'';}
function marketOf(m){var p=placementFor(m.id);return (p.markets&&p.markets.name)||m.primary_market_label||'';}

/* ---------- the smart part: rules over what the agency has filled in ---------- */
function daysTo(d){var t=d?new Date(d+'T12:00:00').getTime():NaN;return isFinite(t)?Math.ceil((t-Date.now())/864e5):null;}
function analyse(){
  var d=A.data||{},f=d.profile||{},docs=arr(d.documents),models=arr(boot().models),todo=[],score=0;
  function chk(ok,pts,item){if(ok)score+=pts;else todo.push(item);}
  chk(!!d.logo_url,10,{id:'logo',tone:'warn',text:'Add your agency logo',act:'Upload logo',fn:'logo'});
  chk(!!f.tagline,5,{id:'tagline',tone:'info',text:'Add a one-line tagline',act:'Edit',fn:'edit'});
  chk((f.bio||'').length>=80,15,{id:'bio',tone:'warn',text:(f.bio?'Your about text is short':'Write a short about text')+' — a few sentences on who you are and who you represent',act:'Edit',fn:'edit'});
  chk(!!(f.city&&f.country),10,{id:'loc',tone:'warn',text:'Add your city and country',act:'Edit',fn:'edit'});
  chk(!!f.website,5,{id:'web',tone:'info',text:'Add your website',act:'Edit',fn:'edit'});
  chk(!!f.instagram,5,{id:'ig',tone:'info',text:'Add your Instagram',act:'Edit',fn:'edit'});
  chk(!!f.contact_name,5,{id:'cn',tone:'warn',text:'Name the person we should contact',act:'Edit',fn:'edit'});
  chk(!!(f.contact_email&&/@/.test(f.contact_email)),10,{id:'ce',tone:'warn',text:'Add a contact email',act:'Edit',fn:'edit'});
  chk(!!f.contact_phone,5,{id:'cp',tone:'info',text:'Add a contact phone number',act:'Edit',fn:'edit'});
  /* recommended, not scored */
  if(!f.legal_name||!f.registration_no)todo.push({id:'legal',tone:'info',text:'Add your legal name and registration number',act:'Edit',fn:'edit'});
  if(!f.address_line)todo.push({id:'addr',tone:'info',text:'Add your office address',act:'Edit',fn:'edit'});
  if(!arr(f.specialties).length)todo.push({id:'spec',tone:'info',text:'Say what you specialise in (editorial, commercial, runway…)',act:'Edit',fn:'edit'});
  if(!arr(d.team).length)todo.push({id:'team',tone:'info',text:'Add the people we should work with: bookers, accounts, travel, visa',act:'Team',fn:'team'});
  DOCS.forEach(function(x){
    var have=docs.filter(function(q){return q.type===x[0];}).sort(function(a,b){return String(b.uploaded_at).localeCompare(String(a.uploaded_at));})[0];
    var left=have&&have.expires_on?daysTo(have.expires_on):null;
    if(!have){todo.push({id:'doc-'+x[0],tone:'warn',text:'Upload your '+lc(x[1]),act:'Upload',fn:'doc:'+x[0]});}
    else{score+=x[0]==='id'?10:10;if(left!=null&&left<0)todo.unshift({id:'exp-'+x[0],tone:'bad',text:'Your '+lc(x[1])+' expired '+(-left)+' day'+(left===-1?'':'s')+' ago',act:'Replace',fn:'doc:'+x[0]});else if(left!=null&&left<=60)todo.unshift({id:'exp-'+x[0],tone:'warn',text:'Your '+lc(x[1])+' expires in '+left+' day'+(left===1?'':'s'),act:'Replace',fn:'doc:'+x[0]});}
  });
  /* the models are Maison de Veux's data, so what is missing there is something to report, not something the agency edits */
  var noPhoto=models.filter(function(m){return !photoOf(m);}),noMeas=models.filter(function(m){return measLine(m.measurement).missing.length;});
  if(noMeas.length)todo.push({id:'meas',tone:'info',text:noMeas.length+' model'+(noMeas.length===1?'':'s')+' with incomplete measurements: '+noMeas.slice(0,3).map(function(m){return m.display_name;}).join(', ')+(noMeas.length>3?'…':''),act:'See models',fn:'models'});
  if(noPhoto.length)todo.push({id:'photo',tone:'info',text:noPhoto.length+' model'+(noPhoto.length===1?'':'s')+' without a photo yet: '+noPhoto.slice(0,3).map(function(m){return m.display_name;}).join(', ')+(noPhoto.length>3?'…':''),act:'See models',fn:'models'});
  var rank={bad:0,warn:1,info:2};todo.sort(function(a,b){return rank[a.tone]-rank[b.tone];});
  var byMarket={};models.forEach(function(m){var k=marketOf(m)||'Unplaced';byMarket[k]=(byMarket[k]||0)+1;});
  var markets=Object.keys(byMarket).sort(function(a,b){return byMarket[b]-byMarket[a];});
  var place=[f.city,f.country].filter(Boolean).join(', ');
  var sentence=agencyName()+(place?' · '+place:'')+' — represents '+models.length+' model'+(models.length===1?'':'s')+(markets.length&&models.length?' ('+markets.map(function(k){return byMarket[k]+' '+(k==='Unplaced'?'not yet placed':'in '+k);}).join(', ')+')':'')+'. Profile '+score+'% complete'+(todo.filter(function(t){return t.tone!=='info';}).length?', '+todo.filter(function(t){return t.tone!=='info';}).length+' item'+(todo.filter(function(t){return t.tone!=='info';}).length===1?'':'s')+' need attention.':'.');
  return {score:score,todo:todo,sentence:sentence,models:models.length,markets:markets,byMarket:byMarket};
}

/* ---------- drawing ---------- */
function ring(score){var tone=score>=80?'ok':score>=50?'warn':'bad';return '<div class="ag-ring '+tone+'" style="--p:'+score+'"><b>'+score+'</b><small>%</small></div>';}
function identity(an){
  var d=A.data||{},f=d.profile||{},name=agencyName();
  var logo=d.logo_url?'<img src="'+esc(d.logo_url)+'" alt="">':'<span>'+esc(initials(name))+'</span>';
  var links=[f.website&&'<a href="'+esc(f.website)+'" target="_blank" rel="noopener">'+esc(f.website.replace(/^https?:\/\//,''))+'</a>',f.instagram&&'<a href="https://instagram.com/'+esc(String(f.instagram).replace(/^@/,''))+'" target="_blank" rel="noopener">'+esc('@'+String(f.instagram).replace(/^@/,''))+'</a>'].filter(Boolean).join('<i>·</i>');
  return '<section class="ag-id"><div class="ag-logo" title="Change logo" onclick="MDV_MA_AGENCY.pick(\'logo\')">'+logo+'<em>Change</em></div><div class="ag-idtext"><div class="ag-kicker">MOTHER AGENCY</div><h1>'+esc(name)+'</h1>'+(f.tagline?'<p class="ag-tag">'+esc(f.tagline)+'</p>':'')+'<div class="ag-meta">'+[(f.city||f.country)&&esc([f.city,f.country].filter(Boolean).join(', ')),f.founded_year&&'Since '+esc(f.founded_year),an.models+' model'+(an.models===1?'':'s')].filter(Boolean).join('<i>·</i>')+'</div>'+(links?'<div class="ag-links">'+links+'</div>':'')+'</div><div class="ag-idact"><button class="v15p-btn gold" onclick="MDV_MA_AGENCY.edit(true)">Edit profile</button></div></section>';
}
function summary(an){
  var items=an.todo.length?an.todo.slice(0,6).map(function(t){return '<li class="'+t.tone+'"><span class="ag-dot"></span><span class="ag-tx">'+esc(t.text)+'</span><button type="button" onclick="MDV_MA_AGENCY.act(\''+esc(t.fn)+'\')">'+esc(t.act)+'</button></li>';}).join(''):'<li class="ok"><span class="ag-dot"></span><span class="ag-tx">Everything is complete and up to date.</span></li>';
  return '<section class="ag-card ag-smart"><div class="ag-smart-top">'+ring(an.score)+'<div><div class="ag-eyebrow">✦ Agency summary</div><p class="ag-sentence">'+esc(an.sentence)+'</p></div></div><ul class="ag-todo">'+items+'</ul>'+(an.todo.length>6?'<p class="ag-more">+ '+(an.todo.length-6)+' more</p>':'')+'</section>';
}
function tagsHtml(l){l=arr(l);return l.length?'<span class="ag-tags">'+l.map(function(x){return '<i>'+esc(x)+'</i>';}).join('')+'</span>':'<span class="ag-none">Not added</span>';}
function detailsView(){
  var f=(A.data&&A.data.profile)||{};
  function row(k,v,href,full){return '<div'+(full?' class="full"':'')+'><small>'+esc(k)+'</small><b>'+(v?(href?'<a href="'+esc(href)+'">'+esc(v)+'</a>':esc(v)):'<span class="ag-none">Not added</span>')+'</b></div>';}
  var addr=[f.address_line,f.address_line2,[f.postal_code,f.city].filter(Boolean).join(' '),f.state,f.country].filter(Boolean).join(', ');
  return '<section class="ag-card"><header><h3>Agency details</h3><button type="button" class="ag-link" onclick="MDV_MA_AGENCY.edit(true)">Edit</button></header>'
   +'<div class="ag-about">'+(f.bio?'<p>'+esc(f.bio).replace(/\n/g,'<br>')+'</p>':'<p class="ag-none">Tell Maison de Veux about your agency.</p>')+'</div>'
   +'<div class="ag-grid">'+row('Legal name',f.legal_name)+row('Registration / licence no.',f.registration_no)+row('Tax ID',f.tax_id)+row('Founded',f.founded_year)+row('Models in your agency',f.models_count)+row('Website',f.website,f.website)+row('Address',addr,null,true)
   +'<div class="full"><small>Specialties</small><b>'+tagsHtml(f.specialties)+'</b></div><div class="full"><small>Markets and regions</small><b>'+tagsHtml(f.regions)+'</b></div><div class="full"><small>Languages</small><b>'+tagsHtml(f.languages)+'</b></div>'
   +row('Instagram',f.instagram&&'@'+String(f.instagram).replace(/^@/,''),f.instagram&&'https://instagram.com/'+String(f.instagram).replace(/^@/,''))+row('Main contact',[f.contact_name,f.contact_role].filter(Boolean).join(' · '))+row('Email',f.contact_email,f.contact_email&&'mailto:'+f.contact_email)+row('Phone',f.contact_phone,f.contact_phone&&'tel:'+f.contact_phone)+row('WhatsApp',f.whatsapp)+'</div></section>';
}
function detailsEdit(){
  var f=(A.data&&A.data.profile)||{},by={};FIELDS.forEach(function(x){by[x[0]]=x;});
  var body=GROUPS.map(function(g){return '<h4 class="ag-h4">'+esc(g[0])+'</h4><div class="ag-form">'+g[1].map(function(k){var x=by[k],v=esc(Array.isArray(f[k])?f[k].join(', '):(f[k]||''));return '<label class="'+(x[2]==='area'||x[2]==='list'||k==='tagline'?'full':'')+'"><span>'+esc(x[1])+'</span>'+(x[2]==='area'?'<textarea id="ag-f-'+k+'" rows="5" maxlength="1800" placeholder="'+esc(x[3])+'">'+v+'</textarea>':'<input id="ag-f-'+k+'" value="'+v+'" placeholder="'+esc(x[3])+'">')+'</label>';}).join('')+'</div>';}).join('');
  return '<section class="ag-card"><header><h3>Edit agency details</h3></header>'+body+'<div class="ag-formact"><button class="v15p-btn" onclick="MDV_MA_AGENCY.edit(false)">Cancel</button><button class="v15p-btn gold" id="ag-save" onclick="MDV_MA_AGENCY.save()">Save profile</button></div></section>';
}
/* ---- the team: the agency keeps its own list ---- */
function teamCard(){
  var team=arr(A.data&&A.data.team),e=A.teamEdit;
  function card(m,i){return '<div class="ag-person"><div class="ag-pav">'+esc(initials(m.name))+'</div><div class="ag-pinfo"><b>'+esc(m.name)+(m.primary?' <em class="ag-badge">Main contact</em>':'')+'</b><small>'+esc(m.role||'No role added')+'</small><span class="ag-plinks">'+(m.email?'<a href="mailto:'+esc(m.email)+'">'+esc(m.email)+'</a>':'')+(m.phone?'<a href="tel:'+esc(m.phone)+'">'+esc(m.phone)+'</a>':'')+(m.whatsapp?'<span>WhatsApp '+esc(m.whatsapp)+'</span>':'')+'</span>'+(arr(m.topics).length?'<span class="ag-tags">'+m.topics.map(function(t){var o=TOPICS.filter(function(x){return x[0]===t;})[0];return '<i>'+esc(o?o[1]:t)+'</i>';}).join('')+'</span>':'')+'</div><div class="ag-pact"><button type="button" class="ag-link" onclick="MDV_MA_AGENCY.teamEdit('+i+')">Edit</button><button type="button" class="ag-link bad" onclick="MDV_MA_AGENCY.teamRemove('+i+')">Remove</button></div></div>';}
  var form='';
  if(e!==null&&e!==undefined){
    var m=e==='new'?{topics:[]}:team[e]||{topics:[]};
    form='<div class="ag-pform"><h4 class="ag-h4">'+(e==='new'?'Add a person':'Edit '+esc(m.name))+'</h4><div class="ag-form"><label><span>Name</span><input id="ag-t-name" value="'+esc(m.name||'')+'"></label><label><span>Role</span><input id="ag-t-role" list="ag-roles" value="'+esc(m.role||'')+'"><datalist id="ag-roles">'+ROLES.map(function(r){return '<option>'+r+'</option>';}).join('')+'</datalist></label><label><span>Email</span><input id="ag-t-email" type="email" value="'+esc(m.email||'')+'"></label><label><span>Phone</span><input id="ag-t-phone" value="'+esc(m.phone||'')+'"></label><label><span>WhatsApp</span><input id="ag-t-whatsapp" value="'+esc(m.whatsapp||'')+'"></label><label class="ag-chkrow"><input type="checkbox" id="ag-t-primary" '+(m.primary?'checked':'')+'><span>Main contact for the agency</span></label></div><div class="ag-topics"><span>Reach them about</span>'+TOPICS.map(function(t){return '<label><input type="checkbox" class="ag-t-topic" value="'+t[0]+'" '+(arr(m.topics).indexOf(t[0])>=0?'checked':'')+'> '+t[1]+'</label>';}).join('')+'</div><div class="ag-formact"><button class="v15p-btn" onclick="MDV_MA_AGENCY.teamCancel()">Cancel</button><button class="v15p-btn gold" onclick="MDV_MA_AGENCY.teamSave()">Save person</button></div></div>';
  }
  return '<section class="ag-card" id="ag-team"><header><div><h3>Your team</h3><p>The people Maison de Veux should work with, and what to reach each one about.</p></div><button type="button" class="v15p-btn" onclick="MDV_MA_AGENCY.teamAdd()">+ Add person</button></header>'+(team.length?'<div class="ag-people">'+team.map(card).join('')+'</div>':'<p class="ag-none">No one added yet.</p>')+form+'</section>';
}
/* ---- the terms: set by Maison de Veux, read only here ---- */
function termsCard(){
  var t=(A.data&&A.data.terms)||{},c=(A.data&&A.data.contract)||{state:'none'};
  var has=Object.keys(t).filter(function(k){return k!=='updated_at'&&k!=='updated_by'&&t[k]!==''&&t[k]!=null;}).length;
  function row(k,v,full){return '<div'+(full?' class="full"':'')+'><small>'+esc(k)+'</small><b>'+(v?esc(v):'<span class="ag-none">Not set</span>')+'</b></div>';}
  var badge=c.state==='active'?'<span class="ag-pill ok">Contract active</span>':c.state==='renew'?'<span class="ag-pill warn">Renews in '+c.days_left+' days</span>':c.state==='ended'?'<span class="ag-pill bad">Contract ended</span>':'';
  var split=(t.commission_pct!=null||t.agency_share_pct!=null)?[t.commission_pct!=null?'Maison de Veux '+t.commission_pct+'%':'',t.agency_share_pct!=null?'Your agency '+t.agency_share_pct+'%':''].filter(Boolean).join(' · '):'';
  return '<section class="ag-card"><header><div><h3>Terms with Maison de Veux</h3><p>Set by Maison de Veux. To change anything here, contact your Maison de Veux booker.</p></div>'+badge+'</header>'+(has?'<div class="ag-grid">'+row('Split',split)+row('Contract',[t.contract_start&&'from '+t.contract_start,t.contract_end&&'to '+t.contract_end].filter(Boolean).join(' '))+row('Renewal notice',t.renewal_notice_days!=null?t.renewal_notice_days+' days':'')+row('Exclusivity',[EXCL[t.exclusivity],t.exclusivity_note].filter(Boolean).join(' · '))+row('Payment terms',[PAYT[t.payment_terms],t.payment_terms_note].filter(Boolean).join(' · '))+row('Currency',t.currency)+row('Payout contact',[t.payout_contact_name,t.payout_contact_email].filter(Boolean).join(' · '))+row('Invoicing',t.invoicing_notes,true)+'</div>':'<p class="ag-none">Your terms have not been added yet.</p>')+'</section>';
}
function docsCard(){
  var docs=arr(A.data&&A.data.documents);
  var rows=DOCS.map(function(x){
    var list=docs.filter(function(q){return q.type===x[0];}).sort(function(a,b){return String(b.uploaded_at).localeCompare(String(a.uploaded_at));}),have=list[0];
    var left=have&&have.expires_on?daysTo(have.expires_on):null,tone=!have?'miss':(left!=null&&left<0)?'bad':(left!=null&&left<=60)?'warn':'ok';
    var state=!have?'Not uploaded':left==null?'On file':left<0?'Expired '+(-left)+' day'+(left===-1?'':'s')+' ago':left<=60?'Expires in '+left+' day'+(left===1?'':'s'):'Valid until '+new Date(have.expires_on+'T12:00:00').toLocaleDateString([],{month:'short',day:'numeric',year:'numeric'});
    return '<div class="ag-doc '+tone+'"><div class="ag-doc-main"><b>'+esc(x[1])+'</b><p>'+esc(x[2])+'</p>'+(have?'<span class="ag-file">'+esc(have.name)+'</span>':'')+'</div><div class="ag-doc-side"><span class="ag-state">'+esc(state)+'</span><div class="ag-doc-btns">'+(have?'<button type="button" onclick="MDV_MA_AGENCY.open(\''+esc(have.id)+'\')">View</button><button type="button" onclick="MDV_MA_AGENCY.expiry(\''+esc(have.id)+'\')">Expiry</button><button type="button" onclick="MDV_MA_AGENCY.remove(\''+esc(have.id)+'\')">Remove</button>':'')+'<button type="button" class="pri" onclick="MDV_MA_AGENCY.pick(\'doc:'+x[0]+'\')">'+(have?'Replace':'Upload')+'</button></div></div></div>';
  }).join('');
  var other=docs.filter(function(q){return q.type==='other';});
  var otherRows=other.map(function(q){return '<div class="ag-doc ok"><div class="ag-doc-main"><b>'+esc(q.name)+'</b></div><div class="ag-doc-side"><div class="ag-doc-btns"><button type="button" onclick="MDV_MA_AGENCY.open(\''+esc(q.id)+'\')">View</button><button type="button" onclick="MDV_MA_AGENCY.remove(\''+esc(q.id)+'\')">Remove</button></div></div></div>';}).join('');
  return '<section class="ag-card"><header><h3>Agency documents</h3><button type="button" class="ag-link" onclick="MDV_MA_AGENCY.pick(\'doc:other\')">+ Other document</button></header><div class="ag-docs">'+rows+otherRows+'</div><p class="ag-note">PDF, JPG, PNG or WebP, up to 50 MB. Only your agency and Maison de Veux can see these.</p></section>';
}
function fmtD(v){if(!v)return '';var d=new Date(String(v).slice(0,10)+'T12:00:00');return isNaN(d)?'':d.toLocaleDateString([], {month:'short',day:'numeric'});}
function plural(n,w){return n+' '+w+(n===1?'':'s');}
function rchip(tone,text,title){return '<span class="ag-rc '+tone+'"'+(title?' title="'+esc(title)+'"':'')+'>'+esc(text)+'</span>';}
function rcAvail(r){var a=r.availability;if(a.state==='away')return rchip('warn','Away'+(a.now&&a.now.until?' until '+fmtD(a.now.until):''),a.now&&a.now.type);if(a.state==='soon'&&a.next)return rchip('info','Unavailable from '+fmtD(a.next.starts_at));return rchip('ok','Available');}
function rcTravel(r){var t=r.travel.next;if(!t)return rchip('off','No trips');return rchip(t.days!=null&&t.days<=14&&!/^(confirmed|booked|ticketed)$/i.test(t.status)?'warn':'info',(t.destination||'Trip')+' · '+fmtD(t.starts_at),t.status);}
function rcVisa(r){var v=r.visa;if(v.state==='none')return rchip('off','No visa cases');if(v.state==='urgent')return rchip('bad','Visa urgent');if(v.state==='action')return rchip('warn',plural(v.open,'visa case')+' open');return rchip('ok','Visa clear');}
function rcWork(r){var b=r.bookings;return b.in_30_days?rchip('info',plural(b.in_30_days,'booking')+' in 30 days'):rchip('off','Nothing booked');}
function rosterFiltered(){
  var list=arr(A.roster&&A.roster.roster),q=A.rQ.trim().toLowerCase(),f=A.rFilter;
  return list.filter(function(r){
    if(q&&r.name.toLowerCase().indexOf(q)<0)return false;
    if(f==='attention')return r.level!=='ok';
    if(f==='away')return r.availability.state==='away';
    if(f==='travel')return !!(r.travel.next&&r.travel.next.days!=null&&r.travel.next.days<=30);
    if(f==='visa')return r.visa.open>0||r.visa.state==='urgent';
    return true;
  });
}
function rosterDetail(r){
  var t=r.terms||{},bm=arr(boot().models).filter(function(m){return String(m.id)===String(r.model_id);})[0]||{};
  function sec(h,body){return '<div class="ag-rd-sec"><h6>'+esc(h)+'</h6>'+body+'</div>';}
  var gaps=[];var mk=bm.measurement?measLine(bm.measurement):{missing:[]};if(mk.missing.length)gaps.push('Missing measurements: '+mk.missing.join(', '));
  var out=arr(r.outstanding).concat(gaps.map(function(g){return {tone:'info',text:g};}));
  var outH=out.length?'<ul class="ag-rd-out">'+out.map(function(o){return '<li class="'+o.tone+'"><i></i>'+esc(o.text)+'</li>';}).join('')+'</ul>':'<p class="ag-sub">Nothing outstanding.</p>';
  var av=arr(r.availability.upcoming).length?'<ul class="ag-rd-l">'+r.availability.upcoming.map(function(b){return '<li><b>'+esc(String(b.type).replace(/_/g,' '))+'</b> '+esc(fmtD(b.starts_at)+(b.ends_at&&b.ends_at!==b.starts_at?' to '+fmtD(b.ends_at):''))+(b.status==='pending'?' <em>pending</em>':'')+'</li>';}).join('')+'</ul>':'<p class="ag-sub">No time off or blocks coming up.</p>';
  var tr=r.travel.next?'<p><b>'+esc(r.travel.next.destination||'Trip')+'</b> '+esc(fmtD(r.travel.next.starts_at)+(r.travel.next.ends_at?' to '+fmtD(r.travel.next.ends_at):''))+' · '+esc(r.travel.next.status||'planned')+(r.travel.count>1?'<br><span class="ag-sub">+ '+(r.travel.count-1)+' more</span>':'')+'</p>':'<p class="ag-sub">No trips planned.</p>';
  var vz=arr(r.visa.cases).length?'<ul class="ag-rd-l">'+r.visa.cases.map(function(c){return '<li><b>'+esc((c.country||'')+' '+(c.type||'visa'))+'</b> '+esc(String(c.status||'').replace(/_/g,' '))+(c.deadline?' · due '+esc(fmtD(c.deadline)):'')+'</li>';}).join('')+'</ul>':'<p class="ag-sub">No visa cases.</p>';
  var wk='<p>'+(r.bookings.next?'Next: <b>'+esc(r.bookings.next.title)+'</b> '+esc(fmtD(r.bookings.next.starts_at)):'Nothing booked ahead')+'</p>'+(r.bookings.last?'<p class="ag-sub">Last job: '+esc(r.bookings.last.title)+', '+esc(fmtD(r.bookings.last.starts_at))+'</p>':'')+(r.castings.upcoming?'<p class="ag-sub">'+plural(r.castings.upcoming,'casting')+' coming up</p>':'');
  var up=arr(r.updates).length?'<ul class="ag-rd-l">'+r.updates.map(function(u){return '<li><b>'+esc(u.type)+'</b> '+esc(fmtD(u.at))+'<br>'+esc(u.note)+'</li>';}).join('')+'</ul>':'<p class="ag-sub">You have not sent an update for this model.</p>';
  var excl={none:'Not exclusive',market:'Exclusive in some markets',full:'Fully exclusive'},cs=t.contract_state;
  var badge=cs==='active'?'<span class="ag-pill ok">Contract active</span>':cs==='renew'?'<span class="ag-pill warn">Ends in '+t.contract_days_left+' days</span>':cs==='ended'?'<span class="ag-pill bad">Contract ended</span>':'';
  var terms=(badge?'<p>'+badge+'</p>':'')+'<div class="ag-grid">'+[['Contract',[t.contract_start&&'from '+fmtD(t.contract_start),t.contract_end&&'to '+fmtD(t.contract_end)].filter(Boolean).join(' ')],['Commission',t.commission_override_pct!=null?t.commission_override_pct+'%':''],['Exclusivity',excl[t.exclusivity]||''],['With you since',fmtD(r.placement.since)]].map(function(x){return '<div><small>'+esc(x[0])+'</small><b>'+(x[1]?esc(x[1]):'<span class="ag-none">Not set</span>')+'</b></div>';}).join('')+'</div>'+(t.notes?'<p class="ag-sub">'+esc(t.notes)+'</p>':'');
  return '<div class="ag-rd"><div class="ag-rd-grid">'+sec('Outstanding',outH)+sec('Availability',av)+sec('Travel',tr)+sec('Visa',vz+(r.work_auth?'<p class="ag-sub">Work authorisation expires '+esc(fmtD(r.work_auth.expires_on))+'</p>':''))+sec('Work',wk)+sec('Your updates',up)+sec('Placement and terms',terms)+'</div><div class="ag-formact"><button type="button" class="v15p-btn" onclick="VEUX_PARTNER_V15.openModel(\''+esc(r.model_id)+'\')">Open profile</button>'+(r.placement.id?'<button type="button" class="v15p-btn gold" onclick="MDV_MA_AGENCY.report(\''+esc(r.placement.id)+'\')">Send an update</button>':'')+'</div></div>';
}
function rosterRow(r){
  var open=A.rOpen===r.model_id,n=arr(r.outstanding).filter(function(o){return o.tone!=='info';}).length;
  return '<article class="ag-rr '+r.level+(open?' open':'')+'"><button type="button" class="ag-rr-h" onclick="MDV_MA_AGENCY.rosterOpen(\''+esc(r.model_id)+'\')" aria-expanded="'+open+'"><span class="ag-mph">'+(r.photo?'<img loading="lazy" src="'+esc(r.photo)+'" alt="">':'<span>'+esc(initials(r.name))+'</span>')+'</span><span class="ag-rr-name"><b>'+esc(r.name)+'</b><small>'+esc([arr(r.placement.markets).join(', '),r.placement.status].filter(Boolean).join(' · ')||'Placed')+'</small></span><span class="ag-rr-chips">'+rcAvail(r)+rcTravel(r)+rcVisa(r)+rcWork(r)+'</span>'+(n?'<span class="ag-rr-n '+r.level+'" title="Needs attention">'+n+'</span>':'<span class="ag-rr-n ok" title="All clear">✓</span>')+'</button>'+(open?rosterDetail(r):'')+'</article>';
}
function modelsCard(){
  var R=A.roster;
  if(!R){return A.rosterLoading?'<section class="ag-card" id="ag-models"><header><div><h3>Models you represent</h3><p>Loading availability, travel, visa and bookings…</p></div></header></section>':modelsCardBasic();}
  var s=R.summary||{},list=rosterFiltered();
  var kp=[['Need attention',s.needs_attention,s.urgent?'bad':s.needs_attention?'warn':''],['Away now',s.away_now,''],['Traveling in 30 days',s.traveling_soon,''],['Visa open',s.visa_open,s.visa_open?'warn':''],['Bookings in 30 days',s.upcoming_bookings,'']].map(function(x){return '<div class="ag-rk '+x[2]+'"><b>'+(x[1]||0)+'</b><small>'+esc(x[0])+'</small></div>';}).join('');
  var chips=[['all','All'],['attention','Needs attention'],['away','Away'],['travel','Traveling'],['visa','Visa']].map(function(c){return '<button type="button" class="ag-chip'+(A.rFilter===c[0]?' on':'')+'" onclick="MDV_MA_AGENCY.rosterFilter(\''+c[0]+'\')">'+c[1]+'</button>';}).join('');
  var warns=arr(R.warnings).length?'<p class="ag-sub">Some information could not load right now.</p>':'';
  return '<section class="ag-card" id="ag-models"><header><div><h3>Models you represent</h3><p>Where each model is: availability, travel, visa and what is booked. Spot something wrong? Send an update from the model.</p></div><span class="ag-count">'+arr(R.roster).length+'</span></header>'
   +(arr(R.roster).length?'<div class="ag-rks">'+kp+'</div><div class="ag-rtools"><div class="ag-chips">'+chips+'</div><input class="ag-rsearch" id="ag-rq" type="search" placeholder="Search models" value="'+esc(A.rQ)+'" oninput="MDV_MA_AGENCY.rosterSearch(this.value)"></div>'+warns+(list.length?'<div class="ag-rr-list">'+list.map(rosterRow).join('')+'</div>':'<div class="ag-empty">No models match.</div>'):'<div class="ag-empty">No models are placed with your agency yet.</div>')+'</section>';
}
function loadRoster(){
  if(A.rosterLoading)return;A.rosterLoading=true;A.rosterErr='';
  return api('/api/partner/roster?organization=maison-de-veux').then(function(r){A.roster=r;}).catch(function(e){A.rosterErr=(e&&e.message)||'';A.roster=null;}).then(function(){A.rosterLoading=false;paint();});
}

/* ---- activity and earnings ---- */
function amoney(n,c){try{return new Intl.NumberFormat('en-US',{style:'currency',currency:c||'USD',maximumFractionDigits:0}).format(Number(n)||0);}catch(e){return (c||'')+' '+Math.round(Number(n)||0);}}
function monthLbl(m){var d=new Date(m+'-15T12:00:00');return isNaN(d)?m:d.toLocaleDateString([], {month:'short'});}
var KIND_ICON={placement:'◍',update:'✎',booking:'▤',approval:'✓',statement:'≡',payment:'$',document:'▣'};
function activityCard(){
  var a=A.act;
  var head='<header><div><h3>Activity and earnings</h3><p>What your models have worked on, what your agency earns, what has been paid, and what has passed between you and Maison de Veux.</p></div><div class="ag-chips">'+[[30,'30 days'],[90,'90 days'],[365,'1 year'],[0,'All']].map(function(p){return '<button type="button" class="ag-chip'+(A.aDays===p[0]?' on':'')+'" onclick="MDV_MA_AGENCY.actDays('+p[0]+')">'+p[1]+'</button>';}).join('')+'</div></header>';
  if(!a)return '<section class="ag-card" id="ag-activity">'+head+'<p class="ag-sub">'+(A.actLoading?'Loading…':'The activity could not be loaded right now.')+'</p></section>';
  var k=a.kpis,cur=a.main_currency;
  var tiles=[['Jobs worked',k.bookings,k.upcoming?k.upcoming+' coming up':''],['Gross billed',amoney(k.gross,cur),''],['Your commission',amoney(k.commission,cur),a.money.length>1?'plus '+a.money.slice(1).map(function(m){return amoney(m.commission,m.currency);}).join(', '):''],['Paid so far',amoney(k.paid,k.paid_currency||cur),''],['Castings',k.castings,k.booking_rate!=null?k.booking_rate+'% booked':''],['Waiting on models',k.waiting_on_models,k.no_rate?k.no_rate+' without a rate':'']].map(function(x){return '<div class="ag-rk"><b>'+esc(String(x[1]))+'</b><small>'+esc(x[0])+'</small>'+(x[2]?'<em>'+esc(x[2])+'</em>':'')+'</div>';}).join('');
  var maxC=Math.max.apply(null,a.monthly.map(function(m){return m.commission;}).concat([1]));
  var chart='<div class="ag-bars" role="img" aria-label="Commission by month">'+a.monthly.map(function(m){return '<div class="ag-bar" title="'+esc(monthLbl(m.month)+': '+amoney(m.commission,cur)+' · '+m.bookings+' job'+(m.bookings===1?'':'s'))+'"><i style="height:'+Math.max(m.commission?4:1,Math.round(m.commission/maxC*100))+'%"></i><small>'+esc(monthLbl(m.month))+'</small></div>';}).join('')+'</div>';
  var tot=a.commission_by_state.reduce(function(n,s){return n+s.amount;},0);
  var states=tot?'<div class="ag-stack">'+a.commission_by_state.filter(function(s){return s.amount>0;}).map(function(s){return '<i class="s-'+s.key+'" style="flex:'+s.amount+'" title="'+esc(s.label+': '+amoney(s.amount,cur))+'"></i>';}).join('')+'</div><div class="ag-legend">'+a.commission_by_state.map(function(s){return '<span class="s-'+s.key+'"><i></i>'+esc(s.label)+' <b>'+esc(amoney(s.amount,cur))+'</b></span>';}).join('')+'</div>':'<p class="ag-sub">No commission on worked jobs in this period.</p>';
  var bm=a.by_model.length?'<table class="ag-tbl"><thead><tr><th>Model</th><th>Jobs</th><th>Gross</th><th>Commission</th><th>Castings</th><th>Last job</th></tr></thead><tbody>'+a.by_model.map(function(m){return '<tr><td><b>'+esc(m.name)+'</b>'+(m.current?'':' <em class="ag-badge">Past</em>')+(m.no_rate?' <em class="ag-badge warn">'+m.no_rate+' no rate</em>':'')+'</td><td>'+m.bookings+(m.upcoming?' <small>+'+m.upcoming+'</small>':'')+'</td><td>'+esc(amoney(m.gross,cur))+'</td><td><b>'+esc(amoney(m.commission,cur))+'</b></td><td>'+m.castings+(m.castings?' <small>'+m.castings_booked+' booked</small>':'')+'</td><td>'+esc(fmtD(m.last_booking)||'—')+'</td></tr>';}).join('')+'</tbody></table>':'<p class="ag-sub">No models yet.</p>';
  var rb=arr(a.recent_bookings).length?'<ul class="ag-rd-l">'+a.recent_bookings.map(function(b){return '<li><b>'+esc(b.title)+'</b> '+esc(b.model)+' · '+esc(fmtD(b.starts_at))+' · '+(b.has_rate?esc(amoney(b.commission,b.currency))+' commission':'no rate yet')+'</li>';}).join('')+'</ul>':'<p class="ag-sub">Nothing worked in this period.</p>';
  var st=arr(a.statements).length?'<ul class="ag-rd-l">'+a.statements.map(function(x){return '<li><b>'+esc(fmtD(x.period_start)+' to '+fmtD(x.period_end))+'</b> '+esc(x.status)+(x.closing_balance!=null?' · '+esc(amoney(x.closing_balance,x.currency)):'')+'</li>';}).join('')+'</ul>':'<p class="ag-sub">No statements issued yet.</p>';
  var tl=arr(a.timeline),shown=tl.slice(0,A.aTl);
  var tlh=tl.length?'<ol class="ag-tl">'+shown.map(function(t){return '<li class="'+t.tone+'"><span class="ag-tl-i">'+(KIND_ICON[t.kind]||'•')+'</span><div><b>'+esc(t.title)+'</b>'+(t.detail?'<small>'+esc(t.detail)+'</small>':'')+'</div><time>'+esc(fmtD(t.at))+'</time></li>';}).join('')+'</ol>'+(tl.length>A.aTl?'<button type="button" class="ag-link" onclick="MDV_MA_AGENCY.actMore()">Show more ('+(tl.length-A.aTl)+')</button>':''):'<p class="ag-sub">Nothing has happened yet.</p>';
  return '<section class="ag-card" id="ag-activity">'+head+'<div class="ag-rks">'+tiles+'</div><h4 class="ag-h4">Commission by month</h4>'+chart+'<h4 class="ag-h4">Where your commission stands</h4>'+states+'<h4 class="ag-h4">By model</h4><div class="ag-tblwrap">'+bm+'</div><div class="ag-rd-grid"><div class="ag-rd-sec"><h6>Recent jobs</h6>'+rb+'</div><div class="ag-rd-sec"><h6>Statements</h6>'+st+'</div></div><h4 class="ag-h4">Timeline</h4>'+tlh+'</section>';
}
function loadActivity(){
  A.actLoading=true;
  return api('/api/partner/activity?organization=maison-de-veux&days='+A.aDays).then(function(r){A.act=r.activity;}).catch(function(){A.act=null;}).then(function(){A.actLoading=false;paint();});
}
function modelsCardBasic(){
  var ms=arr(boot().models);
  var cards=ms.map(function(m){
    var p=placementFor(m.id),ph=photoOf(m),mk=measLine(m.measurement),market=marketOf(m);
    var flags=[!ph&&'No photo',mk.missing.length&&('Missing '+mk.missing.join(', '))].filter(Boolean);
    return '<article class="ag-model"><div class="ag-mph" onclick="VEUX_PARTNER_V15.openModel(\''+esc(m.id)+'\')">'+(ph?'<img loading="lazy" src="'+esc(ph)+'" alt="">':'<span>'+esc(initials(m.display_name))+'</span>')+'</div><div class="ag-mbody"><h4 onclick="VEUX_PARTNER_V15.openModel(\''+esc(m.id)+'\')">'+esc(m.display_name||'Model')+'</h4><p>'+esc([market,p.placement_type||p.status].filter(Boolean).join(' · ')||'Not yet placed')+'</p>'+(mk.text?'<div class="ag-mm">'+esc(mk.text)+'</div>':'')+(flags.length?'<div class="ag-flags">'+flags.map(function(x){return '<span>'+esc(x)+'</span>';}).join('')+'</div>':'')+'<button type="button" class="ag-fix" onclick="MDV_MA_AGENCY.report(\''+esc(p.id||'')+'\')">Report a correction</button></div></article>';
  }).join('');
  return '<section class="ag-card" id="ag-models"><header><div><h3>Models you represent</h3><p>These come from your placements with Maison de Veux. Spot something wrong? Report it and the team will update it.</p></div><span class="ag-count">'+ms.length+'</span></header>'+(ms.length?'<div class="ag-models">'+cards+'</div>':'<div class="ag-empty">No models are placed with your agency yet.</div>')+'</section>';
}
function paint(el){
  el=el||document.getElementById('p-agency');if(!el)return;
  if(A.loading&&!A.data){el.innerHTML='<div class="v15p-page ag-page"><div class="ag-empty">Loading your agency profile…</div></div>';return;}
  if(A.error&&!A.data){el.innerHTML='<div class="v15p-page ag-page"><div class="ag-empty">'+esc(A.error)+'</div><p style="text-align:center"><button class="v15p-btn" onclick="MDV_MA_AGENCY.reload()">Try again</button></p></div>';return;}
  var an=analyse();
  el.innerHTML='<div class="v15p-page ag-page"><input type="file" id="ag-file" hidden accept=".pdf,.jpg,.jpeg,.png,.webp,image/*,application/pdf" onchange="MDV_MA_AGENCY.picked(this)">'+identity(an)+summary(an)+'<div class="ag-cols"><div>'+(A.edit?detailsEdit():detailsView())+teamCard()+termsCard()+'</div><div>'+docsCard()+activityCard()+modelsCard()+'</div></div></div>';
}

/* ---------- data and actions ---------- */
function load(force){
  if(A.loading)return;
  if(A.data&&!force){paint();return;}
  A.loading=true;A.error=null;paint();
  loadRoster();loadActivity();
  return api('/api/partner/agency-profile?organization=maison-de-veux').then(function(d){A.data=d;}).catch(function(e){A.error=(e&&e.message)||'Could not load your agency profile.';}).then(function(){A.loading=false;paint();});
}
function apply(d){A.data=d;A.busy='';paint();}
var pending=null;
function pick(what){pending=what;var f=document.getElementById('ag-file');if(!f)return;f.value='';f.accept=what==='logo'?'.jpg,.jpeg,.png,.webp,image/*':'.pdf,.jpg,.jpeg,.png,.webp,image/*,application/pdf';f.click();}
async function picked(input){
  var file=input.files&&input.files[0];if(!file||!pending)return;
  var type=pending==='logo'?'logo':pending.split(':')[1]||'other',expires='';
  if(type==='contract'||type==='licence'||type==='id'){var ef=await MDV_DIALOG.form({title:'Does this document expire?',message:'Add the expiry date so we can remind you to renew it. Leave it empty if it does not expire.',fields:[{k:'expires',label:'Expiry date',type:'date'}],confirm:'Upload'});if(!ef){pending=null;return;}expires=ef.expires||'';}
  try{
    toast('Uploading…');
    var prep=await api('/api/partner/agency-profile',{action:'upload_url',type:type,name:file.name,mime_type:file.type||'application/octet-stream',size_bytes:file.size});
    var client=window.VEUX_SUPABASE_CLIENT;if(!client||!client.storage)throw new Error('Secure storage connection is not ready');
    var up=await client.storage.from(prep.bucket).uploadToSignedUrl(prep.path,prep.token,file,{contentType:file.type||undefined});if(up.error)throw up.error;
    apply(await api('/api/partner/agency-profile',{action:'finalize',type:type,path:prep.path,name:file.name,mime_type:file.type,size_bytes:file.size,expires_on:expires}));
    toast(type==='logo'?'Logo updated':'Document uploaded');
  }catch(e){toast('Upload failed: '+((e&&e.message)||e));}
  pending=null;
}
function personFromForm(){
  var g=function(id){var el=document.getElementById(id);return el?el.value.trim():'';};
  return {name:g('ag-t-name'),role:g('ag-t-role'),email:g('ag-t-email'),phone:g('ag-t-phone'),whatsapp:g('ag-t-whatsapp'),primary:!!(document.getElementById('ag-t-primary')||{}).checked,topics:Array.prototype.map.call(document.querySelectorAll('.ag-t-topic:checked'),function(x){return x.value;})};
}
async function saveTeam(list,msg){
  try{var d=await api('/api/partner/agency-profile',{action:'save_team',team:list});A.teamEdit=null;apply(d);toast(msg);}
  catch(e){toast((e&&e.message)||'Could not save the team');}
}
function teamSave(){
  var team=arr(A.data&&A.data.team).map(function(m){return Object.assign({},m);}),p=personFromForm(),e=A.teamEdit;
  if(!p.name){toast('Add the person’s name.');return;}
  if(e==='new')team.push(p);else{p.id=team[e].id;team[e]=p;}
  if(p.primary)team.forEach(function(m){if(m!==p)m.primary=false;});
  return saveTeam(team,e==='new'?'Person added':'Person saved');
}
async function teamRemove(i){
  var team=arr(A.data&&A.data.team).slice(),m=team[i];if(!m)return;
  if(!(await MDV_DIALOG.confirm({title:'Remove '+m.name+'?',message:'They are taken off your team list.',confirm:'Remove',danger:true})))return;
  team.splice(i,1);return saveTeam(team,'Person removed');
}
async function save(){
  var profile={};FIELDS.forEach(function(x){var el=document.getElementById('ag-f-'+x[0]);if(el)profile[x[0]]=el.value;});
  var b=document.getElementById('ag-save');if(b){b.disabled=true;b.textContent='Saving…';}
  try{A.edit=false;apply(await api('/api/partner/agency-profile',{action:'save',profile:profile}));toast('Profile saved');}
  catch(e){A.edit=true;paint();toast((e&&e.message)||'Could not save');}
}
async function open(id){try{var r=await api('/api/partner/agency-profile',{action:'download_url',document_id:id});if(r&&r.url)window.open(r.url,'_blank','noopener');}catch(e){toast((e&&e.message)||'Could not open the file');}}
async function remove(id){if(!(await MDV_DIALOG.confirm({title:'Remove this document?',message:'It will be deleted from your agency profile.',confirm:'Remove',danger:true})))return;try{apply(await api('/api/partner/agency-profile',{action:'remove_document',document_id:id}));toast('Document removed');}catch(e){toast((e&&e.message)||'Could not remove');}}
async function expiry(id){var f=await MDV_DIALOG.form({title:'Expiry date',message:'Leave it empty if this document does not expire.',fields:[{k:'expires',label:'Expiry date',type:'date'}],confirm:'Save'});if(!f)return;try{apply(await api('/api/partner/agency-profile',{action:'set_expiry',document_id:id,expires_on:f.expires||''}));toast('Expiry updated');}catch(e){toast((e&&e.message)||'Could not update');}}
function act(fn){
  if(fn==='edit'){A.edit=true;paint();var t=document.querySelector('.ag-form input,.ag-form textarea');if(t)t.scrollIntoView({block:'center',behavior:'smooth'});}
  else if(fn==='logo')pick('logo');
  else if(fn.indexOf('doc:')===0)pick(fn);
  else if(fn==='team'){var t=document.getElementById('ag-team');if(t)t.scrollIntoView({behavior:'smooth',block:'start'});A.teamEdit='new';paint();}
  else if(fn==='models'){var m=document.getElementById('ag-models');if(m)m.scrollIntoView({behavior:'smooth',block:'start'});}
}
function report(placementId){if(window.VEUX_PARTNER_V15&&VEUX_PARTNER_V15.placementUpdate)return VEUX_PARTNER_V15.placementUpdate(placementId);}

window.MDV_MA_AGENCY={actDays:function(n){A.aDays=n;loadActivity();},actMore:function(){A.aTl+=20;paint();},rosterOpen:function(id){A.rOpen=A.rOpen===id?null:id;paint();},rosterFilter:function(f){A.rFilter=f;paint();},rosterSearch:function(v){A.rQ=v;var el=document.querySelector('.ag-rr-list'),l=rosterFiltered();if(el)el.innerHTML=l.length?l.map(rosterRow).join(''):'<div class="ag-empty">No models match.</div>';},teamAdd:function(){A.teamEdit='new';paint();var t=document.getElementById('ag-team');if(t)t.scrollIntoView({behavior:'smooth',block:'start'});},teamEdit:function(i){A.teamEdit=i;paint();},teamCancel:function(){A.teamEdit=null;paint();},teamSave:teamSave,teamRemove:teamRemove,render:function(el){paint(el);load(false);},reload:function(){return load(true);},edit:function(on){A.edit=!!on;paint();},save:save,pick:pick,picked:picked,open:open,remove:remove,expiry:expiry,act:act,report:report,analyse:analyse};
})();
