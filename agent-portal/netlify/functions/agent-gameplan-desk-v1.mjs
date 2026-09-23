import { requireUser, parseBody, json, errorResponse } from './_lib/auth.mjs';
import { requireStaffOrganization, requirePermission } from './_lib/agent-bridge.mjs';

async function rows(q){const {data,error}=await q;if(error)throw error;return data||[];}
async function one(q){const {data,error}=await q;if(error)throw error;return data||null;}

const TASK_TYPES=new Set(['agent','training','progress_submission','branding','testing','direct_booking','visa_travel','casting_show']);
function normTaskType(v){const k=String(v||'').trim().toLowerCase();return TASK_TYPES.has(k)?k:'agent';}
function cleanText(v){const s=String(v==null?'':v).trim();return s||null;}
function cleanDate(v){const s=String(v||'').trim();return /^\d{4}-\d{2}-\d{2}/.test(s)?s.slice(0,10):null;}

async function ensureLinkedDevelopmentPlan(admin,org,modelId,gameplan,userId){
  if(gameplan.development_plan_id){
    const existing=await one(admin.from('development_plans').select('*').eq('organization_id',org).eq('id',gameplan.development_plan_id).maybeSingle());
    if(existing)return existing;
  }
  const {data,error}=await admin.from('development_plans').insert({organization_id:org,model_id:modelId,title:gameplan.title||'Smart Gameplan',status:'active',starts_on:new Date().toISOString().slice(0,10),target_date:gameplan.key_date||null,summary:gameplan.brand_positioning||'Plan generated from Smart Gameplan.',metadata:{source:'smart_gameplan',gameplan_id:gameplan.id,created_by:userId}}).select('*').single();
  if(error)throw error;return data;
}

async function loadGameplanTasks(admin,org,gameplanId){
  const all=await rows(admin.from('tasks').select('*').eq('organization_id',org).order('due_at',{ascending:true}).limit(500));
  return all.filter(t=>t?.metadata&&t.metadata.gameplan_id===gameplanId);
}

