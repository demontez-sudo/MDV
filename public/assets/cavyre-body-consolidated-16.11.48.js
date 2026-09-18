/* CAVYRE 16.11.48 consolidated application runtime */

;/* BEGIN cavyre-smart-mobility-16.10.36.js */
(function(){
'use strict';
if(window.__CAVYRE_SMART_MOBILITY_161036__)return;window.__CAVYRE_SMART_MOBILITY_161036__=true;
function arr(v){return Array.isArray(v)?v:[]}
function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function api(path){var b=window.VEUX_AGENT_V4;if(!b||!b.api)return Promise.reject(new Error('Agent API unavailable'));return b.api(path,{method:'GET',headers:{}})}
function org(){try{return window.VEUX_AGENT_V4.state.org.slug||'maison-de-veux'}catch(e){return'maison-de-veux'}}
function dt(v){if(!v)return'—';var d=new Date(v);return isNaN(d)?String(v):d.toLocaleString([],{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})}
function daysUntil(v){if(!v)return null;var d=new Date(v);return isNaN(d)?null:Math.ceil((d-new Date())/864e5)}
function hours(a,b){var x=new Date(a),y=new Date(b);return isNaN(x)||isNaN(y)?null:(y-x)/36e5}
function modelName(d,id){var m=arr(d.lookups&&d.lookups.models).find(function(x){return String(x.id)===String(id)});return m&&m.display_name||'Model'}
function eventModels(e){return arr(e.model_ids||e.models||e.model_ids_flat).map(function(x){return String(x&&x.id||x)})}
function travelIntelligence(d,cal){
 var events=arr(cal&&cal.events),rows=[];
 arr(d.travel).filter(function(t){return !/completed|cancelled/.test(String(t.status||''))}).forEach(function(t){
  var seg=arr(d.travel_segments).filter(function(x){return String(x.travel_record_id)===String(t.id)}).sort(function(a,b){return String(a.departs_at||'').localeCompare(String(b.departs_at||''))});
  var house=arr(d.housing).filter(function(x){return String(x.travel_record_id)===String(t.id)});
  var arrival=(seg.length&&seg[seg.length-1].arrives_at)||t.ends_at||t.starts_at;
  var next=events.filter(function(e){return eventModels(e).includes(String(t.model_id))&&e.starts_at&&new Date(e.starts_at)>new Date(arrival)&&String(e.event_type)!=='travel'}).sort(function(a,b){return new Date(a.starts_at)-new Date(b.starts_at)})[0]||null;
  var buffer=next?hours(arrival,next.starts_at):null,confirmedHousing=house.some(function(h){return /booked|confirmed/.test(String(h.status||''))});
  var risk=!seg.length?'review':buffer!=null&&buffer<6?'critical':buffer!=null&&buffer<10?'watch':!confirmedHousing?'watch':'ready';
  rows.push({travel:t,segment:seg[0]||null,arrival:arrival,next:next,buffer:buffer,housing:house,risk:risk});
 });
 return rows;
}
function visaRisks(d){
 return arr(d.visa_cases).map(function(v){var deadline=daysUntil(v.hard_deadline),expiry=daysUntil(v.expires_on),risk=/refused|expired/.test(String(v.status||''))?'critical':deadline!=null&&deadline<=7?'critical':deadline!=null&&deadline<=21?'watch':expiry!=null&&expiry<=30?'watch':'ready';return{visa:v,deadline:deadline,expiry:expiry,risk:risk}}).filter(function(x){return x.risk!=='ready'||!/approved|issued/.test(String(x.visa.status||''))});
}
function chip(r){return '<span class="cvsm-chip '+r+'">'+(r==='critical'?'CRITICAL':r==='watch'?'WATCH':r==='review'?'REVIEW':'READY')+'</span>'}
function render(el,d,cal){
 var tr=travelIntelligence(d,cal),vr=visaRisks(d),critical=tr.filter(function(x){return x.risk==='critical'}).length+vr.filter(function(x){return x.risk==='critical'}).length;
 var html='<section class="cvsm-command"><div class="cvsm-command-head"><div><small>CAVYRE · MOBILITY INTELLIGENCE</small><h2>Travel & Visa Command</h2><p>Calendar-connected movement, arrival protection, housing and immigration readiness.</p></div><button onclick="navTo(\'calendar\')">OPEN SMART CALENDAR →</button></div>';
 html+='<div class="cvsm-kpis"><div><b>'+tr.length+'</b><span>Active Movements</span></div><div><b>'+vr.length+'</b><span>Visa Watch</span></div><div><b>'+critical+'</b><span>Critical</span></div><div><b>'+tr.filter(function(x){return x.risk==='ready'}).length+'</b><span>Travel Ready</span></div></div>';
 html+='<div class="cvsm-grid"><div class="cvsm-list"><header>TRAVEL FLOW</header>'+(tr.length?tr.slice(0,8).map(function(x){var t=x.travel,route=[t.origin,x.segment&&x.segment.origin,t.destination,x.segment&&x.segment.destination].filter(Boolean),r=(route[0]||'Origin')+' → '+(route[route.length-1]||'Destination');return '<article><div class="cvsm-route"><small>'+esc(modelName(d,t.model_id))+'</small><h3>'+esc(r)+'</h3><p>'+esc(dt((x.segment&&x.segment.departs_at)||t.starts_at))+' → '+esc(dt(x.arrival))+'</p></div>'+chip(x.risk)+'<div class="cvsm-flow"><span class="on">TRAVEL</span><i>→</i><span class="'+(x.housing.length?'on':'')+'">HOUSING</span><i>→</i><span class="'+(x.next?'on':'')+'">NEXT COMMITMENT</span></div><div class="cvsm-meta"><span>Housing <b>'+esc(x.housing.length?(x.housing[0].status||'linked'):'Missing')+'</b></span><span>Arrival Buffer <b>'+(x.buffer==null?'—':Math.max(0,x.buffer).toFixed(1)+'h')+'</b></span><span>Next <b>'+esc(x.next?(x.next.title||x.next.event_type):'None loaded')+'</b></span></div></article>'}).join(''):'<div class="cvsm-empty">No active travel.</div>')+'</div>';
 html+='<div class="cvsm-list"><header>VISA / DOCUMENT READINESS</header>'+(vr.length?vr.slice(0,8).map(function(x){var v=x.visa;return '<article><div class="cvsm-route"><small>'+esc(modelName(d,v.model_id))+' · '+esc(v.country_code||'')+'</small><h3>'+esc(v.visa_type||v.case_type||'Visa')+'</h3><p>'+esc(v.status||'not started')+(v.hard_deadline?' · Deadline '+esc(v.hard_deadline):'')+'</p></div>'+chip(x.risk)+'<div class="cvsm-meta"><span>Deadline <b>'+(x.deadline==null?'—':x.deadline+'d')+'</b></span><span>Appointment <b>'+esc(dt(v.appointment_at))+'</b></span><span>Expires <b>'+esc(v.expires_on||'—')+'</b></span></div></article>'}).join(''):'<div class="cvsm-empty">No visa risk detected.</div>')+'</div></div></section>';
 var target=el.querySelector('.v1682-tabs');if(target&&!el.querySelector('.cvsm-command'))target.insertAdjacentHTML('beforebegin',html);
}
async function enhance(el){try{var d=await api('/api/agent/mobility?organization='+encodeURIComponent(org()));var cal=await api('/api/agent/calendar/v9?organization='+encodeURIComponent(org())).catch(function(){return{events:[]}});render(el,d,cal)}catch(e){console.warn('[CAVYRE Smart Mobility]',e)}}
function wrap(){var old=window.renderGlobalMobility;if(typeof old!=='function'||old.__cvsm)return false;var fn=function(el){var r=old.apply(this,arguments);setTimeout(function(){if(el&&el.isConnected)enhance(el)},300);return r};fn.__cvsm=true;window.renderGlobalMobility=fn;return true}
var tries=0,t=setInterval(function(){tries++;if(wrap()||tries>60)clearInterval(t)},100);
console.info('[CAVYRE] Smart Mobility 16.10.36 loaded');
})();
;/* END cavyre-smart-mobility-16.10.36.js */

;/* BEGIN cavyre-portal-exchange-16.10.50.js */
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
/* 16.11.48 consolidated: redundant portal-exchange polling removed */
})();
;/* END cavyre-portal-exchange-16.10.50.js */

;/* BEGIN cavyre-agency-login-authority-16.10.51.js */
/* CAVYRE 16.10.51 — Agency Login Authority. Presentation only. */
(function(){
'use strict';
if(window.__CAVYRE_LOGIN_AUTHORITY_161051__)return;
window.__CAVYRE_LOGIN_AUTHORITY_161051__=true;

function ensure(){
  var login=document.getElementById('login');
  if(!login)return;

  login.setAttribute('data-cavyre-login','16.10.51');

  var brand=login.querySelector('.lg-brand');
  if(!brand){
    brand=document.createElement('section');
    brand.className='lg-brand';
    login.insertBefore(brand,login.firstChild);
  }
  brand.setAttribute('aria-label','CAVYRE Network Premium');
  brand.innerHTML=
    '<div class="lg-brand-copy">'+
      '<div class="lg-wordmark">CAVYRE</div>'+
      '<div class="lg-network">NETWORK PREMIUM · AGENCY ACCESS</div>'+
      '<div class="lg-divider"></div>'+
      '<div class="lg-portal-title">Agent <em>Network</em></div>'+
      '<div class="lg-portal-sub">Intelligence. Relationships. Performance.</div>'+
    '</div>'+
    '<div class="lg-points">'+
      '<div class="lg-point"><i>01</i><b>Global Reach</b><span>New York · Paris · Worldwide</span></div>'+
      '<div class="lg-point"><i>02</i><b>Smart Operations</b><span>Calendar · Mobility · Finance</span></div>'+
      '<div class="lg-point"><i>03</i><b>Connected Talent</b><span>Agency ↔ Model ↔ Partner</span></div>'+
      '<div class="lg-point"><i>04</i><b>Private Platform</b><span>Secure agency control</span></div>'+
    '</div>';

  var entry=login.querySelector('.lg-entry');
  if(!entry){
    entry=document.createElement('section');
    entry.className='lg-entry';
    login.appendChild(entry);
  }

  var card=entry.querySelector('.lg-card');
  if(!card){
    card=document.createElement('div');
    card.className='lg-card';
    entry.appendChild(card);
  }

  var top=card.querySelector('.lg-top');
  if(!top){
    top=document.createElement('div');
    top.className='lg-top';
    card.insertBefore(top,card.firstChild);
  }
  top.innerHTML=
    '<div class="lg-mark"><span>C</span></div>'+
    '<div class="lg-eyebrow">CAVYRE · MAISON DE VEUX</div>'+
    '<div class="lg-h1">Agency <em>Network</em></div>'+
    '<div class="lg-sub">Secure staff access to your CAVYRE workspace.</div>';

  var body=card.querySelector('.lg-body');
  if(body){
    body.setAttribute('onsubmit','return false;');
    var email=body.querySelector('#veuxEmail');
    var pass=body.querySelector('#veuxPassword');
    var button=body.querySelector('#veuxLoginBtn');
    var forgot=body.querySelector('#veuxForgotBtn');
    if(email)email.placeholder='agency@maisondeveux.com';
    if(pass)pass.placeholder='Enter password';
    if(button && !button.disabled)button.textContent='ENTER CAVYRE →';
    if(forgot)forgot.textContent='Forgot password?';
  }

  var secure=card.querySelector('.lg-secure');
  if(secure)secure.textContent='SECURE · PRIVATE · NETWORK ACCESS';
  var foot=card.querySelector('.lg-foot');
  if(foot)foot.textContent='CAVYRE NETWORK PREMIUM · MAISON DE VEUX';

  var language=entry.querySelector('.lg-language');
  if(language)language.textContent='GLOBAL AGENCY ACCESS';
}

function protect(){
  ensure();
  var login=document.getElementById('login');
  if(!login)return;
  var observer=new MutationObserver(function(mutations){
    var needs=false;
    for(var i=0;i<mutations.length;i++){
      var t=mutations[i].target;
      if(t && t.nodeType===1 && (t.closest&&t.closest('#login'))){needs=true;break;}
    }
    if(needs){
      clearTimeout(protect._t);
      protect._t=setTimeout(function(){
        var h=(document.getElementById('login')||{}).textContent||'';
        if(/VEUX DESK|Agency Portal|Secure Staff Access|ENTER VEUX/i.test(h))ensure();
      },20);
    }
  });
  observer.observe(login,{subtree:true,childList:true,characterData:true});
}

if(document.readyState==='loading'){
  document.addEventListener('DOMContentLoaded',function(){ensure();protect();},{once:true});
}else{ensure();protect();}
window.addEventListener('pageshow',ensure);
console.info('[CAVYRE] Agency Login Authority 16.10.51 loaded');
})();
;/* END cavyre-agency-login-authority-16.10.51.js */

;/* BEGIN cavyre-display-label-authority-16.10.52.js */
/* CAVYRE 16.10.52 — Display Label Authority */
(function(){
'use strict';
if(window.__CAVYRE_DISPLAY_LABEL_AUTHORITY_161052__)return;
window.__CAVYRE_DISPLAY_LABEL_AUTHORITY_161052__=true;

var EXACT={
 'pr':'PR','ny':'NY','nyc':'NYC','nyfw':'NYFW','pfw':'PFW','pdf':'PDF','url':'URL',
 'api':'API','ai':'AI','crm':'CRM','mfa':'MFA','vip':'VIP','usd':'USD','eur':'EUR','gbp':'GBP',
 'id':'ID','dob':'DOB','vat':'VAT','b2b':'B2B',
 'casting_office':'Casting Office','creative_agency':'Creative Agency','mother_agency':'Mother Agency',
 'new_face':'New Face','in_progress':'In Progress','not_started':'Not Started','go_see':'Go See',
 'go_and_see':'Go & See','work_authorization':'Work Authorization','model_portal':'Model Portal',
 'mother_agency_portal':'Mother Agency Portal','model_access':'Model Access','agent_portal':'Agent Portal',
 'book_out':'Book Out','bookout':'Bookout','call_sheet':'Call Sheet','comp_card':'Comp Card',
 'test_requested':'Test Requested','contract_sent':'Contract Sent','meeting_scheduled':'Meeting Scheduled',
 'new_lead':'New Lead','casting_pipeline':'Casting Pipeline','relationship_intelligence':'Relationship Intelligence'
};

function label(value){
 var raw=String(value==null?'':value).trim();
 if(!raw)return raw;
 var key=raw.toLowerCase();
 if(EXACT[key])return EXACT[key];

 // Do not rewrite sentences, dates, currency amounts, emails or user-entered content.
 if(raw.length>42||/[.!?]$/.test(raw)||/@/.test(raw)||/^https?:/i.test(raw)||/^\$|^\€|^\£/.test(raw))return raw;
 if(/[A-Z]/.test(raw)&&!/_/.test(raw))return raw;

 return raw.replace(/[_-]+/g,' ').replace(/\s+/g,' ').split(' ').map(function(w,i){
   var low=w.toLowerCase();
   if(EXACT[low])return EXACT[low];
   if(i>0&&/^(and|or|of|to|for|in|on|at|by|with|from)$/i.test(w))return low;
   return low.charAt(0).toUpperCase()+low.slice(1);
 }).join(' ');
}

function machineish(t){
 t=String(t||'').trim();
 if(!t||t.length>42)return false;
 if(EXACT[t.toLowerCase()])return true;
 if(/^[a-z0-9]+(?:[_-][a-z0-9]+)+$/.test(t))return true;
 if(/^[a-z][a-z0-9]{1,24}$/.test(t))return true;
 return false;
}

var CONTROL_SELECTORS=[
 'option',
 '.vx-select-value','.vx-select-option span','.vx-select-group',
 '[role="option"]','[role="tab"]','[role="menuitem"]',
 '.tab','.tabs button','[class*="tabs"] button',
 '.seg button','[class*="segment"] button','[class*="segmented"] button',
 '.filter-chip','[class*="filter"] button','[class*="filter"] .chip',
 '[class*="slider"] button','[class*="switch"] span',
 '.pill','.badge[data-value]'
].join(',');

function normalizeElement(el){
 if(!el||el.nodeType!==1)return;
 if(el.matches('input,textarea,[contenteditable="true"]'))return;
 if(el.matches('option')){
   var raw=el.textContent.trim();
   if(machineish(raw)){
     if(!el.dataset.cavyreRawLabel)el.dataset.cavyreRawLabel=raw;
     el.textContent=label(raw);
   }
   return;
 }
 // Only rewrite leaf controls, never containers with mixed content.
 if(el.children.length===0){
   var t=el.textContent.trim();
   if(machineish(t)){
     if(!el.dataset.cavyreRawLabel)el.dataset.cavyreRawLabel=t;
     el.textContent=label(t);
   }
 }
}

function scan(root){
 root=root||document;
 if(root.nodeType===1&&root.matches&&root.matches(CONTROL_SELECTORS))normalizeElement(root);
 if(root.querySelectorAll)root.querySelectorAll(CONTROL_SELECTORS).forEach(normalizeElement);
}

window.CAVYRE_DISPLAY_LABEL=label;

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){scan(document)},{once:true});
else scan(document);

