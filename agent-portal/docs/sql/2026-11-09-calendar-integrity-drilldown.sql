-- Calendar integrity drill-down. READ-ONLY. Run as ONE query; it explains the big numbers from the scorecard.
-- Columns: section, label, n. Nothing is changed.
with em as (
  select event_id, string_agg(model_id::text, ',' order by model_id::text) as models, count(*) as model_count
  from public.event_models group by event_id
), ev as (
  select e.*, coalesce(em.models, '') as models, coalesce(em.model_count, 0) as model_count,
    case when e.metadata->>'import_key' is not null then 'prepared-schedule import'
         when e.metadata->>'plan' is not null then 'gameplan (' || (e.metadata->>'plan') || ')'
         else 'typed in by hand or other tool' end as source
  from public.events e left join em on em.event_id = e.id
), dup as (
  select organization_id, title, starts_at, count(*) as c, count(distinct models) as dm, min(source) as source, min(event_type) as event_type
  from ev group by organization_id, title, starts_at having count(*) > 1
), rows_ as (
  select 'A duplicates: same models, same title and time (true duplicates)'::text as section, source as label, sum(c - 1)::int as n from dup where dm = 1 group by source
  union all select 'A duplicates: different models each (probably one entry per model, normal)', source, sum(c - 1)::int from dup where dm = c group by source
  union all select 'A duplicates: mixed', source, sum(c - 1)::int from dup where dm > 1 and dm < c group by source
  union all select 'B worst true duplicates (extra copies)', left(title, 60) || ' | ' || to_char(starts_at, 'YYYY-MM-DD'), (c - 1)::int from (select * from dup where dm = 1 order by c desc limit 15) t
  union all select 'C events on archived/inactive models: still ahead', 'from today onward', count(*)::int from public.event_models x join public.models m on m.id = x.model_id join public.events e on e.id = x.event_id where (m.status ~* '^(archiv|releas|inactive|former)' or m.active is false) and e.starts_at >= now()
  union all select 'C events on archived/inactive models: in the past', 'before today', count(*)::int from public.event_models x join public.models m on m.id = x.model_id join public.events e on e.id = x.event_id where (m.status ~* '^(archiv|releas|inactive|former)' or m.active is false) and e.starts_at < now()
  union all select 'D private with a model attached', coalesce(event_type, '(none)') || ' | ' || source, count(*)::int from ev where visibility = 'private' and model_count > 0 group by event_type, source
  union all select 'E hidden by the keyword filter', coalesce(event_type, '(none)') || ' | ' || source, count(*)::int from ev where model_count > 0 and visibility <> 'private' and coalesce(metadata->>'share_with_models', '') <> 'true' and (metadata->>'model_created') is distinct from 'true'
    and ( (coalesce(event_type,'') || ' ' || coalesce(title,'') || ' ' || coalesce(notes,'') || ' ' || coalesce(metadata->>'category','') || ' ' || coalesce(metadata->>'event_kind','')) ~* '\m(agent task|agent agenda|internal agenda|internal review|internal meeting|booker task|booker agenda|crm|finance|invoice|relationship|submission strategy|client follow.?up|agency admin|agent-only|staff only)\M'
       or (coalesce(event_type,'') || ' ' || coalesce(title,'') || ' ' || coalesce(notes,'') || ' ' || coalesce(metadata->>'category','') || ' ' || coalesce(metadata->>'event_kind','')) !~* '\m(casting|go.?see|fitting|booking|job|show|runway|test shoot|photoshoot|photo shoot|test|digital|polaroid|practice|training|walk practice|runway practice|rehearsal|model meeting|model-agent|agent meeting|meeting|model movement|movement|travel|flight|fly.?in|fly.?out|arrival|departure|airport|housing|check.?in|check.?out|visa appointment|consulate appointment|passport appointment|call time)\M' )
    group by event_type, source
  union all select 'F no time zone', coalesce(event_type, '(none)') || ' | ' || source, count(*)::int from ev where timezone is null group by event_type, source
  union all select 'G double-booked pairs: same title (really duplicates)', 'pairs', count(*)::int from ev a join public.event_models am on am.event_id = a.id join public.event_models bm on bm.model_id = am.model_id and bm.event_id <> am.event_id join ev b on b.id = bm.event_id where a.id < b.id and a.all_day is not true and b.all_day is not true and a.ends_at is not null and b.ends_at is not null and a.starts_at < b.ends_at and b.starts_at < a.ends_at and a.status <> 'cancelled' and b.status <> 'cancelled' and a.title = b.title
  union all select 'G double-booked pairs: different titles (real clashes)', 'pairs, still ahead', count(*)::int from ev a join public.event_models am on am.event_id = a.id join public.event_models bm on bm.model_id = am.model_id and bm.event_id <> am.event_id join ev b on b.id = bm.event_id where a.id < b.id and a.all_day is not true and b.all_day is not true and a.ends_at is not null and b.ends_at is not null and a.starts_at < b.ends_at and b.starts_at < a.ends_at and a.status <> 'cancelled' and b.status <> 'cancelled' and a.title <> b.title and a.starts_at >= now()
  union all select 'H multi-day events by type', coalesce(event_type, '(none)') || ' | still running or ahead: ' || (ends_at >= now())::text, count(*)::int from ev where ends_at is not null and (ends_at at time zone 'UTC')::date > (starts_at at time zone 'UTC')::date group by event_type, (ends_at >= now())
)
select section, label, n from rows_ where n is not null order by section, n desc, label limit 100;
