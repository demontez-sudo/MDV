/* Smart Finance & Legal: KPI overview, Vera financial signals, real invoice/payment forms, payouts, contracts, usage rights, signatures. */
(function(){
'use strict';
if(window.__MDV_FIN__)return;window.__MDV_FIN__=true;

var S={side:'finance',finTab:'overview',legalTab:'contracts',fin:null,legal:null,loadingFin:false,loadingLegal:false,error:'',q:'',statusF:'',root:null,bookings:null,bookingsLoading:false};

function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
function arr(v){return Array.isArray(v)?v:[];}
function bridge(){var b=window.VEUX_AGENT_V4;if(!b||!b.api)throw new Error('Secure session is not ready');return b;}
function org(){try{return bridge().state.org.slug||'maison-de-veux';}catch(e){return 'maison-de-veux';}}
function getFin(){return bridge().api('/api/agent/finance?organization='+encodeURIComponent(org())+'&_t='+Date.now(),{method:'GET',headers:{}});}
function postFin(body){return bridge().api('/api/agent/finance',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(Object.assign({organization_slug:org()},body))});}
function getLegal(){return bridge().api('/api/agent/legal?organization='+encodeURIComponent(org())+'&_t='+Date.now(),{method:'GET',headers:{}});}
function postLegal(body){return bridge().api('/api/agent/legal',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(Object.assign({organization_slug:org()},body))});}
function getBookings(){var start=new Date(Date.now()-90*864e5).toISOString(),end=new Date(Date.now()+180*864e5).toISOString();return bridge().api('/api/agent/calendar/v9?organization='+encodeURIComponent(org())+'&start='+encodeURIComponent(start)+'&end='+encodeURIComponent(end),{method:'GET',headers:{}});}
function toast(m,t){var old=document.querySelector('.fin-toast');if(old)old.remove();var d=document.createElement('div');d.className='fin-toast '+(t||'');d.textContent=m;document.body.appendChild(d);setTimeout(function(){d.remove();},3200);}
function money(n,c){try{return new Intl.NumberFormat('en-US',{style:'currency',currency:c||'USD',maximumFractionDigits:0}).format(Number(n||0));}catch(e){return '$'+Number(n||0).toLocaleString();}}
function safeDate(v){if(!v)return null;var s=String(v);var d=new Date(/^\d{4}-\d{2}-\d{2}$/.test(s)?s+'T12:00:00':s);return isNaN(d)?null:d;}
function dt(v){var d=safeDate(v);return d?d.toLocaleDateString([],{month:'short',day:'numeric',year:'numeric'}):'—';}
function dtShort(v){var d=safeDate(v);return d?d.toLocaleDateString([],{month:'short',day:'numeric'}):'—';}
function ago(v){if(!v)return null;var d=(Date.now()-new Date(v).getTime())/86400000;return isNaN(d)?null:d;}
function daysUntil(v){var d=safeDate(v);return d?(d.getTime()-Date.now())/86400000:null;}
function bal(x){return Math.max(0,Number(x.amount_due!=null?x.amount_due:(Number(x.total||0)-Number(x.amount_paid||0)))||0);}

/* ---------- domain summary (recomputed client-side; the finance_dashboard RPC's fields aren't trusted here) ---------- */
function summarize(d){
  var inv=arr(d.invoices),pay=arr(d.payments),po=arr(d.payouts);
  var outstanding=inv.reduce(function(s,x){return s+bal(x);},0);
  var overdueInv=inv.filter(function(x){var d2=safeDate(x.due_date);return bal(x)>0&&(String(x.status||'').toLowerCase()==='overdue'||(d2&&d2<new Date()));});
  var overdueTotal=overdueInv.reduce(function(s,x){return s+bal(x);},0);
  var dueSoon=inv.filter(function(x){var d2=daysUntil(x.due_date);return bal(x)>0&&d2!=null&&d2>=0&&d2<=7&&overdueInv.indexOf(x)===-1;});
  var unpaid=inv.filter(function(x){return bal(x)>0;});
  var monthStart=new Date(new Date().getFullYear(),new Date().getMonth(),1);
  var monthlyRevenue=pay.filter(function(x){if(String(x.status||'')==='failed')return false;var d2=new Date(x.created_at||x.received_at||0);return d2>=monthStart&&+d2<=Date.now();}).reduce(function(s,x){return s+Number(x.base_amount||x.amount||0);},0);
  var openPayouts=po.filter(function(x){return !['paid','failed','cancelled'].includes(String(x.status||''));});
  var overduePayouts=openPayouts.filter(function(x){var d2=safeDate(x.due_on);return d2&&d2<new Date();});
  var collectionRisk=unpaid.length?Math.min(100,Math.round(overdueInv.length/unpaid.length*100)):0;
  return{outstanding:outstanding,overdueInv:overdueInv,overdueTotal:overdueTotal,dueSoon:dueSoon,unpaid:unpaid,monthlyRevenue:monthlyRevenue,openPayouts:openPayouts,overduePayouts:overduePayouts,collectionRisk:collectionRisk};
}

