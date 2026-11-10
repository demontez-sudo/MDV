-- Model plan, 10 Nov 2026. Run once, as one script (one transaction). Best run AFTER 2026-11-10-calendar-real-times.sql.
-- 1) No test shoot starts before next weekend: any test shoot dated 10-20 Nov moves to the first free slot (for its model and agent) on or after Sat 21 Nov.
-- 2) Creates: Sullivan's digitals in Atlanta (Sat 14 Nov, 11 AM to 1 PM, call 10:30), and the holiday-shoot model movement for Tosin and Krishita starting Thu 10 Dec
--    (a timed start on 10 Dec at 9 AM Paris time, plus a December movement window to 31 Dec you can edit). Each has a time, place, agent and full details, and shows on the model's calendar.
-- 3) Model events with no description get a short plain one for their kind of event, with the agent's name.
-- Everything is backed up first; 2026-11-10-calendar-model-plan-undo.sql restores it.
create table if not exists public.calendar_time_fix_backup (event_id uuid not null, batch text not null, old_starts_at timestamptz, old_ends_at timestamptz, old_all_day boolean, old_timezone text, old_owner_member_id uuid, old_metadata jsonb, backed_up_at timestamptz default now(), primary key (event_id, batch));
alter table public.calendar_time_fix_backup enable row level security;
alter table public.calendar_time_fix_backup add column if not exists old_notes text;
begin;

drop table if exists _tz, _staff_u, _ts, _busy, _tsplan, _new, _fill;

create temp table _tz as select name from pg_timezone_names where name in (select distinct timezone from public.events where timezone is not null);
create temp table _staff_u as
select s.first, (array_agg(s.member_id))[1] as member_id
from (select om.id as member_id, lower(coalesce(nullif(p.first_name, ''), split_part(p.display_name, ' ', 1))) as first
      from public.organization_members om join public.profiles p on p.user_id = om.user_id
      where om.status = 'active' and coalesce(om.member_type, 'staff') = 'staff') s
where s.first <> '' group by s.first having count(*) = 1;

-- 1) test shoots that start before next weekend (Sat 21 Nov 2026): they move to the first free slot on or after that Saturday.
--    Briefs, prep, digitals and reviews are not test shoots and stay where they are.
create temp table _ts as
select e.id, coalesce((select t.name from _tz t where t.name = e.timezone), 'America/New_York') as tz, e.starts_at as old_start, e.ends_at as old_end,
  case when e.ends_at is not null and e.ends_at - e.starts_at between interval '60 minutes' and interval '10 hours' then (extract(epoch from e.ends_at - e.starts_at) / 60)::int else 180 end as dur
from public.events e
where e.status not in ('cancelled', 'completed') and (e.event_type = 'test' or e.title ~* 'test shoot')
  and e.title !~* '(brief|prep|digital|review|follow|debrief|polaroid)'
  and (e.starts_at at time zone coalesce((select t.name from _tz t where t.name = e.timezone), 'America/New_York'))::date between date '2026-11-10' and date '2026-11-20';

create temp table _busy (res text, s timestamptz, e timestamptz);
insert into _busy
select 'o:' || ev.owner_member_id::text, ev.starts_at, coalesce(ev.ends_at, ev.starts_at + interval '1 hour')
from public.events ev where ev.owner_member_id is not null and ev.status <> 'cancelled' and ev.all_day is not true
  and (ev.ends_at is null or ev.ends_at - ev.starts_at < interval '20 hours') and ev.id not in (select id from _ts)
union all
select 'm:' || x.model_id::text, ev.starts_at, coalesce(ev.ends_at, ev.starts_at + interval '1 hour')
from public.events ev join public.event_models x on x.event_id = ev.id
where ev.status <> 'cancelled' and ev.all_day is not true and (ev.ends_at is null or ev.ends_at - ev.starts_at < interval '20 hours') and ev.id not in (select id from _ts);
create index on _busy (res, s);
create temp table _tsplan (id uuid primary key, new_start timestamptz, new_end timestamptz, crowded boolean);

do $f$
declare r record; rs text[]; d date; m int; found boolean; s_ts timestamptz; e_ts timestamptz; dd date; mm int;
begin
  for r in select t.*, e.owner_member_id from _ts t join public.events e on e.id = t.id order by t.old_start, t.id loop
    rs := array(select 'o:' || r.owner_member_id::text where r.owner_member_id is not null) || array(select 'm:' || x.model_id::text from public.event_models x where x.event_id = r.id);
    found := false;
    foreach dd in array array[date '2026-11-21', date '2026-11-22', date '2026-11-28', date '2026-11-29', date '2026-12-05'] loop
      exit when found;
      foreach mm in array array[600, 810, 990] loop
        s_ts := ((dd::timestamp + make_interval(mins => mm)) at time zone r.tz); e_ts := s_ts + make_interval(mins => r.dur);
        if not exists (select 1 from _busy b where b.res = any(rs) and b.s < e_ts and s_ts < b.e) then found := true; exit; end if;
      end loop;
    end loop;
    if not found then s_ts := ((date '2026-11-21'::timestamp + make_interval(mins => 600)) at time zone r.tz); e_ts := s_ts + make_interval(mins => r.dur); end if;
    insert into _tsplan values (r.id, s_ts, e_ts, not found);
    insert into _busy select x, s_ts, e_ts from unnest(rs) x;
  end loop;
