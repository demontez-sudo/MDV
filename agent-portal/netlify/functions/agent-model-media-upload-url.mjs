import crypto from 'node:crypto';
import { requireUser, adminClient, parseBody, json, errorResponse, assertPermission } from './_lib/auth.mjs';
import { requireStaffOrganization } from './_lib/agent-bridge.mjs';
function clean(v){return String(v||'image').normalize('NFKD').replace(/[^a-zA-Z0-9._-]+/g,'-').replace(/-+/g,'-').slice(-100)||'image';}
const ALLOWED_ORIGINS=new Set(['https://maisondeveux.com','https://www.maisondeveux.com','https://maison-agent.netlify.app']);
function corsHeaders(event){
 const origin=String(event?.headers?.origin||event?.headers?.Origin||'').trim();
 const allowed=ALLOWED_ORIGINS.has(origin)?origin:'';
 return {
  ...(allowed?{'Access-Control-Allow-Origin':allowed}:{}),
  'Access-Control-Allow-Headers':'Authorization, Content-Type',
  'Access-Control-Allow-Methods':'POST, OPTIONS',
  'Vary':'Origin'
 };
}
function response(event,status,body){return json(status,body,corsHeaders(event));}
export const handler=async(event)=>{
 if(event.httpMethod==='OPTIONS')return {statusCode:204,headers:corsHeaders(event),body:''};
 if(event.httpMethod!=='POST')return response(event,405,{error:'Method not allowed'});
 try{
  const {user,client}=await requireUser(event);const body=parseBody(event);
  const {organization}=await requireStaffOrganization({user,client,organizationSlug:body.organization_slug||'maison-de-veux'});const admin=adminClient();
  if(!await assertPermission(admin,user.id,organization.id,'media.write'))return response(event,403,{error:'You do not have permission to upload model media'});
  if(!body.model_id||!body.name)return response(event,400,{error:'model_id and name are required'});
  const model=await admin.from('models').select('id').eq('organization_id',organization.id).eq('id',body.model_id).maybeSingle();if(model.error)throw model.error;if(!model.data)return response(event,404,{error:'Model not found'});
  const mime=String(body.mime_type||'');if(!/^(image\/(jpeg|png|webp|gif)|video\/(mp4|quicktime|webm))$/i.test(mime))return response(event,400,{error:'Use JPG, PNG, WEBP, GIF, MP4, MOV or WEBM media.'});
  const max=Number(process.env.VEUX_MODEL_MEDIA_MAX_BYTES||52428800),size=body.size_bytes==null?null:Number(body.size_bytes);if(size!=null&&(!Number.isFinite(size)||size<0||size>max))return response(event,400,{error:`Model media exceeds the ${Math.round(max/1048576)} MB limit`});
  const bucket='veux-public',path=`${organization.id}/models/${body.model_id}/${crypto.randomUUID()}-${clean(body.name)}`;
  const {data,error}=await admin.storage.from(bucket).createSignedUploadUrl(path,{upsert:false});if(error)throw error;
  const pub=admin.storage.from(bucket).getPublicUrl(path).data.publicUrl;return response(event,201,{signed_url:data.signedUrl||data.signedURL,token:data.token||null,bucket,path,public_url:pub,media_type:/^video\//i.test(mime)?'video':'image'});
 }catch(error){const out=errorResponse(error);out.headers={...(out.headers||{}),...corsHeaders(event)};return out;}
};
