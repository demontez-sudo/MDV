/* VEUX DESK 16.9 — production stability / touch calendar / mobile interaction recovery */
(function(){'use strict';
var V='16.9.0',touch=null;
function A(){return window.VEUX_AGENT_V4;} function org(){return A()?.state?.org?.slug||'maison-de-veux';}
function post(path,body){if(!A()?.api)return Promise.reject(new Error('VEUX Agent API is not ready.'));return A().api(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body||{})});}
function toast(s){if(typeof window.toast==='function')window.toast(s);else console.info('[VEUX]',s);}
function calendarPanel(){return document.getElementById('p-calendar');}
function sourceData(el){return {kind:el.dataset.calKind,id:el.dataset.calId,key:el.dataset.calKey||'',start:el.dataset.calStart,end:el.dataset.calEnd||'',title:(el.querySelector('b')?.textContent||el.textContent||'Calendar item').trim().slice(0,90)};}
function targetStart(src,target,clientY){var old=new Date(src.start);if(isNaN(old))throw new Error('Calendar item has an invalid start date.');var ds=target?.dataset?.calDate;if(!ds)throw new Error('Choose a calendar date.');var p=ds.split('-').map(Number),d=new Date(old);d.setFullYear(p[0],p[1]-1,p[2]);if(target.classList.contains('v152-daybody')){var r=target.getBoundingClientRect(),mins=Math.max(0,Math.round((8*60+(clientY-r.top)/48*60)/30)*30);d.setHours(Math.floor(mins/60),mins%60,0,0);}return d;}
async function move(src,target,clientY){if(!src||!target)return;if(String(src.type||src.event_type||src.calendar_event_type||'').toLowerCase()==='travel'||(src.raw&&src.raw.metadata&&(src.raw.metadata.travel_record_id||src.raw.metadata.mobility_travel_id))){alert('Move Travel from Travel & Visa so itinerary, housing and arrival intelligence stay synchronized.');return;}if((src.key||'').includes('@')){alert('Recurring items should be moved through Edit Series.');return;}var ns=targetStart(src,target,clientY),path=src.kind==='event'?'/api/agent/calendar/v9':'/api/agent/bookings/v9',body=src.kind==='event'?{action:'move_event',event_id:src.id,starts_at:ns.toISOString()}:src.kind==='casting'?{action:'move_casting',casting_id:src.id,starts_at:ns.toISOString()}:{action:'move_booking',booking_id:src.id,starts_at:ns.toISOString()};target.classList.add('v1690-saving');try{await post(path,body);A()?.clearApiCache?.();toast('✓ Calendar item moved');var p=calendarPanel();if(p&&typeof window.renderCalendar==='function')await window.renderCalendar(p);}catch(e){alert(e.message||String(e));}finally{target.classList.remove('v1690-saving');}}
function clearTouch(){if(!touch)return;clearTimeout(touch.timer);touch.target?.classList.remove('v1690-touch-target');touch.ghost?.remove();touch=null;}
/* Separate definition avoids a minifier-hostile accidental token in older browsers. */
function bindTouchCalendar(){var root=calendarPanel();if(!root||root.dataset.v1690Pointer)return;root.dataset.v1690Pointer='1';
 root.addEventListener('pointerdown',function(e){if(e.pointerType==='mouse')return;var item=e.target.closest('[data-cal-kind][data-cal-id]');if(!item||e.target.closest('a,input,select,textarea'))return;var src=sourceData(item),sx=e.clientX,sy=e.clientY;clearTouch();touch={src:src,item:item,startX:sx,startY:sy,x:sx,y:sy,active:false,target:null,ghost:null,timer:setTimeout(function(){if(!touch)return;touch.active=true;item.setPointerCapture?.(e.pointerId);var g=document.createElement('div');g.className='v1690-calendar-touch-ghost';g.textContent='Move · '+src.title;document.body.appendChild(g);touch.ghost=g;positionGhost(sx,sy);if(navigator.vibrate)try{navigator.vibrate(20);}catch(_){ }},260)};
 },true);
 root.addEventListener('pointermove',function(e){if(!touch)return;touch.x=e.clientX;touch.y=e.clientY;if(!touch.active){if(Math.hypot(e.clientX-touch.startX,e.clientY-touch.startY)>12)clearTouch();return;}e.preventDefault();positionGhost(e.clientX,e.clientY);touch.target?.classList.remove('v1690-touch-target');var hit=document.elementFromPoint(e.clientX,e.clientY),target=hit&&hit.closest('[data-cal-date]');touch.target=target||null;touch.target?.classList.add('v1690-touch-target');}, {capture:true,passive:false});
 root.addEventListener('pointerup',function(e){if(!touch)return;var t=touch,active=t.active,target=t.target,y=t.y;clearTouch();if(active&&target){e.preventDefault();e.stopPropagation();move(t.src,target,y);}},true);
 root.addEventListener('pointercancel',clearTouch,true);
}
function positionGhost(x,y){if(!touch?.ghost)return;touch.ghost.style.left=Math.min(innerWidth-230,x+12)+'px';touch.ghost.style.top=Math.max(8,y-54)+'px';}
function strengthenNativeDrag(){var root=calendarPanel();if(!root)return;root.querySelectorAll('[data-cal-kind][data-cal-id]').forEach(function(item){if(item.dataset.v1690Native)return;item.dataset.v1690Native='1';item.draggable=true;item.addEventListener('dragstart',function(e){var d=sourceData(item),raw=JSON.stringify(d);e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('application/json',raw);e.dataTransfer.setData('text/plain',raw);item.classList.add('v1686-dragging');});item.addEventListener('dragend',function(){item.classList.remove('v1686-dragging');root.querySelectorAll('.v1690-touch-target,.v1686-drop').forEach(x=>x.classList.remove('v1690-touch-target','v1686-drop'));});});}
function bindRosterTap(){var root=document.getElementById('p-roster');if(!root||root.dataset.v1690Tap)return;root.dataset.v1690Tap='1';root.addEventListener('click',function(e){if(e.target.closest('button,a,input,select,textarea,[data-no-model-open]'))return;var row=e.target.closest('[data-model-id],.v155-table-row.roster');if(!row)return;var id=row.dataset.modelId||((row.getAttribute('onclick')||'').match(/selectRoster\('([^']+)'/)||[])[1];if(!id)return;e.preventDefault();window._veuxV10ModelId=id;if(typeof window.navTo==='function')window.navTo('modelpage');},true);}
function bindMobileCRMEdit(){var root=document.getElementById('p-industrydirectory')||document.querySelector('.panel.on .v1686-crm');if(!root||root.dataset.v1690Crm)return;root.dataset.v1690Crm='1';root.addEventListener('click',function(e){if(innerWidth>760)return;var row=e.target.closest('.v1686-crm-row');if(!row)return;var m=(row.getAttribute('onclick')||'').match(/crmSelect\('([^']+)'/);if(!m||!window.CavyreCRM)return;var contact=Array.from(root.querySelectorAll('.v1686-tabs button.on')).some(function(x){return /Professional Contacts/i.test(x.textContent||'');});setTimeout(function(){contact?CavyreCRM.openContact(m[1]):CavyreCRM.openCompany(m[1]);},20);},true);}
function normalizeEmptyButtons(){document.querySelectorAll('button').forEach(function(b){if(!b.getAttribute('aria-label')&&!b.textContent.trim()&&b.title)b.setAttribute('aria-label',b.title);});}
function refresh(page){if(page==='calendar'){bindTouchCalendar();strengthenNativeDrag();}if(page==='roster')bindRosterTap();if(page==='industrydirectory')bindMobileCRMEdit();normalizeEmptyButtons();}
window.addEventListener('veux:page-rendered',function(e){refresh(e?.detail?.page||window._currentPage);});window.addEventListener('resize',function(){if(window._currentPage==='industrydirectory')bindMobileCRMEdit();});
setTimeout(function(){refresh(window._currentPage);},80);
window.VEUX_V1690={version:V,refresh:refresh,moveCalendarItem:move};
window.dispatchEvent(new CustomEvent('veux:v16.9-ready',{detail:{version:V}}));console.info('[VEUX DESK] 16.9 stability layer loaded');
})();

/* 16.9.1 pre-deploy alignment: deterministic diagnostics + async page error boundary */
(function(){'use strict';
 var V='16.9.1';
 window.__VEUX_RELEASE__='16.9.7-agency-operational-integrity-20260817';
 if(window.VEUX_PERF)window.VEUX_PERF.version=V;
 function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
 function pageError(el,page,err){if(!el)return;var msg=err&&err.message?err.message:String(err||'Unknown page error');el.dataset.vxReady='0';el.innerHTML='<div class="v1691-page-error"><small>VEUX DESK · '+esc(page||'PAGE')+'</small><h2>This page could not finish loading.</h2><p>'+esc(msg)+'</p><button type="button" onclick="window.VEUX_V1691.retry(\''+esc(page||'overview')+'\')">Retry Page</button></div>';}
 var baseBuild=window.build;
 if(typeof baseBuild==='function'&&!baseBuild.__v1691){
   var wrapped=function(page,el){var out;try{out=baseBuild(page,el);}catch(e){pageError(el,page,e);return Promise.reject(e);}return Promise.resolve(out).catch(function(e){pageError(el,page,e);return null;});};
   wrapped.__v1691=true;window.build=wrapped;
 }
 function rendererHealth(){var routes=window.VEUX_V15_ROUTE_RENDERERS||{},missing=[];Object.keys(routes).forEach(function(k){if(typeof routes[k]!=='function')missing.push(k);});return {routes:Object.keys(routes).length,missing:missing};}
 function assetHealth(){var required=['VEUX_AGENT_V4','VEUX_V15_ROUTE_RENDERERS','VEUX_V1690'];return required.map(function(k){return {name:k,ready:!!window[k]};});}
 window.VEUX_V1691={version:V,retry:function(page){var el=document.getElementById('p-'+page);if(el&&el.dataset){el.dataset.vxReady='0';el.dataset.vxRenderedAt='0';}if(window.VEUX_PERF&&VEUX_PERF.invalidate)VEUX_PERF.invalidate(page);if(typeof window.navTo==='function')window.navTo(page);},health:function(){return {release:window.__VEUX_RELEASE__,renderers:rendererHealth(),assets:assetHealth(),page:window._currentPage||null};}};
 window.dispatchEvent(new CustomEvent('veux:v16.9.1-ready',{detail:{version:V}}));
 console.info('[VEUX DESK] 16.9.1 pre-deploy alignment loaded',window.VEUX_V1691.health());
})();

/* compatibility marker: 16.9.1-agency-predeploy-alignment-20260817 */


/* 16.9.4 interaction integrity */
/* VEUX DESK 16.9.4 — small interaction integrity */
(function(){
'use strict';
if(window.__VEUX_1694_INTERACTION__)return;window.__VEUX_1694_INTERACTION__=true;
var VERSION='16.9.4';
function E(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c];});}
function A(v){return Array.isArray(v)?v:[];}
function $i(id){return document.getElementById(id);}
function bridge(){if(!window.VEUX_AGENT_V4||!VEUX_AGENT_V4.api)throw new Error('VEUX secure connection is not ready. Refresh and try again.');return VEUX_AGENT_V4;}
function org(){try{return bridge().state.org&&bridge().state.org.slug||'maison-de-veux';}catch(_){return'maison-de-veux';}}
function api(path,opt){return bridge().api(path,opt||{method:'GET',headers:{},__fresh:true});}
function post(path,body){return api(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(Object.assign({organization_slug:org()},body||{}))});}
function contextMessage(path,status){
  path=String(path||'');
  if(/crm/.test(path))return 'Company / contact request failed'+(status?' ('+status+')':'')+'. Please retry.';
  if(/calendar|bookings/.test(path))return 'Calendar request failed'+(status?' ('+status+')':'')+'. Your changes were not saved.';
  if(/package/.test(path))return 'Model Package request failed'+(status?' ('+status+')':'')+'. Please retry.';
  if(/mobility|visa|travel|housing/.test(path))return 'Mobility request failed'+(status?' ('+status+')':'')+'. Please retry.';
  if(/media|storage|portfolio/.test(path))return 'File / photo request failed'+(status?' ('+status+')':'')+'. Please retry.';
  return 'VEUX request failed'+(status?' ('+status+')':'')+'. Please retry.';
}
function wrapApi(){
  var b=window.VEUX_AGENT_V4;if(!b||!b.api||b.api.__vx1694)return false;var base=b.api;
  async function wrapped(path,opt){try{return await base(path,opt);}catch(e){if(e&&e.message==='Server error'){var x=new Error(contextMessage(path,e.status));x.status=e.status;x.data=e.data;x.cause=e;throw x;}throw e;}}
  wrapped.__vx1694=true;wrapped.__base=base;b.api=wrapped;if(window.VEUX_AGENT_V16)window.VEUX_AGENT_V16.api=wrapped;return true;
}
function close(){var n=$i('vx1321-back');if(n)n.remove();}
function markCrmDirty(){
  try{if(window._dirtyPanels&&window._dirtyPanels.add)window._dirtyPanels.add('industrydirectory');}catch(e){}
  var p=$i('p-industrydirectory');if(p&&p.dataset){p.dataset.vxReady='0';p.dataset.vxRenderedAt='0';}
}
function refreshCrmPanel(){
  markCrmDirty();
  var p=$i('p-industrydirectory');
  if(window._currentPage==='industrydirectory'&&p&&typeof window.renderIndustryDirectory==='function'){
    try{window.renderIndustryDirectory(p);if(p.dataset){p.dataset.vxReady='1';p.dataset.vxRenderedAt=String(Date.now());}if(window._dirtyPanels&&window._dirtyPanels.delete)window._dirtyPanels.delete('industrydirectory');}catch(e){console.error('[VEUX CRM refresh]',e);}
  }
}
function clearTransientUi(){
  ['vx1321-back','v153-modal','v155-modal','v1682-modal','v1686-modal','v1680-event-modal','vx132-model-modal','vx132-event-modal','vx133-modal'].forEach(function(id){var n=$i(id);if(n)n.remove();});
  document.querySelectorAll('.vx1321-back,.v153-modal,.v155-modal-bg,.v1682-back,.v1686-modal-back,.vx132-modalback,.vx133-modalback').forEach(function(n){if(n&&n.parentNode===document.body)n.remove();});
  document.documentElement.classList.remove('veux-modal-open');
  document.body&&document.body.classList.remove('modal-open');
}
function sanitizeWorkspace(){
  var pm=$i('pm');if(!pm)return;
  Array.from(pm.children).forEach(function(n){if(!n.classList||!n.classList.contains('panel'))n.remove();});
}
function openCompany(id){if(!window.CavyreCRM)throw new Error('CAVYRE CRM authority is not ready');return CavyreCRM.openCompany(id);}
function openContact(id){if(!window.CavyreCRM)throw new Error('CAVYRE CRM authority is not ready');return CavyreCRM.openContact(id);}
function install(){var apiReady=wrapApi()||!!(window.VEUX_AGENT_V4&&window.VEUX_AGENT_V4.api&&window.VEUX_AGENT_V4.api.__vx1694);var crmReady=!!window.CavyreCRM;if(crmReady&&window.VEUX_V1321){window.VEUX_V1321.openCompany=openCompany;window.VEUX_V1321.openContact=openContact;}if(crmReady&&window.VEUX_V1687)window.VEUX_V1687.crmOpenCompany=openCompany;return apiReady;}
window.VEUX_V1694={version:VERSION,close:close,openCompany:openCompany,openContact:openContact,refreshCrmPanel:refreshCrmPanel,clearTransientUi:clearTransientUi,sanitizeWorkspace:sanitizeWorkspace,install:install};
(function bindNavigationLifecycle(){
  if(typeof window.navTo!=='function'||window.navTo.__vx1698)return;
  var baseNav=window.navTo;
  function nav(p){clearTransientUi();sanitizeWorkspace();var r=baseNav.apply(this,arguments);sanitizeWorkspace();return r;}
  nav.__vx1698=true;nav.__base=baseNav;window.navTo=nav;
})();
install();
window.addEventListener('veux:agency-v16-session',install);window.dispatchEvent(new CustomEvent('veux:v16.9.4-ready',{detail:{version:VERSION,features:['single-crm-compatibility','context-errors']}}));
})();
