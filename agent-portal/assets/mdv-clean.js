/* Removes the "VEUX DESK" label from everywhere it is drawn (menus, page eyebrows, top bar, install prompts).
   It is rendered by many older scripts, so this sweeps the text instead of editing each one. */
(function(){
'use strict';
var RX=/VEUX\s*DESK/i,SKIP={SCRIPT:1,STYLE:1,TEXTAREA:1,INPUT:1,TITLE:1,NOSCRIPT:1};
function fix(node){
  var t=node.nodeValue;if(!t||!RX.test(t))return;
  var p=node.parentElement;if(!p||SKIP[p.tagName]||p.isContentEditable)return;
  var n=t.replace(/Install\s+VEUX\s*DESK/ig,'Install the app')
         .replace(/VEUX\s*DESK\s*[·•|—–-]\s*/ig,'')
         .replace(/\s*[·•|—–-]\s*VEUX\s*DESK/ig,'')
         .replace(/VEUX\s*DESK/ig,'').replace(/\s{2,}/g,' ');
  if(n===t)return;
  node.nodeValue=n.trim()===''?'':n;
  if(n.trim()===''&&p.children.length===0&&p.textContent.trim()==='')p.style.setProperty('display','none','important');
}
function sweep(root){
  if(!root)return;
  if(root.nodeType===3){fix(root);return;}
  if(root.nodeType!==1||SKIP[root.tagName])return;
  var w=document.createTreeWalker(root,NodeFilter.SHOW_TEXT,null),n,list=[];
  while((n=w.nextNode()))if(RX.test(n.nodeValue))list.push(n);
  list.forEach(fix);
}
var queue=[],pending=false;
function flush(){pending=false;var q=queue;queue=[];q.forEach(sweep);}
function enqueue(n){queue.push(n);if(!pending){pending=true;setTimeout(flush,60);}}
new MutationObserver(function(muts){
  muts.forEach(function(m){
    if(m.type==='characterData')enqueue(m.target);
    else m.addedNodes.forEach(function(a){if(a.nodeType===1||a.nodeType===3)enqueue(a);});
  });
}).observe(document.documentElement,{childList:true,subtree:true,characterData:true});
if(document.body)sweep(document.body);else document.addEventListener('DOMContentLoaded',function(){sweep(document.body);});
})();
