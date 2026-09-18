import { requireUser, parseBody, json, errorResponse } from './_lib/auth.mjs';
import { requireStaffOrganization, requirePermission } from './_lib/agent-bridge.mjs';
import { enforceRateLimit, withIdempotency } from './_lib/reliability.mjs';

async function rows(q){const {data,error}=await q;if(error)throw error;return data||[];}
async function one(q){const {data,error}=await q.maybeSingle();if(error)throw error;return data||null;}
function validation(message){const e=new Error(message);e.statusCode=400;return e;}
function currency(v){const x=String(v||'USD').trim().toUpperCase();if(!/^[A-Z]{3}$/.test(x))throw validation('Currency must be a 3-letter ISO code.');return x;}
function money(v,label='Amount'){const n=Number(v);if(!Number.isFinite(n)||n<0)throw validation(`${label} must be zero or greater.`);return n;}
function classify(v){const x=String(v||'pending');if(!['recoupable_advance','agency_non_recoupable','client_reimbursable','pending'].includes(x))throw validation('Invalid account classification.');return x;}
function modelName(map,id){return map.get(String(id))?.display_name||'Model';}
function currentBudgets(budgets){const map=new Map();for(const b of budgets){if(['cancelled','closed','superseded'].includes(String(b.status)))continue;const k=String(b.series_id||b.id),old=map.get(k);if(!old||Number(b.version||0)>Number(old.version||0))map.set(k,b);}return [...map.values()];}
function summaries(models,budgets,expenses,ledger){
  const out={};
  for(const m of models)out[m.id]={model_id:m.id,display_name:m.display_name,currencies:{},pending_approvals:0,active_budgets:0};
  function c(mid,cur){const s=out[mid]||(out[mid]={model_id:mid,display_name:'Model',currencies:{},pending_approvals:0,active_budgets:0});return s.currencies[cur]||(s.currencies[cur]={currency:cur,posted_debits:0,posted_credits:0,advance_balance:0,projected_recoupable:0,pending_approval:0});}
  for(const x of ledger){if(x.status!=='posted')continue;const z=c(x.model_id,String(x.currency||'USD').trim()),n=Number(x.amount||0),meta=x.metadata||{};if(x.direction==='debit')z.posted_debits+=n;else z.posted_credits+=n;if(x.direction==='debit'&&meta.recoupable===true)z.advance_balance+=n;if(x.direction==='credit'&&meta.applies_to_recoupment===true)z.advance_balance-=n;}
  const spent=new Map();for(const e of expenses){if(!e.model_account_budget_id||e.account_classification!=='recoupable_advance'||!['approved','charged','paid'].includes(String(e.status)))continue;const k=String(e.model_account_budget_id);spent.set(k,(spent.get(k)||0)+Number(e.amount||0));}
  for(const b of currentBudgets(budgets)){const s=out[b.model_id];if(!s)continue;s.active_budgets++;const z=c(b.model_id,String(b.currency||'USD').trim()),est=Number(b.estimated_recoupable_total||0),actual=spent.get(String(b.id))||0;if(b.status==='approved')z.projected_recoupable+=Math.max(est-actual,0);if(b.status==='pending'){z.projected_recoupable+=est;z.pending_approval+=est;s.pending_approvals++;}}
  for(const s of Object.values(out))s.currencies=Object.values(s.currencies).sort((a,b)=>a.currency.localeCompare(b.currency));
  return Object.values(out).sort((a,b)=>a.display_name.localeCompare(b.display_name));
}

