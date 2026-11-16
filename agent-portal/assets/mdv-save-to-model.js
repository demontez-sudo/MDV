/* Save files from an email (or from your computer) to a model's profile.
   Open with MDV_SAVE.open({files:[File…], context:{from,subject,text}}) or MDV_SAVE.pick().
   Photos go to the model's media with a category; PDFs, Word and text files go to the model's documents.
   The same uploaders the Model 360 uses do the saving, so the files behave like any other upload. */
(function(){
'use strict';
if(window.MDV_SAVE)return;

var VIDEO_CATS=['Motion','Runway','Commercial','Test','Other'];
var PHOTO_CATS=['Portfolio','Digital','Polaroid','Headshot','Editorial','Runway','Commercial','Test','Other'];
var DOC_CATS=[['general','Document'],['contract','Contract / agreement'],['identity','Passport / ID'],['visa','Visa / work permit'],['call-sheet','Call sheet'],['comp-card','Comp card'],['other','Other']];
var VID=/^video\/(mp4|quicktime|webm)$/i,IMG=/^image\/(jpeg|png|webp|gif)$/i,DOCM=/^(application\/pdf|application\/msword|application\/vnd\.openxmlformats-officedocument\.wordprocessingml\.document|text\/plain)$/i;
var EXT={jpg:'image/jpeg',jpeg:'image/jpeg',png:'image/png',webp:'image/webp',gif:'image/gif',mp4:'video/mp4',mov:'video/quicktime',m4v:'video/mp4',webm:'video/webm',pdf:'application/pdf',doc:'application/msword',docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',txt:'text/plain'};
var MAX_DOC=50*1048576,MAX_IMG=150*1048576;

var D=null;      /* the open dialog's state */
var SCOUTS={list:null,at:0,loading:null};
var MODELS={list:null,at:0,loading:null};
var uid=0;

function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
function arr(v){return Array.isArray(v)?v:[];}
function bridge(){if(!window.VEUX_AGENT_V4||!VEUX_AGENT_V4.api)throw new Error('The secure connection is not ready yet. Try again in a moment.');return window.VEUX_AGENT_V4;}
function org(){var s=bridge().state||{};return (s.org&&s.org.slug)||'maison-de-veux';}
function orgId(){var s=bridge().state||{};return s.org&&s.org.id;}
function post(path,body){return bridge().api(path,{method:'POST',body:JSON.stringify(Object.assign({organization_slug:org()},body||{}))});}
function norm(s){return String(s||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9]+/g,' ').trim();}
function toast(m){try{if(window.toast)return window.toast(m);}catch(e){}}
function size(n){n=Number(n)||0;return n>=1048576?(n/1048576).toFixed(1)+' MB':Math.max(1,Math.round(n/1024))+' KB';}
function mimeOf(f){var m=String(f.type||'').toLowerCase();if(m&&m!=='application/octet-stream')return m;var e=String(f.name||'').split('.').pop().toLowerCase();return EXT[e]||m||'application/octet-stream';}

/* ---------- guessing: what is this file, and which model is it about ---------- */
function guessPhoto(n){n=norm(n);if(/polaroid|polas|snap/.test(n))return 'Polaroid';if(/digital|digi\b|dig\b/.test(n))return 'Digital';if(/head ?shot|\bhs\b/.test(n))return 'Headshot';if(/runway|walk/.test(n))return 'Runway';if(/editorial|\bed\b/.test(n))return 'Editorial';return 'Portfolio';}
function guessDoc(n){n=norm(n);if(/contract|agreement|terms/.test(n))return 'contract';if(/passport|\bid\b|license|licence/.test(n))return 'identity';if(/visa|permit/.test(n))return 'visa';if(/call ?sheet/.test(n))return 'call-sheet';if(/comp ?card|zed/.test(n))return 'comp-card';return 'general';}
function makeItem(file,extra){
  var mime=mimeOf(file),it=Object.assign({id:++uid,file:file,name:file.name||'file',size:file.size||0,mime:mime,status:'ready',error:'',thumb:'',staging:null},extra||{});
  it.kind=IMG.test(mime)?'photo':VID.test(mime)?'video':DOCM.test(mime)?'doc':'other';
  it.as=(it.kind==='photo'||it.kind==='video')?'photo':'doc';
  it.cat=it.kind==='photo'?guessPhoto(it.name):it.kind==='video'?(/runway|walk/.test(norm(it.name))?'Runway':'Motion'):guessDoc(it.name);
  if(it.kind==='photo'){try{it.thumb=URL.createObjectURL(file);}catch(e){}}
  if(it.kind==='other')it.error='This file type cannot be saved to a profile. Use photos (JPG, PNG, WEBP, GIF), videos (MP4, MOV, WEBM), PDF, Word or text.';
  else if(it.kind==='doc'&&it.size>MAX_DOC)it.error='Over the 50 MB limit.';
  else if((it.kind==='photo'||it.kind==='video')&&it.size>MAX_IMG)it.error='Over the 150 MB limit.';
  return it;
}
function suggest(){
  var ctx=D.ctx||{},hay=' '+norm([ctx.subject,ctx.text,ctx.fromName,D.items.map(function(i){return i.name;}).join(' ')].join(' '))+' ',models=arr(MODELS.list),full=[],first={};
  models.forEach(function(m){var n=norm(m.name);if(n.length<5)return;if(hay.indexOf(' '+n+' ')>-1)full.push(m);var f=n.split(' ')[0];if(f.length>=4&&hay.indexOf(' '+f+' ')>-1)(first[f]=first[f]||[]).push(m);});
  var out=full.slice(0,4).map(function(m){return {m:m,why:'full name appears in the email'};});
  Object.keys(first).forEach(function(k){if(first[k].length===1&&!out.some(function(o){return o.m.id===first[k][0].id;}))out.push({m:first[k][0],why:'“'+k+'” appears in the email'});});
  return out.slice(0,4);
}

/* ---------- models ---------- */
function loadModels(){
  if(MODELS.list&&Date.now()-MODELS.at<300000)return Promise.resolve(MODELS.list);
  if(MODELS.loading)return MODELS.loading;
  MODELS.loading=bridge().api('/api/agent/save-to-model?organization='+encodeURIComponent(org()),{method:'GET',headers:{}}).then(function(r){MODELS.list=arr(r&&r.models);MODELS.at=Date.now();return MODELS.list;}).catch(function(e){D&&(D.modelErr=(e&&e.message)||'Could not load the roster.');return MODELS.list||[];}).then(function(l){MODELS.loading=null;return l;});
  return MODELS.loading;
}
function isPast(m){return /^(archiv|releas|inactive|former)/i.test(String(m.status||''));}

/* ---------- scouting: the same photos can start a new scouting record or join one ---------- */
function loadScouts(){
  if(SCOUTS.list&&Date.now()-SCOUTS.at<300000)return Promise.resolve(SCOUTS.list);
  if(SCOUTS.loading)return SCOUTS.loading;
  SCOUTS.loading=bridge().api('/api/agent/scouting/v9?organization='+encodeURIComponent(org())+'&_t='+Date.now(),{method:'GET',headers:{},__fresh:true}).then(function(r){SCOUTS.list=arr(r&&r.prospects).filter(function(p){return String(p.status||'active')!=='declined';});SCOUTS.at=Date.now();SCOUTS.loading=null;return SCOUTS.list;}).catch(function(e){SCOUTS.loading=null;if(D)D.scoutErr=(e&&e.message)||'Could not load the scouting list.';return [];});
  return SCOUTS.loading;
}
function handleOf(text){var m=String(text||'').match(/(?:instagram\.com\/|(?:^|[\s(])@)([A-Za-z0-9._]{3,30})\b/);return m?'@'+m[1].replace(/\.$/,''):'';}
var COUNTRIES=['South Africa','United States','United Kingdom','Nigeria','Ghana','Kenya','Uganda','Tanzania','Senegal','Cameroon','Ethiopia','Ivory Coast','USA','UK','France','Italy','Germany','Spain','Canada','Brazil','Jamaica','Trinidad'];
function cityOf(text){
  var m=String(text||'').match(/\b(?:from|in|based in|lives in)\s+([A-Z][A-Za-z]+(?:[ -][A-Z][A-Za-z]+)?)(?:,\s*([A-Z][A-Za-z ]+))?/);if(!m)return {city:'',country:''};
  var city=m[1],country=(m[2]||'').trim();
  /* "Lagos Nigeria" is a city and a country run together */
  COUNTRIES.forEach(function(c){if(!country&&city.length>c.length&&city.slice(-c.length)===c&&/[ -]$/.test(city.slice(0,city.length-c.length))){country=c;city=city.slice(0,city.length-c.length).replace(/[ -]+$/,'');}else if(!country&&city===c){country=c;city='';}});
  return {city:city,country:country};
}
function scoutDefaults(){
  var c=D.ctx||{},name=/@/.test(String(c.fromName||''))?'':String(c.fromName||'').trim(),txt=String(c.text||'');
  var geo=cityOf(txt),ig=handleOf(txt);
  return {name:name,email:/@/.test(String(c.from||''))?String(c.from).toLowerCase():'',instagram:ig,city:geo.city,country:geo.country,notes:(c.subject?c.subject+'\n\n':'')+txt.replace(/\s+/g,' ').slice(0,600)};
}
/* an existing scouted person who already has this sender's email, or is named in the email */
function scoutSuggest(){
  var c=D.ctx||{},list=arr(SCOUTS.list),em=String(c.from||'').toLowerCase(),out=[];
  if(em)list.forEach(function(p){if(String(p.email||'').toLowerCase()===em)out.push({p:p,why:'same email address as the sender'});});
  var hay=' '+norm([c.subject,c.text,c.fromName].join(' '))+' ';
  list.forEach(function(p){var n=norm(p.display_name);if(n.length>=5&&hay.indexOf(' '+n+' ')>-1&&!out.some(function(o){return o.p.id===p.id;}))out.push({p:p,why:'named in the email'});});
  return out.slice(0,4);
}
function destTabs(){
  var t=function(k,l){return '<button type="button" class="sv-tab'+(D.dest===k?' on':'')+'" data-d="'+k+'">'+l+'</button>';};
  return '<div class="sv-dest" role="tablist" aria-label="Where do these go?">'+t('model','Model profile')+t('scout_new','New scouting')+t('scout_old','Add to a scouting record')+'</div>';
}
function scoutNewPane(){
  var n=D.sn||(D.sn=scoutDefaults());
  var f=function(k,label,ph,req){return '<label><span>'+label+(req?' <i>*</i>':'')+'</span><input data-sn="'+k+'" value="'+esc(n[k]||'')+'" placeholder="'+esc(ph||'')+'" maxlength="160"></label>';};
  return '<h4>Start a new scouting record</h4><p class="sv-note">These photos become the first photos on a new record in Scouted (stage: new lead). Details are filled in from the sender and the email. If someone is sending her on her behalf, change the name to hers.</p>'
   +'<div class="sv-sn">'+f('name','Name','Her full name',true)+f('email','Email','name@example.com')+f('instagram','Instagram','@handle')+'<div class="sv-two">'+f('city','City','')+f('country','Country','')+'</div>'
   +'<label>Notes<textarea data-sn="notes" rows="4" maxlength="2000">'+esc(n.notes||'')+'</textarea></label></div>';
}
function scoutOldPane(){
  var list=arr(SCOUTS.list),q=norm(D.sq),sg=scoutSuggest(),sel=D.sp;
  var shown=list.filter(function(p){return !q||norm([p.display_name,p.email,p.instagram,p.city].join(' ')).indexOf(q)>-1;}).slice(0,60);
  var sug=sg.length&&!q?'<div class="sv-sug"><small>Suggested from the email</small>'+sg.map(function(x){return '<button type="button" class="sv-chip'+(sel&&sel.id===x.p.id?' on':'')+'" data-sp="'+esc(x.p.id)+'" title="'+esc(x.why)+'">'+esc(x.p.display_name)+'</button>';}).join('')+'</div>':'';
  var rows=shown.map(function(p){return '<button type="button" class="sv-m'+(sel&&sel.id===p.id?' on':'')+'" data-sp="'+esc(p.id)+'"><b>'+esc(p.display_name)+'</b><small>'+esc([String(p.stage||'').replace(/_/g,' '),p.city,p.email].filter(Boolean).join(' · '))+'</small></button>';}).join('');
  return '<h4>Which scouting record?</h4>'+sug+'<input class="sv-sq" data-sq type="search" placeholder="Search scouted people" value="'+esc(D.sq)+'" aria-label="Search scouted people">'
   +'<div class="sv-ml">'+(list.length?(rows||'<p class="sv-none">No one matches “'+esc(D.sq)+'”.</p>'):'<p class="sv-none">'+esc(D.scoutErr||'Loading the scouting list…')+'</p>')+'</div>';
}
function rightPane(){return destTabs()+(D.dest==='scout_new'?scoutNewPane():D.dest==='scout_old'?scoutOldPane():modelPane());}
function scoutPhotos(){return D.items.filter(function(i){return i.status==='ready'&&!i.error&&i.kind==='photo';});}
function destLabel(ready){
  if(D.dest==='scout_new'){var n=scoutPhotos().length,nm=D.sn&&String(D.sn.name||'').trim();return !n?'Add at least one photo':!nm?'Add her name':'Start scouting with '+n+' photo'+(n===1?'':'s');}
  if(D.dest==='scout_old'){var k=scoutPhotos().length;return !D.sp?'Choose a scouting record':!k?'Add at least one photo':'Add '+k+' photo'+(k===1?'':'s')+' to '+D.sp.display_name;}
  return D.model&&ready.length?'Save '+ready.length+' file'+(ready.length===1?'':'s')+' to '+D.model.name:'Choose a model to save';
}
function destReady(ready){
  if(D.dest==='scout_new')return scoutPhotos().length>0&&!!(D.sn&&String(D.sn.name||'').trim());
  if(D.dest==='scout_old')return !!D.sp&&scoutPhotos().length>0;
  return !!D.model&&ready.length>0;
}
/* uploads one photo to a scouting record: the same secure steps the Scouted page uses */
async function scoutUpload(prospectId,it){
  var file=it.file,mime=it.mime;
  var start=await post('/api/storage/upload-url',{organization_id:orgId(),name:it.name,mime_type:mime,size_bytes:file.size,category:'scouting',visibility:'staff',resource_type:'scouting',resource_id:prospectId});
  if(!start||!start.signed_url)throw new Error('A secure upload link was not returned.');
  var up=await fetch(start.signed_url,{method:'PUT',headers:{'Content-Type':mime},body:file});
  if(!up.ok)throw new Error('The upload failed ('+up.status+').');
  var fin=await post('/api/storage/finalize',{upload_session_id:start.upload_session_id,relationship:'scouting_image',metadata:{source:'email_attachment'}});
  if(!fin||!fin.document||!fin.document.id)throw new Error('The upload could not be confirmed.');
  await post('/api/agent/scouting/v9',{action:'add_media_document',prospect_id:prospectId,document_id:fin.document.id,caption:it.name,sort_order:0});
}
async function saveScout(){
  if(D.busy)return;var todo=scoutPhotos();if(!todo.length)return;
  var rec=D.sp,created=false;D.busy=true;D.scoutErr='';paint();
  try{
    if(D.dest==='scout_new'){
      var n=D.sn||{},name=String(n.name||'').trim();if(!name)throw new Error('Add her name first.');
      var r=await post('/api/agent/scouting/v9',{action:'create',display_name:name,email:String(n.email||'').trim()||null,instagram:String(n.instagram||'').trim()||null,city:String(n.city||'').trim()||null,country:String(n.country||'').trim()||null,source:'Email',stage:'new_lead',notes:String(n.notes||'').trim()||null});
      rec=r&&r.prospect;if(!rec||!rec.id)throw new Error('The scouting record was not confirmed. Nothing was uploaded.');created=true;
    }
    var ok=0,bad=0;
    for(var k=0;k<todo.length;k++){
      todo[k].status='saving';todo[k].error='';paint();
      try{await scoutUpload(rec.id,todo[k]);todo[k].status='done';ok++;}catch(e){todo[k].status='ready';todo[k].error=(e&&e.message)||'Could not save this photo.';bad++;}
      paint();
    }
    SCOUTS.at=0;try{if(bridge().clearApiCache)bridge().clearApiCache();}catch(e){}
    if(ok||created){D.finished={kind:'scout',rec:rec,created:created,n:ok,failed:bad};}
    else toast('None of the photos could be saved. Check the messages next to each photo.');
  }catch(e){D.scoutErr=(e&&e.message)||'Could not save to scouting.';toast(D.scoutErr);}
  D.busy=false;paint();
}
function openScout(id){try{if(typeof window.navTo==='function')window.navTo('scouting');setTimeout(function(){try{if(window.VEUX_V1686&&VEUX_V1686.scoutDetail)VEUX_V1686.scoutDetail(id);}catch(e){}},700);}catch(e){}}

/* ---------- dialog ---------- */
function root(){var r=document.getElementById('mdv-sv');if(!r){r=document.createElement('div');r.id='mdv-sv';r.className='sv-back';r.addEventListener('click',function(e){if(e.target===r&&D&&!D.busy)close();});
    var hasFiles=function(e){return e.dataTransfer&&Array.from(e.dataTransfer.types||[]).indexOf('Files')>-1;};
    r.addEventListener('dragover',function(e){if(hasFiles(e)){e.preventDefault();var d=r.querySelector('#sv-drop');if(d)d.classList.add('on');}});
    r.addEventListener('dragleave',function(e){if(e.relatedTarget&&r.contains(e.relatedTarget))return;var d=r.querySelector('#sv-drop');if(d)d.classList.remove('on');});
    r.addEventListener('drop',function(e){if(!hasFiles(e))return;e.preventDefault();var d=r.querySelector('#sv-drop');if(d)d.classList.remove('on');if(D&&!D.busy&&!D.finished&&e.dataTransfer.files.length)addFiles(Array.from(e.dataTransfer.files));});
    document.body.appendChild(r);}return r;}
function close(){if(D){D.items.forEach(function(i){if(i.thumb){try{URL.revokeObjectURL(i.thumb);}catch(e){}}if(i.staging&&i.status!=='done')discard(i);});}D=null;var r=document.getElementById('mdv-sv');if(r)r.remove();document.removeEventListener('keydown',onKey);}
function onKey(e){if(e.key==='Escape'&&D&&!D.busy)close();}
function discard(i){try{post('/api/agent/save-to-model',{action:'discard',staging_path:i.staging}).catch(function(){});}catch(e){}}

function fileRow(i){
  var t=i.kind==='video'?'<span>VIDEO</span>':i.kind==='photo'&&i.as==='photo'?(i.thumb?'<img src="'+esc(i.thumb)+'" alt="">':'<span>IMG</span>'):'<span>'+esc((i.name.split('.').pop()||'file').slice(0,4).toUpperCase())+'</span>';
  var opts=i.as==='photo'?(i.kind==='video'?VIDEO_CATS:PHOTO_CATS).map(function(c){return '<option'+(i.cat===c?' selected':'')+'>'+c+'</option>';}).join(''):DOC_CATS.map(function(c){return '<option value="'+c[0]+'"'+(i.cat===c[0]?' selected':'')+'>'+c[1]+'</option>';}).join('');
  var st=i.status==='done'?'<em class="ok">✓ Saved</em>':i.status==='saving'?'<em>Saving…</em>':i.error?'<em class="bad">'+esc(i.error)+'</em>':'';
  var canEdit=i.status==='ready'&&!i.error&&!D.busy&&D.dest==='model';
  if(!st&&D.dest!=='model'&&i.kind!=='photo'&&i.status==='ready')st='<em class="bad">Scouting takes photos only. This one is skipped.</em>';
  return '<li class="sv-file '+(i.error?'err ':'')+i.status+'" data-id="'+i.id+'"><div class="sv-thumb">'+t+'</div><div class="sv-fi"><b title="'+esc(i.name)+'">'+esc(i.name)+'</b><small>'+esc(size(i.size))+(i.source?' · '+esc(i.source):'')+'</small>'+st
   +(canEdit?'<div class="sv-sel">'+(i.kind==='photo'?'<select data-k="as" aria-label="Save as"><option value="photo"'+(i.as==='photo'?' selected':'')+'>Photo</option><option value="doc"'+(i.as==='doc'?' selected':'')+'>Document</option></select>':'')+'<select data-k="cat" aria-label="Category">'+opts+'</select></div>':'')+'</div>'
   +(i.status!=='done'&&!D.busy?'<button type="button" class="sv-x" data-rm="'+i.id+'" aria-label="Remove">×</button>':'')+'</li>';
}
function modelPane(){
  var list=arr(MODELS.list),q=norm(D.q),sg=suggest(),sel=D.model;
  var shown=list.filter(function(m){return !q||norm(m.name).indexOf(q)>-1;}).slice(0,60);
  var sug=sg.length&&!q?'<div class="sv-sug"><small>Suggested from the email</small>'+sg.map(function(s){return '<button type="button" class="sv-chip'+(sel&&sel.id===s.m.id?' on':'')+'" data-m="'+esc(s.m.id)+'" title="'+esc(s.why)+'">'+esc(s.m.name)+'</button>';}).join('')+'</div>':'';
  var rows=shown.map(function(m){return '<button type="button" class="sv-m'+(sel&&sel.id===m.id?' on':'')+'" data-m="'+esc(m.id)+'"><b>'+esc(m.name)+'</b><small>'+esc([m.market,isPast(m)?'Past model':''].filter(Boolean).join(' · '))+'</small></button>';}).join('');
  return '<h4>Which model profile?</h4>'+sug+'<input class="sv-search" type="search" placeholder="Search the roster" value="'+esc(D.q)+'" aria-label="Search models">'
   +'<div class="sv-ml">'+(list.length?(rows||'<p class="sv-none">No model matches “'+esc(D.q)+'”.</p>'):'<p class="sv-none">'+esc(D.modelErr||'Loading the roster…')+'</p>')+'</div>';
}
function paint(){
  if(!D)return;var r=root(),ctx=D.ctx||{};
  var ready=D.items.filter(function(i){return i.status==='ready'&&!i.error;}),done=D.items.filter(function(i){return i.status==='done';});
  var photos=ready.filter(function(i){return i.as==='photo';}).length,docs=ready.length-photos;
  if(D.finished&&D.finished.kind==='scout'){
    var fr=D.finished,fn=(fr.rec&&fr.rec.display_name)||'her';
    r.innerHTML='<div class="sv-card sv-fin" role="dialog" aria-label="Saved"><div class="sv-tick">✓</div><h3>'+(fr.created?'Scouting started for ':'Added to ')+esc(fn)+'</h3><p>'+fr.n+' photo'+(fr.n===1?'':'s')+' added'+(fr.failed?', '+fr.failed+' could not be saved':'')+'.'+(fr.created?' She is on the Scouted board as a new lead.':'')+'</p><div class="sv-act"><button type="button" class="sv-btn" data-a="done">Done</button><button type="button" class="sv-btn gold" data-a="openscout">Open the scouting record</button></div></div>';
    wire(r);return;
  }
  if(D.finished){
    r.innerHTML='<div class="sv-card sv-fin" role="dialog" aria-label="Saved"><div class="sv-tick">✓</div><h3>Saved to '+esc(D.finished.model.name)+'</h3><p>'+D.finished.n+' file'+(D.finished.n===1?'':'s')+' added to the profile'+(D.finished.failed?', '+D.finished.failed+' could not be saved':'')+'.</p><div class="sv-act"><button type="button" class="sv-btn" data-a="done">Done</button>'+(D.items.some(function(i){return i.status==='ready'&&!i.error;})?'<button type="button" class="sv-btn" data-a="another">Save the rest to another model</button>':'')+'<button type="button" class="sv-btn gold" data-a="open">Open '+esc(D.finished.model.name.split(' ')[0])+'’s Model 360</button></div></div>';
    wire(r);return;
  }
  var label=destLabel(ready);
  r.innerHTML='<div class="sv-card" role="dialog" aria-label="Save these files"><header><div><h3>'+(D.dest==='scout_new'?'Start a new scouting record':D.dest==='scout_old'?'Add to a scouting record':'Save to a model profile')+'</h3><p>'+(ctx.subject||ctx.fromName?'From '+esc(ctx.fromName||'the email')+(ctx.subject?' · “'+esc(ctx.subject)+'”':''):'Choose the profile these files belong to.')+'</p></div><button type="button" class="sv-x big" data-a="close" aria-label="Close">×</button></header>'
   +'<div class="sv-cols"><section class="sv-left"><h4>Files <span>'+D.items.length+'</span></h4><ul class="sv-files">'+(D.items.length?D.items.map(fileRow).join(''):'')+'</ul>'
   +(D.items.length?'':'<p class="sv-none">No files yet.</p>')
   +'<div class="sv-drop" id="sv-drop"><input type="file" id="sv-file" multiple hidden accept=".jpg,.jpeg,.png,.webp,.gif,.mp4,.mov,.webm,.pdf,.doc,.docx,.txt,image/*,video/*,application/pdf"><span>Drop files here or</span> <button type="button" class="sv-link" data-a="choose">choose files</button></div>'
   +(arr(D.links).length?'<div class="sv-links"><small>Shared links in the email</small>'+D.links.map(function(l,ix){return '<div class="sv-lk"><span title="'+esc(l.url)+'">'+esc(l.label)+'</span>'+(l.folder?'<a class="sv-link" href="'+esc(l.url)+'" target="_blank" rel="noopener">Open folder</a>':'<button type="button" class="sv-link" data-lk="'+ix+'"'+(l.busy?' disabled':'')+'>'+(l.busy?'Fetching…':'Fetch file')+'</button>')+(l.err?'<em class="bad">'+esc(l.err)+'</em>':'')+'</div>';}).join('')+'<p class="sv-hint">Folders cannot be fetched. Open the folder, download the photos, then drop them above.</p></div>':'')
   +'</section><section class="sv-right">'+rightPane()+'</section></div>'
   +'<footer>'+(photos&&D.dest==='model'?'<label class="sv-pub"><input type="checkbox" id="sv-pub"'+(D.pub?' checked':'')+'> Show photos and videos on the website</label>':'<span></span>')+'<div class="sv-act"><button type="button" class="sv-btn" data-a="close"'+(D.busy?' disabled':'')+'>Cancel</button><button type="button" class="sv-btn gold" data-a="save"'+(destReady(ready)&&!D.busy?'':' disabled')+'>'+(D.busy?'Saving…':esc(label))+'</button></div></footer></div>';
  wire(r);
}
function scoutWire(r){
  r.querySelectorAll('[data-d]').forEach(function(b){b.onclick=function(){if(D.busy)return;D.dest=b.getAttribute('data-d');if(D.dest!=='model')loadScouts().then(function(){if(D)paint();});paint();};});
  r.querySelectorAll('[data-sp]').forEach(function(b){b.onclick=function(){var p=arr(SCOUTS.list).find(function(x){return String(x.id)===b.getAttribute('data-sp');});if(p){D.sp=p;paint();}};});
  r.querySelectorAll('[data-sn]').forEach(function(f){f.oninput=function(){D.sn=D.sn||{};D.sn[f.getAttribute('data-sn')]=f.value;var btn=r.querySelector('[data-a="save"]');if(btn){var ready=D.items.filter(function(i){return i.status==='ready'&&!i.error;});btn.textContent=D.busy?'Saving…':destLabel(ready);btn.disabled=!(destReady(ready)&&!D.busy);}};});
  var q=r.querySelector('[data-sq]');if(q)q.oninput=function(){D.sq=q.value;var pane=r.querySelector('.sv-right');pane.innerHTML=rightPane();scoutWire(r);var n=pane.querySelector('[data-sq]');if(n){n.focus();try{n.setSelectionRange(n.value.length,n.value.length);}catch(e){}}};
}
function wire(r){
  scoutWire(r);
  var keep=r.querySelector('.sv-search');
  r.querySelectorAll('[data-a]').forEach(function(b){b.onclick=function(){act(b.getAttribute('data-a'));};});
  r.querySelectorAll('[data-m]').forEach(function(b){b.onclick=function(){var m=arr(MODELS.list).find(function(x){return String(x.id)===b.getAttribute('data-m');});if(m){D.model=m;paint();}};});
  r.querySelectorAll('[data-rm]').forEach(function(b){b.onclick=function(){var id=+b.getAttribute('data-rm'),it=D.items.find(function(x){return x.id===id;});if(it&&it.thumb){try{URL.revokeObjectURL(it.thumb);}catch(e){}}if(it&&it.staging)discard(it);D.items=D.items.filter(function(x){return x.id!==id;});paint();};});
  r.querySelectorAll('.sv-file select').forEach(function(s){s.onchange=function(){var id=+s.closest('.sv-file').getAttribute('data-id'),it=D.items.find(function(x){return x.id===id;});if(!it)return;if(s.getAttribute('data-k')==='as'){it.as=s.value;it.cat=it.as==='photo'?guessPhoto(it.name):guessDoc(it.name);}else it.cat=s.value;paint();};});
  r.querySelectorAll('[data-lk]').forEach(function(b){b.onclick=function(){fetchLink(+b.getAttribute('data-lk'));};});
  var pub=r.querySelector('#sv-pub');if(pub)pub.onchange=function(){D.pub=pub.checked;};
  if(keep){keep.oninput=function(){D.q=keep.value;var pane=r.querySelector('.sv-right');pane.innerHTML=rightPane();scoutWire(r);rewirePane(r);var s=pane.querySelector('.sv-search');if(s){s.focus();try{s.setSelectionRange(s.value.length,s.value.length);}catch(e){}}};}
  var inp=r.querySelector('#sv-file');
  if(inp)inp.onchange=function(){addFiles(Array.from(inp.files||[]));inp.value='';};
}
function rewirePane(r){
  r.querySelectorAll('.sv-right [data-m]').forEach(function(b){b.onclick=function(){var m=arr(MODELS.list).find(function(x){return String(x.id)===b.getAttribute('data-m');});if(m){D.model=m;paint();}};});
  var s=r.querySelector('.sv-right .sv-search');if(s)s.oninput=function(){D.q=s.value;var pane=r.querySelector('.sv-right');pane.innerHTML=rightPane();scoutWire(r);rewirePane(r);var n=pane.querySelector('.sv-search');if(n){n.focus();try{n.setSelectionRange(n.value.length,n.value.length);}catch(e){}}};
}
function addFiles(files){files.forEach(function(f){D.items.push(makeItem(f));});paint();}

function act(a){
  if(!D)return;
  if(a==='close'||a==='done'){if(!D.busy)close();return;}
  if(a==='choose'){var i=document.getElementById('sv-file');if(i)i.click();return;}
  if(a==='another'){D.finished=null;D.model=null;D.items=D.items.filter(function(i){return i.status!=='done';});paint();return;}
  if(a==='open'){var m=D.finished&&D.finished.model;close();if(m)openModel(m.id);return;}
  if(a==='openscout'){var rc=D.finished&&D.finished.rec;close();if(rc)openScout(rc.id);return;}
  if(a==='save'){if(D.dest==='model')save();else saveScout();}
}
function openModel(id){try{window._veuxV10ModelId=id;window._openModelId=id;if(window.VEUX_V156_STATE)window.VEUX_V156_STATE.modelTab='materials';if(typeof window.navTo==='function')window.navTo('modelpage');}catch(e){}}

async function fetchLink(ix){
  var l=D.links[ix];if(!l||l.busy)return;l.busy=true;l.err='';paint();
  try{
    var r=await post('/api/agent/save-to-model',{action:'fetch_link',url:l.url});
    var res=await fetch(r.url);if(!res.ok)throw new Error('The fetched file could not be read back.');
    var blob=await res.blob(),file=new File([blob],r.name,{type:r.mime});
    D.items.push(makeItem(file,{staging:r.staging_path,source:r.source}));
    D.links.splice(ix,1);
  }catch(e){l.busy=false;l.err=(e&&e.message)||'Could not fetch that link.';}
  paint();
}

async function saveOne(it,modelId,pub,n){
  it.status='saving';it.error='';paint();
  try{
    var file=it.file;
    if(it.as==='photo'){
      var src=await bridge().uploadModelMedia(file,modelId,{category:it.cat});
      await post('/api/agent/model-portfolio/v10',{action:'create_media',model_id:modelId,url:src.url,public_id:src.public_id||null,provider:src.provider||'supabase',category:it.cat,media_type:src.media_type||'image',is_public:!!pub,sort_order:900+n});
    }else{
      var mime=it.mime;if(!DOCM.test(mime)&&!IMG.test(mime))throw new Error('This file type cannot be saved as a document.');
      var start=await post('/api/storage/upload-url',{organization_id:orgId(),name:it.name,mime_type:mime,size_bytes:file.size,category:it.cat||'general',visibility:'staff',resource_type:'model',resource_id:modelId,visible_to_model:false,visible_to_partner:false});
      if(!start||!start.signed_url)throw new Error('A secure upload link was not returned.');
      var up=await fetch(start.signed_url,{method:'PUT',headers:{'Content-Type':mime},body:file});
      if(!up.ok)throw new Error('The upload failed ('+up.status+').');
      var fin=await post('/api/storage/finalize',{upload_session_id:start.upload_session_id,relationship:'attachment',metadata:{source:'email_attachment',category:it.cat}});
      if(!fin||!fin.document||!fin.document.id)throw new Error('The upload could not be confirmed.');
    }
    it.status='done';if(it.staging){discard(it);it.staging=null;}return true;
  }catch(e){it.status='ready';it.error=(e&&e.message)||'Could not save this file.';return false;}
}
async function save(){
  var model=D.model;if(!model||D.busy)return;
  var todo=D.items.filter(function(i){return i.status==='ready'&&!i.error;});if(!todo.length)return;
  D.busy=true;paint();var ok=0,bad=0,n=0;
  for(var k=0;k<todo.length;k++){var r=await saveOne(todo[k],model.id,D.pub,n++);if(r)ok++;else bad++;paint();}
  D.busy=false;
  try{if(bridge().clearApiCache)bridge().clearApiCache();}catch(e){}
  if(ok){post('/api/agent/save-to-model',{action:'log',model_id:model.id,count:ok,from:(D.ctx&&D.ctx.fromName)||'',detail:todo.filter(function(i){return i.status==='done';}).map(function(i){return i.name+' ('+(i.as==='photo'?i.cat:'document')+')';}).join(', ')}).catch(function(){});}
  if(ok){D.finished={model:model,n:ok,failed:bad};try{if(window.rerender&&String(window._currentPage||'')==='modelpage'&&String(window._veuxV10ModelId)===String(model.id))window.rerender('modelpage');}catch(e){}}
  else toast('None of the files could be saved. Check the messages next to each file.');
  paint();
}

/* ---------- entry points ---------- */
function linksFrom(text){
  var out=[],seen={};
  (String(text||'').match(/https:\/\/(?:drive\.google\.com|docs\.google\.com|www\.dropbox\.com|dropbox\.com)\/[^\s"'<>)\]]+/gi)||[]).forEach(function(u){u=u.replace(/&amp;/g,'&').replace(/[.,;]+$/,'');if(seen[u])return;seen[u]=1;var folder=/\/drive\/folders\/|\/folderview|\/(sh|scl)\/fo\//i.test(u);out.push({url:u,folder:folder,label:folder?'Folder: '+(/dropbox/i.test(u)?'Dropbox':'Google Drive'):(/dropbox/i.test(u)?'Dropbox file':/docs\.google/i.test(u)?'Google Doc':'Google Drive file'),busy:false,err:''});});
  return out.slice(0,6);
}
function open(opts){
  opts=opts||{};if(D)close();
  D={items:[],model:null,q:'',pub:false,busy:false,finished:null,ctx:opts.context||{},links:linksFrom(opts.context&&opts.context.body),modelErr:'',dest:(opts.dest==='scout_new'||opts.dest==='scout_old')?opts.dest:'model',sq:'',sp:null,sn:null,scoutErr:''};
  arr(opts.files).forEach(function(f){D.items.push(makeItem(f));});
  document.addEventListener('keydown',onKey);paint();
  loadScouts().then(function(){if(D&&D.dest!=='model')paint();});
  loadModels().then(function(){if(!D)return;var sg=suggest();var full=sg.filter(function(s){return /full name/.test(s.why);});if(!D.model&&full.length===1)D.model=full[0].m;paint();});
}
function pick(ctx){var i=document.createElement('input');i.type='file';i.multiple=true;i.accept='.jpg,.jpeg,.png,.webp,.gif,.mp4,.mov,.webm,.pdf,.doc,.docx,.txt,image/*,video/*,application/pdf';i.onchange=function(){open({files:Array.from(i.files||[]),context:ctx});};i.click();}

window.MDV_SAVE={open:open,pick:pick,close:close,state:function(){return D;}};
})();
