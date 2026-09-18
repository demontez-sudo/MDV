import crypto from 'node:crypto';
import { requireUser, adminClient, parseBody, json, errorResponse } from './_lib/auth.mjs';
import { requireModelPortal } from './_lib/portal-bridge.mjs';

function cleanName(name){return String(name||'file').normalize('NFKD').replace(/[^a-zA-Z0-9._-]+/g,'-').replace(/-+/g,'-').slice(-120)||'file';}
const ALLOWED_MIME=/^(image\/(jpeg|png|webp|gif)|video\/(mp4|quicktime|webm)|application\/pdf|text\/plain)$/i;
const CATEGORIES=new Set(['digitals','portfolio','development','documents','travel','visa','other']);

export const handler=async(event)=>{
  if(event.httpMethod!=='POST') return json(405,{error:'Method not allowed'});
  try{
    const {user}=await requireUser(event); const body=parseBody(event);
    const slug=body.organization_slug||'maison-de-veux';
    const {admin,organization,modelId}=await requireModelPortal({user,organizationSlug:slug});
    if(!body.name) return json(400,{error:'File name is required'});
    const mime=String(body.mime_type||'application/octet-stream');
    if(!ALLOWED_MIME.test(mime)) return json(400,{error:'Use JPG, PNG, WEBP, GIF, MP4, MOV, WEBM, PDF or TXT files.'});
    const max=Number(process.env.VEUX_MODEL_PORTAL_UPLOAD_MAX_BYTES||52428800); const size=body.size_bytes==null?null:Number(body.size_bytes);
    if(size!=null&&(!Number.isFinite(size)||size<0||size>max)) return json(400,{error:`File exceeds the ${Math.round(max/1048576)} MB limit`});
    const category=CATEGORIES.has(String(body.category||'').toLowerCase())?String(body.category).toLowerCase():'other';
    const bucket=process.env.VEUX_PRIVATE_STORAGE_BUCKET||'veux-private';
    const path=`${organization.id}/model-submissions/${modelId}/${category}/${new Date().toISOString().slice(0,10)}/${crypto.randomUUID()}-${cleanName(body.name)}`;
    const {data:signed,error:signError}=await admin.storage.from(bucket).createSignedUploadUrl(path,{upsert:false}); if(signError)throw signError;
    const {data:session,error}=await admin.from('storage_upload_sessions').insert({
      organization_id:organization.id,requested_by:user.id,bucket,storage_path:path,original_name:body.name,mime_type:mime,size_bytes:size,
      category:`model_${category}`,visibility:'model_shared',resource_type:'model',resource_id:modelId,visible_to_model:true,visible_to_partner:false
    }).select('*').single(); if(error)throw error;
    return json(201,{ok:true,verified:true,upload_session_id:session.id,bucket,path,signed_url:signed.signedUrl||signed.signedURL||null,token:signed.token||null,expires_at:session.expires_at,category});
  }catch(error){return errorResponse(error);}
};
