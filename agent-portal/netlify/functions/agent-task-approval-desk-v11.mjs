import { requireUser, parseBody, json, errorResponse, assertPermission } from './_lib/auth.mjs';
import { notify } from './_lib/push.mjs';
import { newTask as newTaskCopy } from './_lib/push-copy.mjs';
import { requireStaffOrganization, requirePermission } from './_lib/agent-bridge.mjs';

// PostgREST returns at most 1000 rows per request, so page through with range() until exhausted.
async function allRows(build,max=10000){const out=[],width=4;for(let from=0;from<max;from+=1000*width){const pages=await Promise.all(Array.from({length:width},(_,i)=>build().range(from+i*1000,from+i*1000+999)));let done=false;for(const {data,error,status} of pages){if(error){if(status===416||String(error.code||'')==='PGRST103'){done=true;continue;}throw error;}const page=data||[];out.push(...page);if(page.length<1000)done=true;}if(done)break;}return out;}
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
        try{
          if(memberIds.length&&data){
            const {data:ms}=await admin.from('organization_members').select('user_id').in('id',memberIds);
            const ids=(ms||[]).map(m=>m.user_id).filter(x=>x&&x!==user.id);
            if(ids.length){const c=newTaskCopy({title:data.title||body.title,due:data.due_at?new Date(data.due_at).toLocaleDateString('en-US',{month:'short',day:'numeric'}):''});await notify(admin,{orgId:organization.id,userIds:ids,title:c.title,body:c.body,url:'?page=tasksconsolidated',category:'tasks',tag:'task-'+data.id,level:c.level,icon:c.icon});}
          }
        }catch(e){console.warn('[push] task alert skipped',e&&e.message||e);}
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
      if(action==='edit_task'){
        const admin=await requirePermission(user.id,organization.id,'tasks.write');
        const taskId=String(body.task_id||'').trim();if(!taskId)return json(400,{error:'task_id is required'});
        const patch={};
        if(body.title!=null){const t=String(body.title).replace(/\s+/g,' ').trim().slice(0,200);if(!t)return json(400,{error:'A task needs a title'});patch.title=t;}
        if(body.priority!=null){const pr=String(body.priority).toLowerCase();if(!['low','normal','high','urgent'].includes(pr))return json(400,{error:'Unsupported priority'});patch.priority=pr;}
        if(!Object.keys(patch).length)return json(400,{error:'Nothing to change'});
        const {data:task,error}=await admin.from('tasks').update(patch).eq('organization_id',organization.id).eq('id',taskId).select('*').single();if(error)throw error;
        return json(200,{ok:true,verified:!!task,task,persisted_at:new Date().toISOString()});
      }
      if(action==='move_task'){
        const admin=await requirePermission(user.id,organization.id,'tasks.write');
        const taskId=String(body.task_id||'').trim();if(!taskId)return json(400,{error:'task_id is required'});
        const when=new Date(String(body.due_at||''));if(!body.due_at||isNaN(when))return json(400,{error:'A valid due_at is required'});
        const {data:task,error}=await admin.from('tasks').update({due_at:when.toISOString()}).eq('organization_id',organization.id).eq('id',taskId).select('*').single();if(error)throw error;
        if(!task||Date.parse(task.due_at)!==when.getTime())return json(500,{error:'The task was not moved. Please try again.'});
        return json(200,{ok:true,verified:true,task,moved:true,persisted_at:new Date().toISOString()});
      }
      if(action==='bulk_update'){
        const admin=await requirePermission(user.id,organization.id,'tasks.write');
        const ids=[...new Set((Array.isArray(body.task_ids)?body.task_ids:[]).map(String).filter(Boolean))].slice(0,500);
        if(!ids.length)return json(400,{error:'task_ids is required'});
        const patch={};
        if(body.status!=null){const st=String(body.status).toLowerCase()==='done'?'completed':String(body.status).toLowerCase();if(!['open','in_progress','completed','cancelled'].includes(st))return json(400,{error:'Unsupported task status'});patch.status=st;}
        if(body.priority!=null){const pr=String(body.priority).toLowerCase();if(!['low','normal','high','urgent'].includes(pr))return json(400,{error:'Unsupported priority'});patch.priority=pr;}
        if(body.due_at!==undefined&&body.due_at!==null)patch.due_at=body.due_at;
        const addMembers=[...new Set((Array.isArray(body.member_ids_add)?body.member_ids_add:[]).filter(Boolean).map(String))];
        if(!Object.keys(patch).length&&!addMembers.length)return json(400,{error:'Nothing to update'});
        let updated=0;
        if(Object.keys(patch).length){
          const withDone=patch.status?{...patch,completed_at:patch.status==='completed'?new Date().toISOString():null}:patch;
          let up=await admin.from('tasks').update(withDone).eq('organization_id',organization.id).in('id',ids).select('id');
          if(up.error&&patch.status)up=await admin.from('tasks').update(patch).eq('organization_id',organization.id).in('id',ids).select('id');
          if(up.error){console.error('[tasks] bulk_update failed:',up.error.message);const e=new Error(up.error.message);e.statusCode=500;e.publicMessage='Bulk update failed: '+String(up.error.message||'').slice(0,160);throw e;}
          updated=(up.data||[]).length;
          if(patch.status){try{await admin.from('task_status_history').insert((up.data||[]).map(r=>({organization_id:organization.id,task_id:r.id,to_status:patch.status,changed_by:user.id,note:'Bulk update'})));}catch(_e){}}
        }
        if(addMembers.length){
          try{await admin.from('task_assignments').delete().eq('organization_id',organization.id).in('task_id',ids).in('member_id',addMembers);}catch(_e){}
          const rowsToAdd=ids.flatMap(task_id=>addMembers.map(member_id=>({organization_id:organization.id,task_id,member_id,assignment_role:'assignee',assigned_by:user.id})));
          const ins=await admin.from('task_assignments').insert(rowsToAdd);
          if(ins.error)throw ins.error;
          updated=Math.max(updated,ids.length);
        }
        return json(200,{ok:true,verified:true,updated,persisted_at:new Date().toISOString()});
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
    /* DaySilk only needs open tasks, who they are assigned to and the team: no comments, history or approvals. The full desk downloads
       every task with every column plus all of that, which can run past the function's time and 6 MB reply limits on a big list. */
    if((event.queryStringParameters||{}).view==='open'){
      const DONE=/^(completed|done|complete|cancelled|canceled)$/i;
      /* skip finished tasks in the database when the status column allows it; fall back to filtering here if it does not */
      let tasks;
      try{tasks=await allRows(()=>admin.from('tasks').select('*').eq('organization_id',organization.id).not('status','in','(completed,done,complete,cancelled,canceled)').order('due_at',{ascending:true,nullsFirst:false}).order('id'),8000);}
      catch(_e){tasks=await allRows(()=>admin.from('tasks').select('*').eq('organization_id',organization.id).order('due_at',{ascending:true,nullsFirst:false}).order('id'),8000);}
      tasks=tasks.filter(t=>!DONE.test(String(t.status||'open')));
      const [assignments,members,models]=await Promise.all([
        allRows(()=>admin.from('task_assignments').select('task_id,member_id').eq('organization_id',organization.id).order('id'),20000),
        rows(admin.from('organization_members').select('id,user_id,job_title,status').eq('organization_id',organization.id).eq('member_type','staff')),
        rows(admin.from('models').select('id,display_name,public_slug').eq('organization_id',organization.id).eq('active',true).order('display_name'))
      ]);
      const open=new Set(tasks.map(t=>t.id)),by=new Map();
      for(const a of assignments){if(!open.has(a.task_id))continue;const l=by.get(a.task_id);if(l)l.push(a);else by.set(a.task_id,[a]);}
      const out={environment:'veux-saas-v10',view:'open',organization,tasks:tasks.map(t=>({...t,assignments:by.get(t.id)||[]})),members,models};
      return json(200,out);
    }
    const [tasks,assignments,comments,dependencies,taskHistory,approvals,approvalHistory,members,models]=await Promise.all([
      allRows(()=>admin.from('tasks').select('*').eq('organization_id',organization.id).order('due_at',{ascending:true,nullsFirst:false}).order('id'),8000),
      allRows(()=>admin.from('task_assignments').select('*').eq('organization_id',organization.id).order('id'),20000),
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
    const canWrite=await assertPermission(admin,user.id,organization.id,'tasks.write');const canManage=await assertPermission(admin,user.id,organization.id,'tasks.manage');
    // Group once by task id (a single pass) instead of re-scanning every list for every task.
    const group=(list,key)=>{const m=new Map();for(const x of list){const k=x[key];if(k==null)continue;const a=m.get(k);if(a)a.push(x);else m.set(k,[x]);}return m;};
    const assignBy=group(assignments,'task_id'),commentBy=group(comments,'task_id'),depBy=group(dependencies,'task_id'),histBy=group(taskHistory,'task_id'),apprHistBy=group(approvalHistory,'approval_request_id');
    const build=(histLimit,commentLimit=Infinity,keep=null)=>({environment:'veux-saas-v10',organization,
      tasks:(keep?tasks.filter(keep):tasks).map(t=>({...t,assignments:(assignBy.get(t.id)||[]).map(a=>({...a,member:a.member_id?memberMap.get(a.member_id)||null:null})),comments:(commentBy.get(t.id)||[]).slice(0,commentLimit),dependencies:depBy.get(t.id)||[],history:(histBy.get(t.id)||[]).slice(0,histLimit)})),
      approvals:approvals.map(a=>({...a,assigned_member:a.assigned_member_id?memberMap.get(a.assigned_member_id)||null:null,history:(apprHistBy.get(a.id)||[]).slice(0,histLimit)})),
      members:[...memberMap.values()],models,access:{write:canWrite,manage:canManage}});
    // Netlify answers 502 when a function reply is over about 6 MB, so trim the history if the list is that large.
    const LIMIT=5200000,DONE=/^(completed|done|complete|cancelled|canceled)$/i,cutoff=Date.now()-45*864e5;
    let out=build(50),size=JSON.stringify(out).length,stage='full';
    if(size>LIMIT){out=build(3);size=JSON.stringify(out).length;stage='history trimmed';}
    if(size>LIMIT){out=build(0,2);size=JSON.stringify(out).length;stage='history dropped, comments trimmed';}
    /* still too big: leave out finished tasks that were last touched more than 45 days ago */
    if(size>LIMIT){out=build(0,2,t=>!DONE.test(String(t.status||'open'))||new Date(t.updated_at||t.due_at||0).getTime()>cutoff);size=JSON.stringify(out).length;stage='old finished tasks left out';}
    console.log('[tasks v11] '+stage+': '+tasks.length+' tasks, '+Math.round(size/1024)+' KB');
    return json(200,out);
  }catch(error){return errorResponse(error);}
};
