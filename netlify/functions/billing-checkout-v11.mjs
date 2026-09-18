import { requireUser, adminClient, assertPermission, parseBody, json, errorResponse } from './_lib/auth.mjs';
import { stripeRequest } from './_lib/stripe.mjs';
import { enforceRateLimit, withIdempotency } from './_lib/reliability.mjs';

export const handler=async(event)=>{
  if(event.httpMethod!=='POST') return json(405,{error:'Method not allowed'});
  try{
    const {user}=await requireUser(event); const admin=adminClient(); const body=parseBody(event); const org=body.organization_id;
    if(!org||!body.plan_key) return json(400,{error:'organization_id and plan_key are required'});
    if(!await assertPermission(admin,user.id,org,'billing.manage')) return json(403,{error:'Billing management permission required'});
    await enforceRateLimit(admin,{bucket:'billing.checkout',subject:user.id,maxRequests:10,windowSeconds:60});
    return withIdempotency(admin,{event,body,organizationId:org,userId:user.id,operation:'billing.checkout',ttlSeconds:3600,execute:async()=>{
      const {data:plan,error:planError}=await admin.from('subscription_plans').select('*').eq('key',body.plan_key).eq('status','active').maybeSingle(); if(planError) throw planError;
      if(!plan) return json(409,{error:'This plan is not available for checkout yet'});
      const priceId=plan.settings?.stripe_price_id; if(!priceId) return json(409,{error:'Stripe pricing is not configured for this plan'});
      const [{data:subscription,error:subError},{data:authUser,error:userError}]=await Promise.all([
        admin.from('organization_subscriptions').select('*').eq('organization_id',org).maybeSingle(),
        admin.auth.admin.getUserById(user.id)
      ]); if(subError) throw subError; if(userError) throw userError;
      const successUrl=body.success_url||process.env.VEUX_BILLING_SUCCESS_URL; const cancelUrl=body.cancel_url||process.env.VEUX_BILLING_CANCEL_URL;
      if(!successUrl||!cancelUrl) return json(500,{error:'Billing return URLs are not configured'});
      const form={mode:'subscription',success_url:successUrl,cancel_url:cancelUrl,client_reference_id:org,'metadata':{organization_id:org,plan_key:plan.key},'subscription_data':{metadata:{organization_id:org,plan_key:plan.key}},'line_items':[{'price':priceId,'quantity':1}]};
      if(subscription?.provider_customer_id) form.customer=subscription.provider_customer_id; else form.customer_email=authUser?.user?.email;
      const session=await stripeRequest('/checkout/sessions',{form});
      return json(201,{checkout_url:session.url,checkout_session_id:session.id});
    }});
  }catch(error){return errorResponse(error)}
};
