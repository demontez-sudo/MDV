
/* CAVYRE 16.12.42 — Shell / Menu Runtime */
(function(){
'use strict';
if(window.__CAVYRE_SHELL_MENU_161242__)return;
window.__CAVYRE_SHELL_MENU_161242__=1;

var pinned=false,leaveTimer=null;

function rail(){return document.getElementById('vx73-rail')||document.querySelector('.vx73-rail');}
function side(){return document.getElementById('sidenav');}
function body(){return document.body;}

function setHover(on){
  var b=body();if(!b)return;
  b.classList.toggle('cvy-menu-hover',!!on);
}
function setPinned(on){
  pinned=!!on;
  var b=body();if(!b)return;
  b.classList.toggle('cvy-menu-pinned',pinned);
}
function closeMenu(){
  setPinned(false);setHover(false);
}
function wire(){
  var r=rail(),s=side(),b=body();
  if(!b)return;

  /* Cancel stale shell states from older menu generations. */
  b.classList.remove('sn-open');
  if(s)s.classList.remove('open');

  if(r&&r.dataset.cvyShellWired!=='1'){
    r.dataset.cvyShellWired='1';
    r.addEventListener('mouseenter',function(){clearTimeout(leaveTimer);setHover(true)});
    r.addEventListener('mouseleave',function(){
      clearTimeout(leaveTimer);
      leaveTimer=setTimeout(function(){
        if(!(s&&s.matches(':hover'))&&!pinned)setHover(false);
      },120);
    });
    r.addEventListener('click',function(e){
      var btn=e.target&&e.target.closest&&e.target.closest('button');
      if(!btn)return;
      /* A rail click opens/pins its flyout; page navigation still proceeds normally. */
      setPinned(true);setHover(true);
    },true);
  }

  if(s&&s.dataset.cvyShellWired!=='1'){
    s.dataset.cvyShellWired='1';
    s.addEventListener('mouseenter',function(){clearTimeout(leaveTimer);setHover(true)});
    s.addEventListener('mouseleave',function(){
      clearTimeout(leaveTimer);
      leaveTimer=setTimeout(function(){if(!pinned)setHover(false)},120);
    });
    s.addEventListener('keydown',function(e){if(e.key==='Escape')closeMenu()});
    s.addEventListener('click',function(e){
      var nav=e.target&&e.target.closest&&e.target.closest('button,a');
      if(nav&&window.innerWidth>900){
        /* Keep the menu open only when a user explicitly pinned from the rail.
           Clicking a submenu item closes the flyout after navigation for workspace visibility. */
        if(!nav.closest('.sn-grp-hd'))setTimeout(closeMenu,80);
      }
    });
  }
}

document.addEventListener('click',function(e){
  if(window.innerWidth<=900)return;
  var r=rail(),s=side();
  if((r&&r.contains(e.target))||(s&&s.contains(e.target)))return;
  closeMenu();
},true);

new MutationObserver(function(){requestAnimationFrame(wire)}).observe(document.documentElement,{childList:true,subtree:true});
window.addEventListener('resize',wire,{passive:true});
window.addEventListener('veux:shell-ready',function(){setTimeout(wire,0)});
window.addEventListener('veux:agency-v16-ready',function(){setTimeout(wire,0)});
setTimeout(wire,100);setTimeout(wire,700);setTimeout(wire,1600);

window.CAVYRE_SHELL_MENU={
  release:'16.12.42',
  open:function(){setPinned(true);setHover(true)},
  close:closeMenu,
  repair:wire
};
})();
