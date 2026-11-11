import crypto from 'node:crypto';
import { requireUser, parseBody, json, errorResponse } from './_lib/auth.mjs';
import { requireModelPortal } from './_lib/portal-bridge.mjs';

// Skin & Walks: a model creates a submission, uploads photos (skin) or videos (walks), and can withdraw it.
// Files go straight to private storage with a signed upload link; the agency reviews them in the agent portal.

const TABLE = 'model_development_submissions';
const TYPES = new Set(['skin', 'walk']);
const OPEN_STATUSES = new Set(['pending', 'changes_requested']);
const LIMITS = { skin: 6, walk: 2 };
const MIME = { skin: /^image\/(jpeg|png|webp)$/i, walk: /^video\/(mp4|quicktime|webm)$/i };
const ROLES = new Set(['front', 'left_profile', 'right_profile', 'close_up', 'detail', 'additional', 'walk_video', 'walk_video_2']);

const fail = (statusCode, message) => { const e = new Error(message); e.statusCode = statusCode; e.publicMessage = message; return e; };
const cleanName = (name) => String(name || 'file').normalize('NFKD').replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/-+/g, '-').slice(-120) || 'file';
const missingTable = (error) => /relation .* does not exist|could not find the table|schema cache/i.test(String(error?.message || ''));

async function loadSubmission(admin, organization, modelId, id) {
  if (!id) throw fail(400, 'submission_id is required');
  const { data, error } = await admin.from(TABLE).select('*').eq('organization_id', organization.id).eq('model_id', modelId).eq('id', id).maybeSingle();
  if (error) throw error;
  if (!data) throw fail(404, 'Submission not found');
  return data;
}

async function create({ admin, organization, modelId, user, body }) {
  const type = String(body.submission_type || '').toLowerCase();
  if (!TYPES.has(type)) throw fail(400, 'Choose Skin or Model Walk.');
  const note = String(body.model_note || '').trim().slice(0, 2000) || null;
  const base = { organization_id: organization.id, model_id: modelId, submission_type: type, status: 'pending', model_note: note };
  // Try with the extra audit fields first; fall back to the core columns if this table does not have them.
  let r = await admin.from(TABLE).insert({ ...base, submitted_by: user.id, timezone: String(body.timezone || '').slice(0, 64) || null }).select('*').single();
  if (r.error && !missingTable(r.error)) r = await admin.from(TABLE).insert(base).select('*').single();
  if (r.error) {
    if (missingTable(r.error)) throw fail(503, 'Skin & Walks is not set up yet. Please tell your agent.');
    throw r.error;
  }
  return json(201, { ok: true, verified: true, submission: r.data, persisted_at: r.data.created_at || new Date().toISOString() });
}

async function prepareUpload({ admin, organization, modelId, user, body }) {
  const sub = await loadSubmission(admin, organization, modelId, body.submission_id);
  if (!OPEN_STATUSES.has(sub.status)) throw fail(409, 'This submission is closed. Start a new one.');
  const type = sub.submission_type;
  if (!body.name) throw fail(400, 'File name is required');
  const mime = String(body.mime_type || '');
  if (!MIME[type]?.test(mime)) throw fail(400, type === 'skin' ? 'Skin photos must be JPG, PNG or WEBP.' : 'Walks must be MP4, MOV or WEBM video.');
  const max = Number(process.env.VEUX_MODEL_PORTAL_UPLOAD_MAX_BYTES || 52428800);
  const size = body.size_bytes == null ? null : Number(body.size_bytes);
  if (size != null && (!Number.isFinite(size) || size < 0 || size > max)) throw fail(400, `Each file must be under ${Math.round(max / 1048576)} MB.`);
  const role = ROLES.has(String(body.file_role || '')) ? String(body.file_role) : (type === 'skin' ? 'additional' : 'walk_video');

  const { data: used, error: usedError } = await admin.from('storage_upload_sessions').select('id,status')
    .eq('organization_id', organization.id).eq('resource_type', 'model').eq('resource_id', modelId)
    .contains('metadata', { development_submission_id: sub.id }).in('status', ['created', 'finalized']);
  if (usedError) throw usedError;
  const finalized = (used || []).filter(x => x.status === 'finalized').length;
  if (finalized >= LIMITS[type]) throw fail(409, `This submission already has the maximum of ${LIMITS[type]} files.`);

  const bucket = process.env.VEUX_PRIVATE_STORAGE_BUCKET || 'veux-private';
  const path = `${organization.id}/development-submissions/${modelId}/${sub.id}/${crypto.randomUUID()}-${cleanName(body.name)}`;
  const { data: signed, error: signError } = await admin.storage.from(bucket).createSignedUploadUrl(path, { upsert: false });
  if (signError) throw signError;
  // Same resource type as the portal's other uploads (known to finalize correctly); the submission id rides in metadata.
  const { data: session, error } = await admin.from('storage_upload_sessions').insert({
    organization_id: organization.id, requested_by: user.id, bucket, storage_path: path, original_name: body.name, mime_type: mime, size_bytes: size,
    category: `model_development_${type}`, visibility: 'model_shared', resource_type: 'model', resource_id: modelId, visible_to_model: true, visible_to_partner: false,
    metadata: { development_submission_id: sub.id, file_role: role }
  }).select('*').single();
  if (error) throw error;
  return json(201, { ok: true, verified: true, upload_session_id: session.id, bucket, path, token: signed.token || null, signed_url: signed.signedUrl || signed.signedURL || null, expires_at: session.expires_at, file_role: role });
}

