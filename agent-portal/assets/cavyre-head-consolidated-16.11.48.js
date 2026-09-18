/* 16.11.63 native settings renderer authority */
/* CAVYRE 16.11.48 consolidated deferred runtime */

;/* BEGIN veux-agent-v16.10.16-color-waves.js */

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

;/* END veux-agent-v16.10.16-color-waves.js */

;/* BEGIN veux-agent-v16.10.16-dropdown-system.js */

(function(){
'use strict';
if(window.VEUX_SELECT_SYSTEM_161010)return;

var OPEN=null,UID=0,SEARCH_THRESHOLD=9;

function esc(v){
  return String(v==null?'':v).replace(/[&<>"']/g,function(c){
    return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c];
  });
}

function eligible(s){
  return s && s.tagName==='SELECT' && !s.multiple && !(s.size>1) && !s.dataset.vxSelectIgnore;
}

function eventTypeGroup(label){
  var v=String(label||'').trim();
  if(['Casting','Go & See','Fitting','Editorial','Campaign','Runway'].indexOf(v)>=0)return 'BOOKING / CASTING';
  if(['Evaluation','Training','Test','Digitals'].indexOf(v)>=0)return 'DEVELOPMENT';
  if(['Travel','Meeting','Task'].indexOf(v)>=0)return 'OPERATIONS';
  if(['Option 1','Option 2','Option 3'].indexOf(v)>=0)return 'OPTIONS';
  return '';
}

function looksLikeEventTypeSelect(s){
  var labels=Array.from(s.options||[]).map(function(o){return (o.textContent||'').trim();});
  return labels.indexOf('Casting')>=0 &&
         labels.indexOf('Training')>=0 &&
         labels.indexOf('Meeting')>=0 &&
         labels.indexOf('Option 1')>=0;
}

function makeEntries(s){
  var out=[];
  var inferEventGroups=looksLikeEventTypeSelect(s);

  Array.prototype.forEach.call(s.children,function(node){
    if(node.tagName==='OPTGROUP'){
      out.push({kind:'group',label:node.label||''});
      Array.prototype.forEach.call(node.children,function(o){
        if(o.tagName==='OPTION')out.push({kind:'option',option:o,group:node.label||''});
      });
      return;
    }
    if(node.tagName==='OPTION'){
      var g=inferEventGroups?eventTypeGroup(node.textContent):'';
      out.push({kind:'option',option:node,group:g});
    }
  });

  if(inferEventGroups){
    var grouped=[],seen={};
    ['BOOKING / CASTING','DEVELOPMENT','OPERATIONS','OPTIONS'].forEach(function(group){
      var rows=out.filter(function(x){return x.kind==='option'&&x.group===group;});
      if(rows.length){
        grouped.push({kind:'group',label:group});
        Array.prototype.push.apply(grouped,rows);
        seen[group]=true;
      }
    });
    out.filter(function(x){return x.kind==='option'&&!x.group;}).forEach(function(x){grouped.push(x);});
    return grouped;
  }
  return out;
}

function selectable(menu){
  return Array.from(menu.querySelectorAll('.vx-select-option:not([disabled]):not([hidden])'));
}

function sync(s){
  var w=s._vxSelect;if(!w)return;
  var selected=s.options[s.selectedIndex];
  var btn=w.querySelector('.vx-select-btn');
  var val=w.querySelector('.vx-select-value');

  if(val)val.textContent=selected?selected.textContent:'Select';
  if(btn){
    btn.disabled=!!s.disabled;
    btn.dataset.placeholder=(!selected||selected.value==='')?'true':'false';
    btn.setAttribute('aria-disabled',s.disabled?'true':'false');
  }

  w.querySelectorAll('.vx-select-option').forEach(function(b){
    var on=b.dataset.value===String(s.value);
    b.classList.toggle('selected',on);
    b.setAttribute('aria-selected',on?'true':'false');
  });
}

function filter(w,q){
  var menu=w.querySelector('.vx-select-menu');if(!menu)return;
  var query=String(q||'').trim().toLowerCase(),any=false;

  menu.querySelectorAll('.vx-select-option').forEach(function(b){
    var show=!query||(b.dataset.search||'').indexOf(query)>=0;
    b.hidden=!show;
    b.classList.remove('focused');
    if(show)any=true;
  });

  var kids=Array.from(menu.children);
  kids.forEach(function(n,i){
    if(!n.classList.contains('vx-select-group'))return;
    var visible=false;
    for(var j=i+1;j<kids.length;j++){
      if(kids[j].classList.contains('vx-select-group'))break;
      if(kids[j].classList.contains('vx-select-option')&&!kids[j].hidden){visible=true;break;}
    }
    n.hidden=!visible;
  });

  var empty=menu.querySelector('.vx-select-empty');
  if(empty)empty.hidden=any;
  var first=selectable(menu)[0];
  if(first)first.classList.add('focused');
}

function rebuild(s){
  var w=s._vxSelect;if(!w)return;
  var menu=w.querySelector('.vx-select-menu');if(!menu)return;

  var entries=makeEntries(s);
  var optionCount=entries.filter(function(x){return x.kind==='option';}).length;
  var html='';

  if(optionCount>=SEARCH_THRESHOLD){
    html+='<div class="vx-select-search-wrap"><input class="vx-select-search" type="search" autocomplete="off" spellcheck="false" aria-label="Search options" placeholder="Search options…"></div>';
  }

  entries.forEach(function(x){
    if(x.kind==='group'){
      html+='<div class="vx-select-group">'+esc(x.label)+'</div>';
      return;
    }
    var o=x.option;
    html+='<button type="button" class="vx-select-option" role="option" data-value="'+esc(o.value)+'" data-search="'+esc(((o.textContent||'')+' '+(x.group||'')).toLowerCase())+'" '+(o.disabled?'disabled':'')+'>'+
      '<span>'+esc(o.textContent)+'</span></button>';
  });

  html+='<div class="vx-select-empty" hidden>No matching options</div>';
  menu.innerHTML=html;

  menu.querySelectorAll('.vx-select-option').forEach(function(b){
    b.addEventListener('click',function(e){
      e.preventDefault();
      e.stopPropagation();
      if(b.disabled)return;
      var old=s.value;
      s.value=b.dataset.value;
      sync(s);
      close(w,true);
      if(old!==s.value)s.dispatchEvent(new Event('change',{bubbles:true}));
    });
  });

  var search=menu.querySelector('.vx-select-search');
  if(search){
    search.addEventListener('input',function(){filter(w,search.value);});
    search.addEventListener('keydown',function(e){
      if(e.key==='ArrowDown'||e.key==='ArrowUp'){
        e.preventDefault();
        moveFocus(w,e.key==='ArrowDown'?1:-1);
      }else if(e.key==='Enter'){
        var f=menu.querySelector('.vx-select-option.focused:not([hidden])');
        if(f){e.preventDefault();f.click();}
      }else if(e.key==='Escape'){
        e.preventDefault();close(w,true);
      }
    });
  }
  sync(s);
}

function position(w){
  var menu=w.querySelector('.vx-select-menu'),btn=w.querySelector('.vx-select-btn');
  if(!menu||!btn)return;
  menu.classList.remove('vx-select-menu-up');
  var r=btn.getBoundingClientRect();
  var below=window.innerHeight-r.bottom;
  var above=r.top;
  if(below<260&&above>below)menu.classList.add('vx-select-menu-up');
}

function moveFocus(w,d){
  var menu=w.querySelector('.vx-select-menu');if(!menu)return;
  var a=selectable(menu);if(!a.length)return;
  var cur=menu.querySelector('.vx-select-option.focused:not([hidden])');
  var i=cur?a.indexOf(cur):-1;
  if(cur)cur.classList.remove('focused');
  i=(i+d+a.length)%a.length;
  a[i].classList.add('focused');
  a[i].scrollIntoView({block:'nearest'});
}

function open(w){
  var s=w.querySelector('select'),menu=w.querySelector('.vx-select-menu'),btn=w.querySelector('.vx-select-btn');
  if(!s||!menu||!btn||s.disabled)return;
  if(OPEN&&OPEN!==w)close(OPEN,false);

  menu.hidden=false;
  w.classList.add('open');
  btn.setAttribute('aria-expanded','true');
  OPEN=w;
  position(w);

  var selected=menu.querySelector('.selected:not([disabled])')||selectable(menu)[0];
  if(selected){
    menu.querySelectorAll('.focused').forEach(function(n){n.classList.remove('focused');});
    selected.classList.add('focused');
    requestAnimationFrame(function(){selected.scrollIntoView({block:'nearest'});});
  }

  var search=menu.querySelector('.vx-select-search');
  if(search)requestAnimationFrame(function(){search.focus({preventScroll:true});});
}

function close(w,restore){
  w=w||OPEN;if(!w)return;
  var menu=w.querySelector('.vx-select-menu'),btn=w.querySelector('.vx-select-btn');
  w.classList.remove('open');
  if(menu){
    menu.hidden=true;
    menu.classList.remove('vx-select-menu-up');
  }
  var search=w.querySelector('.vx-select-search');
  if(search){search.value='';filter(w,'');}
  if(btn)btn.setAttribute('aria-expanded','false');
  if(OPEN===w)OPEN=null;
  if(restore&&btn)btn.focus({preventScroll:true});
}

function enhance(s){
  if(!eligible(s)||s._vxSelect)return;

  var w=document.createElement('div');
  w.className='vx-select';

  s.classList.add('vx-select-native');
  s.parentNode.insertBefore(w,s);
  w.appendChild(s);

  var btn=document.createElement('button');
  btn.type='button';
  btn.className='vx-select-btn';
  btn.setAttribute('aria-haspopup','listbox');
  btn.setAttribute('aria-expanded','false');
  btn.innerHTML='<span class="vx-select-value"></span><span class="vx-select-chevron" aria-hidden="true">⌄</span>';

  var menu=document.createElement('div');
  menu.className='vx-select-menu';
  menu.setAttribute('role','listbox');
  menu.hidden=true;

  w.appendChild(btn);
  w.appendChild(menu);
  s._vxSelect=w;

  rebuild(s);

  btn.addEventListener('click',function(e){
    e.preventDefault();
    e.stopPropagation();
    if(menu.hidden)open(w);else close(w,true);
  });

  btn.addEventListener('keydown',function(e){
    if(e.key==='ArrowDown'||e.key==='ArrowUp'){
      e.preventDefault();
      if(menu.hidden)open(w);else moveFocus(w,e.key==='ArrowDown'?1:-1);
    }else if(e.key==='Enter'||e.key===' '){
      e.preventDefault();
      if(menu.hidden)open(w);
      else{
        var f=menu.querySelector('.vx-select-option.focused:not([hidden])');
        if(f)f.click();
      }
    }else if(e.key==='Escape'&&!menu.hidden){
      e.preventDefault();close(w,true);
    }
  });

  s.addEventListener('change',function(){sync(s);});

  new MutationObserver(function(){rebuild(s);}).observe(s,{
    childList:true,
    subtree:true,
    attributes:true,
    attributeFilter:['disabled','label','value','selected']
  });
}

function scan(root){
  if(root&&root.nodeType===1&&root.matches&&root.matches('select'))enhance(root);
  if(root&&root.querySelectorAll)root.querySelectorAll('select').forEach(enhance);
}


document.addEventListener('pointerdown',function(e){
  var s=e.target&&e.target.closest&&e.target.closest('select');
  if(!eligible(s)||s._vxSelect)return;
  e.preventDefault();
  enhance(s);
  var w=s._vxSelect;
  if(w)requestAnimationFrame(function(){open(w);});
},true);
document.addEventListener('focusin',function(e){
  var s=e.target;
  if(eligible(s)&&!s._vxSelect)enhance(s);
},true);

document.addEventListener('click',function(e){
  if(OPEN&&!OPEN.contains(e.target))close(OPEN,false);
});
document.addEventListener('keydown',function(e){
  if(e.key==='Escape'&&OPEN)close(OPEN,true);
});
window.addEventListener('resize',function(){if(OPEN)position(OPEN);},{passive:true});
window.addEventListener('scroll',function(){if(OPEN)position(OPEN);},{passive:true,capture:true});

var observer=new MutationObserver(function(ms){
  ms.forEach(function(m){
    m.addedNodes.forEach(function(n){
      if(n.nodeType===1)scan(n);
    });
  });
});

function start(){
  scan(document);
  observer.observe(document.body,{childList:true,subtree:true});
}

if(document.readyState==='loading'){
  document.addEventListener('DOMContentLoaded',start,{once:true});
}else{
  start();
}

window.VEUX_SELECT_SYSTEM_161010={
  version:'16.10.16',
  scan:scan,
  rebuild:rebuild,
  sync:sync,
  open:open,
  close:close
};
})();

