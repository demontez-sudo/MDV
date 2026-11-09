/* DaySilk for models: their questionnaire answers, the plan built from them, daily check-ins, and the book-out sync that
   shares school / work commitments with their agent as availability blocks (reason starts "DaySilk:").
   Stored in model_private_profiles.metadata.daysilk, so there is no new table. */
import { requireUser, parseBody, json, errorResponse } from './_lib/auth.mjs';
import { requireModelPortal } from './_lib/portal-bridge.mjs';

const MAX_JSON = 60000;
const clip = (v, n) => String(v == null ? '' : v).slice(0, n);
const keep = 45;                    // days of check-ins kept

async function loadMeta(admin, org, modelId) {
  const { data, error } = await admin.from('model_private_profiles').select('model_id,metadata').eq('organization_id', org.id).eq('model_id', modelId).maybeSingle();
  if (error) throw error;
  return { row: data || null, meta: (data && data.metadata && typeof data.metadata === 'object') ? data.metadata : {} };
}
async function saveMeta(admin, org, modelId, row, meta) {
  if (row) { const { error } = await admin.from('model_private_profiles').update({ metadata: meta }).eq('organization_id', org.id).eq('model_id', modelId); if (error) throw error; }
  else { const { error } = await admin.from('model_private_profiles').insert({ organization_id: org.id, model_id: modelId, metadata: meta }); if (error) throw error; }
}
const size = o => { try { return JSON.stringify(o).length; } catch (_e) { return Infinity; } };

export const handler = async event => {
  if (!['GET', 'POST'].includes(event.httpMethod)) return json(405, { error: 'Method not allowed' });
  try {
    const { user } = await requireUser(event);
    const body = event.httpMethod === 'POST' ? parseBody(event) : {};
    const slug = body.organization_slug || (event.queryStringParameters || {}).organization || 'maison-de-veux';
    const { admin, organization, modelId } = await requireModelPortal({ user, organizationSlug: slug });
    const { row, meta } = await loadMeta(admin, organization, modelId);
    const ds = meta.daysilk && typeof meta.daysilk === 'object' ? meta.daysilk : {};

    if (event.httpMethod === 'GET') return json(200, { ok: true, daysilk: ds.answers ? ds : null });

    const action = String(body.action || '');

    if (action === 'save_profile') {
      const answers = body.answers && typeof body.answers === 'object' ? body.answers : null, plan = body.plan && typeof body.plan === 'object' ? body.plan : null;
      if (!answers || !plan) return json(400, { error: 'answers and plan are required' });
      if (size(answers) + size(plan) > MAX_JSON) return json(413, { error: 'That is too much to save. Shorten some answers.' });
      const next = { ...ds, answers, plan, onboarded_at: ds.onboarded_at || new Date().toISOString(), updated_at: new Date().toISOString(), days: ds.days || {} };
      await saveMeta(admin, organization, modelId, row, { ...meta, daysilk: next });
      return json(200, { ok: true, daysilk: next });
    }

    if (action === 'save_day') {
      const date = String(body.date || '');
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return json(400, { error: 'A valid date is required' });
      const day = body.day && typeof body.day === 'object' ? body.day : {};
      const clean = {
        done: Array.isArray(day.done) ? day.done.slice(0, 40).map(x => clip(x, 40)) : [],
        big3: Array.isArray(day.big3) ? day.big3.slice(0, 3).map(x => ({ t: clip(x && x.t, 140), done: !!(x && x.done) })) : [],
        review: day.review && typeof day.review === 'object' ? { win: clip(day.review.win, 300), hard: clip(day.review.hard, 300), mood: Number(day.review.mood) || null } : null,
      };
      const days = { ...(ds.days || {}), [date]: clean };
      const keys = Object.keys(days).sort();
      while (keys.length > keep) delete days[keys.shift()];
      await saveMeta(admin, organization, modelId, row, { ...meta, daysilk: { ...ds, days } });
      return json(200, { ok: true });
    }

    if (action === 'sync_bookouts') {
      const share = body.share !== false;
      const now = new Date();
      /* clear the ones DaySilk made before, from now on */
      const old = await admin.from('availability_blocks').select('id,reason,ends_at,status').eq('organization_id', organization.id).eq('model_id', modelId).neq('status', 'cancelled').gte('ends_at', now.toISOString()).limit(1000);
      if (old.error) throw old.error;
      const mine = (old.data || []).filter(b => String(b.reason || '').startsWith('DaySilk:')).map(b => b.id);
      for (let i = 0; i < mine.length; i += 100) {
        const { error } = await admin.from('availability_blocks').update({ status: 'cancelled' }).in('id', mine.slice(i, i + 100));
        if (error) throw error;
      }
      let created = 0;
      if (share) {
        const blocks = (Array.isArray(body.blocks) ? body.blocks : []).slice(0, 160).map(b => ({ s: new Date(b.starts_at), e: new Date(b.ends_at), r: clip(b.reason, 160) })).filter(b => !isNaN(b.s) && !isNaN(b.e) && b.e > b.s && b.e > now && b.s < new Date(now.getTime() + 200 * 864e5));
        const tz = clip(body.timezone, 60) || organization.timezone || null;
        const base = b => ({ organization_id: organization.id, model_id: modelId, block_type: 'bookout', starts_at: b.s.toISOString(), ends_at: b.e.toISOString(), timezone: tz, reason: b.r.startsWith('DaySilk:') ? b.r : 'DaySilk: ' + b.r, created_by: user.id });
        const attempts = [
          b => ({ ...base(b), status: 'approved', source: 'model', approved_by: user.id, approved_at: now.toISOString() }),
          b => ({ ...base(b), status: 'approved', source: 'agent', approved_by: user.id, approved_at: now.toISOString() }),
          b => ({ ...base(b), status: 'pending', source: 'agent' }),
        ];
        let lastErr = null;
        for (const shape of attempts) {
          const rows = blocks.map(shape);
          let ok = true;
          for (let i = 0; i < rows.length; i += 80) {
            const { error } = await admin.from('availability_blocks').insert(rows.slice(i, i + 80));
            if (error) { ok = false; lastErr = error; break; }
          }
          if (ok) { created = rows.length; lastErr = null; break; }
          /* a partial insert would duplicate on retry, so clear what this attempt made */
          await admin.from('availability_blocks').update({ status: 'cancelled' }).eq('organization_id', organization.id).eq('model_id', modelId).eq('created_by', user.id).like('reason', 'DaySilk:%').gte('created_at', now.toISOString());
        }
        if (lastErr) throw lastErr;
      }
      await saveMeta(admin, organization, modelId, row, { ...meta, daysilk: { ...ds, bookouts: { shared: share, count: created, synced_at: new Date().toISOString() } } });
      return json(200, { ok: true, shared: share, created, cleared: mine.length });
    }

    return json(400, { error: 'Unsupported action' });
  } catch (error) { return errorResponse(error); }
};
