import { requireUser, parseBody, json, errorResponse } from './_lib/auth.mjs';
import { requireStaffOrganization, requirePermission } from './_lib/agent-bridge.mjs';
import { safeDeleteEvent } from './_lib/calendar-safe-delete.mjs';
import { visibleToUser } from './_lib/calendar-privacy.mjs';
import { notify } from './_lib/push.mjs';
import { meeting as meetingCopy } from './_lib/push-copy.mjs';

/* Video meeting links: Zoom, Google Meet and Microsoft Teams links are recognised by their address; any other https link is kept as "other".
   Only https links are accepted, so nothing odd can be stored and then opened from a calendar. */
const VIDEO_NAMES={zoom:'Zoom',meet:'Google Meet',teams:'Microsoft Teams',other:'Video meeting'};
function cleanVideo(v){
  const raw=String(v&&typeof v==='object'?v.url:v||'').trim();
  if(!raw)return null;
  let u;try{u=new URL(raw);}catch(_e){throw validationError('The meeting link is not a valid web address.','VIDEO_LINK_INVALID');}
  if(u.protocol!=='https:'||raw.length>600)throw validationError('The meeting link must start with https:// and be under 600 characters.','VIDEO_LINK_INVALID');
  const h=u.hostname.toLowerCase();
  const provider=/(^|\.)zoom\.(us|com)$/.test(h)?'zoom':h==='meet.google.com'?'meet':/(^|\.)teams\.(microsoft\.com|live\.com|microsoft\.us)$/.test(h)?'teams':'other';
  return {provider,url:u.toString()};
}
/* A meeting can also be an agent task: due when the meeting starts, with the join link inside it, assigned to the people picked.
   Moving the event moves the task. The task never carries a model_id, because the model portal lists every task that has one. */
async function syncMeetingTask(admin,orgId,userId,ev,{memberIds=[],video=null,create=false}={}){
  const meta=ev.metadata&&typeof ev.metadata==='object'?ev.metadata:{};
  const desc=['Meeting from the calendar.',video?`Join (${VIDEO_NAMES[video.provider]||'video'}): ${video.url}`:'',ev.location?`Where: ${ev.location}`:'',ev.notes?String(ev.notes).slice(0,800):''].filter(Boolean).join('\n');
  const taskId=meta.task_id||null;
  if(taskId){
    const up=await admin.from('tasks').update({title:ev.title,description:desc,due_at:ev.starts_at}).eq('organization_id',orgId).eq('id',taskId);
    if(up.error)console.warn('[calendar] linked task update failed',up.error.message);
    return {task_id:taskId,created:false};
  }
  if(!create||!memberIds.length)return {task_id:null,created:false};
  const base={organization_id:orgId,title:ev.title,description:desc,priority:'normal',due_at:ev.starts_at,category:'meeting',status:'open',metadata:{source:'calendar_event',event_id:ev.id,video:video||null}};
  let ins=await admin.from('tasks').insert({...base,created_by:userId,visibility:'organization'}).select('id,title,due_at').single();
  if(ins.error)ins=await admin.from('tasks').insert(base).select('id,title,due_at').single();
  if(ins.error)throw ins.error;
  const tid=ins.data.id;
  const asg=await admin.from('task_assignments').insert([...new Set(memberIds.map(String))].map(member_id=>({organization_id:orgId,task_id:tid,member_id,assignment_role:'assignee',assigned_by:userId})));
  if(asg.error)console.warn('[calendar] task assignment failed',asg.error.message);
  await admin.from('events').update({metadata:{...meta,task_id:tid}}).eq('organization_id',orgId).eq('id',ev.id);
  try{
    const {data:ms}=await admin.from('organization_members').select('user_id').in('id',memberIds);
    const uids=(ms||[]).map(m=>m.user_id).filter(x=>x&&x!==userId);
    if(uids.length){const when=new Date(ev.starts_at).toLocaleString('en-US',{weekday:'short',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});const c=meetingCopy({title:ev.title,when,provider:video?VIDEO_NAMES[video.provider]:''});await notify(admin,{orgId,userIds:uids,title:c.title,body:c.body,url:'?page=tasksconsolidated',category:'tasks',tag:'meet-'+ev.id,level:c.level,icon:c.icon});}
  }catch(e){console.warn('[calendar] meeting alert skipped',e?.message||e);}
  return {task_id:tid,created:true};
}

