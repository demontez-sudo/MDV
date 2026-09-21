/* Phone menu: one simple sheet with big tiles, search, and Install in Settings. */
(function(){
if(window.__MDV_MM__)return;window.__MDV_MM__=1;
var MQ=window.matchMedia('(max-width:820px)');
var TILES=[
  ['inbox','Messages','ti-mail'],['seasonmanagement','Season','ti-calendar-event'],['industrydirectory','Clients','ti-building-store'],
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
function html(){
  var cur=window._currentPage||'';
  return '<div class="mm-back" data-mm-x></div><section class="mm-sheet" role="dialog" aria-modal="true" aria-label="Menu">'+
    '<div class="mm-grip" data-mm-x></div>'+
    '<header><h2>Menu</h2><button type="button" class="mm-close" data-mm-x aria-label="Close">×</button></header>'+
    '<label class="mm-search"><i class="ti ti-search"></i><input type="search" placeholder="Find a page…" autocomplete="off"></label>'+
    '<div class="mm-tiles">'+TILES.map(function(t){return '<button type="button" class="mm-tile'+(t[0]===cur?' on':'')+'" data-mm-go="'+t[0]+'" data-mm-name="'+esc(t[1].toLowerCase())+'"><i class="ti '+t[2]+'"></i><span>'+esc(t[1])+'</span></button>';}).join('')+'</div>'+
    '<details class="mm-more"><summary>More pages</summary><div class="mm-list">'+MORE.map(function(m){return '<button type="button" class="mm-row'+(m[0]===cur?' on':'')+'" data-mm-go="'+m[0]+'" data-mm-name="'+esc(m[1].toLowerCase())+'"><span>'+esc(m[1])+'</span><em>›</em></button>';}).join('')+'</div></details>'+
    '<div class="mm-foot">'+pwaRow()+'<button type="button" class="mm-row" data-mm-out><i class="ti ti-logout"></i><span>Sign out</span></button></div>'+
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
      var q=e.target.value.trim().toLowerCase(),det=root.querySelector('.mm-more');
      root.querySelectorAll('[data-mm-name]').forEach(function(b){b.hidden=!!q&&b.getAttribute('data-mm-name').indexOf(q)<0;});
      if(q)det.open=true;
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
var oldNav=null;
function hook(){
  if(typeof window.navTo!=='function'||window.navTo.__mm)return;
  oldNav=window.navTo;var w=function(p){var r=oldNav.apply(this,arguments);if(p==='systemsettings'){setTimeout(settingsCard,200);setTimeout(settingsCard,900);setTimeout(settingsCard,2000);}return r;};w.__mm=1;
  for(var k in oldNav){try{w[k]=oldNav[k];}catch(_e){}}
  window.navTo=w;
}
hook();window.addEventListener('veux:shell-ready',hook);setTimeout(hook,1500);setTimeout(hook,4000);
window.MDV_MENU={open:open,close:close};
})();
