/* CAVYRE 16.12.02 — Season / Fashion Week Action Authority */
(function(){
'use strict';if(window.__CAVYRE_SEASON_AUTH_161202__)return;window.__CAVYRE_SEASON_AUTH_161202__=1;
function bridge(){if(!window.VEUX_AGENT_V4||!VEUX_AGENT_V4.api)throw new Error('Secure Agent bridge is not ready');return VEUX_AGENT_V4}
function org(){try{return bridge().state.org.slug||'maison-de-veux'}catch(e){return'maison-de-veux'}}
async function post(body){var out=await bridge().api('/api/agent/season/v9',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(Object.assign({organization_slug:org()},body))});if(!out||out.verified!==true)throw new Error('Season change was not verified as saved.');return out}
function val(el,k){var x=el&&el.closest&&el.closest('['+k+']');return x&&x.getAttribute(k)||el&&el.getAttribute&&el.getAttribute(k)||''}
function text(el){return String(el&&el.textContent||'').replace(/\s+/g,' ').trim().toLowerCase()}
function refresh(){try{var p=document.getElementById('p-seasonmanagement')||document.getElementById('p-season');if(p&&window.renderSeasonManagement)return renderSeasonManagement(p)}catch(e){}}
async function showStatus(id,status){if(!id)throw new Error('Show record is required.');var x=await post({action:'update_show_status',show_id:id,status:status});await refresh();return x}
async function modelStatus(id,status){if(!id)throw new Error('Season model record is required.');var x=await post({action:'update_season_model_status',season_model_id:id,status:status});await refresh();return x}
async function showModelStatus(id,status){if(!id)throw new Error('Show-model assignment is required.');var x=await post({action:'update_show_model_status',show_model_id:id,status:status});await refresh();return x}
document.addEventListener('click',function(e){
 var b=e.target.closest&&e.target.closest('button,a,[role="button"]');if(!b)return;var t=text(b),sid=val(b,'data-show-id'),smid=val(b,'data-season-model-id'),amid=val(b,'data-show-model-id'),job;
 if(sid){var a={'open show':'casting','mark casting':'casting','mark option':'option','confirm show':'confirmed','mark confirmed':'confirmed','complete show':'completed','cancel show':'cancelled'};if(a[t]){e.preventDefault();b.disabled=true;showStatus(sid,a[t]).then(function(){if(window.toast)toast('✓ Show '+a[t]+' and verified')}).catch(function(x){alert(x.message||x)}).finally(function(){b.disabled=false});return}}
 if(smid){var m={'mark pending':'pending','confirm model':'confirmed','mark at risk':'at_risk','withdraw model':'withdrawn','complete model':'complete'};if(m[t]){e.preventDefault();b.disabled=true;modelStatus(smid,m[t]).then(function(){if(window.toast)toast('✓ Season model '+m[t]+' and verified')}).catch(function(x){alert(x.message||x)}).finally(function(){b.disabled=false});return}}
 if(amid){var z={'mark submitted':'submitted','mark callback':'callback','mark option':'option','confirm assignment':'confirmed','release model':'released','complete assignment':'completed','cancel assignment':'cancelled'};if(z[t]){e.preventDefault();b.disabled=true;showModelStatus(amid,z[t]).then(function(){if(window.toast)toast('✓ Show assignment '+z[t]+' and verified')}).catch(function(x){alert(x.message||x)}).finally(function(){b.disabled=false});return}}
},false);
window.CAVYRE_SEASON_ACTIONS={release:'16.12.02',showStatus:showStatus,modelStatus:modelStatus,showModelStatus:showModelStatus};
})();