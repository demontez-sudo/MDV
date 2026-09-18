import { requireUser, json, errorResponse, adminClient, assertPermission } from './_lib/auth.mjs';
import { requireStaffOrganization, requirePermission } from './_lib/agent-bridge.mjs';

async function count(admin, table, orgId){
  const { count, error } = await admin.from(table).select('*',{count:'exact',head:true}).eq('organization_id',orgId);
  return error ? { ok:false, error:error.message, count:null } : { ok:true, count:count||0 };
}
function check(key,label,status,detail,group='Core'){ return {key,label,status,detail,group}; }

export const handler = async (event) => {
  if(event.httpMethod !== 'GET') return json(405,{error:'Method not allowed'});
  try{
    const { user, client } = await requireUser(event);
    const p=event.queryStringParameters||{};
    const { organization, membership } = await requireStaffOrganization({user,client,organizationSlug:p.organization||'maison-de-veux'});
    // Prefer Founder/settings permission for the certification lab, but retain org.read as a compatibility fallback.
    let admin;
    try{admin=await requirePermission(user.id,organization.id,'org.settings.manage');}
    catch(primaryPermissionError){admin=await requirePermission(user.id,organization.id,'org.read');}
    const canManage=await assertPermission(admin,user.id,organization.id,'org.settings.manage');
    const checks=[];

    const {data:memberRoleRows,error:memberRoleErr}=await admin.from('member_roles').select('role_id').eq('member_id',membership.id);
    let roleLabels=[]; let roleErr=memberRoleErr;
    if(!roleErr && (memberRoleRows||[]).length){
      const ids=(memberRoleRows||[]).map(r=>r.role_id);
      const rr=await admin.from('roles').select('id,name,key').in('id',ids);
      roleErr=rr.error; roleLabels=(rr.data||[]).map(r=>r.name||r.key||r.id);
    }
    checks.push(check('session','Authenticated staff session',membership?.status==='active'?'pass':'fail',membership?.status==='active'?'Active membership':'Membership is not active','Access'));
    checks.push(check('roles','Role assignment',!roleErr && roleLabels.length?'pass':'fail',roleErr?roleErr.message:(roleLabels.join(', ')||'No roles'),'Access'));


    const perms=['models.read','bookings.read','calendar.read','tasks.read','packages.read','crm.read'];
    for(const perm of perms){
      const ok=await assertPermission(admin,user.id,organization.id,perm);
      checks.push(check('perm-'+perm,perm,ok?'pass':'warn',ok?'Granted':'Not granted','Permissions'));
    }

    const tables=['models','bookings','castings','tasks','companies','contacts','documents','notifications'];
    const counts={};
    for(const t of tables){ counts[t]=await count(admin,t,organization.id); checks.push(check('table-'+t,t,counts[t].ok?'pass':'fail',counts[t].ok?`${counts[t].count} rows`:counts[t].error,'Data')); }

    const {data:settings,error:settingsErr}=await admin.from('organization_settings').select('sender_name,sender_email,reply_to_email,package_domain,public_profile_domain').eq('organization_id',organization.id).maybeSingle();
    checks.push(check('org-settings','Agency identity settings',!settingsErr&&settings?'pass':'warn',settingsErr?settingsErr.message:(settings?`${settings.sender_name||organization.name} · ${settings.sender_email||'sender email missing'}`:'Not configured'),'Configuration'));
    checks.push(check('sender-email','Sender email',settings?.sender_email?'pass':'warn',settings?.sender_email||'Missing sender email','Configuration'));
    checks.push(check('package-domain','Package domain',settings?.package_domain?'pass':'warn',settings?.package_domain||'Using default portal domain','Configuration'));

    const {data:connections,error:connErr}=await admin.from('integration_connections').select('provider,status,last_success_at,last_error').eq('organization_id',organization.id);
    if(connErr) checks.push(check('integrations','Integration connections','warn',connErr.message,'Integrations'));
    else {
      const list=connections||[];
      checks.push(check('integrations','Integration connections',list.some(x=>x.status==='connected')?'pass':'warn',list.length?list.map(x=>`${x.provider}: ${x.status}`).join(' · '):'No connections recorded','Integrations'));
    }

    try{
      const {data:buckets,error:bErr}=await admin.storage.listBuckets();
      if(bErr) throw bErr;
      const desired=process.env.VEUX_PRIVATE_STORAGE_BUCKET||'veux-private';
      const found=(buckets||[]).some(b=>b.name===desired||b.id===desired);
      checks.push(check('private-storage','Private document storage',found?'pass':'warn',found?`${desired} bucket available`:`${desired} bucket not found`,'Storage'));
    }catch(e){ checks.push(check('private-storage','Private document storage','warn',e.message,'Storage')); }

    const {data:modelLinks,error:mlErr}=await admin.from('model_user_links').select('user_id,model_id').eq('organization_id',organization.id);
    if(!mlErr){
      const users=new Set(),models=new Set(); let duplicates=0;
      for(const r of modelLinks||[]){ const uk=String(r.user_id),mk=String(r.model_id); if(users.has(uk)||models.has(mk))duplicates++; users.add(uk);models.add(mk); }
      checks.push(check('model-links','Model account links',duplicates?'warn':'pass',`${(modelLinks||[]).length} links${duplicates?` · ${duplicates} possible duplicate mappings`:''}`,'Portal Scope'));
    }
    const {data:partnerLinks,error:plErr}=await admin.from('partner_user_links').select('user_id,partner_agency_id').eq('organization_id',organization.id);
    if(!plErr) checks.push(check('partner-links','Partner account links','pass',`${(partnerLinks||[]).length} links`,'Portal Scope'));

    const summary={pass:checks.filter(x=>x.status==='pass').length,warn:checks.filter(x=>x.status==='warn').length,fail:checks.filter(x=>x.status==='fail').length};
    return json(200,{environment:'veux-v13.11-live-certification',generated_at:new Date().toISOString(),organization:{id:organization.id,name:organization.name,slug:organization.slug},user:{id:user.id,email:user.email},can_manage:canManage,summary,counts,checks});
  }catch(error){return errorResponse(error);}
};
