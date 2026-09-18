/* CAVYRE 16.15.07 — Calendar + Model 360 bounded interaction authority
   Crash-eradication revision: no global MutationObserver. */
(function(){'use strict';
if(window.__CAVYRE_CAL_MODEL360_161507__)return;window.__CAVYRE_CAL_MODEL360_161507__=1;
function modelOpen(){var p=document.getElementById('p-modelpage');return !!(p&&window._openModelKey&&(p.classList.contains('on')||p.offsetParent!==null));}
function tab(name){if(window.VEUX_V156&&typeof window.VEUX_V156.modelTab==='function'){window.VEUX_V156.modelTab(name);return true;}return false;}
document.addEventListener('click',function(e){if(!modelOpen())return;var b=e.target&&e.target.closest&&e.target.closest('button,a,[data-page],[data-nav]');if(!b)return;var raw=((b.dataset&&((b.dataset.page||'')+' '+(b.dataset.nav||'')))+' '+(b.textContent||'')).toLowerCase();var dest=/development|gameplan/.test(raw)?'development':/\btravel\b|movement/.test(raw)?'travel':/\bvisa\b|immigration/.test(raw)?'visa':null;if(!dest)return;e.preventDefault();e.stopImmediatePropagation();try{sessionStorage.setItem('cavyre.model.context',String(window._openModelKey));sessionStorage.setItem('cavyre.scope.model_id',String(window._openModelKey));}catch(_e){}tab(dest);var p=document.getElementById('p-modelpage');if(p)p.setAttribute('data-cavyre-model-scope','locked');},true);
function decorate(){var p=document.getElementById('p-modelpage');if(p&&window._openModelKey)p.setAttribute('data-cavyre-model-scope','locked');document.querySelectorAll('#p-calendar [data-event-select]').forEach(function(el){if(el.dataset.cavyreHover161507)return;el.dataset.cavyreHover161507='1';var av=el.querySelector('.cvy161506-avatar[title],.cvy161507-avatar[title]');if(av)el.setAttribute('aria-label',(av.title||'Model')+' — '+(el.textContent||'Calendar event').trim().replace(/\s+/g,' '));});}
function schedule(){requestAnimationFrame(decorate);}
['DOMContentLoaded','veux:page-rendered','cavyre:calendar-rendered','cavyre:model-opened'].forEach(function(n){document.addEventListener(n,schedule);});
document.addEventListener('click',function(e){if(e.target&&e.target.closest&&e.target.closest('[data-page="calendar"],[data-nav="calendar"],#p-calendar button'))setTimeout(decorate,0);},false);
if(document.readyState!=='loading')schedule();
window.CAVYRE_CAL_MODEL360_161507={release:'16.15.07',decorate:decorate};
})();
