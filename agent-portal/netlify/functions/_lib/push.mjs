/* Web Push for the portal (MacBook Safari/Chrome, iPhone once the portal is on the Home Screen).
   Alerts are sent as a plain "wake up" push signed with the VAPID key (no encrypted payload). The service worker wakes,
   asks /api/public/push/inbox for what is waiting for that device, and shows it. Dependency-free: only node:crypto. */
import crypto from 'node:crypto';

const b64u = b => Buffer.from(b).toString('base64url');
export const DEFAULT_PREFS = { mentions: true, tasks: true, applications: true, packages: true, followups: true, test: true };

export function vapidConfig() {
  const pub = String(process.env.VAPID_PUBLIC_KEY || '').trim(), priv = String(process.env.VAPID_PRIVATE_KEY || '').trim();
  const sub = String(process.env.VAPID_SUBJECT || 'mailto:agent@maisondeveux.com').trim();
  return { configured: !!(pub && priv), pub, priv, sub };
}
function keyObject(pubB64, privB64) {
  const pub = Buffer.from(pubB64, 'base64url');
  if (pub.length !== 65 || pub[0] !== 4) throw new Error('VAPID public key must be an uncompressed P-256 point.');
  return crypto.createPrivateKey({ key: { kty: 'EC', crv: 'P-256', x: b64u(pub.subarray(1, 33)), y: b64u(pub.subarray(33, 65)), d: privB64 }, format: 'jwk' });
}
export function vapidHeader(endpoint, cfg, now = Date.now()) {
  const aud = new URL(endpoint).origin;
  const head = b64u(JSON.stringify({ typ: 'JWT', alg: 'ES256' })), claims = b64u(JSON.stringify({ aud, exp: Math.floor(now / 1000) + 12 * 3600, sub: cfg.sub }));
  const data = head + '.' + claims;
  const sig = crypto.sign('sha256', Buffer.from(data), { key: keyObject(cfg.pub, cfg.priv), dsaEncoding: 'ieee-p1363' });
  return `vapid t=${data}.${b64u(sig)}, k=${cfg.pub}`;
}
export async function sendWake(endpoint, cfg) {
  const r = await fetch(endpoint, { method: 'POST', headers: { Authorization: vapidHeader(endpoint, cfg), TTL: '3600', Urgency: 'high' }, signal: AbortSignal.timeout ? AbortSignal.timeout(8000) : undefined });
  return { status: r.status, ok: r.status >= 200 && r.status < 300 };
}

export async function staffUserIds(admin, orgId) {
  const { data } = await admin.from('organization_members').select('user_id').eq('organization_id', orgId).eq('member_type', 'staff').eq('status', 'active');
  return [...new Set((data || []).map(x => x.user_id).filter(Boolean))];
}

/* queue an alert for every device of the given people, then wake those devices. Never throws: an alert must not break the action that caused it. */
export async function notify(admin, { orgId, userIds, title, body, url, category = 'general', tag, exceptUserId = null }) {
  try {
    const cfg = vapidConfig(); if (!cfg.configured) return { sent: 0, skipped: 'not_configured' };
    let ids = userIds && userIds.length ? userIds : await staffUserIds(admin, orgId);
    ids = ids.filter(id => id && id !== exceptUserId); if (!ids.length) return { sent: 0 };
    const { data: subs, error } = await admin.from('push_subscriptions').select('id,user_id,endpoint,prefs').eq('organization_id', orgId).eq('enabled', true).in('user_id', ids);
    if (error) { console.warn('[push] subscriptions unavailable:', error.message); return { sent: 0, skipped: 'no_table' }; }
    const targets = (subs || []).filter(s => !(s.prefs && s.prefs[category] === false));
    if (!targets.length) return { sent: 0 };
    const rows = targets.map(s => ({ organization_id: orgId, subscription_id: s.id, user_id: s.user_id, category, title: String(title || 'Maison de Veux').slice(0, 120), body: String(body || '').slice(0, 300), url: url || null, tag: tag || null }));
    const ins = await admin.from('push_alerts').insert(rows);
    if (ins.error) { console.warn('[push] alerts could not be queued:', ins.error.message); return { sent: 0, skipped: 'no_table' }; }
    let sent = 0;
    await Promise.allSettled(targets.map(async s => {
      try {
        const r = await sendWake(s.endpoint, cfg);
        if (r.status === 404 || r.status === 410) await admin.from('push_subscriptions').delete().eq('id', s.id);
        else if (r.ok) sent++; else console.warn('[push] wake refused', r.status);
      } catch (e) { console.warn('[push] wake failed', e?.message || e); }
    }));
    return { sent, devices: targets.length };
  } catch (e) { console.warn('[push] notify failed', e?.message || e); return { sent: 0, error: String(e?.message || e) }; }
}
