/* CAVYRE / VEUX 16.10.44 — Model Agency Calendar Intelligence
   Industry lifecycle + finance intelligence. Never moves/rewrites model schedule items. */
(function(){
'use strict';
if(window.__CAVYRE_INDUSTRY_161115__)return;window.__CAVYRE_INDUSTRY_161115__=true;
var VERSION='16.11.15',cache=null,syncRan=false,loading=false;
function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]})}
function org(){var s=window.VEUX_AGENT_V4&&VEUX_AGENT_V4.state||{};return s.org&&s.org.slug||'maison-de-veux'}
function money(n){try{return new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(Number(n||0))}catch(e){return '$'+Math.round(Number(n||0)).toLocaleString()}}
async function api(method){var b=window.VEUX_AGENT_V4;if(!b||!b.api)throw new Error('Secure bridge is not ready');return b.api('/api/agent/calendar/intelligence?organization='+encodeURIComponent(org()),{method:method||'GET',body:method==='POST'?JSON.stringify({organization_slug:org()}):undefined,headers:{}})}
function panel(){
 var host=document.getElementById('p-calendar'),cal=host&&host.querySelector('.vx75-calendar');
 if(!cal)return null;
 var p=cal.querySelector('.vx1044-agency-intel');
 if(!p){
   p=document.createElement('section');
   p.className='vx1044-agency-intel vx161115-industry-command cvy-cal-industry-below';
   p.setAttribute('aria-label','Model agency calendar intelligence');
 }
 /* Industry Intelligence belongs AFTER the interactive calendar workspace.
    Vera Model Intelligence remains inside each calendar view's right-side drawer. */
 if(p.parentNode!==cal||p!==cal.lastElementChild)cal.appendChild(p);
 return p;
}
function stageClass(x){return (x.key==='overdue'&&x.count?' hot':'')+(x.count?' live':'')}
function labelAction(a){if(a.kind==='payment')return a.days_overdue>=2?'Agent follow-up':'Payment watch';if(a.kind==='casting')return 'Casting desk';if(a.kind==='booking')return 'Booking desk';if(a.kind==='finance')return 'Finance desk';return 'Review'}
function render(d,msg){cache=d;var p=panel();if(!p)return;p.classList.add('vx161115-industry-command');p.dataset.vx1044Rendered='1';var pipe=d.pipeline||[],f=d.finance||{},acts=d.actions||[];var castingCount=pipe.filter(function(x){return ['casting','gosee','callback'].indexOf(x.key)>=0}).reduce(function(n,x){return n+Number(x.count||0)},0),confirmed=pipe.filter(function(x){return ['confirmed','job'].indexOf(x.key)>=0}).reduce(function(n,x){return n+Number(x.count||0)},0);
 p.innerHTML='<div class="vx1044-head"><div class="vx1044-title"><small>CAVYRE · Model Agency Calendar</small><h3>Industry <em>Intelligence</em></h3></div><div class="vx1044-status"><i></i><span>Live booking + payment logic</span>'+(msg?'<span class="vx1044-toast">'+esc(msg)+'</span>':'')+'<button type="button" class="vx1044-sync" data-vx1044-sync>Run intelligence</button></div></div>'+
 '<div class="vx1044-kpis"><div class="vx1044-kpi"><small>Casting / Go See</small><b>'+castingCount+'</b></div><div class="vx1044-kpi"><small>Confirmed / On Job</small><b>'+confirmed+'</b></div><div class="vx1044-kpi warn"><small>Client Outstanding</small><b>'+money(f.outstanding||0)+'</b></div><div class="vx1044-kpi risk"><small>Past Due</small><b>'+money(f.overdue_total||0)+' · '+Number(f.overdue_count||0)+'</b></div></div>'+
 '<div class="vx1044-pipeline"><div class="vx1044-pipeline-head"><b>Booking Lifecycle</b><span>Casting → Go See → Callback → Option → Confirmed → Job → Finance → Model Paid</span></div><div class="vx1044-stages">'+pipe.map(function(x){return '<div class="vx1044-stage vx161112-stage vx161112-stage-'+esc(x.key||'stage')+stageClass(x)+'" title="'+esc(x.label)+'"><small>'+esc(x.label)+'</small><b>'+Number(x.count||0)+'</b></div>'}).join('')+'</div></div>'+
 '<div class="vx1044-bottom"><div class="vx1044-actions"><h4>Smart Action Queue</h4>'+(acts.length?acts.slice(0,5).map(function(a){return '<div class="vx1044-action '+esc(a.severity||'')+'"><i></i><div><b>'+esc(a.title)+'</b><small>'+esc(a.subtitle||'')+'</small></div><span>'+esc(labelAction(a))+'</span></div>'}).join(''):'<div class="vx1044-clear">No industry or payment actions require attention right now.</div>')+'</div><div class="vx1044-rules"><h4>Agency Automation</h4><div class="vx1044-rule"><i></i><span>Payment status stays connected to the booking lifecycle.</span></div><div class="vx1044-rule"><i></i><span>Models receive an in-portal payment update when a client invoice becomes overdue or paid.</span></div><div class="vx1044-rule"><i></i><span>At 2 days past due, an agent Finance Follow-Up task is created and assigned automatically.</span></div><div class="vx1044-rule"><i></i><span>When that invoice is paid, only the auto-created follow-up task is closed.</span></div><div class="vx1044-rule"><i></i><span>Schedule protection: intelligence never moves or overwrites a model booking, casting, hold, or event.</span></div></div></div>';
 var btn=p.querySelector('[data-vx1044-sync]');if(btn)btn.onclick=function(){sync(btn,true)};
}
async function load(){if(loading)return;loading=true;try{var d=await api('GET');render(d)}catch(e){var p=panel();if(p)p.innerHTML='<div class="vx1044-head"><div class="vx1044-title"><small>CAVYRE · Model Agency Calendar</small><h3>Industry <em>Intelligence</em></h3></div><div class="vx1044-status"><span>Intelligence unavailable · '+esc(e&&e.message||e)+'</span></div></div>'}finally{loading=false}}
async function sync(btn,manual){if(btn){btn.disabled=true;btn.textContent='Syncing…'}try{var d=await api('POST'),s=d.sync||{},bits=[];if(s.tasks_created)bits.push(s.tasks_created+' follow-up task'+(s.tasks_created===1?'':'s'));if(s.model_notifications_created)bits.push(s.model_notifications_created+' model update'+(s.model_notifications_created===1?'':'s'));if(s.tasks_completed)bits.push(s.tasks_completed+' resolved task'+(s.tasks_completed===1?'':'s'));render(d,bits.length?bits.join(' · '):(manual?'Everything current':''))}catch(e){if(manual&&window.toast)window.toast(e&&e.message||String(e),'risk')}finally{if(btn){btn.disabled=false;btn.textContent='Run intelligence'}}}
function mount(){if(window._currentPage!=='calendar')return;var p=panel();if(!p)return;if(!cache)load();else if(p.dataset.vx1044Rendered!=='1')render(cache)}
var obs=new MutationObserver(function(){if(window._currentPage==='calendar')mount()});obs.observe(document.documentElement,{childList:true,subtree:true});
document.addEventListener('click',function(){setTimeout(mount,50)});setTimeout(mount,250);
window.VEUX_MODEL_AGENCY_CALENDAR={version:VERSION,refresh:function(){cache=null;return load()},sync:function(){return sync(null,true)},safety:'no-model-schedule-overwrite'};
window.dispatchEvent(new CustomEvent('veux:v16.10.46-ready',{detail:{version:VERSION,industryLifecycle:true,financeAutomation:true,scheduleMutation:false}}));
})();
