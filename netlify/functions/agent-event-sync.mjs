import { requireUser, json, errorResponse, parseBody } from './_lib/auth.mjs';
import { requireStaffOrganization, requirePermission, uuidish, findModel, findCompany, findContact, findMember, isoFromLegacy } from './_lib/agent-bridge.mjs';
import { safeDeleteEvent, safeDeleteBooking, safeDeleteCasting } from './_lib/calendar-safe-delete.mjs';

const castingTypes=new Set(['CASTING','GO & SEE','EVALUATION','CALLBACK']);
const bookingTypes=new Set(['CAMPAIGN','EDITORIAL','RUNWAY','FITTING','BOOKING','OPTION','HOLD','JOB']);
function kindFor(ev){ if(ev._veuxKind)return ev._veuxKind; const t=String(ev.type||'').toUpperCase(); if(castingTypes.has(t))return 'casting'; if(bookingTypes.has(t)||ev.pipelineStage)return 'booking'; return 'event'; }
function eventType(t){ const x=String(t||'OTHER').toLowerCase(); const map={'go & see':'casting',evaluation:'casting',campaign:'job',editorial:'job',runway:'job',digitals:'test'}; return map[x]||(['meeting','casting','callback','option','hold','booking','fitting','job','test','training','travel','housing','visa','deadline','press','personal','bookout','other'].includes(x)?x:'other'); }
function eventStatus(s){ const x=String(s||'scheduled').toLowerCase(); return ['draft','scheduled','tentative','confirmed','completed','cancelled'].includes(x)?x:(x==='pending'?'tentative':'scheduled'); }
function bookingStatus(ev){ const p=String(ev.pipelineStage||'').toLowerCase().replace(/\s+/g,'_'); if(['inquiry','casting','callback','option','hold','confirmed','fitting','job','completed','cancelled','invoice_pending','invoiced','client_paid','model_payable','model_paid','closed'].includes(p))return p; const t=String(ev.type||'').toUpperCase(); if(t==='FITTING')return 'fitting'; if(t==='OPTION')return 'option'; if(t==='HOLD')return 'hold'; if(String(ev.status||'').toLowerCase()==='confirmed')return 'confirmed'; if(String(ev.status||'').toLowerCase()==='completed')return 'completed'; if(String(ev.status||'').toLowerCase()==='cancelled')return 'cancelled'; return 'job'; }
function castingStatus(ev){ const x=String(ev.status||'open').toLowerCase(); if(x==='cancelled')return 'cancelled'; if(x==='completed'||x==='closed')return 'closed'; if(x==='callback'||String(ev.type||'').toUpperCase()==='CALLBACK')return 'callback'; if(x==='confirmed'||x==='scheduled'||x==='tentative')return 'open'; return ['draft','open','submitted','callback','closed','cancelled'].includes(x)?x:'open'; }
function modelKeys(ev){ const list=[]; if(ev.model)list.push(ev.model); if(Array.isArray(ev.models))for(const x of ev.models)list.push(typeof x==='string'?x:(x?.key||x?.modelKey||x?.id)); return [...new Set(list.filter(Boolean))]; }

async function resolvedModelIds(admin,organizationId,ev){
  const ids=[];for(const key of modelKeys(ev)){const m=await findModel(admin,organizationId,key);if(m?.id)ids.push(m.id);}return [...new Set(ids)];
}


