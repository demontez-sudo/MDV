import { adminClient } from './_lib/auth.mjs';
import { notify } from './_lib/push.mjs';
import * as copy from './_lib/push-copy.mjs';

/* Every 15 minutes: deadline reminders for the 90-day gameplan (tasks whose metadata.plan is 'g90').
   - 24 hours before a deadline: the owner is told (staff owner, or the model for a model task).
   - 2 hours before a HARD STOP: the owner is told again.
   - 1 hour after a missed deadline: the owner is told it is overdue; a missed HARD STOP also goes to the owner of the company.
   - Monday 8:00 AM New York time: each team member and each mother agency gets a week-ahead summary.
   Mother agency people are found through partner_user_links (user_id + partner_agency_id).
   Each step happens once per task (flags are kept in the task's metadata). Nothing here changes a task's status. */

const HOUR = 3600 * 1000;
const PLAN = 'g90';

async function rows(q) { const { data, error } = await q; if (error) throw error; return data || []; }

function etParts(d = new Date()) {
  const f = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', weekday: 'short', hour: 'numeric', minute: 'numeric', hour12: false });
  const o = {}; for (const p of f.formatToParts(d)) o[p.type] = p.value;
  return { weekday: o.weekday, hour: Number(o.hour) % 24, minute: Number(o.minute) };
}
const label = t => t.metadata?.due_label || new Date(t.due_at).toUTCString();
const view = t => ({ title: t.title, label: label(t), hard: !!t.metadata?.is_hard_stop, audience: t.metadata?.audience, owner: t.metadata?.owner_name });
const hasFlag = (t, k) => !!(t.metadata && t.metadata[k]);

async function recipients(admin, tasks) {
  const ids = tasks.map(t => t.id);
  const assigns = ids.length ? await rows(admin.from('task_assignments').select('task_id,member_id,model_id').in('task_id', ids)) : [];
  const memberIds = [...new Set(assigns.map(a => a.member_id).filter(Boolean))];
  const members = memberIds.length ? await rows(admin.from('organization_members').select('id,user_id').in('id', memberIds)) : [];
  const userOfMember = new Map(members.map(m => [m.id, m.user_id]));
  const modelIds = [...new Set(tasks.map(t => t.model_id).filter(Boolean))];
  const links = modelIds.length ? await rows(admin.from('model_user_links').select('model_id,user_id').in('model_id', modelIds)) : [];
  const userOfModel = new Map(links.map(l => [l.model_id, l.user_id]));
  const partnerIds = [...new Set(tasks.map(t => t.partner_agency_id).filter(Boolean))];
  const plinks = partnerIds.length ? await rows(admin.from('partner_user_links').select('partner_agency_id,user_id').in('partner_agency_id', partnerIds)) : [];
  const out = new Map();
  for (const t of tasks) {
    const set = new Set();
    if (t.partner_agency_id) for (const l of plinks) if (l.partner_agency_id === t.partner_agency_id && l.user_id) set.add(l.user_id);
    for (const a of assigns.filter(x => x.task_id === t.id)) {
      if (a.member_id && userOfMember.get(a.member_id)) set.add(userOfMember.get(a.member_id));
      if (a.model_id && userOfModel.get(a.model_id)) set.add(userOfModel.get(a.model_id));
    }
    if (!set.size && t.model_id && userOfModel.get(t.model_id)) set.add(userOfModel.get(t.model_id));
    out.set(t.id, [...set]);
  }
  return out;
}

async function ownerUserId(admin, orgId) {
  const members = await rows(admin.from('organization_members').select('user_id').eq('organization_id', orgId).eq('member_type', 'staff').eq('status', 'active'));
  const ids = members.map(m => m.user_id).filter(Boolean);
  if (!ids.length) return null;
  const profiles = await rows(admin.from('profiles').select('user_id,display_name').in('user_id', ids));
  const boss = profiles.find(p => /^demontez\b/i.test(String(p.display_name || '')));
  return boss ? boss.user_id : null;
}

async function tell(admin, orgId, userIds, c, tag, type = 'gameplan_deadline', url = '?page=tasks') {
  const { title, body } = c;
  const ids = [...new Set((userIds || []).filter(Boolean))];
  if (!ids.length) return 0;
  try {
    await admin.from('notifications').insert(ids.map(user_id => ({ organization_id: orgId, user_id, notification_type: type, title: title.slice(0, 120), body: body.slice(0, 300), channel: 'in_app', status: 'delivered' })));
  } catch (e) { console.warn('[gameplan] notification rows failed', e?.message || e); }
  await notify(admin, { orgId, userIds: ids, title, body, url, category: 'tasks', tag, level: c.level, icon: c.icon });
  return ids.length;
}

