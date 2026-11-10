-- Calendar real times, 10 Nov 2026. Run 2026-11-10-calendar-real-times-review.sql FIRST. Then run this once, as one script (one transaction).
-- 1) Events saved as "all day" (12:00 AM to 11:59 PM) or at midnight get a real time of day for their kind of work (appointments and visa work in the morning,
--    pipeline work late morning, check-ins after lunch, content in the afternoon, deadlines at 5:00 PM), in the event's own time zone, in the first slot that is
--    free for the agent AND for every model on it. Stays and long trips are left alone.
-- 2) Events with no agent get one from the owner name or team on the event (staff matched by first name).
-- 3) Events that name a model in the title but are linked to nobody get linked to that model.
-- 4) Meeting tasks follow their meeting; tasks due at midnight are due at 5:00 PM.
-- Every change is backed up first. 2026-11-10-calendar-real-times-undo.sql puts everything back exactly.
create table if not exists public.calendar_time_fix_backup (event_id uuid not null, batch text not null, old_starts_at timestamptz, old_ends_at timestamptz, old_all_day boolean, old_timezone text, old_owner_member_id uuid, old_metadata jsonb, backed_up_at timestamptz default now(), primary key (event_id, batch));
create table if not exists public.calendar_time_fix_links (event_id uuid not null, model_id uuid not null, batch text not null, primary key (event_id, model_id, batch));
create table if not exists public.calendar_time_fix_tasks (task_id uuid not null, batch text not null, old_due_at timestamptz, primary key (task_id, batch));
alter table public.calendar_time_fix_backup enable row level security; alter table public.calendar_time_fix_links enable row level security; alter table public.calendar_time_fix_tasks enable row level security;
begin;

drop table if exists _tz, _staff_u, _own, _cand, _busy, _plan, _links, _tasks, _mkeys, _unmatched;

-- time zone names that are real (checked once, not once per event)
create temp table _tz as select name from pg_timezone_names where name in (select distinct timezone from public.events where timezone is not null);

-- who counts as staff: active members, matched by first name (only first names that are unique)
create temp table _staff_u as
select s.first, (array_agg(s.member_id))[1] as member_id
from (select om.id as member_id, lower(coalesce(nullif(p.first_name, ''), split_part(p.display_name, ' ', 1))) as first
      from public.organization_members om join public.profiles p on p.user_id = om.user_id
      where om.status = 'active' and coalesce(om.member_type, 'staff') = 'staff') s
where s.first <> '' group by s.first having count(*) = 1;

-- the agent for an event: its owner name, else the first team member, matched to staff. Only fills events that have no owner.
create temp table _own as
select distinct on (x.id) x.id, x.member_id, x.how from (
  select e.id, su.member_id, 'owner name'::text as how, 1 as pri, 0 as ord
  from public.events e join _staff_u su on su.first = lower(split_part(trim(coalesce(e.metadata->>'owner_name', '')), ' ', 1))
  where e.owner_member_id is null and coalesce(e.metadata->>'owner_name', '') <> ''
  union all
  select e.id, su.member_id, 'team', 2, t.ord
  from public.events e
  cross join lateral jsonb_array_elements_text(case when jsonb_typeof(e.metadata->'team') = 'array' then e.metadata->'team' else '[]'::jsonb end) with ordinality as t(name, ord)
  join _staff_u su on su.first = lower(split_part(trim(t.name), ' ', 1))
  where e.owner_member_id is null
) x order by x.id, x.pri, x.ord;

-- owner names in the data that match nobody on the team
create temp table _unmatched as
select trim(e.metadata->>'owner_name') as owner_name, count(*) as n
from public.events e left join _own o on o.id = e.id
where e.owner_member_id is null and o.id is null and coalesce(e.metadata->>'owner_name', '') <> ''
group by 1;

-- events that name a person in the title but are not linked to anyone: "Violeta: visa documents", "Krishita Shetty - Submission Wave", "Monthly check-in: Ayan"
create temp table _mkeys as
select model_id, k from (
  select m.id as model_id, lower(m.display_name) as k from public.models m where m.active is not false and coalesce(m.status, '') !~* '^(archiv|releas|inactive|former)'
  union all
  select (array_agg(m.id))[1], lower(split_part(m.display_name, ' ', 1)) from public.models m
  where m.active is not false and coalesce(m.status, '') !~* '^(archiv|releas|inactive|former)' group by lower(split_part(m.display_name, ' ', 1)) having count(*) = 1
) q where k <> '' and k not in (select first from _staff_u);
create temp table _links as
select event_id, (array_agg(model_id))[1] as model_id from (
  select distinct e.id as event_id, k.model_id
  from public.events e
  join _mkeys k on k.k in (lower(trim(regexp_replace(e.title, '\s*(—|–|:|·| - | \| ).*$', ''))), lower(trim(regexp_replace(e.title, '^.*(—|–|:| - ) *', ''))))
  where e.status <> 'cancelled' and not exists (select 1 from public.event_models em where em.event_id = e.id) and e.title ~ '(—|–|:|·| - | \| )'
) l group by event_id having count(distinct model_id) = 1;