new MutationObserver(function(rows){
 var roots=[];
 rows.forEach(function(m){
   if(m.type==='childList')m.addedNodes.forEach(function(n){if(n.nodeType===1)roots.push(n)});
   else if(m.type==='characterData'&&m.target.parentElement)roots.push(m.target.parentElement);
 });
 if(!roots.length)return;
 clearTimeout(scan._t);
 scan._t=setTimeout(function(){roots.forEach(scan)},24);
}).observe(document.documentElement,{subtree:true,childList:true,characterData:true});

document.addEventListener('change',function(e){
 if(e.target&&e.target.tagName==='SELECT')setTimeout(function(){scan(e.target.parentElement||document)},0);
},true);

console.info('[CAVYRE] Display Label Authority 16.10.52 loaded');
})();
;/* END cavyre-display-label-authority-16.10.52.js */

;/* BEGIN cavyre-vera-mobility-context-16.10.61.js */
(function(){'use strict';if(window.__CAVYRE_VERA_MOBILITY_161061__)return;window.__CAVYRE_VERA_MOBILITY_161061__=true;document.addEventListener('click',function(e){var b=e.target&&e.target.closest&&e.target.closest('[data-vx17-vera]');if(!b)return;try{var p=window.VEUX_SMART_PORTAL&&window.VEUX_SMART_PORTAL.last,m=p&&p.mobility&&p.mobility.items||[];var ctx=m.slice(0,5).map(function(x){return[(x.booking&&x.booking.title)||'Booking',String(x.severity||'watch').toUpperCase(),x.message,x.recommended_action].join(' · ')}).join('\n');sessionStorage.setItem('cavyre.vera.context.mobility',ctx);sessionStorage.setItem('cavyre.vera.context.page','Agency Command');}catch(_e){}},true);})();
;/* END cavyre-vera-mobility-context-16.10.61.js */

;/* BEGIN cavyre-vera-relationship-context-16.10.62.js */
(function(){'use strict';if(window.__CAVYRE_VERA_REL_161062__)return;window.__CAVYRE_VERA_REL_161062__=true;document.addEventListener('click',function(e){var b=e.target&&e.target.closest&&e.target.closest('[data-vx17-vera]');if(!b)return;try{var p=window.VEUX_SMART_PORTAL&&window.VEUX_SMART_PORTAL.last,r=p&&p.relationships;if(!r)return;var ctx=['Clients: '+r.total,'Priority relationships: '+r.hot.length,'Follow-up relationships: '+r.stale.length].concat(r.stale.slice(0,5).map(function(x){return((x.company&&x.company.name)||'Client')+' · '+(x.days>999?'no recent activity':x.days+' days since activity')})).join('\n');sessionStorage.setItem('cavyre.vera.context.relationships',ctx);}catch(_e){}},true);})();
;/* END cavyre-vera-relationship-context-16.10.62.js */

;/* BEGIN cavyre-vera-finance-context-16.10.63.js */
(function(){'use strict';if(window.__CAVYRE_VERA_FIN_161063__)return;window.__CAVYRE_VERA_FIN_161063__=true;document.addEventListener('click',function(e){var b=e.target&&e.target.closest&&e.target.closest('[data-vx17-vera]');if(!b)return;try{var p=window.VEUX_SMART_PORTAL&&window.VEUX_SMART_PORTAL.last,f=p&&p.finance;if(!f)return;var ctx=['Outstanding: '+f.outstanding+' '+f.currency,'Overdue total: '+f.overdueTotal+' '+f.currency,'Overdue invoices: '+f.overdue.length,'Due within 7 days: '+f.dueSoon.length,'Collection risk: '+f.collectionRisk+'%'].concat(f.overdue.slice(0,5).map(function(x){return(x.invoice_number||'Invoice')+' · '+(x.amount_due||x.balance_due||0)+' '+(x.currency||f.currency)+' due'})).join('\n');sessionStorage.setItem('cavyre.vera.context.finance',ctx);}catch(_e){}},true);})();
;/* END cavyre-vera-finance-context-16.10.63.js */

;/* BEGIN cavyre-model360-intelligence-16.10.65.js */
(function(){
'use strict';if(window.__CAVYRE_MODEL360_INTEL_161065__)return;window.__CAVYRE_MODEL360_INTEL_161065__=true;
var esc=function(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]})};
var arr=function(v){return Array.isArray(v)?v:[]};
function selected(){var k=window._openModelKey||window._openModelKey,m=window.MODELS&&window.MODELS[k];return m&&m._veuxId?{id:m._veuxId,name:m.name||'Model'}:null}
function api(id){return fetch('/api/agent/model-360?organization=maison-de-veux&model_id='+encodeURIComponent(id),{credentials:'include'}).then(function(r){if(!r.ok)throw new Error('Model intelligence unavailable');return r.json()})}
function status(d){
 var now=Date.now(),dev=d.development||{},mob=d.mobility||{},legal=d.legal||{},finance=d.finance||{};
 var plans=arr(dev.plans),goals=plans.reduce(function(a,p){return a.concat(arr(p.development_goals))},[]),openGoals=goals.filter(function(g){return !/complete|done|closed|achieved/i.test(g.status||'')});
 var evals=arr(dev.evaluations),visa=arr(mob.visa_cases),travel=arr(mob.travel),contracts=arr(legal.contracts),usage=arr(legal.usage_rights),ledger=arr(finance.ledger),tasks=arr(d.tasks);
 var visaRisk=visa.filter(function(v){var dl=+new Date(v.hard_deadline||v.expires_at||v.expiry_date);return /blocked|expired|urgent|action/i.test(v.status||'')||(dl&&dl<now+30*86400000)});
 var contractRisk=contracts.filter(function(v){var dl=+new Date(v.ends_on||v.expires_at);return /expired|unsigned|pending|blocked/i.test(v.status||'')||(dl&&dl<now+30*86400000)});
 var usageRisk=usage.filter(function(v){var dl=+new Date(v.ends_on);return dl&&dl<now+30*86400000});
 var openTasks=tasks.filter(function(v){return !/done|complete|closed/i.test(v.status||'')});
 var signals=[];
 if(visaRisk.length)signals.push(['Visa','critical',visaRisk.length+' visa item'+(visaRisk.length===1?'':'s')+' require review.','travelvisa']);
 if(contractRisk.length)signals.push(['Legal','critical',contractRisk.length+' contract item'+(contractRisk.length===1?'':'s')+' require review.','financelegal']);
 if(openGoals.length)signals.push(['Development','watch',openGoals.length+' active development goal'+(openGoals.length===1?'':'s')+'.','development']);
 if(openTasks.length)signals.push(['Tasks','watch',openTasks.length+' open model task'+(openTasks.length===1?'':'s')+'.','tasks']);
 if(!evals.length)signals.push(['Development','action','No evaluation is recorded for this model.','development']);
 return{plans:plans,goals:goals,openGoals:openGoals,evaluations:evals,visa:visa,travel:travel,contracts:contracts,usage:usage,ledger:ledger,tasks:tasks,openTasks:openTasks,signals:signals,readiness:Math.max(0,100-(visaRisk.length*20)-(contractRisk.length*15)-(openGoals.length?5:0)-(openTasks.length?5:0))};
}
function mount(host,d,m){
 if(!host||host.querySelector('.vx161065-model-intel'))return;
 var x=status(d),box=document.createElement('section');box.className='vx161065-model-intel';
 box.innerHTML='<header><div><small>VERA · MODEL INTELLIGENCE</small><h3>Model Command</h3><span>'+esc(m.name)+' · live relational profile</span></div><b>'+x.readiness+'%<small> READINESS</small></b></header>'+
 '<div class="vx161065-kpis"><div><small>Bookings</small><b>'+arr(d.bookings).length+'</b></div><div><small>Castings</small><b>'+arr(d.castings).length+'</b></div><div><small>Development Goals</small><b>'+x.openGoals.length+'</b></div><div><small>Open Tasks</small><b>'+x.openTasks.length+'</b></div><div><small>Travel</small><b>'+x.travel.length+'</b></div><div><small>Visa</small><b>'+x.visa.length+'</b></div></div>'+
 '<div class="vx161065-signals">'+(x.signals.length?x.signals.slice(0,5).map(function(s){return '<article class="'+s[1]+'"><div><small>'+esc(s[0])+' SIGNAL</small><b>'+esc(s[2])+'</b></div><button data-vx161065-nav="'+esc(s[3])+'">Review →</button></article>'}).join(''):'<article class="clear"><div><small>READINESS</small><b>No immediate model-level operational risk detected.</b></div></article>')+'</div>';
 var cnt=host.querySelector('.cnt');if(cnt)cnt.insertBefore(box,cnt.firstChild);else host.appendChild(box);
 box.addEventListener('click',function(e){var b=e.target.closest('[data-vx161065-nav]');if(!b)return;var dest=b.getAttribute('data-vx161065-nav');if(dest==='development'&&window.VEUX_V156&&typeof VEUX_V156.modelTab==='function'){e.preventDefault();e.stopPropagation();VEUX_V156.modelTab('development');return;}var n=document.querySelector('[data-page="'+dest+'"],[data-nav="'+dest+'"]');if(n)n.click();});
 try{sessionStorage.setItem('cavyre.vera.context.model360',JSON.stringify({model:m.name,readiness:x.readiness,signals:x.signals.map(function(s){return s[0]+': '+s[2]}),open_development_goals:x.openGoals.length,open_tasks:x.openTasks.length,travel_records:x.travel.length,visa_cases:x.visa.length}));}catch(_e){}
}
function run(){
 var m=selected(),host=document.getElementById('p-modelpage')||document.querySelector('[data-page-root="modelpage"]');if(!m||!host)return;
 api(m.id).then(function(d){mount(host,d,m)}).catch(function(){});
}
var mo=new MutationObserver(function(){if(document.getElementById('p-modelpage'))setTimeout(run,100)});mo.observe(document.documentElement,{childList:true,subtree:true});
document.addEventListener('click',function(e){if(e.target.closest&&e.target.closest('[data-page="modelpage"],[data-nav="modelpage"],.model-card,.v144-model-card'))setTimeout(run,180)},true);
window.addEventListener('veux:page-rendered',function(e){if(!e.detail||e.detail.page==='modelpage')setTimeout(run,80)});
/* 16.11.48 consolidated: redundant Model360 polling removed */setTimeout(run,300);
})();
;/* END cavyre-model360-intelligence-16.10.65.js */

;/* BEGIN cavyre-package-client-command-16.10.66.js */
(function(){
'use strict';if(window.__CAVYRE_PACKAGE_COMMAND_161066__)return;window.__CAVYRE_PACKAGE_COMMAND_161066__=true;
var A=function(v){return Array.isArray(v)?v:[]},E=function(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]})};
function get(){return fetch('/api/agent/packages?organization=maison-de-veux',{credentials:'include'}).then(function(r){if(!r.ok)throw new Error('Package workflow unavailable');return r.json()})}
function state(d){
 var pk=A(d.packages),fb=A(d.open_feedback),sg=A(d.client_model_signals),now=Date.now();
 var drafts=pk.filter(function(x){return /draft/i.test(x.status||'')});
 var sent=pk.filter(function(x){return /sent|live|published/i.test(x.status||'')});
 var expiring=pk.filter(function(x){var z=+new Date(x.expires_at);return z&&z>=now&&z<=now+7*86400000});
 var hot=sg.filter(function(x){return Number(x.weighted_score||0)>=50}).slice(0,8);
 return{pk:pk,fb:fb,sg:sg,drafts:drafts,sent:sent,expiring:expiring,hot:hot};
}
function nav(page){var n=document.querySelector('[data-page="'+page+'"],[data-nav="'+page+'"]');if(n)n.click()}
function render(host,d){
 if(!host||host.querySelector('.vx161066-package-command'))return;var s=state(d),box=document.createElement('section');box.className='vx161066-package-command';
 box.innerHTML='<header><div><small>VERA · CLIENT WORKFLOW</small><h3>Package Command</h3><span>Selection → Send → Client Response → Conversion</span></div><button data-go="packages">Open Package Library</button></header>'+
 '<div class="vx161066-kpis"><div><small>Packages</small><b>'+s.pk.length+'</b></div><div><small>Drafts</small><b>'+s.drafts.length+'</b></div><div><small>Live / Sent</small><b>'+s.sent.length+'</b></div><div><small>Open Feedback</small><b>'+s.fb.length+'</b></div><div><small>High-Intent Signals</small><b>'+s.hot.length+'</b></div></div>'+
 '<div class="vx161066-flow"><article><small>01 · BUILD</small><b>Create a targeted model selection</b><span>Roster, CRM contacts and model media stay connected.</span></article><i>→</i><article><small>02 · SEND</small><b>Deliver the private package</b><span>Recipient and package activity are recorded.</span></article><i>→</i><article><small>03 · RESPONSE</small><b>Capture client feedback</b><span>Interest becomes a model/client signal.</span></article><i>→</i><article><small>04 · CONVERT</small><b>Move intent into operations</b><span>Casting, option, booking, availability or client note.</span></article></div>'+
 '<div class="vx161066-stream">'+(s.fb.length?s.fb.slice(0,6).map(function(f){return '<article><div><small>CLIENT RESPONSE · '+E(f.feedback_type||'feedback')+'</small><b>'+E((f.packages&&f.packages.title)||'Package')+'</b><span>'+E((f.models&&f.models.display_name)||'Model')+(f.note?' · '+E(f.note):'')+'</span></div><button data-go="packages">Convert →</button></article>'}).join(''):(s.expiring.length?'<article><div><small>PACKAGE WATCH</small><b>'+s.expiring.length+' package'+(s.expiring.length===1?'':'s')+' expire within seven days</b><span>Review active selections before links expire.</span></div><button data-go="packages">Review →</button></article>':'<article class="clear"><div><small>CLIENT WORKFLOW</small><b>No open package feedback requires conversion.</b></div></article>'))+'</div>';
 host.insertBefore(box,host.firstChild);box.addEventListener('click',function(e){var b=e.target.closest('[data-go]');if(b)nav(b.getAttribute('data-go'))});
 try{sessionStorage.setItem('cavyre.vera.context.packages',JSON.stringify({packages:s.pk.length,drafts:s.drafts.length,live_or_sent:s.sent.length,open_feedback:s.fb.length,high_intent_signals:s.hot.length,expiring_within_7_days:s.expiring.length,feedback:s.fb.slice(0,5).map(function(f){return[(f.packages&&f.packages.title)||'Package',(f.models&&f.models.display_name)||'Model',f.feedback_type||'feedback'].join(' · ')})}));}catch(_e){}
}
function commandHost(){return document.querySelector('#p-command .cnt,#p-agencycommand .cnt,[data-page-root="command"] .cnt,.vx161061-command,.vx161062-relationship')?.parentElement||null}
function run(){var h=commandHost();if(!h||h.querySelector('.vx161066-package-command'))return;get().then(function(d){render(h,d)}).catch(function(){})}
new MutationObserver(function(){setTimeout(run,80)}).observe(document.documentElement,{childList:true,subtree:true});window.addEventListener('veux:page-rendered',function(){setTimeout(run,80)});/* 16.11.48 consolidated: redundant package polling removed */setTimeout(run,500);
})();
;/* END cavyre-package-client-command-16.10.66.js */

