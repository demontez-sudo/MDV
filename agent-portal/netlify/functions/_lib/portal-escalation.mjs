import { adminClient } from './auth.mjs';

const ACK_TYPES=['booking_shared_state','mobility_shared_state','document_shared_state'];
const ACTIVE_PLACEMENT=['active','pending','placed'];
const SEVERITY={critical:0,high:1,watch:2,normal:3};
const arr=v=>Array.isArray(v)?v:[];
const uniq=a=>[...new Set(a.filter(Boolean))];
const key=(org,id)=>`${org}:${id}`;
const msDay=86400000;

async function rows(q){const {data,error}=await q;if(error)throw error;return data||[];}
function daysUntil(v,now=Date.now()){if(!v)return null;const t=new Date(v).getTime();if(!Number.isFinite(t))return null;return Math.ceil((t-now)/msDay);}
function hoursSince(v,now=Date.now()){const t=new Date(v).getTime();if(!Number.isFinite(t))return 0;return Math.max(0,(now-t)/3600000);}
function severityFor(n,source,now=Date.now()){
  const age=hoursSince(n.created_at,now);
  let due=null,reason='Portal acknowledgement pending';
  if(n.source_type==='booking'){
    due=source?.call_time||source?.starts_at||null;const d=daysUntil(due,now);
    if(d!=null&&d<=1)return {severity:'critical',due_at:due,reason:d<0?'Booking/call time passed without acknowledgement':'Booking/call time within 24 hours'};
    if(d!=null&&d<=2)return {severity:'high',due_at:due,reason:'Booking/call time within 48 hours'};
  }
  if(n.source_type==='visa'){
    due=source?.hard_deadline||source?.appointment_at||source?.expires_on||null;const d=daysUntil(due,now);
    if(d!=null&&d<=3)return {severity:'critical',due_at:due,reason:d<0?'Visa deadline overdue':'Visa deadline within 3 days'};
    if(d!=null&&d<=7)return {severity:'high',due_at:due,reason:'Visa deadline within 7 days'};
  }
  if(n.source_type==='travel'){
    due=source?.starts_at||null;const d=daysUntil(due,now);
    if(d!=null&&d<=1)return {severity:'critical',due_at:due,reason:d<0?'Travel start passed without acknowledgement':'Travel begins within 24 hours'};
    if(d!=null&&d<=3)return {severity:'high',due_at:due,reason:'Travel begins within 3 days'};
  }
  if(n.source_type==='work_authorization'||n.source_type==='passport'){
    due=source?.expires_on||null;const d=daysUntil(due,now);
    if(d!=null&&d<=7)return {severity:'critical',due_at:due,reason:'Work authorization/passport expiry within 7 days'};
    if(d!=null&&d<=30)return {severity:'high',due_at:due,reason:'Work authorization/passport expiry within 30 days'};
  }
  if(n.source_type==='document'){
    if(age>=48)return {severity:'high',due_at:null,reason:'Operational document unacknowledged for 48+ hours'};
  }
  if(age>=36)return {severity:'high',due_at:due,reason:'Portal acknowledgement overdue 36+ hours'};
  if(age>=18)return {severity:'watch',due_at:due,reason:'Portal acknowledgement pending 18+ hours'};
  return {severity:'normal',due_at:due,reason};
}

async function sourceMaps(admin,notifications){
  const idsByType={};for(const n of notifications){(idsByType[n.source_type]||(idsByType[n.source_type]=[])).push(n.source_id);}
  const maps={};
  const specs={booking:['bookings','id,organization_id,assigned_member_id,title,call_time,starts_at'],visa:['visa_cases','id,organization_id,assigned_member_id,model_id,country_code,hard_deadline,appointment_at,expires_on'],travel:['travel_records','id,organization_id,assigned_member_id,model_id,destination,starts_at,ends_at'],work_authorization:['work_authorizations','id,organization_id,model_id,country_code,expires_on'],passport:['passports','id,organization_id,model_id,country_code,expires_on'],document:['documents','id,organization_id,name,category,created_at']};
  for(const [type,[table,select]] of Object.entries(specs)){
    const ids=uniq(idsByType[type]||[]);if(!ids.length){maps[type]=new Map();continue;}
    let data=[];try{data=await rows(admin.from(table).select(select).in('id',ids));}catch{data=[];}
    maps[type]=new Map(data.map(x=>[key(x.organization_id,x.id),x]));
  }
  return maps;
}

async function recipientMaps(admin,notifications){
  const userIds=uniq(notifications.map(x=>x.user_id));
  const modelLinks=userIds.length?await rows(admin.from('model_user_links').select('organization_id,user_id,model_id').in('user_id',userIds)):[];
  const partnerLinks=userIds.length?await rows(admin.from('partner_user_links').select('organization_id,user_id,partner_agency_id').in('user_id',userIds)):[];
  const modelIds=uniq(modelLinks.map(x=>x.model_id).concat(notifications.map(x=>x.metadata?.model_id)));
  const partnerIds=uniq(partnerLinks.map(x=>x.partner_agency_id));
  const models=modelIds.length?await rows(admin.from('models').select('id,organization_id,display_name').in('id',modelIds)):[];
  const partners=partnerIds.length?await rows(admin.from('partner_agencies').select('id,organization_id,company_id').in('id',partnerIds)):[];
  const companyIds=uniq(partners.map(x=>x.company_id));
  const companies=companyIds.length?await rows(admin.from('companies').select('id,organization_id,name').in('id',companyIds)):[];
  const modelById=new Map(models.map(x=>[key(x.organization_id,x.id),x]));
  const modelByUser=new Map(modelLinks.map(x=>[key(x.organization_id,x.user_id),modelById.get(key(x.organization_id,x.model_id))||{id:x.model_id}]));
  const companyById=new Map(companies.map(x=>[key(x.organization_id,x.id),x]));
  const partnerById=new Map(partners.map(x=>[key(x.organization_id,x.id),{...x,company:companyById.get(key(x.organization_id,x.company_id))||null}]));
  const partnerByUser=new Map(partnerLinks.map(x=>[key(x.organization_id,x.user_id),partnerById.get(key(x.organization_id,x.partner_agency_id))||{id:x.partner_agency_id}]));
  return {modelById,modelByUser,partnerByUser};
}

