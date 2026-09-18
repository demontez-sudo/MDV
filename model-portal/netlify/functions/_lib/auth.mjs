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

function readEnv(name) {
  // Netlify Functions expose runtime variables through Netlify.env. Keep a
  // process.env fallback for local tools and legacy function execution.
  try {
    const getter = globalThis?.Netlify?.env?.get;
    if (typeof getter === 'function') {
      const value = getter.call(globalThis.Netlify.env, name);
      if (value != null && String(value).trim() !== '') return value;
    }
  } catch (_error) {}
  try {
    return process?.env?.[name] || '';
  } catch (_error) {
    return '';
  }
}

function env(name) {
  const value = cleanSecret(readEnv(name));
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}

export function serverKeyInfo() {
  const candidates = [
    ['VEUX_SUPABASE_SERVICE_ROLE_KEY', readEnv('VEUX_SUPABASE_SERVICE_ROLE_KEY')],
    ['VEUX_SUPABASE_SECRET_KEY', readEnv('VEUX_SUPABASE_SECRET_KEY')],
    ['SUPABASE_SECRET_KEY', readEnv('SUPABASE_SECRET_KEY')],
    ['SUPABASE_SERVICE_ROLE_KEY', readEnv('SUPABASE_SERVICE_ROLE_KEY')]
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
  if (!key.value) {
    const err = new Error('Missing Supabase server key');
    err.statusCode = 503;
    err.code = 'SERVER_CONFIG_MISSING';
    err.publicMessage = 'CAVYRE server configuration is incomplete on this deployment.';
    throw err;
  }
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
  const meta = data.user.app_metadata && typeof data.user.app_metadata === 'object' ? data.user.app_metadata : {};
  if (meta.cavyre_portal_disabled === true) {
    const err = new Error('Model Portal access is disabled. Contact your agency.');
    err.statusCode = 403;
    err.code = 'MODEL_PORTAL_DISABLED';
    err.publicMessage = err.message;
    throw err;
  }
  const exp = meta.cavyre_temp_password_expires_at ? Date.parse(meta.cavyre_temp_password_expires_at) : 0;
  if ((meta.cavyre_password_reset_required === true || meta.cavyre_temporary_login_ready === true) && exp && Date.now() > exp) {
    const err = new Error('Your temporary password has expired. Contact your agency for a new temporary password.');
    err.statusCode = 401;
    err.code = 'TEMP_PASSWORD_EXPIRED';
    err.publicMessage = err.message;
    throw err;
  }
  if (meta.cavyre_password_reset_required === true || meta.cavyre_temporary_login_ready === true) {
    const err = new Error('Password setup required. Sign in with the temporary password to create a new permanent password.');
    err.statusCode = 428;
    err.code = 'PASSWORD_SETUP_REQUIRED';
    err.publicMessage = err.message;
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

const SAFE_DATABASE_ERRORS = Object.freeze({
  '23502': { statusCode: 400, message: 'Required information is missing.' },
  '23503': { statusCode: 409, message: 'A related record is invalid or unavailable.' },
  '23505': { statusCode: 409, message: 'This record already exists.' },
  '23514': { statusCode: 400, message: 'One or more values are not allowed.' },
  '22001': { statusCode: 400, message: 'One or more values are too long.' },
  '22007': { statusCode: 400, message: 'A date or time value is invalid.' },
  '22008': { statusCode: 400, message: 'A date or time value is outside the allowed range.' },
  '22023': { statusCode: 400, message: 'One or more values are invalid.' },
  '22P02': { statusCode: 400, message: 'One or more values are invalid.' },
  'P0002': { statusCode: 404, message: 'The requested record was not found.' }
});

export function errorResponse(error) {
  const code = String(error?.code || '').trim();
  const safeDatabaseError = SAFE_DATABASE_ERRORS[code] || null;
  const statusCode = error?.statusCode || safeDatabaseError?.statusCode || 500;
  const publicMessage = String(error?.publicMessage || '').trim();
  return json(statusCode, {
    error: publicMessage || safeDatabaseError?.message || (statusCode >= 500 ? 'Server error' : error.message),
    ...(code && statusCode < 500 ? { code } : {}),
    ...(process.env.NODE_ENV === 'development' && statusCode >= 500 ? { detail: error.message } : {})
  });
}

export function parseBody(event) {
  try {
    if (!event || event.body == null || event.body === '') return {};
    if (typeof event.body === 'object') return event.body;
    let raw=String(event.body);
    if(event.isBase64Encoded) raw=Buffer.from(raw,'base64').toString('utf8');
    const ct=String(event.headers?.['content-type']||event.headers?.['Content-Type']||'').toLowerCase();
    try{return JSON.parse(raw);}
    catch(jsonErr){
      if(ct.includes('application/x-www-form-urlencoded')) return Object.fromEntries(new URLSearchParams(raw));
      const err = new Error('Invalid JSON body'); err.statusCode = 400; err.detail=jsonErr.message; throw err;
    }
  } catch (e) { if(e?.statusCode) throw e; const err = new Error('Invalid JSON body'); err.statusCode = 400; throw err; }
}
