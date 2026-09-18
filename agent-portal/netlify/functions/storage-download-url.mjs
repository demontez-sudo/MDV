import { requireUser, json, errorResponse, adminClient, assertPermission } from './_lib/auth.mjs';
export const handler=async(event)=>{
  if(event.httpMethod!=='GET') return json(405,{error:'Method not allowed'});
  try{
    const {user}=await requireUser(event),admin=adminClient(),id=event.queryStringParameters?.document_id;
    if(!id)return json(400,{error:'document_id is required'});
    const {data:doc,error}=await admin.from('documents').select('id,organization_id,name,storage_provider,storage_bucket,storage_path,external_url,status').eq('id',id).maybeSingle();if(error)throw error;if(!doc)return json(404,{error:'Document not found'});
    if(!await assertPermission(admin,user.id,doc.organization_id,'documents.read'))return json(403,{error:'You do not have permission to open this document'});
    if(doc.status!=='active')return json(410,{error:'Document is not active'});
    if(doc.storage_provider==='external')return json(200,{url:doc.external_url,expires_in:null});
    if(doc.storage_provider!=='supabase'||!doc.storage_bucket||!doc.storage_path)return json(409,{error:'Document has no downloadable storage object'});
    const expires=Math.min(3600,Math.max(60,Number(event.queryStringParameters?.expires_in||300)));const {data:signed,error:se}=await admin.storage.from(doc.storage_bucket).createSignedUrl(doc.storage_path,expires);if(se)throw se;
    return json(200,{document:{id:doc.id,name:doc.name},url:signed.signedUrl,expires_in:expires});
  }catch(error){return errorResponse(error)}
};
