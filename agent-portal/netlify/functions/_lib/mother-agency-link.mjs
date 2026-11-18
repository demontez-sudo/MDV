/* Connecting models to mother agencies. A model has one mother agency at a time: connecting it to a new one ends its placement with the old one.
   The connection is a row in model_placements (model, partner agency, status active/pending/placed). Pure matching lives here too, so it can be tested without a database. */

const LIVE = ['active', 'pending', 'placed'];
const clean = v => String(v == null ? '' : v);

export const norm = s => clean(s).toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').trim();
const AGENCY_NOISE = new Set(['models', 'model', 'management', 'mgmt', 'agency', 'agencies', 'talent', 'the', 'and', 'inc', 'ltd', 'llc', 'co', 'group', 'international', 'int', 'worldwide']);
export const agencyKey = s => norm(s).split(' ').filter(t => t && !AGENCY_NOISE.has(t)).join(' ');
const tokens = s => norm(s).split(' ').filter(Boolean);

/* match one typed name against a list of {id,name}; returns {id} for one clear match, {candidates} for several, or {} for none */
export function matchName(typed, list, keyFn = norm) {
  const key = keyFn(typed);
  if (!key) return {};
  const exact = list.filter(x => keyFn(x.name) === key);
  if (exact.length === 1) return { id: exact[0].id, how: 'exact' };
  if (exact.length > 1) return { candidates: exact.slice(0, 5).map(x => ({ id: x.id, name: x.name })) };
  const tk = key.split(' ').sort().join(' ');
  const same = list.filter(x => keyFn(x.name).split(' ').sort().join(' ') === tk);       /* "Okoro Lovelyn" and "Lovelyn Okoro" */
  if (same.length === 1) return { id: same[0].id, how: 'reordered' };
  const want = key.split(' ');
  const within = list.filter(x => { const t = keyFn(x.name).split(' '); return want.length >= 2 ? want.every(w => t.includes(w)) : t.includes(want[0]) && t.length <= 2; });
  if (within.length === 1) return { id: within[0].id, how: 'partial' };
  if (within.length > 1) return { candidates: within.slice(0, 5).map(x => ({ id: x.id, name: x.name })) };
  return {};
}

/* a pasted list: one connection per line. Tab, comma, semicolon, pipe or " - " between the model and the agency; a header line is skipped. */
export function parseList(text, { agencyOnly = false } = {}) {
  const out = [];
  const lines = clean(text).split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  for (let i = 0; i < lines.length; i++) {
    let parts;
    if (agencyOnly) parts = [lines[i].replace(/^["']|["']$/g, '').trim()];
    else {
      const l = lines[i];
      const delim = l.includes('\t') ? '\t' : l.includes('|') ? '|' : l.includes(';') ? ';' : / [-–—] /.test(l) ? / [-–—] / : l.includes(',') ? ',' : null;
      parts = delim ? l.split(delim).map(x => x.trim().replace(/^["']|["']$/g, '').trim()) : [l];
    }
    if (i === 0 && /^(model|name|talent)s?$/i.test(parts[0] || '') && (agencyOnly || /agenc|mother|mgmt|management/i.test(parts[1] || ''))) continue;   /* header */
    if (!parts[0]) continue;
    out.push({ line: i + 1, model: parts[0], agency: agencyOnly ? '' : (parts[1] || '') });
  }
  return out;
}

export async function rowsOf(q) { const { data, error } = await q; if (error) throw error; return data || []; }

export async function pagedRows(build, max = 12000) {
  const out = [];
  for (let from = 0; from < max; from += 1000) {
    const { data, error } = await build().range(from, from + 999);
    if (error) { if (error.code === 'PGRST103') break; throw error; }
    out.push(...(data || []));
    if ((data || []).length < 1000) break;
  }
  return out;
}

export async function motherPartners(admin, orgId) {
  return rowsOf(admin.from('partner_agencies').select('id,company_id,partner_type').eq('organization_id', orgId).eq('partner_type', 'mother_agency'));
}

/* who each model is with right now: Map model_id -> partner_agency_id (only live placements with a mother agency) */
export async function currentLinks(admin, orgId, partnerIds) {
  if (!partnerIds.length) return new Map();
  const pl = await pagedRows(() => admin.from('model_placements').select('id,model_id,partner_agency_id,status').eq('organization_id', orgId).in('partner_agency_id', partnerIds).in('status', LIVE).order('id'));
  const m = new Map();
  for (const x of pl) if (!m.has(String(x.model_id))) m.set(String(x.model_id), String(x.partner_agency_id));
  return m;
}

/* connect one model to one mother agency (ending its placement with any other mother agency). Returns {ok, moved_from, already}. */
export async function connectModel(admin, orgId, modelId, partnerId, motherIds) {
  const result = { ok: false, already: false, moved_from: [], error: null };
  try {
    const current = await rowsOf(admin.from('model_placements').select('id,partner_agency_id,status').eq('organization_id', orgId).eq('model_id', modelId));
    for (const pl of current) {
      if (!pl.partner_agency_id || !motherIds.has(String(pl.partner_agency_id)) || String(pl.partner_agency_id) === String(partnerId)) continue;
      if (!LIVE.includes(String(pl.status))) continue;
      let done = false;
      for (const s of ['ended', 'inactive', 'archived']) { const { error } = await admin.from('model_placements').update({ status: s }).eq('organization_id', orgId).eq('id', pl.id); if (!error) { done = true; break; } }
      if (done) result.moved_from.push(String(pl.partner_agency_id));
    }
    const mine = current.find(pl => String(pl.partner_agency_id) === String(partnerId));
    if (mine) {
      if (LIVE.includes(String(mine.status))) result.already = true;
      else { const { error } = await admin.from('model_placements').update({ status: 'active' }).eq('organization_id', orgId).eq('id', mine.id); if (error) throw error; }
    } else {
      const base = { organization_id: orgId, model_id: modelId, partner_agency_id: partnerId, status: 'active' };
      let { error } = await admin.from('model_placements').insert(base);
      if (error && /placement_type|market_id|null value/i.test(String(error.message || ''))) {
        const mk = await rowsOf(admin.from('model_market_assignments').select('market_id,is_primary').eq('organization_id', orgId).eq('model_id', modelId)).catch(() => []);
        const marketId = (mk.find(x => x.is_primary) || mk[0] || {}).market_id || null;
        ({ error } = await admin.from('model_placements').insert({ ...base, placement_type: 'mother_agency', ...(marketId ? { market_id: marketId } : {}) }));
      }
      if (error) throw error;
    }
    result.ok = true;
  } catch (e) { result.error = String(e && e.message || e).slice(0, 160); }
  return result;
}

export async function disconnectModel(admin, orgId, modelId, partnerId) {
  const current = await rowsOf(admin.from('model_placements').select('id,status').eq('organization_id', orgId).eq('model_id', modelId).eq('partner_agency_id', partnerId));
  let n = 0;
  for (const pl of current) {
    if (!LIVE.includes(String(pl.status))) continue;
    let done = false;
    for (const s of ['ended', 'inactive', 'archived']) { const { error } = await admin.from('model_placements').update({ status: s }).eq('organization_id', orgId).eq('id', pl.id); if (!error) { done = true; break; } }
    if (!done) throw new Error('The connection could not be ended.');
    n++;
  }
  return n;
}
