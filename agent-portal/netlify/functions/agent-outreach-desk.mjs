import { requireUser, parseBody, json, errorResponse, adminClient, assertPermission } from './_lib/auth.mjs';
import { requireStaffOrganization, requirePermission } from './_lib/agent-bridge.mjs';
import { CHANNELS, STATUSES, clean, cleanEmail, channelOf, ensureCompany, ensureContact, recordOutreach, linkContactToCompany, whoName } from './_lib/outreach-log.mjs';

async function rows(q) { const { data, error } = await q; if (error) throw error; return data || []; }
async function optional(q, label) { const { data, error } = await q; if (error) { console.warn('[outreach optional]', label, error.message); return []; } return data || []; }
const bad = (m, code = 'OUTREACH_VALIDATION_ERROR') => { const e = new Error(m); e.statusCode = 400; e.code = code; return e; };

async function requireWrite(userId, organizationId) {
  const admin = adminClient();
  if (await assertPermission(admin, userId, organizationId, 'crm.write')) return admin;
  const { data: member, error } = await admin.from('organization_members').select('id').eq('organization_id', organizationId).eq('user_id', userId).eq('member_type', 'staff').eq('status', 'active').maybeSingle();
  if (error) throw error;
  if (member?.id) return admin;
  const e = new Error('Missing permission: crm.write'); e.statusCode = 403; throw e;
}

const isOutreach = r => {
  const o = r.metadata && r.metadata.outreach;
  if (o) return true;
  return (r.direction === 'outbound' || r.direction === 'inbound') && ['email', 'call', 'meeting', 'package', 'other'].includes(r.activity_type);
};

function shape(r, cm, km) {
  const m = r.metadata || {}, o = m.outreach || {};
  const contact = r.contact_id ? km.get(r.contact_id) : null, company = r.company_id ? cm.get(r.company_id) : (contact && contact.company_id ? cm.get(contact.company_id) : null);
  return {
    id: r.id, at: r.occurred_at, channel: o.channel || (r.activity_type === 'other' ? 'other' : r.activity_type),
    direction: r.direction || 'outbound', subject: r.subject || '', summary: r.summary || '',
    status: o.status || (r.direction === 'inbound' ? 'replied' : 'sent'), follow_up_at: o.follow_up_at || null, follow_up_done_at: o.follow_up_done_at || null, replied_at: o.replied_at || null,
    source: o.source || 'legacy', by: m.by_name || null, package_title: m.package_title || null, package_id: m.package_id || null,
    contact: contact ? { id: contact.id, name: contact.display_name, email: contact.email || '' } : null,
    company: company ? { id: company.id, name: company.name } : null
  };
}

