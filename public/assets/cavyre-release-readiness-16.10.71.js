(function(){
'use strict';if(window.__CAVYRE_RELEASE_161071__)return;window.__CAVYRE_RELEASE_161071__=true;
var R={release:'16.10.71',baseline:'16.10.70',portal:'agent',started_at:new Date().toISOString(),errors:[],rejections:[],checks:{}};
window.CAVYRE_RELEASE_READINESS=R;
function add(kind,value){var a=R[kind];if(a&&a.length<25)a.push({at:new Date().toISOString(),message:String(value||'Unknown runtime error')})}
window.addEventListener('error',function(e){add('errors',e.message||e.error)},true);
window.addEventListener('unhandledrejection',function(e){add('rejections',e.reason&&e.reason.message||e.reason)},true);
function audit(){
 R.checks={
   online:navigator.onLine,
   path:location.pathname,
   model_calendar:!!document.querySelector('#p-modelpage'),
   finance_workspace:!!document.querySelector('#p-financelegal'),
   travel_workspace:!!document.querySelector('#p-travelvisa'),
   command_workspace:!!document.querySelector('#p-command,#p-agencycommand'),
   horizontal_overflow:document.documentElement.scrollWidth>document.documentElement.clientWidth+3,
   viewport_width:window.innerWidth,
   viewport_height:window.innerHeight
 };
 R.last_audit=new Date().toISOString();return R.checks;
}
R.audit=audit;setTimeout(audit,1200);window.addEventListener('resize',function(){clearTimeout(R._t);R._t=setTimeout(audit,120)}, {passive:true});
})();