export const handler=async(event)=>{
  if(!['POST','DELETE'].includes(event.httpMethod))return json(405,{error:'Method not allowed'});
  try{
    const {user,client}=await requireUser(event);const body=parseBody(event);
    const {organization}=await requireStaffOrganization({user,client,organizationId:body.organization_id,organizationSlug:body.organization_slug});
    const ev=body.event||{}; const kind=body.kind||kindFor(ev);
    const perm=kind==='event'?'calendar.write':'bookings.write'; const admin=await requirePermission(user.id,organization.id,perm);
    if(event.httpMethod==='DELETE'){
      const id=body.id; if(!id)return json(400,{error:'id is required'});
      const table=kind==='booking'?'bookings':kind==='casting'?'castings':'events';
      let resolved=id;
      if(!uuidish(id)){const {data:row,error:findError}=await admin.from(table).select('id').eq('organization_id',organization.id).eq('legacy_id',String(id)).single();if(findError)throw findError;resolved=row.id;}
      const result=kind==='booking'?await safeDeleteBooking(admin,organization.id,resolved):kind==='casting'?await safeDeleteCasting(admin,organization.id,resolved):await safeDeleteEvent(admin,organization.id,resolved);
      return json(200,{ok:true,verified:result?.verified===true,kind,id:resolved,persisted_at:new Date().toISOString()});
    }
    if(!ev.title)return json(400,{error:'event.title is required'});
    const originalId=String(ev._veuxId||ev.id||'').trim()||null; const legacyId=String(ev._legacyId||ev.id||'').trim()||`bridge:${crypto.randomUUID()}`;
    const startsAt=isoFromLegacy(ev.date||ev.starts_at,ev.time,organization.timezone); if(!startsAt)return json(400,{error:'A valid event date is required'});
    const endsAt=isoFromLegacy(ev.date||ev.ends_at,ev.endTime,organization.timezone)||startsAt;
    const companyId=await findCompany(admin,organization.id,ev.clientCompanyId||ev.company_id||null);
    const contactId=await findContact(admin,organization.id,ev.cdContactId||ev.contact_id||null);
    const member=await findMember(admin,organization.id,ev.agent||null);
    const modelIds=await resolvedModelIds(admin,organization.id,ev);
    let existingId=originalId&&uuidish(originalId)?originalId:null;
    if(!existingId&&legacyId){const table=kind==='booking'?'bookings':kind==='casting'?'castings':'events';const {data:existing,error:existingError}=await admin.from(table).select('id').eq('organization_id',organization.id).eq('legacy_id',legacyId).maybeSingle();if(existingError)throw existingError;existingId=existing?.id||null;}
    let payload;
    if(kind==='casting')payload={title:ev.title,company_id:companyId,primary_contact_id:contactId,casting_director_contact_id:contactId,assigned_member_id:member?.id||null,status:castingStatus(ev),casting_type:'in_person',starts_at:startsAt,ends_at:endsAt,timezone:organization.timezone,location:ev.loc||ev.location||null,brief:ev.notes||null,rate_note:ev.rate||null,usage_note:ev.usage||null,metadata:{legacy_type:ev.type||null,legacy_payload:ev}};
    else if(kind==='booking')payload={title:ev.title,company_id:companyId,primary_contact_id:contactId,casting_director_contact_id:contactId,assigned_member_id:member?.id||null,status:bookingStatus(ev),job_type:String(ev.type||'').toLowerCase()||null,starts_at:startsAt,ends_at:endsAt,timezone:organization.timezone,location:ev.loc||ev.location||null,internal_notes:ev.notes||null,travel_required:!!ev.travelRequired,visa_required:!!ev.visaRequired,currency:ev.currency||organization.default_currency||'USD',metadata:{legacy_type:ev.type||null,legacy_rate:ev.rate||null,legacy_usage:ev.usage||null,payment_status:ev.paymentStatus||null,commission:ev.commission??null,legacy_payload:ev}};
    else payload={title:ev.title,event_type:eventType(ev.type),status:eventStatus(ev.status),starts_at:startsAt,ends_at:endsAt,timezone:organization.timezone,all_day:!ev.time,location:ev.loc||ev.location||null,company_id:companyId,contact_id:contactId,owner_member_id:member?.id||null,visibility:'organization',notes:ev.notes||null,recurrence_rule:ev.repeatRule||null,metadata:{legacy_type:ev.type||null,legacy_payload:ev}};
    const {data:saved,error:saveError}=await admin.rpc('save_event_bridge_v1',{target_org:organization.id,target_kind:kind,target_id:existingId,target_legacy_id:legacyId,target_payload:payload,target_model_ids:modelIds,target_user:user.id});
    if(saveError)throw saveError;if(saved?.verified!==true){const e=new Error('Event sync could not be verified');e.statusCode=409;throw e;}
    return json(200,{ok:true,verified:true,kind,id:saved.id,legacy_id:saved.legacy_id||legacyId,persisted_at:saved.persisted_at});
  }catch(error){return errorResponse(error);}
};
