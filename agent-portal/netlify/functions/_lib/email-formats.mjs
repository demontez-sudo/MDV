// Email formats: reusable subject + body with {{blanks}} that fill in from Contacts, Companies, Model Scouting and the model roster.
// A blank looks like {{contact.first_name}} or {{contact.first_name|there}} (the part after | is used when the record has no value).

export const GROUPS = [
  { key: 'contact', label: 'Contact', vars: [['first_name', 'First name'], ['last_name', 'Last name'], ['name', 'Full name'], ['role', 'Role'], ['email', 'Email']] },
  { key: 'company', label: 'Company', vars: [['name', 'Name'], ['type', 'Type'], ['website', 'Website']] },
  { key: 'model', label: 'Model', vars: [['name', 'Full name'], ['first_name', 'First name'], ['height', 'Height'], ['measurements', 'Measurements'], ['hair', 'Hair'], ['eyes', 'Eyes'], ['market', 'Market'], ['profile_link', 'Profile link']] },
  { key: 'prospect', label: 'Scouted person', vars: [['first_name', 'First name'], ['name', 'Full name'], ['city', 'City'], ['country', 'Country'], ['instagram', 'Instagram'], ['height', 'Height']] },
  { key: 'agent', label: 'You', vars: [['name', 'Your name'], ['first_name', 'Your first name'], ['email', 'Your email']] },
  { key: 'agency', label: 'Agency', vars: [['name', 'Agency name']] },
  { key: 'date', label: 'Date', vars: [['today', 'Today']] },
  { key: 'package', label: 'Package', vars: [['link', 'Package link']] }
];
export const KNOWN = new Set(GROUPS.flatMap(g => g.vars.map(v => g.key + '.' + v[0])));
export const SITUATIONS = [['intro', 'Introduction'], ['submission', 'Submission'], ['follow_up', 'Follow-up'], ['confirmation', 'Confirmation'], ['thanks', 'Thank you'], ['scouting', 'Scouting'], ['other', 'Other']];
export const AUDIENCES = [['any', 'Anyone'], ['brand', 'Brand / client'], ['casting', 'Casting director'], ['scout', 'Scouted person'], ['mother', 'Mother agency'], ['press', 'Press / editorial']];

const BLANK = /\{\{\s*([a-z_]+\.[a-z_]+)\s*(?:\|([^}]*))?\}\}/gi;

/** Fill the blanks from `ctx` (e.g. { contact: { first_name: 'Ana' } }). Returns the text and the blanks that stayed empty. */
export function fill(text, ctx) {
  const missing = new Set();
  const out = String(text == null ? '' : text).replace(BLANK, (m, key, fallback) => {
    const k = key.toLowerCase(), [g, f] = k.split('.');
    const v = ctx && ctx[g] && ctx[g][f];
    if (v != null && String(v).trim() !== '') return String(v).trim();
    if (fallback != null && fallback.trim() !== '') return fallback.trim();
    missing.add(k);
    return '{{' + k + '}}';
  });
  return { text: out, missing: [...missing] };
}

export function blanksIn(text) {
  const keys = new Set(); let m; const re = new RegExp(BLANK.source, 'gi');
  while ((m = re.exec(String(text || '')))) keys.add(m[1].toLowerCase());
  return [...keys];
}
export const unknownBlanks = (...texts) => [...new Set(texts.flatMap(blanksIn))].filter(k => !KNOWN.has(k));

const first = n => String(n || '').trim().split(/\s+/)[0] || '';
const fmtMeasure = m => {
  if (!m) return '';
  const parts = [['Height', m.height_display], ['Bust', m.bust_display || m.chest_display], ['Waist', m.waist_display], ['Hips', m.hips_display], ['Shoe', m.shoe]].filter(x => x[1]);
  return parts.map(x => x[0] + ' ' + x[1]).join(' · ');
};

/** Build the fill-in context from the loaded records. */
export function buildContext({ contact, company, model, measurement, prospect, user, userName, agencyName, extra, now = new Date() }) {
  const ctx = {};
  if (contact) ctx.contact = { first_name: contact.first_name || first(contact.display_name), last_name: contact.last_name || String(contact.display_name || '').trim().split(/\s+/).slice(1).join(' '), name: contact.display_name || [contact.first_name, contact.last_name].filter(Boolean).join(' '), role: contact.role || '', email: contact.email || '' };
  if (company) ctx.company = { name: company.name || '', type: String(company.company_type || '').replace(/_/g, ' '), website: company.website || '' };
  if (model) {
    const routeKey = String(model.legacy_key || '').trim().toLowerCase();
    ctx.model = { name: model.display_name || '', first_name: first(model.display_name), height: measurement?.height_display || '', measurements: fmtMeasure(measurement), hair: measurement?.hair || '', eyes: measurement?.eyes || '', market: model.primary_market_label || '', profile_link: routeKey ? 'https://www.maisondeveux.com/' + routeKey : '' };
  }
  if (prospect) ctx.prospect = { first_name: prospect.first_name || first(prospect.display_name), name: prospect.display_name || '', city: prospect.city || '', country: prospect.country || '', instagram: prospect.instagram || '', height: prospect.height_display || '' };
  ctx.agent = { name: userName || '', first_name: first(userName), email: user?.email || '' };
  ctx.agency = { name: agencyName || '' };
  ctx.date = { today: now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }) };
  ctx.package = { link: extra?.package_link || '' };
  return ctx;
}
