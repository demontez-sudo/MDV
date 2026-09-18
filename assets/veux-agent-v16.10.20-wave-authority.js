
(function(){
'use strict';
if(window.__VEUX_WAVE_AUTHORITY_161020__)return;
window.__VEUX_WAVE_AUTHORITY_161020__=true;

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
    var legacy=cmd.querySelector(':scope > .vera-mark');
    if(legacy){
      var m=mark(false);
      legacy.replaceWith(m);
    }else if(!cmd.querySelector(':scope > .vx20-vera-wave-mark')){
      cmd.insertBefore(mark(false),cmd.firstChild);
    }
    var b=cmd.querySelector('button');
    if(b&&!b.querySelector('.vx20-vera-wave-mark')){
      b.textContent='';
      b.appendChild(mark(false));
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

function syncWave(){
  var theme=document.documentElement.getAttribute('data-veux-wave')||'classic';
  if(document.body)document.body.dataset.veuxWaveAuthority=theme;
  convert(document);
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
  version:'16.10.20',
  sync:syncWave,
  convert:convert
};
})();
