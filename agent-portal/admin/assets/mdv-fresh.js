/* Freshness: after anything is saved, what you see must catch up without a reload.
   The portal keeps pages and server answers for a short while so it feels quick, and a page only refreshes itself if its own code remembers to.
   This is the safety net for every page:
     1. after a successful save, the saved-data cache is cleared and every page is marked stale, so opening any page shows the new data;
     2. if the page you are on did not redraw itself within a moment, it is refreshed — but never while a form or popup is open,
        and never over something you are typing. */
(function(){
'use strict';
if(window.__MDV_FRESH__)return;window.__MDV_FRESH__=true;

/* things that are not "saving" even though they are sent as a POST, or that draw their own screen */
var SKIP=/\/api\/agent\/(mail|veuxi|notifications|bootstrap|attachments|assistant|outreach|notes)|upload-url|keepalive|preflight|\/api\/auth|analytics|heartbeat/i;
var READ=/^(get|list|read|search|query|messages|folders|folder|message|thread|status|load|fetch|preview|suggest|analy[sz]e|check|verify|count|summary|lookup|download|open|view)/i;
var SELF=/^(mail|notes|outreach|dayschedule|systemsettings)$/;
var hooked=false,timer=null,obs=null,changed=false,page='',tries=0;

function isWrite(path,opts){
  var m=String(opts&&opts.method||'GET').toUpperCase();if(m==='GET'||m==='HEAD')return false;
  if(SKIP.test(String(path)))return false;
  var a='';try{a=JSON.parse((opts&&opts.body)||'{}').action||'';}catch(e){}
  return !(a&&READ.test(a));
}
function panelEl(){var p=String(window._currentPage||'');return p?(document.getElementById('p-'+p)||null):null;}
function busy(){
  if(document.querySelector('[data-mdv-ov],[data-mdv-dlg],.modal-bg.open,.sr-back,.ct-back,.ot-back,.mm-modal:not([hidden])'))return true;
  var a=document.activeElement,el=panelEl();
  if(a&&el&&el.contains(a)&&/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)||(a&&a.isContentEditable))return true;
  return false;
}
function watch(){
  var el=panelEl();changed=false;page=String(window._currentPage||'');tries=0;
  if(obs){try{obs.disconnect();}catch(e){}}
  if(!el||typeof MutationObserver!=='function')return;
  obs=new MutationObserver(function(){changed=true;});
  obs.observe(el,{childList:true,subtree:true,characterData:true});
}
function settle(){
  if(String(window._currentPage||'')!==page||SELF.test(page)){stop();return;}   /* moved on, or a page that draws itself */
  if(changed){stop();return;}                                                    /* it already updated */
  if(busy()){if(++tries<45){timer=setTimeout(settle,900);}else stop();return;}   /* wait for the form or popup to close */
  stop();
  try{if(typeof window.rerender==='function')window.rerender(page);}catch(e){console.warn('[fresh]',e&&e.message||e);}
}
function stop(){clearTimeout(timer);timer=null;if(obs){try{obs.disconnect();}catch(e){}obs=null;}}
function wrote(){
  try{if(window.VEUX_AGENT_V4&&typeof VEUX_AGENT_V4.clearApiCache==='function')VEUX_AGENT_V4.clearApiCache();}catch(e){}
  try{if(window.VEUX_PERF&&typeof VEUX_PERF.invalidate==='function')VEUX_PERF.invalidate();}catch(e){}
  watch();clearTimeout(timer);timer=setTimeout(settle,1700);
}
function hook(){
  var b=window.VEUX_AGENT_V4;if(!b||typeof b.api!=='function'||b.api.__fr){hooked=!!(b&&b.api&&b.api.__fr);return;}
  var orig=b.api;
  var w=function(path,opts){
    var p=orig.apply(this,arguments);
    try{if(isWrite(path,opts)&&p&&typeof p.then==='function')p.then(function(){wrote();},function(){});}catch(e){}
    return p;
  };
  w.__fr=1;for(var k in orig){try{w[k]=orig[k];}catch(e){}}
  try{b.api=w;hooked=true;}catch(e){}
}
setInterval(function(){if(!hooked)hook();},1000);hook();
window.MDV_FRESH={settle:settle,wrote:wrote};
})();