/* ---------- Vera financial signals: rule-based, ranked, capped — same shape as mdv-packages.js signals() ---------- */
function signals(sum){
  var out=[];
  sum.overdueInv.slice().sort(function(a,b){return new Date(a.due_date||0)-new Date(b.due_date||0);}).slice(0,3).forEach(function(x){
    var days=Math.max(0,Math.floor(-daysUntil(x.due_date)));
    out.push({k:days>=14?'hot':'warm',id:x.id,t:(x.invoice_number||'Invoice')+' is overdue',d:money(bal(x),x.currency)+' from '+((x.companies&&x.companies.name)||'a client')+' is '+days+' day'+(days===1?'':'s')+' past due.',a:'Open',nav:'financelegal'});
  });
  sum.dueSoon.slice(0,2).forEach(function(x){
    var days=Math.max(0,Math.round(daysUntil(x.due_date)));
    out.push({k:'cool',id:x.id,t:(x.invoice_number||'Invoice')+' due soon',d:money(bal(x),x.currency)+' from '+((x.companies&&x.companies.name)||'a client')+' is due in '+days+' day'+(days===1?'':'s')+'.',a:'Open',nav:'financelegal'});
  });
  sum.overduePayouts.slice(0,2).forEach(function(x){
    var who=(x.models&&x.models.display_name)||(x.partner_agencies&&x.partner_agencies.name)||'A payout';
    out.push({k:'warm',id:x.id,t:who+' payout is overdue',d:money(x.amount,x.currency)+' was due '+dt(x.due_on)+' and is still open.',a:'Review',nav:'financelegal'});
  });
  if(sum.collectionRisk>=40&&sum.unpaid.length>=3)out.push({k:'hot',id:'risk',t:'Collection risk is elevated',d:sum.collectionRisk+'% of open invoices are overdue. Consider following up on the oldest balances first.',a:'Review',nav:'financelegal'});
  var rank={hot:0,warm:1,cool:2};
  return out.sort(function(a,b){return (rank[a.k]||9)-(rank[b.k]||9);}).slice(0,4);
}

/* ---------- loaders ---------- */
function loadFinance(force){
  if(S.loadingFin&&!force)return Promise.resolve();
  S.loadingFin=true;S.error='';draw();
  return getFin().then(function(d){S.fin=d;S.loadingFin=false;draw();}).catch(function(e){S.loadingFin=false;S.error=e&&e.message||String(e);draw();});
}
function loadLegal(force){
  if(S.loadingLegal&&!force)return Promise.resolve();
  S.loadingLegal=true;S.error='';draw();
  return getLegal().then(function(d){S.legal=d;S.loadingLegal=false;draw();}).catch(function(e){S.loadingLegal=false;S.error=e&&e.message||String(e);draw();});
}

/* ---------- shared bits ---------- */
function statusPill(s){s=String(s||'').toLowerCase();var cls=/paid|active|complete|approved|confirmed/.test(s)?'ok':/overdue|void|rejected|cancelled|failed|expired/.test(s)?'bad':/draft|pending|open/.test(s)?'warn':'mute';return '<span class="fin-pill '+cls+'">'+esc(s||'—')+'</span>';}
function seg(items,cur,onAttr){return '<div class="fin-seg" role="group">'+items.map(function(i){return '<button type="button" data-'+onAttr+'="'+esc(i[0])+'" class="'+(cur===i[0]?'on':'')+'">'+esc(i[1])+(i[2]!=null?' <i>'+i[2]+'</i>':'')+'</button>';}).join('')+'</div>';}
function kpi(label,value,sub){return '<div class="fin-kpi"><small>'+esc(label)+'</small><b>'+esc(value)+'</b><span>'+esc(sub||'')+'</span></div>';}
function empty(msg){return '<p class="fin-empty">'+esc(msg)+'</p>';}

/* ---------- Finance: Overview ---------- */
function overviewHtml(d){
  var sum=summarize(d),sig=signals(sum);
  var h='<div class="fin-kpis">'+kpi('Outstanding',money(sum.outstanding),sum.unpaid.length+' open invoice'+(sum.unpaid.length===1?'':'s'))+kpi('Overdue',money(sum.overdueTotal),sum.overdueInv.length+' invoice'+(sum.overdueInv.length===1?'':'s'))+kpi('This month',money(sum.monthlyRevenue),new Date().toLocaleDateString([],{month:'long'})+' payments')+kpi('Open payouts',sum.openPayouts.length,sum.overduePayouts.length+' overdue')+'</div>';
  h+='<section class="fin-signals"><h3><i>✦</i> Vera financial signals</h3>'+(sig.length?'<div>'+sig.map(function(s){return '<article class="'+s.k+'"><b>'+esc(s.t)+'</b><p>'+esc(s.d)+'</p><button type="button" data-fin-tab="invoices">'+esc(s.a)+' →</button></article>';}).join('')+'</div>':empty('Nothing needs attention right now. Receivables and payouts are on track.'))+'</section>';
  h+='<div class="fin-ov-actions"><button type="button" class="primary" data-fin-new-invoice>+ Create Invoice</button><button type="button" data-fin-tab="payouts">View Payouts</button><button type="button" data-fin-tab="invoices">View Invoices</button></div>';
  return h;
}

