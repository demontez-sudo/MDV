import { requireUser, parseBody, json, errorResponse } from './_lib/auth.mjs';
import { requireStaffOrganization, requirePermission } from './_lib/agent-bridge.mjs';
import fashionWeeks from './_data/fashion-weeks-ss27.json';
async function rows(q){const {data,error}=await q;if(error)throw error;return data||[];}
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
      if(action==='import_fashion_weeks'){
        const report=[];
        const companies=await rows(admin.from('companies').select('id,name').eq('organization_id',organization.id).limit(3000));
        const byName=new Map(companies.map(c=>[String(c.name||'').trim().toLowerCase(),c.id]));
        const markets=await rows(admin.from('markets').select('id,name').eq('organization_id',organization.id).limit(200));
        for(const def of fashionWeeks.seasons){
          let season=(await rows(admin.from('seasons').select('*').eq('organization_id',organization.id).eq('name',def.name).limit(1)))[0];
          const market=markets.find(m=>String(m.name||'').toLowerCase().includes(String(def.market).toLowerCase()))||null;
          if(!season){
            const {data,error}=await admin.from('seasons').insert({organization_id:organization.id,name:def.name,season_type:'fashion_week',market_id:market?.id||null,starts_on:def.starts_on,ends_on:def.ends_on,status:'planning',notes:def.notes}).select('*').single();if(error)throw error;season=data;
          }
          const have=await rows(admin.from('season_shows').select('id,title,starts_at').eq('season_id',season.id).limit(5000));
          const key=x=>String(x.title||'').trim().toLowerCase()+'|'+new Date(x.starts_at).toISOString();
          const seen=new Set(have.map(key));
          const fresh=def.shows.filter(x=>!seen.has(key(x)));
          const payload=fresh.map(x=>({organization_id:organization.id,season_id:season.id,title:x.title,company_id:byName.get(String(x.title).trim().toLowerCase())||null,starts_at:x.starts_at,location:x.location||def.city,status:'planned',notes:`kind=${x.kind};ends=${x.ends_at||''};src=fashion-week-calendar`}));
          for(let i=0;i<payload.length;i+=150){const {error}=await admin.from('season_shows').insert(payload.slice(i,i+150));if(error)throw error;}
          report.push({season:def.name,season_id:season.id,imported:payload.length,already_present:def.shows.length-payload.length});
        }
        return json(200,{ok:true,verified:true,report,persisted_at:new Date().toISOString()});
      }
      if(action==='update_show'){
        const patch={};for(const k of ['title','starts_at','location','notes'])if(body[k]!==undefined)patch[k]=body[k]===''?null:body[k];if(body.status)patch.status=normShowStatus(body.status);if(body.company_id!==undefined)patch.company_id=body.company_id||null;
        const {data,error}=await admin.from('season_shows').update(patch).eq('organization_id',organization.id).eq('id',body.show_id).select('*').single();if(error)throw error;
        return json(200,{ok:true,verified:true,show:data,persisted_at:new Date().toISOString()});
      }
      if(action==='delete_show'){
        const {error}=await admin.from('season_shows').delete().eq('organization_id',organization.id).eq('id',body.show_id);if(error)throw error;
        return json(200,{ok:true,verified:true,deleted:body.show_id,persisted_at:new Date().toISOString()});
      }
      if(action==='update_season'){
        const patch={};for(const k of ['name','starts_on','ends_on','notes'])if(body[k]!==undefined)patch[k]=body[k]===''?null:body[k];if(body.status)patch.status=normSeasonStatus(body.status);
        const {data,error}=await admin.from('seasons').update(patch).eq('organization_id',organization.id).eq('id',body.season_id).select('*').single();if(error)throw error;
        return json(200,{ok:true,verified:true,season:data,persisted_at:new Date().toISOString()});
      }
      return json(400,{error:'Unsupported season action'});
    }
    const admin=await requirePermission(user.id,organization.id,'season.read'),seasonId=p.season_id||null;
    let seasonsQ=admin.from('seasons').select('*').eq('organization_id',organization.id).order('starts_on',{ascending:false});if(seasonId)seasonsQ=seasonsQ.eq('id',seasonId);
    let modelQ=admin.from('season_models').select('*').eq('organization_id',organization.id).order('readiness_percent',{ascending:true});if(seasonId)modelQ=modelQ.eq('season_id',seasonId);
    let showQ=admin.from('season_shows').select('*').eq('organization_id',organization.id).order('starts_at',{ascending:true});if(seasonId)showQ=showQ.eq('season_id',seasonId);
    const [seasons,seasonModels,shows,readiness,showModels,travel,models,companies,markets]=await Promise.all([
      rows(seasonsQ.limit(100)),rows(modelQ.limit(700)),rows(showQ.limit(3000)),rows(admin.from('season_readiness_items').select('*').eq('organization_id',organization.id).limit(5000)),rows(admin.from('season_show_models').select('*').eq('organization_id',organization.id).limit(8000)),rows(admin.from('travel_records').select('*').eq('organization_id',organization.id).order('starts_at',{ascending:true}).limit(500)),rows(admin.from('models').select('id,display_name,public_slug,primary_market_label').eq('organization_id',organization.id).limit(1000)),rows(admin.from('companies').select('id,name').eq('organization_id',organization.id).limit(1000)),rows(admin.from('markets').select('id,name,code').eq('organization_id',organization.id).limit(100))
    ]);
    const mm=new Map(models.map(x=>[x.id,x])),cm=new Map(companies.map(x=>[x.id,x])),marketMap=new Map(markets.map(x=>[x.id,x])),readyMap=group(readiness,'season_model_id'),showModelMap=group(showModels,'season_show_id');
    return json(200,{environment:'veux-saas-v9',organization,seasons:seasons.map(x=>({...x,markets:marketMap.get(x.market_id)||null})),season_models:seasonModels.map(x=>({...x,models:mm.get(x.model_id)||null,season_readiness_items:readyMap.get(x.id)||[]})),shows:shows.map(x=>({...x,companies:cm.get(x.company_id)||null,season_show_models:(showModelMap.get(x.id)||[]).map(y=>({...y,models:mm.get(y.model_id)||null}))})),travel:travel.map(x=>({...x,models:mm.get(x.model_id)||null}))});
  }catch(error){return errorResponse(error);}
};
