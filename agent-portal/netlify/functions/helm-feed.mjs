/* Read-only feed for DaySilk (the personal app, "The Rebuild"). DaySilk's own server holds the shared key and calls this,
   so the browser never sees it. It returns one person's open tasks, what is coming up on the portal and model travel.
   Guarded by HELM_FEED_TOKEN (set the same value on this site and on DaySilk). Nothing here writes to the portal.
   ?email=… picks whose tasks to show; without it, HELM_FEED_EMAIL (default demontez@maisondeveux.com). */
import crypto from 'node:crypto';
import { adminClient, json } from './_lib/auth.mjs';

const SLUG = 'maison-de-veux';
const env = k => String(process.env[k] || '').trim();
const first = n => String(n || '').trim().split(/\s+/)[0].toLowerCase();
async function rows(q) { const { data, error } = await q; if (error) throw error; return data || []; }
const same = (a, b) => { const x = Buffer.from(a), y = Buffer.from(b); return x.length === y.length && crypto.timingSafeEqual(x, y); };

async function authUserByEmail(admin, email) {
  const target = String(email || '').trim().toLowerCase();
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 100 });
    if (error) throw error;
    const users = data?.users || [];
    const hit = users.find(u => String(u.email || '').trim().toLowerCase() === target);
    if (hit) return hit;
    if (users.length < 100) break;
  }
  return null;
}

export const handler = async event => {
  const reply = (statusCode, body) => json(statusCode, body);
  if (event.httpMethod !== 'GET') return reply(405, { error: 'Method not allowed' });
  const token = env('HELM_FEED_TOKEN');
  if (!token) return reply(503, { error: 'not_configured' });
  const given = String(event.headers?.authorization || event.headers?.Authorization || '').replace(/^Bearer\s+/i, '');
  if (!given || !same(given, token)) return reply(401, { error: 'unauthorized' });
  try {
    const admin = adminClient();
    const { data: org } = await admin.from('organizations').select('id,name').eq('slug', SLUG).maybeSingle();
    if (!org) return reply(404, { error: 'organization_not_found' });
    const email = String((event.queryStringParameters || {}).email || env('HELM_FEED_EMAIL') || 'demontez@maisondeveux.com').trim().toLowerCase();

    const user = await authUserByEmail(admin, email);
    let member = null, myFirst = '';
    if (user) {
      member = (await rows(admin.from('organization_members').select('id,user_id').eq('organization_id', org.id).eq('user_id', user.id).eq('member_type', 'staff').limit(1)))[0] || null;
      const prof = (await rows(admin.from('profiles').select('first_name,display_name').eq('user_id', user.id).limit(1)).catch(() => []))[0];
      myFirst = first((prof && (prof.first_name || prof.display_name)) || '');
    }

    const now = new Date(), from = new Date(now.getTime() - 864e5), to = new Date(now.getTime() + 45 * 864e5);
    const [allTasks, assigns, models, companiesCount, events, bookings, castings, travel] = await Promise.all([
      rows(admin.from('tasks').select('id,title,status,due_at,priority,model_id,parent_task_id').eq('organization_id', org.id).order('due_at', { ascending: true, nullsFirst: false }).limit(4000)),
      member ? rows(admin.from('task_assignments').select('task_id').eq('organization_id', org.id).eq('member_id', member.id)) : Promise.resolve([]),
      rows(admin.from('models').select('id,display_name,status').eq('organization_id', org.id).limit(3000)),
      admin.from('companies').select('id', { count: 'exact', head: true }).eq('organization_id', org.id).then(r => r.count || 0).catch(() => 0),
      rows(admin.from('events').select('id,title,starts_at,ends_at,location,status,metadata,event_type,owner_member_id').eq('organization_id', org.id).gte('starts_at', from.toISOString()).lte('starts_at', to.toISOString()).order('starts_at').limit(600)).catch(() => []),
      rows(admin.from('bookings').select('id,title,starts_at,ends_at,location,status').eq('organization_id', org.id).gte('starts_at', from.toISOString()).lte('starts_at', to.toISOString()).order('starts_at').limit(400)).catch(() => []),
      rows(admin.from('castings').select('id,title,starts_at,ends_at,location,status').eq('organization_id', org.id).gte('starts_at', from.toISOString()).lte('starts_at', to.toISOString()).order('starts_at').limit(400)).catch(() => []),
      rows(admin.from('travel_records').select('id,model_id,origin,destination,purpose,status,starts_at,ends_at').eq('organization_id', org.id).gte('starts_at', from.toISOString()).lte('starts_at', to.toISOString()).order('starts_at').limit(300)).catch(() => []),
    ]);

    const name = new Map(models.map(m => [String(m.id), m.display_name]));
    const mine = new Set(assigns.map(a => String(a.task_id)));
    const todayKey = now.toISOString().slice(0, 10);
    const open = allTasks.filter(t => !t.parent_task_id && !/^(completed|done|complete|cancelled|canceled)$/i.test(String(t.status || 'open')) && mine.has(String(t.id)));
    const due = t => (t.due_at ? String(t.due_at).slice(0, 10) : null);
    /* An event is mine if I own it (the Calendar's "owner" field) or I am named on its team. Events made in the Calendar
       set the owner but not the team list, so matching only on the list left them off DaySilk. */
    const mineEvent = e => !member ? false : (String(e.owner_member_id || '') === String(member.id) || (Array.isArray(e.metadata?.team) && e.metadata.team.some(n => first(n) === myFirst)));

    const schedule = []
      .concat(events.filter(mineEvent).map(e => ({ kind: 'event', id: e.id, title: e.title, starts_at: e.starts_at, ends_at: e.ends_at, where: e.location || '', status: e.status || '' })))
      .concat(bookings.map(e => ({ kind: 'booking', id: e.id, title: e.title || 'Booking', starts_at: e.starts_at, ends_at: e.ends_at, where: e.location || '', status: e.status || '' })))
      .concat(castings.map(e => ({ kind: 'casting', id: e.id, title: e.title || 'Casting', starts_at: e.starts_at, ends_at: e.ends_at, where: e.location || '', status: e.status || '' })))
      .filter(x => x.starts_at).sort((a, b) => String(a.starts_at).localeCompare(String(b.starts_at))).slice(0, 200);

    return reply(200, {
      source: 'maison-de-veux',
      organization: { name: org.name },
      for: email,
      linked: !!member,
      generated_at: now.toISOString(),
      counts: {
        open_tasks: open.length,
        overdue_tasks: open.filter(t => due(t) && due(t) < todayKey).length,
        active_models: models.filter(m => !/^(archiv|releas|inactive|former)/i.test(String(m.status || ''))).length,
        companies: companiesCount,
      },
      tasks: open.slice(0, 200).map(t => ({ id: t.id, title: t.title || 'Untitled', due: due(t), priority: t.priority || 'normal', model: t.model_id ? (name.get(String(t.model_id)) || null) : null })),
      schedule,
      travel: travel.filter(t => !/^(cancelled|completed)$/i.test(String(t.status || ''))).map(t => ({ id: t.id, model: name.get(String(t.model_id)) || 'Model', from: t.origin || '', to: t.destination || '', starts_at: t.starts_at, ends_at: t.ends_at, purpose: t.purpose || '', status: t.status || '' })),
    });
  } catch (error) {
    console.error('[helm-feed]', String(error?.message || error));
    return reply(500, { error: 'feed_failed' });
  }
};
