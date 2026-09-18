import { requireUser, parseBody, json, errorResponse } from './_lib/auth.mjs';
import { requireStaffOrganization, requirePermission } from './_lib/agent-bridge.mjs';

async function rows(q){const {data,error}=await q;if(error)throw error;return data||[];}
async function safeRows(q,errors,label){try{return await rows(q)}catch(error){if(errors)errors.push({source:label||'query',message:error?.message||String(error),code:error?.code||null});return []}}
function uniq(v){return [...new Set((v||[]).filter(Boolean).map(String))];}
function dayOnly(v){if(!v)return null;const d=new Date(v);if(Number.isNaN(d.getTime()))return null;return Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate());}
function daysLate(due){const a=dayOnly(due),b=dayOnly(new Date());return a==null?0:Math.max(0,Math.floor((b-a)/86400000));}
function money(n,c='USD'){try{return new Intl.NumberFormat('en-US',{style:'currency',currency:c||'USD',maximumFractionDigits:0}).format(Number(n||0));}catch{return `${c||'USD'} ${Number(n||0).toFixed(0)}`;}}
function paidInvoice(i){const st=String(i.status||'').toLowerCase();return Number(i.amount_due||0)<=0||['paid','client_paid','settled','closed'].includes(st);}
function overdueInvoice(i){const st=String(i.status||'').toLowerCase();if(['draft','void','cancelled','canceled'].includes(st)||paidInvoice(i)||!i.due_date)return false;return dayOnly(i.due_date)<dayOnly(new Date())&&Number(i.amount_due||0)>0;}
function dueSoonInvoice(i){if(!i.due_date||paidInvoice(i)||overdueInvoice(i))return false;const delta=Math.floor((dayOnly(i.due_date)-dayOnly(new Date()))/86400000);return delta>=0&&delta<=7&&Number(i.amount_due||0)>0;}
function eventType(x){return String(x?.metadata?.calendar_event_type||x?.casting_type||x?.job_type||x?.title||'').toLowerCase();}
function stageRows({bookings,castings,castingModels,invoices}){
  const count=(fn,a)=>a.filter(fn).length;
  const isGoSee=x=>/go\s*see|go-see|gosee/.test(eventType(x));
  return [
    {key:'casting',label:'Casting',count:count(x=>!isGoSee(x)&&!['closed','cancelled'].includes(String(x.status||'').toLowerCase()),castings)},
    {key:'gosee',label:'Go See',count:count(x=>isGoSee(x)&&!['closed','cancelled'].includes(String(x.status||'').toLowerCase()),castings)},
    {key:'callback',label:'Callback',count:count(x=>String(x.status||'').toLowerCase()==='callback',castings)+count(x=>String(x.status||'').toLowerCase()==='callback',castingModels)},
    {key:'option',label:'Option / Hold',count:count(x=>['option','hold'].includes(String(x.status||'').toLowerCase()),bookings)},
    {key:'confirmed',label:'Confirmed',count:count(x=>['confirmed','fitting'].includes(String(x.status||'').toLowerCase()),bookings)},
    {key:'job',label:'On Job',count:count(x=>['job'].includes(String(x.status||'').toLowerCase()),bookings)},
    {key:'completed',label:'Completed',count:count(x=>['completed','invoice_pending'].includes(String(x.status||'').toLowerCase()),bookings)},
    {key:'invoiced',label:'Invoiced',count:count(x=>!paidInvoice(x)&&!overdueInvoice(x),invoices)},
    {key:'overdue',label:'Past Due',count:count(overdueInvoice,invoices)},
    {key:'paid',label:'Client Paid',count:count(paidInvoice,invoices)},
    {key:'modelpay',label:'Model Payable',count:count(x=>String(x.status||'').toLowerCase()==='model_payable',bookings)},
    {key:'closed',label:'Model Paid / Closed',count:count(x=>['model_paid','closed'].includes(String(x.status||'').toLowerCase()),bookings)}
  ];
}
async function baseData(admin,orgId){
  const errors=[];
  // Intelligence must never take the calendar down because one optional finance/
  // workflow column is unavailable in a production schema. Read broad rows and
  // normalize client-side instead of hard-selecting migration-sensitive columns.
  const [bookings,castings,bookingModels,castingModels,invoices,models,companies,members,profiles,allTasks]=await Promise.all([
    safeRows(admin.from('bookings').select('*').eq('organization_id',orgId).order('starts_at',{ascending:false,nullsFirst:false}).limit(1200),errors,'bookings'),
    safeRows(admin.from('castings').select('*').eq('organization_id',orgId).order('starts_at',{ascending:false,nullsFirst:false}).limit(1200),errors,'castings'),
    safeRows(admin.from('booking_models').select('*').eq('organization_id',orgId).limit(3000),errors,'booking_models'),
    safeRows(admin.from('casting_models').select('*').eq('organization_id',orgId).limit(3000),errors,'casting_models'),
    safeRows(admin.from('invoices').select('*').eq('organization_id',orgId).order('due_date',{ascending:true,nullsFirst:false}).limit(1500),errors,'invoices'),
    safeRows(admin.from('models').select('*').eq('organization_id',orgId).limit(1600),errors,'models'),
    safeRows(admin.from('companies').select('*').eq('organization_id',orgId).limit(1600),errors,'companies'),
    safeRows(admin.from('organization_members').select('*').eq('organization_id',orgId).limit(600),errors,'organization_members'),
    safeRows(admin.from('profiles').select('*').limit(2000),errors,'profiles'),
    safeRows(admin.from('tasks').select('*').eq('organization_id',orgId).limit(1500),errors,'tasks')
  ]);
  const tasks=allTasks.filter(t=>String(t.source||t.metadata?.source||'')==='calendar_finance_intelligence');
  return {bookings,castings,bookingModels,castingModels,invoices,models,companies,members,profiles,tasks,errors};
}
function enrich(d){
  const models=new Map(d.models.map(x=>[String(x.id),x])),companies=new Map(d.companies.map(x=>[String(x.id),x])),profiles=new Map(d.profiles.map(x=>[String(x.user_id),x]));
  const bms=new Map();for(const x of d.bookingModels){if(!bms.has(String(x.booking_id)))bms.set(String(x.booking_id),[]);bms.get(String(x.booking_id)).push({...x,model:models.get(String(x.model_id))||null});}
  const cms=new Map();for(const x of d.castingModels){if(!cms.has(String(x.casting_id)))cms.set(String(x.casting_id),[]);cms.get(String(x.casting_id)).push({...x,model:models.get(String(x.model_id))||null});}
  const invs=new Map();for(const x of d.invoices){if(!invs.has(String(x.booking_id)))invs.set(String(x.booking_id),[]);invs.get(String(x.booking_id)).push(x);}
  const memberMap=new Map(d.members.map(m=>{const p=profiles.get(String(m.user_id))||{};return[String(m.id),{...m,display_name:p.display_name||[p.first_name,p.last_name].filter(Boolean).join(' ')||m.job_title||'Agent'}];}));
  const bookings=d.bookings.map(b=>({...b,company:companies.get(String(b.company_id))||null,models:bms.get(String(b.id))||[],invoices:invs.get(String(b.id))||[],agent:memberMap.get(String(b.assigned_member_id))||null}));
  const castings=d.castings.map(c=>({...c,company:companies.get(String(c.company_id))||null,models:cms.get(String(c.id))||[],agent:memberMap.get(String(c.assigned_member_id))||null}));
  return {...d,bookings,castings,memberMap};
}
function actions(d){
  const now=Date.now(),out=[];
  for(const i of d.invoices.filter(overdueInvoice)){
    const b=d.bookings.find(x=>String(x.id)===String(i.booking_id));const late=daysLate(i.due_date);
    out.push({kind:'payment',severity:late>=7?'critical':late>=2?'high':'watch',title:`${late} day${late===1?'':'s'} past due · ${i.invoice_number||'Invoice'}`,subtitle:[b?.company?.name,b?.title,money(i.amount_due,i.currency)].filter(Boolean).join(' · '),booking_id:i.booking_id,invoice_id:i.id,days_overdue:late,amount_due:Number(i.amount_due||0),currency:i.currency||'USD',agent:b?.agent?.display_name||null,model_names:(b?.models||[]).map(x=>x.model?.display_name).filter(Boolean)});
  }
  for(const c of d.castings){const start=c.starts_at?new Date(c.starts_at).getTime():0;if(start&&start<now&&start>now-7*864e5){const pending=(c.models||[]).filter(x=>!['attended','declined','no_show','callback'].includes(String(x.status||'').toLowerCase()));if(pending.length)out.push({kind:'casting',severity:'watch',title:'Casting outcome needed',subtitle:`${c.title||'Casting'} · ${pending.length} model response${pending.length===1?'':'s'} unresolved`,casting_id:c.id,model_names:pending.map(x=>x.model?.display_name).filter(Boolean)});}}
  for(const b of d.bookings){const st=String(b.status||'').toLowerCase(),start=b.starts_at?new Date(b.starts_at).getTime():0;if(['confirmed','fitting','job'].includes(st)&&start>now&&start<now+36*3600e3&&!b.call_time)out.push({kind:'booking',severity:'high',title:'Call time missing',subtitle:`${b.title||'Booking'} · starts within 36 hours`,booking_id:b.id,model_names:(b.models||[]).map(x=>x.model?.display_name).filter(Boolean)});if(['completed','invoice_pending'].includes(st)&&!(b.invoices||[]).length)out.push({kind:'finance',severity:'high',title:'Invoice required',subtitle:`${b.title||'Completed booking'} · no invoice connected`,booking_id:b.id,model_names:(b.models||[]).map(x=>x.model?.display_name).filter(Boolean)});}
  return out.sort((a,b)=>({critical:0,high:1,watch:2}[a.severity]??3)-({critical:0,high:1,watch:2}[b.severity]??3));
}
async function syncFinance(admin,user,organization,d){
  const overdue=d.invoices.filter(overdueInvoice),paid=d.invoices.filter(paidInvoice);let tasksCreated=0,notificationsCreated=0,tasksCompleted=0;
  const invoiceTask=new Map(d.tasks.map(t=>[String(t.metadata?.invoice_id||''),t]));
  const activeStaff=d.members.filter(m=>!m.status||m.status==='active');
  const profileMap=new Map(d.profiles.map(p=>[String(p.user_id),p]));
  const fallback=activeStaff.find(m=>/(director|booker|agent|owner|founder)/i.test(String(m.job_title||'')))||activeStaff[0]||null;
  const bookingMap=new Map(d.bookings.map(b=>[String(b.id),b]));
  const modelLinks=d.bookingModels;
  const allModelIds=uniq(modelLinks.map(x=>x.model_id));
  const syncErrors=[];
  const userLinks=allModelIds.length?await safeRows(admin.from('model_user_links').select('*').eq('organization_id',organization.id).in('model_id',allModelIds),syncErrors,'model_user_links'):[];
  const allNotifs=await safeRows(admin.from('notifications').select('*').eq('organization_id',organization.id).limit(4000),syncErrors,'notifications');
  const existingNotifs=allNotifs.filter(n=>String(n.notification_type||n.type||'')==='booking_payment_update');
  const notifKey=new Set(existingNotifs.map(n=>`${n.user_id}|${n.source_id}|${n.metadata?.payment_stage||''}`));
  async function notifyInvoice(inv,stage){
    const b=bookingMap.get(String(inv.booking_id));if(!b)return;const mids=uniq(modelLinks.filter(x=>String(x.booking_id)===String(b.id)).map(x=>x.model_id));const links=userLinks.filter(x=>mids.includes(String(x.model_id)));const late=daysLate(inv.due_date);
    const payload=[];for(const l of links){const k=`${l.user_id}|${inv.id}|${stage}`;if(notifKey.has(k))continue;notifKey.add(k);const title=stage==='paid'?'Booking payment update · client paid':'Booking payment update · agency follow-up';const body=stage==='paid'?`Client payment has been received for ${b.title||'your booking'}. The agency is processing the next payment step.`:`The client invoice for ${b.title||'your booking'} is ${late} day${late===1?'':'s'} past due. The agency is following up; no action is required from you.`;payload.push({organization_id:organization.id,user_id:l.user_id,notification_type:'booking_payment_update',title,body,channel:'in_app',status:'delivered',source_type:'invoice',source_id:inv.id,action_url:'?page=bookings',metadata:{payment_stage:stage,invoice_id:inv.id,booking_id:b.id,model_id:l.model_id,days_overdue:late,amount_due:Number(inv.amount_due||0),currency:inv.currency||'USD'}});}
    if(payload.length){const {error}=await admin.from('notifications').insert(payload);if(error){syncErrors.push({source:'notifications.insert',message:error.message||String(error),code:error.code||null});}else notificationsCreated+=payload.length;}
  }
  for(const inv of overdue){await notifyInvoice(inv,'overdue');const late=daysLate(inv.due_date);if(late<2||invoiceTask.has(String(inv.id)))continue;const b=bookingMap.get(String(inv.booking_id));const assigned=b?.assigned_member_id||fallback?.id||null;const modelId=modelLinks.find(x=>String(x.booking_id)===String(inv.booking_id))?.model_id||null;const task={organization_id:organization.id,title:`Follow up · ${inv.invoice_number||'past due client payment'}`,description:`Client payment is ${late} days past due for ${b?.title||'booking'}. Follow up with ${d.companies.find(c=>String(c.id)===String(b?.company_id))?.name||'client'}, log the response, and update Finance. Outstanding: ${money(inv.amount_due,inv.currency)}.`,status:'open',priority:late>=7?'urgent':'high',due_at:new Date().toISOString(),category:'Finance Follow-Up',model_id:modelId,visibility:'organization',source:'calendar_finance_intelligence',created_by:user.id,metadata:{auto_generated:true,invoice_id:inv.id,booking_id:inv.booking_id,days_overdue:late,rule:'payment_past_due_plus_2_days'}};const {data:created,error}=await admin.from('tasks').insert(task).select('id').single();if(error){syncErrors.push({source:'tasks.insert',message:error.message||String(error),code:error.code||null});continue;}tasksCreated++;invoiceTask.set(String(inv.id),{id:created.id,...task});if(assigned){const {error:ae}=await admin.from('task_assignments').insert({organization_id:organization.id,task_id:created.id,member_id:assigned,assignment_role:'assignee',assigned_by:user.id});if(ae)syncErrors.push({source:'task_assignments.insert',message:ae.message||String(ae),code:ae.code||null});}}
  for(const inv of paid){await notifyInvoice(inv,'paid');const t=invoiceTask.get(String(inv.id));if(t&& !['completed','cancelled'].includes(String(t.status||''))){const {error}=await admin.from('tasks').update({status:'completed',metadata:{...(t.metadata||{}),auto_completed_reason:'client_payment_received',auto_completed_at:new Date().toISOString()}}).eq('organization_id',organization.id).eq('id',t.id);if(error){syncErrors.push({source:'tasks.update',message:error.message||String(error),code:error.code||null});}else tasksCompleted++;}}
  return {tasks_created:tasksCreated,tasks_completed:tasksCompleted,model_notifications_created:notificationsCreated,degraded:syncErrors.length>0,errors:syncErrors.slice(0,8)};
}

