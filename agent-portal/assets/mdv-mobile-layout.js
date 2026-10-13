/* Phone only: every page opens at the top and stays there while it loads. */
(function(){
if(window.__MDV_ML__)return;window.__MDV_ML__=1;
var MQ=window.matchMedia('(max-width:820px)');
var touched=false,timers=[];
function top(){
  if(!MQ.matches||touched)return;
  var a=document.getElementById('app');if(a&&a.scrollTop)a.scrollTop=0;
  var s=document.scrollingElement;if(s&&s.scrollTop)s.scrollTop=0;
  var m=document.getElementById('pm');if(m&&m.scrollTop)m.scrollTop=0;
}
function pin(){
  if(!MQ.matches)return;
  touched=false;timers.forEach(clearTimeout);timers=[];
  [0,50,150,350,700,1200,2000].forEach(function(ms){timers.push(setTimeout(top,ms));});
}
['touchstart','wheel','keydown','mousedown'].forEach(function(ev){
  document.addEventListener(ev,function(e){
    if(e.target&&e.target.closest&&e.target.closest('#mobnav,#mdv-mm,#mobMoreSheet'))return;
    touched=true;
  },{passive:true,capture:true});
});
function inChain(f,mark){var n=0;while(f&&n++<60){if(f[mark])return true;f=f.__orig||f.__previous;}return false;}
function hook(){
  if(typeof window.navTo!=='function'||inChain(window.navTo,'__ml'))return;
  var prev=window.navTo;
  var w=function(){var r=prev.apply(this,arguments);pin();return r;};
  for(var k in prev){try{w[k]=prev[k];}catch(_e){}}
  w.__ml=1;w.__orig=prev;
  window.navTo=w;
}
hook();window.addEventListener('veux:shell-ready',hook);setTimeout(hook,1500);setTimeout(hook,4000);
window.addEventListener('veux:page-rendered',pin);
if('scrollRestoration'in history){try{history.scrollRestoration='manual';}catch(_e){}}
})();
