import { adminClient, assertPermission } from './auth.mjs';

export function uuidish(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ''));
}

export function legacyKey(value) {
  const s = String(value || '').trim();
  return s || null;
}

export async function requireStaffOrganization({ user, client, organizationId = null, organizationSlug = null }) {
  // A valid authenticated JWT proves ownership of the invited Auth user.
  // Use the server-side client for the first membership lookup because RLS
  // deliberately hides organizations from memberships still marked "invited".
  const admin = adminClient();
  let org = null;
  if (organizationId) {
    const { data, error } = await admin.from('organizations').select('*').eq('id', organizationId).maybeSingle();
    if (error) throw error;
    org = data;
  } else {
    const slug = organizationSlug || 'maison-de-veux';
    const { data, error } = await admin.from('organizations').select('*').eq('slug', slug).maybeSingle();
    if (error) throw error;
    org = data;
  }
  if (!org) {
    const err = new Error('Agency not found or unavailable to this account'); err.statusCode = 404; throw err;
  }

  const { data: pendingMember, error: memberError } = await admin.from('organization_members')
    .select('*')
    .eq('organization_id', org.id)
    .eq('user_id', user.id)
    .eq('member_type', 'staff')
    .in('status', ['active','invited'])
    .maybeSingle();
  if (memberError) throw memberError;
  if (!pendingMember) {
    const err = new Error('This account does not have staff access to this agency'); err.statusCode = 403; throw err;
  }

  let member = pendingMember;
  if (pendingMember.status === 'invited') {
    const { data: activated, error: activationError } = await admin.from('organization_members')
      .update({
        status: 'active',
        joined_at: pendingMember.joined_at || new Date().toISOString(),
        last_seen_at: new Date().toISOString()
      })
      .eq('id', pendingMember.id)
      .eq('user_id', user.id)
      .select('*')
      .single();
    if (activationError) throw activationError;
    member = activated;
  }

  return { organization: org, member };
}

export async function requirePermission(userId, organizationId, permissionKey) {
  const admin = adminClient();
  const ok = await assertPermission(admin, userId, organizationId, permissionKey);
  if (!ok) {
    const err = new Error(`Missing permission: ${permissionKey}`); err.statusCode = 403; throw err;
  }
  return admin;
}

export function normalizeStatus(status, allowed, fallback) {
  const value = String(status || '').toLowerCase().replace(/\s+/g, '_');
  return allowed.includes(value) ? value : fallback;
}

export function isoFromLegacy(date, time, fallbackTimezone = 'America/New_York') {
  if (!date) return null;
  if (/T/.test(String(date))) {
    const d = new Date(date);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }
  const rawTime = String(time || '').trim();
  if (!rawTime) return `${date}T12:00:00.000Z`;
  const m = rawTime.match(/^(\d{1,2}):(\d{2})(?:\s*(AM|PM))?$/i);
  if (!m) return `${date}T12:00:00.000Z`;
  let hour = Number(m[1]); const minute = Number(m[2]); const ap = (m[3] || '').toUpperCase();
  if (ap === 'PM' && hour < 12) hour += 12;
  if (ap === 'AM' && hour === 12) hour = 0;
  // The legacy portal stores wall-clock text without an offset. During bridge
  // migration we preserve the wall clock in UTC and also retain the source
  // timezone in metadata; later writes from Booking Engine 2.0 use true offsets.
  return `${date}T${String(hour).padStart(2,'0')}:${String(minute).padStart(2,'0')}:00.000Z`;
}

export async function findCompany(admin, organizationId, value) {
  if (!value) return null;
  if (uuidish(value)) {
    const { data } = await admin.from('companies').select('id').eq('organization_id', organizationId).eq('id', value).maybeSingle();
    if (data) return data.id;
  }
  const { data } = await admin.from('companies').select('id').eq('organization_id', organizationId).eq('legacy_id', String(value)).maybeSingle();
  return data?.id || null;
}

export async function findContact(admin, organizationId, value) {
  if (!value) return null;
  if (uuidish(value)) {
    const { data } = await admin.from('contacts').select('id').eq('organization_id', organizationId).eq('id', value).maybeSingle();
    if (data) return data.id;
  }
  const { data } = await admin.from('contacts').select('id').eq('organization_id', organizationId).eq('legacy_id', String(value)).maybeSingle();
  return data?.id || null;
}

export async function findModel(admin, organizationId, value) {
  if (!value) return null;
  if (uuidish(value)) {
    const { data } = await admin.from('models').select('id,legacy_key,display_name').eq('organization_id', organizationId).eq('id', value).maybeSingle();
    if (data) return data;
  }
  const { data } = await admin.from('models').select('id,legacy_key,display_name').eq('organization_id', organizationId).eq('legacy_key', String(value)).maybeSingle();
  return data || null;
}

export async function findMember(admin, organizationId, value) {
  if (!value) return null;
  if (uuidish(value)) {
    const { data } = await admin.from('organization_members').select('id,user_id,metadata').eq('organization_id', organizationId).eq('id', value).maybeSingle();
    if (data) return data;
  }
  const { data: rows, error } = await admin.from('organization_members').select('id,user_id,metadata').eq('organization_id', organizationId).eq('member_type','staff').eq('status','active');
  if (error) throw error;
  return (rows || []).find(row => (row.metadata?.legacy_staff_key || row.metadata?.legacy_key) === value) || null;
}
