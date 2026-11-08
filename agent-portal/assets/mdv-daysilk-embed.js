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
/* the owner's own DaySilk (The Rebuild: schedule, models, trips, body) runs on the portal's sign-in; everyone else keeps the business DaySilk */
var OWNERS=['demontez@maisondeveux.com'];
function resolveOwner(){
  if(E.owner!==undefined)return Promise.resolve(E.owner);
  var c=window.VEUX_SUPABASE_CLIENT;
  if(!c||!c.auth||!c.auth.getSession)return Promise.resolve(false);
  return c.auth.getSession().then(function(r){var u=r&&r.data&&r.data.session&&r.data.session.user;E.owner=!!(u&&u.email&&OWNERS.indexOf(String(u.email).toLowerCase())>-1);return E.owner;}).catch(function(){E.owner=false;return false;});
}
function src(){return mount()+(E.owner?'/daysilk/me/':'/daysilk/');}
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
function alertsChip(){
  var on=true;try{on=window.MDV_DS_ALERTS?MDV_DS_ALERTS.state().on:true;}catch(x){}
  return '<button type="button" class="dse-c alerts" data-dse-alerts>'+(on?'\u25cf Smart alerts on':'\u25cb Smart alerts off')+'</button>';
}
function chipsHtml(){
  var c=E.chips;
  if(E.owner)return alertsChip();   /* the owner's DaySilk is only about DaySilk: no agency shortcuts (model travel, portal tasks) above it */
  if(!c||!c.length)return alertsChip();
  return alertsChip()+c.map(function(x){return '<button type="button" class="dse-c '+esc(x.t)+'" data-dse-go="'+esc(x.go)+'">'+esc(x.x)+'</button>';}).join('');
}
/* Portal tasks that are mine, in DaySilk's own task shape, so the portal's Tasks and DaySilk are one list */
var PT={at:0,list:null,busy:null};
function portalTasks(force){
  if(!force&&PT.list&&Date.now()-PT.at<60000)return Promise.resolve(PT.list);
  if(PT.busy)return PT.busy;
  if(!bridge())return Promise.resolve(null);
  PT.busy=get('/api/agent/tasks/v11?organization='+encodeURIComponent(org())+'&_t='+Date.now()).then(function(t){
    var me=myId(),mem=arr(t.members).filter(function(m){return m.user_id&&m.user_id===me;})[0];
    if(!mem)return null;
    var ids={};arr(t.assignments).forEach(function(a){if(a.member_id===mem.id)ids[a.task_id]=1;});
    var all=arr(t.tasks),open=function(x){return !/^(completed|done|complete|cancelled|canceled)$/i.test(String(x.status||'open'));};
    var mine=all.filter(function(x){return !x.parent_task_id&&open(x)&&(ids[x.id]||arr(x.assignments).some(function(a){return a.member_id===mem.id;}));});
    var kids={};all.forEach(function(x){if(x.parent_task_id&&open(x))(kids[x.parent_task_id]=kids[x.parent_task_id]||[]).push(String(x.title||''));});
    var list=mine.map(function(x){
      var d=x.due_at?new Date(x.due_at):null,hh=d&&(d.getHours()||d.getMinutes())?String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0'):'';
      return {id:'pt-'+x.id,title:String(x.title||'Task'),due:d?dayKey(d):'',time:hh,done:false,subs:(kids[x.id]||[]).filter(Boolean),meta:'From the portal'+(x.priority&&x.priority!=='normal'?' \u00b7 '+x.priority:'')};
    }).sort(function(a,b){return (a.due||'9')<(b.due||'9')?-1:(a.due||'9')>(b.due||'9')?1:0;});
    PT.list=list;PT.at=Date.now();return list;
  }).catch(function(){return null;}).then(function(r){PT.busy=null;return r;});
  return PT.busy;
}
function completePortalTask(id){
  var b=bridge();if(!b)return Promise.reject(new Error('Not ready'));
  return b.api('/api/agent/tasks/v11',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({organization_slug:org(),action:'task_status',task_id:String(id),status:'completed'})}).then(function(r){PT.at=0;PT.list=null;return r;});
}
function ensureAccount(){
  if(E.owner){E.ready=true;E.err='';return null;}
  if(E.owner===undefined)return null;
  if(E.ready||E.setup)return E.setup;
  var b=bridge();if(!b)return null;
  E.setup=b.api('/api/agent/daysilk-account',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({organization_slug:org()})}).then(function(){E.ready=true;E.err='';}).catch(function(e){E.err=(e&&e.message)||'DaySilk could not be set up for your account.';}).then(function(){E.setup=null;paint(true);if(E.homeRoot)attach(E.homeRoot);});
  return E.setup;
}
function frameHtml(){
  if(E.err&&!E.owner)return '<div class="dse-note"><b>DaySilk is not ready yet</b><p>'+esc(E.err)+'</p><button type="button" class="dse-b" data-dse-retry="1">Try again</button></div>';
  if(E.owner===undefined||(!E.ready&&!E.owner))return '<div class="dse-note"><p>Setting up your DaySilk\u2026</p></div>';
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
  if(E.owner)return;
  if(E.loading||(!force&&E.chips&&Date.now()-E.at<120000))return;
  E.loading=true;
  signals().then(function(c){E.chips=c;E.at=Date.now();}).catch(function(){E.chips=[];}).then(function(){E.loading=false;paint();});
}
document.addEventListener('click',function(e){
  var h=E.host;if(!h||!h.contains(e.target))return;
  var al=e.target.closest&&e.target.closest('[data-dse-alerts]');if(al){e.preventDefault();try{MDV_DS_ALERTS.settings();}catch(x){}return;}
  var g=e.target.closest&&e.target.closest('[data-dse-go]');if(g){e.preventDefault();go(g.getAttribute('data-dse-go'));return;}
  var rt=e.target.closest&&e.target.closest('[data-dse-retry]');if(rt){E.err='';E.ready=false;paint(true);ensureAccount();return;}
  var r=e.target.closest&&e.target.closest('[data-dse-reload]');if(r){var f=h.querySelector('.dse-f');if(f)f.src=src();refresh(true);}
});
var FALLBACK=[['today','Schedule'],['cal','Calendar'],['tasks','Tasks'],['work','Work'],['team','Team'],['health','Wellness'],['life','Life']];
function frameWin(){var f=E.host&&E.host.querySelector&&E.host.querySelector('.dse-f');try{return f&&f.contentWindow&&f.contentWindow.__dsMenu?f.contentWindow:null;}catch(x){return null;}}
function menu(){var w=frameWin(),list=null;try{list=w?w.__dsMenu():null;}catch(x){}return (list&&list.length?list:FALLBACK.map(function(f){return {k:f[0],l:f[1]};})).filter(function(m){return m.k!=='profile'&&m.k!=='settings'&&m.k!=='command';});}
function active(){var w=frameWin();try{return w?w.__dsView():'today';}catch(x){return 'today';}}
/* the top bar's DaySilk tabs drive the app, and the highlighted tab follows what the app is showing */
/* A DaySilk tab only ever changes the DaySilk page. The click is handled here, first, and no other part of the portal gets to act on it;
   and for a moment afterwards the portal is not allowed to jump to its own Travel or Mobility pages. */
