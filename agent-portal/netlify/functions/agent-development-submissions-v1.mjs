import { requireUser, parseBody, json, errorResponse } from './_lib/auth.mjs';
import { requireStaffOrganization, requirePermission } from './_lib/agent-bridge.mjs';

async function rows(q){const {data,error}=await q;if(error)throw error;return data||[];}
async function one(q){const {data,error}=await q.maybeSingle();if(error)throw error;return data||null;}
async function notifyModel(admin,org,modelId,submission){
  const link=await one(admin.from('model_user_links').select('user_id').eq('organization_id',org).eq('model_id',modelId));if(!link?.user_id)return;
  const approved=submission.status==='approved',kind=submission.submission_type==='skin'?'Skin submission':'Model walk';
  const {error}=await admin.from('notifications').insert({organization_id:org,user_id:link.user_id,notification_type:'model_development_submission_review',title:`${kind} ${approved?'approved':'needs changes'}`,body:submission.agent_note||(approved?'Your agency approved this development submission.':'Your agency reviewed this submission. Open Skin & Walks to view the note.'),channel:'in_app',status:'delivered',source_type:'model_development_submission',source_id:submission.id,action_url:'?page=submissions',metadata:{submission_type:submission.submission_type,submission_status:submission.status,model_id:modelId}});if(error)throw error;
}
async function hydrate(admin,org,filterModel){
  let q=admin.from('model_development_submissions').select('*').eq('organization_id',org).order('created_at',{ascending:false}).limit(300);if(filterModel)q=q.eq('model_id',filterModel);
  const submissions=await rows(q),ids=submissions.map(x=>x.id),modelIds=[...new Set(submissions.map(x=>x.model_id).filter(Boolean))];
  const [models,links]=await Promise.all([
    modelIds.length?rows(admin.from('models').select('id,display_name,public_slug,stage,status,primary_market_label').eq('organization_id',org).in('id',modelIds)):[],
    ids.length?rows(admin.from('document_links').select('id,document_id,resource_id,relationship,created_at').eq('organization_id',org).eq('resource_type','development_submission').in('resource_id',ids)):[]
  ]);
  const docIds=[...new Set(links.map(x=>x.document_id).filter(Boolean))],docs=docIds.length?await rows(admin.from('documents').select('id,name,category,mime_type,storage_provider,storage_bucket,storage_path,external_url,status,created_at').eq('organization_id',org).in('id',docIds).eq('status','active')):[];
  const byModel=new Map(models.map(x=>[x.id,x])),byDoc=new Map(docs.map(x=>[x.id,x])),filesBySub=new Map();
  for(const l of links){const d=byDoc.get(l.document_id);if(!d)continue;let url=d.external_url||null;if(d.storage_provider==='supabase'&&d.storage_bucket&&d.storage_path){const s=await admin.storage.from(d.storage_bucket).createSignedUrl(d.storage_path,900);if(!s.error)url=s.data?.signedUrl||null;}const f={id:d.id,name:d.name,category:d.category,mime_type:d.mime_type,relationship:l.relationship,url,created_at:d.created_at};if(!filesBySub.has(l.resource_id))filesBySub.set(l.resource_id,[]);filesBySub.get(l.resource_id).push(f);}
  return submissions.map(x=>({...x,model:byModel.get(x.model_id)||null,files:filesBySub.get(x.id)||[]}));
}

export const handler=async(event)=>{
  if(!['GET','POST'].includes(event.httpMethod))return json(405,{error:'Method not allowed'});
  try{
    const {user,client}=await requireUser(event),body=event.httpMethod==='POST'?parseBody(event):{},p=event.queryStringParameters||{};
    const {organization}=await requireStaffOrganization({user,client,organizationSlug:body.organization_slug||p.organization||'maison-de-veux'});
    const admin=await requirePermission(user.id,organization.id,event.httpMethod==='POST'?'development.write':'development.read');
    if(event.httpMethod==='POST'){
      if(String(body.action||'')!=='review')return json(400,{error:'Unsupported submission action'});
      const status=String(body.status||'');if(!body.submission_id||!['approved','changes_requested'].includes(status))return json(400,{error:'submission_id and approved/changes_requested status are required'});
      const existing=await one(admin.from('model_development_submissions').select('*').eq('organization_id',organization.id).eq('id',body.submission_id));if(!existing)return json(404,{error:'Submission not found'});
      const {data:updated,error}=await admin.from('model_development_submissions').update({status,agent_note:String(body.note||'').trim().slice(0,2000)||null,reviewed_by:user.id,reviewed_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq('organization_id',organization.id).eq('id',existing.id).select('*').single();if(error)throw error;
      await notifyModel(admin,organization.id,updated.model_id,updated);
      return json(200,{ok:true,verified:true,submission:updated,persisted_at:updated.updated_at});
    }
    const list=await hydrate(admin,organization.id,p.model_id||null);
    return json(200,{ok:true,submissions:list,summary:{total:list.length,pending:list.filter(x=>x.status==='pending').length,approved:list.filter(x=>x.status==='approved').length,changes_requested:list.filter(x=>x.status==='changes_requested').length,skin:list.filter(x=>x.submission_type==='skin').length,walk:list.filter(x=>x.submission_type==='walk').length}});
  }catch(error){return errorResponse(error);}
};