end
$f$;

-- 2) events to create (each one only if it is not already there)
create temp table _new as
select v.key, m.organization_id, m.id as model_id, (select su.member_id from _staff_u su where su.first = lower(v.owner_first)) as owner_id,
  v.title,
  case when v.kind = 'window' then coalesce((select ev.event_type from public.events ev join public.event_models x on x.event_id = ev.id where x.model_id = m.id and ev.title = 'November movement' limit 1), 'housing') else v.etype end as etype,
  v.cal_type, ((v.s::timestamp) at time zone v.tz) as starts_at, ((v.e::timestamp) at time zone v.tz) as ends_at, v.tz, v.all_day, v.loc, v.notes, v.call_local
from (values
  ('mp-20261110-sullivan-digitals-atlanta', 'Sullivan Jordan', 'Demontez', 'Digitals · Atlanta', 'test', 'Digitals', '2026-11-14 11:00', '2026-11-14 13:00', 'America/New_York', false, 'Atlanta, GA (studio address to be confirmed)', 'point',
   E'Digitals for Sullivan Jordan in Atlanta, Saturday 14 Nov.\nCall time 10:30 AM. Shoot 11:00 AM to 1:00 PM.\nShot list: front, left and right profile, back, three-quarter turns, full length, head and shoulders, hands, and a few natural smiles.\nBring and wear: clean skin (no makeup), hair natural and off the face, a plain white tee and fitted dark pants or shorts, plain underwear, neutral shoes.\nYour agent Demontez will confirm the studio address and who you are meeting. Reply in the portal once you have read this.', '2026-11-14 10:30'),
  ('mp-20261110-tosin-movement-start-20261210', 'Tosin Florence', 'Erica', 'Model movement begins · Holiday shoots', 'travel', 'Model Movement', '2026-12-10 09:00', '2026-12-10 10:00', 'Europe/Paris', false, 'Paris', 'point',
   E'Model movement for the holiday shoots begins today, Thursday 10 Dec.\nYour agent Erica will confirm your route, travel times, housing, ground transport and the shoot schedule.\nKeep your passport and visa documents with you, and check the Travel page for the latest.', null),
  ('mp-20261110-krishita-movement-start-20261210', 'Krishita Shetty', 'Erica', 'Model movement begins · Holiday shoots', 'travel', 'Model Movement', '2026-12-10 09:00', '2026-12-10 10:00', 'Europe/Paris', false, 'Paris', 'point',
   E'Model movement for the holiday shoots begins today, Thursday 10 Dec.\nYour agent Erica will confirm your route, travel times, housing, ground transport and the shoot schedule.\nKeep your passport and visa documents with you, and check the Travel page for the latest.', null),
  ('mp-20261110-tosin-december-movement', 'Tosin Florence', 'Erica', 'December movement · Holiday shoots', 'housing', 'Stay', '2026-12-10 00:00', '2026-12-31 23:59', 'Europe/Paris', true, 'Paris', 'window',
   E'Holiday shoot movement. Starts Thursday 10 Dec. The end date, city and housing are being confirmed by your agent Erica.', null),
  ('mp-20261110-krishita-december-movement', 'Krishita Shetty', 'Erica', 'December movement · Holiday shoots', 'housing', 'Stay', '2026-12-10 00:00', '2026-12-31 23:59', 'Europe/Paris', true, 'Paris', 'window',
   E'Holiday shoot movement. Starts Thursday 10 Dec. The end date, city and housing are being confirmed by your agent Erica.', null)
) as v(key, model, owner_first, title, etype, cal_type, s, e, tz, all_day, loc, kind, notes, call_local)
join public.models m on m.display_name = v.model
where not exists (select 1 from public.events x where x.metadata->>'import_key' = v.key);

