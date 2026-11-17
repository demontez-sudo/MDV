/* Finding duplicate calendar rows. Pure functions: rows in, groups out, no database calls, so the rules can be tested on their own.

   Events come in two tiers:
     1  exact copy       same title, same start, same end, same models, same booking/casting/trip link
     2  same-day lookalike  same models and same day, and the title is the same once the models' names are taken out
                            ("Visa filing day" and "Sullivan: Visa filing day"); only looked at for events with at least one model
   Model tasks and time off (availability blocks) have one tier each. Bookings and castings carry money and contracts, so they are only listed. */

const clean = v => String(v == null ? '' : v);
export const norm = s => clean(s).toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
const minute = v => { const t = Date.parse(v); return Number.isFinite(t) ? Math.floor(t / 60000) : null; };
function dayIn(v, tz) {
  const d = new Date(v); if (isNaN(d)) return '';
  try { return new Intl.DateTimeFormat('en-CA', { timeZone: tz || 'UTC', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d); } catch (_e) { return d.toISOString().slice(0, 10); }
}
const recurrence = e => { const r = e.recurrence_rule || (e.metadata && e.metadata.repeat) || ''; return r ? JSON.stringify(r) : ''; };
const linkOf = e => clean(e.booking_id || e.casting_id || e.travel_record_id || (e.metadata && (e.metadata.booking_id || e.metadata.travel_record_id)) || '');
const created = e => Date.parse(e.created_at || 0) || 0;
const older = (a, b) => created(a) - created(b) || clean(a.id).localeCompare(clean(b.id));

/* which copy stays: the one that carries the most (an import key, a linked task, models, notes, a place), not cancelled, then the oldest */
function keepScore(e, nModels) {
  const m = e.metadata || {}; let s = 0;
  if (m.import_key) s += 1000;
  if (m.task_id) s += 500;
  if (clean(e.status) !== 'cancelled') s += 100;
  s += nModels * 10; if (e.notes) s += 5; if (e.location) s += 3;
  return s;
}
export function pickKeeper(list, modelCount) {
  return list.slice().sort((a, b) => keepScore(b, modelCount(b)) - keepScore(a, modelCount(a)) || older(a, b))[0];
}

/* the title once the models' names are taken out, so "Sullivan: Visa filing day" and "Visa filing day" read the same */
function coreTitle(title, names) {
  const drop = new Set(['model', 'for', 'the', 'a', 'an', 'of', 'and']);
  names.forEach(n => norm(n).split(' ').forEach(t => { if (t.length >= 3) drop.add(t); }));
  return norm(title).split(' ').filter(t => t && !drop.has(t)).join(' ');
}

/* events: rows from `events`; links: rows from `event_models` ({event_id, model_id}); modelNames: Map or object of model id -> display name */
export function findEventDuplicates({ events, links, modelNames }) {
  const names = modelNames instanceof Map ? modelNames : new Map(Object.entries(modelNames || {}));
  const byEvent = new Map();
  for (const l of links || []) { const k = clean(l.event_id); if (!byEvent.has(k)) byEvent.set(k, new Set()); byEvent.get(k).add(clean(l.model_id)); }
  const modelsOf = e => [...(byEvent.get(clean(e.id)) || [])].sort();
  const modelCount = e => modelsOf(e).length;
  const describe = (tier, key, list, keeper) => {
    const ms = modelsOf(keeper).map(id => names.get(id) || 'Model');
    return { tier, key, title: keeper.title, starts_at: keeper.starts_at, ends_at: keeper.ends_at || null, models: ms, keep: clean(keeper.id),
      remove: list.filter(x => clean(x.id) !== clean(keeper.id)).sort(older).map(x => clean(x.id)), event_ids: list.map(x => clean(x.id)) };
  };
  const groups = [], gone = new Set();

  /* tier 1: exact copies */
  const t1 = new Map();
  for (const e of events || []) {
    const t = norm(e.title), s = minute(e.starts_at); if (!t || s === null) continue;
    const k = [t, s, minute(e.ends_at) ?? '', modelsOf(e).join(','), linkOf(e), recurrence(e)].join('|');
    if (!t1.has(k)) t1.set(k, []); t1.get(k).push(e);
  }
  for (const [k, list] of t1) {
    if (list.length < 2) continue;
    const keeper = pickKeeper(list, modelCount), g = describe(1, k, list, keeper);
    groups.push(g); g.remove.forEach(id => gone.add(id));
  }

  /* tier 2: same models, same day, same title once the names are out */
  const t2 = new Map();
  for (const e of events || []) {
    if (gone.has(clean(e.id)) || recurrence(e)) continue;
    const ms = modelsOf(e); if (!ms.length) continue;
    const core = coreTitle(e.title, ms.map(id => names.get(id) || '')); if (core.length < 5) continue;
    const day = dayIn(e.starts_at, e.timezone); if (!day) continue;
    const k = [core, day, ms.join(','), clean(e.event_type), linkOf(e)].join('|');
    if (!t2.has(k)) t2.set(k, []); t2.get(k).push(e);
  }
  for (const [k, list] of t2) {
    if (list.length < 2) continue;
    const keeper = pickKeeper(list, modelCount);
    groups.push(describe(2, k, list, keeper));
  }
  return groups;
}

/* open model tasks: same model, same words, same due minute */
export function findTaskDuplicates(tasks) {
  const live = (tasks || []).filter(t => !/^(completed|done|cancelled|canceled)$/i.test(clean(t.status)));
  const map = new Map();
  for (const t of live) {
    const title = norm(t.title); if (!title) continue;
    if (!t.model_id && !t.due_at) continue;
    const k = [clean(t.model_id), title, minute(t.due_at) ?? '', clean(t.parent_task_id)].join('|');
    if (!map.has(k)) map.set(k, []); map.get(k).push(t);
  }
  const out = [];
  for (const [k, list] of map) {
    if (list.length < 2) continue;
    const sorted = list.slice().sort(older), keeper = sorted[0];
    out.push({ key: k, title: keeper.title, due_at: keeper.due_at || null, model_id: keeper.model_id || null, keep: clean(keeper.id), remove: sorted.slice(1).map(x => clean(x.id)) });
  }
  return out;
}

/* time off: same model, same start and end, same type, still counting */
export function findBlockDuplicates(blocks) {
  const live = (blocks || []).filter(b => /^(approved|pending)$/i.test(clean(b.status)));
  const map = new Map();
  for (const b of live) {
    const s = minute(b.starts_at); if (s === null || !b.model_id) continue;
    const k = [clean(b.model_id), s, minute(b.ends_at) ?? '', clean(b.block_type)].join('|');
    if (!map.has(k)) map.set(k, []); map.get(k).push(b);
  }
  const out = [];
  for (const [k, list] of map) {
    if (list.length < 2) continue;
    const sorted = list.slice().sort(older), keeper = sorted[0];
    out.push({ key: k, model_id: keeper.model_id, starts_at: keeper.starts_at, ends_at: keeper.ends_at || null, block_type: keeper.block_type || null, keep: clean(keeper.id), remove: sorted.slice(1).map(x => clean(x.id)) });
  }
  return out;
}

/* bookings and castings: listed for a person to look at, never removed by the tool */
export function findLookalikes(rows, linksByRow, kind) {
  const map = new Map();
  for (const r of rows || []) {
    const t = norm(r.title), s = minute(r.starts_at); if (!t || s === null) continue;
    const k = [t, s, [...(linksByRow.get(clean(r.id)) || [])].sort().join(',')].join('|');
    if (!map.has(k)) map.set(k, []); map.get(k).push(r);
  }
  const out = [];
  for (const [k, list] of map) if (list.length > 1) out.push({ kind, key: k, title: list[0].title, starts_at: list[0].starts_at, ids: list.slice().sort(older).map(x => clean(x.id)) });
  return out;
}

export const __test = { coreTitle, dayIn, keepScore, minute };
