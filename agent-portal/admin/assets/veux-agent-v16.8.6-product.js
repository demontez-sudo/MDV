/* VEUX DESK 16.8.6 — Mobile + Smart Talent Operations
   Responsive mobile system, functional CRM directory, smart evaluations,
   drag calendar, scouting intake/transfer, high-fashion development gameplans. */
(function(){
'use strict';
var VERSION='16.8.6';
function B(){if(!window.VEUX_AGENT_V4||!VEUX_AGENT_V4.api)throw new Error('VEUX secure bridge is not ready');return VEUX_AGENT_V4;}
function org(){return B().state&&B().state.org&&B().state.org.slug||'maison-de-veux';}
function orgId(){return B().state&&B().state.org&&B().state.org.id||null;}
function api(path,opts){return B().api(path,opts||{method:'GET',headers:{}});}
function get(path){return api(path,{method:'GET',headers:{}});}
function post(path,body){return api(path,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});}
function arr(v){return Array.isArray(v)?v:[];}
function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
function date(v){if(!v)return '—';try{return new Date(v).toLocaleDateString([],{month:'short',day:'numeric',year:'numeric'});}catch(_){return String(v);}}
function fmt(v){if(v==null||v==='')return '—';return String(v);}
function toast(m){if(window.toast)window.toast(m);else console.info(m);}
function clearCache(){try{if(B().clearApiCache)B().clearApiCache();}catch(_){}}
function panel(id){return document.getElementById('p-'+id)||document.querySelector('#pm .panel.on');}
function badge(v){var s=String(v||'').toLowerCase(),c=/active|signed|roster|complete|approved|confirmed|converted/.test(s)?'ok':/declined|cancel|rejected|expired/.test(s)?'bad':/pending|scheduled|offer|contract|development|progress/.test(s)?'warn':'';return '<span class="v1686-badge '+c+'">'+esc(String(v||'—').replaceAll('_',' '))+'</span>';}
function modal(title,body,footer,wide){var old=document.getElementById('v1686-modal');if(old)old.remove();var x=document.createElement('div');x.id='v1686-modal';x.className='v1686-modalback';x.innerHTML='<div class="v1686-modal '+(wide?'wide':'')+'"><header><div><small>VEUX DESK · '+VERSION+'</small><h2>'+esc(title)+'</h2></div><button data-close>×</button></header><main>'+body+'</main><footer>'+(footer||'<button class="v1686-btn" data-close>Close</button>')+'</footer></div>';document.body.appendChild(x);x.querySelectorAll('[data-close]').forEach(function(b){b.onclick=function(){x.remove();};});return x;}
function field(label,id,value,type,ph){return '<label class="v1686-field"><span>'+esc(label)+'</span><input id="'+id+'" type="'+(type||'text')+'" value="'+esc(value||'')+'" placeholder="'+esc(ph||'')+'"></label>';}
function textarea(label,id,value,ph){return '<label class="v1686-field wide"><span>'+esc(label)+'</span><textarea id="'+id+'" rows="4" placeholder="'+esc(ph||'')+'">'+esc(value||'')+'</textarea></label>';}
function boardOpts(l){var seen={},mk={},dv={};arr(l.markets).forEach(function(m){mk[m.id]=m.name||m.city||'';});arr(l.divisions).forEach(function(d){dv[d.id]=d.name||'';});return arr(l.boards).filter(function(b){var k=[String(b.name||'').toLowerCase(),b.market_id||'',b.division_id||''].join('|');if(seen[k])return false;seen[k]=1;return true;}).map(function(b){var n=String(b.name||'Board'),low=n.toLowerCase(),parts=[n];var m=mk[b.market_id],d=dv[b.division_id];if(m&&low.indexOf(String(m).toLowerCase())<0)parts.push(m);if(d&&low.indexOf(String(d).toLowerCase())<0)parts.push(d);return {value:b.id,label:parts.join(' \u00b7 ')};});}
function select(label,id,items,value){return '<label class="v1686-field"><span>'+esc(label)+'</span><select id="'+id+'">'+arr(items).map(function(o){var v=typeof o==='string'?o:o.value,t=typeof o==='string'?o:o.label;return '<option value="'+esc(v)+'" '+(String(v)===String(value||'')?'selected':'')+'>'+esc(t)+'</option>';}).join('')+'</select></label>';}
function val(id){var e=document.getElementById(id);return e?e.value.trim():'';}
function checked(id){var e=document.getElementById(id);return !!(e&&e.checked);}

/* ---------- MOBILE SHELL ---------- */
function mobileTop(){
  var top=document.querySelector('.topbar,.top-bar,.tb');
  if(top)top.classList.add('v1686-mobile-top');
}
function mobileNav(){
  var mn=document.getElementById('mobnav');if(!mn)return;
  var defs=[['overview','⌂','Home'],['calendar','▤','Calendar'],['roster','◈','Models'],['multipackage','♥','Packages']];
  mn.innerHTML=defs.map(function(x){return '<button class="mn-b" data-p="'+x[0]+'" onclick="navTo(\''+x[0]+'\')"><span class="mn-b-ico">'+x[1]+'</span><span class="mn-b-lbl">'+x[2]+'</span></button>';}).join('')+'<button class="mn-b" id="mn-more-btn" onclick="openMobMore()"><span class="mn-b-ico">•••</span><span class="mn-b-lbl">More</span><span class="mn-more-dot" id="mn-more-dot"></span></button>';
}
mobileTop();mobileNav();
window.addEventListener('resize',function(){mobileTop();});

/* ---------- CRM DIRECTORY ---------- */
var CRM={data:null,kind:'companies',page:0,q:'',type:'',market:'',selected:null,timer:null};
function crmFilter(rows,kind){
  var q=CRM.q.toLowerCase(),type=CRM.type.toLowerCase(),market=CRM.market.toLowerCase();
  return rows.filter(function(x){
    var text=kind==='companies'?[x.name,x.email,x.website,x.company_type,x.status].join(' '):[x.display_name,x.email,x.role,x.market,x.companies&&x.companies.name].join(' ');
    if(q&&text.toLowerCase().indexOf(q)<0)return false;
    if(type){var t=kind==='companies'?String(x.company_type||''):String(x.role||'');if(t.toLowerCase().indexOf(type)<0)return false;}
    if(market){var m=String(x.market||x.city||'');if(m.toLowerCase()!==market)return false;}
    return true;
  });
}
function crmMeta(x,k,d){var m=x&&x.metadata&&typeof x.metadata==='object'?x.metadata:{};var v=m[k];return v==null||v===''?(d==null?'—':d):v}
function crmAddr(x){var a=x&&x.address&&typeof x.address==='object'?x.address:{};return a.formatted||[a.line1,a.city,a.region,a.postal_code,a.country].filter(Boolean).join(', ')||crmMeta(x,'city','—')}
function crmLinksForContact(x){return arr(x&&x.company_links).map(function(l){return l.company||((CRM.data&&CRM.data.companies)||[]).find(function(c){return c.id===l.company_id})}).filter(Boolean)}
function crmDetail(x,kind,contacts){
  if(!x)return '<aside class="v1686-crm-detail v1686-crm360"><div class="v1686-empty">Select a record.</div></aside>';
  if(kind==='companies'){
    var linked=contacts.filter(function(c){return c.company_id===x.id||arr(c.company_links).some(function(l){return l.company_id===x.id})});
    var m=x.metadata||{};
    return '<aside class="v1686-crm-detail v1686-crm360"><header class="v1686-360-head"><div><small>COMPANY 360 · RELATIONSHIP RECORD</small><h2>'+esc(x.name)+'</h2><p>'+esc(x.company_type||'Client')+' · '+esc(x.tier||'Unranked')+'</p></div>'+badge(x.status)+'</header>'+
    '<div class="v1686-360-actions"><button class="v1686-btn gold" onclick="window.CavyreCRM&&CavyreCRM.openCompany(\''+x.id+'\')">Edit Company</button><button class="v1686-btn" onclick="window.CavyreCRM&&CavyreCRM.openContact(\''+x.id+'\')">+ Contact</button></div>'+
    '<section class="v1686-360-section"><header><b>Identity & Location</b></header><div class="v1686-detail-grid">'+
      '<div><span>Type</span><b>'+esc(x.company_type||'Client')+'</b></div>'+
      '<div><span>Tier</span><b>'+esc(x.tier||'—')+'</b></div>'+
      '<div class="wide"><span>Address / Base</span><b>'+esc(crmAddr(x))+'</b></div>'+
      '<div><span>Secondary Markets</span><b>'+esc(crmMeta(x,'secondary_markets','—'))+'</b></div>'+
      '<div><span>Office / Studio</span><b>'+esc(crmMeta(x,'office_name','—'))+'</b></div>'+
    '</div></section>'+
    '<section class="v1686-360-section"><header><b>Communication</b></header><div class="v1686-detail-grid">'+
      '<div><span>Email</span><b>'+esc(x.email||'—')+'</b></div>'+
      '<div><span>Phone</span><b>'+esc(x.phone||'—')+'</b></div>'+
      '<div class="wide"><span>Website</span><b>'+esc(x.website||'—')+'</b></div>'+
      '<div><span>Instagram</span><b>'+esc(crmMeta(x,'instagram','—'))+'</b></div>'+
      '<div><span>LinkedIn</span><b>'+esc(crmMeta(x,'linkedin','—'))+'</b></div>'+
    '</div></section>'+
    '<section class="v1686-360-section"><header><b>Relationship Intelligence</b></header><div class="v1686-detail-grid">'+
      '<div><span>Strength</span><b>'+esc(crmMeta(x,'relationship_strength','New'))+'</b></div>'+
      '<div><span>Priority</span><b>'+esc(crmMeta(x,'priority','Normal'))+'</b></div>'+
      '<div><span>Owner</span><b>'+esc(crmMeta(x,'relationship_owner','—'))+'</b></div>'+
      '<div><span>Follow-Up</span><b>'+esc(crmMeta(x,'next_follow_up','—'))+'</b></div>'+
      '<div><span>Decision Maker</span><b>'+esc(crmMeta(x,'decision_maker','—'))+'</b></div>'+
      '<div><span>Billing / AP</span><b>'+esc(crmMeta(x,'accounts_payable_contact','—'))+'</b></div>'+
    '</div></section>'+
    '<section class="v1686-360-section"><header><b>Commercial Profile</b></header><div class="v1686-detail-grid">'+
      '<div><span>Budget / Rate Range</span><b>'+esc(crmMeta(x,'budget_range','—'))+'</b></div>'+
      '<div><span>Payment Terms</span><b>'+esc(crmMeta(x,'payment_terms','—'))+'</b></div>'+
      '<div><span>Project Types</span><b>'+esc(crmMeta(x,'project_types','—'))+'</b></div>'+
      '<div><span>Booking Markets</span><b>'+esc(crmMeta(x,'booking_markets','—'))+'</b></div>'+
      '<div class="wide"><span>Current Opportunities</span><b>'+esc(crmMeta(x,'current_opportunities','—'))+'</b></div>'+
    '</div></section>'+
    '<section class="v1686-360-section"><header><b>Professional Contacts</b><span>'+linked.length+'</span></header><div class="v1686-360-contacts">'+
      (linked.length?linked.slice(0,20).map(function(c){return '<button onclick="VEUX_V1686.crmOpenContact(\''+c.id+'\')"><strong>'+esc(c.display_name)+'</strong><small>'+esc(c.role||'Professional Contact')+'</small></button>'}).join(''):'<div class="v1686-empty">No contacts linked yet.</div>')+
    '</div></section>'+
    '<section class="v1686-360-section"><header><b>Notes & Vera Brief</b></header><p>'+esc(x.notes||'No relationship notes recorded.')+'</p><p class="v1686-360-vera"><b>VERA:</b> '+esc(crmMeta(x,'vera_brief','No Vera brief recorded.'))+'</p></section></aside>';
  }
  var companies=crmLinksForContact(x),primary=x.companies||companies[0]||null;
  return '<aside class="v1686-crm-detail v1686-crm360"><header class="v1686-360-head"><div><small>CONTACT 360 · CANONICAL PERSON</small><h2>'+esc(x.display_name)+'</h2><p>'+esc(x.role||'Professional Contact')+'</p></div>'+badge(x.status)+'</header>'+
  '<div class="v1686-360-actions"><button class="v1686-btn gold" onclick="window.CavyreCRM&&CavyreCRM.openContact(\''+x.id+'\')">Edit Contact</button>'+(primary?'<button class="v1686-btn" onclick="VEUX_V1686.crmKind(\'companies\');setTimeout(function(){VEUX_V1686.crmSelect(\''+primary.id+'\')},0)">Open Primary Company</button>':'')+'</div>'+
  '<section class="v1686-360-section"><header><b>Professional Profile</b></header><div class="v1686-detail-grid">'+
    '<div><span>Role / Title</span><b>'+esc(x.role||'—')+'</b></div>'+
    '<div><span>Contact Type</span><b>'+esc(crmMeta(x,'contact_type','—'))+'</b></div>'+
    '<div><span>Department</span><b>'+esc(crmMeta(x,'department','—'))+'</b></div>'+
    '<div><span>Seniority</span><b>'+esc(crmMeta(x,'seniority','—'))+'</b></div>'+
    '<div><span>Base Market</span><b>'+esc(x.market||crmMeta(x,'city','—'))+'</b></div>'+
    '<div><span>Frequent Markets</span><b>'+esc(crmMeta(x,'frequent_markets','—'))+'</b></div>'+
  '</div></section>'+
  '<section class="v1686-360-section"><header><b>Communication</b></header><div class="v1686-detail-grid">'+
    '<div><span>Email</span><b>'+esc(x.email||'—')+'</b></div>'+
    '<div><span>Phone</span><b>'+esc(x.phone||'—')+'</b></div>'+
    '<div><span>WhatsApp</span><b>'+esc(x.whatsapp||'—')+'</b></div>'+
    '<div><span>Instagram</span><b>'+esc(x.instagram||'—')+'</b></div>'+
    '<div><span>Preferred Contact</span><b>'+esc(x.preferred_contact||'—')+'</b></div>'+
    '<div><span>Best Time</span><b>'+esc(crmMeta(x,'best_contact_time','—'))+'</b></div>'+
  '</div></section>'+
  '<section class="v1686-360-section"><header><b>Connected Companies</b><span>'+companies.length+'</span></header><div class="v1686-360-contacts">'+
    (companies.length?companies.map(function(c){return '<button onclick="VEUX_V1686.crmKind(\'companies\');setTimeout(function(){VEUX_V1686.crmSelect(\''+c.id+'\')},0)"><strong>'+esc(c.name)+'</strong><small>'+esc(c.company_type||'Company')+'</small></button>'}).join(''):'<div class="v1686-empty">Independent / no company linked.</div>')+
  '</div></section>'+
  '<section class="v1686-360-section"><header><b>Relationship Intelligence</b></header><div class="v1686-detail-grid">'+
    '<div><span>Strength</span><b>'+esc(crmMeta(x,'relationship_strength','New'))+'</b></div>'+
    '<div><span>Priority</span><b>'+esc(crmMeta(x,'priority','Normal'))+'</b></div>'+
    '<div><span>Owner</span><b>'+esc(crmMeta(x,'relationship_owner','—'))+'</b></div>'+
    '<div><span>Next Follow-Up</span><b>'+esc(crmMeta(x,'next_follow_up','—'))+'</b></div>'+
    '<div><span>Decision Influence</span><b>'+esc(crmMeta(x,'decision_influence','—'))+'</b></div>'+
    '<div><span>Availability</span><b>'+esc(crmMeta(x,'availability','—'))+'</b></div>'+
  '</div></section>'+
  '<section class="v1686-360-section"><header><b>Working Preferences</b></header><p><b>Talent:</b> '+esc(crmMeta(x,'talent_preferences','—'))+'</p><p><b>Submissions:</b> '+esc(crmMeta(x,'submission_preferences','—'))+'</p><p><b>Current Projects:</b> '+esc(crmMeta(x,'current_projects','—'))+'</p></section>'+
  '<section class="v1686-360-section"><header><b>Notes & Vera Brief</b></header><p>'+esc(x.notes||'No relationship notes recorded.')+'</p><p class="v1686-360-vera"><b>VERA:</b> '+esc(crmMeta(x,'vera_brief','No Vera brief recorded.'))+'</p></section></aside>';
}
async function renderCRM(el){
  el=el||panel('industrydirectory');if(!el)return;
  el.innerHTML='<div class="v1686-page"><div class="v1686-loading">Loading Companies & Contacts…</div></div>';
  try{
    var d=await get('/api/agent/crm/v9?organization='+encodeURIComponent(org()));CRM.data=d;
    var companies=arr(d.companies),contacts=arr(d.contacts),kind=CRM.kind,source=kind==='companies'?companies:contacts,filtered=crmFilter(source,kind),per=40,pages=Math.max(1,Math.ceil(filtered.length/per));CRM.page=Math.max(0,Math.min(CRM.page,pages-1));var shown=filtered.slice(CRM.page*per,(CRM.page+1)*per);
    if(!CRM.selected||!source.some(function(x){return x.id===CRM.selected;}))CRM.selected=shown[0]&&shown[0].id||source[0]&&source[0].id||null;
    var selected=source.find(function(x){return x.id===CRM.selected;})||shown[0]||null;
    var types=[...new Set(source.map(function(x){return kind==='companies'?x.company_type:x.role;}).filter(Boolean))].sort();
    var markets=[...new Set(source.map(function(x){return x.market||x.city;}).filter(Boolean))].sort();
    var h='<div class="v1686-page v1686-crm"><header class="v1686-pagehead"><div><small>MODEL TOOLS · INDUSTRY RELATIONS</small><h1>Companies / Clients & Professional Contacts</h1><p>Search, filter and manage every client, casting and professional relationship.</p></div><div><button class="v1686-btn" onclick="window.VEUX_V1321&&VEUX_V1321.openCompany&&VEUX_V1321.openCompany()">+ Company</button><button class="v1686-btn gold" onclick="window.VEUX_V1321&&VEUX_V1321.openContact&&VEUX_V1321.openContact()">+ Contact</button></div></header>';
    h+='<div class="v1686-tabs"><button class="'+(kind==='companies'?'on':'')+'" onclick="VEUX_V1686.crmKind(\'companies\')">Companies / Clients <i>'+companies.length+'</i></button><button class="'+(kind==='contacts'?'on':'')+'" onclick="VEUX_V1686.crmKind(\'contacts\')">Professional Contacts <i>'+contacts.length+'</i></button></div>';
    h+='<div class="v1686-filterbar"><label>⌕<input value="'+esc(CRM.q)+'" placeholder="Search '+(kind==='companies'?'companies, brands or clients':'name, role, company or email')+'…" oninput="VEUX_V1686.crmSearch(this.value)"></label><select onchange="VEUX_V1686.crmType(this.value)"><option value="">All Types</option>'+types.map(function(x){return '<option '+(CRM.type===x?'selected':'')+'>'+esc(x)+'</option>';}).join('')+'</select><select onchange="VEUX_V1686.crmMarket(this.value)"><option value="">All Markets</option>'+markets.map(function(x){return '<option '+(CRM.market===x?'selected':'')+'>'+esc(x)+'</option>';}).join('')+'</select><button onclick="VEUX_V1686.crmClear()">Clear</button></div>';
    h+='<div class="v1686-crm-layout"><section class="v1686-crm-list"><div class="v1686-crm-head">'+(kind==='companies'?'<span>Company</span><span>Type</span><span>Contact</span><span>Status</span>':'<span>Contact</span><span>Company</span><span>Role</span><span>Market</span>')+'</div>';
    h+=shown.map(function(x){var openCall=kind==='companies'?"window.VEUX_V1321&&VEUX_V1321.openCompany&&VEUX_V1321.openCompany('"+x.id+"')":"window.VEUX_V1321&&VEUX_V1321.openContact&&VEUX_V1321.openContact('"+x.id+"')";return '<button class="v1686-crm-row '+(selected&&selected.id===x.id?'on':'')+'" data-id="'+esc(x.id)+'" onclick="VEUX_V1686.crmSelect(\''+x.id+'\');'+openCall+'" >'+(kind==='companies'?'<span><b>'+esc(x.name)+'</b><small>'+esc(x.email||x.website||'')+'</small></span><span>'+esc(x.company_type||'Client')+'</span><span>'+contacts.filter(function(c){return c.company_id===x.id;}).length+'</span><span>'+badge(x.status)+'</span>':'<span><b>'+esc(x.display_name)+'</b><small>'+esc(x.email||'')+'</small></span><span>'+esc(x.companies&&x.companies.name||'Independent')+'</span><span>'+esc(x.role||'Professional')+'</span><span>'+esc(x.market||'—')+'</span>')+'</button>';}).join('');
    h+='<footer class="v1686-pagination"><span>'+(filtered.length?CRM.page*per+1:0)+'–'+Math.min((CRM.page+1)*per,filtered.length)+' of '+filtered.length+'</span><div><button '+(CRM.page===0?'disabled':'')+' onclick="VEUX_V1686.crmPage(-1)">← Previous</button><strong>Page '+(CRM.page+1)+' / '+pages+'</strong><button '+(CRM.page>=pages-1?'disabled':'')+' onclick="VEUX_V1686.crmPage(1)">Next →</button></div></footer></section>'+crmDetail(selected,kind,contacts)+'</div></div>';
    el.innerHTML=h;
  }catch(e){el.innerHTML='<div class="v1686-page"><div class="v1686-error">'+esc(e.message||e)+'</div></div>';}
}
window.renderIndustryDirectory=renderCRM;

/* ---------- SMART EVALUATIONS ---------- */
var EVAL_CATS=[['runway','Runway',18],['body_proportion','Body / Proportion',12],['posture','Posture',12],['heel_foot_control','Heel / Foot Control',12],['posing','Posing',12],['editorial','Editorial',12],['commercial','Commercial',10],['professionalism','Professionalism',12]];
function smartEval(){
  function score(prefix){var total=0,w=0;EVAL_CATS.forEach(function(c){var v=Number(val(prefix+c[0]));if(Number.isFinite(v)){total+=v*c[2];w+=c[2];}});return w?Math.round(total/w*10)/10:null;}
  var current=score('v155-ec-'),potential=score('v155-ep-'),a=document.getElementById('v155-e-current'),b=document.getElementById('v155-e-potential'),box=document.getElementById('v1686-smart-score');
  if(a&&current!=null)a.value=current.toFixed(1);if(b&&potential!=null)b.value=potential.toFixed(1);
  if(box)box.innerHTML='<div><span>SMART CURRENT</span><strong>'+(current==null?'—':current.toFixed(1))+'</strong></div><div><span>SMART POTENTIAL</span><strong>'+(potential==null?'—':potential.toFixed(1))+'</strong></div><p>Weighted automatically from runway, posture, movement, image range and professionalism.</p>';
}
function patchEvalForm(){
  var root=document.getElementById('v155-modal');if(!root||root.querySelector('#v1686-smart-score'))return;
  var first=root.querySelector('.v155-form-grid');if(!first)return;
  var box=document.createElement('div');box.className='v1686-smart-eval';box.innerHTML='<div id="v1686-smart-score"></div><label><input id="v1686-auto-goals" type="checkbox" checked> Auto-touch development goals from weak / high-gap ratings</label>';first.parentNode.insertBefore(box,first);
  EVAL_CATS.forEach(function(c){['v155-ec-','v155-ep-'].forEach(function(p){var e=document.getElementById(p+c[0]);if(e)e.addEventListener('input',smartEval);});});smartEval();
}
var oldEvalForm=window.VEUX_V155&&VEUX_V155.evaluationForm;
if(oldEvalForm){VEUX_V155.evaluationForm=function(id){oldEvalForm(id);setTimeout(patchEvalForm,30);};}
if(window.VEUX_V155){VEUX_V155.saveEvaluation=async function(id){
  var model=val('v155-e-model');if(!model){alert('Select a model');return;}
  var scores=EVAL_CATS.map(function(c,i){return {category_key:c[0],category_label:c[1],weight:c[2],sort_order:i,current_score:val('v155-ec-'+c[0])===''?null:Number(val('v155-ec-'+c[0])),potential_score:val('v155-ep-'+c[0])===''?null:Number(val('v155-ep-'+c[0])),notes:val('v155-en-'+c[0])||null};});
  try{
    var out=await post('/api/agent/development/v9',{action:id?'update_evaluation':'create_evaluation',evaluation_id:id||undefined,model_id:model,evaluated_on:val('v155-e-date'),status:val('v155-e-status')||'draft',executive_summary:val('v155-e-summary')||null,scores:scores,smart_score:true,auto_goals:checked('v1686-auto-goals')});
    if(VEUX_V155.closeModal)VEUX_V155.closeModal();toast('✓ Smart evaluation saved'+(arr(out.touched_goals).length?' · '+arr(out.touched_goals).length+' goals touched':''));
    clearCache();if(window.renderModelEvaluations)window.renderModelEvaluations(panel('modelevaluations'));
  }catch(e){var er=document.getElementById('v155-modal-error');if(er)er.textContent=e.message;else alert(e.message);}
};}

/* ---------- DEVELOPMENT GAMEPLAN ---------- */
var DEV={data:null,roster:[],q:''};
function devCategory(cat){
  var s=String(cat||'').toLowerCase();
  if(/skin|groom|image/.test(s))return 'Image & Grooming';
  if(/wellness|routine|nutrition|recovery/.test(s))return 'Wellness & Routine';
  if(/runway|movement|posture|heel|posing|training/.test(s))return 'Runway & Movement';
  if(/portfolio|digital|test|editorial/.test(s))return 'Portfolio & Image';
  return 'Career & Market';
}
async function loadDev1686(){
  var x=await Promise.all([get('/api/agent/development/v9?organization='+encodeURIComponent(org())),get('/api/agent/roster/v10?organization='+encodeURIComponent(org())+'&limit=500')]);DEV.data=x[0];DEV.roster=arr(x[1].roster);return DEV.data;
}
function latestEval(modelId){return arr(DEV.data&&DEV.data.evaluations).filter(function(x){return x.model_id===modelId;}).sort(function(a,b){return new Date(b.evaluated_on)-new Date(a.evaluated_on);})[0]||null;}
function activePlan(modelId){return arr(DEV.data&&DEV.data.plans).find(function(x){return x.model_id===modelId&&!/complete|cancel/i.test(x.status||'');})||null;}
function devModelCard(m){
  var ev=latestEval(m.id),plan=activePlan(m.id),goals=arr(plan&&plan.development_goals),open=goals.filter(function(g){return !/complete/i.test(g.status||'');}),groups={};open.forEach(function(g){var k=devCategory(g.category);(groups[k]||(groups[k]=[])).push(g);});
  return '<article class="v1686-dev-model" data-dev-text="'+esc(String(m.display_name||'').toLowerCase())+'"><header><div class="v1686-avatar">'+(m.primary_media&&m.primary_media.url?'<img src="'+esc(m.primary_media.url)+'">':esc((m.display_name||'M').slice(0,1)))+'</div><div><small>'+esc(m.primary_market_label||m.location||'Maison de Veux')+'</small><h2>'+esc(m.display_name)+'</h2><p>'+esc(m.stage||'Model')+'</p></div><div class="v1686-dev-score"><span>CURRENT</span><strong>'+(ev&&ev.overall_current!=null?Number(ev.overall_current).toFixed(1):'—')+'</strong><em>→ '+(ev&&ev.overall_potential!=null?Number(ev.overall_potential).toFixed(1):'—')+'</em></div></header><div class="v1686-gameplan">'+['Runway & Movement','Portfolio & Image','Image & Grooming','Wellness & Routine','Career & Market'].map(function(k){var gg=groups[k]||[];return '<section><b>'+k+'</b>'+(gg.length?gg.slice(0,3).map(function(g){return '<button onclick="VEUX_V1686.goalStatus(\''+g.id+'\',\''+esc(g.status)+'\')"><i class="'+(/complete/i.test(g.status)?'done':'')+'"></i><span>'+esc(g.title)+'</span><small>'+date(g.target_date)+'</small></button>';}).join(''):'<p>No active goal.</p>')+'</section>';}).join('')+'</div><footer><button onclick="VEUX_V1686.smartGameplan(\''+m.id+'\')">✦ Build / Refresh Smart Gameplan</button><button onclick="VEUX_V1686.newDevActivity(\''+m.id+'\')">+ Activity</button><button onclick="navTo(\'modelevaluations\')">Evaluation →</button></footer></article>';
}
async function renderDevelopment(el){
  el=el||panel('modeldevelopment');if(!el)return;el.innerHTML='<div class="v1686-page"><div class="v1686-loading">Building development board…</div></div>';
  try{await loadDev1686();var rows=DEV.roster.filter(function(m){return !DEV.q||String(m.display_name||'').toLowerCase().includes(DEV.q.toLowerCase());});
    el.innerHTML='<div class="v1686-page v1686-development"><header class="v1686-pagehead"><div><small>DEVELOPMENT & IMAGE · CAREER GAMEPLAN</small><h1>Model Development</h1><p>High-fashion career development across runway, portfolio, grooming, wellness routines and market strategy.</p></div><button class="v1686-btn gold" onclick="VEUX_V1686.smartGameplan()">✦ Smart Gameplan</button></header><div class="v1686-dev-intro"><div><b>SMART SYSTEM</b><p>Evaluation scores automatically identify priority areas. Goals are grouped into a working gameplan agents can update over time.</p></div><label>⌕ <input placeholder="Search models…" oninput="VEUX_V1686.devSearch(this.value)"></label></div><div class="v1686-dev-grid">'+rows.map(devModelCard).join('')+'</div></div>';
  }catch(e){el.innerHTML='<div class="v1686-page"><div class="v1686-error">'+esc(e.message||e)+'</div></div>';}
}
window.renderModelDevelopment=renderDevelopment;

/* ---------- SCOUTING ---------- */
var SCOUT={data:null,q:'',stage:'all',selected:null,timer:null};
var SCOUT_STAGES=['new_lead','contacted','meeting_scheduled','test_requested','offer','contract_sent','signed','development','roster','declined'];
async function loadScout(){SCOUT.data=await get('/api/agent/scouting/v9?organization='+encodeURIComponent(org()));return SCOUT.data;}
function scoutPhoto(p){var x=arr(p.scouting_media)[0];return x&&x.url||'';}
function scoutCard(p){
 return '<article class="v1686-scout-card" onclick="VEUX_V1686.scoutDetail(\''+p.id+'\')">'+(scoutPhoto(p)?'<img src="'+esc(scoutPhoto(p))+'">':'<div class="v1686-scout-noimg">◆</div>')+'<div><small>'+esc([p.city,p.country].filter(Boolean).join(', ')||'SCOUTING')+'</small><h3>'+esc(p.display_name)+'</h3><p>'+esc([p.height_display,p.instagram].filter(Boolean).join(' · '))+'</p>'+badge(p.stage)+'</div><span>›</span></article>';
}
async function renderScouting(el){
 el=el||panel('scouting');if(!el)return;el.innerHTML='<div class="v1686-page"><div class="v1686-loading">Loading scouting records…</div></div>';
 try{var d=await loadScout(),pros=arr(d.prospects),filtered=pros.filter(function(p){if(SCOUT.stage!=='all'&&p.stage!==SCOUT.stage)return false;var q=SCOUT.q.toLowerCase();return !q||[p.display_name,p.city,p.country,p.instagram,p.email,p.stage].join(' ').toLowerCase().includes(q);});
  el.innerHTML='<div class="v1686-page v1686-scout"><header class="v1686-pagehead"><div><small>SCOUTING · TALENT DISCOVERY</small><h1>Scouting Records</h1><p>Get to know prospects deeply, collect images, track meetings and transfer signed talent directly to the board.</p></div><button class="v1686-btn gold" onclick="VEUX_V1686.newProspect()">+ New Prospect</button></header><div class="v1686-scout-stats"><div><strong>'+pros.length+'</strong><span>Prospects</span></div><div><strong>'+pros.filter(function(x){return x.stage==='signed';}).length+'</strong><span>Signed</span></div><div><strong>'+pros.filter(function(x){return x.converted_model_id;}).length+'</strong><span>Transferred</span></div><div><strong>'+arr(d.meetings).filter(function(x){return x.status==='scheduled';}).length+'</strong><span>Meetings</span></div></div><div class="v1686-filterbar"><label>⌕<input placeholder="Search scouting records…" oninput="VEUX_V1686.scoutSearch(this.value)"></label><select onchange="VEUX_V1686.scoutStage(this.value)"><option value="all">All Stages</option>'+SCOUT_STAGES.map(function(x){return '<option value="'+x+'" '+(SCOUT.stage===x?'selected':'')+'>'+esc(x.replaceAll('_',' '))+'</option>';}).join('')+'</select></div><div class="v1686-scout-grid">'+(filtered.map(scoutCard).join('')||'<div class="v1686-empty">No scouting records match this view.</div>')+'</div></div>';
 }catch(e){el.innerHTML='<div class="v1686-page"><div class="v1686-error">'+esc(e.message||e)+'</div></div>';}
}
window.renderScoutingRecords=renderScouting;

function prospectForm(p){
 p=p||{};var q=p.metadata&&p.metadata.questionnaire||{},d=SCOUT.data||{},l=d.lookups||{};
 return '<div class="v1686-formgrid">'+field('Display Name *','v1686-sp-name',p.display_name)+field('Email','v1686-sp-email',p.email,'email')+field('Phone','v1686-sp-phone',p.phone)+field('Instagram','v1686-sp-ig',p.instagram)+field('TikTok','v1686-sp-tt',p.tiktok)+field('City','v1686-sp-city',p.city)+field('Country','v1686-sp-country',p.country)+field('Date of Birth','v1686-sp-dob',p.date_of_birth,'date')+field('Height','v1686-sp-height',p.height_display,'text','5′10″ / 178 cm')+select('Target Market','v1686-sp-market',[{value:'',label:'Select market…'}].concat(arr(l.markets).map(function(x){return {value:x.id,label:x.name};})),p.target_market_id)+select('Division','v1686-sp-division',[{value:'',label:'Select division…'}].concat(arr(l.divisions).map(function(x){return {value:x.id,label:x.name};})),p.target_division_id)+select('Board','v1686-sp-board',[{value:'',label:'Select board…'}].concat(boardOpts(l)),p.boards&&p.boards.id||p.metadata&&p.metadata.preferred_board_id)+select('Assigned Agent','v1686-sp-agent',[{value:'',label:'Unassigned'}].concat(arr(l.members).map(function(x){return {value:x.id,label:x.display_name+' · '+(x.job_title||'Staff')};})),p.assigned_member_id)+select('Stage','v1686-sp-stage',SCOUT_STAGES,p.stage||'new_lead')+
 textarea('Why modeling?','v1686-q-why',q.why_modeling,'What draws you to modeling right now?')+
 textarea('Career goals','v1686-q-goals',q.career_goals,'What would a strong next 12–24 months look like?')+
 textarea('Experience','v1686-q-exp',q.experience,'Agencies, runway, shoots, campaigns, training…')+
 textarea('Availability / schedule','v1686-q-avail',q.availability,'School, work, travel, family or timing constraints?')+
 textarea('Travel & passport readiness','v1686-q-travel',q.travel_ready,'Passport status, travel comfort, markets of interest…')+
 textarea('Strengths','v1686-q-strengths',q.strengths,'What do you feel strongest at?')+
 textarea('Growth areas','v1686-q-growth',q.growth_areas,'What would you like help developing?')+
 textarea('Agent notes','v1686-sp-notes',p.notes,'First impression, fit, concerns, follow-up…')+'</div>';
}
function prospectPayload(){
 return {action:SCOUT.selected?'update':'create',prospect_id:SCOUT.selected||undefined,display_name:val('v1686-sp-name'),email:val('v1686-sp-email')||null,phone:val('v1686-sp-phone')||null,instagram:val('v1686-sp-ig')||null,tiktok:val('v1686-sp-tt')||null,city:val('v1686-sp-city')||null,country:val('v1686-sp-country')||null,date_of_birth:val('v1686-sp-dob')||null,height_display:val('v1686-sp-height')||null,target_market_id:val('v1686-sp-market')||null,target_division_id:val('v1686-sp-division')||null,board_id:val('v1686-sp-board')||null,assigned_member_id:val('v1686-sp-agent')||null,stage:val('v1686-sp-stage')||'new_lead',notes:val('v1686-sp-notes')||null,questionnaire:{why_modeling:val('v1686-q-why'),career_goals:val('v1686-q-goals'),experience:val('v1686-q-exp'),availability:val('v1686-q-avail'),travel_ready:val('v1686-q-travel'),strengths:val('v1686-q-strengths'),growth_areas:val('v1686-q-growth')}};
}
async function uploadScoutingFile(prospectId,file){
 var oid=orgId();if(!oid)throw new Error('Organization context is missing');
 var session=await api('/api/storage/upload-url',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({organization_id:oid,name:file.name,mime_type:file.type,size_bytes:file.size,category:'scouting',visibility:'staff',resource_type:'scouting',resource_id:prospectId})});
 var client=B().state&&B().state.client;if(!client||!session.token)throw new Error('Secure storage client is not ready');
 var up=await client.storage.from(session.bucket).uploadToSignedUrl(session.path,session.token,file,{contentType:file.type});if(up.error)throw up.error;
 var fin=await api('/api/storage/finalize',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({upload_session_id:session.upload_session_id,relationship:'scouting_image',metadata:{source:'scouting'}})});
 await post('/api/agent/scouting/v9',{action:'add_media_document',prospect_id:prospectId,document_id:fin.document.id,caption:file.name});
}

