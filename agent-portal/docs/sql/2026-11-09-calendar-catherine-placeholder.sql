-- Catherine Olatundun's "✈ Lagos -> Paris" (20 Oct to 19 Nov) is a placeholder, not a flight. Change its type from travel to visa
-- so the clash fix and the scan stop treating it as real travel. It stays on her calendar (share_with_models = true). Run once.
update public.events e set event_type = 'visa',
  metadata = coalesce(e.metadata, '{}'::jsonb) || '{"placeholder": true, "share_with_models": true, "fixed_on": "2026-11-09"}'::jsonb
where e.title = '✈ Lagos → Paris' and e.event_type = 'travel'
  and e.starts_at = '2026-10-20 13:00:00+00' and e.ends_at = '2026-11-19 23:00:00+00'
  and exists (select 1 from public.event_models x join public.models m on m.id = x.model_id where x.event_id = e.id and m.display_name = 'Catherine Olatundun');

select e.title, e.event_type, e.starts_at, e.ends_at from public.events e
where e.title = '✈ Lagos → Paris' and e.starts_at = '2026-10-20 13:00:00+00';