async function flag(admin, t, key) {
  await admin.from('tasks').update({ metadata: { ...(t.metadata || {}), [key]: new Date().toISOString() } }).eq('id', t.id);
  t.metadata = { ...(t.metadata || {}), [key]: true };
}

export default async () => {
  try {
    const admin = adminClient();
    const now = Date.now();
    const from = new Date(now - 48 * HOUR).toISOString(), to = new Date(now + 25 * HOUR).toISOString();
    const tasks = await rows(admin.from('tasks').select('id,organization_id,model_id,partner_agency_id,title,due_at,status,priority,metadata')
      .eq('metadata->>plan', PLAN).not('status', 'in', '(completed,cancelled,done)').gte('due_at', from).lte('due_at', to).limit(1500));
    const who = await recipients(admin, tasks);
    const bossCache = new Map();
    let sent = 0;
    for (const t of tasks) {
      const diff = new Date(t.due_at).getTime() - now;
      const hard = !!t.metadata?.is_hard_stop;
      const to = who.get(t.id) || [];
      if (diff > 0 && diff <= 24 * HOUR && !hasFlag(t, 'r24')) {
        sent += await tell(admin, t.organization_id, to, copy.dueSoon(view(t), diff / HOUR), `g90-${t.id}-24`);
        await flag(admin, t, 'r24');
      }
      if (hard && diff > 0 && diff <= 2 * HOUR && !hasFlag(t, 'r2')) {
        sent += await tell(admin, t.organization_id, to, copy.hardStop(view(t), diff / 60000), `g90-${t.id}-2`);
        await flag(admin, t, 'r2');
      }
      if (diff < -HOUR && diff > -48 * HOUR && !hasFlag(t, 'late')) {
        sent += await tell(admin, t.organization_id, to, copy.overdue(view(t)), `g90-${t.id}-late`);
        await flag(admin, t, 'late');
        if (hard && !hasFlag(t, 'esc')) {
          if (!bossCache.has(t.organization_id)) bossCache.set(t.organization_id, await ownerUserId(admin, t.organization_id));
          const boss = bossCache.get(t.organization_id);
          if (boss) sent += await tell(admin, t.organization_id, [boss], copy.missedForBoss(view(t)), `g90-${t.id}-esc`);
          await flag(admin, t, 'esc');
        }
      }
    }

    // Monday 8:00 AM ET: week-ahead summary for each team member
    const et = etParts();
    let digests = 0;
    if (et.weekday === 'Mon' && et.hour === 8 && et.minute < 15) {
      const weekEnd = new Date(now + 7 * 24 * HOUR).toISOString();
      const upcoming = await rows(admin.from('tasks').select('id,organization_id,partner_agency_id,model_id,title,due_at,metadata').eq('metadata->>plan', PLAN)
        .not('status', 'in', '(completed,cancelled,done)').gte('due_at', new Date(now).toISOString()).lte('due_at', weekEnd).limit(2000));
      const staff = upcoming.filter(t => t.metadata?.audience === 'staff' || t.metadata?.audience === 'partner');
      const wr = await recipients(admin, staff);
      const per = new Map();
      for (const t of staff.slice().sort((a, b) => String(a.due_at).localeCompare(String(b.due_at)))) for (const u of wr.get(t.id) || []) { const o = per.get(u) || { n: 0, hard: 0, org: t.organization_id, first: view(t) }; o.n++; if (t.metadata?.is_hard_stop) o.hard++; per.set(u, o); }
      const stamp = new Date(now).toISOString().slice(0, 10);
      for (const [u, o] of per) {
        const dup = await rows(admin.from('notifications').select('id').eq('user_id', u).eq('notification_type', 'gameplan_week_ahead').gte('created_at', new Date(now - 6 * HOUR).toISOString()).limit(1));
        if (dup.length) continue;
        digests += await tell(admin, o.org, [u], copy.weekAhead({ count: o.n, hard: o.hard, first: o.first }), `g90-week-${stamp}-${u}`, 'gameplan_week_ahead');
      }
    }
    return Response.json({ ok: true, checked: tasks.length, alerts: sent, digests });
  } catch (e) { console.error('[gameplan reminders]', e); return Response.json({ ok: false }, { status: 500 }); }
};
export const config = { schedule: '*/15 * * * *' };
