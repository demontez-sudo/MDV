import crypto from 'node:crypto';
import { requireUser, adminClient, parseBody, json, errorResponse } from './_lib/auth.mjs';
import { requirePartnerPortal } from './_lib/portal-bridge.mjs';

function cleanName(name){return String(name||'file').normalize('NFKD').replace(/[^a-zA-Z0-9._-]+/g,'-').replace(/-+/g,'-').slice(-120)||'file';}
const ALLOWED=/^(image\/(jpeg|png|webp)|application\/(pdf|msword|vnd\.openxmlformats-officedocument\.wordprocessingml\.document)|text\/plain)$/i;
async function represented(admin,org,partner,model){const {data,error}=await admin.from('model_placements').select('id').eq('organization_id',org).eq('partner_agency_id',partner).eq('model_id',model).in('status',['active','pending','placed']).limit(1);if(error)throw error;return !!(data&&data.length);}
export const handler=async(event)=>{
  if(event.httpMethod!=='POST')return json(405,{error:'Method not allowed'});
  try{
    const {user}=await requireUser(event),body=parseBody(event),slug=body.organization_slug||'maison-de-veux';
    const {admin,organization,partnerAgencyId}=await requirePartnerPortal({user,organizationSlug:slug});
    if(!body.model_id||!body.name)return json(400,{error:'model_id and name are required'});
    if(!await represented(admin,organization.id,partnerAgencyId,body.model_id))return json(403,{error:'This model is not represented by your Mother Agency.'});
    const mime=String(body.mime_type||'application/octet-stream');if(!ALLOWED.test(mime))return json(400,{error:'File type is not allowed for partner document uploads'});
    const max=Number(process.env.VEUX_PRIVATE_FILE_MAX_BYTES||52428800),size=body.size_bytes==null?null:Number(body.size_bytes);if(size!=null&&(!Number.isFinite(size)||size<0||size>max))return json(400,{error:`File exceeds the ${Math.round(max/1048576)} MB limit`});
    const bucket=process.env.VEUX_PRIVATE_STORAGE_BUCKET||'veux-private',category=cleanName(body.category||'partner-document').toLowerCase(),name=cleanName(body.name),path=`${organization.id}/partner/${partnerAgencyId}/${body.model_id}/${category}/${new Date().toISOString().slice(0,10)}/${crypto.randomUUID()}-${name}`;
    const {data:signed,error:signError}=await admin.storage.from(bucket).createSignedUploadUrl(path,{upsert:false});if(signError)throw signError;
    const {data:session,error}=await admin.from('storage_upload_sessions').insert({organization_id:organization.id,requested_by:user.id,bucket,storage_path:path,original_name:body.name,mime_type:mime,size_bytes:size,category:body.category||'partner-document',visibility:'partner_shared',resource_type:'model',resource_id:body.model_id,visible_to_model:true,visible_to_partner:true,metadata:{submitted_by_partner_agency_id:partnerAgencyId,travel_id:body.travel_id||null}}).select('*').single();if(error)throw error;
    return json(201,{ok:true,upload_session_id:session.id,bucket,path,signed_url:signed.signedUrl||signed.signedURL||null,token:signed.token||null,expires_at:session.expires_at});
  }catch(error){return errorResponse(error);}
};
