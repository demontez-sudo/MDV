/* Contacts — every company / client contact in one card layout, with one-click email from the portal mailbox.
   Data: the same CRM payload the Companies & Clients page uses (/api/agent/crm/v9). Email: window.MDV_MAIL.emailTo (mdv-mail.js). */
(function(){
'use strict';
var S={host:null,data:null,loading:false,err:'',q:'',type:'all',withEmail:false,view:'company',picked:{},limit:120};

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
    +'<div class="ct-top"><span class="ct-av">'+esc(initials(c.display_name))+'</span><div><h3>'+esc(c.display_name||'Contact')+'</h3><p>'+esc(c.role||'Contact')+(S.view==='az'&&co?' · '+esc(co.name):'')+'</p></div></div>'
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
      return '<section class="ct-group">'+(g.name?'<header><div><h2>'+esc(g.name)+'</h2><span>'+esc(g.co?String(g.co.company_type||'').replace(/_/g,' '):'')+(g.co?' · ':'')+g.items.length+' contact'+(g.items.length===1?'':'s')+'</span></div>'+(mails.length?'<button type="button" class="ct-btn" data-email-to="'+esc(mails.join(','))+'">✉ Email all ('+mails.length+')</button>':'')+'</header>':'')
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

async function load(force){
  S.loading=true;S.err='';if(!S.data)paint();
  try{
    S.data=window.MDV_MAIL&&window.MDV_MAIL.crm?await window.MDV_MAIL.crm(force):await bridge().api('/api/agent/crm/v9?organization='+encodeURIComponent(org())+'&_t='+Date.now(),{method:'GET',headers:{},__fresh:true});
  }catch(e){S.err=(e&&e.message)||'Contacts could not be loaded.';}
  S.loading=false;paint();
}

function render(host){S.host=host;S.q='';S.picked={};S.limit=120;return load(true);}
window.renderContacts=render;
window.MDV_CONTACTS={render:render,state:S};

function registerRoute(){
  var map=window.VEUX_V15_ROUTE_RENDERERS;
  if(map&&typeof map==='object'){map.contacts=function(el){return window.renderContacts(el);};return true;}
  return false;
}
(function(){var n=0,t=setInterval(function(){if(registerRoute()||++n>120)clearInterval(t);},500);registerRoute();})();
})();
