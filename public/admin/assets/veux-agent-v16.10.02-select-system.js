
(function(){
'use strict';
if(window.VEUX_SELECT_SYSTEM_161002)return;
var OPEN=null, uid=0;

function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c];});}
function eligible(s){return s&&s.tagName==='SELECT'&&!s.multiple&&!(s.size>1)&&!s.dataset.vxSelectIgnore;}
function optionNodes(s){
  var out=[];
  Array.prototype.forEach.call(s.children,function(n){
    if(n.tagName==='OPTGROUP'){
      out.push({group:true,label:n.label||''});
      Array.prototype.forEach.call(n.children,function(o){if(o.tagName==='OPTION')out.push({option:o});});
    }else if(n.tagName==='OPTION')out.push({option:n});
  });
  return out;
}
function close(w,restore){
  w=w||OPEN;if(!w)return;
  w.classList.remove('open');
  var menu=w.querySelector('.vx-select-menu'),btn=w.querySelector('.vx-select-btn');
  if(menu)menu.hidden=true;
  if(btn)btn.setAttribute('aria-expanded','false');
  if(OPEN===w)OPEN=null;
  if(restore&&btn)btn.focus({preventScroll:true});
}
function sync(s){
  var w=s._vxSelect;if(!w)return;
  var btn=w.querySelector('.vx-select-btn'), value=w.querySelector('.vx-select-value');
  var selected=s.options[s.selectedIndex];
  if(value)value.textContent=selected?selected.textContent:'Select';
  if(btn){btn.disabled=!!s.disabled;btn.setAttribute('aria-disabled',s.disabled?'true':'false');}
  w.querySelectorAll('.vx-select-option').forEach(function(b){
    var on=b.dataset.value===String(s.value);
    b.classList.toggle('selected',on);b.setAttribute('aria-selected',on?'true':'false');
  });
}
function rebuild(s){
  var w=s._vxSelect;if(!w)return;
  var menu=w.querySelector('.vx-select-menu');if(!menu)return;
  var html='', lastWasGroup=false;
  optionNodes(s).forEach(function(x){
    if(x.group){html+='<div class="vx-select-group">'+esc(x.label)+'</div>';lastWasGroup=true;return;}
    var o=x.option;
    html+='<button type="button" class="vx-select-option" role="option" data-value="'+esc(o.value)+'" '+(o.disabled?'disabled':'')+'>'+esc(o.textContent)+'</button>';
    lastWasGroup=false;
  });
  menu.innerHTML=html;
  menu.querySelectorAll('.vx-select-option').forEach(function(b){
    b.addEventListener('click',function(e){
      e.preventDefault();e.stopPropagation();
      if(b.disabled)return;
      var old=s.value;s.value=b.dataset.value;
      sync(s);close(w,true);
      if(old!==s.value)s.dispatchEvent(new Event('change',{bubbles:true}));
    });
  });
  sync(s);
}
function enhance(s){
  if(!eligible(s)||s._vxSelect)return;
  var id='vx-select-'+(++uid), w=document.createElement('div');
  w.className='vx-select';w.dataset.vxFor=id;
  s.classList.add('vx-select-native');s.id=s.id||id+'-native';
  s.parentNode.insertBefore(w,s);
  w.appendChild(s);
  var btn=document.createElement('button');
  btn.type='button';btn.className='vx-select-btn';btn.setAttribute('aria-haspopup','listbox');btn.setAttribute('aria-expanded','false');
  btn.innerHTML='<span class="vx-select-value"></span><span class="vx-select-chevron" aria-hidden="true">⌄</span>';
  var menu=document.createElement('div');menu.className='vx-select-menu';menu.setAttribute('role','listbox');menu.hidden=true;
  w.appendChild(btn);w.appendChild(menu);s._vxSelect=w;
  rebuild(s);
  btn.addEventListener('click',function(e){
    e.preventDefault();e.stopPropagation();
    if(s.disabled)return;
    if(OPEN&&OPEN!==w)close(OPEN,false);
    var opening=menu.hidden;
    menu.hidden=!opening;w.classList.toggle('open',opening);btn.setAttribute('aria-expanded',opening?'true':'false');OPEN=opening?w:null;
    if(opening){
      var sel=menu.querySelector('.selected:not(:disabled)')||menu.querySelector('.vx-select-option:not(:disabled)');
      if(sel){sel.classList.add('focused');requestAnimationFrame(function(){sel.scrollIntoView({block:'nearest'});});}
    }
  });
  btn.addEventListener('keydown',function(e){
    if(e.key==='ArrowDown'||e.key==='ArrowUp'){
      e.preventDefault();
      if(menu.hidden){btn.click();return;}
      var a=Array.from(menu.querySelectorAll('.vx-select-option:not(:disabled)')), cur=menu.querySelector('.focused'), i=Math.max(0,a.indexOf(cur));
      if(cur)cur.classList.remove('focused');i=e.key==='ArrowDown'?Math.min(a.length-1,i+1):Math.max(0,i-1);
      if(a[i]){a[i].classList.add('focused');a[i].scrollIntoView({block:'nearest'});}
    }else if(e.key==='Enter'&&!menu.hidden){
      e.preventDefault();var f=menu.querySelector('.focused');if(f)f.click();
    }else if(e.key==='Escape'&&!menu.hidden){e.preventDefault();close(w,true);}
  });
  s.addEventListener('change',function(){sync(s);});
  new MutationObserver(function(){rebuild(s);}).observe(s,{childList:true,subtree:true,attributes:true,attributeFilter:['disabled','label','value','selected']});
}
function scan(root){
  if(root&&root.nodeType===1&&root.matches&&root.matches('select'))enhance(root);
  (root||document).querySelectorAll&&root.querySelectorAll('select').forEach(enhance);
}
document.addEventListener('click',function(){if(OPEN)close(OPEN,false);});
document.addEventListener('keydown',function(e){if(e.key==='Escape'&&OPEN)close(OPEN,true);});
var mo=new MutationObserver(function(ms){ms.forEach(function(m){m.addedNodes.forEach(function(n){if(n.nodeType===1)scan(n);});});});
function start(){scan(document);mo.observe(document.body,{childList:true,subtree:true});}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
window.VEUX_SELECT_SYSTEM_161002={version:'16.10.02',scan:scan,sync:sync,rebuild:rebuild};
})();
