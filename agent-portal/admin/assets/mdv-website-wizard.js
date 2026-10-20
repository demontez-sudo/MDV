/* Put a model on the website in three steps: 1 Photos, 2 Page, 3 Go live.
   Replaces the long Website profile form (still reachable as "All settings"). Uses the same endpoints as Model 360 media and the website profile. */
(function(){
'use strict';
if(window.__MDV_WW__)return;window.__MDV_WW__=true;
var W={d:null,step:1,check:null,busy:false,msg:''};
var BOOK=['headshot','editorial','runway','commercial','portfolio','polaroid','book'];

function bridge(){return window.VEUX_AGENT_V4;}
function org(){var b=bridge();return (b&&b.state&&b.state.org&&b.state.org.slug)||'maison-de-veux';}
function modelId(){return window._veuxV10ModelId||null;}
function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c];});}
function api(p,o){return bridge().api(p,o||{method:'GET',headers:{}});}
function post(p,b){return api(p,{method:'POST',body:JSON.stringify(Object.assign({organization_slug:org()},b||{}))});}
function mediaApi(b){return post('/api/agent/model-portfolio/v10',Object.assign({model_id:modelId()},b));}
function toast(t,bad){try{if(window.toast)return window.toast(t);}catch(e){}var d=document.createElement('div');d.className='ww-toast'+(bad?' bad':'');d.textContent=t;document.documentElement.appendChild(d);setTimeout(function(){d.remove();},2600);}
function eligible(cat,type){var c=String(cat||'').toLowerCase();return String(type||'').toLowerCase()==='video'||/digital|motion/.test(c)||BOOK.indexOf(c)>=0;}
function isDigital(x){return /digital/i.test(x.category||'')||String(x.media_type||'').toLowerCase()==='video';}
function media(){return (W.d&&W.d.model&&W.d.model.media)||[];}
function profile(){return (W.d&&W.d.model&&W.d.model.public_profile)||{};}
function nameOf(){return (W.d&&W.d.model&&W.d.model.display_name)||'her';}
function first(){return String(nameOf()).split(' ')[0];}
function can(){return !!(W.d&&W.d.access&&W.d.access['public_profiles.manage']);}
function val(id){var e=document.getElementById(id);return e?String(e.value||'').trim():'';}
function chk(id){var e=document.getElementById(id);return !!(e&&e.checked);}

async function load(){W.d=await api('/api/agent/model-360?organization='+encodeURIComponent(org())+'&model_id='+encodeURIComponent(modelId()));}
async function loadCheck(){
  try{W.check=await api('/api/agent/website/check?organization='+encodeURIComponent(org())+'&model_id='+encodeURIComponent(modelId()));}
  catch(e){W.check={error:String(e&&e.message||e)};}
}

/* ---------- shell ---------- */
function steps(){
  var names=['Photos','Page','Go live'];
  return '<ol class="ww-steps">'+names.map(function(n,i){var k=i+1;return '<li class="'+(W.step===k?'on':W.step>k?'done':'')+'"><button type="button" data-ww="go" data-n="'+k+'"><i>'+(W.step>k?'✓':k)+'</i><span>'+n+'</span></button></li>';}).join('')+'</ol>';
}
function shell(body,foot){
  return '<div class="ww-card" role="dialog" aria-modal="true" aria-label="Put on the website"><header><div><small>Website</small><h2>Put '+esc(first())+' on the website</h2></div><button type="button" class="ww-x" data-ww="close" aria-label="Close">×</button></header>'+steps()+'<div class="ww-body">'+body+'</div><footer>'+foot+'</footer></div>';
}
function paint(){
  var m=document.getElementById('ww-modal');if(!m)return;
  var body,foot;
  if(W.step===1){body=photosStep();foot='<a href="#" class="ww-link" data-ww="advanced">All settings</a><span class="ww-sp"></span><button type="button" class="ww-btn" data-ww="close">Close</button><button type="button" class="ww-btn gold" data-ww="next"'+(hasMain()?'':' disabled')+'>Next: Page →</button>';}
  else if(W.step===2){body=pageStep();foot='<a href="#" class="ww-link" data-ww="advanced">All settings</a><span class="ww-sp"></span><button type="button" class="ww-btn" data-ww="back">← Back</button><button type="button" class="ww-btn gold" data-ww="savepage">Save and continue →</button>';}
  else{body=liveStep();foot='<span class="ww-sp"></span><button type="button" class="ww-btn" data-ww="back">← Back</button>'+(W.check&&W.check.live?'<button type="button" class="ww-btn gold" data-ww="close">Done</button>':'');}
  m.innerHTML=shell(body,foot);
  var c=m.querySelector('.ww-card');if(c)c.style.maxHeight=Math.max(420,innerHeight-40)+'px';
}

