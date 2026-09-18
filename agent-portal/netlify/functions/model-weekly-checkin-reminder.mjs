import { adminClient, json } from './_lib/auth.mjs';

// Runs every Friday at 15:00 UTC (~10-11am US markets). Prompts every model
// with active Model Portal access to complete their weekly wellness
// check-in (diet/hydration, workout routine completion, skin treatment) --
// the recurring Friday questionnaire the agency asked Vera to run.
export const config = { schedule: '0 15 * * 5' };

function isoWeekKey(d) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

export const handler = async () => {
  const admin = adminClient();
  const weekKey = isoWeekKey(new Date());
  const summary = { organizations: 0, models_checked: 0, reminders_sent: 0, skipped_already_sent: 0, errors: [] };
  try {
    const { data: orgs, error: orgErr } = await admin.from('organizations').select('id,slug').limit(200);
    if (orgErr) throw orgErr;
    for (const org of orgs || []) {
      summary.organizations++;
      const { data: links, error: linkErr } = await admin.from('model_user_links')
        .select('user_id,model_id').eq('organization_id', org.id);
      if (linkErr) { summary.errors.push(`${org.slug}: ${linkErr.message}`); continue; }
      for (const link of links || []) {
        if (!link.user_id || !link.model_id) continue;
        summary.models_checked++;
        const { data: already, error: dupErr } = await admin.from('notifications')
          .select('id').eq('organization_id', org.id).eq('user_id', link.user_id)
          .eq('notification_type', 'model_weekly_checkin_reminder')
          .eq('metadata->>week', weekKey).limit(1).maybeSingle();
        if (dupErr) { summary.errors.push(`${org.slug}/${link.model_id}: ${dupErr.message}`); continue; }
        if (already) { summary.skipped_already_sent++; continue; }
        const { error: insErr } = await admin.from('notifications').insert({
          organization_id: org.id,
          user_id: link.user_id,
          notification_type: 'model_weekly_checkin_reminder',
          title: 'Vera · Your weekly check-in is ready',
          body: 'Take a minute to log this week’s diet/hydration, workout routine and skin treatment in Wellness -- your agency reviews these every week.',
          channel: 'in_app',
          status: 'delivered',
          source_type: 'model_wellness_checkin',
          source_id: link.model_id,
          action_url: '?page=wellness',
          metadata: { week: weekKey, model_id: link.model_id }
        });
        if (insErr) { summary.errors.push(`${org.slug}/${link.model_id}: ${insErr.message}`); continue; }
        summary.reminders_sent++;
      }
    }
    return json(200, { ok: true, week: weekKey, ...summary }, { 'Cache-Control': 'no-store' });
  } catch (error) {
    console.error('[Vera weekly check-in reminder]', String(error?.message || error));
    return json(500, { ok: false, error: 'Weekly check-in reminder sweep failed', ...summary }, { 'Cache-Control': 'no-store' });
  }
};