;/* BEGIN cavyre-agent-certification-16.10.67.js */
(function(){'use strict';if(window.__CAVYRE_CERT_161067__)return;window.__CAVYRE_CERT_161067__=true;window.CAVYRE_CERTIFICATION={release:'16.10.67',portal:'agent',critical_routes:['/api/agent/calendar/v9','/api/agent/model-360','/api/agent/mobility','/api/agent/packages','/api/agent/finance','/api/agent/crm/v9'],report:function(){return{release:this.release,portal:this.portal,online:navigator.onLine,path:location.pathname,service_worker:'serviceWorker'in navigator}}};})();
;/* END cavyre-agent-certification-16.10.67.js */

;/* BEGIN cavyre-mobile-runtime-16.10.69.js */
(function(){
'use strict';if(window.__CAVYRE_MOBILE_161069__)return;window.__CAVYRE_MOBILE_161069__=true;
function mobile(){return window.matchMedia('(max-width:900px)').matches}
function apply(){document.documentElement.classList.toggle('cavyre-mobile',mobile());document.body&&document.body.classList.toggle('cavyre-mobile',mobile())}
apply();window.addEventListener('resize',apply,{passive:true});window.addEventListener('orientationchange',function(){setTimeout(apply,150)},{passive:true});

document.addEventListener('focusin',function(e){
 if(!mobile())return;
 var el=e.target;
 if(!el||!el.matches('input,select,textarea,[contenteditable="true"]'))return;
 setTimeout(function(){try{el.scrollIntoView({block:'center',inline:'nearest',behavior:'smooth'})}catch(_e){}},250);
},true);

document.addEventListener('click',function(e){
 if(!mobile())return;
 var nav=e.target&&e.target.closest&&e.target.closest('[data-page],[data-nav],.nav-item,.menu-item');
 if(nav){
   document.body.classList.remove('menu-open','sidebar-open','nav-open');
   document.documentElement.classList.remove('menu-open','sidebar-open','nav-open');
 }
},true);

/* Recover scrolling after a modal/drawer is removed by legacy code. */
new MutationObserver(function(){
 if(!mobile())return;
 clearTimeout(window.__cvMobScrollT);
 window.__cvMobScrollT=setTimeout(function(){
   var open=document.querySelector('[role="dialog"],.modal.open,.drawer.open,.sheet.open,[class*="modal"][style*="display: block"]');
   if(!open){
     document.documentElement.style.removeProperty('overflow');
     document.body.style.removeProperty('overflow');
   }
 },80);
}).observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['class','style']});
})();
;/* END cavyre-mobile-runtime-16.10.69.js */

;/* BEGIN cavyre-interface-polish-16.10.70.js */
(function(){
'use strict';if(window.__CAVYRE_POLISH_161070__)return;window.__CAVYRE_POLISH_161070__=true;
function viewport(){
 var h=(window.visualViewport&&window.visualViewport.height)||window.innerHeight;
 document.documentElement.style.setProperty('--cv-vh',h+'px');
}
viewport();
window.addEventListener('resize',viewport,{passive:true});
if(window.visualViewport)window.visualViewport.addEventListener('resize',viewport,{passive:true});
var touch=('ontouchstart'in window)||navigator.maxTouchPoints>0;
document.documentElement.classList.toggle('cavyre-touch',touch);
document.documentElement.classList.toggle('cavyre-pointer',!touch);
document.addEventListener('keydown',function(e){if(e.key==='Tab')document.documentElement.classList.add('cavyre-keyboard')},true);
document.addEventListener('pointerdown',function(){document.documentElement.classList.remove('cavyre-keyboard')},true);
})();
;/* END cavyre-interface-polish-16.10.70.js */

;/* BEGIN cavyre-release-readiness-16.10.71.js */
(function(){
'use strict';if(window.__CAVYRE_RELEASE_161071__)return;window.__CAVYRE_RELEASE_161071__=true;
var R={release:'16.10.71',baseline:'16.10.70',portal:'agent',started_at:new Date().toISOString(),errors:[],rejections:[],checks:{}};
window.CAVYRE_RELEASE_READINESS=R;
function add(kind,value){var a=R[kind];if(a&&a.length<25)a.push({at:new Date().toISOString(),message:String(value||'Unknown runtime error')})}
window.addEventListener('error',function(e){add('errors',e.message||e.error)},true);
window.addEventListener('unhandledrejection',function(e){add('rejections',e.reason&&e.reason.message||e.reason)},true);
function audit(){
 R.checks={
   online:navigator.onLine,
   path:location.pathname,
   model_calendar:!!document.querySelector('#p-modelpage'),
   finance_workspace:!!document.querySelector('#p-financelegal'),
   travel_workspace:!!document.querySelector('#p-travelvisa'),
   command_workspace:!!document.querySelector('#p-command,#p-agencycommand'),
   horizontal_overflow:document.documentElement.scrollWidth>document.documentElement.clientWidth+3,
   viewport_width:window.innerWidth,
   viewport_height:window.innerHeight
 };
 R.last_audit=new Date().toISOString();return R.checks;
}
R.audit=audit;setTimeout(audit,1200);window.addEventListener('resize',function(){clearTimeout(R._t);R._t=setTimeout(audit,120)}, {passive:true});
})();
;/* END cavyre-release-readiness-16.10.71.js */

;/* BEGIN cavyre-agency-command-layout-16.10.73.js */

(function(){
  "use strict";
  function clean(){
    var root=document.body;
    if(!root)return;
    var w=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
    var kill=[],n;
    while((n=w.nextNode())){
      var v=n.nodeValue||"";
      if(/^(?:\\n|\\r|\\t|\s)+$/.test(v) && /\\[nrt]/.test(v)) kill.push(n);
    }
    kill.forEach(function(n){n.remove()});
  }
  clean();
  document.addEventListener("DOMContentLoaded",clean);
  new MutationObserver(clean).observe(document.documentElement,{childList:true,subtree:true});
})();

;/* END cavyre-agency-command-layout-16.10.73.js */

;/* BEGIN cavyre-mobility-route-authority-16.10.89.js */
(function(){
'use strict';
if(window.__CAVYRE_MOBILITY_ROUTE_161089__)return;window.__CAVYRE_MOBILITY_ROUTE_161089__=true;
var ALIAS={mobility:'globalmobility',travel:'globalmobility',travelvisa:'globalmobility','travel-visa':'globalmobility'};
function canon(p){p=String(p||'');return ALIAS[p]||p}
function normalizeState(){
  ['veux-agent-nav-state-v1'].forEach(function(k){try{var s=JSON.parse(sessionStorage.getItem(k)||'null');if(s&&s.page&&canon(s.page)!==s.page){s.page=canon(s.page);sessionStorage.setItem(k,JSON.stringify(s));}}catch(e){}});
  try{var stack=JSON.parse(sessionStorage.getItem('veux-agent-nav-stack-v1')||'[]');if(Array.isArray(stack)){var dirty=false;stack.forEach(function(s){if(s&&s.page&&canon(s.page)!==s.page){s.page=canon(s.page);dirty=true;}});if(dirty)sessionStorage.setItem('veux-agent-nav-stack-v1',JSON.stringify(stack));}}catch(e){}
  try{if(history.state&&history.state.veuxPortal==='agent'&&history.state.page&&canon(history.state.page)!==history.state.page){var s=Object.assign({},history.state,{page:canon(history.state.page)});history.replaceState(s,document.title,location.href);}}catch(e){}
}
function wrapNav(){
  var old=window.navTo;if(typeof old!=='function'||old.__cavyreMobilityAlias)return;
  var fn=function(p){arguments[0]=canon(p);return old.apply(this,arguments)};fn.__cavyreMobilityAlias=true;fn.__previous=old;window.navTo=fn;
}
function wrapBuild(){
  var old=window.build;if(typeof old!=='function'||old.__cavyreMobilityAlias)return;
  var fn=function(p,el){return old.call(this,canon(p),el)};fn.__cavyreMobilityAlias=true;fn.__previous=old;window.build=fn;
}
function patchRenderers(){
  try{if(window.VEUX_V15_ROUTE_RENDERERS&&window.VEUX_V15_ROUTE_RENDERERS.globalmobility)window.VEUX_V15_ROUTE_RENDERERS.mobility=window.VEUX_V15_ROUTE_RENDERERS.globalmobility;}catch(e){}
}
function recover(){
  normalizeState();patchRenderers();wrapBuild();wrapNav();
  var p=window._currentPage||'';
  if(canon(p)!==p&&typeof window.navTo==='function'){
    try{window.navTo(canon(p),{skipPortalStack:true,historyMode:'replace'});}catch(e){}
  }
}
window.addEventListener('popstate',function(){setTimeout(recover,0)});
window.addEventListener('veux:agency-v16-shell-ready',function(){setTimeout(recover,0)});
window.addEventListener('veux:shell-ready',function(){setTimeout(recover,0)});
document.addEventListener('click',function(e){
  var n=e.target&&e.target.closest&&e.target.closest('[data-page="mobility"],[data-p="mobility"],[data-vx17-nav="mobility"]');
  if(!n)return;
  e.preventDefault();e.stopImmediatePropagation();
  if(typeof window.navTo==='function')window.navTo('globalmobility');
},true);
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',recover,{once:true});else recover();
setTimeout(recover,80);setTimeout(recover,600);setTimeout(recover,1600);
})();
;/* END cavyre-mobility-route-authority-16.10.89.js */

;/* BEGIN cavyre-command-queue-final-authority-16.11.03.js */
(function(){
'use strict';
if(window.__CAVYRE_QUEUE_FINAL_161103__)return;
window.__CAVYRE_QUEUE_FINAL_161103__=true;

function upgradeLegacy(q){
 if(!q||q.classList.contains('vx3d-command-queue'))return;
 var head=q.querySelector(':scope > header');
 var counts=q.querySelector('.vx161086-queue-counts');
 var list=q.querySelector('.vx161086-queue-list');

 q.className='vx3d-command-queue';
 q.removeAttribute('style');

 if(counts){
   counts.className='vx3d-counts';
   Array.from(counts.children).forEach(function(c){
     var severity=['blocked','critical','urgent','action_required','watch','clear'].find(function(k){return c.classList.contains(k)})||'watch';
     c.className='vx3d-count '+severity;
     c.removeAttribute('style');
     var sm=c.querySelector('small');
     if(sm){var sp=document.createElement('span');sp.textContent=sm.textContent;sm.replaceWith(sp);}
   });
 }

 if(list){
   list.className='vx3d-priority-grid';
   Array.from(list.children).forEach(function(card){
     if(!card.classList.contains('vx161086-queue-item'))return;
     var severity=['blocked','critical','urgent','action_required','watch','clear'].find(function(k){return card.classList.contains(k)})||'watch';
     var num=card.querySelector(':scope > em');
     var body=card.querySelector(':scope > div');
     var open=card.querySelector(':scope > i');

     card.className='vx3d-priority-card '+severity;
     card.removeAttribute('style');

     if(body){
       var meta=body.querySelector('small');
       var title=body.querySelector('b');
       var detail=body.querySelector('span');

       var top=document.createElement('div');
       top.className='vx3d-priority-top';
       if(num)top.appendChild(num);
       if(meta)top.appendChild(meta);
       card.insertBefore(top,body);
       if(title)card.appendChild(title);
       if(detail)card.appendChild(detail);
       body.remove();
       if(open)card.appendChild(open);
     }
   });
 }
 q.dataset.vx161103='upgraded';
}

function enforce(){
 document.querySelectorAll('.vx161086-command-queue').forEach(upgradeLegacy);
 document.querySelectorAll('.vx3d-command-queue').forEach(function(q){q.dataset.vx161103='active'});
 var badge=document.getElementById('cavyre-release-badge-161075');
 
 document.documentElement.setAttribute('data-cavyre-feature-161103','active');
}

var scheduled=false;
function schedule(){
 if(scheduled)return; scheduled=true;
 requestAnimationFrame(function(){scheduled=false;enforce();});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule,{once:true});
else schedule();
new MutationObserver(schedule).observe(document.documentElement,{subtree:true,childList:true});
window.addEventListener('veux:shell-ready',schedule);
window.addEventListener('cavyre:vera-signals',schedule);
/* 16.11.48 consolidated: redundant queue polling removed */
})();
;/* END cavyre-command-queue-final-authority-16.11.03.js */

;/* BEGIN cavyre-runway-footer-dock-16.11.04.js */
(function(){
'use strict';
if(window.__CAVYRE_RUNWAY_FOOTER_161104__)return;
window.__CAVYRE_RUNWAY_FOOTER_161104__=true;

function imp(el,p,v){if(el)el.style.setProperty(p,v,'important')}

function repair(){
 document.querySelectorAll('.vx95-calendar-main').forEach(function(main){
   imp(main,'display','grid');
   imp(main,'grid-template-rows','auto 780px auto');
   imp(main,'align-content','start');
   imp(main,'position','relative');

   var head=main.querySelector(':scope > .vx95-day-head');
   var timeline=main.querySelector(':scope > .vx95-timeline');
   var legend=main.querySelector(':scope > .vx95-calendar-legend');

   if(head)imp(head,'grid-row','1');
   if(timeline){
     imp(timeline,'grid-row','2');
     imp(timeline,'height','780px');
     imp(timeline,'min-height','780px');
   }
   if(legend){
     imp(legend,'grid-row','3');
     imp(legend,'position','relative');
     imp(legend,'bottom','auto');
     imp(legend,'top','auto');
     imp(legend,'left','auto');
     imp(legend,'right','auto');
     imp(legend,'inset','auto');
     imp(legend,'width','100%');
     imp(legend,'min-height','46px');
     imp(legend,'margin','0');
     imp(legend,'transform','none');
   }
 });

 var badge=document.getElementById('cavyre-release-badge-161075');
 
 document.documentElement.setAttribute('data-cavyre-feature-161104','active');
}
var q=false;
function schedule(){
 if(q)return;q=true;
 requestAnimationFrame(function(){q=false;repair()});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule,{once:true});
else schedule();
new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true});
window.addEventListener('resize',schedule,{passive:true});
window.addEventListener('veux:shell-ready',schedule);
})();
;/* END cavyre-runway-footer-dock-16.11.04.js */

;/* 16.15.08 quarantined legacy runtime: cavyre-calendar-system-reset-16.11.15.js */

;/* 16.15.08 quarantined legacy runtime: cavyre-live-calendar-dom-authority-16.11.16.js */

