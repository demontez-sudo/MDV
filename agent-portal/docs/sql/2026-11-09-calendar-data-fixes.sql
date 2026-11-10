-- Calendar data fixes, 9 Nov 2026. Run ONCE in the Supabase SQL editor, as one script (one transaction). Nothing is deleted.
-- 1) Models can now see their own visa, deadline, meeting and booking dates that the schedule import saved as private. Notes stay on the agency side.
-- 2) Everything else that has a model attached but is meant for the team only (import "other" items, agent working items such as "Visa Documentation Submission")
--    is marked agent-only (share_with_models = false), so it stays hidden from models on purpose and the integrity scan stops reporting it.
-- 3) Travel events with no time zone get one from the city they leave (Lagos, Paris, New York, Lima, Seoul, India). Any other city is left alone.
-- Every row changed carries metadata.fixed_on = 2026-11-09 so it can be found and undone.
drop table if exists _shared, _tagged, _tz;
begin;
create temp table _shared as
with u as (
  update public.events e set visibility = 'model_shared',
    metadata = coalesce(e.metadata, '{}'::jsonb) || '{"share_with_models": true, "notes_internal": true, "fixed_on": "2026-11-09"}'::jsonb
  where e.visibility = 'private' and e.metadata->>'import_key' is not null and e.event_type in ('visa', 'deadline', 'meeting', 'booking')
    and coalesce(e.metadata->>'share_with_models', '') <> 'false'
    and exists (select 1 from public.event_models m where m.event_id = e.id)
  returning e.id) select id from u;

create temp table _tagged as
with u as (
  update public.events e set metadata = coalesce(e.metadata, '{}'::jsonb) || '{"share_with_models": false, "agent_only": true, "fixed_on": "2026-11-09"}'::jsonb
  where exists (select 1 from public.event_models m where m.event_id = e.id)
    and coalesce(e.metadata->>'share_with_models', '') <> 'false'
    and coalesce(e.metadata->>'share_with_models', '') <> 'true'
    and (e.metadata->>'model_created') is distinct from 'true'
    and ( e.visibility = 'private'
          or ( e.visibility <> 'private' and ( (coalesce(e.event_type,'') || ' ' || coalesce(e.title,'') || ' ' || coalesce(e.notes,'') || ' ' || coalesce(e.metadata->>'category','') || ' ' || coalesce(e.metadata->>'event_kind','')) ~* '\m(agent task|agent agenda|internal agenda|internal review|internal meeting|booker task|booker agenda|crm|finance|invoice|relationship|submission strategy|client follow.?up|agency admin|agent-only|staff only)\M'
       or (coalesce(e.event_type,'') || ' ' || coalesce(e.title,'') || ' ' || coalesce(e.notes,'') || ' ' || coalesce(e.metadata->>'category','') || ' ' || coalesce(e.metadata->>'event_kind','')) !~* '\m(casting|go.?see|fitting|booking|job|show|runway|test shoot|photoshoot|photo shoot|test|digital|polaroid|practice|training|walk practice|runway practice|rehearsal|model meeting|model-agent|agent meeting|meeting|model movement|movement|travel|flight|fly.?in|fly.?out|arrival|departure|airport|housing|check.?in|check.?out|visa appointment|consulate appointment|passport appointment|call time)\M' ) ) )
  returning e.id) select id from u;

create temp table _tz as
with u as (
  update public.events e set timezone = case
      when split_part(e.title, '→', 1) ~* 'lagos' then 'Africa/Lagos'
      when split_part(e.title, '→', 1) ~* '(india|mumbai|delhi|bangalore|kolkata)' then 'Asia/Kolkata'
      when split_part(e.title, '→', 1) ~* 'paris' then 'Europe/Paris'
      when split_part(e.title, '→', 1) ~* '(new york|nyc|jfk)' then 'America/New_York'
      when split_part(e.title, '→', 1) ~* 'lima' then 'America/Lima'
      when split_part(e.title, '→', 1) ~* 'seoul' then 'Asia/Seoul' end,
    metadata = coalesce(e.metadata, '{}'::jsonb) || '{"fixed_on": "2026-11-09"}'::jsonb
  where e.timezone is null and e.event_type = 'travel' and e.title like '%→%'
    and split_part(e.title, '→', 1) ~* '(lagos|india|mumbai|delhi|bangalore|kolkata|paris|new york|nyc|jfk|lima|seoul)'
  returning e.id) select id from u;
commit;

select 'private import events now shared with their models' as what, (select count(*) from _shared)::int as n
union all select 'team-only events marked agent-only on purpose', (select count(*) from _tagged)::int
union all select 'travel events given a time zone', (select count(*) from _tz)::int
union all select 'travel events still without a time zone (city not recognised)', (select count(*) from public.events where timezone is null)::int;