export const handler=async(event)=>{
  if(!['GET','POST'].includes(event.httpMethod))return json(405,{error:'Method not allowed'});
  try{
    const {user,client}=await requireUser(event),p=event.queryStringParameters||{},body=event.httpMethod==='POST'?parseBody(event):{};
    const {organization}=await requireStaffOrganization({user,client,organizationSlug:body.organization_slug||p.organization||'maison-de-veux'});
    const permission=event.httpMethod==='POST'?'tasks.write':'calendar.read';const admin=await requirePermission(user.id,organization.id,permission);
    let d=enrich(await baseData(admin,organization.id));let sync=null;
    if(event.httpMethod==='POST')sync=await syncFinance(admin,user,organization,d);
    if(sync)d=enrich(await baseData(admin,organization.id));
    const overdue=d.invoices.filter(overdueInvoice),dueSoon=d.invoices.filter(dueSoonInvoice),paid=d.invoices.filter(paidInvoice),act=actions(d),pipeline=stageRows(d);
    return json(200,{environment:'cavyre-model-agency-calendar-v16.10.46',organization,sync,pipeline,finance:{outstanding:d.invoices.filter(i=>!paidInvoice(i)).reduce((n,i)=>n+Number(i.amount_due||0),0),overdue_total:overdue.reduce((n,i)=>n+Number(i.amount_due||0),0),overdue_count:overdue.length,due_soon_count:dueSoon.length,paid_count:paid.length},actions:act.slice(0,50),rules:{payment_model_update:true,agent_followup_after_days:2,schedule_mutation:false,industry_pipeline:true},health:{degraded:(d.errors||[]).length>0,optional_sources_unavailable:(d.errors||[]).map(x=>x.source),errors:(d.errors||[]).slice(0,8)}});
  }catch(error){return errorResponse(error);}
};
