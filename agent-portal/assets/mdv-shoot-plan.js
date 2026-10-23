/* Shoot plan (Model 360 > Development): the shoot list and gameplan for a model.
   Import a shoot treatment (.html) and read it as a brief, one chapter per shoot (shot list, run of day), the book order and the prep.
   Staff only. Stored through /api/agent/shoot-plans. */
(function(){
'use strict';
if(window.MDV_SHOOT_PLAN)return;

var CACHE={},UI={tab:{},plan:{},share:{}};

function bridge(){return window.VEUX_AGENT_V4;}
function org(){var b=bridge();return (b&&b.state&&b.state.org&&b.state.org.slug)||'maison-de-veux';}
function modelId(){return window._veuxV10ModelId||null;}
function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c];});}
function api(p,o){return bridge().api(p,o||{method:'GET',headers:{}});}
function toast(t,bad){try{if(window.toast&&!bad)return window.toast(t);}catch(e){}var d=document.createElement('div');d.className='sp-toast'+(bad?' bad':'');d.textContent=t;document.documentElement.appendChild(d);setTimeout(function(){d.remove();},3200);}

/* ---------- reading a treatment (.html) ---------- */
function txt(el){return el?String(el.textContent||'').replace(/\s+/g,' ').trim():'';}
function items(ul){return [].slice.call(ul.children).filter(function(n){return n.tagName==='LI';}).map(txt);}
function blocksOf(root){
  var out=[];
  [].forEach.call(root.querySelectorAll('h4'),function(h){
    var n=h.nextElementSibling,li=[],body=[];
    while(n&&n.tagName!=='H4'){if(n.tagName==='UL')li=li.concat(items(n));else if(n.tagName==='P')body.push(txt(n));n=n.nextElementSibling;}
    out.push({title:txt(h),items:li,text:body});
  });
  return out;
}
function parseTreatment(html){
  var doc=new DOMParser().parseFromString(String(html||''),'text/html');
  var plan={version:1,title:'',name:'',eyebrow:'',sub:'',facts:[],brief:null,shoots:[],book:null,prep:null,footer:''};
  var h1=doc.querySelector('header h1,h1');plan.name=txt(h1);
  plan.title=txt(doc.querySelector('title'))||(plan.name?plan.name+' Shoot Treatment':'Shoot treatment');
  plan.eyebrow=txt(doc.querySelector('header .eyebrow,.mast .eyebrow'));
  plan.sub=txt(doc.querySelector('header .sub,.mast .sub'));
  [].forEach.call(doc.querySelectorAll('.facts > div'),function(d){plan.facts.push({k:txt(d.querySelector('dt')),v:txt(d.querySelector('dd'))});});
  plan.footer=txt(doc.querySelector('footer p'));

  var brief=doc.querySelector('#brief');
  if(brief){
    var two=brief.querySelector('.two');
    plan.brief={eyebrow:txt(brief.querySelector('.sec-head .eyebrow')),heading:txt(brief.querySelector('.sec-head h2')),
      paragraphs:two?[].slice.call(two.querySelectorAll('p')).map(txt):[],
      blocks:two?blocksOf(two):[],
      shiftTitle:'',shift:[].map.call(brief.querySelectorAll('.shift > div'),function(d){return {from:txt(d.querySelector('.from')),to:txt(d.querySelector('.to'))};})};
    var sh=brief.querySelector('.shift');if(sh&&sh.previousElementSibling&&sh.previousElementSibling.tagName==='H4')plan.brief.shiftTitle=txt(sh.previousElementSibling);
  }

  [].forEach.call(doc.querySelectorAll('section'),function(s){
    var top=s.querySelector('.concept-top');if(!top)return;
    var shoot={id:s.id||'',roman:txt(top.querySelector('.roman')),eyebrow:txt(top.querySelector('.eyebrow')),name:txt(top.querySelector('h2')),tag:txt(top.querySelector('.tag')),
      paragraphs:[],words:[],refs:[],specs:[],direction:[],shots:{columns:[],rows:[]},day:{title:'',items:[]}};
    var two=s.querySelector('.two');
    if(two){var cols=[].filter.call(two.children,function(n){return n.nodeType===1;});
      if(cols[0]){shoot.paragraphs=[].slice.call(cols[0].querySelectorAll('p')).map(txt);shoot.words=[].map.call(cols[0].querySelectorAll('.words span'),txt);}
      if(cols[1])shoot.refs=blocksOf(cols[1]);}
    [].forEach.call(s.querySelectorAll('.specs > div'),function(d){shoot.specs=shoot.specs.concat(blocksOf(d));});
    [].forEach.call(s.querySelectorAll('.direction > div'),function(d){blocksOf(d).forEach(function(b){b.avoid=d.classList.contains('no');shoot.direction.push(b);});});
    var tbl=s.querySelector('table');
    if(tbl){shoot.shots.columns=[].map.call(tbl.querySelectorAll('thead th'),txt);
      shoot.shots.rows=[].map.call(tbl.querySelectorAll('tbody tr'),function(tr){var tds=[].slice.call(tr.children);return {cells:tds.map(txt),hero:!!(tds.length&&tds[tds.length-1].classList.contains('hero'))};});}
    var dh=[].filter.call(s.querySelectorAll('h4'),function(h){return /^run of day/i.test(txt(h));})[0];
    if(dh){shoot.day.title=txt(dh);var dd=dh.nextElementSibling;
      if(dd)shoot.day.items=[].map.call(dd.children,function(r){return {time:txt(r.querySelector('time')),text:txt(r.querySelector('span'))};});}
    plan.shoots.push(shoot);
  });

  var book=doc.querySelector('#book');
  if(book)plan.book={eyebrow:txt(book.querySelector('.sec-head .eyebrow')),heading:txt(book.querySelector('.sec-head h2')),intro:txt(book.querySelector('.sec-head p')),
    pages:[].map.call(book.querySelectorAll('.book > div'),function(d){return {pg:txt(d.querySelector('.pg')),title:txt(d.querySelector('.t')),sub:txt(d.querySelector('.s')),cut:d.classList.contains('cut')};})};
  var prep=doc.querySelector('#prep');
  if(prep)plan.prep={eyebrow:txt(prep.querySelector('.sec-head .eyebrow')),heading:txt(prep.querySelector('.sec-head h2')),
    groups:[].map.call(prep.querySelectorAll('.checks > div'),function(d){var b=blocksOf(d)[0]||{title:'',items:[]};return {title:b.title,items:b.items};})};
  return plan;
}
function countShots(p){return (p.shoots||[]).reduce(function(n,s){return n+((s.shots&&s.shots.rows)||[]).length;},0);}
function valid(p){return p&&((p.shoots&&p.shoots.length)||p.brief);}

