/* DaySilk inside the portal: the original DaySilk platform (its own design, menu and system) opens as the DaySilk page,
   with a slim strip above it that reads today's agency signals (overdue tasks, travelling and visa-locked models, book-outs)
   so the day starts with what the agency needs. The earlier agent agenda stays on the DaySilk Calendar page. */
(function(){
'use strict';
if(window.MDV_DS_EMBED)return;
var classic=window.renderHelm;
var E={host:null,loaded:false,loading:false,chips:null,at:0,ready:false,setup:null,err:''};
function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
function arr(v){return Array.isArray(v)?v:[];}
function mount(){return window.__VEUX_AGENT_MOUNT__==null?(/^\/(?:admin|team)(?:\/|$)/.test(location.pathname)?'/admin':''):window.__VEUX_AGENT_MOUNT__;}
function src(){return mount()+'/daysilk/';}
function bridge(){var b=window.VEUX_AGENT_V4;return b&&b.api?b:null;}
function org(){try{return bridge().state.org.slug||'maison-de-veux';}catch(e){return 'maison-de-veux';}}
function get(p){return bridge().api(p,{method:'GET',headers:{},__fresh:true});}
function go(page){if(typeof window.navTo==='function')window.navTo(page);}

function myId(){try{var s=bridge().state;return (s.user&&s.user.id)||(s.session&&s.session.user&&s.session.user.id)||null;}catch(e){return null;}}
function dayKey(d){d=new Date(d);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
async function signals(){
  var b=bridge();if(!b)return [];
  var o=encodeURIComponent(org()),t=Date.now(),out=[];
  var res=await Promise.all([get('/api/agent/tasks/v11?organization='+o+'&_t='+t).catch(function(){return null;}),get('/api/agent/mobility?organization='+o+'&_t='+t).catch(function(){return null;}),get('/api/agent/daysilk?organization='+o+'&_t='+t).catch(function(){return null;})]);
  var tasks=res[0],mob=res[1],ds=res[2],today=dayKey(new Date()),now=new Date();
  if(tasks){
    var me=myId(),mem=arr(tasks.members).filter(function(m){return m.user_id&&m.user_id===me;})[0],ids=mem?arr(tasks.assignments||[]).filter(function(a){return a.member_id===mem.id;}).map(function(a){return a.task_id;}):null;
    var open=arr(tasks.tasks).filter(function(x){return !x.parent_task_id&&!/^(completed|done|complete|cancelled|canceled)$/i.test(String(x.status||'open'));});
    var mine=mem?open.filter(function(x){return arr(x.assignments).some(function(a){return a.member_id===mem.id;})||(ids&&ids.indexOf(x.id)>-1);}):open;
    var over=mine.filter(function(x){return x.due_at&&dayKey(x.due_at)<today;}).length;
    out.push({t:over?'bad':'ok',x:over?over+' overdue task'+(over===1?'':'s'):'No overdue tasks',go:'tasksconsolidated'});
  }
  if(mob){
    var travelling=0,locked=0;
    arr(mob.travel).forEach(function(tr){
      if(!tr.starts_at||/^(cancelled|completed)$/i.test(String(tr.status||'')))return;
      var s=new Date(tr.starts_at),e=tr.ends_at?new Date(tr.ends_at):s,d0=new Date(now);d0.setHours(0,0,0,0);var d1=new Date(d0.getTime()+864e5);
      if(s<d1&&e>=d0)travelling++;
      var days=(s-now)/864e5;if(tr.visa_gate&&tr.visa_gate.blocking&&days<=21&&days>=-1)locked++;
    });
    out.push({t:travelling?'warn':'',x:travelling+' model'+(travelling===1?'':'s')+' travelling today',go:'globalmobility'});
    if(locked)out.push({t:'bad',x:locked+' trip'+(locked===1?'':'s')+' locked by visa',go:'visa'});
  }
  if(ds){
    var d0=new Date();d0.setHours(0,0,0,0);var d1=new Date(d0.getTime()+864e5),seen={};
    arr(ds.blocks).forEach(function(bk){var s=new Date(bk.starts_at),e=new Date(bk.ends_at);if(s<d1&&e>=d0)seen[bk.model_id]=1;});
    var n=Object.keys(seen).length;if(n)out.push({t:'',x:n+' model'+(n===1?'':'s')+' booked out today',go:'availability'});
  }
  return out;
}
function chipsHtml(){
  var c=E.chips;
  if(!c||!c.length)return '';
  return c.map(function(x){return '<button type="button" class="dse-c '+esc(x.t)+'" data-dse-go="'+esc(x.go)+'">'+esc(x.x)+'</button>';}).join('');
}
function ensureAccount(){
  if(E.ready||E.setup)return E.setup;
  var b=bridge();if(!b)return null;
  E.setup=b.api('/api/agent/daysilk-account',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({organization_slug:org()})}).then(function(){E.ready=true;E.err='';}).catch(function(e){E.err=(e&&e.message)||'DaySilk could not be set up for your account.';}).then(function(){E.setup=null;paint(true);});
  return E.setup;
}
function frameHtml(){
  if(E.err)return '<div class="dse-note"><b>DaySilk is not ready yet</b><p>'+esc(E.err)+'</p><button type="button" class="dse-b" data-dse-retry="1">Try again</button></div>';
  if(!E.ready)return '<div class="dse-note"><p>Setting up your DaySilk\u2026</p></div>';
  return '<iframe class="dse-f" src="'+esc(src())+'" title="DaySilk" allow="clipboard-write; fullscreen" allowtransparency="true"></iframe>';
}
function paint(force){
  var el=E.host;if(!el)return;
  var chips=el.querySelector('.dse-chips');
  if(chips&&!force){chips.innerHTML=chipsHtml();return;}
  if(chips&&force){chips.innerHTML=chipsHtml();var fr=el.querySelector('.dse-body');if(fr)fr.innerHTML=frameHtml();return;}
  el.innerHTML='<div class="dse"><div class="dse-chips">'+chipsHtml()+'</div><div class="dse-body">'+frameHtml()+'</div></div>';
}
function refresh(force){
  if(E.loading||(!force&&E.chips&&Date.now()-E.at<120000))return;
  E.loading=true;
  signals().then(function(c){E.chips=c;E.at=Date.now();}).catch(function(){E.chips=[];}).then(function(){E.loading=false;paint();});
}
document.addEventListener('click',function(e){
  var h=E.host;if(!h||!h.contains(e.target))return;
  var g=e.target.closest&&e.target.closest('[data-dse-go]');if(g){e.preventDefault();go(g.getAttribute('data-dse-go'));return;}
  var rt=e.target.closest&&e.target.closest('[data-dse-retry]');if(rt){E.err='';E.ready=false;paint(true);ensureAccount();return;}
  var r=e.target.closest&&e.target.closest('[data-dse-reload]');if(r){var f=h.querySelector('.dse-f');if(f)f.src=src();refresh(true);}
});
var FALLBACK=[['command','Command'],['today','Today'],['cal','Calendar'],['tasks','Tasks'],['work','Work'],['team','Team'],['health','Wellness'],['life','Life']];
function frameWin(){var f=E.host&&E.host.querySelector&&E.host.querySelector('.dse-f');try{return f&&f.contentWindow&&f.contentWindow.__dsMenu?f.contentWindow:null;}catch(x){return null;}}
function menu(){var w=frameWin(),list=null;try{list=w?w.__dsMenu():null;}catch(x){}return (list&&list.length?list:FALLBACK.map(function(f){return {k:f[0],l:f[1]};})).filter(function(m){return m.k!=='profile'&&m.k!=='settings';});}
function active(){var w=frameWin();try{return w?w.__dsView():'command';}catch(x){return 'command';}}
/* the top bar's DaySilk tabs drive the app, and the highlighted tab follows what the app is showing */
document.addEventListener('click',function(e){
  var b=e.target.closest&&e.target.closest('#ws-hubbar [data-ds-go]');if(!b)return;
  e.preventDefault();var w=frameWin();if(w){try{w.__dsGo(b.getAttribute('data-ds-go'));}catch(x){}}
  b.parentNode.querySelectorAll('[data-ds-go]').forEach(function(x){x.classList.toggle('on',x===b);});
});
setInterval(function(){
  var bar=document.getElementById('ws-hubbar');if(!bar||!E.host||!document.body.contains(E.host))return;
  var a=active();bar.querySelectorAll('[data-ds-go]').forEach(function(x){x.classList.toggle('on',x.getAttribute('data-ds-go')===a);});
},700);
window.MDV_DS_EMBED={render:function(el){E.host=el;paint();ensureAccount();refresh(false);},classic:classic,src:src,menu:menu,active:active};
/* the DaySilk page is now the original platform; the earlier agent agenda is still the DaySilk Calendar */
window.renderHelm=function(el){return window.MDV_DS_EMBED.render(el);};
})();
