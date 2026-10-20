/* "Put this model on the website": one place that checks everything the public site needs, asks the public site itself whether it
   can find the model, and (POST make_live) fixes what can be fixed automatically. */
import { requireUser, parseBody, json, errorResponse } from './_lib/auth.mjs';
import { requireStaffOrganization, requirePermission } from './_lib/agent-bridge.mjs';

const SUPABASE_URL = 'https://mogyngdhmzbjmcdqeoxu.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_6fTsGxRRIDzjXaoUrT0XOg_yZWu21ql';

async function rows(q) { const { data, error } = await q; if (error) throw error; return data || []; }
const keyOf = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 60);
const slugOf = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);

async function publicRpc(name, args) {
  try {
    const r = await fetch(SUPABASE_URL + '/rest/v1/rpc/' + name, { method: 'POST', headers: { apikey: SUPABASE_PUBLISHABLE_KEY, Authorization: 'Bearer ' + SUPABASE_PUBLISHABLE_KEY, 'content-type': 'application/json' }, body: JSON.stringify(args) });
    return { ok: r.ok, data: await r.json().catch(() => null) };
  } catch (e) { return { ok: false, data: null }; }
}

async function inspect(admin, orgId, modelId) {
  const model = (await rows(admin.from('models').select('*').eq('organization_id', orgId).eq('id', modelId).limit(1)))[0];
  if (!model) { const e = new Error('Model not found'); e.statusCode = 404; throw e; }
  const [profileRows, media, markets, boards, allBoards, allMarkets] = await Promise.all([
    rows(admin.from('model_public_profiles').select('*').eq('organization_id', orgId).eq('model_id', modelId).limit(1)),
    rows(admin.from('model_media').select('id,url,is_primary,is_public,category,media_type').eq('organization_id', orgId).eq('model_id', modelId)),
    rows(admin.from('model_market_assignments').select('is_primary,status,markets(name,code)').eq('organization_id', orgId).eq('model_id', modelId)).catch(() => []),
    rows(admin.from('model_division_assignments').select('status,board_id,boards(name,market_id)').eq('organization_id', orgId).eq('model_id', modelId)).catch(() => []),
    rows(admin.from('boards').select('id,market_id').eq('organization_id', orgId)).catch(() => []),
    rows(admin.from('markets').select('id,name').eq('organization_id', orgId)).catch(() => []),
  ]);
  const profile = profileRows[0] || null;
  const wm = profile?.metadata?.website_profile || {};
  const route = keyOf(model.legacy_key || wm.route_key || String(model.display_name || '').split(' ')[0]);
  const status = String(model.status || '').trim().toLowerCase();
  const onRoster = status === 'active' && model.active !== false;
  const headshot = media.find(x => x.is_primary && x.is_public && String(x.media_type || 'image').toLowerCase() === 'image' && String(x.category || '').toLowerCase() === 'headshot');
  const anyPublicImage = media.some(x => x.is_public);
  /* a model is "in" a market through a market assignment or through the boards she is placed on (the Roster's Website / Board placements) */
  const marketById = new Map(allMarkets.map(m => [String(m.id), m.name]));
  const boardMarket = new Map(allBoards.map(b => [String(b.id), b.market_id]));
  const live = x => !/^(archiv|inactive|ended)/i.test(String(x.status || ''));
  const marketNames = [...new Set([
    ...markets.filter(m => m.markets?.name && live(m)).map(m => m.markets.name),
    ...boards.filter(live).map(b => marketById.get(String(b.boards?.market_id || boardMarket.get(String(b.board_id)) || ''))).filter(Boolean),
  ])];
  const routeStored = keyOf(model.legacy_key) === route && !!route;

  const lookup = route ? await publicRpc('website_public_model_profile', { target_profile: route }) : { ok: false, data: null };
  const found = !!(lookup.ok && lookup.data && lookup.data.model);
  const view = /^m(e|a)n$|^male$/i.test(String(model.gender || '').trim()) ? 'men' : 'women';
  const onPages = [];
  for (const mk of marketNames) {
    const r = await publicRpc('website_public_roster', { target_market: mk, target_view: view });
    onPages.push({ market: mk, listed: !!(r.ok && (r.data?.models || []).some(x => keyOf(x.legacy_key) === route)) });
  }

  const checks = [
    { key: 'roster', label: 'On the active roster', ok: onRoster, detail: onRoster ? 'Status active, active switch on' : 'Status is "' + (model.status || 'empty') + '"' + (model.active === false ? ' and the active switch is off' : ''), fix: 'auto' },
    { key: 'route', label: 'Website address saved', ok: routeStored, detail: routeStored ? 'maisondeveux.com/' + route : (route ? 'Address "' + route + '" is not saved on the model yet' : 'No address yet'), fix: 'auto' },
    { key: 'published', label: 'Website profile published', ok: !!profile?.published, detail: !profile ? 'No website profile yet' : profile.published ? 'Published' : 'Saved as a draft', fix: 'auto' },
    { key: 'headshot', label: 'Public primary headshot', ok: !!headshot, detail: headshot ? 'Headshot is public and primary' : (anyPublicImage ? 'She has public photos, but none is a primary Headshot' : 'No public photo yet'), fix: 'photos' },
    { key: 'market', label: 'Placed in a market (New York or Paris)', ok: marketNames.length > 0, detail: marketNames.length ? marketNames.join(' · ') : 'The city pages list models by market, and she has none', fix: 'market' },
  ];
  return { model, route, view, found, onPages, marketNames, boards: boards.map(b => b.boards?.name).filter(Boolean), checks, profile, lookupError: found ? null : (lookup.data?.error || null) };
}

