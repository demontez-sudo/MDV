/* Files on calendar records (PDFs on bookings / events / castings) and Call Sheets on Model 360.
   Placeholders are filled automatically:
     <div data-mdv-files data-rtype="booking|event|casting" data-rid="…" data-title="…"></div>
     <div data-mdv-callsheets data-model-id="…" data-model-name="…"></div>            */
(function(){
'use strict';
if(window.__MDV_FILES__)return;window.__MDV_FILES__=true;

var MAX_BYTES=50*1024*1024,ACCEPT='.pdf,application/pdf,image/jpeg,image/png,image/webp,.doc,.docx';
var ALLOWED=/^(application\/pdf|image\/(jpeg|png|webp)|application\/msword|application\/vnd\.openxmlformats-officedocument\.wordprocessingml\.document)$/i;
var S={orgId:null};

function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
function arr(v){return Array.isArray(v)?v:[];}
function bridge(){var b=window.VEUX_AGENT_V4;if(!b||!b.api)throw new Error('Secure session is not ready');return b;}
function org(){try{return bridge().state.org.slug||'maison-de-veux';}catch(e){return 'maison-de-veux';}}
function get(path){return bridge().api(path,{method:'GET',headers:{},__fresh:true});}
function post(path,body){return bridge().api(path,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});}
function attGet(q){return get('/api/agent/attachments?organization='+encodeURIComponent(org())+'&'+q+'&_t='+Date.now()).then(function(d){if(d&&d.organization&&d.organization.id)S.orgId=d.organization.id;return d;});}
function attPost(body){return post('/api/agent/attachments',Object.assign({organization_slug:org()},body));}
function toast(m,t){var old=document.querySelector('.mdvf-toast');if(old)old.remove();var d=document.createElement('div');d.className='mdvf-toast '+(t||'');d.textContent=m;document.body.appendChild(d);setTimeout(function(){d.remove();},3400);}
function size(n){n=Number(n);if(!isFinite(n)||n<=0)return '';return n>=1048576?(n/1048576).toFixed(1)+' MB':Math.max(1,Math.round(n/1024))+' KB';}
function when(v){var d=v?new Date(v):null;return d&&!isNaN(d)?d.toLocaleDateString([],{month:'short',day:'numeric'}):'';}
function ext(name,mime){var m=String(name||'').match(/\.([a-z0-9]+)$/i);return (m?m[1]:(String(mime||'').split('/')[1]||'file')).slice(0,4).toUpperCase();}

/* ---------- upload through the secure pipeline (model-scoped, then linked) ---------- */
function checkFile(f){
  if(!f)throw new Error('Choose a file first.');
  var mime=f.type||(/\.pdf$/i.test(f.name)?'application/pdf':'');
  if(!ALLOWED.test(mime))throw new Error('"'+f.name+'" is not a supported type. Use PDF, JPG, PNG, WEBP, DOC or DOCX.');
  if(f.size>MAX_BYTES)throw new Error('"'+f.name+'" is over the 50 MB limit.');
  return mime;
}
async function uploadFile(modelId,file,category){
  var mime=checkFile(file);
  if(!S.orgId)throw new Error('Organization is not loaded yet. Refresh and try again.');
  var start=await post('/api/storage/upload-url',{organization_id:S.orgId,name:file.name,mime_type:mime,size_bytes:file.size,category:category||'attachment',visibility:'staff',resource_type:'model',resource_id:modelId,visible_to_model:false,visible_to_partner:false});
  if(!start||!start.signed_url)throw new Error('Secure upload URL was not returned for '+file.name);
  var up=await fetch(start.signed_url,{method:'PUT',headers:{'Content-Type':mime},body:file});
  if(!up.ok)throw new Error('Upload failed for '+file.name+' ('+up.status+')');
  var fin=await post('/api/storage/finalize',{upload_session_id:start.upload_session_id,relationship:'attachment',metadata:{source:category==='call-sheet'?'call_sheet':'calendar_attachment'}});
  var doc=fin&&fin.document;if(!doc||!doc.id)throw new Error('Upload could not be confirmed for '+file.name);
  return doc;
}
async function openDoc(id){
  try{var r=await get('/api/storage/download-url?document_id='+encodeURIComponent(id));if(!r||!r.url)throw new Error('Document is unavailable');window.open(r.url,'_blank','noopener');}
  catch(e){toast('Could not open file: '+(e.message||e),'bad');}
}

/* ---------- record files panel ---------- */
function mountRecord(el){
  if(!el||el.dataset.mdvMounted==='1')return;el.dataset.mdvMounted='1';
  var rtype=el.dataset.rtype,rid=el.dataset.rid,title=el.dataset.title||'',st={docs:[],models:[],loading:true,busy:false,err:'',share:true};
  function draw(){
    var list=st.docs.map(function(d){
      return '<div class="mdvf-row"><button type="button" class="mdvf-open" data-open="'+esc(d.document_id)+'"><i>'+esc(ext(d.name,d.mime_type))+'</i><span><b>'+esc(d.name||'File')+'</b><small>'+esc([size(d.size_bytes),when(d.created_at)].filter(Boolean).join(' · '))+'</small></span></button>'
        +'<span class="mdvf-tools">'+(st.models.length?'<button type="button" class="mdvf-pill'+(d.shared_with_models?' on':'')+'" data-share="'+esc(d.document_id)+'" data-on="'+(d.shared_with_models?1:0)+'" title="'+(d.shared_with_models?'Visible to assigned models — click to hide':'Hidden from models — click to share')+'">'+(d.shared_with_models?'Shared with models':'Agency only')+'</button>':'')
        +'<button type="button" class="mdvf-x" data-remove="'+esc(d.document_id)+'" aria-label="Remove file">×</button></span></div>';
    }).join('');
    el.innerHTML='<div class="mdvf" data-drop>'
      +'<div class="mdvf-head"><span class="mdvf-count">'+(st.loading?'Loading files…':st.docs.length+' file'+(st.docs.length===1?'':'s'))+'</span>'
      +(st.models.length?'<label class="mdvf-share"><input type="checkbox" data-share-new '+(st.share?'checked':'')+'> Share new files with assigned models</label>':'')
      +'<button type="button" class="mdvf-add" data-add '+(st.busy?'disabled':'')+'>'+(st.busy?'Uploading…':'+ Add PDF')+'</button><input type="file" hidden multiple accept="'+ACCEPT+'" data-file></div>'
      +(st.err?'<p class="mdvf-err">'+esc(st.err)+'</p>':'')
      +(list?'<div class="mdvf-list">'+list+'</div>':(st.loading?'':'<p class="mdvf-empty">No files yet. Add a PDF — brief, call sheet, mood board, contract — or drop it here.'+(st.models.length?'':' Assign a model to this '+esc(rtype)+' first so files can be stored securely.')+'</p>'))
      +'</div>';
    wire();
  }
  function wire(){
    var root=el.querySelector('.mdvf'),input=el.querySelector('[data-file]');
    el.querySelector('[data-add]').onclick=function(){input.click();};
    input.onchange=function(){upload([].slice.call(input.files));input.value='';};
    var sn=el.querySelector('[data-share-new]');if(sn)sn.onchange=function(){st.share=sn.checked;};
    el.querySelectorAll('[data-open]').forEach(function(b){b.onclick=function(){openDoc(b.dataset.open);};});
    el.querySelectorAll('[data-remove]').forEach(function(b){b.onclick=async function(){if(!window.confirm('Remove this file from the '+rtype+'? The file stays in the secure document library.'))return;b.disabled=true;try{await attPost({action:'unlink',resource_type:rtype,resource_id:rid,document_id:b.dataset.remove});toast('File removed');await load();}catch(e){toast(e.message||String(e),'bad');b.disabled=false;}};});
    el.querySelectorAll('[data-share]').forEach(function(b){b.onclick=async function(){var on=b.dataset.on!=='1';b.disabled=true;try{await attPost({action:'share',resource_type:rtype,resource_id:rid,document_id:b.dataset.share,share:on});toast(on?'Shared with assigned models':'Hidden from models');await load();}catch(e){toast(e.message||String(e),'bad');b.disabled=false;}};});
    ['dragover','dragenter'].forEach(function(n){root.addEventListener(n,function(e){e.preventDefault();root.classList.add('drag');});});
    ['dragleave','drop'].forEach(function(n){root.addEventListener(n,function(e){e.preventDefault();root.classList.remove('drag');});});
    root.addEventListener('drop',function(e){var fs=[].slice.call(e.dataTransfer&&e.dataTransfer.files||[]);if(fs.length)upload(fs);});
  }
  async function load(keepErr){
    try{var d=await attGet('resource_type='+encodeURIComponent(rtype)+'&resource_id='+encodeURIComponent(rid));st.docs=arr(d.documents);st.models=arr(d.model_ids);if(!keepErr)st.err='';}
    catch(e){st.err='Could not load files: '+(e.message||e);}
    st.loading=false;draw();
  }
  async function upload(files){
    if(!files.length||st.busy)return;
    if(!st.models.length){st.err='Assign at least one model to this '+rtype+' before attaching files — files are stored securely against a model.';draw();return;}
    st.busy=true;st.err='';draw();
    try{
      var docs=[];
      for(var i=0;i<files.length;i++){docs.push(await uploadFile(st.models[0],files[i],'attachment'));}
      var out=await attPost({action:'link',resource_type:rtype,resource_id:rid,documents:docs.map(function(d){return{id:d.id,name:d.name};}),share_with_models:!!st.share});
      if(!out||out.verified!==true)throw new Error('Files uploaded but could not be attached.');
      toast(docs.length+' file'+(docs.length===1?'':'s')+' attached'+(out.shared_with?' · shared with '+out.shared_with+' model'+(out.shared_with===1?'':'s'):''));
    }catch(e){st.err=e.message||String(e);}
    st.busy=false;await load(!!st.err);
  }
  draw();load();
}

/* ---------- Model 360 · Call Sheets ---------- */
function mountCallSheets(el){
  if(!el||el.dataset.mdvMounted==='1')return;el.dataset.mdvMounted='1';
  var modelId=el.dataset.modelId,modelName=el.dataset.modelName||'this model',st={sheets:[],loading:true,err:''};
  function fmtDate(v){var d=v?new Date(/^\d{4}-\d{2}-\d{2}$/.test(v)?v+'T12:00:00':v):null;return d&&!isNaN(d)?d.toLocaleDateString([],{weekday:'short',month:'short',day:'numeric',year:'numeric'}):'';}
  function draw(){
    var cards=st.sheets.map(function(c){
      var meta=[fmtDate(c.shoot_date),c.call_time&&('Call '+c.call_time),c.location].filter(Boolean).join(' · ');
      return '<article class="mdvf-cs"><div class="mdvf-cs-main"><i>PDF</i><div><b>'+esc(c.title||c.name||'Call sheet')+'</b>'+(meta?'<span>'+esc(meta)+'</span>':'<span>'+esc(when(c.created_at))+'</span>')+(c.booking&&c.booking.title?'<em>Booking · '+esc(c.booking.title)+'</em>':'')+(c.notes?'<p>'+esc(c.notes)+'</p>':'')+'</div></div>'
        +'<div class="mdvf-cs-tools"><button type="button" class="mdvf-pill'+(c.visible_to_model?' on':'')+'" data-vis="'+esc(c.link_id)+'" data-on="'+(c.visible_to_model?1:0)+'">'+(c.visible_to_model?'Visible to '+esc(modelName.split(' ')[0])+'':'Agency only')+'</button><button type="button" class="mdvf-btn" data-open="'+esc(c.document_id)+'">Open</button><button type="button" class="mdvf-x" data-del="'+esc(c.link_id)+'" aria-label="Remove call sheet">×</button></div></article>';
    }).join('');
    el.innerHTML='<section class="mdvf-callsheets"><header><div><small>CALL SHEETS</small><h3>Call sheets for '+esc(modelName)+'</h3><p>Upload a call sheet PDF for a shoot or booking. Share it and the model gets it in their portal with a notification.</p></div><button type="button" class="mdvf-add" data-new>+ Add call sheet</button></header>'
      +(st.err?'<p class="mdvf-err">'+esc(st.err)+'</p>':'')
      +(cards?'<div class="mdvf-cs-list">'+cards+'</div>':'<p class="mdvf-empty">'+(st.loading?'Loading call sheets…':'No call sheets yet.')+'</p>')+'</section>';
    el.querySelector('[data-new]').onclick=function(){callSheetModal(modelId,modelName,load);};
    el.querySelectorAll('[data-open]').forEach(function(b){b.onclick=function(){openDoc(b.dataset.open);};});
    el.querySelectorAll('[data-vis]').forEach(function(b){b.onclick=async function(){var on=b.dataset.on!=='1';b.disabled=true;try{await post('/api/agent/documents/v13.12',{organization_slug:org(),action:'set_visibility',model_id:modelId,link_id:b.dataset.vis,visible_to_model:on,visible_to_partner:false});toast(on?'Shared with '+modelName:'Hidden from model');await load();}catch(e){toast(e.message||String(e),'bad');b.disabled=false;}};});
    el.querySelectorAll('[data-del]').forEach(function(b){b.onclick=async function(){if(!window.confirm('Remove this call sheet from '+modelName+'?'))return;b.disabled=true;try{await post('/api/agent/documents/v13.12',{organization_slug:org(),action:'remove_link',model_id:modelId,link_id:b.dataset.del});toast('Call sheet removed');await load();}catch(e){toast(e.message||String(e),'bad');b.disabled=false;}};});
  }
  async function load(){
    try{var d=await attGet('model_id='+encodeURIComponent(modelId)+'&call_sheets=1');st.sheets=arr(d.call_sheets);st.err='';}
    catch(e){st.err='Could not load call sheets: '+(e.message||e);}
    st.loading=false;draw();
  }
  draw();load();
}

function callSheetModal(modelId,modelName,done){
  var old=document.getElementById('mdvf-modal');if(old)old.remove();
  var back=document.createElement('div');back.id='mdvf-modal';back.className='mdvf-modal-back';
  back.innerHTML='<section class="mdvf-modal" role="dialog" aria-modal="true" aria-label="Add call sheet"><header><div><small>CALL SHEET</small><h2>Add call sheet · '+esc(modelName)+'</h2></div><button type="button" data-x aria-label="Close">×</button></header>'
    +'<div class="mdvf-form"><label class="wide"><span>Call sheet file *</span><input type="file" id="mdvf-cs-file" accept="'+ACCEPT+'"></label>'
    +'<label class="wide"><span>Link to booking <em>(optional — fills the details below)</em></span><select id="mdvf-cs-booking"><option value="">Loading bookings…</option></select></label>'
    +'<label class="wide"><span>Title *</span><input id="mdvf-cs-title" placeholder="e.g. Vogue Italia — Day 1" maxlength="160"></label>'
    +'<label><span>Shoot date</span><input type="date" id="mdvf-cs-date"></label><label><span>Call time</span><input id="mdvf-cs-time" placeholder="e.g. 8:30 AM" maxlength="40"></label>'
    +'<label class="wide"><span>Location</span><input id="mdvf-cs-loc" placeholder="Studio address" maxlength="240"></label>'
    +'<label class="wide"><span>Notes</span><textarea id="mdvf-cs-notes" rows="3" maxlength="1500" placeholder="Hair & makeup, wardrobe, parking, on-site contact…"></textarea></label>'
    +'<label class="mdvf-check wide"><input type="checkbox" id="mdvf-cs-all" checked> <span>Also send to the other models on this booking</span></label>'
    +'<label class="mdvf-check wide"><input type="checkbox" id="mdvf-cs-share" checked> <span>Share with the model now (they get it in their portal with a notification)</span></label></div>'
    +'<p class="mdvf-err" id="mdvf-cs-err"></p><footer><button type="button" class="mdvf-btn" data-x>Cancel</button><button type="button" class="mdvf-add" id="mdvf-cs-go">Add call sheet</button></footer></section>';
  document.body.appendChild(back);
  var $=function(q){return back.querySelector(q);},bookings=[];
  function close(){back.remove();}
  back.querySelectorAll('[data-x]').forEach(function(b){b.onclick=close;});
  back.addEventListener('mousedown',function(e){if(e.target===back)close();});
  (async function(){
    try{
      var start=new Date(Date.now()-30*864e5).toISOString(),end=new Date(Date.now()+150*864e5).toISOString();
      var d=await get('/api/agent/calendar/v9?organization='+encodeURIComponent(org())+'&start='+encodeURIComponent(start)+'&end='+encodeURIComponent(end));
      bookings=arr(d.bookings).filter(function(b){return arr(b.booking_models).some(function(m){return String(m.model_id)===String(modelId);});}).sort(function(a,b){return new Date(a.starts_at)-new Date(b.starts_at);});
    }catch(e){bookings=[];}
    $('#mdvf-cs-booking').innerHTML='<option value="">— Not linked to a booking —</option>'+bookings.map(function(b){return '<option value="'+esc(b.id)+'">'+esc((when(b.starts_at)||'')+' · '+(b.title||'Booking'))+'</option>';}).join('');
  })();
  $('#mdvf-cs-booking').onchange=function(){
    var b=bookings.filter(function(x){return String(x.id)===this.value;}.bind(this))[0];if(!b)return;
    if(!$('#mdvf-cs-title').value)$('#mdvf-cs-title').value=b.title||'';
    var s=b.starts_at?new Date(b.starts_at):null;if(s&&!isNaN(s)){var z=new Date(s.getTime()-s.getTimezoneOffset()*60000).toISOString();$('#mdvf-cs-date').value=z.slice(0,10);}
    var c=b.call_time||b.starts_at,cd=c?new Date(c):null;if(cd&&!isNaN(cd)&&!$('#mdvf-cs-time').value)$('#mdvf-cs-time').value=cd.toLocaleTimeString([],{hour:'numeric',minute:'2-digit'});
    if(!$('#mdvf-cs-loc').value)$('#mdvf-cs-loc').value=b.location||'';
  };
  $('#mdvf-cs-go').onclick=async function(){
    var btn=this,err=$('#mdvf-cs-err'),file=$('#mdvf-cs-file').files[0],title=$('#mdvf-cs-title').value.trim();err.textContent='';
    try{
      if(!file)throw new Error('Choose the call sheet file.');if(!title)throw new Error('Add a title.');
      btn.disabled=true;btn.textContent='Uploading…';
      var doc=await uploadFile(modelId,file,'call-sheet');
      var bookingId=$('#mdvf-cs-booking').value,models=[modelId];
      if(bookingId&&$('#mdvf-cs-all').checked){var b=bookings.filter(function(x){return String(x.id)===bookingId;})[0];arr(b&&b.booking_models).forEach(function(m){if(m.model_id&&models.indexOf(m.model_id)<0)models.push(m.model_id);});}
      btn.textContent='Saving…';
      var out=await attPost({action:'call_sheet',document_id:doc.id,model_ids:models,booking_id:bookingId||null,title:title,shoot_date:$('#mdvf-cs-date').value||null,call_time:$('#mdvf-cs-time').value.trim()||null,location:$('#mdvf-cs-loc').value.trim()||null,notes:$('#mdvf-cs-notes').value.trim()||null,share:$('#mdvf-cs-share').checked});
      if(!out||out.verified!==true)throw new Error('The call sheet could not be confirmed as saved.');
      close();toast('Call sheet added'+(out.shared?' · shared with '+out.models+' model'+(out.models===1?'':'s'):''));if(done)done();
    }catch(e){err.textContent=e.message||String(e);btn.disabled=false;btn.textContent='Add call sheet';}
  };
}

/* ---------- hydrate placeholders as they appear ---------- */
function scan(root){
  if(!root||!root.querySelectorAll)return;
  var list=[];
  if(root.matches&&(root.matches('[data-mdv-files]')||root.matches('[data-mdv-callsheets]')))list.push(root);
  root.querySelectorAll('[data-mdv-files],[data-mdv-callsheets]').forEach(function(n){list.push(n);});
  list.forEach(function(n){if(n.hasAttribute('data-mdv-files'))mountRecord(n);else mountCallSheets(n);});
}
function start(){
  scan(document.body);
  new MutationObserver(function(ms){ms.forEach(function(m){m.addedNodes.forEach(function(n){if(n.nodeType===1)scan(n);});});}).observe(document.body,{childList:true,subtree:true});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
window.MDV_FILES={mountRecord:mountRecord,mountCallSheets:mountCallSheets,callSheetModal:callSheetModal,openDoc:openDoc,scan:scan};
})();
