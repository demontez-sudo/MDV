/* Model 360: Visa / Travel / Development buttons stay on this model (never the all-models desks). */
(function(){
if(window.__MDV_M360__)return;window.__MDV_M360__=1;
function host(){return document.getElementById('p-modelpage');}
function modelId(){var k=window._openModelKey,m=window.MODELS&&window.MODELS[k];return m&&m._veuxId||null;}
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
