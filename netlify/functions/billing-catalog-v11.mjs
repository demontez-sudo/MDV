import { requireUser, adminClient, assertPermission, json, errorResponse } from './_lib/auth.mjs';
import { getOrganizationCapacity } from './_lib/entitlements.mjs';

export const handler = async (event) => {
  if (event.httpMethod !== 'GET') return json(405,{error:'Method not allowed'});
  try {
    const { user } = await requireUser(event); const admin=adminClient(); const p=event.queryStringParameters||{}; const org=p.organization_id;
    if(!org) return json(400,{error:'organization_id is required'});
    if(!await assertPermission(admin,user.id,org,'billing.read')) return json(403,{error:'Billing access required'});
    const [{data:plans,error:planError},{data:history,error:historyError},capacity] = await Promise.all([
      admin.from('subscription_plans').select('id,key,name,billing_interval,base_price,currency,included_staff,included_models,included_markets,settings').eq('status','active').order('base_price',{ascending:true,nullsFirst:false}),
      admin.from('organization_billing_history').select('id,event_type,status,amount,currency,description,effective_at').eq('organization_id',org).order('effective_at',{ascending:false}).limit(25),
      getOrganizationCapacity(admin,org)
    ]);
    if(planError) throw planError; if(historyError) throw historyError;
    return json(200,{plans:plans||[],capacity,billing_history:history||[]});
  } catch(error){ return errorResponse(error); }
};
