import { requireUser, json, errorResponse } from './_lib/auth.mjs';
import { requireStaffOrganization, requirePermission } from './_lib/agent-bridge.mjs';

const DAY=864e5;
const SEV={critical:4,high:3,medium:2,low:1};

async function safe(q,fallback=[]){
  try{const {data,error}=await q;if(error)throw error;return data??fallback;}
  catch(e){console.warn('[model-360-intel] block skipped:',e?.message);return fallback;}
}
const ts=v=>{const t=v?new Date(v).getTime():NaN;return Number.isFinite(t)?t:null;};
const iso=v=>{const t=ts(v);return t==null?null:new Date(t).toISOString();};
const uniq=a=>[...new Set((a||[]).filter(Boolean))];

function overlap(aS,aE,bS,bE){
  const s1=ts(aS),e1=ts(aE)??s1,s2=ts(bS),e2=ts(bE)??s2;
  if(s1==null||s2==null)return false;
  return s1<=e2&&s2<=e1;
}

function buildSignals(c){
  const out=[];
  const add=(severity,code,title,detail,action,vera_prompt)=>out.push({severity,code,title,detail,action:action||null,vera_prompt:vera_prompt||null});
  const now=Date.now(),name=c.model.display_name||'this model';
  const media=c.media,headshot=media.find(x=>x.is_primary&&String(x.category||'').toLowerCase()==='headshot')||media.find(x=>x.is_primary);
  if(!headshot)add('high','no_headshot','No primary headshot','A public primary Headshot is needed for packages and the website.',{label:'Manage media',target:'materials'},`${name} has no primary headshot. What should we shoot or select first?`);
  const digitals=media.filter(x=>/digital|polaroid/i.test(x.category||''));
  const newestDigital=Math.max(0,...digitals.map(x=>ts(x.created_at)||0));
  if(!digitals.length)add('medium','no_digitals','No digitals on file','Current digitals are the first thing clients ask for.',{label:'Add digitals',target:'materials'},`${name} has no digitals on file. Draft a shoot brief.`);
  else if(now-newestDigital>90*DAY)add('medium','stale_digitals','Digitals are over 90 days old',`Newest digitals were added ${Math.round((now-newestDigital)/DAY)} days ago.`,{label:'Refresh digitals',target:'materials'},`${name}'s digitals are ${Math.round((now-newestDigital)/DAY)} days old. Recommend a refresh plan.`);
  if(!media.some(x=>String(x.media_type||'').toLowerCase()==='video'))add('low','no_video','No video or walk reel','Add a walk or motion clip to complete the package.',{label:'Add video',target:'materials'},`${name} has no video. What should we capture?`);
  if(!c.measurement||!c.measurement.height_cm)add('medium','no_measurements','Measurements incomplete','Height and core measurements are missing.',{label:'Edit measurements',target:'materials'},null);

  const upcomingTravel=c.travel.filter(t=>{const s=ts(t.starts_at);return s!=null&&s>=now-DAY&&s<=now+60*DAY;});
  const passports=c.passports.filter(p=>!['lost','cancelled'].includes(String(p.status||'').toLowerCase()));
  if(!passports.length&&(upcomingTravel.length||c.visas.length))add('high','no_passport','No passport on file','Travel or visa work is planned but no passport is recorded.',{label:'Open logistics',target:'logistics'},`${name} has travel or visa work planned but no passport on file. What do we need?`);
  passports.forEach(p=>{
    const exp=ts(p.expires_on);if(exp==null)return;
    if(exp<now)add('critical','passport_expired','Passport expired',`Expired ${new Date(exp).toLocaleDateString()}.`,{label:'Open logistics',target:'logistics'},`${name}'s passport has expired. Lay out the renewal steps and timing.`);
    else if(upcomingTravel.some(t=>exp<(ts(t.ends_at)||ts(t.starts_at))+183*DAY)||exp-now<183*DAY)add('high','passport_validity','Passport validity is short',`Expires ${new Date(exp).toLocaleDateString()} — many countries require 6 months beyond travel.`,{label:'Open logistics',target:'logistics'},`${name}'s passport expires ${new Date(exp).toLocaleDateString()}. Is that enough for planned travel?`);
  });
  c.visas.forEach(v=>{
    const st=String(v.status||'').toLowerCase();
    if(['issued','approved','active','valid','complete','completed','closed'].includes(st))return;
    const dl=ts(v.hard_deadline);
    const label=[v.country_code,v.visa_type||v.case_type].filter(Boolean).join(' ')||'Visa case';
    if(dl!=null&&dl<now)add('critical','visa_overdue',`${label} deadline passed`,`Hard deadline was ${new Date(dl).toLocaleDateString()} (status: ${st||'open'}).`,{label:'Open logistics',target:'logistics'},`The ${label} case for ${name} is past its deadline. What now?`);
    else if(dl!=null&&dl-now<21*DAY)add('high','visa_due',`${label} due in ${Math.ceil((dl-now)/DAY)} days`,`Status: ${st||'open'}.`,{label:'Open logistics',target:'logistics'},`The ${label} case for ${name} is due in ${Math.ceil((dl-now)/DAY)} days. Check readiness.`);
  });
  upcomingTravel.forEach(t=>{
    const st=String(t.status||'').toLowerCase(),s=ts(t.starts_at),route=[t.origin,t.destination].filter(Boolean).join(' → ')||'Trip';
    if(s-now<14*DAY&&['planning','requested'].includes(st))add('high','travel_unbooked',`${route} not booked`,`Departs in ${Math.max(0,Math.ceil((s-now)/DAY))} days, status "${st}".`,{label:'Open logistics',target:'logistics'},`${name}'s trip ${route} leaves soon and is still ${st}. What is blocking it?`);
    if(!(t.housing||[]).length)add('medium','no_stay',`No accommodation for ${route}`,'Add a stay so the itinerary is complete.',{label:'Open logistics',target:'logistics'},null);
  });

  const tasks=c.tasks.filter(t=>!['completed','cancelled'].includes(String(t.status||'').toLowerCase()));
  const overdue=tasks.filter(t=>ts(t.due_at)!=null&&ts(t.due_at)<now);
  if(overdue.length)add(overdue.length>2?'high':'medium','tasks_overdue',`${overdue.length} overdue task${overdue.length===1?'':'s'}`,overdue.slice(0,3).map(t=>t.title).join(' · '),{label:'View work',target:'work'},`${name} has ${overdue.length} overdue tasks: ${overdue.slice(0,3).map(t=>t.title).join('; ')}. Prioritize them.`);
  const soon=tasks.filter(t=>{const d=ts(t.due_at);return d!=null&&d>=now&&d<now+3*DAY;});
  if(soon.length)add('low','tasks_soon',`${soon.length} task${soon.length===1?'':'s'} due in 3 days`,soon.slice(0,3).map(t=>t.title).join(' · '),{label:'View work',target:'work'},null);

  const pendingAvail=c.availability_requests.filter(r=>['pending','requested','open'].includes(String(r.status||'').toLowerCase()));
  if(pendingAvail.length)add('high','availability_pending',`${pendingAvail.length} availability request${pendingAvail.length===1?'':'s'} waiting`,'Confirm or decline to keep clients moving.',{label:'View work',target:'work'},`${name} has ${pendingAvail.length} pending availability requests. Suggest responses based on their calendar.`);

  const unconfirmed=c.commitments.filter(x=>x.kind==='casting'&&ts(x.starts_at)!=null&&ts(x.starts_at)>=now&&ts(x.starts_at)<now+14*DAY&&!['confirmed','attended','declined','cancelled'].includes(String(x.status||'').toLowerCase()));
  if(unconfirmed.length)add('medium','castings_unconfirmed',`${unconfirmed.length} casting${unconfirmed.length===1?'':'s'} to confirm`,unconfirmed.slice(0,3).map(x=>x.title).join(' · '),{label:'View work',target:'work'},null);

  c.conflicts.forEach(x=>add('high','calendar_conflict','Calendar conflict',`${x.a.title} overlaps ${x.b.title}.`,{label:'Open logistics',target:'logistics'},`${name} has a conflict: ${x.a.title} overlaps ${x.b.title}. Recommend how to resolve it.`));

  c.goals.filter(g=>!['completed','done','cancelled'].includes(String(g.status||'').toLowerCase())&&ts(g.target_date)!=null&&ts(g.target_date)<now)
    .slice(0,2).forEach(g=>add('medium','goal_overdue',`Goal past due: ${g.title||'Development goal'}`,`Target was ${new Date(g.target_date).toLocaleDateString()}.`,{label:'Open development',target:'development'},`${name}'s development goal "${g.title}" is past its target date. Recommend next steps.`));

  return out.sort((a,b)=>(SEV[b.severity]||0)-(SEV[a.severity]||0));
}

