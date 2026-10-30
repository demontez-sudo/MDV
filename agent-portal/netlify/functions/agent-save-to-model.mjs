/* Helpers for "save files from an email to a model profile".
   models    every model (including past ones) so any file can be filed against any profile
   fetch_link  pull one publicly shared file (Google Drive file, Dropbox) into short-lived private staging and hand back a signed link
   discard   remove a staged file
   log       add one line to the model's activity: "3 files added from an email"
   The files themselves are saved by the portal with the same uploaders the Model 360 uses, so they follow the same rules. */
import crypto from 'node:crypto';
import { requireUser, parseBody, json, errorResponse } from './_lib/auth.mjs';
import { requireStaffOrganization, requirePermission } from './_lib/agent-bridge.mjs';
import { logModelActivity, actorFor } from './_lib/model-activity.mjs';

const MAX_BYTES = 40 * 1048576;
const ALLOWED = /^(image\/(jpeg|png|webp|gif)|application\/pdf|application\/msword|application\/vnd\.openxmlformats-officedocument\.wordprocessingml\.document|text\/plain)$/i;
const EXT_MIME = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif', pdf: 'application/pdf', doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', txt: 'text/plain' };
/* only these places are ever contacted, and every redirect is checked against the same list */
const HOSTS = /^(drive\.google\.com|docs\.google\.com|drive\.usercontent\.google\.com|[a-z0-9-]+\.googleusercontent\.com|www\.dropbox\.com|dropbox\.com|dl\.dropboxusercontent\.com|[a-z0-9-]+\.dl\.dropboxusercontent\.com|uc[a-z0-9]+\.dl\.dropboxusercontent\.com)$/i;

const fail = (message, statusCode = 400) => { const e = new Error(message); e.statusCode = statusCode; e.publicMessage = message; throw e; };
const cleanName = n => String(n || 'file').normalize('NFKD').replace(/[^a-zA-Z0-9._ -]+/g, '-').replace(/-+/g, '-').trim().slice(-120) || 'file';
async function rows(q) { const { data, error } = await q; if (error) throw error; return data || []; }
const bucketName = () => process.env.VEUX_PRIVATE_STORAGE_BUCKET || 'veux-private';

