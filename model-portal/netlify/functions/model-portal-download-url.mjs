import { requireUser, json, errorResponse } from './_lib/auth.mjs';
import { requireModelPortal } from './_lib/portal-bridge.mjs';

export const handler=async(event)=>{
  if(event.httpMethod!=='GET') return json(405,{error:'Method not allowed'});
  try{
    const {user}=await requireUser(event); const p=event.queryStringParameters||{};
    const slug=p.organization||p.organization_slug||'maison-de-veux'; const documentId=String(p.document_id||'').trim();
    if(!documentId)return json(400,{error:'document_id is required'});
    const {admin,organization,modelId}=await requireModelPortal({user,organizationSlug:slug});
    const {data:link,error:linkError}=await admin.from('document_links')
      .select('id,document_id,resource_type,resource_id,visible_to_model,documents(id,name,storage_provider,storage_bucket,storage_path,external_url,status)')
      .eq('organization_id',organization.id).eq('resource_type','model').eq('resource_id',modelId).eq('document_id',documentId).eq('visible_to_model',true).maybeSingle();
    if(linkError)throw linkError; if(!link?.documents)return json(404,{error:'Document is not available to this Model Portal'});
    const doc=link.documents; if(doc.status!=='active')return json(410,{error:'Document is not active'});
    if(doc.storage_provider==='external'&&doc.external_url)return json(200,{ok:true,verified:true,document:{id:doc.id,name:doc.name},url:doc.external_url,expires_in:null});
    if(doc.storage_provider!=='supabase'||!doc.storage_bucket||!doc.storage_path)return json(409,{error:'Document has no downloadable storage object'});
    const expires=Math.min(900,Math.max(60,Number(p.expires_in||300))); const {data:signed,error}=await admin.storage.from(doc.storage_bucket).createSignedUrl(doc.storage_path,expires); if(error)throw error;
    return json(200,{ok:true,verified:true,document:{id:doc.id,name:doc.name},url:signed.signedUrl,expires_in:expires});
  }catch(error){return errorResponse(error);}
};
