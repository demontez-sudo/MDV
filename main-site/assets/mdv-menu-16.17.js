/* Menu photo stage: pictures from the published stories (the blog) for the city you are looking at, drifting beside the menu.
   Click it and you open that story. */
(function(){
'use strict';
var menu=document.getElementById('menu');if(!menu)return;
var SB='https://mogyngdhmzbjmcdqeoxu.supabase.co';
var ANON='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1vZ3luZ2RobXpiam1jZHFlb3h1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODExMjE1MzYsImV4cCI6MjA5NjY5NzUzNn0.mLgAA9rB8-y3v8r1Sd6Z-t4PCz5e9skJWY1ySg7mNZA';
var posts=null,loading=false,stage,A,B,nameEl,tagEl,front,timer=null,idx=0,sig='';
function sized(u,w){
  u=String(u||'');
  if(/^https:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\//.test(u)){var rest=u.split('/image/upload/')[1]||'';if(/^(?:[a-z]{1,3}_[^/]+,?)+\//.test(rest))return u;return u.replace('/image/upload/','/image/upload/f_auto,q_auto,w_'+w+',c_limit/');}
  if(/^https:\/\/[^/]+\.supabase\.co\/storage\/v1\/object\/public\//.test(u))return u.replace('/storage/v1/object/public/','/storage/v1/render/image/public/')+'?width='+w+'&resize=contain&quality=72';
  return u;
}
function build(){
  stage=document.createElement('a');stage.className='menu-stage';stage.href='#';stage.setAttribute('data-cursor','Read');stage.setAttribute('tabindex','-1');
  stage.innerHTML='<div class="ms-frame"><img alt=""><img alt=""></div><i class="ms-c a"></i><i class="ms-c b"></i><i class="ms-c c"></i><i class="ms-c d"></i><div class="ms-cap"><span class="ms-name"></span><span class="ms-board"></span></div>';
  var imgs=stage.querySelectorAll('img');A=imgs[0];B=imgs[1];front=A;nameEl=stage.querySelector('.ms-name');tagEl=stage.querySelector('.ms-board');
  menu.appendChild(stage);
}
function cityKey(){var s=menu.querySelector('.menu-set.active');return s&&s.getAttribute('data-city')==='paris'?'paris':'newyork';}
function load(){
  if(posts||loading)return Promise.resolve();loading=true;
  return fetch(SB+'/rest/v1/mdv_sync?key=eq.mdvc_editorial_2026&select=data',{headers:{apikey:ANON,Authorization:'Bearer '+ANON}})
    .then(function(r){return r.ok?r.json():[];}).then(function(rows){
      var all=rows&&rows[0]&&Array.isArray(rows[0].data)?rows[0].data:[];
      posts=all.filter(function(p){return p&&p.status==='published';}).sort(function(a,b){return String(b.publishedAt||'').localeCompare(String(a.publishedAt||''));});
    }).catch(function(){posts=[];}).then(function(){loading=false;});
}
/* every picture of every story for this city, hero first */
function pictures(){
  var c=cityKey(),out=[];
  function add(p,only){
    if(only&&!(p.city===c||p.city==='both'))return;
    var imgs=[p.heroImage].concat(Array.isArray(p.gallery)?p.gallery:[]).filter(Boolean);
    imgs.forEach(function(u){out.push({u:sized(u,720),n:p.modelName||'',t:(p.brand&&String(p.brand).length<=20)?('For '+p.brand):'Editorial',slug:p.slug||p.id||'',c:p.city==='both'?c:(p.city||c)});});
  }
  (posts||[]).forEach(function(p){add(p,true);});
  /* a city with no stories of its own yet shows the house's other stories, so the menu is never bare */
  if(!out.length)(posts||[]).forEach(function(p){add(p,false);});
  return out;
}
function show(f){
  var back=front===A?B:A;
  back.onload=function(){back.classList.add('show');front.classList.remove('show');front=back;nameEl.textContent=f.n;tagEl.textContent=f.t;};
  back.src=f.u;
  stage.href='https://www.maisondeveux.com/'+(f.c==='paris'?'paris':'newyork')+'/news/'+(f.slug?'#'+encodeURIComponent(f.slug):'');
}
function tick(){
  var list=pictures();
  stage.style.display=list.length?'':'none';
  if(!list.length)return;
  var s=cityKey()+list.length+(list[0]&&list[0].c);if(s!==sig){sig=s;idx=0;}
  show(list[idx%list.length]);idx++;
}
function open(){return menu.classList.contains('open');}
function run(){clearInterval(timer);load().then(function(){if(!open())return;tick();timer=setInterval(tick,2800);});}
build();stage.style.display='none';
new MutationObserver(function(){if(open())run();else clearInterval(timer);}).observe(menu,{attributes:true,attributeFilter:['class']});
/* changing city, or moving to another board, brings the next picture straight away */
menu.addEventListener('click',function(e){if(e.target.closest&&e.target.closest('.menu-city-switch button')){idx=0;setTimeout(function(){if(open())tick();},60);}});
menu.addEventListener('mouseover',function(e){var a=e.target.closest&&e.target.closest('.menu-primary a');if(a&&a!==menu._last&&open()&&posts){menu._last=a;tick();}else if(!a)menu._last=null;});
})();
