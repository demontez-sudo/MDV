
(function(){
  "use strict";
  function clean(){
    var root=document.body;
    if(!root)return;
    var w=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
    var kill=[],n;
    while((n=w.nextNode())){
      var v=n.nodeValue||"";
      if(/^(?:\\n|\\r|\\t|\s)+$/.test(v) && /\\[nrt]/.test(v)) kill.push(n);
    }
    kill.forEach(function(n){n.remove()});
  }
  clean();
  document.addEventListener("DOMContentLoaded",clean);
  new MutationObserver(clean).observe(document.documentElement,{childList:true,subtree:true});
})();
