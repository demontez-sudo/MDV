import { requireUser, json, errorResponse } from './_lib/auth.mjs';
import { requirePartnerPortal } from './_lib/portal-bridge.mjs';

export const handler=async(event)=>{
  if(event.httpMethod!=='GET') return json(405,{error:'Method not allowed'});
  try{
    const {user}=await requireUser(event);
    const id=event.queryStringParameters?.document_id;
    const slug=event.queryStringParameters?.organization||'maison-de-veux';
    if(!id)return json(400,{error:'document_id is required'});
    const {admin,organization,partnerAgencyId}=await requirePartnerPortal({user,organizationSlug:slug});
    const {data:placements,error:pe}=await admin.from('model_placements').select('model_id,status').eq('organization_id',organization.id).eq('partner_agency_id',partnerAgencyId).in('status',['active','pending','placed']);
    if(pe)throw pe;const modelIds=(placements||[]).map(x=>x.model_id);if(!modelIds.length)return json(404,{error:'Document not found or access denied'});
    const {data:link,error:le}=await admin.from('document_links')
      .select('id,document_id,resource_id').eq('organization_id',organization.id).eq('document_id',id)
      .eq('resource_type','model').in('resource_id',modelIds).eq('visible_to_partner',true).limit(1).maybeSingle();
    if(le)throw le;if(!link)return json(404,{error:'Document not found or access denied'});
    const {data:doc,error}=await admin.from('documents').select('id,name,storage_provider,storage_bucket,storage_path,external_url,status').eq('organization_id',organization.id).eq('id',id).maybeSingle();
    if(error)throw error;if(!doc)return json(404,{error:'Document not found or access denied'});
    if(doc.status!=='active')return json(410,{error:'Document is not active'});
    if(doc.storage_provider==='external')return json(200,{url:doc.external_url,expires_in:null});
    if(doc.storage_provider!=='supabase'||!doc.storage_bucket||!doc.storage_path)return json(409,{error:'Document has no downloadable storage object'});
    const expires=Math.min(3600,Math.max(60,Number(event.queryStringParameters?.expires_in||300)));
    const {data:signed,error:se}=await admin.storage.from(doc.storage_bucket).createSignedUrl(doc.storage_path,expires);if(se)throw se;
    return json(200,{document:{id:doc.id,name:doc.name},url:signed.signedUrl,expires_in:expires});
  }catch(error){return errorResponse(error)}
};