/* ---------- Finance: Invoices ---------- */
function invoicesHtml(d){
  var q=S.q.trim().toLowerCase(),st=S.statusF;
  var inv=arr(d.invoices).filter(function(x){
    if(st&&String(x.status||'').toLowerCase()!==st)return false;
    if(!q)return true;
    var txt=[x.invoice_number,(x.companies&&x.companies.name)].filter(Boolean).join(' ').toLowerCase();
    return txt.indexOf(q)>-1;
  });
  var rows=inv.map(function(x){
    var b=bal(x);
    return '<div class="fin-row"><div><b>'+esc(x.invoice_number||'Invoice')+'</b><small>'+esc((x.companies&&x.companies.name)||'—')+'</small></div>'
      +'<div><small>Issued '+dtShort(x.issue_date)+'</small><small>Due '+dtShort(x.due_date)+'</small></div>'
      +'<div><b>'+esc(money(x.total,x.currency))+'</b><small>'+esc(b>0?money(b,x.currency)+' due':'Paid in full')+'</small></div>'
      +'<div>'+statusPill(x.status)+'</div>'
      +'<div class="fin-row-acts">'+(b>0?'<button type="button" data-fin-pay="'+esc(x.id)+'">Record payment</button>':'')+'<button type="button" '+(b>0?'disabled title="Balance must reach zero first"':'')+' data-fin-complete="'+esc(x.id)+'">Complete</button></div></div>';
  }).join('');
  var statuses=[['','All'],['draft','Draft'],['sent','Sent'],['overdue','Overdue'],['void','Void'],['cancelled','Cancelled']];
  var h='<div class="fin-toolbar"><label class="fin-search"><input data-fin-q placeholder="Search invoice or client…" value="'+esc(S.q)+'"><i>⌕</i></label><select data-fin-status>'+statuses.map(function(s){return '<option value="'+s[0]+'" '+(S.statusF===s[0]?'selected':'')+'>'+s[1]+'</option>';}).join('')+'</select><button type="button" class="primary" data-fin-new-invoice>+ Create Invoice</button></div>';
  h+='<div class="fin-table"><div class="fin-row fin-head"><div>Invoice</div><div>Dates</div><div>Total</div><div>Status</div><div></div></div>'+(rows||'<div class="fin-empty-row">'+empty('No invoices match.')+'</div>')+'</div>';
  return h;
}

/* ---------- Finance: Payments ---------- */
function paymentsHtml(d){
  var q=S.q.trim().toLowerCase();
  var byId={};arr(d.invoices).forEach(function(x){byId[String(x.id)]=x;});
  var pay=arr(d.payments).filter(function(x){if(!q)return true;var inv=byId[String(x.invoice_id)];var txt=[inv&&inv.invoice_number,inv&&inv.companies&&inv.companies.name,x.processor_reference,x.bank_reference].filter(Boolean).join(' ').toLowerCase();return txt.indexOf(q)>-1;});
  pay=pay.slice().sort(function(a,b){return new Date(b.received_at||b.created_at||0)-new Date(a.received_at||a.created_at||0);});
  var rows=pay.map(function(x){var inv=byId[String(x.invoice_id)];return '<div class="fin-row"><div><b>'+esc(money(x.base_amount||x.amount,x.currency))+'</b><small>'+esc(x.payment_method||x.processor||'Client payment')+'</small></div><div><small>'+dtShort(x.received_at||x.created_at)+'</small></div><div><b>'+esc((inv&&inv.invoice_number)||'—')+'</b><small>'+esc((inv&&inv.companies&&inv.companies.name)||'')+'</small></div><div>'+statusPill(x.status||'paid')+'</div><div><small>'+esc(x.processor_reference||x.bank_reference||'—')+'</small></div></div>';}).join('');
  var h='<div class="fin-toolbar"><label class="fin-search"><input data-fin-q placeholder="Search payments…" value="'+esc(S.q)+'"><i>⌕</i></label></div>';
  h+='<div class="fin-table"><div class="fin-row fin-head"><div>Amount</div><div>Received</div><div>Invoice</div><div>Status</div><div>Reference</div></div>'+(rows||'<div class="fin-empty-row">'+empty('No payments recorded yet.')+'</div>')+'</div>';
  return h;
}

/* ---------- Finance: Payouts ---------- */
function payoutsHtml(d){
  var q=S.q.trim().toLowerCase();
  var po=arr(d.payouts).filter(function(x){if(!q)return true;var who=(x.models&&x.models.display_name)||(x.partner_agencies&&x.partner_agencies.name)||'';return who.toLowerCase().indexOf(q)>-1;});
  var rows=po.map(function(x){var who=(x.models&&x.models.display_name)||(x.partner_agencies&&x.partner_agencies.name)||'Payout';var kind=x.model_id?'Model':x.partner_agency_id?'Mother agency':'—';return '<div class="fin-row"><div><b>'+esc(who)+'</b><small>'+esc(kind)+'</small></div><div><b>'+esc(money(x.amount,x.currency))+'</b></div><div><small>Due '+dtShort(x.due_on)+'</small></div><div>'+statusPill(x.status)+'</div><div></div></div>';}).join('');
  var h='<div class="fin-toolbar"><label class="fin-search"><input data-fin-q placeholder="Search model or agency…" value="'+esc(S.q)+'"><i>⌕</i></label></div>';
  h+='<div class="fin-note">Payout status is managed elsewhere. For per-model budgets, advances and statements, open <button type="button" class="link" data-fin-nav="modelaccounts">Model Accounts →</button></div>';
  h+='<div class="fin-table"><div class="fin-row fin-head"><div>Payee</div><div>Amount</div><div>Due</div><div>Status</div><div></div></div>'+(rows||'<div class="fin-empty-row">'+empty('No payout records.')+'</div>')+'</div>';
  return h;
}

