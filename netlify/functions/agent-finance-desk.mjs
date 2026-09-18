import { requireUser, parseBody, json, errorResponse } from './_lib/auth.mjs';
import { requireStaffOrganization, requirePermission } from './_lib/agent-bridge.mjs';
import { enforceRateLimit, withIdempotency } from './_lib/reliability.mjs';

async function rows(q){const {data,error}=await q;if(error)throw error;return data||[];}
function invoiceNumber(prefix='INV'){return `${prefix}-${new Date().toISOString().slice(0,10).replaceAll('-','')}-${crypto.randomUUID().slice(0,6).toUpperCase()}`;}
function byId(rows){return new Map((rows||[]).map(x=>[String(x.id),x]));}
function computeDashboard(invoices,payments,payouts){
  const n=v=>Number(v||0);
  const invoiced=invoices.reduce((s,x)=>s+n(x.total),0), outstanding=invoices.reduce((s,x)=>s+n(x.amount_due),0), paid=invoices.reduce((s,x)=>s+n(x.amount_paid),0);
  const overdue=invoices.filter(x=>String(x.status)==='overdue').reduce((s,x)=>s+n(x.amount_due),0);
  const modelPayable=payouts.filter(x=>x.model_id&&!['paid','failed','cancelled'].includes(String(x.status||''))).reduce((s,x)=>s+n(x.amount),0);
  const maPayable=payouts.filter(x=>x.partner_agency_id&&!['paid','failed','cancelled'].includes(String(x.status||''))).reduce((s,x)=>s+n(x.amount),0);
  return {
    invoice_count:invoices.length,invoiced_total:invoiced,outstanding_total:outstanding,paid_invoice_total:paid,
    payments_total:payments.filter(x=>String(x.status)!=='failed').reduce((s,x)=>s+n(x.base_amount||x.amount),0),
    payouts_total:payouts.filter(x=>!['failed','cancelled'].includes(String(x.status||''))).reduce((s,x)=>s+n(x.amount),0),
    receivables:{open:outstanding,overdue},payables:{model:modelPayable,mother_agency:maPayable},fallback:true
  };
}

