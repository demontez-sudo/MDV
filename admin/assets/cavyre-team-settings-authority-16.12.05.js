/* CAVYRE 16.12.05 — Team / Settings Interaction Authority */
(function(){
'use strict';if(window.__CAVYRE_TEAM_SETTINGS_161205__)return;window.__CAVYRE_TEAM_SETTINGS_161205__=1;
function txt(e){return String(e&&e.textContent||'').replace(/\s+/g,' ').trim().toLowerCase()}
document.addEventListener('click',function(e){
 var b=e.target&&e.target.closest&&e.target.closest('button,a,[role="button"]');if(!b)return;var t=txt(b);
 var v=window.VEUX_V10;
 if(!v)return;
 var map={
  'agency identity':'editIdentity','edit agency identity':'editIdentity',
  'booking defaults':'editBookingDefaults','edit booking defaults':'editBookingDefaults',
  'finance defaults':'editFinanceDefaults','edit finance defaults':'editFinanceDefaults',
  'security defaults':'editSecurityDefaults','edit security defaults':'editSecurityDefaults',
  '+ market':'newMarket','new market':'newMarket',
  '+ division':'newDivision','new division':'newDivision',
  '+ board':'newBoard','new board':'newBoard'
 };
 if(map[t]&&typeof v[map[t]]==='function'){e.preventDefault();v[map[t]]();return}
},false);
window.CAVYRE_TEAM_SETTINGS_ACTIONS={release:'16.12.05'};
document.documentElement.setAttribute('data-cavyre-team-settings-actions','16.12.05');
})();