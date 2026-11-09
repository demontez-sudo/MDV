/* Shrink the photos that are already in storage, one at a time, without ever leaving a profile without its picture.
   For each big photo (model_media rows pointing into the public bucket):
     scan      list the candidates and what shrinking could save (changes nothing)
     prepare   hand the browser the original's address and a place to upload the smaller copy
     swap      check the smaller copy really exists and is smaller, then point every profile entry at it (original is KEPT)
     rollback  point the entries back at the original and drop the smaller copy (only while the original still exists)
     delete_originals   remove the originals of swapped photos, only when asked (confirm: true), and only if nothing points at them
   The shrinking itself (resize + JPEG) happens in the browser; nothing here needs an image library. Needs org.settings.manage. */
import crypto from 'node:crypto';
import { requireUser, parseBody, json, errorResponse } from './_lib/auth.mjs';
import { requireStaffOrganization, requirePermission } from './_lib/agent-bridge.mjs';

const BUCKET = 'veux-public', MIN_BYTES = 3 * 1048576, MB = 1048576;
const PUB = /\/storage\/v1\/object\/public\/([^/]+)\/(.+?)(?:\?.*)?$/;
const bad = (m, code = 400) => { const e = new Error(m); e.statusCode = code; e.publicMessage = m; return e; };
const parseUrl = u => { const m = PUB.exec(String(u || '')); if (!m) return null; try { return { bucket: m[1], path: decodeURIComponent(m[2]) }; } catch (_e) { return null; } };
const dirOf = p => p.slice(0, p.lastIndexOf('/'));
const baseOf = p => p.slice(p.lastIndexOf('/') + 1);
const nameWithoutUuid = n => n.replace(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-/, '').replace(/\.[a-z0-9]+$/i, '');
async function rows(q) { const { data, error } = await q; if (error) throw error; return data || []; }

/* sizes of the files in the given folders: Map(path -> { size, mime }) */
async function sizesFor(admin, folders) {
  const out = new Map();
  for (const folder of folders) {
    const { data, error } = await admin.storage.from(BUCKET).list(folder, { limit: 1000, offset: 0 });
    if (error) throw error;
    for (const o of data || []) if (o && o.name && o.metadata) out.set(`${folder}/${o.name}`, { size: Number(o.metadata.size) || 0, mime: String(o.metadata.mimetype || '') });
  }
  return out;
}
const mine = (org, path) => typeof path === 'string' && path.startsWith(org.id + '/') && !path.includes('..');

