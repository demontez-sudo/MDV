(function(){'use strict';if(window.__CAVYRE_COMMAND_DEEPLINK_161087__)return;window.__CAVYRE_COMMAND_DEEPLINK_161087__=true;
function read(){try{return JSON.parse(sessionStorage.getItem('cavyre.command.focus')||'null')}catch(e){return null}}
function esc(v){try{return CSS.escape(String(v))}catch(e){return String(v).replace(/["\\]/g,'\\$&')}}
function clear(){try{sessionStorage.removeItem('cavyre.command.focus')}catch(e){}}
function resolve(){
 var f=read();if(!f||!f.id||Date.now()-Number(f.at||0)>120000){if(f)clear();return false}
 var id=esc(f.id),type=esc(f.type||'record');
 var sels=['[data-'+type+'-id="'+id+'"]','[data-record-id="'+id+'"]','[data-id="'+id+'"]','#'+type+'-'+id,'#record-'+id];
 if(type==='model')sels.unshift('[data-v155-roster-id="'+id+'"]');
 if(type==='package')sels.unshift('[data-v155-package-id="'+id+'"]');
 if(type==='booking')sels.unshift('[data-booking-id="'+id+'"]');
 if(type==='casting')sels.unshift('[data-casting-id="'+id+'"]');
 if(type==='invoice')sels.unshift('[data-invoice-id="'+id+'"]');
 if(type==='travel')sels.unshift('[data-travel-id="'+id+'"]');
 var node=null;for(var i=0;i<sels.length&&!node;i++){try{node=document.querySelector(sels[i])}catch(e){}}
 if(!node)return false;
 node.scrollIntoView({behavior:'smooth',block:'center'});
 node.classList.add('cavyre-command-focus-target');
 node.setAttribute('data-cavyre-command-focus','true');
 setTimeout(function(){node.classList.remove('cavyre-command-focus-target');node.removeAttribute('data-cavyre-command-focus')},5200);
 try{node.dispatchEvent(new CustomEvent('cavyre:record-focus',{bubbles:true,detail:f}))}catch(e){}
 clear();return true
}
var timer=0;function schedule(){clearTimeout(timer);timer=setTimeout(resolve,180)}
window.addEventListener('cavyre:command-focus',schedule);
window.addEventListener('hashchange',schedule);
document.addEventListener('click',function(){setTimeout(schedule,220)},true);
new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true});
setTimeout(resolve,500);
})();