async function finalizeUpload({ admin, organization, modelId, user, body }) {
  const sub = await loadSubmission(admin, organization, modelId, body.submission_id);
  if (!body.upload_session_id) throw fail(400, 'upload_session_id is required');
  const { data: s, error } = await admin.from('storage_upload_sessions').select('*').eq('id', body.upload_session_id).maybeSingle();
  if (error) throw error;
  if (!s || s.organization_id !== organization.id || s.requested_by !== user.id || s.resource_id !== modelId || s.metadata?.development_submission_id !== sub.id) throw fail(403, 'You cannot finalize this upload.');
  const role = String(s.metadata?.file_role || body.file_role || 'additional');
  let docId = s.finalized_document_id || null, document = null;
  if (!(s.status === 'finalized' && docId)) {
    if (s.status !== 'created' || new Date(s.expires_at).getTime() < Date.now()) throw fail(409, 'The upload expired. Please try the file again.');
    const slash = s.storage_path.lastIndexOf('/'), folder = s.storage_path.slice(0, slash), filename = s.storage_path.slice(slash + 1);
    const { data: objects, error: listError } = await admin.storage.from(s.bucket).list(folder, { search: filename, limit: 10 });
    if (listError) throw listError;
    if (!(objects || []).some(x => x.name === filename)) throw fail(409, 'The file did not finish uploading. Please try again.');
    const { data: saved, error: rpcError } = await admin.rpc('finalize_document_upload_v1', { target_session: s.id, target_user: user.id, target_relationship: role, target_metadata: { development_submission_id: sub.id, file_role: role } });
    if (rpcError) throw rpcError;
    if (!saved?.verified || !saved?.document) throw fail(500, 'The file could not be verified.');
    document = saved.document; docId = document.id;
  }
  // Attach the document to the submission so the agency sees it on the review page.
  const { data: existing, error: linkReadError } = await admin.from('document_links').select('id').eq('organization_id', organization.id).eq('document_id', docId).eq('resource_type', 'development_submission').eq('resource_id', sub.id).maybeSingle();
  if (linkReadError) throw linkReadError;
  if (!existing) {
    const row = { organization_id: organization.id, document_id: docId, resource_type: 'development_submission', resource_id: sub.id, relationship: role };
    let r = await admin.from('document_links').insert({ ...row, created_by: user.id });
    if (r.error) r = await admin.from('document_links').insert(row);
    if (r.error) throw r.error;
  }
  if (sub.status === 'changes_requested') await admin.from(TABLE).update({ status: 'pending', updated_at: new Date().toISOString() }).eq('id', sub.id);
  return json(200, { ok: true, verified: true, document_id: docId, file_role: role, persisted_at: new Date().toISOString() });
}

async function withdraw({ admin, organization, modelId, body }) {
  const sub = await loadSubmission(admin, organization, modelId, body.submission_id);
  if (!OPEN_STATUSES.has(sub.status)) throw fail(409, sub.status === 'approved' ? 'An approved submission cannot be withdrawn.' : 'This submission is already closed.');
  const { data, error } = await admin.from(TABLE).update({ status: 'withdrawn', updated_at: new Date().toISOString() }).eq('id', sub.id).select('*').single();
  if (error) throw fail(409, 'This submission could not be withdrawn. Ask your agent to close it.');
  return json(200, { ok: true, verified: true, submission: data });
}

const ACTIONS = { create, prepare_upload: prepareUpload, finalize_upload: finalizeUpload, withdraw };

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });
  try {
    const { user } = await requireUser(event);
    const body = parseBody(event);
    const run = ACTIONS[String(body.action || '')];
    if (!run) return json(400, { error: 'Unsupported submission action' });
    const { admin, organization, modelId } = await requireModelPortal({ user, organizationSlug: body.organization_slug || 'maison-de-veux' });
    return await run({ admin, organization, modelId, user, body });
  } catch (error) { return errorResponse(error); }
};

export const __test = { create, prepareUpload, finalizeUpload, withdraw };
