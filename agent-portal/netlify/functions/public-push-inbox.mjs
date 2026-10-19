import { adminClient, json } from './_lib/auth.mjs';

/* Called by the service worker when a push arrives: what is waiting for this device? The device's own alert address is the key. */
const headers = { 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
export const handler = async event => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers };
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' }, headers);
  try {
    let body = {}; try { body = JSON.parse(event.body || '{}'); } catch (_e) { /* ignore */ }
    const endpoint = String(body.endpoint || '').trim();
    if (!/^https:\/\//.test(endpoint) || endpoint.length > 1200) return json(200, { ok: true, alerts: [] }, headers);
    const admin = adminClient();
    const sub = await admin.from('push_subscriptions').select('id').eq('endpoint', endpoint).maybeSingle();
    if (sub.error || !sub.data) return json(200, { ok: true, alerts: [] }, headers);
    const { data, error } = await admin.from('push_alerts').select('id,title,body,url,tag,category,created_at').eq('subscription_id', sub.data.id).is('delivered_at', null).order('created_at', { ascending: true }).limit(5);
    if (error) return json(200, { ok: true, alerts: [] }, headers);
    const alerts = data || [];
    if (alerts.length) await admin.from('push_alerts').update({ delivered_at: new Date().toISOString() }).in('id', alerts.map(a => a.id));
    await admin.from('push_subscriptions').update({ last_seen_at: new Date().toISOString() }).eq('id', sub.data.id);
    return json(200, { ok: true, alerts }, headers);
  } catch (e) { console.warn('[push inbox]', e?.message || e); return json(200, { ok: true, alerts: [] }, headers); }
};
