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

export async function requireModelPortal({user,organizationSlug='maison-de-veux'}){
  const admin=adminClient();
  const {data:organization,error:orgError}=await admin.from('organizations')
    .select('*').eq('slug',organizationSlug).maybeSingle();
  if(orgError)throw orgError;
  if(!organization){const e=new Error('Organization not found');e.statusCode=404;throw e;}

  const {data:link,error:linkError}=await admin.from('model_user_links')
    .select('id,model_id').eq('organization_id',organization.id).eq('user_id',user.id).maybeSingle();
  if(linkError)throw linkError;
  if(!link){const e=new Error('No model profile is linked to this account.');e.statusCode=403;throw e;}

  const {data:pendingMember,error:memberError}=await admin.from('organization_members')
    .select('*').eq('organization_id',organization.id).eq('user_id',user.id)
    .eq('member_type','model').in('status',['active','invited']).maybeSingle();
  if(memberError)throw memberError;
  let member=pendingMember||null;
  if(member?.status==='invited'){
    const {data:activated,error:activationError}=await admin.from('organization_members')
      .update({status:'active',joined_at:member.joined_at||new Date().toISOString(),last_seen_at:new Date().toISOString()})
      .eq('id',member.id).eq('user_id',user.id).select('*').single();
    if(activationError)throw activationError;
    member=activated;
  }

  const {data:profile,error:profileError}=await admin.from('profiles')
    .select('*').eq('user_id',user.id).maybeSingle();
  if(profileError)throw profileError;

  return {admin,organization,member,profile,modelId:link.model_id,link};
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
  const userIds=(members||[]).map(x=>x.user_id);
  let profiles=[];
  if(userIds.length){const q=await admin.from('profiles').select('user_id,display_name,first_name,last_name,avatar_url').in('user_id',userIds);if(q.error)throw q.error;profiles=q.data||[];}
  const byUser=new Map(profiles.map(x=>[x.user_id,x]));
  return (members||[]).map(m=>({member_id:m.id,user_id:m.user_id,job_title:m.job_title,metadata:{legacy_key:m.metadata?.legacy_staff_key||m.metadata?.legacy_key||null,legacy_staff_key:m.metadata?.legacy_staff_key||null},profile:byUser.get(m.user_id)||null}));
}

export async function loadModels(admin,organizationId,modelIds){
  if(!modelIds?.length)return[];
  const q=await admin.from('models').select('*').eq('organization_id',organizationId).in('id',modelIds);
  if(q.error)throw q.error;
  const rows=q.data||[];
  const [meas,media,priv,markets,divisions]=await Promise.all([
    admin.from('model_measurements').select('*').eq('organization_id',organizationId).in('model_id',modelIds),
    admin.from('model_media').select('*').eq('organization_id',organizationId).in('model_id',modelIds).order('sort_order'),
    admin.from('model_private_profiles').select('model_id,email,phone,whatsapp,instagram,date_of_birth,nationality,emergency_contact,internal_notes,metadata').eq('organization_id',organizationId).in('model_id',modelIds),
    admin.from('model_market_assignments').select('model_id,is_primary,status,markets!model_market_market_same_org_fk(id,name,code)').eq('organization_id',organizationId).in('model_id',modelIds),
    admin.from('model_division_assignments').select('model_id,is_primary,division_id,board_id,divisions!model_division_division_same_org_fk(id,name)').eq('organization_id',organizationId).in('model_id',modelIds)
  ]);
  for(const x of [meas,media,priv,markets,divisions])if(x.error)throw x.error;
  const boardIds=[...new Set((divisions.data||[]).map(x=>x.board_id).filter(Boolean))];
  let boardRows=[];
  if(boardIds.length){const b=await admin.from('boards').select('id,name,market_id,division_id,sort_order').eq('organization_id',organizationId).in('id',boardIds);if(b.error)throw b.error;boardRows=b.data||[];}
  const boardMarketIds=[...new Set(boardRows.map(x=>x.market_id).filter(Boolean))];
  let boardMarkets=[];
  if(boardMarketIds.length){const m=await admin.from('markets').select('id,name,code,sort_order').eq('organization_id',organizationId).in('id',boardMarketIds);if(m.error)throw m.error;boardMarkets=m.data||[];}
  const marketById=new Map(boardMarkets.map(x=>[String(x.id),x]));
  const boardById=new Map(boardRows.map(x=>[String(x.id),{...x,markets:marketById.get(String(x.market_id))||null}]));
  const enrichedDivisions=(divisions.data||[]).map(x=>({...x,boards:boardById.get(String(x.board_id))||null}));
  const one=(arr,key)=>new Map((arr||[]).map(x=>[x[key],x]));
  const many=(arr,key)=>{const m=new Map();for(const x of arr||[]){if(!m.has(x[key]))m.set(x[key],[]);m.get(x[key]).push(x);}return m;};
  const measMap=one(meas.data,'model_id'),privMap=one(priv.data,'model_id'),mediaMap=many(media.data,'model_id'),marketMap=many(markets.data,'model_id'),divMap=many(enrichedDivisions,'model_id');
  return rows.map(r=>({...r,measurement:measMap.get(r.id)||null,private_profile:privMap.get(r.id)||null,media:mediaMap.get(r.id)||[],market_assignments:marketMap.get(r.id)||[],division_assignments:divMap.get(r.id)||[]}));
}

export function isoDate(v){return v?String(v).slice(0,10):'';}
export function isoTime(v){if(!v)return'';const d=new Date(v);if(Number.isNaN(d.getTime()))return'';return d.toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'});}
