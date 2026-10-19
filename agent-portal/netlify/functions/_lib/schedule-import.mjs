/* Puts a prepared schedule (see scripts/build-schedule-data.mjs) onto the right calendars.
   - Events that belong to models are linked to those models, so they show on each model's calendar (Model 360, the model portal if shared) and under the model filter in the agency calendar.
   - Events that belong to team members carry their names (metadata.team), so the agency calendar can be viewed per person.
   - Personal blocks are tagged with the person's user id and are only returned to that person.
   Safe to run again: every event has a stable key, unchanged rows are left alone, and rows edited in the portal since the last import are kept as they are. */
import crypto from 'node:crypto';

const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
const uniq = a => [...new Set(a.filter(Boolean))];

/* wall-clock time in a named time zone -> UTC ISO string (handles daylight saving) */
export function zonedToIso(date, hhmm, tz = 'America/New_York') {
  const [y, mo, d] = date.split('-').map(Number), [h, mi] = String(hhmm || '00:00').split(':').map(Number);
  const guess = Date.UTC(y, mo - 1, d, h, mi, 0);
  const fmt = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const offsetAt = t => {
    const p = Object.fromEntries(fmt.formatToParts(new Date(t)).map(x => [x.type, x.value]));
    return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second) - t;
  };
  let t = guess - offsetAt(guess);
  t = guess - offsetAt(t);
  return new Date(t).toISOString();
}

/* "Tosin" or "Lauryn Alfreda" -> the one model it can only be, or why it is not certain */
export function matchModel(name, models) {
  const n = norm(name);
  const exact = models.filter(m => norm(m.display_name) === n);
  if (exact.length === 1) return { model: exact[0], status: 'matched' };
  if (exact.length > 1) return { model: null, status: 'ambiguous' };
  const first = models.filter(m => norm(m.display_name).split(' ')[0] === n.split(' ')[0] && (norm(m.display_name).startsWith(n) || n.startsWith(norm(m.display_name))));
  if (first.length === 1) return { model: first[0], status: 'matched' };
  return { model: null, status: first.length > 1 ? 'ambiguous' : 'missing' };
}

export function matchMember(name, members) {
  const n = norm(name);
  const hits = members.filter(m => {
    const first = norm(m.first_name || String(m.display_name || '').split(' ')[0]);
    return first === n || norm(m.display_name) === n;
  });
  return hits.length === 1 ? hits[0] : null;
}

const hashOf = e => crypto.createHash('sha1').update(JSON.stringify([e.title, e.date, e.end_date, e.start, e.end, e.all_day, e.event_type, e.label, e.status, e.location, e.notes, e.models, e.team, e.owner, e.model_visible, e.notes_hidden_from_model, e.personal_for, e.conflict || null, e.on_outlook || false])).digest('hex').slice(0, 16);

