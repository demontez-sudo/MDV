/* CAVYRE 16.12.52 — Companies & Clients Visible Panel Guard */
(function(){'use strict';
if(window.__CAVYRE_CC_VISIBLE_GUARD_161252__)return;window.__CAVYRE_CC_VISIBLE_GUARD_161252__=1;
var IDS=['p-industrydirectory','p-companies','p-allcontacts','p-contacts'];
function visible(){
  var p=String(window._currentPage||'').toLowerCase(),x=document.getElementById('p-'+p);
  if(x&&IDS.indexOf(x.id)>=0)return x;
  for(var i=0;i<IDS.length;i++){x=document.getElementById(IDS[i]);if(x&&(x.classList.contains('on')||x.offsetParent!==null))return x}
  return null;
}
function repair(force){
  var A=window.CAVYRE_COMPANIES_CLIENTS_161249,h=visible();
  if(!A||!h)return;
  if(typeof A.takeover==='function')A.takeover();
  if(!h.querySelector('.cc49,.cc49-loading')){
    if(typeof A.smartRender==='function')A.smartRender(h);
    else if(typeof A.render==='function')A.render(h);
  }
}
setTimeout(function(){repair(false)},0);
setTimeout(function(){repair(false)},500);
setTimeout(function(){repair(false)},1500);
window.addEventListener('veux:page-rendered',function(e){
  var p=e&&e.detail&&e.detail.page;
  if(['industrydirectory','companies','allcontacts','contacts'].indexOf(String(p||'').toLowerCase())>=0)setTimeout(function(){repair(true)},20);
});
document.addEventListener('click',function(e){
  var b=e.target&&e.target.closest&&e.target.closest('[data-p="industrydirectory"],[data-p="companies"],[data-p="allcontacts"],[data-p="contacts"],[data-page="industrydirectory"],[data-page="companies"],[data-page="allcontacts"],[data-page="contacts"],[data-nav="industrydirectory"]');
  if(b)setTimeout(function(){repair(true)},60);
},true);
})();