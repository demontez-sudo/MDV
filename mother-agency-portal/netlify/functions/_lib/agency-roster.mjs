/* A mother agency's roster in depth: for each model placed with the agency, the placement and its terms, availability, travel, visa,
   upcoming work, updates, and what is outstanding. buildRoster is pure (rows in, rows out) so it can be tested; loadRosterData reads
   the tables. KEEP THIS FILE IDENTICAL in agent-portal/netlify/functions/_lib and mother-agency-portal/netlify/functions/_lib. */

const DAY = 864e5;
const clean = (v, max) => String(v == null ? '' : v).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').trim().slice(0, max);
const bad = message => { const e = new Error(message); e.statusCode = 400; e.publicMessage = message; return e; };
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const ms = v => { const t = Date.parse(v); return Number.isFinite(t) ? t : null; };
/* a date with no time counts as noon UTC, so the answer does not depend on the server's time zone */
const daysTo = (v, now) => { const t = ms(v && /^\d{4}-\d{2}-\d{2}$/.test(String(v)) ? v + 'T12:00:00Z' : v); return t == null ? null : Math.ceil((t - now) / DAY); };
const day = v => { const t = ms(v); return t == null ? null : new Date(t).toISOString().slice(0, 10); };
const groupBy = (rows, key) => { const m = new Map(); for (const r of rows || []) { const k = String(r && r[key] != null ? r[key] : ''); if (!m.has(k)) m.set(k, []); m.get(k).push(r); } return m; };

/* ---- per-model terms on the placement (staff write them; the agency sees them but never the private notes) ---- */
export const PLACEMENT_TERMS = ['contract_start', 'contract_end', 'commission_override_pct', 'exclusivity', 'notes', 'staff_notes'];
export function sanitizePlacementTerms(t, current = {}) {
  const x = t && typeof t === 'object' ? t : {}, o = { ...current };
  const date = (v, label) => { v = clean(v, 10); if (!v) return null; if (!DATE.test(v) || isNaN(Date.parse(v))) throw bad(label + ' is not a valid date.'); return v; };
  if (x.contract_start !== undefined) o.contract_start = date(x.contract_start, 'The contract start');
  if (x.contract_end !== undefined) o.contract_end = date(x.contract_end, 'The contract end');
  if (o.contract_start && o.contract_end && o.contract_end < o.contract_start) throw bad('The contract end is before its start.');
  if (x.commission_override_pct !== undefined) { if (x.commission_override_pct === '' || x.commission_override_pct == null) o.commission_override_pct = null; else { const n = Number(x.commission_override_pct); if (!Number.isFinite(n) || n < 0 || n > 100) throw bad('The commission must be between 0 and 100.'); o.commission_override_pct = Math.round(n * 100) / 100; } }
  if (x.exclusivity !== undefined) { if (x.exclusivity && !['none', 'market', 'full'].includes(x.exclusivity)) throw bad('Choose an exclusivity option from the list.'); o.exclusivity = x.exclusivity || ''; }
  if (x.notes !== undefined) o.notes = clean(x.notes, 600);
  if (x.staff_notes !== undefined) o.staff_notes = clean(x.staff_notes, 1500);
  return o;
}
export const termsForAgency = t => { const { staff_notes, ...rest } = t || {}; return rest; };

const DONE_VISA = /^(approved|granted|issued|delivered|not_required|closed|archived|cancelled|canceled|complete|completed|valid)$/i;
const BAD_VISA = /^(rejected|denied|refused|expired|declined)$/i;
const DONE_BOOKING = /^(cancelled|canceled|declined|released|rejected)$/i;