/* ---------- step 1: photos ---------- */
function hasMain(){return media().some(function(x){return x.is_primary;});}
function photosStep(){
  var list=media(),on=list.filter(function(x){return x.is_public;}).length;
  var head='<h3>Which photos should be on her page?</h3><p class="ww-sub">Pick one <b>main photo</b> (the big photo at the top), then switch on any others. Switched-off photos stay private in the portal.</p>';
  if(!can())head+='<p class="ww-warn">You can look at this, but only people who manage public profiles can change it.</p>';
  if(!list.length)return head+'<div class="ww-empty">No photos yet. Add photos in the Media tab first, then come back.</div>';
  var grid=list.map(function(x){
    var vid=String(x.media_type||'').toLowerCase()==='video',pub=!!x.is_public,main=!!x.is_primary,id=esc(x.id);
    return '<div class="ww-ph'+(pub?' pub':'')+(main?' main':'')+'"><div class="ww-img">'+(vid?'<span class="ww-vid">▶ Video</span>':'<img loading="lazy" src="'+esc(x.url||'')+'" alt="">')+'<button type="button" class="ww-star" data-ww="main" data-id="'+id+'" title="'+(main?'This is her main photo':'Make this her main photo')+'"'+(vid||!can()?' disabled':'')+'>'+(main?'★ Main photo':'☆ Make main')+'</button></div>'
     +'<div class="ww-row"><label class="ww-sw"><input type="checkbox" data-ww="pub" data-id="'+id+'"'+(pub?' checked':'')+(main||!can()?' disabled':'')+'><i></i><span>'+(main?'On website (main)':'On website')+'</span></label>'
     +(pub&&!main?'<div class="ww-seg"><button type="button" data-ww="kind" data-id="'+id+'" data-k="editorial" class="'+(isDigital(x)?'':'on')+'">Editorial</button><button type="button" data-ww="kind" data-id="'+id+'" data-k="digital" class="'+(isDigital(x)?'on':'')+'">Digitals</button></div>':'')+'</div></div>';
  }).join('');
  return head+'<div class="ww-count"><b>'+on+'</b> on the website · '+(hasMain()?'Main photo chosen ✓':'<span class="bad">Choose a main photo to continue</span>')+'</div><div class="ww-grid">'+grid+'</div>';
}
async function mediaAct(fn){
  if(W.busy)return;W.busy=true;
  try{await fn();await load();}catch(e){toast(String(e&&e.message||e),true);}
  W.busy=false;paint();
}
function find(id){return media().filter(function(x){return String(x.id)===String(id);})[0];}
function togglePub(id){var x=find(id);if(!x||x.is_primary)return;mediaAct(async function(){var t=!x.is_public,b={action:'update_media',media_id:id,is_public:t};if(t&&!eligible(x.category,x.media_type))b.category='Editorial';await mediaApi(b);});}
function setKind(id,k){var x=find(id);if(!x)return;mediaAct(async function(){await mediaApi({action:'update_media',media_id:id,category:k==='digital'?'Digital':'Editorial',is_public:true});});}
function makeMain(id){
  var x=find(id);if(!x)return;
  mediaAct(async function(){
    var target=id;
    /* the main photo is her Headshot: change this photo in place instead of making a second copy */
    if(String(x.category||'').toLowerCase()!=='headshot')await mediaApi({action:'update_media',media_id:id,category:'Headshot',is_public:true});
    await mediaApi({action:'set_primary_media',media_id:target});
    toast('Main photo updated');
  });
}

