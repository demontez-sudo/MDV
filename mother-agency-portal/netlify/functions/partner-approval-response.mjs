import { requireUser, json, errorResponse, parseBody } from './_lib/auth.mjs';
import { requirePartnerPortal } from './_lib/portal-bridge.mjs';
export const handler=async(event)=>{
  if(event.httpMethod!=='POST')return json(405,{error:'Method not allowed'});
  try{
    const {user,client}=await requireUser(event);const b=parseBody(event),slug=b.organization_slug||'maison-de-veux';await requirePartnerPortal({user,organizationSlug:slug});
    if(!b.request_id||!b.response)return json(400,{error:'request_id and response are required'});
    const {data,error}=await client.rpc('respond_to_partner_approval',{target_request:b.request_id,response:b.response,response_note:b.note||null});if(error)throw error;
    return json(200,{ok:true,result:data});
  }catch(error){return errorResponse(error);}
};