/* the pure part ------------------------------------------------------------------------------------------------------ */
export function buildRoster(d, { audience = 'staff', now = Date.now() } = {}) {
  const models = d.models || [], placements = d.placements || [];
  const pByModel = new Map(); for (const p of placements) if (!pByModel.has(String(p.model_id))) pByModel.set(String(p.model_id), p);
  const by = k => groupBy(d[k], 'model_id');
  const blocks = by('blocks'), travel = by('travel'), visa = by('visa'), work = by('workAuth'), pass = by('passports'), bLinks = by('bookingLinks'), cLinks = by('castingLinks'), appr = by('approvals');
  const bookings = new Map((d.bookings || []).map(b => [String(b.id), b])), castings = new Map((d.castings || []).map(c => [String(c.id), c]));
  const photos = new Map((d.photos || []).map(p => [String(p.model_id), p.url])), markets = new Map((d.markets || []).map(m => [String(m.id), m.name]));
  const rows = [];

  for (const m of models) {
    const id = String(m.id), pl = pByModel.get(id) || {}, md = pl.metadata || {}, out = [];
    const flag = (tone, text, key) => out.push({ key, tone, text });

    /* availability */
    const myBlocks = (blocks.get(id) || []).filter(b => /^(approved|pending)$/i.test(String(b.status || 'approved')) && (ms(b.ends_at) == null || ms(b.ends_at) >= now)).sort((a, b) => (ms(a.starts_at) || 0) - (ms(b.starts_at) || 0));
    const nowBlock = myBlocks.find(b => (ms(b.starts_at) || 0) <= now), nextBlock = myBlocks.find(b => (ms(b.starts_at) || 0) > now);
    const availability = { state: nowBlock ? 'away' : nextBlock && daysTo(nextBlock.starts_at, now) <= 14 ? 'soon' : 'free', now: nowBlock ? { type: nowBlock.block_type || 'unavailable', until: day(nowBlock.ends_at), reason: nowBlock.reason || '' } : null, next: nextBlock ? { type: nextBlock.block_type || 'unavailable', starts_at: day(nextBlock.starts_at), ends_at: day(nextBlock.ends_at), days: daysTo(nextBlock.starts_at, now) } : null, upcoming: myBlocks.slice(0, 4).map(b => ({ type: b.block_type || 'unavailable', starts_at: day(b.starts_at), ends_at: day(b.ends_at), status: b.status || '' })) };

    /* travel */
    const myTravel = (travel.get(id) || []).filter(t => !/^(cancelled|canceled|completed)$/i.test(String(t.status || '')) && (ms(t.ends_at || t.starts_at) == null || ms(t.ends_at || t.starts_at) >= now)).sort((a, b) => (ms(a.starts_at) || 0) - (ms(b.starts_at) || 0));
    const nt = myTravel[0];
    const tr = { count: myTravel.length, next: nt ? { destination: nt.destination || nt.destination_city || '', purpose: nt.purpose || '', starts_at: day(nt.starts_at), ends_at: day(nt.ends_at), status: nt.status || '', days: daysTo(nt.starts_at, now) } : null };
    if (nt && tr.next.days != null && tr.next.days <= 14 && !/^(confirmed|booked|ticketed)$/i.test(String(nt.status || ''))) flag('warn', 'Trip to ' + (tr.next.destination || 'a new city') + ' in ' + Math.max(0, tr.next.days) + ' days is not confirmed', 'travel');

    /* visa and work authorisation */
    const cases = (visa.get(id) || []), open = cases.filter(c => !DONE_VISA.test(String(c.status || '')));
    let worst = cases.length ? 'ok' : 'none', nearest = null;
    for (const c of open) { const dl = daysTo(c.hard_deadline, now); if (dl != null && (nearest == null || dl < nearest.days)) nearest = { days: dl, country: c.country_code || '', type: c.visa_type || '' }; worst = 'action'; }
    for (const c of cases) if (BAD_VISA.test(String(c.status || ''))) worst = 'urgent';
    if (nearest && nearest.days <= 14) worst = 'urgent';
    const vz = { state: worst, open: open.length, nearest, cases: cases.slice(0, 5).map(c => ({ country: c.country_code || '', type: c.visa_type || '', status: c.status || '', deadline: day(c.hard_deadline), expires_on: day(c.expires_on) })) };
    if (worst === 'urgent') flag('bad', nearest && nearest.days <= 14 ? 'Visa for ' + (nearest.country || 'a trip') + ' is due in ' + Math.max(0, nearest.days) + ' days' : 'A visa has been refused or has expired', 'visa');
    else if (worst === 'action') flag('warn', open.length + ' visa case' + (open.length === 1 ? ' is' : 's are') + ' still open', 'visa');
    const wa = (work.get(id) || []).map(w => ({ ...w, left: daysTo(w.expires_on, now) })).filter(w => w.left != null && w.left <= 90).sort((a, b) => a.left - b.left)[0];
    if (wa) flag(wa.left < 0 ? 'bad' : 'warn', 'Work authorisation ' + (wa.left < 0 ? 'expired ' + (-wa.left) + ' days ago' : 'expires in ' + wa.left + ' days'), 'work');

    /* passport (staff only: the agency does not see the passport records) */
    let passport = null;
    if (audience === 'staff') {
      const ps = (pass.get(id) || []).map(p => ({ exp: p.expires_on || p.expiry_date || p.expires || null })).filter(p => p.exp).sort((a, b) => String(b.exp).localeCompare(String(a.exp)))[0];
      if (ps) { const left = daysTo(ps.exp, now); passport = { expires_on: day(ps.exp), days_left: left, state: left < 0 ? 'expired' : left < 180 ? 'expiring' : 'ok' }; if (left < 0) flag('bad', 'Passport expired ' + (-left) + ' days ago', 'passport'); else if (left < 180) flag('warn', 'Passport expires in ' + left + ' days', 'passport'); }
    }

    /* work: bookings and castings */
    const links = bLinks.get(id) || [];
    const mine = links.map(l => ({ link: l, b: bookings.get(String(l.booking_id)) })).filter(x => x.b && !DONE_BOOKING.test(String(x.b.status || '')));
    const upcoming = mine.filter(x => (ms(x.b.starts_at) || 0) >= now).sort((a, b) => (ms(a.b.starts_at) || 0) - (ms(b.b.starts_at) || 0));
    const past = mine.filter(x => (ms(x.b.starts_at) || 0) < now).sort((a, b) => (ms(b.b.starts_at) || 0) - (ms(a.b.starts_at) || 0));
    const waiting = upcoming.filter(x => /^requested$/i.test(String(x.link.status || ''))).length;
    const bk = { upcoming: upcoming.length, next: upcoming[0] ? { title: upcoming[0].b.title || 'Booking', starts_at: day(upcoming[0].b.starts_at), status: upcoming[0].b.status || '' } : null, waiting_on_model: waiting, last: past[0] ? { title: past[0].b.title || 'Booking', starts_at: day(past[0].b.starts_at) } : null, in_30_days: upcoming.filter(x => (ms(x.b.starts_at) || 0) <= now + 30 * DAY).length };
    if (waiting) flag('warn', waiting + ' booking' + (waiting === 1 ? '' : 's') + ' waiting for the model to answer', 'bookings');
    const cs = (cLinks.get(id) || []).filter(l => { const c = castings.get(String(l.casting_id)); return c && !DONE_BOOKING.test(String(c.status || '')) && (ms(c.starts_at) || 0) >= now; });
    const approvals = (appr.get(id) || []).filter(a => /^pending$/i.test(String(a.status || '')));
    if (approvals.length) flag('warn', approvals.length + ' approval' + (approvals.length === 1 ? '' : 's') + ' waiting for a decision', 'approvals');

    /* placement terms and the agency's own updates */
    const terms = md.agency_terms && typeof md.agency_terms === 'object' ? (audience === 'staff' ? md.agency_terms : termsForAgency(md.agency_terms)) : {};
    const endLeft = daysTo(terms.contract_end, now);
    const contract = !terms.contract_end ? (terms.contract_start ? 'open' : 'none') : endLeft < 0 ? 'ended' : endLeft <= 60 ? 'renew' : 'active';
    if (contract === 'ended') flag('bad', 'Contract ended ' + (-endLeft) + ' days ago', 'contract'); else if (contract === 'renew') flag('warn', 'Contract ends in ' + endLeft + ' days', 'contract');
    const updates = (Array.isArray(md.partner_portal_updates) ? md.partner_portal_updates : []).slice(0, 3).map(u => ({ at: u.at || null, type: u.type || 'general', note: u.note || '' }));
    const photo = photos.get(id) || '';
    if (!photo) flag('info', 'No photo on file', 'photo');

    const level = out.some(x => x.tone === 'bad') ? 'bad' : out.some(x => x.tone === 'warn') ? 'warn' : 'ok';
    rows.push({
      model_id: id, name: m.display_name || m.name || 'Model', status: m.status || '', photo,
      placement: { id: pl.id || null, status: pl.status || '', since: day(pl.created_at), markets: [...new Set([pl.market_id].filter(Boolean).map(x => markets.get(String(x)) || ''))].filter(Boolean), type: pl.placement_type || '' },
      terms: { ...terms, contract_state: contract, contract_days_left: terms.contract_end ? endLeft : null },
      availability, travel: tr, visa: vz, passport, work_auth: wa ? { expires_on: day(wa.expires_on), days_left: wa.left } : null,
      bookings: bk, castings: { upcoming: cs.length }, approvals: { pending: approvals.length }, updates, outstanding: out, level,
    });
  }
  const order = { bad: 0, warn: 1, ok: 2 };
  rows.sort((a, b) => order[a.level] - order[b.level] || a.name.localeCompare(b.name));
  const count = fn => rows.filter(fn).length;
  return { rows, summary: { models: rows.length, needs_attention: count(r => r.level !== 'ok'), urgent: count(r => r.level === 'bad'), away_now: count(r => r.availability.state === 'away'), traveling_soon: count(r => r.travel.next && r.travel.next.days != null && r.travel.next.days <= 30), visa_open: count(r => r.visa.open > 0), upcoming_bookings: rows.reduce((n, r) => n + r.bookings.in_30_days, 0) } };
}