/* ---------- CALENDAR DRAG ---------- */
function activateCalendarDrag(el){
 if(!el)return;
 el.querySelectorAll('[data-cal-kind][draggable="true"]').forEach(function(x){
   x.addEventListener('dragstart',function(e){var key=x.dataset.calKey||'';if(key.indexOf('@')>=0){e.preventDefault();toast('Recurring items should be moved from Edit Series.');return;}e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('application/json',JSON.stringify({kind:x.dataset.calKind,id:x.dataset.calId,start:x.dataset.calStart,end:x.dataset.calEnd,type:x.dataset.calType}));x.classList.add('v1686-dragging');});
   x.addEventListener('dragend',function(){x.classList.remove('v1686-dragging');});
 });
 el.querySelectorAll('[data-cal-date]').forEach(function(z){
   z.addEventListener('dragover',function(e){e.preventDefault();z.classList.add('v1686-drop');});
   z.addEventListener('dragleave',function(){z.classList.remove('v1686-drop');});
   z.addEventListener('drop',async function(e){e.preventDefault();e.stopPropagation();z.classList.remove('v1686-drop');var raw=e.dataTransfer.getData('application/json');if(!raw)return;var d=JSON.parse(raw),old=new Date(d.start),dateStr=z.dataset.calDate;if(!dateStr||isNaN(old))return;var parts=dateStr.split('-').map(Number),newStart=new Date(old);newStart.setFullYear(parts[0],parts[1]-1,parts[2]);if(z.classList.contains('v152-daybody')){var rect=z.getBoundingClientRect(),mins=Math.round((8*60+Math.max(0,e.clientY-rect.top)/48*60)/30)*30;newStart.setHours(Math.floor(mins/60),mins%60,0,0);}try{var path=d.kind==='event'?'/api/agent/calendar/v9':'/api/agent/bookings/v9',body=d.kind==='event'?{action:'move_event',event_id:d.id,starts_at:newStart.toISOString()}:d.kind==='casting'?{action:'move_casting',casting_id:d.id,starts_at:newStart.toISOString()}:{action:'move_booking',booking_id:d.id,starts_at:newStart.toISOString()};await post(path,body);clearCache();toast('✓ '+d.kind+' moved');window.renderCalendar(panel('calendar'));}catch(err){alert(err.message);}});
 });
}
var oldCalendar=window.renderCalendar;
if(oldCalendar){window.renderCalendar=async function(el){var r=await oldCalendar(el);setTimeout(function(){activateCalendarDrag(el);},10);return r;};}