export const handler=async(event)=>{
  if(!['GET','POST'].includes(event.httpMethod))return json(405,{error:'Method not allowed'});
  try{
    const {user,client}=await requireUser(event);
    const body=event.httpMethod==='POST'?parseBody(event):{};
    const p=event.queryStringParameters||{};
    const slug=body.organization_slug||p.organization||'maison-de-veux';
    const {organization}=await requireStaffOrganization({user,client,organizationSlug:slug});

    if(event.httpMethod==='POST'){
      const admin=await requirePermission(user.id,organization.id,'development.write');
      const action=String(body.action||'');

      if(action==='save_gameplan'){
        const modelId=String(body.model_id||'');if(!modelId)return json(400,{error:'model_id is required'});
        const {data:model,error:modelError}=await admin.from('models').select('id').eq('organization_id',organization.id).eq('id',modelId).maybeSingle();if(modelError)throw modelError;if(!model)return json(404,{error:'Model not found'});
        const payload={organization_id:organization.id,model_id:modelId,status:cleanText(body.status)||'active',title:cleanText(body.title),key_date:cleanDate(body.key_date),key_date_label:cleanText(body.key_date_label),welcome_message:cleanText(body.welcome_message),brand_positioning:cleanText(body.brand_positioning),market_focus:cleanText(body.market_focus),image_rules:cleanText(body.image_rules),risks:cleanText(body.risks),checkin_cadence:body.checkin_cadence&&typeof body.checkin_cadence==='object'?body.checkin_cadence:{},updated_at:new Date().toISOString()};
        const existing=await one(admin.from('model_gameplans').select('*').eq('organization_id',organization.id).eq('model_id',modelId).maybeSingle());
        let saved;
        if(existing){const {data,error}=await admin.from('model_gameplans').update(payload).eq('organization_id',organization.id).eq('id',existing.id).select('*').single();if(error)throw error;saved=data;}
        else{const {data,error}=await admin.from('model_gameplans').insert({...payload,created_by:user.id}).select('*').single();if(error)throw error;saved=data;}
        const plan=await ensureLinkedDevelopmentPlan(admin,organization.id,modelId,saved,user.id);
        if(saved.development_plan_id!==plan.id){const {data,error}=await admin.from('model_gameplans').update({development_plan_id:plan.id}).eq('organization_id',organization.id).eq('id',saved.id).select('*').single();if(error)throw error;saved=data;}
        return json(200,{ok:true,verified:true,gameplan:saved,development_plan:plan,persisted_at:saved.updated_at});
      }

      if(action==='archive_gameplan'){
        const gameplanId=String(body.gameplan_id||'');if(!gameplanId)return json(400,{error:'gameplan_id is required'});
        const {data,error}=await admin.from('model_gameplans').update({status:'archived',updated_at:new Date().toISOString()}).eq('organization_id',organization.id).eq('id',gameplanId).select('*').single();
        if(error)throw error;if(!data)return json(404,{error:'Gameplan not found'});
        return json(200,{ok:true,verified:true,gameplan:data,persisted_at:data.updated_at});
      }

      if(action==='create_task'){
        const gameplanId=String(body.gameplan_id||'');const modelId=String(body.model_id||'');const title=cleanText(body.title);
        if(!gameplanId||!modelId)return json(400,{error:'gameplan_id and model_id are required'});
        if(!title)return json(400,{error:'title is required'});
        const metadata={gameplan_id:gameplanId,task_type:normTaskType(body.task_type),is_hard_stop:!!body.is_hard_stop};
        const {data:task,error}=await admin.from('tasks').insert({organization_id:organization.id,model_id:modelId,title,description:cleanText(body.description),priority:body.is_hard_stop?'high':(cleanText(body.priority)||'normal'),due_at:body.due_at||null,category:metadata.task_type,status:'open',visibility:'organization',created_by:user.id,metadata}).select('*').single();
        if(error)throw error;
        const {error:assignError}=await admin.from('task_assignments').insert({organization_id:organization.id,task_id:task.id,model_id:modelId,assignment_role:'assignee',assigned_by:user.id});
        if(assignError&&assignError.code!=='23505')throw assignError;
        return json(201,{ok:true,verified:true,task,persisted_at:task.created_at||new Date().toISOString()});
      }

      if(action==='update_task'){
        const taskId=String(body.task_id||'');if(!taskId)return json(400,{error:'task_id is required'});
        const existing=await one(admin.from('tasks').select('*').eq('organization_id',organization.id).eq('id',taskId).maybeSingle());
        if(!existing)return json(404,{error:'Task not found'});
        const nextMeta={...(existing.metadata||{})};
        if(body.task_type!==undefined)nextMeta.task_type=normTaskType(body.task_type);
        if(body.is_hard_stop!==undefined)nextMeta.is_hard_stop=!!body.is_hard_stop;
        const patch={updated_at:new Date().toISOString(),metadata:nextMeta};
        if(body.title!==undefined){const t=cleanText(body.title);if(!t)return json(400,{error:'title is required'});patch.title=t;}
        if(body.description!==undefined)patch.description=cleanText(body.description);
        if(body.due_at!==undefined)patch.due_at=body.due_at||null;
        if(body.status!==undefined)patch.status=cleanText(body.status)||'open';
        if(body.priority!==undefined)patch.priority=cleanText(body.priority)||'normal';
        if(patch.status==='completed'&&!existing.completed_at)patch.completed_at=new Date().toISOString();
        const {data,error}=await admin.from('tasks').update(patch).eq('organization_id',organization.id).eq('id',taskId).select('*').single();
        if(error)throw error;
        return json(200,{ok:true,verified:true,task:data,persisted_at:data.updated_at||new Date().toISOString()});
      }

      if(action==='decide_reschedule'){
        const taskId=String(body.task_id||'');const decision=String(body.decision||'');
        if(!taskId||!['approve','deny'].includes(decision))return json(400,{error:'task_id and a decision of approve or deny are required'});
        const existing=await one(admin.from('tasks').select('*').eq('organization_id',organization.id).eq('id',taskId).maybeSingle());
        if(!existing)return json(404,{error:'Task not found'});
        const meta=existing.metadata||{};
        if(meta.reschedule_status!=='pending')return json(409,{error:'This task has no pending reschedule request'});
        const nextMeta={...meta,reschedule_status:null,reschedule_decided_at:new Date().toISOString(),reschedule_decided_by:user.id};
        const patch={metadata:nextMeta,updated_at:new Date().toISOString()};
        if(decision==='approve'&&meta.reschedule_requested_date)patch.due_at=meta.reschedule_requested_date;
        const {data,error}=await admin.from('tasks').update(patch).eq('organization_id',organization.id).eq('id',taskId).select('*').single();
        if(error)throw error;
        return json(200,{ok:true,verified:true,task:data,decision,persisted_at:data.updated_at});
      }

      return json(400,{error:'Unsupported gameplan action'});
    }

    const admin=await requirePermission(user.id,organization.id,'development.read');
    const modelId=p.model_id;if(!modelId)return json(400,{error:'model_id is required'});
    const gameplan=await one(admin.from('model_gameplans').select('*').eq('organization_id',organization.id).eq('model_id',modelId).maybeSingle());
    const [tasks,travel,visa,plan]=await Promise.all([
      gameplan?loadGameplanTasks(admin,organization.id,gameplan.id):Promise.resolve([]),
      rows(admin.from('travel_records').select('id,purpose,origin,destination,starts_at,ends_at,status').eq('organization_id',organization.id).eq('model_id',modelId).order('starts_at',{ascending:true}).limit(50)),
      rows(admin.from('visa_cases').select('id,country_code,visa_type,case_type,status,appointment_at,hard_deadline,consulate').eq('organization_id',organization.id).eq('model_id',modelId).order('hard_deadline',{ascending:true}).limit(50)),
      gameplan?.development_plan_id?one(admin.from('development_plans').select('*').eq('organization_id',organization.id).eq('id',gameplan.development_plan_id).maybeSingle()):Promise.resolve(null)
    ]);
    return json(200,{environment:'veux-saas-gameplan-v1',organization,model_id:modelId,gameplan,tasks,travel,visa,development_plan:plan});
  }catch(error){return errorResponse(error);}
};
