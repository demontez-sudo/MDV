/* CAVYRE 16.15.05 — Operating Order Authority */
(function(){'use strict';
if(window.__CAVYRE_OPERATING_ORDER_161505__)return;window.__CAVYRE_OPERATING_ORDER_161505__=1;
function orderHome(){var root=document.querySelector('#p-overview .vx17-command');if(!root)return;var attention=root.querySelector('.vx17-attention'),main=root.querySelector('.vx17-main-grid'),cards=root.querySelector('.vx17-smart-grid');if(!attention||!main||!cards)return;var after=attention.nextSibling;root.insertBefore(main,after);root.insertBefore(cards,main.nextSibling);root.setAttribute('data-cavyre-home-order','16.15.05');}
function nav(){var rail=document.getElementById('vx73-rail');if(!rail)return;rail.querySelectorAll('button').forEach(function(b){var label=(b.getAttribute('aria-label')||b.textContent||'').trim().toLowerCase();if(label==='vera desk'||b.dataset.page==='veradesk'||b.dataset.page==='assistant')b.remove();});var task=rail.querySelector('[data-page="tasksconsolidated"]');if(task){task.setAttribute('aria-label','Tasks');var span=task.querySelector('span');if(span)span.textContent='Tasks';}}
function calendar(){var host=document.getElementById('p-calendar');if(!host)return;var cal=host.querySelector('.vx75-calendar');if(cal)cal.setAttribute('data-cavyre-calendar-operation','16.15.05');host.querySelectorAll('.vx75-intel,.vx89-flow-intel,.vx75-month-intel,.vx98-native-intel').forEach(function(x){x.classList.add('cvy161505-vera-intel');var h=x.querySelector('h2,header h2');if(h&&!/vera/i.test(h.textContent||'')){var k=document.createElement('small');k.className='cvy161505-vera-label';k.textContent='VERA INTELLIGENCE';h.parentNode.insertBefore(k,h);}});}
function run(){orderHome();nav();calendar();}
var mo=new MutationObserver(function(ms){if(ms.some(function(m){return m.addedNodes&&m.addedNodes.length;}))queueMicrotask(run);});
mo.observe(document.documentElement,{childList:true,subtree:true});document.addEventListener('DOMContentLoaded',run,{once:true});run();
window.CAVYRE_OPERATING_ORDER_161505={run:run,release:'16.15.05'};
})();