/* ---------- PUBLIC ACTIONS ---------- */
window.VEUX_V1686={
 version:VERSION,
 crmKind:function(k){CRM.kind=k;CRM.page=0;CRM.selected=null;renderCRM();},
 crmSearch:function(q){CRM.q=q;CRM.page=0;clearTimeout(CRM.timer);CRM.timer=setTimeout(function(){renderCRM();},220);},
 crmType:function(v){CRM.type=v;CRM.page=0;renderCRM();},
 crmMarket:function(v){CRM.market=v;CRM.page=0;renderCRM();},
 crmClear:function(){CRM.q='';CRM.type='';CRM.market='';CRM.page=0;renderCRM();},
 crmPage:function(n){CRM.page+=n;renderCRM();},
 crmSelect:function(id){CRM.selected=id;renderCRM();},
 crmOpenContact:function(id){CRM.kind='contacts';CRM.selected=id;CRM.page=0;renderCRM();},
 devSearch:function(q){DEV.q=q;document.querySelectorAll('.v1686-dev-model').forEach(function(x){x.style.display=!q||String(x.dataset.devText||'').includes(String(q).toLowerCase())?'block':'none';});},
 smartGameplan:async function(modelId){if(!modelId){var options=DEV.roster.map(function(m){return '<option value="'+m.id+'">'+esc(m.display_name)+'</option>';}).join('');var x=modal('Build Smart Gameplan','<label class="v1686-field"><span>Model</span><select id="v1686-smart-model"><option value="">Select model…</option>'+options+'</select></label>','<button class="v1686-btn" data-close>Cancel</button><button class="v1686-btn gold" onclick="VEUX_V1686.smartGameplan(document.getElementById(\'v1686-smart-model\').value)">Build Gameplan</button>');return;}try{await post('/api/agent/development/v9',{action:'smart_gameplan',model_id:modelId});var m=document.getElementById('v1686-modal');if(m)m.remove();clearCache();toast('✓ Smart development gameplan updated');renderDevelopment();}catch(e){alert(e.message);}},
 newDevActivity:function(modelId){var body=select('Type','v1686-da-type',['runway_training','posing','movement','test_shoot','digitals','portfolio_review','image_grooming','wellness_routine','meeting','other'],'runway_training')+field('Title','v1686-da-title','')+field('Scheduled','v1686-da-date','', 'datetime-local')+textarea('Notes','v1686-da-notes','');modal('Development Activity',body,'<button class="v1686-btn" data-close>Cancel</button><button class="v1686-btn gold" onclick="VEUX_V1686.saveDevActivity(\''+modelId+'\')">Save Activity</button>');},
 saveDevActivity:async function(modelId){try{var out=await post('/api/agent/development/v9',{action:'create_activity',model_id:modelId,activity_type:val('v1686-da-type'),title:val('v1686-da-title'),scheduled_at:val('v1686-da-date')||null,notes:val('v1686-da-notes')||null,status:'planned'});if(!out||out.verified!==true)throw new Error('Development activity was not verified as saved.');document.getElementById('v1686-modal')?.remove();clearCache();toast('✓ Development activity added');renderDevelopment();}catch(e){alert(e.message);}},
 goalStatus:async function(id,current){try{var next=/complete/i.test(current)?'in_progress':'complete';var out=await post('/api/agent/development/v9',{action:'goal_status',goal_id:id,status:next});if(!out||out.verified!==true)throw new Error('Development goal update was not verified.');clearCache();renderDevelopment();}catch(e){alert(e.message);}},
 scoutSearch:function(q){SCOUT.q=q;clearTimeout(SCOUT.timer);SCOUT.timer=setTimeout(function(){renderScouting();},220);},
 scoutStage:function(s){SCOUT.stage=s;renderScouting();},
 newProspect:function(){SCOUT.selected=null;modal('New Scouting Prospect',prospectForm({}),'<button class="v1686-btn" data-close>Cancel</button><button class="v1686-btn gold" onclick="VEUX_V1686.saveProspect()">Save Prospect</button>',true);},
 editProspect:function(id){var p=arr(SCOUT.data&&SCOUT.data.prospects).find(function(x){return x.id===id;});if(!p)return;SCOUT.selected=id;modal('Edit Scouting Prospect',prospectForm(p),'<button class="v1686-btn" data-close>Cancel</button><button class="v1686-btn gold" onclick="VEUX_V1686.saveProspect()">Save Changes</button>',true);},
 saveProspect:async function(){try{var out=await post('/api/agent/scouting/v9',prospectPayload());if(!out||out.verified!==true)throw new Error('Scouting record was not verified as saved.');document.getElementById('v1686-modal')?.remove();SCOUT.selected=null;clearCache();toast('✓ Scouting record saved');await renderScouting();if(out.prospect)VEUX_V1686.scoutDetail(out.prospect.id);}catch(e){alert(e.message);}},
 scoutDetail:function(id){var p=arr(SCOUT.data&&SCOUT.data.prospects).find(function(x){return x.id===id;});if(!p)return;SCOUT.selected=id;var q=p.metadata&&p.metadata.questionnaire||{},history=arr(SCOUT.data.stage_history).filter(function(x){return x.prospect_id===id;}).slice(0,12),media=arr(p.scouting_media);var qa=[['Why modeling?',q.why_modeling],['Career goals',q.career_goals],['Experience',q.experience],['Availability',q.availability],['Travel / passport',q.travel_ready],['Strengths',q.strengths],['Growth areas',q.growth_areas]];var body='<div class="v1686-scout-detail"><div class="v1686-scout-hero">'+(media[0]?'<img src="'+esc(media[0].url)+'">':'<div class="v1686-scout-noimg large">◆</div>')+'<div><small>'+esc([p.city,p.country].filter(Boolean).join(', '))+'</small><h2>'+esc(p.display_name)+'</h2><p>'+esc([p.height_display,p.instagram,p.email].filter(Boolean).join(' · '))+'</p>'+badge(p.stage)+'</div></div><div class="v1686-scout-gallery">'+media.map(function(x){return '<img src="'+esc(x.url)+'" alt="">';}).join('')+'<label class="v1686-upload">＋<input id="v1686-scout-files" type="file" accept="image/*" multiple onchange="VEUX_V1686.uploadScout(\''+p.id+'\',this.files)"><span>Upload Images</span></label></div><div class="v1686-scout-qa">'+qa.map(function(x){return '<section><b>'+x[0]+'</b><p>'+esc(x[1]||'Not answered yet.')+'</p></section>';}).join('')+'</div><section class="v1686-scout-history"><header><b>Scouting Timeline</b></header>'+history.map(function(x){return '<div><span>'+date(x.created_at)+'</span><b>'+esc(String(x.from_stage||'new').replaceAll('_',' '))+' → '+esc(String(x.to_stage).replaceAll('_',' '))+'</b><small>'+esc(x.reason||'Stage updated')+'</small></div>';}).join('')+'</section></div>';var foot='<button class="v1686-btn" data-close>Close</button><button class="v1686-btn" onclick="VEUX_V1686.editProspect(\''+id+'\')">Edit</button><select class="v1686-footer-select" onchange="VEUX_V1686.moveScout(\''+id+'\',this.value);this.value=\'\'"><option value="">Move Stage…</option>'+SCOUT_STAGES.map(function(x){return '<option value="'+x+'">'+esc(x.replaceAll('_',' '))+'</option>';}).join('')+'</select>'+(p.stage==='signed'&&!p.converted_model_id?'<button class="v1686-btn gold" onclick="VEUX_V1686.transferScout(\''+id+'\')">Transfer to Board →</button>':p.converted_model_id?'<button class="v1686-btn gold" onclick="VEUX_V1686.openConverted(\''+p.converted_model_id+'\')">Open Model 360 →</button>':'');modal('Scouting Record',body,foot,true);},
 uploadScout:async function(id,files){files=Array.from(files||[]);if(!files.length)return;try{for(const f of files){await uploadScoutingFile(id,f);}toast('✓ '+files.length+' scouting image'+(files.length>1?'s':'')+' uploaded');await loadScout();VEUX_V1686.scoutDetail(id);}catch(e){alert(e.message);}},
 moveScout:async function(id,stage){if(!stage)return;try{var out=await post('/api/agent/scouting/v9',{action:'move_stage',prospect_id:id,stage:stage,reason:'Updated from Scouting Record'});if(!out||out.verified!==true)throw new Error('Scouting stage update was not verified.');document.getElementById('v1686-modal')?.remove();clearCache();toast('✓ Scouting stage updated');await renderScouting();VEUX_V1686.scoutDetail(id);}catch(e){alert(e.message);}},
 transferScout:function(id){var p=arr(SCOUT.data&&SCOUT.data.prospects).find(function(x){return x.id===id;})||{},l=SCOUT.data&&SCOUT.data.lookups||{};var body=select('Market','v1686-t-market',[{value:'',label:'Use scouting market'}].concat(arr(l.markets).map(function(x){return {value:x.id,label:x.name};})),p.target_market_id)+select('Division','v1686-t-division',[{value:'',label:'Use scouting division'}].concat(arr(l.divisions).map(function(x){return {value:x.id,label:x.name};})),p.target_division_id)+select('Board','v1686-t-board',[{value:'',label:'Use scouting board'}].concat(boardOpts(l)),p.boards&&p.boards.id||'')+select('Initial Stage','v1686-t-stage',['development','main_board','new_face'],'development');modal('Transfer Signed Model to Board',body,'<button class="v1686-btn" data-close>Cancel</button><button class="v1686-btn gold" onclick="VEUX_V1686.confirmTransfer(\''+id+'\')">Create Model Record →</button>');},
 confirmTransfer:async function(id){try{var out=await post('/api/agent/scouting/v9',{action:'convert_to_model',prospect_id:id,market_id:val('v1686-t-market')||null,division_id:val('v1686-t-division')||null,board_id:val('v1686-t-board')||null,model_stage:val('v1686-t-stage')||'development'});if(!out||out.verified!==true)throw new Error('Roster transfer was not confirmed as saved.');document.getElementById('v1686-modal')?.remove();clearCache();toast('✓ Signed prospect transferred to roster and verified');await renderScouting();if(out.model&&out.model.id)VEUX_V1686.openConverted(out.model.id);}catch(e){alert(e.message);}},
 openConverted:function(id){window._veuxV10ModelId=id;navTo('modelpage');}
};

window.addEventListener('veux:v15.7-ready',function(){mobileNav();});
window.dispatchEvent(new CustomEvent('veux:v16.8.6-ready',{detail:{version:VERSION}}));
console.info('[VEUX DESK] 16.8.6 mobile + smart talent operations loaded');
})();
