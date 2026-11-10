-- Undo for 2026-11-10-calendar-model-plan.sql: removes the events it created, puts moved test shoots back, and restores the old descriptions. Run once.
begin;
delete from public.event_models x using public.events e where x.event_id = e.id and e.metadata->>'model_plan' = '2026-11-10';
delete from public.events e where e.metadata->>'model_plan' = '2026-11-10';
update public.events e set starts_at = b.old_starts_at, ends_at = b.old_ends_at, all_day = b.old_all_day, timezone = b.old_timezone, owner_member_id = b.old_owner_member_id, metadata = coalesce(b.old_metadata, '{}'::jsonb), notes = b.old_notes, updated_at = now()
from public.calendar_time_fix_backup b where b.batch = '2026-11-10-model-plan' and b.event_id = e.id;
commit;
select count(*) as events_restored from public.calendar_time_fix_backup where batch = '2026-11-10-model-plan';
