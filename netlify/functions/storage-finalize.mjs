import { requireUser, assertPermission, adminClient, parseBody, json, errorResponse } from './_lib/auth.mjs';
async function rows(q){const {data,error}=await q;if(error)throw error;return data||[];}
async function notifyDocument(admin,s,doc){
  if(s.resource_type!=='model'||!s.resource_id)return;
  const notifications=[];
  if(s.visible_to_model){
    const {data:link,error}=await admin.from('model_user_links').select('user_id').eq('organization_id',s.organization_id).eq('model_id',s.resource_id).maybeSingle();if(error)throw error;
    if(link?.user_id)notifications.push({organization_id:s.organization_id,user_id:link.user_id,notification_type:'document_shared_state',title:`Document shared: ${doc.name||'Agency document'}`,body:'A new secure document is available. Open Documents to review and acknowledge it.',channel:'in_app',status:'delivered',source_type:'document',source_id:doc.id,action_url:'?page=documents',metadata:{model_id:s.resource_id,requires_ack:true,revision_at:new Date().toISOString(),due_at:new Date(Date.now()+24*3600000).toISOString()}});
  }
  if(s.visible_to_partner){
    const placements=await rows(admin.from('model_placements').select('partner_agency_id').eq('organization_id',s.organization_id).eq('model_id',s.resource_id).in('status',['active','pending','placed']));
    const partnerIds=[...new Set(placements.map(x=>x.partner_agency_id).filter(Boolean))];
    if(partnerIds.length){const links=await rows(admin.from('partner_user_links').select('user_id').eq('organization_id',s.organization_id).in('partner_agency_id',partnerIds));for(const user_id of [...new Set(links.map(x=>x.user_id).filter(Boolean))])notifications.push({organization_id:s.organization_id,user_id,notification_type:'document_shared_state',title:`Document shared: ${doc.name||'Agency document'}`,body:'A new partner-visible secure document is available. Open Documents to review and acknowledge it.',channel:'in_app',status:'delivered',source_type:'document',source_id:doc.id,action_url:'?page=documents',metadata:{model_id:s.resource_id,requires_ack:true,revision_at:new Date().toISOString(),due_at:new Date(Date.now()+24*3600000).toISOString()}});}
  }
  if(notifications.length){const {error}=await admin.from('notifications').insert(notifications);if(error)throw error;}
}
export const handler=async(event)=>{
  if(event.httpMethod!=='POST') return json(405,{error:'Method not allowed'});
  try{
    const {user}=await requireUser(event); const admin=adminClient(); const body=parseBody(event); if(!body.upload_session_id)return json(400,{error:'upload_session_id is required'});
    const {data:s,error}=await admin.from('storage_upload_sessions').select('*').eq('id',body.upload_session_id).single(); if(error) throw error;
    if(s.requested_by!==user.id && !await assertPermission(admin,user.id,s.organization_id,'documents.write')) return json(403,{error:'You cannot finalize this upload'});
    if(s.status==='finalized' && s.finalized_document_id){const {data:d}=await admin.from('documents').select('*').eq('id',s.finalized_document_id).single();return json(200,{document:d,already_finalized:true})}
    if(s.status!=='created' || new Date(s.expires_at).getTime()<Date.now()) return json(409,{error:'Upload session is expired or unavailable'});
    const slash=s.storage_path.lastIndexOf('/'); const folder=slash>=0?s.storage_path.slice(0,slash):''; const filename=slash>=0?s.storage_path.slice(slash+1):s.storage_path;
    const {data:objects,error:listError}=await admin.storage.from(s.bucket).list(folder,{search:filename,limit:10}); if(listError) throw listError;
    if(!(objects||[]).some(x=>x.name===filename)) return json(409,{error:'Uploaded object was not found. Complete the signed upload before finalizing.'});
    const {data:saved,error:finalizeError}=await admin.rpc('finalize_document_upload_v1',{target_session:s.id,target_user:user.id,target_relationship:body.relationship||'attachment',target_metadata:body.metadata&&typeof body.metadata==='object'?body.metadata:{}});if(finalizeError)throw finalizeError;
    if(!saved?.verified||!saved?.document){const e=new Error('Document finalization could not be verified.');e.statusCode=500;throw e;}
    const doc=saved.document;
    let notification_warning=null;try{await notifyDocument(admin,s,doc);}catch(ne){notification_warning=ne?.message||String(ne);console.warn('[VEUX document notification]',notification_warning);}
    return json(saved.already_finalized?200:201,{ok:true,verified:true,document:doc,already_finalized:!!saved.already_finalized,persisted_at:saved.persisted_at||null,notification_warning});
  }catch(error){return errorResponse(error)}
};