/* turn a share link into a direct download URL, or say why it cannot be done */
function resolve(raw) {
  let u;
  try { u = new URL(String(raw || '').trim()); } catch (_e) { fail('That is not a valid link.'); }
  if (u.protocol !== 'https:') fail('Only secure (https) links can be fetched.');
  const h = u.hostname.toLowerCase();
  if (!HOSTS.test(h)) fail('Only Google Drive and Dropbox links can be fetched here. Download the file and drop it into the Save to model window instead.');
  if (h === 'drive.google.com' || h === 'docs.google.com') {
    if (/\/drive\/folders\//.test(u.pathname) || /\/folderview/.test(u.pathname)) { const e = new Error('That link is a Google Drive folder. Open it, download the photos, then drop them into the Save to model window.'); e.statusCode = 409; e.publicMessage = e.message; e.code = 'FOLDER'; throw e; }
    const id = (u.pathname.match(/\/(?:file|document|presentation|spreadsheets)\/d\/([\w-]{10,})/) || [])[1] || u.searchParams.get('id');
    if (!id) fail('That Google link does not point to a single file.');
    if (/\/document\/d\//.test(u.pathname)) return { url: `https://docs.google.com/document/d/${id}/export?format=pdf`, hint: 'Google Doc (as PDF)' };
    if (/\/presentation\/d\//.test(u.pathname)) return { url: `https://docs.google.com/presentation/d/${id}/export/pdf`, hint: 'Google Slides (as PDF)' };
    if (/\/spreadsheets\/d\//.test(u.pathname)) fail('Google Sheets cannot be saved here. Download it as a file, then drop it into the Save to model window.');
    return { url: `https://drive.usercontent.google.com/download?id=${id}&export=download&confirm=t`, hint: 'Google Drive file' };
  }
  if (h === 'www.dropbox.com' || h === 'dropbox.com') {
    if (/^\/(sh|scl)\/fo\//.test(u.pathname)) fail('That link is a Dropbox folder. Download the files, then drop them into the Save to model window.');
    u.searchParams.set('dl', '1');
    return { url: u.toString(), hint: 'Dropbox file' };
  }
  return { url: u.toString(), hint: 'Shared file' };
}

function filenameFrom(res, fallback) {
  const cd = res.headers.get('content-disposition') || '';
  const star = cd.match(/filename\*=UTF-8''([^;]+)/i);
  if (star) { try { return decodeURIComponent(star[1]); } catch (_e) { /* fall through */ } }
  const plain = cd.match(/filename="?([^";]+)"?/i);
  return plain ? plain[1] : fallback;
}

async function download(startUrl) {
  let url = startUrl;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8500);
  try {
    for (let hop = 0; hop < 6; hop++) {
      const host = new URL(url).hostname;
      if (!HOSTS.test(host)) fail('The link redirected somewhere that is not allowed.');
      const res = await fetch(url, { redirect: 'manual', signal: controller.signal, headers: { 'user-agent': 'Mozilla/5.0 (compatible; MaisonDeVeux/1.0)' } });
      if (res.status >= 300 && res.status < 400 && res.headers.get('location')) { url = new URL(res.headers.get('location'), url).toString(); continue; }
      if (!res.ok) fail(res.status === 403 || res.status === 404 ? 'That file is private or no longer exists. Ask the sender to share it with "anyone with the link", or download it and drop it into the Save to model window.' : `The file could not be downloaded (${res.status}).`, 409);
      const len = Number(res.headers.get('content-length') || 0);
      if (len > MAX_BYTES) fail(`That file is over ${Math.round(MAX_BYTES / 1048576)} MB. Download it and drop it into the Save to model window.`, 413);
      const chunks = []; let total = 0;
      const reader = res.body.getReader();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.length;
        if (total > MAX_BYTES) { controller.abort(); fail(`That file is over ${Math.round(MAX_BYTES / 1048576)} MB. Download it and drop it into the Save to model window.`, 413); }
        chunks.push(value);
      }
      return { buffer: Buffer.concat(chunks.map(c => Buffer.from(c))), res, finalUrl: url };
    }
    fail('The link redirected too many times.');
  } catch (e) {
    if (e.name === 'AbortError') fail('The file took too long to fetch. Download it and drop it into the Save to model window.', 504);
    throw e;
  } finally { clearTimeout(timer); }
}

export const handler = async event => {
  if (!['GET', 'POST'].includes(event.httpMethod)) return json(405, { error: 'Method not allowed' });
  try {
    const { user, client } = await requireUser(event);
    const body = event.httpMethod === 'POST' ? parseBody(event) : {};
    const q = event.queryStringParameters || {};
    const { organization } = await requireStaffOrganization({ user, client, organizationSlug: body.organization_slug || q.organization || 'maison-de-veux' });

    if (event.httpMethod === 'GET') {
      const admin = await requirePermission(user.id, organization.id, 'models.read');
      const models = await rows(admin.from('models').select('id,display_name,status,primary_market_label').eq('organization_id', organization.id).order('display_name').limit(3000));
      return json(200, { ok: true, models: models.filter(m => m.display_name).map(m => ({ id: m.id, name: m.display_name, status: m.status || '', market: m.primary_market_label || '' })) });
    }

    const action = String(body.action || '');

    if (action === 'fetch_link') {
      const admin = await requirePermission(user.id, organization.id, 'documents.write');
      const target = resolve(body.url);
      const { buffer, res, finalUrl } = await download(target.url);
      let name = cleanName(filenameFrom(res, decodeURIComponent((new URL(finalUrl).pathname.split('/').pop() || 'file'))));
      let mime = String(res.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
      const ext = (name.split('.').pop() || '').toLowerCase();
      if (!ALLOWED.test(mime) && EXT_MIME[ext]) mime = EXT_MIME[ext];
      if (/text\/html/.test(mime)) fail('That link opened a web page, not a file. It may be private. Download the file and drop it into the Save to model window.', 409);
      if (!ALLOWED.test(mime)) fail('That file type cannot be saved to a profile. Use JPG, PNG, WEBP, GIF, PDF, Word or text files.', 415);
      if (!/\.[a-z0-9]{2,4}$/i.test(name)) { const e = Object.entries(EXT_MIME).find(([, v]) => v === mime); if (e) name += '.' + e[0]; }
      const path = `${organization.id}/tmp-email/${crypto.randomUUID()}-${name}`;
      const up = await admin.storage.from(bucketName()).upload(path, buffer, { contentType: mime, upsert: false });
      if (up.error) throw up.error;
      const { data: signed, error: se } = await admin.storage.from(bucketName()).createSignedUrl(path, 600);
      if (se) throw se;
      return json(200, { ok: true, name, mime, size: buffer.length, source: target.hint, staging_path: path, url: signed.signedUrl });
    }

    if (action === 'discard') {
      const admin = await requirePermission(user.id, organization.id, 'documents.write');
      const path = String(body.staging_path || '');
      if (!path.startsWith(`${organization.id}/tmp-email/`) || path.includes('..')) fail('Not a staged file.', 403);
      await admin.storage.from(bucketName()).remove([path]).catch(() => {});
      return json(200, { ok: true });
    }

    if (action === 'log') {
      const admin = await requirePermission(user.id, organization.id, 'models.write');
      const n = Math.max(0, Math.min(200, Number(body.count) || 0));
      if (!body.model_id || !n) return json(200, { ok: true });
      await logModelActivity(admin, { organization_id: organization.id, model_id: body.model_id, kind: 'media', title: `${n} file${n === 1 ? '' : 's'} added${body.from ? ' from an email by ' + String(body.from).slice(0, 80) : ' from an email'}`, detail: String(body.detail || '').slice(0, 500) || null, ...(await actorFor(admin, user)), link_page: 'materials' });
      return json(200, { ok: true });
    }

    return json(400, { error: 'Unsupported action' });
  } catch (error) { return errorResponse(error); }
};
