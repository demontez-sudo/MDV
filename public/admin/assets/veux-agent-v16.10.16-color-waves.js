
(function(){
'use strict';
if(window.__VEUX_COLOR_WAVES_161038__)return;
window.__VEUX_COLOR_WAVES_161038__=true;

var THEMES={
  classic:{name:'Classic',sub:'Maison Gold',preview:'#C9A66B',bg:'linear-gradient(145deg,#050403,#17110b)',text:'#F1E4D4'},
  green:{name:'Green',sub:'Neon Emerald',preview:'#50E3A4',bg:'linear-gradient(145deg,#020605,#0b2119)',text:'#E7FFF5'},
  blue:{name:'Blue',sub:'Electric Cobalt',preview:'#5B9DFF',bg:'linear-gradient(145deg,#020408,#0b1729)',text:'#EDF5FF'},
  red:{name:'Red',sub:'Signal Crimson',preview:'#FF645F',bg:'linear-gradient(145deg,#070202,#25100f)',text:'#FFF0ED'},
  white:{name:'White',sub:'Future Chrome',preview:'#F4F4F1',bg:'linear-gradient(145deg,#040506,#181b20)',text:'#F8F8F5'},
  purple:{name:'Purple',sub:'Editorial Violet',preview:'#9B78D0',bg:'linear-gradient(145deg,#080510,#241638)',text:'#F7F0FF'},
  burntOrange:{name:'Burnt Orange',sub:'Burnished Ember',preview:'#C8753E',bg:'linear-gradient(145deg,#0D0603,#3A1A0C)',text:'#FFF2E8'},
  turquoise:{name:'Turquoise',sub:'Atelier Turquoise',preview:'#4FBDB5',bg:'linear-gradient(145deg,#020B0B,#0C302E)',text:'#EDFFFD'},
  blueNude:{name:'Blue Nude',sub:'Powdered Azure',preview:'#8EAFC3',bg:'linear-gradient(145deg,#071016,#1B2D38)',text:'#F1F7FA'},
  greenNude:{name:'Green Nude',sub:'Muted Sage',preview:'#9BA58A',bg:'linear-gradient(145deg,#080B07,#242B20)',text:'#F4F6EF'},
  galaxy:{name:'Galaxy',sub:'Nebula Violet',preview:'#A98BFF',bg:'radial-gradient(circle at 66% 30%,rgba(211,91,232,.34),transparent 28%),radial-gradient(circle at 30% 70%,rgba(48,107,255,.27),transparent 34%),linear-gradient(145deg,#03040B,#0B1230)',text:'#F8F5FF'},
  christmas:{name:'Christmas',sub:'Forest · Ruby · Gold',preview:'#D5B56D',bg:'radial-gradient(circle at 72% 28%,rgba(185,39,51,.30),transparent 31%),radial-gradient(circle at 28% 70%,rgba(24,111,69,.32),transparent 35%),linear-gradient(145deg,#030605,#0C1811)',text:'#F9F4E8'},
  earth:{name:'Earth',sub:'Orbit Teal',preview:'#55D7C1',bg:'radial-gradient(ellipse at 50% 105%,rgba(83,220,196,.40),transparent 35%),linear-gradient(180deg,#02070C,#06151A)',text:'#EEFFFB'},
  waterfall:{name:'Waterfall',sub:'Cyan Mist',preview:'#52D6E0',bg:'repeating-linear-gradient(97deg,transparent 0 14%,rgba(118,240,243,.11) 16%,transparent 19% 30%),linear-gradient(155deg,#02080B,#06202A)',text:'#F0FEFF'}
};

function orgKey(){
  try{
    var s=window.VEUX_AGENT_V4&&window.VEUX_AGENT_V4.state;
    var slug=s&&s.org&&s.org.slug;
    return 'veux:color-wave:'+(slug||'portal');
  }catch(e){return 'veux:color-wave:portal';}
}
function readSaved(){
  var v='';
  try{
    v=localStorage.getItem(orgKey())||localStorage.getItem('veux:color-wave')||'';
  }catch(e){}
  return THEMES[v]?v:'classic';
}
function metaColor(theme){
  return {
    classic:'#080604',
    green:'#020605',
    blue:'#020408',
    red:'#070202',
    white:'#040506',
    purple:'#080510',
    burntOrange:'#0D0603',
    turquoise:'#020B0B',
    blueNude:'#071016',
    greenNude:'#080B07',
    galaxy:'#040510',
    christmas:'#040805',
    earth:'#020809',
    waterfall:'#02080B',
  }[theme]||'#080604';
}
function apply(theme,persist){
  if(!THEMES[theme])theme='classic';
  document.documentElement.setAttribute('data-veux-wave',theme);
  document.documentElement.style.colorScheme='dark';

  document.querySelectorAll('meta[name="theme-color"]').forEach(function(m){
    m.setAttribute('content',metaColor(theme));
  });

  if(persist!==false){
    try{
      localStorage.setItem(orgKey(),theme);
      localStorage.setItem('veux:color-wave',theme);
    }catch(e){}
  }

  updateSettings(theme);
  window.dispatchEvent(new CustomEvent('veux:color-wave-change',{
    detail:{theme:theme,name:THEMES[theme].name}
  }));
}
function updateSettings(theme){
  document.querySelectorAll('.vx-wave-option').forEach(function(b){
    var on=b.dataset.wave===theme;
    b.classList.toggle('on',on);
    b.setAttribute('aria-pressed',on?'true':'false');
  });
  var status=document.querySelector('.vx-wave-status');
  if(status){
    status.innerHTML='Active wave: <strong>'+THEMES[theme].name+' · '+THEMES[theme].sub+'</strong> · saved on this device';
  }
}
function settingsMarkup(){
  var current=document.documentElement.getAttribute('data-veux-wave')||readSaved();
  var buttons=Object.keys(THEMES).map(function(k){
    var t=THEMES[k];
    return '<button type="button" class="vx-wave-option'+(k===current?' on':'')+'" data-wave="'+k+'" aria-pressed="'+(k===current?'true':'false')+'" '+
      'style="--preview:'+t.preview+';--preview-bg:'+t.bg+';--preview-text:'+t.text+'">'+
      '<span class="vx-wave-check">✓</span>'+
      '<b>'+t.name+'</b><small>'+t.sub+'</small><span class="vx-wave-line"></span></button>';
  }).join('');

  return '<section class="v152-card vx-wave-settings" id="vx-wave-settings">'+
    '<header><div><span>APPEARANCE · COLOR WAVE</span><b>Portal Color Wave</b>'+
    '<p class="vx-wave-sub">Change the complete portal atmosphere. Each wave remaps the interface accent, selected states, borders, intelligence surfaces and background depth while preserving VEUX layout and readability.</p></div></header>'+
    '<div class="vx-wave-grid">'+buttons+'</div>'+
    '<div class="vx-wave-status"></div></section>';
}
function bindWaveCard(card){
  if(!card||card.dataset.vxWaveBound==='1')return;
  card.dataset.vxWaveBound='1';
  card.querySelectorAll('.vx-wave-option').forEach(function(b){
    b.addEventListener('click',function(e){
      e.preventDefault();
      apply(b.dataset.wave,true);
    });
  });
  updateSettings(document.documentElement.getAttribute('data-veux-wave')||readSaved());
}
function installSettings(){
  var existing=document.getElementById('vx-wave-settings');
  if(existing){
    bindWaveCard(existing);
    return;
  }

  /* Target the actual System Settings page. */
  var page=null;
  document.querySelectorAll('.v152-page').forEach(function(p){
    var text=(p.textContent||'').toLowerCase();
    if(text.indexOf('system settings')>=0 && text.indexOf('configuration')>=0)page=p;
  });
  if(!page)return;

  var grid=page.querySelector('.v152-settings-grid');
  if(!grid)return;

  var shell=document.createElement('div');
  shell.innerHTML=settingsMarkup();
  var card=shell.firstElementChild;
  grid.appendChild(card);

  bindWaveCard(card);
}
function scan(){
  installSettings();
}
var initial=readSaved();
apply(initial,false);

function start(){
  scan();
  new MutationObserver(function(){
    requestAnimationFrame(scan);
  }).observe(document.body,{childList:true,subtree:true});
}
if(document.readyState==='loading'){
  document.addEventListener('DOMContentLoaded',start,{once:true});
}else{
  start();
}

window.VEUX_COLOR_WAVES={
  version:'16.10.38',
  themes:THEMES,
  get:function(){return document.documentElement.getAttribute('data-veux-wave')||'classic';},
  set:function(theme){apply(theme,true);},
  refresh:scan,
  settingsMarkup:settingsMarkup
};
})();
