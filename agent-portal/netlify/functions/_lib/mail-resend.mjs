import { sendResendEmail } from './email.mjs';
import { appError, escHtml } from './mail-graph.mjs';

/* Outside recipients are sent through Resend (the same provider that sends packages) so delivery does not depend on
   Microsoft accepting traffic from our server. Internal mail (same domain as the connected mailbox) stays on Microsoft. */

const clean = v => String(v ?? '').trim();
const domainOf = a => clean(a).toLowerCase().split('@')[1] || '';
export const resendReady = () => !!clean(process.env.RESEND_API_KEY);

export function shouldUseResend(lists, ownEmail) {
  if (!resendReady()) return false;
  const own = domainOf(ownEmail);
  return lists.flat().some(a => domainOf(a?.emailAddress?.address ?? a) !== own);
}
const addrs = list => (list || []).map(x => clean(x?.emailAddress?.address ?? x)).filter(Boolean);

export function quoteHtml(orig) {
  const raw = String(orig?.body?.content || '');
  const m = raw.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  const inner = m ? m[1] : raw;
  const from = orig?.from?.emailAddress || {};
  const when = orig?.sentDateTime || orig?.receivedDateTime;
  const stamp = when ? new Date(when).toUTCString().replace(' GMT', ' UTC') : '';
  return `<br><div style="border-left:2px solid #c9c9c9;margin:6px 0 0;padding-left:12px;color:#555">On ${escHtml(stamp)}, ${escHtml(from.name || from.address || 'sender')} &lt;${escHtml(from.address || '')}&gt; wrote:<br><br>${inner}</div>`;
}

export const COPY_TARGETS = ['sentitems', 'junkemail', 'inbox', 'none'];
export function copyTarget(body) {
  const t = clean(body?.copy_to).toLowerCase();
  if (COPY_TARGETS.includes(t)) return t;
  return body?.copy_me === false ? 'none' : 'sentitems';
}

/* Resend does not touch the mailbox, so a record of the message can be written straight into a folder (no delivery).
   isRead + message-flags 1 keep it from showing as an unsent draft. Best effort: a failure never blocks the send. */
export async function saveCopy(G, conn, target, { to, cc, bcc, subject, html, attachments }) {
  if (!target || target === 'none' || target === 'inbox') return { to: target || 'none', ok: true };
  const now = new Date().toISOString();
  const me = { emailAddress: { address: clean(conn.email), ...(clean(conn.display_name) ? { name: clean(conn.display_name) } : {}) } };
  try {
    await G(`/me/mailFolders/${target}/messages`, { method: 'POST', body: {
      subject, body: { contentType: 'HTML', content: html }, from: me, sender: me,
      toRecipients: to || [], ccRecipients: cc || [], bccRecipients: bcc || [], isRead: true,
      ...(attachments?.length ? { attachments } : {}),
      singleValueExtendedProperties: [
        { id: 'Integer 0xE07', value: '1' }, { id: 'SystemTime 0xE06', value: now }, { id: 'SystemTime 0x39', value: now }
      ]
    } });
    return { to: target, ok: true };
  } catch (e) { console.warn('[mail] copy not saved', e?.code || '', e?.message || ''); return { to: target, ok: false }; }
}

export async function sendViaResend({ conn, to, cc = [], bcc = [], subject, html, text, attachments = [], replyHeaders, copyInbox = false }) {
  const own = clean(conn.email).toLowerCase();
  const bccList = addrs(bcc);
  if (copyInbox && own && ![...addrs(to), ...addrs(cc), ...bccList].map(x => x.toLowerCase()).includes(own)) bccList.push(own);
  const base = {
    from_name: clean(conn.display_name) || undefined,
    to_emails: addrs(to), cc_emails: addrs(cc), bcc_emails: bccList,
    subject, html_body: html, text_body: text,
    attachments: attachments.map(a => ({ filename: a.name, content: a.contentBytes })),
    headers: replyHeaders || undefined
  };
  const attempts = [{ from_email: own, reply_to: own }];
  const fallback = clean(process.env.VEUX_DEFAULT_SENDER_EMAIL).toLowerCase();
  if (fallback && fallback !== own) attempts.push({ from_email: fallback, reply_to: own });
  let lastErr;
  for (const a of attempts) {
    try { return await sendResendEmail({ ...base, ...a }); }
    catch (e) { lastErr = e; if (!(e?.providerStatus === 403 || e?.providerStatus === 422)) break; }
  }
  throw appError(502, `Resend could not send from ${own}${lastErr?.message ? ` (${String(lastErr.message).replace(/^Resend \d+: /, '').slice(0, 160)})` : ''}. Make sure ${domainOf(own)} is verified in Resend.`, 'MAIL_RESEND_FAILED');
}
