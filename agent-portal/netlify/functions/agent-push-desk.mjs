import { requireUser, parseBody, json, errorResponse, adminClient } from './_lib/auth.mjs';
import { requireStaffOrganization } from './_lib/agent-bridge.mjs';
import { vapidConfig, notify, DEFAULT_PREFS } from './_lib/push.mjs';

const clean = (v, n = 400) => String(v == null ? '' : v).trim().slice(0, n);
const bad = m => { const e = new Error(m); e.statusCode = 400; return e; };
const isMissing = e => /42P01|does not exist|schema cache/i.test(String(e?.code || '') + ' ' + String(e?.message || ''));
const platformOf = ua => /iPhone|iPad/i.test(ua) ? 'iPhone / iPad' : /Macintosh/i.test(ua) ? (/Chrome\//.test(ua) && !/Edg\//.test(ua) ? 'Mac · Chrome' : /Edg\//.test(ua) ? 'Mac · Edge' : 'Mac · Safari') : /Android/i.test(ua) ? 'Android' : /Windows/i.test(ua) ? 'Windows' : 'Other device';

export const handler = async event => {
  if (!['GET', 'POST'].includes(event.httpMethod)) return json(405, { error: 'Method not allowed' });
  try {
    const { user, client } = await requireUser(event);
    const body = event.httpMethod === 'POST' ? parseBody(event) : {}, p = event.queryStringParameters || {};
    const { organization } = await requireStaffOrganization({ user, client, organizationSlug: body.organization_slug || p.organization || 'maison-de-veux' });
    const admin = adminClient(), orgId = organization.id, cfg = vapidConfig();
    const ua = clean(event.headers?.['user-agent'] || event.headers?.['User-Agent'], 300);

    if (event.httpMethod === 'GET') {
      const out = { ok: true, configured: cfg.configured, public_key: cfg.configured ? cfg.pub : null, defaults: DEFAULT_PREFS, devices: [], table_ready: true };
      const { data, error } = await admin.from('push_subscriptions').select('id,endpoint,platform,created_at,last_seen_at,enabled,prefs').eq('organization_id', orgId).eq('user_id', user.id).order('created_at', { ascending: false });
      if (error) { if (isMissing(error)) out.table_ready = false; else throw error; }
      else out.devices = (data || []).map(d => ({ id: d.id, platform: d.platform || 'Device', created_at: d.created_at, last_seen_at: d.last_seen_at, enabled: d.enabled, prefs: { ...DEFAULT_PREFS, ...(d.prefs || {}) }, endpoint_tail: String(d.endpoint || '').slice(-12) }));
      return json(200, out);
    }

    const action = clean(body.action, 30);
    if (!cfg.configured) throw bad('Alerts are not set up on the server yet.');

    if (action === 'subscribe') {
      const s = body.subscription || {}, endpoint = clean(s.endpoint, 1200);
      if (!/^https:\/\//.test(endpoint)) throw bad('That device did not give a valid alert address.');
      const row = { organization_id: orgId, user_id: user.id, endpoint, p256dh: clean(s.keys?.p256dh, 200) || null, auth: clean(s.keys?.auth, 100) || null, platform: clean(body.platform, 60) || platformOf(ua), user_agent: ua, enabled: true, last_seen_at: new Date().toISOString() };
      const prev = await admin.from('push_subscriptions').select('id,prefs').eq('endpoint', endpoint).maybeSingle();
      if (prev.error) throw prev.error;
      if (prev.data) { const u = await admin.from('push_subscriptions').update({ ...row, prefs: prev.data.prefs || {} }).eq('id', prev.data.id).select('id').single(); if (u.error) throw u.error; return json(200, { ok: true, verified: true, id: u.data.id }); }
      const { data, error } = await admin.from('push_subscriptions').insert({ ...row, prefs: { ...DEFAULT_PREFS } }).select('id').single();
      if (error) throw error;
      return json(200, { ok: true, verified: true, id: data.id });
    }
    if (action === 'unsubscribe') {
      const endpoint = clean(body.endpoint, 1200); if (!endpoint) throw bad('endpoint is required.');
      const { error } = await admin.from('push_subscriptions').delete().eq('organization_id', orgId).eq('user_id', user.id).eq('endpoint', endpoint);
      if (error) throw error; return json(200, { ok: true, verified: true });
    }
    if (action === 'remove_device') {
      const { error } = await admin.from('push_subscriptions').delete().eq('organization_id', orgId).eq('user_id', user.id).eq('id', clean(body.id, 80));
      if (error) throw error; return json(200, { ok: true, verified: true });
    }
    if (action === 'prefs') {
      const prefs = {}; for (const k of Object.keys(DEFAULT_PREFS)) if (typeof body.prefs?.[k] === 'boolean') prefs[k] = body.prefs[k];
      const { data: mine, error: e1 } = await admin.from('push_subscriptions').select('id,prefs').eq('organization_id', orgId).eq('user_id', user.id);
      if (e1) throw e1;
      for (const d of mine || []) { const u = await admin.from('push_subscriptions').update({ prefs: { ...DEFAULT_PREFS, ...(d.prefs || {}), ...prefs } }).eq('id', d.id); if (u.error) throw u.error; }
      return json(200, { ok: true, verified: true });
    }
    if (action === 'test') {
      const r = await notify(admin, { orgId, userIds: [user.id], title: 'Alerts are on', body: 'This is a test from the portal. You will get alerts like this on this device.', url: '?page=alerts', category: 'test', tag: 'mdv-test-' + Date.now() });
      if (!r.devices) throw bad('No device is set up for alerts yet. Turn alerts on for this device first.');
      return json(200, { ok: true, verified: true, devices: r.devices, sent: r.sent });
    }
    return json(400, { error: 'Unsupported alerts action' });
  } catch (error) { return errorResponse(error); }
};
