import { requireUser, json, errorResponse } from './_lib/auth.mjs';
import { requireModelPortal } from './_lib/portal-bridge.mjs';

async function safe(label,q,warnings){
  try{const {data,error}=await q;if(error)throw error;return data||[];}
  catch(error){warnings.push({source:label,message:error?.message||'Unavailable'});return [];}
}

export const handler=async event=>{
  if(event.httpMethod!=='GET')return json(405,{error:'Method not allowed'},{Allow:'GET'});
  try{
    const {user}=await requireUser(event);
    const p=event.queryStringParameters||{};
    const slug=p.organization||p.organization_slug||'maison-de-veux';
    const {admin,organization,modelId}=await requireModelPortal({user,organizationSlug:slug});
    const warnings=[];

    const gameplan=await admin.from('model_gameplans').select('id,status,title,key_date,key_date_label,welcome_message,brand_positioning,market_focus,image_rules,checkin_cadence,development_plan_id,updated_at').eq('organization_id',organization.id).eq('model_id',modelId).eq('status','active').maybeSingle().then(r=>r.data||null).catch(()=>null);

    const [allTasks,travel,visa,publicProfile,orgSettings]=await Promise.all([
      safe('tasks',admin.from('tasks').select('*').eq('organization_id',organization.id).eq('model_id',modelId).order('due_at',{ascending:true}).limit(500),warnings),
      safe('travel_records',admin.from('travel_records').select('id,purpose,origin,destination,starts_at,ends_at,status').eq('organization_id',organization.id).eq('model_id',modelId).order('starts_at',{ascending:true}),warnings),
      safe('visa_cases',admin.from('visa_cases').select('id,country_code,visa_type,case_type,status,appointment_at,hard_deadline,consulate').eq('organization_id',organization.id).eq('model_id',modelId).order('hard_deadline',{ascending:true}),warnings),
      admin.from('model_public_profiles').select('show_agent_contact,contact_name,contact_email,contact_phone').eq('organization_id',organization.id).eq('model_id',modelId).maybeSingle().then(r=>r.data||null).catch(()=>null),
      admin.from('organization_settings').select('sender_name,sender_email,settings').eq('organization_id',organization.id).maybeSingle().then(r=>r.data||null).catch(()=>null)
    ]);

    const tasks=gameplan?allTasks.filter(t=>t?.metadata&&t.metadata.gameplan_id===gameplan.id).map(t=>({id:t.id,title:t.title,description:t.description,due_at:t.due_at,status:t.status,priority:t.priority,completed_at:t.completed_at,task_type:t.metadata?.task_type||'agent',is_hard_stop:!!t.metadata?.is_hard_stop,reschedule_status:t.metadata?.reschedule_status||null,reschedule_requested_date:t.metadata?.reschedule_requested_date||null})):[];

    const agentContact=publicProfile&&publicProfile.show_agent_contact===false?null:{
      name:publicProfile?.contact_name||orgSettings?.sender_name||organization.name||'Maison de Veux',
      email:publicProfile?.contact_email||orgSettings?.sender_email||null,
      phone:publicProfile?.contact_phone||orgSettings?.settings?.agency_phone||null
    };

    return json(200,{ok:true,verified:true,organization:{id:organization.id,name:organization.name,slug:organization.slug},gameplan,tasks,mobility:{travel,visa_cases:visa},agent_contact:agentContact,warnings});
  }catch(error){return errorResponse(error);}
};
