/* Save files from an email (or from your computer) to a model's profile.
   Open with MDV_SAVE.open({files:[File…], context:{from,subject,text}}) or MDV_SAVE.pick().
   Photos go to the model's media with a category; PDFs, Word and text files go to the model's documents.
   The same uploaders the Model 360 uses do the saving, so the files behave like any other upload. */
(function(){
'use strict';
if(window.MDV_SAVE)return;

var PHOTO_CATS=['Portfolio','Digital','Polaroid','Headshot','Editorial','Runway','Commercial','Test','Other'];
var DOC_CATS=[['general','Document'],['contract','Contract / agreement'],['identity','Passport / ID'],['visa','Visa / work permit'],['call-sheet','Call sheet'],['comp-card','Comp card'],['other','Other']];
var IMG=/^image\/(jpeg|png|webp|gif)$/i,DOCM=/^(application\/pdf|application\/msword|application\/vnd\.openxmlformats-officedocument\.wordprocessingml\.document|text\/plain)$/i;
var EXT={jpg:'image/jpeg',jpeg:'image/jpeg',png:'image/png',webp:'image/webp',gif:'image/gif',pdf:'application/pdf',doc:'application/msword',docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',txt:'text/plain'};
var MAX_DOC=50*1048576,MAX_IMG=150*1048576;

var D=null;      /* the open dialog's state */
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
  it.kind=IMG.test(mime)?'photo':DOCM.test(mime)?'doc':'other';
  it.as=it.kind==='photo'?'photo':'doc';
  it.cat=it.kind==='photo'?guessPhoto(it.name):guessDoc(it.name);
  if(it.kind==='photo'){try{it.thumb=URL.createObjectURL(file);}catch(e){}}
  if(it.kind==='other')it.error='This file type cannot be saved to a profile. Use JPG, PNG, WEBP, GIF, PDF, Word or text.';
  else if(it.kind==='doc'&&it.size>MAX_DOC)it.error='Over the 50 MB limit.';
  else if(it.kind==='photo'&&it.size>MAX_IMG)it.error='Over the 150 MB limit.';
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
  var t=i.kind==='photo'&&i.as==='photo'?(i.thumb?'<img src="'+esc(i.thumb)+'" alt="">':'<span>IMG</span>'):'<span>'+esc((i.name.split('.').pop()||'file').slice(0,4).toUpperCase())+'</span>';
  var opts=i.as==='photo'?PHOTO_CATS.map(function(c){return '<option'+(i.cat===c?' selected':'')+'>'+c+'</option>';}).join(''):DOC_CATS.map(function(c){return '<option value="'+c[0]+'"'+(i.cat===c[0]?' selected':'')+'>'+c[1]+'</option>';}).join('');
  var st=i.status==='done'?'<em class="ok">✓ Saved</em>':i.status==='saving'?'<em>Saving…</em>':i.error?'<em class="bad">'+esc(i.error)+'</em>':'';
  var canEdit=i.status==='ready'&&!i.error&&!D.busy;
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
  if(D.finished){
    r.innerHTML='<div class="sv-card sv-fin" role="dialog" aria-label="Saved"><div class="sv-tick">✓</div><h3>Saved to '+esc(D.finished.model.name)+'</h3><p>'+D.finished.n+' file'+(D.finished.n===1?'':'s')+' added to the profile'+(D.finished.failed?', '+D.finished.failed+' could not be saved':'')+'.</p><div class="sv-act"><button type="button" class="sv-btn" data-a="done">Done</button>'+(D.items.some(function(i){return i.status==='ready'&&!i.error;})?'<button type="button" class="sv-btn" data-a="another">Save the rest to another model</button>':'')+'<button type="button" class="sv-btn gold" data-a="open">Open '+esc(D.finished.model.name.split(' ')[0])+'’s Model 360</button></div></div>';
    wire(r);return;
  }
  var label=D.model&&ready.length?'Save '+ready.length+' file'+(ready.length===1?'':'s')+' to '+D.model.name:'Choose a model to save';
  r.innerHTML='<div class="sv-card" role="dialog" aria-label="Save to a model profile"><header><div><h3>Save to a model profile</h3><p>'+(ctx.subject||ctx.fromName?'From '+esc(ctx.fromName||'the email')+(ctx.subject?' · “'+esc(ctx.subject)+'”':''):'Choose the profile these files belong to.')+'</p></div><button type="button" class="sv-x big" data-a="close" aria-label="Close">×</button></header>'
   +'<div class="sv-cols"><section class="sv-left"><h4>Files <span>'+D.items.length+'</span></h4><ul class="sv-files">'+(D.items.length?D.items.map(fileRow).join(''):'')+'</ul>'
   +(D.items.length?'':'<p class="sv-none">No files yet.</p>')
   +'<div class="sv-drop" id="sv-drop"><input type="file" id="sv-file" multiple hidden accept=".jpg,.jpeg,.png,.webp,.gif,.pdf,.doc,.docx,.txt,image/*,application/pdf"><span>Drop files here or</span> <button type="button" class="sv-link" data-a="choose">choose files</button></div>'
   +(arr(D.links).length?'<div class="sv-links"><small>Shared links in the email</small>'+D.links.map(function(l,ix){return '<div class="sv-lk"><span title="'+esc(l.url)+'">'+esc(l.label)+'</span>'+(l.folder?'<a class="sv-link" href="'+esc(l.url)+'" target="_blank" rel="noopener">Open folder</a>':'<button type="button" class="sv-link" data-lk="'+ix+'"'+(l.busy?' disabled':'')+'>'+(l.busy?'Fetching…':'Fetch file')+'</button>')+(l.err?'<em class="bad">'+esc(l.err)+'</em>':'')+'</div>';}).join('')+'<p class="sv-hint">Folders cannot be fetched. Open the folder, download the photos, then drop them above.</p></div>':'')
   +'</section><section class="sv-right">'+modelPane()+'</section></div>'
   +'<footer>'+(photos?'<label class="sv-pub"><input type="checkbox" id="sv-pub"'+(D.pub?' checked':'')+'> Show photos on the website</label>':'<span></span>')+'<div class="sv-act"><button type="button" class="sv-btn" data-a="close"'+(D.busy?' disabled':'')+'>Cancel</button><button type="button" class="sv-btn gold" data-a="save"'+(D.model&&ready.length&&!D.busy?'':' disabled')+'>'+(D.busy?'Saving…':esc(label))+'</button></div></footer></div>';
  wire(r);
}
function wire(r){
  var keep=r.querySelector('.sv-search');
  r.querySelectorAll('[data-a]').forEach(function(b){b.onclick=function(){act(b.getAttribute('data-a'));};});
  r.querySelectorAll('[data-m]').forEach(function(b){b.onclick=function(){var m=arr(MODELS.list).find(function(x){return String(x.id)===b.getAttribute('data-m');});if(m){D.model=m;paint();}};});
  r.querySelectorAll('[data-rm]').forEach(function(b){b.onclick=function(){var id=+b.getAttribute('data-rm'),it=D.items.find(function(x){return x.id===id;});if(it&&it.thumb){try{URL.revokeObjectURL(it.thumb);}catch(e){}}if(it&&it.staging)discard(it);D.items=D.items.filter(function(x){return x.id!==id;});paint();};});
  r.querySelectorAll('.sv-file select').forEach(function(s){s.onchange=function(){var id=+s.closest('.sv-file').getAttribute('data-id'),it=D.items.find(function(x){return x.id===id;});if(!it)return;if(s.getAttribute('data-k')==='as'){it.as=s.value;it.cat=it.as==='photo'?guessPhoto(it.name):guessDoc(it.name);}else it.cat=s.value;paint();};});
  r.querySelectorAll('[data-lk]').forEach(function(b){b.onclick=function(){fetchLink(+b.getAttribute('data-lk'));};});
  var pub=r.querySelector('#sv-pub');if(pub)pub.onchange=function(){D.pub=pub.checked;};
  if(keep){keep.oninput=function(){D.q=keep.value;var pane=r.querySelector('.sv-right');pane.innerHTML=modelPane();rewirePane(r);var s=pane.querySelector('.sv-search');if(s){s.focus();try{s.setSelectionRange(s.value.length,s.value.length);}catch(e){}}};}
  var inp=r.querySelector('#sv-file');
  if(inp)inp.onchange=function(){addFiles(Array.from(inp.files||[]));inp.value='';};
}
function rewirePane(r){
  r.querySelectorAll('.sv-right [data-m]').forEach(function(b){b.onclick=function(){var m=arr(MODELS.list).find(function(x){return String(x.id)===b.getAttribute('data-m');});if(m){D.model=m;paint();}};});
  var s=r.querySelector('.sv-right .sv-search');if(s)s.oninput=function(){D.q=s.value;var pane=r.querySelector('.sv-right');pane.innerHTML=modelPane();rewirePane(r);var n=pane.querySelector('.sv-search');if(n){n.focus();try{n.setSelectionRange(n.value.length,n.value.length);}catch(e){}}};
}
function addFiles(files){files.forEach(function(f){D.items.push(makeItem(f));});paint();}

function act(a){
  if(!D)return;
  if(a==='close'||a==='done'){if(!D.busy)close();return;}
  if(a==='choose'){var i=document.getElementById('sv-file');if(i)i.click();return;}
  if(a==='another'){D.finished=null;D.model=null;D.items=D.items.filter(function(i){return i.status!=='done';});paint();return;}
  if(a==='open'){var m=D.finished&&D.finished.model;close();if(m)openModel(m.id);return;}
  if(a==='save')save();
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
  D={items:[],model:null,q:'',pub:false,busy:false,finished:null,ctx:opts.context||{},links:linksFrom(opts.context&&opts.context.body),modelErr:''};
  arr(opts.files).forEach(function(f){D.items.push(makeItem(f));});
  document.addEventListener('keydown',onKey);paint();
  loadModels().then(function(){if(!D)return;var sg=suggest();var full=sg.filter(function(s){return /full name/.test(s.why);});if(!D.model&&full.length===1)D.model=full[0].m;paint();});
}
function pick(ctx){var i=document.createElement('input');i.type='file';i.multiple=true;i.accept='.jpg,.jpeg,.png,.webp,.gif,.pdf,.doc,.docx,.txt,image/*,application/pdf';i.onchange=function(){open({files:Array.from(i.files||[]),context:ctx});};i.click();}

window.MDV_SAVE={open:open,pick:pick,close:close,state:function(){return D;}};
})();