/* ---------- reading it on screen ---------- */
function list(arr,cls){arr=arr||[];return arr.length?'<ul class="'+(cls||'sp-ul')+'">'+arr.map(function(x){return '<li>'+esc(x)+'</li>';}).join('')+'</ul>':'';}
function block(b){return '<div class="sp-blk'+(b.avoid?' avoid':'')+'"><h5>'+esc(b.title)+'</h5>'+(b.text||[]).map(function(t){return '<p>'+esc(t)+'</p>';}).join('')+list(b.items)+'</div>';}
function viewBrief(p){
  var b=p.brief;if(!b)return '<p class="sp-mute">No brief in this plan.</p>';
  var shift=(b.shift||[]).length?'<h5 class="sp-h">'+esc(b.shiftTitle||'The shift')+'</h5><div class="sp-shift">'+b.shift.map(function(s){return '<div><span class="from">'+esc(s.from)+'</span><b>'+esc(s.to)+'</b></div>';}).join('')+'</div>':'';
  return '<div class="sp-eyebrow">'+esc(b.eyebrow)+'</div><h3 class="sp-title">'+esc(b.heading)+'</h3>'
   +'<div class="sp-two"><div>'+(b.paragraphs||[]).map(function(t,i){return '<p class="'+(i===0?'sp-lede':'')+'">'+esc(t)+'</p>';}).join('')+'</div><div>'+(b.blocks||[]).map(block).join('')+'</div></div>'+shift;
}
function viewShoot(s){
  var cols=(s.shots&&s.shots.columns)||[],rows=(s.shots&&s.shots.rows)||[];
  var table=rows.length?'<h5 class="sp-h">Shot list · '+rows.length+' shots</h5><div class="sp-tw"><table class="sp-tbl"><thead><tr>'+cols.map(function(c){return '<th>'+esc(c)+'</th>';}).join('')+'</tr></thead><tbody>'
    +rows.map(function(r){return '<tr>'+r.cells.map(function(c,i){var cls=i===0?' class="n"':(i===1?' class="shot"':(i===r.cells.length-1?' class="use'+(r.hero?' hero':'')+'"':''));return '<td'+cls+'>'+esc(c)+'</td>';}).join('')+'</tr>';}).join('')+'</tbody></table></div>':'';
  var day=(s.day&&s.day.items&&s.day.items.length)?'<h5 class="sp-h">'+esc(s.day.title||'Run of day')+'</h5><div class="sp-day">'+s.day.items.map(function(d){return '<div><time>'+esc(d.time)+'</time><span>'+esc(d.text)+'</span></div>';}).join('')+'</div>':'';
  return '<div class="sp-eyebrow">'+esc(s.eyebrow)+'</div><h3 class="sp-title"><i>'+esc(s.roman)+'</i> '+esc(s.name)+' <em>'+esc(s.tag)+'</em></h3>'
   +'<div class="sp-two"><div>'+(s.paragraphs||[]).map(function(t,i){return '<p class="'+(i===0?'sp-lede':'')+'">'+esc(t)+'</p>';}).join('')+((s.words||[]).length?'<div class="sp-words">'+s.words.map(function(w){return '<span>'+esc(w)+'</span>';}).join('')+'</div>':'')+'</div><div>'+(s.refs||[]).map(block).join('')+'</div></div>'
   +((s.specs||[]).length?'<div class="sp-specs">'+s.specs.map(block).join('')+'</div>':'')
   +((s.direction||[]).length?'<div class="sp-dir">'+s.direction.map(block).join('')+'</div>':'')+table+day;
}
function viewBook(p){
  var b=p.book;if(!b)return '<p class="sp-mute">No book order in this plan.</p>';
  return '<div class="sp-eyebrow">'+esc(b.eyebrow)+'</div><h3 class="sp-title">'+esc(b.heading)+'</h3>'+(b.intro?'<p class="sp-lede">'+esc(b.intro)+'</p>':'')
   +'<div class="sp-book">'+(b.pages||[]).map(function(x){return '<div class="'+(x.cut?'cut':'')+'"><span>'+esc(x.pg)+'</span><b>'+esc(x.title)+'</b><small>'+esc(x.sub)+'</small></div>';}).join('')+'</div>';
}
function viewPrep(p){
  var b=p.prep;if(!b)return '<p class="sp-mute">No prep list in this plan.</p>';
  return '<div class="sp-eyebrow">'+esc(b.eyebrow)+'</div><h3 class="sp-title">'+esc(b.heading)+'</h3><div class="sp-prep">'+(b.groups||[]).map(block).join('')+'</div>';
}
function tabsOf(p){
  var t=[['brief','Brief']];
  (p.shoots||[]).forEach(function(s,i){t.push(['s'+i,(s.roman?s.roman+' · ':'')+s.name]);});
  if(p.book)t.push(['book','Book order']);if(p.prep)t.push(['prep','Prep']);
  return t;
}
function bodyFor(p,tab){
  if(tab==='brief')return viewBrief(p);
  if(tab==='book')return viewBook(p);
  if(tab==='prep')return viewPrep(p);
  var m=/^s(\d+)$/.exec(tab);if(m&&p.shoots[+m[1]])return viewShoot(p.shoots[+m[1]]);
  return viewBrief(p);
}


