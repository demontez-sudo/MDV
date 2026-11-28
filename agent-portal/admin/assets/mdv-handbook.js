/* Staff preview of a model's private handbook: shows exactly what the model sees in their Gameplan.
   Opened from the Handbooks card on Model 360 > Development:  MDV_HANDBOOK.open(modelId, handbookId)
   The handbook is fetched signed in (development.read) and shown in a sandboxed frame. */
(function(){
'use strict';
if(window.MDV_HANDBOOK)return;
function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
function bridge(){var b=window.VEUX_AGENT_V4;if(!b||!b.api)throw new Error('Secure session is not ready');return b;}
function org(){try{return bridge().state.org.slug||'maison-de-veux';}catch(e){return 'maison-de-veux';}}
function open(modelId,id){
  var o=document.createElement('div');o.className='hbp';o.setAttribute('role','dialog');o.setAttribute('aria-modal','true');o.setAttribute('aria-label','Handbook preview');
  o.innerHTML='<div class="hbp-bar"><div><b>Handbook</b><small>Staff preview</small></div><button type="button" class="hbp-x" aria-label="Close">×</button></div><div class="hbp-body"><p class="hbp-msg">Opening the handbook…</p></div>';
  document.documentElement.appendChild(o);document.documentElement.classList.add('hbp-open');
  function close(){o.remove();document.documentElement.classList.remove('hbp-open');document.removeEventListener('keydown',key,true);}
  function key(e){if(e.key==='Escape'){e.preventDefault();e.stopPropagation();close();}}
  document.addEventListener('keydown',key,true);o.querySelector('.hbp-x').onclick=close;
  bridge().api('/api/agent/gameplan/v1?organization='+encodeURIComponent(org())+'&model_id='+encodeURIComponent(modelId)+'&handbook='+encodeURIComponent(id)+'&_t='+Date.now(),{method:'GET',headers:{},__fresh:true}).then(function(r){
    if(!r||!r.html)throw new Error('The handbook could not be opened.');
    o.querySelector('.hbp-bar b').textContent=r.title||'Handbook';
    var who=r.model_name?esc(r.model_name):'the model';
    var body=o.querySelector('.hbp-body');
    body.innerHTML='<p class="hbp-note">Staff preview. This is what '+who+' sees in their portal. Only '+who+' and the agency can open it.</p><iframe class="hbp-f" title="'+esc(r.title||'Handbook')+'" sandbox="allow-scripts"></iframe>';
    body.querySelector('iframe').srcdoc=r.html;
  }).catch(function(e){o.querySelector('.hbp-body').innerHTML='<p class="hbp-msg">'+esc((e&&e.message)||e)+'</p>';});
}
window.MDV_HANDBOOK={open:open};
})();
