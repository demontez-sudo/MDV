/* The agency's activity and earnings: what its models worked on, the agency's commission, what has been paid, and a timeline.
   Only this agency's own data; client names stay with Maison de Veux. */
import { requireUser, json, errorResponse } from './_lib/auth.mjs';
import { requirePartnerPortal } from './_lib/portal-bridge.mjs';
import { loadActivityData, buildActivity } from './_lib/agency-activity.mjs';

export const handler = async event => {
  if (event.httpMethod !== 'GET') return json(405, { error: 'Method not allowed' });
  try {
    const { user } = await requireUser(event);
    const q = event.queryStringParameters || {}, slug = q.organization || 'maison-de-veux';
    const { admin, organization, partnerAgencyId } = await requirePartnerPortal({ user, organizationSlug: slug });
    const data = await loadActivityData(admin, organization.id, partnerAgencyId, { partnerView: true });
    return json(200, { ok: true, activity: buildActivity(data, { audience: 'agency', days: Number(q.days) }), warnings: data.warnings });
  } catch (error) { return errorResponse(error); }
};
