-- Sullivan Jordan: attach "Exit digitals", share "Sullivan: Paris test locked", and turn "Digitals · Atlanta" into a real booking.
-- Run the whole file once. It is wrapped in a transaction and checks itself at the end.

begin;

-- 0) Look first (nothing changes here): the three records and who they are linked to.
select e.id, e.title, e.starts_at, e.visibility, e.metadata->>'share_with_models' as share_with_models,
       (select count(*) from event_models em where em.event_id = e.id) as models_linked
from events e
where e.id in ('da3a6881-1e7c-427e-84e3-0ae70868273b','72ec7eec-94b4-4bb3-9fb5-696c2f66ee3e','d7e1515d-f8fc-484b-aac2-452e48620103');

-- 1) Attach "Exit digitals" to Sullivan.
insert into event_models (organization_id, event_id, model_id)
select e.organization_id, e.id, m.id
from events e, (select id from models where display_name ilike '%sullivan%jordan%' limit 1) m
where e.id = 'da3a6881-1e7c-427e-84e3-0ae70868273b'
  and not exists (select 1 from event_models x where x.event_id = e.id and x.model_id = m.id);

-- 2) Share "Sullivan: Paris test locked" with the model.
update events
set visibility = 'model_shared',
    metadata = coalesce(metadata, '{}'::jsonb) || '{"share_with_models": true}'::jsonb
where id = '72ec7eec-94b4-4bb3-9fb5-696c2f66ee3e';

-- 3) "Digitals · Atlanta" becomes a booking for Sullivan (same time, place and notes), then the duplicate event is removed
--    if she is the only model on it. If other models are on it, the event stays and only her link is removed.
do $$
declare
  ev events%rowtype;
  mid uuid;
  bid uuid;
  others int;
begin
  select id into mid from models where display_name ilike '%sullivan%jordan%' limit 1;
  select * into ev from events where id = 'd7e1515d-f8fc-484b-aac2-452e48620103';
  if mid is null or ev.id is null then raise exception 'Sullivan or the Digitals event was not found'; end if;

  if exists (select 1 from bookings b join booking_models bm on bm.booking_id = b.id
             where bm.model_id = mid and b.title = ev.title and b.starts_at = ev.starts_at) then
    raise notice 'Booking already exists, skipping.';
    return;
  end if;

  insert into bookings (organization_id, title, status, starts_at, ends_at, timezone, location, metadata)
  values (ev.organization_id, ev.title, 'confirmed', ev.starts_at, ev.ends_at, ev.timezone, ev.location,
          jsonb_build_object('converted_from_event_id', ev.id, 'converted_on', now()))
  returning id into bid;

  insert into booking_models (organization_id, booking_id, model_id, status)
  values (ev.organization_id, bid, mid, 'confirmed');

  delete from event_models where event_id = ev.id and model_id = mid;
  select count(*) into others from event_models where event_id = ev.id;
  if others = 0 then delete from events where id = ev.id; end if;
end $$;

-- Check: Sullivan's items for this week, with where they now live.
select 'event' as kind, e.title, e.starts_at, e.visibility from event_models em join events e on e.id = em.event_id
  where em.model_id = (select id from models where display_name ilike '%sullivan%jordan%' limit 1)
    and e.starts_at >= '2026-11-12' and e.starts_at < '2026-11-17'
union all
select 'booking', b.title, b.starts_at, b.status from booking_models bm join bookings b on b.id = bm.booking_id
  where bm.model_id = (select id from models where display_name ilike '%sullivan%jordan%' limit 1)
    and b.starts_at >= '2026-11-12' and b.starts_at < '2026-11-17'
order by starts_at;

commit;
