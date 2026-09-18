(function(){'use strict';
if(window.__CAVYRE_PACKAGE_MENU_161130__)return;window.__CAVYRE_PACKAGE_MENU_161130__=1;
function owner(el){return el&&el.closest?el.closest('[role="combobox"],[class*="select"],[class*="dropdown"],.field,[class*="field"]'):null}
function clear(except){document.querySelectorAll('#pm .vx161130-menu-active').forEach(function(n){if(n!==except)n.classList.remove('vx161130-menu-active')})}
document.addEventListener('click',function(e){
 if(!e.target.closest('#pm'))return;
 var trg=e.target.closest('[role="combobox"],[aria-haspopup="listbox"],[aria-expanded],button,[class*="select"]'); if(!trg)return;
 setTimeout(function(){var o=owner(trg); if(!o)return; var m=o.querySelector('[role="listbox"],[class*="dropdown-menu"],[class*="select-menu"],[class*="options"]');
 var expanded=trg.getAttribute('aria-expanded')==='true'; var visible=m&&getComputedStyle(m).display!=='none'&&getComputedStyle(m).visibility!=='hidden';
 if(expanded||visible){clear(o);o.classList.add('vx161130-menu-active')}else{o.classList.remove('vx161130-menu-active')}},0);
},true);
document.addEventListener('keydown',function(e){if(e.key==='Escape')document.querySelectorAll('#pm .vx161130-menu-active').forEach(function(n){n.classList.remove('vx161130-menu-active')})},true);
function stamp(){}
document.readyState==='loading'?document.addEventListener('DOMContentLoaded',stamp,{once:true}):stamp();
})();