window.addEventListener('click',function(e){
  var b=e.target.closest&&e.target.closest('#ws-hubbar [data-ds-go]');if(!b)return;
  e.preventDefault();e.stopImmediatePropagation();
  E.hold=Date.now()+1200;
  var w=frameWin();if(w){try{w.__dsGo(b.getAttribute('data-ds-go'));}catch(x){}}
  b.parentNode.querySelectorAll('[data-ds-go]').forEach(function(x){x.classList.toggle('on',x===b);});
},true);
function guardNav(){
  var n=window.navTo;if(typeof n!=='function'||n.__dsGuard)return;
  var g=function(p){
    if(E.hold&&Date.now()<E.hold&&/^(travel|globalmobility|mobility|travelvisa|travel-visa)$/i.test(String(p||''))){try{console.warn('[DaySilk] ignored a jump to',p);}catch(x){}return;}
    return n.apply(this,arguments);
  };
  g.__dsGuard=true;g.__cavyreMobilityAlias=!!n.__cavyreMobilityAlias;g.__previous=n;window.navTo=g;   /* the alias layer is already underneath: stops it wrapping on top of us again and again */
}
setInterval(guardNav,500);guardNav();
/* The owner's DaySilk (The Rebuild) is a full page like every other portal page: the frame is as tall as its content and the portal page scrolls.
   It tells us its height; we also tell it which part of it is on screen, so its pop-ups open where you are looking.
   The business DaySilk does not report a height, so it keeps the older fixed frame that scrolls inside. */
