import { requireUser, json, adminClient, assertPermission } from './_lib/auth.mjs';
import { requireStaffOrganization } from './_lib/agent-bridge.mjs';

function item(key,label,status,detail,group='Account Boundaries',meta={}){return {key,label,status,detail,group,...meta};}
function uniq(xs){return [...new Set((xs||[]).filter(Boolean).map(String))];}
async function safe(label, fn){
  try{ const value=await fn(); return {ok:true,value}; }
  catch(error){ return {ok:false,error:String(error?.message||error||`${label} failed`)}; }
}
async function q(admin, table, select, orgId){
  const r=await admin.from(table).select(select).eq('organization_id',orgId);
  if(r.error) throw r.error;
  return r.data||[];
}

export const handler=async(event)=>{
  if(event.httpMethod!=='GET') return json(405,{error:'Method not allowed'});
  try{
    const {user,client}=await requireUser(event);
    const p=event.queryStringParameters||{};
    const {organization,membership,member}=await requireStaffOrganization({user,client,organizationSlug:p.organization||'maison-de-veux'});
    const currentMember=membership||member;
    const admin=adminClient();
    const checks=[];

    // Do not make the whole beta gate depend on a single permission RPC/query.
    const perms=await safe('settings permission',()=>assertPermission(admin,user.id,organization.id,'org.settings.manage'));
    const orgRead=await safe('org read permission',()=>assertPermission(admin,user.id,organization.id,'org.read'));
    const permissionOk=(perms.ok&&perms.value)||(orgRead.ok&&orgRead.value);
    checks.push(item('gate-access','Beta Gate access',permissionOk?'pass':'warn',permissionOk?'Founder/settings or organization-read permission confirmed':'Permission lookup did not confirm settings access; continuing with authenticated staff diagnostics','Access'));
    checks.push(item('session','Authenticated staff session',currentMember?.status==='active'?'pass':'fail',currentMember?.status==='active'?'Active staff membership':'Staff membership is not active','Access'));

    const sources={};
    for(const spec of [
      ['members','organization_members','id,user_id,member_type,status,job_title'],
      ['modelLinks','model_user_links','id,user_id,model_id'],
      ['partnerLinks','partner_user_links','id,user_id,partner_agency_id'],
      ['models','models','id,status,stage'],
      ['partners','partner_agencies','id,portal_enabled,partner_type,company_id'],
      ['placements','model_placements','model_id,partner_agency_id,status']
    ]){
      const [key,table,sel]=spec;
      const res=await safe(table,()=>q(admin,table,sel,organization.id));
      sources[key]=res.ok?res.value:[];
      if(!res.ok) checks.push(item(`source-${key}`,`${table} source`,'warn',res.error,'Diagnostics',{source_error:true}));
    }

    const members=sources.members||[], modelLinks=sources.modelLinks||[], partnerLinks=sources.partnerLinks||[], models=sources.models||[], partners=sources.partners||[], placements=sources.placements||[];
    const staff=members.filter(x=>x.member_type==='staff'&&['active','invited'].includes(String(x.status||'')));

    const memberIds=members.map(x=>x.id).filter(Boolean);
    let roleLinks=[];
    if(memberIds.length){
      const roleLinkRes=await safe('member roles',async()=>{
        const r=await admin.from('member_roles').select('member_id,role_id').in('member_id',memberIds); if(r.error)throw r.error; return r.data||[];
      });
      if(roleLinkRes.ok){
        const raw=roleLinkRes.value;
        const roleIds=uniq(raw.map(x=>x.role_id));
        let roleMap=new Map();
        if(roleIds.length){
          const rr=await safe('roles',async()=>{const r=await admin.from('roles').select('id,key,name').in('id',roleIds);if(r.error)throw r.error;return r.data||[];});
          if(rr.ok) roleMap=new Map(rr.value.map(x=>[String(x.id),x]));
          else checks.push(item('source-roles','roles source','warn',rr.error,'Diagnostics',{source_error:true}));
        }
        roleLinks=raw.map(x=>({...x,roles:roleMap.get(String(x.role_id))||null}));
      }else checks.push(item('source-member-roles','member_roles source','warn',roleLinkRes.error,'Diagnostics',{source_error:true}));
    }

    const roleMemberIds=new Set(roleLinks.map(x=>String(x.member_id)));
    const missingRoles=staff.filter(x=>!roleMemberIds.has(String(x.id)));
    checks.push(item('staff-roles','Staff role coverage',missingRoles.length?'fail':'pass',missingRoles.length?`${missingRoles.length} active/invited staff member(s) have no role`:`${staff.length} staff member(s) covered`));

    const roleCounts={}; for(const l of roleLinks){const k=l.roles?.key||l.roles?.name||'unknown';roleCounts[k]=(roleCounts[k]||0)+1;}
    checks.push(item('role-distribution','Role distribution',roleLinks.length?'pass':'warn',Object.entries(roleCounts).map(([k,v])=>`${k}: ${v}`).join(' · ')||'No role links resolved'));

    const modelIds=new Set(models.map(x=>String(x.id))), partnerIds=new Set(partners.map(x=>String(x.id)));
    const orphanModel=modelLinks.filter(x=>!modelIds.has(String(x.model_id)));
    const orphanPartner=partnerLinks.filter(x=>!partnerIds.has(String(x.partner_agency_id)));
    checks.push(item('model-link-integrity','Model portal link integrity',orphanModel.length?'fail':'pass',`${modelLinks.length} account link(s)${orphanModel.length?` · ${orphanModel.length} orphaned`:''}`,'Portal Mapping'));
    checks.push(item('partner-link-integrity','Partner portal link integrity',orphanPartner.length?'fail':'pass',`${partnerLinks.length} account link(s)${orphanPartner.length?` · ${orphanPartner.length} orphaned`:''}`,'Portal Mapping'));

    const staffUsers=new Set(uniq(staff.map(x=>x.user_id))), modelUsers=new Set(uniq(modelLinks.map(x=>x.user_id))), partnerUsers=new Set(uniq(partnerLinks.map(x=>x.user_id)));
    const overlaps=[]; for(const u of staffUsers){if(modelUsers.has(u))overlaps.push(`${u}: staff+model`);if(partnerUsers.has(u))overlaps.push(`${u}: staff+partner`);} for(const u of modelUsers){if(partnerUsers.has(u))overlaps.push(`${u}: model+partner`);}
    checks.push(item('identity-overlap','Cross-portal identity overlap',overlaps.length?'warn':'pass',overlaps.length?overlaps.join(' · '):'No user identity is linked to conflicting portal types','Isolation'));

    const duplicateModelUsers=Math.max(0,modelLinks.length-uniq(modelLinks.map(x=>x.user_id)).length);
    const duplicatePartnerUsers=Math.max(0,partnerLinks.length-uniq(partnerLinks.map(x=>x.user_id)).length);
    checks.push(item('link-uniqueness','Portal account uniqueness',(duplicateModelUsers||duplicatePartnerUsers)?'warn':'pass',`Model duplicate users: ${duplicateModelUsers} · Partner duplicate users: ${duplicatePartnerUsers}`,'Isolation'));

    const enabledPartners=partners.filter(x=>x.portal_enabled!==false);
    const linkedPartnerIds=new Set(partnerLinks.map(x=>String(x.partner_agency_id)));
    const enabledWithoutUser=enabledPartners.filter(x=>!linkedPartnerIds.has(String(x.id)));
    checks.push(item('partner-access-ready','Enabled partner portal accounts',enabledWithoutUser.length?'warn':'pass',enabledWithoutUser.length?`${enabledWithoutUser.length} enabled partner agency record(s) have no portal user`:`${enabledPartners.length} enabled partner agency record(s) mapped`,'Portal Mapping'));

    const placementPartners=new Set(placements.filter(x=>!['ended','cancelled','inactive'].includes(String(x.status||'').toLowerCase())).map(x=>String(x.partner_agency_id)));
    const placementWithoutPortal=[...placementPartners].filter(id=>!linkedPartnerIds.has(id));
    checks.push(item('placement-partner-access','Active placement partner access',placementWithoutPortal.length?'warn':'pass',placementWithoutPortal.length?`${placementWithoutPortal.length} partner(s) with active placements have no linked portal user`:'All active-placement partners with portal access requirements are mapped','Portal Mapping'));

    const founderRoles=roleLinks.filter(x=>['founder','head_booker'].includes(String(x.roles?.key||'')));
    checks.push(item('founder-control','Founder / Head Booker control',founderRoles.length?'pass':'warn',founderRoles.length?`${founderRoles.length} founder/head-booker role assignment(s)`:'Founder/head-booker role was not resolved by this diagnostic query','Access'));

    const sourceErrors=checks.filter(x=>x.source_error).length;
    const summary={pass:checks.filter(x=>x.status==='pass').length,warn:checks.filter(x=>x.status==='warn').length,fail:checks.filter(x=>x.status==='fail').length};
    const gate=summary.fail?'blocked':summary.warn?'conditional':'ready';
    return json(200,{environment:'veux-v13.24-resilient-beta-gate',generated_at:new Date().toISOString(),organization:{id:organization.id,name:organization.name,slug:organization.slug},gate,summary,source_errors:sourceErrors,inventory:{staff:staff.length,model_accounts:modelLinks.length,partner_accounts:partnerLinks.length,models:models.length,partner_agencies:partners.length,placements:placements.length},checks});
  }catch(error){
    // Return a diagnostic payload instead of a generic 500 so the UI remains useful.
    return json(error?.statusCode||200,{environment:'veux-v13.24-resilient-beta-gate',gate:'blocked',summary:{pass:0,warn:0,fail:1},checks:[item('beta-gate-runtime','Beta Gate runtime','fail',String(error?.message||error||'Unknown certification error'),'Diagnostics')],diagnostic_error:String(error?.message||error||'Unknown error')});
  }
};
