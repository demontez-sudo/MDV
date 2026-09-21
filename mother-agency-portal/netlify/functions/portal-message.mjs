import { requireUser, adminClient, json, errorResponse, parseBody } from './_lib/auth.mjs';
import { requireModelPortal, requirePartnerPortal } from './_lib/portal-bridge.mjs';
export const handler=async(event)=>{
  if(event.httpMethod!=='POST')return json(405,{error:'Method not allowed'});
  try{
    const {user,client}=await requireUser(event);const b=parseBody(event),slug=b.organization_slug||'maison-de-veux';
    let partnerCtx=null;
    if(b.portal==='partner')partnerCtx=await requirePartnerPortal({user,organizationSlug:slug});else await requireModelPortal({user,organizationSlug:slug});
    if(!b.conversation_id||!String(b.body||'').trim())return json(400,{error:'conversation_id and body are required'});
    const text=String(b.body).trim();
    const {data,error}=await client.rpc('send_portal_message',{target_conversation:b.conversation_id,message_body:text});
    if(!error)return json(200,{ok:true,result:data});
    if(!partnerCtx)throw error;
    /* Fallback for Mother Agency: only into a conversation that belongs to this agency. */
    const admin=adminClient();
    const conv=await admin.from('conversations').select('id,partner_agency_id,status').eq('organization_id',partnerCtx.organization.id).eq('id',b.conversation_id).maybeSingle();
    if(conv.error||!conv.data||String(conv.data.partner_agency_id)!==String(partnerCtx.partnerAgencyId)||conv.data.status==='closed')throw error;
    const pa=await admin.from('partner_agencies').select('companies(name)').eq('id',partnerCtx.partnerAgencyId).maybeSingle();
    const label=(pa.data&&pa.data.companies&&pa.data.companies.name)||'Mother Agency';
    const saved=await admin.from('messages').insert({organization_id:partnerCtx.organization.id,conversation_id:b.conversation_id,sender_user_id:user.id,sender_label:label,body:text,visibility:'participants'}).select('id,conversation_id,sent_at').single();
    if(saved.error)throw error;
    await admin.from('conversations').update({updated_at:new Date().toISOString()}).eq('id',b.conversation_id);
    return json(200,{ok:true,fallback:true,result:saved.data});
  }catch(error){return errorResponse(error);}
};