export const handler=async(event)=>{
  if(!['GET','POST'].includes(event.httpMethod))return json(405,{error:'Method not allowed'});
  try{
    const {user,client}=await requireUser(event);
    const p=event.queryStringParameters||{},body=event.httpMethod==='POST'?parseBody(event):{};
    const {organization}=await requireStaffOrganization({user,client,organizationSlug:body.organization_slug||p.organization||'maison-de-veux'});
    const admin=await requirePermission(user.id,organization.id,'finance.read');
    const modelId=String(body.model_id||p.model_id||'').trim()||null;

    if(event.httpMethod==='GET'){
      let budgetsQ=admin.from('model_account_budgets').select('*').eq('organization_id',organization.id).order('updated_at',{ascending:false}).limit(1200);
      let itemsQ=admin.from('model_account_budget_items').select('*').eq('organization_id',organization.id).order('sort_order').limit(5000);
      let expensesQ=admin.from('expenses').select('*').eq('organization_id',organization.id).not('model_id','is',null).order('incurred_on',{ascending:false}).limit(2500);
      let ledgerQ=admin.from('model_ledger_entries').select('*').eq('organization_id',organization.id).order('effective_on',{ascending:false}).limit(4000);
      let statementsQ=admin.from('statements').select('*').eq('organization_id',organization.id).eq('statement_type','model').order('period_end',{ascending:false}).limit(1000);
      let ackQ=admin.from('model_statement_acknowledgements').select('*').eq('organization_id',organization.id).order('acknowledged_at',{ascending:false}).limit(1500);
      if(modelId){budgetsQ=budgetsQ.eq('model_id',modelId);itemsQ=itemsQ.eq('model_id',modelId);expensesQ=expensesQ.eq('model_id',modelId);ledgerQ=ledgerQ.eq('model_id',modelId);statementsQ=statementsQ.eq('model_id',modelId);ackQ=ackQ.eq('model_id',modelId);}
      const [models,budgets,items,expenses,ledger,statements,acks,travel,housing,approvals,documents]=await Promise.all([
        rows(admin.from('models').select('id,display_name,public_slug,legacy_key,stage,gender,status,active').eq('organization_id',organization.id).eq('active',true).order('display_name')),
        rows(budgetsQ),rows(itemsQ),rows(expensesQ),rows(ledgerQ),rows(statementsQ),rows(ackQ),
        rows(admin.from('travel_records').select('id,model_id,purpose,origin,destination,starts_at,ends_at,status,cost_amount,currency,paid_by').eq('organization_id',organization.id).order('starts_at',{ascending:false}).limit(1000)),
        rows(admin.from('housing_bookings').select('id,model_id,travel_record_id,provider,property_name,check_in_at,check_out_at,cost_amount,currency,paid_by,status').eq('organization_id',organization.id).order('check_in_at',{ascending:false}).limit(1000)),
        rows(admin.from('approval_requests').select('id,request_type,resource_type,resource_id,model_id,title,status,requested_at,decided_at,decision_note,details').eq('organization_id',organization.id).in('request_type',['model_budget','model_budget_overage']).order('requested_at',{ascending:false}).limit(1500)),
        rows((modelId?admin.from('document_links').select('id,document_id,resource_id,relationship,visible_to_model,documents(id,name,category,status,storage_provider,external_url,created_at)').eq('organization_id',organization.id).eq('resource_type','model').eq('resource_id',modelId):admin.from('document_links').select('id,document_id,resource_id,relationship,visible_to_model,documents(id,name,category,status,storage_provider,external_url,created_at)').eq('organization_id',organization.id).eq('resource_type','model')).order('created_at',{ascending:false}).limit(2000))
      ]);
      const modelMap=new Map(models.map(x=>[String(x.id),x]));
      const hydratedBudgets=budgets.map(b=>({...b,model:modelMap.get(String(b.model_id))||null,items:items.filter(i=>i.budget_id===b.id),approval:approvals.find(a=>a.id===b.approval_request_id)||null}));
      return json(200,{environment:'veux-desk-v16.9.18-model-account',organization,models,budgets:hydratedBudgets,expenses,ledger,statements,statement_acknowledgements:acks,approvals,travel,housing,documents,summaries:summaries(models,budgets,expenses,ledger)});
    }

    await requirePermission(user.id,organization.id,'finance.write');
    const action=String(body.action||'').trim();
    await enforceRateLimit(admin,{bucket:`model-account:${action||'unknown'}`,subject:user.id,maxRequests:50,windowSeconds:60});

    if(action==='create_budget'){
      const title=String(body.title||'').trim(),mid=String(body.model_id||'').trim();if(!mid||!title)throw validation('model_id and title are required.');
      const resourceType=String(body.resource_type||'other');if(!['travel','housing','visa','booking','development','test','digitals','portfolio','cash_advance','other'].includes(resourceType))throw validation('Invalid budget resource type.');
      const payload={organization_id:organization.id,model_id:mid,resource_type:resourceType,resource_id:body.resource_id||null,title,currency:currency(body.currency),status:'draft',overage_threshold_amount:money(body.overage_threshold_amount??250,'Overage threshold'),overage_threshold_percent:money(body.overage_threshold_percent??10,'Overage threshold percent'),notes:body.notes||null,created_by:user.id,metadata:{source:'agent_portal_16_9_18'}};
      const {data,error}=await admin.from('model_account_budgets').insert(payload).select('*').single();if(error)throw error;return json(201,{ok:true,verified:true,budget:data,persisted_at:data?.created_at||new Date().toISOString()});
    }

    if(action==='create_budget_from_travel'){
      const travelId=String(body.travel_record_id||'').trim();if(!travelId)throw validation('travel_record_id is required.');
      const {data:saved,error}=await admin.rpc('create_model_account_budget_from_travel_v1',{target_org:organization.id,target_travel:travelId,target_title:body.title||null,target_currency:body.currency||null,target_threshold_amount:money(body.overage_threshold_amount??250),target_threshold_percent:money(body.overage_threshold_percent??10),target_user:user.id});
      if(error)throw error;if(!saved?.verified||!saved?.budget){const e=new Error('Travel budget save could not be verified.');e.statusCode=500;throw e;}
      return json(201,{ok:true,verified:true,budget:saved.budget,imported_items:saved.imported_items||0,persisted_at:saved.persisted_at});
    }

    if(action==='save_budget_item'){
      const budgetId=String(body.budget_id||'').trim();if(!budgetId)throw validation('budget_id is required.');
      const budget=await one(admin.from('model_account_budgets').select('id,model_id,status').eq('organization_id',organization.id).eq('id',budgetId));if(!budget){const e=new Error('Budget not found');e.statusCode=404;throw e;}if(budget.status!=='draft')throw validation('Only draft budgets can be edited. Create a revision instead.');
      const payload={organization_id:organization.id,budget_id:budget.id,model_id:budget.model_id,category:String(body.category||'other').trim()||'other',description:String(body.description||'').trim()||null,classification:classify(body.classification),estimated_amount:money(body.estimated_amount,'Estimated amount'),sort_order:Number.isFinite(Number(body.sort_order))?Number(body.sort_order):0,metadata:{source:'agent_portal_16_9_18'}};
      let q=body.id?admin.from('model_account_budget_items').update(payload).eq('organization_id',organization.id).eq('budget_id',budget.id).eq('id',body.id):admin.from('model_account_budget_items').insert(payload);const {data,error}=await q.select('*').single();if(error)throw error;return json(200,{ok:true,verified:true,item:data,persisted_at:data?.updated_at||new Date().toISOString()});
    }

    if(action==='delete_budget_item'){
      const item=await one(admin.from('model_account_budget_items').select('id,budget_id').eq('organization_id',organization.id).eq('id',body.id));if(!item){const e=new Error('Budget item not found');e.statusCode=404;throw e;}const {data:deleted,error}=await admin.from('model_account_budget_items').delete().eq('organization_id',organization.id).eq('id',item.id).select('id').single();if(error)throw error;return json(200,{ok:true,verified:true,deleted_id:deleted.id,persisted_at:new Date().toISOString()});
    }

    if(action==='submit_budget')return withIdempotency(admin,{event,body,organizationId:organization.id,userId:user.id,operation:'model_account.submit_budget',execute:async()=>{const {data,error}=await admin.rpc('submit_model_account_budget_v1',{target_org:organization.id,target_budget:body.budget_id,target_user:user.id});if(error)throw error;return json(200,{ok:true,verified:true,...data,persisted_at:data?.persisted_at||new Date().toISOString()});}});
    if(action==='revise_budget'){const {data,error}=await admin.rpc('revise_model_account_budget_v1',{target_org:organization.id,target_budget:body.budget_id,target_user:user.id});if(error)throw error;return json(200,{ok:true,verified:true,...data,persisted_at:data?.persisted_at||new Date().toISOString()});}

    if(action==='record_expense')return withIdempotency(admin,{event,body,organizationId:organization.id,userId:user.id,operation:'model_account.record_expense',execute:async()=>{const {data,error}=await admin.rpc('record_model_account_expense_v1',{target_org:organization.id,target_model:body.model_id,target_budget:body.budget_id,target_budget_item:body.budget_item_id,target_description:body.description||null,target_amount:Number(body.amount),target_incurred_on:body.incurred_on||new Date().toISOString().slice(0,10),target_receipt_document:body.receipt_document_id||null,target_user:user.id});if(error)throw error;return json(201,{ok:true,verified:true,...data,persisted_at:data?.persisted_at||new Date().toISOString()});}});

    if(action==='post_credit'){
      await requirePermission(user.id,organization.id,'finance.approve');
      const {data,error}=await admin.rpc('post_model_account_credit_v1',{target_org:organization.id,target_model:body.model_id,target_amount:Number(body.amount),target_currency:currency(body.currency),target_effective_on:body.effective_on||new Date().toISOString().slice(0,10),target_description:body.description||null,target_credit_type:body.credit_type||'adjustment',target_user:user.id});if(error)throw error;return json(201,{ok:true,verified:true,...data,persisted_at:data?.persisted_at||new Date().toISOString()});
    }

    if(action==='issue_statement'){
      const {data,error}=await admin.rpc('issue_model_account_statement_v1',{target_org:organization.id,target_model:body.model_id,target_start:body.period_start,target_end:body.period_end,target_currency:currency(body.currency),target_user:user.id});if(error)throw error;return json(201,{ok:true,verified:true,...data,persisted_at:data?.persisted_at||new Date().toISOString()});
    }

    if(action==='cancel_budget'){
      const budget=await one(admin.from('model_account_budgets').select('*').eq('organization_id',organization.id).eq('id',body.budget_id));if(!budget){const e=new Error('Budget not found');e.statusCode=404;throw e;}if(['approved','superseded','closed'].includes(budget.status))throw validation('Approved historical budgets cannot be cancelled. Create a revision or account adjustment.');
      const {data:saved,error}=await admin.rpc('cancel_model_account_budget_v1',{target_org:organization.id,target_budget:budget.id,target_user:user.id});if(error)throw error;if(saved?.verified!==true)throw new Error('Budget cancellation could not be verified');return json(200,{ok:true,verified:true,budget:saved.budget,persisted_at:saved.persisted_at});
    }

    return json(400,{error:'Unsupported model account action'});
  }catch(error){return errorResponse(error);}
};