/* Decide, for every event in the set, what should happen. Pure: no writes. */
export function planImport({ set, models, members, existing, userId, tz }) {
  const zone = tz || set.timezone || 'America/New_York';
  const me = members.find(m => m.user_id === userId) || null;
  const meFirst = norm(me?.first_name || String(me?.display_name || '').split(' ')[0]);
  const existingByKey = new Map((existing || []).map(x => [x.metadata?.import_key, x]));
  const missingModels = new Map(), ambiguousModels = new Map(), missingPeople = new Set();
  const modelCache = new Map(), memberCache = new Map();
  const model = nm => { if (!modelCache.has(nm)) modelCache.set(nm, matchModel(nm, models)); return modelCache.get(nm); };
  const person = nm => { if (!memberCache.has(nm)) memberCache.set(nm, matchMember(nm, members)); return memberCache.get(nm); };

  const rows = [];
  for (const e of set.events) {
    const hash = hashOf(e);
    const prior = existingByKey.get(e.key) || null;
    if (e.personal_for && norm(e.personal_for) !== meFirst) { rows.push({ key: e.key, action: 'skip-personal', title: e.title, date: e.date, owner: e.owner, personal_for: e.personal_for }); continue; }

    const modelIds = [];
    for (const nm of e.models) {
      const r = model(nm);
      if (r.model) modelIds.push(r.model.id);
      else if (r.status === 'ambiguous') ambiguousModels.set(nm, (ambiguousModels.get(nm) || 0) + 1);
      else missingModels.set(nm, (missingModels.get(nm) || 0) + 1);
    }
    for (const nm of e.team) if (!person(nm)) missingPeople.add(nm);
    const ownerMember = e.owner ? person(e.owner) : null;

    const toModel = e.model_visible && modelIds.length > 0;
    const visibility = e.personal_for ? 'private' : toModel ? 'model_shared' : e.models.length ? 'private' : 'organization';
    const startsAt = e.all_day ? zonedToIso(e.date, '00:00', zone) : zonedToIso(e.date, e.start, zone);
    const endsAt = e.all_day ? zonedToIso(e.end_date || e.date, '23:59', zone) : e.end ? zonedToIso(e.date, e.end, zone) : null;
    const metadata = {
      import_set: set.id, import_key: e.key, import_hash: hash, import_source: e.source, imported_at: null, imported_by: userId || null,
      calendar_event_type: e.label, category: e.area, team: e.team, owner_name: e.owner || null, model_names: e.models,
      on_outlook: !!e.on_outlook, conflict: e.conflict || null, notes_internal: !!e.notes_hidden_from_model,
      private_to_user_id: e.personal_for ? userId : null,
    };
    const payload = {
      title: e.title, event_type: e.event_type, status: e.status, starts_at: startsAt, ends_at: endsAt, timezone: zone, all_day: !!e.all_day,
      location: e.location || null, owner_member_id: ownerMember?.id || null, visibility, notes: e.notes || null, recurrence_rule: null, metadata,
    };

    let action = 'create';
    if (prior) {
      const editedAt = Date.parse(prior.updated_at || ''), importedAt = Date.parse(prior.metadata?.imported_at || '');
      if (prior.metadata?.import_hash === hash) action = 'same';
      else if (Number.isFinite(editedAt) && Number.isFinite(importedAt) && editedAt - importedAt > 60000) action = 'skip-edited';
      else action = 'update';
    }
    rows.push({ key: e.key, action, title: e.title, date: e.date, existing_id: prior?.id || null, payload, model_ids: uniq(modelIds), visibility, team: e.team, owner: e.owner, source: e.source, models: e.models, to_model: toModel });
  }

  const count = f => rows.filter(f).length;
  const perModel = {}, perPerson = {};
  for (const r of rows) {
    if (!r.payload || r.action === 'skip-edited') continue;
    for (const nm of r.models) perModel[nm] = (perModel[nm] || 0) + 1;
    for (const nm of r.team) perPerson[nm] = (perPerson[nm] || 0) + 1;
  }
  return {
    rows,
    summary: {
      total: rows.length, create: count(r => r.action === 'create'), update: count(r => r.action === 'update'), same: count(r => r.action === 'same'),
      kept_edits: count(r => r.action === 'skip-edited'), skipped_personal: count(r => r.action === 'skip-personal'),
      on_model_calendars: count(r => r.payload && r.model_ids.length), shown_to_models: count(r => r.payload && r.to_model), agency_only_with_models: count(r => r.payload && r.model_ids.length && !r.to_model),
      per_model: perModel, per_person: perPerson,
      conflicts: rows.filter(r => r.payload?.metadata?.conflict && r.action !== 'skip-edited').map(r => ({ title: r.title, date: r.date, note: r.payload.metadata.conflict })),
      unmatched_models: [...missingModels].map(([name, events]) => ({ name, events })), ambiguous_models: [...ambiguousModels].map(([name, events]) => ({ name, events })),
      unmatched_people: [...missingPeople], importer_is: me ? (me.display_name || me.first_name) : null,
    },
  };
}

const rpcUnavailable = error => {
  const code = String(error?.code || '').toUpperCase(), msg = String(error?.message || error || '').toLowerCase();
  return code === 'PGRST202' || code === '42883' || msg.includes('could not find the function') || (msg.includes('function') && msg.includes('does not exist')) || msg.includes('schema cache');
};

async function saveOne(admin, orgId, userId, row, now) {
  const payload = { organization_id: orgId, ...row.payload, metadata: { ...row.payload.metadata, imported_at: now } };
  const rpc = await admin.rpc('save_event_full_v1', { target_org: orgId, target_event: row.existing_id || null, target_payload: payload, target_model_ids: row.model_ids, target_user: userId });
  if (!rpc.error) {
    if (!rpc.data?.verified || !rpc.data?.event) throw new Error('The calendar did not confirm the save');
    return rpc.data.event.id;
  }
  if (!rpcUnavailable(rpc.error)) throw rpc.error;
  let saved;
  if (row.existing_id) { const r = await admin.from('events').update(payload).eq('organization_id', orgId).eq('id', row.existing_id).select('*').single(); if (r.error) throw r.error; saved = r.data; }
  else { const r = await admin.from('events').insert(payload).select('*').single(); if (r.error) throw r.error; saved = r.data; }
  const del = await admin.from('event_models').delete().eq('organization_id', orgId).eq('event_id', saved.id); if (del.error) throw del.error;
  if (row.model_ids.length) { const ins = await admin.from('event_models').insert(row.model_ids.map(model_id => ({ organization_id: orgId, event_id: saved.id, model_id }))); if (ins.error) throw ins.error; }
  return saved.id;
}

/* Writes the next slice of what is still to do. Rows already saved read back as unchanged on the next call, so the client simply
   asks again until nothing is left; rows that failed are passed back in `exclude` so they are not retried forever. */
export async function writeSlice(admin, orgId, userId, plan, { limit = 30, exclude = [] } = {}) {
  const skip = new Set(exclude);
  const todo = plan.rows.filter(r => (r.action === 'create' || r.action === 'update') && !skip.has(r.key));
  const slice = todo.slice(0, limit), now = new Date().toISOString();
  let created = 0, updated = 0; const failed = [];
  for (const r of slice) {
    try { await saveOne(admin, orgId, userId, r, now); if (r.action === 'create') created++; else updated++; }
    catch (err) { failed.push({ key: r.key, title: r.title, date: r.date, error: String(err?.message || err).slice(0, 200) }); }
  }
  const remaining = todo.length - slice.length;
  return { created, updated, failed, remaining, done: remaining === 0 };
}
