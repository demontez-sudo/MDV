import { requireUser, parseBody, json, errorResponse, assertPermission } from './_lib/auth.mjs';
import { requireStaffOrganization, requirePermission } from './_lib/agent-bridge.mjs';

async function rows(q){ const {data,error}=await q; if(error) throw error; return data||[]; }
function list(v){ return String(v||'').split(',').map(x=>x.trim()).filter(Boolean); }
function bool(v){ if(v==null||v==='') return undefined; return ['1','true','yes'].includes(String(v).toLowerCase()); }


function rpcUnavailable(error){
  const code=String(error?.code||'').toUpperCase();
  const msg=String(error?.message||error||'').toLowerCase();
  return code==='PGRST202'||code==='42883'||msg.includes('could not find the function')||(msg.includes('function')&&msg.includes('does not exist'))||msg.includes('schema cache');
}
async function safeRows(q){
  try{const {data,error}=await q;if(error)throw error;return data||[];}catch(_e){return [];}
}
function groupBy(rows,key){
  const out=new Map();
  for(const x of rows||[]){const k=String(x?.[key]||'');if(!k)continue;if(!out.has(k))out.set(k,[]);out.get(k).push(x);}
  return out;
}
async function fallbackRoster(admin,organizationId,filter){
  let q=admin.from('models').select('*').eq('organization_id',organizationId).order('display_name').limit(Math.min(Number(filter.limit||250),500));
  if(filter.status)q=q.eq('status',filter.status);
  if(filter.stage)q=q.eq('stage',filter.stage);
  if(filter.active!==undefined)q=q.eq('active',!!filter.active);
  if(filter.q){
    const term=String(filter.q).replace(/[%_,]/g,' ').trim();
    if(term)q=q.or(`display_name.ilike.%${term}%,public_slug.ilike.%${term}%,legacy_key.ilike.%${term}%,primary_market_label.ilike.%${term}%`);
  }
  let models=await safeRows(q);
  if(!models.length)return [];

  const ids=models.map(x=>x.id).filter(Boolean);
  const [marketA,divisionA,measurements,media,tagA,skillA]=await Promise.all([
    safeRows(admin.from('model_market_assignments').select('model_id,is_primary,status,market_id,markets(id,name,code,city)').eq('organization_id',organizationId).in('model_id',ids)),
    safeRows(admin.from('model_division_assignments').select('model_id,is_primary,status,division_id,board_id,divisions(id,name,code),boards(id,name)').eq('organization_id',organizationId).in('model_id',ids)),
    safeRows(admin.from('model_measurements').select('*').eq('organization_id',organizationId).in('model_id',ids)),
    safeRows(admin.from('model_media').select('id,model_id,url,public_url,category,is_primary,sort_order,status').eq('organization_id',organizationId).in('model_id',ids).order('sort_order')),
    safeRows(admin.from('model_tag_assignments').select('model_id,model_tags(id,name,category,color)').eq('organization_id',organizationId).in('model_id',ids)),
    safeRows(admin.from('model_skill_assignments').select('model_id,proficiency,verified,model_skills(id,name,category)').eq('organization_id',organizationId).in('model_id',ids))
  ]);

  const mg=groupBy(marketA,'model_id'),dg=groupBy(divisionA,'model_id'),mm=new Map(measurements.map(x=>[String(x.model_id),x])),med=groupBy(media,'model_id'),tg=groupBy(tagA,'model_id'),sg=groupBy(skillA,'model_id');

  models=models.map(m=>{
    const markets=(mg.get(String(m.id))||[]).map(a=>({...a.markets,is_primary:!!a.is_primary,status:a.status,assignment_id:a.id,market_id:a.market_id})).filter(x=>x.id||x.name);
    const divisions=(dg.get(String(m.id))||[]).map(a=>({...(a.divisions||{}),is_primary:!!a.is_primary,status:a.status,board:a.boards?.name||null,board_id:a.board_id,division_id:a.division_id})).filter(x=>x.id||x.name||x.board);
    const measure=mm.get(String(m.id))||{};
    const medias=med.get(String(m.id))||[];
    const primary=medias.find(x=>x.is_primary)||medias.find(x=>/headshot|portfolio/i.test(String(x.category||'')))||medias[0]||null;
    const tags=(tg.get(String(m.id))||[]).map(x=>x.model_tags).filter(Boolean);
    const skills=(sg.get(String(m.id))||[]).map(x=>x.model_skills?({...x.model_skills,proficiency:x.proficiency,verified:x.verified}):null).filter(Boolean);
    const cm=Number(measure.height_cm||m.height_cm||0);
    return {
      ...m,
      ...measure,
      markets,divisions,tags,skills,
      primary_media:primary?{...primary,url:primary.url||primary.public_url||null}:null,
      height_display:m.height_display||measure.height_display||(cm?`${Math.round(cm)} cm`:null),
      bust_display:m.bust_display||measure.bust_display||measure.bust||null,
      chest_display:m.chest_display||measure.chest_display||measure.chest||null,
      waist_display:m.waist_display||measure.waist_display||measure.waist||null,
      hips_display:m.hips_display||measure.hips_display||measure.hips||null,
      shoe:m.shoe||measure.shoe||measure.shoe_size||null,
      hair:m.hair||measure.hair||m.hair_color||null,
      eyes:m.eyes||measure.eyes||m.eye_color||null
    };
  });

  if(filter.market_id)models=models.filter(m=>m.markets.some(x=>String(x.id||x.market_id)===String(filter.market_id)));
  if(filter.division_id)models=models.filter(m=>m.divisions.some(x=>String(x.id||x.division_id)===String(filter.division_id)));
  if(filter.board_id)models=models.filter(m=>m.divisions.some(x=>String(x.board_id)===String(filter.board_id)));
  if(filter.tag_ids?.length)models=models.filter(m=>filter.tag_ids.every(id=>m.tags.some(x=>String(x.id)===String(id))));
  if(filter.skill_ids?.length)models=models.filter(m=>filter.skill_ids.every(id=>m.skills.some(x=>String(x.id)===String(id))));
  return models;
}

