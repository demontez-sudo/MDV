/* Shrink existing photos: see agent-portal/netlify/functions/agent-storage-shrink.mjs for the server steps. */
(function(){
'use strict';
var MOUNT=location.pathname.indexOf('/admin/')===0?'/admin':'',BASES=[MOUNT+'/api/agent/storage-shrink','/.netlify/functions/agent-storage-shrink'],S={cands:[],sel:{},run:false,stop:false,status:{},waiting:[],waitingMb:0,sb:null};
function $(id){return document.getElementById(id);}
function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
function msg(t){var m=$('msg');m.style.display=t?'block':'none';m.textContent=t||'';}
function token(){
  try{var keys=['veux-agent-mogy-auth-v1'];for(var i=0;i<localStorage.length;i++){var k=localStorage.key(i);if(/^sb-.*-auth-token$/.test(k))keys.push(k);}
    for(var j=0;j<keys.length;j++){var raw=localStorage.getItem(keys[j]);if(!raw)continue;var o=JSON.parse(raw),t=o&&(o.access_token||(o.currentSession&&o.currentSession.access_token));if(t){if(o.expires_at&&o.expires_at*1000<Date.now()-60000)throw new Error('Your sign-in has expired. Open the portal in another tab so it refreshes, then press Scan again.');return t;}}
  }catch(e){if(/expired/.test(e.message))throw e;}
  throw new Error('You are not signed in here. Open the portal, sign in, then come back to this page.');
}
async function api(action,body){
  var t=token(),last=null;
  for(var i=0;i<BASES.length;i++){
    try{
      var r=await fetch(BASES[i],{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+t},body:JSON.stringify(Object.assign({organization_slug:'maison-de-veux',action:action},body||{}))});
      var j=await r.json().catch(function(){return null;});
      if(r.status===404&&i<BASES.length-1)continue;
      if(!r.ok||!j||j.ok===false)throw new Error((j&&(j.error||j.message))||('The server answered '+r.status));
      return j;
    }catch(e){last=e;if(i<BASES.length-1&&/Failed to fetch|NetworkError/i.test(e.message))continue;throw e;}
  }
  throw last||new Error('No answer from the server');
}
/* the same shrink the upload path uses */
async function shrink(blob){
  var bmp=await createImageBitmap(blob,{imageOrientation:'from-image'});
  var k=Math.min(1,4000/Math.max(bmp.width,bmp.height)),w=Math.max(1,Math.round(bmp.width*k)),h=Math.max(1,Math.round(bmp.height*k));
  var cv=document.createElement('canvas');cv.width=w;cv.height=h;var cx=cv.getContext('2d');cx.fillStyle='#fff';cx.fillRect(0,0,w,h);cx.drawImage(bmp,0,0,w,h);if(bmp.close)bmp.close();
  return await new Promise(function(r){cv.toBlob(r,'image/jpeg',0.9);});
}
async function supabase(){
  if(S.sb)return S.sb;
  if(!window.supabase||!window.supabase.createClient){
    var urls=['https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2','https://unpkg.com/@supabase/supabase-js@2/dist/umd/supabase.js'];
    for(var i=0;i<urls.length&&!(window.supabase&&window.supabase.createClient);i++){await new Promise(function(res){var s=document.createElement('script');s.src=urls[i];s.onload=res;s.onerror=res;document.head.appendChild(s);});}
  }
  if(!window.supabase||!window.supabase.createClient)throw new Error('The upload library did not load. Check your connection and try again.');
  var cfg=null;for(var j=0;j<[MOUNT+'/api/config','/api/config'].length&&!cfg;j++){try{var r=await fetch([MOUNT+'/api/config','/api/config'][j],{cache:'no-store'});var b=await r.json();if(r.ok&&b&&b.supabase_url&&b.supabase_publishable_key)cfg=b;}catch(e){}}
  if(!cfg)throw new Error('Could not read the portal connection settings.');
  S.sb=window.supabase.createClient(cfg.supabase_url,cfg.supabase_publishable_key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});return S.sb;
}
var mb=function(n){return (Math.round(n*10)/10)+' MB';};
function paint(){
  var c=S.cands,chosen=c.filter(function(x){return S.sel[x.path];}),chosenMb=chosen.reduce(function(n,x){return n+x.mb;},0);
  var h='';
  if(!c.length)h='<p><b>No big photos left to shrink.</b></p><p class="mute">Photos under 3 MB, videos and photos already shrunk are left alone.</p><div class="row"><button id="rescan">Scan again</button></div>';
  else{
    h='<div class="row"><div class="grow"><b>'+c.length+' photos over 3 MB</b> · '+mb(c.reduce(function(n,x){return n+x.mb;},0))+' <span class="mute">· shrinking should save about '+mb(S.est||0)+'</span></div><button id="rescan"'+(S.run?' disabled':'')+'>Scan again</button></div>'
     +'<table><thead><tr><th><input type="checkbox" id="all" '+(chosen.length===c.length?'checked':'')+(S.run?' disabled':'')+'></th><th>Photo</th><th class="num">Size</th><th>Status</th></tr></thead><tbody>'
     +c.map(function(x){var st=S.status[x.path]||{};return '<tr><td><input type="checkbox" data-p="'+esc(x.path)+'" '+(S.sel[x.path]?'checked':'')+(S.run?' disabled':'')+'></td><td class="name">'+esc(x.name)+(x.media_ids.length>1?' <span class="mute">('+x.media_ids.length+' profile entries)</span>':'')+'</td><td class="num">'+mb(x.mb)+'</td><td class="st '+(st.cls||'')+'">'+esc(st.text||'')+'</td></tr>';}).join('')+'</tbody></table>'
     +'<div class="row" style="margin-top:14px"><button class="go" id="go" '+(S.run||!chosen.length?'disabled':'')+'>Shrink '+chosen.length+' selected ('+mb(chosenMb)+')</button>'+(S.run?'<button id="stop">Stop after this photo</button>':'')+'</div>';
  }
  $('scan').innerHTML=h;
  var w=$('waiting');
  if(S.waiting.length){w.hidden=false;w.innerHTML='<p><b>'+S.waiting.length+' smaller copies are in use. The originals ('+mb(S.waitingMb)+') are still stored.</b></p><p class="mute">Before deleting them, open a few of these models in the portal and on the public site and make sure the photos look right. Deleting is permanent and frees the space.</p>'
    +'<table><tbody>'+S.waiting.map(function(x){return '<tr><td class="name">'+esc(x.old_path.split('/').pop())+'</td><td class="num">'+mb(x.old_mb)+' → '+mb(x.new_mb)+'</td><td class="num"><button data-undo="'+esc(x.old_path)+'">Undo</button></td></tr>';}).join('')+'</tbody></table>'
    +'<div class="row" style="margin-top:14px"><button class="danger" id="delete">Delete the '+S.waiting.length+' originals and free '+mb(S.waitingMb)+'</button></div>';}
  else{w.hidden=true;w.innerHTML='';}
  wire();
}
function wire(){
  var r=$('rescan');if(r)r.onclick=scan;
  var a=$('all');if(a)a.onchange=function(){S.cands.forEach(function(x){S.sel[x.path]=a.checked;});paint();};
  document.querySelectorAll('[data-p]').forEach(function(b){b.onchange=function(){S.sel[b.dataset.p]=b.checked;paint();};});
  var g=$('go');if(g)g.onclick=run;var st=$('stop');if(st)st.onclick=function(){S.stop=true;st.textContent='Stopping…';};
  document.querySelectorAll('[data-undo]').forEach(function(b){b.onclick=function(){undo(b.dataset.undo);};});
  var d=$('delete');if(d)d.onclick=del;
}
async function scan(){
  msg('');$('scan').innerHTML='<p class="mute">Looking for big photos…</p>';
  try{var r=await api('scan');S.cands=r.candidates||[];S.est=r.estimated_saving_mb;S.waiting=r.waiting_for_delete||[];S.waitingMb=r.waiting_mb||0;S.sel={};S.cands.forEach(function(x){S.sel[x.path]=true;});S.status={};paint();}
  catch(e){msg(e.message);$('scan').innerHTML='<div class="row"><button id="rescan">Scan again</button></div>';wire();}
}
async function one(x){
  var set=function(text,cls){S.status[x.path]={text:text,cls:cls};paint();};
  set('Getting an upload place…','work');
  var p=await api('prepare',{path:x.path});
  set('Downloading the original…','work');
  var resp=await fetch(p.old_url,{cache:'no-store'});if(!resp.ok)throw new Error('Could not download the original ('+resp.status+')');
  var orig=await resp.blob();
  set('Shrinking…','work');
  var small=await shrink(orig);
  if(!small||small.size>orig.size*0.85){set('Left as it is: already small enough','');return 'skipped';}
  set('Uploading '+mb(small.size/1048576)+'…','work');
  var sb=await supabase(),up=await sb.storage.from(p.bucket).uploadToSignedUrl(p.new_path,p.token,small,{contentType:'image/jpeg'});
  if(up&&up.error)throw new Error('Upload failed: '+(up.error.message||'storage rejected it'));
  set('Switching the profile to the smaller copy…','work');
  var s=await api('swap',{old_path:x.path,new_path:p.new_path});
  set('Done: '+mb(s.old_mb)+' → '+mb(s.new_mb),'ok');return 'done';
}
async function run(){
  S.run=true;S.stop=false;msg('');paint();var done=0,fail=0;
  var list=S.cands.filter(function(x){return S.sel[x.path];});
  for(var i=0;i<list.length&&!S.stop;i++){
    try{var r=await one(list[i]);if(r==='done')done++;}catch(e){fail++;S.status[list[i].path]={text:'Not changed: '+e.message,cls:'bad'};paint();}
  }
  S.run=false;S.stop=false;
  try{var r2=await api('scan');S.waiting=r2.waiting_for_delete||[];S.waitingMb=r2.waiting_mb||0;S.est=r2.estimated_saving_mb;}catch(e){}   /* keep the finished rows on screen with their results; Scan again refreshes the list */
  paint();msg(fail?(fail+' photo'+(fail===1?'':'s')+' could not be shrunk and were left untouched.'):'');
}
async function undo(oldPath){
  try{await api('rollback',{old_path:oldPath});await scan();}catch(e){msg(e.message);}
}
async function del(){
  if(!window.confirm('Delete '+S.waiting.length+' original photos ('+mb(S.waitingMb)+')?\n\nThis cannot be undone. Only do it after you have checked that the photos look right in the portal and on the public site.'))return;
  try{var r=await api('delete_originals',{confirm:true});msg('');await scan();var m=$('msg');m.style.display='block';m.style.color='var(--ok)';m.style.borderColor='rgba(124,207,151,.5)';m.style.background='rgba(124,207,151,.1)';m.textContent='Deleted '+r.deleted+' originals and freed '+mb(r.freed_mb)+'.'+(r.skipped&&r.skipped.length?' '+r.skipped.length+' were kept because something still points at them.':'')+' Supabase can take up to an hour to update its usage numbers.';}
  catch(e){msg(e.message);}
}
scan();
window.__shrinkTool={api:api,scan:scan,run:run,state:S};
})();
