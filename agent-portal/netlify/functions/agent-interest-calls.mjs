import { requireUser, parseBody, json, errorResponse } from './_lib/auth.mjs';
import { requireStaffOrganization, requirePermission } from './_lib/agent-bridge.mjs';
import { saveEvent, matchMember } from './_lib/schedule-import.mjs';
import { normalizeCall, buildEvent, buildTasks, parseCallsCsv, OUTCOMES, COLUMNS, CSV_TEMPLATE, CHANNELS, MARKETS } from './_lib/interest-call.mjs';

async function rows(q) { const { data, error } = await q; if (error) throw error; return data || []; }

async function createTask(admin, client, orgId, userId, t, memberIds) {
  let data = null, rpcError = null;
  try {
    const r = await client.rpc('create_staff_task', { target_org: orgId, task_title: t.title, task_description: t.description || null, task_priority: t.priority || 'normal', task_due_at: t.due_at || null, task_category: t.category || null, target_model: null, assigned_members: memberIds, task_visibility: 'organization' });
    if (r.error) rpcError = r.error; else data = r.data;
  } catch (e) { rpcError = e; }
  if (rpcError) {
    const base = { organization_id: orgId, title: t.title, description: t.description || null, priority: t.priority || 'normal', due_at: t.due_at || null, category: t.category || null, status: 'open' };
    let ins = await admin.from('tasks').insert({ ...base, created_by: userId, visibility: 'organization' }).select('*').single();
    if (ins.error) ins = await admin.from('tasks').insert(base).select('*').single();
    if (ins.error) throw ins.error;
    data = ins.data;
    if (memberIds.length) { try { await admin.from('task_assignments').insert(memberIds.map(member_id => ({ organization_id: orgId, task_id: data.id, member_id, assignment_role: 'assignee', assigned_by: userId }))); } catch (_e) { /* the task exists; assignment can be set in Tasks */ } }
  }
  return data;
}

/* Interest calls: one format in, an agent-calendar event plus the prep and decision tasks out. */
export const handler = async event => {
  if (!['GET', 'POST'].includes(event.httpMethod)) return json(405, { error: 'Method not allowed' });
  try {
    const { user, client } = await requireUser(event);
    const body = event.httpMethod === 'POST' ? parseBody(event) : {}, p = event.queryStringParameters || {};
    const { organization } = await requireStaffOrganization({ user, client, organizationSlug: body.organization_slug || p.organization || 'maison-de-veux' });
    const tz = organization.timezone || 'America/New_York';
    if (event.httpMethod === 'GET') return json(200, { ok: true, columns: COLUMNS, channels: CHANNELS, markets: MARKETS, template: CSV_TEMPLATE, outcomes: OUTCOMES });

    const admin = await requirePermission(user.id, organization.id, 'calendar.write');
    const action = String(body.action || 'schedule');

    if (action === 'set_outcome') {
      const outcome = String(body.outcome || ''); if (!OUTCOMES[outcome]) return json(400, { error: 'Unknown outcome' });
      const cur = (await rows(admin.from('events').select('id,status,metadata').eq('organization_id', organization.id).eq('id', body.event_id).limit(1)))[0];
      if (!cur || cur.metadata?.category !== 'interest_call') return json(404, { error: 'Interest call not found' });
      const ic = { ...(cur.metadata.interest_call || {}), outcome, outcome_note: String(body.note || '').slice(0, 500) || null, decided_at: new Date().toISOString(), decided_by: user.id };
      const patch = { metadata: { ...cur.metadata, interest_call: ic }, status: outcome === 'reschedule' ? 'scheduled' : 'completed' };
      const { data, error } = await admin.from('events').update(patch).eq('organization_id', organization.id).eq('id', cur.id).select('id,status,metadata').single();
      if (error) throw error;
      return json(200, { ok: true, verified: true, event: data });
    }
    if (!['schedule', 'check'].includes(action)) return json(400, { error: 'Unsupported action' });

    const input = Array.isArray(body.calls) ? body.calls : parseCallsCsv(body.csv || '');
    if (!input.length) return json(400, { error: 'Add at least one call' });
    if (input.length > 60) return json(400, { error: 'Add up to 60 calls at a time' });

    const [memberRows, profiles] = await Promise.all([
      rows(admin.from('organization_members').select('id,user_id').eq('organization_id', organization.id).eq('member_type', 'staff').eq('status', 'active').limit(500)),
      rows(admin.from('profiles').select('user_id,display_name,first_name,last_name').limit(2000)),
    ]);
    const byUser = new Map(profiles.map(x => [x.user_id, x]));
    const members = memberRows.map(m => { const pr = byUser.get(m.user_id) || {}; return { id: m.id, user_id: m.user_id, display_name: pr.display_name || [pr.first_name, pr.last_name].filter(Boolean).join(' '), first_name: pr.first_name || '' }; });
    const me = members.find(m => m.user_id === user.id) || null;
    const defaultHost = me ? (me.first_name || String(me.display_name || '').split(' ')[0]) : '';

    const norm = input.map(raw => normalizeCall(raw, { defaultHost }));
    const keys = norm.filter(n => !n.errors.length).map(n => n.call.key);
    const existing = keys.length ? await rows(admin.from('events').select('id,metadata').eq('organization_id', organization.id).in('metadata->>interest_key', keys).limit(500)) : [];
    const existingByKey = new Map(existing.map(x => [x.metadata?.interest_key, x]));

    const results = [];
    for (const { call, errors } of norm) {
      const host = call.host ? matchMember(call.host, members) : null;
      const row = { candidate: call.candidate, date: call.date, time: call.time, host: call.host, errors: [...errors], warnings: [] };
      if (call.host && !host) row.warnings.push(`${call.host} is not a team member with a login: the call is added under their name but no tasks are assigned`);
      const dup = existingByKey.get(call.key);
      if (dup) row.warnings.push('Already on the calendar: it will be updated, no new tasks');
      row.status = row.errors.length ? 'error' : dup ? 'update' : 'create';
      if (action === 'schedule' && !row.errors.length) {
        try {
          const saved = await saveEvent(admin, organization.id, user.id, buildEvent(call, { hostMember: host, tz }), [], dup?.id || null);
          row.event_id = saved.id; row.tasks = 0;
          if (!dup) for (const t of buildTasks(call, { tz })) { await createTask(admin, client, organization.id, user.id, t, host ? [host.id] : []); row.tasks++; }
          row.status = dup ? 'updated' : 'created';
        } catch (err) { row.status = 'error'; row.errors.push(String(err?.message || err).slice(0, 200)); }
      }
      results.push(row);
    }
    const count = s => results.filter(r => r.status === s).length;
    return json(results.some(r => r.status === 'error') && action === 'schedule' ? 207 : 200, { ok: true, action, results, summary: { total: results.length, create: count('create'), update: count('update'), created: count('created'), updated: count('updated'), errors: count('error') }, default_host: defaultHost, hosts: members.map(m => m.first_name || String(m.display_name || '').split(' ')[0]).filter(Boolean) });
  } catch (error) { return errorResponse(error); }
};
