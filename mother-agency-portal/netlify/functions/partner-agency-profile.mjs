/* The Mother Agency's own profile: details, logo and agency documents.
   Stored on the partner agency record (partner_agencies.metadata.profile), so it needs no new table.
   Files go to the private bucket under <org>/partner/<agency>/agency/ and are only ever handed back as short-lived signed links. */
import crypto from 'node:crypto';
import { requireUser, parseBody, json, errorResponse } from './_lib/auth.mjs';
import { requirePartnerPortal } from './_lib/portal-bridge.mjs';

const TEXT = { tagline: 140, bio: 1800, city: 80, country: 80, website: 200, instagram: 80, founded_year: 4, contact_name: 120, contact_role: 120, contact_email: 160, contact_phone: 60, whatsapp: 60 };
const DOC_TYPES = { logo: 'Logo', contract: 'Agency agreement', licence: 'Business licence', id: 'Representative ID', other: 'Other' };
const ALLOWED = /^(image\/(jpeg|png|webp)|application\/pdf)$/i;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const clean = (v, max) => String(v == null ? '' : v).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').trim().slice(0, max);
const cleanName = name => String(name || 'file').normalize('NFKD').replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/-+/g, '-').slice(-100) || 'file';
const fail = (message, statusCode = 400) => { const e = new Error(message); e.statusCode = statusCode; e.publicMessage = message; throw e; };
const bucketName = () => process.env.VEUX_PRIVATE_STORAGE_BUCKET || 'veux-private';

function readProfile(partner) {
  const p = (partner.metadata && partner.metadata.profile) || {};
  return { fields: p.fields && typeof p.fields === 'object' ? p.fields : {}, documents: Array.isArray(p.documents) ? p.documents : [], updated_at: p.updated_at || null };
}

async function writeProfile(admin, org, partner, profile) {
  const metadata = { ...(partner.metadata || {}), profile: { ...profile, updated_at: new Date().toISOString() } };
  const { data, error } = await admin.from('partner_agencies').update({ metadata }).eq('organization_id', org.id).eq('id', partner.id).select('id,metadata').single();
  if (error) throw error;
  return data;
}

async function signed(admin, doc, seconds) {
  try {
    const { data } = await admin.storage.from(doc.bucket || bucketName()).createSignedUrl(doc.path, seconds);
    return (data && data.signedUrl) || null;
  } catch (_e) { return null; }
}

async function view(admin, org, partner, company) {
  const profile = readProfile(partner);
  const documents = profile.documents.map(d => ({ id: d.id, type: d.type, label: DOC_TYPES[d.type] || 'Document', name: d.name, mime: d.mime, size: d.size, expires_on: d.expires_on || null, uploaded_at: d.uploaded_at }));
  const logoDoc = [...profile.documents].reverse().find(d => d.type === 'logo');
  return {
    ok: true,
    agency: { id: partner.id, name: (company && company.name) || null, partner_type: partner.partner_type, portal_enabled: partner.portal_enabled !== false },
    profile: profile.fields,
    documents: documents.filter(d => d.type !== 'logo'),
    logo_url: logoDoc ? await signed(admin, logoDoc, 3600) : null,
    logo_id: logoDoc ? logoDoc.id : null,
    updated_at: profile.updated_at,
  };
}

