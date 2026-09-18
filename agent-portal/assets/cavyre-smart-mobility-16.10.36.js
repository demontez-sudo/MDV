(function(){
'use strict';
if(window.__CAVYRE_SMART_MOBILITY_161036__)return;window.__CAVYRE_SMART_MOBILITY_161036__=true;
function arr(v){return Array.isArray(v)?v:[]}
function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function api(path){var b=window.VEUX_AGENT_V4;if(!b||!b.api)return Promise.reject(new Error('Agent API unavailable'));return b.api(path,{method:'GET',headers:{}})}
function org(){try{return window.VEUX_AGENT_V4.state.org.slug||'maison-de-veux'}catch(e){return'maison-de-veux'}}
function dt(v){if(!v)return'—';var d=new Date(v);return isNaN(d)?String(v):d.toLocaleString([],{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})}
function daysUntil(v){if(!v)return null;var d=new Date(v);return isNaN(d)?null:Math.ceil((d-new Date())/864e5)}
function hours(a,b){var x=new Date(a),y=new Date(b);return isNaN(x)||isNaN(y)?null:(y-x)/36e5}
function modelName(d,id){var m=arr(d.lookups&&d.lookups.models).find(function(x){return String(x.id)===String(id)});return m&&m.display_name||'Model'}
function eventModels(e){return arr(e.model_ids||e.models||e.model_ids_flat).map(function(x){return String(x&&x.id||x)})}
function travelIntelligence(d,cal){
 var events=arr(cal&&cal.events),rows=[];
 arr(d.travel).filter(function(t){return !/completed|cancelled/.test(String(t.status||''))}).forEach(function(t){
  var seg=arr(d.travel_segments).filter(function(x){return String(x.travel_record_id)===String(t.id)}).sort(function(a,b){return String(a.departs_at||'').localeCompare(String(b.departs_at||''))});
  var house=arr(d.housing).filter(function(x){return String(x.travel_record_id)===String(t.id)});
  var arrival=(seg.length&&seg[seg.length-1].arrives_at)||t.ends_at||t.starts_at;
  var next=events.filter(function(e){return eventModels(e).includes(String(t.model_id))&&e.starts_at&&new Date(e.starts_at)>new Date(arrival)&&String(e.event_type)!=='travel'}).sort(function(a,b){return new Date(a.starts_at)-new Date(b.starts_at)})[0]||null;
  var buffer=next?hours(arrival,next.starts_at):null,confirmedHousing=house.some(function(h){return /booked|confirmed/.test(String(h.status||''))});
  var risk=!seg.length?'review':buffer!=null&&buffer<6?'critical':buffer!=null&&buffer<10?'watch':!confirmedHousing?'watch':'ready';
  rows.push({travel:t,segment:seg[0]||null,arrival:arrival,next:next,buffer:buffer,housing:house,risk:risk});
 });
 return rows;
}
function visaRisks(d){
 return arr(d.visa_cases).map(function(v){var deadline=daysUntil(v.hard_deadline),expiry=daysUntil(v.expires_on),risk=/refused|expired/.test(String(v.status||''))?'critical':deadline!=null&&deadline<=7?'critical':deadline!=null&&deadline<=21?'watch':expiry!=null&&expiry<=30?'watch':'ready';return{visa:v,deadline:deadline,expiry:expiry,risk:risk}}).filter(function(x){return x.risk!=='ready'||!/approved|issued/.test(String(x.visa.status||''))});
}
function chip(r){return '<span class="cvsm-chip '+r+'">'+(r==='critical'?'CRITICAL':r==='watch'?'WATCH':r==='review'?'REVIEW':'READY')+'</span>'}
function render(el,d,cal){
 var tr=travelIntelligence(d,cal),vr=visaRisks(d),critical=tr.filter(function(x){return x.risk==='critical'}).length+vr.filter(function(x){return x.risk==='critical'}).length;
 var html='<section class="cvsm-command"><div class="cvsm-command-head"><div><small>CAVYRE · MOBILITY INTELLIGENCE</small><h2>Travel & Visa Command</h2><p>Calendar-connected movement, arrival protection, housing and immigration readiness.</p></div><button onclick="navTo(\'calendar\')">OPEN SMART CALENDAR →</button></div>';
 html+='<div class="cvsm-kpis"><div><b>'+tr.length+'</b><span>Active Movements</span></div><div><b>'+vr.length+'</b><span>Visa Watch</span></div><div><b>'+critical+'</b><span>Critical</span></div><div><b>'+tr.filter(function(x){return x.risk==='ready'}).length+'</b><span>Travel Ready</span></div></div>';
 html+='<div class="cvsm-grid"><div class="cvsm-list"><header>TRAVEL FLOW</header>'+(tr.length?tr.slice(0,8).map(function(x){var t=x.travel,route=[t.origin,x.segment&&x.segment.origin,t.destination,x.segment&&x.segment.destination].filter(Boolean),r=(route[0]||'Origin')+' → '+(route[route.length-1]||'Destination');return '<article><div class="cvsm-route"><small>'+esc(modelName(d,t.model_id))+'</small><h3>'+esc(r)+'</h3><p>'+esc(dt((x.segment&&x.segment.departs_at)||t.starts_at))+' → '+esc(dt(x.arrival))+'</p></div>'+chip(x.risk)+'<div class="cvsm-flow"><span class="on">TRAVEL</span><i>→</i><span class="'+(x.housing.length?'on':'')+'">HOUSING</span><i>→</i><span class="'+(x.next?'on':'')+'">NEXT COMMITMENT</span></div><div class="cvsm-meta"><span>Housing <b>'+esc(x.housing.length?(x.housing[0].status||'linked'):'Missing')+'</b></span><span>Arrival Buffer <b>'+(x.buffer==null?'—':Math.max(0,x.buffer).toFixed(1)+'h')+'</b></span><span>Next <b>'+esc(x.next?(x.next.title||x.next.event_type):'None loaded')+'</b></span></div></article>'}).join(''):'<div class="cvsm-empty">No active travel.</div>')+'</div>';
 html+='<div class="cvsm-list"><header>VISA / DOCUMENT READINESS</header>'+(vr.length?vr.slice(0,8).map(function(x){var v=x.visa;return '<article><div class="cvsm-route"><small>'+esc(modelName(d,v.model_id))+' · '+esc(v.country_code||'')+'</small><h3>'+esc(v.visa_type||v.case_type||'Visa')+'</h3><p>'+esc(v.status||'not started')+(v.hard_deadline?' · Deadline '+esc(v.hard_deadline):'')+'</p></div>'+chip(x.risk)+'<div class="cvsm-meta"><span>Deadline <b>'+(x.deadline==null?'—':x.deadline+'d')+'</b></span><span>Appointment <b>'+esc(dt(v.appointment_at))+'</b></span><span>Expires <b>'+esc(v.expires_on||'—')+'</b></span></div></article>'}).join(''):'<div class="cvsm-empty">No visa risk detected.</div>')+'</div></div></section>';
 var target=el.querySelector('.v1682-tabs');if(target&&!el.querySelector('.cvsm-command'))target.insertAdjacentHTML('beforebegin',html);
}
async function enhance(el){try{var d=await api('/api/agent/mobility?organization='+encodeURIComponent(org()));var cal=await api('/api/agent/calendar/v9?organization='+encodeURIComponent(org())).catch(function(){return{events:[]}});render(el,d,cal)}catch(e){console.warn('[CAVYRE Smart Mobility]',e)}}
function wrap(){var old=window.renderGlobalMobility;if(typeof old!=='function'||old.__cvsm)return false;var fn=function(el){var r=old.apply(this,arguments);setTimeout(function(){if(el&&el.isConnected)enhance(el)},300);return r};fn.__cvsm=true;window.renderGlobalMobility=fn;return true}
var tries=0,t=setInterval(function(){tries++;if(wrap()||tries>60)clearInterval(t)},100);
console.info('[CAVYRE] Smart Mobility 16.10.36 loaded');
})();