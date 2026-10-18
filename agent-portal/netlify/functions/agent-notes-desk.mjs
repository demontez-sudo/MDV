import { requireUser, parseBody, json, errorResponse, adminClient } from './_lib/auth.mjs';
import { requireStaffOrganization } from './_lib/agent-bridge.mjs';

/* Smart Notes. One table, attached to anything through `links`: [{type,id,label}].
   Read: every active staff member sees team notes; private notes only their author. */

const KINDS = ['note', 'call', 'meeting', 'decision', 'idea', 'update'];
const VIS = ['team', 'private', 'model'];
const LINK_TYPES = ['model', 'contact', 'company', 'booking', 'casting', 'package', 'task', 'scout', 'page'];
const SETUP_SQL_FILE = 'docs/sql/2026-10-18-smart-notes.sql';

const clean = (v, n = 200) => String(v == null ? '' : v).trim().slice(0, n);
const bad = (m, code = 'NOTES_VALIDATION_ERROR') => { const e = new Error(m); e.statusCode = 400; e.code = code; return e; };
const isMissing = e => /42P01|does not exist|schema cache|relation .*smart_notes/i.test(String(e?.code || '') + ' ' + String(e?.message || ''));
async function rows(q) { const { data, error } = await q; if (error) throw error; return data || []; }
async function soft(q) { const { data, error } = await q; if (error) { console.warn('[notes optional]', error.message); return []; } return data || []; }

function cleanLinks(v) {
  const seen = new Set(), out = [];
  for (const l of Array.isArray(v) ? v : []) {
    const type = clean(l?.type, 20).toLowerCase(), id = clean(l?.id, 80);
    if (!LINK_TYPES.includes(type) || !id || seen.has(type + ':' + id)) continue;
    seen.add(type + ':' + id); out.push({ type, id, label: clean(l?.label, 120) });
    if (out.length >= 25) break;
  }
  return out;
}
const cleanMentions = v => (Array.isArray(v) ? v : []).slice(0, 20).map(m => ({ user_id: clean(m?.user_id, 80), name: clean(m?.name, 100) })).filter(m => m.user_id);
const cleanTags = v => [...new Set((Array.isArray(v) ? v : []).map(t => clean(t, 30).toLowerCase().replace(/[^a-z0-9_-]/g, '')).filter(t => t.length > 1))].slice(0, 12);
const cleanDate = v => { if (!v) return null; const d = new Date(v); return isNaN(d) ? null : d.toISOString(); };
function cleanSmart(v) {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return {};
  const s = JSON.stringify(v);
  if (s.length > 8000) return {};
  return JSON.parse(s);
}
async function whoAmI(admin, orgId, user) {
  let name = String(user?.user_metadata?.full_name || user?.user_metadata?.name || '').trim(), memberId = null;
  try {
    const m = await admin.from('organization_members').select('id').eq('organization_id', orgId).eq('user_id', user.id).maybeSingle();
    memberId = m.data?.id || null;
    if (!name) { const p = await admin.from('profiles').select('display_name,first_name,last_name').eq('user_id', user.id).maybeSingle(); name = String(p.data?.display_name || [p.data?.first_name, p.data?.last_name].filter(Boolean).join(' ') || '').trim(); }
  } catch (_e) { /* best effort */ }
  return { id: user.id, member_id: memberId, name: name || String(user.email || 'Team') };
}
const visible = (n, me) => n.visibility !== 'private' || n.author_id === me.id;
const shape = n => ({ id: n.id, parent_id: n.parent_id || null, kind: n.kind || 'note', title: n.title || '', body: n.body || '', visibility: n.visibility || 'team', pinned: !!n.pinned, resolved: !!n.resolved, author_id: n.author_id || null, author_name: n.author_name || '', links: Array.isArray(n.links) ? n.links : [], mentions: Array.isArray(n.mentions) ? n.mentions : [], tags: Array.isArray(n.tags) ? n.tags : [], follow_up_at: n.follow_up_at || null, smart: n.smart || {}, created_at: n.created_at, updated_at: n.updated_at });

