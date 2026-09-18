import { requireUser, adminClient, assertPermission, json, errorResponse } from './_lib/auth.mjs';
import { requireStaffOrganization } from './_lib/agent-bridge.mjs';
function rows(q){return q.then(({data,error})=>{if(error)throw error;return data||[]})}
function ts(v){const n=Date.parse(v||'');return Number.isFinite(n)?n:null}
function isoDay(n){return new Date(n).toISOString()}
export const handler=async(event)=>{
 if(event.httpMethod!=='GET')return json(405,{error:'Method not allowed'});
 try{
  const {user,client}=await requireUser(event),q=event.queryStringParameters||{};
  const {organization}=await requireStaffOrganization({user,client,organizationSlug:q.organization||'maison-de-veux'});
  const admin=adminClient();if(!await assertPermission(admin,user.id,organization.id,'ai.use'))return json(403,{error:'You do not have permission to use Vera Intelligence'});
  const now=Date.now(),next7=now+7*86400000,next14=now+14*86400000;
  const [models,tasks,visas,travel,castings,bookings,events,companies,contacts]=await Promise.all([
   rows(admin.from('models').select('id,display_name,status,stage,location,primary_market_label').eq('organization_id',organization.id).limit(400)),
   rows(admin.from('tasks').select('id,title,status,priority,due_at,category,model_id,description').eq('organization_id',organization.id).not('status','in','("completed","cancelled")').order('due_at',{ascending:true,nullsFirst:false}).limit(160)),
   rows(admin.from('visa_cases').select('id,model_id,country_code,visa_type,status,appointment_at,hard_deadline,expires_on').eq('organization_id',organization.id).order('created_at',{ascending:false}).limit(100)),
   rows(admin.from('travel_records').select('id,model_id,purpose,origin,destination,starts_at,ends_at,status').eq('organization_id',organization.id).order('starts_at',{ascending:true,nullsFirst:false}).limit(100)),
   rows(admin.from('castings').select('id,title,status,starts_at,ends_at,location,company_id').eq('organization_id',organization.id).order('starts_at',{ascending:true,nullsFirst:false}).limit(120)),
   rows(admin.from('bookings').select('id,title,status,starts_at,ends_at,location,company_id').eq('organization_id',organization.id).order('starts_at',{ascending:true,nullsFirst:false}).limit(120)),
   rows(admin.from('calendar_events').select('id,title,status,starts_at,ends_at,event_type,location').eq('organization_id',organization.id).gte('ends_at',isoDay(now-86400000)).lte('starts_at',isoDay(next14)).order('starts_at').limit(180)),
   rows(admin.from('companies').select('id,name,company_type,status,tier').eq('organization_id',organization.id).limit(300)),
   rows(admin.from('contacts').select('id,display_name,role,company_id,status,market').eq('organization_id',organization.id).limit(400))
  ]);
  const names=new Map(models.map(m=>[m.id,m.display_name]));
  const alerts=[],opportunities=[];
  for(const t of tasks){const due=ts(t.due_at);if(due&&due<now)alerts.push({severity:'high',type:'overdue_task',title:t.title,detail:`Overdue${t.model_id&&names.get(t.model_id)?' · '+names.get(t.model_id):''}`,entity_id:t.model_id||t.id,action:'Open Tasks'});else if(due&&due<=next7)alerts.push({severity:t.priority==='urgent'||t.priority==='high'?'high':'medium',type:'task_due',title:t.title,detail:`Due within 7 days${t.model_id&&names.get(t.model_id)?' · '+names.get(t.model_id):''}`,entity_id:t.model_id||t.id,action:'Review Task'})}
  for(const v of visas){const deadline=ts(v.hard_deadline),appt=ts(v.appointment_at);if(deadline&&deadline<=next14&&deadline>=now&& !/approved|completed/i.test(v.status||''))alerts.push({severity:'high',type:'visa_deadline',title:`Visa deadline · ${names.get(v.model_id)||'Model'}`,detail:`${v.country_code||''} ${v.visa_type||''} · ${v.status||'open'}`.trim(),entity_id:v.model_id,action:'Open Mobility'});if(appt&&appt<=next7&&appt>=now)alerts.push({severity:'medium',type:'visa_appointment',title:`Visa appointment · ${names.get(v.model_id)||'Model'}`,detail:new Date(appt).toLocaleDateString('en-US'),entity_id:v.model_id,action:'Review Documents'})}
  for(const tr of travel){const st=ts(tr.starts_at);if(st&&st>=now&&st<=next7)alerts.push({severity:'medium',type:'movement',title:`Model movement · ${names.get(tr.model_id)||'Model'}`,detail:`${tr.origin||'—'} → ${tr.destination||'—'} · ${tr.status||'planned'}`,entity_id:tr.model_id,action:'Open Travel'})}
  for(const c of castings){const st=ts(c.starts_at);if(st&&st>=now&&st<=next7)opportunities.push({type:'casting',title:c.title,detail:`${c.location||'Location pending'} · ${c.status||'open'}`,entity_id:c.id,action:'Review Casting'})}
  for(const b of bookings){const st=ts(b.starts_at);if(st&&st>=now&&st<=next7)opportunities.push({type:'booking',title:b.title,detail:`${b.location||'Location pending'} · ${b.status||'open'}`,entity_id:b.id,action:'Review Booking'})}
  // Deterministic overlap detection for loaded calendar events.
  const sorted=events.filter(x=>ts(x.starts_at)&&ts(x.ends_at)).sort((a,b)=>ts(a.starts_at)-ts(b.starts_at));
  for(let i=0;i<sorted.length;i++)for(let j=i+1;j<sorted.length&&ts(sorted[j].starts_at)<ts(sorted[i].ends_at);j++){alerts.push({severity:'medium',type:'calendar_overlap',title:'Calendar overlap',detail:`${sorted[i].title} ↔ ${sorted[j].title}`,entity_id:sorted[i].id,action:'Open Calendar'});if(alerts.filter(x=>x.type==='calendar_overlap').length>=8)break}
  const high=alerts.filter(x=>x.severity==='high').length;
  return json(200,{ok:true,generated_at:new Date().toISOString(),summary:{needs_attention:alerts.length,high_priority:high,models_moving:travel.filter(x=>{const st=ts(x.starts_at);return st&&st>=now&&st<=next7}).length,upcoming_castings:opportunities.filter(x=>x.type==='casting').length,upcoming_bookings:opportunities.filter(x=>x.type==='booking').length,open_tasks:tasks.length,active_models:models.filter(x=>!x.status||/active|development|available/i.test(x.status)).length},alerts:alerts.slice(0,30),opportunities:opportunities.slice(0,24),relationship_snapshot:{companies:companies.length,contacts:contacts.length},source:'cavyre_live_data'});
 }catch(e){return errorResponse(e)}
};