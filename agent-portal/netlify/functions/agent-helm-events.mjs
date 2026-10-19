import crypto from 'node:crypto';
import { requireUser, parseBody, json, errorResponse } from './_lib/auth.mjs';
import { requireStaffOrganization, requirePermission } from './_lib/agent-bridge.mjs';
import { saveEvent, matchMember } from './_lib/schedule-import.mjs';
import { normalizeEvent, buildEvents, TYPES, REPEATS } from './_lib/helm-event.mjs';
import { safeDeleteEvent } from './_lib/calendar-safe-delete.mjs';

async function rows(q) { const { data, error } = await q; if (error) throw error; return data || []; }

/* Events added from the Helm calendar: who it is for, type, time, repeats. Delete is limited to events made in Helm. */
export const handler = async event => {
  if (!['GET', 'POST'].includes(event.httpMethod)) return json(405, { error: 'Method not allowed' });
  try {
    const { user, client } = await requireUser(event);
    const body = event.httpMethod === 'POST' ? parseBody(event) : {}, p = event.queryStringParameters || {};
    const { organization } = await requireStaffOrganization({ user, client, organizationSlug: body.organization_slug || p.organization || 'maison-de-veux' });
    const tz = organization.timezone || 'America/New_York';
    if (event.httpMethod === 'GET') return json(200, { ok: true, types: Object.fromEntries(Object.entries(TYPES).map(([k, v]) => [k, v.label])), repeats: REPEATS });
    const admin = await requirePermission(user.id, organization.id, 'calendar.write');
    const action = String(body.action || 'create');

    if (action === 'delete') {
      const cur = (await rows(admin.from('events').select('id,starts_at,metadata').eq('organization_id', organization.id).eq('id', body.event_id).limit(1)))[0];
      if (!cur) return json(404, { error: 'Event not found' });
      if (cur.metadata?.created_in !== 'helm') return json(403, { error: 'Only events added in Helm can be deleted here. Use the Agency Calendar for others.' });
      let ids = [cur.id];
      if (body.series && cur.metadata?.series) {
        const sib = await rows(admin.from('events').select('id,starts_at,metadata').eq('organization_id', organization.id).eq('metadata->>series', cur.metadata.series).limit(100));
        const from = Date.parse(cur.starts_at || 0);
        ids = sib.filter(x => Date.parse(x.starts_at) >= from).map(x => x.id);
      }
      let n = 0; for (const id of ids) { await safeDeleteEvent(admin, organization.id, id); n++; }
      return json(200, { ok: true, verified: true, deleted: n });
    }
    if (action !== 'create') return json(400, { error: 'Unsupported action' });

    const [memberRows, profiles] = await Promise.all([
      rows(admin.from('organization_members').select('id,user_id').eq('organization_id', organization.id).eq('member_type', 'staff').eq('status', 'active').limit(500)),
      rows(admin.from('profiles').select('user_id,display_name,first_name,last_name').limit(2000)),
    ]);
    const byUser = new Map(profiles.map(x => [x.user_id, x]));
    const members = memberRows.map(m => { const pr = byUser.get(m.user_id) || {}; return { id: m.id, user_id: m.user_id, display_name: pr.display_name || [pr.first_name, pr.last_name].filter(Boolean).join(' '), first_name: pr.first_name || '' }; });
    const me = members.find(m => m.user_id === user.id) || null;
    const { errors, ev } = normalizeEvent(body.event || body, { defaultHost: me ? (me.first_name || String(me.display_name || '').split(' ')[0]) : '' });
    if (errors.length) return json(400, { error: errors.join('. ') });
    const host = matchMember(ev.host, members);
    const seriesId = ev.repeat ? 'hs_' + crypto.randomUUID().slice(0, 8) : null;
    const list = buildEvents(ev, { hostMember: host, userId: user.id, tz, seriesId });
    const saved = [];
    for (const payload of list) { const s = await saveEvent(admin, organization.id, user.id, payload, [], null); saved.push(s.id); }
    return json(200, { ok: true, verified: true, created: saved.length, ids: saved, series: seriesId, warning: host ? null : `${ev.host} has no portal login, so the event is on their name only.` });
  } catch (error) { return errorResponse(error); }
};
