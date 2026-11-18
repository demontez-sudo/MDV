/* A mother agency's activity and performance: what its models have worked on, what that is worth to the agency (its commission),
   how much has been paid, and a timeline of what has passed between the agency and Maison de Veux.
   buildActivity is pure (rows in, numbers out) so it can be tested; loadActivityData reads the tables.
   KEEP THIS FILE IDENTICAL in agent-portal/netlify/functions/_lib and mother-agency-portal/netlify/functions/_lib. */

const DAY = 864e5;
const ms = v => { const t = Date.parse(v); return Number.isFinite(t) ? t : null; };
const num = v => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const day = v => { const t = ms(v); return t == null ? null : new Date(t).toISOString().slice(0, 10); };
const month = t => new Date(t).toISOString().slice(0, 7);
const round = n => Math.round(n * 100) / 100;
const groupBy = (rows, key) => { const m = new Map(); for (const r of rows || []) { const k = String(r && r[key] != null ? r[key] : ''); if (!m.has(k)) m.set(k, []); m.get(k).push(r); } return m; };
const chunks = (arr, n) => { const out = []; for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n)); return out; };

const NOT_WORK = /^(cancelled|canceled|declined|released|rejected|lost)$/i;
const WORKED = /^(confirmed|job|completed|complete|booked|fitting)$/i;
const PAY_STATES = [['not_invoiced', 'Not invoiced'], ['invoiced', 'Invoiced'], ['client_paid', 'Client paid'], ['model_payable', 'Payable'], ['model_paid', 'Settled']];
const payKey = s => { const k = String(s || 'Not Invoiced').toLowerCase().replace(/[^a-z]+/g, '_').replace(/^_|_$/g, ''); return PAY_STATES.some(p => p[0] === k) ? k : 'not_invoiced'; };
export const PERIODS = [30, 90, 365, 0];                                    /* 0 = everything */
const pct = v => { const n = num(v); return n <= 1 ? n * 100 : n; };

