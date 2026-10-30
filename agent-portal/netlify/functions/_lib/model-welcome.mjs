/* The welcome package for a new model: make (or reset) the portal login with a temporary password, then send
   "Welcome to CAVYRE by Maison de Veux" with the sign-in details, a guide to the portal, and the model's agent in CC.
   The temporary password only ever travels in that email: the copy kept in email_messages is redacted. */
import crypto from 'node:crypto';
import { sendResendEmail } from './email.mjs';
import { verifyModelPassword } from './model-auth-verifier.mjs';

const PORTAL_URL = 'https://maisondeveux.com/portal';
const TEMP_DAYS = 7;
const EMAIL_RX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RESET_FLAG = 'cavyre_password_reset_required';
const TEMP_EXP = 'cavyre_temp_password_expires_at';
const DISABLED = 'cavyre_portal_disabled';

const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const lc = v => String(v || '').trim().toLowerCase();
const tempPassword = () => `Cv!${crypto.randomBytes(12).toString('base64url')}9a`;
const safeMeta = u => (u && u.app_metadata && typeof u.app_metadata === 'object' ? u.app_metadata : {});

async function findAuthUserByEmail(admin, email) {
  const target = lc(email);
  if (!EMAIL_RX.test(target)) return null;
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 100 });
    if (error) throw error;
    const users = data?.users || [];
    const found = users.find(x => lc(x.email) === target);
    if (found) return found;
    if (users.length < 100) break;
  }
  return null;
}

/* Make sure this model has a portal login with a fresh temporary password the model must change on first sign-in. */
export async function issueModelLogin(admin, { organization, model, email, issuedBy }) {
  const expires = new Date(Date.now() + TEMP_DAYS * 864e5).toISOString();
  const password = tempPassword();
  const flags = { [RESET_FLAG]: true, [TEMP_EXP]: expires, [DISABLED]: false, cavyre_temporary_login_ready: true, cavyre_password_reset_issued_at: new Date().toISOString(), cavyre_password_reset_issued_by: issuedBy };

  const { data: link, error: linkErr } = await admin.from('model_user_links').select('id,user_id').eq('organization_id', organization.id).eq('model_id', model.id).maybeSingle();
  if (linkErr) throw linkErr;
  let authUser = null, created = false;
  if (link) {
    const got = await admin.auth.admin.getUserById(link.user_id);
    if (!got.error && got.data?.user) authUser = got.data.user;
  }
  if (!authUser) authUser = await findAuthUserByEmail(admin, email);

  if (!authUser) {
    const { data, error } = await admin.auth.admin.createUser({ email: lc(email), password, email_confirm: true, app_metadata: { role: 'model', organization_id: organization.id, cavyre_model_id: model.id, cavyre_account_created_by: issuedBy, ...flags } });
    if (error) throw error;
    authUser = data.user; created = true;
  } else {
    const meta = safeMeta(authUser);
    const { data, error } = await admin.auth.admin.updateUserById(authUser.id, { password, email_confirm: true, ban_duration: 'none', app_metadata: { ...meta, role: meta.role || 'model', organization_id: meta.organization_id || organization.id, cavyre_model_id: model.id, ...flags } });
    if (error) throw error;
    authUser = data.user;
  }
  if (!link) {
    const { error } = await admin.from('model_user_links').insert({ organization_id: organization.id, model_id: model.id, user_id: authUser.id });
    if (error) throw error;
  } else if (link.user_id !== authUser.id) {
    const { error } = await admin.from('model_user_links').update({ user_id: authUser.id }).eq('id', link.id);
    if (error) throw error;
  }

  /* prove the credential works before it goes out */
  const check = await verifyModelPassword({ email: authUser.email, password });
  if (check.user_id !== authUser.id) { const e = new Error('The new login could not be verified.'); e.statusCode = 409; throw e; }
  return { user: authUser, login_email: lc(authUser.email), temporary_password: password, expires_at: expires, created };
}