/* ---------- Finance: Reconciliation ---------- */
function reconHtml(d){
  var per=arr(d.accounting_periods),sess=arr(d.reconciliation_sessions);
  var h='<h4 class="fin-subhead">Accounting periods</h4><div class="fin-table"><div class="fin-row fin-head"><div>Period</div><div>Ends</div><div>Status</div><div></div><div></div></div>'+(per.length?per.map(function(x){return '<div class="fin-row"><div><b>'+esc(x.name||'Period')+'</b></div><div><small>'+dtShort(x.ends_on)+'</small></div><div>'+statusPill(x.status)+'</div><div></div><div></div></div>';}).join(''):'<div class="fin-empty-row">'+empty('No accounting periods yet.')+'</div>')+'</div>';
  h+='<h4 class="fin-subhead">Reconciliation sessions</h4><div class="fin-table"><div class="fin-row fin-head"><div>Session</div><div>Period</div><div>Status</div><div></div><div></div></div>'+(sess.length?sess.map(function(x){return '<div class="fin-row"><div><b>'+esc(x.name||'Session')+'</b></div><div><small>'+dtShort(x.period_start)+' → '+dtShort(x.period_end)+'</small></div><div>'+statusPill(x.status)+'</div><div></div><div></div></div>';}).join(''):'<div class="fin-empty-row">'+empty('No reconciliation sessions yet.')+'</div>')+'</div>';
  return h;
}

/* ---------- Legal: Contracts / Usage Rights / Signatures ---------- */
function partyLabel(x){return (x.models&&x.models.display_name)||(x.companies&&x.companies.name)||(x.partner_agencies&&x.partner_agencies.name)||'—';}
function contractsHtml(d){
  var q=S.q.trim().toLowerCase();
  var xs=arr(d.contracts).filter(function(x){if(!q)return true;var txt=[x.title,partyLabel(x)].filter(Boolean).join(' ').toLowerCase();return txt.indexOf(q)>-1;});
  var rows=xs.map(function(x){return '<div class="fin-row"><div><b>'+esc(x.title||'Contract')+'</b><small>'+esc(x.contract_type||'')+'</small></div><div><small>'+esc(partyLabel(x))+'</small></div><div><small>'+dtShort(x.effective_on)+' → '+dtShort(x.expires_on)+'</small></div><div>'+statusPill(x.status)+'</div><div class="fin-row-acts"><button type="button" data-fin-edit-contract="'+esc(x.id)+'">Edit</button><button type="button" data-fin-sign="'+esc(x.id)+'">Send for sign</button></div></div>';}).join('');
  var h='<div class="fin-toolbar"><label class="fin-search"><input data-fin-q placeholder="Search contracts…" value="'+esc(S.q)+'"><i>⌕</i></label><button type="button" class="primary" data-fin-new-contract>+ New Contract</button></div>';
  h+='<div class="fin-table"><div class="fin-row fin-head"><div>Contract</div><div>Party</div><div>Dates</div><div>Status</div><div></div></div>'+(rows||'<div class="fin-empty-row">'+empty('No contracts yet.')+'</div>')+'</div>';
  return h;
}
function usageHtml(d){
  var q=S.q.trim().toLowerCase();
  var xs=arr(d.usage_rights).filter(function(x){if(!q)return true;var txt=[x.campaign_name,partyLabel(x)].filter(Boolean).join(' ').toLowerCase();return txt.indexOf(q)>-1;});
  var rows=xs.map(function(x){return '<div class="fin-row"><div><b>'+esc(x.campaign_name||'Usage right')+'</b><small>'+esc(partyLabel(x))+'</small></div><div><small>'+dtShort(x.starts_on)+' → '+dtShort(x.ends_on)+'</small></div><div><b>'+esc(x.fee_amount?money(x.fee_amount,x.currency):'—')+'</b></div><div>'+statusPill(x.status)+'</div><div></div></div>';}).join('');
  var h='<div class="fin-toolbar"><label class="fin-search"><input data-fin-q placeholder="Search usage rights…" value="'+esc(S.q)+'"><i>⌕</i></label><button type="button" class="primary" data-fin-new-usage>+ New Usage Right</button></div>';
  h+='<div class="fin-table"><div class="fin-row fin-head"><div>Campaign</div><div>Dates</div><div>Fee</div><div>Status</div><div></div></div>'+(rows||'<div class="fin-empty-row">'+empty('No usage rights yet.')+'</div>')+'</div>';
  return h;
}
function signaturesHtml(d){
  var xs=arr(d.signature_requests);
  var rows=xs.map(function(x){var signers=arr(x.signature_signers);return '<div class="fin-row"><div><b>'+esc(x.provider||'Signature request')+'</b><small>'+signers.length+' signer'+(signers.length===1?'':'s')+'</small></div><div><small>Created '+dtShort(x.created_at)+'</small></div><div><small>Expires '+dtShort(x.expires_at)+'</small></div><div>'+statusPill(x.status)+'</div><div></div></div>';}).join('');
  return '<div class="fin-table"><div class="fin-row fin-head"><div>Request</div><div>Created</div><div>Expires</div><div>Status</div><div></div></div>'+(rows||'<div class="fin-empty-row">'+empty('No signature requests yet. Send one from a contract.')+'</div>')+'</div>';
}

