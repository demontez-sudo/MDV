import { requireUser, parseBody, json, errorResponse, assertPermission } from './_lib/auth.mjs';
import { requireStaffOrganization, requirePermission } from './_lib/agent-bridge.mjs';

async function rows(q){const {data,error}=await q;if(error)throw error;return data||[];}
async function optionalRows(q,label,warnings){try{return await rows(q);}catch(error){warnings.push({source:label,error:String(error?.message||error)});return [];}}

export const handler=async(event)=>{
  if(!['GET','POST'].includes(event.httpMethod))return json(405,{error:'Method not allowed'});
  try{
    const {user,client}=await requireUser(event),p=event.queryStringParameters||{},body=event.httpMethod==='POST'?parseBody(event):{};
    const {organization}=await requireStaffOrganization({user,client,organizationSlug:body.organization_slug||p.organization||'maison-de-veux'});
    if(event.httpMethod==='POST'){
      const action=String(body.action||'');
      // 16.15.05 compatibility: old active surfaces used mark_complete/complete/cancel and assignment actions.
      if(['mark_complete','complete','cancel','mark_in_progress'].includes(action)){
        body.status=action==='cancel'?'cancelled':action==='mark_in_progress'?'in_progress':'completed';
        body.action='task_status';
      }
      const normalizedAction=String(body.action||action||'').toLowerCase();
      if(normalizedAction==='assign' || normalizedAction==='bulk_assign'){
        const admin=await requirePermission(user.id,organization.id,'tasks.write');
        const ids=normalizedAction==='assign'?[body.task_id]:(Array.isArray(body.task_ids)?body.task_ids:[]);
        const memberId=body.member_id||body.assigned_member_id||null;
        if(!ids.length||!memberId)return json(400,{error:'Task and assignee are required'});
        for(const tid of ids){
          const {error:delErr}=await admin.from('task_assignments').delete().eq('organization_id',organization.id).eq('task_id',tid);
          if(delErr)throw delErr;
          const {error:insErr}=await admin.from('task_assignments').insert({organization_id:organization.id,task_id:tid,member_id:memberId,assigned_by:user.id});
          if(insErr)throw insErr;
        }
        return json(200,{ok:true,verified:true,task_ids:ids,member_id:memberId,persisted_at:new Date().toISOString()});
      }
      if(normalizedAction==='task_status'){
        body.action='task_status';

        const admin=await requirePermission(user.id,organization.id,'tasks.write');
        const normalizedStatus=String(body.status||'').toLowerCase()==='done'?'completed':String(body.status||'').toLowerCase();
        if(!['open','in_progress','blocked','waiting','completed','cancelled'].includes(normalizedStatus))return json(400,{error:'Unsupported task status'});
        const taskId=String(body.task_id||'').trim();if(!taskId)return json(400,{error:'task_id is required'});
        const {data,error}=await client.rpc('set_task_status_staff',{target_org:organization.id,target_task:taskId,target_status:normalizedStatus,note_value:body.note||null});
        if(!error)return json(200,{ok:true,verified:true,task:data,status:normalizedStatus,persisted_at:new Date().toISOString(),write_path:'rpc'});
        // Recovery path: permission has already been verified above. Keep Tasks usable if the RPC layer regresses.
        const patch={status:normalizedStatus,updated_at:new Date().toISOString(),completed_at:normalizedStatus==='completed'?new Date().toISOString():null};
        const {data:task,error:updateError}=await admin.from('tasks').update(patch).eq('organization_id',organization.id).eq('id',taskId).select('*').single();
        if(updateError)throw updateError;
        try{await admin.from('task_status_history').insert({organization_id:organization.id,task_id:taskId,from_status:null,to_status:normalizedStatus,changed_by:user.id,note:body.note||null});}catch(_e){}
        if(body.note){try{await admin.from('task_comments').insert({organization_id:organization.id,task_id:taskId,author_user_id:user.id,body:String(body.note),visibility:'organization'});}catch(_e){}}
        return json(200,{ok:true,verified:true,task,status:normalizedStatus,persisted_at:new Date().toISOString(),write_path:'verified_recovery',rpc_error:String(error.message||error)});
      }
      if(action==='create_task'){
        await requirePermission(user.id,organization.id,'tasks.write');const {data,error}=await client.rpc('create_staff_task',{target_org:organization.id,task_title:String(body.title||''),task_description:body.description||null,task_priority:body.priority||'normal',task_due_at:body.due_at||null,task_category:body.category||null,target_model:body.model_id||null,assigned_members:Array.isArray(body.member_ids)?body.member_ids:[],task_visibility:body.visibility||'organization'});if(error)throw error;return json(200,{ok:true,verified:true,task:data,persisted_at:new Date().toISOString()});
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
    const warnings=[];
    const tasks=await rows(admin.from('tasks').select('*').eq('organization_id',organization.id).order('due_at',{ascending:true,nullsFirst:false}).limit(1000));
    const [assignments,comments,dependencies,taskHistory,approvals,approvalHistory,members,models]=await Promise.all([
      optionalRows(admin.from('task_assignments').select('*').eq('organization_id',organization.id).limit(2500),'task_assignments',warnings),
      optionalRows(admin.from('task_comments').select('*').eq('organization_id',organization.id).order('created_at',{ascending:false}).limit(1500),'task_comments',warnings),
      optionalRows(admin.from('task_dependencies').select('*').eq('organization_id',organization.id).limit(1500),'task_dependencies',warnings),
      optionalRows(admin.from('task_status_history').select('*').eq('organization_id',organization.id).order('created_at',{ascending:false}).limit(1500),'task_status_history',warnings),
      optionalRows(admin.from('approval_requests').select('*').eq('organization_id',organization.id).order('requested_at',{ascending:false}).limit(1000),'approval_requests',warnings),
      optionalRows(admin.from('approval_history').select('*').eq('organization_id',organization.id).order('created_at',{ascending:false}).limit(1500),'approval_history',warnings),
      optionalRows(admin.from('organization_members').select('id,user_id,job_title,status').eq('organization_id',organization.id).eq('member_type','staff'),'organization_members',warnings),
      optionalRows(admin.from('models').select('id,display_name,public_slug').eq('organization_id',organization.id).eq('active',true).order('display_name'),'models',warnings)
    ]);
    const profileUserIds=members.map(m=>m.user_id).filter(Boolean);
    const profiles=profileUserIds.length?await optionalRows(admin.from('profiles').select('user_id,display_name,avatar_url').in('user_id',profileUserIds),'profiles',warnings):[];
    const profileMap=new Map(profiles.map(x=>[x.user_id,x]));const memberMap=new Map(members.map(x=>[x.id,{...x,profile:profileMap.get(x.user_id)||null}]));
    const canWrite=await assertPermission(admin,user.id,organization.id,'tasks.write');const canManage=await assertPermission(admin,user.id,organization.id,'tasks.manage');return json(200,{environment:'veux-saas-v10',organization,tasks:tasks.map(t=>({...t,assignments:assignments.filter(a=>a.task_id===t.id).map(a=>({...a,member:a.member_id?memberMap.get(a.member_id)||null:null})),comments:comments.filter(c=>c.task_id===t.id),dependencies:dependencies.filter(d=>d.task_id===t.id),history:taskHistory.filter(h=>h.task_id===t.id)})),approvals:approvals.map(a=>({...a,assigned_member:a.assigned_member_id?memberMap.get(a.assigned_member_id)||null:null,history:approvalHistory.filter(h=>h.approval_request_id===a.id)})),members:[...memberMap.values()],models,warnings,partial:warnings.length>0,access:{write:canWrite,manage:canManage}});
  }catch(error){return errorResponse(error);}
};
