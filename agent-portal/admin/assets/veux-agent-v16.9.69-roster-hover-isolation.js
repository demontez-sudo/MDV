(function(){
'use strict';
if(window.__VEUX_16969_ROSTER_HOVER_ISOLATION__)return;
window.__VEUX_16969_ROSTER_HOVER_ISOLATION__=true;
var VERSION='16.9.69';
function install(){
  var api=window.VEUX_V155;
  if(!api||typeof api.selectRoster!=='function'||api.selectRoster.__vx16969)return;
  var current=api.selectRoster,original=current.__vx16967Original||current;
  function isolated(id){
    var host=document.getElementById('p-roster'),active=window._currentPage==='roster'&&host&&host.classList.contains('on');
    var root=active&&host.firstElementChild,side=root&&root.querySelector('.v155-side');
    var scroller=document.getElementById('pm'),top=scroller?scroller.scrollTop:0;
    if(!root||!side)return original.apply(this,arguments);
    var result=original.apply(this,arguments);
    var renderedRoot=host.firstElementChild,renderedSide=renderedRoot&&renderedRoot.querySelector('.v155-side');
    if(renderedSide){
      host.replaceChildren(root);
      side.replaceWith(renderedSide);
      root.querySelectorAll('.v155-table-row.roster').forEach(function(row){row.classList.toggle('on',row.dataset.modelId===id);});
      host.dataset.vx16964Hover=id;
      if(scroller)scroller.scrollTop=top;
      if(window.VEUX_V16964&&typeof window.VEUX_V16964.cleanRoster==='function')window.VEUX_V16964.cleanRoster(host);
    }
    return result;
  }
  isolated.__vx16969=true;isolated.__vx16969Original=original;api.selectRoster=isolated;
}
window.VEUX_V16969={version:VERSION,install:install};
window.addEventListener('veux:assets-ready',install);window.addEventListener('veux:v15.5-ready',install);setTimeout(install,0);
console.info('[VEUX DESK] Roster hover isolation '+VERSION+' loaded');
})();
