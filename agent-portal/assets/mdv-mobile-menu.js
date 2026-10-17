/* Phone menu: one simple sheet with big tiles, search, and Install in Settings. */
(function(){
if(window.__MDV_MM__)return;window.__MDV_MM__=1;
var MQ=window.matchMedia('(max-width:820px)');
var TILES=[
  ['inbox','Messages','ti-message-circle'],['mail','Mail','ti-mail'],['seasonmanagement','Season','ti-calendar-event'],['industrydirectory','Clients','ti-building-store'],['outreach','Outreach','ti-send'],
  ['multipackage','Packages','ti-package'],['globalmobility','Mobility','ti-plane'],['financelegal','Finance','ti-cash'],
  ['scouting','Scouting','ti-search'],['modeldevelopment','Development','ti-trending-up'],['team','Team','ti-users-group'],
  ['editorial','Editorial','ti-news'],['__vera__','Vera','ti-sparkles'],['systemsettings','Settings','ti-settings']
];
var MORE=[
  ['approvals','Approvals'],['escalations','Escalations'],['changecontrol','Change Control'],['filesforms','Files & Forms'],
  ['availability','Availability'],['packageresponses','Package Responses'],['modelevaluations','Evaluations'],
  ['modelsubmissions','Submissions'],['modelaccounts','Model Accounts'],['releaseaudit','Release Audit']
];
var root=null;
function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
function go(p){
  close();
  if(p==='__vera__'){if(window.MDV_VERA_CHAT&&MDV_VERA_CHAT.open)MDV_VERA_CHAT.open();else{var b=document.getElementById('_asst-btn');if(b)b.click();}return;}
  if(typeof window.navTo==='function')window.navTo(p);
}
function pwaRow(){
  var P=window.VEUX_PWA;if(!P||P.isStandalone())return '';
  return '<button type="button" class="mm-row" data-mm-install><i class="ti ti-download"></i><span>Install VEUX Desk</span></button>';
}
var PAGE_ICON={approvals:'ti-circle-check',escalations:'ti-alert-triangle',changecontrol:'ti-git-pull-request',availability:'ti-clock',multipackage:'ti-package',packageresponses:'ti-message-check',modelevaluations:'ti-star',modelsubmissions:'ti-send',globalmobility:'ti-plane',visa:'ti-id',financelegal:'ti-chart-bar',modelaccounts:'ti-wallet',agentcommissions:'ti-percentage',systemsettings:'ti-settings',releaseaudit:'ti-shield-check',inbox:'ti-message-circle',roster:'ti-users',industrydirectory:'ti-user-circle',scouting:'ti-user-search',seasonmanagement:'ti-layout-grid',modeldevelopment:'ti-chart-bar',editorial:'ti-notebook',team:'ti-users-group',filesforms:'ti-file-text'};
var TABS={overview:1,tasksconsolidated:1,mail:1,calendar:1};
function sections(){
  var W=window.MDV_WORKSPACE;
  if(!W||!W.sections)return [{cap:'Pages',tiles:TILES.map(function(t){return [t[0],t[1],t[2]];}).concat(MORE.map(function(m){return [m[0],m[1],'ti-point'];}))}];
  var out=W.sections().map(function(sec){
    var tiles=[];
    sec.items.forEach(function(it){
      var list=it.sub&&it.sub.length?it.sub:(it.page?[[it.page,it.label]]:[]);
      list.forEach(function(x){if(TABS[x[0]])return;tiles.push([x[0],x[1],PAGE_ICON[x[0]]||it.icon]);});
    });
    return {cap:sec.cap,tiles:tiles};
  });
  var st=W.settings&&W.settings();
  if(st)out.push({cap:'Settings',tiles:st.sub.map(function(x){return [x[0],x[1],PAGE_ICON[x[0]]||st.icon];})});
  return out;
}
function who(){var n=String((document.getElementById('tbName')||{}).textContent||'').trim(),r=String((document.getElementById('tbRole')||{}).textContent||'').trim();return {n:n||'Your account',r:r,i:(n.split(/\s+/).map(function(x){return x[0];}).join('').slice(0,2)||'M').toUpperCase()};}
function html(){
  var cur=window._currentPage||'',u=who();
  var body=sections().map(function(sec){
    return '<section class="mm-sec"><h3>'+esc(sec.cap)+'</h3><div class="mm-tiles">'+sec.tiles.map(function(t){return '<button type="button" class="mm-tile'+(t[0]===cur?' on':'')+'" data-mm-go="'+t[0]+'" data-mm-name="'+esc(String(t[1]).toLowerCase())+'"><i class="ti '+t[2]+'"></i><span>'+esc(t[1])+'</span></button>';}).join('')+'</div></section>';
  }).join('');
  return '<div class="mm-back" data-mm-x></div><section class="mm-sheet" role="dialog" aria-modal="true" aria-label="Menu">'+
    '<div class="mm-grip" data-mm-x></div>'+
    '<header><span class="mm-av">'+esc(u.i)+'</span><div class="mm-who"><b>'+esc(u.n)+'</b><small>'+esc(u.r)+'</small></div><button type="button" class="mm-close" data-mm-x aria-label="Close"><i class="ti ti-x"></i></button></header>'+
    '<label class="mm-search"><i class="ti ti-search"></i><input type="search" placeholder="Find a page…" autocomplete="off"></label>'+
    '<div class="mm-scroll">'+body+
    '<section class="mm-sec"><div class="mm-tiles"><button type="button" class="mm-tile" data-mm-go="__vera__" data-mm-name="vera ask"><i class="ti ti-sparkles"></i><span>Ask Vera</span></button>'+(window.VEUX_PWA&&!VEUX_PWA.isStandalone()?'<button type="button" class="mm-tile" data-mm-install data-mm-name="install app"><i class="ti ti-download"></i><span>Install app</span></button>':'')+'<button type="button" class="mm-tile mm-out" data-mm-out data-mm-name="sign out"><i class="ti ti-logout"></i><span>Sign out</span></button></div></section></div>'+
  '</section>';
}
function open(){
  if(!root){root=document.createElement('div');root.id='mdv-mm';root.hidden=true;document.body.appendChild(root);
    root.addEventListener('click',function(e){
      var t=e.target;
      if(t.closest('[data-mm-x]')){close();return;}
      var g=t.closest('[data-mm-go]');if(g){go(g.getAttribute('data-mm-go'));return;}
      if(t.closest('[data-mm-install]')){close();if(window.VEUX_PWA)VEUX_PWA.install();return;}
      if(t.closest('[data-mm-out]')){close();if(typeof window.signOut==='function')window.signOut();return;}
    });
    root.addEventListener('input',function(e){
      if(!e.target.matches('input[type=search]'))return;
      var q=e.target.value.trim().toLowerCase();
      root.querySelectorAll('[data-mm-name]').forEach(function(b){b.hidden=!!q&&b.getAttribute('data-mm-name').indexOf(q)<0;});
      root.querySelectorAll('.mm-sec').forEach(function(sec){sec.hidden=!!q&&!sec.querySelector('[data-mm-name]:not([hidden])');});
    });
  }
  root.innerHTML=html();root.hidden=false;document.documentElement.classList.add('mm-open');
}
function close(){if(root)root.hidden=true;document.documentElement.classList.remove('mm-open');}
document.addEventListener('click',function(e){
  if(!MQ.matches)return;
  var b=e.target&&e.target.closest&&e.target.closest('#mn-more-btn');
  if(!b)return;
  e.preventDefault();e.stopImmediatePropagation();
  root&&!root.hidden?close():open();
},true);
document.addEventListener('keydown',function(e){if(e.key==='Escape')close();});
if(MQ.addEventListener)MQ.addEventListener('change',function(){if(!MQ.matches)close();});

/* Settings page: Install card */
function settingsCard(){
  var P=window.VEUX_PWA;if(!MQ.matches||!P||P.isStandalone())return;
  var host=document.getElementById('p-systemsettings');if(!host||!host.querySelector('*'))return;
  if(host.querySelector('#mdv-install-card'))return;
  var c=document.createElement('section');c.id='mdv-install-card';
  c.innerHTML='<div><small>APP</small><h3>Install VEUX Desk</h3><p>Add the portal to your phone or computer for a full-screen, app-style workspace.</p></div><button type="button">Install</button>';
  c.querySelector('button').onclick=function(){P.install();};
  var first=host.querySelector('.cnt')||host;first.insertBefore(c,first.firstChild);
}
['veux:page-rendered','veux:pwa-state'].forEach(function(ev){window.addEventListener(ev,function(){setTimeout(settingsCard,150);setTimeout(settingsCard,900);});});
/* Wrap navTo exactly once. Each wrapper keeps its own reference to the function it wraps; sharing one variable between wrappers
   made two hooks call each other forever ("Maximum call stack size exceeded") whenever another script re-wrapped navTo. */
function inChain(f,mark){var n=0;while(f&&n++<60){if(f[mark])return true;f=f.__orig||f.__previous;}return false;}
function hook(){
  if(typeof window.navTo!=='function'||inChain(window.navTo,'__mm'))return;
  var prev=window.navTo;var w=function(p){var r=prev.apply(this,arguments);if(p==='systemsettings'){setTimeout(settingsCard,200);setTimeout(settingsCard,900);setTimeout(settingsCard,2000);}return r;};
  for(var k in prev){try{w[k]=prev[k];}catch(_e){}}
  w.__mm=1;w.__orig=prev;
  window.navTo=w;
}
hook();window.addEventListener('veux:shell-ready',hook);setTimeout(hook,1500);setTimeout(hook,4000);
window.MDV_MENU={open:open,close:close};
})();
