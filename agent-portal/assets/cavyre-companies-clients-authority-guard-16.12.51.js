/* CAVYRE 16.12.51 — Companies & Clients Authority Guard */
(function(){'use strict';
if(window.__CAVYRE_CC_GUARD_161251__)return;window.__CAVYRE_CC_GUARD_161251__=1;
function repair(){var A=window.CAVYRE_COMPANIES_CLIENTS_161249;if(A&&typeof A.takeover==='function')A.takeover()}
setTimeout(repair,0);setTimeout(repair,500);setTimeout(repair,1500);
['veux:shell-ready','veux:agency-v16-ready','veux:page-rendered','cavyre:relationships-ready'].forEach(function(e){window.addEventListener(e,repair)});
document.addEventListener('click',function(e){
  if(e.target&&e.target.closest&&e.target.closest('[data-p="industrydirectory"],[data-p="companies"],[data-p="allcontacts"],[data-p="contacts"]'))setTimeout(repair,30);
},true);
})();