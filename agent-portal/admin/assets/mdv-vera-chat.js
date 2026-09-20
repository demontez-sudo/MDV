/* Vera Chat: full conversational workspace with live web search and agency data (ChatGPT / Claude / Gemini style). */
(function(){
if(window.MDV_VERA_CHAT)return;
var KEY='mdv-vera-chat-v1',MAXCHATS=40,root=null,S={chats:[],id:null,busy:false,web:true,abort:null,status:null};
function $(s,r){return (r||root).querySelector(s);}
function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
function load(){try{var d=JSON.parse(localStorage.getItem(KEY)||'null');if(d&&Array.isArray(d.chats)){S.chats=d.chats;S.id=d.id;S.web=d.web!==false;}}catch(_e){}}
function save(){try{localStorage.setItem(KEY,JSON.stringify({chats:S.chats.slice(0,MAXCHATS),id:S.id,web:S.web}));}catch(_e){}}
function cur(){return S.chats.find(function(c){return c.id===S.id;})||null;}
function newChat(){var c={id:'c'+Date.now().toString(36),title:'New chat',at:Date.now(),msgs:[]};S.chats.unshift(c);S.id=c.id;save();return c;}
function ctx(){
  var page=window._currentPage||'overview',model=null;
  try{model=window._veuxV10ModelId||(window.MODELS&&window.MODELS[window._openModelKey]&&window.MODELS[window._openModelKey]._veuxId)||null;}catch(_e){}
  return {page:page,model_id:page==='modelpage'?model:null};
}
function ctxLabel(){var c=ctx(),p=String(c.page||'').replace(/^p-/,'');var names={overview:'Home',calendar:'Calendar',roster:'Roster',modelpage:'Model 360',globalmobility:'Mobility',tasksconsolidated:'Tasks',financelegal:'Finance',industrydirectory:'Directory',multipackage:'Packages'};return names[p]||p||'Portal';}

/* ---- markdown ---- */
function inline(t){
  t=esc(t);
  t=t.replace(/`([^`]+)`/g,'<code>$1</code>').replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>').replace(/(^|[^*])\*([^*\n]+)\*/g,'$1<em>$2</em>');
  t=t.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,'<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
  t=t.replace(/(^|[\s(])(https?:\/\/[^\s<)]+)/g,'$1<a href="$2" target="_blank" rel="noopener noreferrer">$2</a>');
  return t;
}
function md(src){
  var lines=String(src||'').replace(/\r/g,'').split('\n'),out=[],i=0;
  function isRow(l){return /^\s*\|.*\|\s*$/.test(l);}
  while(i<lines.length){
    var l=lines[i],m;
    if(/^```/.test(l)){var lang=l.replace(/^```/,'').trim(),buf=[];i++;while(i<lines.length&&!/^```/.test(lines[i])){buf.push(lines[i]);i++;}i++;out.push('<pre><div class="vc-code-h"><span>'+esc(lang||'code')+'</span><button type="button" data-vc-copycode>Copy</button></div><code>'+esc(buf.join('\n'))+'</code></pre>');continue;}
    if((m=l.match(/^(#{1,4})\s+(.*)$/))){var lv=Math.min(4,m[1].length)+1;out.push('<h'+lv+'>'+inline(m[2])+'</h'+lv+'>');i++;continue;}
    if(isRow(l)&&i+1<lines.length&&/^\s*\|[\s:|-]+\|\s*$/.test(lines[i+1])){
      var head=l.trim().replace(/^\||\|$/g,'').split('|'),rows=[];i+=2;
      while(i<lines.length&&isRow(lines[i])){rows.push(lines[i].trim().replace(/^\||\|$/g,'').split('|'));i++;}
      out.push('<div class="vc-tw"><table><thead><tr>'+head.map(function(h){return '<th>'+inline(h.trim())+'</th>';}).join('')+'</tr></thead><tbody>'+rows.map(function(r){return '<tr>'+r.map(function(c){return '<td>'+inline(c.trim())+'</td>';}).join('')+'</tr>';}).join('')+'</tbody></table></div>');continue;}
    if(/^\s*([-*•])\s+/.test(l)){var li=[];while(i<lines.length&&/^\s*([-*•])\s+/.test(lines[i])){li.push('<li>'+inline(lines[i].replace(/^\s*([-*•])\s+/,''))+'</li>');i++;}out.push('<ul>'+li.join('')+'</ul>');continue;}
    if(/^\s*\d+[.)]\s+/.test(l)){var ol=[];while(i<lines.length&&/^\s*\d+[.)]\s+/.test(lines[i])){ol.push('<li>'+inline(lines[i].replace(/^\s*\d+[.)]\s+/,''))+'</li>');i++;}out.push('<ol>'+ol.join('')+'</ol>');continue;}
    if(/^\s*>\s?/.test(l)){var q=[];while(i<lines.length&&/^\s*>\s?/.test(lines[i])){q.push(lines[i].replace(/^\s*>\s?/,''));i++;}out.push('<blockquote>'+inline(q.join(' '))+'</blockquote>');continue;}
    if(/^\s*(---|\*\*\*)\s*$/.test(l)){out.push('<hr>');i++;continue;}
    if(!l.trim()){i++;continue;}
    var p=[];while(i<lines.length&&lines[i].trim()&&!/^(```|#{1,4}\s|\s*([-*•]|\d+[.)])\s|\s*>)/.test(lines[i])&&!isRow(lines[i])){p.push(lines[i]);i++;}
    out.push('<p>'+inline(p.join('\n')).replace(/\n/g,'<br>')+'</p>');
  }
  return out.join('');
}

/* ---- rendering ---- */
var SUGGEST=[
  ['What needs my attention today?','Overdue tasks, visa deadlines, movements and conflicts across the agency.'],
  ['Research a casting director or photographer','Live web research on their recent work, credits and who they work with.'],
  ['Which visa rules apply to a model travelling to Paris?','Current entry and work-permit requirements with official sources.'],
  ['Draft a check-in email to a client','Uses your roster, bookings and CRM context to write it.']
];
function avatar(role){return role==='user'?'<i class="vc-av you">You</i>':'<i class="vc-av vera">V</i>';}
function sourcesHtml(m){
  if(!m.sources||!m.sources.length)return '';
  return '<div class="vc-sources"><small>Sources</small>'+m.sources.map(function(s,i){return '<a href="'+esc(s.url)+'" target="_blank" rel="noopener noreferrer" title="'+esc(s.title)+'"><b>'+(i+1)+'</b><span>'+esc(s.title)+'</span><em>'+esc(s.host||'')+'</em></a>';}).join('')+'</div>';
}
function msgHtml(m,i,last){
  if(m.role==='user')return '<article class="vc-msg user">'+avatar('user')+'<div class="vc-body"><div class="vc-bubble">'+esc(m.content).replace(/\n/g,'<br>')+'</div></div></article>';
  var meta='';
  if(m.queries&&m.queries.length)meta+='<div class="vc-searched"><i></i>Searched the web · '+m.queries.map(function(q){return '<span>'+esc(q)+'</span>';}).join('')+'</div>';
  return '<article class="vc-msg vera'+(m.error?' err':'')+'">'+avatar('vera')+'<div class="vc-body">'+meta+'<div class="vc-md">'+(m.error?'<p>'+esc(m.content)+'</p>':md(m.content))+'</div>'+sourcesHtml(m)+'<div class="vc-tools"><button type="button" data-vc-copy="'+i+'">Copy</button>'+(last?'<button type="button" data-vc-regen>Regenerate</button>':'')+(m.provider?'<span>'+esc(m.provider)+'</span>':'')+'</div></div></article>';
}
function renderList(){
  var l=$('.vc-list');if(!l)return;
  l.innerHTML=S.chats.map(function(c){return '<button type="button" class="vc-item'+(c.id===S.id?' on':'')+'" data-vc-open="'+esc(c.id)+'"><span>'+esc(c.title)+'</span><i data-vc-del="'+esc(c.id)+'" title="Delete chat">×</i></button>';}).join('')||'<p class="vc-none">No conversations yet.</p>';
}
function renderChat(){
  var c=cur(),box=$('.vc-scroll');if(!box)return;
  if(!c||!c.msgs.length){
    box.innerHTML='<div class="vc-empty"><i class="vc-logo">V</i><h2>How can Vera help?</h2><p>Ask anything. Vera searches the live web and works with your agency data: roster, bookings, castings, tasks, CRM, visas and travel.</p><div class="vc-sug">'+SUGGEST.map(function(s){return '<button type="button" data-vc-sug="'+esc(s[0])+'"><b>'+esc(s[0])+'</b><span>'+esc(s[1])+'</span></button>';}).join('')+'</div></div>';
  }else{
    box.innerHTML='<div class="vc-thread">'+c.msgs.map(function(m,i){return msgHtml(m,i,i===c.msgs.length-1&&m.role==='assistant');}).join('')+(S.busy?'<article class="vc-msg vera">'+avatar('vera')+'<div class="vc-body"><div class="vc-typing"><span></span><span></span><span></span><em>'+(S.web?'Searching and thinking…':'Thinking…')+'</em></div></div></article>':'')+'</div>';
  }
  box.scrollTop=box.scrollHeight;renderList();
  var b=$('.vc-send');if(b){b.disabled=false;b.classList.toggle('stop',S.busy);b.setAttribute('aria-label',S.busy?'Stop':'Send');}
}
function shell(){
  root=document.createElement('div');root.id='mdv-vc';root.hidden=true;root.setAttribute('role','dialog');root.setAttribute('aria-label','Vera Chat');
  root.innerHTML='<div class="vc-frame"><aside class="vc-side"><div class="vc-brand"><i class="vc-logo">V</i><div><b>Vera</b><small>AI brain · CAVYRE</small></div></div><button type="button" class="vc-new" data-vc-new>+ New chat</button><div class="vc-list"></div><div class="vc-foot"><small class="vc-status">Checking connection…</small></div></aside><section class="vc-main"><header class="vc-top"><button type="button" class="vc-menu" data-vc-menu aria-label="Chats">☰</button><div class="vc-ctx"><small>Working in</small><b class="vc-ctxl"></b></div><label class="vc-web"><input type="checkbox" data-vc-web><span><i></i>Web search</span></label><button type="button" class="vc-close" data-vc-close aria-label="Close">×</button></header><div class="vc-scroll"></div><form class="vc-form"><textarea rows="1" placeholder="Message Vera…" aria-label="Message Vera"></textarea><button type="submit" class="vc-send" aria-label="Send"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5M5 12l7-7 7 7"/></svg><b></b></button></form><p class="vc-note">Vera can be wrong. Check important facts, especially visa, legal and payment details. Chat is read-only; use the Vera command bar to make changes.</p></section></div>';
  document.body.appendChild(root);
  root.addEventListener('click',onClick);
  var ta=$('textarea');
  ta.addEventListener('input',function(){ta.style.height='auto';ta.style.height=Math.min(200,ta.scrollHeight)+'px';});
  ta.addEventListener('keydown',function(e){if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing){e.preventDefault();submit();}});
  $('.vc-form').addEventListener('submit',function(e){e.preventDefault();if(S.busy)return stop();submit();});
  $('[data-vc-web]').addEventListener('change',function(e){S.web=e.target.checked;save();});
}
function stop(){if(S.abort)S.abort.abort();}
function onClick(e){
  var t=e.target;
  if(t===root||t.closest('[data-vc-close]')){close();return;}
  var fr=$('.vc-frame');if(fr.classList.contains('menu')&&!t.closest('.vc-side')&&!t.closest('[data-vc-menu]'))fr.classList.remove('menu');
  var el;
  if((el=t.closest('[data-vc-new]'))){newChat();$('.vc-frame').classList.remove('menu');renderChat();$('textarea').focus();return;}
  if((el=t.closest('[data-vc-menu]'))){$('.vc-frame').classList.toggle('menu');return;}
  if((el=t.closest('[data-vc-del]'))){e.stopPropagation();var id=el.dataset.vcDel;S.chats=S.chats.filter(function(c){return c.id!==id;});if(S.id===id)S.id=S.chats[0]&&S.chats[0].id||null;save();renderChat();return;}
  if((el=t.closest('[data-vc-open]'))){S.id=el.dataset.vcOpen;save();$('.vc-frame').classList.remove('menu');renderChat();return;}
  if((el=t.closest('[data-vc-sug]'))){send(el.dataset.vcSug);return;}
  if((el=t.closest('[data-vc-copy]'))){var m=cur().msgs[+el.dataset.vcCopy];copy(m&&m.content,el);return;}
  if((el=t.closest('[data-vc-copycode]'))){copy(el.closest('pre').querySelector('code').textContent,el);return;}
  if((el=t.closest('[data-vc-regen]'))){regen();return;}
}
function copy(text,btn){try{navigator.clipboard.writeText(text||'');var o=btn.textContent;btn.textContent='Copied';setTimeout(function(){btn.textContent=o;},1200);}catch(_e){}}
function submit(){var ta=$('textarea'),v=ta.value.trim();if(!v||S.busy)return;ta.value='';ta.style.height='auto';send(v);}
function titleFrom(t){t=String(t).replace(/\s+/g,' ').trim();return t.length>44?t.slice(0,42)+'…':t;}
function api(body,signal){
  var V=window.VEUX_AGENT_V4;
  if(V&&V.api)return V.api('/api/agent/vera/chat',{method:'POST',body:JSON.stringify(body),signal:signal});
  return fetch('/api/agent/vera/chat',{method:'POST',credentials:'include',headers:{'content-type':'application/json'},body:JSON.stringify(body),signal:signal}).then(function(r){return r.json().then(function(j){if(!r.ok)throw new Error(j&&j.error||'Request failed');return j;});});
}
async function ask(c){
  var history=c.msgs.slice(0,-1).filter(function(m){return !m.error;}).map(function(m){return {role:m.role,content:m.content};});
  var last=c.msgs[c.msgs.length-1];
  S.busy=true;S.abort=new AbortController();renderChat();
  try{
    var r=await api({message:last.content,history:history,web:S.web,context:ctx(),organization_slug:(window.VEUX_AGENT_V4&&VEUX_AGENT_V4.state&&VEUX_AGENT_V4.state.org&&VEUX_AGENT_V4.state.org.slug)||'maison-de-veux'},S.abort.signal);
    c.msgs.push({role:'assistant',content:r.reply||'No response.',sources:r.sources||[],queries:r.queries||[],provider:r.provider?(r.provider+(r.model?' · '+r.model:'')):''});
  }catch(err){
    if(err&&err.name==='AbortError')c.msgs.push({role:'assistant',content:'Stopped.',error:true});
    else c.msgs.push({role:'assistant',content:String(err&&err.message||err||'Vera could not answer.'),error:true});
  }finally{S.busy=false;S.abort=null;c.at=Date.now();save();renderChat();}
}
function send(text){
  var c=cur()||newChat();
  if(!c.msgs.length)c.title=titleFrom(text);
  c.msgs.push({role:'user',content:text});save();ask(c);
}
function regen(){var c=cur();if(!c||S.busy)return;while(c.msgs.length&&c.msgs[c.msgs.length-1].role==='assistant')c.msgs.pop();if(c.msgs.length)ask(c);}
function checkStatus(){
  var V=window.VEUX_AGENT_V4,el=$('.vc-status');if(!el)return;
  var p=V&&V.api?V.api('/api/agent/vera/chat?organization=maison-de-veux',{method:'GET',headers:{}}):Promise.reject();
  p.then(function(r){S.status=r;el.className='vc-status '+(r.ok?'ok':'off');el.textContent=r.ok?'Connected · '+(r.selected||'AI')+' · web search on':'AI provider not configured';}).catch(function(){el.className='vc-status';el.textContent='Status unavailable';});
}
function open(prompt){
  if(!root)shell();
  var cx=cur();if(!cx&&!S.chats.length)newChat();
  root.hidden=false;document.documentElement.classList.add('vc-open');
  $('.vc-ctxl').textContent=ctxLabel();$('[data-vc-web]').checked=S.web;
  renderChat();checkStatus();
  setTimeout(function(){var ta=$('textarea');if(ta)ta.focus();},30);
  if(prompt&&typeof prompt==='string'){var cc=cur();if(!cc||cc.msgs.length)cc=newChat();send(prompt);}
}
function close(){if(root)root.hidden=true;document.documentElement.classList.remove('vc-open');}
document.addEventListener('keydown',function(e){
  if((e.metaKey||e.ctrlKey)&&String(e.key).toLowerCase()==='j'){e.preventDefault();root&&!root.hidden?close():open();}
  else if(e.key==='Escape'&&root&&!root.hidden){close();}
});
load();
window.MDV_VERA_CHAT={open:open,close:close};
document.addEventListener('click',function(e){
  var t=e.target&&e.target.closest&&e.target.closest('#_asst-btn,.vera-launcher,[data-vx17-vera]');
  if(!t)return;
  e.preventDefault();e.stopImmediatePropagation();
  var p=document.getElementById('_asst-panel');if(p)p.style.display='none';
  root&&!root.hidden?close():open();
},true);

})();