;/* BEGIN cavyre-task-command-repair-16.11.17.js */
(function(){
'use strict';
if(window.__CAVYRE_TASK_COMMAND_161117__)return;
window.__CAVYRE_TASK_COMMAND_161117__=1;
function I(e,p,v){if(e)e.style.setProperty(p,v,'important')}
function toast(m){try{if(window.toast)return window.toast(m);if(window.say)return window.say(m)}catch(e){}}
function bridge(){return window.VEUX_AGENT_V4}
function org(){try{return bridge().state.org.slug||'maison-de-veux'}catch(e){return'maison-de-veux'}}
async function status(id,status,btn){
 if(!id||!status)return;
 if(btn){btn.disabled=true;btn.dataset.old=btn.textContent;btn.textContent='UPDATING…'}
 try{
   var r=await bridge().api('/api/agent/tasks/v11',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({organization_slug:org(),action:'task_status',task_id:id,status:status})});
   toast(status==='completed'?'Task completed':'Task updated');
   try{
     if(window.VEUX_V148){window.VEUX_V148.task=null}
     var p=document.getElementById('p-tasksconsolidated')||document.getElementById('p-tasks');
     if(window.renderTasksConsolidated&&p)window.renderTasksConsolidated(p);
   }catch(e){location.reload()}
 }catch(e){
   console.error('[CAVYRE TASK 16.11.17]',e);
   toast((e&&e.message)||'Unable to update task');
   if(btn){btn.disabled=false;btn.textContent=btn.dataset.old||'TRY AGAIN'}
 }
}
window.CAVYRE_TASKS_161117={status:status};

function bind(){
 var root=document.getElementById('p-tasksconsolidated')||document.getElementById('p-tasks');
 if(!root)return;
 root.classList.add('vx161117-task-command');
 var detail=root.querySelector('.v148-task-detail');
 var layout=root.querySelector('.v148-task-layout');
 var main=root.querySelector('.v148-main');
 if(layout){I(layout,'display','grid');I(layout,'grid-template-columns','minmax(0,1fr) 360px');I(layout,'gap','14px');I(layout,'align-items','start')}
 if(main){I(main,'min-width','0');I(main,'overflow-x','auto')}
 if(detail){
   I(detail,'position','sticky');I(detail,'top','94px');I(detail,'width','100%');I(detail,'min-width','0');I(detail,'max-height','calc(100vh - 112px)');I(detail,'overflow-y','auto');
   var title=detail.querySelector('h2');if(title){I(title,'font-size','25px');I(title,'line-height','1.08');I(title,'overflow-wrap','anywhere')}
   var actions=detail.querySelector('.v148-actions-rail');
   if(actions){
     actions.querySelectorAll('button').forEach(function(b){
       var tx=(b.textContent||'').trim().toLowerCase();
       var m=b.getAttribute('onclick')||'';
       var id=(m.match(/taskStatus\('([^']+)'/)||[])[1];
       if(id&&(tx.indexOf('mark complete')>=0||tx.indexOf('mark in progress')>=0)){
         var st=tx.indexOf('complete')>=0?'completed':'in_progress';
         b.setAttribute('onclick',"CAVYRE_TASKS_161117.status('"+id+"','"+st+"',this)");
       }
       I(b,'min-height','42px');I(b,'height','auto');I(b,'white-space','normal');
     });
   }
 }
 root.querySelectorAll('.v148-row').forEach(function(r){I(r,'min-height','58px')});
 var head=root.querySelector('.v148-table-head');if(head){I(head,'position','sticky');I(head,'top','0');I(head,'z-index','2')}
}
var q=0;function schedule(){if(q)return;q=1;requestAnimationFrame(function(){q=0;bind()})}
document.readyState==='loading'?document.addEventListener('DOMContentLoaded',schedule,{once:true}):schedule();
new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true});
window.addEventListener('resize',schedule,{passive:true});
})();
;/* END cavyre-task-command-repair-16.11.17.js */

;/* BEGIN cavyre-smart-task-center-16.11.18.js */
(function(){
'use strict';
if(window.__CAVYRE_SMART_TASK_CENTER_161118__)return;
window.__CAVYRE_SMART_TASK_CENTER_161118__=1;

var state={mode:'smart',expanded:false};
function I(e,p,v){if(e)e.style.setProperty(p,v,'important')}
function txt(e){return String(e&&e.textContent||'').trim()}
function rows(root){return Array.from(root.querySelectorAll('.v148-main .v148-row'))}
function head(root){return root.querySelector('.v148-main .v148-table-head')}
function statusOf(r){
 var s=txt(r).toLowerCase();
 if(/\bcompleted\b|\bdone\b/.test(s))return'completed';
 if(/\bin progress\b|\bin_progress\b/.test(s))return'in_progress';
 if(/\burgent\b|\bcritical\b/.test(s))return'urgent';
 if(/\boverdue\b/.test(s))return'overdue';
 return'open';
}
function dueText(r){
 var cells=r.querySelectorAll(':scope > span');
 return cells[4]?txt(cells[4]):'';
}
function parseDue(v){
 var d=new Date(v);
 return isNaN(d)?null:d;
}
function priorityScore(r){
 var s=txt(r).toLowerCase(),score=0;
 if(/\bcritical\b/.test(s))score+=100;
 if(/\burgent\b/.test(s))score+=80;
 if(/\bin progress\b|\bin_progress\b/.test(s))score+=60;
 var d=parseDue(dueText(r));
 if(d){
   var diff=(d-Date.now())/86400000;
   if(diff<0)score+=90;
   else if(diff<=1)score+=50;
   else if(diff<=3)score+=30;
 }
 if(/\bcompleted\b|\bdone\b/.test(s))score-=200;
 return score;
}
function classify(r){
 var s=txt(r).toLowerCase();
 if(/\bcompleted\b|\bdone\b/.test(s))return'completed';
 if(/\bin progress\b|\bin_progress\b/.test(s))return'in_progress';
 if(/\burgent\b|\bcritical\b/.test(s))return'priority';
 var d=parseDue(dueText(r));
 if(d){
   var diff=(d-Date.now())/86400000;
   if(diff<0)return'overdue';
   if(diff<=3)return'due_soon';
 }
 return'open';
}
function buildCenter(root){
 if(root.querySelector('.vx161118-task-center-head'))return;
 var main=root.querySelector('.v148-task-layout');
 if(!main)return;

 var all=rows(root);
 var counts={
   priority:all.filter(function(r){return ['priority','overdue'].includes(classify(r))}).length,
   due:all.filter(function(r){return ['due_soon','overdue'].includes(classify(r))}).length,
   progress:all.filter(function(r){return classify(r)==='in_progress'}).length,
   completed:all.filter(function(r){return classify(r)==='completed'}).length
 };

 var c=document.createElement('section');
 c.className='vx161118-task-center-head';
 c.innerHTML=
 '<div class="vx161118-task-center-title"><small>VERA · SMART TASK CENTER</small><h2>Agency Task Command</h2><p>Priority work first. Completed and lower-signal tasks stay out of the active queue until you need them.</p></div>'+
 '<div class="vx161118-task-metrics">'+
   '<button data-task-mode="smart" class="on"><b>'+counts.priority+'</b><span>Priority</span><small>Urgent + overdue</small></button>'+
   '<button data-task-mode="due"><b>'+counts.due+'</b><span>Due Soon</span><small>Next 3 days</small></button>'+
   '<button data-task-mode="progress"><b>'+counts.progress+'</b><span>In Progress</span><small>Being worked</small></button>'+
   '<button data-task-mode="completed"><b>'+counts.completed+'</b><span>Completed</span><small>Archive view</small></button>'+
 '</div>'+
 '<div class="vx161118-task-toolbar">'+
   '<span class="vx161118-task-status">Showing smart queue</span>'+
   '<button type="button" class="vx161118-expand">VIEW ALL TASKS</button>'+
 '</div>';
 main.parentNode.insertBefore(c,main);

 c.querySelectorAll('[data-task-mode]').forEach(function(b){
   b.addEventListener('click',function(){
     state.mode=b.getAttribute('data-task-mode')||'smart';
     state.expanded=false;
     c.querySelectorAll('[data-task-mode]').forEach(function(x){x.classList.toggle('on',x===b)});
     apply(root);
   });
 });
 c.querySelector('.vx161118-expand').addEventListener('click',function(){
   state.expanded=!state.expanded;
   apply(root);
 });
}
function apply(root){
 var all=rows(root);
 if(!all.length)return;
 all.forEach(function(r){r.dataset.taskClass=classify(r)});

 var sorted=all.slice().sort(function(a,b){return priorityScore(b)-priorityScore(a)});
 var parent=all[0].parentNode;
 sorted.forEach(function(r){parent.appendChild(r)});

 var match=function(r){
   var c=r.dataset.taskClass;
   if(state.mode==='completed')return c==='completed';
   if(state.mode==='progress')return c==='in_progress';
   if(state.mode==='due')return c==='due_soon'||c==='overdue';
   if(state.mode==='smart')return c!=='completed';
   return true;
 };
 var pool=sorted.filter(match);
 var limit=state.expanded?pool.length:(state.mode==='completed'?8:10);
 pool.forEach(function(r,i){r.style.display=i<limit?'grid':'none'});
 sorted.filter(function(r){return !match(r)}).forEach(function(r){r.style.display='none'});

 var center=root.querySelector('.vx161118-task-center-head');
 if(center){
   var shown=Math.min(pool.length,limit);
   var label=center.querySelector('.vx161118-task-status');
   if(label)label.textContent=(state.mode==='smart'?'Smart queue':state.mode.replace('_',' '))+' · '+shown+' of '+pool.length;
   var ex=center.querySelector('.vx161118-expand');
   if(ex){
     ex.style.display=pool.length>limit||state.expanded?'inline-flex':'none';
     ex.textContent=state.expanded?'SHOW LESS':'VIEW ALL '+pool.length;
   }
 }
}
function bind(){
 var root=document.getElementById('p-tasksconsolidated')||document.getElementById('p-tasks');
 if(!root)return;
 root.classList.add('vx161118-smart-task-center');
 buildCenter(root);
 apply(root);

 var badge=document.getElementById('cavyre-release-badge-161075');
 
 document.documentElement.setAttribute('data-cavyre-feature-161118','active');
}
var q=0;function schedule(){if(q)return;q=1;requestAnimationFrame(function(){q=0;bind()})}
document.readyState==='loading'?document.addEventListener('DOMContentLoaded',schedule,{once:true}):schedule();
new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true});
window.addEventListener('resize',schedule,{passive:true});
})();
;/* END cavyre-smart-task-center-16.11.18.js */

;/* 16.15.08 quarantined legacy runtime: cavyre-deploy1-ux-calendar-cert-16.11.19.js */

;/* 16.15.08 quarantined legacy runtime: cavyre-deploy2-workflow-cert-16.11.20.js */

;/* 16.15.08 quarantined legacy runtime: cavyre-deploy3-intelligence-data-cert-16.11.21.js */

;/* 16.15.08 quarantined legacy runtime: cavyre-production-certification-16.11.22.js */

;/* 16.15.08 quarantined legacy runtime: cavyre-acceptance-repair-16.11.23.js */

;/* BEGIN cavyre-native-intelligence-drawer-16.11.25.js */
(function(){'use strict';if(window.__CAVYRE_NATIVE_DRAWER_161125__)return;window.__CAVYRE_NATIVE_DRAWER_161125__=1;function bind(){document.querySelectorAll('[data-native-intel-drawer]').forEach(function(d){if(d.dataset.bound)return;d.dataset.bound='1';var b=d.querySelector('[data-native-intel-toggle]'),c=d.querySelector('[data-native-intel-close]');function set(o){d.classList.toggle('open',o);if(b)b.setAttribute('aria-expanded',o?'true':'false');var x=d.querySelector('.vx161125-native-open');if(x)x.innerHTML=o?'CLOSE <i>↓</i>':'OPEN <i>↑</i>';}if(b)b.addEventListener('click',function(){set(!d.classList.contains('open'))});if(c)c.addEventListener('click',function(e){e.stopPropagation();set(false)});});var rb=document.getElementById('cavyre-release-badge-161075');document.documentElement.setAttribute('data-cavyre-feature-161125','active');}var q=0;function go(){if(q)return;q=1;requestAnimationFrame(function(){q=0;bind()})}document.readyState==='loading'?document.addEventListener('DOMContentLoaded',go,{once:true}):go();new MutationObserver(go).observe(document.documentElement,{childList:true,subtree:true});})();
;/* END cavyre-native-intelligence-drawer-16.11.25.js */

;/* 16.15.08 quarantined legacy runtime: cavyre-month-split-intelligence-16.11.26.js */

;/* 16.15.08 quarantined legacy runtime: cavyre-month-split-authority-16.11.27.js */

;/* BEGIN cavyre-package-menu-repair-16.11.30.js */
(function(){'use strict';
if(window.__CAVYRE_PACKAGE_MENU_161130__)return;window.__CAVYRE_PACKAGE_MENU_161130__=1;
function owner(el){return el&&el.closest?el.closest('[role="combobox"],[class*="select"],[class*="dropdown"],.field,[class*="field"]'):null}
function clear(except){document.querySelectorAll('#pm .vx161130-menu-active').forEach(function(n){if(n!==except)n.classList.remove('vx161130-menu-active')})}
document.addEventListener('click',function(e){
 if(!e.target.closest('#pm'))return;
 var trg=e.target.closest('[role="combobox"],[aria-haspopup="listbox"],[aria-expanded],button,[class*="select"]'); if(!trg)return;
 setTimeout(function(){var o=owner(trg); if(!o)return; var m=o.querySelector('[role="listbox"],[class*="dropdown-menu"],[class*="select-menu"],[class*="options"]');
 var expanded=trg.getAttribute('aria-expanded')==='true'; var visible=m&&getComputedStyle(m).display!=='none'&&getComputedStyle(m).visibility!=='hidden';
 if(expanded||visible){clear(o);o.classList.add('vx161130-menu-active')}else{o.classList.remove('vx161130-menu-active')}},0);
},true);
document.addEventListener('keydown',function(e){if(e.key==='Escape')document.querySelectorAll('#pm .vx161130-menu-active').forEach(function(n){n.classList.remove('vx161130-menu-active')})},true);
function stamp(){document.documentElement.setAttribute('data-cavyre-feature-161130','active')}
document.readyState==='loading'?document.addEventListener('DOMContentLoaded',stamp,{once:true}):stamp();
})();
;/* END cavyre-package-menu-repair-16.11.30.js */