function buildRecommendation(model,signals,c){
  const name=model.display_name||'This model';
  const top=signals.slice(0,3);
  if(!top.length)return {text:`${name}'s file is in good shape: materials are current, travel and paperwork are clear, and nothing is overdue. A good moment to plan the next development goal or market push.`,evidence:[]};
  const lead=top[0];
  const text=`Start with "${lead.title}". ${lead.detail}`+(top[1]?` Next: ${top[1].title.toLowerCase()}.`:'')+(top[2]?` Then ${top[2].title.toLowerCase()}.`:'');
  return {text,evidence:top.map(s=>`${s.title}${s.detail?' — '+s.detail:''}`)};
}

export const handler=async event=>{
  if(event.httpMethod!=='GET')return json(405,{error:'Method not allowed'});
  try{
    const {user,client}=await requireUser(event);
    const q=event.queryStringParameters||{};
    const {organization}=await requireStaffOrganization({user,client,organizationSlug:q.organization||'maison-de-veux'});
    const admin=await requirePermission(user.id,organization.id,'models.read');
    const modelId=String(q.model_id||'').trim();
    if(!modelId)return json(400,{error:'model_id is required'});
    const org=organization.id,now=Date.now();

    const [model,measurement,media,bookingLinks,castingLinks,eventLinks,blocks,availReq,tasks,travelRows,visas,passports,plans,notes,pkgActivity,seasonModels,evals,activityRows]=await Promise.all([
      safe(admin.from('models').select('id,display_name,status,stage,primary_market_label').eq('organization_id',org).eq('id',modelId).maybeSingle(),null),
      safe(admin.from('model_measurements').select('*').eq('organization_id',org).eq('model_id',modelId).maybeSingle(),null),
      safe(admin.from('model_media').select('id,category,media_type,is_primary,created_at,caption').eq('organization_id',org).eq('model_id',modelId).order('created_at',{ascending:false}).limit(400)),
      safe(admin.from('booking_models').select('booking_id,status').eq('organization_id',org).eq('model_id',modelId)),
      safe(admin.from('casting_models').select('casting_id,status').eq('organization_id',org).eq('model_id',modelId)),
      safe(admin.from('event_models').select('event_id').eq('organization_id',org).eq('model_id',modelId)),
      safe(admin.from('availability_blocks').select('*').eq('organization_id',org).eq('model_id',modelId).neq('status','cancelled').order('starts_at',{ascending:true}).limit(200)),
      safe(admin.from('availability_requests').select('*').eq('organization_id',org).eq('model_id',modelId).order('created_at',{ascending:false}).limit(50)),
      safe(admin.from('tasks').select('id,title,status,due_at,completed_at,created_at,priority').eq('organization_id',org).eq('model_id',modelId).order('due_at',{ascending:true}).limit(250)),
      safe(admin.from('travel_records').select('id,origin,destination,starts_at,ends_at,status,purpose,created_at').eq('organization_id',org).eq('model_id',modelId).order('starts_at',{ascending:true}).limit(100)),
      safe(admin.from('visa_cases').select('id,country_code,visa_type,case_type,status,hard_deadline,created_at').eq('organization_id',org).eq('model_id',modelId)),
      safe(admin.from('passports').select('id,country_code,expires_on,status').eq('organization_id',org).eq('model_id',modelId)),
      safe(admin.from('development_plans').select('id,title,status,target_date').eq('organization_id',org).eq('model_id',modelId)),
      safe(admin.from('model_notes').select('id,body,created_at,created_by').eq('organization_id',org).eq('model_id',modelId).order('created_at',{ascending:false}).limit(60)),
      safe(admin.from('package_activity').select('id,package_id,event_type,occurred_at,actor_label').eq('organization_id',org).eq('model_id',modelId).order('occurred_at',{ascending:false}).limit(60)),
      safe(admin.from('season_models').select('*').eq('organization_id',org).eq('model_id',modelId)),
      safe(admin.from('model_evaluations').select('id,evaluated_on,created_at,overall_current').eq('organization_id',org).eq('model_id',modelId).order('created_at',{ascending:false}).limit(20)),
      safe(admin.from('model_activity').select('*').eq('organization_id',org).eq('model_id',modelId).order('occurred_at',{ascending:false}).limit(300))
    ]);
    if(!model)return json(404,{error:'Model not found'});

    const bIds=uniq(bookingLinks.map(x=>x.booking_id)),cIds=uniq(castingLinks.map(x=>x.casting_id)),eIds=uniq(eventLinks.map(x=>x.event_id)),planIds=plans.map(p=>p.id),seasonIds=uniq(seasonModels.map(x=>x.season_id));
    const [bookings,castings,events,goals,seasons]=await Promise.all([
      bIds.length?safe(admin.from('bookings').select('*').eq('organization_id',org).in('id',bIds)):[],
      cIds.length?safe(admin.from('castings').select('*').eq('organization_id',org).in('id',cIds)):[],
      eIds.length?safe(admin.from('events').select('*').eq('organization_id',org).in('id',eIds)):[],
      planIds.length?safe(admin.from('development_goals').select('id,development_plan_id,title,status,target_date').eq('organization_id',org).in('development_plan_id',planIds)):[],
      seasonIds.length?safe(admin.from('seasons').select('*').eq('organization_id',org).in('id',seasonIds)):[]
    ]);
    const travelIds=travelRows.map(t=>t.id);
    const housing=travelIds.length?await safe(admin.from('housing_bookings').select('id,travel_record_id,check_in_at,check_out_at').eq('organization_id',org).in('travel_record_id',travelIds)):[];
    const travel=travelRows.map(t=>({...t,housing:housing.filter(h=>String(h.travel_record_id)===String(t.id))}));

    const bStatus=new Map(bookingLinks.map(x=>[String(x.booking_id),x.status])),cStatus=new Map(castingLinks.map(x=>[String(x.casting_id),x.status]));
    const commitments=[
      ...bookings.map(b=>({id:b.id,kind:'booking',title:b.title||b.name||'Booking',starts_at:iso(b.starts_at||b.start_at||b.date),ends_at:iso(b.ends_at||b.end_at),status:bStatus.get(String(b.id))||b.status||null,location:b.location||null})),
      ...castings.map(c=>({id:c.id,kind:'casting',title:c.title||c.name||'Casting',starts_at:iso(c.starts_at||c.start_at||c.date||c.casting_at),ends_at:iso(c.ends_at||c.end_at),status:cStatus.get(String(c.id))||c.status||null,location:c.location||null})),
      ...events.map(e=>({id:e.id,kind:'event',title:e.title||e.name||'Event',starts_at:iso(e.starts_at||e.start_at),ends_at:iso(e.ends_at||e.end_at),status:e.status||null,location:e.location||null,event_type:e.event_type||null}))
    ].filter(x=>x.starts_at).sort((a,b)=>ts(a.starts_at)-ts(b.starts_at));

    const busy=[
      ...commitments.map(x=>({kind:x.kind,title:x.title,starts_at:x.starts_at,ends_at:x.ends_at})),
      ...blocks.map(b=>({kind:'availability',title:(b.block_type||'Block')+(b.reason?` · ${b.reason}`:''),starts_at:iso(b.starts_at),ends_at:iso(b.ends_at)}))
    ];
    const conflicts=[];
    travel.filter(t=>t.starts_at&&!['cancelled','completed'].includes(String(t.status||'').toLowerCase())&&ts(t.ends_at||t.starts_at)>=now).forEach(t=>{
      const tr={kind:'travel',title:`Travel ${[t.origin,t.destination].filter(Boolean).join(' → ')||''}`.trim(),starts_at:iso(t.starts_at),ends_at:iso(t.ends_at||t.starts_at)};
      busy.forEach(b=>{if(b.starts_at&&overlap(tr.starts_at,tr.ends_at,b.starts_at,b.ends_at)&&ts(b.ends_at||b.starts_at)>=now)conflicts.push({a:tr,b,starts_at:b.starts_at<tr.starts_at?tr.starts_at:b.starts_at});});
    });

    const weekItems=[
      ...commitments.map(x=>({...x})),
      ...blocks.map(b=>({id:b.id,kind:'availability',title:(b.block_type||'Block')+(b.reason?` · ${b.reason}`:''),starts_at:iso(b.starts_at),ends_at:iso(b.ends_at),status:b.status})),
      ...travel.map(t=>({id:t.id,kind:'travel',title:`Travel ${[t.origin,t.destination].filter(Boolean).join(' → ')}`.trim(),starts_at:iso(t.starts_at),ends_at:iso(t.ends_at),status:t.status})),
      ...tasks.filter(t=>t.due_at&&!['completed','cancelled'].includes(String(t.status||'').toLowerCase())).map(t=>({id:t.id,kind:'task',title:t.title,starts_at:iso(t.due_at),ends_at:null,status:t.status}))
    ].filter(x=>x.starts_at).sort((a,b)=>ts(a.starts_at)-ts(b.starts_at));
    const next_up=weekItems.find(x=>ts(x.starts_at)>=now&&x.kind!=='task'&&x.kind!=='availability')||null;

    const market_plan=seasonModels.map(sm=>{const s=seasons.find(x=>String(x.id)===String(sm.season_id))||{};return {season_id:sm.season_id,name:s.name||'Season',market_id:s.market_id||null,starts_on:s.starts_on||null,ends_on:s.ends_on||null,season_status:s.status||null,model_status:sm.status||null,arrival_at:iso(sm.arrival_at),departure_at:iso(sm.departure_at),readiness_percent:sm.readiness_percent??null};}).sort((a,b)=>String(a.starts_on||'').localeCompare(String(b.starts_on||'')));

    const ctx={model,measurement,media,travel,visas,passports,tasks,commitments,conflicts,goals,availability_requests:availReq};
    const signals=buildSignals(ctx);
    const penalty={critical:25,high:12,medium:6,low:2};
    const readiness=Math.max(0,100-signals.reduce((n,s)=>n+(penalty[s.severity]||0),0));
    const recommendation=buildRecommendation(model,signals,ctx);

    const authorIds=uniq(notes.map(n=>n.created_by));
    const profiles=authorIds.length?await safe(admin.from('profiles').select('user_id,display_name').in('user_id',authorIds)):[];
    const nameOf=id=>profiles.find(p=>String(p.user_id)===String(id))?.display_name||null;

    const logged=activityRows.map(a=>({id:'log-'+a.id,at:iso(a.occurred_at),kind:a.kind,title:a.title,detail:a.detail||null,actor_name:a.actor_name||null,link:a.link_page?{page:a.link_page,id:a.link_id||null}:null,source:'log'}));
    const firstLogged=logged.length?Math.min(...logged.map(a=>ts(a.at))):Infinity;
    const derived=[
      ...media.slice(0,60).map(m=>({id:'media-'+m.id,at:iso(m.created_at),kind:'media',title:`Media added${m.category?` (${m.category})`:''}`,detail:m.caption||null,actor_name:null,link:{page:'materials',id:m.id},source:'derived'})),
      ...notes.map(n=>({id:'note-'+n.id,at:iso(n.created_at),kind:'note',title:'Note added',detail:String(n.body||'').slice(0,160),actor_name:nameOf(n.created_by),link:{page:'record',id:n.id},source:'derived'})),
      ...tasks.filter(t=>t.completed_at).map(t=>({id:'task-'+t.id,at:iso(t.completed_at),kind:'task',title:'Task completed',detail:t.title,actor_name:null,link:{page:'work',id:t.id},source:'derived'})),
      ...evals.map(e=>({id:'eval-'+e.id,at:iso(e.created_at),kind:'development',title:'Evaluation recorded',detail:e.overall_current!=null?`Current score ${Number(e.overall_current).toFixed(1)}`:null,actor_name:null,link:{page:'development',id:e.id},source:'derived'})),
      ...travel.map(t=>({id:'travel-'+t.id,at:iso(t.created_at),kind:'travel',title:'Travel record created',detail:[t.origin,t.destination].filter(Boolean).join(' → ')||t.purpose||null,actor_name:null,link:{page:'logistics',id:t.id},source:'derived'})),
      ...visas.map(v=>({id:'visa-'+v.id,at:iso(v.created_at),kind:'visa',title:'Visa case opened',detail:[v.country_code,v.visa_type||v.case_type].filter(Boolean).join(' '),actor_name:null,link:{page:'logistics',id:v.id},source:'derived'})),
      ...pkgActivity.map(p=>({id:'pkg-'+p.id,at:iso(p.occurred_at),kind:'package',title:'Package '+String(p.event_type||'activity').replace(/_/g,' '),detail:null,actor_name:p.actor_label||null,link:{page:'work',id:p.package_id},source:'derived'}))
    ].filter(a=>a.at&&ts(a.at)<firstLogged);
    const activity=[...logged,...derived].sort((a,b)=>ts(b.at)-ts(a.at)).slice(0,250);

    return json(200,{
      environment:'veux-model-360-intel-v1',model_id:modelId,generated_at:new Date(now).toISOString(),
      readiness,signals,recommendation,conflicts,
      week:{items:weekItems.filter(x=>ts(x.starts_at)>=now-2*DAY&&ts(x.starts_at)<=now+30*DAY)},
      next_up,commitments,market_plan,
      package_activity:pkgActivity.slice(0,30),activity,
      logging_enabled:logged.length>0
    });
  }catch(error){return errorResponse(error);}
};
