import { requireUser, json, errorResponse } from './_lib/auth.mjs';
import { requireModelPortal } from './_lib/portal-bridge.mjs';
import { HANDBOOKS, handbooksFor } from './_lib/handbooks.mjs';

/* A private handbook, for the signed-in model it belongs to. Anyone else gets "not found", whether or not the id exists. */
export const handler = async event => {
  if (event.httpMethod !== 'GET') return json(405, { error: 'Method not allowed' }, { Allow: 'GET' });
  try {
    const { user } = await requireUser(event);
    const p = event.queryStringParameters || {};
    const { admin, organization, modelId } = await requireModelPortal({ user, organizationSlug: p.organization || 'maison-de-veux' });
    const { data: me, error } = await admin.from('models').select('display_name').eq('organization_id', organization.id).eq('id', modelId).maybeSingle();
    if (error) throw error;
    const id = String(p.id || '');
    const h = handbooksFor(me && me.display_name).find(x => x.id === id) || null;
    if (!h || !HANDBOOKS.includes(h)) return json(404, { error: 'This handbook is not available to you.' });
    return json(200, { ok: true, id: h.id, title: h.title, html: await h.load() }, { 'Cache-Control': 'private, no-store' });
  } catch (e) { return errorResponse(e); }
};
