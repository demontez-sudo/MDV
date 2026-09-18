/* CAVYRE 16.12.01 — Booking / Casting / Submission Authority */
(function(){
'use strict';if(window.__CAVYRE_BOOKING_CASTING_161201__)return;window.__CAVYRE_BOOKING_CASTING_161201__=1;
function bridge(){if(!window.VEUX_AGENT_V4||!VEUX_AGENT_V4.api)throw new Error('Secure Agent bridge is not ready');return VEUX_AGENT_V4}
function org(){try{return bridge().state.org.slug||'maison-de-veux'}catch(e){return'maison-de-veux'}}
async function post(body){var out=await bridge().api('/api/agent/bookings/v9',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(Object.assign({organization_slug:org()},body))});if(!out||out.verified!==true)throw new Error('Booking/Casting change was not verified as saved.');return out}
function id(el,key){var x=el&&el.closest&&el.closest('['+key+']');return x&&x.getAttribute(key)||el&&el.getAttribute&&el.getAttribute(key)||''}
function txt(el){return String(el&&el.textContent||'').replace(/\s+/g,' ').trim().toLowerCase()}
async function bookingStatus(bookingId,status){if(!bookingId)throw new Error('Booking record is required.');return post({action:'update_booking',booking_id:bookingId,status:status})}
async function castingStatus(castingId,status){if(!castingId)throw new Error('Casting record is required.');return post({action:'update_casting',casting_id:castingId,status:status})}
document.addEventListener('click',function(e){
 var b=e.target.closest&&e.target.closest('button,a,[role="button"]');if(!b)return;var t=txt(b),bid=id(b,'data-booking-id'),cid=id(b,'data-casting-id');
 if(bid){
   var bm={'confirm booking':'confirmed','mark confirmed':'confirmed','mark completed':'completed','complete booking':'completed','cancel booking':'cancelled','mark option':'option','mark hold':'hold'};
   if(bm[t]){e.preventDefault();b.disabled=true;bookingStatus(bid,bm[t]).then(function(){if(window.toast)toast('✓ Booking '+bm[t]+' and verified');if(window.rerender)rerender('bookings')}).catch(function(x){alert(x.message||x)}).finally(function(){b.disabled=false});return}
 }
 if(cid){
   var cm={'open casting':'open','close casting':'closed','cancel casting':'cancelled','mark submitted':'submitted','mark callback':'callback'};
   if(cm[t]){e.preventDefault();b.disabled=true;castingStatus(cid,cm[t]).then(function(){if(window.toast)toast('✓ Casting '+cm[t]+' and verified');if(window.rerender)rerender('bookings')}).catch(function(x){alert(x.message||x)}).finally(function(){b.disabled=false});return}
 }
},false);
window.CAVYRE_BOOKING_CASTING_ACTIONS={release:'16.12.01',bookingStatus:bookingStatus,castingStatus:castingStatus};
})();