/* The model's agents: assigned staff first (primary first), otherwise the person who made the profile. */
export async function resolveAgents(admin, { organization, modelId, fallbackUser, exclude = [] }) {
  const out = [];
  const push = (email, name, title) => { email = lc(email); if (EMAIL_RX.test(email) && !exclude.includes(email) && !out.some(x => x.email === email)) out.push({ email, name: name || email, title: title || '' }); };
  try {
    const { data: assigns } = await admin.from('model_staff_assignments').select('*').eq('organization_id', organization.id).eq('model_id', modelId);
    const sorted = (assigns || []).slice().sort((a, b) => (b.is_primary ? 1 : 0) - (a.is_primary ? 1 : 0));
    const ids = [...new Set(sorted.map(a => a.member_id).filter(Boolean))];
    if (ids.length) {
      const { data: members } = await admin.from('organization_members').select('id,user_id,job_title,status').eq('organization_id', organization.id).in('id', ids);
      const byId = new Map((members || []).map(m => [String(m.id), m]));
      const userIds = (members || []).map(m => m.user_id).filter(Boolean);
      const { data: profiles } = userIds.length ? await admin.from('profiles').select('user_id,display_name').in('user_id', userIds) : { data: [] };
      const pn = new Map((profiles || []).map(p => [String(p.user_id), p.display_name]));
      for (const a of sorted) {
        const m = byId.get(String(a.member_id));
        if (!m || m.status === 'disabled' || m.status === 'removed') continue;
        const u = await admin.auth.admin.getUserById(m.user_id);
        if (u.data?.user?.email) push(u.data.user.email, pn.get(String(m.user_id)), m.job_title);
        if (out.length >= 3) break;
      }
    }
  } catch (_e) { /* fall back below */ }
  if (!out.length && fallbackUser?.email) {
    let name = '';
    try { const { data } = await admin.from('profiles').select('display_name').eq('user_id', fallbackUser.id).maybeSingle(); name = data?.display_name || ''; } catch (_e) { /* optional */ }
    push(fallbackUser.email, name, '');
  }
  return out;
}

const STEPS = [
  ['Open your portal', 'Go to <b>maisondeveux.com/portal</b> on your phone or computer.'],
  ['Sign in with the details above', 'Use your email and the temporary password. Type it exactly as shown, or copy and paste it.'],
  ['Create your own password', 'The first time you sign in you will be asked to choose a new password (at least 10 characters). Your temporary password stops working once you do.'],
  ['Check My Profile', 'Open <b>My Profile</b> and make sure your contact details, measurements and emergency contact are right.'],
  ['Look through your materials', 'Check your <b>Digitals</b>, <b>Portfolio</b> and <b>Comp Card</b>. Tell your agent if anything is out of date.'],
  ['Save it to your phone', 'On iPhone: Share, then <b>Add to Home Screen</b>. On Android: menu, then <b>Install app</b>. It then opens like any other app.'],
];
const SECTIONS = [
  ['My Desk', [['Overview', 'Your day at a glance: what needs your answer, and what is coming up.'], ['Schedule', 'Every casting, booking, fitting and trip in one calendar. Mark days you are unavailable here.'], ['Gameplan', 'Your development plan with goals and next steps. Your agent may also share a shoot plan and shot list for a job.']]],
  ['My Work', [['Castings and Bookings', 'See the details, then accept or decline. Please reply quickly, clients are waiting on you.'], ['Digitals, Portfolio and Comp Card', 'The photos and comp card your agency sends to clients. Download your digitals for reference.'], ['Skin &amp; Walks', 'Upload walking and skin videos when your agent asks for them.']]],
  ['Agency', [['Messages and Updates', 'Talk to your agent here. When something changes, such as a time or a location, you are asked to acknowledge it.'], ['Approvals', 'Requests that need your yes or no before the agency can go ahead.'], ['Travel &amp; Visa', 'Flights, housing, visa and work-permit status, with documents to upload.'], ['Documents', 'Contracts, call sheets and anything else shared with you.'], ['My Account', 'What you have earned and what is owed, with statements.'], ['Wellness', 'Check-ins and support resources.']]],
];