/* ---------- shell ---------- */
function financeBody(d){
  if(S.finTab==='overview')return overviewHtml(d);
  if(S.finTab==='invoices')return invoicesHtml(d);
  if(S.finTab==='payments')return paymentsHtml(d);
  if(S.finTab==='payouts')return payoutsHtml(d);
  return reconHtml(d);
}
function legalBody(d){
  if(S.legalTab==='usage')return usageHtml(d);
  if(S.legalTab==='sign')return signaturesHtml(d);
  return contractsHtml(d);
}
function draw(){
  var el=S.root;if(!el)return;
  var h='<div class="mdv-fin"><header class="fin-head"><div><small>Model tools · business control</small><h1>Finance <em>&amp; Legal</em></h1></div>'+seg([['finance','Finance'],['legal','Legal']],S.side,'fin-side')+'</header>';
  if(S.error){h+='<div class="fin-error">'+esc(S.error)+'</div>';}
  if(S.side==='finance'){
    if(!S.fin){h+='<p class="fin-empty">'+(S.loadingFin?'Loading finance…':'—')+'</p>';}
    else{
      h+=seg([['overview','Overview'],['invoices','Invoices',arr(S.fin.invoices).length],['payments','Payments',arr(S.fin.payments).length],['payouts','Payouts',arr(S.fin.payouts).length],['recon','Reconciliation']],S.finTab,'fin-tab');
      h+='<div class="fin-body">'+financeBody(S.fin)+'</div>';
    }
  }else{
    if(!S.legal){h+='<p class="fin-empty">'+(S.loadingLegal?'Loading legal…':'—')+'</p>';}
    else{
      h+=seg([['contracts','Contracts',arr(S.legal.contracts).length],['usage','Usage Rights',arr(S.legal.usage_rights).length],['sign','Signatures',arr(S.legal.signature_requests).length]],S.legalTab,'fin-legal-tab');
      h+='<div class="fin-body">'+legalBody(S.legal)+'</div>';
    }
  }
  h+='</div>';
  el.innerHTML=h;
  focusSearch(el);
}
function focusSearch(el){
  var q=el.querySelector('[data-fin-q]');
  if(q){q.oninput=function(){S.q=this.value;draw();var f=el.querySelector('[data-fin-q]');if(f){f.focus();f.selectionStart=f.selectionEnd=f.value.length;}};}
  var st=el.querySelector('[data-fin-status]');
  if(st)st.onchange=function(){S.statusF=this.value;draw();};
}

/* ---------- Create Invoice modal ---------- */
function invoiceModalHtml(){
  return '<div class="fin-modal-back" data-fin-modal-close><section class="fin-modal" role="dialog" aria-modal="true" aria-label="Create invoice"><header><div><small>New invoice</small><h2>Create Invoice from Booking</h2></div><button type="button" data-fin-modal-close aria-label="Close">×</button></header>'
   +'<div class="fin-modal-body">'
   +'<label><span>Booking</span><input id="fin-inv-bq" placeholder="Search by model, client or date…" autocomplete="off"><div id="fin-inv-bresults" class="fin-picker-results"></div><input type="hidden" id="fin-inv-booking"></label>'
   +'<div id="fin-inv-selected" class="fin-picker-selected" hidden></div>'
   +'<label><span>Due date</span><input type="date" id="fin-inv-due"></label>'
   +'<label><span>Notes (optional)</span><textarea id="fin-inv-notes" rows="3"></textarea></label>'
   +'<div class="fin-modal-err" id="fin-inv-err"></div></div>'
   +'<footer><button type="button" class="ghost" data-fin-modal-close>Cancel</button><button type="button" class="primary" id="fin-inv-submit">Create Invoice</button></footer></section></div>';
}
function openInvoiceModal(){
  closeModal();S.bookings=null;
  var host=document.createElement('div');host.id='fin-modal-host';host.innerHTML=invoiceModalHtml();document.body.appendChild(host);
  wireModalClose(host);
  var due=host.querySelector('#fin-inv-due');var d=new Date();d.setDate(d.getDate()+30);due.value=d.toISOString().slice(0,10);
  var bq=host.querySelector('#fin-inv-bq'),results=host.querySelector('#fin-inv-bresults'),hidden=host.querySelector('#fin-inv-booking'),selected=host.querySelector('#fin-inv-selected');
  function renderResults(){
    var list=arr(S.bookings).filter(function(b){return !arr(b.invoices).length;});
    var q=bq.value.trim().toLowerCase();
    if(q){list=list.filter(function(b){var models=arr(b.booking_models).map(function(m){return m.models&&m.models.display_name;}).filter(Boolean).join(' ');var txt=[models,b.companies&&b.companies.name,b.starts_at].filter(Boolean).join(' ').toLowerCase();return txt.indexOf(q)>-1;});}
    list=list.slice(0,25);
    results.innerHTML=list.length?list.map(function(b){var models=arr(b.booking_models).map(function(m){return m.models&&m.models.display_name;}).filter(Boolean).join(', ')||'Booking';return '<button type="button" class="fin-picker-row" data-bid="'+esc(b.id)+'"><b>'+esc(models)+'</b><small>'+esc((b.companies&&b.companies.name)||'—')+' · '+dtShort(b.starts_at)+'</small></button>';}).join(''):'<p class="fin-picker-empty">'+(S.bookingsLoading?'Loading bookings…':'No un-invoiced bookings match.')+'</p>';
    results.querySelectorAll('[data-bid]').forEach(function(btn){btn.onclick=function(){var b=arr(S.bookings).find(function(x){return String(x.id)===btn.dataset.bid;});if(!b)return;hidden.value=b.id;var models=arr(b.booking_models).map(function(m){return m.models&&m.models.display_name;}).filter(Boolean).join(', ')||'Booking';selected.hidden=false;selected.innerHTML='<b>'+esc(models)+'</b><small>'+esc((b.companies&&b.companies.name)||'—')+' · '+dtShort(b.starts_at)+'</small><button type="button" data-fin-clear-booking>Change</button>';results.innerHTML='';bq.value='';};});
  }
  selected.parentElement.addEventListener('click',function(e){if(e.target.closest('[data-fin-clear-booking]')){hidden.value='';selected.hidden=true;renderResults();}});
  bq.oninput=renderResults;
  if(!S.bookings&&!S.bookingsLoading){
    S.bookingsLoading=true;results.innerHTML='<p class="fin-picker-empty">Loading bookings…</p>';
    getBookings().then(function(d2){S.bookings=arr(d2.bookings);S.bookingsLoading=false;renderResults();}).catch(function(e){S.bookingsLoading=false;results.innerHTML='<p class="fin-picker-empty">Could not load bookings: '+esc(e&&e.message||e)+'</p>';});
  }else renderResults();
  host.querySelector('#fin-inv-submit').onclick=function(){
    var err=host.querySelector('#fin-inv-err'),btn=this;
    if(!hidden.value){err.textContent='Select a booking first.';return;}
    err.textContent='';btn.disabled=true;btn.textContent='Creating…';
    postFin({action:'create_invoice_from_booking',booking_id:hidden.value,due_date:due.value||null,notes:host.querySelector('#fin-inv-notes').value.trim()||null}).then(function(){toast('Invoice created.');closeModal();S.bookings=null;loadFinance(true);}).catch(function(e){btn.disabled=false;btn.textContent='Create Invoice';err.textContent=(e&&e.message)||'Could not create invoice.';});
  };
  bq.focus();
}

