/* Gives each signed-in team member their own DaySilk, inside the portal.
   Makes sure the company team ("Maison de Veux") exists in DaySilk's tables and that this person has a team-member
   account and a seat on it (owner for the founder, admin for people who manage the team, member for everyone else).
   Their DaySilk data is then theirs alone: each person's day lives in their own rows. Needs docs/sql/2026-11-05-daysilk.sql run once. */
import crypto from 'node:crypto';
import { requireUser, json, errorResponse, adminClient, assertPermission } from './_lib/auth.mjs';
import { requireStaffOrganization } from './_lib/agent-bridge.mjs';

const OWNER_EMAIL = () => String(process.env.DAYSILK_OWNER_EMAIL || 'demontez@maisondeveux.com').trim().toLowerCase();
const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const newCode = () => Array.from(crypto.randomBytes(8), b => CODE_CHARS[b % CODE_CHARS.length]).join('');
const missing = e => /does not exist|schema cache|relation .* not found|42P01|PGRST205/i.test(String(e?.message || '') + String(e?.code || ''));

async function ownerId(admin, fallback) {
  const want = OWNER_EMAIL();
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 100 });
    if (error) break;
    const users = data?.users || [];
    const hit = users.find(u => String(u.email || '').toLowerCase() === want);
    if (hit) return hit.id;
    if (users.length < 100) break;
  }
  return fallback;
}

export const handler = async event => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });
  try {
    const { user, client } = await requireUser(event);
    const { organization } = await requireStaffOrganization({ user, client, organizationSlug: 'maison-de-veux' });
    const admin = adminClient();
    const email = String(user.email || '').toLowerCase();

    const t = await admin.from('ds_teams').select('*').eq('organization_id', organization.id).limit(1).maybeSingle();
    if (t.error) { if (missing(t.error)) return json(503, { error: 'not_set_up', message: 'DaySilk needs its database tables. Run docs/sql/2026-11-05-daysilk.sql in Supabase once.' }); throw t.error; }
    let team = t.data;
    if (!team) {
      const owner = await ownerId(admin, user.id);
      const ins = await admin.from('ds_teams').insert({ organization_id: organization.id, name: organization.name || 'Maison de Veux', code: newCode(), owner_id: owner }).select('*').single();
      if (ins.error) throw ins.error;
      team = ins.data;
    }

    const prof = (await admin.from('profiles').select('display_name,first_name,last_name').eq('user_id', user.id).maybeSingle()).data || {};
    const display = prof.display_name || [prof.first_name, prof.last_name].filter(Boolean).join(' ') || email.split('@')[0];
    const first = prof.first_name || display.split(/\s+/)[0], last = prof.last_name || display.split(/\s+/).slice(1).join(' ');
    const role = email === OWNER_EMAIL() ? 'owner' : (await assertPermission(admin, user.id, organization.id, 'members.manage')) ? 'admin' : 'member';

    const mem = await admin.from('ds_members').select('role').eq('team_id', team.id).eq('user_id', user.id).maybeSingle();
    if (mem.error) throw mem.error;
    if (!mem.data) { const { error } = await admin.from('ds_members').insert({ team_id: team.id, user_id: user.id, role, name: display, email }); if (error) throw error; }
    else if (mem.data.role !== role && mem.data.role !== 'owner') { const { error } = await admin.from('ds_members').update({ role, name: display, email }).eq('team_id', team.id).eq('user_id', user.id); if (error) throw error; }

    const acc = await admin.from('ds_accounts').select('user_id,plan,status,team_id').eq('user_id', user.id).maybeSingle();
    if (acc.error) throw acc.error;
    if (!acc.data) { const { error } = await admin.from('ds_accounts').insert({ user_id: user.id, plan: 'member', status: 'member', team_id: team.id, first_name: first, last_name: last }); if (error) throw error; }
    else if (acc.data.plan !== 'member' || acc.data.status !== 'member' || acc.data.team_id !== team.id) { const { error } = await admin.from('ds_accounts').update({ plan: 'member', status: 'member', team_id: team.id }).eq('user_id', user.id); if (error) throw error; }

    return json(200, { ok: true, team: { id: team.id, name: team.name }, role });
  } catch (error) { return errorResponse(error); }
};