function summarize(r) {
  const blockers = r.checks.filter(c => !c.ok);
  return {
    ok: true,
    model: { id: r.model.id, display_name: r.model.display_name },
    route: r.route,
    url: r.route ? 'https://www.maisondeveux.com/' + r.route : null,
    live: r.found,
    on_city_pages: r.onPages,
    checks: r.checks,
    can_auto_fix: blockers.some(c => c.fix === 'auto'),
    manual: blockers.filter(c => c.fix !== 'auto').map(c => ({ key: c.key, label: c.label, how: c.fix === 'photos' ? 'Manage Photos: choose her best headshot, mark it Public and Primary, category Headshot.' : 'Open her Roster entry and add a market (New York or Paris) and a board.' })),
    public_site_says: r.found ? 'found' : (r.lookupError || 'not found'),
  };
}

export const handler = async event => {
  if (!['GET', 'POST'].includes(event.httpMethod)) return json(405, { error: 'Method not allowed' });
  try {
    const { user, client } = await requireUser(event);
    const body = event.httpMethod === 'POST' ? parseBody(event) : {};
    const q = event.queryStringParameters || {};
    const { organization } = await requireStaffOrganization({ user, client, organizationSlug: body.organization_slug || q.organization || 'maison-de-veux' });
    const modelId = String(body.model_id || q.model_id || '');
    if (!modelId) return json(400, { error: 'model_id is required' });

    if (event.httpMethod === 'GET') {
      const admin = await requirePermission(user.id, organization.id, 'models.read');
      return json(200, summarize(await inspect(admin, organization.id, modelId)));
    }

    const admin = await requirePermission(user.id, organization.id, 'models.write');
    if (body.action !== 'make_live') return json(400, { error: 'Unsupported action' });
    const before = await inspect(admin, organization.id, modelId);
    const m = before.model, now = new Date().toISOString();
    const route = keyOf(body.route || before.route || String(m.display_name || '').split(' ')[0]);
    if (!route) return json(400, { error: 'A website address is needed' });
    const slug = slugOf(body.public_slug || m.public_slug || m.display_name) || route;

    const { error: mErr } = await admin.from('models').update({ active: true, status: 'active', legacy_key: route, public_slug: slug }).eq('organization_id', organization.id).eq('id', modelId);
    if (mErr) throw mErr;
    const prior = before.profile?.metadata || {};
    const { error: pErr } = await admin.from('model_public_profiles').upsert({
      organization_id: organization.id, model_id: modelId, published: true, published_at: now,
      metadata: { ...prior, website_profile: { ...(prior.website_profile || {}), route_key: route, public_slug: slug, profile_url: 'https://www.maisondeveux.com/' + route, updated_at: now } },
    }, { onConflict: 'model_id' });
    if (pErr) throw pErr;

    const after = summarize(await inspect(admin, organization.id, modelId));
    return json(200, { ...after, verified: true, changed: before.checks.filter(c => !c.ok && c.fix === 'auto').map(c => c.key) });
  } catch (error) { return errorResponse(error); }
};

