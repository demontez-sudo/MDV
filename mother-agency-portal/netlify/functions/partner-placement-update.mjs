import { requireUser, json, errorResponse, parseBody } from './_lib/auth.mjs';
import { requirePartnerPortal } from './_lib/portal-bridge.mjs';

export const handler=async(event)=>{
  if(event.httpMethod!=='POST')return json(405,{error:'Method not allowed'});
  try{
    const {user}=await requireUser(event),body=parseBody(event),slug=body.organization_slug||'maison-de-veux';
    const {admin,organization,partnerAgencyId}=await requirePartnerPortal({user,organizationSlug:slug});
    if(!body.placement_id)return json(400,{error:'placement_id is required'});
    const note=String(body.note||'').trim().slice(0,1500);
    if(!note)return json(400,{error:'Add an update before sending'});
    const updateType=['general','availability','travel','visa','documents','development'].includes(String(body.update_type||''))?String(body.update_type):'general';
    const {data:placement,error}=await admin.from('model_placements').select('*')
      .eq('organization_id',organization.id).eq('partner_agency_id',partnerAgencyId).eq('id',body.placement_id).maybeSingle();
    if(error)throw error;if(!placement)return json(404,{error:'Placement not found for this Mother Agency'});
    const previous=Array.isArray(placement.metadata?.partner_portal_updates)?placement.metadata.partner_portal_updates:[];
    const update={at:new Date().toISOString(),by:user.id,type:updateType,note};
    const metadata={...(placement.metadata||{}),partner_portal_updates:[update,...previous].slice(0,20),partner_portal_latest:update};
    const {data,error:ue}=await admin.from('model_placements').update({metadata}).eq('organization_id',organization.id).eq('partner_agency_id',partnerAgencyId).eq('id',placement.id).select('*').single();
    if(ue)throw ue;
    return json(200,{ok:true,verified:true,placement:data,update,persisted_at:data?.updated_at||update.at});
  }catch(error){return errorResponse(error);}
};
