/* Mail — each team member connects their own Microsoft 365 mailbox and reads, sends and replies inside the portal.
   Server: /api/agent/mail (Microsoft Graph; tokens encrypted server-side, never in the browser). */
(function(){
'use strict';
if(window.__MDV_MAIL__)return;window.__MDV_MAIL__=true;

var S={host:null,status:null,loading:false,err:'',folder:'inbox',folders:[],messages:[],next:null,listLoading:false,listErr:'',search:'',unreadOnly:false,
  sel:null,detail:null,detailLoading:false,showImages:imagesAlways(),readerOpen:false,timer:null,seq:0,senders:{},listScroll:0};

function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
function arr(v){return Array.isArray(v)?v:[];}
function bridge(){var b=window.VEUX_AGENT_V4;if(!b||!b.api)throw new Error('Secure session is not ready');return b;}
function org(){try{return bridge().state.org.slug||'maison-de-veux';}catch(e){return 'maison-de-veux';}}
function status(){return bridge().api('/api/agent/mail?organization='+encodeURIComponent(org())+'&_t='+Date.now(),{method:'GET',headers:{},__fresh:true});}
function call(action,body){return bridge().api('/api/agent/mail',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(Object.assign({organization_slug:org(),action:action},body||{})),__fresh:true});}
function toast(m,t){var o=document.querySelector('.mm-toast');if(o)o.remove();var d=document.createElement('div');d.className='mm-toast '+(t||'');d.textContent=m;document.body.appendChild(d);setTimeout(function(){d.remove();},3800);}
var COPY_OPTS=[['sentitems','Sent'],['junkemail','Junk'],['inbox','Inbox'],['none','Don\'t save']];
function copyPref(){try{var v=localStorage.getItem('mdv-mail-copy-to');if(v&&COPY_OPTS.some(function(o){return o[0]===v;}))return v;return localStorage.getItem('mdv-mail-copy')==='0'?'none':'sentitems';}catch(e){return 'sentitems';}}
function setCopyPref(v){try{localStorage.setItem('mdv-mail-copy-to',v);}catch(e){}}
function copySelect(id){var c=copyPref();return '<label class="mm-copy" title="Mail to people outside your domain does not appear in Outlook Sent on its own, so Maison de Veux saves a copy where you choose">Save a copy to <select id="'+id+'">'+COPY_OPTS.map(function(o){return '<option value="'+o[0]+'"'+(o[0]===c?' selected':'')+'>'+o[1]+'</option>';}).join('')+'</select></label>';}
function sentToast(r){if(!r||r.via!=='resend')return 'Sent';var c=r.copy||{};if(c.to==='none')return 'Sent';if(c.ok===false)return 'Sent — the copy could not be saved';var n=({sentitems:'Sent',junkemail:'Junk',inbox:'your inbox'})[c.to];return 'Sent — a copy is in '+n;}
function msg(e){return (e&&e.message)||String(e||'Something went wrong');}
function when(v){var d=v?new Date(v):null;if(!d||isNaN(d))return '';var n=new Date();if(d.toDateString()===n.toDateString())return d.toLocaleTimeString([],{hour:'numeric',minute:'2-digit'});if(n-d<6*864e5)return d.toLocaleDateString([],{weekday:'short'});return d.toLocaleDateString([],{month:'short',day:'numeric',year:d.getFullYear()===n.getFullYear()?undefined:'numeric'});}
function whenFull(v){var d=v?new Date(v):null;return d&&!isNaN(d)?d.toLocaleString([],{weekday:'short',month:'short',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit'}):'';}

/* ---- save to a model profile (see mdv-save-to-model.js) ---- */
function plain(html){return String(html||'').replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ').replace(/&nbsp;/g,' ').replace(/\s+/g,' ').slice(0,6000);}
function saveCtx(m){return {fromName:who(m.from),from:(m.from&&m.from.address)||'',subject:m.subject||'',text:plain(m.body),body:String(m.body||'')};}
function shareLinks(m){
  var found=(String(m.body||'').match(/https:\/\/(?:drive\.google\.com|docs\.google\.com|www\.dropbox\.com|dropbox\.com)\/[^\s"'<>)\]]+/gi)||[]);
  var seen={},n=0;found.forEach(function(u){u=u.replace(/&amp;/g,'&');if(!seen[u]){seen[u]=1;n++;}});
  if(!n)return '';
  return '<div class="mm-links"><small>Shared files in this email</small><button class="mm-btn" data-a="savelinks">Save to a model profile</button></div>';
}
async function attFile(m,id,name){var f=await call('attachment',{id:m.id,attachment_id:id}),bin=atob(f.content_base64),u8=new Uint8Array(bin.length);for(var i=0;i<bin.length;i++)u8[i]=bin.charCodeAt(i);return new File([u8],f.name||name||'attachment',{type:f.content_type||'application/octet-stream'});}
function who(a){return a?(a.name&&a.name!==a.address?a.name:a.address)||'Unknown':'Unknown';}
function size(n){n=Number(n)||0;return n>=1048576?(n/1048576).toFixed(1)+' MB':Math.max(1,Math.round(n/1024))+' KB';}
function initials(n){return String(n||'?').replace(/[^A-Za-z0-9 ]/g,'').split(/\s+/).filter(Boolean).slice(0,2).map(function(x){return x[0];}).join('').toUpperCase()||'?';}

/* ---------- load ---------- */
async function boot(force){
  var seq=++S.seq;S.loading=true;S.err='';if(!S.status)paint();
  try{
    var st=await status();if(seq!==S.seq)return;S.status=st;
    if(st.connected){await loadFolders();if(seq!==S.seq)return;await loadList(true);}
  }catch(e){S.err=msg(e);}
  S.loading=false;paint();startTimer();
  if(S.pendingCompose){var po=S.pendingCompose;S.pendingCompose=false;if(S.status&&S.status.connected)compose(po===true?{}:po);}
  if(S.pendingOpen&&S.status&&S.status.connected){var pid=S.pendingOpen;S.pendingOpen=null;openMessage(pid);}
}
async function loadFolders(){try{var d=await call('folders');S.folders=arr(d.folders);}catch(e){if(e&&/reconnect/i.test(msg(e))){S.status=Object.assign({},S.status,{connected:false,needs_reconnect:true});}else throw e;}}
async function loadList(reset){
  if(!S.status||!S.status.connected)return;
  var token=reset?++S.seq:S.seq,ctx=S.folder+'|'+S.search+'|'+S.unreadOnly;S.listLoading=true;S.listErr='';if(reset){S.messages=[];S.next=null;S.listScroll=0;}paintList();
  try{
    var d=await call('messages',reset?{folder:S.folder,search:S.search,unread_only:S.unreadOnly}:{next:S.next});
    /* a newer search / folder change started while this was loading: drop these results */
    if(token!==S.seq||ctx!==S.folder+'|'+S.search+'|'+S.unreadOnly)return;
    arr(d.messages).forEach(function(m){if(m.from&&m.from.address)S.senders[m.from.address.toLowerCase()]=m.from.name||'';});
    S.messages=reset?arr(d.messages):S.messages.concat(arr(d.messages));S.next=d.next||null;
  }catch(e){S.listErr=msg(e);}
  S.listLoading=false;paintList();
}
async function openMessage(id){
  if(S.compose){if(S.compose.dirty()&&!window.confirm('Discard your draft?'))return;S.compose.close();}
  var had=!!(S.detail&&!S.detail.error&&document.getElementById('mm-reader'));
  S.sel=id;S.reply=null;S.detail=null;S.detailLoading=true;S.showImages=imagesAlways();S.readerOpen=true;
  var mmEl=S.host&&S.host.querySelector('.mm');if(mmEl)mmEl.classList.add('read-open');
  markSelected();
  if(had){var rd=document.getElementById('mm-reader');if(rd)rd.classList.add('mm-busy');}else paintReader();
  try{
    var d=await call('message',{id:id});if(S.sel!==id)return;
    d.message.inline=arr(d.inline_images);S.detail={m:d.message,att:arr(d.attachments)};
    var row=S.messages.filter(function(x){return x.id===id;})[0];
    if(row&&!row.is_read){row.is_read=true;var f=S.folders.filter(function(x){return x.id===S.folder;})[0];if(f&&f.unread>0)f.unread--;}
  }catch(e){S.detail={error:msg(e)};}
  S.detailLoading=false;markSelected();markRead(id);syncFolderBadge();
  var rd2=document.getElementById('mm-reader');if(rd2)rd2.classList.remove('mm-busy');
  paintReader();
}
function startTimer(){
  if(S.timer)return;
  S.timer=setInterval(async function(){
    if(document.hidden||String(window._currentPage||'')!=='mail'||!S.status||!S.status.connected||S.search)return;
    try{await loadFolders();paintSide();
      var d=await call('messages',{folder:S.folder,unread_only:S.unreadOnly});var fresh=arr(d.messages);
      if(fresh.length&&(!S.messages.length||fresh[0].id!==S.messages[0].id)){var have={};S.messages.forEach(function(m){have[m.id]=1;});var add=fresh.filter(function(m){return !have[m.id];});if(add.length){S.messages=add.concat(S.messages);paintList();}}
    }catch(e){}
  },60000);
}

/* ---------- paint ---------- */
function paint(){
  var h=S.host;if(!h)return;
  if(S.loading&&!S.status){h.innerHTML='<div class="mm"><p class="mm-empty">Loading mail…</p></div>';return;}
  if(S.err&&!S.status){h.innerHTML='<div class="mm mm-center"><div class="mm-card"><h2>Mail could not load</h2><p>'+esc(S.err)+'</p><button class="mm-btn gold" data-a="retry">Try again</button></div></div>';wire();return;}
  var st=S.status||{};
  if(!st.configured){
    h.innerHTML='<div class="mm mm-center"><div class="mm-card"><small>MAIL · SETUP NEEDED</small><h2>Email isn\'t connected to Microsoft 365 yet</h2><p>An admin needs to finish a one-time setup before anyone can connect their mailbox. Missing:</p><ul class="mm-miss">'+arr(st.missing).map(function(x){return '<li>'+esc(x)+'</li>';}).join('')+'</ul><p class="mm-fine">Redirect address to register in Microsoft Entra: <code>'+esc(st.redirect_uri||'')+'</code><br>Full steps: <code>agent-portal/docs/mail-setup.md</code></p></div></div>';return;}
  if(st.storage_ok===false){
    h.innerHTML='<div class="mm mm-center"><div class="mm-card"><small>MAIL · SETUP NEEDED</small><h2>One database step is left</h2><p>Run the migration <code>agent-portal/docs/sql/2026-10-07-mail-connections.sql</code> in Supabase, then reload this page.</p></div></div>';return;}
  if(!st.connected){
    var re=!!st.needs_reconnect;
    h.innerHTML='<div class="mm mm-center"><div class="mm-card mm-connect"><small>MAIL</small><h2>'+(re?'Reconnect your email':'Connect your email')+'</h2>'
      +'<p>'+(re?'Your Microsoft sign-in expired or was revoked. Sign in again to keep sending and receiving here.':'Read, send and reply to your Maison de Veux email without leaving the portal. You stay in your own mailbox, and nobody else on the team can see it.')+'</p>'
      +'<ul class="mm-points"><li>Sign in with your Microsoft 365 account'+(st.email?' ('+esc(st.email)+')':'')+'</li><li>The portal can read and send mail <b>as you</b>, nothing else</li><li>Your sign-in is stored encrypted; disconnect any time</li></ul>'
      +'<button class="mm-btn gold" data-a="connect">'+(re?'Reconnect Microsoft 365':'Connect Microsoft 365')+'</button><p class="mm-err" id="mm-conn-err"></p></div></div>';wire();return;}
  h.innerHTML='<div class="mm '+(S.readerOpen?'read-open':'')+'">'
    +'<aside class="mm-side" id="mm-side"></aside><section class="mm-list" id="mm-list"></section><section class="mm-reader" id="mm-reader"></section></div>';
  paintSide();paintList();paintReader();fit();
}
function fit(){
  var h=S.host,mm=h&&h.querySelector('.mm');if(!mm)return;
  if(window.innerWidth<=900){mm.style.height='';return;}
  var top=mm.getBoundingClientRect().top,pad=parseFloat(getComputedStyle(h).paddingBottom)||0;
  mm.style.height=Math.max(480,Math.floor(window.innerHeight-top-pad-14))+'px';
}
window.addEventListener('resize',function(){fit();});
function paintSide(){
  var el=document.getElementById('mm-side');if(!el)return;
  el.innerHTML='<button class="mm-btn gold mm-compose" data-a="compose">+ New message</button><button class="mm-btn mm-savefiles" data-a="savefiles" title="Choose files you downloaded and save them to a model profile">Save files to a model</button>'
    +'<button type="button" class="mm-sigbtn" data-a="signature"><span>✎ Signature</span><em>'+(sigActive()?'On':(sigGet()?'Off':'Not set'))+'</em></button>'+'<nav class="mm-folders">'+S.folders.map(function(f){return '<button class="'+(S.folder===f.id?'on':'')+'" data-a="folder" data-id="'+esc(f.id)+'"><span>'+esc(f.name)+'</span>'+(f.unread?'<em>'+f.unread+'</em>':'')+'</button>';}).join('')+'</nav>'
    +'';
  wire(el);
}
/* Opening an email only needs the selected row and the unread badge updated, not the whole list and sidebar rebuilt. */
function markSelected(){document.querySelectorAll('#mm-list .mm-row').forEach(function(r){r.classList.toggle('on',r.getAttribute('data-id')===S.sel);});}
function markRead(id){var r=document.querySelector('#mm-list .mm-row[data-id="'+String(id).replace(/"/g,'')+'"]');if(r)r.classList.remove('unread');}
function syncFolderBadge(){
  var f=S.folders.filter(function(x){return x.id===S.folder;})[0],b=document.querySelector('#mm-side [data-a="folder"][data-id="'+String(S.folder).replace(/"/g,'')+'"]');
  if(!f||!b)return;var em=b.querySelector('em');
  if(f.unread){if(!em){em=document.createElement('em');b.appendChild(em);}em.textContent=f.unread;}else if(em)em.remove();
}
function paintList(){
  var el=document.getElementById('mm-list');if(!el)return;
  var ae=document.activeElement,hadFocus=!!(ae&&ae.hasAttribute&&ae.hasAttribute('data-q')&&el.contains(ae)),caret=hadFocus?ae.selectionStart:0;
  var cur=el.querySelector('.mm-rows');if(cur)S.listScroll=cur.scrollTop;
  var fname=(S.folders.filter(function(f){return f.id===S.folder;})[0]||{}).name||'Inbox';
  var rows=S.messages.map(function(m){
    var from=S.folder==='sentitems'||S.folder==='drafts'?('To: '+(arr(m.to).map(who).join(', ')||'(no recipients)')):who(m.from);
    return '<button class="mm-row '+(S.sel===m.id?'on ':'')+(m.is_read?'':'unread')+'" data-a="open" data-id="'+esc(m.id)+'"><span class="mm-av">'+esc(initials(from.replace(/^To: /,'')))+'</span><span class="mm-rt"><span class="mm-rtop"><b>'+esc(from)+'</b><time>'+esc(when(m.received))+'</time></span><span class="mm-subj">'+esc(m.subject)+(m.has_attachments?' <i title="Has attachments">📎</i>':'')+'</span><span class="mm-prev">'+esc(m.preview)+'</span></span></button>';
  }).join('');
  el.innerHTML='<header><div class="mm-title"><button class="mm-back" data-a="refresh" title="Refresh" aria-label="Refresh">↻</button><h3>'+esc(fname)+'</h3></div><div class="mm-search"><input type="search" placeholder="Search mail…" value="'+esc(S.search)+'" data-q><label class="mm-chk"><input type="checkbox" data-unread '+(S.unreadOnly?'checked':'')+'> Unread</label></div></header>'
    +'<div class="mm-rows">'+(rows||(S.listLoading?'':'<p class="mm-empty">'+(S.listErr?'':S.search?'No messages match “'+esc(S.search)+'”.':'Nothing here.')+'</p>'))
    +(S.listErr?'<p class="mm-err">'+esc(S.listErr)+' <button class="mm-link" data-a="refresh">Retry</button></p>':'')
    +(S.listLoading?'<p class="mm-empty">Loading…</p>':'')+(S.next&&!S.listLoading?'<button class="mm-btn mm-more" data-a="more">Load more</button>':'')+'</div>';
  wire(el);
  var rowsEl=el.querySelector('.mm-rows');
  if(rowsEl){rowsEl.scrollTop=S.listScroll||0;rowsEl.addEventListener('scroll',function(){S.listScroll=rowsEl.scrollTop;},{passive:true});}
  if(hadFocus){var q=el.querySelector('[data-q]');if(q){q.focus();try{q.setSelectionRange(caret,caret);}catch(e){}}}
}
/* pictures load by default; a person can switch them off (Hide web images) and that choice is remembered */
function imagesAlways(){try{return localStorage.getItem('mdv-mail-images')!=='0';}catch(e){return true;}}
function bodyDoc(m,showImages){
  var csp="default-src 'none'; img-src data: cid:"+(showImages?' https: http:':'')+"; style-src 'unsafe-inline'; font-src data:";
  var inner=m.body_type==='html'?m.body:'<pre style="white-space:pre-wrap;font:inherit">'+esc(m.body)+'</pre>';
  if(m.body_type==='html'){
    var pics={};arr(m.inline).forEach(function(x){if(x&&x.cid&&x.data)pics[String(x.cid).toLowerCase()]='data:'+(x.content_type||'image/png')+';base64,'+x.data;});
    inner=inner.replace(/cid:([^"'\s)>]+)/gi,function(all,id){var k=id;try{k=decodeURIComponent(id);}catch(e){}return pics[k.toLowerCase()]||pics[id.toLowerCase()]||all;})
      .replace(/(<img[^>]+src=["'])\/\//gi,'$1https://');
  }
  return '<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="'+csp+'"><base target="_blank"><style>body{margin:0;padding:18px 22px;font:14px/1.55 -apple-system,Segoe UI,Calibri,Arial,sans-serif;color:#1b1814;background:#fff;word-wrap:break-word}img{max-width:100%;height:auto}a{color:#8c6a2f}blockquote{margin:8px 0;padding-left:12px;border-left:3px solid #ddd;color:#555}table{max-width:100%}</style></head><body>'+inner+'</body></html>';
}
function paintReader(){
  var el=document.getElementById('mm-reader');if(!el)return;
  if(S.compose){mountCompose();return;}
  if(!S.sel){el.innerHTML='<div class="mm-none"><div><span>✉</span><p>Select a message to read it</p></div></div>';return;}
  if(S.detailLoading||!S.detail){el.innerHTML='<div class="mm-none"><p>Opening…</p></div>';return;}
  if(S.detail.error){el.innerHTML='<div class="mm-none"><div><p class="mm-err">'+esc(S.detail.error)+'</p><button class="mm-btn" data-a="close">Back</button></div></div>';wire(el);return;}
  var m=S.detail.m,att=S.detail.att;
  var hasRemote=m.body_type==='html'&&/<img[^>]+src=["']?(https?:)?\/\//i.test(m.body)||/url\(\s*["']?https?:/i.test(m.body);
  el.innerHTML='<header class="mm-rh"><button class="mm-back mm-only-mobile" data-a="close">← Back</button><h2>'+esc(m.subject)+'</h2>'
    +'<div class="mm-from"><span class="mm-av big">'+esc(initials(who(m.from)))+'</span><div><b>'+esc(who(m.from))+'</b> <span>&lt;'+esc(m.from?m.from.address:'')+'&gt;</span><small>To: '+esc(m.to.map(who).join(', ')||'—')+(m.cc.length?' · Cc: '+esc(m.cc.map(who).join(', ')):'')+' · '+esc(whenFull(m.received))+'</small></div></div>'
    +'<div class="mm-actions"><button class="mm-btn mm-thr" id="mm-thr" data-a="thread" hidden></button><button class="mm-btn" data-a="reply">Reply</button><button class="mm-btn" data-a="replyAll">Reply all</button><button class="mm-btn" data-a="forward">Forward</button><span class="mm-sp"></span><button class="mm-btn" data-a="unread">Mark unread</button><button class="mm-btn" data-a="archive">Archive</button><button class="mm-btn danger" data-a="delete">Delete</button>'+(m.web_link?'<a class="mm-btn" href="'+esc(m.web_link)+'" target="_blank" rel="noopener noreferrer">Open in Outlook</a>':'')+'</div>'
    +(att.length?'<div class="mm-atts">'+att.map(function(a){return '<span class="mm-attw"><button class="mm-att" data-a="download" data-id="'+esc(a.id)+'" data-name="'+esc(a.name)+'" title="Download, then choose a model profile to save it to"><i>'+esc((a.name.split('.').pop()||'file').slice(0,4).toUpperCase())+'</i><span>'+esc(a.name)+'</span><em>'+esc(size(a.size))+'</em></button><button class="mm-attsave" data-a="savemodel" data-id="'+esc(a.id)+'" data-name="'+esc(a.name)+'" title="Save straight to a model profile">Save to model</button></span>';}).join('')+(att.length>1?'<button class="mm-btn" data-a="saveall">Save all to a model</button>':'')+'</div>':'')+shareLinks(m)
    +(hasRemote&&!S.showImages?'<div class="mm-imgs">Pictures from the web are hidden. <button class="mm-link" data-a="images">Show images</button> · <button class="mm-link" data-a="images-always">Always show</button></div>':'')+(hasRemote&&S.showImages?'<div class="mm-imgs mm-imgs-on"><button class="mm-link" data-a="images-off">Hide web images</button></div>':'')+'</header>'
    +'<iframe class="mm-body" sandbox="allow-popups allow-popups-to-escape-sandbox" referrerpolicy="no-referrer" title="Message body"></iframe>'
    +'<div class="mm-thread" id="mm-thread" hidden></div>';
  el.querySelector('iframe').srcdoc=bodyDoc(m,S.showImages);
  wire(el);paintReply();loadThread(m.id);
}

/* ---------- conversation: the whole back-and-forth, oldest first ---------- */
function threadOpen(){try{return localStorage.getItem('mdv-mail-thread')==='1';}catch(e){return false;}}
function setThreadOpen(v){try{localStorage.setItem('mdv-mail-thread',v?'1':'0');}catch(e){}}
async function loadThread(id){
  if(S.thread&&S.thread.id===id){paintThread();return;}
  S.thread={id:id,items:[],bodies:{},open:{},loading:true};paintThread();
  try{
    var d=await call('thread',{id:id,conversation_id:(S.detail&&S.detail.m&&S.detail.m.conversation_id)||undefined});if(S.sel!==id)return;
    S.thread.items=arr(d.messages);
  }catch(e){if(S.sel!==id)return;S.thread.items=[];}
  S.thread.loading=false;paintThread();
}
function tBody(id){
  var T=S.thread,m=S.detail&&S.detail.m;
  if(m&&m.id===id)return Promise.resolve(m);
  if(T.bodies[id])return Promise.resolve(T.bodies[id]);
  return call('message',{id:id,inline:false}).then(function(d){d.message.inline=arr(d.inline_images);T.bodies[id]=d.message;return d.message;});
}
function paintThread(){
  var btn=document.getElementById('mm-thr'),box=document.getElementById('mm-thread'),fr=document.querySelector('#mm-reader .mm-body'),T=S.thread;
  if(!btn||!box||!fr)return;
  var n=T&&T.id===S.sel?T.items.length:0;
  if(n<2){btn.hidden=!(T&&T.id===S.sel&&T.loading);if(!btn.hidden){btn.textContent='Conversation…';btn.disabled=true;}box.hidden=true;fr.hidden=false;return;}
  var open=threadOpen();
  btn.hidden=false;btn.disabled=false;btn.textContent='Conversation · '+n;btn.classList.toggle('on',open);
  fr.hidden=open;box.hidden=!open;
  if(!open)return;
  var cur=S.sel,keep=box.scrollTop;
  box.innerHTML='<div class="mm-tbar"><span>'+n+' messages in this conversation, oldest first</span><button class="mm-link" data-t="all">Expand all</button><button class="mm-link" data-t="none">Collapse all</button></div>'
    +T.items.map(function(x){
      var on=x.id===cur||T.open[x.id];
      return '<article class="mm-tc'+(x.mine?' mine':'')+(x.id===cur?' cur':'')+(on?' open':'')+'" data-id="'+esc(x.id)+'"><button class="mm-tch" data-t="toggle" data-id="'+esc(x.id)+'" aria-expanded="'+(on?'true':'false')+'"><span class="mm-av">'+esc(initials(who(x.from)))+'</span><span class="mm-tw"><b>'+esc(x.mine?'You':who(x.from))+'</b>'+(x.id===cur?'<em>Replying to this</em>':'')+'<small>'+esc(on?('To: '+arr(x.to).map(who).join(', ')):x.preview)+'</small></span><time>'+esc(whenFull(x.received))+'</time></button>'+(on?'<iframe class="mm-tcb" sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox" referrerpolicy="no-referrer" title="Message" data-id="'+esc(x.id)+'"></iframe>':'')+'</article>';
    }).join('');
  box.scrollTop=keep;
  box.querySelectorAll('[data-t]').forEach(function(b){b.onclick=function(e){e.stopPropagation();var k=b.dataset.t;
    if(k==='all'){T.items.forEach(function(x){T.open[x.id]=true;});}
    else if(k==='none'){T.open={};}
    else{var id=b.dataset.id;if(id===cur){var c=box.querySelector('.mm-tc[data-id="'+id.replace(/"/g,'')+'"]');c.classList.toggle('open');var f=c.querySelector('iframe');if(f)f.hidden=!c.classList.contains('open');if(!f)paintThreadBodies(box);return;}T.open[id]=!T.open[id];}
    paintThread();};});
  paintThreadBodies(box);
  if(!T.scrolled){T.scrolled=true;var c=box.querySelector('.mm-tc.cur');if(c)setTimeout(function(){box.scrollTop=Math.max(0,c.offsetTop-box.offsetTop-8);},60);}
}
function paintThreadBodies(box){
  box.querySelectorAll('iframe.mm-tcb').forEach(function(f){
    if(f.dataset.done)return;f.dataset.done='1';
    tBody(f.dataset.id).then(function(m){
      if(!f.isConnected)return;
      f.onload=function(){try{f.style.height='24px';var h=f.contentDocument.documentElement.scrollHeight;f.style.height=Math.min(Math.max(h,60),640)+'px';}catch(e){}};
      f.srcdoc=bodyDoc(m,S.showImages);
    }).catch(function(e){if(f.isConnected){f.style.height='auto';f.srcdoc='<p style="font:13px sans-serif;color:#a33;padding:14px">'+esc(msg(e))+'</p>';}});
  });
}

/* ---------- interactions ---------- */
function wire(root){
  (root||S.host).querySelectorAll('[data-a]').forEach(function(b){b.onclick=function(e){e.stopPropagation();act(b.dataset.a,b);};});
  var q=(root||S.host).querySelector('[data-q]');
  if(q){var t;q.oninput=function(){clearTimeout(t);t=setTimeout(function(){S.search=q.value.trim();loadList(true);},450);};}
  var u=(root||S.host).querySelector('[data-unread]');if(u)u.onchange=function(){S.unreadOnly=u.checked;loadList(true);};
}
async function act(a,b){
  try{
    if(a==='retry'){S.status=null;S.err='';boot();return;}
    if(a==='connect'){b.disabled=true;b.textContent='Opening Microsoft…';var d=await call('connect_url');window.location.href=d.url;return;}
    if(a==='folder'){S.folder=b.dataset.id;S.sel=null;S.detail=null;S.readerOpen=false;S.search='';S.unreadOnly=false;paintSide();paintReader();loadList(true);return;}
    if(a==='refresh'){await loadFolders();paintSide();loadList(true);return;}
    if(a==='more'){loadList(false);return;}
    if(a==='open'){openMessage(b.dataset.id);return;}
    if(a==='close'){S.readerOpen=false;S.sel=null;S.detail=null;paint();return;}
    if(a==='compose'){compose({});return;}
    if(a==='images'){S.showImages=true;paintReader();return;}
    if(a==='images-always'){try{localStorage.setItem('mdv-mail-images','1');}catch(e){}S.showImages=true;paintReader();return;}
    if(a==='images-off'){try{localStorage.setItem('mdv-mail-images','0');}catch(e){}S.showImages=false;paintReader();toast('Web images are hidden. Use Show images or Always show to turn them back on.');return;}
    if(a==='signature'){sigEditor();return;}
    if(a==='thread'){setThreadOpen(!threadOpen());paintThread();return;}
    var m=S.detail&&S.detail.m;
    if(a==='disconnect'){if(!window.confirm('Disconnect your email from the portal? Your mailbox itself is not touched.'))return;await call('disconnect');S.status=Object.assign({},S.status,{connected:false});S.folders=[];S.messages=[];S.sel=null;S.detail=null;paint();toast('Email disconnected');return;}
    if(a==='savemodel'){if(!m||!window.MDV_SAVE)return;b.disabled=true;try{var sf=await attFile(m,b.dataset.id,b.dataset.name);MDV_SAVE.open({files:[sf],context:saveCtx(m)});}catch(e){toast((e&&e.message)||'That attachment cannot be saved here. Download it from Outlook and drop it into the Save to model window.');MDV_SAVE.open({files:[],context:saveCtx(m)});}b.disabled=false;return;}
    if(a==='saveall'){if(!m||!window.MDV_SAVE)return;b.disabled=true;var got=[],failed=0;for(var ai=0;ai<S.detail.att.length;ai++){try{got.push(await attFile(m,S.detail.att[ai].id,S.detail.att[ai].name));}catch(e){failed++;}}b.disabled=false;if(failed)toast(failed+' attachment'+(failed===1?'':'s')+' could not be fetched here (too large?). Download '+(failed===1?'it':'them')+' and drop '+(failed===1?'it':'them')+' into the window.');MDV_SAVE.open({files:got,context:saveCtx(m)});return;}
    if(a==='savelinks'){if(!m||!window.MDV_SAVE)return;MDV_SAVE.open({files:[],context:saveCtx(m)});return;}
    if(a==='savefiles'){if(window.MDV_SAVE)MDV_SAVE.pick(m?saveCtx(m):null);return;}
    if(a==='download'){if(!m)return;b.disabled=true;var f=await call('attachment',{id:m.id,attachment_id:b.dataset.id});b.disabled=false;var bin=atob(f.content_base64),u8=new Uint8Array(bin.length);for(var i=0;i<bin.length;i++)u8[i]=bin.charCodeAt(i);var url=URL.createObjectURL(new Blob([u8],{type:f.content_type||'application/octet-stream'})),link=document.createElement('a');link.href=url;link.download=f.name||b.dataset.name||'attachment';document.body.appendChild(link);link.click();link.remove();setTimeout(function(){URL.revokeObjectURL(url);},4000);if(window.MDV_SAVE){try{MDV_SAVE.open({files:[new File([u8],f.name||b.dataset.name||'attachment',{type:f.content_type||'application/octet-stream'})],context:saveCtx(m)});}catch(_s){}}return;}
    if(!m)return;
    if(a==='reply'||a==='replyAll'||a==='forward'){openReply(a,m);return;}
    if(a==='unread'){await call('mark_read',{id:m.id,read:false});var r=S.messages.filter(function(x){return x.id===m.id;})[0];if(r)r.is_read=false;var fo=S.folders.filter(function(x){return x.id===S.folder;})[0];if(fo)fo.unread++;paintList();paintSide();toast('Marked unread');return;}
    if(a==='archive'||a==='delete'){
      if(a==='delete'&&!window.confirm('Move this message to Deleted?'))return;
      await call(a,{id:m.id});S.messages=S.messages.filter(function(x){return x.id!==m.id;});S.sel=null;S.detail=null;S.readerOpen=false;paint();loadFolders().then(paintSide);toast(a==='archive'?'Archived':'Moved to Deleted');return;}
  }catch(e){toast(msg(e),'bad');if(b)b.disabled=false;if(/reconnect/i.test(msg(e))){S.status=Object.assign({},S.status,{connected:false,needs_reconnect:true});paint();}}
}

/* ---------- inline reply (sits under the message; nothing pops over it) ---------- */
function replyTo(mode,m){
  if(mode==='forward')return '';
  if(mode==='reply')return m.reply_to&&m.reply_to[0]?m.reply_to[0].address:(m.from&&m.from.address)||'';
  var me=String(S.status.email||'').toLowerCase();
  return [m.from&&m.from.address].concat(m.to.map(function(x){return x.address;})).filter(function(x,i,a){return x&&x.toLowerCase()!==me&&a.indexOf(x)===i;}).join(', ');
}
function replyCc(mode,m,to){
  if(mode!=='replyAll')return '';
  var me=String(S.status.email||'').toLowerCase(),inTo=String(to||'').toLowerCase().split(/[,;]\s*/);
  return m.cc.map(function(x){return x.address;}).filter(function(x,i,a){return x&&x.toLowerCase()!==me&&inTo.indexOf(x.toLowerCase())<0&&a.indexOf(x)===i;}).join(', ');
}
function openReply(mode,m){
  var keep=S.reply&&S.reply.id===m.id?S.reply.text:'';
  var rto=replyTo(mode,m);S.reply={id:m.id,mode:mode,to:rto,cc:S.reply&&S.reply.id===m.id&&S.reply.mode===mode?S.reply.cc:replyCc(mode,m,rto),text:keep};
  paintReply(true);
}
function paintReply(focus){
  var el=document.getElementById('mm-reader'),old=document.getElementById('mm-reply');if(old)old.remove();
  var r=S.reply,m=S.detail&&S.detail.m;if(!el||!r||!m||m.id!==r.id)return;
  var label=r.mode==='replyAll'?'Reply all':r.mode==='forward'?'Forward':'Reply';
  var d=document.createElement('div');d.id='mm-reply';d.className='mm-reply';
  d.innerHTML='<div class="mm-rr-to"><b>'+label+'</b><input id="mm-rto" list="mm-sug" value="'+esc(r.to)+'" placeholder="name@example.com, …" autocomplete="off" aria-label="To"><button type="button" class="mm-rr-x" data-rx aria-label="Discard reply">×</button></div>'
    +'<div class="mm-rr-to mm-rr-cc"><b>Cc</b><input id="mm-rcc" list="mm-sug" value="'+esc(r.cc||'')+'" placeholder="Add people to copy (optional)" autocomplete="off" aria-label="Cc"></div>'
    +'<textarea id="mm-rtext" rows="5" placeholder="'+(r.mode==='forward'?'Add a note (optional) — the original message is included below automatically.':'Write your reply — the original message is quoted below automatically.')+'"></textarea>'
    +'<div id="mm-rsig"></div><datalist id="mm-sug">'+sugOptions()+'</datalist>'
    +'<div class="mm-rr-foot"><span class="mm-err" id="mm-rerr"></span>'+copySelect('mm-rcopy')+'<button type="button" class="mm-btn" data-rx>Discard</button><button type="button" class="mm-btn gold" id="mm-rsend">Send</button></div>';
  el.appendChild(d);
  if(!r.sig)r.sig={};var rs=d.querySelector('#mm-rsig');rs.innerHTML=sigStrip(r.sig);sigWire(rs,r.sig);
  var ta=d.querySelector('#mm-rtext'),to=d.querySelector('#mm-rto'),cc=d.querySelector('#mm-rcc');
  ta.value=r.text||'';ta.oninput=function(){r.text=ta.value;};to.oninput=function(){r.to=to.value;};cc.oninput=function(){r.cc=cc.value;};
  d.querySelectorAll('[data-rx]').forEach(function(b){b.onclick=function(){if(ta.value.trim()&&!window.confirm('Discard this reply?'))return;S.reply=null;paintReply();};});
  d.querySelector('#mm-rsend').onclick=async function(){
    var btn=this,err=d.querySelector('#mm-rerr');err.textContent='';
    try{
      if(!to.value.trim())throw new Error('Add at least one recipient.');
      if(r.mode!=='forward'&&!ta.value.trim())throw new Error('Write a message first.');
      btn.disabled=true;btn.textContent='Sending…';
      setCopyPref(d.querySelector('#mm-rcopy').value);var sv=await call('reply',{id:m.id,mode:r.mode,to:to.value.trim(),cc:cc.value.trim(),text:ta.value,copy_to:d.querySelector('#mm-rcopy').value,signature:(r.sig.on!==false?sigActive():null)});
      S.reply=null;S.thread=null;paintReply();loadThread(m.id);toast(sentToast(sv));if(S.folder==='sentitems')loadList(true);
    }catch(e){err.textContent=msg(e);btn.disabled=false;btn.textContent='Send';}
  };
  if(focus)setTimeout(function(){(to.value?ta:to).focus();},30);
}

/* ---------- signature ---------- */
var SIGKEY='mdv-mail-signature';
function sigLocal(){try{return JSON.parse(localStorage.getItem(SIGKEY)||'null');}catch(e){return null;}}
function sigGet(){var s=(S.status&&S.status.signature)||sigLocal();return s&&typeof s==='object'?s:null;}
function sigHas(s){return !!(s&&(s.name||s.title||s.company||s.phone||s.email||s.website||s.address||s.note));}
function sigActive(){var s=sigGet();return s&&s.enabled!==false&&sigHas(s)?s:null;}
function sigDefaults(){var st=S.status||{};return {enabled:true,name:st.display_name||'',title:'',company:'Maison de Veux',phone:'',email:st.email||'',website:'www.maisondeveux.com',address:'',note:''};}
function sigHtml(s){
  if(!sigHas(s))return '';
  var contact=[s.phone?esc(s.phone):'',s.email?'<a>'+esc(s.email)+'</a>':'',s.website?'<a>'+esc(s.website)+'</a>':''].filter(Boolean).join(' &nbsp;·&nbsp; ');
  return '<div class="sg"><div class="sg-n">'+esc(s.name||'')+'</div>'+(s.title?'<div class="sg-t">'+esc(s.title)+'</div>':'')+(s.company?'<div class="sg-c">'+esc(s.company)+'</div>':'')+(contact?'<div class="sg-k">'+contact+'</div>':'')+(s.address?'<div class="sg-k">'+esc(s.address)+'</div>':'')+(s.note?'<div class="sg-o">'+esc(s.note)+'</div>':'')+'</div>';
}
/* the little "Signature" strip under a message being written; `st` remembers whether it is switched on for this message */
function sigStrip(st){
  var a=sigActive();
  if(!a)return '<div class="mm-sigbox"><button type="button" class="mm-link" data-sig-edit>+ Add a signature</button></div>';
  if(st.on===undefined)st.on=true;
  return '<div class="mm-sigbox"><label class="mm-sigtog"><input type="checkbox" data-sig-on'+(st.on?' checked':'')+'> Signature</label><button type="button" class="mm-link" data-sig-edit>Edit</button>'+(st.on?'<div class="mm-sigprev">'+sigHtml(a)+'</div>':'')+'</div>';
}
function sigWire(box,st){
  var on=box.querySelector('[data-sig-on]');if(on)on.onchange=function(){st.on=on.checked;box.innerHTML=sigStrip(st);sigWire(box,st);};
  var ed=box.querySelector('[data-sig-edit]');if(ed)ed.onclick=function(){sigEditor();};
}
function sigPaintAll(){
  [[document.getElementById('mm-sig'),S.compose&&S.compose.sig],[document.getElementById('mm-rsig'),S.reply&&S.reply.sig]].forEach(function(x){if(x[0]&&x[1]){x[0].innerHTML=sigStrip(x[1]);sigWire(x[0],x[1]);}});
  var b=document.querySelector('.mm-sigbtn em');if(b)b.textContent=sigActive()?'On':(sigGet()?'Off':'Not set');
}
function sigEditor(){
  var cur=Object.assign(sigDefaults(),sigGet()||{}),o=document.createElement('div');o.className='mm-modal-back';
  function f(id,label,ph,val){return '<label>'+label+'<input id="sg-'+id+'" maxlength="140" placeholder="'+esc(ph||'')+'" value="'+esc(val||'')+'"></label>';}
  o.innerHTML='<form class="mm-modal mm-sigm" role="dialog" aria-modal="true" aria-label="Email signature"><header><div><small>MAIL</small><h2>Your signature</h2></div><button type="button" data-x aria-label="Close">×</button></header>'
    +'<div class="mm-form"><div class="mm-ccrow">'+f('name','Name','Full name',cur.name)+f('title','Title','e.g. Founder',cur.title)+'</div>'
    +'<div class="mm-ccrow">'+f('company','Company','',cur.company)+f('phone','Phone','+1 …',cur.phone)+'</div>'
    +'<div class="mm-ccrow">'+f('email','Email','',cur.email)+f('website','Website','',cur.website)+'</div>'
    +f('address','Address','e.g. New York · Paris',cur.address)+f('note','Small print (optional)','e.g. Confidential',cur.note)
    +'<label class="mm-sigon"><input type="checkbox" id="sg-enabled"'+(cur.enabled!==false?' checked':'')+'> Add it automatically to new messages, replies and forwards</label>'
    +'<div class="mm-sigpv"><small>Preview</small><div id="sg-prev"></div></div></div>'
    +'<footer class="mm-sigf"><span class="mm-err" id="sg-err"></span><button type="button" class="mm-btn" data-x>Cancel</button><button type="submit" class="mm-btn gold">Save signature</button></footer></form>';
  document.body.appendChild(o);var form=o.querySelector('form');
  function read(){var v={enabled:form.querySelector('#sg-enabled').checked};['name','title','company','phone','email','website','address','note'].forEach(function(k){v[k]=form.querySelector('#sg-'+k).value.trim();});return v;}
  function prev(){var v=read();form.querySelector('#sg-prev').innerHTML=sigHas(v)?sigHtml(v):'<p class="mm-wfine">Fill in your details to see the signature.</p>';}
  form.addEventListener('input',prev);prev();setTimeout(function(){form.querySelector('#sg-name').focus();},30);
  function close(){o.remove();}
  o.addEventListener('click',function(e){if(e.target===o||e.target.closest('[data-x]'))close();});
  o.addEventListener('keydown',function(e){if(e.key==='Escape')close();});
  form.onsubmit=async function(e){
    e.preventDefault();var v=read(),btn=form.querySelector('[type=submit]'),err=form.querySelector('#sg-err');err.textContent='';
    if(v.email&&!EMAIL_RE.test(v.email)){err.textContent='That email address does not look right.';return;}
    btn.disabled=true;btn.textContent='Saving…';
    try{localStorage.setItem(SIGKEY,JSON.stringify(v));}catch(x){}
    S.status=Object.assign({},S.status,{signature:v});
    var note='Signature saved';
    try{await call('signature_save',{signature:v});}
    catch(x){note=/this device only/i.test(msg(x))?'Signature saved on this device. '+msg(x).replace(/^Saved on this device only\.\s*/,''):'Signature saved on this device (could not sync: '+msg(x)+')';}
    close();sigPaintAll();toast(note);
  };
}
/* ---------- compose (new message) ---------- */
function readFile(f){return new Promise(function(res,rej){var r=new FileReader();r.onload=function(){res({name:f.name,content_type:f.type||'application/octet-stream',content_base64:String(r.result).split(',')[1]||''});};r.onerror=function(){rej(new Error('Could not read '+f.name));};r.readAsDataURL(f);});}
function inMail(){return String(window._currentPage||'')==='mail'&&!!document.getElementById('mm-reader');}
function mountCompose(){
  var r=document.getElementById('mm-reader'),c=S.compose&&S.compose.el;if(!r||!c)return;
  if(c.parentNode!==r){r.innerHTML='';r.appendChild(c);}
  var mm=r.closest('.mm');if(mm)mm.classList.add('read-open');
}
/* New message opens in the reading pane of the Mail page (no floating window). From any other page it takes you to Mail first. */
function compose(o){
  o=o||{};
  if(S.compose){
    if(S.compose.dirty()&&!window.confirm('Discard your current draft and start a new message?')){if(!inMail()&&typeof window.navTo==='function')window.navTo('mail');return;}
    S.compose.close();
  }
  if(!inMail()){
    S.pendingCompose=o;
    if(String(window._currentPage||'')!=='mail'){if(typeof window.navTo==='function')window.navTo('mail');else window.location.href='mailto:'+encodeURIComponent(o.to||'');}
    return;
  }
  var from=String((S.status&&S.status.email)||'');
  var back=document.createElement('section');back.id='mm-modal';back.className='mmx mmx-pane';back.setAttribute('role','dialog');back.setAttribute('aria-label','New message');
  function row(id,label,extra){return '<div class="mmx-row" data-f="'+id+'"'+(extra||'')+'><span class="mmx-lab">'+label+'</span><div class="mmx-chips"><input class="mmx-in" id="mm-'+id+'-in" list="mm-sug" autocomplete="off" placeholder="'+(id==='to'?'Add recipients':'')+'" aria-label="'+label+'"></div><input type="hidden" id="mm-'+id+'">'+(id==='to'?'<span class="mmx-tog"><button type="button" data-show="cc">Cc</button><button type="button" data-show="bcc">Bcc</button></span>':'')+'</div>';}
  back.innerHTML='<header class="mmx-h"><div><b>New message</b>'+(from?'<span>From '+esc(from)+'</span>':'')+'</div><span class="mmx-hb"><button type="button" data-x aria-label="Close" title="Close">×</button></span></header>'
    +'<div class="mmx-body">'+row('to','To')+row('cc','Cc',' hidden')+row('bcc','Bcc',' hidden')
    +'<div class="mmx-row"><span class="mmx-lab">Subject</span><input class="mmx-in grow" id="mm-subject" maxlength="300" placeholder="What is this about?" autocomplete="off"></div>'
    +'<textarea id="mm-text" class="mmx-text" placeholder="Write your message…" aria-label="Message"></textarea><div id="mm-sig"></div>'
    +'<div class="mmx-files" id="mm-files" hidden></div>'
    +'<datalist id="mm-sug">'+sugOptions()+'</datalist></div>'
    +'<p class="mm-err" id="mm-cerr"></p>'
    +'<footer class="mmx-f"><button type="button" class="mm-btn gold" id="mm-send">Send</button><button type="button" class="mm-btn" data-x>Cancel</button><span class="mmx-tools"><button type="button" class="mmx-attach" id="mm-addfile"><span aria-hidden="true">📎</span> Attach</button><input type="file" id="mm-file" multiple hidden>'+copySelect('mm-copy')+'</span><span class="mmx-hint">Ctrl/⌘ + Enter to send</span></footer>';
  var files=[],sentVia=null,$=function(q){return back.querySelector(q);};
  var BAD=function(a){return !EMAIL_RE.test(a);};

  /* recipient chips: type or paste addresses; comma, semicolon, Enter or leaving the box turns them into chips */
  function chipField(id){
    var rowEl=$('[data-f="'+id+'"]'),inp=$('#mm-'+id+'-in'),hid=$('#mm-'+id),box=rowEl.querySelector('.mmx-chips'),list=[];
    function sync(){hid.value=list.join(', ');}
    function paint(){
      box.querySelectorAll('.mmx-chip').forEach(function(n){n.remove();});
      list.forEach(function(a,i){var c=document.createElement('span');c.className='mmx-chip'+(BAD(a)?' bad':'');c.title=BAD(a)?'This does not look like an email address':a;
        var t=document.createElement('span');t.textContent=a;var x=document.createElement('button');x.type='button';x.setAttribute('aria-label','Remove '+a);x.textContent='×';
        x.onclick=function(){list.splice(i,1);paint();inp.focus();};c.appendChild(t);c.appendChild(x);box.insertBefore(c,inp);});
      sync();
    }
    function add(raw){String(raw||'').split(/[,;\n]+/).forEach(function(part){var t=part.trim();if(!t)return;var m=t.match(/<([^>]+)>\s*$/);if(m)t=m[1].trim();if(t&&list.map(function(x){return x.toLowerCase();}).indexOf(t.toLowerCase())<0)list.push(t);});paint();}
    function commit(){if(inp.value.trim()){add(inp.value);inp.value='';}}
    inp.addEventListener('input',function(e){
      var v=inp.value;
      if(/[,;]\s*$/.test(v)||(/\s$/.test(v)&&EMAIL_RE.test(v.trim()))||(e&&e.inputType==='insertReplacementText'&&EMAIL_RE.test(v.trim()))||(e&&!e.inputType&&EMAIL_RE.test(v.trim())))commit();
    });
    inp.addEventListener('paste',function(){setTimeout(commit,0);});
    inp.addEventListener('keydown',function(e){
      if(e.key==='Enter'&&inp.value.trim()&&!(e.metaKey||e.ctrlKey)){e.preventDefault();commit();}
      else if(e.key==='Backspace'&&!inp.value&&list.length){list.pop();paint();}
    });
    inp.addEventListener('blur',commit);
    box.addEventListener('mousedown',function(e){if(e.target===box){e.preventDefault();inp.focus();}});
    return {add:add,commit:commit,get:function(){commit();return list.slice();},has:function(){return list.length>0||!!inp.value.trim();}};
  }
  var F={to:chipField('to'),cc:chipField('cc'),bcc:chipField('bcc')};
  function reveal(id){var r=$('[data-f="'+id+'"]');r.hidden=false;var tg=$('[data-show="'+id+'"]');if(tg)tg.hidden=true;return r;}
  back.querySelectorAll('[data-show]').forEach(function(b){b.onclick=function(){var r=reveal(b.dataset.show);r.querySelector('.mmx-in').focus();};});
  if(o.to)F.to.add(o.to);
  if(o.bcc){F.bcc.add(o.bcc);reveal('bcc');}
  if(o.subject)$('#mm-subject').value=o.subject;
  if(o.text)$('#mm-text').value=o.text;

  function dirty(){return $('#mm-text').value.trim()||F.to.has()||F.cc.has()||F.bcc.has()||$('#mm-subject').value.trim()||files.length;}
  function close(){
    document.removeEventListener('keydown',onKey,true);S.compose=null;back.remove();
    var mm=S.host&&S.host.querySelector('.mm');if(mm&&!S.sel)mm.classList.remove('read-open');
    paintReader();
  }
  function tryClose(){if(dirty()&&!window.confirm('Discard this message?'))return;close();}
  function onKey(e){
    if(!back.offsetParent)return;
    if(e.key==='Escape'){e.stopPropagation();tryClose();}
    else if(e.key==='Enter'&&(e.metaKey||e.ctrlKey)){e.preventDefault();$('#mm-send').click();}
  }
  document.addEventListener('keydown',onKey,true);
  back.querySelectorAll('[data-x]').forEach(function(x){x.onclick=tryClose;});

  /* attachments */
  function paintFiles(){
    var box=$('#mm-files'),tot=files.reduce(function(n,f){return n+f.size;},0);
    box.hidden=!files.length;box.innerHTML='';
    files.forEach(function(f,i){var c=document.createElement('span');c.className='mmx-file';var n=document.createElement('span');n.textContent=f.name;var z=document.createElement('em');z.textContent=size(f.size);var x=document.createElement('button');x.type='button';x.setAttribute('aria-label','Remove '+f.name);x.textContent='×';x.onclick=function(){files.splice(i,1);paintFiles();};c.appendChild(n);c.appendChild(z);c.appendChild(x);box.appendChild(c);});
    if(files.length){var t=document.createElement('small');t.textContent=files.length+' of 8 · '+size(tot)+' of 3 MB';if(tot>3*1048576)t.className='over';box.appendChild(t);}
  }
  $('#mm-addfile').onclick=function(){$('#mm-file').click();};
  $('#mm-file').onchange=function(){files=files.concat([].slice.call(this.files)).slice(0,8);this.value='';paintFiles();};

  ensureDirectory(function(){var dl=back.querySelector('#mm-sug');if(dl)dl.innerHTML=sugOptions();});
  var sigState={};S.compose={el:back,dirty:function(){return !!dirty();},close:close,sig:sigState};var sb=$('#mm-sig');sb.innerHTML=sigStrip(sigState);sigWire(sb,sigState);
  mountCompose();
  setTimeout(function(){var f=!F.to.has()?$('#mm-to-in'):(!$('#mm-subject').value?$('#mm-subject'):$('#mm-text'));f.focus();},60);

  $('#mm-send').onclick=async function(){
    var btn=this,err=$('#mm-cerr');err.textContent='';
    try{
      var to=F.to.get(),cc=F.cc.get(),bcc=F.bcc.get(),text=$('#mm-text').value;
      var bad=to.concat(cc,bcc).filter(BAD);
      if(!to.length)throw new Error('Add at least one recipient.');
      if(bad.length)throw new Error('"'+bad[0]+'" is not a valid email address. Remove it or fix it.');
      var tot=files.reduce(function(n,f){return n+f.size;},0);if(tot>3*1048576)throw new Error('Attachments are over 3 MB in total.');
      if(!$('#mm-subject').value.trim()&&!text.trim())throw new Error('Write a subject or a message first.');
      setCopyPref($('#mm-copy').value);btn.disabled=true;btn.textContent='Sending…';
      var atts=await Promise.all(files.map(readFile));
      sentVia=await call('send',{to:to.join(', '),cc:cc.join(', '),bcc:bcc.join(', '),subject:$('#mm-subject').value,text:text,attachments:atts,copy_to:$('#mm-copy').value,signature:(sigState.on!==false?sigActive():null)});
      close();toast(sentToast(sentVia));if(S.folder==='sentitems')loadList(true);
    }catch(e){err.textContent=msg(e);btn.disabled=false;btn.textContent='Send';}
  };
}

/* ---------- Settings → Email card (connection lives here, not in the mailbox) ---------- */
function cardHtml(st,err){
  var body;
  if(err)body='<p class="mm-err">'+esc(err)+'</p>';
  else if(!st)body='<p class="mm-fine">Checking…</p>';
  else if(!st.configured)body='<p class="mm-fine">Email isn\'t set up for the portal yet. An admin needs to add: <b>'+esc(arr(st.missing).join(', '))+'</b> (see <code>docs/mail-setup.md</code>).</p>';
  else if(st.storage_ok===false)body='<p class="mm-fine">One database step is left: run <code>docs/sql/2026-10-07-mail-connections.sql</code> in Supabase.</p>';
  else if(st.connected)body='<div class="mm-setrow"><div><small>CONNECTED AS</small><b>'+esc(st.email||'')+'</b><span>'+esc(st.display_name||'')+'</span></div><div class="mm-setbtns"><button type="button" class="mm-btn" data-set="open">Open Mail</button><button type="button" class="mm-btn danger" data-set="disconnect">Disconnect</button></div></div>';
  else body='<div class="mm-setrow"><div><b>'+(st.needs_reconnect?'Your Microsoft sign-in expired':'No mailbox connected')+'</b><span>'+(st.needs_reconnect?'Sign in again to keep sending and receiving email in the portal.':'Connect your Microsoft 365 account to read and send email here. Only you can see your mailbox.')+'</span></div><div class="mm-setbtns"><button type="button" class="mm-btn gold" data-set="connect">'+(st.needs_reconnect?'Reconnect Microsoft 365':'Connect Microsoft 365')+'</button></div></div>';
  return '<header><div><span>EMAIL · MICROSOFT 365</span><p>Your own mailbox for the Mail page.</p></div></header>'+body;
}
function mountSettingsCard(panel){
  var page=panel.querySelector('.v152-page');if(!page||page.querySelector('[data-mdv-mail-card]'))return;
  var card=document.createElement('div');card.className='v152-card mm-setcard';card.setAttribute('data-mdv-mail-card','1');card.innerHTML=cardHtml(null);
  var anchor=page.querySelector('#vx-wave-settings');
  if(anchor)page.insertBefore(card,anchor);else page.appendChild(card);
  function draw(st,err){card.innerHTML=cardHtml(st,err);
    card.querySelectorAll('[data-set]').forEach(function(b){b.onclick=async function(){
      try{
        if(b.dataset.set==='open'){if(typeof window.navTo==='function')window.navTo('mail');return;}
        if(b.dataset.set==='connect'){b.disabled=true;b.textContent='Opening Microsoft…';var d=await call('connect_url');window.location.href=d.url;return;}
        if(b.dataset.set==='disconnect'){if(!window.confirm('Disconnect your email from the portal? Your mailbox itself is not touched.'))return;b.disabled=true;await call('disconnect');S.status=null;S.folders=[];S.messages=[];S.sel=null;S.detail=null;toast('Email disconnected');W.at=0;load();}
      }catch(e){toast(msg(e),'bad');b.disabled=false;}
    };});}
  function load(){status().then(function(st){draw(st);}).catch(function(e){draw(null,msg(e));});}
  load();
}
(function watchSettings(){
  var n=0,t=setInterval(function(){
    var panel=document.getElementById('p-systemsettings');
    if(panel){clearInterval(t);
      var run=function(){try{mountSettingsCard(panel);}catch(e){}};
      new MutationObserver(run).observe(panel,{childList:true,subtree:true});run();}
    else if(++n>120)clearInterval(t);
  },500);
})();



/* ---------- address book + "email anyone" ---------- */
var DIR={map:{},at:0,busy:false,cbs:[]};
function sugOptions(){var all=Object.assign({},DIR.map,S.senders);return Object.keys(all).slice(0,500).map(function(a){return '<option value="'+esc(a)+'">'+esc(all[a]||'')+'</option>';}).join('');}
function crm(force){
  var shared=window.MDV_CRM_CACHE;if(shared&&shared.data&&(!W_crm.data||shared.at>W_crm.at)){W_crm.data=shared.data;W_crm.at=shared.at;}
  if(!force&&W_crm.data&&Date.now()-W_crm.at<300000)return Promise.resolve(W_crm.data);
  if(W_crm.p)return W_crm.p;
  W_crm.p=bridge().api('/api/agent/crm/v9?organization='+encodeURIComponent(org())+'&_t='+Date.now(),{method:'GET',headers:{},__fresh:true}).then(function(d){W_crm.data=d||{};W_crm.at=Date.now();W_crm.p=null;return W_crm.data;},function(e){W_crm.p=null;throw e;});
  return W_crm.p;
}
var W_crm={data:null,at:0,p:null};
function ensureDirectory(cb){
  if(DIR.at&&Date.now()-DIR.at<300000){cb&&cb();return;}
  crm().then(function(d){
    arr(d.contacts).forEach(function(c){var e=String(c.email||'').trim().toLowerCase();if(EMAIL_RE.test(e))DIR.map[e]=c.display_name||'';});
    DIR.at=Date.now();cb&&cb();
  }).catch(function(){});
}
var EMAIL_RE=/^[^\s@<>()",;:]+@[^\s@<>()",;:]+\.[A-Za-z]{2,}$/;
async function emailTo(list,o){
  o=o||{};
  var addrs=(Array.isArray(list)?list:String(list||'').split(/[,;]/)).map(function(x){return String(x||'').trim();}).filter(function(x,i,a){return EMAIL_RE.test(x)&&a.indexOf(x)===i;});
  if(!addrs.length&&!o.blank)return false;
  var fallback=function(){window.location.href='mailto:'+addrs.join(',')+(o.subject?'?subject='+encodeURIComponent(o.subject):'');return false;};
  try{
    if(!S.status||S.status.connected===undefined){var st=await status();S.status=Object.assign({},S.status,st);}
    if(!S.status.connected){
      toast(S.status.configured===false?'Portal email isn\'t set up yet — opening your mail app':'Connect your mailbox in Settings → Email to send from the portal — opening your mail app','bad');
      setTimeout(fallback,900);return false;
    }
  }catch(e){return fallback();}
  if(!addrs.length){compose({to:'',subject:o.subject||'',text:o.text||''});return true;}
  if(addrs.length>1&&!o.to_all){
    /* Several people: send to yourself and Bcc everyone so clients never see each other. */
    compose({to:String(S.status.email||''),bcc:addrs.join(', '),subject:o.subject||'',text:o.text||''});
  }else compose({to:addrs.join(', '),subject:o.subject||'',text:o.text||''});
  return true;
}
(function globalEmailLinks(){
  var BLOCK='button,[role="button"],[tabindex],input,textarea,select,[contenteditable],iframe,.mm,#mm-modal,a[href]:not([href^="mailto:"])';
  function plainEmail(t){
    if(!t||t.nodeType!==1||t.children.length||t.closest(BLOCK))return '';
    var v=(t.textContent||'').trim();return v.length<120&&EMAIL_RE.test(v)?v:'';
  }
  document.addEventListener('click',function(e){
    if(e.defaultPrevented||e.button!==0||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey)return;
    var t=e.target;if(!t||!t.closest)return;
    var a=t.closest('a[href^="mailto:"]');
    if(a){
      if(a.closest('#mm-modal'))return;
      var h=a.getAttribute('href').slice(7),q=h.indexOf('?'),addr=decodeURIComponent(q<0?h:h.slice(0,q)),subj='';
      if(q>=0){try{subj=new URLSearchParams(h.slice(q+1)).get('subject')||'';}catch(x){}}
      if(!window.VEUX_AGENT_V4)return;
      e.preventDefault();emailTo(addr,{subject:subj});return;
    }
    var em=plainEmail(t);
    if(em&&window.VEUX_AGENT_V4){e.preventDefault();emailTo(em);}
  });
  /* Buttons that carry an address (Companies & Clients → Email Contact, and anything marked data-email-to). */
  document.addEventListener('click',function(e){
    var b=e.target&&e.target.closest&&e.target.closest('[data-cc49-emailcontact],[data-email-to]');
    if(!b||!window.VEUX_AGENT_V4||(e.button!==0&&e.button!==undefined))return;
    var addr=b.getAttribute('data-email-to')||b.getAttribute('data-cc49-emailcontact');
    if(!addr)return;
    e.preventDefault();e.stopImmediatePropagation();emailTo(addr);
  },true);
  document.addEventListener('mouseover',function(e){var t=e.target;if(plainEmail(t)&&!t.classList.contains('mdv-emailable'))t.classList.add('mdv-emailable');});
})();

/* ---------- Home page widget (Agency Command → Mail) ---------- */
var W={data:null,at:0,busy:false};
function widgetHtml(){
  var d=W.data;
  if(!d)return '<p class="mm-wfine">Checking your inbox…</p>';
  if(d.state==='setup')return '<p class="mm-wfine">Email isn\'t set up for the portal yet.</p>';
  if(d.state==='off')return '<div class="mm-wempty"><b>'+(d.reconnect?'Reconnect your email':'Connect your email')+'</b><span>Read and reply to your Maison de Veux mail right here.</span><button type="button" class="mm-btn gold" data-w="open">'+(d.reconnect?'Reconnect':'Connect Mail')+'</button></div>';
  if(d.state==='error')return '<p class="mm-wfine">Mail could not refresh. <button type="button" class="mm-link" data-w="retry">Try again</button></p>';
  var rows=d.rows.map(function(m){return '<button type="button" class="mm-wrow'+(m.is_read?'':' unread')+'" data-w="msg" data-id="'+esc(m.id)+'"><span class="mm-av">'+esc(initials(who(m.from)))+'</span><span class="mm-wmain"><b>'+esc(who(m.from))+'</b><span>'+esc(m.subject||'(no subject)')+'</span></span><em>'+esc(when(m.received))+'</em></button>';}).join('');
  return '<div class="mm-wtop"><span><b>'+d.unread+'</b> unread</span><button type="button" class="mm-btn" data-w="compose">+ New</button><button type="button" class="mm-btn" data-w="open">Open Mail</button></div>'
    +(rows||'<p class="mm-wfine">Your inbox is empty.</p>');
}
function paintWidgets(){
  document.querySelectorAll('[data-mdv-mail-widget]').forEach(function(el){
    el.innerHTML=widgetHtml();
    el.querySelectorAll('[data-w]').forEach(function(b){b.onclick=function(e){
      e.stopPropagation();var a=b.dataset.w;
      if(a==='retry'){W.at=0;refreshWidget();return;}
      if(a==='compose'){S.pendingCompose=true;}
      if(a==='msg'){S.pendingOpen=b.dataset.id;S.folder='inbox';}
      if(typeof window.navTo==='function')window.navTo('mail');
    };});
  });
}
async function refreshWidget(){
  if(W.busy)return;W.busy=true;
  try{
    var st=await status();
    if(!st.configured||st.storage_ok===false)W.data={state:'setup'};
    else if(!st.connected)W.data={state:'off',reconnect:!!st.needs_reconnect};
    else{
      var f=await call('folders'),inbox=arr(f.folders).filter(function(x){return x.id==='inbox';})[0];
      var d=await call('messages',{folder:'inbox'});
      W.data={state:'ok',unread:inbox?inbox.unread:0,rows:arr(d.messages).slice(0,6)};
    }
  }catch(e){W.data=/reconnect/i.test(msg(e))?{state:'off',reconnect:true}:{state:'error'};}
  W.at=Date.now();W.busy=false;paintWidgets();try{window.dispatchEvent(new Event('mdv:mail-widget'));}catch(e){}
}
(function watchWidget(){
  var pending=false;
  function check(){
    pending=false;
    var els=document.querySelectorAll('[data-mdv-mail-widget]');if(!els.length)return;
    var fresh=false;els.forEach(function(el){if(!el.dataset.mmw){el.dataset.mmw='1';fresh=true;}});
    if(fresh&&W.data)paintWidgets();
    if(fresh&&Date.now()-W.at>45000&&window.VEUX_AGENT_V4&&window.VEUX_AGENT_V4.api)refreshWidget();
  }
  new MutationObserver(function(){if(!pending){pending=true;setTimeout(check,250);}}).observe(document.documentElement,{childList:true,subtree:true});
  setInterval(function(){if(document.visibilityState==='visible'&&document.querySelector('[data-mdv-mail-widget]')&&Date.now()-W.at>60000&&window.VEUX_AGENT_V4)refreshWidget();},30000);
})();

/* ---------- page entry + wiring into the portal ---------- */
function render(host){W.at=0;S.host=host;S.status=null;S.err='';S.sel=null;S.detail=null;S.readerOpen=false;S.search='';S.unreadOnly=false;return boot();}
window.renderMail=render;
window.MDV_MAIL={render:render,state:S,emailTo:emailTo,newMessage:function(o){return emailTo([],Object.assign({},o||{},{blank:true}));},crm:crm,widget:function(){return W.data;},refreshWidget:function(){return refreshWidget();}};

function registerRoute(){
  var map=window.VEUX_V15_ROUTE_RENDERERS;
  if(map&&typeof map==='object'){map.mail=function(el){return window.renderMail(el);};return true;}
  return false;
}
(function(){var n=0,t=setInterval(function(){if(registerRoute()||++n>120)clearInterval(t);},500);registerRoute();})();

/* Return from Microsoft sign-in: /admin/?mail=connected | error&reason=… */
(function(){
  var q;try{q=new URLSearchParams(location.search);}catch(e){return;}
  var res=q.get('mail');if(!res)return;
  var reasons={denied:'Microsoft sign-in was cancelled.',browser_mismatch:'That sign-in was started in a different browser. Please try again from this one.',bad_state:'The sign-in link expired. Please try again.',not_staff:'Only active team members can connect email.',storage:'The database step for email is not finished yet.',not_configured:'Email is not set up yet.',failed:'Microsoft sign-in could not be completed. Please try again.',microsoft_error:'Microsoft reported a problem with the sign-in.'};
  var reason=q.get('reason');
  try{history.replaceState(null,'',location.pathname+location.hash);}catch(e){}
  var tries=0,t=setInterval(function(){
    var ready=typeof window.navTo==='function'&&window.VEUX_AGENT_V4&&window.VEUX_AGENT_V4.state&&window.VEUX_AGENT_V4.state.org&&document.getElementById('p-mail');
    if(ready){clearInterval(t);registerRoute();window.navTo('mail');setTimeout(function(){toast(res==='connected'?'✓ Email connected':(reasons[reason]||'Email could not be connected.'),res==='connected'?'':'bad');},700);}
    else if(++tries>80)clearInterval(t);
  },500);
})();
})();