/* the reading part --------------------------------------------------------------------------------------------------- */
async function safe(warnings, label, q) { try { const { data, error } = await q; if (error) throw error; return data || []; } catch (e) { warnings.push({ section: label, error: String(e && (e.code || e.message) || 'query_failed').slice(0, 120) }); return []; } }
async function paged(warnings, label, build) {
  const out = [];
  try { for (let from = 0; from < 12000; from += 1000) { const { data, error } = await build().range(from, from + 999); if (error) { if (error.code === 'PGRST103') break; throw error; } out.push(...(data || [])); if ((data || []).length < 1000) break; } }
  catch (e) { warnings.push({ section: label, error: String(e && (e.code || e.message) || 'query_failed').slice(0, 120) }); }
  return out;
}

/* partnerView: only what the agency is allowed to see (travel, visa, work authorisation flagged visible_to_partner; approvals flagged visible) */
export async function loadRosterData(admin, orgId, partnerId, { partnerView = false } = {}) {
  const warnings = [];
  const placements = await paged(warnings, 'placements', () => admin.from('model_placements').select('*').eq('organization_id', orgId).eq('partner_agency_id', partnerId).in('status', ['active', 'pending', 'placed']).order('id'));
  const ids = [...new Set(placements.map(p => p.model_id).filter(Boolean))];
  if (!ids.length) return { warnings, placements, models: [], blocks: [], travel: [], visa: [], workAuth: [], passports: [], bookingLinks: [], bookings: [], castingLinks: [], castings: [], approvals: [], photos: [], markets: [] };
  const inIds = (table, extra, select = '*') => { let q = admin.from(table).select(select).eq('organization_id', orgId).in('model_id', ids); if (extra) q = extra(q); return q; };
  const [models, photos, blocks, travel, visa, workAuth, passports, bookingLinks, castingLinks, approvals] = await Promise.all([
    safe(warnings, 'models', admin.from('models').select('id,display_name,status').eq('organization_id', orgId).in('id', ids)),
    safe(warnings, 'photos', admin.from('model_media').select('model_id,url,is_primary').eq('organization_id', orgId).in('model_id', ids).eq('is_primary', true)),
    safe(warnings, 'availability', inIds('availability_blocks', q => q.in('status', ['approved', 'pending']).order('starts_at', { ascending: true }))),
    safe(warnings, 'travel', inIds('travel_records', q => (partnerView ? q.eq('visible_to_partner', true) : q).order('starts_at', { ascending: true }))),
    safe(warnings, 'visa', inIds('visa_cases', q => (partnerView ? q.eq('visible_to_partner', true) : q))),
    safe(warnings, 'work_authorizations', inIds('work_authorizations', q => (partnerView ? q.eq('visible_to_partner', true) : q))),
    partnerView ? [] : safe(warnings, 'passports', inIds('passports')),
    safe(warnings, 'booking_links', inIds('booking_models', null, 'booking_id,model_id,status')),
    safe(warnings, 'casting_links', inIds('casting_models', null, 'casting_id,model_id,status')),
    safe(warnings, 'approvals', admin.from('approval_requests').select('id,model_id,status').eq('organization_id', orgId).eq('partner_agency_id', partnerId).in('status', ['pending'])),
  ]);
  const bids = [...new Set(bookingLinks.map(l => l.booking_id).filter(Boolean))], cids = [...new Set(castingLinks.map(l => l.casting_id).filter(Boolean))];
  const mids = [...new Set(placements.map(p => p.market_id).filter(Boolean))];
  const [bookings, castings, markets] = await Promise.all([
    bids.length ? safe(warnings, 'bookings', admin.from('bookings').select('id,title,status,starts_at').eq('organization_id', orgId).in('id', bids)) : [],
    cids.length ? safe(warnings, 'castings', admin.from('castings').select('id,title,status,starts_at').eq('organization_id', orgId).in('id', cids)) : [],
    mids.length ? safe(warnings, 'markets', admin.from('markets').select('id,name').eq('organization_id', orgId).in('id', mids)) : [],
  ]);
  return { warnings, placements, models, blocks, travel, visa, workAuth, passports, bookingLinks, bookings, castingLinks, castings, approvals, photos, markets };
}
