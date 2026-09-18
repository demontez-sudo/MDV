import { requireUser, parseBody, json, errorResponse } from './_lib/auth.mjs';
import { requireStaffOrganization, requirePermission } from './_lib/agent-bridge.mjs';
async function rows(q){const {data,error}=await q;if(error)throw error;return data||[];}
async function optionalRows(label,q,warnings){try{return await rows(q);}catch(error){warnings.push({source:label,message:String(error&&error.message||error)});return [];}}
const group=(list,key)=>{const m=new Map();for(const x of list){const k=x[key];if(!m.has(k))m.set(k,[]);m.get(k).push(x);}return m;};
function normSeasonType(v){const s=String(v||'fashion_week').toLowerCase();const map={commercial:'campaign',fashionweek:'fashion_week',market:'market_stay'};const out=map[s]||s;return ['fashion_week','couture','mens','womens','campaign','market_stay','other'].includes(out)?out:'other';}
function normReadiness(v){const s=String(v||'missing').toLowerCase();const map={not_started:'missing',complete:'ready',completed:'ready',pending:'in_progress'};const out=map[s]||s;return ['missing','in_progress','ready','not_applicable','blocked'].includes(out)?out:'missing';}
function normSeasonStatus(v){const s=String(v||'planning').toLowerCase();return ['planning','active','complete','archived','cancelled'].includes(s)?s:'planning';}
function normSeasonModelStatus(v){const s=String(v||'planned').toLowerCase();return ['planned','pending','confirmed','at_risk','withdrawn','complete'].includes(s)?s:'planned';}
function normShowStatus(v){const s=String(v||'planned').toLowerCase();return ['planned','casting','option','confirmed','completed','cancelled'].includes(s)?s:'planned';}
export const handler=async(event)=>{
  if(!['GET','POST'].includes(event.httpMethod))return json(405,{error:'Method not allowed'});
  try{
    const {user,client}=await requireUser(event),body=event.httpMethod==='POST'?parseBody(event):{},p=event.queryStringParameters||{};
    const {organization}=await requireStaffOrganization({user,client,organizationSlug:body.organization_slug||p.organization||'maison-de-veux'});
    if(event.httpMethod==='POST'){
      await requirePermission(user.id,organization.id,'season.write');
      const admin=await requirePermission(user.id,organization.id,'season.write'),action=String(body.action||'');
      if(action==='readiness_status'){
        const {data,error}=await client.rpc('set_season_readiness_status',{target_org:organization.id,target_item:body.item_id,target_status:normReadiness(body.status),note_value:body.note||null});if(error)throw error;return json(200,{ok:true,verified:true,result:data,persisted_at:new Date().toISOString()});
      }
      if(action==='create_season'){
        if(!String(body.name||'').trim())return json(400,{error:'name is required'});
        const {data,error}=await admin.from('seasons').insert({organization_id:organization.id,name:String(body.name).trim(),season_type:normSeasonType(body.season_type),market_id:body.market_id||null,starts_on:body.starts_on||null,ends_on:body.ends_on||null,status:normSeasonStatus(body.status),notes:body.notes||null}).select('*').single();if(error)throw error;return json(200,{ok:true,verified:true,season:data,persisted_at:new Date().toISOString()});
      }
      if(action==='add_model'){
        const {data,error}=await admin.from('season_models').insert({organization_id:organization.id,season_id:body.season_id,model_id:body.model_id,status:normSeasonModelStatus(body.status),arrival_at:body.arrival_at||null,departure_at:body.departure_at||null,readiness_percent:Number(body.readiness_percent||0),notes:body.notes||null}).select('*').single();if(error)throw error;return json(200,{ok:true,verified:true,season_model:data,persisted_at:new Date().toISOString()});
      }
      if(action==='create_show'){
        const {data,error}=await admin.from('season_shows').insert({organization_id:organization.id,season_id:body.season_id,title:String(body.title||'').trim(),company_id:body.company_id||null,starts_at:body.starts_at||null,location:body.location||null,status:normShowStatus(body.status),notes:body.notes||null}).select('*').single();if(error)throw error;return json(200,{ok:true,verified:true,show:data,persisted_at:new Date().toISOString()});
      }
      if(action==='assign_show_model'){
        const {data,error}=await admin.from('season_show_models').insert({organization_id:organization.id,season_show_id:body.show_id,model_id:body.model_id,status:body.status||'submitted',notes:body.notes||null}).select('*').single();if(error)throw error;return json(200,{ok:true,verified:true,show_model:data,persisted_at:new Date().toISOString()});
      }
      if(action==='update_show_status'){
        const status=normShowStatus(body.status);
        const {data,error}=await admin.from('season_shows').update({status}).eq('organization_id',organization.id).eq('id',body.show_id).select('*').single();if(error)throw error;
        if(!data||data.status!==status)throw new Error('Show status could not be verified after write.');
        return json(200,{ok:true,verified:true,show:data,persisted_at:new Date().toISOString()});
      }
      if(action==='update_season_model_status'){
        const status=normSeasonModelStatus(body.status);
        const {data,error}=await admin.from('season_models').update({status}).eq('organization_id',organization.id).eq('id',body.season_model_id).select('*').single();if(error)throw error;
        if(!data||data.status!==status)throw new Error('Season model status could not be verified after write.');
        return json(200,{ok:true,verified:true,season_model:data,persisted_at:new Date().toISOString()});
      }
      if(action==='update_show_model_status'){
        const allowed=new Set(['submitted','callback','option','confirmed','released','completed','cancelled']);
        const status=String(body.status||'submitted').toLowerCase();if(!allowed.has(status))return json(400,{error:'Unsupported show model status'});
        const {data,error}=await admin.from('season_show_models').update({status}).eq('organization_id',organization.id).eq('id',body.show_model_id).select('*').single();if(error)throw error;
        if(!data||String(data.status)!==status)throw new Error('Show model status could not be verified after write.');
        return json(200,{ok:true,verified:true,show_model:data,persisted_at:new Date().toISOString()});
      }
      if(action==='attach_show_contact'){
        const showId=String(body.show_id||'').trim(),role=String(body.role||'').trim();
        if(!showId)return json(400,{error:'show_id is required'});
        if(!role)return json(400,{error:'role is required (e.g. Casting Director, Photographer, Creative)'});
        const contactId=body.contact_id||null,companyId=body.company_id||null;
        if(!contactId&&!companyId)return json(400,{error:'contact_id or company_id is required'});
        const show=(await rows(admin.from('season_shows').select('id,season_id').eq('organization_id',organization.id).eq('id',showId).limit(1)))[0];
        if(!show)return json(404,{error:'Show not found'});
        const {data,error}=await admin.from('crm_activity').insert({organization_id:organization.id,company_id:companyId,contact_id:contactId,activity_type:'season_assignment',direction:'internal',subject:role,summary:body.notes||null,occurred_at:new Date().toISOString(),created_by:user.id,metadata:{season_show_id:showId,season_id:show.season_id,role}}).select('*').single();
        if(error)throw error;
        return json(200,{ok:true,verified:true,assignment:data,persisted_at:data.occurred_at});
      }
      if(action==='remove_show_contact'){
        const id=String(body.assignment_id||'').trim();if(!id)return json(400,{error:'assignment_id is required'});
        const {error}=await admin.from('crm_activity').delete().eq('organization_id',organization.id).eq('id',id).eq('activity_type','season_assignment');
        if(error)throw error;
        return json(200,{ok:true,verified:true});
      }
      return json(400,{error:'Unsupported season action'});
    }
    const admin=await requirePermission(user.id,organization.id,'season.read'),seasonId=p.season_id||null;
    let seasonsQ=admin.from('seasons').select('*').eq('organization_id',organization.id).order('starts_on',{ascending:false});if(seasonId)seasonsQ=seasonsQ.eq('id',seasonId);
    let modelQ=admin.from('season_models').select('*').eq('organization_id',organization.id).order('readiness_percent',{ascending:true});if(seasonId)modelQ=modelQ.eq('season_id',seasonId);
    let showQ=admin.from('season_shows').select('*').eq('organization_id',organization.id).order('starts_at',{ascending:true});if(seasonId)showQ=showQ.eq('season_id',seasonId);
    const warnings=[];
    const [seasons,seasonModels,shows]=await Promise.all([rows(seasonsQ.limit(100)),rows(modelQ.limit(700)),rows(showQ.limit(500))]);
    const [readiness,showModels,travel,models,companies,markets,availabilityBlocks,bookings,bookingModels,visaCases,castings,castingModels,calendarEvents,developmentActivities,tasks,bookingOptions,workAuthorizations,passports,contacts,seasonAssignments]=await Promise.all([
      optionalRows('season_readiness_items',admin.from('season_readiness_items').select('*').eq('organization_id',organization.id).limit(5000),warnings),
      optionalRows('season_show_models',admin.from('season_show_models').select('*').eq('organization_id',organization.id).limit(3000),warnings),
      optionalRows('travel_records',admin.from('travel_records').select('*').eq('organization_id',organization.id).order('starts_at',{ascending:true}).limit(1000),warnings),
      optionalRows('models',admin.from('models').select('*').eq('organization_id',organization.id).limit(1000),warnings),
      optionalRows('companies',admin.from('companies').select('id,name').eq('organization_id',organization.id).limit(1000),warnings),
      optionalRows('markets',admin.from('markets').select('*').eq('organization_id',organization.id).limit(100),warnings),
      optionalRows('availability_blocks',admin.from('availability_blocks').select('*').eq('organization_id',organization.id).neq('status','cancelled').order('starts_at',{ascending:true}).limit(2000),warnings),
      optionalRows('bookings',admin.from('bookings').select('*').eq('organization_id',organization.id).not('status','in','(cancelled,closed)').order('starts_at',{ascending:true}).limit(2000),warnings),
      optionalRows('booking_models',admin.from('booking_models').select('*').eq('organization_id',organization.id).limit(5000),warnings),
      optionalRows('visa_cases',admin.from('visa_cases').select('*').eq('organization_id',organization.id).limit(2000),warnings),
      optionalRows('castings',admin.from('castings').select('*').eq('organization_id',organization.id).limit(2000),warnings),
      optionalRows('casting_models',admin.from('casting_models').select('*').eq('organization_id',organization.id).limit(5000),warnings),
      optionalRows('calendar_events',admin.from('calendar_events').select('*').eq('organization_id',organization.id).limit(3000),warnings),
      optionalRows('development_activities',admin.from('development_activities').select('*').eq('organization_id',organization.id).limit(3000),warnings),
      optionalRows('tasks',admin.from('tasks').select('*').eq('organization_id',organization.id).limit(3000),warnings),
      optionalRows('booking_options',admin.from('booking_options').select('*').eq('organization_id',organization.id).in('status',['active','challenged']).limit(3000),warnings),
      optionalRows('work_authorizations',admin.from('work_authorizations').select('*').eq('organization_id',organization.id).limit(3000),warnings),
      optionalRows('passports',admin.from('passports').select('*').eq('organization_id',organization.id).limit(1500),warnings),
      optionalRows('contacts',admin.from('contacts').select('id,display_name,title,company_id,email').eq('organization_id',organization.id).limit(2000),warnings),
      optionalRows('season_assignments',admin.from('crm_activity').select('*').eq('organization_id',organization.id).eq('activity_type','season_assignment').limit(3000),warnings)
    ]);
    const mm=new Map(models.map(x=>[x.id,x])),cm=new Map(companies.map(x=>[x.id,x])),cnm=new Map(contacts.map(x=>[x.id,x])),marketMap=new Map(markets.map(x=>[x.id,x])),readyMap=group(readiness,'season_model_id'),showModelMap=group(showModels,'season_show_id');
    const showContactsFor=showId=>seasonAssignments.filter(x=>x.metadata&&x.metadata.season_show_id===showId).map(x=>({id:x.id,role:x.metadata.role||x.subject||'Creative',notes:x.summary||null,occurred_at:x.occurred_at,contact:x.contact_id?cnm.get(x.contact_id)||null:null,company:x.company_id?cm.get(x.company_id)||null:null}));
    return json(200,{environment:'veux-saas-v13-season-operating-authority',organization,seasons:seasons.map(x=>({...x,markets:marketMap.get(x.market_id)||null})),season_models:seasonModels.map(x=>({...x,models:mm.get(x.model_id)||null,season_readiness_items:readyMap.get(x.id)||[]})),shows:shows.map(x=>({...x,companies:cm.get(x.company_id)||null,season_show_models:(showModelMap.get(x.id)||[]).map(y=>({...y,models:mm.get(y.model_id)||null})),season_show_contacts:showContactsFor(x.id)})),travel:travel.map(x=>({...x,models:mm.get(x.model_id)||null})),availability_blocks:availabilityBlocks,bookings:bookings.map(x=>({...x,companies:cm.get(x.company_id)||null,markets:marketMap.get(x.market_id)||null})),booking_models:bookingModels,visa_cases:visaCases,models,contacts,companies,castings,casting_models:castingModels,calendar_events:calendarEvents,development_activities:developmentActivities,tasks,booking_options:bookingOptions,work_authorizations:workAuthorizations,passports,warnings,degraded:warnings.length>0});
  }catch(error){return errorResponse(error);}
};
