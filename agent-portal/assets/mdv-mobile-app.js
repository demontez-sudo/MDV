/* Phone app shell: a slim top bar and a five-tab bar (Home, Tasks, Mail, Calendar, Menu). Phone only; the desktop layout is untouched. */
(function(){
if(window.__MDV_APP__)return;window.__MDV_APP__=1;
var MQ=window.matchMedia('(max-width:820px)');
var TABS=[['overview','Home','ti-home-2'],['tasksconsolidated','Tasks','ti-checkbox'],['mail','Mail','ti-mail'],['calendar','Calendar','ti-calendar'],['__menu__','Menu','ti-layout-grid']];
var TITLES={overview:'Home',tasksconsolidated:'Tasks',mail:'Mail',calendar:'Calendar',inbox:'Messages',roster:'Roster',industrydirectory:'Clients',multipackage:'Packages',packageresponses:'Package responses',modelevaluations:'Evaluations',modelsubmissions:'Submissions',scouting:'Scouting',outreach:'Outreach',notes:'Notes',alerts:'Alerts',seasonmanagement:'Season',modeldevelopment:'Development',editorial:'Editorial',globalmobility:'Travel',visa:'Visa & compliance',financelegal:'Finance',modelaccounts:'Model accounts',agentcommissions:'Commissions',team:'Team',filesforms:'Files & forms',systemsettings:'Settings',approvals:'Approvals',escalations:'Escalations',changecontrol:'Change control',availability:'Availability',releaseaudit:'Release audit',dayschedule:'Today',modelpage:'Model',clientbook:'Client',mobility:'Travel'};
var ROOT={overview:1,tasksconsolidated:1,mail:1,calendar:1};
var bar=null,tabs=null,last={};
function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
function pretty(p){return String(p||'').replace(/([a-z])([A-Z])/g,'$1 $2').replace(/[-_]/g,' ').replace(/^./,function(c){return c.toUpperCase();});}
function page(){return String(window._currentPage||'overview');}
function build(){
  if(!bar||!bar.isConnected){
    bar=document.getElementById('mdv-appbar');
    if(!bar){bar=document.createElement('header');bar.id='mdv-appbar';
      bar.innerHTML='<button type="button" class="ab-l" data-ab="left" aria-label="Back"></button><div class="ab-t"><b></b><small></small></div>'
       +'<button type="button" class="ab-r" data-ab="vera" aria-label="Ask Vera"><i class="ti ti-sparkles"></i></button>'
       +'<button type="button" class="ab-r" data-ab="bell" aria-label="Notifications"><i class="ti ti-bell"></i><em hidden></em></button>';
      document.body.appendChild(bar);}
    last={};
  }
  if(!tabs||!tabs.isConnected){
    tabs=document.getElementById('mdv-tabs');
    if(!tabs){tabs=document.createElement('nav');tabs.id='mdv-tabs';tabs.setAttribute('aria-label','Main');
      tabs.innerHTML=TABS.map(function(t){return '<button type="button" data-tab="'+t[0]+'"><span class="tb-i"><i class="ti '+t[2]+'"></i><em hidden></em></span><span class="tb-l">'+t[1]+'</span></button>';}).join('');
      document.body.appendChild(tabs);}
    last={};
  }
}
function sync(){
  if(!MQ.matches)return;
  build();
  var p=page(),root=!!ROOT[p]||p==='inbox';
  if(last.p!==p){
    last.p=p;
    var t=TITLES[p]||pretty(p);
    bar.querySelector('.ab-t b').textContent=t;
    var sub=bar.querySelector('.ab-t small'),d=p==='overview'?new Date().toLocaleDateString('en-US',{weekday:'long',month:'short',day:'numeric'}):'';
    if(sub.textContent!==d)sub.textContent=d;
    bar.classList.toggle('has-sub',!!d);
    var l=bar.querySelector('.ab-l');
    l.innerHTML=root?'<span class="ab-m"></span>':'<i class="ti ti-chevron-left"></i>';
    l.setAttribute('aria-label',root?'Home':'Back');
    l.dataset.root=root?'1':'';
    var on=ROOT[p]?p:'__menu__';
    [].forEach.call(tabs.querySelectorAll('button'),function(b){b.classList.toggle('on',b.dataset.tab===on);});
  }
  var W=window.MDV_WORKSPACE,c=W&&W.counts?W.counts():{tasks:0,mail:0};
  var tb=[['tasksconsolidated',c.tasks],['mail',c.mail]];
  tb.forEach(function(x){var e=tabs.querySelector('[data-tab="'+x[0]+'"] em');if(!e)return;var n=x[1]||0,txt=n>99?'99+':String(n);if(last['b'+x[0]]!==txt){last['b'+x[0]]=txt;e.hidden=!n;e.textContent=txt;}});
  var nb=document.getElementById('_notif-badge'),bell=bar.querySelector('[data-ab="bell"] em'),nt=nb&&nb.style.display!=='none'?String(nb.textContent||'').trim():'';
  if(last.bell!==nt){last.bell=nt;bell.hidden=!nt;bell.textContent=nt;}
}
document.addEventListener('click',function(e){
  if(!MQ.matches)return;
  var t=e.target&&e.target.closest&&e.target.closest('#mdv-tabs [data-tab],#mdv-appbar [data-ab]');
  if(!t)return;
  e.preventDefault();
  if(t.dataset.tab){
    var k=t.dataset.tab;
    if(k==='__menu__'){if(window.MDV_MENU)MDV_MENU.open();return;}
    if(page()===k){window.scrollTo({top:0,behavior:'smooth'});return;}
    if(typeof window.navTo==='function')window.navTo(k);
    return;
  }
  var a=t.dataset.ab;
  if(a==='left'){
    if(t.dataset.root){if(page()!=='overview'&&typeof window.navTo==='function')window.navTo('overview');else window.scrollTo({top:0,behavior:'smooth'});}
    else if(typeof window.portalBack==='function')window.portalBack();else history.back();
  }else if(a==='vera'){
    if(window.MDV_VERA_CHAT&&MDV_VERA_CHAT.open)MDV_VERA_CHAT.open();else{var b=document.getElementById('_asst-btn');if(b)b.click();}
  }else if(a==='bell'){
    if(typeof window.toggleNotifPanel==='function')window.toggleNotifPanel();
  }
},true);
function inChain(f,mark){var n=0;while(f&&n++<60){if(f[mark])return true;f=f.__orig||f.__previous;}return false;}
function hook(){
  if(typeof window.navTo!=='function'||inChain(window.navTo,'__ma'))return;
  var prev=window.navTo;
  var w=function(){var r=prev.apply(this,arguments);sync();return r;};
  for(var k in prev){try{w[k]=prev[k];}catch(_e){}}
  w.__ma=1;w.__orig=prev;
  window.navTo=w;
}
function start(){hook();sync();}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
window.addEventListener('veux:shell-ready',function(){hook();sync();});
['hashchange','popstate','veux:page-rendered','veux:agency-v16-session','mdv:mail-widget'].forEach(function(ev){window.addEventListener(ev,sync);});
setTimeout(hook,1500);setTimeout(hook,4000);
setInterval(function(){if(!document.hidden)sync();},700);
if(MQ.addEventListener)MQ.addEventListener('change',sync);
})();
