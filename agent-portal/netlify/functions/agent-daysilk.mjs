/* DaySilk (the agents' daily plan) needs to know which agent looks after which model, so a model's travel, visa and
   housing land on the right agent's day. Light read: models with their market and their assigned agents. */
import { requireUser, json, errorResponse } from './_lib/auth.mjs';
import { requireStaffOrganization, requirePermission } from './_lib/agent-bridge.mjs';

async function rows(q) { const { data, error } = await q; if (error) throw error; return data || []; }
const first = n => String(n || '').trim().split(/\s+/)[0] || '';

export const handler = async event => {
  if (event.httpMethod !== 'GET') return json(405, { error: 'Method not allowed' });
  try {
    const { user, client } = await requireUser(event);
    const q = event.queryStringParameters || {};
    const { organization } = await requireStaffOrganization({ user, client, organizationSlug: q.organization || 'maison-de-veux' });
    const admin = await requirePermission(user.id, organization.id, 'models.read');
    const [models, assigns, members] = await Promise.all([
      rows(admin.from('models').select('id,display_name,status,primary_market_label').eq('organization_id', organization.id).limit(2500)),
      rows(admin.from('model_staff_assignments').select('model_id,member_id,is_primary').eq('organization_id', organization.id)).catch(() => []),
      rows(admin.from('organization_members').select('id,user_id,job_title,status').eq('organization_id', organization.id).eq('member_type', 'staff')),
    ]);
    const uids = members.map(m => m.user_id).filter(Boolean);
    const profiles = uids.length ? await rows(admin.from('profiles').select('user_id,display_name,first_name').in('user_id', uids)).catch(() => []) : [];
    const pn = new Map(profiles.map(p => [String(p.user_id), first(p.first_name || p.display_name)]));
    const mn = new Map(members.map(m => [String(m.id), pn.get(String(m.user_id)) || '']));
    const byModel = new Map();
    for (const a of assigns.slice().sort((x, y) => (y.is_primary ? 1 : 0) - (x.is_primary ? 1 : 0))) {
      const n = mn.get(String(a.member_id)); if (!n) continue;
      const k = String(a.model_id); const l = byModel.get(k) || []; if (!l.includes(n)) l.push(n); byModel.set(k, l);
    }
    return json(200, {
      ok: true,
      models: models.filter(m => m.display_name && !/^(archiv|releas|inactive|former)/i.test(String(m.status || ''))).map(m => ({ id: m.id, name: m.display_name, market: m.primary_market_label || '', agents: byModel.get(String(m.id)) || [] })),
      members: members.filter(m => m.status !== 'disabled' && m.status !== 'removed').map(m => ({ id: m.id, user_id: m.user_id, name: pn.get(String(m.user_id)) || '', title: m.job_title || '' })).filter(m => m.name),
    });
  } catch (error) { return errorResponse(error); }
};
