/* Mother agency profile, in depth: company details, the team (several people with roles) and the commercial terms.
   Pure functions, no database calls, so both portals use the same rules. KEEP THIS FILE IDENTICAL in
   agent-portal/netlify/functions/_lib and mother-agency-portal/netlify/functions/_lib (a test compares them).
   Stored on partner_agencies.metadata: profile.fields (company details), profile.team (people), terms (commercial; only staff write it). */

export const TEXT_FIELDS = {
  tagline: 140, bio: 1800, city: 80, country: 80, website: 200, instagram: 80, founded_year: 4, contact_name: 120, contact_role: 120, contact_email: 160, contact_phone: 60, whatsapp: 60,
  legal_name: 160, registration_no: 80, tax_id: 80, address_line: 200, address_line2: 120, state: 80, postal_code: 20, models_count: 5,
};
export const LIST_FIELDS = { specialties: { max: 12, item: 40 }, regions: { max: 20, item: 60 }, languages: { max: 15, item: 40 } };
export const TOPICS = [['bookings', 'Bookings'], ['castings', 'Castings'], ['travel', 'Travel'], ['visa', 'Visa'], ['accounts', 'Accounts and payments'], ['contracts', 'Contracts'], ['development', 'Development'], ['general', 'General']];
export const SPECIALTIES = ['Editorial', 'Commercial', 'Runway', 'E-commerce', 'Development / new faces', 'Plus size', 'Mature', 'Kids', 'Fitness', 'Parts', 'Influencer'];
export const EXCLUSIVITY = [['none', 'Not exclusive'], ['market', 'Exclusive in some markets'], ['full', 'Fully exclusive']];
export const PAYMENT_TERMS = [['on_receipt', 'On receipt'], ['net_15', 'Net 15 days'], ['net_30', 'Net 30 days'], ['net_45', 'Net 45 days'], ['net_60', 'Net 60 days'], ['custom', 'Custom (see notes)']];
export const CURRENCIES = ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'CHF', 'JPY', 'NGN', 'ZAR', 'BRL'];
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

export const clean = (v, max) => String(v == null ? '' : v).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').trim().slice(0, max);
const bad = message => { const e = new Error(message); e.statusCode = 400; e.publicMessage = message; return e; };

/* a list typed as "Editorial, Runway" or sent as an array, tidied: trimmed, de-duplicated (ignoring case), capped */
export function cleanList(v, { max, item }) {
  const raw = Array.isArray(v) ? v : String(v == null ? '' : v).split(/[,;\n]/);
  const seen = new Set(), out = [];
  for (const x of raw) { const t = clean(x, item); const k = t.toLowerCase(); if (t && !seen.has(k)) { seen.add(k); out.push(t); } if (out.length >= max) break; }
  return out;
}

/* company details: only known keys are taken, each trimmed to its length; checks the ones that have a shape */
export function sanitizeFields(incoming, current = {}) {
  const f = { ...current };
  for (const [k, max] of Object.entries(TEXT_FIELDS)) if (incoming[k] !== undefined) f[k] = clean(incoming[k], max);
  for (const [k, opt] of Object.entries(LIST_FIELDS)) if (incoming[k] !== undefined) f[k] = cleanList(incoming[k], opt);
  if (f.contact_email && !EMAIL.test(f.contact_email)) throw bad('Enter a valid contact email.');
  if (f.founded_year && !/^(18|19|20)\d{2}$/.test(f.founded_year)) throw bad('Enter the year as four digits, for example 2012.');
  if (f.models_count && !/^\d{1,5}$/.test(f.models_count)) throw bad('Enter the number of models as a whole number.');
  if (f.website && !/^https?:\/\//i.test(f.website)) f.website = 'https://' + f.website;
  return f;
}

/* the team: up to 20 people. Each needs a name; an email, when given, must look like one. One person can be marked as the main contact. */
export function sanitizeTeam(list, makeId = () => (globalThis.crypto && crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2))) {
  const raw = Array.isArray(list) ? list : [];
  if (raw.length > 20) throw bad('That is more than 20 people. Keep the main contacts.');
  const ids = new Set(), topicKeys = new Set(TOPICS.map(t => t[0])), out = [];
  for (const m of raw) {
    if (!m || typeof m !== 'object') continue;
    const name = clean(m.name, 120);
    if (!name) throw bad('Every person needs a name.');
    const email = clean(m.email, 160);
    if (email && !EMAIL.test(email)) throw bad('“' + name + '” has an email that does not look right.');
    let id = clean(m.id, 64); if (!id || ids.has(id)) id = makeId(); ids.add(id);
    out.push({ id, name, role: clean(m.role, 80), email, phone: clean(m.phone, 60), whatsapp: clean(m.whatsapp, 60), topics: (Array.isArray(m.topics) ? m.topics : []).map(String).filter((t, i, a) => topicKeys.has(t) && a.indexOf(t) === i), primary: !!m.primary });
  }
  let seen = false;                                                      /* only one main contact */
  for (const m of out) { if (m.primary && !seen) seen = true; else m.primary = false; }
  if (!seen && out.length) out[0].primary = true;
  return out;
}

