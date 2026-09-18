import { requireUser, json, errorResponse, parseBody } from './_lib/auth.mjs';
import { requireModelPortal, requirePartnerPortal } from './_lib/portal-bridge.mjs';
export const handler=async(event)=>{
  if(event.httpMethod!=='POST')return json(405,{error:'Method not allowed'});
  try{
    const {user,client}=await requireUser(event);const b=parseBody(event),slug=b.organization_slug||'maison-de-veux';
    if(b.portal==='partner')await requirePartnerPortal({user,organizationSlug:slug});else await requireModelPortal({user,organizationSlug:slug});
    if(!b.conversation_id||!String(b.body||'').trim())return json(400,{error:'conversation_id and body are required'});
    const {data,error}=await client.rpc('send_portal_message',{target_conversation:b.conversation_id,message_body:String(b.body).trim()});if(error)throw error;
    return json(200,{ok:true,result:data});
  }catch(error){return errorResponse(error);}
};
