/* Mother Agency portal: "My Agency" — the agency's own profile (details, logo, documents) beside the models it represents,
   with a plain-rule summary of what is complete, what is missing and what is about to expire. */
(function(){
'use strict';
if(window.MDV_MA_AGENCY)return;

var A={data:null,loading:false,error:null,edit:false,busy:'',tab:'profile'};
var DOCS=[['contract','Agency agreement','The signed agreement between your agency and Maison de Veux.'],['licence','Business licence','Your licence or registration to operate as a model agency.'],['id','Representative ID','Passport or ID of the person who signs for your agency.']];
var FIELDS=[['tagline','Tagline','text','One line that sums up your agency'],['bio','About the agency','area','Who you are, who you represent and what you are known for'],['city','City','text',''],['country','Country','text',''],['founded_year','Founded','text','2012'],['website','Website','text','www.youragency.com'],['instagram','Instagram','text','@youragency'],['contact_name','Contact person','text',''],['contact_role','Their role','text','Head booker, director…'],['contact_email','Contact email','text',''],['contact_phone','Contact phone','text',''],['whatsapp','WhatsApp','text','']];

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
function detailsView(){
  var f=(A.data&&A.data.profile)||{};
  function row(k,v,href){return '<div><small>'+esc(k)+'</small><b>'+(v?(href?'<a href="'+esc(href)+'">'+esc(v)+'</a>':esc(v)):'<span class="ag-none">Not added</span>')+'</b></div>';}
  return '<section class="ag-card"><header><h3>Agency details</h3><button type="button" class="ag-link" onclick="MDV_MA_AGENCY.edit(true)">Edit</button></header>'
   +'<div class="ag-about">'+(f.bio?'<p>'+esc(f.bio).replace(/\n/g,'<br>')+'</p>':'<p class="ag-none">Tell Maison de Veux about your agency.</p>')+'</div>'
   +'<div class="ag-grid">'+row('Location',[f.city,f.country].filter(Boolean).join(', '))+row('Founded',f.founded_year)+row('Website',f.website,f.website)+row('Instagram',f.instagram&&'@'+String(f.instagram).replace(/^@/,''),f.instagram&&'https://instagram.com/'+String(f.instagram).replace(/^@/,''))+row('Contact person',[f.contact_name,f.contact_role].filter(Boolean).join(' · '))+row('Email',f.contact_email,f.contact_email&&'mailto:'+f.contact_email)+row('Phone',f.contact_phone,f.contact_phone&&'tel:'+f.contact_phone)+row('WhatsApp',f.whatsapp)+'</div></section>';
}
function detailsEdit(){
  var f=(A.data&&A.data.profile)||{};
  var inputs=FIELDS.map(function(x){var v=esc(f[x[0]]||'');return '<label class="'+(x[2]==='area'||x[0]==='tagline'?'full':'')+'"><span>'+esc(x[1])+'</span>'+(x[2]==='area'?'<textarea id="ag-f-'+x[0]+'" rows="5" maxlength="1800" placeholder="'+esc(x[3])+'">'+v+'</textarea>':'<input id="ag-f-'+x[0]+'" value="'+v+'" placeholder="'+esc(x[3])+'">')+'</label>';}).join('');
  return '<section class="ag-card"><header><h3>Edit agency details</h3></header><div class="ag-form">'+inputs+'</div><div class="ag-formact"><button class="v15p-btn" onclick="MDV_MA_AGENCY.edit(false)">Cancel</button><button class="v15p-btn gold" id="ag-save" onclick="MDV_MA_AGENCY.save()">Save profile</button></div></section>';
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
function modelsCard(){
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
  el.innerHTML='<div class="v15p-page ag-page"><input type="file" id="ag-file" hidden accept=".pdf,.jpg,.jpeg,.png,.webp,image/*,application/pdf" onchange="MDV_MA_AGENCY.picked(this)">'+identity(an)+summary(an)+'<div class="ag-cols"><div>'+(A.edit?detailsEdit():detailsView())+docsCard()+'</div><div>'+modelsCard()+'</div></div></div>';
}

/* ---------- data and actions ---------- */
function load(force){
  if(A.loading)return;
  if(A.data&&!force){paint();return;}
  A.loading=true;A.error=null;paint();
  return api('/api/partner/agency-profile?organization=maison-de-veux').then(function(d){A.data=d;}).catch(function(e){A.error=(e&&e.message)||'Could not load your agency profile.';}).then(function(){A.loading=false;paint();});
}
function apply(d){A.data=d;A.busy='';paint();}
var pending=null;
function pick(what){pending=what;var f=document.getElementById('ag-file');if(!f)return;f.value='';f.accept=what==='logo'?'.jpg,.jpeg,.png,.webp,image/*':'.pdf,.jpg,.jpeg,.png,.webp,image/*,application/pdf';f.click();}
async function picked(input){
  var file=input.files&&input.files[0];if(!file||!pending)return;
  var type=pending==='logo'?'logo':pending.split(':')[1]||'other',expires='';
  if(type==='contract'||type==='licence'||type==='id'){expires=(prompt('Does this document have an expiry date? Enter it as YYYY-MM-DD, or leave blank if it does not expire.')||'').trim();if(expires&&!/^\d{4}-\d{2}-\d{2}$/.test(expires)){toast('That date was not in the format YYYY-MM-DD');return;}}
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
async function save(){
  var profile={};FIELDS.forEach(function(x){var el=document.getElementById('ag-f-'+x[0]);if(el)profile[x[0]]=el.value;});
  var b=document.getElementById('ag-save');if(b){b.disabled=true;b.textContent='Saving…';}
  try{A.edit=false;apply(await api('/api/partner/agency-profile',{action:'save',profile:profile}));toast('Profile saved');}
  catch(e){A.edit=true;paint();toast((e&&e.message)||'Could not save');}
}
async function open(id){try{var r=await api('/api/partner/agency-profile',{action:'download_url',document_id:id});if(r&&r.url)window.open(r.url,'_blank','noopener');}catch(e){toast((e&&e.message)||'Could not open the file');}}
async function remove(id){if(!confirm('Remove this document?'))return;try{apply(await api('/api/partner/agency-profile',{action:'remove_document',document_id:id}));toast('Document removed');}catch(e){toast((e&&e.message)||'Could not remove');}}
async function expiry(id){var v=prompt('Expiry date as YYYY-MM-DD (leave blank for none)');if(v==null)return;v=v.trim();if(v&&!/^\d{4}-\d{2}-\d{2}$/.test(v)){toast('Use the format YYYY-MM-DD');return;}try{apply(await api('/api/partner/agency-profile',{action:'set_expiry',document_id:id,expires_on:v}));toast('Expiry updated');}catch(e){toast((e&&e.message)||'Could not update');}}
function act(fn){
  if(fn==='edit'){A.edit=true;paint();var t=document.querySelector('.ag-form input,.ag-form textarea');if(t)t.scrollIntoView({block:'center',behavior:'smooth'});}
  else if(fn==='logo')pick('logo');
  else if(fn.indexOf('doc:')===0)pick(fn);
  else if(fn==='models'){var m=document.getElementById('ag-models');if(m)m.scrollIntoView({behavior:'smooth',block:'start'});}
}
function report(placementId){if(window.VEUX_PARTNER_V15&&VEUX_PARTNER_V15.placementUpdate)return VEUX_PARTNER_V15.placementUpdate(placementId);}

window.MDV_MA_AGENCY={render:function(el){paint(el);load(false);},reload:function(){return load(true);},edit:function(on){A.edit=!!on;paint();},save:save,pick:pick,picked:picked,open:open,remove:remove,expiry:expiry,act:act,report:report,analyse:analyse};
})();