;/* BEGIN cavyre-sullivan-submission-desk-16.11.34.js */
(function(){'use strict';
var KEY='cavyre.sullivan.submissionDesk.v1';
var seed=[
['Establishment / Anita Bitton','Casting Office','A','Warm','Follow-up','Digitals + comp card','Previous Sullivan activity','Follow up now'],
['Midland / Rachel Chandler','Casting Office','A','Cold','Target','Digitals + comp card','Directional / editorial fit','Introduce'],
['The Line Casting','Casting Office','A','Cold','Target','Digitals + comp card','New-face lane','Submit'],
['Ashley Brokaw','Casting Office','A','Cold','Target','Digitals + comp card','High-level controlled intro','Introduce'],
['Khaite','Runway','A','Cold','Target','Digitals first','Walk clearance required','Submit'],
['Tory Burch','Runway','A','Cold','Target','Digitals first','Walk clearance required','Submit'],
['Calvin Klein Collection','Runway','A','Cold','Target','Digitals first','Selective runway','Submit'],
['COS','Runway / Lookbook','A','Cold','Target','Digitals + comp card','Strong proportions lane','Submit'],
['Proenza Schouler','Runway / Editorial','A','Cold','Target','Digitals first','Editorial runway','Submit'],
['Diotima','Runway / Editorial','A','Cold','Target','Digitals + hero test','Strong visual compatibility','Submit'],
['Fforme','Runway / Editorial','A','Cold','Target','Digitals + hero test','Directional fit','Submit'],
['Area','Runway','A','Cold','Target','Digitals first','Presence / movement','Submit'],
['Altuzarra','Runway','A','Cold','Target','Digitals first','Selective runway','Submit'],
['Kallmeyer','Runway / Lookbook','A','Cold','Target','Digitals + comp card','Strong Sullivan target','Submit'],
['Lii / Zane Li','Directional Runway','A','Cold','Target','Digitals + hero test','Editorial individuality','Submit'],
['Collina Strada','Runway','B','Cold','Target','Digitals + test','Personality / editorial','Wave 2'],
['Eckhaus Latta','Runway / Editorial','B','Cold','Target','Digitals + test','Directional','Wave 2'],
['Ashlyn','Runway','B','Cold','Target','Digitals','Selective','Wave 2'],
['Ulla Johnson','Runway','B','Cold','Target','Clean digitals','Clean proportions','Wave 2'],
['Simkhai','Runway','B','Cold','Target','Digitals','NY fashion','Wave 2'],
['Wiederhoeft','Runway','B','Cold','Target','Digitals + walk','Movement-led','Review walk'],
['Zankov','Runway','B','Cold','Target','Digitals','Directional','Wave 2'],
['Anna Sui','Runway','B','Cold','Target','Digitals + walk','Presence','Review walk'],
['Monse','Runway','B','Cold','Target','Digitals','Fashion','Wave 2'],
['Conner Ives','Runway / Editorial','B','Cold','Target','Digitals + test','Editorial individuality','Wave 2'],
['Magda Butrym','Runway / Campaign','B','Cold','Hold','Hero test','Wait for Sunday test','Hold']];
function rows(){try{return JSON.parse(localStorage.getItem(KEY))||seed.map(function(x,i){return{id:'s'+i,target:x[0],lane:x[1],priority:x[2],relationship:x[3],stage:x[4],materials:x[5],intel:x[6],next:x[7],date:'',walk:/walk|required|runway/i.test(x[6]+' '+x[1])?'REVIEW':'CLEAR'};});}catch(e){return []}}
function save(r){localStorage.setItem(KEY,JSON.stringify(r))} function esc(v){return String(v||'').replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function funnel(r,s){return s==='Target'?r.length:r.filter(function(x){return x.stage===s}).length}
function render(){var el=document.getElementById('p-sullivandesk');if(!el)return;var r=rows();el.innerHTML='<main class="sdesk"><header class="sd-head"><div><div class="sd-kicker">CAVYRE · MODEL CAMPAIGN COMMAND</div><h1>Sullivan · New York Submission Desk</h1><p>NYFW SS27 · controlled fashion introduction · New York → Paris</p></div><div class="sd-actions"><button class="sd-btn" data-sd-export>Export CSV</button><button class="sd-btn primary" data-sd-add>+ Add Target</button></div></header><section class="sd-hero"><div class="sd-card sd-profile"><div><div class="sd-label">MODEL PROFILE</div><h2>Sullivan Jordan</h2><div class="sd-measures"><span>5\'9.5” / 177</span><span>31 / 79</span><span>22.5 / 57</span><span>33.5 / 85</span><span>8 US / 6 UK</span><span>Blue/Green</span></div></div><div class="sd-status"><div class="sd-chip"><small>Market</small><b>NEW YORK</b></div><div class="sd-chip"><small>Next</small><b>PARIS</b></div><div class="sd-chip"><small>Walk</small><b>REVIEW</b></div><div class="sd-chip"><small>Digitals</small><b>READY</b></div><div class="sd-chip"><small>Comp Card</small><b>READY</b></div><div class="sd-chip"><small>Test</small><b>SUNDAY</b></div></div></div><div class="sd-card sd-vera"><div class="sd-label">VERA · CAMPAIGN INTELLIGENCE</div><p><b>Establishment is the warmest relationship.</b> Follow up with updated digitals before treating Sullivan as a cold submission. Keep runway movement under review; sell face, proportions and availability first.</p></div></section><section class="sd-funnel">'+['Target','Submitted','Viewed','Response','Casting','Callback','Hold','Booked'].map(function(s){return'<div class="sd-stat"><b>'+funnel(r,s)+'</b><span>'+s+'</span></div>'}).join('')+'</section><div class="sd-tabs"><button class="sd-tab active">Target Pipeline</button><button class="sd-tab" data-sd-materials>Material Control</button><button class="sd-tab" data-sd-relationship>Relationship Intelligence</button><button class="sd-tab" data-sd-casting>Casting Command</button><button class="sd-tab" data-sd-paris>NY → Paris</button></div><div id="sd-body">'+table(r)+'</div></main>';bind(el,r)}
function table(r){return'<div class="sd-toolbar"><input id="sd-search" placeholder="Search target, lane, intelligence…"><select id="sd-priority"><option value="">All priorities</option><option>A</option><option>B</option><option>C</option></select></div><div class="sd-table-wrap"><table class="sd-table"><thead><tr><th>Target</th><th>Priority</th><th>Relationship</th><th>Stage</th><th>Walk</th><th>Materials</th><th>Vera Intelligence</th><th>Next Action</th><th>Last Action</th><th></th></tr></thead><tbody>'+r.map(row).join('')+'</tbody></table></div>'}
function row(x){return'<tr data-row="'+x.id+'"><td class="sd-target"><b>'+esc(x.target)+'</b><small>'+esc(x.lane)+'</small></td><td><span class="sd-pill '+esc(x.priority)+'">'+esc(x.priority)+'</span></td><td>'+esc(x.relationship)+'</td><td><select data-stage="'+x.id+'">'+['Target','Submitted','Viewed','Response','Casting','Callback','Hold','Option','Booked','Pass'].map(function(s){return'<option'+(x.stage===s?' selected':'')+'>'+s+'</option>'}).join('')+'</select></td><td><span class="sd-ready '+(x.walk==='CLEAR'?'ok':x.walk==='REVIEW'?'review':'hold')+'">'+esc(x.walk)+'</span></td><td>'+esc(x.materials)+'</td><td>'+esc(x.intel)+'</td><td>'+esc(x.next)+'</td><td>'+esc(x.date||'—')+'</td><td><div class="sd-row-actions"><button class="sd-mini" data-action="'+x.id+'">LOG</button><button class="sd-mini" data-delete="'+x.id+'">×</button></div></td></tr>'}
function materials(){return'<div class="sd-grid3">'+[['Digitals','READY','Current clean headshot, full length and profile.'],['Comp Card','READY','Measurements + agency identity + direct package link.'],['Walk Video','REVIEW','Do not attach automatically. Clear per runway target.'],['Sunday Test','HOLD','Select one hero image only if stronger than digitals.'],['Portfolio','READY','Use selectively; do not flood casting with images.'],['Measurements','READY','5\'9.5” · 31 · 22.5 · 33.5 · Shoe 8 US.']].map(function(x){return'<div class="sd-card sd-material"><div class="sd-label">MATERIAL CONTROL</div><h3>'+x[0]+'</h3><span class="sd-ready '+(x[1]==='READY'?'ok':x[1]==='REVIEW'?'review':'hold')+'">'+x[1]+'</span><p>'+x[2]+'</p></div>'}).join('')+'</div>'}
function bind(el,r){el.querySelectorAll('[data-stage]').forEach(function(s){s.onchange=function(){var a=rows(),x=a.find(function(z){return z.id===s.dataset.stage});if(x){x.stage=s.value;x.date=new Date().toLocaleDateString();save(a);render()}}});var q=el.querySelector('#sd-search'),p=el.querySelector('#sd-priority');function filter(){var v=(q.value||'').toLowerCase(),pv=p.value;el.querySelectorAll('[data-row]').forEach(function(tr){var x=r.find(function(z){return z.id===tr.dataset.row});tr.style.display=(!pv||x.priority===pv)&&(!v||JSON.stringify(x).toLowerCase().includes(v))?'':'none'})}if(q)q.oninput=filter;if(p)p.onchange=filter;el.querySelector('[data-sd-materials]').onclick=function(){el.querySelector('#sd-body').innerHTML=materials()};el.querySelector('[data-sd-relationship]').onclick=function(){el.querySelector('#sd-body').innerHTML='<div class="sd-card"><div class="sd-label">RELATIONSHIP INTELLIGENCE</div><h2>Warm first. Cold second.</h2><p>Establishment carries prior Sullivan activity. Every future touch should preserve history, response, requested materials and next-contact timing. Midland, The Line and Brokaw begin as controlled introductions.</p></div>'};el.querySelector('[data-sd-casting]').onclick=function(){el.querySelector('#sd-body').innerHTML='<div class="sd-card"><div class="sd-label">CASTING COMMAND</div><h2>No confirmed casting loaded</h2><p>When a target moves to Casting, use Calendar to create the time, address, wardrobe instructions and travel buffer; keep the outcome here as the campaign record.</p></div>'};el.querySelector('[data-sd-paris]').onclick=function(){el.querySelector('#sd-body').innerHTML='<div class="sd-card"><div class="sd-label">NEW YORK → PARIS INTELLIGENCE</div><h2>Carry only meaningful signal forward.</h2><p>Callbacks, holds, options, bookings and strong casting-office relationships become Paris positioning. Weak or random credits should not be used simply to add volume.</p></div>'};el.querySelector('[data-sd-add]').onclick=function(){var name=prompt('Target / client name');if(!name)return;var a=rows();a.unshift({id:'u'+Date.now(),target:name,lane:'New Target',priority:'B',relationship:'Cold',stage:'Target',walk:'REVIEW',materials:'Digitals + comp card',intel:'Needs agent review',next:'Qualify target',date:''});save(a);render()};el.querySelectorAll('[data-action]').forEach(function(b){b.onclick=function(){var note=prompt('Log next action / note');if(!note)return;var a=rows(),x=a.find(function(z){return z.id===b.dataset.action});if(x){x.next=note;x.date=new Date().toLocaleDateString();save(a);render()}}});el.querySelectorAll('[data-delete]').forEach(function(b){b.onclick=function(){if(!confirm('Remove this target?'))return;save(rows().filter(function(x){return x.id!==b.dataset.delete}));render()}});el.querySelector('[data-sd-export]').onclick=function(){var a=rows(),h=['Target','Lane','Priority','Relationship','Stage','Walk','Materials','Intelligence','Next Action','Last Action'];var csv=[h].concat(a.map(function(x){return[x.target,x.lane,x.priority,x.relationship,x.stage,x.walk,x.materials,x.intel,x.next,x.date]})).map(function(z){return z.map(function(v){return'"'+String(v||'').replace(/"/g,'""')+'"'}).join(',')}).join('\n');var blob=new Blob([csv],{type:'text/csv'}),u=URL.createObjectURL(blob),a1=document.createElement('a');a1.href=u;a1.download='Sullivan-New-York-Submission-Desk.csv';a1.click();URL.revokeObjectURL(u)}}
function install(){var app=document.querySelector('.app')||document.body;if(!document.getElementById('p-sullivandesk')){var d=document.createElement('div');d.id='p-sullivandesk';d.className='panel';app.appendChild(d)}var old=window.navTo;if(typeof old==='function'&&!old.__sd){var fn=function(p){if(p==='sullivandesk'){document.querySelectorAll('.panel').forEach(function(x){x.classList.remove('active')});var e=document.getElementById('p-sullivandesk');e.classList.add('active');window._currentPage=p;render();try{history.replaceState(null,'','#sullivandesk')}catch(_e){}return}return old.apply(this,arguments)};fn.__sd=true;window.navTo=fn}var rail=document.getElementById('vx73-rail')||document.querySelector('.vx73-rail');if(rail&&!rail.querySelector('[data-page="sullivandesk"]')){var b=document.createElement('button');b.dataset.page='sullivandesk';b.title='Submission Desk';b.setAttribute('aria-label','Submission Desk');b.innerHTML='<i>↗</i><span>Submissions</span>';b.onclick=function(){window.navTo('sullivandesk')};var roster=rail.querySelector('[data-page="roster"]');if(roster&&roster.nextSibling)rail.insertBefore(b,roster.nextSibling);else rail.appendChild(b)}}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){setTimeout(install,700)});else setTimeout(install,700);window.CAVYRE_SULLIVAN_DESK={render:render,reset:function(){localStorage.removeItem(KEY);render()}};
})();

;/* END cavyre-sullivan-submission-desk-16.11.34.js */

;/* BEGIN cavyre-model-campaigns-16.11.35.js */
(function(){'use strict';
var CK='cavyre.modelCampaigns.v1', ACTIVE='cavyre.modelCampaigns.active';
var sullivanTargets=[['Establishment / Anita Bitton','Casting Office','A','Warm','Follow-up','Digitals + comp card','Previous Sullivan activity','Follow up now'],['Midland / Rachel Chandler','Casting Office','A','Cold','Target','Digitals + comp card','Directional / editorial fit','Introduce'],['The Line Casting','Casting Office','A','Cold','Target','Digitals + comp card','New-face lane','Submit'],['Ashley Brokaw','Casting Office','A','Cold','Target','Digitals + comp card','High-level controlled intro','Introduce'],['Khaite','Runway','A','Cold','Target','Digitals first','Walk clearance required','Submit'],['Tory Burch','Runway','A','Cold','Target','Digitals first','Walk clearance required','Submit'],['Calvin Klein Collection','Runway','A','Cold','Target','Digitals first','Selective runway','Submit'],['COS','Runway / Lookbook','A','Cold','Target','Digitals + comp card','Strong proportions lane','Submit'],['Proenza Schouler','Runway / Editorial','A','Cold','Target','Digitals first','Editorial runway','Submit'],['Diotima','Runway / Editorial','A','Cold','Target','Digitals + hero test','Strong visual compatibility','Submit'],['Fforme','Runway / Editorial','A','Cold','Target','Digitals + hero test','Directional fit','Submit'],['Area','Runway','A','Cold','Target','Digitals first','Presence / movement','Submit'],['Altuzarra','Runway','A','Cold','Target','Digitals first','Selective runway','Submit'],['Kallmeyer','Runway / Lookbook','A','Cold','Target','Digitals + comp card','Strong Sullivan target','Submit'],['Lii / Zane Li','Directional Runway','A','Cold','Target','Digitals + hero test','Editorial individuality','Submit'],['Collina Strada','Runway','B','Cold','Target','Digitals + test','Personality / editorial','Wave 2'],['Eckhaus Latta','Runway / Editorial','B','Cold','Target','Digitals + test','Directional','Wave 2'],['Ashlyn','Runway','B','Cold','Target','Digitals','Selective','Wave 2'],['Ulla Johnson','Runway','B','Cold','Target','Clean digitals','Clean proportions','Wave 2'],['Simkhai','Runway','B','Cold','Target','Digitals','NY fashion','Wave 2'],['Wiederhoeft','Runway','B','Cold','Target','Digitals + walk','Movement-led','Review walk'],['Zankov','Runway','B','Cold','Target','Digitals','Directional','Wave 2'],['Anna Sui','Runway','B','Cold','Target','Digitals + walk','Presence','Review walk'],['Monse','Runway','B','Cold','Target','Digitals','Fashion','Wave 2'],['Conner Ives','Runway / Editorial','B','Cold','Target','Digitals + test','Editorial individuality','Wave 2'],['Magda Butrym','Runway / Campaign','B','Cold','Hold','Hero test','Wait for test','Hold']];
function esc(v){return String(v||'').replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function mkTargets(a){return a.map(function(x,i){return{id:'t'+Date.now()+i,target:x[0],lane:x[1],priority:x[2],relationship:x[3],stage:x[4],materials:x[5],intel:x[6],next:x[7],date:'',walk:/walk|required|runway/i.test(x[6]+' '+x[1])?'REVIEW':'CLEAR'};})}
function initial(){var old;try{old=JSON.parse(localStorage.getItem('cavyre.sullivan.submissionDesk.v1'))}catch(e){} return [{id:'sullivan-ny-ss27',model:'Sullivan Jordan',market:'New York',nextMarket:'Paris',season:'SS27',type:'NYFW',start:'2026-08-28',end:'2026-09-15',status:'ACTIVE',measurements:"5'9.5” / 177 · 31 / 79 · 22.5 / 57 · 33.5 / 85 · Shoe 8 US / 6 UK · Blue/Green",walk:'REVIEW',digitals:'READY',comp:'READY',test:'SUNDAY',note:'Controlled fashion introduction. Protect image; carry meaningful New York signal into Paris.',targets:(old&&old.length?old:mkTargets(sullivanTargets))}]}
function all(){try{var a=JSON.parse(localStorage.getItem(CK));if(a&&a.length)return a}catch(e){}var a=initial();saveAll(a);return a}function saveAll(a){localStorage.setItem(CK,JSON.stringify(a))}function active(){var a=all(),id=localStorage.getItem(ACTIVE);return a.find(function(x){return x.id===id})||null}function setActive(id){localStorage.setItem(ACTIVE,id)}function update(c){var a=all(),i=a.findIndex(function(x){return x.id===c.id});if(i>-1)a[i]=c;else a.unshift(c);saveAll(a)}
function score(x){var n=50;if(x.priority==='A')n+=20;if(x.relationship==='Warm')n+=12;if(x.walk==='CLEAR')n+=6;if(/Casting|Callback|Hold|Option|Booked/.test(x.stage))n+=10;return Math.min(98,n)}
function funnel(r,s){return s==='Targets'?r.length:r.filter(function(x){return x.stage===s}).length}
function campaignCards(){var a=all();return '<div class="mc-topline"><div><div class="sd-kicker">CAVYRE · SUBMISSION CAMPAIGNS</div><h1>Model Campaign Command</h1><p>One intelligence desk for every model, market and season.</p></div><button class="sd-btn primary" data-mc-new>+ New Campaign</button></div><section class="mc-campaigns">'+a.map(function(c){var booked=c.targets.filter(function(x){return x.stage==='Booked'}).length;return '<div class="sd-card mc-campaign" data-mc-open="'+c.id+'"><div class="sd-label">'+esc(c.status)+' · '+esc(c.market)+'</div><h3>'+esc(c.model)+'</h3><p>'+esc(c.type)+' · '+esc(c.season)+(c.nextMarket?' · Next '+esc(c.nextMarket):'')+'</p><div class="mc-meta"><span class="sd-ready ok">'+c.targets.length+' TARGETS</span><span class="sd-ready review">'+booked+' BOOKED</span><span class="sd-ready">WALK '+esc(c.walk)+'</span></div></div>'}).join('')+'</section><div class="sd-card mc-empty"><div class="sd-label">SYSTEM LOGIC</div><h2>Model 360 → Campaigns → Market Desk</h2><p>Create independent New York, Paris, Milan, London or direct-client campaigns. Relationship history, materials, runway clearance and outcomes stay attached to the campaign.</p></div>'}
function table(c){var r=c.targets;return '<div class="sd-toolbar"><input id="mc-search" placeholder="Search target, lane, intelligence…"><select id="mc-priority"><option value="">All priorities</option><option>A</option><option>B</option><option>C</option></select></div><div class="sd-table-wrap"><table class="sd-table"><thead><tr><th>Target</th><th>Fit</th><th>Priority</th><th>Relationship</th><th>Stage</th><th>Walk</th><th>Materials</th><th>Vera Intelligence</th><th>Next Action</th><th></th></tr></thead><tbody>'+r.map(function(x){return '<tr data-mc-row="'+x.id+'"><td class="sd-target"><b>'+esc(x.target)+'</b><small>'+esc(x.lane)+'</small></td><td><span class="mc-score">'+score(x)+'%</span></td><td><span class="sd-pill '+esc(x.priority)+'">'+esc(x.priority)+'</span></td><td>'+esc(x.relationship)+'</td><td><select data-mc-stage="'+x.id+'">'+['Target','Submitted','Viewed','Response','Casting','Callback','Hold','Option','Booked','Pass'].map(function(s){return '<option'+(x.stage===s?' selected':'')+'>'+s+'</option>'}).join('')+'</select></td><td><select data-mc-walk="'+x.id+'"><option'+(x.walk==='CLEAR'?' selected':'')+'>CLEAR</option><option'+(x.walk==='REVIEW'?' selected':'')+'>REVIEW</option><option'+(x.walk==='DO NOT SEND'?' selected':'')+'>DO NOT SEND</option></select></td><td>'+esc(x.materials)+'</td><td>'+esc(x.intel)+'</td><td>'+esc(x.next)+'</td><td><div class="sd-row-actions"><button class="sd-mini" data-mc-log="'+x.id+'">LOG</button><button class="sd-mini" data-mc-del="'+x.id+'">×</button></div></td></tr>'}).join('')+'</tbody></table></div>'}
function renderCampaign(c){var el=document.getElementById('p-sullivandesk');if(!el)return;el.innerHTML='<main class="sdesk"><div class="mc-breadcrumb"><button class="mc-back" data-mc-home>← All Campaigns</button><span>·</span><span>'+esc(c.model)+' / '+esc(c.market)+'</span></div><header class="sd-head"><div><div class="sd-kicker">CAVYRE · MODEL CAMPAIGN COMMAND</div><h1>'+esc(c.model)+' · '+esc(c.market)+' Submission Desk</h1><p>'+esc(c.type)+' · '+esc(c.season)+(c.nextMarket?' · '+esc(c.market)+' → '+esc(c.nextMarket):'')+'</p></div><div class="sd-actions"><button class="sd-btn" data-mc-export>Export CSV</button><button class="sd-btn" data-mc-edit>Edit Campaign</button><button class="sd-btn primary" data-mc-add>+ Add Target</button></div></header><section class="sd-hero"><div class="sd-card sd-profile"><div><div class="sd-label">MODEL / CAMPAIGN</div><h2>'+esc(c.model)+'</h2><div class="mc-model-note">'+esc(c.measurements||'Measurements not loaded')+'</div></div><div class="sd-status"><div class="sd-chip"><small>Market</small><b>'+esc(c.market)+'</b></div><div class="sd-chip"><small>Next</small><b>'+esc(c.nextMarket||'—')+'</b></div><div class="sd-chip"><small>Walk</small><b>'+esc(c.walk)+'</b></div><div class="sd-chip"><small>Digitals</small><b>'+esc(c.digitals)+'</b></div><div class="sd-chip"><small>Comp Card</small><b>'+esc(c.comp)+'</b></div><div class="sd-chip"><small>Test</small><b>'+esc(c.test)+'</b></div></div></div><div class="sd-card sd-vera"><div class="sd-label">VERA · CAMPAIGN INTELLIGENCE</div><p><b>'+esc(c.model)+'</b>: '+esc(c.note||'Campaign active. Prioritize warm relationships, current materials and high-fit targets.')+'</p></div></section><section class="sd-funnel">'+['Targets','Submitted','Viewed','Response','Casting','Callback','Hold','Booked'].map(function(s){return '<div class="sd-stat"><b>'+funnel(c.targets,s)+'</b><span>'+s+'</span></div>'}).join('')+'</section><div class="sd-tabs"><button class="sd-tab active">Target Pipeline</button><button class="sd-tab" data-mc-materials>Material Control</button><button class="sd-tab" data-mc-rel>Relationship Intelligence</button><button class="sd-tab" data-mc-cast>Casting Command</button><button class="sd-tab" data-mc-next>Market Carryover</button></div><div id="mc-body">'+table(c)+'</div></main>';bindCampaign(el,c)}
function render(){var el=document.getElementById('p-sullivandesk');if(!el)return;var c=active();el.innerHTML='<main class="sdesk">'+(c?'':campaignCards())+'</main>';if(c)renderCampaign(c);else bindHome(el)}
function bindHome(el){el.querySelectorAll('[data-mc-open]').forEach(function(b){b.onclick=function(){setActive(b.dataset.mcOpen);render()}});var n=el.querySelector('[data-mc-new]');if(n)n.onclick=newModal}
function newModal(){modal(null)}
function modal(c){var wrap=document.createElement('div');wrap.className='mc-modal';wrap.innerHTML='<div class="mc-modal-card"><div class="sd-label">'+(c?'EDIT':'NEW')+' MODEL CAMPAIGN</div><h2>'+(c?'Campaign Settings':'Create Submission Campaign')+'</h2><div class="mc-form"><div class="mc-field"><label>Model</label><input id="m-model" value="'+esc(c&&c.model)+'" placeholder="Model name"></div><div class="mc-field"><label>Market</label><select id="m-market">'+['New York','Paris','Milan','London','Los Angeles','Direct / Global'].map(function(v){return '<option'+(c&&c.market===v?' selected':'')+'>'+v+'</option>'}).join('')+'</select></div><div class="mc-field"><label>Season</label><input id="m-season" value="'+esc(c&&c.season||'SS27')+'"></div><div class="mc-field"><label>Campaign Type</label><input id="m-type" value="'+esc(c&&c.type||'Fashion Week')+'"></div><div class="mc-field"><label>Start</label><input type="date" id="m-start" value="'+esc(c&&c.start)+'"></div><div class="mc-field"><label>End</label><input type="date" id="m-end" value="'+esc(c&&c.end)+'"></div><div class="mc-field"><label>Next Market</label><input id="m-next" value="'+esc(c&&c.nextMarket)+'" placeholder="Paris"></div><div class="mc-field"><label>Walk Clearance</label><select id="m-walk"><option>CLEAR</option><option'+(c&&c.walk==='REVIEW'?' selected':'')+'>REVIEW</option><option'+(c&&c.walk==='DO NOT SEND'?' selected':'')+'>DO NOT SEND</option></select></div><div class="mc-field full"><label>Measurements / Profile line</label><input id="m-meas" value="'+esc(c&&c.measurements)+'" placeholder="Height · Bust · Waist · Hips · Shoe · Eyes"></div><div class="mc-field full"><label>Vera campaign brief</label><textarea id="m-note" rows="3">'+esc(c&&c.note)+'</textarea></div></div><div class="mc-modal-actions"><button class="sd-btn" data-close>Cancel</button><button class="sd-btn primary" data-save>'+ (c?'Save Changes':'Create Campaign') +'</button></div></div>';document.body.appendChild(wrap);wrap.querySelector('[data-close]').onclick=function(){wrap.remove()};wrap.querySelector('[data-save]').onclick=function(){var model=wrap.querySelector('#m-model').value.trim();if(!model)return alert('Model name is required');var obj=c||{id:'campaign-'+Date.now(),targets:[],status:'ACTIVE',digitals:'REVIEW',comp:'REVIEW',test:'HOLD'};obj.model=model;obj.market=wrap.querySelector('#m-market').value;obj.season=wrap.querySelector('#m-season').value;obj.type=wrap.querySelector('#m-type').value;obj.start=wrap.querySelector('#m-start').value;obj.end=wrap.querySelector('#m-end').value;obj.nextMarket=wrap.querySelector('#m-next').value;obj.walk=wrap.querySelector('#m-walk').value;obj.measurements=wrap.querySelector('#m-meas').value;obj.note=wrap.querySelector('#m-note').value;update(obj);setActive(obj.id);wrap.remove();render()}}
function bindCampaign(el,c){el.querySelector('[data-mc-home]').onclick=function(){localStorage.removeItem(ACTIVE);render()};el.querySelector('[data-mc-edit]').onclick=function(){modal(c)};el.querySelector('[data-mc-add]').onclick=function(){var name=prompt('Target / client name');if(!name)return;c.targets.unshift({id:'u'+Date.now(),target:name,lane:'New Target',priority:'B',relationship:'Cold',stage:'Target',walk:c.walk||'REVIEW',materials:'Digitals + comp card',intel:'Needs agent review',next:'Qualify target',date:''});update(c);render()};el.querySelectorAll('[data-mc-stage]').forEach(function(s){s.onchange=function(){var x=c.targets.find(function(z){return z.id===s.dataset.mcStage});x.stage=s.value;x.date=new Date().toLocaleDateString();update(c);render()}});el.querySelectorAll('[data-mc-walk]').forEach(function(s){s.onchange=function(){var x=c.targets.find(function(z){return z.id===s.dataset.mcWalk});x.walk=s.value;update(c);render()}});el.querySelectorAll('[data-mc-log]').forEach(function(b){b.onclick=function(){var note=prompt('Log next action / note');if(!note)return;var x=c.targets.find(function(z){return z.id===b.dataset.mcLog});x.next=note;x.date=new Date().toLocaleDateString();update(c);render()}});el.querySelectorAll('[data-mc-del]').forEach(function(b){b.onclick=function(){if(!confirm('Remove this target?'))return;c.targets=c.targets.filter(function(x){return x.id!==b.dataset.mcDel});update(c);render()}});var q=el.querySelector('#mc-search'),p=el.querySelector('#mc-priority');function filter(){var v=(q.value||'').toLowerCase(),pv=p.value;el.querySelectorAll('[data-mc-row]').forEach(function(tr){var x=c.targets.find(function(z){return z.id===tr.dataset.mcRow});tr.style.display=(!pv||x.priority===pv)&&(!v||JSON.stringify(x).toLowerCase().includes(v))?'':'none'})}q.oninput=filter;p.onchange=filter;el.querySelector('[data-mc-materials]').onclick=function(){el.querySelector('#mc-body').innerHTML='<div class="sd-grid3">'+[['Digitals',c.digitals],['Comp Card',c.comp],['Walk Video',c.walk],['Test / Editorial',c.test],['Portfolio','READY'],['Measurements',c.measurements?'READY':'REVIEW']].map(function(x){return '<div class="sd-card sd-material"><div class="sd-label">MATERIAL CONTROL</div><h3>'+x[0]+'</h3><span class="sd-ready '+(x[1]==='READY'||x[1]==='CLEAR'?'ok':'review')+'">'+esc(x[1])+'</span></div>'}).join('')+'</div>'};el.querySelector('[data-mc-rel]').onclick=function(){var warm=c.targets.filter(function(x){return x.relationship==='Warm'});el.querySelector('#mc-body').innerHTML='<div class="sd-card"><div class="sd-label">RELATIONSHIP INTELLIGENCE</div><h2>'+warm.length+' warm relationship'+(warm.length===1?'':'s')+'</h2><p>'+ (warm.length?warm.map(function(x){return esc(x.target)}).join(' · '):'No warm relationships logged yet. Convert responses and prior activity into persistent relationship history.') +'</p></div>'};el.querySelector('[data-mc-cast]').onclick=function(){var cast=c.targets.filter(function(x){return /Casting|Callback|Hold|Option|Booked/.test(x.stage)});el.querySelector('#mc-body').innerHTML='<div class="sd-card"><div class="sd-label">CASTING COMMAND</div><h2>'+cast.length+' active outcome'+(cast.length===1?'':'s')+'</h2><p>'+(cast.length?cast.map(function(x){return '<b>'+esc(x.target)+'</b> · '+esc(x.stage)}).join('<br>'):'When a target moves to Casting, Callback, Hold or Option, connect the appointment to Orbit Calendar and retain the outcome here.')+'</p></div>'};el.querySelector('[data-mc-next]').onclick=function(){el.querySelector('#mc-body').innerHTML='<div class="sd-card"><div class="sd-label">MARKET CARRYOVER</div><h2>'+esc(c.market)+' → '+esc(c.nextMarket||'Next Market')+'</h2><p>Carry callbacks, holds, options, bookings and meaningful casting relationships forward. Passes and low-value credits remain internal campaign history.</p></div>'};el.querySelector('[data-mc-export]').onclick=function(){var h=['Model','Market','Target','Lane','Priority','Relationship','Stage','Walk','Materials','Intelligence','Next Action','Last Action'];var csv=[h].concat(c.targets.map(function(x){return[c.model,c.market,x.target,x.lane,x.priority,x.relationship,x.stage,x.walk,x.materials,x.intel,x.next,x.date]})).map(function(z){return z.map(function(v){return '"'+String(v||'').replace(/"/g,'""')+'"'}).join(',')}).join('\n');var blob=new Blob([csv],{type:'text/csv'}),u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download=c.model.replace(/\s+/g,'-')+'-'+c.market.replace(/\s+/g,'-')+'-Campaign.csv';a.click();URL.revokeObjectURL(u)}}
function install(){var old=window.CAVYRE_SULLIVAN_DESK;if(old)window.CAVYRE_SULLIVAN_DESK=null;var nav=window.navTo;if(typeof nav==='function'&&!nav.__mc){var fn=function(p){if(p==='sullivandesk'||p==='campaigns'){document.querySelectorAll('.panel').forEach(function(x){x.classList.remove('active')});var e=document.getElementById('p-sullivandesk');if(e)e.classList.add('active');window._currentPage='campaigns';render();try{history.replaceState(null,'','#campaigns')}catch(e){}return}return nav.apply(this,arguments)};fn.__mc=true;window.navTo=fn}document.querySelectorAll('[data-page="sullivandesk"]').forEach(function(b){b.title='Model Campaigns';b.setAttribute('aria-label','Model Campaigns');var sp=b.querySelector('span');if(sp)sp.textContent='Campaigns';b.onclick=function(){window.navTo('campaigns')}});if(location.hash==='#campaigns')setTimeout(function(){window.navTo('campaigns')},50)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){setTimeout(install,1100)});else setTimeout(install,1100);window.CAVYRE_MODEL_CAMPAIGNS={render:render,all:all,newCampaign:newModal};
})();

;/* END cavyre-model-campaigns-16.11.35.js */

;/* BEGIN cavyre-industry-intelligence-16.11.36.js */
(function(){'use strict';if(window.__CAVYRE_INDUSTRY_161136__)return;window.__CAVYRE_INDUSTRY_161136__=1;document.documentElement.setAttribute('data-industry-intelligence','16.11.36');function stamp(){var b=document.getElementById('cavyre-release-badge-161075');}document.readyState==='loading'?document.addEventListener('DOMContentLoaded',stamp,{once:true}):stamp();})();
;/* END cavyre-industry-intelligence-16.11.36.js */

;/* BEGIN cavyre-calendar-role-release-16.11.37.js */
(function(){document.documentElement.setAttribute('data-calendar-release','16.11.37');var b=document.getElementById('cavyre-release-badge-161075');})();
;/* END cavyre-calendar-role-release-16.11.37.js */

;/* BEGIN cavyre-media-release-16.11.38.js */
(function(){'use strict';if(window.__CAVYRE_MEDIA_161138__)return;window.__CAVYRE_MEDIA_161138__=1;document.documentElement.setAttribute('data-media-workflow','16.11.38');function s(){var b=document.getElementById('cavyre-release-badge-161075');}document.readyState==='loading'?document.addEventListener('DOMContentLoaded',s,{once:true}):s();})();
;/* END cavyre-media-release-16.11.38.js */

;/* 16.15.08 quarantined legacy runtime: cavyre-calendar-geometry-runtime-16.11.40.js */

;/* BEGIN cavyre-model-access-control-16.11.43.js */
(function(){'use strict';
if(window.__CAVYRE_MODEL_ACCESS_161143__)return;window.__CAVYRE_MODEL_ACCESS_161143__=true;
function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
function bridge(){return window.VEUX_AGENT_V4;}
function org(){try{return bridge().state.org.slug||'maison-de-veux';}catch(_e){return'maison-de-veux';}}
function modelId(){return window._veuxV10ModelId||null;}
async function api(path,opt){var b=bridge();if(!b||typeof b.api!=='function')throw new Error('Secure Agent connection is still loading.');return b.api(path,opt||{method:'GET',headers:{}});}
function fmt(v){if(!v)return'—';var d=new Date(v);return isNaN(d)?String(v):d.toLocaleString();}
function close(){var x=document.getElementById('vx1643-access-modal');if(x)x.remove();}
function stat(k,v){return '<div class="vx1641-stat"><span>'+esc(k)+'</span><b>'+esc(v==null?'—':v)+'</b></div>';}
function panel(a,temp){var disabled=!!a.portal_disabled;return '<div class="vx1641-grid">'+stat('Status',a.status)+stat('Authentication',a.authentication)+stat('Login Email',a.email||'—')+stat('Last Login',fmt(a.last_login))+stat('Password Status',a.password_status)+stat('Temporary Expires',fmt(a.temp_password_expires_at))+'</div>'+(!a.linked?'<div class="vx1641-unlinked"><b>Authentication Account Not Linked</b><br>This model has no verified CAVYRE Auth user. Password controls are disabled until the model profile is linked to one authentication account.</div>':'<div class="vx1641-actions"><button class="primary" data-act="temp">Generate Temporary Password</button><button data-act="email">Send Reset Email</button><button class="'+(disabled?'':'danger')+'" data-act="toggle">'+(disabled?'Enable Portal Access':'Disable Portal Access')+'</button></div>')+(temp?'<div class="vx1641-temp"><small>Temporary access created · display once</small><div class="vx1641-pass"><code>'+esc(temp)+'</code><button data-copy>Copy Login Details</button></div><div class="vx1641-note">The temporary password is a valid login password until it is replaced. The model can change it at https://www.maisondeveux.com/portal/access.html?mode=temp&v=161297. Generating another temporary password immediately replaces this one.</div></div>':'')+'<div class="vx1641-error" data-error></div>';}
async function load(temp){var id=modelId();if(!id)throw new Error('No model is selected.');var out=await api('/api/agent/model-access?organization='+encodeURIComponent(org())+'&model_id='+encodeURIComponent(id));var a=out.access||{};var body=document.querySelector('#vx1643-access-modal .vx1641-body');if(body){body.innerHTML=panel(a,temp);bind(a,temp);}return a;}
function bind(a,temp){var root=document.getElementById('vx1643-access-modal');if(!root)return;var buttons=root.querySelectorAll('[data-act]');buttons.forEach(function(b){b.onclick=async function(){var act=b.dataset.act,err=root.querySelector('[data-error]');if(err)err.textContent='';if(act==='toggle'&&!confirm(a.portal_disabled?'Enable this model\'s portal access?':'Disable this model\'s portal access? The model will be signed out and blocked from authenticating.'))return;buttons.forEach(function(x){x.disabled=true;});try{var action=act==='temp'?'generate_temporary_password':act==='email'?'send_reset_email':a.portal_disabled?'enable_portal_access':'disable_portal_access';var out=await api('/api/agent/model-access',{method:'POST',body:JSON.stringify({organization_slug:org(),model_id:modelId(),action:action})});if(act==='temp'){await load(out.temporary_password||'');}else{await load();if(window.toast)window.toast(act==='email'?'Reset email sent':'Portal access updated');}}catch(e){buttons.forEach(function(x){x.disabled=false;});if(err)err.textContent=e.message||e;}};});var cp=root.querySelector('[data-copy]');if(cp)cp.onclick=async function(){var text='Model Portal: https://maisondeveux.com/portal\nEmail: '+(a.email||'')+'\nTemporary Password: '+temp;try{await navigator.clipboard.writeText(text);cp.textContent='Copied ✓';}catch(_e){prompt('Copy login details:',text);}};}
async function open(){close();var m=document.createElement('div');m.id='vx1643-access-modal';m.innerHTML='<div class="vx1641-shell"><div class="vx1641-head"><div><div class="vx1641-k">PORTAL ACCESS · CAVYRE AUTH</div><h2>Account &amp; Access</h2></div><button class="vx1641-close" aria-label="Close">×</button></div><div class="vx1641-body"><div class="vx1641-note">Loading authentication account…</div></div></div>';document.body.appendChild(m);m.querySelector('.vx1641-close').onclick=close;m.onclick=function(e){if(e.target===m)close();};try{await load();}catch(e){var body=m.querySelector('.vx1641-body');if(body)body.innerHTML='<div class="vx1641-error">'+esc(e.message||e)+'</div>';}}
function modelPage(){var p=document.getElementById('p-modelpage');return p&&p.classList.contains('on')&&modelId()?p:null;}
function injectTab(p){if(p.querySelector('[data-vx1643-access-tab]'))return true;var tabs=[].slice.call(p.querySelectorAll('button,a,[role="tab"],.tab,.v155-tab,.v152-tab,.v156-tab'));var visa=tabs.find(function(x){return String(x.textContent||'').trim().toUpperCase()==='VISA';});if(!visa)return false;var b=document.createElement(visa.tagName==='A'?'a':'button');if(b.tagName==='BUTTON')b.type='button';b.className=visa.className;b.setAttribute('data-vx1643-access-tab','1');b.setAttribute('aria-label','Account & Access');b.textContent='ACCESS';b.onclick=function(e){e.preventDefault();e.stopPropagation();open();};visa.insertAdjacentElement('afterend',b);return true;}
function injectButton(p){if(p.querySelector('[data-vx1643-access-btn]'))return;var target=p.querySelector('.v155-head-actions,.v152-head-actions,.v156-head-actions,.v144-model-top-actions,.v155-model-actions')||p.querySelector('h1,h2');if(!target)return;var b=document.createElement('button');b.type='button';b.className='vx1641-access-btn';b.setAttribute('data-vx1643-access-btn','1');b.textContent='Account & Access';b.onclick=open;if(/^H[12]$/.test(target.tagName))target.insertAdjacentElement('afterend',b);else target.appendChild(b);}
function inject(){var p=modelPage();if(!p)return;var gotTab=injectTab(p);if(!gotTab)injectButton(p);document.documentElement.setAttribute('data-cavyre-model-access','16.11.43');}
window.CAVYRE_MODEL_ACCESS={open:open,refresh:load};var scheduled=false;function schedule(){if(scheduled)return;scheduled=true;requestAnimationFrame(function(){scheduled=false;inject();});}if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule,{once:true});else schedule();new MutationObserver(schedule).observe(document.documentElement,{subtree:true,childList:true});window.addEventListener('veux:shell-ready',schedule);/* 16.11.48 consolidated: redundant model-access polling removed */
})();

;/* END cavyre-model-access-control-16.11.43.js */

;/* BEGIN cavyre-task-crud-authority-16.11.42.js */
(function(){
'use strict';
if(window.__CAVYRE_TASK_CRUD_161142__)return;window.__CAVYRE_TASK_CRUD_161142__=1;
var cache=null,editing=null;
function bridge(){if(!window.VEUX_AGENT_V4||!VEUX_AGENT_V4.api)throw new Error('Agent bridge is not ready');return VEUX_AGENT_V4;}
function org(){try{return bridge().state.org.slug||'maison-de-veux';}catch(e){return'maison-de-veux';}}
function api(path,opt){return bridge().api(path,opt||{method:'GET',headers:{}});}
function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
function toast(v){try{if(window.toast)return window.toast(v);if(window.say)return window.say(v);}catch(e){}console.log(v);}
function modal(){var m=document.getElementById('vx161142-task-modal');if(m)m.remove();m=document.createElement('div');m.id='vx161142-task-modal';m.className='vx161142-backdrop';document.body.appendChild(m);return m;}
function localDate(v){if(!v)return'';var d=new Date(v);if(isNaN(d))return'';var z=function(n){return String(n).padStart(2,'0')};return d.getFullYear()+'-'+z(d.getMonth()+1)+'-'+z(d.getDate())+'T'+z(d.getHours())+':'+z(d.getMinutes());}
async function data(force){if(cache&&!force)return cache;cache=await api('/api/agent/tasks/v11?organization='+encodeURIComponent(org()));return cache;}
function close(){var m=document.getElementById('vx161142-task-modal');if(m)m.remove();editing=null;}
async function open(id){
 var m=modal();m.innerHTML='<div class="vx161142-modal vx161142-loading">Loading task controls…</div>';
 try{
  var d=await data(true),t=id?(d.tasks||[]).find(function(x){return String(x.id)===String(id)}):null;editing=t||null;
  var modelOpts=(d.models||[]).map(function(x){return '<option value="'+esc(x.id)+'" '+(t&&String(t.model_id)===String(x.id)?'selected':'')+'>'+esc(x.display_name||x.public_slug||'Model')+'</option>';}).join('');
  var assigned=t?(t.assignments||[]).map(function(a){return String(a.member_id||'')}):[];
  var staffOpts=(d.members||[]).map(function(x){var nm=x.profile&&x.profile.display_name||x.job_title||'Staff';return '<option value="'+esc(x.id)+'" '+(assigned.includes(String(x.id))?'selected':'')+'>'+esc(nm)+'</option>';}).join('');
  m.innerHTML='<section class="vx161142-modal" role="dialog" aria-modal="true" aria-labelledby="vx161142-title">'+
   '<header><div><small>TASK COMMAND</small><h2 id="vx161142-title">'+(t?'Edit Task':'New Task')+'</h2></div><button type="button" class="vx161142-x" data-close>×</button></header>'+
   '<form id="vx161142-form"><div class="vx161142-grid">'+
   '<label class="wide"><span>Task Title</span><input id="vx161142-tt" required maxlength="180" value="'+esc(t&&t.title||'')+'"></label>'+
   '<label><span>Due</span><input id="vx161142-due" type="datetime-local" value="'+esc(localDate(t&&t.due_at))+'"></label>'+
   '<label><span>Priority</span><select id="vx161142-pr"><option value="normal">Normal</option><option value="high">High</option><option value="urgent">Urgent</option><option value="critical">Critical</option></select></label>'+
   '<label><span>Model</span><select id="vx161142-model"><option value="">— No model —</option>'+modelOpts+'</select></label>'+
   '<label><span>Assign Staff</span><select id="vx161142-staff" multiple size="4">'+staffOpts+'</select><em>Use Command/Ctrl to select more than one.</em></label>'+
   '<label><span>Category</span><input id="vx161142-cat" value="'+esc(t&&t.category||'Operations')+'"></label>'+
   (t?'<label><span>Status</span><select id="vx161142-status"><option value="open">Open</option><option value="in_progress">In Progress</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option></select></label>':'<div></div>')+
   '<label class="wide"><span>Description</span><textarea id="vx161142-desc" rows="5">'+esc(t&&t.description||'')+'</textarea></label></div>'+
   '<div id="vx161142-error" class="vx161142-error" hidden></div><footer><button type="button" class="ghost" data-close>Cancel</button><button type="submit" class="primary">'+(t?'Save Changes':'Create Task')+'</button></footer></form></section>';
  var pr=document.getElementById('vx161142-pr');if(pr)pr.value=t&&t.priority||'normal';var st=document.getElementById('vx161142-status');if(st)st.value=t&&t.status||'open';
  m.querySelectorAll('[data-close]').forEach(function(b){b.onclick=close;});m.onclick=function(e){if(e.target===m)close();};m.querySelector('form').onsubmit=save;
  setTimeout(function(){var x=document.getElementById('vx161142-tt');if(x)x.focus();},0);
 }catch(e){m.innerHTML='<div class="vx161142-modal vx161142-loading">Unable to load task controls.<br><small>'+esc(e.message||e)+'</small><br><button data-close>Close</button></div>';m.querySelector('[data-close]').onclick=close;}
}
async function save(e){e.preventDefault();var q=function(id){return document.getElementById(id)},btn=e.currentTarget.querySelector('[type=submit]'),err=q('vx161142-error');var title=(q('vx161142-tt').value||'').trim();if(!title){q('vx161142-tt').focus();return;}var due=q('vx161142-due').value,staff=Array.from(q('vx161142-staff').selectedOptions).map(function(o){return o.value}).filter(Boolean);var body={organization_slug:org(),action:editing?'update_task':'create_task',task_id:editing&&editing.id||undefined,title:title,description:(q('vx161142-desc').value||'').trim()||null,priority:q('vx161142-pr').value||'normal',due_at:due?new Date(due).toISOString():null,category:(q('vx161142-cat').value||'Operations').trim(),model_id:q('vx161142-model').value||null,member_ids:staff};if(editing&&q('vx161142-status'))body.status=q('vx161142-status').value;
 btn.disabled=true;btn.textContent=editing?'SAVING…':'CREATING…';err.hidden=true;
 try{var r=await api('/api/agent/tasks/v11',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});if(!r||r.verified!==true)throw new Error('Task save was not verified.');cache=null;close();try{if(window.VEUX_AGENT_V4.clearApiCache)VEUX_AGENT_V4.clearApiCache();}catch(_e){}toast(editing?'Task updated':'Task created');var root=document.getElementById('p-tasksconsolidated')||document.getElementById('p-tasks');if(window.VEUX_V148)window.VEUX_V148.task=null;if(window.renderTasksConsolidated&&root)await window.renderTasksConsolidated(root);}catch(ex){err.textContent=ex.message||String(ex);err.hidden=false;btn.disabled=false;btn.textContent=editing?'Save Changes':'Create Task';}}
function selectedId(root){var r=root&&root.querySelector('.v148-main .v148-row.on');if(!r)return null;var oc=r.getAttribute('onclick')||'';return (oc.match(/taskSelect\(['\"]([^'\"]+)/)||[])[1]||null;}
function inject(){var root=document.getElementById('p-tasksconsolidated')||document.getElementById('p-tasks');if(!root)return;var add=root.querySelector('.v148-filterbar .v148-btn.gold');if(add){add.onclick=function(e){e.preventDefault();e.stopPropagation();open(null);};add.setAttribute('onclick','CAVYRE_TASK_CRUD_161142.open()');}
 var rail=root.querySelector('.v148-task-detail .v148-actions-rail');if(rail&&!rail.querySelector('.vx161142-edit')){var b=document.createElement('button');b.className='v148-btn vx161142-edit';b.textContent='Edit Task';b.onclick=function(){var id=selectedId(root);if(id)open(id);};rail.insertBefore(b,rail.firstChild);}
 root.querySelectorAll('.v148-main .v148-row').forEach(function(r){if(r.dataset.vxTaskEdit==='1')return;r.dataset.vxTaskEdit='1';r.addEventListener('dblclick',function(ev){ev.preventDefault();var oc=r.getAttribute('onclick')||'',id=(oc.match(/taskSelect\(['\"]([^'\"]+)/)||[])[1];if(id)open(id);});});
}
function patchLegacy(){if(window.VEUX_V136){VEUX_V136.newTask=function(){open(null);};VEUX_V136.editTask=function(id){open(id);};}}
window.CAVYRE_TASK_CRUD_161142={open:open,close:close,refresh:function(){cache=null;inject();}};
var queued=false;function tick(){if(queued)return;queued=true;requestAnimationFrame(function(){queued=false;patchLegacy();inject();});}
document.readyState==='loading'?document.addEventListener('DOMContentLoaded',tick,{once:true}):tick();new MutationObserver(tick).observe(document.documentElement,{childList:true,subtree:true});
})();

;/* END cavyre-task-crud-authority-16.11.42.js */

;/* BEGIN cavyre-smart-relationships-16.11.45.js */
(function(){'use strict';
var S={view:'desk',data:null,intel:null,search:'',selected:null};
function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function bridge(){return window.VEUX_AGENT_V4||null}function org(){var b=bridge(),s=b&&b.state||{};return s.org&&s.org.slug||'maison-de-veux'}
async function api(path,opt){var b=bridge();if(!b||!b.api)throw new Error('Secure CAVYRE bridge is not ready.');return b.api(path,opt||{method:'GET',headers:{}})}
async function post(path,body){return api(path,{method:'POST',body:JSON.stringify(Object.assign({organization_slug:org()},body||{}))})}
function toast(t){var x=document.createElement('div');x.className='vxrel-toast';x.textContent=t;document.body.appendChild(x);setTimeout(function(){x.remove()},2600)}
function companies(){return S.data&&S.data.companies||[]}function contacts(){return S.data&&S.data.contacts||[]}function links(){return S.data&&S.data.contact_links||[]}
function ci(id){return (S.intel&&S.intel.company_insights||[]).find(x=>x.company_id===id)||{score:0,band:'New',last_activity_days:null,contact_count:0,booking_count:0,package_count:0,next_action:'Build relationship'} }
function cti(id){return (S.intel&&S.intel.contact_insights||[]).find(x=>x.contact_id===id)||{score:0,band:'New',last_activity_days:null,linked_company_count:0,next_action:'Build relationship'} }
function companyName(id){var c=companies().find(x=>x.id===id);return c?c.name:'Independent'}
async function load(){var r=await Promise.all([api('/api/agent/crm/v9?organization='+encodeURIComponent(org())),api('/api/agent/crm/intelligence/v2?organization='+encodeURIComponent(org())).catch(()=>null)]);S.data=r[0]||{};S.intel=r[1]||{};return S.data}
function veraLogo(){return '<span class="vxvera-logo"><img src="/assets/vera/vera-mark.svg" alt=""></span>'}
function shell(content){var sum=S.intel&&S.intel.summary||{};return '<div class="vxrel"><header class="vxrel-head"><div><div class="vxrel-eye">CAVYRE · Relationship Intelligence</div><h1>Relationships</h1><div class="vxrel-sub">Companies, contacts, agencies, clients and projects — one connected relationship graph.</div></div><div class="vxrel-actions"><button class="vxrel-btn" onclick="CavyreRelationships.openCompany()">+ Company</button><button class="vxrel-btn fill" onclick="CavyreRelationships.openContact()">+ Contact</button></div></header><nav class="vxrel-tabs">'+[['desk','Relationship Desk'],['companies','Companies'],['contacts','Contacts'],['agencies','Agencies'],['projects','Projects']].map(x=>'<button class="'+(S.view===x[0]?'on':'')+'" onclick="CavyreRelationships.go(\''+x[0]+'\')">'+x[1]+'</button>').join('')+'</nav><div class="vxrel-layout"><main class="vxrel-main">'+content+'</main><aside class="vxrel-vera"><div class="vxvera-title">'+veraLogo()+' Vera Intelligence</div><p class="vxvera-copy">Search the relationship network, research public work, discover connections and keep every contact attached to one canonical record.</p><div class="vxvera-search"><input id="vxvera-q" placeholder="Ask Vera about a contact, company or project…"><button onclick="CavyreRelationships.veraAsk()">→</button></div><div class="vxvera-card"><small>Relationship Watch</small><b>'+(sum.needs_follow_up||0)+' follow-ups</b><p>Vera is watching relationship recency, package activity, bookings and contact coverage.</p></div><div class="vxvera-card"><small>Connected Records</small><b>'+(contacts().length||0)+' contacts · '+(companies().length||0)+' companies</b><p>Contacts can connect to multiple agencies, clients and project relationships without duplicate profiles.</p></div><div class="vxvera-card"><small>Web Research</small><b>Research + Review</b><p>Open targeted public searches for recent work, Instagram and credits. Add findings only after agent review.</p></div></aside></div></div>'}
function toolbar(ph){return '<div class="vxrel-toolbar"><input class="vxrel-search" value="'+esc(S.search)+'" oninput="CavyreRelationships.search(this.value)" placeholder="'+ph+'"><button class="vxrel-btn purple" onclick="CavyreRelationships.veraAsk()">'+veraLogo()+' Ask Vera</button></div>'}
function desk(){var sum=S.intel&&S.intel.summary||{},top=companies().slice().sort((a,b)=>ci(b.id).score-ci(a.id).score).slice(0,6),recent=S.data&&S.data.recent_activity||[];return '<div class="vxrel-kpis"><div class="vxrel-kpi"><small>Relationships</small><b>'+companies().length+'</b></div><div class="vxrel-kpi"><small>Contacts</small><b>'+contacts().length+'</b></div><div class="vxrel-kpi"><small>Priority</small><b>'+(sum.priority_relationships||0)+'</b></div><div class="vxrel-kpi"><small>Needs Follow-Up</small><b>'+(sum.needs_follow_up||0)+'</b></div></div><div class="vxrel-grid"><section class="vxrel-card"><h3>Priority Relationships</h3>'+top.map(c=>'<div class="vxrel-listitem" onclick="CavyreRelationships.companyDetail(\''+c.id+'\')" style="cursor:pointer"><b>'+esc(c.name)+'</b><span>'+ci(c.id).score+' · '+esc(ci(c.id).band)+'</span></div>').join('')+'</section><section class="vxrel-card"><h3>Recent Relationship Activity</h3>'+(recent.slice(0,8).map(a=>'<div class="vxrel-listitem"><b>'+esc(a.subject||a.activity_type||'Activity')+'</b><span>'+esc(a.companies&&a.companies.name||a.contacts&&a.contacts.display_name||'CRM')+'</span></div>').join('')||'<div class="vxrel-empty">No activity yet.</div>')+'</section></div>'}
function companyRows(list){return '<div class="vxrel-table"><div class="vxrel-row head"><span>Company</span><span>Type</span><span>Score</span><span>Contacts</span><span>Last Contact</span></div>'+list.map(c=>{var i=ci(c.id);return '<div class="vxrel-row" onclick="CavyreRelationships.companyDetail(\''+c.id+'\')"><div class="vxrel-name"><b>'+esc(c.name)+'</b><small>'+esc(c.website||c.email||'')+'</small></div><span>'+esc((c.company_type||'other').replaceAll('_',' '))+'</span><b class="vxscore">'+i.score+'</b><span>'+i.contact_count+'</span><span>'+(i.last_activity_days==null?'—':i.last_activity_days+'d ago')+'</span></div>'}).join('')+'</div>'}
function companiesView(agencyOnly){var q=S.search.toLowerCase(),list=companies().filter(c=>(!agencyOnly||/agency|management|artist|talent/.test(String(c.company_type||'')+' '+c.name.toLowerCase()))&&(!q||JSON.stringify(c).toLowerCase().includes(q)));return toolbar(agencyOnly?'Search agencies…':'Search companies, brands, casting offices…')+companyRows(list)}
function contactsView(){var q=S.search.toLowerCase(),list=contacts().filter(c=>!q||JSON.stringify(c).toLowerCase().includes(q));return toolbar('Search contacts by name, role, company, market…')+'<div class="vxrel-table"><div class="vxrel-row head"><span>Contact</span><span>Role / Company</span><span>Score</span><span>Connections</span><span>Last Contact</span></div>'+list.map(c=>{var i=cti(c.id),cl=(c.company_links||[]).map(l=>l.company&&l.company.name).filter(Boolean);return '<div class="vxrel-row" onclick="CavyreRelationships.contactDetail(\''+c.id+'\')"><div class="vxrel-name"><b>'+esc(c.display_name)+'</b><small>'+esc(c.email||c.instagram||'')+'</small></div><span>'+esc(c.role||'Contact')+' · '+esc(cl[0]||companyName(c.company_id))+'</span><b class="vxscore">'+i.score+'</b><span>'+Math.max(i.linked_company_count||0,cl.length)+'</span><span>'+(i.last_activity_days==null?'—':i.last_activity_days+'d ago')+'</span></div>'}).join('')+'</div>'}
function projectsView(){var acts=S.data&&S.data.recent_activity||[],items=acts.filter(a=>['booking','casting','package','option'].includes(a.activity_type)).slice(0,80);return toolbar('Search project activity…')+'<div class="vxrel-card"><h3>Connected Project Activity</h3>'+(items.length?items.map(a=>'<div class="vxrel-project"><b>'+esc(a.subject||a.activity_type)+'</b><span>'+esc(a.companies&&a.companies.name||'Client')+'</span><span>'+esc(a.contacts&&a.contacts.display_name||'—')+'</span><span>'+esc(a.activity_type)+'</span></div>').join(''):'<div class="vxrel-empty">Bookings, castings, packages and options connected to CRM relationships will appear here.</div>')+'</div>'}
function render(){var el=document.getElementById('p-industrydirectory');if(!el)return;var content=S.view==='desk'?desk():S.view==='companies'?companiesView(false):S.view==='contacts'?contactsView():S.view==='agencies'?companiesView(true):projectsView();el.innerHTML=shell(content)}
function closeModal(){if(window.CavyreCRM&&CavyreCRM.close)CavyreCRM.close()}
function openCompany(id){if(!window.CavyreCRM)throw new Error('CAVYRE CRM authority is not ready');return CavyreCRM.openCompany(id)}
function openContact(id){if(!window.CavyreCRM)throw new Error('CAVYRE CRM authority is not ready');return CavyreCRM.openContact(id)}
function research(name,extra){var q=[name,extra,'recent work Instagram campaign fashion'].filter(Boolean).join(' ');window.open('https://www.google.com/search?q='+encodeURIComponent(q),'_blank','noopener');}
function companyDetail(id){var c=companies().find(x=>x.id===id);if(!c)return;var i=ci(id),cs=contacts().filter(x=>(x.company_links||[]).some(l=>l.company_id===id)||x.company_id===id);var html='<div class="vxrel-detailtop"><div><div class="vxrel-eye">Company 360</div><h2>'+esc(c.name)+'</h2><p>'+esc(c.company_type||'Company')+' · '+esc(c.status||'active')+' · Relationship '+i.score+'</p><div class="vxrel-links">'+cs.slice(0,8).map(x=>'<span class="vxrel-link">'+esc(x.display_name)+'</span>').join('')+'</div></div><div class="vxrel-actions"><button class="vxrel-btn purple" onclick="CavyreRelationships.research(\''+esc(c.name).replace(/'/g,"\\'")+'\')">'+veraLogo()+' Research Web</button><button class="vxrel-btn" onclick="CavyreRelationships.openCompany(\''+id+'\')">Edit</button></div></div><div class="vxrel-grid"><div class="vxrel-card"><h3>Connected Contacts</h3>'+cs.map(x=>'<div class="vxrel-listitem" onclick="CavyreRelationships.contactDetail(\''+x.id+'\')"><b>'+esc(x.display_name)+'</b><span>'+esc(x.role||'Contact')+'</span></div>').join('')+'</div><div class="vxrel-card"><h3>Vera Relationship Read</h3><div class="vxrel-listitem"><b>Score</b><span>'+i.score+' · '+esc(i.band)+'</span></div><div class="vxrel-listitem"><b>Bookings</b><span>'+i.booking_count+'</span></div><div class="vxrel-listitem"><b>Packages</b><span>'+i.package_count+'</span></div><div class="vxrel-listitem"><b>Next Action</b><span>'+esc(i.next_action)+'</span></div></div></div>';document.getElementById('p-industrydirectory').innerHTML=shell(html)}
function contactDetail(id){var c=contacts().find(x=>x.id===id);if(!c)return;var i=cti(id),cl=(c.company_links||[]).map(l=>l.company).filter(Boolean);var intel=c.metadata&&c.metadata.industry_intelligence;var html='<div class="vxrel-detailtop"><div><div class="vxrel-eye">Contact 360 · Canonical Record</div><h2>'+esc(c.display_name)+'</h2><p>'+esc(c.role||'Professional Contact')+' · '+esc(c.market||'Global')+' · Relationship '+i.score+'</p><div class="vxrel-links">'+cl.map(x=>'<span class="vxrel-link">'+esc(x.name)+'</span>').join('')+'</div></div><div class="vxrel-actions"><button class="vxrel-btn purple" onclick="CavyreRelationships.research(\''+esc(c.display_name).replace(/'/g,"\\'")+'\',\''+esc(c.role||'').replace(/'/g,"\\'")+'\')">'+veraLogo()+' Find Recent Work</button><button class="vxrel-btn" onclick="CavyreRelationships.openContact(\''+id+'\')">Edit</button></div></div><div class="vxrel-grid"><div class="vxrel-card"><h3>Connected Relationships</h3>'+((cl.length?cl.map(x=>'<div class="vxrel-listitem"><b>'+esc(x.name)+'</b><span>'+esc(x.company_type||'Company')+'</span></div>').join(''):'<div class="vxrel-empty">No company links yet.</div>'))+'</div><div class="vxrel-card"><h3>Vera Intelligence</h3><div class="vxrel-listitem"><b>Score</b><span>'+i.score+' · '+esc(i.band)+'</span></div><div class="vxrel-listitem"><b>Next Action</b><span>'+esc(i.next_action)+'</span></div>'+(intel?'<div class="vxrel-listitem"><b>Web Confidence</b><span>'+esc(intel.confidence||0)+'%</span></div><div class="vxrel-listitem"><b>Recent Summary</b><span>'+esc(intel.summary||'—')+'</span></div>':'<div class="vxrel-empty">No approved web intelligence yet. Use Find Recent Work, review sources, then add verified findings to this record.</div>')+'</div></div>';document.getElementById('p-industrydirectory').innerHTML=shell(html)}
function veraAsk(){var q=(document.getElementById('vxvera-q')||{}).value||S.search;if(!q){toast('Type a person, company, project or question for Vera');return}var low=q.toLowerCase(),found=contacts().find(x=>low.includes(String(x.display_name||'').toLowerCase()))||companies().find(x=>low.includes(String(x.name||'').toLowerCase()));if(found){if(found.display_name)return contactDetail(found.id);return companyDetail(found.id)}research(q)}
async function init(){var el=document.getElementById('p-industrydirectory');if(!el){var pm=document.getElementById('pm');if(!pm)return;el=document.createElement('div');el.id='p-industrydirectory';el.className='panel';pm.appendChild(el)}try{await load();render()}catch(e){console.error('[CAVYRE Relationships]',e);el.innerHTML='<div class="vxrel-empty">Relationship Intelligence could not load. '+esc(e.message)+'</div>'}}
window.CavyreRelationships={go:function(v){S.view=v;S.search='';render()},search:function(v){S.search=v;render()},openCompany,openContact,closeModal,companyDetail,contactDetail,research,veraAsk,refresh:async function(){await load();render()}};
window.addEventListener('veux:page-rendered',function(e){var p=e&&e.detail&&e.detail.page||window._currentPage;if(p==='industrydirectory')setTimeout(init,0)});setTimeout(function(){if(window._currentPage==='industrydirectory')init()},1200);
})();

;/* END cavyre-smart-relationships-16.11.45.js */
