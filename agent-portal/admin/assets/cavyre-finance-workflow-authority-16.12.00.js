/* CAVYRE 16.12.00 — Verified Relational Finance Workflow */
(function(){
'use strict';if(window.__CAVYRE_FINANCE_WORKFLOW_161200__)return;window.__CAVYRE_FINANCE_WORKFLOW_161200__=1;
function bridge(){if(!window.VEUX_AGENT_V4||!VEUX_AGENT_V4.api)throw new Error('Secure Agent bridge is not ready');return VEUX_AGENT_V4}
function org(){try{return bridge().state.org.slug||'maison-de-veux'}catch(e){return'maison-de-veux'}}
async function post(body){var out=await bridge().api('/api/agent/finance',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(Object.assign({organization_slug:org()},body))});if(!out||out.verified!==true)throw new Error('Finance operation was not verified as saved.');return out}
function id(el,n){var x=el&&el.closest&&el.closest('['+n+']');return x&&x.getAttribute(n)||''}
function text(el){return String(el&&el.textContent||'').replace(/\s+/g,' ').trim().toLowerCase()}
async function invoiceBooking(bookingId){if(!bookingId)throw new Error('A real booking record is required before an invoice can be created.');var out=await post({action:'create_invoice_from_booking',booking_id:bookingId});if(window.toast)toast('✓ Booking invoice created and verified');return out}
document.addEventListener('click',function(e){
 var b=e.target.closest&&e.target.closest('button,a,[role="button"]');if(!b)return;var t=text(b);
 if(/^(create|generate|make) invoice$/.test(t)||/^invoice booking$/.test(t)){
   var bookingId=id(b,'data-booking-id')||b.getAttribute('data-booking-id')||'';
   if(!bookingId)return;
   e.preventDefault();b.disabled=true;invoiceBooking(bookingId).then(function(out){if(window.VEUX_FINANCE_INVOICE_CONTROL&&out.invoice)VEUX_FINANCE_INVOICE_CONTROL.open(out.invoice.id)}).catch(function(err){alert(err.message||err)}).finally(function(){b.disabled=false});
 }
},false);
window.CAVYRE_FINANCE_WORKFLOW={release:'16.12.00',createInvoiceFromBooking:invoiceBooking};
document.documentElement.setAttribute('data-cavyre-finance-workflow','16.12.00');
})();