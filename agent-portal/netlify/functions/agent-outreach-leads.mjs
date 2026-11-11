import { requireUser, parseBody, json, errorResponse, adminClient } from './_lib/auth.mjs';
import { requireStaffOrganization, requirePermission } from './_lib/agent-bridge.mjs';
import { clean, cleanEmail } from './_lib/outreach-log.mjs';

// Outreach leads: who to contact next, worked out from Companies, Contacts, the Outreach log and Model Scouting.
//   follow_up    emailed a few days ago and nobody replied
//   re_engage    a company we have talked to before that has gone quiet
//   first        an active company we have never contacted
//   scouting     a scouted person nobody has emailed yet
// "plan" turns chosen leads into timed tasks on the person's schedule (they show on the DaySilk Day view).

const DAY = 864e5;
const rows = async q => { const { data, error } = await q; if (error) throw error; return data || []; };
const optional = async q => { const { data, error } = await q; return error ? [] : (data || []); };
const bad = (m, code = 400) => { const e = new Error(m); e.statusCode = code; e.publicMessage = m; return e; };
const TYPE_SCORE = t => /brand|casting|client|editorial|magazine|publication|fashion|production/i.test(String(t || '')) ? 2 : /agency|mother/i.test(String(t || '')) ? 1 : 0;
const days = (a, b) => Math.floor((b - a) / DAY);

export function buildLeads({ companies, contacts, acts, prospects, now = Date.now(), limits = { follow_up: 6, re_engage: 5, first: 6, scouting: 5 } }) {
  const coById = new Map(companies.map(c => [c.id, c]));
  const contactsByCo = new Map();
  for (const c of contacts) { if (!c.company_id) continue; const a = contactsByCo.get(c.company_id) || []; a.push(c); contactsByCo.set(c.company_id, a); }
  const ctById = new Map(contacts.map(c => [c.id, c]));
  const lastByCo = new Map(), lastOutByKey = new Map(), lastInByKey = new Map();
  for (const a of acts) {
    const t = new Date(a.occurred_at).getTime(); if (!t) continue;
    const co = a.company_id || ctById.get(a.contact_id)?.company_id || null;
    if (co && t > (lastByCo.get(co) || 0)) lastByCo.set(co, t);
    const key = a.contact_id ? 'c:' + a.contact_id : co ? 'o:' + co : null; if (!key) continue;
    if (a.direction === 'inbound') { if (t > (lastInByKey.get(key) || 0)) lastInByKey.set(key, t); }
    else if (!lastOutByKey.has(key) || t > lastOutByKey.get(key).t) lastOutByKey.set(key, { t, a });
  }
  const leads = [], used = new Set();
  const person = c => c ? { id: c.id, label: c.display_name || c.email || 'Contact', email: cleanEmail(c.email) || '', role: c.role || '' } : null;
  const pick = (co) => { const list = (contactsByCo.get(co.id) || []).filter(c => cleanEmail(c.email)); return list[0] || null; };

  // 1. follow-ups
  const fu = [];
  for (const [key, { t, a }] of lastOutByKey) {
    const st = a.metadata?.outreach?.status || 'sent';
    if (!['sent', 'no_reply'].includes(st)) continue;
    const age = days(t, now), due = a.metadata?.outreach?.follow_up_at && new Date(a.metadata.outreach.follow_up_at).getTime() <= now;
    if ((lastInByKey.get(key) || 0) > t) continue;
    if (!(age >= 4 || due) || age > 90) continue;
    const ct = a.contact_id ? ctById.get(a.contact_id) : null, co = coById.get(a.company_id || ct?.company_id);
    if (!ct && !co) continue;
    fu.push({ kind: 'follow_up', score: 100 + Math.min(age, 30) + (due ? 20 : 0), why: `Emailed ${age} day${age === 1 ? '' : 's'} ago${a.subject ? ' ("' + String(a.subject).slice(0, 50) + '")' : ''}, no reply`, contact: person(ct), company: co ? { id: co.id, label: co.name } : null, audience: /casting/i.test(co?.company_type || '') ? 'casting' : 'brand', last_touch: new Date(t).toISOString() });
  }
  fu.sort((x, y) => y.score - x.score).slice(0, limits.follow_up).forEach(l => { leads.push(l); used.add(l.company?.id || l.contact?.id); });

  // 2. quiet companies we have talked to before
  const re = [];
  for (const co of companies) {
    if (used.has(co.id)) continue;
    const t = lastByCo.get(co.id); if (!t) continue;
    const age = days(t, now); if (age < 45 || age > 540) continue;
    re.push({ kind: 're_engage', score: 60 + TYPE_SCORE(co.company_type) * 8 + Math.min(age / 10, 20), why: `Last in touch ${age} days ago`, contact: person(pick(co)), company: { id: co.id, label: co.name }, audience: /casting/i.test(co.company_type || '') ? 'casting' : 'brand', last_touch: new Date(t).toISOString() });
  }
  re.sort((x, y) => y.score - x.score).slice(0, limits.re_engage).forEach(l => { leads.push(l); used.add(l.company.id); });

  // 3. never contacted
  const first = [];
  for (const co of companies) {
    if (used.has(co.id) || lastByCo.has(co.id)) continue;
    const ct = pick(co), email = ct ? cleanEmail(ct.email) : cleanEmail(co.email);
    if (!email) continue;
    first.push({ kind: 'first', score: 40 + TYPE_SCORE(co.company_type) * 10 + (ct ? 5 : 0), why: 'Never contacted' + (co.company_type ? ' · ' + String(co.company_type).replace(/_/g, ' ') : ''), contact: person(ct), company: { id: co.id, label: co.name, email: cleanEmail(co.email) }, audience: /casting/i.test(co.company_type || '') ? 'casting' : 'brand', last_touch: null });
  }
  first.sort((x, y) => y.score - x.score).slice(0, limits.first).forEach(l => leads.push(l));

  // 4. scouted people nobody has emailed
  const sc = [];
  for (const p of prospects) {
    if (!cleanEmail(p.email)) continue;
    if (!['new_lead', 'new', 'lead'].includes(String(p.stage || '').toLowerCase())) continue;
    const md = p.metadata && typeof p.metadata === 'object' ? p.metadata : {};
    if ((Array.isArray(md.email_log) && md.email_log.length) || md.scout?.outreach?.model?.emailed_at) continue;
    sc.push({ kind: 'scouting', score: 30, why: 'Scouted' + (p.city ? ' in ' + p.city : '') + ', not contacted yet', prospect: { id: p.id, label: p.display_name, email: cleanEmail(p.email) }, audience: 'scout', last_touch: null });
  }
  sc.slice(0, limits.scouting).forEach(l => leads.push(l));
  return leads;
}

