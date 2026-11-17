import crypto from 'node:crypto';
import { requireUser, parseBody, json, errorResponse } from './_lib/auth.mjs';
import { requireStaffOrganization, requirePermission } from './_lib/agent-bridge.mjs';
import { safeDeleteEvent } from './_lib/calendar-safe-delete.mjs';
import { findEventDuplicates, findTaskDuplicates, findBlockDuplicates, findLookalikes } from './_lib/calendar-dedupe.mjs';

/* Duplicate calendar clean-up.
     scan   what would be removed, and nothing else (safe to run any time)
     apply  merges what the extra copies carry into the copy that stays, saves a backup, then removes them. Works in batches that fit the
            time limit: keep calling it with the same run_id until it says complete.
     undo   puts a run back from its backup
     runs   recent runs, for the Undo list
   The backup table comes from docs/sql/2026-11-17-calendar-dedupe-backup.sql; without it scan still works but apply refuses. */

const TABLE = 'calendar_dedupe_backup';
const BUDGET_MS = 7000;
const notThere = e => /does not exist|schema cache|could not find (the )?(table|column)|42P01|PGRST20[45]/i.test(String(e?.code || '') + ' ' + String(e?.message || ''));
const fail = (code, message) => { const e = new Error(message); e.statusCode = code; e.publicMessage = message; return e; };

async function pages(build, max = 20000) {
  const out = [];
  for (let from = 0; from < max; from += 1000) {
    const { data, error } = await build().range(from, from + 999);
    if (error) { if (error.code === 'PGRST103' || /416/.test(String(error.status || ''))) break; throw error; }
    const page = data || []; out.push(...page); if (page.length < 1000) break;
  }
  return out;
}
const optionalPages = async build => { try { return await pages(build); } catch (e) { if (notThere(e)) return []; throw e; } };

async function backupReady(admin) {
  const { error } = await admin.from(TABLE).select('id').limit(1);
  return !error;
}

async function load(admin, orgId, { bookings = false } = {}) {
  const [events, links, tasks, blocks, models] = await Promise.all([
    pages(() => admin.from('events').select('*').eq('organization_id', orgId).order('id')),
    optionalPages(() => admin.from('event_models').select('*').eq('organization_id', orgId).order('event_id')),
    optionalPages(() => admin.from('tasks').select('id,title,status,due_at,model_id,parent_task_id,created_at').eq('organization_id', orgId).order('id')),
    optionalPages(() => admin.from('availability_blocks').select('id,model_id,block_type,status,starts_at,ends_at,created_at').eq('organization_id', orgId).order('id')),
    optionalPages(() => admin.from('models').select('id,display_name').eq('organization_id', orgId).order('id'))
  ]);
  const modelNames = new Map(models.map(m => [String(m.id), m.display_name || 'Model']));
  const out = { events, links, tasks, blocks, modelNames, bookings: [], castings: [], bookingLinks: new Map(), castingLinks: new Map() };
  if (bookings) {
    const [b, c, bm, cm] = await Promise.all([
      optionalPages(() => admin.from('bookings').select('id,title,starts_at,created_at').eq('organization_id', orgId).order('id')),
      optionalPages(() => admin.from('castings').select('id,title,starts_at,created_at').eq('organization_id', orgId).order('id')),
      optionalPages(() => admin.from('booking_models').select('*').eq('organization_id', orgId).order('booking_id')),
      optionalPages(() => admin.from('casting_models').select('*').eq('organization_id', orgId).order('casting_id'))
    ]);
    out.bookings = b; out.castings = c;
    for (const x of bm) { const k = String(x.booking_id); if (!out.bookingLinks.has(k)) out.bookingLinks.set(k, new Set()); out.bookingLinks.get(k).add(String(x.model_id)); }
    for (const x of cm) { const k = String(x.casting_id); if (!out.castingLinks.has(k)) out.castingLinks.set(k, new Set()); out.castingLinks.get(k).add(String(x.model_id)); }
  }
  return out;
}

function compute(d) {
  const eventGroups = findEventDuplicates({ events: d.events, links: d.links, modelNames: d.modelNames });
  return { eventGroups, taskGroups: findTaskDuplicates(d.tasks), blockGroups: findBlockDuplicates(d.blocks) };
}
const sum = (groups, key = 'remove') => groups.reduce((n, g) => n + g[key].length, 0);

