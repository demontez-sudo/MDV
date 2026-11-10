-- Undo for 2026-11-10-calendar-real-times.sql: restores every event it touched (time, all-day flag, time zone, agent, metadata), removes the model links it added
-- and puts the tasks' due times back. Run once, as one script.
begin;
delete from public.event_models x using public.calendar_time_fix_links l where l.batch = '2026-11-10' and x.event_id = l.event_id and x.model_id = l.model_id;
update public.events e set starts_at = b.old_starts_at, ends_at = b.old_ends_at, all_day = b.old_all_day, timezone = b.old_timezone, owner_member_id = b.old_owner_member_id, metadata = coalesce(b.old_metadata, '{}'::jsonb), updated_at = now()
from public.calendar_time_fix_backup b where b.batch = '2026-11-10' and b.event_id = e.id;
update public.tasks t set due_at = b.old_due_at, metadata = coalesce(t.metadata, '{}'::jsonb) - 'time_fixed' from public.calendar_time_fix_tasks b where b.batch = '2026-11-10' and b.task_id = t.id;
commit;
select (select count(*) from public.calendar_time_fix_backup where batch = '2026-11-10') as events_restored, (select count(*) from public.calendar_time_fix_links where batch = '2026-11-10') as links_removed, (select count(*) from public.calendar_time_fix_tasks where batch = '2026-11-10') as tasks_restored;
