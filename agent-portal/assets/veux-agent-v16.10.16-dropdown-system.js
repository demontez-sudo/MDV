
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
  if(s.__mdv||s.closest('.mdv-dd'))return;
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
