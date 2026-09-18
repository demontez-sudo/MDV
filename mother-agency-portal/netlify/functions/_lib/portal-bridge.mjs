import { adminClient } from './auth.mjs';

export async function requirePortalContext({ user, organizationSlug='maison-de-veux', memberType }) {
  const admin = adminClient();
  const { data:organization, error:orgError } = await admin.from('organizations').select('*').eq('slug',organizationSlug).maybeSingle();
  if (orgError) throw orgError;
  if (!organization) { const e=new Error('Organization not found'); e.statusCode=404; throw e; }
  const { data:pendingMember,error:memberError } = await admin.from('organization_members')
    .select('*').eq('organization_id',organization.id).eq('user_id',user.id).eq('member_type',memberType).in('status',['active','invited']).maybeSingle();
  if(memberError) throw memberError;
  if(!pendingMember){const e=new Error(`This account does not have ${memberType} portal access to the selected agency.`);e.statusCode=403;throw e;}
  let member=pendingMember;
  if(pendingMember.status==='invited'){
    const {data:activated,error:activationError}=await admin.from('organization_members')
      .update({status:'active',joined_at:pendingMember.joined_at||new Date().toISOString(),last_seen_at:new Date().toISOString()})
      .eq('id',pendingMember.id).eq('user_id',user.id).select('*').single();
    if(activationError)throw activationError;
    member=activated;
  }
  const { data:profile,error:profileError } = await admin.from('profiles').select('*').eq('user_id',user.id).maybeSingle();
  if(profileError) throw profileError;
  return {admin,organization,member,profile};
}

export async function requireModelPortal({user,organizationSlug}){
  const ctx=await requirePortalContext({user,organizationSlug,memberType:'model'});
  const {data:link,error}=await ctx.admin.from('model_user_links')
    .select('id,model_id').eq('organization_id',ctx.organization.id).eq('user_id',user.id).maybeSingle();
  if(error)throw error;
  if(!link){const e=new Error('No model profile is linked to this account.');e.statusCode=403;throw e;}
  return {...ctx,modelId:link.model_id,link};
}

export async function requirePartnerPortal({user,organizationSlug}){
  const ctx=await requirePortalContext({user,organizationSlug,memberType:'partner'});
  const {data:link,error}=await ctx.admin.from('partner_user_links')
    .select('id,partner_agency_id').eq('organization_id',ctx.organization.id).eq('user_id',user.id).maybeSingle();
  if(error)throw error;
  if(!link){const e=new Error('No partner agency is linked to this account.');e.statusCode=403;throw e;}
  return {...ctx,partnerAgencyId:link.partner_agency_id,link};
}

export async function loadTeam(admin,organizationId){
  const {data:members,error}=await admin.from('organization_members').select('id,user_id,job_title,status,metadata').eq('organization_id',organizationId).eq('member_type','staff').eq('status','active');
  if(error)throw error;
  const userIds=(members||[]).map(x=>x.user_id).filter(Boolean);
  let profiles=[];
  if(userIds.length){const q=await admin.from('profiles').select('user_id,display_name,first_name,last_name,avatar_url').in('user_id',userIds);if(q.error)throw q.error;profiles=q.data||[];}
  const byUser=new Map(profiles.map(x=>[x.user_id,x]));
  return (members||[]).map(m=>({member_id:m.id,user_id:m.user_id,job_title:m.job_title,metadata:{legacy_key:m.metadata?.legacy_staff_key||m.metadata?.legacy_key||null,legacy_staff_key:m.metadata?.legacy_staff_key||null},profile:byUser.get(m.user_id)||null}));
}

async function fetchByIds(admin,table,organizationId,ids,select='*'){
  const unique=[...new Set((ids||[]).filter(Boolean).map(String))];
  if(!unique.length)return[];
  const {data,error}=await admin.from(table).select(select).eq('organization_id',organizationId).in('id',unique);
  if(error)throw error;
  return data||[];
}

export async function loadModels(admin,organizationId,modelIds){
  const ids=[...new Set((modelIds||[]).filter(Boolean).map(String))];
  if(!ids.length)return[];
  const q=await admin.from('models').select('*').eq('organization_id',organizationId).in('id',ids);
  if(q.error)throw q.error;
  const modelRows=q.data||[];
  const [meas,media,priv,marketsRaw,divisionsRaw]=await Promise.all([
    admin.from('model_measurements').select('*').eq('organization_id',organizationId).in('model_id',ids),
    admin.from('model_media').select('*').eq('organization_id',organizationId).in('model_id',ids).order('sort_order'),
    admin.from('model_private_profiles').select('model_id,email,phone,whatsapp,instagram,nationality').eq('organization_id',organizationId).in('model_id',ids),
    admin.from('model_market_assignments').select('model_id,market_id,is_primary,status,start_date,end_date,metadata').eq('organization_id',organizationId).in('model_id',ids),
    admin.from('model_division_assignments').select('model_id,division_id,board_id,is_primary,start_date,end_date,metadata').eq('organization_id',organizationId).in('model_id',ids)
  ]);
  for(const x of [meas,media,priv,marketsRaw,divisionsRaw])if(x.error)throw x.error;

  const [marketCatalog,divisionCatalog,boardCatalog]=await Promise.all([
    fetchByIds(admin,'markets',organizationId,(marketsRaw.data||[]).map(x=>x.market_id),'id,name,code'),
    fetchByIds(admin,'divisions',organizationId,(divisionsRaw.data||[]).map(x=>x.division_id),'id,name'),
    fetchByIds(admin,'boards',organizationId,(divisionsRaw.data||[]).map(x=>x.board_id),'id,name')
  ]);
  const marketById=new Map(marketCatalog.map(x=>[String(x.id),x]));
  const divisionById=new Map(divisionCatalog.map(x=>[String(x.id),x]));
  const boardById=new Map(boardCatalog.map(x=>[String(x.id),x]));
  const marketAssignments=(marketsRaw.data||[]).map(x=>({...x,markets:marketById.get(String(x.market_id))||null}));
  const divisionAssignments=(divisionsRaw.data||[]).map(x=>({...x,divisions:divisionById.get(String(x.division_id))||null,boards:boardById.get(String(x.board_id))||null}));

  const one=(arr,key)=>new Map((arr||[]).map(x=>[String(x[key]),x]));
  const many=(arr,key)=>{const m=new Map();for(const x of arr||[]){const k=String(x[key]);if(!m.has(k))m.set(k,[]);m.get(k).push(x);}return m;};
  const measMap=one(meas.data,'model_id'),privMap=one(priv.data,'model_id'),mediaMap=many(media.data,'model_id'),marketMap=many(marketAssignments,'model_id'),divMap=many(divisionAssignments,'model_id');
  return modelRows.map(r=>({...r,measurement:measMap.get(String(r.id))||null,private_profile:privMap.get(String(r.id))||null,media:mediaMap.get(String(r.id))||[],market_assignments:marketMap.get(String(r.id))||[],division_assignments:divMap.get(String(r.id))||[]}));
}

export function isoDate(v){return v?String(v).slice(0,10):'';}
export function isoTime(v){if(!v)return'';const d=new Date(v);if(Number.isNaN(d.getTime()))return'';return d.toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'});}