export function buildActivity(d, { audience = 'staff', days = 90, now = Date.now() } = {}) {
  days = PERIODS.includes(Number(days)) ? Number(days) : 90;
  const from = days ? now - days * DAY : -Infinity;
  const models = new Map((d.models || []).map(m => [String(m.id), m.display_name || m.name || 'Model']));
  const current = new Set((d.placements || []).filter(p => /^(active|pending|placed)$/i.test(String(p.status || ''))).map(p => String(p.model_id)));
  const bookings = new Map((d.bookings || []).map(b => [String(b.id), b]));
  /* only this agency's models count: a booking shared with another agency's model is worth nothing to this one for that model */
  const mine = new Set([...(d.placements || []).map(p => String(p.model_id)), ...(d.models || []).map(m => String(m.id))]);
  const rates = groupBy((d.rates || []).filter(r => mine.has(String(r.model_id))), 'booking_id'), links = groupBy((d.bookingLinks || []).filter(l => mine.has(String(l.model_id))), 'booking_id');
  const companies = new Map((d.companies || []).map(c => [String(c.id), c.name]));

  /* ---- bookings in the period, with what the agency earns on each ---- */
  const lines = [];                                                        /* one per model per booking */
  for (const b of bookings.values()) {
    const t = ms(b.starts_at); if (t == null || t < from || t > now + 400 * DAY) continue;
    if (NOT_WORK.test(String(b.status || ''))) continue;
    const modelIds = new Set([...(links.get(String(b.id)) || []).map(l => String(l.model_id))]);
    const rs = (rates.get(String(b.id)) || []).filter(r => modelIds.has(String(r.model_id)) || !modelIds.size);
    const done = WORKED.test(String(b.status || ''));
    const upcoming = t > now;
    for (const mid of modelIds) {
      const r = rs.filter(x => String(x.model_id) === mid);
      const gross = r.reduce((n, x) => n + num(x.talent_gross), 0), comm = r.reduce((n, x) => n + num(x.mother_agency_amount), 0);
      lines.push({ booking_id: String(b.id), title: b.title || 'Booking', starts_at: day(b.starts_at), at: t, model_id: mid, model: models.get(mid) || 'Model', status: String(b.status || ''), done, upcoming, currency: (r[0] && r[0].currency) || b.currency || 'USD', gross, commission: comm, rate_pct: r[0] && r[0].mother_agency_rate != null ? Math.round(pct(r[0].mother_agency_rate) * 10) / 10 : null, pay: payKey(b.metadata && b.metadata.payment_status), has_rate: r.length > 0, company: audience === 'staff' ? companies.get(String(b.company_id)) || '' : '' });
    }
  }
  const worked = lines.filter(l => l.done && !l.upcoming);
  const byCur = new Map();
  for (const l of lines.filter(x => x.done)) { const c = byCur.get(l.currency) || { currency: l.currency, gross: 0, commission: 0 }; c.gross += l.gross; c.commission += l.commission; byCur.set(l.currency, c); }
  const money = [...byCur.values()].map(c => ({ currency: c.currency, gross: round(c.gross), commission: round(c.commission) })).sort((a, b) => b.commission - a.commission || b.gross - a.gross);
  const main = money[0] ? money[0].currency : 'USD';

  /* commission by payment state, in the main currency */
  const states = PAY_STATES.map(([k, label]) => ({ key: k, label, amount: 0, lines: 0 }));
  for (const l of lines.filter(x => x.done && x.currency === main)) { const s = states.find(x => x.key === l.pay); s.amount += l.commission; s.lines++; }
  states.forEach(s => s.amount = round(s.amount));

  /* castings */
  const castings = new Map((d.castings || []).map(c => [String(c.id), c]));
  const cl = (d.castingLinks || []).map(l => ({ l, c: castings.get(String(l.casting_id)) })).filter(x => x.c && (ms(x.c.starts_at) || 0) >= from && (ms(x.c.starts_at) || 0) <= now + 400 * DAY && !NOT_WORK.test(String(x.c.status || '')));
  const castingsDone = cl.filter(x => (ms(x.c.starts_at) || 0) <= now);
  const castingsBooked = castingsDone.filter(x => /^(booked|confirmed|won|selected|callback_booked)$/i.test(String(x.l.status || '')) || /^(booked|won|completed)$/i.test(String(x.c.status || ''))).length;

  /* how quickly models answer booking requests, and how many are still waiting */
  const linkRows = (d.bookingLinks || []).filter(l => { const b = bookings.get(String(l.booking_id)); return b && (ms(b.starts_at) || 0) >= from; });
  const answered = linkRows.filter(l => l.response_at), waiting = linkRows.filter(l => /^requested$/i.test(String(l.status || '')) && !l.response_at && (ms(bookings.get(String(l.booking_id)).starts_at) || 0) >= now).length;

  /* ledger and statements */
  const ledger = (d.ledger || []).filter(x => (ms(x.effective_on || x.created_at) || 0) >= from);
  const paid = ledger.filter(x => /payment/i.test(String(x.entry_type || ''))).reduce((n, x) => n + num(x.amount), 0);
  const paidCur = (ledger.find(x => /payment/i.test(String(x.entry_type || ''))) || {}).currency || main;

  /* by model */
  const byModel = [];
  for (const [mid, name] of models) {
    const ls = lines.filter(l => l.model_id === mid), w = ls.filter(l => l.done), cs = cl.filter(x => String(x.l.model_id) === mid), cd = cs.filter(x => (ms(x.c.starts_at) || 0) <= now);
    const lastT = w.filter(l => !l.upcoming).sort((a, b) => b.at - a.at)[0];
    byModel.push({ model_id: mid, name, current: current.has(mid), bookings: w.filter(l => !l.upcoming).length, upcoming: ls.filter(l => l.upcoming && !NOT_WORK.test(l.status)).length, gross: round(w.filter(l => l.currency === main).reduce((n, l) => n + l.gross, 0)), commission: round(w.filter(l => l.currency === main).reduce((n, l) => n + l.commission, 0)), castings: cd.length, castings_booked: cd.filter(x => /^(booked|confirmed|won|selected)$/i.test(String(x.l.status || ''))).length, last_booking: lastT ? lastT.starts_at : null, no_rate: w.filter(l => !l.has_rate).length });
  }
  byModel.sort((a, b) => b.commission - a.commission || b.bookings - a.bookings || a.name.localeCompare(b.name));

  /* by client (staff only: client names are Maison de Veux's) */
  let byClient = [];
  if (audience === 'staff') {
    const m = new Map();
    for (const l of worked.filter(x => x.currency === main && x.company)) { const c = m.get(l.company) || { client: l.company, bookings: 0, gross: 0, commission: 0 }; c.bookings++; c.gross += l.gross; c.commission += l.commission; m.set(l.company, c); }
    byClient = [...m.values()].map(c => ({ ...c, gross: round(c.gross), commission: round(c.commission) })).sort((a, b) => b.gross - a.gross).slice(0, 8);
  }

  /* twelve months */
  const monthly = [];
  for (let i = 11; i >= 0; i--) { const t = new Date(now); t.setUTCDate(1); t.setUTCMonth(t.getUTCMonth() - i); monthly.push({ month: month(t.getTime()), bookings: 0, gross: 0, commission: 0 }); }
  const seenMonth = new Set();
  for (const l of lines.filter(x => x.done && !x.upcoming && x.currency === main)) {
    const m = monthly.find(x => x.month === month(l.at)); if (!m) continue;
    const k = m.month + '|' + l.booking_id; if (!seenMonth.has(k)) { seenMonth.add(k); m.bookings++; }
    m.gross += l.gross; m.commission += l.commission;
  }
  monthly.forEach(m => { m.gross = round(m.gross); m.commission = round(m.commission); });

  /* the timeline: what has passed between the agency and Maison de Veux, newest first */
  const tl = [];
  const push = (at, kind, title, detail, tone = 'info', model = '') => { const t = ms(at); if (t != null && t <= now + 45 * DAY) tl.push({ at: new Date(t).toISOString(), kind, title, detail: detail || '', tone, model }); };
  for (const p of d.placements || []) {
    const name = models.get(String(p.model_id)) || 'A model';
    push(p.created_at, 'placement', name + ' joined the agency’s roster', '', 'ok', name);
    const md = p.metadata || {};
    for (const u of (Array.isArray(md.partner_portal_updates) ? md.partner_portal_updates : []).slice(0, 6)) push(u.at, 'update', 'Update from the agency about ' + name, (u.type ? u.type + ': ' : '') + (u.note || ''), 'info', name);
  }
  for (const b of bookings.values()) {
    const names = [...new Set((links.get(String(b.id)) || []).map(l => models.get(String(l.model_id))).filter(Boolean))].join(', ');
    if (NOT_WORK.test(String(b.status || ''))) push(b.updated_at || b.created_at, 'booking', 'Booking cancelled: ' + (b.title || 'Booking'), names, 'warn', names);
    else { push(b.created_at, 'booking', 'New booking: ' + (b.title || 'Booking'), names + (b.starts_at ? ' · ' + day(b.starts_at) : ''), 'info', names); if (WORKED.test(String(b.status || '')) && (ms(b.starts_at) || 0) <= now) push(b.starts_at, 'booking', 'Worked: ' + (b.title || 'Booking'), names, 'ok', names); }
  }
  for (const a of d.approvals || []) { push(a.requested_at, 'approval', 'Approval asked: ' + (a.title || a.request_type || 'Request'), a.status === 'pending' ? 'Waiting for a decision' : '', a.status === 'pending' ? 'warn' : 'info'); if (a.decided_at) push(a.decided_at, 'approval', (a.title || 'Request') + ' ' + String(a.status || 'decided'), a.decision_note || '', /approved/i.test(String(a.status)) ? 'ok' : 'warn'); }
  for (const s of d.statements || []) push(s.period_end || s.created_at, 'statement', 'Statement ' + (s.period_start ? day(s.period_start) + ' to ' : 'to ') + day(s.period_end), (s.status ? String(s.status) : '') + (s.closing_balance != null ? ' · balance ' + s.closing_balance + ' ' + (s.currency || '') : ''), 'info');
  for (const x of d.ledger || []) if (/payment/i.test(String(x.entry_type || ''))) push(x.effective_on || x.created_at, 'payment', 'Payment recorded: ' + num(x.amount) + ' ' + (x.currency || ''), x.notes || '', 'ok');
  for (const doc of d.documents || []) push(doc.uploaded_at, 'document', 'Document added: ' + (doc.label || doc.type || 'Document'), doc.name || '', 'info');
  if (audience === 'staff' && d.terms_updated_at) push(d.terms_updated_at, 'terms', 'Terms updated', '', 'info');
  tl.sort((a, b) => ms(b.at) - ms(a.at));

  return {
    period_days: days, main_currency: main, money,
    kpis: { bookings: worked.length, upcoming: lines.filter(l => l.upcoming && !NOT_WORK.test(l.status)).length, gross: round(worked.filter(l => l.currency === main).reduce((n, l) => n + l.gross, 0)), commission: round(worked.filter(l => l.currency === main).reduce((n, l) => n + l.commission, 0)), paid: round(paid), paid_currency: paidCur, castings: castingsDone.length, castings_booked: castingsBooked, booking_rate: castingsDone.length ? Math.round(castingsBooked / castingsDone.length * 100) : null, waiting_on_models: waiting, answered: answered.length, no_rate: worked.filter(l => !l.has_rate).length },
    commission_by_state: states, by_model: byModel, by_client: byClient, monthly,
    statements: (d.statements || []).slice(0, 6).map(s => ({ id: s.id, period_start: day(s.period_start), period_end: day(s.period_end), status: s.status || '', closing_balance: s.closing_balance != null ? num(s.closing_balance) : null, currency: s.currency || main })),
    recent_bookings: lines.filter(l => l.done).sort((a, b) => b.at - a.at).slice(0, 8).map(l => ({ title: l.title, model: l.model, starts_at: l.starts_at, status: l.status, gross: round(l.gross), commission: round(l.commission), currency: l.currency, pay: l.pay, has_rate: l.has_rate })),
    timeline: tl.slice(0, 60),
  };
}

