import { requireUser, parseBody, json, errorResponse } from './_lib/auth.mjs';
import { requireStaffOrganization, requirePermission } from './_lib/agent-bridge.mjs';

async function rows(q){const {data,error}=await q;if(error)throw error;return data||[];}

async function notifyVisibility(admin,organizationId,modelId,doc,visibleModel,visiblePartner){
  const notifications=[];
  if(visibleModel){
    const {data:link,error}=await admin.from('model_user_links').select('user_id').eq('organization_id',organizationId).eq('model_id',modelId).maybeSingle();if(error)throw error;
    if(link?.user_id)notifications.push({organization_id:organizationId,user_id:link.user_id,notification_type:'document_shared_state',title:`Document shared: ${doc?.name||'Agency document'}`,body:'A secure document was shared with your Model Portal. Open Documents to review and acknowledge it.',channel:'in_app',status:'delivered',source_type:'document',source_id:doc?.id,action_url:'?page=documents',metadata:{model_id:modelId,requires_ack:true,revision_at:new Date().toISOString(),due_at:new Date(Date.now()+24*3600000).toISOString()}});
  }
  if(visiblePartner){
    const placements=await rows(admin.from('model_placements').select('partner_agency_id').eq('organization_id',organizationId).eq('model_id',modelId).in('status',['active','pending','placed']));
    const ids=[...new Set(placements.map(x=>x.partner_agency_id).filter(Boolean))];
    if(ids.length){const links=await rows(admin.from('partner_user_links').select('user_id').eq('organization_id',organizationId).in('partner_agency_id',ids));for(const user_id of [...new Set(links.map(x=>x.user_id).filter(Boolean))])notifications.push({organization_id:organizationId,user_id,notification_type:'document_shared_state',title:`Document shared: ${doc?.name||'Agency document'}`,body:'A secure document was shared with your Mother Agency Portal. Open Documents to review and acknowledge it.',channel:'in_app',status:'delivered',source_type:'document',source_id:doc?.id,action_url:'?page=documents',metadata:{model_id:modelId,requires_ack:true,revision_at:new Date().toISOString(),due_at:new Date(Date.now()+24*3600000).toISOString()}});}
  }
  if(notifications.length){const {error}=await admin.from('notifications').insert(notifications);if(error)throw error;}
}

export const handler=async(event)=>{
  if(!['GET','POST'].includes(event.httpMethod)) return json(405,{error:'Method not allowed'});
  try{
    const {user,client}=await requireUser(event);
    const body=event.httpMethod==='POST'?parseBody(event):{};
    const slug=body.organization_slug||event.queryStringParameters?.organization||'maison-de-veux';
    const {organization}=await requireStaffOrganization({user,client,organizationSlug:slug});
    const admin=await requirePermission(user.id,organization.id,event.httpMethod==='GET'?'documents.read':'documents.write');
    const modelId=body.model_id||event.queryStringParameters?.model_id;
    if(!modelId)return json(400,{error:'model_id is required'});
    if(event.httpMethod==='GET'){
      const links=await rows(admin.from('document_links')
        .select('id,document_id,resource_type,resource_id,relationship,visible_to_model,visible_to_partner,created_at,documents(id,name,category,mime_type,size_bytes,storage_provider,external_url,status,created_at)')
        .eq('organization_id',organization.id).eq('resource_type','model').eq('resource_id',modelId).order('created_at',{ascending:false}));
      return json(200,{organization:{id:organization.id,name:organization.name},model_id:modelId,documents:links});
    }
    const action=String(body.action||'');
    if(action==='set_visibility'){
      if(!body.link_id)return json(400,{error:'link_id is required'});
      const before=await (async()=>{const {data,error}=await admin.from('document_links').select('id,document_id,visible_to_model,visible_to_partner,documents(id,name)').eq('organization_id',organization.id).eq('id',body.link_id).eq('resource_type','model').eq('resource_id',modelId).maybeSingle();if(error)throw error;return data;})();
      if(!before)return json(404,{error:'Document link not found'});
      const {data,error}=await admin.from('document_links').update({visible_to_model:!!body.visible_to_model,visible_to_partner:!!body.visible_to_partner})
        .eq('organization_id',organization.id).eq('id',body.link_id).eq('resource_type','model').eq('resource_id',modelId)
        .select('id,document_id,visible_to_model,visible_to_partner').single();
      if(error)throw error;if(!data)return json(404,{error:'Document link not found'});
      if(before){await notifyVisibility(admin,organization.id,modelId,before.documents,!before.visible_to_model&&data.visible_to_model,!before.visible_to_partner&&data.visible_to_partner);}
      return json(200,{ok:true,verified:true,link:data,persisted_at:new Date().toISOString()});
    }
    if(action==='remove_link'){
      if(!body.link_id)return json(400,{error:'link_id is required'});
      const {data,error}=await admin.from('document_links').delete().eq('organization_id',organization.id).eq('id',body.link_id).eq('resource_type','model').eq('resource_id',modelId).select('id').single();
      if(error)throw error;if(!data)return json(404,{error:'Document link not found'}); return json(200,{ok:true,verified:true,removed_link_id:data.id,persisted_at:new Date().toISOString()});
    }
    return json(400,{error:'Unsupported document action'});
  }catch(error){return errorResponse(error);}
};
