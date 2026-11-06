/* DaySilk Smart Alerts: tells people what is coming up and when to move on, on every page of the portal.
   A hidden copy of the person's own DaySilk (loaded with ?alerts=1) sends us today's and tomorrow's blocks, appointments and timed tasks.
   We watch the clock and raise a card in the corner: a heads-up before an appointment or deadline, and a "time to transition" before one block hands over to the next.
   Works while the portal is open in a tab (a desktop notification is added when the tab is in the background). Settings live on this device. */
(function(){
'use strict';
if(window.MDV_DS_ALERTS)return;
var KEY='mdv-dsa-settings-v1',LOG='mdv-dsa-log-v1',FIRED='mdv-dsa-fired-v1';
var DEF={on:true,lead:10,trans:3,desktop:true,sound:false,quiet:true,qfrom:'22:30',qto:'06:30'};
var S=readSettings(),feed=[],fired=readFired(),snooze={},frame=null,booted=false,logList=readLog();

function jget(k,d){try{var v=JSON.parse(localStorage.getItem(k)||'null');return v==null?d:v;}catch(e){return d;}}
function jset(k,v){try{localStorage.setItem(k,JSON.stringify(v));}catch(e){}}
function readSettings(){var s=jget(KEY,{}),o={};for(var k in DEF)o[k]=s[k]!==undefined?s[k]:DEF[k];return o;}
function readFired(){var f=jget(FIRED,{}),d=dayKey(new Date()),o={};for(var k in f){if(f[k]>=Date.now()-36*3600e3)o[k]=f[k];}return o;}
function readLog(){return jget(LOG,[]);}
function save(){jset(KEY,S);}
function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
function dayKey(d){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
function clock(ms){var d=new Date(ms),h=d.getHours(),m=d.getMinutes(),ap=h>=12?'PM':'AM';h=h%12||12;return h+':'+String(m).padStart(2,'0')+' '+ap;}
function mins(ms){return Math.max(1,Math.round(ms/60000));}
function inQuiet(now){
  if(!S.quiet)return false;
  var d=new Date(now),cur=d.getHours()*60+d.getMinutes(),a=S.qfrom.split(':'),b=S.qto.split(':'),f=(+a[0])*60+(+a[1]||0),t=(+b[0])*60+(+b[1]||0);
  return f>t?(cur>=f||cur<t):(cur>=f&&cur<t);
}

/* ---- what to say ---- */
function build(it,phase,now){
  if(phase==='soon'){
    var n=mins(it.at-now),kind=it.kind==='task'?'Task due':it.kind==='event'?'Coming up':'First up';
    return {kicker:'Heads up',tone:'soon',title:it.title,body:kind+' in '+n+' min · '+clock(it.at)+(it.tag?' · '+it.tag:'')};
  }
  if(phase==='wrap'){
    var left=Math.max(0,it.end-now),when=left<45000?'now':'in '+mins(left)+' min';
    var nx=it.next&&it.next.at>now-60000?('Next: '+it.next.title+' at '+clock(it.next.at)):'That is the last block of the day. Close the loop.';
    return {kicker:'Time to transition',tone:'wrap',title:'Wrap up '+it.title,body:'Ends '+when+' ('+clock(it.end)+'). '+nx};
  }
  return {kicker:'Starting now',tone:'now',title:it.title,body:clock(it.at)+(it.tag?' · '+it.tag:'')};
}

/* ---- the clock ---- */
function tick(){
  if(!S.on||!feed.length)return;
  var now=Date.now();if(inQuiet(now))return;
  var lead=S.lead*60000,tw=S.trans>0?S.trans*60000:0,out=[];
  feed.forEach(function(it){
    if(snooze[it.id]&&snooze[it.id]>now)return;
    if(it.kind!=='block'&&lead>0&&now>=it.at-lead&&now<it.at-30000)out.push([it,'soon',it.id+'|soon']);
    if(it.kind==='block'&&it.first&&lead>0&&now>=it.at-lead&&now<it.at-30000)out.push([it,'soon',it.id+'|soon']);
    if(it.kind!=='block'&&now>=it.at&&now<it.at+90000)out.push([it,'now',it.id+'|now']);
    if(it.kind==='block'&&S.trans>=0&&it.end){
      var start=S.trans===0?it.end:it.end-tw;
      if(now>=start&&now<it.end+60000)out.push([it,'wrap',it.id+'|wrap']);
    }
  });
  var shown=0;
  out.forEach(function(x){
    var k=x[2];if(fired[k]||shown>=3)return;
    fired[k]=Date.now();shown++;jset(FIRED,fired);
    raise(x[0],x[1],now);
  });
}
function raise(it,phase,now){
  var m=build(it,phase,now),id='a'+Math.random().toString(36).slice(2,8);
  card(id,m,it);record(m);notify(m,it);beep();
}

/* ---- the card in the corner ---- */
function stack(){
  var s=document.getElementById('mdv-dsa');
  if(!s){s=document.createElement('div');s.id='mdv-dsa';s.setAttribute('aria-live','polite');document.body.appendChild(s);}
  return s;
}
function card(id,m,it){
  var el=document.createElement('div');el.className='dsa-card '+m.tone;el.dataset.id=id;
  el.innerHTML='<div class="dsa-k"><i></i>'+esc(m.kicker)+'<button type="button" class="dsa-x" data-dsa-dismiss aria-label="Dismiss">×</button></div>'+
    '<b class="dsa-t">'+esc(m.title)+'</b><p class="dsa-b">'+esc(m.body)+'</p>'+
    '<div class="dsa-a"><button type="button" class="dsa-btn" data-dsa-open>Open DaySilk</button><button type="button" class="dsa-btn" data-dsa-snooze>Snooze 5 min</button><button type="button" class="dsa-btn quiet" data-dsa-settings>Settings</button></div>';
  el._it=it;stack().appendChild(el);
  var kids=stack().children;while(kids.length>4)kids[0].remove();
  setTimeout(function(){if(el.isConnected)el.classList.add('out');setTimeout(function(){el.remove();},400);},m.tone==='wrap'?60000:40000);
}
function record(m){logList.unshift({t:Date.now(),k:m.kicker,title:m.title,body:m.body});logList=logList.slice(0,25);jset(LOG,logList);}
function notify(m,it){
  if(!S.desktop||!('Notification' in window)||Notification.permission!=='granted')return;
  if(!document.hidden)return;                      /* in view: the card is enough */
  var o={body:m.body,tag:'dsa-'+it.id,icon:'/icons/icon-192.png',renotify:false};
  try{
    if(navigator.serviceWorker&&navigator.serviceWorker.getRegistration){
      navigator.serviceWorker.getRegistration().then(function(r){if(r&&r.showNotification)r.showNotification(m.kicker+': '+m.title,o);else new Notification(m.kicker+': '+m.title,o);}).catch(function(){try{new Notification(m.kicker+': '+m.title,o);}catch(e){}});
    }else new Notification(m.kicker+': '+m.title,o);
  }catch(e){}
}
var actx=null;
function beep(){
  if(!S.sound)return;
  try{actx=actx||new (window.AudioContext||window.webkitAudioContext)();var o=actx.createOscillator(),g=actx.createGain();o.type='sine';o.frequency.value=880;g.gain.setValueAtTime(.0001,actx.currentTime);g.gain.exponentialRampToValueAtTime(.12,actx.currentTime+.02);g.gain.exponentialRampToValueAtTime(.0001,actx.currentTime+.5);o.connect(g);g.connect(actx.destination);o.start();o.stop(actx.currentTime+.55);}catch(e){}
}

/* ---- settings ---- */
function opts(list,val){return list.map(function(o){return '<option value="'+o[0]+'"'+(String(o[0])===String(val)?' selected':'')+'>'+o[1]+'</option>';}).join('');}
function perm(){return ('Notification' in window)?Notification.permission:'unsupported';}
function settings(){
  var old=document.getElementById('mdv-dsa-set');if(old)old.remove();
  var p=perm();
  var d=document.createElement('div');d.id='mdv-dsa-set';d.className='dsa-ov';d.setAttribute('role','dialog');d.setAttribute('aria-label','Smart alerts');
  d.innerHTML='<div class="dsa-box"><header><div><h2>Smart alerts</h2><p>Stay in step with your day: a heads-up before things start, and a nudge when it is time to move on.</p></div><button type="button" class="dsa-xx" data-dsa-close aria-label="Close">×</button></header>'+
   '<div class="dsa-body">'+
   '<label class="dsa-row"><span><b>Smart alerts</b><small>Cards appear in the corner of every portal page.</small></span><input type="checkbox" data-s="on"'+(S.on?' checked':'')+'></label>'+
   '<label class="dsa-row"><span><b>Heads-up before appointments and deadlines</b><small>Also before the first block of your day.</small></span><select data-s="lead">'+opts([[0,'Off'],[5,'5 minutes before'],[10,'10 minutes before'],[15,'15 minutes before'],[30,'30 minutes before']],S.lead)+'</select></label>'+
   '<label class="dsa-row"><span><b>Time to transition</b><small>Tells you a block is ending and what comes next.</small></span><select data-s="trans">'+opts([[-1,'Off'],[0,'At the change'],[2,'2 minutes before'],[3,'3 minutes before'],[5,'5 minutes before'],[10,'10 minutes before']],S.trans)+'</select></label>'+
   '<label class="dsa-row"><span><b>Quiet hours</b><small>No alerts between these times.</small></span><span class="dsa-q"><input type="checkbox" data-s="quiet"'+(S.quiet?' checked':'')+'><input type="time" data-s="qfrom" value="'+esc(S.qfrom)+'"> to <input type="time" data-s="qto" value="'+esc(S.qto)+'"></span></label>'+
   '<label class="dsa-row"><span><b>Soft sound</b><small>A short chime with each alert.</small></span><input type="checkbox" data-s="sound"'+(S.sound?' checked':'')+'></label>'+
   '<div class="dsa-row"><span><b>Desktop notifications</b><small>'+(p==='granted'?'On. When the portal is in another tab or window, alerts show on your screen.':p==='denied'?'Blocked in your browser settings. Allow notifications for this site to turn them on.':p==='unsupported'?'This browser cannot show them.':'Get alerts even when the portal is in another tab.')+'</small></span>'+
     (p==='default'?'<button type="button" class="dsa-btn solid" data-dsa-perm>Turn on</button>':'<span class="dsa-tag">'+(p==='granted'?'On':'Off')+'</span>')+'</div>'+
   '<div class="dsa-row"><span><b>Try it</b><small>Sends a sample alert now.</small></span><button type="button" class="dsa-btn" data-dsa-test>Send a test</button></div>'+
   '<p class="dsa-note">Alerts run while the portal is open. For something you must not miss, keep the portal open in a tab.</p>'+
   (logList.length?'<h3>Recent</h3><ul class="dsa-log">'+logList.slice(0,6).map(function(l){return '<li><b>'+esc(l.k)+'</b> '+esc(l.title)+'<small>'+clock(l.t)+'</small></li>';}).join('')+'</ul>':'')+
   '</div></div>';
  document.body.appendChild(d);
}
document.addEventListener('change',function(e){
  var el=e.target;if(!el.matches||!el.matches('#mdv-dsa-set [data-s]'))return;
  var k=el.getAttribute('data-s');S[k]=el.type==='checkbox'?el.checked:(el.tagName==='SELECT'?Number(el.value):el.value);save();
  try{if(window.MDV_DS_EMBED&&MDV_DS_EMBED.refreshChips)MDV_DS_EMBED.refreshChips();}catch(x){}
});
document.addEventListener('click',function(e){
  var t=e.target;if(!t.closest)return;
  var c=t.closest('.dsa-card');
  if(c){
    if(t.closest('[data-dsa-dismiss]')){c.remove();return;}
    if(t.closest('[data-dsa-open]')){c.remove();try{MDV_DS_EMBED.open('today');}catch(x){}return;}
    if(t.closest('[data-dsa-snooze]')){var it=c._it;if(it){snooze[it.id]=Date.now()+5*60000;delete fired[it.id+'|soon'];delete fired[it.id+'|wrap'];delete fired[it.id+'|now'];jset(FIRED,fired);}c.remove();return;}
    if(t.closest('[data-dsa-settings]')){settings();return;}
  }
  if(t.closest('[data-dsa-close]')||t.id==='mdv-dsa-set'){var s=document.getElementById('mdv-dsa-set');if(s)s.remove();return;}
  if(t.closest('[data-dsa-perm]')){
    try{Notification.requestPermission().then(function(){settings();});}catch(x){}return;}
  if(t.closest('[data-dsa-test]')){
    var now=Date.now();raise({id:'test'+now,kind:'block',title:'Your next block',tag:'Sample',at:now+120000,end:now+120000,next:{title:'The block after it',at:now+180000}},'wrap',now);
    return;}
  if(t.closest('[data-dsa-chip]')){settings();}
});
document.addEventListener('keydown',function(e){if(e.key==='Escape'){var s=document.getElementById('mdv-dsa-set');if(s)s.remove();}});

/* ---- the hidden copy of DaySilk that feeds us ---- */
function boot(){
  if(booted)return;
  var E=window.MDV_DS_EMBED,c=window.VEUX_SUPABASE_CLIENT;if(!E||!E.prepare||!c||!c.auth)return;
  c.auth.getSession().then(function(r){
    if(!(r&&r.data&&r.data.session)||booted)return;
    booted=true;
    E.prepare().then(function(info){
      if(!info||!info.src||(!info.owner&&!info.ready))return;
      var f=document.createElement('iframe');f.id='mdv-dsa-frame';f.setAttribute('aria-hidden','true');f.tabIndex=-1;f.title='DaySilk alerts';
      f.src=info.src+'?alerts=1';f.style.cssText='position:fixed;left:-9999px;top:0;width:480px;height:320px;border:0;opacity:0;pointer-events:none';
      document.body.appendChild(f);frame=f;
    }).catch(function(){booted=false;});
  }).catch(function(){});
}
setInterval(function(){if(!booted)boot();},3000);boot();
setInterval(tick,10000);
window.MDV_DS_ALERTS={
  feed:function(list){
    var now=Date.now(),a=(Array.isArray(list)?list:[]).filter(function(x){return x&&x.id&&x.at&&x.at>now-2*3600e3;});
    /* the first block of each day also earns a heads-up */
    var firstByDay={};a.forEach(function(x){if(x.kind==='block'){var k=dayKey(new Date(x.at));if(!firstByDay[k]||x.at<firstByDay[k].at)firstByDay[k]=x;}});
    a.forEach(function(x){if(x.kind==='block'){x.first=firstByDay[dayKey(new Date(x.at))]===x;}});
    feed=a;tick();
  },
  settings:settings,state:function(){return {on:S.on,count:feed.length};},
  test:function(){var b=document.querySelector('[data-dsa-test]');if(b)b.click();}
};
})();