export const handler = async event => {
  if (!['GET', 'POST'].includes(event.httpMethod)) return json(405, { error: 'Method not allowed' });
  try {
    const { user, client } = await requireUser(event);
    const p = event.queryStringParameters || {}, body = event.httpMethod === 'POST' ? parseBody(event) : {};
    const { organization } = await requireStaffOrganization({ user, client, organizationSlug: body.organization_slug || p.organization || 'maison-de-veux' });
    const orgId = organization.id;

    if (event.httpMethod === 'GET') {
      const admin = await requirePermission(user.id, orgId, 'crm.read');
      const [companies, contacts, acts, prospects] = await Promise.all([
        rows(admin.from('companies').select('id,name,company_type,status,website,email').eq('organization_id', orgId).limit(2000)),
        rows(admin.from('contacts').select('id,display_name,email,role,company_id').eq('organization_id', orgId).limit(4000)),
        rows(admin.from('crm_activity').select('id,company_id,contact_id,activity_type,direction,subject,occurred_at,metadata').eq('organization_id', orgId).order('occurred_at', { ascending: false }).limit(4000)),
        optional(admin.from('scouting_prospects').select('id,display_name,email,city,stage,metadata').eq('organization_id', orgId).limit(800))
      ]);
      const active = companies.filter(c => !/inactive|archiv|closed|lost/i.test(String(c.status || '')));
      return json(200, { ok: true, leads: buildLeads({ companies: active, contacts, acts, prospects }) });
    }

    if (clean(body.action) !== 'plan') throw bad('Unsupported action');
    const admin = adminClient();
    const leads = Array.isArray(body.leads) ? body.leads.slice(0, 12) : [];
    const slots = Array.isArray(body.slots) ? body.slots : [];
    if (!leads.length) throw bad('Choose at least one lead.');
    const member = (await rows(admin.from('organization_members').select('id').eq('organization_id', orgId).eq('user_id', user.id).eq('member_type', 'staff').eq('status', 'active').limit(1)))[0];
    const made = [];
    for (let i = 0; i < leads.length; i++) {
      const l = leads[i] || {}, who = clean(l.contact_label || l.prospect_label || l.company_label || 'lead').slice(0, 80);
      const verb = l.kind === 'follow_up' ? 'Follow up with' : l.kind === 'scouting' ? 'Email scouted person' : l.kind === 're_engage' ? 'Re-engage' : 'Introduce us to';
      const title = `Outreach: ${verb} ${who}${l.company_label && who !== l.company_label ? ' (' + clean(l.company_label).slice(0, 60) + ')' : ''}`;
      const due = slots[i] && !isNaN(new Date(slots[i])) ? new Date(slots[i]).toISOString() : null;
      const base = { organization_id: orgId, title, description: clean(l.why).slice(0, 400) || null, priority: 'normal', due_at: due, category: 'outreach', status: 'open' };
      let ins = await admin.from('tasks').insert({ ...base, created_by: user.id, visibility: 'organization', metadata: { outreach_lead: { kind: l.kind || null, contact_id: l.contact_id || null, company_id: l.company_id || null, prospect_id: l.prospect_id || null } } }).select('id,title,due_at').single();
      if (ins.error) ins = await admin.from('tasks').insert(base).select('id,title,due_at').single();
      if (ins.error) throw ins.error;
      if (member?.id) { try { await admin.from('task_assignments').insert({ organization_id: orgId, task_id: ins.data.id, member_id: member.id, assignment_role: 'assignee', assigned_by: user.id }); } catch (_e) { /* the task still exists */ } }
      made.push(ins.data);
    }
    return json(201, { ok: true, verified: true, tasks: made });
  } catch (error) { return errorResponse(error); }
};
