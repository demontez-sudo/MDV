import { requireUser, json, errorResponse } from './_lib/auth.mjs';
import { requireModelPortal } from './_lib/portal-bridge.mjs';

async function rows(q){const {data,error}=await q;if(error)throw error;return data||[];}
const iso=v=>{const d=new Date(v);return Number.isFinite(d.getTime())?d.toISOString():null;};
const activeStatus=v=>!/declined|cancelled|canceled|released|void/i.test(String(v||''));
const eventVisible=e=>String(e?.visibility||'').toLowerCase()!=='private';

export const handler=async event=>{
  if(event.httpMethod!=='GET')return json(405,{error:'Method not allowed'},{Allow:'GET'});
  try{
    const {user}=await requireUser(event);
    const p=event.queryStringParameters||{},slug=p.organization||p.organization_slug||'maison-de-veux';
    const {admin,organization,modelId}=await requireModelPortal({user,organizationSlug:slug});
    const start=iso(p.start)||new Date(Date.now()-30*864e5).toISOString();
    const end=iso(p.end)||new Date(Date.now()+180*864e5).toISOString();

    const [eventLinks,bookingLinks,castingLinks,travelRecords,visaCases]=await Promise.all([
      rows(admin.from('event_models').select('event_id,model_id,attendance_status').eq('organization_id',organization.id).eq('model_id',modelId)),
      rows(admin.from('booking_models').select('id,booking_id,model_id,status,notes,response_at').eq('organization_id',organization.id).eq('model_id',modelId)),
      rows(admin.from('casting_models').select('id,casting_id,model_id,status,slot_at,feedback,response_at').eq('organization_id',organization.id).eq('model_id',modelId)),
      rows(admin.from('travel_records').select('*').eq('organization_id',organization.id).eq('model_id',modelId).order('starts_at',{ascending:true})),
      rows(admin.from('visa_cases').select('*').eq('organization_id',organization.id).eq('model_id',modelId).order('hard_deadline',{ascending:true}))
    ]);

    const eventIds=eventLinks.map(x=>x.event_id).filter(Boolean);
    const bookingIds=bookingLinks.filter(x=>activeStatus(x.status)).map(x=>x.booking_id).filter(Boolean);
    const castingIds=castingLinks.filter(x=>activeStatus(x.status)).map(x=>x.casting_id).filter(Boolean);

    const [events,bookings,castings]=await Promise.all([
      eventIds.length?rows(admin.from('events').select('id,title,event_type,status,starts_at,ends_at,timezone,all_day,location,visibility,notes,metadata').eq('organization_id',organization.id).in('id',eventIds).gte('starts_at',start).lte('starts_at',end).order('starts_at')):[],
      bookingIds.length?rows(admin.from('bookings').select('id,title,status,starts_at,ends_at,call_time,wrap_time,timezone,location,notes,metadata').eq('organization_id',organization.id).in('id',bookingIds).order('starts_at',{ascending:true,nullsFirst:false})):[],
      castingIds.length?rows(admin.from('castings').select('id,title,status,starts_at,ends_at,timezone,location,notes,metadata').eq('organization_id',organization.id).in('id',castingIds).order('starts_at',{ascending:true,nullsFirst:false})):[]
    ]);

    const eventLinkMap=new Map(eventLinks.map(x=>[String(x.event_id),x]));
    const bookingLinkMap=new Map(bookingLinks.map(x=>[String(x.booking_id),x]));
    const castingLinkMap=new Map(castingLinks.map(x=>[String(x.casting_id),x]));

    const eventRows=events.filter(eventVisible).map(e=>({
      id:e.id,kind:'event',title:e.title,event_type:e.event_type,status:e.status,
      starts_at:e.starts_at,ends_at:e.ends_at,timezone:e.timezone,all_day:e.all_day,
      location:e.location,notes:e.notes,metadata:e.metadata||{},
      model_status:eventLinkMap.get(String(e.id))?.attendance_status||null
    }));
    const bookingRows=bookings.filter(b=>{
      const t=Date.parse(b.call_time||b.starts_at);return Number.isFinite(t)&&t>=Date.parse(start)&&t<=Date.parse(end);
    }).map(b=>({
      id:b.id,kind:'booking',title:b.title,event_type:'booking',status:b.status,
      starts_at:b.call_time||b.starts_at,ends_at:b.wrap_time||b.ends_at||b.call_time||b.starts_at,
      timezone:b.timezone,all_day:false,location:b.location,notes:b.notes,metadata:b.metadata||{},
      model_status:bookingLinkMap.get(String(b.id))?.status||null,
      booking_model_id:bookingLinkMap.get(String(b.id))?.id||null
    }));
    const castingRows=castings.filter(c=>{
      const link=castingLinkMap.get(String(c.id)),t=Date.parse(link?.slot_at||c.starts_at);
      return Number.isFinite(t)&&t>=Date.parse(start)&&t<=Date.parse(end);
    }).map(c=>({
      id:c.id,kind:'casting',title:c.title,event_type:'casting',status:c.status,
      starts_at:castingLinkMap.get(String(c.id))?.slot_at||c.starts_at,ends_at:c.ends_at||castingLinkMap.get(String(c.id))?.slot_at||c.starts_at,
      timezone:c.timezone,all_day:false,location:c.location,notes:c.notes,metadata:c.metadata||{},
      model_status:castingLinkMap.get(String(c.id))?.status||null,
      casting_model_id:castingLinkMap.get(String(c.id))?.id||null
    }));


    const travelRows=travelRecords.filter(t=>{
      if(t.visible_to_model===false)return false;
      const when=t.starts_at||t.departure_at||t.created_at;
      const ts=Date.parse(when); return Number.isFinite(ts)&&ts>=Date.parse(start)&&ts<=Date.parse(end);
    }).map(t=>({
      id:t.id,kind:'travel',title:t.title||[t.origin,t.destination].filter(Boolean).join(' → ')||t.purpose||'Model Travel',
      event_type:'travel',status:t.status||'scheduled',
      starts_at:t.starts_at||t.departure_at||t.created_at,
      ends_at:t.ends_at||t.arrival_at||t.starts_at||t.departure_at||t.created_at,
      timezone:t.timezone||null,all_day:false,location:t.destination||t.location||null,
      notes:t.notes||null,metadata:{...(t.metadata||{}),travel_record_id:t.id,origin:t.origin||null,destination:t.destination||null,purpose:t.purpose||null},
      model_status:t.status||null,source:'travel_records'
    }));

    const visaRows=[];
    for(const v of visaCases){
      if(v.visible_to_model===false)continue;
      if(v.appointment_at){
        const ts=Date.parse(v.appointment_at);
        if(Number.isFinite(ts)&&ts>=Date.parse(start)&&ts<=Date.parse(end)){
          visaRows.push({
            id:`${v.id}:appointment`,kind:'visa',title:`Consulate Appointment${v.country_code?' · '+v.country_code:''}`,
            event_type:'visa',status:v.status||'scheduled',starts_at:v.appointment_at,ends_at:v.appointment_at,
            timezone:v.timezone||null,all_day:false,location:v.consulate||null,notes:v.notes||null,
            metadata:{visa_case_id:v.id,visa_type:v.visa_type||v.case_type||null,country_code:v.country_code||null,visa_status:v.status||null},
            model_status:v.status||null,source:'visa_cases'
          });
        }
      }
      if(v.hard_deadline){
        const deadline=new Date(String(v.hard_deadline).slice(0,10)+'T12:00:00');
        const ts=deadline.getTime();
        if(Number.isFinite(ts)&&ts>=Date.parse(start)&&ts<=Date.parse(end)){
          visaRows.push({
            id:`${v.id}:deadline`,kind:'visa',title:`Visa Deadline${v.country_code?' · '+v.country_code:''}`,
            event_type:'visa',status:v.status||'scheduled',starts_at:deadline.toISOString(),ends_at:deadline.toISOString(),
            timezone:null,all_day:true,location:v.consulate||null,notes:v.notes||null,
            metadata:{visa_case_id:v.id,visa_type:v.visa_type||v.case_type||null,country_code:v.country_code||null,visa_status:v.status||null,hard_deadline:v.hard_deadline},
            model_status:v.status||null,source:'visa_cases'
          });
        }
      }
    }

    // Prefer canonical calendar events when mobility has already synced there.
    // Direct travel/visa rows fill gaps for older records that predate calendar synchronization.
    const mobilityKeys=new Set(eventRows.map(e=>String(e.metadata?.travel_record_id||e.metadata?.mobility_travel_id||e.metadata?.visa_case_id||e.metadata?.mobility_visa_deadline_id||e.metadata?.mobility_visa_appointment_id||'')));
    const dedupedTravel=travelRows.filter(x=>!mobilityKeys.has(String(x.metadata?.travel_record_id||'')));
    const dedupedVisa=visaRows.filter(x=>!mobilityKeys.has(String(x.metadata?.visa_case_id||'')));

    const schedule=[...eventRows,...bookingRows,...castingRows,...dedupedTravel,...dedupedVisa].sort((a,b)=>Date.parse(a.starts_at)-Date.parse(b.starts_at));
    return json(200,{ok:true,verified:true,organization:{id:organization.id,name:organization.name,slug:organization.slug},model_id:modelId,range:{start,end},events:eventRows,bookings:bookingRows,castings:castingRows,travel:dedupedTravel,visa:dedupedVisa,schedule});
  }catch(error){return errorResponse(error);}
};
