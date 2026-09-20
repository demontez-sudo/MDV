const clean = v => String(v == null ? '' : v).trim();

export function siteBase(event) {
  const own = clean(process.env.URL || process.env.DEPLOY_PRIME_URL);
  if (own) return own.replace(/\/$/, '');
  const h = event?.headers || {};
  const host = clean(h['x-forwarded-host'] || h.host).split(',')[0].trim();
  return host ? `https://${host}` : '';
}

export async function startJob({ admin, organization, user, event, kind, input, background }) {
  const { data: job, error } = await admin.from('ai_jobs').insert({
    organization_id: organization.id, job_type: 'report', status: 'running', requested_by: user.id,
    input: { compat: `vera-async:${kind}`, payload: input }, started_at: new Date().toISOString()
  }).select('id').single();
  if (error) throw error;
  const auth = event.headers?.authorization || event.headers?.Authorization || '';
  const url = `${siteBase(event)}/.netlify/functions/${background}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 9000);
  try {
    const res = await fetch(url, { method: 'POST', headers: { authorization: auth, 'content-type': 'application/json' }, body: JSON.stringify({ job_id: job.id, organization_slug: organization.slug }), signal: controller.signal });
    if (!res.ok && res.status !== 202) throw new Error(`Background worker refused the job (${res.status}).`);
  } catch (e) {
    await admin.from('ai_jobs').update({ status: 'failed', error_message: clean(e?.message).slice(0, 400), completed_at: new Date().toISOString() }).eq('id', job.id);
    throw e;
  } finally { clearTimeout(timer); }
  return job.id;
}

export async function readJob({ admin, organization, user, id }) {
  const { data, error } = await admin.from('ai_jobs').select('id,status,result,error_message,requested_by,organization_id,started_at,completed_at').eq('id', id).eq('organization_id', organization.id).maybeSingle();
  if (error) throw error;
  if (!data || data.requested_by !== user.id) return null;
  return data;
}

export async function loadJobInput({ admin, organization, user, id }) {
  const { data, error } = await admin.from('ai_jobs').select('id,status,input,requested_by').eq('id', id).eq('organization_id', organization.id).maybeSingle();
  if (error) throw error;
  if (!data || data.requested_by !== user.id) return null;
  return data.input?.payload || null;
}

export async function finishJob(admin, id, { result, error, provider, model }) {
  const patch = { completed_at: new Date().toISOString() };
  if (error) { patch.status = 'failed'; patch.error_message = clean(error?.message || error).slice(0, 800); }
  else { patch.status = 'complete'; patch.result = result; patch.error_message = null; if (provider) patch.provider = provider; if (model) patch.provider_model = model; }
  await admin.from('ai_jobs').update(patch).eq('id', id);
}

export function pollResponse(job, json) {
  if (!job) return json(404, { error: 'Job not found.' });
  if (job.status === 'complete') return json(200, { ok: true, status: 'complete', result: job.result });
  if (job.status === 'failed') return json(200, { ok: false, status: 'failed', error: job.error_message || 'The request failed.' });
  const age = Date.now() - new Date(job.started_at || Date.now()).getTime();
  if (age > 6 * 60 * 1000) return json(200, { ok: false, status: 'failed', error: 'The request took too long. Please try again.' });
  return json(200, { ok: true, status: 'running' });
}