export async function collectPortalEscalations({organizationId=null,limit=800,admin=adminClient()}={}){
  let q=admin.from('notifications').select('id,organization_id,user_id,notification_type,title,body,status,source_type,source_id,action_url,metadata,created_at,read_at').in('notification_type',ACK_TYPES).order('created_at',{ascending:false}).limit(limit);
  if(organizationId)q=q.eq('organization_id',organizationId);
  const notifications=(await rows(q)).filter(n=>n.metadata?.requires_ack!==false&&!n.metadata?.acknowledged_at&&n.source_id);
  const [sources,recipients]=await Promise.all([sourceMaps(admin,notifications),recipientMaps(admin,notifications)]);
  const items=notifications.map(n=>{
    const source=sources[n.source_type]?.get(key(n.organization_id,n.source_id))||null;
    const model=recipients.modelByUser.get(key(n.organization_id,n.user_id))||recipients.modelById.get(key(n.organization_id,n.metadata?.model_id))||null;
    const partner=recipients.partnerByUser.get(key(n.organization_id,n.user_id))||null;
    const recipient_kind=partner?'mother_agency':model?'model':'portal_user';
    const recipient_name=partner?.company?.name||model?.display_name||'Portal user';
    const urgency=severityFor(n,source);
    return {...n,source,model,partner,recipient_kind,recipient_name,...urgency,escalated:!!n.metadata?.escalated_at,escalated_at:n.metadata?.escalated_at||null,escalation_task_id:n.metadata?.escalation_task_id||null};
  }).filter(x=>x.severity!=='normal' || x.escalated);
  items.sort((a,b)=>(SEVERITY[a.severity]??9)-(SEVERITY[b.severity]??9)||String(a.due_at||a.created_at).localeCompare(String(b.due_at||b.created_at)));
  return items;
}

function fallbackMember(members,orgId,sourceType){
  const inOrg=members.filter(x=>x.organization_id===orgId&&x.status==='active');
  const mobility=/visa|travel|passport|work_authorization/.test(sourceType);
  const patterns=mobility?[/travel/i,/visa/i,/mobility/i,/founder/i,/head booker/i,/director/i]:[/head booker/i,/booker/i,/founder/i,/director/i];
  for(const re of patterns){const hit=inOrg.find(x=>re.test(String(x.job_title||'')));if(hit)return hit;}return inOrg[0]||null;
}

export async function createEscalationTask(admin,item,{actorUserId=null}={}){
  const members=await rows(admin.from('organization_members').select('id,organization_id,user_id,job_title,status').eq('organization_id',item.organization_id).eq('member_type','staff'));
  let member=item.source?.assigned_member_id?members.find(x=>x.id===item.source.assigned_member_id):null;
  if(!member)member=fallbackMember(members,item.organization_id,item.source_type);
  const legacyId=`portal-escalation:${item.id}`;
  const due=new Date(Date.now()+(item.severity==='critical'?4:12)*3600000).toISOString();
  const payload={organization_id:item.organization_id,legacy_id:legacyId,title:`${item.severity==='critical'?'CRITICAL':'ESCALATION'} · ${item.title||'Portal acknowledgement'}`,description:[item.reason,item.recipient_name,item.body].filter(Boolean).join('\n'),status:'open',priority:item.severity==='critical'?'critical':'urgent',due_at:due,category:'portal_escalation',model_id:item.model?.id||item.metadata?.model_id||null,visibility:'organization',source:'portal_escalation',created_by:actorUserId||member?.user_id||null,metadata:{source_notification_id:item.id,source_type:item.source_type,source_id:item.source_id,recipient_kind:item.recipient_kind,recipient_name:item.recipient_name,auto_escalation:true}};
  const {data:task,error}=await admin.from('tasks').upsert(payload,{onConflict:'organization_id,legacy_id'}).select('*').single();if(error)throw error;
  if(member){await admin.from('task_assignments').delete().eq('organization_id',item.organization_id).eq('task_id',task.id);const {error:ae}=await admin.from('task_assignments').insert({organization_id:item.organization_id,task_id:task.id,member_id:member.id,assignment_role:'assignee',assigned_by:actorUserId||member.user_id||null});if(ae)throw ae;}
  const meta={...(item.metadata||{}),escalated_at:item.escalated_at||new Date().toISOString(),escalation_task_id:task.id,escalation_severity:item.severity,escalated_to_member_id:member?.id||null};
  const {error:ne}=await admin.from('notifications').update({metadata:meta}).eq('organization_id',item.organization_id).eq('id',item.id);if(ne)throw ne;
  return {task,member};
}

export async function runAutomaticEscalation({admin=adminClient(),limit=800}={}){
  const items=await collectPortalEscalations({admin,limit});
  const eligible=items.filter(x=>!x.escalated&&(x.severity==='critical'||x.severity==='high'));
  const results=[];for(const item of eligible){try{results.push({notification_id:item.id,ok:true,...await createEscalationTask(admin,item)});}catch(error){results.push({notification_id:item.id,ok:false,error:error.message});}}
  return {scanned:items.length,eligible:eligible.length,created:results.filter(x=>x.ok).length,failed:results.filter(x=>!x.ok).length,results};
}