/* ---------- Record Payment modal ---------- */
function paymentModalHtml(inv){
  var b=bal(inv);
  return '<div class="fin-modal-back" data-fin-modal-close><section class="fin-modal" role="dialog" aria-modal="true" aria-label="Record payment"><header><div><small>Record payment · '+esc(inv.invoice_number||'Invoice')+'</small><h2>'+esc((inv.companies&&inv.companies.name)||'Client')+'</h2></div><button type="button" data-fin-modal-close aria-label="Close">×</button></header>'
   +'<div class="fin-modal-body">'
   +'<label><span>Amount</span><input type="number" step="0.01" min="0.01" id="fin-pay-amount" value="'+esc(b.toFixed(2))+'"></label>'
   +'<label><span>Method</span><select id="fin-pay-method"><option value="">—</option><option value="wire">Wire transfer</option><option value="card">Card</option><option value="ach">ACH</option><option value="check">Check</option><option value="cash">Cash</option><option value="other">Other</option></select></label>'
   +'<label><span>Reference (optional)</span><input id="fin-pay-ref" placeholder="Processor or bank reference"></label>'
   +'<label><span>Received on</span><input type="date" id="fin-pay-date" value="'+new Date().toISOString().slice(0,10)+'"></label>'
   +'<label><span>Notes (optional)</span><textarea id="fin-pay-notes" rows="2"></textarea></label>'
   +'<div class="fin-modal-err" id="fin-pay-err"></div></div>'
   +'<footer><button type="button" class="ghost" data-fin-modal-close>Cancel</button><button type="button" class="primary" id="fin-pay-submit">Record Payment</button></footer></section></div>';
}
function openPaymentModal(id){
  var inv=arr(S.fin&&S.fin.invoices).find(function(x){return String(x.id)===String(id);});if(!inv)return;
  closeModal();
  var host=document.createElement('div');host.id='fin-modal-host';host.innerHTML=paymentModalHtml(inv);document.body.appendChild(host);
  wireModalClose(host);
  host.querySelector('#fin-pay-submit').onclick=function(){
    var err=host.querySelector('#fin-pay-err'),btn=this,amount=Number(host.querySelector('#fin-pay-amount').value);
    if(!(amount>0)){err.textContent='Enter a positive amount.';return;}
    err.textContent='';btn.disabled=true;btn.textContent='Recording…';
    postFin({action:'record_client_payment',invoice_id:inv.id,amount:amount,currency:inv.currency||'USD',payment_method:host.querySelector('#fin-pay-method').value||null,processor_reference:host.querySelector('#fin-pay-ref').value.trim()||null,received_at:host.querySelector('#fin-pay-date').value||null,notes:host.querySelector('#fin-pay-notes').value.trim()||null}).then(function(){toast('Payment recorded.');closeModal();loadFinance(true);}).catch(function(e){btn.disabled=false;btn.textContent='Record Payment';err.textContent=(e&&e.message)||'Could not record payment.';});
  };
  host.querySelector('#fin-pay-amount').focus();
}

