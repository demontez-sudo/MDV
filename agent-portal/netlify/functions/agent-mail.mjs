import { requireUser, adminClient, parseBody, json, errorResponse } from './_lib/auth.mjs';
import { requireStaffOrganization } from './_lib/agent-bridge.mjs';
import {
  mailConfig, appError, signState, newNonce, authorizeUrl, getConnection, deleteConnection, graph, safeId,
  buildSendPayload, parseAddresses, textToHtml, mapSummary, mapMessage, FOLDERS, SUMMARY_SELECT, GRAPH, LIMITS
} from './_lib/mail-graph.mjs';
import { cleanSignature, signatureHtml, signatureText } from './_lib/mail-signature.mjs';
import { resendReady, shouldUseResend, sendViaResend, quoteHtml, copyTarget, saveCopy } from './_lib/mail-resend.mjs';

/* Team-member mailbox (Microsoft 365). Every call is scoped to the signed-in staff member's OWN
   connection — user id comes from the verified session, never from the request body. */

const clean = v => String(v ?? '').trim();
const FOLDER_ALIASES = new Set(FOLDERS.map(f => f[0]));
const folderOf = v => { const f = clean(v || 'inbox').toLowerCase(); if (!FOLDER_ALIASES.has(f)) throw appError(400, 'Unknown mail folder.', 'MAIL_BAD_FOLDER'); return f; };
const NEXT_RX = /^https:\/\/graph\.microsoft\.com\/v1\.0\/me\/(mailFolders|messages)[/?]/;

function publicConn(c) {
  return c ? { connected: c.status === 'active', needs_reconnect: c.status === 'needs_reconnect', email: c.email, display_name: c.display_name, connected_at: c.created_at, signature: cleanSignature(c.signature) } : { connected: false };
}

/* ids of Deleted / Drafts / Junk almost never change: look them up once per mailbox, not on every message opened */
const hiddenCache = new Map();
async function hiddenFolders(G, conn) {
  const hit = hiddenCache.get(conn.id);
  if (hit && Date.now() - hit.at < 600000) return hit.ids;
  const ids = await Promise.all(['deleteditems', 'drafts', 'junkemail'].map(f => G(`/me/mailFolders/${f}?$select=id`).then(x => x?.id).catch(() => null)));
  hiddenCache.set(conn.id, { at: Date.now(), ids });
  return ids;
}

