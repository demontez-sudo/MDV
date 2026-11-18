/* The agency's roster in depth: each model placed with this mother agency, with availability, travel, visa, upcoming work, terms and what is outstanding.
   Only what the agency may see: travel, visa and work authorisation flagged visible to the partner, never passports or the private notes. */
import { requireUser, json, errorResponse } from './_lib/auth.mjs';
import { requirePartnerPortal } from './_lib/portal-bridge.mjs';
import { loadRosterData, buildRoster } from './_lib/agency-roster.mjs';

export const handler = async event => {
  if (event.httpMethod !== 'GET') return json(405, { error: 'Method not allowed' });
  try {
    const { user } = await requireUser(event);
    const slug = event.queryStringParameters?.organization || 'maison-de-veux';
    const { admin, organization, partnerAgencyId } = await requirePartnerPortal({ user, organizationSlug: slug });
    const data = await loadRosterData(admin, organization.id, partnerAgencyId, { partnerView: true });
    const { rows, summary } = buildRoster(data, { audience: 'agency' });
    return json(200, { ok: true, roster: rows, summary, warnings: data.warnings });
  } catch (error) { return errorResponse(error); }
};
