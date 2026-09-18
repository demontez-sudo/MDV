import { requireUser, parseBody, json, errorResponse } from './_lib/auth.mjs';
import { requireStaffOrganization, requirePermission } from './_lib/agent-bridge.mjs';

async function rows(q){const {data,error}=await q;if(error)throw error;return data||[];}
async function one(q){const {data,error}=await q;if(error)throw error;return data||null;}
const clean=a=>Array.from(new Set((Array.isArray(a)?a:[]).filter(Boolean)));
const iso=v=>{const d=new Date(v);return Number.isFinite(d.getTime())?d.toISOString():null;};
const overlaps=(a0,a1,b0,b1)=>{const as=Date.parse(a0),ae=Date.parse(a1||a0),bs=Date.parse(b0),be=Date.parse(b1||b0);return [as,ae,bs,be].every(Number.isFinite)&&as<be&&bs<ae;};
function kindDone(kind,status){const s=String(status||'').toLowerCase();return kind==='booking'?/completed|cancelled|closed|model_paid/.test(s):kind==='casting'?/closed|cancelled/.test(s):/completed|cancelled/.test(s);}
function suggestionLabel(v){return new Date(v).toLocaleString('en-US',{weekday:'short',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});}

async function conflictIntervals(admin,org,modelIds,exclude={}){
  const ids=clean(modelIds); if(!ids.length)return [];
  const [bl,cl,el,blocks]=await Promise.all([
    rows(admin.from('booking_models').select('model_id,booking_id,status').eq('organization_id',org).in('model_id',ids).not('status','in','(declined,cancelled,released)')),
    rows(admin.from('casting_models').select('model_id,casting_id,status,slot_at').eq('organization_id',org).in('model_id',ids).not('status','in','(declined,cancelled)')),
    rows(admin.from('event_models').select('model_id,event_id,attendance_status').eq('organization_id',org).in('model_id',ids).not('attendance_status','in','(declined,cancelled)')),
    rows(admin.from('availability_blocks').select('id,model_id,starts_at,ends_at,block_type,status,reason').eq('organization_id',org).in('model_id',ids).eq('status','approved'))
  ]);
  const bookingIds=clean(bl.map(x=>x.booking_id).filter(id=>!(exclude.kind==='booking'&&String(id)===String(exclude.id))));
  const castingIds=clean(cl.map(x=>x.casting_id).filter(id=>!(exclude.kind==='casting'&&String(id)===String(exclude.id))));
  const eventIds=clean(el.map(x=>x.event_id).filter(id=>!(exclude.kind==='event'&&String(id)===String(exclude.id))));
  const [bookings,castings,events]=await Promise.all([
    bookingIds.length?rows(admin.from('bookings').select('id,title,starts_at,ends_at,call_time,wrap_time,status').eq('organization_id',org).in('id',bookingIds)):[],
    castingIds.length?rows(admin.from('castings').select('id,title,starts_at,ends_at,status').eq('organization_id',org).in('id',castingIds)):[],
    eventIds.length?rows(admin.from('events').select('id,title,starts_at,ends_at,status,event_type').eq('organization_id',org).in('id',eventIds)):[]
  ]);
  const bm=new Map(bookings.map(x=>[String(x.id),x])),cm=new Map(castings.map(x=>[String(x.id),x])),em=new Map(events.map(x=>[String(x.id),x]));
  const out=[];
  for(const x of bl){const b=bm.get(String(x.booking_id));if(!b||kindDone('booking',b.status))continue;out.push({model_id:x.model_id,kind:'booking',id:b.id,title:b.title,start:b.call_time||b.starts_at,end:b.wrap_time||b.ends_at||b.call_time||b.starts_at,status:b.status});}
  for(const x of cl){const c=cm.get(String(x.casting_id));if(!c||kindDone('casting',c.status))continue;out.push({model_id:x.model_id,kind:'casting',id:c.id,title:c.title,start:x.slot_at||c.starts_at,end:c.ends_at||x.slot_at||c.starts_at,status:c.status});}
  for(const x of el){const e=em.get(String(x.event_id));if(!e||kindDone('event',e.status))continue;out.push({model_id:x.model_id,kind:'event',id:e.id,title:e.title,start:e.starts_at,end:e.ends_at||e.starts_at,status:e.status});}
  for(const x of blocks)out.push({model_id:x.model_id,kind:'bookout',id:x.id,title:x.reason||x.block_type||'Bookout',start:x.starts_at,end:x.ends_at,status:x.status});
  return out.filter(x=>x.start);
}

function suggestedSlots(start,end,intervals,modelIds){
  const s=new Date(start),e=new Date(end||new Date(s.getTime()+60*60000));
  if(!Number.isFinite(s.getTime())||!Number.isFinite(e.getTime()))return [];
  const duration=Math.max(30*60000,e-s||60*60000),models=new Set(clean(modelIds).map(String));
  const offsets=[30,60,90,120,180,240,-30,-60,-90,-120,300,360];
  const out=[];
  for(const mins of offsets){const cs=new Date(s.getTime()+mins*60000),ce=new Date(cs.getTime()+duration);const hour=cs.getHours();if(hour<7||ce.getHours()>22)continue;const conflict=intervals.some(x=>models.has(String(x.model_id))&&overlaps(cs.toISOString(),ce.toISOString(),x.start,x.end));if(!conflict){out.push({starts_at:cs.toISOString(),ends_at:ce.toISOString(),label:suggestionLabel(cs)});if(out.length>=4)break;}}
  return out;
}

