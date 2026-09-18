import { requireUser, json, errorResponse, parseBody } from './_lib/auth.mjs';
import { requireStaffOrganization, requirePermission } from './_lib/agent-bridge.mjs';
async function rows(q){const {data,error}=await q;if(error)throw error;return data||[];}
async function one(q){const {data,error}=await q;if(error)throw error;return data||null;}
async function signed(admin,doc){if(!doc?.storage_bucket||!doc?.storage_path)return doc?.external_url||null;try{if(doc.storage_bucket==='veux-public'){const {data}=admin.storage.from(doc.storage_bucket).getPublicUrl(doc.storage_path);return data?.publicUrl||null;}const {data,error}=await admin.storage.from(doc.storage_bucket).createSignedUrl(doc.storage_path,3600);if(error)return null;return data?.signedUrl||null;}catch(_){return null;}}
export const handler=async event=>{
  if(!['GET','POST'].includes(event.httpMethod))return json(405,{error:'Method not allowed'});
  try{
    const {user,client}=await requireUser(event),body=event.httpMethod==='POST'?parseBody(event):{},p=event.queryStringParameters||{};
    const {organization,membership}=await requireStaffOrganization({user,client,organizationSlug:body.organization_slug||p.organization||'maison-de-veux'});
    if(event.httpMethod==='POST'){
      const admin=await requirePermission(user.id,organization.id,'scouting.write'),action=String(body.action||'');
      if(action==='set_form_status'){
        const allowed=['new','reviewed','in_progress','converted','archived','rejected'];if(!allowed.includes(body.status))return json(400,{error:'Unsupported form status'});
        const patch={status:body.status,updated_at:new Date().toISOString()};if(body.status==='reviewed'){patch.reviewed_at=new Date().toISOString();patch.reviewed_by=membership.id;}
        const submission=await one(admin.from('agency_form_submissions').update(patch).eq('organization_id',organization.id).eq('id',body.submission_id).select('*').maybeSingle());if(!submission)return json(404,{error:'Form submission not found'});return json(200,{ok:true,verified:true,submission,persisted_at:submission.updated_at||new Date().toISOString()});
      }
      if(action==='link_model'){
        if(!body.submission_id||!body.model_id)return json(400,{error:'submission_id and model_id are required'});
        const model=await one(admin.from('models').select('id,display_name').eq('organization_id',organization.id).eq('id',body.model_id).maybeSingle());if(!model)return json(404,{error:'Model not found'});
        const submission=await one(admin.from('agency_form_submissions').update({model_id:model.id,updated_at:new Date().toISOString()}).eq('organization_id',organization.id).eq('id',body.submission_id).select('*').maybeSingle());if(!submission)return json(404,{error:'Form submission not found'});return json(200,{ok:true,verified:true,submission,model,persisted_at:submission.updated_at||new Date().toISOString()});
      }
      return json(400,{error:'Unsupported files/forms action'});
    }
    const admin=await requirePermission(user.id,organization.id,'documents.read');
    const canScout=await requirePermission(user.id,organization.id,'scouting.read').catch(()=>null);
    const [submissions,files,documents,links]=await Promise.all([
      rows(admin.from('agency_form_submissions').select('*').eq('organization_id',organization.id).neq('status','uploading').order('created_at',{ascending:false}).limit(500)),
      rows(admin.from('agency_form_files').select('*').eq('organization_id',organization.id).order('created_at',{ascending:false}).limit(1500)),
      rows(admin.from('documents').select('*').eq('organization_id',organization.id).neq('status','deleted').order('created_at',{ascending:false}).limit(600)),
      rows(admin.from('document_links').select('*').eq('organization_id',organization.id).order('created_at',{ascending:false}).limit(1500))
    ]);
    const docMap=new Map(documents.map(x=>[x.id,x]));
    const urls=new Map();for(const d of documents){const u=await signed(admin,d);if(u)urls.set(d.id,u);}
    const filesBySubmission=new Map();for(const f of files){if(!filesBySubmission.has(f.submission_id))filesBySubmission.set(f.submission_id,[]);filesBySubmission.get(f.submission_id).push({...f,document:docMap.get(f.document_id)||null,url:urls.get(f.document_id)||null});}
    let prospects=[];if(canScout){const ids=[...new Set(submissions.map(x=>x.scouting_prospect_id).filter(Boolean))];if(ids.length)prospects=await rows(admin.from('scouting_prospects').select('id,display_name,stage,status,converted_model_id').eq('organization_id',organization.id).in('id',ids));}
    const prospectMap=new Map(prospects.map(x=>[x.id,x]));
    const linkByDoc=new Map();for(const l of links){if(!linkByDoc.has(l.document_id))linkByDoc.set(l.document_id,[]);linkByDoc.get(l.document_id).push(l);}
    return json(200,{environment:'veux-desk-v16.9.27-files-forms',organization,submissions:submissions.map(x=>({...x,files:filesBySubmission.get(x.id)||[],scouting_prospect:prospectMap.get(x.scouting_prospect_id)||null})),documents:documents.map(x=>({...x,url:urls.get(x.id)||x.external_url||null,links:linkByDoc.get(x.id)||[]}))});
  }catch(error){return errorResponse(error);}
};