/* ---------- step 2: page ---------- */
function pageStep(){
  var p=profile(),w=(W.d&&W.d.website_profile)||{},m=(W.d&&W.d.model)||{},route=w.route_key||m.legacy_key||String(first()).toLowerCase().replace(/[^a-z0-9]/g,''),dis=can()?'':' disabled';
  function tog(id,label,on){return '<label class="ww-sw"><input type="checkbox" id="'+id+'"'+(on?' checked':'')+dis+'><i></i><span>'+label+'</span></label>';}
  return '<h3>Her page</h3><p class="ww-sub">Only the address matters. Everything else is optional.</p>'
   +'<label class="ww-f"><span>Website address</span><div class="ww-addr"><em>maisondeveux.com/</em><input id="ww-route" value="'+esc(route)+'" autocomplete="off"'+dis+'></div></label>'
   +'<label class="ww-f"><span>Headline <em>(optional)</em></span><input id="ww-headline" value="'+esc(p.headline||'')+'" placeholder="A line under her name"'+dis+'></label>'
   +'<label class="ww-f"><span>About her <em>(optional)</em></span><textarea id="ww-bio" rows="4" placeholder="A few sentences"'+dis+'>'+esc(p.bio||'')+'</textarea></label>'
   +'<div class="ww-tog">'+tog('ww-meas','Show measurements',p.show_measurements!==false)+tog('ww-mkt','Show her city',p.show_market!==false)+tog('ww-soc','Show social links',p.show_socials!==false)+tog('ww-agent','Show agent contact',p.show_agent_contact!==false)+'</div>'
   +'<p class="ww-msg" id="ww-msg">'+esc(W.msg||'')+'</p>';
}
async function savePage(){
  if(W.busy)return;
  if(!can()){W.step=3;await loadCheck();paint();return;}
  var route=val('ww-route').toLowerCase().replace(/[^a-z0-9]/g,'');
  if(!route){W.msg='Add a website address.';paint();return;}
  W.busy=true;var btn=document.querySelector('#ww-modal [data-ww=savepage]');if(btn){btn.disabled=true;btn.textContent='Saving…';}
  try{
    var p=profile();
    var out=await post('/api/agent/model-360',{action:'create_website_profile',model_id:modelId(),route_key:route,public_profile:{published:!!p.published,headline:val('ww-headline')||null,bio:val('ww-bio')||null,show_measurements:chk('ww-meas'),show_market:chk('ww-mkt'),show_socials:chk('ww-soc'),show_agent_contact:chk('ww-agent'),template_key:'editorial-dark'}});
    if(!out||out.verified!==true)throw new Error('Not confirmed as saved');
    W.msg='';await load();W.step=3;W.check=null;W.busy=false;paint();await loadCheck();paint();
  }catch(e){W.msg=String(e&&e.message||e);W.busy=false;paint();}
}

