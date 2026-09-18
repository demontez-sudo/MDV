/* CAVYRE Release Authority — single visible release source */
(function(){
  'use strict';
  var RELEASE='16.11.68';
  window.CAVYRE_RELEASE=RELEASE;
  try {
    document.documentElement.setAttribute('data-cavyre-release', RELEASE);
    var metas=document.querySelectorAll('meta[name="cavyre-agent-release"],meta[name="veux-release"]');
    metas.forEach(function(m){ m.setAttribute('content', RELEASE); });
    var sync=function(){
      document.querySelectorAll('[data-cavyre-version-badge], .cavyre-build-badge, .agent-build-badge').forEach(function(el){
        el.textContent='AGENT '+RELEASE;
      });
      var nodes=document.querySelectorAll('body *');
      nodes.forEach(function(el){
        if(el.children.length===0 && /^AGENT\s+16\.11\.\d+$/i.test((el.textContent||'').trim())) el.textContent='AGENT '+RELEASE;
      });
    };
    if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',sync,{once:true}); else sync();
    setTimeout(sync,250);
  } catch(_e) {}
})();
