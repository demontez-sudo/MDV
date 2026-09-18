
(function(){
'use strict';
if(window.__VEUX_VERA_IDENTITY_161005__)return;
window.__VEUX_VERA_IDENTITY_161005__=true;

var MARK='<span class="vera-mark" aria-hidden="true"><i></i></span>';

function isVeraText(node){
  var t=(node&&node.textContent||'').trim().toLowerCase();
  return t.indexOf('vera')>=0 || t.indexOf('intelligence')>=0;
}

function apply(root){
  root=root||document;

  root.querySelectorAll('.vx73-command').forEach(function(cmd){
    var first=cmd.firstElementChild;
    if(first && first.tagName==='I' && !first.classList.contains('vera-preserve')){
      first.outerHTML=MARK;
    }
    var input=cmd.querySelector('input');
    if(input){
      input.setAttribute('aria-label','Ask Vera');
      input.setAttribute('placeholder','Ask Vera to plan, move or resolve…');
    }
    var b=cmd.querySelector('button');
    if(b){
      b.setAttribute('title','Vera Intelligence');
      b.setAttribute('aria-label','Open Vera Intelligence');
      if((b.textContent||'').trim()==='✧' || (b.textContent||'').trim()==='✦'){
        b.innerHTML='<span class="vera-mark" aria-hidden="true"><i></i></span>';
      }
    }
  });

  root.querySelectorAll('.vx95-intelligence > header').forEach(function(h){
    var glyph=h.querySelector(':scope > i');
    if(glyph)glyph.outerHTML=MARK;
  });

  var launcher=document.getElementById('_asst-btn');
  if(launcher){
    launcher.classList.add('vera-launcher');
    launcher.title='Vera Intelligence';
    launcher.setAttribute('aria-label','Open Vera Intelligence');
    if(!launcher.querySelector('.vera-mark'))launcher.innerHTML=MARK;
  }

  root.querySelectorAll('[title="VEUX Intelligence"],[aria-label="Open VEUX Intelligence"]').forEach(function(el){
    if(el.hasAttribute('title'))el.setAttribute('title','Vera Intelligence');
    if(el.hasAttribute('aria-label'))el.setAttribute('aria-label','Open Vera Intelligence');
  });
}

function start(){
  apply(document);
  new MutationObserver(function(ms){
    ms.forEach(function(m){
      m.addedNodes.forEach(function(n){
        if(n.nodeType===1)apply(n);
      });
    });
  }).observe(document.body,{childList:true,subtree:true});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();

window.VERA={
  name:'Vera',
  product:'VEUX Agent',
  mark:MARK,
  refresh:function(){apply(document);}
};
})();