function describe(d, c) {
  const nameOf = id => d.modelNames.get(String(id)) || 'Model';
  return {
    summary: {
      events_checked: d.events.length,
      exact_groups: c.eventGroups.filter(g => g.tier === 1).length, exact_copies: sum(c.eventGroups.filter(g => g.tier === 1)),
      lookalike_groups: c.eventGroups.filter(g => g.tier === 2).length, lookalike_copies: sum(c.eventGroups.filter(g => g.tier === 2)),
      task_groups: c.taskGroups.length, task_copies: sum(c.taskGroups),
      block_groups: c.blockGroups.length, block_copies: sum(c.blockGroups)
    },
    events: c.eventGroups.slice(0, 300).map(g => ({ tier: g.tier, title: g.title, starts_at: g.starts_at, ends_at: g.ends_at, models: g.models, keep: g.keep, remove: g.remove })),
    tasks: c.taskGroups.slice(0, 100).map(g => ({ title: g.title, due_at: g.due_at, model: g.model_id ? nameOf(g.model_id) : null, keep: g.keep, remove: g.remove })),
    blocks: c.blockGroups.slice(0, 100).map(g => ({ model: nameOf(g.model_id), starts_at: g.starts_at, ends_at: g.ends_at, block_type: g.block_type, keep: g.keep, remove: g.remove }))
  };
}

/* merge one event group into its keeper, save the backup of what is about to go, then remove the copies */
async function applyEventGroup(admin, orgId, userId, runId, g) {
  const keepId = g.keep, removeIds = g.remove;
  const { data: rows, error: er } = await admin.from('events').select('*').eq('organization_id', orgId).in('id', [keepId, ...removeIds]);
  if (er) throw er;
  const keeper = (rows || []).find(r => String(r.id) === String(keepId)), copies = (rows || []).filter(r => removeIds.includes(String(r.id)));
  if (!keeper || !copies.length) return { skipped: true };      /* already gone (a second click, or another run got there first) */
  const { data: keepLinks } = await admin.from('event_models').select('*').eq('organization_id', orgId).eq('event_id', keepId);
  const { data: copyLinks } = await admin.from('event_models').select('*').eq('organization_id', orgId).in('event_id', copies.map(c => c.id));
  const { data: copyMembers, error: em } = await admin.from('event_members').select('*').eq('organization_id', orgId).in('event_id', copies.map(c => c.id));
  const members = em && notThere(em) ? [] : (copyMembers || []);
  /* 1. backup first: if it cannot be written, nothing is touched */
  const backup = copies.map(c => ({ organization_id: orgId, run_id: runId, kind: 'event', row_id: String(c.id), created_by: userId, payload: c,
    children: { event_models: (copyLinks || []).filter(l => String(l.event_id) === String(c.id)), event_members: members.filter(m => String(m.event_id) === String(c.id)) } }));
  const bk = await admin.from(TABLE).insert(backup); if (bk.error) throw bk.error;
  /* 2. the keeper picks up anything the copies had that it lacks */
  const have = new Set((keepLinks || []).map(l => String(l.model_id)));
  const add = []; const seen = new Set();
  for (const l of copyLinks || []) { const m = String(l.model_id); if (have.has(m) || seen.has(m)) continue; seen.add(m); const { id: _id, event_id: _e, ...rest } = l; add.push({ ...rest, organization_id: orgId, event_id: keepId, model_id: l.model_id }); }
  if (add.length) { const r = await admin.from('event_models').insert(add); if (r.error) throw fail(409, 'Could not move the models onto the copy that stays: ' + String(r.error.message || '').slice(0, 120)); }
  if (members.length) {
    const { data: km } = await admin.from('event_members').select('*').eq('organization_id', orgId).eq('event_id', keepId);
    const keyOf = m => String(m.member_id || m.user_id || m.profile_id || '');
    const haveM = new Set((km || []).map(keyOf)), addM = []; const seenM = new Set();
    for (const m of members) { const k = keyOf(m); if (!k || haveM.has(k) || seenM.has(k)) continue; seenM.add(k); const { id: _id, event_id: _e, ...rest } = m; addM.push({ ...rest, organization_id: orgId, event_id: keepId }); }
    if (addM.length) { const r = await admin.from('event_members').insert(addM); if (r.error) console.warn('[dedupe] members not merged', String(r.error.message || '').slice(0, 100)); }
  }
  /* things that pointed at a copy now point at the keeper */
  for (const [table, col] of [['tasks', 'event_id'], ['availability_blocks', 'source_event_id']]) {
    const r = await admin.from(table).update({ [col]: keepId }).eq('organization_id', orgId).in(col, copies.map(c => c.id));
    if (r.error && !notThere(r.error)) throw r.error;
  }
  /* the meeting task and the import key survive on the keeper */
  const km = { ...(keeper.metadata || {}) }; let metaChanged = false;
  for (const c of copies) {
    const cm = c.metadata || {};
    if (!km.task_id && cm.task_id) { km.task_id = cm.task_id; metaChanged = true; }
    else if (cm.task_id && km.task_id && String(cm.task_id) !== String(km.task_id)) {
      /* the copy's meeting task is now a second task for the same meeting: cancel it, and keep its old status so Undo can bring it back */
      const { data: tk } = await admin.from('tasks').select('id,status').eq('organization_id', orgId).eq('id', cm.task_id).maybeSingle();
      if (tk && !/^(cancelled|canceled)$/i.test(String(tk.status || ''))) {
        const b2 = await admin.from(TABLE).insert({ organization_id: orgId, run_id: runId, kind: 'task', row_id: String(tk.id), created_by: userId, payload: tk, children: {} });
        if (!b2.error) await admin.from('tasks').update({ status: 'cancelled' }).eq('organization_id', orgId).eq('id', tk.id);
      }
    }
    if (!km.import_key && cm.import_key) { km.import_key = cm.import_key; km.import_set = cm.import_set; metaChanged = true; }
  }
  if (metaChanged) await admin.from('events').update({ metadata: km }).eq('organization_id', orgId).eq('id', keepId);
  /* 3. remove the copies the same way the portal's own delete does */
  for (const c of copies) await safeDeleteEvent(admin, orgId, c.id);
  return { removed: copies.length, models_added: add.length };
}

