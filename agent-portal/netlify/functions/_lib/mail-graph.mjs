import crypto from 'node:crypto';

/* Per-team-member Microsoft 365 mail (Microsoft Graph).
   Each staff member connects their own mailbox with a delegated sign-in; refresh/access tokens are
   encrypted at rest (AES-256-GCM) and never sent to the browser. Required Netlify env vars:
     MS_CLIENT_ID, MS_CLIENT_SECRET   - the Entra ID app registration
     MAIL_TOKEN_KEY                   - long random secret; encrypts tokens and signs the sign-in state
   Optional: MS_TENANT_ID (default "organizations"), MAIL_REDIRECT_URI. */

export const GRAPH = 'https://graph.microsoft.com/v1.0';
export const SCOPES = 'offline_access openid profile email User.Read Mail.ReadWrite Mail.Send';
const EMAIL_RX = /^[^\s@<>"',;]+@[^\s@<>"',;]+\.[^\s@<>"',;]+$/;
export const LIMITS = { recipients: 50, subject: 300, bodyChars: 400000, attachmentBytes: 3 * 1024 * 1024, attachments: 8 };
const clean = v => String(v ?? '').trim();

const appError = (statusCode, publicMessage, code, extra = {}) => {
  const e = new Error(publicMessage); e.statusCode = statusCode; e.publicMessage = publicMessage; e.code = code; Object.assign(e, extra); return e;
};
export { appError };

export function mailConfig() {
  const tenant = clean(process.env.MS_TENANT_ID) || 'organizations';
  const clientId = clean(process.env.MS_CLIENT_ID), clientSecret = clean(process.env.MS_CLIENT_SECRET), key = clean(process.env.MAIL_TOKEN_KEY);
  const missing = [];
  if (!clientId) missing.push('MS_CLIENT_ID');
  if (!clientSecret) missing.push('MS_CLIENT_SECRET');
  if (key.length < 24) missing.push('MAIL_TOKEN_KEY (24+ characters)');
  return {
    configured: missing.length === 0, missing, tenant, clientId, clientSecret,
    redirectUri: clean(process.env.MAIL_REDIRECT_URI) || 'https://www.maisondeveux.com/admin/api/agent/mail/callback'
  };
}

/* ---------- crypto: token encryption + signed state ---------- */
const key32 = () => crypto.createHash('sha256').update(clean(process.env.MAIL_TOKEN_KEY)).digest();
export function encrypt(text) {
  const iv = crypto.randomBytes(12), c = crypto.createCipheriv('aes-256-gcm', key32(), iv);
  const enc = Buffer.concat([c.update(String(text), 'utf8'), c.final()]);
  return [iv, c.getAuthTag(), enc].map(b => b.toString('base64')).join('.');
}
export function decrypt(blob) {
  const [iv, tag, enc] = String(blob || '').split('.').map(x => Buffer.from(x || '', 'base64'));
  if (!iv?.length || !tag?.length || !enc?.length) throw appError(409, 'Stored email credentials are unreadable. Reconnect your email.', 'MAIL_RECONNECT_REQUIRED');
  try {
    const d = crypto.createDecipheriv('aes-256-gcm', key32(), iv); d.setAuthTag(tag);
    return Buffer.concat([d.update(enc), d.final()]).toString('utf8');
  } catch (_e) { throw appError(409, 'Stored email credentials could not be decrypted (the key may have changed). Reconnect your email.', 'MAIL_RECONNECT_REQUIRED'); }
}
const b64u = b => Buffer.from(b).toString('base64url');
const hmac = s => crypto.createHmac('sha256', key32()).update(s).digest('base64url');
export function signState(payload) { const body = b64u(JSON.stringify(payload)); return `${body}.${hmac(body)}`; }
export function verifyState(state) {
  const [body, sig] = String(state || '').split('.');
  if (!body || !sig) return null;
  const want = hmac(body);
  if (sig.length !== want.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(want))) return null;
  try { const p = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')); return p && p.exp > Date.now() ? p : null; } catch (_e) { return null; }
}
export const newNonce = () => crypto.randomBytes(18).toString('base64url');