export function buildWelcomeEmail({ firstName, loginEmail, temporaryPassword, expiresAt, agents, senderName }) {
  const name = firstName || 'there';
  const exp = new Date(expiresAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const lead = agents[0];
  const contact = lead ? `${esc(lead.name)}${lead.title ? ' (' + esc(lead.title) + ')' : ''}, <a href="mailto:${esc(lead.email)}" style="color:#8a6a35">${esc(lead.email)}</a>` : 'your agent';
  const subject = 'Welcome to CAVYRE by Maison de Veux';
  const steps = STEPS.map((s, i) => `<tr><td style="width:34px;vertical-align:top;padding:0 0 14px"><div style="width:26px;height:26px;border-radius:50%;background:#171512;color:#f8f4ec;font-size:12px;line-height:26px;text-align:center">${i + 1}</div></td><td style="padding:2px 0 14px;font-size:14.5px;line-height:1.6;color:#4a423a"><b style="color:#171512">${s[0]}.</b> ${s[1]}</td></tr>`).join('');
  const sections = SECTIONS.map(g => `<div style="margin:0 0 18px"><div style="font-size:10px;letter-spacing:.18em;text-transform:uppercase;color:#a57a42;margin:0 0 8px">${g[0]}</div>${g[1].map(x => `<div style="padding:9px 0;border-top:1px solid #e3d9c9;font-size:14px;line-height:1.55;color:#4a423a"><b style="color:#171512">${x[0]}</b> &mdash; ${x[1]}</div>`).join('')}</div>`).join('');
  const html = `<div style="background:#f5f0e7;padding:36px 14px;font-family:Arial,Helvetica,sans-serif;color:#171512"><div style="max-width:640px;margin:auto;border:1px solid #d8cdbd;background:#f8f4ec">
<div style="padding:30px 32px;border-bottom:1px solid #d8cdbd;text-align:center"><div style="font-size:9px;letter-spacing:.24em;text-transform:uppercase;color:#8a765c">New York &middot; Paris</div><div style="font-family:Georgia,'Times New Roman',serif;font-size:32px;margin-top:8px">CAVYRE</div><div style="font-size:10px;letter-spacing:.22em;text-transform:uppercase;color:#756c61;margin-top:6px">by Maison de Veux</div></div>
<div style="padding:34px 34px 8px"><h1 style="font-family:Georgia,'Times New Roman',serif;font-size:30px;font-weight:400;margin:0 0 14px">Welcome, ${esc(name)}.</h1>
<p style="font-size:15px;line-height:1.7;color:#4a423a;margin:0 0 14px">We are delighted to have you with Maison de Veux. Your personal portal is ready. It is where you will see your castings and bookings, your schedule, your materials and your travel, and where you will message your agent.</p>
<p style="font-size:15px;line-height:1.7;color:#4a423a;margin:0 0 22px">Your agent is copied on this email so you both have the same details.</p></div>
<div style="padding:0 34px 8px"><div style="border:1px solid #171512;background:#fff;padding:22px 22px 18px">
<div style="font-size:10px;letter-spacing:.18em;text-transform:uppercase;color:#a57a42;margin:0 0 14px">Your sign-in details</div>
<table role="presentation" style="width:100%;border-collapse:collapse"><tr><td style="padding:6px 0;font-size:12px;color:#756c61;width:150px">Portal</td><td style="padding:6px 0;font-size:14.5px"><a href="${PORTAL_URL}" style="color:#171512">maisondeveux.com/portal</a></td></tr>
<tr><td style="padding:6px 0;font-size:12px;color:#756c61">Email</td><td style="padding:6px 0;font-size:14.5px">${esc(loginEmail)}</td></tr>
<tr><td style="padding:6px 0;font-size:12px;color:#756c61">Temporary password</td><td style="padding:6px 0"><span style="font-family:'Courier New',monospace;font-size:16px;letter-spacing:.04em;background:#f1ebdf;padding:6px 10px;display:inline-block">${esc(temporaryPassword)}</span></td></tr></table>
<p style="margin:18px 0 0;text-align:center"><a href="${PORTAL_URL}" style="display:inline-block;background:#171512;color:#f8f4ec;text-decoration:none;padding:15px 26px;font-size:11px;font-weight:700;letter-spacing:.16em;text-transform:uppercase">Open my portal</a></p>
<p style="margin:16px 0 0;font-size:12.5px;line-height:1.6;color:#756c61">This temporary password works until <b>${esc(exp)}</b> and is for you only. Please do not forward this email. You will choose your own password the first time you sign in.</p></div></div>
<div style="padding:30px 34px 6px"><h2 style="font-family:Georgia,'Times New Roman',serif;font-size:24px;font-weight:400;margin:0 0 16px">Getting started</h2><table role="presentation" style="width:100%;border-collapse:collapse">${steps}</table></div>
<div style="padding:14px 34px 6px"><h2 style="font-family:Georgia,'Times New Roman',serif;font-size:24px;font-weight:400;margin:0 0 6px">What is in your portal</h2><p style="font-size:13.5px;color:#756c61;margin:0 0 16px;line-height:1.6">The menu on the left (or <b>More</b> on a phone) is organised like this.</p>${sections}</div>
<div style="padding:10px 34px 6px"><h2 style="font-family:Georgia,'Times New Roman',serif;font-size:24px;font-weight:400;margin:0 0 12px">Good habits</h2>
<ul style="margin:0;padding:0 0 0 20px;font-size:14px;line-height:1.75;color:#4a423a"><li>Reply to castings, bookings and approvals as soon as you can.</li><li>Keep your <b>Schedule</b> up to date. Mark days you cannot work.</li><li>When the portal shows an <b>Updated</b> tag, open it and acknowledge the change.</li><li>Keep your profile, measurements and documents current. Tell your agent about any change in your look.</li></ul></div>
<div style="padding:24px 34px 34px"><div style="border-top:1px solid #d8cdbd;padding-top:20px;font-size:14px;line-height:1.7;color:#4a423a"><b style="color:#171512">Trouble signing in?</b> Tap <b>Forgot password</b> on the sign-in page and we will email you a secure link. For anything else, contact ${contact}.<br><br>Welcome to the family,<br><b style="color:#171512">${esc(senderName || 'Maison de Veux')}</b></div></div></div>
<p style="max-width:640px;margin:14px auto 0;text-align:center;font-size:11px;color:#8a765c">You are receiving this because an agency profile was created for you at Maison de Veux.</p></div>`;
  const text = `Welcome to CAVYRE by Maison de Veux\n\nHi ${name},\n\nYour personal portal is ready. Your agent is copied on this email.\n\nSIGN IN\nPortal: ${PORTAL_URL}\nEmail: ${loginEmail}\nTemporary password: ${temporaryPassword}\n(works until ${exp}; you will choose your own password the first time you sign in)\n\nGETTING STARTED\n${STEPS.map((s, i) => `${i + 1}. ${s[0]}: ${s[1].replace(/<[^>]+>/g, '')}`).join('\n')}\n\nWHAT IS IN YOUR PORTAL\n${SECTIONS.map(g => g[0] + '\n' + g[1].map(x => `- ${x[0].replace(/&amp;/g, '&')}: ${x[1].replace(/&amp;/g, '&')}`).join('\n')).join('\n\n')}\n\nGOOD HABITS\n- Reply to castings, bookings and approvals as soon as you can.\n- Keep your Schedule up to date and mark days you cannot work.\n- Acknowledge any change the portal flags as Updated.\n- Keep your profile, measurements and documents current.\n\nTrouble signing in? Tap Forgot password on the sign-in page, or contact ${lead ? lead.name + ' at ' + lead.email : 'your agent'}.\n\nWelcome to the family,\n${senderName || 'Maison de Veux'}\n`;
  return { subject, html, text };
}

/* Everything in one call. Returns what happened; throws only if the login itself could not be made. */
export async function sendModelWelcome(admin, { organization, model, email, user, resend = false }) {
  email = lc(email);
  if (!EMAIL_RX.test(email)) { const e = new Error('The model needs a valid email address before a welcome email can be sent.'); e.statusCode = 400; e.publicMessage = e.message; throw e; }
  const login = await issueModelLogin(admin, { organization, model, email, issuedBy: user.id });
  const agents = await resolveAgents(admin, { organization, modelId: model.id, fallbackUser: user, exclude: [login.login_email, email] });

  const { data: settings } = await admin.from('organization_settings').select('sender_name,sender_email,reply_to_email').eq('organization_id', organization.id).maybeSingle();
  const fromEmail = lc(settings?.sender_email || process.env.VEUX_DEFAULT_SENDER_EMAIL);
  const senderName = settings?.sender_name || organization.name || 'Maison de Veux';
  const replyTo = EMAIL_RX.test(lc(settings?.reply_to_email)) ? lc(settings.reply_to_email) : (agents[0]?.email || undefined);
  const firstName = String(model.first_name || model.display_name || '').trim().split(/\s+/)[0] || '';
  const mail = buildWelcomeEmail({ firstName, loginEmail: login.login_email, temporaryPassword: login.temporary_password, expiresAt: login.expires_at, agents, senderName });
  const to = [login.login_email];

  let delivery = null, error = null;
  try {
    delivery = await sendResendEmail({ from_name: senderName, from_email: fromEmail, reply_to: replyTo, to_emails: [to[0]], cc_emails: agents.map(a => a.email), bcc_emails: [], subject: mail.subject, html_body: mail.html, text_body: mail.text, idempotency_key: `model-welcome:${model.id}:${resend ? Date.now() : 'first'}` });
  } catch (e) { error = e; }

  try {
    await admin.from('email_messages').insert({
      organization_id: organization.id, template_key: 'model_welcome', status: error ? 'failed' : 'sent', provider: delivery?.provider || 'resend', provider_message_id: delivery?.providerMessageId || null,
      from_name: senderName, from_email: fromEmail || null, reply_to: replyTo || null, to_emails: [to[0]], cc_emails: agents.map(a => a.email), bcc_emails: [], subject: mail.subject,
      html_body: '[welcome email with temporary credentials: redacted]', text_body: null, source_type: 'model_welcome', sent_at: error ? null : new Date().toISOString(),
      metadata: { model_id: model.id, user_id: login.user.id, created_login: login.created, expires_at: login.expires_at, cc: agents.map(a => a.email), secure_content_redacted: true, error: error ? String(error.publicMessage || error.message).slice(0, 300) : null },
    });
  } catch (_e) { /* the log is best effort */ }

  if (error) {
    /* the login exists and is valid, so hand the details back to staff once rather than losing them */
    return { sent: false, to: to[0], cc: agents.map(a => a.email), error: error.publicMessage || error.message || 'The email could not be sent.', temporary_password: login.temporary_password, login_email: login.login_email, expires_at: login.expires_at };
  }
  return { sent: true, to: to[0], cc: agents.map(a => a.email), expires_at: login.expires_at, login_created: login.created };
}
