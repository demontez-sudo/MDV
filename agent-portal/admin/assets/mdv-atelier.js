/* Atelier outlook: builds the text menu, the wordmark and the greeting. Switch back to Classic under Appearance. */
(function(){
'use strict';
if(window.__MDV_ATELIER__)return;window.__MDV_ATELIER__=1;
var KEY='mdv-outlook';
function outlook(){try{return localStorage.getItem(KEY)==='classic'?'classic':'atelier';}catch(e){return 'atelier';}}
function apply(v){document.documentElement.setAttribute('data-outlook',v);}
apply(outlook());
function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}

var PRIMARY=[['overview','Home'],['roster','Models'],['scouting','Scouting'],['calendar','Calendar'],['seasonmanagement','Season'],['industrydirectory','Clients'],['multipackage','Packages'],['tasksconsolidated','Tasks'],['inbox','Messages'],['mail','Mail']];
var ALWAYS={overview:1,calendar:1,inbox:1,mail:1,systemsettings:1};
function groups(){return (window.NAV_AGENT||window.VEUX_V15_NAV_FULL||[]).filter(function(g){return g&&g.items&&g.items.length;});}
function allowed(){var ok=Object.assign({},ALWAYS);groups().forEach(function(g){g.items.forEach(function(i){ok[i[0]]=1;});});return ok;}
function go(p){if(typeof window.navTo==='function')window.navTo(p);}
function current(){var p=String(window._currentPage||'overview').toLowerCase();if(p==='season')return 'seasonmanagement';if(['industrydirectory','companies','contacts','allcontacts','clientbook'].indexOf(p)>-1)return 'industrydirectory';return p;}

var sig='';
function build(){
  var app=document.getElementById('app');if(!app)return;
  var ok=allowed(),prim=PRIMARY.filter(function(x){return ok[x[0]];}),used={};prim.forEach(function(x){used[x[0]]=1;});
  var more=[];groups().forEach(function(g){var items=g.items.filter(function(i){return !used[i[0]];});if(items.length)more.push({grp:g.grp,items:items});});
  var s=prim.map(function(x){return x[0];}).join()+'|'+more.map(function(g){return g.grp+g.items.map(function(i){return i[0];}).join();}).join('|');
  var nav=document.getElementById('at-nav');
  if(!nav){nav=document.createElement('nav');nav.id='at-nav';nav.setAttribute('aria-label','Main menu');var tb=app.querySelector('.topbar');if(tb&&tb.nextSibling)app.insertBefore(nav,tb.nextSibling);else app.insertBefore(nav,app.firstChild);sig='';}
  if(s!==sig){
    sig=s;
    nav.innerHTML=prim.map(function(x){return '<button type="button" class="at-i" data-at="'+x[0]+'">'+esc(x[1])+'</button>';}).join('')
      +'<span class="at-sp"></span><div class="at-more"><button type="button" class="at-i" data-at-more aria-haspopup="true" aria-expanded="false">More ▾</button><div class="at-pop">'
      +more.map(function(g){return '<div><h4>'+esc(g.grp)+'</h4>'+g.items.map(function(i){return '<button type="button" data-at="'+esc(i[0])+'">'+esc(i[1])+'</button>';}).join('')+'</div>';}).join('')+'</div></div>';
  }
  var cur=current();nav.querySelectorAll('.at-i[data-at]').forEach(function(b){b.classList.toggle('on',b.dataset.at===cur);});
}
document.addEventListener('click',function(e){
  var nav=document.getElementById('at-nav');if(!nav)return;
  var b=e.target.closest&&e.target.closest('#at-nav [data-at]');
  if(b){var more=nav.querySelector('.at-more');more.classList.remove('open');go(b.dataset.at);return;}
  var m=e.target.closest&&e.target.closest('#at-nav [data-at-more]');
  if(m){var box=nav.querySelector('.at-more');box.classList.toggle('open');m.setAttribute('aria-expanded',box.classList.contains('open')?'true':'false');return;}
  var box2=nav.querySelector('.at-more.open');if(box2&&!e.target.closest('.at-more'))box2.classList.remove('open');
});
document.addEventListener('keydown',function(e){if(e.key==='Escape'){var b=document.querySelector('#at-nav .at-more.open');if(b)b.classList.remove('open');}});

function brand(){
  var tb=document.querySelector('#app .tb-brand');if(!tb||tb.querySelector('.at-brand'))return;
  var a=document.createElement('a');a.className='at-brand';a.href='#';a.setAttribute('aria-label','Maison de Veux, home');a.innerHTML='Maison <em>de</em> Veux<i>Agent Portal</i>';
  a.onclick=function(e){e.preventDefault();go('overview');};tb.appendChild(a);
}
function firstName(){var n=(document.getElementById('tbName')||{}).textContent||'';n=n.trim();return n?n.split(/\s+/)[0]:'';}
function greet(){
  var h=document.querySelector('#p-overview .vx17-head h1');if(!h||h.dataset.atGreet===firstName()+new Date().getHours())return;
  var hr=new Date().getHours(),g=hr<12?'Good morning':hr<18?'Good afternoon':'Good evening',n=firstName();
  h.innerHTML=esc(g)+(n?', <em>'+esc(n)+'</em>':'');h.dataset.atGreet=firstName()+new Date().getHours();
  var eye=document.querySelector('#p-overview .vx17-eye');if(eye)eye.textContent='Maison de Veux · '+new Date().toLocaleDateString([],{weekday:'long',day:'numeric',month:'long'});
  var p=document.querySelector('#p-overview .vx17-head p');if(p)p.textContent='Today’s schedule, what needs you, and the money coming in.';
}
function outlookRow(){
  document.querySelectorAll('#vx-wave-settings,.mdv-appearance .v152-settings-grid').forEach(function(host){
    if(!host||host.querySelector('.at-outlook')||host.parentNode.querySelector('.at-outlook'))return;
    var row=document.createElement('div');row.className='at-outlook';
    function paint(){var cur=outlook();row.innerHTML='<b>Layout</b><button type="button" data-ol="atelier" class="'+(cur==='atelier'?'on':'')+'">Atelier</button><button type="button" data-ol="classic" class="'+(cur==='classic'?'on':'')+'">Classic</button><span>Atelier uses a top menu and square panels. Classic is the previous look with the side icon menu.</span>';
      row.querySelectorAll('[data-ol]').forEach(function(b){b.onclick=function(){window.MDV_OUTLOOK.set(b.dataset.ol);paint();};});}
    paint();host.parentNode.insertBefore(row,host);
  });
}
function tick(){try{outlookRow();if(document.documentElement.getAttribute('data-outlook')!=='atelier')return;build();brand();greet();}catch(e){}}
setInterval(tick,600);tick();
var raf=0;new MutationObserver(function(){if(raf)return;raf=requestAnimationFrame(function(){raf=0;tick();});}).observe(document.documentElement,{childList:true,subtree:true});

/* Appearance: Layout switch */
window.MDV_OUTLOOK={get:outlook,set:function(v){try{localStorage.setItem(KEY,v);}catch(e){}apply(v);tick();}};
})();