export const handler = async event => {
  if (!['GET', 'POST'].includes(event.httpMethod)) return json(405, { error: 'Method not allowed' });
  try {
    const { user, client } = await requireUser(event);
    const body = event.httpMethod === 'POST' ? parseBody(event) : {}, q = event.queryStringParameters || {};
    const { organization: org } = await requireStaffOrganization({ user, client, organizationSlug: body.organization_slug || q.organization || 'maison-de-veux' });
    const admin = await requirePermission(user.id, org.id, 'org.settings.manage');
    const action = String(body.action || q.action || 'scan');
    const pubUrl = p => admin.storage.from(BUCKET).getPublicUrl(p).data.publicUrl;
    const media = () => rows(admin.from('model_media').select('id,model_id,url,public_id,media_type,category,metadata').eq('organization_id', org.id).limit(5000));
    const pointsAt = (m, path) => { const p = parseUrl(m.url); return !!p && p.bucket === BUCKET && p.path === path; };

    if (action === 'scan') {
      const all = (await media()).filter(m => /image/i.test(String(m.media_type || 'image')));
      const refs = all.map(m => ({ m, p: parseUrl(m.url) })).filter(x => x.p && x.p.bucket === BUCKET && mine(org, x.p.path));
      const folders = [...new Set(refs.map(x => dirOf(x.p.path)))];
      const sizes = await sizesFor(admin, folders);
      const byPath = new Map();
      for (const { m, p } of refs) {
        const s = sizes.get(p.path);
        if (!s || s.size < MIN_BYTES || !/^image\/(jpeg|png|webp)$/i.test(s.mime) || (m.metadata && m.metadata.shrink)) continue;
        const c = byPath.get(p.path) || { path: p.path, name: nameWithoutUuid(baseOf(p.path)), size: s.size, mime: s.mime, model_id: m.model_id, media_ids: [] };
        c.media_ids.push(m.id); byPath.set(p.path, c);
      }
      const candidates = [...byPath.values()].sort((a, b) => b.size - a.size).map(c => ({ ...c, mb: +(c.size / MB).toFixed(1) }));
      const estNew = s => Math.min(s * 0.35, 4 * MB);
      const swapped = [];
      for (const m of all) if (m.metadata && m.metadata.shrink && !m.metadata.shrink.deleted_at) swapped.push(m.metadata.shrink);
      const uniqSwapped = [...new Map(swapped.map(s => [s.old_path, s])).values()];
      return json(200, { ok: true, candidates, total_mb: +(candidates.reduce((n, c) => n + c.size, 0) / MB).toFixed(1),
        estimated_saving_mb: +(candidates.reduce((n, c) => n + c.size - estNew(c.size), 0) / MB).toFixed(1),
        waiting_for_delete: uniqSwapped.map(s => ({ old_path: s.old_path, new_path: s.new_path, old_mb: +(s.old_size / MB).toFixed(1), new_mb: +(s.new_size / MB).toFixed(1) })),
        waiting_mb: +(uniqSwapped.reduce((n, s) => n + (s.old_size || 0), 0) / MB).toFixed(1) });
    }

    if (action === 'prepare') {
      const oldPath = String(body.path || '');
      if (!mine(org, oldPath)) throw bad('That file is not in this organisation.');
      const refs = (await media()).filter(m => pointsAt(m, oldPath));
      if (!refs.length) throw bad('No model photo uses that file, so it is left alone.');
      const newPath = `${dirOf(oldPath)}/${crypto.randomUUID()}-${nameWithoutUuid(baseOf(oldPath)).replace(/[^A-Za-z0-9._-]+/g, '-').slice(0, 80) || 'photo'}.jpg`;
      const { data, error } = await admin.storage.from(BUCKET).createSignedUploadUrl(newPath, { upsert: false });
      if (error) throw error;
      return json(200, { ok: true, bucket: BUCKET, old_url: pubUrl(oldPath), new_path: newPath, token: data.token, signed_url: data.signedUrl || data.signedURL || null });
    }

    if (action === 'swap') {
      const oldPath = String(body.old_path || ''), newPath = String(body.new_path || '');
      if (!mine(org, oldPath) || !mine(org, newPath) || dirOf(oldPath) !== dirOf(newPath)) throw bad('Those paths do not belong together.');
      const sizes = await sizesFor(admin, [dirOf(oldPath)]);
      const o = sizes.get(oldPath), n = sizes.get(newPath);
      if (!o) throw bad('The original is no longer in storage.', 409);
      if (!n) throw bad('The smaller copy did not arrive in storage.', 409);
      if (!/^image\/jpeg$/i.test(n.mime)) throw bad('The smaller copy is not a JPEG.', 409);
      if (n.size <= 0 || n.size > o.size * 0.85) { await admin.storage.from(BUCKET).remove([newPath]); throw bad('The copy is not meaningfully smaller, so the original stays.', 409); }
      const refs = (await media()).filter(m => pointsAt(m, oldPath));
      if (!refs.length) { await admin.storage.from(BUCKET).remove([newPath]); throw bad('No model photo uses the original any more.', 409); }
      const newUrl = pubUrl(newPath), stamp = { old_path: oldPath, old_url: pubUrl(oldPath), old_size: o.size, new_path: newPath, new_size: n.size, at: new Date().toISOString(), by: user.id };
      let done = 0;
      for (const m of refs) {
        const patch = { url: newUrl, metadata: { ...(m.metadata || {}), shrink: stamp } };
        if (m.public_id === oldPath) patch.public_id = newPath;
        const { data, error } = await admin.from('model_media').update(patch).eq('organization_id', org.id).eq('id', m.id).select('id,url').single();
        if (error) throw error;
        if (!data || data.url !== newUrl) throw bad('A photo entry did not take the new address.', 500);
        done++;
      }
      return json(200, { ok: true, verified: true, updated: done, old_mb: +(o.size / MB).toFixed(1), new_mb: +(n.size / MB).toFixed(1), new_url: newUrl });
    }

    if (action === 'rollback') {
      const oldPath = String(body.old_path || '');
      const refs = (await media()).filter(m => m.metadata && m.metadata.shrink && m.metadata.shrink.old_path === oldPath && !m.metadata.shrink.deleted_at);
      if (!refs.length) throw bad('Nothing to put back for that file.', 404);
      const sizes = await sizesFor(admin, [dirOf(oldPath)]);
      if (!sizes.get(oldPath)) throw bad('The original is already deleted, so it cannot be put back.', 409);
      const copyPath = refs[0].metadata.shrink.new_path;   /* read before the rows are rewritten */
      for (const m of refs) { const { shrink, ...rest } = m.metadata; const { error } = await admin.from('model_media').update({ url: shrink.old_url, public_id: m.public_id === shrink.new_path ? oldPath : m.public_id, metadata: rest }).eq('organization_id', org.id).eq('id', m.id); if (error) throw error; }
      await admin.storage.from(BUCKET).remove([copyPath]);
      return json(200, { ok: true, verified: true, restored: refs.length });
    }

    if (action === 'delete_originals') {
      if (body.confirm !== true) throw bad('Say confirm: true to delete the originals.');
      const all = await media(), waiting = all.filter(m => m.metadata && m.metadata.shrink && !m.metadata.shrink.deleted_at && mine(org, m.metadata.shrink.old_path));
      const byOld = new Map(); for (const m of waiting) (byOld.get(m.metadata.shrink.old_path) || byOld.set(m.metadata.shrink.old_path, []).get(m.metadata.shrink.old_path)).push(m);
      let freed = 0, deleted = 0; const skipped = [];
      for (const [oldPath, ms] of byOld) {
        if (all.some(m => pointsAt(m, oldPath))) { skipped.push({ old_path: oldPath, why: 'a photo entry still points at it' }); continue; }
        const { error } = await admin.storage.from(BUCKET).remove([oldPath]);
        if (error) { skipped.push({ old_path: oldPath, why: error.message }); continue; }
        const left = (await sizesFor(admin, [dirOf(oldPath)])).get(oldPath);
        if (left) { skipped.push({ old_path: oldPath, why: 'storage still shows it' }); continue; }
        for (const m of ms) await admin.from('model_media').update({ metadata: { ...m.metadata, shrink: { ...m.metadata.shrink, deleted_at: new Date().toISOString() } } }).eq('organization_id', org.id).eq('id', m.id);
        freed += ms[0].metadata.shrink.old_size || 0; deleted++;
      }
      return json(200, { ok: true, verified: true, deleted, freed_mb: +(freed / MB).toFixed(1), skipped });
    }
    return json(400, { error: 'Unsupported action' });
  } catch (error) { return errorResponse(error); }
};