export const handler=async(event)=>{
  if(!['GET','POST'].includes(event.httpMethod))return json(405,{error:'Method not allowed'});
  try{
    const {user,client}=await requireUser(event),body=event.httpMethod==='POST'?parseBody(event):{},p=event.queryStringParameters||{};
    const slug=body.organization_slug||p.organization||'maison-de-veux';
    const {organization}=await requireStaffOrganization({user,client,organizationSlug:slug});
    if(event.httpMethod==='GET'){
      const admin=await requirePermission(user.id,organization.id,'calendar.read');
      const now=new Date(),future3=new Date(now.getTime()+3*864e5),future60=new Date(now.getTime()+60*864e5);
      const [seasons,bookings,events,castings]=await Promise.all([
        rows(admin.from('seasons').select('id,name,season_type,starts_on,ends_on,status,market_id,notes').eq('organization_id',organization.id).lte('starts_on',future60.toISOString().slice(0,10)).gte('ends_on',now.toISOString().slice(0,10)).order('starts_on',{ascending:true}).limit(50)),
        rows(admin.from('bookings').select('id,title,status,starts_at,ends_at,call_time,wrap_time,location,company_id,market_id,metadata').eq('organization_id',organization.id).order('starts_at',{ascending:true}).limit(600)),
        rows(admin.from('events').select('id,title,event_type,status,starts_at,ends_at,location,market_id,metadata').eq('organization_id',organization.id).order('starts_at',{ascending:true}).limit(800)),
        rows(admin.from('castings').select('id,title,status,starts_at,ends_at,deadline_at,location,market_id').eq('organization_id',organization.id).order('starts_at',{ascending:true}).limit(600))
      ]);
      const upcoming=bookings.filter(b=>{const d=Date.parse(b.call_time||b.starts_at||0);return Number.isFinite(d)&&d>=now.getTime()&&d<=future3.getTime()&&!kindDone('booking',b.status);});
      const overdue=[];
      for(const b of bookings){const d=Date.parse(b.wrap_time||b.ends_at||b.starts_at||0);if(Number.isFinite(d)&&d<now.getTime()&&!kindDone('booking',b.status))overdue.push({kind:'booking',id:b.id,title:b.title,status:b.status,date:b.starts_at,end:b.ends_at||b.wrap_time,location:b.location});}
      for(const e of events){const d=Date.parse(e.ends_at||e.starts_at||0);if(Number.isFinite(d)&&d<now.getTime()&&!kindDone('event',e.status)&&e.event_type!=='personal')overdue.push({kind:'event',id:e.id,title:e.title,status:e.status,date:e.starts_at,end:e.ends_at,location:e.location});}
      for(const c of castings){const d=Date.parse(c.ends_at||c.deadline_at||c.starts_at||0);if(Number.isFinite(d)&&d<now.getTime()&&!kindDone('casting',c.status))overdue.push({kind:'casting',id:c.id,title:c.title,status:c.status,date:c.starts_at,end:c.ends_at||c.deadline_at,location:c.location});}
      overdue.sort((a,b)=>String(b.end||b.date).localeCompare(String(a.end||a.date)));
      return json(200,{ok:true,generated_at:now.toISOString(),important_dates:seasons,upcoming_bookings:upcoming.slice(0,30),overdue:overdue.slice(0,50)});
    }
    const admin=await requirePermission(user.id,organization.id,'calendar.write');
    const action=String(body.action||'');
    if(action==='preflight'){
      const modelIds=clean(body.model_ids);const start=iso(body.starts_at),end=iso(body.ends_at)||new Date(Date.parse(start)+60*60000).toISOString();
      if(!start)return json(400,{error:'starts_at is required'});
      const intervals=await conflictIntervals(admin,organization.id,modelIds,{kind:body.exclude_kind||'',id:body.exclude_id||''});
      const conflicts=intervals.filter(x=>overlaps(start,end,x.start,x.end));
      return json(200,{ok:true,conflict:conflicts.length>0,conflict_count:conflicts.length,conflicts,suggestions:suggestedSlots(start,end,intervals,modelIds)});
    }
    if(action==='mark_complete'){
      const kind=String(body.kind||''),id=body.id;if(!id||!['booking','casting','event'].includes(kind))return json(400,{error:'kind and id are required'});
      const table=kind==='booking'?'bookings':kind==='casting'?'castings':'events',status=kind==='casting'?'closed':'completed';
      const row=await one(admin.from(table).update({status,updated_at:new Date().toISOString()}).eq('organization_id',organization.id).eq('id',id).select('*').single());
      return json(200,{ok:true,verified:true,kind,item:row});
    }
    return json(400,{error:'Unsupported smart-calendar action'});
  }catch(error){return errorResponse(error);}
};