/* ---------- New/Edit Contract modal ---------- */
function contractModalHtml(c){
  c=c||{};
  var models=arr(S.legal&&S.legal.models),companies=arr(S.legal&&S.legal.companies);
  var types=['representation','client_agreement','exclusivity','usage','other'];
  return '<div class="fin-modal-back" data-fin-modal-close><section class="fin-modal" role="dialog" aria-modal="true" aria-label="Contract"><header><div><small>'+(c.id?'Edit contract':'New contract')+'</small><h2>'+esc(c.title||'Contract')+'</h2></div><button type="button" data-fin-modal-close aria-label="Close">×</button></header>'
   +'<div class="fin-modal-body">'
   +'<label><span>Title</span><input id="fin-ct-title" value="'+esc(c.title||'')+'"></label>'
   +'<label><span>Type</span><select id="fin-ct-type">'+types.map(function(t){return '<option value="'+t+'" '+(c.contract_type===t?'selected':'')+'>'+t.replace(/_/g,' ')+'</option>';}).join('')+'</select></label>'
   +'<label><span>Status</span><select id="fin-ct-status"><option value="draft" '+(c.status==='draft'?'selected':'')+'>Draft</option><option value="active" '+(c.status==='active'?'selected':'')+'>Active</option><option value="expired" '+(c.status==='expired'?'selected':'')+'>Expired</option><option value="terminated" '+(c.status==='terminated'?'selected':'')+'>Terminated</option></select></label>'
   +'<label><span>Model</span><select id="fin-ct-model"><option value="">—</option>'+models.map(function(m){return '<option value="'+esc(m.id)+'" '+(c.model_id===m.id?'selected':'')+'>'+esc(m.display_name)+'</option>';}).join('')+'</select></label>'
   +'<label><span>Company / client</span><select id="fin-ct-company"><option value="">—</option>'+companies.map(function(x){return '<option value="'+esc(x.id)+'" '+(c.company_id===x.id?'selected':'')+'>'+esc(x.name)+'</option>';}).join('')+'</select></label>'
   +'<label><span>Effective on</span><input type="date" id="fin-ct-eff" value="'+esc((c.effective_on||'').slice(0,10))+'"></label>'
   +'<label><span>Expires on</span><input type="date" id="fin-ct-exp" value="'+esc((c.expires_on||'').slice(0,10))+'"></label>'
   +'<label><span>Internal notes (optional)</span><textarea id="fin-ct-notes" rows="3">'+esc(c.internal_notes||'')+'</textarea></label>'
   +'<div class="fin-modal-err" id="fin-ct-err"></div></div>'
   +'<footer><button type="button" class="ghost" data-fin-modal-close>Cancel</button><button type="button" class="primary" id="fin-ct-submit">'+(c.id?'Save Contract':'Create Contract')+'</button></footer></section></div>';
}
function openContractModal(id){
  var c=id?arr(S.legal&&S.legal.contracts).find(function(x){return String(x.id)===String(id);}):null;
  closeModal();
  var host=document.createElement('div');host.id='fin-modal-host';host.innerHTML=contractModalHtml(c);document.body.appendChild(host);
  wireModalClose(host);
  host.querySelector('#fin-ct-submit').onclick=function(){
    var err=host.querySelector('#fin-ct-err'),btn=this;
    var title=host.querySelector('#fin-ct-title').value.trim();
    if(!title){err.textContent='Title is required.';return;}
    err.textContent='';btn.disabled=true;btn.textContent='Saving…';
    postLegal({action:'upsert_contract',contract_id:(c&&c.id)||null,contract:{title:title,contract_type:host.querySelector('#fin-ct-type').value,status:host.querySelector('#fin-ct-status').value,model_id:host.querySelector('#fin-ct-model').value||null,company_id:host.querySelector('#fin-ct-company').value||null,effective_on:host.querySelector('#fin-ct-eff').value||null,expires_on:host.querySelector('#fin-ct-exp').value||null,internal_notes:host.querySelector('#fin-ct-notes').value.trim()||null}}).then(function(){toast(c&&c.id?'Contract updated.':'Contract created.');closeModal();loadLegal(true);}).catch(function(e){btn.disabled=false;btn.textContent=c&&c.id?'Save Contract':'Create Contract';err.textContent=(e&&e.message)||'Could not save contract.';});
  };
}

