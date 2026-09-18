/* CAVYRE 16.12.49 — Companies & Clients Relationship Command */
(function(){'use strict';
if(window.__CAVYRE_COMPANIES_CLIENTS_161249__)return;window.__CAVYRE_COMPANIES_CLIENTS_161249__=1;
var S={data:null,intel:null,selected:null,detail:null,query:'',type:'all',market:'all',status:'all',tier:'all',view:'list',tab:'overview',category:'all',loadingPromise:null,intelPromise:null,lastError:null,hostId:null,page:1,pageSize:20,scope:'all',hasContacts:false,hasEmail:false,moreOpen:false,directoryMode:'companies',selectedContact:null};
function E(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]})}
function A(v){return Array.isArray(v)?v:[]}
function bridge(){if(!window.VEUX_AGENT_V4||!VEUX_AGENT_V4.api)throw new Error('CAVYRE secure bridge is not ready');return VEUX_AGENT_V4}
function org(){var s=bridge().state||{};return s.org&&s.org.slug||'maison-de-veux'}
function api(path,opt){return bridge().api(path,opt||{method:'GET',headers:{}})}
function withTimeout(p,ms,label){
  var timer;
  return Promise.race([
    Promise.resolve(p),
    new Promise(function(_,reject){
      timer=setTimeout(function(){reject(new Error((label||'Request')+' timed out'));},ms||6000);
    })
  ]).finally(function(){clearTimeout(timer)});
}

