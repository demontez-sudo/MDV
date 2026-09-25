import { requireUser, parseBody, json, errorResponse } from './_lib/auth.mjs';
import { requireStaffOrganization, requirePermission } from './_lib/agent-bridge.mjs';
import { logModelActivity, actorFor } from './_lib/model-activity.mjs';

async function rows(q){const {data,error}=await q;if(error)throw error;return data||[];}
async function safeRows(q,label,warnings){try{return await rows(q);}catch(error){warnings.push({section:label,error:error?.message||String(error)});return [];}}

async function notifyMobilityState(admin,organizationId,record,kind){
  if(!record?.model_id)return;
  const notifications=[];
  if(record.visible_to_model!==false){
    const {data:link,error}=await admin.from('model_user_links').select('user_id').eq('organization_id',organizationId).eq('model_id',record.model_id).maybeSingle();if(error)throw error;
    if(link?.user_id){const subject=kind==='travel'?(record.destination||'Travel'):kind==='housing'?(record.property_name||record.provider||'Accommodation'):kind==='visa'?([record.country_code,record.visa_type||record.case_type].filter(Boolean).join(' ')||'Visa'):kind==='work_authorization'?([record.country_code,record.authorization_type].filter(Boolean).join(' ')||'Work authorization'):'Passport';const when=kind==='visa'&&record.hard_deadline?`Deadline ${record.hard_deadline}`:kind==='travel'&&record.starts_at?`Starts ${record.starts_at}`:kind==='housing'&&record.check_in_at?`Check-in ${record.check_in_at}`:record.expires_on?`Expires ${record.expires_on}`:'';notifications.push({organization_id:organizationId,user_id:link.user_id,notification_type:'mobility_shared_state',title:`${subject} updated`,body:[record.status,when].filter(Boolean).join(' · ')||'Open Travel & Visa for the latest agency update.',channel:'in_app',status:'delivered',source_type:kind,source_id:record.id,action_url:'?page=myvisa',metadata:{model_id:record.model_id,kind,requires_ack:true,revision_at:new Date().toISOString(),due_at:record.hard_deadline||record.starts_at||record.check_in_at||record.appointment_at||record.expires_on||null}});}
  }
  if(record.visible_to_partner===true){
    const placements=await rows(admin.from('model_placements').select('partner_agency_id').eq('organization_id',organizationId).eq('model_id',record.model_id).in('status',['active','pending','placed']));
    const partnerIds=[...new Set(placements.map(x=>x.partner_agency_id).filter(Boolean))];
    if(partnerIds.length){const links=await rows(admin.from('partner_user_links').select('user_id').eq('organization_id',organizationId).in('partner_agency_id',partnerIds));const users=[...new Set(links.map(x=>x.user_id).filter(Boolean))];const page=(kind==='travel'||kind==='housing')?'movement':'visastatus';for(const user_id of users){notifications.push({organization_id:organizationId,user_id,notification_type:'mobility_shared_state',title:`${kind==='travel'?'Travel':kind==='housing'?'Accommodation':kind==='visa'?'Visa':'Mobility'} updated`,body:[record.destination||record.property_name||record.country_code,record.status,record.hard_deadline&&`Deadline ${record.hard_deadline}`].filter(Boolean).join(' · '),channel:'in_app',status:'delivered',source_type:kind,source_id:record.id,action_url:`?page=${page}`,metadata:{model_id:record.model_id,kind,requires_ack:true,revision_at:new Date().toISOString(),due_at:record.hard_deadline||record.starts_at||record.appointment_at||record.expires_on||null}});}}
  }
  if(notifications.length){const {error}=await admin.from('notifications').insert(notifications);if(error)throw error;}
}

function oneOf(value,allowed,fallback,aliases={}){
  const raw=String(value??'').trim().toLowerCase();
  const normalized=aliases[raw]||raw;
  return allowed.includes(normalized)?normalized:fallback;
}
function validationError(message,code='MOBILITY_VALIDATION_ERROR'){const e=new Error(message);e.statusCode=400;e.code=code;return e;}
function countryCode(value){const code=String(value||'').trim().toUpperCase();if(!/^[A-Z]{2}$/.test(code))throw validationError('Enter a valid 2-letter country code.','MOBILITY_COUNTRY_INVALID');return code;}

const PLACE_CODES=[['FR',/\b(france|paris|lyon|nice|marseille)\b/i],['IT',/\b(italy|milan|milano|rome|roma|florence)\b/i],['GB',/\b(united kingdom|uk|england|london|manchester)\b/i],['US',/\b(united states|usa|new york|nyc|los angeles|miami|atlanta|chicago)\b/i],['DE',/\b(germany|berlin|munich|hamburg)\b/i],['ES',/\b(spain|madrid|barcelona)\b/i],['NL',/\b(netherlands|amsterdam)\b/i],['PT',/\b(portugal|lisbon|porto)\b/i],['BE',/\b(belgium|brussels)\b/i],['CH',/\b(switzerland|zurich|geneva)\b/i],['DK',/\b(denmark|copenhagen)\b/i],['SE',/\b(sweden|stockholm)\b/i],['JP',/\b(japan|tokyo)\b/i],['CN',/\b(china|shanghai|beijing)\b/i],['CA',/\b(canada|toronto|vancouver|montreal)\b/i],['AU',/\b(australia|sydney|melbourne)\b/i],['AE',/\b(uae|dubai|abu dhabi)\b/i],['ZA',/\b(south africa|cape town|johannesburg)\b/i],['NG',/\b(nigeria|lagos)\b/i],['BR',/\b(brazil|sao paulo|são paulo|rio)\b/i]];
const SCHENGEN=new Set(['FR','IT','DE','ES','NL','PT','BE','CH','DK','SE','AT','GR','FI','NO','PL','CZ','HU','LU','MT','IS','EE','LV','LT','SK','SI','LI','HR']);
function placeCountry(text){const t=String(text||'').trim();if(!t)return null;const tail=t.match(/[,\s]([A-Za-z]{2})$/);if(tail&&/,\s*[A-Za-z]{2}$/.test(t))return tail[1].toUpperCase();for(const [code,re] of PLACE_CODES)if(re.test(t))return code;return null;}
function visaGateFor(trip,visas){
  const code=placeCountry(trip.destination);if(!code)return {state:'unknown',country_code:null,message:'Destination country not recognised — add the country to check visa clearance.'};
  const start=trip.starts_at?String(trip.starts_at).slice(0,10):null;
  const mine=visas.filter(v=>v.model_id===trip.model_id&&(v.country_code===code||(/schengen/i.test(String(v.visa_type||''))&&SCHENGEN.has(code)&&SCHENGEN.has(v.country_code))));
  if(!mine.length)return {state:'none',country_code:code,message:`No visa case on file for ${code}. Confirm the model does not need one.`};
  const good=mine.filter(v=>/^(approved|issued)$/.test(String(v.status||'')));
  const valid=good.find(v=>!v.expires_on||!start||String(v.expires_on).slice(0,10)>=start);
  if(valid)return {state:'clear',country_code:code,visa_case_id:valid.id,message:`Visa ${valid.status}${valid.expires_on?` · valid to ${String(valid.expires_on).slice(0,10)}`:''}.`};
  if(good.length)return {state:'expired',country_code:code,visa_case_id:good[0].id,message:`Visa expires before this trip starts (${String(good[0].expires_on).slice(0,10)}).`};
  const open=mine.find(v=>!/^(refused|cancelled|expired)$/.test(String(v.status||'')))||mine[0];
  return {state:'pending',country_code:code,visa_case_id:open.id,message:`Visa ${String(open.status||'not started').replace(/_/g,' ')} — must be approved before travel is confirmed.`};
}
const VISA_AUTO_DATES={submitted:'submitted_on',processing:'submitted_on',approved:'approved_on',issued:'issued_on'};
function currencyCode(value){const code=String(value||'USD').trim().toUpperCase();if(!/^[A-Z]{3}$/.test(code))throw validationError('Enter a valid 3-letter currency code.','MOBILITY_CURRENCY_INVALID');return code;}
function moneyValue(value){if(value==null||value==='')return null;const n=Number(value);if(!Number.isFinite(n)||n<0)throw validationError('Cost must be a valid non-negative number.','MOBILITY_COST_INVALID');return n;}
function validateTemporal(value,label){if(value&& !Number.isFinite(Date.parse(value)))throw validationError(`${label} is invalid.`,'MOBILITY_DATE_INVALID');return value||null;}
function validateRange(start,end,startLabel='Start',endLabel='End'){validateTemporal(start,startLabel);validateTemporal(end,endLabel);if(start&&end&&Date.parse(end)<Date.parse(start))throw validationError(`${endLabel} cannot be before ${startLabel.toLowerCase()}.`,'MOBILITY_RANGE_INVALID');}
async function notifyMobilityStateSafe(admin,organizationId,record,kind){
  try{await notifyMobilityState(admin,organizationId,record,kind);return null;}
  catch(error){console.warn('[VEUX mobility notification]',kind,error?.message||String(error));return error?.message||String(error);}
}

