import { requireUser, parseBody, json, errorResponse, adminClient, assertPermission } from './_lib/auth.mjs';
import { requireStaffOrganization, requirePermission } from './_lib/agent-bridge.mjs';
import { clean, whoName } from './_lib/outreach-log.mjs';
import { GROUPS, SITUATIONS, AUDIENCES, fill, buildContext, unknownBlanks } from './_lib/email-formats.mjs';

// Email formats: the team's saved emails (brand intro, casting submission, follow-ups, scouting approach ...).
// Reading needs CRM access; writing needs CRM write or any active staff seat (same rule as the Outreach log).

const bad = (m, code = 400) => { const e = new Error(m); e.statusCode = code; e.publicMessage = m; return e; };
const likeSafe = v => clean(v).replace(/[\\%_,()]/g, ' ').trim();
async function one(q) { const { data, error } = await q; if (error) throw error; return data || null; }
async function rows(q) { const { data, error } = await q; if (error) throw error; return data || []; }
const oneOf = (v, list, dflt) => { const s = clean(v).toLowerCase(); return list.some(x => x[0] === s) ? s : dflt; };

async function requireWrite(userId, organizationId) {
  const admin = adminClient();
  if (await assertPermission(admin, userId, organizationId, 'crm.write')) return admin;
  const m = await one(admin.from('organization_members').select('id').eq('organization_id', organizationId).eq('user_id', userId).eq('member_type', 'staff').eq('status', 'active').maybeSingle());
  if (m?.id) return admin;
  throw bad('Missing permission: crm.write', 403);
}

function validate(body) {
  const name = clean(body.name).slice(0, 120), subject = String(body.subject ?? '').slice(0, 300), text = String(body.body ?? '').slice(0, 20000);
  if (!name) throw bad('Give the format a name.');
  if (!subject.trim() && !text.trim()) throw bad('Write a subject or a message.');
  const unknown = unknownBlanks(subject, text);
  if (unknown.length) throw bad('These blanks are not recognised: ' + unknown.map(k => '{{' + k + '}}').join(', ') + '. Use the Insert list.');
  return { name, subject, body: text, situation: oneOf(body.situation, SITUATIONS, 'other'), audience: oneOf(body.audience, AUDIENCES, 'any') };
}

async function lookup(admin, orgId, kind, q) {
  const s = likeSafe(q), pat = '%' + s + '%';
  if (kind === 'contact') {
    let r = admin.from('contacts').select('id,display_name,email,role,company_id').eq('organization_id', orgId).order('display_name').limit(12);
    if (s) r = r.or(`display_name.ilike.${pat},email.ilike.${pat}`);
    const list = await rows(r);
    const ids = [...new Set(list.map(x => x.company_id).filter(Boolean))];
    const cos = ids.length ? await rows(admin.from('companies').select('id,name').eq('organization_id', orgId).in('id', ids)) : [];
    const by = new Map(cos.map(c => [c.id, c.name]));
    return list.map(x => ({ id: x.id, label: x.display_name || x.email || 'Contact', sub: [x.role, by.get(x.company_id)].filter(Boolean).join(' · '), email: x.email || '', company_id: x.company_id || null }));
  }
  if (kind === 'company') {
    let r = admin.from('companies').select('id,name,company_type,email').eq('organization_id', orgId).order('name').limit(12);
    if (s) r = r.ilike('name', pat);
    return (await rows(r)).map(x => ({ id: x.id, label: x.name, sub: String(x.company_type || '').replace(/_/g, ' '), email: x.email || '' }));
  }
  if (kind === 'model') {
    let r = admin.from('models').select('id,display_name,primary_market_label').eq('organization_id', orgId).eq('active', true).order('display_name').limit(12);
    if (s) r = r.ilike('display_name', pat);
    return (await rows(r)).map(x => ({ id: x.id, label: x.display_name, sub: x.primary_market_label || '' }));
  }
  if (kind === 'prospect') {
    let r = admin.from('scouting_prospects').select('id,display_name,email,city,stage').eq('organization_id', orgId).order('display_name').limit(12);
    if (s) r = r.or(`display_name.ilike.${pat},email.ilike.${pat}`);
    return (await rows(r)).map(x => ({ id: x.id, label: x.display_name, sub: [x.city, String(x.stage || '').replace(/_/g, ' ')].filter(Boolean).join(' · '), email: x.email || '' }));
  }
  throw bad('Unknown lookup.');
}

