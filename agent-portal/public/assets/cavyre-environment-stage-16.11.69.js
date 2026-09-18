
(function(){
'use strict';
if(window.__CAVYRE_ENV_STAGE_161169__)return;
window.__CAVYRE_ENV_STAGE_161169__=true;
var SCENES={galaxy:1,christmas:1,earth:1,waterfall:1};
var MARKUP="\n<div class=\"cvy-env-scene cvy-env-galaxy\" data-scene=\"galaxy\">\n  <span class=\"cvy-nebula cvy-nebula-a\"></span><span class=\"cvy-nebula cvy-nebula-b\"></span>\n  <span class=\"cvy-stars cvy-stars-a\"></span><span class=\"cvy-stars cvy-stars-b\"></span><span class=\"cvy-stars cvy-stars-c\"></span>\n</div>\n<div class=\"cvy-env-scene cvy-env-christmas\" data-scene=\"christmas\">\n  <span class=\"cvy-xmas-glow\"></span>\n  <span class=\"cvy-xmas-tree t1\"></span><span class=\"cvy-xmas-tree t2\"></span><span class=\"cvy-xmas-tree t3\"></span>\n  <span class=\"cvy-xmas-lights\"></span>\n  <span class=\"cvy-snow cvy-snow-a\"></span><span class=\"cvy-snow cvy-snow-b\"></span>\n</div>\n<div class=\"cvy-env-scene cvy-env-earth\" data-scene=\"earth\">\n  <span class=\"cvy-space-stars\"></span><span class=\"cvy-aurora\"></span>\n  <span class=\"cvy-earth-planet\"></span><span class=\"cvy-earth-rim\"></span>\n</div>\n<div class=\"cvy-env-scene cvy-env-waterfall\" data-scene=\"waterfall\">\n  <span class=\"cvy-water-light\"></span>\n  <span class=\"cvy-fall f1\"></span><span class=\"cvy-fall f2\"></span><span class=\"cvy-fall f3\"></span><span class=\"cvy-fall f4\"></span><span class=\"cvy-fall f5\"></span>\n  <span class=\"cvy-water-spray\"></span><span class=\"cvy-water-mist m1\"></span><span class=\"cvy-water-mist m2\"></span>\n</div>\n";
function current(){return String(document.documentElement.getAttribute('data-veux-wave')||'').toLowerCase();}
function shell(){return document.querySelector('#app .shell');}
function ensureStage(){
  var sh=shell();if(!sh)return null;
  var stage=document.getElementById('cavyre-environment-stage');
  if(!stage || !sh.contains(stage)){
    if(stage)stage.remove();
    stage=document.createElement('div');
    stage.id='cavyre-environment-stage';stage.setAttribute('aria-hidden','true');
    var pm=sh.querySelector('#pm');sh.insertBefore(stage,pm||sh.firstChild);
  }
  if(!stage.querySelector('[data-scene="galaxy"]')||!stage.querySelector('[data-scene="waterfall"]')){
    stage.innerHTML=MARKUP;
  }
  return stage;
}
function removeLegacy(){var old=document.getElementById('cavyre-cinematic-atmosphere');if(old)old.remove();}
function apply(){
  removeLegacy();
  var stage=ensureStage();if(!stage)return;
  var k=current();
  stage.dataset.active=SCENES[k]?k:'';
  stage.style.display=SCENES[k]?'block':'none';
  document.documentElement.setAttribute('data-cavyre-environment-authority','16.11.69');
  document.documentElement.toggleAttribute('data-cavyre-environment-active',!!SCENES[k]);
}
var queued=false;function queue(){if(queued)return;queued=true;requestAnimationFrame(function(){queued=false;apply();})}
function boot(){
  apply();
  new MutationObserver(function(ms){
    var need=ms.some(function(m){
      return (m.type==='attributes'&&m.attributeName==='data-veux-wave') ||
             (m.type==='childList'&&m.addedNodes&&m.addedNodes.length);
    });
    if(need)queue();
  }).observe(document.documentElement,{attributes:true,attributeFilter:['data-veux-wave'],childList:true,subtree:true});
  ['veux:shell-ready','veux:assets-ready','veux:page-rendered','cavyre:appearance-wave-change','pageshow'].forEach(function(ev){window.addEventListener(ev,queue);});
  [100,400,1000,2500,5000].forEach(function(ms){setTimeout(apply,ms);});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
window.CavyreEnvironmentStage={version:'16.11.69',refresh:apply,get:current};
})();
