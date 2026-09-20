/* Model 360: Visa / Travel / Development buttons stay on this model (never the all-models desks). */
(function(){
if(window.__MDV_M360__)return;window.__MDV_M360__=1;
function host(){return document.getElementById('p-modelpage');}
function modelId(){if(window._veuxV10ModelId)return window._veuxV10ModelId;var k=window._openModelKey,m=window.MODELS&&window.MODELS[k];return m&&m._veuxId||null;}
function tab(t){if(window.VEUX_V156&&VEUX_V156.modelTab){VEUX_V156.modelTab(t);var c=document.getElementById('v156-model-content');if(c&&c.scrollIntoView){try{c.scrollIntoView({block:'start',behavior:'smooth'});}catch(_e){}}return true;}return false;}
function deskFor(b){var card=b.closest('.v155-card');var t=String(card&&card.textContent||'').toLowerCase();return /visa|work authorization/.test(t.slice(0,80))?'visa':'travel';}
document.addEventListener('click',function(e){
  var h=host();if(!h||!e.target||!h.contains(e.target))return;
  var mt=e.target.closest('.v156-tab[data-model-tab]');
  if(mt){e.preventDefault();e.stopImmediatePropagation();tab(mt.dataset.modelTab);return;}
  var qb=e.target.closest('button,a,[role="button"]');
  if(qb&&!qb.closest('.v156-tabs')){var qt=String(qb.textContent||'').replace(/\s+/g,' ').trim().toLowerCase().replace(/^(open|view)\s+/,'').replace(/\s*→$/,'');if(qt==='visa'||qt==='travel'||qt==='development'){e.preventDefault();e.stopImmediatePropagation();tab(qt);return;}}
  var nav=e.target.closest('[data-vx161065-nav]');
  if(nav){var d=String(nav.getAttribute('data-vx161065-nav')||'');if(/visa/.test(d)&&!/^(tasks|development)$/.test(d)){e.preventDefault();e.stopImmediatePropagation();tab('visa');return;}if(d==='travel'||d==='globalmobility'){e.preventDefault();e.stopImmediatePropagation();tab('travel');return;}}
  var b=e.target.closest('button');
  if(b&&/mobility desk/i.test(b.textContent)&&b.closest('.v155-card')){
    e.preventDefault();e.stopImmediatePropagation();
    var id=modelId(),dk=deskFor(b);
    if(id&&window.VEUX_MOBILITY_1682&&VEUX_MOBILITY_1682.openDesk)VEUX_MOBILITY_1682.openDesk(id,dk);
  }
},true);

/* ---- Add to Package: creates a real draft package for this model ---- */
function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
function modelName(){var h=host(),t=h&&h.querySelector('.v156-model-title h1');return t?t.textContent.trim():'Model';}
function toast(m){try{if(window.toast)return window.toast(m);}catch(_e){}}
function closePkg(){var m=document.getElementById('mdv-pkg-modal');if(m)m.remove();}
function openPkg(){
  var id=modelId();if(!id){toast('Open a model first.');return;}
  closePkg();var n=modelName(),m=document.createElement('div');m.id='mdv-pkg-modal';
  m.innerHTML='<div class="mp-back" data-mp-close></div><section class="mp-card" role="dialog" aria-modal="true" aria-label="Add to package"><header><div><small>Package</small><h2>Add '+esc(n)+' to a package</h2></div><button type="button" data-mp-close aria-label="Close">×</button></header><div class="mp-body"><label><span>New package name</span><input id="mp-title" value="'+esc(n)+' — Casting package" maxlength="120"></label><div class="mp-row"><label><span>Type</span><select id="mp-type"><option value="casting">Casting</option><option value="client">Client</option><option value="editorial">Editorial</option><option value="runway">Runway / show</option></select></label></div><p class="mp-hint">Creates a draft with this model and their best public media selected. You can add more models, pick a client and send it from the Package Library.</p><p class="mp-err" hidden></p></div><footer><button type="button" data-mp-close>Cancel</button><button type="button" data-mp-lib>Open package library</button><button type="button" class="primary" data-mp-create>Create draft package</button></footer></section>';
  document.body.appendChild(m);var t=m.querySelector('#mp-title');t.focus();t.select();
  m.addEventListener('click',function(e){
    if(e.target.closest('[data-mp-close]')){closePkg();return;}
    if(e.target.closest('[data-mp-lib]')){closePkg();if(window.navTo)navTo('multipackage');return;}
    var c=e.target.closest('[data-mp-create]');if(!c)return;
    var title=m.querySelector('#mp-title').value.trim(),err=m.querySelector('.mp-err');
    if(!title){err.hidden=false;err.textContent='Give the package a name.';return;}
    c.disabled=true;c.textContent='Creating…';err.hidden=true;
    var V=window.VEUX_AGENT_V4,slug=(V&&V.state&&V.state.org&&V.state.org.slug)||'maison-de-veux';
    V.api('/api/agent/packages',{method:'POST',body:JSON.stringify({action:'create',organization_slug:slug,title:title,model_ids:[id],status:'draft',package_type:m.querySelector('#mp-type').value})}).then(function(r){
      var pk=r&&r.package;
      m.querySelector('.mp-card').innerHTML='<header><div><small>Package created</small><h2>'+esc(pk&&pk.title||title)+'</h2></div><button type="button" data-mp-close aria-label="Close">×</button></header><div class="mp-body"><p class="mp-ok">'+esc(n)+' is in a new draft package'+(r&&r.media_count?' with '+r.media_count+' media selected':'')+'. Add more models, choose the client and send it from the Package Library.</p></div><footer><button type="button" data-mp-close>Stay on profile</button><button type="button" class="primary" data-mp-lib>Open package library</button></footer>';
    }).catch(function(e){c.disabled=false;c.textContent='Create draft package';err.hidden=false;err.textContent=String(e&&e.message||e||'Could not create the package.');});
  });
}
document.addEventListener('click',function(e){
  var h=host();if(!h||!e.target||!h.contains(e.target))return;
  var b=e.target.closest('button');if(!b||!/^add to package$/i.test(b.textContent.trim()))return;
  e.preventDefault();e.stopImmediatePropagation();openPkg();
},true);
document.addEventListener('keydown',function(e){if(e.key==='Escape')closePkg();});
function polish(){
  var h=host();if(!h)return;
  h.querySelectorAll('.v155-card>header>button').forEach(function(b){
    if(b.dataset.mdvM360||!/mobility desk/i.test(b.textContent))return;
    b.dataset.mdvM360='1';var dk=deskFor(b);b.textContent=(dk==='visa'?'Open Visa desk':'Open Travel desk')+' · this model →';
  });
  h.querySelectorAll('.v156-tab[data-model-tab]').forEach(function(b){b.dataset.tone=b.dataset.modelTab;});
}
setInterval(polish,1200);window.addEventListener('veux:page-rendered',function(){setTimeout(polish,60);});
})();
