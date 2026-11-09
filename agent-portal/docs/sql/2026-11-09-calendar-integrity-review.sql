-- Calendar review list. READ-ONLY. Run as ONE query. Shows the actual rows behind the numbers so you can decide what to fix.
-- section, a, b, c, d: read each section's heading below.
with em as (
  select x.event_id, string_agg(x.model_id::text, ',' order by x.model_id::text) as models, string_agg(coalesce(m.display_name, '?'), ', ' order by m.display_name) as names
  from public.event_models x left join public.models m on m.id = x.model_id group by x.event_id
), ev as (
  select e.*, coalesce(em.models, '') as models, coalesce(em.names, '') as names from public.events e left join em on em.event_id = e.id
), hid as (
  select * from ev where models <> '' and visibility <> 'private' and coalesce(metadata->>'share_with_models', '') <> 'true' and (metadata->>'model_created') is distinct from 'true'
    and ( (coalesce(event_type,'') || ' ' || coalesce(title,'') || ' ' || coalesce(notes,'') || ' ' || coalesce(metadata->>'category','') || ' ' || coalesce(metadata->>'event_kind','')) ~* '\m(agent task|agent agenda|internal agenda|internal review|internal meeting|booker task|booker agenda|crm|finance|invoice|relationship|submission strategy|client follow.?up|agency admin|agent-only|staff only)\M'
       or (coalesce(event_type,'') || ' ' || coalesce(title,'') || ' ' || coalesce(notes,'') || ' ' || coalesce(metadata->>'category','') || ' ' || coalesce(metadata->>'event_kind','')) !~* '\m(casting|go.?see|fitting|booking|job|show|runway|test shoot|photoshoot|photo shoot|test|digital|polaroid|practice|training|walk practice|runway practice|rehearsal|model meeting|model-agent|agent meeting|meeting|model movement|movement|travel|flight|fly.?in|fly.?out|arrival|departure|airport|housing|check.?in|check.?out|visa appointment|consulate appointment|passport appointment|call time)\M' )
), dupg as (
  select organization_id, title, starts_at, models from ev group by organization_id, title, starts_at, models having count(*) > 1
)
select * from (
  select '1 true duplicate (keep oldest, remove the rest)'::text as section, e.id::text as a, left(e.title, 50) as b, to_char(e.starts_at, 'YYYY-MM-DD HH24:MI') as c, 'added ' || to_char(e.created_at, 'YYYY-MM-DD HH24:MI') || ' ' || coalesce(e.names, '') as d
  from ev e join dupg g on g.organization_id = e.organization_id and g.title = e.title and g.starts_at = e.starts_at and g.models = e.models
  union all
  select * from (select '2 on an archived/inactive model, still ahead', e.id::text, left(e.title, 50), to_char(e.starts_at, 'YYYY-MM-DD HH24:MI'), e.names || ' (' || m.status || ')'
    from public.event_models x join public.models m on m.id = x.model_id join ev e on e.id = x.event_id
    where (m.status ~* '^(archiv|releas|inactive|former)' or m.active is false) and e.starts_at >= now() order by e.starts_at limit 20) t2
  union all
  select * from (select '3 real clash (different titles, still ahead)', a.names, left(a.title, 30) || '  vs  ' || left(b.title, 30), to_char(a.starts_at, 'YYYY-MM-DD HH24:MI'), 'to ' || to_char(a.ends_at, 'HH24:MI') || ' / ' || to_char(b.starts_at, 'HH24:MI') || '-' || to_char(b.ends_at, 'HH24:MI')
    from ev a join public.event_models am on am.event_id = a.id join public.event_models bm on bm.model_id = am.model_id and bm.event_id <> am.event_id join ev b on b.id = bm.event_id
    where a.id < b.id and a.all_day is not true and b.all_day is not true and a.ends_at is not null and b.ends_at is not null and a.starts_at < b.ends_at and b.starts_at < a.ends_at and a.status <> 'cancelled' and b.status <> 'cancelled' and a.title <> b.title and a.starts_at >= now() order by a.starts_at limit 25) t3
  union all
  select * from (select '4 hidden from the model by the keyword filter (sample)', h.event_type, left(h.title, 50), to_char(h.starts_at, 'YYYY-MM-DD'), h.names
    from (select *, row_number() over (partition by event_type order by starts_at) as rn from hid where event_type in ('visa', 'deadline', 'other')) h where h.rn <= 8 order by h.event_type, h.starts_at) t4
  union all
  select * from (select '5 time zones in use', coalesce(timezone, '(none)'), count(*)::text, '', '' from public.events group by timezone order by count(*) desc limit 6) t5
) r order by section, c, b limit 100;