-- events that still have a placeholder time: all day, or midnight with no real end. Single days only (stays and long trips are left as they are).
create temp table _cand as
select z.id, z.tz, z.d, z.old_start, z.old_end, z.old_all_day, z.owner_id, z.cat,
  case z.cat when 'appt' then 1 when 'visa' then 2 when 'pipeline' then 3 when 'touch' then 4 when 'content' then 5 when 'admin' then 6 else 7 end as prio,
  case z.cat when 'appt' then 600 when 'visa' then 600 when 'pipeline' then 660 when 'touch' then 810 when 'content' then 840 when 'admin' then 900 else 1020 end as base,
  case z.cat when 'appt' then 60 when 'deadline' then 15 when 'touch' then 30 when 'admin' then 30 else 45 end as dur
from (
  select e.id, e.tz, (e.starts_at at time zone e.tz)::date as d, e.starts_at as old_start, e.ends_at as old_end, e.all_day as old_all_day, coalesce(e.owner_member_id, o.member_id) as owner_id,
    case
      when e.txt ~ '(consulate|interview|biometric|appointment)' then 'appt'
      when e.txt ~ '(deadline|due |expires|expiry|hard stop|filing day)' or e.event_type = 'deadline' then 'deadline'
      when e.txt ~ '(visa|immigration|passport|petition|sponsor|document|counsel|medical|golden card|o-1|o1)' then 'visa'
      when e.txt ~ '(submission|booking|push|wave|casting|go.?see|digital|test shoot|polaroid|brief)' then 'pipeline'
      when e.txt ~ '(social|content|editorial|post|campaign)' then 'content'
      when e.txt ~ '(check.?in|call|meeting|review|sync|coordination|representation|onboard)' then 'touch'
      else 'admin' end as cat
  from (select ev.*, coalesce((select t.name from _tz t where t.name = ev.timezone), 'America/New_York') as tz,
               lower(coalesce(ev.title, '') || ' ' || coalesce(ev.event_type, '') || ' ' || coalesce(ev.metadata->>'calendar_event_type', '') || ' ' || coalesce(ev.metadata->>'event_kind', '')) as txt
        from public.events ev) e
  left join _own o on o.id = e.id
  where e.status <> 'cancelled' and coalesce(e.metadata->>'time_fixed', '') <> 'true'
    and e.event_type is distinct from 'travel' and e.event_type is distinct from 'housing'
    and coalesce(e.title, '') !~* '(\mstay|hotel|holiday|day off|movement|in paris|in new york|relocat|vacation)'
    and ( e.all_day is true or ( (e.starts_at at time zone e.tz)::time = time '00:00' and (e.ends_at is null or e.ends_at - e.starts_at >= interval '20 hours') ) )
    and ( e.ends_at is null
          or (e.ends_at at time zone e.tz)::date <= (e.starts_at at time zone e.tz)::date
          or ((e.ends_at at time zone e.tz)::time = time '00:00' and (e.ends_at at time zone e.tz)::date = (e.starts_at at time zone e.tz)::date + 1) )
) z;

-- what is already booked for each agent and each model (timed events that are not being retimed)
create temp table _busy (res text, s timestamptz, e timestamptz);
insert into _busy
select 'o:' || coalesce(ev.owner_member_id, o.member_id)::text, ev.starts_at, coalesce(ev.ends_at, ev.starts_at + interval '1 hour')
from public.events ev left join _own o on o.id = ev.id
where coalesce(ev.owner_member_id, o.member_id) is not null and ev.status <> 'cancelled' and ev.all_day is not true
  and (ev.ends_at is null or ev.ends_at - ev.starts_at < interval '20 hours') and ev.id not in (select id from _cand)
union all
select 'm:' || x.model_id::text, ev.starts_at, coalesce(ev.ends_at, ev.starts_at + interval '1 hour')
from public.events ev join public.event_models x on x.event_id = ev.id
where ev.status <> 'cancelled' and ev.all_day is not true and (ev.ends_at is null or ev.ends_at - ev.starts_at < interval '20 hours') and ev.id not in (select id from _cand)
union all
select 'm:' || l.model_id::text, ev.starts_at, coalesce(ev.ends_at, ev.starts_at + interval '1 hour')
from _links l join public.events ev on ev.id = l.event_id
where ev.status <> 'cancelled' and ev.all_day is not true and (ev.ends_at is null or ev.ends_at - ev.starts_at < interval '20 hours') and ev.id not in (select id from _cand);
create index on _busy (res, s);

