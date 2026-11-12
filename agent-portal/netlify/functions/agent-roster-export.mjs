import { requireUser, json, errorResponse } from './_lib/auth.mjs';
import { requireStaffOrganization, requirePermission } from './_lib/agent-bridge.mjs';

// Roster export: every model and every staff member in one CSV (or JSON with ?format=json).
// Models: name, stage, status, active, market, and whether they can sign in to the model portal.
// Team: name, email, job title, status.

const rows = async q => { const { data, error } = await q; if (error) throw error; return data || []; };
const optional = async q => { const { data, error } = await q; return error ? [] : (data || []); };
const cell = v => { const s = v == null ? '' : String(v); return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
const csv = (head, list) => [head.join(','), ...list.map(r => head.map(h => cell(r[h])).join(','))].join('\r\n');

export const handler = async event => {
  if (event.httpMethod !== 'GET') return json(405, { error: 'Method not allowed' });
  try {
    const { user, client } = await requireUser(event);
    const p = event.queryStringParameters || {};
    const { organization } = await requireStaffOrganization({ user, client, organizationSlug: p.organization || 'maison-de-veux' });
    const admin = await requirePermission(user.id, organization.id, 'models.read');
    const orgId = organization.id;

    const [models, links, members, profiles] = await Promise.all([
      rows(admin.from('models').select('id,display_name,stage,status,active,primary_market_label').eq('organization_id', orgId).order('display_name').limit(2000)),
      optional(admin.from('model_user_links').select('model_id,user_id').eq('organization_id', orgId)),
      rows(admin.from('organization_members').select('id,user_id,member_type,job_title,status').eq('organization_id', orgId).eq('member_type', 'staff').limit(500)),
      optional(admin.from('profiles').select('user_id,display_name,first_name,last_name').limit(3000))
    ]);

    const linked = new Set(links.map(l => l.model_id));
    const profileBy = new Map(profiles.map(x => [x.user_id, x]));
    const nameOf = id => { const x = profileBy.get(id); return x ? (x.display_name || [x.first_name, x.last_name].filter(Boolean).join(' ')) : ''; };

    const emails = new Map();
    await Promise.all(members.map(async m => {
      try { const { data } = await admin.auth.admin.getUserById(m.user_id); if (data?.user?.email) emails.set(m.user_id, data.user.email); } catch { /* email stays blank */ }
    }));

    const modelRows = models.map(m => ({
      type: 'Model', name: m.display_name || '', email: '', title: m.stage || '', status: m.status || '',
      active: m.active === false ? 'inactive' : 'active', market: m.primary_market_label || '', portal_login: linked.has(m.id) ? 'yes' : 'no'
    }));
    const teamRows = members.map(m => ({
      type: 'Team', name: nameOf(m.user_id) || emails.get(m.user_id) || '', email: emails.get(m.user_id) || '', title: m.job_title || '',
      status: m.status || '', active: m.status === 'active' ? 'active' : 'inactive', market: '', portal_login: 'yes'
    })).sort((a, b) => a.name.localeCompare(b.name));

    if (p.format === 'json') return json(200, { ok: true, models: modelRows, team: teamRows });

    const head = ['type', 'name', 'email', 'title', 'status', 'active', 'market', 'portal_login'];
    return {
      statusCode: 200,
      headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': 'attachment; filename="maison-de-veux-roster.csv"', 'cache-control': 'no-store' },
      body: csv(head, [...modelRows, ...teamRows])
    };
  } catch (error) { return errorResponse(error); }
};

export const __test = { cell, csv };
