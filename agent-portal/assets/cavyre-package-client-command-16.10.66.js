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
 box.innerHTML='<header><div><small>VERA · CLIENT WORKFLOW</small><h3>Package Command</h3><span>Selection → Send → Client Response → Conversion</span></div><button data-go="multipackage">Open Package Library</button></header>'+
 '<div class="vx161066-kpis"><div><small>Packages</small><b>'+s.pk.length+'</b></div><div><small>Drafts</small><b>'+s.drafts.length+'</b></div><div><small>Live / Sent</small><b>'+s.sent.length+'</b></div><div><small>Open Feedback</small><b>'+s.fb.length+'</b></div><div><small>High-Intent Signals</small><b>'+s.hot.length+'</b></div></div>'+
 '<div class="vx161066-flow"><article><small>01 · BUILD</small><b>Create a targeted model selection</b><span>Roster, CRM contacts and model media stay connected.</span></article><i>→</i><article><small>02 · SEND</small><b>Deliver the private package</b><span>Recipient and package activity are recorded.</span></article><i>→</i><article><small>03 · RESPONSE</small><b>Capture client feedback</b><span>Interest becomes a model/client signal.</span></article><i>→</i><article><small>04 · CONVERT</small><b>Move intent into operations</b><span>Casting, option, booking, availability or client note.</span></article></div>'+
 '<div class="vx161066-stream">'+(s.fb.length?s.fb.slice(0,6).map(function(f){return '<article><div><small>CLIENT RESPONSE · '+E(f.feedback_type||'feedback')+'</small><b>'+E((f.packages&&f.packages.title)||'Package')+'</b><span>'+E((f.models&&f.models.display_name)||'Model')+(f.note?' · '+E(f.note):'')+'</span></div><button data-go="multipackage">Convert →</button></article>'}).join(''):(s.expiring.length?'<article><div><small>PACKAGE WATCH</small><b>'+s.expiring.length+' package'+(s.expiring.length===1?'':'s')+' expire within seven days</b><span>Review active selections before links expire.</span></div><button data-go="multipackage">Review →</button></article>':'<article class="clear"><div><small>CLIENT WORKFLOW</small><b>No open package feedback requires conversion.</b></div></article>'))+'</div>';
 host.insertBefore(box,host.firstChild);box.addEventListener('click',function(e){var b=e.target.closest('[data-go]');if(b)nav(b.getAttribute('data-go'))});
 try{sessionStorage.setItem('cavyre.vera.context.packages',JSON.stringify({packages:s.pk.length,drafts:s.drafts.length,live_or_sent:s.sent.length,open_feedback:s.fb.length,high_intent_signals:s.hot.length,expiring_within_7_days:s.expiring.length,feedback:s.fb.slice(0,5).map(function(f){return[(f.packages&&f.packages.title)||'Package',(f.models&&f.models.display_name)||'Model',f.feedback_type||'feedback'].join(' · ')})}));}catch(_e){}
}
function commandHost(){return document.querySelector('#p-command .cnt,#p-agencycommand .cnt,[data-page-root="command"] .cnt,.vx161061-command,.vx161062-relationship')?.parentElement||null}
function run(){var h=commandHost();if(!h||h.querySelector('.vx161066-package-command'))return;get().then(function(d){render(h,d)}).catch(function(){})}
new MutationObserver(function(){setTimeout(run,80)}).observe(document.documentElement,{childList:true,subtree:true});window.addEventListener('veux:page-rendered',function(){setTimeout(run,80)});setInterval(run,2200);setTimeout(run,500);
})();