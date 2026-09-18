import { requireUser, adminClient, assertPermission, parseBody, json, errorResponse } from './_lib/auth.mjs';
import { stripeRequest } from './_lib/stripe.mjs';
export const handler=async(event)=>{
  if(event.httpMethod!=='POST') return json(405,{error:'Method not allowed'});
  try{
    const {user}=await requireUser(event);const admin=adminClient();const body=parseBody(event);const org=body.organization_id;
    if(!org)return json(400,{error:'organization_id is required'}); if(!await assertPermission(admin,user.id,org,'billing.manage'))return json(403,{error:'Billing management permission required'});
    const {data:sub,error}=await admin.from('organization_subscriptions').select('provider_customer_id').eq('organization_id',org).maybeSingle();if(error)throw error;
    if(!sub?.provider_customer_id)return json(409,{error:'No Stripe customer is connected to this organization'});
    const returnUrl=body.return_url||process.env.VEUX_BILLING_PORTAL_RETURN_URL;if(!returnUrl)return json(500,{error:'Billing portal return URL is not configured'});
    const session=await stripeRequest('/billing_portal/sessions',{form:{customer:sub.provider_customer_id,return_url:returnUrl}});
    return json(201,{portal_url:session.url});
  }catch(error){return errorResponse(error)}
};
