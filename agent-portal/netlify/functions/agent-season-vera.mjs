import { requireUser, adminClient, assertPermission, json, errorResponse, parseBody } from './_lib/auth.mjs';
import { requireStaffOrganization } from './_lib/agent-bridge.mjs';
import { parseJsonLoose } from './_lib/ai-providers.mjs';
import { askWeb } from './agent-vera-chat.mjs';

const clean = v => String(v == null ? '' : v).trim();
async function rows(q) { const { data, error } = await q; if (error) throw error; return data || []; }

const SYSTEM = `You are Vera, casting and booking intelligence for a model agency (Maison de Veux) working a fashion-week season.
You are given ONE designer/show from a fashion-week schedule, the agency's roster with measurements, and any existing CRM links.
Do a deep public web research pass on the designer before answering: brand identity and aesthetic, creative director, recent seasons' casting (who they book, the model look: height range, age, diversity, sizes, runway walk, editorial vs commercial), the casting director / casting company and who at the label handles casting, stylist/production if public, and any public casting call or go-see information for this season.
Then pick which roster models fit this designer and explain why, using only roster data supplied. Never invent measurements, credits, emails, phone numbers or people. If something is not found, say so and leave it empty.
Every public claim must be supported by a source URL. Private roster data must never be placed in web search queries.
Return ONLY valid JSON, no markdown, with this shape:
{"designer":{"name":"","summary":"","aesthetic":[],"creative_director":"","website":"","instagram":""},
 "casting_profile":{"summary":"","height_range":"","look":[],"recent_seasons":[]},
 "casting_directors":[{"display_name":"","role":"","company":"","email":"","instagram":"","source_url":"","confidence":0.0}],
 "suggestions":[{"model_id":"","name":"","score":0,"reason":"","risks":""}],
 "notes":[],
 "sources":[{"title":"","url":""}]}
Suggest up to 8 models ordered by fit, scores 0-100. Only use model_id values from the roster. Casting directors must be real people found in sources; confidence 0-1.`;

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });
  try {
    const { user, client } = await requireUser(event);
    const body = parseBody(event);
    const { organization } = await requireStaffOrganization({ user, client, organizationSlug: body.organization_slug || 'maison-de-veux' });
    const admin = adminClient();
    if (!await assertPermission(admin, user.id, organization.id, 'ai.use')) return json(403, { error: 'You do not have permission to use Vera.' });
    const showId = clean(body.show_id);
    if (!showId) return json(400, { error: 'show_id is required' });
    const show = (await rows(admin.from('season_shows').select('*').eq('organization_id', organization.id).eq('id', showId).limit(1)))[0];
    if (!show) return json(404, { error: 'Show not found' });
    const season = (await rows(admin.from('seasons').select('name,starts_on,ends_on,markets:market_id(name)').eq('organization_id', organization.id).eq('id', show.season_id).limit(1)))[0] || {};
    const [roster, meas, assigned, company] = await Promise.all([
      rows(admin.from('models').select('id,display_name,stage,status,primary_market_label,location').eq('organization_id', organization.id).eq('active', true).limit(300)),
      rows(admin.from('model_measurements').select('*').eq('organization_id', organization.id).limit(600)).catch(() => []),
      rows(admin.from('season_show_models').select('model_id,status').eq('organization_id', organization.id).eq('season_show_id', showId).limit(300)),
      show.company_id ? rows(admin.from('companies').select('id,name,website,notes').eq('organization_id', organization.id).eq('id', show.company_id).limit(1)) : Promise.resolve([])
    ]);
    const mByModel = new Map();
    for (const m of meas) if (m.model_id && !mByModel.has(m.model_id)) mByModel.set(m.model_id, m);
    const pick = m => m ? Object.fromEntries(Object.entries(m).filter(([k, v]) => v != null && /height|bust|chest|waist|hip|shoe|dress|size|hair|eye/i.test(k) && typeof v !== 'object')) : {};
    const compact = roster.map(r => ({ model_id: r.id, name: r.display_name, stage: r.stage, status: r.status, market: r.primary_market_label || r.location || '', measurements: pick(mByModel.get(r.id)) }));
    let contacts = [];
    if (company[0]) {
      const links = await rows(admin.from('contact_company_links').select('contact_id,relationship_role').eq('organization_id', organization.id).eq('company_id', company[0].id).limit(50));
      if (links.length) contacts = await rows(admin.from('contacts').select('id,display_name,role').eq('organization_id', organization.id).in('id', links.map(l => l.contact_id)).limit(50));
    }
    const input = `SHOW UNDER REVIEW
Designer / show: ${clean(show.title).replace(/\s*\(by appointment\)\s*$/i, '')}
Type: ${(String(show.notes || '').match(/kind=(\w+)/) || [])[1] || 'show'}
Season: ${clean(season.name)} (${clean(season.starts_on)} to ${clean(season.ends_on)}) in ${clean(season.markets && season.markets.name)}
Scheduled: ${clean(show.starts_at)} at ${clean(show.location)}
Existing CRM company: ${company[0] ? JSON.stringify({ name: company[0].name, website: company[0].website }) : 'none'}
Existing linked contacts: ${JSON.stringify(contacts)}
Models already assigned to this show: ${JSON.stringify(assigned)}
Extra instruction from agent: ${clean(body.instruction).slice(0, 500) || 'none'}
Current date: ${new Date().toISOString()}

ROSTER (private, do not put in web queries):
${JSON.stringify(compact).slice(0, 70000)}`;
    const r = await askWeb({ system: SYSTEM, messages: [{ role: 'user', content: input }], web: true });
    const parsed = parseJsonLoose(r.text) || {};
    const valid = new Set(roster.map(x => x.id));
    const nameOf = new Map(roster.map(x => [x.id, x.display_name]));
    const suggestions = (Array.isArray(parsed.suggestions) ? parsed.suggestions : []).filter(x => valid.has(x.model_id)).map(x => ({ model_id: x.model_id, name: nameOf.get(x.model_id), score: Math.max(0, Math.min(100, Number(x.score) || 0)), reason: clean(x.reason).slice(0, 600), risks: clean(x.risks).slice(0, 300) })).sort((a, b) => b.score - a.score).slice(0, 8);
    const sources = new Map();
    for (const s of [...(Array.isArray(parsed.sources) ? parsed.sources : []), ...r.sources]) { const u = clean(s && s.url); if (/^https?:\/\//i.test(u) && !sources.has(u)) sources.set(u, { url: u, title: clean(s.title) || u }); }
    const directors = (Array.isArray(parsed.casting_directors) ? parsed.casting_directors : []).filter(x => clean(x.display_name)).slice(0, 8).map(x => ({ display_name: clean(x.display_name), role: clean(x.role), company: clean(x.company), email: clean(x.email), instagram: clean(x.instagram), source_url: clean(x.source_url), confidence: Math.max(0, Math.min(1, Number(x.confidence) || 0)) }));
    const result = { ok: true, show_id: showId, designer: parsed.designer || {}, casting_profile: parsed.casting_profile || {}, casting_directors: directors, suggestions, notes: Array.isArray(parsed.notes) ? parsed.notes.map(clean).filter(Boolean).slice(0, 8) : [], sources: [...sources.values()].slice(0, 20), searched: r.queries, provider: r.provider, model: r.model, parse_ok: !!parsed.designer, raw: parsed.designer ? undefined : r.text.slice(0, 4000) };
    try { await admin.from('ai_jobs').insert({ organization_id: organization.id, job_type: 'report', status: 'complete', requested_by: user.id, input: { compat: 'season-show-analysis', show_id: showId }, result, provider: r.provider, provider_model: r.model, completed_at: new Date().toISOString() }); } catch { /* best effort */ }
    return json(200, result);
  } catch (error) { return errorResponse(error); }
};