/* ---------- step 3: go live ---------- */
function liveStep(){
  var c=W.check;
  if(!c)return '<h3>Go live</h3><p class="ww-sub">Checking what the website needs…</p>';
  if(c.error)return '<h3>Go live</h3><p class="ww-warn">Could not run the check: '+esc(c.error)+'</p><button type="button" class="ww-btn" data-ww="recheck">Try again</button>';
  var rows=(c.checks||[]).map(function(k){return '<div class="ww-ck '+(k.ok?'ok':'bad')+'"><i>'+(k.ok?'✓':'✕')+'</i><b>'+esc(k.label)+'</b><span>'+esc(k.detail||'')+'</span></div>';}).join('');
  var manual=(c.manual||[]).map(function(m){return '<div class="ww-man"><b>'+esc(m.label)+'</b> — '+esc(m.how)+'</div>';}).join('');
  var head=c.live?'<div class="ww-live ok"><b>'+esc(first())+' is live on the website</b><a href="'+esc(c.url)+'" target="_blank" rel="noopener">'+esc(c.url)+'</a></div>'
    :'<div class="ww-live"><b>Not on the website yet</b><span>The public site says: '+esc(c.public_site_says||'not found')+'</span></div>';
  var pages=(c.on_city_pages||[]).length?'<p class="ww-sub">City pages: '+c.on_city_pages.map(function(p){return esc(p.market)+(p.listed?' ✓':' ✕');}).join(' · ')+'</p>':'';
  var go=c.live?'':(can()?'<button type="button" class="ww-btn gold wide" data-ww="golive"'+(W.busy?' disabled':'')+'>'+(W.busy?'Working…':'Put '+esc(first())+' on the website')+'</button>':'');
  return '<h3>Go live</h3>'+head+'<div class="ww-cks">'+rows+'</div>'+pages+manual+'<div class="ww-golive">'+go+'<button type="button" class="ww-btn" data-ww="recheck">Check again</button></div>';
}
async function goLive(){
  if(W.busy)return;W.busy=true;paint();
  try{var r=await post('/api/agent/website/check',{action:'make_live',model_id:modelId()});W.check=r;await load();toast(r.live?'Live on the website':'Saved. Not live yet, see what is left below',!r.live);}
  catch(e){toast(String(e&&e.message||e),true);}
  W.busy=false;paint();
}

/* ---------- open / events ---------- */
function close(){var m=document.getElementById('ww-modal');if(m)m.remove();document.documentElement.classList.remove('ww-lock');}
async function open(){
  if(!modelId()){alert('Open a model first');return;}
  close();W.step=1;W.check=null;W.msg='';W.busy=false;
  var m=document.createElement('div');m.id='ww-modal';m.className='ww-modal';m.innerHTML='<div class="ww-card"><div class="ww-body"><p class="ww-sub">Loading…</p></div></div>';
  document.documentElement.appendChild(m);document.documentElement.classList.add('ww-lock');
  try{await load();}catch(e){close();alert(String(e&&e.message||e));return;}
  paint();
}
document.addEventListener('click',function(e){
  var t=e.target&&e.target.closest&&e.target.closest('#ww-modal [data-ww]');
  if(!t){if(e.target&&e.target.id==='ww-modal')close();return;}
  var a=t.getAttribute('data-ww');
  if(a==='pub')return; /* checkbox handled on change */
  if(a==='advanced')e.preventDefault();
  if(a==='close')close();
  else if(a==='next'){if(hasMain()){W.step=2;paint();}}
  else if(a==='back'){W.step=Math.max(1,W.step-1);paint();}
  else if(a==='go'){var n=+t.getAttribute('data-n');if(n<=1||hasMain()){W.step=n;if(n===3){W.check=null;paint();loadCheck().then(paint);}else paint();}}
  else if(a==='main')makeMain(t.getAttribute('data-id'));
  else if(a==='kind')setKind(t.getAttribute('data-id'),t.getAttribute('data-k'));
  else if(a==='savepage')savePage();
  else if(a==='golive')goLive();
  else if(a==='recheck'){W.check=null;paint();loadCheck().then(paint);}
  else if(a==='advanced'){close();if(window.VEUX_V16917&&VEUX_V16917.websiteAdvanced)VEUX_V16917.websiteAdvanced();}
});
document.addEventListener('change',function(e){var t=e.target;if(t&&t.getAttribute&&t.getAttribute('data-ww')==='pub')togglePub(t.getAttribute('data-id'));});
document.addEventListener('keydown',function(e){if(e.key==='Escape'&&document.getElementById('ww-modal'))close();});

/* take over the Website profile entry points */
function hook(){
  var v=window.VEUX_V16917;if(!v||v.__ww)return;
  v.websiteAdvanced=v.website;v.website=open;v.__ww=true;
}
hook();document.addEventListener('veux:shell-ready',hook);
var n=0,t=setInterval(function(){hook();if((window.VEUX_V16917&&window.VEUX_V16917.__ww)||++n>60)clearInterval(t);},500);
window.MDV_WEBSITE_WIZARD={open:open};
})();
