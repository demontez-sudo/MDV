import { adminClient } from './_lib/auth.mjs';
import { notify } from './_lib/push.mjs';

/* Every 15 minutes: a note's follow-up that has come due is sent to the person who wrote it, once. */
export default async () => {
  try {
    const admin = adminClient();
    const now = new Date().toISOString(), since = new Date(Date.now() - 36 * 3600 * 1000).toISOString();
    const { data, error } = await admin.from('smart_notes').select('id,organization_id,author_id,title,body,follow_up_at,smart').eq('archived', false).eq('resolved', false).lte('follow_up_at', now).gte('follow_up_at', since).limit(200);
    if (error) return Response.json({ ok: true, skipped: 'no_notes_table' });
    let n = 0;
    for (const note of data || []) {
      if (note.smart?.followup_pushed || !note.author_id) continue;
      const first = String(note.title || note.body || '').replace(/\s+/g, ' ').trim().slice(0, 140);
      const r = await notify(admin, { orgId: note.organization_id, userIds: [note.author_id], title: 'Follow-up due', body: first, url: '?page=notes', category: 'followups', tag: 'note-' + note.id });
      await admin.from('smart_notes').update({ smart: { ...(note.smart || {}), followup_pushed: new Date().toISOString() } }).eq('id', note.id);
      if (r.sent) n++;
    }
    return Response.json({ ok: true, notified: n });
  } catch (e) { console.error('[push sweep]', e); return Response.json({ ok: false }, { status: 500 }); }
};
export const config = { schedule: '*/15 * * * *' };