export const handler=async(event)=>{
  if(!['GET','POST'].includes(event.httpMethod))return json(405,{error:'Method not allowed'});
  try{
    const {user,client}=await requireUser(event);
    const body=event.httpMethod==='POST'?parseBody(event):{};
    const slug=body.organization_slug||event.queryStringParameters?.organization||'maison-de-veux';
    const {organization}=await requireStaffOrganization({user,client,organizationSlug:slug});
    const admin=await requirePermission(user.id,organization.id,'finance.read');

    if(event.httpMethod==='GET'){
      // Do not use embedded PostgREST relationships here. The schema intentionally has both
      // direct and same-org FKs, which can make embedded relationship discovery ambiguous.
      const [invoices,payments,payouts,recon,periods,models,partnerAgencies,companies]=await Promise.all([
        rows(admin.from('invoices').select('*').eq('organization_id',organization.id).order('issue_date',{ascending:false}).limit(250)),
        rows(admin.from('payments').select('*').eq('organization_id',organization.id).order('created_at',{ascending:false}).limit(250)),
        rows(admin.from('payouts').select('*').eq('organization_id',organization.id).order('created_at',{ascending:false}).limit(250)),
        rows(admin.from('reconciliation_sessions').select('*').eq('organization_id',organization.id).order('period_end',{ascending:false}).limit(50)),
        rows(admin.from('accounting_periods').select('*').eq('organization_id',organization.id).order('ends_on',{ascending:false}).limit(50)),
        rows(admin.from('models').select('id,display_name').eq('organization_id',organization.id)),
        rows(admin.from('partner_agencies').select('id,company_id,partner_type').eq('organization_id',organization.id)),
        rows(admin.from('companies').select('id,name').eq('organization_id',organization.id))
      ]);
      const modelMap=byId(models),companyMap=byId(companies),partnerMap=byId(partnerAgencies);
      const hydratedInvoices=invoices.map(x=>({...x,companies:x.company_id?companyMap.get(String(x.company_id))||null:null}));
      const hydratedPayouts=payouts.map(x=>{
        const partner=x.partner_agency_id?partnerMap.get(String(x.partner_agency_id)):null;
        return {...x,models:x.model_id?modelMap.get(String(x.model_id))||null:null,partner_agencies:partner?{...partner,name:companyMap.get(String(partner.company_id))?.name||'Partner Agency'}:null,companies:x.company_id?companyMap.get(String(x.company_id))||null:null};
      });
      let dashboard=null,rpc_warning=null;
      const rpc=await client.rpc('finance_dashboard',{target_org:organization.id});
      if(rpc.error){rpc_warning=rpc.error.message;dashboard=computeDashboard(hydratedInvoices,payments,hydratedPayouts);}else dashboard=rpc.data;
      return json(200,{environment:'veux-saas-v13.23-finance-resilient',organization,dashboard,invoices:hydratedInvoices,payments,payouts:hydratedPayouts,reconciliation_sessions:recon,accounting_periods:periods,warnings:rpc_warning?[`finance_dashboard RPC fallback: ${rpc_warning}`]:[]});
    }

    await requirePermission(user.id,organization.id,'finance.write');
    const action=String(body.action||'');
    await enforceRateLimit(admin,{bucket:`finance:${action||'unknown'}`,subject:user.id,maxRequests:40,windowSeconds:60});
    if(action==='create_invoice_from_booking'){
      return withIdempotency(admin,{event,body,organizationId:organization.id,userId:user.id,operation:'finance.create_invoice_from_booking',execute:async()=>{
        const bookingId=String(body.booking_id||'');if(!bookingId){const e=new Error('booking_id is required');e.statusCode=400;throw e;}
        const settings=(await admin.from('finance_settings').select('invoice_prefix,default_payment_terms_days').eq('organization_id',organization.id).maybeSingle()).data||{};
        const due=new Date();due.setUTCDate(due.getUTCDate()+Number(settings.default_payment_terms_days||30));
        const number=body.invoice_number||invoiceNumber(settings.invoice_prefix||'INV');
        const {data:invoiceId,error}=await client.rpc('create_booking_invoice',{target_org:organization.id,target_booking:bookingId,target_invoice_number:number,target_due_date:body.due_date||due.toISOString().slice(0,10),target_notes:body.notes||null});if(error)throw error;
        const {data:invoice,error:readError}=await admin.from('invoices').select('*').eq('organization_id',organization.id).eq('id',invoiceId).single();if(readError)throw readError;
        const items=await rows(admin.from('invoice_items').select('*').eq('organization_id',organization.id).eq('invoice_id',invoiceId).order('sort_order'));
        return json(201,{ok:true,verified:true,invoice:{...invoice,invoice_items:items},persisted_at:invoice?.updated_at||invoice?.created_at||new Date().toISOString()});
      }});
    }
    if(action==='record_client_payment'){
      await requirePermission(user.id,organization.id,'finance.payments');
      return withIdempotency(admin,{event,body,organizationId:organization.id,userId:user.id,operation:'finance.record_client_payment',execute:async()=>{
        const amount=Number(body.amount);if(!body.invoice_id||!(amount>0)){const e=new Error('invoice_id and positive amount are required');e.statusCode=400;throw e;}
        const {data:result,error}=await client.rpc('record_client_payment_atomic',{target_org:organization.id,target_invoice:body.invoice_id,target_amount:amount,target_currency:body.currency||null,target_exchange_rate:Number(body.exchange_rate||1),target_method:body.payment_method||null,target_processor:body.processor||null,target_processor_reference:body.processor_reference||null,target_bank_reference:body.bank_reference||null,target_received_at:body.received_at||new Date().toISOString(),target_notes:body.notes||null});if(error)throw error;
        return json(201,{ok:true,verified:true,...result,persisted_at:result?.persisted_at||new Date().toISOString()});
      }});
    }
    if(action==='update_invoice'){
      const invoiceId=String(body.invoice_id||'');if(!invoiceId){const e=new Error('invoice_id is required');e.statusCode=400;throw e;}
      const allowed={};
      if(body.invoice_number!==undefined)allowed.invoice_number=String(body.invoice_number||'').trim();
      if(body.issue_date!==undefined)allowed.issue_date=body.issue_date||null;
      if(body.due_date!==undefined)allowed.due_date=body.due_date||null;
      if(body.notes!==undefined)allowed.notes=body.notes==null?null:String(body.notes);
      if(body.status!==undefined){const st=String(body.status||'').trim().toLowerCase();const safe=new Set(['draft','sent','overdue','void','cancelled']);if(!safe.has(st)){const e=new Error('Unsupported invoice status');e.statusCode=400;throw e;}allowed.status=st;}
      if(!Object.keys(allowed).length){const e=new Error('No supported invoice fields supplied');e.statusCode=400;throw e;}
      allowed.updated_at=new Date().toISOString();
      const {data:invoice,error}=await admin.from('invoices').update(allowed).eq('organization_id',organization.id).eq('id',invoiceId).select('*').single();if(error)throw error;
      return json(200,{ok:true,verified:true,invoice,persisted_at:invoice.updated_at||new Date().toISOString()});
    }
    if(action==='complete_invoice'){
      const invoiceId=String(body.invoice_id||'');if(!invoiceId){const e=new Error('invoice_id is required');e.statusCode=400;throw e;}
      const {data:current,error:readError}=await admin.from('invoices').select('*').eq('organization_id',organization.id).eq('id',invoiceId).single();if(readError)throw readError;
      if(Number(current.amount_due||0)>0){const e=new Error('Invoice must be fully paid before it can be completed.');e.statusCode=409;throw e;}
      const patch={status:'paid',updated_at:new Date().toISOString()};
      const {data:invoice,error}=await admin.from('invoices').update(patch).eq('organization_id',organization.id).eq('id',invoiceId).select('*').single();if(error)throw error;
      if(current.booking_id){const {error:bookingError}=await admin.from('bookings').update({status:'closed',updated_at:new Date().toISOString()}).eq('organization_id',organization.id).eq('id',current.booking_id);if(bookingError)throw bookingError;}
      return json(200,{ok:true,verified:true,invoice,persisted_at:invoice.updated_at||new Date().toISOString()});
    }
    return json(400,{error:'Unsupported finance action'});
  }catch(error){return errorResponse(error);}
};
