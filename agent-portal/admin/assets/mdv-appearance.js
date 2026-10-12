/* Appearance for everyone. The skin picker lives on the Settings page, and that page cannot load for people whose role
   cannot read agency settings. When it fails, show a personal Appearance page with the same picker instead. */
(function(){
'use strict';
var FAIL=/Unable to Load|Connection unavailable|Missing permission|Your role (doesn't|can't)|permission/i;
function waves(){return window.VEUX_COLOR_WAVES&&typeof window.VEUX_COLOR_WAVES.settingsMarkup==='function'?window.VEUX_COLOR_WAVES:null;}
function failed(panel){
  if(!panel||panel.querySelector('#vx-wave-settings,.v152-settings-grid'))return false;
  if(panel.querySelector('.v144-loading,.v1686-loading'))return false;
  var txt=panel.textContent||'';
  return txt.trim().length>0&&(FAIL.test(txt)||!!panel.querySelector('.v144-empty,.v1686-error'));
}
function fallback(panel){
  var w=waves();if(!w)return;
  panel.innerHTML='<div class="v152-page mdv-appearance"><div class="v152-head"><div><span>PERSONAL SETTINGS</span><h1>Appearance</h1><p>Choose how the portal looks for you. Your choice is saved on this device. Agency settings, security and integrations are managed by an admin.</p></div></div>'
    +'<div class="v152-settings-grid">'+w.settingsMarkup()+'</div></div>';
  try{if(typeof w.refresh==='function')w.refresh();}catch(e){}
}
function check(){
  var panel=document.getElementById('p-systemsettings');
  if(panel&&failed(panel))fallback(panel);
}
var q=0;function queue(){if(q)return;q=1;setTimeout(function(){q=0;try{check();}catch(e){}},250);}
new MutationObserver(queue).observe(document.documentElement,{childList:true,subtree:true});
queue();
})();
