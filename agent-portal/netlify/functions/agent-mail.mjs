import { requireUser, adminClient, parseBody, json, errorResponse } from './_lib/auth.mjs';
import { requireStaffOrganization } from './_lib/agent-bridge.mjs';
import {
  mailConfig, appError, signState, newNonce, authorizeUrl, getConnection, deleteConnection, graph, safeId,
  buildSendPayload, parseAddresses, textToHtml, mapSummary, mapMessage, FOLDERS, SUMMARY_SELECT, GRAPH, LIMITS
} from './_lib/mail-graph.mjs';
import { resendReady, shouldUseResend, sendViaResend, quoteHtml } from './_lib/mail-resend.mjs';

/* Team-member mailbox (Microsoft 365). Every call is scoped to the signed-in staff member's OWN
   connection — user id comes from the verified session, never from the request body. */

const clean = v => String(v ?? '').trim();
const FOLDER_ALIASES = new Set(FOLDERS.map(f => f[0]));
const folderOf = v => { const f = clean(v || 'inbox').toLowerCase(); if (!FOLDER_ALIASES.has(f)) throw appError(400, 'Unknown mail folder.', 'MAIL_BAD_FOLDER'); return f; };
const NEXT_RX = /^https:\/\/graph\.microsoft\.com\/v1\.0\/me\/(mailFolders|messages)[/?]/;

function publicConn(c) {
  return c ? { connected: c.status === 'active', needs_reconnect: c.status === 'needs_reconnect', email: c.email, display_name: c.display_name, connected_at: c.created_at } : { connected: false };
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
        catch (e) { if (e.code === 'MAIL_NOT_FOUND') return { id: alias, name: label, unread: 0, total: 0, missing: true }; throw e; }
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
      const id = safeId(body.id);
      const m = await G(`/me/messages/${encodeURIComponent(id)}?$select=${SUMMARY_SELECT},ccRecipients,bccRecipients,replyTo,body,webLink`, { headers: { Prefer: 'outlook.body-content-type="html"' } });
      if (!m.isRead) { try { await G(`/me/messages/${encodeURIComponent(id)}`, { method: 'PATCH', body: { isRead: true } }); m.isRead = true; } catch (_e) { /* non-fatal */ } }
      let attachments = [];
      if (m.hasAttachments) {
        const a = await G(`/me/messages/${encodeURIComponent(id)}/attachments?$select=id,name,size,contentType,isInline`);
        attachments = (a?.value || []).filter(x => !x.isInline).map(x => ({ id: x.id, name: x.name, size: x.size, content_type: x.contentType }));
      }
      return json(200, { ok: true, message: mapMessage(m), attachments });
    }

    if (action === 'attachment') {
      const id = safeId(body.id), aid = safeId(body.attachment_id);
      const a = await G(`/me/messages/${encodeURIComponent(id)}/attachments/${encodeURIComponent(aid)}?$select=name,size,contentType,contentBytes`);
      if (!a?.contentBytes) throw appError(409, 'That attachment cannot be downloaded here. Open it in Outlook.', 'MAIL_ATTACHMENT_UNSUPPORTED');
      if ((a.size || 0) > 4.5 * 1048576) throw appError(413, 'That attachment is too large to download here. Open it in Outlook.', 'MAIL_ATTACHMENT_TOO_BIG');
      return json(200, { ok: true, name: a.name, content_type: a.contentType, content_base64: a.contentBytes });
    }

    if (action === 'send') {
      const payload = buildSendPayload(body), m = payload.message;
      if (shouldUseResend([m.toRecipients, m.ccRecipients || [], m.bccRecipients || []], conn.email)) {
        const r = await sendViaResend({ conn, to: m.toRecipients, cc: m.ccRecipients, bcc: m.bccRecipients, subject: m.subject, html: m.body.content, text: String(body.text ?? body.body ?? ''), attachments: m.attachments || [], copyMe: body.copy_me !== false });
        return json(200, { ok: true, verified: true, sent: true, via: 'resend', id: r?.providerMessageId || null });
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
      if (!to.length) throw appError(400, mode === 'forward' ? 'Add at least one recipient to forward to.' : 'Add at least one recipient.', 'MAIL_NO_RECIPIENT');
      if (shouldUseResend([to, cc], conn.email)) {
        const orig = await G(`/me/messages/${encodeURIComponent(id)}?$select=subject,internetMessageId,from,sentDateTime,receivedDateTime,body`, { headers: { Prefer: 'outlook.body-content-type="html"' } });
        const base = clean(orig?.subject).replace(/^((re|fwd?):\s*)+/i, '');
        const html = `${textToHtml(text)}${quoteHtml(orig)}`;
        const mid = clean(orig?.internetMessageId);
        const r = await sendViaResend({ conn, to, cc, bcc: [], subject: `${mode === 'forward' ? 'Fwd' : 'Re'}: ${base || '(no subject)'}`, html, text, replyHeaders: mode !== 'forward' && mid ? { 'In-Reply-To': mid, References: mid } : undefined, copyMe: body.copy_me !== false });
        return json(200, { ok: true, verified: true, sent: true, via: 'resend', id: r?.providerMessageId || null });
      }
      const draft = await G(`/me/messages/${encodeURIComponent(id)}/${create}`, { method: 'POST', body: {} });
      const quoted = String(draft?.body?.content || '');
      const mine = textToHtml(text);
      const html = /<body[^>]*>/i.test(quoted) ? quoted.replace(/<body([^>]*)>/i, `<body$1>${mine}<br>`) : `${mine}<br>${quoted}`;
      const patch = { body: { contentType: 'HTML', content: html } };
      patch.toRecipients = to;
      patch.ccRecipients = cc;
      await G(`/me/messages/${encodeURIComponent(draft.id)}`, { method: 'PATCH', body: patch });
      await G(`/me/messages/${encodeURIComponent(draft.id)}/send`, { method: 'POST' });
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