async function rows(q){const {data,error}=await q;if(error)throw error;return data||[];}
async function one(q){const {data,error}=await q;if(error)throw error;return data||null;}
const group=(list,key)=>{const m=new Map();for(const x of list){const k=x[key];if(!m.has(k))m.set(k,[]);m.get(k).push(x);}return m;};
const cleanIds=a=>Array.from(new Set((Array.isArray(a)?a:[]).filter(Boolean)));
const inRange=(v,start,end)=>{if(!v)return false;const t=Date.parse(v);return Number.isFinite(t)&&t>=Date.parse(start)&&t<=Date.parse(end);};
const hasRepeat=x=>!!(x?.recurrence_rule||x?.metadata?.repeat);
const EVENT_STATUSES=new Set(['draft','scheduled','tentative','confirmed','completed','cancelled']);
const EVENT_TYPES=new Set(['meeting','casting','callback','option','hold','booking','fitting','job','test','training','travel','housing','visa','deadline','press','personal','bookout','other']);
const EVENT_VISIBILITIES=new Set(['private','organization','assigned','model_shared','partner_shared']);
function normKey(v){return String(v||'').trim().toLowerCase().replace(/&/g,'and').replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,'');}
function normalizeEventStatus(v){const k=normKey(v)||'scheduled';const map={open:'scheduled',active:'scheduled',pending:'tentative',complete:'completed',canceled:'cancelled'};const out=map[k]||k;return EVENT_STATUSES.has(out)?out:'scheduled';}
function normalizeEventType(v){const k=normKey(v)||'meeting';if(EVENT_TYPES.has(k))return k;const map={go_and_see:'casting',go_see:'casting',editorial:'job',campaign:'job',runway:'job',evaluation:'meeting',digitals:'test',photo_shoot:'job',photoshoot:'job',commercial:'job'};return map[k]||'other';}

function validationError(message,code='CALENDAR_VALIDATION_ERROR'){const e=new Error(message);e.statusCode=400;e.code=code;return e;}
function validDateTime(value){if(!value)return false;const t=Date.parse(value);return Number.isFinite(t);}
function normalizeVisibility(value){const key=normKey(value)||'organization';if(!EVENT_VISIBILITIES.has(key))throw validationError('Invalid calendar visibility.','CALENDAR_VISIBILITY_INVALID');return key;}
async function validateModelIds(admin,organizationId,ids){
  if(!ids.length)return;
  const found=await rows(admin.from('models').select('id').eq('organization_id',organizationId).in('id',ids));
  if(found.length!==ids.length)throw validationError('One or more selected models are no longer available.','CALENDAR_MODEL_INVALID');
}


function rpcUnavailable(error){
  const code=String(error?.code||'').toUpperCase(),msg=String(error?.message||error||'').toLowerCase();
  return code==='PGRST202'||code==='42883'||msg.includes('could not find the function')||msg.includes('function')&&msg.includes('does not exist')||msg.includes('schema cache');
}
async function fallbackSaveEvent(admin,organizationId,userId,action,eventId,payload,modelIds){
  let eventRow;
  if(action==='create_event')eventRow=await one(admin.from('events').insert(payload).select('*').single());
  else eventRow=await one(admin.from('events').update(payload).eq('organization_id',organizationId).eq('id',eventId).select('*').single());
  if(!eventRow?.id)throw new Error('Calendar fallback write did not return a saved event.');
  const ids=cleanIds(modelIds);
  const {error:deleteError}=await admin.from('event_models').delete().eq('organization_id',organizationId).eq('event_id',eventRow.id);if(deleteError)throw deleteError;
  if(ids.length){
    const {error:linkError}=await admin.from('event_models').insert(ids.map(model_id=>({organization_id:organizationId,event_id:eventRow.id,model_id})));if(linkError)throw linkError;
  }
  const verify=await one(admin.from('events').select('*').eq('organization_id',organizationId).eq('id',eventRow.id).single());
  const links=await rows(admin.from('event_models').select('model_id').eq('organization_id',organizationId).eq('event_id',eventRow.id));
  const actual=cleanIds(links.map(x=>x.model_id)).sort(),requested=ids.sort();
  if(!verify||actual.join('|')!==requested.join('|'))throw new Error('Calendar fallback save could not be verified after write.');
  return {verified:true,event:verify,model_ids:actual,persisted_at:verify.updated_at||verify.created_at||new Date().toISOString(),fallback:true};
}

