-- Calendar clash review. READ-ONLY. Run as ONE query. It shows what 2026-11-09-calendar-clash-fix.sql WOULD change, plus the clashes it leaves for you.
-- Sections: 1 trips involved | 2 people it would take off a session | 3 check-ins and calls it would move | 4 clashes left for you
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
, pretty as (select id, title, event_type, starts_at, ends_at from public.events),
names as (select x.event_id, x.model_id, m.display_name from public.event_models x join public.models m on m.id = x.model_id)
select * from (
  select '1 trip involved'::text as section, t.title as what, to_char(t.starts_at, 'YYYY-MM-DD HH24:MI') || ' to ' || to_char(t.ends_at, 'YYYY-MM-DD HH24:MI') as when_,
         (select string_agg(n.display_name, ', ' order by n.display_name) from names n where n.event_id = t.id) as detail
  from pretty t where t.id in (select trip_id from fix_a) or t.id in (select b_id from ov where b_id in (select id from ev where event_type = 'travel'))
  union all
  select '2 take these people off the session', e.title, to_char(e.starts_at, 'YYYY-MM-DD HH24:MI'),
         (select string_agg(n.display_name, ', ' order by n.display_name) from names n where n.event_id = e.id and n.model_id in (select model_id from fix_a f where f.event_id = e.id))
  from (select distinct event_id from fix_a) f join pretty e on e.id = f.event_id
  union all
  select '3 move to after the clashing event', e.title, to_char(m.old_start, 'MM-DD HH24:MI') || ' -> ' || to_char(m.new_start, 'MM-DD HH24:MI'), (select display_name from names n where n.event_id = m.event_id limit 1) || ' (clashed with ' || m.because || ')'
  from fix_c m join pretty e on e.id = m.event_id
  union all
  select '4 left for you', left(a.title, 40) || '  vs  ' || left(b.title, 40), to_char(a.starts_at, 'YYYY-MM-DD HH24:MI'), (select string_agg(distinct n.display_name, ', ') from names n where n.model_id = o.model_id and n.event_id = a.id)
  from ov o join pretty a on a.id = o.a_id join pretty b on b.id = o.b_id
  where a.id < b.id and a.title <> b.title
    and not exists (select 1 from fix_a f where (f.event_id = a.id or f.event_id = b.id) and f.model_id = o.model_id)
    and not exists (select 1 from fix_c f where f.event_id = a.id or f.event_id = b.id)
) r order by section, when_ limit 100;
