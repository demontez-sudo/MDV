import { adminClient, json } from './_lib/auth.mjs';
import { failStaleAiJobs, AI_JOB_STALE_MINUTES } from './_lib/ai-job-recovery.mjs';

export const config = { schedule: '*/5 * * * *' };

export const handler = async () => {
  try {
    const result = await failStaleAiJobs(adminClient());
    return json(200, { ok: true, stale_minutes: AI_JOB_STALE_MINUTES, ...result }, { 'Cache-Control': 'no-store' });
  } catch (error) {
    console.error('[Vera AI watchdog]', String(error?.message || error));
    return json(500, { ok: false, error: 'AI job recovery failed' }, { 'Cache-Control': 'no-store' });
  }
};