/* the reading part --------------------------------------------------------------------------------------------------- */
async function safe(warnings, label, q) { try { const { data, error } = await q; if (error) throw error; return data || []; } catch (e) { warnings.push({ section: label, error: String(e && (e.code || e.message) || 'query_failed').slice(0, 120) }); return []; } }
async function paged(warnings, label, build) {
  const out = [];
  try { for (let from = 0; from < 12000; from += 1000) { const { data, error } = await build().range(from, from + 999); if (error) { if (error.code === 'PGRST103') break; throw error; } out.push(...(data || [])); if ((data || []).length < 1000) break; } }
  catch (e) { warnings.push({ section: label, error: String(e && (e.code || e.message) || 'query_failed').slice(0, 120) }); }
  return out;
}
async function inChunks(warnings, label, ids, run) { const out = []; for (const c of chunks(ids, 150)) out.push(...await safe(warnings, label, run(c))); return out; }

export async function loadActivityData(admin, orgId, partnerId, { partnerView = false } = {}) {
  const warnings = [];
  const placements = await paged(warnings, 'placements', () => admin.from('model_placements').select('*').eq('organization_id', orgId).eq('partner_agency_id', partnerId).order('id'));
  const ids = [...new Set(placements.map(p => p.model_id).filter(Boolean))];
  const empty = { warnings, placements, models: [], bookings: [], bookingLinks: [], rates: [], castings: [], castingLinks: [], approvals: [], ledger: [], statements: [], documents: [], companies: [], terms_updated_at: null };
  const [ledger, statements, approvals, partner] = await Promise.all([
    paged(warnings, 'ledger', () => admin.from('partner_ledger_entries').select('*').eq('organization_id', orgId).eq('partner_agency_id', partnerId).eq('status', 'posted').order('id')),
    safe(warnings, 'statements', admin.from('statements').select('*').eq('organization_id', orgId).eq('partner_agency_id', partnerId).eq('statement_type', 'mother_agency').order('period_end', { ascending: false }).limit(24)),
    safe(warnings, 'approvals', admin.from('approval_requests').select('id,model_id,title,request_type,status,requested_at,decided_at,decision_note').eq('organization_id', orgId).eq('partner_agency_id', partnerId).order('requested_at', { ascending: false }).limit(60)),
    safe(warnings, 'agency', admin.from('partner_agencies').select('metadata').eq('organization_id', orgId).eq('id', partnerId).limit(1)),
  ]);
  const meta = (partner[0] && partner[0].metadata) || {};
  const docs = ((meta.profile && meta.profile.documents) || []).filter(x => x.type !== 'logo').map(x => ({ type: x.type, label: x.type, name: x.name, uploaded_at: x.uploaded_at }));
  const base = { ...empty, ledger, statements, approvals, documents: docs, terms_updated_at: meta.terms && meta.terms.updated_at || null };
  if (!ids.length) return base;
  const [models, bookingLinks, castingLinks] = await Promise.all([
    inChunks(warnings, 'models', ids, c => admin.from('models').select('id,display_name').eq('organization_id', orgId).in('id', c)),
    inChunks(warnings, 'booking_links', ids, c => admin.from('booking_models').select('booking_id,model_id,status,response_at').eq('organization_id', orgId).in('model_id', c)),
    inChunks(warnings, 'casting_links', ids, c => admin.from('casting_models').select('casting_id,model_id,status').eq('organization_id', orgId).in('model_id', c)),
  ]);
  const bids = [...new Set(bookingLinks.map(l => l.booking_id).filter(Boolean))], cids = [...new Set(castingLinks.map(l => l.casting_id).filter(Boolean))];
  const [bookings, rates, castings] = await Promise.all([
    inChunks(warnings, 'bookings', bids, c => admin.from('bookings').select('id,title,status,starts_at,created_at,updated_at,company_id,currency,metadata').eq('organization_id', orgId).in('id', c)),
    inChunks(warnings, 'rates', bids, c => admin.from('booking_rates').select('booking_id,model_id,currency,talent_gross,mother_agency_rate,mother_agency_amount').eq('organization_id', orgId).in('booking_id', c)),
    inChunks(warnings, 'castings', cids, c => admin.from('castings').select('id,title,status,starts_at').eq('organization_id', orgId).in('id', c)),
  ]);
  const coIds = partnerView ? [] : [...new Set(bookings.map(b => b.company_id).filter(Boolean))];
  const companies = coIds.length ? await inChunks(warnings, 'companies', coIds, c => admin.from('companies').select('id,name').eq('organization_id', orgId).in('id', c)) : [];
  return { ...base, models, bookingLinks, castingLinks, bookings, rates, castings, companies };
}
