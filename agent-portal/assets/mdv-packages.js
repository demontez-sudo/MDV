/* Smart Packaging System: pipeline board, engagement rings, Vera signals and a live package cockpit. */
(function(){
if(window.MDV_PKG)return;
var S={view:'board',q:'',detail:false,el:null,data:null};
function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
function arr(v){return Array.isArray(v)?v:[];}
function dt(v){if(!v)return '—';var d=new Date(v);return isNaN(d)?'—':d.toLocaleDateString([],{month:'short',day:'numeric'});}
function ago(v){if(!v)return null;var d=(Date.now()-new Date(v).getTime())/86400000;return isNaN(d)?null:d;}
function initials(n){return String(n||'?').split(/\s+/).map(function(x){return x[0];}).slice(0,2).join('').toUpperCase();}
var STAGES=[['draft','Draft','Being built'],['sent','Sent','Waiting to be opened'],['viewed','Viewed','Client is looking'],['responded','Responded','Client replied']];
function track(x){return x&&x.tracking||{};}
function stage(x){
  var st=String(x.status||'').toLowerCase(),t=track(x),vs=String(t.view_status||'').toLowerCase();
  if(/archiv|expire|revok/.test(st))return 'closed';
  if(Number(t.response_count||0)>0||vs==='responded')return 'responded';
  if(vs==='viewed'||Number(t.opened_count||0)>0||Number(t.total_views||0)>0)return 'viewed';
  if(st==='draft')return 'draft';
  return 'sent';
}
function score(x){
  var s=stage(x),t=track(x),v=Number(t.total_views||0);
  if(s==='responded')return 100;
  if(s==='viewed')return Math.min(92,50+v*6);
  if(s==='sent')return 25;
  if(s==='draft')return 8;
  return 0;
}
function tone(sc){return sc>=80?'hot':sc>=50?'warm':sc>=20?'cool':'cold';}
function signals(pkgs,openFeedback){
  var out=[],drafts=pkgs.filter(function(x){return stage(x)==='draft';});
  pkgs.forEach(function(x){
    var s=stage(x),t=track(x),age=ago(x.updated_at||x.created_at);
    if(s==='viewed'&&Number(t.total_views||0)>=3)out.push({k:'hot',id:x.id,t:'High intent',d:(x.title||'Package')+' has '+t.total_views+' views and no reply yet. A personal follow-up now is likely to land.',a:'Open'});
    else if(s==='viewed'&&age!=null&&age>=3)out.push({k:'warm',id:x.id,t:'Follow up',d:(x.title||'Package')+' was opened '+Math.floor(age)+' days ago with no response.',a:'Open'});
    else if(s==='sent'&&age!=null&&age>=2)out.push({k:'cold',id:x.id,t:'Not opened',d:(x.title||'Package')+' was sent '+Math.floor(age)+' days ago and has not been opened. Try a different subject line or a text.',a:'Open'});
  });
  if(drafts.length)out.push({k:'draft',id:drafts[0].id,t:drafts.length+' draft'+(drafts.length===1?'':'s')+' ready',d:'Finish and send "'+(drafts[0].title||'Untitled')+'" to start tracking client interest.',a:'Open'});
  if(openFeedback>0)out.push({k:'reply',page:'packageresponses',t:openFeedback+' client response'+(openFeedback===1?'':'s')+' to review',d:'Clients reacted to models in your packages. Convert interest into castings or options.',a:'Review'});
  var rank={hot:0,reply:1,warm:2,cold:3,draft:4};
  return out.sort(function(a,b){return rank[a.k]-rank[b.k];}).slice(0,3);
}
function ring(sc){return '<span class="pk-ring '+tone(sc)+'" style="--p:'+sc+'"><b>'+sc+'</b></span>';}
function cardHtml(x,sel){
  var t=track(x),sc=score(x),meta=[];
  if(t.opened_count)meta.push(t.opened_count+' opened');if(t.total_views)meta.push(t.total_views+' view'+(Number(t.total_views)===1?'':'s'));if(t.response_count)meta.push(t.response_count+' repl'+(Number(t.response_count)===1?'y':'ies'));
  return '<button type="button" class="pk-card'+(sel?' on':'')+'" data-pk="'+esc(x.id)+'" data-pk-text="'+esc((x.title+' '+(x.companies&&x.companies.name||'')).toLowerCase())+'">'+ring(sc)+'<span class="pk-cm"><b>'+esc(x.title||'Untitled package')+'</b><em>'+esc(x.companies&&x.companies.name||'Direct / unassigned')+'</em><small>'+esc(dt(x.updated_at||x.created_at)+(meta.length?' · '+meta.join(' · '):''))+'</small></span></button>';
}
function boardHtml(pkgs,selId){
  var q=S.q.trim().toLowerCase(),cols={draft:[],sent:[],viewed:[],responded:[],closed:[]};
  pkgs.forEach(function(x){var txt=(x.title+' '+(x.companies&&x.companies.name||'')+' '+x.slug).toLowerCase();if(q&&txt.indexOf(q)<0)return;cols[stage(x)].push(x);});
  if(S.view==='list'){
    var all=[].concat(cols.responded,cols.viewed,cols.sent,cols.draft,cols.closed);
    return '<div class="pk-list">'+(all.length?all.map(function(x){var sg=stage(x);return cardHtml(x,x.id===selId).replace('class="pk-card','class="pk-card pk-row')+'';}).join(''):'<p class="pk-none">No packages match.</p>')+'</div>';
  }
  return '<div class="pk-board">'+STAGES.map(function(c){var list=cols[c[0]];return '<section class="pk-col '+c[0]+'"><header><b>'+c[1]+'</b><i>'+list.length+'</i><small>'+c[2]+'</small></header><div class="pk-stack">'+(list.length?list.map(function(x){return cardHtml(x,x.id===selId);}).join(''):'<p class="pk-empty">Nothing here</p>')+'</div></section>';}).join('')+(cols.closed.length?'<section class="pk-col closed"><header><b>Closed</b><i>'+cols.closed.length+'</i><small>Archived / expired</small></header><div class="pk-stack">'+cols.closed.map(function(x){return cardHtml(x,x.id===selId);}).join('')+'</div></section>':'')+'</div>';
}
function stepper(x){
  var cur=stage(x),order=['draft','sent','viewed','responded'],idx=Math.max(0,order.indexOf(cur));
  return '<ol class="pk-steps">'+STAGES.map(function(s,i){return '<li class="'+(i<idx?'done':i===idx?'now':'')+'"><i>'+(i<idx?'✓':i+1)+'</i><span>'+s[1]+'</span></li>';}).join('')+'</ol>';
}
function detailHtml(d,ctx){
  var p=d.package||{};if(!p.id)return '<div class="pk-detail-empty"><i>◇</i><b>Select a package</b><span>See engagement, recipients, models and next best action.</span></div>';
  var models=arr(d.models),recipients=arr(d.recipients),feedback=arr(d.feedback),tr=p.tracking||ctx.list.find(function(x){return x.id===p.id;})||{};
  var lp=ctx.list.find(function(x){return x.id===p.id;})||p,sc=score(lp),sg=stage(lp);
  var opened=recipients.filter(function(r){return r.opened_at||r.first_viewed_at||Number(r.view_count||0)>0;});
  var advice=[];
  if(sg==='draft')advice.push('Add recipients and send it. Drafts have no tracking.');
  if(sg==='sent')advice.push('Sent but not opened. Follow up by message in 24 hours.');
  if(sg==='viewed')advice.push('Client is engaged. Offer a call or a casting slot for the models they viewed most.');
  if(sg==='responded')advice.push('Client replied. Turn their picks into castings or options.');
  if(!models.length)advice.push('No models attached yet.');
  var rn=recipients.map(function(r){var op=r.opened_at||r.first_viewed_at||Number(r.view_count||0)>0,rf=feedback.filter(function(f){return String(f.recipient_id||'')===String(r.id||'');});return '<li><span><b>'+esc(r.display_name||(r.contacts&&r.contacts.display_name)||r.email||'Recipient')+'</b><small>'+esc(r.email||(r.contacts&&r.contacts.email)||'')+'</small></span><em class="'+(rf.length?'resp':op?'view':'sent')+'">'+(rf.length?'Replied':op?'Viewed'+(Number(r.view_count||0)?' · '+r.view_count+'×':''):(r.sent_at?'Sent':'Not sent'))+'</em></li>';}).join('')||'<li class="none">No recipients yet.</li>';
  var mm=models.slice(0,12).map(function(pm){var m=pm.models||pm,media=arr(pm.package_model_media).map(function(x){return x.model_media;}).filter(Boolean),photo=(media.find(function(x){return x&&x.is_primary;})||media[0]||{}).url||pm.image_url||m.image_url;return '<div class="pk-model">'+(photo?'<img src="'+esc(photo)+'" alt="">':'<i>'+esc(initials(m.display_name))+'</i>')+'<b>'+esc(m.display_name||'Model')+'</b><small>'+esc([m.primary_market_label,m.stage].filter(Boolean).join(' · '))+'</small></div>';}).join('')||'<p class="pk-none">No models attached.</p>';
  var fb=feedback.slice(0,4).map(function(f){return '<li><b>'+esc(f.models&&f.models.display_name||f.feedback_type||'Feedback')+'</b><span>'+esc(f.note||f.feedback_type||'')+'</span></li>';}).join('');
  var ready=ctx.ready;
  return '<div class="pk-detail-in"><button type="button" class="pk-back" data-pk-back>← Packages</button><header class="pk-dh">'+ring(sc)+'<div><small>Package cockpit</small><h2>'+esc(p.title||'Package')+'</h2><span>'+esc((lp.companies&&lp.companies.name)||'Direct / unassigned')+' · updated '+esc(dt(p.updated_at))+'</span></div></header>'+stepper(lp)
   +'<div class="pk-actions"><button type="button" class="primary" onclick="VEUX_V155.packageForm(\''+esc(p.id)+'\')">Edit</button><button type="button" '+(ready?'':'disabled title="Email delivery is offline"')+' onclick="VEUX_V155.sendPackage(\''+esc(p.id)+'\',this)">'+(ready?'Send':'Email offline')+'</button><button type="button" onclick="VEUX_V156.duplicatePackage(\''+esc(p.id)+'\')">Duplicate</button><button type="button" onclick="VEUX_V155.archivePackage(\''+esc(p.id)+'\')">Archive</button></div>'
   +'<div class="pk-metrics"><span><b>'+models.length+'</b>Models</span><span><b>'+opened.length+'/'+recipients.length+'</b>Viewed</span><span><b>'+feedback.length+'</b>Replies</span><span><b>'+esc(dt(p.expires_at))+'</b>Expires</span></div>'
   +'<section class="pk-vera"><div><small>✦ Vera</small>'+advice.map(function(a){return '<p>'+esc(a)+'</p>';}).join('')+'</div><button type="button" data-pk-ask="'+esc(p.id)+'">Ask Vera</button></section>'
   +'<h4>Models</h4><div class="pk-models">'+mm+'</div><h4>Recipients</h4><ul class="pk-rec">'+rn+'</ul>'+(fb?'<h4>Client replies</h4><ul class="pk-fb">'+fb+'</ul>':'')+'</div>';
}
function paint(el,data){
  try{
    var list=data.list||{},pkgs=arr(list.packages),dc=list.delivery_config||{},ready=!!(dc.sender_email&&(dc.configured||dc.resend_configured)),d=data.detail||{},p=d.package||{},openFb=arr(list.open_feedback).length;
    S.el=el;S.data=data;
    var sig=signals(pkgs,openFb),total=pkgs.length,live=pkgs.filter(function(x){var s=stage(x);return s==='sent'||s==='viewed'||s==='responded';}).length;
    var h='<div class="mdv-pk">'
     +'<header class="pk-head"><div><small>Model tools · client submissions</small><h1>Smart Packages</h1></div><div class="pk-head-r"><span class="pk-mail '+(ready?'ok':'off')+'" title="'+esc(ready?dc.sender_email:'Email delivery is offline')+'"><i></i>'+(ready?'Email ready':'Email offline')+'</span><button type="button" data-pk-go="packageresponses">Responses'+(openFb?' <b>'+openFb+'</b>':'')+'</button><button type="button" class="primary" onclick="VEUX_V155.packageForm()">+ New package</button></div></header>'
     +'<div class="pk-stats"><span><b>'+total+'</b>Packages</span><span><b>'+live+'</b>Live with clients</span><span><b>'+pkgs.filter(function(x){return stage(x)==='viewed'}).length+'</b>Being viewed</span><span><b>'+openFb+'</b>Need review</span></div>'
     +(sig.length?'<section class="pk-signals"><h3><i>✦</i> Vera signals</h3><div>'+sig.map(function(s){return '<article class="'+s.k+'"><b>'+esc(s.t)+'</b><p>'+esc(s.d)+'</p><button type="button" '+(s.page?'data-pk-go="'+esc(s.page)+'"':'data-pk="'+esc(s.id)+'"')+'>'+esc(s.a)+' →</button></article>';}).join('')+'</div></section>':'')
     +'<div class="pk-bar"><label class="pk-search"><input data-pk-q placeholder="Search packages or clients…" value="'+esc(S.q)+'"><i>⌕</i></label><div class="pk-seg" role="group" aria-label="View"><button type="button" data-pk-view="board" class="'+(S.view==='board'?'on':'')+'">Board</button><button type="button" data-pk-view="list" class="'+(S.view==='list'?'on':'')+'">List</button></div></div>'
     +'<div class="pk-layout'+(S.detail&&p.id?' detail-open':'')+'"><main class="pk-main">'+boardHtml(pkgs,p.id)+'</main><aside class="pk-detail">'+detailHtml(d,{list:pkgs,ready:ready})+'</aside></div></div>';
    el.innerHTML=h;
    bind(el,pkgs);
    if(S.detail&&p.id&&window.matchMedia&&window.matchMedia('(max-width:900px)').matches){S.detail=false;setTimeout(function(){var dd=el.querySelector('.pk-detail');if(dd&&dd.scrollIntoView)dd.scrollIntoView({behavior:'smooth',block:'start'});},80);}
    return true;
  }catch(e){console.warn('[MDV packages]',e);return false;}
}
function bind(el,pkgs){
  var q=el.querySelector('[data-pk-q]');
  if(q)q.oninput=function(){S.q=this.value;var m=el.querySelector('.pk-main');var sel=(S.data&&S.data.detail&&S.data.detail.package&&S.data.detail.package.id)||null;m.innerHTML=boardHtml(pkgs,sel);};
  el.onclick=function(e){
    var b;
    if((b=e.target.closest('[data-pk-view]'))){S.view=b.dataset.pkView;paint(el,S.data);return;}
    if((b=e.target.closest('[data-pk-go]'))){if(window.navTo)navTo(b.dataset.pkGo);return;}
    if(e.target.closest('[data-pk-back]')){S.detail=false;var l=el.querySelector('.pk-layout');if(l)l.classList.remove('detail-open');return;}
    if((b=e.target.closest('[data-pk-ask]'))){var pk=pkgs.find(function(x){return x.id===b.dataset.pkAsk;})||{};if(window.MDV_VERA_CHAT)MDV_VERA_CHAT.open('Review my package "'+(pk.title||'')+'" for '+((pk.companies&&pk.companies.name)||'the client')+'. It is '+stage(pk)+' with '+((pk.tracking&&pk.tracking.total_views)||0)+' views. Suggest the best follow-up and draft a short message.');return;}
    if((b=e.target.closest('[data-pk]'))){S.detail=true;if(window.VEUX_V155&&VEUX_V155.selectPackage)VEUX_V155.selectPackage(b.dataset.pk);return;}
  };
}
window.MDV_PKG={paint:paint};
})();
