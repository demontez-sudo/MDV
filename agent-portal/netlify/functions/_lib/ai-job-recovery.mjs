const DEFAULT_STALE_MINUTES = 15;

function staleCutoff(minutes = DEFAULT_STALE_MINUTES) {
  const safeMinutes = Number.isFinite(Number(minutes)) ? Math.max(5, Number(minutes)) : DEFAULT_STALE_MINUTES;
  return new Date(Date.now() - safeMinutes * 60 * 1000).toISOString();
}

export async function failStaleAiJobs(admin, { organizationId = null, minutes = DEFAULT_STALE_MINUTES } = {}) {
  const completedAt = new Date().toISOString();
  let query = admin
    .from('ai_jobs')
    .update({
      status: 'failed',
      completed_at: completedAt,
      error_message: 'VEUX recovery closed a stale running job after its execution window expired.'
    })
    .eq('status', 'running')
    .lt('started_at', staleCutoff(minutes))
    .select('id');
  if (organizationId) query = query.eq('organization_id', organizationId);
  const { data, error } = await query;
  if (error) throw error;
  return { recovered: (data || []).length, completed_at: completedAt };
}

export const AI_JOB_STALE_MINUTES = DEFAULT_STALE_MINUTES;
