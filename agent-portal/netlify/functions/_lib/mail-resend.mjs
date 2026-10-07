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

export async function sendViaResend({ conn, to, cc = [], bcc = [], subject, html, text, attachments = [], replyHeaders, copyMe = true }) {
  const own = clean(conn.email).toLowerCase();
  const bccList = addrs(bcc);
  if (copyMe && own && ![...addrs(to), ...addrs(cc), ...bccList].map(x => x.toLowerCase()).includes(own)) bccList.push(own);
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
  const e = appError(502, `Resend could not send from ${own}${lastErr?.message ? ` (${String(lastErr.message).replace(/^Resend \d+: /, '').slice(0, 160)})` : ''}. Make sure ${domainOf(own)} is verified in Resend.`, 'MAIL_RESEND_FAILED');
  throw e;
}
