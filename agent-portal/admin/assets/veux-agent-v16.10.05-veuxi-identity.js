
(function(){
'use strict';
if(window.__VEUX_VEUXI_IDENTITY_161005__)return;
window.__VEUX_VEUXI_IDENTITY_161005__=true;

var MARK='<span class="veuxi-mark" aria-hidden="true"><i></i></span>';

function isVeuxiText(node){
  var t=(node&&node.textContent||'').trim().toLowerCase();
  return t.indexOf('veuxi')>=0 || t.indexOf('intelligence')>=0;
}

function apply(root){
  root=root||document;

  root.querySelectorAll('.vx73-command').forEach(function(cmd){
    var first=cmd.firstElementChild;
    if(first && first.tagName==='I' && !first.classList.contains('veuxi-preserve')){
      first.outerHTML=MARK;
    }
    var input=cmd.querySelector('input');
    if(input){
      input.setAttribute('aria-label','Ask Veux');
      input.setAttribute('placeholder','Ask Veux to plan, move or resolve…');
    }
    var b=cmd.querySelector('button');
    if(b){
      b.setAttribute('title','Veux Intelligence');
      b.setAttribute('aria-label','Open Veux Intelligence');
      if((b.textContent||'').trim()==='✧' || (b.textContent||'').trim()==='✦'){
        b.innerHTML='<span class="veuxi-mark" aria-hidden="true"><i></i></span>';
      }
    }
  });

  root.querySelectorAll('.vx95-intelligence > header').forEach(function(h){
    var glyph=h.querySelector(':scope > i');
    if(glyph)glyph.outerHTML=MARK;
  });

  var launcher=document.getElementById('_asst-btn');
  if(launcher){
    launcher.classList.add('veuxi-launcher');
    launcher.title='Veux Intelligence';
    launcher.setAttribute('aria-label','Open Veux Intelligence');
    if(!launcher.querySelector('.veuxi-mark'))launcher.innerHTML=MARK;
  }

  root.querySelectorAll('[title="VEUX Intelligence"],[aria-label="Open VEUX Intelligence"]').forEach(function(el){
    if(el.hasAttribute('title'))el.setAttribute('title','Veux Intelligence');
    if(el.hasAttribute('aria-label'))el.setAttribute('aria-label','Open Veux Intelligence');
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

window.VEUXI={
  name:'Veux',
  product:'VEUX Agent',
  mark:MARK,
  refresh:function(){apply(document);}
};
})();