;/* END veux-agent-v16.10.16-dropdown-system.js */

;/* BEGIN veux-agent-v16.10.16-vera-official.js */

(function(){
'use strict';
if(window.__VEUX_VERA_OFFICIAL_161006__)return;
window.__VEUX_VERA_OFFICIAL_161006__=true;

var mount=window.__VEUX_AGENT_MOUNT__;
if(mount==null)mount=/^\/(?:admin|team)(?:\/|$)/.test(location.pathname)?'/admin':'';

var MARK_SRC=mount+'/assets/vera/vera-mark.svg?v=16.10.16';
var AVATAR_SRC=mount+'/assets/vera/vera-avatar-circle.svg?v=16.10.16';

function markHTML(cls){
  return '<img class="vera-mark-img'+(cls?' '+cls:'')+'" src="'+MARK_SRC+'" alt="">';
}
function avatarHTML(cls){
  return '<img class="vera-avatar-img'+(cls?' '+cls:'')+'" src="'+AVATAR_SRC+'" alt="">';
}
function replaceLegacyMark(node,useAvatar){
  if(!node||node.dataset.veraOfficial==='1')return;
  var replacement=document.createElement('img');
  replacement.className=useAvatar?'vera-avatar-img':'vera-mark-img';
  replacement.src=useAvatar?AVATAR_SRC:MARK_SRC;
  replacement.alt='';
  replacement.setAttribute('aria-hidden','true');
  node.replaceWith(replacement);
}
function enhanceCommand(root){
  root.querySelectorAll('.vx73-command').forEach(function(cmd){
    var legacy=cmd.querySelector(':scope > .vera-mark');
    if(legacy)replaceLegacyMark(legacy,false);

    var first=cmd.firstElementChild;
    if(first && first.tagName==='I'){
      var img=document.createElement('img');
      img.className='vera-mark-img';
      img.src=MARK_SRC;img.alt='';img.setAttribute('aria-hidden','true');
      first.replaceWith(img);
    }

    var input=cmd.querySelector('input');
    if(input){
      input.setAttribute('aria-label','Ask Vera');
      input.setAttribute('placeholder','Ask Vera to plan, move or resolve…');
    }

    var button=cmd.querySelector('button');
    if(button){
      button.title='Vera Intelligence';
      button.setAttribute('aria-label','Open Vera Intelligence');
      var lm=button.querySelector('.vera-mark');
      if(lm)replaceLegacyMark(lm,false);
      if(!button.querySelector('.vera-mark-img')){
        var glyph=(button.textContent||'').trim();
        if(glyph==='✦'||glyph==='✧')button.innerHTML=markHTML();
      }
    }
  });
}
function enhanceIntelligence(root){
  root.querySelectorAll('.vx95-intelligence > header').forEach(function(h){
    var legacy=h.querySelector(':scope > .vera-mark');
    if(legacy)replaceLegacyMark(legacy,false);
    var glyph=h.querySelector(':scope > i');
    if(glyph){
      var img=document.createElement('img');
      img.className='vera-mark-img';img.src=MARK_SRC;img.alt='';img.setAttribute('aria-hidden','true');
      glyph.replaceWith(img);
    }
  });
}
function enhanceLauncher(){
  var b=document.getElementById('_asst-btn');
  if(!b)return;
  b.classList.add('vera-launcher');
  b.title='Vera';
  b.setAttribute('aria-label','Open Vera');
  if(!b.querySelector('.vera-avatar-img')){
    b.innerHTML=avatarHTML();
  }
}
function enhancePanel(){
  var p=document.getElementById('_asst-panel');
  if(!p)return;

  var header=p.firstElementChild;
  if(header && !header.querySelector('.vera-panel-identity')){
    var info=header.firstElementChild;
    if(info){
      info.classList.add('vera-panel-identity');
      info.innerHTML=avatarHTML()+
        '<div><div class="vera-panel-kicker">VEUX AGENT · INTELLIGENCE</div>'+
        '<div class="vera-panel-name">Vera</div>'+
        '<div class="vera-panel-sub" id="_vera-panel-sub">System intelligence</div>'+
        '<div id="_asst-status" style="font:8px var(--fM);letter-spacing:.08em;text-transform:uppercase;color:var(--mute);margin-top:4px">Checking provider…</div></div>';
    }
  }
}
function enhanceMessageLabels(root){
  var box=document.getElementById('_asst-msgs');
  if(!box)return;
  Array.from(box.children).forEach(function(msg){
    if(msg.dataset.veraMessageDone==='1')return;
    var first=msg.firstElementChild;
    if(!first)return;
    var label=(first.textContent||'').trim();
    if(/^Vera(?: Intelligence)?(?:\s*·|$)/i.test(label)){
      first.className='vera-message-head';
      first.innerHTML=markHTML()+'<span class="vera-message-label">'+label.replace(/^Vera Intelligence/i,'Vera')+'</span>';
      msg.dataset.veraMessageDone='1';
    }
  });
}
function apply(root){
  root=root||document;
  if(root.querySelectorAll){
    root.querySelectorAll('.vera-mark').forEach(function(n){
      if(n.closest('#_asst-btn'))replaceLegacyMark(n,true);
      else replaceLegacyMark(n,false);
    });
    enhanceCommand(root);
    enhanceIntelligence(root);
  }
  enhanceLauncher();
  enhancePanel();
  enhanceMessageLabels(root);
}
function start(){
  apply(document);
  new MutationObserver(function(ms){
    var needs=false;
    ms.forEach(function(m){
      if(m.addedNodes&&m.addedNodes.length)needs=true;
    });
    if(needs)requestAnimationFrame(function(){apply(document);});
  }).observe(document.body,{childList:true,subtree:true});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();

window.VERA={
  name:'Vera',
  product:'VEUX Agent',
  markSrc:MARK_SRC,
  avatarSrc:AVATAR_SRC,
  refresh:function(){apply(document);}
};
})();

;/* END veux-agent-v16.10.16-vera-official.js */

;/* BEGIN cavyre-command-deep-link-16.10.87.js */
(function(){'use strict';if(window.__CAVYRE_COMMAND_DEEPLINK_161087__)return;window.__CAVYRE_COMMAND_DEEPLINK_161087__=true;
function read(){try{return JSON.parse(sessionStorage.getItem('cavyre.command.focus')||'null')}catch(e){return null}}
function esc(v){try{return CSS.escape(String(v))}catch(e){return String(v).replace(/["\\]/g,'\\$&')}}
function clear(){try{sessionStorage.removeItem('cavyre.command.focus')}catch(e){}}
function resolve(){
 var f=read();if(!f||!f.id||Date.now()-Number(f.at||0)>120000){if(f)clear();return false}
 var id=esc(f.id),type=esc(f.type||'record');
 var sels=['[data-'+type+'-id="'+id+'"]','[data-record-id="'+id+'"]','[data-id="'+id+'"]','#'+type+'-'+id,'#record-'+id];
 if(type==='model')sels.unshift('[data-v155-roster-id="'+id+'"]');
 if(type==='package')sels.unshift('[data-v155-package-id="'+id+'"]');
 if(type==='booking')sels.unshift('[data-booking-id="'+id+'"]');
 if(type==='casting')sels.unshift('[data-casting-id="'+id+'"]');
 if(type==='invoice')sels.unshift('[data-invoice-id="'+id+'"]');
 if(type==='travel')sels.unshift('[data-travel-id="'+id+'"]');
 var node=null;for(var i=0;i<sels.length&&!node;i++){try{node=document.querySelector(sels[i])}catch(e){}}
 if(!node)return false;
 node.scrollIntoView({behavior:'smooth',block:'center'});
 node.classList.add('cavyre-command-focus-target');
 node.setAttribute('data-cavyre-command-focus','true');
 setTimeout(function(){node.classList.remove('cavyre-command-focus-target');node.removeAttribute('data-cavyre-command-focus')},5200);
 try{node.dispatchEvent(new CustomEvent('cavyre:record-focus',{bubbles:true,detail:f}))}catch(e){}
 clear();return true
}
var timer=0;function schedule(){clearTimeout(timer);timer=setTimeout(resolve,180)}
window.addEventListener('cavyre:command-focus',schedule);
window.addEventListener('hashchange',schedule);
document.addEventListener('click',function(){setTimeout(schedule,220)},true);
new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true});
setTimeout(resolve,500);
})();
;/* END cavyre-command-deep-link-16.10.87.js */

;/* BEGIN cavyre-global-command-search-16.10.90.js */
(function(){
'use strict';
if(window.__CAVYRE_GLOBAL_SEARCH_161090__)return;window.__CAVYRE_GLOBAL_SEARCH_161090__=true;
var cache={at:0,rows:[]},active=0,overlay=null,input=null,list=null,loading=false;
function arr(v){return Array.isArray(v)?v:[]}
function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function org(){try{var s=window.VEUX_AGENT_V4&&VEUX_AGENT_V4.state||{},o=s.org||{};return o.slug||o.id||'maison-de-veux'}catch(e){return'maison-de-veux'}}
function api(path){if(window.VEUX_AGENT_V4&&typeof VEUX_AGENT_V4.api==='function')return VEUX_AGENT_V4.api(path,{method:'GET',headers:{},__fresh:true});return fetch(path,{credentials:'same-origin'}).then(function(r){if(!r.ok)throw new Error('HTTP '+r.status);return r.json()})}
function label(o,keys,fallback){for(var i=0;i<keys.length;i++){var v=o&&o[keys[i]];if(v!=null&&String(v).trim())return String(v)}return fallback||'Untitled'}
function sub(parts){return parts.filter(Boolean).join(' · ')}
function push(out,type,route,id,title,subtitle,raw){if(!id&&type!=='calendar')return;out.push({type:type,route:route,id:id||'',title:title||'Untitled',subtitle:subtitle||'',raw:raw||{}})}
function normalize(data){
 var out=[],cal=data.cal||{},fin=data.fin||{},ro=data.ro||{},crm=data.crm||{},packs=data.packs||{},mob=data.mob||{};
 arr(ro.models||ro.roster||ro.talent).forEach(function(x){push(out,'model','roster',x.id||x.model_id,label(x,['display_name','name'],'Model'),sub([x.primary_market_label,x.stage,x.status,x.location]),x)});
 arr(crm.companies||crm.clients||crm.organizations).forEach(function(x){push(out,'client','industrydirectory',x.id||x.company_id,label(x,['name','company_name','display_name'],'Client'),sub([x.category||x.type,x.city||x.location,x.relationship_status||x.status]),x)});
 arr(crm.contacts).forEach(function(x){push(out,'contact','industrydirectory',x.id||x.contact_id,label(x,['display_name','name','full_name','email'],'Contact'),sub([x.title||x.role,x.company_name||x.company&&x.company.name,x.email]),x)});
 arr(cal.bookings).forEach(function(x){push(out,'booking','calendar',x.id||x.booking_id,label(x,['title'],'Booking'),sub([x.company&&x.company.name||x.client_name,x.location,x.market_name||x.market&&x.market.name,x.status]),x)});
 arr(cal.castings).forEach(function(x){push(out,'casting','calendar',x.id||x.casting_id,label(x,['title'],'Casting'),sub([x.company&&x.company.name||x.client_name,x.location,x.market_name||x.market&&x.market.name,x.status]),x)});
 arr(cal.events).forEach(function(x){push(out,'event','calendar',x.id||x.event_id,label(x,['title'],'Calendar Event'),sub([x.event_type||x.type,x.location,x.status]),x)});
 arr(fin.invoices).forEach(function(x){push(out,'invoice','financelegal',x.id||x.invoice_id,label(x,['invoice_number','number','title'],'Invoice'),sub([x.client_name||x.company&&x.company.name,x.status,x.due_date]),x)});
 var pkgRows=[].concat(arr(packs.packages),arr(packs.open_feedback),arr(packs.client_model_signals));
 pkgRows.forEach(function(x){var id=x.package_id||x.id;if(!id)return;push(out,'package','multipackage',id,label(x,['name','title','package_name'],'Package'),sub([x.client_name||x.client&&x.client.name,x.status||x.feedback_type,x.models&&x.models.display_name]),x)});
 arr(mob.travel).forEach(function(x){push(out,'travel','globalmobility',x.id||x.travel_id,label(x,['purpose'],'Travel'),sub([x.origin&&x.destination?x.origin+' → '+x.destination:x.destination,x.status,x.starts_at]),x)});
 arr(mob.visa_cases||mob.visas).forEach(function(x){push(out,'visa','globalmobility',x.id||x.visa_id,label(x,['case_title','visa_type','title'],'Visa'),sub([x.country||x.destination,x.status,x.expires_on||x.expiry_date]),x)});
 return out;
}
async function load(){
 if(cache.rows.length&&Date.now()-cache.at<60000)return cache.rows;
 if(loading)return cache.rows;
 loading=true;
 try{
  var now=new Date(),s=new Date(now);s.setFullYear(s.getFullYear()-1);var e=new Date(now);e.setFullYear(e.getFullYear()+1),o=encodeURIComponent(org());
  var paths=[
   '/api/agent/calendar/v9?organization='+o+'&start='+encodeURIComponent(s.toISOString())+'&end='+encodeURIComponent(e.toISOString()),
   '/api/agent/finance?organization='+o,
   '/api/agent/roster/v10?organization='+o,
   '/api/agent/crm/v9?organization='+o,
   '/api/agent/packages?organization='+o,
   '/api/agent/mobility?organization='+o
  ];
  var res=await Promise.allSettled(paths.map(api)),v=function(i){return res[i].status==='fulfilled'?(res[i].value||{}):{}};
  cache={at:Date.now(),rows:normalize({cal:v(0),fin:v(1),ro:v(2),crm:v(3),packs:v(4),mob:v(5)})};
 }finally{loading=false}
 return cache.rows;
}
function score(row,q){
 q=q.toLowerCase().trim();if(!q)return 1;
 var title=row.title.toLowerCase(),subt=row.subtitle.toLowerCase(),type=row.type.toLowerCase(),s=0;
 if(title===q)s+=120;else if(title.indexOf(q)===0)s+=90;else if(title.indexOf(q)>=0)s+=70;
 if(type===q||type.indexOf(q)===0)s+=35;
 if(subt.indexOf(q)>=0)s+=25;
 q.split(/\s+/).filter(Boolean).forEach(function(w){if(title.indexOf(w)>=0)s+=15;if(subt.indexOf(w)>=0)s+=6});
 return s;
}
function results(q){return cache.rows.map(function(r){return {r:r,s:score(r,q)}}).filter(function(x){return x.s>0}).sort(function(a,b){return b.s-a.s||a.r.title.localeCompare(b.r.title)}).slice(0,30).map(function(x){return x.r})}
function typeLabel(t){return {model:'Model',client:'Client',contact:'Contact',booking:'Booking',casting:'Casting',event:'Calendar',invoice:'Invoice',package:'Package',travel:'Travel',visa:'Visa'}[t]||t}
function render(){
 if(!list)return;var q=input.value.trim(),rows=results(q);active=Math.max(0,Math.min(active,rows.length-1));
 if(!cache.rows.length&&loading){list.innerHTML='<div class="vx161090-empty">Loading agency index…</div>';return}
 if(!rows.length){list.innerHTML='<div class="vx161090-empty">No matching agency records.</div>';return}
 list.innerHTML=rows.map(function(r,i){return '<button class="vx161090-result '+(i===active?'on':'')+'" data-i="'+i+'"><span class="vx161090-type">'+esc(typeLabel(r.type))+'</span><div><b>'+esc(r.title)+'</b><small>'+esc(r.subtitle||'Open record')+'</small></div><em>↵</em></button>'}).join('');
 list.querySelectorAll('.vx161090-result').forEach(function(b){b.onmouseenter=function(){active=Number(b.dataset.i);paintActive()};b.onclick=function(){openRow(rows[Number(b.dataset.i)])}});
}
function paintActive(){if(!list)return;list.querySelectorAll('.vx161090-result').forEach(function(b){b.classList.toggle('on',Number(b.dataset.i)===active)});var n=list.querySelector('.vx161090-result.on');if(n)n.scrollIntoView({block:'nearest'})}
function focusContract(r){
 try{sessionStorage.setItem('cavyre.command.focus',JSON.stringify({type:r.type,id:r.id,source:'global-search',at:Date.now()}))}catch(e){}
 try{window.dispatchEvent(new CustomEvent('cavyre:command-focus',{detail:{type:r.type,id:r.id,source:'global-search'}}))}catch(e){}
}
function openRow(r){
 if(!r)return;focusContract(r);close();
 if(typeof window.navTo==='function')window.navTo(r.route);
 setTimeout(function(){try{window.dispatchEvent(new CustomEvent('cavyre:global-search-open',{detail:r}))}catch(e){}},180);
}
function open(){
 ensure();overlay.hidden=false;document.documentElement.classList.add('vx161090-search-open');active=0;
 requestAnimationFrame(function(){input.focus();input.select()});
 load().then(render).catch(function(){if(list)list.innerHTML='<div class="vx161090-empty">Search index could not be loaded.</div>'});
 render();
}
function close(){if(!overlay)return;overlay.hidden=true;document.documentElement.classList.remove('vx161090-search-open')}
function ensure(){
 if(overlay)return;
 overlay=document.createElement('div');overlay.id='vx161090-search';overlay.className='vx161090-search';overlay.hidden=true;
 overlay.innerHTML='<div class="vx161090-backdrop"></div><section role="dialog" aria-modal="true" aria-label="Global agency search"><header><span>GLOBAL COMMAND</span><button type="button" aria-label="Close">×</button></header><div class="vx161090-inputwrap"><i>⌕</i><input autocomplete="off" spellcheck="false" placeholder="Search models, clients, bookings, travel, invoices…"><kbd>ESC</kbd></div><div class="vx161090-list"></div><footer><span><kbd>↑</kbd><kbd>↓</kbd> Navigate</span><span><kbd>↵</kbd> Open</span><span><kbd>⌘K</kbd> Search anywhere</span></footer></section>';
 document.body.appendChild(overlay);input=overlay.querySelector('input');list=overlay.querySelector('.vx161090-list');
 overlay.querySelector('.vx161090-backdrop').onclick=close;overlay.querySelector('header button').onclick=close;
 input.oninput=function(){active=0;render()};
 input.onkeydown=function(e){var rows=results(input.value.trim());if(e.key==='ArrowDown'){e.preventDefault();active=Math.min(rows.length-1,active+1);paintActive()}else if(e.key==='ArrowUp'){e.preventDefault();active=Math.max(0,active-1);paintActive()}else if(e.key==='Enter'){e.preventDefault();openRow(rows[active])}else if(e.key==='Escape'){e.preventDefault();close()}};
}
function attach(){
 var cmd=document.querySelector('.vx73-command');if(!cmd||cmd.querySelector('.vx161090-search-btn'))return;
 var b=document.createElement('button');b.type='button';b.className='vx161090-search-btn';b.title='Global Search · ⌘K';b.setAttribute('aria-label','Open Global Search');b.innerHTML='<span>⌕</span><small>Search</small>';
 b.onclick=function(e){e.preventDefault();e.stopPropagation();open()};cmd.appendChild(b);
}
document.addEventListener('keydown',function(e){if((e.metaKey||e.ctrlKey)&&String(e.key).toLowerCase()==='k'){e.preventDefault();open()}else if(e.key==='Escape'&&overlay&&!overlay.hidden)close()});
window.addEventListener('veux:agency-v16-shell-ready',function(){setTimeout(attach,0)});
window.addEventListener('veux:shell-ready',function(){setTimeout(attach,0)});
new MutationObserver(function(){attach()}).observe(document.documentElement,{childList:true,subtree:true});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',attach,{once:true});else attach();
window.CAVYRE_GLOBAL_SEARCH={open:open,close:close,refresh:function(){cache={at:0,rows:[]};return load()},version:'16.10.90'};
})();
;/* END cavyre-global-command-search-16.10.90.js */

;/* BEGIN cavyre-production-hardening-16.10.91.js */
(function(){'use strict';
if(window.__CAVYRE_HARDENING_161091__)return;window.__CAVYRE_HARDENING_161091__=true;
var VERSION='16.10.91',errors=[],apiFailures=[],routeFailures=[];
function now(){return new Date().toISOString()} function safe(v){try{return String(v==null?'':v).slice(0,600)}catch(e){return''}}
function record(kind,msg,meta){errors.push({at:now(),kind:kind,message:safe(msg),meta:meta||{}});if(errors.length>40)errors.shift();try{sessionStorage.setItem('cavyre.runtime.errors',JSON.stringify(errors))}catch(e){}}
addEventListener('error',function(e){record('error',e.message,{source:e.filename||'',line:e.lineno||0})});
addEventListener('unhandledrejection',function(e){record('promise',e.reason&&e.reason.message||e.reason||'Unhandled rejection',{})});
function route(){var p=location.pathname.replace(/\/+$/,'')||'/';if(/^\/(?:admin|team)\/.+/.test(p)&&!/^\/(?:admin|team)(?:\/(?:calendar|roster|models?|clients?|bookings?|castings?|travel|mobility|finance|packages?|tasks?|settings)?)?$/i.test(p)){routeFailures.push({at:now(),path:p});try{history.replaceState(history.state,'','/admin'+location.search+location.hash)}catch(e){}}}
function patchFetch(){var raw=window.fetch;if(!raw||raw.__cavyre161091)return;function wrapped(input,init){var url=typeof input==='string'?input:(input&&input.url)||'';return raw.apply(this,arguments).then(function(r){if(/\/api\/agent\//.test(url)&&!r.ok){apiFailures.push({at:now(),url:url,status:r.status});if(apiFailures.length>40)apiFailures.shift()}return r}).catch(function(err){if(/\/api\/agent\//.test(url)){apiFailures.push({at:now(),url:url,status:0,error:safe(err&&err.message||err)});if(apiFailures.length>40)apiFailures.shift()}throw err})}wrapped.__cavyre161091=true;window.fetch=wrapped}
function shell(){return{app:!!document.getElementById('app'),main:!!document.querySelector('main'),rail:!!document.getElementById('vx73-rail'),vera:!!document.querySelector('.vx73-command'),search:!!window.CAVYRE_GLOBAL_SEARCH}}
function clearStale(){try{if('caches'in window)caches.keys().then(function(keys){keys.filter(function(k){return /cavyre-agent-shell|veux-agent/i.test(k)&&k.indexOf('16.10.91')<0}).forEach(function(k){caches.delete(k)})})}catch(e){}}
function diagnostics(){return{version:VERSION,at:now(),path:location.pathname,shell:shell(),runtimeErrors:errors.slice(),apiFailures:apiFailures.slice(),routeFailures:routeFailures.slice(),online:navigator.onLine,serviceWorker:!!navigator.serviceWorker}}
route();patchFetch();clearStale();addEventListener('popstate',route);
addEventListener('veux:shell-ready',function(){setTimeout(function(){var s=shell();if(!s.app||!s.main)record('shell','Required shell surface missing',s)},100)});
window.CAVYRE_RELEASE={version:VERSION,diagnostics:diagnostics,clearRuntimeErrors:function(){errors=[];try{sessionStorage.removeItem('cavyre.runtime.errors')}catch(e){}},refreshSearch:function(){return window.CAVYRE_GLOBAL_SEARCH&&CAVYRE_GLOBAL_SEARCH.refresh?CAVYRE_GLOBAL_SEARCH.refresh():Promise.resolve([])}};
dispatchEvent(new CustomEvent('cavyre:release-ready',{detail:{version:VERSION}}));
})();
;/* END cavyre-production-hardening-16.10.91.js */

;/* BEGIN cavyre-lifecycle-freeze-16.10.92.js */
(function(){
'use strict';
if(window.__CAVYRE_LIFECYCLE_FREEZE_161092__)return;
window.__CAVYRE_LIFECYCLE_FREEZE_161092__=true;
var VERSION='16.10.92';
var REQUIRED=[
 {name:'shell',test:function(){return !!document.getElementById('app')}},
 {name:'main',test:function(){return !!document.querySelector('main')}},
 {name:'release-diagnostics',test:function(){return !!(window.CAVYRE_RELEASE&&CAVYRE_RELEASE.diagnostics)}},
 {name:'global-search',test:function(){return !!window.CAVYRE_GLOBAL_SEARCH}},
 {name:'vera-command',test:function(){return !!document.querySelector('.vx73-command')}},
 {name:'agent-rail',test:function(){return !!document.getElementById('vx73-rail')}}
];
function check(){
 var checks=REQUIRED.map(function(x){var ok=false;try{ok=!!x.test()}catch(e){}return{name:x.name,ok:ok}});
 var failed=checks.filter(function(x){return !x.ok});
 return {version:VERSION,at:new Date().toISOString(),path:location.pathname,ready:failed.length===0,checks:checks,failed:failed.map(function(x){return x.name})};
}
function report(){
 var r=check();
 try{sessionStorage.setItem('cavyre.lifecycle.last',JSON.stringify(r))}catch(e){}
 window.dispatchEvent(new CustomEvent('cavyre:lifecycle-check',{detail:r}));
 return r;
}
function routeContract(){
 var p=location.pathname.replace(/\/+$/,'')||'/';
 var known=/^\/(?:admin|team)(?:\/(?:calendar|roster|models?|clients?|bookings?|castings?|travel|mobility|finance|packages?|tasks?|settings)?)?$/i;
 return {path:p,agentRoute:!/^\/(?:admin|team)/.test(p)||known.test(p)};
}
window.CAVYRE_FREEZE={
 version:VERSION,
 check:report,
 routeContract:routeContract,
 diagnostics:function(){
  var release=window.CAVYRE_RELEASE&&CAVYRE_RELEASE.diagnostics?CAVYRE_RELEASE.diagnostics():null;
  return {freeze:report(),route:routeContract(),release:release};
 }
};
function boot(){setTimeout(report,350)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
window.addEventListener('cavyre:release-ready',boot);
})();
;/* END cavyre-lifecycle-freeze-16.10.92.js */

;/* BEGIN cavyre-release-certification-16.10.93.js */
(function(){'use strict';if(window.__CAVYRE_CERT_161093__)return;window.__CAVYRE_CERT_161093__=true;var VERSION='16.10.93';function run(){var tests=[['Application shell',function(){return!!document.getElementById('app')}],['Primary workspace',function(){return!!document.querySelector('main')}],['Agency rail',function(){return!!document.getElementById('vx73-rail')}],['Vera command',function(){return!!document.querySelector('.vx73-command')}],['Global search',function(){return!!window.CAVYRE_GLOBAL_SEARCH}],['Release diagnostics',function(){return!!(window.CAVYRE_RELEASE&&CAVYRE_RELEASE.diagnostics)}],['Lifecycle freeze',function(){return!!(window.CAVYRE_FREEZE&&CAVYRE_FREEZE.check)}]];var results=tests.map(function(t){var ok=false;try{ok=!!t[1]()}catch(e){}return{name:t[0],ok:ok}});var out={version:VERSION,at:new Date().toISOString(),certified:results.every(function(x){return x.ok}),results:results};try{sessionStorage.setItem('cavyre.release.certification',JSON.stringify(out))}catch(e){};dispatchEvent(new CustomEvent('cavyre:release-certification',{detail:out}));return out}window.CAVYRE_CERTIFICATION={version:VERSION,run:run};function boot(){setTimeout(run,650)}if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();addEventListener('cavyre:release-ready',boot);})();
;/* END cavyre-release-certification-16.10.93.js */

;/* BEGIN cavyre-predeploy-acceptance-16.10.94.js */
(function(){
'use strict';if(window.__CAVYRE_ACCEPT_161094__)return;window.__CAVYRE_ACCEPT_161094__=true;
var V='16.10.94';
function test(name,fn){var ok=false,detail='';try{ok=!!fn()}catch(e){detail=String(e&&e.message||e)}return{name:name,ok:ok,detail:detail}}
function run(){
 var r=[
  test('Application shell',function(){return!!document.getElementById('app')}),
  test('Primary workspace',function(){return!!document.querySelector('main')}),
  test('Agency navigation rail',function(){return!!document.getElementById('vx73-rail')}),
  test('Vera command',function(){return!!document.querySelector('.vx73-command')}),
  test('Global Search',function(){return!!(window.CAVYRE_GLOBAL_SEARCH&&CAVYRE_GLOBAL_SEARCH.open)}),
  test('Production diagnostics',function(){return!!(window.CAVYRE_RELEASE&&CAVYRE_RELEASE.diagnostics)}),
  test('Lifecycle freeze',function(){return!!(window.CAVYRE_FREEZE&&CAVYRE_FREEZE.check)}),
  test('Release certification',function(){return!!(window.CAVYRE_CERTIFICATION&&CAVYRE_CERTIFICATION.run)}),
  test('Mobility route authority',function(){return!!window.__CAVYRE_MOBILITY_ROUTE_161089__}),
  test('Online state',function(){return navigator.onLine!==false})
 ];
 var d=window.CAVYRE_RELEASE&&CAVYRE_RELEASE.diagnostics?CAVYRE_RELEASE.diagnostics():null;
 var out={version:V,at:new Date().toISOString(),pass:r.every(function(x){return x.ok}),tests:r,release:d};
 try{sessionStorage.setItem('cavyre.acceptance.last',JSON.stringify(out))}catch(e){}
 dispatchEvent(new CustomEvent('cavyre:acceptance',{detail:out}));return out;
}
window.CAVYRE_ACCEPTANCE={version:V,run:run};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){setTimeout(run,900)},{once:true});else setTimeout(run,900);
})();
;/* END cavyre-predeploy-acceptance-16.10.94.js */

;/* BEGIN cavyre-agency-command-sections-polish-16.10.97.js */
(function(){
'use strict';if(window.__CAVYRE_CMD_SECTIONS_161097__)return;window.__CAVYRE_CMD_SECTIONS_161097__=true;
function repair(){
  document.querySelectorAll('.vx161061-mobility,.vx161063-finance,.vx161062-relationship').forEach(function(sec){
    sec.setAttribute('data-vx161097-polished','true');
    sec.querySelectorAll('button').forEach(function(b){
      if(!b.getAttribute('aria-label')){
        var txt=(b.textContent||'Open section').replace(/\s+/g,' ').trim();
        if(txt)b.setAttribute('aria-label',txt);
      }
    });
  });
  
  
}
var pending=false;function schedule(){if(pending)return;pending=true;requestAnimationFrame(function(){pending=false;repair()})}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule,{once:true});else schedule();
new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true});
window.addEventListener('veux:shell-ready',schedule);
})();
;/* END cavyre-agency-command-sections-polish-16.10.97.js */
