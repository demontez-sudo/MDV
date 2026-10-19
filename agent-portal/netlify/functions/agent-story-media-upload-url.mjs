import crypto from 'node:crypto';
import { requireUser, adminClient, parseBody, json, errorResponse, assertPermission } from './_lib/auth.mjs';
import { requireStaffOrganization } from './_lib/agent-bridge.mjs';

const clean = v => String(v || 'photo').normalize('NFKD').replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/-+/g, '-').slice(-100) || 'photo';
const MAX = Number(process.env.VEUX_STORY_PHOTO_MAX_BYTES || 25 * 1048576);

/* Photos for blog stories: signs a one-time upload into the public bucket so the story can show the image on the New York and Paris blogs. */
export const handler = async event => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });
  try {
    const { user, client } = await requireUser(event), body = parseBody(event);
    const { organization } = await requireStaffOrganization({ user, client, organizationSlug: body.organization_slug || 'maison-de-veux' });
    const admin = adminClient();
    const allowed = (await assertPermission(admin, user.id, organization.id, 'crm.write')) || (await assertPermission(admin, user.id, organization.id, 'communications.send'));
    if (!allowed) return json(403, { error: 'Editorial publishing permission required' });
    if (!body.name) return json(400, { error: 'name is required' });
    const mime = String(body.mime_type || '');
    if (!/^image\/(jpeg|png|webp|gif)$/i.test(mime)) return json(400, { error: 'Use a JPG, PNG, WEBP or GIF photo.' });
    const size = body.size_bytes == null ? null : Number(body.size_bytes);
    if (size != null && (!Number.isFinite(size) || size < 0 || size > MAX)) return json(400, { error: `Photos must be ${Math.round(MAX / 1048576)} MB or smaller.` });
    const bucket = 'veux-public', path = `${organization.id}/editorial/${crypto.randomUUID()}-${clean(body.name)}`;
    const { data, error } = await admin.storage.from(bucket).createSignedUploadUrl(path, { upsert: false });
    if (error) throw error;
    const pub = admin.storage.from(bucket).getPublicUrl(path).data.publicUrl;
    return json(201, { ok: true, signed_url: data.signedUrl || data.signedURL, bucket, path, public_url: pub });
  } catch (error) { return errorResponse(error); }
};
