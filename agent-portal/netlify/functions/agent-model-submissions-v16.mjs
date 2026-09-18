import { requireUser, parseBody, json, errorResponse } from './_lib/auth.mjs';
import { requireStaffOrganization, requirePermission } from './_lib/agent-bridge.mjs';

async function rows(q){const {data,error}=await q;if(error)throw error;return data||[];}
async function one(q){const {data,error}=await q.maybeSingle();if(error)throw error;return data||null;}

async function notifyModel(admin,organizationId,modelId,media,status,note){
  const link=await one(admin.from('model_user_links').select('user_id').eq('organization_id',organizationId).eq('model_id',modelId));
  if(!link?.user_id)return;
  const approved=status==='approved';
  const kind=/digital/i.test(String(media.category||''))?'Digitals':'Portfolio';
  const {error}=await admin.from('notifications').insert({
    organization_id:organizationId,
    user_id:link.user_id,
    notification_type:'model_media_review',
    title:`${kind} ${approved?'approved':'needs changes'}`,
    body:note || (approved?'Your agency approved this submission.':'Your agency reviewed this submission. Open the portal for the latest status.'),
    channel:'in_app',
    status:'delivered',
    source_type:'model_media',
    source_id:media.id,
    action_url:/digital/i.test(String(media.category||''))?'?page=digitals':'?page=portfolio',
    metadata:{submission_status:status,model_id:modelId}
  });
  if(error)throw error;
}

export const handler=async(event)=>{
  if(!['GET','POST'].includes(event.httpMethod))return json(405,{error:'Method not allowed'});
  try{
    const {user,client}=await requireUser(event);
    const p=event.queryStringParameters||{},body=event.httpMethod==='POST'?parseBody(event):{};
    const {organization}=await requireStaffOrganization({user,client,organizationSlug:body.organization_slug||p.organization||'maison-de-veux'});
    const admin=await requirePermission(user.id,organization.id,event.httpMethod==='POST'?'media.write':'media.read');

    if(event.httpMethod==='POST'){
      if(String(body.action||'')!=='review')return json(400,{error:'Unsupported submission action'});
      if(!body.media_id||!['approved','rejected'].includes(String(body.status||'')))return json(400,{error:'media_id and approved/rejected status are required'});
      const media=await one(admin.from('model_media').select('*').eq('organization_id',organization.id).eq('id',body.media_id));
      if(!media)return json(404,{error:'Submission not found'});
      if(!media.metadata?.submitted_by_model)return json(409,{error:'This media item is not a Model Portal submission'});
      const reviewStatus=String(body.status),note=String(body.note||'').trim().slice(0,1200)||null;
      const metadata={...(media.metadata||{}),submission_status:reviewStatus,review_note:note,reviewed_at:new Date().toISOString(),reviewed_by:user.id};
      const category=reviewStatus==='approved'
        ? (/digital/i.test(String(media.category||''))?'Digitals':/portfolio/i.test(String(media.category||''))?'Portfolio':media.category)
        : media.category;
      const {data:updated,error}=await admin.from('model_media').update({
        is_public:reviewStatus==='approved',
        category,
        metadata
      }).eq('organization_id',organization.id).eq('id',media.id).select('*').single();
      if(error)throw error;
      await notifyModel(admin,organization.id,media.model_id,updated,reviewStatus,note);
      const verified=await one(admin.from('model_media').select('*').eq('organization_id',organization.id).eq('id',media.id));
      if(!verified||verified.metadata?.submission_status!==reviewStatus||Boolean(verified.is_public)!==(reviewStatus==='approved'))throw new Error('Submission review could not be verified after write.');
      return json(200,{ok:true,verified:true,media:verified,persisted_at:verified.updated_at||new Date().toISOString()});
    }

    const all=await rows(admin.from('model_media').select('*').eq('organization_id',organization.id).order('updated_at',{ascending:false}).limit(1000));
    let submissions=all.filter(x=>x.metadata?.submitted_by_model===true);
    const requested=String(p.status||'').trim().toLowerCase();
    if(requested)submissions=submissions.filter(x=>String(x.metadata?.submission_status||'pending_agency_review').toLowerCase()===requested);
    const modelIds=[...new Set(submissions.map(x=>x.model_id).filter(Boolean))];
    const models=modelIds.length?await rows(admin.from('models').select('id,display_name,public_slug,stage,status,primary_market_label').eq('organization_id',organization.id).in('id',modelIds)):[];
    const byModel=new Map(models.map(x=>[x.id,x]));
    const normalized=submissions.map(x=>({...x,model:byModel.get(x.model_id)||null,submission_status:x.metadata?.submission_status||'pending_agency_review',review_note:x.metadata?.review_note||null,reviewed_at:x.metadata?.reviewed_at||null}));
    return json(200,{
      environment:'veux-agency-v16.2',
      submissions:normalized,
      summary:{
        total:normalized.length,
        pending:normalized.filter(x=>/pending/.test(x.submission_status)).length,
        approved:normalized.filter(x=>x.submission_status==='approved').length,
        rejected:normalized.filter(x=>x.submission_status==='rejected').length
      }
    });
  }catch(error){return errorResponse(error);}
};
