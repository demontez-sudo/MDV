/* CAVYRE 16.12.67 — Simplified Primary Navigation Authority */
(function(){
'use strict';
if(window.__CAVYRE_PRIMARY_NAV_161267__)return;
window.__CAVYRE_PRIMARY_NAV_161267__=1;

var PRIMARY=[
 ['overview','⌂','Home'],
 ['tasksconsolidated','✓','Tasks'],
 ['roster','♙','Models'],
 ['seasonmanagement','◫','Season'],
 ['calendar','◇','Castings'],
 ['industrydirectory','♡','Relationships'],
 ['calendar','▣','Calendar'],
 ['multipackage','▱','Packages'],
 ['__operations__','⌘','Operations']
];
var OPS=[
 ['globalmobility','✈','Travel & Mobility','Flights, arrivals, housing and movement'],
 ['visa','◎','Visa & Compliance','Visas, passports and work authorization'],
 ['agentcommissions','◈','Finance','Commissions, payments and financial operations'],
 ['filesforms','▱','Documents','Files, forms and operational documents'],
 ['inbox','✉','Communication','Agency communications and follow-up'],
 ['systemsettings','⚙','Settings','Portal and agency settings']
];
var busy=false,scheduled=false,observer=null;

function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]})}
function rail(){return document.getElementById('vx73-rail')||document.querySelector('.vx73-rail')}
function nav(page){
 closeOps();
 if(page==='__operations__'){openOps();return}
 try{if(typeof window.navTo==='function'){window.navTo(page);return}}catch(e){}
 location.hash=page;
}
function current(){
 var p=String(window._currentPage||location.hash.replace(/^#/,'')||'overview').toLowerCase();
 if(['globalmobility','visa','agentcommissions','financelegal','filesforms','inbox','systemsettings','team'].indexOf(p)>-1)return'__operations__';
 if(['industrydirectory','companies','contacts','allcontacts'].indexOf(p)>-1)return'industrydirectory';
 if(['season','seasonmanagement'].indexOf(p)>-1)return'seasonmanagement';
 return p;
}
function signature(r){return r&&r.getAttribute('data-cavyre-primary-nav')}
function html(){
 return '<a class="vx73-monogram" href="https://www.maisondeveux.com" aria-label="Maison de Veux">M</a>'+
 PRIMARY.map(function(x,i){return '<button type="button" data-cavyre-primary="1" data-primary-index="'+i+'" data-page="'+esc(x[0])+'" aria-label="'+esc(x[2])+'"><i>'+x[1]+'</i><span>'+esc(x[2])+'</span></button>'}).join('');
}
function active(){
 var r=rail(),p=current();if(!r)return;
 var buttons=[].slice.call(r.querySelectorAll('button[data-cavyre-primary]'));
 buttons.forEach(function(b){
   var page=b.dataset.page;
   var on=page===p || (page==='calendar'&&p==='calendar'&&b.getAttribute('aria-label')==='Calendar');
   b.classList.toggle('on',on);
 });
}
function build(){
 var r=rail();if(!r||busy)return;
 var expected='16.12.67';
 if(signature(r)===expected && r.querySelectorAll('button[data-cavyre-primary]').length===PRIMARY.length){active();return}
 busy=true;
 try{
   r.innerHTML=html();
   r.setAttribute('data-cavyre-primary-nav',expected);
   r.setAttribute('aria-label','CAVYRE primary navigation');
   r.querySelectorAll('button[data-cavyre-primary]').forEach(function(b){
     b.onclick=function(e){
       e.preventDefault();e.stopPropagation();
       if(b.dataset.page==='__operations__')openOps(b); else nav(b.dataset.page);
     };
   });
   active();
 }finally{busy=false}
}
function schedule(){
 if(scheduled)return;scheduled=true;
 requestAnimationFrame(function(){scheduled=false;build()});
}
function opsPanel(){
 var p=document.getElementById('cavyre-operations-menu-161267');
 if(p)return p;
 p=document.createElement('aside');p.id='cavyre-operations-menu-161267';p.className='cvy167-ops';p.setAttribute('aria-hidden','true');
 p.innerHTML='<header><div><small>CAVYRE · OPERATIONS</small><h2>Operations</h2><p>Agency logistics and administration in one place.</p></div><button type="button" data-cvy167-close aria-label="Close">×</button></header><nav>'+
 OPS.map(function(x){return '<button type="button" data-cvy167-op="'+esc(x[0])+'"><i>'+x[1]+'</i><span><b>'+esc(x[2])+'</b><small>'+esc(x[3])+'</small></span><em>→</em></button>'}).join('')+
 '</nav>';
 document.body.appendChild(p);
 p.querySelector('[data-cvy167-close]').onclick=closeOps;
 p.querySelectorAll('[data-cvy167-op]').forEach(function(b){b.onclick=function(){nav(b.dataset.cvy167Op)}});
 return p;
}
function openOps(){
 var p=opsPanel();p.classList.add('open');p.setAttribute('aria-hidden','false');
 document.body.classList.add('cvy167-operations-open');
}
function closeOps(){
 var p=document.getElementById('cavyre-operations-menu-161267');
 if(p){p.classList.remove('open');p.setAttribute('aria-hidden','true')}
 document.body.classList.remove('cvy167-operations-open');
}
function install(){
 build();
 var r=rail();
 if(r&&!observer){
   observer=new MutationObserver(function(){
     if(busy)return;
     if(signature(r)!=='16.12.67'||r.querySelectorAll('button[data-cavyre-primary]').length!==PRIMARY.length)schedule();
   });
   observer.observe(r,{childList:true,subtree:false,attributes:true,attributeFilter:['data-cavyre-primary-nav']});
 }
}
document.addEventListener('click',function(e){
 var p=document.getElementById('cavyre-operations-menu-161267');
 if(p&&p.classList.contains('open')&&!p.contains(e.target)&&!e.target.closest('[data-page="__operations__"]'))closeOps();
 setTimeout(active,0);
},true);
document.addEventListener('keydown',function(e){if(e.key==='Escape')closeOps()});
window.addEventListener('popstate',function(){setTimeout(active,0)});
window.addEventListener('hashchange',function(){setTimeout(active,0)});
['veux:shell-ready','veux:agency-v16-shell-ready','veux:agency-v16-ready'].forEach(function(n){window.addEventListener(n,function(){setTimeout(install,0)})});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
setTimeout(install,120);setTimeout(install,700);setTimeout(install,1800);

window.CAVYRE_PRIMARY_NAV={
 release:'16.12.67',build:build,active:active,openOperations:openOps,closeOperations:closeOps,
 primary:PRIMARY.slice(),operations:OPS.slice()
};
document.documentElement.setAttribute('data-cavyre-primary-navigation','16.12.67');
})();