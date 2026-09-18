/* CAVYRE 16.12.18 — Model Access + Profile Control */
(function(){
'use strict';if(window.__CAVYRE_MODEL_CONTROL_161218__)return;window.__CAVYRE_MODEL_CONTROL_161218__=1;
function bridge(){if(!window.VEUX_AGENT_V4||typeof VEUX_AGENT_V4.api!=='function')throw new Error('Secure Agent connection is loading.');return VEUX_AGENT_V4}
function org(){try{return bridge().state.org.slug||'maison-de-veux'}catch(e){return'maison-de-veux'}}
function modelId(){
 var id=window._veuxV10ModelId||window.__CURRENT_MODEL_ID__||null;
 try{if(!id&&window.VEUX_V155&&VEUX_V155.state)id=VEUX_V155.state.modelId||VEUX_V155.state.selectedModelId||null}catch(e){}
 try{if(!id&&window.VEUX_V156&&VEUX_V156.state)id=VEUX_V156.state.modelId||VEUX_V156.state.selectedModelId||null}catch(e){}
 try{if(!id&&location.hash){var m=location.hash.match(/model(?:page|360)?[\/:=-]+([a-f0-9-]{20,})/i);if(m)id=m[1]}}catch(e){}
 return id;
}
function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]})}
async function api(path,opt){return bridge().api(path,opt||{method:'GET',headers:{}})}
async function post(path,body){var out=await api(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(Object.assign({organization_slug:org()},body||{}))});if(!out||out.verified!==true)throw new Error('Change was not verified as saved.');return out}
function close(id){var n=document.getElementById(id);if(n)n.remove()}
function shell(id,k,title,body){close(id);document.body.insertAdjacentHTML('beforeend','<div id="'+id+'" class="cvy161218-back"><div class="cvy161218-modal"><header><div><small>'+esc(k)+'</small><h2>'+title+'</h2></div><button data-close>×</button></header><main>'+body+'</main></div></div>');var r=document.getElementById(id);r.querySelector('[data-close]').onclick=function(){close(id)};r.onclick=function(e){if(e.target===r)close(id)};return r}
function field(label,id,val,type){return '<label><span>'+label+'</span><input id="'+id+'" type="'+(type||'text')+'" value="'+esc(val||'')+'"></label>'}
async function editProfile(){
 var id=modelId();if(!id)return alert('Select a model first.');
 try{
  var d=await api('/api/agent/model-360?organization='+encodeURIComponent(org())+'&model_id='+encodeURIComponent(id)),m=d.model||{},p=d.private_profile||d.private||{};
  var body='<div class="cvy161218-grid">'+
   field('Display Name','cvy-m-name',m.display_name)+field('First Name','cvy-m-first',m.first_name)+field('Last Name','cvy-m-last',m.last_name)+
   '<label><span>Gender</span><select id="cvy-m-gender"><option value="">Not set</option><option>Women</option><option>Men</option><option>Nonbinary</option></select></label>'+
   field('Status','cvy-m-status',m.status)+field('Location / Base','cvy-m-location',m.location)+field('Represented Since','cvy-m-since',m.represented_since,'date')+
   field('Email','cvy-m-email',p.email,'email')+field('Phone','cvy-m-phone',p.phone,'tel')+field('WhatsApp','cvy-m-whatsapp',p.whatsapp,'tel')+
   field('Instagram','cvy-m-instagram',p.instagram)+field('Nationality','cvy-m-nationality',p.nationality)+
   '<label class="wide"><span>Internal Notes</span><textarea id="cvy-m-notes">'+esc(p.internal_notes||'')+'</textarea></label></div>'+
   '<div class="cvy161218-actions"><button data-cancel>Cancel</button><button class="primary" data-save>Save Profile</button></div><div class="cvy161218-error" data-error></div>';
  var root=shell('cvy-model-profile-161218','MODEL 360 · AGENT CONTROL','Edit Model Profile',body);
  var g=root.querySelector('#cvy-m-gender');if(g)g.value=m.gender||'';
  root.querySelector('[data-cancel]').onclick=function(){close('cvy-model-profile-161218')};
  root.querySelector('[data-save]').onclick=async function(){var b=this,err=root.querySelector('[data-error]');b.disabled=true;err.textContent='';try{
   var v=function(x){return (root.querySelector(x)?.value||'').trim()};
   await post('/api/agent/model-360',{action:'update_profile',model_id:id,profile:{display_name:v('#cvy-m-name'),first_name:v('#cvy-m-first'),last_name:v('#cvy-m-last'),gender:v('#cvy-m-gender'),status:v('#cvy-m-status'),location:v('#cvy-m-location'),represented_since:v('#cvy-m-since')||null},private_profile:{email:v('#cvy-m-email')||null,phone:v('#cvy-m-phone')||null,whatsapp:v('#cvy-m-whatsapp')||null,instagram:v('#cvy-m-instagram')||null,nationality:v('#cvy-m-nationality')||null,internal_notes:v('#cvy-m-notes')||null}});
   close('cvy-model-profile-161218');if(window.toast)toast('✓ Model profile updated and verified');if(window.renderModel360156)renderModel360156();
  }catch(e){err.textContent=e.message||e;b.disabled=false}};
 }catch(e){alert(e.message||e)}
}
function accessPanel(a,temp){
 var linked=!!a.linked,dis=!!a.portal_disabled;
 return '<div class="cvy161218-accessgrid"><div><span>Status</span><b>'+esc(a.status||'—')+'</b></div><div><span>Authentication</span><b>'+esc(a.authentication||'—')+'</b></div><div><span>Login Email</span><b>'+esc(a.email||a.suggested_email||'—')+'</b></div><div><span>Last Login</span><b>'+esc(a.last_login?new Date(a.last_login).toLocaleString():'—')+'</b></div></div>'+
 (!linked?'<div class="cvy161218-repair"><b>LOGIN IS NOT LINKED</b><p>Create or reconnect this model’s CAVYRE login without changing the model profile.</p>'+field('Model Login Email','cvy-access-email',a.suggested_email||a.email||'','email')+'<button class="primary" data-link>Repair / Create Login</button></div>':
 '<div class="cvy161218-actions"><button class="primary" data-temp>Generate Temporary Password</button><button data-reset>Send Reset Email</button><button data-toggle>'+(dis?'Enable Portal Access':'Disable Portal Access')+'</button></div>')+
 (temp?'<div class="cvy161218-temp"><span>DISPLAY ONCE</span><code>'+esc(temp)+'</code><button data-copy>Copy Login Details</button></div>':'')+'<div class="cvy161218-error" data-error></div>';
}
async function openAccess(temp){
 var id=modelId();if(!id)return alert('Select a model first.');
 var existing=document.getElementById('cvy-model-access-161218'),root=existing||shell('cvy-model-access-161218','MODEL PORTAL · AUTHENTICATION','Account & Access','<div data-body>Loading…</div>');
 try{
  var out=await api('/api/agent/model-access?organization='+encodeURIComponent(org())+'&model_id='+encodeURIComponent(id)),a=out.access||{},body=root.querySelector('[data-body]')||root.querySelector('main');
  body.innerHTML=accessPanel(a,temp);bindAccess(root,a,id);
 }catch(e){(root.querySelector('[data-body]')||root.querySelector('main')).innerHTML='<div class="cvy161218-error">'+esc(e.message||e)+'</div>'}
}
function bindAccess(root,a,id){
 var err=root.querySelector('[data-error]');
 var link=root.querySelector('[data-link]');if(link)link.onclick=async function(){this.disabled=true;try{var email=(root.querySelector('#cvy-access-email')?.value||'').trim();var out=await post('/api/agent/model-access',{model_id:id,action:'link_or_create_account',email:email});await openAccess(out.temporary_password||'');if(window.toast)toast(out.created?'✓ Model login created':'✓ Model login linked')}catch(e){err.textContent=e.message||e;this.disabled=false}};
 var temp=root.querySelector('[data-temp]');if(temp)temp.onclick=async function(){this.disabled=true;try{var out=await post('/api/agent/model-access',{model_id:id,action:'generate_temporary_password'});await openAccess(out.temporary_password||'')}catch(e){err.textContent=e.message||e;this.disabled=false}};
 var reset=root.querySelector('[data-reset]');if(reset)reset.onclick=async function(){this.disabled=true;try{await post('/api/agent/model-access',{model_id:id,action:'send_reset_email'});if(window.toast)toast('✓ Reset email sent');await openAccess()}catch(e){err.textContent=e.message||e;this.disabled=false}};
 var tog=root.querySelector('[data-toggle]');if(tog)tog.onclick=async function(){if(!confirm((a.portal_disabled?'Enable':'Disable')+' this model portal login?'))return;this.disabled=true;try{await post('/api/agent/model-access',{model_id:id,action:a.portal_disabled?'enable_portal_access':'disable_portal_access'});await openAccess()}catch(e){err.textContent=e.message||e;this.disabled=false}};
 var cp=root.querySelector('[data-copy]');if(cp)cp.onclick=async function(){var code=root.querySelector('code')?.textContent||'',email=a.email||a.suggested_email||'',text='Model Portal: https://www.maisondeveux.com/portal\nEmail: '+email+'\nTemporary Password: '+code;try{await navigator.clipboard.writeText(text);cp.textContent='Copied ✓'}catch(e){prompt('Copy login details:',text)}};
}
function inject(){
 var p=document.getElementById('p-modelpage')||document.querySelector('.v144-model-shell')||document.querySelector('.v156-model-shell');
 if(!p||!modelId())return;
 var target=p.querySelector('.v144-actions,.v156-actions,.v155-head-actions,.v152-head-actions,.v156-head-actions,.v144-model-top-actions,.v155-model-actions');
 if(!target)return;
 var existingEdit=Array.from(target.querySelectorAll('button,a,[role="button"]')).find(function(x){return String(x.textContent||'').replace(/\s+/g,' ').trim().toLowerCase()==='edit profile'});
 if(existingEdit){existingEdit.dataset.cvyEditModel='1';existingEdit.onclick=function(ev){ev.preventDefault();ev.stopPropagation();editProfile();return false}}
 target.querySelectorAll('[data-cvy-edit-model]').forEach(function(x,i){if(existingEdit&&x!==existingEdit)x.remove()});
 var ac=target.querySelector('[data-cvy-model-access]');
 if(!ac){ac=document.createElement('button');ac.type='button';ac.className=existingEdit?existingEdit.className:'v152-btn';ac.dataset.cvyModelAccess='1';ac.textContent='Account & Access';target.appendChild(ac)}
 ac.dataset.modelId=modelId()||'';
 ac.onclick=function(ev){ev.preventDefault();ev.stopPropagation();openAccess();return false};
}
document.addEventListener('click',function(e){
 var b=e.target&&e.target.closest&&e.target.closest('button,a,[role="button"]');if(!b)return;
 if(b.hasAttribute('data-cvy-model-access')){e.preventDefault();e.stopImmediatePropagation();openAccess();return}
 if(b.hasAttribute('data-cvy-edit-model')){e.preventDefault();e.stopImmediatePropagation();editProfile();return}
},true);