function sharePanel(cur,tabs,id){
  var names={};tabs.forEach(function(t){names[t[0]]=t[1];});
  var on=!!cur.shared_with_model,secs=Array.isArray(cur.shared_sections)?cur.shared_sections:[];
  if(UI.share[id]){
    var def=on?secs:tabs.map(function(t){return t[0];}).filter(function(k){return k!=='brief';});
    return '<div class="sp-share open"><b>Choose what the model can see</b><p>She or he will see a read-only <b>Shoot plan</b> page in the model portal, and get a notice. The brief often has candid notes about the current book, so it starts switched off.</p><div class="sp-checks">'
      +tabs.map(function(t){return '<label><input type="checkbox" data-spk="'+esc(t[0])+'"'+(def.indexOf(t[0])>=0?' checked':'')+'> '+esc(t[1])+'</label>';}).join('')
      +'</div><div class="sp-row"><button type="button" class="sp-btn gold" data-sp="share-save" data-id="'+esc(cur.id)+'">'+(on?'Update what is shared':'Share with model')+'</button><button type="button" class="sp-btn" data-sp="share-cancel">Cancel</button></div></div>';
  }
  if(on)return '<div class="sp-share on"><span><b>Shared with the model</b> · '+secs.map(function(k){return esc(names[k]||k);}).join(', ')+'</span><span class="sp-row"><button type="button" class="sp-btn" data-sp="share-open">Change</button><button type="button" class="sp-btn" data-sp="share-stop" data-id="'+esc(cur.id)+'">Stop sharing</button></span></div>';
  return '<div class="sp-share"><span><b>Private to staff.</b> The model cannot see this plan.</span><button type="button" class="sp-btn" data-sp="share-open">Share with model…</button></div>';
}
async function saveShare(id,planId,shared,sections){
  try{
    var r=await api('/api/agent/shoot-plans',{method:'POST',body:JSON.stringify({organization_slug:org(),action:'share',model_id:id,plan_id:planId,shared:shared,sections:sections})});
    if(!r||r.verified!==true)throw new Error('Not confirmed');
    UI.share[id]=false;toast(shared?'Shared with the model':'No longer shared');await load(id,true);
  }catch(e){toast(String(e&&e.message||e),true);}
}

