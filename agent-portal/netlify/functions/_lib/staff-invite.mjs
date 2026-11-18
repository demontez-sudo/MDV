/* Inviting someone to the Maison de Veux team (staff): make their login if they have none, add them to the team as "invited",
   give them their roles, and email them a one-time link to set a password. They become active the first time they sign in
   (agent-bridge.mjs does that). Used from the Team page. */
import crypto from 'node:crypto';

export const EMAIL_RX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ADMIN_URL = 'https://www.maisondeveux.com/admin';
const clean = (v, max) => String(v == null ? '' : v).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').replace(/\s+/g, ' ').trim().slice(0, max);
const bad = (message, statusCode = 400) => { const e = new Error(message); e.statusCode = statusCode; e.publicMessage = message; return e; };
const esc = (v = '') => String(v).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

export function sanitizeInvite(body) {
  const email = clean(body && body.email, 160).toLowerCase();
  if (!EMAIL_RX.test(email)) throw bad('Enter a valid email address.');
  const first = clean(body.first_name, 60), last = clean(body.last_name, 60);
  const display = clean(body.display_name, 120) || [first, last].filter(Boolean).join(' ');
  if (display.length < 2) throw bad('Enter their name.');
  const ids = Array.isArray(body.role_ids) ? body.role_ids.map(x => clean(x, 64)).filter(Boolean) : [];
  if (ids.length > 12) throw bad('Choose up to 12 roles.');
  return { email, first_name: first || display.split(' ')[0], last_name: last || display.split(' ').slice(1).join(' '), display_name: display, job_title: clean(body.job_title, 120), role_ids: [...new Set(ids)] };
}

export function inviteEmail({ orgName, inviterName, name, url }) {
  const subject = 'You are invited to the ' + orgName + ' team';
  const html = `<div style="font-family:Arial,Helvetica,sans-serif;max-width:620px;margin:auto;padding:36px;color:#17130f"><div style="font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:#9a794b;margin-bottom:18px">VEUX DESK · ${esc(orgName)}</div><h1 style="font:500 28px Georgia,serif;margin:0 0 14px">Welcome to the team, ${esc(name.split(' ')[0])}</h1><p style="font-size:15px;line-height:1.6;margin:0 0 18px">${esc(inviterName || 'A teammate')} has invited you to the ${esc(orgName)} team portal. Choose a password to get started.</p><p style="margin:26px 0"><a href="${esc(url)}" style="background:#17130f;color:#fff;text-decoration:none;padding:14px 26px;border-radius:999px;font-size:14px;letter-spacing:.08em">SET MY PASSWORD</a></p><p style="font-size:13px;line-height:1.6;color:#6b5f52;margin:0">This link works once and expires, so use it soon. If it has expired, ask ${esc(inviterName || 'your teammate')} to resend the invite. If you were not expecting this, you can ignore the email.</p></div>`;
  const text = `${inviterName || 'A teammate'} has invited you to the ${orgName} team portal.\n\nChoose a password to get started:\n${url}\n\nThis link works once and expires. If it has expired, ask for the invite to be resent. If you were not expecting this, ignore this email.`;
  return { subject, html, text };
}

export async function findAuthUserByEmail(admin, email) {
  const target = String(email || '').trim().toLowerCase();
  for (let page = 1; page <= 30; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 100 });
    if (error) throw error;
    const users = (data && data.users) || [];
    const found = users.find(x => String(x.email || '').trim().toLowerCase() === target);
    if (found) return found;
    if (users.length < 100) break;
  }
  return null;
}

/* the one-time link, and the email that carries it. The link is never stored or shown to anyone but the invited person; only a redacted audit row is kept. */
export async function sendInviteEmail({ admin, organization, email, name, inviter, userId, sendEmail }) {
  const { data: link, error } = await admin.auth.admin.generateLink({ type: 'recovery', email });
  const token = link && link.properties && link.properties.hashed_token;
  if (error || !token) throw bad('The sign-in link could not be made. Try again in a moment.', 502);
  const url = `${ADMIN_URL}?recovery_token=${encodeURIComponent(token)}`;
  const { data: settings } = await admin.from('organization_settings').select('sender_name,sender_email,reply_to_email').eq('organization_id', organization.id).maybeSingle();
  const fromEmail = String((settings && settings.sender_email) || process.env.VEUX_DEFAULT_SENDER_EMAIL || '').trim().toLowerCase();
  if (!EMAIL_RX.test(fromEmail)) return { sent: false, reason: 'The agency sender email is not set up, so the email could not be sent.' };
  const senderName = (settings && settings.sender_name) || organization.name || 'Maison de Veux';
  const reply = EMAIL_RX.test(String((settings && settings.reply_to_email) || '').trim()) ? String(settings.reply_to_email).trim() : undefined;
  const mail = inviteEmail({ orgName: organization.name || 'Maison de Veux', inviterName: inviter, name, url });
  try {
    const delivery = await sendEmail({ from_name: senderName, from_email: fromEmail, reply_to: reply, to_emails: [email], cc_emails: [], bcc_emails: [], subject: mail.subject, html_body: mail.html, text_body: mail.text, idempotency_key: `staff-invite:${userId}:${Date.now()}` });
    await admin.from('email_messages').insert({ organization_id: organization.id, template_key: 'staff_invite', status: 'sent', provider: delivery.provider || 'resend', provider_message_id: delivery.providerMessageId || null, from_name: senderName, from_email: fromEmail, reply_to: reply || null, to_emails: [email], cc_emails: [], bcc_emails: [], subject: mail.subject, html_body: '[secure sign-in link delivered and redacted]', text_body: null, source_type: 'staff_invite', sent_at: new Date().toISOString(), metadata: { user_id: userId, secure_link_redacted: true } });
    return { sent: true };
  } catch (e) {
    return { sent: false, reason: 'The email could not be delivered: ' + String(e && e.message || e).slice(0, 120) };
  }
}