async function render(admin, organization, user, body) {
  let subject = String(body.subject ?? ''), text = String(body.body ?? ''), tpl = null;
  if (body.template_id) {
    tpl = await one(admin.from('email_templates').select('*').eq('organization_id', organization.id).eq('id', body.template_id).maybeSingle());
    if (!tpl) throw bad('That format was not found.', 404);
    subject = tpl.subject; text = tpl.body;
  }
  const orgId = organization.id;
  const contact = body.contact_id ? await one(admin.from('contacts').select('id,first_name,last_name,display_name,email,role,company_id').eq('organization_id', orgId).eq('id', body.contact_id).maybeSingle()) : null;
  const companyId = body.company_id || contact?.company_id || null;
  const company = companyId ? await one(admin.from('companies').select('id,name,company_type,website,email').eq('organization_id', orgId).eq('id', companyId).maybeSingle()) : null;
  const model = body.model_id ? await one(admin.from('models').select('id,display_name,legacy_key,primary_market_label').eq('organization_id', orgId).eq('id', body.model_id).maybeSingle()) : null;
  let measurement = null;
  if (model) { try { measurement = await one(admin.from('model_measurements').select('*').eq('organization_id', orgId).eq('model_id', model.id).limit(1).maybeSingle()); } catch (_e) { measurement = null; } }
  const prospect = body.prospect_id ? await one(admin.from('scouting_prospects').select('id,display_name,first_name,last_name,email,city,country,instagram,height_display').eq('organization_id', orgId).eq('id', body.prospect_id).maybeSingle()) : null;
  let who = whoName(user);
  try { const p = await one(admin.from('profiles').select('display_name').eq('user_id', user.id).maybeSingle()); if (p?.display_name) who = p.display_name; } catch (_e) { /* keep the fallback */ }
  const ctx = buildContext({ contact, company, model, measurement, prospect, user, userName: who, agencyName: organization.name, extra: { package_link: clean(body.package_link) } });
  const s = fill(subject, ctx), b = fill(text, ctx);
  const to = clean(contact?.email || prospect?.email || company?.email || '');
  return {
    ok: true, subject: s.text, body: b.text, missing: [...new Set([...s.missing, ...b.missing])], to,
    link: { template_id: tpl?.id || null, template_name: tpl?.name || null, contact_id: contact?.id || null, company_id: company?.id || null, model_id: model?.id || null, model_name: model?.display_name || null, prospect_id: prospect?.id || null, to_email: to || null }
  };
}

export const handler = async event => {
  if (!['GET', 'POST'].includes(event.httpMethod)) return json(405, { error: 'Method not allowed' });
  try {
    const { user, client } = await requireUser(event);
    const p = event.queryStringParameters || {}, body = event.httpMethod === 'POST' ? parseBody(event) : {};
    const { organization } = await requireStaffOrganization({ user, client, organizationSlug: body.organization_slug || p.organization || 'maison-de-veux' });

    if (event.httpMethod === 'GET') {
      const admin = await requirePermission(user.id, organization.id, 'crm.read');
      if (p.lookup) return json(200, { ok: true, results: await lookup(admin, organization.id, p.lookup, p.q) });
      let q = admin.from('email_templates').select('*').eq('organization_id', organization.id).order('sort_order').order('name');
      if (p.all !== '1') q = q.eq('active', true);
      const { data, error } = await q;
      if (error) {
        if (/relation .* does not exist|schema cache/i.test(String(error.message))) return json(200, { ok: true, formats: [], groups: GROUPS, situations: SITUATIONS, audiences: AUDIENCES, setup_needed: true });
        throw error;
      }
      return json(200, { ok: true, formats: data || [], groups: GROUPS, situations: SITUATIONS, audiences: AUDIENCES });
    }

    const action = clean(body.action);
    if (action === 'render') { const admin = await requirePermission(user.id, organization.id, 'crm.read'); return json(200, await render(admin, organization, user, body)); }
    const admin = await requireWrite(user.id, organization.id);
    const now = new Date().toISOString();
    if (action === 'create') {
      const v = validate(body);
      const { data, error } = await admin.from('email_templates').insert({ organization_id: organization.id, ...v, active: true, sort_order: 100, created_by: user.id, updated_by: user.id }).select('*').single();
      if (error) throw /duplicate key|unique/i.test(String(error.message)) ? bad('A format with that name already exists.', 409) : error;
      return json(201, { ok: true, verified: true, format: data });
    }
    if (action === 'update') {
      const v = validate(body);
      const { data, error } = await admin.from('email_templates').update({ ...v, updated_by: user.id, updated_at: now }).eq('organization_id', organization.id).eq('id', body.id).select('*').maybeSingle();
      if (error) throw /duplicate key|unique/i.test(String(error.message)) ? bad('A format with that name already exists.', 409) : error;
      if (!data) throw bad('That format was not found.', 404);
      return json(200, { ok: true, verified: true, format: data });
    }
    if (action === 'archive' || action === 'restore') {
      const { data, error } = await admin.from('email_templates').update({ active: action === 'restore', updated_by: user.id, updated_at: now }).eq('organization_id', organization.id).eq('id', body.id).select('*').maybeSingle();
      if (error) throw error;
      if (!data) throw bad('That format was not found.', 404);
      return json(200, { ok: true, verified: true, format: data });
    }
    if (action === 'duplicate') {
      const src = await one(admin.from('email_templates').select('*').eq('organization_id', organization.id).eq('id', body.id).maybeSingle());
      if (!src) throw bad('That format was not found.', 404);
      for (let n = 1; n <= 20; n++) {
        const name = (src.name + (n === 1 ? ' (copy)' : ` (copy ${n})`)).slice(0, 120);
        const { data, error } = await admin.from('email_templates').insert({ organization_id: organization.id, name, situation: src.situation, audience: src.audience, subject: src.subject, body: src.body, active: true, sort_order: 100, created_by: user.id, updated_by: user.id }).select('*').single();
        if (!error) return json(201, { ok: true, verified: true, format: data });
        if (!/duplicate key|unique/i.test(String(error.message))) throw error;
      }
      throw bad('Could not make a copy. Rename the existing copies first.', 409);
    }
    throw bad('Unsupported action');
  } catch (error) { return errorResponse(error); }
};
