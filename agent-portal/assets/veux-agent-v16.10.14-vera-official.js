
(function(){
'use strict';
if(window.__VEUX_VERA_OFFICIAL_161006__)return;
window.__VEUX_VERA_OFFICIAL_161006__=true;

var mount=window.__VEUX_AGENT_MOUNT__;
if(mount==null)mount=/^\/(?:admin|team)(?:\/|$)/.test(location.pathname)?'/admin':'';

var MARK_SRC=mount+'/assets/vera/vera-mark.svg?v=16.10.14';
var AVATAR_SRC=mount+'/assets/vera/vera-avatar-circle.svg?v=16.10.14';

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