function travelCalendarStatus(status){
  const s=String(status||'planning').toLowerCase();
  if(s==='cancelled')return'cancelled';
  if(s==='completed')return'completed';
  if(s==='confirmed'||s==='booked'||s==='in_progress')return'scheduled';
  return'tentative';
}
function visaCalendarStatus(status){
  const s=String(status||'not_started').toLowerCase();
  if(s==='cancelled'||s==='refused'||s==='expired')return'cancelled';
  if(s==='approved'||s==='issued')return'completed';
  return'tentative';
}
function dateOnlyIso(value,hour=12){
  if(!value)return null;
  const raw=String(value);
  if(raw.includes('T'))return raw;
  return `${raw}T${String(hour).padStart(2,'0')}:00:00.000Z`;
}
async function linkedEventByMetadata(admin,organizationId,key,value){
  try{
    const {data,error}=await admin.from('events').select('*').eq('organization_id',organizationId).contains('metadata',{[key]:value}).limit(1);
    if(!error&&data?.[0])return data[0];
  }catch(_e){}
  const {data,error}=await admin.from('events').select('id,metadata,starts_at,ends_at,status').eq('organization_id',organizationId).limit(1500);
  if(error)throw error;
  return (data||[]).find(x=>String(x?.metadata?.[key]||'')===String(value))||null;
}
async function syncEventModel(admin,organizationId,eventId,modelId){
  if(!eventId||!modelId)return;
  const {data,error}=await admin.from('event_models').select('id').eq('organization_id',organizationId).eq('event_id',eventId).eq('model_id',modelId).maybeSingle();
  if(error)throw error;
  if(!data){
    const ins=await admin.from('event_models').insert({organization_id:organizationId,event_id:eventId,model_id:modelId});
    if(ins.error)throw ins.error;
  }
}
async function upsertMobilityEvent(admin,organizationId,userId,{key,value,modelId,title,eventType,status,startsAt,endsAt,location,visibility,notes,metadata}){
  if(!value||!modelId||!startsAt)return null;
  const prior=await linkedEventByMetadata(admin,organizationId,key,value);
  const payload={
    organization_id:organizationId,title,event_type:eventType,status,starts_at:startsAt,ends_at:endsAt||null,
    timezone:null,all_day:false,location:location||null,market_id:null,company_id:null,contact_id:null,owner_member_id:null,
    visibility:visibility||'organization',notes:notes||null,recurrence_rule:null,
    metadata:{...(prior?.metadata||{}),...(metadata||{}),[key]:value,mobility_synced:true,mobility_synced_at:new Date().toISOString(),mobility_synced_by:userId}
  };
  const q=prior?.id
    ? admin.from('events').update(payload).eq('organization_id',organizationId).eq('id',prior.id)
    : admin.from('events').insert(payload);
  const {data,error}=await q.select('*').single();
  if(error)throw error;
  await syncEventModel(admin,organizationId,data.id,modelId);
  return data;
}
async function syncTravelCalendar(admin,organizationId,userId,travel){
  if(!travel?.id||!travel?.model_id||!travel?.starts_at)return null;
  const warnings=[];
  const segments=await safeRows(admin.from('travel_segments').select('*').eq('organization_id',organizationId).eq('travel_record_id',travel.id).order('departs_at',{ascending:true,nullsFirst:false}),'travel_segments_sync',warnings);
  const housing=await safeRows(admin.from('housing_bookings').select('*').eq('organization_id',organizationId).eq('travel_record_id',travel.id).order('check_in_at',{ascending:true,nullsFirst:false}),'housing_sync',warnings);
  const firstSeg=segments[0]||null,lastSeg=segments[segments.length-1]||null;
  const start=firstSeg?.departs_at||travel.starts_at;
  const end=lastSeg?.arrives_at||travel.ends_at||firstSeg?.arrives_at||travel.starts_at;
  const route=[travel.origin||firstSeg?.origin,travel.destination||lastSeg?.destination].filter(Boolean).join(' → ');
  const confirmedHousing=housing.find(h=>['booked','confirmed'].includes(String(h.status||'').toLowerCase()))||null;
  return upsertMobilityEvent(admin,organizationId,userId,{
    key:'mobility_travel_id',value:travel.id,modelId:travel.model_id,title:`✈ ${route||travel.purpose||'Model Travel'}`,
    eventType:'travel',status:travelCalendarStatus(travel.status),startsAt:start,endsAt:end,
    location:travel.destination||lastSeg?.destination||null,
    visibility:travel.visible_to_model!==false?'model_shared':'organization',notes:travel.notes||null,
    metadata:{mobility_kind:'travel',travel_record_id:travel.id,booking_id:travel.booking_id||null,purpose:travel.purpose||null,
      origin:travel.origin||firstSeg?.origin||null,destination:travel.destination||lastSeg?.destination||null,
      travel_status:travel.status||null,segment_count:segments.length,housing_count:housing.length,
      housing_status:confirmedHousing?.status||null,housing_name:confirmedHousing?.property_name||confirmedHousing?.provider||null,
      travel_required:true,visa_required:false,paid_by:travel.paid_by||null,cost_amount:travel.cost_amount||null,currency:travel.currency||'USD'}
  });
}
async function completedTravelLocation(admin,organizationId,modelId){
  if(!modelId)return null;
  const {data,error}=await admin.from('travel_records').select('id,destination,ends_at,starts_at,status').eq('organization_id',organizationId).eq('model_id',modelId).eq('status','completed').order('ends_at',{ascending:false,nullsFirst:false}).limit(1);
  if(error)return null;
  const trip=Array.isArray(data)?data[0]:null;
  return trip?.destination?{location:trip.destination,travel_record_id:trip.id,effective_at:trip.ends_at||trip.starts_at||null,source:'completed_travel'}:null;
}
async function syncVisaCalendar(admin,organizationId,userId,visa){
  if(!visa?.id||!visa?.model_id)return [];
  const out=[],label=[visa.country_code,visa.visa_type||visa.case_type||'Visa'].filter(Boolean).join(' ');
  if(visa.hard_deadline){
    const d=dateOnlyIso(visa.hard_deadline,12);
    out.push(await upsertMobilityEvent(admin,organizationId,userId,{
      key:'mobility_visa_deadline_id',value:visa.id,modelId:visa.model_id,title:`VISA DEADLINE · ${label}`,
      eventType:'visa',status:visaCalendarStatus(visa.status),startsAt:d,endsAt:d,location:visa.consulate||null,
      visibility:visa.visible_to_model!==false?'model_shared':'organization',notes:visa.notes||null,
      metadata:{mobility_kind:'visa_deadline',visa_case_id:visa.id,country_code:visa.country_code||null,visa_type:visa.visa_type||visa.case_type||null,visa_status:visa.status||null,hard_deadline:visa.hard_deadline}
    }));
  }
  if(visa.appointment_at){
    out.push(await upsertMobilityEvent(admin,organizationId,userId,{
      key:'mobility_visa_appointment_id',value:visa.id,modelId:visa.model_id,title:`CONSULATE · ${label}`,
      eventType:'visa',status:visaCalendarStatus(visa.status),startsAt:visa.appointment_at,endsAt:null,location:visa.consulate||null,
      visibility:visa.visible_to_model!==false?'model_shared':'organization',notes:visa.notes||null,
      metadata:{mobility_kind:'visa_appointment',visa_case_id:visa.id,country_code:visa.country_code||null,visa_type:visa.visa_type||visa.case_type||null,visa_status:visa.status||null}
    }));
  }
  return out.filter(Boolean);
}