create temp table _plan (id uuid primary key, new_start timestamptz, new_end timestamptz, crowded boolean);

-- give each one the first free slot at or after its usual time, for its agent and every model on it; if the day is full, the nearest free slot before it
do $f$
declare r record; rs text[]; m int; found boolean; s_ts timestamptz; e_ts timestamptz; pass int;
begin
  for r in select * from _cand order by d, prio, id loop
    rs := array(select 'o:' || r.owner_id::text where r.owner_id is not null) || array(select 'm:' || x.model_id::text from public.event_models x where x.event_id = r.id) || array(select 'm:' || l.model_id::text from _links l where l.event_id = r.id);
    found := false;
    for pass in 0..1 loop
      exit when found;
      m := r.base;
      while not found and m between 510 and 1080 loop
        if not (m >= 720 and m < 780 and not (r.base >= 720 and r.base < 780)) then
          s_ts := ((r.d::timestamp + make_interval(mins => m)) at time zone r.tz);
          e_ts := s_ts + make_interval(mins => r.dur);
          if not exists (select 1 from _busy b where b.res = any(rs) and b.s < e_ts and s_ts < b.e) then found := true; end if;
        end if;
        if not found then m := m + case when pass = 0 then 15 else -15 end; end if;
      end loop;
    end loop;
    if not found then
      s_ts := ((r.d::timestamp + make_interval(mins => r.base)) at time zone r.tz); e_ts := s_ts + make_interval(mins => r.dur);
    end if;
    insert into _plan values (r.id, s_ts, e_ts, not found);
    insert into _busy select x, s_ts, e_ts from unnest(rs) x;
  end loop;
end
$f$;

-- meeting tasks follow their event; tasks due at midnight get a real end-of-day time
create temp table _tasks as
select t.id, p.new_start as new_due, 'follows its meeting'::text as why
from _plan p join public.events e on e.id = p.id join public.tasks t on t.id::text = e.metadata->>'task_id' where t.status not in ('completed', 'cancelled', 'done')
union all
select t.id, (((t.due_at at time zone 'America/New_York')::date + time '17:00') at time zone 'America/New_York'), 'was due at midnight'
from public.tasks t
where t.status not in ('completed', 'cancelled', 'done') and t.due_at is not null and (t.due_at at time zone 'America/New_York')::time = time '00:00'
  and coalesce(t.metadata->>'time_fixed', '') <> 'true' and t.id not in (select t2.id from _plan p2 join public.events e2 on e2.id = p2.id join public.tasks t2 on t2.id::text = e2.metadata->>'task_id');

insert into public.calendar_time_fix_backup (event_id, batch, old_starts_at, old_ends_at, old_all_day, old_timezone, old_owner_member_id, old_metadata)
select e.id, '2026-11-10', e.starts_at, e.ends_at, e.all_day, e.timezone, e.owner_member_id, e.metadata
from public.events e where e.id in (select id from _plan union select id from _own union select event_id from _links) on conflict do nothing;
insert into public.calendar_time_fix_tasks (task_id, batch, old_due_at) select t.id, '2026-11-10', t.due_at from public.tasks t where t.id in (select id from _tasks) on conflict do nothing;
insert into public.calendar_time_fix_links (event_id, model_id, batch) select event_id, model_id, '2026-11-10' from _links on conflict do nothing;

update public.events e set owner_member_id = o.member_id, updated_at = now() from _own o where e.id = o.id and e.owner_member_id is null;
insert into public.event_models (organization_id, event_id, model_id) select e.organization_id, l.event_id, l.model_id from _links l join public.events e on e.id = l.event_id;
update public.events e set starts_at = p.new_start, ends_at = p.new_end, all_day = false, timezone = c.tz,
  metadata = coalesce(e.metadata, '{}'::jsonb) || jsonb_build_object('time_fixed', true, 'time_fixed_on', '2026-11-10', 'time_fixed_from', case when c.old_all_day then 'all_day' else 'midnight' end, 'time_crowded', p.crowded),
  updated_at = now()
from _plan p join _cand c on c.id = p.id where e.id = p.id;
update public.tasks t set due_at = x.new_due, metadata = coalesce(t.metadata, '{}'::jsonb) || '{"time_fixed": true}'::jsonb from _tasks x where t.id = x.id;
commit;

select what, detail from (
  select 1 as n, 'events given a real time'::text as what, count(*)::text as detail from _plan
  union all select 2, 'events that had no free slot that day (flagged time_crowded)', count(*)::text from _plan where crowded
  union all select 3, 'events given an agent', count(*)::text from _own
  union all select 4, 'events linked to the model named in the title', count(*)::text from _links
  union all select 5, 'tasks updated', count(*)::text from _tasks
  union all select 6, 'placeholder events still left (stays, long trips, etc.)', count(*)::text from public.events e where e.status <> 'cancelled' and e.all_day is true
) a order by n;
