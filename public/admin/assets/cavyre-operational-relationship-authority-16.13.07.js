(function(){
'use strict';
var RELEASE='16.13.07';
function arr(v){return Array.isArray(v)?v:[]}
function t(v){var n=Date.parse(v||'');return isFinite(n)?n:null}
function overlap(a,b,c,d){a=t(a);b=t(b)||a;c=t(c);d=t(d)||c;return a!=null&&c!=null&&a<=d&&c<=b}
function active(v){return !/cancelled|canceled|closed|released|declined|archived/i.test(String(v||''))}
function location(v){return String(v||'').trim().toLowerCase()}
function samePlace(a,b){a=location(a);b=location(b);return !a||!b||a.indexOf(b)>=0||b.indexOf(a)>=0}
function evaluate(payload){
 var g=payload&&payload.graph||{}, model=g.model||{}, id=model.id||payload&&payload.model_id, conflicts=[], timeline=[];
 var links=arr(g.booking_models).filter(function(x){return active(x.status)}), bookings=arr(g.bookings), bmap=new Map(bookings.map(function(x){return[String(x.id),x]}));
 var clinks=arr(g.casting_models).filter(function(x){return active(x.status)}), castings=arr(g.castings), cmap=new Map(castings.map(function(x){return[String(x.id),x]}));
 var blocks=arr(g.availability).filter(function(x){return active(x.status)}), travel=arr(g.travel).filter(function(x){return active(x.status)}), visas=arr(g.visa_cases).filter(function(x){return active(x.status)});
 links.forEach(function(l){var b=bmap.get(String(l.booking_id));if(!b)return;var bs=b.starts_at||b.call_time,be=b.ends_at||bs;timeline.push({kind:'booking',id:b.id,starts_at:bs,ends_at:be,title:b.title||'Booking',status:l.status||b.status,source:'bookings'});
  blocks.forEach(function(a){if(overlap(bs,be,a.starts_at,a.ends_at)&&/bookout|unavailable|blocked/i.test(String(a.block_type||a.reason||a.status||'')))conflicts.push({type:'availability',severity:'high',model_id:id,booking_id:b.id,availability_id:a.id,message:'Booking overlaps an unavailable/bookout period.'})});
  clinks.forEach(function(x){var c=cmap.get(String(x.casting_id));if(c&&overlap(bs,be,x.slot_at||c.starts_at,c.ends_at||x.slot_at||c.starts_at))conflicts.push({type:'schedule',severity:'high',model_id:id,booking_id:b.id,casting_id:c.id,message:'Booking overlaps a casting.'})});
  travel.forEach(function(x){if(overlap(bs,be,x.starts_at,x.ends_at||x.starts_at)&&!samePlace(b.location||b.city,x.destination||x.location))conflicts.push({type:'movement',severity:'high',model_id:id,booking_id:b.id,travel_id:x.id,message:'Booking location may conflict with model movement.'})});
 });
 clinks.forEach(function(l){var c=cmap.get(String(l.casting_id));if(c)timeline.push({kind:'casting',id:c.id,starts_at:l.slot_at||c.starts_at,ends_at:c.ends_at,title:c.title||'Casting',status:l.status||c.status,source:'castings'})});
 travel.forEach(function(x){timeline.push({kind:'travel',id:x.id,starts_at:x.starts_at,ends_at:x.ends_at,title:[x.origin,x.destination].filter(Boolean).join(' → ')||x.purpose||'Travel',status:x.status,source:'travel_records'})});
 visas.forEach(function(v){if(v.appointment_at)timeline.push({kind:'visa',id:v.id,starts_at:v.appointment_at,title:'Visa appointment',status:v.status,source:'visa_cases'});if(v.hard_deadline)timeline.push({kind:'visa_deadline',id:v.id,starts_at:v.hard_deadline,title:'Visa deadline',status:v.status,source:'visa_cases'})});
 arr(g.events).filter(function(x){return active(x.status)}).forEach(function(e){timeline.push({kind:e.event_type||'event',id:e.id,starts_at:e.starts_at,ends_at:e.ends_at,title:e.title||'Calendar event',status:e.status,source:'events'})});
 timeline.sort(function(a,b){return (t(a.starts_at)||9e15)-(t(b.starts_at)||9e15)});
 var now=Date.now(), live=travel.find(function(x){var a=t(x.starts_at),z=t(x.ends_at)||a;return a!=null&&a<=now&&(z==null||z>=now)}), next=travel.filter(function(x){return (t(x.starts_at)||0)>now}).sort(function(a,b){return t(a.starts_at)-t(b.starts_at)})[0];
 var pendingVisa=visas.filter(function(v){return !/approved|valid|complete|completed/i.test(String(v.status||''))});
 var unavailable=blocks.some(function(a){return /bookout|unavailable|blocked/i.test(String(a.block_type||a.reason||a.status||''))&&overlap(new Date().toISOString(),new Date().toISOString(),a.starts_at,a.ends_at)});
 var score=100-(unavailable?35:0)-Math.min(35,conflicts.length*15)-Math.min(30,pendingVisa.length*20);score=Math.max(0,score);
 return {release:RELEASE,model_id:id,timeline:timeline,conflicts:conflicts,movement:{state:live?'traveling':next?'movement_planned':'in_market_or_no_active_travel',current:live||null,next:next||null},visa:{attention:pendingVisa.length>0,cases:visas},availability:{available_now:!unavailable,blocks:blocks},readiness:{score:score,state:score>=85?'ready':score>=60?'development':'at_risk'},projections:{calendar:timeline,season:{bookings:links.length,castings:clinks.length,movement:travel.length,visa:visas.length,conflicts:conflicts.length}}};
}
function emit(name,d){try{window.dispatchEvent(new CustomEvent(name,{detail:d}));}catch(e){}}
function publish(payload){var r=evaluate(payload);window.__CAVYRE_ACTIVE_RELATIONSHIPS__=r;emit('cavyre:relationships-ready',r);if(r.conflicts.length)emit('cavyre:operational-conflicts',r);return r}
window.CAVYRE_RELATIONSHIPS={release:RELEASE,evaluate:evaluate,current:function(){return window.__CAVYRE_ACTIVE_RELATIONSHIPS__||null},refresh:function(){var W=window.CAVYRE_MODEL_WEB,id=W&&W.activeModel&&W.activeModel();return id&&W.refresh(id).then(publish)}};
window.addEventListener('cavyre:model-web-ready',function(e){if(e.detail)publish(e.detail)});
window.addEventListener('cavyre:model-web-invalidated',function(){window.__CAVYRE_ACTIVE_RELATIONSHIPS__=null});
if(window.__CAVYRE_ACTIVE_MODEL_GRAPH__)publish(window.__CAVYRE_ACTIVE_MODEL_GRAPH__);
})();