export const handler = async event => {
  if (!['GET', 'POST'].includes(event.httpMethod)) return json(405, { error: 'Method not allowed' });
  try {
    const { user, client } = await requireUser(event);
    const body = event.httpMethod === 'POST' ? parseBody(event) : {}, p = event.queryStringParameters || {};
    const { organization } = await requireStaffOrganization({ user, client, organizationSlug: body.organization_slug || p.organization || 'maison-de-veux' });
    const admin = adminClient(), orgId = organization.id;
    const me = await whoAmI(admin, orgId, user);

    if (event.httpMethod === 'POST') {
      const action = clean(body.action, 30);

      if (action === 'create') {
        const text = String(body.body == null ? '' : body.body).trim();
        if (!text) throw bad('Write something first.');
        if (text.length > 20000) throw bad('That note is too long.');
        const row = {
          organization_id: orgId, parent_id: clean(body.parent_id, 80) || null, kind: KINDS.includes(body.kind) ? body.kind : 'note', title: clean(body.title, 160) || null, body: text,
          visibility: VIS.includes(body.visibility) ? body.visibility : 'team', links: cleanLinks(body.links), mentions: cleanMentions(body.mentions), tags: cleanTags(body.tags),
          follow_up_at: cleanDate(body.follow_up_at), smart: cleanSmart(body.smart), author_id: user.id, author_name: me.name
        };
        const { data, error } = await admin.from('smart_notes').insert(row).select('*').single();
        if (error) throw error;
        return json(200, { ok: true, verified: true, note: shape(data) });
      }

      if (['update', 'pin', 'resolve', 'archive', 'follow_up'].includes(action)) {
        const id = clean(body.id, 80); if (!id) throw bad('id is required.');
        const cur = await admin.from('smart_notes').select('*').eq('organization_id', orgId).eq('id', id).maybeSingle();
        if (cur.error) throw cur.error;
        if (!cur.data || !visible(cur.data, me)) { const e = new Error('Note not found.'); e.statusCode = 404; throw e; }
        const mine = cur.data.author_id === user.id;
        const patch = { updated_at: new Date().toISOString() };
        if (action === 'pin') patch.pinned = !!body.pinned;
        else if (action === 'resolve') patch.resolved = !!body.resolved;
        else if (action === 'follow_up') patch.follow_up_at = cleanDate(body.follow_up_at);
        else {
          if (!mine) { const e = new Error('Only the author can change or remove a note.'); e.statusCode = 403; throw e; }
          if (action === 'archive') patch.archived = true;
          else {
            if (body.body != null) { const t = String(body.body).trim(); if (!t) throw bad('A note cannot be empty.'); patch.body = t.slice(0, 20000); }
            if (body.title != null) patch.title = clean(body.title, 160) || null;
            if (body.kind != null && KINDS.includes(body.kind)) patch.kind = body.kind;
            if (body.visibility != null && VIS.includes(body.visibility)) patch.visibility = body.visibility;
            if (body.links != null) patch.links = cleanLinks(body.links);
            if (body.mentions != null) patch.mentions = cleanMentions(body.mentions);
            if (body.tags != null) patch.tags = cleanTags(body.tags);
            if (Object.prototype.hasOwnProperty.call(body, 'follow_up_at')) patch.follow_up_at = cleanDate(body.follow_up_at);
            if (body.smart != null) patch.smart = cleanSmart(body.smart);
          }
        }
        const { data, error } = await admin.from('smart_notes').update(patch).eq('organization_id', orgId).eq('id', id).select('*').single();
        if (error) throw error;
        return json(200, { ok: true, verified: true, note: shape(data) });
      }
      return json(400, { error: 'Unsupported notes action' });
    }

    /* ---- read ---- */
    const entityType = clean(p.entity_type, 20).toLowerCase(), entityId = clean(p.entity_id, 80);
    let q = admin.from('smart_notes').select('*').eq('organization_id', orgId).eq('archived', false).order('pinned', { ascending: false }).order('created_at', { ascending: false }).limit(Math.min(Number(p.limit) || 400, 800));
    if (entityType && entityId && LINK_TYPES.includes(entityType)) q = q.contains('links', [{ type: entityType, id: entityId }]);
    let data;
    try { data = await rows(q); } catch (e) { if (isMissing(e)) return json(503, { error: 'Smart Notes needs its database table before it can be used.', code: 'SMART_NOTES_TABLE_MISSING', setup_file: SETUP_SQL_FILE }); throw e; }
    const notes = data.filter(n => visible(n, me)).map(shape);
    const out = { ok: true, me, notes };

    /* who can be @mentioned, and what can be linked: names only, cached by the page */
    if (p.directory === '1') {
      const [members, models, contacts, companies] = await Promise.all([
        soft(admin.from('organization_members').select('id,user_id,job_title').eq('organization_id', orgId).eq('member_type', 'staff').eq('status', 'active')),
        soft(admin.from('models').select('id,display_name,status').eq('organization_id', orgId).order('display_name').limit(1200)),
        soft(admin.from('contacts').select('id,display_name,company_id').eq('organization_id', orgId).order('display_name').limit(2000)),
        soft(admin.from('companies').select('id,name').eq('organization_id', orgId).order('name').limit(1000))
      ]);
      const uids = members.map(m => m.user_id).filter(Boolean);
      const profs = uids.length ? await soft(admin.from('profiles').select('user_id,display_name,first_name,last_name').in('user_id', uids)) : [];
      const pm = new Map(profs.map(x => [x.user_id, x]));
      out.directory = {
        members: members.map(m => { const pr = pm.get(m.user_id) || {}; return { user_id: m.user_id, member_id: m.id, name: String(pr.display_name || [pr.first_name, pr.last_name].filter(Boolean).join(' ') || '').trim(), title: m.job_title || '' }; }).filter(m => m.user_id && m.name),
        models: models.filter(m => !/^archiv|^releas/i.test(String(m.status || ''))).map(m => ({ id: m.id, name: m.display_name })).filter(m => m.name),
        contacts: contacts.map(c => ({ id: c.id, name: c.display_name, company_id: c.company_id || null })).filter(c => c.name),
        companies: companies.map(c => ({ id: c.id, name: c.name })).filter(c => c.name)
      };
    }
    return json(200, out);
  } catch (error) {
    if (isMissing(error)) return json(503, { error: 'Smart Notes needs its database table before it can be used.', code: 'SMART_NOTES_TABLE_MISSING', setup_file: SETUP_SQL_FILE });
    return errorResponse(error);
  }
};
