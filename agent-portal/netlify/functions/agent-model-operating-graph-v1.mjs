import { requireUser, json, errorResponse } from './_lib/auth.mjs';
import { requireStaffOrganization, requirePermission } from './_lib/agent-bridge.mjs';

async function safeRows(query, source, warnings){
  try{const {data,error}=await query;if(error)throw error;return data||[];}
  catch(error){warnings.push({source,message:error?.message||String(error),code:error?.code||null});return [];}
}
async function safeOne(query, source, warnings){
  const rows=await safeRows(query,source,warnings);return Array.isArray(rows)?(rows[0]||null):rows||null;
}
function iso(v){if(!v)return null;const d=new Date(v);return Number.isNaN(d.getTime())?null:d.toISOString();}
function activeStatus(v){const s=String(v||'').toLowerCase();return !['cancelled','canceled','closed','released','declined','archived'].includes(s);}
function future(v){const t=Date.parse(v||'');return Number.isFinite(t)&&t>=Date.now();}
function when(row){return row?.slot_at||row?.starts_at||row?.appointment_at||row?.hard_deadline||row?.due_at||row?.arrival_at||row?.created_at||null;}
function summarize({model,availability,bookings,bookingModels,castings,castingModels,travel,visa,tasks,events,seasons,seasonModels,shows,showModels}){
  const bookingMap=new Map(bookings.map(x=>[String(x.id),x]));
  const castingMap=new Map(castings.map(x=>[String(x.id),x]));
  const seasonMap=new Map(seasons.map(x=>[String(x.id),x]));
  const showMap=new Map(shows.map(x=>[String(x.id),x]));
  const commitments=[];
  for(const link of bookingModels){const b=bookingMap.get(String(link.booking_id));if(b&&activeStatus(b.status)&&activeStatus(link.status))commitments.push({kind:'booking',id:b.id,title:b.title||'Booking',status:link.status||b.status,starts_at:b.starts_at,ends_at:b.ends_at,location:b.location||null,market_id:b.market_id||null});}
  for(const link of castingModels){const c=castingMap.get(String(link.casting_id));if(c&&activeStatus(c.status)&&activeStatus(link.status))commitments.push({kind:'casting',id:c.id,title:c.title||'Casting',status:link.status||c.status,starts_at:link.slot_at||c.starts_at,ends_at:c.ends_at,location:c.location||null,market_id:c.market_id||null});}
  for(const t of travel){if(activeStatus(t.status))commitments.push({kind:'travel',id:t.id,title:[t.origin,t.destination].filter(Boolean).join(' → ')||t.purpose||'Travel',status:t.status,starts_at:t.starts_at,ends_at:t.ends_at,location:t.destination||null,booking_id:t.booking_id||null});}
  for(const v of visa){if(activeStatus(v.status)){if(v.appointment_at)commitments.push({kind:'visa',id:v.id,title:`Visa appointment · ${v.country_code||v.visa_type||''}`.trim(),status:v.status,starts_at:v.appointment_at,location:v.consulate||null});if(v.hard_deadline)commitments.push({kind:'visa_deadline',id:v.id,title:`Visa deadline · ${v.country_code||v.visa_type||''}`.trim(),status:v.status,starts_at:v.hard_deadline,location:v.consulate||null});}}
  for(const e of events){if(activeStatus(e.status))commitments.push({kind:e.event_type||'event',id:e.id,title:e.title||'Event',status:e.status,starts_at:e.starts_at,ends_at:e.ends_at,location:e.location||null,market_id:e.market_id||null});}
  commitments.sort((a,b)=>Date.parse(a.starts_at||'9999')-Date.parse(b.starts_at||'9999'));
  const upcoming=commitments.filter(x=>future(x.starts_at)).slice(0,12);
  const openTasks=tasks.filter(t=>activeStatus(t.status));
  const visaRisk=visa.filter(v=>activeStatus(v.status)&&v.hard_deadline&&Date.parse(v.hard_deadline)>=Date.now()&&Date.parse(v.hard_deadline)<=Date.now()+14*86400000);
  const currentTravel=travel.find(t=>activeStatus(t.status)&&Date.parse(t.starts_at||'')<=Date.now()&&Date.parse(t.ends_at||'9999-12-31')>=Date.now())||null;
  const completedTravel=travel.filter(t=>String(t.status||'').toLowerCase()==='completed'&&t.destination).sort((a,b)=>Date.parse(b.ends_at||b.starts_at||0)-Date.parse(a.ends_at||a.starts_at||0))[0]||null;
  const currentLocation=currentTravel?.destination||completedTravel?.destination||model?.primary_market_label||null;
  const activeSeasonLinks=seasonModels.filter(sm=>activeStatus(sm.status)).map(sm=>({ ...sm, season:seasonMap.get(String(sm.season_id))||null }));
  const showAssignments=showModels.map(sm=>({ ...sm, show:showMap.get(String(sm.season_show_id))||null })).filter(x=>x.show);
  const blockedAvailability=availability.filter(a=>activeStatus(a.status));
  return {
    model_id:model?.id||null,
    current_location:currentLocation,
    next_commitment:upcoming[0]||null,
    upcoming_commitments:upcoming,
    open_tasks:openTasks.length,
    visa_risk_count:visaRisk.length,
    active_seasons:activeSeasonLinks.length,
    show_assignments:showAssignments.length,
    availability_blocks:blockedAvailability.length,
    booking_count:bookingModels.filter(x=>activeStatus(x.status)).length,
    casting_count:castingModels.filter(x=>activeStatus(x.status)).length,
    travel_active:travel.filter(x=>activeStatus(x.status)).length,
    status:visaRisk.length?'attention':openTasks.some(t=>String(t.priority||'').toLowerCase()==='urgent')?'attention':upcoming.length?'active':'clear'
  };
}

