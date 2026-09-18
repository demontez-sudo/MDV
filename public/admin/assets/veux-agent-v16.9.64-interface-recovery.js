(function(){
'use strict';
if(window.__VEUX_16964_INTERFACE_RECOVERY__)return;
window.__VEUX_16964_INTERFACE_RECOVERY__=true;
var VERSION='16.9.64';

function modelId(row){
  if(!row)return'';
  var raw=row.getAttribute('onclick')||'';
  return row.dataset.modelId||(raw.match(/selectRoster\('([^']+)'/)||raw.match(/openModel\('([^']+)'/)||[])[1]||'';
}
function openModel(id){
  if(!id)return;
  if(window.VEUX_V155&&typeof window.VEUX_V155.openModel==='function')return window.VEUX_V155.openModel(id,'');
  window._veuxV10ModelId=id;
  if(typeof window.navTo==='function')window.navTo('modelpage');
}
function cleanRoster(host){
  host=host||document.getElementById('p-roster');if(!host)return;
  var adds=[].slice.call(host.querySelectorAll('.v155-head-actions button')).filter(function(b){return /add model/i.test(b.textContent||'');});
  adds.slice(1).forEach(function(b){b.remove();});
  var rows=[].slice.call(host.querySelectorAll('.v155-table-row.roster'));
  var selected=rows.find(function(r){return r.classList.contains('on');});
  if(selected&&!host.dataset.vx16964Hover)host.dataset.vx16964Hover=modelId(selected);
  rows.forEach(function(row){
    var id=modelId(row);if(!id)return;
    row.dataset.modelId=id;
    row.setAttribute('aria-label','Preview model details; open Model 360');
    row.onclick=function(e){e.preventDefault();openModel(id);};
    row.onpointerenter=function(){preview(host,id);};
    row.onfocus=function(){preview(host,id);};
  });
}
function preview(host,id){
  if(!id||host.dataset.vx16964Hover===id)return;
  host.dataset.vx16964Hover=id;
  if(window.VEUX_V155&&typeof window.VEUX_V155.selectRoster==='function'){
    window.VEUX_V155.selectRoster(id);
    requestAnimationFrame(function(){var side=host.querySelector('.v155-side');if(side){side.classList.remove('vx16964-previewing');void side.offsetWidth;side.classList.add('vx16964-previewing');}cleanRoster(host);});
  }
}
function wrapRoster(){
  var fn=window.renderRosterConsolidated;if(!fn||fn.__vx16964)return;
  var wrapped=function(host){var out=fn.apply(this,arguments);Promise.resolve(out).finally(function(){requestAnimationFrame(function(){cleanRoster(host);});});return out;};
  wrapped.__vx16964=true;window.renderRosterConsolidated=wrapped;window.renderRoster=wrapped;
  if(window.VEUX_V15_ROUTE_RENDERERS)window.VEUX_V15_ROUTE_RENDERERS.roster=wrapped;
}
function install(){wrapRoster();if(window._currentPage==='roster')cleanRoster(document.getElementById('p-roster'));}
window.VEUX_V16964={version:VERSION,install:install,cleanRoster:cleanRoster,openModel:openModel};
window.addEventListener('veux:assets-ready',install);
setTimeout(install,0);
console.info('[VEUX DESK] Agent interface recovery '+VERSION+' loaded');
})();
