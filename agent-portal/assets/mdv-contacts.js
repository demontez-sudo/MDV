/* Contacts — every company / client contact in one card layout, with one-click email from the portal mailbox.
   Data: the same CRM payload the Companies & Clients page uses (/api/agent/crm/v9). Email: window.MDV_MAIL.emailTo (mdv-mail.js). */
(function(){
'use strict';
var S={host:null,data:null,loading:false,err:'',q:'',type:'all',withEmail:false,view:'company',picked:{},limit:120,prof:null,det:{}};

function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
function arr(v){return Array.isArray(v)?v:[];}
function bridge(){var b=window.VEUX_AGENT_V4;if(!b||!b.api)throw new Error('Secure session is not ready');return b;}
function org(){try{return bridge().state.org.slug||'maison-de-veux';}catch(e){return 'maison-de-veux';}}
function initials(n){return String(n||'?').replace(/[^A-Za-z0-9 ]/g,'').split(/\s+/).filter(Boolean).slice(0,2).map(function(x){return x[0];}).join('').toUpperCase()||'?';}
function place(v){if(v==null)return '';if(typeof v==='string'||typeof v==='number')return String(v);if(Array.isArray(v))return v.map(place).filter(Boolean).join(', ');if(typeof v==='object')return place(v.name||v.city||v.market||v.label||v.code||'');return '';}
var EMAIL=/^[^\s@<>()",;:]+@[^\s@<>()",;:]+\.[A-Za-z]{2,}$/;
function email(c){var e=String(c.email||'').trim();return EMAIL.test(e)?e:'';}

function typeKey(co){var t=String(co&&co.company_type||'other').toLowerCase();if(/designer|brand|fashion/.test(t))return 'fashion';if(/casting/.test(t))return 'casting';if(/agency|management|network|talent/.test(t))return 'agency';if(/photo/.test(t))return 'photographer';if(/media|publication|magazine|press/.test(t))return 'press';if(/stylist/.test(t))return 'stylist';return 'other';}
var TYPES=[['all','All'],['fashion','Brands'],['agency','Agencies'],['casting','Casting'],['press','Press'],['photographer','Photo'],['stylist','Stylists'],['other','Other']];

function companies(){return arr(S.data&&S.data.companies);}
function contacts(){return arr(S.data&&S.data.contacts);}
function companyOf(c){
  var id=c.company_id||(arr(c.company_links).filter(function(l){return l.is_primary;})[0]||arr(c.company_links)[0]||{}).company_id;
  return id?companies().filter(function(x){return x.id===id;})[0]||null:null;
}
function market(c){var m=c.metadata||{};return place(c.market)||place(m.city)||place(m.market)||place(m.country);}

function visible(){
  var q=S.q.trim().toLowerCase();
  return contacts().filter(function(c){
    var co=companyOf(c);
    if(S.type!=='all'&&typeKey(co)!==S.type)return false;
    if(S.withEmail&&!email(c))return false;
    if(!q)return true;
    return [c.display_name,c.role,c.email,c.phone,c.instagram,market(c),co&&co.name].join(' ').toLowerCase().indexOf(q)>=0;
  }).sort(function(a,b){return String(a.display_name||'').localeCompare(String(b.display_name||''));});
}

function card(c){
  var e=email(c),ig=String(c.instagram||(c.metadata&&c.metadata.instagram)||'').replace(/^@/,'').trim(),co=companyOf(c),mk=market(c);
  var inactive=String(c.status||'active').toLowerCase()!=='active';
  return '<article class="ct-card'+(S.picked[c.id]?' picked':'')+(inactive?' off':'')+'">'
    +(e?'<label class="ct-pick" title="Select to email several people at once"><input type="checkbox" data-pick="'+esc(c.id)+'"'+(S.picked[c.id]?' checked':'')+' aria-label="Select '+esc(c.display_name||'contact')+'"><span></span></label>':'')
    +'<div class="ct-top"><span class="ct-av">'+esc(initials(c.display_name))+'</span><div><h3><button type="button" class="ct-link" data-profile="contact:'+esc(c.id)+'">'+esc(c.display_name||'Contact')+'</button></h3><p>'+esc(c.role||'Contact')+(S.view==='az'&&co?' · '+esc(co.name):'')+'</p></div></div>'
    +'<ul class="ct-lines">'
    +(e?'<li><i>✉</i><a class="ct-mail" href="mailto:'+esc(e)+'">'+esc(e)+'</a></li>':'<li class="none"><i>✉</i><span>No email on file</span></li>')
    +(c.phone?'<li><i>☎</i><a href="tel:'+esc(String(c.phone).replace(/[^\d+]/g,''))+'">'+esc(c.phone)+'</a></li>':'')
    +(ig?'<li><i>◎</i><a href="https://instagram.com/'+esc(encodeURIComponent(ig))+'" target="_blank" rel="noopener noreferrer">@'+esc(ig)+'</a></li>':'')
    +(mk?'<li><i>⌖</i><span>'+esc(mk)+'</span></li>':'')
    +'</ul>'
    +'<div class="ct-act">'+(e?'<button type="button" class="ct-btn gold" data-email-to="'+esc(e)+'">✉ Email</button>':'<button type="button" class="ct-btn" disabled>No email</button>')+'</div>'
    +'</article>';
}

function groups(list){
  if(S.view==='az')return [{name:'',co:null,items:list}];
  var map={},order=[];
  list.forEach(function(c){var co=companyOf(c),k=co?co.id:'_none';if(!map[k]){map[k]={name:co?co.name:'Independent contacts',co:co,items:[]};order.push(k);}map[k].items.push(c);});
  return order.map(function(k){return map[k];}).sort(function(a,b){if(!a.co!==!b.co)return a.co?-1:1;return String(a.name).localeCompare(String(b.name));});
}

function paint(){
  var el=S.host;if(!el)return;
  if(S.prof){paintProfile();return;}
  var hadFocus=document.activeElement&&document.activeElement.id==='ct-q',caret=hadFocus?document.activeElement.selectionStart:0;
  var all=contacts(),withMail=all.filter(email).length,list=visible(),shown=list.slice(0,S.limit);
  var pickedIds=Object.keys(S.picked).filter(function(k){return S.picked[k];}),pickedMail=all.filter(function(c){return S.picked[c.id]&&email(c);}).map(email);
  var body;
  if(S.loading&&!S.data)body='<div class="ct-none"><p>Loading contacts…</p></div>';
  else if(S.err)body='<div class="ct-none"><p class="ct-err">'+esc(S.err)+'</p><button type="button" class="ct-btn" data-a="retry">Try again</button></div>';
  else if(!all.length)body='<div class="ct-none"><p>No contacts yet. Add people on the Companies &amp; Clients page and they will appear here.</p></div>';
  else if(!list.length)body='<div class="ct-none"><p>No contacts match these filters.</p></div>';
  else body=groups(shown).map(function(g){
      var mails=g.items.map(email).filter(Boolean);
      return '<section class="ct-group">'+(g.name?'<header><div><h2>'+(g.co?'<button type="button" class="ct-link" data-profile="company:'+esc(g.co.id)+'">'+esc(g.name)+'</button>':esc(g.name))+'</h2><span>'+esc(g.co?String(g.co.company_type||'').replace(/_/g,' '):'')+(g.co?' · ':'')+g.items.length+' contact'+(g.items.length===1?'':'s')+'</span></div>'+(mails.length?'<button type="button" class="ct-btn" data-email-to="'+esc(mails.join(','))+'">✉ Email all ('+mails.length+')</button>':'')+'</header>':'')
        +'<div class="ct-grid">'+g.items.map(card).join('')+'</div></section>';
    }).join('')+(list.length>shown.length?'<div class="ct-more"><button type="button" class="ct-btn" data-a="more">Show '+Math.min(120,list.length-shown.length)+' more · '+(list.length-shown.length)+' not shown</button></div>':'');
  el.innerHTML='<div class="ct">'
    +'<div class="ct-head"><div><span class="ct-eye">CLIENT BOOK</span><h1>Contacts</h1><p>Every company and client contact in one place. Click any email address to write to them from your own mailbox.</p></div>'
    +'<div class="ct-stats"><span><b>'+all.length+'</b>contacts</span><span><b>'+withMail+'</b>with email</span><span><b>'+companies().length+'</b>companies</span></div></div>'
    +'<div class="ct-bar"><label class="ct-search"><span>⌕</span><input id="ct-q" type="search" placeholder="Search name, company, role, email…" value="'+esc(S.q)+'" autocomplete="off"></label>'
    +'<div class="ct-chips" role="tablist">'+TYPES.map(function(t){return '<button type="button" class="'+(S.type===t[0]?'on':'')+'" data-type="'+t[0]+'">'+t[1]+'</button>';}).join('')+'</div>'
    +'<label class="ct-toggle"><input type="checkbox" data-with-email'+(S.withEmail?' checked':'')+'> With email only</label>'
    +'<div class="ct-seg"><button type="button" class="'+(S.view==='company'?'on':'')+'" data-view="company">By company</button><button type="button" class="'+(S.view==='az'?'on':'')+'" data-view="az">A–Z</button></div></div>'
    +body
    +(pickedIds.length?'<div class="ct-dock" role="region" aria-label="Selected contacts"><span><b>'+pickedIds.length+'</b> selected'+(pickedMail.length!==pickedIds.length?' · '+pickedMail.length+' with email':'')+'</span><span class="ct-sp"></span><button type="button" class="ct-btn" data-a="clear">Clear</button><button type="button" class="ct-btn gold" data-a="emailpicked">✉ Email selected'+(pickedMail.length>1?' (Bcc)':'')+'</button></div>':'')
    +'</div>';
  wire(el);
  if(hadFocus){var q=el.querySelector('#ct-q');if(q){q.focus();try{q.setSelectionRange(caret,caret);}catch(e){}}}
}

function wire(el){
  var q=el.querySelector('#ct-q'),t;
  if(q)q.oninput=function(){clearTimeout(t);t=setTimeout(function(){S.q=q.value;S.limit=120;paint();},200);};
  el.querySelectorAll('[data-profile]').forEach(function(b){b.onclick=function(){openProfile(b.dataset.profile);};});
  el.querySelectorAll('[data-type]').forEach(function(b){b.onclick=function(){S.type=b.dataset.type;S.limit=120;paint();};});
  el.querySelectorAll('[data-view]').forEach(function(b){b.onclick=function(){S.view=b.dataset.view;paint();};});
  var we=el.querySelector('[data-with-email]');if(we)we.onchange=function(){S.withEmail=we.checked;S.limit=120;paint();};
  el.querySelectorAll('[data-pick]').forEach(function(b){b.onchange=function(){if(b.checked)S.picked[b.dataset.pick]=true;else delete S.picked[b.dataset.pick];paint();};});
  el.querySelectorAll('[data-a]').forEach(function(b){b.onclick=function(){
    var a=b.dataset.a;
    if(a==='retry'){load(true);return;}
    if(a==='more'){S.limit+=120;paint();return;}
    if(a==='clear'){S.picked={};paint();return;}
    if(a==='emailpicked'){
      var list=contacts().filter(function(c){return S.picked[c.id]&&email(c);}).map(email);
      if(!list.length)return;
      if(window.MDV_MAIL&&window.MDV_MAIL.emailTo)window.MDV_MAIL.emailTo(list);else window.location.href='mailto:?bcc='+encodeURIComponent(list.join(','));
    }
  };});
}


/* ---------- profile pages (company + contact) ---------- */
function shortDate(v){if(!v)return '—';var d=new Date(v);if(isNaN(d))return '—';var days=Math.floor((Date.now()-d)/864e5);return days<=0?'Today':days===1?'1 day ago':days<14?days+' days ago':d.toLocaleDateString([],{month:'short',day:'numeric',year:d.getFullYear()===new Date().getFullYear()?undefined:'numeric'});}
function longDate(v){var d=v?new Date(v):null;return d&&!isNaN(d)?d.toLocaleDateString([],{weekday:'short',month:'short',day:'numeric',year:'numeric'}):'';}
function label(t){return String(t||'').replace(/_/g,' ').replace(/\b\w/g,function(x){return x.toUpperCase();});}
function url(v){v=String(v||'').trim();if(!v)return '';if(!/^https?:\/\//i.test(v))v='https://'+v;try{var u=new URL(v);return /^https?:$/.test(u.protocol)?u.href:'';}catch(e){return '';}}
function handle(v){return String(v||'').replace(/^@/,'').replace(/^https?:\/\/(www\.)?instagram\.com\//i,'').replace(/\/.*$/,'').trim();}
function placeText(a,m){if(typeof a==='string'&&a)return a;a=a&&typeof a==='object'?a:{};return [place(a.street),place(a.city),place(a.country)].filter(Boolean).join(', ')||place(m&&m.markets)||place(m&&m.market)||'';}
function dd(k,v,html){return v?'<div><dt>'+esc(k)+'</dt><dd>'+(html?v:esc(v))+'</dd></div>':'';}
function mailLink(e){return '<a class="ct-mail" href="mailto:'+esc(e)+'">'+esc(e)+'</a>';}

function openProfile(ref){
  var p=String(ref||'').split(':');S.prof={kind:p[0],id:p.slice(1).join(':')};
  paint();window.scrollTo&&window.scrollTo(0,0);
  var co=S.prof.kind==='company'?S.prof.id:(companyOf(contacts().filter(function(c){return c.id===S.prof.id;})[0]||{})||{}).id;
  if(co)loadDetail(co);
}
function closeProfile(){S.prof=null;paint();}
async function loadDetail(coId,force){
  if(!force&&S.det[coId]&&S.det[coId].d)return;
  S.det[coId]={loading:true};paint();
  try{var d=await bridge().api('/api/agent/crm/v9?organization='+encodeURIComponent(org())+'&company_id='+encodeURIComponent(coId)+'&_t='+Date.now(),{method:'GET',headers:{},__fresh:true});S.det[coId]={d:d||{}};}
  catch(e){S.det[coId]={err:(e&&e.message)||'Could not load activity.'};}
  paint();
}
/* After the CRM edit form closes, pull fresh data so the profile reflects the change. */
function afterEdit(){
  var seen=false,n=0,t=setInterval(function(){
    var open=!!document.getElementById('cvycrm55');
    if(open)seen=true;
    if((seen&&!open)||++n>240){clearInterval(t);if(seen){S.det={};(window.MDV_MAIL&&window.MDV_MAIL.crm?window.MDV_MAIL.crm(true):Promise.resolve()).then(function(d){if(d)S.data=d;if(S.prof){var cid=S.prof.kind==='company'?S.prof.id:(companyOf(contacts().filter(function(c){return c.id===S.prof.id;})[0]||{})||{}).id;if(cid)loadDetail(cid,true);}paint();}).catch(function(){});}}
  },500);
}
function crmCall(fn,arg){if(window.CavyreCRM&&window.CavyreCRM[fn]){window.CavyreCRM[fn](arg);afterEdit();}else{window.alert('The record editor is still loading — try again in a moment.');}}
function timeline(list){return list.length?'<ul class="ct-time">'+list.slice(0,12).map(function(x){return '<li><i>◇</i><div><b>'+esc(x.subject||label(x.activity_type)||'Activity')+'</b>'+(x.summary?'<span>'+esc(x.summary)+'</span>':'')+'</div><time>'+esc(shortDate(x.occurred_at))+'</time></li>';}).join('')+'</ul>':'<p class="ct-fine">No activity recorded yet.</p>';}
function peopleList(list,except){
  list=list.filter(function(c){return c.id!==except;});
  return list.length?'<div class="ct-people">'+list.map(function(c){var e=email(c);return '<div class="ct-person"><span class="ct-av">'+esc(initials(c.display_name))+'</span><div><button type="button" class="ct-link" data-profile="contact:'+esc(c.id)+'">'+esc(c.display_name||'Contact')+'</button><small>'+esc(c.role||'Contact')+'</small>'+(e?'<small>'+mailLink(e)+'</small>':'')+'</div>'+(e?'<button type="button" class="ct-btn" data-email-to="'+esc(e)+'">✉</button>':'')+'</div>';}).join('')+'</div>':'<p class="ct-fine">No other contacts yet.</p>';
}
function workList(title,rows,fn){return rows.length?'<section class="ct-sec"><h3>'+esc(title)+' <em>'+rows.length+'</em></h3><ul class="ct-time">'+rows.slice(0,6).map(fn).join('')+'</ul></section>':'';}

function companyProfile(co){
  var rec=S.det[co.id]||{},d=rec.d||{},m=co.metadata||{},people=contacts().filter(function(c){return c.company_id===co.id||arr(c.company_links).some(function(l){return l.company_id===co.id;});});
  var mails=people.map(email).filter(Boolean),ce=EMAIL.test(String(co.email||'').trim())?String(co.email).trim():'',site=url(co.website),ig=handle(m.instagram||co.instagram),li=url(m.linkedin);
  var act=arr(d.activity),bk=arr(d.bookings),ca=arr(d.castings),pk=arr(d.packages);
  var last=act[0]&&act[0].occurred_at,cad=parseInt(String(m.follow_up_cadence||'').replace(/\D/g,''),10)||0,days=last?Math.floor((Date.now()-new Date(last))/864e5):null;
  var vera=!last?'No recorded activity with '+co.name+' yet. A short introduction is the best next step.':(cad&&days>cad)?'Last contact was '+days+' days ago — past the '+cad+'-day follow-up cadence. Time to reach out.':'Last activity '+shortDate(last)+(cad?' · follow-up every '+cad+' days.':'.')+' The relationship is on track.';
  var target=ce||mails[0]||'';
  var specs=arr(co.specialties);
  return '<div class="ct-prof">'
   +'<button type="button" class="ct-back" data-a="back">← All contacts</button>'
   +'<header class="ct-hero"><span class="ct-big sq">'+esc(initials(co.name))+'</span><div class="ct-hero-main"><span class="ct-eye">COMPANY PROFILE</span><h1>'+esc(co.name)+'</h1><p>'+esc(label(co.company_type||'company'))+(placeText(co.address,m)?' · '+esc(placeText(co.address,m)):'')+'</p>'
   +'<div class="ct-tags"><em>'+esc(label(co.status||'active'))+'</em>'+(co.tier?'<em class="gold">Tier '+esc(co.tier)+'</em>':'')+(m.priority&&m.priority!=='Normal'?'<em>'+esc(m.priority)+' priority</em>':'')+'</div></div>'
   +'<div class="ct-hero-act">'+(target?'<button type="button" class="ct-btn gold" data-email-to="'+esc(target)+'">✉ Email'+(ce?'':' '+esc((people.filter(function(c){return email(c)===target;})[0]||{}).display_name||'')) +'</button>':'')
   +(mails.length>1?'<button type="button" class="ct-btn" data-email-to="'+esc(mails.join(','))+'">✉ Email all contacts ('+mails.length+')</button>':'')
   +(co.phone?'<a class="ct-btn" href="tel:'+esc(String(co.phone).replace(/[^\d+]/g,''))+'">☎ Call</a>':'')
   +(site?'<a class="ct-btn" href="'+esc(site)+'" target="_blank" rel="noopener noreferrer">Website ↗</a>':'')
   +'<button type="button" class="ct-btn" data-a="editco" data-id="'+esc(co.id)+'">Edit</button></div></header>'
   +'<div class="ct-kpis"><span><b>'+people.length+'</b>Contacts</span><span><b>'+(rec.d?bk.length:'—')+'</b>Bookings</span><span><b>'+(rec.d?ca.length:'—')+'</b>Castings</span><span><b>'+(rec.d?pk.length:'—')+'</b>Packages</span><span><b>'+(rec.d?esc(last?shortDate(last):'—'):'—')+'</b>Last activity</span></div>'
   +'<div class="ct-cols"><div class="ct-colmain">'
   +'<section class="ct-sec"><h3>About</h3>'+(co.notes?'<p class="ct-notes">'+esc(co.notes)+'</p>':'<p class="ct-fine">No overview yet — use Edit to add one.</p>')
   +'<dl class="ct-dl">'+dd('General email',ce?mailLink(ce):'',true)+dd('Phone',co.phone)+dd('Website',site?'<a href="'+esc(site)+'" target="_blank" rel="noopener noreferrer">'+esc(String(co.website).replace(/^https?:\/\//i,''))+'</a>':'',true)+dd('Instagram',ig?'<a href="https://instagram.com/'+esc(encodeURIComponent(ig))+'" target="_blank" rel="noopener noreferrer">@'+esc(ig)+'</a>':'',true)+dd('LinkedIn',li?'<a href="'+esc(li)+'" target="_blank" rel="noopener noreferrer">Profile ↗</a>':'',true)
   +dd('Markets',place(m.markets)||placeText(co.address,m))+dd('Relationship owner',m.relationship_owner)+dd('How we met',m.source)+dd('Strength',m.relationship_strength)+dd('Follow-up',m.follow_up_cadence)+'</dl>'
   +(specs.length?'<div class="ct-tags spec">'+specs.map(function(x){return '<em>'+esc(x)+'</em>';}).join('')+'</div>':'')+'</section>'
   +'<section class="ct-sec"><h3>People <em>'+people.length+'</em> <button type="button" class="ct-btn sm" data-a="addcontact" data-id="'+esc(co.id)+'">+ Add contact</button></h3>'+peopleList(people)+'</section>'
   +'<section class="ct-sec"><h3>Activity</h3>'+(rec.loading?'<p class="ct-fine">Loading…</p>':rec.err?'<p class="ct-err">'+esc(rec.err)+'</p>':timeline(act))+'</section></div>'
   +'<aside class="ct-colside"><section class="ct-vera"><small>✦ VERA</small><p>'+esc(vera)+'</p>'+(target?'<button type="button" class="ct-btn gold" data-email-to="'+esc(target)+'">✉ Write a follow-up</button>':'')+'</section>'
   +workList('Bookings',bk,function(x){return '<li><i>◉</i><div><b>'+esc(x.title||'Booking')+'</b><span>'+esc(label(x.status))+'</span></div><time>'+esc(longDate(x.starts_at||x.start_at))+'</time></li>';})
   +workList('Castings',ca,function(x){return '<li><i>◉</i><div><b>'+esc(x.title||'Casting')+'</b><span>'+esc(label(x.status))+'</span></div><time>'+esc(longDate(x.starts_at))+'</time></li>';})
   +workList('Packages',pk,function(x){return '<li><i>◈</i><div><b>'+esc(x.title||x.name||'Package')+'</b><span>'+esc(label(x.status))+'</span></div><time>'+esc(shortDate(x.created_at))+'</time></li>';})
   +'</aside></div></div>';
}

function contactProfile(c){
  var co=companyOf(c),e=email(c),m=c.metadata||{},ig=handle(c.instagram||m.instagram),mk=market(c);
  var rec=co?S.det[co.id]||{}:{},d=rec.d||{},colleagues=co?contacts().filter(function(x){return x.company_id===co.id||arr(x.company_links).some(function(l){return l.company_id===co.id;});}):[];
  var mine=arr(d.activity).filter(function(a){return a.contact_id===c.id;}),act=mine.length?mine:arr(d.activity);
  var role=arr(c.company_links).filter(function(l){return co&&l.company_id===co.id;})[0];
  return '<div class="ct-prof">'
   +'<button type="button" class="ct-back" data-a="back">← All contacts</button>'
   +'<header class="ct-hero"><span class="ct-big">'+esc(initials(c.display_name))+'</span><div class="ct-hero-main"><span class="ct-eye">CONTACT PROFILE</span><h1>'+esc(c.display_name||'Contact')+'</h1><p>'+esc(c.role||(role&&role.relationship_role)||'Contact')+(co?' · <button type="button" class="ct-link" data-profile="company:'+esc(co.id)+'">'+esc(co.name)+'</button>':'')+'</p>'
   +'<div class="ct-tags"><em>'+esc(label(c.status||'active'))+'</em>'+(mk?'<em>'+esc(mk)+'</em>':'')+'</div></div>'
   +'<div class="ct-hero-act">'+(e?'<button type="button" class="ct-btn gold" data-email-to="'+esc(e)+'">✉ Email '+esc(String(c.display_name||'').split(' ')[0])+'</button>':'<button type="button" class="ct-btn" disabled>No email on file</button>')
   +(c.phone?'<a class="ct-btn" href="tel:'+esc(String(c.phone).replace(/[^\d+]/g,''))+'">☎ Call</a>':'')
   +(ig?'<a class="ct-btn" href="https://instagram.com/'+esc(encodeURIComponent(ig))+'" target="_blank" rel="noopener noreferrer">Instagram ↗</a>':'')
   +'<button type="button" class="ct-btn" data-a="editcontact" data-id="'+esc(c.id)+'">Edit</button></div></header>'
   +'<div class="ct-cols"><div class="ct-colmain">'
   +'<section class="ct-sec"><h3>Details</h3><dl class="ct-dl">'+dd('Email',e?mailLink(e):'',true)+dd('Phone',c.phone)+dd('Instagram',ig?'<a href="https://instagram.com/'+esc(encodeURIComponent(ig))+'" target="_blank" rel="noopener noreferrer">@'+esc(ig)+'</a>':'',true)+dd('Role',c.role)+dd('Company',co?'<button type="button" class="ct-link" data-profile="company:'+esc(co.id)+'">'+esc(co.name)+'</button>':'Independent',true)+dd('Market',mk)+'</dl></section>'
   +'<section class="ct-sec"><h3>Notes</h3>'+(c.notes?'<p class="ct-notes">'+esc(c.notes)+'</p>':'<p class="ct-fine">No notes yet — use Edit to add some.</p>')+'</section>'
   +(co?'<section class="ct-sec"><h3>'+(mine.length?'Activity':'Company activity')+'</h3>'+(rec.loading?'<p class="ct-fine">Loading…</p>':rec.err?'<p class="ct-err">'+esc(rec.err)+'</p>':timeline(act))+'</section>':'')
   +'</div><aside class="ct-colside">'
   +(co?'<section class="ct-sec"><h3>At '+esc(co.name)+'</h3>'+peopleList(colleagues,c.id)+'</section>':'')
   +'</aside></div></div>';
}

function paintProfile(){
  var el=S.host;if(!el)return;
  var html;
  if(S.prof.kind==='company'){var co=companies().filter(function(x){return x.id===S.prof.id;})[0];html=co?companyProfile(co):null;}
  else{var c=contacts().filter(function(x){return x.id===S.prof.id;})[0];html=c?contactProfile(c):null;}
  el.innerHTML='<div class="ct">'+(html||'<div class="ct-none"><p>That record could not be found.</p><button type="button" class="ct-btn" data-a="back">Back to contacts</button></div>')+'</div>';
  el.querySelectorAll('[data-profile]').forEach(function(b){b.onclick=function(){openProfile(b.dataset.profile);};});
  el.querySelectorAll('[data-a]').forEach(function(b){b.onclick=function(){
    var a=b.dataset.a;
    if(a==='back')closeProfile();
    else if(a==='editco')crmCall('openCompany',b.dataset.id);
    else if(a==='editcontact')crmCall('openContact',b.dataset.id);
    else if(a==='addcontact')crmCall('openContact',b.dataset.id);
  };});
}

async function load(force){
  S.loading=true;S.err='';if(!S.data)paint();
  try{
    S.data=window.MDV_MAIL&&window.MDV_MAIL.crm?await window.MDV_MAIL.crm(force):await bridge().api('/api/agent/crm/v9?organization='+encodeURIComponent(org())+'&_t='+Date.now(),{method:'GET',headers:{},__fresh:true});
  }catch(e){S.err=(e&&e.message)||'Contacts could not be loaded.';}
  S.loading=false;paint();
}

function render(host){S.host=host;S.q='';S.picked={};S.limit=120;S.prof=null;var pend=S.pending;S.pending=null;return load(true).then(function(){if(pend&&!S.err)openProfile(pend);});}
window.renderClientBook=render;
window.MDV_CONTACTS={render:render,state:S,open:function(ref){return openProfile(ref);}};


/* Companies & Clients page: add an "Open profile" shortcut to its side panel. */
(function(){
  var pending=false;
  function inject(){
    pending=false;
    document.querySelectorAll('.cc49-detailhero').forEach(function(h){
      if(h.querySelector('[data-open-profile]'))return;
      var ref='',eb=h.querySelector('[data-cc49-edit]'),cb=h.querySelector('[data-cc49-contact]');
      if(eb)ref='company:'+eb.getAttribute('data-cc49-edit');else if(cb)ref='contact:'+cb.getAttribute('data-cc49-contact');
      if(!ref||/:$/.test(ref))return;
      var b=document.createElement('button');b.type='button';b.setAttribute('data-open-profile',ref);b.className='ct-open';b.textContent='Open profile ↗';
      b.onclick=function(e){e.stopPropagation();S.pending=ref;if(typeof window.navTo==='function')window.navTo('clientbook');};
      var d=h.querySelector('div');(d||h).appendChild(b);
    });
  }
  new MutationObserver(function(){if(!pending){pending=true;setTimeout(inject,200);}}).observe(document.documentElement,{childList:true,subtree:true});
})();

function registerRoute(){
  var map=window.VEUX_V15_ROUTE_RENDERERS;
  if(map&&typeof map==='object'){map.clientbook=function(el){return window.renderClientBook(el);};return true;}
  return false;
}
(function(){var n=0,t=setInterval(function(){if(registerRoute()||++n>120)clearInterval(t);},500);registerRoute();})();
})();
