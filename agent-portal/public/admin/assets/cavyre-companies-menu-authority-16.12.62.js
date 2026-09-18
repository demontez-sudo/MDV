/* CAVYRE 16.12.63 — Companies & Clients menu stability authority */
(function(){'use strict';
if(window.__CAVYRE_CC_MENU_161263__)return;window.__CAVYRE_CC_MENU_161263__=1;
var queued=false,lastRun=0;
function labelButton(b){
 if(!b||b.dataset.cavyreCcLabeled==='1')return false;
 var changed=false;
 if(b.getAttribute('aria-label')!=='Companies & Clients'){b.setAttribute('aria-label','Companies & Clients');changed=true}
 var s=b.querySelector('span');
 if(s&&s.textContent!=='Companies & Clients'){s.textContent='Companies & Clients';changed=true}
 b.dataset.cavyreCcLabeled='1';
 return changed;
}
function repair(){
 queued=false;lastRun=Date.now();
 document.querySelectorAll('#vx73-rail [data-page="industrydirectory"],#sidenav [data-page="industrydirectory"],#sidenav [data-nav="industrydirectory"]').forEach(labelButton);
 var side=document.getElementById('sidenav');
 if(side&&!side.querySelector('[data-cavyre-companies-menu="161263"]')&&!side.querySelector('[data-cavyre-companies-menu="161262"]')){
   var b=document.createElement('button');b.type='button';b.dataset.cavyreCompaniesMenu='161263';b.dataset.page='industrydirectory';b.setAttribute('aria-label','Companies & Clients');b.dataset.cavyreCcLabeled='1';b.innerHTML='<i>◇</i><span>Companies & Clients</span>';
   b.onclick=function(){if(typeof window.navTo==='function')window.navTo('industrydirectory')};
   var pkg=side.querySelector('[data-page="multipackage"]');if(pkg&&pkg.parentNode)pkg.parentNode.insertBefore(b,pkg);else side.appendChild(b);
 }
 if(side&&!side.querySelector('[data-cavyre-contacts-menu="161265"]')){var c=document.createElement('button');c.type='button';c.dataset.cavyreContactsMenu='161265';c.dataset.page='contacts';c.setAttribute('aria-label','Professional Contacts');c.innerHTML='<i>♙</i><span>Professional Contacts</span>';c.onclick=function(){if(typeof window.navTo==='function')window.navTo('contacts')};var a=side.querySelector('[data-cavyre-companies-menu]')||side.querySelector('[data-page="industrydirectory"]');if(a&&a.parentNode)a.parentNode.insertBefore(c,a.nextSibling);else side.appendChild(c);}

}
function schedule(){
 if(queued)return;
 queued=true;
 requestAnimationFrame(function(){
   /* coalesce mutation bursts; never synchronously mutate from observer callback */
   if(Date.now()-lastRun<24){setTimeout(repair,24)}else repair();
 });
}
var observer=new MutationObserver(function(records){
 /* Ignore mutations produced inside an already-labeled Companies button. */
 var relevant=records.some(function(r){
   var n=r.target&&r.target.nodeType===1?r.target:r.target&&r.target.parentElement;
   return !(n&&n.closest&&n.closest('[data-cavyre-cc-labeled="1"]'));
 });
 if(relevant)schedule();
});
observer.observe(document.documentElement,{childList:true,subtree:true});
window.addEventListener('veux:shell-ready',schedule);
window.addEventListener('veux:agency-v16-ready',schedule);
setTimeout(schedule,100);setTimeout(schedule,800);
window.CAVYRE_CC_MENU_161263={repair:schedule,release:'16.12.65'};
})();