function companies(){return A(S.data&&S.data.companies)} function contacts(){return A(S.data&&S.data.contacts)} function activity(){return A(S.data&&S.data.recent_activity)}
function intel(id){return A(S.intel&&S.intel.company_insights).find(function(x){return x.company_id===id})||{score:0,band:'New',contact_count:0,last_activity_days:null,booking_count:0,package_count:0,next_action:'Build relationship'}}
function typeKey(c){var t=String(c&&c.company_type||'other').toLowerCase();if(/designer|brand|fashion/.test(t))return'fashion';if(/agency|management|network|talent/.test(t))return'agency';if(/casting/.test(t))return'casting';if(/photo/.test(t))return'photographer';if(/media|publication|magazine|press/.test(t))return'press';if(/stylist/.test(t))return'stylist';return'other'}
function typeLabel(c){var t=String(c&&c.company_type||'other').replace(/_/g,' ');return t.replace(/\b\w/g,function(x){return x.toUpperCase()})}
function safePlace(v){if(v==null)return'';if(typeof v==='string'||typeof v==='number')return String(v);if(Array.isArray(v))return v.map(safePlace).filter(Boolean).join(', ');if(typeof v==='object')return safePlace(v.name||v.city||v.market||v.label||v.formatted||v.code||'');return''}
function addr(c){var a=c&&c.address||{},m=c&&c.metadata||{};if(typeof a==='string')return a;var vals=[safePlace(a.city),safePlace(m.city),safePlace(m.market),safePlace(a.country)].filter(Boolean);vals=vals.filter(function(v,i,x){return x.indexOf(v)===i});return vals.slice(0,2).join(', ')||safePlace(m.booking_markets)||safePlace(m.market)||'—'}
function tier(c){return String(c&&c.tier||c&&c.metadata&&c.metadata.priority||'').trim()||'—'}
function initials(n){return String(n||'?').split(/\s+/).filter(Boolean).slice(0,2).map(function(x){return x[0]}).join('').toUpperCase()}
function contactsFor(id){return contacts().filter(function(c){return c.company_id===id||A(c.company_links).some(function(l){return l.company_id===id})})}
function companyForContact(c){var id=c&&c.company_id||(A(c&&c.company_links).find(function(l){return l.is_primary})||A(c&&c.company_links)[0]||{}).company_id;return companies().find(function(x){return x.id===id})||null}
function contactMarket(c){var m=c&&c.metadata||{};return safePlace(c&&c.market)||safePlace(m.city)||safePlace(m.market)||safePlace(m.country)||'—'}
function filteredContacts(){var q=String(S.query||'').trim().toLowerCase();return contacts().filter(function(c){var co=companyForContact(c),hay=[c.display_name,c.role,c.email,c.phone,c.instagram,c.market,c.notes,co&&co.name,JSON.stringify(c.metadata||{})].join(' ').toLowerCase();if(S.hasEmail&&!String(c.email||'').trim())return false;if(S.status!=='all'&&String(c.status||'active').toLowerCase()!==S.status)return false;return !q||hay.includes(q)}).sort(function(a,b){return String(a.display_name||'').localeCompare(String(b.display_name||''))})}
function recentFor(id){return activity().filter(function(a){return a.company_id===id}).slice(0,8)}
function lastActivity(c){var i=intel(c.id);return i.last_activity_days==null?'No activity':(i.last_activity_days===0?'Today':i.last_activity_days+' days ago')}
function selectedCompany(){return companies().find(function(c){return c.id===S.selected})||null}
function categoryCounts(){var o={fashion:0,agency:0,casting:0,photographer:0,press:0,stylist:0,other:0};companies().forEach(function(c){o[typeKey(c)]++});return o}
function scopeMatch(c){
  if(S.scope==='all')return true;
  if(S.scope==='favorites'){
    var m=c.metadata||{},t=String(tier(c)).toLowerCase();
    return m.favorite===true||m.favourite===true||/priority a|tier a/.test(t);
  }
  if(S.scope==='recent'){
    var d=intel(c.id).last_activity_days;
    return d!=null&&Number(d)<=14;
  }
  if(S.scope==='shows'){
    var hay=[c.company_type,c.notes,JSON.stringify(c.metadata||{})].join(' ').toLowerCase();
    return /show|fashion week|runway|event|production/.test(hay);
  }
  return true;
}
function filtered(){
  var q=String(S.query||'').trim().toLowerCase();
  return companies().filter(function(c){
    var tk=typeKey(c),m=addr(c).toLowerCase(),st=String(c.status||'active').toLowerCase(),tr=String(tier(c)).toLowerCase(),cs=contactsFor(c.id);
    var hay=[c.name,c.company_type,addr(c),c.email,c.website,c.notes,JSON.stringify(c.metadata||{}),cs.map(function(x){return [x.display_name,x.role,x.email,x.instagram].join(' ')}).join(' ')].join(' ').toLowerCase();
    return scopeMatch(c)&&
      (S.category==='all'||tk===S.category)&&
      (S.type==='all'||tk===S.type)&&
      (S.market==='all'||m.includes(S.market))&&
      (S.status==='all'||st===S.status)&&
      (S.tier==='all'||tr===S.tier)&&
      (!S.hasContacts||cs.length>0)&&
      (!S.hasEmail||!!String(c.email||'').trim()||cs.some(function(x){return !!String(x.email||'').trim()}))&&
      (!q||hay.includes(q));
  }).sort(function(a,b){return intel(b.id).score-intel(a.id).score||String(a.name).localeCompare(String(b.name))})
}
function directorySwitch(){return '<div class="cc49-directory-switch"><button class="'+(S.directoryMode==='companies'?'on':'')+'" data-cc49-mode="companies">Companies / Clients <b>'+companies().length+'</b></button><button class="'+(S.directoryMode==='contacts'?'on':'')+'" data-cc49-mode="contacts">Professional Contacts <b>'+contacts().length+'</b></button></div>'}
function cats(){var n=categoryCounts(),arr=[['fashion','Fashion Houses','FH'],['agency','Agencies','AG'],['casting','Casting Offices','CO'],['photographer','Photographers','PH'],['press','Publications','PR'],['stylist','Stylists','ST'],['other','Beauty / Other','OT']];return '<div class="cc49-categories">'+arr.map(function(x){return'<button class="cc49-cat '+(S.category===x[0]?'on':'')+' type-'+x[0]+'" data-cc49-cat="'+x[0]+'"><span>'+x[2]+'</span><div><b>'+x[1]+'</b><strong>'+n[x[0]]+'</strong></div><i>→</i></button>'}).join('')+'</div>'}
function subnav(){
  var parts=[
    '<button class="'+(S.scope==='all'&&S.category==='all'?'on':'')+'" data-cc49-scope="all" data-cc49-resetcat="1">ALL</button>',
    '<button class="'+(S.scope==='favorites'?'on':'')+'" data-cc49-scope="favorites">FAVORITES</button>',
    '<button class="'+(S.scope==='recent'?'on':'')+'" data-cc49-scope="recent">RECENT</button>',
    '<button class="'+(S.category==='fashion'&&S.scope==='all'?'on':'')+'" data-cc49-cat="fashion">CLIENTS</button>',
    '<button class="'+(S.category==='casting'&&S.scope==='all'?'on':'')+'" data-cc49-cat="casting">CASTING</button>',
    '<button class="'+(S.scope==='shows'?'on':'')+'" data-cc49-scope="shows">SHOWS</button>',
    '<button class="'+(S.category==='press'&&S.scope==='all'?'on':'')+'" data-cc49-cat="press">PRESS</button>',
    '<button class="'+(S.category==='fashion'&&S.scope==='all'?'on':'')+'" data-cc49-cat="fashion">BRANDS</button>',
    '<button class="'+(S.category==='agency'&&S.scope==='all'?'on':'')+'" data-cc49-cat="agency">AGENCIES</button>',
    '<button class="'+(S.category==='photographer'&&S.scope==='all'?'on':'')+'" data-cc49-cat="photographer">PHOTOGRAPHERS</button>',
    '<button class="'+(S.category==='stylist'&&S.scope==='all'?'on':'')+'" data-cc49-cat="stylist">STYLISTS</button>',
    '<button class="'+(S.category==='other'&&S.scope==='all'?'on':'')+'" data-cc49-cat="other">OTHER</button>'
  ];
  return'<div class="cc49-subnav">'+parts.join('')+'</div>'
}
function toolbar(){var markets=['all'];companies().forEach(function(c){var a=addr(c).split(',')[0].trim().toLowerCase();if(a&&a!=='—'&&!markets.includes(a))markets.push(a)});return'<div class="cc49-toolbar"><div class="cc49-search"><span>⌕</span><input id="cc49-q" value="'+E(S.query)+'" placeholder="Search companies, brands or contacts…"></div><select id="cc49-type"><option value="all">All Types</option><option value="fashion">Fashion Houses / Brands</option><option value="agency">Agencies</option><option value="casting">Casting Offices</option><option value="photographer">Photographers</option><option value="press">Publications</option><option value="stylist">Stylists</option><option value="other">Other</option></select><select id="cc49-market">'+markets.map(function(x){return'<option value="'+E(x)+'" '+(S.market===x?'selected':'')+'>'+(x==='all'?'All Markets':E(x.replace(/\b\w/g,function(c){return c.toUpperCase()})))+'</option>'}).join('')+'</select><select id="cc49-status"><option value="all">All Statuses</option><option value="active">Active</option><option value="prospect">Prospect</option><option value="inactive">Inactive</option></select><select id="cc49-tier"><option value="all">All Tiers</option><option value="priority a">Priority A</option><option value="priority b">Priority B</option><option value="priority c">Priority C</option></select><button class="cc49-morefilter" data-cc49-morefilter>⚙ More Filters</button><div class="cc49-view"><button class="'+(S.view==='list'?'on':'')+'" data-cc49-view="list">☷ List</button><button class="'+(S.view==='grid'?'on':'')+'" data-cc49-view="grid">▦ Grid</button></div></div>'}
function contactFaces(c){var cs=contactsFor(c.id).slice(0,3);return cs.length?'<span class="cc49-faces">'+cs.map(function(x){return'<i title="'+E(x.display_name)+'">'+E(initials(x.display_name))+'</i>'}).join('')+(contactsFor(c.id).length>3?'<em>+'+(contactsFor(c.id).length-3)+'</em>':'')+'</span>':'<span class="cc49-muted">—</span>'}
function activeModels(c){var d=S.detail&&S.detail.company&&S.detail.company.id===c.id?S.detail:null;if(!d)return intel(c.id).booking_count||0;var ids={};A(d.signals).forEach(function(s){if(s.model_id)ids[s.model_id]=1});return Object.keys(ids).length||A(d.bookings).filter(function(b){return /confirmed|booked|active/i.test(b.status||'')}).length}
function table(){
  var all=filtered(),total=all.length,size=Number(S.pageSize||20);
  if(size!==15&&size!==20)size=20;
  var pages=Math.max(1,Math.ceil(total/size));
  if(S.page>pages)S.page=pages;
  if(S.page<1)S.page=1;
  var from=(S.page-1)*size,to=Math.min(from+size,total),list=all.slice(from,to);

  if(S.view==='grid'){
    return'<div class="cc49-grid">'+
      (list.length?list.map(function(c){
        var i=intel(c.id);
        return'<button class="cc49-gridcard '+(S.selected===c.id?'selected':'')+'" data-cc49-company="'+E(c.id)+'">'+
          '<span class="cc49-logo">'+E(initials(c.name))+'</span>'+
          '<h3>'+E(c.name)+'</h3>'+
          '<p>'+E(typeLabel(c))+' · '+E(addr(c))+'</p>'+
          '<div><b>'+i.contact_count+' contacts</b><b>'+i.score+' score</b></div>'+
          '<em>'+E(String(c.status||'active').toUpperCase())+'</em></button>'
      }).join(''):'<div class="cc49-empty">No companies match these filters.</div>')+
      '</div>'+paginationFoot(total,from,to,pages);
  }

  return'<div class="cc49-table">'+
    '<div class="cc49-th"><span></span><span>COMPANY / CLIENT</span><span>TYPE</span><span>MARKETS</span><span>KEY CONTACTS</span><span>ACTIVE MODELS</span><span>STATUS</span><span>LAST ACTIVITY</span><span>ACTIONS</span></div>'+
    (list.length?list.map(function(c){
      var i=intel(c.id),st=String(c.status||'active').toLowerCase();
      return'<button class="cc49-tr '+(S.selected===c.id?'selected':'')+'" data-cc49-company="'+E(c.id)+'">'+
        '<span class="cc49-box"></span>'+
        '<span class="cc49-company"><i>'+E(initials(c.name))+'</i><b>'+E(c.name)+'</b></span>'+
        '<span>'+E(typeLabel(c))+'</span>'+
        '<span>'+E(addr(c))+'</span>'+
        contactFaces(c)+
        '<span class="cc49-models">'+activeModels(c)+'</span>'+
        '<span><em class="cc49-status '+E(st)+'">'+E(st.toUpperCase())+'</em></span>'+
        '<span><b>'+E(lastActivity(c))+'</b><small>'+E(i.next_action||'Relationship activity')+'</small></span>'+
        '<span class="cc49-dots">•••</span></button>'
    }).join(''):'<div class="cc49-empty">No companies match these filters.</div>')+
    '</div>'+paginationFoot(total,from,to,pages)
}
function paginationFoot(total,from,to,pages){
  var nums=[],start=Math.max(1,S.page-2),end=Math.min(pages,start+4);
  start=Math.max(1,end-4);
  for(var n=start;n<=end;n++)nums.push(n);
  return'<div class="cc49-foot">'+
    '<div class="cc49-foot-info"><span>Showing '+(total?from+1:0)+'–'+to+' of '+total+'</span>'+
    '<label>Rows <select id="cc49-pagesize"><option value="15" '+(Number(S.pageSize)===15?'selected':'')+'>15</option><option value="20" '+(Number(S.pageSize)!==15?'selected':'')+'>20</option></select></label></div>'+
    '<div class="cc49-pages">'+
      '<button data-cc49-page="prev" '+(S.page<=1?'disabled':'')+'>‹ Prev</button>'+
      nums.map(function(n){return'<button class="'+(n===S.page?'on':'')+'" data-cc49-page="'+n+'">'+n+'</button>'}).join('')+
      '<button data-cc49-page="next" '+(S.page>=pages?'disabled':'')+'>Next ›</button>'+
    '</div></div>'
}
function contactsTable(){var all=filteredContacts(),total=all.length,size=Number(S.pageSize||20),pages=Math.max(1,Math.ceil(total/size));if(S.page>pages)S.page=pages;if(S.page<1)S.page=1;var from=(S.page-1)*size,to=Math.min(from+size,total),list=all.slice(from,to);return '<div class="cc49-contact-table"><div class="cc49-contact-th"><span>CONTACT</span><span>ROLE</span><span>COMPANY</span><span>MARKET</span><span>EMAIL</span><span>STATUS</span><span></span></div>'+(list.length?list.map(function(c){var co=companyForContact(c),st=String(c.status||'active').toLowerCase();return '<button class="cc49-contact-row '+(S.selectedContact===c.id?'selected':'')+'" data-cc49-opencontact="'+E(c.id)+'"><span class="cc49-contact-person"><i>'+E(initials(c.display_name))+'</i><b>'+E(c.display_name||'Contact')+'</b></span><span>'+E(c.role||'—')+'</span><span>'+E(co&&co.name||'Independent')+'</span><span>'+E(contactMarket(c))+'</span><span class="cc49-contact-email">'+E(c.email||'—')+'</span><span><em class="cc49-status '+E(st)+'">'+E(st.toUpperCase())+'</em></span><span>›</span></button>'}).join(''):'<div class="cc49-empty">No contacts match these filters.</div>')+'</div>'+paginationFoot(total,from,to,pages)}
function contactDetail(){var c=contacts().find(function(x){return x.id===S.selectedContact});if(!c)return '<aside class="cc49-detail"><div class="cc49-empty">Select a professional contact to open the record.</div></aside>';var co=companyForContact(c),m=c.metadata||{};return '<aside class="cc49-detail cc49-contact-detail"><div class="cc49-detailhero"><span class="cc49-biglogo">'+E(initials(c.display_name))+'</span><div><h2>'+E(c.display_name||'Contact')+'</h2><p>'+E(c.role||'Professional Contact')+'</p></div><button data-cc49-contact="'+E(c.id)+'">•••</button></div><nav><button class="on">OVERVIEW</button></nav><main><section><header>CONTACT</header><div class="cc49-aboutgrid"><span><small>COMPANY</small><b>'+E(co&&co.name||'Independent')+'</b></span><span><small>ROLE</small><b>'+E(c.role||'—')+'</b></span><span><small>EMAIL</small><b>'+E(c.email||'—')+'</b></span><span><small>PHONE</small><b>'+E(c.phone||'—')+'</b></span><span><small>MARKET</small><b>'+E(contactMarket(c))+'</b></span><span><small>INSTAGRAM</small><b>'+E(c.instagram||m.instagram||'—')+'</b></span></div></section><section><header>NOTES</header><p>'+E(c.notes||'No contact notes added yet.')+'</p></section></main><footer><button data-cc49-contact="'+E(c.id)+'">Edit Contact</button>'+(c.email?'<button class="primary" data-cc49-emailcontact="'+E(c.email)+'">Email Contact</button>':'')+'</footer></aside>'}
function detailLoading(c){return'<aside class="cc49-detail"><div class="cc49-detailhero"><span class="cc49-biglogo">'+E(initials(c&&c.name))+'</span><div><h2>'+E(c&&c.name||'Company')+'</h2><p>'+E(typeLabel(c))+' · '+E(addr(c))+'</p></div></div><div class="cc49-detail-loading">Loading relationship intelligence…</div></aside>'}
function detail(){var c=selectedCompany();if(!c)return'<aside class="cc49-detail"><div class="cc49-empty">Select a company to open its relationship record.</div></aside>';if(!S.detail||!S.detail.company||S.detail.company.id!==c.id)return detailLoading(c);var d=S.detail,cs=A(d.contacts),ac=A(d.activity),bk=A(d.bookings),ca=A(d.castings),pk=A(d.packages),sig=A(d.signals),m=c.metadata||{},i=intel(c.id);
var body='';if(S.tab==='overview')body='<section><header>ABOUT <button data-cc49-edit="'+E(c.id)+'">•••</button></header><p>'+E(c.notes||m.about||m.description||'No company overview has been added yet.')+'</p><div class="cc49-aboutgrid"><span><small>MARKETS</small><b>'+E(addr(c))+'</b></span><span><small>TYPE</small><b>'+E(typeLabel(c))+'</b></span><span><small>TIER</small><b>'+E(tier(c))+'</b></span><span><small>WEBSITE</small><b>'+E(c.website||'—')+'</b></span><span><small>STATUS</small><b class="green">● '+E(String(c.status||'active'))+'</b></span><span><small>RELATIONSHIP SCORE</small><b>'+i.score+' · '+E(i.band)+'</b></span></div></section><section><header>KEY CONTACTS <button data-cc49-tab="contacts">View All ('+cs.length+')</button></header>'+(cs.slice(0,3).map(function(x){return'<button class="cc49-contact" data-cc49-contact="'+E(x.id)+'"><i>'+E(initials(x.display_name))+'</i><span><b>'+E(x.display_name)+'</b><small>'+E(x.role||'Professional Contact')+'</small></span><em>✉</em></button>'}).join('')||'<p class="cc49-muted">No contacts connected yet.</p>')+'</section><section><header>RECENT ACTIVITY <button data-cc49-tab="activity">View All</button></header>'+(ac.slice(0,4).map(function(x){return'<div class="cc49-activity"><i>◇</i><span><b>'+E(x.subject||x.activity_type||'Activity')+'</b><small>'+E(x.summary||'')+'</small></span><time>'+E(shortDate(x.occurred_at))+'</time></div>'}).join('')||'<p class="cc49-muted">No recent relationship activity.</p>')+'</section>';
else if(S.tab==='contacts')body='<section><header>CONTACTS <button data-cc49-addcontact="'+E(c.id)+'">+ Add Contact</button></header>'+cs.map(function(x){return'<button class="cc49-contact" data-cc49-contact="'+E(x.id)+'"><i>'+E(initials(x.display_name))+'</i><span><b>'+E(x.display_name)+'</b><small>'+E(x.role||'Professional Contact')+' · '+E(x.email||x.instagram||'')+'</small></span><em>›</em></button>'}).join('')+'</section>';
else if(S.tab==='relationships')body='<section><header>RELATIONSHIP SIGNALS</header><div class="cc49-metrics"><div><b>'+i.score+'</b><span>Relationship score</span></div><div><b>'+cs.length+'</b><span>Contacts</span></div><div><b>'+bk.length+'</b><span>Bookings</span></div><div><b>'+pk.length+'</b><span>Packages</span></div></div></section>';
else if(S.tab==='opportunities')body='<section><header>OPPORTUNITIES</header>'+sig.slice(0,8).map(function(x){return'<div class="cc49-activity"><i>✦</i><span><b>'+E(x.models&&x.models.display_name||'Model signal')+'</b><small>'+E(x.signal_type||x.status||'Client-model signal')+'</small></span><time>'+E(String(x.weighted_score||''))+'</time></div>'}).join('')+(ca.slice(0,5).map(function(x){return'<div class="cc49-activity"><i>◉</i><span><b>'+E(x.title||'Casting')+'</b><small>'+E(x.status||'Casting')+'</small></span><time>'+E(shortDate(x.starts_at))+'</time></div>'}).join('')||'<p class="cc49-muted">No current opportunity signals.</p>')+'</section>';
else body='<section><header>ACTIVITY</header>'+ac.map(function(x){return'<div class="cc49-activity"><i>◇</i><span><b>'+E(x.subject||x.activity_type||'Activity')+'</b><small>'+E(x.summary||x.direction||'')+'</small></span><time>'+E(shortDate(x.occurred_at))+'</time></div>'}).join('')+'</section>';
return'<aside class="cc49-detail"><div class="cc49-detailhero"><span class="cc49-biglogo">'+E(initials(c.name))+'</span><div><h2>'+E(c.name)+'</h2><p>'+E(typeLabel(c))+' · '+E(addr(c))+' <em>'+E(tier(c))+'</em></p></div><button data-cc49-edit="'+E(c.id)+'">•••</button></div><nav>'+[['overview','OVERVIEW'],['contacts','CONTACTS ('+cs.length+')'],['relationships','RELATIONSHIPS'],['opportunities','OPPORTUNITIES'],['activity','ACTIVITY']].map(function(x){return'<button class="'+(S.tab===x[0]?'on':'')+'" data-cc49-tab="'+x[0]+'">'+x[1]+'</button>'}).join('')+'</nav><main>'+body+'</main><footer><button data-cc49-addcontact="'+E(c.id)+'">Add Relationship</button><button data-cc49-opportunity="'+E(c.id)+'">Add Opportunity</button><button class="primary" data-cc49-contactcompany="'+E(c.id)+'">Contact</button></footer></aside>'}
function shortDate(v){if(!v)return'—';try{var d=new Date(v),days=Math.floor((Date.now()-d)/86400000);return days<=0?'Today':days===1?'1 day ago':days<14?days+' days ago':d.toLocaleDateString([],{month:'short',day:'numeric'})}catch(e){return'—'}}
function insight(){var c=selectedCompany();if(!c)return'';var d=S.detail&&S.detail.company&&S.detail.company.id===c.id?S.detail:null,i=intel(c.id),signals=d?A(d.signals):[];var msg=signals.length?c.name+' has '+signals.length+' active client-model signal'+(signals.length===1?'':'s')+'. Review the opportunity set before the next follow-up.':i.next_action||('Relationship score '+i.score+' · '+i.band+'.');return'<div class="cc49-vera"><i>✦</i><small>VERA INSIGHT</small><span>'+E(msg)+'</span><button data-cc49-vera="'+E(c.name)+'">Research / Prepare →</button></div>'}
function activeHost(){
  var ids=['p-industrydirectory','p-companies','p-allcontacts','p-contacts'];
  var current=String(window._currentPage||'').toLowerCase();
  var byCurrent=document.getElementById('p-'+current);
  if(byCurrent&&ids.indexOf(byCurrent.id)>=0)return byCurrent;
  for(var i=0;i<ids.length;i++){var x=document.getElementById(ids[i]);if(x&&(x.classList.contains('on')||x.offsetParent!==null))return x}
  return document.getElementById('p-industrydirectory')||document.getElementById('p-companies')||document.getElementById('p-allcontacts')||document.getElementById('p-contacts')
}
function render(target){var el=target||activeHost();if(!el)return;S.hostId=el.id;var c=selectedCompany();el.innerHTML='<div class="cc49"><header class="cc49-head"><div><small>INDUSTRY RELATIONS</small><h1>'+(S.directoryMode==='contacts'?'Professional Contacts':'Companies &amp; Clients')+'</h1><p>P E O P L E &nbsp;·&nbsp; B R A N D S &nbsp;·&nbsp; O P P O R T U N I T I E S.</p></div><blockquote>“Relationships<br>create runway.”<span>— CAVYRE</span></blockquote><div><button data-cc49-addcompany>＋ Add Company</button><button class="primary" data-cc49-addcontact>＋ Add Contact</button><button data-cc49-moremenu>•••</button></div></header>'+directorySwitch()+(S.directoryMode==='companies'?cats()+subnav():'')+toolbar()+(S.moreOpen?'<div class="cc49-extra"><label><input type="checkbox" id="cc49-hascontacts" '+(S.hasContacts?'checked':'')+'> Has Contacts</label><label><input type="checkbox" id="cc49-hasemail" '+(S.hasEmail?'checked':'')+'> Has Email</label><button data-cc49-clearfilters>Clear All Filters</button></div>':'')+'<div class="cc49-layout"><main>'+(S.directoryMode==='contacts'?contactsTable():table())+'</main>'+(S.directoryMode==='contacts'?contactDetail():detail())+'</div>'+(S.directoryMode==='companies'?insight():'')+'</div>';bind(el);if(S.directoryMode==='companies'&&c&&(!S.detail||!S.detail.company||S.detail.company.id!==c.id))loadDetail(c.id)}
async function loadDetail(id){try{S.detail=await api('/api/agent/crm/v9?organization='+encodeURIComponent(org())+'&company_id='+encodeURIComponent(id),{method:'GET',headers:{}});render(activeHost());revealCompanyDetail()}catch(e){var el=document.querySelector('.cc49-detail-loading');if(el)el.textContent=e.message||'Could not load company detail.'}}
async function load(){
  if(S.data)return S.data;
  if(S.loadingPromise)return S.loadingPromise;

  S.loadingPromise=(async function(){
    try{
      var crm=await withTimeout(
        api('/api/agent/crm/v9?organization='+encodeURIComponent(org())+'&_cavyre_fresh='+Date.now(),{method:'GET',headers:{},__fresh:true}),
        8000,
        'CRM'
      );
      S.data=crm||{};
      S.lastError=null;

      if(!S.selected&&companies().length){
        S.selected=companies().slice().sort(function(a,b){
          return intel(b.id).score-intel(a.id).score||String(a.name||'').localeCompare(String(b.name||''));
        })[0].id;
      }

      render(activeHost());

      if(!S.intelPromise){
        S.intelPromise=withTimeout(
          api('/api/agent/crm/intelligence/v2?organization='+encodeURIComponent(org()),{method:'GET',headers:{}}),
          4500,
          'CRM intelligence'
        ).then(function(x){
          S.intel=x||{};
          render(activeHost());
          return S.intel;
        }).catch(function(e){
          console.warn('[CAVYRE 16.12.55] Optional CRM intelligence skipped:',e&&e.message||e);
          return null;
        }).finally(function(){
          S.intelPromise=null;
        });
      }

      return S.data;
    }catch(e){
      S.lastError=e;
      throw e;
    }finally{
      S.loadingPromise=null;
    }
  })();

  return S.loadingPromise;
}
function revealCompanyDetail(){
  requestAnimationFrame(function(){
    var aside=document.querySelector('.cc49-detail');
    if(!aside)return;
    var main=aside.querySelector('main');
    if(main)main.scrollTop=0;
    var r=aside.getBoundingClientRect();
    if(r.top<82||r.top>window.innerHeight-140){
      try{aside.scrollIntoView({behavior:'smooth',block:'start'});}catch(_e){aside.scrollIntoView(true)}
    }
  })
}
function bind(el){
 el.querySelectorAll('[data-cc49-mode]').forEach(function(b){b.onclick=function(){S.directoryMode=b.dataset.cc49Mode||'companies';S.page=1;S.query='';render(activeHost())}});
 el.querySelectorAll('[data-cc49-opencontact]').forEach(function(b){b.onclick=function(){S.selectedContact=b.dataset.cc49Opencontact;render(activeHost());revealCompanyDetail()}});
 el.querySelectorAll('[data-cc49-emailcontact]').forEach(function(b){b.onclick=function(){location.href='mailto:'+b.dataset.cc49Emailcontact}});
 el.querySelectorAll('[data-cc49-company]').forEach(function(b){b.onclick=function(){
   S.selected=b.dataset.cc49Company;S.detail=null;S.tab='overview';render(activeHost());revealCompanyDetail()
 }});
 el.querySelectorAll('[data-cc49-cat]').forEach(function(b){b.onclick=function(){S.category=b.dataset.cc49Cat;S.scope='all';S.page=1;render(activeHost())}});
 el.querySelectorAll('[data-cc49-scope]').forEach(function(b){b.onclick=function(){S.scope=b.dataset.cc49Scope||'all';if(b.dataset.cc49Resetcat==='1')S.category='all';S.page=1;render(activeHost())}});
 el.querySelectorAll('[data-cc49-view]').forEach(function(b){b.onclick=function(){S.view=b.dataset.cc49View;S.page=1;render(activeHost())}});
 el.querySelectorAll('[data-cc49-tab]').forEach(function(b){b.onclick=function(){S.tab=b.dataset.cc49Tab;render(activeHost())}});
 var q=el.querySelector('#cc49-q');if(q)q.oninput=function(){
   S.query=q.value;S.page=1;
   var main=el.querySelector('.cc49-layout>main');if(main){main.innerHTML=table();bind(el)}
 };
 [['cc49-type','type'],['cc49-market','market'],['cc49-status','status'],['cc49-tier','tier']].forEach(function(x){var n=el.querySelector('#'+x[0]);if(n){n.value=S[x[1]];n.onchange=function(){S[x[1]]=n.value;S.page=1;render(activeHost())}}});
 el.querySelectorAll('[data-cc49-addcompany]').forEach(function(b){b.onclick=function(){if(window.CavyreCRM)CavyreCRM.openCompany()}});
 el.querySelectorAll('[data-cc49-addcontact]').forEach(function(b){b.onclick=function(){if(window.CavyreCRM)CavyreCRM.openContact(S.selected||null)}});
 el.querySelectorAll('[data-cc49-addcontact]').forEach(function(b){b.onclick=function(){if(window.CavyreCRM)CavyreCRM.openContact(b.dataset.cc49Addcontact||S.selected||null)}});
 el.querySelectorAll('[data-cc49-edit]').forEach(function(b){b.onclick=function(){if(window.CavyreCRM)CavyreCRM.openCompany(b.dataset.cc49Edit)}});
 el.querySelectorAll('[data-cc49-contact]').forEach(function(b){b.onclick=function(){if(window.CavyreCRM)CavyreCRM.openContact(b.dataset.cc49Contact)}});
 el.querySelectorAll('[data-cc49-opportunity]').forEach(function(b){b.onclick=function(){if(typeof window.navTo==='function')navTo('multipackage')}});
 el.querySelectorAll('[data-cc49-contactcompany]').forEach(function(b){b.onclick=function(){var c=selectedCompany();if(c&&c.email)location.href='mailto:'+c.email;else if(window.CavyreCRM)CavyreCRM.openContact(c&&c.id)}});
 el.querySelectorAll('[data-cc49-vera]').forEach(function(b){b.onclick=function(){if(window.CAVYRE_VERA_RESEARCH_161247)CAVYRE_VERA_RESEARCH_161247.research(b.dataset.cc49Vera);else if(window.VeraAdvanced) VeraAdvanced.open('Research '+b.dataset.cc49Vera)}})
 el.querySelectorAll('[data-cc49-morefilter]').forEach(function(b){b.onclick=function(){S.moreOpen=!S.moreOpen;render(activeHost())}});
 var hc=el.querySelector('#cc49-hascontacts');if(hc)hc.onchange=function(){S.hasContacts=hc.checked;S.page=1;var main=el.querySelector('.cc49-layout>main');if(main){main.innerHTML=table();bind(el)}};
 var he=el.querySelector('#cc49-hasemail');if(he)he.onchange=function(){S.hasEmail=he.checked;S.page=1;var main=el.querySelector('.cc49-layout>main');if(main){main.innerHTML=table();bind(el)}};
 el.querySelectorAll('[data-cc49-clearfilters]').forEach(function(b){b.onclick=function(){S.query='';S.type='all';S.market='all';S.status='all';S.tier='all';S.category='all';S.scope='all';S.hasContacts=false;S.hasEmail=false;S.page=1;render(activeHost())}});
 el.querySelectorAll('[data-cc49-moremenu]').forEach(function(b){b.onclick=function(){if(window.CAVYRE_VERA_RESEARCH_161247)CAVYRE_VERA_RESEARCH_161247.research('fashion industry clients and relationship opportunities');else if(window.VeraAdvanced&&VeraAdvanced.open)VeraAdvanced.open('Review Companies & Clients relationship opportunities.')}}); 
 var ps=el.querySelector('#cc49-pagesize');if(ps)ps.onchange=function(){S.pageSize=Number(ps.value)||20;S.page=1;render(activeHost())};
 el.querySelectorAll('[data-cc49-page]').forEach(function(b){b.onclick=function(){
   var v=b.dataset.cc49Page;if(v==='prev')S.page=Math.max(1,S.page-1);else if(v==='next')S.page=S.page+1;else S.page=Math.max(1,Number(v)||1);
   render(activeHost());
   var tbl=document.querySelector('.cc49-table,.cc49-grid');if(tbl){try{tbl.scrollIntoView({behavior:'smooth',block:'start'})}catch(_e){}}
 }})
}
function host(){return activeHost()}
function smartRender(el){
  var h=el||host();
  if(!h)return Promise.resolve(null);
  S.hostId=h.id;

  if(S.data){
    render(h);
    return Promise.resolve(S.data);
  }

  if(!h.querySelector('.cc49-loading')){
    h.innerHTML='<div class="cc49-loading" data-cc49-loading="1"><b>Loading Companies & Clients…</b><span>Connecting to CRM</span></div>';
  }

  if(S.loadingPromise)return S.loadingPromise;

  return load().then(function(d){
    render(h);
    return d;
  }).catch(function(e){
    h.innerHTML='<div class="cc49-loading bad" data-cc49-error="1"><b>Companies & Clients could not load.</b><span>'+E(e&&e.message||e)+'</span><button type="button" onclick="CAVYRE_COMPANIES_CLIENTS_161249.retry()">Retry</button></div>';
    return null;
  });
}
function lockName(name){
  try{
    var current=window[name];
    if(current&&current!==smartRender)smartRender.__legacy=current;
    var d=Object.getOwnPropertyDescriptor(window,name);
    if(d&&d.get&&d.get.__cavyreCC161251)return;
    var getter=function(){return smartRender}; getter.__cavyreCC161251=true;
    Object.defineProperty(window,name,{configurable:true,enumerable:true,get:getter,set:function(v){if(v&&v!==smartRender)smartRender.__legacy=v}});
  }catch(_e){window[name]=smartRender}
}
function routeRepair(){
  if(window.VEUX_V15_ROUTE_RENDERERS){
    ['industrydirectory','companies','allcontacts','contacts'].forEach(function(k){window.VEUX_V15_ROUTE_RENDERERS[k]=smartRender});
  }
}
function refreshData(){
  S.data=null;
  S.detail=null;
  S.intel=null;
  S.loadingPromise=null;
  S.intelPromise=null;
  return load().then(function(d){render(activeHost());return d})
}
function takeover(){
  var cp=String(window._currentPage||'').toLowerCase();if(cp==='contacts'||cp==='allcontacts')S.directoryMode='contacts';else if(cp==='industrydirectory'||cp==='companies')S.directoryMode='companies';
  smartRender.__cc161249=true;smartRender.__cc161251=true;
  lockName('renderIndustryDirectory');
  routeRepair();
  if(window.CavyreRelationships){
    CavyreRelationships.refresh=refreshData;
    CavyreRelationships.go=function(v){if(v==='contacts'){S.category='all'}else S.category=v==='agencies'?'agency':v==='companies'?'all':S.category;smartRender(host())};
    CavyreRelationships.search=function(q){S.query=q||'';render(activeHost())};
    CavyreRelationships.companyDetail=function(id){S.selected=id;S.detail=null;S.tab='overview';render(activeHost())};
  }
  document.documentElement.setAttribute('data-cavyre-relationship-layout','16.12.65');
  var h=host();
  if(h&&(h.classList.contains('on')||h.offsetParent!==null)){
    if(!h.querySelector('.cc49,.cc49-loading'))smartRender(h);
  }
  ['p-industrydirectory','p-companies','p-allcontacts','p-contacts'].forEach(function(id){
    var x=document.getElementById(id);
    if(x&&(x.classList.contains('on')||x.offsetParent!==null)&&!x.querySelector('.cc49,.cc49-loading'))smartRender(x);
  });
  return true
}
function install(){return takeover()}
/* 16.12.55 removed document-wide relationship observer to prevent request storms. */
['cavyre:relationships-ready','cavyre:smart-crm-forms-ready','veux:assets-ready','veux:page-rendered','veux:v15.5-ready','veux:agency-v16-ready','veux:shell-ready'].forEach(function(x){window.addEventListener(x,function(){setTimeout(takeover,0)})});
document.addEventListener('click',function(e){
  var b=e.target&&e.target.closest&&e.target.closest('[data-p="industrydirectory"],[data-p="companies"],[data-p="allcontacts"],[data-p="contacts"],[data-page="industrydirectory"],[data-nav="industrydirectory"]');
  if(b)setTimeout(takeover,35);
},true);
setTimeout(install,0);setTimeout(install,350);setTimeout(install,1200);
window.CAVYRE_COMPANIES_CLIENTS_161249={
load:load,render:render,smartRender:smartRender,takeover:takeover,state:S,install:install,
retry:function(){S.data=null;S.intel=null;S.loadingPromise=null;S.intelPromise=null;S.lastError=null;return smartRender(activeHost())},
refresh:refreshData,
upsertVerified:function(kind,record){
  if(!record||!record.id)return false;
  if(!S.data||typeof S.data!=='object')S.data={companies:[],contacts:[]};
  var key=kind==='company'?'companies':'contacts';
  if(!Array.isArray(S.data[key]))S.data[key]=[];
  var id=String(record.id),found=-1;
  for(var i=0;i<S.data[key].length;i++){if(String(S.data[key][i]&&S.data[key][i].id)===id){found=i;break}}
  if(found>=0)S.data[key][found]=Object.assign({},S.data[key][found]||{},record);
  else S.data[key].unshift(record);
  if(kind==='contact'){S.selectedContact=record.id;}
  else {S.selected=record.id;S.detail=null;}
  S.page=1;
  render(activeHost());
  return true;
},
release:'16.12.74'};
})();