export const handler=async(event)=>{
  if(!['GET','POST'].includes(event.httpMethod)) return json(405,{error:'Method not allowed'});
  try{
    const {user,client}=await requireUser(event);
    const p=event.queryStringParameters||{};
    const body=event.httpMethod==='POST'?parseBody(event):{};
    const {organization,member}=await requireStaffOrganization({user,client,organizationSlug:body.organization_slug||p.organization||'maison-de-veux'});

    if(event.httpMethod==='POST'){
      const action=String(body.action||'');
      if(['create_tag','assign_tag','remove_tag','create_skill','assign_skill','remove_skill'].includes(action)){
        const admin=await requirePermission(user.id,organization.id,'models.write');
        if(action==='create_tag'){
          const name=String(body.name||'').trim(); if(!name) return json(400,{error:'name is required'});
          const {data,error}=await admin.from('model_tags').insert({organization_id:organization.id,name,category:body.category||null,color:body.color||null,created_by:user.id}).select('*').single(); if(error) throw error;
          return json(200,{ok:true,verified:true,tag:data,persisted_at:data?.created_at||new Date().toISOString()});
        }
        if(action==='assign_tag'){
          const {error}=await admin.from('model_tag_assignments').upsert({organization_id:organization.id,model_id:body.model_id,tag_id:body.tag_id,assigned_by:user.id},{onConflict:'model_id,tag_id'}); if(error) throw error;
          return json(200,{ok:true});
        }
        if(action==='remove_tag'){
          const {data,error}=await admin.from('model_tag_assignments').delete().eq('organization_id',organization.id).eq('model_id',body.model_id).eq('tag_id',body.tag_id).select('model_id,tag_id').single(); if(error) throw error;
          return json(200,{ok:true,verified:true,removed:data,persisted_at:new Date().toISOString()});
        }
        if(action==='create_skill'){
          const name=String(body.name||'').trim(); if(!name) return json(400,{error:'name is required'});
          const {data,error}=await admin.from('model_skills').insert({organization_id:organization.id,name,category:body.category||null,created_by:user.id}).select('*').single(); if(error) throw error;
          return json(200,{ok:true,verified:true,skill:data,persisted_at:data?.created_at||new Date().toISOString()});
        }
        if(action==='assign_skill'){
          const {error}=await admin.from('model_skill_assignments').upsert({organization_id:organization.id,model_id:body.model_id,skill_id:body.skill_id,proficiency:body.proficiency||null,verified:!!body.verified,assigned_by:user.id},{onConflict:'model_id,skill_id'}); if(error) throw error;
          return json(200,{ok:true});
        }
        if(action==='remove_skill'){
          const {data,error}=await admin.from('model_skill_assignments').delete().eq('organization_id',organization.id).eq('model_id',body.model_id).eq('skill_id',body.skill_id).select('model_id,skill_id').single(); if(error) throw error;
          return json(200,{ok:true,verified:true,removed:data,persisted_at:new Date().toISOString()});
        }
      }
      if(['save_search','delete_saved_search'].includes(action)){
        const admin=await requirePermission(user.id,organization.id,'roster.saved_searches');
        if(action==='delete_saved_search'){
          const {data,error}=await admin.from('saved_roster_searches').delete().eq('organization_id',organization.id).eq('member_id',member.id).eq('id',body.search_id).select('id').single(); if(error) throw error;
          return json(200,{ok:true,verified:true,deleted_id:data.id,persisted_at:new Date().toISOString()});
        }
        const name=String(body.name||'').trim(); if(!name) return json(400,{error:'name is required'});
        const existing=await rows(admin.from('saved_roster_searches').select('id').eq('organization_id',organization.id).eq('member_id',member.id).ilike('name',name).limit(1));
        const payload={organization_id:organization.id,member_id:member.id,name,filters:body.filters||{},shared:!!body.shared,pinned:!!body.pinned};
        let result;
        if(existing[0]){ const {data,error}=await admin.from('saved_roster_searches').update(payload).eq('id',existing[0].id).select('*').single(); if(error) throw error; result=data; }
        else { const {data,error}=await admin.from('saved_roster_searches').insert(payload).select('*').single(); if(error) throw error; result=data; }
        return json(200,{ok:true,verified:true,saved_search:result,persisted_at:result?.updated_at||result?.created_at||new Date().toISOString()});
      }
      return json(400,{error:'Unsupported roster action'});
    }

    const admin=await requirePermission(user.id,organization.id,'models.read');
    const filter={limit:Number(p.limit||250)};
    for(const k of ['q','market_id','division_id','board_id','gender','stage','status','min_height_cm','max_height_cm','available_start','available_end']) if(p[k]) filter[k]=p[k];
    if(p.active!==undefined){ const b=bool(p.active); if(b!==undefined) filter.active=b; }
    const tags=list(p.tag_ids); if(tags.length) filter.tag_ids=tags;
    const skills=list(p.skill_ids); if(skills.length) filter.skill_ids=skills;
    let roster=[];
    const rpcResult=await client.rpc('search_roster',{target_org:organization.id,filter_data:filter});
    if(rpcResult.error){
      if(!rpcUnavailable(rpcResult.error)) throw rpcResult.error;
      roster=await fallbackRoster(admin,organization.id,{...filter,tag_ids:tags,skill_ids:skills});
    }else roster=rpcResult.data||[];
    const [tagRows,skillRows,markets,divisions,boards,saved]=await Promise.all([
      rows(admin.from('model_tags').select('*').eq('organization_id',organization.id).eq('active',true).order('name')),
      rows(admin.from('model_skills').select('*').eq('organization_id',organization.id).eq('active',true).order('name')),
      rows(admin.from('markets').select('id,name,code,city').eq('organization_id',organization.id).eq('active',true).order('sort_order')),
      rows(admin.from('divisions').select('id,name,code').eq('organization_id',organization.id).eq('active',true).order('sort_order')),
      rows(admin.from('boards').select('id,name,market_id,division_id').eq('organization_id',organization.id).eq('active',true).order('sort_order')),
      rows(admin.from('saved_roster_searches').select('*').eq('organization_id',organization.id).or(`shared.eq.true,member_id.eq.${member.id}`).order('pinned',{ascending:false}).order('updated_at',{ascending:false}))
    ]);
    const canWrite=await assertPermission(admin,user.id,organization.id,'models.write');const canSaved=await assertPermission(admin,user.id,organization.id,'roster.saved_searches');return json(200,{environment:'veux-saas-v10',organization,filters:filter,roster:roster||[],tags:tagRows,skills:skillRows,markets,divisions,boards,saved_searches:saved,access:{write:canWrite,saved_searches:canSaved}});
  }catch(error){ return errorResponse(error); }
};
