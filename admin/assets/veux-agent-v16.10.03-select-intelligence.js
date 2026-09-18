
(function(){
'use strict';
if(window.VEUX_SELECT_SYSTEM_161003)return;

var OPEN=null, uid=0;
var SEARCH_THRESHOLD=8;

function esc(v){
  return String(v==null?'':v).replace(/[&<>"']/g,function(c){
    return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c];
  });
}
function eligible(s){
  return s&&s.tagName==='SELECT'&&!s.multiple&&!(s.size>1)&&!s.dataset.vxSelectIgnore;
}
function optionNodes(s){
  var out=[];
  Array.prototype.forEach.call(s.children,function(n){
    if(n.tagName==='OPTGROUP'){
      out.push({group:true,label:n.label||''});
      Array.prototype.forEach.call(n.children,function(o){
        if(o.tagName==='OPTION')out.push({option:o,groupLabel:n.label||''});
      });
    }else if(n.tagName==='OPTION'){
      out.push({option:n,groupLabel:''});
    }
  });
  return out;
}
function getSelectableButtons(menu){
  return Array.from(menu.querySelectorAll('.vx-select-option:not([disabled]):not([hidden])'));
}
function close(w,restore){
  w=w||OPEN;if(!w)return;
  w.classList.remove('open');
  var menu=w.querySelector('.vx-select-menu'),btn=w.querySelector('.vx-select-btn');
  if(menu){
    menu.hidden=true;
    menu.classList.remove('vx-select-menu-up');
  }
  var search=w.querySelector('.vx-select-search');
  if(search){search.value='';filterMenu(w,'');}
  if(btn)btn.setAttribute('aria-expanded','false');
  if(OPEN===w)OPEN=null;
  if(restore&&btn)btn.focus({preventScroll:true});
}
function sync(s){
  var w=s._vxSelect;if(!w)return;
  var btn=w.querySelector('.vx-select-btn'), value=w.querySelector('.vx-select-value');
  var selected=s.options[s.selectedIndex];
  var placeholder=!selected || selected.disabled || selected.value==='';
  if(value)value.textContent=selected?selected.textContent:'Select';
  if(btn){
    btn.disabled=!!s.disabled;
    btn.setAttribute('aria-disabled',s.disabled?'true':'false');
    btn.dataset.placeholder=placeholder?'true':'false';
  }
  w.querySelectorAll('.vx-select-option').forEach(function(b){
    var on=b.dataset.value===String(s.value);
    b.classList.toggle('selected',on);
    b.setAttribute('aria-selected',on?'true':'false');
  });
}
function optionClass(o){
  var t=(o.textContent||'').toLowerCase();
  if(/conflict|declin|cancel|reject|risk/.test(t))return ' vx-option-risk';
  if(/confirm|approve|accept|booked|complete/.test(t))return ' vx-option-positive';
  return '';
}
function rebuild(s){
  var w=s._vxSelect;if(!w)return;
  var menu=w.querySelector('.vx-select-menu');if(!menu)return;

  var nodes=optionNodes(s);
  var optionCount=nodes.filter(function(x){return !!x.option;}).length;
  var html='';

  if(optionCount>=SEARCH_THRESHOLD){
    html+='<div class="vx-select-search-wrap"><input class="vx-select-search" type="search" autocomplete="off" spellcheck="false" aria-label="Search options" placeholder="Search options…"></div>';
  }

  nodes.forEach(function(x){
    if(x.group){
      html+='<div class="vx-select-group" data-group-label="'+esc(x.label.toLowerCase())+'">'+esc(x.label)+'</div>';
      return;
    }
    var o=x.option;
    var meta=o.dataset.meta||'';
    html+='<button type="button" class="vx-select-option'+optionClass(o)+'" role="option" data-value="'+esc(o.value)+'" data-search="'+esc(((o.textContent||'')+' '+meta+' '+(x.groupLabel||'')).toLowerCase())+'" '+(o.disabled?'disabled':'')+'>'+
          '<span>'+esc(o.textContent)+'</span>'+(meta?'<span class="vx-select-meta">'+esc(meta)+'</span>':'')+
          '</button>';
  });
  html+='<div class="vx-select-empty" hidden>No matching options</div>';

  menu.innerHTML=html;

  menu.querySelectorAll('.vx-select-option').forEach(function(b){
    b.addEventListener('click',function(e){
      e.preventDefault();e.stopPropagation();
      if(b.disabled)return;
      var old=s.value;
      s.value=b.dataset.value;
      sync(s);close(w,true);
      if(old!==s.value)s.dispatchEvent(new Event('change',{bubbles:true}));
    });
  });

  var search=menu.querySelector('.vx-select-search');
  if(search){
    search.addEventListener('input',function(){filterMenu(w,search.value);});
    search.addEventListener('keydown',function(e){
      if(e.key==='ArrowDown'||e.key==='ArrowUp'){
        e.preventDefault();moveFocus(w,e.key==='ArrowDown'?1:-1);
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
function filterMenu(w,q){
  var menu=w.querySelector('.vx-select-menu');if(!menu)return;
  var query=String(q||'').trim().toLowerCase();
  var any=false;
  menu.querySelectorAll('.vx-select-option').forEach(function(b){
    var show=!query || (b.dataset.search||'').indexOf(query)!==-1;
    b.hidden=!show;if(show)any=true;
    b.classList.remove('focused');
  });

  // Only show group headings that still have at least one visible option below them.
  var children=Array.from(menu.children);
  children.forEach(function(n,i){
    if(!n.classList.contains('vx-select-group'))return;
    var visible=false;
    for(var j=i+1;j<children.length;j++){
      if(children[j].classList.contains('vx-select-group'))break;
      if(children[j].classList.contains('vx-select-option')&&!children[j].hidden){visible=true;break;}
    }
    n.hidden=!visible;
  });

  var empty=menu.querySelector('.vx-select-empty');
  if(empty)empty.hidden=any;
  var first=getSelectableButtons(menu)[0];
  if(first)first.classList.add('focused');
}
function moveFocus(w,delta){
  var menu=w.querySelector('.vx-select-menu');if(!menu)return;
  var a=getSelectableButtons(menu);if(!a.length)return;
  var cur=menu.querySelector('.vx-select-option.focused:not([hidden])');
  var i=cur?a.indexOf(cur):-1;
  if(cur)cur.classList.remove('focused');
  i=(i+delta+a.length)%a.length;
  a[i].classList.add('focused');
  a[i].scrollIntoView({block:'nearest'});
}
function positionMenu(w){
  var menu=w.querySelector('.vx-select-menu'),btn=w.querySelector('.vx-select-btn');
  if(!menu||!btn)return;
  menu.classList.remove('vx-select-menu-up');
  var r=btn.getBoundingClientRect();
  var below=window.innerHeight-r.bottom;
  var above=r.top;
  if(below<260&&above>below)menu.classList.add('vx-select-menu-up');
}
function open(w){
  var s=w.querySelector('select'),menu=w.querySelector('.vx-select-menu'),btn=w.querySelector('.vx-select-btn');
  if(!s||!menu||!btn||s.disabled)return;
  if(OPEN&&OPEN!==w)close(OPEN,false);
  menu.hidden=false;w.classList.add('open');btn.setAttribute('aria-expanded','true');OPEN=w;
  positionMenu(w);

  var selected=menu.querySelector('.selected:not([disabled])')||getSelectableButtons(menu)[0];
  if(selected){
    menu.querySelectorAll('.focused').forEach(function(n){n.classList.remove('focused');});
    selected.classList.add('focused');
    requestAnimationFrame(function(){selected.scrollIntoView({block:'nearest'});});
  }
  var search=menu.querySelector('.vx-select-search');
  if(search)requestAnimationFrame(function(){search.focus({preventScroll:true});});
}
function enhance(s){
  if(!eligible(s)||s._vxSelect)return;
  var id='vx-select-'+(++uid), w=document.createElement('div');
  w.className='vx-select';w.dataset.vxFor=id;
  s.classList.add('vx-select-native');s.id=s.id||id+'-native';

  s.parentNode.insertBefore(w,s);
  w.appendChild(s);

  var btn=document.createElement('button');
  btn.type='button';btn.className='vx-select-btn';
  btn.setAttribute('aria-haspopup','listbox');btn.setAttribute('aria-expanded','false');
  btn.innerHTML='<span class="vx-select-value"></span><span class="vx-select-chevron" aria-hidden="true">⌄</span>';

  var menu=document.createElement('div');
  menu.className='vx-select-menu';menu.setAttribute('role','listbox');menu.hidden=true;

  w.appendChild(btn);w.appendChild(menu);s._vxSelect=w;
  rebuild(s);

  btn.addEventListener('click',function(e){
    e.preventDefault();e.stopPropagation();
    if(!menu.hidden){close(w,true);return;}
    open(w);
  });
  btn.addEventListener('keydown',function(e){
    if(e.key==='ArrowDown'||e.key==='ArrowUp'){
      e.preventDefault();
      if(menu.hidden){open(w);return;}
      moveFocus(w,e.key==='ArrowDown'?1:-1);
    }else if(e.key==='Enter'||e.key===' '){
      e.preventDefault();
      if(menu.hidden)open(w);
      else{
        var f=menu.querySelector('.vx-select-option.focused:not([hidden])');
        if(f)f.click();
      }
    }else if(e.key==='Escape'&&!menu.hidden){
      e.preventDefault();close(w,true);
    }else if(e.key.length===1&&!e.ctrlKey&&!e.metaKey&&!e.altKey){
      if(menu.hidden)open(w);
      var search=menu.querySelector('.vx-select-search');
      if(search){
        search.value+=e.key;filterMenu(w,search.value);search.focus({preventScroll:true});
      }
    }
  });
  s.addEventListener('change',function(){sync(s);});

  new MutationObserver(function(){rebuild(s);}).observe(s,{
    childList:true,subtree:true,attributes:true,
    attributeFilter:['disabled','label','value','selected','data-meta']
  });
}
function scan(root){
  if(root&&root.nodeType===1&&root.matches&&root.matches('select'))enhance(root);
  if(root&&root.querySelectorAll)root.querySelectorAll('select').forEach(enhance);
}
document.addEventListener('click',function(e){
  if(OPEN&&!OPEN.contains(e.target))close(OPEN,false);
});
document.addEventListener('keydown',function(e){
  if(e.key==='Escape'&&OPEN)close(OPEN,true);
});
window.addEventListener('resize',function(){if(OPEN)positionMenu(OPEN);},{passive:true});
window.addEventListener('scroll',function(){if(OPEN)positionMenu(OPEN);},{passive:true,capture:true});

var mo=new MutationObserver(function(ms){
  ms.forEach(function(m){
    m.addedNodes.forEach(function(n){if(n.nodeType===1)scan(n);});
  });
});
function start(){scan(document);mo.observe(document.body,{childList:true,subtree:true});}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();

window.VEUX_SELECT_SYSTEM_161003={
  version:'16.10.03',scan:scan,sync:sync,rebuild:rebuild,close:close
};
})();