export const handler = async event => {
  if (!['GET', 'POST'].includes(event.httpMethod)) return json(405, { error: 'Method not allowed' });
  try {
    const { user, client } = await requireUser(event);
    const p = event.queryStringParameters || {}, body = event.httpMethod === 'POST' ? parseBody(event) : {};
    const { organization } = await requireStaffOrganization({ user, client, organizationSlug: body.organization_slug || p.organization || 'maison-de-veux' });
    const admin = adminClient(), cfg = mailConfig();

    /* ---- status (also tells the UI whether the admin setup is done) ---- */
    if (event.httpMethod === 'GET') {
      let conn = null, storage_ok = true;
      if (cfg.configured) { try { conn = await getConnection(admin, organization.id, user.id); } catch (e) { if (e.code === 'MAIL_TABLE_MISSING') storage_ok = false; else throw e; } }
      return json(200, { ok: true, configured: cfg.configured, missing: cfg.missing, storage_ok, redirect_uri: cfg.redirectUri, user_email: user.email || null, resend: resendReady(), ...publicConn(conn) });
    }

    const action = clean(body.action);
    if (!cfg.configured) throw appError(503, `Email is not set up yet. An admin needs to add: ${cfg.missing.join(', ')}.`, 'MAIL_NOT_CONFIGURED');

    /* ---- start the Microsoft sign-in ---- */
    if (action === 'connect_url') {
      const nonce = newNonce();
      const state = signState({ u: user.id, o: organization.id, n: nonce, exp: Date.now() + 10 * 60 * 1000 });
      const cookie = `mdv_mail_nonce=${nonce}; Path=/; Max-Age=600; HttpOnly; Secure; SameSite=Lax`;
      return json(200, { ok: true, url: authorizeUrl(cfg, state, user.email) }, { 'Set-Cookie': cookie });
    }

    const conn = await getConnection(admin, organization.id, user.id);
    if (action === 'disconnect') { if (conn) await deleteConnection(admin, organization.id, user.id); return json(200, { ok: true, verified: true, connected: false }); }
    if (!conn) throw appError(409, 'Connect your email first.', 'MAIL_NOT_CONNECTED');
    const G = (path, opts) => graph(admin, cfg, conn, path, opts);

    if (action === 'folders') {
      const rows = await Promise.all(FOLDERS.map(async ([alias, label]) => {
        try { const f = await G(`/me/mailFolders/${alias}?$select=unreadItemCount,totalItemCount`); return { id: alias, name: label, unread: f?.unreadItemCount ?? 0, total: f?.totalItemCount ?? 0 }; }
        catch (e) {
          if (e.code === 'MAIL_NOT_FOUND') return { id: alias, name: label, unread: 0, total: 0, missing: true };
          if (e.code === 'MAIL_RECONNECT_REQUIRED' || e.code === 'MAIL_FORBIDDEN') throw e;
          /* one busy or rate-limited folder must not stop the whole mailbox from loading */
          return { id: alias, name: label, unread: 0, total: 0, unavailable: true };
        }
      }));
      return json(200, { ok: true, folders: rows.filter(f => !f.missing || f.id === 'inbox') });
    }

    if (action === 'messages') {
      const top = Math.min(Math.max(parseInt(body.top, 10) || 30, 1), 50);
      let url;
      if (clean(body.next)) { if (!NEXT_RX.test(body.next)) throw appError(400, 'Invalid page link.', 'MAIL_BAD_NEXT'); url = body.next; }
      else {
        const folder = folderOf(body.folder), search = clean(body.search).replace(/["\\]/g, ' ').slice(0, 120);
        const q = new URLSearchParams({ $top: String(top), $select: SUMMARY_SELECT });
        if (search) q.set('$search', `"${search}"`); else q.set('$orderby', 'receivedDateTime desc');
        /* Graph rejects `isRead` + date sort unless the sort property leads the filter. */
        if (!search && (clean(body.unread_only) === 'true' || body.unread_only === true)) q.set('$filter', 'receivedDateTime ge 1900-01-01T00:00:00Z and isRead eq false');
        url = `${GRAPH}/me/mailFolders/${folder}/messages?${q}`;
      }
      const d = await G(url);
      return json(200, { ok: true, messages: (d?.value || []).map(mapSummary), next: d?.['@odata.nextLink'] || null });
    }

    if (action === 'message') {
      const id = safeId(body.id), enc = encodeURIComponent(id), wantInline = body.inline !== false;
      const m = await G(`/me/messages/${enc}?$select=${SUMMARY_SELECT},ccRecipients,bccRecipients,replyTo,body,webLink`, { headers: { Prefer: 'outlook.body-content-type="html"' } });
      /* marking it read and listing the attachments do not depend on each other: run them together so opening stays quick */
      const [, list] = await Promise.all([
        m.isRead ? null : G(`/me/messages/${enc}`, { method: 'PATCH', body: { isRead: true } }).then(() => { m.isRead = true; }).catch(() => { /* non-fatal */ }),
        m.hasAttachments ? G(`/me/messages/${enc}/attachments?$select=id,name,size,contentType,isInline`).catch(() => null) : null
      ]);
      const all = list?.value || [];
      const attachments = all.filter(x => !x.isInline).map(x => ({ id: x.id, name: x.name, size: x.size, content_type: x.contentType }));
      /* Pictures embedded in the body (signature logos, pasted photos) are referenced as cid:… and never load on their own.
         Only fetch them when the body really points at one, keep it small, and never let it slow the message down much. */
      let inline_images = [];
      const html = String(m.body?.content || '');
      if (wantInline && /cid:/i.test(html)) {
        const want = all.filter(x => x.isInline && /^image\//i.test(x.contentType || '') && Number(x.size || 0) <= 900000).slice(0, 6);
        if (want.length) {
          const fetched = Promise.all(want.map(async x => {
            try {
              const f = await G(`/me/messages/${enc}/attachments/${encodeURIComponent(x.id)}`);
              if (!f?.contentBytes || !f.contentId) return null;
              return { cid: String(f.contentId).replace(/^<|>$/g, ''), content_type: x.contentType, data: f.contentBytes };
            } catch (_e) { return null; }
          }));
          const got = await Promise.race([fetched, new Promise(r => setTimeout(() => r([]), 5000))]);
          let budget = 2500000;
          inline_images = (got || []).filter(Boolean).filter(x => { budget -= x.data.length; return budget >= 0; });
        }
      }
      return json(200, { ok: true, message: mapMessage(m), attachments, inline_images });
    }

    /* Every message in the same conversation (received and sent), oldest first, so a reply can be read
       against the whole back-and-forth. Bodies are loaded one at a time by the existing `message` action. */
    if (action === 'thread') {
      const id = safeId(body.id);
      let cid = clean(body.conversation_id);
      if (!cid || cid.length > 300) { const cur = await G(`/me/messages/${encodeURIComponent(id)}?$select=conversationId`); cid = clean(cur?.conversationId); }
      if (!cid) return json(200, { ok: true, messages: [], current: id });
      const q = new URLSearchParams({ $top: '50', $select: `${SUMMARY_SELECT},parentFolderId`, $filter: `conversationId eq '${cid.replace(/'/g, "''")}'` });
      const [d, hidden] = await Promise.all([
        G(`${GRAPH}/me/messages?${q}`),
        hiddenFolders(G, conn)
      ]);
      const skip = new Set(hidden.filter(Boolean));
      const me = clean(conn.email).toLowerCase();
      const rows = (d?.value || []).filter(m => m.id === id || !skip.has(m.parentFolderId))
        .map(m => ({ ...mapSummary(m), mine: clean(m.from?.emailAddress?.address).toLowerCase() === me }))
        .sort((a, b) => String(a.received || '').localeCompare(String(b.received || '')));
      return json(200, { ok: true, messages: rows, current: id });
    }

    if (action === 'attachment') {
      const id = safeId(body.id), aid = safeId(body.attachment_id);
      const a = await G(`/me/messages/${encodeURIComponent(id)}/attachments/${encodeURIComponent(aid)}`); /* no $select: contentBytes only exists on fileAttachment, so selecting it on the base type fails */
      if (!a?.contentBytes) throw appError(409, 'That attachment cannot be downloaded here. Open it in Outlook.', 'MAIL_ATTACHMENT_UNSUPPORTED');
      if ((a.size || 0) > 4.5 * 1048576) throw appError(413, 'That attachment is too large to download here. Open it in Outlook.', 'MAIL_ATTACHMENT_TOO_BIG');
      return json(200, { ok: true, name: a.name, content_type: a.contentType, content_base64: a.contentBytes });
    }

    if (action === 'signature_save') {
      const sig = cleanSignature(body.signature) || { enabled: false };
      const { error } = await admin.from('mail_connections').update({ signature: sig, updated_at: new Date().toISOString() }).eq('id', conn.id);
      if (error) {
        if (/signature/i.test(String(error.message || '')) || String(error.code) === '42703' || String(error.code) === 'PGRST204') throw appError(503, 'Saved on this device only. Run agent-portal/docs/sql/2026-10-12-mail-signature.sql in Supabase to keep your signature on every device.', 'MAIL_SIGNATURE_COLUMN_MISSING');
        throw error;
      }
      return json(200, { ok: true, verified: true, signature: cleanSignature(sig) });
    }

    if (action === 'send') {
      const payload = buildSendPayload(body), m = payload.message, sigH = signatureHtml(body.signature), sigT = signatureText(body.signature);
      if (sigH) m.body.content += sigH;
      if (shouldUseResend([m.toRecipients, m.ccRecipients || [], m.bccRecipients || []], conn.email)) {
        const ct = copyTarget(body);
        const r = await sendViaResend({ conn, to: m.toRecipients, cc: m.ccRecipients, bcc: m.bccRecipients, subject: m.subject, html: m.body.content, text: String(body.text ?? body.body ?? '') + sigT, attachments: m.attachments || [], copyInbox: ct === 'inbox' });
        const copy = await saveCopy(G, conn, ct, { to: m.toRecipients, cc: m.ccRecipients, bcc: m.bccRecipients, subject: m.subject, html: m.body.content, attachments: m.attachments });
        return json(200, { ok: true, verified: true, sent: true, via: 'resend', copy, id: r?.providerMessageId || null });
      }
      await G('/me/sendMail', { method: 'POST', body: payload });
      return json(200, { ok: true, verified: true, sent: true, via: 'microsoft' });
    }

    if (action === 'reply') {
      const id = safeId(body.id), mode = clean(body.mode || 'reply');
      if (!['reply', 'replyAll', 'forward'].includes(mode)) throw appError(400, 'Unknown reply mode.', 'MAIL_BAD_MODE');
      const text = String(body.text ?? '');
      if (text.length > LIMITS.bodyChars) throw appError(413, 'That message is too long.', 'MAIL_TOO_LONG');
      const create = mode === 'forward' ? 'createForward' : mode === 'replyAll' ? 'createReplyAll' : 'createReply';
      /* The To / Cc the person sees (and may have edited) in the reply box are what get sent. */
      const to = parseAddresses(body.to, 'recipient'), cc = parseAddresses(body.cc, 'Cc');
      const sigH = signatureHtml(body.signature), sigT = signatureText(body.signature);
      if (!to.length) throw appError(400, mode === 'forward' ? 'Add at least one recipient to forward to.' : 'Add at least one recipient.', 'MAIL_NO_RECIPIENT');
      if (shouldUseResend([to, cc], conn.email)) {
        const orig = await G(`/me/messages/${encodeURIComponent(id)}?$select=subject,internetMessageId,from,sentDateTime,receivedDateTime,body`, { headers: { Prefer: 'outlook.body-content-type="html"' } });
        const base = clean(orig?.subject).replace(/^((re|fwd?):\s*)+/i, '');
        const html = `${textToHtml(text)}${sigH}${quoteHtml(orig)}`;
        const mid = clean(orig?.internetMessageId);
        const ct = copyTarget(body), subj = `${mode === 'forward' ? 'Fwd' : 'Re'}: ${base || '(no subject)'}`;
        const r = await sendViaResend({ conn, to, cc, bcc: [], subject: subj, html, text: text + sigT, replyHeaders: mode !== 'forward' && mid ? { 'In-Reply-To': mid, References: mid } : undefined, copyInbox: ct === 'inbox' });
        const copy = await saveCopy(G, conn, ct, { to, cc, bcc: [], subject: subj, html });
        return json(200, { ok: true, verified: true, sent: true, via: 'resend', copy, id: r?.providerMessageId || null });
      }
      const draft = await G(`/me/messages/${encodeURIComponent(id)}/${create}`, { method: 'POST', body: {} });
      const quoted = String(draft?.body?.content || '');
      const mine = textToHtml(text) + sigH;
      /* a function replacer, so "$1" or "$&" typed in the message is kept literally (a string replacement would expand it) */
      const html = /<body[^>]*>/i.test(quoted) ? quoted.replace(/<body([^>]*)>/i, (_m, attrs) => `<body${attrs}>${mine}<br>`) : `${mine}<br>${quoted}`;
      const patch = { body: { contentType: 'HTML', content: html } };
      patch.toRecipients = to;
      patch.ccRecipients = cc;
      try {
        await G(`/me/messages/${encodeURIComponent(draft.id)}`, { method: 'PATCH', body: patch });
        await G(`/me/messages/${encodeURIComponent(draft.id)}/send`, { method: 'POST' });
      } catch (e) {
        /* do not leave a half-written reply sitting in Drafts */
        try { await G(`/me/messages/${encodeURIComponent(draft.id)}`, { method: 'DELETE' }); } catch (_x) { /* best effort */ }
        throw e;
      }
      return json(200, { ok: true, verified: true, sent: true, via: 'microsoft' });
    }

    if (action === 'mark_read') {
      await G(`/me/messages/${encodeURIComponent(safeId(body.id))}`, { method: 'PATCH', body: { isRead: body.read !== false } });
      return json(200, { ok: true, verified: true });
    }

    if (action === 'delete') {
      await G(`/me/messages/${encodeURIComponent(safeId(body.id))}/move`, { method: 'POST', body: { destinationId: 'deleteditems' } });
      return json(200, { ok: true, verified: true, deleted: true });
    }

    if (action === 'archive') {
      await G(`/me/messages/${encodeURIComponent(safeId(body.id))}/move`, { method: 'POST', body: { destinationId: 'archive' } });
      return json(200, { ok: true, verified: true, archived: true });
    }

    return json(400, { error: 'Unsupported mail action' });
  } catch (error) { return errorResponse(error); }
};
