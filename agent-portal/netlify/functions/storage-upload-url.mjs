import crypto from 'node:crypto';
import { requireUser, assertPermission, adminClient, parseBody, json, errorResponse } from './_lib/auth.mjs';

function cleanName(name){return String(name||'file').normalize('NFKD').replace(/[^a-zA-Z0-9._-]+/g,'-').replace(/-+/g,'-').slice(-120)||'file'}
const ALLOWED_MIME=/^(image\/(jpeg|png|webp|gif)|video\/(mp4|quicktime|webm)|application\/pdf|text\/plain)$/i;
const VISIBILITIES=new Set(['private','staff','model_shared','partner_shared','public']);
function visibility(value){const v=String(value||'staff').trim().toLowerCase();return VISIBILITIES.has(v)?v:'staff';}

export const handler=async(event)=>{
  if(event.httpMethod!=='POST') return json(405,{error:'Method not allowed'});
  try{
    const {user}=await requireUser(event); const admin=adminClient(); const body=parseBody(event);
    const org=body.organization_id; if(!org||!body.name) return json(400,{error:'organization_id and name are required'});
    if(!await assertPermission(admin,user.id,org,'documents.write')) return json(403,{error:'You do not have permission to upload secured documents'});
    if(body.resource_type==='model'&&body.resource_id){const {data:model,error:modelError}=await admin.from('models').select('id').eq('organization_id',org).eq('id',body.resource_id).maybeSingle();if(modelError)throw modelError;if(!model)return json(404,{error:'Model not found'});}
    const mime=String(body.mime_type||'application/octet-stream');
    if(!ALLOWED_MIME.test(mime)) return json(400,{error:'File type is not allowed for secure uploads'});
    const max=Number(process.env.VEUX_PRIVATE_FILE_MAX_BYTES||52428800); const size=body.size_bytes==null?null:Number(body.size_bytes);
    if(size!=null && (!Number.isFinite(size)||size<0||size>max)) return json(400,{error:`File exceeds the ${Math.round(max/1048576)} MB limit`});
    const bucket=process.env.VEUX_PRIVATE_STORAGE_BUCKET||'veux-private'; const name=cleanName(body.name); const category=cleanName(body.category||'general').toLowerCase();
    const path=`${org}/${category}/${new Date().toISOString().slice(0,10)}/${crypto.randomUUID()}-${name}`;
    const {data:signed,error:signError}=await admin.storage.from(bucket).createSignedUploadUrl(path,{upsert:false}); if(signError) throw signError;
    const {data:session,error}=await admin.from('storage_upload_sessions').insert({organization_id:org,requested_by:user.id,bucket,storage_path:path,original_name:body.name,mime_type:mime,size_bytes:size,category:body.category||null,visibility:visibility(body.visibility),resource_type:body.resource_type||null,resource_id:body.resource_id||null,visible_to_model:!!body.visible_to_model,visible_to_partner:!!body.visible_to_partner}).select('*').single(); if(error) throw error;
    return json(201,{upload_session_id:session.id,bucket,path,signed_url:signed.signedUrl||signed.signedURL||null,token:signed.token||null,expires_at:session.expires_at});
  }catch(error){return errorResponse(error)}
};