export const handler = async event => {
  if (!['GET', 'POST'].includes(event.httpMethod)) return json(405, { error: 'Method not allowed' });
  try {
    const { user, client } = await requireUser(event);
    const body = event.httpMethod === 'POST' ? parseBody(event) : {}, p = event.queryStringParameters || {};
    const { organization } = await requireStaffOrganization({ user, client, organizationSlug: body.organization_slug || p.organization || 'maison-de-veux' });
    const orgId = organization.id;

    if (event.httpMethod === 'POST') {
      const admin = await requireWrite(user.id, orgId), action = clean(body.action);

      /* log one touch; lock the person in (find or create the contact, and the company when named) */
      if (action === 'log') {
        const channel = channelOf(body.channel);
        let contactId = clean(body.contact_id) || null, companyId = clean(body.company_id) || null;
        const made = { contact: false, company: false };
        let companyName = '', contactName = '';
        if (!companyId && body.new_company && clean(body.new_company.name)) {
          const r = await ensureCompany(admin, orgId, body.new_company);
          companyId = r.company.id; made.company = r.created; companyName = r.company.name;
        }
        if (!contactId && body.new_contact && (clean(body.new_contact.name) || clean(body.new_contact.display_name) || cleanEmail(body.new_contact.email))) {
          const r = await ensureContact(admin, orgId, { ...body.new_contact, company_id: companyId, source: 'outreach' });
          if (!r.contact) throw bad('Add a name or an email for the new contact.');
          contactId = r.contact.id; made.contact = r.created; contactName = r.contact.display_name;
          if (companyId && !r.created && !r.contact.company_id) {
            await admin.from('contacts').update({ company_id: companyId, updated_at: new Date().toISOString() }).eq('organization_id', orgId).eq('id', contactId);
            await linkContactToCompany(admin, orgId, contactId, companyId, null);
          }
        }
        if (contactId && companyId) {
          const c = await admin.from('contacts').select('company_id').eq('organization_id', orgId).eq('id', contactId).maybeSingle();
          if (c.data && !c.data.company_id) {
            await admin.from('contacts').update({ company_id: companyId, updated_at: new Date().toISOString() }).eq('organization_id', orgId).eq('id', contactId);
            await linkContactToCompany(admin, orgId, contactId, companyId, null);
          }
        }
        if (!contactId && !companyId) throw bad('Choose who this was to, or add a new contact or company.');
        const act = await recordOutreach(admin, {
          orgId, userId: user.id, userName: whoName(user), channel, direction: body.direction === 'inbound' ? 'inbound' : 'outbound',
          subject: body.subject, summary: body.summary, occurredAt: body.occurred_at, contactId, companyId,
          status: STATUSES.includes(body.status) ? body.status : 'sent', followUpAt: body.follow_up_at || null, source: 'manual',
          extra: { package_title: clean(body.package_title) || undefined, model_names: clean(body.model_names) || undefined }
        });
        return json(200, { ok: true, verified: true, activity: act, created_contact: made.contact, created_company: made.company, contact_name: contactName, company_name: companyName, contact_id: contactId, company_id: companyId });
      }

      /* change the status / follow-up / note on an entry */
      if (action === 'update') {
        const id = clean(body.id); if (!id) throw bad('id is required.');
        const cur = await admin.from('crm_activity').select('*').eq('organization_id', orgId).eq('id', id).maybeSingle();
        if (cur.error) throw cur.error; if (!cur.data) { const e = new Error('Entry not found.'); e.statusCode = 404; throw e; }
        const meta = { ...(cur.data.metadata || {}) }, o = { ...(meta.outreach || { channel: channelOf(cur.data.activity_type), source: 'legacy' }) };
        if (body.status != null) { if (!STATUSES.includes(body.status)) throw bad('Unknown status.'); o.status = body.status; if (body.status === 'replied' && !o.replied_at) o.replied_at = new Date().toISOString(); }
        if (Object.prototype.hasOwnProperty.call(body, 'follow_up_at')) { o.follow_up_at = body.follow_up_at || null; if (body.follow_up_at) o.follow_up_done_at = null; }
        if (body.follow_up_done === true) o.follow_up_done_at = new Date().toISOString();
        meta.outreach = o;
        const patch = { metadata: meta };
        if (body.summary != null) patch.summary = clean(body.summary) || null;
        const up = await admin.from('crm_activity').update(patch).eq('organization_id', orgId).eq('id', id).select('*').single();
        if (up.error) throw up.error;
        return json(200, { ok: true, verified: true, activity: up.data });
      }

      /* give an auto-captured contact a company */
      if (action === 'attach_company') {
        const contactId = clean(body.contact_id); if (!contactId) throw bad('contact_id is required.');
        let companyId = clean(body.company_id) || null, created = false, name = '';
        if (!companyId && clean(body.company_name)) { const r = await ensureCompany(admin, orgId, { name: body.company_name, company_type: body.company_type, website: body.website }); companyId = r.company.id; created = r.created; name = r.company.name; }
        if (!companyId) throw bad('Choose a company or type a name.');
        const up = await admin.from('contacts').update({ company_id: companyId, updated_at: new Date().toISOString() }).eq('organization_id', orgId).eq('id', contactId).select('id,display_name,company_id').single();
        if (up.error) throw up.error;
        await linkContactToCompany(admin, orgId, contactId, companyId, null);
        await admin.from('crm_activity').update({ company_id: companyId }).eq('organization_id', orgId).eq('contact_id', contactId).is('company_id', null);
        return json(200, { ok: true, verified: true, contact: up.data, company_id: companyId, created_company: created, company_name: name });
      }
      return json(400, { error: 'Unsupported outreach action' });
    }

    /* ---- the page ---- */
    const admin = await requirePermission(user.id, orgId, 'crm.read');
    const [acts, contacts, companies, recipients] = await Promise.all([
      optional(admin.from('crm_activity').select('*').eq('organization_id', orgId).order('occurred_at', { ascending: false }).limit(900), 'crm_activity'),
      optional(admin.from('contacts').select('id,display_name,email,phone,role,company_id,status,instagram,whatsapp,created_at,metadata').eq('organization_id', orgId).order('display_name').limit(1800), 'contacts'),
      optional(admin.from('companies').select('id,name,company_type,website,status').eq('organization_id', orgId).order('name').limit(900), 'companies'),
      optional(admin.from('package_recipients').select('*').eq('organization_id', orgId).not('sent_at', 'is', null).order('sent_at', { ascending: false }).limit(250), 'package_recipients')
    ]);
    const cm = new Map(companies.map(x => [x.id, x])), km = new Map(contacts.map(x => [x.id, x]));
    let list = acts.filter(isOutreach).map(r => shape(r, cm, km));

    /* packages that went out but were not written to the ledger (older sends) */
    if (recipients.length) {
      const pk = await optional(admin.from('packages').select('id,title').eq('organization_id', orgId).in('id', [...new Set(recipients.map(r => r.package_id).filter(Boolean))].slice(0, 200)), 'packages');
      const pm = new Map(pk.map(x => [x.id, x.title]));
      for (const r of recipients) {
        const t = new Date(r.sent_at).getTime(); if (!t) continue;
        const dup = list.some(x => x.channel === 'package' && Math.abs(new Date(x.at).getTime() - t) < 15 * 60000 && ((x.contact && x.contact.id === r.contact_id) || (x.company && x.company.id === r.company_id) || (x.contact && cleanEmail(x.contact.email) === cleanEmail(r.email))));
        if (dup) continue;
        const contact = r.contact_id ? km.get(r.contact_id) : null, company = r.company_id ? cm.get(r.company_id) : (contact && contact.company_id ? cm.get(contact.company_id) : null);
        list.push({ id: 'pkg:' + r.id, derived: true, at: r.sent_at, channel: 'package', direction: 'outbound', subject: pm.get(r.package_id) || 'Model package', summary: '', status: 'sent', follow_up_at: null, follow_up_done_at: null, replied_at: null, source: 'package', by: null, package_title: pm.get(r.package_id) || null, package_id: r.package_id || null, opened_at: r.last_opened_at || r.first_opened_at || r.opened_at || null, contact: contact ? { id: contact.id, name: contact.display_name, email: contact.email || '' } : { id: null, name: r.display_name || r.email || 'Recipient', email: r.email || '' }, company: company ? { id: company.id, name: company.name } : null });
      }
      list.sort((a, b) => new Date(b.at) - new Date(a.at));
    }

    /* who has been reached, and when */
    const stat = new Map();
    for (const e of list) {
      const key = e.contact && e.contact.id ? 'c:' + e.contact.id : e.company ? 'o:' + e.company.id : null; if (!key) continue;
      const s = stat.get(key) || { last_at: null, last_out: null, last_in: null, touches: 0, channel: null, follow_up_at: null };
      s.touches++;
      if (!s.last_at || e.at > s.last_at) { s.last_at = e.at; s.channel = e.channel; }
      if (e.direction === 'outbound' && (!s.last_out || e.at > s.last_out)) s.last_out = e.at;
      if ((e.direction === 'inbound' || e.status === 'replied') && (!s.last_in || e.at > s.last_in)) s.last_in = e.at;
      if (e.follow_up_at && !e.follow_up_done_at && (!s.follow_up_at || e.follow_up_at < s.follow_up_at)) s.follow_up_at = e.follow_up_at;
      stat.set(key, s);
    }
    const people = contacts.map(c => {
      const s = stat.get('c:' + c.id) || {}, co = c.company_id ? cm.get(c.company_id) : null;
      return { id: c.id, name: c.display_name, email: c.email || '', phone: c.phone || '', role: c.role || '', company_id: c.company_id || null, company_name: co ? co.name : '', last_at: s.last_at || null, last_channel: s.channel || null, touches: s.touches || 0, awaiting: !!(s.last_out && (!s.last_in || s.last_in < s.last_out)), follow_up_at: s.follow_up_at || null, auto: !!(c.metadata && (c.metadata.source === 'mail' || c.metadata.source === 'outreach' || c.metadata.source === 'package')), created_at: c.created_at || null };
    });
    const orgs = companies.map(c => { const s = stat.get('o:' + c.id) || {}; return { id: c.id, name: c.name, type: c.company_type || '', website: c.website || '' }; });
    return json(200, { ok: true, now: new Date().toISOString(), me: whoName(user), outreach: list.slice(0, 700), people, companies: orgs, channels: CHANNELS, statuses: STATUSES });
  } catch (error) { return errorResponse(error); }
};
