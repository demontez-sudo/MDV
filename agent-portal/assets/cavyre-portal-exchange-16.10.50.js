/* CAVYRE 16.10.50 — Portal Exchange */
(function(){
'use strict';if(window.__CAVYRE_EXCHANGE_161050__)return;window.__CAVYRE_EXCHANGE_161050__=true;
function api(){return window.VEUX_AGENT_V4&&window.VEUX_AGENT_V4.api}
function org(){return window.VEUX_AGENT_V4&&window.VEUX_AGENT_V4.state&&window.VEUX_AGENT_V4.state.org||{}}
function mid(){return window._veuxV10ModelId||window._openModelId||null}
function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function toast(v){try{return window.toast(v)}catch(e){console.info(v)}}
function modal(){
 var id=mid();if(!id)return toast('Open a model profile first.');
 var old=document.getElementById('cvx-comp-modal');if(old)old.remove();
 var x=document.createElement('div');x.id='cvx-comp-modal';x.className='cvx-modal-bg';
 x.innerHTML='<div class="cvx-modal"><header><div><small>PORTAL EXCHANGE · OFFICIAL ASSET</small><h2>Publish Comp Card</h2><p>Securely publish the agency-approved PDF directly to this model’s portal.</p></div><button onclick="document.getElementById(\'cvx-comp-modal\').remove()">×</button></header><div class="cvx-form"><label>Comp Card PDF<input id="cvx-file" type="file" accept="application/pdf"></label><label>Market<select id="cvx-market"><option>Global</option><option>Paris</option><option>New York</option></select></label><label>Edition / Label<input id="cvx-label" placeholder="Official Comp Card"></label><label class="cvx-check"><input id="cvx-current" type="checkbox" checked> Mark as current edition</label><div class="cvx-note">Publishing makes this card visible in the model’s <b>Official Comp Card</b> profile section and enables secure PDF download.</div></div><footer><button onclick="document.getElementById(\'cvx-comp-modal\').remove()">Cancel</button><button class="primary" onclick="CAVYRE_EXCHANGE.publish()">Publish to Model Portal</button></footer><div id="cvx-error"></div></div>';
 document.body.appendChild(x);
}
async function publish(){
 var f=document.getElementById('cvx-file')?.files?.[0],market=document.getElementById('cvx-market')?.value||'Global',label=document.getElementById('cvx-label')?.value.trim()||'Official Comp Card',current=!!document.getElementById('cvx-current')?.checked,id=mid(),o=org();
 if(!f||f.type!=='application/pdf')return err('Choose a PDF comp card.');
 if(!id||!o.id)return err('Model or organization context is unavailable.');
 var btn=document.querySelector('#cvx-comp-modal footer .primary');if(btn){btn.disabled=true;btn.textContent='Publishing…'}
 try{
  var create=await api()('/api/storage/upload-url',{method:'POST',body:JSON.stringify({organization_id:o.id,name:f.name,mime_type:f.type,size_bytes:f.size,category:'Comp Card',visibility:'model_shared',resource_type:'model',resource_id:id,visible_to_model:true,visible_to_partner:false})});
  if(!create.signed_url)throw new Error('Secure upload URL was not created.');
  var up=await fetch(create.signed_url,{method:'PUT',headers:{'Content-Type':f.type},body:f});if(!up.ok)throw new Error('PDF upload failed ('+up.status+').');
  var fin=await api()('/api/storage/finalize',{method:'POST',body:JSON.stringify({upload_session_id:create.upload_session_id,relationship:'comp_card',metadata:{market:market,current:current,asset_type:'comp_card',display_label:label,published_to_model:true,published_at:new Date().toISOString()}})});
  if(!fin.document)throw new Error('Comp card finalization could not be verified.');
  toast('✓ Comp Card published to Model Portal');document.getElementById('cvx-comp-modal')?.remove();
 }catch(e){err(e.message||String(e));if(btn){btn.disabled=false;btn.textContent='Publish to Model Portal'}}
}
function err(v){var e=document.getElementById('cvx-error');if(e)e.textContent=v;else toast(v)}
function inject(){
 var page=document.getElementById('p-modelpage');if(!page||!page.classList.contains('on')||!mid())return;
 if(page.querySelector('.cvx-comp-publisher'))return;
 var head=page.querySelector('.v155-head-actions,.v10-model-actions,.model-actions,header');
 if(!head)return;
 var b=document.createElement('button');b.className='cvx-comp-publisher';b.textContent='PUBLISH COMP CARD';b.onclick=modal;head.appendChild(b);
}
window.CAVYRE_EXCHANGE={openCompPublisher:modal,publish:publish};
new MutationObserver(function(){setTimeout(inject,80)}).observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['class']});
setInterval(inject,1200);
})();