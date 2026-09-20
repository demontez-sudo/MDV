import { requireUser, adminClient, assertPermission, parseBody } from './_lib/auth.mjs';
import { requireStaffOrganization } from './_lib/agent-bridge.mjs';
import { loadJobInput, finishJob } from './_lib/vera-async.mjs';
import { runChat, setChatTimeout } from './agent-vera-chat.mjs';

export const handler = async (event) => {
  const admin = adminClient();
  let jobId = null;
  try {
    const { user, client } = await requireUser(event);
    const body = parseBody(event);
    jobId = String(body.job_id || '');
    const { organization } = await requireStaffOrganization({ user, client, organizationSlug: body.organization_slug || 'maison-de-veux' });
    if (!await assertPermission(admin, user.id, organization.id, 'ai.use')) throw new Error('You do not have permission to use Vera.');
    const payload = await loadJobInput({ admin, organization, user, id: jobId });
    if (!payload) throw new Error('Job input not found.');
    setChatTimeout(150000);
    const result = await runChat({ admin, organization, user, body: payload });
    await finishJob(admin, jobId, { result, provider: result.provider, model: result.model });
  } catch (error) {
    if (jobId) await finishJob(admin, jobId, { error });
  }
};