-- 3) model-facing events with no details get a plain, honest description for their kind of event
create temp table _fill as
select e.id,
  (case
    when txt ~ '(brief|prep)' then 'Prep for your shoot. Read the details your agent sent, check your wardrobe and availability, and reply in the portal so everything is ready.'
    when txt ~ 'digital' then 'Digitals. Arrive 30 minutes early with clean skin, hair natural and off the face, a plain white tee and fitted dark bottoms. No makeup or jewelry.'
    when txt ~ '(test shoot|test)' then 'Test shoot. Arrive 30 minutes before your call time with clean skin, hair natural and off the face, and fitted basics (plain white tee, fitted dark bottoms). No heavy makeup or jewelry.'
    when txt ~ '(casting|go.?see|callback)' then 'Casting. Arrive 15 minutes early with your book and digitals up to date, in fitted dark basics. Be ready to walk and pose.'
    when txt ~ '(booking|fitting|job)' then 'Booking. Confirm your call time and address the day before. Arrive on time with clean skin and hair, and bring what is on your list.'
    when txt ~ '(visa|immigration|passport|consulate|petition|document)' then 'Visa step. Keep your passport and the documents on your checklist ready, and tell your agent the same day if anything is missing.'
    when txt ~ '(deadline|due |expires)' or e.event_type = 'deadline' then 'Deadline. This needs to be done by this time. If you are blocked, tell your agent before the deadline, not after.'
    when txt ~ '(travel|flight|movement|arrival|departure|housing|stay)' then 'Movement. Your agent confirms route, flights, housing and ground transport. Check the Travel page for the latest and keep your passport with you.'
    when txt ~ '(training|yoga|fitness|walk|runway|practice|class)' then 'Training session. Arrive 10 minutes early in comfortable training clothes and bring water. If you cannot make it, tell your agent early.'
    when txt ~ '(check.?in|call|meeting|review|sync|coordination)' then 'Check-in with your agent. Come with your questions, your availability for the next two weeks, and anything you need from the agency.'
    else 'Details for this event are confirmed by your agent. Open it in the portal for updates.' end)
  || coalesce(case when su.first is not null then ' Your agent: ' || initcap(su.first) || '.' end, '') as notes
from (select ev.*, lower(coalesce(ev.title, '') || ' ' || coalesce(ev.event_type, '') || ' ' || coalesce(ev.metadata->>'calendar_event_type', '')) as txt from public.events ev) e
left join lateral (select lower(coalesce(nullif(p.first_name, ''), split_part(p.display_name, ' ', 1))) as first
                   from public.organization_members om join public.profiles p on p.user_id = om.user_id where om.id = e.owner_member_id) su on true
where e.status <> 'cancelled' and coalesce(btrim(e.notes), '') = '' and coalesce(e.metadata->>'detail_filled', '') <> 'true'
  and e.starts_at >= timestamp '2026-11-01' and exists (select 1 from public.event_models x where x.event_id = e.id);

insert into public.calendar_time_fix_backup (event_id, batch, old_starts_at, old_ends_at, old_all_day, old_timezone, old_owner_member_id, old_metadata, old_notes)
select e.id, '2026-11-10-model-plan', e.starts_at, e.ends_at, e.all_day, e.timezone, e.owner_member_id, e.metadata, e.notes
from public.events e where e.id in (select id from _tsplan union select id from _fill) on conflict do nothing;

update public.events e set starts_at = p.new_start, ends_at = p.new_end, all_day = false, timezone = c.tz,
  metadata = coalesce(e.metadata, '{}'::jsonb) || jsonb_build_object('moved_for_weekend_rule', true, 'time_crowded', p.crowded), updated_at = now()
from _tsplan p join _ts c on c.id = p.id where e.id = p.id;

with ins as (
  insert into public.events (organization_id, title, event_type, status, starts_at, ends_at, timezone, all_day, location, visibility, notes, owner_member_id, metadata)
  select n.organization_id, n.title, n.etype, 'confirmed', n.starts_at, n.ends_at, n.tz, n.all_day, n.loc, 'model_shared', n.notes, n.owner_id,
    jsonb_strip_nulls(jsonb_build_object('import_key', n.key, 'model_plan', '2026-11-10', 'calendar_event_type', n.cal_type, 'share_with_models', true, 'owner_name', (select initcap(first) from _staff_u where member_id = n.owner_id limit 1),
      'call_time', case when n.call_local is not null then ((n.call_local::timestamp) at time zone n.tz) end, 'event_kind', n.cal_type))
  from _new n returning id, metadata->>'import_key' as key)
insert into public.event_models (organization_id, event_id, model_id)
select n.organization_id, i.id, n.model_id from ins i join _new n on n.key = i.key;

update public.events e set notes = f.notes, metadata = coalesce(e.metadata, '{}'::jsonb) || '{"detail_filled": true}'::jsonb, updated_at = now() from _fill f where e.id = f.id;
commit;

select what, detail from (
  select 1 as n, 'test shoots moved to Sat 21 Nov or later'::text as what, (select count(*) from _tsplan)::text as detail
  union all select 2, 'of those, no free slot found (check them)', (select count(*) from _tsplan where crowded)::text
  union all select 3, 'events created', (select count(*) from _new)::text
  union all select 4, 'events given a description', (select count(*) from _fill)::text
  union all select 5, 'test shoots still starting before Sat 21 Nov', (select count(*)::text from public.events e where e.status not in ('cancelled','completed') and (e.event_type = 'test' or e.title ~* 'test shoot') and e.title !~* '(brief|prep|digital|review|follow|debrief|polaroid)' and e.starts_at >= timestamp '2026-11-10' and e.starts_at < timestamp '2026-11-21')
) a order by n;
