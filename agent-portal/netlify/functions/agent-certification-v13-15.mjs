import { requireUser, json, errorResponse, adminClient } from './_lib/auth.mjs';
import { requireStaffOrganization, requirePermission } from './_lib/agent-bridge.mjs';

function item(key,label,status,detail,group='Account Boundaries'){return {key,label,status,detail,group};}
function uniq(xs){return [...new Set((xs||[]).filter(Boolean).map(String))];}

export const handler=async(event)=>{
  if(event.httpMethod!=='GET') return json(405,{error:'Method not allowed'});
  try{
    const {user,client}=await requireUser(event);
    const p=event.queryStringParameters||{};
    const {organization}=await requireStaffOrganization({user,client,organizationSlug:p.organization||'maison-de-veux'});
    const admin=await requirePermission(user.id,organization.id,'org.settings.manage');
    const checks=[];

    // Resolve role records in two steps instead of an embedded roles() relationship.
    // The explicit tenant-integrity FKs can make PostgREST embedding ambiguous in some projects.
    const [membersRes,modelLinksRes,partnerLinksRes,modelsRes,partnersRes,placementsRes]=await Promise.all([
      admin.from('organization_members').select('id,user_id,member_type,status,job_title').eq('organization_id',organization.id),
      admin.from('model_user_links').select('id,user_id,model_id').eq('organization_id',organization.id),
      admin.from('partner_user_links').select('id,user_id,partner_agency_id').eq('organization_id',organization.id),
      admin.from('models').select('id,status,stage').eq('organization_id',organization.id),
      admin.from('partner_agencies').select('id,portal_enabled,partner_type,company_id').eq('organization_id',organization.id),
      admin.from('model_placements').select('model_id,partner_agency_id,status').eq('organization_id',organization.id)
    ]);
    for(const r of [membersRes,modelLinksRes,partnerLinksRes,modelsRes,partnersRes,placementsRes]) if(r.error) throw r.error;
    const memberIds=(membersRes.data||[]).map(x=>x.id);
    const rolesRes=memberIds.length?await admin.from('member_roles').select('member_id,role_id').in('member_id',memberIds):{data:[],error:null};
    if(rolesRes.error)throw rolesRes.error;
    const roleIds=uniq((rolesRes.data||[]).map(x=>x.role_id));
    const roleRowsRes=roleIds.length?await admin.from('roles').select('id,key,name').in('id',roleIds):{data:[],error:null};
    if(roleRowsRes.error)throw roleRowsRes.error;
    const roleMap=new Map((roleRowsRes.data||[]).map(x=>[String(x.id),x]));
    const roleLinks=(rolesRes.data||[]).map(x=>({...x,roles:roleMap.get(String(x.role_id))||null}));
    const members=membersRes.data||[], modelLinks=modelLinksRes.data||[], partnerLinks=partnerLinksRes.data||[], models=modelsRes.data||[], partners=partnersRes.data||[], placements=placementsRes.data||[];

    const staff=members.filter(x=>x.member_type==='staff'&&['active','invited'].includes(x.status));
    const roleMemberIds=new Set(roleLinks.map(x=>String(x.member_id)));
    const missingRoles=staff.filter(x=>!roleMemberIds.has(String(x.id)));
    checks.push(item('staff-roles','Staff role coverage',missingRoles.length?'fail':'pass',missingRoles.length?`${missingRoles.length} active/invited staff member(s) have no role`:`${staff.length} staff member(s) covered`));

    const roleCounts={}; for(const l of roleLinks){const k=l.roles?.key||l.roles?.name||'unknown';roleCounts[k]=(roleCounts[k]||0)+1;}
    checks.push(item('role-distribution','Role distribution','pass',Object.entries(roleCounts).map(([k,v])=>`${k}: ${v}`).join(' · ')||'No role links','Account Boundaries'));

    const modelIds=new Set(models.map(x=>String(x.id))), partnerIds=new Set(partners.map(x=>String(x.id)));
    const orphanModel=modelLinks.filter(x=>!modelIds.has(String(x.model_id)));
    const orphanPartner=partnerLinks.filter(x=>!partnerIds.has(String(x.partner_agency_id)));
    checks.push(item('model-link-integrity','Model portal link integrity',orphanModel.length?'fail':'pass',`${modelLinks.length} account link(s)${orphanModel.length?` · ${orphanModel.length} orphaned`:''}`,'Portal Mapping'));
    checks.push(item('partner-link-integrity','Partner portal link integrity',orphanPartner.length?'fail':'pass',`${partnerLinks.length} account link(s)${orphanPartner.length?` · ${orphanPartner.length} orphaned`:''}`,'Portal Mapping'));

    const staffUsers=new Set(uniq(staff.map(x=>x.user_id))), modelUsers=new Set(uniq(modelLinks.map(x=>x.user_id))), partnerUsers=new Set(uniq(partnerLinks.map(x=>x.user_id)));
    const overlaps=[]; for(const u of staffUsers){if(modelUsers.has(u))overlaps.push(`${u}: staff+model`);if(partnerUsers.has(u))overlaps.push(`${u}: staff+partner`);} for(const u of modelUsers){if(partnerUsers.has(u))overlaps.push(`${u}: model+partner`);}
    checks.push(item('identity-overlap','Cross-portal identity overlap',overlaps.length?'warn':'pass',overlaps.length?overlaps.join(' · '):'No user identity is linked to conflicting portal types','Isolation'));

    const duplicateModelUsers=modelLinks.length-uniq(modelLinks.map(x=>x.user_id)).length;
    const duplicatePartnerUsers=partnerLinks.length-uniq(partnerLinks.map(x=>x.user_id)).length;
    checks.push(item('link-uniqueness','Portal account uniqueness',(duplicateModelUsers||duplicatePartnerUsers)?'warn':'pass',`Model duplicate users: ${duplicateModelUsers} · Partner duplicate users: ${duplicatePartnerUsers}`,'Isolation'));

    const enabledPartners=partners.filter(x=>x.portal_enabled!==false);
    const linkedPartnerIds=new Set(partnerLinks.map(x=>String(x.partner_agency_id)));
    const enabledWithoutUser=enabledPartners.filter(x=>!linkedPartnerIds.has(String(x.id)));
    checks.push(item('partner-access-ready','Enabled partner portal accounts',enabledWithoutUser.length?'warn':'pass',enabledWithoutUser.length?`${enabledWithoutUser.length} enabled partner agency record(s) have no portal user`:`${enabledPartners.length} enabled partner agency record(s) mapped`,'Portal Mapping'));

    const placementPartners=new Set(placements.filter(x=>!['ended','cancelled','inactive'].includes(String(x.status||'').toLowerCase())).map(x=>String(x.partner_agency_id)));
    const placementWithoutPortal=[...placementPartners].filter(id=>!linkedPartnerIds.has(id));
    checks.push(item('placement-partner-access','Active placement partner access',placementWithoutPortal.length?'warn':'pass',placementWithoutPortal.length?`${placementWithoutPortal.length} partner(s) with active placements have no linked portal user`:'All active-placement partners with portal access requirements are mapped','Portal Mapping'));

    const founderRoles=roleLinks.filter(x=>['founder','head_booker'].includes(String(x.roles?.key||'')));
    checks.push(item('founder-control','Founder / Head Booker control',founderRoles.length?'pass':'fail',founderRoles.length?`${founderRoles.length} founder/head-booker role assignment(s)`:'No founder/head-booker role assignment found','Access'));

    const summary={pass:checks.filter(x=>x.status==='pass').length,warn:checks.filter(x=>x.status==='warn').length,fail:checks.filter(x=>x.status==='fail').length};
    const gate=summary.fail?'blocked':summary.warn?'conditional':'ready';
    return json(200,{environment:'veux-v13.15-account-boundary-certification',generated_at:new Date().toISOString(),organization:{id:organization.id,name:organization.name,slug:organization.slug},gate,summary,inventory:{staff:staff.length,model_accounts:modelLinks.length,partner_accounts:partnerLinks.length,models:models.length,partner_agencies:partners.length,placements:placements.length},checks});
  }catch(error){return errorResponse(error);}
};
