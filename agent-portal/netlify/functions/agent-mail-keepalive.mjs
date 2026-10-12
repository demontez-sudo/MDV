import { adminClient, json } from './_lib/auth.mjs';
import { mailConfig, ensureAccess } from './_lib/mail-graph.mjs';

/* Keeps every connected mailbox signed in. Microsoft only lets a saved sign-in go quiet for about 90 days; renewing
   it every few hours means nobody has to reconnect, even if they do not open Mail for weeks. */
export const config = { schedule: '0 */4 * * *' };

const STALE_MS = 12 * 3600 * 1000;

export const handler = async () => {
  try {
    const cfg = mailConfig();
    if (!cfg.configured) return json(200, { ok: true, skipped: 'mail not configured' }, { 'Cache-Control': 'no-store' });
    const admin = adminClient();
    const { data, error } = await admin.from('mail_connections').select('*').eq('provider', 'microsoft').eq('status', 'active');
    if (error) throw error;
    let renewed = 0, skipped = 0, failed = 0;
    for (const conn of data || []) {
      if (Date.now() - Date.parse(conn.updated_at || 0) < STALE_MS) { skipped++; continue; }
      try { await ensureAccess(admin, cfg, conn, { force: true }); renewed++; }
      catch (e) { failed++; console.warn('[mail-keepalive]', conn.email || conn.id, e?.code || '', e?.message || ''); }
    }
    return json(200, { ok: true, total: (data || []).length, renewed, skipped, failed }, { 'Cache-Control': 'no-store' });
  } catch (e) {
    console.error('[mail-keepalive]', String(e?.message || e));
    return json(500, { ok: false }, { 'Cache-Control': 'no-store' });
  }
};
