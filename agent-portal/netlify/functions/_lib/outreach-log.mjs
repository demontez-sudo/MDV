/* Outreach ledger.
   Every time someone at the agency reaches out (email, call, text, DM, meeting, model package…) one row is written to crm_activity
   with the time it happened, who did it, who it was to, and an `outreach` block in metadata (channel, status, follow-up).
   The recipient is "locked in": matched to an existing contact (by email) or created, and linked to a company when one is known. */

const FREE_MAIL = new Set(['gmail.com', 'googlemail.com', 'outlook.com', 'hotmail.com', 'live.com', 'msn.com', 'yahoo.com', 'ymail.com', 'icloud.com', 'me.com', 'mac.com', 'aol.com', 'proton.me', 'protonmail.com', 'gmx.com', 'mail.com', 'qq.com']);
const INTERNAL = new Set(['maisondeveux.com', 'cavyre.com']);

export const CHANNELS = ['email', 'call', 'text', 'whatsapp', 'instagram', 'linkedin', 'meeting', 'package', 'other'];
export const STATUSES = ['sent', 'replied', 'no_reply', 'meeting_set', 'won', 'closed'];
const TYPE_OF = { email: 'email', call: 'call', meeting: 'meeting', package: 'package' };

export const clean = v => String(v == null ? '' : v).trim();
export const cleanEmail = v => { const e = clean(v).toLowerCase(); return /^[^\s@<>()",;:]+@[^\s@<>()",;:]+\.[a-z]{2,}$/.test(e) ? e : ''; };
export const channelOf = v => { const c = clean(v).toLowerCase(); return CHANNELS.includes(c) ? c : 'other'; };
export const activityType = channel => TYPE_OF[channelOf(channel)] || 'other';
const likeSafe = v => clean(v).replace(/[\\%_]/g, m => '\\' + m);
const titleCase = v => clean(v).replace(/[._-]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
export const nameFromEmail = email => titleCase(String(email || '').split('@')[0]);
export const whoName = user => clean(user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email || 'Team');

export async function findContact(admin, orgId, email) {
  const e = cleanEmail(email); if (!e) return null;
  const { data, error } = await admin.from('contacts').select('id,display_name,email,company_id').eq('organization_id', orgId).ilike('email', likeSafe(e)).limit(1);
  if (error) throw error;
  return data?.[0] || null;
}
export async function findCompanyByName(admin, orgId, name) {
  const n = clean(name); if (!n) return null;
  const { data, error } = await admin.from('companies').select('id,name').eq('organization_id', orgId).ilike('name', likeSafe(n)).limit(1);
  if (error) throw error;
  return data?.[0] || null;
}
/* a company we already know for this address: same website, or a colleague at the same domain */
export async function companyFromDomain(admin, orgId, email) {
  const d = String(cleanEmail(email).split('@')[1] || '');
  if (!d || FREE_MAIL.has(d) || INTERNAL.has(d)) return null;
  try {
    const a = await admin.from('companies').select('id,name').eq('organization_id', orgId).ilike('website', '%' + likeSafe(d) + '%').limit(1);
    if (a.data?.[0]) return a.data[0];
    const b = await admin.from('contacts').select('company_id').eq('organization_id', orgId).ilike('email', '%@' + likeSafe(d)).not('company_id', 'is', null).limit(1);
    if (b.data?.[0]?.company_id) { const c = await admin.from('companies').select('id,name').eq('organization_id', orgId).eq('id', b.data[0].company_id).maybeSingle(); if (c.data) return c.data; }
  } catch (_e) { /* best effort */ }
  return null;
}
/* talent and our own team are not outside contacts: they have their own records */
export async function isTalentOrInternal(admin, orgId, email) {
  const e = cleanEmail(email); if (!e) return true;
  if (INTERNAL.has(e.split('@')[1])) return true;
  try {
    const m = await admin.from('models').select('id').eq('organization_id', orgId).ilike('email', likeSafe(e)).limit(1);
    if (m.data?.length) return true;
  } catch (_e) { /* column may not exist */ }
  try {
    const s = await admin.from('scouting_prospects').select('id').eq('organization_id', orgId).ilike('email', likeSafe(e)).limit(1);
    if (s.data?.length) return true;
  } catch (_e) { /* ignore */ }
  return false;
}

export async function linkContactToCompany(admin, orgId, contactId, companyId, role) {
  if (!contactId || !companyId) return;
  try {
    const ex = await admin.from('contact_company_links').select('contact_id').eq('organization_id', orgId).eq('contact_id', contactId).eq('company_id', companyId).limit(1);
    if (!ex.data?.length) {
      const any = await admin.from('contact_company_links').select('contact_id').eq('organization_id', orgId).eq('contact_id', contactId).limit(1);
      await admin.from('contact_company_links').insert({ organization_id: orgId, contact_id: contactId, company_id: companyId, relationship_role: role || null, is_primary: !any.data?.length });
    }
  } catch (_e) { /* the link table is optional */ }
}

export async function ensureCompany(admin, orgId, c) {
  const name = clean(c?.name); if (!name) return { company: null, created: false };
  const found = await findCompanyByName(admin, orgId, name);
  if (found) return { company: found, created: false };
  const payload = { organization_id: orgId, name, company_type: clean(c.company_type) || 'other', status: 'active', website: clean(c.website) || null, email: cleanEmail(c.email) || null, phone: clean(c.phone) || null, notes: clean(c.notes) || null, metadata: { source: 'outreach' } };
  const { data, error } = await admin.from('companies').insert(payload).select('id,name').single();
  if (error) throw new Error('Company could not be created. ' + error.message);
  return { company: data, created: true };
}

export async function ensureContact(admin, orgId, c) {
  const email = cleanEmail(c?.email);
  const found = email ? await findContact(admin, orgId, email) : null;
  if (found) return { contact: found, created: false };
  const name = clean(c?.display_name || c?.name) || (email ? nameFromEmail(email) : '');
  if (!name) return { contact: null, created: false };
  const parts = name.split(/\s+/);
  const payload = { organization_id: orgId, company_id: c.company_id || null, first_name: parts[0] || null, last_name: parts.slice(1).join(' ') || null, display_name: name, role: clean(c.role) || null, email: email || null, phone: clean(c.phone) || null, whatsapp: clean(c.whatsapp) || null, instagram: clean(c.instagram) || null, status: 'active', notes: clean(c.notes) || null, metadata: { source: c.source || 'outreach' } };
  const { data, error } = await admin.from('contacts').insert(payload).select('id,display_name,email,company_id').single();
  if (error) throw new Error('Contact could not be created. ' + error.message);
  if (data.company_id) await linkContactToCompany(admin, orgId, data.id, data.company_id, payload.role);
  return { contact: data, created: true };
}

/* one touch */
export async function recordOutreach(admin, o) {
  if (!o.contactId && !o.companyId) throw new Error('Outreach needs a contact or a company.');
  const channel = channelOf(o.channel);
  const occurred = o.occurredAt && !isNaN(new Date(o.occurredAt)) ? new Date(o.occurredAt).toISOString() : new Date().toISOString();
  if (o.dedupeKey) {
    try {
      const d = await admin.from('crm_activity').select('id').eq('organization_id', o.orgId).eq('metadata->>dedupe_key', o.dedupeKey).limit(1);
      if (d.data?.[0]) return { id: d.data[0].id, duplicate: true };
    } catch (_e) { /* fall through and write */ }
  }
  const outreach = { channel, status: STATUSES.includes(o.status) ? o.status : 'sent', source: o.source || 'manual', follow_up_at: o.followUpAt || null };
  const row = {
    organization_id: o.orgId, company_id: o.companyId || null, contact_id: o.contactId || null,
    activity_type: activityType(channel), direction: o.direction === 'inbound' ? 'inbound' : 'outbound',
    subject: clean(o.subject) || null, summary: clean(o.summary) || null, occurred_at: occurred, created_by: o.userId || null,
    metadata: { ...(o.extra || {}), outreach, by_name: o.userName || null, dedupe_key: o.dedupeKey || null }
  };
  const { data, error } = await admin.from('crm_activity').insert(row).select('*').single();
  if (error) throw new Error('Outreach could not be saved. ' + error.message);
  return data;
}

/* an email (or package) that already went out: lock each outside recipient in and log it */
export async function logSent(admin, { orgId, user, channel = 'email', recipients, subject, summary, extra, dedupeBase, source = 'mail' }) {
  const out = [];
  const seen = new Set();
  for (const r of recipients || []) {
    const email = cleanEmail(r?.email || r?.address);
    if (!email || seen.has(email)) continue; seen.add(email);
    try {
      if (await isTalentOrInternal(admin, orgId, email)) continue;
      let contact = r.contact_id ? { id: r.contact_id } : null, created = false, companyId = r.company_id || null;
      if (!contact) {
        const co = companyId ? null : await companyFromDomain(admin, orgId, email);
        const res = await ensureContact(admin, orgId, { email, display_name: r.name, company_id: companyId || co?.id || null, source });
        contact = res.contact; created = res.created;
        if (contact && !companyId) companyId = contact.company_id || co?.id || null;
      }
      if (!contact) continue;
      const act = await recordOutreach(admin, { orgId, userId: user?.id, userName: whoName(user), channel, direction: 'outbound', subject, summary, contactId: contact.id, companyId, source, extra: { ...(extra || {}), recipient_email: email }, dedupeKey: dedupeBase ? dedupeBase + ':' + email : null });
      out.push({ email, contact_id: contact.id, created_contact: created, activity: act?.id || null });
    } catch (e) { console.warn('[outreach] could not log', email, e?.message || e); }
  }
  return out;
}
