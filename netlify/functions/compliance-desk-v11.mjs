import { requireUser, adminClient, assertPermission, parseBody, json, errorResponse } from './_lib/auth.mjs';

export const handler=async(event)=>{
  if(!['GET','POST'].includes(event.httpMethod))return json(405,{error:'Method not allowed'});
  try{
    const {user}=await requireUser(event);const admin=adminClient();const p=event.queryStringParameters||{};const body=event.httpMethod==='POST'?parseBody(event):{};const org=body.organization_id||p.organization_id;
    if(!org)return json(400,{error:'organization_id is required'});
    if(event.httpMethod==='GET'){
      if(!await assertPermission(admin,user.id,org,'compliance.read'))return json(403,{error:'Compliance read permission required'});
      const [{data:policy,error:pError},{data:requests,error:rError},{data:checks,error:cError}]=await Promise.all([
        admin.from('organization_retention_policies').select('*').eq('organization_id',org).maybeSingle(),
        admin.from('privacy_requests').select('*').eq('organization_id',org).order('requested_at',{ascending:false}).limit(200),
        admin.from('organization_launch_checks').select('*').eq('organization_id',org).order('category')
      ]);if(pError)throw pError;if(rError)throw rError;if(cError)throw cError;return json(200,{retention_policy:policy,privacy_requests:requests||[],launch_checks:checks||[]});
    }
    if(!await assertPermission(admin,user.id,org,'compliance.manage'))return json(403,{error:'Compliance management permission required'});
    const action=String(body.action||'');
    if(action==='update_retention'){
      const payload={organization_id:org};for(const k of ['audit_log_days','message_days','document_days','inactive_model_days','deleted_record_grace_days','legal_hold','settings'])if(body[k]!==undefined)payload[k]=body[k];const {data,error}=await admin.from('organization_retention_policies').upsert(payload,{onConflict:'organization_id'}).select('*').single();if(error)throw error;return json(200,{ok:true,retention_policy:data});
    }
    if(action==='create_privacy_request'){
      const {data,error}=await admin.from('privacy_requests').insert({organization_id:org,request_type:body.request_type||'other',subject_type:body.subject_type||'other',subject_id:body.subject_id||null,subject_email:body.subject_email||null,status:'received',due_at:body.due_at||null,assigned_to:body.assigned_to||null,notes:body.notes||null,metadata:body.metadata||{},created_by:user.id}).select('*').single();if(error)throw error;return json(201,{request:data});
    }
    if(action==='update_privacy_request'){
      if(!body.request_id)return json(400,{error:'request_id is required'});const payload={};for(const k of ['status','due_at','assigned_to','notes','metadata'])if(body[k]!==undefined)payload[k]=body[k];if(body.status==='completed')payload.completed_at=new Date().toISOString();const {data,error}=await admin.from('privacy_requests').update(payload).eq('organization_id',org).eq('id',body.request_id).select('*').single();if(error)throw error;return json(200,{request:data});
    }
    return json(400,{error:'Unsupported compliance action'});
  }catch(error){return errorResponse(error)}
};