/* the whole invite. deps: { sendEmail, capacity: async () => void (throws when the plan is full), setRoles: async (memberId, roleIds) => void } */
export async function inviteStaff({ admin, organization, inviter, input, deps }) {
  const existingUser = await findAuthUserByEmail(admin, input.email);
  let memberRow = null;
  if (existingUser) {
    const { data: m, error } = await admin.from('organization_members').select('*').eq('organization_id', organization.id).eq('user_id', existingUser.id).eq('member_type', 'staff').maybeSingle();
    if (error) throw error;
    memberRow = m;
    if (m && ['active', 'invited'].includes(String(m.status))) throw bad(m.status === 'invited' ? 'They have already been invited. Use Resend invite instead.' : 'They are already on the team.', 409);
  }
  await deps.capacity();

  let user = existingUser, created = false;
  if (!user) {
    const password = `Vx!${crypto.randomBytes(14).toString('base64url')}7q`;       /* never shown or sent: they set their own through the link */
    const { data, error } = await admin.auth.admin.createUser({ email: input.email, password, email_confirm: true, user_metadata: { display_name: input.display_name, first_name: input.first_name, last_name: input.last_name } });
    if (error) throw error;
    user = data && data.user; created = true;
    if (!user) throw bad('The login could not be created.', 502);
  }
  try { await admin.from('profiles').upsert({ user_id: user.id, display_name: input.display_name, first_name: input.first_name, last_name: input.last_name }, { onConflict: 'user_id' }); }
  catch (e) { console.warn('[staff invite] profile not saved', e && e.message); }

  const fields = { status: 'invited', job_title: input.job_title || null, metadata: { ...(memberRow && memberRow.metadata || {}), invited_by: inviter.id, invited_at: new Date().toISOString() } };
  let member;
  if (memberRow) {
    const { data, error } = await admin.from('organization_members').update(fields).eq('organization_id', organization.id).eq('id', memberRow.id).select('*').single();
    if (error) throw error; member = data;
  } else {
    const { data, error } = await admin.from('organization_members').insert({ organization_id: organization.id, user_id: user.id, member_type: 'staff', ...fields }).select('*').single();
    if (error) throw error; member = data;
  }

  let rolesError = null;
  if (input.role_ids.length) { try { await deps.setRoles(member.id, input.role_ids); } catch (e) { rolesError = String(e && (e.publicMessage || e.message) || e).slice(0, 160); } }
  const email = await sendInviteEmail({ admin, organization, email: input.email, name: input.display_name, inviter: inviter.name, userId: user.id, sendEmail: deps.sendEmail });
  return { member_id: member.id, user_id: user.id, created_login: created, email_sent: email.sent, email_problem: email.reason || null, roles_error: rolesError };
}

/* send the invite again to someone still waiting (the link in the first email may have expired) */
export async function resendInvite({ admin, organization, inviter, memberId, deps }) {
  const { data: m, error } = await admin.from('organization_members').select('*').eq('organization_id', organization.id).eq('id', memberId).eq('member_type', 'staff').maybeSingle();
  if (error) throw error;
  if (!m) throw bad('That person was not found.', 404);
  if (String(m.status) !== 'invited') throw bad('They have already joined, so there is nothing to resend.', 409);
  const { data: u, error: ue } = await admin.auth.admin.getUserById(m.user_id);
  if (ue || !u || !u.user || !EMAIL_RX.test(String(u.user.email || ''))) throw bad('That person has no login email on file.', 409);
  const since = new Date(Date.now() - 60000).toISOString();
  const { data: recent } = await admin.from('email_messages').select('id').eq('organization_id', organization.id).eq('source_type', 'staff_invite').contains('to_emails', [u.user.email]).gte('created_at', since).limit(1);
  if (recent && recent.length) throw bad('An invite was just sent. Give it a minute before sending another.', 429);
  const { data: p } = await admin.from('profiles').select('display_name,first_name,last_name').eq('user_id', m.user_id).maybeSingle();
  const name = (p && (p.display_name || [p.first_name, p.last_name].filter(Boolean).join(' '))) || (u.user.user_metadata && u.user.user_metadata.display_name) || 'there';
  const out = await sendInviteEmail({ admin, organization, email: u.user.email, name, inviter: inviter.name, userId: m.user_id, sendEmail: deps.sendEmail });
  return { email_sent: out.sent, email_problem: out.reason || null, to: u.user.email };
}
