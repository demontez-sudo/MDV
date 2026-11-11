import { assertPermission } from './auth.mjs';
import { notify, staffUserIds } from './push.mjs';

// Tell the agency (staff who can read development submissions) that a model has submitted something to review.
// Two parts: a bell notification inside the agent portal, and a device alert (MacBook / iPhone) when push is set up.
// Never throws: an alert must not break the model's upload.
export async function alertAgencyOfSubmission(admin, { organization, modelId, submission, resubmitted = false }) {
  try {
    const { data: model } = await admin.from('models').select('display_name').eq('organization_id', organization.id).eq('id', modelId).maybeSingle();
    const name = model?.display_name || 'A model';
    const kind = submission.submission_type === 'walk' ? 'model walk' : 'skin check';
    const title = `${resubmitted ? 'Updated' : 'New'} ${kind} from ${name}`;
    const body = `${name} ${resubmitted ? 'sent updated files for' : 'submitted a'} ${kind}${resubmitted ? '' : ' for review'}. Open Model Submissions to approve it or request changes.`;

    const staff = await staffUserIds(admin, organization.id);
    const recipients = [];
    for (const userId of staff) { try { if (await assertPermission(admin, userId, organization.id, 'development.read')) recipients.push(userId); } catch (_e) { /* skip this person */ } }
    if (!recipients.length) return { notified: 0 };

    const rows = recipients.map(user_id => ({
      organization_id: organization.id, user_id, notification_type: 'model_development_submission', title, body, channel: 'in_app', status: 'delivered',
      source_type: 'development_submission', source_id: submission.id, action_url: '?page=modelsubmissions', metadata: { model_id: modelId, submission_type: submission.submission_type, resubmitted }
    }));
    let r = await admin.from('notifications').insert(rows);
    if (r.error) r = await admin.from('notifications').insert(rows.map(({ metadata, ...x }) => x));
    if (r.error) console.warn('[skin-walks] bell notification failed:', r.error.message);

    const push = await notify(admin, { orgId: organization.id, userIds: recipients, title, body, url: '?page=modelsubmissions', category: 'development', tag: `dev-${submission.id}`, level: 'soon' });
    return { notified: recipients.length, push };
  } catch (e) { console.warn('[skin-walks] agency alert failed:', e?.message || e); return { notified: 0, error: String(e?.message || e) }; }
}
