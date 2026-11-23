/* A model's contact details on her Model 360: email, phone, WhatsApp and her Instagram, X and TikTok.
   Email, phone, WhatsApp and Instagram are columns of model_private_profiles; X and TikTok live in its metadata.socials. */

const bad = (message) => { const e = new Error(message); e.statusCode = 400; e.publicMessage = message; return e; };
const text = (v, max) => String(v == null ? '' : v).replace(/[\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);

export const EMAIL_RX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const HOSTS = { instagram: 'instagram\\.com', x: '(?:x|twitter)\\.com', tiktok: 'tiktok\\.com' };
const LABEL = { instagram: 'Instagram', x: 'X', tiktok: 'TikTok', phone: 'Phone number', whatsapp: 'WhatsApp number', email: 'Email' };

export function cleanPhone(v, key = 'phone') {
  const s = text(v, 40);
  if (!s) return null;
  const digits = s.replace(/\D/g, '');
  if (!/^[+()\d][\d\s().\-]*$/.test(s) || digits.length < 6 || digits.length > 16) throw bad(LABEL[key] + ' looks wrong. Use digits, with the country code if you have it, like +1 617 555 0123.');
  return s;
}

/* "@name", "name", or a pasted profile link all become "name" */
export function cleanHandle(v, key) {
  let s = text(v, 160);
  if (!s) return null;
  s = s.replace(new RegExp('^(?:https?:\\/\\/)?(?:www\\.|m\\.|mobile\\.)?' + HOSTS[key] + '\\/', 'i'), '').replace(/^@/, '').replace(/[/?#].*$/, '').replace(/^@/, '');
  if (!/^[A-Za-z0-9._]{1,40}$/.test(s)) throw bad(LABEL[key] + ' name looks wrong. Use the handle only, like name or @name.');
  return s;
}

export function sanitizeContact(body) {
  const b = body || {};
  const email = text(b.email, 160).toLowerCase();
  if (email && !EMAIL_RX.test(email)) throw bad('Email looks wrong. Check the address.');
  return {
    email: email || null,
    phone: cleanPhone(b.phone, 'phone'),
    whatsapp: cleanPhone(b.whatsapp, 'whatsapp'),
    instagram: cleanHandle(b.instagram, 'instagram'),
    x: cleanHandle(b.x, 'x'),
    tiktok: cleanHandle(b.tiktok, 'tiktok')
  };
}

/* the stored row after a save: columns plus metadata.socials, nothing else in metadata is touched */
export function applyContact(existingMetadata, c) {
  const meta = { ...(existingMetadata && typeof existingMetadata === 'object' ? existingMetadata : {}) };
  const socials = { ...(meta.socials && typeof meta.socials === 'object' ? meta.socials : {}) };
  for (const k of ['x', 'tiktok']) { if (c[k]) socials[k] = c[k]; else delete socials[k]; }
  if (Object.keys(socials).length) meta.socials = socials; else delete meta.socials;
  return { columns: { email: c.email, phone: c.phone, whatsapp: c.whatsapp, instagram: c.instagram }, metadata: meta };
}

export async function saveContact(admin, organizationId, modelId, input) {
  const c = sanitizeContact(input);
  const { data: model, error: me } = await admin.from('models').select('id').eq('organization_id', organizationId).eq('id', modelId).maybeSingle();
  if (me) throw me;
  if (!model) { const e = new Error('Model not found'); e.statusCode = 404; e.publicMessage = 'Model not found'; throw e; }
  const { data: existing, error: ee } = await admin.from('model_private_profiles').select('model_id,metadata').eq('organization_id', organizationId).eq('model_id', modelId).maybeSingle();
  if (ee) throw ee;
  const { columns, metadata } = applyContact(existing && existing.metadata, c);
  const q = existing
    ? admin.from('model_private_profiles').update({ ...columns, metadata }).eq('organization_id', organizationId).eq('model_id', modelId)
    : admin.from('model_private_profiles').insert({ organization_id: organizationId, model_id: modelId, ...columns, metadata });
  const { data: row, error } = await q.select('*').single();
  if (error) throw error;
  return { row };
}
