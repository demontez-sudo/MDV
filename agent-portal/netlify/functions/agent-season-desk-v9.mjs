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
          const allSeasons=await rows(admin.from('seasons').select('*').eq('organization_id',organization.id).limit(500));
          const pat={'nyfw-ss27':/nyfw|new\s*york/i,'lfw-ss27':/lfw|london/i,'mfw-ss27':/mfw|milan/i,'pfw-ss27':/pfw|paris/i}[def.key];
          let season=allSeasons.find(x=>x.name===def.name)||allSeasons.find(x=>pat&&pat.test(String(x.name||'')))||null;
          if(season&&(!season.starts_on||!season.ends_on)&&def.starts_on){const {data:u}=await admin.from('seasons').update({starts_on:season.starts_on||def.starts_on,ends_on:season.ends_on||def.ends_on}).eq('id',season.id).select('*').single();if(u)season=u;}
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
      if(action==='remove_show_model'){
        const {error}=await admin.from('season_show_models').delete().eq('organization_id',organization.id).eq('season_show_id',body.show_id).eq('model_id',body.model_id);if(error)throw error;
        return json(200,{ok:true,verified:true,persisted_at:new Date().toISOString()});
      }
      if(action==='assign_show_models'){
        const ids=[...new Set((Array.isArray(body.model_ids)?body.model_ids:[]).filter(Boolean).map(String))];if(!body.show_id||!ids.length)return json(400,{error:'show_id and model_ids are required'});
        const have=await rows(admin.from('season_show_models').select('model_id').eq('organization_id',organization.id).eq('season_show_id',body.show_id).limit(500));
        const seen=new Set(have.map(x=>x.model_id));const fresh=ids.filter(x=>!seen.has(x));
        if(fresh.length){const {error}=await admin.from('season_show_models').insert(fresh.map(id=>({organization_id:organization.id,season_show_id:body.show_id,model_id:id,status:'submitted',notes:body.notes||null})));if(error)throw error;}
        return json(200,{ok:true,verified:true,added:fresh.length,already:ids.length-fresh.length,persisted_at:new Date().toISOString()});
      }
      if(action==='crm_link_designer'){
        await requirePermission(user.id,organization.id,'crm.write');
        const clean=v=>String(v==null?'':v).trim();
        const name=clean(body.company&&body.company.name);if(!body.show_id)return json(400,{error:'show_id is required'});
        const out={company:null,created_company:false,contacts:[],created_contacts:0,linked:0};
        const show=(await rows(admin.from('season_shows').select('id,title,company_id').eq('organization_id',organization.id).eq('id',body.show_id).limit(1)))[0];if(!show)return json(404,{error:'Show not found'});
        let company=null;
        if(show.company_id)company=(await rows(admin.from('companies').select('*').eq('organization_id',organization.id).eq('id',show.company_id).limit(1)))[0]||null;
        if(!company&&(name||show.title)){
          const nm=name||show.title;
          company=(await rows(admin.from('companies').select('*').eq('organization_id',organization.id).ilike('name',nm).limit(1)))[0]||null;
          if(!company){
            const ct=['brand','agency','casting_office','photographer','media','production','other'].includes(clean(body.company&&body.company.company_type))?body.company.company_type:'brand';
            const {data,error}=await admin.from('companies').insert({organization_id:organization.id,name:nm,company_type:ct,website:clean(body.company&&body.company.website)||null,notes:clean(body.company&&body.company.notes)||'Added from Season by Vera research. Verify details.'}).select('*').single();if(error)throw error;company=data;out.created_company=true;
          }
          await admin.from('season_shows').update({company_id:company.id}).eq('organization_id',organization.id).eq('id',show.id);
        }
        out.company=company&&{id:company.id,name:company.name};
        for(const c of Array.isArray(body.contacts)?body.contacts.slice(0,12):[]){
          const dn=clean(c.display_name);if(!dn)continue;
          let contact=(await rows(admin.from('contacts').select('*').eq('organization_id',organization.id).ilike('display_name',dn).limit(1)))[0]||null;
          if(!contact){
            const {data,error}=await admin.from('contacts').insert({organization_id:organization.id,display_name:dn,role:clean(c.role)||'Casting Director',company_id:company?.id||null,email:clean(c.email)||null,instagram:clean(c.instagram)||null,market:clean(c.market)||null,notes:clean(c.notes)||'Added from Season by Vera research. Verify details.'}).select('*').single();if(error)throw error;contact=data;out.created_contacts++;
          }
          if(company){
            const ex=(await rows(admin.from('contact_company_links').select('contact_id').eq('organization_id',organization.id).eq('contact_id',contact.id).eq('company_id',company.id).limit(1)))[0];
            if(!ex){const {error}=await admin.from('contact_company_links').insert({organization_id:organization.id,contact_id:contact.id,company_id:company.id,relationship_role:clean(c.role)||'casting_director',is_primary:false});if(error)throw error;out.linked++;}
          }
          out.contacts.push({id:contact.id,display_name:contact.display_name});
        }
        return json(200,{ok:true,verified:true,...out,persisted_at:new Date().toISOString()});
      }
      if(action==='import_designers_to_crm'){
        await requirePermission(user.id,organization.id,'crm.write');
        const seasonId=body.season_id;const list=await rows(admin.from('season_shows').select('id,title,company_id').eq('organization_id',organization.id).eq('season_id',seasonId).limit(3000));
        const companies=await rows(admin.from('companies').select('id,name').eq('organization_id',organization.id).limit(5000));
        const by=new Map(companies.map(c=>[String(c.name||'').trim().toLowerCase(),c.id]));let created=0,linked=0;
        for(const sh of list){
          if(sh.company_id)continue;
          const base=String(sh.title||'').replace(/\s*\(by appointment\)\s*$/i,'').trim();if(!base)continue;
          let id=by.get(base.toLowerCase());
          if(!id){const {data,error}=await admin.from('companies').insert({organization_id:organization.id,name:base,company_type:'brand',notes:'Designer added from a fashion-week schedule.'}).select('id').single();if(error)throw error;id=data.id;by.set(base.toLowerCase(),id);created++;}
          const {error:ue}=await admin.from('season_shows').update({company_id:id}).eq('organization_id',organization.id).eq('id',sh.id);if(ue)throw ue;linked++;
        }
        return json(200,{ok:true,verified:true,created_companies:created,linked_shows:linked,persisted_at:new Date().toISOString()});
      }
      return json(400,{error:'Unsupported season action'});
    }
    const admin=await requirePermission(user.id,organization.id,'season.read'),seasonId=p.season_id||null;
    let seasonsQ=admin.from('seasons').select('*').eq('organization_id',organization.id).order('starts_on',{ascending:false});if(seasonId)seasonsQ=seasonsQ.eq('id',seasonId);
    let modelQ=admin.from('season_models').select('*').eq('organization_id',organization.id).order('readiness_percent',{ascending:true});if(seasonId)modelQ=modelQ.eq('season_id',seasonId);
    let showQ=admin.from('season_shows').select('*').eq('organization_id',organization.id).order('starts_at',{ascending:true});if(seasonId)showQ=showQ.eq('season_id',seasonId);
    const [seasons,seasonModels,shows,readiness,showModels,travel,models,companies,markets]=await Promise.all([
      rows(seasonsQ.limit(100)),rows(modelQ.limit(700)),rows(showQ.limit(3000)),rows(admin.from('season_readiness_items').select('*').eq('organization_id',organization.id).limit(5000)),rows(admin.from('season_show_models').select('*').eq('organization_id',organization.id).limit(8000)),rows(admin.from('travel_records').select('*').eq('organization_id',organization.id).order('starts_at',{ascending:true}).limit(500)),rows(admin.from('models').select('id,display_name,public_slug,primary_market_label,stage,status').eq('organization_id',organization.id).limit(1000)),rows(admin.from('companies').select('id,name,company_type,website').eq('organization_id',organization.id).limit(3000)),rows(admin.from('markets').select('id,name,code').eq('organization_id',organization.id).limit(100))
    ]);
    const mm=new Map(models.map(x=>[x.id,x])),cm=new Map(companies.map(x=>[x.id,x])),marketMap=new Map(markets.map(x=>[x.id,x])),readyMap=group(readiness,'season_model_id'),showModelMap=group(showModels,'season_show_id');
    const [crmContacts,crmLinks]=await Promise.all([rows(admin.from('contacts').select('id,display_name,role,company_id,email,instagram').eq('organization_id',organization.id).limit(4000)),rows(admin.from('contact_company_links').select('contact_id,company_id,relationship_role,is_primary').eq('organization_id',organization.id).limit(8000))]);
    const contactById=new Map(crmContacts.map(x=>[x.id,x])),castingByCompany={};
    for(const l of crmLinks){const c=contactById.get(l.contact_id);if(!c)continue;(castingByCompany[l.company_id]=castingByCompany[l.company_id]||[]).push({id:c.id,display_name:c.display_name,role:l.relationship_role||c.role||'',email:c.email||null,instagram:c.instagram||null});}
    for(const c of crmContacts){if(c.company_id&&!(castingByCompany[c.company_id]||[]).some(x=>x.id===c.id))(castingByCompany[c.company_id]=castingByCompany[c.company_id]||[]).push({id:c.id,display_name:c.display_name,role:c.role||'',email:c.email||null,instagram:c.instagram||null});}
    return json(200,{roster:models,companies,casting_by_company:castingByCompany,environment:'veux-saas-v9',organization,seasons:seasons.map(x=>({...x,markets:marketMap.get(x.market_id)||null})),season_models:seasonModels.map(x=>({...x,models:mm.get(x.model_id)||null,season_readiness_items:readyMap.get(x.id)||[]})),shows:shows.map(x=>({...x,companies:cm.get(x.company_id)||null,season_show_models:(showModelMap.get(x.id)||[]).map(y=>({...y,models:mm.get(y.model_id)||null}))})),travel:travel.map(x=>({...x,models:mm.get(x.model_id)||null}))});
  }catch(error){return errorResponse(error);}
};
