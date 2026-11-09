import { requireUser, parseBody, json, errorResponse } from './_lib/auth.mjs';
import { requireStaffOrganization, requirePermission } from './_lib/agent-bridge.mjs';
import { planImport, writeSlice } from './_lib/schedule-import.mjs';
import { SCHEDULE_SET } from './_lib/schedule-wk43-data.mjs';

async function rows(q) { const { data, error } = await q; if (error) throw error; return data || []; }

/* Preview shows exactly what would land on which calendars; commit writes it in small slices (the page calls it until done). */
export const handler = async event => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });
  try {
    const { user, client } = await requireUser(event);
    const body = parseBody(event);
    const { organization } = await requireStaffOrganization({ user, client, organizationSlug: body.organization_slug || 'maison-de-veux' });
    const admin = await requirePermission(user.id, organization.id, 'calendar.write');
    const action = String(body.action || 'preview');
    if (!['preview', 'commit'].includes(action)) return json(400, { error: 'Unsupported action' });

    const [models, memberRows, profiles, existing] = await Promise.all([
      rows(admin.from('models').select('id,display_name').eq('organization_id', organization.id).limit(3000)),
      rows(admin.from('organization_members').select('id,user_id').eq('organization_id', organization.id).eq('member_type', 'staff').eq('status', 'active').limit(500)),
      rows(admin.from('profiles').select('user_id,display_name,first_name,last_name').limit(2000)),
      rows(admin.from('events').select('id,updated_at,metadata').eq('organization_id', organization.id).eq('metadata->>import_set', SCHEDULE_SET.id).limit(5000)),
    ]);
    /* what the 90-day gameplan already put on the calendar, so the import does not add a second copy */
    const gpEvents = await rows(admin.from('events').select('id,event_type,starts_at').eq('organization_id', organization.id).eq('metadata->>plan', 'g90').limit(5000)).catch(() => []);
    const gpLinks = gpEvents.length ? await rows(admin.from('event_models').select('event_id,model_id').eq('organization_id', organization.id).in('event_id', gpEvents.map(g => g.id)).limit(20000)).catch(() => []) : [];
    const gpById = new Map(gpEvents.map(g => [g.id, g]));
    const zone = organization.timezone || SCHEDULE_SET.timezone || 'America/New_York';
    const dayOf = iso => new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso));
    const covered = gpLinks.map(l => { const g = gpById.get(l.event_id); return g ? { model_id: l.model_id, event_type: g.event_type, day: dayOf(g.starts_at) } : null; }).filter(Boolean);
    /* events deleted on purpose after an earlier import; the table is optional until its SQL has been run */
    const skipped = (await rows(admin.from('calendar_import_skips').select('import_key').eq('organization_id', organization.id).eq('import_set', SCHEDULE_SET.id).limit(5000)).catch(() => [])).map(x => x.import_key);
    const byUser = new Map(profiles.map(p => [p.user_id, p]));
    const members = memberRows.map(m => { const p = byUser.get(m.user_id) || {}; return { id: m.id, user_id: m.user_id, display_name: p.display_name || [p.first_name, p.last_name].filter(Boolean).join(' '), first_name: p.first_name || '' }; });
    const plan = planImport({ set: SCHEDULE_SET, models, members, existing, userId: user.id, tz: organization.timezone || SCHEDULE_SET.timezone, covered, skipped });

    if (action === 'preview') {
      return json(200, { ok: true, set: { id: SCHEDULE_SET.id, week_start: SCHEDULE_SET.weekStart, events: SCHEDULE_SET.events.length }, summary: plan.summary });
    }
    const limit = Math.min(60, Math.max(1, Number(body.limit) || 30)), exclude = Array.isArray(body.exclude) ? body.exclude.map(String).slice(0, 2000) : [];
    const result = await writeSlice(admin, organization.id, user.id, plan, { limit, exclude });
    return json(result.failed.length ? 207 : 200, { ok: result.failed.length === 0, ...result });
  } catch (error) { return errorResponse(error); }
};
