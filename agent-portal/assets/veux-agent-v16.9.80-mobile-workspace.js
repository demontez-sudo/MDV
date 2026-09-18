/* VEUX DESK 16.9.80 — responsive mobile workspace */
(function(){
  'use strict';
  if(window.__VEUX_V16980_MOBILE__)return;
  window.__VEUX_V16980_MOBILE__=true;
  var ICONS={overview:'ti ti-home',calendar:'ti ti-calendar-time',roster:'ti ti-users',tasksconsolidated:'ti ti-checklist',more:'ti ti-dots'};
  function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
  function groups(){if(window.VEUX_V16979_NAV&&window.VEUX_V16979_NAV.groups)return window.VEUX_V16979_NAV.groups();return (window.NAV_AGENT||window.VEUX_V15_NAV_FULL||[]).filter(function(g){return g&&g.items&&g.items.length;});}
  function close(){document.documentElement.classList.remove('vx80-menu-open');var s=document.getElementById('vx80-mobile-sheet'),o=document.getElementById('vx80-mobile-scrim');if(s)s.setAttribute('aria-hidden','true');if(o)o.hidden=true;}
  function open(){document.documentElement.classList.add('vx80-menu-open');var s=document.getElementById('vx80-mobile-sheet'),o=document.getElementById('vx80-mobile-scrim');if(s)s.setAttribute('aria-hidden','false');if(o)o.hidden=false;}
  function go(page){close();if(page==='__intelligence__'){var b=document.getElementById('_asst-btn');if(b)b.click();else if(window.toast)window.toast('Vera is still loading.');return;}if(typeof window.navTo==='function')window.navTo(page);}
  function build(){
    var app=document.getElementById('app');if(!app)return;
    var old=document.getElementById('vx80-mobile-nav');if(old)old.remove();
    var oldSheet=document.getElementById('vx80-mobile-sheet');if(oldSheet)oldSheet.remove();
    var oldScrim=document.getElementById('vx80-mobile-scrim');if(oldScrim)oldScrim.remove();
    var nav=document.createElement('nav');nav.id='vx80-mobile-nav';nav.className='vx80-mobile-nav';nav.setAttribute('aria-label','Agent Portal');
    nav.innerHTML=[['overview','Home'],['calendar','Calendar'],['roster','Roster'],['tasksconsolidated','Tasks']].map(function(x){return '<button type="button" data-page="'+x[0]+'"><i class="'+ICONS[x[0]]+'" aria-hidden="true"></i><span>'+x[1]+'</span></button>';}).join('')+'<button type="button" data-action="more"><i class="'+ICONS.more+'" aria-hidden="true"></i><span>More</span></button>';
    nav.querySelectorAll('[data-page]').forEach(function(b){b.onclick=function(){go(b.dataset.page);};});nav.querySelector('[data-action="more"]').onclick=open;
    var scrim=document.createElement('button');scrim.type='button';scrim.id='vx80-mobile-scrim';scrim.className='vx80-mobile-scrim';scrim.hidden=true;scrim.setAttribute('aria-label','Close menu');scrim.onclick=close;
    var sheet=document.createElement('aside');sheet.id='vx80-mobile-sheet';sheet.className='vx80-mobile-sheet';sheet.setAttribute('aria-hidden','true');sheet.innerHTML='<header><div><small>VEUX DESK</small><h2>All Pages</h2></div><button type="button" data-close aria-label="Close menu">×</button></header><div class="vx80-mobile-groups">'+groups().map(function(g){return '<section><h3>'+esc(g.grp)+'</h3>'+g.items.map(function(i){return '<button type="button" data-page="'+esc(i[0])+'"><span>'+esc(i[1])+'</span><i class="ti ti-chevron-right" aria-hidden="true"></i></button>';}).join('')+'</section>';}).join('')+'</div>';
    sheet.querySelector('[data-close]').onclick=close;sheet.querySelectorAll('[data-page]').forEach(function(b){b.onclick=function(){go(b.dataset.page);};});
    app.appendChild(scrim);app.appendChild(sheet);app.appendChild(nav);active();
  }
  function active(){var p=window._currentPage||'overview';document.querySelectorAll('#vx80-mobile-nav [data-page]').forEach(function(b){b.classList.toggle('on',b.dataset.page===p);});var more=document.querySelector('#vx80-mobile-nav [data-action="more"]');if(more)more.classList.toggle('on',!['overview','calendar','roster','tasksconsolidated'].includes(p));}
  function ready(){build();setTimeout(build,100);setTimeout(build,600);}
  window.addEventListener('veux:agency-v16-shell-ready',ready);window.addEventListener('veux:shell-ready',ready);
  document.addEventListener('click',function(){setTimeout(active,0);});window.addEventListener('popstate',function(){setTimeout(active,0);});
  window.addEventListener('resize',function(){if(innerWidth>900)close();});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ready);else ready();
  window.VEUX_V16980_MOBILE={build:build,open:open,close:close,active:active};
})();