function frameEl(){var h=E.host;return h&&h.isConnected&&h.querySelector&&h.querySelector('.dse-f');}
function zoomOf(f){var set=parseFloat(f.style.height)||0,drawn=f.getBoundingClientRect().height,z=(set>50&&drawn>50)?drawn/set:1;return (z<.5||z>1.5)?1:z;}
function fit(){
  var f=frameEl(),on=!!(f&&f.offsetParent!==null),root=document.documentElement,auto=!!E.pageSized;
  var lock=on&&!auto;
  if(root.classList.contains('mdv-ds-lock')!==lock){root.classList.toggle('mdv-ds-lock',lock);if(lock)window.scrollTo(0,0);}
  if(!on)return;
  var rect=f.getBoundingClientRect(),z=zoomOf(f);
  if(auto){
    var minScreen=Math.max(420,window.innerHeight-170),px=Math.round(Math.max(E.pagePx||0,minScreen/z))+'px';
    if(f.style.height!==px)f.style.height=px;
    try{
      var w=f.contentWindow;
      if(w&&w.__dsVis){var vt=Math.max(0,-rect.top)/z,vh=(Math.min(rect.bottom,window.innerHeight)-Math.max(rect.top,0))/z;w.__dsVis(Math.round(vt),Math.round(Math.max(200,vh)));}
    }catch(x){}
    return;
  }
  var top2=rect.top+(window.pageYOffset||0),dk=document.getElementById('ws-dock'),dkTop=window.innerHeight;
  if(dk&&getComputedStyle(dk).display!=='none'){var r=dk.getBoundingClientRect();if(r.height>0)dkTop=r.top;}
  var want=Math.max(420,Math.round(dkTop-top2-12)),px2=Math.round(want/z)+'px';
  if(f.style.height!==px2)f.style.height=px2;
}
function pageSize(px){if(!(px>100))return;E.pageSized=true;E.pagePx=px;fit();}
window.addEventListener('resize',fit);window.addEventListener('scroll',fit,{passive:true,capture:true});
setInterval(fit,400);
setInterval(function(){
  var bar=document.getElementById('ws-hubbar');if(!bar||!E.host||!document.body.contains(E.host))return;
  var a=active();bar.querySelectorAll('[data-ds-go]').forEach(function(x){x.classList.toggle('on',x.getAttribute('data-ds-go')===a);});
},700);
/* Home carries the DaySilk band (Now/Next, Big 3, the three flows, habits); the portal's own Home keeps its day bar and schedule */
function attach(root){
  var h=root&&root.querySelector&&root.querySelector('[data-ws-ds]');if(!h)return;
  E.homeRoot=root;
  if(h.querySelector('iframe')||h.hidden)return;
  if(E.err){h.hidden=true;return;}
  if(E.owner===undefined){resolveOwner().then(function(){attach(root);});return;}
  if(!E.ready){if(!E.setup)ensureAccount();return;}
  h.innerHTML='<iframe class="dse-hf" src="'+esc(src()+'?home=1')+'" title="DaySilk today" allowtransparency="true" scrolling="no"></iframe>';
}
function size(px){if(!(px>20))return;document.querySelectorAll('.dse-hf').forEach(function(f){f.style.height=px+'px';});}
function openView(v,t){
  E.want=v;go('helm');var n=0,iv=setInterval(function(){
    n++;var w=frameWin();
    if(w&&E.host&&E.host.offsetParent!==null){try{w.__dsGo(v,t);}catch(x){}clearInterval(iv);}else if(n>50)clearInterval(iv);
  },150);
}
/* Put events on the owner's own DaySilk calendar (used by "Add to calendar / tasks" in Mail).
   Reads the saved copy, adds the events, saves it back; a DaySilk that is open merges the new events in by itself. */
