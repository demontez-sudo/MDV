
/* CAVYRE 16.12.38 — Package Response Detail Authority */
(function(){
'use strict';
if(window.__CAVYRE_PACKAGE_RESPONSE_DETAIL_161238__)return;
window.__CAVYRE_PACKAGE_RESPONSE_DETAIL_161238__=1;

var STATE={data:null,root:null};

function bridge(){
  if(!window.VEUX_AGENT_V4||!VEUX_AGENT_V4.api)throw new Error('CAVYRE secure bridge is not ready');
  return VEUX_AGENT_V4;
}
function org(){var s=bridge().state||{};return s.org&&s.org.slug||'maison-de-veux';}
function get(path){return bridge().api(path,{method:'GET',headers:{},__fresh:true});}
function A(v){return Array.isArray(v)?v:[];}
function E(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]});}
function D(v){if(!v)return'—';try{return new Date(v).toLocaleDateString([],{month:'short',day:'numeric',year:'numeric'});}catch(e){return String(v);}}
function DT(v){if(!v)return'—';try{return new Date(v).toLocaleString([],{month:'short',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit'});}catch(e){return String(v);}}
function label(v){v=String(v||'').toLowerCase();return v==='request_availability'?'Availability Request':v==='shortlist'?'Shortlist':v==='interested'?'Interested':v==='pass'?'Pass':v.replace(/_/g,' ').replace(/\b\w/g,function(m){return m.toUpperCase();});}
function tone(v){v=String(v||'').toLowerCase();return/shortlist|interested/.test(v)?'positive':/availability/.test(v)?'availability':/pass|decline/.test(v)?'pass':'neutral';}
function search(x){return[x.package_title,x.recipient_name,x.recipient_email,x.company_name,x.model_name,x.feedback_type,x.note].filter(Boolean).join(' ').toLowerCase();}
function metric(l,v,s){return'<div class="cvypr-stat"><small>'+E(l)+'</small><strong>'+E(v)+'</strong><span>'+E(s||'')+'</span></div>';}

function css(){
  if(document.getElementById('cvy-package-response-detail-161238-css'))return;
  var s=document.createElement('style');
  s.id='cvy-package-response-detail-161238-css';
  s.textContent=`
  .cvypr-page{padding:26px 28px 80px}
  .cvypr-head{display:flex;justify-content:space-between;gap:18px;align-items:flex-end;margin-bottom:16px}
  .cvypr-head small,.cvypr-k{font:7px var(--fM);letter-spacing:.18em;color:var(--gold)}
  .cvypr-head h1{font:40px var(--fD);font-weight:400;margin:5px 0 0;color:var(--ink)}
  .cvypr-head p{margin:5px 0 0;color:var(--mute);font-size:10px}
  .cvypr-actions{display:flex;gap:8px;flex-wrap:wrap}
  .cvypr-actions button{border:1px solid var(--line2);background:#10100d;color:var(--ink);padding:10px 13px;font:7px var(--fM);letter-spacing:.1em;text-transform:uppercase;cursor:pointer}
  .cvypr-actions button.primary{border-color:var(--gold);color:var(--gold)}
  .cvypr-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}
  .cvypr-stat{border:1px solid var(--line);padding:14px;background:#11100d}
  .cvypr-stat small,.cvypr-stat strong,.cvypr-stat span{display:block}
  .cvypr-stat small{font:6px var(--fM);letter-spacing:.14em;color:var(--gold)}
  .cvypr-stat strong{font:27px var(--fD);font-weight:400;color:var(--ink);margin-top:4px}
  .cvypr-stat span{font:7px var(--fM);color:var(--mute);margin-top:4px}
  .cvypr-filters{display:grid;grid-template-columns:minmax(280px,1fr) 250px 190px;gap:8px;margin:14px 0;padding:9px;border:1px solid var(--line)}
  .cvypr-search{display:flex;gap:7px;align-items:center;border:1px solid var(--line2);padding:0 9px}
  .cvypr-search input{width:100%;border:0!important;background:transparent!important}
  .cvypr-grid{display:grid;grid-template-columns:minmax(0,1.55fr) minmax(300px,.8fr);gap:12px}
  .cvypr-card{border:1px solid var(--line);background:#11100d}
  .cvypr-card>header{padding:13px 14px;border-bottom:1px solid var(--line);display:flex;justify-content:space-between;align-items:flex-end}
  .cvypr-card header h2{font:23px var(--fD);font-weight:400;margin:3px 0 0;color:var(--ink)}
  .cvypr-table{max-height:720px;overflow:auto}
  .cvypr-row{display:grid;grid-template-columns:minmax(130px,1.1fr) minmax(115px,1fr) minmax(145px,1fr) 80px 62px;gap:10px;align-items:center;padding:11px 12px;border-bottom:1px solid #27221b}
  .cvypr-row[hidden]{display:none!important}.cvypr-row b,.cvypr-row small{display:block}
  .cvypr-row b{font:11px var(--fD);color:var(--ink)}
  .cvypr-row small{font:6px var(--fM);color:var(--mute);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .cvypr-row p{font:7px var(--fM);color:var(--ink2);margin:4px 0 0}
  .cvypr-row time{font:6px var(--fM);color:var(--mute)}
  .cvypr-row>button{border:0;background:0;color:var(--gold);font:7px var(--fM);cursor:pointer}
  .cvypr-signal{display:inline-block;padding:4px 6px;border:1px solid var(--line2);font:6px var(--fM);letter-spacing:.1em;text-transform:uppercase}
  .cvypr-signal.positive{color:#9bb37d;border-color:#65784e}.cvypr-signal.availability{color:#d3ad6d;border-color:#80673f}.cvypr-signal.pass{color:#bd746a;border-color:#6c3d37}
  .cvypr-side{display:grid;gap:12px;align-content:start}.cvypr-side-body{padding:12px 14px}
  .cvypr-leader{display:grid;grid-template-columns:28px minmax(0,1fr) auto;gap:9px;align-items:center;padding:10px 11px;border-bottom:1px solid #27221b}
  .cvypr-leader i{font:8px var(--fM);color:var(--gold)}.cvypr-leader b,.cvypr-leader small{display:block}
  .cvypr-leader b{font:12px var(--fD)}.cvypr-leader small{font:6px var(--fM);color:var(--mute);margin-top:2px}
  .cvypr-leader dl{display:grid;grid-template-columns:repeat(4,auto);gap:2px 5px;margin:0;text-align:center}.cvypr-leader dt{font:5px var(--fM);color:var(--mute)}.cvypr-leader dd{margin:0;font:8px var(--fM)}
  .cvypr-empty{padding:24px;text-align:center;color:var(--mute);font:8px var(--fM)}

  .cvypr-detail-top{display:grid;grid-template-columns:minmax(0,1.3fr) minmax(280px,.7fr);gap:12px;margin-top:14px}
  .cvypr-hero{border:1px solid var(--line);background:linear-gradient(145deg,#15130f,#0d0d0b);padding:24px}
  .cvypr-hero h2{font:35px var(--fD);font-weight:400;margin:6px 0 10px}
  .cvypr-hero-meta{display:flex;flex-wrap:wrap;gap:7px;margin:14px 0}.cvypr-chip{border:1px solid var(--line2);padding:5px 7px;font:6px var(--fM);letter-spacing:.1em;text-transform:uppercase;color:var(--ink2)}
  .cvypr-response{border-left:2px solid var(--gold);padding:14px 16px;background:rgba(190,145,67,.06);margin-top:18px}
  .cvypr-response strong{display:block;font:18px var(--fD);font-weight:400;margin:4px 0}.cvypr-response p{font:9px/1.6 var(--fM);color:var(--ink2);margin:7px 0 0}
  .cvypr-client{border:1px solid var(--line);background:#11100d;padding:18px}
  .cvypr-client dl{display:grid;grid-template-columns:100px 1fr;gap:10px 12px;margin:16px 0 0}.cvypr-client dt{font:6px var(--fM);letter-spacing:.1em;text-transform:uppercase;color:var(--gold)}.cvypr-client dd{margin:0;font:9px var(--fM);color:var(--ink2)}
  .cvypr-section{margin-top:12px;border:1px solid var(--line);background:#11100d}
  .cvypr-section>header{padding:13px 14px;border-bottom:1px solid var(--line);display:flex;justify-content:space-between;align-items:end}.cvypr-section h3{font:23px var(--fD);font-weight:400;margin:3px 0 0}
  .cvypr-models{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;padding:12px}
  .cvypr-model{border:1px solid #2a261f;background:#0d0d0b;min-width:0}.cvypr-model-img{aspect-ratio:4/5;background:#1b1915;overflow:hidden}.cvypr-model-img img{width:100%;height:100%;object-fit:cover;display:block}
  .cvypr-model-body{padding:10px}.cvypr-model b,.cvypr-model small{display:block}.cvypr-model b{font:14px var(--fD);font-weight:400}.cvypr-model small{font:6px var(--fM);color:var(--mute);margin-top:3px}
  .cvypr-model.selected{box-shadow:inset 0 0 0 1px var(--gold)}.cvypr-model.selected .cvypr-model-body:before{content:'CLIENT SELECTED';display:block;color:var(--gold);font:5px var(--fM);letter-spacing:.13em;margin-bottom:5px}
  .cvypr-history{padding:0 12px 12px}.cvypr-history-row{display:grid;grid-template-columns:110px minmax(0,1fr) 150px;gap:10px;padding:11px 3px;border-bottom:1px solid #27221b;align-items:center}.cvypr-history-row:last-child{border-bottom:0}
  .cvypr-history-row small{font:6px var(--fM);color:var(--mute)}.cvypr-history-row b{font:9px var(--fM)}.cvypr-history-row p{font:7px var(--fM);color:var(--ink2);margin:3px 0 0}
  .cvypr-back{border:0;background:transparent;color:var(--gold);font:7px var(--fM);letter-spacing:.1em;text-transform:uppercase;cursor:pointer;padding:0}
  @media(max-width:1050px){.cvypr-grid,.cvypr-detail-top{grid-template-columns:1fr}.cvypr-filters{grid-template-columns:1fr 1fr}.cvypr-search{grid-column:1/-1}.cvypr-models{grid-template-columns:repeat(3,minmax(0,1fr))}}
  @media(max-width:700px){.cvypr-page{padding:18px 13px 90px}.cvypr-head{display:block}.cvypr-actions{margin-top:10px}.cvypr-stats{grid-template-columns:1fr 1fr}.cvypr-filters{grid-template-columns:1fr}.cvypr-search{grid-column:auto}.cvypr-row{grid-template-columns:1fr auto}.cvypr-row>div:nth-child(3),.cvypr-row time{grid-column:1}.cvypr-row>button{grid-column:2;grid-row:1}.cvypr-models{grid-template-columns:1fr 1fr}.cvypr-history-row{grid-template-columns:1fr}.cvypr-leader dl{display:none}}
  `;
  document.head.appendChild(s);
}

async function render(el){
  css(); STATE.root=el;
  el.innerHTML='<div class="cvypr-page"><div class="cvypr-empty">Loading package response data…</div></div>';
  try{
    var d=await get('/api/agent/packages?organization='+encodeURIComponent(org())+'&response_data=1');
    STATE.data=d; paint(el,d);
  }catch(e){
    el.innerHTML='<div class="cvypr-page"><div class="cvypr-empty">'+E(e&&e.message||e)+'</div></div>';
  }
}

function paint(el,d){
  var R=A(d.recipients),F=A(d.feedback),X=A(d.activity),P=A(d.packages);
  var opened=R.filter(function(x){return x.opened_at||x.first_viewed_at||Number(x.view_count||0)>0});
  var shorts=F.filter(function(x){return x.feedback_type==='shortlist'});
  var resp=F.slice().sort(function(a,b){return new Date(b.created_at||0)-new Date(a.created_at||0)});
  var mm={};
  F.forEach(function(x){
    var k=x.model_id||'none',m=mm[k]||(mm[k]={name:x.model_name||'Model',interested:0,shortlist:0,availability:0,pass:0,total:0});
    m.total++; if(x.feedback_type==='interested')m.interested++; else if(x.feedback_type==='shortlist')m.shortlist++; else if(x.feedback_type==='request_availability')m.availability++; else if(x.feedback_type==='pass')m.pass++;
  });
  var leaders=Object.values(mm).sort(function(a,b){return(b.shortlist*4+b.interested*2+b.availability*2+b.total)-(a.shortlist*4+a.interested*2+a.availability*2+a.total)}).slice(0,10);

  var h='<div class="cvypr-page"><header class="cvypr-head"><div><small>MODEL TOOLS · CLIENT SIGNALS</small><h1>Package Responses</h1><p>Track opens, model responses, client notes, and package activity in one place.</p></div><div class="cvypr-actions"><button onclick="navTo(\'multipackage\')">Package Library</button><button class="primary" onclick="CAVYRE_PACKAGE_RESPONSES_161238.render(document.getElementById(\'p-packageresponses\'))">Refresh Data</button></div></header>';
  h+='<div class="cvypr-stats">'+metric('Recipients',R.length,'All recipients')+metric('Opened',opened.length,'Viewed package')+metric('Responses',F.length,'Model signals')+metric('Shortlists',shorts.length,'Shortlist signals')+'</div>';
  h+='<div class="cvypr-filters"><div class="cvypr-search"><span>⌕</span><input id="cvypr-q" placeholder="Search package, client, model, email…" oninput="CAVYRE_PACKAGE_RESPONSES_161238.filter()"></div><select id="cvypr-pkg" onchange="CAVYRE_PACKAGE_RESPONSES_161238.filter()"><option value="">All Packages</option>'+P.map(function(p){return'<option value="'+E(p.id)+'">'+E(p.title||'Untitled Package')+'</option>';}).join('')+'</select><select id="cvypr-type" onchange="CAVYRE_PACKAGE_RESPONSES_161238.filter()"><option value="">All Responses</option><option value="interested">Interested</option><option value="shortlist">Shortlist</option><option value="request_availability">Availability</option><option value="pass">Pass</option></select></div>';

  h+='<div class="cvypr-grid"><section class="cvypr-card"><header><div><small>CLIENT FEEDBACK</small><h2>Latest Responses</h2></div><span>'+resp.length+' recorded</span></header><div class="cvypr-table">';
  h+=resp.length?resp.map(function(x){
    return '<article class="cvypr-row" data-q="'+E(search(x))+'" data-pkg="'+E(x.package_id||'')+'" data-type="'+E(x.feedback_type||'')+'"><div><b>'+E(x.model_name||'Model')+'</b><small>'+E(x.package_title||'Package')+'</small></div><div><span class="cvypr-signal '+tone(x.feedback_type)+'">'+E(label(x.feedback_type))+'</span>'+(x.note?'<p>'+E(x.note)+'</p>':'')+'</div><div><b>'+E(x.recipient_name||x.recipient_email||'Client')+'</b><small>'+E(x.company_name||x.recipient_email||'')+'</small></div><time>'+D(x.created_at)+'</time><button onclick="CAVYRE_PACKAGE_RESPONSES_161238.openResponse(\''+E(x.id||'')+'\')">Open →</button></article>';
  }).join(''):'<div class="cvypr-empty">No client responses recorded yet.</div>';
  h+='<div id="cvypr-none" class="cvypr-empty" hidden>No responses match these filters.</div></div></section>';

  h+='<aside class="cvypr-side"><section class="cvypr-card"><header><div><small>MODEL SIGNALS</small><h2>Response Leaders</h2></div></header>';
  h+=leaders.length?leaders.map(function(m,i){return'<div class="cvypr-leader"><i>'+String(i+1).padStart(2,'0')+'</i><span><b>'+E(m.name)+'</b><small>'+m.total+' response'+(m.total===1?'':'s')+'</small></span><dl><dt>INT</dt><dd>'+m.interested+'</dd><dt>SHORT</dt><dd>'+m.shortlist+'</dd><dt>AVAIL</dt><dd>'+m.availability+'</dd><dt>PASS</dt><dd>'+m.pass+'</dd></dl></div>';}).join(''):'<div class="cvypr-empty">No model responses yet.</div>';
  h+='</section><section class="cvypr-card"><header><div><small>ACTIVITY</small><h2>Package Activity</h2></div></header><div class="cvypr-side-body">'+(X.length?X.slice(0,12).map(function(x){return'<div style="padding:8px 0;border-bottom:1px solid #27221b"><b style="display:block;font:8px var(--fM)">'+E(label(x.event_type||'activity'))+'</b><small style="font:6px var(--fM);color:var(--mute)">'+E([x.recipient_name||x.actor_label,x.package_title,x.model_name].filter(Boolean).join(' · '))+' · '+D(x.occurred_at)+'</small></div>';}).join(''):'<div class="cvypr-empty">No package activity yet.</div>')+'</div></section></aside></div></div>';

  el.innerHTML=h; filter();
}

function filter(){
  var q=String((document.getElementById('cvypr-q')||{}).value||'').trim().toLowerCase();
  var p=String((document.getElementById('cvypr-pkg')||{}).value||'');
  var t=String((document.getElementById('cvypr-type')||{}).value||'');
  var n=0;
  document.querySelectorAll('.cvypr-row').forEach(function(x){
    var ok=(!q||String(x.dataset.q||'').indexOf(q)>-1)&&(!p||x.dataset.pkg===p)&&(!t||x.dataset.type===t);
    x.hidden=!ok;if(ok)n++;
  });
  var e=document.getElementById('cvypr-none');if(e)e.hidden=n>0||!document.querySelector('.cvypr-row');
}

function modelImage(pm){
  var media=A(pm.package_model_media).slice().sort(function(a,b){return Number(a.sort_order||0)-Number(b.sort_order||0);});
  var item=media.find(function(x){return x&&x.model_media&&x.model_media.url;});
  return item&&item.model_media&&item.model_media.url||'';
}

async function openResponse(feedbackId){
  var root=STATE.root||document.getElementById('p-packageresponses');
  var d=STATE.data||{};
  var feedback=A(d.feedback).find(function(x){return String(x.id)===String(feedbackId);});
  if(!root||!feedback)return;

  root.innerHTML='<div class="cvypr-page"><button class="cvypr-back" onclick="CAVYRE_PACKAGE_RESPONSES_161238.back()">← Back to Responses</button><div class="cvypr-empty">Loading response detail…</div></div>';

  try{
    var detail=await get('/api/agent/packages?organization='+encodeURIComponent(org())+'&package_id='+encodeURIComponent(feedback.package_id));
    renderDetail(root,feedback,detail);
  }catch(e){
    root.innerHTML='<div class="cvypr-page"><button class="cvypr-back" onclick="CAVYRE_PACKAGE_RESPONSES_161238.back()">← Back to Responses</button><div class="cvypr-empty">'+E(e&&e.message||e)+'</div></div>';
  }
}

function renderDetail(root,f,detail){
  var pkg=detail.package||{},models=A(detail.models),recipients=A(detail.recipients),allFeedback=A(detail.feedback),activity=A(detail.activity);
  var recipient=recipients.find(function(x){return String(x.id)===String(f.recipient_id);})||{};
  var recipientFeedback=allFeedback.filter(function(x){return String(x.recipient_id)===String(f.recipient_id);});
  var recipientActivity=activity.filter(function(x){return String(x.recipient_id||'')===String(f.recipient_id||'');});
  var selectedIds=new Set(recipientFeedback.filter(function(x){return /shortlist|interested|request_availability/.test(String(x.feedback_type||''));}).map(function(x){return String(x.model_id||'');}));

  var h='<div class="cvypr-page">';
  h+='<header class="cvypr-head"><div><button class="cvypr-back" onclick="CAVYRE_PACKAGE_RESPONSES_161238.back()">← Back to Package Responses</button><small style="display:block;margin-top:12px">CLIENT RESPONSE · SELECTION DETAIL</small><h1>'+E(pkg.title||f.package_title||'Package')+'</h1><p>This is the exact package response context — client, selected model, package models and activity.</p></div><div class="cvypr-actions"><button onclick="CAVYRE_PACKAGE_RESPONSES_161238.openLibrary(\''+E(pkg.id||f.package_id)+'\')">Package Library</button>'+(typeof window.openPackageEditor==='function'?'<button class="primary" onclick="openPackageEditor(\''+E(pkg.id||f.package_id)+'\')">Edit Package</button>':'')+'</div></header>';

  h+='<div class="cvypr-detail-top"><section class="cvypr-hero"><div class="cvypr-k">RESPONSE RECEIVED · '+E(DT(f.created_at))+'</div><h2>'+E(f.model_name||((f.models||{}).display_name)||'Model')+'</h2><div class="cvypr-hero-meta"><span class="cvypr-signal '+tone(f.feedback_type)+'">'+E(label(f.feedback_type))+'</span><span class="cvypr-chip">'+E(pkg.status||'active')+'</span><span class="cvypr-chip">'+E(f.package_title||pkg.title||'Package')+'</span></div><div class="cvypr-response"><small class="cvypr-k">CLIENT SIGNAL</small><strong>'+E(label(f.feedback_type))+'</strong><p>'+(f.note?E(f.note):'No written note was included with this response.')+'</p></div></section>';

  h+='<aside class="cvypr-client"><div class="cvypr-k">RECIPIENT / CLIENT</div><h2 style="font:27px var(--fD);font-weight:400;margin:7px 0 0">'+E(f.recipient_name||recipient.display_name||f.recipient_email||'Client')+'</h2><dl><dt>Company</dt><dd>'+E(f.company_name||(recipient.companies&&recipient.companies.name)||'—')+'</dd><dt>Email</dt><dd>'+E(f.recipient_email||recipient.email||'—')+'</dd><dt>Sent</dt><dd>'+E(DT(recipient.sent_at))+'</dd><dt>Opened</dt><dd>'+E(DT(recipient.opened_at||recipient.first_viewed_at))+'</dd><dt>Views</dt><dd>'+E(recipient.view_count||0)+'</dd><dt>Last Viewed</dt><dd>'+E(DT(recipient.last_viewed_at))+'</dd></dl></aside></div>';

  h+='<section class="cvypr-section"><header><div><div class="cvypr-k">PACKAGE CONTENT</div><h3>Models in This Selection</h3></div><span>'+models.length+' models</span></header><div class="cvypr-models">';
  h+=models.length?models.map(function(pm){
    var m=pm.models||{},img=modelImage(pm),selected=selectedIds.has(String(pm.model_id||m.id||'')),isThis=String(pm.model_id||m.id||'')===String(f.model_id||'');
    return '<article class="cvypr-model '+((selected||isThis)?'selected':'')+'"><div class="cvypr-model-img">'+(img?'<img src="'+E(img)+'" alt="">':'')+'</div><div class="cvypr-model-body"><b>'+E(m.display_name||'Model')+'</b><small>'+E([m.primary_market_label,m.stage].filter(Boolean).join(' · ')||'Included in package')+'</small>'+(isThis?'<small style="color:var(--gold);margin-top:6px">THIS RESPONSE → '+E(label(f.feedback_type))+'</small>':'')+'</div></article>';
  }).join(''):'<div class="cvypr-empty">No package models found.</div>';
  h+='</div></section>';

  h+='<section class="cvypr-section"><header><div><div class="cvypr-k">RECIPIENT HISTORY</div><h3>Responses from This Client</h3></div><span>'+recipientFeedback.length+' signals</span></header><div class="cvypr-history">';
  h+=recipientFeedback.length?recipientFeedback.map(function(x){var mn=x.models&&x.models.display_name||x.model_name||'Model';return'<div class="cvypr-history-row"><span class="cvypr-signal '+tone(x.feedback_type)+'">'+E(label(x.feedback_type))+'</span><div><b>'+E(mn)+'</b>'+(x.note?'<p>'+E(x.note)+'</p>':'')+'</div><small>'+E(DT(x.created_at))+'</small></div>';}).join(''):'<div class="cvypr-empty">No other client responses.</div>';
  h+='</div></section>';

  h+='<section class="cvypr-section"><header><div><div class="cvypr-k">PACKAGE ACTIVITY</div><h3>Recipient Activity Timeline</h3></div><span>'+recipientActivity.length+' records</span></header><div class="cvypr-history">';
  h+=recipientActivity.length?recipientActivity.slice(0,50).map(function(x){return'<div class="cvypr-history-row"><small>'+E(DT(x.occurred_at))+'</small><div><b>'+E(label(x.event_type||'activity'))+'</b><p>'+E([x.actor_label,x.model_id?'Model activity':''].filter(Boolean).join(' · '))+'</p></div><small>'+E(x.event_type||'')+'</small></div>';}).join(''):'<div class="cvypr-empty">No recipient activity recorded.</div>';
  h+='</div></section></div>';

  root.innerHTML=h;
  try{root.scrollIntoView({block:'start'});}catch(_e){}
}

function back(){
  var root=STATE.root||document.getElementById('p-packageresponses');
  if(root&&STATE.data)paint(root,STATE.data);else if(root)render(root);
}
function openLibrary(id){
  window._veuxPackageResponseOpenId=id;
  if(window.VEUX_PERF&&VEUX_PERF.invalidate)VEUX_PERF.invalidate('multipackage');
  if(window.navTo)navTo('multipackage');
  setTimeout(function(){
    if(window.VEUX_V148&&VEUX_V148.pkgSelect)VEUX_V148.pkgSelect(id);
  },100);
}

function install(){
  css();
  window.CAVYRE_PACKAGE_RESPONSES_161238={version:'16.12.38',render:render,filter:filter,openResponse:openResponse,back:back,openLibrary:openLibrary};
  window.VEUX_PACKAGE_RESPONSES_16951=window.CAVYRE_PACKAGE_RESPONSES_161238;
  window.VEUX_V16951=window.CAVYRE_PACKAGE_RESPONSES_161238;
  window.renderPackageResponses16951=function(el){return render(el);};
  if(window.VEUX_V15_ROUTE_RENDERERS)window.VEUX_V15_ROUTE_RENDERERS.packageresponses=function(el){return render(el);};
  if(window._currentPage==='packageresponses'){
    var el=document.getElementById('p-packageresponses');
    if(el)render(el);
  }
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
window.addEventListener('veux:agency-v16-ready',install);
})();
