
(function(){
'use strict';
if(window.__VEUX_WAVE_AUTHORITY_161021__)return;
window.__VEUX_WAVE_AUTHORITY_161021__=true;

function mark(avatar){
  var s=document.createElement('span');
  s.className='vx20-vera-wave-mark'+(avatar?' avatar':'');
  s.setAttribute('aria-hidden','true');
  return s;
}
function replaceImage(img){
  if(!img||img.dataset.vx20Replaced==='1')return;
  var avatar=img.classList.contains('vera-avatar-img');
  var s=mark(avatar);
  img.dataset.vx20Replaced='1';
  img.replaceWith(s);
}
function convert(root){
  root=root||document;
  if(!root.querySelectorAll)return;
  root.querySelectorAll('.vera-mark-img,.vera-avatar-img').forEach(replaceImage);

  /* Command bar may exist before Vera's official enhancer. */
  root.querySelectorAll('.vx73-command').forEach(function(cmd){
    /* Exactly one Vera mark: the identity mark on the left. */
    cmd.querySelectorAll(':scope > .vera-mark-img,:scope > .vera-mark,:scope > .vx20-vera-wave-mark').forEach(function(n,i){if(i>0)n.remove();});
    var left=cmd.querySelector(':scope > .vera-mark-img,:scope > .vera-mark,:scope > .vx20-vera-wave-mark');
    if(left&&!left.classList.contains('vx20-vera-wave-mark'))left.replaceWith(mark(false));
    if(!cmd.querySelector(':scope > .vx20-vera-wave-mark'))cmd.insertBefore(mark(false),cmd.firstChild);

    var b=cmd.querySelector('button');
    if(b){
      b.innerHTML='<span class="vx21-command-arrow" aria-hidden="true">→</span>';
      b.title='Open Vera Intelligence';
      b.setAttribute('aria-label','Open Vera Intelligence');
      if(!b.dataset.vx21Bound){
        b.dataset.vx21Bound='1';
        b.addEventListener('click',function(e){e.preventDefault();var launcher=document.getElementById('_asst-btn');if(launcher)launcher.click();});
      }
    }
    var input=cmd.querySelector('input');
    if(input&&!input.dataset.vx21Bound){
      input.dataset.vx21Bound='1';
      input.addEventListener('keydown',function(e){
        if(e.key!=='Enter')return;
        e.preventDefault();
        var launcher=document.getElementById('_asst-btn');
        if(launcher)launcher.click();
      });
    }
  });

  /* Fixed launcher. */
  var launcher=document.getElementById('_asst-btn');
  if(launcher&&!launcher.querySelector('.vx20-vera-wave-mark')){
    launcher.innerHTML='';
    launcher.appendChild(mark(true));
  }

  /* Agency Command orb. */
  root.querySelectorAll('.vx17-vera-orb').forEach(function(b){
    b.querySelectorAll('img').forEach(function(i){i.remove();});
    if(!b.querySelector('.vx20-vera-wave-mark'))b.appendChild(mark(true));
  });

  /* Panel identity and Vera message heads. */
  root.querySelectorAll('.vera-panel-identity,.vera-message-head').forEach(function(box){
    if(!box.querySelector('.vx20-vera-wave-mark'))box.insertBefore(mark(box.classList.contains('vera-panel-identity')),box.firstChild);
  });
}


function repairRosterClicks(root){
  root=root||document;
  root.querySelectorAll&&root.querySelectorAll('[data-v155-roster-id]').forEach(function(row){
    if(row.dataset.vx21Bound)return;
    row.dataset.vx21Bound='1';
    row.addEventListener('click',function(e){
      var id=row.dataset.v155RosterId;
      if(id&&window.VEUX_V155&&typeof VEUX_V155.selectRoster==='function')VEUX_V155.selectRoster(id);
    });
  });
}

function syncWave(){
  var theme=document.documentElement.getAttribute('data-veux-wave')||'classic';
  if(document.body)document.body.dataset.veuxWaveAuthority=theme;
  convert(document);repairRosterClicks(document);
}

function start(){
  syncWave();
  new MutationObserver(function(muts){
    var needs=false;
    muts.forEach(function(m){
      if(m.type==='childList'&&m.addedNodes.length)needs=true;
      if(m.type==='attributes'&&m.target===document.documentElement)needs=true;
    });
    if(needs)requestAnimationFrame(syncWave);
  }).observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['data-veux-wave']});

  window.addEventListener('veux:smart-wave-applied',syncWave);
  document.addEventListener('click',function(e){
    if(e.target&&e.target.closest&&e.target.closest('.vx-wave-option'))setTimeout(syncWave,0);
  },true);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();

window.VEUX_WAVE_AUTHORITY={
  version:'16.10.21',
  sync:syncWave,
  convert:convert
};
})();
