/* Mother Agencies, staff side: every mother agency with its profile, documents, models and portal access, and the controls that give an
   agency (or take away) the key to its Mother Agency portal at maisondeveux.com/ma.
   The agency's own profile lives on partner_agencies.metadata.profile (written from the MA portal); the access code is stored only as a
   salted scrypt hash in partner_agencies.metadata.access and is shown to staff once, when it is made. */
import crypto from 'node:crypto';
import { requireUser, parseBody, json, errorResponse } from './_lib/auth.mjs';
import { requireStaffOrganization, requirePermission } from './_lib/agent-bridge.mjs';

const TEXT = { tagline: 140, bio: 1800, city: 80, country: 80, website: 200, instagram: 80, founded_year: 4, contact_name: 120, contact_role: 120, contact_email: 160, contact_phone: 60, whatsapp: 60 };
const DOC_LABEL = { logo: 'Logo', contract: 'Agency agreement', licence: 'Business licence', id: 'Representative ID', other: 'Other' };
const REQUIRED_DOCS = ['contract', 'licence', 'id'];
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

const clean = (v, max) => String(v == null ? '' : v).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').trim().slice(0, max);
const fail = (message, statusCode = 400) => { const e = new Error(message); e.statusCode = statusCode; e.publicMessage = message; throw e; };
const bucketName = () => process.env.VEUX_PRIVATE_STORAGE_BUCKET || 'veux-private';
async function rows(q) { const { data, error } = await q; if (error) throw error; return data || []; }

