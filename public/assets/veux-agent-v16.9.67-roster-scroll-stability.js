(function(){
'use strict';
if(window.__VEUX_16967_ROSTER_SCROLL_STABILITY__)return;
window.__VEUX_16967_ROSTER_SCROLL_STABILITY__=true;
var VERSION='16.9.67';

function snapshot(){
  var pm=document.getElementById('pm');
  return {
    pm:pm,
    pmTop:pm?pm.scrollTop:0,
    docTop:document.documentElement.scrollTop||0,
    bodyTop:document.body.scrollTop||0,
    x:window.scrollX||0,
    y:window.scrollY||0
  };
}
function restore(s){
  if(!s)return;
  if(s.pm)s.pm.scrollTop=s.pmTop;
  document.documentElement.scrollTop=s.docTop;
  document.body.scrollTop=s.bodyTop;
  if((window.scrollY||0)!==s.y||(window.scrollX||0)!==s.x)window.scrollTo(s.x,s.y);
}
function install(){
  var api=window.VEUX_V155;
  if(!api||typeof api.selectRoster!=='function'||api.selectRoster.__vx16967)return;
  var original=api.selectRoster;
  var stable=function(id){
    var position=snapshot();
    var result=original.apply(this,arguments);
    restore(position);
    requestAnimationFrame(function(){restore(position);});
    return result;
  };
  stable.__vx16967=true;
  stable.__vx16967Original=original;
  api.selectRoster=stable;
}
window.VEUX_V16967={version:VERSION,install:install};
window.addEventListener('veux:assets-ready',install);
window.addEventListener('veux:v15.5-ready',install);
setTimeout(install,0);
console.info('[VEUX DESK] Roster scroll stability '+VERSION+' loaded');
})();
