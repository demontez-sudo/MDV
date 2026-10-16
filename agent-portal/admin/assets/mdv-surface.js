/* Surfaces: finds every popup, drawer and full-page form on screen, whichever component built it, and marks it
   so mdv-surface.css can give them one look.
     data-mdv-ov   the dimmed backdrop
     data-mdv-dlg  the panel (="drawer" when it hangs off a side)
     data-mdv-page a form that is itself the whole page
   Presentation only: nothing is moved, rebuilt or re-parented. */
(function(){
'use strict';
if(window.__MDV_SURFACE__)return;window.__MDV_SURFACE__=true;

var CAND='[class*="modal"],[class*="-back"],[class*="overlay"],[class*="dlg"],[class*="dialog"],[class*="drawer"],[class*="sheet"],[class*="popup"]';
var SKIP='#login,#mdv-appbar,#mdv-tabs,#mdv-diag,.sr-lb,.mdv-lb,[class*="toast"],[class*="lightbox"],[class*="tooltip"],[id*="vera"],[class*="vera-"],[class*="notif"]';
var queued=false;

function shown(e){var s=getComputedStyle(e);return s.display!=='none'&&s.visibility!=='hidden'&&e.getClientRects().length>0;}
function tagged(e){return e.hasAttribute('data-mdv-ov')||e.hasAttribute('data-mdv-dlg')||e.hasAttribute('data-mdv-page');}
function insideTagged(e){return !!(e.parentElement&&e.parentElement.closest('[data-mdv-ov],[data-mdv-dlg],[data-mdv-page]'));}
function kids(e){return [].filter.call(e.children,function(c){return c.nodeType===1&&c.tagName!=='SCRIPT'&&c.tagName!=='STYLE'&&shown(c);});}

function classify(e){
  if(tagged(e)||insideTagged(e))return;
  if(e.matches(SKIP)||e.closest(SKIP))return;
  var s=getComputedStyle(e);if(s.position!=='fixed')return;
  var r=e.getBoundingClientRect(),W=window.innerWidth,H=window.innerHeight;
  if(r.width<240||r.height<160)return;
  var full=r.width>=W*.85&&r.height>=H*.78&&r.left<=2&&r.top<=2;
  if(full){
    var ks=kids(e);
    /* a backdrop has a panel that does not fill the screen */
    var panel=null,area=0;
    ks.forEach(function(k){var b=k.getBoundingClientRect(),a=b.width*b.height;
      if(b.width>=200&&b.height>=120&&(b.width<W*.96||b.height<H*.96)&&a>area){area=a;panel=k;}});
    if(panel){
      e.setAttribute('data-mdv-ov','');
      var pb=panel.getBoundingClientRect();
      panel.setAttribute('data-mdv-dlg',(pb.height>=H*.85&&(pb.right>=W-8||pb.left<=8)&&pb.width<W*.8)?'drawer':'');
    }else if(ks.length)e.setAttribute('data-mdv-page','');
    return;
  }
  /* a side drawer or a floating dialog with no separate backdrop */
  if(r.height>=H*.8&&(r.right>=W-8||r.left<=8)&&r.width<W*.8){e.setAttribute('data-mdv-dlg','drawer');return;}
  if(Number(s.zIndex)>=1000&&r.width>=300&&r.height>=200)e.setAttribute('data-mdv-dlg','');
}

function scan(){
  queued=false;
  var list;try{list=document.querySelectorAll('body>*,'+CAND);}catch(e){return;}
  var n=0;
  for(var i=list.length-1;i>=0&&n<1500;i--){
    var e=list[i];
    if(e.nodeType!==1||tagged(e)||e.tagName==='SCRIPT'||e.tagName==='STYLE'||e.tagName==='LINK')continue;
    n++;
    try{if(shown(e))classify(e);}catch(err){if(window.console)console.warn('[surface]',err&&err.message);}
  }
  /* forget panels that have closed so a re-opened popup is looked at again */
  document.querySelectorAll('[data-mdv-ov],[data-mdv-dlg],[data-mdv-page]').forEach(function(t){
    if(!document.body.contains(t)||!shown(t)){t.removeAttribute('data-mdv-ov');t.removeAttribute('data-mdv-dlg');t.removeAttribute('data-mdv-page');}
  });
}
function soon(){if(queued)return;queued=true;(window.requestAnimationFrame||setTimeout)(scan);}
function burst(){soon();setTimeout(soon,120);setTimeout(soon,450);}

new MutationObserver(function(ms){
  for(var i=0;i<ms.length;i++){if(ms[i].addedNodes&&ms[i].addedNodes.length){burst();return;}}
}).observe(document.body||document.documentElement,{childList:true,subtree:false});
/* popups that are shown by switching a class on a hidden element, or added deeper in the page */
['click','keyup'].forEach(function(t){document.addEventListener(t,burst,true);});
window.addEventListener('resize',soon);
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',burst);else burst();
window.MDV_SURFACE={scan:scan};
})();
