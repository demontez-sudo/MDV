import { requireUser, parseBody, json, errorResponse } from './_lib/auth.mjs';
import { requireStaffOrganization, requirePermission } from './_lib/agent-bridge.mjs';

function ref(){return `VX-${new Date().toISOString().slice(0,10).replaceAll('-','')}-${crypto.randomUUID().slice(0,8).toUpperCase()}`;}

export const handler=async(event)=>{
  if(event.httpMethod!=='POST')return json(405,{error:'Method not allowed'});
  try{
    const {user,client}=await requireUser(event);const body=parseBody(event);
    const slug=body.organization_slug||'maison-de-veux';
    const {organization}=await requireStaffOrganization({user,client,organizationSlug:slug});
    let admin=await requirePermission(user.id,organization.id,'packages.write');
    await requirePermission(user.id,organization.id,'bookings.write');

    const feedbackId=String(body.feedback_id||'');
    const action=String(body.action||'');
    if(!feedbackId||!['casting','option','booking','availability','client_note'].includes(action)){
      const e=new Error('feedback_id and supported action are required');e.statusCode=400;throw e;
    }
    const {data:fb,error:fbError}=await admin.from('package_feedback').select('*,packages(id,title,company_id,primary_contact_id,market_id)').eq('organization_id',organization.id).eq('id',feedbackId).maybeSingle();
    if(fbError)throw fbError;if(!fb){const e=new Error('Package feedback not found');e.statusCode=404;throw e;}
    if(fb.status==='converted')return json(200,{ok:true,already_converted:true});

    const {data:saved,error:convertError}=await admin.rpc('convert_package_feedback_v1',{target_org:organization.id,target_feedback:fb.id,target_action:action,target_payload:{title:body.title||null,casting_type:body.casting_type||null,starts_at:body.starts_at||null,ends_at:body.ends_at||null,deadline_at:body.deadline_at||null,location:body.location||null,brief:body.brief||null,currency:body.currency||'USD',priority:Number(body.priority||1),expires_at:body.expires_at||null,note:body.note||null},target_user:user.id});
    if(convertError)throw convertError;if(saved?.verified!==true){const e=new Error('Client feedback conversion could not be verified');e.statusCode=409;throw e;}
    const castingId=saved.casting_id||null,bookingId=saved.booking_id||null,optionId=saved.booking_option_id||null,conversion=saved.conversion||null;

    const {data:recipient}=await admin.from('package_recipients').select('company_id,contact_id').eq('id',fb.recipient_id).maybeSingle();
    if(recipient?.company_id){await client.rpc('refresh_client_model_signal',{target_org:organization.id,target_company:recipient.company_id,target_contact:recipient.contact_id||null,target_model:fb.model_id});}

    return json(200,{ok:true,verified:true,conversion,casting_id:castingId,booking_id:bookingId,booking_option_id:optionId,persisted_at:saved.persisted_at||new Date().toISOString()});
  }catch(error){return errorResponse(error);}
};
