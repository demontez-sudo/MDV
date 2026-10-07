/* Mail — each team member connects their own Microsoft 365 mailbox and reads, sends and replies inside the portal.
   Server: /api/agent/mail (Microsoft Graph; tokens encrypted server-side, never in the browser). */
(function(){
'use strict';
if(window.__MDV_MAIL__)return;window.__MDV_MAIL__=true;

var S={host:null,status:null,loading:false,err:'',folder:'inbox',folders:[],messages:[],next:null,listLoading:false,listErr:'',search:'',unreadOnly:false,
  sel:null,detail:null,detailLoading:false,showImages:false,readerOpen:false,timer:null,seq:0,senders:{}};

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
  if(S.pendingCompose){S.pendingCompose=false;if(S.status&&S.status.connected)compose({});}
  if(S.pendingOpen&&S.status&&S.status.connected){var pid=S.pendingOpen;S.pendingOpen=null;openMessage(pid);}
}
async function loadFolders(){try{var d=await call('folders');S.folders=arr(d.folders);}catch(e){if(e&&/reconnect/i.test(msg(e))){S.status=Object.assign({},S.status,{connected:false,needs_reconnect:true});}else throw e;}}
async function loadList(reset){
  if(!S.status||!S.status.connected)return;
  var token=++S.seq;S.listLoading=true;S.listErr='';if(reset){S.messages=[];S.next=null;}paintList();
  try{
    var d=await call('messages',reset?{folder:S.folder,search:S.search,unread_only:S.unreadOnly}:{next:S.next});
    if(token!==S.seq&&reset)return;
    arr(d.messages).forEach(function(m){if(m.from&&m.from.address)S.senders[m.from.address.toLowerCase()]=m.from.name||'';});
    S.messages=reset?arr(d.messages):S.messages.concat(arr(d.messages));S.next=d.next||null;
  }catch(e){S.listErr=msg(e);}
  S.listLoading=false;paintList();
}
async function openMessage(id){
  S.sel=id;S.reply=null;S.detail=null;S.detailLoading=true;S.showImages=false;S.readerOpen=true;
  var mmEl=S.host&&S.host.querySelector('.mm');if(mmEl)mmEl.classList.add('read-open');
  paintList();paintReader();
  try{
    var d=await call('message',{id:id});if(S.sel!==id)return;
    S.detail={m:d.message,att:arr(d.attachments)};
    var row=S.messages.filter(function(x){return x.id===id;})[0];
    if(row&&!row.is_read){row.is_read=true;var f=S.folders.filter(function(x){return x.id===S.folder;})[0];if(f&&f.unread>0)f.unread--;}
  }catch(e){S.detail={error:msg(e)};}
  S.detailLoading=false;paintList();paintSide();paintReader();
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
  el.innerHTML='<button class="mm-btn gold mm-compose" data-a="compose">+ New message</button>'
    +'<nav class="mm-folders">'+S.folders.map(function(f){return '<button class="'+(S.folder===f.id?'on':'')+'" data-a="folder" data-id="'+esc(f.id)+'"><span>'+esc(f.name)+'</span>'+(f.unread?'<em>'+f.unread+'</em>':'')+'</button>';}).join('')+'</nav>'
    +'';
  wire(el);
}
function paintList(){
  var el=document.getElementById('mm-list');if(!el)return;
  var ae=document.activeElement,hadFocus=!!(ae&&ae.hasAttribute&&ae.hasAttribute('data-q')&&el.contains(ae)),caret=hadFocus?ae.selectionStart:0;
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
  if(hadFocus){var q=el.querySelector('[data-q]');if(q){q.focus();try{q.setSelectionRange(caret,caret);}catch(e){}}}
}
function bodyDoc(m,showImages){
  var csp="default-src 'none'; img-src data: cid:"+(showImages?' https:':'')+"; style-src 'unsafe-inline'; font-src data:";
  var inner=m.body_type==='html'?m.body:'<pre style="white-space:pre-wrap;font:inherit">'+esc(m.body)+'</pre>';
  return '<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="'+csp+'"><base target="_blank"><style>body{margin:0;padding:18px 22px;font:14px/1.55 -apple-system,Segoe UI,Calibri,Arial,sans-serif;color:#1b1814;background:#fff;word-wrap:break-word}img{max-width:100%;height:auto}a{color:#8c6a2f}blockquote{margin:8px 0;padding-left:12px;border-left:3px solid #ddd;color:#555}table{max-width:100%}</style></head><body>'+inner+'</body></html>';
}
function paintReader(){
  var el=document.getElementById('mm-reader');if(!el)return;
  if(!S.sel){el.innerHTML='<div class="mm-none"><div><span>✉</span><p>Select a message to read it</p></div></div>';return;}
  if(S.detailLoading||!S.detail){el.innerHTML='<div class="mm-none"><p>Opening…</p></div>';return;}
  if(S.detail.error){el.innerHTML='<div class="mm-none"><div><p class="mm-err">'+esc(S.detail.error)+'</p><button class="mm-btn" data-a="close">Back</button></div></div>';wire(el);return;}
  var m=S.detail.m,att=S.detail.att;
  var hasRemote=m.body_type==='html'&&/<img[^>]+src=["']?https?:/i.test(m.body);
  el.innerHTML='<header class="mm-rh"><button class="mm-back mm-only-mobile" data-a="close">← Back</button><h2>'+esc(m.subject)+'</h2>'
    +'<div class="mm-from"><span class="mm-av big">'+esc(initials(who(m.from)))+'</span><div><b>'+esc(who(m.from))+'</b> <span>&lt;'+esc(m.from?m.from.address:'')+'&gt;</span><small>To: '+esc(m.to.map(who).join(', ')||'—')+(m.cc.length?' · Cc: '+esc(m.cc.map(who).join(', ')):'')+' · '+esc(whenFull(m.received))+'</small></div></div>'
    +'<div class="mm-actions"><button class="mm-btn" data-a="reply">Reply</button><button class="mm-btn" data-a="replyAll">Reply all</button><button class="mm-btn" data-a="forward">Forward</button><span class="mm-sp"></span><button class="mm-btn" data-a="unread">Mark unread</button><button class="mm-btn" data-a="archive">Archive</button><button class="mm-btn danger" data-a="delete">Delete</button>'+(m.web_link?'<a class="mm-btn" href="'+esc(m.web_link)+'" target="_blank" rel="noopener noreferrer">Open in Outlook</a>':'')+'</div>'
    +(att.length?'<div class="mm-atts">'+att.map(function(a){return '<button class="mm-att" data-a="download" data-id="'+esc(a.id)+'" data-name="'+esc(a.name)+'"><i>'+esc((a.name.split('.').pop()||'file').slice(0,4).toUpperCase())+'</i><span>'+esc(a.name)+'</span><em>'+esc(size(a.size))+'</em></button>';}).join('')+'</div>':'')
    +(hasRemote&&!S.showImages?'<div class="mm-imgs">Images are hidden to protect your privacy. <button class="mm-link" data-a="images">Show images</button></div>':'')+'</header>'
    +'<iframe class="mm-body" sandbox="allow-popups allow-popups-to-escape-sandbox" referrerpolicy="no-referrer" title="Message body"></iframe>';
  el.querySelector('iframe').srcdoc=bodyDoc(m,S.showImages);
  wire(el);paintReply();
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
    var m=S.detail&&S.detail.m;
    if(a==='disconnect'){if(!window.confirm('Disconnect your email from the portal? Your mailbox itself is not touched.'))return;await call('disconnect');S.status=Object.assign({},S.status,{connected:false});S.folders=[];S.messages=[];S.sel=null;S.detail=null;paint();toast('Email disconnected');return;}
    if(a==='download'){b.disabled=true;var f=await call('attachment',{id:m.id,attachment_id:b.dataset.id});b.disabled=false;var bin=atob(f.content_base64),u8=new Uint8Array(bin.length);for(var i=0;i<bin.length;i++)u8[i]=bin.charCodeAt(i);var url=URL.createObjectURL(new Blob([u8],{type:f.content_type||'application/octet-stream'})),link=document.createElement('a');link.href=url;link.download=f.name||b.dataset.name||'attachment';document.body.appendChild(link);link.click();link.remove();setTimeout(function(){URL.revokeObjectURL(url);},4000);return;}
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
    +'<datalist id="mm-sug">'+sugOptions()+'</datalist>'
    +'<div class="mm-rr-foot"><span class="mm-err" id="mm-rerr"></span>'+copySelect('mm-rcopy')+'<button type="button" class="mm-btn" data-rx>Discard</button><button type="button" class="mm-btn gold" id="mm-rsend">Send</button></div>';
  el.appendChild(d);
  var ta=d.querySelector('#mm-rtext'),to=d.querySelector('#mm-rto'),cc=d.querySelector('#mm-rcc');
  ta.value=r.text||'';ta.oninput=function(){r.text=ta.value;};to.oninput=function(){r.to=to.value;};cc.oninput=function(){r.cc=cc.value;};
  d.querySelectorAll('[data-rx]').forEach(function(b){b.onclick=function(){if(ta.value.trim()&&!window.confirm('Discard this reply?'))return;S.reply=null;paintReply();};});
  d.querySelector('#mm-rsend').onclick=async function(){
    var btn=this,err=d.querySelector('#mm-rerr');err.textContent='';
    try{
      if(!to.value.trim())throw new Error('Add at least one recipient.');
      if(r.mode!=='forward'&&!ta.value.trim())throw new Error('Write a message first.');
      btn.disabled=true;btn.textContent='Sending…';
      setCopyPref(d.querySelector('#mm-rcopy').value);var sv=await call('reply',{id:m.id,mode:r.mode,to:to.value.trim(),cc:cc.value.trim(),text:ta.value,copy_to:d.querySelector('#mm-rcopy').value});
      S.reply=null;paintReply();toast(sentToast(sv));if(S.folder==='sentitems')loadList(true);
    }catch(e){err.textContent=msg(e);btn.disabled=false;btn.textContent='Send';}
  };
  if(focus)setTimeout(function(){(to.value?ta:to).focus();},30);
}

/* ---------- compose (new message) ---------- */
function readFile(f){return new Promise(function(res,rej){var r=new FileReader();r.onload=function(){res({name:f.name,content_type:f.type||'application/octet-stream',content_base64:String(r.result).split(',')[1]||''});};r.onerror=function(){rej(new Error('Could not read '+f.name));};r.readAsDataURL(f);});}
function compose(o){
  var old=document.getElementById('mm-modal');if(old)old.remove();
  var mode=o.mode||'new',m=o.m,title=mode==='reply'?'Reply':mode==='replyAll'?'Reply all':mode==='forward'?'Forward':'New message';
  var to=mode==='reply'?(m.reply_to&&m.reply_to[0]?m.reply_to[0].address:(m.from&&m.from.address)||''):mode==='replyAll'?[m.from&&m.from.address].concat(m.to.map(function(x){return x.address;})).concat(m.cc.map(function(x){return x.address;})).filter(function(x,i,a){return x&&x.toLowerCase()!==String(S.status.email||'').toLowerCase()&&a.indexOf(x)===i;}).join(', '):'';
  if(mode==='new'&&o.to)to=o.to;
  var subj=m?(mode==='forward'?'Fwd: ':'Re: ')+m.subject.replace(/^(re|fwd?):\s*/i,''):'';
  var back=document.createElement('div');back.id='mm-modal';back.className='mm-modal-back';
  back.innerHTML='<section class="mm-modal" role="dialog" aria-modal="true" aria-label="'+title+'"><header><div><small>MAIL</small><h2>'+title+'</h2></div><button type="button" data-x aria-label="Close">×</button></header>'
    +'<div class="mm-form">'+(mode==='new'||mode==='forward'?'<label><span>To</span><input id="mm-to" list="mm-sug" value="'+esc(to)+'" placeholder="name@example.com, …" autocomplete="off"></label>':'<label><span>To</span><input id="mm-to" list="mm-sug" value="'+esc(to)+'" autocomplete="off"></label>')
    +(mode==='new'?'<div class="mm-ccrow"><label><span>Cc</span><input id="mm-cc" list="mm-sug" autocomplete="off"></label><label><span>Bcc</span><input id="mm-bcc" list="mm-sug" value="'+esc(o.bcc||'')+'" autocomplete="off"></label></div>':'')
    +(mode==='new'?'<label><span>Subject</span><input id="mm-subject" maxlength="300" value="'+esc(o.subject||'')+'"></label>':'<label><span>Subject</span><input id="mm-subject" value="'+esc(subj)+'" disabled></label>')
    +'<label><span>Message</span><textarea id="mm-text" rows="10" placeholder="'+(m?'Write your reply — the original message is quoted below automatically.':'Write your message…')+'"></textarea></label>'
    +(mode==='new'?'<div class="mm-attach"><button type="button" class="mm-btn" id="mm-addfile">📎 Attach files</button><input type="file" id="mm-file" multiple hidden><span id="mm-files" class="mm-fine">Up to 8 files, 3 MB total.</span></div>':'')
    +'<datalist id="mm-sug">'+sugOptions()+'</datalist></div>'
    +'<p class="mm-err" id="mm-cerr"></p><footer>'+copySelect('mm-copy')+'<span class="mm-sp"></span><button type="button" class="mm-btn" data-x>Cancel</button><button type="button" class="mm-btn gold" id="mm-send">Send</button></footer></section>';
  document.body.appendChild(back);
  var files=[],sentVia=null,$=function(q){return back.querySelector(q);};
  function close(){back.remove();}
  back.querySelectorAll('[data-x]').forEach(function(x){x.onclick=close;});
  back.addEventListener('mousedown',function(e){if(e.target===back&&!$('#mm-text').value.trim())close();});
  var af=$('#mm-addfile');if(af){af.onclick=function(){$('#mm-file').click();};$('#mm-file').onchange=function(){files=files.concat([].slice.call(this.files)).slice(0,8);this.value='';var tot=files.reduce(function(n,f){return n+f.size;},0);$('#mm-files').textContent=files.length?files.map(function(f){return f.name;}).join(', ')+' ('+size(tot)+')':'Up to 8 files, 3 MB total.';};}
  setTimeout(function(){var sb=$('#mm-subject');($('#mm-to').value?(mode==='new'&&sb&&!sb.value?sb:$('#mm-text')):$('#mm-to')).focus();},50);
  if(mode==='new')ensureDirectory(function(){var dl=back.querySelector('#mm-sug');if(dl)dl.innerHTML=sugOptions();});
  $('#mm-send').onclick=async function(){
    var btn=this,err=$('#mm-cerr');err.textContent='';
    try{
      var text=$('#mm-text').value,toV=$('#mm-to').value.trim();
      if(!toV)throw new Error('Add at least one recipient.');
      if(mode!=='new'&&!text.trim())throw new Error('Write a message first.');
      setCopyPref($('#mm-copy').value);btn.disabled=true;btn.textContent='Sending…';
      if(mode==='new'){
        var tot=files.reduce(function(n,f){return n+f.size;},0);if(tot>3*1048576)throw new Error('Attachments are over 3 MB in total.');
        var atts=await Promise.all(files.map(readFile));
        sentVia=await call('send',{to:toV,cc:$('#mm-cc').value,bcc:$('#mm-bcc').value,subject:$('#mm-subject').value,text:text,attachments:atts,copy_to:$('#mm-copy').value});
      }else{
        sentVia=await call('reply',{id:m.id,mode:mode==='replyAll'?'replyAll':mode,to:toV,text:text,copy_to:$('#mm-copy').value});
      }
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
  if(!addrs.length)return false;
  var fallback=function(){window.location.href='mailto:'+addrs.join(',')+(o.subject?'?subject='+encodeURIComponent(o.subject):'');return false;};
  try{
    if(!S.status||S.status.connected===undefined){var st=await status();S.status=Object.assign({},S.status,st);}
    if(!S.status.connected){
      toast(S.status.configured===false?'Portal email isn\'t set up yet — opening your mail app':'Connect your mailbox in Settings → Email to send from the portal — opening your mail app','bad');
      setTimeout(fallback,900);return false;
    }
  }catch(e){return fallback();}
  if(addrs.length>1&&!o.to_all){
    /* Several people: send to yourself and Bcc everyone so clients never see each other. */
    compose({to:String(S.status.email||''),bcc:addrs.join(', '),subject:o.subject||''});
  }else compose({to:addrs.join(', '),subject:o.subject||''});
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
  W.at=Date.now();W.busy=false;paintWidgets();
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
window.MDV_MAIL={render:render,state:S,emailTo:emailTo,crm:crm};

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