export const handler=async(event)=>{
  if(event.httpMethod!=='GET')return json(405,{error:'Method not allowed'});
  try{
    const {user,client}=await requireUser(event);
    const p=event.queryStringParameters||{};
    const {organization}=await requireStaffOrganization({user,client,organizationSlug:p.organization||'maison-de-veux'});
    const admin=await requirePermission(user.id,organization.id,'roster.read');
    const modelId=String(p.model_id||'').trim();
    if(!modelId)return json(400,{error:'model_id is required'});
    const warnings=[];
    const model=await safeOne(admin.from('models').select('*').eq('organization_id',organization.id).eq('id',modelId).limit(1),'models',warnings);
    if(!model)return json(404,{error:'Model not found'});
    const [availability,bookingModels,castingModels,travel,visa,tasks,eventModels,seasonModels,showModels,options,workAuthorizations,passports,markets]=await Promise.all([
      safeRows(admin.from('availability_blocks').select('*').eq('organization_id',organization.id).eq('model_id',modelId).order('starts_at',{ascending:true}).limit(1000),'availability_blocks',warnings),
      safeRows(admin.from('booking_models').select('*').eq('organization_id',organization.id).eq('model_id',modelId).limit(1500),'booking_models',warnings),
      safeRows(admin.from('casting_models').select('*').eq('organization_id',organization.id).eq('model_id',modelId).limit(1500),'casting_models',warnings),
      safeRows(admin.from('travel_records').select('*').eq('organization_id',organization.id).eq('model_id',modelId).order('starts_at',{ascending:true}).limit(1000),'travel_records',warnings),
      safeRows(admin.from('visa_cases').select('*').eq('organization_id',organization.id).eq('model_id',modelId).order('hard_deadline',{ascending:true}).limit(1000),'visa_cases',warnings),
      safeRows(admin.from('tasks').select('*').eq('organization_id',organization.id).eq('model_id',modelId).order('due_at',{ascending:true,nullsFirst:false}).limit(1500),'tasks',warnings),
      safeRows(admin.from('event_models').select('*').eq('organization_id',organization.id).eq('model_id',modelId).limit(1500),'event_models',warnings),
      safeRows(admin.from('season_models').select('*').eq('organization_id',organization.id).eq('model_id',modelId).limit(500),'season_models',warnings),
      safeRows(admin.from('season_show_models').select('*').eq('organization_id',organization.id).eq('model_id',modelId).limit(1500),'season_show_models',warnings),
      safeRows(admin.from('booking_options').select('*').eq('organization_id',organization.id).eq('model_id',modelId).in('status',['active','challenged']).order('expires_at',{ascending:true}).limit(1000),'booking_options',warnings),
      safeRows(admin.from('work_authorizations').select('*').eq('organization_id',organization.id).eq('model_id',modelId).limit(500),'work_authorizations',warnings),
      safeRows(admin.from('passports').select('*').eq('organization_id',organization.id).eq('model_id',modelId).limit(100),'passports',warnings),
      safeRows(admin.from('markets').select('*').eq('organization_id',organization.id).eq('active',true).order('name').limit(300),'markets',warnings)
    ]);
    const bookingIds=[...new Set(bookingModels.map(x=>x.booking_id).filter(Boolean))];
    const castingIds=[...new Set(castingModels.map(x=>x.casting_id).filter(Boolean))];
    const eventIds=[...new Set(eventModels.map(x=>x.event_id).filter(Boolean))];
    const seasonIds=[...new Set(seasonModels.map(x=>x.season_id).filter(Boolean))];
    const showIds=[...new Set(showModels.map(x=>x.season_show_id).filter(Boolean))];
    const [bookings,castings,events,seasons,shows,documents]=await Promise.all([
      bookingIds.length?safeRows(admin.from('bookings').select('*').eq('organization_id',organization.id).in('id',bookingIds),'bookings',warnings):[],
      castingIds.length?safeRows(admin.from('castings').select('*').eq('organization_id',organization.id).in('id',castingIds),'castings',warnings):[],
      eventIds.length?safeRows(admin.from('events').select('*').eq('organization_id',organization.id).in('id',eventIds),'events',warnings):[],
      seasonIds.length?safeRows(admin.from('seasons').select('*').eq('organization_id',organization.id).in('id',seasonIds),'seasons',warnings):[],
      showIds.length?safeRows(admin.from('season_shows').select('*').eq('organization_id',organization.id).in('id',showIds),'season_shows',warnings):[],
      safeRows(admin.from('documents').select('*').eq('organization_id',organization.id).eq('model_id',modelId).order('created_at',{ascending:false}).limit(500),'documents',warnings)
    ]);
    const graph={model,availability,bookings,booking_models:bookingModels,booking_options:options,castings,casting_models:castingModels,travel,visa_cases:visa,work_authorizations:workAuthorizations,passports,markets,tasks,events,event_models:eventModels,seasons,season_models:seasonModels,shows,season_show_models:showModels,documents};
    const intelligence=summarize({model,availability,bookings,bookingModels,castings,castingModels,travel,visa,tasks,events,seasons,seasonModels,shows,showModels});
    return json(200,{environment:'cavyre-model-operating-graph-v1',organization:{id:organization.id,slug:organization.slug,name:organization.name},generated_at:new Date().toISOString(),model_id:modelId,intelligence,graph,warnings});
  }catch(error){return errorResponse(error);}
};