function newCode() {
  const bytes = crypto.randomBytes(12);
  const chars = Array.from(bytes, b => CODE_CHARS[b % CODE_CHARS.length]).join('');
  return chars.slice(0, 4) + '-' + chars.slice(4, 8) + '-' + chars.slice(8, 12);
}
const normCode = v => String(v || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
function hashCode(code, salt) { return crypto.scryptSync(normCode(code), salt, 32).toString('hex'); }

function profileOf(p) { const x = (p.metadata && p.metadata.profile) || {}; return { fields: x.fields || {}, documents: Array.isArray(x.documents) ? x.documents : [], updated_at: x.updated_at || null }; }
function daysTo(d) { const t = d ? new Date(d + 'T12:00:00').getTime() : NaN; return Number.isFinite(t) ? Math.ceil((t - Date.now()) / 864e5) : null; }

/* the same 100-point rule the agency sees on its own page */
function assess(p, logo) {
  const { fields: f, documents } = profileOf(p);
  let score = 0; const missing = [];
  const add = (ok, pts, label) => { if (ok) score += pts; else missing.push(label); };
  add(!!logo, 10, 'logo'); add(!!f.tagline, 5, 'tagline'); add((f.bio || '').length >= 80, 15, 'about text'); add(!!(f.city && f.country), 10, 'location');
  add(!!f.website, 5, 'website'); add(!!f.instagram, 5, 'Instagram'); add(!!f.contact_name, 5, 'contact person'); add(!!f.contact_email, 10, 'contact email'); add(!!f.contact_phone, 5, 'contact phone');
  const docs = [];
  for (const t of REQUIRED_DOCS) {
    const have = documents.filter(d => d.type === t).sort((a, b) => String(b.uploaded_at).localeCompare(String(a.uploaded_at)))[0];
    const left = have && have.expires_on ? daysTo(have.expires_on) : null;
    if (have) score += 10; else missing.push(DOC_LABEL[t].toLowerCase());
    docs.push({ type: t, label: DOC_LABEL[t], on_file: !!have, expires_on: have ? have.expires_on || null : null, days_left: left, state: !have ? 'missing' : left != null && left < 0 ? 'expired' : left != null && left <= 60 ? 'expiring' : 'ok' });
  }
  return { score, missing, docs, expired: docs.filter(d => d.state === 'expired').length, expiring: docs.filter(d => d.state === 'expiring').length };
}

function accessOf(p) {
  const a = (p.metadata && p.metadata.access) || null;
  const locked = a && a.locked_until && new Date(a.locked_until).getTime() > Date.now();
  return { has_code: !!(a && a.hash), set_at: a ? a.set_at || null : null, last_login_at: a ? a.last_login_at || null : null, locked: !!locked, locked_until: locked ? a.locked_until : null, portal_enabled: p.portal_enabled !== false };
}

async function signedUrl(admin, doc, seconds) {
  try { const { data } = await admin.storage.from(doc.bucket || bucketName()).createSignedUrl(doc.path, seconds); return (data && data.signedUrl) || null; } catch (_e) { return null; }
}

async function loadAll(admin, orgId, onlyId) {
  let q = admin.from('partner_agencies').select('*').eq('organization_id', orgId).eq('partner_type', 'mother_agency');
  if (onlyId) q = q.eq('id', onlyId);
  const partners = await rows(q);
  const companyIds = [...new Set(partners.map(p => p.company_id).filter(Boolean))];
  const companies = companyIds.length ? await rows(admin.from('companies').select('id,name').eq('organization_id', orgId).in('id', companyIds)) : [];
  const cm = new Map(companies.map(c => [String(c.id), c]));
  const partnerIds = partners.map(p => p.id);
  const placements = partnerIds.length ? await rows(admin.from('model_placements').select('id,model_id,partner_agency_id,status,market_id,placement_type').eq('organization_id', orgId).in('partner_agency_id', partnerIds).in('status', ['active', 'pending', 'placed'])).catch(() => []) : [];
  return { partners, cm, placements };
}

function summarize(p, c, placements, signedLogo) {
  const prof = profileOf(p), logo = prof.documents.find(d => d.type === 'logo');
  const as = assess(p, logo);
  const mine = placements.filter(x => String(x.partner_agency_id) === String(p.id));
  const f = prof.fields;
  return {
    id: p.id, company_id: p.company_id, name: (c && c.name) || 'Mother agency',
    city: f.city || '', country: f.country || '',
    models: new Set(mine.map(x => x.model_id)).size,
    profile: { score: as.score, missing: as.missing, updated_at: prof.updated_at, tagline: f.tagline || '' },
    documents: as.docs, expired: as.expired, expiring: as.expiring,
    access: accessOf(p), logo_url: signedLogo || null,
  };
}

export const handler = async event => {
  if (!['GET', 'POST'].includes(event.httpMethod)) return json(405, { error: 'Method not allowed' });
  try {
    const { user, client } = await requireUser(event);
    const body = event.httpMethod === 'POST' ? parseBody(event) : {};
    const q = event.queryStringParameters || {};
    const { organization } = await requireStaffOrganization({ user, client, organizationSlug: body.organization_slug || q.organization || 'maison-de-veux' });

    if (event.httpMethod === 'GET') {
      const admin = await requirePermission(user.id, organization.id, 'crm.read');
      const { partners, cm, placements } = await loadAll(admin, organization.id, q.partner_id || null);
      if (q.partner_id) {
        const p = partners[0];
        if (!p) fail('Mother agency not found', 404);
        const c = cm.get(String(p.company_id)) || null, prof = profileOf(p);
        const logo = [...prof.documents].reverse().find(d => d.type === 'logo');
        const mine = placements.filter(x => String(x.partner_agency_id) === String(p.id));
        const ids = [...new Set(mine.map(x => x.model_id))];
        const models = ids.length ? await rows(admin.from('models').select('id,display_name,status').eq('organization_id', organization.id).in('id', ids)) : [];
        const media = ids.length ? await rows(admin.from('model_media').select('model_id,url,is_primary').eq('organization_id', organization.id).in('model_id', ids).eq('is_primary', true)).catch(() => []) : [];
        const marketIds = [...new Set(mine.map(x => x.market_id).filter(Boolean))];
        const markets = marketIds.length ? await rows(admin.from('markets').select('id,name').eq('organization_id', organization.id).in('id', marketIds)).catch(() => []) : [];
        const mk = new Map(markets.map(m => [String(m.id), m.name])), ph = new Map(media.map(m => [String(m.model_id), m.url]));
        return json(200, {
          ok: true,
          agency: { ...summarize(p, c, placements, logo ? await signedUrl(admin, logo, 3600) : null), fields: prof.fields, updated_at: prof.updated_at },
          documents: prof.documents.filter(d => d.type !== 'logo').map(d => ({ id: d.id, type: d.type, label: DOC_LABEL[d.type] || 'Document', name: d.name, expires_on: d.expires_on || null, uploaded_at: d.uploaded_at, days_left: d.expires_on ? daysTo(d.expires_on) : null })),
          models: models.map(m => { const pl = mine.find(x => String(x.model_id) === String(m.id)) || {}; return { id: m.id, name: m.display_name, status: pl.status || m.status || '', market: mk.get(String(pl.market_id)) || '', photo: ph.get(String(m.id)) || '' }; }),
        });
      }
      const list = [];
      for (const p of partners) {
        const prof = profileOf(p), logo = [...prof.documents].reverse().find(d => d.type === 'logo');
        list.push(summarize(p, cm.get(String(p.company_id)) || null, placements, logo ? await signedUrl(admin, logo, 3600) : null));
      }
      list.sort((a, b) => a.name.localeCompare(b.name));
      return json(200, { ok: true, agencies: list, portal_url: 'https://www.maisondeveux.com/ma' });
    }

    const action = String(body.action || '');

    if (action === 'create') {
      const admin = await requirePermission(user.id, organization.id, 'crm.write');
      const name = clean(body.name, 120);
      if (name.length < 2) fail('Enter the agency name.');
      let company = (await rows(admin.from('companies').select('id,name').eq('organization_id', organization.id).ilike('name', name.replace(/[%_]/g, m => '\\' + m)).limit(1)))[0];
      if (!company) {
        const ins = await admin.from('companies').insert({ organization_id: organization.id, legacy_id: 'partner-' + name.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 48), name, company_type: 'agency', status: 'active', notes: 'Mother Agency' }).select('id,name').single();
        if (ins.error) throw ins.error; company = ins.data;
      }
      let partner = (await rows(admin.from('partner_agencies').select('*').eq('organization_id', organization.id).eq('company_id', company.id).limit(1)))[0];
      if (!partner) {
        const up = await admin.from('partner_agencies').insert({ organization_id: organization.id, company_id: company.id, partner_type: 'mother_agency', portal_enabled: true, notes: 'Mother Agency portal' }).select('*').single();
        if (up.error) throw up.error; partner = up.data;
      }
      const f = {};
      for (const k of ['city', 'country', 'contact_name', 'contact_email']) if (body[k]) f[k] = clean(body[k], TEXT[k]);
      if (f.contact_email && !EMAIL.test(f.contact_email)) fail('Enter a valid contact email.');
      if (Object.keys(f).length) {
        const prof = profileOf(partner);
        await admin.from('partner_agencies').update({ metadata: { ...(partner.metadata || {}), profile: { ...(partner.metadata?.profile || {}), fields: { ...prof.fields, ...f }, documents: prof.documents, updated_at: new Date().toISOString() } } }).eq('id', partner.id).eq('organization_id', organization.id);
      }
      return json(201, { ok: true, partner_id: partner.id });
    }

    const partnerId = String(body.partner_id || '');
    if (!partnerId) fail('partner_id is required');

    if (action === 'set_access' || action === 'clear_access' || action === 'set_portal') {
      const admin = await requirePermission(user.id, organization.id, 'members.manage');
      const p = (await rows(admin.from('partner_agencies').select('*').eq('organization_id', organization.id).eq('id', partnerId).limit(1)))[0];
      if (!p) fail('Mother agency not found', 404);
      const meta = { ...(p.metadata || {}) };
      const patch = {};
      let code = null;
      if (action === 'set_access') {
        code = newCode();
        const salt = crypto.randomBytes(16).toString('hex');
        meta.access = { algo: 'scrypt', salt, hash: hashCode(code, salt), set_at: new Date().toISOString(), set_by: user.id, fail_count: 0, locked_until: null, last_login_at: (p.metadata?.access || {}).last_login_at || null };
        patch.portal_enabled = true;
      } else if (action === 'clear_access') {
        delete meta.access;
      } else {
        patch.portal_enabled = body.enabled !== false;
      }
      patch.metadata = meta;
      const { error } = await admin.from('partner_agencies').update(patch).eq('organization_id', organization.id).eq('id', partnerId);
      if (error) throw error;
      const { partners, cm, placements } = await loadAll(admin, organization.id, partnerId);
      const co = cm.get(String(partners[0].company_id)) || null;
      return json(200, { ok: true, verified: true, code, agency_name: (co && co.name) || null, portal_url: 'https://www.maisondeveux.com/ma', agency: summarize(partners[0], co, placements, null) });
    }

    if (action === 'save_profile') {
      const admin = await requirePermission(user.id, organization.id, 'crm.write');
      const p = (await rows(admin.from('partner_agencies').select('*').eq('organization_id', organization.id).eq('id', partnerId).limit(1)))[0];
      if (!p) fail('Mother agency not found', 404);
      const prof = profileOf(p), incoming = body.profile && typeof body.profile === 'object' ? body.profile : {};
      const fields = { ...prof.fields };
      for (const [k, max] of Object.entries(TEXT)) if (incoming[k] !== undefined) fields[k] = clean(incoming[k], max);
      if (fields.contact_email && !EMAIL.test(fields.contact_email)) fail('Enter a valid contact email.');
      if (fields.website && !/^https?:\/\//i.test(fields.website)) fields.website = 'https://' + fields.website;
      const { error } = await admin.from('partner_agencies').update({ metadata: { ...(p.metadata || {}), profile: { ...(p.metadata?.profile || {}), fields, documents: prof.documents, updated_at: new Date().toISOString() } } }).eq('organization_id', organization.id).eq('id', partnerId);
      if (error) throw error;
      return json(200, { ok: true, verified: true });
    }

    if (action === 'download_url') {
      const admin = await requirePermission(user.id, organization.id, 'crm.read');
      const p = (await rows(admin.from('partner_agencies').select('metadata').eq('organization_id', organization.id).eq('id', partnerId).limit(1)))[0];
      const doc = p && profileOf(p).documents.find(d => d.id === body.document_id);
      if (!doc) fail('Document not found', 404);
      const url = await signedUrl(admin, doc, 300);
      if (!url) fail('That file is not available right now.', 409);
      return json(200, { ok: true, url, name: doc.name, expires_in: 300 });
    }

    return json(400, { error: 'Unsupported action' });
  } catch (error) { return errorResponse(error); }
};
