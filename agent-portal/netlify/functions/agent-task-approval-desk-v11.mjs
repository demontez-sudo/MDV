import { requireUser, parseBody, json, errorResponse, assertPermission } from './_lib/auth.mjs';
import { requireStaffOrganization, requirePermission } from './_lib/agent-bridge.mjs';

async function rows(q){const {data,error}=await q;if(error)throw error;return data||[];}

export const handler=async(event)=>{
  if(!['GET','POST'].includes(event.httpMethod))return json(405,{error:'Method not allowed'});
  try{
    const {user,client}=await requireUser(event),p=event.queryStringParameters||{},body=event.httpMethod==='POST'?parseBody(event):{};
    const {organization}=await requireStaffOrganization({user,client,organizationSlug:body.organization_slug||p.organization||'maison-de-veux'});
    if(event.httpMethod==='POST'){
      const action=String(body.action||'');
      if(action==='task_status'){
        const admin=await requirePermission(user.id,organization.id,'tasks.write');const normalizedStatus=String(body.status||'').toLowerCase()==='done'?'completed':String(body.status||'').toLowerCase();if(!['open','in_progress','completed','cancelled'].includes(normalizedStatus))return json(400,{error:'Unsupported task status'});
        let data=null,rpcError=null;
        try{const r=await client.rpc('set_task_status_staff',{target_org:organization.id,target_task:body.task_id,target_status:normalizedStatus,note_value:body.note||null});if(r.error)rpcError=r.error;else data=r.data;}catch(e){rpcError=e;}
        if(rpcError){
          console.warn('[tasks] set_task_status_staff failed, falling back to direct update:',rpcError?.message||rpcError);
          let up=await admin.from('tasks').update({status:normalizedStatus,completed_at:normalizedStatus==='completed'?new Date().toISOString():null}).eq('organization_id',organization.id).eq('id',body.task_id).select('*').single();
          if(up.error)up=await admin.from('tasks').update({status:normalizedStatus}).eq('organization_id',organization.id).eq('id',body.task_id).select('*').single();
          if(up.error){console.error('[tasks] direct status update failed:',up.error.message);const e=new Error(up.error.message);e.statusCode=500;e.publicMessage='Task status could not be saved: '+String(up.error.message||'').slice(0,160);throw e;}
          data=up.data;
          try{await admin.from('task_status_history').insert({organization_id:organization.id,task_id:body.task_id,to_status:normalizedStatus,changed_by:user.id,note:body.note||null});}catch(_e){}
        }
        return json(200,{ok:true,verified:true,task:data,status:normalizedStatus,persisted_at:new Date().toISOString()});
      }
      if(action==='create_task'){
        const admin=await requirePermission(user.id,organization.id,'tasks.write');
        const memberIds=Array.isArray(body.member_ids)?body.member_ids.filter(Boolean):[];
        let data=null,rpcError=null;
        try{const r=await client.rpc('create_staff_task',{target_org:organization.id,task_title:String(body.title||''),task_description:body.description||null,task_priority:body.priority||'normal',task_due_at:body.due_at||null,task_category:body.category||null,target_model:body.model_id||null,assigned_members:memberIds,task_visibility:body.visibility||'organization'});if(r.error)rpcError=r.error;else data=r.data;}catch(e){rpcError=e;}
        if(rpcError){
          console.warn('[tasks] create_staff_task failed, falling back to direct insert:',rpcError?.message||rpcError);
          const title=String(body.title||'').trim();if(!title)return json(400,{error:'title is required'});
          const base={organization_id:organization.id,title,description:body.description||null,priority:body.priority||'normal',due_at:body.due_at||null,category:body.category||null,model_id:body.model_id||null,status:'open'};
          let ins=await admin.from('tasks').insert({...base,created_by:user.id,visibility:body.visibility||'organization'}).select('*').single();
          if(ins.error)ins=await admin.from('tasks').insert(base).select('*').single();
          if(ins.error){console.error('[tasks] direct insert failed:',ins.error.message);const e=new Error(ins.error.message);e.statusCode=500;e.publicMessage='Task could not be created: '+String(ins.error.message||'').slice(0,160);throw e;}
          data=ins.data;
          if(memberIds.length){try{await admin.from('task_assignments').insert([...new Set(memberIds.map(String))].map(member_id=>({organization_id:organization.id,task_id:data.id,member_id,assignment_role:'assignee',assigned_by:user.id})));}catch(_e){}}
        }
        return json(200,{ok:true,verified:true,task:data,persisted_at:new Date().toISOString()});
      }
      if(action==='update_task'){
        const admin=await requirePermission(user.id,organization.id,'tasks.write');
        const taskId=String(body.task_id||'').trim();const title=String(body.title||'').trim();
        if(!taskId)return json(400,{error:'task_id is required'});if(!title)return json(400,{error:'title is required'});
        const normalizedStatus=body.status==null?null:(String(body.status||'').toLowerCase()==='done'?'completed':String(body.status||'').toLowerCase());
        if(normalizedStatus&&!['open','in_progress','completed','cancelled'].includes(normalizedStatus))return json(400,{error:'Unsupported task status'});
        const patch={title,description:body.description||null,priority:body.priority||'normal',due_at:body.due_at||null,category:body.category||null,model_id:body.model_id||null};if(normalizedStatus)patch.status=normalizedStatus;
        const {data:task,error}=await admin.from('tasks').update(patch).eq('organization_id',organization.id).eq('id',taskId).select('*').single();if(error)throw error;
        if(Array.isArray(body.member_ids)){
          const {error:de}=await admin.from('task_assignments').delete().eq('organization_id',organization.id).eq('task_id',taskId);if(de)throw de;
          const ids=[...new Set(body.member_ids.filter(Boolean).map(String))];if(ids.length){const payload=ids.map(member_id=>({organization_id:organization.id,task_id:taskId,member_id,assignment_role:'assignee',assigned_by:user.id}));const {error:ae}=await admin.from('task_assignments').insert(payload);if(ae)throw ae;}
        }
        return json(200,{ok:true,verified:true,task,persisted_at:new Date().toISOString()});
      }
      if(action==='add_comment'){
        const admin=await requirePermission(user.id,organization.id,'tasks.write');
        const taskId=String(body.task_id||'').trim(),text=String(body.body||'').trim().slice(0,4000);
        if(!taskId||!text)return json(400,{error:'task_id and comment text are required'});
        const {data:owned,error:ownErr}=await admin.from('tasks').select('id').eq('organization_id',organization.id).eq('id',taskId).maybeSingle();if(ownErr)throw ownErr;if(!owned)return json(404,{error:'Task not found'});
        const base={organization_id:organization.id,task_id:taskId};
        const variants=[{author_id:user.id,body:text},{user_id:user.id,body:text},{created_by:user.id,body:text},{author_id:user.id,comment:text},{author_user_id:user.id,body:text},{author_id:user.id,content:text},{body:text}];
        let saved=null,lastError=null;
        for(const v of variants){const {data,error}=await admin.from('task_comments').insert({...base,...v}).select('*').single();if(!error){saved=data;break;}lastError=error;if(!['42703','PGRST204','PGRST102','23502'].includes(String(error.code||'')))break;}
        if(!saved)return json(400,{error:'Comment could not be saved: '+(lastError?.message||'unknown error')});
        return json(200,{ok:true,verified:true,comment:saved,persisted_at:new Date().toISOString()});
      }
      if(action==='approval_decision'){
        const {data,error}=await client.rpc('decide_approval_request',{target_org:organization.id,target_request:body.request_id,target_status:body.status,decision_note_value:body.note||null});if(error)throw error;return json(200,{ok:true,verified:true,approval:data,persisted_at:new Date().toISOString()});
      }
      if(action==='create_approval'){
        await requirePermission(user.id,organization.id,'tasks.write');const title=String(body.title||'').trim();if(!title)return json(400,{error:'title is required'});
        const resourceId=body.resource_id||body.task_id;if(!resourceId)return json(400,{error:'resource_id is required'});
        const {data,error}=await client.rpc('create_approval_request_staff',{target_org:organization.id,request_type_value:body.request_type||'general',resource_type_value:body.resource_type||'task',resource_id_value:resourceId,request_title:title,request_details:body.details||{},assigned_member:body.assigned_member_id||null,expires_at_value:body.expires_at||null,note_value:body.note||null});if(error)throw error;
        return json(200,{ok:true,verified:true,approval:data,persisted_at:new Date().toISOString()});
      }
      return json(400,{error:'Unsupported task/approval action'});
    }
    const admin=await requirePermission(user.id,organization.id,'tasks.read');
    const [tasks,assignments,comments,dependencies,taskHistory,approvals,approvalHistory,members,models]=await Promise.all([
      rows(admin.from('tasks').select('*').eq('organization_id',organization.id).order('due_at',{ascending:true,nullsFirst:false}).limit(1000)),
      rows(admin.from('task_assignments').select('*').eq('organization_id',organization.id).limit(2500)),
      rows(admin.from('task_comments').select('*').eq('organization_id',organization.id).order('created_at',{ascending:false}).limit(1500)),
      rows(admin.from('task_dependencies').select('*').eq('organization_id',organization.id).limit(1500)),
      rows(admin.from('task_status_history').select('*').eq('organization_id',organization.id).order('created_at',{ascending:false}).limit(1500)),
      rows(admin.from('approval_requests').select('*').eq('organization_id',organization.id).order('requested_at',{ascending:false}).limit(1000)),
      rows(admin.from('approval_history').select('*').eq('organization_id',organization.id).order('created_at',{ascending:false}).limit(1500)),
      rows(admin.from('organization_members').select('id,user_id,job_title,status').eq('organization_id',organization.id).eq('member_type','staff')),
      rows(admin.from('models').select('id,display_name,public_slug').eq('organization_id',organization.id).eq('active',true).order('display_name'))
    ]);
    const profileUserIds=members.map(m=>m.user_id).filter(Boolean);
    const profiles=profileUserIds.length?await rows(admin.from('profiles').select('user_id,display_name,avatar_url').in('user_id',profileUserIds)):[];
    const profileMap=new Map(profiles.map(x=>[x.user_id,x]));const memberMap=new Map(members.map(x=>[x.id,{...x,profile:profileMap.get(x.user_id)||null}]));
    const canWrite=await assertPermission(admin,user.id,organization.id,'tasks.write');const canManage=await assertPermission(admin,user.id,organization.id,'tasks.manage');return json(200,{environment:'veux-saas-v10',organization,tasks:tasks.map(t=>({...t,assignments:assignments.filter(a=>a.task_id===t.id).map(a=>({...a,member:a.member_id?memberMap.get(a.member_id)||null:null})),comments:comments.filter(c=>c.task_id===t.id),dependencies:dependencies.filter(d=>d.task_id===t.id),history:taskHistory.filter(h=>h.task_id===t.id)})),approvals:approvals.map(a=>({...a,assigned_member:a.assigned_member_id?memberMap.get(a.assigned_member_id)||null:null,history:approvalHistory.filter(h=>h.approval_request_id===a.id)})),members:[...memberMap.values()],models,access:{write:canWrite,manage:canManage}});
  }catch(error){return errorResponse(error);}
};