/* ---------- New Usage Right modal ---------- */
function usageModalHtml(){
  var models=arr(S.legal&&S.legal.models),companies=arr(S.legal&&S.legal.companies);
  return '<div class="fin-modal-back" data-fin-modal-close><section class="fin-modal" role="dialog" aria-modal="true" aria-label="Usage right"><header><div><small>New usage right</small><h2>Campaign Usage</h2></div><button type="button" data-fin-modal-close aria-label="Close">×</button></header>'
   +'<div class="fin-modal-body">'
   +'<label><span>Campaign name</span><input id="fin-ur-campaign"></label>'
   +'<label><span>Model</span><select id="fin-ur-model"><option value="">—</option>'+models.map(function(m){return '<option value="'+esc(m.id)+'">'+esc(m.display_name)+'</option>';}).join('')+'</select></label>'
   +'<label><span>Company / client</span><select id="fin-ur-company"><option value="">—</option>'+companies.map(function(x){return '<option value="'+esc(x.id)+'">'+esc(x.name)+'</option>';}).join('')+'</select></label>'
   +'<label><span>Starts on</span><input type="date" id="fin-ur-start"></label>'
   +'<label><span>Ends on</span><input type="date" id="fin-ur-end"></label>'
   +'<label><span>Fee amount (optional)</span><input type="number" step="0.01" id="fin-ur-fee"></label>'
   +'<label><span>Status</span><select id="fin-ur-status"><option value="active">Active</option><option value="pending">Pending</option><option value="expired">Expired</option></select></label>'
   +'<div class="fin-modal-err" id="fin-ur-err"></div></div>'
   +'<footer><button type="button" class="ghost" data-fin-modal-close>Cancel</button><button type="button" class="primary" id="fin-ur-submit">Create Usage Right</button></footer></section></div>';
}
function openUsageModal(){
  closeModal();
  var host=document.createElement('div');host.id='fin-modal-host';host.innerHTML=usageModalHtml();document.body.appendChild(host);
  wireModalClose(host);
  host.querySelector('#fin-ur-submit').onclick=function(){
    var err=host.querySelector('#fin-ur-err'),btn=this,modelId=host.querySelector('#fin-ur-model').value;
    if(!modelId){err.textContent='Select a model.';return;}
    err.textContent='';btn.disabled=true;btn.textContent='Creating…';
    postLegal({action:'upsert_usage_right',usage:{model_id:modelId,company_id:host.querySelector('#fin-ur-company').value||null,campaign_name:host.querySelector('#fin-ur-campaign').value.trim()||null,starts_on:host.querySelector('#fin-ur-start').value||null,ends_on:host.querySelector('#fin-ur-end').value||null,fee_amount:host.querySelector('#fin-ur-fee').value||null,status:host.querySelector('#fin-ur-status').value}}).then(function(){toast('Usage right created.');closeModal();loadLegal(true);}).catch(function(e){btn.disabled=false;btn.textContent='Create Usage Right';err.textContent=(e&&e.message)||'Could not create usage right.';});
  };
}

/* ---------- shared modal plumbing ---------- */
function wireModalClose(host){
  host.querySelectorAll('[data-fin-modal-close]').forEach(function(b){b.onclick=function(e){if(e.target===b||b.hasAttribute('data-fin-modal-close'))closeModal();};});
  var back=host.querySelector('.fin-modal-back');
  if(back)back.onclick=function(e){if(e.target===this)closeModal();};
}
function closeModal(){var h=document.getElementById('fin-modal-host');if(h)h.remove();}

/* ---------- click delegation ---------- */
function onClick(e){
  var b;
  if((b=e.target.closest('[data-fin-side]'))){S.side=b.dataset.finSide;S.q='';S.statusF='';draw();if(S.side==='legal'&&!S.legal)loadLegal();return;}
  if((b=e.target.closest('[data-fin-tab]'))){S.finTab=b.dataset.finTab;S.q='';draw();return;}
  if((b=e.target.closest('[data-fin-legal-tab]'))){S.legalTab=b.dataset.finLegalTab;S.q='';draw();return;}
  if((b=e.target.closest('[data-fin-nav]'))){if(window.navTo)navTo(b.dataset.finNav);return;}
  if(e.target.closest('[data-fin-new-invoice]')){openInvoiceModal();return;}
  if((b=e.target.closest('[data-fin-pay]'))){openPaymentModal(b.dataset.finPay);return;}
  if((b=e.target.closest('[data-fin-complete]'))){if(b.disabled)return;completeInvoice(b.dataset.finComplete,b);return;}
  if(e.target.closest('[data-fin-new-contract]')){openContractModal(null);return;}
  if((b=e.target.closest('[data-fin-edit-contract]'))){openContractModal(b.dataset.finEditContract);return;}
  if((b=e.target.closest('[data-fin-sign]'))){sendForSign(b.dataset.finSign,b);return;}
  if(e.target.closest('[data-fin-new-usage]')){openUsageModal();return;}
}
function completeInvoice(id,btn){
  btn.disabled=true;var old=btn.textContent;btn.textContent='…';
  postFin({action:'complete_invoice',invoice_id:id}).then(function(){toast('Invoice completed.');loadFinance(true);}).catch(function(e){btn.disabled=false;btn.textContent=old;toast((e&&e.message)||'Could not complete invoice.','risk');});
}
function sendForSign(id,btn){
  btn.disabled=true;var old=btn.textContent;btn.textContent='Sending…';
  postLegal({action:'create_signature_request',contract_id:id,provider:'veux_sign'}).then(function(){toast('Signature request sent.');loadLegal(true);}).catch(function(e){btn.disabled=false;btn.textContent=old;toast((e&&e.message)||'Could not send for signature.','risk');});
}

/* ---------- entry point ---------- */
function render(el){
  if(!el)return Promise.resolve();
  if(S.root!==el){S.root=el;el.addEventListener('click',onClick);}
  draw();
  return loadFinance(true);
}
try{Object.defineProperty(window,'renderFinanceLegal',{configurable:true,enumerable:true,get:function(){return render;},set:function(){}});}catch(e){window.renderFinanceLegal=render;}
window.MDV_FIN={render:render,reload:function(){return loadFinance(true);}};
})();