/* ---------- OAuth ---------- */
export function authorizeUrl(cfg, state, loginHint) {
  const q = new URLSearchParams({ client_id: cfg.clientId, response_type: 'code', redirect_uri: cfg.redirectUri, response_mode: 'query', scope: SCOPES, state, prompt: 'select_account' });
  if (loginHint) q.set('login_hint', loginHint);
  return `https://login.microsoftonline.com/${encodeURIComponent(cfg.tenant)}/oauth2/v2.0/authorize?${q}`;
}
async function tokenRequest(cfg, params) {
  const r = await fetch(`https://login.microsoftonline.com/${encodeURIComponent(cfg.tenant)}/oauth2/v2.0/token`, {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: cfg.clientId, client_secret: cfg.clientSecret, scope: SCOPES, ...params })
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    const e = appError(r.status === 400 || r.status === 401 ? 409 : 502,
      data.error === 'invalid_grant' ? 'Your Microsoft sign-in expired or was revoked. Reconnect your email.' : 'Microsoft could not complete the sign-in.',
      data.error === 'invalid_grant' ? 'MAIL_RECONNECT_REQUIRED' : 'MAIL_TOKEN_ERROR', { msError: data.error, msDescription: String(data.error_description || '').slice(0, 300) });
    throw e;
  }
  return { access: data.access_token, refresh: data.refresh_token, expiresAt: new Date(Date.now() + (Number(data.expires_in) || 3600) * 1000 - 60000).toISOString() };
}
export const exchangeCode = (cfg, code) => tokenRequest(cfg, { grant_type: 'authorization_code', code, redirect_uri: cfg.redirectUri });
export const refreshTokens = (cfg, refresh) => tokenRequest(cfg, { grant_type: 'refresh_token', refresh_token: refresh });

/* ---------- connection storage (table: mail_connections) ---------- */
const tableMissing = e => ['42P01', 'PGRST205', 'PGRST200'].includes(String(e?.code)) || /mail_connections/.test(String(e?.message || '')) && /(does not exist|schema cache|could not find)/i.test(String(e?.message || ''));
function storageError(e) {
  if (tableMissing(e)) return appError(503, 'Email storage is not set up yet. Run the migration agent-portal/docs/sql/2026-10-07-mail-connections.sql in Supabase.', 'MAIL_TABLE_MISSING');
  return e;
}
export async function getConnection(admin, orgId, userId) {
  const { data, error } = await admin.from('mail_connections').select('*').eq('organization_id', orgId).eq('user_id', userId).eq('provider', 'microsoft').maybeSingle();
  if (error) throw storageError(error);
  return data || null;
}
export async function saveConnection(admin, orgId, userId, row) {
  const payload = { organization_id: orgId, user_id: userId, provider: 'microsoft', status: 'active', updated_at: new Date().toISOString(), ...row };
  const { data, error } = await admin.from('mail_connections').upsert(payload, { onConflict: 'organization_id,user_id,provider' }).select('*').single();
  if (error) throw storageError(error);
  return data;
}
export async function deleteConnection(admin, orgId, userId) {
  const { error } = await admin.from('mail_connections').delete().eq('organization_id', orgId).eq('user_id', userId).eq('provider', 'microsoft');
  if (error) throw storageError(error);
}

