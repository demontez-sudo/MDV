import { requireUser, json, errorResponse } from './_lib/auth.mjs';
import { requireStaffOrganization, requirePermission } from './_lib/agent-bridge.mjs';

/* A light read of the interest calls scheduled in Scout Records, for Helm. (The full scouting desk also signs every photo, which is too slow for a calendar.) */
export const handler = async event => {
  if (event.httpMethod !== 'GET') return json(405, { error: 'Method not allowed' });
  try {
    const { user, client } = await requireUser(event), p = event.queryStringParameters || {};
    const { organization } = await requireStaffOrganization({ user, client, organizationSlug: p.organization || 'maison-de-veux' });
    const admin = await requirePermission(user.id, organization.id, 'scouting.read');
    const { data, error } = await admin.from('scouting_prospects').select('id,display_name,instagram,city,country,height_display,created_by,assigned_member_id,stage,metadata,updated_at').eq('organization_id', organization.id).order('updated_at', { ascending: false }).limit(800);
    if (error) throw error;
    const calls = (data || []).map(x => {
      const sc = x.metadata?.scout || {}, c = sc.call || {};
      /* same rule as the scout board: the record is at the interest-call step when its stage is meeting_scheduled (or the older test_requested) */
      if (!c.scheduled_at || !['meeting_scheduled', 'test_requested'].includes(String(x.stage || ''))) return null;
      const step = x.stage === 'test_requested' || String(sc.step || '').toLowerCase() === 'call_done' ? 'call_done' : 'call_scheduled';
      return { id: x.id, name: x.display_name, instagram: x.instagram || '', city: x.city || '', country: x.country || '', height: x.height_display || '', scheduled_at: c.scheduled_at, minutes: Number(c.minutes) || 30, channel: c.channel || '', link: c.link || '', host_member_id: c.host_member_id || null, assigned_member_id: x.assigned_member_id || null, created_by: x.created_by || null, step, confirm: c.confirm || {} };
    }).filter(Boolean);
    return json(200, { ok: true, calls });
  } catch (error) { return errorResponse(error); }
};
