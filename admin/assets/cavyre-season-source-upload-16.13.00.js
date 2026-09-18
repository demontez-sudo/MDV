(function(){
'use strict';
if(window.__CAVYRE_SEASON_SOURCE_UPLOAD_161299__)return;
window.__CAVYRE_SEASON_SOURCE_UPLOAD_161299__=1;

var S={docs:[],loading:false};
function bridge(){if(!window.VEUX_AGENT_V4||!window.VEUX_AGENT_V4.api)throw new Error('VEUX secure bridge is not ready');return window.VEUX_AGENT_V4;}
function api(path,opts){return bridge().api(path,opts||{method:'GET',headers:{}});}
function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
function org(){var s=bridge().state||{};return s.org||{};}
function close(){var m=document.getElementById('vx-season-source-modal');if(m)m.remove();}
function composeLabel(){
 var market=(document.getElementById('vxss-market')||{}).value||'';
 var category=(document.getElementById('vxss-category')||{}).value||'';
 var season=(document.getElementById('vxss-season')||{}).value||'';
 var year=(document.getElementById('vxss-year')||{}).value||'';
 var custom=(document.getElementById('vxss-label')||{});
 if(custom && !custom.dataset.touched){custom.value=[market,category,season+(year?' '+year:'')].filter(Boolean).join(' · ')+' · OFFICIAL FASHION WEEK DATES';}
}
function markTouched(){var x=document.getElementById('vxss-label');if(x)x.dataset.touched='1';}
function modal(){
 close();
 var wrap=document.createElement('div');wrap.id='vx-season-source-modal';wrap.className='vxss-modal';
 wrap.innerHTML='<div class="vxss-backdrop" data-vxss-close></div><section class="vxss-card" role="dialog" aria-modal="true"><header><div><small>SEASON · SOURCE AUTHORITY</small><h2>Upload Official Fashion Week Dates</h2><p>Attach the exact PDF used by the agency and label it so every agent knows the market, category and season it controls.</p></div><button type="button" data-vxss-close>×</button></header><div class="vxss-grid">'
 +'<label><span>Market</span><select id="vxss-market"><option>Paris</option><option>New York</option><option>London</option><option>Milan</option><option>Other</option></select></label>'
 +'<label><span>Calendar / Category</span><select id="vxss-category"><option>Women</option><option>Men</option><option>Haute Couture</option><option>Bridal</option><option>Resort</option><option>Pre-Fall</option><option>Other</option></select></label>'
 +'<label><span>Season</span><select id="vxss-season"><option>Spring / Summer</option><option>Fall / Winter</option><option>Haute Couture</option><option>Resort</option><option>Pre-Fall</option><option>Other</option></select></label>'
 +'<label><span>Year</span><input id="vxss-year" inputmode="numeric" maxlength="4" value="'+new Date().getFullYear()+'"></label>'
 +'<label class="wide"><span>Official Label</span><input id="vxss-label" value="Paris · Women · Spring / Summer '+new Date().getFullYear()+' · OFFICIAL FASHION WEEK DATES"><small>This is the title agents will see inside Season.</small></label>'
 +'<label><span>Issuing Body / Source</span><input id="vxss-issuer" placeholder="FHCM, CFDA, BFC, CNMI…"></label>'
 +'<label><span>Source Status</span><select id="vxss-status"><option value="official">Official</option><option value="agency_verified">Agency Verified</option><option value="working">Working / Draft</option></select></label>'
 +'<label><span>Start Date</span><input id="vxss-start" type="date"></label><label><span>End Date</span><input id="vxss-end" type="date"></label>'
 +'<label class="wide file"><span>Fashion Week Dates PDF</span><input id="vxss-file" type="file" accept="application/pdf,.pdf"><strong id="vxss-file-name">Choose PDF</strong><small>PDF only · exact source schedule or official dates document.</small></label>'
 +'<label class="wide"><span>Agent Note</span><textarea id="vxss-note" rows="3" placeholder="Optional note about this schedule, revision or market dates."></textarea></label>'
 +'</div><div id="vxss-error" class="vxss-error" hidden></div><footer><button type="button" data-vxss-close>Cancel</button><button type="button" class="primary" id="vxss-upload">Upload & Label PDF</button></footer></section>';
 document.body.appendChild(wrap);
 wrap.querySelectorAll('[data-vxss-close]').forEach(function(b){b.addEventListener('click',close);});
 ['vxss-market','vxss-category','vxss-season','vxss-year'].forEach(function(id){var x=document.getElementById(id);if(x)x.addEventListener('change',composeLabel);if(x)x.addEventListener('input',composeLabel);});
 var lab=document.getElementById('vxss-label');if(lab)lab.addEventListener('input',markTouched);
 var fi=document.getElementById('vxss-file');if(fi)fi.addEventListener('change',function(){var f=fi.files&&fi.files[0];document.getElementById('vxss-file-name').textContent=f?f.name:'Choose PDF';});
 document.getElementById('vxss-upload').addEventListener('click',upload);
}
async function upload(){
 var err=document.getElementById('vxss-error'),btn=document.getElementById('vxss-upload');
 err.hidden=true;err.textContent='';
 try{
  var f=(document.getElementById('vxss-file').files||[])[0];
  if(!f)throw new Error('Choose the official Fashion Week dates PDF.');
  if(!(f.type==='application/pdf'||/\.pdf$/i.test(f.name)))throw new Error('Season source files must be PDF documents.');
  var label=(document.getElementById('vxss-label').value||'').trim();if(!label)throw new Error('Add an official label for this Fashion Week source.');
  var start=(document.getElementById('vxss-start').value||'').trim();
  var end=(document.getElementById('vxss-end').value||'').trim();
  if(!start||!end)throw new Error('Add the exact Fashion Week start and end dates so Season can display the official dates.');
  if(new Date(start+'T12:00:00')>new Date(end+'T12:00:00'))throw new Error('The Fashion Week end date must be on or after the start date.');
  var o=org();if(!o.id)throw new Error('Agency organization is not loaded.');
  var metadata={
   season_source:true,
   source_kind:'fashion_week_dates',
   label:label,
   market:document.getElementById('vxss-market').value,
   category:document.getElementById('vxss-category').value,
   season:document.getElementById('vxss-season').value,
   year:document.getElementById('vxss-year').value||null,
   issuer:document.getElementById('vxss-issuer').value||null,
   source_status:document.getElementById('vxss-status').value,
   starts_on:start,
   ends_on:end,
   agent_note:document.getElementById('vxss-note').value||null,
   uploaded_from:'season'
  };
  var safeName=label.replace(/[\\/:*?"<>|]+/g,'-').replace(/\s+/g,' ').trim()+'.pdf';
  btn.disabled=true;btn.textContent='Preparing secure upload…';
  var prep=await api('/api/storage/upload-url',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({organization_id:o.id,name:safeName,mime_type:'application/pdf',size_bytes:f.size,category:'season-fashion-week',visibility:'staff'})});
  if(!prep||!prep.signed_url)throw new Error('Secure upload URL was not created.');
  btn.textContent='Uploading PDF…';
  var put=await fetch(prep.signed_url,{method:'PUT',headers:{'Content-Type':'application/pdf'},body:f});
  if(!put.ok)throw new Error('The PDF upload failed ('+put.status+').');
  btn.textContent='Saving source label…';
  var done=await api('/api/storage/finalize',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({upload_session_id:prep.upload_session_id,relationship:'season_schedule_source',metadata:metadata})});
  if(!done||!done.document)throw new Error('The uploaded PDF could not be finalized.');
  close();
  try{if(window.VEUX_AGENT_V4&&VEUX_AGENT_V4.clearApiCache)VEUX_AGENT_V4.clearApiCache();}catch(_e){}
  await loadSources(true);
  if(window.toast)window.toast('✓ Fashion Week PDF added to Season');
 }catch(e){err.textContent=e.message||String(e);err.hidden=false;btn.disabled=false;btn.textContent='Upload & Label PDF';}
}
function sourceMeta(d){var m=d&&d.metadata&&typeof d.metadata==='object'?d.metadata:{};return m;}
async function loadSources(force){
 if(S.loading)return;S.loading=true;
 try{
  var out=await api('/api/agent/files-forms'+(force?'?t='+Date.now():''),{method:'GET',headers:{}});
  S.docs=(out&&out.documents||[]).filter(function(d){var m=sourceMeta(d);return m.season_source===true||m.source_kind==='fashion_week_dates'||String(d.category||'').toLowerCase()==='season-fashion-week';});
  renderPanel();
 }catch(_e){}finally{S.loading=false;}
}
function fmt(v){if(!v)return '—';try{return new Date(v+'T12:00:00').toLocaleDateString([],{month:'short',day:'numeric',year:'numeric'});}catch(_e){return v;}}
function isoDay(v){try{var d=new Date(v+'T12:00:00');return isNaN(d)?null:d;}catch(_e){return null;}}
function rangeDays(a,b){var s=isoDay(a),e=isoDay(b),out=[];if(!s||!e||s>e)return out;var guard=0;for(var d=new Date(s);d<=e&&guard<31;d.setDate(d.getDate()+1),guard++){out.push(new Date(d));}return out;}
function dayKey(d){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
function officialDateRows(){var rows=[];S.docs.forEach(function(doc){var m=sourceMeta(doc),days=rangeDays(m.starts_on,m.ends_on);days.forEach(function(d,i){rows.push({date:dayKey(d),day:d,index:i+1,total:days.length,market:m.market||'',category:m.category||'',season:m.season||'',year:m.year||'',label:m.label||doc.name||'Fashion Week Dates',issuer:m.issuer||'',status:m.source_status||'official',document:doc});});});return rows.sort(function(a,b){return a.date.localeCompare(b.date);});}
function renderOfficialDates(){
 var root=document.getElementById('p-seasonmanagement')||document.getElementById('p-season');if(!root)return;
 var existing=root.querySelector('.vxss-official-dates');if(existing)existing.remove();
 var sources=root.querySelector('.vxss-sources');if(!sources)return;
 var panel=document.createElement('section');panel.className='vxss-official-dates';
 var docs=S.docs.slice().filter(function(d){var m=sourceMeta(d);return m.starts_on&&m.ends_on;}).sort(function(a,b){return String(sourceMeta(a).starts_on||'').localeCompare(String(sourceMeta(b).starts_on||''));});
 panel.innerHTML='<header><div><small>SEASON · DATE AUTHORITY</small><h3>Official Fashion Week Dates</h3><p>Exact market dates attached to the agency-approved Fashion Week source PDF.</p></div><span class="vxss-live-badge">LIVE FROM SOURCE PDF</span></header>'
 +(docs.length?'<div class="vxss-week-groups">'+docs.map(function(doc){var m=sourceMeta(doc),days=rangeDays(m.starts_on,m.ends_on),market=[m.market,m.category].filter(Boolean).join(' · '),season=[m.season,m.year].filter(Boolean).join(' ');return '<article class="vxss-week"><div class="vxss-week-head"><div><small>'+esc((m.source_status||'official').replace(/_/g,' ').toUpperCase())+' · '+esc(market)+'</small><h4>'+esc(m.label||'Official Fashion Week Dates')+'</h4><p>'+esc(fmt(m.starts_on)+' – '+fmt(m.ends_on))+(m.issuer?' · '+esc(m.issuer):'')+'</p></div><div class="vxss-week-actions"><b>'+days.length+' DAYS</b>'+(doc.url?'<a href="'+esc(doc.url)+'" target="_blank" rel="noopener">SOURCE PDF ↗</a>':'')+'</div></div><div class="vxss-date-grid">'+days.map(function(d,i){return '<div class="vxss-date-card" data-fashion-week-date="'+dayKey(d)+'"><span>'+esc(d.toLocaleDateString([],{weekday:'short'}).toUpperCase())+'</span><strong>'+esc(d.toLocaleDateString([],{month:'short',day:'numeric'}))+'</strong><em>FASHION WEEK · OFFICIAL</em><small>'+esc(market)+(season?' · '+esc(season):'')+'</small><i>DAY '+(i+1)+' / '+days.length+'</i></div>';}).join('')+'</div></article>';}).join('')+'</div>':'<div class="vxss-empty">Upload a Fashion Week PDF and enter its exact start and end dates. Those dates will appear here automatically.</div>');
 sources.insertAdjacentElement('afterend',panel);
 window.CAVYRE_SEASON_OFFICIAL_DATES={release:'16.13.00',rows:officialDateRows(),refresh:renderOfficialDates};
}
function renderPanel(){
 var root=document.getElementById('p-seasonmanagement')||document.getElementById('p-season');if(!root)return;
 var existing=root.querySelector('.vxss-sources');if(existing)existing.remove();
 var anchor=root.querySelector('.ss48-top')||root.firstElementChild;if(!anchor)return;
 var panel=document.createElement('section');panel.className='vxss-sources';
 var docs=S.docs.slice().sort(function(a,b){return String(b.created_at||'').localeCompare(String(a.created_at||''));});
 panel.innerHTML='<header><div><small>OFFICIAL DATE SOURCES</small><h3>Fashion Week PDFs</h3><p>Agency-controlled source documents for exact market dates.</p></div><button type="button" data-vxss-open>+ ADD FASHION WEEK PDF</button></header>'
 +(docs.length?'<div class="vxss-source-list">'+docs.slice(0,6).map(function(d){var m=sourceMeta(d),title=m.label||d.name||'Fashion Week Dates',dates=(m.starts_on||m.ends_on)?fmt(m.starts_on)+' – '+fmt(m.ends_on):'Dates not tagged';return '<article><div class="vxss-pdf">PDF</div><div><b>'+esc(title)+'</b><span>'+esc([m.market,m.category,m.season,m.year].filter(Boolean).join(' · '))+'</span><small>'+esc((m.issuer?m.issuer+' · ':'')+dates)+'</small></div><em>'+esc((m.source_status||'official').replace(/_/g,' ').toUpperCase())+'</em>'+(d.url?'<a href="'+esc(d.url)+'" target="_blank" rel="noopener">OPEN ↗</a>':'')+'</article>';}).join('')+'</div>':'<div class="vxss-empty">No official Fashion Week PDF has been attached to this Season yet.</div>');
 anchor.insertAdjacentElement('afterend',panel);
 panel.querySelector('[data-vxss-open]').addEventListener('click',modal);
 renderOfficialDates();
}
function install(){
 var root=document.getElementById('p-seasonmanagement')||document.getElementById('p-season');if(!root)return;
 var top=root.querySelector('.ss48-top');
 if(top&&!top.querySelector('.vxss-top-upload')){
  var b=document.createElement('button');b.type='button';b.className='vxss-top-upload';b.textContent='UPLOAD FASHION WEEK PDF';b.addEventListener('click',modal);top.appendChild(b);
 }
 if(!S.docs.length)loadSources(false);else renderPanel();
}
window.CAVYRE_SEASON_SOURCE_UPLOAD_161300={open:modal,refresh:function(){return loadSources(true);},state:S,release:'16.13.00'};
window.CAVYRE_SEASON_SOURCE_UPLOAD_161299=window.CAVYRE_SEASON_SOURCE_UPLOAD_161300;
var queued=false;function tick(){if(queued)return;queued=true;requestAnimationFrame(function(){queued=false;install();});}
document.readyState==='loading'?document.addEventListener('DOMContentLoaded',tick,{once:true}):tick();
new MutationObserver(function(ms){for(var i=0;i<ms.length;i++){if(ms[i].addedNodes&&ms[i].addedNodes.length){tick();break;}}}).observe(document.documentElement,{childList:true,subtree:true});
})();
