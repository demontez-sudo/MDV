import { requireUser, parseBody, json, errorResponse } from './_lib/auth.mjs';
import { requirePartnerPortal } from './_lib/portal-bridge.mjs';

export const handler=async(event)=>{
  if(event.httpMethod!=='POST')return json(405,{error:'Method not allowed'});
  try{
    const {user,client}=await requireUser(event),body=parseBody(event),slug=body.organization_slug||'maison-de-veux';
    const {organization}=await requirePartnerPortal({user,organizationSlug:slug});
    if(!body.travel_id||!body.response)return json(400,{error:'travel_id and response are required'});
    const {data,error}=await client.rpc('respond_to_partner_travel_v1',{target_travel:body.travel_id,response:body.response,response_note:body.note||null});
    if(error)throw error;
    if(!data?.verified){const e=new Error('Travel response was not confirmed as saved.');e.statusCode=500;throw e;}
    return json(200,{ok:true,verified:true,result:data,persisted_at:data.partner_responded_at||new Date().toISOString()});
  }catch(error){return errorResponse(error);}
};
