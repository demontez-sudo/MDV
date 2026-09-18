(function(){
'use strict';
if(window.__CAVYRE_VERA_IDENTITY_AUTHORITY_161408__)return;
window.__CAVYRE_VERA_IDENTITY_AUTHORITY_161408__=true;
var MARK='/assets/vera/vera-mark.svg';
var AVATAR='/assets/vera/vera-avatar-circle.svg';
function img(cls,avatar){var i=document.createElement('img');i.className=cls;i.src=avatar?AVATAR:MARK;i.alt='';i.setAttribute('aria-hidden','true');return i;}
function ownOrb(b){if(!b)return;b.setAttribute('data-vera-identity-authority','16.14.08');b.querySelectorAll('.vx20-vera-wave-mark,.vera-mark-img,.vera-avatar-img').forEach(function(n){n.remove();});if(!b.querySelector(':scope > .cvy-vera-canonical'))b.prepend(img('cvy-vera-canonical',true));}
function ownLauncher(b){if(!b)return;b.setAttribute('data-vera-identity-authority','16.14.08');b.querySelectorAll('.vx20-vera-wave-mark,.vera-mark-img,.vera-avatar-img').forEach(function(n){n.remove();});if(!b.querySelector(':scope > .cvy-vera-canonical'))b.prepend(img('cvy-vera-canonical',true));}
function install(){document.querySelectorAll('.vx17-vera-orb').forEach(ownOrb);ownLauncher(document.getElementById('_asst-btn'));document.querySelectorAll('.ss48-vera-title,.vera-panel-identity').forEach(function(el){el.setAttribute('data-vera-identity-authority','16.14.08');});}
function start(){install();document.addEventListener('veux:route-ready',install);document.addEventListener('veux:shell-ready',install);document.addEventListener('cavyre:season-rendered',install);}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
window.CAVYRE_VERA_IDENTITY={version:'16.14.08',refresh:install};
})();
