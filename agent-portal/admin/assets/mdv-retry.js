/* When a page fails to load because the request itself did not get through ("Failed to fetch", a server restart during a deploy,
   a dropped connection), try it once more by itself and leave a Try again button if it still fails. Permission errors are left alone. */
(function(){
'use strict';
if(window.MDV_RETRY)return;
var NET=/failed to fetch|networkerror|network request failed|load failed|timed? ?out|connection (reset|closed)|bad gateway|service unavailable|gateway time/i;
var tried={},timer=null;
function pageOf(panel){return String(panel.id||'').replace(/^p-/,'');}
function rerun(panel){
  var page=pageOf(panel),m=window.VEUX_V15_ROUTE_RENDERERS;
  try{if(m&&typeof m[page]==='function'){panel.innerHTML='<div class="mdv-retry-note">Trying again…</div>';m[page](panel);return;}}catch(e){}
  if(typeof window.navTo==='function')window.navTo(page);
}
function scan(){
  document.querySelectorAll('.panel').forEach(function(panel){
    if(!panel.id||panel.querySelector('[data-mdv-retry]'))return;
    var box=panel.querySelector('.v152-empty,.v155-empty,.v144-empty,.v1686-error');if(!box)return;
    var txt=(panel.textContent||'');if(!/Unable to Load/i.test(txt)||!NET.test(txt))return;
    var page=pageOf(panel),now=Date.now();
    if(!tried[page]||now-tried[page]>60000){tried[page]=now;setTimeout(function(){if(panel.querySelector('.v152-empty,.v155-empty,.v144-empty,.v1686-error')&&/Unable to Load/i.test(panel.textContent||''))rerun(panel);},1500);return;}
    var b=document.createElement('button');b.type='button';b.setAttribute('data-mdv-retry','');b.className='v152-btn primary';b.style.cssText='margin:14px 0 0;display:block';b.textContent='Try again';
    b.onclick=function(){tried[page]=Date.now();rerun(panel);};
    box.appendChild(b);
  });
}
new MutationObserver(function(){clearTimeout(timer);timer=setTimeout(scan,400);}).observe(document.documentElement,{childList:true,subtree:true});
window.MDV_RETRY={scan:scan};
})();