function isMissingColumn(err){const m=String(err?.message||'');return err?.code==='PGRST204'||err?.code==='42703'||/column .* (does not exist|of relation)|could not find the .* column/i.test(m);}
function legacySegmentPayload(p){const {segment_number,seat,cabin_class,baggage_notes,...rest}=p;const l=[];if(segment_number)l.push('Flight: '+segment_number);if(seat)l.push('Seat: '+seat);if(cabin_class)l.push('Cabin: '+cabin_class);if(baggage_notes)l.push('Baggage: '+baggage_notes);const head=l.join('\n');return {...rest,notes:[head,p.notes].filter(Boolean).join('\n\n')||null};}
function legacyHousingPayload(p){const {city,...rest}=p;return rest;}
async function writeWithFallback(admin,table,id,orgId,payload,legacy){
  const run=p=>id?admin.from(table).update(p).eq('organization_id',orgId).eq('id',id).select('*').single():admin.from(table).insert(p).select('*').single();
  let r=await run(payload);
  if(r.error&&isMissingColumn(r.error)){console.warn('[mobility] '+table+' missing new columns, saving legacy layout:',r.error.message);r=await run(legacy(payload));}
  return r;
}
export const handler=async(event)=>{
  if(!['GET','POST'].includes(event.httpMethod))return json(405,{error:'Method not allowed'});
  try{
    const {user,client}=await requireUser(event);const body=event.httpMethod==='POST'?parseBody(event):{};
    const slug=body.organization_slug||event.queryStringParameters?.organization||'maison-de-veux';
    const {organization}=await requireStaffOrganization({user,client,organizationSlug:slug});
    const admin=await requirePermission(user.id,organization.id,'mobility.read');
    if(event.httpMethod==='GET'){
      const modelId=event.queryStringParameters?.model_id||null;
      const warnings=[];
      // Keep the desk resilient: optional/legacy relationship metadata must never take the whole Mobility page down.
      let passportQ=admin.from('passports').select('*').eq('organization_id',organization.id);if(modelId)passportQ=passportQ.eq('model_id',modelId);
      let visaQ=admin.from('visa_cases').select('*').eq('organization_id',organization.id).order('hard_deadline',{ascending:true});if(modelId)visaQ=visaQ.eq('model_id',modelId);
      let authQ=admin.from('work_authorizations').select('*').eq('organization_id',organization.id);if(modelId)authQ=authQ.eq('model_id',modelId);
      let travelQ=admin.from('travel_records').select('*').eq('organization_id',organization.id).order('starts_at',{ascending:true});if(modelId)travelQ=travelQ.eq('model_id',modelId);
      let housingQ=admin.from('housing_bookings').select('*').eq('organization_id',organization.id).order('check_in_at',{ascending:true});if(modelId)housingQ=housingQ.eq('model_id',modelId);
      const [passports,visaCases,workAuth,travel,housing,checks,models,companies,members,profiles,bookings,castings,markets,bookingModels,castingModels,visaTaskAudit]=await Promise.all([
        safeRows(passportQ,'passports',warnings),
        safeRows(visaQ.limit(500),'visa_cases',warnings),
        safeRows(authQ,'work_authorizations',warnings),
        safeRows(travelQ.limit(500),'travel_records',warnings),
        safeRows(housingQ.limit(500),'housing_bookings',warnings),
        safeRows(admin.from('mobility_readiness_checks').select('*').eq('organization_id',organization.id).order('checked_at',{ascending:false}).limit(250),'readiness_checks',warnings),
        safeRows(admin.from('models').select('id,display_name,public_slug').eq('organization_id',organization.id).eq('active',true).order('display_name').limit(1000),'models',warnings),
        safeRows(admin.from('companies').select('id,name').eq('organization_id',organization.id).order('name').limit(1000),'companies',warnings),
        safeRows(admin.from('organization_members').select('id,job_title,user_id,status,metadata').eq('organization_id',organization.id).eq('member_type','staff').in('status',['active','invited']).limit(500),'members',warnings),
        safeRows(admin.from('profiles').select('user_id,display_name,first_name,last_name').limit(1000),'profiles',warnings),
        safeRows(admin.from('bookings').select('*').eq('organization_id',organization.id).order('starts_at',{ascending:false}).limit(750),'bookings',warnings),
        safeRows(admin.from('castings').select('*').eq('organization_id',organization.id).order('starts_at',{ascending:false}).limit(750),'castings',warnings),
        safeRows(admin.from('markets').select('*').eq('organization_id',organization.id).limit(500),'markets',warnings),
        safeRows(admin.from('booking_models').select('*').eq('organization_id',organization.id).limit(5000),'booking_models',warnings),
        safeRows(admin.from('casting_models').select('*').eq('organization_id',organization.id).limit(5000),'casting_models',warnings),
        safeRows((modelId?admin.from('tasks').select('id,model_id,title,description,due_at,status,category,visibility,metadata,created_at').eq('organization_id',organization.id).eq('model_id',modelId):admin.from('tasks').select('id,model_id,title,description,due_at,status,category,visibility,metadata,created_at').eq('organization_id',organization.id).not('model_id','is',null)).limit(2000),'visa_task_audit',warnings)
      ]);
      const travelIds=travel.map(t=>t.id),visaIds=visaCases.map(v=>v.id);
      const [segments,visaDocuments]=await Promise.all([
        travelIds.length?safeRows(admin.from('travel_segments').select('*').eq('organization_id',organization.id).in('travel_record_id',travelIds).order('departs_at',{ascending:true}),'travel_segments',warnings):[],
        visaIds.length?safeRows(admin.from('visa_case_documents').select('*').in('visa_case_id',visaIds),'visa_case_documents',warnings):[]
      ]);
      // Hydrate display names in application code instead of PostgREST embeds. This avoids ambiguous-FK failures.
      const modelMap=new Map(models.map(m=>[m.id,m]));
      const companyMap=new Map(companies.map(c=>[c.id,c]));
      const profileMap=new Map(profiles.map(p=>[p.user_id,p]));
      const hydrateModel=(r)=>({...r,models:modelMap.get(r.model_id)||null});
      const hydratedPassports=passports.map(hydrateModel);
      const visaFileIds=[...new Set(visaCases.flatMap(v=>Array.isArray(v.metadata?.documents)?v.metadata.documents.map(d=>d.id):[]).filter(Boolean))];
      const visaFileDocs=visaFileIds.length?await safeRows(admin.from('documents').select('id,name,mime_type,storage_provider,storage_bucket,storage_path,external_url,status').eq('organization_id',organization.id).in('id',visaFileIds),'visa_files',warnings):[];
      const visaFileMap=new Map();
      for(const d of visaFileDocs){let url=d.external_url||null;if(d.storage_provider==='supabase'&&d.storage_bucket&&d.storage_path){try{const sg=await admin.storage.from(d.storage_bucket).createSignedUrl(d.storage_path,900);if(!sg.error)url=sg.data?.signedUrl||null;}catch(_e){}}visaFileMap.set(d.id,{id:d.id,name:d.name,mime_type:d.mime_type,url,status:d.status});}
      const visaFilesFor=r=>(Array.isArray(r.metadata?.documents)?r.metadata.documents:[]).map(d=>({...d,...(visaFileMap.get(d.id)||{}),doc_type:d.doc_type||'document',uploaded_at:d.uploaded_at||null})).filter(d=>d.name||d.url);
      const hydratedVisa=visaCases.map(r=>({...hydrateModel(r),companies:companyMap.get(r.sponsor_company_id)||null,documents:visaDocuments.filter(d=>d.visa_case_id===r.id),files:visaFilesFor(r)}));
      const hydratedAuth=workAuth.map(hydrateModel);
      const travelIdSet=new Set(travelIds);
      const scopedSegments=segments.filter(s=>travelIdSet.has(s.travel_record_id));
      const travelLinkRows=travelIds.length?await safeRows(admin.from('document_links').select('document_id,resource_id').eq('organization_id',organization.id).eq('resource_type','travel_record').in('resource_id',travelIds),'travel_doc_links',warnings):[];
      const travelMetaDocs=travel.flatMap(tr=>Array.isArray(tr.metadata?.documents)?tr.metadata.documents.map(d=>({...d,trip:tr.id})):[]);
      const tDocIds=[...new Set([...travelLinkRows.map(l=>l.document_id),...travelMetaDocs.map(d=>d.id)].filter(Boolean))];
      const tDocs=tDocIds.length?await safeRows(admin.from('documents').select('id,name,category,mime_type,storage_provider,storage_bucket,storage_path,external_url,status').eq('organization_id',organization.id).in('id',tDocIds),'travel_files',warnings):[];
      const tDocMap=new Map();
      for(const d of tDocs){if(String(d.status||'')==='archived')continue;let url=d.external_url||null;if(d.storage_provider==='supabase'&&d.storage_bucket&&d.storage_path){try{const sg=await admin.storage.from(d.storage_bucket).createSignedUrl(d.storage_path,900);if(!sg.error)url=sg.data?.signedUrl||null;}catch(_e){}}tDocMap.set(d.id,{id:d.id,name:d.name,mime_type:d.mime_type,url,category:d.category});}
      const travelFilesFor=id=>{const seen=new Set(),out=[];const push=(docId,type)=>{if(!docId||seen.has(docId))return;const d=tDocMap.get(docId);if(!d)return;seen.add(docId);out.push({id:docId,name:d.name,mime_type:d.mime_type,url:d.url,doc_type:type||String(d.category||'').replace(/^travel-/,'')||'other'});};travelLinkRows.filter(l=>l.resource_id===id).forEach(l=>push(l.document_id));travelMetaDocs.filter(d=>d.trip===id).forEach(d=>push(d.id,d.doc_type));return out;};
      const hydratedTravel=travel.map(r=>({...hydrateModel(r),visa_gate:visaGateFor(r,visaCases),files:travelFilesFor(r.id),segments:scopedSegments.filter(s=>s.travel_record_id===r.id),housing:housing.filter(h=>h.travel_record_id===r.id).map(hydrateModel)}));
      const modelTravelCards=hydratedTravel.filter(r=>r.visible_to_model!==false&&String(r.status||'').toLowerCase()!=='cancelled').map(r=>({
        id:r.id,model_id:r.model_id,status:r.status,purpose:r.purpose||null,origin:r.origin||null,destination:r.destination||null,starts_at:r.starts_at||null,ends_at:r.ends_at||null,booking_id:r.booking_id||null,
        segments:(Array.isArray(r.segments)?r.segments:[]).map(s=>({id:s.id,segment_type:s.segment_type,provider:s.provider||null,confirmation_number:s.confirmation_number||null,origin:s.origin||null,destination:s.destination||null,departs_at:s.departs_at||null,arrives_at:s.arrives_at||null})),
        housing:(Array.isArray(r.housing)?r.housing:[]).filter(h=>['booked','confirmed'].includes(String(h.status||'').toLowerCase())).map(h=>({id:h.id,provider:h.provider||null,property_name:h.property_name||null,address:h.address||null,check_in_at:h.check_in_at||null,check_out_at:h.check_out_at||null,confirmation_number:h.confirmation_number||null,room_label:h.room_label||null,status:h.status})),
        calendar_visible:true,acknowledgement_required:['booked','confirmed'].includes(String(r.status||'').toLowerCase())
      }));
      const hydratedHousing=housing.map(hydrateModel);
      const hydratedMembers=members.map(m=>{const p=profileMap.get(m.user_id)||{};return {...m,display_name:p.display_name||[p.first_name,p.last_name].filter(Boolean).join(' ')||m.job_title||'Agency Staff'};});
      const marketMap=new Map((markets||[]).map(m=>[m.id,m]));
      const hydratedBookings=(bookings||[]).map(b=>{const assigned=(bookingModels||[]).filter(x=>x.booking_id===b.id).map(x=>({...x,model:modelMap.get(x.model_id)||null}));const linkedTravel=(travel||[]).filter(x=>String(x.booking_id||'')===String(b.id));const latestChecks=(checks||[]).filter(x=>String(x.booking_id||'')===String(b.id));const needsTravel=Boolean(b.metadata?.travel_required||b.metadata?.booker_handoff?.transport||linkedTravel.length);const travelState=!needsTravel?'not_required':linkedTravel.some(x=>['confirmed','in_progress','completed'].includes(String(x.status||'').toLowerCase()))?'clear':linkedTravel.length?'watch':'missing';const commitment=new Date(b.call_time||b.starts_at),arrivalDates=linkedTravel.map(x=>x.ends_at).filter(Boolean).map(x=>new Date(x)).filter(x=>!isNaN(x));const latestArrival=arrivalDates.length?new Date(Math.max(...arrivalDates.map(x=>x.getTime()))):null,arrivalBufferMinutes=latestArrival&&!isNaN(commitment)?Math.floor((commitment.getTime()-latestArrival.getTime())/60000):null,arrivalStatus=arrivalBufferMinutes==null?'unknown':arrivalBufferMinutes<0?'blocked':arrivalBufferMinutes<180?'critical':arrivalBufferMinutes<360?'watch':'clear';const readinessState=(arrivalStatus==='blocked'||arrivalStatus==='critical'||latestChecks.some(x=>String(x.status||'').toLowerCase()==='blocked'))?'blocked':(arrivalStatus==='watch'||latestChecks.some(x=>String(x.status||'').toLowerCase()==='watch'))?'watch':travelState==='missing'?'action_required':travelState==='watch'?'watch':'clear';return {...b,company:companyMap.get(b.company_id)||null,market:marketMap.get(b.market_id)||null,booking_models:assigned,mobility:{travel_required:needsTravel,travel_status:travelState,linked_travel:linkedTravel,readiness_checks:latestChecks,status:readinessState,arrival_status:arrivalStatus,arrival_buffer_minutes:arrivalBufferMinutes,arrival_at:latestArrival&&latestArrival.toISOString()||null,conflict:arrivalStatus==='blocked'?{severity:'blocked',code:'arrival_after_commitment',message:'Travel arrives after the booking commitment.',recommended_action:'Change travel or move the booking commitment.'}:arrivalStatus==='critical'?{severity:'critical',code:'arrival_buffer_critical',message:'Arrival buffer is under 3 hours.',recommended_action:'Move travel earlier before confirming operational readiness.'}:arrivalStatus==='watch'?{severity:'watch',code:'arrival_buffer_watch',message:'Arrival buffer is under 6 hours.',recommended_action:'Review airport/station transfer and call-time risk.'}:travelState==='missing'?{severity:'action_required',code:'travel_missing',message:'Travel is required but no linked trip exists.',recommended_action:'Create Travel for this booking.'}:null}};});
      const travelRelevantCastingTypes=new Set(['casting','go_see','go_and_see','callback','fitting','test','test_shoot','editorial','campaign','ecommerce','e_commerce','runway','show','showroom','client_meeting','agency_meeting','press','appearance','rehearsal','production','production_day']);
      const normTravelType=v=>String(v||'casting').trim().toLowerCase().replace(/&/g,'and').replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,'');
      const modelCurrentPlace=(modelId)=>{
        const completed=(travel||[]).filter(x=>String(x.model_id)===String(modelId)&&String(x.status||'').toLowerCase()==='completed'&&x.destination).sort((a,b)=>String(b.ends_at||b.starts_at||'').localeCompare(String(a.ends_at||a.starts_at||'')))[0];
        const m=modelMap.get(modelId)||{};
        return completed?.destination||m.current_location||m.location||m.base_city||m.city||'';
      };
      const samePlace=(a,b)=>{const n=v=>String(v||'').toLowerCase().replace(/[^a-z0-9]/g,'');return !!n(a)&&!!n(b)&&(n(a)===n(b)||n(a).includes(n(b))||n(b).includes(n(a)));};
      const castingTravelFor=(c,assigned)=>{
        const target=c.location||c.address||c.city||(marketMap.get(c.market_id)||{}).name||(marketMap.get(c.market_id)||{}).code||'';
        const linked=(travel||[]).filter(x=>String(x.booking_id||'')===String(c.id));
        const confirmed=linked.filter(x=>['confirmed','in_progress','completed'].includes(String(x.status||'').toLowerCase()));
        const origins=assigned.map(x=>modelCurrentPlace(x.model_id)).filter(Boolean);
        const different=!!target&&origins.some(o=>!samePlace(o,target));
        const required=Boolean(c.metadata?.travel_required||linked.length||different);
        const commitment=new Date(c.call_time||c.starts_at);
        const arrivals=linked.map(x=>x.ends_at).filter(Boolean).map(x=>new Date(x)).filter(x=>!isNaN(x));
        const latestArrival=arrivals.length?new Date(Math.max(...arrivals.map(x=>x.getTime()))):null;
        const buffer=latestArrival&&!isNaN(commitment)?Math.floor((commitment.getTime()-latestArrival.getTime())/60000):null;
        const arrivalStatus=buffer==null?'unknown':buffer<0?'blocked':buffer<180?'critical':buffer<360?'watch':'clear';
        const travelStatus=!required?'not_required':confirmed.length?'clear':linked.length?'watch':'missing';
        const conflict=arrivalStatus==='blocked'?{severity:'blocked',code:'arrival_after_commitment',message:'Travel arrives after the casting/commitment.',recommended_action:'Move travel earlier or reschedule the commitment.'}:arrivalStatus==='critical'?{severity:'critical',code:'arrival_buffer_critical',message:'Arrival buffer is under 3 hours.',recommended_action:'Move travel earlier before confirming.'}:arrivalStatus==='watch'?{severity:'watch',code:'arrival_buffer_watch',message:'Arrival buffer is under 6 hours.',recommended_action:'Review transfer time and call-time risk.'}:travelStatus==='missing'?{severity:'action_required',code:'travel_missing',message:'Travel is required but no linked trip exists.',recommended_action:'Create Travel for this casting/commitment.'}:null;
        return {travel_required:required,travel_status:travelStatus,linked_travel:linked,readiness_checks:[],status:arrivalStatus==='blocked'||arrivalStatus==='critical'?'blocked':arrivalStatus==='watch'||travelStatus==='watch'?'watch':travelStatus==='missing'?'action_required':'clear',arrival_status:arrivalStatus,arrival_buffer_minutes:buffer,arrival_at:latestArrival&&latestArrival.toISOString()||null,current_locations:origins,target_location:target,auto_detected:different,conflict};
      };
      const documentReadinessFor=(commitment,assigned,mobility)=>{
        const target=String(mobility?.target_location||commitment.location||commitment.city||(marketMap.get(commitment.market_id)||{}).name||'').trim();
        if(!mobility?.travel_required)return {status:'not_required',passport:'not_checked',visa:'not_checked',work_authorization:'not_checked',issues:[]};
        const issues=[];let passportState='clear',visaState='review',authState='review';
        for(const rel of assigned){
          const mid=rel.model_id,passport=(passports||[]).filter(x=>String(x.model_id)===String(mid)).sort((a,b)=>String(b.expires_on||b.expiry_date||'').localeCompare(String(a.expires_on||a.expiry_date||'')))[0];
          if(!passport){passportState='missing';issues.push({model_id:mid,severity:'blocked',code:'passport_missing',message:'No passport is recorded for this model.'});}
          else{
            const exp=new Date(passport.expires_on||passport.expiry_date||passport.expires_at||'');
            const trip=new Date(commitment.starts_at||commitment.call_time||Date.now());
            if(!isNaN(exp)&&!isNaN(trip)){
              const days=Math.floor((exp.getTime()-trip.getTime())/86400000);
              if(days<0){passportState='expired';issues.push({model_id:mid,severity:'blocked',code:'passport_expired',message:'Passport expires before this commitment.'});}
              else if(days<180){passportState='watch';issues.push({model_id:mid,severity:'watch',code:'passport_validity',message:'Passport has less than 6 months validity at travel.'});}
            }
          }
          const activeVisa=(visaCases||[]).find(x=>String(x.model_id)===String(mid)&&['approved','issued','active','valid'].includes(String(x.status||'').toLowerCase()));
          const activeAuth=(workAuth||[]).find(x=>String(x.model_id)===String(mid)&&['approved','issued','active','valid'].includes(String(x.status||'').toLowerCase()));
          if(activeVisa)visaState='clear';
          if(activeAuth)authState='clear';
        }
        const blocked=issues.some(x=>x.severity==='blocked'),watch=issues.some(x=>x.severity==='watch');
        return {status:blocked?'blocked':watch?'watch':(visaState==='clear'||authState==='clear')?'clear':'review',passport:passportState,visa:visaState,work_authorization:authState,target_location:target,issues};
      };
      const hydratedCastings=(castings||[]).filter(c=>travelRelevantCastingTypes.has(normTravelType(c.casting_type||c.type||c.metadata?.legacy_type||'casting'))).map(c=>{const assigned=(castingModels||[]).filter(x=>x.casting_id===c.id).map(x=>({...x,model:modelMap.get(x.model_id)||null}));const mobility=castingTravelFor(c,assigned),documents=documentReadinessFor(c,assigned,mobility);if(documents.status==='blocked')mobility.status='blocked';else if(documents.status==='watch'&&mobility.status==='clear')mobility.status='watch';return {...c,_travel_source:'casting',travel_source_type:normTravelType(c.casting_type||c.type||c.metadata?.legacy_type||'casting'),company:companyMap.get(c.company_id)||null,market:marketMap.get(c.market_id)||null,booking_models:assigned,mobility:{...mobility,documents}};});
      const travelCommitments=[...hydratedBookings.map(b=>({...b,_travel_source:'booking',travel_source_type:'booking'})),...hydratedCastings].sort((a,b)=>String(b.starts_at||'').localeCompare(String(a.starts_at||'')));
      const linkedVisaTaskIds=new Set(visaCases.map(v=>v?.metadata?.source_task_id).filter(Boolean).map(String));
      const canonicalVisaModelIds=new Set(visaCases.map(v=>v.model_id).filter(Boolean).map(String));
      const visaGapByModel=new Map();
      for(const task of (visaTaskAudit||[])){
        const text=`${task.title||''} ${task.category||''}`.toLowerCase();
        if(!task.model_id||!text.includes('visa')||['done','completed','cancelled'].includes(String(task.status||'').toLowerCase())||linkedVisaTaskIds.has(String(task.id))||canonicalVisaModelIds.has(String(task.model_id)))continue;
        const score=(/visa & documents/i.test(task.category||'')?20:0)+(/documentation|application|interview|appointment|status/i.test(task.title||'')?10:0)+(task.visibility==='model_shared'?2:0);
        const prior=visaGapByModel.get(task.model_id);
        if(!prior||score>prior.__score||(score===prior.__score&&String(task.created_at||'')>String(prior.created_at||'')))visaGapByModel.set(task.model_id,{...task,__score:score});
      }
      const unlinkedVisaTasks=[...visaGapByModel.values()].map(({__score,...task})=>({...task,models:modelMap.get(task.model_id)||null})).sort((a,b)=>String(a.models?.display_name||'').localeCompare(String(b.models?.display_name||'')));
      return json(200,{environment:'veux-desk-v16.9.20-visa-integrity',organization,passports:hydratedPassports,visa_cases:hydratedVisa,work_authorizations:hydratedAuth,travel:hydratedTravel,model_travel_cards:modelTravelCards,travel_segments:scopedSegments,housing:hydratedHousing,readiness_checks:checks,lookups:{models,companies,markets,members:hydratedMembers,bookings:travelCommitments,booking_records:hydratedBookings,castings:hydratedCastings},integrity:{canonical_visa_table:'visa_cases',save_target:'visa_cases',unlinked_visa_tasks:unlinkedVisaTasks},warnings});
    }
    const action=String(body.action||'');
    if(action==='check_model'){
      if(!body.model_id||!body.country_code){const e=new Error('model_id and country_code are required');e.statusCode=400;throw e;}
      const targetDate=body.target_date||new Date().toISOString().slice(0,10);
      const {data:result,error}=await client.rpc('evaluate_model_mobility',{target_org:organization.id,target_model:body.model_id,target_country:countryCode(body.country_code),target_date:targetDate,target_market:body.market_id||null});if(error)throw error;
      if(body.persist){await requirePermission(user.id,organization.id,'mobility.write');let travelStatus='unknown',arrivalBufferMinutes=null,arrivalStatus='unknown',arrivalAt=null;if(body.booking_id){const [{data:linkedTrips,error:te},{data:bookingRow,error:be}]=await Promise.all([admin.from('travel_records').select('id,status,starts_at,ends_at').eq('organization_id',organization.id).eq('booking_id',body.booking_id).eq('model_id',body.model_id),admin.from('bookings').select('id,starts_at,call_time').eq('organization_id',organization.id).eq('id',body.booking_id).maybeSingle()]);if(te)throw te;if(be)throw be;travelStatus=(linkedTrips||[]).some(x=>['confirmed','in_progress','completed'].includes(String(x.status||'').toLowerCase()))?'clear':(linkedTrips||[]).length?'watch':'missing';const arrivals=(linkedTrips||[]).map(x=>x.ends_at).filter(Boolean).map(x=>new Date(x)).filter(x=>!isNaN(x));const commitment=bookingRow&&new Date(bookingRow.call_time||bookingRow.starts_at);if(arrivals.length&&commitment&&!isNaN(commitment)){const latestArrival=new Date(Math.max(...arrivals.map(x=>x.getTime())));arrivalAt=latestArrival.toISOString();arrivalBufferMinutes=Math.floor((commitment.getTime()-latestArrival.getTime())/60000);arrivalStatus=arrivalBufferMinutes<0?'blocked':arrivalBufferMinutes<180?'critical':arrivalBufferMinutes<360?'watch':'clear';if(arrivalStatus==='blocked')travelStatus='blocked';else if(arrivalStatus==='critical')travelStatus='critical';else if(arrivalStatus==='watch'&&travelStatus==='clear')travelStatus='watch';}}const finalStatus=(result.status==='blocked'||result.status==='action_required')?result.status:(travelStatus==='blocked'||travelStatus==='critical'?'blocked':travelStatus==='missing'?'action_required':travelStatus==='watch'?'watch':result.status);const reasons=[...(result.reasons||[])];if(travelStatus==='missing')reasons.push('Booking requires a linked Travel record.');if(travelStatus==='watch'&&arrivalStatus!=='watch')reasons.push('Linked Travel exists but is not yet confirmed.');if(arrivalStatus==='blocked')reasons.push('Travel arrives after the booking commitment.');if(arrivalStatus==='critical')reasons.push('Arrival buffer is under 3 hours.');if(arrivalStatus==='watch')reasons.push('Arrival buffer is under 6 hours.');const {error:pe}=await admin.from('mobility_readiness_checks').insert({organization_id:organization.id,model_id:body.model_id,booking_id:body.booking_id||null,market_id:body.market_id||null,country_code:countryCode(body.country_code),status:finalStatus,passport_status:result.passport_ok?'clear':'blocked',work_authorization_status:result.work_authorization_ok?'clear':'missing',visa_status:result.visa_ok?'clear':'missing',travel_status:travelStatus,reasons,checked_by:user.id});if(pe)throw pe;result.status=finalStatus;result.travel_status=travelStatus;result.arrival_status=arrivalStatus;result.arrival_buffer_minutes=arrivalBufferMinutes;result.arrival_at=arrivalAt;result.reasons=reasons;}
      return json(200,{ok:true,verified:body.persist?true:undefined,readiness:result,persisted_at:body.persist?new Date().toISOString():null});
    }
    await requirePermission(user.id,organization.id,'mobility.write');
    if(action==='save_passport'){
      const payload={organization_id:organization.id,model_id:body.model_id,country_code:countryCode(body.country_code),passport_number_masked:body.passport_number_masked||null,issued_on:body.issued_on||null,expires_on:body.expires_on||null,status:oneOf(body.status,['active','expired','renewing','lost','cancelled'],'active'),visible_to_model:body.visible_to_model!==false,visible_to_partner:body.visible_to_partner===true};
      if(!payload.model_id)throw validationError('model_id is required.');
      validateRange(payload.issued_on,payload.expires_on,'Issue date','Expiry date');
      let q=body.id?admin.from('passports').update(payload).eq('organization_id',organization.id).eq('id',body.id):admin.from('passports').insert(payload);const {data,error}=await q.select('*').single();if(error)throw error;const notification_warning=await notifyMobilityStateSafe(admin,organization.id,data,'passport');return json(200,{ok:true,verified:true,passport:data,notification_warning,persisted_at:data?.updated_at||data?.created_at||new Date().toISOString()});
    }
    if(action==='save_visa'){
      const payload={organization_id:organization.id,model_id:body.model_id,country_code:countryCode(body.country_code),visa_type:body.visa_type||null,case_type:oneOf(body.case_type,['visa','residency','work_permit','eta','other'],'visa',{work_visa:'work_permit',business_visa:'visa',residence:'residency',schengen:'visa'}),status:oneOf(body.status,['not_started','gathering_documents','appointment_pending','submitted','processing','approved','issued','refused','expired','cancelled'],'not_started'),sponsor_company_id:body.sponsor_company_id||null,assigned_member_id:body.assigned_member_id||null,appointment_at:body.appointment_at||null,submitted_on:body.submitted_on||null,approved_on:body.approved_on||null,issued_on:body.issued_on||null,valid_from:body.valid_from||null,expires_on:body.expires_on||null,hard_deadline:body.hard_deadline||null,reference_number:body.reference_number||null,consulate:body.consulate||null,notes:body.notes||null,visible_to_model:body.visible_to_model!==false,visible_to_partner:body.visible_to_partner!==false};
      if(!payload.model_id)throw validationError('model_id is required.');
      {const auto=VISA_AUTO_DATES[payload.status];if(auto&&!payload[auto])payload[auto]=new Date().toISOString().slice(0,10);}
      if(payload.status==='approved'&&!payload.approved_on)payload.approved_on=new Date().toISOString().slice(0,10);
      {let meta=null;
        if(body.id){const {data:cur,error:curErr}=await admin.from('visa_cases').select('metadata').eq('organization_id',organization.id).eq('id',body.id).maybeSingle();if(curErr)throw curErr;meta=cur?.metadata&&typeof cur.metadata==='object'?{...cur.metadata}:{};}
        const addDocs=Array.isArray(body.add_documents)?body.add_documents:[],rmDocs=new Set(Array.isArray(body.remove_document_ids)?body.remove_document_ids.map(String):[]);
        if(addDocs.length||rmDocs.size){meta=meta||{};let list=Array.isArray(meta.documents)?meta.documents.filter(d=>!rmDocs.has(String(d.id))):[];for(const d of addDocs){if(!d||!d.id||list.some(x=>x.id===d.id))continue;list.push({id:String(d.id),name:String(d.name||'Document').slice(0,200),doc_type:String(d.doc_type||'document').slice(0,40),uploaded_at:new Date().toISOString()});}meta.documents=list;}
        if(meta)payload.metadata={...(payload.metadata||{}),...meta};}
      for(const [value,label] of [[payload.appointment_at,'Appointment'],[payload.submitted_on,'Submitted date'],[payload.approved_on,'Approved date'],[payload.issued_on,'Issued date'],[payload.valid_from,'Valid from'],[payload.expires_on,'Expiry date'],[payload.hard_deadline,'Hard deadline']])validateTemporal(value,label);
      validateRange(payload.valid_from,payload.expires_on,'Valid from','Expiry date');
      if(body.source_task_id){const {data:sourceTask,error:sourceError}=await admin.from('tasks').select('id,model_id,title').eq('organization_id',organization.id).eq('id',body.source_task_id).maybeSingle();if(sourceError)throw sourceError;if(!sourceTask)throw validationError('Source visa task was not found.','MOBILITY_VISA_SOURCE_TASK_MISSING');if(sourceTask.model_id!==payload.model_id)throw validationError('Source visa task belongs to a different model.','MOBILITY_VISA_SOURCE_TASK_MODEL_MISMATCH');payload.metadata={source:'visa_task_recovery',source_task_id:sourceTask.id,source_task_title:sourceTask.title,recovered_at:new Date().toISOString()};}
      let q=body.id?admin.from('visa_cases').update(payload).eq('organization_id',organization.id).eq('id',body.id):admin.from('visa_cases').insert(payload);const {data,error}=await q.select('*').single();if(error)throw error;const calendar_events=await syncVisaCalendar(admin,organization.id,user.id,data);const notification_warning=await notifyMobilityStateSafe(admin,organization.id,data,'visa');return json(200,{ok:true,verified:true,visa_case:data,calendar_synced:calendar_events.length>0,calendar_events,notification_warning,persisted_at:data?.updated_at||data?.created_at||new Date().toISOString()});
    }
    if(action==='set_visa_status'){
      const st=oneOf(body.status,['not_started','gathering_documents','appointment_pending','submitted','processing','approved','issued','refused','expired','cancelled'],null);
      if(!body.id||!st)throw validationError('id and a valid status are required.');
      const patch={status:st};const today=new Date().toISOString().slice(0,10);
      const {data:cur,error:curErr}=await admin.from('visa_cases').select('*').eq('organization_id',organization.id).eq('id',body.id).maybeSingle();if(curErr)throw curErr;if(!cur)throw validationError('Visa case not found.');
      const auto=VISA_AUTO_DATES[st];if(auto&&!cur[auto])patch[auto]=today;
      if(st==='issued'&&!cur.approved_on)patch.approved_on=today;
      const {data,error}=await admin.from('visa_cases').update(patch).eq('organization_id',organization.id).eq('id',body.id).select('*').single();if(error)throw error;
      const calendar_events=await syncVisaCalendar(admin,organization.id,user.id,data);const notification_warning=await notifyMobilityStateSafe(admin,organization.id,data,'visa');
      return json(200,{ok:true,verified:true,visa_case:data,calendar_events,notification_warning,persisted_at:data?.updated_at||new Date().toISOString()});
    }
    if(action==='save_travel'){
      const payload={organization_id:organization.id,model_id:body.model_id,booking_id:body.booking_id||null,season_id:body.season_id||null,purpose:body.purpose||null,origin:body.origin||null,destination:String(body.destination||'').trim(),starts_at:body.starts_at||null,ends_at:body.ends_at||null,status:oneOf(body.status,['planning','requested','booked','confirmed','in_progress','completed','cancelled'],'planning'),assigned_member_id:body.assigned_member_id||null,cost_amount:moneyValue(body.cost_amount),currency:currencyCode(body.currency),paid_by:body.paid_by?oneOf(body.paid_by,['agency','model','mother_agency','client','split','other'],null):null,visible_to_model:body.visible_to_model!==false,visible_to_partner:body.visible_to_partner!==false,notes:body.notes||null};
      if(!payload.model_id||!payload.destination)throw validationError('model_id and destination are required.');
      if(!payload.starts_at)throw validationError('Travel start date/time is required.');
      if(['booked','confirmed','in_progress'].includes(payload.status)){
        const visas=await rows(admin.from('visa_cases').select('id,model_id,country_code,visa_type,status,expires_on').eq('organization_id',organization.id).eq('model_id',payload.model_id));
        const gate=visaGateFor(payload,visas);
        if(gate.state==='pending'||gate.state==='expired')throw validationError(`Travel cannot be ${payload.status} yet. ${gate.message}`,'MOBILITY_VISA_NOT_APPROVED');
      }
      validateRange(payload.starts_at,payload.ends_at,'Start date/time','End date/time');
      if(payload.booking_id){
        let linked=null,assigned=false;
        const {data:booking}=await admin.from('bookings').select('id').eq('organization_id',organization.id).eq('id',payload.booking_id).maybeSingle();
        if(booking){
          linked='booking';
          const {data:bm}=await admin.from('booking_models').select('model_id').eq('organization_id',organization.id).eq('booking_id',payload.booking_id).eq('model_id',payload.model_id).maybeSingle();
          assigned=!!bm;
        }else{
          const {data:casting}=await admin.from('castings').select('id').eq('organization_id',organization.id).eq('id',payload.booking_id).maybeSingle();
          if(casting){
            linked='casting';
            const {data:cm}=await admin.from('casting_models').select('model_id').eq('organization_id',organization.id).eq('casting_id',payload.booking_id).eq('model_id',payload.model_id).maybeSingle();
            assigned=!!cm;
          }
        }
        if(!linked)throw validationError('Linked booking/casting was not found.');
        if(!assigned)throw validationError('Selected model is not assigned to the linked booking/casting.');
      }
      let q=body.id?admin.from('travel_records').update(payload).eq('organization_id',organization.id).eq('id',body.id):admin.from('travel_records').insert(payload);const {data,error}=await q.select('*').single();if(error)throw error;const calendar_event=await syncTravelCalendar(admin,organization.id,user.id,data);const effective_location=payload.status==='completed'?await completedTravelLocation(admin,organization.id,payload.model_id):null;const notification_warning=await notifyMobilityStateSafe(admin,organization.id,data,'travel');await logModelActivity(admin,{organization_id:organization.id,model_id:payload.model_id,kind:'travel',title:body.id?'Trip updated':'Trip created',detail:[payload.origin,payload.destination].filter(Boolean).join(' → ')||payload.purpose||null,...(await actorFor(admin,user)),link_page:'logistics',link_id:data?.id});return json(200,{ok:true,verified:true,travel:data,calendar_synced:!!calendar_event,calendar_event,effective_location,location_updated:!!effective_location,notification_warning,persisted_at:data?.updated_at||data?.created_at||new Date().toISOString()});
    }
    if(action==='save_travel_segment'){
      const payload={organization_id:organization.id,travel_record_id:body.travel_record_id,segment_type:oneOf(body.segment_type,['flight','train','car','transfer','other'],'flight',{bus:'other',ferry:'other'}),provider:body.provider||null,segment_number:body.segment_number||null,confirmation_number:body.confirmation_number||null,origin:body.origin||null,destination:body.destination||null,departs_at:body.departs_at||null,arrives_at:body.arrives_at||null,seat:body.seat||null,cabin_class:body.cabin_class||null,baggage_notes:body.baggage_notes||null,cost_amount:moneyValue(body.cost_amount),currency:currencyCode(body.currency),notes:body.notes||null};
      if(!payload.travel_record_id)throw validationError('travel_record_id is required.');
      validateRange(payload.departs_at,payload.arrives_at,'Departure','Arrival');
      const {data:trip,error:te}=await admin.from('travel_records').select('id,model_id').eq('organization_id',organization.id).eq('id',payload.travel_record_id).maybeSingle();if(te)throw te;if(!trip)return json(404,{error:'Travel record not found'});
      const {data,error}=await writeWithFallback(admin,'travel_segments',body.id,organization.id,payload,legacySegmentPayload);if(error)throw error;const {data:freshTrip,error:freshTripError}=await admin.from('travel_records').select('*').eq('organization_id',organization.id).eq('id',payload.travel_record_id).single();if(freshTripError)throw freshTripError;const calendar_event=await syncTravelCalendar(admin,organization.id,user.id,freshTrip);return json(200,{ok:true,verified:true,travel_segment:data,calendar_synced:!!calendar_event,calendar_event,persisted_at:data?.updated_at||data?.created_at||new Date().toISOString()});
    }
    if(action==='attach_travel_documents'){
      const tripId=String(body.travel_record_id||'').trim(),docs=(Array.isArray(body.documents)?body.documents:[]).filter(d=>d&&d.id).slice(0,40);
      if(!tripId||!docs.length)throw validationError('travel_record_id and documents are required.');
      const {data:trip,error:te}=await admin.from('travel_records').select('id,metadata').eq('organization_id',organization.id).eq('id',tripId).maybeSingle();if(te)throw te;if(!trip)return json(404,{error:'Travel record not found'});
      let linked=true;
      for(const d of docs){const ins=await admin.from('document_links').insert({organization_id:organization.id,document_id:d.id,resource_type:'travel_record',resource_id:tripId,relationship:'attachment',visible_to_model:false,visible_to_partner:false});if(ins.error){console.warn('[mobility] document_links insert failed, using trip metadata:',ins.error.message);linked=false;break;}}
      if(linked){for(const d of docs){try{await admin.from('documents').update({category:'travel-'+String(d.doc_type||'other').slice(0,30)}).eq('organization_id',organization.id).eq('id',d.id);}catch(_e){}}}
      else{
        await admin.from('document_links').delete().eq('organization_id',organization.id).eq('resource_type','travel_record').eq('resource_id',tripId).in('document_id',docs.map(d=>d.id));
        const meta=trip.metadata&&typeof trip.metadata==='object'?{...trip.metadata}:{};const list=Array.isArray(meta.documents)?meta.documents.slice():[];
        for(const d of docs){if(!list.some(x=>x.id===d.id))list.push({id:String(d.id),name:String(d.name||'Document').slice(0,200),doc_type:String(d.doc_type||'other').slice(0,40),uploaded_at:new Date().toISOString()});}
        meta.documents=list;const up=await admin.from('travel_records').update({metadata:meta}).eq('organization_id',organization.id).eq('id',tripId);
        if(up.error){console.error('[mobility] attach travel documents failed:',up.error.message);const e=new Error(up.error.message);e.statusCode=500;e.publicMessage='Documents could not be attached to the trip: '+String(up.error.message||'').slice(0,160);throw e;}
      }
      return json(200,{ok:true,verified:true,attached:docs.length,persisted_at:new Date().toISOString()});
    }
    if(action==='remove_travel_document'){
      const tripId=String(body.travel_record_id||'').trim(),docId=String(body.document_id||'').trim();
      if(!tripId||!docId)throw validationError('travel_record_id and document_id are required.');
      try{await admin.from('document_links').delete().eq('organization_id',organization.id).eq('resource_type','travel_record').eq('resource_id',tripId).eq('document_id',docId);}catch(_e){}
      const {data:trip}=await admin.from('travel_records').select('metadata').eq('organization_id',organization.id).eq('id',tripId).maybeSingle();
      if(trip&&Array.isArray(trip.metadata?.documents)&&trip.metadata.documents.some(x=>String(x.id)===docId)){const meta={...trip.metadata,documents:trip.metadata.documents.filter(x=>String(x.id)!==docId)};await admin.from('travel_records').update({metadata:meta}).eq('organization_id',organization.id).eq('id',tripId);}
      try{await admin.from('documents').update({status:'archived'}).eq('organization_id',organization.id).eq('id',docId);}catch(_e){}
      return json(200,{ok:true,verified:true,removed:true});
    }
    if(action==='delete_travel_segment'){
      if(!body.id)throw validationError('id is required.');
      const {data:seg,error:se}=await admin.from('travel_segments').select('id,travel_record_id').eq('organization_id',organization.id).eq('id',body.id).maybeSingle();if(se)throw se;if(!seg)return json(200,{ok:true,verified:true,deleted:false});
      const {error:de}=await admin.from('travel_segments').delete().eq('organization_id',organization.id).eq('id',body.id);if(de)throw de;
      let calendar_event=null;try{const {data:trip}=await admin.from('travel_records').select('*').eq('organization_id',organization.id).eq('id',seg.travel_record_id).maybeSingle();if(trip)calendar_event=await syncTravelCalendar(admin,organization.id,user.id,trip);}catch(_e){}
      return json(200,{ok:true,verified:true,deleted:true,calendar_synced:!!calendar_event});
    }
    if(action==='delete_housing'){
      if(!body.id)throw validationError('id is required.');
      const {data:hs,error:he}=await admin.from('housing_bookings').select('id,travel_record_id').eq('organization_id',organization.id).eq('id',body.id).maybeSingle();if(he)throw he;if(!hs)return json(200,{ok:true,verified:true,deleted:false});
      const {error:de}=await admin.from('housing_bookings').delete().eq('organization_id',organization.id).eq('id',body.id);if(de)throw de;
      let calendar_event=null;try{if(hs.travel_record_id){const {data:trip}=await admin.from('travel_records').select('*').eq('organization_id',organization.id).eq('id',hs.travel_record_id).maybeSingle();if(trip)calendar_event=await syncTravelCalendar(admin,organization.id,user.id,trip);}}catch(_e){}
      return json(200,{ok:true,verified:true,deleted:true,calendar_synced:!!calendar_event});
    }
    if(action==='save_housing'){
      const payload={organization_id:organization.id,model_id:body.model_id,travel_record_id:body.travel_record_id||null,provider:body.provider||null,property_name:body.property_name||null,address:body.address||null,city:body.city||null,check_in_at:body.check_in_at||null,check_out_at:body.check_out_at||null,confirmation_number:body.confirmation_number||null,room_label:body.room_label||null,roommate_notes:body.roommate_notes||null,cost_amount:moneyValue(body.cost_amount),currency:currencyCode(body.currency),paid_by:body.paid_by?oneOf(body.paid_by,['agency','model','mother_agency','client','split','other'],null):null,status:oneOf(body.status,['planning','requested','booked','confirmed','completed','cancelled'],'planning',{checked_in:'confirmed'}),visible_to_model:body.visible_to_model!==false,visible_to_partner:body.visible_to_partner!==false,notes:body.notes||null};
      if(!payload.model_id)throw validationError('model_id is required.');
      validateRange(payload.check_in_at,payload.check_out_at,'Check-in','Check-out');
      if(payload.travel_record_id){const {data:trip,error:te}=await admin.from('travel_records').select('id,model_id').eq('organization_id',organization.id).eq('id',payload.travel_record_id).maybeSingle();if(te)throw te;if(!trip)return json(404,{error:'Travel record not found'});if(trip.model_id!==payload.model_id)return json(400,{error:'Accommodation model must match linked travel record'});}
      const {data,error}=await writeWithFallback(admin,'housing_bookings',body.id,organization.id,payload,legacyHousingPayload);if(error)throw error;let calendar_event=null;if(data.travel_record_id){const {data:freshTrip,error:freshTripError}=await admin.from('travel_records').select('*').eq('organization_id',organization.id).eq('id',data.travel_record_id).maybeSingle();if(freshTripError)throw freshTripError;if(freshTrip)calendar_event=await syncTravelCalendar(admin,organization.id,user.id,freshTrip);}const notification_warning=await notifyMobilityStateSafe(admin,organization.id,data,'housing');return json(200,{ok:true,verified:true,housing:data,calendar_synced:!!calendar_event,calendar_event,notification_warning,persisted_at:data?.updated_at||data?.created_at||new Date().toISOString()});
    }
    if(action==='save_work_authorization'){
      const payload={organization_id:organization.id,model_id:body.model_id,country_code:countryCode(body.country_code),authorization_type:body.authorization_type||'work_permit',status:oneOf(body.status,['unknown','valid','pending','expired','not_eligible','restricted'],'unknown',{not_required:'valid',active:'valid',approved:'valid',refused:'not_eligible'}),valid_from:body.valid_from||null,expires_on:body.expires_on||null,restrictions:body.restrictions||null,visible_to_model:body.visible_to_model!==false,visible_to_partner:body.visible_to_partner!==false};
      if(!payload.model_id)throw validationError('model_id is required.');
      validateRange(payload.valid_from,payload.expires_on,'Valid from','Expiry date');
      let q=body.id?admin.from('work_authorizations').update(payload).eq('organization_id',organization.id).eq('id',body.id):admin.from('work_authorizations').insert(payload);const {data,error}=await q.select('*').single();if(error)throw error;const notification_warning=await notifyMobilityStateSafe(admin,organization.id,data,'work_authorization');return json(200,{ok:true,verified:true,work_authorization:data,notification_warning,persisted_at:data?.updated_at||data?.created_at||new Date().toISOString()});
    }
    return json(400,{error:'Unsupported mobility action'});
  }catch(error){return errorResponse(error);}
};
