/* Shoot plans for a model (Model 360 > Development > Shoot plan). Staff only; never shown in the model portal. */
import { requireUser, parseBody, json, errorResponse } from './_lib/auth.mjs';
import { requireStaffOrganization, requirePermission } from './_lib/agent-bridge.mjs';

const missingTable = e => ['42P01', 'PGRST205', 'PGRST200'].includes(String(e?.code || '')) || /relation .* does not exist|could not find the table/i.test(String(e?.message || ''));
const clip = (v, n) => String(v == null ? '' : v).slice(0, n);

export const handler = async event => {
  if (!['GET', 'POST'].includes(event.httpMethod)) return json(405, { error: 'Method not allowed' });
  try {
    const { user, client } = await requireUser(event);
    const body = event.httpMethod === 'POST' ? parseBody(event) : {};
    const p = event.queryStringParameters || {};
    const { organization } = await requireStaffOrganization({ user, client, organizationSlug: body.organization_slug || p.organization || 'maison-de-veux' });
    const modelId = String(body.model_id || p.model_id || '');
    if (!modelId) return json(400, { error: 'model_id is required' });

    if (event.httpMethod === 'GET') {
      const admin = await requirePermission(user.id, organization.id, 'development.read');
      const { data, error } = await admin.from('model_shoot_plans').select('*').eq('organization_id', organization.id).eq('model_id', modelId).neq('status', 'archived').order('updated_at', { ascending: false });
      if (error) { if (missingTable(error)) return json(200, { ok: true, plans: [], needs_setup: true }); throw error; }
      return json(200, { ok: true, plans: data || [] });
    }

    const admin = await requirePermission(user.id, organization.id, 'development.write');
    const action = String(body.action || '');
    if (action === 'save') {
      const title = clip(body.title, 200).trim();
      const plan = body.plan && typeof body.plan === 'object' ? body.plan : null;
      if (!title || !plan) return json(400, { error: 'A title and the plan are required' });
      if (JSON.stringify(plan).length > 400000) return json(413, { error: 'That plan is too large' });
      const { data: model, error: mErr } = await admin.from('models').select('id').eq('organization_id', organization.id).eq('id', modelId).maybeSingle();
      if (mErr) throw mErr; if (!model) return json(404, { error: 'Model not found' });
      const { data: existing, error: eErr } = await admin.from('model_shoot_plans').select('id').eq('organization_id', organization.id).eq('model_id', modelId).eq('title', title).neq('status', 'archived').maybeSingle();
      if (eErr) { if (missingTable(eErr)) return json(409, { error: 'Shoot plans are not set up yet. Run docs/sql/2026-10-22-model-shoot-plans.sql in Supabase first.', needs_setup: true }); throw eErr; }
      const row = { title, plan, source_name: clip(body.source_name, 200) || null, updated_at: new Date().toISOString() };
      let saved;
      if (existing) { const r = await admin.from('model_shoot_plans').update(row).eq('organization_id', organization.id).eq('id', existing.id).select('*').single(); if (r.error) throw r.error; saved = r.data; }
      else { const r = await admin.from('model_shoot_plans').insert({ ...row, organization_id: organization.id, model_id: modelId, created_by: user.id }).select('*').single(); if (r.error) throw r.error; saved = r.data; }
      return json(200, { ok: true, verified: !!saved?.id, plan: saved, replaced: !!existing });
    }
    if (action === 'share') {
      const id = String(body.plan_id || ''); if (!id) return json(400, { error: 'plan_id is required' });
      const shared = body.shared === true;
      const sections = [...new Set((Array.isArray(body.sections) ? body.sections : []).map(x => String(x).slice(0, 12)).filter(x => /^(brief|book|prep|s\d{1,2})$/.test(x)))];
      if (shared && !sections.length) return json(400, { error: 'Choose at least one section to share' });
      const { data: cur, error: cErr } = await admin.from('model_shoot_plans').select('id,title,shared_with_model,shared_sections').eq('organization_id', organization.id).eq('model_id', modelId).eq('id', id).maybeSingle();
      if (cErr) { if (/shared_with_model|shared_sections|column/i.test(String(cErr.message || ''))) return json(409, { error: 'Sharing needs the updated setup. Run docs/sql/2026-10-22-model-shoot-plans.sql again in Supabase.', needs_setup: true }); throw cErr; }
      if (!cur) return json(404, { error: 'Plan not found' });
      const { data, error } = await admin.from('model_shoot_plans').update({ shared_with_model: shared, shared_sections: shared ? sections : [], shared_at: shared ? new Date().toISOString() : null, updated_at: new Date().toISOString() }).eq('organization_id', organization.id).eq('id', id).select('id,shared_with_model,shared_sections,shared_at').single();
      if (error) throw error;
      /* tell the model, once, when a plan first becomes visible to them */
      if (shared && !cur.shared_with_model) {
        try {
          const { data: link } = await admin.from('model_user_links').select('user_id').eq('organization_id', organization.id).eq('model_id', modelId).maybeSingle();
          if (link?.user_id) await admin.from('notifications').insert({ organization_id: organization.id, user_id: link.user_id, notification_type: 'shoot_plan_shared', title: 'Your shoot plan is ready', body: 'Your agent shared your shoot plan. Open Shoot plan to see the shoots, the shot list and what to prepare.', channel: 'in_app', status: 'delivered', source_type: 'shoot_plan', source_id: id, action_url: '?page=myshoot', metadata: { model_id: modelId } });
        } catch (e) { /* the share itself is saved; a missed notice should not undo it */ }
      }
      return json(200, { ok: true, verified: data?.shared_with_model === shared, plan: data });
    }
    if (action === 'archive') {
      const id = String(body.plan_id || ''); if (!id) return json(400, { error: 'plan_id is required' });
      const { data, error } = await admin.from('model_shoot_plans').update({ status: 'archived', updated_at: new Date().toISOString() }).eq('organization_id', organization.id).eq('model_id', modelId).eq('id', id).select('id').single();
      if (error) throw error;
      return json(200, { ok: true, verified: !!data?.id });
    }
    return json(400, { error: 'Unsupported action' });
  } catch (error) { return errorResponse(error); }
};