export const handler=async(event)=>{
  if(!['GET','POST'].includes(event.httpMethod))return json(405,{error:'Method not allowed'});
  try{
    const {user,client}=await requireUser(event),body=event.httpMethod==='POST'?parseBody(event):{},p=event.queryStringParameters||{};
    const slug=body.organization_slug||p.organization||'maison-de-veux';
    const {organization}=await requireStaffOrganization({user,client,organizationSlug:slug});

    if(event.httpMethod==='POST'){
      const admin=await requirePermission(user.id,organization.id,'calendar.write');
      const action=String(body.action||'');

      if(action==='move_event'){
        if(!body.event_id||!body.starts_at)throw validationError('event_id and starts_at are required.');
        if(!validDateTime(body.starts_at))throw validationError('Invalid event date/time.','CALENDAR_DATETIME_INVALID');
        const current=await one(admin.from('events').select('id,starts_at,ends_at,metadata').eq('organization_id',organization.id).eq('id',body.event_id).maybeSingle());
        if(!current){const e=new Error('Calendar event not found.');e.statusCode=404;e.code='CALENDAR_EVENT_NOT_FOUND';throw e;}
        const oldStart=current?.starts_at?new Date(current.starts_at):null,newStart=new Date(body.starts_at);if(!oldStart||isNaN(newStart))throw validationError('Invalid event date/time.','CALENDAR_DATETIME_INVALID');
        const delta=newStart-oldStart,patch={starts_at:newStart.toISOString(),updated_at:new Date().toISOString()};
        if(current.ends_at)patch.ends_at=new Date(new Date(current.ends_at).getTime()+delta).toISOString();
        patch.metadata={...(current.metadata||{}),calendar_dragged_at:new Date().toISOString(),calendar_dragged_by:user.id};
        const eventRow=await one(admin.from('events').update(patch).eq('organization_id',organization.id).eq('id',body.event_id).select('*').single());
        return json(200,{ok:true,event:eventRow,moved:true});
      }
      if(action==='create_event'||action==='update_event'){
        const title=String(body.title||'').trim();
        if(!title)throw validationError('Title is required.');
        if(action==='update_event'&&!body.event_id)throw validationError('event_id is required for calendar updates.');
        if(!validDateTime(body.starts_at))throw validationError('A valid start date/time is required.','CALENDAR_DATETIME_INVALID');
        if(body.ends_at&&!validDateTime(body.ends_at))throw validationError('End date/time is invalid.','CALENDAR_DATETIME_INVALID');
        if(body.ends_at&&Date.parse(body.ends_at)<Date.parse(body.starts_at))throw validationError('End date/time cannot be before the start.','CALENDAR_RANGE_INVALID');
        const ids=cleanIds(body.model_ids);
        await validateModelIds(admin,organization.id,ids);
        let prior=null;
        if(action==='update_event'&&body.event_id){
          prior=await one(admin.from('events').select('metadata').eq('organization_id',organization.id).eq('id',body.event_id).maybeSingle());
          if(!prior){const e=new Error('Calendar event not found.');e.statusCode=404;e.code='CALENDAR_EVENT_NOT_FOUND';throw e;}
        }
        const hasVideo=Object.prototype.hasOwnProperty.call(body,'video');
        const video=hasVideo?cleanVideo(body.video):null;
        const shareFlag=typeof body.share_with_models==='boolean'?body.share_with_models:null;
        const metadata={
          ...(prior?.metadata||{}),
          ...(hasVideo?{video}:{}),
          ...(shareFlag===null?{}:{share_with_models:shareFlag}),
          ...(shareFlag===true&&ids.length&&!prior?.metadata?.event_kind?{event_kind:'model meeting'}:{}),
          category:body.category||null,
          calendar_event_type:body.calendar_event_type||body.event_type||prior?.metadata?.calendar_event_type||null,
          pipeline_stage:body.pipeline_stage||null,
          paid:!!body.paid,
          pay_amount:Number.isFinite(Number(body.pay_amount))?Number(body.pay_amount):null,
          currency:String(body.currency||prior?.metadata?.currency||'USD').slice(0,3).toUpperCase(),
          travel_required:!!body.travel_required,
          visa_required:!!body.visa_required,
          booker_handoff:body.booker_handoff&&typeof body.booker_handoff==='object'?body.booker_handoff:{}
        };
        const payload={
          organization_id:organization.id,
          title,
          event_type:normalizeEventType(body.event_type),
          status:normalizeEventStatus(body.status),
          starts_at:body.starts_at,
          ends_at:body.ends_at||null,
          timezone:body.timezone||null,
          all_day:!!body.all_day,
          location:body.location||null,
          market_id:body.market_id||null,
          company_id:body.company_id||null,
          contact_id:body.contact_id||null,
          owner_member_id:body.owner_member_id||null,
          visibility:normalizeVisibility(body.visibility||(ids.length&&shareFlag!==false?'model_shared':'organization')),
          notes:body.notes||null,
          recurrence_rule:body.recurrence_rule||null,
          metadata
        };
        let saved=null;
        const rpcResult=await admin.rpc('save_event_full_v1',{target_org:organization.id,target_event:action==='update_event'?body.event_id:null,target_payload:payload,target_model_ids:ids,target_user:user.id});
        if(rpcResult.error){
          if(!rpcUnavailable(rpcResult.error))throw rpcResult.error;
          saved=await fallbackSaveEvent(admin,organization.id,user.id,action,body.event_id,payload,ids);
        }else saved=rpcResult.data;
        if(!saved?.verified||!saved?.event){const e=new Error('Calendar save could not be verified.');e.statusCode=500;e.publicMessage='Calendar event was not confirmed as saved. Please retry.';throw e;}
        let linked=null;
        try{
          const at=body.agent_task&&typeof body.agent_task==='object'?body.agent_task:{};
          const mids=(Array.isArray(at.member_ids)&&at.member_ids.length?at.member_ids:(body.owner_member_id?[body.owner_member_id]:[])).filter(Boolean);
          const vid=hasVideo?video:(saved.event.metadata&&saved.event.metadata.video)||null;
          linked=await syncMeetingTask(admin,organization.id,user.id,saved.event,{memberIds:mids,video:vid,create:!!at.create});
        }catch(e){console.warn('[calendar] meeting task skipped',e?.message||e);linked={error:String(e?.message||e).slice(0,160)};}
        return json(action==='create_event'?201:200,{ok:true,verified:true,event:saved.event,model_ids:saved.model_ids,task:linked,persisted_at:saved.persisted_at});
      }
      if(action==='delete_event'){
        if(!body.event_id)throw validationError('event_id is required.');
        const gone=await admin.from('events').select('metadata').eq('organization_id',organization.id).eq('id',body.event_id).maybeSingle();
        const result=await safeDeleteEvent(admin,organization.id,body.event_id);
        const linkedTask=gone&&gone.data&&gone.data.metadata&&gone.data.metadata.task_id;
        if(result?.verified===true&&linkedTask)await admin.from('tasks').update({status:'cancelled'}).eq('organization_id',organization.id).eq('id',linkedTask);
        return json(200,{ok:true,verified:result?.verified===true,deleted:'event',event_id:body.event_id,persisted_at:new Date().toISOString()});
      }
      return json(400,{error:'Unsupported calendar action'});
    }

    const admin=await requirePermission(user.id,organization.id,'calendar.read');
    const iso=v=>{const t=Date.parse(v);return Number.isFinite(t)?new Date(t).toISOString():null;};
    const start=iso(p.start)||new Date(Date.now()-30*864e5).toISOString();
    const end=iso(p.end)||new Date(Date.now()+180*864e5).toISOString();
    /* Ask the database only for what falls in the window (plus anything that repeats). Before, it read the first 1,500
       rows by date and filtered afterwards, so once the calendar held more than that, later dates silently disappeared. */
    const inWindow=table=>rows(admin.from(table).select('*').eq('organization_id',organization.id).gte('starts_at',start).lte('starts_at',end).order('starts_at').limit(5000));
    const repeating=table=>Promise.all([
      rows(admin.from(table).select('*').eq('organization_id',organization.id).not('recurrence_rule','is',null).limit(1000)).catch(()=>[]),
      rows(admin.from(table).select('*').eq('organization_id',organization.id).not('metadata->repeat','is',null).limit(1000)).catch(()=>[])
    ]).then(l=>l.flat());
    const windowed=async table=>{const [a,b]=await Promise.all([inWindow(table),repeating(table)]);const m=new Map();for(const x of [...a,...b])m.set(x.id,x);return [...m.values()];};

    const [allEvents,allBookings,allCastings,blocks,tasks,models,modelPrimaryMedia,companies,contacts,markets,members,profiles]=await Promise.all([
      windowed('events'),
      windowed('bookings'),
      windowed('castings'),
      rows(admin.from('availability_blocks').select('*').eq('organization_id',organization.id).gte('ends_at',start).lte('starts_at',end).in('status',['approved','pending']).order('starts_at')),
      rows(admin.from('tasks').select('id,title,status,priority,due_at,model_id').eq('organization_id',organization.id).gte('due_at',start).lte('due_at',end).neq('status','completed').order('due_at')),
      rows(admin.from('models').select('id,display_name,public_slug,primary_market_label,status,active').eq('organization_id',organization.id).limit(1500)),
      rows(admin.from('model_media').select('model_id,url,is_primary,media_type').eq('organization_id',organization.id).eq('is_primary',true).eq('media_type','image').limit(1500)),
      rows(admin.from('companies').select('id,name,company_type,status').eq('organization_id',organization.id).order('name').limit(1500)),
      rows(admin.from('contacts').select('id,first_name,last_name,display_name,email,company_id,role,status').eq('organization_id',organization.id).order('display_name').limit(2500)),
      rows(admin.from('markets').select('id,name,code,city').eq('organization_id',organization.id).eq('active',true).order('name').limit(300)),
      rows(admin.from('organization_members').select('id,user_id,member_type,job_title,status').eq('organization_id',organization.id).eq('status','active').eq('member_type','staff').limit(500)),
      rows(admin.from('profiles').select('user_id,display_name,first_name,last_name').limit(1500))
    ]);

    const events=allEvents.filter(x=>visibleToUser(x,user.id)&&(inRange(x.starts_at,start,end)||hasRepeat(x)));
    const bookings=allBookings.filter(x=>inRange(x.starts_at,start,end)||hasRepeat(x));
    const castings=allCastings.filter(x=>inRange(x.starts_at,start,end)||hasRepeat(x));

    const eventIds=events.map(x=>x.id),bookingIds=bookings.map(x=>x.id),castingIds=castings.map(x=>x.id);

    let financeInvoices=[];
    if(bookingIds.length){
      try{
        const q=admin.from('invoices').select('id,booking_id,invoice_number,status,total,amount_due,amount_paid,currency,issue_date,due_date').eq('organization_id',organization.id).in('booking_id',bookingIds).order('issue_date',{ascending:false});
        financeInvoices=await rows(q);
      }catch(_financeReadError){
        financeInvoices=[];
      }
    }

    const relevantModelIds=cleanIds([
      ...models.map(x=>x.id),
      ...blocks.map(x=>x.model_id),
      ...tasks.map(x=>x.model_id)
    ]);
    const [eventModels,bookingModels,castingModels,bookingUsage,bookingRates,modelEvaluations]=await Promise.all([
      eventIds.length?rows(admin.from('event_models').select('*').eq('organization_id',organization.id).in('event_id',eventIds)):[],
      bookingIds.length?rows(admin.from('booking_models').select('*').eq('organization_id',organization.id).in('booking_id',bookingIds)):[],
      castingIds.length?rows(admin.from('casting_models').select('*').eq('organization_id',organization.id).in('casting_id',castingIds)):[],
      bookingIds.length?rows(admin.from('booking_usage_terms').select('booking_id,notes,currency').eq('organization_id',organization.id).in('booking_id',bookingIds)):[],
      bookingIds.length?rows(admin.from('booking_rates').select('id,booking_id,model_id,rate_type,quantity,unit_amount,currency,talent_gross,talent_net_estimate').eq('organization_id',organization.id).in('booking_id',bookingIds)):[],
      relevantModelIds.length?rows(admin.from('model_evaluations').select('id,model_id,evaluation_type,evaluated_on,overall_current,overall_potential,status,executive_summary').eq('organization_id',organization.id).in('model_id',relevantModelIds).order('evaluated_on',{ascending:false}).limit(3000)):[]
    ]);

    const profileMap=new Map(profiles.map(x=>[x.user_id,x]));
    const staff=members.filter(m=>/(founder|owner|director|booker|agent)/i.test(String(m.job_title||''))).map(m=>{const p=profileMap.get(m.user_id)||{};return {...m,display_name:p.display_name||[p.first_name,p.last_name].filter(Boolean).join(' ')||m.job_title||'Agency Team'};});
    const primaryPhotoMap=new Map(modelPrimaryMedia.filter(x=>x?.model_id&&x?.url).map(x=>[x.model_id,x.url]));
    const latestEvaluationMap=new Map();
    for(const evaluation of modelEvaluations){
      const current=latestEvaluationMap.get(evaluation.model_id);
      const preferred=!/draft/i.test(String(evaluation.status||''));
      if(!current||(preferred&&/draft/i.test(String(current.status||''))))latestEvaluationMap.set(evaluation.model_id,evaluation);
    }
    const modelRows=models.map(x=>({...x,avatar_url:primaryPhotoMap.get(x.id)||null,latest_evaluation:latestEvaluationMap.get(x.id)||null}));
    const mm=new Map(modelRows.map(x=>[x.id,x]));
    const cm=new Map(companies.map(x=>[x.id,x]));
    const contactMap=new Map(contacts.map(x=>[x.id,x]));
    const marketMap=new Map(markets.map(x=>[x.id,x]));
    const memberMap=new Map(staff.map(x=>[x.id,x]));
    const em=group(eventModels,'event_id'),bm=group(bookingModels,'booking_id'),castm=group(castingModels,'casting_id'),bu=group(bookingUsage,'booking_id'),br=group(bookingRates,'booking_id');

    return json(200,{
      environment:'veux-desk-v16.8.3-performance',
      organization,
      range:{start,end},
      lookups:{models:modelRows,companies,contacts,markets,members:staff},
      events:events.map(x=>({
        ...x,
        companies:cm.get(x.company_id)||null,
        contacts:contactMap.get(x.contact_id)||null,
        markets:marketMap.get(x.market_id)||null,
        owner_member:memberMap.get(x.owner_member_id)||null,
        event_models:(em.get(x.id)||[]).map(y=>({...y,models:mm.get(y.model_id)||null}))
      })),
      bookings:bookings.map(x=>({
        ...x,
        companies:cm.get(x.company_id)||null,
        contacts:contactMap.get(x.primary_contact_id||x.casting_director_contact_id)||null,
        markets:marketMap.get(x.market_id)||null,
        assigned_member:memberMap.get(x.assigned_member_id)||null,
        booking_models:(bm.get(x.id)||[]).map(y=>({...y,models:mm.get(y.model_id)||null})),
        booking_usage_terms:bu.get(x.id)||[],
        booking_rates:br.get(x.id)||[],
        invoices:financeInvoices.filter(i=>String(i.booking_id)===String(x.id))
      })),
      castings:castings.map(x=>({
        ...x,
        companies:cm.get(x.company_id)||null,
        contacts:contactMap.get(x.primary_contact_id||x.casting_director_contact_id)||null,
        markets:marketMap.get(x.market_id)||null,
        assigned_member:memberMap.get(x.assigned_member_id)||null,
        casting_models:(castm.get(x.id)||[]).map(y=>({...y,models:mm.get(y.model_id)||null}))
      })),
      availability_blocks:blocks.map(x=>({...x,models:mm.get(x.model_id)||null})),
      tasks:tasks.map(x=>({...x,models:mm.get(x.model_id)||null}))
    });
  }catch(error){return errorResponse(error);}
};
