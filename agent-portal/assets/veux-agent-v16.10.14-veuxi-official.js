
(function(){
'use strict';
if(window.__VEUX_VEUXI_OFFICIAL_161006__)return;
window.__VEUX_VEUXI_OFFICIAL_161006__=true;

var mount=window.__VEUX_AGENT_MOUNT__;
if(mount==null)mount=/^\/(?:admin|team)(?:\/|$)/.test(location.pathname)?'/admin':'';

var MARK_SRC=mount+'/assets/veuxi/veuxi-mark.svg?v=16.10.14';
var AVATAR_SRC=mount+'/assets/veuxi/veuxi-avatar-circle.svg?v=16.10.14';

function markHTML(cls){
  return '<img class="veuxi-mark-img'+(cls?' '+cls:'')+'" src="'+MARK_SRC+'" alt="">';
}
function avatarHTML(cls){
  return '<img class="veuxi-avatar-img'+(cls?' '+cls:'')+'" src="'+AVATAR_SRC+'" alt="">';
}
function replaceLegacyMark(node,useAvatar){
  if(!node||node.dataset.veuxiOfficial==='1')return;
  var replacement=document.createElement('img');
  replacement.className=useAvatar?'veuxi-avatar-img':'veuxi-mark-img';
  replacement.src=useAvatar?AVATAR_SRC:MARK_SRC;
  replacement.alt='';
  replacement.setAttribute('aria-hidden','true');
  node.replaceWith(replacement);
}
function enhanceCommand(root){
  root.querySelectorAll('.vx73-command').forEach(function(cmd){
    var legacy=cmd.querySelector(':scope > .veuxi-mark');
    if(legacy)replaceLegacyMark(legacy,false);

    var first=cmd.firstElementChild;
    if(first && first.tagName==='I'){
      var img=document.createElement('img');
      img.className='veuxi-mark-img';
      img.src=MARK_SRC;img.alt='';img.setAttribute('aria-hidden','true');
      first.replaceWith(img);
    }

    var input=cmd.querySelector('input');
    if(input){
      input.setAttribute('aria-label','Ask Veux');
      input.setAttribute('placeholder','Ask Veux to plan, move or resolve…');
    }

    var button=cmd.querySelector('button');
    if(button){
      button.title='Veux Intelligence';
      button.setAttribute('aria-label','Open Veux Intelligence');
      var lm=button.querySelector('.veuxi-mark');
      if(lm)replaceLegacyMark(lm,false);
      if(!button.querySelector('.veuxi-mark-img')){
        var glyph=(button.textContent||'').trim();
        if(glyph==='✦'||glyph==='✧')button.innerHTML=markHTML();
      }
    }
  });
}
function enhanceIntelligence(root){
  root.querySelectorAll('.vx95-intelligence > header').forEach(function(h){
    var legacy=h.querySelector(':scope > .veuxi-mark');
    if(legacy)replaceLegacyMark(legacy,false);
    var glyph=h.querySelector(':scope > i');
    if(glyph){
      var img=document.createElement('img');
      img.className='veuxi-mark-img';img.src=MARK_SRC;img.alt='';img.setAttribute('aria-hidden','true');
      glyph.replaceWith(img);
    }
  });
}
function enhanceLauncher(){
  var b=document.getElementById('_asst-btn');
  if(!b)return;
  b.classList.add('veuxi-launcher');
  b.title='Veux';
  b.setAttribute('aria-label','Open Veux');
  if(!b.querySelector('.veuxi-avatar-img')){
    b.innerHTML=avatarHTML();
  }
}
function enhancePanel(){
  var p=document.getElementById('_asst-panel');
  if(!p)return;

  var header=p.firstElementChild;
  if(header && !header.querySelector('.veuxi-panel-identity')){
    var info=header.firstElementChild;
    if(info){
      info.classList.add('veuxi-panel-identity');
      info.innerHTML=avatarHTML()+
        '<div><div class="veuxi-panel-kicker">VEUX AGENT · INTELLIGENCE</div>'+
        '<div class="veuxi-panel-name">Veux</div>'+
        '<div class="veuxi-panel-sub" id="_veuxi-panel-sub">System intelligence</div>'+
        '<div id="_asst-status" style="font:8px var(--fM);letter-spacing:.08em;text-transform:uppercase;color:var(--mute);margin-top:4px">Checking provider…</div></div>';
    }
  }
}
function enhanceMessageLabels(root){
  var box=document.getElementById('_asst-msgs');
  if(!box)return;
  Array.from(box.children).forEach(function(msg){
    if(msg.dataset.veuxiMessageDone==='1')return;
    var first=msg.firstElementChild;
    if(!first)return;
    var label=(first.textContent||'').trim();
    if(/^Veux(?: Intelligence)?(?:\s*·|$)/i.test(label)){
      first.className='veuxi-message-head';
      first.innerHTML=markHTML()+'<span class="veuxi-message-label">'+label.replace(/^Veux Intelligence/i,'Veux')+'</span>';
      msg.dataset.veuxiMessageDone='1';
    }
  });
}
function apply(root){
  root=root||document;
  if(root.querySelectorAll){
    root.querySelectorAll('.veuxi-mark').forEach(function(n){
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

window.VEUXI={
  name:'Veux',
  product:'VEUX Agent',
  markSrc:MARK_SRC,
  avatarSrc:AVATAR_SRC,
  refresh:function(){apply(document);}
};
})();
