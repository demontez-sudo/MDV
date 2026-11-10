-- Calendar clash fix, 9 Nov 2026. Run 2026-11-09-calendar-clash-review.sql FIRST and check it. Then run this once, as one script (one transaction).
-- 1) Takes a person off a group session (2+ people) when it overlaps one of their trips. The session stays for everyone else.
-- 2) Moves a one-person check-in or pre-departure call that sits inside another event to start when that event ends, if that slot is free.
--    The meeting task for the event moves with it, and the old time is kept on the event as moved_for_clash.
-- Only events from today onward are touched. Trips, test shoots, visa days and one-person events that are not check-ins/calls are left for you.
drop table if exists _fix_a, _fix_c, _clash_count;
begin;
create temp table _fix_a as
with
em as (select event_id, count(*) as n from public.event_models group by event_id),
ev as (select e.*, coalesce(em.n, 0) as n from public.events e left join em on em.event_id = e.id
       where e.status <> 'cancelled' and e.all_day is not true and e.ends_at is not null and e.ends_at > e.starts_at),
-- every pair of timed events that overlap for the same person, from today onward (both directions)
ov as (
  select x.model_id, a.id as a_id, b.id as b_id
  from public.event_models x
  join public.event_models y on y.model_id = x.model_id and y.event_id <> x.event_id
  join ev a on a.id = x.event_id join ev b on b.id = y.event_id
  where a.starts_at >= now() and a.starts_at < b.ends_at and b.starts_at < a.ends_at
),
-- A: a group session (2+ people) overlapping a trip of one of its people -> take that person off the session
fix_a as (
  select distinct o.a_id as event_id, o.model_id, o.b_id as trip_id
  from ov o join ev a on a.id = o.a_id join ev b on b.id = o.b_id
  where a.n >= 2 and a.event_type is distinct from 'travel' and b.event_type = 'travel'
),
-- C: a one-person check-in or pre-departure call inside another (non-travel) event -> move it to start when that event ends
mv as (
  select a.id as event_id, o.model_id, a.starts_at as old_start, a.ends_at as old_end,
         max(b.ends_at) as new_start, max(b.ends_at) + (a.ends_at - a.starts_at) as new_end, string_agg(distinct b.title, ' / ') as because
  from ov o join ev a on a.id = o.a_id join ev b on b.id = o.b_id
  where a.n = 1 and a.event_type is distinct from 'travel' and b.event_type is distinct from 'travel'
    and a.title ~* '(check-in|pre-departure call)'
  group by a.id, o.model_id, a.starts_at, a.ends_at
),
fix_c as (
  select m.* from mv m
  where not exists (   -- the new slot must be free for that person
    select 1 from public.event_models x join ev z on z.id = x.event_id
    where x.model_id = m.model_id and z.id <> m.event_id and z.starts_at < m.new_end and m.new_start < z.ends_at)
)

select * from fix_a;
create temp table _fix_c as
with
em as (select event_id, count(*) as n from public.event_models group by event_id),
ev as (select e.*, coalesce(em.n, 0) as n from public.events e left join em on em.event_id = e.id
       where e.status <> 'cancelled' and e.all_day is not true and e.ends_at is not null and e.ends_at > e.starts_at),
-- every pair of timed events that overlap for the same person, from today onward (both directions)
ov as (
  select x.model_id, a.id as a_id, b.id as b_id
  from public.event_models x
  join public.event_models y on y.model_id = x.model_id and y.event_id <> x.event_id
  join ev a on a.id = x.event_id join ev b on b.id = y.event_id
  where a.starts_at >= now() and a.starts_at < b.ends_at and b.starts_at < a.ends_at
),
-- A: a group session (2+ people) overlapping a trip of one of its people -> take that person off the session
fix_a as (
  select distinct o.a_id as event_id, o.model_id, o.b_id as trip_id
  from ov o join ev a on a.id = o.a_id join ev b on b.id = o.b_id
  where a.n >= 2 and a.event_type is distinct from 'travel' and b.event_type = 'travel'
),
-- C: a one-person check-in or pre-departure call inside another (non-travel) event -> move it to start when that event ends
mv as (
  select a.id as event_id, o.model_id, a.starts_at as old_start, a.ends_at as old_end,
         max(b.ends_at) as new_start, max(b.ends_at) + (a.ends_at - a.starts_at) as new_end, string_agg(distinct b.title, ' / ') as because
  from ov o join ev a on a.id = o.a_id join ev b on b.id = o.b_id
  where a.n = 1 and a.event_type is distinct from 'travel' and b.event_type is distinct from 'travel'
    and a.title ~* '(check-in|pre-departure call)'
  group by a.id, o.model_id, a.starts_at, a.ends_at
),
fix_c as (
  select m.* from mv m
  where not exists (   -- the new slot must be free for that person
    select 1 from public.event_models x join ev z on z.id = x.event_id
    where x.model_id = m.model_id and z.id <> m.event_id and z.starts_at < m.new_end and m.new_start < z.ends_at)
)

select * from fix_c;

delete from public.event_models x using _fix_a f where x.event_id = f.event_id and x.model_id = f.model_id;

update public.events e set
  metadata = coalesce(e.metadata, '{}'::jsonb) || jsonb_build_object('moved_for_clash', f.old_start),
  starts_at = f.new_start, ends_at = f.new_end
from _fix_c f where e.id = f.event_id;

update public.tasks t set due_at = f.new_start
from _fix_c f join public.events e on e.id = f.event_id
where t.id::text = e.metadata->>'task_id' and t.status not in ('completed', 'cancelled', 'done');
commit;

select 'people taken off group sessions' as what, (select count(*) from _fix_a)::int as n
union all select 'check-ins and calls moved', (select count(*) from _fix_c)::int;
