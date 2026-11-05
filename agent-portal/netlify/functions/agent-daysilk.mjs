/* DaySilk (the agents' daily plan) needs to know which agent looks after which model, so a model's travel, visa and
   housing land on the right agent's day. Light read: models with their market and their assigned agents. */
import { requireUser, parseBody, json, errorResponse, adminClient } from './_lib/auth.mjs';
import { requireStaffOrganization, requirePermission } from './_lib/agent-bridge.mjs';

async function rows(q) { const { data, error } = await q; if (error) throw error; return data || []; }
const first = n => String(n || '').trim().split(/\s+/)[0] || '';

const clip = (v, n) => String(v == null ? '' : v).slice(0, n);
const size = o => { try { return JSON.stringify(o).length; } catch (_e) { return Infinity; } };

export const handler = async event => {
  if (!['GET', 'POST'].includes(event.httpMethod)) return json(405, { error: 'Method not allowed' });
  try {
    const { user, client } = await requireUser(event);
    const q = event.queryStringParameters || {};
    const body = event.httpMethod === 'POST' ? parseBody(event) : {};
    const { organization } = await requireStaffOrganization({ user, client, organizationSlug: body.organization_slug || q.organization || 'maison-de-veux' });

    /* each person's own DaySilk: answers, plan and daily check-ins, kept on their own member record */
    if (event.httpMethod === 'POST') {
      const admin = adminClient();
      const { data: mine, error } = await admin.from('organization_members').select('id,metadata').eq('organization_id', organization.id).eq('user_id', user.id).eq('member_type', 'staff').maybeSingle();
      if (error) throw error;
      if (!mine) return json(403, { error: 'No staff record for this account' });
      const meta = mine.metadata && typeof mine.metadata === 'object' ? mine.metadata : {};
      const ds = meta.daysilk && typeof meta.daysilk === 'object' ? meta.daysilk : {};
      const action = String(body.action || '');
      let next = null;
      if (action === 'save_profile') {
        const answers = body.answers && typeof body.answers === 'object' ? body.answers : null, plan = body.plan && typeof body.plan === 'object' ? body.plan : null;
        if (!answers || !plan) return json(400, { error: 'answers and plan are required' });
        if (size(answers) + size(plan) > 60000) return json(413, { error: 'That is too much to save. Shorten some answers.' });
        next = { ...ds, answers, plan, onboarded_at: ds.onboarded_at || new Date().toISOString(), updated_at: new Date().toISOString(), days: ds.days || {} };
      } else if (action === 'save_day') {
        const date = String(body.date || '');
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return json(400, { error: 'A valid date is required' });
        const day = body.day && typeof body.day === 'object' ? body.day : {};
        const days = { ...(ds.days || {}), [date]: { done: Array.isArray(day.done) ? day.done.slice(0, 40).map(x => clip(x, 40)) : [], review: day.review && typeof day.review === 'object' ? { win: clip(day.review.win, 300), hard: clip(day.review.hard, 300) } : null } };
        const keys = Object.keys(days).sort(); while (keys.length > 45) delete days[keys.shift()];
        next = { ...ds, days };
      } else return json(400, { error: 'Unsupported action' });
      const { error: ue } = await admin.from('organization_members').update({ metadata: { ...meta, daysilk: next } }).eq('id', mine.id);
      if (ue) throw ue;
      return json(200, { ok: true, daysilk: next });
    }

    if (q.me === '1') {
      const own = adminClient();
      const { data: row, error: re } = await own.from('organization_members').select('id,metadata').eq('organization_id', organization.id).eq('user_id', user.id).eq('member_type', 'staff').maybeSingle();
      if (re) throw re;
      return json(200, { ok: true, me: row ? { member_id: row.id, daysilk: (row.metadata && row.metadata.daysilk) || null } : null });
    }
    const admin = await requirePermission(user.id, organization.id, 'models.read');
    const [models, assigns, members, blocks] = await Promise.all([
      rows(admin.from('models').select('id,display_name,status,primary_market_label').eq('organization_id', organization.id).limit(2500)),
      rows(admin.from('model_staff_assignments').select('model_id,member_id,is_primary').eq('organization_id', organization.id)).catch(() => []),
      rows(admin.from('organization_members').select('id,user_id,job_title,status,metadata').eq('organization_id', organization.id).eq('member_type', 'staff')),
      rows(admin.from('availability_blocks').select('model_id,starts_at,ends_at,reason,block_type,status').eq('organization_id', organization.id).neq('status', 'cancelled').gte('ends_at', new Date(Date.now() - 864e5).toISOString()).lte('starts_at', new Date(Date.now() + 45 * 864e5).toISOString()).limit(3000)).catch(() => []),
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
    const mine = members.find(m => m.user_id === user.id);
    return json(200, {
      ok: true,
      me: mine ? { member_id: mine.id, daysilk: (mine.metadata && mine.metadata.daysilk) || null } : null,
      blocks: blocks.map(b => ({ model_id: b.model_id, starts_at: b.starts_at, ends_at: b.ends_at, reason: b.reason || '', status: b.status })),
      models: models.filter(m => m.display_name && !/^(archiv|releas|inactive|former)/i.test(String(m.status || ''))).map(m => ({ id: m.id, name: m.display_name, market: m.primary_market_label || '', agents: byModel.get(String(m.id)) || [] })),
      members: members.filter(m => m.status !== 'disabled' && m.status !== 'removed').map(m => ({ id: m.id, user_id: m.user_id, name: pn.get(String(m.user_id)) || '', title: m.job_title || '' })).filter(m => m.name),
    });
  } catch (error) { return errorResponse(error); }
};