function render(id){
  var host=document.getElementById('mdv-sp');if(!host||String(host.getAttribute('data-model'))!==String(id))return;
  var st=CACHE[id];
  var head='<header><div><span class="sp-kicker">SHOOT PLAN · STAFF ONLY</span><h2>Shoot list and gameplan</h2></div><div class="sp-tools">'
    +'<button type="button" class="sp-btn gold" data-sp="import">Import treatment (.html)</button><input type="file" id="mdv-sp-file" accept=".html,.htm,text/html" hidden></div></header>';
  if(!st){host.innerHTML=head+'<p class="sp-mute">Loading…</p>';return;}
  if(st.error){host.innerHTML=head+'<p class="sp-warn">'+esc(st.error)+'</p>';return;}
  if(st.needs_setup)head+='<p class="sp-warn">Shoot plans need a one-time setup: run <b>docs/sql/2026-10-22-model-shoot-plans.sql</b> in the Supabase SQL editor, then import again.</p>';
  var plans=st.plans||[];
  if(!plans.length){host.innerHTML=head+'<div class="sp-empty"><b>No shoot plan yet.</b><span>Import a shoot treatment to see the brief, each shoot with its shot list and run of day, the book order and prep here.</span></div>';return;}
  var cur=plans.filter(function(x){return x.id===UI.plan[id];})[0]||plans[0];UI.plan[id]=cur.id;
  var p=cur.plan||{},tabs=tabsOf(p),tab=UI.tab[id];if(!tabs.some(function(t){return t[0]===tab;}))tab=tabs[0][0];UI.tab[id]=tab;
  var sel=plans.length>1?'<select class="sp-sel" data-sp="plan">'+plans.map(function(x){return '<option value="'+esc(x.id)+'"'+(x.id===cur.id?' selected':'')+'>'+esc(x.title)+'</option>';}).join('')+'</select>':'';
  var facts=(p.facts||[]).length?'<dl class="sp-facts">'+p.facts.map(function(f){return '<div><dt>'+esc(f.k)+'</dt><dd>'+esc(f.v)+'</dd></div>';}).join('')+'</dl>':'';
  host.innerHTML=head+'<div class="sp-meta"><div><b>'+esc(cur.title)+'</b><span>'+esc(p.eyebrow||'')+(p.sub?' · '+esc(p.sub):'')+'</span></div>'+sel+'</div>'+facts
    +sharePanel(cur,tabs,id)+'<nav class="sp-tabs" role="tablist">'+tabs.map(function(t){return '<button type="button" role="tab" class="'+(t[0]===tab?'on':'')+'" data-sp="tab" data-t="'+esc(t[0])+'">'+esc(t[1])+'</button>';}).join('')+'</nav>'
    +'<div class="sp-body">'+bodyFor(p,tab)+'</div><footer><span>'+esc(cur.source_name?'From '+cur.source_name+' · ':'')+'Updated '+esc(new Date(cur.updated_at||Date.now()).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}))+'</span><button type="button" class="sp-link" data-sp="remove" data-id="'+esc(cur.id)+'">Remove this plan</button></footer>';
}