/* ---------- Graph request with automatic token refresh ---------- */
export const safeId = id => { const v = clean(id); if (!/^[A-Za-z0-9_\-=+.%]{8,600}$/.test(v)) throw appError(400, 'That message id is not valid.', 'MAIL_BAD_ID'); return v; };
function graphError(status, body) {
  const msg = clean(body?.error?.message).slice(0, 200);
  if (status === 401) return appError(409, 'Microsoft rejected the saved sign-in. Reconnect your email.', 'MAIL_RECONNECT_REQUIRED');
  if (status === 403) return appError(403, 'Microsoft did not grant mail access. Reconnect and accept the permissions, or ask your admin to approve the app.', 'MAIL_FORBIDDEN');
  if (status === 404) return appError(404, 'That message or folder was not found.', 'MAIL_NOT_FOUND');
  if (status === 429) return appError(429, 'Microsoft is rate limiting mail requests. Try again in a moment.', 'MAIL_RATE_LIMIT');
  return appError(502, `Microsoft mail request failed${msg ? ': ' + msg : ''}.`, 'MAIL_GRAPH_ERROR');
}
export async function ensureAccess(admin, cfg, conn) {
  if (conn.status === 'needs_reconnect') throw appError(409, 'Your Microsoft sign-in expired. Reconnect your email.', 'MAIL_RECONNECT_REQUIRED');
  if (conn.access_token_enc && conn.expires_at && Date.parse(conn.expires_at) > Date.now() + 30000) return decrypt(conn.access_token_enc);
  let t;
  try { t = await refreshTokens(cfg, decrypt(conn.refresh_token_enc)); }
  catch (e) {
    if (e.code === 'MAIL_RECONNECT_REQUIRED') { try { await admin.from('mail_connections').update({ status: 'needs_reconnect', updated_at: new Date().toISOString() }).eq('id', conn.id); } catch (_x) { /* best effort */ } }
    throw e;
  }
  const upd = { access_token_enc: encrypt(t.access), expires_at: t.expiresAt, updated_at: new Date().toISOString(), status: 'active' };
  if (t.refresh) upd.refresh_token_enc = encrypt(t.refresh);
  await admin.from('mail_connections').update(upd).eq('id', conn.id);
  Object.assign(conn, upd);
  return t.access;
}
export async function graph(admin, cfg, conn, pathOrUrl, { method = 'GET', body, headers = {}, raw = false } = {}) {
  if (/^[a-z][a-z0-9+.-]*:/i.test(pathOrUrl) && !/^https:\/\/graph\.microsoft\.com\/v1\.0\//.test(pathOrUrl)) throw appError(400, 'That link is not a Microsoft Graph address.', 'MAIL_BAD_URL');
  const url = /^https:\/\/graph\.microsoft\.com\/v1\.0\//.test(pathOrUrl) ? pathOrUrl : GRAPH + pathOrUrl;
  const call = async token => fetch(url, { method, headers: { Authorization: `Bearer ${token}`, Accept: 'application/json', ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...headers }, body: body !== undefined ? JSON.stringify(body) : undefined });
  let r = await call(await ensureAccess(admin, cfg, conn));
  if (r.status === 401) { conn.expires_at = null; r = await call(await ensureAccess(admin, cfg, conn)); }
  if (!r.ok) throw graphError(r.status, await r.json().catch(() => ({})));
  if (raw) return r;
  if (r.status === 202 || r.status === 204) return null;
  return r.json().catch(() => null);
}

/* ---------- pure helpers (unit-tested) ---------- */
export const escHtml = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export function textToHtml(text) {
  const t = String(text ?? '').replace(/\r\n?/g, '\n');
  return `<div style="font-family:Segoe UI,Calibri,Arial,sans-serif;font-size:14px;line-height:1.5;color:#111">${escHtml(t).replace(/\n/g, '<br>')}</div>`;
}
export function parseAddresses(input, label = 'recipient') {
  const list = Array.isArray(input) ? input : String(input ?? '').split(/[;,\n]/);
  const out = [], seen = new Set();
  for (const raw of list) {
    let s = clean(typeof raw === 'object' && raw ? (raw.address || raw.email || '') : raw);
    if (!s) continue;
    const m = s.match(/<([^>]+)>\s*$/); if (m) s = clean(m[1]);
    if (!EMAIL_RX.test(s)) throw appError(400, `"${s.slice(0, 80)}" is not a valid ${label} email address.`, 'MAIL_BAD_ADDRESS');
    const k = s.toLowerCase(); if (seen.has(k)) continue; seen.add(k);
    out.push({ emailAddress: { address: s } });
  }
  if (out.length > LIMITS.recipients) throw appError(400, `Too many recipients (max ${LIMITS.recipients}).`, 'MAIL_TOO_MANY');
  return out;
}
export function cleanAttachments(list) {
  const arr = Array.isArray(list) ? list : [];
  if (arr.length > LIMITS.attachments) throw appError(400, `Attach up to ${LIMITS.attachments} files.`, 'MAIL_TOO_MANY_FILES');
  let total = 0;
  const out = arr.map(a => {
    const name = clean(a?.name).replace(/[\\/:*?"<>|\u0000-\u001f]+/g, '_').slice(0, 180) || 'attachment';
    const b64 = String(a?.content_base64 || a?.contentBytes || '').replace(/\s+/g, '');
    if (!/^[A-Za-z0-9+/]*={0,2}$/.test(b64) || !b64) throw appError(400, `"${name}" could not be read.`, 'MAIL_BAD_ATTACHMENT');
    total += Math.floor(b64.length * 3 / 4);
    return { '@odata.type': '#microsoft.graph.fileAttachment', name, contentType: clean(a?.content_type || a?.contentType) || 'application/octet-stream', contentBytes: b64 };
  });
  if (total > LIMITS.attachmentBytes) throw appError(413, `Attachments are over the ${Math.round(LIMITS.attachmentBytes / 1048576)} MB limit.`, 'MAIL_ATTACHMENTS_TOO_BIG');
  return out;
}
export function buildSendPayload(body) {
  const to = parseAddresses(body.to, 'recipient'), cc = parseAddresses(body.cc, 'Cc'), bcc = parseAddresses(body.bcc, 'Bcc');
  if (!to.length) throw appError(400, 'Add at least one recipient.', 'MAIL_NO_RECIPIENT');
  const subject = clean(body.subject).slice(0, LIMITS.subject);
  const text = String(body.text ?? body.body ?? '');
  if (!subject && !text.trim()) throw appError(400, 'Write a subject or a message before sending.', 'MAIL_EMPTY');
  if (text.length > LIMITS.bodyChars) throw appError(413, 'That message is too long.', 'MAIL_TOO_LONG');
  const attachments = cleanAttachments(body.attachments);
  return { message: { subject: subject || '(no subject)', body: { contentType: 'HTML', content: textToHtml(text) }, toRecipients: to, ...(cc.length ? { ccRecipients: cc } : {}), ...(bcc.length ? { bccRecipients: bcc } : {}), ...(attachments.length ? { attachments } : {}) }, saveToSentItems: true };
}
const who = r => r?.emailAddress ? { name: r.emailAddress.name || '', address: r.emailAddress.address || '' } : null;
export function mapSummary(m) {
  return { id: m.id, subject: m.subject || '(no subject)', from: who(m.from), to: (m.toRecipients || []).map(who).filter(Boolean), received: m.receivedDateTime || m.sentDateTime || null, is_read: !!m.isRead, preview: String(m.bodyPreview || '').slice(0, 220), has_attachments: !!m.hasAttachments, conversation_id: m.conversationId || null, importance: m.importance || 'normal' };
}
export function mapMessage(m) {
  return { ...mapSummary(m), cc: (m.ccRecipients || []).map(who).filter(Boolean), bcc: (m.bccRecipients || []).map(who).filter(Boolean), reply_to: (m.replyTo || []).map(who).filter(Boolean), body_type: String(m.body?.contentType || 'text').toLowerCase(), body: String(m.body?.content || ''), web_link: m.webLink || null };
}
export const FOLDERS = [['inbox', 'Inbox'], ['sentitems', 'Sent'], ['drafts', 'Drafts'], ['archive', 'Archive'], ['junkemail', 'Junk'], ['deleteditems', 'Deleted']];
export const SUMMARY_SELECT = 'id,subject,from,toRecipients,receivedDateTime,sentDateTime,isRead,bodyPreview,hasAttachments,conversationId,importance';
