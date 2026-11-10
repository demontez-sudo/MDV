-- Gives the last 8 travel events a time zone (the cities the first pass did not recognise). Run once. Nothing is deleted.
-- Where the departure city is not in the title, the New York or Paris end of the trip is used.
update public.events e set timezone = m.tz, metadata = coalesce(e.metadata, '{}'::jsonb) || '{"fixed_on": "2026-11-09"}'::jsonb
from (values
  ('Sullivan Jordan — New York Travel — Flight', 'America/New_York'),
  ('✈ Atlanta → New York', 'America/New_York'),
  ('Sullivan Jordan — Model Travel to New York', 'America/New_York'),
  ('✈ 340 West 40th St, New York, NY 10018', 'America/New_York'),
  ('Akvile - New York Fly In', 'America/New_York'),
  ('Ayan - Flying Paris', 'Europe/Paris'),
  ('✈ South Sudan → Paris', 'Africa/Juba'),
  ('✈ Nigeria → Paris', 'Africa/Lagos')
) as m(title, tz)
where e.title = m.title and e.event_type = 'travel' and e.timezone is null;

select count(*) as travel_events_still_without_a_time_zone from public.events where event_type = 'travel' and timezone is null;
