import crypto from 'node:crypto';
import { adminClient, parseBody, json, errorResponse } from './_lib/auth.mjs';

const hashToken = token => crypto.createHash('sha256').update(String(token || '')).digest('hex');
const types=new Set(['interested','shortlist','remove_shortlist','pass','note','request_more_info','request_availability','request_casting','request_option']);
const eventMap={interested:'interested',shortlist:'shortlisted',remove_shortlist:'shortlist_removed',pass:'passed',note:'note_added',request_more_info:'more_info_requested',request_availability:'availability_requested',request_casting:'casting_requested',request_option:'option_requested'};
const headers={ 'Cache-Control':'no-store, private','X-Robots-Tag':'noindex, nofollow' };
function validToken(v){return /^[A-Za-z0-9_-]{32,160}$/.test(String(v||''));}
function unavailable(link){return !link||link.status!=='active'||(link.expires_at&&new Date(link.expires_at).getTime()<=Date.now())||(Number(link.max_views)>0&&Number(link.view_count||0)>=Number(link.max_views));}

export const handler=async event=>{
  if(event.httpMethod!=='POST')return json(405,{error:'Method not allowed'},{...headers,Allow:'POST'});
  try{
    const body=parseBody(event),raw=String(body.token||'').trim(),feedbackType=String(body.feedback_type||'').trim();
    const requestedIds=[...new Set((Array.isArray(body.model_ids)?body.model_ids:[body.model_id]).map(x=>String(x||'').trim()).filter(Boolean))];
    if(!validToken(raw)||!requestedIds.length||!types.has(feedbackType))return json(400,{error:'Invalid feedback request'},headers);
    const admin=adminClient();
    const {data:link,error:le}=await admin.from('package_share_links').select('*').eq('token_hash',hashToken(raw)).maybeSingle();if(le)throw le;
    if(unavailable(link))return json(404,{error:'Package link is invalid, expired, or inactive'},headers);

    const packageModels=await admin.from('package_models').select('model_id').eq('organization_id',link.organization_id).eq('package_id',link.package_id).eq('visible',true).in('model_id',requestedIds);
    if(packageModels.error)throw packageModels.error;
    const allowed=new Set((packageModels.data||[]).map(x=>String(x.model_id)));
    if(requestedIds.some(id=>!allowed.has(id)))return json(404,{error:'One or more models are not available in this package'},headers);

    const note=String(body.note||'').trim().slice(0,4000)||null;
    if(feedbackType==='remove_shortlist'){
      let closeQuery=admin.from('package_feedback').update({status:'closed'})
        .eq('organization_id',link.organization_id).eq('package_id',link.package_id)
        .eq('feedback_type','shortlist').eq('status','open').in('model_id',requestedIds);
      closeQuery=link.recipient_id?closeQuery.eq('recipient_id',link.recipient_id):closeQuery.is('recipient_id',null);
      const {error:closeErr}=await closeQuery;
      if(closeErr)throw closeErr;
      for(const modelId of requestedIds){
        await admin.from('package_activity').insert({organization_id:link.organization_id,package_id:link.package_id,recipient_id:link.recipient_id||null,share_link_id:link.id,event_type:'shortlist_removed',actor_label:'Package recipient',metadata:{model_id:modelId}}).then(()=>{}).catch(()=>{});
      }
      return json(200,{ok:true,verified:true,model_ids:requestedIds,persisted_at:new Date().toISOString()},headers);
    }

    const inserted=[];
    for(const modelId of requestedIds){
      const {data:feedback,error:fe}=await admin.from('package_feedback')
        .insert({organization_id:link.organization_id,package_id:link.package_id,recipient_id:link.recipient_id||null,model_id:modelId,feedback_type:feedbackType,note,status:'open'})
        .select('id,feedback_type,note,status,created_at').single();
      if(fe)throw fe;
      inserted.push({...feedback,model_id:modelId});
      await admin.from('package_activity').insert({organization_id:link.organization_id,package_id:link.package_id,recipient_id:link.recipient_id||null,share_link_id:link.id,event_type:eventMap[feedbackType],actor_label:'Package recipient',metadata:{model_id:modelId,feedback_id:feedback.id,batch_size:requestedIds.length}}).then(()=>{}).catch(()=>{});
    }
    return json(201,{ok:true,verified:true,feedback:inserted[0]||null,feedback_rows:inserted,persisted_at:inserted[0]?.created_at||new Date().toISOString()},headers);
  }catch(error){const r=errorResponse(error);r.headers={...r.headers,...headers};return r;}
};