function addEvents(list){
  list=arr(list).filter(function(x){return x&&x.id&&x.title&&x.d;});
  return resolveOwner().then(function(o){
    if(!o)throw new Error('DaySilk calendar is only set up for the owner account.');
    var c=window.VEUX_SUPABASE_CLIENT;if(!c||!c.from||!c.auth)throw new Error('The portal sign-in is not ready yet. Try again in a moment.');
    return c.auth.getSession().then(function(r){
      var uid=r&&r.data&&r.data.session&&r.data.session.user&&r.data.session.user.id;if(!uid)throw new Error('Sign in again to add to DaySilk.');
      function attempt(n){
        return c.from('rebuild_docs').select('data,updated_at').eq('user_id',uid).eq('doc_id','core').maybeSingle().then(function(q){
          if(q.error)throw q.error;
          if(!q.data)throw new Error('Open DaySilk once first so it can set up your calendar, then try again.');
          var d=q.data.data&&typeof q.data.data==='object'?q.data.data:{},ev=arr(d.events),have={};
          ev.forEach(function(e){have[e.id]=1;});list.forEach(function(x){if(!have[x.id])ev=ev.concat([x]);});
          return c.from('rebuild_docs').update({data:Object.assign({},d,{events:ev}),client_id:'mail-plan'}).eq('user_id',uid).eq('doc_id','core').eq('updated_at',q.data.updated_at).select('updated_at');
        }).then(function(u){
          if(u.error)throw u.error;
          if(!u.data||!u.data.length){if(n<2)return attempt(n+1);throw new Error('DaySilk changed while saving. Try again.');}
          return true;
        });
      }
      return attempt(0);
    });
  });
}
window.MDV_DS_EMBED={render:function(el){E.host=el;var first=E.owner===undefined;paint();resolveOwner().then(function(){if(first)paint(true);ensureAccount();});refresh(false);},classic:classic,src:src,menu:menu,active:active,attach:attach,size:size,pageSize:pageSize,portalTasks:portalTasks,completePortalTask:completePortalTask,addEvents:addEvents,prepare:function(){return resolveOwner().then(function(o){return {owner:!!o,ready:!!(o||E.ready),src:src()};});},   /* never creates an account: a teammate's alerts start once they have opened DaySilk */alertFeed:function(l){try{window.MDV_DS_ALERTS&&MDV_DS_ALERTS.feed(l);}catch(x){}},refreshChips:function(){if(E.host)paint();},hold:function(){E.hold=Date.now()+1200;},open:openView,home:function(){go('overview');}};
/* the DaySilk page is now the original platform; the earlier agent agenda is still the DaySilk Calendar */
var impl=function(el){return window.MDV_DS_EMBED.render(el);};
/* mdv-helm.js may load after this file and assign its own renderHelm; keep ours and remember theirs as the classic agenda */
try{Object.defineProperty(window,'renderHelm',{configurable:true,get:function(){return impl;},set:function(f){if(typeof f==='function')window.MDV_DS_EMBED.classic=f;}});}catch(e){window.renderHelm=impl;}
})();
