/* Vera Scout — paste anything (applications, DMs, emails, Instagram handles, street-casting notes) and Vera turns it
   into scouting prospects. The agent reviews and edits them, then adds the ones they approve to the Scouting pipeline.
   Backend: /api/agent/scouting/vera (extract → polled job, add → dedupes against existing prospects). */
(function(){
'use strict';
var S={step:'brief',text:'',source:'',items:[],notes:[],result:null,err:'',busy:false};

function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
function arr(v){return Array.isArray(v)?v:[];}
function bridge(){var b=window.VEUX_AGENT_V4;if(!b||!b.api)throw new Error('Secure session is not ready');return b;}
function org(){try{return bridge().state.org.slug||'maison-de-veux';}catch(e){return 'maison-de-veux';}}
function post(body){return bridge().api('/api/agent/scouting/vera',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(Object.assign({organization_slug:org()},body)),__fresh:true});}
function poll(id){return bridge().api('/api/agent/scouting/vera?organization='+encodeURIComponent(org())+'&job_id='+encodeURIComponent(id)+'&_t='+Date.now(),{method:'GET',headers:{},__fresh:true});}
function msg(e){return (e&&e.message)||String(e||'Something went wrong');}
function toast(m){if(typeof window.toast==='function'){try{window.toast(m);return;}catch(e){}}var d=document.createElement('div');d.className='vs-toast';d.textContent=m;document.body.appendChild(d);setTimeout(function(){d.remove();},3500);}

var FIELDS=[['display_name','Name'],['instagram','Instagram'],['email','Email'],['phone','Phone'],['city','City'],['country','Country'],['height_cm','Height (cm)'],['age_reported','Age'],['date_of_birth','Date of birth']];
var FIT={strong:'Strong fit',maybe:'Possible fit',unclear:'Needs a look'};

function root(){return document.getElementById('vs-modal');}
function close(){var m=root();if(m)m.remove();}
function open(){
  S={step:'brief',text:'',source:'',items:[],notes:[],result:null,err:'',busy:false};
  close();var m=document.createElement('div');m.id='vs-modal';m.className='vs-back';document.body.appendChild(m);
  m.addEventListener('mousedown',function(e){if(e.target===m&&S.step==='brief'&&!S.text.trim())close();});
  paint();
}
function paint(){
  var m=root();if(!m)return;
  var body;
  if(S.step==='brief')body=briefHtml();else if(S.step==='thinking')body=thinkingHtml();else if(S.step==='review')body=reviewHtml();else body=doneHtml();
  m.innerHTML='<section class="vs-modal" role="dialog" aria-modal="true" aria-label="Vera Scout"><header><div><small>✦ VERA SCOUT</small><h2>'+(S.step==='review'?'Review prospects':S.step==='done'?'Added to Scouting':'Add prospects with Vera')+'</h2></div><button type="button" data-x aria-label="Close">×</button></header>'+body+'</section>';
  wire(m);
}
function briefHtml(){
  return '<div class="vs-body"><p class="vs-lead">Paste anything you have on new talent: application forms, DMs, emails, Instagram handles, notes from a street casting. Vera reads it, builds a prospect for each person and flags what is missing. You approve before anything is added.</p>'
    +'<label><span>What you have</span><textarea id="vs-text" rows="10" placeholder="e.g. Lena Ortiz, @lena.ortiz, 5\'10, Paris, emailed about open call…&#10;Noah Lee — met at Thursday casting, tall, no agency yet, 917-555-0100">'+esc(S.text)+'</textarea></label>'
    +'<label><span>Where did you find them? <i>(optional)</i></span><input id="vs-source" maxlength="120" placeholder="Street casting, Instagram DMs, open call…" value="'+esc(S.source)+'"></label>'
    +'<p class="vs-fine">Vera only uses what you paste. She never searches the web or guesses details, and anyone she reads as under 18 is flagged for guardian consent.</p>'
    +(S.err?'<p class="vs-err">'+esc(S.err)+'</p>':'')+'</div><footer><button type="button" class="vs-btn" data-x>Cancel</button><button type="button" class="vs-btn gold" data-a="extract">✦ Let Vera read it</button></footer>';
}
function thinkingHtml(){return '<div class="vs-body vs-think"><div class="vs-orb"></div><p>Vera is reading and sorting your notes…</p><small>This usually takes 10–30 seconds.</small></div>';}
function itemHtml(p,i){
  var vera=p.vera_summary?'<p class="vs-vera"><b>✦ Vera:</b> '+esc(p.vera_summary)+'</p>':'';
  var flags=arr(p.flags).map(function(f){return '<span class="vs-flag">'+esc(f)+'</span>';}).join('');
  var miss=arr(p.missing).length?'<span class="vs-miss">Missing: '+esc(arr(p.missing).join(', '))+'</span>':'';
  return '<article class="vs-card'+(p._on?'':' off')+'"><label class="vs-pick"><input type="checkbox" data-pick="'+i+'"'+(p._on?' checked':'')+'><span></span></label>'
    +'<div class="vs-head"><span class="vs-fit '+esc(p.fit)+'">'+esc(FIT[p.fit]||FIT.unclear)+'</span></div>'
    +'<div class="vs-grid">'+FIELDS.map(function(f){var v=p[f[0]];return '<label class="'+(f[0]==='display_name'?'wide':'')+'"><span>'+f[1]+'</span><input data-f="'+i+':'+f[0]+'" value="'+esc(v==null?'':v)+'"'+(f[0]==='date_of_birth'?' placeholder="YYYY-MM-DD"':'')+'></label>';}).join('')+'</div>'
    +vera+(flags||miss?'<div class="vs-tags">'+flags+miss+'</div>':'')+'</article>';
}
function reviewHtml(){
  var n=S.items.filter(function(p){return p._on;}).length;
  return '<div class="vs-body">'
    +(S.items.length?'<p class="vs-lead">Vera found <b>'+S.items.length+'</b> '+(S.items.length===1?'person':'people')+'. Fix anything that looks off, untick anyone you don\'t want, then add them. They go into Scouting as <b>New lead</b>.</p>'+S.items.map(itemHtml).join(''):'<p class="vs-lead">Vera could not find anyone to add in that text.</p>')
    +(S.notes.length?'<div class="vs-notes"><b>Vera also noticed</b><ul>'+S.notes.map(function(x){return '<li>'+esc(x)+'</li>';}).join('')+'</ul></div>':'')
    +(S.err?'<p class="vs-err">'+esc(S.err)+'</p>':'')+'</div>'
    +'<footer><button type="button" class="vs-btn" data-a="back">← Edit text</button><span class="vs-sp"></span>'+(S.items.length?'<button type="button" class="vs-btn gold" data-a="add"'+(n&&!S.busy?'':' disabled')+'>'+(S.busy?'Adding…':'Add '+n+' to Scouting')+'</button>':'')+'</footer>';
}
function doneHtml(){
  var r=S.result||{added:[],skipped:[]};
  return '<div class="vs-body"><p class="vs-lead">'+(r.added.length?'<b>'+r.added.length+'</b> '+(r.added.length===1?'prospect was':'prospects were')+' added to Scouting as New leads.':'Nothing new was added.')+'</p>'
    +(r.added.length?'<ul class="vs-list">'+r.added.map(function(x){return '<li>✓ '+esc(x.display_name)+'</li>';}).join('')+'</ul>':'')
    +(r.skipped.length?'<div class="vs-notes"><b>Skipped</b><ul>'+r.skipped.map(function(x){return '<li>'+esc(x.display_name)+' — '+esc(x.reason)+'</li>';}).join('')+'</ul></div>':'')+'</div>'
    +'<footer><button type="button" class="vs-btn" data-a="again">Add more</button><span class="vs-sp"></span><button type="button" class="vs-btn gold" data-x>Done</button></footer>';
}

function wire(m){
  m.querySelectorAll('[data-x]').forEach(function(b){b.onclick=function(){if(S.step==='review'&&S.items.length&&!window.confirm('Close without adding these prospects?'))return;close();if(S.step==='done')refreshPage();};});
  var t=m.querySelector('#vs-text');if(t)t.oninput=function(){S.text=t.value;};
  var s=m.querySelector('#vs-source');if(s)s.oninput=function(){S.source=s.value;};
  m.querySelectorAll('[data-pick]').forEach(function(b){b.onchange=function(){S.items[+b.dataset.pick]._on=b.checked;var card=b.closest('.vs-card');if(card)card.classList.toggle('off',!b.checked);var n=S.items.filter(function(p){return p._on;}).length,a=m.querySelector('[data-a="add"]');if(a){a.disabled=!n||S.busy;a.textContent='Add '+n+' to Scouting';}};});
  m.querySelectorAll('[data-f]').forEach(function(inp){inp.oninput=function(){var p=inp.dataset.f.split(':'),it=S.items[+p[0]],v=inp.value.trim();it[p[1]]=v===''?null:(/^(height_cm|age_reported)$/.test(p[1])?Number(v):v);};});
  m.querySelectorAll('[data-a]').forEach(function(b){b.onclick=function(){
    var a=b.dataset.a;
    if(a==='extract')extract();else if(a==='back'){S.step='brief';S.err='';paint();}
    else if(a==='add')add();else if(a==='again'){S.step='brief';S.text='';S.items=[];S.result=null;S.err='';paint();}
  };});
}

async function extract(){
  if(S.text.trim().length<3){S.err='Paste some text for Vera to read.';paint();return;}
  S.err='';S.step='thinking';paint();
  try{
    var start=await post({action:'extract',text:S.text,source:S.source});
    var id=start&&start.job_id;if(!id)throw new Error('Vera could not start.');
    var res=null,t0=Date.now();
    while(Date.now()-t0<5*60*1000){
      await new Promise(function(r){setTimeout(r,2500);});
      if(!root())return;
      var p=await poll(id);
      if(p&&p.status==='complete'){res=p.result;break;}
      if(p&&p.status==='failed')throw new Error(p.error||'Vera could not read that.');
    }
    if(!res)throw new Error('Vera took too long. Please try again with less text.');
    S.items=arr(res.prospects).map(function(p){p._on=true;return p;});S.notes=arr(res.notes);S.step='review';
  }catch(e){S.step='brief';S.err=msg(e);}
  paint();
}
async function add(){
  var picked=S.items.filter(function(p){return p._on;}).map(function(p){var c=Object.assign({},p);delete c._on;return c;});
  if(!picked.length)return;
  S.busy=true;S.err='';paint();
  try{
    var r=await post({action:'add',prospects:picked});
    S.result={added:arr(r.added),skipped:arr(r.skipped)};S.step='done';
    if(S.result.added.length)toast('Added '+S.result.added.length+' to Scouting');
  }catch(e){S.err=msg(e);}
  S.busy=false;paint();
}
function refreshPage(){try{if(typeof window.renderScoutingRecords==='function'&&document.getElementById('p-scouting')&&document.getElementById('p-scouting').offsetParent!==null)window.renderScoutingRecords(document.getElementById('p-scouting'));}catch(e){}}

/* Add the "Vera Scout" button next to "+ New Prospect" on the Scouting page. */
function inject(){
  var panel=document.getElementById('p-scouting');if(!panel)return;
  var head=panel.querySelector('.v1686-pagehead');if(!head||head.querySelector('[data-vera-scout]'))return;
  var anchor=head.querySelector('.v1686-btn');
  var b=document.createElement('button');b.type='button';b.className='v1686-btn vs-open';b.setAttribute('data-vera-scout','1');b.textContent='✦ Vera Scout';b.onclick=open;
  var wrap=document.createElement('div');wrap.className='vs-actions';
  if(anchor){anchor.parentNode.insertBefore(wrap,anchor);wrap.appendChild(b);wrap.appendChild(anchor);}else head.appendChild(b);
}
(function(){
  var pending=false;
  new MutationObserver(function(){if(!pending){pending=true;setTimeout(function(){pending=false;try{inject();}catch(e){}},150);}}).observe(document.documentElement,{childList:true,subtree:true});
  inject();
})();
window.MDV_SCOUT={open:open};
})();
