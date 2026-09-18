import { createClient } from '@supabase/supabase-js';

const PROD_SUPABASE_URL = 'https://mogyngdhmzbjmcdqeoxu.supabase.co';
const PROD_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_6fTsGxRRIDzjXaoUrT0XOg_yZWu21ql';

function cleanSecret(value) {
  const v = String(value || '').trim();
  if (!v) return '';
  if ((v.startsWith('\"') && v.endsWith('\"')) || (v.startsWith("'") && v.endsWith("'"))) {
    return v.slice(1, -1).trim();
  }
  return v;
}

function env(name) {
  const value = cleanSecret(process.env[name]);
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}

export function serverKeyInfo() {
  const candidates = [
    ['VEUX_SUPABASE_SERVICE_ROLE_KEY', process.env.VEUX_SUPABASE_SERVICE_ROLE_KEY],
    ['VEUX_SUPABASE_SECRET_KEY', process.env.VEUX_SUPABASE_SECRET_KEY],
    ['SUPABASE_SECRET_KEY', process.env.SUPABASE_SECRET_KEY],
    ['SUPABASE_SERVICE_ROLE_KEY', process.env.SUPABASE_SERVICE_ROLE_KEY]
  ];
  for (const [name, raw] of candidates) {
    const value = cleanSecret(raw);
    if (!value) continue;
    const format = value.startsWith('sb_secret_') ? 'modern-secret' :
      value.split('.').length === 3 ? 'legacy-jwt' : 'unknown';
    return { name, value, format, had_outer_whitespace: String(raw || '') !== String(raw || '').trim(), had_wrapping_quotes: /^[\"'].*[\"']$/.test(String(raw || '').trim()) };
  }
  return { name: null, value: '', format: 'missing', had_outer_whitespace: false, had_wrapping_quotes: false };
}

export function bearerToken(event) {
  const header = event.headers?.authorization || event.headers?.Authorization || '';
  const match = /^Bearer\s+(.+)$/i.exec(header);
  return match?.[1] || null;
}

export function userClient(token) {
  return createClient(PROD_SUPABASE_URL, PROD_SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } }
  });
}

export function adminClient() {
  const key = serverKeyInfo();
  if (!key.value) throw new Error('Missing Supabase server key');
  return createClient(PROD_SUPABASE_URL, key.value, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}

export async function requireUser(event) {
  const token = bearerToken(event);
  if (!token) {
    const err = new Error('Missing bearer token');
    err.statusCode = 401;
    throw err;
  }
  const client = userClient(token);
  const { data, error } = await client.auth.getUser(token);
  if (error || !data?.user) {
    const err = new Error('Invalid or expired session');
    err.statusCode = 401;
    throw err;
  }
  return { token, user: data.user, client };
}

export async function assertPermission(admin, userId, organizationId, permissionKey) {
  const { data: members, error: memberError } = await admin
    .from('organization_members')
    .select('id,status')
    .eq('organization_id', organizationId)
    .eq('user_id', userId)
    .eq('status', 'active')
    .limit(1);
  if (memberError) throw memberError;
  const member = members?.[0];
  if (!member) return false;

  const { data: roleLinks, error: roleError } = await admin
    .from('member_roles')
    .select('role_id')
    .eq('member_id', member.id);
  if (roleError) throw roleError;
  const roleIds = (roleLinks || []).map(r => r.role_id);
  if (!roleIds.length) return false;

  const { data: permissions, error: permissionError } = await admin
    .from('role_permissions')
    .select('permission_key')
    .in('role_id', roleIds)
    .eq('permission_key', permissionKey)
    .limit(1);
  if (permissionError) throw permissionError;
  return !!permissions?.length;
}

export function json(statusCode, body, extraHeaders = {}) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...extraHeaders
    },
    body: JSON.stringify(body)
  };
}

export function errorResponse(error) {
  const statusCode = error?.statusCode || 500;
  return json(statusCode, {
    error: error?.publicMessage || (statusCode >= 500 ? 'Portal bootstrap could not finish loading.' : error.message),
    ...(error?.code ? { code: String(error.code) } : {}),
    ...(process.env.NODE_ENV === 'development' && statusCode >= 500 ? { detail: error.message } : {})
  });
}

export function parseBody(event) {
  try { return event.body ? JSON.parse(event.body) : {}; }
  catch { const err = new Error('Invalid JSON body'); err.statusCode = 400; throw err; }
}