async function applyStatusGroups(admin, orgId, userId, runId, kind, table, groups) {
  const ids = groups.flatMap(g => g.remove); if (!ids.length) return 0;
  const { data: rows, error } = await admin.from(table).select('id,status').eq('organization_id', orgId).in('id', ids); if (error) throw error;
  if (!(rows || []).length) return 0;
  const bk = await admin.from(TABLE).insert(rows.map(r => ({ organization_id: orgId, run_id: runId, kind, row_id: String(r.id), created_by: userId, payload: r, children: {} }))); if (bk.error) throw bk.error;
  const up = await admin.from(table).update({ status: 'cancelled' }).eq('organization_id', orgId).in('id', rows.map(r => r.id)); if (up.error) throw up.error;
  return rows.length;
}

async function applyRun(admin, orgId, userId, body) {
  if (!(await backupReady(admin))) throw fail(409, 'The clean-up needs its backup table first. Run docs/sql/2026-11-17-calendar-dedupe-backup.sql in Supabase, then try again.');
  const want = { t1: (body.tiers || [1]).map(Number).includes(1), t2: (body.tiers || [1]).map(Number).includes(2), tasks: body.tasks === true, blocks: body.blocks === true };
  const runId = /^[0-9a-f-]{36}$/i.test(String(body.run_id || '')) ? String(body.run_id) : crypto.randomUUID();
  const t0 = Date.now(), d = await load(admin, orgId), c = compute(d), done = { events: 0, tasks: 0, blocks: 0, models_added: 0, failed: [] };
  const groups = c.eventGroups.filter(g => (g.tier === 1 && want.t1) || (g.tier === 2 && want.t2));
  /* tier 2 only runs on what is still there after tier 1, which findEventDuplicates already guarantees */
  for (const g of groups) {
    if (Date.now() - t0 > BUDGET_MS) break;
    try { const r = await applyEventGroup(admin, orgId, userId, runId, g); if (r.removed) { done.events += r.removed; done.models_added += r.models_added || 0; } }
    catch (e) { done.failed.push({ title: g.title, reason: String(e?.publicMessage || e?.message || e).slice(0, 140) }); }
  }
  if (Date.now() - t0 <= BUDGET_MS && want.tasks) done.tasks = await applyStatusGroups(admin, orgId, userId, runId, 'task', 'tasks', c.taskGroups);
  if (Date.now() - t0 <= BUDGET_MS && want.blocks) done.blocks = await applyStatusGroups(admin, orgId, userId, runId, 'block', 'availability_blocks', c.blockGroups);
  /* what is left to do: a fresh look, so the answer is true even if two people clicked at once */
  const d2 = await load(admin, orgId), c2 = compute(d2);
  const left = {
    events: c2.eventGroups.filter(g => (g.tier === 1 && want.t1) || (g.tier === 2 && want.t2)).reduce((n, g) => n + g.remove.length, 0),
    tasks: want.tasks ? sum(c2.taskGroups) : 0, blocks: want.blocks ? sum(c2.blockGroups) : 0
  };
  const stuck = done.failed.length > 0 && done.events + done.tasks + done.blocks === 0;
  return { ok: true, run_id: runId, done, left, complete: stuck || left.events + left.tasks + left.blocks === 0, stuck };
}