const pct = (v, label) => { if (v === '' || v == null) return null; const n = Number(v); if (!Number.isFinite(n) || n < 0 || n > 100) throw bad(label + ' must be between 0 and 100.'); return Math.round(n * 100) / 100; };
const date = (v, label) => { v = clean(v, 10); if (!v) return null; if (!DATE.test(v) || isNaN(Date.parse(v))) throw bad(label + ' is not a valid date.'); return v; };

/* commercial terms (written by Maison de Veux staff only; the agency sees everything except the internal notes) */
export function sanitizeTerms(t, current = {}) {
  const x = t && typeof t === 'object' ? t : {}, o = { ...current };
  if (x.commission_pct !== undefined) o.commission_pct = pct(x.commission_pct, 'Maison de Veux commission');
  if (x.agency_share_pct !== undefined) o.agency_share_pct = pct(x.agency_share_pct, 'The agency share');
  if (x.contract_start !== undefined) o.contract_start = date(x.contract_start, 'The contract start');
  if (x.contract_end !== undefined) o.contract_end = date(x.contract_end, 'The contract end');
  if (o.contract_start && o.contract_end && o.contract_end < o.contract_start) throw bad('The contract end is before its start.');
  if (x.renewal_notice_days !== undefined) { const n = x.renewal_notice_days === '' || x.renewal_notice_days == null ? null : Number(x.renewal_notice_days); if (n != null && (!Number.isInteger(n) || n < 0 || n > 365)) throw bad('Renewal notice must be 0 to 365 days.'); o.renewal_notice_days = n; }
  if (x.exclusivity !== undefined) { if (x.exclusivity && !EXCLUSIVITY.some(e => e[0] === x.exclusivity)) throw bad('Choose an exclusivity option from the list.'); o.exclusivity = x.exclusivity || ''; }
  if (x.exclusivity_note !== undefined) o.exclusivity_note = clean(x.exclusivity_note, 300);
  if (x.payment_terms !== undefined) { if (x.payment_terms && !PAYMENT_TERMS.some(e => e[0] === x.payment_terms)) throw bad('Choose payment terms from the list.'); o.payment_terms = x.payment_terms || ''; }
  if (x.payment_terms_note !== undefined) o.payment_terms_note = clean(x.payment_terms_note, 300);
  if (x.currency !== undefined) { const c = clean(x.currency, 3).toUpperCase(); if (c && !CURRENCIES.includes(c)) throw bad('Choose a currency from the list.'); o.currency = c; }
  if (x.payout_contact_name !== undefined) o.payout_contact_name = clean(x.payout_contact_name, 120);
  if (x.payout_contact_email !== undefined) { const e = clean(x.payout_contact_email, 160); if (e && !EMAIL.test(e)) throw bad('The payout contact email does not look right.'); o.payout_contact_email = e; }
  if (x.invoicing_notes !== undefined) o.invoicing_notes = clean(x.invoicing_notes, 600);
  if (x.internal_notes !== undefined) o.internal_notes = clean(x.internal_notes, 1500);
  if (o.commission_pct != null && o.agency_share_pct != null && o.commission_pct + o.agency_share_pct > 100.0001) throw bad('The commission and the agency share add up to more than 100%.');
  return o;
}

/* what the agency may see of the terms */
export function termsForAgency(t) { const { internal_notes, ...rest } = t || {}; return rest; }

/* days until the contract ends, and a plain state for badges */
export function contractState(t, now = Date.now()) {
  const end = t && t.contract_end ? new Date(t.contract_end + 'T12:00:00').getTime() : NaN;
  if (!Number.isFinite(end)) return { state: t && t.contract_start ? 'open' : 'none', days_left: null };
  const days = Math.ceil((end - now) / 864e5), notice = Number(t.renewal_notice_days) || 60;
  return { state: days < 0 ? 'ended' : days <= notice ? 'renew' : 'active', days_left: days };
}
