import { requireUser, parseBody, json, errorResponse } from './_lib/auth.mjs';
import { requirePartnerPortal } from './_lib/portal-bridge.mjs';
async function represented(admin,org,partner,model){const {data,error}=await admin.from('model_placements').select('id').eq('organization_id',org).eq('partner_agency_id',partner).eq('model_id',model).in('status',['active','pending','placed']).limit(1);if(error)throw error;return !!(data&&data.length);}
export const handler=async(event)=>{
  if(event.httpMethod!=='POST')return json(405,{error:'Method not allowed'});
  try{
    const {user}=await requireUser(event),body=parseBody(event),slug=body.organization_slug||'maison-de-veux';
    const {admin,organization,partnerAgencyId}=await requirePartnerPortal({user,organizationSlug:slug});
    if(!body.upload_session_id)return json(400,{error:'upload_session_id is required'});
    const {data:s,error}=await admin.from('storage_upload_sessions').select('*').eq('id',body.upload_session_id).eq('organization_id',organization.id).maybeSingle();if(error)throw error;
    if(!s||s.requested_by!==user.id||s.resource_type!=='model'||!s.resource_id)return json(403,{error:'You cannot finalize this upload'});
    if(!await represented(admin,organization.id,partnerAgencyId,s.resource_id))return json(403,{error:'This model is no longer represented by your Mother Agency.'});
    if(s.status==='finalized'&&s.finalized_document_id){const {data:d}=await admin.from('documents').select('*').eq('organization_id',organization.id).eq('id',s.finalized_document_id).single();return json(200,{ok:true,verified:true,document:d,already_finalized:true});}
    if(s.status!=='created'||new Date(s.expires_at).getTime()<Date.now())return json(409,{error:'Upload session is expired or unavailable'});
    const slash=s.storage_path.lastIndexOf('/'),folder=slash>=0?s.storage_path.slice(0,slash):'',filename=slash>=0?s.storage_path.slice(slash+1):s.storage_path;
    const {data:objects,error:listError}=await admin.storage.from(s.bucket).list(folder,{search:filename,limit:10});if(listError)throw listError;if(!(objects||[]).some(x=>x.name===filename))return json(409,{error:'Uploaded object was not found. Complete the signed upload before finalizing.'});
    const metadata={submitted_by:'mother_agency',partner_agency_id:partnerAgencyId,travel_id:body.travel_id||s.metadata?.travel_id||null};
    const {data:saved,error:finalizeError}=await admin.rpc('finalize_document_upload_v1',{target_session:s.id,target_user:user.id,target_relationship:'mother_agency_submission',target_metadata:metadata});if(finalizeError)throw finalizeError;if(!saved?.verified||!saved?.document){const e=new Error('Document finalization could not be verified.');e.statusCode=500;throw e;}
    const travelId=metadata.travel_id;if(travelId){const {data:travel}=await admin.from('travel_records').select('id,model_id,visible_to_partner').eq('organization_id',organization.id).eq('id',travelId).eq('model_id',s.resource_id).eq('visible_to_partner',true).maybeSingle();if(travel){await admin.from('document_links').upsert({organization_id:organization.id,document_id:saved.document.id,resource_type:'travel',resource_id:travel.id,relationship:'mother_agency_submission',visible_to_model:true,visible_to_partner:true},{onConflict:'organization_id,document_id,resource_type,resource_id,relationship'}).then(()=>{}).catch(()=>{});}}
    return json(saved.already_finalized?200:201,{ok:true,verified:true,document:saved.document,already_finalized:!!saved.already_finalized,persisted_at:saved.persisted_at||null});
  }catch(error){return errorResponse(error);}
};