function cvyModel360ClickAuthority(e){
 var b=e.target&&e.target.closest&&e.target.closest('button,a,[role="button"]');if(!b)return;
 var shell=b.closest('#p-modelpage')||b.closest('.v144-model-shell')||b.closest('.v156-model-shell');if(!shell)return;
 var t=String(b.textContent||'').replace(/\s+/g,' ').trim().toLowerCase();
 if(b.hasAttribute('data-cvy-model-access')||t==='account & access'||t==='portal access'){
   e.preventDefault();e.stopPropagation();if(e.stopImmediatePropagation)e.stopImmediatePropagation();
   Promise.resolve().then(function(){openAccess()});return false;
 }
 if(b.hasAttribute('data-cvy-edit-model')||t==='edit profile'){
   e.preventDefault();e.stopPropagation();if(e.stopImmediatePropagation)e.stopImmediatePropagation();
   Promise.resolve().then(function(){editProfile()});return false;
 }
}
window.addEventListener('click',cvyModel360ClickAuthority,true);
var mo=new MutationObserver(function(){requestAnimationFrame(inject)});mo.observe(document.documentElement,{childList:true,subtree:true});setInterval(inject,1200);inject();
window.CAVYRE_MODEL_CONTROL={release:'16.12.18',editProfile:editProfile,openAccess:openAccess};
document.documentElement.setAttribute('data-cavyre-model-control','16.12.18');
})();