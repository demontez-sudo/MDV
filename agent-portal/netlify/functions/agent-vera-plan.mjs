import { requireUser, adminClient, assertPermission, json, errorResponse, parseBody } from './_lib/auth.mjs';
import { requireStaffOrganization } from './_lib/agent-bridge.mjs';
import { callVeuxAI, parseJsonLoose } from './_lib/ai-providers.mjs';
function clean(v,n=1000){return String(v??'').trim().slice(0,n)}
function rows(q){return q.then(({data,error})=>{if(error)throw error;return data||[]})}
export const handler=async(event)=>{
 if(event.httpMethod!=='POST')return json(405,{error:'Method not allowed'});
 try{
  const {user,client}=await requireUser(event),body=parseBody(event);
  const {organization}=await requireStaffOrganization({user,client,organizationId:body.organization_id,organizationSlug:body.organization_slug||'maison-de-veux'});
  const admin=adminClient();if(!await assertPermission(admin,user.id,organization.id,'ai.use'))return json(403,{error:'You do not have permission to use Vera Intelligence'});
  let objective=clean(body.objective||body.query,700);
  if(body.resume===true&&!objective){
    const jobs=await rows(admin.from('ai_jobs').select('id,input,result,completed_at').eq('organization_id',organization.id).eq('requested_by',user.id).eq('job_type','report').eq('status','complete').order('completed_at',{ascending:false}).limit(40));
    const active=jobs.find(j=>String(j?.input?.compat||'').includes('vera-objective')&&j?.input?.objective_status!=='completed');
    if(active)return json(200,{ok:true,resumed:true,objective_id:active.id,objective:active.input.objective,plan:active.result?.plan||[],summary:active.result?.summary||'',next_step:active.result?.next_step||null});
  }
  if(!objective)return json(400,{error:'Vera needs an objective to plan.'});
  const modelId=clean(body.model_id,100)||null,companyId=clean(body.company_id,100)||null,contactId=clean(body.contact_id,100)||null;
  const [model,tasks,visas,travel,castings,bookings]=await Promise.all([
   modelId?admin.from('models').select('id,display_name,stage,status,location,primary_market_label').eq('organization_id',organization.id).eq('id',modelId).maybeSingle().then(x=>{if(x.error)throw x.error;return x.data}):null,
   rows(admin.from('tasks').select('id,title,status,priority,due_at,category,model_id').eq('organization_id',organization.id).not('status','in','("completed","cancelled")').order('due_at',{ascending:true,nullsFirst:false}).limit(80)),
   rows(admin.from('visa_cases').select('id,model_id,country_code,visa_type,status,appointment_at,hard_deadline,expires_on').eq('organization_id',organization.id).order('created_at',{ascending:false}).limit(60)),
   rows(admin.from('travel_records').select('id,model_id,purpose,origin,destination,starts_at,ends_at,status').eq('organization_id',organization.id).order('starts_at',{ascending:true,nullsFirst:false}).limit(60)),
   rows(admin.from('castings').select('id,title,status,starts_at,ends_at,location,company_id').eq('organization_id',organization.id).order('starts_at',{ascending:true,nullsFirst:false}).limit(80)),
   rows(admin.from('bookings').select('id,title,status,starts_at,ends_at,location,company_id').eq('organization_id',organization.id).order('starts_at',{ascending:true,nullsFirst:false}).limit(80))
  ]);
  const context={model,tasks:modelId?tasks.filter(x=>!x.model_id||x.model_id===modelId):tasks,visa_cases:modelId?visas.filter(x=>x.model_id===modelId):visas,travel:modelId?travel.filter(x=>x.model_id===modelId):travel,castings,bookings,company_id:companyId,contact_id:contactId,current_time:new Date().toISOString()};
  const instructions=`You are Vera Planning Intelligence for CAVYRE. Convert an agency objective into an executable, ordered plan grounded only in supplied CAVYRE context.
Return ONLY JSON: {"summary":"","plan":[{"step":1,"title":"","purpose":"","action_type":"analyze|research|create_task|schedule_event|create_company|create_contact|create_casting|save_visa|save_travel|draft_communication|submit_model|other","permission":"GREEN|YELLOW|RED","status":"ready|blocked|needs_information","depends_on":[],"required_information":[],"suggested_input":{}}],"next_step":1,"risks":[],"success_criteria":[]}
GREEN is read/research/analyze. YELLOW changes internal CAVYRE records and requires approval. RED sends/submits/deletes/finance/cancels and requires explicit approval; Vera must never auto-execute RED.
Do not invent dates, contacts, model ids, travel or visa status. Mark missing information as blocked/needs_information.`;
  const ai=await callVeuxAI({instructions,input:JSON.stringify({objective,context})});const parsed=parseJsonLoose(ai.text);
  if(!parsed||!Array.isArray(parsed.plan))return json(502,{error:'Vera planning returned an unreadable plan.'});
  const result={summary:clean(parsed.summary,1800),plan:parsed.plan.slice(0,20),next_step:parsed.next_step||1,risks:Array.isArray(parsed.risks)?parsed.risks.slice(0,12):[],success_criteria:Array.isArray(parsed.success_criteria)?parsed.success_criteria.slice(0,12):[]};
  const now=new Date().toISOString();const {data:job,error}=await admin.from('ai_jobs').insert({organization_id:organization.id,job_type:'report',status:'complete',requested_by:user.id,model_id:modelId,input:{compat:'vera-objective-16.11.84',objective,objective_status:'active',model_id:modelId,company_id:companyId,contact_id:contactId},result,provider:ai.provider,provider_model:ai.model,started_at:now,completed_at:now}).select('id').single();if(error)throw error;
  return json(200,{ok:true,verified_plan:true,objective_id:job.id,objective,...result});
 }catch(e){return errorResponse(e)}
};