async function undoRun(admin, orgId, body) {
  const runId = String(body.run_id || ''); if (!/^[0-9a-f-]{36}$/i.test(runId)) throw fail(400, 'run_id is required');
  const t0 = Date.now(), restored = { events: 0, tasks: 0, blocks: 0 }, failed = [];
  const { data: rows, error } = await admin.from(TABLE).select('*').eq('organization_id', orgId).eq('run_id', runId).limit(400); if (error) throw error;
  for (const r of rows || []) {
    if (Date.now() - t0 > BUDGET_MS) break;
    try {
      if (r.kind === 'event') {
        const { data: there } = await admin.from('events').select('id').eq('organization_id', orgId).eq('id', r.row_id).maybeSingle();
        if (!there) { const ins = await admin.from('events').insert(r.payload); if (ins.error) throw ins.error; }
        for (const table of ['event_models', 'event_members']) {
          const list = (r.children && r.children[table]) || [];
          for (const row of list) { const x = await admin.from(table).insert(row); if (x.error && !/duplicate|already exists|23505/i.test(String(x.error.message || x.error.code || '')) && !notThere(x.error)) throw x.error; }
        }
        restored.events++;
      } else {
        const table = r.kind === 'task' ? 'tasks' : 'availability_blocks';
        const up = await admin.from(table).update({ status: r.payload.status }).eq('organization_id', orgId).eq('id', r.row_id); if (up.error) throw up.error;
        restored[r.kind === 'task' ? 'tasks' : 'blocks']++;
      }
      await admin.from(TABLE).delete().eq('organization_id', orgId).eq('id', r.id);
    } catch (e) { failed.push({ id: r.row_id, reason: String(e?.message || e).slice(0, 120) }); }
  }
  const { data: more } = await admin.from(TABLE).select('id').eq('organization_id', orgId).eq('run_id', runId).limit(1);
  return { ok: true, run_id: runId, restored, failed, complete: !(more || []).length };
}

async function listRuns(admin, orgId) {
  const { data, error } = await admin.from(TABLE).select('run_id,kind,created_at').eq('organization_id', orgId).order('created_at', { ascending: false }).limit(1500);
  if (error) { if (notThere(error)) return { ok: true, runs: [], backup_ready: false }; throw error; }
  const m = new Map();
  for (const r of data || []) { const x = m.get(r.run_id) || { run_id: r.run_id, at: r.created_at, events: 0, tasks: 0, blocks: 0 }; x[r.kind === 'event' ? 'events' : r.kind === 'task' ? 'tasks' : 'blocks']++; m.set(r.run_id, x); }
  return { ok: true, backup_ready: true, runs: [...m.values()].slice(0, 12) };
}

export const handler = async event => {
  if (!['GET', 'POST'].includes(event.httpMethod)) return json(405, { error: 'Method not allowed' });
  try {
    const { user, client } = await requireUser(event);
    const p = event.queryStringParameters || {}, body = event.httpMethod === 'POST' ? parseBody(event) : {};
    const { organization } = await requireStaffOrganization({ user, client, organizationSlug: body.organization_slug || p.organization || 'maison-de-veux' });
    const action = String(body.action || p.action || 'scan');
    const admin = await requirePermission(user.id, organization.id, action === 'scan' || action === 'runs' ? 'calendar.read' : 'calendar.write');
    if (action === 'scan') {
      const d = await load(admin, organization.id, { bookings: body.bookings === true || p.bookings === '1' }), c = compute(d), out = describe(d, c);
      const lookalikes = [...findLookalikes(d.bookings, d.bookingLinks, 'booking'), ...findLookalikes(d.castings, d.castingLinks, 'casting')].slice(0, 60);
      console.log('[calendar dedupe] scan', JSON.stringify(out.summary));
      return json(200, { ok: true, backup_ready: await backupReady(admin), ...out, lookalikes });
    }
    if (action === 'runs') return json(200, await listRuns(admin, organization.id));
    if (action === 'apply') return json(200, await applyRun(admin, organization.id, user.id, body));
    if (action === 'undo') return json(200, await undoRun(admin, organization.id, body));
    return json(400, { error: 'Unsupported action' });
  } catch (error) { return errorResponse(error); }
};

export const __test = { applyEventGroup, applyStatusGroups, applyRun, undoRun, listRuns, compute, load };
