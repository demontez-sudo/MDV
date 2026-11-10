-- Puts Catherine Olatundun back on the 7 group sessions the clash fix took her off (her Lagos -> Paris entry is a placeholder, not real travel). Run once.
-- Safe to run twice: she is only added where she is not already on the session.
insert into public.event_models (organization_id, event_id, model_id)
select e.organization_id, e.id, m.id
from public.events e
join public.models m on m.display_name = 'Catherine Olatundun' and m.organization_id = e.organization_id
join (values
  ('Yoga & Fitness — Conditioning Block', '2026-11-10 11:00:00+00'::timestamptz),
  ('Model Training / New Face',           '2026-11-10 16:00:00+00'::timestamptz),
  ('Yoga & Fitness — Conditioning Block', '2026-11-11 11:00:00+00'::timestamptz),
  ('Yoga & Fitness — Conditioning Block', '2026-11-12 11:00:00+00'::timestamptz),
  ('Skin Submission',                     '2026-11-12 22:45:00+00'::timestamptz),
  ('Model Training / New Face',           '2026-11-13 16:00:00+00'::timestamptz),
  ('Model Training / New Face',           '2026-11-17 16:00:00+00'::timestamptz)
) as s(title, starts_at) on s.title = e.title and s.starts_at = e.starts_at
where not exists (select 1 from public.event_models x where x.event_id = e.id and x.model_id = m.id);

select count(*) as sessions_catherine_is_now_on
from public.event_models x join public.events e on e.id = x.event_id join public.models m on m.id = x.model_id
where m.display_name = 'Catherine Olatundun'
  and (e.title, e.starts_at) in (
    ('Yoga & Fitness — Conditioning Block', '2026-11-10 11:00:00+00'::timestamptz), ('Model Training / New Face', '2026-11-10 16:00:00+00'::timestamptz),
    ('Yoga & Fitness — Conditioning Block', '2026-11-11 11:00:00+00'::timestamptz), ('Yoga & Fitness — Conditioning Block', '2026-11-12 11:00:00+00'::timestamptz),
    ('Skin Submission', '2026-11-12 22:45:00+00'::timestamptz), ('Model Training / New Face', '2026-11-13 16:00:00+00'::timestamptz),
    ('Model Training / New Face', '2026-11-17 16:00:00+00'::timestamptz));