async function load(id,force){
  if(!force&&CACHE[id]&&!CACHE[id].error){render(id);return;}
  CACHE[id]=null;render(id);
  try{var r=await api('/api/agent/shoot-plans?organization='+encodeURIComponent(org())+'&model_id='+encodeURIComponent(id));CACHE[id]={plans:r.plans||[],needs_setup:!!r.needs_setup};}
  catch(e){CACHE[id]={error:String(e&&e.message||e)};}
  render(id);
}

async function doImport(file){
  var id=modelId();if(!id||!file)return;
  try{
    var html=await file.text(),plan=parseTreatment(html);
    if(!valid(plan))throw new Error('That file does not look like a shoot treatment. I could not find a brief or any shoots.');
    var r=await api('/api/agent/shoot-plans',{method:'POST',body:JSON.stringify({organization_slug:org(),action:'save',model_id:id,title:plan.title,source_name:file.name,plan:plan})});
    if(!r||r.verified!==true)throw new Error('The plan was not confirmed as saved');
    UI.plan[id]=r.plan&&r.plan.id;UI.tab[id]='brief';
    toast((r.replaced?'Updated: ':'Added: ')+plan.title+' · '+(plan.shoots||[]).length+' shoots, '+countShots(plan)+' shots');
    await load(id,true);
  }catch(e){
    var m=String(e&&e.message||e);
    if(/not set up|needs_setup|model_shoot_plans/i.test(m)){CACHE[id]=Object.assign({},CACHE[id]||{},{plans:(CACHE[id]&&CACHE[id].plans)||[],needs_setup:true});render(id);}
    toast(m,true);
  }
}

document.addEventListener('click',function(e){
  var t=e.target&&e.target.closest&&e.target.closest('#mdv-sp [data-sp]');if(!t)return;
  var id=modelId(),a=t.getAttribute('data-sp');
  if(a==='import'){var f=document.getElementById('mdv-sp-file');if(f){f.value='';f.click();}}
  else if(a==='tab'){UI.tab[id]=t.getAttribute('data-t');render(id);}
  else if(a==='share-open'){UI.share[id]=true;render(id);}
  else if(a==='share-cancel'){UI.share[id]=false;render(id);}
  else if(a==='share-save'){var host=document.getElementById('mdv-sp'),ks=[].map.call(host.querySelectorAll('[data-spk]:checked'),function(c){return c.getAttribute('data-spk');});if(!ks.length){toast('Choose at least one section to share',true);return;}saveShare(id,t.getAttribute('data-id'),true,ks);}
  else if(a==='share-stop'){if(confirm('Stop sharing this plan? It disappears from the model portal.'))saveShare(id,t.getAttribute('data-id'),false,[]);}
  else if(a==='remove'){if(confirm('Remove this shoot plan from the model?'))api('/api/agent/shoot-plans',{method:'POST',body:JSON.stringify({organization_slug:org(),action:'archive',model_id:id,plan_id:t.getAttribute('data-id')})}).then(function(){toast('Plan removed');return load(id,true);}).catch(function(x){toast(String(x&&x.message||x),true);});}
});
document.addEventListener('change',function(e){
  var t=e.target;if(!t)return;
  if(t.id==='mdv-sp-file'&&t.files&&t.files[0])doImport(t.files[0]);
  else if(t.getAttribute&&t.getAttribute('data-sp')==='plan'){UI.plan[modelId()]=t.value;render(modelId());}
});

/* put the section on the Development tab, above Smart Gameplan, whenever Model 360 draws it */
var pending=false;
function mount(){
  pending=false;
  var wrap=document.querySelector('.m360-gpwrap');if(!wrap)return;
  var id=modelId();if(!id)return;
  var have=document.getElementById('mdv-sp');
  if(have&&String(have.getAttribute('data-model'))===String(id)&&have.nextElementSibling===wrap)return;
  if(have)have.remove();
  var s=document.createElement('section');s.id='mdv-sp';s.className='sp';s.setAttribute('data-model',id);
  wrap.parentNode.insertBefore(s,wrap);
  load(id);
}
new MutationObserver(function(){if(pending)return;pending=true;requestAnimationFrame(mount);}).observe(document.documentElement,{childList:true,subtree:true});

window.MDV_SHOOT_PLAN={parse:parseTreatment,mount:mount};
})();
