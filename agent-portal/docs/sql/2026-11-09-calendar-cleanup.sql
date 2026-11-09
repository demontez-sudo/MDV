-- Calendar cleanup, 9 Nov 2026. Run ONCE in the Supabase SQL editor, as one script. It is one transaction: all of it or none of it.
-- 1) Removes extra copies of events entered twice (same title, start time and models). The oldest copy stays.
--    Today that is "Weekly reset" (25 Oct) and "India -> Paris" (5 Jan).
-- 2) Takes people who are archived, released or inactive off events from today onward. An event left with nobody on it is deleted
--    (for example "Monthly check-in: Ayan"). Past events are not touched, so their history stays.
-- 3) Fills in the missing time zone as America/New_York (your most common). Travel events are left alone because each one can be in a different city.
-- Tasks linked to a deleted event are kept (unlinked); the meeting task made for an event is cancelled, the same as deleting in the portal.
-- Deleted prepared-schedule events are remembered so the import cannot bring them back.
drop table if exists _gone_dup, _gone_arch, _gone, _unlinked, _tz;
begin;

create temp table _gone_dup as
select id from (
  select e.id, row_number() over (partition by e.organization_id, e.title, e.starts_at, coalesce(em.models, '') order by e.created_at, e.id) as rn
  from public.events e
  left join (select event_id, string_agg(model_id::text, ',' order by model_id::text) as models from public.event_models group by event_id) em on em.event_id = e.id
) t where rn > 1;

create temp table _gone_arch as
select e.id from public.events e
where e.starts_at >= now()
  and exists (select 1 from public.event_models x join public.models m on m.id = x.model_id where x.event_id = e.id and (m.status ~* '^(archiv|releas|inactive|former)' or m.active is false))
  and not exists (select 1 from public.event_models x join public.models m on m.id = x.model_id where x.event_id = e.id and not (m.status ~* '^(archiv|releas|inactive|former)' or m.active is false))
  and e.id not in (select id from _gone_dup);

create temp table _gone as select id from _gone_dup union select id from _gone_arch;

-- remember deleted prepared-schedule events (only if no surviving event carries the same import key)
insert into public.calendar_import_skips (organization_id, import_set, import_key)
select distinct e.organization_id, e.metadata->>'import_set', e.metadata->>'import_key'
from public.events e
where e.id in (select id from _gone) and e.metadata->>'import_set' is not null and e.metadata->>'import_key' is not null
  and not exists (select 1 from public.events k where k.id not in (select id from _gone) and k.organization_id = e.organization_id and k.metadata->>'import_set' = e.metadata->>'import_set' and k.metadata->>'import_key' = e.metadata->>'import_key')
on conflict do nothing;

update public.tasks set status = 'cancelled'
where status not in ('completed', 'cancelled', 'done') and id::text in (select e.metadata->>'task_id' from public.events e where e.id in (select id from _gone) and e.metadata->>'task_id' is not null
    and not exists (select 1 from public.events k where k.id not in (select id from _gone) and k.metadata->>'task_id' = e.metadata->>'task_id'));

update public.tasks set event_id = null where event_id in (select id from _gone);

-- the same order the portal's delete uses: release everything that points at the event, then delete it
update public.availability_blocks set source_event_id = null where source_event_id in (select id from _gone);
delete from public.event_members where event_id in (select id from _gone);
delete from public.event_models where event_id in (select id from _gone);
delete from public.events where id in (select id from _gone);

-- people who are archived, released or inactive come off the events still ahead (these have other people on them)
create temp table _unlinked as
with d as (
  delete from public.event_models x using public.models m, public.events e
  where m.id = x.model_id and e.id = x.event_id and e.starts_at >= now()
    and (m.status ~* '^(archiv|releas|inactive|former)' or m.active is false)
  returning x.event_id
) select event_id from d;

create temp table _tz as
with u as (update public.events set timezone = 'America/New_York' where timezone is null and event_type is distinct from 'travel' returning id) select id from u;

commit;

select 'duplicate copies removed' as what, (select count(*) from _gone_dup)::int as n
union all select 'events deleted because only an archived/released/inactive person was on them', (select count(*) from _gone_arch)::int
union all select 'archived/released/inactive people taken off future events', (select count(*) from _unlinked)::int
union all select 'time zones filled in', (select count(*) from _tz)::int
union all select 'travel events still without a time zone', (select count(*) from public.events where timezone is null)::int;
