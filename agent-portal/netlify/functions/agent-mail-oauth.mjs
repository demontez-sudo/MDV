import { adminClient } from './_lib/auth.mjs';
import { mailConfig, verifyState, exchangeCode, encrypt, saveConnection, GRAPH, appError } from './_lib/mail-graph.mjs';

/* Microsoft redirects the browser here after sign-in (GET). The signed `state` binds the result to the staff
   member who started it, and an HttpOnly nonce cookie set at start proves the same browser is finishing it
   (stops someone tricking a colleague into attaching their mailbox to the wrong account). */

const back = (status, params, extraHeaders = {}) => ({
  statusCode: 302,
  headers: { Location: `/admin/?${new URLSearchParams(params)}`, 'Cache-Control': 'no-store', 'Set-Cookie': 'mdv_mail_nonce=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax', ...extraHeaders },
  body: ''
});
const cookieOf = (event, name) => {
  const raw = event.headers?.cookie || event.headers?.Cookie || '';
  const m = raw.split(/;\s*/).map(x => x.split('=')).find(([k]) => k === name);
  return m ? decodeURIComponent(m.slice(1).join('=')) : '';
};

export const handler = async event => {
  if (event.httpMethod !== 'GET') return { statusCode: 405, body: 'Method not allowed' };
  const p = event.queryStringParameters || {};
  try {
    const cfg = mailConfig();
    if (!cfg.configured) return back(302, { mail: 'error', reason: 'not_configured' });
    if (p.error) return back(302, { mail: 'error', reason: p.error === 'access_denied' ? 'denied' : 'microsoft_error' });
    const state = verifyState(p.state);
    if (!state || !p.code) return back(302, { mail: 'error', reason: 'bad_state' });
    if (!cookieOf(event, 'mdv_mail_nonce') || cookieOf(event, 'mdv_mail_nonce') !== state.n) return back(302, { mail: 'error', reason: 'browser_mismatch' });

    const t = await exchangeCode(cfg, p.code);
    const me = await fetch(`${GRAPH}/me?$select=displayName,mail,userPrincipalName`, { headers: { Authorization: `Bearer ${t.access}` } });
    if (!me.ok) throw appError(502, 'Could not read the Microsoft profile.', 'MAIL_PROFILE_ERROR');
    const profile = await me.json();
    if (!t.refresh) throw appError(502, 'Microsoft did not grant offline access.', 'MAIL_NO_REFRESH');

    const admin = adminClient();
    /* Only an active/invited staff member of the org may attach a mailbox. */
    const { data: member, error } = await admin.from('organization_members').select('id').eq('organization_id', state.o).eq('user_id', state.u).eq('member_type', 'staff').in('status', ['active', 'invited']).maybeSingle();
    if (error) throw error;
    if (!member) return back(302, { mail: 'error', reason: 'not_staff' });

    await saveConnection(admin, state.o, state.u, {
      email: String(profile.mail || profile.userPrincipalName || '').toLowerCase(),
      display_name: profile.displayName || null,
      access_token_enc: encrypt(t.access), refresh_token_enc: encrypt(t.refresh), expires_at: t.expiresAt,
      scope: 'Mail.ReadWrite Mail.Send offline_access User.Read', status: 'active'
    });
    return back(302, { mail: 'connected' });
  } catch (e) {
    console.warn('[mail-oauth]', e?.code || '', e?.message || e, e?.msDescription || '');
    return back(302, { mail: 'error', reason: e?.code === 'MAIL_TABLE_MISSING' ? 'storage' : 'failed' });
  }
};