export const handler = async event => {
  if (!['GET', 'POST'].includes(event.httpMethod)) return json(405, { error: 'Method not allowed' });
  try {
    const { user } = await requireUser(event);
    const body = event.httpMethod === 'POST' ? parseBody(event) : {};
    const slug = body.organization_slug || event.queryStringParameters?.organization || 'maison-de-veux';
    const { admin, organization, partnerAgencyId } = await requirePartnerPortal({ user, organizationSlug: slug });

    const { data: partner, error: pe } = await admin.from('partner_agencies').select('*').eq('organization_id', organization.id).eq('id', partnerAgencyId).maybeSingle();
    if (pe) throw pe;
    if (!partner) fail('Partner agency profile was not found', 404);
    let company = null;
    if (partner.company_id) {
      const { data } = await admin.from('companies').select('id,name').eq('organization_id', organization.id).eq('id', partner.company_id).maybeSingle();
      company = data || null;
    }

    if (event.httpMethod === 'GET') return json(200, await view(admin, organization, partner, company));

    const action = String(body.action || '');
    const profile = readProfile(partner);
    const prefix = `${organization.id}/partner/${partner.id}/agency/`;

    if (action === 'save') {
      const incoming = body.profile && typeof body.profile === 'object' ? body.profile : {};
      const fields = { ...profile.fields };
      for (const [k, max] of Object.entries(TEXT)) if (incoming[k] !== undefined) fields[k] = clean(incoming[k], max);
      if (fields.contact_email && !EMAIL.test(fields.contact_email)) fail('Enter a valid contact email.');
      if (fields.founded_year && !/^(18|19|20)\d{2}$/.test(fields.founded_year)) fail('Enter the year as four digits, for example 2012.');
      if (fields.website && !/^https?:\/\//i.test(fields.website)) fields.website = 'https://' + fields.website;
      const saved = await writeProfile(admin, organization, partner, { ...profile, fields });
      return json(200, await view(admin, organization, { ...partner, metadata: saved.metadata }, company));
    }

    if (action === 'upload_url') {
      const type = String(body.type || 'other');
      if (!DOC_TYPES[type]) fail('Unknown document type.');
      const mime = String(body.mime_type || '');
      if (!ALLOWED.test(mime)) fail('Upload a PDF, JPG, PNG or WebP file.');
      if (type === 'logo' && !/^image\//i.test(mime)) fail('The logo must be an image (JPG, PNG or WebP).');
      const max = Number(process.env.VEUX_PRIVATE_FILE_MAX_BYTES || 52428800), size = Number(body.size_bytes || 0);
      if (!Number.isFinite(size) || size < 0 || size > max) fail(`File exceeds the ${Math.round(max / 1048576)} MB limit.`);
      const path = `${prefix}${type}/${new Date().toISOString().slice(0, 10)}-${crypto.randomUUID().slice(0, 8)}-${cleanName(body.name)}`;
      const { data, error } = await admin.storage.from(bucketName()).createSignedUploadUrl(path, { upsert: false });
      if (error) throw error;
      return json(201, { ok: true, bucket: bucketName(), path, token: data.token || null, signed_url: data.signedUrl || data.signedURL || null });
    }

    if (action === 'finalize') {
      const type = String(body.type || 'other'), path = String(body.path || '');
      if (!DOC_TYPES[type]) fail('Unknown document type.');
      if (!path.startsWith(prefix + type + '/')) fail('That upload does not belong to your agency.', 403);
      const slash = path.lastIndexOf('/');
      const { data: objects, error: le } = await admin.storage.from(bucketName()).list(path.slice(0, slash), { search: path.slice(slash + 1), limit: 5 });
      if (le) throw le;
      if (!(objects || []).some(o => o.name === path.slice(slash + 1))) fail('The file did not finish uploading. Try again.', 409);
      const expires = clean(body.expires_on, 10);
      if (expires && !/^\d{4}-\d{2}-\d{2}$/.test(expires)) fail('Enter the expiry date as a valid date.');
      const doc = { id: crypto.randomUUID(), type, name: clean(body.name, 160) || 'File', bucket: bucketName(), path, mime: clean(body.mime_type, 80), size: Number(body.size_bytes) || null, expires_on: expires || null, uploaded_at: new Date().toISOString(), uploaded_by: user.id };
      let documents = [...profile.documents, doc];
      let replaced = [];
      if (type === 'logo') { replaced = documents.filter(d => d.type === 'logo' && d.id !== doc.id); documents = documents.filter(d => d.type !== 'logo' || d.id === doc.id); }
      const saved = await writeProfile(admin, organization, partner, { ...profile, documents });
      if (replaced.length) await admin.storage.from(bucketName()).remove(replaced.map(d => d.path)).catch(() => {});
      return json(201, await view(admin, organization, { ...partner, metadata: saved.metadata }, company));
    }

    if (action === 'set_expiry') {
      const expires = clean(body.expires_on, 10);
      if (expires && !/^\d{4}-\d{2}-\d{2}$/.test(expires)) fail('Enter the expiry date as a valid date.');
      const documents = profile.documents.map(d => d.id === body.document_id ? { ...d, expires_on: expires || null } : d);
      if (!documents.some(d => d.id === body.document_id)) fail('Document not found.', 404);
      const saved = await writeProfile(admin, organization, partner, { ...profile, documents });
      return json(200, await view(admin, organization, { ...partner, metadata: saved.metadata }, company));
    }

    if (action === 'remove_document') {
      const doc = profile.documents.find(d => d.id === body.document_id);
      if (!doc) fail('Document not found.', 404);
      const saved = await writeProfile(admin, organization, partner, { ...profile, documents: profile.documents.filter(d => d.id !== doc.id) });
      await admin.storage.from(doc.bucket || bucketName()).remove([doc.path]).catch(() => {});
      return json(200, await view(admin, organization, { ...partner, metadata: saved.metadata }, company));
    }

    if (action === 'download_url') {
      const doc = profile.documents.find(d => d.id === body.document_id);
      if (!doc) fail('Document not found.', 404);
      const url = await signed(admin, doc, 300);
      if (!url) fail('That file is not available right now.', 409);
      return json(200, { ok: true, url, name: doc.name, expires_in: 300 });
    }

    return json(400, { error: 'Unsupported action' });
  } catch (error) { return errorResponse(error); }
};
