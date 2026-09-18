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
 box.addEventListener('click',function(e){var b=e.target.closest('[data-vx161065-nav]');if(!b)return;var dest=b.getAttribute('data-vx161065-nav');var n=document.querySelector('[data-page="'+dest+'"],[data-nav="'+dest+'"]');if(n)n.click();});
 try{sessionStorage.setItem('cavyre.vera.context.model360',JSON.stringify({model:m.name,readiness:x.readiness,signals:x.signals.map(function(s){return s[0]+': '+s[2]}),open_development_goals:x.openGoals.length,open_tasks:x.openTasks.length,travel_records:x.travel.length,visa_cases:x.visa.length}));}catch(_e){}
}
function run(){
 var m=selected(),host=document.getElementById('p-modelpage')||document.querySelector('[data-page-root="modelpage"]');if(!m||!host)return;
 api(m.id).then(function(d){mount(host,d,m)}).catch(function(){});
}
var mo=new MutationObserver(function(){if(document.getElementById('p-modelpage'))setTimeout(run,100)});mo.observe(document.documentElement,{childList:true,subtree:true});
document.addEventListener('click',function(e){if(e.target.closest&&e.target.closest('[data-page="modelpage"],[data-nav="modelpage"],.model-card,.v144-model-card'))setTimeout(run,180)},true);
window.addEventListener('veux:page-rendered',function(e){if(!e.detail||e.detail.page==='modelpage')setTimeout(run,80)});
setInterval(run,1800);setTimeout(run,300);
})();