import { requireUser, adminClient, json, errorResponse } from './_lib/auth.mjs';
import { requireStaffOrganization } from './_lib/agent-bridge.mjs';
import { createVeuxData } from '../../shared/veux-data.js';

function permissionsFromRoleLinks(roleLinks = []) {
  const out = new Set();
  for (const link of roleLinks) {
    const role = link.roles;
    for (const p of role?.role_permissions || []) out.add(p.permission_key);
  }
  return [...out];
}

export const handler = async (event) => {
  if (event.httpMethod !== 'GET') return json(405,{error:'Method not allowed'});
  try {
    const { user, client } = await requireUser(event);
    const slug = event.queryStringParameters?.organization || 'maison-de-veux';
    const { organization, member } = await requireStaffOrganization({ user, client, organizationSlug: slug });
    const admin = adminClient();

    const { data: meProfile, error: meProfileError } = await client.from('profiles').select('*').eq('user_id', user.id).maybeSingle();
    if (meProfileError) throw meProfileError;

    const { data: myRoleLinks, error: myRoleError } = await client
      .from('member_roles').select('member_id,roles(id,key,name,role_permissions(permission_key))').eq('member_id', member.id);
    if (myRoleError) throw myRoleError;

    const { data: staffMembers, error: staffError } = await admin.from('organization_members')
      .select('id,user_id,job_title,status,metadata').eq('organization_id', organization.id).eq('member_type','staff').in('status',['active','invited']);
    if (staffError) throw staffError;
    const userIds = (staffMembers || []).map(x => x.user_id);
    let profiles = [], roleLinks = [];
    if (userIds.length) {
      const p = await admin.from('profiles').select('user_id,display_name,first_name,last_name,avatar_url,status').in('user_id', userIds);
      if (p.error) throw p.error; profiles = p.data || [];
      const memberIds = (staffMembers || []).map(x => x.id);
      const r = await admin.from('member_roles').select('member_id,roles(id,key,name)').in('member_id', memberIds);
      if (r.error) throw r.error; roleLinks = r.data || [];
    }
    const profileByUser = new Map(profiles.map(x => [x.user_id,x]));
    const rolesByMember = new Map();
    for (const link of roleLinks) {
      if (!rolesByMember.has(link.member_id)) rolesByMember.set(link.member_id, []);
      if (link.roles) rolesByMember.get(link.member_id).push(link.roles);
    }
    const team = (staffMembers || []).map(m => ({
      member_id:m.id,user_id:m.user_id,job_title:m.job_title,status:m.status,metadata:m.metadata || {},
      profile:profileByUser.get(m.user_id) || null,roles:rolesByMember.get(m.id) || []
    }));

    const data = createVeuxData(client, organization.id);
    const safe = async (fn) => { try { return await fn(); } catch (e) { return { __error: e.message }; } };
    const section = String(event.queryStringParameters?.section || 'core').toLowerCase();

    // Keep the default bootstrap intentionally small. Netlify/Lambda rejects responses
    // above ~6 MB, and the migrated calendar + task history can exceed that when
    // returned together. Heavy datasets are loaded by the browser in separate calls.
    if (section === 'roster') {
      const roster = await safe(() => data.roster({active:null}));
      let privateProfiles = [];
      if (permissionsFromRoleLinks(myRoleLinks).includes('models.private.read')) {
        const privateRes = await client.from('model_private_profiles').select('*').eq('organization_id', organization.id);
        if (!privateRes.error) privateProfiles = privateRes.data || [];
      }
      return json(200,{environment:'veux-saas-v4',organization,roster,private_profiles:privateProfiles});
    }

    if (section === 'crm') {
      const [companies, contacts] = await Promise.all([safe(() => data.companies()), safe(() => data.contacts())]);
      let companyLinks = [];
      if (!(contacts && contacts.__error)) {
        const linkRes = await client.from('contact_company_links').select('contact_id,company_id,is_primary').eq('organization_id',organization.id);
        if (!linkRes.error) companyLinks = linkRes.data || [];
      }
      return json(200,{environment:'veux-saas-v4',organization,companies,contacts,contact_company_links:companyLinks});
    }

    if (section === 'calendar') {
      const [calendar, bookings, castings] = await Promise.all([
        safe(() => data.calendar()), safe(() => data.bookings()), safe(() => data.castings())
      ]);
      return json(200,{environment:'veux-saas-v4',organization,calendar,bookings,castings});
    }

    if (section === 'tasks') {
      const tasks = await safe(() => data.tasks());
      return json(200,{environment:'veux-saas-v4',organization,tasks});
    }

    return json(200,{
      environment:'veux-saas-v4',
      organization,
      current_user:{id:user.id,email:user.email,profile:meProfile,membership:member,roles:(myRoleLinks||[]).map(x=>x.roles).filter(Boolean),permissions:permissionsFromRoleLinks(myRoleLinks)},
      team
    });
  } catch (error) { return errorResponse(error); }
};
