import { adminClient, parseBody, json } from './_lib/auth.mjs';
import { sendResendEmail } from './_lib/email.mjs';

const ORG_SLUG = 'maison-de-veux';
const CANONICAL_RECOVERY_URL = 'https://www.maisondeveux.com/admin';
const EMAIL_RX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function esc(value='') {
  return String(value).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
}

function generic() {
  return json(200, { ok: true, message: 'If this email has VEUX access, a secure link is on the way.' });
}

export async function handler(event) {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' }, { Allow: 'POST' });
  let email = '';
  try {
    const body = parseBody(event);
    email = String(body.email || '').trim().toLowerCase();
    if (!EMAIL_RX.test(email)) return generic();

    const admin = adminClient();
    const { data: org, error: orgError } = await admin
      .from('organizations')
      .select('id,name,status')
      .eq('slug', ORG_SLUG)
      .eq('status', 'active')
      .maybeSingle();
    if (orgError || !org?.id) return generic();

    // generateLink creates the recovery token without sending Supabase's hosted email,
    // so Auth Site URL / localhost fallbacks cannot control this flow.
    const { data: link, error: linkError } = await admin.auth.admin.generateLink({ type: 'recovery', email });
    if (linkError || !link?.user?.id || !link?.properties?.hashed_token) return generic();

    const { data: member, error: memberError } = await admin
      .from('organization_members')
      .select('id,status')
      .eq('organization_id', org.id)
      .eq('user_id', link.user.id)
      .eq('member_type', 'staff')
      .eq('status', 'active')
      .maybeSingle();
    if (memberError || !member?.id) return generic();

    // App-level resend throttle. This is independent of Supabase Auth email quotas.
    const since = new Date(Date.now() - 60_000).toISOString();
    const { data: recent } = await admin
      .from('email_messages')
      .select('id')
      .eq('organization_id', org.id)
      .eq('source_type', 'agency_password_recovery')
      .contains('to_emails', [email])
      .gte('created_at', since)
      .limit(1);
    if (recent?.length) return generic();

    const { data: settings } = await admin
      .from('organization_settings')
      .select('sender_name,sender_email,reply_to_email')
      .eq('organization_id', org.id)
      .maybeSingle();

    const fromEmail = String(settings?.sender_email || process.env.VEUX_DEFAULT_SENDER_EMAIL || '').trim().toLowerCase();
    if (!EMAIL_RX.test(fromEmail)) {
      console.error('[VEUX recovery] sender email is not configured');
      return generic();
    }

    const recoveryUrl = `${CANONICAL_RECOVERY_URL}?recovery_token=${encodeURIComponent(link.properties.hashed_token)}`;
    const senderName = settings?.sender_name || org.name || 'Maison de Veux';
    const html = `<div style="font-family:Arial,Helvetica,sans-serif;max-width:620px;margin:auto;padding:36px;color:#17130f"><div style="font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:#9a794b;margin-bottom:18px">VEUX DESK · Maison de Veux</div><h1 style="font-family:Georgia,serif;font-weight:400;font-size:34px;margin:0 0 18px">Reset your Agency password</h1><p style="font-size:15px;line-height:1.7">Use the secure button below to create a new Agency Portal password. This link is single-use.</p><p style="margin:28px 0"><a href="${esc(recoveryUrl)}" style="display:inline-block;background:#17130f;color:#fff;text-decoration:none;padding:14px 20px;letter-spacing:.08em">CREATE PASSWORD</a></p><p style="font-size:12px;line-height:1.6;color:#777">If you did not request this, you can ignore this email.</p></div>`;

    const delivery = await sendResendEmail({
      from_name: senderName,
      from_email: fromEmail,
      reply_to: EMAIL_RX.test(String(settings?.reply_to_email || '').trim()) ? String(settings.reply_to_email).trim() : undefined,
      to_emails: [email],
      cc_emails: [],
      bcc_emails: [],
      subject: 'Reset your Maison de Veux Agency password',
      html_body: html,
      text_body: `Reset your Maison de Veux Agency password:\n\n${recoveryUrl}\n\nIf you did not request this, ignore this email.`,
      idempotency_key: `agency-recovery:${link.user.id}:${Date.now()}`
    });

    // Keep a verified audit record, but never persist the recovery token/link.
    const {error:auditError}=await admin.from('email_messages').insert({
      organization_id: org.id,
      template_key: 'agency_password_recovery',
      status: 'sent',
      provider: delivery.provider || 'resend',
      provider_message_id: delivery.providerMessageId || null,
      from_name: senderName,
      from_email: fromEmail,
      reply_to: EMAIL_RX.test(String(settings?.reply_to_email || '').trim()) ? String(settings.reply_to_email).trim() : null,
      to_emails: [email],
      cc_emails: [],
      bcc_emails: [],
      subject: 'Reset your Maison de Veux Agency password',
      html_body: '[secure recovery link delivered and redacted]',
      text_body: null,
      source_type: 'agency_password_recovery',
      sent_at: new Date().toISOString(),
      metadata: { user_id: link.user.id, secure_link_redacted: true, supabase_project: 'mogyngdhmzbjmcdqeoxu' }
    });
    if(auditError)throw auditError;

    return generic();
  } catch (error) {
    console.error('[VEUX recovery] request failed', { email, error: String(error?.message || error) });
    return generic();
  }
}
