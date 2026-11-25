import crypto from 'node:crypto';
import { requireUser, adminClient, parseBody, json, errorResponse } from './_lib/auth.mjs';
import { requireModelPortal } from './_lib/portal-bridge.mjs';
import { alertAgencyOfModelUpload } from './_lib/staff-alerts.mjs';

function cleanName(name){return String(name||'file').normalize('NFKD').replace(/[^a-zA-Z0-9._-]+/g,'-').replace(/-+/g,'-').slice(-120)||'file';}
const ALLOWED_MIME=/^(image\/(jpeg|png|webp|gif)|video\/(mp4|quicktime|webm)|application\/pdf|text\/plain)$/i;
const CATEGORIES=new Set(['digitals','portfolio','development','documents','travel','visa','other']);
/* the page sends names like "Digitals Submission"; keep them as the right folder */
function categoryOf(v){const t=String(v||'').toLowerCase();if(CATEGORIES.has(t))return t;if(/digital|polaroid|headshot/.test(t))return 'digitals';if(/portfolio|editorial|runway|campaign|video|reel|walk/.test(t))return 'portfolio';return 'other';}

/* Second half of a model's upload: the file is already in private storage; this makes it a real document linked to the model,
   so the agency sees it (Files & Forms, and on the model), and tells the team. Until this existed the call was refused, so files
   a model sent from Digitals or Portfolio sat in storage and never reached the agency. */
async function finalizeUpload({admin,organization,modelId,user,body}){
  if(!body.upload_session_id) return json(400,{error:'upload_session_id is required'});
  const {data:s,error}=await admin.from('storage_upload_sessions').select('*').eq('id',body.upload_session_id).maybeSingle(); if(error)throw error;
  if(!s||s.organization_id!==organization.id||s.requested_by!==user.id||s.resource_type!=='model'||s.resource_id!==modelId||!String(s.category||'').startsWith('model_')) return json(403,{error:'You cannot finalize this upload.'});
  let doc=null,already=false;
  if(s.status==='finalized'&&s.finalized_document_id){
    const {data:d}=await admin.from('documents').select('*').eq('id',s.finalized_document_id).maybeSingle();doc=d||{id:s.finalized_document_id};already=true;
  }else{
    if(s.status!=='created'||new Date(s.expires_at).getTime()<Date.now()) return json(409,{error:'The upload expired. Please choose the file again.'});
    const slash=s.storage_path.lastIndexOf('/'),folder=s.storage_path.slice(0,slash),filename=s.storage_path.slice(slash+1);
    const {data:objects,error:listError}=await admin.storage.from(s.bucket).list(folder,{search:filename,limit:10}); if(listError)throw listError;
    if(!(objects||[]).some(x=>x.name===filename)) return json(409,{error:'The file did not finish uploading. Please try again.'});
    const caption=String(body.caption||'').trim().slice(0,300);
    const meta={source:'model_portal',category:s.category,caption:caption||null};
    let r=await admin.rpc('finalize_document_upload_v1',{target_session:s.id,target_user:user.id,target_relationship:'model_upload',target_metadata:meta});
    if(r.error) r=await admin.rpc('finalize_document_upload_v1',{target_session:s.id,target_user:user.id,target_relationship:'attachment',target_metadata:meta});
    if(r.error)throw r.error;
    if(!r.data?.verified||!r.data?.document) return json(500,{error:'The file could not be verified.'});
    doc=r.data.document;
  }
  /* make sure the document is linked to the model, visible to the model, so the agency's model files list it */
  const {data:link,error:le}=await admin.from('document_links').select('id').eq('organization_id',organization.id).eq('document_id',doc.id).eq('resource_type','model').eq('resource_id',modelId).maybeSingle(); if(le)throw le;
  if(!link){
    const row={organization_id:organization.id,document_id:doc.id,resource_type:'model',resource_id:modelId,relationship:'model_upload',visible_to_model:true,visible_to_partner:false};
    let ins=await admin.from('document_links').insert({...row,created_by:user.id});
    if(ins.error) ins=await admin.from('document_links').insert({...row,relationship:'attachment'});
    if(ins.error) ins=await admin.from('document_links').insert({organization_id:organization.id,document_id:doc.id,resource_type:'model',resource_id:modelId,relationship:'attachment'});
    if(ins.error)throw ins.error;
  }
  if(!already) await alertAgencyOfModelUpload(admin,{organization,modelId,document:doc,mime:s.mime_type,category:s.category,caption:String(body.caption||'').trim()});
  return json(200,{ok:true,verified:true,document_id:doc.id,already_finalized:already,persisted_at:new Date().toISOString()});
}

export const handler=async(event)=>{
  if(event.httpMethod!=='POST') return json(405,{error:'Method not allowed'});
  try{
    const {user}=await requireUser(event); const body=parseBody(event);
    const slug=body.organization_slug||'maison-de-veux';
    const {admin,organization,modelId}=await requireModelPortal({user,organizationSlug:slug});
    if(String(body.action||'')==='finalize_upload') return await finalizeUpload({admin,organization,modelId,user,body});
    if(!body.name) return json(400,{error:'File name is required'});
    const mime=String(body.mime_type||'application/octet-stream');
    if(!ALLOWED_MIME.test(mime)) return json(400,{error:'Use JPG, PNG, WEBP, GIF, MP4, MOV, WEBM, PDF or TXT files.'});
    const max=Number(process.env.VEUX_MODEL_PORTAL_UPLOAD_MAX_BYTES||52428800); const size=body.size_bytes==null?null:Number(body.size_bytes);
    if(size!=null&&(!Number.isFinite(size)||size<0||size>max)) return json(400,{error:`File exceeds the ${Math.round(max/1048576)} MB limit`});
    const category=categoryOf(body.category);
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
